-- 资料库调整为平台统一维护、机构只读下载。
-- 资料本身是平台共享内容；收藏和下载记录仍归属当前机构。

begin;

-- 资源不再隶属于单个机构，先解除子表的复合租户外键。
alter table public.library_downloads
  drop constraint if exists library_downloads_resource_id_fkey;
alter table public.library_favorites
  drop constraint if exists library_favorites_resource_id_fkey;

drop trigger if exists library_resources_tenant_scope
  on public.library_resources;

alter table public.library_resources
  drop constraint if exists library_resources_tenant_id_fkey;
alter table public.library_resources
  alter column tenant_id drop not null;
alter table public.library_resources
  add column if not exists content_scope text not null default 'platform';
alter table public.library_resources
  drop constraint if exists library_resources_content_scope_check;
alter table public.library_resources
  add constraint library_resources_content_scope_check
  check (content_scope = 'platform');

-- 现有资料整体转入平台资料库，由平台负责人继续整理。
update public.library_resources
set tenant_id = null,
    content_scope = 'platform';

alter table public.library_downloads
  add constraint library_downloads_resource_id_fkey
  foreign key (resource_id)
  references public.library_resources(id)
  on delete cascade;
alter table public.library_favorites
  add constraint library_favorites_resource_id_fkey
  foreign key (resource_id)
  references public.library_resources(id)
  on delete cascade;

create or replace function public.current_user_is_library_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_owner();
$$;

create or replace function public.current_user_can_manage_library()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_owner();
$$;

