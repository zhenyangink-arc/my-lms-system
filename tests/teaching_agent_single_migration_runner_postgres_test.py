"""Real new-engine integration on owned network-none PG17. No production adapters."""
import contextlib
import copy
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('owned_runner_fixture',ROOT/'tests/fixtures/teaching-agent-single-migration-runner/postgres.py')
fixture=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixture)
from receipts import Failure,sha,canonical,Journal
from plan_contract import Plan,registry
from checks import ledger_check,run_checks,scope_delta,fingerprint,target,descriptor,inventory_check
from transaction import Engine
from maintenance_transport import _Session
SIG='public.review_chapter_practice_binding(uuid,uuid,integer,jsonb,boolean)'


def reserve_validation_directory():
    import uuid
    parent=ROOT/'docs/evidence/teaching-agent-stage-1f-r7d-c/runner-p1e-a2-validation'
    if parent.is_symlink():raise RuntimeError('unsafe validation parent')
    parent.mkdir(mode=0o700,exist_ok=True)
    path=parent/uuid.uuid4().hex
    path.mkdir(mode=0o700,exist_ok=False)
    return path


class PG(unittest.TestCase):
    def setUp(self):
        if self._testMethodName=='test_RUNNER_D1_51':return
        self.f=fixture.Fixture();self.addCleanup(self.f.close)
        self.p,self.a=self.f.plan();self.before=self.f.state()

    def engine(self,backup=True):
        if backup:self.f.backup(self.p,self.a)
        return Engine(self.p,self.f.transport,self.a,self.f.root/'receipts')

    def failure(self,fn,state=None):
        with self.assertRaises(Failure) as caught:fn()
        if state:self.assertEqual(caught.exception.state,state)
        return caught.exception.state

    @contextlib.contextmanager
    def wire_fault(self,transform):
        original=_Session._exchange
        def intercepted(session,sql,timeout=65):
            return transform(session,sql,lambda s=sql:original(session,s,timeout))
        with patch.object(_Session,'_exchange',intercepted):yield

    def test_RUNNER_D1_11(self):
        bad=copy.deepcopy(self.before);bad['ledger'].pop()
        self.failure(lambda:ledger_check(self.p,bad,self.a))
        self.assertEqual(self.f.state(),self.before)

    def test_RUNNER_D1_12(self):
        # Real catalog observations, identical count with altered version/name/statements.
        row=self.before['ledger'][0];q=fixture.q
        for column,value in [('version','000000000000'),('name','changed'),('statements',['changed'])]:
            v=('ARRAY['+q(value[0])+']') if isinstance(value,list) else q(value)
            self.f.sql('begin;update supabase_migrations.schema_migrations set '+column+'='+v+' where version='+q(row['version'])+';commit;')
            bad=self.f.state();self.assertEqual(len(bad['ledger']),458);self.failure(lambda:ledger_check(self.p,bad,self.a))
            if column=='version':self.f.sql('update supabase_migrations.schema_migrations set version='+q(row['version'])+" where version='000000000000'")
            elif column=='name':self.f.sql('update supabase_migrations.schema_migrations set name='+q(row['name'])+' where version='+q(row['version']))
            else:self.f.sql('update supabase_migrations.schema_migrations set statements=null where version='+q(row['version']))
        self.assertEqual(self.f.state(),self.before)

    def test_RUNNER_D1_13(self):
        for mutate in [lambda x:x['ledger'].append(x['ledger'][0]),lambda x:x['ledgerDescriptor'].update(constraints=[]),
                       lambda x:x['ledgerDescriptor'].update(columns=[]),lambda x:x['ledgerDescriptor'].update(triggers=['unexpected'])]:
            bad=copy.deepcopy(self.before);mutate(bad);self.failure(lambda:ledger_check(self.p,bad,self.a))
        self.assertEqual(self.f.state(),self.before)

    def test_RUNNER_D1_14(self):
        e=self.engine();e.apply();after=self.f.state()
        self.failure(e.apply);self.assertEqual(self.f.state(),after)
        self.assertEqual(len(e.verify(self.before)['ledger']),459)

    def test_RUNNER_D1_15(self):
        from unittest.mock import Mock
        p=Path('000000000001_pending.sql')
        real=list((ROOT/'supabase/migrations').iterdir())
        with patch.object(Path,'iterdir',return_value=iter(real+[p])):
            self.failure(self.p.inventory)
        self.assertEqual(self.f.state(),self.before)

    def test_RUNNER_D1_16(self):
        q=fixture.q;v=self.before['ledger'][0]['version'];prefixes=[]
        for val in ['NULL','ARRAY[]::text[]','ARRAY['+q("quote' backslash\\ newline\n한글")+']']:
            self.f.sql('update supabase_migrations.schema_migrations set statements='+val+' where version='+q(v))
            a=self.f.state();b=self.f.state();self.assertEqual(a['prefix'],b['prefix']);prefixes.append(a['prefix'])
        self.assertEqual(len(set(prefixes)),3)

    def test_RUNNER_D1_17(self):
        self.f.sql('grant execute on function '+SIG+' to anon')
        drift=self.f.state();self.failure(self.engine(False).apply)
        self.assertEqual(self.f.state(),drift)

    def test_RUNNER_D1_18(self):
        e=self.engine();self.assertEqual(e.apply(),'SUCCESS');after=self.f.state()
        self.assertEqual(len(after['ledger']),459)
        self.assertEqual(after['effective'],{'postgres':True,'authenticated':True,'service_role':False,'anon':False})
        self.assertEqual(target(after)['sha256'],target(self.before)['sha256'])
        scope_delta(self.p,self.before,after,self.p.source()[0])
        self.assertEqual(after['defaults'],self.before['defaults'])

    def test_RUNNER_D1_19(self):
        for key,value in [('sha256','0'*64),('owner','wrong'),('config',['search_path=public']),('securityDefiner',False)]:
            b=copy.deepcopy(self.before);target(b)[key]=value
            self.failure(lambda:run_checks(self.p,b,self.a,'preflightChecks'))
        b=copy.deepcopy(self.before);b['effective']['anon']=True
        self.failure(lambda:run_checks(self.p,b,self.a,'preflightChecks'))
        self.f.sql('grant authenticated to service_role')
        self.failure(self.engine(False).apply)

    def test_RUNNER_D1_20(self):
        e=self.engine();body=self.p.source()[1].decode()
        with self.wire_fault(lambda s,q,run:run(q+'\nselect 1/0;') if not s.readonly and q==body else run()):
            self.failure(e.apply,'MIGRATION_FAILED_ROLLED_BACK')
        self.assertEqual(self.f.state(),self.before)

    def test_RUNNER_D1_21(self):
        e=self.engine()
        with self.wire_fault(lambda s,q,run:run(q+q) if q.startswith('INSERT INTO supabase_migrations') else run()):
            self.failure(e.apply,'LEDGER_FAILED_ROLLED_BACK')
        self.assertEqual(self.f.state(),self.before)

    def test_RUNNER_D1_22(self):
        e=self.engine()
        with self.wire_fault(lambda s,q,run:run(q+' REVOKE EXECUTE ON FUNCTION '+SIG+' FROM authenticated;') if q.startswith('INSERT INTO supabase_migrations') else run()):
            self.failure(e.apply,'POSTCHECK_FAILED_ROLLED_BACK')
        self.assertEqual(self.f.state(),self.before)

    def test_RUNNER_D1_23(self):
        e=self.engine();verify=e.verify
        def drift(before):
            self.f.sql('grant execute on function '+SIG+' to service_role');return verify(before)
        with patch.object(e,'verify',drift):self.failure(e.apply,'POSTCHECK_FAILED_COMMITTED_FORWARD_FIX_REQUIRED')
        self.assertEqual(len(self.f.state()['ledger']),459)
        self.assertTrue(self.f.state()['effective']['service_role'])

    def test_RUNNER_D1_24(self):
        e=self.engine();body=self.p.source()[1].decode();entered=threading.Event();release=threading.Event();result=[]
        a=copy.deepcopy(self.a);a['nonce']='c'*32;e2=Engine(self.p,self.f.transport,a,self.f.root/'receipts')
        def intercept(s,q,run):
            if q==body and threading.current_thread().name=='first-runner':
                entered.set();self.assertTrue(release.wait(30))
            return run()
        def first():
            try:result.append(e.apply())
            except Failure as ex:result.append(ex.state)
        with self.wire_fault(intercept):
            t=threading.Thread(target=first,name='first-runner');t.start()
            try:
                self.assertTrue(entered.wait(30));self.failure(e2.apply,'CONCURRENT_RUN_REJECTED')
            finally:release.set();t.join(40)
        self.assertEqual(result,['SUCCESS']);self.assertEqual(len(self.f.state()['ledger']),459)

    def test_RUNNER_D1_25(self):
        e=self.engine();pre=e.preflight
        def drift():
            observed=pre();self.f.sql('grant execute on function '+SIG+' to anon');return observed
        with patch.object(e,'preflight',drift):self.failure(e.apply,'PRECHECK_FAILED')
        self.assertEqual(len(self.f.state()['ledger']),458)
        self.assertTrue(self.f.state()['effective']['service_role'])

    def sequence(self):
        counts=[458];proof=[]
        for v in registry()['migrations']:
            p,a=self.f.plan(v);self.f.backup(p,a);before=self.f.state()
            e=Engine(p,self.f.transport,a,self.f.root/'receipts');self.assertEqual(e.apply(),'SUCCESS')
            now=self.f.state();counts.append(len(now['ledger']));scope_delta(p,before,now,p.source()[0])
            self.assertEqual(now['ledger'][-1]['statements'],[p.source()[0].decode()]);proof.append(now)
        self.assertEqual(counts,[458,459,460,461])
        self.assertEqual(len(list((self.f.root/'receipts').glob('*.attempt.json'))),3)
        return proof

    def test_RUNNER_D1_26(self):
        type(self).sequence_proof=self.sequence()

    def test_RUNNER_D1_27(self):
        proof=getattr(type(self),'sequence_proof',None) or self.sequence()
        inventory_check(proof[1],'completion');inventory_check(proof[2],'combined')
        self.assertEqual(proof[2]['effective']['service_role'],False)

    def test_RUNNER_D1_28(self):
        rows=self.before['ledger'];self.assertEqual(sum(x['statements'] is None for x in rows),449)
        self.assertEqual(len(rows),458)
        self.assertEqual(rows[-1]['version'],'202609170001')
        marker=json.loads((ROOT/'tests/fixtures/teaching-agent-single-migration-runner/plans.json').read_text())
        self.assertEqual(marker['classification'],'OWNED_ISOLATED_FIXTURE');self.assertFalse(marker['productionExecutable'])

    def test_RUNNER_D1_31(self):
        with self.f.transport._session(True) as s:
            self.failure(lambda:s._exchange('create table public.forbidden_readonly(id int);'))
            s._rollback()
        self.assertEqual(self.f.state(),self.before)

    def test_RUNNER_D1_43(self):
        e=self.engine()
        def lose(s,q,run):
            if q=='COMMIT;':run();raise Failure('UNKNOWN_COMMIT','CONNECTION_DROPPED')
            return run()
        with self.wire_fault(lose):self.failure(e.apply,'UNKNOWN_COMMIT')
        after=self.f.state();self.assertEqual(len(after['ledger']),459)
        self.assertEqual(e.reconcile(self.before)['state'],'COMMITTED_VERIFIED')
        self.assertEqual(len(e.verify(self.before)['ledger']),459)
        self.failure(e.apply);self.assertEqual(self.f.state(),after)
        receipt=json.loads(next((self.f.root/'receipts').glob('*.RESULT.json')).read_text());self.assertEqual(receipt['state'],'UNKNOWN_COMMIT')
        # Lost commit request before server receives it: actual rollback, still UNKNOWN
        # until a separate readonly reconciliation proves the old state.
        with fixture.Fixture() as second:
            p,a=second.plan();second.backup(p,a);before=second.state()
            e2=Engine(p,second.transport,a,second.root/'receipts')
            def drop(s,q,run):
                if q=='COMMIT;':raise Failure('UNKNOWN_COMMIT','TIMEOUT_NO_ACK')
                return run()
            with self.wire_fault(drop):self.failure(e2.apply,'UNKNOWN_COMMIT')
            self.assertEqual(e2.reconcile(before)['state'],'NOT_COMMITTED_VERIFIED')

    def test_RUNNER_D1_44(self):
        e=self.engine();record=Journal.record
        def lost(j,phase,**k):
            if phase=='COMMITTED':raise OSError('owned failure')
            return record(j,phase,**k)
        with patch.object(Journal,'record',lost):self.failure(e.apply,'POSTCHECK_FAILED_COMMITTED_FORWARD_FIX_REQUIRED')
        self.assertEqual(len(list((self.f.root/'receipts').glob('*.attempt.json'))),1)
        self.assertEqual(len(e.verify(self.before)['ledger']),459)

    def test_RUNNER_D1_45(self):
        e=self.engine()
        with patch('receipts.os.fsync',side_effect=OSError('owned failure')):
            self.failure(e.apply,'PRECHECK_FAILED')
        self.assertEqual(self.f.state(),self.before)

    def test_RUNNER_D1_46(self):
        e=self.engine();record=Journal.record
        def fail(j,phase,**k):
            if phase in ('PRECOMMIT','RESULT'):raise OSError('owned failure')
            return record(j,phase,**k)
        with patch.object(Journal,'record',fail):self.failure(e.apply,'POSTCHECK_FAILED_ROLLED_BACK')
        self.assertEqual(self.f.state(),self.before)
        # The consumed durable attempt prevents automatic replay even after rollback.
        self.failure(e.apply,'APPROVAL_MISSING')

    def test_RUNNER_D1_47(self):
        e=self.engine();body=self.p.source()[1].decode()
        def fail(s,q,run):
            if q==body:return run(q+' select 1/0;')
            if q=='ROLLBACK;' and not s.readonly:raise Failure('UNKNOWN_COMMIT')
            return run()
        with self.wire_fault(fail):self.failure(e.apply,'UNKNOWN_COMMIT')
        self.assertEqual(self.f.state(),self.before)

    def test_RUNNER_D1_48(self):
        e=self.engine();e.apply()
        paths=list((self.f.root/'receipts').glob('*.json'))
        for p in paths:
            self.assertFalse(json.loads(p.read_text())['nextMigrationAllowed']);self.assertEqual(p.stat().st_mode&0o777,0o600)
        self.assertEqual((self.f.root/'receipts').stat().st_mode&0o777,0o700)

    def test_RUNNER_D1_51(self):
        files=['tests/chapter-practice-acl-contract.test.mjs','tests/teaching-agent-r7d-publication-sql.test.mjs',
               'tests/teaching-agent-r7d-persisted-evidence.test.mjs','tests/teaching-agent-r7d-legacy-publication-compatibility.test.mjs',
               'tests/teaching-agent-rls-surface.test.mjs','tests/chapter-practice-binding.test.mjs']
        evidence=reserve_validation_directory()
        r=subprocess.run(['node','--test',*files],cwd=ROOT,capture_output=True,text=True,timeout=500)
        with (evidence/'existing-regression.log').open('x') as log:log.write(r.stdout+r.stderr)
        self.assertEqual(r.returncode,0,(r.stdout+r.stderr)[-4000:])
        # Replay unchanged historical R5B source in its exact eight-migration tree.
        with tempfile.TemporaryDirectory(prefix='runner-i1-r5b-') as tmp:
            t=Path(tmp)
            paths=['scripts/teaching-agent-r5b/runner.py','scripts/teaching-agent-r5b/maintenance_transport.py',
                   'scripts/teaching-agent-r5b/locked-package.json','scripts/teaching-agent-r5b/test_runner.py',
                   'supabase/bootstrap/migration-ledger-baseline.json','docs/evidence/teaching-agent-stage-1f-r5a/migration-package.json']
            package=json.loads((ROOT/paths[2]).read_text())
            paths += ['supabase/migrations/'+x['filename'] for x in package['migrations']]
            for n in paths:
                (t/n).parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/n,t/n)
            (t/'docs/evidence/teaching-agent-stage-1f-r5b').mkdir(parents=True)
            r=subprocess.run([sys.executable,'-B',str(t/'scripts/teaching-agent-r5b/test_runner.py')],capture_output=True,text=True,timeout=60)
            with (evidence/'r5b-historical-unit.log').open('x') as log:log.write(r.stdout+r.stderr)
            self.assertEqual(r.returncode,0,(r.stdout+r.stderr)[-3000:])


