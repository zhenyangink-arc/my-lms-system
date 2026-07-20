-- 平台负责人只巡检课程内容，禁止产生任何学生学习行为数据。
begin;

create or replace function private.reject_platform_student_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_platform_owner() then
    raise exception '平台负责人处于只读巡检模式，不能写入学生学习数据';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists lesson_progress_reject_platform_activity on public.lesson_progress;
create trigger lesson_progress_reject_platform_activity
before insert or update on public.lesson_progress
for each row execute function private.reject_platform_student_activity();

drop trigger if exists lesson_questions_reject_platform_activity on public.lesson_questions;
create trigger lesson_questions_reject_platform_activity
before insert or update on public.lesson_questions
for each row execute function private.reject_platform_student_activity();

comment on function private.reject_platform_student_activity() is
  '硬性禁止平台负责人写入学习进度和学生提问；平台课程巡检必须保持无学生副作用';

commit;
