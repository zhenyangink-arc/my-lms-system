-- ============================================================
-- 会话练习：学习场景、学生练习记录与负责人授权
-- 后台管理范围：负责人、全部 CEO、负责人单独指定的管理员。
-- 学生只能读取已发布场景，并且只能更新自己的练习记录。
-- ============================================================

create table if not exists public.conversation_practice_admin_assignments (
  admin_id uuid primary key references public.profiles(id) on delete cascade,
  granted_by uuid not null references public.profiles(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz
);

create table if not exists public.conversation_practice_scenarios (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 100),
  description text not null default '' check (char_length(description) <= 500),
  category text not null default 'daily' check (
    category in ('daily', 'campus', 'travel', 'interview', 'workplace')
  ),
  difficulty text not null default 'beginner' check (
    difficulty in ('beginner', 'intermediate', 'advanced')
  ),
  situation text not null default '' check (char_length(situation) <= 1500),
  learning_objectives jsonb not null default '[]'::jsonb check (
    jsonb_typeof(learning_objectives) = 'array'
  ),
  sample_dialogue jsonb not null default '[]'::jsonb check (
    jsonb_typeof(sample_dialogue) = 'array'
  ),
  key_expressions jsonb not null default '[]'::jsonb check (
    jsonb_typeof(key_expressions) = 'array'
  ),
  starter_prompt text not null default '' check (char_length(starter_prompt) <= 1000),
  practice_tips text not null default '' check (char_length(practice_tips) <= 1500),
  duration_minutes integer not null default 10 check (duration_minutes between 1 and 120),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_featured boolean not null default false,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  published_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_practice_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  scenario_id uuid not null references public.conversation_practice_scenarios(id) on delete cascade,
  status text not null default 'practicing' check (status in ('practicing', 'completed')),
  practice_count integer not null default 1 check (practice_count between 1 and 100000),
  confidence integer check (confidence is null or confidence between 1 and 5),
  reflection text not null default '' check (char_length(reflection) <= 1200),
  first_practiced_at timestamptz not null default now(),
  last_practiced_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, scenario_id)
);

create index if not exists conversation_scenarios_catalog_idx
  on public.conversation_practice_scenarios (status, is_featured desc, sort_order, created_at desc);
create index if not exists conversation_progress_scenario_idx
  on public.conversation_practice_progress (scenario_id, status, last_practiced_at desc);
create index if not exists conversation_admin_assignments_active_idx
  on public.conversation_practice_admin_assignments (admin_id)
  where revoked_at is null;

create or replace function public.current_user_is_conversation_practice_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and coalesce(status, 'active') = 'active'
      and role = 'super_admin'
  );
$$;

create or replace function public.current_user_can_manage_conversation_practice()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles as viewer
    where viewer.id = auth.uid()
      and coalesce(viewer.status, 'active') = 'active'
      and (
        viewer.role in ('super_admin', 'ceo')
        or (
          viewer.role = 'admin'
          and exists (
            select 1
            from public.conversation_practice_admin_assignments as assignment
            where assignment.admin_id = viewer.id
              and assignment.revoked_at is null
          )
        )
      )
  );
$$;

