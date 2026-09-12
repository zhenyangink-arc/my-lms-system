import {readFile} from 'node:fs/promises';
import {persistedTeacherFixture} from './teacher-persisted-4a15.mjs';
import {source,evidence} from './runtime-4a.mjs';
import {serverModule} from './runtime-4a2.server.mjs';
import {recordingSqlTransport} from './recording-4a7-transport.mjs';
import {literal as q,json,service} from './recording-v2-postgres.mjs';

const ident=k=>{if(!/^[a-z_][a-z_0-9]*$/.test(k))throw Error('SQL identifier');return `"${k}"`;};
const value=v=>v===null?'null':typeof v==='object'?json(v):typeof v==='number'||typeof v==='boolean'?String(v):q(v);
const text=p=>readFile(`supabase/migrations/${p}`,'utf8');
// Only SQL/auth/byte transports are substituted. Publisher, capture projection,
// immutable repository, published Loader and durable resolver are real modules.
export const publishedOverrides={};
for(const p of ['../auth','../../../lib/auth','@/lib/auth'])publishedOverrides[p]='export async function requireActiveUser(){return globalThis.__publishedChapter.auth;} export async function getAuthContext(){return globalThis.__publishedChapter.auth;} export function isActiveProfileStatus(s){return s==="active";}';
for(const p of ['../supabase/admin','../../../lib/supabase/admin','@/lib/supabase/admin'])publishedOverrides[p]='export function createAdminClient(){return globalThis.__publishedChapter.admin;}';
publishedOverrides['next/server']='export class NextResponse extends Response{static json(x,o){return Response.json(x,o);}}';
publishedOverrides['next/cache']='export function revalidatePath(){} export function revalidateTag(){} export function unstable_noStore(){}';
publishedOverrides['next/headers']='export async function cookies(){throw Error("Unexpected cookie access outside authorized isolated transport");} export async function headers(){return new Headers();}';

