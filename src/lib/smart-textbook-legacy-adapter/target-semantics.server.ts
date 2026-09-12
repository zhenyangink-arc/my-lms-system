import 'server-only';
import type { LessonManifestV1, RuntimeTargetV1 } from '../smart-textbook-runtime-v1/contracts.ts';
import type { PrivateBindings } from './capsules.server.ts';

type Command = RuntimeTargetV1['capabilities'][number];
export type TargetSemantic = {
  address:string; sourceFamily:string; sourcePath:string|null;
  classification:'identity-only'|'executable-required'|'executable-conditional'|'unreachable-invalid';
  capabilities:Command[]; evidence:string; requiredOwnerState:string;
};
const locate:Command[]=['reveal','focus','highlight'];
// These are closed legacy field paths, NOT titles, DOM selectors or IDs made
// from an array position. Frozen paths only resolve existing persistent parts.
const passiveArrays = new Set([
  'content.grammarCards[].rules[]',
  'content.dialogueFlow[].words[]','content.dialogueScenes[].lines[].words[]',
  'content.dialogueScenes[].coverage[]','content.repeatTracks[].keywords[]',
  'content.listenFor[]','content.listeningFocus[]','content.outputChecklist[]',
  'content.speakingCriteria[]','content.rubric[]','content.questions[]','content.checklist[]','content.listenSpeakPages[]',
]);
const speechArrays = new Set([
  'content.targets[]','content.vocabulary[]','content.grammarCards[].examples[]',
  'content.patternCards[].examples[]','content.quickResponse[]','content.personalOutput[]',
  'content.substitutions[]','content.substitutionGroups[][]',
  'content.dialogueGroups[].lines[]',
  'content.repeatLines[]','content.repeatTracks[].lines[]',
]);
const selectionArrays = new Set([
  'content.dialogueGroups[]','content.grammarCards[]','content.patternCards[]',
  'content.substitutionGroups[]','content.dialogueScenes[]','content.dialogueScenes[].lines[]',
  'content.repeatTracks[]','content.dialogueFlow[]',
]);
const passiveSlots = new Set([
  'lead','coach','targets','completion','vocabulary','grammarCards','pattern',
  'patternCards','quickResponse','substitutions','personalOutput','substitutionGroups',
  'dialogueGroups','dialogueFlow','dialogueScenes','listenFor','repeatLines',
  'listeningFocus','outputChecklist','listenSpeakPages','listeningContext','speakingCriteria',
  'formalAudioStatus','rubric','reading','questions','writingFrame','originalExample','checklist','returnMap',
]);

/** Explicit first-chapter projection; unknown paths fail closed rather than
 * being declared commandless. The result is a private audit DTO, not new schema. */
export function learningTargetSemantics(m:LessonManifestV1,b:PrivateBindings):TargetSemantic[] {
  return m.runtimeTargets.filter(t=>m.blocks.some(block=>block.id===t.blockId&&block.type==='compat.learning.v1')).map(t=>{
    const c=b.capsules.find(c=>c.kind==='learning'&&c.stepId===t.stepId);
    if(!c||c.kind!=='learning')throw Error('TARGET_CAPSULE_MISSING');
    const identity=b.identities.find(i=>i.partId===t.partId);
    const path=identity?.legacyPath??null, family=path?.replace(/\[\d+\]/g,'[]');
    const slot=c.sections.find(s=>s.partId===t.partId);
    const aliases=b.aliases.filter(a=>a.target===t.id);
    const result=(sourceFamily:string,classification:TargetSemantic['classification'],capabilities:Command[],evidence:string,requiredOwnerState:string):TargetSemantic=>({address:t.id,sourceFamily,sourcePath:path??(slot?`content.${slot.slot}`:null),classification,capabilities:[...capabilities],evidence,requiredOwnerState});
    if(!t.partId)return result('block/activity','executable-required',locate,'smart-textbook-learning-targets.ts activity aliases; old Shell prepareLearningTarget','active Step; requested child activity');
    if(c.panels.some(p=>p.id===t.partId))return result('panel','executable-conditional',locate,'profile.pages + old prepareLearningTarget module:page','requested panel in active Step');
    if(aliases.some(a=>a.event==='audio_completed'))return result('orientation-dialogue-task','executable-conditional',[...locate,'play'],'old ContentRenderer dialogue TTS; Phase 3D authorized observation binding','active dialogue group; mounted authorized TTS owner');
    if(slot?.slot==='nextNode')return slot.body==='chapter-test:korean-level-one-01'
      ?result('chapter-test','executable-required',[...locate,'open'],'learning-tools.server.ts openLearningDestination; server chapter completion','review; authorized internal destination')
      :result('linear-next-node','identity-only',[],'Step.nextStep/StepController own linear navigation; metadata slot is not a second navigation control','none');
    if(slot?.slot==='speakingFrame'||slot?.slot==='repeatTracks')return result(slot.slot,'executable-conditional',locate,'recording-binding.server.ts / GuidedRepeatExecutor scoped controls','speaking activity or repeat panel');
    if(slot&&passiveSlots.has(slot.slot))return result('content-container','identity-only',[],'closed contentSectionSchema; old ContentRenderer renders descendants, no independent slot command; child owners preserved','none');
    if(family==='content.returnMap[]')return result('review-return','executable-required',[...locate,'open'],'learningTools.returnMap + openLearningDestination','review return control');
    if(family&&speechArrays.has(family))return result(family,'executable-conditional',[...locate,'play'],'old ContentRenderer / ListenSpeakLearningPanel speakKorean controls; exact frozen learning text','corresponding card/line visible; real speech owner');
    if(family&&selectionArrays.has(family))return result(family,'executable-conditional',locate,'old ContentRenderer selection controls / DialogueRoleplayPractice / RecordingExecutor','selected card, scene, student turn or track');
    if(family&&passiveArrays.has(family))return result(family,'identity-only',[],'closed content DTO: descriptive text/rule/word/coverage/rubric; parent interaction owns behavior, no independent legacy command','none');
    if(family==='public_config.items[]')return result('activity-page-item','executable-conditional',locate,'frozen activity-page mapping; ActivityPageExecutor question positioning','selected activity and historical page/item');
    if(!identity&&b.progress.some(p=>p.kind==='activity-page'&&p.sourceId===c.nodeId&&p.partIds.includes(t.partId!)))return result('activity-page','executable-conditional',c.activities.some(a=>a.activityKey==='listening-identity')?[...locate,'play']:locate,'readiness.addPart frozen page/progress membership; activity page navigation; listening media owner','selected grammar/listening activity page');
    return result(family??slot?.slot??'unknown','unreachable-invalid',locate,'Unknown semantic family: retain commands and block, never default to identity-only','unresolved');
  });
}

export function projectLearningTargetCapabilities(m:LessonManifestV1,b:PrivateBindings) {
  const rows=learningTargetSemantics(m,b);
  for(const row of rows){
    const target=m.runtimeTargets.find(t=>t.id===row.address)!;
    target.capabilities=[...row.capabilities];
    target.acceptedEvents=target.capabilities.length?['opened']:[];
    target.verification='ui-only';
  }
  return rows;
}
