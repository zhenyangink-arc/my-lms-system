-- ============================================================
-- 学校管理、专业管理与学生会员权限
-- 说明：保留原有韩国大学库，在其上增加统一学校层，不迁移或删除历史学生数据。
-- ============================================================

-- 学生权限分为四档；VIP2、VIP3 先继承 VIP1 基础能力，额外能力后续再配置。
alter table public.profiles
  add column if not exists membership_tier text not null default 'normal',
  add column if not exists membership_updated_at timestamptz,
  add column if not exists membership_updated_by uuid references auth.users(id) on delete set null;

alter table public.profiles
  drop constraint if exists profiles_membership_tier_check;
alter table public.profiles
  add constraint profiles_membership_tier_check check (
    membership_tier in ('normal', 'vip1', 'vip2', 'vip3')
  );

-- 韩国大学库补充校徽和长篇介绍，学生端与管理端共同使用。
alter table public.korean_universities
  add column if not exists logo_url text,
  add column if not exists detailed_introduction text;

-- 五类学校共用主表；管理中心以“总览 + 五类学校”组成六个入口。
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  category text not null check (
    category in ('korean_university', 'chinese_university', 'high_school', 'vocational_secondary', 'technical_school')
  ),
  source_korean_university_id uuid unique references public.korean_universities(id) on delete cascade,
  slug text not null unique,
  name_zh text not null check (char_length(trim(name_zh)) between 2 and 120),
  name_local text,
  logo_url text,
  ownership text not null default 'private' check (ownership in ('national', 'public', 'private', 'other')),
  province text,
  city text,
  summary text,
  detailed_introduction text,
  is_published boolean not null default true,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 专业独立管理，避免把专业内容堆叠在学校介绍字段中。
create table if not exists public.school_programs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  source_korean_program_id uuid unique references public.korean_university_programs(id) on delete cascade,
  name_zh text not null check (char_length(trim(name_zh)) between 2 and 160),
  name_local text,
  education_stage text not null default 'other' check (
    education_stage in ('language', 'bachelor_fresh', 'bachelor_transfer', 'master', 'doctor', 'high_school', 'vocational', 'technical', 'other')
  ),
  discipline_group text not null default 'other' check (
    discipline_group in ('humanities_social', 'science', 'natural_sciences', 'medicine', 'arts', 'engineering', 'other')
  ),
  introduction text,
  duration_text text,
  tuition_note text,
  admission_requirement text,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name_zh, education_stage)
);

create index if not exists schools_category_status_sort_idx
  on public.schools (category, is_published, sort_order, name_zh);
create index if not exists school_programs_school_sort_idx
  on public.school_programs (school_id, is_published, sort_order, name_zh);

drop trigger if exists set_schools_updated_at on public.schools;
create trigger set_schools_updated_at
before update on public.schools
for each row execute function public.set_student_planning_updated_at();

drop trigger if exists set_school_programs_updated_at on public.school_programs;
create trigger set_school_programs_updated_at
before update on public.school_programs
for each row execute function public.set_student_planning_updated_at();

-- 把现有韩国大学完整接入统一学校层，保留原表主键供目标、对比和评估继续使用。
insert into public.schools (
  category, source_korean_university_id, slug, name_zh, name_local, logo_url,
  ownership, province, city, summary, detailed_introduction,
  is_published, is_featured, sort_order
)
select
  'korean_university', id, '韩国大学-' || slug, name_zh, name_ko, logo_url,
  ownership, province, city, summary, coalesce(detailed_introduction, summary),
  is_published, is_featured, sort_order
from public.korean_universities
on conflict (source_korean_university_id) do update set
  name_zh = excluded.name_zh,
  name_local = excluded.name_local,
  logo_url = excluded.logo_url,
  ownership = excluded.ownership,
  province = excluded.province,
  city = excluded.city,
  summary = excluded.summary,
  detailed_introduction = coalesce(public.schools.detailed_introduction, excluded.detailed_introduction),
  is_published = excluded.is_published,
  is_featured = excluded.is_featured,
  sort_order = excluded.sort_order,
  updated_at = now();

-- 现有韩国大学专业同步到通用专业表，后续可以继续人工补充介绍。
insert into public.school_programs (
  school_id, source_korean_program_id, name_zh, name_local, education_stage,
  discipline_group, introduction, tuition_note, admission_requirement,
  is_published, sort_order
)
select
  schools.id,
  programs.id,
  programs.program_name_zh,
  programs.program_name_ko,
  programs.admission_stage,
  programs.discipline_group,
  programs.notes,
  case when programs.tuition_krw is null then null else programs.tuition_krw::text || ' 韩元／年（参考）' end,
  case when programs.topik_requirement is null then programs.application_term else '韩语能力考试 ' || programs.topik_requirement::text || ' 级；' || coalesce(programs.application_term, '以当年简章为准') end,
  programs.is_published,
  programs.sort_order
from public.korean_university_programs as programs
join public.schools on schools.source_korean_university_id = programs.university_id
on conflict (source_korean_program_id) do update set
  name_zh = excluded.name_zh,
  name_local = excluded.name_local,
  education_stage = excluded.education_stage,
  discipline_group = excluded.discipline_group,
  is_published = excluded.is_published,
  sort_order = excluded.sort_order,
  updated_at = now();

