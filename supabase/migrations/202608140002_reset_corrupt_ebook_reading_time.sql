begin;

-- Allow the repair below to reduce a legacy corrupt value to zero while still
-- limiting every normal student-side increment to one heartbeat (35 seconds).
create or replace function private.clamp_ebook_reading_increment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.reading_seconds := least(greatest(new.reading_seconds, 0), 35);
  elsif old.reading_seconds > 86400 and new.reading_seconds = 0 then
    new.progress_percent := 0;
    return new;
  else
    new.reading_seconds := least(
      greatest(new.reading_seconds, old.reading_seconds),
      old.reading_seconds + 35
    );
  end if;
  new.progress_percent := least(
    100,
    round(new.reading_seconds::numeric / 600 * 100)
  );
  return new;
end;
$$;

update public.course_ebook_progress
set
  reading_seconds = 0,
  progress_percent = 0,
  read_pages = '{}',
  updated_at = now()
where reading_seconds > 86400;

commit;
