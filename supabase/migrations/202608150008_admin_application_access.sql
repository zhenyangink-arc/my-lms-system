begin;

-- ============================================================
-- 管理端应用域权限
--
-- tenant_student_apps 只描述“机构是否开放应用”，不能回答：
--   1. 哪个学生真正拥有应用；
--   2. 哪位员工可以运营该应用；
--   3. 老师负责的学生关系属于哪个应用。
-- 本迁移补齐上述三层边界，并保留现有开发数据的访问能力。
-- ============================================================

create table if not exists public.student_app_enrollments (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  app_id uuid not null references public.student_apps(id) on delete restrict,
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed', 'cancelled')),
  access_tier text not null default 'normal'
    check (access_tier in ('normal', 'vip1', 'vip2', 'vip3')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  enrolled_by uuid references auth.users(id) on delete set null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, student_id, app_id),
  constraint student_app_enrollments_time_check
    check (ends_at is null or ends_at > starts_at),
  constraint student_app_enrollments_settings_object_check
    check (jsonb_typeof(settings) = 'object')
);

create table if not exists public.staff_app_assignments (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  staff_id uuid not null references public.profiles(id) on delete cascade,
  app_id uuid not null references public.student_apps(id) on delete restrict,
  access_role text not null default 'viewer'
    check (access_role in ('administrator', 'operator', 'teacher', 'viewer')),
  can_manage_students boolean not null default false,
  can_manage_content boolean not null default false,
  can_manage_assessments boolean not null default false,
  can_view_analytics boolean not null default true,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, staff_id, app_id)
);

