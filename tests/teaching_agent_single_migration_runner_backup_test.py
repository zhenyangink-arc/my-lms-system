"""Owned dump, seal, restore and failure tests. Never reads a production backup."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import time
import unittest
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('owned_backup_fixture',ROOT/'tests/fixtures/teaching-agent-single-migration-runner/postgres.py')
fixture=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixture)
from receipts import Failure,sha,safe_file,canonical
from backup_adapter import validate_backup,capture_backup,OwnedCluster
from maintenance_transport import _docker,OwnedTransport


class Backup(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.f=fixture.Fixture()
        try:
            cls.p,cls.a=cls.f.plan();cls.directory=cls.f.backup(cls.p,cls.a)
        except Exception:cls.f.close();raise

    @classmethod
    def tearDownClass(cls):cls.f.close()

    def copy_backup(self):
        tmp=tempfile.TemporaryDirectory(prefix='runner-i1-backup-test-');self.addCleanup(tmp.cleanup)
        root=Path(tmp.name)/'archive';shutil.copytree(self.directory,root)
        a=copy.deepcopy(self.a);a['backupDirectory']=str(root)
        return root,a

    def changed_manifest(self,p,a,change):
        m=json.loads((p/'metadata/manifest.json').read_text());change(m)
        (p/'metadata/manifest.json').write_bytes(canonical(m)+b'\n');a['backupManifestSha256']=sha(safe_file(p/'metadata/manifest.json',True))

    def denied(self,a):
        with self.assertRaises(Failure) as caught:validate_backup(self.p,a,self.f.transport)
        self.assertEqual(caught.exception.state,'BACKUP_FAILED')

    def test_RUNNER_D1_34(self):
        for file in ['metadata/manifest.json','database.dump','metadata/restore.json']:
            p,a=self.copy_backup();(p/file).unlink();self.denied(a)

    def test_RUNNER_D1_35(self):
        for start in [time.time()-901,time.time()+5]:
            p,a=self.copy_backup();self.changed_manifest(p,a,lambda m:m.update(snapshotStart=start));self.denied(a)

    def test_RUNNER_D1_36(self):
        for key,value in [('sourceIdentitySha256','0'*64),('ledgerCount',459),('fullSourcePrefixDigest','0'*64),('restoreStatus','FAIL'),('planSha256','0'*64)]:
            p,a=self.copy_backup();self.changed_manifest(p,a,lambda m:m.update({key:value}));self.denied(a)
        for file in ['database.dump','schema.dump','roles.sql','metadata/restore.json']:
            p,a=self.copy_backup();(p/file).write_bytes(b'corrupt');self.denied(a)

    def test_RUNNER_D1_37(self):
        p,a=self.copy_backup();(p/'database.dump').chmod(0o644);self.denied(a)
        p,a=self.copy_backup();p.chmod(0o755);self.denied(a)
        p,a=self.copy_backup();(p/'database.dump').unlink();(p/'database.dump').symlink_to(self.directory/'database.dump');self.denied(a)
        p,a=self.copy_backup();self.changed_manifest(p,a,lambda m:m['files'].update({'../escape':{'sha256':'0'*64,'bytes':0}}));self.denied(a)
        # Actual UID is validated by safe_file; synthetic wrong stat cannot pass.
        import stat
        original=Path.stat
        def wrong(path,*args,**kwargs):
            s=original(path,*args,**kwargs)
            if path==p/'metadata/manifest.json':
                v=list(s);v[4]=s.st_uid+1;return os.stat_result(v)
            return s
        with patch.object(Path,'stat',wrong):self.denied(a)

    def test_RUNNER_D1_38(self):
        m=validate_backup(self.p,self.a,self.f.transport)
        self.assertEqual(m['status'],'VALID');self.assertEqual(m['ledgerCount'],458)
        restored=json.loads((self.directory/'metadata/restore.json').read_text())
        self.assertEqual(restored['status'],'PASS');self.assertEqual(restored['cleanup'],'OWNED_CONTAINER_REMOVED')
        self.assertEqual(restored['network'],'none');self.assertEqual(restored['hostPorts'],0)
        self.assertEqual(restored['ledgerPrefixSha256'],self.p.data['ledger']['sourcePrefixSha256'])

    def test_RUNNER_D1_39(self):
        backup_auth=copy.deepcopy(self.a);backup_auth['scope']='BACKUP_READ_EXPORT'
        # Failed pg_dump must not seal a VALID backup.
        with patch.object(self.f.transport,'_tool',side_effect=Failure('BACKUP_FAILED','CAPTURE_FAILED')):
            with self.assertRaises(Failure):capture_backup(self.p,backup_auth,self.f.transport,self.f.root/'failed-backups')
        # Killing the real exporter invalidates the snapshot for pg_dump.
        original=self.f.transport._tool;once=[False]
        def kill(tool,args,data=None):
            if not once[0]:
                once[0]=True;self.f.sql("select pg_terminate_backend(pid) from pg_stat_activity where datname='postgres' and pid<>pg_backend_pid() and backend_type='client backend'")
            return original(tool,args,data)
        with patch.object(self.f.transport,'_tool',kill):
            with self.assertRaises(Failure):capture_backup(self.p,backup_auth,self.f.transport,self.f.root/'dead-exporter')
        for root in ['failed-backups','dead-exporter']:
            self.assertFalse(list((self.f.root/root).glob('*/metadata/manifest.json')))

    def test_RUNNER_D1_40(self):
        m=validate_backup(self.p,self.a,self.f.transport)
        self.assertEqual(m['rolesCapture'],'SEPARATE_NON_MVCC_CAPTURE_BEFORE_AFTER_FINGERPRINT_MATCH')
        a=copy.deepcopy(self.a);a['scope']='BACKUP_READ_EXPORT';original=self.f.transport._tool
        def drift(tool,args,data=None):
            result=original(tool,args,data)
            if tool=='pg_dumpall':self.f.sql('create role isolated_drift')
            return result
        try:
            with patch.object(self.f.transport,'_tool',drift):
                with self.assertRaises(Failure):capture_backup(self.p,a,self.f.transport,self.f.root/'drifting-roles')
        finally:self.f.sql('drop role if exists isolated_drift')
        self.assertFalse(list((self.f.root/'drifting-roles').glob('*/metadata/manifest.json')))

    def test_RUNNER_D1_41(self):
        roles=(self.directory/'roles.sql').read_text()
        self.assertNotRegex(roles,r'(?i)PASSWORD\s+\S+')
        for p in self.directory.rglob('*'):
            self.assertEqual(p.stat().st_mode&0o777,0o700 if p.is_dir() else 0o600)
            self.assertNotIn(p.name,['pgpass','pg_service.conf','root.crt','.env.local'])
        for n in ['metadata/manifest.json','metadata/restore.json']:
            raw=(self.directory/n).read_text();self.assertNotIn('postgresql://',raw);self.assertNotIn('PGPASSWORD',raw)
        self.assertEqual(self.directory.stat().st_mode&0o777,0o700)

    def test_RUNNER_D1_42(self):
        cluster=OwnedCluster();name=cluster.name
        cluster.transport._inspect();cluster.close()
        self.assertEqual(_docker(['ps','-aq','--filter','name=^/'+name+'$']).strip(),b'')
        self.assertNotEqual(name,self.f.name)
        self.f.transport._inspect()
        with self.assertRaises(Failure):OwnedTransport('arbitrary-container')



class BackupClientTLS(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec=importlib.util.spec_from_file_location('owned_tls_test_helpers',ROOT/'tests/teaching_agent_single_migration_runner_postgres_test.py')
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        cls.owned=module.OwnedTLSPath()

    @classmethod
    def tearDownClass(cls):cls.owned.close()

    def setUp(self):
        self.o=self.owned;self.t=self.o.transport
        self.o.ca='/tmp/tls/ca.crt';self.o.host='localhost';self.o.mode='verify-full';self.o.port=5432
        self.t._auth['expiresAt']=time.time()+899
        self.t._mode='BACKUP_READ_EXPORT';self.t._pending_tool_proofs.clear()
        self.t._backup_attempt=__import__('uuid').uuid4().hex

    def args(self,kind,snapshot):
        if kind=='roles':return 'pg_dumpall',['--roles-only','--no-role-passwords']
        return 'pg_dump',['-d','postgres','-Fc']+(['--schema-only'] if kind=='schema' else [])+['--snapshot='+snapshot]

    def snapshot(self,s):return s._json('select to_jsonb(pg_export_snapshot());')

    def real(self,kind):
        with self.t._session(True) as s:
            snapshot=self.snapshot(s);tool,args=self.args(kind,snapshot)
            raw=self.t._tool(tool,args);record=self.t._take_tool_proof(tool,raw);p=record['proof']
            self.assertEqual(p['tool'],tool);self.assertEqual(p['dumpKind'],kind)
            self.assertEqual(p['proofKind'],'REAL_INVOCATION_LIBPQ_ENFORCEMENT')
            self.assertEqual(p['outputSha256'],sha(raw));self.assertEqual(p['exitCode'],0)
            self.assertEqual(p['clientTls'],{'enabled':True,'version':None,'cipher':None})
            self.assertEqual(p['sslmode'],'verify-full');self.assertEqual(p['endpoint']['port'],5432)
            self.assertNotEqual(p['invocationId'],s.invocation_id)
            if kind=='roles':
                self.assertNotRegex(raw.decode(),r'(?i)PASSWORD\s+\S+')
            else:
                from maintenance_transport import IMAGE_ID
                self.assertTrue(raw.startswith(b'PGDMP'))
                _docker(['run','--rm','-i','--pull=never','--network','none','--entrypoint','pg_restore',IMAGE_ID,'--list'],raw)
            self.assertEqual(Path(record['path']).stat().st_mode&0o777,0o600)
            s._rollback()

    def test_TLS_D4_24_full_dump(self):self.real('full')
    def test_TLS_D4_25_schema_dump(self):self.real('schema')
    def test_TLS_D4_26_roles_dump(self):self.real('roles')

    def test_TLS_D4_27_each_tool_tls_negative(self):
        def ssl(value):
            _docker(['exec','-i',self.o.name,'psql','-h','/tmp/tls','-U','postgres','-Xq','-v','ON_ERROR_STOP=1',
                     '-c','ALTER SYSTEM SET ssl='+value,'-c','SELECT pg_reload_conf()'])
            time.sleep(.15)
        with self.t._session(True) as s:
            snapshot=self.snapshot(s)
            for kind in ['full','schema','roles']:
                for failure in ['wrong-ca','wrong-hostname','non-tls']:
                    with self.subTest(tool=kind,failure=failure):
                        self.o.ca='/tmp/tls/wrong.crt' if failure=='wrong-ca' else '/tmp/tls/ca.crt'
                        self.o.host='127.0.0.1' if failure=='wrong-hostname' else 'localhost'
                        if failure=='non-tls':ssl('off')
                        try:
                            tool,args=self.args(kind,snapshot)
                            with self.assertRaises(Failure) as caught:self.t._tool(tool,args)
                            self.assertEqual(caught.exception.code,'BACKUP_CLIENT_TLS_PROOF_MISSING')
                            self.assertEqual(self.t._pending_tool_proofs,{})
                        finally:
                            if failure=='non-tls':ssl('on')
            s._rollback()

    def test_TLS_D4_29_replay(self):
        with self.t._session(True) as s:
            snap=self.snapshot(s);tool,args=self.args('full',snap)
            raw=self.t._tool(tool,args);record=self.t._take_tool_proof(tool,raw)
            for wrong_tool,wrong_raw in [(tool,raw),('pg_dumpall',raw),(tool,raw+b'bad')]:
                with self.assertRaises(Failure):self.t._take_tool_proof(wrong_tool,wrong_raw)
            again=self.t._tool(tool,args);new=self.t._take_tool_proof(tool,again)
            self.assertNotEqual(record['proof']['invocationId'],new['proof']['invocationId'])
            s._rollback()

    def test_TLS_D4_30_exit_output(self):
        import subprocess
        from types import SimpleNamespace
        with self.t._session(True) as s:
            tool,args=self.args('full',self.snapshot(s))
            for result in [SimpleNamespace(returncode=1,stdout=b'PGDMP'),SimpleNamespace(returncode=0,stdout=b'bad')]:
                with patch.object(self.o.cluster.transport,'_inspect'),patch('maintenance_transport.subprocess.run',return_value=result):
                    with self.assertRaises(Failure):self.t._tool(tool,args)
                self.assertEqual(self.t._pending_tool_proofs,{})
            with patch.object(self.o.cluster.transport,'_inspect'),patch('maintenance_transport.subprocess.run',side_effect=subprocess.TimeoutExpired('owned',1)):
                with self.assertRaises(Failure):self.t._tool(tool,args)
            self.assertEqual(self.t._pending_tool_proofs,{})
            s._rollback()

    def test_TLS_D4_31_manifest(self):
        from backup_adapter import _validate_proofs
        started=time.time();records={};outputs={}
        with self.t._session(True) as s:
            snap=self.snapshot(s);records['exporter']=s._transport_proof
            for kind in ['full','schema','roles']:
                tool,args=self.args(kind,snap);raw=self.t._tool(tool,args)
                records[kind]=self.t._take_tool_proof(tool,raw);outputs[kind]=sha(raw)
            s._rollback()
        with self.t._session(True) as s:
            records['afterObservation']=s._transport_proof;s._rollback()
        bundle={'contract':'backup-transport-proofs/1','backupAttempt':self.t._backup_attempt,'snapshot':snap,
                'records':{k:{'proof':v['proof'],'sha256':v['sha256']} for k,v in records.items()}}
        ended=time.time()
        with patch('backup_adapter.risk_guard'):
            _validate_proofs(bundle,self.t._plan,self.t._auth,self.t,started,ended,outputs)
            mutations=[lambda b:b['records'].pop('roles'),
                       lambda b:b['records'].update(full=copy.deepcopy(b['records']['exporter'])),
                       lambda b:b.update(backupAttempt='0'*32),
                       lambda b:b['records']['full']['proof'].update(outputSha256='0'*64),
                       lambda b:b['records']['schema']['proof'].update(invocationId=b['records']['full']['proof']['invocationId']),
                       lambda b:b['records']['roles']['proof'].update(packageHashes={}),
                       lambda b:b['records']['full']['proof'].update(riskAcceptance=None),
                       lambda b:b['records']['full']['proof'].update(targetProfile='other'),
                       lambda b:b['records']['full']['proof'].update(startedAt=started-1000)]
            for mutate in mutations:
                bad=copy.deepcopy(bundle);mutate(bad)
                # Even when the tampered record's hash is recomputed, semantic
                # binding/replay checks must reject it.
                for r in bad['records'].values():r['sha256']=sha(canonical(r['proof'])+b'\n')
                with self.assertRaises(Failure):_validate_proofs(bad,self.t._plan,self.t._auth,self.t,started,ended,outputs)
        with fixture.Fixture() as f:
            p,a=f.plan();directory=f.backup(p,a);m=validate_backup(p,a,f.transport)
            self.assertEqual(m['reportVersion'],'exact-single-backup/3')
            self.assertEqual(m['recoveryReportContract'],'exact-single-owned-restore/3')
            self.assertEqual(len(m['files']),9)
            self.assertEqual(m['sourceBootstrapProvenance']['path'],'metadata/bootstrap-provenance.json')
            self.assertIn('metadata/transport-proofs.json',m['files']);self.assertEqual(m['restoreStatus'],'PASS')
            bundle=json.loads((directory/'metadata/transport-proofs.json').read_text())
            self.assertEqual(len({r['proof']['invocationId'] for r in bundle['records'].values()}),5)



class BackupDiagnostics(unittest.TestCase):
    """Synthetic fault injection; no real client or credential in this class."""
    def setUp(self):
        import maintenance_transport as mt
        import backup_adapter as ba
        from types import SimpleNamespace
        self.mt,self.ba,self.N = mt,ba,SimpleNamespace
        self.tmp=tempfile.TemporaryDirectory(prefix='owned-backup-diagnostics-')
        self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name)
        self.p=SimpleNamespace(fixture=True,digest='a'*64,data={'planId':'owned-diag',
            'targetProfile':'OWNED_ISOLATED_FIXTURE','ledger':{'sourcePrefixSha256':'f'*64}})
        from plan_contract import package_hashes
        self.a={'packageHashes':package_hashes(),'targetIdentity':{'fixture':True,'database':'postgres',
            'role':'fixture_bootstrap','currentRole':'fixture_bootstrap','serverMajor':17,
            'targetProfile':'OWNED_ISOLATED_FIXTURE','imageId':mt.IMAGE_ID,
            'projectIdentitySha256':None,'hostIdentitySha256':None,'sslmode':None}}
        self.calls=[]
        self.expected={'relations':[],'namespaces':[], 'ledger':[{'version':'000000000001'}],
                       'prefix':'f'*64,'ledgerText':[], 'ledgerDescriptor':{}}
        self.counts={}
        self.facts=RecoveryV1Facts(expected=self.expected,auth=self.a,plan=self.p)
        self.expected=self.facts.expected

    def recorder(self):
        import uuid
        return self.mt._LocalBackupDiagnostics(self.root/'diagnostics',uuid.uuid4().hex,self.p,self.a)

    def records(self,d,kind='docker-end'):
        return [json.loads(p.read_bytes()) for p in sorted(d.root.glob('*.'+kind+'.json'))]

    def terminal(self,d):return json.loads((d.root/'terminal.json').read_bytes())

    def simulated_run(self,fault=None,cleanup=False):
        def run(args,**kw):
            d=self.mt._LOCAL_DIAGNOSTIC.get();phase=d.phase if d else None
            op=(self.mt._LOCAL_OPERATION.get() or (None,None))[0]
            self.calls.append((phase,op,list(args),dict(kw)))
            failed = (fault is not None and (phase,op)==fault) or (cleanup and op=='OWNED_STOP')
            if failed:return self.N(returncode=125,stdout=b'owned-output',stderr=b'OCI runtime failed')
            out=b''
            if args[1]=='inspect':
                out=canonical([{'Image':self.mt.IMAGE_ID,'HostConfig':{'NetworkMode':'none','Binds':None,'PortBindings':{}},
                               'Mounts':[],'Config':{'Labels':{'uply.task':'runner-i1'}}}])
            return self.N(returncode=0,stdout=out,stderr=b'')
        return run

    def local_simulation(self,fault=None,cleanup=False,supplement=False,mismatch=False,capture=False):
        import contextlib
        outer=self;d=None
        first=copy.deepcopy(self.expected)
        if supplement:
            self.expected['namespaces']=[['synthetic','postgres',['postgres=UC/postgres']]]
            first=copy.deepcopy(self.expected);first['namespaces'][0][2]=None
        observed=[first,copy.deepcopy(self.expected)]
        if mismatch:observed[-1]['unexpected']='owned'
        outer.facts=RecoveryV1Facts(expected=outer.expected,auth=outer.a,plan=outer.p)
        class Session:
            def __init__(self,key='exporter'):self._transport_proof=outer.facts.proofs[key]
            def _exchange(self,sql):
                f=outer.facts
                if sql==outer.ba.BOOTSTRAP_SQL:value=f.response()
                elif sql==outer.ba.PLPGSQL_SQL:value=f.ext
                elif sql==outer.ba.DATABASE_ACL_SQL:value=f.database
                elif sql==outer.ba.UNSUPPORTED_ROLE_FAMILIES_SQL:value=f.extras
                elif sql==outer.ba.EXTENSION_SQL:value=f.extension_state
                elif sql==outer.ba.SOURCE_COUNTERPART_SQL:value=f.extension_guard
                else:raise AssertionError('unexpected source query')
                return canonical(value).decode()
            def _rollback(self):outer.calls.append(('ROLLBACK',None,[],{}))
            def _json(self,sql):return '00000001-00000001-1'
        @contextlib.contextmanager
        def owned_session(transport,readonly=True):
            transport._inspect()
            yield Session()
        class Source:
            fixture=True
            sessions=0
            identity=outer.a['targetIdentity']
            @contextlib.contextmanager
            def _session(self,readonly=True):
                outer.calls.append(('SOURCE_SESSION',readonly,[],{}))
                self.sessions+=1
                key='exporter' if self.sessions==1 else 'afterObservation'
                # Capture attempt is assigned by the real adapter before the session.
                for rec in (outer.facts.proofs.values() if self.sessions==1 else [outer.facts.proofs[key]]):
                    rec['proof']['backupAttempt']=self._backup_attempt
                    rec['proof']['startedAt']=time.time();rec['proof']['completedAt']=time.time()
                    rec['sha256']=sha(canonical(rec['proof'])+b'\n')
                yield Session(key)
            def _tool(self,tool,args):
                outer.calls.append(('SOURCE_TOOL',tool,list(args),{}))
                key='roles' if tool=='pg_dumpall' else ('schema' if '--schema-only' in args else 'full')
                raw={'full':outer.facts.full,'schema':outer.facts.schema,'roles':outer.facts.roles}[key]
                rec=outer.facts.proofs[key];rec['proof'].update(startedAt=time.time(),completedAt=time.time(),snapshot=None if key=='roles' else outer.facts.snapshot,outputSha256=sha(raw),inputSha256=sha(canonical([tool,args])))
                rec['sha256']=sha(canonical(rec['proof'])+b'\n');self.last=rec
                return raw
            def _take_tool_proof(self,*args):return self.last
        def observe(session):
            if outer.mt._LOCAL_DIAGNOSTIC.get() is None:return copy.deepcopy(outer.expected)
            return observed.pop(0)
        def destination_json(t,sql,kind,*,bootstrap_user=None):
            t._sql(sql.encode(),kind,bootstrap_user=bootstrap_user)
            f=outer.facts
            if sql==outer.ba.BOOTSTRAP_SQL:return f.response(bootstrap_user or outer.mt.OWNED_RESTORE_ADMIN)
            if sql==outer.ba.ROLE_STATE_SQL:return f.actual_roles()
            if sql==outer.ba.PLPGSQL_SQL:return copy.deepcopy(f.ext)
            if sql in (outer.ba.DATABASE_ACL_SQL,'BEGIN READ ONLY;\n'+outer.ba.DATABASE_ACL_SQL+'\nROLLBACK;\n'):return copy.deepcopy(f.database)
            if sql==outer.ba.FOOTPRINT_SQL:return []
            if sql==outer.ba.UNSUPPORTED_ROLE_FAMILIES_SQL:return copy.deepcopy(f.extras)
            raise AssertionError('unexpected destination query')
        for state in observed:
            state['roles'].append(list(self.mt.OWNED_RESTORE_ADMIN_TUPLE))
        error=None;value=None
        with patch.object(self.mt.subprocess,'run',side_effect=self.simulated_run(fault,cleanup)), \
             patch.object(self.mt.OwnedRestoreDestinationTransport,'_session',owned_session), \
             patch.object(self.mt.OwnedRestoreDestinationTransport,'_json',destination_json), \
             patch.object(self.ba,'observe',side_effect=observe), \
             patch.object(self.ba,'_counts',return_value=self.counts), \
             patch.object(self.ba.time,'sleep') as sleep:
            if capture:
                self.a['catalogBeforeSha256']=self.ba.fingerprint(self.expected)
                with patch.object(self.ba,'authorize'),patch.object(self.ba,'_read_proof',side_effect=lambda record:record['proof']),patch.object(self.ba,'_validate_proofs'):
                    try:value=self.ba.capture_backup(self.p,self.a,Source(),self.root/'backups')
                    except Exception as e:error=e
                roots=list((self.root/'backup-diagnostics').iterdir())
                self.assertEqual(len(roots),1);d=self.N(root=roots[0])
            else:
                d=self.recorder()
                try:
                    with d.active():value=self.ba._restore(b'PGDMPowned',self.facts.roles,self.expected,self.counts,self.facts.provenance,self.facts.bundle)
                except Exception as e:error=e
                d.finish(error)
            sleeps=list(sleep.call_args_list)
        return d,error,value,sleeps

    def assert_fault(self,phase,kind,**kwargs):
        d,e,value,_=self.local_simulation((phase,kind),**kwargs)
        self.assertIsInstance(e,Failure);self.assertIsNone(value)
        terminal=self.terminal(d);self.assertEqual(terminal['status'],'FAILURE')
        self.assertEqual(terminal['primaryFailure']['phase'],phase)
        rows=[r for r in self.records(d) if r['phase']==phase and r['operationKind']==kind]
        self.assertEqual(rows[-1]['returnCode'],125)
        self.assertEqual(rows[-1]['stdoutSha256'],sha(b'owned-output'))
        self.assertEqual(rows[-1]['stderrSha256'],sha(b'OCI runtime failed'))
        return d,e

    def session_process(self,phase='E5',code=0,out=b'owned-output\n',err=b'',primary=None,close_error=None,incomplete=False):
        import io
        from unittest.mock import Mock
        d=self.recorder()
        proc=Mock();proc.stdout=io.BytesIO(out);proc.stderr=io.BytesIO(err);proc.stdin=io.BytesIO()
        proc.poll.return_value=code
        kind='OWNED_FIRST_OBSERVE_PSQL' if phase=='E5' else 'OWNED_FINAL_OBSERVE_COUNTS_PSQL'
        caught=None
        with patch.object(self.mt.subprocess,'Popen',return_value=proc),patch.object(self.mt._Session,'_exchange',side_effect=primary):
            try:
                with d.active(),self.mt._diagnostic_phase(phase),self.mt._diagnostic_operation(kind,'uply-runner-i1-'+'c'*32):
                    if primary is not None and close_error is not None:
                        with patch.object(self.mt._Session,'_close_process',side_effect=close_error):self.mt._Session(['docker','exec'],True)
                    else:
                        session=self.mt._Session(['docker','exec'],True)
                        for thread in session._threads:thread.join(2)
                        if incomplete:session._stream_complete[0]=False
                        session.close()
            except Exception as e:caught=e
        d.finish(caught)
        return d,caught,proc

    def test_BACKUP_DIAG_01_E1_nonzero(self):
        d,_=self.assert_fault('E1','OWNED_CLUSTER_RUN')
        self.assertFalse(any(x[1]=='OWNED_PG_ISREADY' for x in self.calls))
        self.assertEqual(self.terminal(d)['phases']['E2'],'NOT_STARTED')

    def test_BACKUP_DIAG_02_E2_readiness(self):
        d,e,_,sleeps=self.local_simulation(('E2','OWNED_PG_ISREADY'))
        self.assertEqual(e.code,'OWNED_DB_START')
        self.assertEqual(len([x for x in self.calls if x[1]=='OWNED_PG_ISREADY']),100)
        self.assertEqual([c.args for c in sleeps],[(0.1,)]*100)
        self.assertEqual(self.terminal(d)['primaryFailure']['code'],'OWNED_DB_START')

    def test_BACKUP_DIAG_03_E3_roles(self):
        d,_=self.assert_fault('E3','OWNED_ROLES_SQL')
        self.assertFalse(any(x[1]=='OWNED_PG_RESTORE' for x in self.calls))
        self.assertEqual(self.terminal(d)['cleanupStatus'],'PASS')

    def test_BACKUP_DIAG_04_E4_restore(self):
        d,_=self.assert_fault('E4','OWNED_PG_RESTORE',capture=True)
        self.assertEqual(self.terminal(d)['phases']['E5'],'NOT_STARTED')
        self.assertFalse(list((self.root/'backups').rglob('manifest.json')))
        self.assertEqual(json.loads(next((self.root/'backups').rglob('FAILED.json')).read_bytes())['status'],'INVALID')

    def test_BACKUP_DIAG_05_E5_inspect(self):self.assert_fault('E5','OWNED_INSPECT')

    def test_BACKUP_DIAG_06_E5_session(self):
        primary=Failure('UNKNOWN_COMMIT','SESSION_LOST')
        d,e,_=self.session_process(code=125,err=b'broken pipe',primary=primary)
        self.assertIs(e,primary)
        row=self.records(d)[0];self.assertEqual(row['operationKind'],'OWNED_FIRST_OBSERVE_PSQL')
        self.assertEqual(row['returnCode'],125);self.assertEqual(row['sanitizedErrorClass'],'BROKEN_PIPE')

    def test_BACKUP_DIAG_07_E6_supplement(self):self.assert_fault('E6','OWNED_SUPPLEMENT_SQL',supplement=True)

    def test_BACKUP_DIAG_08_E7_session(self):
        d,e,_=self.session_process('E7',code=137,primary=Failure('UNKNOWN_COMMIT','SESSION_LOST'))
        self.assertEqual(e.code,'SESSION_LOST');self.assertEqual(self.records(d)[0]['phase'],'E7')
        self.assertEqual(self.records(d)[0]['returnCode'],137)

    def test_BACKUP_DIAG_09_E8_compare(self):
        d,e,_,_=self.local_simulation(mismatch=True)
        self.assertEqual(e.code,'RESTORE_CATALOG_OR_COUNTS_MISMATCH')
        self.assertEqual(self.terminal(d)['primaryFailure']['phase'],'E8')
        self.assertFalse(any(r['phase']=='E8' for r in self.records(d)))

    def test_BACKUP_DIAG_10_E9_stop(self):
        d,_=self.assert_fault('E9','OWNED_STOP')
        self.assertEqual(len([x for x in self.calls if x[1]=='OWNED_STOP']),1)
        self.assertEqual(self.terminal(d)['cleanupStatus'],'FAIL')

    def test_BACKUP_DIAG_11_body_and_cleanup(self):
        d,e,_,_=self.local_simulation(('E3','OWNED_ROLES_SQL'),cleanup=True)
        t=self.terminal(d);self.assertEqual(t['primaryFailure']['phase'],'E3')
        self.assertEqual([x['phase'] for x in t['cleanupSecondaryFailures']],['E9'])
        self.assertEqual(t['cleanupStatus'],'FAIL');self.assertEqual(e.code,'DOCKER_OPERATION_FAILED')
        self.assertIs(d.descriptors[id(e)][0],e)

    def test_BACKUP_DIAG_12_constructor_and_cleanup(self):
        d,e,_,_=self.local_simulation(('E2','OWNED_PG_ISREADY'),cleanup=True)
        self.assertEqual(e.code,'OWNED_DB_START');t=self.terminal(d)
        self.assertEqual(t['primaryFailure']['code'],'OWNED_DB_START')
        self.assertEqual(t['cleanupSecondaryFailures'][0]['code'],'DOCKER_OPERATION_FAILED')

    def test_BACKUP_DIAG_13_cleanup_only(self):
        d,e,_,_=self.local_simulation(cleanup=True,capture=True)
        self.assertEqual(e.code,'DOCKER_OPERATION_FAILED');self.assertEqual(self.terminal(d)['primaryFailure']['phase'],'E9')
        self.assertFalse(list((self.root/'backups').rglob('manifest.json')))

    def test_BACKUP_DIAG_14_stream_hashes(self):
        out,err=b'owned output\n',b'owned message\n'
        d,e,_=self.session_process(out=out,err=err)
        self.assertIsNone(e);r=self.records(d)[0]
        self.assertEqual((r['stdoutSha256'],r['stderrSha256']),(sha(out),sha(err)))
        self.assertTrue(r['stdoutComplete'] and r['stderrComplete'])
        d=self.recorder()
        with d.active(),self.mt._diagnostic_phase('C'),self.mt._diagnostic_operation('ARCHIVE_FULL_TOC_LIST'),patch.object(self.mt.subprocess,'run',return_value=self.N(returncode=0,stdout=out,stderr=err)):
            self.mt._docker(['synthetic'])
        r=self.records(d)[0];self.assertEqual((r['stdoutSha256'],r['stderrSha256']),(sha(out),sha(err)))

    def test_BACKUP_DIAG_15_returncode(self):
        for rc in [1,125,137,-9]:
            d=self.recorder()
            with self.assertRaises(Failure),d.active(),self.mt._diagnostic_phase('E1'),self.mt._diagnostic_operation('OWNED_CLUSTER_RUN'),patch.object(self.mt.subprocess,'run',return_value=self.N(returncode=rc,stdout=b'',stderr=b'')):
                self.mt._docker(['synthetic'])
            self.assertEqual(self.records(d)[0]['returnCode'],rc)

    def test_BACKUP_DIAG_16_operation_allowlist(self):
        expected={'OWNED_DATABASE_ACL_STATE','OWNED_DATABASE_ACL_SQL','ARCHIVE_FULL_TOC_LIST','ARCHIVE_SCHEMA_TOC_LIST','OWNED_CLUSTER_RUN','OWNED_PG_ISREADY','OWNED_ROLES_SQL','OWNED_PG_RESTORE','OWNED_INSPECT','OWNED_FIRST_OBSERVE_PSQL','OWNED_SUPPLEMENT_SQL','OWNED_FINAL_OBSERVE_COUNTS_PSQL','OWNED_STOP','OWNED_REMOVAL_CHECK','OWNED_BOOTSTRAP_IDENTITY','OWNED_RESTORE_ADMIN_CREATE','OWNED_RESTORE_ADMIN_IDENTITY','OWNED_ROLE_STATE','OWNED_STAGED_PLPGSQL_SQL','OWNED_STAGED_PLPGSQL_STATE','OWNED_FOOTPRINT'}
        self.assertEqual(set.union(*self.mt._DIAGNOSTIC_PHASES.values()),expected)
        d=self.recorder()
        with patch.object(self.mt.subprocess,'run') as call:
            with self.assertRaises(Failure),d.active(),self.mt._diagnostic_phase('E1'),self.mt._diagnostic_operation('UNREVIEWED'):
                self.mt._docker([])
            with self.assertRaises(Failure),d.active(),self.mt._diagnostic_phase('UNKNOWN'):pass
            call.assert_not_called()

    def test_BACKUP_DIAG_17_stderr_privacy(self):
        secret=os.urandom(24).hex().encode();d=self.recorder()
        with self.assertRaises(Failure),d.active(),self.mt._diagnostic_phase('C'),self.mt._diagnostic_operation('ARCHIVE_FULL_TOC_LIST'),patch.object(self.mt.subprocess,'run',return_value=self.N(returncode=1,stdout=secret,stderr=secret)):
            self.mt._docker(['synthetic'],secret)
        data=b''.join(p.read_bytes() for p in d.root.iterdir())
        self.assertNotIn(secret,data);self.assertIn(sha(secret).encode(),data)

    def test_BACKUP_DIAG_18_secret_classifier(self):
        secret=os.urandom(24).hex().encode()
        payload=b'password='+secret+b' postgresql://'+secret+b' JWT token env roles.sql dump '+secret
        d,e,_=self.session_process(err=payload,code=1)
        self.assertIsInstance(e,Failure)
        raw=b''.join(p.read_bytes() for p in d.root.iterdir());self.assertNotIn(secret,raw)
        self.assertEqual(self.records(d)[0]['sanitizedErrorClass'],'PROCESS_EXIT_NONZERO')
        for text,kind in [(b'permission denied','PERMISSION_DENIED'),(b'OCI runtime','OCI_RUNTIME_FAILURE'),(b'closed fifo','BROKEN_PIPE'),(b'no such container','CONTAINER_NOT_FOUND'),(b'no such image','IMAGE_NOT_FOUND'),(b'no space left','RESOURCE_FAILURE')]:
            self.assertEqual(self.mt._error_class(text,1),kind)
        self.assertEqual(self.mt._error_class(b'x'*4096+b'broken pipe',1),'PROCESS_EXIT_NONZERO')

    def test_BACKUP_DIAG_19_success_order(self):
        d,e,_,_=self.local_simulation(capture=True)
        self.assertIsNone(e)
        tools=[x for x in self.calls if x[0]=='SOURCE_TOOL']
        self.assertEqual([(x[1],x[2]) for x in tools],[('pg_dump',['-d','postgres','-Fc','--snapshot=00000001-00000001-1']),('pg_dump',['-d','postgres','-Fc','--schema-only','--snapshot=00000001-00000001-1']),('pg_dumpall',['--roles-only','--no-role-passwords'])])
        ops=[x[1] for x in self.calls if x[1] in ['ARCHIVE_FULL_TOC_LIST','ARCHIVE_SCHEMA_TOC_LIST','OWNED_CLUSTER_RUN','OWNED_ROLES_SQL','OWNED_PG_RESTORE','OWNED_STOP']]
        self.assertEqual(ops,['ARCHIVE_FULL_TOC_LIST','ARCHIVE_SCHEMA_TOC_LIST','OWNED_CLUSTER_RUN','OWNED_ROLES_SQL','OWNED_PG_RESTORE','OWNED_STOP'])
        self.assertEqual([x[3]['timeout'] for x in self.calls if x[1]=='OWNED_PG_RESTORE'],[300])
        self.assertEqual(len([x for x in self.calls if x[0]=='ROLLBACK']),4)
        self.assertEqual(len([x for x in self.calls if x[0]=='SOURCE_SESSION']),2)
        ordered=[x[1] for x in self.calls]
        role_index=ordered.index('OWNED_ROLES_SQL');restore_index=ordered.index('OWNED_PG_RESTORE')
        self.assertLess(ordered.index('OWNED_BOOTSTRAP_IDENTITY'),ordered.index('OWNED_RESTORE_ADMIN_CREATE'))
        self.assertLess(ordered.index('OWNED_RESTORE_ADMIN_CREATE'),ordered.index('OWNED_RESTORE_ADMIN_IDENTITY'))
        self.assertLess(ordered.index('OWNED_RESTORE_ADMIN_IDENTITY'),role_index)
        between=self.calls[role_index+1:restore_index]
        stage_sql=[x[3]['input'] for x in between if x[1]=='OWNED_STAGED_PLPGSQL_SQL']
        self.assertEqual(stage_sql,[b'ALTER ROLE "postgres" SUPERUSER;',b'DROP EXTENSION plpgsql RESTRICT;',
            b'SET ROLE "postgres"; CREATE EXTENSION plpgsql WITH SCHEMA pg_catalog VERSION \'1.0\'; RESET ROLE;',
            b'ALTER ROLE "postgres" NOSUPERUSER;'])
        semantic=[x[1] for x in between if x[1] in ('OWNED_ROLE_STATE','OWNED_STAGED_PLPGSQL_SQL')]
        self.assertEqual(semantic,['OWNED_ROLE_STATE']+['OWNED_STAGED_PLPGSQL_SQL']*4+['OWNED_ROLE_STATE'])

    def test_BACKUP_DIAG_20_manifest_unchanged(self):
        d,e,path,_=self.local_simulation(capture=True);self.assertIsNone(e)
        m=json.loads((path/'metadata/manifest.json').read_bytes())
        self.assertEqual(m['reportVersion'],'exact-single-backup/3');self.assertEqual(m['restoreStatus'],'PASS')
        self.assertEqual(set(m['files']),{'database.dump','schema.dump','roles.sql','metadata/catalog.json','metadata/counts.json','metadata/migration-ledger.json','metadata/restore.json','metadata/transport-proofs.json','metadata/bootstrap-provenance.json'})
        self.assertNotIn(path,d.root.parents);self.assertNotIn('diagnostic',(path/'SHA256SUMS').read_text())
        self.assertEqual(self.terminal(d)['status'],'LOCAL_PHASES_COMPLETED')

    def test_BACKUP_DIAG_21_receipt_safety(self):
        import stat
        d=self.recorder()
        with patch('receipts.os.fsync',wraps=os.fsync) as sync:
            d.event('phase-start',{'contract':'backup-local-phase/1'})
        self.assertGreaterEqual(sync.call_count,2)
        for p in d.root.iterdir():
            st=p.lstat();self.assertTrue(stat.S_ISREG(st.st_mode));self.assertEqual(st.st_nlink,1)
            self.assertEqual(st.st_uid,os.getuid());self.assertEqual(st.st_mode&0o777,0o600);safe_file(p,True)
        self.assertEqual(d.root.stat().st_mode&0o777,0o700)
        unsafe=self.root/'unsafe';unsafe.symlink_to(self.root/'diagnostics')
        with self.assertRaises(self.mt._DiagnosticPersistenceError):self.mt._LocalBackupDiagnostics(unsafe,'1'*32,self.p,self.a)

    def test_BACKUP_DIAG_22_collision(self):
        d=self.recorder();original=(d.root/'attempt.json').read_bytes()
        with self.assertRaises(self.mt._DiagnosticPersistenceError):self.mt._LocalBackupDiagnostics(d.root.parent,d.attempt,self.p,self.a)
        self.assertEqual((d.root/'attempt.json').read_bytes(),original)
        (d.root/'000001.phase-start.json').write_bytes(b'unchanged')
        with self.assertRaises(self.mt._DiagnosticPersistenceError):d.event('phase-start',{})
        self.assertEqual((d.root/'000001.phase-start.json').read_bytes(),b'unchanged')

    def test_BACKUP_DIAG_23_persistence_failure(self):
        for target in ['exclusive','safe_file']:
            d=self.recorder()
            with patch.object(self.mt,target,side_effect=OSError('synthetic')) as broken:
                with self.assertRaises(self.mt._DiagnosticPersistenceError):d.event('phase-start',{})
                with self.assertRaises(self.mt._DiagnosticPersistenceError):d.finish()
                self.assertEqual(broken.call_count,1)
            self.assertTrue(d.failed_storage);self.assertFalse((d.root/'terminal.json').exists())
        d=self.recorder()
        with patch('receipts.os.fsync',side_effect=OSError('synthetic')):
            with self.assertRaises(self.mt._DiagnosticPersistenceError):d.event('phase-start',{})
        self.assertTrue(d.failed_storage)
        # A failed end receipt must not turn a readiness failure into another probe.
        d=self.recorder();original=self.mt.exclusive
        def end_failure(path,value,*args,**kwargs):
            if str(path).endswith('.docker-end.json'):raise OSError('synthetic')
            return original(path,value,*args,**kwargs)
        with patch.object(self.mt,'exclusive',side_effect=end_failure),patch.object(self.mt.subprocess,'run',return_value=self.N(returncode=1,stdout=b'',stderr=b'')) as run:
            with self.assertRaises(self.mt._DiagnosticPersistenceError) as caught,d.active(),self.mt._diagnostic_phase('E2'),self.mt._diagnostic_operation('OWNED_PG_ISREADY'):
                self.mt._docker([])
            self.assertEqual(run.call_count,1)
        self.assertEqual(caught.exception.primary.code,'DOCKER_OPERATION_FAILED')

    def test_BACKUP_DIAG_24_timeout(self):
        import subprocess
        d=self.recorder();error=subprocess.TimeoutExpired('unsafe-not-persisted',17,output=b'partial',stderr=b'partial-error')
        with self.assertRaises(subprocess.TimeoutExpired) as caught,d.active(),self.mt._diagnostic_phase('E4'),self.mt._diagnostic_operation('OWNED_PG_RESTORE'),patch.object(self.mt.subprocess,'run',side_effect=error) as call:
            self.mt._docker([],timeout=17)
        self.assertIs(caught.exception,error);self.assertEqual(call.call_args.kwargs['timeout'],17)
        r=self.records(d)[0];self.assertTrue(r['timeout']);self.assertIsNone(r['returnCode'])
        self.assertEqual(r['stdoutSha256'],sha(b'partial'));self.assertFalse(r['stdoutComplete'])
        self.assertEqual(r['sanitizedErrorClass'],'TIMEOUT')
        d=self.recorder()
        with self.assertRaises(OSError),d.active(),self.mt._diagnostic_phase('E1'),self.mt._diagnostic_operation('OWNED_CLUSTER_RUN'),patch.object(self.mt.subprocess,'run',side_effect=OSError('private')):self.mt._docker([])
        r=self.records(d)[0];self.assertIsNone(r['stdoutSha256']);self.assertEqual(r['sanitizedErrorClass'],'OS_SPAWN_FAILURE')

    def test_BACKUP_DIAG_25_session_double_failure(self):
        primary=Failure('UNKNOWN_COMMIT','SESSION_LOST');secondary=Failure('VERIFY_FAILED','DOCKER_OPERATION_FAILED')
        d,e,_=self.session_process(primary=primary,close_error=secondary)
        self.assertIs(e,primary);t=self.terminal(d)
        self.assertEqual(t['primaryFailure']['code'],'SESSION_LOST')
        self.assertEqual(t['cleanupSecondaryFailures'][0]['code'],'DOCKER_OPERATION_FAILED')
        d=self.recorder()
        with d.active():
            self.mt._close_preserving(lambda:(_ for _ in ()).throw(secondary),primary)
            third=Failure('BACKUP_FAILED','CLEANUP_FAILED')
            self.mt._close_preserving(lambda:(_ for _ in ()).throw(third),primary)
        d.finish(primary);self.assertEqual([x['code'] for x in self.terminal(d)['cleanupSecondaryFailures']],['DOCKER_OPERATION_FAILED','CLEANUP_FAILED'])

    def test_BACKUP_DIAG_26_inactive_context(self):
        with patch.object(self.mt.subprocess,'run',return_value=self.N(returncode=0,stdout=b'ok')) as run:
            self.assertEqual(self.mt._docker(['inspect','owned'],timeout=23),b'ok')
            self.assertEqual(run.call_args.kwargs['timeout'],23)
        with patch.object(self.mt.subprocess,'run',return_value=self.N(returncode=1,stdout=b'')):
            with self.assertRaises(Failure) as caught:self.mt._docker([])
        self.assertEqual(caught.exception.code,'DOCKER_OPERATION_FAILED');self.assertEqual(list(self.root.iterdir()),[])

    def test_BACKUP_DIAG_27_network_no_credentials(self):
        _,e,_,_=self.local_simulation();self.assertIsNone(e)
        run=next(x[2] for x in self.calls if x[1]=='OWNED_CLUSTER_RUN')
        self.assertEqual(run[run.index('--network')+1],'none');self.assertNotIn('-p',run);self.assertNotIn('-v',run)
        self.assertEqual(run[run.index('--user')+1],'100:101')
        self.assertEqual(run[run.index('--tmpfs')+1],'/tmp:rw,size=2048m,mode=1777')
        self.assertIn(self.mt.IMAGE_ID,run);self.assertIn('--read-only',run)
        self.assertEqual(run[-4],"initdb -D /tmp/pg -A trust --no-locale -U \"$1\" -E \"$2\" >/tmp/init.log && exec postgres -D /tmp/pg -k /tmp -c listen_addresses='' -c max_connections=30")
        self.assertEqual(run[-3:],['owned-restore-init',self.facts.bootstrap,'UTF8'])
        self.assertTrue(all('PGPASSWORD' not in x[3].get('env',{}) for x in self.calls))

    def test_BACKUP_DIAG_28_no_retry(self):
        for phase,kind in [('E1','OWNED_CLUSTER_RUN'),('E3','OWNED_ROLES_SQL'),('E4','OWNED_PG_RESTORE'),('E5','OWNED_INSPECT'),('E6','OWNED_SUPPLEMENT_SQL'),('E7','OWNED_INSPECT'),('E9','OWNED_STOP')]:
            self.calls=[]
            self.local_simulation((phase,kind),supplement=phase=='E6')
            self.assertEqual(len([x for x in self.calls if x[:2]==(phase,kind)]),1)
            self.assertLessEqual(len([x for x in self.calls if x[1]=='OWNED_CLUSTER_RUN']),1)

    def test_BACKUP_DIAG_29_context_isolation(self):
        self.local_simulation(('E3','OWNED_ROLES_SQL'))
        self.assertIsNone(self.mt._LOCAL_DIAGNOSTIC.get());self.assertIsNone(self.mt._LOCAL_OPERATION.get())
        self.calls=[];d,e,_,_=self.local_simulation(capture=True);self.assertIsNone(e)
        self.assertEqual(len([x for x in self.calls if x[0]=='SOURCE_SESSION']),2)
        self.assertTrue(all(r['phase'] in ['C','D','E6_DB_ACL']+['E'+str(i) for i in range(1,10)] for r in self.records(d)))

    def test_BACKUP_DIAG_30_phase_durability(self):
        d=self.recorder();d.phase='E1';d.begin('OWNED_CLUSTER_RUN',None)
        self.assertEqual(len(self.records(d,'docker-start')),1);self.assertEqual(self.records(d),[])
        self.assertFalse((d.root/'terminal.json').exists())
        first=next(d.root.glob('*.docker-start.json')).read_bytes()
        self.assertIsNone(json.loads(first)['returnCode']);self.assertIsNone(json.loads(first)['stdoutSha256'])
        self.assertEqual(next(d.root.glob('*.docker-start.json')).read_bytes(),first)

    def test_BACKUP_DIAG_31_toc_full_schema(self):
        for phase,kind in [('C','ARCHIVE_FULL_TOC_LIST'),('D','ARCHIVE_SCHEMA_TOC_LIST')]:
            # Each capture simulation uses an independent synthetic temp backup attempt.
            if (self.root/'backup-diagnostics').exists():
                self.root=self.root/'next';self.root.mkdir(mode=0o700)
            d,_=self.assert_fault(phase,kind,capture=True)
            self.assertEqual(self.terminal(d)['phases']['E1'],'NOT_STARTED')
            self.assertEqual(self.records(d)[-1]['operationKind'],kind)

    def test_BACKUP_DIAG_32_non_failure_exception(self):
        secret=os.urandom(24).hex();error=ValueError(secret);d=self.recorder()
        with self.assertRaises(ValueError) as caught,d.active(),self.mt._diagnostic_phase('E8'):raise error
        d.finish(error);self.assertIs(caught.exception,error)
        self.assertEqual(self.terminal(d)['primaryFailure']['code'],'UNKNOWN_EXCEPTION')
        self.assertNotIn(secret,b''.join(p.read_bytes() for p in d.root.iterdir()).decode())

    def test_BACKUP_DIAG_33_stream_incomplete(self):
        d,e,_=self.session_process(incomplete=True)
        self.assertEqual(e.code,'DIAGNOSTIC_STREAM_INCOMPLETE')
        self.assertFalse(self.records(d)[0]['stdoutComplete'])
        self.assertEqual(self.records(d)[0]['stdoutSha256'],sha(b'owned-output\n'))
        self.assertEqual(self.terminal(d)['status'],'FAILURE')

    def test_BACKUP_DIAG_34_sealed_plan_compatibility(self):
        from plan_contract import load_plan,package_hashes
        p=load_plan('acl-000-v1');p.ensure_ready();raw,body=p.source()
        self.assertEqual(p.digest,'5b1c0d794b28f5f5fa3c85ccc4d3f461d51af95a57a820b9889b16bdf7b369fd')
        self.assertEqual(sha(safe_file(ROOT/'scripts/teaching-agent-r7d-c3b/plan_registry.json')),'70663e781f13cf350e07822bdb304dcf74fa4a61a1adf1e1a0c1cd42956b2610')
        self.assertEqual(len(package_hashes()),10)
        self.assertNotEqual(sha(canonical(package_hashes())),'7e79fa3d6efa468498662ec0187b244abb0061c48d29d310143d49aa2a794f2d')

    def test_BACKUP_DIAG_35_primary_and_evidence_failure(self):
        d=self.recorder();primary=Failure('VERIFY_FAILED','DOCKER_OPERATION_FAILED')
        original=self.mt.exclusive
        def broken(path,value,*args,**kwargs):
            if str(path).endswith('.phase-end.json'):raise OSError('synthetic')
            return original(path,value,*args,**kwargs)
        with patch.object(self.mt,'exclusive',side_effect=broken) as persist:
            with self.assertRaises(Failure) as caught,d.active(),self.mt._diagnostic_phase('E1'):
                raise primary
            count=persist.call_count;d.finish(primary)
            self.assertEqual(persist.call_count,count)
        self.assertIs(caught.exception,primary);self.assertTrue(d.failed_storage)
        self.assertEqual(d.primary['code'],'DOCKER_OPERATION_FAILED')
        self.assertEqual(d.persistence,[{'code':'DIAGNOSTIC_PERSISTENCE_FAILED'}])
        self.assertFalse((d.root/'terminal.json').exists())
        self.assertEqual(len(self.records(d,'phase-start')),1)

    def test_BACKUP_DIAG_36_supplement_not_required(self):
        d,e,_,_=self.local_simulation();self.assertIsNone(e)
        self.assertEqual(self.terminal(d)['phases']['E6'],'NOT_REQUIRED')
        self.assertFalse(any(x[1]=='OWNED_SUPPLEMENT_SQL' for x in self.calls))


# Immutable D7/D8-R3 fixture/oracle design; no research executor imported.
RECOVERY_V1_FIXTURE_SQL = ["CREATE ROLE postgres SUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS;\nDROP EXTENSION plpgsql RESTRICT;\nSET ROLE postgres;\nCREATE EXTENSION plpgsql WITH SCHEMA pg_catalog VERSION '1.0';\nRESET ROLE;\nALTER ROLE postgres NOSUPERUSER;\nCREATE ROLE uply_d8_target NOLOGIN;\nCREATE ROLE uply_d8_member LOGIN CONNECTION LIMIT 7 VALID UNTIL '2035-01-01 00:00:00+00';\nALTER ROLE uply_d8_member SET statement_timeout='3s';\nCREATE ROLE anon NOLOGIN;\nCREATE ROLE authenticated NOLOGIN;\nCREATE ROLE service_role NOLOGIN;\nGRANT uply_d8_target TO postgres WITH ADMIN TRUE, INHERIT FALSE, SET FALSE GRANTED BY uply_d8_source_bootstrap;\nGRANT uply_d8_target TO uply_d8_member WITH ADMIN FALSE, INHERIT TRUE, SET TRUE GRANTED BY postgres;", 'CREATE SCHEMA uply_d8 AUTHORIZATION postgres;\nCREATE SCHEMA uply_d8_owner_only AUTHORIZATION postgres;\nCREATE SCHEMA supabase_migrations AUTHORIZATION postgres;\nCREATE FUNCTION public.review_chapter_practice_binding(uuid,uuid,integer,jsonb,boolean) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$SELECT \'{"synthetic":true}\'::jsonb$$;\nALTER FUNCTION public.review_chapter_practice_binding(uuid,uuid,integer,jsonb,boolean) OWNER TO postgres;', "SET ROLE postgres;\nCREATE TYPE uply_d8.state AS ENUM ('open','closed');\nCREATE DOMAIN uply_d8.nonnegative AS numeric CHECK (VALUE >= 0);\nCREATE SEQUENCE uply_d8.sample_seq;\nSELECT setval('uply_d8.sample_seq',20,true);\nCREATE TABLE uply_d8.samples(id bigint PRIMARY KEY,nullable_text text,amount numeric(12,4) NOT NULL,happened_at timestamptz NOT NULL,label text NOT NULL,active boolean NOT NULL,state uply_d8.state NOT NULL,quota uply_d8.nonnegative NOT NULL DEFAULT 0);\nCREATE INDEX samples_label_idx ON uply_d8.samples(label);\nINSERT INTO uply_d8.samples(id,nullable_text,amount,happened_at,label,active,state) VALUES (1,NULL,12.3400,'2020-01-02 03:04:05+00','alpha',true,'open'),(2,'',-5.2500,'2020-06-01 00:00:00.000001+00','beta',false,'closed'),(3,E'한글 quote \\' and newline\\n',0.0000,'2021-02-03 04:05:06.123456+00','gamma',true,'open');\nCREATE VIEW uply_d8.sample_view AS SELECT id,label,nullable_text FROM uply_d8.samples;\nCREATE MATERIALIZED VIEW uply_d8.sample_materialized AS SELECT id,label,amount FROM uply_d8.samples;\nCREATE FUNCTION uply_d8.render_label(t text) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$BEGIN RETURN CASE WHEN t IS NULL THEN NULL ELSE 'd8:'||t END; END;$$;\nALTER TABLE uply_d8.samples ENABLE ROW LEVEL SECURITY;\nCREATE POLICY sample_read ON uply_d8.samples FOR SELECT TO uply_d8_member USING (active);\nCREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,statements text[],name text);\nINSERT INTO supabase_migrations.schema_migrations VALUES ('202607130000',NULL,'synthetic_null'),('202607130010',ARRAY['SELECT 1;'],'synthetic_array');\nGRANT USAGE ON SCHEMA uply_d8 TO uply_d8_member,anon;\nGRANT SELECT ON uply_d8.samples TO uply_d8_member;\nGRANT SELECT(nullable_text) ON uply_d8.samples TO anon;\nGRANT USAGE ON SEQUENCE uply_d8.sample_seq TO uply_d8_member;\nREVOKE ALL ON FUNCTION uply_d8.render_label(text) FROM PUBLIC;\nGRANT EXECUTE ON FUNCTION uply_d8.render_label(text) TO uply_d8_member;\nREVOKE ALL ON FUNCTION public.review_chapter_practice_binding(uuid,uuid,integer,jsonb,boolean) FROM PUBLIC;\nGRANT EXECUTE ON FUNCTION public.review_chapter_practice_binding(uuid,uuid,integer,jsonb,boolean) TO authenticated,service_role;\nALTER DEFAULT PRIVILEGES IN SCHEMA uply_d8 GRANT SELECT ON TABLES TO uply_d8_member;\nCREATE TABLE uply_d8.default_acl_probe(id integer);\nGRANT ALL ON SCHEMA uply_d8_owner_only TO postgres;\nCREATE TABLE uply_d8_owner_only.owner_probe(id integer);\nGRANT ALL ON TABLE uply_d8_owner_only.owner_probe TO postgres;\nRESET ROLE;"]
RECOVERY_V1_ORACLE_SQL = {'extensions': "SELECT jsonb_build_object(\n 'extensions',(SELECT coalesce(jsonb_agg(jsonb_build_array(e.extname,e.extversion,n.nspname,pg_get_userbyid(e.extowner)) ORDER BY e.extname),'[]') FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace),\n 'plpgsqlLanguage',(SELECT jsonb_build_array(l.lanname,pg_get_userbyid(l.lanowner),l.lanpltrusted,l.lanacl::text,lh.proname,ih.proname,vh.proname) FROM pg_language l LEFT JOIN pg_proc lh ON lh.oid=l.lanplcallfoid LEFT JOIN pg_proc ih ON ih.oid=l.laninline LEFT JOIN pg_proc vh ON vh.oid=l.lanvalidator WHERE l.lanname='plpgsql'),\n 'members',(SELECT coalesce(jsonb_agg(jsonb_build_array(i.type,i.schema,i.name,i.identity,d.objsubid) ORDER BY i.type,i.schema,i.name,i.identity,d.objsubid),'[]') FROM pg_depend d JOIN pg_extension e ON e.oid=d.refobjid CROSS JOIN LATERAL pg_identify_object(d.classid,d.objid,d.objsubid) i WHERE d.refclassid='pg_extension'::regclass AND d.deptype='e' AND e.extname='plpgsql'),\n 'implementation',(SELECT coalesce(jsonb_agg(jsonb_build_array(n.nspname,p.proname,oidvectortypes(p.proargtypes),pg_get_userbyid(p.proowner),p.proacl::text,p.prokind,p.prorettype::regtype::text,p.proretset,p.prosecdef,p.proisstrict,p.provolatile,p.proparallel,p.proleakproof,l.lanname,p.prosrc,p.probin,p.proconfig,p.proargnames,p.proargmodes) ORDER BY n.nspname,p.proname,oidvectortypes(p.proargtypes)),'[]') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang JOIN pg_depend d ON d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.objsubid=0 AND d.deptype='e' AND d.refclassid='pg_extension'::regclass JOIN pg_extension e ON e.oid=d.refobjid WHERE e.extname='plpgsql'));\n", 'databaseAcl': "SELECT jsonb_build_object('name',datname,'owner',pg_get_userbyid(datdba),'aclRaw',datacl::text,\n 'effectiveAcl',(SELECT coalesce(jsonb_agg(jsonb_build_array(pg_get_userbyid(a.grantor),CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,a.privilege_type,a.is_grantable) ORDER BY pg_get_userbyid(a.grantor),CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,a.privilege_type,a.is_grantable),'[]') FROM aclexplode(coalesce(datacl,acldefault('d',datdba))) a)) FROM pg_database WHERE datname=current_database();", 'rawExpandedAcl': 'WITH objects(kind,ident,ownerid,rawacl,defaulttype) AS (\n SELECT \'function\',n.nspname||\'.\'||p.proname||\'(\'||oidvectortypes(p.proargtypes)||\')\',p.proowner,p.proacl,\'f\'::"char" FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname NOT LIKE \'pg_%\' AND n.nspname<>\'information_schema\') OR EXISTS(SELECT 1 FROM pg_depend d JOIN pg_extension e ON e.oid=d.refobjid WHERE d.classid=\'pg_proc\'::regclass AND d.objid=p.oid AND d.deptype=\'e\' AND d.refclassid=\'pg_extension\'::regclass AND e.extname=\'plpgsql\')\n UNION ALL SELECT \'relation\',n.nspname||\'.\'||c.relname,c.relowner,c.relacl,CASE WHEN c.relkind=\'S\' THEN \'S\' ELSE \'r\' END::"char" FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE \'pg_%\' AND n.nspname<>\'information_schema\'\n UNION ALL SELECT \'column\',n.nspname||\'.\'||c.relname||\'.\'||a.attname,c.relowner,a.attacl,\'c\'::"char" FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE a.attnum>0 AND NOT a.attisdropped AND n.nspname NOT LIKE \'pg_%\' AND n.nspname<>\'information_schema\'\n UNION ALL SELECT \'namespace\',nspname,nspowner,nspacl,\'n\'::"char" FROM pg_namespace WHERE nspname NOT LIKE \'pg_%\' AND nspname<>\'information_schema\'\n UNION ALL SELECT \'type\',n.nspname||\'.\'||t.typname,t.typowner,t.typacl,\'T\'::"char" FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname NOT LIKE \'pg_%\' AND n.nspname<>\'information_schema\' AND (t.typtype IN (\'e\',\'d\') OR EXISTS(SELECT 1 FROM pg_class c WHERE c.reltype=t.oid))\n UNION ALL SELECT \'default\',pg_get_userbyid(a.defaclrole)||\':\'||coalesce(n.nspname,\'\')||\':\'||a.defaclobjtype::text,a.defaclrole,a.defaclacl,a.defaclobjtype FROM pg_default_acl a LEFT JOIN pg_namespace n ON n.oid=a.defaclnamespace\n UNION ALL SELECT \'language\',lanname,lanowner,lanacl,\'l\'::"char" FROM pg_language WHERE lanname=\'plpgsql\'\n UNION ALL SELECT \'database\',datname,datdba,datacl,\'d\'::"char" FROM pg_database WHERE datname=current_database())\n SELECT jsonb_build_object(\'raw\',(SELECT coalesce(jsonb_agg(jsonb_build_array(kind,ident,pg_get_userbyid(ownerid),rawacl::text) ORDER BY kind,ident),\'[]\') FROM objects),\n \'expanded\',(SELECT coalesce(jsonb_agg(jsonb_build_array(o.kind,o.ident,pg_get_userbyid(a.grantor),CASE WHEN a.grantee=0 THEN \'PUBLIC\' ELSE pg_get_userbyid(a.grantee) END,a.privilege_type,a.is_grantable) ORDER BY o.kind,o.ident,pg_get_userbyid(a.grantor),CASE WHEN a.grantee=0 THEN \'PUBLIC\' ELSE pg_get_userbyid(a.grantee) END,a.privilege_type,a.is_grantable),\'[]\') FROM objects o CROSS JOIN LATERAL aclexplode(coalesce(o.rawacl,acldefault(o.defaulttype,o.ownerid))) a));', 'effectivePrivileges': "SELECT coalesce(jsonb_agg(jsonb_build_array(r.rolname,\n has_schema_privilege(r.oid,'uply_d8','USAGE'),has_schema_privilege(r.oid,'uply_d8','CREATE'),\n has_table_privilege(r.oid,'uply_d8.samples','SELECT'),has_table_privilege(r.oid,'uply_d8.samples','INSERT'),\n has_column_privilege(r.oid,'uply_d8.samples','nullable_text','SELECT'),\n has_sequence_privilege(r.oid,'uply_d8.sample_seq','USAGE'),\n has_function_privilege(r.oid,'uply_d8.render_label(text)','EXECUTE'),\n has_type_privilege(r.oid,'uply_d8.state','USAGE')) ORDER BY r.rolname),'[]')\n FROM pg_roles r WHERE r.rolname IN ('postgres','uply_d8_member','uply_d8_target','anon','authenticated','service_role','uply_d8_source_bootstrap');", 'objectOwners': "SELECT coalesce(jsonb_agg(jsonb_build_array(n.nspname,c.relname,c.relkind,pg_get_userbyid(c.relowner)) ORDER BY n.nspname,c.relname),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema';", 'rowTypeOwners': "SELECT coalesce(jsonb_agg(jsonb_build_array(n.nspname,t.typname,pg_get_userbyid(t.typowner),t.typtype) ORDER BY n.nspname,t.typname),'[]') FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_class c ON c.reltype=t.oid WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema';", 'objectCounts': "SELECT coalesce(jsonb_agg(jsonb_build_array(n.nspname,c.relkind,x.cnt) ORDER BY n.nspname,c.relkind),'[]') FROM (SELECT relnamespace,relkind,count(*) cnt FROM pg_class GROUP BY relnamespace,relkind) x JOIN pg_namespace n ON n.oid=x.relnamespace CROSS JOIN LATERAL (SELECT x.relkind) c WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema';", 'constantProbe': "SELECT jsonb_build_array(uply_d8.render_label(NULL),uply_d8.render_label('alpha'),uply_d8.render_label('한글 '' quoted'));", 'sequence': 'SELECT jsonb_build_array(last_value::text,is_called) FROM uply_d8.sample_seq;', 'unsupportedFamilies': "SELECT jsonb_build_object(\n 'roleComments',(SELECT coalesce(jsonb_agg(jsonb_build_array(r.rolname,shobj_description(r.oid,'pg_authid')) ORDER BY r.rolname),'[]') FROM pg_roles r WHERE shobj_description(r.oid,'pg_authid') IS NOT NULL),\n 'roleSecurityLabels',(SELECT coalesce(jsonb_agg(jsonb_build_array(r.rolname,s.provider,s.label) ORDER BY r.rolname,s.provider),'[]') FROM pg_shseclabel s JOIN pg_roles r ON s.objoid=r.oid WHERE s.classoid='pg_authid'::regclass),\n 'databaseRoleSettings',(SELECT coalesce(jsonb_agg(jsonb_build_array(d.datname,r.rolname,s.setconfig) ORDER BY d.datname,r.rolname),'[]') FROM pg_db_role_setting s JOIN pg_database d ON d.oid=s.setdatabase LEFT JOIN pg_roles r ON r.oid=s.setrole WHERE s.setdatabase<>0),\n 'parameterAcl',(SELECT coalesce(jsonb_agg(jsonb_build_array(parname,paracl::text) ORDER BY parname),'[]') FROM pg_parameter_acl));", 'tableFedProbe': "SELECT coalesce(jsonb_agg(jsonb_build_array(id::text,uply_d8.render_label(label),uply_d8.render_label(nullable_text)) ORDER BY id),'[]'::jsonb) FROM uply_d8.samples;"}
RECOVERY_V1_DATA_SQL = {'supabase_migrations.schema_migrations': 'SELECT row_to_json(q)::text FROM (SELECT version,statements,name FROM supabase_migrations.schema_migrations) q;', 'uply_d8.default_acl_probe': 'SELECT row_to_json(q)::text FROM (SELECT id::text AS id FROM uply_d8.default_acl_probe) q;', 'uply_d8.sample_materialized': 'SELECT row_to_json(q)::text FROM (SELECT id::text AS id,label,amount::text AS amount FROM uply_d8.sample_materialized) q;', 'uply_d8.sample_view': 'SELECT row_to_json(q)::text FROM (SELECT id::text AS id,label,nullable_text FROM uply_d8.sample_view) q;', 'uply_d8.samples': 'SELECT row_to_json(q)::text FROM\n (SELECT id::text AS id,nullable_text,amount::text AS amount,\n to_char(happened_at AT TIME ZONE \'UTC\',\'YYYY-MM-DD"T"HH24:MI:SS.US"Z"\') AS happened_at,\n label,active,state::text AS state,quota::text AS quota FROM uply_d8.samples) q;', 'uply_d8_owner_only.owner_probe': 'SELECT row_to_json(q)::text FROM (SELECT id::text AS id FROM uply_d8_owner_only.owner_probe) q;'}

class RecoveryV1SourceTransport(OwnedTransport):
    """Test-local source identity; never mutates the shared OwnedTransport class."""
    def __init__(self,container,bootstrap):
        super().__init__(container);self.bootstrap=bootstrap
        self.identity=dict(self.identity,role=bootstrap,currentRole=bootstrap)

    def _session(self,readonly=True):
        import contextlib,maintenance_transport as mt
        @contextlib.contextmanager
        def session():
            self._inspect()
            s=mt._Session(['docker','exec','-i','-e','PGOPTIONS=-c default_transaction_read_only=on',
                self.container,'psql','-h','/tmp','-U',self.bootstrap,'-d','postgres','-XqAt','-v','ON_ERROR_STOP=off'],readonly)
            primary=None
            try:self._check(s);yield s
            except BaseException as error:primary=error;raise
            finally:mt._close_preserving(s.close,primary)
        return session()

    def _tool(self,tool,args,data=None):
        import maintenance_transport as mt,uuid
        self._inspect();kind,snapshot=mt._dump_profile(tool,args,data)
        raw=mt._docker(['exec','-i','-e','PGOPTIONS=-c default_transaction_read_only=on',self.container,tool,
            '-h','/tmp','-U',self.bootstrap,*args],data,300)
        if not mt._valid_dump(kind,raw):raise Failure('BACKUP_FAILED','BACKUP_CLIENT_TLS_PROOF_MISSING')
        self._pending_tool_proofs[(tool,sha(raw))]=self._owned_proof(tool,uuid.uuid4().hex,dumpKind=kind,
            snapshot=snapshot,outputSha256=sha(raw),inputSha256=sha(canonical([tool,args])),exitCode=0)
        return raw


class RecoveryV1IntegrationFixture:
    """D12 fixture. Source construction only; recovery executor is repository code."""
    def __init__(self):
        import uuid,maintenance_transport as mt
        self.tmp=tempfile.TemporaryDirectory(prefix='owned-recovery-v1-integration-');self.root=Path(self.tmp.name)
        self.name='uply-runner-i1-'+uuid.uuid4().hex;self.closed=False;self.bootstrap='uply_d8_source_bootstrap'
        try:
            _docker(['run','--rm','-d','--pull=never','--network','none','--name',self.name,
                '--label','uply.task=runner-i1','--read-only','--tmpfs','/tmp:rw,size=2048m,mode=1777',
                '--user','100:101','--entrypoint','/bin/sh',mt.IMAGE_ID,'-c',
                'initdb -D /tmp/pg -A trust --no-locale -U "$1" -E UTF8 >/tmp/init.log && exec postgres -D /tmp/pg -k /tmp -c listen_addresses=\'\' -c max_connections=30',
                'source-fixture-init',self.bootstrap])
            for _ in range(100):
                try:_docker(['exec',self.name,'pg_isready','-h','/tmp','-U',self.bootstrap,'-d','postgres']);break
                except Failure:time.sleep(.1)
            else:raise Failure('BACKUP_FAILED','OWNED_DB_START')
            self.transport=RecoveryV1SourceTransport(self.name,self.bootstrap)
            for sql in self.fixture_sql():self.sql(sql)
            self.frozen=True
        except BaseException as error:
            mt._close_preserving(self.close,error);raise

    def fixture_sql(self):return RECOVERY_V1_FIXTURE_SQL

    def sql(self,sql):
        if getattr(self,'frozen',False):raise AssertionError('source mutation after freeze')
        return _docker(['exec','-i',self.name,'psql','-Xq','-h','/tmp','-U',self.bootstrap,
            '-d','postgres','-v','ON_ERROR_STOP=1'],sql.encode())

    def state(self):return fixture.Fixture.state(self)
    def plan(self):return fixture.Fixture.plan(self)

    def oracle(self,s,normalize=False):
        import backup_adapter as ba
        from checks import observe
        s._exchange("SET LOCAL TIME ZONE 'UTC'; SET LOCAL DateStyle='ISO, MDY'; SET LOCAL extra_float_digits=3;")
        catalog=self.original_observe(s)
        refs=ba._read_json(s,ba.FOOTPRINT_SQL)
        if normalize:catalog=ba._without_admin(catalog,refs)
        result={'catalog':catalog,'counts':ba._counts(s),'footprint':refs}
        for key,query in RECOVERY_V1_ORACLE_SQL.items():result[key]=ba._read_json(s,query)
        result['data']={}
        for key,query in RECOVERY_V1_DATA_SQL.items():
            rows=sorted(line.encode('utf8') for line in s._exchange(query).splitlines())
            encoded=b''.join(len(row).to_bytes(8,'big')+row for row in rows)
            result['data'][key]={'rowCount':len(rows),'rows':[r.decode('utf8') for r in rows],'sha256':sha(encoded)}
        return result

    def run(self):
        import backup_adapter as ba,maintenance_transport as mt
        from checks import observe
        self.original_observe=observe
        with self.transport._session(True) as s:self.source_oracle=self.oracle(s);s._rollback()
        self.destination_oracle=None;self.initial_destination_roles=None
        original_json=mt.OwnedRestoreDestinationTransport._json
        def destination_query(t,sql,kind,**kw):
            value=original_json(t,sql,kind,**kw)
            if sql==ba.ROLE_STATE_SQL and kind=='OWNED_RESTORE_ADMIN_IDENTITY':self.initial_destination_roles=copy.deepcopy(value)
            return value
        def observing(s):
            value=self.original_observe(s)
            d=mt._LOCAL_DIAGNOSTIC.get()
            if d is not None and d.phase=='E7':self.destination_oracle=self.oracle(s,normalize=True)
            return value
        p,a=self.plan()
        with patch.object(ba,'observe',side_effect=observing),patch.object(mt.OwnedRestoreDestinationTransport,'_json',destination_query):
            directory=fixture.Fixture.backup(self,p,a)
        with self.transport._session(True) as s:after=self.oracle(s);s._rollback()
        if after!=self.source_oracle:raise AssertionError('frozen source changed')
        if self.destination_oracle!=self.source_oracle:raise AssertionError('operational-path full fidelity mismatch')
        ba.validate_backup(p,a,self.transport)
        receipt=json.loads((directory/'metadata/restore.json').read_bytes())
        initial=[r[0] for r in self.initial_destination_roles['roles']]
        raw=(directory/'roles.sql').read_bytes();identity=receipt['sourceBootstrapIdentity']
        derived,_=ba._derive_roles(raw,identity,identity)
        created='postgres' not in initial and b'CREATE ROLE postgres;' in derived and any(r[0]=='postgres' for r in self.destination_oracle['catalog']['roles'])
        return {'fullFidelity':True,'ordinaryPostgresCreatedByReplay':created,'directory':directory,'restore':receipt}

    def close(self):
        try:OwnedCluster.close(self)
        finally:self.tmp.cleanup()
    def __enter__(self):return self
    def __exit__(self,kind,error,traceback):
        import maintenance_transport as mt
        mt._close_preserving(self.close,error)


class RecoveryV1Facts:
    """Synthetic private artifacts for pure validator tests; never production authority."""
    def __init__(self, *, expected=None, auth=None, plan=None, legacy=False, endpoint=None):
        import backup_adapter as ba
        import plan_contract as pc
        import uuid
        from types import SimpleNamespace
        self.ba=ba; self.bootstrap='fixture_bootstrap'
        self.bootstrap_row=[self.bootstrap,True,True,True,True,True,True,True,-1,None,None]
        self.postgres_row=['postgres',False,True,False,False,False,False,False,-1,None,None]
        self.expected=copy.deepcopy(expected or {'roles':[self.bootstrap_row,self.postgres_row],
            'memberships':[],'relations':[],'namespaces':[], 'ledger':[{'version':'000000000001'}],
            'ledgerText':'[{"version":"000000000001"}]','prefix':'f'*64,'ledgerDescriptor':{}})
        if not self.expected.get('roles'):self.expected.update(roles=[self.bootstrap_row,self.postgres_row],memberships=[])
        boots=[r for r in self.expected['roles'] if r[1]]
        self.bootstrap_row=copy.deepcopy(boots[0]);self.bootstrap=self.bootstrap_row[0]
        self.identity={'database':'postgres','role':self.bootstrap,'currentRole':self.bootstrap,'serverMajor':17,
            'targetProfile':'OWNED_ISOLATED_FIXTURE','imageId':ba.IMAGE_ID,'projectIdentitySha256':None,
            'hostIdentitySha256':None,'sslmode':None,'fixture':True}
        self.plan=plan or SimpleNamespace(fixture=True,digest='a'*64,data={'planId':'owned-recovery-v1',
            'targetProfile':'OWNED_ISOLATED_FIXTURE','ledger':{'sourcePrefixSha256':self.expected['prefix']}})
        self.auth=copy.deepcopy(auth or {'packageHashes':pc.package_hashes(),'targetIdentity':self.identity})
        target=self.auth['targetIdentity']
        if (target.get('fixture') is not self.plan.fixture or
            target.get('targetProfile')!=self.plan.data['targetProfile']):
            raise AssertionError('SYNTHETIC_ENDPOINT_BINDING_MISMATCH')
        self.endpoint=None
        if self.plan.fixture:
            if endpoint is not None:raise AssertionError('OWNED_FIXTURE_ENDPOINT_FORBIDDEN')
        else:
            if endpoint is None:raise AssertionError('SYNTHETIC_ENDPOINT_REQUIRED')
            if (type(endpoint) is not dict or set(endpoint)!={'host','port'} or
                type(endpoint['host']) is not str or not endpoint['host'] or
                type(endpoint['port']) is not int or endpoint['port']!=5432 or
                sha(canonical(endpoint['host']))!=target.get('hostIdentitySha256')):
                raise AssertionError('SYNTHETIC_ENDPOINT_BINDING_MISMATCH')
            self.endpoint=copy.deepcopy(endpoint)
        if legacy:
            d=json.loads((ROOT/'docs/evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-attempt2-e3-recovery-d9-candidate-closure-implementation-scope-review.json').read_bytes())
            self.auth['packageHashes']=d['packageHashesBefore']
        self.attempt=uuid.uuid4().hex;self.snapshot='00000001-00000001-1';self.started=time.time()-3
        self.context={'captureId':self.attempt,'sourceTargetId':sha(canonical(self.auth['targetIdentity'])),
            'sourceIdentitySha256':sha(canonical(self.auth['targetIdentity'])),'targetProfile':self.plan.data['targetProfile'],
            'authorizationSha256':sha(canonical(self.auth)),'operationalPackageDigest':sha(canonical(self.auth['packageHashes']))}
        self.roles=('CREATE ROLE '+ba._restore_identifier(self.bootstrap)+';\nALTER ROLE '+ba._restore_identifier(self.bootstrap)+
                    ' SUPERUSER;\nCREATE ROLE postgres;\nALTER ROLE postgres NOSUPERUSER NOLOGIN;\n').encode()
        self.counts={};self.full=b'PGDMPsynthetic-private-unit-archive';self.schema=b'PGDMPsynthetic-private-unit-schema'
        self.proofs={k:self.proof(k) for k in ['exporter','full','schema','roles','afterObservation']}
        self.bundle={'contract':'backup-transport-proofs/1','backupAttempt':self.attempt,'snapshot':self.snapshot,
            'records':{k:{'proof':v['proof'],'sha256':v['sha256']} for k,v in self.proofs.items()}}
        self.ext=copy.deepcopy(ba._PLPGSQL_TEMPLATE)
        self.expected.setdefault('extensions',copy.deepcopy(self.ext['extensions']))
        for family in ['columns','functions','types']:self.expected.setdefault(family,[])
        self.extension_state={k:[] for k in ba._EXTENSION_FAMILIES}
        self.extension_guard={'owners':None,'acls':None,'expandedAcl':None,'extensionMembers':None,'databaseOwner':self.bootstrap}
        self.database={'name':'postgres','owner':self.bootstrap,'aclRaw':None,'effectiveAcl':sorted([
            [self.bootstrap,'PUBLIC','CONNECT',False],[self.bootstrap,'PUBLIC','TEMPORARY',False],
            [self.bootstrap,self.bootstrap,'CONNECT',False],[self.bootstrap,self.bootstrap,'CREATE',False],
            [self.bootstrap,self.bootstrap,'TEMPORARY',False]])}
        self.extras={k:[] for k in ['roleComments','roleSecurityLabels','databaseRoleSettings','parameterAcl']}
        self.rebuild_provenance()
        self.legacy=legacy

    def rebuild_provenance(self):
        ba=self.ba
        values={'plpgsqlExpectedState':self.ext,'databaseAclBeforeCapture':self.database,
                'unsupportedRoleFamilies':self.extras,
                'extensionRecoveryExpectedState':ba._extension_envelope(self.extension_state,self.extension_guard)}
        qb=[]
        for phase,key in [('PRE','exporter'),('POST','afterObservation')]:
            for k,q in ba._prerequisite_queries():
                value=copy.deepcopy(ba._prerequisite_value(values,k))
                qb.append({'key':k,'phase':phase,'querySha256':sha(q.encode()),'canonicalResponse':value,
                    'canonicalResponseSha256':sha(canonical(value)),'transportProofRef':ba._proof_ref(key,self.proofs[key])})
        self.provenance=ba._build_provenance(self.measurement('PRE'),self.measurement('POST'),values,values,qb,
            self.expected,self.roles,self.proofs,self.context)

    def response(self,user=None):
        return {'database':'postgres','session_user':user or self.auth['targetIdentity']['role'],
            'current_user':user or self.auth['targetIdentity']['currentRole'],
            'serverVersionNum':170006,'serverVersion':'17.6','serverEncoding':'UTF8','clientEncoding':'UTF8',
            'bootstrapRows':[{'bootstrapOid':'10','bootstrapName':self.bootstrap,'roleTuple':copy.deepcopy(self.bootstrap_row)}]}

    def proof(self,key):
        import uuid
        ba=self.ba;tool='pg_dumpall' if key=='roles' else ('pg_dump' if key in ('full','schema') else 'psql')
        p={'contract':'maintenance-client-proof/1','fixture':self.plan.fixture,
            'proofKind':'OWNED_ISOLATED_INVOCATION' if self.plan.fixture else ('PSQL_SAME_SESSION_METADATA' if tool=='psql' else 'REAL_INVOCATION_LIBPQ_ENFORCEMENT'),
            'invocationId':uuid.uuid4().hex,'tool':tool,'toolImageId':ba.IMAGE_ID,'startedAt':self.started+1,'completedAt':self.started+1.1,
            'targetProfile':self.context['targetProfile'],'targetIdentitySha256':self.context['sourceIdentitySha256'],
            'backupAttempt':self.attempt,'transportContract':'OWNED_ISOLATED_FIXTURE' if self.plan.fixture else ba.TRANSPORT_CONTRACT,
            'riskAcceptance':None if self.plan.fixture else ba.RISK_BINDING.copy()}
        if not self.plan.fixture:
            p.update(authorizationSha256=self.context['authorizationSha256'],packageHashes=self.auth['packageHashes'],
                sslmode='verify-full',gssencmode='disable',clientTlsRequired=True,clientTls={'enabled':True},
                endpoint=copy.deepcopy(self.endpoint),
                credentialIdentitySha256=self.auth.get('credentialIdentitySha256','c'*64))
        if key in ('full','schema','roles'):
            args=['--roles-only','--no-role-passwords'] if key=='roles' else ['-d','postgres','-Fc']+(['--schema-only'] if key=='schema' else [])+['--snapshot='+self.snapshot]
            payload={'full':self.full,'schema':self.schema,'roles':self.roles}[key]
            p.update(dumpKind=key,snapshot=None if key=='roles' else self.snapshot,inputSha256=sha(canonical([tool,args])),outputSha256=sha(payload),exitCode=0)
        return {'proof':p,'sha256':sha(canonical(p)+b'\n'),'path':None}

    def measurement(self,phase):
        response=self.response();key='exporter' if phase=='PRE' else 'afterObservation'
        t=self.started+(.5 if phase=='PRE' else 1.5)
        return {'phase':phase,'measuredAtUtc':'2026-09-22T00:00:00+00:00','startedAt':t,'completedAt':t+.01,
            'monotonicSequence':1 if phase=='PRE' else 2,'querySha256':self.ba.BOOTSTRAP_QUERY_SHA,
            'canonicalResponse':response,'canonicalResponseSha256':sha(canonical(response)),
            'rawBootstrapOid':'10','rawBootstrapOidType':'str','normalizedBootstrapOid':10,
            'transportProofRef':self.ba._proof_ref(key,self.proofs[key]),'sourceIdentitySha256':self.context['sourceIdentitySha256'],
            'captureId':self.attempt,'rawResponseAvailable':False,'rawResponseSha256':None}

    def actual_roles(self):
        rows=copy.deepcopy({k:self.expected[k] for k in ['roles','memberships']})
        rows['roles'].append(list(self.ba.OWNED_RESTORE_ADMIN_TUPLE));return rows

    def stage(self):
        ba=self.ba;wanted=copy.deepcopy(self.ext);role=[r for r in self.expected['roles'] if r[0]=='postgres'][0]
        baseline=ba._database_acl_profile(self.database,ba._identity(self.response()),self.expected['roles'])['baseline']
        return {'status':'PASS','strategy':'STAGED','owner':'postgres','temporaryPrivilegeUsed':not role[1],
            'finalOwnerTuple':role,'finalizationExact':True,'extensionExpected':wanted,'extensionActual':wanted,
            'extensionSha256':sha(canonical(wanted)),'databaseBefore':copy.deepcopy(baseline),'databaseAfter':copy.deepcopy(baseline),
            'databaseAclRawPreserved':True,'databaseAclEffectivePreserved':True,'footprint':[],
            'roleFamilySha256':sha(canonical({k:self.expected[k] for k in ['roles','memberships']}))}

    def restore_report(self):
        ba=self.ba;identity=ba._identity(self.response());provsha=sha(canonical(self.provenance)+b'\n')
        derived,receipt=ba._derive_roles(self.roles,identity,identity)
        receipt.update(sourceBootstrapProvenanceSha256=provsha,destinationIdentitySha256=sha(canonical(identity)),actualStdinSha256=sha(derived))
        transport=self.response(ba.OWNED_RESTORE_ADMIN);stage=self.stage();rh=stage['roleFamilySha256']
        result = {'contract':ba.RESTORE_CONTRACT,'recoveryContractVersion':ba.RECOVERY_VERSION,'recoveryCandidateName':ba.RECOVERY_CANDIDATE,
            'status':'PASS','sourceBootstrapProvenanceSha256':provsha,'sourceBootstrapIdentitySha256':sha(canonical(identity)),
            'destinationBootstrapIdentitySha256':sha(canonical(identity)),'restoreTransportIdentitySha256':sha(canonical(transport)),
            'sourceBootstrapIdentity':identity,'destinationBootstrapIdentity':identity,'restoreTransportIdentity':transport,
            'transportTuple':list(ba.OWNED_RESTORE_ADMIN_TUPLE),'rolesDerivationReceipt':receipt,'postE3RoleFamilySha256':rh,
            'postFinalizationRoleFamilySha256':rh,'finalRoleFamilySha256':rh,'stagedPlpgsqlValidation':stage,
            'restoreAdminNormalized':True,'restoreAdminTrackedFootprintZero':True,'footprint':[],
            'normalizedCatalogSha256':ba.fingerprint(self.expected),'catalogSha256':ba.fingerprint(self.expected),
            'countsSha256':sha(canonical(self.counts)),'ledgerPrefixSha256':self.expected['prefix'],
            'network':'none','hostPorts':0,'hostMounts':0,'sourceCredentialsMounted':False,'imageId':ba.IMAGE_ID,
            'cleanup':'OWNED_CONTAINER_REMOVED','ownedCleanup':{'status':'PASS','ownedContainersRemaining':0},
            'databaseOwnerClassification':'LOCAL_RESTORE_INFRASTRUCTURE_ONLY','databaseOwnerSourceFidelityClaim':False,
            'phaseResults':dict({k:'PASS' for k in ['E1','E2','E3','E3_RECONCILIATION','E4','E5','E6_DB_ACL','E7','E8','E9']},E6='NOT_REQUIRED'),
            'aclSupplementCount':0}
        envelope=self.provenance['sourceRestorePrerequisites']['extensionRecoveryExpectedState']
        argv=ba._restore_argv('uply-runner-i1-'+'0'*32,envelope['branch'],identity)
        result['restoreExecutionContext']=ba._restore_execution_context(argv,self.full,envelope['branch'],identity)
        result['extensionValidation']=ba._extension_report(envelope,self.extension_state,self.extension_state,self.expected,identity,[])
        database_plan=ba._database_acl_plan(self.database,identity,self.expected['roles'],provsha,sha(self.full))
        mutation=database_plan['branch']=='OWNER_CREATE_APPEND'
        execution={'beforeState':copy.deepcopy(database_plan['baseline']),'afterState':copy.deepcopy(self.database),
            'executionCount':int(mutation),'actualStdinSha256':database_plan['derivedSqlSha256'] if mutation else None,
            'returnCode':0 if mutation else None,'executionIdentity':{'session_user':ba.OWNED_RESTORE_ADMIN,
            'current_user':self.bootstrap,'database':'postgres'} if mutation else None}
        result['databaseAclRecovery']=ba._database_acl_report(database_plan,execution,self.database)
        return result

    def write(self,root):
        from receipts import private_directory,exclusive
        ba=self.ba;root=private_directory(root);meta=private_directory(root/'metadata')
        for n,raw in [('database.dump',self.full),('schema.dump',self.schema),('roles.sql',self.roles)]:ba._write_bytes(root/n,raw)
        for n,v in [('catalog.json',self.expected),('counts.json',self.counts),('migration-ledger.json',self.expected['ledger']),
                    ('restore.json',({k:v for k,v in self.restore_report().items() if k in
                        {'status','catalogSha256','countsSha256','ledgerPrefixSha256','network','hostPorts','sourceCredentialsMounted','imageId','cleanup'}}
                        if self.legacy else self.restore_report())),('transport-proofs.json',self.bundle)]:exclusive(meta/n,v,redact=False)
        if not self.legacy:exclusive(meta/'bootstrap-provenance.json',self.provenance,redact=False)
        files={str(p.relative_to(root)):{'sha256':sha(p.read_bytes()),'bytes':p.stat().st_size} for p in root.rglob('*') if p.is_file()}
        m={'reportVersion':'exact-single-backup/2' if self.legacy else ba.MANIFEST_VERSION,'status':'VALID','restoreStatus':'PASS',
            'planId':self.plan.data['planId'],'planSha256':self.plan.digest,'backupAttempt':self.attempt,'snapshot':self.snapshot,
            'targetProfile':self.context['targetProfile'],'sourceIdentitySha256':self.context['sourceIdentitySha256'],
            'transportContract':'OWNED_ISOLATED_FIXTURE' if self.plan.fixture else ba.TRANSPORT_CONTRACT,
            'riskAcceptance':None if self.plan.fixture else ba.RISK_BINDING.copy(),
            'packageHashes':self.auth['packageHashes'],'files':files,'snapshotStart':self.started,'snapshotEnd':time.time(),'sealedAt':time.time(),
            'catalogSha256':ba.fingerprint(self.expected),'fullSourcePrefixDigest':self.expected['prefix'],
            'rolesCapture':'SEPARATE_NON_MVCC_CAPTURE_BEFORE_AFTER_FINGERPRINT_MATCH'}
        if not self.legacy:m.update(recoveryCandidateName=ba.RECOVERY_CANDIDATE,recoveryCandidateVersion=ba.RECOVERY_VERSION,
            recoveryReportContract=ba.RESTORE_CONTRACT,rawRolesSha256=sha(self.roles),
            sourceBootstrapProvenance=dict(path=ba.PROVENANCE_PATH,contract=ba.PROVENANCE_CONTRACT,**files[ba.PROVENANCE_PATH]))
        exclusive(meta/'manifest.json',m);return root

    def validate(self,root,historical=False):
        return self.ba.validate_recovery_artifacts(root,sha((root/'metadata/manifest.json').read_bytes()),
            expected_package_digest=self.context['operationalPackageDigest'],expected_plan_sha=self.plan.digest,
            expected_target_sha=self.context['sourceIdentitySha256'],expected_authorization_sha=self.context['authorizationSha256'],historical=historical)


class RecoveryV1Focused(unittest.TestCase):
    """V1 lineage IDs retained against the current forward candidate; fresh validation is separate."""
    def setUp(self):
        import backup_adapter as ba
        self.ba=ba;self.f=RecoveryV1Facts();self.identity=ba._identity(self.f.response())
        self.tmp=tempfile.TemporaryDirectory(prefix='owned-recovery-v1-unit-');self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)/'backup'

    def derive(self,raw=None,source=None,destination=None):
        return self.ba._derive_roles(self.f.roles if raw is None else raw,source or self.identity,destination or self.identity)

    def deny(self,call,code=None):
        with self.assertRaises(Failure) as caught:call()
        if code:self.assertEqual(caught.exception.code,code)

    def prov(self,p=None,bundle=None,roles=None):
        return self.ba._validate_provenance(self.f.provenance if p is None else p,self.f.expected,
            self.f.roles if roles is None else roles,self.f.bundle if bundle is None else bundle,
            authorization_sha=self.f.context['authorizationSha256'],package_digest=self.f.context['operationalPackageDigest'])

    def mutate_artifact(self,name,change):
        root=self.f.write(self.root);p=root/name;v=json.loads(p.read_bytes());change(v);p.write_bytes(canonical(v)+b'\n')
        mp=root/'metadata/manifest.json';m=json.loads(mp.read_bytes())
        if name!='metadata/manifest.json':m['files'][name]={'sha256':sha(p.read_bytes()),'bytes':p.stat().st_size}
        else:m=v
        mp.write_bytes(canonical(m)+b'\n');return root

    def stage_transport(self,*,extension=None,database_after=None,roles=None,fail=None):
        outer=self
        class Transport:
            def __init__(self):self.sql=[];self.db_count=0
            def _sql(self,raw,kind):
                self.sql.append(raw)
                if fail and fail in raw:raise Failure('BACKUP_FAILED','SQL_STATEMENT_FAILED')
                return b''
            def _json(self,query,kind):
                if query==outer.ba.DATABASE_ACL_SQL:
                    self.db_count+=1
                    return copy.deepcopy(database_after if self.db_count>1 and database_after is not None else outer.f.database)
                if query==outer.ba.PLPGSQL_SQL:return copy.deepcopy(extension if extension is not None else outer.f.ext)
                if query==outer.ba.ROLE_STATE_SQL:return copy.deepcopy(roles if roles is not None else outer.f.actual_roles())
                if query==outer.ba.FOOTPRINT_SQL:return []
                raise AssertionError('unexpected measurement')
        return Transport()

    def stage(self,t):return self.ba._staged_plpgsql(t,self.f.expected,self.f.provenance['sourceRestorePrerequisites'])

    def test_BACKUP_RECOVERY_V1_001(self):
        derived,r=self.derive();self.assertEqual(r['matchCount'],1);self.assertNotIn(b'CREATE ROLE "fixture_bootstrap";',derived)
        self.assertIn(b'ALTER ROLE "fixture_bootstrap" SUPERUSER;',derived)

    def test_BACKUP_RECOVERY_V1_002(self):
        i=dict(self.identity,bootstrapName='Case Role');out,r=self.derive(b'CREATE ROLE "Case Role";\nCREATE ROLE postgres;',i,i)
        self.assertEqual(out,b'\nCREATE ROLE postgres;');self.assertEqual(r['bootstrapIdentifier'],'Case Role')

    def test_BACKUP_RECOVERY_V1_003(self):
        i=dict(self.identity,bootstrapName='a"b');out,_=self.derive(b'CREATE ROLE "a""b";',i,i);self.assertEqual(out,b'')

    def test_BACKUP_RECOVERY_V1_004(self):
        raw=b'-- CREATE ROLE fixture_bootstrap;\n/* CREATE ROLE fixture_bootstrap; */\nCREATE ROLE fixture_bootstrap;'
        out,r=self.derive(raw);self.assertEqual(r['matchCount'],1);self.assertTrue(out.endswith(b'*/\n'))

    def test_BACKUP_RECOVERY_V1_005(self):self.deny(lambda:self.derive(b'CREATE ROLE postgres;'),'BOOTSTRAP_CREATE_ZERO_MATCH')
    def test_BACKUP_RECOVERY_V1_006(self):self.deny(lambda:self.derive(b'CREATE ROLE fixture_bootstrap;CREATE ROLE fixture_bootstrap;'),'BOOTSTRAP_CREATE_MULTIPLE_MATCH')
    def test_BACKUP_RECOVERY_V1_007(self):
        for raw in [b'CREATE ROLE fixture_bootstrap',b"SET a='unterminated",b'/* open']:
            with self.subTest(raw=raw):self.deny(lambda:self.derive(raw))
    def test_BACKUP_RECOVERY_V1_008(self):self.deny(lambda:self.derive(b'CREATE /* retained */ ROLE fixture_bootstrap;'))
    def test_BACKUP_RECOVERY_V1_009(self):
        for raw in [b'\x80',b'CREATE ROLE fixture_bootstrap;\n\\q\n',b"SET a=E'x';",b'SET a=$x$x$x$;']:
            with self.subTest(raw=raw):self.deny(lambda:self.derive(raw))
    def test_BACKUP_RECOVERY_V1_010(self):self.deny(lambda:self.derive(destination=dict(self.identity,bootstrapName='other')),'DESTINATION_BOOTSTRAP_IDENTITY_MISMATCH')
    def test_BACKUP_RECOVERY_V1_011(self):
        for oid in [11,'11',True,False,10.0,None,'010','+10',' 10','10 ','10.0','1e1','１０']:
            with self.subTest(oid=oid):self.deny(lambda:self.derive(source=dict(self.identity,bootstrapOid=oid)))
        for oid in [10,'10']:self.assertEqual(self.derive(source=dict(self.identity,bootstrapOid=oid))[1]['matchCount'],1)
    def test_BACKUP_RECOVERY_V1_012(self):
        p=copy.deepcopy(self.f.provenance);p['rawRolesSha256']='0'*64;self.deny(lambda:self.prov(p))
    def test_BACKUP_RECOVERY_V1_013(self):
        raw=b'-- prefix\r\nCREATE ROLE fixture_bootstrap;\r\nCREATE ROLE postgres;\r\n';out,r=self.derive(raw)
        a,z=r['removedSpan']['startByteInclusive'],r['removedSpan']['endByteExclusive']
        self.assertEqual(out,raw[:a]+raw[z:]);self.assertEqual(out[:a],raw[:a]);self.assertEqual(out[a:],raw[z:])
    def test_BACKUP_RECOVERY_V1_014(self):
        root=self.mutate_artifact('metadata/restore.json',lambda r:r['rolesDerivationReceipt'].update(actualStdinSha256='0'*64))
        self.deny(lambda:self.f.validate(root),'ROLE_STDIN_SHA_MISMATCH')
    def test_BACKUP_RECOVERY_V1_015(self):
        # D12 integration uses repository capture_backup/_restore, not a historical harness.
        with RecoveryV1IntegrationFixture() as f:
            result=f.run();self.assertTrue(result['ordinaryPostgresCreatedByReplay']);self.assertTrue(result['fullFidelity'])
    def test_BACKUP_RECOVERY_V1_016(self):
        self.deny(lambda:self.derive(self.f.roles+b"ALTER ROLE postgres PASSWORD 'x';"),'ROLE_PASSWORD')
    def test_BACKUP_RECOVERY_V1_017(self):
        actual=self.f.actual_roles();actual['roles']=[r for r in actual['roles'] if r[0]!='postgres']
        self.deny(lambda:self.ba._role_gate(actual,self.f.expected),'OWNED_ROLE_REPLAY_INCOMPLETE')
    def test_BACKUP_RECOVERY_V1_018(self):self.assertEqual(self.prov(),self.identity)
    def test_BACKUP_RECOVERY_V1_019(self):
        p=copy.deepcopy(self.f.provenance);p['measurementAfter']['canonicalResponse']['bootstrapRows'][0]['roleTuple'][4]=False
        self.deny(lambda:self.prov(p))
    def test_BACKUP_RECOVERY_V1_020(self):
        p=copy.deepcopy(self.f.provenance);p['sourceTargetId']='0'*64;self.deny(lambda:self.prov(p))
    def test_BACKUP_RECOVERY_V1_021(self):
        for k in ['rolesToolInvocationId','authorizationSha256','operationalPackageDigest']:
            p=copy.deepcopy(self.f.provenance);p[k]='0'*len(p[k]);self.deny(lambda:self.prov(p))
    def test_BACKUP_RECOVERY_V1_022(self):self.deny(lambda:self.prov(roles=self.f.roles+b'\n'))
    def test_BACKUP_RECOVERY_V1_023(self):
        root=self.f.write(self.root);(root/self.ba.PROVENANCE_PATH).unlink();self.deny(lambda:self.f.validate(root))
    def test_BACKUP_RECOVERY_V1_024(self):
        from receipts import strict_json
        self.deny(lambda:strict_json(b'{"schemaVersion":1,"schemaVersion":2}'))
        p=copy.deepcopy(self.f.provenance);p['extra']=True;self.deny(lambda:self.prov(p))
    def test_BACKUP_RECOVERY_V1_025(self):
        p=copy.deepcopy(self.f.provenance);p['measurementBefore']['completedAt']=time.time()+100;self.deny(lambda:self.prov(p))
    def test_BACKUP_RECOVERY_V1_026(self):
        p=copy.deepcopy(self.f.provenance);p['measurementAfter']['canonicalResponseSha256']='0'*64;self.deny(lambda:self.prov(p))
    def test_BACKUP_RECOVERY_V1_027(self):
        m=self.f.validate(self.f.write(self.root));self.assertEqual(m['rolesCapture'],'SEPARATE_NON_MVCC_CAPTURE_BEFORE_AFTER_FINGERPRINT_MATCH')
    def test_BACKUP_RECOVERY_V1_028(self):
        for k in self.f.extras:
            x=copy.deepcopy(self.f.extras);x[k]=[['unexpected']];self.deny(lambda:self.ba._unsupported_families(x))
    def test_BACKUP_RECOVERY_V1_029(self):
        ext=copy.deepcopy(self.f.ext);ext['extensions'][0][3]=self.ba.OWNED_RESTORE_ADMIN;self.deny(lambda:self.stage(self.stage_transport(extension=ext)))
    def test_BACKUP_RECOVERY_V1_030(self):
        ext=copy.deepcopy(self.f.ext);ext['plpgsqlLanguage'][1]=self.ba.OWNED_RESTORE_ADMIN;self.deny(lambda:self.stage(self.stage_transport(extension=ext)))
    def test_BACKUP_RECOVERY_V1_031(self):
        for index,value in [(3,'other'),(4,'{}'),(14,'other')]:
            ext=copy.deepcopy(self.f.ext);ext['implementation'][0][index]=value;self.deny(lambda:self.stage(self.stage_transport(extension=ext)))
    def test_BACKUP_RECOVERY_V1_032(self):
        self.deny(lambda:self.stage(self.stage_transport(database_after=dict(self.f.database,aclRaw='{}'))),'STAGED_PLPGSQL_FINALIZATION_FAILED')
    def test_BACKUP_RECOVERY_V1_033(self):
        rows=self.f.actual_roles();next(x for x in rows['roles'] if x[0]=='postgres')[5]=True
        self.deny(lambda:self.stage(self.stage_transport(roles=rows)),'OWNED_ROLE_REPLAY_INCOMPLETE')
    def test_BACKUP_RECOVERY_V1_034(self):
        t=self.stage_transport();self.stage(t);self.assertFalse(any(b'LOGIN' in sql for sql in t.sql));self.assertIn(b'ALTER ROLE "postgres" NOSUPERUSER;',t.sql)
    def test_BACKUP_RECOVERY_V1_035(self):
        t=self.stage_transport(fail=b'DROP EXTENSION');self.deny(lambda:self.stage(t),'STAGED_PLPGSQL_DEPENDENCY')
        self.assertEqual(t.sql[-1],b'DROP EXTENSION plpgsql RESTRICT;');self.assertFalse(any(b'CREATE EXTENSION' in s for s in t.sql))
    def test_BACKUP_RECOVERY_V1_036(self):
        t=self.stage_transport();self.stage(t);raw=b'\n'.join(t.sql)
        self.assertNotIn(b'CASCADE',raw);self.assertNotIn(b'UPDATE pg_',raw);self.assertEqual(sum(b'CREATE EXTENSION' in x for x in t.sql),1)
    def test_BACKUP_RECOVERY_V1_037(self):
        next(x for x in self.f.expected['roles'] if x[0]=='postgres')[1]=True
        t=self.stage_transport();self.stage(t);self.assertFalse(any(b'ALTER ROLE' in x for x in t.sql))
    def test_BACKUP_RECOVERY_V1_038(self):
        d=BackupDiagnostics('test_BACKUP_DIAG_11_body_and_cleanup');d.setUp();self.addCleanup(d.doCleanups)
        _,error,_,_=d.local_simulation(('E3','OWNED_STAGED_PLPGSQL_SQL'))
        self.assertIsInstance(error,Failure);self.assertEqual(sum(c[1]=='OWNED_STOP' for c in d.calls),1);self.assertFalse(any(c[1]=='OWNED_PG_RESTORE' for c in d.calls))
    def acl(self,kind='r',grant='postgres=arwdDxtm/postgres'):
        old={'relations':[['s','t',kind,'postgres',[grant],False,False,None]],'namespaces':[]};new=copy.deepcopy(old);new['relations'][0][4]=None
        return old,new
    def test_BACKUP_RECOVERY_V1_039(self):
        a,b=self.acl();self.assertEqual(self.ba._acl_supplement(a,b),['SET ROLE "postgres"; GRANT ALL ON TABLE "s"."t" TO "postgres"; RESET ROLE;'])
    def test_BACKUP_RECOVERY_V1_040(self):
        a,b=self.acl('S','postgres=rwU/postgres');self.assertIn('ON SEQUENCE',self.ba._acl_supplement(a,b)[0])
    def test_BACKUP_RECOVERY_V1_041(self):
        a={'relations':[],'namespaces':[['s','postgres',['postgres=UC/postgres']]]};b={'relations':[],'namespaces':[['s','postgres',None]]}
        self.assertEqual(len(self.ba._acl_supplement(a,b)),1)
    def test_BACKUP_RECOVERY_V1_042(self):
        a,b=self.acl();b['relations'][0][1]='other';self.assertEqual(self.ba._acl_supplement(a,b),[])
        b['relations']=[];self.assertEqual(self.ba._acl_supplement(a,b),[]);self.assertNotEqual(a,b)
    def test_BACKUP_RECOVERY_V1_043(self):
        for grant in ['postgres=r/other','member=r/postgres','postgres=r/postgres']:
            a,b=self.acl(grant=grant);self.assertEqual(self.ba._acl_supplement(a,b),[])
    def test_BACKUP_RECOVERY_V1_044(self):
        a,b=self.acl();b['relations'][0][5]=True;self.assertEqual(self.ba._acl_supplement(a,b),[]);self.assertNotEqual(a,b)
    def test_BACKUP_RECOVERY_V1_045(self):
        for rows in [self.f.actual_roles()['roles'][:-1],self.f.actual_roles()['roles']+[list(self.ba.OWNED_RESTORE_ADMIN_TUPLE)]]:
            self.deny(lambda:self.ba._without_admin(dict(self.f.actual_roles(),roles=rows),[]))
        rows=self.f.actual_roles();rows['roles'][-1][5]=False;self.deny(lambda:self.ba._without_admin(rows,[]))
    def test_BACKUP_RECOVERY_V1_046(self):
        state=self.f.actual_roles();old=copy.deepcopy(state);new=self.ba._without_admin(state,[])
        self.assertEqual(state,old);self.assertEqual(new,{k:self.f.expected[k] for k in ['roles','memberships']})
    def test_BACKUP_RECOVERY_V1_047(self):
        state=self.f.actual_roles();state['roles'].append(['other',False,True,False,False,False,False,False,-1,None,None])
        self.deny(lambda:self.ba._role_gate(state,self.f.expected),'OWNED_ROLE_REPLAY_INCOMPLETE')
    def test_BACKUP_RECOVERY_V1_048(self):
        for i in range(3):
            state=self.f.actual_roles();row=['target','member','postgres',False,True,True];row[i]=self.ba.OWNED_RESTORE_ADMIN;state['memberships']=[row]
            self.deny(lambda:self.ba._without_admin(state,[]),'OWNED_RESTORE_ADMIN_MEMBERSHIP_FOOTPRINT')
    def test_BACKUP_RECOVERY_V1_049(self):
        for kind in ['namespace','relation','function','type','default','language','extension']:
            for pos in ['owner','grantor','grantee']:
                self.deny(lambda:self.ba._without_admin(self.f.actual_roles(),[[kind,'synthetic',pos,self.ba.OWNED_RESTORE_ADMIN]]),'OWNED_RESTORE_ADMIN_FOOTPRINT')
    def test_BACKUP_RECOVERY_V1_050(self):
        state=self.f.actual_roles();state['policies']=[['s','t','p','r',True,[self.ba.OWNED_RESTORE_ADMIN],None,None]]
        self.deny(lambda:self.ba._without_admin(state,[]),'OWNED_RESTORE_ADMIN_FOOTPRINT')
    def test_BACKUP_RECOVERY_V1_051(self):
        state=self.f.actual_roles();state['roles'][1][10]=['role=uply_owned_restore_admin'];self.deny(lambda:self.ba._without_admin(state,[]),'ROLE_FIDELITY_PROFILE_UNSUPPORTED')
    def test_BACKUP_RECOVERY_V1_052(self):
        state=self.f.actual_roles();state['extensions']=[['plpgsql','1.0','pg_catalog',self.ba.OWNED_RESTORE_ADMIN]]
        self.deny(lambda:self.ba._without_admin(state,[]),'OWNED_RESTORE_ADMIN_FOOTPRINT')
    def test_BACKUP_RECOVERY_V1_053(self):
        m=self.f.validate(self.f.write(self.root));self.assertEqual(m['reportVersion'],'exact-single-backup/3');self.assertEqual(set(m['files']),self.ba.REQUIRED_FILES);self.assertEqual(len(m['files']),9)
    def test_BACKUP_RECOVERY_V1_054(self):
        root=self.mutate_artifact('metadata/manifest.json',lambda m:m.update(recoveryCandidateVersion=True));self.deny(lambda:self.f.validate(root))
    def test_BACKUP_RECOVERY_V1_055(self):
        root=self.mutate_artifact('metadata/restore.json',lambda m:m.update(sourceBootstrapProvenanceSha256='0'*64));self.deny(lambda:self.f.validate(root))
    def test_BACKUP_RECOVERY_V1_056(self):
        root=self.mutate_artifact('metadata/restore.json',lambda m:m.update(countsSha256='0'*64));self.deny(lambda:self.f.validate(root))
    def test_BACKUP_RECOVERY_V1_057(self):
        root=self.mutate_artifact('metadata/restore.json',lambda m:m.update(ownedCleanup={'status':'FAIL','ownedContainersRemaining':1}));self.deny(lambda:self.f.validate(root))
    # IDs 058-060 belong to the contract test file.
    def test_BACKUP_RECOVERY_V1_061(self):
        d=BackupDiagnostics('test_BACKUP_DIAG_04_E4_restore');d.setUp();self.addCleanup(d.doCleanups)
        _,error,_,_=d.local_simulation(('E4','OWNED_PG_RESTORE'),capture=True)
        self.assertIsInstance(error,Failure);self.assertFalse(list(d.root.rglob('manifest.json')))
    def test_BACKUP_RECOVERY_V1_062(self):
        root=self.f.write(self.root);self.assertEqual((root/'roles.sql').read_bytes(),self.f.roles)
        self.assertEqual((root/self.ba.PROVENANCE_PATH).read_bytes(),canonical(self.f.provenance)+b'\n')
    def test_BACKUP_RECOVERY_V1_063(self):
        import inspect
        self.assertIn("'-U','postgres'",inspect.getsource(fixture.Fixture.sql));self.assertIn('self.cluster=OwnedCluster()',inspect.getsource(fixture.Fixture.__init__))
    def test_BACKUP_RECOVERY_V1_064(self):
        import maintenance_transport as mt
        with patch.object(mt.OwnedTransport,'_inspect'),patch.object(mt.OwnedRestoreDestinationTransport,'_inspect'):
            source=mt.OwnedTransport('uply-runner-i1-'+'a'*32);dest=mt.OwnedRestoreDestinationTransport('uply-runner-i1-'+'b'*32)
        self.assertEqual(source.identity['role'],'postgres');self.assertEqual(dest.identity['role'],mt.OWNED_RESTORE_ADMIN)
        self.assertNotEqual(source.identity['targetProfile'],dest.identity['targetProfile'])
    def test_BACKUP_RECOVERY_V1_065(self):
        d=BackupDiagnostics('test_BACKUP_DIAG_27_network_no_credentials');d.setUp();self.addCleanup(d.doCleanups)
        _,error,_,_=d.local_simulation();self.assertIsNone(error)
        argv=next(c[2] for c in d.calls if c[1]=='OWNED_CLUSTER_RUN')
        self.assertIn('-U "$1"',argv[-4]);self.assertEqual(argv[-2],d.facts.bootstrap);self.assertNotIn(d.facts.bootstrap,argv[-4])
    def test_BACKUP_RECOVERY_V1_066(self):
        d=BackupDiagnostics('test_BACKUP_DIAG_27_network_no_credentials');d.setUp();self.addCleanup(d.doCleanups);d.test_BACKUP_DIAG_27_network_no_credentials()
    def test_BACKUP_RECOVERY_V1_067(self):
        d=BackupDiagnostics('test_BACKUP_DIAG_28_no_retry');d.setUp();self.addCleanup(d.doCleanups);d.test_BACKUP_DIAG_28_no_retry()
    def test_BACKUP_RECOVERY_V1_068(self):
        d=BackupDiagnostics('test_BACKUP_DIAG_16_operation_allowlist');d.setUp();self.addCleanup(d.doCleanups);d.test_BACKUP_DIAG_16_operation_allowlist()
    def test_BACKUP_RECOVERY_V1_069(self):
        d=BackupDiagnostics('test_BACKUP_DIAG_11_body_and_cleanup');d.setUp();self.addCleanup(d.doCleanups);d.test_BACKUP_DIAG_11_body_and_cleanup()
    def test_BACKUP_RECOVERY_V1_070(self):
        d=BackupDiagnostics('test_BACKUP_DIAG_19_success_order');d.setUp();self.addCleanup(d.doCleanups);d.test_BACKUP_DIAG_19_success_order()


class RecoveryV2ProfileFocused(unittest.TestCase):
    """V2 lineage IDs retained; current artifact identity follows the forward V3 contract."""
    """D11-F2 definitions only; execution requires fresh V2 validation approval."""
    setUp=RecoveryV1Focused.setUp
    deny=RecoveryV1Focused.deny
    derive=RecoveryV1Focused.derive

    def accepted(self,config):
        row=copy.deepcopy(self.f.postgres_row);row[10]=copy.deepcopy(config)
        rows=[row];before=copy.deepcopy(rows)
        self.assertIs(self.ba._role_config_supported(config),True)
        self.assertIs(self.ba._role_rows(rows),rows)
        self.assertEqual(rows,before);self.assertEqual(rows[0][10],config)

    def rejected(self,config):
        rows=[copy.deepcopy(self.f.postgres_row)];rows[0][10]=copy.deepcopy(config)
        before=copy.deepcopy(rows)
        self.assertIs(self.ba._role_config_supported(config),False)
        self.deny(lambda:self.ba._role_rows(rows),'ROLE_FIDELITY_PROFILE_UNSUPPORTED')
        self.assertEqual(rows,before)

    def test_BACKUP_RECOVERY_V2_001_null(self):self.accepted(None)
    def test_BACKUP_RECOVERY_V2_002_empty(self):self.accepted([])
    def test_BACKUP_RECOVERY_V2_003_timeout(self):self.accepted(['statement_timeout=3s'])
    def test_BACKUP_RECOVERY_V2_004_single_schema(self):self.accepted(['search_path=app'])
    def test_BACKUP_RECOVERY_V2_005_two_schemas(self):self.accepted(['search_path=decoy, app'])
    def test_BACKUP_RECOVERY_V2_006_search_first(self):self.accepted(['search_path=decoy, app','statement_timeout=3s'])
    def test_BACKUP_RECOVERY_V2_007_timeout_first(self):self.accepted(['statement_timeout=3s','search_path=decoy, app'])
    def test_BACKUP_RECOVERY_V2_008_identifier_limit(self):self.accepted(['search_path='+'a'*63])

    def test_BACKUP_RECOVERY_V2_009_search_grammar(self):
        for value in ['', ' app','app ','app,decoy','app,  decoy','app, app','app, decoy, third',
                      ', app','app, ','"app"','"a""b"','App','한글','a'*64,'app\x00','app\n',
                      'app\t','app; RESET ROLE','app,\tdecoy','app\\decoy']:
            with self.subTest(value=value):self.rejected(['search_path='+value])

    def test_BACKUP_RECOVERY_V2_010_reserved_components(self):
        for value in ['$user','pg_catalog','pg_temp','pg_x','information_schema',
                      'app, pg_catalog','information_schema, app']:
            with self.subTest(value=value):self.rejected(['search_path='+value])

    def test_BACKUP_RECOVERY_V2_011_unknown_gucs(self):
        for value in ['role=anything','session_authorization=anything','work_mem=1MB','search_path','SEARCH_PATH=app']:
            with self.subTest(value=value):self.rejected([value])

    def test_BACKUP_RECOVERY_V2_012_duplicate_keys(self):
        for value in [['search_path=app','search_path=decoy'],['statement_timeout=3s','statement_timeout=4s']]:
            with self.subTest(value=value):self.rejected(value)

    def test_BACKUP_RECOVERY_V2_013_container_types_and_cardinality(self):
        for value in [['search_path=app','statement_timeout=3s','work_mem=1MB'],[None],[1],[True],
                      'search_path=app',('search_path=app',),{'search_path':'app'},False]:
            with self.subTest(value=value):self.rejected(value)

    def test_BACKUP_RECOVERY_V2_014_database_specific_rejected(self):
        self.accepted(['search_path=app'])
        self.ba._unsupported_families(copy.deepcopy(self.f.extras))
        extra=copy.deepcopy(self.f.extras)
        extra['databaseRoleSettings']=[['postgres','postgres',['search_path=app']]]
        self.deny(lambda:self.ba._unsupported_families(extra),'ROLE_FIDELITY_PROFILE_UNSUPPORTED')
        self.assertEqual(extra['databaseRoleSettings'][0][2],['search_path=app'])

    def test_BACKUP_RECOVERY_V2_015_candidate_a_preserves_settings(self):
        raw=(b'-- immutable prefix\r\nCREATE ROLE fixture_bootstrap;\r\n'
             b'ALTER ROLE fixture_bootstrap SET search_path TO decoy, app;\r\n'
             b'CREATE ROLE ordinary;\r\nALTER ROLE ordinary SET search_path TO app;\r\n')
        before=bytes(raw);derived,receipt=self.derive(raw);again,second=self.derive(raw)
        start=receipt['removedSpan']['startByteInclusive'];end=receipt['removedSpan']['endByteExclusive']
        self.assertEqual(receipt['matchCount'],1);self.assertEqual(raw,before)
        self.assertEqual(raw[start:end],b'CREATE ROLE fixture_bootstrap;')
        self.assertEqual(derived,raw[:start]+raw[end:])
        for statement in [b'ALTER ROLE fixture_bootstrap SET search_path TO decoy, app;',b'ALTER ROLE ordinary SET search_path TO app;']:
            self.assertEqual(raw.count(statement),1);self.assertEqual(derived.count(statement),1)
        self.assertEqual(receipt['prefixSha256'],sha(raw[:start]));self.assertEqual(receipt['suffixSha256'],sha(raw[end:]))
        self.assertEqual(derived,again);self.assertEqual(receipt['derivedSha256'],sha(derived))
        self.assertEqual(receipt,second)

    def test_BACKUP_RECOVERY_V2_016_current_identity(self):
        self.assertEqual(self.ba.RECOVERY_CANDIDATE,'SOURCE_ALIGNED_BOOTSTRAP_AWARE_STAGED_RESTORE_V4')
        self.assertEqual(self.ba.RECOVERY_VERSION,4)
        self.assertEqual(self.ba.ROLE_CONFIG_PROFILE,'ROLE_CONFIG_PROFILE_SEARCH_PATH_V1')
        self.assertEqual(self.ba.ROLE_CONFIG_PROFILE_VERSION,1)
        self.assertEqual(self.ba.ROLES_PROFILE,'PG17_6_ASCII_ROLES_BOUNDARY_V1')

    def test_BACKUP_RECOVERY_V2_017_artifact_identity_and_shape(self):
        root=self.f.write(self.root);manifest=self.f.validate(root)
        provenance=json.loads((root/self.ba.PROVENANCE_PATH).read_bytes())
        restore=json.loads((root/'metadata/restore.json').read_bytes())
        for value,version_key in [(manifest,'recoveryCandidateVersion'),(provenance,'recoveryCandidateVersion'),(restore,'recoveryContractVersion')]:
            self.assertEqual(value['recoveryCandidateName'],self.ba.RECOVERY_CANDIDATE)
            self.assertEqual(value[version_key],self.ba.RECOVERY_VERSION)
        self.assertEqual(manifest['reportVersion'],'exact-single-backup/3')
        self.assertEqual(set(manifest['files']),self.ba.REQUIRED_FILES);self.assertEqual(len(manifest['files']),9)
        self.assertEqual(restore['contract'],'exact-single-owned-restore/3')
        self.assertEqual(provenance['contract'],'backup-source-bootstrap-provenance/2')
        self.assertEqual(provenance['schemaVersion'],2)

    def artifact_tamper(self,case,changes):
        root=self.f.write(self.root/case);mp=root/'metadata/manifest.json';manifest=json.loads(mp.read_bytes())
        for name,fields in changes:
            if name=='metadata/manifest.json':manifest.update(fields);continue
            path=root/name;value=json.loads(path.read_bytes());value.update(fields)
            path.write_bytes(canonical(value)+b'\n')
            manifest['files'][name]={'sha256':sha(path.read_bytes()),'bytes':path.stat().st_size}
        if any(name==self.ba.PROVENANCE_PATH for name,_ in changes):
            info=manifest['files'][self.ba.PROVENANCE_PATH]
            manifest['sourceBootstrapProvenance']=dict(path=self.ba.PROVENANCE_PATH,contract=self.ba.PROVENANCE_CONTRACT,**info)
            path=root/'metadata/restore.json';restore=json.loads(path.read_bytes())
            restore['sourceBootstrapProvenanceSha256']=info['sha256']
            restore['rolesDerivationReceipt']['sourceBootstrapProvenanceSha256']=info['sha256']
            path.write_bytes(canonical(restore)+b'\n')
            manifest['files']['metadata/restore.json']={'sha256':sha(path.read_bytes()),'bytes':path.stat().st_size}
        # Refresh outer file binding so a candidate mismatch, not a stale file hash, is tested.
        mp.write_bytes(canonical(manifest)+b'\n')
        self.deny(lambda:self.f.validate(root))

    def test_BACKUP_RECOVERY_V2_018_v1_name_rejected(self):
        for index,name in enumerate(['metadata/manifest.json',self.ba.PROVENANCE_PATH,'metadata/restore.json']):
            with self.subTest(name=name):
                self.artifact_tamper(str(index),[(name,{'recoveryCandidateName':'SOURCE_ALIGNED_BOOTSTRAP_AWARE_STAGED_RESTORE_V1'})])

    def test_BACKUP_RECOVERY_V2_019_v1_version_rejected(self):
        for index,(name,key) in enumerate([('metadata/manifest.json','recoveryCandidateVersion'),
                (self.ba.PROVENANCE_PATH,'recoveryCandidateVersion'),('metadata/restore.json','recoveryContractVersion')]):
            with self.subTest(name=name):self.artifact_tamper(str(index),[(name,{key:1})])

    def test_BACKUP_RECOVERY_V2_020_consistent_v1_has_no_fresh_fallback(self):
        old='SOURCE_ALIGNED_BOOTSTRAP_AWARE_STAGED_RESTORE_V1'
        self.artifact_tamper('all-old',[(name,{'recoveryCandidateName':old,key:1}) for name,key in [
            ('metadata/manifest.json','recoveryCandidateVersion'),(self.ba.PROVENANCE_PATH,'recoveryCandidateVersion'),
            ('metadata/restore.json','recoveryContractVersion')]])

    def configured_stage(self,superuser):
        owner=self.f.bootstrap if superuser else 'configured_stage_owner'
        role=copy.deepcopy(self.f.bootstrap_row if superuser else self.f.postgres_row)
        role[0]=owner;role[1]=superuser;role[5]=True
        role[10]=(['statement_timeout=3s','search_path=decoy, app'] if superuser else
                  ['search_path=decoy, app','statement_timeout=3s'])
        expected=copy.deepcopy(self.f.expected)
        if superuser:expected['roles']=[role if r[0]==owner else r for r in expected['roles']]
        else:expected['roles'].append(role)
        before=copy.deepcopy(expected);extension=copy.deepcopy(self.f.ext)
        extension['extensions'][0][3]=owner;extension['plpgsqlLanguage'][1]=owner
        for row in extension['implementation']:row[3]=owner
        prerequisites=copy.deepcopy(self.f.provenance['sourceRestorePrerequisites'])
        prerequisites['plpgsqlExpectedState']=extension
        state={k:copy.deepcopy(expected[k]) for k in ['roles','memberships']}
        state['roles'].append(list(self.ba.OWNED_RESTORE_ADMIN_TUPLE))
        target=next(r for r in state['roles'] if r[0]==owner);outer=self
        class Transport:
            def __init__(self):self.sql=[];self.role_changes=[]
            def _sql(self,raw,kind):
                self.sql.append(raw)
                if raw.startswith(b'ALTER ROLE '):
                    outer.assertIn(raw,[(f'ALTER ROLE "{owner}" SUPERUSER;').encode(),(f'ALTER ROLE "{owner}" NOSUPERUSER;').encode()])
                    target[1]=raw.endswith(b' SUPERUSER;');self.role_changes.append(copy.deepcopy(target))
                return b''
            def _json(self,query,kind):
                if query==outer.ba.PLPGSQL_SQL:return copy.deepcopy(extension)
                if query==outer.ba.DATABASE_ACL_SQL:return copy.deepcopy(outer.f.database)
                if query==outer.ba.ROLE_STATE_SQL:return copy.deepcopy(state)
                if query==outer.ba.FOOTPRINT_SQL:return []
                raise AssertionError('unexpected measurement')
        transport=Transport();result=self.ba._staged_plpgsql(transport,expected,prerequisites)
        self.assertEqual(expected,before);self.assertEqual(target,role);self.assertEqual(result['finalOwnerTuple'],role)
        self.assertEqual(result['temporaryPrivilegeUsed'],not superuser)
        self.assertEqual([r[1] for r in transport.role_changes],[] if superuser else [True,False])
        for changed in transport.role_changes:self.assertEqual(changed[:1]+changed[2:],role[:1]+role[2:])
        raw=b'\n'.join(transport.sql)
        self.assertIn(b'DROP EXTENSION plpgsql RESTRICT;',raw)
        self.assertIn((f'SET ROLE "{owner}"; CREATE EXTENSION plpgsql WITH SCHEMA pg_catalog VERSION \'1.0\'; RESET ROLE;').encode(),raw)
        for forbidden in [b'SET search_path',b'RESET search_path',b'LOGIN',b'CASCADE']:self.assertNotIn(forbidden,raw)

    def test_BACKUP_RECOVERY_V2_021_configured_nonsuper_stage(self):self.configured_stage(False)
    def test_BACKUP_RECOVERY_V2_022_configured_super_bootstrap_stage(self):self.configured_stage(True)

    def test_BACKUP_RECOVERY_V2_023_configured_e6_target(self):
        owner='configured_stage_owner';role=copy.deepcopy(self.f.postgres_row)
        role[0]=owner;role[10]=['search_path=decoy, app'];self.ba._role_rows([role])
        expected={'roles':[role],'relations':[
            ['app','owner_probe','r',owner,[owner+'=arwdDxtm/'+owner],False,False,None],
            ['decoy','owner_probe','r',owner,None,False,False,None]],'namespaces':[]}
        restored=copy.deepcopy(expected);restored['relations'][0][4]=None
        before=copy.deepcopy((expected,restored));sql=self.ba._acl_supplement(expected,restored)
        self.assertEqual(sql,[f'SET ROLE "{owner}"; GRANT ALL ON TABLE "app"."owner_probe" TO "{owner}"; RESET ROLE;'])
        self.assertNotIn('"decoy"."owner_probe"','\n'.join(sql));self.assertNotIn('SET search_path','\n'.join(sql))
        self.assertEqual((expected,restored),before)

    def test_BACKUP_RECOVERY_V2_024_timeout_domain_unchanged(self):
        for value in ['0','3ms','3s','3min','3h','3d']:
            with self.subTest(value=value):self.accepted(['statement_timeout='+value])
        for value in ['3.5s',' 3s','3 s','3sec','-1','+3','3s\n']:
            with self.subTest(value=value):self.rejected(['statement_timeout='+value])

    def test_BACKUP_RECOVERY_V2_025_role_gate_preserves_config_order(self):
        expected=copy.deepcopy(self.f.expected)
        expected['roles'][1][10]=['search_path=decoy, app','statement_timeout=3s']
        actual={k:copy.deepcopy(expected[k]) for k in ['roles','memberships']}
        actual['roles'].append(list(self.ba.OWNED_RESTORE_ADMIN_TUPLE))
        self.ba._role_gate(actual,expected)
        actual['roles'][1][10].reverse()
        self.deny(lambda:self.ba._role_gate(actual,expected),'OWNED_ROLE_REPLAY_INCOMPLETE')



class RecoveryV3Facts(RecoveryV1Facts):
    """Complete pure fixed-extension input, independent of a running PostgreSQL."""
    def __init__(self):
        super().__init__()
        ba=self.ba;owner=self.bootstrap;state={k:[] for k in ba._EXTENSION_FAMILIES}
        for family in ['extensions','members']:
            state[family]=[dict(copy.deepcopy(row),owner=owner) for row in ba._EXTENSION_TEMPLATE[family]]
        for row in state['members']:
            if row['class'] not in ('pg_proc','pg_type'):continue
            key=[row['extension'],row['class'],row['identity']]
            state['rawAcl'].append(key+[owner,None])
            privilege='EXECUTE' if row['class']=='pg_proc' else 'USAGE'
            for grantee in ['PUBLIC',owner]:state['expandedAcl'].append(key+[owner,grantee,privilege,False])
            for role in self.expected['roles']:state['effective'].append(key+[role[0],True])
        self.expected['extensions']=sorted(self.ext['extensions']+[
            [r['name'],r['version'],r['schema'],r['owner']] for r in state['extensions']])
        self.extension_state=state
        self.extension_guard={'owners':[['extension',r[0],r[3]] for r in self.expected['extensions']]+[['language','plpgsql','postgres']],
            'acls':[['language','plpgsql',None]],'expandedAcl':None,'extensionMembers':None,'databaseOwner':owner}
        self.rebuild_provenance()


class RecoveryV3IntegrationFixture(RecoveryV1IntegrationFixture):
    """Generic configured owner plus fixed extensions; source construction only."""
    def fixture_sql(self):
        return list(super().fixture_sql())+[
            "CREATE SCHEMA extensions; CREATE EXTENSION btree_gist WITH SCHEMA public VERSION '1.7'; "
            "CREATE EXTENSION pgcrypto WITH SCHEMA extensions VERSION '1.3'; "
            "CREATE EXTENSION \"uuid-ossp\" WITH SCHEMA extensions VERSION '1.1';",
            "ALTER ROLE postgres LOGIN; ALTER ROLE postgres SET search_path TO decoy, app; "
            "CREATE SCHEMA app AUTHORIZATION postgres; CREATE SCHEMA decoy AUTHORIZATION postgres; "
            "SET ROLE postgres; CREATE TABLE app.owner_probe(id integer PRIMARY KEY,value integer NOT NULL); "
            "INSERT INTO app.owner_probe VALUES (1,19),(2,23); GRANT ALL ON TABLE app.owner_probe TO postgres; "
            "CREATE TABLE decoy.owner_probe(id integer PRIMARY KEY,value integer NOT NULL); "
            "INSERT INTO decoy.owner_probe VALUES (1,900); "
            "CREATE FUNCTION app.configured_probe() RETURNS integer LANGUAGE plpgsql AS "
            "'BEGIN RETURN (SELECT sum(value)::integer FROM app.owner_probe); END'; RESET ROLE;"
        ]

    def oracle(self,s,normalize=False):
        import backup_adapter as ba
        value=super().oracle(s,normalize)
        value['extraExtensions']=ba._read_json(s,ba.EXTENSION_SQL)
        value['configuredOwnerResult']=ba._read_json(s,'SELECT to_jsonb(app.configured_probe());')
        for schema in ['app','decoy']:
            value[schema+'OwnerProbe']=ba._read_json(s,
                "SELECT jsonb_build_object('owner',pg_get_userbyid(c.relowner),'acl',c.relacl,"
                "'rows',(SELECT jsonb_agg(jsonb_build_array(id,value) ORDER BY id) FROM "+schema+".owner_probe)) "
                "FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace "
                "WHERE n.nspname='"+schema+"' AND c.relname='owner_probe';")
        return value


class RecoveryV3Focused(unittest.TestCase):
    """F2C IDs 001-056: implementation definitions, fresh execution is separate."""
    setUp=RecoveryV1Focused.setUp
    deny=RecoveryV1Focused.deny
    artifact_tamper=RecoveryV2ProfileFocused.artifact_tamper

    def fixed(self):return RecoveryV3Facts()
    def check(self,f):
        return self.ba._extension_prerequisite(f.provenance['sourceRestorePrerequisites']['extensionRecoveryExpectedState'],
                                             f.expected,self.ba._identity(f.response()))
    def state_check(self,f,state):return self.ba._extension_state(state,f.expected,self.ba._identity(f.response()))
    def reject_state(self,mutate):
        f=self.fixed();state=copy.deepcopy(f.extension_state);mutate(state)
        self.deny(lambda:self.state_check(f,state),'SOURCE_RECOVERY_PROFILE_UNSUPPORTED')
    def guard_check(self,f,guard,branch='BOOTSTRAP_OWNED_FIXED_EXTENSION_SET'):
        return self.ba._extension_guard(guard,f.expected,branch)
    def receipt_check(self,f,receipt):
        return self.ba._validate_extension_receipt(receipt,f.provenance,f.expected,self.ba._identity(f.response()),f.full)
    def fixed_guard(self,kind):
        f=self.fixed();g=copy.deepcopy(f.extension_guard);owner=f.bootstrap
        ident={'column':'s.t.c','database':'postgres','language':'plpgsql','default':'10001'}.get(kind,'item')
        if kind=='language':owner='postgres'
        else:g['acls'].append([kind,ident,None])
        g['expandedAcl']=[[kind,ident,owner,'PUBLIC','SELECT',False]]
        if kind=='column':
            f.expected['relations']=[['s','t','r',owner,None]];f.expected['columns']=[['s','t','c']]
            g['owners'].append(['relation','s.t',owner]);g['acls'].append(['relation','s.t',None])
        elif kind=='relation':
            ident='s.t';g['acls'][-1][1]=ident;g['expandedAcl'][0][1]=ident
            f.expected['relations']=[['s','t','r',owner,None]];g['owners'].append([kind,ident,owner])
        elif kind not in ('database','language'):g['owners'].append([kind,ident,owner])
        if kind=='namespace':f.expected['namespaces']=[[ident,owner,None]]
        return f,g

    def test_BACKUP_RECOVERY_V3_001_plpgsql_only_branch(self):
        self.assertEqual(self.check(self.f),'PLPGSQL_ONLY')
        self.assertTrue(all(x==[] for x in self.f.extension_state.values()))

    def test_BACKUP_RECOVERY_V3_002_fixed_set_shared(self):
        f=self.fixed();self.assertEqual(self.check(f),'BOOTSTRAP_OWNED_FIXED_EXTENSION_SET')
        self.assertEqual(len(f.extension_state['members']),310)
        # Encoding is a bootstrap gate, not an extension-profile name heuristic.
        response=f.response();response.update(serverEncoding='SQL_ASCII',clientEncoding='SQL_ASCII')
        self.assertEqual(self.ba._extension_state(f.extension_state,f.expected,self.ba._identity(response)),self.check(f))

    def test_BACKUP_RECOVERY_V3_003_fixed_set_renamed_bootstrap(self):
        f=self.fixed();self.assertNotEqual(f.bootstrap,'postgres');self.check(f)
        self.assertTrue(all(r['owner']==f.bootstrap for r in f.extension_state['members']))

    def test_BACKUP_RECOVERY_V3_004_partial_extension_set_rejected(self):
        for size in [1,2]:
            with self.subTest(size=size):self.reject_state(lambda s:s.update(extensions=s['extensions'][:size]))

    def test_BACKUP_RECOVERY_V3_005_unknown_extension_rejected(self):
        self.reject_state(lambda s:s['extensions'].append(dict(s['extensions'][0],name='unknown')))

    def test_BACKUP_RECOVERY_V3_006_wrong_version_rejected(self):
        self.reject_state(lambda s:s['extensions'][0].update(version='1.8'))

    def test_BACKUP_RECOVERY_V3_007_wrong_schema_rejected(self):
        self.reject_state(lambda s:s['extensions'][0].update(schema='elsewhere'))
        self.reject_state(lambda s:s['members'][0].update(schema='elsewhere'))

    def test_BACKUP_RECOVERY_V3_008_dependencies_or_config_rejected(self):
        for field,value in [('dependencies',['unknown']),('configTables',['public.secret']),('conditions',['true'])]:
            with self.subTest(field=field):self.reject_state(lambda s:s['extensions'][0].update({field:value}))

    def test_BACKUP_RECOVERY_V3_009_extension_owner_rejected(self):
        self.reject_state(lambda s:s['extensions'][0].update(owner='postgres'))

    def test_BACKUP_RECOVERY_V3_010_member_owner_rejected(self):
        for family in ['pg_proc','pg_type','pg_operator','pg_opclass','pg_opfamily']:
            for owner in [None,'postgres']:
                with self.subTest(family=family,owner=owner):
                    self.reject_state(lambda s:next(r for r in s['members'] if r['class']==family).update(owner=owner))

    def test_BACKUP_RECOVERY_V3_011_same_count_identity_tamper(self):
        self.reject_state(lambda s:s['members'][0].update(identity='public.wrong USING gist'))

    def test_BACKUP_RECOVERY_V3_012_same_count_structure_tamper(self):
        for family in ['pg_proc','pg_type','pg_operator','pg_opclass','pg_opfamily']:
            with self.subTest(family=family):
                self.reject_state(lambda s:next(r for r in s['members'] if r['class']==family)['structure'].update(unreviewed=True))

    def test_BACKUP_RECOVERY_V3_013_missing_extra_duplicate_members(self):
        self.reject_state(lambda s:s['members'].pop())
        self.reject_state(lambda s:s['members'].append(copy.deepcopy(s['members'][0])))
        self.reject_state(lambda s:s['members'].__setitem__(1,copy.deepcopy(s['members'][0])))

    def test_BACKUP_RECOVERY_V3_014_unsupported_class_or_subid(self):
        for field,value in [('class','pg_class'),('subid',1),('subid',False)]:
            with self.subTest(field=field,value=value):self.reject_state(lambda s:s['members'][0].update({field:value}))

    def test_BACKUP_RECOVERY_V3_015_bad_bootstrap_identity(self):
        f=self.fixed();identity=self.ba._identity(f.response())
        for value in [11,True,'10']:
            with self.subTest(value=value):self.deny(lambda:self.ba._extension_state(f.extension_state,f.expected,dict(identity,bootstrapOid=value)))
        f.expected['roles'][0][1]=False;self.deny(lambda:self.state_check(f,f.extension_state))

    def test_BACKUP_RECOVERY_V3_016_function_acl_null_explicit_order(self):
        f=self.fixed();state=copy.deepcopy(f.extension_state);row=next(r for r in state['rawAcl'] if r[1]=='pg_proc')
        row[4]=[f.bootstrap+'=X/'+f.bootstrap,'=X/'+f.bootstrap]
        before=copy.deepcopy(state);self.state_check(f,state);self.assertEqual(state,before)
        row[4].reverse();reversed_state=copy.deepcopy(state);self.state_check(f,state);self.assertEqual(state,reversed_state)
        self.assertNotEqual(state,before);self.state_check(f,f.extension_state)

    def test_BACKUP_RECOVERY_V3_017_function_acl_grantor(self):
        self.reject_state(lambda s:s['expandedAcl'][0].__setitem__(3,'postgres'))

    def test_BACKUP_RECOVERY_V3_018_function_acl_grantee(self):
        for role in ['unknown',self.ba.OWNED_RESTORE_ADMIN]:
            with self.subTest(role=role):self.reject_state(lambda s:s['expandedAcl'][0].__setitem__(4,role))
        f=self.fixed();self.state_check(f,f.extension_state)

    def test_BACKUP_RECOVERY_V3_019_function_acl_privilege_option(self):
        self.reject_state(lambda s:s['expandedAcl'][0].__setitem__(5,'SELECT'))
        self.reject_state(lambda s:s['expandedAcl'][0].__setitem__(6,True))

    def test_BACKUP_RECOVERY_V3_020_type_acl_domain(self):
        self.reject_state(lambda s:next(r for r in s['rawAcl'] if r[1]=='pg_type').__setitem__(4,[]))
        self.reject_state(lambda s:next(r for r in s['expandedAcl'] if r[1]=='pg_type').__setitem__(5,'EXECUTE'))

    def test_BACKUP_RECOVERY_V3_021_raw_acl_key_coverage(self):
        self.assertEqual(len(self.fixed().extension_state['rawAcl']),246)
        self.reject_state(lambda s:s['rawAcl'].pop())
        self.reject_state(lambda s:s['rawAcl'].append(copy.deepcopy(s['rawAcl'][0])))

    def test_BACKUP_RECOVERY_V3_022_expanded_acl_shape_duplicates(self):
        self.reject_state(lambda s:s['expandedAcl'].append(copy.deepcopy(s['expandedAcl'][0])))
        self.reject_state(lambda s:s['expandedAcl'][0].pop())
        self.reject_state(lambda s:s['expandedAcl'][0].__setitem__(2,'unknown'))

    def test_BACKUP_RECOVERY_V3_023_effective_complete_roles(self):
        self.reject_state(lambda s:s['effective'].pop())
        self.reject_state(lambda s:s['effective'].append(copy.deepcopy(s['effective'][0])))
        self.reject_state(lambda s:s['effective'][0].__setitem__(4,1))
        self.reject_state(lambda s:s['effective'][0].__setitem__(3,self.ba.OWNED_RESTORE_ADMIN))

    def test_BACKUP_RECOVERY_V3_024_nonowner_guard_families(self):
        for kind in ['namespace','relation','column','function','type','default','language','database']:
            with self.subTest(kind=kind):
                f,g=self.fixed_guard(kind);self.guard_check(f,g)
                g['expandedAcl'][0][2]=f.bootstrap if kind=='language' else 'postgres'
                self.deny(lambda:self.guard_check(f,g),'SOURCE_RECOVERY_PROFILE_UNSUPPORTED')

    def test_BACKUP_RECOVERY_V3_025_guard_ambiguous_owner(self):
        f,g=self.fixed_guard('column');self.guard_check(f,g)
        bad=copy.deepcopy(g);bad['owners'].append(copy.deepcopy(bad['owners'][-1]));self.deny(lambda:self.guard_check(f,bad))
        f.expected['columns'].append(['s.t','c','d']);self.deny(lambda:self.guard_check(f,g))
        f,g=self.fixed_guard('function');g['owners'].pop();self.deny(lambda:self.guard_check(f,g))

    def test_BACKUP_RECOVERY_V3_026_guard_empty_null_and_legacy_branch(self):
        self.check(self.f);self.assertIsNone(self.f.extension_guard['expandedAcl'])
        f,g=self.fixed_guard('function');g['expandedAcl'][0][2]='postgres'
        before=copy.deepcopy(g);self.guard_check(f,g,'PLPGSQL_ONLY');self.assertEqual(g,before)
        self.deny(lambda:self.guard_check(f,g),'SOURCE_RECOVERY_PROFILE_UNSUPPORTED')

    def test_BACKUP_RECOVERY_V3_027_initial_privileges_policy(self):
        f=self.fixed();changed=copy.deepcopy(f.extension_state);r=changed['rawAcl'][0]
        changed['initialPrivileges']=[dict(extension=r[0],**{'class':r[1]},identity=r[2],subid=0,origin='e',raw=None,expanded=None)]
        envelope=f.provenance['sourceRestorePrerequisites']['extensionRecoveryExpectedState']
        report=self.ba._extension_report(envelope,changed,changed,f.expected,self.ba._identity(f.response()),[])
        self.assertEqual(report['postE4State']['initialPrivileges'],changed['initialPrivileges'])
        values={k:f.provenance['sourceRestorePrerequisites'][k] for k in ['plpgsqlExpectedState','databaseAclBeforeCapture','unsupportedRoleFamilies','extensionRecoveryExpectedState']}
        after=copy.deepcopy(values);after['extensionRecoveryExpectedState']['extensionState']=changed
        self.deny(lambda:self.ba._build_provenance(f.measurement('PRE'),f.measurement('POST'),values,after,[],f.expected,f.roles,f.proofs,f.context),'SOURCE_BOOTSTRAP_DRIFT')

    def test_BACKUP_RECOVERY_V3_028_readers_exact_bytes(self):
        self.assertEqual((len(self.ba.EXTENSION_SQL.encode()),sha(self.ba.EXTENSION_SQL.encode())),(6904,'3b13300cc4a9c9743662f545ef1a7209065ae041978b35b77e85a5b91d1489c3'))
        self.assertEqual((len(self.ba.SOURCE_COUNTERPART_SQL.encode()),sha(self.ba.SOURCE_COUNTERPART_SQL.encode())),(4647,'8b67c8b94d8fd545da865c8b917949e44734383420cbcba89932517218a89f45'))
        self.assertEqual(sha(canonical(self.ba._EXTENSION_TEMPLATE['members'])),'94973a91d86278263d9df63d6d5ca821046a5a0b00925b0e71ecdad540d090a4')
        self.assertEqual(sha(canonical(self.ba._EXTENSION_TEMPLATE['extensions'])),'7d74d4614900098d1361e6e9d5f02fdae8f7b4a302dda9bdb424cbc9e3810b30')

    def test_BACKUP_RECOVERY_V3_029_ten_bindings_exact(self):
        qb=self.f.provenance['sourceRestorePrerequisites']['queryBindings']
        self.assertEqual([(x['phase'],x['key']) for x in qb],[(p,k) for p in ['PRE','POST'] for k,_ in self.ba._prerequisite_queries()])
        self.assertEqual(len(qb),10);self.f.validate(self.f.write(self.root))

    def test_BACKUP_RECOVERY_V3_030_binding_missing_extra_duplicate(self):
        for operation in ['missing','extra','duplicate','phase']:
            with self.subTest(operation=operation):
                p=copy.deepcopy(self.f.provenance);qb=p['sourceRestorePrerequisites']['queryBindings']
                if operation=='missing':qb.pop()
                elif operation=='extra':qb.append(copy.deepcopy(qb[0]))
                elif operation=='duplicate':qb[-1]=copy.deepcopy(qb[0])
                else:qb[0]['phase']='POST'
                self.deny(lambda:self.ba._validate_provenance(p,self.f.expected,self.f.roles,self.f.bundle))

    def test_BACKUP_RECOVERY_V3_031_source_envelope_drift(self):
        f=self.fixed();values={k:f.provenance['sourceRestorePrerequisites'][k] for k in ['plpgsqlExpectedState','databaseAclBeforeCapture','unsupportedRoleFamilies','extensionRecoveryExpectedState']}
        changed=copy.deepcopy(values);changed['extensionRecoveryExpectedState']['archiveAclContextGuard']['databaseOwner']='postgres'
        self.deny(lambda:self.ba._build_provenance(f.measurement('PRE'),f.measurement('POST'),values,changed,[],f.expected,f.roles,f.proofs,f.context),'SOURCE_BOOTSTRAP_DRIFT')

    def test_BACKUP_RECOVERY_V3_032_source_transport_target_binding(self):
        for field in ['querySha256','canonicalResponseSha256','transportProofRef']:
            with self.subTest(field=field):
                p=copy.deepcopy(self.f.provenance);p['sourceRestorePrerequisites']['queryBindings'][3][field]='wrong'
                self.deny(lambda:self.ba._validate_provenance(p,self.f.expected,self.f.roles,self.f.bundle))

    def test_BACKUP_RECOVERY_V3_033_bootstrap_role_argv(self):
        f=self.fixed();identity=self.ba._identity(f.response());identity['bootstrapName']='a"b'
        argv=self.ba._restore_argv('uply-runner-i1-'+'a'*32,self.check(f),identity)
        self.assertEqual(argv[-4:],['--role','a"b','-d','postgres'])
        self.assertEqual(argv.count('--role'),1);self.assertNotIn('sh',argv)

    def test_BACKUP_RECOVERY_V3_034_plpgsql_only_original_argv(self):
        argv=self.ba._restore_argv('uply-runner-i1-'+'0'*32,self.check(self.f),self.identity)
        self.assertEqual(argv,['exec','-i','uply-runner-i1-'+'0'*32,'pg_restore','--exit-on-error','-h','/tmp','-U',self.ba.OWNED_RESTORE_ADMIN,'-d','postgres'])

    def test_BACKUP_RECOVERY_V3_035_single_archive_invocation(self):
        d=BackupDiagnostics('test_BACKUP_DIAG_11_body_and_cleanup');d.setUp();self.addCleanup(d.doCleanups)
        _,error,_,_=d.local_simulation();self.assertIsNone(error)
        calls=[c for c in d.calls if c[1]=='OWNED_PG_RESTORE'];self.assertEqual(len(calls),1)
        self.assertEqual(calls[0][3]['input'],b'PGDMPowned')
        self.assertIn('--exit-on-error',calls[0][2]);self.assertNotIn('--no-owner',calls[0][2]);self.assertNotIn('--no-acl',calls[0][2])

    def test_BACKUP_RECOVERY_V3_036_e4_receipt_truthful_identity(self):
        f=self.fixed();r=f.restore_report();self.receipt_check(f,r)
        c=r['restoreExecutionContext'];self.assertEqual(c['startupEffectiveRole'],f.bootstrap)
        self.assertEqual(c['identityEvidenceKind'],'ARGV_AND_PINNED_PG17_6_CLIENT_STARTUP_SEMANTICS')
        self.assertEqual(c['authenticatedRole'],self.ba.OWNED_RESTORE_ADMIN)
        self.assertNotIn('backendPid',c);self.assertNotIn('observedCurrentUser',c)

    def test_BACKUP_RECOVERY_V3_037_e5_failure_before_supplement(self):
        # Existing test-local session fixture, not a validation-driver override.
        d=BackupDiagnostics('test_BACKUP_DIAG_11_body_and_cleanup');d.setUp();self.addCleanup(d.doCleanups)
        original=self.ba._read_json
        def read(s,q):
            value=original(s,q)
            if q==self.ba.EXTENSION_SQL and d.mt._LOCAL_DIAGNOSTIC.get().phase=='E5':value['unexpected']=True
            return value
        with patch.object(self.ba,'_read_json',side_effect=read):_,error,_,_=d.local_simulation()
        self.assertIsInstance(error,Failure);self.assertFalse(any(c[0]=='E6' and c[1]=='OWNED_SUPPLEMENT_SQL' for c in d.calls))
        self.assertEqual(sum(c[1]=='OWNED_STOP' for c in d.calls),1)

    def test_BACKUP_RECOVERY_V3_038_e7_mismatch_rejected(self):
        f=self.fixed();r=f.restore_report();r['extensionValidation']['finalState']['effective'][0][4]=False
        self.deny(lambda:self.receipt_check(f,r),'RESTORE_CATALOG_OR_COUNTS_MISMATCH')

    def test_BACKUP_RECOVERY_V3_039_typed_transport_leaks(self):
        for family,index in [('rawAcl',3),('expandedAcl',3),('expandedAcl',4)]:
            with self.subTest(family=family,index=index):self.reject_state(lambda s:s[family][0].__setitem__(index,self.ba.OWNED_RESTORE_ADMIN))
        self.reject_state(lambda s:s['members'][0].update(owner=self.ba.OWNED_RESTORE_ADMIN))

    def test_BACKUP_RECOVERY_V3_040_all_previous_gates_preserved(self):
        d=BackupDiagnostics('test_BACKUP_DIAG_11_body_and_cleanup');d.setUp();self.addCleanup(d.doCleanups)
        _,error,_,_=d.local_simulation(mismatch=True);self.assertEqual(error.code,'RESTORE_CATALOG_OR_COUNTS_MISMATCH')
        state=self.f.actual_roles();state['memberships']=[[self.f.bootstrap,self.ba.OWNED_RESTORE_ADMIN,self.f.bootstrap,False,True,True]]
        self.deny(lambda:self.ba._role_gate(state,self.f.expected),'OWNED_RESTORE_ADMIN_MEMBERSHIP_FOOTPRINT')

    def test_BACKUP_RECOVERY_V3_041_configured_staged_branches(self):
        RecoveryV2ProfileFocused.configured_stage(self,False)
        RecoveryV2ProfileFocused.configured_stage(self,True)

    def test_BACKUP_RECOVERY_V3_042_e6_decoy_unmodified(self):
        RecoveryV2ProfileFocused.test_BACKUP_RECOVERY_V2_023_configured_e6_target(self)

    def test_BACKUP_RECOVERY_V3_043_provenance2_rebuild(self):
        f=self.fixed();identity=self.ba._validate_provenance(f.provenance,f.expected,f.roles,f.bundle)
        self.assertEqual(identity['bootstrapName'],f.bootstrap)
        self.assertEqual(f.provenance['contract'],'backup-source-bootstrap-provenance/2')
        self.assertEqual(f.provenance['schemaVersion'],2);self.assertEqual(f.provenance['recoveryCandidateVersion'],self.ba.RECOVERY_VERSION)

    def test_BACKUP_RECOVERY_V3_044_restore2_recompute(self):
        f=self.fixed();r=f.restore_report();self.receipt_check(f,r)
        r['extensionValidation']['rawAclExact']=False;self.deny(lambda:self.receipt_check(f,r))
        r=f.restore_report();r['extensionValidation']['postE4State']['rawAcl'].pop();self.deny(lambda:self.receipt_check(f,r))

    def test_BACKUP_RECOVERY_V3_045_archive_hash_tamper(self):
        f=self.fixed();r=f.restore_report();r['restoreExecutionContext']['archiveInputSha256']='0'*64
        self.deny(lambda:self.receipt_check(f,r))

    def test_BACKUP_RECOVERY_V3_046_argv_hash_branch_tamper(self):
        f=self.fixed()
        for field,value in [('branch','PLPGSQL_ONLY'),('argvSha256','0'*64),('returnCode',True),('profileVersion',True)]:
            with self.subTest(field=field):
                r=f.restore_report();r['restoreExecutionContext'][field]=value;self.deny(lambda:self.receipt_check(f,r))
        r=f.restore_report();r['restoreExecutionContext']['argv'][-3]='postgres';self.deny(lambda:self.receipt_check(f,r))

    def test_BACKUP_RECOVERY_V3_047_v2_fresh_rejected(self):
        self.artifact_tamper('old',[(n,{'recoveryCandidateName':'SOURCE_ALIGNED_BOOTSTRAP_AWARE_STAGED_RESTORE_V2',k:2}) for n,k in [
            ('metadata/manifest.json','recoveryCandidateVersion'),(self.ba.PROVENANCE_PATH,'recoveryCandidateVersion'),('metadata/restore.json','recoveryContractVersion')]])

    def test_BACKUP_RECOVERY_V3_048_manifest3_nine_files(self):
        f=self.fixed();root=f.write(self.root);m=f.validate(root)
        self.assertEqual(m['reportVersion'],'exact-single-backup/3');self.assertEqual(len(m['files']),9)
        self.assertEqual(m['recoveryReportContract'],'exact-single-owned-restore/3')
        self.assertEqual(m['sourceBootstrapProvenance']['contract'],'backup-source-bootstrap-provenance/2')

    def test_BACKUP_RECOVERY_V3_049_privacy_diagnostics(self):
        import maintenance_transport as mt
        codes=['SOURCE_RECOVERY_PROFILE_UNSUPPORTED','SOURCE_BOOTSTRAP_DRIFT','RESTORE_CATALOG_OR_COUNTS_MISMATCH']
        self.assertTrue(set(codes)<=mt._DIAGNOSTIC_CODES)
        for code in codes:
            self.assertNotIn('SELECT',code);self.assertNotIn('PASSWORD',code)
        self.assertFalse(self.f.provenance['measurementBefore']['rawResponseAvailable'])
        self.assertIsNone(self.f.provenance['measurementBefore']['rawResponseSha256'])
        root=self.f.write(self.root);self.assertEqual((root/self.ba.PROVENANCE_PATH).stat().st_mode&0o777,0o600)

    def test_BACKUP_RECOVERY_V3_050_failure_cleanup_and_retention(self):
        d=BackupDiagnostics('test_BACKUP_DIAG_11_body_and_cleanup');d.setUp();self.addCleanup(d.doCleanups)
        _,error,value,_=d.local_simulation(('E4','OWNED_PG_RESTORE'))
        self.assertIsInstance(error,Failure);self.assertIsNone(value)
        self.assertEqual(sum(c[1]=='OWNED_PG_RESTORE' for c in d.calls),1)
        self.assertEqual(sum(c[1]=='OWNED_STOP' for c in d.calls),1)

    def test_BACKUP_RECOVERY_V3_051_shared_actual_path(self):
        with fixture.Fixture() as f:
            p,a=f.plan();directory=f.backup(p,a)
            self.ba.validate_backup(p,a,f.transport)
            report=json.loads((directory/'metadata/restore.json').read_bytes())
            self.assertEqual(report['restoreExecutionContext']['branch'],'BOOTSTRAP_OWNED_FIXED_EXTENSION_SET')
            self.assertEqual(report['restoreExecutionContext']['startupEffectiveRole'],'postgres')
            self.assertEqual(report['footprint'],[]);self.assertTrue(report['extensionValidation']['rawAclExact'])
            self.assertEqual(report['cleanup'],'OWNED_CONTAINER_REMOVED')

    def test_BACKUP_RECOVERY_V3_052_generic_actual_path(self):
        with RecoveryV3IntegrationFixture() as f:
            result=f.run();self.assertTrue(result['fullFidelity']);self.assertTrue(result['ordinaryPostgresCreatedByReplay'])
            report=result['restore'];self.assertEqual(report['restoreExecutionContext']['startupEffectiveRole'],f.bootstrap)
            self.assertTrue(report['stagedPlpgsqlValidation']['temporaryPrivilegeUsed'])
            self.assertGreater(report['aclSupplementCount'],0)
            self.assertEqual(f.source_oracle['configuredOwnerResult'],42)
            self.assertEqual(f.destination_oracle['appOwnerProbe'],f.source_oracle['appOwnerProbe'])
            self.assertEqual(f.destination_oracle['decoyOwnerProbe'],f.source_oracle['decoyOwnerProbe'])

    def test_BACKUP_RECOVERY_V3_053_empty_branch_actual_path(self):
        with RecoveryV1IntegrationFixture() as f:
            result=f.run();self.assertTrue(result['fullFidelity'])
            c=result['restore']['restoreExecutionContext'];self.assertEqual(c['branch'],'PLPGSQL_ONLY')
            self.assertNotIn('--role',c['argv'])

    def test_BACKUP_RECOVERY_V3_054_schema_readers_tamper(self):
        for field in ['profileName','profileVersion','measurementCoverage']:
            with self.subTest(field=field):
                p=copy.deepcopy(self.f.provenance);p['sourceRestorePrerequisites']['extensionRecoveryExpectedState'][field]='bad'
                self.deny(lambda:self.ba._validate_provenance(p,self.f.expected,self.f.roles,self.f.bundle))
        f=self.fixed();r=f.restore_report();r['extensionValidation']['extra']=True;self.deny(lambda:self.receipt_check(f,r))

    def test_BACKUP_RECOVERY_V3_055_profile_no_mutation(self):
        f=self.fixed();before=copy.deepcopy((f.provenance,f.expected,f.extension_state))
        self.check(f);self.receipt_check(f,f.restore_report())
        self.assertEqual((f.provenance,f.expected,f.extension_state),before)
        self.assertEqual(self.ba.ROLE_CONFIG_PROFILE,'ROLE_CONFIG_PROFILE_SEARCH_PATH_V1')
        self.assertEqual(self.ba.ROLES_PROFILE,'PG17_6_ASCII_ROLES_BOUNDARY_V1')

    def test_BACKUP_RECOVERY_V3_056_package_and_external_binding(self):
        f=self.fixed();root=f.write(self.root);m=sha((root/'metadata/manifest.json').read_bytes())
        for field in ['expected_package_digest','expected_plan_sha','expected_target_sha','expected_authorization_sha']:
            with self.subTest(field=field):
                args=dict(expected_package_digest=f.context['operationalPackageDigest'],expected_plan_sha=f.plan.digest,
                          expected_target_sha=f.context['sourceIdentitySha256'],expected_authorization_sha=f.context['authorizationSha256'])
                args[field]='0'*64;self.deny(lambda:self.ba.validate_recovery_artifacts(root,m,**args))


class RecoveryV4Facts(RecoveryV1Facts):
    """Independent finite DB ACL fixtures; synthetic private artifacts only."""
    def __init__(self,grantees=None):
        super().__init__()
        if grantees is not None:
            owner=self.bootstrap
            for g in dict.fromkeys(grantees):
                if g not in [r[0] for r in self.expected['roles']]:
                    self.expected['roles'].append([g,False,True,False,False,False,False,False,-1,None,None])
                    self.roles+=('CREATE ROLE '+self.ba._restore_identifier(g)+';\n').encode()
            self.expected['roles'].sort(key=lambda r:r[0])
            self.database['aclRaw']='{=Tc/'+owner+','+owner+'=CTc/'+owner+''.join(','+g+'=C/'+owner for g in grantees)+'}'
            self.database['effectiveAcl']=sorted(self.database['effectiveAcl']+[[owner,g,'CREATE',False] for g in grantees])
            self.proofs['roles']=self.proof('roles');self.bundle['records']['roles']={k:self.proofs['roles'][k] for k in ['proof','sha256']}
            self.rebuild_provenance()


class RecoveryV4IntegrationFixture(RecoveryV3IntegrationFixture):
    """Source-only additions; capture and restore use the actual current adapter."""
    def fixture_sql(self):
        return super().fixture_sql()+[
            'CREATE ROLE acl_grantee_z NOLOGIN; CREATE ROLE acl_grantee_a NOLOGIN; '
            'GRANT CREATE ON DATABASE postgres TO acl_grantee_z; GRANT CREATE ON DATABASE postgres TO acl_grantee_a;']

    def oracle(self,s,normalize=False):
        value=super().oracle(s,normalize)
        import backup_adapter as ba
        value['databaseEffectiveProbes']=ba._read_json(s,
            "SELECT jsonb_agg(jsonb_build_array(r.rolname,p.priv,has_database_privilege(r.rolname,'postgres',p.priv)) "
            "ORDER BY r.rolname,p.priv) FROM pg_roles r CROSS JOIN (VALUES ('CREATE'),('CONNECT'),('TEMPORARY')) p(priv) "
            "WHERE r.rolname IN ('acl_grantee_z','acl_grantee_a');")
        return value


class RecoveryV4Focused(unittest.TestCase):
    """DB_ACL_DESIGN_001–026 and 034–038; no historical IDs are replaced."""
    setUp=RecoveryV1Focused.setUp
    deny=RecoveryV1Focused.deny

    def facts(self,grantees=('grantee_z','grantee_a')):return RecoveryV4Facts(list(grantees) if grantees is not None else None)
    def profile(self,f,state=None):return self.ba._database_acl_profile(f.database if state is None else state,self.ba._identity(f.response()),f.expected['roles'])
    def plan(self,f):return self.ba._database_acl_plan(f.database,self.ba._identity(f.response()),f.expected['roles'],sha(canonical(f.provenance)+b'\n'),sha(f.full))
    def reject(self,change,code='SOURCE_DATABASE_ACL_PROFILE_UNSUPPORTED'):
        f=self.facts();v=copy.deepcopy(f.database);change(v)
        self.deny(lambda:self.profile(f,v),code)

    def transport(self,f,*,before=None,after=None,identity=None,error=None):
        from unittest.mock import Mock
        p=self.plan(f);t=Mock()
        t._json.side_effect=[copy.deepcopy(p['baseline'] if before is None else before),copy.deepcopy(f.database if after is None else after)]
        t._sql.side_effect=error
        t._sql.return_value=canonical(identity if identity is not None else {'session_user':self.ba.OWNED_RESTORE_ADMIN,'current_user':f.bootstrap,'database':'postgres'})+b'\n'
        return t

    def test_BACKUP_RECOVERY_V4_001_null_default(self):
        f=self.facts(None);original=copy.deepcopy(f.database);p=self.profile(f)
        self.assertEqual(p['branch'],'NULL_DEFAULT');self.assertEqual(p['orderedGrantees'],[]);self.assertEqual(p['baseline'],original);self.assertEqual(f.database,original)

    def test_BACKUP_RECOVERY_V4_002_one_create(self):
        f=self.facts(['grantee_a']);self.assertEqual(self.profile(f)['orderedGrantees'],['grantee_a'])

    def test_BACKUP_RECOVERY_V4_003_two_order(self):
        f=self.facts();before=copy.deepcopy(f.database);self.assertEqual(self.profile(f)['orderedGrantees'],['grantee_z','grantee_a']);self.assertEqual(before,f.database)

    def test_BACKUP_RECOVERY_V4_004_shared_names_not_whitelist(self):
        for names in [('supabase_etl_admin','supabase_storage_admin'),('ordinary_z','ordinary_a')]:
            with self.subTest(names=names):self.assertEqual(self.profile(self.facts(names))['orderedGrantees'],list(names))

    def test_BACKUP_RECOVERY_V4_005_identifier_bounds(self):
        self.assertEqual(self.profile(self.facts(['a'*63]))['orderedGrantees'],['a'*63])
        for name in ['a'*64,'"quoted"','한글','bad\nname','Upper']:
            with self.subTest(name=name):self.reject(lambda s:s.update(aclRaw=s['aclRaw'].replace('grantee_z=',name+'=')))

    def test_BACKUP_RECOVERY_V4_006_response_shape(self):
        f=self.facts()
        for value in [None,[],[f.database],[f.database,f.database],{},dict(f.database,extra=1),dict(f.database,aclRaw=[]),dict(f.database,effectiveAcl=None)]:
            with self.subTest(value=value):
                self.deny(lambda:self.ba._database_acl_profile(value,self.ba._identity(f.response()),f.expected['roles']),
                          'DATABASE_ACL_QUERY_RESPONSE_INVALID')

    def test_BACKUP_RECOVERY_V4_007_owner_and_resolution(self):
        self.reject(lambda s:s.update(owner='postgres'))
        self.reject(lambda s:s.update(aclRaw=s['aclRaw'].replace('grantee_z=','missing=')))
        self.reject(lambda s:s.update(aclRaw=s['aclRaw'].replace('grantee_z=','grantee_a=')))

    def test_BACKUP_RECOVERY_V4_008_database(self):self.reject(lambda s:s.update(name='other'))

    def test_BACKUP_RECOVERY_V4_009_default_prefix(self):
        self.reject(lambda s:s.update(aclRaw=s['aclRaw'].replace('=Tc/','=CTc/')))
        f=self.facts();parts=f.database['aclRaw'][1:-1].split(',');parts[:2]=parts[1::-1]
        self.deny(lambda:self.profile(f,dict(f.database,aclRaw='{'+','.join(parts)+'}')),'SOURCE_DATABASE_ACL_PROFILE_UNSUPPORTED')

    def test_BACKUP_RECOVERY_V4_010_explicit_default_rejected(self):
        f=self.facts(None);owner=f.bootstrap
        for raw in ['{}','{=Tc/'+owner+','+owner+'=CTc/'+owner+'}']:
            with self.subTest(raw=raw):self.deny(lambda:self.profile(f,dict(f.database,aclRaw=raw)),'SOURCE_DATABASE_ACL_PROFILE_UNSUPPORTED')

    def test_BACKUP_RECOVERY_V4_011_suffix_cardinality(self):
        f=self.facts();owner=f.bootstrap
        for tail in ['grantee_z=C/'+owner+',grantee_a=C/'+owner+',postgres=C/'+owner,'grantee_z=C/'+owner+',grantee_z=C/'+owner,owner+'=C/'+owner]:
            with self.subTest(tail=tail):self.deny(lambda:self.profile(f,dict(f.database,aclRaw='{=Tc/'+owner+','+owner+'=CTc/'+owner+','+tail+'}')),'SOURCE_DATABASE_ACL_PROFILE_UNSUPPORTED')

    def test_BACKUP_RECOVERY_V4_012_rights_and_grantor(self):
        for token in ['=c/','=T/','=C*/','=CTc/']:
            with self.subTest(token=token):self.reject(lambda s:s.update(aclRaw=s['aclRaw'].replace('=C/',token)))
        self.reject(lambda s:s.update(aclRaw=s['aclRaw'].replace('grantee_z=C/fixture_bootstrap','grantee_z=C/postgres')))

    def test_BACKUP_RECOVERY_V4_013_expanded_shape(self):
        self.reject(lambda s:s['effectiveAcl'].pop())
        self.reject(lambda s:s['effectiveAcl'].append(s['effectiveAcl'][0]))
        self.reject(lambda s:s['effectiveAcl'][0].__setitem__(3,0),'DATABASE_ACL_QUERY_RESPONSE_INVALID')
        self.reject(lambda s:s['effectiveAcl'][0].__setitem__(3,True))

    def test_BACKUP_RECOVERY_V4_014_transport_and_public(self):
        for name in [self.ba.OWNED_RESTORE_ADMIN,'PUBLIC']:
            f=self.facts();f.expected['roles'].append([name,False,True,False,False,False,False,False,-1,None,None])
            self.deny(lambda:self.profile(f),'SOURCE_DATABASE_ACL_PROFILE_UNSUPPORTED')

    def test_BACKUP_RECOVERY_V4_015_source_bytes_and_sql_order(self):
        f=self.facts();before=canonical(f.database);roles=bytes(f.roles);p=self.plan(f)
        self.assertEqual(canonical(f.database),before);self.assertEqual(f.roles,roles)
        self.assertLess(p['derivedSql'].index('TO "grantee_z"'),p['derivedSql'].index('TO "grantee_a"'))
        self.assertEqual(p['derivedSqlSha256'],sha(p['derivedSql'].encode()));self.assertEqual(p['derivedSqlBytes'],len(p['derivedSql'].encode()))

    def test_BACKUP_RECOVERY_V4_016_exact_quoted_batch(self):
        f=self.facts(['grantee_a']);sql=self.plan(f)['derivedSql']
        expected='SET ROLE "fixture_bootstrap";\n'+"SELECT pg_catalog.jsonb_build_object('session_user',session_user,'current_user',current_user,'database',pg_catalog.current_database());\n"+'GRANT CREATE ON DATABASE "postgres" TO "grantee_a";\nRESET ROLE;\n'
        self.assertEqual(sql,expected)
        for bad in ['CREATE DATABASE','DROP DATABASE','REVOKE','GRANT ALL','BEGIN','SET search_path']:self.assertNotIn(bad,sql)

    def test_BACKUP_RECOVERY_V4_017_stdin_binding(self):
        f=self.facts();p=self.plan(f);p['derivedSql']+=' ';t=self.transport(f)
        self.deny(lambda:self.ba._database_acl_replay(t,p),'DATABASE_ACL_STDIN_SHA_MISMATCH');t._sql.assert_not_called()

    def test_BACKUP_RECOVERY_V4_018_noop_zero_execution(self):
        f=self.facts(None);p=self.plan(f);t=self.transport(f);r=self.ba._database_acl_replay(t,p)
        self.assertEqual(p['derivedSql'],'');self.assertEqual(p['derivedSqlSha256'],sha(b''));self.assertEqual(r['executionCount'],0);self.assertIsNone(r['actualStdinSha256']);t._sql.assert_not_called();self.assertEqual(t._json.call_count,2)

    def test_BACKUP_RECOVERY_V4_019_phase_order(self):
        d=BackupDiagnostics('test_BACKUP_DIAG_11_body_and_cleanup');d.setUp();self.addCleanup(d.doCleanups)
        _,error,report,_=d.local_simulation(supplement=True);self.assertIsNone(error)
        phases=[r[0] for r in d.calls];self.assertLess(phases.index('E6'),phases.index('E6_DB_ACL'));self.assertLess(phases.index('E6_DB_ACL'),phases.index('E7'))
        e4=[r for r in d.calls if r[1]=='OWNED_PG_RESTORE'];self.assertEqual(len(e4),1);self.assertIn('--exit-on-error',e4[0][2]);self.assertNotIn('--create',e4[0][2])
        e6=[r[3]['input'] for r in d.calls if r[1]=='OWNED_SUPPLEMENT_SQL'];self.assertEqual(e6,[b'SET ROLE "postgres"; GRANT ALL ON SCHEMA "synthetic" TO "postgres"; RESET ROLE;'])
        self.assertEqual(report['phaseResults']['E6_DB_ACL'],'PASS')

    def test_BACKUP_RECOVERY_V4_020_unexpected_baseline(self):
        f=self.facts();p=self.plan(f)
        for bad in [f.database,dict(p['baseline'],owner='postgres')]:
            t=self.transport(f,before=bad);self.deny(lambda:self.ba._database_acl_replay(t,p),'DESTINATION_DATABASE_ACL_BASELINE_MISMATCH');t._sql.assert_not_called()

    def test_BACKUP_RECOVERY_V4_021_failure_cleanup_no_retry(self):
        f=self.facts();t=self.transport(f,error=Failure('VERIFY_FAILED','DOCKER_OPERATION_FAILED'))
        self.deny(lambda:self.ba._database_acl_replay(t,self.plan(f)),'DATABASE_ACL_REPLAY_FAILED');self.assertEqual(t._sql.call_count,1);self.assertEqual(t._json.call_count,1)
        d=BackupDiagnostics('test_BACKUP_DIAG_11_body_and_cleanup');d.setUp();self.addCleanup(d.doCleanups)
        with patch.object(self.ba,'_database_acl_replay',side_effect=Failure('BACKUP_FAILED','DATABASE_ACL_REPLAY_FAILED')):
            _,error,result,_=d.local_simulation()
        self.assertEqual(error.code,'DATABASE_ACL_REPLAY_FAILED');self.assertIsNone(result);self.assertEqual(sum(r[1]=='OWNED_STOP' for r in d.calls),1);self.assertFalse(any(r[0]=='E7' for r in d.calls))

    def test_BACKUP_RECOVERY_V4_022_execution_identity(self):
        f=self.facts()
        for who in [{'session_user':'postgres','current_user':f.bootstrap,'database':'postgres'},{'session_user':self.ba.OWNED_RESTORE_ADMIN,'current_user':self.ba.OWNED_RESTORE_ADMIN,'database':'postgres'}]:
            t=self.transport(f,identity=who);self.deny(lambda:self.ba._database_acl_replay(t,self.plan(f)),'DATABASE_ACL_EXECUTION_IDENTITY_MISMATCH');self.assertEqual(t._sql.call_count,1)

    def test_BACKUP_RECOVERY_V4_023_post_drift(self):
        f=self.facts();bad=copy.deepcopy(f.database);bad['effectiveAcl'].pop()
        for value in [dict(f.database,aclRaw=None),bad]:
            t=self.transport(f,after=value);self.deny(lambda:self.ba._database_acl_replay(t,self.plan(f)),'DATABASE_ACL_FIDELITY_MISMATCH')

    def test_BACKUP_RECOVERY_V4_024_final_drift(self):
        f=self.facts();p=self.plan(f);execution=self.ba._database_acl_replay(self.transport(f),p)
        self.deny(lambda:self.ba._database_acl_report(p,execution,p['baseline']),'DATABASE_ACL_FIDELITY_MISMATCH')

    def test_BACKUP_RECOVERY_V4_025_staged_default_separate(self):
        f=self.facts();self.f=f;original=copy.deepcopy(f.database);baseline=self.plan(f)['baseline']
        t=RecoveryV1Focused.stage_transport(self);f.database=copy.deepcopy(baseline)
        r=self.ba._staged_plpgsql(t,f.expected,f.provenance['sourceRestorePrerequisites']);f.database=original
        self.assertEqual(r['databaseBefore'],baseline);self.assertEqual(r['databaseAfter'],baseline);self.assertNotEqual(r['databaseAfter'],f.provenance['sourceRestorePrerequisites']['databaseAclBeforeCapture'])

    def test_BACKUP_RECOVERY_V4_026_diagnostic_scope(self):
        import maintenance_transport as mt
        self.assertEqual(mt._DIAGNOSTIC_PHASES['E6_DB_ACL'],{'OWNED_INSPECT','OWNED_DATABASE_ACL_STATE','OWNED_DATABASE_ACL_SQL'})
        d=BackupDiagnostics('test_BACKUP_DIAG_11_body_and_cleanup');d.setUp();self.addCleanup(d.doCleanups);rec=d.recorder()
        with rec.active(),mt._diagnostic_phase('E6_DB_ACL'):
            with self.assertRaises(Failure),mt._diagnostic_operation('OWNED_SUPPLEMENT_SQL'):pass
        self.assertIn('DATABASE_ACL_REPLAY_FAILED',mt._DIAGNOSTIC_CODES)
        self.assertTrue(all('GRANT ' not in code for code in mt._DIAGNOSTIC_CODES))

    def test_BACKUP_RECOVERY_V4_034_shared_sql_ascii_actual(self):
        with fixture.Fixture() as f:
            p,a=f.plan();directory=f.backup(p,a);self.ba.validate_backup(p,a,f.transport)
            r=json.loads((directory/'metadata/restore.json').read_bytes());d=r['databaseAclRecovery']
            self.assertEqual(d['grantCount'],2);self.assertEqual(d['orderedGrantees'],['supabase_etl_admin','supabase_storage_admin'])
            self.assertEqual(d['sourceState'],d['afterState']);self.assertEqual(d['sourceState'],d['finalState'])
            self.assertEqual(json.loads((directory/self.ba.PROVENANCE_PATH).read_bytes())['serverEncoding'],'SQL_ASCII')

    def test_BACKUP_RECOVERY_V4_035_generic_combined_actual(self):
        with RecoveryV4IntegrationFixture() as f:
            result=f.run();r=result['restore'];self.assertTrue(result['fullFidelity']);self.assertTrue(r['stagedPlpgsqlValidation']['temporaryPrivilegeUsed'])
            self.assertGreater(r['aclSupplementCount'],0);self.assertEqual(r['databaseAclRecovery']['orderedGrantees'],['acl_grantee_z','acl_grantee_a'])
            self.assertEqual(f.source_oracle['decoyOwnerProbe'],f.destination_oracle['decoyOwnerProbe']);self.assertEqual(r['databaseAclRecovery']['sourceState'],r['databaseAclRecovery']['finalState'])

    def test_BACKUP_RECOVERY_V4_036_plpgsql_null_actual(self):
        with RecoveryV1IntegrationFixture() as f:
            r=f.run()['restore'];d=r['databaseAclRecovery'];self.assertEqual(d['branch'],'NULL_DEFAULT');self.assertEqual(d['executionCount'],0);self.assertEqual(d['grantCount'],0)
            self.assertIsNone(d['sourceState']['aclRaw']);self.assertIsNone(d['finalState']['aclRaw']);self.assertEqual(r['restoreExecutionContext']['branch'],'PLPGSQL_ONLY')

    def test_BACKUP_RECOVERY_V4_037_cleanup_footprint_actual(self):
        with RecoveryV4IntegrationFixture() as f:
            r=f.run()['restore'];self.assertEqual(r['footprint'],[]);self.assertEqual(r['cleanup'],'OWNED_CONTAINER_REMOVED');self.assertEqual(r['ownedCleanup']['ownedContainersRemaining'],0)
            self.assertTrue(all(self.ba.OWNED_RESTORE_ADMIN not in row[:2] for row in r['databaseAclRecovery']['finalState']['effectiveAcl']))

    def test_BACKUP_RECOVERY_V4_038_effective_database_privileges_actual(self):
        with RecoveryV4IntegrationFixture() as f:
            result=f.run();self.assertTrue(result['fullFidelity']);rows=f.source_oracle['databaseEffectiveProbes']
            self.assertEqual(rows,f.destination_oracle['databaseEffectiveProbes']);self.assertEqual(len(rows),6);self.assertTrue(all(row[2] is True for row in rows))
            self.assertTrue(all(not row[1] for row in f.source_oracle['catalog']['roles'] if row[0] in ['acl_grantee_z','acl_grantee_a']))
            self.assertEqual(result['restore']['databaseAclRecovery']['sourceState'],result['restore']['databaseAclRecovery']['finalState'])


if __name__=='__main__':unittest.main(verbosity=2)
