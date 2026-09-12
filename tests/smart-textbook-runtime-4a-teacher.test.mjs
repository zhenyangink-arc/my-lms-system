import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { compiled,source,evidence } from './fixtures/runtime-4a.mjs';

test('teacher projection calls actual legacy resolver, scoped v23 speech and blackboard; no fabricated task event',async()=>{
  const bundle=await build({entryPoints:['src/features/smart-textbook-runtime/server/audit-teacher.server.ts'],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'test-server-marker',setup(b){b.onResolve({filter:/^server-only$/},()=>({path:'server-only',namespace:'test-marker'}));b.onLoad({filter:/.*/,namespace:'test-marker'},()=>({contents:'export {};'}));}}]});
  const {auditTeacherTurn}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  const tables={learning_agent_script_audio_assets:evidence.speech,learning_agent_script_nodes:source.teachingNodes,learning_agent_script_versions:source.teachingVersions};
  const admin={from(table){if(!(table in tables))throw Error(`Unprovided private table ${table}`);let rows=tables[table];return {select(){return this;},eq(key,value){rows=rows.filter(r=>r[key]===value);return this;},async maybeSingle(){return {data:rows[0]??null,error:null};},then(resolve){resolve({data:rows,error:null});}};}};
  const data={admin,source,result:compiled},ref=compiled.manifest.teachingRefs[0].id;
  let state={scriptVersionId:compiled.manifest.teachingRefs[0].revision,currentNodeKey:null,teachingState:{},completedTaskEvents:[]};
  const first=await auditTeacherTurn(data,state,ref,'start',undefined,'zh-CN');
  assert.ok(first.turn.text.length);assert.ok(first.turn.character);assert.ok(first.turn.blackboard.length);assert.ok(first.turn.speechAssetId);
  assert.equal(evidence.speech.find(a=>a.id===first.turn.speechAssetId).segment_index,0);
  assert.deepEqual(first.state.completedTaskEvents,[]);
  assert.doesNotMatch(JSON.stringify(first.turn),/object_key|answer_key|service_role|scriptSecret/);
  state=first.state;
  // A task can become visible but is never acknowledged by a client 'ready'.
  for(let i=0;i<10;i++){
    const next=await auditTeacherTurn(data,state,ref,'ready',undefined,'zh-CN');state=next.state;
    if(next.turn.task){assert.equal(next.turn.task.playbackGrantAvailable,false);assert.ok(next.turn.task.target.startsWith('step:'));assert.deepEqual(state.completedTaskEvents,[]);return;}
  }
  assert.fail('Expected current published studentTask within the opening turns');
});
