-- The dialogue node is complete only after the learner has recorded every turn
-- for one selected role. Speech recognition and content score remain optional.

with target_activity as (
  select activity.id
  from public.digital_textbook_activities as activity
  join public.digital_textbook_nodes as node on node.id = activity.node_id
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions as version on version.id = chapter.version_id
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and node.node_code = 'club-first-meeting'
    and activity.activity_key = 'dialogue-roleplay'
)
update public.digital_textbook_activities as activity
set counts_toward_completion = true,
    public_config = activity.public_config || jsonb_build_object(
      'completionRequirement', 'all_role_turns_recorded',
      'scoreRequired', false
    ),
    updated_at = now()
where activity.id in (select id from target_activity);
