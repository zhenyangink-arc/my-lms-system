import assert from 'node:assert/strict';
import test from 'node:test';
import {createDurableFixture} from './fixtures/teaching-agent-r7c/fixture.server.mjs';
import {startDatabase,seedFixture,startService} from './fixtures/teaching-agent-r7c/postgres.mjs';
import {StepController} from '../src/features/smart-textbook-runtime/core/step-controller.ts';
import {NativeMediaController} from '../src/features/smart-textbook-runtime/core/native-media-controller.ts';
import {createRuntimeFactsReadPort} from '../src/features/smart-textbook-runtime/core/runtime-facts.ts';
const request=(f,id='request-1',generation=1)=>({binding:f.binding,requestId:id,generation});
const wait=(o,p)=>p(o.snapshot())?Promise.resolve():new Promise((resolve,reject)=>{const timer=setTimeout(()=>{off();reject(Error('CONDITION_TIMEOUT'));},4000);const off=o.subscribe(()=>{if(p(o.snapshot())){off();clearTimeout(timer);resolve();}});});
async function runtime(f,overrides={}){const steps=new StepController(f.manifest),owner=new NativeMediaController(f.manifest,f.context,steps,{...f.ports(),...overrides}),media={paused:true,currentTime:0,duration:30,plays:0,pause(){this.paused=true;},async play(){this.paused=false;this.plays++;}};owner.attach(media,'test-video');await wait(owner,s=>s.restored);return {steps,owner,media};}
async function trigger(x){await x.owner.play();x.owner.seek(12);await wait(x.owner,s=>s.phase==='AWAITING_ACTIVITY');}
test('R7C actual durable SQL and runtime contract',async t=>{
 const db=await startDatabase();const fresh=async()=>{const ids=await seedFixture(db);return {ids,f:await createDurableFixture(db,ids)};};
 try{
 await t.test('wrong attempt durable INCOMPLETE; correct attempt durable COMPLETED; node progress distinct',async()=>{
  const {f}=await fresh();await f.submit(request(f,'wrong'),'option-0');let r=await f.readback(request(f,'independent'));
  assert.equal(r.status,'INCOMPLETE');assert.equal(r.attemptNumber,1);
  let rows=await f.repository.read(f.scope);assert.equal(rows.attempts[0].correct,false);assert.equal(rows.progress.status,'in_progress');
  await f.submit(request(f,'correct'),'option-1');r=await f.readback(request(f,'another-reader'));assert.equal(r.status,'COMPLETED');assert.equal(r.attemptNumber,2);
  rows=await f.repository.read(f.scope);assert.equal(rows.attempts[1].correct,true);assert.equal(rows.progress.status,'completed');assert.equal(rows.progress.attempt_count,2);assert.equal(rows.progress.completion_percent,100);assert.ok(r.completedAt);assert.deepEqual(f.initialState.completedStepIds,[]);
 });
 await t.test('concurrent identical request creates exactly one attempt; changed payload rejected',async()=>{
  const {f,ids}=await fresh(),r=request(f,'concurrent');const results=await Promise.all([f.submit(r,'option-0'),f.submit(r,'option-0')]);assert.equal(results.length,2);
  let rows=await f.repository.read(f.scope);assert.equal(rows.attempts.length,1);assert.equal(rows.progress.attempt_count,1);
  await assert.rejects(f.submit(r,'option-1'),/REJECTED/);const restarted=await createDurableFixture(db,ids);await restarted.submit({...r,generation:2},'option-0');rows=await f.repository.read(f.scope);assert.equal(rows.attempts.length,1);
 });
 await t.test('request text is SQL data and may not inject a second statement',async()=>{
  const {f}=await fresh();await f.submit(request(f,"request'; SELECT pg_sleep(99); -- $r7c$"),'option-0');assert.equal((await f.repository.read(f.scope)).attempts.length,1);
 });
 await t.test('lost response committed/no-commit, independent readback, no retry',async()=>{
  const {f}=await fresh();f.setMode('lost-completed');await assert.rejects(f.submit(request(f),'option-1'));assert.equal((await f.readback(request(f))).status,'COMPLETED');assert.equal(f.metrics.submits,1);
  const {f:g}=await fresh();g.setMode('lost-no-commit');await assert.rejects(g.submit(request(g),'option-1'));assert.equal((await g.readback(request(g))).status,'INCOMPLETE');assert.equal((await g.repository.read(g.scope)).attempts.length,0);
  g.setMode('unknown');assert.equal((await g.readback(request(g))).status,'UNKNOWN');assert.equal(g.metrics.submits,1);
 });
 await t.test('content change after pin fails closed, no attempt; exact atomic RPC missing never falls back',async()=>{
  const {f}=await fresh();const original=f.repository.read;
  f.repository.read=async scope=>{const raw=await original(scope);raw.definition.digest='0'.repeat(64);return raw;};
  await assert.rejects(f.submit(request(f),'option-1'));assert.equal((await f.readback(request(f))).status,'UNKNOWN');assert.equal((await original(f.scope)).attempts.length,0);
  // Inspect actual overload, never remove production or even test schema to simulate it.
  const broken=await createDurableFixture({transaction:sql=>sql.includes('public.record_smart_textbook_attempt(')?Promise.reject(Error('PGRST202')):db.transaction(sql)},(await fresh()).ids);
  await assert.rejects(broken.submit(request(broken),'option-1'),/PGRST202/);assert.equal((await broken.repository.read(broken.scope)).attempts.length,0);
 });
 await t.test('correct resumes only after independent readback; wrong and UNKNOWN hold',async()=>{
  const {f}=await fresh(),x=await runtime(f);try{await trigger(x);await x.owner.submit('test-activity','option-0');assert.equal(x.media.paused,true);assert.equal(f.metrics.readbacks,1);
   await x.owner.submit('test-activity','option-1');await wait(x.owner,s=>s.phase==='PLAYING');assert.equal(f.metrics.readbacks,2);assert.equal(x.media.plays,2);const facts=createRuntimeFactsReadPort(x.owner).read();assert.equal(facts.completion.status,'COMPLETED');assert.equal(facts.currentActivity,'hangul-introduction-vowel-recognition');assert.equal(facts.attemptSummary.attemptSequence,2);assert.equal(facts.stateEvidence.source,'activity-domain');assert.doesNotMatch(JSON.stringify(facts),/answer_key|optionIndex|requestId|correctAnswer/);
  }finally{x.steps.dispose();}
  const {f:g}=await fresh(),y=await runtime(g);try{await trigger(y);g.setMode('unknown');await y.owner.submit('test-activity','option-1');assert.equal(y.media.paused,true);assert.equal(y.owner.snapshot().unknown,true);}finally{y.steps.dispose();}
 });
 await t.test('valid submit receipt alone cannot resume and old generation readback is ignored',async()=>{
  const {f}=await fresh();let release,entered;const called=new Promise(r=>entered=r);const x=await runtime(f,{readback:async r=>{const out=await f.readback(r);entered();await new Promise(r=>release=r);return out;}});await trigger(x);const pending=x.owner.submit('test-activity','option-1');await called;assert.equal(x.media.paused,true);assert.equal(x.owner.snapshot().phase,'CHECKING_COMPLETION');x.steps.dispose();const y=await runtime(f);release();await pending;assert.equal(y.media.plays,0);assert.equal(y.owner.snapshot().phase,'RESUME_READY');y.steps.dispose();
 });
 await t.test('persisted evidence from a different private definition cannot restore completion',async()=>{
  const {f}=await fresh();await f.submit(request(f),'option-1');const original=f.repository.read;
  f.repository.read=async scope=>{const raw=await original(scope);raw.attempts[0].response.definitionDigest='0'.repeat(64);return raw;};
  assert.equal((await f.readback(request(f))).status,'UNKNOWN');
 });
 await t.test('missing progress after a correct attempt is UNKNOWN, never callback completion',async()=>{
  const {f}=await fresh();await f.submit(request(f),'option-1');const original=f.repository.read;
  f.repository.read=async scope=>{const raw=await original(scope);raw.progress=null;return raw;};
  assert.equal((await f.readback(request(f))).status,'UNKNOWN');
 });
 await t.test('child service termination completed/waiting rebuilds solely from surviving DB',async()=>{
  const {f,ids}=await fresh();let h=await startService(db,ids);const post=async(path,r,hint)=>{const res=await fetch(h.url+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({request:r,optionId:hint})});assert.equal(res.status,200);return res.json();};
  try{const r=request(f);await post('/checkpoint',r);const old=h.pid;await h.stop();h=await startService(db,ids);assert.notEqual(h.pid,old);let restored=await post('/restore',r,'waiting');assert.equal(restored.pending,true);assert.equal(restored.receipt.status,'INCOMPLETE');
   await post('/submit',r,'option-1');assert.equal((await post('/readback',r)).status,'COMPLETED');await h.stop();h=await startService(db,ids);restored=await post('/restore',r,'waiting');assert.equal(restored.pending,false);assert.equal(restored.receipt.status,'COMPLETED');assert.equal(restored.receipt.attemptNumber,1);
   // Replay the same logical request against an entirely new service process.
   await post('/submit',{...r,generation:2},'option-1');assert.equal((await f.repository.read(f.scope)).attempts.length,1);
  }finally{await h.stop();}
 });
 }finally{await db.stop();}
});
