-- Add a formative, non-gating role-play activity. Each learner turn is stored
-- as private R2 evidence; content matching remains formative and does not
-- claim to measure pronunciation.

alter table public.digital_textbook_speaking_evidence
  add column if not exists metadata jsonb not null default '{}'::jsonb;

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
)
insert into public.digital_textbook_activities (
  node_id,
  activity_key,
  activity_type,
  sort_order,
  prompt,
  instruction,
  options,
  public_config,
  max_attempts,
  counts_toward_completion
)
select
  target_node.id,
  'dialogue-roleplay',
  'speaking',
  3,
  '{"zh-CN":"选择一个角色，逐轮完成初次见面对话。","ko-KR":"한 역할을 골라 첫 만남 대화를 차례대로 완성하세요."}'::jsonb,
  '{"zh-CN":"系统播放对方台词；轮到你时录音、回听并确认。内容匹配度不代表发音分数。","ko-KR":"상대의 말을 들은 뒤 내 차례에 녹음하고 다시 들어 확인하세요. 내용 일치도는 발음 점수가 아닙니다."}'::jsonb,
  '[]'::jsonb,
  '{"practiceKind":"dialogue_roleplay","storage":"cloudflare_r2","scoreLabel":{"zh-CN":"对话内容匹配度","ko-KR":"대화 내용 일치도"},"pronunciationScore":false,"formative":true}'::jsonb,
  20,
  false
from target_node
on conflict (node_id, activity_key) do update set
  activity_type = excluded.activity_type,
  sort_order = excluded.sort_order,
  prompt = excluded.prompt,
  instruction = excluded.instruction,
  options = excluded.options,
  public_config = excluded.public_config,
  max_attempts = excluded.max_attempts,
  counts_toward_completion = excluded.counts_toward_completion,
  updated_at = now();
