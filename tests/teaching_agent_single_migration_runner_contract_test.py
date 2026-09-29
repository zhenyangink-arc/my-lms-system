import copy
import contextlib
import io
import json
# Register fork reducers against real socket types before scoped capability denials.
import multiprocessing
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/teaching-agent-r7d-c3b'))
from receipts import Failure,sha,canonical,safe_file,strict_json,exclusive,sanitized
from plan_contract import Plan,load_plan,registry,authorize,package_hashes,below,OPS
from transaction import reviewed_body,top_level_guard
from maintenance_transport import validate_identity,MaintenanceTransport,OwnedTransport,IMAGE_ID


def ready():
    p=copy.deepcopy(load_plan('acl-000-v1').data)
    p['targetProfile']='OWNED_ISOLATED_FIXTURE';p['status']='READY_FOR_INSTALL';p['ledger']['sourcePrefixSha256']='a'*64
    raw=canonical(p);return Plan(raw,sha(raw),_fixture=True)


def auth_for(p):
    from plan_contract import AUTH_FIELDS
    a={k:None for k in AUTH_FIELDS};a.update(contract='exact-single-operator-authorization/1',scope='SINGLE_MIGRATION_APPLY',
    planId=p.data['planId'],planSha256=p.digest,migrationVersion=p.data['migration']['version'],migrationSha256=p.migration['rawSha256'],
    packageHashes=package_hashes(),targetProfile=p.data['targetProfile'],observedAt=time.time()-1,expiresAt=time.time()+800,
    operatorUid=os.getuid(),userApprovalRef='OWNED_ONLY',userApprovalSha256='1'*64,nonce='2'*32,
    ledgerDescriptorSha256='3'*64,catalogBeforeSha256='4'*64)
    return a


class Contract(unittest.TestCase):
    def reject_plan(self,d):
        raw=canonical(d)
        with self.assertRaises(Failure):Plan(raw,sha(raw),_fixture=True)

    def test_RUNNER_D1_01(self):
        p=ready();p.ensure_ready();self.assertEqual(len(p.data['preflightChecks']),5)
        p.source()

    def test_RUNNER_D1_02(self):
        for key,value in [('planVersion','unknown'),('status','AUTO_APPROVED'),('extra',1)]:
            d=copy.deepcopy(ready().data);d[key]=value;self.reject_plan(d)
        for phase in ['preflightChecks','postconditionChecks']:
            d=copy.deepcopy(ready().data);d[phase].pop();self.reject_plan(d)
            d=copy.deepcopy(ready().data);d[phase][0]['parameters']['sql']='select 1';self.reject_plan(d)
            d=copy.deepcopy(ready().data);d[phase][0]['checkId']='unknown/1';self.reject_plan(d)
        with self.assertRaises(Failure):load_plan('unknown')
        with self.assertRaises(Failure):strict_json(b'{"x":1,"x":2}')

    def test_RUNNER_D1_03(self):
        p=ready()
        for raw in [p.raw+b'\n',json.dumps(p.data,indent=2).encode()]:
            with self.assertRaises(Failure):Plan(raw,p.digest,_fixture=True)
        raw,body=p.source()
        with self.assertRaises(Failure):reviewed_body(raw+b' ',p.migration)
        with self.assertRaises(Failure):reviewed_body(raw.replace(b'REVOKE',b'GRANT '),p.migration)

    def test_RUNNER_D1_04(self):
        for flags in [['--sql','select 1'],['--file','/tmp/a.sql'],['--force'],['--dsn','bad'],['--plan','../escape'],['--plan','acl-000-v1','--version','202609180001']]:
            r=subprocess.run([sys.executable,'-B',str(OPS/'runner.py'),'apply',*flags],capture_output=True)
            self.assertNotEqual(r.returncode,0)
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'a').write_text('x');(root/'link').symlink_to(root/'a')
            for path in ['../escape','/tmp/escape','link']:
                with self.assertRaises(Failure):below(root,path)
        d=copy.deepcopy(ready().data);d['migration']['path']='/tmp/a.sql';self.reject_plan(d)

    def test_RUNNER_D1_05(self):
        p=ready();raw,_=p.source()
        for key,value in [('bodyStartByteInclusive',169),('bodyEndByteExclusive',4030),('bodySha256','0'*64)]:
            spec=copy.deepcopy(p.migration);spec[key]=value
            with self.assertRaises(Failure):reviewed_body(raw,spec)
        for key in ['version','name','path']:
            d=copy.deepcopy(p.data);d['migration'][key]='wrong';self.reject_plan(d)

    def test_RUNNER_D1_06(self):
        p=ready();a=auth_for(p);authorize(p,a,'SINGLE_MIGRATION_APPLY')
        for key,value in [('userApprovalRef',''),('userApprovalSha256','bad'),('operatorUid',-1),('expiresAt',0),('observedAt',time.time()+5),('scope','anything'),('planSha256','5'*64)]:
            bad=copy.deepcopy(a);bad[key]=value
            with self.assertRaises(Failure):authorize(p,bad,'SINGLE_MIGRATION_APPLY')
        d=copy.deepcopy(p.data);d['createdFromApproval']['sha256']='0'*64;self.reject_plan(d)

    def test_RUNNER_D1_07(self):
        p=ready();a=auth_for(p)
        for name in ['plan_registry.json','transaction.py','checks.py','maintenance_transport.py']:
            bad=copy.deepcopy(a);bad['packageHashes'][name]='0'*64
            with self.assertRaises(Failure):authorize(p,bad,'SINGLE_MIGRATION_APPLY')

    def test_RUNNER_D1_08(self):
        import runner
        p=load_plan('acl-000-v1');p.ensure_ready()
        self.assertEqual(p.data['status'],'READY_FOR_INSTALL')
        draft=production_capture_draft()
        with self.assertRaises(Failure) as caught:draft.ensure_ready()
        self.assertEqual(caught.exception.code,'DRAFT_NOT_EXECUTABLE')
        d=copy.deepcopy(ready().data);d['ledger']['sourcePrefixSha256']=None;self.reject_plan(d)
        with patch('maintenance_transport.safe_file',side_effect=AssertionError('credential access forbidden')):
            with self.assertRaises(Failure):MaintenanceTransport(p,{},'SINGLE_MIGRATION_APPLY')
        for mode in ['READ_ONLY_PREFLIGHT','BACKUP_READ_EXPORT','SINGLE_MIGRATION_APPLY','READ_ONLY_VERIFY']:
            with self.assertRaises(Failure) as caught:authorize(p,{},mode)
            self.assertEqual(caught.exception.code,'AUTH_SCHEMA')
        # Explicit draft negatives cannot depend on the now-sealed registered plan.
        for command in ['preflight','backup','apply','verify']:
            output=io.StringIO()
            with patch.object(runner,'load_plan',return_value=draft),patch.object(runner,'safe_file',side_effect=AssertionError('credential access forbidden')),contextlib.redirect_stdout(output):
                self.assertEqual(runner.main([command,'--plan','acl-000-v1']),1)
            result=json.loads(output.getvalue());self.assertEqual(result['code'],'DRAFT_NOT_EXECUTABLE')
            self.assertFalse(result['nextMigrationAllowed'])
        self.assertEqual(load_plan('acl-000-v1').digest,p.digest)
        self.assertEqual(set(registry()['plans']),{'acl-000-v1'})

    def test_RUNNER_D1_09(self):
        for sql in [b'BEGIN;',b'COMMIT;',b'ROLLBACK;',b'\\i file',b'CREATE INDEX CONCURRENTLY a ON b(c);',b'VACUUM;',b'ALTER SYSTEM SET x=1;',b'CREATE DATABASE a;',b'COPY x TO PROGRAM \'x\';',b'CALL anything();',b'/* unclosed',b"select 'unclosed"]:
            with self.subTest(sql=sql):
                with self.assertRaises(Failure):top_level_guard(sql)
        top_level_guard(b"DO $$ BEGIN PERFORM 1; END $$; -- COMMIT\n")

    def test_RUNNER_D1_10(self):
        for spec in registry()['migrations'].values():
            raw=safe_file(ROOT/spec['path']);body=reviewed_body(raw,spec)
            self.assertEqual(body,raw[spec['bodyStartByteInclusive']:spec['bodyEndByteExclusive']])
            self.assertEqual(sha(body),spec['bodySha256'])

    def test_RUNNER_D1_29(self):
        e={'database':'postgres','role':'postgres','currentRole':'postgres','serverMajor':17,'targetProfile':'uply-canonical-maintenance/1','imageId':IMAGE_ID,
           'projectIdentitySha256':'a'*64,'hostIdentitySha256':'b'*64,'sslmode':'verify-full','fixture':False}
        validate_identity(e,e)
        for key in e:
            a=copy.deepcopy(e);a[key]='wrong'
            with self.assertRaises(Failure):validate_identity(a,e)
        with self.assertRaises(Failure):validate_identity(dict(e,roleExpiry='2000-01-01T00:00:00+00:00'),e)

    def test_RUNNER_D1_30(self):
        p=ready();a=auth_for(p)
        with self.assertRaises(Failure):MaintenanceTransport(p,a,'SINGLE_MIGRATION_APPLY')
        with self.assertRaises(Failure):OwnedTransport('production')
        raw=canonical(p.data)
        with self.assertRaises(Failure):Plan(raw,sha(raw))

    def test_RUNNER_D1_32(self):
        for cls in [MaintenanceTransport,OwnedTransport]:
            self.assertFalse(hasattr(cls,'execute_sql'));self.assertFalse(hasattr(cls,'execute'))
        # Read-only production-mode handles reject an attempted upgrade before any
        # credential access, even when reached through the private Python seam.
        t=MaintenanceTransport.__new__(MaintenanceTransport);t._mode='READ_ONLY_PREFLIGHT'
        with self.assertRaises(Failure):
            with t._session(False):pass
        from maintenance_transport import ENV
        self.assertFalse(any(k.startswith('PG') for k in ENV))
        with patch.dict(os.environ,{'PGHOST':'evil','PGSERVICE':'evil','PGPASSWORD':'fixture-only'}):
            self.assertFalse(any(k.startswith('PG') for k in ENV))

    def test_RUNNER_D1_33(self):
        for name in ['plans/acl-000-v1.json','plan_registry.json','target_profiles.json']:
            raw=(OPS/name).read_text()
            self.assertNotIn('OWNED_ISOLATED_FIXTURE',raw);self.assertNotIn('postgresql://',raw)
        sample={'password':'test secret','DSN':'postgresql://u:p@x/db','text':'Authorization: Bearer x','jwt':'eyJabc.def.ghi','safe':'service_role'}
        redacted=sanitized(sample)
        self.assertEqual(redacted['safe'],'service_role')
        self.assertNotIn('test secret',json.dumps(redacted));self.assertNotIn('eyJabc',json.dumps(redacted))

    def test_RUNNER_D1_49(self):
        for item in registry()['readOnlyLocks']:
            self.assertEqual(sha(safe_file(ROOT/item['path'])),item['sha256'],item['path'])
        for name in ['runner.py','maintenance_transport.py','transaction.py']:
            src=(OPS/name).read_text();self.assertNotIn('teaching-agent-r5b',src);self.assertNotIn('import runner as',src)

    def test_RUNNER_D1_50(self):
        for spec in registry()['migrations'].values():self.assertEqual(sha(safe_file(ROOT/spec['path'])),spec['rawSha256'])
        expected={'candidate-build.tar.gz':'e07842159615a0cf37c3c52be72fa9495e5fce488328e22ff2408edc8c7ac746','candidate-full-source.tar.gz':'2d65c3a1845991ceccc6d7a31f818cbdf1457cd95499a5eb86e4ba440e14be18','candidate-deploy-source-closure.tar.gz':'abc5476de4de20aae253a2a9046419bce0b5894968d95f100cd72dab4f5690e2'}
        import hashlib
        for n,digest in expected.items():
            h=hashlib.sha256()
            with (ROOT/'build/r7dc3a-production-candidate'/n).open('rb') as f:
                for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
            self.assertEqual(h.hexdigest(),digest)


def capture_auth(p):
    from plan_contract import CAPTURE_FIELDS, CAPTURE_MODE, PROFILE_PATH, CAPTURE_APPROVAL
    profile=strict_json(safe_file(PROFILE_PATH))['profiles']['uply-canonical-maintenance/1']
    a={k:None for k in CAPTURE_FIELDS}
    a.update(contract='readonly-baseline-capture-authorization/'+('1' if p.fixture else '2'),scope=CAPTURE_MODE,
             planId=p.data['planId'],planSha256=p.digest,migrationSha256=p.migration['rawSha256'],
             bodySha256=p.migration['bodySha256'],packageHashes=package_hashes(),
             targetProfile=p.data['targetProfile'],observedAt=time.time()-1,expiresAt=time.time()+800,
             operatorUid=os.getuid(),explicitCaptureAuthorization=True,nonce='d'*32,
             userApprovalRef='OWNED_ISOLATED_FIXTURE' if p.fixture else CAPTURE_APPROVAL,
             userApprovalSha256=sha(b'OWNED_ISOLATED_FIXTURE') if p.fixture else sha(b'approval-test-only'),
             credentialIdentitySha256=None if p.fixture else 'c'*64)
    a['targetIdentity']={'database':'postgres','role':'postgres','currentRole':'postgres','serverMajor':17,
        'targetProfile':p.data['targetProfile'],'imageId':IMAGE_ID,'fixture':p.fixture,
        'sslmode':None if p.fixture else 'verify-full',
        'projectIdentitySha256':None if p.fixture else profile['projectIdentitySha256'],
        'hostIdentitySha256':None if p.fixture else profile['hostIdentitySha256']}
    if not p.fixture:
        from plan_contract import RISK_BINDING
        a['transportRiskAcceptance']=copy.deepcopy(RISK_BINDING)
    return a


def capture_draft():
    d=copy.deepcopy(load_plan('acl-000-v1').data);d['targetProfile']='OWNED_ISOLATED_FIXTURE'
    d['status']='DRAFT_NOT_EXECUTABLE';d['ledger']['sourcePrefixSha256']=None
    raw=canonical(d);return Plan(raw,sha(raw),_fixture=True)


def production_capture_draft():
    d=copy.deepcopy(load_plan('acl-000-v1').data)
    d['status']='DRAFT_NOT_EXECUTABLE';d['ledger']['sourcePrefixSha256']=None
    raw=canonical(d);return Plan(raw,sha(raw),_fixture=False)


