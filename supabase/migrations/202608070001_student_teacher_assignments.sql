-- ============================================================
-- 学生管理：学生-负责老师分配（一对多）
--
-- 机构负责人或被授予 student_assignments.manage 权限的管理员，
-- 在后台把学生划给负责老师；一个学生可以同时被多位老师负责。
--
-- 写操作全部由服务端 Server Action（管理员客户端）执行；
-- RLS 作为纵深防御，同时为「老师查看自己负责的学生」预留读策略。
-- ============================================================

begin;

create table public.tenant_student_assignments (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint tenant_student_assignments_unique_pair unique (tenant_id, student_id, teacher_id),
  constraint tenant_student_assignments_student_not_teacher check (student_id <> teacher_id)
);

comment on table public.tenant_student_assignments is '学生-负责老师分配（一对多）：一个学生可被多位老师负责。';
comment on column public.tenant_student_assignments.student_id is '学生账号，须为本机构 tenant_memberships 中 role = student 的成员';
comment on column public.tenant_student_assignments.teacher_id is '负责老师，须为本机构 tenant_memberships 中 role = teacher 的成员';

create index tenant_student_assignments_tenant_teacher_idx
  on public.tenant_student_assignments (tenant_id, teacher_id, student_id);

create index tenant_student_assignments_student_idx
  on public.tenant_student_assignments (student_id);

-- 校验：学生与老师都必须属于同一机构，且角色分别为 student / teacher，
-- 防止跨机构分配或把学生划给非老师账号。
create or replace function public.validate_student_teacher_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_role text;
  v_teacher_role text;
begin
  select membership.role into v_student_role
  from public.tenant_memberships as membership
  where membership.tenant_id = new.tenant_id
    and membership.user_id = new.student_id;

  select membership.role into v_teacher_role
  from public.tenant_memberships as membership
  where membership.tenant_id = new.tenant_id
    and membership.user_id = new.teacher_id;

  if v_student_role is null or v_student_role <> 'student' then
    raise exception '目标学生不在本机构或不是学生角色。';
  end if;

  if v_teacher_role is null or v_teacher_role <> 'teacher' then
    raise exception '目标老师不在本机构或不是老师角色。';
  end if;

  return new;
end;
$$;

create trigger tenant_student_assignments_validate_trigger
before insert or update on public.tenant_student_assignments
for each row execute function public.validate_student_teacher_assignment();

alter table public.tenant_student_assignments enable row level security;

-- 机构负责人管理本机构的学生分配（写操作）
create policy "tenant owner manages student assignments"
on public.tenant_student_assignments for all to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select public.is_owner_account())
)
with check (
  tenant_id = (select private.current_tenant_id())
  and (select public.is_owner_account())
);

-- 老师可读取自己负责的学生（为老师端"我的学生"预留）
create policy "teachers read own assigned students"
on public.tenant_student_assignments for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and teacher_id = (select auth.uid())
);

commit;
