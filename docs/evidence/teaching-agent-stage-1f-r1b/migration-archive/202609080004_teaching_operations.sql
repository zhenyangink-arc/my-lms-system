begin;

alter table public.curriculum_plan_template_items drop constraint curriculum_plan_template_items_source_type_check;
alter table public.curriculum_plan_template_items add constraint curriculum_plan_template_items_source_type_check
  check (source_type in ('lesson','chapter','chapter_test','assessment_paper','chapter_practice','specialized_practice','manual'));
alter table public.curriculum_plan_template_items drop constraint curriculum_plan_template_items_activity_type_check;
alter table public.curriculum_plan_template_items add constraint curriculum_plan_template_items_activity_type_check
  check (activity_type in ('course','listening','speaking','reading','writing','vocabulary','grammar','chapter_test','stage_exam','final_exam','review','chapter_practice'));

-- Keep the existing draft/frozen-template guards. This guard adds typed sources.
create function private.guard_curriculum_learning_source() returns trigger
language plpgsql security definer set search_path = '' as $$
declare t public.curriculum_plan_templates%rowtype;
begin
  select * into strict t from public.curriculum_plan_templates where id = new.template_id;
  -- Existing manual arrangements may be copied into a draft for repair. They
  -- cannot be published as executable exam/practice tasks (publication guard).
  if new.source_type = 'manual' then return new; end if;
  if new.activity_type in ('stage_exam','final_exam') then
    if new.source_type <> 'assessment_paper' or not exists (
      select 1 from public.assessment_papers p
      join public.chapter_tests test on test.id = p.source_test_id
      join public.lessons l on l.id = test.lesson_id
      where p.id = new.source_id and p.student_app_id = t.student_app_id
        and p.status = 'published' and p.paper_type = 'exam' and l.course_id = t.course_id
    ) then raise exception '考试安排必须绑定本课程已发布的标准考试卷'; end if;
  elsif new.source_type = 'assessment_paper' then
    raise exception '只有考试安排可以绑定标准考试卷';
  end if;
  if new.activity_type = 'chapter_practice' then
    if new.source_type <> 'chapter_practice' or not exists (
      select 1 from public.chapter_practice_units u
      join public.course_chapters c on c.id = u.course_chapter_id
      join public.lessons l on l.id = c.lesson_id
      where u.id = new.source_id and u.student_app_id = t.student_app_id
        and u.status = 'published' and c.is_published and l.is_published and l.course_id = t.course_id
    ) then raise exception '巩固安排必须绑定本课程已发布的章节巩固包'; end if;
  elsif new.source_type = 'chapter_practice' then
    raise exception '只有章节巩固安排可以绑定巩固包';
  end if;
  if new.activity_type in ('listening','speaking','reading','writing','grammar','vocabulary') then
    if new.source_type <> 'specialized_practice' or not exists (
      select 1 from public.growth_toolbox_exercises e
      join public.course_chapters c on c.id = e.course_chapter_id
      join public.lessons l on l.id = c.lesson_id
      where e.id = new.source_id and e.student_app_id = t.student_app_id
        and e.status = 'published' and e.skill = new.activity_type
        and e.course_id = t.course_id and l.course_id = t.course_id and c.is_published and l.is_published
    ) then raise exception '专项练习必须绑定本课程对应能力的已发布练习'; end if;
  elsif new.source_type = 'specialized_practice' then
    raise exception '专项练习来源与活动类型不一致';
  end if;
  return new;
end $$;
revoke all on function private.guard_curriculum_learning_source() from public, anon, authenticated;
create trigger curriculum_learning_source_guard before insert or update on public.curriculum_plan_template_items
  for each row execute function private.guard_curriculum_learning_source();

create function private.guard_curriculum_learning_publication() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'draft' and new.status = 'published' and exists (
    select 1 from public.curriculum_plan_template_items i where i.template_id = new.id and (
      (i.activity_type <> 'review' and i.source_type = 'manual')
      or (i.source_type = 'assessment_paper' and not exists(select 1 from public.assessment_papers p where p.id = i.source_id and p.status = 'published'))
      or (i.source_type = 'chapter_practice' and not exists(select 1 from public.chapter_practice_units u where u.id = i.source_id and u.status = 'published'))
      or (i.source_type = 'specialized_practice' and not exists(select 1 from public.growth_toolbox_exercises e where e.id = i.source_id and e.status = 'published'))
    )
  ) then raise exception '请先将考试和练习绑定到有效的已发布内容，再发布计划'; end if;
  return new;
