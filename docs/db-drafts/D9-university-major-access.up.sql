-- D9：大学课程的“专业可见范围”（草稿，见 docs/university-major-structure-design.md）
-- 产品决定（2026-10-01）：大学课程按专业区分；有跨专业公共课；学生只看自己专业；大学英语、大学数学留在各自应用。
-- 设计：专业 = 大学课程下的二级分类，课程仍只属于一个分类（不改 courses / lessons / 任何共用策略）。
--   公共课放进“公共课组”（同样是二级分类），用可见模式决定谁能看到：
--     major  仅选了该专业的学生可见（默认，没有记录就按此处理）
--     shared 选了任一关联专业的学生可见（如“理工公共课”关联计算机、软件工程）
--     public 所有学生可见（如“通识课”）
-- 1) university_category_access / university_category_major_links：分类可见模式与关联专业（平台级，仅经 RPC 写入）
-- 2) student_major_enrollments：学生所属专业（机构级，仅经 RPC 写入；可多个，如主修 + 辅修）
-- 3) university_category_scope()：当前用户在大学课程中可见的二级分类（学生受限，教职人员与平台账号不受限）
-- 4) set_university_category_access() / set_student_major_enrollment()：带权限校验的写入口
-- 限制：可见范围由应用层按 university_category_scope() 过滤并在路由层拦截，没有改 courses / lessons 的读取策略；
--       同机构成员直接用客户端读取平台课程表仍然可行（与改动前一致，内容不属于保密数据）。是否需要下沉到 RLS，由 Gate 决定。
begin;

create function private.university_app_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.student_apps where slug = 'university';
$$;
revoke all on function private.university_app_id() from public, anon;
grant execute on function private.university_app_id() to authenticated, service_role;

create table public.university_category_access (
  category_id uuid primary key references public.course_categories(id) on delete cascade,
  mode text not null check (mode in ('major', 'shared', 'public')),
  updated_at timestamptz not null default now()
);

create table public.university_category_major_links (
  category_id uuid not null references public.university_category_access(category_id) on delete cascade,
  major_category_id uuid not null references public.course_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (category_id, major_category_id),
  check (category_id <> major_category_id)
);
create index university_category_major_links_major_idx on public.university_category_major_links (major_category_id);

create table public.student_major_enrollments (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.course_categories(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'cancelled')),
  enrolled_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, student_id, category_id)
);
create index student_major_enrollments_category_idx on public.student_major_enrollments (category_id, status);

-- 分类必须是大学课程应用下的二级分类
create function private.university_second_level_category(p_category_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.course_categories c
    where c.id = p_category_id and c.parent_id is not null and c.student_app_id = private.university_app_id()
  );
$$;
-- 分类的有效可见模式：没有记录按 major 处理
create function private.university_category_mode(p_category_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select a.mode from public.university_category_access a where a.category_id = p_category_id), 'major');
$$;
revoke all on function private.university_second_level_category(uuid), private.university_category_mode(uuid) from public, anon;
grant execute on function private.university_second_level_category(uuid), private.university_category_mode(uuid) to authenticated, service_role;

create function private.check_university_category_access()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.university_second_level_category(new.category_id) then
    raise exception '只能为大学课程下的二级分类设置可见模式' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.mode is distinct from old.mode and old.mode = 'major' then
    if exists (select 1 from public.student_major_enrollments e where e.category_id = new.category_id)
       or exists (select 1 from public.university_category_major_links l where l.major_category_id = new.category_id) then
      raise exception '该专业已有学生或公共课组关联，不能改成其他可见模式' using errcode = '23514';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger university_category_access_check before insert or update on public.university_category_access
  for each row execute function private.check_university_category_access();

-- 改成非 shared 时，该分类的关联专业一并清除
create function private.clear_links_when_not_shared()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.mode <> 'shared' then
    delete from public.university_category_major_links where category_id = new.category_id;
  end if;
  return null;
end $$;
create trigger university_category_access_clear_links after insert or update of mode on public.university_category_access
  for each row execute function private.clear_links_when_not_shared();

create function private.check_university_major_link()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.university_category_mode(new.category_id) <> 'shared' then
    raise exception '只有“选了任一关联专业可见”的公共课组才能关联专业' using errcode = '23514';
  end if;
  if not private.university_second_level_category(new.major_category_id)
     or private.university_category_mode(new.major_category_id) <> 'major' then
    raise exception '关联的必须是大学课程下的专业' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger university_major_link_check before insert or update on public.university_category_major_links
  for each row execute function private.check_university_major_link();

create function private.check_student_major_enrollment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.university_second_level_category(new.category_id)
     or private.university_category_mode(new.category_id) <> 'major' then
    raise exception '只能选择大学课程下的专业' using errcode = '23514';
  end if;
  if not exists (
    select 1
    from public.tenant_memberships m
    join public.student_app_enrollments ae on ae.tenant_id = m.tenant_id and ae.student_id = m.user_id
    where m.tenant_id = new.tenant_id and m.user_id = new.student_id and m.role = 'student'
      and ae.app_id = private.university_app_id()
  ) then
    raise exception '该学生不是本机构大学课程应用的学生' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger student_major_enrollment_check before insert or update on public.student_major_enrollments
  for each row execute function private.check_student_major_enrollment();