create table if not exists public.application_access_audit_logs (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  app_id uuid not null references public.student_apps(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  subject_type text not null
    check (subject_type in ('student', 'staff', 'tenant_app')),
  subject_user_id uuid,
  operation text not null check (operation in ('insert', 'update', 'delete')),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists student_app_enrollments_student_status_idx
  on public.student_app_enrollments
  (tenant_id, student_id, status, app_id);
create index if not exists student_app_enrollments_app_status_idx
  on public.student_app_enrollments
  (tenant_id, app_id, status, student_id);
create index if not exists staff_app_assignments_staff_status_idx
  on public.staff_app_assignments
  (tenant_id, staff_id, status, app_id);
create index if not exists staff_app_assignments_app_status_idx
  on public.staff_app_assignments
  (tenant_id, app_id, status, staff_id);
create index if not exists application_access_audit_tenant_created_idx
  on public.application_access_audit_logs
  (tenant_id, created_at desc);

drop trigger if exists student_app_enrollments_set_updated_at
  on public.student_app_enrollments;
create trigger student_app_enrollments_set_updated_at
before update on public.student_app_enrollments
for each row execute function private.set_updated_at();

drop trigger if exists staff_app_assignments_set_updated_at
  on public.staff_app_assignments;
create trigger staff_app_assignments_set_updated_at
before update on public.staff_app_assignments
for each row execute function private.set_updated_at();

-- 迁移前学生门户按 tenant_student_apps 对租户全部学生开放。
-- 回填相同可见范围，部署后不会因为新增学生级授权而突然失去入口。
insert into public.student_app_enrollments (
  tenant_id,
  student_id,
  app_id,
  status,
  access_tier,
  starts_at
)
select
  membership.tenant_id,
  membership.user_id,
  tenant_app.app_id,
  'active',
  membership.membership_tier,
  coalesce(membership.joined_at, membership.created_at, now())
from public.tenant_memberships as membership
join public.tenant_student_apps as tenant_app
  on tenant_app.tenant_id = membership.tenant_id
where membership.role = 'student'
  and membership.status = 'active'
  and tenant_app.is_enabled
  and tenant_app.status <> 'hidden'
on conflict (tenant_id, student_id, app_id) do nothing;

-- 现有后台成员先继承租户当前应用。之后机构负责人可按应用收窄权限。
insert into public.staff_app_assignments (
  tenant_id,
  staff_id,
  app_id,
  access_role,
  can_manage_students,
  can_manage_content,
  can_manage_assessments,
  can_view_analytics,
  status
)
select
  membership.tenant_id,
  membership.user_id,
  tenant_app.app_id,
  case membership.role
    when 'tenant_super_admin' then 'administrator'
    when 'ceo' then 'administrator'
    when 'admin' then 'operator'
    when 'teacher' then 'teacher'
    else 'viewer'
  end,
  membership.role in ('tenant_super_admin', 'ceo', 'admin'),
  membership.role in ('tenant_super_admin', 'ceo'),
  membership.role in ('tenant_super_admin', 'ceo', 'admin', 'teacher'),
  true,
  'active'
from public.tenant_memberships as membership
join public.tenant_student_apps as tenant_app
  on tenant_app.tenant_id = membership.tenant_id
where membership.role in ('teacher', 'admin', 'ceo', 'tenant_super_admin')
  and membership.status = 'active'
  and tenant_app.is_enabled
  and tenant_app.status <> 'hidden'
on conflict (tenant_id, staff_id, app_id) do nothing;

-- 师生关系从“机构范围”升级为“应用范围”。现有关系来自当前韩语教学端，
-- 因此安全回填到韩语应用，不复制到英语、数学或留学服务。
alter table public.tenant_student_assignments
  add column if not exists student_app_id uuid
    references public.student_apps(id) on delete restrict;

update public.tenant_student_assignments
set student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
where student_app_id is null;

alter table public.tenant_student_assignments
  alter column student_app_id set default
    '10000000-0000-4000-8000-000000000001'::uuid,
  alter column student_app_id set not null;

alter table public.tenant_student_assignments
  drop constraint if exists tenant_student_assignments_unique_pair;
alter table public.tenant_student_assignments
  drop constraint if exists tenant_student_assignments_unique_app_pair;
alter table public.tenant_student_assignments
  add constraint tenant_student_assignments_unique_app_pair
    unique (tenant_id, student_id, teacher_id, student_app_id);

create index if not exists tenant_student_assignments_teacher_app_idx
  on public.tenant_student_assignments
  (tenant_id, teacher_id, student_app_id, student_id);
create index if not exists tenant_student_assignments_student_app_idx
  on public.tenant_student_assignments
  (tenant_id, student_id, student_app_id, teacher_id);

-- 平台练习库也属于具体学生应用。现有内容全部来自韩语成长工具箱，
-- 因此迁移时归入韩语应用；后续其他语言应用可写入自己的 app_id。
alter table public.growth_toolbox_items
  add column if not exists student_app_id uuid not null
  default '10000000-0000-4000-8000-000000000001'::uuid
  references public.student_apps(id) on delete restrict;
alter table public.growth_toolbox_vocabulary
  add column if not exists student_app_id uuid not null
  default '10000000-0000-4000-8000-000000000001'::uuid
  references public.student_apps(id) on delete restrict;
alter table public.growth_toolbox_grammar
  add column if not exists student_app_id uuid not null
  default '10000000-0000-4000-8000-000000000001'::uuid
  references public.student_apps(id) on delete restrict;

create index if not exists growth_toolbox_items_student_app_idx
  on public.growth_toolbox_items (student_app_id, is_enabled, sort_order);
create index if not exists growth_toolbox_vocabulary_student_app_idx
  on public.growth_toolbox_vocabulary (student_app_id, sort_order);
create index if not exists growth_toolbox_grammar_student_app_idx
  on public.growth_toolbox_grammar (student_app_id, sort_order);

create or replace function private.validate_application_access_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_expected_role text;
  v_membership_tier text;
begin
  -- 所有状态都校验账号与机构关系，避免先写入跨租户的暂停记录，
  -- 再通过一次状态更新把脏数据激活。
  v_user_id := case
    when tg_table_name = 'student_app_enrollments' then new.student_id
    else new.staff_id
  end;
  v_expected_role := case
    when tg_table_name = 'student_app_enrollments' then 'student'
    else null
  end;

  select membership.membership_tier
  into v_membership_tier
  from public.tenant_memberships as membership
  where membership.tenant_id = new.tenant_id
    and membership.user_id = v_user_id
    and membership.status = 'active'
    and (
      (v_expected_role = 'student' and membership.role = 'student')
      or (v_expected_role is null and membership.role in (
        'teacher', 'admin', 'ceo', 'tenant_super_admin'
      ))
    );

  if not found then
    raise exception '应用授权目标不属于当前机构或账号角色不正确';
  end if;

  if tg_table_name = 'student_app_enrollments'
    and new.access_tier is distinct from v_membership_tier then
    raise exception '学生应用等级必须与当前机构会员等级一致';
  end if;

  if not exists (
    select 1
    from public.tenant_student_apps as tenant_app
    where tenant_app.tenant_id = new.tenant_id
      and tenant_app.app_id = new.app_id
  ) then
    raise exception '当前机构没有注册该应用';
  end if;

  if new.status = 'active' and not exists (
    select 1
    from public.tenant_student_apps as tenant_app
    where tenant_app.tenant_id = new.tenant_id
      and tenant_app.app_id = new.app_id
      and tenant_app.is_enabled
      and tenant_app.status <> 'hidden'
  ) then
    raise exception '当前机构尚未开放该应用';
  end if;

  return new;
end;
$$;

drop trigger if exists student_app_enrollments_validate
  on public.student_app_enrollments;
create trigger student_app_enrollments_validate
before insert or update of tenant_id, student_id, app_id, status, access_tier
on public.student_app_enrollments
for each row execute function private.validate_application_access_row();

drop trigger if exists staff_app_assignments_validate
  on public.staff_app_assignments;
create trigger staff_app_assignments_validate
before insert or update of tenant_id, staff_id, app_id, status
on public.staff_app_assignments
for each row execute function private.validate_application_access_row();

create or replace function public.validate_student_teacher_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.student_id = new.teacher_id then
    raise exception '学生与负责老师不能是同一账号。';
  end if;

  if not exists (
    select 1
    from public.student_app_enrollments as enrollment
    where enrollment.tenant_id = new.tenant_id
      and enrollment.student_id = new.student_id
      and enrollment.app_id = new.student_app_id
      and enrollment.status = 'active'
      and (enrollment.ends_at is null or enrollment.ends_at > now())
  ) then
    raise exception '目标学生未开通该应用。';
  end if;

  if not exists (
    select 1
    from public.staff_app_assignments as staff_access
    where staff_access.tenant_id = new.tenant_id
      and staff_access.staff_id = new.teacher_id
      and staff_access.app_id = new.student_app_id
      and staff_access.status = 'active'
      and staff_access.access_role in ('teacher', 'operator', 'administrator')
  ) then
    raise exception '目标老师没有该应用的教学权限。';
  end if;

  return new;
end;
$$;

-- 三类应用授权变化统一留痕。日志只由触发器写入，客户端不可伪造。
create or replace function private.audit_application_access_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_app_id uuid;
  v_subject_type text;
  v_subject_user_id uuid;
begin
  if tg_op = 'DELETE' then
    v_tenant_id := old.tenant_id;
    v_app_id := old.app_id;
  else
    v_tenant_id := new.tenant_id;
    v_app_id := new.app_id;
  end if;
  v_subject_type := case tg_table_name
    when 'student_app_enrollments' then 'student'
    when 'staff_app_assignments' then 'staff'
    else 'tenant_app'
  end;
  if tg_table_name = 'student_app_enrollments' then
    v_subject_user_id := case
      when tg_op = 'DELETE' then old.student_id
      else new.student_id
    end;
  elsif tg_table_name = 'staff_app_assignments' then
    v_subject_user_id := case
      when tg_op = 'DELETE' then old.staff_id
      else new.staff_id
    end;
  else
    v_subject_user_id := null;
  end if;

  insert into public.application_access_audit_logs (
    tenant_id,
    app_id,
    actor_id,
    subject_type,
    subject_user_id,
    operation,
    before_data,
    after_data
  ) values (
    v_tenant_id,
    v_app_id,
    auth.uid(),
    v_subject_type,
    v_subject_user_id,
    lower(tg_op),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists student_app_enrollments_audit
  on public.student_app_enrollments;
create trigger student_app_enrollments_audit
after insert or update or delete on public.student_app_enrollments
for each row execute function private.audit_application_access_change();

drop trigger if exists staff_app_assignments_audit
  on public.staff_app_assignments;
create trigger staff_app_assignments_audit
after insert or update or delete on public.staff_app_assignments
for each row execute function private.audit_application_access_change();

drop trigger if exists tenant_student_apps_access_audit
  on public.tenant_student_apps;
create trigger tenant_student_apps_access_audit
after update of is_enabled, status on public.tenant_student_apps
for each row
when (
  old.is_enabled is distinct from new.is_enabled
  or old.status is distinct from new.status
)
execute function private.audit_application_access_change();

alter table public.student_app_enrollments enable row level security;
alter table public.staff_app_assignments enable row level security;
alter table public.application_access_audit_logs enable row level security;

revoke all on public.student_app_enrollments from public, anon, authenticated;
revoke all on public.staff_app_assignments from public, anon, authenticated;
revoke all on public.application_access_audit_logs from public, anon, authenticated;
grant select, insert, update, delete on public.student_app_enrollments to authenticated;
grant select, insert, update, delete on public.staff_app_assignments to authenticated;
grant select on public.application_access_audit_logs to authenticated;
grant usage, select on sequence public.application_access_audit_logs_id_seq
  to authenticated;

drop policy if exists "students read own application enrollments"
  on public.student_app_enrollments;
create policy "students read own application enrollments"
on public.student_app_enrollments for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and student_id = (select auth.uid())
);

drop policy if exists "application staff read student enrollments"
  on public.student_app_enrollments;
create policy "application staff read student enrollments"
on public.student_app_enrollments for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and exists (
    select 1
    from public.staff_app_assignments as staff_access
    where staff_access.tenant_id = student_app_enrollments.tenant_id
      and staff_access.staff_id = (select auth.uid())
      and staff_access.app_id = student_app_enrollments.app_id
      and staff_access.status = 'active'
      and staff_access.access_role in ('administrator', 'operator', 'viewer')
      and (
        staff_access.can_manage_students
        or staff_access.can_view_analytics
      )
  )
);

drop policy if exists "teachers read assigned student app enrollments"
  on public.student_app_enrollments;
create policy "teachers read assigned student app enrollments"
on public.student_app_enrollments for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and exists (
    select 1
    from public.tenant_student_assignments as assignment
    where assignment.tenant_id = student_app_enrollments.tenant_id
      and assignment.student_id = student_app_enrollments.student_id
      and assignment.teacher_id = (select auth.uid())
      and assignment.student_app_id = student_app_enrollments.app_id
  )
);

