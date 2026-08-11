-- ============================================================
-- 成长工具箱练习时长记录
--
-- 学生端四个成长工具箱练习（单词/口语/语法/听力）需要按天记录练习时长，
-- 写入 learning_time_log（source='toolbox'，test_slug='toolbox-<skill>'），
-- 供成长首页"本周学习活动"卡片按工具聚合展示。
-- ============================================================

begin;

-- source 增加 toolbox 值
alter table public.learning_time_log
  drop constraint learning_time_log_source_check;
alter table public.learning_time_log
  add constraint learning_time_log_source_check
  check (source in ('ebook', 'lesson', 'toolbox', 'other'));

-- 学生可写入自己的工具箱练习时长（服务端 action 带学生会话插入，RLS 纵深防御）
create policy "students insert own toolbox learning time"
on public.learning_time_log for insert to authenticated
with check (
  tenant_id = (select private.current_tenant_id())
  and student_id = (select auth.uid())
  and source = 'toolbox'
);

commit;
