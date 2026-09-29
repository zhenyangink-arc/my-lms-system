import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const exec=promisify(execFile);
const enabled=process.env.RUN_AGENT_ISOLATED_DB_TESTS==='1';
const image='public.ecr.aws/supabase/postgres:17.6.1.141';
const migration='supabase/migrations/202609140000_agent_core_foundation.sql';
// No endpoint, password, existing DB, volume, network or published port is accepted.
// Each opt-in run creates and removes its OWN tmpfs-only container.
test('isolated PostgreSQL: real migration, atomic RPC races, scope, grants, immutability and usage', {skip:!enabled,timeout:120000},async(t)=>{
 const name=`uply-agent-0b-test-${randomUUID()}`;
 const docker=(args,options={})=>execFileSync('docker',args,{encoding:'utf8',stdio:['pipe','pipe','pipe'],...options});
 docker(['image','inspect',image,'--format','{{.Id}}']);
 let created=false;
 try {
  docker(['run','-d','--pull=never','--name',name,'--label','uply.stage=agent-0b-isolated-test','--network','none','--read-only','--tmpfs','/tmp:rw,size=256m,mode=1777','--user','100:101','--entrypoint','/bin/sh',image,'-c',"initdb -D /tmp/agentpg -A trust --no-locale >/tmp/init.log && exec postgres -D /tmp/agentpg -k /tmp -c listen_addresses='' -c max_connections=20"]);created=true;
  const inspect=JSON.parse(docker(['inspect',name]))[0];assert.equal(inspect.HostConfig.NetworkMode,'none');assert.equal(inspect.HostConfig.ReadonlyRootfs,true);assert.equal(inspect.HostConfig.Binds,null);assert.deepEqual(inspect.HostConfig.PortBindings,{});
  const psqlArgs=['exec','-i',name,'psql','-h','/tmp','-U','postgres','-d','postgres','-qAt','-v','ON_ERROR_STOP=1'];
  const sql=(s)=>docker(psqlArgs,{input:s}).trim();
  const parallelSql=async(s)=>{const child=exec('docker',psqlArgs,{encoding:'utf8'});child.child.stdin.end(s);return (await child).stdout.trim();};
  let ready=false;for(let i=0;i<50;i++){try{sql('select 1;');ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}assert.equal(ready,true);
  sql(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create table public.tenants(id uuid primary key,status text not null);
    create table public.profiles(id uuid primary key references auth.users(id),status text not null);
    create table public.tenant_memberships(tenant_id uuid,user_id uuid,status text);
    create table public.ai_token_usage(id uuid primary key default gen_random_uuid(),user_id uuid,tenant_id uuid,provider text not null,model text not null,feature_code text not null,agent_code text,input_tokens integer not null default 0,output_tokens integer not null default 0,total_tokens integer not null default 0,created_at timestamptz default now());
    alter table public.ai_token_usage enable row level security;
    grant usage on schema public to service_role,authenticated,anon;`);
  sql(readFileSync(migration,'utf8'));
  const tenant='00000000-0000-4000-a000-000000000002',actor='00000000-0000-4000-a000-000000000001',other='00000000-0000-4000-a000-000000000003';
  const budget={maxModelCalls:2,maxToolExecutions:1,maxInputTokensPerCall:10000,maxOutputTokensPerCall:128,reservedTokens:20256};
  const skill={name:'test-echo-skill',version:'1.0.0'};
  const profile={agentCode:'test-agent',definitionVersion:{name:'test-agent',version:'1.0.0'},status:'published',promptVersion:{name:'synthetic-prompt',version:'1.0.0'},contextVersion:{name:'synthetic-context',version:'1.0.0'},model:{provider:'deepseek',model:'deepseek-v4-flash',configVersion:'deepseek-tools-disabled-v1'},allowedSkillRefs:[skill],allowedToolRefs:[{name:'echo_test',version:'1.0.0'}],policyVersion:{name:'test-policy',version:'1.0.0'},budget};
  const literal=(s)=>`'${String(s).replaceAll("'","''")}'`;
  const json=(x)=>`${literal(JSON.stringify(x))}::jsonb`;
  sql(`insert into auth.users values('${actor}');insert into public.profiles values('${actor}','active');insert into public.tenants values('${tenant}','active'),('${other}','active');insert into public.tenant_memberships values('${tenant}','${actor}','active'),('${other}','${actor}','active');insert into public.agent_definition_versions(tenant_id,actor_id,agent_code,version,status,manifest) values('${tenant}','${actor}','test-agent','1.0.0','published',${json(profile)});`);
  function admit(conversation,key='test-key-001',digest='a'.repeat(64),tenantId=tenant, overrides={}){
   const deadline=new Date(Date.now()+40000).toISOString();const b={...budget,usedModelCalls:0,usedToolExecutions:0,deadlineAt:deadline,...overrides};
   return `set role service_role;select public.admit_agent_run_v1('${tenantId}','${actor}','${conversation}','test-agent','test-app','user_global','synthetic-scope',${literal(key)},${literal(digest)},'synthetic echo','1.0.0',${json(skill)},${json(b)},'${deadline}');`;
  }
  function transition(r,to,{tenantId=tenant,version=r.stateVersion,fence=r.fencingToken}={}){return `set role service_role;select public.transition_agent_run_v1('${tenantId}','${actor}','${r.id}','${r.status}',${version},'${fence}','${to}',${json(r.budget)},${to==='completed'?"'synthetic final'":'null'},null);`;}
  const rejection=(statement,pattern)=>assert.throws(()=>sql(statement),e=>pattern.test(String(e.stderr)));
  await t.test('same idempotency concurrent requests share one Run and one input',async()=>{
   const conversation=randomUUID();const stmt=admit(conversation);const [a,b]=await Promise.all([parallelSql(stmt),parallelSql(stmt)]);const x=JSON.parse(a),y=JSON.parse(b);assert.equal(x.run.id,y.run.id);assert.notEqual(x.replayed,y.replayed);
   assert.equal(sql(`select count(*) from public.agent_messages where run_id='${x.run.id}';`),'1');
   rejection(admit(conversation,'test-key-001','b'.repeat(64)),/IDEMPOTENCY_CONFLICT/);
  });
  await t.test('different keys competing for same conversation admit only one',async()=>{
   const conversation=randomUUID();const results=await Promise.allSettled([parallelSql(admit(conversation,'key-one-001')),parallelSql(admit(conversation,'key-two-001'))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.match(String(results.find(r=>r.status==='rejected').reason.stderr),/CONVERSATION_BUSY/);
  });
  await t.test('complete versus cancel CAS has one winner; old version/fence cannot write',async()=>{
   let r=JSON.parse(sql(admit(randomUUID()))).run;r=JSON.parse(sql(transition(r,'running')));
   rejection(transition(r,'completed',{fence:randomUUID()}),/PERSISTENCE_FAILED/);
   rejection(transition(r,'completed',{version:r.stateVersion-1}),/PERSISTENCE_FAILED/);
   const race=await Promise.allSettled([parallelSql(transition(r,'completed')),parallelSql(transition(r,'cancelled'))]);assert.equal(race.filter(x=>x.status==='fulfilled').length,1);
   const terminal=JSON.parse(race.find(x=>x.status==='fulfilled').value);rejection(transition(terminal,'running'),/PERSISTENCE_FAILED/);
   assert.equal(sql(`select count(*) from public.agent_run_events where run_id='${r.id}' and kind in ('run.completed','run.cancelled');`),'1');
  });
  await t.test('tenant mismatch, budget missing and changed scope fail closed',()=>{
   const conversation=randomUUID();const r=JSON.parse(sql(admit(conversation))).run;
   rejection(admit(conversation,'test-key-001','a'.repeat(64),other),/FORBIDDEN/);
   rejection(transition(r,'running',{tenantId:other}),/RUN_NOT_FOUND/);
   rejection(admit(randomUUID(),'test-key-001','a'.repeat(64),tenant,{reservedTokens:0}),/BUDGET_UNAVAILABLE/);
   rejection(admit(conversation).replace("'synthetic-scope'","'forged-scope'"),/FORBIDDEN/);
  });
  await t.test('events append only; server metadata rejects extra private payload',()=>{
   const r=JSON.parse(sql(admit(randomUUID()))).run;
   const event={kind:'model.started',runId:r.id,at:new Date().toISOString(),modelCallId:randomUUID()};
   const append=e=>`set role service_role;select public.append_agent_run_event_v1('${tenant}','${actor}','${r.id}',${r.stateVersion},'${r.fencingToken}',${json(e)});`;
   sql(append(event));rejection(append({...event,rawToolArgs:{fake:'private'}}),/INVALID_REQUEST/);
   const snapshot=randomUUID();sql(append({kind:'context.resolved',runId:r.id,at:new Date().toISOString(),contextSnapshotId:snapshot}));
   assert.equal(sql(`select context_metadata->>'snapshotId' from public.agent_runs where id='${r.id}';`),snapshot);
   rejection(append({kind:'context.resolved',runId:r.id,at:new Date().toISOString(),contextSnapshotId:randomUUID()}),/INVALID_REQUEST/);
   rejection(`update public.agent_run_events set metadata='{}' where run_id='${r.id}';`,/AGENT_IMMUTABLE/);
   rejection(`delete from public.agent_run_events where run_id='${r.id}';`,/AGENT_IMMUTABLE/);
   rejection(`update public.agent_definition_versions set version='2.0.0';`,/AGENT_IMMUTABLE/);
  });
  await t.test('browser roles cannot write Run, definition, event, usage or invoke RPC',()=>{
   for(const role of ['anon','authenticated']){
    for(const table of ['agent_runs','agent_run_events','agent_definition_versions'])rejection(`set role ${role};insert into public.${table} default values;`,/permission denied/);
    rejection(admit(randomUUID()).replace('set role service_role',`set role ${role}`),/permission denied/);
   }
   rejection('set role authenticated;insert into public.ai_token_usage(model) values(\'synthetic\');',/permission denied/);
   // Simulate an existing permissive legacy usage policy: the new restrictive
   // rule must still block Run-linked writes without breaking run_id=null rows.
   sql(`grant insert on public.ai_token_usage to authenticated;
     create policy legacy_usage_insert on public.ai_token_usage for insert to authenticated with check(true);`);
   sql(`set role authenticated;insert into public.ai_token_usage(provider,model,feature_code) values('unknown','synthetic','legacy');`);
   const r=JSON.parse(sql(admit(randomUUID()))).run;
   rejection(`set role authenticated;insert into public.ai_token_usage(provider,model,feature_code,run_id) values('deepseek','synthetic','agent_core','${r.id}');`,/row-level security/);

  });
  await t.test('expired lease and revoked membership prevent new work but permit fenced stop cleanup',()=>{
   const r=JSON.parse(sql(admit(randomUUID()))).run;
   sql(`update public.agent_runs set lease_expires_at=clock_timestamp()-interval '1 second' where id='${r.id}';`);
   rejection(transition(r,'running'),/DEADLINE_EXCEEDED/);
   sql(`update public.tenant_memberships set status='inactive' where tenant_id='${tenant}' and user_id='${actor}';`);
   rejection(admit(randomUUID()),/FORBIDDEN/);
   const cancelled=JSON.parse(sql(transition(r,'cancelled')));assert.equal(cancelled.status,'cancelled');
   sql(`update public.tenant_memberships set status='active' where tenant_id='${tenant}' and user_id='${actor}';`);
  });
  await t.test('per-call reported usage idempotent; unknown usage stores no zero-token row',()=>{
   const r=JSON.parse(sql(admit(randomUUID()))).run;
   const record={runId:r.id,modelCallId:randomUUID(),attemptIndex:1,provider:'deepseek',model:'deepseek-v4-flash',durationMs:12,usage:{status:'reported',inputTokens:10,outputTokens:2,totalTokens:12}};
   const persist=v=>`set role service_role;select public.record_agent_usage_v1('${tenant}','${actor}','${r.id}',${r.stateVersion},'${r.fencingToken}',${json(v)});`;
   sql(persist(record));sql(persist(record));assert.equal(sql(`select count(*) from public.ai_token_usage where run_id='${r.id}';`),'1');
   rejection(persist({...record,durationMs:13}),/IDEMPOTENCY_CONFLICT/);
   const unknown={...record,modelCallId:randomUUID(),usage:{status:'unknown'}};sql(persist(unknown));
   assert.equal(sql(`select count(*) from public.ai_token_usage where model_call_id='${unknown.modelCallId}';`),'0');
   assert.equal(sql(`select metadata->'usage' from public.agent_run_events where model_call_id='${unknown.modelCallId}';`),'{"status": "unknown"}');
  });
 } finally {if(created)docker(['rm','-f',name]);}
});