end $$;
revoke all on function private.guard_curriculum_learning_publication() from public,anon,authenticated;
create trigger curriculum_learning_publication_guard before update on public.curriculum_plan_templates
  for each row execute function private.guard_curriculum_learning_publication();

-- Historical templates remain visible only through a plan the staff member can manage.
create function private.staff_has_curriculum_template(p_template_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from public.institution_curriculum_plans p
    where p.template_id = p_template_id and p.tenant_id = private.current_tenant_id()
      and private.can_manage_curriculum_plan(p.id));
$$;
revoke all on function private.staff_has_curriculum_template(uuid) from public,anon,authenticated;
grant execute on function private.staff_has_curriculum_template(uuid) to authenticated;
create policy "staff read adopted curriculum templates" on public.curriculum_plan_templates for select to authenticated
  using (private.staff_has_curriculum_template(id));
create policy "staff read adopted curriculum items" on public.curriculum_plan_template_items for select to authenticated
  using (private.staff_has_curriculum_template(template_id));

-- One real assignment per plan item; students, dates and the paper come from the plan.
create table public.curriculum_plan_assessments (
  plan_id uuid not null references public.institution_curriculum_plans(id) on delete cascade,
  item_id uuid not null references public.curriculum_plan_template_items(id) on delete restrict,
  assignment_id uuid not null unique references public.learning_assignments(id) on delete restrict,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key(plan_id,item_id)
);
alter table public.curriculum_plan_assessments enable row level security;
revoke all on public.curriculum_plan_assessments from public, anon, authenticated;

create function public.dispatch_curriculum_plan_exam(p_plan_id uuid, p_item_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  p public.institution_curriculum_plans%rowtype;
  i public.curriculum_plan_template_items%rowtype;
  v_assignment uuid; v_students uuid[]; v_course uuid; v_anchor integer; v_start timestamptz;
begin
  select * into p from public.institution_curriculum_plans where id = p_plan_id for update;
  if auth.uid() is null or not coalesce(private.can_manage_curriculum_plan(p_plan_id),false)
    or p.tenant_id is distinct from private.current_tenant_id() then raise exception '无权布置此计划的考试'; end if;
  if p.status not in ('published','active') then raise exception '只有有效机构计划可以布置考试'; end if;
  select * into i from public.curriculum_plan_template_items where id = p_item_id and template_id = p.template_id;
  if i.id is null or i.source_type <> 'assessment_paper' then raise exception '计划项目未绑定标准考试卷'; end if;
  select array_agg(s.student_id) into v_students from public.institution_curriculum_plan_students s where s.plan_id = p.id;
  if coalesce(cardinality(v_students),0) = 0 then raise exception '请先向计划分配学生'; end if;
  if exists (select 1 from unnest(v_students) s(id) where not exists (
    select 1 from public.student_app_enrollments e where e.student_id = s.id and e.tenant_id = p.tenant_id
      and e.app_id = p.student_app_id and e.status = 'active' and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now())
  )) then raise exception '计划中存在未开通或已失效的学生，请先处理学生授权'; end if;
  if public.current_profile_role() = 'teacher' and exists (
    select 1 from unnest(v_students) s(id) where not exists (
      select 1 from public.tenant_student_assignments a where a.tenant_id = p.tenant_id
        and a.student_app_id = p.student_app_id and a.teacher_id = auth.uid() and a.student_id = s.id
    )
  ) then raise exception '老师只能向当前应用中自己负责的学生布置考试'; end if;
  select assignment_id into v_assignment from public.curriculum_plan_assessments where plan_id = p.id and item_id = i.id;
  if v_assignment is not null then return v_assignment; end if;
  select course_id into v_course from public.curriculum_plan_templates where id = p.template_id;
  select min(day_offset * 1440 + start_minute) into v_anchor from public.curriculum_plan_template_items where template_id = p.template_id;
  v_start := p.starts_at + make_interval(mins => i.day_offset * 1440 + i.start_minute - v_anchor);
  if v_start <= now() then raise exception '考试计划时间已经开始，请采用新计划安排未来的考试'; end if;
  v_assignment := public.create_learning_assignment_from_paper_with_unlock(
    i.source_id, v_course, 'selected_students', v_students, v_start,
    v_start + make_interval(mins => i.duration_minutes), coalesce(i.instructions,''),
    false, null, false, 1, false, false, null, null, '{}'::uuid[], null, null, 'highest', null
  );
  insert into public.curriculum_plan_assessments(plan_id,item_id,assignment_id,created_by) values(p.id,i.id,v_assignment,auth.uid());
  return v_assignment;
