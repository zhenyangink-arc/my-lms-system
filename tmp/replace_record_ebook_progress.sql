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
as $function$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid := private.current_tenant_id();
  v_row public.course_ebook_progress%rowtype;
  v_existing integer[];
  v_merged integer[];
  v_existing_seconds integer := 0;
  v_seconds integer;
  v_percent integer;
begin
  if v_user_id is null or v_tenant_id is null then
    raise exception '请登录有效的机构账号后再记录学习进度';
  end if;
  if not public.student_feature_allowed('korean_course') then
    raise exception '当前会员档位没有权限记录这本教材的学习进度';
  end if;
  if p_total_pages is null or p_total_pages <= 0 or p_total_pages > 2000 then
    raise exception '总页数不正确';
  end if;

  -- 用 advisory lock 把同一学生同一本书的并发保存串行化：加锁之后再读旧值，
  -- 保证同一时刻只有一次保存在合并、写回，杜绝后一次用旧集合整表覆盖前一次。
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_tenant_id::text || ':' || v_user_id::text || ':' || p_test_slug,
      0
    )
  );

  select read_pages into v_existing
  from public.course_ebook_progress
  where student_id = v_user_id and test_slug = p_test_slug;

  select coalesce(array_agg(distinct page order by page), '{}'::integer[])
  into v_merged
  from unnest(coalesce(v_existing, '{}'::integer[]) || coalesce(p_new_read_pages, '{}'::integer[])) as page
  where page >= 0 and page < p_total_pages;

  select coalesce(reading_seconds, 0) into v_existing_seconds
  from public.course_ebook_progress
  where student_id = v_user_id and test_slug = p_test_slug;

  v_seconds := least(1000000, v_existing_seconds + greatest(coalesce(p_reading_seconds, 0), 0));

  -- 阅读进度按累计阅读时长计算：10 分钟（600 秒）= 100%
  v_percent := least(100, round(v_seconds::numeric / 600 * 100));

  insert into public.course_ebook_progress (
    tenant_id, student_id, test_slug, current_page, total_pages,
    read_pages, reading_seconds, progress_percent, last_read_at, updated_at
  ) values (
    v_tenant_id, v_user_id, p_test_slug,
    least(greatest(coalesce(p_current_page, 0), 0), p_total_pages - 1),
    p_total_pages, v_merged, v_seconds, v_percent, now(), now()
  )
  on conflict (student_id, test_slug) do update
  set
    -- p_current_page 为 null 表示前端没有该章的页码快照，保留数据库已有页码
    current_page = case
      when p_current_page is null then course_ebook_progress.current_page
      else least(greatest(p_current_page, 0), p_total_pages - 1)
    end,
    total_pages = p_total_pages,
    read_pages = v_merged,
    reading_seconds = v_seconds,
    progress_percent = v_percent,
    last_read_at = now(),
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$function$;
