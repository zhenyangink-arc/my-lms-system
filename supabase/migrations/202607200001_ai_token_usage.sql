create table if not exists public.ai_token_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  model text not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  created_at timestamptz not null default now()
);

create index if not exists ai_token_usage_created_at_idx on public.ai_token_usage (created_at desc);
create index if not exists ai_token_usage_user_id_idx on public.ai_token_usage (user_id);

alter table public.ai_token_usage enable row level security;

create policy "admin can read AI token usage"
on public.ai_token_usage for select to authenticated
using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'ceo', 'super_admin')));
