begin;

-- INSERT ... ON CONFLICT fires BEFORE INSERT triggers before it resolves the
-- conflict. The increment clamp therefore reduced every cumulative EXCLUDED
-- value back to 35 seconds. Update the existing row first so the clamp sees a
-- real UPDATE, while preserving its 35-second per-call limit for both paths.
create or replace function public.record_ebook_progress(
  p_test_slug text,
  p_current_page integer,
  p_total_pages integer,
  p_new_read_pages integer[],
  p_reading_seconds integer default 0
)
returns public.course_ebook_progress
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid := private.current_tenant_id();
  v_row public.course_ebook_progress%rowtype;
  v_existing integer[];
  v_merged integer[];
  v_existing_seconds integer := 0;
  v_increment integer := least(35, greatest(coalesce(p_reading_seconds, 0), 0));
  v_seconds integer;
  v_percent integer;
begin
  if v_user_id is null or v_tenant_id is null then
    raise exception '请登录有效的机构账号后再记录学习进度';
  end if;
  if not public.student_feature_allowed('korean_course') then
    raise exception '当前会员档位没有权限记录这本教材的学习进度';
  end if;
  if p_test_slug is null or length(trim(p_test_slug)) = 0 then
    raise exception '章节编号不正确';
  end if;
  if not exists (
    select 1
    from public.chapter_tests as test
    where test.slug = p_test_slug
      and test.status = 'published'
      and test.student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
  ) then
    raise exception '章节不存在或尚未发布';
  end if;
  if p_total_pages is null or p_total_pages <= 0 or p_total_pages > 2000 then
    raise exception '总页数不正确';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_tenant_id::text || ':' || v_user_id::text || ':' || p_test_slug,
      0
    )
  );

  select progress.read_pages, coalesce(progress.reading_seconds, 0)
  into v_existing, v_existing_seconds
  from public.course_ebook_progress as progress
  where progress.tenant_id = v_tenant_id
    and progress.student_id = v_user_id
    and progress.test_slug = p_test_slug;

  select coalesce(array_agg(distinct page order by page), '{}'::integer[])
  into v_merged
  from unnest(
    coalesce(v_existing, '{}'::integer[])
      || coalesce(p_new_read_pages, '{}'::integer[])
  ) as page
  where page >= 0 and page < p_total_pages;

  v_seconds := least(1000000, coalesce(v_existing_seconds, 0) + v_increment);
  v_percent := least(100, round(v_seconds::numeric / 600 * 100));

  update public.course_ebook_progress as progress
  set
    current_page = least(
      greatest(coalesce(p_current_page, 0), 0),
      p_total_pages - 1
    ),
    total_pages = p_total_pages,
    read_pages = v_merged,
    reading_seconds = v_seconds,
    progress_percent = v_percent,
    last_read_at = now(),
    updated_at = now()
  where progress.tenant_id = v_tenant_id
    and progress.student_id = v_user_id
    and progress.test_slug = p_test_slug
  returning * into v_row;

  if not found then
    insert into public.course_ebook_progress (
      tenant_id, student_id, test_slug, current_page, total_pages,
      read_pages, reading_seconds, progress_percent, last_read_at, updated_at
    ) values (
      v_tenant_id,
      v_user_id,
      p_test_slug,
      least(greatest(coalesce(p_current_page, 0), 0), p_total_pages - 1),
      p_total_pages,
      v_merged,
      v_seconds,
      v_percent,
      now(),
      now()
    )
    returning * into v_row;
  end if;

  -- 明细只能记录数据库认可的有效增量；不能由客户端直接放大统计时长。
  if v_increment > 0 then
    insert into public.learning_time_log (
      tenant_id, student_id, test_slug, source, seconds, recorded_at
    ) values (
      v_tenant_id, v_user_id, p_test_slug, 'ebook', v_increment, now()
    );
  end if;

  return v_row;
end;
$$;

revoke all on function public.record_ebook_progress(
  text, integer, integer, integer[], integer
) from public;
grant execute on function public.record_ebook_progress(
  text, integer, integer, integer[], integer
) to authenticated;

comment on function public.record_ebook_progress(
  text, integer, integer, integer[], integer
) is
  '幂等片段调用的电子书累计进度写入；更新现有行后再插入新行，避免 INSERT 触发器重置累计秒数。';

commit;
