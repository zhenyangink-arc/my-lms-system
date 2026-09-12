begin;

create table public.teaching_script_source_reviews (
  script_version_id uuid primary key references public.learning_agent_script_versions(id) on delete cascade,
  source_snapshot jsonb not null,
  script_token text not null,
  revision integer not null check (revision > 0),
  reviewed_by uuid not null,
  reviewed_at timestamptz not null default now()
);
alter table public.teaching_script_source_reviews enable row level security;
revoke all on public.teaching_script_source_reviews from anon, authenticated;

create function private.teaching_script_source_snapshot(p_version_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'textbookVersionId', c.version_id, 'chapterId', c.id,
    'module', to_jsonb(m) - 'created_at' - 'updated_at',
    'nodes', coalesce((select jsonb_agg(to_jsonb(n) - 'created_at' - 'updated_at' order by n.id)
      from public.digital_textbook_nodes n where n.module_id = m.id), '[]'::jsonb),
    'activities', coalesce((select jsonb_agg(to_jsonb(a) - 'created_at' - 'updated_at' order by a.id)
      from public.digital_textbook_activities a join public.digital_textbook_nodes n on n.id = a.node_id
      where n.module_id = m.id), '[]'::jsonb),
    'activityAnswers', coalesce((select jsonb_agg(to_jsonb(s) - 'created_at' - 'updated_at' order by s.activity_id)
      from public.digital_textbook_activity_secrets s join public.digital_textbook_activities a on a.id = s.activity_id
      join public.digital_textbook_nodes n on n.id = a.node_id where n.module_id = m.id), '[]'::jsonb)
  ) from public.learning_agent_script_versions v
  join public.learning_agent_lessons l on l.id = v.lesson_id
  join public.digital_textbook_modules m on m.id = l.module_id
  join public.digital_textbook_chapters c on c.id = m.chapter_id where v.id = p_version_id;
$$;

