-- R2A: authenticated public content is tenant-bound; raw authoring nodes remain owner-only.
-- Existing owner/standard-question-bank management policies are intentionally preserved.
BEGIN;
CREATE FUNCTION private.can_read_published_textbook(p_textbook_id uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_app uuid;
  v_category uuid;
  v_parent uuid;
  v_depth integer := 0;
  v_seen uuid[] := ARRAY[]::uuid[];
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.tenant_memberships tm ON tm.user_id=p.id
    JOIN public.tenants t ON t.id=tm.tenant_id
    WHERE p.id=auth.uid() AND p.status='active' AND tm.tenant_id=v_tenant
      AND tm.status='active' AND t.status='active'
      AND tm.role IN ('student','teacher','admin','ceo','tenant_super_admin')
  ) THEN RETURN false; END IF;
  SELECT b.student_app_id,c.category_id INTO v_app,v_category
  FROM public.digital_textbooks b
  JOIN public.lessons l ON l.id=b.lesson_id
  JOIN public.courses c ON c.id=l.course_id
  WHERE b.id=p_textbook_id AND b.status='published' AND l.is_published AND c.is_published
    AND b.student_app_id=c.student_app_id
    AND ((l.content_scope='platform' AND l.tenant_id IS NULL) OR (l.content_scope='tenant' AND l.tenant_id=v_tenant))
    AND ((c.content_scope='platform' AND c.tenant_id IS NULL) OR (c.content_scope='tenant' AND c.tenant_id=v_tenant));
  IF NOT FOUND OR NOT private.current_user_can_read_student_app(v_app) THEN RETURN false; END IF;
  LOOP
    IF v_category IS NULL OR v_depth >= 8 OR v_category=ANY(v_seen) THEN RETURN false; END IF;
    SELECT c.parent_id INTO v_parent FROM public.course_categories c
    WHERE c.id=v_category AND c.is_published AND c.student_app_id=v_app
      AND ((c.content_scope='platform' AND c.tenant_id IS NULL) OR (c.content_scope='tenant' AND c.tenant_id=v_tenant));
    IF NOT FOUND THEN RETURN false; END IF;
    IF v_parent IS NULL THEN RETURN true; END IF;
    v_seen:=pg_catalog.array_append(v_seen,v_category); v_category:=v_parent; v_depth:=v_depth+1;
  END LOOP;
