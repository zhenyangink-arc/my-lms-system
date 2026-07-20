-- ============================================================
-- 签证档案记录触发第 9 步的目标学校，供学生端和后台卡片展示。
-- ============================================================

alter table public.student_visa_cases
  add column if not exists source_target_id uuid
  references public.student_university_targets(id) on delete set null;

create index if not exists student_visa_cases_source_target_idx
  on public.student_visa_cases (source_target_id);

create or replace function public.initialize_student_visa_workspace()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_case_id uuid;
  resolved_visa_type text;
  resolved_target_id uuid;
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
    end
  into resolved_target_id, resolved_visa_type
  from public.student_university_targets as target
  where target.user_id = auth.uid()
    and target.application_stage >= 9
  order by target.application_stage desc, target.priority desc, target.updated_at desc
  limit 1;

  if not found then
    raise exception '申请进度到达第九步后才会建立签证准备路线';
  end if;

  created_case_id := public.initialize_student_visa_workspace_for_user(auth.uid(), resolved_visa_type);

  update public.student_visa_cases
  set source_target_id = resolved_target_id
  where id = created_case_id
    and source_target_id is distinct from resolved_target_id;

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
begin
  resolved_visa_type := case
    when new.admission_track = 'language' or new.degree_level = 'language' then 'd4_language'
    when new.admission_track in ('bachelor_fresh', 'bachelor_transfer') or new.degree_level = 'bachelor' then 'd2_bachelor'
    when new.admission_track = 'master' or new.degree_level = 'master' then 'd2_master'
    when new.admission_track = 'doctor' or new.degree_level = 'doctor' then 'd2_doctor'
    else 'd4_language'
  end;

  created_case_id := public.initialize_student_visa_workspace_for_user(new.user_id, resolved_visa_type);

  update public.student_visa_cases
  set source_target_id = new.id
  where id = created_case_id
    and source_target_id is distinct from new.id;

  return new;
end;
$$;

-- 为已经到达第 9 步的签证档案补充来源学校。
update public.student_visa_cases as visa_case
set source_target_id = target.id
from (
  select distinct on (candidate.user_id)
    candidate.user_id,
    candidate.id
  from public.student_university_targets as candidate
  where candidate.application_stage >= 9
  order by candidate.user_id, candidate.application_stage desc, candidate.priority desc, candidate.updated_at desc
) as target
where visa_case.user_id = target.user_id
  and visa_case.source_target_id is null;

grant execute on function public.initialize_student_visa_workspace()
  to authenticated;

comment on column public.student_visa_cases.source_target_id is
  '触发签证流程的第 9 步目标学校';
comment on function public.initialize_visa_workspace_from_application_stage() is
  '申请资料进度首次到达阶段 9 时建立签证工作区并记录来源目标学校';

notify pgrst, 'reload schema';
