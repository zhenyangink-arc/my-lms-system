-- ============================================================
-- 收紧公共课堂数据模型：
-- 1. mode 与 student_id 必须保持一致；
-- 2. live_class_members 只能引用 group 课堂。
--
-- 约束先以 NOT VALID 加入并单独验证，现有数据不做改写；如果历史数据
-- 不满足约束，迁移会明确失败，避免静默破坏或自动修正业务数据。
-- ============================================================

begin;

alter table public.live_class_sessions
  add constraint live_class_sessions_mode_student_consistency
  check (
    (mode = 'one_on_one' and student_id is not null)
    or (mode = 'group' and student_id is null)
  ) not valid;

alter table public.live_class_sessions
  validate constraint live_class_sessions_mode_student_consistency;

create or replace function public.validate_live_class_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_tenant uuid;
  v_session_mode text;
  v_student_role text;
begin
  select s.tenant_id, s.mode
  into v_session_tenant, v_session_mode
  from public.live_class_sessions as s
  where s.id = new.session_id;

  if v_session_tenant is null then
    raise exception '课堂不存在。';
  end if;

  if v_session_mode <> 'group' then
    raise exception '只有公共课堂可以写入成员表。';
  end if;

  select membership.role into v_student_role
  from public.tenant_memberships as membership
  where membership.tenant_id = v_session_tenant
    and membership.user_id = new.student_id;

  if v_student_role is null or v_student_role <> 'student' then
    raise exception '目标学生不在本机构或不是学生角色。';
  end if;

  return new;
end;
$$;

commit;
