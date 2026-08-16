begin;

-- 留学服务已经进入独立应用工作区。资料、签证和服务分析不再继续使用
-- 旧的全局模块授权，而是与管理端入口共用 study-abroad 的应用能力。
create or replace function public.current_user_can_manage_document_reviews()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_account()
    and private.current_staff_has_app_capability(
      private.current_tenant_id(),
      '10000000-0000-4000-8000-000000000005'::uuid,
      'manage_assessments'
    );
$$;

create or replace function public.current_user_can_manage_visas()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_account()
    and private.current_staff_has_app_capability(
      private.current_tenant_id(),
      '10000000-0000-4000-8000-000000000005'::uuid,
      'manage_assessments'
    );
$$;

create or replace function public.current_user_can_view_study_abroad_service()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_account()
    and private.current_staff_has_app_capability(
      private.current_tenant_id(),
      '10000000-0000-4000-8000-000000000005'::uuid,
      'view_analytics'
    );
$$;

revoke all on function public.current_user_can_manage_document_reviews() from public, anon;
revoke all on function public.current_user_can_manage_visas() from public, anon;
revoke all on function public.current_user_can_view_study_abroad_service() from public, anon;
grant execute on function public.current_user_can_manage_document_reviews() to authenticated, service_role;
grant execute on function public.current_user_can_manage_visas() to authenticated, service_role;
grant execute on function public.current_user_can_view_study_abroad_service() to authenticated, service_role;

-- 学生自己的留学数据也必须同时满足“机构应用运行中 + 当前学生有效授权”。
-- 仅有会员档位或知道接口地址，不再能够绕过应用入口直接读写。
drop policy if exists "tenant students manage own university targets"
  on public.student_university_targets;
create policy "tenant students manage own university targets"
on public.student_university_targets for all to authenticated
using (
  (
    tenant_id = (select private.current_tenant_id())
    and user_id = (select auth.uid())
    and public.student_feature_allowed('university_target')
    and private.current_student_has_app_access(
      tenant_id, user_id, '10000000-0000-4000-8000-000000000005'::uuid
    )
  )
  or (select private.is_platform_owner())
)
with check (
  (
    tenant_id = (select private.current_tenant_id())
    and user_id = (select auth.uid())
    and public.student_feature_allowed('university_target')
    and private.current_student_has_app_access(
      tenant_id, user_id, '10000000-0000-4000-8000-000000000005'::uuid
    )
  )
  or (select private.is_platform_owner())
);

drop policy if exists "tenant targets read own or staff"
  on public.student_university_targets;
create policy "tenant targets read own or application staff"
on public.student_university_targets for select to authenticated
using (
  (
    tenant_id = (select private.current_tenant_id())
    and (
      (
        user_id = (select auth.uid())
        and private.current_student_has_app_access(
          tenant_id, user_id, '10000000-0000-4000-8000-000000000005'::uuid
        )
      )
      or private.current_staff_has_app_capability(
        tenant_id,
        '10000000-0000-4000-8000-000000000005'::uuid,
        'view_analytics'
      )
    )
  )
  or (select private.is_platform_owner())
);

drop policy if exists "tenant admins update university targets"
  on public.student_university_targets;
create policy "study abroad managers update university targets"
on public.student_university_targets for update to authenticated
using (
  (
    tenant_id = (select private.current_tenant_id())
    and private.current_staff_has_app_capability(
      tenant_id,
      '10000000-0000-4000-8000-000000000005'::uuid,
      'manage_assessments'
    )
  )
  or (select private.is_platform_owner())
)
with check (
  (
    tenant_id = (select private.current_tenant_id())
    and private.current_staff_has_app_capability(
      tenant_id,
      '10000000-0000-4000-8000-000000000005'::uuid,
      'manage_assessments'
    )
  )
  or (select private.is_platform_owner())
);

drop policy if exists "tenant assessments read own or staff"
  on public.student_university_assessments;
create policy "tenant assessments read own or application staff"
on public.student_university_assessments for select to authenticated
using (
  (
    tenant_id = (select private.current_tenant_id())
    and (
      (
        user_id = (select auth.uid())
        and private.current_student_has_app_access(
          tenant_id, user_id, '10000000-0000-4000-8000-000000000005'::uuid
        )
      )
      or private.current_staff_has_app_capability(
        tenant_id,
        '10000000-0000-4000-8000-000000000005'::uuid,
        'view_analytics'
      )
    )
  )
  or (select private.is_platform_owner())
);

drop policy if exists "tenant students create own university assessments"
  on public.student_university_assessments;
