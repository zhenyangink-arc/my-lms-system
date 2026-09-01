begin;

create table public.smart_textbook_learning_target_registry (
  id uuid primary key default gen_random_uuid(),
  module_code text not null,
  target_key text not null,
  page_key text not null,
  page_label text not null,
  region_key text not null,
  region_label text not null,
  label text not null,
  scope text not null check (scope in ('page', 'region', 'element')),
  kind text not null check (kind in ('layout', 'tab', 'status', 'image', 'title', 'button', 'expression', 'activity')),
  supports_student_action boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_code, target_key)
);

create index smart_textbook_learning_target_registry_module_idx
  on public.smart_textbook_learning_target_registry(module_code, sort_order);

drop trigger if exists smart_textbook_learning_target_registry_set_updated_at on public.smart_textbook_learning_target_registry;
create trigger smart_textbook_learning_target_registry_set_updated_at
before update on public.smart_textbook_learning_target_registry
for each row execute function private.set_updated_at();

alter table public.smart_textbook_learning_target_registry enable row level security;

create policy "platform owner manages smart textbook learning target registry"
on public.smart_textbook_learning_target_registry for all to authenticated
using ((select private.is_platform_owner()))
with check ((select private.is_platform_owner()));

grant select on public.smart_textbook_learning_target_registry to authenticated;
grant all on public.smart_textbook_learning_target_registry to service_role;

-- Seed the "orientation" module's static skeleton — the same fixed buttons, tabs,
-- images and status labels this module renders in every chapter (chapter-specific
-- dialogue lines and activities are generated at read time from that chapter's own
-- content, not stored here).
insert into public.smart_textbook_learning_target_registry
  (module_code, target_key, page_key, page_label, region_key, region_label, label, scope, kind, supports_student_action, sort_order)
values
  ('orientation', 'orientation:header', 'header', '固定顶部栏', 'header', '顶部栏', '整个顶部栏', 'region', 'layout', false, 0),
  ('orientation', 'orientation:header:hide', 'header', '固定顶部栏', 'header', '顶部栏', '按钮1 · 隐藏学习区', 'element', 'button', false, 1),
  ('orientation', 'orientation:header:tab:scene', 'header', '固定顶部栏', 'header', '顶部栏', '页签1 · 情景与表达', 'element', 'tab', false, 2),
  ('orientation', 'orientation:header:tab:diagnosis', 'header', '固定顶部栏', 'header', '顶部栏', '页签2 · 情景诊断', 'element', 'tab', false, 3),
  ('orientation', 'orientation:header:progress', 'header', '固定顶部栏', 'header', '顶部栏', '信息1 · 学习完成度', 'element', 'status', false, 4),
  ('orientation', 'orientation:header:goal', 'header', '固定顶部栏', 'header', '顶部栏', '信息2 · 当前目标序号', 'element', 'status', false, 5),
  ('orientation', 'orientation:page:scene', 'scene', '第1页 · 情景与表达', 'page', '整个页面', '整个"情景与表达"页面', 'page', 'layout', false, 6),
  ('orientation', 'orientation:scene', 'scene', '第1页 · 情景与表达', 'scene', '区域1 · 主情景图', '整个主情景图片区', 'region', 'layout', false, 7),
  ('orientation', 'scene:image', 'scene', '第1页 · 情景与表达', 'scene', '区域1 · 主情景图', '图片1 · 第一次见面情景图', 'element', 'image', false, 8),
  ('orientation', 'orientation:scene:audio', 'scene', '第1页 · 情景与表达', 'scene', '区域1 · 主情景图', '按钮1 · 播放情景对话', 'element', 'button', true, 9),
  ('orientation', 'orientation:scene:title', 'scene', '第1页 · 情景与表达', 'scene', '区域1 · 主情景图', '标题1 · 情景名称', 'element', 'title', false, 10),
  ('orientation', 'orientation:scene:meta', 'scene', '第1页 · 情景与表达', 'scene', '区域1 · 主情景图', '信息1 · 学习时长与交流功能', 'element', 'status', false, 11),
  ('orientation', 'orientation:phrases', 'scene', '第1页 · 情景与表达', 'phrases', '区域2 · 本课可调用表达', '整个表达区', 'region', 'layout', false, 12),
  ('orientation', 'orientation:phrases:follow', 'scene', '第1页 · 情景与表达', 'phrases', '区域2 · 本课可调用表达', '按钮1 · 逐句跟读', 'element', 'button', true, 13),
  ('orientation', 'orientation:phrases:play-all', 'scene', '第1页 · 情景与表达', 'phrases', '区域2 · 本课可调用表达', '按钮2 · 整组播放', 'element', 'button', true, 14),
  ('orientation', 'orientation:page:diagnosis', 'diagnosis', '第2页 · 情景诊断', 'page', '整个页面', '整个"情景诊断"页面', 'page', 'layout', false, 15);

commit;
