begin;

create table if not exists public.learning_agent_node_interaction_secrets (
  node_id uuid primary key references public.learning_agent_script_nodes(id) on delete cascade,
  correct_option_index smallint not null check (correct_option_index between 0 and 5),
  correct_feedback jsonb not null default '{}'::jsonb check (jsonb_typeof(correct_feedback) = 'object'),
  incorrect_feedback jsonb not null default '{}'::jsonb check (jsonb_typeof(incorrect_feedback) = 'object'),
  evaluation jsonb not null default '{}'::jsonb check (jsonb_typeof(evaluation) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists learning_agent_node_interaction_secrets_set_updated_at
  on public.learning_agent_node_interaction_secrets;
create trigger learning_agent_node_interaction_secrets_set_updated_at
before update on public.learning_agent_node_interaction_secrets
for each row execute function private.set_updated_at();

alter table public.learning_agent_node_interaction_secrets enable row level security;
revoke all on table public.learning_agent_node_interaction_secrets from public, anon, authenticated;

comment on table public.learning_agent_node_interaction_secrets is
  '仅后端可读的教学 Agent 节点答案、反馈和判定规则。';

with target as (
  select node.id
  from public.learning_agent_script_nodes node
  join public.learning_agent_script_versions script_version
    on script_version.id = node.script_version_id
  join public.learning_agent_lessons lesson on lesson.id = script_version.lesson_id
  join public.digital_textbook_modules module on module.id = lesson.module_id
  join public.digital_textbook_chapters chapter on chapter.id = module.chapter_id
  where script_version.status = 'draft'
    and chapter.chapter_number = 1
    and module.module_code = 'orientation'
    and node.node_key = 'observe-scene'
)
update public.learning_agent_script_nodes node
set configuration = coalesce(node.configuration, '{}'::jsonb) || jsonb_build_object(
  'interaction', jsonb_build_object(
    'kind', 'single_choice',
    'prompt', jsonb_build_object(
      'zh-CN', '第一次见面时，王明应该先说哪一句？',
      'ko-KR', '처음 만났을 때 왕밍은 먼저 어떤 말을 해야 할까요?'
    ),
    'options', jsonb_build_array('안녕하세요?', '얼마예요?', '어디에 있어요?'),
    'required', true,
    'maxAttempts', 3
  )
)
from target
where node.id = target.id;

with target as (
  select node.id
  from public.learning_agent_script_nodes node
  join public.learning_agent_script_versions script_version
    on script_version.id = node.script_version_id
  join public.learning_agent_lessons lesson on lesson.id = script_version.lesson_id
  join public.digital_textbook_modules module on module.id = lesson.module_id
  join public.digital_textbook_chapters chapter on chapter.id = module.chapter_id
  where script_version.status = 'draft'
    and chapter.chapter_number = 1
    and module.module_code = 'orientation'
    and node.node_key = 'observe-scene'
)
insert into public.learning_agent_node_interaction_secrets (
  node_id, correct_option_index, correct_feedback, incorrect_feedback
)
select
  target.id,
  0,
  jsonb_build_object(
    'zh-CN', '对，第一次见面先说 안녕하세요?。这是一句礼貌而自然的问候。',
    'ko-KR', '맞아요. 처음 만났을 때는 먼저 안녕하세요?라고 인사해요.'
  ),
  jsonb_build_object(
    'zh-CN', '先找表示问候的句子，再试一次。',
    'ko-KR', '인사하는 표현을 찾아서 다시 선택해 보세요.'
  )
from target
on conflict (node_id) do update set
  correct_option_index = excluded.correct_option_index,
  correct_feedback = excluded.correct_feedback,
  incorrect_feedback = excluded.incorrect_feedback,
  updated_at = now();

commit;
