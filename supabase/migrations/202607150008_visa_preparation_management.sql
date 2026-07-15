-- ============================================================
-- 签证准备与管理中心
-- 学生维护自己的签证档案和准备任务；管理员以上负责审核、退回和整体跟进。
-- ============================================================

-- 每名学生只有一份当前签证档案，用来保存签证类型和整体办理阶段。
create table if not exists public.student_visa_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  visa_type text not null default 'undecided' check (
    visa_type in ('undecided', 'd2_degree', 'd4_language', 'd10_job', 'other')
  ),
  case_status text not null default 'planning' check (
    case_status in ('planning', 'preparing', 'ready_to_submit', 'submitted', 'additional_documents', 'approved', 'issued', 'closed')
  ),
  target_entry_date date,
  application_city text,
  assigned_admin_id uuid references public.profiles(id) on delete set null,
  advisor_note text,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_visa_cases_status_updated_idx
  on public.student_visa_cases (case_status, updated_at desc);

drop trigger if exists set_student_visa_cases_updated_at on public.student_visa_cases;
create trigger set_student_visa_cases_updated_at
before update on public.student_visa_cases
for each row execute function public.set_student_planning_updated_at();

-- 旧签证任务扩展为可审核流程，原“已完成”安全迁移为“已确认”。
alter table public.student_visa_tasks
  add column if not exists stage text not null default 'application',
  add column if not exists student_note text,
  add column if not exists admin_note text,
  add column if not exists submission_version integer not null default 0,
  add column if not exists submitted_at timestamptz,
  add column if not exists review_started_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;

alter table public.student_visa_tasks
  drop constraint if exists student_visa_tasks_status_check;

update public.student_visa_tasks
set status = 'approved', reviewed_at = coalesce(reviewed_at, updated_at)
where status = 'completed';

alter table public.student_visa_tasks
  add constraint student_visa_tasks_status_check check (
    status in ('pending', 'in_progress', 'submitted', 'reviewing', 'approved', 'revision_required', 'blocked')
  );

alter table public.student_visa_tasks
  drop constraint if exists student_visa_tasks_stage_check;
alter table public.student_visa_tasks
  add constraint student_visa_tasks_stage_check check (
    stage in ('admission', 'identity', 'finance', 'application', 'appointment', 'submission', 'result', 'entry')
  );

alter table public.student_visa_tasks
  drop constraint if exists student_visa_tasks_submission_version_check;
alter table public.student_visa_tasks
  add constraint student_visa_tasks_submission_version_check check (submission_version >= 0);

-- 为历史任务补充正确阶段，不改动学生现有进度和内容。
update public.student_visa_tasks
set stage = case task_key
  when 'admission' then 'admission'
  when 'passport' then 'identity'
  when 'photo' then 'identity'
  when 'financial' then 'finance'
  when 'application' then 'application'
  when 'appointment' then 'appointment'
  when 'submission' then 'submission'
  when 'result' then 'result'
  when 'entry' then 'entry'
  else stage
end;

create index if not exists student_visa_tasks_review_queue_idx
  on public.student_visa_tasks (status, updated_at desc);

-- 已有签证任务的学生自动建立签证档案，避免升级后看不到历史数据。
insert into public.student_visa_cases (user_id)
select distinct user_id from public.student_visa_tasks
on conflict (user_id) do nothing;

