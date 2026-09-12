import 'server-only';
import {requireActiveUser} from '../../../lib/auth';
import {canUseStudentFeature,normalizeMembershipTier} from '../../../lib/student-permissions';
import {createLearningHistoryReader,type HistoryAuthority} from './learning-history.server';
import {createLearningFlow,createLearningPracticeStore,type FlowAuthority} from './learning-flow.server';
import {activityExecutions} from './activity-binding.server';
import {activityPages} from './activity-pages.server';
import {patternExecutions} from './pattern-binding.server';
import {repeatLesson,readGuidedRepeatHistory,saveBoundGuidedRepeat} from './guided-repeat.server';
import {learningTools,openLearningDestination} from './learning-tools.server';
import {checkSmartTextbookActivityPageAction,saveGuidedRepeatProgressAction} from '../../../app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-actions';
import {submitSmartTextbookActivityForContext} from '../../../app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-submission';
import {isKoreanChapterLearningCompleted} from '../../../lib/korean-learning-unlocks';
import type {RuntimeServices} from '../core/services';
import type {ActivityResponse} from '../core/activity';
import {GET as existingAudio} from '../../../app/api/digital-textbook/audio/[activityId]/route';
import {GET as existingTranscript} from '../../../app/api/digital-textbook/transcript/[activityId]/route';
import {z} from 'zod';
import {patternAudioBytes} from './pattern-media.server';

/** Server-owned resolver must validate the immutable Runtime session against
 * the current published source on every call. No production route installs it.
 * Both normal auth and resolver binding must agree; callbacks aren't client data. */