drop policy if exists "application managers manage student enrollments"
  on public.student_app_enrollments;
create policy "application managers manage student enrollments"
on public.student_app_enrollments for all to authenticated
using (
  (select private.is_platform_tenant_manager())
  or (
    tenant_id = (select private.current_tenant_id())
    and (select private.has_current_tenant_role(
      array['tenant_super_admin', 'ceo', 'admin']::text[]
    ))
  )
)
with check (
  (select private.is_platform_tenant_manager())
  or (
    tenant_id = (select private.current_tenant_id())
    and (select private.has_current_tenant_role(
      array['tenant_super_admin', 'ceo', 'admin']::text[]
    ))
  )
);

drop policy if exists "staff read own application assignments"
  on public.staff_app_assignments;
create policy "staff read own application assignments"
on public.staff_app_assignments for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and staff_id = (select auth.uid())
);

drop policy if exists "application executives manage staff assignments"
  on public.staff_app_assignments;
create policy "application executives manage staff assignments"
on public.staff_app_assignments for all to authenticated
using (
  (select private.is_platform_tenant_manager())
  or (
    tenant_id = (select private.current_tenant_id())
    and (select private.has_current_tenant_role(
      array['tenant_super_admin', 'ceo']::text[]
    ))
  )
)
with check (
  (select private.is_platform_tenant_manager())
  or (
    tenant_id = (select private.current_tenant_id())
    and (select private.has_current_tenant_role(
      array['tenant_super_admin', 'ceo']::text[]
    ))
  )
);

