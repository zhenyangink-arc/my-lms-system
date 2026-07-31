begin;

update public.course_tests
set duration_minutes = 10,
    updated_at = now()
where lesson_id = (
  select test.lesson_id
  from public.course_tests as test
  where test.slug = 'meet-hangul'
)
and status <> 'archived';

commit;