-- RLS：读取开放（学生只能读自己的专业记录）；写入只经下面的 RPC（authenticated 没有写权限）
alter table public.university_category_access enable row level security;
alter table public.university_category_major_links enable row level security;
alter table public.student_major_enrollments enable row level security;

create policy "read access modes of visible categories" on public.university_category_access
  for select to authenticated
  using (exists (select 1 from public.course_categories c where c.id = category_id));
create policy "read links of visible categories" on public.university_category_major_links
  for select to authenticated
  using (exists (select 1 from public.course_categories c where c.id = category_id));
create policy "students read own major enrollments" on public.student_major_enrollments
  for select to authenticated
  using (tenant_id = (select private.current_tenant_id()) and student_id = (select auth.uid()));
create policy "application staff read major enrollments" on public.student_major_enrollments
  for select to authenticated
  using (
    private.current_user_has_app_capability(tenant_id, private.university_app_id(), 'manage_students')
    or private.current_user_has_app_capability(tenant_id, private.university_app_id(), 'view_analytics')
  );

revoke all on public.university_category_access, public.university_category_major_links, public.student_major_enrollments from anon, authenticated;
grant select on public.university_category_access, public.university_category_major_links, public.student_major_enrollments to authenticated;
grant select, insert, update, delete on public.university_category_access, public.university_category_major_links, public.student_major_enrollments to service_role;

-- 当前用户在大学课程中可见的二级分类。
--   restricted = false：不受限（教职人员、平台账号），category_ids 为空；
--   restricted = true ：学生，只能看 category_ids 中的二级分类（没有选专业时只剩 public 的公共课组）。
create function public.university_category_scope()
returns table (restricted boolean, category_ids uuid[])
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_tenant uuid := private.current_tenant_id();
begin
  if v_user is null then
    return query select true, '{}'::uuid[];
    return;
  end if;
  if not exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = v_tenant and m.user_id = v_user and m.role = 'student' and m.status = 'active'
  ) then
    return query select false, '{}'::uuid[];
    return;
  end if;
  return query
  with mine as (
    select e.category_id from public.student_major_enrollments e
    where e.tenant_id = v_tenant and e.student_id = v_user and e.status = 'active'
  )
  select true, coalesce(array(
    select c.id
    from public.course_categories c
    left join public.university_category_access a on a.category_id = c.id
    where c.student_app_id = private.university_app_id() and c.parent_id is not null
      and (
        (coalesce(a.mode, 'major') = 'major' and c.id in (select category_id from mine))
        or a.mode = 'public'
        or (a.mode = 'shared' and exists (
          select 1 from public.university_category_major_links l
          where l.category_id = c.id and l.major_category_id in (select category_id from mine)
        ))
      )
  ), '{}'::uuid[]);
end $$;
revoke all on function public.university_category_scope() from public, anon;
grant execute on function public.university_category_scope() to authenticated;

-- 平台负责人 / 平台管理员设置分类的可见模式与关联专业（一个事务内整体替换关联）
create function public.set_university_category_access(p_category_id uuid, p_mode text, p_major_ids uuid[] default '{}')
returns void language plpgsql security definer set search_path = '' as $$
declare v_major uuid;
begin
  if not private.is_platform_course_manager() then
    raise exception '只有平台负责人或平台管理员可以设置专业可见范围' using errcode = '42501';
  end if;
  if p_mode not in ('major', 'shared', 'public') then
    raise exception '可见模式无效' using errcode = '22023';
  end if;
  if p_mode <> 'shared' and coalesce(array_length(p_major_ids, 1), 0) > 0 then
    raise exception '只有 shared 模式可以关联专业' using errcode = '22023';
  end if;
  insert into public.university_category_access (category_id, mode) values (p_category_id, p_mode)
  on conflict (category_id) do update set mode = excluded.mode;
  delete from public.university_category_major_links where category_id = p_category_id;
  if p_mode = 'shared' then
    foreach v_major in array coalesce(p_major_ids, '{}') loop
      insert into public.university_category_major_links (category_id, major_category_id) values (p_category_id, v_major)
      on conflict do nothing;
    end loop;
  end if;
end $$;
revoke all on function public.set_university_category_access(uuid, text, uuid[]) from public, anon;
grant execute on function public.set_university_category_access(uuid, text, uuid[]) to authenticated;

-- 机构里有“管理学生”能力的账号设置学生所属专业；p_status = 'cancelled' 等同取消
create function public.set_student_major_enrollment(p_student_id uuid, p_category_id uuid, p_status text default 'active')
returns void language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid := private.current_tenant_id();
begin
  if v_tenant is null or not private.current_user_has_app_capability(v_tenant, private.university_app_id(), 'manage_students') then
    raise exception '没有管理大学课程学生的权限' using errcode = '42501';
  end if;
  insert into public.student_major_enrollments (tenant_id, student_id, category_id, status, enrolled_by)
  values (v_tenant, p_student_id, p_category_id, p_status, (select auth.uid()))
  on conflict (tenant_id, student_id, category_id) do update set status = excluded.status;
end $$;
revoke all on function public.set_student_major_enrollment(uuid, uuid, text) from public, anon;
grant execute on function public.set_student_major_enrollment(uuid, uuid, text) to authenticated;

commit;
