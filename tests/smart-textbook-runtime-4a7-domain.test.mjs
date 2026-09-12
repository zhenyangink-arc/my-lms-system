import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID,randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { serverModule } from './fixtures/runtime-4a2.server.mjs';
const api=await serverModule('src/lib/recording-domain.server.ts');
const owner={tenantId:randomUUID(),studentId:randomUUID()};
test('4A7 gate defaults v1; whole owner domain, not request method or client fields',()=>{
  assert.equal(api.recordingEvidenceV2({},owner).domain,'v1');
  const env={RECORDING_EVIDENCE_V2_ENABLED:'true',RECORDING_EVIDENCE_V2_SCOPE:JSON.stringify([owner]),RECORDING_EVIDENCE_V2_EPOCH:'2',RECORDING_EVIDENCE_INSTANCE_ID:'a'};
  assert.equal(api.recordingEvidenceV2(env,owner).domain,'v2');
  assert.equal(api.recordingEvidenceV2(env,{...owner,studentId:randomUUID()}).domain,'v1');
  assert.equal(api.recordingEvidenceV2(env,{...owner,tenantId:randomUUID()}).domain,'v1');
  assert.equal(api.recordingEvidenceV2({...env,RECORDING_EVIDENCE_V2_ENABLED:'false'},owner).domain,'v1');
});
for(const [field,value] of [['RECORDING_EVIDENCE_V2_ENABLED','1'],['RECORDING_EVIDENCE_V2_SCOPE','all'],['RECORDING_EVIDENCE_V2_EPOCH','0'],['RECORDING_EVIDENCE_V2_SCOPE','[{"tenantId":"fake","studentId":"fake"}]']])
  test(`4A7 invalid gate ${field} fails closed`,()=>assert.throws(()=>api.recordingEvidenceV2({[field]:value,RECORDING_EVIDENCE_INSTANCE_ID:'a'},owner)));
for(const env of [{},{NEXT_PUBLIC_RECORDING_EVIDENCE_PROOF_SECRET_HEX:randomBytes(32).toString('hex')},{RECORDING_EVIDENCE_PROOF_KEY_ID:'key'},{RECORDING_EVIDENCE_PROOF_KEY_ID:'key',RECORDING_EVIDENCE_PROOF_SECRET_HEX:'xyz'}])
  test('4A7 provider missing/malformed or public-only secret fails closed without echoing configuration',async()=>{
    await assert.rejects(new api.EnvironmentRecordingProofKeyProvider(env).get(),e=>e.code==='proof-invalid'&&!e.message.includes('xyz'));
  });
test('4A7 server key provider accepts ephemeral injected key only; no output serialization',async()=>{
  const secret=randomBytes(32),provider=new api.EnvironmentRecordingProofKeyProvider({RECORDING_EVIDENCE_PROOF_KEY_ID:'isolated',RECORDING_EVIDENCE_PROOF_SECRET_HEX:secret.toString('hex')});
  const result=await provider.get();assert.equal(result.keyId,'isolated');assert.deepEqual(result.secret,secret);
});
for(const [message,code,expected] of [
  ['RECORDING_ROLEPLAY_ALREADY_COMPLETED','23505','duplicate'],['RECORDING_CONSUMED','P0001','consumed'],
  ['RECORDING_UPLOAD_PENDING','P0001','pending'],['RECORDING_DELETE_CONFLICT','P0001','conflict'],
  ['RECORDING_PROOF_SIGNATURE','P0001','proof-invalid'],['MAX_ATTEMPTS_REACHED','P0001','max-attempts'],
  ['RECORDING_EPOCH_MISMATCH','P0001','fenced'],['connection unavailable','08006','unavailable'],
])test(`4A7 Supabase {data,error} ${expected} never accepted as a successful result`,async()=>{
  const rpc=api.supabaseRecordingRpc({rpc:async()=>({data:{attempt_number:99},error:{message,code}})});
  await assert.rejects(rpc('some_rpc',{}),e=>e.code===expected&&!e.message.includes(message));
});
test('4A7 Supabase null data without error still fails; successful data unwrapped',async()=>{
  await assert.rejects(api.supabaseRecordingRpc({rpc:async()=>({data:null,error:null})})('rpc',{}));
  assert.deepEqual(await api.supabaseRecordingRpc({rpc:async()=>({data:{ok:true},error:null})})('rpc',{}),{ok:true});
});
for(const metadata of [{runtimeBinding:{}},{lifecycle:'delete-pending'},{lifecycle:'consumed'},{lifecycle:'active'}])
  test(`4A7 pre-migration/rollback guard rejects ${JSON.stringify(metadata)} even with gate false`,async()=>{
    const query={select(){return this;},eq(){return this;},or(){return this;},limit(){return this;},then(resolve){resolve({data:[{metadata}],error:null});}};
    const admin={rpc:async()=>({data:null,error:{code:'PGRST202',message:'recording_domain_request_v1 not found'}}),from:()=>query};
    await assert.rejects(api.withRecordingDomain(admin,owner,async()=>assert.fail('Must not enter legacy writer'),{}),/fenced/);
  });
test('4A7 bootstrap is not an outage fallback, not available with configured gate, and rejects failed row lookup',async()=>{
  await assert.rejects(api.withRecordingDomain({rpc:async()=>({error:{code:'08006',message:'outage'}})},owner,async()=>assert.fail(),{}),/unavailable/);
  await assert.rejects(api.withRecordingDomain({rpc:async()=>({error:{code:'PGRST202',message:'recording_domain_request_v1 not found'}})},owner,async()=>assert.fail(),{RECORDING_EVIDENCE_V2_ENABLED:'false',RECORDING_EVIDENCE_INSTANCE_ID:'a'}));
  const query={select(){return this;},eq(){return this;},or(){return this;},limit(){return this;},then(resolve){resolve({data:null,error:{message:'no access'}});}};
  await assert.rejects(api.assertLegacyRecordingScopeSafe({from:()=>query},owner),/unavailable/);
});
test('4A7 no production route switch/UI edits; existing entry shapes retained with one gateway',()=>{
  const route=readFileSync('src/app/api/digital-textbook/recordings/[activityId]/route.ts','utf8');
  for(const method of ['GET','POST','DELETE'])assert.match(route,new RegExp(`export async function ${method}`));
  assert.match(route,/withRecordingDomain/);assert.match(route,/createRecordingGateway/);
  const domain=readFileSync('src/lib/recording-domain.server.ts','utf8');
  assert.ok(!domain.includes('new Map('));assert.ok(!domain.includes('NEXT_PUBLIC_'));
  const sql=readFileSync('supabase/migrations/202609090002_recording_domain_coordination.sql','utf8');
  assert.match(sql,/security definer set search_path=''/);assert.match(sql,/uploading_evidence_id is null/);
  assert.ok(!/update public\.digital_textbook|delete from public\.digital_textbook/.test(sql));
});
