-- ============================================================
-- 个人资料自助保存不能触碰账号管控字段
-- 项目基础的 profiles 更新策略不在这批迁移里维护，无法在这里确认它
-- 是否已经限制了可写列。这里增加一层数据库触发器兜底：
-- 不管调用方是页面、Server Action 还是直接调用 Supabase 客户端，
-- 只要是本人更新自己的资料行，就一律不允许改角色、状态、会员档位
-- 以及配套的管理字段，这些字段只能由管理员在账号管理页对别人操作。
-- ============================================================

create or replace function public.enforce_profile_self_service_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.id <> auth.uid() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.membership_tier is distinct from old.membership_tier
     or new.deactivated_at is distinct from old.deactivated_at
     or new.deactivated_by is distinct from old.deactivated_by
     or new.deactivate_reason is distinct from old.deactivate_reason
     or new.membership_updated_at is distinct from old.membership_updated_at
     or new.membership_updated_by is distinct from old.membership_updated_by then
    raise exception '不能通过个人资料自助修改账号角色、状态或会员档位';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_profile_self_service_fields_trigger on public.profiles;
create trigger enforce_profile_self_service_fields_trigger
before update on public.profiles
for each row
execute function public.enforce_profile_self_service_fields();

comment on function public.enforce_profile_self_service_fields() is
  '禁止任何账号通过更新自己的资料行来修改角色、状态或会员档位，这些字段只能由管理员对其他账号操作';