create or replace function public.current_user_can_view_conversation_scenario(p_scenario_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_can_manage_conversation_practice()
    or exists (
      select 1
      from public.conversation_practice_scenarios as scenario
      join public.profiles as viewer on viewer.id = auth.uid()
      where scenario.id = p_scenario_id
        and scenario.status = 'published'
        and viewer.role = 'student'
        and coalesce(viewer.status, 'active') = 'active'
    );
$$;

create or replace function public.enforce_conversation_practice_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role text;
  target_status text;
begin
  if auth.uid() is null then
    return new;
  end if;

  if not public.current_user_is_conversation_practice_owner() then
    raise exception '只有负责人可以指定会话练习管理员';
  end if;

  select role, coalesce(status, 'active')
    into target_role, target_status
  from public.profiles
  where id = new.admin_id;

  if new.revoked_at is null
     and (target_role is distinct from 'admin' or target_status is distinct from 'active') then
    raise exception '只能授权状态正常的管理员账号';
  end if;

  if new.revoked_at is null then
    new.granted_by := auth.uid();
    new.granted_at := now();
    new.revoked_by := null;
  else
    new.revoked_by := auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_conversation_practice_assignment_trigger
  on public.conversation_practice_admin_assignments;
create trigger enforce_conversation_practice_assignment_trigger
before insert or update on public.conversation_practice_admin_assignments
for each row execute function public.enforce_conversation_practice_assignment();

create or replace function public.save_conversation_practice_scenario(
  p_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_difficulty text,
  p_situation text,
  p_learning_objectives jsonb,
  p_sample_dialogue jsonb,
  p_key_expressions jsonb,
  p_starter_prompt text,
  p_practice_tips text,
  p_duration_minutes integer,
  p_is_featured boolean,
  p_sort_order integer,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.current_user_can_manage_conversation_practice() then
    raise exception '当前账号没有会话练习管理权限';
  end if;

  if char_length(trim(coalesce(p_title, ''))) not between 2 and 100 then
    raise exception '场景标题需要填写 2 至 100 个字';
  end if;
  if char_length(coalesce(p_description, '')) > 500
     or char_length(coalesce(p_situation, '')) > 1500
     or char_length(coalesce(p_starter_prompt, '')) > 1000
     or char_length(coalesce(p_practice_tips, '')) > 1500 then
    raise exception '场景内容超过允许长度';
  end if;
  if p_category not in ('daily', 'campus', 'travel', 'interview', 'workplace')
     or p_difficulty not in ('beginner', 'intermediate', 'advanced')
     or p_status not in ('draft', 'published', 'archived') then
    raise exception '场景分类、难度或状态不正确';
  end if;
  if p_duration_minutes not between 1 and 120 or p_sort_order not between 0 and 100000 then
    raise exception '练习时长或排序值不正确';
  end if;
  if jsonb_typeof(coalesce(p_learning_objectives, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_sample_dialogue, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_key_expressions, '[]'::jsonb)) <> 'array' then
    raise exception '场景结构化内容格式不正确';
  end if;
  if jsonb_array_length(coalesce(p_learning_objectives, '[]'::jsonb)) > 20
     or jsonb_array_length(coalesce(p_sample_dialogue, '[]'::jsonb)) > 50
     or jsonb_array_length(coalesce(p_key_expressions, '[]'::jsonb)) > 30 then
    raise exception '学习内容条目过多';
  end if;

  if p_id is null then
    insert into public.conversation_practice_scenarios (
      title, description, category, difficulty, situation, learning_objectives,
      sample_dialogue, key_expressions, starter_prompt, practice_tips,
      duration_minutes, is_featured, sort_order, status, published_at,
      created_by, updated_by
    ) values (
      trim(p_title), coalesce(p_description, ''), p_category, p_difficulty,
      coalesce(p_situation, ''), coalesce(p_learning_objectives, '[]'::jsonb),
      coalesce(p_sample_dialogue, '[]'::jsonb), coalesce(p_key_expressions, '[]'::jsonb),
      coalesce(p_starter_prompt, ''), coalesce(p_practice_tips, ''),
      p_duration_minutes, coalesce(p_is_featured, false), p_sort_order, p_status,
      case when p_status = 'published' then now() else null end,
      auth.uid(), auth.uid()
    ) returning id into v_id;
  else
    update public.conversation_practice_scenarios
    set title = trim(p_title),
        description = coalesce(p_description, ''),
        category = p_category,
        difficulty = p_difficulty,
        situation = coalesce(p_situation, ''),
        learning_objectives = coalesce(p_learning_objectives, '[]'::jsonb),
        sample_dialogue = coalesce(p_sample_dialogue, '[]'::jsonb),
        key_expressions = coalesce(p_key_expressions, '[]'::jsonb),
        starter_prompt = coalesce(p_starter_prompt, ''),
        practice_tips = coalesce(p_practice_tips, ''),
        duration_minutes = p_duration_minutes,
        is_featured = coalesce(p_is_featured, false),
        sort_order = p_sort_order,
        status = p_status,
        published_at = case
          when p_status = 'published' and status <> 'published' then now()
          when p_status = 'draft' then null
          else published_at
        end,
        updated_by = auth.uid(),
        updated_at = now()
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception '会话场景不存在或已经被移除';
    end if;
  end if;

  return v_id;
end;
$$;

create or replace function public.change_conversation_practice_scenario_status(
  p_scenario_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_can_manage_conversation_practice() then
    raise exception '当前账号没有会话练习管理权限';
  end if;
  if p_status not in ('draft', 'published', 'archived') then
    raise exception '场景状态不正确';
  end if;

  update public.conversation_practice_scenarios
  set status = p_status,
      published_at = case
        when p_status = 'published' and status <> 'published' then now()
        when p_status = 'draft' then null
        else published_at
      end,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_scenario_id;

  if not found then
    raise exception '会话场景不存在';
  end if;
end;
$$;

create or replace function public.record_conversation_practice(
  p_scenario_id uuid,
  p_confidence integer,
  p_reflection text,
  p_completed boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'student'
      and coalesce(status, 'active') = 'active'
  ) then
    raise exception '只有正常状态的学生账号可以保存练习记录';
  end if;
  if not exists (
    select 1 from public.conversation_practice_scenarios
    where id = p_scenario_id and status = 'published'
  ) then
    raise exception '该会话场景尚未开放';
  end if;
  if p_confidence is not null and p_confidence not between 1 and 5 then
    raise exception '请填写 1 至 5 级的自信程度';
  end if;
  if char_length(coalesce(p_reflection, '')) > 1200 then
    raise exception '练习复盘不能超过 1200 个字';
  end if;

  insert into public.conversation_practice_progress (
    user_id, scenario_id, status, practice_count, confidence, reflection,
    first_practiced_at, last_practiced_at, completed_at
  ) values (
    auth.uid(), p_scenario_id,
    case when coalesce(p_completed, false) then 'completed' else 'practicing' end,
    1, p_confidence, coalesce(p_reflection, ''), now(), now(),
    case when coalesce(p_completed, false) then now() else null end
  )
  on conflict (user_id, scenario_id) do update
  set status = case when coalesce(p_completed, false) then 'completed' else conversation_practice_progress.status end,
      practice_count = conversation_practice_progress.practice_count + 1,
      confidence = p_confidence,
      reflection = coalesce(p_reflection, ''),
      last_practiced_at = now(),
      completed_at = case
        when coalesce(p_completed, false) then coalesce(conversation_practice_progress.completed_at, now())
        else conversation_practice_progress.completed_at
      end;
end;
$$;

alter table public.conversation_practice_admin_assignments enable row level security;
alter table public.conversation_practice_scenarios enable row level security;
alter table public.conversation_practice_progress enable row level security;

drop policy if exists "conversation assignments visible to owner or assignee"
  on public.conversation_practice_admin_assignments;
create policy "conversation assignments visible to owner or assignee"
on public.conversation_practice_admin_assignments for select to authenticated
using (public.current_user_is_conversation_practice_owner() or admin_id = auth.uid());

drop policy if exists "owner manages conversation assignments"
  on public.conversation_practice_admin_assignments;
create policy "owner manages conversation assignments"
on public.conversation_practice_admin_assignments for all to authenticated
using (public.current_user_is_conversation_practice_owner())
with check (public.current_user_is_conversation_practice_owner());

drop policy if exists "authorized users read conversation scenarios"
  on public.conversation_practice_scenarios;
create policy "authorized users read conversation scenarios"
on public.conversation_practice_scenarios for select to authenticated
using (public.current_user_can_view_conversation_scenario(id));

drop policy if exists "managers or owners read conversation progress"
  on public.conversation_practice_progress;
create policy "managers or owners read conversation progress"
on public.conversation_practice_progress for select to authenticated
using (public.current_user_can_manage_conversation_practice() or user_id = auth.uid());

grant select on public.conversation_practice_scenarios to authenticated;
grant select on public.conversation_practice_progress to authenticated;
grant select, insert, update on public.conversation_practice_admin_assignments to authenticated;

revoke insert, update, delete on public.conversation_practice_scenarios from authenticated;
revoke insert, update, delete on public.conversation_practice_progress from authenticated;
revoke delete on public.conversation_practice_admin_assignments from authenticated;

revoke all on function public.save_conversation_practice_scenario(uuid, text, text, text, text, text, jsonb, jsonb, jsonb, text, text, integer, boolean, integer, text) from public, anon;
revoke all on function public.change_conversation_practice_scenario_status(uuid, text) from public, anon;
revoke all on function public.record_conversation_practice(uuid, integer, text, boolean) from public, anon;

grant execute on function public.current_user_is_conversation_practice_owner() to authenticated;
grant execute on function public.current_user_can_manage_conversation_practice() to authenticated;
grant execute on function public.current_user_can_view_conversation_scenario(uuid) to authenticated;
grant execute on function public.save_conversation_practice_scenario(uuid, text, text, text, text, text, jsonb, jsonb, jsonb, text, text, integer, boolean, integer, text) to authenticated;
grant execute on function public.change_conversation_practice_scenario_status(uuid, text) to authenticated;
grant execute on function public.record_conversation_practice(uuid, integer, text, boolean) to authenticated;

comment on table public.conversation_practice_scenarios is '学生端会话练习场景与示范内容';
comment on table public.conversation_practice_progress is '学生对每个会话场景的练习次数、自评与复盘';
comment on table public.conversation_practice_admin_assignments is '负责人指定的会话练习普通管理员权限';
comment on function public.current_user_can_manage_conversation_practice() is '统一判断负责人、CEO 与获授权管理员的会话练习后台权限';
