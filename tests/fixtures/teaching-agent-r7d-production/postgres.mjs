import {execFileSync,execFile} from 'node:child_process';
import {readFileSync,readdirSync} from 'node:fs';
import {uid,nativeCapture} from './published-fixture.mjs';
export const q=x=>`'${String(x).replaceAll("'","''")}'`;
export const j=x=>`${q(JSON.stringify(x))}::jsonb`;
export const completionMigration='202609180001_agent_durable_skill_completion.sql';
export const publicationMigration='202609180002_native_publication_contract.sql';
export const aclMigration='202609180000_chapter_practice_binding_acl.sql';
// Historical environment != desired security contract. No claim of full 458-history replay.
export const historicalAclFixture='tests/fixtures/chapter-practice-acl/historical-environment.sql';
export const historicalChain=[
 '202609100001_runtime_publish_foundation.sql','202609100002_runtime_publication_dependency_fence.sql',
 '202609100003_runtime_admission_control.sql','202609100004_runtime_single_version_authoring.sql',
 '202609100005_chapter_publish_semantic_compatibility.sql','202609110001_allow_evidence_graded_roleplay_publication.sql',
 '202609110002_restore_single_version_publish_wrapper.sql','202609130001_textbook_grammar_authoring.sql',
 '202609130002_textbook_grammar_practice_binding.sql','202609130003_runtime_authoring_nonretryable_error.sql',
 '202609140000_agent_core_foundation.sql','202609140001_agent_runtime_completion_evidence.sql','202609140002_agent_run_cancel_request.sql'];
export async function isolatedPostgres(install=[]){
 const name=`uply-r7dc34b-${uid()}`,image='postgres:15-alpine';
 const docker=(args,input)=>execFileSync('docker',args,{encoding:'utf8',input,stdio:['pipe','pipe','pipe'],maxBuffer:20*1024*1024});
 docker(['image','inspect',image,'--format','{{.Id}}']);
 docker(['run','-d','--pull=never','--rm','--network','none','--name',name,'--label','uply.task=r7dc34b','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust',image]);
 const inspect=JSON.parse(docker(['inspect',name]))[0];
 const stop=()=>docker(['stop','--time','2',name]);
 const queryAsync=s=>new Promise((resolve,reject)=>{const child=execFile('docker',['exec','-i',name,'psql','-h','127.0.0.1','-U','postgres','-XqAt','-v','ON_ERROR_STOP=1'],{encoding:'utf8',maxBuffer:20*1024*1024},(e,out,err)=>e?reject(Error(err)):resolve(out.trim()));child.stdin.end(s);});
 const sql=s=>docker(['exec','-i',name,'psql','-h','127.0.0.1','-U','postgres','-XqAt','-v','ON_ERROR_STOP=1'],s).trim();
 try{
  if(inspect.HostConfig.NetworkMode!=='none'||inspect.HostConfig.Binds?.length||Object.keys(inspect.HostConfig.PortBindings??{}).length)throw Error('ISOLATION_REQUIRED');
  let ready=false;for(let i=0;i<60;i++){try{sql('select 1');ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}if(!ready)throw Error('ISOLATED_PG_UNAVAILABLE');
  sql(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema private;
   create table auth.users(id uuid primary key);
   create table public.profiles(id uuid primary key,global_role text,status text);
   create table public.tenants(id uuid primary key,status text);
   create table public.tenant_memberships(tenant_id uuid,user_id uuid,status text,role text);
   create table public.ai_token_usage(id uuid primary key default gen_random_uuid(),user_id uuid,tenant_id uuid,provider text not null,model text not null,feature_code text not null,agent_code text,input_tokens integer not null default 0,output_tokens integer not null default 0,total_tokens integer not null default 0,created_at timestamptz default now());alter table public.ai_token_usage enable row level security;`);
  const fixture=nativeCapture(2),extra={digital_textbook_media_assets:{id:uid(),node_id:uid()},digital_textbook_listening_tracks:{id:uid(),activity_id:uid()},learning_agent_profile_secrets:{agent_profile_id:uid(),system_prompt:'synthetic'},learning_agent_node_interaction_secrets:{node_id:uid()},learning_agent_script_audio_assets:{id:uid(),script_node_id:uid()},chapter_tests:{id:uid(),status:'published'}};
  for(const [table,rows]of Object.entries(fixture.c)){
   const row=rows[0]??extra[table];const columns=Object.entries(row).map(([k,v])=>`"${k}" ${k==='id'||k.endsWith('_id')?'uuid':typeof v==='number'?'integer':typeof v==='boolean'?'boolean':typeof v==='object'&&v!==null?'jsonb':'text'}${k==='id'?' primary key':''}`);
   sql(`create table public.${table} (${columns.join(',')});`);
  }
  sql(`grant usage on schema public,auth to service_role,authenticated,anon;
   create table public.digital_textbook_attempts(id uuid default gen_random_uuid(),tenant_id uuid,student_id uuid,version_id uuid,activity_id uuid,attempt_number int,is_correct boolean,score int,response jsonb,created_at timestamptz default clock_timestamp());
   create table public.digital_textbook_node_progress(tenant_id uuid,student_id uuid,version_id uuid,node_id uuid,status text,completion_percent int,mastery_score int,attempt_count int,updated_at timestamptz,last_activity_at timestamptz);
   grant all on all tables in schema public to service_role;`);
  const migrate=file=>sql(readFileSync(`supabase/migrations/${file}`,'utf8'));
  for(const file of historicalChain)migrate(file);
  sql(readFileSync(historicalAclFixture,'utf8'));
  for(const file of install)migrate(file);
  function seed(f){for(const [table,rows]of Object.entries(f.c))for(const row of rows){const val=v=>v===null?'null':typeof v==='object'?j(v):typeof v==='boolean'||typeof v==='number'?String(v):q(v);sql(`insert into public.${table}(${Object.keys(row).map(k=>`"${k}"`).join(',')}) values(${Object.values(row).map(val).join(',')});`);}}
  const owner=uid();sql(`insert into public.profiles values(${q(owner)},'platform_owner','active');`);
  const capture=f=>JSON.parse(sql(`set role service_role;select public.capture_runtime_publication_v1(${q(owner)},${j(f.scope)});`));
  const rpc={async rpc(fn,args){if(!['capture_runtime_publication_v1','read_runtime_publication_v1','publish_runtime_snapshot_v2','read_runtime_snapshot_for_owner_v1','runtime_publication_session_v1'].includes(fn))throw Error('ISOLATED_RPC_ALLOWLIST');try{return {data:JSON.parse(sql(`set role service_role;select public.${fn}(${Object.entries(args).map(([k,v])=>`${k}=>${v===null?'null':typeof v==='object'?j(v):q(v)}`).join(',')});`)),error:null};}catch{return {data:null,error:{message:'ISOLATED_SQL_REJECTED'}};}}};
  return {name,sql,queryAsync,stop,migrate,seed,capture,owner,rpc,historicalChain};
 }catch(e){stop();throw e;}
}
