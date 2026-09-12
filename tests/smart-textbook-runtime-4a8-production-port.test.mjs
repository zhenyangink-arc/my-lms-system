import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {compiled,manifest} from './fixtures/runtime-4a.mjs';
import {serverModule} from './fixtures/runtime-4a2.server.mjs';
const binder=await serverModule('src/features/smart-textbook-runtime/server/recording-binding.server.ts');
const plans=compiled.bindings.capsules.filter(c=>c.kind==='learning').flatMap(c=>binder.recordingPlans(manifest,compiled.bindings,c.id,'zh-CN'));
const sp=plans.find(p=>p.kind==='speaking-introduction'),rp=plans.find(p=>p.kind==='dialogue-roleplay'),full=plans.find(p=>p.kind==='full-recall');
const api=await serverModule('src/features/smart-textbook-runtime/server/recording-production.server.ts',{
  '../../../lib/recording-domain.server':`export async function withRecordingDomain(admin,owner,run){globalThis.__port.calls.push(['gate',owner]);return run({domain:globalThis.__port.domain});}`,
  '../../../lib/recording-domain-gateway.server':`export async function recordingActivityBinding(admin,id){return {versionId:globalThis.__port.versionId,sourceRevision:'domain-'+id};}
    export function createRecordingGateway(admin,request,binding,runtime){globalThis.__port.calls.push(['binding',runtime]);return globalThis.__port.gateway;}`,
});
function setup(t){
  const ref=compiled.bindings.activities.find(a=>a.ref===sp.activityRef),versionId=ref.versionId;
  const a={admin:{},owner:{tenantId:randomUUID(),studentId:randomUUID()},sessionId:'session',snapshotId:manifest.snapshot.id,sourceRevision:compiled.report.sourceRevision,versionId,trackingDisabled:false,plans,bindings:compiled.bindings,domainRevisions:new Map(compiled.bindings.activities.map(a=>[a.ref,'domain-'+a.activityId]))};
  const rows=new Map();let savedForm;
  const runtime={snapshot:a.snapshotId,sourceRevision:a.sourceRevision,versionId,activityRef:sp.activityRef,recordingKind:'independent-output'};
  const make=(metadata={durationSeconds:16,runtimeBinding:runtime})=>{const id=randomUUID(),r={id,created_at:new Date().toISOString(),consumed_at:null,consumed_attempt_number:null,mime_type:'audio/webm',metadata};rows.set(id,r);return r;};
  const gateway={
    async read(id){if(!rows.has(id))throw Error('NOT_FOUND');return rows.get(id);},
    async upload(form){savedForm=form;globalThis.__port.calls.push(['upload',[...form.keys()]]);return {evidenceId:make().id};},
    async remove(id){rows.delete(id);},
    async restore(q){globalThis.__port.calls.push(['restore',Object.fromEntries(q)]);return !q.size&&rows.size?{evidenceId:rows.keys().next().value}:null;},
    async playback(){return new Response(new Uint8Array(4096),{headers:{'Content-Type':'audio/webm'}});},
    async speak(response,activity,qualified){globalThis.__port.calls.push(['speak',response,activity,qualified]);return {attempt_number:1};},
    async roleplay(scene,side){globalThis.__port.calls.push(['roleplay',scene,side]);return {attempt_number:1,already_completed:true};},
  };
  globalThis.__port={calls:[],domain:'v2',versionId,gateway};t.after(()=>{delete globalThis.__port;});
  return {a,make,gateway,rows,services:api.productionRecordingServices(async()=>a,{sessionId:a.sessionId,snapshotId:a.snapshotId}),get form(){return savedForm;}};
}
const sig=()=>new AbortController().signal,scope={capsuleRef:sp.capsuleRef,activityRef:sp.activityRef,target:sp.slot.target};
test('4A8 production port uses gateway upload/restore/bytes/delete only; sanitized DTO',async t=>{
  const x=setup(t),item=await x.services.upload(scope,new Blob([new Uint8Array(4096)],{type:'audio/webm'}),16,sig());
  assert.deepEqual([...x.form.keys()],['recording','durationSeconds']);assert.equal((await x.services.audio(scope,item.id,sig())).size,4096);
  await x.services.remove(scope,item.id,sig());assert.equal(x.rows.size,0);
  assert.ok(!JSON.stringify(item).includes('runtimeBinding'));assert.equal(globalThis.__port.calls.filter(c=>c[0]==='gate').length,3);
});
for(const field of ['snapshotId','sessionId','versionId','sourceRevision'])test(`4A8 production port rejects wrong ${field}`,async t=>{
  const x=setup(t),r=x.make();if(field==='sourceRevision')x.a.domainRevisions.set(sp.activityRef,'wrong');else x.a[field]='wrong';
  await assert.rejects(x.services.complete({kind:sp.kind,capsuleRef:sp.capsuleRef,activityRef:sp.activityRef,recordingId:r.id,criteriaIds:sp.criteria.slice(0,4).map(c=>c.id)},sig()));
  assert.equal(globalThis.__port.calls.filter(c=>c[0]==='speak').length,0);
});
test('4A8 gate=false rejects domain port, never dispatches legacy upload',async t=>{const x=setup(t);globalThis.__port.domain='v1';await assert.rejects(x.services.upload(scope,new Blob(),16,sig()));assert.equal(globalThis.__port.calls.filter(c=>c[0]==='upload').length,0);});
test('4A8 exact Runtime binding -> existing speaking gateway result; no private payload return',async t=>{
  const x=setup(t),r=x.make(),result=await x.services.complete({kind:sp.kind,capsuleRef:sp.capsuleRef,activityRef:sp.activityRef,recordingId:r.id,criteriaIds:sp.criteria.slice(0,4).map(c=>c.id)},sig());
  assert.equal(result.formalCompletion,true);assert.equal(result.score,null);assert.equal(globalThis.__port.calls.find(c=>c[0]==='speak')[1].recordingEvidenceId,r.id);
});
test('4A8 wrong snapshot evidence / consumed evidence cannot resubmit',async t=>{const x=setup(t);for(const mutate of [r=>r.metadata.runtimeBinding.snapshot='wrong',r=>{r.consumed_at=new Date().toISOString();r.consumed_attempt_number=1;}]){const r=x.make();mutate(r);await assert.rejects(x.services.complete({kind:sp.kind,capsuleRef:sp.capsuleRef,activityRef:sp.activityRef,recordingId:r.id,criteriaIds:sp.criteria.slice(0,4).map(c=>c.id)},sig()));}});
test('4A8 frozen scene/side forwards to domain roleplay, duplicate becomes already completed',async t=>{const x=setup(t),r=await x.services.complete({kind:rp.kind,capsuleRef:rp.capsuleRef,activityRef:rp.activityRef,sceneId:rp.scenes[1].id,side:'right'},sig());assert.equal(r.status,'already-completed');assert.deepEqual(globalThis.__port.calls.find(c=>c[0]==='roleplay'),['roleplay','introduce-and-correct','right']);});
test('4A8 unknown scene/target and client completion injection rejected before domain call',async t=>{const x=setup(t);await assert.rejects(x.services.upload({...scope,target:'unknown'},new Blob(),16,sig()));await assert.rejects(x.services.complete({kind:rp.kind,capsuleRef:rp.capsuleRef,activityRef:rp.activityRef,sceneId:'unknown',side:'left'},sig()));await assert.rejects(x.services.complete({kind:rp.kind,capsuleRef:rp.capsuleRef,activityRef:rp.activityRef,sceneId:rp.scenes[0].id,side:'left',score:1},sig()));});
test('4A8 malformed domain success is not formal completion',async t=>{const x=setup(t);x.gateway.roleplay=async()=>({});await assert.rejects(x.services.complete({kind:rp.kind,capsuleRef:rp.capsuleRef,activityRef:rp.activityRef,sceneId:rp.scenes[0].id,side:'left'},sig()));});
test('4A8 domain scoped history restores consumed/expired as playable not reusable; old snapshot not completed',async t=>{
  const x=setup(t),r=x.make();r.consumed_at=new Date().toISOString();r.consumed_attempt_number=1;
  let state=await x.services.restore(sp.capsuleRef,sp.activityRef,sig());assert.equal(state.completion,'already-completed');assert.equal(state.recordings[0].reusable,false);
  assert.equal((await x.services.audio(scope,r.id,sig())).size,4096);r.metadata.runtimeBinding.snapshot='historical';
  state=await x.services.restore(sp.capsuleRef,sp.activityRef,sig());assert.equal(state.completion,'none');assert.equal(state.recordings[0].reusable,false);
  r.consumed_at=null;r.consumed_attempt_number=null;r.created_at='2000-01-01T00:00:00Z';state=await x.services.restore(sp.capsuleRef,sp.activityRef,sig());assert.equal(state.recordings[0].state,'expired');
  r.metadata.lifecycle='delete-pending';await assert.rejects(x.services.audio(scope,r.id,sig()));
});

