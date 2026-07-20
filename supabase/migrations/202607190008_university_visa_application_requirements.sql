-- ============================================================
-- 每所韩国大学按签证类型维护签证申请资料，并同步到学生签证任务。
-- ============================================================

create table if not exists public.university_visa_application_requirements (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.korean_universities(id) on delete cascade,
  visa_type text not null check (
    visa_type in ('d4_language', 'd2_bachelor', 'd2_master', 'd2_doctor')
  ),
  requirement_key text not null,
  stage text not null check (
    stage in ('admission', 'identity', 'finance', 'application', 'appointment', 'submission', 'result', 'entry')
  ),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  description text check (description is null or char_length(description) <= 300),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (university_id, visa_type, requirement_key)
);

create unique index if not exists university_visa_requirements_title_idx
  on public.university_visa_application_requirements (
    university_id,
    visa_type,
    stage,
    lower(btrim(title))
  );

create index if not exists university_visa_requirements_active_idx
  on public.university_visa_application_requirements (
    university_id,
    visa_type,
    is_active,
    stage,
    sort_order
  );

drop trigger if exists set_university_visa_requirements_updated_at
  on public.university_visa_application_requirements;
create trigger set_university_visa_requirements_updated_at
before update on public.university_visa_application_requirements
for each row execute function public.set_student_planning_updated_at();

alter table public.university_visa_application_requirements enable row level security;

drop policy if exists "admins manage university visa requirements"
  on public.university_visa_application_requirements;
create policy "admins manage university visa requirements"
on public.university_visa_application_requirements for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
);

grant select, insert, update on public.university_visa_application_requirements
  to authenticated;

alter table public.student_visa_tasks
  add column if not exists requirement_id uuid,
  add column if not exists is_archived boolean not null default false;

alter table public.student_visa_tasks
  drop constraint if exists student_visa_tasks_requirement_id_fkey;
alter table public.student_visa_tasks
  add constraint student_visa_tasks_requirement_id_fkey
  foreign key (requirement_id)
  references public.university_visa_application_requirements(id)
  on delete set null;

create index if not exists student_visa_tasks_requirement_idx
  on public.student_visa_tasks (requirement_id, is_archived);

-- 先为每所大学和每种签证建立当前九项标准模板，升级后学生清单保持不变。
insert into public.university_visa_application_requirements (
  university_id,
  visa_type,
  requirement_key,
  stage,
  title,
  description,
  sort_order
)
select
  university.id,
  visa.visa_type,
  template.requirement_key,
  template.stage,
  template.title,
  template.description,
  template.sort_order
from public.korean_universities as university
cross join (
  values
    ('d4_language'),
    ('d2_bachelor'),
    ('d2_master'),
    ('d2_doctor')
) as visa(visa_type)
cross join (
  values
    ('admission', 'admission', '确认标准入学许可书', '核对学校、课程、入学时间和签发信息。', 10),
    ('passport', 'identity', '确认护照与身份信息', '确认护照有效期、姓名拼音和证件号码。', 20),
    ('photo', 'identity', '准备签证照片', '按递签要求准备近期白底证件照。', 30),
    ('financial', 'finance', '准备资金证明', '根据学校和领馆要求核对存款金额与冻结期限。', 40),
    ('application', 'application', '填写签证申请表', '逐项核对姓名、护照号、联系方式和在韩地址。', 50),
    ('appointment', 'appointment', '确认预约与递签地点', '记录预约日期、受理机构、携带原件和复印件。', 60),
    ('submission', 'submission', '完成递交并保存受理凭证', '递交后保存受理编号、回执和补件通知。', 70),
    ('result', 'result', '查询签证结果', '关注审核进度，及时处理补充材料要求。', 80),
    ('entry', 'entry', '确认获签与入境安排', '核对签证信息并安排入境、住宿和报到。', 90)
) as template(requirement_key, stage, title, description, sort_order)
on conflict (university_id, visa_type, requirement_key) do nothing;

-- 把既有标准签证任务关联到其来源大学的模板。
update public.student_visa_tasks as task
set requirement_id = requirement.id,
    is_archived = false
from public.student_visa_cases as visa_case
join public.student_university_targets as target
  on target.id = visa_case.source_target_id
join public.university_visa_application_requirements as requirement
  on requirement.university_id = target.university_id
 and requirement.visa_type = visa_case.visa_type
where task.user_id = visa_case.user_id
  and task.task_key = requirement.requirement_key
  and task.requirement_id is null;

