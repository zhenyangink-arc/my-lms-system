-- 平台副负责人：仅管理租户，不获得课程、学生或其他平台模块权限。
begin;

create or replace function private.is_platform_tenant_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles as profile
    where profile.id = auth.uid()
      and coalesce(profile.status, 'active') = 'active'
      and profile.role in ('super_admin', 'tenant_operator')
  );
$$;

create or replace function public.create_tenant(requested_name text, requested_slug text, requested_plan_key text default 'starter')
returns uuid language plpgsql security definer set search_path = '' as $$
declare created_tenant_id uuid;
begin
  if not private.is_platform_tenant_manager() then raise exception '只有负责人或副负责人可以创建租户'; end if;
  insert into public.tenants (slug, name, plan_key, created_by)
  values (lower(btrim(requested_slug)), btrim(requested_name), requested_plan_key, auth.uid())
  returning id into created_tenant_id;
  insert into public.tenant_memberships (tenant_id, user_id, role, status, membership_tier, is_default, joined_at)
  values (created_tenant_id, auth.uid(), 'super_admin', 'active', 'normal', false, now());
  return created_tenant_id;
end;
$$;

create or replace function public.set_tenant_lifecycle_status(requested_tenant_id uuid, requested_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.tenants%rowtype; audit_action text;
begin
  if not private.is_platform_tenant_manager() then raise exception '只有负责人或副负责人可以变更租户状态'; end if;
  if requested_status not in ('active', 'suspended', 'archived') then raise exception '租户状态不正确'; end if;
  select * into target from public.tenants where id = requested_tenant_id for update;
  if not found then raise exception '租户不存在'; end if;
  if target.id = '00000000-0000-4000-8000-000000000001'::uuid and requested_status <> 'active' then raise exception '默认 PUFFY 租户不能停用'; end if;
  update public.tenants set status = requested_status where id = target.id;
  audit_action := case requested_status when 'active' then 'restored' when 'suspended' then 'suspended' else 'archived' end;
  insert into public.tenant_lifecycle_audit_logs (tenant_id, tenant_slug, actor_id, action, details)
  values (target.id, target.slug, auth.uid(), audit_action, jsonb_build_object('previous_status', target.status));
end;
$$;

create or replace function public.delete_tenant_permanently(requested_tenant_id uuid, requested_slug_confirmation text)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.tenants%rowtype; removed_members integer := 0;
begin
  if not private.is_platform_tenant_manager() then raise exception '只有负责人或副负责人可以永久删除租户'; end if;
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

drop policy if exists "members read their tenants" on public.tenants;
create policy "members or platform tenant managers read tenants" on public.tenants for select to authenticated
using ((select private.is_tenant_member(id)) or (select private.is_platform_tenant_manager()));

drop policy if exists "members or managers read tenant memberships" on public.tenant_memberships;
create policy "members managers or platform tenant managers read memberships" on public.tenant_memberships for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_tenant_role(tenant_id, array['ceo', 'super_admin']::text[])) or (select private.is_platform_tenant_manager()));

drop policy if exists "platform owners read tenant lifecycle audit" on public.tenant_lifecycle_audit_logs;
create policy "platform tenant managers read lifecycle audit" on public.tenant_lifecycle_audit_logs for select to authenticated
using ((select private.is_platform_tenant_manager()));

revoke all on function private.is_platform_tenant_manager() from public;
grant execute on function private.is_platform_tenant_manager() to authenticated, service_role;

commit;