drop policy if exists "application managers read access audit"
  on public.application_access_audit_logs;
create policy "application managers read access audit"
on public.application_access_audit_logs for select to authenticated
using (
  (select private.is_platform_tenant_manager())
  or (
    tenant_id = (select private.current_tenant_id())
    and (select private.has_current_tenant_role(
      array['tenant_super_admin', 'ceo']::text[]
    ))
  )
);

-- tenant_student_apps 原先仅供读取。现在机构负责人可控制应用状态，
-- 平台租户管理角色可跨机构执行相同操作。
grant update (is_enabled, status, custom_title, sort_order)
  on public.tenant_student_apps to authenticated;

drop policy if exists "application managers update tenant apps"
  on public.tenant_student_apps;
create policy "application managers update tenant apps"
on public.tenant_student_apps for update to authenticated
using (
  (select private.is_platform_tenant_manager())
  or (
    tenant_id = (select private.current_tenant_id())
    and (select private.has_current_tenant_role(
      array['tenant_super_admin', 'ceo']::text[]
    ))
  )
)
with check (
  (select private.is_platform_tenant_manager())
  or (
    tenant_id = (select private.current_tenant_id())
    and (select private.has_current_tenant_role(
      array['tenant_super_admin', 'ceo']::text[]
    ))
  )
);

