begin;

-- 章节测试目录现在按 student_app_id 分区。当前交卷 RPC 是韩语专用，
-- 因此数据库触发器也必须拒绝其他应用的测试，不能只靠页面隐藏入口。
create or replace function private.enforce_chapter_test_learning_prerequisites()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_test public.chapter_tests%rowtype;
  v_tenant_id uuid := private.current_tenant_id();
begin
  if auth.uid() is null or auth.role() = 'service_role' then
    return new;
  end if;

  if new.student_id is distinct from auth.uid()
    or new.tenant_id is distinct from v_tenant_id then
    raise exception '不能为其他学生或租户提交章节测试';
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

  if v_test.student_app_id is distinct from
    '10000000-0000-4000-8000-000000000001'::uuid then
    raise exception '这份测试不属于韩语学习应用';
  end if;

  if not public.student_feature_allowed('korean_course') then
    raise exception '当前会员档位没有权限提交这项测试';
  end if;

  if not exists (
    select 1
    from public.course_ebook_progress as ebook_progress
    where ebook_progress.tenant_id = new.tenant_id
      and ebook_progress.student_id = new.student_id
      and ebook_progress.student_app_id = v_test.student_app_id
      and ebook_progress.test_slug = v_test.slug
      and ebook_progress.progress_percent >= 100
      and ebook_progress.reading_seconds >= 600
  ) then
    raise exception '请先完成本章有效阅读时间，再开始章节测试';
  end if;

  if exists (
    select 1
    from public.chapter_tests as prior_test
    where prior_test.student_app_id = v_test.student_app_id
      and prior_test.course_key = v_test.course_key
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
  '韩语章节测试数据库防线：校验当前租户、当前学生、韩语应用归属、会员权限、有效阅读时长与前置章节。';

commit;