class CapturePG(unittest.TestCase):
    def setUp(self):
        from teaching_agent_single_migration_runner_contract_test import capture_draft,capture_auth
        self.f=fixture.Fixture();self.addCleanup(self.f.close)
        self.p=capture_draft();self.a=capture_auth(self.p);self.before=self.f.state()

    def capture(self):
        from maintenance_transport import CaptureTransport
        return CaptureTransport.owned(self.p,self.a,self.f.transport).capture()

    def rejected_without_catalog(self):
        from checks import CATALOG_SQL,TARGET_PREGATE_SQL,TARGET_DEFINITION_SQL
        original=_Session._json;calls=[]
        def watch(s,sql):calls.append(sql);return original(s,sql)
        with patch.object(_Session,'_json',watch):
            with self.assertRaises(Failure):self.capture()
        self.assertNotIn(CATALOG_SQL,calls)
        self.assertNotIn(TARGET_PREGATE_SQL,calls)
        self.assertNotIn(TARGET_DEFINITION_SQL,calls)

    def test_CAPTURE_15_owned_baseline_rollback(self):
        calls=[];original=_Session._exchange
        def watch(s,sql,timeout=65):calls.append((id(s),sql));return original(s,sql,timeout)
        with patch.object(_Session,'_exchange',watch):out=self.capture()
        self.assertEqual(out['ledger']['count'],458)
        self.assertEqual(out['ledger']['statementsInclusivePrefixSha256'],self.before['prefix'])
        self.assertEqual(out['ledger']['descriptorSha256'],descriptor(self.before))
        self.assertEqual(out['protectedCatalogSha256'],fingerprint(self.before))
        self.assertTrue(out['effective']['service_role']);self.assertEqual(out['transaction'],{'readOnly':'on','isolation':'repeatable read'})
        self.assertEqual(len({i for i,_ in calls}),1);self.assertEqual(calls[-1][1],'ROLLBACK;')
        self.assertFalse(any(q=='COMMIT;' for _,q in calls))
        self.assertEqual(self.f.state(),self.before)

    def test_CAPTURE_16_cli_owned_adapter(self):
        import runner
        from maintenance_transport import CaptureTransport
        from teaching_agent_single_migration_runner_contract_test import LifecycleOwned
        h=LifecycleOwned(self.p)
        try:
            h.mint()
            with h.runner_patches(lambda p,a:CaptureTransport.owned(p,a,self.f.transport)),patch('runner.Engine',side_effect=AssertionError('install forbidden')),patch('runner.capture_backup',side_effect=AssertionError('backup forbidden')):
                self.assertEqual(runner.main(['capture','--plan','acl-000-v1']),0)
            receipt=json.loads(next(h.receipts.glob('*.capture.json')).read_text())
            self.assertEqual(receipt['captureEnd'],'ROLLBACK');self.assertTrue(receipt['fixture'])
            raw=json.dumps(receipt);self.assertNotIn('ledgerText',raw);self.assertNotIn('"statements":',raw)
            self.assertNotIn('CREATE OR REPLACE FUNCTION',raw);self.assertNotIn('postgresql://',raw)
            self.assertEqual(self.f.state(),self.before)
        finally:h.close()

    def test_CAPTURE_17_readonly_mutation_probe(self):
        from checks import LEDGER_CAPTURE_SQL
        original=_Session._json
        def probe(s,sql):
            if sql==LEDGER_CAPTURE_SQL:
                with self.assertRaises(Failure):s._exchange('create table public.capture_forbidden(id int);')
                raise Failure('PRECHECK_FAILED','OWNED_PROBE_ABORTED')
            return original(s,sql)
        with patch.object(_Session,'_json',probe):
            with self.assertRaises(Failure):self.capture()
        self.assertEqual(self.f.state(),self.before)

    def test_CAPTURE_18_count_mismatch_early_stop(self):
        self.f.sql("insert into supabase_migrations.schema_migrations values('202609180000',null,'unexpected')")
        before=self.f.state();self.rejected_without_catalog();self.assertEqual(self.f.state(),before)

    def test_CAPTURE_19_duplicates_early_stop(self):
        self.f.sql('alter table supabase_migrations.schema_migrations drop constraint schema_migrations_pkey; insert into supabase_migrations.schema_migrations select * from supabase_migrations.schema_migrations limit 1')
        before=self.f.state();self.rejected_without_catalog();self.assertEqual(self.f.state(),before)

    def test_CAPTURE_20_statement_digest_and_pinned_recapture(self):
        old=self.capture()['ledger']['statementsInclusivePrefixSha256']
        self.f.sql("update supabase_migrations.schema_migrations set statements=ARRAY['owned changed history'] where version=(select min(version) from supabase_migrations.schema_migrations)")
        before=self.f.state();out=self.capture();self.assertNotEqual(out['ledger']['statementsInclusivePrefixSha256'],old)
        self.assertEqual(out['ledger']['count'],458)
        self.a['expectedLedgerPrefixSha256']=old;self.rejected_without_catalog()
        self.assertEqual(self.f.state(),before)

    def test_CAPTURE_21_wrong_function_body(self):
        definition=self.f.sql("select pg_get_functiondef('"+SIG+"'::regprocedure)")
        changed=definition.replace('没有权限维护教材练习关联','owned changed body')
        self.assertNotEqual(definition,changed);self.f.sql(changed)
        before=self.f.state()
        with self.assertRaises(Failure):self.capture()
        self.assertEqual(self.f.state(),before)

    def test_CAPTURE_22_wrong_owner_definer_path(self):
        for sql,restore in [('alter function '+SIG+' owner to authenticated','alter function '+SIG+' owner to postgres'),
                            ('alter function '+SIG+' security invoker','alter function '+SIG+' security definer'),
                            ("alter function "+SIG+" set search_path='public'","alter function "+SIG+" set search_path=''" )]:
            self.f.sql(sql);before=self.f.state()
            with self.assertRaises(Failure):self.capture()
            self.assertEqual(self.f.state(),before);self.f.sql(restore)

    def test_CAPTURE_23_wrong_acl(self):
        self.f.sql('grant execute on function '+SIG+' to anon');before=self.f.state()
        with self.assertRaises(Failure):self.capture()
        self.assertEqual(self.f.state(),before)

    def test_CAPTURE_24_wrong_versions_same_count(self):
        self.f.sql("update supabase_migrations.schema_migrations set version='000000000000' where version=(select min(version) from supabase_migrations.schema_migrations)")
        before=self.f.state();self.rejected_without_catalog();self.assertEqual(self.f.state(),before)


    def test_CAPTURE_27_actual_tls_query_and_receipt_modes(self):
        from checks import CAPTURE_TLS_SQL
        from receipts import exclusive
        # Owned Unix-socket PG is deliberately non-TLS; production requires true.
        self.assertEqual(self.f.sql(CAPTURE_TLS_SQL),'false')
        out=self.capture();path=self.f.root/'private-receipts'/'capture.json'
        exclusive(path,out)
        self.assertEqual(path.stat().st_mode&0o777,0o600)
        self.assertEqual(path.parent.stat().st_mode&0o777,0o700)
        with self.assertRaises(FileExistsError):exclusive(path,out)
        self.assertEqual(self.f.state(),self.before)