create or replace function public.initialize_student_visa_requirements(
  requested_user_id uuid,
  requested_target_id uuid,
  requested_visa_type text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_university_id uuid;
begin
  select target.university_id
  into source_university_id
  from public.student_university_targets as target
  where target.id = requested_target_id
    and target.user_id = requested_user_id;

  if source_university_id is null then
    return;
  end if;

  insert into public.student_visa_tasks (
    user_id,
    task_key,
    requirement_id,
    title,
    description,
    stage,
    sort_order,
    is_archived
  )
  select
    requested_user_id,
    requirement.requirement_key,
    requirement.id,
    requirement.title,
    requirement.description,
    requirement.stage,
    requirement.sort_order,
    false
  from public.university_visa_application_requirements as requirement
  where requirement.university_id = source_university_id
    and requirement.visa_type = requested_visa_type
    and requirement.is_active = true
  on conflict (user_id, task_key)
  do update set
    requirement_id = excluded.requirement_id,
    title = excluded.title,
    description = excluded.description,
    stage = excluded.stage,
    sort_order = excluded.sort_order,
    is_archived = false;
end;
$$;

-- 内部函数只建立签证档案；具体任务改由来源大学的模板生成。
create or replace function public.initialize_student_visa_workspace_for_user(
  requested_user_id uuid,
  requested_visa_type text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_case_id uuid;
  resolved_visa_type text;
begin
  if requested_user_id is null then
    raise exception '缺少学生账号';
  end if;

  resolved_visa_type := case
    when requested_visa_type in ('d4_language', 'd2_bachelor', 'd2_master', 'd2_doctor')
      then requested_visa_type
    else 'd4_language'
  end;

  insert into public.student_visa_cases (user_id, visa_type)
  values (requested_user_id, resolved_visa_type)
  on conflict (user_id) do nothing;

  select id into created_case_id
  from public.student_visa_cases
  where user_id = requested_user_id;

  return created_case_id;
end;
$$;

create or replace function public.initialize_student_visa_workspace()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_case_id uuid;
  resolved_visa_type text;
  actual_visa_type text;
  resolved_target_id uuid;
begin
  if auth.uid() is null or not public.student_feature_allowed('visa_tasks') then
    raise exception '当前账号没有签证准备操作权限';
  end if;

  select
    target.id,
    case
      when target.admission_track = 'language' or target.degree_level = 'language' then 'd4_language'
      when target.admission_track in ('bachelor_fresh', 'bachelor_transfer') or target.degree_level = 'bachelor' then 'd2_bachelor'
      when target.admission_track = 'master' or target.degree_level = 'master' then 'd2_master'
      when target.admission_track = 'doctor' or target.degree_level = 'doctor' then 'd2_doctor'
      else 'd4_language'
    end
  into resolved_target_id, resolved_visa_type
  from public.student_university_targets as target
  where target.user_id = auth.uid()
    and target.application_stage >= 9
  order by target.application_stage desc, target.priority desc, target.updated_at desc
  limit 1;

  if not found then
    raise exception '申请进度到达第九步后才会建立签证准备路线';
  end if;

  created_case_id := public.initialize_student_visa_workspace_for_user(auth.uid(), resolved_visa_type);

  update public.student_visa_cases
  set source_target_id = resolved_target_id
  where id = created_case_id
    and source_target_id is distinct from resolved_target_id;

  select visa_type into actual_visa_type
  from public.student_visa_cases
  where id = created_case_id;

  perform public.initialize_student_visa_requirements(
    auth.uid(),
    resolved_target_id,
    actual_visa_type
  );

  return created_case_id;
end;
$$;

create or replace function public.initialize_visa_workspace_from_application_stage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_case_id uuid;
  resolved_visa_type text;
  actual_visa_type text;
begin
  resolved_visa_type := case
    when new.admission_track = 'language' or new.degree_level = 'language' then 'd4_language'
    when new.admission_track in ('bachelor_fresh', 'bachelor_transfer') or new.degree_level = 'bachelor' then 'd2_bachelor'
    when new.admission_track = 'master' or new.degree_level = 'master' then 'd2_master'
    when new.admission_track = 'doctor' or new.degree_level = 'doctor' then 'd2_doctor'
    else 'd4_language'
  end;

  created_case_id := public.initialize_student_visa_workspace_for_user(new.user_id, resolved_visa_type);

  update public.student_visa_cases
  set source_target_id = new.id
  where id = created_case_id
    and source_target_id is distinct from new.id;

  select visa_type into actual_visa_type
  from public.student_visa_cases
  where id = created_case_id;

  perform public.initialize_student_visa_requirements(
    new.user_id,
    new.id,
    actual_visa_type
  );

  return new;
end;
$$;

-- 模板变化时同步该校、该签证类型下的现有学生任务。
create or replace function public.sync_university_visa_application_requirement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and old.is_active
     and (
       old.university_id is distinct from new.university_id
       or old.visa_type is distinct from new.visa_type
     ) then
    delete from public.student_visa_tasks
    where requirement_id = old.id
      and submission_version = 0
      and status in ('pending', 'in_progress', 'blocked');

    update public.student_visa_tasks
    set is_archived = true
    where requirement_id = old.id
      and is_archived = false;
  end if;

  if new.is_active then
    insert into public.student_visa_tasks (
      user_id,
      task_key,
      requirement_id,
      title,
      description,
      stage,
      sort_order,
      is_archived
    )
    select
      visa_case.user_id,
      new.requirement_key,
      new.id,
      new.title,
      new.description,
      new.stage,
      new.sort_order,
      false
    from public.student_visa_cases as visa_case
    join public.student_university_targets as target
      on target.id = visa_case.source_target_id
    where target.university_id = new.university_id
      and visa_case.visa_type = new.visa_type
    on conflict (user_id, task_key)
    do update set
      requirement_id = excluded.requirement_id,
      title = excluded.title,
      description = excluded.description,
      stage = excluded.stage,
      sort_order = excluded.sort_order,
      is_archived = false;
  else
    delete from public.student_visa_tasks
    where requirement_id = new.id
      and submission_version = 0
      and status in ('pending', 'in_progress', 'blocked');

    update public.student_visa_tasks
    set is_archived = true
    where requirement_id = new.id
      and is_archived = false;
  end if;

  return new;
end;
$$;

-- 管理员切换来源学校或签证类型时，自动切换到对应模板。
create or replace function public.sync_student_visa_requirements_from_case()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.source_target_id is distinct from new.source_target_id
     or old.visa_type is distinct from new.visa_type then
    delete from public.student_visa_tasks as task
    using public.university_visa_application_requirements as requirement
    where task.user_id = new.user_id
      and task.requirement_id = requirement.id
      and (
        requirement.visa_type is distinct from new.visa_type
        or not exists (
          select 1
          from public.student_university_targets as target
          where target.id = new.source_target_id
            and target.university_id = requirement.university_id
        )
      )
      and task.submission_version = 0
      and task.status in ('pending', 'in_progress', 'blocked');

    update public.student_visa_tasks as task
    set is_archived = true
    from public.university_visa_application_requirements as requirement
    where task.user_id = new.user_id
      and task.requirement_id = requirement.id
      and task.is_archived = false
      and (
        requirement.visa_type is distinct from new.visa_type
        or not exists (
          select 1
          from public.student_university_targets as target
          where target.id = new.source_target_id
            and target.university_id = requirement.university_id
        )
      );
  end if;

  if new.source_target_id is not null then
    perform public.initialize_student_visa_requirements(
      new.user_id,
      new.source_target_id,
      new.visa_type
    );
  end if;

  return new;
end;
$$;

drop trigger if exists sync_university_visa_requirement
  on public.university_visa_application_requirements;
create trigger sync_university_visa_requirement
after insert or update of university_id, visa_type, stage, title, description, sort_order, is_active
on public.university_visa_application_requirements
for each row execute function public.sync_university_visa_application_requirement();

drop trigger if exists sync_student_visa_requirements_from_case
  on public.student_visa_cases;
create trigger sync_student_visa_requirements_from_case
after update of source_target_id, visa_type
on public.student_visa_cases
for each row execute function public.sync_student_visa_requirements_from_case();

-- 为已有签证档案补齐当前大学模板中的新增项目。
do $$
declare
  existing_case record;
begin
  for existing_case in
    select user_id, source_target_id, visa_type
    from public.student_visa_cases
    where source_target_id is not null
  loop
    perform public.initialize_student_visa_requirements(
      existing_case.user_id,
      existing_case.source_target_id,
      existing_case.visa_type
    );
  end loop;
end;
$$;

drop policy if exists "visa tasks read own or admins" on public.student_visa_tasks;
create policy "visa tasks read own or admins"
on public.student_visa_tasks for select to authenticated
using (
  (auth.uid() = user_id and is_archived = false)
  or exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
);

revoke all on function public.initialize_student_visa_requirements(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.sync_university_visa_application_requirement()
  from public, anon, authenticated;
revoke all on function public.sync_student_visa_requirements_from_case()
  from public, anon, authenticated;

grant execute on function public.initialize_student_visa_workspace()
  to authenticated;

comment on table public.university_visa_application_requirements is
  '每所韩国大学按签证类型维护的签证申请资料模板';
comment on column public.student_visa_tasks.requirement_id is
  '生成该学生签证任务的大学签证资料模板';
comment on column public.student_visa_tasks.is_archived is
  '大学不再要求该签证资料时隐藏；已有提交历史继续保留';
comment on function public.initialize_student_visa_workspace_for_user(uuid, text) is
  '内部使用：为指定学生幂等建立签证档案，签证任务由来源大学模板生成';

notify pgrst, 'reload schema';
