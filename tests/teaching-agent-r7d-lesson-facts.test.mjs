import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture} from './fixtures/teaching-agent-r7d/readonly-fixture.mjs';
const cases=[
 ['wrong tenant',f=>{f.grant.domain.tenantId=randomUUID();},'not_found_or_not_visible'],
 ['wrong actor',f=>{f.grant.domain.actorId=randomUUID();},'not_found_or_not_visible'],
 ['wrong lesson',f=>{f.grant.content.lessonRef='ta1:lesson:'+'a'.repeat(64);},'not_found_or_not_visible'],
 ['wrong Activity',f=>{f.grant.domain.activityId=randomUUID();},'not_found_or_not_visible'],
 ['wrong version',f=>{f.grant.domain.versionId=randomUUID();},'stale'],
 ['missing progress',f=>f.alterRows(x=>({...x,progress:null})),'unavailable'],
 ['sequence mismatch',f=>f.alterRows(x=>{x.attempts[1].attemptNumber=3;return x;}),'stale'],
 ['attempt count mismatch',f=>f.alterRows(x=>{x.progress.attempt_count=3;return x;}),'unavailable'],
 ['completed progress but no correct attempt',f=>f.alterRows(x=>{x.attempts[1].correct=false;return x;}),'unavailable'],
 ['correct attempt but incomplete progress',f=>f.alterRows(x=>{x.progress.status='in_progress';return x;}),'unavailable'],
 ['mastery mismatch',f=>f.alterRows(x=>{x.progress.mastery_score=0;return x;}),'unavailable'],
 ['read failure',f=>f.failRead(),'unavailable'],
 ['stale snapshot',f=>{f.grant.binding.snapshotDigest='sha256:'+'b'.repeat(64);},'stale'],
 ['fixture mislabeled current DB',f=>f.alterResult(x=>{x.receipt.evidence.storage='CURRENT_DEVELOPMENT_DB';return x;}),'unavailable'],
 ['UNKNOWN is not zero',f=>f.alterResult(x=>{x.receipt.status='UNKNOWN';x.receipt.attemptNumber=0;x.receipt.completedAt=null;return x;}),'unavailable'],
 ['stale observation',f=>f.alterResult(x=>{x.receipt.evidence.observedAt=new Date(Date.now()-31000).toISOString();return x;}),'stale'],
 ['future observation',f=>f.alterResult(x=>{x.receipt.evidence.observedAt=new Date(Date.now()+31000).toISOString();return x;}),'stale'],
 ['content definition drift',f=>f.alterRows(x=>{x.definition.digest='c'.repeat(64);return x;}),'stale'],
 ['progress actor mismatch',f=>f.alterRows(x=>{x.progress.student_id=randomUUID();return x;}),'not_found_or_not_visible'],
 ['private output field injection',f=>f.alterResult(x=>{x.nodeProgress.answer_key='must not escape';return x;}),'unavailable'],
];
for(const [name,setup,status] of cases)test('R7D negative: '+name,async()=>{const f=await fixture();setup(f);const r=await f.read();assert.equal(r.status,status);assert.equal('data'in r,false);assert.equal(f.metrics.writes,0);});
test('R7D same snapshot / old completed facts observed freshly / unavailable cursor',async()=>{const f=await fixture();f.afterRead(()=>{f.rows.progress.mastery_score=0;});const r=await f.core();assert.equal(r.status,'partial');assert.equal(r.data.completionStatus,'COMPLETED');assert.equal(r.data.attemptCount,2);assert.equal(r.data.latestResult,'CORRECT');assert.equal(r.data.nodeProgress.masteryScore,100);assert.equal(r.data.evidence.attemptSequence,2);assert.equal(r.data.currentTeachingNode,null);assert.equal(r.data.currentPositionAvailability,'unavailable');assert.equal(f.metrics.reads,1);assert.ok(Date.parse(r.data.asOf)>Date.parse(r.data.completedAt));});
test('R7D fresh call reads again and detects changed durable facts',async()=>{const f=await fixture();assert.equal((await f.read()).status,'partial');f.rows.progress.mastery_score=0;assert.equal((await f.read()).status,'unavailable');assert.equal(f.metrics.reads,2);});
test('R7D wrong-only state is INCOMPLETE, not zero',async()=>{const f=await fixture();f.rows.attempts.pop();Object.assign(f.rows.progress,{attempt_count:1,status:'in_progress',completion_percent:0,mastery_score:0});const r=await f.read();assert.equal(r.data.completionStatus,'INCOMPLETE');assert.equal(r.data.latestResult,'INCORRECT');assert.equal(r.data.attemptCount,1);});