class CaptureContract(unittest.TestCase):
    def setUp(self):
        from plan_contract import authorize_capture
        self.authorize=authorize_capture;self.p=capture_draft();self.a=capture_auth(self.p)

    def test_CAPTURE_01_missing_auth_before_credentials(self):
        from maintenance_transport import CaptureTransport
        with patch('maintenance_transport.safe_file',side_effect=AssertionError('credential forbidden')):
            with self.assertRaises(Failure):CaptureTransport(load_plan('acl-000-v1'),{})
        import runner
        with patch('runner.safe_file',side_effect=lambda p,*args: safe_file(p) if p.name=='target_profiles.json' else (_ for _ in ()).throw(FileNotFoundError())), patch('runner.CaptureTransport',side_effect=AssertionError('transport forbidden')):
            self.assertEqual(runner.main(['capture','--plan','acl-000-v1']),1)

    def test_CAPTURE_02_explicit_draft_authority(self):
        before=self.p.raw;self.authorize(self.p,self.a)
        self.assertEqual(self.p.raw,before);self.assertEqual(self.p.data['status'],'DRAFT_NOT_EXECUTABLE')
        self.assertNotIn('catalogBeforeSha256',self.a);self.assertNotIn('ledgerDescriptorSha256',self.a)
        self.assertIsNone(self.a['expectedLedgerPrefixSha256'])

    def test_CAPTURE_03_cannot_authorize_install(self):
        for mode in ['SINGLE_MIGRATION_APPLY','BACKUP_READ_EXPORT','READ_ONLY_VERIFY','READ_ONLY_PREFLIGHT']:
            with self.assertRaises(Failure):authorize(self.p,self.a,mode)
        with self.assertRaises(Failure):self.authorize(ready(),auth_for(ready()))

    def test_CAPTURE_04_strict_schema(self):
        for key,value in [('sql','select 1'),('function','anything'),('schema','evil'),('dsn','wrong'),('ledger','evil'),('scope','SINGLE_MIGRATION_APPLY'),('contract','unknown'),('explicitCaptureAuthorization',False),('operatorUid',True)]:
            a=copy.deepcopy(self.a);a[key]=value
            with self.assertRaises(Failure):self.authorize(self.p,a)
        for key in self.a:
            a=copy.deepcopy(self.a);del a[key]
            with self.assertRaises(Failure):self.authorize(self.p,a)

    def test_CAPTURE_05_static_hashes(self):
        for key in ['planSha256','migrationSha256','bodySha256']:
            a=copy.deepcopy(self.a);a[key]='0'*64
            with self.assertRaises(Failure):self.authorize(self.p,a)
        a=copy.deepcopy(self.a);a['packageHashes']['checks.py']='0'*64
        with self.assertRaises(Failure):self.authorize(self.p,a)
        self.p.raw+=b' '
        with self.assertRaises(Failure):self.authorize(self.p,self.a)

    def test_CAPTURE_06_raw_file_recheck(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'draft.json';path.write_bytes(self.p.raw+b' ');self.p._source_path=path
            with self.assertRaises(Failure):self.authorize(self.p,self.a)

    def test_CAPTURE_07_freshness(self):
        for key,value in [('expiresAt',0),('observedAt',time.time()+5),('expiresAt',time.time()+1000),('observedAt',True),('expiresAt',float('nan'))]:
            a=copy.deepcopy(self.a);a[key]=value
            with self.assertRaises(Failure):self.authorize(self.p,a)

    def test_CAPTURE_08_fixed_identity_tls(self):
        for key in self.a['targetIdentity']:
            a=copy.deepcopy(self.a);a['targetIdentity'][key]='wrong'
            with self.assertRaises(Failure):self.authorize(self.p,a)
        a=copy.deepcopy(self.a);a['targetProfile']='uply-canonical-maintenance/1'
        with self.assertRaises(Failure):self.authorize(self.p,a)
        for key,value in [('fixture',1),('serverMajor',17.0)]:
            a=copy.deepcopy(self.a);a['targetIdentity'][key]=value
            with self.assertRaises(Failure):self.authorize(self.p,a)

    def test_CAPTURE_09_no_mutation_or_tools(self):
        from maintenance_transport import CAPTURE_MODE,CaptureTransport
        t=MaintenanceTransport.__new__(MaintenanceTransport);t._mode=CAPTURE_MODE
        with self.assertRaises(Failure):
            with t._session(False):pass
        for tool in ['pg_dump','pg_dumpall','pg_restore']:
            with self.assertRaises(Failure):t._tool(tool,[])
        for method in ['_session','_tool','execute_sql','apply','backup','seal','restore']:
            self.assertFalse(hasattr(CaptureTransport,method))

    def test_CAPTURE_10_fixture_separation(self):
        from maintenance_transport import CaptureTransport
        with patch('maintenance_transport.MaintenanceTransport',side_effect=AssertionError('production forbidden')):
            with self.assertRaises(Failure):CaptureTransport(self.p,self.a)
        with self.assertRaises(Failure):CaptureTransport.owned(self.p,self.a,object())
        p=load_plan('acl-000-v1');a=copy.deepcopy(self.a)
        with self.assertRaises(Failure):self.authorize(p,a)

    def test_CAPTURE_11_cli_arbitrary_inputs(self):
        for arg in ['--sql','--dsn','--host','--profile','--file','--schema','--force']:
            r=subprocess.run([sys.executable,'-B',str(OPS/'runner.py'),'capture','--plan','acl-000-v1',arg,'bad'],capture_output=True)
            self.assertNotEqual(r.returncode,0)
        import runner
        self.assertNotIn('Engine(', (OPS/'runner.py').read_text().split("if args.command == 'capture':")[1].split('plan.ensure_ready()')[0])

    def test_CAPTURE_12_production_auth_without_credentials(self):
        import plan_contract
        p=production_capture_draft();a=capture_auth(p)
        self.assertTrue(plan_contract.CAPTURE_APPROVAL.endswith('-v5.json'))
        original=plan_contract.safe_file
        def local(path,*args):
            if str(path).endswith(plan_contract.CAPTURE_APPROVAL):return b'approval-test-only'
            return original(path,*args)
        with patch('plan_contract.safe_file',local),patch('plan_contract.load_plan',return_value=p):
            self.authorize(p,a)
            for key,value in [('userApprovalRef','other'),('userApprovalRef',plan_contract.CAPTURE_APPROVAL.replace('-v5.json','-v4.json')),('userApprovalSha256','0'*64),('credentialIdentitySha256',None)]:
                bad=copy.deepcopy(a);bad[key]=value
                with self.assertRaises(Failure):self.authorize(p,bad)

    def test_CAPTURE_13_ledger_first_mock(self):
        from checks import capture_baseline,CAPTURE_SESSION_SQL,LEDGER_CAPTURE_SQL,CATALOG_SQL
        from unittest.mock import Mock
        s=Mock(readonly=True);s._json.side_effect=[{'readOnly':'on','isolation':'repeatable read'},
          {'ledgerText':'[]','ledgerDescriptor':{'columns':[]}}]
        with self.assertRaises(Failure):capture_baseline(s,self.p,self.a)
        self.assertEqual([c.args[0] for c in s._json.call_args_list],[CAPTURE_SESSION_SQL,LEDGER_CAPTURE_SQL])
        self.assertNotIn(CATALOG_SQL,[c.args[0] for c in s._json.call_args_list])

    def test_CAPTURE_14_modes_reject_bad_session(self):
        from checks import capture_baseline
        from unittest.mock import Mock
        for value in [{'readOnly':'off','isolation':'repeatable read'},{'readOnly':'on','isolation':'read committed'}]:
            s=Mock(readonly=True);s._json.return_value=value
            with self.assertRaises(Failure):capture_baseline(s,self.p,self.a)
            self.assertEqual(s._json.call_count,1)


    def test_CAPTURE_25_production_tls_before_ledger(self):
        import plan_contract
        from checks import capture_baseline,CAPTURE_SESSION_SQL,CAPTURE_TLS_SQL
        from unittest.mock import Mock
        p=production_capture_draft();a=capture_auth(p);original=plan_contract.safe_file
        def local(path,*args):
            if str(path).endswith(plan_contract.CAPTURE_APPROVAL):return b'approval-test-only'
            return original(path,*args)
        s=Mock(readonly=True);s._json.side_effect=[{'readOnly':'on','isolation':'repeatable read'},False]
        with patch('plan_contract.safe_file',local),patch('plan_contract.load_plan',return_value=p):
            with self.assertRaises(Failure) as caught:capture_baseline(s,p,a)
        self.assertEqual(caught.exception.code,'CLIENT_TLS_PROOF_MISSING')
        self.assertEqual([c.args[0] for c in s._json.call_args_list],[CAPTURE_SESSION_SQL])

    def test_CAPTURE_26_runtime_guards_preserved(self):
        import plan_contract
        from maintenance_transport import CAPTURE_MODE,CaptureTransport
        p=production_capture_draft();a=capture_auth(p);original=plan_contract.safe_file
        def local(path,*args):
            if str(path).endswith(plan_contract.CAPTURE_APPROVAL):return b'approval-test-only'
            return original(path,*args)
        with patch('plan_contract.safe_file',local),patch('plan_contract.load_plan',return_value=p):
            # Changed target/TLS fails before credentials even with explicit capture auth.
            for key in ['sslmode','hostIdentitySha256','imageId','database','targetProfile']:
                bad=copy.deepcopy(a);bad['targetIdentity'][key]='evil'
                with patch('maintenance_transport.safe_file',side_effect=AssertionError('credential forbidden')):
                    with self.assertRaises(Failure):CaptureTransport(p,bad)
            # Authorized constructor still invokes the original runtime guard before
            # credential validation; a failed guard cannot be bypassed by capture.
            with patch('maintenance_transport.safe_file',side_effect=lambda path,*args: canonical(a) if path.name=='acl-000-v1.capture.json' else original(path,*args)),patch.object(MaintenanceTransport,'_runtime_guard',side_effect=Failure('PRECHECK_FAILED','RUNTIME_IDENTITY')),patch.object(MaintenanceTransport,'_validate_credentials',side_effect=AssertionError('credential forbidden')):
                with self.assertRaises(Failure) as caught:CaptureTransport(p,a)
                self.assertEqual(caught.exception.code,'RUNTIME_IDENTITY')



class TransportRiskContract(unittest.TestCase):
    def setUp(self):
        import plan_contract as pc
        self.pc=pc;self.p=load_plan('acl-000-v1');self.a=capture_auth(self.p)
        self.tmp=tempfile.TemporaryDirectory(prefix='owned-tls-risk-');self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name);self.profile=copy.deepcopy(strict_json(safe_file(pc.PROFILE_PATH)))
        self.profile['profiles']['uply-canonical-maintenance/1']['receiptRoot']=str(self.root)
        original=pc.safe_file
        def read(path,*args):
            if path==pc.PROFILE_PATH:return canonical(self.profile)
            if path==pc.ROOT/pc.CAPTURE_APPROVAL:return b'approval-test-only'
            return original(path,*args)
        self.read=read;self.addCleanup(patch.stopall);patch('plan_contract.safe_file',read).start()
        self.a['packageHashes']=package_hashes()

    def deny(self,auth=None,code=None):
        with self.assertRaises(Failure) as caught:self.pc.authorize_capture(self.p,self.a if auth is None else auth)
        if code:self.assertEqual(caught.exception.code,code)

    @contextlib.contextmanager
    def registered_draft(self):
        """Reach capture-specific guards with an isolated, registered draft."""
        saved=self.p,self.a
        self.p=production_capture_draft();self.a=capture_auth(self.p)
        try:
            with patch.object(self.pc,'load_plan',return_value=self.p):yield
        finally:self.p,self.a=saved

    def test_TLS_D4_01_missing_risk(self):
        def read(path,*args):
            if path==self.pc.ROOT/self.pc.RISK_PATH:raise FileNotFoundError()
            return self.read(path,*args)
        with patch('plan_contract.safe_file',read),patch.object(MaintenanceTransport,'_validate_credentials',side_effect=AssertionError('forbidden')):
            self.deny(code='PROVIDER_HOP_RISK_NOT_ACCEPTED')

    def test_TLS_D4_02_risk_hash(self):
        def read(path,*args):
            if path==self.pc.ROOT/self.pc.RISK_PATH:return self.read(path,*args)+b' '
            return self.read(path,*args)
        with patch('plan_contract.safe_file',read):self.deny(code='PROVIDER_HOP_RISK_NOT_ACCEPTED')

    def test_TLS_D4_03_risk_scope(self):
        for key in self.a['transportRiskAcceptance']:
            a=copy.deepcopy(self.a);a['transportRiskAcceptance'][key]='wrong';self.deny(a)
        for key in ['hostIdentitySha256','projectIdentitySha256','targetProfile']:
            a=copy.deepcopy(self.a);a['targetIdentity'][key]='wrong';self.deny(a)

    def test_TLS_D4_04_explicit_operator_binding(self):
        with self.registered_draft():
            self.pc.authorize_capture(self.p,self.a)
            a=copy.deepcopy(self.a);del a['transportRiskAcceptance'];self.deny(a)
            a=copy.deepcopy(self.a);a['transportRiskAcceptance']['extra']=True;self.deny(a)
            self.deny({})
            a=copy.deepcopy(self.a);a['explicitCaptureAuthorization']=False;self.deny(a)
        self.deny(code='CAPTURE_DRAFT_REQUIRED')

    def test_TLS_D4_05_expiry(self):
        with self.registered_draft():
            for key,value in [('expiresAt',0),('expiresAt',time.time()+1000),('observedAt',time.time()+5)]:
                a=copy.deepcopy(self.a);a[key]=value;self.deny(a,'RISK_ACCEPTANCE_SCOPE_EXPIRED')

    def test_TLS_D4_06_closure(self):
        marker=self.root/'R7D-C3B.release-completed.json'
        for raw in [b'{"completed":true}',b'{"revoked":true}',b'malformed']:
            marker.write_bytes(raw);self.deny(code='RISK_ACCEPTANCE_SCOPE_EXPIRED');marker.unlink()
        marker.symlink_to(self.root/'absent');self.deny(code='RISK_ACCEPTANCE_SCOPE_EXPIRED');marker.unlink()
        marker.mkdir();self.deny(code='RISK_ACCEPTANCE_SCOPE_EXPIRED');marker.rmdir()
        for key,value in [('stageActive',False),('completionObserved',True)]:
            a=copy.deepcopy(self.a);a['transportRiskAcceptance'][key]=value;self.deny(a)

    def test_TLS_D4_07_v4_only(self):
        with self.registered_draft():
            self.assertTrue(self.pc.CAPTURE_APPROVAL.endswith('-v5.json'));self.pc.authorize_capture(self.p,self.a)
            for key,value in [('userApprovalRef',self.pc.CAPTURE_APPROVAL.replace('-v5','-v4')),('userApprovalRef','/tmp/arbitrary'),('userApprovalSha256','0'*64)]:
                a=copy.deepcopy(self.a);a[key]=value;self.deny(a)

    def test_TLS_D4_08_ready_guards(self):
        with self.registered_draft():
            for mode in ['SINGLE_MIGRATION_APPLY','BACKUP_READ_EXPORT','READ_ONLY_VERIFY','READ_ONLY_PREFLIGHT']:
                with self.assertRaises(Failure) as caught:authorize(self.p,self.a,mode)
                self.assertEqual(caught.exception.code,'DRAFT_NOT_EXECUTABLE')
        for mode in ['SINGLE_MIGRATION_APPLY','BACKUP_READ_EXPORT','READ_ONLY_VERIFY','READ_ONLY_PREFLIGHT']:
            with self.assertRaises(Failure) as caught:authorize(self.p,self.a,mode)
            self.assertEqual(caught.exception.code,'AUTH_SCHEMA')
        self.deny(code='CAPTURE_DRAFT_REQUIRED')

    def test_TLS_D4_09_fixture_separation(self):
        p=capture_draft();a=capture_auth(p);self.deny(a)
        a['transportRiskAcceptance']=copy.deepcopy(self.pc.RISK_BINDING)
        with self.assertRaises(Failure):self.pc.authorize_capture(p,a)
        with self.assertRaises(Failure):MaintenanceTransport(p,capture_auth(p),self.pc.CAPTURE_MODE)

    def service(self,changes=None):
        import maintenance_transport as mt
        t=MaintenanceTransport.__new__(MaintenanceTransport)
        t.profile={'connectionDirectory':str(self.root),'hostIdentitySha256':sha(canonical('owned.example')),'projectIdentitySha256':sha(canonical('owned'))}
        s={'host':'owned.example','port':'5432','dbname':'postgres','user':'postgres.owned','sslmode':'verify-full','sslrootcert':'/connection/root.crt','passfile':'/connection/pgpass'}
        for k,v in (changes or {}).items():
            if v is None:s.pop(k,None)
            else:s[k]=v
        raw=('[uply]\n'+'\n'.join(k+'='+v for k,v in s.items())).encode()
        with patch('maintenance_transport.safe_file',lambda path,**kw:raw if path.name=='pg_service.conf' else b'OWNED_TEST_ONLY'):
            t._credential_digest=t._validate_credentials()
        return t

    def test_TLS_D4_10_port_profile(self):
        self.service()
        for value in [None,'6543','5433','5432,5432']:
            with self.assertRaises(Failure):self.service({'port':value})
        self.profile['profiles']['uply-canonical-maintenance/1']['transportSecurity']['port']=6543;self.deny()

    def test_TLS_D4_11_tcp_only(self):
        for change in [{'host':'/tmp'},{'host':'owned.example,other'},{'hostaddr':'127.0.0.1'},{'host':'other.example'}]:
            with self.assertRaises(Failure):self.service(change)

    def test_TLS_D4_12_identity_ca_policy(self):
        for change in [{'user':'postgres.other'},{'user':'postgres'},{'sslrootcert':'/tmp/ca'},{'passfile':'/tmp/pass'},{'dbname':'other'}]:
            with self.assertRaises(Failure):self.service(change)

    def test_TLS_D4_13_mode_gss(self):
        for value in ['disable','allow','prefer','require','verify-ca']:
            with self.assertRaises(Failure):self.service({'sslmode':value})
        with self.assertRaises(Failure):self.service({'gssencmode':'prefer'})
        t=self.service();self.assertIn("gssencmode='disable'",t._connparams());self.assertIn("port='5432'",t._connparams())
        with patch.object(t,'_runtime_guard'),patch.object(t,'_validate_credentials',return_value=t._credential_digest):
            args=t._base();self.assertIn('PGGSSENCMODE=disable',args);self.assertIn('PGSERVICEFILE=/dev/null',args)

    def test_TLS_D4_19_metadata_missing(self):
        from maintenance_transport import _conninfo
        for raw in ['', 'SSL connection only','You are connected via socket','credential-content-must-not-escape']:
            with self.assertRaises(Failure) as caught:_conninfo(raw,'owned.example','postgres.owned')
            self.assertNotIn(raw or 'impossible',str(caught.exception))

    def test_TLS_D4_28_tool_override(self):
        from maintenance_transport import _dump_profile
        for tool,args in [('pg_dump',['--help']),('pg_dump',['--version']),('pg_dump',['-d','evil','-Fc','--snapshot=1-1-1']),('pg_dump',['-d','postgres','-Fc','--snapshot=1-1-1','-j','2']),('pg_dumpall',['--roles-only','--no-role-passwords','-h','other']),('pg_restore',[])]:
            with self.assertRaises(Failure):_dump_profile(tool,args,None)
        with self.assertRaises(Failure):_dump_profile('pg_dumpall',['--roles-only','--no-role-passwords'],b'input')

    def test_TLS_D4_32_privacy(self):
        from maintenance_transport import _record_proof
        p={'invocationId':'a'*32,'password':'OWNED_SECRET'}
        with self.assertRaises(Failure):_record_proof(self.root/'proofs',p)
        self.assertFalse((self.root/'proofs').exists())
        src=(OPS/'maintenance_transport.py').read_text();self.assertNotIn('p.stderr.decode',src)
        self.assertIn("{'enabled':True,'version':None,'cipher':None}",src)

    def test_TLS_D4_33_durability(self):
        from maintenance_transport import _record_proof
        p={'invocationId':'b'*32,'safe':'owned'};root=self.root/'proofs'
        rec=_record_proof(root,p);self.assertEqual(Path(rec['path']).stat().st_mode&0o777,0o600)
        with self.assertRaises(Failure):_record_proof(root,p)
        with patch('receipts.os.fsync',side_effect=OSError('owned')):
            with self.assertRaises(Failure):_record_proof(root,dict(p,invocationId='c'*32))
        with self.assertRaises(Failure):_record_proof(root,dict(p,invocationId='../escape'))
        (root/('d'*32+'.json')).symlink_to(self.root/'missing')
        with self.assertRaises(Failure):_record_proof(root,dict(p,invocationId='d'*32))

    def test_TLS_D4_34_scope(self):
        approval=strict_json(safe_file(ROOT/'docs/evidence/teaching-agent-stage-1f-r7d-c/approval-r7d-c3b-runner-pooled-risk-contract-implementation.json'))
        forward=strict_json(safe_file(ROOT/'docs/evidence/teaching-agent-stage-1f-r7d-c/approval-r7d-c3b-runner-authorization-lifecycle-implementation.json'))
        seal_raw=safe_file(ROOT/'docs/evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-runner-000-plan-seal-result.json')
        self.assertEqual(sha(seal_raw),'34ce49141341eddb6676b6010c4e7bcea2592cbe4c6b44cf31dc523bd2e32f7f')
        seal=strict_json(seal_raw);record=seal['authorizationRecord']
        authorization_raw=safe_file(ROOT/record['path'])
        self.assertEqual(sha(authorization_raw),record['rawSha256'])
        self.assertEqual(record['rawSha256'],'cb07865c363dce36167da4f6106f95ec043d84b74cb54b7fb34a45901ab93de1')
        authorization=strict_json(authorization_raw)
        self.assertIs(authorization['explicitPlanSealApproval'],True)
        self.assertEqual(authorization['beforeHashes'],seal['beforeHashes'])
        self.assertEqual(authorization['targetHashes'],seal['actualHashes'])
        self.assertEqual(set(seal['actualHashes']),{'scripts/teaching-agent-r7d-c3b/plan_registry.json','scripts/teaching-agent-r7d-c3b/plans/acl-000-v1.json'})
        for path,digest in seal['actualHashes'].items():self.assertEqual(sha(safe_file(ROOT/path)),digest,path)
        changed={x['path'] for x in forward['exactScope']['exactModifyPaths']}
        for item in approval['unchangedBoundaries']+approval['migrationLocks']:
            if item['path'] in changed:
                self.assertEqual(next(x['existingSha256'] for x in forward['exactScope']['exactModifyPaths'] if x['path']==item['path']),item['sha256'])
            elif item['path'] in seal['actualHashes']:
                self.assertEqual(item['sha256'],seal['beforeHashes'][item['path']])
            else:self.assertEqual(sha(safe_file(ROOT/item['path'])),item['sha256'],item['path'])
        self.assertEqual(len(approval['exactModifyPaths']),9);self.assertEqual(approval['exactAddPaths'],[])
        self.assertEqual(set(registry()['plans']),{'acl-000-v1'})





class LifecycleOwned:
    """Test-only authority fixture. No production runtime filesystem access."""
    def __init__(self, plan=None):
        import capture_authorization as ca
        import plan_contract as pc
        import contextlib
        self.ca=ca;self.pc=pc;self.stack=contextlib.ExitStack()
        self.tmp=tempfile.TemporaryDirectory(prefix='owned-auth-lifecycle-');self.root=Path(self.tmp.name)
        self.plan=plan or production_capture_draft()
        if not self.plan.fixture:
            self.stack.enter_context(patch('plan_contract.load_plan',return_value=self.plan))
        self.home=self.root/'approvals';self.receipts=self.root/'receipts'
        self.home.mkdir(mode=0o700);self.receipts.mkdir(mode=0o700)
        profiles=strict_json(safe_file(pc.PROFILE_PATH));prod=copy.deepcopy(profiles['profiles']['uply-canonical-maintenance/1'])
        prod.update(authorizationDirectory=str(self.home),receiptRoot=str(self.receipts))
        profiles['profiles'][self.plan.data['targetProfile']]=prod
        self.profiles=profiles;self.identity_path=ca.BASE+'owned-identity.json'
        self.identity=canonical({'credentialIdentitySha256':None if self.plan.fixture else 'c'*64})
        self.original=pc.safe_file;self.v5_mutate=lambda x:x
        def read(path,*args,**kwargs):
            if path==pc.PROFILE_PATH:return canonical(self.profiles)
            if path==pc.ROOT/self.identity_path:return self.identity
            if path==pc.ROOT/pc.CAPTURE_APPROVAL:
                v={'approvalVersion':5,'approved':False,'executionAuthorized':False,'status':'READY_AWAITING_EXPLICIT_APPROVAL',
                   'approvalType':'CONTROLLED_PRODUCTION_READ_ONLY_BASELINE_CAPTURE_AND_REVIEW_ONLY',
                   'runtimePackageHashes':pc.package_hashes(),'runtimePackageSha256':sha(canonical(pc.package_hashes())),
                   'draftRawSha256':self.plan.digest,'acceptanceRecordPath':ca.LOSS_PATH,'acceptanceRecordRawSha256':ca.LOSS_SHA,
                   'credentialIdentityEvidence':[{'path':self.identity_path,'sha256':sha(self.identity)}]}
                return canonical(self.v5_mutate(v))
            return self.original(path,*args,**kwargs)
        self.stack.enter_context(patch('plan_contract.safe_file',read))
        self.life=ca.Lifecycle(self.plan)
        # Only owned roots; make operator-owned input namespace, not production.
        (self.home/'capture-approvals').mkdir(mode=0o700)
        self.oldraw=None

    def close(self):self.stack.close();self.tmp.cleanup()

    def issue(self,old=False,changes=None):
        import uuid
        ca=self.ca;now=time.time();aid=uuid.uuid4().hex
        if old:
            a=capture_auth(self.plan);a.update(observedAt=now-1000,expiresAt=now-100)
            self.oldraw=canonical(a)+b'  \n'  # Deliberately retain noncanonical exact bytes.
            self.life.canonical.write_bytes(self.oldraw);self.life.canonical.chmod(0o600)
            self.stack.enter_context(patch('capture_authorization.LEGACY_SHA',sha(self.oldraw)))
        ref={'contract':'capture-user-attestation/1','explicitUserApproval':True,'approvalId':aid,
             'sourceApprovalRawSha256':self.life.authority(),'maximumCaptureAttempts':1,'observedAt':now-1,'expiresAt':now+800}
        raw=canonical(ref)+b'\n';rh=sha(raw);path=self.home/'capture-approvals'/('user-'+rh+'.json');path.write_bytes(raw);path.chmod(0o600)
        a={'contract':'capture-execution-approval/1','approvalId':aid,'scope':'ONE_CONTROLLED_PRODUCTION_READ_ONLY_CAPTURE',
           'planId':self.plan.data['planId'],'targetProfile':self.plan.data['targetProfile'],'sourceApprovalPath':self.pc.CAPTURE_APPROVAL,
           'sourceApprovalRawSha256':ref['sourceApprovalRawSha256'],'sourcePackageHashes':package_hashes(),
           'draftRawSha256':self.plan.digest,'migrationRawSha256':self.plan.migration['rawSha256'],
           'migrationBodySha256':self.plan.migration['bodySha256'],'targetIdentity':self.life.identity(),
           'credentialIdentitySha256':None if self.plan.fixture else 'c'*64,
           'credentialIdentityEvidencePath':str(self.life.canonical) if old else self.identity_path,
           'credentialIdentityEvidenceRawSha256':sha(self.oldraw) if old else sha(self.identity),
           'transportRiskArtifactRawSha256':self.pc.RISK_SHA,'lossAcceptanceRecordRawSha256':ca.LOSS_SHA,
           'f2EvidenceRawSha256':ca.F2_SHA,'expectedCanonicalState':{'state':'EXPIRED_CONSUMED_HISTORICAL' if old else 'ABSENT','sha256':sha(self.oldraw) if old else None},
           'explicitUserApproval':True,'approvalReference':str(path),'approvalReferenceSha256':rh,'operatorUid':os.getuid(),
           'observedAt':now-1,'expiresAt':now+799,'maximumCaptureAttempts':1}
        a.update(changes or {});return self.write_approval(a)

    def write_approval(self,a):
        path=self.home/'capture-approvals'/(a['approvalId']+'.json');raw=canonical(a)+b'\n'
        path.write_bytes(raw);path.chmod(0o600);self.approval=a
        return a['approvalId'],sha(raw)

    def mint(self,old=False):
        args=self.issue(old=old);out=self.life.mint(*args);self.minted=out;return out

    def complete(self,lease):
        path=self.receipts/'owned.capture.json';a=lease['auth']
        body={'contract':'readonly-baseline-capture/2','authorizationSha256':sha(canonical(a)),'captureEnd':'ROLLBACK'}
        h=exclusive(path,body);lease.update(receiptPath=path,receiptSha256=h)

    def runner_patches(self,transport):
        import contextlib,runner
        stack=contextlib.ExitStack();original=runner.safe_file
        stack.enter_context(patch('runner.load_plan',return_value=self.plan))
        stack.enter_context(patch('runner.safe_file',lambda path,*args: self.pc.safe_file(path,*args) if path==self.pc.PROFILE_PATH else original(path,*args)))
        stack.enter_context(patch('runner.CaptureTransport',side_effect=transport))
        return stack


