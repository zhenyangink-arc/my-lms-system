import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const runtime = await import(process.env.LMS_PGLITE_MODULE ?? "@electric-sql/pglite").catch(() => null);
const id = n => `10000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const read = file => readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),"utf8");

test("teaching operations use real evidence and isolate tenants, students and teacher assignments", {skip: !runtime && "Set LMS_PGLITE_MODULE for isolated PostgreSQL verification"}, async () => {
  const db = new runtime.PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create schema auth; create schema private;
      alter default privileges in schema public grant execute on functions to anon, authenticated;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
      create function private.current_tenant_id() returns uuid language sql stable as $$select nullif(current_setting('test.tenant',true),'')::uuid$$;
      create function public.current_profile_role() returns text language sql stable as $$select current_setting('test.role',true)$$;
      create function private.can_manage_curriculum_plan(uuid) returns boolean language sql stable as $$select current_setting('test.manager',true) = 'true'$$;
      create table profiles(id uuid primary key);
      create table courses(id uuid primary key,student_app_id uuid,content_scope text);
      create table lessons(id uuid primary key,course_id uuid,is_published boolean);
      create table chapter_tests(id uuid primary key,lesson_id uuid,student_app_id uuid,status text,slug text);
      create table course_chapters(id uuid primary key,lesson_id uuid,chapter_test_id uuid,is_published boolean);
      create table assessment_papers(id uuid primary key,student_app_id uuid,source_test_id uuid,status text,paper_type text);
      create table chapter_practice_units(id uuid primary key,student_app_id uuid,course_chapter_id uuid,status text);
      create table growth_toolbox_exercises(id uuid primary key,student_app_id uuid,course_id uuid,course_chapter_id uuid,status text,skill text);
      create table curriculum_plan_templates(id uuid primary key,student_app_id uuid,course_id uuid,status text);
      create table curriculum_plan_template_items(id uuid primary key,template_id uuid,day_offset int,start_minute int,duration_minutes int,activity_type text,source_type text,source_id uuid,instructions text,
        constraint curriculum_plan_template_items_source_type_check check(true),constraint curriculum_plan_template_items_activity_type_check check(true));
      create table institution_curriculum_plans(id uuid primary key,tenant_id uuid,student_app_id uuid,template_id uuid,status text,starts_at timestamptz);
      create table institution_curriculum_plan_students(plan_id uuid,tenant_id uuid,student_id uuid,primary key(plan_id,student_id));
      create table student_app_enrollments(tenant_id uuid,student_id uuid,app_id uuid,status text,starts_at timestamptz,ends_at timestamptz);
      create table tenant_memberships(tenant_id uuid,user_id uuid,status text,role text);
      create table tenant_student_assignments(tenant_id uuid,student_app_id uuid,teacher_id uuid,student_id uuid);
      create table lesson_progress(lesson_id uuid,user_id uuid,tenant_id uuid,status text,progress_percent numeric);
      create table course_ebook_progress(id uuid,test_slug text,student_id uuid,tenant_id uuid,student_app_id uuid,completed_at timestamptz,progress_percent numeric);
      create table chapter_test_attempts(test_id uuid,student_id uuid,tenant_id uuid,passed boolean);
      create table student_chapter_practice_progress(practice_unit_id uuid,student_id uuid,tenant_id uuid,completed_at timestamptz,started_at timestamptz,progress_percent numeric);
      create table toolbox_practice_sessions(exercise_id uuid,student_id uuid,tenant_id uuid,status text,completed_at timestamptz,started_at timestamptz);
      create table learning_assignments(id uuid primary key,tenant_id uuid,student_app_id uuid,course_id uuid,status text,target_scope text,starts_at timestamptz,due_at timestamptz);
      create table learning_assignment_targets(assignment_id uuid,student_id uuid);
      create table learning_submissions(id uuid,assignment_id uuid,student_id uuid,tenant_id uuid,submission_state text,grade_released_at timestamptz,attempt_number int,submitted_at timestamptz);
      create function public.create_learning_assignment_from_paper_with_unlock(uuid,uuid,text,uuid[],timestamptz,timestamptz,text,boolean,integer,boolean,integer,boolean,boolean,timestamptz,uuid,uuid[],timestamptz,timestamptz,text,integer) returns uuid language plpgsql as $$
      declare a uuid := gen_random_uuid(); begin
        insert into public.learning_assignments values(a,private.current_tenant_id(),'${id(1)}',$2,'published',$3,$5,$6);
        insert into public.learning_assignment_targets select a,unnest($4); return a;
      end $$;
      insert into profiles values('${id(2)}'),('${id(3)}'),('${id(4)}');
      insert into courses values('${id(5)}','${id(1)}','platform');
      insert into lessons values('${id(6)}','${id(5)}',true);
      insert into chapter_tests values('${id(7)}','${id(6)}','${id(1)}','published','chapter-one');
      insert into course_chapters values('${id(8)}','${id(6)}','${id(7)}',true);
      insert into assessment_papers values('${id(9)}','${id(1)}','${id(7)}','published','exam');
      insert into chapter_practice_units values('${id(10)}','${id(1)}','${id(8)}','published');
      insert into growth_toolbox_exercises values('${id(11)}','${id(1)}','${id(5)}','${id(8)}','published','listening');
      insert into curriculum_plan_templates values('${id(12)}','${id(1)}','${id(5)}','published');
      insert into institution_curriculum_plans values('${id(13)}','${id(14)}','${id(1)}','${id(12)}','published',now()+interval '1 day');
      insert into institution_curriculum_plan_students values('${id(13)}','${id(14)}','${id(2)}'),('${id(13)}','${id(14)}','${id(3)}');
      insert into student_app_enrollments select '${id(14)}',s,'${id(1)}','active',now()-interval '1 day',null from unnest(array['${id(2)}'::uuid,'${id(3)}'::uuid]) s;
      insert into tenant_memberships select '${id(14)}',s,'active','student' from unnest(array['${id(2)}'::uuid,'${id(3)}'::uuid]) s;
      select set_config('test.uid','${id(2)}',false),set_config('test.tenant','${id(14)}',false),set_config('test.role','student',false),set_config('test.manager','false',false);
    `);
    await db.exec(await read("202609080004_teaching_operations.sql"));
    await db.exec(`insert into curriculum_plan_template_items values
      ('${id(21)}','${id(12)}',0,540,50,'course','lesson','${id(6)}',null),
      ('${id(22)}','${id(12)}',0,600,50,'course','chapter','${id(8)}',null),
      ('${id(23)}','${id(12)}',0,660,50,'chapter_test','chapter_test','${id(7)}',null),
      ('${id(24)}','${id(12)}',0,780,50,'chapter_practice','chapter_practice','${id(10)}',null),
      ('${id(25)}','${id(12)}',0,840,50,'listening','specialized_practice','${id(11)}',null),
      ('${id(26)}','${id(12)}',0,900,50,'final_exam','assessment_paper','${id(9)}',null);`);
    const get = async () => (await db.query("select public.get_curriculum_execution($1::uuid[]) facts",[[id(13)]])).rows[0].facts;
    await db.exec("set role authenticated");
    let facts = await get();
    assert.equal(facts.length,6);
    assert.ok(facts.every(f => f.student_id === id(2) && !f.completed));
    assert.equal(facts.find(f => f.item_id === id(26)).available,false);
    await assert.rejects(db.query("select public.dispatch_curriculum_plan_exam($1,$2)",[id(13),id(26)]),/无权/);
    await db.exec("reset role");
    await db.exec(`insert into lesson_progress values('${id(6)}','${id(2)}','${id(14)}','completed',100);
      insert into course_ebook_progress values('${id(30)}','chapter-one','${id(2)}','${id(14)}','${id(1)}',now(),100);
      insert into chapter_test_attempts values('${id(7)}','${id(2)}','${id(14)}',false),('${id(7)}','${id(2)}','${id(14)}',true);
      insert into student_chapter_practice_progress values('${id(10)}','${id(2)}','${id(14)}',now(),now(),100);
      insert into toolbox_practice_sessions values('${id(11)}','${id(2)}','${id(14)}','completed',now()+interval '2 days',now()+interval '2 days');`);
    facts = await get();
    assert.equal(facts.filter(f => f.completed).length,5);
    await db.exec(`select set_config('test.uid','${id(4)}',false),set_config('test.role','teacher',false),set_config('test.manager','true',false)`);
    assert.equal((await get()).length,0,"other-app teaching relationships must not grant access");
    await db.exec(`insert into tenant_student_assignments values('${id(14)}','${id(99)}','${id(4)}','${id(2)}')`);
    assert.equal((await get()).length,0);
    await db.exec(`insert into tenant_student_assignments values('${id(14)}','${id(1)}','${id(4)}','${id(2)}')`);
    assert.equal((await get()).length,6);
    await assert.rejects(db.query("select public.dispatch_curriculum_plan_exam($1,$2)",[id(13),id(26)]),/自己负责/);
    await db.exec(`select set_config('test.role','ceo',false)`);
    const dispatch = async () => (await db.query("select public.dispatch_curriculum_plan_exam($1,$2) id",[id(13),id(26)])).rows[0].id;
    const assignment = await dispatch();
    assert.equal(await dispatch(),assignment,"repeat dispatch is idempotent");
    assert.equal((await db.query("select * from learning_assignment_targets")).rows.length,2);
    assert.equal(Number((await db.query("select extract(epoch from due_at-starts_at)/60 minutes from learning_assignments")).rows[0].minutes),50);
    await assert.rejects(db.exec(`insert into institution_curriculum_plan_students values('${id(13)}','${id(14)}','${id(4)}')`),/新增学生/);
    await db.exec(`insert into learning_submissions values('${id(31)}','${assignment}','${id(2)}','${id(14)}','grading_completed',null,1,now())`);
    assert.equal((await get()).find(f => f.student_id === id(2) && f.item_id === id(26)).pending_grading,true);
    await db.exec("update learning_submissions set submission_state='grade_released',grade_released_at=now()");
    assert.equal((await get()).find(f => f.student_id === id(2) && f.item_id === id(26)).completed,true);
    await assert.rejects(db.exec("update institution_curriculum_plans set status='cancelled'"),/先在考试管理/);
    await db.exec("update learning_assignments set status='closed'; update institution_curriculum_plans set status='cancelled'");
    assert.equal((await get()).length,0);
    await db.exec("update institution_curriculum_plans set status='published'");
    await db.exec(`select set_config('test.tenant','${id(99)}',false)`);
    assert.equal((await get()).length,0);
    await db.exec("set role anon");
    await assert.rejects(get(),/permission denied/);
    await db.exec("reset role");
    await db.exec(`update curriculum_plan_templates set status='draft'; insert into curriculum_plan_template_items values('${id(80)}','${id(12)}',1,540,50,'final_exam','manual',null,null)`);
    await assert.rejects(db.exec("update curriculum_plan_templates set status='published'"),/绑定/);
    await assert.rejects(db.exec(`insert into curriculum_plan_template_items values('${id(81)}','${id(12)}',1,540,50,'speaking','specialized_practice','${id(11)}',null)`),/对应能力/);
  } finally { await db.close(); }
});
