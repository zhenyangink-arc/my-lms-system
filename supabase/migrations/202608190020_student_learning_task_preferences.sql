begin;

create table public.student_learning_task_preferences (
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants(id) on delete cascade,
  student_id uuid not null
    references public.profiles(id) on delete cascade,
  student_app_id uuid not null
    references public.student_apps(id) on delete restrict,
  task_key text not null check (char_length(task_key) between 3 and 500),
  snoozed_until timestamptz,
  dismissed_for_week date,
  updated_at timestamptz not null default now(),
  constraint student_learning_task_preferences_pkey
    primary key (tenant_id, student_id, student_app_id, task_key),
  constraint student_learning_task_preferences_one_mode_check check (
    (snoozed_until is not null)::integer
      + (dismissed_for_week is not null)::integer = 1
  ),
  constraint student_learning_task_preferences_week_starts_monday_check check (
    dismissed_for_week is null
    or extract(isodow from dismissed_for_week) = 1
  )
);

create index student_learning_task_preferences_active_idx
  on public.student_learning_task_preferences (
    tenant_id, student_id, student_app_id, snoozed_until, dismissed_for_week
  );

-- task_key 是 Packet 1 的 studentAppId:sourceType:sourceId。触发器把应用前缀
-- 与行作用域绑定，并在数据库边界拒绝所有作业、考试截止提醒和老师必做推荐。
-- 偏好表只保存展示控制，不读取或改写任何来源任务状态。
create or replace function private.validate_student_learning_task_preference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefix text;
  v_remainder text;
  v_source_type text;
  v_source_id text;
  v_source_uuid uuid;
  v_assignment_type text;
  v_recommendation_required boolean;
begin
  if tg_op = 'UPDATE' and (
    new.tenant_id is distinct from old.tenant_id
    or new.student_id is distinct from old.student_id
    or new.student_app_id is distinct from old.student_app_id
    or new.task_key is distinct from old.task_key
  ) then
    raise exception '暂缓记录的机构、学生、应用和任务标识不可改写';
  end if;

  v_prefix := new.student_app_id::text || ':';
  if left(new.task_key, char_length(v_prefix)) <> v_prefix then
    raise exception 'task_key 与 student_app_id 不匹配';
  end if;

  v_remainder := substr(new.task_key, char_length(v_prefix) + 1);
  v_source_type := split_part(v_remainder, ':', 1);
  v_source_id := substr(v_remainder, char_length(v_source_type) + 2);
  if v_source_type not in (
    'assignment', 'exam', 'course', 'chapter_practice',
    'specialized_practice', 'review', 'teacher_recommendation', 'student_plan'
  ) or v_source_id = '' then
    raise exception 'task_key 格式或来源类型无效';
  end if;

  if v_source_type in ('assignment', 'exam') then
    begin
      v_source_uuid := v_source_id::uuid;
    exception when invalid_text_representation then
      raise exception '作业或考试 task_key 的 sourceId 必须是 UUID';
    end;

    select assignment.assignment_type
    into v_assignment_type
    from public.learning_assignments as assignment
    where assignment.id = v_source_uuid
      and assignment.tenant_id = new.tenant_id
      and assignment.student_app_id = new.student_app_id
      and assignment.status = 'published'
      and (
        assignment.target_scope = 'all_students'
        or exists (
          select 1
          from public.learning_assignment_targets as target
          where target.assignment_id = assignment.id
            and target.student_id = new.student_id
        )
      );

    if v_assignment_type is null
      or (v_source_type = 'assignment' and v_assignment_type <> 'homework')
      or (v_source_type = 'exam' and v_assignment_type <> 'exam') then
      raise exception 'task_key 对应的学生作业或考试不存在';
    end if;

    raise exception using
      errcode = 'P0001',
      message = '必做任务不可暂缓：作业、考试和截止提醒必须始终显示';
  elsif v_source_type = 'teacher_recommendation' then
    begin
      v_source_uuid := v_source_id::uuid;
    exception when invalid_text_representation then
      raise exception '老师推荐 task_key 的 sourceId 必须是 UUID';
    end;

    select recommendation.is_required
    into v_recommendation_required
    from public.teacher_learning_recommendations as recommendation
    where recommendation.id = v_source_uuid
      and recommendation.tenant_id = new.tenant_id
      and recommendation.student_app_id = new.student_app_id
      and recommendation.status = 'active'
      and (
        (
          recommendation.target_scope = 'student'
          and recommendation.student_id = new.student_id
        )
        or (
          recommendation.target_scope = 'class'
          and exists (
            select 1
            from public.live_class_members as member
            where member.session_id = recommendation.class_id
              and member.student_id = new.student_id
          )
        )
      );

    if v_recommendation_required is null then
      raise exception 'task_key 对应的老师推荐不存在或未面向当前学生';
    end if;
    if v_recommendation_required then
      raise exception using
        errcode = 'P0001',
        message = '必做任务不可暂缓：老师必做推荐必须始终显示';
    end if;
  end if;

  return new;
end;
$$;

create trigger student_learning_task_preferences_validate
before insert or update on public.student_learning_task_preferences
for each row execute function private.validate_student_learning_task_preference();

drop trigger if exists student_learning_task_preferences_set_updated_at
  on public.student_learning_task_preferences;
create trigger student_learning_task_preferences_set_updated_at
before update on public.student_learning_task_preferences
for each row execute function private.set_updated_at();

alter table public.student_learning_task_preferences enable row level security;

create policy "students read own learning task preferences"
on public.student_learning_task_preferences for select to authenticated
using (
  private.current_student_has_app_access(
    tenant_id, student_id, student_app_id
  )
);

create policy "students insert own learning task preferences"
on public.student_learning_task_preferences for insert to authenticated
with check (
  private.current_student_has_app_access(
    tenant_id, student_id, student_app_id
  )
);

create policy "students update own learning task preferences"
on public.student_learning_task_preferences for update to authenticated
using (
  private.current_student_has_app_access(
    tenant_id, student_id, student_app_id
  )
)
with check (
  private.current_student_has_app_access(
    tenant_id, student_id, student_app_id
  )
);

create policy "students delete own learning task preferences"
on public.student_learning_task_preferences for delete to authenticated
using (
  private.current_student_has_app_access(
    tenant_id, student_id, student_app_id
  )
);

revoke all on public.student_learning_task_preferences
  from public, anon, authenticated;
grant select, insert, update, delete on public.student_learning_task_preferences
  to authenticated;
grant all on public.student_learning_task_preferences to service_role;

comment on table public.student_learning_task_preferences is
  '学生对非必做首页建议的临时展示偏好；不表示完成，也不改变任何来源业务状态';
comment on column public.student_learning_task_preferences.task_key is
  'Packet 1 统一标识 studentAppId:sourceType:sourceId；应用前缀由触发器复核';
comment on column public.student_learning_task_preferences.snoozed_until is
  '该时刻之前隐藏非必做建议；到期后聚合结果自动恢复显示';
comment on column public.student_learning_task_preferences.dismissed_for_week is
  'Asia/Seoul ISO 周的周一日期；仅在该周内隐藏非必做建议';

commit;
