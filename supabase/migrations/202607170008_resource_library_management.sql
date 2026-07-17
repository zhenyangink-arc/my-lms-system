-- ============================================================
-- 资料库：文件与链接资源、收藏、下载记录和负责人授权
-- 后台：负责人、全部 CEO、负责人单独指定的管理员。
-- 学生：只读已发布资料，可收藏并通过短时签名地址下载。
-- ============================================================

create table if not exists public.library_admin_assignments (
  admin_id uuid primary key references public.profiles(id) on delete cascade,
  granted_by uuid not null references public.profiles(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz
);

create table if not exists public.library_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 140),
  description text not null default '' check (char_length(description) <= 3000),
  category text not null default 'language' check (category in ('language','study','application','visa','career','tools')),
  resource_type text not null check (resource_type in ('document','image','spreadsheet','presentation','archive','link')),
  file_path text,
  original_file_name text,
  mime_type text,
  file_size bigint check (file_size is null or file_size between 1 and 15728640),
  external_url text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  is_featured boolean not null default false,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  download_count integer not null default 0 check (download_count >= 0),
  published_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (resource_type = 'link' and external_url is not null and file_path is null)
    or (resource_type <> 'link' and file_path is not null and external_url is null)
  )
);

create table if not exists public.library_favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  resource_id uuid not null references public.library_resources(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, resource_id)
);

create table if not exists public.library_downloads (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.library_resources(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  downloaded_at timestamptz not null default now()
);

create index if not exists library_resources_catalog_idx on public.library_resources (status,is_featured desc,sort_order,published_at desc);
create index if not exists library_downloads_resource_idx on public.library_downloads (resource_id,downloaded_at desc);
create index if not exists library_admin_assignments_active_idx on public.library_admin_assignments (admin_id) where revoked_at is null;

create or replace function public.current_user_is_library_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id=auth.uid() and coalesce(status,'active')='active' and role='super_admin');
$$;
create or replace function public.current_user_can_manage_library()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles as viewer where viewer.id=auth.uid() and coalesce(viewer.status,'active')='active' and (viewer.role in ('super_admin','ceo') or (viewer.role='admin' and exists (select 1 from public.library_admin_assignments as assignment where assignment.admin_id=viewer.id and assignment.revoked_at is null))));
$$;

create or replace function public.enforce_library_assignment()
returns trigger language plpgsql security definer set search_path=public as $$
declare target_role text; target_status text;
begin
  if auth.uid() is null then return new; end if;
  if not public.current_user_is_library_owner() then raise exception '只有负责人可以指定资料库管理员'; end if;
  select role,coalesce(status,'active') into target_role,target_status from public.profiles where id=new.admin_id;
  if new.revoked_at is null and (target_role is distinct from 'admin' or target_status is distinct from 'active') then raise exception '只能授权状态正常的管理员账号'; end if;
  if new.revoked_at is null then new.granted_by:=auth.uid();new.granted_at:=now();new.revoked_by:=null;else new.revoked_by:=auth.uid();end if;
  return new;
end;
$$;
drop trigger if exists enforce_library_assignment_trigger on public.library_admin_assignments;
create trigger enforce_library_assignment_trigger before insert or update on public.library_admin_assignments for each row execute function public.enforce_library_assignment();

