begin;

-- 记录章节首次达到完成条件的时间，用于为每位学生计算独立作业窗口。
alter table public.course_ebook_progress
  add column if not exists completed_at timestamptz;

update public.course_ebook_progress
set completed_at = coalesce(completed_at, updated_at, last_read_at, now())
where completed_at is null
  and (
    completion_source in ('smart_textbook', 'both')
    or (progress_percent >= 100 and reading_seconds >= 600)
  );

create or replace function private.set_course_ebook_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.completion_source in ('smart_textbook', 'both')
    or (new.progress_percent >= 100 and new.reading_seconds >= 600) then
    new.completed_at := coalesce(
      case when tg_op = 'UPDATE' then old.completed_at else null end,
      new.completed_at,
      now()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists course_ebook_progress_set_completed_at
  on public.course_ebook_progress;
create trigger course_ebook_progress_set_completed_at
before insert or update of completion_source, progress_percent, reading_seconds
on public.course_ebook_progress
for each row execute function private.set_course_ebook_completed_at();

alter table public.learning_assignments
  add column if not exists due_days_after_unlock integer;

alter table public.learning_assignments
  drop constraint if exists learning_assignments_due_days_after_unlock_check;
alter table public.learning_assignments
  add constraint learning_assignments_due_days_after_unlock_check
  check (due_days_after_unlock is null or due_days_after_unlock between 1 and 30);

-- 学生云端草稿：只存答案快照和当前步骤，不存可伪造的成绩或题目内容。
create table if not exists public.learning_assignment_drafts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants(id) on delete cascade,
  assignment_id uuid not null
    references public.learning_assignments(id) on delete cascade,
  student_id uuid not null default auth.uid()
    references public.profiles(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb
    check (jsonb_typeof(answers) = 'object'),
  active_step integer not null default 0 check (active_step between 0 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, assignment_id, student_id)
);

create index if not exists learning_assignment_drafts_student_idx
  on public.learning_assignment_drafts (tenant_id, student_id, updated_at desc);

alter table public.learning_assignment_drafts enable row level security;

drop policy if exists "students read own assignment drafts"
  on public.learning_assignment_drafts;
create policy "students read own assignment drafts"
on public.learning_assignment_drafts for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and student_id = (select auth.uid())
);

grant select on public.learning_assignment_drafts to authenticated;
grant select, insert, update, delete on public.learning_assignment_drafts
  to service_role;

