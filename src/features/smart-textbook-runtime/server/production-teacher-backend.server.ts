import 'server-only';
import { z } from 'zod';
import { createProductionTeacherAgentAdapter, type ProductionTeacherScope, type RestoredTeacherAgent } from './production-teacher-agent.server';
import type { TeacherBackendFactory } from './teacher-backend.server';
import type { PreviewState } from '../../../lib/learning-agent-preview-state';
import type { TeacherTurn } from '../core/teacher';
import { configuredText, resolveScriptCharacter, studentTask, taskEventKey, type ScriptNodeRow } from '../../../lib/learning-agent-script-runtime';
import { teacherConfigurationSchema } from '../../../lib/smart-textbook-legacy-adapter/chapter-one-shapes.server';

/** Installs existing production persistence behind the SAME opaque boundary.
 * request/scope are resolved per operation from a trusted server context, never
 * captured from the old page or supplied as client fields. No Route installs
 * this composition in production in Phase 4A. */
export function productionTeacherBackend(options:{request:()=>Request;scope:(opaqueScope:string)=>Promise<ProductionTeacherScope>}):TeacherBackendFactory {
  return async ctx=>{
    if(!ctx.mount.scopeRef||ctx.authority.role!=='learner'||!ctx.authority.tenantId)throw Error('PRODUCTION_TEACHER_BINDING_AUTHORITY');
    const data=ctx.audit.data,scopeRef=ctx.mount.scopeRef;let nativeId:string|undefined,disposed=false,inflight:Promise<unknown>|null=null;
    const caller={actorId:ctx.authority.actorId,tenantId:ctx.authority.tenantId};
    const scope=async()=>{
      if(disposed)throw Error('PRODUCTION_TEACHER_DISPOSED');const s=await options.scope(scopeRef);
      const version=data.source.teachingVersions.find(v=>v.id===data.result.manifest.teachingRefs[0].revision),lesson=data.source.lessons.find(l=>l.id===version?.lesson_id);
      if(s.snapshot!==data.result.manifest.snapshot.id||s.sourceRevision!==data.result.report.sourceRevision||s.scriptVersionId!==version?.id||
        s.textbookId!==data.result.manifest.textbook.id||s.lessonId!==lesson?.id||s.moduleId!==lesson?.module_id||
        s.generation!==ctx.mount.generation||s.expiresAt<=Date.now())throw Error('PRODUCTION_TEACHER_BINDING_REVISION');
      return s;
    };
    const state=(row:RestoredTeacherAgent|null):PreviewState=>{
      const node=row?.nodeId?data.source.teachingNodes.find(n=>n.id===row.nodeId&&n.script_version_id===row.scriptVersionId):null;
      if(row?.nodeId&&!node)throw Error('PRODUCTION_TEACHER_NODE_BINDING');
      return {scriptVersionId:row?.scriptVersionId??data.result.manifest.teachingRefs[0].revision,currentNodeKey:node?.node_key??null,
        teachingState:row?.teachingState??{},completedTaskEvents:row?.taskEvents.map(e=>`${e.node_id}:${e.event_type}:${e.target_key}`)??[]};
    };
    const adapter=()=>createProductionTeacherAgentAdapter({request:options.request(),scope,consumeObservation:async(grantId,row)=>{
      if(row.nodeId!==ctx.audit.lastTurn?.cueId)throw Error('PRODUCTION_TEACHER_GRANT_NODE');
      const task=studentTask(teacherConfigurationSchema.parse(data.source.teachingNodes.find(n=>n.id===row.nodeId)?.configuration));
      if(!task||task.eventType!=='audio_completed')throw Error('PRODUCTION_TEACHER_GRANT_TASK');
      const result=await ctx.grantService().observe(caller,{grantId});
      return {...result,targetKey:z.string().min(1).parse(task.targetKey),nodeId:row.nodeId!};
    }});
    const work=async<T>(fn:()=>Promise<T>)=>{if(disposed)throw Error('PRODUCTION_TEACHER_DISPOSED');if(inflight)throw Error('PRODUCTION_TEACHER_BUSY');const p=fn();inflight=p;try{return await p;}finally{if(inflight===p)inflight=null;}};
    return{
      authoredAutoContinue:false, // old student responder does NOT honor preview auto-continue
      restore:()=>work(async()=>{const {value}=await adapter().restore();nativeId=value?.sessionId;return state(value);}),
      turn:(intent,answer)=>work(async()=>{
        const result=await adapter().turn({intent,answer,sessionId:nativeId});nativeId=result.state.sessionId;
        const next=state(result.state),node=data.source.teachingNodes.find(n=>n.id===result.state.nodeId) as ScriptNodeRow|undefined;
        if(!node)throw Error('PRODUCTION_TEACHER_SELECTED_NODE');
        const h=result.headers,phase=z.enum(['explanation','task','task_feedback','question']).parse(h['Teaching-Phase']);
        const options=z.array(z.string()).parse(JSON.parse(decodeURIComponent(h['Question-Options']??'[]')));
        if(h['Awaiting-Answer']==='true'&&options.length<2)throw Error('PRODUCTION_TEACHER_QUESTION_OPTIONS');
        const character=await resolveScriptCharacter(data.admin,node,Number(next.teachingState.scriptSegmentIndex)||0,result.text,ctx.mount.locale);
        const task=phase==='task'?studentTask(node.configuration):null;
        // Persisted event satisfies the task even if the old responder is still
        // replaying its task caption. The next explicit ready turn determines
        // task_feedback; never ask for another observation after reload.
        const pending=task&&!next.completedTaskEvents.includes(taskEventKey(node.id,task));
        const alias=task?data.result.bindings.aliases.find(a=>a.moduleId===ctx.mount.stepId&&a.legacyKey===task.targetKey):null;
        if(pending&&!alias)throw Error('PRODUCTION_TEACHER_TASK_ALIAS');
        const turn:TeacherTurn={text:result.text,cueId:node.id,phase,character:character?{pose:character.pose,voiceEnabled:character.voiceEnabled,voiceRate:character.voiceRate}:null,
          speechAssetId:character&&'speechAssetId' in character?character.speechAssetId:null,buffer:{text:'',assetId:null},blackboard:[],
          task:pending&&alias?{target:alias.target,instruction:configuredText({instruction:task!.instruction},'instruction',ctx.mount.locale),playbackGrantAvailable:false}:null,
          visualTarget:null,awaitingAnswer:h['Awaiting-Answer']==='true',questionOptions:options,terminal:result.state.status==='completed',
          continueLabel:decodeURIComponent(h['Continue-Label']??'')||'继续',unsupported:[]};
        return {state:next,turn};
      }),
      observe:grantId=>work(async()=>{
        if(!nativeId)throw Error('PRODUCTION_TEACHER_NO_SESSION');const a=adapter(),result=await a.observe(nativeId,grantId);
        const restored=await a.restore(nativeId);if(!restored.value)throw Error('PRODUCTION_TEACHER_EVENT_READBACK');ctx.audit.state=state(restored.value);
        return {...result,playbackObserved:true as const,observation:'authorized-browser-tts-ended-report' as const,teachingEffect:result.teachingPlaybackWaitSatisfied?'eligible-for-task-feedback' as const:'none' as const};
      }),
      dispose:async()=>{await inflight?.catch(()=>{});disposed=true;},
    };
  };
}
