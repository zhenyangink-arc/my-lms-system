-- 韩国大学申请截止日期由管理后台按申请阶段统一维护。
-- 学生目标记录只保存后台日期的同步副本，不能自行提交或修改日期。

alter table public.korean_universities
  add column if not exists application_deadlines jsonb not null default '{}'::jsonb;

create or replace function public.is_valid_university_deadline(p_value text)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  if p_value is null then
    return true;
  end if;

  if p_value !~ '^\d{4}-\d{2}-\d{2}$' then
    return false;
  end if;

  return to_char(p_value::date, 'YYYY-MM-DD') = p_value;
exception
  when others then
    return false;
end;
$$;

alter table public.korean_universities
  drop constraint if exists korean_universities_application_deadlines_check;

alter table public.korean_universities
  add constraint korean_universities_application_deadlines_check check (
    jsonb_typeof(application_deadlines) = 'object'
    and (
      application_deadlines
      - array['language', 'bachelor_fresh', 'bachelor_transfer', 'master', 'doctor']::text[]
    ) = '{}'::jsonb
    and public.is_valid_university_deadline(application_deadlines ->> 'language')
    and public.is_valid_university_deadline(application_deadlines ->> 'bachelor_fresh')
    and public.is_valid_university_deadline(application_deadlines ->> 'bachelor_transfer')
    and public.is_valid_university_deadline(application_deadlines ->> 'master')
    and public.is_valid_university_deadline(application_deadlines ->> 'doctor')
  );

create or replace function public.university_deadline_for_stage(
  p_deadlines jsonb,
  p_admission_stage text
)
returns date
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_deadline text;
begin
  if p_admission_stage not in (
    'language',
    'bachelor_fresh',
    'bachelor_transfer',
    'master',
    'doctor'
  ) then
    return null;
  end if;

  v_deadline := p_deadlines ->> p_admission_stage;
  if not public.is_valid_university_deadline(v_deadline) then
    return null;
  end if;

  return v_deadline::date;
end;
$$;

create or replace function public.enforce_target_university_deadline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.university_id is null then
    new.application_deadline := null;
    return new;
  end if;

  select public.university_deadline_for_stage(
    university.application_deadlines,
    new.admission_track
  )
  into new.application_deadline
  from public.korean_universities as university
  where university.id = new.university_id;

  return new;
end;
$$;

drop trigger if exists enforce_target_university_deadline
  on public.student_university_targets;

create trigger enforce_target_university_deadline
before insert or update of university_id, admission_track, application_deadline
on public.student_university_targets
for each row execute function public.enforce_target_university_deadline();

create or replace function public.sync_target_university_deadlines()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.student_university_targets as target
  set application_deadline = public.university_deadline_for_stage(
    new.application_deadlines,
    target.admission_track
  )
  where target.university_id = new.id
    and target.application_deadline is distinct from public.university_deadline_for_stage(
      new.application_deadlines,
      target.admission_track
    );

  return new;
end;
$$;

drop trigger if exists sync_target_university_deadlines
  on public.korean_universities;

create trigger sync_target_university_deadlines
after update of application_deadlines
on public.korean_universities
for each row
when (old.application_deadlines is distinct from new.application_deadlines)
execute function public.sync_target_university_deadlines();

-- 清理旧的学生自填日期，并以当前后台配置统一回填。
update public.student_university_targets as target
set application_deadline = public.university_deadline_for_stage(
  university.application_deadlines,
  target.admission_track
)
from public.korean_universities as university
where target.university_id = university.id
  and target.application_deadline is distinct from public.university_deadline_for_stage(
    university.application_deadlines,
    target.admission_track
  );

revoke all on function public.enforce_target_university_deadline() from public, anon, authenticated;
revoke all on function public.sync_target_university_deadlines() from public, anon, authenticated;

comment on column public.korean_universities.application_deadlines is
  '按申请阶段保存的后台申请截止日期，键为 language/bachelor_fresh/bachelor_transfer/master/doctor';

notify pgrst, 'reload schema';
