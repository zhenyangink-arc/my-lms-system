begin;

-- 韩国语巩固中心的版本化章节内容。巩固包直接归属于正式课程章节，
-- 内容块只保存公开内容与来源引用；学生进度和答题事实由后续迁移另行建立。
create table if not exists public.chapter_practice_units (
  id uuid primary key default gen_random_uuid(),
  student_app_id uuid not null
    references public.student_apps(id) on delete restrict,
  course_chapter_id uuid not null
    references public.course_chapters(id) on delete cascade,
  source_textbook_chapter_id uuid
    references public.digital_textbook_chapters(id) on delete set null,
  version integer not null default 1 check (version > 0),
  status text not null default 'not_generated' check (
    status in (
      'not_generated',
      'draft',
      'pending_review',
      'published',
      'needs_update',
      'disabled'
    )
  ),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  completion_rule jsonb not null default '{}'::jsonb check (
    jsonb_typeof(completion_rule) = 'object'
  ),
  source_snapshot jsonb not null default '{}'::jsonb check (
    jsonb_typeof(source_snapshot) = 'object'
  ),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chapter_practice_units_published_at_check check (
    status <> 'published' or published_at is not null
  ),
  unique (course_chapter_id, version)
);

create table if not exists public.chapter_practice_blocks (
  id uuid primary key default gen_random_uuid(),
  practice_unit_id uuid not null
    references public.chapter_practice_units(id) on delete cascade,
  block_type text not null check (
    block_type in (
      'overview',
      'vocabulary',
      'grammar',
      'comparison',
      'listening',
      'speaking',
      'reading',
      'writing',
      'interaction',
      'review',
      'self_check'
    )
  ),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  instructions text not null default '' check (
    char_length(instructions) <= 4000
  ),
  content_payload jsonb not null default '{}'::jsonb check (
    jsonb_typeof(content_payload) = 'object'
  ),
  source_type text,
  source_id uuid,
  sort_order integer not null default 0 check (
    sort_order between 0 and 100000
  ),
  is_required boolean not null default true,
  status text not null default 'draft' check (
    status in (
      'not_generated',
      'draft',
      'pending_review',
      'published',
      'needs_update',
      'disabled'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chapter_practice_blocks_source_reference_check check (
    (source_type is null and source_id is null)
    or (
      nullif(btrim(source_type), '') is not null
      and source_id is not null
    )
  ),
  unique (practice_unit_id, sort_order)
);

create index if not exists chapter_practice_units_app_status_idx
  on public.chapter_practice_units (
    student_app_id,
    status,
    course_chapter_id,
    version desc
  );
create index if not exists chapter_practice_units_textbook_chapter_idx
  on public.chapter_practice_units (source_textbook_chapter_id)
  where source_textbook_chapter_id is not null;
create index if not exists chapter_practice_blocks_source_idx
  on public.chapter_practice_blocks (source_type, source_id)
  where source_id is not null;

-- 已发布版本可切换为需更新或已停用，但其内容与来源快照保持不可变。
-- 新内容必须写入同一课程章节的更高 version，避免改变历史学习依据。
create or replace function private.protect_published_chapter_practice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_published_at timestamptz;
begin
  if tg_table_name = 'chapter_practice_units' then
    if old.published_at is null then
      if tg_op = 'DELETE' then
        return old;
      end if;
      return new;
    end if;

    if tg_op = 'DELETE' then
      raise exception '已发布巩固包不可删除，请停用旧版本并创建新版本';
    end if;

    if new.student_app_id is distinct from old.student_app_id
      or new.course_chapter_id is distinct from old.course_chapter_id
      or new.source_textbook_chapter_id is distinct from old.source_textbook_chapter_id
      or new.version is distinct from old.version
      or new.title is distinct from old.title
      or new.completion_rule is distinct from old.completion_rule
      or new.source_snapshot is distinct from old.source_snapshot
      or new.published_at is distinct from old.published_at then
      raise exception '已发布巩固包内容不可覆盖，请创建新版本';
    end if;

    return new;
  end if;

  if tg_op = 'INSERT' then
    select practice_unit.published_at
    into v_published_at
    from public.chapter_practice_units as practice_unit
    where practice_unit.id = new.practice_unit_id;

    if v_published_at is not null then
      raise exception '已发布巩固包的内容块不可变更，请创建新版本';
    end if;

    return new;
  end if;

  select practice_unit.published_at
  into v_published_at
  from public.chapter_practice_units as practice_unit
  where practice_unit.id = old.practice_unit_id;

  if v_published_at is not null then
    raise exception '已发布巩固包的内容块不可变更，请创建新版本';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.practice_unit_id is distinct from old.practice_unit_id then
    select practice_unit.published_at
    into v_published_at
    from public.chapter_practice_units as practice_unit
    where practice_unit.id = new.practice_unit_id;

    if v_published_at is not null then
      raise exception '已发布巩固包的内容块不可变更，请创建新版本';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.protect_published_chapter_practice()
  from public;

drop trigger if exists chapter_practice_units_set_updated_at
  on public.chapter_practice_units;
create trigger chapter_practice_units_set_updated_at
before update on public.chapter_practice_units
for each row execute function private.set_updated_at();

drop trigger if exists chapter_practice_blocks_set_updated_at
  on public.chapter_practice_blocks;
create trigger chapter_practice_blocks_set_updated_at
before update on public.chapter_practice_blocks
for each row execute function private.set_updated_at();

drop trigger if exists chapter_practice_units_protect_published
  on public.chapter_practice_units;
create trigger chapter_practice_units_protect_published
before update or delete on public.chapter_practice_units
for each row execute function private.protect_published_chapter_practice();

drop trigger if exists chapter_practice_blocks_protect_published
  on public.chapter_practice_blocks;
create trigger chapter_practice_blocks_protect_published
before insert or update or delete on public.chapter_practice_blocks
for each row execute function private.protect_published_chapter_practice();

alter table public.chapter_practice_units enable row level security;
alter table public.chapter_practice_blocks enable row level security;

-- 与课程目录和互动教材相同：只有当前租户已开通应用且账号具备实时访问权时，
-- 学生、机构负责人和老师才能读取已发布内容；平台负责人可查看所有状态。
create policy "authorized users read published chapter practice units"
on public.chapter_practice_units for select to authenticated
using (
  (select private.is_platform_owner())
  or (
    status = 'published'
    and exists (
      select 1
      from public.course_chapters as chapter
      join public.lessons as lesson on lesson.id = chapter.lesson_id
      join public.courses as course on course.id = lesson.course_id
      where chapter.id = chapter_practice_units.course_chapter_id
        and chapter.is_published
        and lesson.is_published
        and course.is_published
        and course.student_app_id = chapter_practice_units.student_app_id
        and private.current_user_can_read_student_app(course.student_app_id)
    )
  )
);

create policy "platform owner manages chapter practice units"
on public.chapter_practice_units for all to authenticated
using ((select private.is_platform_owner()))
with check (
  (select private.is_platform_owner())
  and exists (
    select 1
    from public.course_chapters as chapter
    join public.lessons as lesson on lesson.id = chapter.lesson_id
    join public.courses as course on course.id = lesson.course_id
    where chapter.id = chapter_practice_units.course_chapter_id
      and course.student_app_id = chapter_practice_units.student_app_id
  )
);

create policy "authorized users read published chapter practice blocks"
on public.chapter_practice_blocks for select to authenticated
using (
  (select private.is_platform_owner())
  or (
    status = 'published'
    and exists (
      select 1
      from public.chapter_practice_units as practice_unit
      join public.course_chapters as chapter
        on chapter.id = practice_unit.course_chapter_id
      join public.lessons as lesson on lesson.id = chapter.lesson_id
      join public.courses as course on course.id = lesson.course_id
      where practice_unit.id = chapter_practice_blocks.practice_unit_id
        and practice_unit.status = 'published'
        and chapter.is_published
        and lesson.is_published
        and course.is_published
        and course.student_app_id = practice_unit.student_app_id
        and private.current_user_can_read_student_app(course.student_app_id)
    )
  )
);

create policy "platform owner manages chapter practice blocks"
on public.chapter_practice_blocks for all to authenticated
using ((select private.is_platform_owner()))
with check ((select private.is_platform_owner()));

grant select, insert, update, delete
  on public.chapter_practice_units, public.chapter_practice_blocks
  to authenticated;
grant all
  on public.chapter_practice_units, public.chapter_practice_blocks
  to service_role;

comment on table public.chapter_practice_units is
  '课程章节的版本化巩固包；发布内容通过新版本更新，不覆盖历史版本';
comment on column public.chapter_practice_units.status is
  '状态：not_generated 未生成，draft 草稿，pending_review 待检查，published 已发布，needs_update 需更新，disabled 已停用';
comment on column public.chapter_practice_units.completion_rule is
  '完成规则对象，由后续巩固业务按版本解释';
comment on column public.chapter_practice_units.source_snapshot is
  '生成该版本时使用的教材、词汇、语法、练习和听力等来源快照';
comment on table public.chapter_practice_blocks is
  '章节巩固包内按顺序展示的公开内容块';
comment on column public.chapter_practice_blocks.status is
  '状态：not_generated 未生成，draft 草稿，pending_review 待检查，published 已发布，needs_update 需更新，disabled 已停用';
comment on column public.chapter_practice_blocks.content_payload is
  '按 block_type 保存的结构化公开内容对象';
comment on column public.chapter_practice_blocks.source_type is
  '多态来源类型；与 source_id 一起指向现有词汇、语法、练习、听力等来源表';
comment on column public.chapter_practice_blocks.source_id is
  '多态来源记录 UUID；由 source_type 确定目标来源表';
comment on function private.protect_published_chapter_practice() is
  '保护已发布巩固版本及内容块不可覆盖或删除，同时允许将巩固包标记为需更新或已停用';

commit;
