begin;

-- Tenant slugs share the root namespace with Next.js static routes. Keep every
-- static entry point unavailable to tenants so route resolution is deterministic.
do $$
declare
  conflicting_slug text;
begin
  select slug into conflicting_slug
  from public.tenants
  where lower(btrim(slug)) = any(array[
    'platform', 'dashboard', 'login', 'register', 'api',
    'access-denied', 'account-disabled', 'dev-preview'
  ])
  limit 1;

  if conflicting_slug is not null then
    raise exception 'Cannot reserve route namespace: tenant slug "%" already exists', conflicting_slug;
  end if;
end;
$$;

alter table public.tenants
  drop constraint if exists tenants_slug_not_platform_check;

alter table public.tenants
  drop constraint if exists tenants_slug_not_route_namespace_check;

alter table public.tenants
  add constraint tenants_slug_not_route_namespace_check
  check (
    not (lower(btrim(slug)) = any(array[
      'platform', 'dashboard', 'login', 'register', 'api',
      'access-denied', 'account-disabled', 'dev-preview'
    ]))
  );

comment on constraint tenants_slug_not_route_namespace_check on public.tenants is
  'Reserves every static root route so tenant slugs cannot shadow platform, authentication, API, or dashboard entry points.';

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

  if normalized_slug = any(array[
    'platform', 'dashboard', 'login', 'register', 'api',
    'access-denied', 'account-disabled', 'dev-preview'
  ]) then
    raise exception 'Tenant slug "%" is reserved', normalized_slug using errcode = 'P0001';
  end if;

  insert into public.tenants (slug, name, plan_key, created_by)
  values (normalized_slug, btrim(requested_name), requested_plan_key, auth.uid())
  returning id into created_tenant_id;

  return created_tenant_id;
end;
$$;

-- Supabase-created functions and older dashboard tables retained client-role
-- grants. RLS rejected most misuse, but authorization must also fail at the
-- privilege boundary. Only authenticated callers may execute management RPCs;
-- table mutations continue through checked RPCs or server-side service flows.
revoke execute on function public.create_tenant(text, text, text) from public, anon;
revoke execute on function public.delete_managed_account(uuid, text, text) from public, anon;
revoke execute on function public.delete_tenant_permanently(uuid, text) from public, anon;
revoke execute on function public.grant_question_bank_admin(uuid) from public, anon;
revoke execute on function public.revoke_question_bank_admin(uuid) from public, anon;
revoke execute on function public.set_default_tenant(uuid) from public, anon;
revoke execute on function public.set_tenant_lifecycle_status(uuid, text) from public, anon;
revoke execute on function public.set_user_permission_grant(uuid, text, uuid, boolean) from public, anon;
revoke execute on function public.set_student_application_enrollment(uuid, uuid, text) from public, anon;
revoke execute on function public.set_staff_application_access(uuid, uuid, text, text) from public, anon;
revoke execute on function public.set_application_teacher_assignment(uuid, uuid, uuid, text) from public, anon;
revoke execute on function public.set_tenant_application_settings(uuid, boolean, text, text) from public, anon;

grant execute on function public.create_tenant(text, text, text) to authenticated, service_role;
grant execute on function public.delete_managed_account(uuid, text, text) to authenticated, service_role;
grant execute on function public.delete_tenant_permanently(uuid, text) to authenticated, service_role;
grant execute on function public.grant_question_bank_admin(uuid) to authenticated, service_role;
grant execute on function public.revoke_question_bank_admin(uuid) to authenticated, service_role;
grant execute on function public.set_default_tenant(uuid) to authenticated, service_role;
grant execute on function public.set_tenant_lifecycle_status(uuid, text) to authenticated, service_role;
grant execute on function public.set_user_permission_grant(uuid, text, uuid, boolean) to authenticated, service_role;
grant execute on function public.set_student_application_enrollment(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.set_staff_application_access(uuid, uuid, text, text) to authenticated, service_role;
grant execute on function public.set_application_teacher_assignment(uuid, uuid, uuid, text) to authenticated, service_role;
grant execute on function public.set_tenant_application_settings(uuid, boolean, text, text) to authenticated, service_role;

revoke insert, update, delete, truncate, references, trigger
  on public.tenant_student_apps
  from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.tenant_student_assignments
  from anon, authenticated;
revoke select on public.tenant_student_apps, public.tenant_student_assignments from anon;
grant select on public.tenant_student_apps, public.tenant_student_assignments to authenticated;

commit;
