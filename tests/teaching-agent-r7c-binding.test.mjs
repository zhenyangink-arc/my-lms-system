import assert from 'node:assert/strict';
import test from 'node:test';
import {projectionInput} from './fixtures/teaching-agent-r7b/fixture.server.mjs';
const {projectFrozenExecution}=await import('../src/features/smart-textbook-runtime/server/native-execution-projection.server.ts');
const {acceptCompletion,completionSequence}=await import('../src/features/smart-textbook-runtime/core/execution-contracts.ts');
import {createDurableFixture} from './fixtures/teaching-agent-r7c/fixture.server.mjs';
import {startDatabase,seedFixture} from './fixtures/teaching-agent-r7c/postgres.mjs';
test('R7C existing schema binding/private answer separation/real RPC catalog',async t=>{
 const db=await startDatabase();try{
 const ids=await seedFixture(db),f=await createDurableFixture(db,ids);
 await t.test('legitimate FK chain, one activity and server-only secret',async()=>{
  assert.equal(await db.raw('select count(*) from public.digital_textbook_nodes'),'1');assert.equal(await db.raw('select count(*) from public.digital_textbook_activities'),'1');assert.equal(await db.raw('select count(*) from public.digital_textbook_activity_secrets'),'1');
  assert.equal(f.definition.activity.activity_type,'single_choice');assert.equal(f.manifest.blocks.find(b=>b.id==='test-activity').type,'multiple_choice');
  await assert.rejects(db.raw('set role authenticated;select answer_key from public.digital_textbook_activity_secrets'),/permission denied/);
  await assert.rejects(db.raw("set role authenticated;select public.record_smart_textbook_attempt(null,null,null,null,'{}',true,100)"),/permission denied/);
 });
 await t.test('public manifest never serializes raw/private source; mismatched scope rejected',async()=>{
  const text=JSON.stringify(f.manifest);assert.doesNotMatch(text,/answer_key|answerKey|correctIndex|correctAnswer|正确答案|B\. ㅏ|native-choice-response/);assert.ok(!text.includes(ids.activityId));assert.ok(!text.includes(f.definition.digest));
  assert.throws(()=>projectFrozenExecution({...projectionInput,activity:{alias:'wrong'}}));
  await assert.rejects(createDurableFixture(db,{...ids,nodeId:ids.activityId}));
 });
 await t.test('durable receipt version2 freshness is attempt sequence, not content/CAS',async()=>{
  const r={binding:f.binding,requestId:'first-read',generation:1},receipt=await f.readback(r);
  assert.equal(receipt.contract,'activity-completion/2');assert.equal(receipt.status,'INCOMPLETE');assert.equal(completionSequence(receipt),0);assert.ok(!('stateRevision'in receipt.evidence));assert.equal(acceptCompletion(receipt,r).status,'INCOMPLETE');
  assert.throws(()=>acceptCompletion({...receipt,status:'COMPLETED'},r));
 });
 }finally{await db.stop();}
});
