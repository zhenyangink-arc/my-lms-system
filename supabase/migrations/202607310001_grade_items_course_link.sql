-- ============================================================
-- 成绩项目关联具体课程，使成绩单可以按"我的课程"里的课程分组展示
-- ============================================================

alter table public.grade_items add column if not exists course_id uuid;

alter table public.grade_items
  drop constraint if exists grade_items_course_id_fkey,
  add constraint grade_items_course_id_fkey
    foreign key (tenant_id, course_id) references public.courses (tenant_id, id)
    on delete set null (course_id);

create index if not exists grade_items_course_idx on public.grade_items (course_id);

drop function if exists public.save_grade_item(uuid, text, text, text, text, numeric, numeric, text);

create or replace function public.save_grade_item(
  p_id uuid, p_title text, p_description text, p_item_type text, p_term text,
  p_total_points numeric, p_weight_percent numeric, p_status text, p_course_id uuid
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.current_user_can_manage_grade_center() then raise exception '当前账号没有成绩管理权限'; end if;
  if char_length(trim(coalesce(p_title, ''))) not between 2 and 120 or char_length(coalesce(p_description, '')) > 2000 or char_length(coalesce(p_term, '')) > 60 then raise exception '成绩项目内容长度不正确'; end if;
  if p_item_type not in ('homework', 'quiz', 'exam', 'course', 'final', 'other') or p_status not in ('draft', 'published', 'archived') then raise exception '成绩项目类型或状态不正确'; end if;
  if p_total_points <= 0 or p_total_points > 10000 or p_weight_percent < 0 or p_weight_percent > 100 then raise exception '满分或权重不正确'; end if;
  if p_course_id is not null and not exists (
    select 1 from public.courses where id = p_course_id and tenant_id = private.current_tenant_id()
  ) then raise exception '所选课程不存在'; end if;
  if p_id is null then
    insert into public.grade_items (title, description, item_type, term, total_points, weight_percent, status, course_id, published_at, created_by, updated_by)
    values (trim(p_title), trim(coalesce(p_description, '')), p_item_type, trim(coalesce(p_term, '')), p_total_points, p_weight_percent, p_status, p_course_id, case when p_status = 'published' then now() else null end, auth.uid(), auth.uid()) returning id into v_id;
  else
    update public.grade_items set title = trim(p_title), description = trim(coalesce(p_description, '')), item_type = p_item_type, term = trim(coalesce(p_term, '')), total_points = p_total_points, weight_percent = p_weight_percent, status = p_status, course_id = p_course_id, published_at = case when p_status = 'published' and status <> 'published' then now() when p_status = 'draft' then null else published_at end, updated_by = auth.uid(), updated_at = now() where id = p_id returning id into v_id;
    if v_id is null then raise exception '成绩项目不存在'; end if;
    if exists (select 1 from public.grade_records where item_id = p_id and score > p_total_points) then raise exception '新满分低于现有学生得分'; end if;
  end if;
  return v_id;
end;
$$;

revoke all on function public.save_grade_item(uuid, text, text, text, text, numeric, numeric, text, uuid) from public, anon;
grant execute on function public.save_grade_item(uuid, text, text, text, text, numeric, numeric, text, uuid) to authenticated;

comment on column public.grade_items.course_id is '关联的具体课程（我的课程 -> courses），可为空表示综合成绩';

create or replace function public.import_assignment_grades(p_assignment_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_assignment public.learning_assignments%rowtype; v_item_id uuid;
begin
  if not public.current_user_can_manage_grade_center() then raise exception '当前账号没有成绩管理权限'; end if;
  select * into v_assignment from public.learning_assignments where id = p_assignment_id;
  if v_assignment.id is null then raise exception '作业或考试不存在'; end if;
  insert into public.grade_items (title, description, item_type, term, total_points, source_assignment_id, course_id, status, created_by, updated_by)
  values (v_assignment.title, v_assignment.description, case when v_assignment.assignment_type in ('homework','quiz','exam') then v_assignment.assignment_type else 'other' end, '', v_assignment.total_points, v_assignment.id, v_assignment.course_id, 'draft', auth.uid(), auth.uid())
  on conflict (source_assignment_id) do update set title = excluded.title, description = excluded.description, total_points = excluded.total_points, course_id = excluded.course_id, updated_by = auth.uid(), updated_at = now()
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
