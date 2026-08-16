begin;

-- These authenticated legacy RPCs are not part of the new application hub,
-- but they remain in the schema for compatibility and must follow the same
-- anonymous-execution baseline.
revoke execute on function public.create_learning_assignment_from_bank(
  text, text, text, uuid, text, uuid[], timestamptz,
  integer, boolean, boolean, jsonb
) from public, anon;
grant execute on function public.create_learning_assignment_from_bank(
  text, text, text, uuid, text, uuid[], timestamptz,
  integer, boolean, boolean, jsonb
) to authenticated, service_role;

revoke execute on function public.get_student_assigned_teachers()
  from public, anon;
grant execute on function public.get_student_assigned_teachers()
  to authenticated, service_role;

commit;
