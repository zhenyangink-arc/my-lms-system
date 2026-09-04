begin;

-- 之前 Agent 运营中心一次性拉取全部规则共享的 500 条版本记录作为全局上限，
-- 规则多、编辑频繁时会把较早规则的历史和“已删除规则可恢复”入口悄悄挤出去。
-- 改为按规则单独查询版本历史，并单独提供一个轻量的“可恢复的已删除规则”列表。

create or replace function public.list_guide_agent_navigation_rule_versions(
  p_agent_profile_id uuid,
  p_rule_id uuid
)
returns table (
  id uuid,
  rule_id uuid,
  version_number integer,
  snapshot jsonb,
  change_type text,
  source_version_number integer,
  actor_id uuid,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_owner() then
    raise insufficient_privilege using message = 'platform owner required';
  end if;

  return query
  select
    version.id,
    version.rule_id,
    version.version_number,
    version.snapshot,
    version.change_type,
    version.source_version_number,
    version.actor_id,
    version.created_at
  from public.guide_agent_navigation_rule_versions as version
  where version.agent_profile_id = p_agent_profile_id
    and version.rule_id = p_rule_id
  order by version.version_number desc
  limit 200;
end;
$$;

create or replace function public.list_guide_agent_deleted_navigation_rules(
  p_agent_profile_id uuid
)
returns table (
  rule_id uuid,
  name text,
  last_version_number integer,
  deleted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_owner() then
    raise insufficient_privilege using message = 'platform owner required';
  end if;

  return query
  select distinct on (version.rule_id)
    version.rule_id,
    coalesce(nullif(btrim(version.snapshot ->> 'name'), ''), '未命名规则') as name,
    version.version_number as last_version_number,
    version.created_at as deleted_at
  from public.guide_agent_navigation_rule_versions as version
  where version.agent_profile_id = p_agent_profile_id
    and not exists (
      select 1 from public.guide_agent_navigation_rules as rule
      where rule.id = version.rule_id
    )
  order by version.rule_id, version.version_number desc;
end;
$$;

revoke all on function public.list_guide_agent_navigation_rule_versions(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.list_guide_agent_deleted_navigation_rules(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.list_guide_agent_navigation_rule_versions(uuid, uuid)
  to authenticated;
grant execute on function public.list_guide_agent_deleted_navigation_rules(uuid)
  to authenticated;

comment on function public.list_guide_agent_navigation_rule_versions(uuid, uuid) is
  '按规则查询导航规则的版本历史，取代此前跨规则共享的全局 500 条上限查询。';
comment on function public.list_guide_agent_deleted_navigation_rules(uuid) is
  '列出已删除但仍可从版本历史恢复的导航规则，只返回每条规则的最新一次版本记录。';

commit;
