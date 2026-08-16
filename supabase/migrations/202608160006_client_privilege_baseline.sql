begin;

-- RLS does not apply to TRUNCATE. Browser-facing roles also never need to add
-- triggers or foreign-key references. Remove these structural privileges from
-- every public table, and make the anonymous role read-only at table level.
do $$
declare
  target_table record;
begin
  for target_table in
    select format('%I.%I', namespace.nspname, relation.relname) as qualified_name
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
  loop
    execute format(
      'revoke truncate, references, trigger on table %s from anon, authenticated',
      target_table.qualified_name
    );
    execute format(
      'revoke insert, update, delete on table %s from anon',
      target_table.qualified_name
    );
  end loop;
end;
$$;

-- Every RPC used by the dashboard is behind an authenticated route. Supabase
-- historically granted new functions to anon automatically, so enforce the
-- executable boundary explicitly for all overloads currently used by the app.
do $$
declare
  target_function record;
begin
  for target_function in
    select procedure_record.oid::regprocedure as signature
    from pg_proc as procedure_record
    join pg_namespace as namespace on namespace.oid = procedure_record.pronamespace
    where namespace.nspname = 'public'
      and procedure_record.proname = any(array[
        'add_help_ticket_message',
        'assign_help_ticket',
        'change_assessment_paper_status',
        'change_conversation_practice_scenario_status',
        'change_help_article_status',
        'change_learning_assignment_status',
        'change_learning_record_note_status',
        'change_library_resource_status',
        'confirm_help_ticket_resolved',
        'create_assessment_paper_from_bank',
        'create_help_ticket',
        'create_learning_assignment_from_paper',
        'create_tenant',
        'current_user_can_manage_assessment_papers',
        'current_user_can_manage_standard_question_bank',
        'delete_managed_account',
        'delete_standard_question',
        'delete_student_application_document_card',
        'delete_student_visa_card',
        'delete_tenant_permanently',
        'duplicate_assessment_paper',
        'get_platform_document_review_overview',
        'get_platform_grade_overview',
        'get_platform_help_center_overview',
        'get_platform_learning_record_overview',
        'get_platform_visa_case_audit',
        'get_platform_visa_management_overview',
        'get_tenant_student_learning_record_overview',
        'get_tenant_student_learning_record_overview_by_app',
        'grade_learning_submission',
        'initialize_student_visa_workspace',
        'list_learning_assignment_students',
        'list_learning_record_students',
        'list_learning_record_students_by_app',
        'mark_visible_announcements_read',
        'record_conversation_practice',
        'record_ebook_progress',
        'record_ebook_progress_segment',
        'record_library_download',
        'replace_chapter_test_questions',
        'request_source_grade_review',
        'resolve_grade_review',
        'save_conversation_practice_scenario',
        'save_help_article',
        'save_learning_record_note',
        'save_library_resource',
        'save_standard_question',
        'set_application_teacher_assignment',
        'set_staff_application_access',
        'set_student_application_enrollment',
        'set_tenant_application_settings',
        'set_tenant_lifecycle_status',
        'set_user_permission_grant',
        'submit_course_test',
        'submit_learning_assignment',
        'submit_toolbox_practice',
        'toggle_library_favorite',
        'update_help_ticket',
        'update_learning_assignment_deadline'
      ])
  loop
    execute format(
      'revoke execute on function %s from public, anon',
      target_function.signature
    );
    execute format(
      'grant execute on function %s to authenticated, service_role',
      target_function.signature
    );
  end loop;
end;
$$;

-- New functions created by postgres should start without PUBLIC execution.
alter default privileges for role postgres in schema public
  revoke execute on functions from public;

commit;
