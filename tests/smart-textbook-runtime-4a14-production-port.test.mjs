import test from 'node:test';
import assert from 'node:assert/strict';
import {serverModule} from './fixtures/runtime-4a2.server.mjs';
const {createProductionTeacherAgentAdapter}=await serverModule('src/features/smart-textbook-runtime/server/production-teacher-agent.server.ts',{
  '../../../lib/auth':'export async function getAuthContext(){return globalThis.teacherPort14.auth;}',
  '../../../lib/supabase/admin':'export function createAdminClient(){return globalThis.teacherPort14.db;}',
  '../../../app/api/learning-agent/respond/route':'export async function POST(r){return globalThis.teacherPort14.respond(r);}',
  '../../../app/api/learning-agent/events/route':'export async function POST(r){return globalThis.teacherPort14.event(r);}',
});
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;

/** Protocol test: actual adapter + scoped Reader, substituted auth/DB/HTTP domain
 * transports. This is deliberately NOT claimed as mounted production Agent E2E. */
test('4A14 production Agent private port restores existing tables and delegates old respond/event; no third model',async t=>{
  const queries=[],posts=[],scope={snapshot:'frozen-snapshot',sourceRevision:'frozen-source',scriptVersionId:id(23),textbookId:id(1),moduleId:id(2),lessonId:id(3),agentProfileId:id(4),agentCode:'teacher',locale:'zh-CN',supportMode:'chinese',generation:1,expiresAt:Date.now()+60000};
  const row={id:id(5),script_version_id:id(23),current_node_id:id(6),teaching_state:{scriptSegmentIndex:1},status:'active',tenant_id:id(7),student_id:id(8),lesson_id:id(3),agent_profile_id:id(4),updated_at:'2026-09-10'};
  const tables={learning_agent_lessons:[{id:id(3),module_id:id(2),agent_profile_id:id(4),status:'published'}],digital_textbooks:[{id:id(1),agent_profile_id:id(4),status:'published'}],learning_agent_script_versions:[{id:id(23),lesson_id:id(3),status:'published'}],learning_agent_sessions:[row],learning_agent_script_nodes:[{id:id(6),script_version_id:id(23)}],learning_agent_task_events:[]};
  let duplicate=false,eventFails=false;
  globalThis.teacherPort14={auth:{status:'active',tenant:{id:id(7)},user:{id:id(8)}},db:{from(table){assert(table in tables);const q={table,filters:[],order:null,limit:null};queries.push(q);let rows=tables[table];return{
    select(){return this;},eq(k,v){q.filters.push([k,v]);rows=rows.filter(r=>r[k]===v);return this;},order(k,options){q.order=[k,options];return this;},limit(n){q.limit=n;rows=rows.slice(0,n);return this;},async maybeSingle(){return{data:rows[0]??null,error:null};},then(resolve){resolve({data:rows,error:null});}
  };}},respond:async request=>{posts.push(['respond',await request.json()]);row.teaching_state={scriptSegmentIndex:2};return new Response('原 responder 返回文本',{headers:{'X-Learning-Agent-Session':id(5)}});},event:async request=>{posts.push(['event',await request.json()]);return new Response('{}',{status:eventFails?503:200});}};
  const adapter=createProductionTeacherAgentAdapter({request:new Request('https://isolated.invalid/teacher'),scope:async()=>scope,
    consumeObservation:async(grant,session,s)=>{assert.equal(grant,id(9));assert.equal(session.sessionId,id(5));assert.equal(s.scriptVersionId,id(23));const wasDuplicate=duplicate;duplicate=true;return{teachingPlaybackWaitSatisfied:!wasDuplicate,duplicate:wasDuplicate,formalCompletion:false,score:null,progressDelta:null,agentAdvance:false,targetKey:'dialogue:greeting:0',nodeId:id(6)};}});
  try{
    await t.test('owned active latest Reader retains original teaching_state and no completed-session resurrection',async()=>{
      const restored=await adapter.restore();assert.equal(restored.value.sessionId,id(5));assert.equal(restored.value.teachingState.scriptSegmentIndex,1);
      const query=queries.find(q=>q.table==='learning_agent_sessions');for(const filter of [['student_id',id(8)],['tenant_id',id(7)],['lesson_id',id(3)],['agent_profile_id',id(4)],['status','active']])assert(query.filters.some(f=>JSON.stringify(f)===JSON.stringify(filter)));
      assert.deepEqual(query.order,['updated_at',{ascending:false}]);assert.equal(query.limit,1);
      row.status='completed';assert.equal((await adapter.restore()).value,null);await assert.rejects(adapter.turn({sessionId:id(5),intent:'ready'}),/COMPLETED/);row.status='active';
    });
    await t.test('turn uses old responder and rereads its persisted result, never invokes a second resolver',async()=>{
      const result=await adapter.turn({intent:'ready'});assert.equal(result.state.teachingState.scriptSegmentIndex,2);assert.equal(result.text,'原 responder 返回文本');
      assert.deepEqual(posts[0],['respond',{textbookId:id(1),moduleId:id(2),agentCode:'teacher',sessionId:id(5),intent:'ready',locale:'zh-CN',supportMode:'chinese'}]);
    });
    await t.test('grant consume then failed event remains error; retry delegates idempotent old event and no extra advance',async()=>{
      eventFails=true;await assert.rejects(adapter.observe(id(5),id(9)),/EVENT_REJECTED/);eventFails=false;
      const result=await adapter.observe(id(5),id(9));assert.deepEqual(result,{teachingPlaybackWaitSatisfied:false,duplicate:true,formalCompletion:false,score:null,progressDelta:null,agentAdvance:false});
      assert.deepEqual(posts.filter(p=>p[0]==='event').map(p=>p[1]),Array(2).fill({sessionId:id(5),eventType:'audio_completed',targetKey:'dialogue:greeting:0'}));
    });
    await t.test('different owner, unpublished revision, expired scope reject before responder',async()=>{
      const count=posts.length;globalThis.teacherPort14.auth.user.id=id(99);assert.equal((await adapter.restore()).value,null);await assert.rejects(adapter.turn({sessionId:id(5),intent:'ready'}),/SESSION_SCOPE/);globalThis.teacherPort14.auth.user.id=id(8);
      scope.scriptVersionId=id(24);await assert.rejects(adapter.turn({intent:'ready'}),/REVISION/);scope.scriptVersionId=id(23);
      scope.expiresAt=0;await assert.rejects(adapter.restore(),/AUTHORITY/);assert.equal(posts.length,count);
    });
  }finally{delete globalThis.teacherPort14;}
});
