-- ============================================================
-- 保证同一老师、同一课时不会因并发请求产生重复的进行中课堂。
-- one_on_one 按学生区分；group 每个课时只保留一个进行中公共课堂。
-- ============================================================

begin;

create unique index live_class_sessions_active_one_on_one_unique
  on public.live_class_sessions (tenant_id, teacher_id, student_id, lesson_id)
  where status = 'active' and mode = 'one_on_one';

create unique index live_class_sessions_active_group_unique
  on public.live_class_sessions (tenant_id, teacher_id, lesson_id)
  where status = 'active' and mode = 'group';

commit;
