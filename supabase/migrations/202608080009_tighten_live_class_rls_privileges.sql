-- ============================================================
-- 收紧公共课堂 RLS 与对象权限：
-- 1. 删除遗留的可传任意 user_id 的 SECURITY DEFINER 函数；
-- 2. 辅助函数绑定 auth.uid() + 当前租户，并禁止 anon 调用；
-- 3. 撤销 anon 的课堂表权限以及 authenticated 的 TRUNCATE 等越权权限；
-- 4. 事件读取补回 tenant_id 边界；
-- 5. 成员写入在数据库层强制学生属于发起老师的负责名单。
-- ============================================================

begin;

drop function if exists public.is_live_class_participant(uuid, uuid);
drop function if exists public.is_live_class_teacher(uuid, uuid);

create or replace function public.is_live_class_participant(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.live_class_sessions as s
    where s.id = p_session_id
      and s.tenant_id = private.current_tenant_id()
      and (
        s.teacher_id = (select auth.uid())
        or s.student_id = (select auth.uid())
        or exists (
          select 1
          from public.live_class_members as m
          where m.session_id = s.id
            and m.student_id = (select auth.uid())
            and m.left_at is null
        )
      )
  );
$$;

create or replace function public.is_live_class_teacher(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.live_class_sessions as s
    where s.id = p_session_id
      and s.tenant_id = private.current_tenant_id()
      and s.teacher_id = (select auth.uid())
  );
$$;

revoke all on function public.is_live_class_participant(uuid) from public, anon;
revoke all on function public.is_live_class_teacher(uuid) from public, anon;
grant execute on function public.is_live_class_participant(uuid) to authenticated, service_role;
grant execute on function public.is_live_class_teacher(uuid) to authenticated, service_role;

-- Supabase 默认表授权包含 TRUNCATE；TRUNCATE 不经过 RLS，必须显式撤销。
revoke all on table public.live_class_sessions from anon;
revoke all on table public.live_class_members from anon;
revoke all on table public.live_class_events from anon;

revoke all on table public.live_class_sessions from authenticated;
revoke all on table public.live_class_members from authenticated;
revoke all on table public.live_class_events from authenticated;

grant select, insert, update, delete on table public.live_class_sessions to authenticated;
grant select, insert, update, delete on table public.live_class_members to authenticated;
grant select, insert on table public.live_class_events to authenticated;

-- 读取事件必须同时处于当前租户且是仍在场的参与者。
drop policy if exists "participants read own session events" on public.live_class_events;
create policy "participants read own session events"
on public.live_class_events for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and public.is_live_class_participant(session_id)
);

-- 学生只能读取当前租户内自己的成员行；离开记录仍可读取，但不再赋予课堂权限。
drop policy if exists "student reads own membership rows" on public.live_class_members;
create policy "student reads own membership rows"
on public.live_class_members for select to authenticated
using (
  student_id = (select auth.uid())
  and exists (
    select 1
    from public.live_class_sessions as s
    where s.id = session_id
      and s.tenant_id = (select private.current_tenant_id())
  )
);

create or replace function public.validate_live_class_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_tenant uuid;
  v_session_teacher uuid;
  v_session_mode text;
  v_student_role text;
  v_is_assigned boolean;
begin
  select s.tenant_id, s.teacher_id, s.mode
  into v_session_tenant, v_session_teacher, v_session_mode
  from public.live_class_sessions as s
  where s.id = new.session_id;

  if v_session_tenant is null then
    raise exception '课堂不存在。';
  end if;

  if v_session_mode <> 'group' then
    raise exception '只有公共课堂可以写入成员表。';
  end if;

  select membership.role into v_student_role
  from public.tenant_memberships as membership
  where membership.tenant_id = v_session_tenant
    and membership.user_id = new.student_id
    and membership.status = 'active';

  if v_student_role is null or v_student_role <> 'student' then
    raise exception '目标学生不在本机构或不是有效学生角色。';
  end if;

  -- 已有成员仅更新 joined_at/left_at 时允许正常离场，即使负责关系后来被解除。
  if tg_op = 'INSERT'
     or old.session_id is distinct from new.session_id
     or old.student_id is distinct from new.student_id then
    select exists (
      select 1
      from public.tenant_student_assignments as assignment
      where assignment.tenant_id = v_session_tenant
        and assignment.teacher_id = v_session_teacher
        and assignment.student_id = new.student_id
    ) into v_is_assigned;

    if not v_is_assigned then
      raise exception '该学生不在课堂老师的负责名单中。';
    end if;
  end if;

  return new;
end;
$$;

commit;
