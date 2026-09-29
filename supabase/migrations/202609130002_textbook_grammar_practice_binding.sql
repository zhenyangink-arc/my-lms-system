begin;
-- Mirrors textbookGrammarCardSchema. Do not approve malformed/unknown card
-- content merely because it contains a nonempty form or title.
create function private.valid_textbook_grammar_card(p jsonb) returns boolean
 language plpgsql immutable set search_path='' as $$
declare key text; row jsonb;
begin
 if p is null or jsonb_typeof(p) is distinct from 'object' or
 (p-'form'-'function'-'rules'-'examples'-'caution'-'source'-'comparison')<>'{}'::jsonb or
 not (p ?& array['form','function','rules','examples','caution','source']) or
 jsonb_typeof(p->'form') is distinct from 'string' or length(p->>'form') not between 1 and 12000 then return false; end if;
 foreach key in array array['function','caution','source','comparison'] loop
  if key='comparison' and not (p ? key) then continue; end if;
  row:=p->key;
  if jsonb_typeof(row) is distinct from 'object' or (row-'zh-CN'-'ko-KR')<>'{}'::jsonb or
   jsonb_typeof(row->'zh-CN') is distinct from 'string' or jsonb_typeof(row->'ko-KR') is distinct from 'string' or
   length(row->>'zh-CN')>12000 or length(row->>'ko-KR')>12000 then return false; end if;
 end loop;
 if jsonb_typeof(p->'rules') is distinct from 'array' or jsonb_typeof(p->'examples') is distinct from 'array' then return false; end if;
 for row in select value from jsonb_array_elements(p->'rules') loop
  if jsonb_typeof(row) is distinct from 'string' or length(row#>>'{}')>12000 then return false; end if;
 end loop;
 for row in select value from jsonb_array_elements(p->'examples') loop
  if jsonb_typeof(row) is distinct from 'object' or (row-'ko'-'zh'-'audioId'-'audioStatus')<>'{}'::jsonb then return false; end if;
  foreach key in array array['ko','zh','audioId','audioStatus'] loop
   if jsonb_typeof(row->key) is distinct from 'string' or length(row->>key)>12000 then return false; end if;
  end loop;
 end loop;
 return true;
end $$;
revoke all on function private.valid_textbook_grammar_card(jsonb) from public,anon,authenticated,service_role;
-- Existing CAS/row locks and immutable approved snapshot semantics retained.
-- No binding created, no independent library copied, no teaching data changed.
create or replace function public.review_chapter_practice_binding(
  p_app_id uuid, p_chapter_id uuid, p_expected_revision integer,
  p_expected_snapshot jsonb, p_enabled boolean
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  source_version uuid;
  current_snapshot jsonb;
  result_id uuid;
begin
  if auth.uid() is null or not coalesce(private.is_platform_owner(), false) then
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

  perform runtime_publish_private.authoring_lock();
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

  if exists(select 1 from public.digital_textbook_nodes n join public.digital_textbook_modules m on m.id=n.module_id
    where m.chapter_id=p_chapter_id and m.module_code='grammar' and n.content ? 'grammarCards'
    and jsonb_typeof(n.content->'grammarCards') is distinct from 'array') then raise exception '语法卡格式无效，请核对教材来源'; end if;
  if exists(select 1 from public.digital_textbook_nodes n join public.digital_textbook_modules m on m.id=n.module_id
    cross join lateral jsonb_array_elements(case when jsonb_typeof(n.content->'grammarCards')='array' then n.content->'grammarCards' else '[]'::jsonb end)e
    where m.chapter_id=p_chapter_id and m.module_code='grammar' and not private.valid_textbook_grammar_card(e)) then raise exception '语法卡格式无效，请核对教材来源'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('nodeId', items.node_id, 'kind', items.kind, 'value', items.value)
    order by items.node_id, items.kind, items.ordinality), '[]'::jsonb) into current_snapshot
  from (
    select n.id as node_id, m.module_code as kind, elem.value, elem.ordinality
    from public.digital_textbook_nodes n
    join public.digital_textbook_modules m on m.id = n.module_id
    cross join lateral jsonb_array_elements(
      (case when jsonb_typeof(n.content -> m.module_code) = 'array' then n.content -> m.module_code else '[]'::jsonb end)
      || (case when m.module_code='grammar' and jsonb_typeof(n.content->'grammarCards')='array' then n.content->'grammarCards' else '[]'::jsonb end)
    ) with ordinality elem(value, ordinality)
    where m.chapter_id = p_chapter_id and m.module_code in ('vocabulary', 'grammar')
      and jsonb_typeof(elem.value) = 'object'
      and case when m.module_code = 'vocabulary' then
        coalesce(elem.value->>'ko', '') <> '' or coalesce(elem.value->>'zh', '') <> ''
      else coalesce(elem.value->>'title', '') <> '' or coalesce(elem.value->>'form','') <> '' end
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

commit;