create policy "tenant students create own university assessments"
on public.student_university_assessments for insert to authenticated
with check (
  (
    tenant_id = (select private.current_tenant_id())
    and user_id = (select auth.uid())
    and public.student_feature_allowed('university_target')
    and private.current_student_has_app_access(
      tenant_id, user_id, '10000000-0000-4000-8000-000000000005'::uuid
    )
  )
  or (select private.is_platform_owner())
);

drop policy if exists "tenant students manage own university comparisons"
  on public.student_university_comparisons;
create policy "tenant students manage own university comparisons"
on public.student_university_comparisons for all to authenticated
using (
  (
    tenant_id = (select private.current_tenant_id())
    and user_id = (select auth.uid())
    and public.student_feature_allowed('university_comparison')
    and private.current_student_has_app_access(
      tenant_id, user_id, '10000000-0000-4000-8000-000000000005'::uuid
    )
  )
  or (select private.is_platform_owner())
)
with check (
  (
    tenant_id = (select private.current_tenant_id())
    and user_id = (select auth.uid())
    and public.student_feature_allowed('university_comparison')
    and private.current_student_has_app_access(
      tenant_id, user_id, '10000000-0000-4000-8000-000000000005'::uuid
    )
  )
  or (select private.is_platform_owner())
);

-- 读取服务分析只需要 view_analytics；审核和状态修改仍必须有
-- manage_assessments，避免只读观察者借同一个函数获得写权限。
drop policy if exists "tenant application documents read own or reviewers"
  on public.student_application_documents;
create policy "tenant application documents read own or application staff"
on public.student_application_documents for select to authenticated
using (
  (select private.is_platform_owner())
  or (
    tenant_id = (select private.current_tenant_id())
    and (
      (
        user_id = (select auth.uid())
        and private.current_student_has_app_access(
          tenant_id, user_id, '10000000-0000-4000-8000-000000000005'::uuid
        )
      )
      or public.current_user_can_view_study_abroad_service()
    )
  )
);

drop policy if exists "tenant students update own checklist status"
  on public.student_application_documents;
create policy "tenant students update own checklist status"
on public.student_application_documents for update to authenticated
using (
  (
    tenant_id = (select private.current_tenant_id())
    and user_id = (select auth.uid())
    and status in ('preparing', 'completed', 'not_needed')
    and public.student_feature_allowed('application_documents')
    and private.current_student_has_app_access(
      tenant_id, user_id, '10000000-0000-4000-8000-000000000005'::uuid
    )
  )
  or (select private.is_platform_owner())
)
with check (
  (
    tenant_id = (select private.current_tenant_id())
    and user_id = (select auth.uid())
    and status in ('preparing', 'completed', 'not_needed')
    and public.student_feature_allowed('application_documents')
    and private.current_student_has_app_access(
      tenant_id, user_id, '10000000-0000-4000-8000-000000000005'::uuid
    )
  )
  or (select private.is_platform_owner())
);

drop policy if exists "document review managers read events"
  on public.document_review_events;
create policy "document review application staff read events"
on public.document_review_events for select to authenticated
using (
  (select private.is_platform_owner())
  or (
    tenant_id = (select private.current_tenant_id())
    and public.current_user_can_view_study_abroad_service()
  )
);

drop policy if exists "tenant visa cases read own or managers"
  on public.student_visa_cases;
create policy "tenant visa cases read own or application staff"
on public.student_visa_cases for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (
    (
      user_id = (select auth.uid())
      and private.current_student_has_app_access(
        tenant_id, user_id, '10000000-0000-4000-8000-000000000005'::uuid
      )
    )
    or public.current_user_can_view_study_abroad_service()
  )
);

drop policy if exists "tenant students create own visa case"
  on public.student_visa_cases;
create policy "tenant students create own visa case"
on public.student_visa_cases for insert to authenticated
with check (
  (
    tenant_id = (select private.current_tenant_id())
    and user_id = (select auth.uid())
    and public.student_feature_allowed('visa_tasks')
    and private.current_student_has_app_access(
      tenant_id, user_id, '10000000-0000-4000-8000-000000000005'::uuid
    )
  )
  or (select private.is_platform_owner())
  or coalesce(current_setting('app.system_managed_visa_sync', true), '') = 'on'
);

drop policy if exists "tenant students update own visa case"
  on public.student_visa_cases;
create policy "tenant students update own visa case"
on public.student_visa_cases for update to authenticated
using (
  (
    tenant_id = (select private.current_tenant_id())
    and user_id = (select auth.uid())
    and public.student_feature_allowed('visa_tasks')
    and private.current_student_has_app_access(
      tenant_id, user_id, '10000000-0000-4000-8000-000000000005'::uuid
    )
  )
  or (select private.is_platform_owner())
  or coalesce(current_setting('app.system_managed_visa_sync', true), '') = 'on'
)
with check (
  (
    tenant_id = (select private.current_tenant_id())
    and user_id = (select auth.uid())
    and public.student_feature_allowed('visa_tasks')
    and private.current_student_has_app_access(
      tenant_id, user_id, '10000000-0000-4000-8000-000000000005'::uuid
    )
  )
  or (select private.is_platform_owner())
  or coalesce(current_setting('app.system_managed_visa_sync', true), '') = 'on'
);

