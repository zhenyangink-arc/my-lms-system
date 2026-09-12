import assert from 'node:assert/strict';
import { source, evidence, compiled } from './runtime-4a.mjs';
import { teacherSession, serverModule } from './runtime-4a2.server.mjs';
import { learningSessionFixture } from './learning-session-4a12.mjs';
const {createTeacherRuntimeBoundary}=await serverModule('src/features/smart-textbook-runtime/server/teacher-boundary.server.ts');

export function wav(seconds=.06){
  const size=Math.ceil(8000*seconds)*2,b=Buffer.alloc(44+size);b.write('RIFF');b.writeUInt32LE(36+size,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(size,40);return b;
}
// Isolated transport pixel, NOT a production character asset assertion.
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
export async function teacherBoundaryFixture(){
  const learning=await learningSessionFixture(),reads=[],media=[],characters=[];
  const data={...teacherSession().data,result:structuredClone(compiled)};
  const tables={learning_agent_script_audio_assets:evidence.speech,learning_agent_script_nodes:source.teachingNodes,
    learning_agent_script_versions:source.teachingVersions,digital_textbook_activities:source.activities,
    digital_textbook_activity_secrets:source.activities.map(a=>({activity_id:a.id,answer_key:{kind:'index',value:0},explanation:{correct:{'zh-CN':'隔离正确反馈'}}}))};
  data.admin={from(table){assert(table in tables,`Unexpected mutation/table: ${table}`);reads.push(table);let rows=tables[table];return{select(){return this;},eq(k,v){rows=rows.filter(r=>r[k]===v);return this;},async maybeSingle(){return{data:rows[0]??null,error:null};},then(resolve){resolve({data:rows,error:null});}};}};
  let authority={actorId:'isolated-owner',role:'platform_owner'},audioFailure=false,audioDuration=.06,gate=null;
  const boundary=createTeacherRuntimeBoundary({authorize:async()=>authority,resolveScope:async scope=>{
    assert.equal(scope,learning.sessionRef);const r=await learning.boundary.resume({sessionRef:scope});
    return{data,stepId:r.activeStepId,generation:r.generation,locale:'zh-CN',expiresAt:Date.now()+600000};
  },readSpeech:async selection=>{media.push(selection);if(gate){const wait=gate;gate=null;wait.started();await wait.promise;}return new Blob([audioFailure?'broken bytes':wav(audioDuration)],{type:'audio/wav'});},
  readCharacter:async(pose)=>{characters.push(pose);return new Blob([pixel],{type:'image/png'});}});
  return{learning,data,boundary,reads,media,characters,setAuthority:x=>authority=x,setAudioFailure:x=>audioFailure=x,setAudioDuration:x=>audioDuration=x,
    holdSpeech(){let started,release;const entered=new Promise(r=>started=r),promise=new Promise(r=>release=r);gate={started,promise};return{entered,release};},dispose:()=>learning.dispose()};
}
