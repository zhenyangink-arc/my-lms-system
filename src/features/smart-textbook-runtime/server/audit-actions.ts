'use server';
import { requirePlatformOwner } from '../../../lib/admin';
import { projectLearningContent } from '../../../lib/smart-textbook-legacy-adapter/runtime-content.server';
import { submitSmartTextbookActivityForContext } from '../../../app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-submission';
import { auditSession } from './audit-session.server';
import { auditTeacherTurn } from './audit-teacher.server';
import { learningRequest,submitRequest,turnRequest,cancelRequest,ttsIssueRequest,ttsObserveRequest,activitySubmitRequest,pageCheckRequest,patternCheckRequest } from './audit-requests.server';
import { auditTtsOwner,auditTtsService,observeAuditTts } from './audit-tts.server';
import { activityExecutions,boundActivityResponse } from './activity-binding.server';
import { activityPages,checkBoundPage } from './activity-pages.server';
import { patternExecutions,checkBoundPattern } from './pattern-binding.server';
import { checkSmartTextbookActivityPageAction } from '../../../app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-actions';

export async function auditLearning(input:unknown){
  const {user}=await requirePlatformOwner();
  const request=learningRequest.parse(input);
  const session=auditSession(user.id,request.sessionId);
  return projectLearningContent(session.data.result.bindings,request.capsuleRef,request.locale);
}
export async function auditSubmit(input:unknown){
  const {user}=await requirePlatformOwner();
  const request=submitRequest.parse(input);
  const session=auditSession(user.id,request.sessionId),manifest=session.data.result.manifest!;
  const activity=manifest.activityRefs.find(a=>a.id===request.activityRef);
  const block=manifest.blocks.find(b=>b.type==='multiple_choice'&&b.props.activityRef===request.activityRef);
  const binding=session.data.result.bindings.activities.find(b=>b.ref===request.activityRef);
  if(!activity||!binding||!block||activity.type!=='single_choice'||binding.versionId!==manifest.version.id)throw Error('ACTIVITY_BINDING_MISMATCH');
  const index=activity.publicPresentation.options.findIndex(o=>o.id===request.response);
  if(index<0)throw Error('INVALID_RESPONSE');
  // Server has already authorized fixed chapter access; preview is not accepted from client.
  // Existing grader returns preview attempt feedback BEFORE every DB write branch.
  return submitSmartTextbookActivityForContext({activityId:binding.activityId,response:index,locale:session.learningLocale},{
    supabase:session.data.admin,admin:session.data.admin,userId:user.id,tenantId:null,canSubmit:true,preview:true,
  });
}
export async function auditTurn(input:unknown){
  const {user}=await requirePlatformOwner();
  const request=turnRequest.parse(input);
  const session=auditSession(user.id,request.sessionId);
  if(session.busy||request.generation<=session.revokedThrough||request.generation<session.generation)throw Error('STALE_GENERATION');
  session.generation=request.generation;session.busy=true;
  try{
    const result=await auditTeacherTurn(session.data,session.state,request.teachingRef,request.intent,request.answer,request.locale);
    if(request.generation<=session.revokedThrough)throw Error('STALE_GENERATION');
    session.state=result.state;session.lastTurn=result.turn;
    const playbackOwner=auditTtsOwner(session);
    return {...result.turn,playbackOwner,unsupported:playbackOwner?result.turn.unsupported.filter(x=>!x.startsWith('播放任务仍需挂载')):result.turn.unsupported,task:result.turn.task?{...result.turn.task,playbackGrantAvailable:!!playbackOwner}:null};
  }finally{session.busy=false;}
}
export async function auditCancel(input:unknown){
  const {user}=await requirePlatformOwner();
  const request=cancelRequest.parse(input);
  const session=auditSession(user.id,request.sessionId);
  session.revokedThrough=Math.max(session.revokedThrough,request.generation);
  if(request.generation>=session.generation)session.tts?.revokeSession({actorId:user.id,tenantId:`owner-audit:${user.id}`},request.sessionId);
}

