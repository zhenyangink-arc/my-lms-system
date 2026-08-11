-- ============================================================
-- Realtime 频道授权：live-class:{sessionId} 仅课堂参与者可访问
--
-- 事件数据本身已由 live_class_events 表 RLS 保护（Postgres Changes
-- 按数据表 RLS 过滤）。本迁移限制 Realtime 频道的 Broadcast/Presence
-- 读写，防止非参与者订阅频道（presence 泄露）或向频道广播。
--
-- 注意：还需在 Supabase Dashboard → Realtime → Settings 关闭
-- "Allow public access"（启用 private channel 生效的前提），
-- 客户端需以 config: { private: true } 实例化频道。
-- ============================================================

begin;

-- 参与者可订阅频道（接收 Broadcast/Presence）
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
      and (s.teacher_id = (select auth.uid()) or s.student_id = (select auth.uid()))
      and (select realtime.topic()) = 'live-class:' || s.id::text
  )
);

-- 参与者可向频道发送（Broadcast/Presence）
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
      and (s.teacher_id = (select auth.uid()) or s.student_id = (select auth.uid()))
      and (select realtime.topic()) = 'live-class:' || s.id::text
  )
);

commit;
