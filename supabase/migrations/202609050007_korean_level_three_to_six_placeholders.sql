-- ============================================================
-- 韩语课程目录里，"韩国语1级""韩国语2级" 其实是"韩语初级"课程下面
-- 两节按级别命名的课时，而"韩语中级""韩语高级"下面原有的三节课时
-- 是按技能命名的（语法衔接/会话进阶/阅读写作等），没有对应 3-6 级
-- 的课时可选。这里在中级、高级课程下各追加两节按级别命名的占位课
-- 时（3/4 级归中级，5/6 级归高级），使标准学习计划的课时选择器和
-- 按级别分组能识别到 1-6 级。正文内容留空，后续由内容团队补充；
-- 每节课先放一个与课时同名的占位章节，避免课时详情页完全空白，
-- 与"韩国语2级"课时当前的占位方式保持一致。
-- ============================================================

begin;

select set_config('app.platform_content_migration', 'on', true);
alter table public.lessons disable trigger user;
alter table public.course_chapters disable trigger user;

with level_catalog (course_slug, lesson_slug, sort_order, title, description) as (
  values
    ('korean-intermediate', 'korean-level-three', 4, '第 4 课：韩国语3级', '韩国语3级综合内容，课程正文由内容团队后续补充。'),
    ('korean-intermediate', 'korean-level-four', 5, '第 5 课：韩国语4级', '韩国语4级综合内容，课程正文由内容团队后续补充。'),
    ('korean-advanced', 'korean-level-five', 4, '第 4 课：韩国语5级', '韩国语5级综合内容，课程正文由内容团队后续补充。'),
    ('korean-advanced', 'korean-level-six', 5, '第 5 课：韩国语6级', '韩国语6级综合内容，课程正文由内容团队后续补充。')
),
resolved as (
  select course.id as course_id, catalog.*
  from level_catalog as catalog
  join public.courses as course
    on course.slug = catalog.course_slug
   and course.student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
   and course.content_scope = 'platform'
   and course.tenant_id is null
),
inserted_lessons as (
  insert into public.lessons (
    course_id, slug, title, description, lesson_type, duration_minutes,
    is_free_preview, is_published, sort_order, allow_questions,
    content_scope, unlock_mode, is_manually_locked
  )
  select
    course_id, lesson_slug, title, description, 'text', 20,
    false, true, sort_order, true,
    'platform', 'immediate', false
  from resolved
  on conflict (course_id, slug) do update set
    title = excluded.title,
    description = excluded.description,
    sort_order = excluded.sort_order,
    is_published = excluded.is_published
  returning id, slug, title, description
)
insert into public.course_chapters (
  lesson_id, chapter_test_id, slug, title, description, duration_minutes,
  is_published, sort_order, completion_rule, unlock_mode,
  prerequisite_chapter_id, required_score, available_from,
  is_manually_locked, tenant_id, content_scope
)
select
  id, null, slug, title, description, 20,
  true, 1, 'content_viewed', 'immediate',
  null, null, null, false, null, 'platform'
from inserted_lessons
on conflict (lesson_id, slug) do update set
  title = excluded.title,
  description = excluded.description,
  is_published = excluded.is_published,
  updated_at = now();

alter table public.lessons enable trigger user;
alter table public.course_chapters enable trigger user;

commit;
