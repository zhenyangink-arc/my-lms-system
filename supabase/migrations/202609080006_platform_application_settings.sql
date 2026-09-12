begin;

-- Explicit platform control-plane operation. The existing audit trigger records
-- auth.uid(), before/after values atomically with the change.
create or replace function public.set_platform_tenant_application_settings(
  p_tenant_id uuid,
  p_app_id uuid,
  p_is_enabled boolean,
  p_status text,
  p_custom_title text,
  p_expected_updated_at timestamptz
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated_at timestamptz;
  v_platform_status text;
  v_title text := nullif(btrim(coalesce(p_custom_title, '')), '');
begin
  if not private.is_platform_tenant_manager() or private.current_tenant_id() is not null then
    raise exception '只有平台负责人或副负责人可以调整机构应用设置' using errcode = '42501';
  end if;
  if p_tenant_id is null or p_app_id is null or p_expected_updated_at is null or p_is_enabled is null
    or p_status is null or p_status not in ('active', 'coming_soon', 'hidden') then
    raise exception '应用设置参数不完整或状态无效' using errcode = '22023';
  end if;
  if char_length(coalesce(v_title, '')) > 80 then
    raise exception '应用显示名称不能超过 80 个字' using errcode = '22023';
  end if;
  select app.default_status into v_platform_status from public.student_apps as app where app.id = p_app_id;
  if not found then raise exception '应用不存在' using errcode = '22023'; end if;
  if p_is_enabled and p_status = 'active' and v_platform_status <> 'active' then
    raise exception '平台应用尚未开放，不能启用机构应用' using errcode = '22023';
  end if;
  if p_is_enabled and p_status = 'active' and not exists (
    select 1 from public.tenants where id = p_tenant_id and status = 'active'
  ) then
    raise exception '机构未运行，不能启用机构应用' using errcode = '22023';
  end if;
  update public.tenant_student_apps
  set is_enabled = p_is_enabled, status = p_status, custom_title = v_title,
      updated_at = clock_timestamp()
  where tenant_id = p_tenant_id and app_id = p_app_id
    and updated_at = p_expected_updated_at
  returning updated_at into v_updated_at;
  if not found then
    raise exception '设置已被其他人修改或机构未注册此应用，请刷新后重试' using errcode = '40001';
  end if;
  return v_updated_at;
end;
$$;

revoke all on function public.set_platform_tenant_application_settings(uuid, uuid, boolean, text, text, timestamptz) from public, anon;
grant execute on function public.set_platform_tenant_application_settings(uuid, uuid, boolean, text, text, timestamptz) to authenticated;

commit;
