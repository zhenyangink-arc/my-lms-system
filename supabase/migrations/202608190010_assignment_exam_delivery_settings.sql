begin;

alter table public.learning_assignments
  add column if not exists allow_late_submission boolean not null default false,
  add column if not exists max_attempts integer,
  add column if not exists shuffle_questions boolean not null default false,
  add column if not exists shuffle_options boolean not null default false,
  add column if not exists grade_release_at timestamptz,
  add column if not exists retake_paper_id uuid
    references public.assessment_papers(id) on delete restrict,
  add column if not exists retake_starts_at timestamptz,
  add column if not exists retake_due_at timestamptz,
  add column if not exists retake_score_policy text,
  add column if not exists retake_original_weight_percent integer;

update public.learning_assignments
set max_attempts = case when allow_resubmission then 100 else 1 end
where max_attempts is null;

alter table public.learning_assignments
  alter column max_attempts set default 1,
  alter column max_attempts set not null;

alter table public.learning_assignments
  drop constraint if exists learning_assignments_max_attempts_check,
  add constraint learning_assignments_max_attempts_check
    check (max_attempts between 1 and 100),
  drop constraint if exists learning_assignments_grade_release_check,
  add constraint learning_assignments_grade_release_check
    check (grade_release_at is null or grade_release_at >= due_at),
  drop constraint if exists learning_assignments_retake_settings_check,
  add constraint learning_assignments_retake_settings_check check (
    (
      retake_paper_id is null
      and retake_starts_at is null
      and retake_due_at is null
      and retake_score_policy is null
      and retake_original_weight_percent is null
    )
    or
    (
      retake_paper_id is not null
      and retake_starts_at is not null
      and retake_due_at > retake_starts_at
      and retake_starts_at >= due_at
      and retake_score_policy in ('highest', 'latest', 'weighted')
      and (
        (retake_score_policy = 'weighted'
          and retake_original_weight_percent between 1 and 99)
        or
        (retake_score_policy <> 'weighted'
          and retake_original_weight_percent is null)
      )
    )
  );

create table if not exists public.learning_assignment_retake_students (
  tenant_id uuid not null
    references public.tenants(id) on delete cascade,
  assignment_id uuid not null
    references public.learning_assignments(id) on delete cascade,
  student_id uuid not null
    references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (assignment_id, student_id)
);

create index if not exists learning_assignment_retake_students_tenant_idx
  on public.learning_assignment_retake_students (tenant_id, assignment_id);
create index if not exists learning_assignment_retake_students_student_idx
  on public.learning_assignment_retake_students (student_id, assignment_id);

alter table public.learning_assignment_retake_students enable row level security;
alter table public.learning_assignment_retake_students force row level security;

drop policy if exists learning_assignment_retake_students_manager_select
  on public.learning_assignment_retake_students;
create policy learning_assignment_retake_students_manager_select
on public.learning_assignment_retake_students for select to authenticated
using (
  exists (
    select 1
    from public.learning_assignments as assignment
    where assignment.id = learning_assignment_retake_students.assignment_id
      and assignment.tenant_id = learning_assignment_retake_students.tenant_id
      and private.current_staff_has_app_capability(
        assignment.tenant_id,
        assignment.student_app_id,
        'manage_assessments'
      )
  )
);

revoke all on table public.learning_assignment_retake_students
  from public, anon, authenticated;
grant select on table public.learning_assignment_retake_students
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
  p_due_days_after_unlock integer,
  p_allow_late_submission boolean,
  p_max_attempts integer,
  p_shuffle_questions boolean,
  p_shuffle_options boolean,
  p_grade_release_at timestamptz,
  p_retake_paper_id uuid,
  p_retake_student_ids uuid[],
  p_retake_starts_at timestamptz,
  p_retake_due_at timestamptz,
  p_retake_score_policy text,
  p_retake_original_weight_percent integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment_id uuid;
  v_assignment public.learning_assignments%rowtype;
  v_retake_paper public.assessment_papers%rowtype;
  v_retake_student_count integer;
  v_valid_retake_student_count integer;
