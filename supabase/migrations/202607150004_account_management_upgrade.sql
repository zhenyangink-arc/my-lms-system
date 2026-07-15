-- ============================================================
-- 账号管理审计增强
-- 目标：补充会员档位和学生资料变更记录，让管理端时间线更完整。
-- 本迁移只调整审计逻辑，不删除任何账号、资料或历史记录。
-- ============================================================

-- 新增会员档位变更类型，旧审计类型继续保留。
alter table public.account_management_audit_logs
  drop constraint if exists account_management_audit_action_check;

alter table public.account_management_audit_logs
  add constraint account_management_audit_action_check
  check (action in (
    'account_created',
    'role_changed',
    'status_changed',
    'membership_changed',
    'profile_updated'
  ));

-- 重建账号资料审计函数，覆盖角色、状态、会员档位和学生资料字段。
create or replace function public.audit_profile_management_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  audit_action text;
  fields text[] := '{}';
begin
  if tg_op = 'INSERT' then
    audit_action := 'account_created';
    fields := array['created_at'];
  else
    if old.role is distinct from new.role then
      fields := array_append(fields, 'role');
    end if;

    if old.status is distinct from new.status then
      fields := array_append(fields, 'status');
    end if;

    if old.membership_tier is distinct from new.membership_tier then
      fields := array_append(fields, 'membership_tier');
    end if;

    if old.full_name is distinct from new.full_name then fields := array_append(fields, 'full_name'); end if;
    if old.email is distinct from new.email then fields := array_append(fields, 'email'); end if;
    if old.gender is distinct from new.gender then fields := array_append(fields, 'gender'); end if;
    if old.birth_date is distinct from new.birth_date then fields := array_append(fields, 'birth_date'); end if;
    if old.avatar_path is distinct from new.avatar_path then fields := array_append(fields, 'avatar_path'); end if;
    if old.address_province is distinct from new.address_province then fields := array_append(fields, 'address_province'); end if;
    if old.address_city is distinct from new.address_city then fields := array_append(fields, 'address_city'); end if;
    if old.education_level is distinct from new.education_level then fields := array_append(fields, 'education_level'); end if;
    if old.education_status is distinct from new.education_status then fields := array_append(fields, 'education_status'); end if;
    if old.education_completion_month is distinct from new.education_completion_month then fields := array_append(fields, 'education_completion_month'); end if;
    if old.academic_average is distinct from new.academic_average then fields := array_append(fields, 'academic_average'); end if;
    if old.gaokao_has_score is distinct from new.gaokao_has_score then fields := array_append(fields, 'gaokao_has_score'); end if;
    if old.gaokao_score is distinct from new.gaokao_score then fields := array_append(fields, 'gaokao_score'); end if;
    if old.english_level is distinct from new.english_level then fields := array_append(fields, 'english_level'); end if;
    if old.math_level is distinct from new.math_level then fields := array_append(fields, 'math_level'); end if;
    if old.has_korean is distinct from new.has_korean then fields := array_append(fields, 'has_korean'); end if;
    if old.topik_level is distinct from new.topik_level then fields := array_append(fields, 'topik_level'); end if;
    if old.has_work_experience is distinct from new.has_work_experience then fields := array_append(fields, 'has_work_experience'); end if;

    if coalesce(array_length(fields, 1), 0) = 0 then
      return new;
    end if;

    if 'role' = any(fields) then
      audit_action := 'role_changed';
    elsif 'status' = any(fields) then
      audit_action := 'status_changed';
    elsif 'membership_tier' = any(fields) then
      audit_action := 'membership_changed';
    else
      audit_action := 'profile_updated';
    end if;
  end if;

  insert into public.account_management_audit_logs (
    actor_id,
    target_user_id,
    action,
    changed_fields,
    before_data,
    after_data
  )
  values (
    auth.uid(),
    new.id,
    audit_action,
    fields,
    case when tg_op = 'INSERT' then null else jsonb_build_object(
      'full_name', old.full_name,
      'email', old.email,
      'role', old.role,
      'status', old.status,
      'membership_tier', old.membership_tier
    ) end,
    jsonb_build_object(
      'full_name', new.full_name,
      'email', new.email,
      'role', new.role,
      'status', new.status,
      'membership_tier', new.membership_tier
    )
  );

  return new;
end;
$$;

comment on function public.audit_profile_management_change() is
  '自动记录账号角色、状态、会员档位和学生资料的重要变更';
