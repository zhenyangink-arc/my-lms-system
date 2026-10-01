-- D5：数学判题的存储层（草稿，见 docs/question-type-grader-slot-design.md §4、§6.2）
-- 1) 放开 learning_assignment_questions.question_type：新增 math.expression、math.numeric
--    （auto_graded 由现有触发器按题型计算，两种新题型落在“非自动判分”，提交后进入待人工批改，状态机不变）
-- 2) public.math_question_specs：数学题的判题规格（只有有“管理内容”能力的教职人员可读，学生不可读）
-- 3) public.learning_submission_machine_grades：机器判题结果（只增不改，重判新增一行并留痕）
-- 4) set_math_question_spec()：教职人员设置判题规格（提交开始后禁止修改，保证判定可复核）
-- 5) record_learning_machine_grade()：只允许服务端（service_role）写入机器判题结果
-- 不包含：出题入口 create_learning_assignment 的题型白名单（另批，需改写该大函数）；判题任务表与后台进程。
begin;

alter table public.learning_assignment_questions
  drop constraint learning_assignment_questions_question_type_check;
alter table public.learning_assignment_questions
  add constraint learning_assignment_questions_question_type_check
  check (question_type = any (array[
    'short_text', 'long_text', 'single_choice', 'file_link', 'audio_recording',
    'math.expression', 'math.numeric'
  ]));

create table public.math_question_specs (
  question_id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  grader_key text not null check (grader_key in ('math.expression-equivalence', 'math.numeric')),
  spec jsonb not null check (jsonb_typeof(spec) = 'object' and pg_column_size(spec) <= 4000),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, question_id)
    references public.learning_assignment_questions(tenant_id, id) on delete cascade
);
create index math_question_specs_tenant_id_idx on public.math_question_specs(tenant_id);

create function private.check_math_question_spec_type()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_type text;
begin
  select question_type into v_type
  from public.learning_assignment_questions
  where id = new.question_id and tenant_id = new.tenant_id;
  if v_type is distinct from (case new.grader_key
       when 'math.expression-equivalence' then 'math.expression'
       when 'math.numeric' then 'math.numeric' end) then
    raise exception '判题器与题型不匹配';
  end if;
  return new;
end $$;
create trigger math_question_specs_check_type
  before insert or update on public.math_question_specs
  for each row execute function private.check_math_question_spec_type();
create trigger math_question_specs_tenant_scope
  before insert or update on public.math_question_specs
  for each row execute function private.enforce_tenant_scope();

alter table public.math_question_specs enable row level security;
revoke all on public.math_question_specs from anon, authenticated;
grant select on public.math_question_specs to authenticated;
grant select, insert, update, delete on public.math_question_specs to service_role;
create policy "staff read math question specs" on public.math_question_specs
  for select to authenticated
  using (exists (
    select 1
    from public.learning_assignment_questions q
    join public.learning_assignments a on a.tenant_id = q.tenant_id and a.id = q.assignment_id
    where q.id = math_question_specs.question_id
      and q.tenant_id = math_question_specs.tenant_id
      and private.current_staff_has_app_capability(a.tenant_id, a.student_app_id, 'manage_content')
  ));

create table public.learning_submission_machine_grades (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  answer_id uuid not null references public.learning_submission_answers(id) on delete cascade,
  revision integer not null check (revision >= 1),
  grader_key text not null check (char_length(grader_key) between 1 and 80),
  grader_version text not null check (char_length(grader_version) between 1 and 40),
  verdict text not null check (verdict in ('correct', 'incorrect', 'error')),
  suggested_points numeric(8,2) check (suggested_points is null or suggested_points >= 0),
  advisory boolean not null default false,
  reason text not null check (char_length(reason) <= 200),
  evidence jsonb not null default '{}'::jsonb
    check (jsonb_typeof(evidence) = 'object' and pg_column_size(evidence) <= 100000),
  graded_at timestamptz not null default now(),
  unique (answer_id, revision),
  check ((verdict = 'error') = (suggested_points is null))
);
create index learning_submission_machine_grades_tenant_id_idx
  on public.learning_submission_machine_grades(tenant_id);

