begin;

-- Tenant-only dashboard summaries. These functions intentionally remain
-- SECURITY INVOKER so the caller's existing table RLS is still applied. The
-- explicit tenant guard and repeated tenant predicates prevent a batched
-- request from widening the scope of the count queries it replaces.
create or replace function public.get_tenant_admin_dashboard_summary(
  p_tenant_id uuid
)
returns table (
  active_members bigint,
  published_assignments bigint,
  draft_assignments bigint,
  published_announcements bigint,
  draft_announcements bigint,
  open_help_tickets bigint,
  pending_grade_reviews bigint,
  pending_document_reviews bigint,
  pending_visa_tasks bigint,
  attention_records bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $function$
begin
  if p_tenant_id is null
    or p_tenant_id is distinct from private.current_tenant_id()
    or not public.is_admin_account()
  then
    raise exception '无权读取该机构的管理首页汇总'
      using errcode = '42501';
  end if;

  return query
  select
    (
      select count(*)::bigint
      from public.tenant_memberships as membership
      where membership.tenant_id = p_tenant_id
        and membership.status = 'active'
    ),
    (
      select count(*)::bigint
      from public.learning_assignments as assignment
      where assignment.tenant_id = p_tenant_id
        and assignment.status = 'published'
    ),
    (
      select count(*)::bigint
      from public.learning_assignments as assignment
      where assignment.tenant_id = p_tenant_id
        and assignment.status = 'draft'
    ),
    (
      select count(*)::bigint
      from public.announcements as announcement
      where announcement.tenant_id = p_tenant_id
        and announcement.scope = 'tenant'
        and announcement.status = 'published'
    ),
    (
      select count(*)::bigint
      from public.announcements as announcement
      where announcement.tenant_id = p_tenant_id
        and announcement.scope = 'tenant'
        and announcement.status = 'draft'
    ),
    (
      select count(*)::bigint
      from public.help_tickets as ticket
      where ticket.tenant_id = p_tenant_id
        and ticket.status in ('open', 'in_progress')
    ),
    (
      select count(*)::bigint
      from public.grade_review_requests as review
      where review.tenant_id = p_tenant_id
        and review.status = 'pending'
    ),
    (
      select count(*)::bigint
      from public.student_university_targets as target
      where target.tenant_id = p_tenant_id
        and target.document_review_status = 'pending_review'
    ),
    (
      select count(*)::bigint
      from public.student_visa_tasks as task
      where task.tenant_id = p_tenant_id
        and not task.is_archived
        and task.status in (
          'submitted', 'reviewing', 'revision_required', 'blocked'
        )
    ),
    (
      select count(*)::bigint
      from public.learning_record_notes as note
      where note.tenant_id = p_tenant_id
        and note.status = 'active'
        and note.record_type = 'attention'
    );
end;
$function$;

create or replace function public.get_tenant_management_app_metrics(
  p_tenant_id uuid,
  p_app_ids uuid[]
)
returns table (
  app_id uuid,
  students bigint,
  work_items bigint,
  staff bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $function$
begin
  if p_tenant_id is null
    or p_tenant_id is distinct from private.current_tenant_id()
    or not public.is_admin_account()
  then
    raise exception '无权读取该机构的应用汇总'
      using errcode = '42501';
  end if;

  return query
  with requested_apps as (
    select distinct requested_app_id as app_id
    from unnest(coalesce(p_app_ids, array[]::uuid[])) as requested_app_id
  )
  select
    requested.app_id,
    (
      select count(*)::bigint
      from public.student_app_enrollments as enrollment
      where enrollment.tenant_id = p_tenant_id
        and enrollment.app_id = requested.app_id
        and enrollment.status = 'active'
    ) as students,
    case
      when requested.app_id = '10000000-0000-4000-8000-000000000005'::uuid
      then (
        select count(*)::bigint
        from public.student_university_targets as target
        where target.tenant_id = p_tenant_id
      )
      else (
        select count(*)::bigint
        from public.learning_assignments as assignment
        where assignment.tenant_id = p_tenant_id
          and assignment.student_app_id = requested.app_id
      )
    end as work_items,
    (
      select count(*)::bigint
      from public.staff_app_assignments as staff_assignment
      where staff_assignment.tenant_id = p_tenant_id
        and staff_assignment.app_id = requested.app_id
        and staff_assignment.status = 'active'
    ) as staff
  from requested_apps as requested;
end;
$function$;

revoke all on function public.get_tenant_admin_dashboard_summary(uuid)
  from public, anon;
revoke all on function public.get_tenant_management_app_metrics(uuid, uuid[])
  from public, anon;
grant execute on function public.get_tenant_admin_dashboard_summary(uuid)
  to authenticated, service_role;
grant execute on function public.get_tenant_management_app_metrics(uuid, uuid[])
  to authenticated, service_role;

comment on function public.get_tenant_admin_dashboard_summary(uuid) is
  '当前租户管理员的管理首页聚合计数；显式绑定 current_tenant_id，并继续应用调用者 RLS。';
comment on function public.get_tenant_management_app_metrics(uuid, uuid[]) is
  '当前租户管理员按可见应用读取聚合指标；所有租户业务表都显式按 tenant_id 限定。';

commit;
