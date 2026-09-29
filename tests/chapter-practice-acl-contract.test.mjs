import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {isolatedPostgres, aclMigration, completionMigration, publicationMigration, q, j} from './fixtures/teaching-agent-r7d-production/postgres.mjs';
import {nativeCapture} from './fixtures/teaching-agent-r7d-production/published-fixture.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const sig='public.review_chapter_practice_binding(uuid,uuid,integer,jsonb,boolean)';
const expected='3d72415147051a92a0312f56bf6b60d81aa5e0e103aced878a20be21b5d96941';
const migration=readFileSync('supabase/migrations/'+aclMigration,'utf8');
const baseline=readFileSync('supabase/bootstrap/app-schema-baseline.sql','utf8');
const contract=()=>readFileSync('tests/fixtures/chapter-practice-acl/historical-environment.sql','utf8');
const state=db=>JSON.parse(db.sql(`select json_build_object(
 'function',(select json_build_object('oid',p.oid,'owner',pg_get_userbyid(proowner),'security',prosecdef,'config',proconfig,'acl',proacl::text,'hash',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex')) from pg_proc p where p.oid=to_regprocedure(${q(sig)})),
 'privileges',(select json_object_agg(rolname,has_function_privilege(oid,to_regprocedure(${q(sig)}),'EXECUTE')) from pg_roles where rolname in ('postgres','authenticated','service_role','anon')),
 'public',exists(select 1 from pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a where p.oid=to_regprocedure(${q(sig)}) and a.grantee=0),
 'defaults',(select coalesce(jsonb_agg(to_jsonb(d) order by oid),'[]') from pg_default_acl d),
 'others',(select coalesce(jsonb_agg(jsonb_build_array(p.oid,pg_get_functiondef(p.oid),p.proacl) order by p.oid),'[]') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private','agent_core_private','runtime_publish_private','auth') and p.oid is distinct from to_regprocedure(${q(sig)}) and p.prokind='f'),
 'schema',(select jsonb_agg(jsonb_build_array(c.oid,c.relname,c.relkind,c.relacl,c.relrowsecurity) order by c.oid) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','agent_core_private','runtime_publish_private')),
 'constraints',(select jsonb_agg(jsonb_build_array(c.oid,pg_get_constraintdef(c.oid)) order by c.oid) from pg_constraint c),
 'memberships',(select coalesce(jsonb_agg(to_jsonb(m) order by roleid,member),'[]') from pg_auth_members m)
 );`));
