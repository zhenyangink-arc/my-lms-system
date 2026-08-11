-- ============================================================
-- 修复 010 的 RLS 无限递归：security definer 工具函数 + policy 重建
--
-- 递归链：sessions policy 查 members → members teacher policy 查 sessions → ...
-- 解法：参与者/老师判断封装为 security definer 函数（函数内查询以 owner
-- 权限执行、不触发 RLS），所有 policy 只调用函数，切断递归。
-- ============================================================

begin;

-- ========== 1. 工具函数 ==========
-- 用户是否是课堂参与者：老师 / 单学生(one_on_one) / 在场成员(group)
create or replace function public.is_live_class_participant(
  p_session_id uuid,
  p_user_id uuid
)
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
      and (
        s.teacher_id = p_user_id
        or s.student_id = p_user_id
        or exists (
          select 1 from public.live_class_members as m
          where m.session_id = s.id
            and m.student_id = p_user_id
            and m.left_at is null
        )
      )
  );
$$;

-- 用户是否是课堂发起老师
create or replace function public.is_live_class_teacher(
  p_session_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.live_class_sessions as s
    where s.id = p_session_id and s.teacher_id = p_user_id
  );
$$;

-- ========== 2. live_class_sessions：学生读扩展 ==========
drop policy if exists "students read own live class sessions" on public.live_class_sessions;
create policy "students read own live class sessions"
on public.live_class_sessions for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and public.is_live_class_participant(id, (select auth.uid()))
);

-- ========== 3. live_class_members：老师 policy 简化（函数，不查表递归） ==========
drop policy if exists "teacher manages own session members" on public.live_class_members;
create policy "teacher manages own session members"
on public.live_class_members for all to authenticated
using (public.is_live_class_teacher(session_id, (select auth.uid())))
with check (public.is_live_class_teacher(session_id, (select auth.uid())));

-- ========== 4. live_class_events：参与者判断换函数 ==========
drop policy if exists "participants read own session events" on public.live_class_events;
create policy "participants read own session events"
on public.live_class_events for select to authenticated
using (
  public.is_live_class_participant(session_id, (select auth.uid()))
);

drop policy if exists "participants insert own events with role-scoped kinds" on public.live_class_events;
create policy "participants insert own events with role-scoped kinds"
on public.live_class_events for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and tenant_id = (select private.current_tenant_id())
  and public.is_live_class_participant(session_id, (select auth.uid()))
  and (
    public.is_live_class_teacher(session_id, (select auth.uid()))
    or kind in ('rtc-answer', 'rtc-ice', 'rtc-hangup')
  )
);

-- ========== 5. realtime.messages：频道授权换函数 ==========
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
      and 'live-class:' || s.id::text = (select realtime.topic())
      and public.is_live_class_participant(s.id, (select auth.uid()))
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
      and 'live-class:' || s.id::text = (select realtime.topic())
      and public.is_live_class_participant(s.id, (select auth.uid()))
  )
);

commit;
