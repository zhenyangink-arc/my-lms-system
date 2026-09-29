import '../smart-textbook-legacy-adapter/register-server-only.mjs';
import {randomUUID} from 'node:crypto';
import {fixture} from '../teaching-agent-r7d/readonly-fixture.mjs';
export {randomUUID};
export const root='../../../src/features/teaching-agent/';
const {createStudentAiTeacherProfile}=await import(root+'profiles/student-ai-teacher.ts');
export const {executionSummarySkillRef:skillRef,executionSummarySkillDefinition:skill}=await import(root+'skills/summarize-current-lesson-execution/definition.ts');
export const {lessonFactsToolRef:toolRef}=await import(root+'server/tools/contracts.ts');
export const {createLessonExecutionSkillCapabilities:compose}=await import(root+'server/composition/create-lesson-execution-skill-capabilities.ts');
export const call=(args={})=>({id:randomUUID(),name:toolRef.name,arguments:JSON.stringify(args)});
export async function setup(change=()=>{}) {
 const f=await fixture();
 // Synthetic in-memory fixture only; no Auth user, student admission or DB exists.
 f.context.authority.actorId=f.grant.domain.actorId;f.context.authority.membershipRole='student';
 const profile=createStudentAiTeacherProfile();profile.allowedSkillRefs=[skillRef];profile.allowedToolRefs=[toolRef];
 const input={isolation:'isolated-test-db',intent:'summarize_execution',profile,issuer:f.issuer,handle:f.handle,grant:f.grant,context:f.context,policy:f.policy};
 await change(input,f);
 const cap=await compose(input);
 return {f,input,cap,submit:()=>cap.executeTool(call(),randomUUID())};
}
export async function ledgerFixture(){
 const x=await setup(),{createStudentToolEvidenceLedger}=await import(root+'server/composition/create-student-ai-teacher-capabilities.ts');
 const bound={content:structuredClone(x.f.grant.content),storage:'isolated-test-db',snapshot:structuredClone(x.f.grant),runStartedAt:Date.now()};
 const ledger=createStudentToolEvidenceLedger({context:x.f.context,skill:skillRef,binding:bound,visible:[x.f.tool.definition],registry:x.f.registry,policy:x.f.policy});
 await ledger.execute(call(),randomUUID(),toolRef);
 return {...x,bound,ledger,receipt:ledger.get(toolRef)};
}
// Every HTTP attempt is fatal; fixtures contain no network transport or credentials.
globalThis.fetch=async()=>{throw Error('C2_NETWORK_FORBIDDEN');};
