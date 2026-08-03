-- 韩国大学公共资料由平台统一维护；机构端只能读取已发布内容。

begin;

create or replace function private.is_platform_university_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.global_role in ('platform_owner', 'platform_admin')
      and coalesce(profile.status, 'active') = 'active'
  );
$$;

create or replace function private.is_platform_university_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.global_role = 'platform_owner'
      and coalesce(profile.status, 'active') = 'active'
  );
$$;

revoke all on function private.is_platform_university_manager() from public;
revoke all on function private.is_platform_university_owner() from public;
grant execute on function private.is_platform_university_manager() to authenticated, service_role;
grant execute on function private.is_platform_university_owner() to authenticated, service_role;

drop policy if exists "authenticated read published universities" on public.korean_universities;
drop policy if exists "platform catalog managers manage universities" on public.korean_universities;

create policy "authenticated read published universities"
on public.korean_universities for select to authenticated
using (is_published = true or (select private.is_platform_university_manager()));

create policy "platform university managers insert universities"
on public.korean_universities for insert to authenticated
with check ((select private.is_platform_university_manager()));

create policy "platform university managers update universities"
on public.korean_universities for update to authenticated
using ((select private.is_platform_university_manager()))
with check ((select private.is_platform_university_manager()));

create policy "platform owner deletes universities"
on public.korean_universities for delete to authenticated
using ((select private.is_platform_university_owner()));

drop policy if exists "authenticated read university document requirements"
  on public.university_application_document_requirements;
drop policy if exists "platform catalog managers manage document requirements"
  on public.university_application_document_requirements;

create policy "authenticated read active university document requirements"
on public.university_application_document_requirements for select to authenticated
using (is_active = true or (select private.is_platform_university_manager()));

create policy "platform university managers manage document requirements"
on public.university_application_document_requirements for all to authenticated
using ((select private.is_platform_university_manager()))
with check ((select private.is_platform_university_manager()));

drop policy if exists "authenticated read university visa requirements"
  on public.university_visa_application_requirements;
drop policy if exists "platform catalog managers manage visa requirements"
  on public.university_visa_application_requirements;

create policy "authenticated read active university visa requirements"
on public.university_visa_application_requirements for select to authenticated
using (is_active = true or (select private.is_platform_university_manager()));

create policy "platform university managers manage visa requirements"
on public.university_visa_application_requirements for all to authenticated
using ((select private.is_platform_university_manager()))
with check ((select private.is_platform_university_manager()));

comment on function private.is_platform_university_manager() is
  '韩国大学公共资料写权限：仅平台负责人和平台管理员';
comment on function private.is_platform_university_owner() is
  '韩国大学永久删除权限：仅平台负责人';

commit;
