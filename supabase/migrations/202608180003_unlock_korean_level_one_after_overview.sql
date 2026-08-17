begin;

-- 第 00 章默认开放；完成智能教材总览内容后，才开放第 01 章。
select set_config('app.platform_content_migration', 'on', true);
alter table public.course_chapters disable trigger user;

update public.course_chapters as overview
set
  unlock_mode = 'immediate',
  prerequisite_chapter_id = null,
  available_from = null,
  is_manually_locked = false,
  updated_at = now()
from public.lessons as lesson
join public.courses as course on course.id = lesson.course_id
where overview.lesson_id = lesson.id
  and course.slug = 'korean-beginner'
  and lesson.slug = 'basic-pronunciation'
  and overview.slug = 'korean-level-one-00';

update public.course_chapters as chapter_one
set
  unlock_mode = 'prerequisite_completed',
  prerequisite_chapter_id = overview.id,
  available_from = null,
  is_manually_locked = false,
  updated_at = now()
from public.course_chapters as overview
join public.lessons as lesson on lesson.id = overview.lesson_id
join public.courses as course on course.id = lesson.course_id
where chapter_one.lesson_id = lesson.id
  and course.slug = 'korean-beginner'
  and lesson.slug = 'basic-pronunciation'
  and overview.slug = 'korean-level-one-00'
  and chapter_one.slug = 'korean-level-one-01';

alter table public.course_chapters enable trigger user;

commit;
