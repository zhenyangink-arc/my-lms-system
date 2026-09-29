"""Deterministic protocol fault tests: never connect any database."""
import copy,datetime,json,re,shutil,subprocess,sys,tempfile,unittest
from pathlib import Path
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).parent))
import runner as r

class Transport:
 def __init__(self,fault=None,start=0):self.fault=fault;self.index=start;self.dispatches=[];self.reads=0
 def snapshot(self):
  self.reads+=1
  old=json.loads((r.ROOT/'supabase/bootstrap/migration-ledger-baseline.json').read_text())
  value={'ledger':old+[{k:m[k] for k in ('version','name')} for m in PLAN[:self.index]],'baseFullDigest':'f'*64,'newRows':[{'version':m['version'],'name':m['name'],'statements':[m['sql']]} for m in PLAN[:self.index]]}
  if self.fault=='wrong_ledger':value['ledger']=value['ledger'][1:]
  if self.fault=='post_read_failed' and self.index:raise r.Rejected('READ_FAILED')
  return value
 def execute(self,sql):
  self.dispatches.append(sql)
  nonce=re.search(r"'r5bCommitAck','([a-f0-9]+)'",sql)[1]
  version=PLAN[self.index]['version']
  if self.fault=='spawn_failure':return {'dispatched':False,'code':None,'stdout':''}
  if self.fault in ('timeout','connection_lost'):return {'dispatched':True,'code':None,'stdout':''}
  self.index+=1
  if self.fault=='bad_ack':return {'dispatched':True,'code':0,'stdout':'COMMIT\n{invalid}\n'}
  if self.fault=='missing_commit':return {'dispatched':True,'code':0,'stdout':json.dumps({'r5bCommitAck':nonce,'version':version})}
  return {'dispatched':True,'code':0,'stdout':'COMMIT\n'+json.dumps({'r5bCommitAck':nonce,'version':version})}

