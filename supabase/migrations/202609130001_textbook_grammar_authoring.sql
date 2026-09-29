begin;

-- No backfill/identity allocation, no content seed, no learner data changes.
-- Captured by the existing SELECT to_jsonb(node) dependency capture. The existing
-- node dependency fence covers this column too; it is NOT an audit exemption.
alter table public.digital_textbook_nodes add column authoring_grammar_identities jsonb not null default '[]'::jsonb
  check (jsonb_typeof(authoring_grammar_identities) = 'array');

-- An absent/empty identity override has exactly the frozen-v1 meaning. Only
-- that default is normalized; nonempty overrides remain semantic dependencies.
create or replace function runtime_publish_private.semantic_capture(p_capture jsonb) returns jsonb
 language plpgsql immutable set search_path='' as $$
declare result jsonb:=p_capture; name text; rows jsonb;
begin
 foreach name in array array['digital_textbooks','digital_textbook_versions','digital_textbook_chapters','chapter_tests'] loop
  select coalesce(jsonb_agg(r-'updated_at' order by (r-'updated_at')::text),'[]'::jsonb) into rows from jsonb_array_elements(p_capture->name) r;
  result:=jsonb_set(result,array[name],rows);
 end loop;
 select coalesce(jsonb_agg(r order by r::text),'[]'::jsonb) into rows from (
  select case when e->'authoring_grammar_identities'='[]'::jsonb then e-'authoring_grammar_identities' else e end r
  from jsonb_array_elements(p_capture->'digital_textbook_nodes') e
 ) normalized;
 return jsonb_set(result,'{digital_textbook_nodes}',rows);
end $$;

create function public.edit_runtime_grammar_card_v1(
 p_actor uuid, p_scope jsonb, p_node uuid, p_expected_content jsonb,
 p_expected_identities jsonb, p_old_card jsonb, p_patch jsonb, p_identities jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare n public.digital_textbook_nodes%rowtype; next_cards jsonb; matches integer;
begin
 perform runtime_publish_private.owner_guard(p_actor);
 perform runtime_publish_private.authoring_lock();
 if not exists(select 1 from runtime_publish_private.authoring_control where textbook_id=(p_scope->>'textbookId')::uuid and state='editing') then raise exception 'EDIT_WINDOW_REQUIRED'; end if;
 select node.* into n from public.digital_textbook_nodes node
 join public.digital_textbook_modules m on m.id=node.module_id
 join public.digital_textbook_chapters c on c.id=m.chapter_id
 join public.digital_textbook_versions v on v.id=c.version_id
 where node.id=p_node and m.module_code='grammar' and c.id=(p_scope->>'chapterId')::uuid
 and v.id=(p_scope->>'versionId')::uuid and v.textbook_id=(p_scope->>'textbookId')::uuid for update of node;
 if not found or n.content is distinct from p_expected_content or n.authoring_grammar_identities is distinct from p_expected_identities then raise exception 'GRAMMAR_EDIT_CONFLICT'; end if;
 if jsonb_typeof(n.content->'grammarCards') is distinct from 'array' or n.content ? 'grammar' then raise exception 'GRAMMAR_FORMAT_CONFLICT'; end if;
 if p_patch is null or jsonb_typeof(p_patch) is distinct from 'object' or (p_patch-'form'-'function'-'caution'-'source')<>'{}'::jsonb
 or not (p_patch ?& array['form','function','caution','source']) or jsonb_typeof(p_patch->'form') is distinct from 'string' or length(btrim(p_patch->>'form'))=0 then raise exception 'GRAMMAR_EDIT_FIELDS'; end if;
 if exists(select 1 from jsonb_each(p_patch-'form') e where jsonb_typeof(e.value) is distinct from 'object'
 or (e.value-'zh-CN'-'ko-KR')<>'{}'::jsonb or jsonb_typeof(e.value->'zh-CN') is distinct from 'string' or jsonb_typeof(e.value->'ko-KR') is distinct from 'string') then raise exception 'GRAMMAR_EDIT_LOCALE'; end if;
 if p_identities is null or jsonb_typeof(p_identities) is distinct from 'array' then raise exception 'GRAMMAR_IDENTITY_SHAPE'; end if;
 if exists(select 1 from jsonb_array_elements(p_identities) e where jsonb_typeof(e) is distinct from 'object' or (e-'id'-'fingerprint')<>'{}'::jsonb
 or coalesce(e->>'id','') !~ '^[a-f0-9-]{36}$' or coalesce(e->>'fingerprint','') !~ '^[a-f0-9]{64}$')
 or (select count(*)<>count(distinct e->>'id') from jsonb_array_elements(p_identities)e) then raise exception 'GRAMMAR_IDENTITY_SHAPE'; end if;
 select count(*) into matches from jsonb_array_elements(n.content->'grammarCards') e where e=p_old_card;
 if matches<>1 then raise exception 'GRAMMAR_CARD_AMBIGUOUS'; end if;
 select jsonb_agg(case when e=p_old_card then e||p_patch else e end order by ord) into next_cards
 from jsonb_array_elements(n.content->'grammarCards') with ordinality a(e,ord);
 update public.digital_textbook_nodes set content=jsonb_set(n.content,'{grammarCards}',next_cards),authoring_grammar_identities=p_identities where id=p_node;
 return jsonb_build_object('saved',true);
end $$;
revoke all on function public.edit_runtime_grammar_card_v1(uuid,jsonb,uuid,jsonb,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.edit_runtime_grammar_card_v1(uuid,jsonb,uuid,jsonb,jsonb,jsonb,jsonb,jsonb) to service_role;
commit;
