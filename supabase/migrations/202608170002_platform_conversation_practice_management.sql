-- Conversation-practice scenarios are platform-owned shared content.  The
-- TypeScript access gate permits mutations only for a tenantless platform
-- super-admin, but the original SQL lifecycle was still tenant-scoped.
-- Keep student progress tenant-scoped while allowing the shared scenario row
-- that it references to have no tenant binding.

alter table public.conversation_practice_scenarios
  alter column tenant_id drop not null;

alter table public.conversation_practice_progress
  drop constraint conversation_practice_progress_scenario_id_fkey;

alter table public.conversation_practice_progress
  add constraint conversation_practice_progress_scenario_id_fkey
  foreign key (scenario_id)
  references public.conversation_practice_scenarios(id)
  on delete cascade;

-- The generic tenant trigger rejects tenantless inserts.  This table now has
-- an explicit platform-scope trigger instead: authenticated callers cannot
-- bind new platform content to a tenant or move content between scopes.
drop trigger if exists conversation_practice_scenarios_tenant_scope
  on public.conversation_practice_scenarios;
drop trigger if exists conversation_practice_scenarios_platform_scope
  on public.conversation_practice_scenarios;

create or replace function private.enforce_conversation_practice_platform_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and new.tenant_id is distinct from old.tenant_id then
    raise exception '不能更改会话场景的平台归属';
  end if;

  if auth.uid() is not null
    and auth.role() <> 'service_role'
    and new.tenant_id is not null then
    raise exception '会话场景必须由平台统一创建，不能绑定机构';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_conversation_practice_platform_scope()
  from public;

create trigger conversation_practice_scenarios_platform_scope
before insert or update of tenant_id
on public.conversation_practice_scenarios
for each row execute function private.enforce_conversation_practice_platform_scope();

-- Match getConversationPracticeAccess().canManageContent exactly: only an
-- active platform_super_admin without a tenant context may mutate scenarios.
create or replace function public.current_user_can_manage_conversation_practice()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_account()
    and public.current_profile_role() = 'platform_super_admin'
    and private.current_tenant_id() is null;
$$;

comment on function public.current_user_can_manage_conversation_practice()
  is '仅允许无机构上下文的平台负责人新建、编辑或发布平台会话练习场景';

-- Shared scenarios are visible to the same browsing roles admitted by the
-- TypeScript gate.  Students see only published scenarios for an application
-- in which they have an active tenant enrollment.  The tenant comparison is
-- retained for legacy tenant-bound rows without rewriting existing data.
create or replace function public.current_user_can_view_conversation_scenario(
  p_scenario_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_practice_scenarios as scenario
    where scenario.id = p_scenario_id
      and (
        scenario.tenant_id is null
        or scenario.tenant_id = private.current_tenant_id()
      )
      and (
        public.current_user_can_manage_conversation_practice()
        or (
          public.is_active_account()
          and private.current_tenant_id() is not null
          and (
            public.current_profile_role() in (
              'tenant_super_admin', 'platform_super_admin', 'ceo', 'teacher'
            )
            or (
              public.current_profile_role() = 'admin'
              and private.current_user_has_explicit_permission(
                'conversation_practice.manage',
                private.current_tenant_id()
              )
            )
          )
        )
        or (
          scenario.status = 'published'
          and public.student_feature_allowed('conversation_course')
          and private.current_student_has_app_access(
            private.current_tenant_id(),
            (select auth.uid()),
            scenario.student_app_id
          )
        )
      )
  );
$$;

