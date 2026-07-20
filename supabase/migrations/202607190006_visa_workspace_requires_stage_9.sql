-- ============================================================
-- 签证准备入口改为申请进度阶段 9：请进入申请签证页面。
-- 阶段 6-8 不再自动建立或展示签证工作区。
-- ============================================================

create or replace function public.initialize_student_visa_workspace()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_visa_type text;
begin
  if auth.uid() is null or not public.student_feature_allowed('visa_tasks') then
    raise exception '当前账号没有签证准备操作权限';
  end if;

  select case
    when target.admission_track = 'language' or target.degree_level = 'language' then 'd4_language'
    when target.admission_track in ('bachelor_fresh', 'bachelor_transfer') or target.degree_level = 'bachelor' then 'd2_bachelor'
    when target.admission_track = 'master' or target.degree_level = 'master' then 'd2_master'
    when target.admission_track = 'doctor' or target.degree_level = 'doctor' then 'd2_doctor'
    else 'd4_language'
  end
  into resolved_visa_type
  from public.student_university_targets as target
  where target.user_id = auth.uid()
    and target.application_stage >= 9
  order by target.application_stage desc, target.priority desc, target.updated_at desc
  limit 1;

  if not found then
    raise exception '申请进度到达第九步后才会建立签证准备路线';
  end if;

  return public.initialize_student_visa_workspace_for_user(auth.uid(), resolved_visa_type);
end;
$$;

drop trigger if exists initialize_visa_workspace_from_application_stage
  on public.student_university_targets;

create trigger initialize_visa_workspace_from_application_stage
after update of application_stage
on public.student_university_targets
for each row
when (old.application_stage < 9 and new.application_stage >= 9)
execute function public.initialize_visa_workspace_from_application_stage();

-- 为迁移执行前已经到达阶段 9 的学生补建档案和任务。
do $$
declare
  eligible_target record;
  resolved_visa_type text;
begin
  for eligible_target in
    select distinct on (target.user_id)
      target.user_id,
      target.admission_track,
      target.degree_level
    from public.student_university_targets as target
    where target.application_stage >= 9
    order by target.user_id, target.application_stage desc, target.priority desc, target.updated_at desc
  loop
    resolved_visa_type := case
      when eligible_target.admission_track = 'language' or eligible_target.degree_level = 'language' then 'd4_language'
      when eligible_target.admission_track in ('bachelor_fresh', 'bachelor_transfer') or eligible_target.degree_level = 'bachelor' then 'd2_bachelor'
      when eligible_target.admission_track = 'master' or eligible_target.degree_level = 'master' then 'd2_master'
      when eligible_target.admission_track = 'doctor' or eligible_target.degree_level = 'doctor' then 'd2_doctor'
      else 'd4_language'
    end;

    perform public.initialize_student_visa_workspace_for_user(
      eligible_target.user_id,
      resolved_visa_type
    );
  end loop;
end;
$$;

grant execute on function public.initialize_student_visa_workspace()
  to authenticated;

comment on function public.initialize_student_visa_workspace() is
  '阶段 9 之后为当前学生补建签证档案；正常情况下由申请阶段触发器自动完成';
comment on function public.initialize_visa_workspace_from_application_stage() is
  '申请资料进度首次到达阶段 9 时自动建立学生签证工作区';

notify pgrst, 'reload schema';
