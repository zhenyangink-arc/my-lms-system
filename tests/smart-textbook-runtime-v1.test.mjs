import assert from 'node:assert/strict';
import test from 'node:test';
import { validateLessonManifestV1 } from '../src/lib/smart-textbook-runtime-v1/validator.ts';
import { blockRegistryV1, declaredPartIds, executableCapabilitiesV1 } from '../src/lib/smart-textbook-runtime-v1/registry.ts';
import { makeRuntimeTarget, parseRuntimeTarget, isStableId } from '../src/lib/smart-textbook-runtime-v1/targets.ts';
import { runtimeContextSchema, blockTypes } from '../src/lib/smart-textbook-runtime-v1/contracts.ts';
import { validFixtures, invalidFixtures, chapterOne, provenance, registryProps, blockManifest } from './fixtures/smart-textbook-runtime-v1/samples.mjs';
import { fixtureDigest } from './fixtures/smart-textbook-runtime-v1/digest.mjs';

for (const [name,m] of Object.entries(validFixtures)) test(`valid fixture: ${name}`,()=>{ const r=validateLessonManifestV1(m);assert.equal(r.success,true,JSON.stringify(r)); });
for (const [name,m] of Object.entries(invalidFixtures)) test(`invalid fixture rejected: ${name}`,()=>{ const r=validateLessonManifestV1(m);assert.equal(r.success,false);assert.ok(r.issues.length); });
for (const type of blockTypes) {
  test(`registry closed props and full manifest: ${type}`,()=>{
    const entry=blockRegistryV1[type]; assert.equal(entry.type,type);assert.equal(entry.renderer,'unimplemented');assert.equal(entry.dispose,'unimplemented');
    assert.equal(entry.propsValidator.safeParse(registryProps[type]).success,true);
    assert.equal(entry.propsValidator.safeParse({...registryProps[type],unknown:1}).success,false);
    assert.equal(entry.propsValidator.safeParse({}).success,false);
    const r=validateLessonManifestV1(blockManifest(type));assert.equal(r.success,true,JSON.stringify(r));
    const m=blockManifest(type),b=m.blocks[0];
    for (const partId of declaredPartIds(b)) m.runtimeTargets.push({...m.runtimeTargets[0],id:makeRuntimeTarget(b.stepId,b.id,partId),partId});
    assert.equal(validateLessonManifestV1(m).success,true);
  });
}
test('exact registry contract surface; no renderer claims',()=>{assert.equal(blockTypes.length,25);assert.deepEqual(Object.keys(registryProps).sort(),[...blockTypes].sort());assert.deepEqual(executableCapabilitiesV1,[]);assert.equal(validateLessonManifestV1(chapterOne,{supportedCapabilities:executableCapabilitiesV1}).success,false);});
test('real chapter inventory: 8 Steps, 19 activities, all three orientation questions',()=>{
  assert.deepEqual(chapterOne.steps.map(s=>s.key),['orientation','vocabulary','grammar','patterns','dialogue','listen_speak','read_write','review']);
  assert.equal(chapterOne.activityRefs.length,19);
  assert.deepEqual(chapterOne.activityRefs.map(a=>a.activityId).sort(),provenance.sourceInventory.flatMap(s=>s.activities.map(a=>a.id)).sort());
  const orientation=chapterOne.steps[0],questions=chapterOne.blocks.filter(b=>b.stepId===orientation.id&&b.type==='multiple_choice');
  assert.deepEqual(questions.map(b=>b.props.activityRef),['aafa6ccc-4d4a-4dba-9315-2f30381e8a13','6c8f70d4-a9be-4d58-b431-fa966b60f463','cb3f6d75-4a6a-4610-84dc-7d19db6ef3a5']);
  for(const b of questions) assert.equal(chapterOne.activityRefs.find(a=>a.id===b.props.activityRef).publicPresentation.options.length,4);
  assert.equal(chapterOne.teachingRefs.length,1);assert.equal(chapterOne.teachingRefs[0].mode,'legacy');assert.equal(chapterOne.teachingRefs[0].revision,'feb30ba7-0a5e-4e9f-83e6-8970f715ddd5');
  assert.equal(chapterOne.blocks.filter(b=>b.type==='compat.teacher.v1').length,1);assert.equal(chapterOne.blocks.some(b=>b.type==='video'),false);assert.equal(chapterOne.mediaRefs.some(r=>r.kind==='video'),false);
  assert.equal(provenance.publishedScript.nodeCount,8);assert.equal(provenance.publishedScript.teacherVideoCount,0);
  assert.equal(/answer_key|object_key|service_role|privateTranscript|"transcript"|"answers"/i.test(JSON.stringify(chapterOne)),false);
});
test('target roundtrip / stable under display changes',()=>{const t=makeRuntimeTarget('s-persisted','b-persisted','p-persisted');assert.deepEqual(parseRuntimeTarget(t),{stepId:'s-persisted',blockId:'b-persisted',partId:'p-persisted'});assert.deepEqual(parseRuntimeTarget(makeRuntimeTarget('s','b')),{stepId:'s',blockId:'b',partId:null}); const m=structuredClone(chapterOne);m.steps[0].title={'zh-CN':'新标题'};assert.deepEqual(m.runtimeTargets,chapterOne.runtimeTargets);});
for (const value of ['',null,'#node','div.main > button','step:s/block:b/part:p/child:x','step:s/block:b?x=1','step:s/block:b/part:','step:s/block:../b','step:%73/block:b','step:s/block:b\n']) test(`invalid target ${JSON.stringify(value)}`,()=>assert.equal(parseRuntimeTarget(value),null));
test('target builders reject invalid identity',()=>{for(const v of ['a/b','#id','title with space','a:b','',null]){assert.equal(isStableId(v),false);assert.throws(()=>makeRuntimeTarget(v,'b'));}});
test('draft context cannot track; strict fields',()=>{const c={runtimeSessionId:'session',snapshotId:'snapshot',sourceState:'draft',trackingDisabled:true,locale:'zh-CN',supportMode:'chinese'};assert.equal(runtimeContextSchema.safeParse(c).success,true);assert.equal(runtimeContextSchema.safeParse({...c,trackingDisabled:false}).success,false);assert.equal(runtimeContextSchema.safeParse({...c,service_role:'x'}).success,false);});
test('external bindings are explicit, unresolved references fail strict binding validation',()=>{assert.equal(validateLessonManifestV1(chapterOne,{requireBindings:true}).success,false);const resolveBinding=(kind,ref,ownerRef)=>provenance.bindings.some(b=>b.kind===kind&&b.ref===ref&&b.ownerRef===ownerRef);assert.equal(validateLessonManifestV1(chapterOne,{requireBindings:true,resolveBinding}).success,true);assert.equal(validateLessonManifestV1(chapterOne,{resolveBinding:()=>false}).success,false);});
test('future video remains pending draft, never accepted as published',()=>{assert.equal(validateLessonManifestV1(validFixtures.futureVideoDraft,{published:true}).success,false);});
test('bounded safe AST; reject raw attributes and deeply nested documents',()=>{const m=blockManifest('rich_text');m.blocks[0].props.document=[{kind:'paragraph',children:[{kind:'text',text:'safe',onclick:'evil'}]}];assert.equal(validateLessonManifestV1(m).success,false);let node={kind:'text',text:'safe'};for(let i=0;i<5;i++)node={kind:'paragraph',children:[node]};m.blocks[0].props.document=[node];assert.equal(validateLessonManifestV1(m).success,false);});
test('cyclic/non JSON/oversized-depth input fails without throwing',()=>{const m=structuredClone(chapterOne);m.loop=m;assert.equal(validateLessonManifestV1(m).success,false);assert.equal(validateLessonManifestV1(new Date()).success,false);});
test('fixture digest reflects public content, not snapshot metadata',()=>{assert.equal(chapterOne.snapshot.contentDigest,fixtureDigest(chapterOne));const m=structuredClone(chapterOne);m.snapshot.id='other';assert.equal(fixtureDigest(m),fixtureDigest(chapterOne));m.chapter.title={'zh-CN':'已变更'};assert.notEqual(fixtureDigest(m),fixtureDigest(chapterOne));});
test('only media-bearing part can play; plain text cannot submit evidence',()=>{
  const m=blockManifest('dialogue'),b=m.blocks[0];b.props.groups[0].lines.push({id:'silent',speaker:{'zh-CN':'学生'},text:{'ko-KR':'안녕'}});b.props.groups[0].lines[0].mediaRef='audio-a';
  const target={...m.runtimeTargets[0],id:makeRuntimeTarget(b.stepId,b.id,'line-a'),partId:'line-a',capabilities:['play'],acceptedEvents:['media-ended'],verification:'playback-observation'};m.runtimeTargets.push(target);assert.equal(validateLessonManifestV1(m).success,true);
  target.id=makeRuntimeTarget(b.stepId,b.id,'silent');target.partId='silent';assert.equal(validateLessonManifestV1(m).success,false);
  const text=blockManifest('text');text.runtimeTargets[0].acceptedEvents=['response-submitted'];text.runtimeTargets[0].verification='server-attempt';assert.equal(validateLessonManifestV1(text).success,false);
});
test('every source activity has exactly one learning owner and each Step has a scoped capsule',()=>{
  for(const a of chapterOne.activityRefs){const owners=chapterOne.blocks.filter(b=>b.props.activityRef===a.id || b.props.activityRefs?.includes(a.id));assert.equal(owners.length,1,a.id);}
  for(const s of chapterOne.steps){const capsule=chapterOne.blocks.find(b=>b.stepId===s.id&&b.type==='compat.learning.v1');assert.ok(capsule);assert.ok(capsule.props.parts.length);}
  const dialogue=chapterOne.blocks.find(b=>b.type==='dialogue');assert.equal(dialogue.props.groups.length,4);assert.equal(dialogue.props.groups.flatMap(g=>g.lines).length,14);
});
