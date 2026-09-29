import test from 'node:test';import assert from 'node:assert/strict';
import {setup,readModule,issuerModule,identityHash} from './fixtures/teaching-agent-r7d-production/production-harness.mjs';
import {serverModule,uid} from './fixtures/teaching-agent-r7d-production/published-fixture.mjs';
const {productionLessonFactsOutputSchema}=await serverModule('src/features/teaching-agent/server/tools/contracts.ts');
const {publishedCompletionReceiptSchema}=await serverModule('src/features/smart-textbook-runtime/core/execution-contracts.ts');
for(const [name,edit]of [
 ['wrong database identity',x=>x.transport.identity={database:'another',system_identifier:'wrong'}],
 ['wrong fixed transport',()=>{process.env.UPLY_PUBLISHED_FACTS_DATABASE_URL='WRONG_TRANSPORT';}],
 ['missing fixed transport',()=>{delete process.env.UPLY_PUBLISHED_FACTS_DATABASE_URL;}],
 ['nonproduction composition',()=>{process.env.NODE_ENV='test';}],
 ['false dependency fence',x=>x.transport.fence=false],
 ['DB read failure',x=>x.transport.fail=true],
 ['wrong publication snapshot',x=>x.transport.bundle.manifest.snapshot.id='another'],
 ['wrong Activity',x=>x.transport.bundle.privatePayload.bindings[0].activityId=uid()],
 ['wrong lesson graph',x=>x.transport.bundle.privatePayload.source.book.lesson_id=uid()],
 ['wrong version graph',x=>x.transport.bundle.scope.versionId=uid()],
 ['missing node progress',x=>x.transport.rows.progress=null],
 ['attempt sequence mismatch',x=>x.transport.rows.attempts[0].attemptNumber=2],
 ['progress count mismatch',x=>x.transport.rows.progress.attempt_count=2],
 ['completed without correct attempt',x=>{x.transport.rows.attempts[0].correct=false;x.transport.rows.attempts[0].score=0;}],
 ['correct attempt with incomplete progress',x=>x.transport.rows.progress.status='in_progress'],
 ['mastery conflict',x=>x.transport.rows.progress.mastery_score=30],
 ['wrong progress actor',x=>x.transport.rows.progress.student_id=uid()],
 ['wrong progress tenant',x=>x.transport.rows.progress.tenant_id=uid()],
])test('provenance rejects '+name,async()=>{const x=await setup();edit(x);assert.notEqual((await x.submit()).status,'partial');assert.notEqual((await x.cap.validateEvidence()).status,'satisfied');});
test('one fresh read-only connection binds official publication, fence and facts',async()=>{const x=await setup(),a=await x.submit();assert.equal(a.status,'partial');const connection=x.transport.queries.filter(([id])=>id===1).map(([,s])=>s);assert.equal(connection.filter(q=>q.startsWith('BEGIN')).length,1);assert.match(connection[1],/REPEATABLE READ READ ONLY/);const pub=connection.findIndex(q=>q.includes('read_runtime_publication_v1')),fence=connection.findIndex(q=>q.includes('assert_runtime_dependency_fence')),facts=connection.findIndex(q=>q.includes('AS facts'));assert(pub<fence&&fence<facts&&facts<connection.indexOf('COMMIT'));for(const q of connection)assert.doesNotMatch(q,/\bINSERT\b|\bUPDATE\b|\bDELETE\b|record_smart_textbook/);const b=await x.submit();assert.equal(b.status,'partial');assert(x.transport.connections>=2);assert.equal(a.data.evidence.observedAt,a.data.asOf);});
test('UNKNOWN is unavailable, never a successful zero count',()=>assert.equal(publishedCompletionReceiptSchema.safeParse({contract:'activity-completion/3',status:'UNKNOWN',attemptNumber:0}).success,false));
test('real zero-attempt read stays incomplete with no invented progress/cursor',async()=>{const x=await setup({count:0}),r=await x.submit();assert.equal(r.status,'partial');assert.equal(r.data.completionStatus,'INCOMPLETE');assert.equal(r.data.attemptCount,0);assert.equal(r.data.latestResult,'UNKNOWN');assert.equal(r.data.nodeProgress,null);});
for(const source of ['CURRENT_DEVELOPMENT_DB','isolated-test-db','ISOLATED_FIXTURE','MOCK'])test(source+' cannot satisfy production DTO',async()=>{const x=await setup(),r=await x.submit();r.data.evidence.storage=source;assert.equal(productionLessonFactsOutputSchema.safeParse(r.data).success,false);});
test('forged production string cannot create an authorization or branded snapshot',async()=>{const x=await setup();assert.equal(readModule.isPublishedReadSnapshot({receipt:{provenance:{storage:'CURRENT_PUBLISHED_DB'}}}),false);await assert.rejects(readModule.readPublishedNativeActivity(x.input.binding.scope,{...x.context,callId:uid(),modelCallId:uid()}),e=>e.status==='not_found_or_not_visible');assert.equal(x.transport.connections,0);});
test('fresh issuer handle cannot be copied or used across runs',async()=>{const x=await setup({noCompose:true}),issuer=issuerModule.createProductionLessonFactsBinding(x.input),handle=await issuer.issue(x.context);await assert.rejects(issuer.read(handle,{...x.context,runId:uid(),callId:uid(),modelCallId:uid()}));await assert.rejects(issuer.read({...handle},{...x.context,callId:uid(),modelCallId:uid()}));});
test('Tool/Skill DTO has no raw identities, grading data or connection details',async()=>{const x=await setup(),r=await x.submit(),d=JSON.stringify(r),out=JSON.stringify(await x.cap.complete({}));for(const banned of [x.input.binding.scope.actorId,x.input.binding.scope.tenantId,'answer_key','privateDigest','stateDigest','ISOLATED_TRANSPORT_STUB',identityHash,'response','JWT','refresh_token']){assert.equal(d.includes(banned),false,banned);assert.equal(out.includes(banned),false,banned);}assert.equal(r.data.currentTeachingNode,null);});
test('old receipt is not refreshed when finalization performs a new read',async()=>{const x=await setup(),r=await x.submit();await new Promise(r=>setTimeout(r,4));const output=await x.cap.complete({});assert.equal(output.asOf,r.data.asOf);assert.equal(output.evidence.readStartedAt,r.data.evidence.readStartedAt);});