begin
  if p_max_attempts is not null and p_max_attempts not between 1 and 10 then
    raise exception '允许提交次数需要设置为 1 至 10 次';
  end if;
  if p_grade_release_at is not null and p_grade_release_at < p_due_at then
    raise exception '成绩公开时间不能早于提交截止时间';
  end if;

  select count(distinct student_id)
  into v_retake_student_count
  from unnest(coalesce(p_retake_student_ids, array[]::uuid[])) as student_id;

  if p_retake_paper_id is null then
    if v_retake_student_count > 0
      or p_retake_starts_at is not null
      or p_retake_due_at is not null
      or p_retake_score_policy is not null
      or p_retake_original_weight_percent is not null then
      raise exception '未启用补考时不能设置补考名单、时间或成绩规则';
    end if;
  else
    perform private.validate_assessment_paper_release(p_retake_paper_id);
    select * into v_retake_paper
    from public.assessment_papers
    where id = p_retake_paper_id and status = 'published';
    if not found then
      raise exception '所选补考卷不存在或已经停止提供';
    end if;
    if v_retake_student_count = 0 then
      raise exception '启用补考时请至少选择一名补考学生';
    end if;
    if p_retake_starts_at is null
      or p_retake_due_at is null
      or p_retake_starts_at < p_due_at
      or p_retake_due_at <= p_retake_starts_at then
      raise exception '补考开始时间不能早于首次截止时间，且补考截止时间必须晚于开始时间';
    end if;
    if p_retake_score_policy not in ('highest', 'latest', 'weighted') then
      raise exception '补考成绩采用规则不正确';
    end if;
    if p_retake_score_policy = 'weighted' then
      if coalesce(p_retake_original_weight_percent, 0) not between 1 and 99 then
        raise exception '加权分需要设置 1 至 99 的首次成绩占比';
      end if;
    elsif p_retake_original_weight_percent is not null then
      raise exception '只有加权分规则可以设置首次成绩占比';
    end if;
  end if;

  v_assignment_id := public.create_learning_assignment_from_paper_with_unlock(
    p_paper_id, p_course_id, p_target_scope, p_target_ids,
    p_starts_at, p_due_at, p_institution_note,
    p_unlock_after_chapter_completion, p_due_days_after_unlock
  );

  select * into v_assignment
  from public.learning_assignments
  where id = v_assignment_id
  for update;

  if p_retake_paper_id is not null then
    if v_retake_paper.student_app_id is distinct from v_assignment.student_app_id
      or v_retake_paper.paper_type is distinct from v_assignment.assignment_type then
      raise exception '补考卷必须与首次考试属于同一应用和同一任务类型';
    end if;

    if p_target_scope = 'selected_students' and exists (
      select 1
      from unnest(p_retake_student_ids) as retake_student_id
      where not (retake_student_id = any(coalesce(p_target_ids, array[]::uuid[])))
    ) then
      raise exception '补考学生必须属于本次考试的指定学生名单';
    end if;

    select count(*) into v_valid_retake_student_count
    from (
      select distinct requested.student_id
      from unnest(p_retake_student_ids) as requested(student_id)
      join public.tenant_memberships as membership
        on membership.tenant_id = v_assignment.tenant_id
       and membership.user_id = requested.student_id
       and membership.role = 'student'
       and membership.status = 'active'
      join public.student_app_enrollments as enrollment
        on enrollment.tenant_id = membership.tenant_id
       and enrollment.student_id = membership.user_id
       and enrollment.app_id = v_assignment.student_app_id
       and enrollment.status = 'active'
       and enrollment.starts_at <= now()
       and (enrollment.ends_at is null or enrollment.ends_at > now())
    ) as valid_retake_student;
    if v_valid_retake_student_count <> v_retake_student_count then
      raise exception '补考名单中包含未开通该应用的学生';
    end if;
  end if;

  update public.learning_assignments
  set allow_late_submission = coalesce(p_allow_late_submission, false),
      max_attempts = coalesce(
        p_max_attempts,
        case when allow_resubmission then 100 else 1 end
      ),
      allow_resubmission = coalesce(
        p_max_attempts > 1,
        allow_resubmission
      ),
      shuffle_questions = coalesce(p_shuffle_questions, false),
      shuffle_options = coalesce(p_shuffle_options, false),
      grade_release_at = p_grade_release_at,
      retake_paper_id = p_retake_paper_id,
      retake_starts_at = p_retake_starts_at,
      retake_due_at = p_retake_due_at,
      retake_score_policy = p_retake_score_policy,
      retake_original_weight_percent = p_retake_original_weight_percent,
      updated_by = auth.uid(),
      updated_at = now()
  where id = v_assignment_id;

  if p_retake_paper_id is not null then
    insert into public.learning_assignment_retake_students (
      tenant_id, assignment_id, student_id
    )
    select v_assignment.tenant_id, v_assignment_id, student_id
    from unnest(p_retake_student_ids) as student_id
    on conflict do nothing;
  end if;

  return v_assignment_id;
end;
$$;

revoke all on function public.create_learning_assignment_from_paper_with_unlock(
  uuid, uuid, text, uuid[], timestamptz, timestamptz, text, boolean, integer,
  boolean, integer, boolean, boolean, timestamptz, uuid, uuid[], timestamptz,
  timestamptz, text, integer
) from public, anon;
grant execute on function public.create_learning_assignment_from_paper_with_unlock(
  uuid, uuid, text, uuid[], timestamptz, timestamptz, text, boolean, integer,
  boolean, integer, boolean, boolean, timestamptz, uuid, uuid[], timestamptz,
  timestamptz, text, integer
) to authenticated;

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
          assignment.allow_late_submission
          or (
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
        and (
          select count(*)
          from public.learning_submissions as submission
          where submission.assignment_id = assignment.id
            and submission.student_id = (select auth.uid())
        ) < assignment.max_attempts
    )
    and public.is_active_account()
    and public.current_profile_role() = 'student';
$$;

comment on column public.learning_assignments.allow_late_submission is
  '任务实例是否在截止时间后继续接受提交；任务关闭后仍不可提交。';
comment on column public.learning_assignments.max_attempts is
  '任务实例允许的提交次数上限；旧的无限重复提交任务迁移为 100 次。';
comment on column public.learning_assignments.shuffle_questions is
  '任务实例是否为每名学生随机排列题目。';
comment on column public.learning_assignments.shuffle_options is
  '任务实例是否为每名学生随机排列选择题选项。';
comment on column public.learning_assignments.grade_release_at is
  '成绩最早公开时间，与提交截止时间独立。';
comment on column public.learning_assignments.retake_paper_id is
  '补考使用的已发布标准卷；可与首次考试母卷相同。';
comment on column public.learning_assignments.retake_score_policy is
  '首次与补考最终成绩采用 highest、latest 或 weighted。';
comment on table public.learning_assignment_retake_students is
  '任务实例的补考学生名单；不覆盖首次考试目标或任何历史提交。';

commit;
