begin;

-- 成长工具箱独立练习词库（与互动教材 digital_textbook_nodes 完全独立）
create table if not exists public.growth_toolbox_vocabulary (
  id uuid primary key default gen_random_uuid(),
  ko text not null default '',
  zh text not null default '',
  pos text not null default '',
  collocation text not null default '',
  transcription text not null default '',
  source text not null default 'custom' check (source in ('textbook', 'custom')),
  source_chapter_id uuid null references public.digital_textbook_chapters(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.growth_toolbox_vocabulary enable row level security;

-- 学生端可读全部词库
create policy "authenticated read growth toolbox vocabulary"
  on public.growth_toolbox_vocabulary for select to authenticated
  using (true);

-- 写入走 service_role（管理端应用层鉴权后使用）

-- 一次性导入互动教材现有词汇，标记来源为 textbook（来自互动教材）
insert into public.growth_toolbox_vocabulary
  (ko, zh, pos, collocation, transcription, source, source_chapter_id, sort_order)
select
  coalesce(elem.value->>'ko', ''),
  coalesce(elem.value->>'zh', ''),
  coalesce(elem.value->>'pos', ''),
  coalesce(elem.value->>'collocation', ''),
  coalesce(elem.value->>'transcription', ''),
  'textbook',
  chapter.id,
  row_number() over (order by n.created_at, elem.ordinality)
from public.digital_textbook_nodes n
join public.digital_textbook_modules m on m.id = n.module_id
join public.digital_textbook_chapters chapter on chapter.id = m.chapter_id
cross join lateral jsonb_array_elements(n.content->'vocabulary') with ordinality as elem
where m.module_code = 'vocabulary';

commit;