class AuthorizationLifecycle(unittest.TestCase):
    def setUp(self):
        self.h=LifecycleOwned();self.addCleanup(self.h.close);self.ca=self.h.ca

    def denied(self,fn,code=None):
        with self.assertRaises((Failure,OSError)) as caught:fn()
        if code:self.assertEqual(caught.exception.code,code)

    def fork_crash(self,phase,run=None,old=False):
        import multiprocessing
        args=self.h.issue(old=old) if run is None else None
        ctx=multiprocessing.get_context('fork')
        def child():
            original=self.ca.record
            def crash(path,data):
                result=original(path,data)
                if path.name==phase+'.json' or phase=='CONSUMED' and path.parent.name=='consumed':os._exit(91)
                return result
            with patch.object(self.ca,'record',crash):
                if run:run()
                else:self.h.life.mint(*args)
            os._exit(92)
        p=ctx.Process(target=child);p.start();p.join(15)
        self.assertFalse(p.is_alive());self.assertEqual(p.exitcode,91)

    def test_AUTH_LIFECYCLE_01_fresh(self):
        out=self.h.mint();self.assertEqual(out['state'],'MINTED_READY')
        a=read_record_for_test(self.h.life.canonical);self.assertEqual(a['contract'],'readonly-baseline-capture-authorization/2')
        self.assertEqual(set(a),self.ca.pc.CAPTURE_FIELDS|{'transportRiskAcceptance'})
        self.assertEqual(self.h.life.canonical.stat().st_mode&0o777,0o600)

    def test_AUTH_LIFECYCLE_02_rotate(self):
        out=self.h.mint(old=True);self.assertNotEqual(out['authorizationRawSha256'],sha(self.h.oldraw))
        self.assertEqual((self.h.life.archive/(sha(self.h.oldraw)+'.json')).read_bytes(),self.h.oldraw)
        with self.h.life.attempt() as lease:self.h.complete(lease)
        self.assertFalse(self.h.life.canonical.exists())

    def test_AUTH_LIFECYCLE_03_exact_bytes(self):
        args=self.h.issue(old=True);before=self.h.life.canonical.stat();self.h.life.mint(*args)
        p=self.h.life.archive/(sha(self.h.oldraw)+'.json')
        self.assertEqual(p.read_bytes(),self.h.oldraw);self.assertEqual(p.stat().st_ino,before.st_ino)
        self.assertEqual(p.stat().st_mode&0o777,0o600)

    def test_AUTH_LIFECYCLE_04_archive_collision(self):
        args=self.h.issue(old=True)
        with self.h.life.locked():exclusive(self.h.life.archive/(sha(self.h.oldraw)+'.json'),{'unrelated':True})
        self.denied(lambda:self.h.life.mint(*args),'AUTH_ARCHIVE_COLLISION');self.assertEqual(self.h.life.canonical.read_bytes(),self.h.oldraw)

    def test_AUTH_LIFECYCLE_05_old_hash(self):
        args=self.h.issue(old=True);a=self.h.approval;a['expectedCanonicalState']['sha256']='0'*64
        args=self.h.write_approval(a);self.denied(lambda:self.h.life.mint(*args),'AUTH_OLD_HASH_MISMATCH')

    def test_AUTH_LIFECYCLE_06_modes(self):
        args=self.h.issue(old=True);self.h.life.canonical.chmod(0o644)
        self.denied(lambda:self.h.life.mint(*args));self.assertEqual(self.h.life.canonical.stat().st_mode&0o777,0o644)
        self.h.life.canonical.chmod(0o600);self.h.receipts.chmod(0o775)
        self.denied(lambda:self.h.life.mint(*args),'AUTH_PATH_UNSAFE')

    def test_AUTH_LIFECYCLE_07_owner(self):
        args=self.h.issue()
        with patch('capture_authorization.os.getuid',return_value=os.getuid()+1):self.denied(lambda:self.h.life.mint(*args))

    def test_AUTH_LIFECYCLE_08_canonical_symlink(self):
        args=self.h.issue();self.h.life.canonical.symlink_to(self.h.root/'absent')
        self.denied(lambda:self.h.life.mint(*args))

    def test_AUTH_LIFECYCLE_09_archive_symlink(self):
        args=self.h.issue();(self.h.home/'capture-archive').symlink_to(self.h.root)
        self.denied(lambda:self.h.life.mint(*args),'AUTH_PATH_UNSAFE')

    def test_AUTH_LIFECYCLE_10_concurrent(self):
        import multiprocessing
        args=self.h.issue();ctx=multiprocessing.get_context('fork');q=ctx.Queue()
        with self.h.life.locked():
            def child():
                try:self.h.life.mint(*args);q.put('unexpected')
                except Failure as e:q.put(e.code)
            p=ctx.Process(target=child);p.start();p.join(10)
            self.assertEqual(q.get(timeout=2),'AUTH_LIFECYCLE_LOCK_BUSY');self.assertEqual(p.exitcode,0)
        self.assertFalse(self.h.life.canonical.exists());self.h.life.mint(*args)

    def test_AUTH_LIFECYCLE_11_crash_prepared(self):
        self.fork_crash('PREPARED',old=True);self.assertEqual(self.h.life.canonical.read_bytes(),self.h.oldraw);self.denied(lambda:self.h.life.mint(*self.h.issue()),'AUTH_LIFECYCLE_INCOMPLETE')

    def test_AUTH_LIFECYCLE_12_crash_archived(self):
        self.fork_crash('ARCHIVED',old=True);self.assertFalse(self.h.life.canonical.exists());self.assertEqual((self.h.life.archive/(sha(self.h.oldraw)+'.json')).read_bytes(),self.h.oldraw)
        self.denied(lambda:self.h.life.mint(*self.h.issue()),'AUTH_LIFECYCLE_INCOMPLETE')

    def test_AUTH_LIFECYCLE_13_crash_staged(self):
        self.fork_crash('STAGED');self.assertTrue(list(self.h.life.pending.iterdir()));self.assertFalse(self.h.life.canonical.exists())
        with self.assertRaises((Failure,OSError)):
            with self.h.life.attempt():self.fail('dispatched')

    def test_AUTH_LIFECYCLE_14_crash_published(self):
        self.fork_crash('PUBLISHED');self.assertTrue(self.h.life.canonical.exists())
        with self.assertRaises((Failure,OSError)):
            with self.h.life.attempt():self.fail('dispatched')

    def test_AUTH_LIFECYCLE_15_partial_ready(self):
        out=self.h.mint();p=self.h.life.root/'ready'/(out['authorizationRawSha256']+'.json');p.write_bytes(b'{')
        with self.assertRaises(Failure):
            with self.h.life.attempt():self.fail('dispatched')
        self.assertEqual(list((self.h.life.root/'consumed').iterdir()),[])

    def test_AUTH_LIFECYCLE_16_schema(self):
        args=self.h.issue(changes={'extra':'forbidden'});self.denied(lambda:self.h.life.mint(*args),'AUTH_EXPLICIT_APPROVAL_SCHEMA')
        del self.h.approval['extra'];del self.h.approval['operatorUid'];args=self.h.write_approval(self.h.approval)
        self.denied(lambda:self.h.life.mint(*args),'AUTH_EXPLICIT_APPROVAL_SCHEMA')

    def test_AUTH_LIFECYCLE_17_expiry(self):
        args=self.h.issue(changes={'expiresAt':time.time()+2000});self.denied(lambda:self.h.life.mint(*args),'AUTH_APPROVAL_EXPIRED')

    def test_AUTH_LIFECYCLE_18_nonce(self):
        import uuid
        out=self.h.mint();a=read_record_for_test(self.h.life.canonical)
        with self.h.life.attempt() as lease:self.h.complete(lease)
        args=self.h.issue();ids=iter([uuid.uuid4(),uuid.UUID(a['nonce'])])
        with patch('capture_authorization.uuid.uuid4',side_effect=lambda:next(ids)):
            self.denied(lambda:self.h.life.mint(*args),'AUTH_IDENTITY_ALREADY_RESERVED')

    def test_AUTH_LIFECYCLE_19_auth_replay(self):
        self.h.mint();raw=self.h.life.canonical.read_bytes()
        with self.h.life.attempt() as lease:self.h.complete(lease)
        self.h.life.canonical.write_bytes(raw);self.h.life.canonical.chmod(0o600)
        with self.assertRaises(Failure) as caught:
            with self.h.life.attempt():self.fail('replayed')
        self.assertEqual(caught.exception.code,'CAPTURE_AUTHORIZATION_CONSUMED')

    def test_AUTH_LIFECYCLE_20_missing_user(self):
        args=self.h.issue(changes={'explicitUserApproval':False});self.denied(lambda:self.h.life.mint(*args),'AUTH_EXPLICIT_APPROVAL_BINDING')

    def test_AUTH_LIFECYCLE_21_source_authority(self):
        args=self.h.issue(changes={'sourceApprovalPath':self.ca.V4_PATH});self.denied(lambda:self.h.life.mint(*args),'AUTH_EXPLICIT_APPROVAL_BINDING')
        self.h.v5_mutate=lambda v:dict(v,approvalVersion=4)
        self.denied(lambda:self.h.life.mint(*args),'AUTH_SOURCE_AUTHORITY')

    def test_AUTH_LIFECYCLE_22_closed(self):
        args=self.h.issue();(self.h.receipts/'R7D-C3B.release-completed.json').symlink_to(self.h.root/'absent')
        self.denied(lambda:self.h.life.mint(*args),'RISK_ACCEPTANCE_SCOPE_EXPIRED')

    def test_AUTH_LIFECYCLE_23_risk(self):
        args=self.h.issue()
        with patch('plan_contract.risk_guard',side_effect=Failure('APPROVAL_MISSING','PROVIDER_HOP_RISK_NOT_ACCEPTED')):
            self.denied(lambda:self.h.life.mint(*args),'PROVIDER_HOP_RISK_NOT_ACCEPTED')

    def test_AUTH_LIFECYCLE_24_loss(self):
        args=self.h.issue();self.h.v5_mutate=lambda v:dict(v,acceptanceRecordRawSha256='0'*64)
        self.denied(lambda:self.h.life.mint(*args),'AUTH_LOSS_BINDING')

    def test_AUTH_LIFECYCLE_25_io_failure(self):
        args=self.h.issue()
        with self.h.life.locked():pass
        with patch('capture_authorization.os.fsync',side_effect=OSError('owned disk IO')):
            self.denied(lambda:self.h.life.mint(*args))
        self.assertFalse(self.h.life.canonical.exists())

    def test_AUTH_LIFECYCLE_26_no_credentials(self):
        import socket,builtins
        args=self.h.issue();original=os.open;seen=[]
        def opened(path,*a,**kw):
            name=os.fsdecode(path) if not isinstance(path,int) else ''
            self.assertNotIn('uply-first-enable-20260910/db',name);self.assertNotIn('pgpass',name);seen.append(name)
            return original(path,*a,**kw)
        with patch('os.open',opened),patch('socket.socket',side_effect=AssertionError('network forbidden')),patch('subprocess.Popen',side_effect=AssertionError('tool forbidden')),patch.object(MaintenanceTransport,'_validate_credentials',side_effect=AssertionError('credential forbidden')):
            self.h.life.mint(*args)
        self.assertTrue(seen)

    def test_AUTH_LIFECYCLE_27_approval_replay(self):
        args=self.h.issue();self.h.life.mint(*args)
        with self.h.life.attempt() as lease:self.h.complete(lease)
        self.denied(lambda:self.h.life.mint(*args),'AUTH_IDENTITY_ALREADY_RESERVED')
        ref=self.h.approval['approvalReferenceSha256'];self.assertTrue((self.h.life.root/'approval-reference-claims'/(ref+'.json')).exists())

    def test_AUTH_LIFECYCLE_28_mint_capture_lock(self):
        import multiprocessing
        self.h.mint();ctx=multiprocessing.get_context('fork');q=ctx.Queue()
        with self.h.life.attempt() as lease:
            def child():
                try:
                    with self.h.life.locked():q.put('unexpected')
                except Failure as e:q.put(e.code)
            p=ctx.Process(target=child);p.start();p.join(10);self.assertEqual(q.get(timeout=2),'AUTH_LIFECYCLE_LOCK_BUSY')
            self.h.complete(lease)

    def test_AUTH_LIFECYCLE_29_consume_before_constructor(self):
        import runner
        self.h.mint();seen=[]
        def constructor(*args):
            seen.append(True);self.assertEqual(len(list((self.h.life.root/'consumed').iterdir())),1)
            raise Failure('PRECHECK_FAILED','OWNED_CONSTRUCTOR_STOP')
        with self.h.runner_patches(constructor):self.assertEqual(runner.main(['capture','--plan','acl-000-v1']),1)
        self.assertEqual(seen,[True]);self.assertFalse(self.h.life.canonical.exists())

    def test_AUTH_LIFECYCLE_32_kill_consumed(self):
        self.h.mint()
        def run():
            with self.h.life.attempt():os._exit(92)
        self.fork_crash('CONSUMED',run=run)
        with self.assertRaises(Failure) as caught:
            with self.h.life.attempt():self.fail('replay')
        self.assertEqual(caught.exception.code,'CAPTURE_AUTHORIZATION_CONSUMED')

    def test_AUTH_LIFECYCLE_34_unexpired(self):
        args=self.h.issue(old=True);raw=read_record_for_test(self.h.life.canonical);raw['expiresAt']=time.time()+500
        self.h.oldraw=canonical(raw);self.h.life.canonical.write_bytes(self.h.oldraw)
        self.h.stack.enter_context(patch('capture_authorization.LEGACY_SHA',sha(self.h.oldraw)))
        self.h.approval['expectedCanonicalState']['sha256']=sha(self.h.oldraw);self.h.approval['credentialIdentityEvidenceRawSha256']=sha(self.h.oldraw)
        args=self.h.write_approval(self.h.approval);self.denied(lambda:self.h.life.mint(*args),'AUTH_UNEXPIRED_ACTIVE')

    def test_AUTH_LIFECYCLE_35_output_immutable(self):
        import teaching_agent_single_migration_runner_postgres_test as pg
        import uuid
        with tempfile.TemporaryDirectory() as tmp,patch.object(pg,'ROOT',Path(tmp)):
            base=Path(tmp)/'docs/evidence/teaching-agent-stage-1f-r7d-c/runner-p1e-a2-validation';base.mkdir(parents=True)
            fixed=uuid.uuid4()
            with patch('uuid.uuid4',return_value=fixed):
                first=pg.reserve_validation_directory()
                with self.assertRaises(FileExistsError):pg.reserve_validation_directory()
            self.assertTrue(first.is_dir())
        src=(ROOT/'tests/teaching_agent_single_migration_runner_postgres_test.py').read_text()
        self.assertNotIn("evidence=ROOT/'docs/evidence/teaching-agent-stage-1f-r7d-c/runner-tls-i1-validation'",src)

    def test_AUTH_LIFECYCLE_36_rename_fsync(self):
        ca=self.ca;src=self.h.home/'owned.json';dst=self.h.home/'moved.json';exclusive(src,{'safe':True});h=sha(src.read_bytes());seen=[]
        original=os.fsync
        with patch('capture_authorization.os.fsync',side_effect=lambda fd:(seen.append(fd),original(fd))[1]):ca.move_exact(src,dst,h)
        self.assertFalse(src.exists());self.assertEqual(sha(dst.read_bytes()),h);self.assertGreaterEqual(len(seen),2)
        self.denied(lambda:ca.move_exact(dst,dst,h),'AUTH_ARCHIVE_COLLISION')
        from unittest.mock import Mock
        libc=Mock();libc.renameat2.return_value=-1
        with patch('capture_authorization.ctypes.CDLL',return_value=libc),patch('capture_authorization.ctypes.get_errno',return_value=18):
            self.denied(lambda:ca.move_exact(dst,src,h),'AUTH_ATOMIC_RENAME_UNSUPPORTED')
        self.assertTrue(dst.exists())

    def test_AUTH_LIFECYCLE_37_cli(self):
        for extra in ['--force','--skip','--host','--dsn','--path','--capture','--profile']:
            with self.assertRaises(SystemExit) as caught:self.ca.main(['mint','--plan','acl-000-v1','--approval-id','a'*32,'--approval-sha256','b'*64,extra,'x'])
            self.assertEqual(caught.exception.code,2)

    def test_AUTH_LIFECYCLE_38_privacy_chain(self):
        out=self.h.mint();path=self.h.life.root/'operations'
        for p in self.h.life.root.rglob('*.json'):
            raw=p.read_text();self.assertNotIn('postgresql://',raw);self.assertNotIn('"password"',raw)
        op=next(path.iterdir());(op/'STAGED.json').write_bytes(b'{}')
        with self.assertRaises(Failure):
            with self.h.life.attempt():self.fail('tampered chain')

    def test_AUTH_LIFECYCLE_40_package(self):
        self.assertEqual(len(package_hashes()),10);self.assertIn('capture_authorization.py',package_hashes())
        self.assertTrue(self.ca.pc.CAPTURE_APPROVAL.endswith('-v5.json'))
        v5=ROOT/self.ca.pc.CAPTURE_APPROVAL
        self.assertTrue(v5.exists())
        self.assertEqual(sha(safe_file(v5)),'452383994cb734fece9750dc48209e974c238776dae02a1579ed7f9c89621f5c')
        proposal=strict_json(safe_file(v5))
        self.assertEqual(proposal['approvalVersion'],5)
        self.assertEqual(proposal['status'],'READY_AWAITING_EXPLICIT_APPROVAL')
        self.assertIs(proposal['approved'],False);self.assertIs(proposal['executionAuthorized'],False)
        args=self.h.issue(changes={'sourceApprovalRawSha256':'0'*64});self.denied(lambda:self.h.life.mint(*args))


def read_record_for_test(path):return strict_json(safe_file(path,True))


# Closed input selection from D15-R1-F2A, never result-based fallback. Test IDs
# remain unchanged; only these positive-artifact prerequisites need a unit target.
_BACKUP_SYNTHETIC_ARTIFACT_TESTS=frozenset({
    ('BackupAuthorizationLifecycle','test_BACKUP_AUTH_09_mint_runner_race'),
    ('BackupAuthorizationLifecycle','test_BACKUP_AUTH_10_two_runners'),
    ('BackupAuthorizationLifecycle','test_BACKUP_AUTH_15_nonce_replay'),
    ('BackupAuthorizationLifecycle','test_BACKUP_AUTH_16_approval_replay'),
    ('BackupAuthorizationLifecycle','test_BACKUP_AUTH_22_consume_replay'),
    ('BackupAuthorizationLifecycle','test_BACKUP_AUTH_25_backup_success'),
    ('BackupAuthorizationLifecycle','test_BACKUP_AUTH_26_canonical_inactive'),
    ('BackupAuthorizationLifecycle','test_BACKUP_AUTH_31_crash_E'),
    ('BackupAuthorizationLifecycle','test_BACKUP_AUTH_34_crash_H'),
    ('BackupAuthorizationLifecycle','test_BACKUP_AUTH_35_crash_I'),
    ('BackupAuthorizationLifecycle','test_BACKUP_AUTH_40_identity_provenance'),
    ('BackupAuthorizationLifecycle','test_BACKUP_AUTH_44_backup_cannot_capture'),
    ('BackupAuthorizationLifecycle','test_BACKUP_AUTH_48_terminal_only_failure'),
    ('BackupAuthorizationLifecycle','test_BACKUP_AUTH_53_runner_other_modes'),
    ('BackupV4SuccessorAuthority','test_BACKUP_AUTHORITY_V4_022_artifact_v4_success_binding'),
})
_BACKUP_SYNTHETIC_SCOPES=[]


def _backup_identity_mode(test):
    key=(type(test).__name__,test._testMethodName)
    return 'SYNTHETIC_ARTIFACT' if key in _BACKUP_SYNTHETIC_ARTIFACT_TESTS else 'CANONICAL_RISK'


@contextlib.contextmanager
def _owned_artifact_identity(root,plan,profile):
    """Unit trust inputs only; real guards run unchanged and cannot grant capability.

    Attribute rebinding covers imported value aliases without mutating a shared
    dictionary. Serial nested scopes unwind to the exact parent objects. Existing
    fork tests inherit the context and join before its parent closes it.
    """
    import uuid,socket,plan_contract as pc,backup_adapter as ba,maintenance_transport as mt
    if plan.fixture:raise AssertionError('SYNTHETIC_IDENTITY_REQUIRES_NONFIXTURE')
    endpoint={'host':'synthetic.invalid','port':5432}
    profile.update(hostIdentitySha256=sha(canonical(endpoint['host'])),
                   projectIdentitySha256=sha(canonical('owned-backup-artifact-test-project/1')))
    fixture_id=uuid.uuid4().hex
    target={k:profile[k] for k in ['hostIdentitySha256','projectIdentitySha256','database','role','imageId']}
    target.update(profile=plan.data['targetProfile'],port=5432,poolMode='SESSION')
    risk={'contract':'owned-backup-test-risk-input/1','classification':'SYNTHETIC_TEST_DATA_NOT_OPERATION_AUTHORITY',
          'fixtureId':fixture_id,'executionAuthorized':False,'productionAccessAllowed':False,'target':target,
          'allowedMigrationLocks':[{'path':plan.migration['path'],'sha256':plan.migration['rawSha256']}]}
    risk_path=root/'synthetic-risk.json';risk_sha=exclusive(risk_path,risk,redact=False)
    binding=copy.deepcopy(pc.RISK_BINDING);binding['riskArtifactSha256']=risk_sha
    token=object();_BACKUP_SYNTHETIC_SCOPES.append(token)
    try:
        with contextlib.ExitStack() as stack:
            stack.enter_context(patch.object(pc,'RISK_PATH',str(risk_path)))
            stack.enter_context(patch.object(pc,'RISK_SHA',risk_sha))
            for module in [pc,ba,mt]:
                stack.enter_context(patch.object(module,'RISK_BINDING',copy.deepcopy(binding)))
            for owner,name in [(mt.MaintenanceTransport,'__init__'),(mt.CaptureTransport,'__init__'),
                               (subprocess,'Popen'),(socket,'socket'),(socket,'create_connection')]:
                stack.enter_context(patch.object(owner,name,side_effect=AssertionError('synthetic identity capability forbidden')))
            profile['transportSecurity']=pc.transport_policy(profile)
            yield {'endpoint':endpoint,'fixtureId':fixture_id,'riskPath':risk_path,'riskSha256':risk_sha}
    finally:
        if not _BACKUP_SYNTHETIC_SCOPES or _BACKUP_SYNTHETIC_SCOPES[-1] is not token:
            raise AssertionError('SYNTHETIC_IDENTITY_SCOPE_ORDER')
        _BACKUP_SYNTHETIC_SCOPES.pop()


