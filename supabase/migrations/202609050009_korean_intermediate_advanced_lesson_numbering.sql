-- ============================================================
-- 沿用 202609050008 对"韩语初级"的处理方式：中级、高级课程下原有
-- 3 节按技能命名的课时占了"第1-3课"，导致新增的级别课时（3/4/5/6
-- 级）排到"第4课""第5课"，课时序号和级别数字对不上。这里把原有
-- 技能课改成不占"第X课"编号的预备课，级别课时改回"第1课""第2课"
-- 与其所属的两个级别数字对齐。只改标题文字，不改 sort_order、
-- slug 或先修关系，排课顺序不受影响。
-- ============================================================

begin;

select set_config('app.platform_content_migration', 'on', true);
alter table public.lessons disable trigger user;
alter table public.course_chapters disable trigger user;

with intermediate_course as (
  select id from public.courses
  where slug = 'korean-intermediate' and content_scope = 'platform' and tenant_id is null
),
advanced_course as (
  select id from public.courses
  where slug = 'korean-advanced' and content_scope = 'platform' and tenant_id is null
),
updated_intermediate as (
  update public.lessons as lesson
  set title = renames.new_title
  from (values
    ('intermediate-grammar-bridge', '预备课：中级语法衔接'),
    ('situational-conversation', '预备课：场景会话进阶'),
    ('reading-and-writing', '预备课：中级阅读与写作'),
    ('korean-level-three', '第 1 课：韩国语3级'),
    ('korean-level-four', '第 2 课：韩国语4级')
  ) as renames(lesson_slug, new_title)
  where lesson.slug = renames.lesson_slug
    and lesson.course_id = (select id from intermediate_course)
  returning lesson.id, lesson.slug, lesson.title
),
updated_advanced as (
  update public.lessons as lesson
  set title = renames.new_title
  from (values
    ('advanced-grammar-expression', '预备课：高级语法与表达'),
    ('news-and-academic-reading', '预备课：新闻与学术阅读'),
    ('discussion-and-writing', '预备课：讨论与高级写作'),
    ('korean-level-five', '第 1 课：韩国语5级'),
    ('korean-level-six', '第 2 课：韩国语6级')
  ) as renames(lesson_slug, new_title)
  where lesson.slug = renames.lesson_slug
    and lesson.course_id = (select id from advanced_course)
  returning lesson.id, lesson.slug, lesson.title
),
updated_lessons as (
  select * from updated_intermediate
  union all
  select * from updated_advanced
)
update public.course_chapters as chapter
set title = updated_lessons.title
from updated_lessons
where chapter.lesson_id = updated_lessons.id
  and chapter.slug = updated_lessons.slug;

alter table public.lessons enable trigger user;
alter table public.course_chapters enable trigger user;

commit;
