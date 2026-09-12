import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync,readdirSync } from 'node:fs';
import { source,manifest } from './fixtures/runtime-4a.mjs';
import { serverModule } from './fixtures/runtime-4a2.server.mjs';
const { submitSmartTextbookActivityForContext } = await serverModule('src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-submission.ts');

// Evidence-stage diagnostics only: original application functions + synthetic
// DB/Storage transport. NO database connection, migration, auth token or network.
// RPC transport models the documented SQL contract; it is NOT a SQL execution test.
const actor='20000000-0000-4000-8000-000000000001',tenant='20000000-0000-4000-8000-000000000002';
const eid='20000000-0000-4000-8000-000000000003';
const roleActivity=source.activities.find(a=>a.activity_key==='dialogue-roleplay');
const speakingActivity=source.activities.find(a=>a.activity_key==='speaking-introduction');
const roleNode=source.nodes.find(n=>n.id===roleActivity.node_id),scene=roleNode.content.dialogueScenes[0];
const requiredTurns=scene.lines.map((_,i)=>i).filter(i=>i%2===0);
const actions=await serverModule('src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-actions.ts',{
  '@/lib/auth':'export async function requireActiveUser(){return globalThis.__recording4a4Auth;}',
  '@/lib/admin':'export function isPlatformCourseAuditorRole(role){return role==="platform_owner";}',
  '@/lib/supabase/admin':'export function createAdminClient(){return globalThis.__recording4a4Auth.supabase;}',
  '@/lib/student-permissions':'export function canUseStudentFeature(){return true;} export function normalizeMembershipTier(){return "isolated-test";}',
  '@/features/student-home-learning/api/refresh':'export function refreshStudentHomeLearningData(){globalThis.__recording4a4Refresh++;}',
});
function fixture({race=false,updateError=false,role=false}={}){
  const activity=role?roleActivity:speakingActivity;
  const evidence=(role?requiredTurns:[0]).map((turn,i)=>({
    id:role?`20000000-0000-4000-8000-${String(100+i).padStart(12,'0')}`:eid,
    tenant_id:tenant,student_id:actor,activity_id:activity.id,
    object_key:role?`student-recordings/${tenant}/${actor}/${activity.id}/20000000-0000-4000-8000-${String(100+i).padStart(12,'0')}.webm`:`${tenant}/${actor}/${activity.id}/${eid}.webm`,
    byte_size:4096,mime_type:'audio/webm',created_at:new Date().toISOString(),consumed_at:null,consumed_attempt_number:null,
    metadata:role?{sceneId:scene.id,roleSide:'left',turnIndex:turn}:{},
  }));
  const tables={
    digital_textbook_activities:[structuredClone(activity)],
    digital_textbook_nodes:[{...structuredClone(source.nodes.find(n=>n.id===activity.node_id)),digital_textbook_modules:{digital_textbook_chapters:{version_id:manifest.version.id}}}],
    digital_textbook_activity_secrets:[{activity_id:activity.id,answer_key:{kind:'open'},explanation:{'zh-CN':'合成测试反馈'}}],
    digital_textbook_speaking_evidence:evidence,digital_textbook_attempts:[],
    digital_textbook_node_progress:[{tenant_id:tenant,student_id:actor,node_id:activity.node_id,version_id:manifest.version.id,status:'in_progress',completion_percent:0}],
  };
  const log={rpc:[],updates:0,storageReads:0,progressWrites:0},pending=[];
  let rpcTail=Promise.resolve(),missingObject=false,storedMime='audio/webm';
  const db={from(table){
    assert.ok(table in tables,`unexpected table ${table}`);const filters=[];let patch=null;
    const selected=()=>tables[table].filter(r=>filters.every(f=>f(r)));
    const q={select(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},or(expression){assert.equal(expression,'metadata->runtimeBinding.not.is.null,metadata->lifecycle.not.is.null');filters.push(r=>Object.hasOwn(r.metadata??{},'runtimeBinding')||Object.hasOwn(r.metadata??{},'lifecycle'));return q;},contains(k,v){filters.push(r=>Object.entries(v).every(([key,value])=>r[k]?.[key]===value));return q;},in(k,v){filters.push(r=>v.includes(r[k]));return q;},order(){return q;},limit(){return q;},
      update(value){assert.equal(table,'digital_textbook_speaking_evidence');patch=value;return q;},
      async maybeSingle(){
        const value=structuredClone(selected()[0]??null);
        if(race&&table==='digital_textbook_attempts'&&value===null){await new Promise(resolve=>{pending.push(resolve);if(pending.length===2)pending.splice(0).forEach(r=>r());});}
        return {data:value,error:null};
      },
      then(resolve,reject){
        if(patch){log.updates++;if(updateError)return Promise.resolve({data:null,error:{message:'synthetic consumption write failure'}}).then(resolve,reject);for(const r of selected())Object.assign(r,patch);}
        return Promise.resolve({data:structuredClone(selected()),error:null}).then(resolve,reject);
      },
    };return q;
  },rpc(name,input){
    // Pre-migration gate=false regression: model PostgREST's actual missing RPC,
    // not a bypass of the new gateway or a fake successful coordinator.
    if(name==='recording_domain_request_v1')return Promise.resolve({data:null,error:{code:'PGRST202',message:'recording_domain_request_v1 not found'}});
    // Serialize as the existing advisory lock does. It allocates DIFFERENT
    // attempt numbers; numbering serialization alone is not request deduplication.
    const result=rpcTail.then(()=>{
      log.rpc.push({name,input});let e;
      if(name==='record_smart_textbook_speaking_attempt'){
        e=evidence.find(e=>e.id===input.p_evidence_id);
        if(!e||e.consumed_at)return {data:null,error:{message:'SMART_TEXTBOOK_RECORDING_EVIDENCE_INVALID'}};
      }else assert.equal(name,'record_smart_textbook_attempt');
      const number=tables.digital_textbook_attempts.length+1;
      tables.digital_textbook_attempts.push({tenant_id:tenant,student_id:actor,activity_id:activity.id,version_id:manifest.version.id,attempt_number:number,meets_completion_requirements:true});
      log.progressWrites++;
      if(e){e.consumed_at=new Date().toISOString();e.consumed_attempt_number=number;}
      return {data:[{attempt_number:number,node_completed:false,completion_percent:0,mastery_score:0,node_attempt_count:number}],error:null};
    });rpcTail=result.then(()=>{});return result;
  },storage:{from(bucket){assert.equal(bucket,'digital-textbook-student-recordings');return {async list(_prefix,{search}){log.storageReads++;return {data:missingObject?[]:[{name:search,metadata:{size:4096,mimetype:storedMime}}],error:null};}};}}};
  return {db,tables,evidence,log,setMissing:()=>{missingObject=true;},setMime:value=>{storedMime=value;}};
}
const submission={activityId:speakingActivity.id,locale:'zh-CN',response:{recorded:true,durationSeconds:20,turns:0,criteria:[true,true,true,true],recordingEvidenceId:eid}};
function submit(f,preview=false){return submitSmartTextbookActivityForContext(submission,{supabase:f.db,admin:f.db,userId:actor,tenantId:tenant,canSubmit:true,preview});}
async function withRole(f,run){
  globalThis.__recording4a4Auth={supabase:f.db,user:{id:actor},tenant:{id:tenant},profile:{role:'student'},platformProfile:{role:'student'}};
  globalThis.__recording4a4Refresh=0;
  try{return await run();}finally{delete globalThis.__recording4a4Auth;delete globalThis.__recording4a4Refresh;}
}
const roleInput={activityId:roleActivity.id,sceneId:scene.id,roleSide:'left'};

