import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {manifest,compiled} from './runtime-4a.mjs';
import {serverModule,teacherSession} from './runtime-4a2.server.mjs';
import {teacherChecks,teacherCapabilityReadiness,teacherImplementationReadiness} from '../../src/features/smart-textbook-runtime/core/teacher-readiness.ts';
import {runtimeReadiness} from '../../src/features/smart-textbook-runtime/core/block-registry.ts';
import {learningCapabilityReadiness} from '../../src/features/smart-textbook-runtime/core/learning-readiness.ts';

// Run AFTER browser witnesses, never concurrently with their producers. All
// evidence is snapshot/revision scoped. Missing files/checks fail, not "skip".
const pre=process.argv.includes('--pre-promotion');
const a=JSON.parse(await readFile('/tmp/uply-runtime-4a14-mounted.json','utf8'));
const p=JSON.parse(await readFile(`/tmp/uply-runtime-4a15-${pre?'implementation':'complete'}.json`,'utf8'));
for(const row of [a,p]){assert.equal(row.snapshotId,manifest.snapshot.id);assert.equal(row.teachingRevision,manifest.teachingRefs[0].revision);}
const {teacherSourceInventory}=await serverModule('src/features/smart-textbook-runtime/server/teacher-inventory.server.ts');
const inventory=teacherSourceInventory(teacherSession().data);
const passed={
  renderer:p.productionMounted&&p.realRespond&&p.realEvents&&p.realPostgres,
  character:a.nodes.length===8&&a.nodes.every(n=>n.covered),
  'normal-speech':a.pauseResume&&a.audioStepDispose,
  'buffer-speech':a.audioStepDispose&&a.lateAudioEnded,
  'browser-fallback':a.ttsStepDispose&&a.lateTtsEnded,
  'tts-observation':a.mountedGrant&&p.grantReloadRevoked&&p.realEvents,
  blackboard:['text','bullets','expression'].every(type=>a.blackboard.includes(type)),
  'student-task':a.phases.includes('awaiting-task')&&p.persistedAgent&&p.realEvents,
  'visual-cue':p.targets.rows.some(r=>r.source==='observe-scene:visualCue'&&r.status==='verified'),
  question:a.phases.includes('awaiting-answer')&&p.realRespond,
  feedback:a.phases.includes('feedback')&&p.realRespond,
  remediation:a.phases.includes('remediation')&&p.realRespond,
  terminal:p.terminalPersisted&&p.formalLearningMutation===false,
  'target-commands':p.targets.requiredUnsupported===0&&p.targets.danglingCommands===0&&p.targets.duplicateOwners===0,
  timeline:a.pauseResume&&a.phases.includes('completed'),
  lifecycle:a.audioStepDispose&&a.ttsStepDispose&&a.grantStepDispose&&a.questionStepDispose&&a.lateHttp&&a.lateAudioEnded&&a.lateTtsEnded,
  'session-isolation':p.grantReloadRevoked&&a.grantStepDispose,
  reload:p.persistedReload&&p.learningReload&&p.grantReloadRevoked,
  'owner-exclusion':a.ordinaryOwnerRestored&&a.targets.duplicateOwners===0,
  'strict-complete-runtime':p.strictComplete&&p.productionMounted&&p.learningReload,
};
const input={teachingRevision:p.teachingRevision,requiredNodeKeys:inventory.nodes.map(n=>n.key),sourceUnsupported:inventory.unsupported,
  nodes:p.nodes.map(n=>({key:n.key,status:n.covered?'passed':'failed',test:'tests/smart-textbook-runtime-4a15-browser.test.mjs'})),
  requiredTargets:inventory.requirements,targets:p.targets,
  evidence:teacherChecks.map(check=>({check,snapshotId:p.snapshotId,teachingRevision:p.teachingRevision,status:passed[check]?'passed':'unverified',
    test:['renderer','reload','strict-complete-runtime','terminal','student-task','question','feedback','remediation'].includes(check)?'tests/smart-textbook-runtime-4a15-browser.test.mjs':'tests/smart-textbook-runtime-4a14-browser.test.mjs'}))};
const promotion=teacherImplementationReadiness(manifest,input),teacher=teacherCapabilityReadiness(manifest,input);
assert.equal(promotion.readyForRegistryPromotion,true,JSON.stringify(promotion));
for(const check of teacherChecks.filter(c=>c!=='strict-complete-runtime')){
  assert.equal(teacherImplementationReadiness(manifest,{...input,evidence:input.evidence.filter(e=>e.check!==check)}).readyForRegistryPromotion,false,`Missing ${check} must block promotion`);
}
const l=JSON.parse(await readFile('docs/SMART_TEXTBOOK_RUNTIME_V1_PHASE_4A12_READINESS.json','utf8'));
const learning=learningCapabilityReadiness(manifest,{targets:JSON.parse(await readFile('docs/SMART_TEXTBOOK_RUNTIME_V1_PHASE_4A12_TARGET_COVERAGE.json','utf8')),evidence:l.evidence,activities:l.activities,requiredActivityRefs:manifest.activityRefs.map(a=>a.id)});
assert.equal(learning.learningReady,true);
const runtime=runtimeReadiness(manifest,compiled.nonUiRuntimeReady);
if(pre){assert.equal(teacher.teacherReady,false);assert.deepEqual(new Set(teacher.blockers),new Set(['teacher.strict-complete-runtime','teacher.renderer-registry']));assert.equal(runtime.runtimeReady,false);}
else {assert.equal(teacher.teacherReady,true,JSON.stringify(teacher));assert.equal(runtime.runtimeReady,true);}
const result={stage:pre?'implementation-proven-before-registry-promotion':'strict-complete-verified',manifestDigest:manifest.snapshot.contentDigest,
  input,promotion,teacher,learning,runtime};
await writeFile(`/tmp/uply-runtime-4a15-readiness-${pre?'pre':'final'}.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify({stage:result.stage,promotion,teacher,learningReady:learning.learningReady,runtime},null,2));
