BEGIN READ ONLY;
-- Catalog metadata only. Never joins student/enrollment/progress/message tables.
WITH korean AS (
 SELECT id FROM public.student_apps WHERE slug='korean'
), courses AS (
 SELECT c.* FROM public.courses c JOIN korean k ON k.id=c.student_app_id
), lessons AS (
 SELECT l.* FROM public.lessons l JOIN courses c ON c.id=l.course_id
), coverage AS (
 SELECT l.id,l.slug,l.course_id,l.is_published,l.unlock_mode,l.is_manually_locked,l.available_from,
 count(DISTINCT t.id) FILTER(WHERE t.status='published') AS published_textbooks,
 count(DISTINCT ch.id) FILTER(WHERE t.status='published' AND v.status='published' AND ch.status='published') AS published_chapters,
 count(DISTINCT m.id) AS modules,
 count(DISTINCT tl.id) FILTER(WHERE tl.status='published') AS published_teaching_lessons,
 count(DISTINCT sv.id) FILTER(WHERE sv.status='published') AS published_scripts,
 count(DISTINCT n.id) FILTER(WHERE sv.status='published') AS published_nodes,
 count(DISTINCT n.id) FILTER(WHERE t.status='published' AND v.status='published' AND ch.status='published'
   AND tl.status='published' AND p.status='published' AND sv.status='published'
   AND (coalesce(n.teacher_script->>'zh-CN','') ~ '[가-힣]' OR coalesce(n.teacher_script->>'ko-KR','') ~ '[가-힣]')) AS published_chain_korean_nodes
 FROM lessons l LEFT JOIN public.digital_textbooks t ON t.lesson_id=l.id
 LEFT JOIN public.digital_textbook_versions v ON v.textbook_id=t.id
 LEFT JOIN public.digital_textbook_chapters ch ON ch.version_id=v.id
 LEFT JOIN public.digital_textbook_modules m ON m.chapter_id=ch.id
 LEFT JOIN public.learning_agent_lessons tl ON tl.module_id=m.id
 LEFT JOIN public.learning_agent_profiles p ON p.id=tl.agent_profile_id
 LEFT JOIN public.learning_agent_script_versions sv ON sv.lesson_id=tl.id
 LEFT JOIN public.learning_agent_script_nodes n ON n.script_version_id=sv.id
 GROUP BY l.id,l.slug,l.course_id,l.is_published,l.unlock_mode,l.is_manually_locked,l.available_from
)
SELECT json_build_object('readonly',current_setting('transaction_read_only'),'observedAt',now(),
 'courses',(SELECT json_agg(json_build_object('id',id,'slug',slug,'published',is_published,'unlock',unlock_mode) ORDER BY slug) FROM courses),
 'lessonCoverage',(SELECT json_agg(to_jsonb(x) ORDER BY slug) FROM coverage x),
 'unlockCounts',(SELECT json_object_agg(mode,n) FROM (SELECT coalesce(unlock_mode,'NULL') mode,count(*) n FROM lessons GROUP BY unlock_mode) x));
COMMIT;
