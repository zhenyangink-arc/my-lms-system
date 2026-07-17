-- ============================================================
-- 成绩中心：成绩项目、学生成绩、复核申请与负责人授权
-- 后台：负责人、全部 CEO、负责人单独指定的管理员。
-- 学生：只读已发布项目中的本人数据，并可发起成绩复核。
-- ============================================================

create table if not exists public.grade_center_admin_assignments (
  admin_id uuid primary key references public.profiles(id) on delete cascade,
  granted_by uuid not null references public.profiles(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz
);

create table if not exists public.grade_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  item_type text not null default 'other' check (
    item_type in ('homework', 'quiz', 'exam', 'course', 'final', 'other')
  ),
  term text not null default '' check (char_length(term) <= 60),
  total_points numeric(8,2) not null check (total_points > 0 and total_points <= 10000),
  weight_percent numeric(5,2) not null default 0 check (weight_percent between 0 and 100),
  source_assignment_id uuid unique references public.learning_assignments(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.grade_records (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.grade_items(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  record_status text not null default 'graded' check (record_status in ('graded', 'absent', 'exempt')),
  score numeric(8,2) check (score is null or score >= 0),
  feedback text not null default '' check (char_length(feedback) <= 3000),
  graded_by uuid not null references public.profiles(id) on delete restrict,
  graded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, student_id)
);

create table if not exists public.grade_review_requests (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null unique references public.grade_records(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 2 and 2000),
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'resolved', 'rejected')),
  response text not null default '' check (char_length(response) <= 3000),
  handled_by uuid references public.profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  handled_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists grade_items_status_idx on public.grade_items (status, published_at desc);
create index if not exists grade_records_student_idx on public.grade_records (student_id, graded_at desc);
create index if not exists grade_reviews_status_idx on public.grade_review_requests (status, requested_at desc);
create index if not exists grade_center_admin_assignments_active_idx
  on public.grade_center_admin_assignments (admin_id) where revoked_at is null;

create or replace function public.current_user_is_grade_center_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and coalesce(status, 'active') = 'active' and role = 'super_admin');
$$;

create or replace function public.current_user_can_manage_grade_center()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles as viewer
    where viewer.id = auth.uid() and coalesce(viewer.status, 'active') = 'active'
      and (
        viewer.role in ('super_admin', 'ceo')
        or (viewer.role = 'admin' and exists (
          select 1 from public.grade_center_admin_assignments as assignment
          where assignment.admin_id = viewer.id and assignment.revoked_at is null
        ))
      )
  );
$$;

create or replace function public.enforce_grade_center_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_role text; target_status text;
begin
  if auth.uid() is null then return new; end if;
  if not public.current_user_is_grade_center_owner() then raise exception '只有负责人可以指定成绩管理员'; end if;
  select role, coalesce(status, 'active') into target_role, target_status from public.profiles where id = new.admin_id;
  if new.revoked_at is null and (target_role is distinct from 'admin' or target_status is distinct from 'active') then
    raise exception '只能授权状态正常的管理员账号';
  end if;
  if new.revoked_at is null then new.granted_by := auth.uid(); new.granted_at := now(); new.revoked_by := null;
  else new.revoked_by := auth.uid(); end if;
  return new;
end;
$$;

drop trigger if exists enforce_grade_center_assignment_trigger on public.grade_center_admin_assignments;
create trigger enforce_grade_center_assignment_trigger before insert or update on public.grade_center_admin_assignments
for each row execute function public.enforce_grade_center_assignment();

