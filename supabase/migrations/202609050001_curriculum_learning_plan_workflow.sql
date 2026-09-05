begin;

create table public.curriculum_plan_templates (
  id uuid primary key default gen_random_uuid(),
  student_app_id uuid not null references public.student_apps(id) on delete restrict,
  course_id uuid references public.courses(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text,
  duration_days integer not null check (duration_days between 1 and 366),
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  published_by uuid references public.profiles(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curriculum_plan_templates_publish_check check (
    (status = 'draft' and published_at is null and published_by is null)
    or (status in ('published', 'retired') and published_at is not null and published_by is not null)
  )
);

create index curriculum_plan_templates_app_status_idx
  on public.curriculum_plan_templates (student_app_id, status, updated_at desc);
create index curriculum_plan_templates_course_idx
  on public.curriculum_plan_templates (course_id, version desc);

create table public.curriculum_plan_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.curriculum_plan_templates(id) on delete cascade,
  day_offset integer not null check (day_offset between 0 and 365),
  start_minute integer not null check (start_minute between 0 and 1439),
  duration_minutes integer not null check (duration_minutes between 5 and 720),
  activity_type text not null check (
    activity_type in (
      'course', 'listening', 'speaking', 'reading', 'writing',
      'vocabulary', 'grammar', 'chapter_test', 'stage_exam', 'final_exam', 'review'
    )
  ),
  source_type text not null check (
    source_type in ('lesson', 'specialized_practice', 'chapter_test', 'assessment_paper', 'manual')
  ),
  source_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  destination_path text check (destination_path is null or destination_path like '/%'),
  instructions text,
  is_required boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curriculum_plan_template_items_source_check check (
    (source_type = 'manual' and source_id is null)
    or (source_type <> 'manual' and source_id is not null)
  )
);

create index curriculum_plan_template_items_schedule_idx
  on public.curriculum_plan_template_items
  (template_id, day_offset, start_minute, sort_order);

create table public.institution_curriculum_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants(id) on delete cascade,
  student_app_id uuid not null references public.student_apps(id) on delete restrict,
  template_id uuid not null references public.curriculum_plan_templates(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'active', 'completed', 'cancelled')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  published_by uuid references public.profiles(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint institution_curriculum_plans_time_check check (ends_at > starts_at),
  constraint institution_curriculum_plans_publish_check check (
    (status = 'draft' and published_at is null and published_by is null)
    or (status <> 'draft' and published_at is not null and published_by is not null)
  )
);

create index institution_curriculum_plans_tenant_status_idx
  on public.institution_curriculum_plans
  (tenant_id, student_app_id, status, starts_at desc);

create table public.institution_curriculum_plan_students (
  plan_id uuid not null references public.institution_curriculum_plans(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  primary key (plan_id, student_id)
);

create index institution_curriculum_plan_students_student_idx
  on public.institution_curriculum_plan_students
  (tenant_id, student_id, plan_id);

create or replace function private.guard_curriculum_plan_template_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_duration_days integer;
begin
  select template.status, template.duration_days
  into v_status, v_duration_days
  from public.curriculum_plan_templates as template
  where template.id = coalesce(new.template_id, old.template_id);

  if v_status is distinct from 'draft' then
    raise exception '已发布或停用的标准计划不能修改明细，请复制为新版本';
  end if;
  if tg_op <> 'DELETE' and new.day_offset >= v_duration_days then
    raise exception '计划项目超出模板总天数';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger curriculum_plan_template_items_guard
before insert or update or delete on public.curriculum_plan_template_items
for each row execute function private.guard_curriculum_plan_template_item();

create trigger curriculum_plan_templates_set_updated_at
before update on public.curriculum_plan_templates
for each row execute function private.set_updated_at();
create trigger curriculum_plan_template_items_set_updated_at
before update on public.curriculum_plan_template_items
for each row execute function private.set_updated_at();
create trigger institution_curriculum_plans_set_updated_at
before update on public.institution_curriculum_plans
for each row execute function private.set_updated_at();

alter table public.curriculum_plan_templates enable row level security;
alter table public.curriculum_plan_template_items enable row level security;
alter table public.institution_curriculum_plans enable row level security;
alter table public.institution_curriculum_plan_students enable row level security;

create policy "platform owner manages curriculum plan templates"
on public.curriculum_plan_templates for all to authenticated
using ((select private.is_platform_owner()))
with check ((select private.is_platform_owner()));

create policy "tenant staff read published curriculum plan templates"
on public.curriculum_plan_templates for select to authenticated
using (
  status = 'published'
  and exists (
    select 1 from public.staff_app_assignments as access
    where access.tenant_id = (select private.current_tenant_id())
      and access.staff_id = (select auth.uid())
      and access.app_id = curriculum_plan_templates.student_app_id
      and access.status = 'active'
  )
);

create policy "platform owner manages curriculum plan template items"
on public.curriculum_plan_template_items for all to authenticated
using ((select private.is_platform_owner()))
with check ((select private.is_platform_owner()));

create policy "tenant staff read published curriculum plan template items"
on public.curriculum_plan_template_items for select to authenticated
using (
  exists (
    select 1
    from public.curriculum_plan_templates as template
    join public.staff_app_assignments as access
      on access.app_id = template.student_app_id
     and access.tenant_id = (select private.current_tenant_id())
     and access.staff_id = (select auth.uid())
     and access.status = 'active'
    where template.id = curriculum_plan_template_items.template_id
      and template.status = 'published'
  )
);

create policy "assigned students read published curriculum plan template items"
on public.curriculum_plan_template_items for select to authenticated
using (
  exists (
    select 1
    from public.institution_curriculum_plans as plan
    join public.institution_curriculum_plan_students as assignment
      on assignment.plan_id = plan.id
     and assignment.student_id = (select auth.uid())
    where plan.template_id = curriculum_plan_template_items.template_id
      and plan.status in ('published', 'active', 'completed')
  )
);

create policy "tenant staff manage institution curriculum plans"
on public.institution_curriculum_plans for all to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select public.current_profile_role()) in ('teacher', 'admin', 'ceo', 'tenant_super_admin')
)
with check (
  tenant_id = (select private.current_tenant_id())
  and (select public.current_profile_role()) in ('teacher', 'admin', 'ceo', 'tenant_super_admin')
);

