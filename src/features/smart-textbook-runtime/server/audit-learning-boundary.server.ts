import 'server-only';
import {AsyncLocalStorage} from 'node:async_hooks';
import {z} from 'zod';
import {requirePlatformOwner} from '../../../lib/admin';
import {auditSession} from './audit-session.server';
import {createLearningBoundary} from './learning-boundary.server';
import {auditLearning,auditActivities,auditPages,auditPatterns} from './audit-actions';
import {auditFlow} from './audit-flow-actions';
import {auditLearningFlow} from './audit-flow.server';
import {auditRepeatLoad,auditRepeatMark} from './audit-repeat-actions';
import {auditLearningTools} from './audit-tool-actions';
import {auditRecording} from './audit-recording.server';
import {GET as listening} from '../../../app/api/smart-textbook-runtime-audit/listening/route';
import {patternAudioBytes} from './pattern-media.server';
import {sceneImageBytes} from './scene-image.server';
import {readSceneImage} from './scene-image-storage.server';
import type {RecordingRuntimeServices} from '../core/recording';

const requests=new AsyncLocalStorage<Request>();
const sessionSchema=z.strictObject({sessionRef:z.string().regex(/^learning-session-[0-9a-f-]{36}$/)});
const resolver={async resolve(input:unknown){
  const {sessionRef}=sessionSchema.parse(input),{user,supabase}=await requirePlatformOwner();
  const s=auditSession(user.id,sessionRef.slice('learning-session-'.length)),r=s.data.result;
  return {sessionId:sessionRef,snapshotId:r.manifest.snapshot.id,expiresAt:s.expiresAt,locale:s.learningLocale,
    db:supabase,admin:s.data.admin,manifest:r.manifest,bindings:r.bindings,services:r.services,nodes:s.data.source.nodes,
    scope:{authorized:true as const,actorId:user.id,tenantId:`owner-audit:${user.id}`,versionId:r.manifest.version.id,sourceRevision:r.report.sourceRevision}};
}};
const boundary=createLearningBoundary(resolver,async a=>{
  const sessionId=a.sessionId.slice('learning-session-'.length),base={sessionId,snapshotId:a.snapshotId};
  const local=(capsuleRef:string)=>({...base,capsuleRef,locale:a.locale});
  const flow=(capsuleRef:string,request:object)=>auditFlow({...base,capsuleRef,...request});
  const record=async<T>(input:object,signal:AbortSignal,blob?:Blob)=>await auditRecording({...base,...input},signal,blob) as T;
  const recording:RecordingRuntimeServices={load:(c,s)=>record({op:'load',capsuleRef:c},s),restore:(c,activityRef,s)=>record({op:'restore',capsuleRef:c,activityRef},s),
    upload:(scope,blob,durationSeconds,s)=>record({op:'upload',scope,durationSeconds},s,blob),audio:(scope,recordingId,s)=>record({op:'audio',scope,recordingId},s),
    remove:async(scope,recordingId,s)=>{await record({op:'remove',scope,recordingId},s);},complete:(input,s)=>record({op:'complete',input},s)};
  const refs=new Map<string,string>();
  async function media(capsuleRef:string,pageId:string,kind:'audio'|'transcript',signal:AbortSignal){
    const request=requests.getStore();if(!request)throw Error('AUDIT_REQUEST_CONTEXT');const url=new URL(request.url);
    url.search=new URLSearchParams({sessionId,capsuleRef,pageId,kind}).toString();
    const response=await listening(new Request(url,{headers:request.headers,signal}));if(!response.ok)throw Error('AUDIT_MEDIA_UNAVAILABLE');return response;
  }
  return {recording,sceneImage:(c:string,s:AbortSignal)=>sceneImageBytes(a.manifest,a.bindings,auditSession(a.scope.actorId,sessionId).data.source,c,s,readSceneImage),learning:(c:string)=>auditLearning(local(c)),submit:(activityRef:string,response:string)=>{
    const block=a.manifest.blocks.find(b=>b.type==='multiple_choice'&&b.props.activityRef===activityRef);
    const capsule=a.bindings.capsules.find(c=>c.kind==='learning'&&c.stepId===block?.stepId);
    if(!capsule)throw Error('NATIVE_ACTIVITY_SCOPE');
    // Same original grader, plus the existing TTL audit practice store. This is
    // restored UI feedback, never a fabricated attempt or formal completion.
    return auditLearningFlow(a.scope.actorId,sessionId).submitNative(capsule.id,activityRef,response);
  },
    // Owner audit has NO learner completion authority, regardless of preview results.
    refresh:async()=>({snapshotId:a.snapshotId,revision:a.scope.sourceRevision,completedStepIds:[],attempts:[],activityProgress:[],pageProgress:[],guidedRepeat:[],speakingEvidence:[]}),
    activities:{load:async(c:string)=>{const rows=await auditActivities(local(c));rows.forEach(r=>refs.set(r.ref,c));return rows;},submit:async(ref:string,response:import('../core/activity').ActivityResponse)=>{const c=refs.get(ref);if(!c)throw Error('ACTIVITY_NOT_LOADED');return flow(c,{operation:'submit',activityRef:ref,response}) as Promise<import('../core/services').ActivityResult>;}},
    pages:{load:(c:string)=>auditPages(local(c)),check:(c:string,pageId:string,response:import('../core/activity-pages').PageResponse)=>flow(c,{operation:'page-check',pageId,response}) as Promise<import('../core/activity-pages').PageCheck>,audio:async(c:string,p:string,s:AbortSignal)=>(await media(c,p,'audio',s)).blob(),transcript:async(c:string,p:string,s:AbortSignal)=>z.strictObject({transcript:z.string()}).parse(await (await media(c,p,'transcript',s)).json()).transcript},
    patterns:{load:(c:string)=>auditPatterns(local(c)),check:(c:string,activityRef:string,response:import('../core/patterns').PatternResponse)=>flow(c,{operation:'pattern-check',activityRef,response}) as Promise<import('../core/patterns').PatternCheck>,audio:(c:string,turn:string,s:AbortSignal)=>patternAudioBytes(a.manifest,a.bindings,c,turn,s)},
    guidedRepeat:{load:(c:string)=>auditRepeatLoad({...base,capsuleRef:c}),mark:(c:string,trackId:string,segmentId:string)=>auditRepeatMark({...base,capsuleRef:c,trackId,segmentId})},
    learningTools:{load:(c:string)=>auditLearningTools({...base,capsuleRef:c}) as Promise<import('../core/learning-tools').LearningTools>,open:(c:string,target:string)=>auditLearningTools({...base,capsuleRef:c,target}) as ReturnType<import('../core/learning-tools').LearningToolServices['open']>},
    learningFlow:{restore:(c:string)=>flow(c,{operation:'restore'}) as Promise<import('../core/learning-flow').LearningRestore>,revealPage:(c:string,pageId:string)=>flow(c,{operation:'reveal',pageId}) as ReturnType<import('../core/learning-flow').LearningFlowServices['revealPage']>,finishPages:(c:string,activityRef:string)=>flow(c,{operation:'finish-pages',activityRef}) as Promise<import('../core/services').ActivityResult>,finishPattern:(c:string,activityRef:string,responses:import('../core/patterns').PatternResponse[])=>flow(c,{operation:'finish-pattern',activityRef,responses}) as Promise<import('../core/services').ActivityResult>},
  };
});
export async function auditLearningBoundary(request:Request,input:unknown,blob?:Blob){
  await requirePlatformOwner();
  return requests.run(request,async()=>{
    const header=z.object({operation:z.enum(['catalog','resume','enter','dispatch'])}).parse(input);
    if(header.operation==='catalog'||header.operation==='resume'){const r=z.strictObject({operation:z.enum(['catalog','resume']),sessionRef:z.string()}).parse(input);return r.operation==='catalog'?boundary.catalog({sessionRef:r.sessionRef}):boundary.resume({sessionRef:r.sessionRef});}
    const r=z.strictObject({operation:z.enum(['enter','dispatch']),payload:z.unknown()}).parse(input);
    return r.operation==='enter'?boundary.enter(r.payload):boundary.dispatch(r.payload,request.signal,blob);
  });
}
