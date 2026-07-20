-- 移除历史 PUFFY 兼容租户及其调试数据。
-- 新员工/学生账号改由平台负责人或机构负责人显式创建并绑定租户。
begin;

-- 新 profile 不再自动落入固定 PUFFY 租户；开户动作会显式创建成员关系。
drop trigger if exists profiles_attach_bootstrap_tenant on public.profiles;
drop function if exists private.attach_new_profile_to_bootstrap_tenant();

-- 课程定义属于平台内容，不属于某个租户；学习进度、提问等用户数据仍按租户隔离。
alter table public.course_categories add column if not exists content_scope text not null default 'tenant';
alter table public.courses add column if not exists content_scope text not null default 'tenant';
alter table public.lessons add column if not exists content_scope text not null default 'tenant';
alter table public.lesson_resources add column if not exists content_scope text not null default 'tenant';

alter table public.course_categories alter column tenant_id drop not null;
alter table public.courses alter column tenant_id drop not null;
alter table public.lessons alter column tenant_id drop not null;
alter table public.lesson_resources alter column tenant_id drop not null;

alter table public.course_categories add constraint course_categories_content_scope_check
  check ((content_scope = 'platform' and tenant_id is null) or (content_scope = 'tenant' and tenant_id is not null));
alter table public.courses add constraint courses_content_scope_check
  check ((content_scope = 'platform' and tenant_id is null) or (content_scope = 'tenant' and tenant_id is not null));
alter table public.lessons add constraint lessons_content_scope_check
  check ((content_scope = 'platform' and tenant_id is null) or (content_scope = 'tenant' and tenant_id is not null));
alter table public.lesson_resources add constraint lesson_resources_content_scope_check
  check ((content_scope = 'platform' and tenant_id is null) or (content_scope = 'tenant' and tenant_id is not null));

create unique index course_categories_platform_slug_key on public.course_categories (slug) where content_scope = 'platform';
create unique index courses_platform_slug_key on public.courses (slug) where content_scope = 'platform';

-- 平台课程可被各租户学生学习，因此用户数据用普通内容 ID 外键，租户隔离由用户数据自身 tenant_id 保证。
alter table public.lesson_progress drop constraint lesson_progress_lesson_id_fkey;
alter table public.lesson_progress add constraint lesson_progress_lesson_id_fkey foreign key (lesson_id) references public.lessons(id) on delete cascade;
alter table public.lesson_progress drop constraint lesson_progress_course_id_fkey;
alter table public.lesson_progress add constraint lesson_progress_course_id_fkey foreign key (course_id) references public.courses(id) on delete cascade;
alter table public.lesson_questions drop constraint lesson_questions_lesson_id_fkey;
alter table public.lesson_questions add constraint lesson_questions_lesson_id_fkey foreign key (lesson_id) references public.lessons(id) on delete cascade;
alter table public.lesson_questions drop constraint lesson_questions_course_id_fkey;
alter table public.lesson_questions add constraint lesson_questions_course_id_fkey foreign key (course_id) references public.courses(id) on delete cascade;
alter table public.learning_assignments drop constraint learning_assignments_course_id_fkey;
alter table public.learning_assignments add constraint learning_assignments_course_id_fkey foreign key (course_id) references public.courses(id) on delete set null;

-- 平台负责人新建课程时自动写为平台内容；普通机构写入仍自动补当前 tenant_id。
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
  if private.is_platform_owner() and tg_table_name in ('course_categories', 'courses', 'lessons', 'lesson_resources') then
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
  if new.tenant_id is null then raise exception '缺少租户上下文，拒绝写入：服务端任务必须显式提供 tenant_id'; end if;
  return new;
end;
$$;

create policy "authenticated users read published platform course categories"
on public.course_categories for select to authenticated
using (content_scope = 'platform' and is_published);
create policy "authenticated users read published platform courses"
on public.courses for select to authenticated
using (content_scope = 'platform' and is_published);
create policy "authenticated users read published platform lessons"
on public.lessons for select to authenticated
using (content_scope = 'platform' and is_published);
create policy "authenticated users read published platform lesson resources"
on public.lesson_resources for select to authenticated
using (content_scope = 'platform' and is_published);

create temporary table puffy_users_to_remove (
  user_id uuid primary key
) on commit drop;

insert into puffy_users_to_remove (user_id)
select membership.user_id
from public.tenant_memberships as membership
where membership.tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
  and not exists (
    select 1
    from public.tenant_memberships as other
    where other.user_id = membership.user_id
      and other.tenant_id <> membership.tenant_id
  )
  and not exists (
    select 1
    from public.profiles as profile
    where profile.id = membership.user_id
      and profile.role in ('platform_super_admin', 'tenant_operator')
  );

select set_config('app.tenant_hard_delete', 'on', true);

delete from public.student_visa_task_events where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.student_visa_tasks where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.student_visa_cases where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.student_application_documents where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.student_university_assessments where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.student_university_comparisons where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.student_university_targets where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.learning_submission_answers where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.learning_submissions where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.learning_assignment_question_keys where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.learning_assignment_targets where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.learning_assignment_questions where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.grade_review_requests where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.grade_records where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.grade_items where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.learning_assignments where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.help_ticket_messages where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.help_tickets where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.help_articles where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.conversation_practice_progress where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.conversation_practice_scenarios where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.library_downloads where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.library_favorites where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.library_resources where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.learning_record_notes where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.announcements where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.announcement_admin_assignments where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.conversation_practice_admin_assignments where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.help_center_admin_assignments where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.grade_center_admin_assignments where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.learning_record_admin_assignments where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.library_admin_assignments where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.lesson_progress where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.lesson_questions where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;

-- 保留真实课程内容并转为平台共享；按子表到父表顺序解除租户归属。
select set_config('app.platform_content_migration', 'on', true);
alter table public.lesson_resources disable trigger user;
alter table public.lessons disable trigger user;
alter table public.courses disable trigger user;
alter table public.course_categories disable trigger user;
update public.lesson_resources set content_scope = 'platform', tenant_id = null where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
update public.lessons set content_scope = 'platform', tenant_id = null where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
update public.courses set content_scope = 'platform', tenant_id = null where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
update public.course_categories set content_scope = 'platform', tenant_id = null where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
alter table public.lesson_resources enable trigger user;
alter table public.lessons enable trigger user;
alter table public.courses enable trigger user;
alter table public.course_categories enable trigger user;

delete from public.lesson_resources where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.lessons where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.courses where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.course_categories where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.ai_token_usage where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.account_management_audit_logs where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.account_deletion_audit_logs where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.course_content_audit_logs where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.student_service_card_deletion_logs where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.tenant_provisioned_accounts where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.tenant_memberships where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.tenant_membership_audit_logs where tenant_id = '00000000-0000-4000-8000-000000000001'::uuid;
delete from public.tenants where id = '00000000-0000-4000-8000-000000000001'::uuid;

-- 仅删除只属于该调试租户的认证账号；跨租户账号和平台账号不受影响。
delete from auth.users as auth_user
using puffy_users_to_remove as removable
where auth_user.id = removable.user_id;

insert into public.tenant_lifecycle_audit_logs (
  tenant_id, tenant_slug, actor_id, action, details
) values (
  '00000000-0000-4000-8000-000000000001'::uuid,
  'puffy',
  null,
  'permanently_deleted',
  jsonb_build_object('reason', 'removed legacy bootstrap tenant and debug accounts')
);

commit;