create or replace function public.save_library_resource(
  p_id uuid,p_title text,p_description text,p_category text,p_resource_type text,
  p_file_path text,p_original_file_name text,p_mime_type text,p_file_size bigint,
  p_external_url text,p_is_featured boolean,p_sort_order integer,p_status text
)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if not public.current_user_can_manage_library() then raise exception '当前账号没有资料库管理权限'; end if;
  if char_length(trim(coalesce(p_title,''))) not between 2 and 140 or char_length(coalesce(p_description,''))>3000 then raise exception '资料标题或说明长度不正确'; end if;
  if p_category not in ('language','study','application','visa','career','tools') or p_resource_type not in ('document','image','spreadsheet','presentation','archive','link') or p_status not in ('draft','published','archived') or p_sort_order not between 0 and 100000 then raise exception '资料分类、类型、状态或排序不正确'; end if;
  if p_resource_type='link' then
    if p_external_url is null or p_external_url !~ '^https?://' then raise exception '外部链接地址不正确'; end if;
    p_file_path:=null;p_original_file_name:=null;p_mime_type:=null;p_file_size:=null;
  else
    if p_file_path is null or p_original_file_name is null or p_file_size is null or p_file_size not between 1 and 15728640 then raise exception '资料文件信息不完整'; end if;
    p_external_url:=null;
  end if;
  if p_id is null then
    insert into public.library_resources(title,description,category,resource_type,file_path,original_file_name,mime_type,file_size,external_url,is_featured,sort_order,status,published_at,created_by,updated_by)
    values(trim(p_title),trim(coalesce(p_description,'')),p_category,p_resource_type,p_file_path,p_original_file_name,p_mime_type,p_file_size,p_external_url,coalesce(p_is_featured,false),p_sort_order,p_status,case when p_status='published' then now() else null end,auth.uid(),auth.uid()) returning id into v_id;
  else
    update public.library_resources set title=trim(p_title),description=trim(coalesce(p_description,'')),category=p_category,resource_type=p_resource_type,file_path=p_file_path,original_file_name=p_original_file_name,mime_type=p_mime_type,file_size=p_file_size,external_url=p_external_url,is_featured=coalesce(p_is_featured,false),sort_order=p_sort_order,status=p_status,published_at=case when p_status='published' and status<>'published' then now() when p_status='draft' then null else published_at end,updated_by=auth.uid(),updated_at=now() where id=p_id returning id into v_id;
    if v_id is null then raise exception '资料不存在'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.change_library_resource_status(p_resource_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.current_user_can_manage_library() then raise exception '当前账号没有资料库管理权限'; end if;
  if p_status not in ('draft','published','archived') then raise exception '资料状态不正确'; end if;
  update public.library_resources set status=p_status,published_at=case when p_status='published' and status<>'published' then now() when p_status='draft' then null else published_at end,updated_by=auth.uid(),updated_at=now() where id=p_resource_id;
  if not found then raise exception '资料不存在'; end if;
end;
$$;

create or replace function public.toggle_library_favorite(p_resource_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_added boolean;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and coalesce(status,'active')='active') or not exists(select 1 from public.library_resources where id=p_resource_id and status='published') then raise exception '无权收藏该资料'; end if;
  if exists(select 1 from public.library_favorites where user_id=auth.uid() and resource_id=p_resource_id) then delete from public.library_favorites where user_id=auth.uid() and resource_id=p_resource_id;v_added:=false;
  else insert into public.library_favorites(user_id,resource_id) values(auth.uid(),p_resource_id);v_added:=true;end if;
  return v_added;
end;
$$;

create or replace function public.record_library_download(p_resource_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and coalesce(status,'active')='active')
    or not exists(select 1 from public.library_resources where id=p_resource_id and (status='published' or public.current_user_can_manage_library()))
  then raise exception '无权下载该资料'; end if;
  insert into public.library_downloads(resource_id,user_id) values(p_resource_id,auth.uid());
  update public.library_resources set download_count=download_count+1 where id=p_resource_id;
end;
$$;

alter table public.library_admin_assignments enable row level security;
alter table public.library_resources enable row level security;
alter table public.library_favorites enable row level security;
alter table public.library_downloads enable row level security;
create policy "library assignments visible to owner or assignee" on public.library_admin_assignments for select to authenticated using(public.current_user_is_library_owner() or admin_id=auth.uid());
create policy "owner manages library assignments" on public.library_admin_assignments for all to authenticated using(public.current_user_is_library_owner()) with check(public.current_user_is_library_owner());
create policy "active users read published library resources" on public.library_resources for select to authenticated using(public.current_user_can_manage_library() or (status='published' and exists(select 1 from public.profiles as viewer where viewer.id=auth.uid() and coalesce(viewer.status,'active')='active')));
create policy "users read own library favorites" on public.library_favorites for select to authenticated using(user_id=auth.uid());
create policy "library managers read downloads" on public.library_downloads for select to authenticated using(public.current_user_can_manage_library());
grant select on public.library_resources,public.library_favorites,public.library_downloads to authenticated;
grant select,insert,update on public.library_admin_assignments to authenticated;
revoke insert,update,delete on public.library_resources,public.library_favorites,public.library_downloads from authenticated;
revoke delete on public.library_admin_assignments from authenticated;
revoke all on function public.save_library_resource(uuid,text,text,text,text,text,text,text,bigint,text,boolean,integer,text),public.change_library_resource_status(uuid,text),public.toggle_library_favorite(uuid),public.record_library_download(uuid) from public,anon;
grant execute on function public.current_user_is_library_owner(),public.current_user_can_manage_library(),public.save_library_resource(uuid,text,text,text,text,text,text,text,bigint,text,boolean,integer,text),public.change_library_resource_status(uuid,text),public.toggle_library_favorite(uuid),public.record_library_download(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('library-resources','library-resources',false,15728640,array['application/pdf','image/jpeg','image/png','image/webp','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/zip','application/x-zip-compressed'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "library managers upload resource files" on storage.objects for insert to authenticated with check(bucket_id='library-resources' and public.current_user_can_manage_library() and (storage.foldername(name))[1]=auth.uid()::text);
create policy "authorized users read resource files" on storage.objects for select to authenticated using(
  bucket_id='library-resources'
  and exists(select 1 from public.profiles as viewer where viewer.id=auth.uid() and coalesce(viewer.status,'active')='active')
  and (public.current_user_can_manage_library() or exists(select 1 from public.library_resources as resource where resource.file_path=name and resource.status='published'))
);
create policy "library managers delete resource files" on storage.objects for delete to authenticated using(bucket_id='library-resources' and public.current_user_can_manage_library());

comment on table public.library_resources is '学生资料库中的文件或外部链接资源';
comment on table public.library_favorites is '学生资料收藏关系';
comment on table public.library_downloads is '资料下载审计记录';
