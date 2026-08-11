begin;

-- The production definition depends on helper functions introduced by later
-- historical migrations. Defer body validation without changing the function
-- definition itself so earlier policies can resolve this function by name.
set local check_function_bodies = off;

create or replace function public.is_owner_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select public.is_active_account()
    and (private.is_platform_owner() or public.current_profile_role() = 'tenant_super_admin');
$function$;

commit;
