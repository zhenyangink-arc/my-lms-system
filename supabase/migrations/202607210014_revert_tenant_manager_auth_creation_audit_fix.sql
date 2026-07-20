-- 撤销 202607210013：恢复 profiles 原始账号审计触发行为。
begin;

drop trigger if exists profiles_audit_management_change on public.profiles;
create trigger profiles_audit_management_change
after insert or update on public.profiles
for each row
execute function public.audit_profile_management_change();

comment on trigger profiles_audit_management_change on public.profiles is
  '自动记录账号创建及重要资料变更';

commit;
