begin;

-- 电子书进度此前虽然保存 tenant_id，唯一键与 RPC 查询却只有
-- (student_id, test_slug)。同一账号加入多个租户时会共用一条进度记录。
alter table public.course_ebook_progress
  drop constraint if exists course_ebook_progress_student_id_test_slug_key;

alter table public.course_ebook_progress
  add constraint course_ebook_progress_tenant_student_test_key
  unique (tenant_id, student_id, test_slug);

-- 幂等事件也明确包含租户，避免服务端在多租户账号下命中其他租户的事件。
alter table public.ebook_reading_segments
  drop constraint if exists ebook_reading_segments_pkey;

alter table public.ebook_reading_segments
  add constraint ebook_reading_segments_pkey
  primary key (tenant_id, student_id, event_id);

drop index if exists public.ebook_reading_segments_student_time_idx;
create index ebook_reading_segments_tenant_student_time_idx
  on public.ebook_reading_segments (tenant_id, student_id, recorded_at);

revoke all on public.ebook_reading_segments from public, anon, authenticated;
grant all on public.ebook_reading_segments to service_role;

-- RLS 之外再收紧对象权限：匿名用户完全不可访问；登录用户只能读取自身明细，
-- 或通过既有 toolbox INSERT policy 写入自己的工具箱时长。
revoke all on public.learning_time_log from public, anon, authenticated;
grant select, insert on public.learning_time_log to authenticated;
grant all on public.learning_time_log to service_role;
revoke all on sequence public.learning_time_log_id_seq from public, anon, authenticated;
grant usage, select on sequence public.learning_time_log_id_seq to authenticated;
grant all on sequence public.learning_time_log_id_seq to service_role;

-- 进度写入统一走下面两个 security-definer RPC，避免客户端绕开幂等与增量上限
-- 直接更新累计秒数；学生仍可在 RLS 下读取自己的进度。
revoke insert, update, delete on public.course_ebook_progress from anon, authenticated;
grant select on public.course_ebook_progress to authenticated;
grant all on public.course_ebook_progress to service_role;

drop policy if exists "teachers read ebook progress of their assigned students"
  on public.course_ebook_progress;
create policy "teachers read ebook progress of their assigned students"
on public.course_ebook_progress for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and exists (
    select 1
    from public.tenant_student_assignments as assignment
    where assignment.tenant_id = course_ebook_progress.tenant_id
      and assignment.student_id = course_ebook_progress.student_id
      and assignment.teacher_id = (select auth.uid())
  )
);

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

  v_seconds := least(1000000, v_existing_seconds + v_increment);
  v_percent := least(100, round(v_seconds::numeric / 600 * 100));

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
  on conflict (tenant_id, student_id, test_slug) do update
  set
    current_page = excluded.current_page,
    total_pages = excluded.total_pages,
    read_pages = excluded.read_pages,
    reading_seconds = excluded.reading_seconds,
    progress_percent = excluded.progress_percent,
    last_read_at = excluded.last_read_at,
    updated_at = excluded.updated_at
  returning * into v_row;

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

create or replace function public.record_ebook_progress_segment(
  p_event_id uuid,
  p_test_slug text,
  p_current_page integer,
  p_total_pages integer,
  p_new_read_pages integer[],
  p_reading_seconds integer
)
returns public.course_ebook_progress
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid := private.current_tenant_id();
  v_inserted_event uuid;
  v_row public.course_ebook_progress%rowtype;
begin
  if v_user_id is null or v_tenant_id is null then
    raise exception '请登录有效的机构账号后再记录学习进度';
  end if;
  if p_event_id is null then
    raise exception '计时片段编号不能为空';
  end if;
  if p_reading_seconds is null or p_reading_seconds < 0 or p_reading_seconds > 35 then
    raise exception '阅读时长不正确';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_tenant_id::text || ':' || v_user_id::text || ':' || p_test_slug,
      0
    )
  );

  insert into public.ebook_reading_segments (
    tenant_id, student_id, event_id, test_slug, seconds
  ) values (
    v_tenant_id, v_user_id, p_event_id, p_test_slug, p_reading_seconds
  )
  on conflict (tenant_id, student_id, event_id) do nothing
  returning event_id into v_inserted_event;

  if v_inserted_event is null then
    select * into v_row
    from public.course_ebook_progress as progress
    where progress.tenant_id = v_tenant_id
      and progress.student_id = v_user_id
      and progress.test_slug = p_test_slug;

    if not found then
      raise exception '找不到该计时片段对应的电子书进度';
    end if;
    return v_row;
  end if;

  delete from public.ebook_reading_segments as segment
  where segment.tenant_id = v_tenant_id
    and segment.student_id = v_user_id
    and segment.recorded_at < now() - interval '1 day';

  select * into v_row
  from public.record_ebook_progress(
    p_test_slug,
    p_current_page,
    p_total_pages,
    p_new_read_pages,
    p_reading_seconds
  );

  return v_row;
end;
$$;

revoke all on function public.record_ebook_progress_segment(
  uuid, text, integer, integer, integer[], integer
) from public;
grant execute on function public.record_ebook_progress_segment(
  uuid, text, integer, integer, integer[], integer
) to authenticated;

comment on constraint course_ebook_progress_tenant_student_test_key
  on public.course_ebook_progress is
  '同一学生在不同租户中的同一章节拥有完全独立的阅读进度。';

commit;
