-- ============================================================
-- 1 对多公共课堂：数据模型 + RLS（向后兼容，不删 student_id）
--
-- 1. live_class_sessions 新增 mode（'one_on_one' | 'group'），历史数据标 one_on_one
-- 2. 新增 live_class_members 成员表（group 模式的 N 个学生，left_at 记录在场）
-- 3. validate_live_class_session 适配 group（student_id 置空，成员校验走成员表）
-- 4. RLS 扩展：sessions / events / realtime.messages 的参与者判断加入成员表
-- ============================================================

begin;

-- ========== 1. live_class_sessions 增加 mode ==========
alter table public.live_class_sessions
  add column if not exists mode text not null default 'one_on_one'
  check (mode in ('one_on_one', 'group'));

-- 历史数据全部标 one_on_one（default 已覆盖，显式执行一次保证一致）
update public.live_class_sessions set mode = 'one_on_one' where mode is null;

-- ========== 2. 课堂校验 trigger 适配 group 模式 ==========
create or replace function public.validate_live_class_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher_role text;
  v_student_role text;
  v_is_assigned boolean;
begin
  select membership.role into v_teacher_role
  from public.tenant_memberships as membership
  where membership.tenant_id = new.tenant_id
    and membership.user_id = new.teacher_id;

  if v_teacher_role is null or v_teacher_role <> 'teacher' then
    raise exception '发起老师不在本机构或不是老师角色。';
  end if;

  if new.mode = 'group' then
    -- 公共课堂：学生成员关系全部走 live_class_members（由 validate_live_class_member 校验）
    if new.student_id is not null then
      raise exception '公共课堂不应指定单一 student_id。';
    end if;
    return new;
  end if;

  -- one_on_one：沿用原逻辑（学生必须是被该老师负责的机构学生）
  select membership.role into v_student_role
  from public.tenant_memberships as membership
  where membership.tenant_id = new.tenant_id
    and membership.user_id = new.student_id;

  if v_student_role is null or v_student_role <> 'student' then
    raise exception '目标学生不在本机构或不是学生角色。';
  end if;

  select exists (
    select 1 from public.tenant_student_assignments as assignment
    where assignment.tenant_id = new.tenant_id
      and assignment.teacher_id = new.teacher_id
      and assignment.student_id = new.student_id
  ) into v_is_assigned;

  if not v_is_assigned then
    raise exception '该学生不是这位老师负责的学生。';
  end if;

  return new;
end;
$$;

-- ========== 3. 成员表 ==========
create table if not exists public.live_class_members (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.live_class_sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (session_id, student_id)
);

comment on table public.live_class_members is '公共课堂（mode=group）的成员关系：一个课堂多个学生，left_at 非空表示已离开';
comment on column public.live_class_members.left_at is '离开时间；null = 当前在场';

create index if not exists live_class_members_session_idx
  on public.live_class_members (session_id);
create index if not exists live_class_members_student_idx
  on public.live_class_members (student_id);

-- 成员校验：学生必须是该课堂所属机构的 student 角色成员
create or replace function public.validate_live_class_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_tenant uuid;
  v_student_role text;
begin
  select s.tenant_id into v_session_tenant
  from public.live_class_sessions as s
  where s.id = new.session_id;
  if v_session_tenant is null then
    raise exception '课堂不存在。';
  end if;

  select membership.role into v_student_role
  from public.tenant_memberships as membership
  where membership.tenant_id = v_session_tenant
    and membership.user_id = new.student_id;
  if v_student_role is null or v_student_role <> 'student' then
    raise exception '目标学生不在本机构或不是学生角色。';
  end if;

  return new;
end;
$$;

create trigger live_class_members_validate_trigger
before insert or update on public.live_class_members
for each row execute function public.validate_live_class_member();

alter table public.live_class_members enable row level security;

-- 老师：对自己课堂的成员表全权限
create policy "teacher manages own session members"
on public.live_class_members for all to authenticated
using (
  exists (
    select 1 from public.live_class_sessions as s
    where s.id = session_id
      and s.tenant_id = (select private.current_tenant_id())
      and s.teacher_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.live_class_sessions as s
    where s.id = session_id
      and s.tenant_id = (select private.current_tenant_id())
      and s.teacher_id = (select auth.uid())
  )
);

-- 学生：只读自己所在的成员行
create policy "student reads own membership rows"
on public.live_class_members for select to authenticated
using (student_id = (select auth.uid()));

-- ========== 4. live_class_sessions 学生读扩展（group 成员） ==========
drop policy if exists "students read own live class sessions" on public.live_class_sessions;
create policy "students read own live class sessions"
on public.live_class_sessions for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (
    student_id = (select auth.uid())
    or exists (
      select 1 from public.live_class_members as m
      where m.session_id = live_class_sessions.id
        and m.student_id = (select auth.uid())
    )
  )
);

-- ========== 5. live_class_events RLS 扩展 ==========
drop policy if exists "participants read own session events" on public.live_class_events;
create policy "participants read own session events"
on public.live_class_events for select to authenticated
using (
  exists (
    select 1 from public.live_class_sessions as s
    where s.id = session_id
      and s.tenant_id = (select private.current_tenant_id())
      and (
        s.teacher_id = (select auth.uid())
        or s.student_id = (select auth.uid())
        or exists (
          select 1 from public.live_class_members as m
          where m.session_id = s.id
            and m.student_id = (select auth.uid())
            and m.left_at is null
        )
      )
  )
);

drop policy if exists "participants insert own events with role-scoped kinds" on public.live_class_events;
create policy "participants insert own events with role-scoped kinds"
on public.live_class_events for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and tenant_id = (select private.current_tenant_id())
  and exists (
    select 1 from public.live_class_sessions as s
    where s.id = session_id
      and s.tenant_id = (select private.current_tenant_id())
      and (
        s.teacher_id = (select auth.uid())
        or s.student_id = (select auth.uid())
        or exists (
          select 1 from public.live_class_members as m
          where m.session_id = s.id
            and m.student_id = (select auth.uid())
            and m.left_at is null
        )
      )
  )
  and (
    exists (
      select 1 from public.live_class_sessions as s
      where s.id = session_id and s.teacher_id = (select auth.uid())
    )
    or kind in ('rtc-answer', 'rtc-ice', 'rtc-hangup')
  )
);

-- ========== 6. realtime.messages 频道授权扩展（在场成员可收发） ==========
drop policy if exists "live class participants read channel" on realtime.messages;
create policy "live class participants read channel"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension in ('broadcast', 'presence')
  and exists (
    select 1
    from public.live_class_sessions as s
    where s.tenant_id = (select private.current_tenant_id())
      and (
        s.teacher_id = (select auth.uid())
        or s.student_id = (select auth.uid())
        or exists (
          select 1 from public.live_class_members as m
          where m.session_id = s.id
            and m.student_id = (select auth.uid())
            and m.left_at is null
        )
      )
      and (select realtime.topic()) = 'live-class:' || s.id::text
  )
);

drop policy if exists "live class participants write channel" on realtime.messages;
create policy "live class participants write channel"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension in ('broadcast', 'presence')
  and exists (
    select 1
    from public.live_class_sessions as s
    where s.tenant_id = (select private.current_tenant_id())
      and (
        s.teacher_id = (select auth.uid())
        or s.student_id = (select auth.uid())
        or exists (
          select 1 from public.live_class_members as m
          where m.session_id = s.id
            and m.student_id = (select auth.uid())
            and m.left_at is null
        )
      )
      and (select realtime.topic()) = 'live-class:' || s.id::text
  )
);

commit;