-- 平台租户管理角色既然可以更新租户应用，也必须拥有同一行的 SELECT
-- 可见性；PostgreSQL 的 UPDATE 会同时检查 SELECT 策略。
drop policy if exists "members read tenant student apps"
  on public.tenant_student_apps;
create policy "members read tenant student apps"
on public.tenant_student_apps for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  or (select private.is_platform_owner())
  or (select private.is_platform_tenant_manager())
);

-- 老师读取教学事实时，负责关系和事实本身必须属于同一个应用。
-- 仅按 student_id 判断会导致“负责该学生的韩语”顺带读取其英语数据。
drop policy if exists "teachers read lesson progress of their assigned students"
  on public.lesson_progress;
create policy "teachers read lesson progress of their assigned students"
on public.lesson_progress for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and exists (
    select 1
    from public.courses as course
    join public.tenant_student_assignments as app_assignment
      on app_assignment.tenant_id = lesson_progress.tenant_id
     and app_assignment.student_id = lesson_progress.user_id
     and app_assignment.student_app_id = course.student_app_id
    where course.id = lesson_progress.course_id
      and app_assignment.teacher_id = (select auth.uid())
  )
);

drop policy if exists "teachers read ebook progress of their assigned students"
  on public.course_ebook_progress;
create policy "teachers read ebook progress of their assigned students"
on public.course_ebook_progress for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and exists (
    select 1
    from public.tenant_student_assignments as app_assignment
    where app_assignment.tenant_id = course_ebook_progress.tenant_id
      and app_assignment.student_id = course_ebook_progress.student_id
      and app_assignment.teacher_id = (select auth.uid())
      and app_assignment.student_app_id = course_ebook_progress.student_app_id
  )
);

drop policy if exists "teachers read notes of their assigned students"
  on public.learning_record_notes;
create policy "teachers read notes of their assigned students"
on public.learning_record_notes for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and exists (
    select 1
    from public.tenant_student_assignments as app_assignment
    where app_assignment.tenant_id = learning_record_notes.tenant_id
      and app_assignment.student_id = learning_record_notes.student_id
      and app_assignment.teacher_id = (select auth.uid())
      and app_assignment.student_app_id = learning_record_notes.student_app_id
  )
);

drop policy if exists "teachers read submissions of their assigned students"
  on public.learning_submissions;
create policy "teachers read submissions of their assigned students"
on public.learning_submissions for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and exists (
    select 1
    from public.learning_assignments as learning_assignment
    join public.tenant_student_assignments as app_assignment
      on app_assignment.tenant_id = learning_submissions.tenant_id
     and app_assignment.student_id = learning_submissions.student_id
     and app_assignment.student_app_id = learning_assignment.student_app_id
    where learning_assignment.id = learning_submissions.assignment_id
      and app_assignment.teacher_id = (select auth.uid())
  )
);

