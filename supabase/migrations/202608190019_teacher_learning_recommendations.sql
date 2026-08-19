begin;

create table public.teacher_learning_recommendations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants(id) on delete cascade,
  student_app_id uuid not null
    references public.student_apps(id) on delete restrict,
  teacher_id uuid not null
    references public.profiles(id) on delete restrict,
  target_scope text not null check (target_scope in ('class', 'student')),
  class_id uuid references public.live_class_sessions(id) on delete restrict,
  student_id uuid references public.profiles(id) on delete restrict,
  source_type text not null check (
    source_type in ('course', 'chapter_practice', 'specialized_practice', 'review')
  ),
  source_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  reason text not null check (char_length(btrim(reason)) between 1 and 2000),
  is_required boolean not null default false,
  starts_at timestamptz not null default now(),
  due_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_learning_recommendations_target_check check (
    (
      target_scope = 'class'
      and class_id is not null
      and student_id is null
    )
    or (
      target_scope = 'student'
      and student_id is not null
      and class_id is null
    )
  ),
  constraint teacher_learning_recommendations_time_check
    check (due_at > starts_at)
);

create index teacher_learning_recommendations_teacher_idx
  on public.teacher_learning_recommendations (
    tenant_id, teacher_id, student_app_id, status, starts_at desc
  );
create index teacher_learning_recommendations_student_idx
  on public.teacher_learning_recommendations (
    tenant_id, student_id, student_app_id, status, due_at
  ) where student_id is not null;
create index teacher_learning_recommendations_class_idx
  on public.teacher_learning_recommendations (
    tenant_id, class_id, student_app_id, status, due_at
  ) where class_id is not null;

-- source_id 是跨四张业务表的多态引用，普通 CHECK 不能跨表查询。
-- 触发器在写入时解析真实应用归属，并同时校验老师、目标和租户关系。
create or replace function private.validate_teacher_learning_recommendation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_app_id uuid;
  v_source_tenant_id uuid;
  v_source_student_id uuid;
