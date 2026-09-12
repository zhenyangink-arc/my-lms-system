import {compiled,manifest,source,context,state} from './runtime-4a.mjs';
import {existingPageChecker} from './runtime-4a2.server.mjs';
const {createLearningFlow,createLearningPracticeStore}=await import('../../src/features/smart-textbook-runtime/server/learning-flow.server.ts');
import {submitSmartTextbookActivityForContext} from '../../src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-submission.ts';
export {compiled,manifest,source,context,state};
export const scope={authorized:true,actorId:'test-owner',tenantId:'test-tenant',versionId:manifest.version.id,sourceRevision:compiled.services.sourceRevision};
export const capsules=compiled.bindings.capsules.filter(c=>c.kind==='learning');
export const capsule=key=>capsules.find(c=>c.stepId===manifest.steps.find(s=>s.key===key).id);
export async function gradeRaw(id,response){
  const row=source.activities.find(x=>x.id===id),config=row.public_config;
  const value=config.composition?config.composition.steps.map(s=>s.tokens.join(' ').replace(/\s+([?.!,])/g,'$1')):config.conversation?config.conversation.steps.filter(s=>s.kind==='choice').map(()=>0):config.items?.map(()=>row.activity_type==='fill_blank'?'학습':0);
  const answer_key=['writing','self_check'].includes(row.activity_type)?{kind:'open'}:value?{kind:row.activity_type==='fill_blank'?'text_array':'index_array',value}:row.activity_type==='ordering'?{kind:'order',value:row.options.map((_,n)=>n)}:row.activity_type==='multiple_choice'?{kind:'indices',value:row.options.map((_,n)=>n)}:{kind:'index',value:0};
  const tables={digital_textbook_activities:row,digital_textbook_activity_secrets:{answer_key,explanation:{'zh-CN':'服务器检查反馈'},...(row.activity_type==='listening'?{audio_object_key:'isolated-test-only',audio_status:'ready'}:{})},digital_textbook_nodes:{id:row.node_id}};
  const db={from(table){if(!(table in tables))throw Error('Unexpected mutation/table');return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:tables[table],error:null};}};}};
  return submitSmartTextbookActivityForContext({activityId:id,response,locale:'zh-CN'},{admin:db,supabase:db,userId:'test-owner',tenantId:null,canSubmit:true,preview:true});
}
export async function flowFixture(){
  const check=await existingPageChecker(),store=createLearningPracticeStore();
  const authority={ownerId:'test-owner',sessionScope:'test-audit',expiresAt:Date.now()+600000,manifest,bindings:compiled.bindings,services:compiled.services,scope,locale:'zh-CN',preview:true,check,submit:gradeRaw};
  return {authority,store,flow:createLearningFlow(async()=>authority,store)};
}
