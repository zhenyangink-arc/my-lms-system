-- 负责人已明确确认：永久清除遗留租户 yuanzhi 与 yanzhi001。
-- 仅处理下列固定 ID + slug，避免误删任何后来创建的同名记录。
begin;

do $$
declare
  target record;
  expected_count integer;
  removed_members integer;
begin
  select count(*) into expected_count
  from public.tenants
  where (id = '9d7912d2-26a0-4867-863f-ce458b2c4faa'::uuid and slug = 'yuanzhi')
     or (id = 'bcf51345-0e4e-4ef2-8b84-d1c4213a7ef1'::uuid and slug = 'yanzhi001');

  if expected_count <> 2 then
    raise exception '待删除的已确认遗留租户状态已变化，已取消执行';
  end if;

  perform set_config('app.tenant_hard_delete', 'on', true);

  for target in
    select id, slug
    from public.tenants
    where (id = '9d7912d2-26a0-4867-863f-ce458b2c4faa'::uuid and slug = 'yuanzhi')
       or (id = 'bcf51345-0e4e-4ef2-8b84-d1c4213a7ef1'::uuid and slug = 'yanzhi001')
  loop
    delete from public.tenant_memberships where tenant_id = target.id;
    get diagnostics removed_members = row_count;
    delete from public.tenant_membership_audit_logs where tenant_id = target.id;
    delete from public.tenants where id = target.id;
    insert into public.tenant_lifecycle_audit_logs (tenant_id, tenant_slug, action, details)
    values (target.id, target.slug, 'permanently_deleted', jsonb_build_object('removed_memberships', removed_members, 'source', 'owner_confirmed_legacy_cleanup'));
  end loop;
end;
$$;

commit;
