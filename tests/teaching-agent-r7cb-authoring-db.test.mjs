import test from 'node:test';
import assert from 'node:assert/strict';
import {startAuthoring} from './fixtures/teaching-agent-r7cb/authoring-fixture.mjs';

// One owned parent/frozen graph. Failure triggers inject transport/database failure,
// never UPDATE canonical prompts or frozen authoring rows.
test('canonical authoring RPC: real isolated transaction and authorization',async t=>{
 const db=await startAuthoring();t.after(()=>db.stop());
 const empty={nodes:0,activities:0,secrets:0,attempts:0,progress:0};
 await t.test('unauthenticated and non-owner fail before writes',async()=>{
  await assert.rejects(db.call({owner:null}),/AUTHORING_FORBIDDEN/);
  await assert.rejects(db.call({allowed:false}),/AUTHORING_FORBIDDEN/);
  assert.deepEqual(await db.counts(),empty);
 });
 await t.test('service_role and unprivileged callers have no RPC grant',async()=>{
  for(const role of ['service_role','r7cb_unprivileged'])await assert.rejects(db.raw(`BEGIN; SET LOCAL ROLE ${role};${db.invocation()}ROLLBACK;`),/permission denied/);
 });
 await t.test('inactive or provisioned owner rejected without creating auth data',async()=>{
  for(const field of ['inactive','provisioned'])await assert.rejects(db.raw(`${db.begin}SET LOCAL test.${field}='true';${db.invocation()}ROLLBACK;`),/AUTHORING_FORBIDDEN/);
  assert.deepEqual(await db.counts(),empty);
 });
 await t.test('partial execution parent is rejected, never repaired',async()=>{
  await assert.rejects(db.raw(`BEGIN;INSERT INTO public.digital_textbook_nodes(module_id,node_code,node_type,sort_order,title) VALUES('${db.ids.module}','partial','practice',1,'{}');SET LOCAL ROLE authenticated;SET LOCAL test.owner='${db.ids.owner}';SET LOCAL test.owner_allowed='true';${db.invocation()}ROLLBACK;`),/AUTHORING_PARTIAL_OR_DUPLICATE/);
  assert.deepEqual(await db.counts(),empty);
 });
 await t.test('invalid freeze and private contract fail closed',async()=>{
  await assert.rejects(db.call({expected:{...db.lock,lesson:'0'.repeat(64)}}),/AUTHORING_FREEZE_MISMATCH/);
  await assert.rejects(db.call({answer:{kind:'index'}}),/AUTHORING_INVALID_PRIVATE_CONTRACT/);
  await assert.rejects(db.call({answer:{kind:'index',value:9}}),/AUTHORING_INVALID_PRIVATE_CONTRACT/);
  assert.deepEqual(await db.counts(),empty);
 });
 for(const table of ['digital_textbook_nodes','digital_textbook_activities','digital_textbook_activity_secrets'])await t.test(`failure after ${table} insert rolls entire transaction back`,async()=>{
  await db.raw(`CREATE FUNCTION public.r7cb_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'INJECTED_FAILURE'; END $$; CREATE TRIGGER r7cb_fault AFTER INSERT ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.r7cb_fault();`);
  try{await assert.rejects(db.call(),/INJECTED_FAILURE/);assert.deepEqual(await db.counts(),empty);}finally{await db.raw(`DROP TRIGGER r7cb_fault ON public.${table};DROP FUNCTION public.r7cb_fault();`);}
 });
 await t.test('concurrent calls create one triple, duplicate returns existing',async()=>{
  const results=await Promise.all([db.call(),db.call()]);
  assert.deepEqual(results.map(x=>x.result).sort(),['CREATED','EXISTING']);
  assert.deepEqual(results.map(x=>x.insertedRows).sort(),[0,3]);
  assert.deepEqual(await db.counts(),{nodes:1,activities:1,secrets:1,attempts:0,progress:0});
  for(const r of results){const s=JSON.stringify(r);assert.doesNotMatch(s,/answer|definitionDigest|[a-f0-9]{8}-[a-f0-9]{4}-/);assert.equal(r.contract,'canonical-activity-binding/1');}
 });
 await t.test('existing private binding mismatch is never repaired',async()=>{
  await assert.rejects(db.call({answer:{kind:'index',value:2}}),/AUTHORING_EXISTING_BINDING_MISMATCH/);
  assert.deepEqual(await db.counts(),{nodes:1,activities:1,secrets:1,attempts:0,progress:0});
 });
});
