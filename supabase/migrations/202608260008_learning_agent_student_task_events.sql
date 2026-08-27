begin;

create table public.learning_agent_task_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.learning_agent_sessions(id) on delete cascade,
  script_version_id uuid not null references public.learning_agent_script_versions(id) on delete cascade,
  node_id uuid not null references public.learning_agent_script_nodes(id) on delete cascade,
  event_type text not null check (event_type in ('audio_completed', 'activity_opened', 'activity_completed')),
  target_key text not null check (char_length(target_key) between 1 and 200),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (session_id, node_id, event_type, target_key)
);

create index learning_agent_task_events_student_idx
  on public.learning_agent_task_events(tenant_id, student_id, session_id, created_at desc);

alter table public.learning_agent_task_events enable row level security;
revoke all on table public.learning_agent_task_events from public, anon, authenticated;

with target_nodes as (
  select node.id
  from public.learning_agent_script_nodes node
  join public.learning_agent_script_versions script_version on script_version.id = node.script_version_id
  join public.learning_agent_lessons lesson on lesson.id = script_version.lesson_id
  join public.learning_agent_profiles profile on profile.id = lesson.agent_profile_id
  join public.digital_textbook_modules module on module.id = lesson.module_id
  join public.digital_textbook_chapters chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions textbook_version on textbook_version.id = chapter.version_id
  join public.digital_textbooks textbook on textbook.id = textbook_version.textbook_id
  where profile.agent_code = 'uply-korean-teacher'
    and textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and module.module_code = 'orientation'
    and node.node_key = 'model-dialogue'
)
update public.learning_agent_script_nodes node
set configuration = coalesce(node.configuration, '{}'::jsonb) || jsonb_build_object(
      'studentTask', jsonb_build_object(
        'kind', 'play_expression_audio',
        'instruction', jsonb_build_object(
          'zh-CN', '请到右侧“情景与表达”的“问候”中，点击第一句 안녕하세요? 并完整听完。',
          'ko-KR', '오른쪽 상황과 표현의 인사에서 첫 문장 안녕하세요?를 눌러 끝까지 들어 보세요.'
        ),
        'targetLabel', jsonb_build_object('zh-CN', '问候 · 안녕하세요?', 'ko-KR', '인사 · 안녕하세요?'),
        'targetKey', 'dialogue:greeting:0',
        'eventType', 'audio_completed',
        'required', true
      )
    ),
    action_type = 'play_expression',
    updated_at = now()
from target_nodes
where node.id = target_nodes.id;

commit;
