-- Recalculate historical progress after roleplay became a required activity.
-- Students without a verified roleplay attempt must no longer remain completed.

with target_node as (
  select node.id
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions as version on version.id = chapter.version_id
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and node.node_code = 'club-first-meeting'
), recalculated as (
  select
    progress.tenant_id,
    progress.student_id,
    progress.node_id,
    progress.version_id,
    count(distinct activity.id)::integer as total_required,
    count(distinct activity.id) filter (where attempt.activity_id is not null)::integer as completed_required
  from public.digital_textbook_node_progress as progress
  join public.digital_textbook_activities as activity
    on activity.node_id = progress.node_id
   and activity.counts_toward_completion
  left join public.digital_textbook_attempts as attempt
    on attempt.activity_id = activity.id
   and attempt.tenant_id = progress.tenant_id
   and attempt.student_id = progress.student_id
   and attempt.version_id = progress.version_id
   and attempt.is_correct is true
  where progress.node_id in (select id from target_node)
  group by progress.tenant_id, progress.student_id, progress.node_id, progress.version_id
)
update public.digital_textbook_node_progress as progress
set status = case
      when recalculated.total_required > 0
       and recalculated.completed_required = recalculated.total_required
        then 'completed'
      else 'in_progress'
    end,
    completion_percent = case
      when recalculated.total_required = 0 then 0
      else round(100.0 * recalculated.completed_required / recalculated.total_required)::integer
    end,
    updated_at = now()
from recalculated
where progress.tenant_id = recalculated.tenant_id
  and progress.student_id = recalculated.student_id
  and progress.node_id = recalculated.node_id
  and progress.version_id = recalculated.version_id;