-- 韩国大学旧管理页发生修改时，自动刷新统一学校层的基础资料。
create or replace function public.sync_korean_university_to_school()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.schools (
    category, source_korean_university_id, slug, name_zh, name_local, logo_url,
    ownership, province, city, summary, detailed_introduction,
    is_published, is_featured, sort_order
  ) values (
    'korean_university', new.id, '韩国大学-' || new.slug, new.name_zh, new.name_ko, new.logo_url,
    new.ownership, new.province, new.city, new.summary, coalesce(new.detailed_introduction, new.summary),
    new.is_published, new.is_featured, new.sort_order
  )
  on conflict (source_korean_university_id) do update set
    name_zh = excluded.name_zh,
    name_local = excluded.name_local,
    logo_url = excluded.logo_url,
    ownership = excluded.ownership,
    province = excluded.province,
    city = excluded.city,
    summary = excluded.summary,
    detailed_introduction = coalesce(excluded.detailed_introduction, public.schools.detailed_introduction),
    is_published = excluded.is_published,
    is_featured = excluded.is_featured,
    sort_order = excluded.sort_order,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists sync_korean_university_to_school_trigger on public.korean_universities;
create trigger sync_korean_university_to_school_trigger
after insert or update on public.korean_universities
for each row execute function public.sync_korean_university_to_school();

-- 在数据库层统一判断学生功能，管理人员不受学生会员档位限制。
create or replace function public.student_feature_allowed(requested_feature text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when role in ('teacher', 'admin', 'ceo', 'super_admin') then true
      when status <> 'active' then false
      when requested_feature = 'message_services' then true
      when membership_tier in ('vip1', 'vip2', 'vip3')
        and requested_feature in ('university_target', 'application_documents', 'visa_tasks', 'course_preview') then true
      else false
    end
    from public.profiles
    where id = auth.uid()
  ), false);
$$;

grant execute on function public.student_feature_allowed(text) to authenticated;

-- 课时进度表历史策略名称不统一，使用触发器确保任何写入路径都遵守试听权限。
create or replace function public.enforce_student_lesson_progress_permission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role text;
  preview_enabled boolean;
begin
  select role into current_role from public.profiles where id = auth.uid();
  if current_role in ('teacher', 'admin', 'ceo', 'super_admin') then
    return new;
  end if;

  select is_free_preview into preview_enabled from public.lessons where id = new.lesson_id;
  if not public.student_feature_allowed('course_preview') or not coalesce(preview_enabled, false) then
    raise exception '当前账号没有此课时的学习记录权限';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_student_lesson_progress_permission_trigger on public.lesson_progress;
create trigger enforce_student_lesson_progress_permission_trigger
before insert or update on public.lesson_progress
for each row execute function public.enforce_student_lesson_progress_permission();

-- 重新收紧留学准备的写入策略：普通学生只读，VIP1 及以上可写。
drop policy if exists "university targets manage own" on public.student_university_targets;
create policy "eligible students manage own university targets"
on public.student_university_targets for all
to authenticated
using (auth.uid() = user_id and public.student_feature_allowed('university_target'))
with check (auth.uid() = user_id and public.student_feature_allowed('university_target'));

drop policy if exists "application documents manage own" on public.student_application_documents;
create policy "eligible students manage own application documents"
on public.student_application_documents for all
to authenticated
using (auth.uid() = user_id and public.student_feature_allowed('application_documents'))
with check (auth.uid() = user_id and public.student_feature_allowed('application_documents'));

drop policy if exists "visa tasks manage own" on public.student_visa_tasks;
create policy "eligible students manage own visa tasks"
on public.student_visa_tasks for all
to authenticated
using (auth.uid() = user_id and public.student_feature_allowed('visa_tasks'))
with check (auth.uid() = user_id and public.student_feature_allowed('visa_tasks'));

-- VIP1 明确不可加入学校对比；VIP2、VIP3 的额外权限也先保持关闭。
drop policy if exists "students manage own university comparisons" on public.student_university_comparisons;
create policy "eligible students manage own university comparisons"
on public.student_university_comparisons for all
to authenticated
using (auth.uid() = user_id and public.student_feature_allowed('university_comparison'))
with check (auth.uid() = user_id and public.student_feature_allowed('university_comparison'));

drop policy if exists "students manage own university assessments" on public.student_university_assessments;
create policy "eligible students create own university assessments"
on public.student_university_assessments for insert
to authenticated
with check (auth.uid() = user_id and public.student_feature_allowed('university_target'));

-- 学校与专业：登录用户读取已发布内容，管理员维护全部内容。
alter table public.schools enable row level security;
alter table public.school_programs enable row level security;

create policy "authenticated users read published schools"
on public.schools for select to authenticated
using (
  is_published = true
  or exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
);

create policy "admins manage schools"
on public.schools for all to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
);

create policy "authenticated users read published school programs"
on public.school_programs for select to authenticated
using (
  is_published = true
  and exists (
    select 1 from public.schools
    where schools.id = school_programs.school_id and schools.is_published = true
  )
);

create policy "admins manage school programs"
on public.school_programs for all to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
);

grant select, insert, update, delete on public.schools to authenticated;
grant select, insert, update, delete on public.school_programs to authenticated;

comment on column public.profiles.membership_tier is '学生会员档位：普通、VIP1、VIP2、VIP3';
comment on table public.schools is '管理中心统一学校主表，覆盖韩国大学、中国大学、高中、中专和技工院校';
comment on table public.school_programs is '学校专业、学制、学费与申请要求介绍';
comment on column public.korean_universities.logo_url is '学校校徽图片地址';
comment on column public.korean_universities.detailed_introduction is '面向学生的学校详细介绍';
