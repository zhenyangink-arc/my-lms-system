-- Formal from-zero authoring. No policy changes, content seed or automatic publication.
BEGIN;

CREATE FUNCTION public.create_teaching_content_skeleton(
  p_lesson_id uuid,
  p_expected_updated_at timestamptz,
  p_chapter_title text,
  p_objectives text[] DEFAULT ARRAY[]::text[]
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  l public.lessons%rowtype;
  c public.courses%rowtype;
  profile_id uuid;
  app_slug text;
  textbook_id uuid;
  version_id uuid;
  chapter_id uuid;
  module_id uuid;
  teaching_lesson_id uuid;
BEGIN
  -- Match Script Studio's existing platform-owner contract, including provisioned accounts.
  IF auth.uid() IS NULL OR NOT coalesce(private.is_platform_owner(), false)
    OR EXISTS (SELECT 1 FROM public.tenant_provisioned_accounts WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'AUTHORING_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_chapter_title IS NULL OR length(btrim(p_chapter_title)) NOT BETWEEN 1 AND 120
    OR p_objectives IS NULL OR cardinality(p_objectives) > 6
    OR EXISTS (SELECT 1 FROM unnest(p_objectives) x WHERE x IS NULL OR length(btrim(x)) NOT BETWEEN 1 AND 400) THEN
    RAISE EXCEPTION 'AUTHORING_INVALID_INPUT' USING ERRCODE = '22023';
  END IF;

  -- Same lock order as existing authoring/publication triggers; serializes two HTTP sessions.
  PERFORM runtime_publish_private.authoring_lock();
  SELECT lesson.* INTO l FROM public.lessons lesson
    JOIN public.courses course ON course.id = lesson.course_id
    WHERE lesson.id = p_lesson_id FOR UPDATE OF lesson, course;
  IF NOT FOUND THEN RAISE EXCEPTION 'AUTHORING_RESOURCE_CHANGED' USING ERRCODE = 'PT409'; END IF;
  SELECT * INTO c FROM public.courses WHERE id = l.course_id;
  IF l.updated_at IS DISTINCT FROM p_expected_updated_at
    OR l.content_scope IS DISTINCT FROM c.content_scope
    OR l.tenant_id IS DISTINCT FROM c.tenant_id THEN
    RAISE EXCEPTION 'AUTHORING_RESOURCE_CHANGED' USING ERRCODE = 'PT409';
  END IF;
  -- App and profile are resolved here, never supplied by the browser.
  SELECT slug INTO app_slug FROM public.student_apps WHERE id = c.student_app_id AND slug = 'korean' FOR SHARE;
  IF app_slug IS NULL THEN RAISE EXCEPTION 'AUTHORING_UNSUPPORTED_APP' USING ERRCODE = '22023'; END IF;
  SELECT id INTO profile_id FROM public.learning_agent_profiles
    WHERE agent_code = 'uply-korean-teacher' AND subject_code = 'korean'
      AND access_feature = 'korean_course' AND status = 'published' FOR SHARE;
  IF profile_id IS NULL THEN RAISE EXCEPTION 'AUTHORING_PROFILE_UNAVAILABLE' USING ERRCODE = 'PT409'; END IF;

  -- Includes partial and archived legacy trees. Never overwrite or silently repair them.
  IF EXISTS (SELECT 1 FROM public.digital_textbooks WHERE lesson_id = l.id) THEN
    RAISE EXCEPTION 'AUTHORING_CONTENT_EXISTS' USING ERRCODE = 'PT409';
  END IF;
  INSERT INTO public.digital_textbooks (lesson_id, slug, level_code, title, student_app_id, agent_profile_id)
    VALUES (l.id, 'lesson-' || l.id::text, coalesce(nullif(c.level, ''), 'unspecified'),
      jsonb_build_object('zh-CN', l.title), c.student_app_id, profile_id) RETURNING id INTO textbook_id;
  INSERT INTO public.digital_textbook_versions (textbook_id, version_number)
    VALUES (textbook_id, 1) RETURNING id INTO version_id;
  -- Chapter zero is the existing preparation-chapter contract (no chapter test required).
  INSERT INTO public.digital_textbook_chapters (version_id, slug, chapter_number, title)
    VALUES (version_id, 'preparation', 0, jsonb_build_object('zh-CN', btrim(p_chapter_title))) RETURNING id INTO chapter_id;
  INSERT INTO public.digital_textbook_modules (chapter_id, module_code, sort_order, accent_role, title)
    VALUES (chapter_id, 'orientation', 1, 'jade', '{"zh-CN":"课前导航","ko-KR":"수업 안내"}') RETURNING id INTO module_id;
  INSERT INTO public.learning_agent_lessons (module_id, agent_profile_id, objectives)
    VALUES (module_id, profile_id, CASE WHEN cardinality(p_objectives) = 0 THEN '{}'::jsonb
      ELSE jsonb_build_object('zh-CN', to_jsonb(p_objectives)) END) RETURNING id INTO teaching_lesson_id;
  -- These existing skeleton tables have no actor columns. Script draft/node/publication
  -- audit remains in the existing actions with auth.uid(); no fabricated actor or script.
  RETURN jsonb_build_object('textbookId', textbook_id, 'versionId', version_id,
    'chapterId', chapter_id, 'moduleId', module_id, 'teachingLessonId', teaching_lesson_id,
    'profileId', profile_id, 'appSlug', app_slug, 'status', 'draft');
END;
$$;
REVOKE ALL ON FUNCTION public.create_teaching_content_skeleton(uuid, timestamptz, text, text[]) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_teaching_content_skeleton(uuid, timestamptz, text, text[]) TO authenticated;
COMMIT;
