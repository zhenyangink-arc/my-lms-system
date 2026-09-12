import 'server-only';
import { configuredText, resolveScriptStep, resolveScriptCharacter, resolveBufferLineSpeechAssetId, upcomingScriptNodeBufferLine, upcomingScriptNode, taskEventKey, visualCue, type ScriptNodeRow } from '../../../lib/learning-agent-script-runtime';
import { teachingBlackboardDisplayForSegment, type TeachingBlackboardDisplay } from '../../../lib/teaching-blackboard';
import { capsuleSchema } from '../../../lib/smart-textbook-legacy-adapter/capsules.server';
import type { PreviewState } from '../../../lib/learning-agent-preview-state';
import type { AuditSource } from './audit-source.server';
import type { TeacherIntent, TeacherTurn } from '../core/teacher';

/** Executes the SAME deterministic Agent resolver. Owns no chapter navigation/layout.
 * Session state remains private; not the old unsigned preview token in the browser. */
export async function auditTeacherTurn(data:AuditSource,state:PreviewState,ref:string,intent:TeacherIntent,answer:string|undefined,locale:'zh-CN'|'ko-KR'):Promise<{state:PreviewState;turn:TeacherTurn}>{
  const binding=data.result.bindings.teaching.find(t=>t.ref===ref);
  if(!binding||binding.scriptVersionId!==state.scriptVersionId)throw Error('TEACHING_REVISION_MISMATCH');
  const capsule=capsuleSchema.parse(data.result.bindings.capsules.find(c=>c.id===binding.capsuleRef));
  if(capsule.kind!=='teacher'||capsule.revision!==binding.scriptVersionId)throw Error('TEACHER_CAPSULE_MISMATCH');
  const nodes=data.source.teachingNodes.filter(n=>n.script_version_id===binding.scriptVersionId).sort((a,b)=>a.sort_order-b.sort_order) as ScriptNodeRow[];
  if(nodes.some(n=>!capsule.nodes.some(c=>c.id===n.id)))throw Error('TEACHER_CAPSULE_SCOPE');
  const nodeByKey=new Map(nodes.map(n=>[n.node_key,n]));
  const resolved=await resolveScriptStep({admin:data.admin,scriptNodes:nodes,nodeByKey,currentScriptNode:state.currentNodeKey?nodeByKey.get(state.currentNodeKey)??null:null,
    teachingState:state.teachingState,completedTaskEvents:new Set(state.completedTaskEvents),intent,locale,answer});
  const node=resolved.selectedScriptNode;if(!node)throw Error('No selected teacher cue');
  const character=await resolveScriptCharacter(data.admin,node,resolved.selectedScriptSegmentIndex,resolved.scriptedContent,locale);
  const display=teachingBlackboardDisplayForSegment(node.configuration?.display,resolved.selectedScriptSegmentIndex) as TeachingBlackboardDisplay|undefined;
  const unsupported:string[]=[];
  const blackboard=(display?.activeSlide?.elements??[]).flatMap(e=>{
    if(e.type==='image'||e.type==='video'){unsupported.push('黑板媒体尚未建立安全引用投影。');return [];}
    return [{id:e.id,content:e.content,translation:e.translation??'',x:e.x,y:e.y,width:e.width,height:e.height,fontSize:e.fontSize,align:e.align}];
  });
  const stable=(legacy:unknown)=>{
    const alias=data.result.bindings.aliases.find(a=>a.legacyKey===legacy&&a.moduleId===capsule.stepId);
    if(legacy&&!alias)unsupported.push('教师目标缺少稳定映射。');
    return alias?.target??null;
  };
  const task=resolved.responseStudentTask;
  const target=task?stable(task.targetKey):null;
  const visual=visualCue(node.configuration);
  const nextInput={selectedNode:node,scriptNodes:nodes,nodeByKey,locale,segmentIndex:resolved.selectedScriptSegmentIndex,segmentCount:resolved.selectedScriptSegmentCount};
  const bufferText=resolved.nodeTurnComplete?upcomingScriptNodeBufferLine(nextInput):'';
  const bufferAsset=bufferText?await resolveBufferLineSpeechAssetId(data.admin,upcomingScriptNode(nextInput),locale,bufferText):null;
  // No onend → old event escape hatch. Phase 3D grants must be bound to a mounted,
  // declared-capability playback owner before the task can be satisfied.
  if(task?.required&&!state.completedTaskEvents.includes(taskEventKey(node.id,task)))unsupported.push('播放任务仍需挂载授权 TTS observation 执行器；当前不伪造完成。');
  return {state:{scriptVersionId:state.scriptVersionId,currentNodeKey:node.node_key,teachingState:resolved.nextTeachingState,completedTaskEvents:state.completedTaskEvents},
    turn:{text:resolved.scriptedContent??'',cueId:node.id,phase:resolved.responsePhase,
      character:character?{pose:character.pose,voiceEnabled:character.voiceEnabled,voiceRate:character.voiceRate}:null,
      speechAssetId:character&&'speechAssetId'in character&&character.speechAssetId?String(character.speechAssetId):null,
      buffer:{text:bufferText??'',assetId:bufferAsset},
      blackboard,task:target?{target,instruction:configuredText({instruction:task?.instruction},'instruction',locale),playbackGrantAvailable:false}:null,
      visualTarget:stable(visual?.targetKey),awaitingAnswer:resolved.awaitingAnswer,questionOptions:resolved.questionOptions,terminal:resolved.isFinalStep,
      continueLabel:configuredText(node.configuration,'continueLabel',locale)||'继续',unsupported}};
}
