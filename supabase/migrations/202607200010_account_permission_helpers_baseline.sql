begin;

-- This local-reset baseline sits immediately before the tenant-scope migrations.
-- These production definitions depend on helpers completed by later historical
-- migrations. Defer body validation without changing the functions themselves.
set local check_function_bodies = off;

create or replace function private.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.global_role = 'platform_owner'
      and profile.role = 'platform_super_admin'
      and coalesce(profile.status, 'active') = 'active'
  );
$function$;

create or replace function public.is_active_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select public.current_profile_status() = 'active';
$function$;

create or replace function public.is_executive_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select public.is_active_account()
    and (private.is_platform_owner() or public.current_profile_role() in ('tenant_super_admin', 'ceo'));
$function$;

create or replace function public.is_admin_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select public.is_active_account()
    and (private.is_platform_owner() or public.current_profile_role() in ('tenant_super_admin', 'ceo', 'admin'));
$function$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $function$
  select public.is_admin_account()
$function$;

commit;
