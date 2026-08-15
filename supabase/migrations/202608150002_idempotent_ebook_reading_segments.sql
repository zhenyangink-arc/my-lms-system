-- 电子书计时按客户端生成的片段 ID 幂等入库。
-- 刷新/关闭页面时，常规心跳与 keepalive 补存可能同时到达；同一片段只累计一次。

begin;

create table if not exists public.ebook_reading_segments (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null,
  test_slug text not null,
  seconds integer not null check (seconds >= 0 and seconds <= 35),
  recorded_at timestamptz not null default now(),
  primary key (student_id, event_id)
);

create index if not exists ebook_reading_segments_student_time_idx
  on public.ebook_reading_segments (student_id, recorded_at);

alter table public.ebook_reading_segments enable row level security;

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
  on conflict (student_id, event_id) do nothing
  returning event_id into v_inserted_event;

  if v_inserted_event is null then
    select * into v_row
    from public.course_ebook_progress
    where student_id = v_user_id and test_slug = p_test_slug;

    if not found then
      raise exception '找不到该计时片段对应的电子书进度';
    end if;
    return v_row;
  end if;

  -- 幂等键只需覆盖刷新和网络重试窗口，避免高频心跳形成永久台账。
  delete from public.ebook_reading_segments
  where student_id = v_user_id
    and recorded_at < now() - interval '1 day';

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

comment on table public.ebook_reading_segments is
  '电子书有效阅读计时的幂等片段台账；防止刷新、重试导致重复累计。';

commit;
