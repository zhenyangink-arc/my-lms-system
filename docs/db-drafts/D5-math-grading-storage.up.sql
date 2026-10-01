-- D5：数学判题的存储层（草稿，见 docs/question-type-grader-slot-design.md §4、§6.2）
-- 1) 放开 learning_assignment_questions.question_type：新增 math.expression、math.numeric
--    （auto_graded 由现有触发器按题型计算，两种新题型落在“非自动判分”，提交后进入待人工批改，状态机不变）
-- 2) public.math_question_specs：数学题的判题规格（只有有“管理内容”能力的教职人员可读，学生不可读）
-- 3) public.learning_submission_machine_grades：机器判题结果（只增不改，重判新增一行并留痕）
-- 4)（已移除）曾有 set_math_question_spec()：机构教职人员改标准答案规格的权限过大。规格只由 D7 的试卷层复制而来，不提供改写入口
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

-- 判题规格的结构校验（与 TypeScript 侧 parseExpressionSpec / parseNumericSpec 同口径；
-- 取值范围的先后、变量名合法性等细节仍由判题器在运行时按 invalid_spec 把关）
create function private.math_spec_is_valid(p_grader_key text, p_spec jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare v jsonb;
begin
  if p_spec is null or jsonb_typeof(p_spec) <> 'object' then return false; end if;
  if p_spec ? 'tolerance' then
    v := p_spec->'tolerance';
    if jsonb_typeof(v) <> 'object'
       or jsonb_typeof(v->'abs') is distinct from 'number' or jsonb_typeof(v->'rel') is distinct from 'number'
       or (v->>'abs')::numeric < 0 or (v->>'rel')::numeric < 0 then return false; end if;
  end if;
  if p_grader_key = 'math.numeric' then
    return jsonb_typeof(p_spec->'expected') = 'number' and p_spec ? 'tolerance';
  elsif p_grader_key = 'math.expression-equivalence' then
    if jsonb_typeof(p_spec->'expected') is distinct from 'string'
       or char_length(p_spec->>'expected') not between 1 and 200
       or jsonb_typeof(p_spec->'seed') is distinct from 'number'
       or (p_spec->>'seed')::numeric <> trunc((p_spec->>'seed')::numeric)
       or jsonb_typeof(p_spec->'variables') is distinct from 'array'
       or jsonb_array_length(p_spec->'variables') not between 1 and 4 then return false; end if;
    for v in select value from jsonb_array_elements(p_spec->'variables') loop
      if jsonb_typeof(v) <> 'object'
         or jsonb_typeof(v->'name') is distinct from 'string'
         or jsonb_typeof(v->'min') is distinct from 'number'
         or jsonb_typeof(v->'max') is distinct from 'number' then return false; end if;
    end loop;
    return true;
  end if;
  return false;
end $$;

create table public.math_question_specs (
  question_id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  grader_key text not null check (grader_key in ('math.expression-equivalence', 'math.numeric')),
  spec jsonb not null check (pg_column_size(spec) <= 4000),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  check (private.math_spec_is_valid(grader_key, spec)),
  foreign key (tenant_id, question_id)
    references public.learning_assignment_questions(tenant_id, id) on delete cascade
);
create index math_question_specs_tenant_id_idx on public.math_question_specs(tenant_id);

create function private.check_math_question_spec_type()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_type text;
begin
  -- 题目本身被删除时（外键级联）规格随之删除，不拦截
  if tg_op = 'DELETE' and not exists (
    select 1 from public.learning_assignment_questions
    where id = old.question_id and tenant_id = old.tenant_id
  ) then
    return old;
  end if;
  -- 已有学生作答后规格冻结（保证判定可复核）
  if tg_op in ('UPDATE', 'DELETE') and exists (
    select 1 from public.learning_submission_answers
    where question_id = old.question_id and tenant_id = old.tenant_id
  ) then
    raise exception '该题已有学生作答，不能修改判题规格';
  end if;
  if tg_op = 'DELETE' then return old; end if;
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
  before insert or update or delete on public.math_question_specs
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

create function public.record_learning_machine_grade(
  p_answer_id uuid, p_grader_key text, p_grader_version text, p_verdict text,
  p_suggested_points numeric, p_reason text, p_evidence jsonb,
  -- 为真时，该作答已有任何结果就什么也不写（教师批改页自动补判用：两位老师同时打开同一页不会产生重复修订）；
  -- 为假（默认）时总是新增一条修订（重新判题用）
  p_only_if_missing boolean default false
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_answer public.learning_submission_answers%rowtype;
  v_question public.learning_assignment_questions%rowtype;
  v_state text;
begin
  select * into v_answer from public.learning_submission_answers where id = p_answer_id for update;
  if v_answer.id is null then raise exception '答案不存在'; end if;
  -- 行锁已持有：并发的自动补判在这里串行化，后到的看到先到的结果后直接返回
  if p_only_if_missing and exists (
    select 1 from public.learning_submission_machine_grades where answer_id = v_answer.id
  ) then
    return;
  end if;
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
revoke all on function public.record_learning_machine_grade(uuid, text, text, text, numeric, text, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.record_learning_machine_grade(uuid, text, text, text, numeric, text, jsonb, boolean)
  to service_role;

commit;