class BackupLifecycleOwned:
    """Synthetic authorities and private temporary files; no production capability."""
    def __init__(self, fixture=None, *, identity_mode='CANONICAL_RISK'):
        if identity_mode not in ('CANONICAL_RISK','SYNTHETIC_ARTIFACT'):
            raise AssertionError('UNKNOWN_BACKUP_IDENTITY_MODE')
        if fixture is not None and identity_mode=='SYNTHETIC_ARTIFACT':
            raise AssertionError('SYNTHETIC_IDENTITY_REQUIRES_NONFIXTURE')
        if _BACKUP_SYNTHETIC_SCOPES and identity_mode!='SYNTHETIC_ARTIFACT':
            raise AssertionError('CANONICAL_IDENTITY_INSIDE_SYNTHETIC_SCOPE')
        # Constructor failures happen before a test can register addCleanup.
        with contextlib.ExitStack() as stack:
            self.stack=stack;self.identity_mode=identity_mode
            self.tmp=tempfile.TemporaryDirectory(prefix='owned-backup-auth-')
            self.root=Path(stack.enter_context(self.tmp))
            self._initialize(fixture)
            self.stack=stack.pop_all()

    def _initialize(self,fixture):
        import uuid,capture_authorization as ca,plan_contract as pc
        self.ca,self.pc=ca,pc;self.endpoint=None
        self.completed=time.time()-10;self.fixture=fixture
        self.plan=load_plan('acl-000-v1')
        if fixture:
            fp,fa=fixture.plan();data=copy.deepcopy(fp.data);data['planId']='acl-000-v1'
            raw=canonical(data);self.plan=Plan(raw,sha(raw),_fixture=True)
            self.descriptor,self.catalog=fa['ledgerDescriptorSha256'],fa['catalogBeforeSha256']
        else:self.descriptor,self.catalog='3'*64,'4'*64
        self.home=self.root/'approvals';self.receipts=self.root/'receipts';self.backups=self.root/'backups'
        for p in [self.home,self.receipts,self.backups]:p.mkdir(mode=0o700)
        (self.home/'backup-approvals').mkdir(mode=0o700)
        self.build=self.root/'BUILD_ID';self.build.write_text('OWNED_BUILD')
        profiles=strict_json(safe_file(pc.PROFILE_PATH));profile=copy.deepcopy(profiles['profiles']['uply-canonical-maintenance/1'])
        self.canonical_profile=copy.deepcopy(profile)
        self.canonical_risk_sha=profile['transportSecurity']['riskArtifactSha256']
        if self.identity_mode=='SYNTHETIC_ARTIFACT':
            self.synthetic_identity=self.stack.enter_context(_owned_artifact_identity(self.root,self.plan,profile))
            self.endpoint=copy.deepcopy(self.synthetic_identity['endpoint'])
        profile.update(authorizationDirectory=str(self.home),receiptRoot=str(self.receipts),backupRoot=str(self.backups),buildPath=str(self.build),buildId='OWNED_BUILD')
        profiles['profiles'][self.plan.data['targetProfile']]=profile;self.profiles=profiles
        self.baseline={'acceptedBaseline':{'sourcePrefixSha256':self.plan.data['ledger']['sourcePrefixSha256'],'ledgerDescriptorSha256':self.descriptor,'protectedCatalogSha256':self.catalog}}
        # Owned authority fixtures model the completed forward chain. Only fixture
        # plan/profile identities differ; the production schema is never relaxed.
        self.resolution=strict_json(safe_file(pc.ROOT/ca.BACKUP_RESOLUTION_DESIGN))
        for kind in ['newCompletionAuthoritySchema','freshValidationAuthoritySchema']:
            self.resolution[kind]['fields']['sealedPlanSha256']={'const':self.plan.digest}
        self.resolution['packageLockImpact']['fields']['sealedPlanSha256']={'const':self.plan.digest}
        self.resolution['bindings']['currentPackageHashes']['target_profiles.json']=sha(canonical(self.profiles))
        self.resolution_raw=canonical(self.resolution)
        self.stack.enter_context(patch.object(ca,'BACKUP_RESOLUTION_DESIGN_SHA',sha(self.resolution_raw)))
        original=pc.safe_file
        def read(path,*args,**kw):
            path=Path(path)
            if path==pc.PROFILE_PATH:return canonical(self.profiles)
            if path==pc.ROOT/ca.BACKUP_RESOLUTION_DESIGN:return self.resolution_raw
            if path==pc.ROOT/ca.BACKUP_RESOLUTION_VALIDATION:return self.future()[2]
            if path==pc.ROOT/ca.BACKUP_IMPLEMENTATION:return self.future()[0]
            if path==pc.ROOT/ca.BACKUP_PACKAGE_LOCK:return self.future()[1]
            if path==pc.ROOT/ca.BACKUP_BASELINE:return canonical(self.baseline)
            if path==pc.ROOT/ca.BACKUP_IDENTITY:return self.identity_raw
            return original(path,*args,**kw)
        self.stack.enter_context(patch('plan_contract.safe_file',read))
        self.stack.enter_context(patch.object(ca,'BACKUP_BASELINE_SHA',sha(canonical(self.baseline))))
        self.life=ca.BackupLifecycle(self.plan)
        old=auth_for(self.plan);old.update(contract='exact-single-operator-authorization/'+('1' if self.plan.fixture else '2'),scope=ca.BACKUP_SCOPE,
            targetIdentity=self.life.identity(),runtimeBoundary=self.life.runtime(),credentialIdentitySha256=None if self.plan.fixture else 'c'*64,
            observedAt=time.time()-1100,expiresAt=time.time()-100,nonce=uuid.uuid4().hex)
        if not self.plan.fixture:old['transportRiskAcceptance']=pc.RISK_BINDING.copy()
        self.oldraw=canonical(old)+b'  \n';self.oldsha=sha(self.oldraw)
        self.life.canonical.write_bytes(self.oldraw);self.life.canonical.chmod(0o600)
        self.identity_raw=canonical({'rawSha256':self.oldsha,'credentialIdentitySha256':old['credentialIdentitySha256']})
        self.stack.enter_context(patch.object(ca,'BACKUP_LEGACY_SHA',self.oldsha))
        self.stack.enter_context(patch.object(ca,'BACKUP_IDENTITY_SHA',sha(self.identity_raw)))
        self.out=None;self.approval=None

    def future(self):
        """Complete D13 /2 leaves for this owned fixture, not published authority.

        Copy all closed V4/predecessor/selection fields from the pinned design;
        only current package, fixture plan and raw hash links are derived here.
        These declared PASS counts are unit input data, never validation results.
        """
        ca,pc=self.ca,self.pc;p=pc.package_hashes()
        common=dict(designProposalSha256=ca.BACKUP_DESIGN_SHA,packageHashes=p,packageDigest=sha(canonical(p)),sealedPlanSha256=self.plan.digest,registrySha256=sha(safe_file(pc.REGISTRY_PATH)),recordedAt=self.completed)
        def sample(fields):
            data={}
            for k,v in fields.items():
                if isinstance(v,dict) and 'const' in v:data[k]=copy.deepcopy(v['const'])
                elif isinstance(v,dict) and 'closedFields' in v:data[k]={n:'d'*64 for n in v['closedFields']}
            return data
        validation=sample(self.resolution['freshValidationAuthoritySchema']['fields'])
        validation.update(common,resolutionDesignProposalSha256=ca.BACKUP_RESOLUTION_DESIGN_SHA)
        vr=canonical(validation)
        impl=sample(self.resolution['newCompletionAuthoritySchema']['fields'])
        impl.update(common,resolutionDesignProposalSha256=ca.BACKUP_RESOLUTION_DESIGN_SHA,validationCompletionSha256=sha(vr))
        raw=canonical(impl)
        lock=sample(self.resolution['packageLockImpact']['fields'])
        lock.update(common,implementationEvidenceSha256=sha(raw))
        return raw,canonical(lock),vr

    def issue(self,changes=None):
        import uuid
        ca,pc=self.ca,self.pc;v=self.life.authority();now=time.time()
        completed=self.out is not None and (self.life.root/'outcomes'/(self.out['authorizationRawSha256']+'.json')).exists()
        provenance={'kind':'COMPLETED_BACKUP' if completed else 'HISTORICAL_BOOTSTRAP','authorizationRawSha256':self.out['authorizationRawSha256'] if completed else self.oldsha,'outcomeSha256':sha(safe_file(self.life.root/'outcomes'/(self.out['authorizationRawSha256']+'.json'),True)) if completed else None}
        a={'contract':'backup-execution-approval/1','approvalId':uuid.uuid4().hex,'scope':ca.BACKUP_SCOPE,'planId':'acl-000-v1',
           'explicitUserApproval':True,'humanApprovalSha256':sha(uuid.uuid4().bytes),'operatorUid':os.getuid(),'observedAt':now-1,'expiresAt':now+800,
           'maximumBackupAttempts':1,'maximumOwnedRecoveryAttempts':1,'freshPreinstallAuthorized':False,'migrationInstallAuthorized':False,'deploymentAuthorized':False,'automaticRetry':False,
           'implementationEvidenceSha256':v['implementationSha'],'forwardPackageLockSha256':v['lockSha'],'designProposalSha256':ca.BACKUP_DESIGN_SHA,
           'packageHashes':v['package'],'packageDigest':v['digest'],'sealedPlanSha256':self.plan.digest,'registrySha256':sha(safe_file(pc.REGISTRY_PATH)),
           'migrationRawSha256':self.plan.migration['rawSha256'],'migrationBodySha256':self.plan.migration['bodySha256'],'targetProfile':self.plan.data['targetProfile'],
           'targetIdentity':self.life.identity(),'runtimeBoundary':self.life.runtime(),'sourcePrefixSha256':self.plan.data['ledger']['sourcePrefixSha256'],
           'ledgerDescriptorSha256':self.descriptor,'catalogBeforeSha256':self.catalog,'baselineAuthoritySha256':ca.BACKUP_BASELINE_SHA,
           'credentialIdentitySha256':None if self.plan.fixture else 'c'*64,'credentialIdentityProvenance':provenance,
           'transportRiskAcceptance':None if self.plan.fixture else pc.RISK_BINDING.copy(),
           'expectedCanonicalState':{'state':'ABSENT_TERMINAL' if completed else 'HISTORICAL_USED_EXPIRED','rawSha256':None if completed else self.oldsha}}
        a.update(changes or {});return self.write_approval(a)

    def write_approval(self,a):
        raw=canonical(a)+b'\n';p=self.life.approvals/(a['approvalId']+'.json');p.write_bytes(raw);p.chmod(0o600);self.approval=a
        return a['approvalId'],sha(raw)

    def mint(self):
        self.args=self.issue();self.out=self.life.mint(*self.args);return self.out

    def fake_backup(self,*args):
        import uuid
        from teaching_agent_single_migration_runner_backup_test import RecoveryV1Facts
        if not self.plan.fixture and self.identity_mode!='SYNTHETIC_ARTIFACT':
            raise AssertionError('SYNTHETIC_ARTIFACT_IDENTITY_REQUIRED')
        auth=strict_json(safe_file(self.life.canonical,True))
        facts=RecoveryV1Facts(auth=auth,plan=self.plan,endpoint=self.endpoint)
        p=self.backups/('exact-single-'+uuid.uuid4().hex)
        return facts.write(p)

    def historical_backup_fixture(self):
        import uuid
        from teaching_agent_single_migration_runner_backup_test import RecoveryV1Facts
        # Separate old-package artifact: never used to satisfy a fresh success.
        facts=RecoveryV1Facts(legacy=True)
        return facts,facts.write(self.backups/('exact-single-'+uuid.uuid4().hex))

    def complete(self,lease):
        import uuid
        lease['dispatch']();p=self.fake_backup();mh=sha(safe_file(p/'metadata/manifest.json',True))
        receipt={'state':'SUCCESS','backupManifestSha256':mh,'planId':'acl-000-v1','planSha256':self.plan.digest,'nextMigrationAllowed':False}
        name=uuid.uuid4().hex+'.backup.json';rh=exclusive(self.receipts/name,receipt)
        lease.update(backupDirectory=str(p),backupManifestSha256=mh,runnerReceiptName=name,runnerReceiptSha256=rh)

    def runner_patches(self,constructor=None,backup=None):
        import contextlib,runner
        stack=contextlib.ExitStack();orig=runner.safe_file
        stack.enter_context(patch('runner.load_plan',return_value=self.plan))
        stack.enter_context(patch('runner.safe_file',lambda p,*a:self.pc.safe_file(p,*a) if p==self.pc.PROFILE_PATH else orig(p,*a)))
        stack.enter_context(patch('runner.MaintenanceTransport',side_effect=constructor or (lambda *a:object())))
        stack.enter_context(patch('runner.capture_backup',side_effect=backup or self.fake_backup))
        return stack

    def run(self,constructor=None,backup=None):
        import runner
        with self.runner_patches(constructor,backup):return runner.main(['backup','--plan','acl-000-v1'])

    def close(self):self.stack.close()
    def __enter__(self):return self
    def __exit__(self,*args):self.close()