create function private.teaching_script_review_token(p_version_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select md5(jsonb_build_object('id', v.id, 'lessonId', v.lesson_id, 'title', v.title,
    'nodes', (select jsonb_agg(to_jsonb(n) order by n.id) from public.learning_agent_script_nodes n where n.script_version_id = v.id),
    'answers', (select jsonb_agg(to_jsonb(s) order by s.node_id) from public.learning_agent_node_interaction_secrets s
      join public.learning_agent_script_nodes n on n.id = s.node_id where n.script_version_id = v.id))::text)
  from public.learning_agent_script_versions v where v.id = p_version_id;
$$;
revoke all on function private.teaching_script_source_snapshot(uuid) from public, anon, authenticated;
revoke all on function private.teaching_script_review_token(uuid) from public, anon, authenticated;

create function public.get_teaching_script_source_review(p_version_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_source jsonb; current_token text; previous public.teaching_script_source_reviews;
begin
  if auth.uid() is null or not coalesce(private.is_platform_owner(), false) then raise exception '只有平台负责人可以复核教学脚本'; end if;
  current_source := private.teaching_script_source_snapshot(p_version_id);
  current_token := private.teaching_script_review_token(p_version_id);
  if current_source is null or current_token is null then raise exception '脚本或教材来源不存在'; end if;
  select * into previous from public.teaching_script_source_reviews where script_version_id = p_version_id;
  return jsonb_build_object('source', current_source, 'scriptToken', current_token,
    'previousSource', previous.source_snapshot, 'revision', coalesce(previous.revision, 0),
    'reviewedAt', previous.reviewed_at, 'sourceChanged', previous.source_snapshot is distinct from current_source,
    'scriptChanged', previous.script_token is distinct from current_token,
    'status', case when previous.script_version_id is null then 'unreviewed'
      when previous.source_snapshot is distinct from current_source or previous.script_token is distinct from current_token then 'changed' else 'reviewed' end);
end;
$$;

create function public.confirm_teaching_script_source_review(p_version_id uuid, p_revision integer, p_source jsonb, p_script_token text)
returns void language plpgsql security definer set search_path = '' as $$
declare current_source jsonb; current_token text; saved uuid;
begin
  if auth.uid() is null or not coalesce(private.is_platform_owner(), false) then raise exception '只有平台负责人可以复核教学脚本'; end if;
  if p_revision is null or p_revision < 0 then raise exception '无效的复核版本'; end if;
  lock table public.learning_agent_script_nodes, public.learning_agent_node_interaction_secrets in share row exclusive mode;
  lock table public.digital_textbook_modules, public.digital_textbook_nodes, public.digital_textbook_activities, public.digital_textbook_activity_secrets in share mode;
  perform 1 from public.learning_agent_script_versions where id = p_version_id and status in ('draft', 'published') for update;
  if not found then raise exception '只能复核草稿或已发布脚本'; end if;
  current_source := private.teaching_script_source_snapshot(p_version_id);
  current_token := private.teaching_script_review_token(p_version_id);
  if current_source is null or p_source is distinct from current_source or p_script_token is distinct from current_token then
    raise exception '核对期间教材或脚本已变化，请刷新后重新复核';
  end if;
  if p_revision = 0 then
    insert into public.teaching_script_source_reviews(script_version_id, source_snapshot, script_token, revision, reviewed_by)
    values(p_version_id, current_source, current_token, 1, auth.uid())
    on conflict do nothing returning script_version_id into saved;
  else
    update public.teaching_script_source_reviews set source_snapshot = current_source, script_token = current_token,
      revision = revision + 1, reviewed_by = auth.uid(), reviewed_at = now()
    where script_version_id = p_version_id and revision = p_revision returning script_version_id into saved;
  end if;
  if saved is null then raise exception '复核记录已被更新，请刷新后重试'; end if;
end;
$$;

create function private.require_teaching_script_source_review()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    lock table public.digital_textbook_modules, public.digital_textbook_nodes, public.digital_textbook_activities, public.digital_textbook_activity_secrets in share mode;
    if not exists (select 1 from public.teaching_script_source_reviews r where r.script_version_id = old.id
      and r.source_snapshot = private.teaching_script_source_snapshot(old.id)
      and r.script_token = private.teaching_script_review_token(old.id)) then
      raise exception '教材或脚本尚未复核，或复核后已变化，请先完成教材与脚本复核';
    end if;
  end if;
  return new;
end;
$$;
create trigger teaching_script_source_review_before_publish before update of status
on public.learning_agent_script_versions for each row execute function private.require_teaching_script_source_review();
revoke all on function private.require_teaching_script_source_review() from public, anon, authenticated;
revoke all on function public.get_teaching_script_source_review(uuid) from public, anon;
revoke all on function public.confirm_teaching_script_source_review(uuid, integer, jsonb, text) from public, anon;
grant execute on function public.get_teaching_script_source_review(uuid) to authenticated;
grant execute on function public.confirm_teaching_script_source_review(uuid, integer, jsonb, text) to authenticated;
create function public.list_teaching_script_source_review_status(p_app_id uuid)
returns table (script_version_id uuid, review_status text)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not coalesce(private.is_platform_owner(), false) then raise exception '只有平台负责人可以复核教学脚本'; end if;
  return query select v.id, case when r.script_version_id is null then 'unreviewed'
    when r.source_snapshot is distinct from private.teaching_script_source_snapshot(v.id)
      or r.script_token is distinct from private.teaching_script_review_token(v.id) then 'changed' else 'reviewed' end
  from public.learning_agent_script_versions v
  join public.learning_agent_lessons l on l.id = v.lesson_id
  join public.digital_textbook_modules m on m.id = l.module_id
  join public.digital_textbook_chapters c on c.id = m.chapter_id
  join public.digital_textbook_versions tv on tv.id = c.version_id
  join public.digital_textbooks t on t.id = tv.textbook_id
  left join public.teaching_script_source_reviews r on r.script_version_id = v.id
  where t.student_app_id = p_app_id and v.status in ('draft', 'published');
end;
$$;
revoke all on function public.list_teaching_script_source_review_status(uuid) from public, anon;
grant execute on function public.list_teaching_script_source_review_status(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
