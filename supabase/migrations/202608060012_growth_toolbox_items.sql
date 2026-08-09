begin;

-- 学生端"成长工具箱"四个练习入口的配置表
create table if not exists public.growth_toolbox_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  href text not null,
  icon_name text not null default 'wrench',
  accent text not null default 'var(--app-accent)',
  soft text not null default 'var(--app-accent-soft)',
  sort_order integer not null default 0,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.growth_toolbox_items enable row level security;

-- 学生端可读全部已启用条目(启停过滤在应用层做，管理端需要看全部)
create policy "authenticated read growth toolbox items"
  on public.growth_toolbox_items for select to authenticated
  using (true);

-- 写入走 service_role（管理端应用层鉴权后使用）

insert into public.growth_toolbox_items
  (slug, title, description, href, icon_name, accent, soft, sort_order, is_enabled)
values
  ('vocabulary', '单词练习', '按章节巩固词汇，掌握发音与含义，为听说读写打底。', '/dashboard/toolbox/vocabulary', 'notebook-pen', 'var(--app-accent)', 'var(--app-accent-soft)', 1, true),
  ('speaking', '口语练习', '情境对话与发音练习，开口说韩语，越练越自然。', '/dashboard/toolbox/speaking', 'mic', 'var(--app-warm)', 'var(--app-warm-soft)', 2, true),
  ('grammar', '语法练习', '梳理助词、句式与常用表达，把规则变成语感。', '/dashboard/toolbox/grammar', 'book-open', 'var(--app-secondary)', 'var(--app-secondary-soft)', 3, true),
  ('listening', '听力练习', '听音辨义，磨耳朵提升对话理解与反应速度。', '/dashboard/toolbox/listening', 'ear', 'var(--app-success)', 'var(--app-success-soft)', 4, true);

commit;
