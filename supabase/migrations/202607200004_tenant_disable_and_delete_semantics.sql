-- 停用与永久删除语义：停用可恢复，删除不可恢复。

begin;

create or replace function public.delete_tenant_permanently(requested_tenant_id uuid, requested_slug_confirmation text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.tenants%rowtype;
  removed_members integer := 0;
begin
  if not exists (
    select 1 from public.profiles as profile
    where profile.id = auth.uid() and profile.role = 'super_admin' and coalesce(profile.status, 'active') = 'active'
  ) then raise exception '只有负责人可以永久删除租户'; end if;

  select * into target from public.tenants where id = requested_tenant_id for update;
  if not found then raise exception '租户不存在'; end if;
  if target.id = '00000000-0000-4000-8000-000000000001'::uuid then raise exception '默认 PUFFY 租户不能永久删除'; end if;
  if target.status not in ('suspended', 'archived') then raise exception '请先停用租户，再执行永久删除'; end if;
  if lower(btrim(requested_slug_confirmation)) <> target.slug then raise exception '删除确认租户标识不正确'; end if;

  perform set_config('app.tenant_hard_delete', 'on', true);
  delete from public.tenant_memberships where tenant_id = target.id;
  get diagnostics removed_members = row_count;
  delete from public.tenant_membership_audit_logs where tenant_id = target.id;
  delete from public.tenants where id = target.id;
  insert into public.tenant_lifecycle_audit_logs (tenant_id, tenant_slug, actor_id, action, details)
  values (target.id, target.slug, auth.uid(), 'permanently_deleted', jsonb_build_object('removed_memberships', removed_members));
end;
$$;

commit;
