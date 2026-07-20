-- 将永久删除租户 RPC 中的动态表名循环展开为显式语句。
-- 这样 PostgreSQL/Supabase lint 可以验证每张表和 tenant_id 字段，同时保留
-- 原有的子表优先删除顺序。

begin;

create or replace function public.delete_tenant_permanently(
  requested_tenant_id uuid,
  requested_slug_confirmation text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.tenants%rowtype;
  removed_members integer := 0;
begin
  if not private.is_platform_tenant_manager() then
    raise exception '只有负责人或副负责人可以永久删除租户';
  end if;

  select * into target
  from public.tenants
  where id = requested_tenant_id
  for update;

  if not found then
    raise exception '租户不存在';
  end if;
  if target.id = '00000000-0000-4000-8000-000000000001'::uuid then
    raise exception '默认 PUFFY 租户不能永久删除';
  end if;
  if target.status not in ('suspended', 'archived') then
    raise exception '请先停用租户，再执行永久删除';
  end if;
  if lower(btrim(requested_slug_confirmation)) <> target.slug then
    raise exception '删除确认租户标识不正确';
  end if;

  perform set_config('app.tenant_hard_delete', 'on', true);

  -- 子表在前、父表在后，避免 restrict/复合外键阻塞。
  delete from public.student_visa_task_events where tenant_id = target.id;
  delete from public.student_visa_tasks where tenant_id = target.id;
  delete from public.student_visa_cases where tenant_id = target.id;

  delete from public.student_application_documents where tenant_id = target.id;
  delete from public.student_university_assessments where tenant_id = target.id;
  delete from public.student_university_comparisons where tenant_id = target.id;
  delete from public.student_university_targets where tenant_id = target.id;

  delete from public.learning_submission_answers where tenant_id = target.id;
  delete from public.learning_submissions where tenant_id = target.id;
  delete from public.learning_assignment_question_keys where tenant_id = target.id;
  delete from public.learning_assignment_targets where tenant_id = target.id;
  delete from public.learning_assignment_questions where tenant_id = target.id;
  delete from public.grade_review_requests where tenant_id = target.id;
  delete from public.grade_records where tenant_id = target.id;
  delete from public.grade_items where tenant_id = target.id;
  delete from public.learning_assignments where tenant_id = target.id;

  delete from public.help_ticket_messages where tenant_id = target.id;
  delete from public.help_tickets where tenant_id = target.id;
  delete from public.help_articles where tenant_id = target.id;

  delete from public.conversation_practice_progress where tenant_id = target.id;
  delete from public.conversation_practice_scenarios where tenant_id = target.id;

  delete from public.library_downloads where tenant_id = target.id;
  delete from public.library_favorites where tenant_id = target.id;
  delete from public.library_resources where tenant_id = target.id;
  delete from public.learning_record_notes where tenant_id = target.id;
  delete from public.announcements where tenant_id = target.id;

  delete from public.announcement_admin_assignments where tenant_id = target.id;
  delete from public.conversation_practice_admin_assignments where tenant_id = target.id;
  delete from public.help_center_admin_assignments where tenant_id = target.id;
  delete from public.grade_center_admin_assignments where tenant_id = target.id;
  delete from public.learning_record_admin_assignments where tenant_id = target.id;
  delete from public.library_admin_assignments where tenant_id = target.id;

  delete from public.lesson_progress where tenant_id = target.id;
  delete from public.lesson_questions where tenant_id = target.id;
  delete from public.lesson_resources where tenant_id = target.id;
  delete from public.lessons where tenant_id = target.id;
  delete from public.courses where tenant_id = target.id;
  delete from public.course_categories where tenant_id = target.id;

  delete from public.ai_token_usage where tenant_id = target.id;
  delete from public.account_management_audit_logs where tenant_id = target.id;
  delete from public.account_deletion_audit_logs where tenant_id = target.id;
  delete from public.course_content_audit_logs where tenant_id = target.id;
  delete from public.student_service_card_deletion_logs where tenant_id = target.id;

  delete from public.tenant_provisioned_accounts where tenant_id = target.id;
  delete from public.tenant_memberships where tenant_id = target.id;
  get diagnostics removed_members = row_count;
  delete from public.tenant_membership_audit_logs where tenant_id = target.id;
  delete from public.tenants where id = target.id;

  insert into public.tenant_lifecycle_audit_logs (
    tenant_id,
    tenant_slug,
    actor_id,
    action,
    details
  ) values (
    target.id,
    target.slug,
    auth.uid(),
    'permanently_deleted',
    jsonb_build_object('removed_memberships', removed_members)
  );
end;
$$;

comment on function public.delete_tenant_permanently(uuid, text) is
  '永久删除租户：以可静态检查的显式顺序清空业务数据、成员关系与租户本体';

commit;
