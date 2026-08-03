begin;

-- “韩国语1级”的章节测试使用课程中的真实中文章节标题，
-- 不再用“第01课”一类序号占位。
with chapter_titles(slug, title) as (
  values
    ('korean-level-one-01', '你好？'),
    ('korean-level-one-02', '这是什么？'),
    ('korean-level-one-03', '我学习韩语。'),
    ('korean-level-one-04', '在哪里？'),
    ('korean-level-one-05', '周末见了朋友。'),
    ('korean-level-one-06', '多少钱？'),
    ('korean-level-one-07', '天气怎么样？'),
    ('korean-level-one-08', '去看电影好吗？'),
    ('korean-level-one-09', '这位是谁？'),
    ('korean-level-one-10', '现在几点？'),
    ('korean-level-one-11', '感冒了。'),
    ('korean-level-one-12', '喂。'),
    ('korean-level-one-13', '请带我去首尔站。'),
    ('korean-level-one-14', '请试穿这件衣服。'),
    ('korean-level-one-15', '我想去旅行。'),
    ('korean-level-one-16', '你能来我家吗？')
)
update public.course_tests as test
set
  title = chapter_titles.title,
  updated_at = now()
from chapter_titles
where test.slug = chapter_titles.slug
  and test.title is distinct from chapter_titles.title;

-- 作业名称直接跟随章节标题，不追加“作业”。
update public.chapter_homework_plans as plan
set title = test.title
from public.course_tests as test
where test.id = plan.test_id
  and plan.title is distinct from test.title;

create or replace function private.sync_chapter_homework_plan_title()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.chapter_homework_plans
  set title = new.title
  where test_id = new.id
    and title is distinct from new.title;

  return new;
end;
$$;

drop trigger if exists course_tests_sync_homework_plan_title
  on public.course_tests;
create trigger course_tests_sync_homework_plan_title
after insert or update of title on public.course_tests
for each row execute function private.sync_chapter_homework_plan_title();

comment on function private.sync_chapter_homework_plan_title() is
  '让章节作业名称始终使用课程章节标题，不追加“作业”等后缀。';

commit;
