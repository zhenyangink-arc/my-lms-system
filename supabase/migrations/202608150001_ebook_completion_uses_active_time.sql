begin;

-- With the 60-second inactivity pause in the reader, chapter completion and
-- test access depend only on accumulated active reading time. Page visits are
-- retained as analytics but no longer gate completion.
create or replace function private.enforce_chapter_test_learning_prerequisites()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_test public.chapter_tests%rowtype;
begin
  if auth.uid() is null or auth.role() = 'service_role' then
    return new;
  end if;

  select *
  into v_test
  from public.chapter_tests
  where id = new.test_id
    and slug = new.test_slug
    and status = 'published';

  if not found then
    raise exception '没有找到这份章节测试';
  end if;

  if not exists (
    select 1
    from public.course_ebook_progress as ebook_progress
    where ebook_progress.tenant_id = new.tenant_id
      and ebook_progress.student_id = new.student_id
      and ebook_progress.test_slug = v_test.slug
      and ebook_progress.progress_percent >= 100
      and ebook_progress.reading_seconds >= 600
  ) then
    raise exception '请先完成本章有效阅读时间，再开始章节测试';
  end if;

  if exists (
    select 1
    from public.chapter_tests as prior_test
    where prior_test.course_key = v_test.course_key
      and prior_test.status = 'published'
      and prior_test.chapter_number < v_test.chapter_number
      and not exists (
        select 1
        from public.chapter_test_attempts as prior_attempt
        where prior_attempt.tenant_id = new.tenant_id
          and prior_attempt.student_id = new.student_id
          and prior_attempt.test_id = prior_test.id
          and prior_attempt.passed
      )
  ) then
    raise exception '请先通过前面章节的测试，再开始本章测试';
  end if;

  return new;
end;
$$;

comment on function private.enforce_chapter_test_learning_prerequisites() is
  '学生提交章节测试前必须达到本章有效阅读时长，并通过同课程此前章节。';

commit;