export async function publishedChapterFixture(){
  const original=await persistedTeacherFixture(),{db}=original;
  const savedEnv=Object.fromEntries(Object.entries(process.env).filter(([k])=>k.startsWith('RECORDING_EVIDENCE_')));
  try{
    const rows={digital_textbooks:[source.textbook],digital_textbook_versions:[source.version],digital_textbook_chapters:[{...source.chapter,chapter_test_id:evidence.chapter.chapter_test_id}],
      digital_textbook_modules:source.modules,digital_textbook_nodes:source.nodes,digital_textbook_activities:source.activities,
      digital_textbook_media_assets:source.media,digital_textbook_listening_tracks:source.tracks,
      learning_agent_lessons:source.lessons,
      learning_agent_script_audio_assets:evidence.speech,chapter_tests:[evidence.chapter.chapter_tests]};
    // Fill synthetic transport columns with EXACT frozen content. Actual Agent,
    // attempt RPC and the TWO publication migrations run unmodified in PG.
    for(const [table,items]of Object.entries(rows)){
      const columns=new Set((await db.query(`select column_name from information_schema.columns where table_schema='public' and table_name=${q(table)}`)).split('\n').filter(Boolean));
      if(!columns.size)await db.query(`create table public.${ident(table)} (_isolated boolean);`);
      const fields=Object.keys(items[0]);
      for(const field of fields)if(!columns.has(field)){
        const sample=items.find(x=>x[field]!==null)?.[field];
        const type=typeof sample==='object'?'jsonb':typeof sample==='number'?'integer':typeof sample==='boolean'?'boolean':field==='id'||field.endsWith('_id')?'uuid':'text';
        await db.query(`alter table public.${ident(table)} add column ${ident(field)} ${type}`);
      }
      const key=fields.includes('id')?'id':'activity_id';
      for(const row of items){
        const where=`${ident(key)}=${value(row[key])}${key==='activity_id'?` and page_index=${row.page_index}`:''}`;
        const exists=await db.query(`select count(*) from public.${ident(table)} where ${where}`);
        if(exists!=='0')await db.query(`update public.${ident(table)} set ${Object.entries(row).map(([k,v])=>`${ident(k)}=${value(v)}`).join(',')} where ${where}`);
        else await db.query(`insert into public.${ident(table)}(${Object.keys(row).map(ident)}) values(${Object.values(row).map(value)})`);
      }
    }
    await db.query(`create table public.profiles(id uuid primary key,global_role text,status text);
      insert into public.profiles values(${q(original.student)},'platform_owner','active');
      create table public.learning_agent_profile_secrets(agent_profile_id uuid,system_prompt text,model text);
      create table public.learning_agent_node_interaction_secrets(node_id uuid primary key,answer_key jsonb,explanation jsonb);
      create table public.digital_textbook_preferences(tenant_id uuid,student_id uuid,textbook_id uuid,interface_locale text);
      create table public.digital_textbook_activity_page_progress(tenant_id uuid,student_id uuid,version_id uuid,activity_id uuid,page_index integer,item_indices jsonb,response jsonb,results jsonb);
      create table public.digital_textbook_guided_repeat_progress(tenant_id uuid,student_id uuid,version_id uuid,activity_id uuid,practice_key text,track_index integer,segment_index integer);
      alter table public.digital_textbook_attempts add column id uuid default gen_random_uuid(),add column created_at timestamptz default clock_timestamp();
      alter table public.digital_textbook_attempts alter column meets_completion_requirements set default false;
      grant all on all tables in schema public to service_role;`);
    await db.query(await text('202608180027_restore_objective_activity_recording.sql'));
    await db.query(await text('202609100001_runtime_publish_foundation.sql'));
    await db.query(await text('202609100002_runtime_publication_dependency_fence.sql'));
    // Isolated coordinator rehearsal ONLY. No host environment/deployment change.
    await db.query(await text('202609090002_recording_domain_coordination.sql'));
    await db.query(`insert into recording_private.domain_instances values('publication-isolated',1);
      select recording_private.transition_domain('open',1);
      select recording_private.transition_domain('drain',1);
      select recording_private.transition_domain('fence',1);
      update recording_private.domain_instances set acknowledged_epoch=2;
      select recording_private.transition_domain('switch',2,true,${json([{tenantId:original.tenant,studentId:original.student}])});
      select recording_private.transition_domain('open',2);`);
    Object.assign(process.env,{RECORDING_EVIDENCE_V2_ENABLED:'true',RECORDING_EVIDENCE_V2_EPOCH:'2',RECORDING_EVIDENCE_INSTANCE_ID:'publication-isolated',RECORDING_EVIDENCE_V2_SCOPE:JSON.stringify([{tenantId:original.tenant,studentId:original.student}])});
    const rpc=recordingSqlTransport(db,()=>{throw Error('NO OBJECT STORAGE IN PUBLICATION TEST');});
    const admin={async rpc(name,args){
      if(name==='assert_runtime_dependency_fence_v1'){
        const r=await db.raw(service(`select to_jsonb(public.assert_runtime_dependency_fence_v1(${q(args.p_snapshot)},${json(args.p_capture)}))`));
        return r.code?{data:null,error:{message:r.stderr}}:{data:JSON.parse(r.stdout),error:null};
      }
      return rpc.rpc(name,args);
    },from(table){
      if(table.startsWith('learning_agent_')&&!['learning_agent_profiles','learning_agent_lessons','learning_agent_script_versions','learning_agent_script_nodes','learning_agent_script_audio_assets'].includes(table))return original.admin.from(table);
      if(table==='digital_textbook_speaking_evidence')return rpc.from(table);
      ident(table);let predicates=[],orders=[],limit='',head=false,signal,columns='';
      const b={select(c,options={}){columns=c;head=!!options.head;return b;},eq(k,v){predicates.push(`${ident(k)}=${value(v)}`);return b;},in(k,vs){predicates.push(vs.length?`${ident(k)} in (${vs.map(value)})`:'false');return b;},
        order(k,{ascending=true}={}){orders.push(`${ident(k)} ${ascending?'asc':'desc'}`);return b;},limit(n){if(!Number.isInteger(n))throw Error('limit');limit=` limit ${n}`;return b;},abortSignal(s){signal=s;return b;},
        or(expression){const m=/^created_at\.(lt|gt)\.([^,]+),and\(created_at.eq.([^,]+),id\.(lte|gt)\.([a-f0-9-]+)\)$/.exec(expression);if(!m||m[2]!==m[3])throw Error('SQL cursor');predicates.push(`(created_at ${m[1]==='lt'?'<':'>'} ${q(m[2])} or (created_at=${q(m[3])} and id ${m[4]==='lte'?'<=':'>'} ${q(m[5])}))`);return b;},
        async maybeSingle(){const r=await finish();return {...r,data:r.data?.[0]??null};},async single(){return b.maybeSingle();},then(resolve,reject){return finish().then(resolve,reject);}};
      async function finish(){signal?.throwIfAborted();const extra=table==='digital_textbook_nodes'?`,(select jsonb_build_object('digital_textbook_chapters',jsonb_build_object('version_id',c.version_id)) from public.digital_textbook_modules m join public.digital_textbook_chapters c on c.id=m.chapter_id where m.id=base.module_id) as digital_textbook_modules`:'';
        const sql=`select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select base.*${extra} from public.${ident(table)} base${predicates.length?' where '+predicates.join(' and '):''}${orders.length?' order by '+orders.join(','):''}${limit})r`;
        const result=await db.raw(service(sql));if(result.code)return {data:null,error:{message:result.stderr}};
        const data=JSON.parse(result.stdout);return {data:head?null:data,count:head?data.length:null,error:null};}
      return b;
    }};
    const auth={...original.auth,supabase:admin,profile:{...original.auth.profile,global_role:'platform_owner'}};
    globalThis.__publishedChapter={auth,admin};
    const publisher=await serverModule('src/lib/smart-textbook-publishing/publisher.server.ts',publishedOverrides);
    const loader=await serverModule('src/lib/smart-textbook-publishing/loader.server.ts',publishedOverrides);
    const session=await serverModule('src/features/smart-textbook-runtime/server/learning-session.server.ts',publishedOverrides);
    const boundaryModule=await serverModule('src/features/smart-textbook-runtime/server/production-learning-boundary.server.ts',publishedOverrides);
    const boundary=boundaryModule.createProductionLearningBoundary(async()=>new Request('https://publication-isolated.invalid'));
    return {...original,admin,auth,publisher,loader,session,boundary,async dispose(){
      delete globalThis.__publishedChapter;for(const k of Object.keys(process.env))if(k.startsWith('RECORDING_EVIDENCE_'))delete process.env[k];Object.assign(process.env,savedEnv);await original.dispose();
    }};
  }catch(e){delete globalThis.__publishedChapter;for(const k of Object.keys(process.env))if(k.startsWith('RECORDING_EVIDENCE_'))delete process.env[k];Object.assign(process.env,savedEnv);await original.dispose();throw e;}
}
