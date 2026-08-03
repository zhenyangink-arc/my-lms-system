-- 通用课程目录工作台：课程配图、正式章节、解锁规则与平台课程管理权限。
begin;

-- 迁移现有平台课程时允许触发器保留其 tenant_id/content_scope，不把服务端迁移
-- 误判为缺少当前租户的普通业务写入。该设置仅在本事务内生效。
select set_config('app.platform_content_migration', 'on', true);

create or replace function private.is_platform_course_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and coalesce(status, 'active') = 'active'
      and global_role in ('platform_owner', 'platform_admin')
  );
$$;

grant execute on function private.is_platform_course_manager() to authenticated;

alter table public.course_categories
  add column if not exists cover_object_key text,
  add column if not exists cover_alt text,
  add column if not exists cover_focal_point text not null default 'center';

alter table public.courses
  add column if not exists cover_object_key text,
  add column if not exists cover_alt text,
  add column if not exists cover_focal_point text not null default 'center',
  add column if not exists unlock_mode text not null default 'immediate',
  add column if not exists prerequisite_course_id uuid references public.courses(id) on delete set null,
  add column if not exists available_from timestamptz,
  add column if not exists is_manually_locked boolean not null default false;

alter table public.courses
  drop constraint if exists courses_unlock_mode_check,
  add constraint courses_unlock_mode_check check (
    unlock_mode in ('immediate', 'previous_completed', 'prerequisite_completed', 'scheduled', 'manual')
  );

create table if not exists public.course_chapters (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  chapter_test_id uuid unique references public.chapter_tests(id) on delete set null,
  slug text not null,
  title text not null,
  description text,
  duration_minutes integer not null default 20 check (duration_minutes between 1 and 600),
  cover_object_key text,
  cover_alt text,
  cover_focal_point text not null default 'center',
  is_published boolean not null default false,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  completion_rule text not null default 'test_passed',
  unlock_mode text not null default 'immediate',
  prerequisite_chapter_id uuid references public.course_chapters(id) on delete set null,
  required_score integer check (required_score between 0 and 100),
  available_from timestamptz,
  is_manually_locked boolean not null default false,
  tenant_id uuid references public.tenants(id) on delete cascade,
  content_scope text not null default 'tenant',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, slug),
  constraint course_chapters_content_scope_check check (
    (content_scope = 'platform' and tenant_id is null)
    or (content_scope = 'tenant' and tenant_id is not null)
  ),
  constraint course_chapters_completion_rule_check check (
    completion_rule in ('content_viewed', 'test_submitted', 'test_passed', 'manual')
  ),
  constraint course_chapters_unlock_mode_check check (
    unlock_mode in ('immediate', 'previous_completed', 'prerequisite_completed', 'prerequisite_passed', 'scheduled', 'manual')
  )
);

alter table public.lessons
  add column if not exists cover_object_key text,
  add column if not exists cover_alt text,
  add column if not exists cover_focal_point text not null default 'center',
  add column if not exists unlock_mode text not null default 'immediate',
  add column if not exists prerequisite_lesson_id uuid references public.lessons(id) on delete set null,
  add column if not exists prerequisite_chapter_id uuid references public.course_chapters(id) on delete set null,
  add column if not exists required_score integer check (required_score between 0 and 100),
  add column if not exists available_from timestamptz,
  add column if not exists is_manually_locked boolean not null default false;

alter table public.lessons
  drop constraint if exists lessons_unlock_mode_check,
  add constraint lessons_unlock_mode_check check (
    unlock_mode in ('immediate', 'previous_completed', 'prerequisite_completed', 'prerequisite_passed', 'scheduled', 'manual')
  );

create index if not exists course_chapters_lesson_order_idx
  on public.course_chapters (lesson_id, sort_order, created_at);
create index if not exists course_chapters_published_idx
  on public.course_chapters (content_scope, is_published, lesson_id, sort_order);
