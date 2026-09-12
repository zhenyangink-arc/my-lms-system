import {previousTargetContractDigest} from './fixtures/runtime-target-contract-history.mjs';
import './fixtures/smart-textbook-legacy-adapter/register-server-only.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
// Dynamic imports let the offline server marker hook load before the private modules.
const {default:source}=await import('./fixtures/smart-textbook-legacy-adapter/chapter-one-source.server.ts');
const {default:ledger}=await import('./fixtures/smart-textbook-legacy-adapter/chapter-one-identities.server.ts');
const {adaptChapterOne}=await import('../src/lib/smart-textbook-legacy-adapter/adapter.server.ts');
const {validatePrivateBindings}=await import('../src/lib/smart-textbook-legacy-adapter/bindings.server.ts');
const {capsuleSchema}=await import('../src/lib/smart-textbook-legacy-adapter/capsules.server.ts');
const {walkIdentities,digest,rebindLegacyIdentity}=await import('../src/lib/smart-textbook-legacy-adapter/identity.server.ts');
const {profile}=await import('../src/lib/smart-textbook-legacy-adapter/profile.server.ts');
const {validateLessonManifestV1}=await import('../src/lib/smart-textbook-runtime-v1/validator.ts');
const {readChapterOneLegacySource}=await import('../src/lib/smart-textbook-legacy-adapter/reader.server.ts');
const baseline=adaptChapterOne(source,ledger);
const capsuleFor=key=>baseline.bindings.capsules.find(c=>c.kind==='learning'&&c.nodeId===profile[key].nodeId);
const section=(key,slot)=>capsuleFor(key).sections.find(s=>s.slot===slot).body;

