import 'server-only';
import { z } from 'zod';
import { getAuthContext } from '../../../lib/auth';
import { createAdminClient } from '../../../lib/supabase/admin';
import { POST as respond } from '../../../app/api/learning-agent/respond/route';
import { POST as recordEvent } from '../../../app/api/learning-agent/events/route';

/** PRIVATE domain port, not a browser DTO or another Agent state machine.
 * The installing Runtime boundary must resolve this from its opaque learning
 * session on EVERY operation. No production Route installs this port yet. */
export type ProductionTeacherScope = {
  snapshot: string; sourceRevision: string; scriptVersionId: string;
  textbookId: string; moduleId: string; lessonId: string; agentProfileId: string;
  agentCode: string; locale: 'zh-CN'|'ko-KR';
  supportMode: 'chinese'|'bilingual'|'immersion'; generation: number; expiresAt: number;
};
const rowSchema=z.object({id:z.string().uuid(),script_version_id:z.string().uuid(),current_node_id:z.string().uuid().nullable(),
  // Existing Agent owns this state. It never becomes public Runtime props.
  teaching_state:z.record(z.string(),z.unknown()).nullable(),status:z.enum(['active','completed','abandoned'])});
const eventSchema=z.object({node_id:z.string().uuid(),event_type:z.enum(['audio_completed','activity_opened','activity_completed']),target_key:z.string()});
export type RestoredTeacherAgent={sessionId:string;scriptVersionId:string;nodeId:string|null;teachingState:Record<string,unknown>;taskEvents:z.infer<typeof eventSchema>[];status:'active'|'completed'|'abandoned'};
type Restored=RestoredTeacherAgent;