drop policy if exists "tenant visa tasks read own or managers"
  on public.student_visa_tasks;
create policy "tenant visa tasks read own or application staff"
on public.student_visa_tasks for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (
    (
      user_id = (select auth.uid())
      and is_archived = false
      and private.current_student_has_app_access(
        tenant_id, user_id, '10000000-0000-4000-8000-000000000005'::uuid
      )
    )
    or public.current_user_can_view_study_abroad_service()
  )
);

drop policy if exists "tenant students create active own visa tasks"
  on public.student_visa_tasks;
create policy "tenant students create active own visa tasks"
on public.student_visa_tasks for insert to authenticated
with check (
  (
    tenant_id = (select private.current_tenant_id())
    and user_id = (select auth.uid())
    and is_archived = false
    and public.student_feature_allowed('visa_tasks')
    and private.current_student_has_app_access(
      tenant_id, user_id, '10000000-0000-4000-8000-000000000005'::uuid
    )
  )
  or (select private.is_platform_owner())
  or coalesce(current_setting('app.system_managed_visa_sync', true), '') = 'on'
);

drop policy if exists "tenant students update active own visa tasks"
  on public.student_visa_tasks;
create policy "tenant students update active own visa tasks"
on public.student_visa_tasks for update to authenticated
using (
  (
    tenant_id = (select private.current_tenant_id())
    and user_id = (select auth.uid())
    and is_archived = false
    and public.student_feature_allowed('visa_tasks')
    and private.current_student_has_app_access(
      tenant_id, user_id, '10000000-0000-4000-8000-000000000005'::uuid
    )
  )
  or (select private.is_platform_owner())
)
with check (
  (
    tenant_id = (select private.current_tenant_id())
    and user_id = (select auth.uid())
    and is_archived = false
    and public.student_feature_allowed('visa_tasks')
    and private.current_student_has_app_access(
      tenant_id, user_id, '10000000-0000-4000-8000-000000000005'::uuid
    )
  )
  or (select private.is_platform_owner())
);

drop policy if exists "tenant visa task events read own or managers"
  on public.student_visa_task_events;
create policy "tenant visa task events read own or application staff"
on public.student_visa_task_events for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (
    (
      user_id = (select auth.uid())
      and private.current_student_has_app_access(
        tenant_id, user_id, '10000000-0000-4000-8000-000000000005'::uuid
      )
    )
    or public.current_user_can_view_study_abroad_service()
  )
);

-- 机构只能把平台已经正式开放的应用切为运行中。建设中的英语、数学和
-- 大学课程仍可在管理端预先配置内容与人员，但不会提前暴露空学生空间。
create or replace function public.set_tenant_application_settings(
  p_app_id uuid,
  p_is_enabled boolean,
  p_status text,
  p_custom_title text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_custom_title text := nullif(btrim(coalesce(p_custom_title, '')), '');
  v_platform_status text;
begin
  if v_tenant_id is null
    or not private.current_staff_has_app_capability(
      v_tenant_id, p_app_id, 'manage_availability'
    ) then
    raise exception '只有机构负责人可以修改应用开放设置';
  end if;
  if p_status not in ('active', 'coming_soon', 'hidden') then
    raise exception '机构应用状态不正确';
  end if;
  if char_length(coalesce(v_custom_title, '')) > 80 then
    raise exception '应用显示名称不能超过 80 个字';
  end if;

  select app.default_status into v_platform_status
  from public.student_apps as app
  where app.id = p_app_id;
  if not found then
    raise exception '平台应用不存在';
  end if;
  if p_status = 'active' and v_platform_status <> 'active' then
    raise exception '平台标准应用仍在建设中，暂时不能切换为运行中';
  end if;

  update public.tenant_student_apps
  set is_enabled = p_is_enabled,
      status = p_status,
      custom_title = v_custom_title,
      updated_at = now()
  where tenant_id = v_tenant_id
    and app_id = p_app_id;
  if not found then
    raise exception '当前机构没有注册该应用';
  end if;
end;
$$;

revoke all on function public.set_tenant_application_settings(uuid, boolean, text, text)
  from public, anon;
grant execute on function public.set_tenant_application_settings(uuid, boolean, text, text)
  to authenticated, service_role;

commit;
