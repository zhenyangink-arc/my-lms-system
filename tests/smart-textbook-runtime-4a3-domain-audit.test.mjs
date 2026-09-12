import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { compiled, manifest, source } from './fixtures/runtime-4a.mjs';
import { serverModule } from './fixtures/runtime-4a2.server.mjs';
const { submitSmartTextbookActivityForContext } = await serverModule('src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-submission.ts');
const { guidedRepeatServiceInput, projectGuidedRepeat } = await import('../src/lib/smart-textbook-legacy-adapter/compatibility-services.server.ts');

// Diagnostic tests, NOT executable-capability acceptance. No authenticated real
// account, network, bucket or database is used. Original handlers execute with
// synthetic auth/storage transports; defects are reproduced, not papered over.
const actor = '10000000-0000-4000-8000-000000000001';
const tenant = '10000000-0000-4000-8000-000000000002';
const recordingPath = 'src/app/api/digital-textbook/recordings/[activityId]/route.ts';
const actionPath = 'src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-actions.ts';
const uploadUrl = 'https://isolated-runtime-test.invalid/upload';
const authOverrides = {
  '@/lib/auth': 'export async function requireActiveUser(){return globalThis.__runtime4a3Auth;}',
  '@/lib/supabase/admin': 'export function createAdminClient(){return globalThis.__runtime4a3Auth.supabase;}',
  '@/lib/student-permissions': 'export function canUseStudentFeature(){return true;} export function normalizeMembershipTier(){return "synthetic-test";}',
};
const routes = await serverModule(recordingPath, {
  ...authOverrides,
  'next/server': 'export class NextResponse extends Response { static json(body,init){return Response.json(body,init);} }',
  '@/lib/r2': `export async function createR2SignedUploadUrl(key,mime,size){globalThis.__runtime4a3Storage.pending={key,mime,size};return ${JSON.stringify(uploadUrl)};}
    export async function assertR2ObjectUpload(key,size){if(!globalThis.__runtime4a3Storage.objects.has(key)||globalThis.__runtime4a3Storage.objects.get(key).size!==size)throw Error("UPLOAD_NOT_VERIFIED");}
    export async function deleteR2Object(key){globalThis.__runtime4a3Storage.objects.delete(key);}
    export async function createR2SignedObjectUrl(){throw Error("Unexpected network playback in diagnostic");}
    export async function checkR2ObjectExists(){throw Error("Unexpected v2 HEAD in legacy diagnostic");}`,
});
const actions = await serverModule(actionPath, {
  ...authOverrides,
  '@/lib/admin': 'export function isPlatformCourseAuditorRole(role){return role==="platform_owner";}',
  '@/features/student-home-learning/api/refresh': 'export function refreshStudentHomeLearningData(){throw Error("Unexpected production refresh");}',
});