drop policy if exists "teachers read test attempts of their assigned students"
  on public.chapter_test_attempts;
create policy "teachers read test attempts of their assigned students"
on public.chapter_test_attempts for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and exists (
    select 1
    from public.chapter_tests as test
    join public.tenant_student_assignments as app_assignment
      on app_assignment.tenant_id = chapter_test_attempts.tenant_id
     and app_assignment.student_id = chapter_test_attempts.student_id
     and app_assignment.student_app_id = test.student_app_id
    where test.slug = chapter_test_attempts.test_slug
      and app_assignment.teacher_id = (select auth.uid())
  )
);

drop policy if exists "teachers read grade reviews of their assigned students"
  on public.grade_review_requests;
create policy "teachers read grade reviews of their assigned students"
on public.grade_review_requests for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and exists (
    select 1
    from public.tenant_student_assignments as app_assignment
    where app_assignment.tenant_id = grade_review_requests.tenant_id
      and app_assignment.student_id = grade_review_requests.student_id
      and app_assignment.teacher_id = (select auth.uid())
      and (
        (
          grade_review_requests.source_type = 'assignment_submission'
          and exists (
            select 1
            from public.learning_submissions as submission
            join public.learning_assignments as learning_assignment
              on learning_assignment.tenant_id = submission.tenant_id
             and learning_assignment.id = submission.assignment_id
            where submission.tenant_id = grade_review_requests.tenant_id
              and submission.id = grade_review_requests.source_result_id
              and learning_assignment.student_app_id = app_assignment.student_app_id
          )
        )
        or (
          grade_review_requests.source_type = 'chapter_test_attempt'
          and exists (
            select 1
            from public.chapter_test_attempts as attempt
            join public.chapter_tests as test on test.id = attempt.test_id
            where attempt.tenant_id = grade_review_requests.tenant_id
              and attempt.id = grade_review_requests.source_result_id
              and test.student_app_id = app_assignment.student_app_id
          )
        )
        or (
          grade_review_requests.source_type = 'manual_grade_record'
          and exists (
            select 1
            from public.grade_records as grade_record
            join public.grade_items as grade_item
              on grade_item.tenant_id = grade_record.tenant_id
             and grade_item.id = grade_record.item_id
            left join public.courses as course on course.id = grade_item.course_id
            left join public.learning_assignments as learning_assignment
              on learning_assignment.id = grade_item.source_assignment_id
            where grade_record.tenant_id = grade_review_requests.tenant_id
              and grade_record.id = grade_review_requests.record_id
              and coalesce(
                course.student_app_id,
                learning_assignment.student_app_id
              ) = app_assignment.student_app_id
          )
        )
      )
  )
);

drop policy if exists "teachers read progress of their assigned students"
  on public.conversation_practice_progress;
create policy "teachers read progress of their assigned students"
on public.conversation_practice_progress for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and exists (
    select 1
    from public.conversation_practice_scenarios as scenario
    join public.tenant_student_assignments as app_assignment
      on app_assignment.tenant_id = conversation_practice_progress.tenant_id
     and app_assignment.student_id = conversation_practice_progress.user_id
     and app_assignment.student_app_id = scenario.student_app_id
    where scenario.id = conversation_practice_progress.scenario_id
      and app_assignment.teacher_id = (select auth.uid())
  )
);