export function productionLearningPorts(resolveSession:(userId:string,tenantId:string)=>Promise<HistoryAuthority&{admin:HistoryAuthority['db'];expiresAt:number;request:Request}>,expected:{sessionId:string;snapshotId:string}){
  async function authorize(){
    const {supabase,user,tenant,profile}=await requireActiveUser();
    if(!tenant||!canUseStudentFeature(profile?.role??'student',normalizeMembershipTier(profile?.membership_tier),'korean_course'))throw Error('LEARNING_FORBIDDEN');
    const a=await resolveSession(user.id,tenant.id);
    if(a.scope.actorId!==user.id||a.scope.tenantId!==tenant.id||a.sessionId!==expected.sessionId||a.snapshotId!==expected.snapshotId||a.expiresAt<=Date.now())throw Error('LEARNING_SESSION_SCOPE');
    // Current RLS visibility/version check, not merely a supplied row projection.
    const {data,error}=await supabase.from('digital_textbook_chapters').select('id,version_id').eq('id',a.manifest.chapter.id).eq('version_id',a.manifest.version.id).maybeSingle();
    if(error||!data)throw Error('LEARNING_CHAPTER_FORBIDDEN');
    return a;
  }
  const reader=createLearningHistoryReader(authorize,expected),store=createLearningPracticeStore();
  const flow=createLearningFlow(async():Promise<FlowAuthority>=>{
    const a=await authorize();return {...a,ownerId:a.scope.actorId,sessionScope:a.sessionId,preview:false,
      check:checkSmartTextbookActivityPageAction,
      history:async c=>{const result=await reader(new AbortController().signal);const restored=result.capsules.find(x=>x.capsuleRef===c);if(!restored)throw Error('HISTORY_CAPSULE');return restored;},
      submit:async(activityId,response)=>{const binding=a.bindings.activities.find(x=>x.activityId===activityId&&x.versionId===a.manifest.version.id);const capsule=a.bindings.capsules.find(c=>c.kind==='learning'&&c.activities.some(x=>x.activityId===activityId));const item=capsule?.kind==='learning'?capsule.activities.find(x=>x.activityId===activityId):null;if(!binding||!item||item.activityKey==='speaking-introduction'||item.activityKey==='dialogue-roleplay')throw Error('USE_RECORDING_DOMAIN');return submitSmartTextbookActivityForContext({activityId,response,locale:a.locale},{admin:a.admin,supabase:a.db,userId:a.scope.actorId,tenantId:a.scope.tenantId,canSubmit:true,preview:false});},
    };
  },store);
  const refs=new Map<string,string>();
  async function listening(capsuleRef:string,pageId:string,kind:'audio'|'transcript',signal:AbortSignal){
    const a=await authorize(),page=activityPages(a.bindings,a.services,capsuleRef,a.locale).find(p=>p.pageId===pageId&&p.listening);
    const binding=a.services.listeningAliases.find(b=>b.activityId===page?.activityRef&&a.services.activityPages.some(p=>p.pageId===pageId&&p.activityId===b.activityId&&p.legacyPage===b.legacyPage));
    const media=a.manifest.mediaRefs.find(m=>m.id===binding?.mediaRef);
    if(!page||!binding||!media||media.readiness!=='ready'||media.revision!==binding.revision)throw Error('LISTENING_SCOPE');
    if(kind==='transcript'&&!(await flow.restore(capsuleRef)).pages.some(p=>p.pageId===pageId&&p.checked))throw Error('TRANSCRIPT_REQUIRES_CHECK');
    // Original RLS/publication checks and byte proxy remain the media authority.
    const url=new URL(a.request.url);url.search=`?page=${binding.legacyPage}`;
    const request=new Request(url,{headers:a.request.headers,signal});
    const response=await (kind==='audio'?existingAudio:existingTranscript)(request,{params:Promise.resolve({activityId:binding.activityId})});
    if(!response.ok)throw Error('LISTENING_UNAVAILABLE');return response;
  }
  const scoped=async<T>(signal:AbortSignal,fn:()=>Promise<T>)=>{signal.throwIfAborted();const result=await fn();signal.throwIfAborted();return result;};
  const ports:Pick<RuntimeServices,'submit'|'refresh'|'learningFlow'|'activities'|'pages'|'patterns'|'guidedRepeat'|'learningTools'>={
    submit:(ref,response,s)=>scoped(s,async()=>{
      const a=await authorize(),block=a.manifest.blocks.find(b=>b.type==='multiple_choice'&&b.props.activityRef===ref);
      const binding=a.bindings.activities.find(b=>b.ref===ref&&b.versionId===a.manifest.version.id),presentation=a.manifest.activityRefs.find(r=>r.id===ref);
      const index=presentation?.publicPresentation.options.findIndex(o=>o.id===response)??-1;
      if(!block||!binding||index<0)throw Error('NATIVE_ACTIVITY_SCOPE');
      return submitSmartTextbookActivityForContext({activityId:binding.activityId,response:index,locale:a.locale},{admin:a.admin,supabase:a.db,userId:a.scope.actorId,tenantId:a.scope.tenantId,canSubmit:true,preview:false});
    }),
    refresh:signal=>scoped(signal,async()=>(await reader(signal)).server),
    learningFlow:{restore:(c,s)=>scoped(s,()=>flow.restore(c)),revealPage:(c,p,s)=>scoped(s,()=>flow.revealPage(c,p)),finishPages:(c,a,s)=>scoped(s,()=>flow.finishPages(c,a)),finishPattern:(c,a,r,s)=>scoped(s,()=>flow.finishPattern(c,a,r))},
    activities:{load:(c,s)=>scoped(s,async()=>{const a=await authorize();const rows=activityExecutions(a.manifest,a.bindings,c,a.locale);rows.forEach(r=>refs.set(r.ref,c));return rows;}),submit:(id,r:ActivityResponse,s)=>scoped(s,async()=>{const c=refs.get(id);if(!c)throw Error('ACTIVITY_NOT_LOADED');return flow.submit(c,id,r);})},
    pages:{load:(c,s)=>scoped(s,async()=>{const a=await authorize();return activityPages(a.bindings,a.services,c,a.locale);}),check:(c,p,r,s)=>scoped(s,()=>flow.pageCheck(c,p,r)),audio:(c,p,s)=>scoped(s,async()=>(await listening(c,p,'audio',s)).blob()),transcript:(c,p,s)=>scoped(s,async()=>z.strictObject({transcript:z.string().min(1)}).parse(await (await listening(c,p,'transcript',s)).json()).transcript)},
    patterns:{load:(c,s)=>scoped(s,async()=>{const a=await authorize();return patternExecutions(a.manifest,a.bindings,c,a.locale);}),check:(c,id,r,s)=>scoped(s,()=>flow.patternCheck(c,id,r)),audio:(c,turn,s)=>scoped(s,async()=>{const a=await authorize();return patternAudioBytes(a.manifest,a.bindings,c,turn,s);})},
    guidedRepeat:{load:(c,s)=>scoped(s,async()=>{const a=await authorize(),lesson=repeatLesson(a.manifest,a.bindings,a.services,c,a.locale);return lesson?{lesson,state:await readGuidedRepeatHistory(a.db,a.services,a.scope,lesson)}:null;}),mark:(c,track,segment,s)=>scoped(s,async()=>{const a=await authorize(),lesson=repeatLesson(a.manifest,a.bindings,a.services,c,a.locale);if(!lesson)throw Error('REPEAT_SCOPE');await saveBoundGuidedRepeat(a.services,a.scope,lesson,track,segment,saveGuidedRepeatProgressAction);return readGuidedRepeatHistory(a.db,a.services,a.scope,lesson);})},
    learningTools:{load:(c,s)=>scoped(s,async()=>{const a=await authorize();return learningTools(a.manifest,a.bindings,a.services,c,a.nodes);}),open:(c,target,s)=>scoped(s,async()=>{
      const a=await authorize(),history=await reader(s),navigation=a.services.navigation[0];if(!navigation)throw Error('NAVIGATION_SCOPE');
      const {data,error}=await a.db.from('course_ebook_progress').select('progress_percent,reading_seconds,completion_source').eq('tenant_id',a.scope.tenantId).eq('student_id',a.scope.actorId).eq('test_slug',navigation.slug).eq('student_app_id',a.manifest.textbook.appId).maybeSingle();
      if(error)throw Error('NAVIGATION_HISTORY_UNAVAILABLE');
      return openLearningDestination(a.manifest,a.bindings,a.services,a.scope,c,target,history.server,!!data&&isKoreanChapterLearningCompleted({progressPercent:data.progress_percent,readingSeconds:data.reading_seconds,completionSource:data.completion_source}),a.nodes);
    })},
  };
  return ports;
}
