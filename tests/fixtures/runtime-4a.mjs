import './smart-textbook-legacy-adapter/register-server-only.mjs';
const {default:source}=await import('./smart-textbook-legacy-adapter/chapter-one-source.server.ts');
const {default:identities}=await import('./smart-textbook-legacy-adapter/chapter-one-identities.server.ts');
const {default:history}=await import('./smart-textbook-legacy-adapter/chapter-one-service-identities.server.ts');
const {default:evidence}=await import('./smart-textbook-legacy-adapter/chapter-one-service-evidence.server.ts');
const {finalizeChapterOneNonUiReadiness}=await import('../../src/lib/smart-textbook-legacy-adapter/final-readiness.server.ts');
const {projectLearningContent}=await import('../../src/lib/smart-textbook-legacy-adapter/runtime-content.server.ts');
export {source,evidence};
import { submitSmartTextbookActivityForContext } from '../../src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-submission.ts';
export const compiled=finalizeChapterOneNonUiReadiness(source,identities,history,evidence);
export const manifest=compiled.manifest;
export const content=Object.fromEntries(compiled.bindings.capsules.filter(c=>c.kind==='learning').map(c=>[c.id,projectLearningContent(compiled.bindings,c.id,'zh-CN')]));
export const context={runtimeSessionId:'audit-test',snapshotId:manifest.snapshot.id,sourceState:'published',trackingDisabled:true,locale:'zh-CN',supportMode:'bilingual'};
export const state={snapshotId:manifest.snapshot.id,revision:compiled.report.sourceRevision,completedStepIds:[],attempts:[],activityProgress:[],pageProgress:[],guidedRepeat:[],speakingEvidence:[]};
export function flatten(cards){return cards.flatMap(c=>[c,...flatten(c.children)]);}
/** DB transport substitute ONLY. The real server grader is executed. Synthetic
 * secret is never public test data and is not claimed to be the production key. */
export async function gradePreview(activityRef,response){
  const a=manifest.activityRefs.find(a=>a.id===activityRef),raw=source.activities.find(x=>x.id===a?.activityId);
  if(!a||!raw)throw Error('Unknown activity');
  const option=a.publicPresentation.options.findIndex(o=>o.id===response);
  if(option<0)throw Error('Unknown response');
  const admin={from(table){
    const rows={digital_textbook_activities:raw,digital_textbook_activity_secrets:{answer_key:{kind:'index',value:0},explanation:{'zh-CN':'服务器预览反馈'}},digital_textbook_nodes:{id:raw.node_id}};
    if(!(table in rows))throw Error(`Unexpected table / mutation: ${table}`);
    return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:rows[table],error:null};}};
  }};
  return submitSmartTextbookActivityForContext({activityId:a.activityId,response:option,locale:'zh-CN'},{admin,supabase:admin,userId:'test-owner',tenantId:null,canSubmit:true,preview:true});
}