-- 学习记录的旧 RPC 按整个机构聚合。应用工作区必须从 SQL 源头按 app_id
-- 约束学生、课程、任务、会话和人工备注，避免在前端再做不完整过滤。
create or replace function public.list_learning_record_students_by_app(
  p_student_app_id uuid
)
returns table(id uuid, full_name text, email text, membership_tier text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.current_user_can_view_learning_records() then
    raise exception '当前账号没有学习记录查看权限';
  end if;
  if not (
    (select private.has_current_tenant_role(
      array['tenant_super_admin', 'ceo']::text[]
    ))
    or exists (
      select 1
      from public.staff_app_assignments as access
      where access.tenant_id = private.current_tenant_id()
        and access.staff_id = (select auth.uid())
        and access.app_id = p_student_app_id
        and access.status = 'active'
        and access.can_view_analytics
    )
  ) then
    raise exception '当前账号没有该应用的数据权限';
  end if;

  return query
  select profile.id, profile.full_name, profile.email, membership.membership_tier
  from public.student_app_enrollments as enrollment
  join public.tenant_memberships as membership
    on membership.tenant_id = enrollment.tenant_id
   and membership.user_id = enrollment.student_id
  join public.profiles as profile on profile.id = enrollment.student_id
  where enrollment.tenant_id = private.current_tenant_id()
    and enrollment.app_id = p_student_app_id
    and enrollment.status = 'active'
    and enrollment.starts_at <= now()
    and (enrollment.ends_at is null or enrollment.ends_at > now())
    and membership.role = 'student'
    and membership.status = 'active'
    and coalesce(profile.status, 'active') = 'active'
    and (
      public.current_profile_role() <> 'teacher'
      or exists (
        select 1
        from public.tenant_student_assignments as assignment
        where assignment.tenant_id = enrollment.tenant_id
          and assignment.student_id = enrollment.student_id
          and assignment.teacher_id = (select auth.uid())
          and assignment.student_app_id = p_student_app_id
      )
    )
  order by coalesce(profile.full_name, profile.email, profile.id::text);
end;
$$;

create or replace function public.get_tenant_student_learning_record_overview_by_app(
  p_student_app_id uuid
)
returns table (
  student_id uuid,
  full_name text,
  email text,
  membership_tier text,
  completed_lesson_count bigint,
  active_lesson_count bigint,
  submission_count bigint,
  graded_submission_count bigint,
  conversation_practice_count bigint,
  grade_count bigint,
  note_count bigint,
  attention_count bigint,
  last_learning_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.current_user_can_view_learning_records() then
    raise exception '当前账号没有学习记录查看权限';
  end if;
  if not (
    (select private.has_current_tenant_role(
      array['tenant_super_admin', 'ceo']::text[]
    ))
    or exists (
      select 1
      from public.staff_app_assignments as access
      where access.tenant_id = private.current_tenant_id()
        and access.staff_id = (select auth.uid())
        and access.app_id = p_student_app_id
        and access.status = 'active'
        and access.can_view_analytics
    )
  ) then
    raise exception '当前账号没有该应用的数据权限';
  end if;

  return query
  with active_students as (
    select
      enrollment.student_id,
      profile.full_name,
      profile.email,
      membership.membership_tier
    from public.student_app_enrollments as enrollment
    join public.tenant_memberships as membership
      on membership.tenant_id = enrollment.tenant_id
     and membership.user_id = enrollment.student_id
    join public.profiles as profile on profile.id = enrollment.student_id
    where enrollment.tenant_id = private.current_tenant_id()
      and enrollment.app_id = p_student_app_id
      and enrollment.status = 'active'
      and enrollment.starts_at <= now()
      and (enrollment.ends_at is null or enrollment.ends_at > now())
      and membership.role = 'student'
      and membership.status = 'active'
      and coalesce(profile.status, 'active') = 'active'
      and (
        public.current_profile_role() <> 'teacher'
        or exists (
          select 1
          from public.tenant_student_assignments as assignment
          where assignment.tenant_id = enrollment.tenant_id
            and assignment.student_id = enrollment.student_id
            and assignment.teacher_id = (select auth.uid())
            and assignment.student_app_id = p_student_app_id
        )
      )
  ),
  lesson_statistics as (
    select
      progress.user_id as student_id,
      count(*) filter (where progress.status = 'completed')::bigint as completed_count,
      count(*) filter (where progress.status <> 'completed')::bigint as active_count,
      max(coalesce(progress.completed_at, progress.last_viewed_at, progress.updated_at)) as latest_at
    from public.lesson_progress as progress
    join public.courses as course on course.id = progress.course_id
    where progress.tenant_id = private.current_tenant_id()
      and course.student_app_id = p_student_app_id
    group by progress.user_id
  ),
  submission_statistics as (
    select
      submission.student_id,
      count(*)::bigint as submission_count,
      count(*) filter (where submission.status = 'graded')::bigint as graded_count,
      max(coalesce(submission.graded_at, submission.submitted_at)) as latest_at
    from public.learning_submissions as submission
    join public.learning_assignments as assignment
      on assignment.id = submission.assignment_id
    where submission.tenant_id = private.current_tenant_id()
      and assignment.student_app_id = p_student_app_id
    group by submission.student_id
  ),
  conversation_statistics as (
    select
      progress.user_id as student_id,
      coalesce(sum(progress.practice_count), 0)::bigint as practice_count,
      max(progress.last_practiced_at) as latest_at
    from public.conversation_practice_progress as progress
    join public.conversation_practice_scenarios as scenario
      on scenario.id = progress.scenario_id
    where progress.tenant_id = private.current_tenant_id()
      and scenario.student_app_id = p_student_app_id
    group by progress.user_id
  ),
  grade_statistics as (
    select
      record.student_id,
      count(*)::bigint as grade_count,
      max(record.graded_at) as latest_at
    from public.grade_records as record
    join public.grade_items as item on item.id = record.item_id
    left join public.courses as course on course.id = item.course_id
    left join public.learning_assignments as assignment
      on assignment.id = item.source_assignment_id
    where record.tenant_id = private.current_tenant_id()
      and coalesce(course.student_app_id, assignment.student_app_id) = p_student_app_id
    group by record.student_id
  ),
  note_statistics as (
    select
      note.student_id,
      count(*) filter (where note.status = 'active')::bigint as note_count,
      count(*) filter (
        where note.status = 'active' and note.record_type = 'attention'
      )::bigint as attention_count
    from public.learning_record_notes as note
    where note.tenant_id = private.current_tenant_id()
      and note.student_app_id = p_student_app_id
    group by note.student_id
  )
  select
    student.student_id,
    student.full_name,
    student.email,
    student.membership_tier,
    coalesce(lesson.completed_count, 0)::bigint,
    coalesce(lesson.active_count, 0)::bigint,
    coalesce(submission.submission_count, 0)::bigint,
    coalesce(submission.graded_count, 0)::bigint,
    coalesce(conversation.practice_count, 0)::bigint,
    coalesce(grade_record.grade_count, 0)::bigint,
    coalesce(note.note_count, 0)::bigint,
    coalesce(note.attention_count, 0)::bigint,
    greatest(
      lesson.latest_at,
      submission.latest_at,
      conversation.latest_at,
      grade_record.latest_at
    )
  from active_students as student
  left join lesson_statistics as lesson on lesson.student_id = student.student_id
  left join submission_statistics as submission on submission.student_id = student.student_id
  left join conversation_statistics as conversation on conversation.student_id = student.student_id
  left join grade_statistics as grade_record on grade_record.student_id = student.student_id
  left join note_statistics as note on note.student_id = student.student_id
  order by coalesce(student.full_name, student.email, student.student_id::text);
end;
$$;

revoke all on function public.list_learning_record_students_by_app(uuid)
  from public, anon;
revoke all on function public.get_tenant_student_learning_record_overview_by_app(uuid)
  from public, anon;
grant execute on function public.list_learning_record_students_by_app(uuid)
  to authenticated;
grant execute on function public.get_tenant_student_learning_record_overview_by_app(uuid)
  to authenticated;

comment on table public.student_app_enrollments is
  '学生级应用开通记录；租户开放应用后，学生仍需有本表授权才能进入。';
comment on table public.staff_app_assignments is
  '机构员工在具体学生应用中的运营、教学和分析权限。';
comment on column public.tenant_student_assignments.student_app_id is
  '师生负责关系所属学生应用；同一学生在不同应用可以由不同老师负责。';
comment on table public.application_access_audit_logs is
  '租户应用、学生应用和员工应用权限变更的只读审计记录。';

commit;