begin
  if tg_op = 'UPDATE' then
    if new.tenant_id is distinct from old.tenant_id
      or new.student_app_id is distinct from old.student_app_id
      or new.teacher_id is distinct from old.teacher_id
      or new.target_scope is distinct from old.target_scope
      or new.class_id is distinct from old.class_id
      or new.student_id is distinct from old.student_id
      or new.source_type is distinct from old.source_type
      or new.source_id is distinct from old.source_id
      or new.title is distinct from old.title
      or new.reason is distinct from old.reason
      or new.is_required is distinct from old.is_required
      or new.starts_at is distinct from old.starts_at
      or new.due_at is distinct from old.due_at
      or old.status <> 'active'
      or new.status <> 'withdrawn' then
      raise exception '推荐创建后只能撤回，不能改写推荐内容或目标';
    end if;
    if old.starts_at <= statement_timestamp() then
      raise exception '已经开始的推荐不能撤回';
    end if;
  elsif new.status <> 'active' then
    raise exception '新推荐必须处于 active 状态';
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    join public.tenant_memberships as membership
      on membership.user_id = profile.id
     and membership.tenant_id = new.tenant_id
    join public.staff_app_assignments as staff_access
      on staff_access.tenant_id = membership.tenant_id
     and staff_access.staff_id = membership.user_id
     and staff_access.app_id = new.student_app_id
    join public.tenant_student_apps as tenant_app
      on tenant_app.tenant_id = membership.tenant_id
     and tenant_app.app_id = staff_access.app_id
    where profile.id = new.teacher_id
      and coalesce(profile.status, 'active') = 'active'
      and membership.role = 'teacher'
      and membership.status = 'active'
      and staff_access.status = 'active'
      and staff_access.access_role in ('teacher', 'operator', 'administrator')
      and tenant_app.is_enabled
      and tenant_app.status = 'active'
  ) then
    raise exception '推荐老师没有当前机构应用的有效教学权限';
  end if;

  if new.target_scope = 'student' then
    if not exists (
      select 1
      from public.tenant_student_assignments as assignment
      join public.student_app_enrollments as enrollment
        on enrollment.tenant_id = assignment.tenant_id
       and enrollment.student_id = assignment.student_id
       and enrollment.app_id = assignment.student_app_id
      where assignment.tenant_id = new.tenant_id
        and assignment.teacher_id = new.teacher_id
        and assignment.student_id = new.student_id
        and assignment.student_app_id = new.student_app_id
        and enrollment.status = 'active'
        and enrollment.starts_at <= statement_timestamp()
        and (
          enrollment.ends_at is null
          or enrollment.ends_at > statement_timestamp()
        )
    ) then
      raise exception '目标学生不在老师当前应用的负责范围内';
    end if;
  elsif not exists (
    select 1
    from public.live_class_sessions as class
    join public.courses as course on course.id = class.course_id
    where class.id = new.class_id
      and class.tenant_id = new.tenant_id
      and class.teacher_id = new.teacher_id
      and class.mode = 'group'
      and course.student_app_id = new.student_app_id
  ) then
    raise exception '目标班级不属于老师或不属于当前应用';
  end if;

  if new.source_type = 'course' then
    select course.student_app_id, course.tenant_id
    into v_source_app_id, v_source_tenant_id
    from public.course_chapters as chapter
    join public.lessons as lesson on lesson.id = chapter.lesson_id
    join public.courses as course on course.id = lesson.course_id
    where chapter.id = new.source_id
      and chapter.is_published
      and lesson.is_published
      and course.is_published;
  elsif new.source_type = 'chapter_practice' then
    select unit.student_app_id, course.tenant_id
    into v_source_app_id, v_source_tenant_id
    from public.chapter_practice_units as unit
    join public.course_chapters as chapter on chapter.id = unit.course_chapter_id
    join public.lessons as lesson on lesson.id = chapter.lesson_id
    join public.courses as course on course.id = lesson.course_id
    where unit.id = new.source_id
      and unit.status = 'published';
  elsif new.source_type = 'specialized_practice' then
    select exercise.student_app_id, exercise.tenant_id
    into v_source_app_id, v_source_tenant_id
    from public.growth_toolbox_exercises as exercise
    where exercise.id = new.source_id
      and exercise.status = 'published';
  else
    select review.student_app_id, review.tenant_id, review.student_id
    into v_source_app_id, v_source_tenant_id, v_source_student_id
    from public.student_review_items as review
    where review.id = new.source_id;

    if new.target_scope <> 'student'
      or v_source_student_id is distinct from new.student_id then
      raise exception '错题推荐只能指向该错题所属学生';
    end if;
  end if;

  if v_source_app_id is null then
    raise exception '推荐来源不存在、未发布或缺少应用归属';
  end if;
  if v_source_app_id is distinct from new.student_app_id then
    raise exception '推荐来源与 student_app_id 不属于同一应用';
  end if;
  if v_source_tenant_id is not null
    and v_source_tenant_id is distinct from new.tenant_id then
    raise exception '推荐来源不属于当前机构';
  end if;

  return new;
end;
$$;

create trigger teacher_learning_recommendations_validate
before insert or update on public.teacher_learning_recommendations
for each row execute function private.validate_teacher_learning_recommendation();

drop trigger if exists teacher_learning_recommendations_set_updated_at
  on public.teacher_learning_recommendations;
create trigger teacher_learning_recommendations_set_updated_at
before update on public.teacher_learning_recommendations
for each row execute function private.set_updated_at();

