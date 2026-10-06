import 'server-only';
import {AsyncLocalStorage} from 'node:async_hooks';
import {z} from 'zod';
import {createProductionLearningBoundary} from './production-learning-boundary.server';
import {createRuntimeLearningSessionResolver} from './learning-session.server';
import {createTeacherRuntimeBoundary} from './teacher-boundary.server';
import {productionTeacherBackend} from './production-teacher-backend.server';
import {proxyAuthorizedSpeech,proxyAuthorizedCharacter} from './audit-speech.server';
import {GET as speech} from '../../../app/api/learning-agent/speech/[assetId]/route';
import {GET as character} from '../../../app/api/learning-agent/characters/[pose]/route';
import {assertRuntimeDependencies,runtimeAdmissionPolicy} from './application-admission.server';
import {authorizeRuntimeApplication} from './application-access.server';
import {validateRuntimeActivation} from '../core/block-registry';
import {withChapterOneRuntimeRequest} from '../../../lib/smart-textbook-publishing/authoring.server';
import {changeRuntimeLanguage} from './runtime-language.server';
import {saveSmartTextbookPreferenceAction} from '../../../app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-actions';

const requests=new AsyncLocalStorage<{request:Request;dependency?:ReturnType<typeof assertRuntimeDependencies>}>();
function request(){const r=requests.getStore();if(!r)throw Error('RUNTIME_REQUEST_CONTEXT');return r.request;}
function dependencies(){const r=requests.getStore();if(!r)throw Error('RUNTIME_REQUEST_CONTEXT');return r.dependency??=assertRuntimeDependencies();}
// Coalesce duplicate checks WITHIN one HTTP request only, never across requests,
// sessions, or replicas. Domain leases still independently recheck each write.
const learning=createProductionLearningBoundary(async()=>request(),dependencies);
const resolver=createRuntimeLearningSessionResolver();
const teacher=createTeacherRuntimeBoundary({
 authorize:async()=>{const a=await authorizeRuntimeApplication();return {actorId:a.auth.user.id,tenantId:a.tenantId,role:'learner'};},
 resolveScope:learning.teacher.resolveScope,
 createBackend:productionTeacherBackend({request,scope:learning.teacher.domainScope}),
 readSpeech:async({assetId,signal})=>{
  const r=new Request(request().url,{headers:request().headers,signal:AbortSignal.any([signal,request().signal])});
  return (await proxyAuthorizedSpeech(r,()=>speech(r,{params:Promise.resolve({assetId})}),`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`)).blob();
 },
 readCharacter:async(pose,signal)=>{
  const r=new Request(request().url,{headers:request().headers,signal:AbortSignal.any([signal,request().signal])});
  return (await proxyAuthorizedCharacter(r,()=>character(r,{params:Promise.resolve({pose})}),`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`)).blob();
 },
});
const ref=z.string().regex(/^learning-session-[0-9a-f-]{36}$/);
const learningRequest=z.discriminatedUnion('operation',[
 z.strictObject({operation:z.literal('language'),sessionRef:ref,locale:z.enum(['zh-CN','ko-KR'])}),
 z.strictObject({operation:z.literal('bootstrap'),sessionRef:ref.optional()}),
 z.strictObject({operation:z.enum(['catalog','resume']),sessionRef:ref}),
 z.strictObject({operation:z.enum(['enter','dispatch']),payload:z.unknown()}),
]);
async function bootstrapStage<T>(stage:string,task:()=>Promise<T>):Promise<T>{
 try{return await task();}
 catch(error){console.error(`[UPLY_RUNTIME_BOOTSTRAP_REJECTED] ${stage}`);throw error;}
}

/** Real app transport composition. No audit Route, compiler, Preview store or
 * fixture. Existing sessions remain pinned when NEW admission is stopped. */
export async function applicationRuntimeRequest(req:Request,kind:'learning'|'teacher',input:unknown,upload?:Blob){
 return withChapterOneRuntimeRequest(()=>requests.run({request:req},async()=>{
  // An installed dependency outage never falls through to legacy/preview writes.
  await bootstrapStage('dependencies',dependencies);
  if(kind==='teacher'){if(upload)throw Error('UNEXPECTED_BYTES');return teacher.dispatch(input);}
  const r=learningRequest.parse(input);
  if(upload&&(r.operation!=='dispatch'))throw Error('UNEXPECTED_BYTES');
  if(r.operation==='language')return changeRuntimeLanguage({sessionRef:r.sessionRef,locale:r.locale},{resolve:input=>resolver.resolve(input),admit:runtimeAdmissionPolicy,save:saveSmartTextbookPreferenceAction,revoke:input=>learning.revoke(input)});
  if(r.operation==='bootstrap'){
   let sessionRef=r.sessionRef;
   if(!sessionRef){
    const policy=await bootstrapStage('policy-before',runtimeAdmissionPolicy);if(!policy.eligible)throw Error('RUNTIME_ADMISSION_CLOSED');
    sessionRef=(await bootstrapStage('session-issue',()=>learning.issue())).sessionRef;
    const after=await bootstrapStage('policy-after',runtimeAdmissionPolicy);
    if(!after.eligible||after.revision!==policy.revision){await learning.revoke({sessionRef});throw Error('RUNTIME_ADMISSION_CHANGED');}
   }
   // Never substitute current pointer for the durable session's snapshot.
   const a=await bootstrapStage('session-resolve',()=>resolver.resolve({sessionRef}));
   if(!validateRuntimeActivation(a.manifest).success)throw Error('RUNTIME_CAPABILITY');
   const continuation=await bootstrapStage('session-resume',()=>learning.resume({sessionRef})),catalog=await bootstrapStage('service-catalog',()=>learning.catalog({sessionRef}));
   const block=a.manifest.blocks.find(b=>b.type==='compat.learning.v1'&&b.stepId===continuation.activeStepId);
   if(!block)throw Error('RUNTIME_ACTIVE_STEP');
   const state=await bootstrapStage('initial-refresh',()=>learning.dispatch({sessionRef,generation:continuation.generation,target:block.runtimeTarget,request:{op:'refresh'}},req.signal));
   return {manifest:a.manifest,sessionRef,catalog,continuation,state,
    context:{runtimeSessionId:sessionRef,snapshotId:a.snapshotId,sourceState:'published',trackingDisabled:false,locale:a.locale,supportMode:'bilingual'}};
  }
  if(r.operation==='catalog')return learning.catalog({sessionRef:r.sessionRef});
  if(r.operation==='resume')return learning.resume({sessionRef:r.sessionRef});
  if(r.operation==='enter'||r.operation==='dispatch')return r.operation==='enter'?learning.enter(r.payload):learning.dispatch(r.payload,req.signal,upload);
  throw Error('RUNTIME_OPERATION');
 }));
}