create or replace function public.save_library_resource(
  p_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_resource_type text,
  p_file_path text,
  p_original_file_name text,
  p_mime_type text,
  p_file_size bigint,
  p_external_url text,
  p_is_featured boolean,
  p_sort_order integer,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_id uuid;
begin
  if not private.is_platform_owner() then
    raise exception '只有平台负责人可以整理和上传资料';
  end if;

  if char_length(trim(coalesce(p_title, ''))) not between 2 and 140
    or char_length(coalesce(p_description, '')) > 3000
  then
    raise exception '资料标题或说明长度不正确';
  end if;
  if p_category not in ('language', 'study', 'application', 'visa', 'career', 'tools')
    or p_resource_type not in ('document', 'image', 'spreadsheet', 'presentation', 'archive', 'link')
    or p_status not in ('draft', 'published', 'archived')
    or p_sort_order not between 0 and 100000
  then
    raise exception '资料分类、类型、状态或排序不正确';
  end if;

  if p_resource_type = 'link' then
    if p_external_url is null or p_external_url !~ '^https?://' then
      raise exception '外部链接地址不正确';
    end if;
    p_file_path := null;
    p_original_file_name := null;
    p_mime_type := null;
    p_file_size := null;
  else
    if p_file_path is null
      or p_original_file_name is null
      or p_file_size is null
      or p_file_size not between 1 and 15728640
    then
      raise exception '资料文件信息不完整';
    end if;
    p_external_url := null;
  end if;

  if p_id is null then
    insert into public.library_resources (
      tenant_id,
      content_scope,
      title,
      description,
      category,
      resource_type,
      file_path,
      original_file_name,
      mime_type,
      file_size,
      external_url,
      is_featured,
      sort_order,
      status,
      published_at,
      created_by,
      updated_by
    )
    values (
      null,
      'platform',
      trim(p_title),
      trim(coalesce(p_description, '')),
      p_category,
      p_resource_type,
      p_file_path,
      p_original_file_name,
      p_mime_type,
      p_file_size,
      p_external_url,
      coalesce(p_is_featured, false),
      p_sort_order,
      p_status,
      case when p_status = 'published' then now() else null end,
      auth.uid(),
      auth.uid()
    )
    returning id into v_id;
  else
    update public.library_resources
    set tenant_id = null,
        content_scope = 'platform',
        title = trim(p_title),
        description = trim(coalesce(p_description, '')),
        category = p_category,
        resource_type = p_resource_type,
        file_path = p_file_path,
        original_file_name = p_original_file_name,
        mime_type = p_mime_type,
        file_size = p_file_size,
        external_url = p_external_url,
        is_featured = coalesce(p_is_featured, false),
        sort_order = p_sort_order,
        status = p_status,
        published_at = case
          when p_status = 'published' and status <> 'published' then now()
          when p_status = 'draft' then null
          else published_at
        end,
        updated_by = auth.uid(),
        updated_at = now()
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception '资料不存在';
    end if;
  end if;

  return v_id;
end;
$$;

create or replace function public.change_library_resource_status(
  p_resource_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if not private.is_platform_owner() then
    raise exception '只有平台负责人可以修改资料状态';
  end if;
  if p_status not in ('draft', 'published', 'archived') then
    raise exception '资料状态不正确';
  end if;

  update public.library_resources
  set status = p_status,
      published_at = case
        when p_status = 'published' and status <> 'published' then now()
        when p_status = 'draft' then null
        else published_at
      end,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_resource_id;

  if not found then
    raise exception '资料不存在';
  end if;
end;
$$;

create or replace function public.record_library_download(p_resource_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public'
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
        from public.library_resources
        where id = p_resource_id
          and tenant_id is null
          and content_scope = 'platform'
          and status = 'published'
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
set search_path = 'public'
as $$
declare
  v_added boolean;
  v_tenant_id uuid := private.current_tenant_id();
begin
  if v_tenant_id is null
    or not public.is_active_account()
    or not exists (
      select 1
      from public.library_resources
      where id = p_resource_id
        and tenant_id is null
        and content_scope = 'platform'
        and status = 'published'
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

drop policy if exists "active users read published library resources"
  on public.library_resources;
drop policy if exists "tenant users read library resources"
  on public.library_resources;
create policy "platform owner curates and institutions read published resources"
on public.library_resources for select to authenticated
using (
  (select private.is_platform_owner())
  or (
    tenant_id is null
    and content_scope = 'platform'
    and status = 'published'
    and (select private.current_tenant_id()) is not null
    and (select public.is_active_account())
  )
);

drop policy if exists "library managers read downloads"
  on public.library_downloads;
drop policy if exists "tenant library managers read downloads"
  on public.library_downloads;
create policy "platform owner or user reads library downloads"
on public.library_downloads for select to authenticated
using (
  (select private.is_platform_owner())
  or (
    tenant_id = (select private.current_tenant_id())
    and user_id = (select auth.uid())
  )
);

drop policy if exists "users read own library favorites"
  on public.library_favorites;
drop policy if exists "tenant users read own library favorites"
  on public.library_favorites;
create policy "users read own platform library favorites"
on public.library_favorites for select to authenticated
using (
  (select private.is_platform_owner())
  or (
    tenant_id = (select private.current_tenant_id())
    and user_id = (select auth.uid())
  )
);

drop policy if exists "library assignments visible to owner or assignee"
  on public.library_admin_assignments;
drop policy if exists "owner manages library assignments"
  on public.library_admin_assignments;
drop policy if exists "tenant library assignments visible to owner or assignee"
  on public.library_admin_assignments;
drop policy if exists "tenant owner manages library assignments"
  on public.library_admin_assignments;

revoke all on public.library_admin_assignments from authenticated;

drop policy if exists "library managers upload resource files"
  on storage.objects;
drop policy if exists "authorized users read resource files"
  on storage.objects;
drop policy if exists "library managers delete resource files"
  on storage.objects;

create policy "platform owner uploads resource files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'library-resources'
  and (select private.is_platform_owner())
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "authorized users read platform resource files"
on storage.objects for select to authenticated
using (
  bucket_id = 'library-resources'
  and (
    (select private.is_platform_owner())
    or (
      (select private.current_tenant_id()) is not null
      and (select public.is_active_account())
      and exists (
        select 1
        from public.library_resources as resource
        where resource.file_path = name
          and resource.tenant_id is null
          and resource.content_scope = 'platform'
          and resource.status = 'published'
      )
    )
  )
);

create policy "platform owner deletes resource files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'library-resources'
  and (select private.is_platform_owner())
);

revoke all on function public.save_library_resource(
  uuid, text, text, text, text, text, text, text, bigint, text, boolean, integer, text
) from public, anon;
revoke all on function public.change_library_resource_status(uuid, text)
  from public, anon;
revoke all on function public.toggle_library_favorite(uuid)
  from public, anon;
revoke all on function public.record_library_download(uuid)
  from public, anon;

grant execute on function public.current_user_is_library_owner()
  to authenticated, service_role;
grant execute on function public.current_user_can_manage_library()
  to authenticated, service_role;
grant execute on function public.save_library_resource(
  uuid, text, text, text, text, text, text, text, bigint, text, boolean, integer, text
) to authenticated;
grant execute on function public.change_library_resource_status(uuid, text)
  to authenticated;
grant execute on function public.toggle_library_favorite(uuid)
  to authenticated;
grant execute on function public.record_library_download(uuid)
  to authenticated;

comment on table public.library_resources is
  '平台负责人统一维护、机构账号只读获取的共享资料库';
comment on column public.library_resources.content_scope is
  '资料内容范围；当前资料库仅允许 platform 平台共享内容';

commit;
