-- ============================================================
-- group 公共课堂需要 student_id 可为 NULL（成员关系走 live_class_members）
-- ============================================================

begin;

alter table public.live_class_sessions
  alter column student_id drop not null;

commit;