test('4A-4 evidence: original roleplay Action concurrent prechecks create two attempts despite serialized RPC numbering',{timeout:3000},async()=>{
  const f=fixture({race:true,role:true});await withRole(f,async()=>{
    const results=await Promise.all([actions.completeDialogueRoleplayAction(roleInput),actions.completeDialogueRoleplayAction(roleInput)]);
    assert.ok(results.every(r=>r.ok));assert.equal(f.log.rpc.length,2);assert.deepEqual(f.tables.digital_textbook_attempts.map(a=>a.attempt_number),[1,2]);
    assert.equal(f.log.progressWrites,2);assert.equal(f.log.updates,2);assert.ok(f.evidence.every(e=>e.consumed_attempt_number===2));
  });
});
test('4A-4 evidence: serial roleplay retry avoids another attempt, but that does NOT prove concurrent idempotency',async()=>{
  const f=fixture({role:true});await withRole(f,async()=>{
    assert.equal((await actions.completeDialogueRoleplayAction(roleInput)).ok,true);
    assert.equal((await actions.completeDialogueRoleplayAction(roleInput)).ok,true);assert.equal(f.log.rpc.length,1);
  });
});
test('4A-4 evidence: original roleplay returns success even if the separate evidence consume update fails',async()=>{
  const f=fixture({role:true,updateError:true});await withRole(f,async()=>{
    assert.equal((await actions.completeDialogueRoleplayAction(roleInput)).ok,true);assert.equal(f.tables.digital_textbook_attempts.length,1);assert.ok(f.evidence.every(e=>e.consumed_at===null));
  });
});
test('4A-4 evidence: legacy Storage speaking verifier succeeds; repeated consumed evidence fails',async()=>{
  const f=fixture();assert.equal((await submit(f)).ok,true);assert.equal((await submit(f)).ok,false);assert.equal(f.log.rpc.length,1);assert.equal(f.log.rpc[0].name,'record_smart_textbook_speaking_attempt');
});
test('4A-4 evidence: parallel speaking calls require an atomic consuming RPC (explicit contract-model transport, not live SQL)',async()=>{
  const f=fixture(),results=await Promise.all([submit(f),submit(f)]);assert.equal(results.filter(r=>r.ok).length,1);assert.equal(f.tables.digital_textbook_attempts.length,1);
});
for(const [name,mutate] of [
  ['wrong student',f=>{f.evidence[0].student_id='other';}],['wrong tenant',f=>{f.evidence[0].tenant_id='other';}],
  ['wrong activity',f=>{f.evidence[0].activity_id=roleActivity.id;}],['expired',f=>{f.evidence[0].created_at='2000-01-01T00:00:00Z';}],
  ['consumed',f=>{f.evidence[0].consumed_at=new Date().toISOString();}],['missing object',f=>f.setMissing()],['MIME mismatch',f=>f.setMime('audio/ogg')],
])test(`4A-4 evidence: original speaking verifier rejects ${name} before completion`,async()=>{
  const f=fixture();mutate(f);assert.equal((await submit(f)).ok,false);assert.equal(f.log.rpc.length,0);
});
test('4A-4 evidence: R2 path cannot pass current verifier; backend metadata conflict is currently NOT checked',async()=>{
  const f=fixture();f.evidence[0].object_key=`student-recordings/${f.evidence[0].object_key}`;f.evidence[0].metadata={storage:'r2'};
  assert.equal((await submit(f,true)).ok,false);assert.equal(f.log.storageReads,0);
  f.evidence[0].object_key=f.evidence[0].object_key.replace('student-recordings/','');
  assert.equal((await submit(f,true)).ok,true,'This exposes missing metadata consistency validation, not acceptance of a new contract');
});
for(const [name,input,mutate] of [
  ['wrong scene',{...roleInput,sceneId:'unknown'},()=>{}],['wrong role',{...roleInput,roleSide:'right'},()=>{}],
  ['missing required turn',roleInput,f=>{f.evidence[0].metadata.turnIndex=999;}],
])test(`4A-4 evidence: original role completion refuses ${name}`,async()=>{
  const f=fixture({role:true});mutate(f);await withRole(f,async()=>{assert.equal((await actions.completeDialogueRoleplayAction(input)).ok,false);assert.equal(f.log.rpc.length,0);});
});
test('4A-4 evidence: role completion does not check object existence, age or consumed state when all metadata turns exist',async()=>{
  const f=fixture({role:true});for(const e of f.evidence){e.created_at='2000-01-01T00:00:00Z';e.consumed_at='2000-01-02T00:00:00Z';}f.setMissing();
  await withRole(f,async()=>{assert.equal((await actions.completeDialogueRoleplayAction(roleInput)).ok,true);assert.equal(f.log.storageReads,0);assert.equal(f.log.rpc.length,1);});
});
test('4A-4 evidence: SQL source requires Storage and atomic single-evidence consume; attempt uniqueness is not roleplay idempotency',()=>{
  const files=readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).map(f=>({name:f,sql:readFileSync(`supabase/migrations/${f}`,'utf8')}));
  const definitions=files.filter(f=>/create\s+(?:or\s+replace\s+)?function\s+public\.record_smart_textbook_speaking_attempt\s*\(/i.test(f.sql));
  assert.deepEqual(definitions.map(f=>f.name),['202608180023_speaking_recording_evidence.sql']);const sql=definitions[0].sql;
  assert.match(sql,/for update/);assert.match(sql,/from storage\.objects/);assert.match(sql,/evidence\.consumed_at is not null/);
  assert.ok(sql.indexOf('for update')<sql.indexOf('from public.record_smart_textbook_attempt('));assert.ok(sql.indexOf('from public.record_smart_textbook_attempt(')<sql.indexOf('update public.digital_textbook_speaking_evidence'));
  const attempt=files.find(f=>f.name==='202608180008_open_activity_unscored_mastery.sql').sql;
  assert.match(attempt,/pg_advisory_xact_lock/);assert.match(attempt,/v_attempt_number := v_attempt_number \+ 1/);
  const table=files.find(f=>f.name==='202607310013_smart_digital_textbook_chapter_one.sql').sql;assert.match(table,/unique \(tenant_id, student_id, activity_id, attempt_number\)/);
});
