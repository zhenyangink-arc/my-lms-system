import 'server-only';
import { auditSession } from './audit-session.server';
import { createLearningFlow,createLearningPracticeStore } from './learning-flow.server';
import { submitSmartTextbookActivityForContext } from '../../../app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-submission';
import { checkSmartTextbookActivityPageAction } from '../../../app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-actions';
const store=createLearningPracticeStore();
/** Caller already guards owner; each delegated operation rechecks the session.
 * The optional continuation shares only practice scope, never teacher state. */
export function auditLearningFlow(ownerId:string,sessionId:string){return createLearningFlow(async()=>{
  const s=auditSession(ownerId,sessionId),{manifest,bindings,services}=s.data.result;
  return {ownerId,sessionScope:s.recordingScope?.id??sessionId,expiresAt:s.recordingScope?.expiresAt??s.expiresAt,manifest,bindings,services,locale:s.learningLocale,preview:true,scope:{authorized:true,actorId:ownerId,tenantId:`owner-audit:${ownerId}`,versionId:manifest.version.id,sourceRevision:services.sourceRevision},
    check:checkSmartTextbookActivityPageAction,
    submit:(activityId,response)=>submitSmartTextbookActivityForContext({activityId,response,locale:s.learningLocale},{admin:s.data.admin,supabase:s.data.admin,userId:ownerId,tenantId:null,canSubmit:true,preview:true}),
  };
},store);}
