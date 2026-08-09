begin;

-- 成长工具箱语法库升级为与互动教材语法一致的结构
-- 旧字段 explanation/rules 保留但不再使用（应用层写 meaning/cases/rows）
alter table public.growth_toolbox_grammar
  add column if not exists meaning text not null default '',
  add column if not exists cases jsonb not null default '[]'::jsonb,
  add column if not exists rows jsonb not null default '[]'::jsonb;

commit;
