begin;

do $$
begin
  if exists (
    select 1
    from public.tenants
    where lower(btrim(slug)) = 'platform'
  ) then
    raise exception 'Cannot reserve tenant slug "platform": an existing tenant uses it';
  end if;
end;
$$;

alter table public.tenants
  add constraint tenants_slug_not_platform_check
  check (slug <> 'platform');

create or replace function public.create_tenant(
  requested_name text,
  requested_slug text,
  requested_plan_key text default 'starter'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_tenant_id uuid;
  normalized_slug text := lower(btrim(requested_slug));
begin
  if not private.is_platform_tenant_manager() then
    raise exception '只有负责人或副负责人可以创建租户';
  end if;

  if normalized_slug = 'platform' then
    raise exception 'Tenant slug "platform" is reserved' using errcode = 'P0001';
  end if;

  insert into public.tenants (slug, name, plan_key, created_by)
  values (normalized_slug, btrim(requested_name), requested_plan_key, auth.uid())
  returning id into created_tenant_id;

  return created_tenant_id;
end;
$$;

comment on constraint tenants_slug_not_platform_check on public.tenants is
  'Reserves the platform dashboard namespace for the platform entry point.';

commit;
