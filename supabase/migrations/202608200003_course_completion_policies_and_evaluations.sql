begin;

-- UUID equality in the temporal exclusion constraint requires the btree GiST
-- operator classes. The constraint, rather than an application-side lookup,
-- makes overlapping default policy publication safe under concurrency.
create extension if not exists btree_gist;

create or replace function private.completion_policy_requirements_are_valid(
  p_requirements jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_required_sections constant text[] := array[
    'textbook',
    'required_assignments',
    'formal_chapter_exams',
    'stage_exams',
    'midterm_exam',
    'final_exam',
    'subjective_grading',
    'overall_score',
    'blocking_gaps'
  ];
  v_section text;
  v_number numeric;
begin
  if jsonb_typeof(p_requirements) <> 'object'
    or not (p_requirements ?& v_required_sections) then
    return false;
  end if;

  foreach v_section in array v_required_sections loop
    if jsonb_typeof(p_requirements -> v_section) <> 'object' then
      return false;
    end if;
  end loop;

  if jsonb_typeof(p_requirements #> '{textbook,required_chapter_count}') <> 'number'
    or jsonb_typeof(p_requirements #> '{textbook,require_all_mandatory_chapters}') <> 'boolean'
    or jsonb_typeof(p_requirements #> '{required_assignments,require_all_assigned}') <> 'boolean'
    or jsonb_typeof(p_requirements #> '{required_assignments,require_submitted}') <> 'boolean'
    or jsonb_typeof(p_requirements #> '{required_assignments,require_graded}') <> 'boolean'
    or jsonb_typeof(p_requirements #> '{formal_chapter_exams,minimum_completed_count}') <> 'number'
    or jsonb_typeof(p_requirements #> '{formal_chapter_exams,minimum_passed_count}') <> 'number'
    or jsonb_typeof(p_requirements #> '{formal_chapter_exams,passing_score}') <> 'number'
    or jsonb_typeof(p_requirements #> '{stage_exams,required_count}') <> 'number'
    or jsonb_typeof(p_requirements #> '{stage_exams,require_published_grades}') <> 'boolean'
    or jsonb_typeof(p_requirements #> '{midterm_exam,require_published_grade}') <> 'boolean'
    or jsonb_typeof(p_requirements #> '{midterm_exam,passing_score}') <> 'number'
    or jsonb_typeof(p_requirements #> '{final_exam,require_published_grade}') <> 'boolean'
    or jsonb_typeof(p_requirements #> '{final_exam,passing_score}') <> 'number'
    or jsonb_typeof(p_requirements #> '{subjective_grading,require_all_certification_items_graded}') <> 'boolean'
    or jsonb_typeof(p_requirements #> '{overall_score,minimum_score}') <> 'number'
    or jsonb_typeof(p_requirements #> '{blocking_gaps,maximum_allowed_count}') <> 'number' then
    return false;
  end if;

  foreach v_section in array array[
    'textbook.required_chapter_count',
    'formal_chapter_exams.minimum_completed_count',
    'formal_chapter_exams.minimum_passed_count',
    'stage_exams.required_count',
    'blocking_gaps.maximum_allowed_count'
  ] loop
    v_number := p_requirements #>> string_to_array(v_section, '.');
    if v_number < 0 or v_number <> trunc(v_number) then
      return false;
    end if;
  end loop;

  if ((p_requirements #>> '{textbook,required_chapter_count}')::numeric) < 1
    or ((p_requirements #>> '{formal_chapter_exams,minimum_passed_count}')::numeric)
      > ((p_requirements #>> '{formal_chapter_exams,minimum_completed_count}')::numeric) then
    return false;
  end if;

  foreach v_section in array array[
    'formal_chapter_exams.passing_score',
    'midterm_exam.passing_score',
    'final_exam.passing_score',
    'overall_score.minimum_score'
  ] loop
    v_number := p_requirements #>> string_to_array(v_section, '.');
    if v_number < 0 or v_number > 100 then
      return false;
    end if;
  end loop;

  return true;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return false;
end;
$$;

revoke all on function private.completion_policy_requirements_are_valid(jsonb)
  from public;
grant execute on function private.completion_policy_requirements_are_valid(jsonb)
  to authenticated, service_role;

create table public.course_completion_policies (
  id uuid primary key default gen_random_uuid(),
  student_app_id uuid not null
    references public.student_apps(id) on delete restrict,
  course_id uuid not null references public.courses(id) on delete restrict,
  policy_code text not null,
  version integer not null,
  title text not null,
  status text not null default 'draft',
  is_default boolean not null default true,
  effective_from timestamptz,
  effective_until timestamptz,
  requirements jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  published_by uuid references public.profiles(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_completion_policies_code_version_key
    unique (policy_code, version),
  constraint course_completion_policies_policy_snapshot_key
    unique (id, version, student_app_id, course_id),
  constraint course_completion_policies_code_check
    check (policy_code ~ '^[A-Z0-9][A-Z0-9_-]{2,79}$'),
  constraint course_completion_policies_version_check check (version > 0),
  constraint course_completion_policies_title_check
    check (char_length(btrim(title)) between 2 and 160),
  constraint course_completion_policies_status_check
    check (status in ('draft', 'published', 'retired')),
  constraint course_completion_policies_time_check
    check (effective_until is null or effective_until > effective_from),
  constraint course_completion_policies_requirements_object_check
    check (jsonb_typeof(requirements) = 'object'),
  constraint course_completion_policies_publication_metadata_check check (
    (status = 'draft' and published_by is null and published_at is null)
    or
    (status in ('published', 'retired') and published_by is not null and published_at is not null)
  ),
  constraint course_completion_policies_default_effective_excl
    exclude using gist (
      course_id with =,
      (tstzrange(effective_from, effective_until, '[)')) with &&
    )
    where (status = 'published' and is_default)
);

comment on table public.course_completion_policies is
  '平台负责人维护的版本化结课政策；默认已发布政策的生效时间段按课程不可重叠。';
comment on column public.course_completion_policies.is_default is
  '是否作为课程在该生效区间内的默认结课政策；非默认已发布政策不参与唯一生效约束。';
comment on column public.course_completion_policies.requirements is
  '结课要求结构：教材、必修作业、正式章节考试、4套阶段考试、期中、期末、认证主观题批改、综合成绩与严重缺口阈值。';

create index course_completion_policies_course_status_effective_idx
  on public.course_completion_policies
  (student_app_id, course_id, status, effective_from desc);

create or replace function private.enforce_course_completion_policy_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null or not private.is_platform_owner() then
    raise exception '只有平台负责人可以创建、发布、停用或修改结课政策';
  end if;

  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception '已发布的结课政策不可删除，请发布新版本或停用当前版本';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'retired' then
      raise exception '新建结课政策只能是草稿或直接发布';
    end if;
    if new.created_by is not null and new.created_by <> v_actor_id then
      raise exception '结课政策创建人必须是当前平台负责人';
    end if;
    new.created_by := v_actor_id;
  else
    if new.created_by is distinct from old.created_by then
      raise exception '结课政策创建人不可修改';
    end if;

    if old.status = 'published' then
      if new.status not in ('published', 'retired')
        or (to_jsonb(new) - array['status', 'updated_at'])
          is distinct from (to_jsonb(old) - array['status', 'updated_at']) then
        raise exception '已发布的结课政策内容不可直接修改，请复制为新版本';
      end if;
    elsif old.status = 'retired' then
      raise exception '已发布并停用的结课政策不可修改，请复制为新版本';
    elsif new.status = 'retired' then
      raise exception '草稿不能直接停用';
    end if;
  end if;

  if not exists (
    select 1
    from public.courses as course
    where course.id = new.course_id
      and course.student_app_id = new.student_app_id
  ) then
    raise exception '结课政策的 course_id 与 student_app_id 不属于同一学习应用';
  end if;

  if new.status = 'published'
    and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if new.effective_from is null then
      raise exception '发布结课政策必须设置生效时间';
    end if;
    if not private.completion_policy_requirements_are_valid(new.requirements) then
      raise exception '结课政策 requirements 缺少必修项、阈值或字段类型无效';
    end if;
    new.published_by := v_actor_id;
    new.published_at := now();
  elsif new.status = 'draft' then
    new.published_by := null;
    new.published_at := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.enforce_course_completion_policy_lifecycle()
  from public;

create trigger course_completion_policies_enforce_lifecycle
before insert or update or delete on public.course_completion_policies
for each row execute function private.enforce_course_completion_policy_lifecycle();

create table public.student_course_completion_evaluations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  student_app_id uuid not null
    references public.student_apps(id) on delete restrict,
  course_id uuid not null references public.courses(id) on delete restrict,
  policy_id uuid not null,
  policy_version integer not null,
  status text not null,
  eligible boolean not null default false,
  overall_score numeric(7, 3),
  requirements_snapshot jsonb not null,
  evidence_snapshot jsonb not null,
  missing_requirements jsonb not null default '[]'::jsonb,
  evaluated_at timestamptz not null default now(),
  evaluation_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_course_completion_evaluations_membership_fkey
    foreign key (tenant_id, student_id)
    references public.tenant_memberships(tenant_id, user_id) on delete cascade,
  constraint student_course_completion_evaluations_policy_fkey
    foreign key (policy_id, policy_version, student_app_id, course_id)
    references public.course_completion_policies
      (id, version, student_app_id, course_id)
    on delete restrict,
  constraint student_course_completion_evaluations_policy_version_check
    check (policy_version > 0),
  constraint student_course_completion_evaluations_status_check
    check (status in (
      'not_ready', 'pending_grading', 'not_eligible', 'eligible', 'superseded'
    )),
  constraint student_course_completion_evaluations_eligible_check check (
    (status = 'eligible' and eligible)
    or (status in ('not_ready', 'pending_grading', 'not_eligible') and not eligible)
    or status = 'superseded'
  ),
  constraint student_course_completion_evaluations_score_check
    check (overall_score is null or overall_score between 0 and 100),
  constraint student_course_completion_evaluations_requirements_check
    check (jsonb_typeof(requirements_snapshot) = 'object'),
  constraint student_course_completion_evaluations_evidence_check
    check (jsonb_typeof(evidence_snapshot) = 'object'),
  constraint student_course_completion_evaluations_missing_check
    check (jsonb_typeof(missing_requirements) = 'array'),
  constraint student_course_completion_evaluations_version_check
    check (char_length(btrim(evaluation_version)) between 1 and 80)
);

comment on table public.student_course_completion_evaluations is
  '按机构隔离的学生结课资格计算快照；计算逻辑与刷新机制由后续 Packet 实现。';
comment on column public.student_course_completion_evaluations.policy_version is
  '与 policy_id 组成受外键约束的政策版本快照，不允许记录与政策不一致的版本。';

create index student_course_completion_evaluations_student_timeline_idx
  on public.student_course_completion_evaluations
  (tenant_id, student_id, student_app_id, course_id, evaluated_at desc);
create index student_course_completion_evaluations_tenant_status_idx
  on public.student_course_completion_evaluations
  (tenant_id, student_app_id, course_id, status, evaluated_at desc);
create index student_course_completion_evaluations_policy_idx
  on public.student_course_completion_evaluations
  (policy_id, policy_version, evaluated_at desc);

create or replace function private.validate_completion_evaluation_student()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.tenant_memberships as membership
    where membership.tenant_id = new.tenant_id
      and membership.user_id = new.student_id
      and membership.role = 'student'
  ) then
    raise exception '结课资格记录的 student_id 必须是该机构学生';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.validate_completion_evaluation_student()
  from public;

create trigger student_course_completion_evaluations_validate_student
before insert or update on public.student_course_completion_evaluations
for each row execute function private.validate_completion_evaluation_student();

alter table public.course_completion_policies enable row level security;
alter table public.course_completion_policies force row level security;
alter table public.student_course_completion_evaluations enable row level security;
alter table public.student_course_completion_evaluations force row level security;

create policy "authenticated users read published completion policies"
on public.course_completion_policies for select to authenticated
using (
  status = 'published'
  and private.current_user_can_read_student_app(student_app_id)
);

create policy "platform owner reads all completion policies"
on public.course_completion_policies for select to authenticated
using ((select private.is_platform_owner()));

create policy "platform owner manages completion policies"
on public.course_completion_policies for all to authenticated
using ((select private.is_platform_owner()))
with check ((select private.is_platform_owner()));

create policy "students read own completion evaluations"
on public.student_course_completion_evaluations for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and student_id = (select auth.uid())
);

create policy "teachers read assigned student completion evaluations"
on public.student_course_completion_evaluations for select to authenticated
using (
  private.current_teacher_has_student_app_access(
    tenant_id, student_id, student_app_id
  )
);

create policy "institution leaders manage tenant completion evaluations"
on public.student_course_completion_evaluations for all to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select private.has_current_tenant_role(
    array['tenant_super_admin', 'ceo']::text[]
  ))
)
with check (
  tenant_id = (select private.current_tenant_id())
  and (select private.has_current_tenant_role(
    array['tenant_super_admin', 'ceo']::text[]
  ))
);

create policy "platform owner reads all completion evaluations"
on public.student_course_completion_evaluations for select to authenticated
using ((select private.is_platform_owner()));

revoke all on public.course_completion_policies from anon, authenticated;
grant select, insert, update, delete
  on public.course_completion_policies to authenticated;
grant all on public.course_completion_policies to service_role;

revoke all on public.student_course_completion_evaluations
  from anon, authenticated;
grant select, insert, update, delete
  on public.student_course_completion_evaluations to authenticated;
grant all on public.student_course_completion_evaluations to service_role;

commit;
