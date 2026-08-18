-- Supabase automatically grants newly exposed public functions to its API
-- roles. This release mutation must only be callable with an authenticated
-- user's JWT; the function itself then requires that user to be the platform
-- owner.
revoke all on function public.publish_digital_textbook_chapter(uuid)
  from public, anon, service_role;
grant execute on function public.publish_digital_textbook_chapter(uuid)
  to authenticated;
