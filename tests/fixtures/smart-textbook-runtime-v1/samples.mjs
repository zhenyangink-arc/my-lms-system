import { readFileSync } from 'node:fs';
export const chapterOne = JSON.parse(readFileSync(new URL('./chapter-one.legacy.json', import.meta.url), 'utf8'));
export const provenance = JSON.parse(readFileSync(new URL('./chapter-one.provenance.json', import.meta.url), 'utf8'));
const L = { 'zh-CN': '学习内容', 'ko-KR': '학습 내용' };
const panel = { id: 'panel-a', title: L };
const line = { id: 'line-a', speaker: L, text: L };
const group = { id: 'group-a', title: L, lines: [line] };
const track = { id: 'track-a', segments: [{ id: 'segment-a', text: L, mediaRef: 'audio-a' }] };
/** Synthetic contract examples; never represented as published Chapter 1 content. */
export const registryProps = {
  video: { mediaRef: 'video-a', role: 'teacher', fallback: 'retry', startPaused: true },
  image: { mediaRef: 'image-a', alt: L, fit: 'contain' },
  text: { paragraphs: [L] },
  rich_text: { document: [{ kind: 'paragraph', children: [{ kind: 'text', text: '学习' }] }] },
  audio: { mediaRef: 'audio-a' },
  dialogue: { groups: [group] },
  multiple_choice: { activityRef: 'activity-a', presentation: 'single' },
  multiple_select: { activityRef: 'activity-a', presentation: 'single' },
  fill_blank: { activityRef: 'activity-a', presentation: 'inline' },
  ordering: { activityRef: 'activity-a', presentation: 'list' },
  listening: { activityRef: 'activity-a', tracks: [{ id: 'track-a', mediaRef: 'audio-a', exercisePartIds: ['exercise-a'] }], playbackPolicyRef: 'policy-a' },
  shadowing: { practiceRef: 'practice-a', tracks: [track] },
  pronunciation: { activityRef: 'activity-a', modelMediaRef: 'audio-a', rubric: [L] },
  role_play: { activityRef: 'activity-a', scenes: [{ id: 'scene-a', roles: [panel], turns: [line] }], recognition: 'optional' },
  writing: { activityRef: 'activity-a', scaffold: [L], rubric: [L] },
  self_check: { activityRef: 'activity-a', returnTargets: [] },
  supplemental_visual: { slides: [{ id: 'slide-a', title: L, items: [{ kind: 'text', texts: [L] }] }] },
  vocabulary_practice: { entries: [{ id: 'word-a', word: L, meaning: L }], activityRefs: [], panels: [panel] },
  grammar_practice: { sections: [{ id: 'section-a', title: L, explanation: L, examples: [] }], activityRefs: [], panels: [panel] },
  pattern_practice: { patterns: [{ id: 'pattern-a', text: L }], groups: [group], activityRefs: [], panels: [panel] },
  listen_speak: { listeningRef: 'listening-a', speakingRef: 'speaking-a', practiceRef: 'practice-a', tracks: [track], panels: [panel] },
  read_write: { readingRef: 'reading-a', writingRef: 'writing-a', source: [L], scaffold: [], panels: [panel] },
  review: { activityRefs: [], progressRefs: [], returnTargets: [], panels: [panel] },
  'compat.teacher.v1': { teachingRef: 'teaching-a', capsuleRef: 'capsule-a' },
  'compat.learning.v1': { capsuleRef: 'capsule-a', activityRefs: [], progressRefs: [], parts: [panel] },
};
export function minimalManifest() {
  const m = structuredClone(chapterOne);
  m.compatibility = { profile: 'native', adapterRevision: null };
  const step = m.steps[0];
  const block = m.blocks.find(b => b.type === 'text');
  step.completion = { kind: 'none' }; step.nextStep = null; step.teachingRef = null;
  block.order = 1;
  step.regions = [{ region: 'interaction.main', blockIds: [block.id] }];
  m.steps = [step]; m.blocks = [block]; m.teachingRefs = []; m.activityRefs = []; m.mediaRefs = [];
  m.progressRefs = m.progressRefs.filter(p => p.kind === 'chapter');
  m.regions.find(r => r.id === 'teaching').allowedBlockTypes = [];
  m.regions.find(r => r.id === 'interaction.main').allowedBlockTypes = ['text'];
  m.runtimeTargets = m.runtimeTargets.filter(t => t.blockId === block.id);
  m.navigation.items = [step.id];
  m.requiredCapabilities = ['layout.v1','navigation.linear.v1','progress.server.v1','block.text'];
  return m;
}
export function blockManifest(type) {
  const m = minimalManifest(), b = m.blocks[0]; b.type = type; b.props = structuredClone(registryProps[type]);
  const region = type === 'compat.teacher.v1' || type === 'video' ? 'teaching' : 'interaction.main';
  b.region = region; m.steps[0].regions = [{ region, blockIds: [b.id] }];
  for (const r of m.regions) r.allowedBlockTypes = r.id === region ? [type] : [];
  m.requiredCapabilities = ['layout.v1','navigation.linear.v1','progress.server.v1',`block.${type}`];
  m.mediaRefs = ['audio','video','image','captions'].map(kind => ({ id:`${kind}-a`,kind,revision:'sample-v1',readiness:'pending',access:'lesson',language:null,alt:L }));
  const types = { multiple_choice:'single_choice',multiple_select:'multiple_choice',fill_blank:'fill_blank',ordering:'ordering',listening:'listening',pronunciation:'speaking',role_play:'speaking',writing:'writing',self_check:'self_check' };
  const makeActivity = (id,type) => ({ id,activityId:id,revision:'sample-v1',type,publicPresentation:{prompt:L,instruction:L,options:[],settings:['single_choice','multiple_choice','ordering'].includes(type)?{shuffle:false,showScore:false}:['speaking','writing'].includes(type)?{rubric:[]}:type==='self_check'?{items:[]}:{showScore:false}} });
  m.activityRefs = [makeActivity('activity-a',types[type] ?? 'single_choice'),makeActivity('listening-a','listening'),makeActivity('speaking-a','speaking'),makeActivity('reading-a','single_choice'),makeActivity('writing-a','writing')];
  m.progressRefs.push({id:'practice-a',kind:'guided-repeat'});
  if (type.startsWith('compat.')) m.compatibility = {profile:'legacy-adapted',adapterRevision:'sample-v1'};
  if (type === 'compat.teacher.v1' || type === 'video') {
    m.teachingRefs = [{id:'teaching-a',revision:'sample-v1',mode:type==='video'?'video-first':'legacy',entryCueId:'cue-a'}];
    m.steps[0].teachingRef = 'teaching-a';
  }
  return m;
}
export const validFixtures = {
  minimal: minimalManifest(),
  chapterOne,
  legacyTeaching: blockManifest('compat.teacher.v1'),
  composite: blockManifest('dialogue'),
  futureVideoDraft: blockManifest('video'),
};
export const invalidMutations = {
  duplicateStep: m => m.steps.push(structuredClone(m.steps[0])),
  duplicateBlock: m => m.blocks.push(structuredClone(m.blocks[0])),
  missingActivity: m => { m.blocks.find(b=>b.type==='multiple_choice').props.activityRef='absent'; },
  missingMedia: m => { const b=m.blocks.find(b=>b.type==='text'); b.type='image';b.props={mediaRef:'absent',alt:L,fit:'contain'};m.requiredCapabilities.push('block.image');m.regions.find(r=>r.id==='interaction.main').allowedBlockTypes.push('image'); },
  missingBlock: m => m.steps[0].regions[0].blockIds.push('absent'),
  illegalRegion: m => { m.blocks.find(b=>b.type==='multiple_choice').region='teaching'; },
  infiniteRegion: m => m.regions.push({id:'interaction.main.child',role:'main',parent:'interaction.main',content:'blocks',allowedBlockTypes:[]}),
  missingNext: m => { m.steps[0].nextStep='absent'; },
  targetMismatch: m => { m.runtimeTargets[0].blockId='absent'; },
  answerKey: m => { m.activityRefs[0].answer_key=0; },
  objectKey: m => { m.blocks[0].props.object_key='private/object.mp4'; },
  html: m => { m.blocks.find(b=>b.type==='text').props.paragraphs=[{'zh-CN':'<img src=x onerror=alert(1)>'}]; },
  js: m => { m.blocks.find(b=>b.type==='text').props.paragraphs=[{'zh-CN':'javascript:alert(1)'}]; },
  css: m => { m.blocks.find(b=>b.type==='text').props.paragraphs=[{'zh-CN':'body { display: none; }'}]; },
  unknownCapability: m => m.requiredCapabilities.push('unknown-capability'),
  missingCapability: m => { m.requiredCapabilities=[]; },
  schemaVersion: m => { m.schemaVersion='2.0.0'; },
  runtimeContract: m => { m.runtimeContract='uply-runtime/2'; },
  unknownField: m => { m.layout.width=40; },
  missingField: m => { delete m.template; },
  duplicateStepOrder: m => { m.steps[1].order=m.steps[0].order; },
  duplicateBlockOrder: m => { m.blocks.find(b=>b.type==='dialogue').order=m.blocks.find(b=>b.type==='text').order; },
  missingStep: m => { m.blocks[0].stepId='absent'; },
  missingProgress: m => { m.completion.chapterPolicyRef='absent'; },
  missingTeaching: m => { m.steps[0].teachingRef='absent'; },
  wrongActivityType: m => { m.blocks.find(b=>b.type==='multiple_choice').props.activityRef=m.activityRefs.find(a=>a.type==='writing').id; },
  unknownBlockType: m => { m.blocks[0].type='arbitrary'; },
  missingRootTarget: m => { m.runtimeTargets.shift(); },
  unknownPart: m => { const t=structuredClone(m.runtimeTargets[0]);t.partId='absent';t.id+='/part:absent';m.runtimeTargets.push(t); },
  navigation: m => { m.navigation.items.reverse(); },
  secretTranscript: m => { m.blocks[0].props.transcript='restricted'; },
  clientCompletion: m => { m.steps[0].completion={kind:'client',score:100}; },
  uiSubmission: m => { m.runtimeTargets.find(t=>t.verification==='server-attempt').verification='ui-only'; },
};
export const invalidFixtures = Object.fromEntries(Object.entries(invalidMutations).map(([key,mutate]) => {const m=structuredClone(chapterOne);mutate(m);return[key,m];}));
