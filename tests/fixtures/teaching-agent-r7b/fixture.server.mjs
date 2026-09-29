// DEVELOPMENT FIXTURE ONLY. No DB client, provider, Auth or production transport.
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
registerHooks({resolve(specifier,context,next){return next(specifier==='server-only'?pathToFileURL(resolve('node_modules/next/dist/compiled/server-only/empty.js')).href:specifier,context);}});
const {projectFrozenExecution}=await import('../../../src/features/smart-textbook-runtime/server/native-execution-projection.server.ts');
const {gradeSmartTextbookActivity}=await import('../../../src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-submission.ts');
const {completionRequestSchema,executionBinding,sameBinding}=await import('../../../src/features/smart-textbook-runtime/core/execution-contracts.ts');
const hash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const frozen=JSON.parse(readFileSync(new URL('../../../docs/evidence/teaching-agent-stage-1f-r6f/final-nodes.json',import.meta.url),'utf8')).nodes;
const baseline=JSON.parse(readFileSync(new URL('../../../docs/evidence/teaching-agent-stage-1f-r6f/content-freeze-baseline.json',import.meta.url),'utf8'));
for(const n of frozen){const b=baseline.nodes.find(b=>b.nodeNumber===n.order);if(!b||n.idHash!==b.safeIdSha256||n.rowSha256!==b.rowSha256||hash(n.script['zh-CN'])!==b.mainRawUtf8Sha256||hash(n.script['ko-KR'])!==b.koKrRawUtf8Sha256)throw Error('FROZEN_TEXT_DRIFT');}
const node5=frozen.find(n=>n.order===5),node7=frozen.find(n=>n.order===7);
if(node5.rowSha256!=='3b48b709e005413be9c9599fc428a464f33928655234da13e2751c36da505bb8'||node7.rowSha256!=='93b340135770be2aed8ded1fa3bb8310ded773f7799cd054d767fd8c29a7bd4e')throw Error('FROZEN_SOURCE_DRIFT');
export const projectionInput={lessonBinding:'870d1e4c70d884294d31fa8da3cb62d5ecadb2d050b4056c03c9ce47525497c3',versionBinding:node5.versionHash,node5:{binding:node5.idHash,rowHash:node5.rowSha256,text:node5.script['ko-KR']},node7:{binding:node7.idHash,rowHash:node7.rowSha256},compiledAt:'2026-09-17T00:00:00.000Z',mediaRevision:'development-pattern-v1',durationSeconds:30,cueTime:5};
export const manifest=projectFrozenExecution(projectionInput);
// Private answer contract reused from the existing server grader; never exported.
const privateAnswer={kind:'index',value:1};
export function createFixture(){
 const context={runtimeSessionId:'fixture-session',snapshotId:manifest.snapshot.id,sourceState:'draft',trackingDisabled:true,locale:'zh-CN',supportMode:'bilingual'};
 let pending=false,completed=false,attempts=0,revision=0,completedAt=null,mode='normal';const requests=new Map();
 const metrics={submits:0,readbacks:0,checkpoints:0,restores:0};
 const initialState={snapshotId:manifest.snapshot.id,revision:manifest.snapshot.contentDigest,completedStepIds:[],attempts:[],activityProgress:[],pageProgress:[],guidedRepeat:[],speakingEvidence:[]};
 const expected=executionBinding(manifest,context,manifest.execution.cues[0]);
 function validate(raw){const r=completionRequestSchema.parse(raw);if(!sameBinding(r.binding,expected))throw Error('FIXTURE_SCOPE');return r;}
 function receipt(r,status){return {...r,contract:'activity-completion/1',status,attemptNumber:attempts,evidence:{source:'isolated-fixture',stateRevision:revision,stateDigest:hash({pending,completed,attempts,revision}),observedAt:new Date().toISOString()},completedAt};}
 const api={manifest,context,initialState,metrics,
  setMode(value){if(!['normal','lost-completed','unknown','invalid-receipt','invalid-restore'].includes(value))throw Error('BAD_TEST_MODE');mode=value;},
  reset(){pending=false;completed=false;attempts=0;revision=0;completedAt=null;mode='normal';requests.clear();Object.keys(metrics).forEach(k=>metrics[k]=0);},
  restore(raw){const r=validate(raw);metrics.restores++;const value={...r,pending:pending&&!completed,receipt:receipt(r,completed?'COMPLETED':mode==='unknown'&&pending?'UNKNOWN':'INCOMPLETE')};if(mode==='invalid-restore')value.binding={...value.binding,mediaRevision:'wrong-media'};return value;},
  checkpoint(raw){const r=validate(raw);metrics.checkpoints++;if(!pending&&!completed){pending=true;revision++;}return receipt(r,completed?'COMPLETED':'INCOMPLETE');},
  submit(raw,optionId){const r=validate(raw);
    const cached=requests.get(r.requestId);if(cached){if(cached.optionId!==optionId||cached.generation!==r.generation)throw Error('REQUEST_REUSE_MISMATCH');return cached.value;}
    if(!pending||completed)throw Error('ACTIVITY_NOT_PENDING');
    metrics.submits++;if(mode==='unknown'){const value={receipt:receipt(r,'UNKNOWN'),result:{ok:false,correct:null,score:null,explanation:'结果待确认',attemptNumber:attempts,preview:true,nodeId:null,nodeCompleted:false,completionPercent:0}};requests.set(r.requestId,{optionId,generation:r.generation,value});return value;}
    const options=manifest.activityRefs[0].publicPresentation.options,index=options.findIndex(o=>o.id===optionId);if(index<0)throw Error('OPTION_SCOPE');
    const grade=gradeSmartTextbookActivity(privateAnswer,index,'single_choice',{},options);if(!grade.ok)throw Error('GRADER_REJECTED');
    attempts++;revision++;completed=grade.correct===true;if(completed){pending=false;completedAt=new Date().toISOString();}
    const value={receipt:receipt(r,completed?'COMPLETED':'INCOMPLETE'),result:{ok:true,correct:grade.correct,score:grade.score,explanation:completed?'已确认完成练习。':'请再想一想。',attemptNumber:attempts,preview:true,nodeId:null,nodeCompleted:false,completionPercent:0}};
    requests.set(r.requestId,{optionId,generation:r.generation,value});
    if(mode==='invalid-receipt')return {...value,receipt:{...value.receipt,generation:r.generation+1}};
    if(mode==='lost-completed')throw Error('SIMULATED_RESPONSE_LOST');return value;
  },
  readback(raw){const r=validate(raw);metrics.readbacks++;if(mode==='unknown')return receipt(r,'UNKNOWN');const cached=requests.get(r.requestId);return cached?{...cached.value.receipt,generation:r.generation}:receipt(r,completed?'COMPLETED':'UNKNOWN');},
  ports(){return {mediaSource:(ref,rev)=>{if(ref!=='development-video'||rev!==projectionInput.mediaRevision)throw Error('MEDIA_BINDING');return '/media';},restore:async r=>api.restore(r),checkpoint:async r=>api.checkpoint(r),submit:async(r,o)=>api.submit(r,o),readback:async r=>api.readback(r)};},
 };
 return api;
}