class BackupAuthorizationLifecycle(unittest.TestCase):
    def setUp(self):
        self.h=BackupLifecycleOwned(identity_mode=_backup_identity_mode(self));self.addCleanup(self.h.close);self.ca=self.h.ca

    def denied(self,fn,code=None):
        with self.assertRaises((Failure,OSError)) as cm:fn()
        if code:self.assertEqual(cm.exception.code,code)
        return cm.exception

    def no_attempt(self,h=None):
        with (h or self.h).life.attempt():self.fail('unexpected authorized entry')

    def outcome(self,h=None):
        h=h or self.h;return read_record_for_test(h.life.root/'outcomes'/(h.out['authorizationRawSha256']+'.json'))

    def fork(self,fn):
        import multiprocessing
        ctx=multiprocessing.get_context('fork');q=ctx.Queue()
        def child():
            try:fn();q.put('OK')
            except Failure as e:q.put(e.code)
        p=ctx.Process(target=child);p.start();p.join(15)
        self.assertFalse(p.is_alive());self.assertEqual(p.exitcode,0);return q.get(timeout=2)

    def crash(self,kind,body=False):
        import multiprocessing
        args=self.h.issue() if not body else None
        ctx=multiprocessing.get_context('fork')
        def child():
            original=self.ca.BackupLifecycle._write
            def write(life,path,k,data):
                result=original(life,path,k,data)
                if k==kind or k=='phase' and data['phase']==kind:os._exit(91)
                return result
            with patch.object(self.ca.BackupLifecycle,'_write',write):
                if body:
                    with self.h.life.attempt() as lease:self.h.complete(lease)
                else:self.h.life.mint(*args)
            os._exit(92)
        p=ctx.Process(target=child);p.start();p.join(15);self.assertFalse(p.is_alive());self.assertEqual(p.exitcode,91)

    def test_BACKUP_AUTH_01_occupied_bootstrap(self):
        with patch.object(MaintenanceTransport,'__init__',side_effect=AssertionError('forbidden')),patch('subprocess.Popen',side_effect=AssertionError('forbidden')):
            out=self.h.mint()
        self.assertEqual(out['state'],'MINT_READY');self.assertEqual(list((self.h.life.root/'dispatch').iterdir()),[])
        self.assertEqual((self.h.life.archive/(self.h.oldsha+'.json')).read_bytes(),self.h.oldraw)

    def test_BACKUP_AUTH_02_archive_exact_bytes(self):
        before=self.h.life.canonical.stat();self.h.mint();p=self.h.life.archive/(self.h.oldsha+'.json');after=p.stat()
        self.assertEqual(p.read_bytes(),self.h.oldraw);self.assertNotEqual(self.h.oldsha,sha(canonical(strict_json(self.h.oldraw))))
        for k in ['st_ino','st_dev','st_mode','st_uid','st_gid']:self.assertEqual(getattr(before,k),getattr(after,k))

    def test_BACKUP_AUTH_03_archive_collision(self):
        args=self.h.issue()
        with self.h.life.locked():pass
        p=self.h.life.archive/(self.h.oldsha+'.json');p.write_bytes(self.h.oldraw);p.chmod(0o600)
        self.denied(lambda:self.h.life.mint(*args));self.assertEqual(self.h.life.canonical.read_bytes(),self.h.oldraw);self.assertEqual(p.read_bytes(),self.h.oldraw)

    def test_BACKUP_AUTH_04_old_hash_and_active(self):
        for change in [{'expectedCanonicalState':{'state':'HISTORICAL_USED_EXPIRED','rawSha256':'0'*64}}, {'credentialIdentityProvenance':{'kind':'HISTORICAL_BOOTSTRAP','authorizationRawSha256':'0'*64,'outcomeSha256':None}}]:
            self.denied(lambda:self.h.life.mint(*self.h.issue(change)))
        old=strict_json(self.h.oldraw);old['expiresAt']=time.time()+500;raw=canonical(old);h=sha(raw);self.h.life.canonical.write_bytes(raw)
        self.h.oldsha=h;self.h.identity_raw=canonical({'rawSha256':h,'credentialIdentitySha256':'c'*64})
        with patch.object(self.ca,'BACKUP_LEGACY_SHA',h),patch.object(self.ca,'BACKUP_IDENTITY_SHA',sha(self.h.identity_raw)):
            self.denied(lambda:self.h.life.mint(*self.h.issue()),'BACKUP_AUTH_OLD_ACTIVE')

    def test_BACKUP_AUTH_05_symlink_paths(self):
        for role in ['canonical','archive','pending','lockpath','approvals']:
            with BackupLifecycleOwned() as h:
                args=h.issue()
                with h.life.locked():pass
                p=getattr(h.life,role);saved=p.with_name(p.name+'-saved');p.rename(saved);p.symlink_to(saved)
                self.denied(lambda:h.life.mint(*args));self.assertTrue(p.is_symlink())

    def test_BACKUP_AUTH_06_file_identity(self):
        args=self.h.issue();p=self.h.life.canonical;p.chmod(0o644);self.denied(lambda:self.h.life.mint(*args));self.assertEqual(p.stat().st_mode&0o777,0o644);p.chmod(0o600)
        os.link(p,self.h.home/'linked');self.denied(lambda:self.h.life.mint(*args));(self.h.home/'linked').unlink()
        with patch.object(self.ca.os,'getuid',return_value=os.getuid()+1):self.denied(lambda:self.h.life.mint(*args))
        self.h.receipts.chmod(0o755);self.denied(lambda:self.h.life.mint(*args));self.assertEqual(self.h.receipts.stat().st_mode&0o777,0o755)

    def test_BACKUP_AUTH_07_lock_busy(self):
        args=self.h.issue()
        with self.h.life.locked():
            inode=self.h.life.lockpath.stat().st_ino;start=time.monotonic()
            self.assertEqual(self.fork(lambda:self.h.life.mint(*args)),'BACKUP_AUTH_LOCK_BUSY')
            self.assertLess(time.monotonic()-start,5);self.assertEqual(self.h.life.lockpath.stat().st_ino,inode)

    def test_BACKUP_AUTH_08_two_mints(self):
        import multiprocessing
        args=self.h.issue();ctx=multiprocessing.get_context('fork');gate=ctx.Event();q=ctx.Queue()
        def child():
            gate.wait(5)
            try:q.put(self.h.life.mint(*args)['state'])
            except Failure as e:q.put(e.code)
            except OSError:q.put('IO_DENIED')
        ps=[ctx.Process(target=child) for _ in range(2)]
        for p in ps:p.start()
        gate.set()
        for p in ps:p.join(15);self.assertFalse(p.is_alive());self.assertEqual(p.exitcode,0)
        values=[q.get(timeout=2) for _ in ps];self.assertEqual(values.count('MINT_READY'),1)
        self.assertEqual(len(list((self.h.life.root/'ready').iterdir())),1)

    def test_BACKUP_AUTH_09_mint_runner_race(self):
        self.h.mint();args=self.h.issue()
        with self.h.life.attempt() as lease:
            self.assertEqual(self.fork(lambda:self.h.life.mint(*args)),'BACKUP_AUTH_LOCK_BUSY');self.h.complete(lease)
        self.assertFalse(self.h.life.canonical.exists())

    def test_BACKUP_AUTH_10_two_runners(self):
        import multiprocessing
        self.h.mint();ctx=multiprocessing.get_context('fork');gate=ctx.Event();q=ctx.Queue();seen=self.h.root/'constructor'
        def constructor(*args):
            fd=os.open(seen,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600);os.close(fd);return object()
        def child():gate.wait(5);q.put(self.h.run(constructor))
        ps=[ctx.Process(target=child) for _ in range(2)]
        for p in ps:p.start()
        gate.set()
        for p in ps:p.join(15);self.assertFalse(p.is_alive());self.assertEqual(p.exitcode,0)
        self.assertEqual(sorted(q.get(timeout=2) for _ in ps),[0,1]);self.assertTrue(seen.exists());self.assertEqual(len(list((self.h.life.root/'consumed').iterdir())),1)

    def test_BACKUP_AUTH_11_wrong_scope_contract(self):
        for changes in [{'scope':'READ_ONLY_BASELINE_CAPTURE'},{'contract':'capture-execution-approval/1'},{'extra':False}]:self.denied(lambda:self.h.life.mint(*self.h.issue(changes)))
        self.h.mint();raw=read_record_for_test(self.h.life.canonical);raw['contract']='exact-single-operator-authorization/1';self.h.life.canonical.write_bytes(canonical(raw));self.denied(self.no_attempt)

    def test_BACKUP_AUTH_12_package_binding(self):
        for digest in ['7e79fa3d6efa468498662ec0187b244abb0061c48d29d310143d49aa2a794f2d','865ad349c7ce38bc74bf4dbb88dccb566b269568ba3e16b2fe23d2b2572730cc']:
            self.denied(lambda:self.h.life.mint(*self.h.issue({'packageDigest':digest})))
        self.h.mint();p=self.h.life.root/'operations';folder=next(p.iterdir());x=read_record_for_test(folder/'STAGED.json');x['packageDigest']='0'*64;(folder/'STAGED.json').write_bytes(canonical(x));self.denied(self.no_attempt)

    def test_BACKUP_AUTH_13_expiry_types(self):
        for k,v in [('expiresAt',0),('observedAt',time.time()+10),('expiresAt',True),('expiresAt',float('nan')),('expiresAt',float('inf')),('expiresAt',time.time()+2000)]:
            self.denied(lambda:self.h.life.mint(*self.h.issue({k:v})))
        self.h.mint();a=read_record_for_test(self.h.life.canonical);self.assertLessEqual(a['expiresAt'],self.h.approval['expiresAt'])

    def test_BACKUP_AUTH_14_fresh_nonce(self):
        import uuid
        old_nonce=strict_json(self.h.oldraw)['nonce'];args=self.h.issue();original=uuid.uuid4;seen=[]
        def new():u=original();seen.append(u.hex);return u
        with patch.object(self.ca.uuid,'uuid4',new):out=self.h.life.mint(*args)
        a=read_record_for_test(self.h.life.canonical);self.assertEqual(len(seen),2);self.assertEqual(a['nonce'],seen[1]);self.assertNotEqual(a['nonce'],old_nonce)
        for p in self.h.life.root.rglob('*.json'):self.assertNotIn(a['nonce'].encode(),p.read_bytes())

    def test_BACKUP_AUTH_15_nonce_replay(self):
        import uuid
        self.h.mint();nonce=read_record_for_test(self.h.life.canonical)['nonce']
        with self.h.life.attempt() as lease:self.h.complete(lease)
        args=self.h.issue();vals=iter([uuid.uuid4(),uuid.UUID(nonce)])
        with patch.object(self.ca.uuid,'uuid4',side_effect=lambda:next(vals)):self.denied(lambda:self.h.life.mint(*args),'BACKUP_AUTH_REPLAY')
        self.assertFalse(self.h.life.canonical.exists())

    def test_BACKUP_AUTH_16_approval_replay(self):
        self.h.mint();args=self.h.args;human=self.h.approval['humanApprovalSha256']
        with self.h.life.attempt() as lease:self.h.complete(lease)
        self.denied(lambda:self.h.life.mint(*args));self.denied(lambda:self.h.life.mint(*self.h.issue({'humanApprovalSha256':human})),'BACKUP_AUTH_REPLAY')
        self.assertTrue((self.h.life.root/'claims'/'approval-raw'/(args[1]+'.json')).exists())

    def test_BACKUP_AUTH_17_auth_hash_claim(self):
        self.h.mint();r=self.h.life.verify_ready(self.h.out['authorizationRawSha256']);self.assertNotEqual(r['authorizationRawSha256'],r['authorizationCanonicalSha256'])
        p=self.h.life.root/'claims'/'auth-raw'/(r['authorizationRawSha256']+'.json');self.assertEqual(sha(p.read_bytes()),r['claimHashes']['auth-raw'])
        self.denied(lambda:self.ca.record(p,read_record_for_test(p)));self.denied(lambda:self.h.life.mint(*self.h.issue()))

    def test_BACKUP_AUTH_18_ready_absent(self):
        self.h.mint();next((self.h.life.root/'ready').iterdir()).unlink()
        with patch('runner.MaintenanceTransport',side_effect=AssertionError('forbidden')):self.denied(self.no_attempt)
        self.assertEqual(list((self.h.life.root/'consumed').iterdir()),[])

    def test_BACKUP_AUTH_19_ready_malformed(self):
        self.h.mint();p=next((self.h.life.root/'ready').iterdir());raw=p.read_bytes()
        for delta in [{'extra':1},{'scope':'READ_ONLY_BASELINE_CAPTURE'},{'packageDigest':'0'*64},{'claimHashes':{}}]:
            x=strict_json(raw);x.update(delta);p.write_bytes(canonical(x));self.denied(self.no_attempt)
        self.assertEqual(list((self.h.life.root/'consumed').iterdir()),[])

    def test_BACKUP_AUTH_20_published_before_ready(self):
        args=self.h.issue();original=self.ca.BackupLifecycle._write
        injected=OSError('owned write failure');ready_writes=[]
        def fail(life,path,kind,data):
            if kind=='ready':
                ready_writes.append(path)
                raise injected
            return original(life,path,kind,data)
        with patch.object(self.ca.BackupLifecycle,'_write',fail):
            with self.assertRaises(OSError) as caught:self.h.life.mint(*args)
        self.assertIs(caught.exception,injected);self.assertEqual(len(ready_writes),1)
        current=self.h.life.canonical.read_bytes();self.assertNotEqual(current,self.h.oldraw)
        published=list((self.h.life.root/'operations').glob('*/PUBLISHED.json'))
        self.assertEqual(len(published),1);phase=read_record_for_test(published[0])
        self.assertEqual(phase['phase'],'PUBLISHED');self.assertEqual(phase['newAuthorizationRawSha256'],sha(current))
        self.assertEqual(phase['oldAuthorizationRawSha256'],self.h.oldsha)
        self.assertEqual(ready_writes,[self.h.life.root/'ready'/(sha(current)+'.json')])
        self.assertEqual(list((self.h.life.root/'ready').iterdir()),[])
        self.assertTrue(self.h.life.canonical.exists());self.denied(self.no_attempt);self.denied(lambda:self.h.life.mint(*self.h.issue()))

    def test_BACKUP_AUTH_21_consume_before_credentials(self):
        self.h.mint();seen=[]
        def constructor(*args):
            path=self.h.life.root/'consumed'/(self.h.out['authorizationRawSha256']+'.json');c=read_record_for_test(path)
            self.assertEqual(c['state'],'CONSUMED_PRE_CREDENTIAL');self.assertEqual(c['humanApprovalSha256'],self.h.approval['humanApprovalSha256']);self.assertEqual(c['packageDigest'],sha(canonical(package_hashes())));seen.append(True);raise Failure('PRECHECK_FAILED','OWNED_STOP')
        self.assertEqual(self.h.run(constructor),1);self.assertEqual(seen,[True]);self.assertEqual(self.outcome()['state'],'BACKUP_NOT_DISPATCHED')

    def test_BACKUP_AUTH_22_consume_replay(self):
        self.h.mint();raw=self.h.life.canonical.read_bytes();self.assertEqual(self.h.run(),0)
        self.h.life.canonical.write_bytes(raw);self.h.life.canonical.chmod(0o600);self.denied(self.no_attempt,'BACKUP_AUTH_CONSUMED')

    def test_BACKUP_AUTH_23_constructor_failure(self):
        self.h.mint();primary=Failure('PRECHECK_FAILED','OWNED_CONSTRUCTOR')
        def fail(*args):raise primary
        self.assertEqual(self.h.run(fail),1);self.assertEqual(self.outcome()['state'],'BACKUP_NOT_DISPATCHED');self.assertFalse(self.h.life.canonical.exists());self.assertEqual(list((self.h.life.root/'dispatch').iterdir()),[])

    def test_BACKUP_AUTH_24_backup_failure(self):
        self.h.mint();seen=[]
        def fail(*args):seen.append(True);raise Failure('BACKUP_FAILED','OWNED_BODY')
        self.assertEqual(self.h.run(backup=fail),1);self.assertEqual(seen,[True]);self.assertEqual(self.outcome()['state'],'BACKUP_FAILED');self.assertFalse(self.h.life.canonical.exists())

    def test_BACKUP_AUTH_25_backup_success(self):
        self.h.mint();self.assertEqual(self.h.run(),0);self.assertEqual(self.outcome()['state'],'BACKUP_SUCCESS')
        self.h.life.verify_terminal(self.h.out['authorizationRawSha256']);r=read_record_for_test(next(self.h.receipts.glob('*.backup.json')));self.assertEqual(set(r),{'state','backupManifestSha256','planId','planSha256','nextMigrationAllowed'})

    def test_BACKUP_AUTH_26_canonical_inactive(self):
        self.h.mint();raw=self.h.life.canonical.read_bytes();self.assertEqual(self.h.run(),0);self.assertFalse(self.h.life.canonical.exists())
        self.assertEqual((self.h.life.archive/(sha(raw)+'.json')).read_bytes(),raw);self.denied(self.no_attempt)

    def test_BACKUP_AUTH_27_crash_A(self):
        self.crash('PREPARED');self.assertEqual(self.h.life.canonical.read_bytes(),self.h.oldraw);self.denied(lambda:self.h.life.mint(*self.h.issue()))

    def test_BACKUP_AUTH_28_crash_B(self):
        self.crash('ARCHIVED');self.assertFalse(self.h.life.canonical.exists());self.assertEqual((self.h.life.archive/(self.h.oldsha+'.json')).read_bytes(),self.h.oldraw);self.denied(self.no_attempt)

    def test_BACKUP_AUTH_29_crash_C(self):
        self.crash('STAGED');self.assertEqual(len(list(self.h.life.pending.iterdir())),1);self.assertFalse(self.h.life.canonical.exists());self.denied(self.no_attempt)

    def test_BACKUP_AUTH_30_crash_D(self):
        self.crash('PUBLISHED');self.assertTrue(self.h.life.canonical.exists());self.assertEqual(list((self.h.life.root/'ready').iterdir()),[]);self.denied(self.no_attempt)

    def test_BACKUP_AUTH_31_crash_E(self):
        self.crash('ready');self.assertEqual(list((self.h.life.root/'dispatch').iterdir()),[]);self.assertEqual(self.h.run(),0)

    def test_BACKUP_AUTH_32_crash_F(self):
        self.h.mint();self.crash('consumption',True);self.assertEqual(len(list((self.h.life.root/'consumed').iterdir())),1);self.assertEqual(list((self.h.life.root/'outcomes').iterdir()),[]);self.denied(self.no_attempt)

    def test_BACKUP_AUTH_33_crash_G(self):
        self.h.mint();self.crash('dispatch',True);self.assertEqual(len(list((self.h.life.root/'dispatch').iterdir())),1);self.assertEqual(list((self.h.life.root/'results').iterdir()),[]);self.denied(self.no_attempt)

    def test_BACKUP_AUTH_34_crash_H(self):
        self.h.mint();self.crash('result',True);self.assertTrue(self.h.life.canonical.exists());self.assertEqual(len(list(self.h.receipts.glob('*.backup.json'))),1);self.denied(self.no_attempt)

    def test_BACKUP_AUTH_35_crash_I(self):
        self.h.mint();self.crash('terminal-archive',True);self.assertFalse(self.h.life.canonical.exists());self.assertEqual(list((self.h.life.root/'outcomes').iterdir()),[]);self.denied(self.no_attempt)

    def test_BACKUP_AUTH_36_no_archive_fallback(self):
        import errno
        from unittest.mock import Mock
        args=self.h.issue()
        for err in [errno.ENOSYS,errno.EXDEV,errno.EINVAL,errno.EOPNOTSUPP,errno.EEXIST,errno.EIO]:
            with BackupLifecycleOwned() as h:
                a=h.issue();libc=Mock();libc.renameat2.return_value=-1
                with patch.object(self.ca.ctypes,'CDLL',return_value=libc),patch.object(self.ca.ctypes,'get_errno',return_value=err),patch('os.replace',side_effect=AssertionError('forbidden')):
                    self.denied(lambda:h.life.mint(*a))
                self.assertEqual(h.life.canonical.read_bytes(),h.oldraw);self.assertEqual(libc.renameat2.call_count,1)

    def test_BACKUP_AUTH_37_no_retry(self):
        for kind in ['phase','claim','bootstrap','ready']:
            with BackupLifecycleOwned() as h:
                args=h.issue();original=self.ca.BackupLifecycle._write;seen=[]
                def fail(life,path,k,data):
                    if k==kind:seen.append(k);raise OSError('owned IO')
                    return original(life,path,k,data)
                with patch.object(self.ca.BackupLifecycle,'_write',fail):self.denied(lambda:h.life.mint(*args))
                self.assertEqual(seen,[kind])

    def test_BACKUP_AUTH_38_privacy(self):
        self.h.mint();nonce=read_record_for_test(self.h.life.canonical)['nonce'];sentinel='password='+sha(os.urandom(16))
        error=RuntimeError(sentinel)
        with self.assertRaises(RuntimeError) as cm:
            with self.h.life.attempt() as lease:lease['dispatch']();raise error
        self.assertIs(cm.exception,error)
        for p in self.h.life.root.rglob('*.json'):
            raw=p.read_bytes();self.assertNotIn(sentinel.encode(),raw);self.assertNotIn(nonce.encode(),raw);self.assertNotIn(b'Traceback',raw)

    def test_BACKUP_AUTH_39_no_credentials_in_mint(self):
        import socket
        args=self.h.issue();original=os.open;seen=[]
        def opened(path,*a,**kw):
            if not isinstance(path,int):
                text=os.fsdecode(path);self.assertNotIn('/.config/uply-first-enable-20260910/',text);self.assertNotIn('pgpass',text);seen.append(text)
            return original(path,*a,**kw)
        with patch('os.open',opened),patch.object(socket,'socket',side_effect=AssertionError('network forbidden')),patch('subprocess.Popen',side_effect=AssertionError('subprocess forbidden')),patch.object(MaintenanceTransport,'__init__',side_effect=AssertionError('transport forbidden')):
            self.h.life.mint(*args)
        self.assertTrue(seen)

    def test_BACKUP_AUTH_40_identity_provenance(self):
        for p in [{'kind':'CAPTURE_ARCHIVE','authorizationRawSha256':self.h.oldsha,'outcomeSha256':None},{'kind':'HISTORICAL_BOOTSTRAP','authorizationRawSha256':'f'*64,'outcomeSha256':None},{'kind':'HISTORICAL_BOOTSTRAP','authorizationRawSha256':self.h.oldsha,'outcomeSha256':None,'path':'/tmp/anything'}]:self.denied(lambda:self.h.life.mint(*self.h.issue({'credentialIdentityProvenance':p})))
        self.h.mint();self.assertEqual(self.h.run(),0);self.assertEqual(self.h.life.mint(*self.h.issue())['state'],'MINT_READY')

    def test_BACKUP_AUTH_41_identity_drift_runtime(self):
        self.h.mint();seen=[]
        def fail(*args):seen.append(True);raise Failure('TARGET_IDENTITY_MISMATCH','CREDENTIAL_FILE_IDENTITY')
        self.assertEqual(self.h.run(fail),1);self.assertEqual(seen,[True]);self.assertEqual(self.outcome()['state'],'BACKUP_NOT_DISPATCHED');self.denied(self.no_attempt)

    def test_BACKUP_AUTH_42_human_execution_boundary(self):
        cases=[({'contract':c},'BACKUP_AUTH_CHAIN') for c in [
            'backup-authorization-lifecycle-implementation/1','backup-authorization-lifecycle-package-lock/1',
            'post-hardening-backup-recovery-execution-authority/1','capture-execution-approval/1']]
        cases.extend([({'explicitUserApproval':False},'BACKUP_AUTH_CHAIN'),
                      ({'humanApprovalSha256':self.ca.BACKUP_BASELINE_SHA},'BACKUP_AUTH_OLD_HUMAN_APPROVAL')])
        for changes,code in cases:
            with self.subTest(changes=changes):
                args=self.h.issue(changes)
                with self.assertRaises(Failure) as caught:self.h.life.mint(*args)
                self.assertEqual(caught.exception.code,code)

    def test_BACKUP_AUTH_43_capture_cannot_backup(self):
        self.h.mint();c=self.h.home/'acl-000-v1.capture.json';c.write_bytes(self.h.life.canonical.read_bytes());c.chmod(0o600)
        self.h.life.canonical.unlink();self.denied(self.no_attempt)
        self.assertEqual(list((self.h.life.root/'consumed').iterdir()),[])

    def test_BACKUP_AUTH_44_backup_cannot_capture(self):
        p=self.h.home/'capture-archive';p.mkdir(mode=0o700);marker=p/'owned.json';marker.write_bytes(b'{}');marker.chmod(0o600);before=marker.read_bytes()
        self.h.mint();a=read_record_for_test(self.h.life.canonical)
        with self.assertRaises(Failure):self.h.pc.authorize_capture(self.h.plan,a)
        self.assertEqual(self.h.run(),0);self.assertEqual(marker.read_bytes(),before)

    def test_BACKUP_AUTH_45_namespace_claims(self):
        self.h.mint();a=read_record_for_test(self.h.life.canonical);nh=self.ca._backup_nonce(a['nonce'])
        self.assertNotEqual(nh,sha(a['nonce'].encode()));self.assertEqual(nh,sha(canonical({'scope':'BACKUP_READ_EXPORT','nonce':a['nonce']})))
        self.assertTrue((self.h.life.root/'claims'/'nonce'/(nh+'.json')).exists());self.assertFalse((self.h.receipts/'authorization-rotations').exists())

    def test_BACKUP_AUTH_46_receipt_durability(self):
        seen=[];original=os.fsync
        with patch.object(self.ca.os,'fsync',side_effect=lambda fd:(seen.append(fd),original(fd))[1]):self.h.mint()
        files=list(self.h.life.root.rglob('*.json'));self.assertGreaterEqual(len(seen),len(files)*2)
        for p in files:
            s=p.stat();self.assertEqual(s.st_mode&0o777,0o600);self.assertEqual(s.st_uid,os.getuid());self.assertEqual(s.st_nlink,1);self.assertFalse(p.is_symlink())
        for p in self.h.life.root.rglob('*'):
            if p.is_dir():self.assertEqual(p.stat().st_mode&0o777,0o700)
        p=next((self.h.life.root/'ready').iterdir());raw=p.read_bytes();self.denied(lambda:self.ca.record(p,{}));self.assertEqual(p.read_bytes(),raw)

    def test_BACKUP_AUTH_47_primary_terminal_double_failure(self):
        self.h.mint();primary=Failure('BACKUP_FAILED','OWNED_PRIMARY');original=self.ca.move_exact
        def fail(src,dst,h):
            if src==self.h.life.canonical:raise OSError('owned secondary')
            return original(src,dst,h)
        with patch.object(self.ca,'move_exact',fail):
            with self.assertRaises(Failure) as cm:
                with self.h.life.attempt() as lease:lease['dispatch']();raise primary
        self.assertIs(cm.exception,primary);secondary=read_record_for_test(next((self.h.life.root/'secondary').iterdir()));self.assertEqual(secondary['primaryFailure']['detailSha256'],sha(canonical([primary.state,primary.code])));self.assertEqual(secondary['secondaryFailure']['codeClass'],'LIFECYCLE_ARCHIVE');self.assertTrue(self.h.life.canonical.exists());self.denied(self.no_attempt)

    def test_BACKUP_AUTH_48_terminal_only_failure(self):
        self.h.mint();original=self.ca.BackupLifecycle._write;hits=[]
        injected=OSError('owned final write')
        def fail(life,path,kind,data):
            if kind=='outcome':hits.append((kind,injected));raise injected
            return original(life,path,kind,data)
        with patch.object(self.ca.BackupLifecycle,'_write',fail):self.assertEqual(self.h.run(),1)
        self.assertEqual(hits,[('outcome',injected)])
        self.assertEqual(len(list(self.h.receipts.glob('*.backup.json'))),1);self.assertFalse(self.h.life.canonical.exists());self.assertEqual(list((self.h.life.root/'outcomes').iterdir()),[])

    def test_BACKUP_AUTH_49_bootstrap_truthful(self):
        self.h.mint();b=read_record_for_test(self.h.life.root/'bootstrap'/(self.h.oldsha+'.json'))
        self.assertEqual(b['status'],'HISTORICAL_USED_NO_FORMAL_CONSUME');self.assertIs(b['formalHistoricalConsume'],False)
        for k,v in self.ca.BACKUP_LINEAGE.items():self.assertEqual(b[k],v[1])
        self.assertNotIn('consumedAt',b);self.assertEqual(list((self.h.life.root/'consumed').iterdir()),[])

    def test_BACKUP_AUTH_50_preconsume_entry_failure(self):
        self.h.mint();self.crash('entry',True);self.assertEqual(len(list((self.h.life.root/'runner-entry').iterdir())),1);self.assertEqual(list((self.h.life.root/'consumed').iterdir()),[]);self.denied(self.no_attempt);self.denied(lambda:self.h.life.mint(*self.h.issue()))

    def test_BACKUP_AUTH_51_source_risk_drift(self):
        args=self.h.issue()
        with patch.object(self.h.pc,'risk_guard',side_effect=Failure('APPROVAL_MISSING','RISK_ACCEPTANCE_SCOPE_EXPIRED')):self.denied(lambda:self.h.life.mint(*args))
        self.assertEqual(self.h.life.canonical.read_bytes(),self.h.oldraw)
        with patch.object(self.h.pc,'package_hashes',return_value={}):self.denied(lambda:self.h.life.mint(*args),'BACKUP_AUTH_PACKAGE_MEMBERSHIP')

    def test_BACKUP_AUTH_52_backup_null_fields(self):
        self.h.mint();a=read_record_for_test(self.h.life.canonical)
        self.assertEqual(set(a),self.h.pc.AUTH_FIELDS|{'transportRiskAcceptance'});self.assertEqual(len(a),22);self.assertEqual(a['contract'],'exact-single-operator-authorization/2');self.assertIsNone(a['backupDirectory']);self.assertIsNone(a['backupManifestSha256']);authorize(self.h.plan,a,'BACKUP_READ_EXPORT')

    def test_BACKUP_AUTH_53_runner_other_modes(self):
        import ast,runner
        tree=ast.parse((OPS/'runner.py').read_text());branch=next(x for x in ast.walk(tree) if isinstance(x,ast.If) and ast.unparse(x.test)=="args.command == 'backup'")
        calls=[ast.unparse(x.func) for x in ast.walk(branch) if isinstance(x,ast.Call)];self.assertNotIn('Engine',calls);self.assertEqual(calls.count('capture_backup'),1)
        self.h.mint()
        with patch('runner.Engine',side_effect=AssertionError('Engine forbidden')):self.assertEqual(self.h.run(),0)
        for flag in ['--force','--retry','--path','--dsn','--profile','--reuse']:
            with self.assertRaises(SystemExit):self.ca.main(['mint-backup','--plan','acl-000-v1','--approval-id','a'*32,'--approval-sha256','b'*64,flag])

    def test_BACKUP_AUTH_54_owned_runner_success(self):
        import teaching_agent_single_migration_runner_postgres_test as pg
        from backup_adapter import capture_backup
        with pg.fixture.Fixture() as f,BackupLifecycleOwned(f) as h:
            before=f.state();h.mint();calls=[]
            def backup(*args):calls.append(True);return capture_backup(*args)
            self.assertEqual(h.run(lambda *a:f.transport,backup),0);self.assertEqual(calls,[True]);self.assertEqual(self.outcome(h)['state'],'BACKUP_SUCCESS');self.assertEqual(f.state(),before)
            p=next(h.backups.glob('*/metadata/restore.json'));r=read_record_for_test(p);self.assertEqual(r['network'],'none');self.assertEqual(r['hostPorts'],0);self.assertFalse(r['sourceCredentialsMounted']);self.assertEqual(r['cleanup'],'OWNED_CONTAINER_REMOVED')

    def test_BACKUP_AUTH_55_owned_runner_failure(self):
        import teaching_agent_single_migration_runner_postgres_test as pg
        from backup_adapter import capture_backup
        from maintenance_transport import _diagnostic_phase
        with pg.fixture.Fixture() as f,BackupLifecycleOwned(f) as h:
            h.mint();primary=Failure('BACKUP_FAILED','RESTORE_CATALOG_OR_COUNTS_MISMATCH');calls=[]
            def fail(*args):
                calls.append(True)
                with _diagnostic_phase('E8'):raise primary
            with patch('backup_adapter._restore',side_effect=fail):self.assertEqual(h.run(lambda *a:f.transport,capture_backup),1)
            self.assertEqual(calls,[True])
            self.assertEqual(self.outcome(h)['state'],'BACKUP_FAILED');self.assertFalse(h.life.canonical.exists());self.denied(lambda:self.no_attempt(h))
            terminal=read_record_for_test(next((h.root/'backup-diagnostics').glob('*/terminal.json')))
            self.assertEqual(terminal['primaryFailure']['phase'],'E8');self.assertEqual(terminal['primaryFailure']['code'],primary.code)
            self.assertEqual(terminal['cleanupSecondaryFailures'],[]);self.assertEqual(terminal['diagnosticPersistenceStatus'],'DURABLE')
            result=read_record_for_test(next((h.life.root/'results').iterdir()))
            self.assertEqual(result['primaryFailure']['detailSha256'],sha(canonical([primary.state,primary.code])))

    def test_BACKUP_AUTH_56_capture_fixture_regression(self):
        import plan_contract as pc
        actual=pc.load_plan('acl-000-v1');self.assertEqual(actual.data['status'],'READY_FOR_INSTALL')
        h=LifecycleOwned()
        try:
            self.assertEqual(h.plan.data['status'],'DRAFT_NOT_EXECUTABLE');self.assertIsNone(h.plan.data['ledger']['sourcePrefixSha256']);self.assertFalse(h.plan.fixture);self.assertIs(pc.load_plan('acl-000-v1'),h.plan)
            h.mint()
        finally:h.close()
        self.assertEqual(pc.load_plan('acl-000-v1').digest,actual.digest)
        # Both helpers preserve the sealed target identity. Keep the capture
        # profile isolated from the outer backup helper; do not reorder guards.
        before=copy.deepcopy(self.h.profiles);capture_profiles=copy.deepcopy(before)
        real_profile=strict_json(safe_file(pc.PROFILE_PATH))['profiles'][actual.data['targetProfile']]
        capture_profile=capture_profiles['profiles'][actual.data['targetProfile']]
        capture_profile['hostIdentitySha256']=real_profile['hostIdentitySha256']
        self.assertEqual(capture_profile['transportSecurity'],pc.transport_policy(capture_profile))
        original=pc.safe_file
        def capture_read(path,*args):
            return canonical(capture_profiles) if path==pc.PROFILE_PATH else original(path,*args)
        with patch.object(pc,'safe_file',capture_read):
            with self.assertRaises(Failure) as cm:pc.authorize_capture(actual,capture_auth(actual))
        self.assertEqual(cm.exception.code,'CAPTURE_DRAFT_REQUIRED')
        self.assertEqual(self.h.profiles,before)


