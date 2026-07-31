begin;

-- 章节测试必须归属于真实课时，不能再依赖 course_key 文本推断课程关系。
alter table public.course_tests
  add column if not exists lesson_id uuid
  references public.lessons(id) on delete restrict;

-- 先精确绑定现有的“韩语初级 → 第 1 课：韩文字母入门”四个章节测试。
update public.course_tests as test
set lesson_id = lesson.id,
    updated_at = now()
from public.lessons as lesson
join public.courses as course
  on course.id = lesson.course_id
join public.course_categories as subcategory
  on subcategory.id = course.category_id
join public.course_categories as category
  on category.id = subcategory.parent_id
where test.lesson_id is null
  and test.course_key = 'hangul-introduction'
  and lesson.slug = 'hangul-introduction'
  and course.slug = 'korean-beginner'
  and subcategory.slug = 'korean-basic'
  and category.slug = 'korean';

-- 对其他历史数据，只在课时 slug 全局唯一时安全回填。
update public.course_tests as test
set lesson_id = matched_lesson.id,
    updated_at = now()
from (
  select lesson.slug, (array_agg(lesson.id order by lesson.id))[1] as id
  from public.lessons as lesson
  group by lesson.slug
  having count(*) = 1
) as matched_lesson
where test.lesson_id is null
  and test.course_key = matched_lesson.slug;

-- NOT VALID 保留无法自动识别的历史记录，但从现在起禁止新增无课时归属的数据。
alter table public.course_tests
  add constraint course_tests_lesson_required
  check (lesson_id is not null) not valid;

create unique index if not exists course_tests_lesson_chapter_unique_idx
  on public.course_tests (lesson_id, chapter_number)
  where lesson_id is not null;

create index if not exists course_tests_lesson_status_idx
  on public.course_tests (lesson_id, status, chapter_number);

comment on column public.course_tests.lesson_id is
  '章节测试所属的真实课时；课程、电子书和测试管理统一通过此关系读取。';

commit;
