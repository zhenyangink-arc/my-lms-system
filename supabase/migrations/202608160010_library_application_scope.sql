begin;

-- 资料库记录通过 course_id 继承课程的 student_app_id。学生和机构员工
-- 只能读取自己实时可访问应用里的资料，避免在韩语资料库混入留学或其他学科。
drop policy if exists "platform owner curates and institutions read published resources"
  on public.library_resources;
create policy "platform owner curates and application users read published resources"
on public.library_resources for select to authenticated
using (
  (select private.is_platform_owner())
  or (
    tenant_id is null
    and content_scope = 'platform'
    and status = 'published'
    and (select private.current_tenant_id()) is not null
    and (select public.is_active_account())
    and exists (
      select 1
      from public.courses as course
      where course.id = library_resources.course_id
        and private.current_user_can_read_student_app(course.student_app_id)
    )
  )
);

create or replace function public.record_library_download(p_resource_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := private.current_tenant_id();
begin
  if private.is_platform_owner() then
    if not exists (
      select 1 from public.library_resources where id = p_resource_id
    ) then
      raise exception '资料不存在';
    end if;
  else
    if v_tenant_id is null
      or not public.is_active_account()
      or not exists (
        select 1
        from public.library_resources as resource
        join public.courses as course on course.id = resource.course_id
        where resource.id = p_resource_id
          and resource.tenant_id is null
          and resource.content_scope = 'platform'
          and resource.status = 'published'
          and private.current_user_can_read_student_app(course.student_app_id)
      )
    then
      raise exception '无权下载该资料';
    end if;

    insert into public.library_downloads (
      tenant_id,
      resource_id,
      user_id
    )
    values (
      v_tenant_id,
      p_resource_id,
      auth.uid()
    );
  end if;

  update public.library_resources
  set download_count = download_count + 1
  where id = p_resource_id;
end;
$$;

create or replace function public.toggle_library_favorite(p_resource_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_added boolean;
  v_tenant_id uuid := private.current_tenant_id();
begin
  if v_tenant_id is null
    or not public.is_active_account()
    or not exists (
      select 1
      from public.library_resources as resource
      join public.courses as course on course.id = resource.course_id
      where resource.id = p_resource_id
        and resource.tenant_id is null
        and resource.content_scope = 'platform'
        and resource.status = 'published'
        and private.current_user_can_read_student_app(course.student_app_id)
    )
  then
    raise exception '无权收藏该资料';
  end if;

  if exists (
    select 1
    from public.library_favorites
    where tenant_id = v_tenant_id
      and user_id = auth.uid()
      and resource_id = p_resource_id
  ) then
    delete from public.library_favorites
    where tenant_id = v_tenant_id
      and user_id = auth.uid()
      and resource_id = p_resource_id;
    v_added := false;
  else
    insert into public.library_favorites (
      tenant_id,
      user_id,
      resource_id
    )
    values (
      v_tenant_id,
      auth.uid(),
      p_resource_id
    );
    v_added := true;
  end if;

  return v_added;
end;
$$;

revoke all on function public.record_library_download(uuid) from public, anon;
revoke all on function public.toggle_library_favorite(uuid) from public, anon;
grant execute on function public.record_library_download(uuid) to authenticated, service_role;
grant execute on function public.toggle_library_favorite(uuid) to authenticated, service_role;

commit;