class BackupImplementationAuthority(unittest.TestCase):
    """Authority edges only: owned files and synthetic completion chains."""
    def setUp(self):
        import socket
        self.h=BackupLifecycleOwned(identity_mode=_backup_identity_mode(self));self.addCleanup(self.h.close);self.ca=self.h.ca
        for target in ['subprocess.Popen','maintenance_transport.MaintenanceTransport.__init__']:
            p=patch(target,side_effect=AssertionError('authority test capability forbidden'));p.start();self.addCleanup(p.stop)
        p=patch.object(socket,'socket',side_effect=AssertionError('network forbidden'));p.start();self.addCleanup(p.stop)
        self.paths=[self.h.pc.ROOT/x for x in [self.ca.BACKUP_IMPLEMENTATION,self.ca.BACKUP_PACKAGE_LOCK,self.ca.BACKUP_RESOLUTION_VALIDATION]]
        self.old=ROOT/self.ca.BASE/'r7d-c3b-backup-authorization-lifecycle-implementation.json'

    def docs(self):return [strict_json(x) for x in self.h.future()]

    def encoded(self,docs=None,validation_link=True,lock_link=True):
        d=copy.deepcopy(docs if docs is not None else self.docs());vr=canonical(d[2])
        if validation_link:d[0]['validationCompletionSha256']=sha(vr)
        ir=canonical(d[0])
        if lock_link:d[1]['implementationEvidenceSha256']=sha(ir)
        return [ir,canonical(d[1]),vr]

    def reading(self,raws=None,extra=None):
        import contextlib
        @contextlib.contextmanager
        def scope():
            data=dict(zip(self.paths,self.encoded() if raws is None else raws));data.update(extra or {})
            previous=self.h.pc.safe_file;seen=[]
            def read(path,*args,**kwargs):
                path=Path(path);seen.append(path)
                if path==self.old:raise AssertionError('historical success read forbidden')
                if path in data:
                    value=data[path]
                    if value is None:raise FileNotFoundError('owned missing evidence')
                    if callable(value):return value()
                    return value
                return previous(path,*args,**kwargs)
            with patch.object(self.h.pc,'safe_file',read):yield seen
        return scope()

    def reject(self,docs=None,raws=None,validation_link=True,lock_link=True):
        raw=self.encoded(docs,validation_link,lock_link) if raws is None else raws
        with self.reading(raw) as seen:
            with self.assertRaises((Failure,OSError)):self.h.life.authority()
        self.assertNotIn(self.old,seen);self.assertEqual(self.h.life.canonical.read_bytes(),self.h.oldraw)

    def test_BACKUP_AUTHORITY_01_new_completion_accepted(self):
        before=sha(safe_file(self.old));raw=self.encoded()
        with self.reading(raw) as seen:
            result=self.h.life.authority();self.assertEqual(result['implementationSha'],sha(raw[0]));self.assertEqual(result['lockSha'],sha(raw[1]));self.assertEqual(result['completedAt'],self.h.completed)
            self.assertEqual(self.h.mint()['state'],'MINT_READY')
        self.assertNotIn(self.old,seen);self.assertTrue(set(self.paths)<=set(seen));self.assertEqual(sha(safe_file(self.old)),before)
        self.assertEqual(list((self.h.life.root/'dispatch').iterdir()),[])

    def test_BACKUP_AUTHORITY_02_missing_completion_no_fallback(self):
        args=self.h.issue();raw=self.encoded();raw[0]=None
        for old in [b'{"status":"IMPLEMENTATION_BLOCKED"}',self.encoded()[0]]:
            with self.reading(raw,{self.old:old}) as seen:
                with self.assertRaises(FileNotFoundError):self.h.life.authority()
                with self.assertRaises(FileNotFoundError):self.h.life.mint(*args)
                self.assertNotIn(self.old,seen)
        self.assertEqual(self.h.life.canonical.read_bytes(),self.h.oldraw);self.assertFalse(self.h.life.root.exists())
        source=(OPS/'capture_authorization.py').read_text();start=source.index('    def authority(self):',source.index('class BackupLifecycle:'));end=source.index('\n    @contextlib.contextmanager',start)
        for forbidden in ['glob(','iterdir(','mtime','os.environ','BACKUP_LEGACY_SHA','implementation.json']:self.assertNotIn(forbidden,source[start:end])

    def test_BACKUP_AUTHORITY_03_old_contract_and_wrong_status(self):
        cases=[('contract','backup-authorization-lifecycle-implementation/1'),('status','IMPLEMENTATION_BLOCKED'),('status','VALIDATION_COMPLETE'),('status',None),('status',True)]
        for key,value in cases:
            d=self.docs();d[0][key]=value;self.reject(d)
        d=self.docs();del d[0]['status'];self.reject(d)
        raw=self.encoded();raw[0]=safe_file(self.old);self.reject(raws=raw)

    def test_BACKUP_AUTHORITY_04_raw_completion_hash_binding(self):
        raw=self.encoded();oldsha=sha(raw[0]);raw[0]+=b' \n';self.assertNotEqual(sha(raw[0]),oldsha);self.reject(raws=raw)
        lock=strict_json(raw[1]);lock['implementationEvidenceSha256']=sha(raw[0]);raw[1]=canonical(lock)
        with self.reading(raw):
            self.assertEqual(self.h.life.authority()['implementationSha'],sha(raw[0]))
            args=self.h.issue({'implementationEvidenceSha256':oldsha})
            with self.assertRaises(Failure):self.h.life.approval(*args)

    def test_BACKUP_AUTHORITY_05_validation_hash_and_selection(self):
        d=self.docs();d[0]['validationCompletionSha256']='f'*64;self.reject(d,validation_link=False)
        raw=self.encoded();raw[2]=None;self.reject(raws=raw)
        for key,value in [('contract','wrong/1'),('status','IMPLEMENTATION_COMPLETE'),('historicalValidationCompletionSha256','f'*64),('selectedTestIdsSha256','f'*64),('packageDigest','f'*64)]:
            d=self.docs();d[2][key]=value;self.reject(d)
        groups=self.h.resolution['futureValidation']['orderedGroups'];ids=[tid for g in groups for tid in g['testIds']]
        for changed in [ids[:-1],ids[:-1]+[ids[0]],list(reversed(ids))]:
            d=self.docs();d[2]['selectedTestIdsSha256']=sha(canonical(changed));self.reject(d)
        for k in ['failed','errors','skipped','notRun']:
            d=self.docs();d[2]['validation'][k]=1;self.reject(d)

    def test_BACKUP_AUTHORITY_06_current_package_exactness(self):
        current=self.h.pc.package_hashes();historical=self.h.resolution['bindings']['currentPackageHashes']
        self.assertNotEqual(current['capture_authorization.py'],historical['capture_authorization.py'])
        for index in range(3):
            for key,value in [('packageHashes',historical),('packageDigest','a'*64),('packageHashes',{k:v for k,v in current.items() if k!='runner.py'}),('packageHashes',dict(current,extra='e'*64))]:
                d=self.docs();d[index][key]=copy.deepcopy(value);self.reject(d)
        for changed in [{},dict(current,extra='e'*64),dict(current,**{'runner.py':'f'*64})]:
            with patch.object(self.h.pc,'package_hashes',return_value=changed):
                with self.assertRaises(Failure):self.h.life.authority()
        self.assertEqual(len(current),10)

    def test_BACKUP_AUTHORITY_07_forward_lock_binding(self):
        for k,v in [('implementationEvidenceSha256',sha(safe_file(self.old))),('implementationEvidenceSha256','f'*64),('designProposalSha256','f'*64),('sealedPlanSha256','f'*64),('registrySha256','f'*64),('contract','wrong/1'),('status','IMPLEMENTATION_COMPLETE'),('packageEntries',True),('recordedAt',self.h.completed-1),('recordedAt',True),('recordedAt',time.time()+3600),('extra',None)]:
            d=self.docs();d[1][k]=v;self.reject(d,lock_link=False)
        for k in ['productionExecutionAuthorized','backupExecutionAuthorized','freshPreinstallAuthorized','migrationInstallAuthorized']:
            for v in [True,0,None]:
                d=self.docs();d[1][k]=v;self.reject(d)
        d=self.docs();del d[1]['contract'];self.reject(d)
        raw=self.encoded();raw[1]=None;self.reject(raws=raw)

    def test_BACKUP_AUTHORITY_08_external_approval_binding(self):
        raw=self.encoded()
        with self.reading(raw):
            args=self.h.issue();a=self.h.life.approval(*args);self.assertEqual(len(a),35);self.assertEqual(set(a),self.ca.BACKUP_APPROVAL_FIELDS)
            self.assertEqual(a['implementationEvidenceSha256'],sha(raw[0]));self.assertEqual(a['forwardPackageLockSha256'],sha(raw[1]));self.assertEqual(a['designProposalSha256'],self.ca.BACKUP_DESIGN_SHA)
            for k,v in [('implementationEvidenceSha256',sha(safe_file(self.old))),('forwardPackageLockSha256','f'*64),('observedAt',self.h.completed-1),('contract','backup-authorization-lifecycle-implementation-completion/1'),('resolutionDesignSha256','f'*64)]:
                args=self.h.issue({k:v})
                with self.assertRaises(Failure):self.h.life.approval(*args)
            args=self.h.write_approval(dict(strict_json(raw[0]),approvalId='a'*32))
            with self.assertRaises(Failure):self.h.life.approval(*args)
        self.assertFalse(self.h.life.root.exists());self.assertEqual(self.h.life.canonical.read_bytes(),self.h.oldraw)

    def test_BACKUP_AUTHORITY_09_closed_schema_and_types(self):
        for index in [0,2]:
            for key,value in [('extra',1),('recordedAt',True),('recordedAt',0),('recordedAt',-1),('recordedAt',time.time()+3600),('recordedAt',float('nan')),('recordedAt',float('inf')),('historicalEvidencePreserved',1),('historicalAuthorizationPreserved',0),('productionCounters',[]),('validation',[]),('migrationLocks',[]),('packageHashes',[]),('validationContextHashes',{})]:
                d=self.docs();d[index][key]=value;self.reject(d)
            for value in [True,0.0,1,'0']:
                d=self.docs();d[index]['productionCounters']['productionDBConnections']=value;self.reject(d)
            for k,value in [('historicalResultsReused',True),('failed',False),('passed',499.0)]:
                d=self.docs();d[index]['validation'][k]=value;self.reject(d)
            for value in ['A'*64,'z'*64,'1'*63,1,None]:
                d=self.docs();key=next(iter(d[index]['validationContextHashes']));d[index]['validationContextHashes'][key]=value;self.reject(d)
            for mutate in [lambda x:x.pop('status'),lambda x:x['migrationLocks'][0].update(extra=0),lambda x:x['productionCounters'].update(extra=0)]:
                d=self.docs();mutate(d[index]);self.reject(d)
            raw=self.encoded();raw[index]=raw[index][:-1]+b',"status":"DUPLICATE"}';self.reject(raws=raw)
        for mutate in [lambda x:x['groups']['historicalAuthority'].update(passed=True),lambda x:x['groups'].update(extra={}),lambda x:x['candidateArtifacts'].pop(),lambda x:x['resultHashes'].update(extra='a'*64),lambda x:x.update(ownedContainersRemaining=False),lambda x:x.update(privacyAuditPassed=1)]:
            d=self.docs();mutate(d[2]);self.reject(d)
        d=self.docs();d[2]['recordedAt']=self.h.completed+1;self.reject(d)

    def test_BACKUP_AUTHORITY_10_fixed_paths_file_safety(self):
        import stat
        raw=self.encoded();directory=self.h.root/'evidence';directory.mkdir(mode=0o700);file=directory/'completion.json';file.write_bytes(raw[0]);file.chmod(0o600)
        def using(path):
            changed=list(raw);changed[0]=lambda:safe_file(path,True)
            return changed
        link=directory/'link.json';link.symlink_to(file);self.reject(raws=using(link))
        parent=self.h.root/'linked-parent';parent.symlink_to(directory,target_is_directory=True);self.reject(raws=using(parent/'completion.json'))
        file.chmod(0o644);self.reject(raws=using(file));file.chmod(0o600)
        hard=directory/'hard.json';os.link(file,hard);self.reject(raws=using(file));hard.unlink()
        def wrong_uid():
            with patch('receipts.os.getuid',return_value=os.getuid()+1):return safe_file(file,True)
        changed=list(raw);changed[0]=wrong_uid;self.reject(raws=changed)
        def raced():
            s=list(file.stat());s[1]+=1
            with patch('receipts.os.fstat',return_value=os.stat_result(s)):return safe_file(file,True)
        changed=list(raw);changed[0]=raced;self.reject(raws=changed)
        with self.reading(raw) as seen,patch.dict(os.environ,{'BACKUP_IMPLEMENTATION':str(link),'BACKUP_RESOLUTION_VALIDATION':str(link)}):
            self.h.life.authority();self.assertNotIn(link,seen);self.assertTrue(set(self.paths)<=set(seen))
        self.assertTrue(self.ca.BACKUP_IMPLEMENTATION.endswith('-implementation-completion.json'))
        self.assertTrue(self.ca.BACKUP_RESOLUTION_VALIDATION.endswith('-authority-resolution-validation-completion.json'))
        with self.assertRaises(TypeError):self.h.life.authority(path=str(file))

    def test_BACKUP_AUTHORITY_11_lineage_and_history_preserved(self):
        names=['originalDesign','historicalBlockedImplementation','historicalValidationCompletion','validatedPackageCandidateEvidence'];refs=self.h.resolution['bindings'];before={n:sha(safe_file(ROOT/refs[n]['path'])) for n in names}
        for n in names:self.assertEqual(before[n],refs[n]['rawSha256'])
        for index in [0,2]:
            for k in ['designProposalSha256','resolutionDesignProposalSha256','historicalBlockedImplementationSha256','historicalValidationCompletionSha256','historicalValidatedPackageCandidateEvidenceSha256','historicalValidatedPackageCandidateDigest','historicalAuthorizationSha256']:
                d=self.docs();d[index][k]='f'*64;self.reject(d)
            d=self.docs();d[index]['migrationLocks'][0]['rawSha256']='f'*64;self.reject(d)
            d=self.docs();d[index]['historicalEvidencePreserved']=False;self.reject(d)
            d=self.docs();d[index]['historicalAuthorizationPreserved']=False;self.reject(d)
        with self.reading(extra={ROOT/self.ca.BACKUP_RESOLUTION_DESIGN:self.h.resolution_raw+b' '}):
            with self.assertRaises(Failure):self.h.life.authority()
        self.h.life.authority();self.assertEqual({n:sha(safe_file(ROOT/refs[n]['path'])) for n in names},before)

    def test_BACKUP_AUTHORITY_12_acyclic_publication_and_revalidation(self):
        directory=self.h.root/'publication';directory.mkdir(mode=0o700);files=[directory/n for n in ['completion.json','lock.json','validation.json']]
        docs=self.docs();docs[0]['recordedAt']=self.h.completed+1;docs[1]['recordedAt']=self.h.completed+2;raw=self.encoded(docs)
        for forbidden in ['forwardPackageLockSha256','packageLockSha256','implementationEvidenceSha256','ownSha256']:
            self.assertNotIn(forbidden,docs[0])
        self.assertNotIn('validationCompletionSha256',docs[2])
        exclusive(files[2],strict_json(raw[2]));docs[0]['validationCompletionSha256']=sha(safe_file(files[2],True));exclusive(files[0],docs[0]);docs[1]['implementationEvidenceSha256']=sha(safe_file(files[0],True))
        readers=[lambda p=p:safe_file(p,True) for p in files]
        with self.reading(readers):
            with self.assertRaises(FileNotFoundError):self.h.life.authority()
            exclusive(files[1],docs[1]);result=self.h.life.authority();self.assertEqual(result['implementationSha'],sha(safe_file(files[0],True)));self.assertEqual(result['completedAt'],docs[1]['recordedAt'])
            args=self.h.issue();self.assertEqual(self.h.life.approval(*args)['implementationEvidenceSha256'],result['implementationSha'])
            before=[safe_file(p,True) for p in files]
            for p in files:
                with self.assertRaises((Failure,OSError)):exclusive(p,{})
            self.assertEqual([safe_file(p,True) for p in files],before)
            # Owned tampering models a changed dependency, never a publication retry.
            files[0].write_bytes(before[0]+b' ')
            with self.assertRaises(Failure):self.h.life.authority()
        self.assertEqual(self.h.life.canonical.read_bytes(),self.h.oldraw);self.assertFalse(self.h.life.root.exists())



def assert_backup_successor_source_scope(case):
    """D13 permits five constants, preserving all executable authority logic."""
    import ast,capture_authorization as ca
    raw=(ROOT/ca.BACKUP_RESOLUTION_DESIGN).read_bytes()
    case.assertEqual(sha(raw),'588f55b25e9738086f403601e7eadb46dc41820b1089e218b1207742bb819f27')
    design=strict_json(raw);source=(OPS/'capture_authorization.py').read_text();tree=ast.parse(source)
    assignments={n.targets[0].id:ast.get_source_segment(source,n) for n in tree.body
        if isinstance(n,ast.Assign) and len(n.targets)==1 and isinstance(n.targets[0],ast.Name)}
    original=design['sourceChangeMinimality']['allCurrentAssignments']
    allowed=set(design['sourceChangeMinimality']['changedAssignments'])
    case.assertEqual(set(assignments),set(original))
    case.assertEqual({k for k in original if original[k]!=assignments[k]},allowed)
    for key in allowed:
        expected=sha(raw) if key=='BACKUP_RESOLUTION_DESIGN_SHA' else design['futureSourceAssignments'][key]
        # The owned fixture may patch the in-memory design pin; inspect source AST.
        expr=ast.parse(assignments[key]).body[0].value
        actual=(ca.BASE+ast.literal_eval(expr.right)) if isinstance(expr,ast.BinOp) else ast.literal_eval(expr)
        case.assertEqual(actual,expected)
    nodes={n.name:n for n in tree.body if isinstance(n,(ast.ClassDef,ast.FunctionDef))}
    cls=nodes['BackupLifecycle']
    nodes.update({'BackupLifecycle.'+n.name:n for n in cls.body if isinstance(n,ast.FunctionDef)})
    anchors=design['sourceChangeMinimality']['allCurrentFunctionAnchors']
    case.assertEqual(set(nodes),set(anchors))
    for name,node in nodes.items():
        case.assertEqual(sha(ast.get_source_segment(source,node).encode()),anchors[name]['sourceSha256'],name)
        case.assertEqual(sha(ast.dump(node,include_attributes=False).encode()),anchors[name]['astSha256'],name)
    imports=[ast.dump(n,include_attributes=False) for n in tree.body if isinstance(n,(ast.Import,ast.ImportFrom))]
    expected_imports=ast.parse('''import argparse
import contextlib
import ctypes
import errno
import fcntl
import math
import os
from pathlib import Path
import re
import stat
import time
import uuid
import json
import plan_contract as pc
from receipts import Failure, safe_file, strict_json, canonical, sha, sanitized, exclusive
''')
    case.assertEqual(imports,[ast.dump(n,include_attributes=False) for n in expected_imports.body])


