import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,call,randomUUID,ledgerFixture,toolRef} from './fixtures/teaching-agent-r7d-c/skill-binding-fixture.mjs';
const {checkExecutionSummaryEvidence:check}=await import('../src/features/teaching-agent/skills/summarize-current-lesson-execution/evidence.ts');
test('R7DC-09 mandatory receipt satisfies local completion gate',async()=>{const x=await setup();await x.submit();assert.deepEqual(await x.cap.validateEvidence(),{status:'satisfied'});assert.equal((await x.cap.complete()).contract.name,'student-execution-summary');});
test('R7DC-10 no receipt cannot complete',async()=>{const x=await setup();await assert.rejects(x.cap.complete(),/REQUIRED_EVIDENCE_MISSING/);assert.equal(x.f.metrics.reads,0);});
test('R7DC-14 forged/copied receipt and model ref rejected',async()=>{const x=await ledgerFixture();assert.equal(check({...x.receipt},x.bound,x.f.context).status,'invalid');assert.equal('setEvidence' in x.cap,false);await assert.rejects(x.cap.complete({evidenceRef:'model-says-complete'}),/REQUIRED_EVIDENCE_MISSING/);});
test('R7DC-13 cross-run/skill/authority receipt rejected',async()=>{const x=await ledgerFixture();for(const patch of [{runId:randomUUID()},{skillRunId:randomUUID()},{authority:{...x.f.context.authority}}])assert.equal(check(x.receipt,x.bound,{...x.f.context,...patch}).status,'invalid');assert.equal(check(x.receipt,{...x.bound},x.f.context).status,'invalid');});
test('R7DC-11 wrong exact version cannot be recorded by executor ledger',async()=>{const x=await ledgerFixture();await assert.rejects(x.ledger.execute(call(),randomUUID(),{...toolRef,version:'2.0.0'}),/TOOL_NOT_ALLOWED/);assert.equal(check(x.ledger.get({...toolRef,version:'2.0.0'}),x.bound,x.f.context).status,'missing');});
test('R7DC-12 stale evidence and expired deadline rejected',async()=>{const x=await ledgerFixture(),clock=Date.now;Date.now=()=>clock()+31000;try{assert.equal(check(x.receipt,x.bound,x.f.context).status,'invalid');}finally{Date.now=clock;}});
test('R7DC-15 copied handle denied',async()=>{await assert.rejects(setup(i=>{i.handle={...i.handle};}),/READ_UNAVAILABLE/);});
test('R7DC-16 isolated source cannot pretend current',async()=>{const x=await setup();x.f.alterResult(r=>({...r,receipt:{...r.receipt,evidence:{...r.receipt.evidence,storage:'CURRENT_DEVELOPMENT_DB'}}}));assert.equal((await x.submit()).status,'unavailable');await assert.rejects(x.cap.complete(),/REQUIRED_EVIDENCE_MISSING/);});
test('R7DC-17 UNKNOWN zero does not mean no attempts',async()=>{const x=await setup();x.f.failRead();assert.equal((await x.submit()).status,'unavailable');await assert.rejects(x.cap.complete(),/REQUIRED_EVIDENCE_MISSING/);});
for(const mode of ['failure','stale','denied'])test('R7DC-18/27 failed fresh '+mode+' invalidates old evidence without fallback',async()=>{const x=await setup();await x.submit();if(mode==='failure')x.f.failRead();else if(mode==='stale')x.f.grant.content.contentBinding+='x';else x.f.deny();try{await x.submit();}catch{}await assert.rejects(x.cap.complete(),/REQUIRED_EVIDENCE_MISSING/);assert.ok(x.f.metrics.reads<=2);});
test('R7DC-26 model cannot author numbers/status/refs/free text',async()=>{const x=await setup();await x.submit();for(const v of [{masteryScore:100},{attemptCount:2},{completionStatus:'COMPLETED'},{responseText:'学生已完成'},{evidence:{source:'CURRENT_DEVELOPMENT_DB'}}])await assert.rejects(x.cap.complete(v),/SKILL_OUTPUT_INVALID/);});
test('R7DC-24 missing cursor stays unavailable',async()=>{const x=await setup();await x.submit();const o=await x.cap.complete();assert.equal(o.currentTeachingNode,null);assert.equal(o.currentPositionAvailability,'unavailable');assert.ok(o.sourceTeachingNodeRef);});
test('R7DC-25 bounded output contains no private markers/identity',async()=>{const x=await setup();await x.submit();const s=JSON.stringify(await x.cap.complete());assert.doesNotMatch(s,/answer_key|definitionDigest|optionIndex|password|JWT|refresh_token|"response"/);for(const v of Object.values(x.f.grant.domain))assert.ok(!s.includes(v));assert.ok(!s.includes(x.f.grant.definitionDigest));assert.ok(Buffer.byteLength(s)<16384);});
test('R7DC-28 fresh calls and cached receipt rejected',async()=>{const x=await setup();let saved;x.f.alterResult(r=>{saved??=structuredClone(r);return structuredClone(saved);});await x.submit();await x.submit();await assert.rejects(x.cap.complete(),/REQUIRED_EVIDENCE_MISSING/);assert.equal(x.f.metrics.reads,2);});
test('R7DC-30 finalization binding/permission drift fails closed',async()=>{const x=await setup();await x.submit();x.f.grant.domain.versionId=randomUUID();await assert.rejects(x.cap.complete(),/REQUIRED_EVIDENCE_MISSING/);const y=await setup();await y.submit();y.input.policy.evaluate=async()=>({effect:'deny',code:'TOOL_NOT_ALLOWED'});await assert.rejects(y.cap.complete(),/REQUIRED_EVIDENCE_MISSING/);});
test('invalid arbitrary read evidence cannot establish authoritative completion',async()=>{const x=await setup();x.f.alterRows(r=>({...r,attempts:r.attempts.filter(a=>!a.correct)}));assert.equal((await x.submit()).status,'unavailable');await assert.rejects(x.cap.complete(),/REQUIRED_EVIDENCE_MISSING/);});
test('genuine different-version Core receipt cannot satisfy v1 mandatory evidence',async()=>{
 const x=await ledgerFixture();
 const {createToolRegistry}=await import('../src/features/agent-core/tools/registry.ts');
 const {createStudentToolEvidenceLedger}=await import('../src/features/teaching-agent/server/composition/create-student-ai-teacher-capabilities.ts');
 const {executionSummarySkillRef}=await import('../src/features/teaching-agent/skills/summarize-current-lesson-execution/definition.ts');
 const v2={...x.f.tool,definition:{...x.f.tool.definition,version:'2.0.0'}};
 const ledger=createStudentToolEvidenceLedger({context:x.f.context,skill:executionSummarySkillRef,binding:x.bound,visible:[v2.definition],registry:createToolRegistry([v2]),policy:x.f.policy});
 await ledger.execute(call(),randomUUID(),v2.definition);
 assert.equal(check(ledger.get(v2.definition),x.bound,x.f.context).status,'invalid');
});
test('fact field/secret injection cannot pass actual Tool output validator',async()=>{
 const x=await setup();const read=x.input.issuer.read.bind(x.input.issuer);
 x.input.issuer.read=async(...args)=>{const r=await read(...args);return {...r,content:{...r.content,privateAnswer:'PRIVATE-SENTINEL'}};};
 assert.equal((await x.submit()).status,'unavailable');await assert.rejects(x.cap.complete(),/REQUIRED_EVIDENCE_MISSING/);
});
test('expired observation and deadline reject previously valid evidence',async()=>{
 const x=await ledgerFixture(),clock=Date.now;
 // The existing context identity/deadline stays fixed; check just inside expiry first.
 const before=check(x.receipt,x.bound,x.f.context);assert.equal(before.status,'satisfied');
 Date.now=()=>clock()+31000;
 try{assert.equal(check(x.receipt,x.bound,x.f.context).status,'invalid');}finally{Date.now=clock;}
});
test('returned Tool DTO cannot mutate the private ledger',async()=>{const x=await setup(),r=await x.submit();r.data.attemptCount=19;r.data.nodeProgress.masteryScore=0;const o=await x.cap.complete();assert.equal(o.attemptCount,2);assert.equal(o.nodeProgress.masteryScore,100);});
test('R7DC-12 observation older than30s rejected while authorization/deadline still valid',async()=>{
 const x=await ledgerFixture();
 const {createStudentToolEvidenceLedger}=await import('../src/features/teaching-agent/server/composition/create-student-ai-teacher-capabilities.ts');
 const {createLessonExecutionFactsReadPort}=await import('../src/features/teaching-agent/server/domain-ports/lesson-execution-facts-read-port.ts');
 const {createLessonExecutionFactsTool}=await import('../src/features/teaching-agent/server/tools/get-current-lesson-execution-facts.ts');
 const {createToolRegistry}=await import('../src/features/agent-core/tools/registry.ts');
 const {executionSummarySkillRef}=await import('../src/features/teaching-agent/skills/summarize-current-lesson-execution/definition.ts');
 const deadline=new Date(Date.now()+90000).toISOString();x.f.context.authority.expiresAt=deadline;
 const ctx={...x.f.context,deadlineAt:deadline},handle=await x.f.issuer.issue(ctx);
 const tool=createLessonExecutionFactsTool(createLessonExecutionFactsReadPort(x.f.issuer),handle);
 const policy={async evaluate(authority){await x.f.issuer.revalidate(handle,ctx);return {effect:'allow',policyVersion:authority.policyVersion,scopeRef:authority.scopeRef,expiresAt:authority.expiresAt};}};
 const ledger=createStudentToolEvidenceLedger({context:ctx,skill:executionSummarySkillRef,binding:x.bound,visible:[tool.definition],registry:createToolRegistry([tool]),policy});
 await ledger.execute(call(),randomUUID(),toolRef);const r=ledger.get(toolRef);assert.equal(check(r,x.bound,ctx).status,'satisfied');
 const clock=Date.now;Date.now=()=>clock()+31000;
 try{assert.ok(Date.parse(ctx.deadlineAt)>Date.now());assert.equal(check(r,x.bound,ctx).status,'invalid');}finally{Date.now=clock;}
});
