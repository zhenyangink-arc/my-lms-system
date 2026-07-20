-- Auth 创建用户时，profiles 行先于 tenant_memberships 写入。
-- 此时不能生成要求 tenant_id 的账号审计；开户动作会在成员关系落库后显式补记。
begin;

drop trigger if exists profiles_audit_management_change on public.profiles;
create trigger profiles_audit_management_change
after insert or update on public.profiles
for each row
when (private.default_tenant_of(new.id) is not null)
execute function public.audit_profile_management_change();

comment on trigger profiles_audit_management_change on public.profiles is
  '仅在账号已有租户归属后记录资料变更，避免 Auth 建档阶段因缺少 tenant_id 失败';

commit;
