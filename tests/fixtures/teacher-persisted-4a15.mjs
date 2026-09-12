import {readFile} from 'node:fs/promises';
import {randomUUID,randomBytes} from 'node:crypto';
import {isolatedRecordingPostgres,literal as q,json} from './recording-v2-postgres.mjs';
import {serverModule,teacherSession} from './runtime-4a2.server.mjs';
import {source,evidence,compiled,manifest} from './runtime-4a.mjs';
import {teacherSqlTransport} from './teacher-sql-transport-4a15.mjs';
import {learningSessionFixture} from './learning-session-4a12.mjs';
import {wav} from './teacher-boundary-4a14.mjs';

const context='globalThis.__teacherPersisted15';
const overrides={
  '../../../lib/auth':`export async function getAuthContext(){return ${context}.auth;}`,
  '@/lib/auth':`export async function getAuthContext(){return ${context}.auth;}`,
  '../../../lib/supabase/admin':`export function createAdminClient(){return ${context}.admin;}`,
  '@/lib/supabase/admin':`export function createAdminClient(){return ${context}.admin;}`,
  'next/server':'export class NextResponse extends Response{static json(x,o){return Response.json(x,o);}}',
  // Do NOT substitute respond/events/resolver, grader, TTS grant, or selectors.
};
const {createTeacherRuntimeBoundary}=await serverModule('src/features/smart-textbook-runtime/server/teacher-boundary.server.ts');
const {productionTeacherBackend}=await serverModule('src/features/smart-textbook-runtime/server/production-teacher-backend.server.ts',overrides);
const text=p=>readFile(`supabase/migrations/${p}`,'utf8');
const table=(sql,name)=>{const result=sql.match(new RegExp(`create table (?:if not exists )?public\\.${name} \\([\\s\\S]*?\\n\\);`));if(!result)throw Error(`Missing real DDL ${name}`);return result[0];};