class BackupV4SuccessorAuthority(unittest.TestCase):
    """D13's 24 closed successor cases; synthetic private authorities only.

    Reuse helpers, not TestCase inheritance: historical IDs remain separate.
    No successful repository completion/lock is needed or created by these tests.
    """
    docs=BackupImplementationAuthority.docs
    encoded=BackupImplementationAuthority.encoded
    reading=BackupImplementationAuthority.reading

    def setUp(self):
        BackupImplementationAuthority.setUp(self)
        self.design=strict_json((ROOT/self.ca.BACKUP_RESOLUTION_DESIGN).read_bytes())
        # Establish that later negative assertions reach their intended gate.
        with self.reading():self.h.life.authority()

    def denied(self,docs=None,raws=None,code='BACKUP_AUTH_SOURCE_AUTHORITY',**links):
        before=self.h.life.canonical.read_bytes()
        with self.reading(self.encoded(docs,**links) if raws is None else raws):
            with self.assertRaises(Failure) as caught:self.h.life.authority()
        if code is not None:self.assertEqual(caught.exception.code,code)
        self.assertEqual(self.h.life.canonical.read_bytes(),before)
        return caught.exception

    def files(self):
        return {str(p.relative_to(self.h.root)):p.read_bytes() for p in self.h.root.rglob('*') if p.is_file()}

    def current_ids(self):
        import ast
        result=[]
        for kind in ['backup','contract','postgres']:
            module='teaching_agent_single_migration_runner_'+kind+'_test'
            tree=ast.parse((ROOT/'tests'/(module+'.py')).read_text())
            result.extend(module+'.'+c.name+'.'+m.name for c in tree.body if isinstance(c,ast.ClassDef)
                for m in c.body if isinstance(m,ast.FunctionDef) and m.name.startswith('test_'))
        return sorted(result)

    def test_BACKUP_AUTHORITY_V4_001_fixed_successor_paths(self):
        paths=self.design['futureFixedSuccessPaths']
        self.assertEqual([self.ca.BACKUP_IMPLEMENTATION,self.ca.BACKUP_PACKAGE_LOCK,self.ca.BACKUP_RESOLUTION_VALIDATION],
                         [paths['completion'],paths['lock'],paths['validation']])
        old={ROOT/x['path'] for x in self.design['predecessorAuthorityBindings'].values()}
        with self.reading() as seen,patch.dict(os.environ,{k:'/tmp/unapproved-authority.json' for k in
                ['BACKUP_IMPLEMENTATION','BACKUP_PACKAGE_LOCK','BACKUP_RESOLUTION_VALIDATION']}):
            self.h.life.authority()
            self.assertTrue(set(self.paths)<=set(seen))
            self.assertFalse({ROOT/paths[k] for k in paths}&old)
            # Original design is still pinned; old successful leaves are not read.
            self.assertFalse({ROOT/self.design['predecessorAuthorityBindings'][k]['path'] for k in
                              ['completion','lock','validation','resolutionDesign']}&set(seen))
            self.assertNotIn(Path('/tmp/unapproved-authority.json'),seen)
        with self.assertRaises(TypeError):self.h.life.authority(path='unapproved')

    def test_BACKUP_AUTHORITY_V4_002_predecessor_binding(self):
        for index in [0,2]:
            for kind in self.docs()[index]['predecessorAuthority']:
                with self.subTest(index=index,kind=kind):
                    d=self.docs();d[index]['predecessorAuthority'][kind]['sha256']='f'*64;self.denied(d)
                    d=self.docs();d[index]['predecessorAuthority'][kind]['path']='history-substitute.json';self.denied(d)
            d=self.docs();d[index]['supersession']['historicalFactsChanged']=True;self.denied(d)
        for ref in self.design['predecessorAuthorityBindings'].values():
            self.assertEqual(sha((ROOT/ref['path']).read_bytes()),ref['sha256'])

    def test_BACKUP_AUTHORITY_V4_003_candidate_name(self):
        for index in [0,2]:
            for name in ['SOURCE_ALIGNED_BOOTSTRAP_AWARE_STAGED_RESTORE_V'+str(v) for v in [1,2,3]]+['unknown']:
                with self.subTest(index=index,name=name):
                    d=self.docs();d[index]['recoveryCandidateName']=name;self.denied(d)

    def test_BACKUP_AUTHORITY_V4_004_candidate_version(self):
        for index in [0,2]:
            for value in [True,4.0,3,5,'4',None]:
                with self.subTest(index=index,value=value):
                    d=self.docs();d[index]['recoveryCandidateVersion']=value;self.denied(d)

    def test_BACKUP_AUTHORITY_V4_005_artifact_contracts(self):
        expected={'manifest':'exact-single-backup/3','restore':'exact-single-owned-restore/3',
                  'provenance':'backup-source-bootstrap-provenance/2','provenanceSchemaVersion':2}
        for index in [0,2]:
            for key,value in expected.items():self.assertEqual(self.docs()[index]['artifactContracts'][key],value)
            for key,value in [('manifest','exact-single-backup/2'),('restore','exact-single-owned-restore/1'),
                              ('provenance','backup-source-bootstrap-provenance/1'),('provenanceSchemaVersion',1),
                              ('requiredFiles',8),('runnerSuccessReceiptFields',6)]:
                with self.subTest(index=index,key=key):
                    d=self.docs();d[index]['artifactContracts'][key]=value;self.denied(d)

    def test_BACKUP_AUTHORITY_V4_006_frozen_nine_entries(self):
        current=self.h.pc.package_hashes();self.assertEqual(len(current),10)
        for name in sorted(current.keys()-{'capture_authorization.py'}):
            with self.subTest(name=name):
                changed=dict(current,**{name:'f'*64})
                # Even coherently regenerated leaves cannot admit an unfrozen member.
                with patch.object(self.h.pc,'package_hashes',return_value=changed):self.denied()

    def test_BACKUP_AUTHORITY_V4_007_authority_member_binding(self):
        old=self.design['bindings']['currentPackageHashes']['capture_authorization.py']
        self.assertNotEqual(self.h.pc.package_hashes()['capture_authorization.py'],old)
        for index in range(3):
            d=self.docs();d[index]['packageHashes']['capture_authorization.py']=old
            d[index]['packageDigest']=sha(canonical(d[index]['packageHashes']));self.denied(d)

    def test_BACKUP_AUTHORITY_V4_008_package_membership(self):
        for index in range(3):
            for mode in ['missing','extra','alias','digest']:
                with self.subTest(index=index,mode=mode):
                    d=self.docs();p=d[index]['packageHashes']
                    if mode=='missing':p.pop('runner.py')
                    if mode=='extra':p['unexpected.py']='e'*64
                    if mode=='alias':p['./runner.py']=p.pop('runner.py')
                    d[index]['packageDigest']='e'*64 if mode=='digest' else sha(canonical(p))
                    self.denied(d)
        with patch.object(self.h.pc,'package_hashes',return_value={}):
            self.denied(code='BACKUP_AUTH_PACKAGE_MEMBERSHIP')

    def test_BACKUP_AUTHORITY_V4_009_historical_success_rejected(self):
        old=self.design['predecessorAuthorityBindings']
        for index,kind in [(0,'completion'),(1,'lock'),(2,'validation')]:
            with self.subTest(kind=kind):
                raws=self.encoded();raws[index]=(ROOT/old[kind]['path']).read_bytes();self.denied(raws=raws)
        d=self.docs();d[0]['contract']='backup-authorization-lifecycle-implementation-completion/1';self.denied(d)
        d=self.docs();d[2]['contract']='backup-authorization-lifecycle-authority-resolution-validation-completion/1';self.denied(d)

    def test_BACKUP_AUTHORITY_V4_010_historical266_selection(self):
        frozen=self.design['futureValidation']['historical266ExactSelection'];ids=frozen['exactIds']
        self.assertEqual(len(ids),266);self.assertEqual(len(set(ids)),266)
        self.assertEqual(sha(canonical(ids)),self.docs()[2]['selectedTestIdsSha256'])
        self.assertTrue(set(ids)<=set(self.current_ids()))
        for changed in [ids[:-1],ids[:-1]+[ids[0]],list(reversed(ids)),ids[:-1]+['replacement']]:
            d=self.docs();d[2]['selectedTestIdsSha256']=sha(canonical(changed));self.denied(d)

    def test_BACKUP_AUTHORITY_V4_011_current499_selection(self):
        actual=self.current_ids();frozen=self.design['futureValidation']['current499ExactIds']
        self.assertEqual(actual,frozen);self.assertEqual(len(actual),499);self.assertEqual(len(set(actual)),499)
        self.assertEqual(sha(canonical(actual)),self.docs()[2]['currentSelectedTestIdsSha256'])
        for changed in [actual[:-1],actual[:-1]+[actual[0]],list(reversed(actual))]:
            d=self.docs();d[2]['currentSelectedTestIdsSha256']=sha(canonical(changed));self.denied(d)

    def test_BACKUP_AUTHORITY_V4_012_raw_all_pass(self):
        for index in [0,2]:
            for key,value in [('failed',1),('errors',1),('skipped',1),('notRun',1),('authorityPendingCount',60),
                              ('historicalResultsReused',True),('passed',498),('methodExecutions',800)]:
                with self.subTest(index=index,key=key):
                    d=self.docs();d[index]['validation'][key]=value;self.denied(d)
        for group in self.docs()[2]['groups']:
            for key in ['failed','errors','skipped','notRun']:
                d=self.docs();d[2]['groups'][group][key]=1;self.denied(d)

    def test_BACKUP_AUTHORITY_V4_013_focused_lineage(self):
        import re
        ids=self.current_ids();old=self.design['futureValidation']['existingCurrent475Ids']
        self.assertEqual(len(old),475);self.assertTrue(set(old)<=set(ids))
        for version,count in [(1,70),(2,25),(3,64),(4,38)]:
            suffixes=[re.search(r'test_BACKUP_RECOVERY_V'+str(version)+r'_(\d{3})(?:_|$)',tid) for tid in ids]
            self.assertEqual(sorted(int(m[1]) for m in suffixes if m),list(range(1,count+1)))
        phases=self.design['futureValidation']['futurePhases']
        self.assertEqual(sum(len(x['testIds']) for x in phases),801)
        self.assertEqual(set().union(*(set(x['testIds']) for x in phases)),set(ids))

    def test_BACKUP_AUTHORITY_V4_014_combined_three_variants(self):
        for index in [0,2]:
            for key,value in [('passed',2),('failed',1),('automaticRetries',1),('researchShimUsed',True),
                              ('finalPackageExact',False),('sourceFrozenExact',False),('allFidelityGatesPassed',False),
                              ('cleanupPassed',False),('ownedContainersRemaining',1),('productionRecoveryValidated',True)]:
                with self.subTest(index=index,key=key):
                    d=self.docs();d[index]['combinedCertification'][key]=value;self.denied(d)
            d=self.docs();d[index]['combinedCertification']['requiredVariants'].pop();self.denied(d)
            d=self.docs();d[index]['priorRecoveryValidation']['classification']='FINAL_PACKAGE_VALIDATION';self.denied(d)
        d=self.docs();d[2]['resultHashes'].pop('final-package-three-variant-certification.json');self.denied(d)

    def test_BACKUP_AUTHORITY_V4_015_result_hashes(self):
        keys=list(self.docs()[2]['resultHashes'])
        for key in keys:
            for value in ['A'*64,'g'*64,'a'*63,True,None]:
                with self.subTest(key=key,value=value):
                    d=self.docs();d[2]['resultHashes'][key]=value;self.denied(d,code='AUTH_IDENTITY_FORMAT')
            d=self.docs();d[2]['resultHashes'].pop(key);self.denied(d)
        d=self.docs();d[2]['resultHashes']['unapproved']='a'*64;self.denied(d)
        # Hash shape is runtime policy; truth of underlying results is a publisher gate.
        self.assertEqual(set(keys),set(self.design['freshValidationAuthoritySchema']['fields']['resultHashes']['closedFields']))

    def test_BACKUP_AUTHORITY_V4_016_prepublication_fail_closed(self):
        args=self.h.issue();before=self.files()
        for index in range(3):
            for value,error in [(None,FileNotFoundError),(b'{}',Failure)]:
                with self.subTest(index=index,value=value):
                    raw=self.encoded();raw[index]=value
                    with self.reading(raw):
                        with self.assertRaises(error):self.h.life.authority()
                        with self.assertRaises(error):self.h.life.mint(*args)
                    self.assertEqual(self.files(),before)
                    self.assertFalse(self.h.life.root.exists());self.assertFalse(self.h.life.lockdir.exists())

    def test_BACKUP_AUTHORITY_V4_017_raw_hash_and_chronology(self):
        for index in [0,2]:
            raw=self.encoded();raw[index]+=b' \n';self.denied(raws=raw)
        d=self.docs();d[0]['recordedAt']=self.h.completed-1;self.denied(d)
        d=self.docs();d[2]['recordedAt']=self.h.completed+1;self.denied(d)
        d=self.docs();d[1]['recordedAt']=self.h.completed-1;self.denied(d)
        raw=self.encoded();d=strict_json(raw[1]);d['implementationEvidenceSha256']='0'*64;raw[1]=canonical(d);self.denied(raws=raw)

    def test_BACKUP_AUTHORITY_V4_018_closed_schema_types(self):
        import math
        for index in [0,2]:
            for key,value in [('recordedAt',True),('recordedAt',float('nan')),('recordedAt',float('inf')),
                              ('recoveryCandidateVersion',4.0),('extra',None)]:
                d=self.docs();d[index][key]=value
                self.denied(d,code='INVALID_JSON' if isinstance(value,float) and not math.isfinite(value) else 'BACKUP_AUTH_SOURCE_AUTHORITY')
            for change in [lambda d:d['validation'].update(passed=499.0),
                           lambda d:d['combinedCertification'].update(finalPackageExact=1),
                           lambda d:d['artifactContracts'].update(provenanceSchemaVersion=True),
                           lambda d:d['supersession'].update(extra=None)]:
                d=self.docs();change(d[index]);self.denied(d)
            raw=self.encoded();raw[index]=raw[index][:-1]+b',"status":"DUPLICATE"}';self.denied(raws=raw,code=None)
        d=self.docs();d[1]['packageEntries']=True;self.denied(d)

    def test_BACKUP_AUTHORITY_V4_019_execution_flags(self):
        fields=['productionExecutionAuthorized','backupExecutionAuthorized','freshPreinstallAuthorized','migrationInstallAuthorized']
        for index in [0,1]:
            for key in fields:
                for value in [True,0,None]:
                    d=self.docs();d[index][key]=value;self.denied(d)
        for index in [0,2]:
            for key in self.docs()[index]['productionCounters']:
                d=self.docs();d[index]['productionCounters'][key]=1;self.denied(d)
            d=self.docs();d[index]['supersession']['executionAuthorized']=True;self.denied(d)
        self.assertFalse(self.h.life.root.exists())

    def test_BACKUP_AUTHORITY_V4_020_five_assignment_scope(self):
        assert_backup_successor_source_scope(self)

    def test_BACKUP_AUTHORITY_V4_021_external_approval_transitive(self):
        raw=self.encoded()
        with self.reading(raw):
            args=self.h.issue();a=self.h.life.approval(*args)
            self.assertEqual(set(a),self.ca.BACKUP_APPROVAL_FIELDS);self.assertEqual(len(a),35)
            self.assertEqual(a['implementationEvidenceSha256'],sha(raw[0]));self.assertEqual(a['forwardPackageLockSha256'],sha(raw[1]))
            self.assertEqual(a['designProposalSha256'],self.ca.BACKUP_DESIGN_SHA)
            for key,value in [('implementationEvidenceSha256','f'*64),('forwardPackageLockSha256','f'*64),
                              ('scope','SINGLE_MIGRATION_APPLY'),('freshPreinstallAuthorized',True),('deploymentAuthorized',True)]:
                changed=self.h.issue({key:value})
                with self.assertRaises(Failure) as caught:self.h.life.approval(*changed)
                self.assertEqual(caught.exception.code,'BACKUP_AUTH_CHAIN')
        RecoveryV1Contract.test_BACKUP_RECOVERY_V1_060(self)
        self.assertFalse(self.h.life.root.exists())

    def test_BACKUP_AUTHORITY_V4_022_artifact_v4_success_binding(self):
        # Authenticate ready/approval/authorization and runner receipt with real
        # lifecycle methods; only leaf inputs and artifact data are test-owned.
        from teaching_agent_single_migration_runner_backup_test import RecoveryV1Facts
        import backup_adapter as ba
        self.assertEqual(self.h.identity_mode,'SYNTHETIC_ARTIFACT');self.assertFalse(self.h.plan.fixture)
        self.assertNotEqual(self.h.pc.RISK_SHA,self.h.canonical_risk_sha)
        self.assertNotEqual(self.h.life.identity()['hostIdentitySha256'],self.h.canonical_profile['hostIdentitySha256'])
        self.h.mint()
        auth=read_record_for_test(self.h.life.canonical)
        with self.assertRaisesRegex(AssertionError,'^SYNTHETIC_ENDPOINT_REQUIRED$'):
            RecoveryV1Facts(auth=auth,plan=self.h.plan)
        with self.assertRaisesRegex(AssertionError,'^SYNTHETIC_ENDPOINT_BINDING_MISMATCH$'):
            RecoveryV1Facts(auth=auth,plan=self.h.plan,endpoint={'host':'mismatched.invalid','port':5432})
        with self.h.life.attempt() as lease:
            self.h.complete(lease)
            ready=self.h.life.verify_ready(self.h.out['authorizationRawSha256'])
            base={k:ready[k] for k in self.ca.BACKUP_COMMON-{'contract','recordedAt'}}
            ids={k:ready[k] for k in self.ca.BACKUP_IDS}
            result=dict(base,**ids,contract=self.ca._backup_contract('result'),recordedAt=time.time(),
                state='BACKUP_SUCCESS',consumptionReceiptSha256=sha(safe_file(self.h.life.root/'consumed'/(ready['authorizationRawSha256']+'.json'),True)),
                dispatchReceiptSha256=sha(safe_file(self.h.life.root/'dispatch'/(ready['authorizationRawSha256']+'.json'),True)),primaryFailure=None,
                **{k:lease[k] for k in ['backupDirectory','backupManifestSha256','runnerReceiptName','runnerReceiptSha256']})
            self.h.life._success(result)
            root=Path(lease['backupDirectory']);manifest=root/'metadata/manifest.json';runner=self.h.receipts/lease['runnerReceiptName']
            proofs=root/'metadata/transport-proofs.json';bundle=strict_json(proofs.read_bytes())
            self.assertEqual(set(bundle['records']),{'exporter','full','schema','roles','afterObservation'})
            for record in bundle['records'].values():
                self.assertEqual(record['proof']['endpoint'],self.h.endpoint)
                self.assertEqual(sha(canonical(record['proof']['endpoint']['host'])),auth['targetIdentity']['hostIdentitySha256'])
            def endpoint_tamper(value):
                record=value['records']['schema'];record['proof']['endpoint']['host']='mismatched.invalid'
                record['sha256']=sha(canonical(record['proof'])+b'\n')
            cases=[('metadata/manifest.json',lambda v:v.update(recoveryCandidateVersion=3)),
                   ('metadata/bootstrap-provenance.json',lambda v:v.update(recoveryCandidateVersion=3)),
                   ('metadata/restore.json',lambda v:v['databaseAclRecovery'].update(rawExact=False)),
                   ('metadata/restore.json',lambda v:v['extensionValidation'].update(finalStateSha256='0'*64)),
                   ('metadata/transport-proofs.json',endpoint_tamper)]
            original={p:p.read_bytes() for p in [manifest,runner,root/'metadata/bootstrap-provenance.json',root/'metadata/restore.json',proofs]}
            for relative,change in cases:
                with self.subTest(relative=relative):
                    try:
                        path=root/relative;data=strict_json(path.read_bytes());change(data);path.write_bytes(canonical(data)+b'\n')
                        m=strict_json(manifest.read_bytes())
                        if path!=manifest:
                            m['files'][relative]={'sha256':sha(path.read_bytes()),'bytes':path.stat().st_size}
                            manifest.write_bytes(canonical(m)+b'\n')
                        mh=sha(manifest.read_bytes());receipt=strict_json(runner.read_bytes());receipt['backupManifestSha256']=mh
                        runner.write_bytes(canonical(receipt)+b'\n')
                        altered=dict(result,backupManifestSha256=mh,runnerReceiptSha256=sha(runner.read_bytes()))
                        if relative=='metadata/transport-proofs.json':
                            with self.assertRaises(Failure) as inner:
                                ba.validate_recovery_artifacts(root,mh,expected_package_digest=result['packageDigest'],
                                    expected_plan_sha=self.h.plan.digest,expected_target_identity=auth['targetIdentity'])
                            self.assertEqual(inner.exception.code,'RESTORE_EVIDENCE_BINDING_MISMATCH')
                        with self.assertRaises(Failure) as caught:self.h.life._success(altered)
                        self.assertEqual(caught.exception.code,'BACKUP_AUTH_RESULT_BINDING')
                    finally:
                        for path,raw in original.items():path.write_bytes(raw)
            self.h.life._success(result)
        terminal=self.h.life.verify_terminal(self.h.out['authorizationRawSha256'])
        self.assertEqual(terminal['state'],'BACKUP_SUCCESS');self.assertFalse(self.h.life.canonical.exists())

    def test_BACKUP_AUTHORITY_V4_023_privacy_and_runtime_free(self):
        import socket,backup_adapter as ba,maintenance_transport as mt
        self.assertEqual(self.h.identity_mode,'CANONICAL_RISK')
        before=self.files();pc=self.h.pc;profiles=copy.deepcopy(self.h.profiles)
        profile=profiles['profiles'][self.h.plan.data['targetProfile']]
        self.assertEqual(profile,self.h.life.profile)
        self.assertEqual(profile['transportSecurity'],pc.transport_policy(profile))
        risk_raw=pc.safe_file(pc.ROOT/pc.RISK_PATH);self.assertEqual(sha(risk_raw),pc.RISK_SHA)
        risk=strict_json(risk_raw)['target'];self.assertEqual(risk['profile'],self.h.plan.data['targetProfile'])
        for key in ['hostIdentitySha256','projectIdentitySha256','database','role','imageId']:
            self.assertEqual(profile[key],risk[key])
        for key,path in {'authorizationDirectory':self.h.home,'receiptRoot':self.h.receipts,
                         'backupRoot':self.h.backups,'buildPath':self.h.build}.items():
            self.assertEqual(Path(profile[key]),path);self.assertTrue(path.is_relative_to(self.h.root));self.assertTrue(path.exists())
        self.assertEqual(profile['buildId'],'OWNED_BUILD')
        with (patch.object(socket,'socket',side_effect=AssertionError('network forbidden')) as network,
              patch('subprocess.Popen',side_effect=AssertionError('process forbidden')) as process,
              patch.object(MaintenanceTransport,'__init__',side_effect=AssertionError('credentials forbidden')) as transport):
            result=self.h.life.authority()
            original=pc.safe_file
            for coherent,code in [(False,'TRANSPORT_PROFILE_MISMATCH'),(True,'PROVIDER_HOP_RISK_NOT_ACCEPTED')]:
                with self.subTest(coherent=coherent):
                    changed=copy.deepcopy(profiles);target=changed['profiles'][self.h.plan.data['targetProfile']]
                    target['hostIdentitySha256']=sha(canonical('synthetic.invalid'))
                    self.assertNotEqual(target['hostIdentitySha256'],risk['hostIdentitySha256'])
                    if coherent:target['transportSecurity']=pc.transport_policy(target)
                    raw_profile=canonical(changed)
                    def read(path,*args,**kwargs):
                        return raw_profile if Path(path)==pc.PROFILE_PATH else original(path,*args,**kwargs)
                    with patch.object(pc,'safe_file',read):
                        with self.assertRaises(Failure) as caught:
                            pc.risk_guard(self.h.plan,{'transportRiskAcceptance':pc.RISK_BINDING.copy()})
                    self.assertEqual(caught.exception.code,code)
                    self.assertIs(pc.safe_file,original);self.assertEqual(self.h.profiles,profiles)
            # Canonical checks above stay real. These additional unit contexts
            # substitute test data pins only and must restore every value alias.
            def snapshot():
                fields=[(pc,'RISK_PATH'),(pc,'RISK_SHA'),(pc,'RISK_BINDING'),
                        (ba,'RISK_BINDING'),(mt,'RISK_BINDING'),(pc,'safe_file'),
                        (pc,'risk_guard'),(ba,'risk_guard'),(mt,'risk_guard'),
                        (pc,'authorize'),(pc,'authorize_capture'),(pc,'transport_policy'),
                        (ba,'validate_recovery_artifacts'),(ba,'capture_backup'),(ba,'_restore'),
                        (self.ca.BackupLifecycle,'authority'),(self.ca.BackupLifecycle,'_success'),
                        (self.ca.BackupLifecycle,'attempt')]
                return [(owner,key,getattr(owner,key),canonical(getattr(owner,key)) if key.startswith('RISK_') else None)
                        for owner,key in fields],tuple(_BACKUP_SYNTHETIC_SCOPES)
            def restored(saved):
                values,scopes=saved
                for owner,key,value,raw in values:
                    self.assertIs(getattr(owner,key),value)
                    if raw is not None:self.assertEqual(canonical(value),raw)
                self.assertEqual(tuple(_BACKUP_SYNTHETIC_SCOPES),scopes)
            def accepted(h):
                binding=pc.RISK_BINDING.copy()
                self.assertEqual(pc.risk_guard(h.plan,{'transportRiskAcceptance':binding}),binding)
                self.assertEqual(binding,ba.RISK_BINDING);self.assertEqual(binding,mt.RISK_BINDING)
                self.assertIsNot(pc.RISK_BINDING,ba.RISK_BINDING);self.assertIsNot(pc.RISK_BINDING,mt.RISK_BINDING)
                raw=pc.safe_file(pc.ROOT/pc.RISK_PATH,True)
                self.assertEqual(sha(raw),pc.RISK_SHA)
                data=strict_json(raw);self.assertIs(data['executionAuthorized'],False)
                self.assertIs(data['productionAccessAllowed'],False)
                self.assertEqual(h.life.profile['transportSecurity'],pc.transport_policy(h.life.profile))
                self.assertEqual(sha(canonical(h.endpoint['host'])),h.life.identity()['hostIdentitySha256'])
                for key in ['hostIdentitySha256','projectIdentitySha256','database','role','imageId']:
                    self.assertEqual(data['target'][key],h.life.profile[key])
                self.assertEqual(Path(pc.RISK_PATH),h.root/'synthetic-risk.json')
                self.assertEqual(Path(pc.RISK_PATH).stat().st_mode&0o777,0o600)
                self.assertEqual(h.root.stat().st_mode&0o777,0o700)
            saved=snapshot()
            with BackupLifecycleOwned(identity_mode='SYNTHETIC_ARTIFACT') as h:
                owned_root=h.root;self.assertFalse(h.root.is_relative_to(self.h.root));accepted(h)
                synthetic_binding=pc.RISK_BINDING.copy();parent=snapshot()
                for kwargs,code in [({},'CANONICAL_IDENTITY_INSIDE_SYNTHETIC_SCOPE'),
                                    ({'fixture':object()},'CANONICAL_IDENTITY_INSIDE_SYNTHETIC_SCOPE'),
                                    ({'fixture':object(),'identity_mode':'SYNTHETIC_ARTIFACT'},'SYNTHETIC_IDENTITY_REQUIRES_NONFIXTURE'),
                                    ({'identity_mode':'UNKNOWN'},'UNKNOWN_BACKUP_IDENTITY_MODE')]:
                    with self.subTest(scopeRejection=code):
                        with self.assertRaisesRegex(AssertionError,'^'+code+'$'):BackupLifecycleOwned(**kwargs)
                        restored(parent)
                bad=pc.RISK_BINDING.copy();bad['riskArtifactSha256']='0'*64
                with self.assertRaises(Failure) as caught:pc.risk_guard(h.plan,{'transportRiskAcceptance':bad})
                self.assertEqual(caught.exception.code,'PROVIDER_HOP_RISK_NOT_ACCEPTED')
                path=Path(pc.RISK_PATH);raw=path.read_bytes()
                try:
                    path.write_bytes(raw+b' ')
                    with self.assertRaises(Failure) as caught:pc.risk_guard(h.plan,{'transportRiskAcceptance':pc.RISK_BINDING.copy()})
                    self.assertEqual(caught.exception.code,'PROVIDER_HOP_RISK_NOT_ACCEPTED')
                finally:path.write_bytes(raw)
                for coherent,code in [(False,'TRANSPORT_PROFILE_MISMATCH'),(True,'PROVIDER_HOP_RISK_NOT_ACCEPTED')]:
                    changed=copy.deepcopy(h.profiles);target=changed['profiles'][h.plan.data['targetProfile']]
                    target['hostIdentitySha256']=sha(canonical('mismatched.invalid'))
                    if coherent:target['transportSecurity']=pc.transport_policy(target)
                    previous=pc.safe_file
                    def changed_read(path,*args,**kwargs):
                        return canonical(changed) if Path(path)==pc.PROFILE_PATH else previous(path,*args,**kwargs)
                    with patch.object(pc,'safe_file',changed_read):
                        with self.assertRaises(Failure) as caught:pc.risk_guard(h.plan,{'transportRiskAcceptance':pc.RISK_BINDING.copy()})
                    self.assertEqual(caught.exception.code,code);restored(parent)
                with BackupLifecycleOwned(identity_mode='SYNTHETIC_ARTIFACT') as nested:
                    nested_root=nested.root;accepted(nested)
                    self.assertNotEqual(nested.synthetic_identity['fixtureId'],h.synthetic_identity['fixtureId'])
                    self.assertNotEqual(nested.synthetic_identity['riskSha256'],h.synthetic_identity['riskSha256'])
                    self.assertNotEqual(nested.root,h.root)
                self.assertFalse(nested_root.exists());restored(parent);accepted(h)
            self.assertFalse(owned_root.exists());restored(saved)
            with self.assertRaises(Failure) as caught:pc.risk_guard(self.h.plan,{'transportRiskAcceptance':synthetic_binding})
            self.assertEqual(caught.exception.code,'PROVIDER_HOP_RISK_NOT_ACCEPTED')
            # Fail a concrete private write after bindings were installed. A
            # failed constructor must unwind even before addCleanup is possible.
            original_write=Path.write_bytes;failed_roots=[];injected=OSError('owned legacy write')
            def fail_legacy_write(path,data):
                if path.name=='acl-000-v1.backup.json' and path.parent.name=='approvals':
                    failed_roots.append(path.parent.parent)
                    self.assertTrue(_BACKUP_SYNTHETIC_SCOPES)
                    self.assertNotEqual(pc.RISK_SHA,self.h.canonical_risk_sha)
                    raise injected
                return original_write(path,data)
            with patch.object(Path,'write_bytes',fail_legacy_write):
                with self.assertRaises(OSError) as caught:BackupLifecycleOwned(identity_mode='SYNTHETIC_ARTIFACT')
            self.assertIs(caught.exception,injected);self.assertEqual(len(failed_roots),1)
            self.assertFalse(failed_roots[0].exists());restored(saved)
            self.assertEqual(pc.risk_guard(self.h.plan,{'transportRiskAcceptance':pc.RISK_BINDING.copy()}),pc.RISK_BINDING)
            network.assert_not_called();process.assert_not_called();transport.assert_not_called()
        self.assertEqual(set(result),{'package','digest','implementationSha','lockSha','completedAt','baseline'})
        self.assertEqual(sanitized(result),result);self.assertEqual(before,self.files())
        raw=canonical(result)
        for forbidden in [b'password=',b'postgresql://',b'CREATE ROLE',b'rawRolesBytes',b'nonce']:
            self.assertNotIn(forbidden,raw)

    def test_BACKUP_AUTHORITY_V4_024_acyclic_publication(self):
        # The original durability test writes only under its private temp root.
        BackupImplementationAuthority.test_BACKUP_AUTHORITY_12_acyclic_publication_and_revalidation(self)
        graph=self.design['dependencyGraph'];order=graph['topologicalOrder']
        self.assertTrue(all(order.index(a)<order.index(b) for a,b in graph['edges']))
        for document in self.docs():self.assertNotIn('ownSha256',document)
        for key in ['forwardPackageLockSha256','packageLockSha256','implementationEvidenceSha256']:
            self.assertNotIn(key,self.docs()[0])
        self.assertNotIn('validationCompletionSha256',self.docs()[2])


