-- ============================================================
-- 课程树多视图：学生端每个"查看全部课程"按钮对应一个视图，
-- 每个视图独立配置展示哪些分类/课程。
--
-- 现有 courses.show_on_home_tree / course_categories.show_on_home_tree
-- 迁移为默认视图 'home'（首页课程树）。
-- ============================================================

begin;

create table public.course_tree_views (
  id bigint generated always as identity primary key,
  slug text not null unique,
  title text not null,
  sort_order integer not null default 0,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.course_tree_views is
  '课程树视图：学生端每个"查看全部课程"按钮对应一个视图（如 home/study/exam）。';

create table public.course_tree_view_items (
  id bigint generated always as identity primary key,
  view_slug text not null references public.course_tree_views(slug) on delete cascade,
  entity_type text not null check (entity_type in ('category', 'course')),
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  unique (view_slug, entity_type, entity_id)
);

comment on table public.course_tree_view_items is
  '课程树视图条目：某视图下展示哪些分类/课程（分类与课程都命中才显示该课程分支）。';

-- 默认视图：首页课程树
insert into public.course_tree_views (slug, title, sort_order)
values ('home', '首页课程树', 1);

-- 迁移现有 show_on_home_tree 数据 → home 视图
insert into public.course_tree_view_items (view_slug, entity_type, entity_id)
select 'home', 'course', id from public.courses where show_on_home_tree;

insert into public.course_tree_view_items (view_slug, entity_type, entity_id)
select 'home', 'category', id from public.course_categories where show_on_home_tree;

-- RLS：已认证用户可读（学生端读取树），写操作走服务端管理 actions
alter table public.course_tree_views enable row level security;
alter table public.course_tree_view_items enable row level security;

create policy "authenticated read course tree views"
on public.course_tree_views for select to authenticated
using (true);

create policy "authenticated read course tree view items"
on public.course_tree_view_items for select to authenticated
using (true);

commit;
