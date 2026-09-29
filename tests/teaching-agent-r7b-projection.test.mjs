import assert from 'node:assert/strict';
import test from 'node:test';
import {manifest,projectionInput} from './fixtures/teaching-agent-r7b/fixture.server.mjs';
import {validateLessonManifestV1} from '../src/lib/smart-textbook-runtime-v1/validator.ts';
const {projectFrozenExecution}=await import('../src/features/smart-textbook-runtime/server/native-execution-projection.server.ts');
import {validateRuntimeActivation,executableCapabilities} from '../src/features/smart-textbook-runtime/core/block-registry.ts';
const copy=()=>structuredClone(manifest);
test('R7B native frozen projection uses existing V1 validator and declared renderer capabilities',()=>{
 assert.equal(validateRuntimeActivation(manifest).success,true);assert.equal(manifest.compatibility.profile,'native');assert.equal(manifest.schemaVersion,'1.0.0');
 assert.equal(manifest.blocks.find(b=>b.type==='text').props.paragraphs[0]['ko-KR'],projectionInput.node5.text);
 assert.deepEqual(manifest.execution.sourceNodes.map(n=>n.nodeNumber),[5,7]);assert.equal(manifest.activityRefs.length,1);assert.equal(manifest.activityRefs[0].type,'single_choice');
 assert.equal(manifest.activityRefs[0].publicPresentation.prompt['zh-CN'],'哪个是元音？');assert.equal(manifest.blocks.filter(b=>b.type==='multiple_choice').length,1);
 assert.equal(projectFrozenExecution(projectionInput).snapshot.contentDigest,manifest.snapshot.contentDigest);
});
test('R7B public projection excludes private answers and complete authoring practice',()=>{
 const serialized=JSON.stringify(manifest);assert.doesNotMatch(serialized,/answerKey|correctAnswer|correctIndex|正确答案|privateAnswer|GRADER|练习2|ㄱ \+ ㅏ 组成/);
 assert.deepEqual(manifest.activityRefs[0].publicPresentation.options.map(o=>o.text['zh-CN']),['ㄱ','ㅏ','ㄴ']);
 const bad=copy();bad.activityRefs[0].answer_key=1;assert.equal(validateLessonManifestV1(bad).success,false);
});
for(const [name,mutate] of Object.entries({
 unknownAction:m=>m.execution.cues[0].action='eval',negativeTime:m=>m.execution.cues[0].triggerTime=-1,nan:m=>m.execution.cues[0].triggerTime=NaN,afterDuration:m=>m.execution.cues[0].triggerTime=31,
 wrongSource:m=>m.execution.cues[0].sourceBlockId='absent',wrongTarget:m=>m.execution.cues[0].targetBlockId='node5-text',wrongStep:m=>m.execution.cues[0].stepId='absent',wrongMedia:m=>m.execution.cues[0].mediaRevision='wrong',badPolicy:m=>m.execution.cues[0].resumePolicy='always',domSelector:m=>m.execution.cues[0].selector='#x',duplicate:m=>m.execution.cues.push(structuredClone(m.execution.cues[0])),missingCapability:m=>m.requiredCapabilities=m.requiredCapabilities.filter(x=>x!=='timeline.cue.v1'),wrongActivity:m=>m.activityRefs[0].type='multiple_choice',
}))test(`R7B cue validation fail closed: ${name}`,()=>{const m=copy();mutate(m);assert.equal(validateLessonManifestV1(m).success,false);});
test('R7B missing video capability fails activation',()=>assert.equal(validateLessonManifestV1(manifest,{supportedCapabilities:executableCapabilities.filter(c=>c!=='block.video')}).success,false));