function database() {
  const tables = {
    digital_textbook_activities: structuredClone(source.activities),
    digital_textbook_nodes: source.nodes.map(n => ({ ...structuredClone(n), digital_textbook_modules: { digital_textbook_chapters: { version_id: manifest.version.id } } })),
    digital_textbook_activity_secrets: source.activities.filter(a => a.activity_type === 'speaking').map(a => ({ activity_id: a.id, answer_key: { kind: 'open' }, explanation: { 'zh-CN': '合成测试反馈' } })),
    digital_textbook_speaking_evidence: [], digital_textbook_guided_repeat_progress: [],
  };
  const state = { tables, rpcCalls: 0, storageReads: 0, storageDeletes: 0 };
  const db = {
    from(table) {
      assert.ok(table in tables, `unapproved table ${table}`);
      let rows = tables[table], filters = [], removing = false;
      const matches = r => filters.every(f => f(r));
      const query = {
        select() { return query; }, eq(k,v) { filters.push(r=>r[k]===v); return query; }, neq(k,v) { filters.push(r=>r[k]!==v); return query; },
        or(expression) { assert.equal(expression,'metadata->runtimeBinding.not.is.null,metadata->lifecycle.not.is.null');filters.push(r=>Object.hasOwn(r.metadata??{},'runtimeBinding')||Object.hasOwn(r.metadata??{},'lifecycle'));return query; },
        contains(k,v) { filters.push(r=>Object.entries(v).every(([key,value])=>r[k]?.[key]===value)); return query; },
        is(k,v) { filters.push(r=>(r[k]??null)===v); return query; }, order() { return query; }, limit() { return query; },
        async maybeSingle() { return { data: rows.find(matches)??null, error: null }; },
        async insert(row) { assert.equal(table,'digital_textbook_speaking_evidence'); rows.push({ ...row, created_at:new Date().toISOString(), consumed_at:null }); return {error:null}; },
        async upsert(row) {
          assert.equal(table,'digital_textbook_guided_repeat_progress');
          const keys=['tenant_id','student_id','activity_id','practice_key','track_index','segment_index'];
          const prior=rows.find(r=>keys.every(k=>r[k]===row[k]));if(prior)Object.assign(prior,row);else rows.push(row);return {error:null};
        },
        delete() { removing=true; return query; }, in(k,values) { filters.push(r=>values.includes(r[k]));return query; },
        then(resolve,reject) { if(removing)tables[table]=rows.filter(r=>!matches(r));return Promise.resolve({data:rows.filter(matches),error:null}).then(resolve,reject); },
      };
      return query;
    },
    async rpc(name) { if(name==='recording_domain_request_v1')return {data:null,error:{code:'PGRST202',message:'recording_domain_request_v1 not found'}};state.rpcCalls++; throw Error('No production RPC allowed in diagnostic'); },
    storage: { from(bucket) { assert.equal(bucket,'digital-textbook-student-recordings'); return {
      async list(_prefix,{search}) { state.storageReads++;return {data:[{name:search,metadata:{size:4096,mimetype:'audio/webm'}}],error:null}; },
      async remove() { state.storageDeletes++;return {error:{message:'Synthetic Supabase backend has no R2 object'}}; },
    }; } },
  };
  return { db, state };
}
async function isolated(run, role='student', hasTenant=true) {
  const {db,state}=database(),storage={objects:new Map(),pending:null},originalFetch=globalThis.fetch;
  globalThis.__runtime4a3Auth={supabase:db,user:{id:actor},tenant:hasTenant?{id:tenant}:null,profile:{role:'student'},platformProfile:{role}};
  globalThis.__runtime4a3Storage=storage;
  globalThis.fetch=async(url,init)=>{
    assert.equal(url,uploadUrl,'All real network is forbidden');assert.equal(init.method,'PUT');
    const pending=storage.pending;assert.ok(pending);storage.objects.set(pending.key,{size:init.body.byteLength,mime:pending.mime});return new Response(null,{status:200});
  };
  try { return await run({db,state,storage}); }
  finally { globalThis.fetch=originalFetch;delete globalThis.__runtime4a3Auth;delete globalThis.__runtime4a3Storage; }
}
async function upload(activity, metadata={}) {
  const form=new FormData();form.set('recording',new Blob([new Uint8Array(4096)],{type:'audio/webm'}),'synthetic.webm');form.set('durationSeconds','20');
  for(const [key,value] of Object.entries(metadata))form.set(key,String(value));
  return routes.POST(new Request('https://isolated-runtime-test.invalid/recording',{method:'POST',body:form}),{params:Promise.resolve({activityId:activity.id})});
}

