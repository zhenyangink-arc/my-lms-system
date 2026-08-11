-- ============================================================
-- 学习时长明细表：成长首页"本周学习活动" / "月度学习记录"按天聚合的真实数据源
--
-- course_ebook_progress.reading_seconds 只有累计总量、没有按天明细，
-- 前端之前只能用 lesson_progress 的 started_at / last_viewed_at 差值估算
-- 学习时长。这里新增明细表：每次上报阅读秒数时落一条带时间戳的记录，
-- 按天/周/月求和即为真实学习时长。
-- ============================================================

begin;

create table public.learning_time_log (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  test_slug text,
  source text not null default 'ebook'
    check (source in ('ebook', 'lesson', 'other')),
  seconds integer not null check (seconds > 0),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.learning_time_log is
  '学生学习时长明细：每次学习行为上报的秒数，带时间戳，可按天/周/月聚合。';
comment on column public.learning_time_log.source is
  '来源：ebook=互动教材电子书阅读（当前唯一埋点），lesson/other 预留。';
comment on column public.learning_time_log.seconds is
  '本次学习行为累计的秒数（增量），单条 > 0。';

create index learning_time_log_student_time_idx
  on public.learning_time_log (tenant_id, student_id, recorded_at);

-- 学生可读自己的学习时长明细（成长首页聚合用）。
create policy "students read own learning time log"
on public.learning_time_log for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and student_id = (select auth.uid())
);

-- 机构负责人 / 管理员可读本机构学习时长明细（老师端"我的学生"预留）。
create policy "tenant admins read learning time log"
on public.learning_time_log for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select public.is_owner_account() or public.is_admin())
);

alter table public.learning_time_log enable row level security;

-- 电子书阅读上报时，同时写入时长明细（security definer 内执行，绕过 RLS）。
create or replace function public.record_ebook_progress(
  p_test_slug text,
  p_current_page integer,
  p_total_pages integer,
  p_new_read_pages integer[],
  p_reading_seconds integer default 0
)
returns course_ebook_progress
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

  -- 用 advisory lock 把同一学生同一本书的并发保存串行化
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
    least(greatest(p_current_page, 0), p_total_pages - 1),
    p_total_pages, v_merged, v_seconds, v_percent, now(), now()
  )
  on conflict (student_id, test_slug) do update
  set
    current_page = least(greatest(p_current_page, 0), p_total_pages - 1),
    total_pages = p_total_pages,
    read_pages = v_merged,
    reading_seconds = v_seconds,
    progress_percent = v_percent,
    last_read_at = now(),
    updated_at = now()
  returning * into v_row;

  -- 本次新增的阅读秒数写入学习时长明细（真实学习时长，按天聚合）
  if coalesce(p_reading_seconds, 0) > 0 then
    insert into public.learning_time_log (
      tenant_id, student_id, test_slug, source, seconds, recorded_at
    ) values (
      v_tenant_id, v_user_id, p_test_slug, 'ebook',
      greatest(coalesce(p_reading_seconds, 0), 0), now()
    );
  end if;

  return v_row;
end;
$$;

revoke all on function public.record_ebook_progress(text, integer, integer, integer[], integer) from public;
grant execute on function public.record_ebook_progress(text, integer, integer, integer[], integer) to authenticated;

-- 回填历史：把现有电子书累计阅读秒数按最后阅读日期落一条明细，
-- 让成长首页的历史学习时长立即可见（后续新上报按增量逐条记录）。
insert into public.learning_time_log (
  tenant_id, student_id, test_slug, source, seconds, recorded_at, created_at
)
select
  tenant_id, student_id, test_slug, 'ebook',
  reading_seconds,
  coalesce(last_read_at, updated_at, now()),
  now()
from public.course_ebook_progress
where reading_seconds > 0;

commit;
