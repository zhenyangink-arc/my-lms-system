-- 平台资料按课程归档；上传与编辑时必须选择一门平台课程。

begin;

alter table public.library_resources
  add column if not exists course_id uuid;

alter table public.library_resources
  drop constraint if exists library_resources_course_id_fkey;
alter table public.library_resources
  add constraint library_resources_course_id_fkey
  foreign key (course_id)
  references public.courses(id)
  on delete restrict;

create index if not exists library_resources_course_catalog_idx
  on public.library_resources (
    course_id,
    status,
    is_featured desc,
    sort_order,
    updated_at desc
  );

create or replace function public.save_library_resource(
  p_id uuid,
  p_course_id uuid,
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

  if not exists (
    select 1
    from public.courses as course
    where course.id = p_course_id
      and course.tenant_id is null
      and course.content_scope = 'platform'
  ) then
    raise exception '请选择有效的平台课程';
  end if;

  v_id := public.save_library_resource(
    p_id,
    p_title,
    p_description,
    p_category,
    p_resource_type,
    p_file_path,
    p_original_file_name,
    p_mime_type,
    p_file_size,
    p_external_url,
    p_is_featured,
    p_sort_order,
    p_status
  );

  update public.library_resources
  set course_id = p_course_id,
      updated_at = now()
  where id = v_id;

  return v_id;
end;
$$;

-- 旧签名不再对客户端开放，避免绕过课程归属上传资料。
revoke execute on function public.save_library_resource(
  uuid, text, text, text, text, text, text, text, bigint, text, boolean, integer, text
) from authenticated;
revoke all on function public.save_library_resource(
  uuid, uuid, text, text, text, text, text, text, text, bigint, text, boolean, integer, text
) from public, anon;
grant execute on function public.save_library_resource(
  uuid, uuid, text, text, text, text, text, text, text, bigint, text, boolean, integer, text
) to authenticated;

comment on column public.library_resources.course_id is
  '资料所属的平台课程；平台上传与编辑必须明确选择课程';

commit;
