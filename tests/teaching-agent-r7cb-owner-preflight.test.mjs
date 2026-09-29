import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {startAuthoring} from './fixtures/teaching-agent-r7cb/authoring-fixture.mjs';
import {createReadHarness,loadPreflight} from './fixtures/teaching-agent-r7cb/preflight-harness.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex');

test('OWNER_DRAFT_PREFLIGHT_UNDER_CURRENT_RLS',async t=>{
 const db=await startAuthoring({lessonRls:true});t.after(()=>db.stop());
 const h=await createReadHarness(db);const loaded=await loadPreflight(h);t.after(()=>loaded.close());
 const {readCanonicalBinding,createCanonicalBinding}=loaded.module;
 const policy=await db.raw("SELECT qual FROM pg_policies WHERE schemaname='public' AND tablename='learning_agent_lessons';");
 assert.match(policy,/status = 'published'/);assert.match(policy,/can_read_published_teaching_module/);
 await t.test('ordinary caller including Owner cannot SELECT draft under the real policy',async()=>{
  for(const actor of ['owner','non-owner']){h.actor=actor;const rows=await h.caller.from('learning_agent_lessons').select('*').eq('module_id',db.ids.module);assert.deepEqual(rows.data,[]);}
 });
 await t.test('Owner authoring preflight reads actual draft through server-only read port',async()=>{
  h.actor='owner';assert.equal(await readCanonicalBinding(h.caller),'EMPTY');
  assert.ok(h.events.some(e=>e.role==='service_role'&&e.table==='learning_agent_lessons'));
  assert.deepEqual(await db.counts(),{nodes:0,activities:0,secrets:0,attempts:0,progress:0});
 });
 for(const actor of ['non-owner','anonymous'])await t.test(`${actor} denied before any privileged read`,async()=>{
  h.actor=actor;const count=h.adminConstructed,events=h.events.length;
  await assert.rejects(readCanonicalBinding(h.caller),/OWNER_REQUIRED/);
  assert.equal(h.adminConstructed,count);assert.equal(h.events.length,events);
 });
 h.actor='owner';
 await t.test('wrong target blocked before constructing privileged reader',async()=>{
  const count=h.adminConstructed;h.fault=(table,r)=>table==='digital_textbook_chapters'?{...r,data:r.data.map(x=>({...x,title:{'zh-CN':'wrong target'}}))}:r;
  try{assert.equal(await readCanonicalBinding(h.caller),'BLOCKED');assert.equal(h.adminConstructed,count);}finally{h.fault=null;}
 });
 for(const table of ['learning_agent_lessons','learning_agent_script_versions','learning_agent_script_nodes'])await t.test(`freeze mismatch in ${table} blocks; no canonical UPDATE`,async()=>{
  h.fault=(t,r)=>t===table?{...r,data:r.data.map((x,i)=>i===0?{...x,readFault:'changed'}:x)}:r;
  try{assert.equal(await readCanonicalBinding(h.caller),'BLOCKED');}finally{h.fault=null;}
 });
 await t.test('read failure returns BLOCKED and does not dispatch write',async()=>{
  h.fault=(table,r)=>table==='learning_agent_lessons'?{data:null,error:{code:'READ_FAILED'}}:r;
  try{assert.equal(await readCanonicalBinding(h.caller),'BLOCKED');assert.equal(h.rpcCalls,0);}finally{h.fault=null;}
 });
 await t.test('create retains authenticated caller RPC, never privileged writer',async()=>{
  const before=await db.counts();const receipt=await createCanonicalBinding(h.caller);
  assert.equal(receipt.result,'CREATED');assert.equal(h.rpcCalls,1);assert.equal(h.lastRpc.name,'create_teaching_lesson_activity_binding');
  assert.deepEqual(h.lastRpc.expected,db.lock);assert.deepEqual(await db.counts(),before); // RPC spy only; no real create in this test.
 });
 const node=randomUUID(),activity=randomUUID();
 await t.test('real isolated partial node without Activity is BLOCKED',async()=>{
  await db.raw(`INSERT INTO public.digital_textbook_nodes(id,module_id,node_code,node_type,sort_order,estimated_minutes,title,content) VALUES('${node}','${db.ids.module}','hangul-introduction-vowel-recognition','practice',1,1,'{"zh-CN":"元音辨认"}','{}');`);
  assert.equal(await readCanonicalBinding(h.caller),'BLOCKED');
 });
 await t.test('real isolated Activity without private row is BLOCKED',async()=>{
  await db.raw(`INSERT INTO public.digital_textbook_activities(id,node_id,activity_key,activity_type,sort_order,prompt,instruction,options,public_config,max_attempts,counts_toward_completion) VALUES('${activity}','${node}','hangul-introduction-vowel-recognition','single_choice',1,'{"zh-CN":"哪个是元音？"}','{"zh-CN":"请选择一个选项。"}','[{"zh-CN":"ㄱ"},{"zh-CN":"ㅏ"},{"zh-CN":"ㄴ"}]','{}',3,true);`);
  assert.equal(await readCanonicalBinding(h.caller),'BLOCKED');
 });
 await t.test('complete existing binding returns only EXISTING; no private answer read',async()=>{
  await db.raw(`INSERT INTO public.digital_textbook_activity_secrets(activity_id,answer_key) VALUES('${activity}','{"kind":"index","value":1}');`);
  const result=await readCanonicalBinding(h.caller);assert.equal(result,'EXISTING');
  for(const e of h.events.filter(e=>e.table==='digital_textbook_activity_secrets'))assert.deepEqual({columns:e.columns,head:e.head},{columns:'activity_id',head:true});
  assert.doesNotMatch(JSON.stringify(result),/answer|index|[a-f0-9]{8}-/);
  const calls=h.rpcCalls;await assert.rejects(createCanonicalBinding(h.caller),/CANONICAL_BINDING_NOT_EMPTY/);assert.equal(h.rpcCalls,calls);
 });
 await t.test('published-only RLS unchanged after every preflight; ordinary secret SELECT denied',async()=>{
  const after=await db.raw("SELECT qual FROM pg_policies WHERE schemaname='public' AND tablename='learning_agent_lessons';");assert.equal(after,policy);
  h.actor='non-owner';assert.deepEqual((await h.caller.from('learning_agent_lessons').select('*').eq('module_id',db.ids.module)).data,[]);
  await assert.rejects(db.raw('BEGIN READ ONLY; SET LOCAL ROLE authenticated;SELECT count(*) FROM public.digital_textbook_activity_secrets;ROLLBACK;'),/permission denied/);
 });
 await t.test('installed canonical RPC and migration remain unchanged',async()=>{
  const source=readFileSync('supabase/migrations/202609170001_teaching_lesson_activity_binding.sql');assert.equal(hash(source),'6ec786c2ff4c6c4a39da297e72d20359746a4225f5ba5028ecce38253947f78c');
  assert.deepEqual(await db.counts(),{nodes:1,activities:1,secrets:1,attempts:0,progress:0});
 });
});
