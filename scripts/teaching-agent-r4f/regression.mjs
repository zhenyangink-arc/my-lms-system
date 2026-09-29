// Run the existing R3A 37-assertion suite on a network-none synthetic DB.
// No production target, connection URI, credentials or host ports are accepted.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {withStudentRuntimeDatabase,providerFixture,requestFixture} from '../../tests/fixtures/teaching-agent/student-runtime.mjs';
const root=resolve('.'),out=resolve(process.argv[2]??'docs/evidence/teaching-agent-stage-1f-r4f');
assert.equal(out,join(root,'docs/evidence/teaching-agent-stage-1f-r4f'));
const env={PATH:process.env.PATH,HOME:process.env.HOME,LANG:'C.UTF-8',PYTHONDONTWRITEBYTECODE:'1'};
const docker=args=>execFileSync('docker',args,{encoding:'utf8',env});
const list=()=>docker(['ps','-aq','--filter','label=uply.stage=teaching-1a-isolated-test']).trim().split('\n').filter(Boolean);
const prior=list();let owned;
const temporary=mkdtempSync(join(tmpdir(),'uply-r4f-regression-'));
let result;
globalThis.fetch=async()=>{throw Error('LIVE_NETWORK_FORBIDDEN')};
try {
 await withStudentRuntimeDatabase(async f=>{
  const current=list().filter(id=>!prior.includes(id));assert.equal(current.length,1);owned=current[0];
  const inspected=JSON.parse(docker(['inspect',owned]))[0];
  assert.equal(inspected.HostConfig.NetworkMode,'none');assert.equal(inspected.HostConfig.ReadonlyRootfs,true);
  assert.deepEqual(inspected.HostConfig.PortBindings,{});assert.equal(inspected.HostConfig.Binds,null);
  const A=f.rows.tenants[0].id,B=f.rows.tenants[1].id,actor=f.rows.profiles[0].id;
  f.sql(readFileSync('supabase/migrations/202609140006_agent_run_reconciliation.sql','utf8'));
  const fixture=providerFixture(),input=await requestFixture(f.h),baseline=f.hashes();
  assert.equal((await f.createRuntime(fixture.provider).run(input)).run.status,'completed');
  writeFileSync(join(temporary,'state.json'),JSON.stringify({marker:'UPLY_R4F_NETWORK_NONE',containerId:inspected.Id}),{mode:0o600});
  writeFileSync(join(temporary,'fixture.json'),JSON.stringify({A,B}),{mode:0o600});
  writeFileSync(join(temporary,'users.private.json'),JSON.stringify({A1:{id:actor}}),{mode:0o600});
  // A module shim changes only SQL transport. The original R3A test file runs
  // byte-for-byte, including its real independent PostgreSQL session races.
  writeFileSync(join(temporary,'staging_shim.py'),`
import json,pathlib,subprocess,sys,types,runpy,os
ROOT=pathlib.Path(${JSON.stringify(root)})
D=pathlib.Path(${JSON.stringify(temporary)})
def load(directory):
 assert pathlib.Path(directory).resolve()==D.resolve()
 state=json.loads((D/'state.json').read_text());assert state['marker']=='UPLY_R4F_NETWORK_NONE'
 c=json.loads(subprocess.check_output(['docker','inspect',state['containerId']]))[0]
 assert c['Id']==state['containerId'] and c['Config']['Labels'].get('uply.stage')=='teaching-1a-isolated-test'
 assert c['HostConfig']['NetworkMode']=='none' and c['HostConfig']['ReadonlyRootfs'] and not c['HostConfig']['Binds'] and not c['HostConfig']['PortBindings']
 return state
def sql(directory,statement,check=True):
 state=load(directory)
 r=subprocess.run(['docker','exec','-i',state['containerId'],'psql','-h','/tmp','-U','postgres','-d','postgres','-qAt','-v','ON_ERROR_STOP=1'],input=statement.encode(),capture_output=True,timeout=30)
 if check and r.returncode:raise RuntimeError('ISOLATED_SQL_FAILED')
 return r
shim=types.ModuleType('staging');shim.load=load;shim.sql=sql;shim.ROOT=ROOT;sys.modules['staging']=shim
if __name__=='__main__':
 sys.argv=[str(ROOT/'scripts/teaching-agent-r3a/database-checks.py'),str(D)]
 runpy.run_path(sys.argv[0],run_name='__main__')
`,{mode:0o600});
  const suite=execFileSync('python3',[join(temporary,'staging_shim.py')],{cwd:root,env,encoding:'utf8',timeout:180000});
  const db=JSON.parse(readFileSync(join(temporary,'reconcile-database-result.json')));
  assert.equal(db.status,'PASS');assert.equal(db.assertions,37);
  assert.deepEqual(f.hashes(),baseline);
  // Actual CLI -> wrapper -> owned psql -> unchanged DB RPC + post-COMMIT ACK.
  const bin=join(temporary,'bin');mkdirSync(bin,{mode:0o700});
  writeFileSync(join(bin,'psql'),`#!/usr/bin/env python3
import pathlib,sys,os
sys.path.insert(0,${JSON.stringify(temporary)})
from staging_shim import sql,D,ROOT
variables=dict(x[len('--set='):].split('=',1) for x in sys.argv[1:] if x.startswith('--set='))
files=[x[len('--file='):] for x in sys.argv[1:] if x.startswith('--file=')]
assert len(files)==1 and pathlib.Path(files[0]).resolve()==ROOT/'scripts/teaching-agent-r3a/operator-reconcile.sql'
s=pathlib.Path(files[0]).read_text()
for k,v in variables.items():
 assert k in ['tenant_id','batch_limit']
 s=s.replace(":"+"'"+k+"'", "'"+v.replace("'","''")+"'")
r=sql(D, 'SET ROLE '+('authenticated' if os.environ.get('R4F_DENY') else 'service_role')+';'+s,False)
sys.stdout.buffer.write(r.stdout);sys.stderr.buffer.write(r.stderr);sys.exit(r.returncode)
`,{mode:0o700});
  const command=['scripts/teaching-agent-r3a/reconcile-command.py','--service','synthetic-only','--tenant',A,'--operator','synthetic-operator','--release-ref','synthetic-release','--build-ref','synthetic-build','--execute'];
  const deadline=f.sql("select clock_timestamp()+interval '40 seconds'");
  const budget={...f.definition.profile.budget,usedModelCalls:0,usedToolExecutions:0,deadlineAt:deadline},q=f.literal;
  const admitted=JSON.parse(f.sql(`set role service_role;select admit_agent_run_v1(${q(A)},${q(actor)},${q(crypto.randomUUID())},'student-ai-teacher','synthetic-app','lesson',${q(crypto.randomUUID())},${q(crypto.randomUUID())},${q('a'.repeat(64))},'synthetic',${q(f.definition.profile.definitionVersion.version)},${q(JSON.stringify(f.definition.profile.allowedSkillRefs[0]))}::jsonb,${q(JSON.stringify(budget))}::jsonb,${q(deadline)});`)).run;
  f.sql(`update agent_runs set deadline_at=clock_timestamp()-interval '10 seconds',lease_expires_at=clock_timestamp()-interval '10 seconds' where id=${q(admitted.id)}`);
  const receipts=[];
  for(const [caseName,denied,expectedProcessed] of [['real nonempty committed transaction',false,1],['real empty committed transaction',false,0],['real SQL ACL rejection',true,null]]){
   let stdout,exit=0;
   try {stdout=execFileSync('python3',command,{cwd:root,env:{...env,PATH:bin+':'+env.PATH,...(denied?{R4F_DENY:'1'}:{})},encoding:'utf8',timeout:30000});}
   catch(e){exit=e.status;stdout=e.stdout;assert.equal(e.stderr,'');}
   const r=JSON.parse(stdout);assert.equal(exit,denied?1:0);assert.equal(r.commitState,denied?'UNKNOWN':'CONFIRMED');
   assert.equal(r.success,!denied);assert.equal(r.retryAllowed,false);assert.equal(r.followUpReadRequired,denied);
   assert.equal(r.processed,expectedProcessed);
   if(caseName==='real nonempty committed transaction')assert.equal(r.terminalized,1);
   receipts.push({case:caseName,exit,commitState:r.commitState,result:r.result,success:r.success,processed:r.processed,followUpReadRequired:r.followUpReadRequired,retryAllowed:r.retryAllowed});
  }
  assert.deepEqual(f.hashes(),baseline);
  result={status:'PASS',dbAssertions:db.assertions,dbChecks:db.checks,dbRaces:db.twoReconcilers,workerFirst:db.workerFirst,reconcilerFirst:db.reconcilerFirst,batch:db.batch,realCliReceipts:receipts,
   isolation:{network:'none',readonlyRootfs:true,hostPorts:0,productionCredentials:false,transport:'owned Docker psql / Unix socket',fullSupabaseJwtRlsRetest:false},
   providerFixtureCalls:fixture.calls.length,liveProviderRequests:0,productionDbWrites:0,productionReconcilerRuns:0,teachingDomainHashesUnchanged:true,syntheticFixtureWrites:'NONZERO',existingR3aSuiteOutput:JSON.parse(suite)};
 },{transport:true});
 assert.ok(!list().includes(owned));result.ownedContainerRemoved=true;
 mkdirSync(out,{recursive:true});writeFileSync(join(out,'database-regression.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',dbAssertions:37,realCliReceipts:3,ownedContainerRemoved:true}));
} finally {rmSync(temporary,{recursive:true,force:true});}
