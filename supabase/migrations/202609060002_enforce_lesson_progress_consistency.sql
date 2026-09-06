begin;

-- Reading all material does not complete a lesson by itself: required chapter
-- tests must also be passed. Reserve 100% for a genuinely completed lesson so
-- status, percentage and completion timestamp always describe the same state.
create or replace function public.normalize_lesson_progress_consistency()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.progress_percent := greatest(0, least(100, coalesce(new.progress_percent, 0)));

  if new.status = 'completed' then
    new.progress_percent := 100;
    if new.completed_at is null then
      if tg_op = 'UPDATE' then
        new.completed_at := coalesce(old.completed_at, now());
      else
        new.completed_at := now();
      end if;
    end if;
  else
    if new.progress_percent >= 100 then
      new.progress_percent := 99;
    end if;
    if new.status = 'not_started' and new.progress_percent > 0 then
      new.status := 'in_progress';
    end if;
    new.completed_at := null;
  end if;

  return new;
end;
$function$;

drop trigger if exists lesson_progress_normalize_consistency
  on public.lesson_progress;
create trigger lesson_progress_normalize_consistency
before insert or update of status, progress_percent, completed_at
on public.lesson_progress
for each row execute function public.normalize_lesson_progress_consistency();

-- Migration sessions have no auth.uid(), so the student entitlement trigger
-- would reject this maintenance-only backfill. Disable only that trigger for
-- the statement and restore it immediately afterwards.
alter table public.lesson_progress
  disable trigger enforce_student_lesson_progress_permission_trigger;

update public.lesson_progress
set
  progress_percent = case
    when status = 'completed' then 100
    else least(99, greatest(0, progress_percent))
  end,
  status = case
    when status = 'not_started' and progress_percent > 0 then 'in_progress'
    else status
  end,
  completed_at = case
    when status = 'completed' then coalesce(completed_at, now())
    else null
  end
where
  progress_percent < 0
  or progress_percent > 100
  or (status = 'completed' and (progress_percent <> 100 or completed_at is null))
  or (status <> 'completed' and (progress_percent = 100 or completed_at is not null))
  or (status = 'not_started' and progress_percent > 0);

alter table public.lesson_progress
  enable trigger enforce_student_lesson_progress_permission_trigger;

alter table public.lesson_progress
  drop constraint if exists lesson_progress_state_consistency_check;
alter table public.lesson_progress
  add constraint lesson_progress_state_consistency_check check (
    (status = 'completed' and progress_percent = 100 and completed_at is not null)
    or
    (status = 'in_progress' and progress_percent between 0 and 99 and completed_at is null)
    or
    (status = 'not_started' and progress_percent = 0 and completed_at is null)
  );

comment on function public.normalize_lesson_progress_consistency() is
  '统一课时进度状态：完成固定为 100%，未完成最高为 99%，有进度时不得保持未开始。';

commit;
