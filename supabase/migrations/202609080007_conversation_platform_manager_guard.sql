begin;

-- current_profile_role() deliberately returns only a tenant membership role.
-- A tenantless platform owner therefore produced NULL, which hid saved drafts
-- and let PL/pgSQL `if not ...` guards fall through. Always return a boolean
-- from the explicit, active platform identity check instead.
create or replace function public.current_user_can_manage_conversation_practice()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.is_platform_owner(), false)
    and private.current_tenant_id() is null;
$$;

comment on function public.current_user_can_manage_conversation_practice() is
  '仅无机构上下文的有效平台负责人可维护共享会话场景；未授权账号明确返回 false，不返回 NULL';

commit;
