begin;

-- Supabase may grant EXECUTE to anon through owner-specific default privileges.
-- Revoking PUBLIC alone does not remove that explicit role grant.
revoke all on function public.review_chapter_practice_binding(uuid, uuid, integer, jsonb, boolean) from anon;
revoke all on function public.read_chapter_practice_snapshots(uuid) from anon;
grant execute on function public.review_chapter_practice_binding(uuid, uuid, integer, jsonb, boolean) to authenticated;
grant execute on function public.read_chapter_practice_snapshots(uuid) to authenticated;

commit;
