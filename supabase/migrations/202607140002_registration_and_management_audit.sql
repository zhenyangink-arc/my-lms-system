-- ============================================================
-- 用户注册信息与后台管理审计
-- 目标：补全真实注册时间、资料维护时间，并自动记录账号与课程内容变更。
-- 所有变更均使用增量方式，不删除现有表、字段或业务数据。
-- ============================================================

-- 为账号资料补充可追踪的时间与来源字段。
alter table public.profiles
  add column if not exists registered_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists registration_source text not null default 'email',
  add column if not exists last_active_at timestamptz,
  add column if not exists profile_completed_at timestamptz;

-- 直接使用 Supabase Auth 的创建时间回填真实注册时间，避免资料行晚创建造成误差。
update public.profiles as profile
set registered_at = auth_user.created_at
from auth.users as auth_user
where profile.id = auth_user.id
  and profile.registered_at is null;

-- 为少量历史异常数据提供安全兜底，确保注册时间始终可用。
update public.profiles
set registered_at = coalesce(registered_at, created_at, now())
where registered_at is null;

-- 根据姓名完成度回填资料完成时间，不覆盖已经记录的时间。
update public.profiles
set profile_completed_at = coalesce(profile_completed_at, updated_at, registered_at)
where profile_completed_at is null
  and nullif(btrim(coalesce(full_name, '')), '') is not null;

-- 账号管理页会按注册时间、角色和状态统计，增加索引降低列表查询成本。
create index if not exists profiles_registered_at_idx
  on public.profiles (registered_at desc);

create index if not exists profiles_role_status_registered_at_idx
  on public.profiles (role, status, registered_at desc);

-- 统一维护资料更新时间，并在姓名首次填写完整时记录完成时间。
create or replace function public.set_profile_management_timestamps()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();

  if new.profile_completed_at is null
     and nullif(btrim(coalesce(new.full_name, '')), '') is not null then
    new.profile_completed_at := now();
  end if;

  return new;
end;
$$;

-- 重建同名触发器可以让迁移在测试环境重复执行时保持一致。
drop trigger if exists profiles_set_management_timestamps on public.profiles;
create trigger profiles_set_management_timestamps
before update on public.profiles
for each row
execute function public.set_profile_management_timestamps();

-- Auth 用户创建或资料更新后，将认证侧的真实信息同步到 profiles。
-- 这里只更新现有资料行，不替换项目原有的注册建档逻辑，避免破坏现有结构。
create or replace function public.sync_auth_registration_metadata()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update public.profiles
  set
    email = coalesce(new.email, profiles.email),
    full_name = coalesce(
      nullif(btrim(profiles.full_name), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), '')
    ),
    registered_at = coalesce(profiles.registered_at, new.created_at),
    registration_source = coalesce(
      nullif(new.raw_app_meta_data ->> 'provider', ''),
      profiles.registration_source,
      'email'
    )
  where profiles.id = new.id;

  return new;
end;
$$;

-- 使用靠后的触发器名称，使它在项目原有建档触发器之后执行。
drop trigger if exists z_sync_auth_registration_metadata on auth.users;
create trigger z_sync_auth_registration_metadata
after insert or update of email, raw_user_meta_data on auth.users
for each row
execute function public.sync_auth_registration_metadata();

-- 建立账号管理审计表，只保存管理所需字段，不复制敏感认证数据。
create table if not exists public.account_management_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  changed_fields text[] not null default '{}',
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now(),
  constraint account_management_audit_action_check
    check (action in ('account_created', 'role_changed', 'status_changed', 'profile_updated'))
);

-- 审计页会按目标账号和发生时间倒序读取。
create index if not exists account_audit_target_created_at_idx
  on public.account_management_audit_logs (target_user_id, created_at desc);

create index if not exists account_audit_actor_created_at_idx
  on public.account_management_audit_logs (actor_id, created_at desc);

-- 自动记录账号创建、角色变化、状态变化和重要资料变化。
create or replace function public.audit_profile_management_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  audit_action text;
  fields text[] := '{}';
