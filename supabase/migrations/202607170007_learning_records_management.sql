-- ============================================================
-- 学习记录：自动学习事件之外的辅导记录、阶段评价、计划与权限
-- 后台：负责人、全部 CEO、负责人单独指定的管理员。
-- 学生只读本人、对学生可见且未归档的人工学习记录。
-- ============================================================

create table if not exists public.learning_record_admin_assignments (
  admin_id uuid primary key references public.profiles(id) on delete cascade,
  granted_by uuid not null references public.profiles(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz
);

create table if not exists public.learning_record_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  record_type text not null check (record_type in ('coaching', 'evaluation', 'milestone', 'attention', 'plan')),
  title text not null check (char_length(title) between 2 and 120),
  content text not null check (char_length(content) between 2 and 5000),
  next_action text not null default '' check (char_length(next_action) <= 2000),
  visibility text not null default 'student_visible' check (visibility in ('student_visible', 'internal')),
  status text not null default 'active' check (status in ('active', 'archived')),
  occurred_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists learning_record_notes_student_idx on public.learning_record_notes (student_id, occurred_at desc);
create index if not exists learning_record_notes_type_idx on public.learning_record_notes (record_type, status, occurred_at desc);
create index if not exists learning_record_admin_assignments_active_idx on public.learning_record_admin_assignments (admin_id) where revoked_at is null;

create or replace function public.current_user_is_learning_record_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and coalesce(status, 'active') = 'active' and role = 'super_admin');
$$;

create or replace function public.current_user_can_manage_learning_records()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles as viewer
    where viewer.id = auth.uid() and coalesce(viewer.status, 'active') = 'active'
      and (viewer.role in ('super_admin','ceo') or (viewer.role = 'admin' and exists (
        select 1 from public.learning_record_admin_assignments as assignment where assignment.admin_id = viewer.id and assignment.revoked_at is null
      )))
  );
$$;

create or replace function public.enforce_learning_record_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_role text; target_status text;
begin
  if auth.uid() is null then return new; end if;
  if not public.current_user_is_learning_record_owner() then raise exception '只有负责人可以指定学习记录管理员'; end if;
  select role, coalesce(status, 'active') into target_role, target_status from public.profiles where id = new.admin_id;
  if new.revoked_at is null and (target_role is distinct from 'admin' or target_status is distinct from 'active') then raise exception '只能授权状态正常的管理员账号'; end if;
  if new.revoked_at is null then new.granted_by := auth.uid(); new.granted_at := now(); new.revoked_by := null; else new.revoked_by := auth.uid(); end if;
  return new;
end;
$$;
drop trigger if exists enforce_learning_record_assignment_trigger on public.learning_record_admin_assignments;
create trigger enforce_learning_record_assignment_trigger before insert or update on public.learning_record_admin_assignments for each row execute function public.enforce_learning_record_assignment();

create or replace function public.list_learning_record_students()
returns table (id uuid, full_name text, email text, membership_tier text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.current_user_can_manage_learning_records() then raise exception '当前账号没有学习记录管理权限'; end if;
  return query select profile.id, profile.full_name, profile.email, profile.membership_tier from public.profiles as profile where profile.role = 'student' and coalesce(profile.status, 'active') = 'active' order by coalesce(profile.full_name, profile.email, profile.id::text);
end;
$$;

create or replace function public.save_learning_record_note(
  p_id uuid, p_student_id uuid, p_record_type text, p_title text, p_content text,
  p_next_action text, p_visibility text, p_occurred_at timestamptz
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.current_user_can_manage_learning_records() then raise exception '当前账号没有学习记录管理权限'; end if;
  if not exists (select 1 from public.profiles where id = p_student_id and role = 'student' and coalesce(status, 'active') = 'active') then raise exception '学生账号无效'; end if;
  if p_record_type not in ('coaching','evaluation','milestone','attention','plan') or p_visibility not in ('student_visible','internal') then raise exception '记录类型或可见范围不正确'; end if;
  if char_length(trim(coalesce(p_title,''))) not between 2 and 120 or char_length(trim(coalesce(p_content,''))) not between 2 and 5000 or char_length(coalesce(p_next_action,'')) > 2000 then raise exception '记录标题、内容或下一步建议长度不正确'; end if;
  if p_id is null then
    insert into public.learning_record_notes (student_id, record_type, title, content, next_action, visibility, occurred_at, created_by, updated_by)
    values (p_student_id, p_record_type, trim(p_title), trim(p_content), trim(coalesce(p_next_action,'')), p_visibility, coalesce(p_occurred_at, now()), auth.uid(), auth.uid()) returning id into v_id;
  else
    update public.learning_record_notes set record_type = p_record_type, title = trim(p_title), content = trim(p_content), next_action = trim(coalesce(p_next_action,'')), visibility = p_visibility, occurred_at = coalesce(p_occurred_at, occurred_at), updated_by = auth.uid(), updated_at = now() where id = p_id and student_id = p_student_id returning id into v_id;
    if v_id is null then raise exception '学习记录不存在'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.change_learning_record_note_status(p_note_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.current_user_can_manage_learning_records() then raise exception '当前账号没有学习记录管理权限'; end if;
  if p_status not in ('active','archived') then raise exception '学习记录状态不正确'; end if;
  update public.learning_record_notes set status = p_status, updated_by = auth.uid(), updated_at = now() where id = p_note_id;
  if not found then raise exception '学习记录不存在'; end if;
end;
$$;

alter table public.learning_record_admin_assignments enable row level security;
alter table public.learning_record_notes enable row level security;
create policy "learning record assignments visible to owner or assignee" on public.learning_record_admin_assignments for select to authenticated using (public.current_user_is_learning_record_owner() or admin_id = auth.uid());
create policy "owner manages learning record assignments" on public.learning_record_admin_assignments for all to authenticated using (public.current_user_is_learning_record_owner()) with check (public.current_user_is_learning_record_owner());
create policy "managers or students read learning record notes" on public.learning_record_notes for select to authenticated using (public.current_user_can_manage_learning_records() or (student_id = auth.uid() and visibility = 'student_visible' and status = 'active'));
grant select on public.learning_record_notes to authenticated;
grant select, insert, update on public.learning_record_admin_assignments to authenticated;
revoke insert, update, delete on public.learning_record_notes from authenticated;
revoke delete on public.learning_record_admin_assignments from authenticated;
revoke all on function public.list_learning_record_students(), public.save_learning_record_note(uuid,uuid,text,text,text,text,text,timestamptz), public.change_learning_record_note_status(uuid,text) from public, anon;
grant execute on function public.current_user_is_learning_record_owner(), public.current_user_can_manage_learning_records(), public.list_learning_record_students(), public.save_learning_record_note(uuid,uuid,text,text,text,text,text,timestamptz), public.change_learning_record_note_status(uuid,text) to authenticated;
comment on table public.learning_record_notes is '后台补充的辅导记录、阶段评价、里程碑、关注事项与学习计划';