-- The existing action has no application parameter and the conversation
-- course route is the Korean application.  Supply that now-required app id
-- explicitly while writing a tenantless platform row.
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
set search_path = ''
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
  if p_duration_minutes not between 1 and 120
     or p_sort_order not between 0 and 100000 then
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
      tenant_id, student_app_id, title, description, category, difficulty,
      situation, learning_objectives, sample_dialogue, key_expressions,
      starter_prompt, practice_tips, duration_minutes, is_featured, sort_order,
      status, published_at, created_by, updated_by
    ) values (
      null, '10000000-0000-4000-8000-000000000001'::uuid,
      trim(p_title), coalesce(p_description, ''), p_category, p_difficulty,
      coalesce(p_situation, ''),
      coalesce(p_learning_objectives, '[]'::jsonb),
      coalesce(p_sample_dialogue, '[]'::jsonb),
      coalesce(p_key_expressions, '[]'::jsonb),
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
      and tenant_id is null
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
set search_path = ''
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
  where id = p_scenario_id
    and tenant_id is null;

  if not found then
    raise exception '会话场景不存在';
  end if;
end;
$$;

-- SECURITY DEFINER progress writes still pass through this trigger.  Resolve
-- the scenario application from either a platform row or a legacy row in the
-- student's tenant; all other fact-table branches retain their prior checks.
create or replace function private.validate_student_app_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_student_id uuid;
  v_app_id uuid;
begin
  if auth.uid() is null or auth.role() = 'service_role' then
    return new;
  end if;

  if tg_table_name = 'conversation_practice_progress' then
    v_tenant_id := coalesce(new.tenant_id, private.current_tenant_id());
    v_student_id := new.user_id;
    select scenario.student_app_id into v_app_id
    from public.conversation_practice_scenarios as scenario
    where scenario.id = new.scenario_id
      and (
        scenario.tenant_id is null
        or scenario.tenant_id = v_tenant_id
      );

  elsif tg_table_name = 'toolbox_practice_sessions' then
    v_tenant_id := coalesce(new.tenant_id, private.current_tenant_id());
    v_student_id := new.student_id;
    select exercise.student_app_id into v_app_id
    from public.growth_toolbox_exercises as exercise
    where exercise.id = new.exercise_id
      and (exercise.tenant_id is null or exercise.tenant_id = v_tenant_id);

  elsif tg_table_name = 'course_ebook_progress' then
    v_tenant_id := coalesce(new.tenant_id, private.current_tenant_id());
    v_student_id := new.student_id;
    select test.student_app_id into v_app_id
    from public.chapter_tests as test
    where test.slug = new.test_slug;

  elsif tg_table_name = 'chapter_test_attempts' then
    v_tenant_id := coalesce(new.tenant_id, private.current_tenant_id());
    v_student_id := new.student_id;
    select test.student_app_id into v_app_id
    from public.chapter_tests as test
    where test.id = new.test_id
      and test.slug = new.test_slug;

  elsif tg_table_name = 'lesson_progress' then
    v_tenant_id := coalesce(new.tenant_id, private.current_tenant_id());
    v_student_id := new.user_id;
    select course.student_app_id into v_app_id
    from public.courses as course
    where course.id = new.course_id
      and (course.tenant_id is null or course.tenant_id = v_tenant_id);

  elsif tg_table_name = 'learning_time_log' then
    v_tenant_id := coalesce(new.tenant_id, private.current_tenant_id());
    v_student_id := new.student_id;
    v_app_id := new.student_app_id;
  end if;

  if v_student_id is distinct from auth.uid() then
    return new;
  end if;
  if v_app_id is null then
    raise exception '学习内容不存在或缺少应用归属';
  end if;
  if not private.current_student_has_app_access(
    v_tenant_id,
    v_student_id,
    v_app_id
  ) then
    raise exception '当前学生没有该应用的有效访问权限';
  end if;

  return new;
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
set search_path = ''
as $$
declare
  v_tenant_id uuid := private.current_tenant_id();
begin
  if not (
    public.is_active_account()
    and public.current_profile_role() = 'student'
    and public.student_feature_allowed('conversation_course')
  ) then
    raise exception '当前会员档位没有会话课程权限';
  end if;
  if not exists (
    select 1
    from public.conversation_practice_scenarios as scenario
    where scenario.id = p_scenario_id
      and (
        scenario.tenant_id is null
        or scenario.tenant_id = v_tenant_id
      )
      and scenario.status = 'published'
      and private.current_student_has_app_access(
        v_tenant_id,
        (select auth.uid()),
        scenario.student_app_id
      )
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
    tenant_id, user_id, scenario_id, status, practice_count, confidence,
    reflection, first_practiced_at, last_practiced_at, completed_at
  ) values (
    v_tenant_id, auth.uid(), p_scenario_id,
    case when coalesce(p_completed, false) then 'completed' else 'practicing' end,
    1, p_confidence, coalesce(p_reflection, ''), now(), now(),
    case when coalesce(p_completed, false) then now() else null end
  )
  on conflict (user_id, scenario_id) do update
  set status = case
        when coalesce(p_completed, false) then 'completed'
        else public.conversation_practice_progress.status
      end,
      practice_count = public.conversation_practice_progress.practice_count + 1,
      confidence = p_confidence,
      reflection = coalesce(p_reflection, ''),
      last_practiced_at = now(),
      completed_at = case
        when coalesce(p_completed, false)
          then coalesce(public.conversation_practice_progress.completed_at, now())
        else public.conversation_practice_progress.completed_at
      end;
end;
$$;

-- The append-only learning activity trigger must resolve the application from
-- the same shared scenario while keeping the emitted activity event in the
-- student's tenant.
create or replace function private.capture_conversation_activity_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_app_id uuid;
  v_scenario_title text;
begin
  if tg_op = 'UPDATE' and new.practice_count <= old.practice_count then
    return new;
  end if;

  select scenario.student_app_id, scenario.title
  into v_student_app_id, v_scenario_title
  from public.conversation_practice_scenarios as scenario
  where scenario.id = new.scenario_id
    and (
      scenario.tenant_id is null
      or scenario.tenant_id = new.tenant_id
    );

  if v_student_app_id is null then
    raise exception '会话练习事件缺少有效的学生应用归属';
  end if;

  insert into public.student_learning_activity_events (
    tenant_id, student_id, student_app_id, category, event_type,
    source_kind, source_id, dedupe_key, occurred_at, metadata
  ) values (
    new.tenant_id,
    new.user_id,
    v_student_app_id,
    'practice',
    'conversation_practiced',
    'conversation_practice_progress',
    new.scenario_id::text,
    'conversation:' || new.scenario_id::text || ':' || new.practice_count::text,
    new.last_practiced_at,
    jsonb_build_object(
      'practice_count', new.practice_count,
      'status', new.status,
      'confidence', new.confidence,
      'title', v_scenario_title
    )
  )
  on conflict (tenant_id, student_id, student_app_id, dedupe_key) do nothing;
  return new;
end;
$$;

drop policy if exists "application users read conversation progress"
  on public.conversation_practice_progress;
create policy "application users read conversation progress"
on public.conversation_practice_progress for select to authenticated
using (
  exists (
    select 1
    from public.conversation_practice_scenarios as scenario
    where scenario.id = conversation_practice_progress.scenario_id
      and (
        scenario.tenant_id is null
        or scenario.tenant_id = conversation_practice_progress.tenant_id
      )
      and (
        public.current_user_can_manage_conversation_practice()
        or private.current_staff_has_app_capability(
          conversation_practice_progress.tenant_id,
          scenario.student_app_id,
          'view_analytics'
        )
        or private.current_teacher_has_student_app_access(
          conversation_practice_progress.tenant_id,
          conversation_practice_progress.user_id,
          scenario.student_app_id
        )
        or (
          conversation_practice_progress.user_id = (select auth.uid())
          and private.current_student_has_app_access(
            conversation_practice_progress.tenant_id,
            conversation_practice_progress.user_id,
            scenario.student_app_id
          )
        )
      )
  )
);
