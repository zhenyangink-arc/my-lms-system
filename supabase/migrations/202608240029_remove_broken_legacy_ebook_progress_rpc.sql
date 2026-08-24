begin;

-- The tenant-scoped progress key is now
-- (tenant_id, student_id, test_slug). The obsolete four-argument overload
-- still targeted the former (student_id, test_slug) unique key, so PostgreSQL
-- rejected its ON CONFLICT clause. The application exclusively calls the
-- current five-argument overload (directly or through the idempotent segment
-- RPC), therefore remove the invalid compatibility entry point.
drop function if exists public.record_ebook_progress(
  text,
  integer,
  integer,
  integer[]
);

notify pgrst, 'reload schema';

commit;
