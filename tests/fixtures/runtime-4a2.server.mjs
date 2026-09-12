import { build } from 'esbuild';
import { compiled,manifest,source,evidence } from './runtime-4a.mjs';
const {activityExecutions,boundActivityResponse}=await import('../../src/features/smart-textbook-runtime/server/activity-binding.server.ts');
import { submitSmartTextbookActivityForContext } from '../../src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-submission.ts';

export async function serverModule(path,overrides={}){
  const bundle=await build({entryPoints:[path],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'server-marker',setup(b){b.onResolve({filter:/.*/},args=>args.path in overrides?{path:args.path,namespace:'override'}:undefined);b.onLoad({filter:/.*/,namespace:'override'},args=>({contents:overrides[args.path]}));b.onResolve({filter:/^server-only$/},()=>({path:'marker',namespace:'marker'}));b.onLoad({filter:/.*/,namespace:'marker'},()=>({contents:'export {};'}));}}]});
  return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
}
export const executions=manifest.blocks.filter(b=>b.type==='compat.learning.v1').flatMap(b=>activityExecutions(manifest,compiled.bindings,b.props.capsuleRef,'zh-CN'));
/** Frozen published metadata + deliberately synthetic answer keys. No real answers
 * are fetched. Only the DB transport is replaced; the existing grader runs. */
export async function gradeComposite(ref,input){
  const a=executions.find(a=>a.ref===ref),row=source.activities.find(a=>a.id===ref);
  if(!a||!row||a.kind==='unavailable')throw Error('Unavailable activity');
  const response=boundActivityResponse(a,input,compiled.bindings);
  const answer_key=a.kind==='writing'||a.kind==='self-check'?{kind:'open'}:a.kind==='single'?{kind:'index',value:0}:a.kind==='choice-group'?{kind:'index_array',value:a.items.map(()=>0)}:a.kind==='fill-group'?{kind:'text_array',value:a.items.map(()=>'학습')}:{kind:a.kind==='ordering'?'order':'indices',value:a.options.map((_,i)=>i)};
  const tables={digital_textbook_activities:row,digital_textbook_activity_secrets:{answer_key,explanation:{'zh-CN':'服务器预览反馈'}},digital_textbook_nodes:{id:row.node_id}};
  const admin={from(table){if(!(table in tables))throw Error('Unexpected table or mutation');return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:tables[table],error:null};}};}};
  return submitSmartTextbookActivityForContext({activityId:ref,response,locale:'zh-CN'},{admin,supabase:admin,userId:'test-owner',tenantId:null,canSubmit:true,preview:true});
}
export function teacherSession(){
  const tables={learning_agent_script_audio_assets:evidence.speech,learning_agent_script_nodes:source.teachingNodes,learning_agent_script_versions:source.teachingVersions};
  const admin={from(table){if(!(table in tables))throw Error('Unexpected table or mutation');let rows=tables[table];return {select(){return this;},eq(k,v){rows=rows.filter(r=>r[k]===v);return this;},async maybeSingle(){return {data:rows[0]??null,error:null};},then(resolve){resolve({data:rows,error:null});}};}};
  return {ownerId:'test-owner',expiresAt:Date.now()+60000,data:{admin,source,result:compiled},generation:0,revokedThrough:-1,busy:false,state:{scriptVersionId:manifest.teachingRefs[0].revision,currentNodeKey:null,teachingState:{},completedTaskEvents:[]}};
}
/** Executes the original server action, substituting only trusted auth + SELECT
 * transport. All write/RPC methods are absent and fail the test if reached. */
export async function existingPageChecker({preview=true}={}){
  const overrides={
    'server-only':'export {};',
    '@/lib/auth':'export async function requireActiveUser(){return globalThis.__runtimePageContext;}',
    '@/lib/admin':'export function isPlatformCourseAuditorRole(role){return role === "platform_owner";}',
    '@/lib/supabase/admin':'export function createAdminClient(){return globalThis.__runtimePageContext.supabase;}',
    '@/lib/student-permissions':'export function canUseStudentFeature(){return true;} export function normalizeMembershipTier(){return "test-membership";}',
    '@/features/student-home-learning/api/refresh':'export async function refreshStudentHomeLearningData(){throw Error("Unexpected mutation refresh");}',
  };
  const bundle=await build({entryPoints:['src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-actions.ts'],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'page-domain-transports',setup(b){b.onResolve({filter:/.*/},args=>args.path in overrides?{path:args.path,namespace:'test-transport'}:undefined);b.onLoad({filter:/.*/,namespace:'test-transport'},args=>({contents:overrides[args.path]}));}}]});
  const {checkSmartTextbookActivityPageAction}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  return async input=>{
    const activity=source.activities.find(a=>a.id===input.activityId);if(!activity)throw Error('Unknown activity');
    const text=activity.activity_type==='fill_blank',config=activity.public_config;
    // Deliberately synthetic keys for transport tests, never production answers.
    const values=config.composition?config.composition.steps.map(s=>s.tokens.join(' ').replace(/\s+([?.!,])/g,'$1')):config.conversation?config.conversation.steps.filter(s=>s.kind==='choice').map(()=>0):config.items.map(()=>text?'학습':0);
    const tables={digital_textbook_activities:activity,digital_textbook_activity_secrets:{answer_key:{kind:text||config.composition?'text_array':'index_array',value:values}}};
    const db={from(table){if(!(table in tables))throw Error('Unexpected table/mutation');return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:tables[table],error:null};}};}};
    globalThis.__runtimePageContext={supabase:db,user:{id:'test-owner'},tenant:preview?null:{id:'test-tenant'},profile:null,platformProfile:{role:preview?'platform_owner':'student'}};
    try{return await checkSmartTextbookActivityPageAction(input);}finally{delete globalThis.__runtimePageContext;}
  };
}
