begin;

alter table public.ai_token_usage
  add column if not exists provider text,
  add column if not exists feature_code text,
  add column if not exists agent_code text;

update public.ai_token_usage
set provider = case
  when lower(model) like 'qwen:%' or lower(model) like 'qwen%' then 'qwen'
  when lower(model) like 'deepseek:%' or lower(model) like 'deepseek%' then 'deepseek'
  when model = 'conversation_voice_image' then 'self_hosted'
  else 'unknown'
end
where provider is null;

update public.ai_token_usage
set feature_code = case
  when lower(model) like 'qwen:%' or lower(model) like 'deepseek:%' then 'learning_agent'
  when model = 'conversation_voice_image' then 'ai_conversation_experience'
  else 'unknown'
end
where feature_code is null;

update public.ai_token_usage
set model = split_part(model, ':', 2)
where provider in ('qwen', 'deepseek')
  and model like '%:%';

alter table public.ai_token_usage
  alter column provider set default 'unknown',
  alter column provider set not null,
  alter column feature_code set default 'unknown',
  alter column feature_code set not null;

alter table public.ai_token_usage
  drop constraint if exists ai_token_usage_provider_check;
alter table public.ai_token_usage
  add constraint ai_token_usage_provider_check
  check (provider in ('qwen', 'deepseek', 'self_hosted', 'unknown'));

create index if not exists ai_token_usage_provider_model_created_idx
  on public.ai_token_usage (provider, model, created_at desc);
create index if not exists ai_token_usage_feature_created_idx
  on public.ai_token_usage (feature_code, created_at desc);

comment on column public.ai_token_usage.provider is
  'Authoritative model provider used for this call; never inferred by the management UI.';
comment on column public.ai_token_usage.feature_code is
  'Product feature that generated the model call, such as learning_agent.';
comment on column public.ai_token_usage.agent_code is
  'Optional learning Agent identifier for per-teacher usage attribution.';

commit;