const reject=(db,s,pattern)=>assert.throws(()=>db.sql(s),e=>pattern.test(e.stderr?.toString()??e.message));
const desired=db=>{const s=state(db);assert.equal(s.function.hash,expected);assert.equal(s.function.owner,'postgres');assert.equal(s.function.security,true);assert.deepEqual(s.function.config,['search_path=""']);assert.deepEqual(s.privileges,{postgres:true,authenticated:true,service_role:false,anon:false});assert.equal(s.public,false);return s;};
const bodyFromBaseline=name=>{const start=baseline.indexOf('CREATE FUNCTION '+name+'(');assert.ok(start>=0);return baseline.slice(start,baseline.indexOf('\n\nALTER FUNCTION',start)).replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION');};
async function authoring(){
 const db=await isolatedPostgres();
 try{
 db.sql(`alter table public.profiles add column role text default 'platform_super_admin';
 create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'))::uuid $$;
 ${bodyFromBaseline('private.is_platform_owner')}
 create table public.student_apps(id uuid primary key);
 create function public.current_user_can_manage_standard_question_bank() returns boolean language sql as $$select private.is_platform_owner()$$;
 create function private.current_user_can_read_student_app(uuid) returns boolean language sql as $$select auth.uid() is not null$$;
 alter table public.digital_textbook_modules add column if not exists module_code text;
 drop function ${sig};`);
 db.migrate('202609080001_chapter_practice_bindings.sql');
 db.migrate('202609080002_chapter_practice_explicit_function_grants.sql');
 // Existing 130002 helper already exists; replacing target only preserves exact SQL body.
 const source=readFileSync('supabase/migrations/202609130002_textbook_grammar_practice_binding.sql','utf8');
 const replacement=source.slice(source.indexOf('create or replace function public.review_chapter_practice_binding'),source.lastIndexOf('commit;'));
 db.sql(replacement);
 const f=nativeCapture();f.c.digital_textbook_modules[0].module_code='vocabulary';f.c.digital_textbook_nodes[0].content={vocabulary:[{ko:'학교',zh:'学校'}]};db.sql(`insert into public.student_apps values(${q(f.id.app)})`);db.seed(f);
 const snapshot=[{nodeId:f.c.digital_textbook_nodes[0].id,kind:'vocabulary',value:{ko:'학교',zh:'学校'}}];
 const call=({role='authenticated',subject=db.owner,app=f.id.app,revision=0,enabled=true,content=snapshot}={})=>`begin;set local role ${role};set local request.jwt.claim.sub=${q(subject??'')};select ${sig.split('(')[0]}(${q(app)},${q(f.id.chapter)},${revision},${j(content)},${enabled});commit;`;
 return {...db,f,snapshot,call};
 }catch(e){db.stop();throw e;}
}
const receipts=[];
async function owned(fn){const db=await isolatedPostgres();try{return await fn(db);}finally{db.stop();receipts.push({container:db.name,stopped:true,network:'none',pgdata:'tmpfs'});}}
// Isolated runner model, never a production installer. Track checksum and transactionality
// separately from the migration's deliberately strict, non-idempotent SQL contract.
function track(db,file){
 const bytes=readFileSync('supabase/migrations/'+file,'utf8'),version=file.split('_')[0],digest=sha(bytes);
 db.sql('create schema if not exists acl_test;create table if not exists acl_test.ledger(version text primary key,sha text not null)');
 const existing=db.sql(`select sha from acl_test.ledger where version=${q(version)}`);
 if(existing){assert.equal(existing,digest);return 'SKIPPED_CHECKSUM_MATCH';}
 db.sql(bytes.replace(/\bBEGIN;/i,`BEGIN;insert into acl_test.ledger values(${q(version)},${q(digest)});`));
 return 'INSTALLED';
}
function tableData(db){
 const query=db.sql(`select string_agg(format('select %L as relation, coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),%L::jsonb)::text as rows from %I.%I t',n.nspname||'.'||c.relname,'[]',n.nspname,c.relname),' union all ' order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','auth') and c.relkind='r'`);
 return db.sql(query);
}

test('ACL-F1 approved contract cases',{timeout:300000},async t=>{
 await t.test('ACL-D2-01 historical precondition is explicit and exact',()=>owned(db=>{const s=state(db);assert.equal(s.function.hash,expected);assert.deepEqual(s.privileges,{postgres:true,authenticated:true,service_role:true,anon:false});assert.equal(s.public,false);}));
 await t.test('ACL-D2-02 real CREATE/defaults -> anon repair -> replacement lifecycle',async()=>{const db=await authoring();try{const s=state(db);assert.equal(s.function.hash,expected);assert.equal(s.privileges.service_role,true);assert.equal(s.privileges.anon,false);}finally{db.stop();}});
 await t.test('ACL-D2-03 historical and desired baseline are separate; exact only-ACL delta',()=>owned(db=>{const before=state(db);db.migrate(aclMigration);const after=desired(db);assert.deepEqual(after.defaults,before.defaults);assert.deepEqual(after.others,before.others);assert.deepEqual(after.schema,before.schema);assert.deepEqual(after.constraints,before.constraints);assert.deepEqual(after.memberships,before.memberships);assert.deepEqual({...after.function,acl:before.function.acl},before.function);if(process.env.ACL_F1_EVIDENCE)writeFileSync(process.env.ACL_F1_EVIDENCE,JSON.stringify({definitionHash:expected,beforeAcl:before.function.acl,afterAcl:after.function.acl,beforeFingerprint:sha(JSON.stringify(before)),afterFingerprint:sha(JSON.stringify(after)),defaultsSha:sha(JSON.stringify(before.defaults)),otherFunctionsSha:sha(JSON.stringify(before.others)),schemaSha:sha(JSON.stringify(before.schema)),allProtectedEqual:true},null,2)+'\n');}));
 const db=await authoring();
 try{
  await t.test('ACL-D2-04 service-role without subject denied before fix',()=>reject(db,db.call({role:'service_role',subject:null}),/没有权限/));
  await t.test('ACL-D2-05 non-owner/inactive subjects denied before fix',()=>{reject(db,db.call({role:'service_role',subject:db.f.id.app}),/没有权限/);db.sql(`update profiles set status='inactive' where id=${q(db.owner)}`);reject(db,db.call({role:'service_role'}),/没有权限/);db.sql(`update profiles set status='active' where id=${q(db.owner)}`);});
  await t.test('ACL-D2-06 service-role with synthetic owner claims can reach guarded writes before fix',()=>{db.sql(db.call({role:'service_role'}));assert.equal(db.sql('select count(*) from chapter_practice_bindings'),'1');});
  db.migrate(aclMigration);
  await t.test('ACL-D2-07 service-role denied even with owner claims after fix',()=>reject(db,db.call({role:'service_role',revision:1,enabled:false}),/permission denied for function/));
  await t.test('ACL-D2-08 authenticated Owner enable/disable remains functional',()=>{db.sql(db.call({revision:1,enabled:false}));assert.equal(db.sql('select is_enabled from chapter_practice_bindings'),'f');db.sql(db.call({revision:2}));assert.equal(db.sql('select is_enabled from chapter_practice_bindings'),'t');});
  await t.test('ACL-D2-09 authenticated wrong/absent/inactive subject denied',()=>{for(const subject of [null,db.f.id.app])reject(db,db.call({subject,revision:3}),/没有权限/);db.sql(`update profiles set status='inactive' where id=${q(db.owner)}`);reject(db,db.call({revision:3}),/没有权限/);db.sql(`update profiles set status='active' where id=${q(db.owner)}`);});
  await t.test('ACL-D2-10 wrong application/published graph rejected',()=>{reject(db,db.call({app:db.f.id.version,revision:3}),/已发布/);db.sql(`update digital_textbook_versions set status='draft'`);reject(db,db.call({revision:3}),/已发布/);db.sql(`update digital_textbook_versions set status='published'`);});
  await t.test('ACL-D2-11 revision/source/grammar conflict does not change approved binding',()=>{const prior=db.sql('select row_to_json(b) from chapter_practice_bindings b');reject(db,db.call({revision:1}),/关联已被修改/);reject(db,db.call({revision:3,content:[]}),/内容已变化/);db.sql(`update digital_textbook_modules set module_code='grammar';update digital_textbook_nodes set content='{"grammarCards":"invalid"}'`);reject(db,db.call({revision:3}),/语法卡格式无效/);assert.equal(db.sql('select row_to_json(b) from chapter_practice_bindings b'),prior);});
 }finally{db.stop();}
 const cases=[
  ['ACL-D2-12 missing target',`drop function ${sig}`],
  ['ACL-D2-12 wrong overload only',`drop function ${sig};create function public.review_chapter_practice_binding(uuid) returns boolean language sql as $$select true$$`],
  ['ACL-D2-13 wrong body',`create or replace function ${sig.replace('uuid,uuid,integer,jsonb,boolean','p_app_id uuid,p_chapter_id uuid,p_expected_revision integer,p_expected_snapshot jsonb,p_enabled boolean')} returns uuid language plpgsql security definer set search_path='' as $$begin return null;end$$`],
  ['ACL-D2-13 wrong owner',`create role wrong_owner;alter function ${sig} owner to wrong_owner`],
  ['ACL-D2-13 security invoker',`alter function ${sig} security invoker`],
  ['ACL-D2-13 wrong search path',`alter function ${sig} set search_path=public`],
  ['ACL-D2-13 wrong volatility',`alter function ${sig} stable`],
  ['ACL-D2-13 wrong parallel',`alter function ${sig} parallel safe`],
  ['ACL-D2-13 wrong leakproof',`alter function ${sig} leakproof`],
  ['ACL-D2-14 extra grantee',`create role extra;grant execute on function ${sig} to extra`],
  ['ACL-D2-14 grant option',`grant execute on function ${sig} to service_role with grant option`],
  ['ACL-D2-14 unexpected grantor',`create role extra_grantor;grant execute on function ${sig} to extra_grantor with grant option;set role extra_grantor;grant execute on function ${sig} to service_role;reset role`],
  ['ACL-D2-14 missing authenticated',`revoke execute on function ${sig} from authenticated`],
  ['ACL-D2-15 PUBLIC',`grant execute on function ${sig} to public`],
  ['ACL-D2-15 anon inherited',`grant authenticated to anon`],
  ['ACL-D2-16 service-role already absent',`revoke execute on function ${sig} from service_role`],
  ['ACL-D2-17 postcondition failure rolls back REVOKE (inherited service privilege)',`grant authenticated to service_role`],
 ];
 for(const [name,edit]of cases)await t.test(name,()=>owned(db=>{db.sql(edit);const before=state(db);reject(db,migration,/CHAPTER_PRACTICE_ACL_/);assert.deepEqual(state(db),before);}));
 await t.test('ACL-D2-16 second application FAILS; ledger skip is external, no silent success',()=>owned(db=>{db.migrate(aclMigration);const before=desired(db);reject(db,migration,/ENTRIES_MISMATCH/);assert.deepEqual(state(db),before);}));
 await t.test('ACL-D2-16 installed checksum skips SQL; changed checksum fails',()=>owned(db=>{assert.equal(track(db,aclMigration),'INSTALLED');const before=desired(db);assert.equal(track(db,aclMigration),'SKIPPED_CHECKSUM_MATCH');assert.deepEqual(state(db),before);db.sql("update acl_test.ledger set sha='wrong'");assert.throws(()=>track(db,aclMigration));assert.deepEqual(state(db),before);}));
 await t.test('ACL-D2-17 postcondition error rolls back runner ledger and target ACL',()=>owned(db=>{db.sql('grant authenticated to service_role;create schema acl_test;create table acl_test.ledger(version text primary key,sha text not null)');const before=state(db);assert.throws(()=>track(db,aclMigration));assert.deepEqual(state(db),before);assert.equal(db.sql('select count(*) from acl_test.ledger'),'0');}));
 await t.test('ACL-D2-18 overload/defaults/peer ACL and schema objects untouched',()=>owned(db=>{db.sql(`create function public.review_chapter_practice_binding(uuid) returns boolean language sql as $$select true$$;grant execute on function public.review_chapter_practice_binding(uuid) to service_role`);const before=state(db);db.migrate(aclMigration);const after=desired(db);for(const k of ['others','defaults','schema','constraints','memberships'])assert.deepEqual(after[k],before[k]);}));
 await t.test('ACL-D2-18 public/Auth fixture table contents unchanged',()=>owned(db=>{const before=tableData(db);db.migrate(aclMigration);assert.equal(tableData(db),before);}));
 await t.test('ACL-D2-21 exact tracked order with checksum ledger',()=>owned(db=>{for(const file of [aclMigration,completionMigration,publicationMigration]){assert.equal(track(db,file),'INSTALLED');desired(db);}assert.equal(db.sql("select string_agg(version,',' order by version) from acl_test.ledger"),'202609180000,202609180001,202609180002');}));
 for(const [id,files]of [['19',[completionMigration]],['20',[publicationMigration]],['21',[completionMigration,publicationMigration]]])await t.test(`ACL-D2-${id} historical ->000 ->${files.map(x=>x.slice(8,12)).join(' ->')} compatibility`,()=>owned(db=>{db.migrate(aclMigration);const before=desired(db);for(const file of files){db.migrate(file);const after=desired(db);assert.deepEqual(after.function,before.function);}assert.ok(db.sql("select count(*) from pg_proc where proname='review_chapter_practice_binding'")==='1');}));
 await t.test('ACL-D2-22 unchanged 001/002 hashes, strict order and narrow mutation',()=>{assert.equal(sha(readFileSync('supabase/migrations/'+completionMigration)),'60a0f6158aeb44791b18ad72f6d09b9132cb87b1a7acc46c0f7fafc4798f07ad');assert.equal(sha(readFileSync('supabase/migrations/'+publicationMigration)),'ed0f382ad45dda046335377b83c3f8f17cd53d173a24915901e581879dc31027');assert.deepEqual([aclMigration,completionMigration,publicationMigration].sort(),[aclMigration,completionMigration,publicationMigration]);assert.equal(readdirSync('supabase/migrations').filter(x=>x.startsWith('202609180000_')).length,1);assert.doesNotMatch(migration,/create\s+(or\s+replace\s+)?function|alter\s+(default|function)|grant\s+execute|on\s+all\s+functions/i);assert.equal((migration.match(/REVOKE EXECUTE/g)??[]).length,1);});
 await t.test('ACL-D2-23 full immutable app bootstrap + incrementals ->000',async()=>{await fullBootstrap();});
 if(process.env.ACL_F1_CLEANUP)writeFileSync(process.env.ACL_F1_CLEANUP,JSON.stringify(receipts,null,2)+'\n');
});

async function fullBootstrap(){
 // Full application baseline; schema-only platform stand-ins, no Auth service or credentials.
 const name='uply-acl-f1-full-'+crypto.randomUUID(),image='public.ecr.aws/supabase/postgres:17.6.1.159';
 const docker=(args,input)=>execFileSync('docker',args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:30*1024*1024});
 docker(['run','--rm','-d','--pull=never','--network','none','--name',name,'--label','uply.task=acl-f1','--read-only','--tmpfs','/tmp:rw,size=1024m,mode=1777','--user','100:101','--entrypoint','/bin/sh',image,'-c',"initdb -D /tmp/pg -A trust --no-locale >/tmp/init.log && exec postgres -D /tmp/pg -k /tmp -c listen_addresses='' -c max_connections=20"]);
 const sql=s=>docker(['exec','-i',name,'psql','-h','/tmp','-U','postgres','-XqAt','-v','ON_ERROR_STOP=1'],s).trim();
 try{
  const i=JSON.parse(docker(['inspect',name]))[0];assert.equal(i.HostConfig.NetworkMode,'none');assert.equal(i.HostConfig.Binds,null);assert.equal(Object.keys(i.HostConfig.PortBindings??{}).length,0);
  let ready=false;for(let n=0;n<80;n++){try{sql('select 1');ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}assert.ok(ready);
  const init=['00000000000000-initial-schema.sql','00000000000001-auth-schema.sql','00000000000002-storage-schema.sql'].map(f=>docker(['run','--rm','--pull=never','--network','none','--entrypoint','cat',image,'/docker-entrypoint-initdb.d/init-scripts/'+f])).join('\n');
  sql('create role supabase_admin superuser;'+init);
  sql(`create schema if not exists extensions;create extension if not exists btree_gist with schema public;
  create table storage.objects(id uuid primary key,bucket_id text,name text);create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
  create schema realtime;create table realtime.messages(id bigint,extension text,topic text,private boolean);create function realtime.topic() returns text language sql as $$select ''::text$$;
  create publication supabase_realtime_messages_publication;
  create or replace function auth.jwt() returns jsonb language sql as $$select '{}'::jsonb$$;`);
  const manifest=JSON.parse(readFileSync('supabase/bootstrap/baseline-manifest.json'));assert.equal(sha(baseline),manifest.baselineSqlDigest);
  // Restore into neutral app defaults, as the offline dump restorer does.
  // The immutable baseline restores historical public DEFAULT ACLs at its end.
  // Image init defaults must not grant anon prematurely to every restored function.
  sql(`alter default privileges for role postgres in schema public revoke all on functions from postgres,anon,authenticated,service_role;
   alter default privileges for role postgres in schema public revoke all on tables from postgres,anon,authenticated,service_role;
   alter default privileges for role postgres in schema public revoke all on sequences from postgres,anon,authenticated,service_role;`);
  sql("set uply.bootstrap_mode='new-environment';"+baseline);
  assert.equal(JSON.parse(sql(`select json_build_object('hash',encode(sha256(convert_to(pg_get_functiondef(${q(sig)}::regprocedure),'UTF8')),'hex'),'service',has_function_privilege('service_role',${q(sig)},'EXECUTE'))`)).service,true);
  // Actual historical version metadata, not a claim that 449 old migrations were replayed.
  const ledger=JSON.parse(readFileSync('supabase/bootstrap/migration-ledger-baseline.json'));
  assert.equal(ledger.length,449);
  sql('create schema acl_test;create table acl_test.ledger(version text primary key,sha text not null)');
  sql(`insert into acl_test.ledger values ${ledger.map(x=>`(${q(x.version)},'BASELINE_METADATA')`).join(',')}`);
  for(const m of manifest.postBaselineMigrations){assert.equal(sha(readFileSync('supabase/migrations/'+m.filename)),m.sha256);track({sql},m.filename);}
  track({sql},'202609170001_teaching_lesson_activity_binding.sql');
  assert.equal(sql('select count(*) from acl_test.ledger'),'458');
  const before=state({sql});let count=458;
  for(const m of [aclMigration,completionMigration,publicationMigration]){track({sql},m);desired({sql});assert.equal(sql('select count(*) from acl_test.ledger'),String(++count));}
  assert.equal(before.function.hash,expected);
  if(process.env.ACL_F1_FULL_PROOF)writeFileSync(process.env.ACL_F1_FULL_PROOF,JSON.stringify({baselineSha:sha(baseline),historicalLedgerMetadata:449,incrementals:9,projectedCounts:[458,459,460,461],bodySha:expected,baselineAcl:before.function.acl,finalAcl:desired({sql}).function.acl,platform:'SCHEMA_ONLY_STAND_INS_NOT_AUTH_E2E',fullApplicationBaseline:true,imageId:i.Image},null,2)+'\n');
 }finally{docker(['stop','--time','2',name]);receipts.push({container:name,stopped:true,network:'none',pgdata:'tmpfs',applicationBaseline:'FULL'});}
}