end $$;
revoke all on function public.dispatch_curriculum_plan_exam(uuid,uuid) from public,anon,authenticated;
grant execute on function public.dispatch_curriculum_plan_exam(uuid,uuid) to authenticated;

-- Appending students must not silently leave them out of an already dispatched exam.
-- Keep this explicit: no silent changes to live examination recipients.
create function private.guard_curriculum_exam_roster() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.institution_curriculum_plans where id = new.plan_id for update;
  if exists(select 1 from public.curriculum_plan_assessments where plan_id = new.plan_id)
    and not exists(select 1 from public.institution_curriculum_plan_students where plan_id = new.plan_id and student_id = new.student_id) then
    raise exception '此计划已布置考试；请为新增学生发布单独计划，避免遗漏考试名单';
  end if;
  return new;
end $$;
revoke all on function private.guard_curriculum_exam_roster() from public,anon,authenticated;
create trigger curriculum_exam_roster_guard before insert or update on public.institution_curriculum_plan_students
  for each row execute function private.guard_curriculum_exam_roster();

create function private.guard_curriculum_exam_cancellation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' and exists (
    select 1 from public.curriculum_plan_assessments ca join public.learning_assignments a on a.id = ca.assignment_id
      where ca.plan_id = new.id and a.status = 'published'
  ) then raise exception '此计划还有已布置的考试，请先在考试管理中结束考试，再取消计划'; end if;
  return new;
end $$;
revoke all on function private.guard_curriculum_exam_cancellation() from public,anon,authenticated;
create trigger curriculum_exam_cancellation_guard before update on public.institution_curriculum_plans
  for each row execute function private.guard_curriculum_exam_cancellation();

