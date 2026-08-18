begin;

-- 平台内容管理员可以准备草稿；只有平台负责人可以改变机构可见状态。
create or replace function private.can_manage_standard_question_bank()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_owner()
    or exists (
      select 1
      from public.profiles as profile
      where profile.id = (select auth.uid())
        and profile.global_role = 'platform_admin'
        and coalesce(profile.status, 'active') = 'active'
    )
    or private.current_user_has_explicit_permission(
      'standard_question_bank.manage', null
    );
$$;

create or replace function public.current_user_can_release_assessment_papers()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_account() and private.is_platform_owner();
$$;

revoke all on function public.current_user_can_release_assessment_papers()
  from public, anon;
grant execute on function public.current_user_can_release_assessment_papers()
  to authenticated;

create or replace function private.enforce_assessment_paper_release_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    (tg_op = 'INSERT' and new.status <> 'draft')
    or (tg_op = 'UPDATE' and new.status is distinct from old.status)
  ) and not public.current_user_can_release_assessment_papers() then
    raise exception '只有平台负责人可以发布、撤回、停止提供或归档试卷';
  end if;

  if tg_op = 'UPDATE' and old.status <> 'draft' and (
    new.paper_type is distinct from old.paper_type
    or new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.source_test_id is distinct from old.source_test_id
    or new.student_app_id is distinct from old.student_app_id
    or new.duration_minutes is distinct from old.duration_minutes
    or new.passing_score is distinct from old.passing_score
    or new.allow_resubmission is distinct from old.allow_resubmission
    or new.total_points is distinct from old.total_points
    or new.question_count is distinct from old.question_count
    or new.version is distinct from old.version
  ) then
    raise exception '已发布或已停止提供的试卷内容不可直接修改，请复制为新草稿';
  end if;
  return new;
end;
$$;

drop trigger if exists assessment_papers_release_owner
  on public.assessment_papers;
create trigger assessment_papers_release_owner
before insert or update on public.assessment_papers
for each row execute function private.enforce_assessment_paper_release_owner();

