begin;

-- 第一章课前导航先启用金老师。人物始终留在教学区，具体动作由当前教学节点决定。
update public.learning_agent_script_nodes node
set
  configuration = jsonb_set(
    coalesce(node.configuration, '{}'::jsonb),
    '{virtualCharacter}',
    jsonb_build_object(
      'kind', 'uply-teacher',
      'position', 'right',
      'pose', case
        when node.node_type = 'opening' then 'greeting'
        when node.node_type = 'summary' then 'encouraging'
        else 'explaining'
      end,
      'voiceEnabled', true,
      'voiceLanguage', 'auto',
      'voiceRate', 1
    ),
    true
  ),
  updated_at = now()
from public.learning_agent_script_versions version
join public.learning_agent_lessons lesson on lesson.id = version.lesson_id
join public.learning_agent_profiles profile on profile.id = lesson.agent_profile_id
join public.digital_textbook_modules module on module.id = lesson.module_id
join public.digital_textbook_chapters chapter on chapter.id = module.chapter_id
join public.digital_textbook_versions textbook_version on textbook_version.id = chapter.version_id
join public.digital_textbooks textbook on textbook.id = textbook_version.textbook_id
where node.script_version_id = version.id
  and version.status in ('published', 'draft')
  and profile.agent_code = 'uply-korean-teacher'
  and textbook.slug = 'korean-level-one-smart'
  and chapter.chapter_number = 1
  and module.module_code = 'orientation';

commit;
