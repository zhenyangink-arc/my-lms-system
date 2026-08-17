begin;

-- 课程总览用于介绍学习方式，不应成为第 01 章的解锁前置条件。
-- 同时显式固定 00、01 为直接解锁，保证各环境的数据规则一致。
select set_config('app.platform_content_migration', 'on', true);
alter table public.course_chapters disable trigger user;

update public.course_chapters as chapter
set
  unlock_mode = 'immediate',
  prerequisite_chapter_id = null,
  available_from = null,
  is_manually_locked = false,
  updated_at = now()
from public.lessons as lesson
join public.courses as course on course.id = lesson.course_id
where chapter.lesson_id = lesson.id
  and course.slug = 'korean-beginner'
  and lesson.slug = 'basic-pronunciation'
  and chapter.slug in ('korean-level-one-00', 'korean-level-one-01');

alter table public.course_chapters enable trigger user;

commit;
