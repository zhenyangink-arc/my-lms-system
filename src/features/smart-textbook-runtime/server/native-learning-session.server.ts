import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireActiveUser } from '../../../lib/auth';
import { createAdminClient } from '../../../lib/supabase/admin';
import { authorizePublishedCourse } from '../../../lib/smart-textbook-publishing/loader.server.ts';
import { publicationRepository } from '../../../lib/smart-textbook-publishing/repository.server.ts';
import { assertPublishedDomainDependencies } from '../../../lib/smart-textbook-publishing/domain-guard.server.ts';
import { requireNativeVideoPublication, scopeSchema, type PublicationScope } from '../../../lib/smart-textbook-publishing/artifact.server.ts';
import { canonical, digest } from '../../../lib/smart-textbook-legacy-adapter/identity.server.ts';
import { executionBinding } from '../core/execution-contracts.ts';
import { freezeNativePublishedCueBindings } from '../core/native-published-media-contracts.ts';
import type { NativeSessionBootstrap } from '../core/native-learning-session-transport.ts';
import { runtimeContextSchema } from '../../../lib/smart-textbook-runtime-v1/contracts.ts';

const locator=z.string().refine(v=>v.startsWith('learning-session-')&&z.uuid().safeParse(v.slice(17)).success);
const active=new WeakSet<object>();
const nativeRef=(kind:string,values:unknown)=>`native-${kind}-${digest(values)}`;
async function resolve(sessionRef:string){
 const auth=await requireActiveUser();if(!auth.tenant)throw Error('NATIVE_FORBIDDEN');
 const admin=createAdminClient(),saved=await publicationRepository(admin).session('resolve',auth.user.id,auth.tenant.id,{ref:sessionRef.slice(17)});
 if(!saved||saved.sessionRef!==sessionRef||saved.expiresAt<=Date.now())throw Error('NATIVE_SESSION_EXPIRED');
 const bundle=requireNativeVideoPublication(saved.bundle),authorized=await authorizePublishedCourse(bundle.scope);
 if(authorized.auth.user.id!==auth.user.id||authorized.tenantId!==auth.tenant.id)throw Error('NATIVE_FORBIDDEN');
 await assertPublishedDomainDependencies(admin,bundle);
 if(saved.expiresAt<=Date.now())throw Error('NATIVE_SESSION_EXPIRED');
 const context=runtimeContextSchema.parse({runtimeSessionId:sessionRef,snapshotId:bundle.snapshotId,sourceState:'published',trackingDisabled:false,locale:saved.locale,supportMode:'bilingual'});
 const binding=bundle.privatePayload.bindings[0],ids=[auth.user.id,auth.tenant.id],cue=bundle.manifest.execution!.cues[0];
 const refs={sessionRef:nativeRef('session',[sessionRef,...ids]),actorRef:nativeRef('actor',auth.user.id),tenantRef:nativeRef('tenant',auth.tenant.id),
  lessonRef:nativeRef('lesson',bundle.privatePayload.source.book.lesson_id),snapshotRef:nativeRef('snapshot',bundle.snapshotId),
  scopeRef:nativeRef('scope',[...ids,bundle.scope]),contentRef:nativeRef('content',[bundle.snapshotId,bundle.manifestDigest]),
  activityRef:nativeRef('activity',binding.activityId),executionNodeRef:nativeRef('node',binding.executionNodeId),
  sourceTeachingNodeRef:nativeRef('source',binding.sourceTeachingNodeId),versionRef:nativeRef('version',bundle.scope.versionId)};
 const nativeBindings=freezeNativePublishedCueBindings(bundle.manifest,context,[cue],[{execution:executionBinding(bundle.manifest,context,cue),activityRevision:binding.activityRevision,mediaRef:binding.mediaRef,completionPolicy:'correct-durable-readback/1',native:refs}]);
 return {auth,admin,actorId:auth.user.id,tenantId:auth.tenant.id,bundle,sessionRef,expiresAt:saved.expiresAt,context,nativeBindings};
}
export type NativeSessionAuthority=Awaited<ReturnType<typeof resolve>>&{readonly leaseId:string};
export function assertActiveNativeSessionAuthority(authority:NativeSessionAuthority){
 if(!active.has(authority)||authority.expiresAt<=Date.now())throw Error('NATIVE_AUTHORITY_INACTIVE');
}
/** The identity is private and scoped to a live request, never a JSON token. A
 * Response transfers cleanup ownership to its stream; cancellation waits for
 * the upstream reader to stop before releasing the database lease. */