class CaptureOrder(unittest.TestCase):
    setUp=CapturePG.setUp
    capture=CapturePG.capture

    @contextlib.contextmanager
    def trace(self, transform=None):
        import checks
        original_json=_Session._json;original_exchange=_Session._exchange
        families={checks.CAPTURE_SESSION_SQL:'SESSION',checks.CAPTURE_TLS_SQL:'TLS',
                  checks.LEDGER_CAPTURE_SQL:'LEDGER',checks.TARGET_PREGATE_SQL:'TARGET_PREGATE',
                  checks.TARGET_DEFINITION_SQL:'TARGET_DEFINITION',checks.CATALOG_SQL:'PROTECTED_CATALOG'}
        self.queries=[];self.exchanges=[];self.events=[];self.observations={}
        def query(session,sql):
            family=families.get(sql,'IDENTITY')
            self.queries.append((id(session),family));self.events.append(family)
            value=original_json(session,sql)
            self.observations[family]=copy.deepcopy(value)
            return transform(family,value) if transform else value
        def exchange(session,sql,timeout=65):
            self.exchanges.append((id(session),sql));return original_exchange(session,sql,timeout)
        original_validators={name:getattr(checks,name) for name in ['capture_ledger_check','function_check','acl_check']}
        def validated(name):
            def call(*args):
                result=original_validators[name](*args);self.events.append(name+'_PASS');return result
            return call
        with contextlib.ExitStack() as stack:
            stack.enter_context(patch.object(_Session,'_json',query));stack.enter_context(patch.object(_Session,'_exchange',exchange))
            for name in original_validators:stack.enter_context(patch.object(checks,name,validated(name)))
            yield

    def stop(self, transform=None, ledger=False, code=None):
        before=self.f.state()
        with self.trace(transform):
            with self.assertRaises(Failure) as caught:self.capture()
        if code:self.assertEqual(caught.exception.code,code)
        families=[x[1] for x in self.queries]
        self.assertNotIn('PROTECTED_CATALOG',families)
        if ledger:
            self.assertNotIn('TARGET_PREGATE',families);self.assertNotIn('TARGET_DEFINITION',families)
        else:self.assertIn('TARGET_PREGATE',families)
        self.assertEqual(self.exchanges[-1][1],'ROLLBACK;')
        self.assertEqual(self.f.state(),before)

    def test_CAPTURE_ORDER_01_ledger_gate(self):
        changes=[lambda rows:rows.pop(),lambda rows:rows.append(rows[0]),
                 lambda rows:rows[0].update(version='000000000000'),
                 lambda rows:rows[0].update(statements=['owned altered history'])]
        self.a['expectedLedgerPrefixSha256']=self.before['prefix']
        for change in changes:
            def inject(family,value):
                if family=='LEDGER':
                    rows=json.loads(value['ledgerText']);change(rows);value['ledgerText']=json.dumps(rows)
                return value
            self.stop(inject,ledger=True)
        def descriptor_fault(family,value):
            if family=='LEDGER':value['ledgerDescriptor']['constraints']=[]
            return value
        self.stop(descriptor_fault,ledger=True)

    def test_CAPTURE_ORDER_02_body(self):
        definition=self.f.sql("select pg_get_functiondef('"+SIG+"'::regprocedure)")
        changed=definition.replace('没有权限维护教材练习关联','owned order body mismatch')
        self.assertNotEqual(changed,definition);self.f.sql(changed)
        self.stop(code='FUNCTION_CONTRACT')

    def test_CAPTURE_ORDER_03_raw_definition(self):
        self.stop(lambda f,v:v+'-- altered bytes' if f=='TARGET_DEFINITION' else v,
                  code='CAPTURE_FUNCTION_DEFINITION')
        self.assertIn('TARGET_DEFINITION',[f for _,f in self.queries])

    def test_CAPTURE_ORDER_04_owner(self):
        self.f.sql('alter function '+SIG+' owner to authenticated');self.stop(code='FUNCTION_CONTRACT')

    def test_CAPTURE_ORDER_05_definer(self):
        self.f.sql('alter function '+SIG+' security invoker');self.stop(code='FUNCTION_CONTRACT')

    def test_CAPTURE_ORDER_06_search_path(self):
        self.f.sql("alter function "+SIG+" set search_path='public'");self.stop(code='FUNCTION_CONTRACT')

    def test_CAPTURE_ORDER_07_metadata(self):
        for key,value in [('language','sql'),('volatility','s'),('parallel','s'),('leakproof',True)]:
            def inject(f,v):
                if f=='TARGET_PREGATE':target(v)[key]=value
                return v
            self.stop(inject,code='FUNCTION_CONTRACT')

    def test_CAPTURE_ORDER_08_acl(self):
        self.f.sql('grant execute on function '+SIG+' to anon');self.stop(code='ACL_CONTRACT')
        self.f.sql('revoke execute on function '+SIG+' from anon')
        changes=[lambda rows:rows.__setitem__(slice(None),[r for r in rows if r['grantee']!='authenticated']),
                 lambda rows:rows[0].update(grantor='authenticated'),
                 lambda rows:rows[0].update(grantable=True)]
        for change in changes:
            def inject(f,v):
                if f=='TARGET_PREGATE':change(v['targetAcl'])
                return v
            self.stop(inject,code='ACL_CONTRACT')

    def test_CAPTURE_ORDER_09_effective(self):
        self.f.sql('grant authenticated to anon with inherit true')
        drift=self.f.state();self.assertEqual(drift['targetAcl'],self.before['targetAcl'])
        self.assertTrue(drift['effective']['anon']);self.stop(code='EFFECTIVE_PRIVILEGE')
        self.f.sql('revoke authenticated from anon')
        for role in ['postgres','authenticated','service_role','anon']:
            def inject(f,v):
                if f=='TARGET_PREGATE':v['effective'][role]=not v['effective'][role]
                return v
            self.stop(inject,code='EFFECTIVE_PRIVILEGE')

    def test_CAPTURE_ORDER_10_missing(self):
        self.f.sql('alter function '+SIG+' rename to owned_renamed_review')
        self.stop(code='FUNCTION_MISSING')
        self.f.sql('create function public.review_chapter_practice_binding(integer) returns integer language sql as $$ select 1 $$')
        self.stop(code='FUNCTION_MISSING')

    def test_CAPTURE_ORDER_11_success_order(self):
        with self.trace():out=self.capture()
        core=[f for _,f in self.queries if f in ['LEDGER','TARGET_PREGATE','TARGET_DEFINITION','PROTECTED_CATALOG']]
        self.assertEqual(core,['LEDGER','TARGET_PREGATE','TARGET_DEFINITION','PROTECTED_CATALOG'])
        for earlier,later in [('LEDGER','capture_ledger_check_PASS'),('capture_ledger_check_PASS','TARGET_PREGATE'),
                              ('TARGET_PREGATE','function_check_PASS'),('function_check_PASS','acl_check_PASS'),
                              ('acl_check_PASS','TARGET_DEFINITION'),('TARGET_DEFINITION','PROTECTED_CATALOG')]:
            self.assertLess(self.events.index(earlier),self.events.index(later))
        self.assertEqual(len({i for i,_ in self.queries}),1)
        pre=self.observations['TARGET_PREGATE'];full=self.observations['PROTECTED_CATALOG']
        self.assertEqual(target(pre),target(full));self.assertEqual(pre['targetAcl'],full['targetAcl']);self.assertEqual(pre['effective'],full['effective'])
        self.assertEqual(out['targetFunction'],target(full));self.assertEqual(self.f.state(),self.before)

    def consistency_failure(self, change, expected='CAPTURE_TARGET_SNAPSHOT_MISMATCH'):
        def inject(f,v):
            if f=='PROTECTED_CATALOG':change(v)
            return v
        with self.trace(inject):
            with self.assertRaises(Failure) as caught:self.capture()
        self.assertEqual(caught.exception.code,expected)
        self.assertEqual([f for _,f in self.queries].count('PROTECTED_CATALOG'),1)
        self.assertEqual(self.exchanges[-1][1],'ROLLBACK;');self.assertEqual(self.f.state(),self.before)

    def test_CAPTURE_ORDER_12_metadata_consistency(self):
        for key,value in [('acl','different raw ACL bytes'),('sha256','0'*64),('owner','wrong'),('config',['search_path=public'])]:
            self.consistency_failure(lambda s:target(s).update({key:value}))
        self.consistency_failure(lambda s:s.update(functions=[]))

    def test_CAPTURE_ORDER_13_acl_effective_consistency(self):
        self.consistency_failure(lambda s:s['targetAcl'][0].update(grantable=True))
        self.consistency_failure(lambda s:s['effective'].update(service_role=False))
        self.consistency_failure(lambda s:s['effective'].update(postgres=1))

    def test_CAPTURE_ORDER_14_ledger_consistency(self):
        def change(s):
            rows=json.loads(s['ledgerText']);rows[0]['statements']=['owned full catalog drift'];s['ledgerText']=json.dumps(rows)
        self.consistency_failure(change,'CAPTURE_SNAPSHOT_MISMATCH')

    def test_CAPTURE_ORDER_15_same_snapshot_readonly(self):
        with self.trace():out=self.capture()
        self.assertEqual(out['transaction'],{'readOnly':'on','isolation':'repeatable read'})
        self.assertEqual(len({i for i,_ in self.exchanges}),1)
        self.assertEqual(sum(q.startswith('BEGIN ') for _,q in self.exchanges),1)
        self.assertIn('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;',[q for _,q in self.exchanges])
        self.assertNotIn('COMMIT;',[q for _,q in self.exchanges]);self.assertEqual(self.exchanges[-1][1],'ROLLBACK;')
        import checks
        original=_Session._json
        def probe(session,sql):
            if sql==checks.TARGET_PREGATE_SQL:
                with self.assertRaises(Failure):session._exchange('create table public.order_probe_forbidden(id int);')
                raise Failure('PRECHECK_FAILED','OWNED_MUTATION_PROBE')
            return original(session,sql)
        with patch.object(_Session,'_json',probe):
            with self.assertRaises(Failure):self.capture()
        self.assertEqual(self.f.state(),self.before)

    def test_CAPTURE_ORDER_16_rollback_phases(self):
        for phase in ['LEDGER','TARGET_PREGATE','TARGET_DEFINITION','PROTECTED_CATALOG']:
            def fail(f,v):
                if f==phase:raise Failure('PRECHECK_FAILED','OWNED_QUERY_FAULT')
                return v
            with self.trace(fail):
                with self.assertRaises(Failure):self.capture()
            self.assertEqual(self.exchanges[-1][1],'ROLLBACK;')
            self.assertNotIn('COMMIT;',[q for _,q in self.exchanges]);self.assertEqual(self.f.state(),self.before)

    def test_CAPTURE_ORDER_17_fixed_inputs(self):
        import checks,inspect
        self.assertEqual(list(inspect.signature(checks.capture_baseline).parameters),['session','plan','auth'])
        self.assertIn(SIG,checks.TARGET_PREGATE_SQL)
        with self.trace():self.capture()
        self.assertEqual(self.observations['TARGET_PREGATE']['effective'].keys(),{'postgres','authenticated','service_role','anon'})
        self.assertEqual(len(self.observations['TARGET_PREGATE']['functions']),1)
        self.assertEqual(set(self.observations['TARGET_PREGATE']),{'functions','targetAcl','effective'})

    def test_CAPTURE_ORDER_18_receipt(self):
        import checks
        from receipts import exclusive
        out=self.capture();text=json.dumps(out)
        self.assertEqual(out['queryFamilySha256']['targetPreGate'],sha(checks.TARGET_PREGATE_SQL.encode()))
        self.assertNotIn('"statements":',text);self.assertNotIn('CREATE OR REPLACE FUNCTION',text);self.assertNotIn('postgresql://',text)
        self.assertEqual(out['contract'],'readonly-baseline-capture/2')
        self.assertEqual(set(out),set("contract transportSecurity state planId planSha256 authorizationSha256 packageSha256 migrationRawSha256 migrationBodySha256 targetIdentity fixture readStartedAt readEndedAt transaction ledger targetFunction targetAcl effective roles memberships defaults defaultAclSha256 rolesSha256 membershipsSha256 otherFunctionAclSha256 overloadsSha256 protectedCatalogSha256 catalogFamilySha256 queryFamilySha256 credentialOutput businessWrites authWrites nextMigrationAllowed planStatus".split()))
        path=self.f.root/'order-receipts'/'capture.json';exclusive(path,out)
        self.assertEqual(path.stat().st_mode&0o777,0o600)

    def test_CAPTURE_ORDER_19_full_coverage(self):
        import ast,checks
        source=(ROOT/'scripts/teaching-agent-r7d-c3b/checks.py').read_text();tree=ast.parse(source)
        locked=json.loads((ROOT/'docs/evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-runner-p1c-exact-scope.json').read_text())['sharedSymbolLocksToPreserve']
        for node in tree.body:
            name=node.name if isinstance(node,ast.FunctionDef) else node.targets[0].id if isinstance(node,ast.Assign) and isinstance(node.targets[0],ast.Name) else None
            if name in locked:self.assertEqual(sha(ast.get_source_segment(source,node).encode()),locked[name]['sourceSha256'],name)
        out=self.capture();self.assertEqual(out['protectedCatalogSha256'],fingerprint(self.before))
        expected={k:sha(canonical(v)) for k,v in self.before.items() if k not in ('ledger','ledgerText','prefix')}
        self.assertEqual(out['catalogFamilySha256'],expected)

    def test_CAPTURE_ORDER_20_capture_isolation(self):
        import ast
        source=(ROOT/'scripts/teaching-agent-r7d-c3b/checks.py').read_text();tree=ast.parse(source)
        references=[]
        for node in tree.body:
            if isinstance(node,ast.FunctionDef) and any(isinstance(n,ast.Name) and n.id=='TARGET_PREGATE_SQL' for n in ast.walk(node)):references.append(node.name)
        self.assertEqual(references,['capture_baseline'])
        from plan_contract import authorize,load_plan
        p=load_plan('acl-000-v1')
        for mode in ['SINGLE_MIGRATION_APPLY','BACKUP_READ_EXPORT','READ_ONLY_PREFLIGHT','READ_ONLY_VERIFY']:
            with self.assertRaises(Failure):authorize(p,self.a,mode)
        self.assertEqual(self.f.state(),self.before)



