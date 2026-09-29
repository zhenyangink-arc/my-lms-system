// Owned isolated PostgreSQL only. No current DB config or actor is loaded.
import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';import {randomUUID} from 'node:crypto';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {readFile,mkdtemp,chmod,rm} from 'node:fs/promises';
const exec=promisify(execFile);let snapshotSql='';
registerHooks({resolve(s,c,n){if(s==='@/lib/admin')return {url:'data:text/javascript,export const requirePlatformOwner=async()=>{}',shortCircuit:true};if(s==='@/lib/supabase/admin')return {url:'data:text/javascript,export const createAdminClient=()=>{throw Error("NO_CURRENT_DB")}',shortCircuit:true};if(s==='./provisioning-readback.server.ts'&&c.parentURL?.endsWith('execution-guard.server.ts'))return {url:'data:text/javascript,export const createProvisioningReadback=t=>({read:()=>t.transaction(globalThis.b3SnapshotSql())})',shortCircuit:true};return n(s,c);}});
globalThis.b3SnapshotSql=()=>`BEGIN READ ONLY;WITH l AS (SELECT 1) SELECT ${snapshotSql}; COMMIT;`;
await import('./fixtures/teaching-agent-r7b/fixture.server.mjs');
const {Client}=await import('pg');
const {pgTransactionTransport,currentDatabaseTransport}=await import('../src/features/development-execution/server/execution-transport.server.ts');
const {executionMutationGuard,executionPostcondition}=await import('../src/features/development-execution/server/execution-guard.server.ts');
const {createExecutionJournal}=await import('../src/features/development-execution/server/execution-journal.server.ts');
const {createDurableActivityRepository}=await import('../src/features/smart-textbook-runtime/server/durable-activity-repository.server.ts');
const {createDurableActivityCompletion}=await import('../src/features/smart-textbook-runtime/server/durable-activity-completion.server.ts');
const {createDurableFixture}=await import('./fixtures/teaching-agent-r7c/fixture.server.mjs');
const {seedFixture,literal:q}=await import('./fixtures/teaching-agent-r7c/postgres.mjs');
const {B3_BUDGET}=await import('../src/features/development-execution/server/execution-scope.server.ts');
const {DEVELOPMENT_BINDING:B}=await import('../src/features/development-execution/server/provisioning-contract.ts');
const audit=JSON.parse(await readFile('docs/evidence/teaching-agent-stage-1f-r7c-b/b3-current-path-audit.json'));
test('current provenance cannot be requested from implementation workspace',async()=>{await assert.rejects(currentDatabaseTransport(),/B3_ENVIRONMENT/);assert.equal(pgTransactionTransport(async()=>{throw Error('unused')}).evidenceStorage,undefined);});
test('unknown COMMIT closes one connection with no retry',async()=>{let calls=0,closed=0;const t=pgTransactionTransport(async()=>({connect:async()=>{},query:async sql=>{calls++;if(sql==='ROLLBACK')return [];throw Error('transport lost');},end:async()=>{closed++;}}));await assert.rejects(t.transaction('BEGIN READ WRITE; SELECT 1; COMMIT;'),/UNKNOWN/);assert.equal(calls,2);assert.equal(closed,1);});
test('actual node-postgres + trusted repository + real RPC + in-transaction guard',async t=>{
 const name=`uply-b3a-isolated-${randomUUID()}`,directory=await mkdtemp('/tmp/b3a-owned-journal-');await chmod(directory,0o700);let launched=false;
 try{
  await exec('docker',['run','-d','--pull=never','--name',name,'--label','uply.stage=b3a-isolated','--read-only','--tmpfs','/tmp:rw,size=256m,mode=1777','-p','127.0.0.1::5432','--user','100:101','--entrypoint','/bin/sh','public.ecr.aws/supabase/postgres:17.6.1.141','-c',"initdb -D /tmp/b3pg -A trust --no-locale >/tmp/init.log && echo 'host all all 0.0.0.0/0 trust' >> /tmp/b3pg/pg_hba.conf && exec postgres -D /tmp/b3pg -k /tmp -c listen_addresses='*'"]);launched=true;
  const info=JSON.parse((await exec('docker',['inspect',name])).stdout)[0],port=info.NetworkSettings.Ports['5432/tcp'][0];assert.equal(port.HostIp,'127.0.0.1');
  const factory=async()=>new Client({host:'127.0.0.1',port:Number(port.HostPort),user:'postgres',database:'postgres',connectionTimeoutMillis:2000});
  const raw=async sql=>{const c=await factory();try{await c.connect();return await c.query(sql);}finally{await c.end();}};
  let lastError;let ready=false;for(let i=0;i<80;i++){try{await raw('SELECT 1');ready=true;break;}catch(e){lastError=e;await new Promise(r=>setTimeout(r,100));}}if(!ready){console.log('ISOLATED_CONNECTION',lastError?.code,lastError?.message,(await exec('docker',['logs',name])).stderr);throw Error('ISOLATED_START_FAILED');}
  await raw(await readFile('tests/fixtures/teaching-agent-r7c/bootstrap.sql','utf8'));
  await raw(audit.functions.find(x=>x.signature==='record_smart_textbook_attempt(uuid,uuid,uuid,uuid,jsonb,boolean,numeric)').definition);
  await raw(`CREATE TABLE public.digital_textbook_activity_page_progress(tenant_id uuid,student_id uuid,activity_id uuid); CREATE TABLE public.profiles(id uuid PRIMARY KEY); CREATE TABLE public.tenant_memberships(user_id uuid,tenant_id uuid);`);
  const debugFactory=async()=>{const c=await factory();return {connect:()=>c.connect(),end:()=>c.end(),query:async sql=>{try{return await c.query(sql);}catch(e){console.log('ISOLATED_SQL_CODE',e.code,e.message);throw e;}}};};
  const base=pgTransactionTransport(debugFactory),ids=await seedFixture({raw:sql=>raw(sql.replace(',20,true)',',3,true)'))});
  await raw(`INSERT INTO public.profiles VALUES(${q(ids.actorId)});INSERT INTO public.tenant_memberships VALUES(${q(ids.actorId)},${q(ids.tenantId)});`);
  const f=await createDurableFixture(base,ids),s={contract:'development-domain-execution/1',scenarioId:'r7cb-b3-wrong-correct-recovery-1',environment:B.environment,databaseIdentity:B.databaseIdentity,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString(),binding:f.binding,domain:f.scope,generation:1,state:'ACTIVE',budget:B3_BUDGET};
  const state={canonicalValid:true,tenants:[{id:ids.tenantId}],actors:[{id:ids.actorId,purpose:B.actorAlias,human:false,productionAllowed:false,banUntil:new Date(Date.now()+100000000).toISOString(),sessions:0,refreshTokens:0,provisionedProductionAccount:false,profile:{role:'student',globalRole:'member',status:'inactive'},memberships:[{tenantId:ids.tenantId,status:'suspended',role:'student',isDefault:false}]}]};
  const setState=()=>{snapshotSql=`${q(JSON.stringify(state))}::jsonb`;};setState();
  const j=createExecutionJournal(directory);await j.activate(s);let slot=0;
  const repo=createDurableActivityRepository({...base,beforeMutation:async(_,e)=>({beforeRpc:await executionMutationGuard(s,slot),afterRpc:executionPostcondition(s,slot),beforeDispatch:async()=>{await j.claim(s,slot,e.requestId,e.generation);}})});
  const completion=await createDurableActivityCompletion({repository:repo,authorize:async()=>f.scope,binding:f.binding,definitionDigest:f.definition.digest,policy:'two-attempt-development'});
  const request=id=>({binding:f.binding,requestId:id,generation:1}),correct=f.definition.secret.answer_key.value,wrong=(correct+1)%3;
  await t.test('actual safety SQL denies active sessions before any RPC',async()=>{state.actors[0].sessions=1;setState();await assert.rejects(base.transaction(`BEGIN READ WRITE;${await executionMutationGuard(s,0)}SELECT '{}'::jsonb;COMMIT;`));assert.equal((await f.repository.read(f.scope)).attempts.length,0);state.actors[0].sessions=0;setState();});
  await t.test('wrong persists incomplete on independent new pg connection',async()=>{await completion.submit(request('wrong'),`option-${wrong}`);assert.equal((await completion.readback(request('wrong-read'))).status,'INCOMPLETE');});
  await t.test('duplicate same slot is blocked without a new attempt',async()=>{await assert.rejects(completion.submit(request('wrong'),`option-${wrong}`));assert.equal((await f.repository.read(f.scope)).attempts.length,1);});
  await t.test('correct commits and response loss is recovered without retry',async()=>{slot=1;await completion.submit(request('correct'),`option-${correct}`);const fresh=await createDurableActivityCompletion({repository:createDurableActivityRepository(pgTransactionTransport(factory)),authorize:async()=>f.scope,binding:f.binding,definitionDigest:f.definition.digest,policy:'two-attempt-development'});assert.equal((await fresh.readback(request('lost-response-read'))).status,'COMPLETED');const rows=await f.repository.read(f.scope);assert.equal(rows.attempts.length,2);assert.equal(rows.progress.attempt_count,2);assert.equal(rows.progress.mastery_score,100);});
  await t.test('third logical dispatch denied; durable completed state remains',async()=>{await assert.rejects(completion.submit(request('third'),`option-${correct}`));assert.equal((await f.repository.read(f.scope)).attempts.length,2);await j.disable();assert.equal(await createExecutionJournal(directory).enabled(),false);});
 }finally{if(launched)await exec('docker',['rm','-f',name]);await rm(directory,{recursive:true,force:true});}
});