create or replace function public.list_grade_center_students()
returns table (id uuid, full_name text, email text, membership_tier text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.current_user_can_manage_grade_center() then raise exception '当前账号没有成绩管理权限'; end if;
  return query select profile.id, profile.full_name, profile.email, profile.membership_tier
  from public.profiles as profile
  where profile.role = 'student' and coalesce(profile.status, 'active') = 'active'
  order by coalesce(profile.full_name, profile.email, profile.id::text);
end;
$$;

create or replace function public.save_grade_item(
  p_id uuid, p_title text, p_description text, p_item_type text, p_term text,
  p_total_points numeric, p_weight_percent numeric, p_status text
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.current_user_can_manage_grade_center() then raise exception '当前账号没有成绩管理权限'; end if;
  if char_length(trim(coalesce(p_title, ''))) not between 2 and 120 or char_length(coalesce(p_description, '')) > 2000 or char_length(coalesce(p_term, '')) > 60 then raise exception '成绩项目内容长度不正确'; end if;
  if p_item_type not in ('homework', 'quiz', 'exam', 'course', 'final', 'other') or p_status not in ('draft', 'published', 'archived') then raise exception '成绩项目类型或状态不正确'; end if;
  if p_total_points <= 0 or p_total_points > 10000 or p_weight_percent < 0 or p_weight_percent > 100 then raise exception '满分或权重不正确'; end if;
  if p_id is null then
    insert into public.grade_items (title, description, item_type, term, total_points, weight_percent, status, published_at, created_by, updated_by)
    values (trim(p_title), trim(coalesce(p_description, '')), p_item_type, trim(coalesce(p_term, '')), p_total_points, p_weight_percent, p_status, case when p_status = 'published' then now() else null end, auth.uid(), auth.uid()) returning id into v_id;
  else
    update public.grade_items set title = trim(p_title), description = trim(coalesce(p_description, '')), item_type = p_item_type, term = trim(coalesce(p_term, '')), total_points = p_total_points, weight_percent = p_weight_percent, status = p_status, published_at = case when p_status = 'published' and status <> 'published' then now() when p_status = 'draft' then null else published_at end, updated_by = auth.uid(), updated_at = now() where id = p_id returning id into v_id;
    if v_id is null then raise exception '成绩项目不存在'; end if;
    if exists (select 1 from public.grade_records where item_id = p_id and score > p_total_points) then raise exception '新满分低于现有学生得分'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.change_grade_item_status(p_item_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.current_user_can_manage_grade_center() then raise exception '当前账号没有成绩管理权限'; end if;
  if p_status not in ('draft', 'published', 'archived') then raise exception '成绩项目状态不正确'; end if;
  update public.grade_items set status = p_status, published_at = case when p_status = 'published' and status <> 'published' then now() when p_status = 'draft' then null else published_at end, updated_by = auth.uid(), updated_at = now() where id = p_item_id;
  if not found then raise exception '成绩项目不存在'; end if;
end;
$$;

create or replace function public.save_grade_record(
  p_item_id uuid, p_student_id uuid, p_record_status text, p_score numeric, p_feedback text
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_total numeric; v_id uuid;
begin
  if not public.current_user_can_manage_grade_center() then raise exception '当前账号没有成绩管理权限'; end if;
  select total_points into v_total from public.grade_items where id = p_item_id;
  if v_total is null then raise exception '成绩项目不存在'; end if;
  if not exists (select 1 from public.profiles where id = p_student_id and role = 'student' and coalesce(status, 'active') = 'active') then raise exception '学生账号无效'; end if;
  if p_record_status not in ('graded', 'absent', 'exempt') then raise exception '成绩记录状态不正确'; end if;
  if p_record_status = 'graded' and (p_score is null or p_score < 0 or p_score > v_total) then raise exception '学生得分需要在 0 和满分之间'; end if;
  if p_record_status <> 'graded' then p_score := null; end if;
  if char_length(coalesce(p_feedback, '')) > 3000 then raise exception '成绩评语过长'; end if;
  insert into public.grade_records (item_id, student_id, record_status, score, feedback, graded_by)
  values (p_item_id, p_student_id, p_record_status, p_score, trim(coalesce(p_feedback, '')), auth.uid())
  on conflict (item_id, student_id) do update set record_status = excluded.record_status, score = excluded.score, feedback = excluded.feedback, graded_by = auth.uid(), graded_at = now(), updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.import_assignment_grades(p_assignment_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_assignment public.learning_assignments%rowtype; v_item_id uuid;
begin
  if not public.current_user_can_manage_grade_center() then raise exception '当前账号没有成绩管理权限'; end if;
  select * into v_assignment from public.learning_assignments where id = p_assignment_id;
  if v_assignment.id is null then raise exception '作业或考试不存在'; end if;
  insert into public.grade_items (title, description, item_type, term, total_points, source_assignment_id, status, created_by, updated_by)
  values (v_assignment.title, v_assignment.description, case when v_assignment.assignment_type in ('homework','quiz','exam') then v_assignment.assignment_type else 'other' end, '', v_assignment.total_points, v_assignment.id, 'draft', auth.uid(), auth.uid())
  on conflict (source_assignment_id) do update set title = excluded.title, description = excluded.description, total_points = excluded.total_points, updated_by = auth.uid(), updated_at = now()
  returning id into v_item_id;
  insert into public.grade_records (item_id, student_id, record_status, score, feedback, graded_by, graded_at)
  select v_item_id, latest.student_id, 'graded', latest.score, coalesce(latest.overall_feedback, ''), auth.uid(), coalesce(latest.graded_at, now())
  from (
    select distinct on (submission.student_id) submission.student_id, submission.score, submission.overall_feedback, submission.graded_at
    from public.learning_submissions as submission
    where submission.assignment_id = p_assignment_id and submission.status = 'graded' and submission.score is not null
    order by submission.student_id, submission.attempt_number desc
  ) as latest
  on conflict (item_id, student_id) do update set record_status = 'graded', score = excluded.score, feedback = excluded.feedback, graded_by = auth.uid(), graded_at = excluded.graded_at, updated_at = now();
  return v_item_id;
end;
$$;

create or replace function public.request_grade_review(p_record_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_student uuid; v_item_status text; v_id uuid;
begin
  select record.student_id, item.status into v_student, v_item_status from public.grade_records as record join public.grade_items as item on item.id = record.item_id where record.id = p_record_id;
  if v_student is distinct from auth.uid() or v_item_status is distinct from 'published' then raise exception '无权申请该成绩复核'; end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 2 and 2000 then raise exception '复核原因需要填写 2 至 2000 个字'; end if;
  if exists (select 1 from public.grade_review_requests where record_id = p_record_id and status in ('pending','reviewing')) then raise exception '该成绩已有正在处理的复核申请'; end if;
  insert into public.grade_review_requests (record_id, student_id, reason)
  values (p_record_id, auth.uid(), trim(p_reason))
  on conflict (record_id) do update set reason = excluded.reason, status = 'pending', response = '', handled_by = null, requested_at = now(), handled_at = null, updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.resolve_grade_review(p_review_id uuid, p_status text, p_response text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.current_user_can_manage_grade_center() then raise exception '当前账号没有成绩管理权限'; end if;
  if p_status not in ('reviewing','resolved','rejected') or char_length(trim(coalesce(p_response, ''))) > 3000 then raise exception '复核状态或回复不正确'; end if;
  update public.grade_review_requests set status = p_status, response = trim(coalesce(p_response, '')), handled_by = auth.uid(), handled_at = case when p_status in ('resolved','rejected') then now() else null end, updated_at = now() where id = p_review_id;
  if not found then raise exception '复核申请不存在'; end if;
end;
$$;

alter table public.grade_center_admin_assignments enable row level security;
alter table public.grade_items enable row level security;
alter table public.grade_records enable row level security;
alter table public.grade_review_requests enable row level security;

create policy "grade assignments visible to owner or assignee" on public.grade_center_admin_assignments for select to authenticated using (public.current_user_is_grade_center_owner() or admin_id = auth.uid());
create policy "owner manages grade assignments" on public.grade_center_admin_assignments for all to authenticated using (public.current_user_is_grade_center_owner()) with check (public.current_user_is_grade_center_owner());
create policy "active users read published grade items" on public.grade_items for select to authenticated using (public.current_user_can_manage_grade_center() or (status = 'published' and exists (select 1 from public.profiles as viewer where viewer.id = auth.uid() and coalesce(viewer.status, 'active') = 'active')));
create policy "managers or owners read grade records" on public.grade_records for select to authenticated using (
  public.current_user_can_manage_grade_center()
  or (
    student_id = auth.uid()
    and exists (
      select 1 from public.grade_items as item
      where item.id = grade_records.item_id and item.status = 'published'
    )
  )
);
create policy "managers or owners read grade reviews" on public.grade_review_requests for select to authenticated using (public.current_user_can_manage_grade_center() or student_id = auth.uid());

grant select on public.grade_items, public.grade_records, public.grade_review_requests to authenticated;
grant select, insert, update on public.grade_center_admin_assignments to authenticated;
revoke insert, update, delete on public.grade_items, public.grade_records, public.grade_review_requests from authenticated;
revoke delete on public.grade_center_admin_assignments from authenticated;
revoke all on function public.list_grade_center_students() from public, anon;
revoke all on function public.save_grade_item(uuid,text,text,text,text,numeric,numeric,text) from public, anon;
revoke all on function public.change_grade_item_status(uuid,text) from public, anon;
revoke all on function public.save_grade_record(uuid,uuid,text,numeric,text) from public, anon;
revoke all on function public.import_assignment_grades(uuid) from public, anon;
revoke all on function public.request_grade_review(uuid,text) from public, anon;
revoke all on function public.resolve_grade_review(uuid,text,text) from public, anon;
grant execute on function public.current_user_is_grade_center_owner(), public.current_user_can_manage_grade_center(), public.list_grade_center_students(), public.save_grade_item(uuid,text,text,text,text,numeric,numeric,text), public.change_grade_item_status(uuid,text), public.save_grade_record(uuid,uuid,text,numeric,text), public.import_assignment_grades(uuid), public.request_grade_review(uuid,text), public.resolve_grade_review(uuid,text,text) to authenticated;

comment on table public.grade_items is '成绩中心可发布的成绩项目，支持关联作业考试';
comment on table public.grade_records is '每个成绩项目下的学生得分与评语';
comment on table public.grade_review_requests is '学生发起、成绩后台处理的成绩复核申请';
