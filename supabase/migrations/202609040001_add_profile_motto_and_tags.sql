-- ============================================================
-- 学生个人空间新增字段：一句话个性签名、兴趣标签
-- 头像沿用已有的 avatar_path，不需要新字段。
-- ============================================================

alter table public.profiles
  add column if not exists motto text,
  add column if not exists interest_tags text[] not null default '{}';

alter table public.profiles drop constraint if exists profiles_motto_length_check;
alter table public.profiles add constraint profiles_motto_length_check
  check (motto is null or char_length(motto) <= 60);

alter table public.profiles drop constraint if exists profiles_interest_tags_count_check;
alter table public.profiles add constraint profiles_interest_tags_count_check
  check (array_length(interest_tags, 1) is null or array_length(interest_tags, 1) <= 8);

comment on column public.profiles.motto is '个人空间展示的一句话个性签名，最长 60 字。';
comment on column public.profiles.interest_tags is '个人空间展示的兴趣标签，取自预设列表，最多 8 个。';
