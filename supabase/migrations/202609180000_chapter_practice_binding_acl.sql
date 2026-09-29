-- Forward-only, exact-target reconciliation. Historical grant origin is UNKNOWN.
-- No function replacement, default privilege change, or business row mutation.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $acl_contract$
DECLARE
  target oid := pg_catalog.to_regprocedure('public.review_chapter_practice_binding(uuid,uuid,integer,jsonb,boolean)');
  original_oid oid := target;
  definition_hash constant text := '3d72415147051a92a0312f56bf6b60d81aa5e0e103aced878a20be21b5d96941';
  row_info record;
  actual_acl jsonb;
  expected_acl jsonb;
  defaults_before jsonb;
  other_acl_before jsonb;
  phase integer;
BEGIN
  IF target IS NULL THEN RAISE EXCEPTION 'CHAPTER_PRACTICE_ACL_TARGET_MISSING'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.oid), '[]'::jsonb)
    INTO defaults_before FROM pg_catalog.pg_default_acl d;
  SELECT coalesce(jsonb_agg(jsonb_build_array(p.oid, p.proacl) ORDER BY p.oid), '[]'::jsonb)
    INTO other_acl_before FROM pg_catalog.pg_proc p WHERE p.oid <> target;

  FOR phase IN 0..1 LOOP
    target := pg_catalog.to_regprocedure('public.review_chapter_practice_binding(uuid,uuid,integer,jsonb,boolean)');
    IF target IS NULL OR target <> original_oid THEN
      RAISE EXCEPTION 'CHAPTER_PRACTICE_ACL_TARGET_CHANGED';
    END IF;
    SELECT p.*, l.lanname INTO row_info FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=target;
    IF pg_catalog.pg_get_userbyid(row_info.proowner) IS DISTINCT FROM 'postgres'
      OR row_info.prosecdef IS DISTINCT FROM true
      OR row_info.lanname IS DISTINCT FROM 'plpgsql'
      OR row_info.provolatile IS DISTINCT FROM 'v'
      OR row_info.proparallel IS DISTINCT FROM 'u'
      OR row_info.proleakproof IS DISTINCT FROM false
      OR row_info.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
      OR pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
        pg_catalog.pg_get_functiondef(target), 'UTF8')), 'hex') IS DISTINCT FROM definition_hash THEN
      RAISE EXCEPTION 'CHAPTER_PRACTICE_ACL_DEFINITION_MISMATCH';
    END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_array(
      CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END,
      pg_catalog.pg_get_userbyid(a.grantor), a.privilege_type, a.is_grantable)
      ORDER BY CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END), '[]'::jsonb)
      INTO actual_acl FROM pg_catalog.aclexplode(row_info.proacl) a;
    expected_acl := CASE WHEN phase=0 THEN
      '[["authenticated","postgres","EXECUTE",false],["postgres","postgres","EXECUTE",false],["service_role","postgres","EXECUTE",false]]'::jsonb
      ELSE '[["authenticated","postgres","EXECUTE",false],["postgres","postgres","EXECUTE",false]]'::jsonb END;
    IF actual_acl IS DISTINCT FROM expected_acl THEN
      RAISE EXCEPTION 'CHAPTER_PRACTICE_ACL_ENTRIES_MISMATCH';
    END IF;
    IF pg_catalog.has_function_privilege('postgres', target, 'EXECUTE') IS DISTINCT FROM true
      OR pg_catalog.has_function_privilege('authenticated', target, 'EXECUTE') IS DISTINCT FROM true
      OR pg_catalog.has_function_privilege('anon', target, 'EXECUTE') IS DISTINCT FROM false
      OR pg_catalog.has_function_privilege('service_role', target, 'EXECUTE') IS DISTINCT FROM (phase=0) THEN
      RAISE EXCEPTION 'CHAPTER_PRACTICE_ACL_EFFECTIVE_MISMATCH';
    END IF;
    IF phase=0 THEN
      REVOKE EXECUTE ON FUNCTION public.review_chapter_practice_binding(uuid,uuid,integer,jsonb,boolean)
        FROM service_role RESTRICT;
    END IF;
  END LOOP;
  IF defaults_before IS DISTINCT FROM
    (SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.oid), '[]'::jsonb) FROM pg_catalog.pg_default_acl d)
    OR other_acl_before IS DISTINCT FROM
    (SELECT coalesce(jsonb_agg(jsonb_build_array(p.oid,p.proacl) ORDER BY p.oid), '[]'::jsonb)
      FROM pg_catalog.pg_proc p WHERE p.oid <> target) THEN
    RAISE EXCEPTION 'CHAPTER_PRACTICE_ACL_UNRELATED_CHANGE';
  END IF;
END
$acl_contract$;
COMMIT;
