-- 元智教育学生留学规划工作台
-- 只保存当前学生自己的目标院校、申请材料和签证任务。

create extension if not exists pgcrypto;

create table if not exists public.student_university_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  university_name text not null check (char_length(trim(university_name)) between 2 and 120),
  program_name text,
  degree_level text not null default 'language' check (
    degree_level in ('language', 'bachelor', 'master', 'doctor', 'exchange', 'other')
  ),
  priority smallint not null default 3 check (priority between 1 and 5),
  status text not null default 'researching' check (
    status in ('researching', 'preparing', 'applied', 'interview', 'offer', 'rejected', 'paused')
  ),
  application_deadline date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_application_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_key text not null,
  title text not null check (char_length(trim(title)) between 1 and 100),
  category text not null default 'application' check (
    category in ('identity', 'academic', 'application', 'financial', 'language', 'other')
  ),
  status text not null default 'not_started' check (
    status in ('not_started', 'preparing', 'uploaded', 'reviewing', 'approved', 'revision_required')
  ),
  storage_path text,
  due_date date,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, document_key)
);

create table if not exists public.student_visa_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_key text not null,
  title text not null check (char_length(trim(title)) between 1 and 100),
  description text,
  status text not null default 'pending' check (
    status in ('pending', 'in_progress', 'completed', 'blocked')
  ),
  due_date date,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, task_key)
);

create index if not exists student_university_targets_user_status_idx
  on public.student_university_targets (user_id, status, priority);

create index if not exists student_application_documents_user_status_idx
  on public.student_application_documents (user_id, status, sort_order);

create index if not exists student_visa_tasks_user_status_idx
  on public.student_visa_tasks (user_id, status, sort_order);

-- 所有更新都统一刷新 updated_at，方便页面判断最近变更。
create or replace function public.set_student_planning_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_student_university_targets_updated_at on public.student_university_targets;
create trigger set_student_university_targets_updated_at
before update on public.student_university_targets
for each row execute function public.set_student_planning_updated_at();

drop trigger if exists set_student_application_documents_updated_at on public.student_application_documents;
create trigger set_student_application_documents_updated_at
before update on public.student_application_documents
for each row execute function public.set_student_planning_updated_at();

drop trigger if exists set_student_visa_tasks_updated_at on public.student_visa_tasks;
create trigger set_student_visa_tasks_updated_at
before update on public.student_visa_tasks
for each row execute function public.set_student_planning_updated_at();

alter table public.student_university_targets enable row level security;
alter table public.student_application_documents enable row level security;
alter table public.student_visa_tasks enable row level security;

-- 学生只能操作自己的数据；管理角色可以在后续管理端中查看和辅导。
drop policy if exists "university targets read own or staff" on public.student_university_targets;
create policy "university targets read own or staff"
on public.student_university_targets for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('teacher', 'admin', 'ceo', 'super_admin')
  )
);

drop policy if exists "university targets manage own" on public.student_university_targets;
create policy "university targets manage own"
on public.student_university_targets for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "application documents read own or staff" on public.student_application_documents;
create policy "application documents read own or staff"
on public.student_application_documents for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('teacher', 'admin', 'ceo', 'super_admin')
  )
);

drop policy if exists "application documents manage own" on public.student_application_documents;
create policy "application documents manage own"
on public.student_application_documents for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "visa tasks read own or staff" on public.student_visa_tasks;
create policy "visa tasks read own or staff"
on public.student_visa_tasks for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('teacher', 'admin', 'ceo', 'super_admin')
  )
);

drop policy if exists "visa tasks manage own" on public.student_visa_tasks;
create policy "visa tasks manage own"
on public.student_visa_tasks for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update, delete on public.student_university_targets to authenticated;
grant select, insert, update, delete on public.student_application_documents to authenticated;
grant select, insert, update, delete on public.student_visa_tasks to authenticated;

comment on table public.student_university_targets is '学生目标大学与专业申请路线';
comment on table public.student_application_documents is '学生申请材料清单与审核状态';
comment on table public.student_visa_tasks is '学生签证准备任务与完成状态';