-- 签证任务事件只记录状态变化，便于管理员回看提交与审核过程。
create table if not exists public.student_visa_task_events (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.student_visa_tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (
    event_type in ('created', 'status_updated', 'submitted', 'review_started', 'approved', 'revision_requested')
  ),
  from_status text,
  to_status text not null,
  submission_version integer not null default 0,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists student_visa_task_events_task_created_idx
  on public.student_visa_task_events (task_id, created_at desc);

-- 学生只能维护自己的准备信息；审核字段只允许管理员以上角色修改。
create or replace function public.enforce_student_visa_task_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role text;
begin
  if auth.uid() is null then
    return new;
  end if;

  select role into current_role from public.profiles where id = auth.uid();
  if current_role in ('admin', 'ceo', 'super_admin') then
    return new;
  end if;

  if new.user_id <> auth.uid() or not public.student_feature_allowed('visa_tasks') then
    raise exception '当前账号没有签证准备操作权限';
  end if;

  if tg_op = 'INSERT' then
    new.status := case when new.status in ('pending', 'in_progress') then new.status else 'pending' end;
    new.admin_note := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.review_started_at := null;
    new.submission_version := 0;
    return new;
  end if;

  -- 版本号和提交时间由触发器维护，学生端传入的伪造值会被覆盖。
  new.submission_version := old.submission_version;
  new.submitted_at := old.submitted_at;

  if (to_jsonb(new) - 'status' - 'student_note' - 'submitted_at' - 'submission_version' - 'updated_at')
     is distinct from
     (to_jsonb(old) - 'status' - 'student_note' - 'submitted_at' - 'submission_version' - 'updated_at') then
    raise exception '学生只能更新签证任务状态和个人备注';
  end if;

  if old.status in ('submitted', 'reviewing', 'approved') then
    raise exception '当前任务已经提交或确认，不能自行修改';
  end if;

  if new.status = old.status and old.status in ('pending', 'in_progress', 'blocked', 'revision_required') then
    return new;
  end if;

  if (old.status = 'pending' and new.status in ('in_progress', 'blocked'))
     or (old.status = 'in_progress' and new.status in ('pending', 'blocked'))
     or (old.status = 'blocked' and new.status = 'in_progress')
     or (old.status = 'revision_required' and new.status = 'in_progress') then
    return new;
  end if;

  if old.status in ('in_progress', 'revision_required') and new.status = 'submitted' then
    new.submission_version := old.submission_version + 1;
    new.submitted_at := now();
    new.review_started_at := null;
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.admin_note := null;
    return new;
  end if;

  raise exception '签证任务状态必须按准备流程更新';
end;
$$;

drop trigger if exists enforce_student_visa_task_workflow_trigger on public.student_visa_tasks;
create trigger enforce_student_visa_task_workflow_trigger
before insert or update on public.student_visa_tasks
for each row execute function public.enforce_student_visa_task_workflow();

-- 学生可编辑签证类型、入境日期和递签城市，整体阶段与顾问备注由管理员维护。
create or replace function public.enforce_student_visa_case_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role text;
begin
  if auth.uid() is null then
    return new;
  end if;

  select role into current_role from public.profiles where id = auth.uid();
  if current_role in ('admin', 'ceo', 'super_admin') then
    return new;
  end if;

  if new.user_id <> auth.uid() or not public.student_feature_allowed('visa_tasks') then
    raise exception '当前账号没有签证档案操作权限';
  end if;

  if tg_op = 'INSERT' then
    new.case_status := 'planning';
    new.assigned_admin_id := null;
    new.advisor_note := null;
    new.last_reviewed_at := null;
    return new;
  end if;

  if (to_jsonb(new) - 'visa_type' - 'target_entry_date' - 'application_city' - 'updated_at')
     is distinct from
     (to_jsonb(old) - 'visa_type' - 'target_entry_date' - 'application_city' - 'updated_at') then
    raise exception '学生只能更新自己的签证基础信息';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_student_visa_case_fields_trigger on public.student_visa_cases;
create trigger enforce_student_visa_case_fields_trigger
before insert or update on public.student_visa_cases
for each row execute function public.enforce_student_visa_case_fields();

create or replace function public.log_student_visa_task_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_name text;
begin
  if tg_op = 'INSERT' then
    event_name := 'created';
  elsif old.status is not distinct from new.status then
    return new;
  else
    event_name := case new.status
      when 'submitted' then 'submitted'
      when 'reviewing' then 'review_started'
      when 'approved' then 'approved'
      when 'revision_required' then 'revision_requested'
      else 'status_updated'
    end;
  end if;

  insert into public.student_visa_task_events (
    task_id, user_id, actor_id, event_type, from_status, to_status,
    submission_version, note
  ) values (
    new.id, new.user_id, auth.uid(), event_name,
    case when tg_op = 'INSERT' then null else old.status end,
    new.status, new.submission_version,
    case when new.status = 'revision_required' then new.admin_note else new.student_note end
  );
  return new;
end;
$$;

drop trigger if exists log_student_visa_task_event_trigger on public.student_visa_tasks;
create trigger log_student_visa_task_event_trigger
after insert or update of status on public.student_visa_tasks
for each row execute function public.log_student_visa_task_event();

-- 初始化函数一次性建立档案与标准任务，避免只创建一半的数据。
create or replace function public.initialize_student_visa_workspace()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_case_id uuid;
begin
  if auth.uid() is null or not public.student_feature_allowed('visa_tasks') then
    raise exception '当前账号没有签证准备操作权限';
  end if;

  insert into public.student_visa_cases (user_id)
  values (auth.uid())
  on conflict (user_id) do update set updated_at = public.student_visa_cases.updated_at
  returning id into created_case_id;

  insert into public.student_visa_tasks (user_id, task_key, title, description, stage, sort_order)
  values
    (auth.uid(), 'admission', '确认标准入学许可书', '核对学校、课程、入学时间和签发信息。', 'admission', 10),
    (auth.uid(), 'passport', '确认护照与身份信息', '确认护照有效期、姓名拼音和证件号码。', 'identity', 20),
    (auth.uid(), 'photo', '准备签证照片', '按递签要求准备近期白底证件照。', 'identity', 30),
    (auth.uid(), 'financial', '准备资金证明', '根据学校和领馆要求核对存款金额与冻结期限。', 'finance', 40),
    (auth.uid(), 'application', '填写签证申请表', '逐项核对姓名、护照号、联系方式和在韩地址。', 'application', 50),
    (auth.uid(), 'appointment', '确认预约与递签地点', '记录预约日期、受理机构、携带原件和复印件。', 'appointment', 60),
    (auth.uid(), 'submission', '完成递交并保存受理凭证', '递交后保存受理编号、回执和补件通知。', 'submission', 70),
    (auth.uid(), 'result', '查询签证结果', '关注审核进度，及时处理补充材料要求。', 'result', 80),
    (auth.uid(), 'entry', '确认获签与入境安排', '核对签证信息并安排入境、住宿和报到。', 'entry', 90)
  on conflict (user_id, task_key) do nothing;

  return created_case_id;
end;
$$;

-- 签证档案和任务仅本人可读；管理端只开放给管理员、CEO 和负责人。
alter table public.student_visa_cases enable row level security;
alter table public.student_visa_task_events enable row level security;

drop policy if exists "visa tasks read own or staff" on public.student_visa_tasks;
drop policy if exists "visa tasks read own or admins" on public.student_visa_tasks;
create policy "visa tasks read own or admins"
on public.student_visa_tasks for select to authenticated
using (
  auth.uid() = user_id or exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
);

drop policy if exists "admins manage visa tasks" on public.student_visa_tasks;
create policy "admins manage visa tasks"
on public.student_visa_tasks for all to authenticated
using (exists (
  select 1 from public.profiles
  where profiles.id = auth.uid()
    and profiles.status = 'active'
    and profiles.role in ('admin', 'ceo', 'super_admin')
))
with check (exists (
  select 1 from public.profiles
  where profiles.id = auth.uid()
    and profiles.status = 'active'
    and profiles.role in ('admin', 'ceo', 'super_admin')
));

create policy "visa cases read own or admins"
on public.student_visa_cases for select to authenticated
using (
  auth.uid() = user_id or exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
);

create policy "eligible students manage own visa case"
on public.student_visa_cases for all to authenticated
using (auth.uid() = user_id and public.student_feature_allowed('visa_tasks'))
with check (auth.uid() = user_id and public.student_feature_allowed('visa_tasks'));

create policy "admins manage visa cases"
on public.student_visa_cases for all to authenticated
using (exists (
  select 1 from public.profiles
  where profiles.id = auth.uid()
    and profiles.status = 'active'
    and profiles.role in ('admin', 'ceo', 'super_admin')
))
with check (exists (
  select 1 from public.profiles
  where profiles.id = auth.uid()
    and profiles.status = 'active'
    and profiles.role in ('admin', 'ceo', 'super_admin')
));

create policy "visa task events read own or admins"
on public.student_visa_task_events for select to authenticated
using (
  auth.uid() = user_id or exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
);

grant select, insert, update on public.student_visa_cases to authenticated;
grant select on public.student_visa_task_events to authenticated;
grant execute on function public.initialize_student_visa_workspace() to authenticated;
revoke insert, update, delete on public.student_visa_task_events from authenticated;

comment on table public.student_visa_cases is '学生签证类型、办理阶段、计划日期与负责管理员';
comment on table public.student_visa_task_events is '签证任务提交与审核状态变更记录';
comment on function public.initialize_student_visa_workspace() is '为当前学生建立签证档案和标准任务清单';
