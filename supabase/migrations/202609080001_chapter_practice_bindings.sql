begin;

-- Historical independent libraries are deliberately not backfilled or overwritten.
create table public.chapter_practice_bindings (
  id uuid primary key default gen_random_uuid(),
  student_app_id uuid not null references public.student_apps(id),
  -- Preserve provenance if source authoring rows are later deleted. RPCs validate the hierarchy.
  chapter_id uuid not null,
  version_id uuid not null,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'array'),
  revision integer not null default 1 check (revision > 0),
  is_enabled boolean not null default true,
  reviewed_at timestamptz not null default now(),
  reviewed_by uuid not null,
  unique (student_app_id, chapter_id)
);
alter table public.chapter_practice_bindings enable row level security;
revoke all on public.chapter_practice_bindings from anon, authenticated;
grant select on public.chapter_practice_bindings to authenticated;
create policy "standard content managers inspect practice bindings"
on public.chapter_practice_bindings for select to authenticated
using (public.current_user_can_manage_standard_question_bank());

create function public.review_chapter_practice_binding(
  p_app_id uuid, p_chapter_id uuid, p_expected_revision integer,
  p_expected_snapshot jsonb, p_enabled boolean
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  source_version uuid;
  current_snapshot jsonb;
  result_id uuid;
begin
  if auth.uid() is null or not coalesce(public.current_user_can_manage_standard_question_bank(), false) then
    raise exception '没有权限维护教材练习关联';
  end if;
  if p_enabled is null or p_expected_revision is null or p_expected_revision < 0 then
    raise exception '无效的复核请求';
  end if;
  if not p_enabled then
    update public.chapter_practice_bindings set is_enabled = false,
      revision = revision + 1, reviewed_at = now(), reviewed_by = auth.uid()
    where student_app_id = p_app_id and chapter_id = p_chapter_id and revision = p_expected_revision
    returning id into result_id;
    if result_id is null then raise exception '关联已被修改，请刷新后重新核对'; end if;
    return result_id;
  end if;

  -- Lock authoring rows so an in-place edit cannot slip between comparison and approval.
  select v.id into source_version
  from public.digital_textbook_chapters c
  join public.digital_textbook_versions v on v.id = c.version_id
  join public.digital_textbooks t on t.id = v.textbook_id
  where c.id = p_chapter_id and t.student_app_id = p_app_id
    and c.status = 'published' and v.status = 'published' and t.status = 'published'
  for share of c, v, t;
  if source_version is null then raise exception '只能关联当前应用已发布的教材章节'; end if;
  perform m.id from public.digital_textbook_modules m where m.chapter_id = p_chapter_id for share;
  perform n.id from public.digital_textbook_nodes n
    join public.digital_textbook_modules m on m.id = n.module_id
    where m.chapter_id = p_chapter_id for share of n;

  select coalesce(jsonb_agg(jsonb_build_object('nodeId', items.node_id, 'kind', items.kind, 'value', items.value)
    order by items.node_id, items.kind, items.ordinality), '[]'::jsonb) into current_snapshot
  from (
    select n.id as node_id, m.module_code as kind, elem.value, elem.ordinality
    from public.digital_textbook_nodes n
    join public.digital_textbook_modules m on m.id = n.module_id
    cross join lateral jsonb_array_elements(case when jsonb_typeof(n.content -> m.module_code) = 'array'
      then n.content -> m.module_code else '[]'::jsonb end) with ordinality elem(value, ordinality)
    where m.chapter_id = p_chapter_id and m.module_code in ('vocabulary', 'grammar')
      and jsonb_typeof(elem.value) = 'object'
      and case when m.module_code = 'vocabulary' then
        coalesce(elem.value->>'ko', '') <> '' or coalesce(elem.value->>'zh', '') <> ''
      else coalesce(elem.value->>'title', '') <> '' end
  ) items;
  if current_snapshot = '[]'::jsonb or current_snapshot is distinct from p_expected_snapshot then
    raise exception '教材内容已变化或为空，请刷新并重新核对后再确认';
  end if;
  if p_expected_revision = 0 then
    insert into public.chapter_practice_bindings (student_app_id, chapter_id, version_id, snapshot, reviewed_by)
    values (p_app_id, p_chapter_id, source_version, current_snapshot, auth.uid())
    on conflict (student_app_id, chapter_id) do nothing returning id into result_id;
  else
    update public.chapter_practice_bindings set snapshot = current_snapshot, version_id = source_version,
      is_enabled = true, revision = revision + 1, reviewed_at = now(), reviewed_by = auth.uid()
    where student_app_id = p_app_id and chapter_id = p_chapter_id and revision = p_expected_revision
    returning id into result_id;
  end if;
  if result_id is null then raise exception '关联已被修改，请刷新后重新核对'; end if;
  return result_id;
end;
$$;
revoke all on function public.review_chapter_practice_binding(uuid, uuid, integer, jsonb, boolean) from public;
grant execute on function public.review_chapter_practice_binding(uuid, uuid, integer, jsonb, boolean) to authenticated;

-- Student reads use approved snapshots, never live mutable authoring content.
create function public.read_chapter_practice_snapshots(p_app_id uuid)
returns table (chapter_id uuid, version_id uuid, lesson_id uuid, chapter_test_id uuid, snapshot jsonb)
language sql stable security definer set search_path = '' as $$
  select b.chapter_id, b.version_id, t.lesson_id, c.chapter_test_id, b.snapshot from public.chapter_practice_bindings b
  join public.digital_textbook_chapters c on c.id = b.chapter_id and c.version_id = b.version_id
  join public.digital_textbook_versions v on v.id = c.version_id
  join public.digital_textbooks t on t.id = v.textbook_id and t.student_app_id = b.student_app_id
  where auth.uid() is not null and private.current_user_can_read_student_app(p_app_id)
    and b.student_app_id = p_app_id and b.is_enabled
    and c.status = 'published' and v.status = 'published' and t.status = 'published'
  order by b.chapter_id;
$$;
revoke all on function public.read_chapter_practice_snapshots(uuid) from public;
grant execute on function public.read_chapter_practice_snapshots(uuid) to authenticated;
commit;
