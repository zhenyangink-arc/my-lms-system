-- ============================================================
-- 实时课堂事件表（服务端强制鉴权的事件通道）
--
-- 实时事件（翻页/画笔/批注/语音信令/结束）不再走客户端自报 senderId 的
-- Broadcast，而是 INSERT 到本表：RLS 强制 sender_id = auth.uid()（不可伪造），
-- 并按事件 kind 限制发送者身份（老师专属事件学生 INSERT 会被 RLS 拒绝）。
-- 客户端通过 Supabase Realtime Postgres Changes 订阅本表的 INSERT 分发。
-- Presence（在线状态）仍走 Broadcast 频道，不含敏感数据。
-- ============================================================

begin;

create table public.live_class_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  session_id uuid not null references public.live_class_sessions(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in (
    'page', 'stroke', 'note', 'clear', 'end',
    'rtc-offer', 'rtc-answer', 'rtc-ice', 'rtc-hangup'
  )),
  chapter_slug text,
  page integer,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

comment on table public.live_class_events is
  '实时课堂事件（append-only）：sender_id 由 RLS 强制为 auth.uid()，kind 权限由 RLS 按发起者角色校验，客户端经 Postgres Changes 订阅';
comment on column public.live_class_events.payload is '事件体（stroke/note/sdp/candidate 等），不含 sender 字段——发送者身份以 sender_id 列为准';

create index live_class_events_session_idx
  on public.live_class_events (session_id, created_at);
create index live_class_events_sender_idx
  on public.live_class_events (sender_id, created_at);

alter table public.live_class_events enable row level security;

-- 参与者可读取本课堂的事件（订阅分发用）
create policy "participants read own session events"
on public.live_class_events for select to authenticated
using (
  exists (
    select 1 from public.live_class_sessions as s
    where s.id = session_id
      and s.tenant_id = (select private.current_tenant_id())
      and (s.teacher_id = (select auth.uid()) or s.student_id = (select auth.uid()))
  )
);

-- INSERT 强制 sender_id = auth.uid()；发送者必须是该课堂参与者；
-- 老师可发任意 kind，学生只能发 rtc-answer / rtc-ice / rtc-hangup
-- （老师专属事件：page/stroke/note/clear/end/rtc-offer，学生 INSERT 被拒）。
create policy "participants insert own events with role-scoped kinds"
on public.live_class_events for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and tenant_id = (select private.current_tenant_id())
  and exists (
    select 1 from public.live_class_sessions as s
    where s.id = session_id
      and s.tenant_id = (select private.current_tenant_id())
      and (s.teacher_id = (select auth.uid()) or s.student_id = (select auth.uid()))
  )
  and (
    exists (
      select 1 from public.live_class_sessions as s
      where s.id = session_id and s.teacher_id = (select auth.uid())
    )
    or kind in ('rtc-answer', 'rtc-ice', 'rtc-hangup')
  )
);

-- append-only：不允许修改或删除
revoke update, delete on public.live_class_events from authenticated;

-- 纳入 Realtime 发布，客户端通过 Postgres Changes 订阅 INSERT
alter publication supabase_realtime add table public.live_class_events;

commit;
