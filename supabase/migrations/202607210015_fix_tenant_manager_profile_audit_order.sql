-- Auth creates the profiles row before the application can assign the new account to a tenant.
-- Account audit rows require tenant_id, so defer profile auditing until a default membership exists.
begin;

drop trigger if exists profiles_audit_management_change on public.profiles;
create trigger profiles_audit_management_change
after insert or update on public.profiles
for each row
when (private.default_tenant_of(new.id) is not null)
execute function public.audit_profile_management_change();

comment on trigger profiles_audit_management_change on public.profiles is
  'Audit profile changes only after the account has a default tenant, so Auth provisioning cannot be rolled back by a missing tenant_id';

commit;