create policy "platform owner reads institution curriculum plans"
on public.institution_curriculum_plans for select to authenticated
using ((select private.is_platform_owner()));

create policy "assigned students read institution curriculum plans"
on public.institution_curriculum_plans for select to authenticated
using (
  status in ('published', 'active', 'completed')
  and exists (
    select 1 from public.institution_curriculum_plan_students as assignment
    where assignment.plan_id = institution_curriculum_plans.id
      and assignment.student_id = (select auth.uid())
  )
);

create policy "tenant staff manage institution curriculum plan students"
on public.institution_curriculum_plan_students for all to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select public.current_profile_role()) in ('teacher', 'admin', 'ceo', 'tenant_super_admin')
)
with check (
  tenant_id = (select private.current_tenant_id())
  and (select public.current_profile_role()) in ('teacher', 'admin', 'ceo', 'tenant_super_admin')
);

create policy "students read own curriculum plan assignment"
on public.institution_curriculum_plan_students for select to authenticated
using (student_id = (select auth.uid()));

create policy "platform owner reads curriculum plan assignments"
on public.institution_curriculum_plan_students for select to authenticated
using ((select private.is_platform_owner()));

revoke all on public.curriculum_plan_templates,
  public.curriculum_plan_template_items,
  public.institution_curriculum_plans,
  public.institution_curriculum_plan_students
from public, anon;

grant select, insert, update, delete on public.curriculum_plan_templates,
  public.curriculum_plan_template_items,
  public.institution_curriculum_plans,
  public.institution_curriculum_plan_students
to authenticated;

comment on table public.curriculum_plan_templates is
  '平台负责人维护并版本化发布的课程标准学习流程模板';
comment on table public.curriculum_plan_template_items is
  '模板内按相对天数和分钟编排的正式课程、六维练习、测试与考试';
comment on table public.institution_curriculum_plans is
  '机构采用平台模板后设置实际开课时间并发布的执行计划';
comment on table public.institution_curriculum_plan_students is
  '机构执行计划面向的学生；学生只读取本人已发布计划';

commit;
