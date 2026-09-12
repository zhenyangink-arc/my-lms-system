import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { AdapterResult } from './adapter.server.ts';
import type { LegacyChapterOneSource } from './source.server.ts';
import type { ServiceEvidence } from './readiness-contracts.server.ts';
import { nodeContentSchemas, teacherConfigurationSchema } from './chapter-one-shapes.server.ts';
import { profile } from './profile.server.ts';
import { canonical, identity } from './identity.server.ts';
import { learningAgentBufferPresetAssetRef, learningAgentBufferPresetForText } from '../learning-agent-buffer-presets.ts';
import { verifySpeechSlot } from './speech-proof.server.ts';
import { buildCurrentSpeechReachability } from './current-speech-proof.server.ts';

export const utteranceHash=(text:string)=>createHash('sha256').update(text,'utf8').digest('hex');
const id=z.string().min(1),hash=z.string().regex(/^[a-f0-9]{64}$/);
export const ttsBindingSchema=z.strictObject({
  kind:z.literal('authorized-browser-tts-observation/1'),sourceRevision:hash,snapshotId:id,teachingRevision:id,
  stepId:id,target:id,cueId:id,utteranceId:id,text:z.string().min(1),textHash:hash,locale:z.literal('ko-KR'),
  allowedCommand:z.literal('speak-authorized-utterance'),acceptedEvent:z.literal('browser-tts-ended'),
  formalCompletion:z.literal(false),progressDelta:z.null(),teachingEffect:z.literal('satisfy-playback-wait-only'),
});
export type TtsObservationBinding=z.infer<typeof ttsBindingSchema>;
type ProofAdapterContext=Pick<AdapterResult,'manifest'|'bindings'> & {report:{sourceRevision:string}};
export function buildTtsBinding(s:LegacyChapterOneSource,result:ProofAdapterContext):TtsObservationBinding {
  const manifest=result.manifest;if(!manifest)throw Error('No validated Manifest');
  const n=s.nodes.find(n=>n.id===profile.orientation.nodeId);
  const content=nodeContentSchemas.orientation.parse(n?.content);
  const group=content.dialogueGroups.find(g=>g.id==='greeting');
  // Exact legacy alias, resolved against already-frozen identity, never allocate from line index.
  const alias=result.bindings.aliases.filter(a=>a.legacyKey==='dialogue:greeting:0');
  const allocation=result.bindings.identities.find(i=>i.owner===n?.id&&i.legacyPath===`content.dialogueGroups[${content.dialogueGroups.indexOf(group!)}].lines[0]`);
  const text=group?.lines[0]?.ko.trim();
  const tasks=s.teachingNodes.filter(n=>teacherConfigurationSchema.safeParse(n.configuration).success&&teacherConfigurationSchema.parse(n.configuration).studentTask?.targetKey==='dialogue:greeting:0');
  if(!text||alias.length!==1||!allocation||!alias[0].target.endsWith(`/part:${allocation.partId}`)||tasks.length!==1)throw Error('TTS target/utterance identity unresolved');
  const cue=tasks[0],config=teacherConfigurationSchema.parse(cue.configuration);
  if(cue.node_key!=='model-dialogue'||cue.node_type==='question'||cue.reference_activity_id!==null||config.terminal===true||config.studentTask?.eventType!=='audio_completed'||config.studentTask.kind!=='play_expression_audio'||config.studentTask.required!==true)
    throw Error('Task is not the proven non-assessment playback wait');
  if(!manifest.runtimeTargets.some(t=>t.id===alias[0].target&&manifest.blocks.some(b=>b.id===t.blockId&&b.type==='compat.learning.v1'))||!manifest.teachingRefs.some(t=>t.revision===cue.script_version_id&&t.mode==='legacy'))throw Error('TTS target/revision outside compatibility scope');
  return ttsBindingSchema.parse({kind:'authorized-browser-tts-observation/1',sourceRevision:result.report.sourceRevision,snapshotId:manifest.snapshot.id,teachingRevision:cue.script_version_id,stepId:alias[0].moduleId,target:alias[0].target,cueId:cue.id,utteranceId:identity('utterance',allocation.partId,'ko-KR'),text,textHash:utteranceHash(text),locale:'ko-KR',allowedCommand:'speak-authorized-utterance',acceptedEvent:'browser-tts-ended',formalCompletion:false,progressDelta:null,teachingEffect:'satisfy-playback-wait-only'});
}