PLAN=r.load_package()
class Tests(unittest.TestCase):
 def package_dir(self):
  t=tempfile.TemporaryDirectory(prefix='uply-r5b-package-test-');self.addCleanup(t.cleanup);p=Path(t.name)
  for m in PLAN:shutil.copyfile(r.ROOT/'supabase/migrations'/m['filename'],p/m['filename'])
  return p
 def assert_stops(self,fault,commit='UNKNOWN'):
  t=Transport(fault);receipts=[]
  with self.assertRaises(r.Halt):r.run_all(t,PLAN,receipts.append)
  self.assertEqual(len(t.dispatches),1);self.assertEqual(len(receipts),1);self.assertEqual(receipts[0]['commitState'],commit);self.assertFalse(receipts[0]['nextMigrationAllowed'])
 def test_wrong_ledger(self):
  t=Transport('wrong_ledger')
  with self.assertRaises(r.Rejected):r.run_all(t,PLAN)
  self.assertEqual(t.dispatches,[])
 def test_wrong_hash(self):
  p=self.package_dir();(p/PLAN[0]['filename']).write_text(PLAN[0]['sql']+'\n')
  with self.assertRaisesRegex(r.Rejected,'HASH'):r.load_package(p)
 def test_wrong_order(self):
  entries=json.loads(r.PACKAGE.read_text())['migrations'];entries[0],entries[1]=entries[1],entries[0]
  with self.assertRaisesRegex(r.Rejected,'ORDER'):r.load_package(entries=entries)
 def test_missing_migration(self):
  p=self.package_dir();(p/PLAN[3]['filename']).unlink()
  with self.assertRaisesRegex(r.Rejected,'MISSING'):r.load_package(p)
 def test_extra_migration(self):
  p=self.package_dir();(p/'202609140008_unauthorized.sql').write_text('begin;commit;')
  with self.assertRaisesRegex(r.Rejected,'EXTRA'):r.load_package(p)
 def test_already_applied(self):
  for count in (1,8):
   t=Transport(start=count)
   with self.assertRaises(r.Rejected):r.run_all(t,PLAN)
   self.assertEqual(t.dispatches,[])
 def test_timeout(self):self.assert_stops('timeout')
 def test_connection_lost(self):self.assert_stops('connection_lost')
 def test_bad_commit_acknowledgement(self):self.assert_stops('bad_ack')
 def test_missing_commit_tag(self):self.assert_stops('missing_commit')
 def test_not_dispatched(self):self.assert_stops('spawn_failure','NOT_COMMITTED')
 def test_post_verify_failure_stops(self):self.assert_stops('post_read_failed','CONFIRMED')
 def test_full_success_and_atomic_layout(self):
  t=Transport();v=r.run_all(t,PLAN);self.assertEqual(v['finalLedger'],457);self.assertEqual(len(t.dispatches),8)
  for sql,m in zip(t.dispatches,PLAN):
   self.assertLess(sql.index(m['body']),sql.rindex('INSERT INTO supabase_migrations'))
   self.assertLess(sql.rindex('INSERT INTO supabase_migrations'),sql.rindex('\nCOMMIT;'))
   self.assertIn('LOCK TABLE supabase_migrations.schema_migrations',sql)
   self.assertIn("ARRAY["+r.quote(m['sql'])+"]::text[]",sql)
 def test_sql_lexer_nested_and_metacommand(self):
  self.assertIn("'commit;'",r.transaction_body("-- begin comment\nBEGIN;do $x$ begin perform 'commit;';end $x$;COMMIT;"))
  for s in ['BEGIN;COMMIT;SELECT 1;COMMIT;','BEGIN;\\i evil;COMMIT;','BEGIN;/* unclosed','BEGIN;SELECT 1;ROLLBACK;']:
   with self.assertRaises(r.Rejected):r.transaction_body(s)
 def test_production_cli_without_authorization_never_connects(self):
  result=subprocess.run([sys.executable,str(Path(r.__file__)),'apply-authorized','--receipts','/tmp/not-created-r5b-denied'],capture_output=True,text=True)
  self.assertEqual(result.returncode,2);self.assertIn('EXPLICIT_PRODUCTION_AUTHORIZATION_REQUIRED',result.stdout)
  self.assertFalse(Path('/tmp/not-created-r5b-denied').exists())
 def test_production_authorization_validation_in_memory_only(self):
  from maintenance_transport import check_authorization,APPROVAL
  now=datetime.datetime(2026,9,15,12,tzinfo=datetime.timezone.utc)
  observed={name:'test-hash' for name in ('runnerSha256','maintenanceTransportSha256','packageSha256','projectIdentitySha256','hostIdentitySha256','runtimeSha256')}
  a={**observed,'status':APPROVAL,'operator':'杨震','explicitUserAuthorizationReference':'SYNTHETIC_UNIT_TEST_ONLY','migrationVersions':list(r.VERSIONS),'windowStartUtc':'2026-09-15T11:00:00Z','windowEndUtc':'2026-09-15T13:00:00Z','feature':'OFF','allowlists':'EMPTY','providerRequests':0,'agentRuns':0}
  check_authorization(a,observed,now)
  for key,value in [('status','UNSIGNED'),('runnerSha256','wrong'),('migrationVersions',list(reversed(r.VERSIONS))),('feature','ON'),('windowEndUtc','2026-09-15T10:00:00Z')]:
   bad={**a,key:value}
   with self.assertRaises(r.Rejected):check_authorization(bad,observed,now)
 def test_mutated_engine_plan(self):
  plan=copy.deepcopy(PLAN);plan[0]['body']='SELECT 1;';t=Transport()
  with self.assertRaises(r.Rejected):r.run_all(t,plan)
  self.assertEqual(t.dispatches,[])

if __name__=='__main__':
 result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Tests))
 evidence={'status':'PASS' if result.wasSuccessful() else 'FAIL','testsRun':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),'scope':'Fault-injected transport/unit tests, no live provider or DB connection','requiredCases':['wrong ledger','wrong hash','wrong order','missing migration','extra migration','already applied','timeout','connection lost','bad commit acknowledgement'],'noRetryOrNextOnFailure':result.wasSuccessful()}
 (r.ROOT/'docs/evidence/teaching-agent-stage-1f-r5b/negative-runner-tests.json').write_text(json.dumps(evidence,indent=2)+'\n')
 raise SystemExit(0 if result.wasSuccessful() else 1)
