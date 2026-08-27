begin;

update public.learning_agent_script_nodes node
set configuration = jsonb_set(
  coalesce(node.configuration, '{}'::jsonb),
  '{visualCue}',
  '{"targetKey":"scene:image","effect":"pulse","pulseCount":2}'::jsonb,
  true
)
from public.learning_agent_script_versions script_version
join public.learning_agent_lessons lesson
  on lesson.id = script_version.lesson_id
join public.digital_textbook_modules module
  on module.id = lesson.module_id
join public.digital_textbook_chapters chapter
  on chapter.id = module.chapter_id
where node.script_version_id = script_version.id
  and script_version.status = 'draft'
  and chapter.chapter_number = 1
  and module.module_code = 'orientation'
  and node.node_key = 'observe-scene';

commit;
