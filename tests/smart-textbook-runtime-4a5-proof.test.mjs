import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes, createHmac } from 'node:crypto';
import { serverModule } from './fixtures/runtime-4a2.server.mjs';
const api=await serverModule('src/lib/recording-evidence-v2.server.ts',{
  './r2': 'export async function checkR2ObjectExists(key){globalThis.__proof4a5Head.push(key);return {exists:true,size:4096,contentType:"audio/webm"};}',
});
const uuid=n=>`40000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const binding={snapshot:'snapshot-test',sourceRevision:'source-test',versionId:uuid(4),activityRef:'activity-ref-test',recordingKind:'independent-output'};
const scope={tenantId:uuid(1),studentId:uuid(2),activityId:uuid(3),versionId:uuid(4),runtimeBinding:binding};
const row=()=>({id:uuid(5),tenant_id:scope.tenantId,student_id:scope.studentId,activity_id:scope.activityId,
  object_key:`student-recordings/${scope.tenantId}/${scope.studentId}/${scope.activityId}/${uuid(5)}.webm`,
  byte_size:4096,mime_type:'audio/webm',created_at:new Date(Date.now()-1000).toISOString(),consumed_at:null,consumed_attempt_number:null,
  metadata:api.runtimeRecordingMetadata({durationSeconds:20},binding)});
const response={recorded:true,durationSeconds:20,turns:0,criteria:[true,true,true,true],recordingEvidenceId:uuid(5)};
const activity={answerKey:{kind:'open'},publicConfig:{enforceCompletionRequirements:true,minimumSeconds:15,requiredCriteria:4}};
const secret=randomBytes(32),head=async()=>({exists:true,size:4096,contentType:'audio/webm'});
const services={keyId:'isolated',secret,headR2:head,headLegacy:head};
const issue=(e=row(),s=scope,r=response,d=services)=>api.issueSpeakingCompletionProof(s,e,r,activity,d);

test('4A-5 proof: signer binds immutable identity, digests, private Runtime binding, nonce and <=60s TTL',async()=>{
  const p=await issue(),c=JSON.parse(p.payload);
  assert.equal(createHmac('sha256',secret).update(p.payload).digest('hex'),p.signature);
  assert.equal(c.expiresAt-c.issuedAt,45);assert.match(c.nonce,/^[0-9a-f]{64}$/);assert.deepEqual(c.runtimeBinding,binding);
  for(const forbidden of ['object_key','objectKey','transcript','secret','verified'])assert.ok(!Object.hasOwn(c,forbidden));
  assert.notEqual((await issue()).payload,p.payload,'cryptographic nonce, not deterministic/reusable proof');
});
test('4A-5 proof: default HEAD adapter calls existing checkR2ObjectExists (synthetic module, zero network)',async()=>{
  globalThis.__proof4a5Head=[];
  try {await issue(row(),scope,response,{...services,headR2:undefined});assert.deepEqual(globalThis.__proof4a5Head,[row().object_key]);}
  finally{delete globalThis.__proof4a5Head;}
});
for(const [name,value] of [['missing',{exists:false}],['size',{exists:true,size:5000,contentType:'audio/webm'}],['MIME',{exists:true,size:4096,contentType:'audio/ogg'}]])
  test(`4A-5 proof: HEAD ${name} mismatch never signed`,async()=>{await assert.rejects(issue(row(),scope,response,{...services,headR2:async()=>value}),/object mismatch/);});
for(const [name,mutate] of [
  ['student',e=>{e.student_id=uuid(9);}],['tenant',e=>{e.tenant_id=uuid(9);}],['activity',e=>{e.activity_id=uuid(9);}],
  ['snapshot',e=>{e.metadata.runtimeBinding.snapshot='wrong';}],['source',e=>{e.metadata.runtimeBinding.sourceRevision='wrong';}],
  ['consumed',e=>{e.consumed_at=new Date().toISOString();e.consumed_attempt_number=1;}],['pending',e=>{e.metadata.lifecycle='delete-pending';}],
  ['expired',e=>{e.created_at='2000-01-01T00:00:00.000Z';}],['backend',e=>{e.metadata.storage='supabase';}],
  ['path',e=>{e.object_key=e.object_key.replace('student-recordings/','');}],
])test(`4A-5 proof: rejects ${name} before any HEAD`,async()=>{
  const e=row();mutate(e);let calls=0;
  await assert.rejects(issue(e,scope,response,{...services,headR2:async()=>{calls++;return head();}}));assert.equal(calls,0);
});
for(const field of ['score','completion','tenantId','studentId','objectKey','consumed'])test(`4A-5 proof: response rejects client ${field}`,async()=>{
  await assert.rejects(issue(row(),scope,{...response,[field]:true}));
});
test('4A-5 proof: original grader qualification required, no new scoring policy',async()=>{
  await assert.rejects(issue(row(),scope,{...response,criteria:[true]}),/grader/);
  await assert.rejects(issue(row(),scope,{...response,durationSeconds:2}),/grader/);
});
test('4A-5 metadata: known R2 role/repeat variants do not need old missing storage field; unknown/conflicting variants reject',()=>{
  const e=row();
  for(const metadata of [{sceneId:'greeting',roleSide:'left',turnIndex:0},{practiceKey:'repeat-line',trackIndex:0,segmentIndex:0},{practiceKey:'full-recall',trackIndex:1,segmentIndex:1}]){
    assert.equal(api.decodeRecordingEvidence({...e,metadata}).backend,'r2');
  }
  assert.throws(()=>api.decodeRecordingEvidence({...e,metadata:{unknown:true}}));
  assert.throws(()=>api.runtimeRecordingMetadata(e.metadata,binding),/rebind/);
  assert.throws(()=>api.runtimeRecordingMetadata({durationSeconds:20},{...binding,recordingKind:'roleplay-turn'}));
});
test('4A-5 legacy: exact historical Storage identity uses ONLY legacy verification adapter',async()=>{
  const e=row();e.metadata={};e.object_key=e.object_key.replace('student-recordings/','');let reads=0;
  const p=await issue(e,{...scope,runtimeBinding:null},response,{...services,headR2:async()=>{throw new Error('must not try R2');},headLegacy:async()=>{reads++;return head();}});
  assert.equal(reads,1);assert.equal(JSON.parse(p.payload).backend,'legacy-supabase');
});
test('4A-5 service: speaking gateway calls v2 RPC without application consumed UPDATE',async()=>{
  let calls=0;await api.consumeSpeakingV2(async(name,args)=>{calls++;assert.equal(name,'record_smart_textbook_speaking_attempt_v2');assert.equal(args.p_evidence_id,uuid(5));return {};},scope,row(),response,activity,services);assert.equal(calls,1);
});
test('4A-5 service: roleplay gateway signs exact required coverage and calls one atomic RPC',async()=>{
  const s={...scope,runtimeBinding:{...binding,recordingKind:'roleplay-turn'}},scene={id:'greeting',lines:['a','b','c','d']};
  const rows=[0,2].map((turn,i)=>{const e=row();e.id=uuid(10+i);e.object_key=e.object_key.replace(uuid(5),e.id);
    e.metadata={sceneId:'greeting',roleSide:'left',turnIndex:turn,runtimeBinding:s.runtimeBinding};return e;});
  let calls=0;await api.completeRoleplayV2(async(name,args)=>{calls++;assert.equal(name,'complete_smart_textbook_roleplay_v2');assert.equal(args.p_evidence_proofs.length,2);return {};},s,rows,scene,'left',services);assert.equal(calls,1);
  await assert.rejects(api.issueRoleplayCompletionProofs(s,rows.slice(0,1),scene,'left',services),/coverage/);
});
test('4A-5 service: failed external DELETE retains claim; safe retry calls correct backend then finalize',async()=>{
  const calls=[];let fail=true;
  const rpc=async(name)=>{calls.push(name);return name.startsWith('claim')?{evidenceId:uuid(5),backend:'r2',objectKey:row().object_key,state:'delete-pending'}:{state:'deleted'};};
  const storage={r2:async()=>{calls.push('r2-delete');if(fail)throw new Error('isolated storage failure');},legacy:async()=>{throw new Error('wrong backend');}};
  await assert.rejects(api.deleteRecordingV2(rpc,scope,uuid(5),storage));assert.equal(calls.length,2);
  fail=false;assert.deepEqual(await api.deleteRecordingV2(rpc,scope,uuid(5),storage),{state:'deleted'});
  assert.deepEqual(calls,['claim_smart_textbook_recording_delete_v2','r2-delete','claim_smart_textbook_recording_delete_v2','r2-delete','finalize_smart_textbook_recording_delete_v2']);
});
test('4A-5 service: legacy delete invokes only explicit legacy backend',async()=>{
  let legacyCalls=0;const rpc=async name=>name.startsWith('claim')?{evidenceId:uuid(5),backend:'legacy-supabase',objectKey:row().object_key.replace('student-recordings/',''),state:'delete-pending'}:{state:'deleted'};
  await api.deleteRecordingV2(rpc,scope,uuid(5),{r2:async()=>{throw new Error('must not guess R2');},legacy:async()=>{legacyCalls++;}});
  assert.equal(legacyCalls,1);
});
