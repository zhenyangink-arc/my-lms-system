import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture} from './fixtures/teaching-agent-r7d/readonly-fixture.mjs';
test('R7D cached receipt cannot pretend to be fresh',async()=>{const f=await fixture();let saved;f.alterResult(x=>{saved??=structuredClone(x);return structuredClone(saved);});assert.equal((await f.read()).status,'partial');assert.equal((await f.read()).status,'unavailable');assert.equal(f.metrics.reads,2);});
test('R7D model cannot relabel isolated storage; safe evidence refs correlate',async()=>{const f=await fixture(),r=await f.core();assert.equal(r.data.evidence.storage,'isolated-test-db');assert.equal(r.data.asOf,r.data.evidence.observedAt);assert.equal(r.data.revision,r.data.evidenceRefs[0].revision);assert.deepEqual(r.sourceRefs,[r.data.activityRef]);});
test('R7D no successful evidence after authorization revoked during read',async()=>{const f=await fixture();f.afterRead(()=>f.deny());assert.equal((await f.read()).status,'unavailable');});
test('R7D no valid progress row cannot be interpreted as completed',async()=>{const f=await fixture();f.rows.attempts=[];f.rows.progress=null;const r=await f.read();assert.equal(r.data.attemptCount,0);assert.equal(r.data.completionStatus,'INCOMPLETE');assert.equal(r.data.latestResult,'UNKNOWN');});
test('R7D registered production tools/Explain/planning remain unchanged',()=>{const reg=readFileSync('src/features/teaching-agent/server/tools/student-tool-registry.ts','utf8');assert.doesNotMatch(reg,/ExecutionFacts/);const skill=readFileSync('src/features/teaching-agent/skills/explain-pinned-korean-segment/definition.ts','utf8');assert.match(skill,/mandatory: \[lessonToolRef\]/);const prompt=readFileSync('src/features/teaching-agent/server/runtime/student-prompt-assembler.ts','utf8');assert.doesNotMatch(prompt,/completionStatus|attemptCount|COMPLETED/);});
test('R7D development composition uses Owner guard, fixed origin and READ ONLY path',()=>{const s=readFileSync('src/features/development-execution/server/lesson-facts-readonly.server.ts','utf8');assert.ok(s.indexOf('const owner=await requirePlatformOwner()')<s.indexOf('await verifyCurrentEnvironment()'));for(const x of ['verifyCurrentEnvironment','assertExecutionActor','READ ONLY','executeAllowedTool','createToolRegistry','two-attempt-development'])assert.ok(s.includes(x));assert.doesNotMatch(s,/issueExecutionScope\(|\.submit\(|\.activate\(|\.writeFile\(|createUser\(|coordinateStudentRun\(/);});

test('R7D real isolated PostgreSQL: Core -> Tool -> Port -> single snapshot, zero read deltas',async()=>{
 const {startDatabase,seedFixture}=await import('./fixtures/teaching-agent-r7c/postgres.mjs');
 const {createDurableFixture}=await import('./fixtures/teaching-agent-r7c/fixture.server.mjs');
 const db=await startDatabase();try{
  const durable=await createDurableFixture(db,await seedFixture(db));
  const correct=durable.definition.secret.answer_key.value;
  await durable.submit({binding:durable.binding,requestId:'isolated-wrong',generation:0},'option-'+((correct+1)%3));
  await durable.submit({binding:durable.binding,requestId:'isolated-correct',generation:0},'option-'+correct);
  const fingerprint=()=>db.raw("BEGIN READ ONLY;SELECT md5((SELECT json_agg(t)::text FROM public.digital_textbook_attempts t)||(SELECT json_agg(p)::text FROM public.digital_textbook_node_progress p));ROLLBACK;");
  const before=await fingerprint(),f=await fixture(durable),r=await f.core();
  assert.equal(r.status,'partial');assert.equal(r.data.attemptCount,2);assert.equal(r.data.latestResult,'CORRECT');assert.equal(r.data.completionStatus,'COMPLETED');assert.equal(r.data.nodeProgress.masteryScore,100);
  assert.equal(r.data.evidence.storage,'isolated-test-db');assert.equal(f.metrics.reads,1);assert.equal(await fingerprint(),before);
 }finally{await db.stop();}
});
test('R7D isolated-fixture receipt is rejected as non-durable evidence',async()=>{
 const f=await fixture();f.alterResult(x=>({...x,receipt:{...x.receipt,contract:'activity-completion/1',evidence:{source:'isolated-fixture',stateRevision:2,stateDigest:'a'.repeat(64),observedAt:new Date().toISOString()}}}));
 assert.equal((await f.read()).status,'unavailable');
});