create index if not exists courses_prerequisite_idx
  on public.courses (prerequisite_course_id) where prerequisite_course_id is not null;
create index if not exists lessons_prerequisite_lesson_idx
  on public.lessons (prerequisite_lesson_id) where prerequisite_lesson_id is not null;
create index if not exists lessons_prerequisite_chapter_idx
  on public.lessons (prerequisite_chapter_id) where prerequisite_chapter_id is not null;

-- 现有 chapter_tests 是当前目录中的章节来源；复制为正式课程章节并保留题库关联。
insert into public.course_chapters (
  lesson_id,
  chapter_test_id,
  slug,
  title,
  description,
  duration_minutes,
  is_published,
  sort_order,
  completion_rule,
  required_score,
  tenant_id,
  content_scope
)
select
  test.lesson_id,
  test.id,
  test.slug,
  test.title,
  test.description,
  greatest(1, coalesce(test.duration_minutes, 20)),
  test.status = 'published',
  test.chapter_number,
  'test_passed',
  test.passing_score,
  lesson.tenant_id,
  lesson.content_scope
from public.chapter_tests as test
join public.lessons as lesson on lesson.id = test.lesson_id
where test.lesson_id is not null
on conflict (chapter_test_id) do update set
  lesson_id = excluded.lesson_id,
  slug = excluded.slug,
  title = excluded.title,
  description = excluded.description,
  duration_minutes = excluded.duration_minutes,
  is_published = excluded.is_published,
  sort_order = excluded.sort_order,
  required_score = excluded.required_score,
  updated_at = now();

-- 同一学习单元内默认严格顺序开放；第一章立即开放，后续章要求前一章通过。
with ordered as (
  select
    id,
    row_number() over (partition by lesson_id order by sort_order, created_at, id) as position,
    lag(id) over (partition by lesson_id order by sort_order, created_at, id) as previous_id
  from public.course_chapters
)
update public.course_chapters as chapter
set
  unlock_mode = case when ordered.position = 1 then 'immediate' else 'prerequisite_passed' end,
  prerequisite_chapter_id = ordered.previous_id,
  updated_at = now()
from ordered
where ordered.id = chapter.id;

-- 现有韩语初级三单元按最后一个前置章节串联。
alter table public.lessons disable trigger user;

update public.lessons as target
set
  unlock_mode = 'prerequisite_passed',
  prerequisite_lesson_id = source.id,
  prerequisite_chapter_id = final_chapter.id,
  required_score = final_chapter.required_score,
  updated_at = now()
from public.lessons as source
join lateral (
  select chapter.id, chapter.required_score
  from public.course_chapters as chapter
  where chapter.lesson_id = source.id
  order by chapter.sort_order desc, chapter.created_at desc
  limit 1
) as final_chapter on true
where target.course_id = source.course_id
  and (
    (source.slug = 'hangul-introduction' and target.slug = 'basic-pronunciation')
    or (source.slug = 'basic-pronunciation' and target.slug = 'daily-greetings')
  );

alter table public.lessons enable trigger user;

-- 初级、中级、高级课程保持严格等级顺序。
alter table public.courses disable trigger user;

update public.courses as target
set
  unlock_mode = 'prerequisite_completed',
  prerequisite_course_id = source.id,
  updated_at = now()
from public.courses as source
where target.category_id = source.category_id
  and (
    (source.slug = 'korean-beginner' and target.slug = 'korean-intermediate')
    or (source.slug = 'korean-intermediate' and target.slug = 'korean-advanced')
  );

alter table public.courses enable trigger user;

-- 平台课程负责人和平台管理员可读取草稿并维护平台课程；巡检员不获得写权限。
drop policy if exists "platform course managers manage categories" on public.course_categories;
create policy "platform course managers manage categories"
on public.course_categories for all to authenticated
using (content_scope = 'platform' and private.is_platform_course_manager())
with check (content_scope = 'platform' and private.is_platform_course_manager());