export async function persistedTeacherFixture(){
  const db=await isolatedRecordingPostgres(randomBytes(32));let learning;
  try{
    await db.query(await readFile('tests/fixtures/teacher-agent-4a15.sql','utf8'));
    const old=await text('202608260001_teaching_agent_phase_one.sql');
    for(const suffix of ['lessons','steps','sessions','messages'])await db.query(table(old,`digital_textbook_teaching_${suffix}`).replaceAll('digital_textbook_teaching_','learning_agent_'));
    const multi=await text('202608260002_multi_subject_learning_agent_runtime.sql');await db.query(table(multi,'learning_agent_profiles'));
    for(const name of ['learning_agent_lessons','learning_agent_sessions','learning_agent_messages'])await db.query(`alter table public.${name} add column agent_profile_id uuid references public.learning_agent_profiles(id);`);
    const studio=await text('202608260006_learning_agent_script_studio.sql');
    for(const name of ['learning_agent_script_versions','learning_agent_script_nodes','learning_agent_node_attempts'])await db.query(table(studio,name));
    await db.query(studio.match(/alter table public\.learning_agent_sessions[\s\S]*?;/)[0]);
    await db.query(studio.match(/alter table public\.learning_agent_messages[\s\S]*?check \(intent is null[\s\S]*?;/)[0]);
    await db.query(table(await text('202608260008_learning_agent_student_task_events.sql'),'learning_agent_task_events'));
    await db.query(table(await text('202608280006_add_learning_agent_script_audio_assets.sql'),'learning_agent_script_audio_assets'));
    await db.query('grant all on all tables in schema public to service_role;');
    const seed=async(table,row)=>{
      const columns=(await db.query(`select column_name from information_schema.columns where table_schema='public' and table_name=${q(table)}`)).split('\n');
      const entries=Object.entries(row).filter(([k,v])=>columns.includes(k)&&v!==undefined);
      const value=v=>v===null?'null':typeof v==='object'?json(v):typeof v==='boolean'||typeof v==='number'?String(v):q(v);
      await db.query(`insert into public.${table} (${entries.map(([k])=>`"${k}"`).join(',')}) values(${entries.map(([,v])=>value(v)).join(',')});`);
    };
    const tenant=randomUUID(),student=randomUUID(),sessionId=randomUUID(),lesson={...source.lessons.find(l=>l.id===source.teachingVersions[0].lesson_id),agent_profile_id:randomUUID(),status:'published'};
    await db.query(`insert into public.tenants values(${q(tenant)});insert into auth.users values(${q(student)});`);
    await seed('learning_agent_profiles',{id:lesson.agent_profile_id,agent_code:'uply-korean-teacher',subject_code:'korean',display_name:{'zh-CN':'隔离金老师'},access_feature:'korean_course',status:'published'});
    await seed('digital_textbooks',{...source.textbook,agent_profile_id:lesson.agent_profile_id});await seed('digital_textbook_versions',source.version);await seed('digital_textbook_chapters',source.chapter);
    for(const r of source.modules)await seed('digital_textbook_modules',r);for(const r of source.nodes)await seed('digital_textbook_nodes',r);for(const r of source.activities)await seed('digital_textbook_activities',r);
    for(const r of source.activities)await seed('digital_textbook_activity_secrets',{activity_id:r.id,answer_key:{kind:'index',value:0},explanation:{correct:{'zh-CN':'隔离正确反馈'}}});
    await seed('learning_agent_lessons',lesson);
    for(const [index,key] of ['start','ready','hint','example'].entries())await seed('learning_agent_steps',{lesson_id:lesson.id,step_key:key,sort_order:index+1,content:{'zh-CN':'隔离默认讲解'},action_type:'none'});
    await seed('learning_agent_script_versions',source.teachingVersions[0]);for(const r of source.teachingNodes)await seed('learning_agent_script_nodes',r);
    // Synthetic path satisfies the ACTUAL historical check constraint; no object
    // is uploaded or read. Byte transport is isolated and public DTOs omit it.
    for(const r of evidence.speech)await seed('learning_agent_script_audio_assets',{...r,object_key:`learning-agent/speech/teacher-kim/v1/isolated-${r.id}/${r.locale}/${r.segment_index}-0000000000000000.mp3`});
    const first=[...source.teachingNodes].sort((a,b)=>a.sort_order-b.sort_order)[0];
    await seed('learning_agent_sessions',{id:sessionId,tenant_id:tenant,student_id:student,lesson_id:lesson.id,agent_profile_id:lesson.agent_profile_id,script_version_id:first.script_version_id,current_node_id:first.id,teaching_state:{scriptSegmentNodeId:first.id,scriptSegmentIndex:0,teachingTurnNodeId:first.id,teachingTurnPhase:'explanation'},status:'active'});
    const admin=teacherSqlTransport(db),auth={status:'active',tenant:{id:tenant},user:{id:student},profile:{role:'student',membership_tier:'vip2'},supabase:admin};
    globalThis.__teacherPersisted15={auth,admin};learning=await learningSessionFixture();
    const data={...teacherSession().data,admin,source,result:structuredClone(compiled)},requests=[],media=[];
    const scope=async ref=>{if(ref!==learning.sessionRef)throw Error('Opaque learning scope');const resumed=await learning.boundary.resume({sessionRef:ref});return{
      snapshot:manifest.snapshot.id,sourceRevision:compiled.report.sourceRevision,scriptVersionId:first.script_version_id,textbookId:source.textbook.id,moduleId:lesson.module_id,lessonId:lesson.id,agentProfileId:lesson.agent_profile_id,agentCode:'uply-korean-teacher',locale:'zh-CN',supportMode:'chinese',generation:resumed.generation,expiresAt:Date.now()+600000};};
    const boundary=createTeacherRuntimeBoundary({authorize:async()=>({actorId:auth.user.id,tenantId:auth.tenant.id,role:'learner'}),
      resolveScope:async ref=>{const s=await scope(ref),r=await learning.boundary.resume({sessionRef:ref});return{data,generation:s.generation,stepId:r.activeStepId,locale:'zh-CN',expiresAt:s.expiresAt,authority:{actorId:student,tenantId:tenant}};},
      createBackend:productionTeacherBackend({scope,request:()=>new Request('https://isolated.invalid/teacher')}),
      readSpeech:async selection=>{media.push(selection.assetId);return new Blob([wav()],{type:'audio/wav'});},
      readCharacter:async()=>new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64')],{type:'image/png'}),
    });
    return{db,admin,auth,data,learning,boundary,requests,media,sessionId,tenant,student,scope,async rows(table){return JSON.parse(await db.query(`select coalesce(jsonb_agg(to_jsonb(r)),'[]') from public.${table} r`));},async dispose(){delete globalThis.__teacherPersisted15;learning.dispose();await db.stop();}};
  }catch(e){learning?.dispose();await db.stop();throw e;}
}
