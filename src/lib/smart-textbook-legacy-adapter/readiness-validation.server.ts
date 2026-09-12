import 'server-only';
import type { LessonManifestV1 } from '../smart-textbook-runtime-v1/contracts.ts';
import type { PrivateBindings } from './capsules.server.ts';
import type { ReadinessBindings, ServiceEvidence, ServiceIdentityMap } from './readiness-contracts.server.ts';
import type { LegacyChapterOneSource } from './source.server.ts';
import { canonical, digest } from './identity.server.ts';
import { verifySpeechSlot } from './speech-proof.server.ts';
import { validateFinalProof, type TtsObservationBinding, type SpeechReachability } from './final-proof.server.ts';
export interface ReadinessValidationContext {services:ReadinessBindings;source:LegacyChapterOneSource;history:ServiceIdentityMap;evidence:ServiceEvidence;sourceRevision:string;finalProof?:{tts:TtsObservationBinding;speech:SpeechReachability}}
export function validateReadinessBindings(m:LessonManifestV1,b:PrivateBindings,c:ReadinessValidationContext):string[] {
  const r=c.services,errors:string[]=[];
  const check=(ok:boolean,message:string)=>{if(!ok)errors.push(message);};
  const unique=(values:string[],label:string)=>check(new Set(values).size===values.length,`${label}: duplicate identity`);
  check(r.schemaVersion==='legacy-readiness/1'&&r.sourceRevision===c.sourceRevision&&r.versionId===m.version.id&&r.historicalSourceRevision===c.history.sourceRevision,'readiness revision mismatch');
  check(digest(c.history)==='a6fb74b165aa19cb0be225b709f7650703dc9540d947c754a82626e5123ee413','historical mapping certification mismatch');
  check(r.listeningAliases.length===3,'listening alias coverage missing');
  check(r.playback.length===3,'playback target coverage missing');
  unique(r.activityPages.map(p=>p.pageId),'page');unique(r.activityPages.flatMap(p=>p.items.map(i=>i.partId)),'page item');
  unique(r.guidedRepeat.map(p=>p.segmentId),'repeat segment');unique(r.listeningAliases.map(p=>p.alias),'listening alias');
  unique(r.playback.map(p=>p.target),'playback target');unique(r.speech.map(p=>p.assetId),'speech asset');
  unique(r.speech.map(p=>`${p.scriptVersionId}:${p.nodeId}:${p.locale}:${p.segment}`),'speech slot');
  check(canonical(r.activityPages)===canonical(c.history.pages),'activity-page historical mapping mismatch');
  check(canonical(r.guidedRepeat)===canonical(c.history.repeat),'guided-repeat historical mapping mismatch');
  for(const p of r.activityPages){
    check(b.activities.some(a=>a.activityId===p.activityId&&a.versionId===r.versionId),'page activity/version dangling');
    check(m.runtimeTargets.some(t=>t.partId===p.pageId),'page progress part missing');
    for(const i of p.items)check(m.runtimeTargets.some(t=>t.partId===i.partId)&&b.identities.some(x=>x.owner===p.activityId&&x.partId===i.partId),'page item part missing');
  }
  for(const p of r.guidedRepeat){
    check(b.recordings.some(a=>a.activityId===p.activityId&&a.practice==='speaking'&&a.versionId===r.versionId),'repeat activity/version dangling');
    check([p.trackId,p.segmentId].every(id=>m.runtimeTargets.some(t=>t.partId===id)&&b.identities.some(x=>x.owner===p.nodeId&&x.partId===id)),'repeat progress part missing');
  }
  for(const a of r.listeningAliases){
    const track=b.listening.filter(t=>t.ref===a.trackId&&t.audioRef===a.mediaRef&&t.activityId===a.activityId&&t.legacyPage===a.legacyPage);
    check(track.length===1&&b.media.some(m=>m.ref===a.mediaRef&&m.revision===a.revision),'listening alias dangling/revision mismatch');
    const source=c.source.activities.find(x=>x.id===a.activityId);
    const config=source?.public_config as {audioId?:string;tracks?:Array<{audioId?:string}>}|undefined;
    check(a.legacyPage===0?config?.audioId===a.alias||config?.tracks?.[0]?.audioId===a.alias:config?.tracks?.[a.legacyPage]?.audioId===a.alias,'listening alias source mismatch');
  }
  for(const n of r.navigation)check(n.kind==='chapter-test'&&n.legacyKey==='chapter-test:korean-level-one-01'&&n.slug==='korean-level-one-01'&&
    n.requires==='server-chapter-completed'&&n.chapterId===m.chapter.id&&n.testId===c.evidence.chapter.chapter_test_id&&n.testId===c.evidence.chapter.chapter_tests.id,'navigation destination mismatch');
  check(r.navigation.length===1,'navigation missing/duplicate');
  for(const p of r.playback){
    check(m.runtimeTargets.some(t=>t.id===p.target),'playback target missing');
    if(p.source==='authorized-listening') {
      check(r.activityPages.some(page=>m.runtimeTargets.some(t=>t.id===p.target&&t.partId===page.pageId)&&r.listeningAliases.some(a=>a.activityId===page.activityId&&a.legacyPage===page.legacyPage&&a.mediaRef===p.mediaRef&&a.revision===p.revision)),'playback target/media mismatch');
      check(p.allowedCommand==='play'&&p.acceptedEvent==='media-ended'&&p.evidence==='playback-observation-only','playback observation contract mismatch');
    } else check(p.source==='browser-tts'&&p.mediaRef===null&&p.allowedCommand==='reveal'&&p.acceptedEvent==='none'&&p.evidence==='unavailable'&&p.revision===r.sourceRevision,'TTS must not claim server playback evidence');
  }
  for(const p of r.speech){
    const asset=c.evidence.speech.find(s=>s.id===p.assetId),node=c.source.teachingNodes.find(n=>n.id===p.nodeId);
    check(!!asset&&!!node&&node.script_version_id===p.scriptVersionId&&asset.script_node_id===p.nodeId&&asset.segment_index===p.segment&&asset.locale===p.locale&&
      asset.content_hash===p.contentHash&&digest(asset.cue_timeline)===p.timelineHash&&asset.duration_ms===p.durationMs&&
      p.authorization==='active-user-published-or-platform-owner'&&m.teachingRefs.some(t=>t.revision===p.scriptVersionId)&&verifySpeechSlot(node,asset),'speech node/segment/revision mismatch');
  }
  const speechIds=[...r.speech,...r.speechRejected].map(s=>s.assetId);
  unique(speechIds,'speech coverage');
  check(speechIds.length===c.evidence.speech.length&&c.evidence.speech.every(a=>speechIds.includes(a.id)),'speech coverage missing');
  for(const rejected of r.speechRejected)check(c.evidence.speech.some(a=>a.id===rejected.assetId&&a.script_node_id===rejected.nodeId&&a.segment_index===rejected.segment&&c.source.teachingNodes.some(n=>n.id===a.script_node_id&&!verifySpeechSlot(n,a)))&&rejected.reason==='text-hash-or-timeline-mismatch','speech rejection evidence mismatch');
  if(c.finalProof)errors.push(...validateFinalProof(c.source,c.evidence,{manifest:m,bindings:b,report:{sourceRevision:c.sourceRevision}},c.finalProof.tts,c.finalProof.speech));
  return errors;
}
