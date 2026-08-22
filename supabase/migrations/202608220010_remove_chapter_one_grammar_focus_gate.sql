-- The grammar lesson now has its own "语法理解 / 语法练习" page split, so an
-- additional full-screen focus gate only adds a redundant third transition.
update public.digital_textbook_activities as activity
set public_config = coalesce(activity.public_config, '{}'::jsonb) - 'focusMode',
    updated_at = now()
from public.digital_textbook_nodes as node
join public.digital_textbook_modules as module on module.id = node.module_id
join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
where activity.node_id = node.id
  and chapter.chapter_number = 1
  and node.node_code = 'topic-and-copula'
  and activity.activity_key = 'grammar-fill';