test('4A8 actual domain gateway checks new Runtime binding; wrong binding/unbound legacy rejected before HEAD',async()=>{
  let heads=0;
  globalThis.__runtimeHead=()=>{heads++;return {exists:true,size:4096,contentType:'audio/webm'};};
  try{
    const gateway=await serverModule('src/lib/recording-domain-gateway.server.ts',{'@/lib/r2':'export async function checkR2ObjectExists(){return globalThis.__runtimeHead();} export function createR2SignedObjectUrl(){throw Error("No network");} export function createR2SignedUploadUrl(){throw Error("No network");} export function deleteR2Object(){throw Error("No network");}'});
    const owner={tenantId:randomUUID(),studentId:randomUUID()},versionId=randomUUID(),activityId=randomUUID(),evidenceId=randomUUID();
    const runtime={snapshot:'snapshot-test',sourceRevision:'runtime-revision',activityRef:'runtime-activity-ref'};
    const row={id:evidenceId,tenant_id:owner.tenantId,student_id:owner.studentId,activity_id:activityId,object_key:`student-recordings/${owner.tenantId}/${owner.studentId}/${activityId}/${evidenceId}.webm`,byte_size:4096,mime_type:'audio/webm',created_at:new Date(Date.now()-1000).toISOString(),consumed_at:null,consumed_attempt_number:null,metadata:{durationSeconds:16,storage:'r2',lifecycle:'active',runtimeBinding:{...runtime,versionId,recordingKind:'independent-output'}}};
    const g=gateway.createRecordingGateway({}, {owner}, {activity:{id:activityId},versionId,sourceRevision:'old-domain-revision'},runtime);
    await g.consumable(row);assert.equal(heads,1);
    for(const field of ['snapshot','sourceRevision','activityRef','versionId']){const bad=structuredClone(row);bad.metadata.runtimeBinding[field]=field==='versionId'?randomUUID():'wrong';await assert.rejects(g.consumable(bad));}
    const legacy=structuredClone(row);delete legacy.metadata.runtimeBinding;await assert.rejects(g.consumable(legacy));assert.equal(heads,1);
  }finally{delete globalThis.__runtimeHead;}
});
