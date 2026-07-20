-- Auth 建档时 profiles 先于租户归属产生。此阶段不能写入 tenant_id 非空的
-- 账号管理审计；待成员关系建立后的资料更新再生成租户内审计记录。
begin;

drop trigger if exists profiles_audit_management_change on public.profiles;
create trigger profiles_audit_management_change
after insert or update on public.profiles
for each row
when (private.default_tenant_of(new.id) is not null)
execute function public.audit_profile_management_change();

comment on trigger profiles_audit_management_change on public.profiles is
  '仅在账号已有租户归属后记录资料变更，避免 Auth 建档阶段因缺少 tenant_id 回滚';

commit;
