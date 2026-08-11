-- ============================================================
-- 收紧工具函数：只接收 session_id，user_id 固定取 auth.uid()
-- 防止登录用户传入任意 uid 探测课堂参与者关系；并撤销 PUBLIC 执行
-- ============================================================

begin;

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
    select 1 from public.live_class_sessions as s
    where s.id = p_session_id and s.teacher_id = (select auth.uid())
  );
$$;

-- 撤销 PUBLIC 执行，仅授权 authenticated
revoke all on function public.is_live_class_participant(uuid) from public;
revoke all on function public.is_live_class_teacher(uuid) from public;
grant execute on function public.is_live_class_participant(uuid) to authenticated;
grant execute on function public.is_live_class_teacher(uuid) to authenticated;

-- ========== 同步更新所有 policy 调用（去掉 user_id 参数） ==========

drop policy if exists "students read own live class sessions" on public.live_class_sessions;
create policy "students read own live class sessions"
on public.live_class_sessions for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and public.is_live_class_participant(id)
);

drop policy if exists "teacher manages own session members" on public.live_class_members;
create policy "teacher manages own session members"
on public.live_class_members for all to authenticated
using (public.is_live_class_teacher(session_id))
with check (public.is_live_class_teacher(session_id));

drop policy if exists "participants read own session events" on public.live_class_events;
create policy "participants read own session events"
on public.live_class_events for select to authenticated
using (public.is_live_class_participant(session_id));

drop policy if exists "participants insert own events with role-scoped kinds" on public.live_class_events;
create policy "participants insert own events with role-scoped kinds"
on public.live_class_events for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and tenant_id = (select private.current_tenant_id())
  and public.is_live_class_participant(session_id)
  and (
    public.is_live_class_teacher(session_id)
    or kind in ('rtc-answer', 'rtc-ice', 'rtc-hangup')
  )
);

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
      and public.is_live_class_participant(s.id)
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
      and public.is_live_class_participant(s.id)
  )
);

commit;
