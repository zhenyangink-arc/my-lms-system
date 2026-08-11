-- ============================================================
-- 修复：平台管理员更新课程内容时审计日志 tenant_id 为 NULL 报错
--
-- 平台管理员（platform_owner/platform_admin）不属于任何租户，
-- courses/lessons 等表更新时 audit_course_content_change() 往
-- course_content_audit_logs 插入审计记录，tenant_id 推算为 NULL，
-- 违反 NOT NULL 约束导致整个业务更新被回滚（"课程树管理"开关失效）。
--
-- 修复：无租户上下文（平台内容操作）时跳过审计插入，不阻塞业务更新；
-- 租户内操作（tenant_id 可推算）照常写审计日志。
-- ============================================================

begin;

create or replace function public.audit_course_content_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_id uuid;
  resolved_tenant uuid;
begin
  row_id := case when tg_op = 'DELETE' then old.id else new.id end;

  -- 优先当前租户上下文；平台管理员（无租户）尝试从操作者推断；
  -- 仍为空（平台内容操作）则跳过审计，不阻塞课程/课时修改。
  resolved_tenant := private.current_tenant_id();
  if resolved_tenant is null then
    resolved_tenant := private.default_tenant_of(auth.uid());
  end if;
  if resolved_tenant is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  insert into public.course_content_audit_logs (
    tenant_id,
    actor_id,
    entity_type,
    entity_id,
    operation,
    before_data,
    after_data
  )
  values (
    resolved_tenant,
    auth.uid(),
    tg_argv[0],
    row_id,
    lower(tg_op),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

commit;
