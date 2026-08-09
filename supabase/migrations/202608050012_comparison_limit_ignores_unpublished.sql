begin;

-- The 4-comparison cap counted every row in student_university_comparisons,
-- including ones pointing at a university that was unpublished after being
-- added. The comparison page already filters those out with
-- is_published = true, so the student can't even see or remove the stale
-- slot, but it still occupies one of their 4 and silently blocks adding a
-- new school.
create or replace function public.enforce_student_university_comparison_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 对同一名学生的并发写入加事务锁，防止快速重复点击突破四校上限。
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  if (
    select count(*)
    from public.student_university_comparisons as comparison
    join public.korean_universities as university
      on university.id = comparison.university_id
    where comparison.user_id = new.user_id
      and university.is_published = true
  ) >= 4 then
    raise exception '每次最多对比四所大学';
  end if;

  return new;
end;
$$;

comment on function public.enforce_student_university_comparison_limit() is
  '对比清单最多四所大学，只统计当前仍已发布的学校，避免下架学校残留的对比记录占满名额。';

commit;
