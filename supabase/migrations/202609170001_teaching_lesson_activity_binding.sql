-- Canonical draft Activity binding. Additive function only; no content seeds.
BEGIN;
CREATE FUNCTION public.create_teaching_lesson_activity_binding(
  p_expected_freeze jsonb,
  p_private_answer jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  approved constant jsonb := '{"lesson":"870d1e4c70d884294d31fa8da3cb62d5ecadb2d050b4056c03c9ce47525497c3","script":"dd808c0ed6d816809f0a527523473c1da4021f2ece369d82efa902312ed860a8","versionRow":"a26aabb7dec01619d475db395f8ba628aaf48ec0da3f41c553d518b34a9da158","nodes":["ad1d0d94e8c6c10daed7bd05daf1194f9b52300d8bdb87d3fa31e1a498a614b6","892dba849c29f16c336f199667942887992591fc5a6e3fda3fe21abe18262cd8","961b23a6e128744783793a15fb445c6611cbed7e9b94ccb5c6bab32d63229b71","28d7516c505956a7b50b52db44bf61e08839cb7e19d46ef0d23d982c412dc958","3b48b709e005413be9c9599fc428a464f33928655234da13e2751c36da505bb8","b1f9d770a40cb8096ef8df40a375afe15612f4add7c5882b1e8c91f8dd1d2c50","93b340135770be2aed8ded1fa3bb8310ded773f7799cd054d767fd8c29a7bd4e","0e5c8fc654af69801b2977dbc01252668368df6f92a2691f99cbb829fa36168b"],"parents":{"lessons":"5cc6c16a227f695e913acfabf930d26ee08febb20e2251881257a89e6bd99e53","digital_textbooks":"e5a83e4c6eae9a5467dc3b9bc0bc80661c2736f40f1966d72fa4371e6f64ee3c","digital_textbook_versions":"f6e179b2be3b045efcb440219180b33c6844ecd0044f22050504756b12646232","digital_textbook_chapters":"ab9580d2db8ca1bb91a3abcf595a213a78c5e0870f886d95505354a7485a4535","digital_textbook_modules":"85d9512d9a2eacb0d159f6e8b6baecbbffc6e7881f0bdf383fd7edea2d3e5d73","learning_agent_lessons":"1215200610900050bb5c0ac81ea8d7d6cb11e71e897a962a10ff4a35542de953"}}'::jsonb;
  lesson public.learning_agent_lessons%rowtype;
  module public.digital_textbook_modules%rowtype;
  chapter public.digital_textbook_chapters%rowtype;
  version public.digital_textbook_versions%rowtype;
  book public.digital_textbooks%rowtype;
  catalog public.lessons%rowtype;
  script public.learning_agent_script_versions%rowtype;
  n public.digital_textbook_nodes%rowtype;
  a public.digital_textbook_activities%rowtype;
  k public.digital_textbook_activity_secrets%rowtype;
  hashes jsonb;
  parents jsonb;
  inserted integer := 0;
  result text := 'EXISTING';
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(private.is_platform_owner(),false)
     OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND status='active')
     OR EXISTS(SELECT 1 FROM public.tenant_provisioned_accounts WHERE user_id=auth.uid()) THEN
    RAISE EXCEPTION 'AUTHORING_FORBIDDEN' USING ERRCODE='42501';
  END IF;
  IF p_expected_freeze IS DISTINCT FROM approved THEN
    RAISE EXCEPTION 'AUTHORING_FREEZE_MISMATCH' USING ERRCODE='PT409';
  END IF;
  -- Private answer is supplied only by the authorized server workflow; never returned.
  IF p_private_answer IS NULL OR jsonb_typeof(p_private_answer) <> 'object'
     OR (p_private_answer - 'kind' - 'value') <> '{}'::jsonb
     OR p_private_answer->>'kind' IS DISTINCT FROM 'index'
     OR p_private_answer->'value' NOT IN ('0'::jsonb,'1'::jsonb,'2'::jsonb)
     OR NOT (p_private_answer ? 'value') THEN
    RAISE EXCEPTION 'AUTHORING_INVALID_PRIVATE_CONTRACT' USING ERRCODE='22023';
  END IF;
  PERFORM runtime_publish_private.authoring_lock();
  SELECT * INTO STRICT lesson FROM public.learning_agent_lessons l
    WHERE encode(sha256(convert_to(l.id::text,'UTF8')),'hex')=approved->>'lesson' FOR UPDATE;
  SELECT * INTO STRICT module FROM public.digital_textbook_modules WHERE id=lesson.module_id FOR UPDATE;
  SELECT * INTO STRICT chapter FROM public.digital_textbook_chapters WHERE id=module.chapter_id FOR UPDATE;
  SELECT * INTO STRICT version FROM public.digital_textbook_versions WHERE id=chapter.version_id FOR UPDATE;
  SELECT * INTO STRICT book FROM public.digital_textbooks WHERE id=version.textbook_id FOR UPDATE;
  SELECT * INTO STRICT catalog FROM public.lessons WHERE id=book.lesson_id FOR UPDATE;
  PERFORM 1 FROM public.courses WHERE id=catalog.course_id FOR SHARE;
  IF module.module_code<>'orientation' OR chapter.chapter_number<>0
    OR chapter.status<>'draft' OR version.status<>'draft' OR version.version_number<>1 OR book.status<>'draft'
    OR chapter.title->>'zh-CN' IS DISTINCT FROM '韩文字母入门'
    OR NOT EXISTS(SELECT 1 FROM public.courses c JOIN public.student_apps app ON app.id=c.student_app_id WHERE c.id=catalog.course_id AND app.slug='korean') THEN
    RAISE EXCEPTION 'AUTHORING_TARGET_MISMATCH' USING ERRCODE='PT409';
  END IF;
  IF (SELECT count(*) FROM public.learning_agent_script_versions WHERE lesson_id=lesson.id)<>1 THEN
    RAISE EXCEPTION 'AUTHORING_SCRIPT_COUNT' USING ERRCODE='PT409';
  END IF;
  SELECT * INTO STRICT script FROM public.learning_agent_script_versions WHERE lesson_id=lesson.id FOR UPDATE;
  IF script.version_number<>1 OR script.status<>'draft' OR script.published_at IS NOT NULL
     OR encode(sha256(convert_to(script.id::text,'UTF8')),'hex')<>approved->>'script'
     OR encode(sha256(convert_to(jsonb_build_array(to_jsonb(script))::text,'UTF8')),'hex')<>approved->>'versionRow' THEN
    RAISE EXCEPTION 'AUTHORING_SCRIPT_CHANGED' USING ERRCODE='PT409';
  END IF;
  PERFORM 1 FROM public.learning_agent_script_nodes WHERE script_version_id=script.id ORDER BY sort_order FOR UPDATE;
  SELECT jsonb_agg(encode(sha256(convert_to(to_jsonb(s)::text,'UTF8')),'hex') ORDER BY sort_order) INTO hashes
    FROM public.learning_agent_script_nodes s WHERE script_version_id=script.id;
  IF hashes IS DISTINCT FROM approved->'nodes' OR jsonb_array_length(hashes)<>8 THEN
    RAISE EXCEPTION 'AUTHORING_FROZEN_NODES_CHANGED' USING ERRCODE='PT409';
  END IF;
  parents := jsonb_build_object(
    'lessons',encode(sha256(convert_to(jsonb_build_array(to_jsonb(catalog))::text,'UTF8')),'hex'),
    'digital_textbooks',encode(sha256(convert_to(jsonb_build_array(to_jsonb(book))::text,'UTF8')),'hex'),
    'digital_textbook_versions',encode(sha256(convert_to(jsonb_build_array(to_jsonb(version))::text,'UTF8')),'hex'),
    'digital_textbook_chapters',encode(sha256(convert_to(jsonb_build_array(to_jsonb(chapter))::text,'UTF8')),'hex'),
    'digital_textbook_modules',encode(sha256(convert_to(jsonb_build_array(to_jsonb(module))::text,'UTF8')),'hex'),
    'learning_agent_lessons',encode(sha256(convert_to(jsonb_build_array(to_jsonb(lesson))::text,'UTF8')),'hex'));
  IF parents IS DISTINCT FROM approved->'parents' THEN
    RAISE EXCEPTION 'AUTHORING_PARENT_OR_OBJECTIVES_CHANGED' USING ERRCODE='PT409';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.digital_textbook_nodes WHERE module_id=module.id) THEN
    INSERT INTO public.digital_textbook_nodes(module_id,node_code,node_type,sort_order,estimated_minutes,title,content)
      VALUES(module.id,'hangul-introduction-vowel-recognition','practice',1,1,'{"zh-CN":"元音辨认"}','{}') RETURNING * INTO n;
    GET DIAGNOSTICS inserted = ROW_COUNT;
    IF inserted<>1 THEN RAISE EXCEPTION 'AUTHORING_NODE_COUNT'; END IF;
    INSERT INTO public.digital_textbook_activities(node_id,activity_key,activity_type,sort_order,prompt,instruction,options,public_config,max_attempts,counts_toward_completion)
      VALUES(n.id,'hangul-introduction-vowel-recognition','single_choice',1,'{"zh-CN":"哪个是元音？"}','{"zh-CN":"请选择一个选项。"}',
        '[{"zh-CN":"ㄱ"},{"zh-CN":"ㅏ"},{"zh-CN":"ㄴ"}]','{}',3,true) RETURNING * INTO a;
    GET DIAGNOSTICS inserted = ROW_COUNT;
    IF inserted<>1 THEN RAISE EXCEPTION 'AUTHORING_ACTIVITY_COUNT'; END IF;
    INSERT INTO public.digital_textbook_activity_secrets(activity_id,answer_key) VALUES(a.id,p_private_answer) RETURNING * INTO k;
    GET DIAGNOSTICS inserted = ROW_COUNT;
    IF inserted<>1 THEN RAISE EXCEPTION 'AUTHORING_SECRET_COUNT'; END IF;
    result := 'CREATED';
  END IF;
  -- Whole target must be exactly one complete binding. Never repair partial objects.
  IF (SELECT count(*) FROM public.digital_textbook_nodes WHERE module_id=module.id)<>1 THEN
    RAISE EXCEPTION 'AUTHORING_PARTIAL_OR_DUPLICATE' USING ERRCODE='PT409';
  END IF;
  SELECT * INTO STRICT n FROM public.digital_textbook_nodes WHERE module_id=module.id;
  IF (SELECT count(*) FROM public.digital_textbook_activities WHERE node_id=n.id)<>1 THEN
    RAISE EXCEPTION 'AUTHORING_PARTIAL_OR_DUPLICATE' USING ERRCODE='PT409';
  END IF;
  SELECT * INTO STRICT a FROM public.digital_textbook_activities WHERE node_id=n.id;
  SELECT * INTO STRICT k FROM public.digital_textbook_activity_secrets WHERE activity_id=a.id;
  IF n.node_code<>'hangul-introduction-vowel-recognition' OR n.node_type<>'practice' OR n.sort_order<>1 OR n.estimated_minutes<>1
     OR n.title<>'{"zh-CN":"元音辨认"}'::jsonb OR n.content<>'{}'::jsonb OR n.authoring_grammar_identities<>'[]'::jsonb
     OR a.activity_key<>'hangul-introduction-vowel-recognition' OR a.activity_type<>'single_choice' OR a.sort_order<>1
     OR a.prompt<>'{"zh-CN":"哪个是元音？"}'::jsonb OR a.instruction<>'{"zh-CN":"请选择一个选项。"}'::jsonb
     OR a.options<>'[{"zh-CN":"ㄱ"},{"zh-CN":"ㅏ"},{"zh-CN":"ㄴ"}]'::jsonb OR a.public_config<>'{}'::jsonb OR a.max_attempts<>3 OR NOT a.counts_toward_completion
     OR k.answer_key IS DISTINCT FROM p_private_answer OR k.explanation<>'{}'::jsonb OR k.transcript_ko IS NOT NULL OR k.audio_object_key IS NOT NULL OR k.audio_status<>'pending' THEN
    RAISE EXCEPTION 'AUTHORING_EXISTING_BINDING_MISMATCH' USING ERRCODE='PT409';
  END IF;
  RETURN jsonb_build_object('contract','canonical-activity-binding/1','result',result,
    'targetAlias','hangul-introduction','activityAlias','hangul-introduction-vowel-recognition',
    'operatorHash',encode(sha256(convert_to(auth.uid()::text,'UTF8')),'hex'),
    'nodeHash',encode(sha256(convert_to(n.id::text,'UTF8')),'hex'),
    'activityHash',encode(sha256(convert_to(a.id::text,'UTF8')),'hex'),
    'insertedRows',CASE WHEN result='CREATED' THEN 3 ELSE 0 END,
    'observedAt',clock_timestamp(),'transactionRef',pg_current_xact_id()::text);
END;
$$;
REVOKE ALL ON FUNCTION public.create_teaching_lesson_activity_binding(jsonb,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.create_teaching_lesson_activity_binding(jsonb,jsonb) TO authenticated;
COMMIT;