export type SpeechSelectionProof={
  id:string;nodeId:string;nodeKey:string;teachingRevision:string;locale:'zh-CN'|'ko-KR';segment:number;
  path:'script'|'buffer-transition'|'opening-loader'|'resume-loader'|'resume-reentry'|'restart'|'reset'|'terminal-restore'|'terminal-completed';
  expectedTextHash:string;preset:string|null;selectionMode:'exact-script'|'none'|'preset-first'|'exact-buffer-hash'|'loader-ready-first'|'existing-browser-tts-fallback'|'silent'|'unsupported';
  legacyCandidateAssetId:string|null;selectedAssetId:string|null;fallbackMode:'existing-browser-tts-or-text'|'existing-silent'|null;
  proofStatus:'verified-asset'|'verified-preset'|'verified-existing-fallback'|'unsupported';reason:string;
};
export type Historical199Proof={assetId:string;nodeId:string;locale:string;classification:'reachable-and-valid'|'reachable-but-invalid'|'unreachable-stale'|'unresolved'|'candidate-but-rejected';proofIds:string[]};
export type SpeechReachability={revision:'speech-reachability/1'|'speech-reachability/2';proofs:SpeechSelectionProof[];historical199:Historical199Proof[];selectableAssetIds:string[]};

/** Includes loader/resume paths, not only the safer respond helper. Does not sign or play media. */
export function buildSpeechReachability(s:LegacyChapterOneSource,e:ServiceEvidence):SpeechReachability {
  const proofs:SpeechSelectionProof[]=[];
  const nodes=[...s.teachingNodes].sort((a,b)=>a.sort_order-b.sort_order);
  if(nodes.length!==8||s.teachingVersions.length!==1||s.teachingVersions[0].version_number!==23||s.teachingVersions[0].status!=='published')throw Error('Expected current published v23');
  const opening=teacherConfigurationSchema.parse(nodes[0].configuration);
  const configured=(config:ReturnType<typeof teacherConfigurationSchema.parse>,locale:'zh-CN'|'ko-KR')=>String(config.bufferLine?.[locale]??config.bufferLine?.['zh-CN']??'').trim();
  for(const node of nodes){
    const config=teacherConfigurationSchema.parse(node.configuration);
    for(const locale of ['zh-CN','ko-KR'] as const){
      const own=configured(config,locale),openingText=configured(opening,locale);
      for(const path of [...(node.id===nodes[0].id?[]:['buffer-transition' as const]),'resume-loader','resume-reentry',...(node.id===nodes[0].id?['opening-loader' as const]:[])] as const){
        // Re-entry uses || (not ??): empty resumed buffer falls back to opening text.
        const text=path==='resume-reentry'?own||openingText:own;
        const preset=learningAgentBufferPresetForText(locale,text);
        let candidate:string|null=null,selectionMode:SpeechSelectionProof['selectionMode']='none';
        let status:SpeechSelectionProof['proofStatus']='verified-existing-fallback',fallback:SpeechSelectionProof['fallbackMode']='existing-silent',reason='Empty buffer: current request helper returns null, no speech is started.';
        const rows=e.speech.filter(a=>a.script_node_id===node.id&&a.locale===locale&&a.segment_index===199&&a.production_status==='ready');
        if(text){
          if(path==='buffer-transition'){
            candidate=learningAgentBufferPresetAssetRef(locale,text);selectionMode=candidate?'preset-first':'exact-buffer-hash';
            if(!candidate){const exact=rows.filter(a=>a.content_hash===utteranceHash(text));candidate=exact.length===1?exact[0].id:null;if(exact.length>1)status='unsupported';}
          }else{
            selectionMode='loader-ready-first';candidate=rows.length===1?rows[0].id:null;
            if(!candidate&&rows.length===0)candidate=learningAgentBufferPresetAssetRef(locale,text);
            if(rows.length>1)status='unsupported';
          }
          const asset=e.speech.find(a=>a.id===candidate);
          fallback='existing-browser-tts-or-text';
          reason='Existing buffer request catches unavailable speech and uses speakTutorCharacterLine; absent browser voice shows text. Preset bytes are not certified here.';
          if(asset){
            const valid=asset.content_hash===utteranceHash(text)&&asset.script_node_id===node.id&&asset.locale===locale&&asset.segment_index===199&&asset.cue_timeline.every(c=>c.endMs<=asset.duration_ms&&c.endMs>=c.startMs&&c.charEnd<=text.length);
            status=valid?'verified-asset':'unsupported';
            reason=valid?'Selected asset matches current expected buffer hash.':'Loader can select ready segment 199 without hash check; successful wrong audio does NOT trigger the existing network-error fallback.';
          }else if(status!=='unsupported')status='verified-existing-fallback';
          if(config.bufferPresetId&&config.bufferPresetId!=='none'&&own&&preset?.id!==config.bufferPresetId){status='unsupported';reason='Configured preset and actual buffer text disagree';}
        }
        if(config.terminal===true&&(path==='resume-loader'||path==='resume-reentry')){
          // Current final response closes the session. Historical active-session migration
          // could differ; without evidence do not label this row either reachable or stale.
          candidate=null;status='unsupported';reason='Terminal node normally closes the session; historical active-session reachability is unresolved, not proof of stale/unreachable.';
        }
        proofs.push({id:identity('speech-proof',node.id,locale,path),nodeId:node.id,nodeKey:node.node_key,teachingRevision:node.script_version_id,locale,segment:199,path,expectedTextHash:utteranceHash(text),preset:preset?.id??null,selectionMode,legacyCandidateAssetId:candidate,selectedAssetId:status==='verified-asset'?candidate:null,fallbackMode:fallback,proofStatus:status,reason});
      }
    }
  }
  for(const a of e.speech.filter(a=>a.segment_index!==199)){
    const node=nodes.find(n=>n.id===a.script_node_id),valid=!!node&&verifySpeechSlot(node,a);
    if(!node)throw Error('Speech node outside v23');
    proofs.push({id:identity('speech-proof',node.id,a.locale,String(a.segment_index)),nodeId:node.id,nodeKey:node.node_key,teachingRevision:node.script_version_id,locale:a.locale,segment:a.segment_index,path:'script',expectedTextHash:a.content_hash,preset:null,selectionMode:'exact-script',legacyCandidateAssetId:a.id,selectedAssetId:valid?a.id:null,fallbackMode:null,proofStatus:valid?'verified-asset':'unsupported',reason:valid?'Phase 3C exact script/locale/segment/hash/timeline validated':'Script slot does not match current fixed content'});
  }
  const historical199=e.speech.filter(a=>a.segment_index===199).map(a=>{
    const reached=proofs.filter(p=>p.legacyCandidateAssetId===a.id);
    // No global-reference proof is inferred: absent reachability is unresolved, never stale by default.
    const classification:Historical199Proof['classification']=reached.some(p=>p.proofStatus==='unsupported')?'reachable-but-invalid':reached.length?'reachable-and-valid':'unresolved';
    return {assetId:a.id,nodeId:a.script_node_id,locale:a.locale,classification,proofIds:reached.map(p=>p.id).sort()};
  }).sort((a,b)=>a.assetId.localeCompare(b.assetId));
  proofs.sort((a,b)=>a.id.localeCompare(b.id));
  return {revision:'speech-reachability/1',proofs,historical199,selectableAssetIds:[...new Set(proofs.flatMap(p=>p.selectedAssetId?[p.selectedAssetId]:[]))].sort()};
}
export function validateFinalProof(s:LegacyChapterOneSource,e:ServiceEvidence,result:ProofAdapterContext,tts:unknown,speech:SpeechReachability):string[]{
  const errors:string[]=[];
  try{if(canonical(ttsBindingSchema.parse(tts))!==canonical(buildTtsBinding(s,result)))errors.push('TTS binding target/text/cue/revision mismatch');}catch{errors.push('Invalid TTS observation binding');}
  try{const expected=speech.revision==='speech-reachability/2'?buildCurrentSpeechReachability(s,e):buildSpeechReachability(s,e);if(canonical(speech)!==canonical(expected))errors.push('Speech proof coverage/selection/hash/preset mismatch');}catch{errors.push('Unresolved published speech proof');}
  if(new Set(speech.proofs.map(p=>p.id)).size!==speech.proofs.length)errors.push('Duplicate speech selection proof');
  for(const row of speech.historical199)if(row.classification==='unreachable-stale'&&speech.selectableAssetIds.includes(row.assetId))errors.push('Stale asset in selectable catalog');
  return errors;
}