begin
  if tg_op = 'INSERT' then
    audit_action := 'account_created';
    fields := array['created_at'];
  else
    if old.role is distinct from new.role then
      fields := array_append(fields, 'role');
    end if;

    if old.status is distinct from new.status then
      fields := array_append(fields, 'status');
    end if;

    if old.full_name is distinct from new.full_name then
      fields := array_append(fields, 'full_name');
    end if;

    if old.email is distinct from new.email then
      fields := array_append(fields, 'email');
    end if;

    if coalesce(array_length(fields, 1), 0) = 0 then
      return new;
    end if;

    if 'role' = any(fields) then
      audit_action := 'role_changed';
    elsif 'status' = any(fields) then
      audit_action := 'status_changed';
    else
      audit_action := 'profile_updated';
    end if;
  end if;

  insert into public.account_management_audit_logs (
    actor_id,
    target_user_id,
    action,
    changed_fields,
    before_data,
    after_data
  )
  values (
    auth.uid(),
    new.id,
    audit_action,
    fields,
    case when tg_op = 'INSERT' then null else jsonb_build_object(
      'full_name', old.full_name,
      'email', old.email,
      'role', old.role,
      'status', old.status
    ) end,
    jsonb_build_object(
      'full_name', new.full_name,
      'email', new.email,
      'role', new.role,
      'status', new.status
    )
  );

  return new;
end;
$$;

-- 审计触发器放在更新时间触发器之后，记录最终写入数据库的值。
drop trigger if exists profiles_audit_management_change on public.profiles;
create trigger profiles_audit_management_change
after insert or update on public.profiles
for each row
execute function public.audit_profile_management_change();

-- 建立课程内容审计表，覆盖课程、课时和课时资料的增删改。
create table if not exists public.course_content_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  operation text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now(),
  constraint course_content_audit_entity_check
    check (entity_type in ('course', 'lesson', 'lesson_resource')),
  constraint course_content_audit_operation_check
    check (operation in ('insert', 'update', 'delete'))
);

-- 课程审计主要按对象和时间检索。
create index if not exists course_content_audit_entity_created_at_idx
  on public.course_content_audit_logs (entity_type, entity_id, created_at desc);

create index if not exists course_content_audit_actor_created_at_idx
  on public.course_content_audit_logs (actor_id, created_at desc);

-- 通用课程审计函数通过触发器参数区分对象类型。
create or replace function public.audit_course_content_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_id uuid;
begin
  row_id := case when tg_op = 'DELETE' then old.id else new.id end;

  insert into public.course_content_audit_logs (
    actor_id,
    entity_type,
    entity_id,
    operation,
    before_data,
    after_data
  )
  values (
    auth.uid(),
    tg_argv[0],
    row_id,
    lower(tg_op),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- 对课程主表开启自动审计。
drop trigger if exists courses_audit_content_change on public.courses;
create trigger courses_audit_content_change
after insert or update or delete on public.courses
for each row
execute function public.audit_course_content_change('course');

-- 对课时主表开启自动审计。
drop trigger if exists lessons_audit_content_change on public.lessons;
create trigger lessons_audit_content_change
after insert or update or delete on public.lessons
for each row
execute function public.audit_course_content_change('lesson');

-- 对课时资料表开启自动审计。
drop trigger if exists lesson_resources_audit_content_change on public.lesson_resources;
create trigger lesson_resources_audit_content_change
after insert or update or delete on public.lesson_resources
for each row
execute function public.audit_course_content_change('lesson_resource');

-- 两类审计表都启用行级安全，浏览器端不能直接篡改审计记录。
alter table public.account_management_audit_logs enable row level security;
alter table public.course_content_audit_logs enable row level security;

-- 只有老板和 CEO 可以查看账号管理记录。
create policy "executives can read account audit logs"
on public.account_management_audit_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('ceo', 'super_admin')
  )
);

-- 管理员及以上角色可以查看课程内容变更记录。
create policy "admins can read course audit logs"
on public.course_content_audit_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
);

-- 仅开放审计表读取权限；写入由安全触发器完成，客户端无权改写或删除。
grant select on public.account_management_audit_logs to authenticated;
grant select on public.course_content_audit_logs to authenticated;
revoke insert, update, delete on public.account_management_audit_logs from authenticated;
revoke insert, update, delete on public.course_content_audit_logs from authenticated;

