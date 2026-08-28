begin;

-- Scene observation introduces the context. It must not ask the student to
-- answer before the following explanation and model dialogue provide the
-- language needed for the later understanding check.
update public.learning_agent_script_nodes node
set
  teacher_script = jsonb_set(
    coalesce(node.teacher_script, '{}'::jsonb),
    '{zh-CN}',
    to_jsonb('先看右侧图片。王明和智敏在校园国际交流中心第一次见面。第一次见面不能直接进入复杂话题，通常要先用一句礼貌的问候建立交流。'::text),
    true
  ),
  configuration = coalesce(node.configuration, '{}'::jsonb) - 'interaction'
from public.learning_agent_script_versions version
join public.learning_agent_lessons lesson on lesson.id = version.lesson_id
join public.learning_agent_profiles profile on profile.id = lesson.agent_profile_id
join public.digital_textbook_modules module on module.id = lesson.module_id
join public.digital_textbook_chapters chapter on chapter.id = module.chapter_id
join public.digital_textbook_versions textbook_version on textbook_version.id = chapter.version_id
join public.digital_textbooks textbook on textbook.id = textbook_version.textbook_id
where node.script_version_id = version.id
  and version.status = 'published'
  and profile.agent_code = 'uply-korean-teacher'
  and textbook.slug = 'korean-level-one-smart'
  and chapter.chapter_number = 1
  and module.module_code = 'orientation'
  and node.node_key = 'observe-scene';

commit;