END;
$$;
ALTER FUNCTION private.can_read_published_textbook(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.can_read_published_textbook(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.can_read_published_textbook(uuid) TO authenticated;

CREATE FUNCTION private.can_read_published_teaching_module(p_module_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.digital_textbook_modules m
  JOIN public.digital_textbook_chapters c ON c.id=m.chapter_id
  JOIN public.digital_textbook_versions v ON v.id=c.version_id
  WHERE m.id=p_module_id AND c.status='published' AND v.status='published'
    AND private.can_read_published_textbook(v.textbook_id)
 );
$$;
ALTER FUNCTION private.can_read_published_teaching_module(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.can_read_published_teaching_module(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.can_read_published_teaching_module(uuid) TO authenticated;

-- Close ancestor catalog surfaces as well as modules, without removing manager access.
ALTER POLICY "authenticated read textbook catalog" ON public.digital_textbooks
 USING (public.current_user_can_manage_standard_question_bank() OR private.can_read_published_textbook(id));
ALTER POLICY "authenticated read textbook versions" ON public.digital_textbook_versions
 USING (public.current_user_can_manage_standard_question_bank() OR (status='published' AND private.can_read_published_textbook(textbook_id)));
ALTER POLICY "authenticated read textbook chapters" ON public.digital_textbook_chapters
 USING (public.current_user_can_manage_standard_question_bank() OR (status='published' AND EXISTS (
 SELECT 1 FROM public.digital_textbook_versions v WHERE v.id=version_id AND v.status='published' AND private.can_read_published_textbook(v.textbook_id))));
ALTER POLICY "authenticated read textbook modules" ON public.digital_textbook_modules
 USING (public.current_user_can_manage_standard_question_bank() OR private.can_read_published_teaching_module(id));
ALTER POLICY "authenticated read published learning agent lessons" ON public.learning_agent_lessons
 USING (status='published' AND private.can_read_published_teaching_module(module_id));
ALTER POLICY "authenticated read published learning agent script versions" ON public.learning_agent_script_versions
 USING (status='published' AND EXISTS (SELECT 1 FROM public.learning_agent_lessons l
 WHERE l.id=lesson_id AND l.status='published' AND private.can_read_published_teaching_module(l.module_id)));
DROP POLICY "authenticated read published learning agent script nodes" ON public.learning_agent_script_nodes;
-- The existing platform-owner ALL policy remains. Student raw SELECT returns zero rows.

-- Safe authored rows must be strings and reproduce the authoritative public narration.
-- Do not expose arbitrary nested keys, invalid segment payloads, or future configuration fields.
CREATE FUNCTION private.student_script_segments(p_script jsonb,p_segments jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
 SELECT coalesce(pg_catalog.jsonb_object_agg(e.key,e.value),'{}'::jsonb)
 FROM pg_catalog.jsonb_each(CASE WHEN pg_catalog.jsonb_typeof(p_segments)='object' THEN p_segments ELSE '{}'::jsonb END) e
 WHERE e.key IN ('zh-CN','ko-KR') AND CASE WHEN pg_catalog.jsonb_typeof(e.value)='array' THEN
   pg_catalog.jsonb_array_length(e.value)<=50
   AND NOT EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(e.value) s WHERE pg_catalog.jsonb_typeof(s)<>'string')
   AND pg_catalog.btrim((SELECT pg_catalog.string_agg(s.value,E'\n\n' ORDER BY s.ordinality) FROM pg_catalog.jsonb_array_elements_text(e.value) WITH ORDINALITY s),E' \n\r\t')
       =pg_catalog.btrim(coalesce(p_script->>e.key,p_script->>'zh-CN',''),E' \n\r\t')
 ELSE false END;
$$;
ALTER FUNCTION private.student_script_segments(jsonb,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.student_script_segments(jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.student_script_segments(jsonb,jsonb) TO authenticated;

-- Owner-executed barrier view deliberately bypasses raw-table owner-only RLS.
-- Every row is explicitly checked against the caller's auth.uid/current active membership.
-- No caller-supplied user or tenant, no raw configuration column, no write grant.
CREATE VIEW public.student_learning_agent_script_nodes WITH (security_barrier=true) AS
 SELECT n.id,n.script_version_id,n.updated_at,n.sort_order,
   (SELECT coalesce(pg_catalog.jsonb_object_agg(e.key,e.value),'{}'::jsonb)
    FROM pg_catalog.jsonb_each(CASE WHEN pg_catalog.jsonb_typeof(n.teacher_script)='object' THEN n.teacher_script ELSE '{}'::jsonb END) e
    WHERE e.key IN ('zh-CN','ko-KR') AND pg_catalog.jsonb_typeof(e.value)='string') AS teacher_script,
   private.student_script_segments(n.teacher_script,n.configuration->'scriptSegments') AS segments,
   CASE WHEN n.configuration->'teacherVideo'->>'mode'='video' THEN 'video' ELSE 'legacy' END AS video_mode
 FROM public.learning_agent_script_nodes n
 JOIN public.learning_agent_script_versions v ON v.id=n.script_version_id
 JOIN public.learning_agent_lessons l ON l.id=v.lesson_id
 WHERE auth.uid() IS NOT NULL AND v.status='published' AND l.status='published'
   AND private.can_read_published_teaching_module(l.module_id);
ALTER VIEW public.student_learning_agent_script_nodes OWNER TO postgres;
REVOKE ALL ON public.student_learning_agent_script_nodes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.student_learning_agent_script_nodes TO authenticated;
COMMENT ON VIEW public.student_learning_agent_script_nodes IS 'Caller-bound public narration only. Raw authoring configuration is never projected. StudentTeachingPolicy additionally verifies unlock, selection and revision.';
NOTIFY pgrst, 'reload schema';
COMMIT;