class OwnedTLSPath:
    """TEST ONLY injection of an owned loopback endpoint; no production files.

    The real pinned psql/libpq and dump methods are exercised. Only authorization,
    runtime file lookup and Docker launch route are replaced with owned controls.
    There is no production CLI/constructor route to this adapter.
    """
    def __init__(self):
        import maintenance_transport as mt
        from backup_adapter import OwnedCluster
        from types import SimpleNamespace
        self.mt=mt;self.cluster=OwnedCluster();self.name=self.cluster.name
        self.tmp=tempfile.TemporaryDirectory(prefix='owned-tls-clients-');self.root=Path(self.tmp.name)
        self.patches=[]
        try:
            openssl='/home/yangzhen/miniconda3/bin/openssl'
            def oss(args):
                result=subprocess.run([openssl,*args],cwd=self.root,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
                if result.returncode:raise AssertionError('Owned certificate generation failed')
            oss(['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=Owned Test CA','-keyout','ca.key','-out','ca.crt'])
            oss(['req','-new','-newkey','rsa:2048','-nodes','-subj','/CN=localhost','-keyout','server.key','-out','server.csr'])
            (self.root/'ext').write_text('subjectAltName=DNS:localhost\nextendedKeyUsage=serverAuth\n')
            oss(['x509','-req','-in','server.csr','-CA','ca.crt','-CAkey','ca.key','-CAcreateserial','-days','1','-extfile','ext','-out','server.crt'])
            oss(['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=Wrong Owned CA','-keyout','wrong.key','-out','wrong.crt'])
            mt._docker(['exec',self.name,'mkdir','-m','700','/tmp/tls'])
            for name in ['ca.crt','server.key','server.crt','wrong.crt']:
                mt._docker(['exec','-i',self.name,'/bin/sh','-c','umask 077; cat > /tmp/tls/'+name],(self.root/name).read_bytes())
            mt._docker(['exec','-i',self.name,'/bin/sh','-c','cat >> /tmp/pg/postgresql.conf'],
                b"\nlisten_addresses='127.0.0.1'\nssl=on\nssl_cert_file='/tmp/tls/server.crt'\nssl_key_file='/tmp/tls/server.key'\n")
            # Separate tmpfs postmaster, reachable only on this net-none
            # container's loopback. SSL is a reloadable config value for tests.
            mt._docker(['exec',self.name,'initdb','-D','/tmp/tls-pg','-A','trust','--no-locale'])
            mt._docker(['exec','-i',self.name,'/bin/sh','-c','cat >> /tmp/tls-pg/postgresql.conf'],
                b"\nssl=on\nssl_cert_file='/tmp/tls/server.crt'\nssl_key_file='/tmp/tls/server.key'\n")
            mt._docker(['exec',self.name,'pg_ctl','-D','/tmp/tls-pg','-l','/tmp/tls-server.log',
                        '-o','-k /tmp/tls -c listen_addresses=127.0.0.1','-w','start'])
            t=mt.MaintenanceTransport.__new__(mt.MaintenanceTransport);self.transport=t
            t._mode='BACKUP_READ_EXPORT';t.fixture=False;t._pending_tool_proofs={}
            t._endpoint={'host':'localhost','user':'postgres','port':5432}
            t._ca_sha=sha((self.root/'ca.crt').read_bytes());t._credential_digest=sha(b'OWNED_TRUST_NO_PRODUCTION_CREDENTIAL')
            t.identity=dict(self.cluster.transport.identity,fixture=False,sslmode='verify-full',hostIdentitySha256=sha(canonical('localhost')),projectIdentitySha256=sha(b'OWNED'))
            t.profile=dict(t.identity,receiptRoot=str(self.root/'receipts'))
            t._plan=SimpleNamespace(fixture=False,data={'targetProfile':'OWNED_ISOLATED_FIXTURE'})
            t._auth={'targetIdentity':t.identity,'targetProfile':'OWNED_ISOLATED_FIXTURE','packageHashes':__import__('plan_contract').package_hashes(),
                     'credentialIdentitySha256':t._credential_digest,'expiresAt':time.time()+899}
            self.ca='/tmp/tls/ca.crt';self.host='localhost';self.mode='verify-full';self.port=5432
            def guard():
                self.cluster.transport._inspect()
                if time.time()>=t._auth['expiresAt']:raise Failure('APPROVAL_MISSING','RISK_ACCEPTANCE_SCOPE_EXPIRED')
            t._runtime_guard=guard
            def base(readonly=True):
                guard()
                return ['docker','exec','-i','-e','LC_ALL=C','-e','PGSERVICEFILE=/dev/null','-e','PGGSSENCMODE=disable','-e','PGOPTIONS=-c default_transaction_read_only='+('on' if readonly else 'off'),self.name,'/usr/bin/env','-u','PGSERVICE','-u','PGHOSTADDR']
            t._base=base
            t._connparams=lambda:("host='"+self.host+"' port='"+str(self.port)+"' dbname='postgres' user='postgres' sslmode='"+self.mode+"' sslrootcert='"+self.ca+"' gssencmode='disable' connect_timeout='2'")
            self.patches=[patch('maintenance_transport.risk_guard',lambda *args:None)]
            for p in self.patches:p.start()
        except Exception:self.close();raise

    def close(self):
        for p in reversed(self.patches):p.stop()
        self.cluster.close();self.tmp.cleanup()

    def __enter__(self):return self
    def __exit__(self,*args):self.close()


class ActualClientTLS(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.owned=OwnedTLSPath()
    @classmethod
    def tearDownClass(cls):cls.owned.close()

    def setUp(self):
        self.o=self.owned;self.t=self.o.transport
        self.o.ca='/tmp/tls/ca.crt';self.o.host='localhost';self.o.mode='verify-full';self.o.port=5432
        self.t._auth['expiresAt']=time.time()+899
        self.t._mode='BACKUP_READ_EXPORT'

    def test_TLS_D4_14_real_psql(self):
        from maintenance_transport import session_security
        with self.t._session(True) as s:
            pid=s._json('select to_jsonb(pg_backend_pid());')
            proof=session_security(s,self.t._plan,self.t._auth)
            self.assertTrue(proof['clientProof']['clientTls']['enabled'])
            self.assertIn(proof['clientProof']['clientTls']['version'],['TLSv1.2','TLSv1.3'])
            self.assertEqual(s._json('select to_jsonb(pg_backend_pid());'),pid)
            self.assertEqual(proof['clientProof']['invocationId'],s.invocation_id)
            self.assertEqual(s._json("select jsonb_build_array(current_setting('transaction_read_only'),current_setting('transaction_isolation'));"),['on','repeatable read'])
            s._rollback()

    def test_TLS_D4_15_no_tls(self):
        self.o.mode='disable'
        with self.assertRaises(Failure) as caught:
            with self.t._session(True):self.fail('plaintext yielded')
        self.assertEqual(caught.exception.code,'CLIENT_TLS_REQUIRED')

    def test_TLS_D4_16_bad_ca(self):
        self.o.ca='/tmp/tls/wrong.crt'
        with self.assertRaises(Failure) as caught:
            with self.t._session(True):self.fail('wrong CA yielded')
        self.assertEqual(caught.exception.code,'CLIENT_TLS_PROOF_MISSING')

    def test_TLS_D4_17_bad_hostname(self):
        self.o.host='127.0.0.1'
        with self.assertRaises(Failure) as caught:
            with self.t._session(True):self.fail('wrong hostname yielded')
        self.assertEqual(caught.exception.code,'CLIENT_TLS_PROOF_MISSING')
        self.o.host='localhost';self.o.port=5433
        with self.assertRaises(Failure):
            with self.t._session(True):self.fail('wrong port yielded')

    def test_TLS_D4_18_proof_replay(self):
        from maintenance_transport import session_security
        with self.t._session(True) as a,self.t._session(True) as b:
            b._transport_proof=a._transport_proof
            with self.assertRaises(Failure):session_security(b,self.t._plan,self.t._auth)
            a.invocation_id='0'*32
            with self.assertRaises(Failure):session_security(a,self.t._plan,self.t._auth)
            a._rollback();b._rollback()

    def test_TLS_D4_20_backend_false(self):
        import checks
        from maintenance_transport import session_security
        original=_Session._json
        def obs(s,q):return False if q==checks.CAPTURE_TLS_SQL else original(s,q)
        with patch.object(_Session,'_json',obs):
            with self.t._session(True) as s:
                security=session_security(s,self.t._plan,self.t._auth)
                self.assertIs(security['backendObservedSsl'],False)
                self.assertTrue(security['clientProof']['clientTls']['enabled'])
                with patch('maintenance_transport.risk_guard',side_effect=Failure('APPROVAL_MISSING','PROVIDER_HOP_RISK_NOT_ACCEPTED')):
                    with self.assertRaises(Failure):session_security(s,self.t._plan,self.t._auth)
                s._rollback()
        # Even actual backend TLS=true cannot rescue missing client metadata.
        with patch('maintenance_transport._conninfo',side_effect=Failure('TARGET_IDENTITY_MISMATCH','CLIENT_TLS_REQUIRED')):
            with self.assertRaises(Failure):
                with self.t._session(True):self.fail('missing client proof')

    def test_TLS_D4_21_backend_unavailable(self):
        import checks
        from maintenance_transport import session_security
        original=_Session._json;calls=[];exchange=_Session._exchange
        def trace(s,q,timeout=65):calls.append(q);return exchange(s,q,timeout)
        def obs(s,q):return None if q==checks.CAPTURE_TLS_SQL else original(s,q)
        with patch.object(_Session,'_json',obs):
            with self.t._session(True) as s:
                self.assertEqual(session_security(s,self.t._plan,self.t._auth)['backendObservedSsl'],'unavailable');s._rollback()
        def error(s,q):
            if q==checks.CAPTURE_TLS_SQL:return original(s,'select 1/0;')
            return original(s,q)
        with patch.object(_Session,'_json',error),patch.object(_Session,'_exchange',trace):
            with self.assertRaises(Failure):
                with self.t._session(True):self.fail('query error hidden')
        self.assertIn('ROLLBACK;',calls)

    def test_TLS_D4_22_order(self):
        # Execute the approved real same-snapshot query trace, not a result-only assertion.
        case=CaptureOrder('test_CAPTURE_ORDER_11_success_order');result=unittest.TestResult();case.run(result)
        self.assertEqual(result.testsRun,1);self.assertEqual(result.errors+result.failures+result.skipped,[])

    def test_TLS_D4_23_all_modes(self):
        from maintenance_transport import session_security
        for mode,readonly in [('READ_ONLY_PREFLIGHT',True),('READ_ONLY_VERIFY',True),('BACKUP_READ_EXPORT',True),('READ_ONLY_BASELINE_CAPTURE',True),('SINGLE_MIGRATION_APPLY',False)]:
            self.t._mode=mode
            with patch('maintenance_transport.authorize'):
                with self.t._session(readonly) as s:
                    self.assertTrue(session_security(s,self.t._plan,self.t._auth)['clientProof']['clientTls']['enabled']);s._rollback()
        self.t._mode='READ_ONLY_BASELINE_CAPTURE'
        with self.assertRaises(Failure):
            with self.t._session(False):self.fail('capture upgraded')

    def test_TLS_D4_35_atomicity_regression(self):
        # New transport cannot alter the immutable engine. Real fault injection
        # cases are rerun here in addition to the required historical suite.
        result=unittest.TestResult()
        for name in ['test_RUNNER_D1_21','test_RUNNER_D1_22','test_RUNNER_D1_23','test_RUNNER_D1_24','test_RUNNER_D1_25']:
            PG(name).run(result)
        self.assertEqual(result.testsRun,5);self.assertEqual(result.errors+result.failures+result.skipped,[])

    def test_TLS_D4_36_precommit_risk_expiry(self):
        import transaction,plan_contract
        with fixture.Fixture() as f:
            p,a=f.plan();before=f.state();f.backup(p,a)
            original=transaction.authorize;seen=[0]
            def expiry(plan,auth,mode):
                result=original(plan,auth,mode);seen[0]+=1
                # Real authorize production risk/closure hook is independently
                # covered above; inject its exact failure at precommit.
                if seen[0]==4:raise Failure('APPROVAL_MISSING','RISK_ACCEPTANCE_SCOPE_EXPIRED')
                return result
            with patch('transaction.authorize',expiry):
                with self.assertRaises(Failure):Engine(p,f.transport,a,f.root/'expire-receipts').apply()
            self.assertEqual(seen[0],4);self.assertEqual(f.state(),before)





class LifecyclePG(unittest.TestCase):
    def setUp(self):
        from teaching_agent_single_migration_runner_contract_test import LifecycleOwned,capture_draft
        self.f=fixture.Fixture();self.addCleanup(self.f.close)
        self.h=LifecycleOwned(capture_draft());self.addCleanup(self.h.close)
        self.before=self.f.state();self.h.mint();self.calls=[];self.sessions=set()
        original=_Session._exchange
        def exchange(session,sql,timeout=65):
            self.sessions.add(id(session));self.calls.append(sql);return original(session,sql,timeout)
        self.trace=patch.object(_Session,'_exchange',exchange)

    def run_capture(self):
        import runner
        from maintenance_transport import CaptureTransport
        with self.h.runner_patches(lambda p,a:CaptureTransport.owned(p,a,self.f.transport)),self.trace:
            return runner.main(['capture','--plan','acl-000-v1'])

    def test_AUTH_LIFECYCLE_30_success_finalization(self):
        self.assertEqual(self.run_capture(),0)
        self.assertFalse(self.h.life.canonical.exists())
        outcomes=list((self.h.life.root/'outcomes').iterdir());self.assertEqual(len(outcomes),1)
        out=json.loads(outcomes[0].read_bytes());self.assertEqual(out['state'],'SUCCESS')
        receipt=next(self.h.receipts.glob('*.capture.json'));self.assertEqual(out['captureReceiptSha256'],sha(receipt.read_bytes()))
        self.assertIn('ROLLBACK;',self.calls);self.assertEqual(self.f.state(),self.before)
        self.assertEqual(self.run_capture(),1)

    def test_AUTH_LIFECYCLE_31_gate_failure(self):
        self.f.sql("update supabase_migrations.schema_migrations set name='owned changed' where version='202609170001'")
        changed=self.f.state()
        # Gate failure induced in locked session SQL family without product modifications.
        from checks import LEDGER_CAPTURE_SQL,CATALOG_SQL
        original=_Session._json
        def bad(session,sql):
            out=original(session,sql)
            if sql==LEDGER_CAPTURE_SQL:out['ledger']=out['ledger'][:-1]
            return out
        with patch.object(_Session,'_json',bad):self.assertEqual(self.run_capture(),1)
        self.assertFalse(any(CATALOG_SQL in c for c in self.calls));self.assertIn('ROLLBACK;',self.calls)
        self.assertEqual(self.f.state(),changed);self.assertEqual(len(list((self.h.life.root/'consumed').iterdir())),1)
        self.assertFalse(self.h.life.canonical.exists());self.assertEqual(self.run_capture(),1)

    def test_AUTH_LIFECYCLE_33_receipt_failure(self):
        with patch('runner.exclusive',side_effect=OSError('owned receipt failure')):self.assertEqual(self.run_capture(),1)
        self.assertIn('ROLLBACK;',self.calls);self.assertEqual(self.f.state(),self.before)
        self.assertEqual(list(self.h.receipts.glob('*.capture.json')),[])
        self.assertEqual(len(list((self.h.life.root/'consumed').iterdir())),1)
        self.assertEqual(self.run_capture(),1)

    def test_AUTH_LIFECYCLE_39_session_order(self):
        from checks import LEDGER_CAPTURE_SQL,TARGET_PREGATE_SQL,TARGET_DEFINITION_SQL,CATALOG_SQL
        self.assertEqual(self.run_capture(),0);self.assertEqual(len(self.sessions),1)
        positions=[next(i for i,s in enumerate(self.calls) if q in s) for q in [LEDGER_CAPTURE_SQL,TARGET_PREGATE_SQL,TARGET_DEFINITION_SQL,CATALOG_SQL]]
        self.assertEqual(positions,sorted(set(positions)))
        self.assertIn('ROLLBACK;',self.calls);self.assertFalse(any(s.strip()=='COMMIT;' for s in self.calls))
        self.assertEqual(self.f.state(),self.before)
        receipt=json.loads(next(self.h.receipts.glob('*.capture.json')).read_bytes())
        self.assertEqual(receipt['transaction'],{'readOnly':'on','isolation':'repeatable read'})


if __name__=='__main__':unittest.main(verbosity=2)