-- Returns only completion facts, never answers, tokens or private grading content.
-- All reads are scoped to current tenant, active app enrollment and teacher relationships.
create function public.get_curriculum_execution(p_plan_ids uuid[]) returns jsonb
language sql stable security definer set search_path = '' as $$
with permitted as (
  select p.*, s.student_id, t.course_id
  from public.institution_curriculum_plans p
  join public.curriculum_plan_templates t on t.id = p.template_id
  join public.institution_curriculum_plan_students s on s.plan_id = p.id and s.tenant_id = p.tenant_id
  join public.student_app_enrollments en on en.tenant_id = p.tenant_id and en.student_id = s.student_id
    and en.app_id = p.student_app_id and en.status = 'active' and en.starts_at <= now() and (en.ends_at is null or en.ends_at > now())
  join public.tenant_memberships m on m.tenant_id = p.tenant_id and m.user_id = s.student_id and m.status = 'active' and m.role = 'student'
  where p.id = any(p_plan_ids) and p.tenant_id = private.current_tenant_id() and auth.uid() is not null
    and p.status in ('published','active','completed')
    and (s.student_id = auth.uid() or (
      private.can_manage_curriculum_plan(p.id)
      and (public.current_profile_role() <> 'teacher' or exists (
        select 1 from public.tenant_student_assignments a where a.tenant_id = p.tenant_id
          and a.student_app_id = p.student_app_id and a.teacher_id = auth.uid() and a.student_id = s.student_id
      ))
    ))
), facts as (
  select p.id plan_id, i.id item_id, p.student_id, i.source_type,
    case i.source_type
      when 'lesson' then coalesce(lp.status = 'completed',false)
      when 'chapter' then ep.completed_at is not null
      when 'chapter_test' then coalesce(ta.passed,false)
      when 'chapter_practice' then pp.completed_at is not null
      when 'specialized_practice' then coalesce(tp.completed,false)
      when 'assessment_paper' then coalesce(sub.submission_state = 'grade_released' and sub.grade_released_at is not null,false)
      else false end completed,
    case i.source_type
      when 'lesson' then coalesce(lp.status <> 'not_started',false)
      when 'chapter' then ep.id is not null
      when 'chapter_test' then coalesce(ta.started,false)
      when 'chapter_practice' then pp.started_at is not null
      when 'specialized_practice' then coalesce(tp.started,false)
      when 'assessment_paper' then sub.id is not null
      else false end started,
    coalesce(sub.submission_state in ('submitted_pending_grading','objective_graded_pending_manual','grading_completed'),false) pending_grading,
    case i.source_type
      when 'lesson' then coalesce(l.is_published,false)
      when 'chapter' then coalesce(ch.is_published,false)
      when 'chapter_test' then coalesce(test.status = 'published',false)
      when 'chapter_practice' then coalesce(u.status in ('published','needs_update'),false)
      when 'specialized_practice' then coalesce(ex.status = 'published',false)
      when 'assessment_paper' then a.id is not null and a.status in ('published','closed')
      else false end available,
    case i.source_type when 'lesson' then lp.progress_percent when 'chapter' then ep.progress_percent
      when 'chapter_practice' then pp.progress_percent else null end progress_percent,
    a.id assignment_id, a.starts_at, a.due_at
  from permitted p join public.curriculum_plan_template_items i on i.template_id = p.template_id
  left join public.lessons l on i.source_type = 'lesson' and l.id = i.source_id and l.course_id = p.course_id
  left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = p.student_id and lp.tenant_id = p.tenant_id
  left join public.course_chapters ch on i.source_type = 'chapter' and ch.id = i.source_id
  left join public.chapter_tests cht on cht.id = ch.chapter_test_id and cht.student_app_id = p.student_app_id
  left join public.course_ebook_progress ep on ep.test_slug = cht.slug and ep.student_id = p.student_id
    and ep.tenant_id = p.tenant_id and ep.student_app_id = p.student_app_id
  left join public.chapter_tests test on i.source_type = 'chapter_test' and test.id = i.source_id and test.student_app_id = p.student_app_id
  left join lateral (select bool_or(at.passed) passed, count(*) > 0 started from public.chapter_test_attempts at
    where at.test_id = test.id and at.student_id = p.student_id and at.tenant_id = p.tenant_id) ta on true
  left join public.chapter_practice_units u on i.source_type = 'chapter_practice' and u.id = i.source_id and u.student_app_id = p.student_app_id
  left join public.student_chapter_practice_progress pp on pp.practice_unit_id = u.id and pp.student_id = p.student_id and pp.tenant_id = p.tenant_id
  left join public.growth_toolbox_exercises ex on i.source_type = 'specialized_practice' and ex.id = i.source_id and ex.student_app_id = p.student_app_id
  left join lateral (select bool_or(s.status = 'completed' and s.completed_at is not null) completed, count(*) > 0 started
    from public.toolbox_practice_sessions s where s.exercise_id = ex.id and s.student_id = p.student_id
      and s.tenant_id = p.tenant_id and s.started_at >= p.starts_at + make_interval(mins =>
        i.day_offset * 1440 + i.start_minute - (select min(pi.day_offset * 1440 + pi.start_minute)
          from public.curriculum_plan_template_items pi where pi.template_id = p.template_id))) tp on true
  left join public.curriculum_plan_assessments ca on ca.plan_id = p.id and ca.item_id = i.id
  left join public.learning_assignments a on a.id = ca.assignment_id and a.tenant_id = p.tenant_id and a.student_app_id = p.student_app_id
    and (a.target_scope = 'all_students' or exists(select 1 from public.learning_assignment_targets target where target.assignment_id = a.id and target.student_id = p.student_id))
  left join lateral (select s.id,s.submission_state,s.grade_released_at from public.learning_submissions s
    where s.assignment_id = a.id and s.student_id = p.student_id and s.tenant_id = p.tenant_id
    order by s.attempt_number desc, s.submitted_at desc limit 1) sub on true
)
select coalesce(jsonb_agg(to_jsonb(facts) - 'source_type' || jsonb_build_object('tracked',source_type <> 'manual')), '[]'::jsonb) from facts;
$$;
revoke all on function public.get_curriculum_execution(uuid[]) from public,anon,authenticated;
grant execute on function public.get_curriculum_execution(uuid[]) to authenticated;

commit;