-- 个人目标复用既有应用级师生授权；班级目标以现有 group 直播课堂作为
-- 唯一真实班级实体，并以 session.teacher_id 表示负责老师。
create or replace function private.current_teacher_can_manage_learning_recommendation(
  p_tenant_id uuid,
  p_teacher_id uuid,
  p_student_app_id uuid,
  p_target_scope text,
  p_class_id uuid,
  p_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_teacher_id = (select auth.uid())
    and p_tenant_id = private.current_tenant_id()
    and private.current_staff_has_app_capability(
      p_tenant_id, p_student_app_id, 'view_analytics'
    )
    and (
      (
        p_target_scope = 'student'
        and p_class_id is null
        and private.current_teacher_has_student_app_access(
          p_tenant_id, p_student_id, p_student_app_id
        )
      )
      or (
        p_target_scope = 'class'
        and p_student_id is null
        and exists (
          select 1
          from public.live_class_sessions as class
          join public.courses as course on course.id = class.course_id
          where class.id = p_class_id
            and class.tenant_id = p_tenant_id
            and class.teacher_id = (select auth.uid())
            and class.mode = 'group'
            and course.student_app_id = p_student_app_id
        )
      )
    );
$$;

create or replace function private.current_student_can_read_learning_recommendation(
  p_tenant_id uuid,
  p_student_app_id uuid,
  p_target_scope text,
  p_class_id uuid,
  p_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.current_student_has_app_access(
      p_tenant_id, (select auth.uid()), p_student_app_id
    )
    and (
      (
        p_target_scope = 'student'
        and p_class_id is null
        and p_student_id = (select auth.uid())
      )
      or (
        p_target_scope = 'class'
        and p_student_id is null
        and exists (
          select 1
          from public.live_class_sessions as class
          join public.live_class_members as member on member.session_id = class.id
          join public.courses as course on course.id = class.course_id
          where class.id = p_class_id
            and class.tenant_id = p_tenant_id
            and class.mode = 'group'
            and member.student_id = (select auth.uid())
            and course.student_app_id = p_student_app_id
        )
      )
    );
$$;

revoke all on function private.current_teacher_can_manage_learning_recommendation(
  uuid, uuid, uuid, text, uuid, uuid
) from public;
revoke all on function private.current_student_can_read_learning_recommendation(
  uuid, uuid, text, uuid, uuid
) from public;
grant execute on function private.current_teacher_can_manage_learning_recommendation(
  uuid, uuid, uuid, text, uuid, uuid
) to authenticated, service_role;
grant execute on function private.current_student_can_read_learning_recommendation(
  uuid, uuid, text, uuid, uuid
) to authenticated, service_role;

alter table public.teacher_learning_recommendations enable row level security;

create policy "teachers read own scoped learning recommendations"
on public.teacher_learning_recommendations for select to authenticated
using (
  private.current_teacher_can_manage_learning_recommendation(
    tenant_id, teacher_id, student_app_id,
    target_scope, class_id, student_id
  )
);

create policy "students read targeted learning recommendations"
on public.teacher_learning_recommendations for select to authenticated
using (
  private.current_student_can_read_learning_recommendation(
    tenant_id, student_app_id, target_scope, class_id, student_id
  )
);

create policy "teachers create scoped learning recommendations"
on public.teacher_learning_recommendations for insert to authenticated
with check (
  status = 'active'
  and private.current_teacher_can_manage_learning_recommendation(
    tenant_id, teacher_id, student_app_id,
    target_scope, class_id, student_id
  )
);

create policy "teachers withdraw unstarted learning recommendations"
on public.teacher_learning_recommendations for update to authenticated
using (
  status = 'active'
  and starts_at > statement_timestamp()
  and private.current_teacher_can_manage_learning_recommendation(
    tenant_id, teacher_id, student_app_id,
    target_scope, class_id, student_id
  )
)
with check (
  status = 'withdrawn'
  and private.current_teacher_can_manage_learning_recommendation(
    tenant_id, teacher_id, student_app_id,
    target_scope, class_id, student_id
  )
);

-- 推荐是审计事实：authenticated 完全不获得 DELETE 权限，也没有 DELETE policy。
-- 撤回通过受限状态转换完成，因此已开始的必做推荐（以及其他推荐）都不能物理删除。
revoke all on public.teacher_learning_recommendations
  from public, anon, authenticated;
grant select, insert, update on public.teacher_learning_recommendations
  to authenticated;
grant all on public.teacher_learning_recommendations to service_role;

comment on table public.teacher_learning_recommendations is
  '老师面向负责学生或 group 课堂发布的应用内学习推荐；仅允许未开始前撤回，不允许 authenticated 物理删除';
comment on column public.teacher_learning_recommendations.class_id is
  '班级目标复用 live_class_sessions 中 mode=group 且由 teacher_id 负责的真实群组课堂';
comment on column public.teacher_learning_recommendations.source_id is
  '按 source_type 指向课程章节、章节巩固单元、专项训练或学生错题记录，由触发器校验应用归属';

commit;