class RecoveryV1Contract(unittest.TestCase):
    """Version dispatch unit contracts; no mint or production authority substitution."""
    def setUp(self):
        from teaching_agent_single_migration_runner_backup_test import RecoveryV1Facts
        self.Facts=RecoveryV1Facts
        self.tmp=tempfile.TemporaryDirectory(prefix='owned-recovery-contract-')
        self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name)

    def historical_terminal_fixture(self):
        """Prebuilt synthetic terminal history, not a fresh mint or authority bypass.

        Every envelope/hash is consumed by the real verify_ready/verify_terminal/
        _success methods. No verification method or authority pin is patched.
        """
        import uuid,capture_authorization as ca
        from receipts import private_directory
        plan=ready();life=object.__new__(ca.BackupLifecycle);life.plan=plan
        life.home=private_directory(self.root/'history-auth');life.receipts=private_directory(self.root/'history-receipts')
        life.archive=private_directory(life.home/'archive');life.approvals=private_directory(life.home/'approvals')
        life.root=private_directory(life.receipts/'lifecycle');backups=private_directory(self.root/'history-backups')
        life.canonical=life.home/'never-active.json';life.profile={'backupRoot':str(backups)}
        for name in ca.BACKUP_DIRS:private_directory(life.root/name)
        for name in ca.BACKUP_FAMILIES:private_directory(life.root/'claims'/name)
        oracle=self.Facts(legacy=True);auth=auth_for(plan);now=time.time();aid=uuid.uuid4().hex
        auth.update(scope=ca.BACKUP_SCOPE,packageHashes=oracle.auth['packageHashes'],targetIdentity=oracle.identity,
            runtimeBoundary={'buildId':'OWNED_HISTORY','feature':'OFF','allowlists':'EMPTY'},credentialIdentitySha256=None,
            observedAt=now-1100,expiresAt=now-100,nonce=uuid.uuid4().hex)
        a={k:None for k in ca.BACKUP_APPROVAL_FIELDS}
        a.update(contract='backup-execution-approval/1',approvalId=aid,scope=ca.BACKUP_SCOPE,planId='acl-000-v1',
            explicitUserApproval=True,humanApprovalSha256=sha(uuid.uuid4().bytes),operatorUid=os.getuid(),
            observedAt=now-1200,expiresAt=now-90,maximumBackupAttempts=1,maximumOwnedRecoveryAttempts=1,
            freshPreinstallAuthorized=False,migrationInstallAuthorized=False,deploymentAuthorized=False,automaticRetry=False,
            implementationEvidenceSha256='1'*64,forwardPackageLockSha256='2'*64,designProposalSha256=ca.BACKUP_DESIGN_SHA,
            packageHashes=auth['packageHashes'],packageDigest=sha(canonical(auth['packageHashes'])),sealedPlanSha256=plan.digest,
            registrySha256=sha(safe_file(OPS/'plan_registry.json')),migrationRawSha256=plan.migration['rawSha256'],
            migrationBodySha256=plan.migration['bodySha256'],targetProfile=plan.data['targetProfile'],targetIdentity=auth['targetIdentity'],
            runtimeBoundary=auth['runtimeBoundary'],sourcePrefixSha256=plan.data['ledger']['sourcePrefixSha256'],
            ledgerDescriptorSha256='3'*64,catalogBeforeSha256='4'*64,baselineAuthoritySha256=ca.BACKUP_BASELINE_SHA,
            credentialIdentityProvenance={'kind':'COMPLETED_BACKUP','authorizationRawSha256':'5'*64,'outcomeSha256':'6'*64},
            expectedCanonicalState={'state':'ABSENT_TERMINAL','rawSha256':None})
        ap=life.approvals/(aid+'.json');ah=exclusive(ap,a)
        auth.update(userApprovalRef=str(ap),userApprovalSha256=ah)
        raw=canonical(auth)+b'\n';h=sha(raw);exclusive(life.archive/(h+'.json'),auth,redact=False)
        ids=life._ids(raw);rotation=uuid.uuid4().hex;base=life._base(rotation,a,ah)
        folder=private_directory(life.root/'operations'/rotation);phases={};prev=None
        for phase in ca.PHASES:
            prev=life._write(folder/(phase+'.json'),'phase',dict(base,phase=phase,previousRecordSha256=prev,
                oldAuthorizationRawSha256=None,newAuthorizationRawSha256=h if phase in ('STAGED','PUBLISHED') else None,
                newAuthorizationCanonicalSha256=ids['authorizationCanonicalSha256'] if phase in ('STAGED','PUBLISHED') else None,
                nonceSha256=ids['nonceSha256']))
            phases[phase]=prev
        claims={}
        for family,key in {'approval-id':aid,'approval-raw':ah,'human-approval':a['humanApprovalSha256'],
                           'nonce':ids['nonceSha256'],'auth-raw':h}.items():
            claims[family]=life._write(life.root/'claims'/family/(key+'.json'),'claim',dict(base,family=family,
                identity=key,authorizationRawSha256=h if family=='auth-raw' else None))
        ready_sha=life._write(life.root/'ready'/(h+'.json'),'ready',dict(base,**ids,state='MINT_READY',
            oldAuthorizationRawSha256=None,phaseFileHashes=phases,claimHashes=claims,bootstrapReceiptSha256=None,
            credentialProvenanceSha256='5'*64,observedAt=auth['observedAt'],expiresAt=auth['expiresAt'],maximumBackupAttempts=1))
        entry=life._write(life.root/'runner-entry'/(h+'.json'),'entry',dict(base,**ids,state='CHECKING_READY',maximumBackupAttempts=1))
        consumed=life._write(life.root/'consumed'/(h+'.json'),'consumption',dict(base,**ids,state='CONSUMED_PRE_CREDENTIAL',
            entryReceiptSha256=entry,readyReceiptSha256=ready_sha,maximumBackupAttempts=1))
        dispatched=life._write(life.root/'dispatch'/(h+'.json'),'dispatch',dict(base,**ids,state='BACKUP_DISPATCH_INTENT',
            consumptionReceiptSha256=consumed,maximumBackupAttempts=1))
        facts=self.Facts(auth=auth,plan=plan,legacy=True);path=facts.write(backups/('exact-single-'+uuid.uuid4().hex))
        mh=sha((path/'metadata/manifest.json').read_bytes());rn=uuid.uuid4().hex+'.backup.json'
        rh=exclusive(life.receipts/rn,{'state':'SUCCESS','backupManifestSha256':mh,'planId':'acl-000-v1',
            'planSha256':plan.digest,'nextMigrationAllowed':False})
        result=life._write(life.root/'results'/(h+'.json'),'result',dict(base,**ids,state='BACKUP_SUCCESS',
            consumptionReceiptSha256=consumed,dispatchReceiptSha256=dispatched,backupDirectory=str(path),
            backupManifestSha256=mh,runnerReceiptName=rn,runnerReceiptSha256=rh,primaryFailure=None))
        archived=life._write(life.root/'terminal-archive'/(h+'.json'),'terminal-archive',dict(base,**ids,
            state='TERMINALLY_ARCHIVED',resultReceiptSha256=result,archiveRawSha256=h,canonicalAbsent=True))
        life._write(life.root/'outcomes'/(h+'.json'),'outcome',dict(base,**ids,state='BACKUP_SUCCESS',
            resultReceiptSha256=result,terminalArchiveReceiptSha256=archived,canonicalAbsent=True,nextMigrationAllowed=False))
        return life,h,path

    def test_BACKUP_RECOVERY_V1_058(self):
        facts=self.Facts(legacy=True);path=facts.write(self.root/'legacy')
        with self.assertRaises(Failure):facts.validate(path,historical=False)
        fresh=self.Facts();self.assertEqual(fresh.validate(fresh.write(self.root/'fresh'))['reportVersion'],'exact-single-backup/3')

    def test_BACKUP_RECOVERY_V1_059(self):
        life,h,path=self.historical_terminal_fixture()
        before={str(p):p.read_bytes() for p in self.root.rglob('*') if p.is_file()}
        self.assertEqual(life.verify_terminal(h)['state'],'BACKUP_SUCCESS')
        self.assertEqual(before,{str(p):p.read_bytes() for p in self.root.rglob('*') if p.is_file()})
        # Each immutable link must authenticate before legacy /2 acceptance.
        for p in [life.archive/(h+'.json'),life.root/'ready'/(h+'.json'),
                  life.root/'results'/(h+'.json'),next(life.approvals.glob('*.json')),
                  next(life.receipts.glob('*.backup.json')),path/'metadata/manifest.json']:
            raw=p.read_bytes()
            try:
                p.write_bytes(raw+b' ')
                with self.assertRaises(Failure):life.verify_terminal(h)
            finally:p.write_bytes(raw)
        self.assertEqual(life.verify_terminal(h)['state'],'BACKUP_SUCCESS')

    def test_BACKUP_RECOVERY_V1_060(self):
        import ast
        tree=ast.parse((OPS/'runner.py').read_text())
        expected={'state','backupManifestSha256','planId','planSha256','nextMigrationAllowed'}
        receipts=[n.value for n in ast.walk(tree) if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='receipt' for t in n.targets) and isinstance(n.value,ast.Dict)]
        actual=next(x for x in receipts if any(isinstance(k,ast.Constant) and k.value=='backupManifestSha256' for k in x.keys))
        self.assertEqual({k.value for k in actual.keys},expected)
        self.assertEqual(len(actual.keys),5)



class RecoveryV3Contract(unittest.TestCase):
    """Retained V3 lineage IDs against manifest3/provenance2/restore3; authority remains independent."""
    setUp=RecoveryV1Contract.setUp
    historical_terminal_fixture=RecoveryV1Contract.historical_terminal_fixture

    def facts(self):
        from teaching_agent_single_migration_runner_backup_test import RecoveryV3Facts
        return RecoveryV3Facts()

    def tamper(self,case,name,change):
        facts=self.facts();root=facts.write(self.root/case);path=root/name
        value=json.loads(path.read_bytes());change(value);path.write_bytes(canonical(value)+b'\n')
        mp=root/'metadata/manifest.json';m=json.loads(mp.read_bytes())
        if name!='metadata/manifest.json':
            m['files'][name]={'sha256':sha(path.read_bytes()),'bytes':path.stat().st_size}
            mp.write_bytes(canonical(m)+b'\n')
        with self.assertRaises(Failure):facts.validate(root)

    def test_BACKUP_RECOVERY_V3_057_complete_current_fixture(self):
        f=self.facts();root=f.write(self.root/'fresh');m=f.validate(root)
        self.assertEqual(m['reportVersion'],'exact-single-backup/3');self.assertEqual(len(m['files']),9)
        self.assertEqual(m['recoveryCandidateName'],'SOURCE_ALIGNED_BOOTSTRAP_AWARE_STAGED_RESTORE_V4')
        self.assertEqual(m['recoveryCandidateVersion'],4)
        self.assertEqual(json.loads((root/f.ba.PROVENANCE_PATH).read_bytes())['contract'],'backup-source-bootstrap-provenance/2')
        self.assertEqual(json.loads((root/'metadata/restore.json').read_bytes())['contract'],'exact-single-owned-restore/3')

    def test_BACKUP_RECOVERY_V3_058_fresh_old_candidate_rejected(self):
        for version in [1,2]:
            with self.subTest(version=version):self.tamper(str(version),'metadata/manifest.json',lambda v:v.update(
                recoveryCandidateName='SOURCE_ALIGNED_BOOTSTRAP_AWARE_STAGED_RESTORE_V'+str(version),recoveryCandidateVersion=version))
        legacy=self.Facts(legacy=True);root=legacy.write(self.root/'legacy')
        with self.assertRaises(Failure):legacy.validate(root)

    def test_BACKUP_RECOVERY_V3_059_historical_manifest2_authenticated(self):
        life,h,path=self.historical_terminal_fixture()
        before={str(p):p.read_bytes() for p in self.root.rglob('*') if p.is_file()}
        self.assertEqual(life.verify_terminal(h)['state'],'BACKUP_SUCCESS')
        self.assertEqual(json.loads((path/'metadata/manifest.json').read_bytes())['reportVersion'],'exact-single-backup/2')
        self.assertEqual(before,{str(p):p.read_bytes() for p in self.root.rglob('*') if p.is_file()})
        receipt=life.root/'ready'/(h+'.json');receipt.write_bytes(receipt.read_bytes()+b' ')
        with self.assertRaises(Failure):life.verify_terminal(h)

    def test_BACKUP_RECOVERY_V3_060_candidate_crossbinding_tamper(self):
        for i,(path,key) in enumerate([('metadata/manifest.json','recoveryCandidateVersion'),
                ('metadata/bootstrap-provenance.json','recoveryCandidateVersion'),('metadata/restore.json','recoveryContractVersion')]):
            with self.subTest(path=path):self.tamper(str(i),path,lambda v:v.update({key:2}))

    def test_BACKUP_RECOVERY_V3_061_schema_crossbinding_tamper(self):
        cases=[('metadata/manifest.json',lambda m:m.update(recoveryReportContract='exact-single-owned-restore/1')),
            ('metadata/bootstrap-provenance.json',lambda p:p.update(contract='backup-source-bootstrap-provenance/1',schemaVersion=1)),
            ('metadata/restore.json',lambda r:r.update(contract='exact-single-owned-restore/1')),
            ('metadata/manifest.json',lambda m:m['sourceBootstrapProvenance'].update(path='metadata/wrong.json'))]
        for i,(path,change) in enumerate(cases):
            with self.subTest(case=i):self.tamper(str(i),path,change)

    def test_BACKUP_RECOVERY_V3_062_runner_five_fields(self):
        RecoveryV1Contract.test_BACKUP_RECOVERY_V1_060(self)

    def test_BACKUP_RECOVERY_V3_063_lifecycle_authority_no_bypass(self):
        import ast
        tree=ast.parse((OPS/'capture_authorization.py').read_text())
        cls=next(n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=='BackupLifecycle')
        success=next(n for n in cls.body if isinstance(n,ast.FunctionDef) and n.name=='_success')
        calls=[n for n in ast.walk(success) if isinstance(n,ast.Call)]
        validated=next(n for n in calls if isinstance(n.func,ast.Name) and n.func.id=='validate_recovery_artifacts')
        ready_call=next(n for n in calls if isinstance(n.func,ast.Attribute) and n.func.attr=='verify_ready')
        self.assertLess(ready_call.lineno,validated.lineno)
        self.assertTrue({'expected_package_digest','expected_authorization_sha','expected_target_identity','historical'} <= {k.arg for k in validated.keywords})
        # D13 explicitly permits only five successor constants; no guard bypass.
        assert_backup_successor_source_scope(self)

    def test_BACKUP_RECOVERY_V3_064_private_artifact_state_tamper(self):
        cases=[lambda r:r['extensionValidation']['finalState']['rawAcl'].pop(),
            lambda r:r['extensionValidation'].update(finalStateSha256='0'*64),
            lambda r:r['restoreExecutionContext']['argv'].append('--no-acl'),
            lambda r:r['restoreExecutionContext'].update(archiveInputSha256='0'*64)]
        for i,change in enumerate(cases):
            with self.subTest(case=i):self.tamper(str(i),'metadata/restore.json',change)


class RecoveryV4Contract(unittest.TestCase):
    """DB_ACL_DESIGN_027–033: complete fresh V4 artifacts, strict old-version boundary."""
    setUp=RecoveryV1Contract.setUp
    historical_terminal_fixture=RecoveryV1Contract.historical_terminal_fixture

    def facts(self,grantees=('grantee_z','grantee_a')):
        from teaching_agent_single_migration_runner_backup_test import RecoveryV4Facts
        return RecoveryV4Facts(list(grantees) if grantees is not None else None)

    def tamper(self,label,change,grantees=('grantee_z','grantee_a')):
        f=self.facts(grantees);root=f.write(self.root/label);path=root/'metadata/restore.json'
        value=json.loads(path.read_bytes());change(value);path.write_bytes(canonical(value)+b'\n')
        mp=root/'metadata/manifest.json';m=json.loads(mp.read_bytes());m['files']['metadata/restore.json']={'sha256':sha(path.read_bytes()),'bytes':path.stat().st_size};mp.write_bytes(canonical(m)+b'\n')
        with self.assertRaises(Failure):f.validate(root)

    def test_BACKUP_RECOVERY_V4_027_complete_fresh_v4(self):
        for i,grantees in enumerate([None,['grantee_a'],['grantee_z','grantee_a']]):
            with self.subTest(grantees=grantees):
                f=self.facts(grantees);root=f.write(self.root/str(i));m=f.validate(root)
                self.assertEqual(m['reportVersion'],'exact-single-backup/3');self.assertEqual(len(m['files']),9)
                self.assertEqual(m['recoveryCandidateName'],'SOURCE_ALIGNED_BOOTSTRAP_AWARE_STAGED_RESTORE_V4');self.assertEqual(m['recoveryCandidateVersion'],4)
                self.assertEqual(m['recoveryReportContract'],'exact-single-owned-restore/3')
                p=json.loads((root/f.ba.PROVENANCE_PATH).read_bytes());self.assertEqual(p['contract'],'backup-source-bootstrap-provenance/2');self.assertEqual(p['schemaVersion'],2)
                r=json.loads((root/'metadata/restore.json').read_bytes());d=r['databaseAclRecovery']
                self.assertEqual(d['sourceState'],d['afterState']);self.assertEqual(d['sourceState'],d['finalState']);self.assertEqual(d['grantCount'],len(grantees or []));self.assertEqual(r['phaseResults']['E6_DB_ACL'],'PASS')

    def test_BACKUP_RECOVERY_V4_028_no_old_fallback(self):
        self.tamper('restore2',lambda r:r.update(contract='exact-single-owned-restore/2'))
        self.tamper('missing',lambda r:r.pop('databaseAclRecovery'))
        f=self.facts();root=f.write(self.root/'v3');mp=root/'metadata/manifest.json';m=json.loads(mp.read_bytes());m.update(recoveryCandidateName='SOURCE_ALIGNED_BOOTSTRAP_AWARE_STAGED_RESTORE_V3',recoveryCandidateVersion=3);mp.write_bytes(canonical(m)+b'\n')
        with self.assertRaises(Failure):f.validate(root)

    def test_BACKUP_RECOVERY_V4_029_hash_bindings(self):
        for key in ['sourceStateSha256','sourceBootstrapProvenanceSha256','sourceBootstrapIdentitySha256','archiveInputSha256']:
            with self.subTest(key=key):self.tamper(key,lambda r:r['databaseAclRecovery'].update({key:'0'*64}))
        self.tamper('source-value',lambda r:r['databaseAclRecovery']['sourceState'].update(owner='postgres'))

    def test_BACKUP_RECOVERY_V4_030_execution_bindings(self):
        changes={'orderedGrantees':['grantee_a','grantee_z'],'derivedSql':'GRANT ALL ON DATABASE postgres TO PUBLIC;',
                 'derivedSqlSha256':'0'*64,'derivedSqlBytes':True,'actualStdinSha256':'0'*64,'grantCount':1,
                 'executionCount':True,'returnCode':False,'executionIdentity':{'session_user':'postgres','current_user':'postgres','database':'postgres'}}
        for key,value in changes.items():
            with self.subTest(key=key):self.tamper(key,lambda r:r['databaseAclRecovery'].update({key:value}))

    def test_BACKUP_RECOVERY_V4_031_state_and_flag_tamper(self):
        changes=[lambda d:d['afterState'].update(aclRaw=None),lambda d:d['finalState']['effectiveAcl'].pop(),
                 lambda d:d.update(rawExact=False),lambda d:d.update(expandedExact=False),lambda d:d.update(baselineExact=False),
                 lambda d:d.update(typedTransportFootprintZero=False),lambda d:d.update(status='FAIL'),lambda d:d.update(finalStateSha256='0'*64),
                 lambda d:d.update(extra='unapproved')]
        for i,change in enumerate(changes):
            with self.subTest(case=i):self.tamper(str(i),lambda r:change(r['databaseAclRecovery']))
        self.tamper('missing-phase',lambda r:r['phaseResults'].pop('E6_DB_ACL'))
        self.tamper('staged-premature-source',lambda r:r['stagedPlpgsqlValidation'].update(databaseBefore=r['databaseAclRecovery']['sourceState'],databaseAfter=r['databaseAclRecovery']['sourceState']))

    def test_BACKUP_RECOVERY_V4_032_null_no_execution_claim(self):
        for key,value in [('executionCount',1),('grantCount',1),('actualStdinSha256',sha(b'')),('returnCode',0),('derivedSql','RESET ROLE;\n')]:
            with self.subTest(key=key):self.tamper(key,lambda r:r['databaseAclRecovery'].update({key:value}),None)

    def test_BACKUP_RECOVERY_V4_033_runner_lifecycle_history(self):
        RecoveryV1Contract.test_BACKUP_RECOVERY_V1_060(self)
        RecoveryV3Contract.test_BACKUP_RECOVERY_V3_059_historical_manifest2_authenticated(self)
        RecoveryV3Contract.test_BACKUP_RECOVERY_V3_063_lifecycle_authority_no_bypass(self)


if __name__=='__main__':unittest.main(verbosity=2)
