begin;

-- The voice/image conversation proxy now checks a rolling 24h per-user quota
-- against this table on every message; back it with a composite index instead
-- of relying on the single-column user_id index.
create index if not exists ai_token_usage_user_model_created_idx
  on public.ai_token_usage (user_id, model, created_at desc);

commit;
