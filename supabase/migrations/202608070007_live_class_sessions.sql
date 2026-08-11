-- ============================================================
-- 实时伴学课堂：老师进入学生上课界面，实时讲课 + 画笔圈点 + 文字批注
--
-- 会话本身落库（用于学生端发现"老师正在给我上课"、老师端管理）；
-- 课堂内的实时事件（翻页 / 画笔笔画 / 批注）走 Supabase Realtime
-- Broadcast 频道 live-class:{session_id}，不落库。
-- ============================================================

begin;

create table public.live_class_sessions (
  id uuid not null default gen_random_uuid() primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  chapter_slug text not null,
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_by uuid references auth.users(id) on delete set null
);

comment on table public.live_class_sessions is '实时伴学课堂会话：老师与学生围绕某个课时的一章电子书实时互动';
comment on column public.live_class_sessions.chapter_slug is '教材章节 slug（如韩文字母入门的 meet-hangul 等）';

create index live_class_sessions_teacher_active_idx
  on public.live_class_sessions (teacher_id, status, created_at desc);
create index live_class_sessions_student_active_idx
  on public.live_class_sessions (student_id, status, created_at desc);
create index live_class_sessions_lesson_idx
  on public.live_class_sessions (lesson_id, status);

-- 校验：老师与学生必须都属于同一机构，且老师确实负责该学生
create or replace function public.validate_live_class_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher_role text;
  v_student_role text;
  v_is_assigned boolean;
begin
  select membership.role into v_teacher_role
  from public.tenant_memberships as membership
  where membership.tenant_id = new.tenant_id
    and membership.user_id = new.teacher_id;

  select membership.role into v_student_role
  from public.tenant_memberships as membership
  where membership.tenant_id = new.tenant_id
    and membership.user_id = new.student_id;

  if v_teacher_role is null or v_teacher_role <> 'teacher' then
    raise exception '发起老师不在本机构或不是老师角色。';
  end if;

  if v_student_role is null or v_student_role <> 'student' then
    raise exception '目标学生不在本机构或不是学生角色。';
  end if;

  select exists (
    select 1 from public.tenant_student_assignments as assignment
    where assignment.tenant_id = new.tenant_id
      and assignment.teacher_id = new.teacher_id
      and assignment.student_id = new.student_id
  ) into v_is_assigned;

  if not v_is_assigned then
    raise exception '该学生不是这位老师负责的学生。';
  end if;

  return new;
end;
$$;

create trigger live_class_sessions_validate_trigger
before insert or update on public.live_class_sessions
for each row execute function public.validate_live_class_session();

alter table public.live_class_sessions enable row level security;

-- 老师：可查看/发起自己创建的会话；负责人可查看本机构全部（老师端管理页备用）
create policy "teachers manage own live class sessions"
on public.live_class_sessions for all to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and teacher_id = (select auth.uid())
)
with check (
  tenant_id = (select private.current_tenant_id())
  and teacher_id = (select auth.uid())
);

-- 学生：只读参与自己的会话（用于发现"老师正在给我上课"并进入课堂）
create policy "students read own live class sessions"
on public.live_class_sessions for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and student_id = (select auth.uid())
);

commit;
