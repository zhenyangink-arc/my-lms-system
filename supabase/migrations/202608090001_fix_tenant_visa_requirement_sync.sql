begin;

-- University visa templates are global, but the student tasks created from
-- them must remain in the tenant of each student's visa case.  The original
-- function predates tenant-scoped task uniqueness and therefore omitted
-- tenant_id and targeted the obsolete (user_id, task_key) constraint.
create or replace function public.sync_university_visa_application_requirement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and old.is_active
     and (
       old.university_id is distinct from new.university_id
       or old.visa_type is distinct from new.visa_type
     ) then
    delete from public.student_visa_tasks
    where requirement_id = old.id
      and submission_version = 0
      and status in ('pending', 'in_progress', 'blocked');

    update public.student_visa_tasks
    set is_archived = true
    where requirement_id = old.id
      and is_archived = false;
  end if;

  if new.is_active then
    insert into public.student_visa_tasks (
      tenant_id,
      user_id,
      task_key,
      requirement_id,
      title,
      description,
      stage,
      sort_order,
      is_archived
    )
    select
      visa_case.tenant_id,
      visa_case.user_id,
      new.requirement_key,
      new.id,
      new.title,
      new.description,
      new.stage,
      new.sort_order,
      false
    from public.student_visa_cases as visa_case
    join public.student_university_targets as target
      on target.id = visa_case.source_target_id
     and target.tenant_id = visa_case.tenant_id
    where target.university_id = new.university_id
      and visa_case.visa_type = new.visa_type
    on conflict (tenant_id, user_id, task_key)
    do update set
      requirement_id = excluded.requirement_id,
      title = excluded.title,
      description = excluded.description,
      stage = excluded.stage,
      sort_order = excluded.sort_order,
      is_archived = false;
  else
    delete from public.student_visa_tasks
    where requirement_id = new.id
      and submission_version = 0
      and status in ('pending', 'in_progress', 'blocked');

    update public.student_visa_tasks
    set is_archived = true
    where requirement_id = new.id
      and is_archived = false;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_university_visa_application_requirement()
  from public, anon, authenticated;

comment on function public.sync_university_visa_application_requirement() is
  'Synchronizes university visa requirement changes to student tasks using tenant-scoped identity and conflict handling.';

commit;