export function createProductionTeacherAgentAdapter(options:{
  request:Request;
  /** Authenticated opaque Runtime session resolution; server composition only. */
  scope:()=>Promise<ProductionTeacherScope>;
  /** Must consume the actual Phase 3D grant, never a client boolean. The callback
   * additionally resolves the current cue's private event binding. */
  consumeObservation:(grantId:string,session:Restored,scope:ProductionTeacherScope)=>Promise<{
    teachingPlaybackWaitSatisfied:boolean;duplicate:boolean;formalCompletion:false;progressDelta:null;score:null;agentAdvance:false;
    targetKey:string;nodeId:string;
  }>;
}) {
  const authorize=async()=>{
    const auth=await getAuthContext(),scope=await options.scope();
    if(auth.status!=='active'||!auth.tenant||scope.expiresAt<=Date.now())throw Error('PRODUCTION_TEACHER_AUTHORITY');
    const admin=createAdminClient();
    const {data:lesson,error:lessonError}=await admin.from('learning_agent_lessons').select('id').eq('id',scope.lessonId).eq('module_id',scope.moduleId).eq('agent_profile_id',scope.agentProfileId).eq('status','published').maybeSingle();
    const {data:textbook,error:textbookError}=await admin.from('digital_textbooks').select('id').eq('id',scope.textbookId).eq('agent_profile_id',scope.agentProfileId).eq('status','published').maybeSingle();
    if(lessonError||textbookError||!lesson||!textbook)throw Error('PRODUCTION_TEACHER_LESSON_PROFILE');
    // Refuse a stale frozen Runtime revision before invoking a mutating legacy
    // responder. That responder remains authoritative about published content.
    const {data:version,error}=await admin.from('learning_agent_script_versions').select('id').eq('lesson_id',scope.lessonId).eq('status','published').maybeSingle();
    if(error||version?.id!==scope.scriptVersionId)throw Error('PRODUCTION_TEACHER_REVISION');
    return{auth,scope,admin};
  };
  const read=async(id?:string):Promise<{value:Restored|null;scope:ProductionTeacherScope}>=>{
    const {auth,scope,admin}=await authorize();
    let query=admin.from('learning_agent_sessions').select('id,script_version_id,current_node_id,teaching_state,status')
      .eq('tenant_id',auth.tenant!.id).eq('student_id',auth.user.id).eq('lesson_id',scope.lessonId).eq('agent_profile_id',scope.agentProfileId);
    query=id?query.eq('id',z.string().uuid().parse(id)):query.eq('status','active').order('updated_at',{ascending:false}).limit(1);
    const {data,error}=await query.maybeSingle();if(error)throw Error('PRODUCTION_TEACHER_RESTORE');if(!data)return{value:null,scope};
    const row=rowSchema.parse(data);if(row.script_version_id!==scope.scriptVersionId)throw Error('PRODUCTION_TEACHER_RECOMPILE_REQUIRED');
    if(row.current_node_id){const {data:node,error}=await admin.from('learning_agent_script_nodes').select('id').eq('id',row.current_node_id).eq('script_version_id',scope.scriptVersionId).maybeSingle();if(error||!node)throw Error('PRODUCTION_TEACHER_NODE_SCOPE');}
    const {data:events,error:eventsError}=await admin.from('learning_agent_task_events').select('node_id,event_type,target_key')
      .eq('session_id',row.id).eq('tenant_id',auth.tenant!.id).eq('student_id',auth.user.id);
    if(eventsError)throw Error('PRODUCTION_TEACHER_EVENTS_RESTORE');
    return{scope,value:{sessionId:row.id,scriptVersionId:row.script_version_id,nodeId:row.current_node_id,
      teachingState:row.teaching_state??{},taskEvents:z.array(eventSchema).parse(events??[]),status:row.status}};
  };
  const request=(path:string,body:object)=>new Request(new URL(path,options.request.url),{method:'POST',headers:{...Object.fromEntries(options.request.headers),'content-type':'application/json'},body:JSON.stringify(body),signal:options.request.signal});
  const same=(a:ProductionTeacherScope,b:ProductionTeacherScope)=>a.snapshot===b.snapshot&&a.sourceRevision===b.sourceRevision&&a.scriptVersionId===b.scriptVersionId&&a.generation===b.generation;
  return{
    /** Same active-only/latest ordering as old respond/loader; completed sessions
     * are not silently reactivated. No new persistent Teacher table. */
    restore:(sessionId?:string)=>read(sessionId),
    async turn(input:{intent:'start'|'ready'|'hint'|'example'|'answer';answer?:string;sessionId?:string}){
      const parsed=z.strictObject({intent:z.enum(['start','ready','hint','example','answer']),answer:z.string().min(1).max(300).optional(),sessionId:z.string().uuid().optional()}).parse(input);
      const before=await read(parsed.sessionId),s=before.scope;
      if(parsed.sessionId&&!before.value)throw Error('PRODUCTION_TEACHER_SESSION_SCOPE');
      if(before.value?.status!=='active'&&before.value)throw Error('PRODUCTION_TEACHER_SESSION_COMPLETED');
      const response=await respond(request('/api/learning-agent/respond',{textbookId:s.textbookId,moduleId:s.moduleId,agentCode:s.agentCode,
        sessionId:before.value?.sessionId,intent:parsed.intent,answer:parsed.answer,locale:s.locale,supportMode:s.supportMode}));
      if(!response.ok)throw Error('PRODUCTION_TEACHER_RESPOND_REJECTED');
      const id=z.string().uuid().parse(response.headers.get('X-Learning-Agent-Session')),text=await response.text(),after=await read(id);
      if(!same(s,after.scope)||!after.value)throw Error('PRODUCTION_TEACHER_STALE_RESULT');
      // PRIVATE return: the Teacher boundary must project it into a new opaque
      // cue. Never forward legacy headers/response directly to the browser.
      // Fixed private response projection, not arbitrary upstream headers. The
      // unified session validates this before creating its public opaque cue.
      const headers=Object.fromEntries(['Teaching-Phase','Question-Options','Awaiting-Answer','Terminal','Continue-Label','Task-Completed','Answer-Correct']
        .map(name=>[name,response.headers.get(`X-Learning-Agent-${name}`)]));
      return{state:after.value,text,headers};
    },
    async observe(sessionId:string,grantId:string){
      z.string().uuid().parse(grantId);const before=await read(sessionId);
      if(!before.value||before.value.status!=='active')throw Error('PRODUCTION_TEACHER_SESSION_SCOPE');
      const observation=await options.consumeObservation(grantId,before.value,before.scope);
      if(observation.formalCompletion!==false||observation.progressDelta!==null||observation.score!==null||observation.agentAdvance!==false)throw Error('PRODUCTION_TEACHER_OBSERVATION_SEMANTICS');
      // A consumed valid grant can retry DELIVERY after a failed event request.
      // Existing event upsert is idempotent; grant replay still never grants an
      // extra presentation advance. No DB/event success is fabricated on failure.
      if(observation.teachingPlaybackWaitSatisfied||observation.duplicate){
        if(observation.nodeId!==before.value.nodeId)throw Error('PRODUCTION_TEACHER_TASK_SCOPE');
        const latest=await read(sessionId);
        if(!latest.value||latest.value.nodeId!==before.value.nodeId||!same(before.scope,latest.scope))throw Error('PRODUCTION_TEACHER_STALE_EVENT');
        const response=await recordEvent(request('/api/learning-agent/events',{sessionId,eventType:'audio_completed',targetKey:observation.targetKey}));
        if(!response.ok)throw Error('PRODUCTION_TEACHER_EVENT_REJECTED');
      }
      return{teachingPlaybackWaitSatisfied:observation.teachingPlaybackWaitSatisfied&&!observation.duplicate,duplicate:observation.duplicate,
        formalCompletion:false as const,progressDelta:null,score:null,agentAdvance:false as const};
    },
  };
}
