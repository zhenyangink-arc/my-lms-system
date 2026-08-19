import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const sql = String.raw`
begin;

insert into auth.users (id, email, aud, role, created_at, updated_at)
values
  ('91000000-0000-4000-8000-000000000001', 'rubric-manager@example.test', 'authenticated', 'authenticated', now(), now()),
  ('91000000-0000-4000-8000-000000000002', 'rubric-student@example.test', 'authenticated', 'authenticated', now(), now());

update public.profiles
set role = 'ceo', full_name = '评分验证管理员', status = 'active'
where id = '91000000-0000-4000-8000-000000000001';
update public.profiles
set role = 'student', full_name = '评分验证学生', status = 'active'
where id = '91000000-0000-4000-8000-000000000002';

insert into public.tenants (id, slug, name, status, created_by)
values (
  '92000000-0000-4000-8000-000000000001',
  'rubric-verification', '评分验证机构', 'active',
  '91000000-0000-4000-8000-000000000001'
);
insert into public.tenant_memberships (tenant_id, user_id, role, status, is_default)
values
  ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'ceo', 'active', true),
  ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002', 'student', 'active', true);

select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

do $$
declare
  v_comment_id uuid;
begin
  if (select count(*) from public.learning_grading_comments
      where tenant_id = '92000000-0000-4000-8000-000000000001') <> 4 then
    raise exception 'default grading comments were not seeded';
  end if;
  v_comment_id := public.create_learning_grading_comment('数据库验证评语');
  perform public.update_learning_grading_comment(v_comment_id, '数据库验证评语（已修改）');
  if not exists (
    select 1 from public.learning_grading_comments
    where id = v_comment_id and content = '数据库验证评语（已修改）'
  ) then
    raise exception 'grading comment update failed';
  end if;
  perform public.delete_learning_grading_comment(v_comment_id);
  if exists (select 1 from public.learning_grading_comments where id = v_comment_id) then
    raise exception 'grading comment delete failed';
  end if;
end;
$$;

insert into public.learning_assignments (
  id, tenant_id, student_app_id, title, assignment_type, total_points,
  due_at, created_by, updated_by
) values (
  '93000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '分项评分验证', 'exam', 15, now() + interval '1 day',
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001'
);
insert into public.learning_assignment_questions (
  id, tenant_id, assignment_id, question_type, language_skill,
  prompt, points, sort_order, auto_graded
) values (
  '94000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000001',
  'long_text', 'speaking', '请完成口语任务。', 15, 1, false
);
insert into public.learning_submissions (
  id, tenant_id, assignment_id, student_id, attempt_number, status,
  request_id, request_payload_hash, submission_state, objective_graded_at
) values (
  '95000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002', 1, 'submitted',
  '96000000-0000-4000-8000-000000000001', 'verification',
  'objective_graded_pending_manual', now()
);
insert into public.learning_submission_answers (
  id, tenant_id, submission_id, question_id, answer_text
) values (
  '97000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000001',
  '95000000-0000-4000-8000-000000000001',
  '94000000-0000-4000-8000-000000000001', '验证回答'
);

do $$
begin
  begin
    update public.learning_submission_answers
    set awarded_points = 14,
        rubric_scores = '{"pronunciation_accuracy":4,"fluency":4,"grammar_vocabulary":4,"task_completion":3}'::jsonb
    where id = '97000000-0000-4000-8000-000000000001';
    raise exception 'inconsistent rubric total was accepted';
  exception when others then
    if sqlerrm not like '%分项分数之和必须与单题总分一致%' then raise; end if;
  end;
end;
$$;

update public.learning_submission_answers
set awarded_points = 15,
    rubric_scores = '{"pronunciation_accuracy":4,"fluency":4,"grammar_vocabulary":4,"task_completion":3}'::jsonb
where id = '97000000-0000-4000-8000-000000000001';

do $$
begin
  begin
    perform public.release_learning_submission_grade('95000000-0000-4000-8000-000000000001');
    raise exception 'incomplete grading was released';
  exception when others then
    if sqlerrm not like '%只有完成全部批改后才能发布成绩%' then raise; end if;
  end;
end;
$$;

update public.learning_submissions
set submission_state = 'grading_completed', computed_score = 15,
    grading_completed_at = now(), graded_at = now(),
    graded_by = '91000000-0000-4000-8000-000000000001'
where id = '95000000-0000-4000-8000-000000000001';

select public.release_learning_submission_grade('95000000-0000-4000-8000-000000000001');

do $$
begin
  if not exists (
    select 1 from public.learning_submissions
    where id = '95000000-0000-4000-8000-000000000001'
      and submission_state = 'grade_released'
      and score = 15
      and grade_release_confirmed_at is not null
  ) then
    raise exception 'completed grade was not released';
  end if;
end;
$$;

select 'rubric-db-verification:ok';
rollback;
`;

const result = spawnSync(
  "docker",
  ["exec", "-i", "supabase_db_my-lms-system", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"],
  { input: sql, encoding: "utf8" }
);

assert.equal(result.status, 0, result.stderr || result.stdout || "database verification failed");
assert.match(result.stdout, /rubric-db-verification:ok/);
console.log("rubric-db-verification:ok");
