begin;

-- 页面和路由会按“上一章测试通过 + 本章电子书读完”开放章节测试。
-- 数据库也必须执行同一规则，避免学生绕过页面直接调用交卷 RPC。
create or replace function private.enforce_chapter_test_learning_prerequisites()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_test public.chapter_tests%rowtype;
begin
  -- 后台迁移和受信任的服务端数据修复不受学生学习顺序限制。
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
    raise exception '请先学完本章电子书，再开始章节测试';
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

drop trigger if exists enforce_chapter_test_learning_prerequisites
  on public.chapter_test_attempts;

create trigger enforce_chapter_test_learning_prerequisites
before insert on public.chapter_test_attempts
for each row
execute function private.enforce_chapter_test_learning_prerequisites();

comment on function private.enforce_chapter_test_learning_prerequisites() is
  '学生提交章节测试前必须完成本章电子书，并通过同课程此前章节。';

-- 旧计时器曾在休眠恢复时一次写入数十万秒；单章超过 24 小时属于明确异常值。
update public.course_ebook_progress
set
  reading_seconds = 0,
  progress_percent = 0,
  read_pages = '{}',
  updated_at = now()
where reading_seconds > 86400;

-- 防止旧客户端、后台休眠恢复或直接调用 RPC 时一次写入异常大的阅读时长。
create or replace function private.clamp_ebook_reading_increment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.reading_seconds := least(greatest(new.reading_seconds, 0), 35);
  elsif old.reading_seconds > 86400 and new.reading_seconds = 0 then
    new.progress_percent := 0;
    return new;
  else
    new.reading_seconds := least(
      greatest(new.reading_seconds, old.reading_seconds),
      old.reading_seconds + 35
    );
  end if;
  new.progress_percent := least(
    100,
    round(new.reading_seconds::numeric / 600 * 100)
  );
  return new;
end;
$$;

drop trigger if exists clamp_ebook_reading_increment
  on public.course_ebook_progress;

create trigger clamp_ebook_reading_increment
before insert or update of reading_seconds on public.course_ebook_progress
for each row
execute function private.clamp_ebook_reading_increment();

comment on function private.clamp_ebook_reading_increment() is
  '学生电子书阅读时长单次最多增加 35 秒，阻止休眠恢复和异常请求污染累计值。';

commit;
