-- ============================================================
-- 老师写学习记录：放行 save/change 两个 RPC（仅限自己负责的学生）
--
-- 学习记录写入口只有这两个 security definer RPC，原权限只认
-- 负责人/被授权管理员。这里放宽为：管理员（原逻辑）或 老师，
-- 且老师只能给 tenant_student_assignments 中自己负责的学生
-- 写记录 / 改状态（改状态时先取笔记归属学生再校验）。
--
-- 表级 RLS / revoke 保持不动：RPC 为 security definer 绕过表策略，
-- 归属校验在 RPC 内完成，防止老师越权到其他学生。
-- ============================================================

begin;

create or replace function public.save_learning_record_note(p_id uuid, p_student_id uuid, p_record_type text, p_title text, p_content text, p_next_action text, p_visibility text, p_occurred_at timestamp with time zone)
returns uuid language plpgsql security definer set search_path = 'public'
as $$
declare v_id uuid;
begin
  if not (
    public.current_user_can_manage_learning_records()
    or (
      public.is_active_account()
      and public.current_profile_role() = 'teacher'
      and exists (
        select 1
        from public.tenant_student_assignments as assignment
        where assignment.tenant_id = private.current_tenant_id()
          and assignment.student_id = p_student_id
          and assignment.teacher_id = (select auth.uid())
      )
    )
  ) then raise exception '当前账号没有学习记录管理权限'; end if;
  if not exists (
    select 1 from public.tenant_memberships as membership
    where membership.user_id = p_student_id
      and membership.tenant_id = private.current_tenant_id()
      and membership.role = 'student'
      and membership.status = 'active'
  ) then raise exception '学生账号无效'; end if;
  if p_record_type not in ('coaching','evaluation','milestone','attention','plan') or p_visibility not in ('student_visible','internal') then raise exception '记录类型或可见范围不正确'; end if;
  if char_length(trim(coalesce(p_title,''))) not between 2 and 120 or char_length(trim(coalesce(p_content,''))) not between 2 and 5000 or char_length(coalesce(p_next_action,'')) > 2000 then raise exception '记录标题、内容或下一步建议长度不正确'; end if;
  if p_id is null then
    insert into public.learning_record_notes (student_id, record_type, title, content, next_action, visibility, occurred_at, created_by, updated_by)
    values (p_student_id, p_record_type, trim(p_title), trim(p_content), trim(coalesce(p_next_action,'')), p_visibility, coalesce(p_occurred_at, now()), auth.uid(), auth.uid()) returning id into v_id;
  else
    update public.learning_record_notes set record_type = p_record_type, title = trim(p_title), content = trim(p_content), next_action = trim(coalesce(p_next_action,'')), visibility = p_visibility, occurred_at = coalesce(p_occurred_at, occurred_at), updated_by = auth.uid(), updated_at = now()
    where id = p_id and student_id = p_student_id and tenant_id = private.current_tenant_id()
    returning id into v_id;
    if v_id is null then raise exception '学习记录不存在'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.change_learning_record_note_status(p_note_id uuid, p_status text)
returns void language plpgsql security definer set search_path = 'public'
as $$
declare v_student_id uuid;
begin
  select student_id into v_student_id
  from public.learning_record_notes
  where id = p_note_id and tenant_id = private.current_tenant_id();
  if v_student_id is null then raise exception '学习记录不存在'; end if;

  if not (
    public.current_user_can_manage_learning_records()
    or (
      public.is_active_account()
      and public.current_profile_role() = 'teacher'
      and exists (
        select 1
        from public.tenant_student_assignments as assignment
        where assignment.tenant_id = private.current_tenant_id()
          and assignment.student_id = v_student_id
          and assignment.teacher_id = (select auth.uid())
      )
    )
  ) then raise exception '当前账号没有学习记录管理权限'; end if;

  if p_status not in ('active','archived') then raise exception '学习记录状态不正确'; end if;
  update public.learning_record_notes set status = p_status, updated_by = auth.uid(), updated_at = now()
  where id = p_note_id and tenant_id = private.current_tenant_id();
  if not found then raise exception '学习记录不存在'; end if;
end;
$$;

commit;
