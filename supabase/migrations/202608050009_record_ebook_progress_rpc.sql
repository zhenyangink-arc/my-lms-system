begin;

-- saveKoreanEbookProgressAction did select -> merge in memory -> upsert the
-- whole row. Two saves firing close together (rapid page flips each starting
-- their own debounce) can both read the same "before" state and the second
-- upsert to land overwrites the first, dropping whichever pages only the
-- first call had merged in. Move the merge into the database so it happens
-- atomically under one row lock instead of racing two round trips.
create or replace function public.record_ebook_progress(
  p_test_slug text,
  p_current_page integer,
  p_total_pages integer,
  p_new_read_pages integer[]
)
returns public.course_ebook_progress
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid := private.current_tenant_id();
  v_row public.course_ebook_progress%rowtype;
  v_existing integer[];
  v_merged integer[];
  v_percent integer;
begin
  if v_user_id is null or v_tenant_id is null then
    raise exception '请登录有效的机构账号后再记录学习进度';
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

  v_percent := least(100, round(coalesce(array_length(v_merged, 1), 0)::numeric / p_total_pages * 100));

  insert into public.course_ebook_progress (
    tenant_id, student_id, test_slug, current_page, total_pages,
    read_pages, progress_percent, last_read_at, updated_at
  ) values (
    v_tenant_id, v_user_id, p_test_slug,
    least(greatest(p_current_page, 0), p_total_pages - 1),
    p_total_pages, v_merged, v_percent, now(), now()
  )
  on conflict (student_id, test_slug) do update
  set
    current_page = least(greatest(p_current_page, 0), p_total_pages - 1),
    total_pages = p_total_pages,
    read_pages = v_merged,
    progress_percent = v_percent,
    last_read_at = now(),
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$function$;

revoke all on function public.record_ebook_progress(text, integer, integer, integer[]) from public;
grant execute on function public.record_ebook_progress(text, integer, integer, integer[]) to authenticated;

comment on function public.record_ebook_progress(text, integer, integer, integer[]) is
  '原子合并电子书已读页码：advisory lock 串行化同一学生同一本书的并发保存，替代客户端"查询-内存合并-整表覆盖"的非原子流程。';

commit;
