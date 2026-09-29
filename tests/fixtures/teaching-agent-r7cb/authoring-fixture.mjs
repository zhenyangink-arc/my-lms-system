import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {startDatabase,literal as q,json as J} from '../teaching-agent-r7c/postgres.mjs';
export const migration=readFileSync(new URL('../../../supabase/migrations/202609170001_teaching_lesson_activity_binding.sql',import.meta.url),'utf8');
// Only the approved freeze lock is rebound to owned synthetic identities. SQL behavior is unchanged.
export async function startAuthoring({lessonRls=false}={}){
 const db=await startDatabase(),id=()=>randomUUID();
 const ids={owner:id(),app:id(),course:id(),lesson:id(),book:id(),version:id(),chapter:id(),module:id(),teaching:id(),script:id()};
 try{
  const nodes=JSON.parse(readFileSync(new URL('../../../docs/evidence/teaching-agent-stage-1f-r6f/final-nodes.json',import.meta.url))).nodes;
  await db.raw(`BEGIN;
  CREATE ROLE r7cb_unprivileged;
  CREATE TABLE public.test_profile(id uuid PRIMARY KEY,status text);
  CREATE VIEW public.profiles AS SELECT id,CASE WHEN current_setting('test.inactive',true)='true' THEN 'inactive' ELSE status END AS status FROM public.test_profile;
  CREATE VIEW public.tenant_provisioned_accounts AS SELECT id AS user_id FROM public.test_profile WHERE current_setting('test.provisioned',true)='true';
  CREATE TABLE public.student_apps(id uuid PRIMARY KEY,slug text);
  CREATE TABLE public.courses(id uuid PRIMARY KEY,student_app_id uuid REFERENCES public.student_apps);
  ALTER TABLE public.lessons ADD COLUMN course_id uuid REFERENCES public.courses;
  CREATE TABLE public.learning_agent_lessons(id uuid PRIMARY KEY,module_id uuid REFERENCES public.digital_textbook_modules,objectives jsonb${lessonRls?",status text NOT NULL DEFAULT 'draft'":''});
  CREATE TABLE public.learning_agent_script_versions(id uuid PRIMARY KEY,lesson_id uuid REFERENCES public.learning_agent_lessons,version_number int,status text,published_at timestamptz);
  CREATE TABLE public.learning_agent_script_nodes(id uuid PRIMARY KEY,script_version_id uuid REFERENCES public.learning_agent_script_versions,sort_order int,node_type text,title jsonb,teacher_script jsonb);
  CREATE SCHEMA runtime_publish_private;
  CREATE FUNCTION runtime_publish_private.authoring_lock() RETURNS void LANGUAGE sql AS $$ SELECT pg_advisory_xact_lock(71237891) $$;
  CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.owner',true),'')::uuid $$;
  CREATE FUNCTION private.is_platform_owner() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT current_setting('test.owner_allowed',true)='true' $$;
  INSERT INTO public.test_profile VALUES(${q(ids.owner)},'active');
  INSERT INTO public.student_apps VALUES(${q(ids.app)},'korean');
  INSERT INTO public.courses VALUES(${q(ids.course)},${q(ids.app)});
  INSERT INTO public.lessons VALUES(${q(ids.lesson)},${q(ids.course)});
  INSERT INTO public.digital_textbooks(id,lesson_id,slug,level_code,title) VALUES(${q(ids.book)},${q(ids.lesson)},'hangul-introduction','beginner','{"zh-CN":"韩文字母入门"}');
  INSERT INTO public.digital_textbook_versions(id,textbook_id,version_number) VALUES(${q(ids.version)},${q(ids.book)},1);
  INSERT INTO public.digital_textbook_chapters(id,version_id,slug,chapter_number,title) VALUES(${q(ids.chapter)},${q(ids.version)},'preparation',0,'{"zh-CN":"韩文字母入门"}');
  INSERT INTO public.digital_textbook_modules(id,chapter_id,module_code,sort_order,accent_role,title) VALUES(${q(ids.module)},${q(ids.chapter)},'orientation',1,'jade','{"zh-CN":"课前导航"}');
  INSERT INTO public.learning_agent_lessons(id,module_id,objectives) VALUES(${q(ids.teaching)},${q(ids.module)},'{"zh-CN":["frozen objective"]}');
  INSERT INTO public.learning_agent_script_versions VALUES(${q(ids.script)},${q(ids.teaching)},1,'draft',null);
  ${nodes.map(n=>`INSERT INTO public.learning_agent_script_nodes VALUES(${q(id())},${q(ids.script)},${n.order},${q(n.type)},${J(n.title)},${J(n.script)});`).join('\n')}
  COMMIT;`);
  if(lessonRls){
   const isolation=readFileSync(new URL('../../../supabase/migrations/202609140005_student_teaching_content_isolation.sql',import.meta.url),'utf8');
   const moduleFunction=isolation.slice(isolation.indexOf('CREATE FUNCTION private.can_read_published_teaching_module'),isolation.indexOf('-- Close ancestor catalog'));
   const lessonPolicy=isolation.match(/ALTER POLICY "authenticated read published learning agent lessons" ON public.learning_agent_lessons\s+USING \([^;]+;/)[0];
   await db.raw(`BEGIN;
    GRANT USAGE ON SCHEMA public,private,auth TO authenticated,service_role;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated,service_role;
    CREATE FUNCTION private.can_read_published_textbook(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.digital_textbooks WHERE id=p_id AND status='published') $$;
    ${moduleFunction}
    ALTER TABLE public.learning_agent_lessons ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "authenticated read published learning agent lessons" ON public.learning_agent_lessons FOR SELECT TO authenticated USING(false);
    ${lessonPolicy}
    REVOKE ALL ON public.digital_textbook_activity_secrets FROM authenticated,anon;
    COMMIT;`);
  }
  const sha=x=>`encode(sha256(convert_to(${x},'UTF8')),'hex')`;
  const lock=JSON.parse(await db.raw(`SELECT json_build_object('lesson',${sha(q(ids.teaching))},'script',${sha(q(ids.script))},'versionRow',(SELECT ${sha('jsonb_agg(to_jsonb(s) ORDER BY id)::text')} FROM public.learning_agent_script_versions s),'nodes',(SELECT jsonb_agg(${sha('to_jsonb(s)::text')} ORDER BY sort_order) FROM public.learning_agent_script_nodes s),'parents',jsonb_build_object(${['lessons','digital_textbooks','digital_textbook_versions','digital_textbook_chapters','digital_textbook_modules','learning_agent_lessons'].map(t=>`${q(t)},(SELECT ${sha('jsonb_agg(to_jsonb(s) ORDER BY id)::text')} FROM public.${t} s)`).join(',')}));`));
  const installed=migration.replace(/approved constant jsonb := '[^']*'::jsonb;/,`approved constant jsonb := ${J(lock)};`);
  await db.raw(installed);
  const invocation=(expected=lock,answer={kind:'index',value:1})=>`SELECT public.create_teaching_lesson_activity_binding(${J(expected)},${J(answer)});`;
  const begin=`BEGIN;SET LOCAL ROLE authenticated;SET LOCAL test.owner=${q(ids.owner)};SET LOCAL test.owner_allowed='true';`;
  return {...db,ids,lock,invocation,begin,async call({expected=lock,answer={kind:'index',value:1},allowed=true,owner=ids.owner,commit=true}={}){
   return db.transaction(`BEGIN;SET LOCAL ROLE authenticated;SET LOCAL test.owner=${q(owner??'')};SET LOCAL test.owner_allowed=${q(String(allowed))};${invocation(expected,answer)}${commit?'COMMIT':'ROLLBACK'};`);
  },async counts(){return JSON.parse(await db.raw(`BEGIN READ ONLY;SELECT json_build_object('nodes',(SELECT count(*) FROM public.digital_textbook_nodes),'activities',(SELECT count(*) FROM public.digital_textbook_activities),'secrets',(SELECT count(*) FROM public.digital_textbook_activity_secrets),'attempts',(SELECT count(*) FROM public.digital_textbook_attempts),'progress',(SELECT count(*) FROM public.digital_textbook_node_progress));ROLLBACK;`));}};
 }catch(e){await db.stop();throw e;}
}