export function withNativeLearningSession<T>(sessionRef:unknown,signal:AbortSignal,operation:(authority:NativeSessionAuthority)=>Promise<T>):Promise<T>;
export async function withNativeLearningSession<T>(sessionRef:unknown,signal:AbortSignal,operation:(authority:NativeSessionAuthority)=>Promise<T>):Promise<T|Response>{
 const ref=locator.parse(sessionRef);signal.throwIfAborted();const before=await resolve(ref),leaseId=randomUUID();
 const lease=async(op:'enter'|'leave')=>{
  const result=await before.admin.rpc('runtime_publication_request_v1',{p_operation:op,p_actor:before.actorId,p_tenant:before.tenantId,p_textbook:before.bundle.scope.textbookId,p_request:leaseId});
  if(result.error||!z.strictObject({ok:z.literal(true)}).safeParse(result.data).success)throw Error('NATIVE_LEASE_UNAVAILABLE');
 };
 await lease('enter');let authority:NativeSessionAuthority|undefined,transferred=false,released=false;
 const release=async()=>{if(released)return;released=true;if(authority)active.delete(authority);await lease('leave');};
 try{
  const after=await resolve(ref);
  if(after.actorId!==before.actorId||after.tenantId!==before.tenantId||after.bundle.seal!==before.bundle.seal||after.expiresAt!==before.expiresAt)throw Error('NATIVE_SESSION_CHANGED');
  signal.throwIfAborted();authority=Object.freeze({...after,leaseId});active.add(authority);
  const result=await operation(authority);
  if(signal.aborted){if(result instanceof Response&&result.body)await result.body.cancel(signal.reason);signal.throwIfAborted();}
  if(result instanceof Response&&result.body){
   const reader=result.body.getReader();let termination:Promise<void>|undefined;
   const finish=(cancelUpstream=false,reason?:unknown)=>{
    // Publish the shared barrier before cancel can resolve a pending read as
    // done. That pull must wait for real upstream cleanup, not release early.
    termination??=Promise.resolve().then(async()=>{
     try{if(cancelUpstream)await reader.cancel(reason);}
     finally{signal.removeEventListener('abort',onAbort);await release();}
    });
    return termination;
   };
   const cancel=(reason:unknown)=>finish(true,reason);
   const onAbort=()=>{void cancel(signal.reason).catch(()=>{});};
   const body=new ReadableStream<Uint8Array>({async pull(controller){
    try{signal.throwIfAborted();const next=await reader.read();if(next.done){await finish();controller.close();}else controller.enqueue(next.value);}
    catch(error){try{await cancel(error);}finally{controller.error(error);}}
   },cancel},{highWaterMark:0});
   signal.addEventListener('abort',onAbort,{once:true});
   const response=new Response(body,{status:result.status,statusText:result.statusText,headers:result.headers});
   transferred=true;return response;
  }
  return result;
 }finally{if(!transferred)await release();}
}
export async function issueNativeLearningSession(scope:PublicationScope):Promise<NativeSessionBootstrap>{
 const checked=scopeSchema.parse(scope),access=await authorizePublishedCourse(checked),repo=publicationRepository(access.admin);
 const current=await repo.current(checked),bundle=requireNativeVideoPublication(current.bundle);
 await assertPublishedDomainDependencies(access.admin,bundle);
 const preference=await access.auth.supabase.from('digital_textbook_preferences').select('interface_locale').eq('tenant_id',access.tenantId).eq('student_id',access.auth.user.id).eq('textbook_id',checked.textbookId).maybeSingle();
 if(preference.error)throw Error('NATIVE_PREFERENCE_UNAVAILABLE');
 const locale=z.enum(['zh-CN','ko-KR']).parse(preference.data?.interface_locale??'zh-CN');
 const saved=await repo.session('issue',access.auth.user.id,access.tenantId,{scope:checked,expected:current.pointer,locale});
 if(!saved||saved.locale!==locale||saved.expiresAt<=Date.now()||saved.bundle.seal!==bundle.seal||canonical(saved.bundle.scope)!==canonical(checked))throw Error('NATIVE_SESSION_MISMATCH');
 await assertPublishedDomainDependencies(access.admin,saved.bundle);
 const {bootstrapNativeLearningSession}=await import('./native-published-activity.server.ts');
 return bootstrapNativeLearningSession(saved.sessionRef,new AbortController().signal);
}
export async function revokeNativeLearningSession(sessionRef:unknown){
 const ref=locator.parse(sessionRef),saved=await resolve(ref);
 await publicationRepository(saved.admin).session('revoke',saved.actorId,saved.tenantId,{ref:ref.slice(17)});
 return {revoked:true as const};
}
