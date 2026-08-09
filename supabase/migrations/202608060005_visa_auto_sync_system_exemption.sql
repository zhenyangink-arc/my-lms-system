begin;

-- 申请阶段推进到第九步时，initialize_visa_workspace_from_application_stage 触发器
-- 会自动创建/更新签证档案(student_visa_cases)、初始化签证任务(student_visa_tasks)。
-- 这些内部写入的 user_id 是"学生本人"，但发起动作的是推进阶段的机构管理员——如果这个
-- 管理员本人没有被单独授权"签证管理"权限，RLS 的 "user_id = auth.uid() 或
-- is_platform_owner()" 判断两边都对不上，整个联动会被拦下、连带把阶段推进本身也回滚。
--
-- 用和 app.tenant_hard_delete / app.platform_content_migration 一样的会话级开关模式：
-- 触发器在自己内部联动写入前显式打开这个开关，RLS 策略认这个开关放行，其余场景
-- （用户自己主动新建/编辑签证任务）不受影响。
create or replace function public.initialize_visa_workspace_from_application_stage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_case_id uuid;
  resolved_visa_type text;
  actual_visa_type text;
begin
  if new.visa_application_channel is null then
    raise exception '请先确认签证办理方式，再点亮第九步';
  end if;

  resolved_visa_type := case
    when new.admission_track = 'language' or new.degree_level = 'language' then 'd4_language'
    when new.admission_track in ('bachelor_fresh', 'bachelor_transfer') or new.degree_level = 'bachelor' then 'd2_bachelor'
    when new.admission_track = 'master' or new.degree_level = 'master' then 'd2_master'
    when new.admission_track = 'doctor' or new.degree_level = 'doctor' then 'd2_doctor'
    else 'd4_language'
  end;

  perform set_config('app.system_managed_visa_sync', 'on', true);

  created_case_id := public.initialize_student_visa_workspace_for_user(new.user_id, resolved_visa_type);

  update public.student_visa_cases
  set
    source_target_id = new.id,
    application_channel = new.visa_application_channel
  where id = created_case_id
    and (
      source_target_id is distinct from new.id
      or application_channel is distinct from new.visa_application_channel
    );

  select visa_type into actual_visa_type
  from public.student_visa_cases
  where id = created_case_id;

  perform public.initialize_student_visa_requirements(
    new.user_id,
    new.id,
    actual_visa_type
  );

  return new;
end;
$$;

alter policy "tenant students create own visa case"
on public.student_visa_cases
with check (
  (
    (tenant_id = (select private.current_tenant_id()))
    and (user_id = (select auth.uid()))
    and student_feature_allowed('visa_tasks')
  )
  or (select private.is_platform_owner())
  or coalesce(current_setting('app.system_managed_visa_sync', true), '') = 'on'
);

alter policy "tenant students update own visa case"
on public.student_visa_cases
using (
  (
    (tenant_id = (select private.current_tenant_id()))
    and (user_id = (select auth.uid()))
    and student_feature_allowed('visa_tasks')
  )
  or (select private.is_platform_owner())
  or coalesce(current_setting('app.system_managed_visa_sync', true), '') = 'on'
)
with check (
  (
    (tenant_id = (select private.current_tenant_id()))
    and (user_id = (select auth.uid()))
    and student_feature_allowed('visa_tasks')
  )
  or (select private.is_platform_owner())
  or coalesce(current_setting('app.system_managed_visa_sync', true), '') = 'on'
);

alter policy "tenant students create active own visa tasks"
on public.student_visa_tasks
with check (
  (
    (tenant_id = (select private.current_tenant_id()))
    and (user_id = (select auth.uid()))
    and (is_archived = false)
    and student_feature_allowed('visa_tasks')
  )
  or (select private.is_platform_owner())
  or coalesce(current_setting('app.system_managed_visa_sync', true), '') = 'on'
);

commit;
