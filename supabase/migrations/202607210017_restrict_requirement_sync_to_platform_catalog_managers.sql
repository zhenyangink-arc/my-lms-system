-- 院校申请资料模板属于平台共享目录。
-- 下游学生清单同步仅继承平台目录管理权限，不额外放行通用租户管理角色。

begin;

create or replace function public.enforce_application_document_checklist_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_is_platform_catalog_manager boolean;
begin
  if auth.uid() is null then
    return new;
  end if;

  select private.is_platform_catalog_manager()
  into actor_is_platform_catalog_manager;

  if actor_is_platform_catalog_manager then
    if old.admin_locked_at is not null
       and new.admin_locked_at is not distinct from old.admin_locked_at then
      raise exception '这项资料已锁定，请先解锁再修改';
    end if;
    return new;
  end if;

  if auth.uid() <> old.user_id or new.user_id <> old.user_id then
    raise exception '只能更新自己的申请资料清单';
  end if;

  if old.admin_locked_at is not null then
    raise exception '这项资料已被管理员锁定，暂时无法修改';
  end if;

  if new.status not in ('preparing', 'completed', 'not_needed') then
    raise exception '申请资料状态只能是准备中、已完成或无';
  end if;

  if (to_jsonb(new) - 'status' - 'updated_at')
     is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception '学生只能修改申请资料状态';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_application_document_checklist_update()
  from public, anon, authenticated;

commit;
