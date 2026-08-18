-- LOCAL-ONLY, READ-ONLY chapter-one structural verification.
-- Run only with an explicit local target, for example:
--   docker exec supabase_db_my-lms-system psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f /path/inside/container/verify-chapter-one-smart-textbook.sql
--
-- This script deliberately does not manufacture attempts or progress. Use
-- `npm run test:chapter-one-security` for authenticated RLS and production
-- Server Action submission-path coverage.

begin transaction read only;

do $verify$
declare
  v_test_id uuid;
  v_chapter_id uuid;
  v_node_count integer;
  v_activity_count integer;
  v_question_count integer;
begin
  select id into v_test_id
  from public.chapter_tests
  where slug = 'korean-level-one-01'
    and status = 'draft';
  if v_test_id is null then
    raise exception 'chapter test must exist in draft state';
  end if;

  select count(*) into v_question_count
  from public.chapter_test_questions
  where test_id = v_test_id
    and question_key between 'golden-01-01' and 'golden-01-12'
    and status = 'draft';
  if v_question_count <> 12 then
    raise exception 'expected 12 draft golden questions, got %', v_question_count;
  end if;

  select chapter.id into v_chapter_id
  from public.digital_textbook_chapters as chapter
  join public.digital_textbook_versions as version on version.id = chapter.version_id
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1;
  if v_chapter_id is null then
    raise exception 'chapter-one smart textbook is missing';
  end if;

  select count(*) into v_node_count
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  where module.chapter_id = v_chapter_id;
  if v_node_count <> 8 then
    raise exception 'expected 8 nodes, got %', v_node_count;
  end if;

  select count(*) into v_activity_count
  from public.digital_textbook_activities as activity
  join public.digital_textbook_nodes as node on node.id = activity.node_id
  join public.digital_textbook_modules as module on module.id = node.module_id
  where module.chapter_id = v_chapter_id;
  if v_activity_count <> 12 then
    raise exception 'expected 12 activities, got %', v_activity_count;
  end if;

  if exists (
    select 1
    from public.digital_textbook_activities as activity
    join public.digital_textbook_nodes as node on node.id = activity.node_id
    join public.digital_textbook_modules as module on module.id = node.module_id
    where module.chapter_id = v_chapter_id
      and activity.activity_type in ('speaking', 'writing', 'self_check')
      and activity.counts_toward_completion
  ) then
    raise exception 'open activities must not count as objective completion evidence';
  end if;

  if has_table_privilege(
    'authenticated', 'public.digital_textbook_attempts', 'INSERT'
  ) or has_table_privilege(
    'authenticated', 'public.digital_textbook_node_progress', 'INSERT'
  ) or has_table_privilege(
    'authenticated', 'public.digital_textbook_node_progress', 'UPDATE'
  ) then
    raise exception 'authenticated write privileges were not revoked';
  end if;

  if to_regprocedure(
    'public.record_smart_textbook_attempt(uuid,uuid,uuid,uuid,jsonb,boolean,numeric)'
  ) is null then
    raise exception 'atomic attempt recorder is missing';
  end if;
end;
$verify$;

rollback;
