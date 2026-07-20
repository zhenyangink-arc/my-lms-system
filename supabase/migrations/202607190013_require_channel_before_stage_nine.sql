-- 第九步会生成学生签证卡片，因此必须由管理员先确认办理通道。
alter table public.student_university_targets
  add column if not exists visa_application_channel text;

alter table public.student_university_targets
  drop constraint if exists student_university_targets_visa_application_channel_check;
alter table public.student_university_targets
  add constraint student_university_targets_visa_application_channel_check check (
    visa_application_channel is null
    or visa_application_channel in ('china_consulate', 'korea_immigration')
  );

-- 已经进入第九步的旧数据沿用现有签证档案通道，避免升级后卡住。
update public.student_university_targets as target
set visa_application_channel = visa_case.application_channel
from public.student_visa_cases as visa_case
where visa_case.source_target_id = target.id
  and target.visa_application_channel is null;

update public.student_university_targets
set visa_application_channel = 'china_consulate'
where application_stage >= 9
  and visa_application_channel is null;

create or replace function public.require_visa_channel_before_stage_nine()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.application_stage >= 9 and new.visa_application_channel is null then
    raise exception '请先确认签证办理方式，再点亮第九步';
  end if;
  return new;
end;
$$;

drop trigger if exists require_visa_channel_before_stage_nine
  on public.student_university_targets;
create trigger require_visa_channel_before_stage_nine
before insert or update on public.student_university_targets
for each row
execute function public.require_visa_channel_before_stage_nine();

create or replace function public.initialize_student_visa_workspace()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_case_id uuid;
  resolved_visa_type text;
  actual_visa_type text;
  resolved_target_id uuid;
  resolved_application_channel text;
begin
  if auth.uid() is null or not public.student_feature_allowed('visa_tasks') then
    raise exception '当前账号没有签证准备操作权限';
  end if;

  select
    target.id,
    case
      when target.admission_track = 'language' or target.degree_level = 'language' then 'd4_language'
      when target.admission_track in ('bachelor_fresh', 'bachelor_transfer') or target.degree_level = 'bachelor' then 'd2_bachelor'
      when target.admission_track = 'master' or target.degree_level = 'master' then 'd2_master'
      when target.admission_track = 'doctor' or target.degree_level = 'doctor' then 'd2_doctor'
      else 'd4_language'
    end,
    target.visa_application_channel
  into resolved_target_id, resolved_visa_type, resolved_application_channel
  from public.student_university_targets as target
  where target.user_id = auth.uid()
    and target.application_stage >= 9
    and target.visa_application_channel is not null
  order by target.application_stage desc, target.priority desc, target.updated_at desc
  limit 1;

  if not found then
    raise exception '管理员确认签证办理方式并点亮第九步后才会建立签证准备路线';
  end if;

  created_case_id := public.initialize_student_visa_workspace_for_user(auth.uid(), resolved_visa_type);

  update public.student_visa_cases
  set
    source_target_id = resolved_target_id,
    application_channel = resolved_application_channel
  where id = created_case_id
    and (
      source_target_id is distinct from resolved_target_id
      or application_channel is distinct from resolved_application_channel
    );

  select visa_type into actual_visa_type
  from public.student_visa_cases
  where id = created_case_id;

  perform public.initialize_student_visa_requirements(
    auth.uid(),
    resolved_target_id,
    actual_visa_type
  );

  return created_case_id;
end;
$$;

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

create or replace function public.sync_target_visa_application_channel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.application_stage >= 9 and new.visa_application_channel is not null then
    update public.student_visa_cases
    set application_channel = new.visa_application_channel
    where user_id = new.user_id
      and source_target_id = new.id
      and application_channel is distinct from new.visa_application_channel;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_target_visa_application_channel
  on public.student_university_targets;
create trigger sync_target_visa_application_channel
after update of visa_application_channel on public.student_university_targets
for each row
when (old.visa_application_channel is distinct from new.visa_application_channel)
execute function public.sync_target_visa_application_channel();

revoke all on function public.require_visa_channel_before_stage_nine()
  from public, anon, authenticated;
revoke all on function public.sync_target_visa_application_channel()
  from public, anon, authenticated;
grant execute on function public.initialize_student_visa_workspace()
  to authenticated;

comment on column public.student_university_targets.visa_application_channel is
  '管理员在点亮申请第九步前确认的签证办理通道';
comment on function public.require_visa_channel_before_stage_nine() is
  '禁止未确认签证办理通道的大学申请进入第九步';
comment on function public.initialize_visa_workspace_from_application_stage() is
  '申请阶段首次到达第九步时，按管理员确认的通道自动建立签证档案和大学模板任务';

notify pgrst, 'reload schema';