alter table public.learning_submission_machine_grades enable row level security;
revoke all on public.learning_submission_machine_grades from anon, authenticated;
grant select on public.learning_submission_machine_grades to authenticated;
grant select, insert on public.learning_submission_machine_grades to service_role;
-- 只有有该应用“管理测评”能力的教职人员可读；学生不可读（判定依据含标准答案的取点值）
create policy "staff read machine grades" on public.learning_submission_machine_grades
  for select to authenticated
  using (exists (
    select 1
    from public.learning_submission_answers answer
    join public.learning_submissions submission
      on submission.tenant_id = answer.tenant_id and submission.id = answer.submission_id
    join public.learning_assignments assignment
      on assignment.tenant_id = submission.tenant_id and assignment.id = submission.assignment_id
    where answer.id = learning_submission_machine_grades.answer_id
      and answer.tenant_id = learning_submission_machine_grades.tenant_id
      and private.current_staff_has_app_capability(assignment.tenant_id, assignment.student_app_id, 'manage_assessments')
      and (
        public.current_profile_role() <> 'teacher'
        or private.current_teacher_has_student_app_access(assignment.tenant_id, submission.student_id, assignment.student_app_id)
      )
  ));

create function public.set_math_question_spec(p_question_id uuid, p_grader_key text, p_spec jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_q public.learning_assignment_questions%rowtype; v_app uuid;
begin
  select q.* into v_q
  from public.learning_assignment_questions q
  where q.id = p_question_id and q.tenant_id = private.current_tenant_id();
  select a.student_app_id into v_app
  from public.learning_assignments a
  where a.tenant_id = v_q.tenant_id and a.id = v_q.assignment_id;
  if v_q.id is null
     or not private.current_staff_has_app_capability(v_q.tenant_id, v_app, 'manage_content') then
    raise exception '题目不存在或当前账号没有该应用的内容管理权限';
  end if;
  if exists (select 1 from public.learning_submission_answers where tenant_id = v_q.tenant_id and question_id = v_q.id) then
    raise exception '该题已有学生作答，不能修改判题规格';
  end if;
  insert into public.math_question_specs (question_id, tenant_id, grader_key, spec, updated_by)
  values (v_q.id, v_q.tenant_id, p_grader_key, p_spec, (select auth.uid()))
  on conflict (question_id) do update
    set grader_key = excluded.grader_key, spec = excluded.spec,
        updated_by = excluded.updated_by, updated_at = now();
end $$;
revoke all on function public.set_math_question_spec(uuid, text, jsonb) from public, anon;
grant execute on function public.set_math_question_spec(uuid, text, jsonb) to authenticated;

create function public.record_learning_machine_grade(
  p_answer_id uuid, p_grader_key text, p_grader_version text, p_verdict text,
  p_suggested_points numeric, p_reason text, p_evidence jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_answer public.learning_submission_answers%rowtype;
  v_question public.learning_assignment_questions%rowtype;
  v_state text;
begin
  select * into v_answer from public.learning_submission_answers where id = p_answer_id for update;
  if v_answer.id is null then raise exception '答案不存在'; end if;
  select * into v_question from public.learning_assignment_questions
  where id = v_answer.question_id and tenant_id = v_answer.tenant_id;
  select submission_state into v_state from public.learning_submissions
  where id = v_answer.submission_id and tenant_id = v_answer.tenant_id;
  if v_state not in ('submitted_pending_grading', 'objective_graded_pending_manual') then
    raise exception '提交不在待批改阶段，不能写入机器判题结果';
  end if;
  if v_question.question_type not in ('math.expression', 'math.numeric')
     or p_grader_key is distinct from (case v_question.question_type
          when 'math.expression' then 'math.expression-equivalence' else 'math.numeric' end) then
    raise exception '判题器与题型不匹配';
  end if;
  if p_suggested_points is not null and p_suggested_points > v_question.points then
    raise exception '建议得分不能超过题目满分';
  end if;
  insert into public.learning_submission_machine_grades (
    tenant_id, answer_id, revision, grader_key, grader_version, verdict, suggested_points, reason, evidence
  ) values (
    v_answer.tenant_id, v_answer.id,
    coalesce((select max(revision) from public.learning_submission_machine_grades where answer_id = v_answer.id), 0) + 1,
    p_grader_key, p_grader_version, p_verdict, p_suggested_points, p_reason, coalesce(p_evidence, '{}'::jsonb)
  );
end $$;
revoke all on function public.record_learning_machine_grade(uuid, text, text, text, numeric, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_learning_machine_grade(uuid, text, text, text, numeric, text, jsonb)
  to service_role;

commit;
