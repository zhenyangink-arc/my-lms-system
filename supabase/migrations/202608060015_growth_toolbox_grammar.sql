begin;

-- 成长工具箱独立语法库（与互动教材 digital_textbook content.grammar 完全独立）
create table if not exists public.growth_toolbox_grammar (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  explanation text not null default '',
  rules jsonb not null default '[]'::jsonb,
  examples jsonb not null default '[]'::jsonb,
  caution text not null default '',
  source text not null default 'custom' check (source in ('textbook', 'custom')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.growth_toolbox_grammar enable row level security;

-- 学生端可读全部语法库
create policy "authenticated read growth toolbox grammar"
  on public.growth_toolbox_grammar for select to authenticated
  using (true);

-- 写入走 service_role（管理端应用层鉴权后使用）

commit;