test('real adapter yields a valid candidate, not Runtime-ready',()=>{
  assert.ok(baseline.manifest);assert.equal(validateLessonManifestV1(baseline.manifest).success,true);
  assert.equal(baseline.report.runtimeReady,false);assert.ok(baseline.report.unsupported.length>0);
  assert.deepEqual(validatePrivateBindings(baseline.manifest,baseline.bindings),[]);
});
test('all eight Steps and student title overrides, source order, panel/slot information',()=>{
  assert.deepEqual(baseline.manifest.steps.map(s=>s.key),Object.keys(profile));
  for(const s of baseline.manifest.steps){const p=profile[s.key],c=capsuleFor(s.key);assert.equal(s.id,p.moduleId);assert.deepEqual(s.title,p.title);assert.deepEqual(c.panels.map(p=>p.legacyPageKey),[...p.pages]);assert.deepEqual(c.contentSlots,[...p.contentSlots]);assert.deepEqual(c.activitySlots,[...p.activitySlots]);}
});
test('all nineteen activities and exactly three real orientation single-choice Blocks',()=>{
  assert.equal(baseline.report.activitiesScanned,19);assert.deepEqual(baseline.manifest.activityRefs.map(a=>a.activityId).sort(),source.activities.map(a=>a.id).sort());
  const questions=baseline.manifest.blocks.filter(b=>b.type==='multiple_choice');assert.equal(questions.length,3);
  assert.deepEqual(questions.map(b=>b.props.activityRef).sort(),profile.orientation.activities.map(a=>a.id).sort());
  for(const b of questions){const a=source.activities.find(a=>a.id===b.props.activityRef),ref=baseline.manifest.activityRefs.find(a=>a.id===b.props.activityRef);assert.deepEqual(ref.publicPresentation.options.map(o=>o.text['ko-KR']),a.options);assert.equal(ref.publicPresentation.settings.showScore,false);}
});
for(const key of Object.keys(profile))test(`all node fields roundtrip through closed per-Step DTO: ${key}`,()=>{
  const original=source.nodes.find(n=>n.id===profile[key].nodeId),c=capsuleFor(key);
  assert.deepEqual(Object.fromEntries(c.sections.map(s=>[s.slot,s.body])),original.content);
  assert.equal(capsuleSchema.safeParse(c).success,true);
  assert.equal(capsuleSchema.safeParse({...c,shellState:{}}).success,false);
  for(const a of c.activities)assert.deepEqual(a.settings,source.activities.find(x=>x.id===a.activityId).public_config);
});
test('dialogueGroups 4/14 lines and dialogueScenes 2/14 lines complete',()=>{
  assert.equal(section('orientation','dialogueGroups').length,4);assert.equal(section('orientation','dialogueGroups').flatMap(g=>g.lines).length,14);
  assert.equal(section('dialogue','dialogueScenes').length,2);assert.equal(section('dialogue','dialogueScenes').flatMap(g=>g.lines).length,14);
});
test('vocabulary twelve words and grammar three cards/nine audio references',()=>{
  assert.equal(section('vocabulary','vocabulary').length,12);assert.equal(section('grammar','grammarCards').length,3);assert.equal(baseline.report.mediaScanned.grammarAudio,9);
  const node=source.nodes.find(n=>n.id===profile.grammar.nodeId);for(const c of node.content.grammarCards)for(const e of c.examples)assert.ok(baseline.bindings.mediaMetadata.some(m=>m.assetKey===e.audioId));
});
test('pattern special keys keep conversation/composition/path semantics',()=>{
  const c=capsuleFor('patterns');assert.deepEqual(c.activities.map(a=>a.activityKey).sort(),['pattern-choice','pattern-compose','pattern-order']);
  assert.equal(c.activities.find(a=>a.activityKey==='pattern-choice').settings.conversation.steps.length,8);
  assert.equal(c.activities.find(a=>a.activityKey==='pattern-compose').settings.composition.steps.length,6);
});
test('listening tracks / guided repeat / speaking / role play dependencies',()=>{
  assert.equal(baseline.bindings.listening.length,2);assert.equal(new Set(baseline.bindings.listening.map(t=>t.ref)).size,2);
  assert.equal(section('listen_speak','repeatTracks').length,2);assert.equal(section('listen_speak','repeatTracks').flatMap(t=>t.lines).length,14);
  assert.equal(baseline.bindings.recordings.length,2);assert.ok(baseline.bindings.recordings.some(r=>r.practice==='role-play'));
  assert.equal(baseline.report.mediaScanned.assets,73);assert.equal(baseline.report.mediaScanned.speech,44);
});
test('reading/writing/review retain source text, scoring policies and return map',()=>{
  assert.ok(section('read_write','reading'));assert.equal(section('read_write','rubric').length,4);
  assert.equal(capsuleFor('read_write').activities.length,2);assert.equal(capsuleFor('review').activities.length,2);
  assert.equal(section('review','checklist').length,5);assert.equal(section('review','returnMap').length,4);
});
test('all eight published v23 teacher nodes keep character, pose, blackboard and speech',()=>{
  const c=baseline.bindings.capsules.find(c=>c.kind==='teacher');assert.equal(c.nodes.length,8);assert.equal(baseline.report.teachingNodesScanned,8);
  assert.equal(baseline.manifest.teachingRefs[0].revision,'feb30ba7-0a5e-4e9f-83e6-8970f715ddd5');assert.equal(baseline.manifest.teachingRefs[0].mode,'legacy');
  for(const n of c.nodes){assert.ok(n.sections.some(s=>s.kind==='character'));assert.ok(n.sections.some(s=>s.kind==='blackboard'));assert.deepEqual(n.teacherScript,source.teachingNodes.find(s=>s.id===n.id).teacher_script);}
  assert.equal(baseline.manifest.blocks.some(b=>b.type==='video'),false);assert.equal(baseline.manifest.mediaRefs.some(r=>r.kind==='video'),false);
});
test('public Manifest has no private keys, raw configuration, private text or object locations',()=>{
  const serialized=JSON.stringify(baseline.manifest);
  assert.doesNotMatch(serialized,/answer_key|object_key|objectKey|service.role|transcript|teacher_script|scriptPerformances|virtualCharacter|correct_feedback|public_config/);
  for(const m of source.media)if(m.object_key)assert.equal(serialized.includes(m.object_key),false);
  for(const t of source.tracks)if(t.audio_object_key)assert.equal(serialized.includes(t.audio_object_key),false);
});
test('every content/configuration leaf has a Conversion Report classification',()=>{
  const all=[...baseline.report.converted,...baseline.report.preservedInCompat,...baseline.report.ignoredSafe,...baseline.report.unsupported];
  function paths(v,p){return v&&typeof v==='object'?Object.entries(v).flatMap(([k,c])=>paths(c,Array.isArray(v)?`${p}[${k}]`:`${p}.${k}`)):[p]}
  for(const n of source.nodes)for(const path of paths(n.content,'content'))assert.ok(all.some(e=>e.source.nodeId===n.id&&e.source.path===path),`${n.id}:${path}`);
  for(const a of source.activities)for(const path of paths(a.public_config,'public_config'))assert.ok(all.some(e=>e.source.activityId===a.id&&e.source.path===path),`${a.id}:${path}`);
  for(const n of source.teachingNodes)for(const path of paths(n.configuration,'configuration'))assert.ok(all.some(e=>e.source.teachingNodeId===n.id&&e.source.path===path),`${n.id}:${path}`);
});
test('same source/revision yields byte-equal semantic Manifest, identities, report and digest; input unchanged',()=>{
  const before=JSON.stringify(source),again=adaptChapterOne(source,ledger);assert.deepEqual(again,baseline);assert.equal(JSON.stringify(source),before);
  const shuffled=structuredClone(source);for(const key of ['nodes','activities','modules','media','teachingNodes','tracks','speech'])shuffled[key].reverse();assert.deepEqual(adaptChapterOne(shuffled,ledger),baseline);
  const {snapshot,...semantic}=baseline.manifest;assert.equal(snapshot.contentDigest,`sha256:${digest(semantic)}`);
});
test('anonymous vocabulary identities survive reorder; changed content requires explicit rebinding',()=>{
  const n=source.nodes.find(n=>n.id===profile.vocabulary.nodeId);const collect=v=>{const ids=[],errors=[];walkIdentities(n.id,v,'content',ledger,e=>ids.push(e.id),(p,r)=>errors.push({p,r}));return{ids,errors}};
  const copy=structuredClone(n.content);copy.vocabulary.reverse();assert.deepEqual(collect(copy).ids.sort(),collect(n.content).ids.sort());assert.deepEqual(collect(copy).errors,[]);
  copy.vocabulary[0].zh='新释义';assert.ok(collect(copy).errors.length>0);
});
test('explicit rebinding retains identity without allocating from edited title or index',()=>{
  const n=source.nodes.find(n=>n.id===profile.vocabulary.nodeId),word=n.content.vocabulary[0];
  const allocation=ledger.entries.find(e=>e.owner===n.id&&e.collection==='content.vocabulary'&&e.fingerprint===digest(word));
  const edited={...word,zh:'明确修订的释义'};const next=rebindLegacyIdentity(ledger,allocation.id,edited);
  assert.equal(next.entries.find(e=>e.id===allocation.id).fingerprint,digest(edited));
  assert.equal(ledger.entries.find(e=>e.id===allocation.id).fingerprint,digest(word));
  assert.throws(()=>rebindLegacyIdentity(ledger,'missing',edited));
});
test('specific dialogue field report resolves to the same stable part as legacy alias',()=>{
  const line=baseline.report.preservedInCompat.find(e=>e.source.nodeId===profile.orientation.nodeId&&e.source.path==='content.dialogueGroups[0].lines[0]');
  const alias=baseline.bindings.aliases.find(a=>a.legacyKey==='dialogue:greeting:0');
  assert.ok(alias.target.endsWith(`/part:${line.target.part}`));
});
test('frozen conversion summary matches deterministic output including all unsupported items',()=>{
  const summary=JSON.parse(readFileSync(new URL('./fixtures/smart-textbook-legacy-adapter/chapter-one-conversion-summary.json',import.meta.url),'utf8'));
  assert.equal(summary.sourceRevision,baseline.report.sourceRevision);assert.equal(summary.digest,previousTargetContractDigest(baseline.manifest));
  assert.equal(summary.counts.converted,baseline.report.converted.length);assert.equal(summary.counts.preservedInCompat,baseline.report.preservedInCompat.length);
  assert.deepEqual(summary.unsupported,baseline.report.unsupported);
});
const mutateCases={
  unknownModule:[s=>s.modules[0].module_code='unknown',/Unknown or mismatched/],
  unknownNodeKey:[s=>s.nodes[0].content.unrecognized={nested:true},/Unknown content key/],
  unknownNestedField:[s=>s.nodes.find(n=>n.id===profile.vocabulary.nodeId).content.vocabulary[0].html='<b>bad</b>',/closed compatibility DTO/],
  unknownActivityType:[s=>s.activities[0].activity_type='code',/Unsupported activity identity/],
  danglingActivity:[s=>s.activities[0].node_id='missing',/Dangling activity node/],
  missingActivity:[s=>s.activities.pop(),/Missing expected activity/],
  danglingMedia:[s=>s.nodes.find(n=>n.id===profile.grammar.nodeId).content.grammarCards[0].examples[0].audioId='missing',/Unresolved explicit legacy media/],
  mediaWrongNode:[s=>s.media[0].node_id='missing',/Dangling media node/],
  targetUnmapped:[s=>s.teachingNodes.find(n=>n.configuration.visualCue).configuration.visualCue.targetKey='not-a-target',/target cannot be mapped/],
  invalidCompat:[s=>s.nodes.find(n=>n.id===profile.vocabulary.nodeId).content.vocabulary='wrong',/closed compatibility DTO/],
  invalidTeacher:[s=>s.teachingNodes[0].configuration.virtualCharacter='invalid',/Invalid\/unknown teacher/],
  unknownTeacherField:[s=>s.teachingNodes[0].configuration.teacherVideo={mode:'video'},/Invalid\/unknown teacher/],
  badPose:[s=>s.teachingNodes[0].configuration.scriptPerformances[0].pose='evil',/Unsupported character pose/],
  danglingTeacherActivity:[s=>s.teachingNodes[0].reference_activity_id='missing',/Dangling teaching activity/],
  unknownActivityConfig:[s=>s.activities[0].public_config.answer_key='secret',/unknown\/invalid fields/],
  unknownMediaMetadata:[s=>s.media[0].metadata.css='body{}',/Unknown\/invalid media metadata/],
  danglingTrack:[s=>s.tracks[0].activity_id='missing',/Dangling\/non-listening/],
  danglingSpeech:[s=>s.speech[0].script_node_id='missing',/Dangling speech node/],
  otherChapter:[s=>s.chapter.chapter_number=2,/Unsupported chapter/],
};
for(const[name,[mutate,reason]]of Object.entries(mutateCases))test(`unsupported blocks readiness: ${name}`,()=>{
  const s=structuredClone(source);mutate(s);const r=adaptChapterOne(s,ledger);assert.equal(r.report.runtimeReady,false);
  // Assert the new specific failure, not just the baseline false readiness.
  assert.ok(r.report.unsupported.some(e=>reason.test(e.reason)),JSON.stringify(r.report.unsupported));
});
for(const kind of ['progress','media','activities'])test(`private binding cannot dangle: ${kind}`,()=>{
  const b=structuredClone(baseline.bindings);b[kind].shift();assert.ok(validatePrivateBindings(baseline.manifest,b).some(e=>e.startsWith(kind==='activities'?'activity:':`${kind}:`)));
});
test('private target alias cannot dangle',()=>{const b=structuredClone(baseline.bindings);b.aliases[0].target='step:missing/block:missing';assert.ok(validatePrivateBindings(baseline.manifest,b).some(e=>e.startsWith('target:')));});
test('identity ledger missing, duplicate or stale track map is unsupported',()=>{
  const missing=structuredClone(ledger);missing.entries=[];assert.ok(adaptChapterOne(source,missing).report.unsupported.some(e=>/frozen identity/.test(e.reason)));
  const duplicate=structuredClone(ledger);duplicate.entries.push(duplicate.entries[0]);assert.ok(adaptChapterOne(source,duplicate).report.unsupported.some(e=>/Duplicate allocated/.test(e.reason)));
  const track=structuredClone(ledger);track.tracks[0].sourceAudioDigest='changed';assert.ok(adaptChapterOne(source,track).report.unsupported.some(e=>/track needs frozen/.test(e.reason)));
});
test('reader is SELECT-only and returns captured first-chapter source, no env or storage calls',async()=>{
  const map={digital_textbooks:[source.textbook],digital_textbook_versions:[source.version],digital_textbook_chapters:[source.chapter],digital_textbook_modules:source.modules,digital_textbook_nodes:source.nodes,digital_textbook_activities:source.activities,digital_textbook_media_assets:source.media,digital_textbook_listening_tracks:source.tracks,learning_agent_lessons:source.lessons,learning_agent_script_versions:source.teachingVersions,learning_agent_script_nodes:source.teachingNodes,learning_agent_script_audio_assets:source.speech};
  const calls=[];const client={from(table){return{select(columns){calls.push({table,columns});const run=(key,value)=>Promise.resolve({data:map[table].filter(r=>Array.isArray(value)?value.includes(r[key]):r[key]===value),error:null});return{eq:run,in:run}}}}};
  assert.deepEqual(await readChapterOneLegacySource(client),source);assert.equal(calls.length,12);
  assert.equal(calls.some(c=>/secret|attempt|recording|progress/.test(c.table)),false);assert.equal(calls.some(c=>/transcript|answer_key/.test(c.columns)),false);
});
test('server-only boundary in every implementation file, no production import or mutation API',()=>{
  const directory=resolve('src/lib/smart-textbook-legacy-adapter');for(const f of readdirSync(directory)){const text=readFileSync(resolve(directory,f),'utf8');assert.match(text,/import 'server-only'/);assert.doesNotMatch(text,/\.from\([^)]*\)\.(?:insert|update|delete|upsert)|\.rpc\(|createR2Signed|process\.env/);}
  function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(resolve(dir,e.name)):[resolve(dir,e.name)])}
  // Phase 4B1A additionally permits the server-only publication DAL. Compilation
  // remains owner-only there; no student Route or client Runtime imports it.
  const auditGateway=resolve('src/features/smart-textbook-runtime/server');
  const publicationDal=resolve('src/lib/smart-textbook-publishing');
  for(const f of walk(resolve('src')).filter(f=>/\.[cm]?[jt]sx?$/.test(f)&&!f.startsWith(directory))){
    const text=readFileSync(f,'utf8');
    if(f.startsWith(auditGateway)||f.startsWith(publicationDal)){assert.match(text,/^(?:import 'server-only'|'use server')/);continue;}
    assert.doesNotMatch(text,/(?:from\s*|import\s*\()["'][^"']*smart-textbook-legacy-adapter/);
  }
});
