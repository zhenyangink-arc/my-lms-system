begin;

alter table public.course_ebook_progress
  add column if not exists read_pages integer[] not null default '{}';

update public.course_ebook_progress
set
  read_pages = '{}',
  progress_percent = 0,
  updated_at = now();

comment on column public.course_ebook_progress.read_pages is
  '达到有效停留时间后计入阅读进度的页码集合。';

commit;