export async function auditIssueTts(input:unknown){
  const {user}=await requirePlatformOwner(),request=ttsIssueRequest.parse(input),session=auditSession(user.id,request.sessionId);
  return auditTtsService(session,request.sessionId).issue({actorId:user.id,tenantId:`owner-audit:${user.id}`},{sessionId:request.sessionId});
}
export async function auditObserveTts(input:unknown){
  const {user}=await requirePlatformOwner(),request=ttsObserveRequest.parse(input),session=auditSession(user.id,request.sessionId);
  return observeAuditTts(session,request.sessionId,request.grantId);
}
export async function auditActivities(input:unknown){
  const {user}=await requirePlatformOwner(),request=learningRequest.parse(input),session=auditSession(user.id,request.sessionId);
  return activityExecutions(session.data.result.manifest!,session.data.result.bindings,request.capsuleRef,request.locale);
}
export async function auditSubmitComposite(input:unknown){
  const {user}=await requirePlatformOwner(),request=activitySubmitRequest.parse(input),session=auditSession(user.id,request.sessionId);
  const descriptor=activityExecutions(session.data.result.manifest!,session.data.result.bindings,request.capsuleRef,request.locale).find(a=>a.ref===request.activityRef);
  const binding=session.data.result.bindings.activities.find(b=>b.ref===request.activityRef);
  if(!descriptor||!binding||binding.versionId!==session.data.result.manifest!.version.id)throw Error('ACTIVITY_SCOPE');
  return submitSmartTextbookActivityForContext({activityId:binding.activityId,response:boundActivityResponse(descriptor,request.response,session.data.result.bindings),locale:session.learningLocale},{supabase:session.data.admin,admin:session.data.admin,userId:user.id,tenantId:null,canSubmit:true,preview:true});
}
export async function auditPages(input:unknown){
  const {user}=await requirePlatformOwner(),request=learningRequest.parse(input),session=auditSession(user.id,request.sessionId);
  return activityPages(session.data.result.bindings,session.data.result.services,request.capsuleRef,request.locale);
}
export async function auditCheckPage(input:unknown){
  const {user}=await requirePlatformOwner(),request=pageCheckRequest.parse(input),session=auditSession(user.id,request.sessionId),services=session.data.result.services;
  const page=activityPages(session.data.result.bindings,services,request.capsuleRef,request.locale).find(p=>p.pageId===request.pageId);if(!page)throw Error('PAGE_SCOPE');
  // Owner-audit namespace scopes only the private mapping helper; it is never
  // passed to the old action/DB. The old action rechecks actual current auth.
  const result=await checkBoundPage(services,{sourceRevision:services.sourceRevision,versionId:services.versionId,actorId:user.id,tenantId:`owner-audit:${user.id}`,authorized:true},page,request.response,
    // Defence in depth: pageIndex is only a persistence coordinate in the old
    // action. Omit it for the tracking-disabled audit, so even an auth-role
    // transition cannot enter its page-progress write branch.
    ({activityId,itemIndices,response})=>checkSmartTextbookActivityPageAction({activityId,itemIndices,response}));
  session.pageChecks??=new Map();session.pageChecks.set(page.pageId,result);return result;
}

export async function auditPatterns(input:unknown){
  const {user}=await requirePlatformOwner(),request=learningRequest.parse(input),session=auditSession(user.id,request.sessionId);
  return patternExecutions(session.data.result.manifest,session.data.result.bindings,request.capsuleRef,request.locale);
}
export async function auditCheckPattern(input:unknown){
  const {user}=await requirePlatformOwner(),request=patternCheckRequest.parse(input),session=auditSession(user.id,request.sessionId);
  // Original per-turn checker, deliberately without pageIndex. Thus no page
  // persistence even if the account's role changes before the delegated action.
  return checkBoundPattern(session.data.result.manifest,session.data.result.bindings,request.capsuleRef,request.activityRef,request.response,
    ({activityId,itemIndices,response})=>checkSmartTextbookActivityPageAction({activityId,itemIndices,response}));
}