drop policy if exists "platform course managers manage courses" on public.courses;
create policy "platform course managers manage courses"
on public.courses for all to authenticated
using (content_scope = 'platform' and private.is_platform_course_manager())
with check (content_scope = 'platform' and private.is_platform_course_manager());

drop policy if exists "platform course managers manage lessons" on public.lessons;
create policy "platform course managers manage lessons"
on public.lessons for all to authenticated
using (content_scope = 'platform' and private.is_platform_course_manager())
with check (content_scope = 'platform' and private.is_platform_course_manager());

drop policy if exists "platform course managers manage lesson resources" on public.lesson_resources;
create policy "platform course managers manage lesson resources"
on public.lesson_resources for all to authenticated
using (content_scope = 'platform' and private.is_platform_course_manager())
with check (content_scope = 'platform' and private.is_platform_course_manager());

alter table public.course_chapters enable row level security;

create policy "authenticated users read published platform course chapters"
on public.course_chapters for select to authenticated
using (content_scope = 'platform' and is_published);

create policy "platform course managers manage chapters"
on public.course_chapters for all to authenticated
using (content_scope = 'platform' and private.is_platform_course_manager())
with check (content_scope = 'platform' and private.is_platform_course_manager());

create policy "tenant members read published course chapters"
on public.course_chapters for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (is_published or (select public.is_admin()))
);

create policy "tenant admins manage course chapters"
on public.course_chapters for all to authenticated
using (tenant_id = (select private.current_tenant_id()) and (select public.is_admin()))
with check (tenant_id = (select private.current_tenant_id()) and (select public.is_admin()));

grant select, insert, update, delete on public.course_chapters to authenticated;

-- 统一租户触发器允许平台课程管理员创建平台课程及章节。
create or replace function private.enforce_tenant_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved uuid;
  row_json jsonb;
  owner_id uuid;
begin
  if tg_op = 'UPDATE' then
    if coalesce(current_setting('app.platform_content_migration', true), '') = 'on' then return new; end if;
    if new.tenant_id is distinct from old.tenant_id then raise exception '不能把数据移动到其他租户'; end if;
    return new;
  end if;

  row_json := to_jsonb(new);
  if private.is_platform_course_manager()
     and tg_table_name in ('course_categories', 'courses', 'lessons', 'lesson_resources', 'course_chapters') then
    new := jsonb_populate_record(new, row_json || jsonb_build_object('tenant_id', null, 'content_scope', 'platform'));
    return new;
  end if;

  if new.tenant_id is null then
    resolved := private.current_tenant_id();
    if resolved is null then
      owner_id := coalesce(
        nullif(row_json->>'user_id', '')::uuid,
        nullif(row_json->>'student_id', '')::uuid,
        nullif(row_json->>'target_user_id', '')::uuid,
        nullif(row_json->>'admin_id', '')::uuid,
        nullif(row_json->>'actor_id', '')::uuid,
        nullif(row_json->>'created_by', '')::uuid
      );
      if owner_id is not null then resolved := private.default_tenant_of(owner_id); end if;
    end if;
    new.tenant_id := resolved;
  end if;
  if new.tenant_id is null then raise exception '缺少租户上下文，拒绝写入'; end if;
  return new;
end;
$$;

drop trigger if exists course_chapters_tenant_scope on public.course_chapters;
create trigger course_chapters_tenant_scope
before insert or update on public.course_chapters
for each row execute function private.enforce_tenant_scope();

comment on table public.course_chapters is '课程学习单元下的正式章节；测试、智能教材和资源均可与章节关联';
comment on column public.course_chapters.completion_rule is '章节完成条件：阅读、提交测试、通过测试或管理员确认';
comment on function private.is_platform_course_manager() is '平台负责人和平台管理员的课程内容写权限；平台课程巡检员始终只读';

commit;