create or replace function public.save_learning_assignment_draft(
  p_assignment_id uuid,
  p_answers jsonb,
  p_active_step integer
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_saved_at timestamptz;
  v_item record;
  v_question_id uuid;
begin
  if auth.uid() is null
    or public.current_profile_role() <> 'student'
    or not public.is_active_account()
    or not public.current_user_can_view_learning_assignment_questions(p_assignment_id)
  then
    raise exception '当前账号不能保存这份作业草稿';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object'
    or jsonb_object_length(p_answers) > 100 then
    raise exception '草稿答案格式不正确';
  end if;
  if coalesce(p_active_step, -1) not between 0 and 10 then
    raise exception '草稿步骤不正确';
  end if;

  for v_item in select key, value from jsonb_each(p_answers)
  loop
    begin
      v_question_id := v_item.key::uuid;
    exception when others then
      raise exception '草稿中包含无效题目';
    end;
    if jsonb_typeof(v_item.value) <> 'string'
      or char_length(v_item.value #>> '{}') > 10000
      or not exists (
        select 1 from public.learning_assignment_questions as question
        where question.id = v_question_id
          and question.assignment_id = p_assignment_id
          and question.tenant_id = v_tenant_id
      )
    then
      raise exception '草稿中包含无效答案';
    end if;
  end loop;

  insert into public.learning_assignment_drafts (
    tenant_id, assignment_id, student_id, answers, active_step, updated_at
  ) values (
    v_tenant_id, p_assignment_id, auth.uid(), p_answers, p_active_step, now()
  )
  on conflict (tenant_id, assignment_id, student_id) do update
  set answers = excluded.answers,
      active_step = excluded.active_step,
      updated_at = now()
  returning updated_at into v_saved_at;
  return v_saved_at;
end;
$$;

revoke all on function public.save_learning_assignment_draft(uuid, jsonb, integer)
  from public, anon;
grant execute on function public.save_learning_assignment_draft(uuid, jsonb, integer)
  to authenticated;

create or replace function private.clear_assignment_draft_after_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.learning_assignment_drafts
  where tenant_id = new.tenant_id
    and assignment_id = new.assignment_id
    and student_id = new.student_id;
  return new;
end;
$$;

drop trigger if exists learning_submissions_clear_draft
  on public.learning_submissions;
create trigger learning_submissions_clear_draft
after insert on public.learning_submissions
for each row execute function private.clear_assignment_draft_after_submission();

-- 为学生详情页返回实际开放时间和个人截止时间。
create or replace function public.current_user_assignment_window(
  p_assignment_id uuid
)
returns table (
  chapter_completed boolean,
  unlocked_at timestamptz,
  effective_due_at timestamptz,
  due_days_after_unlock integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (
      not assignment.unlock_after_chapter_completion
      or private.current_staff_has_app_capability(
        assignment.tenant_id, assignment.student_app_id, 'manage_assessments'
      )
      or progress.completed_at is not null
    ) as chapter_completed,
    case
      when private.current_staff_has_app_capability(
        assignment.tenant_id, assignment.student_app_id, 'manage_assessments'
      ) then assignment.starts_at
      when not assignment.unlock_after_chapter_completion then assignment.starts_at
      else progress.completed_at
    end as unlocked_at,
    case
      when private.current_staff_has_app_capability(
        assignment.tenant_id, assignment.student_app_id, 'manage_assessments'
      ) then assignment.due_at
      when not assignment.unlock_after_chapter_completion then assignment.due_at
      when progress.completed_at is null then null
      when assignment.due_days_after_unlock is not null
        then progress.completed_at
          + make_interval(days => assignment.due_days_after_unlock)
      else assignment.due_at
    end as effective_due_at,
    assignment.due_days_after_unlock
  from public.learning_assignments as assignment
  left join public.course_ebook_progress as progress
    on progress.tenant_id = assignment.tenant_id
   and progress.student_id = (select auth.uid())
   and progress.student_app_id = assignment.student_app_id
   and progress.test_slug = assignment.unlock_test_slug
   and progress.completed_at is not null
  where assignment.id = p_assignment_id
    and assignment.tenant_id = private.current_tenant_id()
    and public.current_user_can_view_learning_assignment(assignment.id);
$$;

revoke all on function public.current_user_assignment_window(uuid)
  from public, anon;
grant execute on function public.current_user_assignment_window(uuid)
  to authenticated;

create or replace function public.current_user_can_submit_learning_assignment(
  p_assignment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_user_can_view_learning_assignment(p_assignment_id)
    and exists (
      select 1
      from public.learning_assignments as assignment
      where assignment.id = p_assignment_id
        and assignment.tenant_id = private.current_tenant_id()
        and assignment.status = 'published'
        and (assignment.starts_at is null or assignment.starts_at <= now())
        and (
          (
            not assignment.unlock_after_chapter_completion
            and assignment.due_at >= now()
          )
          or exists (
            select 1
            from public.course_ebook_progress as progress
            where progress.tenant_id = assignment.tenant_id
              and progress.student_id = (select auth.uid())
              and progress.student_app_id = assignment.student_app_id
              and progress.test_slug = assignment.unlock_test_slug
              and progress.completed_at is not null
              and coalesce(
                case when assignment.due_days_after_unlock is not null
                  then progress.completed_at
                    + make_interval(days => assignment.due_days_after_unlock)
                  else null end,
                assignment.due_at
              ) >= now()
          )
        )
    )
    and public.is_active_account()
    and public.current_profile_role() = 'student';
$$;

create or replace function public.configure_assignment_chapter_unlock(
  p_assignment_id uuid,
  p_enabled boolean,
  p_due_days_after_unlock integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.learning_assignments%rowtype;
  v_test_slug text;
begin
  select * into v_assignment
  from public.learning_assignments
  where id = p_assignment_id and tenant_id = private.current_tenant_id()
  for update;
  if not found or not private.current_staff_has_app_capability(
    v_assignment.tenant_id, v_assignment.student_app_id, 'manage_assessments'
  ) then
    raise exception '当前账号没有配置该作业的权限';
  end if;
  if p_enabled then
    select test.slug into v_test_slug
    from public.assessment_papers as paper
    join public.course_tests as test on test.id = paper.source_test_id
    where paper.id = v_assignment.source_paper_id;
    if v_test_slug is null then
      raise exception '该作业缺少对应章节，不能按章节完成状态开放';
    end if;
    if coalesce(p_due_days_after_unlock, 0) not between 1 and 30 then
      raise exception '完成章节后的提交期限需要设置为 1 至 30 天';
    end if;
  end if;

  update public.learning_assignments
  set unlock_after_chapter_completion = coalesce(p_enabled, false),
      unlock_test_slug = case when p_enabled then v_test_slug else null end,
      due_days_after_unlock = case when p_enabled
        then p_due_days_after_unlock else null end,
      updated_at = now()
  where id = p_assignment_id;
end;
$$;

create or replace function public.configure_assignment_chapter_unlock(
  p_assignment_id uuid,
  p_enabled boolean
)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.configure_assignment_chapter_unlock(
    p_assignment_id, p_enabled, case when p_enabled then 3 else null end
  );
$$;

revoke all on function public.configure_assignment_chapter_unlock(
  uuid, boolean, integer
) from public, anon;
grant execute on function public.configure_assignment_chapter_unlock(
  uuid, boolean, integer
) to authenticated;

-- 发布前的数据库质量门槛，避免绕过前端检查直接发布残缺作业。
create or replace function private.validate_assessment_paper_release(
  p_paper_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paper public.assessment_papers%rowtype;
  v_question_count integer;
  v_total_points numeric;
begin
  select * into v_paper from public.assessment_papers where id = p_paper_id;
  if v_paper.id is null or v_paper.status <> 'published' then
    raise exception '所选标准试卷当前不可发布';
  end if;
  select count(*), coalesce(sum(question.points), 0)
  into v_question_count, v_total_points
  from public.assessment_paper_questions as question
  where question.paper_id = p_paper_id;
  if v_question_count <> v_paper.question_count
    or v_total_points <> v_paper.total_points then
    raise exception '标准试卷题量或总分与题目快照不一致';
  end if;
  if exists (
    select 1
    from public.assessment_paper_questions as question
    left join public.assessment_paper_question_keys as answer_key
      on answer_key.question_id = question.id
    where question.paper_id = p_paper_id
      and question.auto_graded
      and nullif(btrim(coalesce(answer_key.correct_answer, '')), '') is null
  ) then
    raise exception '标准试卷中有客观题缺少正确答案';
  end if;

  if v_paper.paper_type = 'homework' then
    if (
      select count(distinct question.skill)
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill in (
          'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
        )
    ) <> 6 then
      raise exception '章节作业的词汇、语法、听说读写六项内容不完整';
    end if;
    if exists (
      select 1
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill = 'listening'
        and nullif(btrim(question.stimulus_text), '') is null
    ) then
      raise exception '章节作业的听力题缺少韩语听力材料';
    end if;
    if v_paper.source_homework_plan_id is not null and exists (
      select 1
      from (
        select source.language_skill, count(*) as expected_count
        from public.chapter_homework_questions as source
        where source.plan_id = v_paper.source_homework_plan_id
        group by source.language_skill
      ) as expected
      left join (
        select question.skill as language_skill, count(*) as actual_count
        from public.assessment_paper_questions as question
        where question.paper_id = p_paper_id
        group by question.skill
      ) as actual using (language_skill)
      where expected.expected_count <> coalesce(actual.actual_count, 0)
    ) then
      raise exception '章节作业与平台发布的词汇、语法或六项题目数量不一致';
    end if;
  end if;
end;
$$;

create or replace function public.get_assessment_paper_release_quality(
  p_paper_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_paper public.assessment_papers%rowtype;
  v_snapshot_matches boolean;
  v_all_skills boolean := true;
  v_objective_keys boolean;
  v_listening_ready boolean := true;
  v_source_counts_match boolean := true;
begin
  if not public.current_user_can_view_assessment_papers() then
    raise exception '当前账号不能查看标准试卷质检结果';
  end if;
  select * into v_paper from public.assessment_papers where id = p_paper_id;
  if v_paper.id is null then raise exception '标准试卷不存在'; end if;

  select count(*) = v_paper.question_count
    and coalesce(sum(question.points), 0) = v_paper.total_points
  into v_snapshot_matches
  from public.assessment_paper_questions as question
  where question.paper_id = p_paper_id;

  select not exists (
    select 1
    from public.assessment_paper_questions as question
    left join public.assessment_paper_question_keys as answer_key
      on answer_key.question_id = question.id
    where question.paper_id = p_paper_id
      and question.auto_graded
      and nullif(btrim(coalesce(answer_key.correct_answer, '')), '') is null
  ) into v_objective_keys;

  if v_paper.paper_type = 'homework' then
    select count(distinct question.skill) = 6 into v_all_skills
    from public.assessment_paper_questions as question
    where question.paper_id = p_paper_id
      and question.skill in (
        'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
      );
    select exists (
      select 1 from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill = 'listening'
        and nullif(btrim(question.stimulus_text), '') is not null
    ) into v_listening_ready;
    if v_paper.source_homework_plan_id is not null then
      select not exists (
        select 1
        from (
          select source.language_skill, count(*) as expected_count
          from public.chapter_homework_questions as source
          where source.plan_id = v_paper.source_homework_plan_id
          group by source.language_skill
        ) as expected
        left join (
          select question.skill as language_skill, count(*) as actual_count
          from public.assessment_paper_questions as question
          where question.paper_id = p_paper_id
          group by question.skill
        ) as actual using (language_skill)
        where expected.expected_count <> coalesce(actual.actual_count, 0)
      ) into v_source_counts_match;
    end if;
  end if;

  return jsonb_build_object(
    'snapshotMatches', v_snapshot_matches,
    'allSkills', v_all_skills,
    'objectiveKeys', v_objective_keys,
    'listeningReady', v_listening_ready,
    'sourceCountsMatch', v_source_counts_match,
    'ready', v_snapshot_matches and v_all_skills and v_objective_keys
      and v_listening_ready and v_source_counts_match
  );
end;
$$;

revoke all on function public.get_assessment_paper_release_quality(uuid)
  from public, anon;
grant execute on function public.get_assessment_paper_release_quality(uuid)
  to authenticated;

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
begin
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

create or replace function public.create_learning_assignment_from_paper_with_unlock(
  p_paper_id uuid,
  p_course_id uuid,
  p_target_scope text,
  p_target_ids uuid[],
  p_starts_at timestamptz,
  p_due_at timestamptz,
  p_institution_note text,
  p_unlock_after_chapter_completion boolean
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select public.create_learning_assignment_from_paper_with_unlock(
    p_paper_id, p_course_id, p_target_scope, p_target_ids,
    p_starts_at, p_due_at, p_institution_note,
    p_unlock_after_chapter_completion,
    case when p_unlock_after_chapter_completion then 3 else null end
  );
$$;

revoke all on function public.create_learning_assignment_from_paper_with_unlock(
  uuid, uuid, text, uuid[], timestamptz, timestamptz, text, boolean, integer
) from public, anon;
grant execute on function public.create_learning_assignment_from_paper_with_unlock(
  uuid, uuid, text, uuid[], timestamptz, timestamptz, text, boolean, integer
) to authenticated;

-- 错题重练记录仅在正式批改后的客观错题上开放。
create table if not exists public.learning_assignment_remediation_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants(id) on delete cascade,
  assignment_id uuid not null
    references public.learning_assignments(id) on delete cascade,
  question_id uuid not null
    references public.learning_assignment_questions(id) on delete cascade,
  student_id uuid not null default auth.uid()
    references public.profiles(id) on delete cascade,
  answer_text text not null check (char_length(answer_text) between 1 and 10000),
  is_correct boolean not null,
  attempted_at timestamptz not null default now()
);

create index if not exists learning_assignment_remediation_student_idx
  on public.learning_assignment_remediation_attempts (
    tenant_id, student_id, assignment_id, attempted_at desc
  );

alter table public.learning_assignment_remediation_attempts enable row level security;
create policy "students read own remediation attempts"
on public.learning_assignment_remediation_attempts for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and student_id = (select auth.uid())
);
grant select on public.learning_assignment_remediation_attempts to authenticated;
grant select, insert on public.learning_assignment_remediation_attempts
  to service_role;

create or replace function public.submit_assignment_remediation_answer(
  p_question_id uuid,
  p_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_question public.learning_assignment_questions%rowtype;
  v_key public.learning_assignment_question_keys%rowtype;
  v_answer text := btrim(coalesce(p_answer, ''));
  v_correct boolean;
  v_attempt_count integer;
begin
  if public.current_profile_role() <> 'student' or not public.is_active_account()
  then raise exception '当前账号不能进行错题重练'; end if;
  if char_length(v_answer) not between 1 and 10000 then
    raise exception '请先填写重练答案';
  end if;
  select * into v_question
  from public.learning_assignment_questions
  where id = p_question_id and tenant_id = v_tenant_id and auto_graded;
  if v_question.id is null or not exists (
    select 1
    from public.learning_submission_answers as submitted_answer
    join public.learning_submissions as submission
      on submission.id = submitted_answer.submission_id
    where submitted_answer.question_id = v_question.id
      and submission.student_id = auth.uid()
      and submission.assignment_id = v_question.assignment_id
      and submission.status = 'graded'
      and coalesce(submitted_answer.awarded_points, 0) < v_question.points
  ) then
    raise exception '这道题当前不属于可重练错题';
  end if;
  select * into v_key from public.learning_assignment_question_keys
  where question_id = v_question.id and tenant_id = v_tenant_id;
  if nullif(btrim(coalesce(v_key.correct_answer, '')), '') is null then
    raise exception '这道题暂时没有可用的重练判定';
  end if;
  v_correct := private.normalize_assignment_answer(v_answer)
    = private.normalize_assignment_answer(v_key.correct_answer);
  insert into public.learning_assignment_remediation_attempts (
    tenant_id, assignment_id, question_id, student_id, answer_text, is_correct
  ) values (
    v_tenant_id, v_question.assignment_id, v_question.id,
    auth.uid(), v_answer, v_correct
  );
  select count(*) into v_attempt_count
  from public.learning_assignment_remediation_attempts
  where tenant_id = v_tenant_id and student_id = auth.uid()
    and question_id = v_question.id;
  return jsonb_build_object(
    'correct', v_correct,
    'message', case when v_correct then '回答正确，这道错题已经掌握。'
      when v_attempt_count >= 2 then '还不正确，请对照答案后再做一次。'
      else '还不正确，再检查一次词形或选项。' end,
    'correctAnswer', case when v_correct or v_attempt_count >= 2
      then v_key.correct_answer else null end,
    'explanation', case when v_correct or v_attempt_count >= 2
      then v_key.explanation else null end
  );
end;
$$;

revoke all on function public.submit_assignment_remediation_answer(uuid, text)
  from public, anon;
grant execute on function public.submit_assignment_remediation_answer(uuid, text)
  to authenticated;

comment on column public.learning_assignments.due_days_after_unlock is
  '完成对应章节后，每位学生独立拥有的提交天数；为空时沿用统一截止时间。';
comment on table public.learning_assignment_drafts is
  '按学生和作业保存的跨设备云端作答草稿。';
comment on table public.learning_assignment_remediation_attempts is
  '正式批改后，学生针对客观错题进行再次练习的记录。';

commit;
