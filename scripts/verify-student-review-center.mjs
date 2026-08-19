#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const dbContainer =
  process.env.LOCAL_SUPABASE_DB_CONTAINER ?? "supabase_db_my-lms-system";

const sql = String.raw`
begin;

insert into auth.users (id, email, aud, role, created_at, updated_at)
values
  ('a1000000-0000-4000-8000-000000000001', 'review-teacher@example.test', 'authenticated', 'authenticated', now(), now()),
  ('a1000000-0000-4000-8000-000000000002', 'review-student@example.test', 'authenticated', 'authenticated', now(), now());

update public.profiles
set role = 'teacher', full_name = '错题验证老师', status = 'active'
where id = 'a1000000-0000-4000-8000-000000000001';
update public.profiles
set role = 'student', full_name = '错题验证学生', status = 'active'
where id = 'a1000000-0000-4000-8000-000000000002';

insert into public.tenants (id, slug, name, status, created_by)
values (
  'a2000000-0000-4000-8000-000000000001',
  'review-center-verification', '错题中心验证机构', 'active',
  'a1000000-0000-4000-8000-000000000001'
);
insert into public.tenant_memberships (
  tenant_id, user_id, role, status, is_default
) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'teacher', 'active', true),
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'student', 'active', true);
insert into public.student_app_enrollments (
  tenant_id, student_id, app_id, status, access_tier, starts_at, enrolled_by
) values (
  'a2000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  'active', 'normal', now() - interval '1 day',
  'a1000000-0000-4000-8000-000000000001'
);

-- 巩固自测：先由验证夹具定位已发布内容，再用学生 JWT 上下文调用受控 RPC。
select set_config('review_fixture.unit_id', unit.id::text, true),
       set_config('review_fixture.block_id', block.id::text, true),
       set_config(
         'review_fixture.topic',
         coalesce(
           jsonb_path_query_first(block.content_payload, '$.skills.*') #>> '{}',
           block.content_payload ->> 'prompt',
           unit.title
         ),
         true
       )
from public.chapter_practice_units as unit
join public.chapter_practice_blocks as block
  on block.practice_unit_id = unit.id
where unit.status = 'published'
  and block.status = 'published'
  and block.block_type = 'self_check'
order by unit.published_at, block.sort_order
limit 1;
select set_config('review_fixture.listening_unit_id', unit.id::text, true),
       set_config('review_fixture.listening_block_id', block.id::text, true),
       set_config('review_fixture.listening_question_id', question.id::text, true)
from public.chapter_practice_units as unit
join public.chapter_practice_blocks as block
  on block.practice_unit_id = unit.id
join public.growth_toolbox_questions as question
  on question.exercise_id = block.source_id
join public.growth_toolbox_question_keys as answer_key
  on answer_key.question_id = question.id
where unit.published_at is null
  and block.block_type = 'listening'
  and block.source_type = 'growth_toolbox_exercise'
order by unit.created_at, block.sort_order, question.sort_order
limit 1;
update public.chapter_practice_blocks
set status = 'published'
where id = current_setting('review_fixture.listening_block_id')::uuid;
update public.chapter_practice_units
set status = 'published', published_at = now()
where id = current_setting('review_fixture.listening_unit_id')::uuid;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select public.record_student_practice_self_check_review(
  current_setting('review_fixture.unit_id')::uuid,
  current_setting('review_fixture.block_id')::uuid,
  array[current_setting('review_fixture.topic')]
);
select public.record_student_practice_listening_reviews(
  current_setting('review_fixture.listening_block_id')::uuid,
  jsonb_build_array(jsonb_build_object(
    'questionId', current_setting('review_fixture.listening_question_id'),
    'response', '__intentional_wrong_answer__'
  ))
);
reset role;
select set_config('request.jwt.claims', '{}', true);

do $$
begin
  if not exists (
    select 1 from public.student_review_items
    where tenant_id = 'a2000000-0000-4000-8000-000000000001'
      and student_id = 'a1000000-0000-4000-8000-000000000002'
      and source_type = 'practice_self_check'
      and error_count = 1
      and content_snapshot ? 'sourceVersion'
      and student_answer_snapshot ? 'reviewTopics'
      and feedback_snapshot ? 'lastErrorAt'
  ) then raise exception 'practice_self_check 未正确写入'; end if;
  if not exists (
    select 1 from public.student_review_items
    where tenant_id = 'a2000000-0000-4000-8000-000000000001'
      and student_id = 'a1000000-0000-4000-8000-000000000002'
      and source_type = 'practice_self_check'
      and source_question_id = current_setting(
        'review_fixture.listening_question_id'
      )::uuid
      and skill = 'listening'
      and student_answer_snapshot ->> 'answer' = '__intentional_wrong_answer__'
      and feedback_snapshot ? 'acceptedAnswers'
  ) then raise exception '听辨错题未正确写入 practice_self_check'; end if;
end;
$$;
select 'PASS practice_self_check: self-check topics and listening mistakes inserted complete snapshots';

-- 章节小测错题与旧收藏迁移。
do $$
declare
  v_test public.chapter_tests%rowtype;
  v_question public.chapter_test_questions%rowtype;
  v_wrong integer;
  v_attempt_id uuid := 'a3000000-0000-4000-8000-000000000001';
begin
  select * into v_test from public.chapter_tests
  where status = 'published'
    and student_app_id = '10000000-0000-4000-8000-000000000001'
  order by chapter_number limit 1;
  select * into v_question from public.chapter_test_questions
  where test_id = v_test.id
    and status = 'published'
    and question_type = 'single_choice'
    and is_chapter_test_item
  order by sort_order limit 1;
  v_wrong := (v_question.correct_option + 1) % jsonb_array_length(v_question.options);
  insert into public.chapter_test_attempts (
    id, tenant_id, student_id, test_id, test_slug, test_version,
    score, correct_count, total_questions, passed, answers, dimension_scores,
    attempted_at
  ) values (
    v_attempt_id,
    'a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000002',
    v_test.id, v_test.slug, v_test.version,
    0, 0, 1, false,
    jsonb_build_object(v_question.question_key, v_wrong), '{}'::jsonb,
    '2026-08-19 01:00:00+00'
  );
  insert into public.chapter_test_question_reviews (
    id, tenant_id, student_id, test_id, question_id, created_at, updated_at
  ) values (
    'a4000000-0000-4000-8000-000000000001',
    'a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000002',
    v_test.id, v_question.id,
    '2026-01-02 03:04:05+00', '2026-01-03 03:04:05+00'
  );
end;
$$;

do $$
declare
  v_before integer;
  v_after integer;
begin
  select count(*) into v_before
  from public.chapter_test_question_reviews
  where id = 'a4000000-0000-4000-8000-000000000001';
  perform public.migrate_chapter_test_question_reviews_to_review_items();
  select count(*) into v_after
  from public.chapter_test_question_reviews
  where id = 'a4000000-0000-4000-8000-000000000001';
  if v_before <> 1 or v_after <> v_before then
    raise exception '历史收藏迁移修改了原表';
  end if;
  if not exists (
    select 1 from public.student_review_items
    where student_id = 'a1000000-0000-4000-8000-000000000002'
      and source_type = 'chapter_quiz'
      and error_count = 1
      and student_answer_snapshot ? 'selectedOption'
      and feedback_snapshot ? 'correctAnswer'
  ) then raise exception 'chapter_quiz 未正确写入'; end if;
  if not exists (
    select 1 from public.student_review_items
    where student_id = 'a1000000-0000-4000-8000-000000000002'
      and source_type = 'student_bookmark'
      and created_at = '2026-01-02 03:04:05+00'::timestamptz
      and content_snapshot ->> 'legacyReviewId'
        = 'a4000000-0000-4000-8000-000000000001'
  ) then raise exception 'student_bookmark 未保留历史时间或题目关系'; end if;
end;
$$;
select 'PASS chapter_quiz: real attempt inserted the wrong question';
select 'PASS student_bookmark: migration preserved original row and timestamp';

-- 老师作业批改：客观/阅读低分和写作建议使用同一完成批改节点归集。
insert into public.learning_assignments (
  id, tenant_id, student_app_id, title, description, assignment_type,
  total_points, starts_at, due_at, target_scope, status, published_at,
  created_by, updated_by
) values (
  'a5000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '老师作业错题归集验证', '', 'homework', 10,
  now() - interval '1 day', now() + interval '1 day', 'all_students',
  'published', now() - interval '1 day',
  'a1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001'
);
insert into public.learning_assignment_questions (
  id, tenant_id, assignment_id, question_type, language_skill,
  prompt, options, points, sort_order, auto_graded
) values
  (
    'a5100000-0000-4000-8000-000000000001',
    'a2000000-0000-4000-8000-000000000001',
    'a5000000-0000-4000-8000-000000000001',
    'single_choice', 'reading', '请选择正确答案。', '["正确","错误"]',
    5, 1, true
  ),
  (
    'a5100000-0000-4000-8000-000000000002',
    'a2000000-0000-4000-8000-000000000001',
    'a5000000-0000-4000-8000-000000000001',
    'long_text', 'writing', '请完成写作表达。', '[]', 5, 2, false
  );
insert into public.learning_assignment_question_keys (
  tenant_id, question_id, correct_answer, explanation, updated_by
) values (
  'a2000000-0000-4000-8000-000000000001',
  'a5100000-0000-4000-8000-000000000001', '正确', '阅读题解析',
  'a1000000-0000-4000-8000-000000000001'
);
insert into public.learning_submissions (
  id, tenant_id, assignment_id, student_id, attempt_number, status,
  request_id, request_payload_hash, submission_state, objective_graded_at,
  submitted_at
) values (
  'a5200000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'a5000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000002', 1, 'submitted',
  'a5300000-0000-4000-8000-000000000001', 'review-fixture',
  'objective_graded_pending_manual', now(), now()
);
insert into public.learning_submission_answers (
  id, tenant_id, submission_id, question_id, answer_text,
  awarded_points, grader_feedback, rubric_scores
) values
  (
    'a5400000-0000-4000-8000-000000000001',
    'a2000000-0000-4000-8000-000000000001',
    'a5200000-0000-4000-8000-000000000001',
    'a5100000-0000-4000-8000-000000000001', '错误', 0, '请回看原文。', null
  ),
  (
    'a5400000-0000-4000-8000-000000000002',
    'a2000000-0000-4000-8000-000000000001',
    'a5200000-0000-4000-8000-000000000001',
    'a5100000-0000-4000-8000-000000000002', '学生写作答案', 3,
    '补充连接语并修正句尾。',
    '{"content_completeness":1,"grammar_accuracy":1,"vocabulary_use":1,"organization_expression":0,"spelling_format":0}'
  );
update public.learning_submissions
set computed_score = 3,
    overall_feedback = '按评语完成修改后再练一次。',
    submission_state = 'grading_completed',
    grading_completed_at = now(), graded_at = now(),
    graded_by = 'a1000000-0000-4000-8000-000000000001'
where id = 'a5200000-0000-4000-8000-000000000001';

do $$
begin
  if not exists (
    select 1 from public.student_review_items
    where source_type = 'teacher_homework'
      and source_id = 'a5000000-0000-4000-8000-000000000001'
      and source_question_id = 'a5100000-0000-4000-8000-000000000001'
      and feedback_snapshot ->> 'correctAnswer' = '正确'
  ) then raise exception 'teacher_homework 未正确归集'; end if;
  if not exists (
    select 1 from public.student_review_items
    where source_type = 'teacher_speaking_writing_feedback'
      and source_question_id = 'a5100000-0000-4000-8000-000000000002'
      and feedback_snapshot ->> 'teacherComment' = '补充连接语并修正句尾。'
      and feedback_snapshot ? 'improvementTask'
  ) then raise exception '口语写作老师建议未正确归集'; end if;
end;
$$;
select 'PASS teacher_homework: completed grading inserted the low-score answer';
select 'PASS teacher_speaking_writing_feedback: teacher comment and improvement task persisted';

-- 学生本人通过 RLS 标记重新掌握。
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
do $$
declare
  v_item_id uuid;
begin
  select id into v_item_id from public.student_review_items
  where student_id = auth.uid() and source_type = 'practice_self_check'
  limit 1;
  update public.student_review_items
  set status = 'mastered', mastered_at = now(), last_reviewed_at = now()
  where id = v_item_id and student_id = auth.uid();
  if not found then raise exception '学生 RLS 更新未命中自己的记录'; end if;
  if not exists (
    select 1 from public.student_review_items
    where id = v_item_id and status = 'mastered'
      and mastered_at is not null and last_reviewed_at is not null
  ) then raise exception '重新掌握状态不完整'; end if;
end;
$$;
reset role;
select set_config('request.jwt.claims', '{}', true);
select 'PASS mastered interaction: authenticated student RLS update set status and timestamps';

-- 人为让错题表拒绝专项训练归集；源作答仍须成功插入。
create or replace function private.reject_review_capture_fixture()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.source_type = 'specialized_practice' then
    raise exception 'intentional review sink failure';
  end if;
  return new;
end;
$$;
create trigger reject_review_capture_fixture
before insert or update on public.student_review_items
for each row execute function private.reject_review_capture_fixture();

do $$
declare
  v_exercise_id uuid;
  v_question_id uuid;
begin
  select exercise.id, question.id into v_exercise_id, v_question_id
  from public.growth_toolbox_exercises as exercise
  join public.growth_toolbox_questions as question
    on question.exercise_id = exercise.id
  where exercise.status = 'published'
  order by exercise.created_at, question.sort_order
  limit 1;
  insert into public.toolbox_practice_sessions (
    id, tenant_id, student_id, exercise_id, skill, status,
    completed_at, item_count, answered_count, correct_count,
    earned_score, max_score, client_event_id
  ) values (
    'a6000000-0000-4000-8000-000000000001',
    'a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000002',
    v_exercise_id, 'reading', 'completed', now(), 1, 1, 0, 0, 1,
    'a6100000-0000-4000-8000-000000000001'
  );
  insert into public.toolbox_practice_attempts (
    id, tenant_id, session_id, student_id, question_id, skill,
    response_payload, is_correct, earned_score, max_score, answered_at
  ) values (
    'a6200000-0000-4000-8000-000000000001',
    'a2000000-0000-4000-8000-000000000001',
    'a6000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000002',
    v_question_id, 'reading', '{"value":"故意错误"}', false, 0, 1, now()
  );
  if not exists (
    select 1 from public.toolbox_practice_attempts
    where id = 'a6200000-0000-4000-8000-000000000001'
  ) then raise exception '错题归集失败回滚了专项训练源作答'; end if;
end;
$$;
select 'PASS failure isolation: intentional review write failure did not roll back source attempt';

select jsonb_build_object(
  'practice_self_check', count(*) filter (where source_type = 'practice_self_check'),
  'chapter_quiz', count(*) filter (where source_type = 'chapter_quiz'),
  'student_bookmark', count(*) filter (where source_type = 'student_bookmark'),
  'teacher_homework', count(*) filter (where source_type = 'teacher_homework'),
  'teacher_feedback', count(*) filter (where source_type = 'teacher_speaking_writing_feedback')
) from public.student_review_items
where tenant_id = 'a2000000-0000-4000-8000-000000000001';

rollback;
`;

const result = spawnSync(
  "docker",
  [
    "exec",
    "-i",
    dbContainer,
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-At",
  ],
  { input: sql, encoding: "utf8" },
);

assert.equal(
  result.status,
  0,
  result.stderr || result.stdout || "student review database verification failed",
);
for (const marker of [
  "PASS practice_self_check",
  "PASS chapter_quiz",
  "PASS student_bookmark",
  "PASS teacher_homework",
  "PASS teacher_speaking_writing_feedback",
  "PASS mastered interaction",
  "PASS failure isolation",
]) {
  assert.match(result.stdout, new RegExp(marker));
}
process.stdout.write(result.stdout);