create or replace function private.validate_published_assessment_paper()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published'
    and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    perform private.validate_assessment_paper_release(new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists assessment_papers_release_quality
  on public.assessment_papers;
create constraint trigger assessment_papers_release_quality
after insert or update on public.assessment_papers
deferrable initially deferred
for each row execute function private.validate_published_assessment_paper();

create or replace function private.prevent_released_paper_question_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paper_id uuid := case when tg_op = 'DELETE' then old.paper_id else new.paper_id end;
begin
  if tg_op in ('UPDATE', 'DELETE') and exists (
    select 1 from public.assessment_papers as paper
    where paper.id = v_paper_id and paper.status <> 'draft'
  ) then
    raise exception '已发布或已停止提供的试卷题目不可直接修改，请复制为新草稿';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists assessment_paper_questions_lock_released
  on public.assessment_paper_questions;
create trigger assessment_paper_questions_lock_released
before update or delete on public.assessment_paper_questions
for each row execute function private.prevent_released_paper_question_mutation();

create or replace function private.prevent_released_paper_key_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_question_id uuid := case when tg_op = 'DELETE' then old.question_id else new.question_id end;
begin
  if tg_op in ('UPDATE', 'DELETE') and exists (
    select 1
    from public.assessment_paper_questions as question
    join public.assessment_papers as paper on paper.id = question.paper_id
    where question.id = v_question_id and paper.status <> 'draft'
  ) then
    raise exception '已发布或已停止提供的试卷答案不可直接修改，请复制为新草稿';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists assessment_paper_keys_lock_released
  on public.assessment_paper_question_keys;
create trigger assessment_paper_keys_lock_released
before update or delete on public.assessment_paper_question_keys
for each row execute function private.prevent_released_paper_key_mutation();

-- 机构只能读取已向机构发布、属于已开放应用且本人有测评权限的整卷。
drop policy if exists "authorized staff read assessment papers"
  on public.assessment_papers;
create policy "authorized staff read assessment papers"
on public.assessment_papers for select to authenticated
using (
  public.current_user_can_manage_assessment_papers()
  or (
    status = 'published'
    and exists (
      select 1 from public.tenant_student_apps as tenant_app
      where tenant_app.tenant_id = private.current_tenant_id()
        and tenant_app.app_id = assessment_papers.student_app_id
        and tenant_app.is_enabled
        and tenant_app.status = 'active'
    )
    and private.current_staff_has_app_capability(
      private.current_tenant_id(),
      assessment_papers.student_app_id,
      'manage_assessments'
    )
  )
);

drop policy if exists "authorized staff read assessment paper questions"
  on public.assessment_paper_questions;
create policy "authorized staff read assessment paper questions"
on public.assessment_paper_questions for select to authenticated
using (
  exists (
    select 1 from public.assessment_papers as paper
    where paper.id = assessment_paper_questions.paper_id
      and (
        public.current_user_can_manage_assessment_papers()
        or (
          paper.status = 'published'
          and exists (
            select 1 from public.tenant_student_apps as tenant_app
            where tenant_app.tenant_id = private.current_tenant_id()
              and tenant_app.app_id = paper.student_app_id
              and tenant_app.is_enabled
              and tenant_app.status = 'active'
          )
          and private.current_staff_has_app_capability(
            private.current_tenant_id(), paper.student_app_id,
            'manage_assessments'
          )
        )
      )
  )
);

create or replace function public.get_platform_assessment_paper_adoption_counts(
  p_student_app_id uuid
)
returns table (
  paper_id uuid,
  institution_count bigint,
  assignment_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    paper.id,
    count(distinct assignment.tenant_id),
    count(assignment.id)
  from public.assessment_papers as paper
  left join public.learning_assignments as assignment
    on assignment.source_paper_id = paper.id
  where paper.student_app_id = p_student_app_id
    and public.current_user_can_manage_assessment_papers()
  group by paper.id;
$$;

revoke all on function public.get_platform_assessment_paper_adoption_counts(uuid)
  from public, anon;
grant execute on function public.get_platform_assessment_paper_adoption_counts(uuid)
  to authenticated;

-- 复制始终生成一个可编辑的新草稿版本，同时保留题干材料和应用归属。
create or replace function public.duplicate_assessment_paper(
  p_paper_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.assessment_papers%rowtype;
  v_new_id uuid;
  v_new_code text;
begin
  if not public.current_user_can_manage_assessment_papers() then
    raise exception '当前账号不能复制标准试卷';
  end if;

  select * into v_source
  from public.assessment_papers
  where id = p_paper_id;
  if not found then raise exception '试卷不存在'; end if;

  v_new_code :=
    case when v_source.paper_type = 'homework' then 'HW-' else 'EX-' end
    || lpad(nextval('public.assessment_paper_code_seq')::text, 6, '0');

  insert into public.assessment_papers (
    paper_code, paper_type, title, description, source_test_id,
    student_app_id, duration_minutes, passing_score, allow_resubmission,
    total_points, question_count, version, status, created_by, updated_by
  ) values (
    v_new_code, v_source.paper_type,
    left(v_source.title || '（新版本）', 120), v_source.description,
    v_source.source_test_id, v_source.student_app_id,
    v_source.duration_minutes, v_source.passing_score,
    v_source.allow_resubmission, v_source.total_points,
    v_source.question_count, v_source.version + 1, 'draft',
    auth.uid(), auth.uid()
  ) returning id into v_new_id;

  with copied as (
    insert into public.assessment_paper_questions (
      paper_id, source_bank_question_id, source_bank_version, question_type,
      stimulus_text, prompt, options, points, sort_order, difficulty, skill
    )
    select
      v_new_id, source_bank_question_id, source_bank_version, question_type,
      stimulus_text, prompt, options, points, sort_order, difficulty, skill
    from public.assessment_paper_questions
    where paper_id = p_paper_id
    order by sort_order
    returning id, sort_order
  )
  insert into public.assessment_paper_question_keys (
    question_id, correct_answer, explanation
  )
  select copied.id, source_key.correct_answer, source_key.explanation
  from copied
  join public.assessment_paper_questions as source_question
    on source_question.paper_id = p_paper_id
   and source_question.sort_order = copied.sort_order
  join public.assessment_paper_question_keys as source_key
    on source_key.question_id = source_question.id;

  return v_new_id;
end;
$$;

-- 章节作业撤回只改变可见状态；再次发布时先在草稿状态重建快照，
-- 质检通过后才原子切换为机构可用。
create or replace function public.publish_chapter_homework_plan(
  p_plan_id uuid,
  p_status text default 'published'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.chapter_homework_plans%rowtype;
  v_test public.course_tests%rowtype;
  v_paper public.assessment_papers%rowtype;
  v_paper_id uuid;
  v_paper_code text;
  v_student_app_id uuid;
  v_question record;
  v_paper_question_id uuid;
  v_sort_order integer := 0;
  v_enabled_skill_count integer;
begin
  if not public.current_user_can_release_assessment_papers() then
    raise exception '只有平台负责人可以发布或撤回章节作业';
  end if;
  if p_status not in ('draft', 'published') then
    raise exception '章节作业状态不正确';
  end if;

  select * into v_plan
  from public.chapter_homework_plans
  where id = p_plan_id
  for update;
  if not found then raise exception '章节作业计划不存在'; end if;

  select * into v_paper
  from public.assessment_papers
  where source_homework_plan_id = v_plan.id
  for update;

  if p_status = 'draft' then
    if v_paper.id is null then raise exception '章节作业尚未生成标准卷'; end if;
    update public.assessment_papers
    set status = 'draft', published_at = null,
        updated_by = auth.uid(), updated_at = now()
    where id = v_paper.id;
    update public.chapter_homework_plans
    set status = 'draft', version = version + 1, updated_at = now()
    where id = v_plan.id;
    return v_paper.id;
  end if;

  select * into v_test from public.course_tests where id = v_plan.test_id;
  select test.student_app_id into v_student_app_id
  from public.chapter_tests as test where test.id = v_plan.test_id;
  if v_test.id is null or v_student_app_id is null then
    raise exception '章节作业缺少有效的章节或应用归属';
  end if;

  perform private.sync_chapter_homework_six_skills(v_plan.test_id);
  select count(*) into v_enabled_skill_count
  from public.chapter_homework_skill_settings
  where plan_id = v_plan.id and enabled
    and target_question_count > 0
    and language_skill in (
      'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
    );
  if v_enabled_skill_count <> 6 then
    raise exception '词汇、语法、听力、口语、阅读、写作六项内容齐全后才能发布';
  end if;

  if v_paper.id is null then
    v_paper_code := 'HW-' || lpad(
      nextval('public.assessment_paper_code_seq')::text, 6, '0'
    );
    insert into public.assessment_papers (
      paper_code, paper_type, title, description, source_test_id,
      source_homework_plan_id, student_app_id, duration_minutes,
      passing_score, allow_resubmission, total_points, question_count,
      version, status, created_by, updated_by
    ) values (
      v_paper_code, 'homework', v_plan.title,
      '按本章教材完成词汇、语法、听力、口语、阅读、写作六项练习。',
      v_plan.test_id, v_plan.id, v_student_app_id, v_plan.duration_minutes,
      v_plan.passing_score, v_plan.allow_resubmission, 0, 0, 1,
      'draft', auth.uid(), auth.uid()
    ) returning id into v_paper_id;
  else
    if v_paper.status <> 'draft' then
      raise exception '请先把当前发布版本撤回为草稿';
    end if;
    v_paper_id := v_paper.id;
    update public.assessment_papers
    set title = v_plan.title,
        description = '按本章教材完成词汇、语法、听力、口语、阅读、写作六项练习。',
        duration_minutes = v_plan.duration_minutes,
        passing_score = v_plan.passing_score,
        allow_resubmission = v_plan.allow_resubmission,
        version = version + 1,
        updated_by = auth.uid(), updated_at = now()
    where id = v_paper_id;
    delete from public.assessment_paper_questions where paper_id = v_paper_id;
  end if;

  for v_question in
    select question.*
    from public.chapter_homework_questions as question
    where question.plan_id = v_plan.id
    order by case question.language_skill
      when 'vocabulary' then 1 when 'grammar' then 2
      when 'listening' then 3 when 'speaking' then 4
      when 'reading' then 5 when 'writing' then 6 end,
      question.sort_order
  loop
    insert into public.assessment_paper_questions (
      paper_id, source_bank_question_id, source_bank_version, question_type,
      stimulus_text, prompt, options, points, sort_order, difficulty, skill
    ) values (
      v_paper_id, v_question.source_bank_question_id,
      coalesce(v_question.source_bank_version, 1), v_question.question_type,
      v_question.stimulus_text, left(v_question.prompt, 3000),
      v_question.options, v_question.points, v_sort_order,
      v_question.difficulty, v_question.language_skill
    ) returning id into v_paper_question_id;

    insert into public.assessment_paper_question_keys (
      question_id, correct_answer, explanation
    ) values (
      v_paper_question_id, v_question.correct_answer,
      left(v_question.explanation, 3000)
    );
    v_sort_order := v_sort_order + 1;
  end loop;

  update public.assessment_papers
  set question_count = v_sort_order,
      total_points = (
        select coalesce(sum(points), 0)
        from public.assessment_paper_questions where paper_id = v_paper_id
      ),
      status = 'published', published_at = now(), updated_at = now()
  where id = v_paper_id;

  update public.chapter_homework_plans
  set status = 'published',
      version = case when status is distinct from 'published'
        then version + 1 else version end,
      updated_at = now()
  where id = v_plan.id;

  return v_paper_id;
end;
$$;

-- 普通老师只能选择自己在当前应用负责的学生，不能向机构全体学生发布。
create or replace function public.create_learning_assignment_from_paper_with_unlock(
  p_paper_id uuid,
  p_course_id uuid,
  p_target_scope text,
  p_target_ids uuid[],
  p_starts_at timestamptz,
  p_due_at timestamptz,
  p_institution_note text,
  p_unlock_after_chapter_completion boolean,
  p_due_days_after_unlock integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment_id uuid;
  v_paper public.assessment_papers%rowtype;
begin
  select * into v_paper
  from public.assessment_papers
  where id = p_paper_id and status = 'published';
  if v_paper.id is null then raise exception '所选标准试卷当前不可用'; end if;

  if public.current_profile_role() = 'teacher' then
    if p_target_scope <> 'selected_students' then
      raise exception '老师只能把任务布置给自己负责的学生';
    end if;
    if exists (
      select 1 from unnest(coalesce(p_target_ids, array[]::uuid[])) as target(student_id)
      where not private.current_teacher_has_student_app_access(
        private.current_tenant_id(), target.student_id, v_paper.student_app_id
      )
    ) then
      raise exception '分配名单中包含当前老师未负责的学生';
    end if;
  end if;

  perform private.validate_assessment_paper_release(p_paper_id);
  v_assignment_id := public.create_learning_assignment_from_paper(
    p_paper_id, p_course_id, p_target_scope, p_target_ids,
    p_starts_at, p_due_at, p_institution_note
  );
  perform public.configure_assignment_chapter_unlock(
    v_assignment_id,
    coalesce(p_unlock_after_chapter_completion, false),
    case when p_unlock_after_chapter_completion
      then p_due_days_after_unlock else null end
  );
  return v_assignment_id;
end;
$$;

comment on function public.current_user_can_release_assessment_papers() is
  '只有平台负责人能够改变标准试卷的机构可见状态。';
comment on function public.get_platform_assessment_paper_adoption_counts(uuid) is
  '平台试卷工作台按整卷汇总采用机构数和布置次数，不返回学生数据。';

commit;
