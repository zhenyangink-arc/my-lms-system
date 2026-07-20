-- ============================================================
-- 申请资料进度到达阶段 6（审核完毕并颁发标准入学许可书）时，
-- 自动为学生建立签证档案和标准准备任务。
-- ============================================================

create or replace function public.initialize_student_visa_workspace_for_user(
  requested_user_id uuid,
  requested_visa_type text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_case_id uuid;
  resolved_visa_type text;
begin
  if requested_user_id is null then
    raise exception '缺少学生账号';
  end if;

  resolved_visa_type := case
    when requested_visa_type in ('d4_language', 'd2_bachelor', 'd2_master', 'd2_doctor')
      then requested_visa_type
    else 'd4_language'
  end;

  insert into public.student_visa_cases (user_id, visa_type)
  values (requested_user_id, resolved_visa_type)
  on conflict (user_id) do nothing;

  select id into created_case_id
  from public.student_visa_cases
  where user_id = requested_user_id;

  insert into public.student_visa_tasks (
    user_id,
    task_key,
    title,
    description,
    stage,
    sort_order
  )
  values
    (requested_user_id, 'admission', '确认标准入学许可书', '核对学校、课程、入学时间和签发信息。', 'admission', 10),
    (requested_user_id, 'passport', '确认护照与身份信息', '确认护照有效期、姓名拼音和证件号码。', 'identity', 20),
    (requested_user_id, 'photo', '准备签证照片', '按递签要求准备近期白底证件照。', 'identity', 30),
    (requested_user_id, 'financial', '准备资金证明', '根据学校和领馆要求核对存款金额与冻结期限。', 'finance', 40),
    (requested_user_id, 'application', '填写签证申请表', '逐项核对姓名、护照号、联系方式和在韩地址。', 'application', 50),
    (requested_user_id, 'appointment', '确认预约与递签地点', '记录预约日期、受理机构、携带原件和复印件。', 'appointment', 60),
    (requested_user_id, 'submission', '完成递交并保存受理凭证', '递交后保存受理编号、回执和补件通知。', 'submission', 70),
    (requested_user_id, 'result', '查询签证结果', '关注审核进度，及时处理补充材料要求。', 'result', 80),
    (requested_user_id, 'entry', '确认获签与入境安排', '核对签证信息并安排入境、住宿和报到。', 'entry', 90)
  on conflict (user_id, task_key) do nothing;

  return created_case_id;
end;
$$;

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
    and target.application_stage >= 6
  order by target.application_stage desc, target.priority desc, target.updated_at desc
  limit 1;

  if not found then
    raise exception '标准入学许可书颁发后才会建立签证准备路线';
  end if;

  return public.initialize_student_visa_workspace_for_user(auth.uid(), resolved_visa_type);
end;
$$;

create or replace function public.initialize_visa_workspace_from_application_stage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_visa_type text;
begin
  resolved_visa_type := case
    when new.admission_track = 'language' or new.degree_level = 'language' then 'd4_language'
    when new.admission_track in ('bachelor_fresh', 'bachelor_transfer') or new.degree_level = 'bachelor' then 'd2_bachelor'
    when new.admission_track = 'master' or new.degree_level = 'master' then 'd2_master'
    when new.admission_track = 'doctor' or new.degree_level = 'doctor' then 'd2_doctor'
    else 'd4_language'
  end;

  perform public.initialize_student_visa_workspace_for_user(new.user_id, resolved_visa_type);
  return new;
end;
$$;

drop trigger if exists initialize_visa_workspace_from_application_stage
  on public.student_university_targets;

create trigger initialize_visa_workspace_from_application_stage
after update of application_stage
on public.student_university_targets
for each row
when (old.application_stage < 6 and new.application_stage >= 6)
execute function public.initialize_visa_workspace_from_application_stage();

-- 为迁移执行前已经到达阶段 6 的学生补建档案和任务。
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
    where target.application_stage >= 6
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

revoke all on function public.initialize_student_visa_workspace_for_user(uuid, text)
  from public, anon, authenticated;
revoke all on function public.initialize_visa_workspace_from_application_stage()
  from public, anon, authenticated;

grant execute on function public.initialize_student_visa_workspace()
  to authenticated;

comment on function public.initialize_student_visa_workspace_for_user(uuid, text) is
  '内部使用：为指定学生幂等建立签证档案和九项标准准备任务';
comment on function public.initialize_student_visa_workspace() is
  '阶段 6 之后为当前学生补建签证档案；正常情况下由申请阶段触发器自动完成';
comment on function public.initialize_visa_workspace_from_application_stage() is
  '申请资料进度首次到达阶段 6 时自动建立学生签证工作区';

notify pgrst, 'reload schema';
