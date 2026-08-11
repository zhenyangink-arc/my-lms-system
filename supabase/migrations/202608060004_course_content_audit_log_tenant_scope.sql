begin;

-- courses/lessons 的写权限只开放给平台课程管理员（requirePlatformCourseManager，
-- 只有 platform_owner/platform_admin，两者都不属于任何租户）。courses_audit_content_change
-- 触发器改动后会往 course_content_audit_logs 插一行审计记录，但这张表没有被列进
-- enforce_tenant_scope() 的"平台管理内容"白名单里——于是每次课程/课时的增删改，
-- 审计记录插入时都会因为推算不出 tenant_id 而报"缺少租户上下文，拒绝写入"，
-- 把刚做的课程/课时修改一起回滚掉。平台管理员编辑课程内容因此长期处于
-- "点了保存但其实必然失败"的状态。
create or replace function private.enforce_tenant_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved uuid;
  row_json jsonb;
  owner_id uuid;
begin
  if tg_op = 'UPDATE' then
    if coalesce(current_setting('app.platform_content_migration', true), '') = 'on' then return new; end if;
    if new.tenant_id is distinct from old.tenant_id then raise exception '不能把数据移动到其他租户'; end if;
    return new;
  end if;

  row_json := to_jsonb(new);
  if private.is_platform_course_manager()
     and tg_table_name in ('course_categories', 'courses', 'lessons', 'lesson_resources', 'course_chapters', 'course_content_audit_logs') then
    new := jsonb_populate_record(new, row_json || jsonb_build_object('tenant_id', null, 'content_scope', 'platform'));
    return new;
  end if;

  if new.tenant_id is null then
    resolved := private.current_tenant_id();
    if resolved is null then
      owner_id := coalesce(
        nullif(row_json->>'user_id', '')::uuid,
        nullif(row_json->>'student_id', '')::uuid,
        nullif(row_json->>'target_user_id', '')::uuid,
        nullif(row_json->>'admin_id', '')::uuid,
        nullif(row_json->>'actor_id', '')::uuid,
        nullif(row_json->>'created_by', '')::uuid
      );
      if owner_id is not null then resolved := private.default_tenant_of(owner_id); end if;
    end if;
    new.tenant_id := resolved;
  end if;
  if new.tenant_id is null then raise exception '缺少租户上下文，拒绝写入'; end if;
  return new;
end;
$$;

commit;