test('4A-3 audit: 8 Steps / 19 Activities / three orientation / v23 and two frozen repeat tracks / fourteen segments remain intact',()=>{
  assert.equal(manifest.steps.length,8);assert.equal(manifest.activityRefs.length,19);assert.equal(manifest.blocks.filter(b=>b.type==='multiple_choice').length,3);
  assert.equal(source.teachingVersions[0].version_number,23);assert.equal(new Set(compiled.services.guidedRepeat.map(r=>r.trackId)).size,2);assert.equal(compiled.services.guidedRepeat.length,14);
});
test('4A-3 audit: real independent-output upload creates R2 evidence that the unchanged submit service refuses BEFORE any RPC',async()=>isolated(async({db,state,storage})=>{
  const activity=source.activities.find(a=>a.activity_key==='speaking-introduction');assert.equal(activity.public_config.presentation,'independent_output');
  const response=await upload(activity);assert.equal(response.status,200);const publicResult=await response.json();
  assert.doesNotMatch(JSON.stringify(publicResult),/object_key|objectKey|tenant|student/);
  const evidence=state.tables.digital_textbook_speaking_evidence[0];assert.equal(evidence.metadata.storage,'r2');assert.ok(storage.objects.has(evidence.object_key));assert.ok(evidence.object_key.startsWith('student-recordings/'));
  const input={activityId:activity.id,locale:'zh-CN',response:{recorded:true,durationSeconds:20,turns:0,criteria:[true,true,true,true],recordingEvidenceId:publicResult.evidenceId}};
  const context={admin:db,supabase:db,userId:actor,tenantId:tenant,canSubmit:true,preview:false};
  const failed=await submitSmartTextbookActivityForContext(input,context);assert.equal(failed.ok,false);assert.match(failed.explanation,/未找到可核验的本人录音/);assert.equal(state.rpcCalls,0);assert.equal(state.storageReads,0);
  // Control only on a cloned SYNTHETIC row: the old-format path reaches the
  // existing verification and preview grader. No production row is rewritten.
  evidence.object_key=`${tenant}/${actor}/${activity.id}/${evidence.id}.webm`;
  const control=await submitSmartTextbookActivityForContext(input,{...context,preview:true});assert.equal(control.ok,true);assert.equal(control.correct,null);assert.equal(control.score,null);assert.equal(control.nodeCompleted,false);assert.equal(state.storageReads,1);assert.equal(state.rpcCalls,0);
}));
test('4A-3 audit: original GET refuses independent-output and roleplay replay despite valid owned evidence',async()=>isolated(async()=>{
  for(const key of ['speaking-introduction','dialogue-roleplay']) {
    const activity=source.activities.find(a=>a.activity_key===key),metadata=key==='dialogue-roleplay'?{sceneId:'campus',roleSide:'left',turnIndex:0}:{};
    const result=await (await upload(activity,metadata)).json();assert.ok(result.evidenceId);
    const replay=await routes.GET(new Request(`https://isolated-runtime-test.invalid/recording?evidenceId=${result.evidenceId}`),{params:Promise.resolve({activityId:activity.id})});assert.equal(replay.status,404);
  }
}));
test('4A-3 audit: original role/repeat uploads omit storage=r2; DELETE consequently attempts wrong backend',async()=>isolated(async({state,storage})=>{
  for(const key of ['dialogue-roleplay','speaking-introduction']) {
    const activity=source.activities.find(a=>a.activity_key===key),metadata=key==='dialogue-roleplay'?{sceneId:'campus',roleSide:'left',turnIndex:0}:{practiceKey:'full-recall',trackIndex:0,segmentIndex:0};
    const result=await (await upload(activity,metadata)).json(),evidence=state.tables.digital_textbook_speaking_evidence.find(e=>e.id===result.evidenceId);
    assert.ok(storage.objects.has(evidence.object_key));assert.equal(evidence.metadata.storage,undefined);
    const response=await routes.DELETE(new Request(`https://isolated-runtime-test.invalid/recording?evidenceId=${evidence.id}`,{method:'DELETE'}),{params:Promise.resolve({activityId:activity.id})});assert.equal(response.status,503);assert.ok(storage.objects.has(evidence.object_key));
  }
  assert.equal(state.storageDeletes,2);
}));
test('4A-3 audit: original owner-without-tenant cannot save repeat or upload; do not impersonate a student for preview',async()=>isolated(async()=>{
  const mapping=compiled.services.guidedRepeat[0],activity=source.activities.find(a=>a.id===mapping.activityId);
  const result=await actions.saveGuidedRepeatProgressAction({activityId:mapping.activityId,practiceKey:'repeat-line',trackIndex:0,segmentIndex:0});assert.equal(result.ok,false);
  assert.equal((await upload(activity)).status,403);
},'platform_owner',false));
test('4A-3 audit: 14 frozen IDs → original repeat Action → isolated upsert → restored stable IDs; duplicate saves do not create completion attempts',async()=>isolated(async({state})=>{
  const scope={sourceRevision:compiled.services.sourceRevision,versionId:manifest.version.id,actorId:actor,tenantId:tenant,authorized:true};
  for(const r of compiled.services.guidedRepeat)for(let repeat=0;repeat<2;repeat++){
    const input=guidedRepeatServiceInput(compiled.services,scope,r.trackId,r.segmentId);assert.equal((await actions.saveGuidedRepeatProgressAction(input)).ok,true);
  }
  const rows=state.tables.digital_textbook_guided_repeat_progress;assert.equal(rows.length,14);assert.equal(state.rpcCalls,0);
  const restored=projectGuidedRepeat(compiled.services,scope,rows.map(r=>({activityId:r.activity_id,practiceKey:r.practice_key,trackIndex:r.track_index,segmentIndex:r.segment_index})));
  assert.deepEqual(restored,compiled.services.guidedRepeat.map(r=>r.segmentId).sort());
}));
test('4A-3 audit: repository speaking RPC definition requires legacy storage.objects evidence and a consumption lock',()=>{
  const sql=readFileSync('supabase/migrations/202608180023_speaking_recording_evidence.sql','utf8');
  assert.match(sql,/from storage\.objects as object/);assert.match(sql,/for update/);assert.match(sql,/consumed_at is not null/);
  // Source evidence only; this does NOT assert which SQL is deployed remotely.
});
