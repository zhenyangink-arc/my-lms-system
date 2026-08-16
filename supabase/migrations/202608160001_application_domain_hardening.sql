begin;

-- ============================================================
-- 应用域硬化
--
-- 目标：
-- 1. 所有平台内容与学习事实都必须明确属于一个学生应用；
-- 2. 禁止缺少 app_id 的新数据静默落入韩语；
-- 3. 课程、试卷、互动教材沿父级继承且创建后不可跨应用移动；
-- 4. 数据读取和授权写入同时校验租户、应用和实时有效权限。
-- ============================================================

alter table public.assessment_papers
  add column if not exists student_app_id uuid
    references public.student_apps(id) on delete restrict;

update public.assessment_papers as paper
set student_app_id = test.student_app_id
from public.chapter_tests as test
where test.id = paper.source_test_id
  and paper.student_app_id is distinct from test.student_app_id;

alter table public.digital_textbooks
  add column if not exists student_app_id uuid
    references public.student_apps(id) on delete restrict;

update public.digital_textbooks as textbook
set student_app_id = course.student_app_id
from public.lessons as lesson
join public.courses as course on course.id = lesson.course_id
where lesson.id = textbook.lesson_id
  and textbook.student_app_id is distinct from course.student_app_id;

do $$
begin
  if exists (select 1 from public.course_categories where student_app_id is null) then
    raise exception '仍有课程分类缺少应用归属，拒绝部署';
  end if;
  if exists (select 1 from public.courses where student_app_id is null) then
    raise exception '仍有课程缺少应用归属，拒绝部署';
  end if;
  if exists (select 1 from public.assessment_papers where student_app_id is null) then
    raise exception '仍有标准试卷缺少应用归属，拒绝部署';
  end if;
  if exists (select 1 from public.digital_textbooks where student_app_id is null) then
    raise exception '仍有互动教材缺少应用归属，拒绝部署';
  end if;
  if exists (
    select 1
    from public.courses as course
    join public.course_categories as category on category.id = course.category_id
    where course.student_app_id is distinct from category.student_app_id
  ) then
    raise exception '课程与分类的应用归属不一致，拒绝部署';
  end if;
  if exists (
    select 1
    from public.assessment_papers as paper
    join public.chapter_tests as test on test.id = paper.source_test_id
    where paper.student_app_id is distinct from test.student_app_id
  ) then
    raise exception '标准试卷与来源章节测试的应用归属不一致，拒绝部署';
  end if;
  if exists (
    select 1
    from public.digital_textbooks as textbook
    join public.lessons as lesson on lesson.id = textbook.lesson_id
    join public.courses as course on course.id = lesson.course_id
    where textbook.student_app_id is distinct from course.student_app_id
  ) then
    raise exception '互动教材与所属课程的应用归属不一致，拒绝部署';
  end if;
end;
$$;

alter table public.course_categories
  alter column student_app_id set not null;
alter table public.courses
  alter column student_app_id set not null;
alter table public.assessment_papers
  alter column student_app_id set not null;
alter table public.digital_textbooks
  alter column student_app_id set not null;

-- 旧默认值会把遗漏 app_id 的英语、数学或大学课程数据静默写入韩语。
-- 删除默认值后，缺少归属的写入必须显式失败。
alter table public.learning_assignments alter column student_app_id drop default;
alter table public.chapter_tests alter column student_app_id drop default;
alter table public.learning_time_log alter column student_app_id drop default;
alter table public.course_ebook_progress alter column student_app_id drop default;
alter table public.learning_record_notes alter column student_app_id drop default;
alter table public.conversation_practice_scenarios alter column student_app_id drop default;
alter table public.growth_toolbox_exercises alter column student_app_id drop default;
alter table public.toolbox_practice_sessions alter column student_app_id drop default;
alter table public.tenant_student_assignments alter column student_app_id drop default;
alter table public.growth_toolbox_items alter column student_app_id drop default;
alter table public.growth_toolbox_vocabulary alter column student_app_id drop default;
alter table public.growth_toolbox_grammar alter column student_app_id drop default;

-- 工具入口和练习 slug 只需在应用域内唯一；否则英语、数学无法拥有与韩语
-- 同名的 vocabulary / grammar 等标准入口。
alter table public.growth_toolbox_items
  drop constraint if exists growth_toolbox_items_slug_key;
alter table public.growth_toolbox_items
  add constraint growth_toolbox_items_app_slug_key
  unique (student_app_id, slug);
alter table public.growth_toolbox_exercises
  drop constraint if exists growth_toolbox_exercises_tenant_id_slug_key;
alter table public.growth_toolbox_exercises
  add constraint growth_toolbox_exercises_tenant_app_slug_key
  unique nulls not distinct (tenant_id, student_app_id, slug);

create index if not exists assessment_papers_student_app_idx
  on public.assessment_papers (student_app_id, paper_type, status, updated_at desc);
create index if not exists digital_textbooks_student_app_idx
  on public.digital_textbooks (student_app_id, status, updated_at desc);

create or replace function private.sync_student_app_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_derived_app_id uuid;
  v_secondary_app_id uuid;
begin
  if tg_table_name = 'course_categories' then
    if new.parent_id is not null then
      select parent.student_app_id into v_derived_app_id
      from public.course_categories as parent
      where parent.id = new.parent_id;
      if v_derived_app_id is null then
        raise exception '父级课程分类不存在或缺少应用归属';
      end if;
    elsif new.student_app_id is null then
      raise exception '一级课程分类必须显式选择学生应用';
    end if;

  elsif tg_table_name = 'courses' then
    select category.student_app_id into v_derived_app_id
    from public.course_categories as category
    where category.id = new.category_id;
    if v_derived_app_id is null then
      raise exception '课程分类不存在或缺少应用归属';
    end if;

  elsif tg_table_name = 'learning_assignments' then
    if new.course_id is not null then
      select course.student_app_id into v_derived_app_id
      from public.courses as course
      where course.id = new.course_id;
      if v_derived_app_id is null then
        raise exception '作业课程不存在或缺少应用归属';
      end if;
    end if;
    if new.source_paper_id is not null then
      select paper.student_app_id into v_secondary_app_id
      from public.assessment_papers as paper
      where paper.id = new.source_paper_id;
      if v_secondary_app_id is null then
        raise exception '来源试卷不存在或缺少应用归属';
      end if;
      if v_derived_app_id is not null
        and v_derived_app_id is distinct from v_secondary_app_id then
        raise exception '作业课程与来源试卷不属于同一个应用';
      end if;
      v_derived_app_id := v_secondary_app_id;
    end if;

  elsif tg_table_name = 'chapter_tests' then
    if new.lesson_id is not null then
      select course.student_app_id into v_derived_app_id
      from public.lessons as lesson
      join public.courses as course on course.id = lesson.course_id
      where lesson.id = new.lesson_id;
      if v_derived_app_id is null then
        raise exception '章节测试课时不存在或缺少应用归属';
      end if;
    end if;

  elsif tg_table_name = 'assessment_papers' then
    select test.student_app_id into v_derived_app_id
    from public.chapter_tests as test
    where test.id = new.source_test_id;
    if v_derived_app_id is null then
      raise exception '标准试卷来源测试不存在或缺少应用归属';
    end if;

  elsif tg_table_name = 'digital_textbooks' then
    select course.student_app_id into v_derived_app_id
    from public.lessons as lesson
    join public.courses as course on course.id = lesson.course_id
    where lesson.id = new.lesson_id;
    if v_derived_app_id is null then
      raise exception '互动教材课时不存在或缺少应用归属';
    end if;

  elsif tg_table_name = 'growth_toolbox_exercises' then
    if new.course_id is not null then
      select course.student_app_id into v_derived_app_id
      from public.courses as course
      where course.id = new.course_id;
      if v_derived_app_id is null then
        raise exception '练习课程不存在或缺少应用归属';
      end if;
    end if;

  elsif tg_table_name = 'toolbox_practice_sessions' then
    select exercise.student_app_id into v_derived_app_id
    from public.growth_toolbox_exercises as exercise
    where exercise.id = new.exercise_id;
    if v_derived_app_id is null then
      raise exception '练习项目不存在或缺少应用归属';
    end if;

  elsif tg_table_name in ('course_ebook_progress', 'learning_time_log') then
    if new.test_slug is not null then
      select test.student_app_id into v_derived_app_id
      from public.chapter_tests as test
      where test.slug = new.test_slug;
      if v_derived_app_id is null then
        raise exception '学习测试不存在或缺少应用归属';
      end if;
    end if;
  end if;

  if v_derived_app_id is not null then
    if new.student_app_id is not null
      and new.student_app_id is distinct from v_derived_app_id then
      raise exception '写入的应用与父级内容归属不一致';
    end if;
    new.student_app_id := v_derived_app_id;
  end if;

  if new.student_app_id is null then
    raise exception '缺少学生应用归属，拒绝写入';
  end if;

  if tg_op = 'UPDATE'
    and old.student_app_id is distinct from new.student_app_id then
    raise exception '应用归属创建后不可修改；请在目标应用重新创建内容';
  end if;

  return new;
end;
$$;

-- 补齐父级字段变化的监听；此前 source_paper_id 变化不会重新校验应用。
drop trigger if exists learning_assignments_sync_student_app on public.learning_assignments;
create trigger learning_assignments_sync_student_app
before insert or update of course_id, source_paper_id, student_app_id
on public.learning_assignments
for each row execute function private.sync_student_app_ownership();

drop trigger if exists assessment_papers_sync_student_app on public.assessment_papers;
create trigger assessment_papers_sync_student_app
before insert or update of source_test_id, student_app_id
on public.assessment_papers
for each row execute function private.sync_student_app_ownership();

drop trigger if exists digital_textbooks_sync_student_app on public.digital_textbooks;
create trigger digital_textbooks_sync_student_app
before insert or update of lesson_id, student_app_id
on public.digital_textbooks
for each row execute function private.sync_student_app_ownership();

-- 没有父级可继承的表必须显式传 app_id，并禁止后续改域。
create or replace function private.enforce_explicit_student_app_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_app_id uuid;
begin
  if new.student_app_id is null then
    raise exception '缺少学生应用归属，拒绝写入';
  end if;

  if tg_table_name = 'growth_toolbox_items'
    and new.related_course_id is not null then
    select course.student_app_id into v_parent_app_id
    from public.courses as course
    where course.id = new.related_course_id;
    if v_parent_app_id is null
      or v_parent_app_id is distinct from new.student_app_id then
      raise exception '工具入口关联课程与入口不属于同一个应用';
    end if;
  elsif tg_table_name = 'growth_toolbox_vocabulary'
    and new.source_chapter_id is not null then
    select textbook.student_app_id into v_parent_app_id
    from public.digital_textbook_chapters as chapter
    join public.digital_textbook_versions as version
      on version.id = chapter.version_id
    join public.digital_textbooks as textbook
      on textbook.id = version.textbook_id
    where chapter.id = new.source_chapter_id;
    if v_parent_app_id is null
      or v_parent_app_id is distinct from new.student_app_id then
      raise exception '工具箱词汇来源章节与词汇不属于同一个应用';
    end if;
  end if;

  if tg_op = 'UPDATE'
    and old.student_app_id is distinct from new.student_app_id then
    raise exception '应用归属创建后不可修改；请在目标应用重新创建数据';
  end if;
  return new;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'learning_record_notes',
    'conversation_practice_scenarios',
    'tenant_student_assignments',
    'growth_toolbox_items',
    'growth_toolbox_vocabulary',
    'growth_toolbox_grammar'
  ] loop
    execute format('drop trigger if exists %I_explicit_student_app on public.%I', v_table, v_table);
    execute format(
      'create trigger %I_explicit_student_app before insert or update of student_app_id on public.%I for each row execute function private.enforce_explicit_student_app_ownership()',
      v_table,
      v_table
    );
  end loop;
end;
$$;

drop trigger if exists growth_toolbox_items_explicit_student_app
  on public.growth_toolbox_items;
create trigger growth_toolbox_items_explicit_student_app
before insert or update of student_app_id, related_course_id
on public.growth_toolbox_items
for each row execute function private.enforce_explicit_student_app_ownership();

drop trigger if exists growth_toolbox_vocabulary_explicit_student_app
  on public.growth_toolbox_vocabulary;
create trigger growth_toolbox_vocabulary_explicit_student_app
before insert or update of student_app_id, source_chapter_id
on public.growth_toolbox_vocabulary
for each row execute function private.enforce_explicit_student_app_ownership();

-- 教材章节若关联章节测试，两者也必须属于同一应用。
create or replace function private.validate_digital_textbook_chapter_app()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_textbook_app_id uuid;
  v_test_app_id uuid;
begin
  select textbook.student_app_id into v_textbook_app_id
  from public.digital_textbook_versions as version
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where version.id = new.version_id;
  if v_textbook_app_id is null then
    raise exception '教材版本不存在或缺少应用归属';
  end if;

  if new.chapter_test_id is not null then
    select test.student_app_id into v_test_app_id
    from public.chapter_tests as test
    where test.id = new.chapter_test_id;
    if v_test_app_id is null or v_test_app_id is distinct from v_textbook_app_id then
      raise exception '教材章节测试与教材不属于同一个应用';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists digital_textbook_chapters_validate_app
  on public.digital_textbook_chapters;
create trigger digital_textbook_chapters_validate_app
before insert or update of version_id, chapter_test_id
on public.digital_textbook_chapters
for each row execute function private.validate_digital_textbook_chapter_app();

-- ============================================================
-- 实时应用权限判定
-- ============================================================

create or replace function private.current_student_has_app_access(
  p_tenant_id uuid,
  p_student_id uuid,
  p_app_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_student_id = (select auth.uid())
    and p_tenant_id = private.current_tenant_id()
    and exists (
      select 1
      from public.profiles as profile
      join public.tenant_memberships as membership
        on membership.user_id = profile.id
       and membership.tenant_id = p_tenant_id
      join public.tenant_student_apps as tenant_app
        on tenant_app.tenant_id = membership.tenant_id
       and tenant_app.app_id = p_app_id
      join public.student_app_enrollments as enrollment
        on enrollment.tenant_id = membership.tenant_id
       and enrollment.student_id = membership.user_id
       and enrollment.app_id = tenant_app.app_id
      where profile.id = p_student_id
        and coalesce(profile.status, 'active') = 'active'
        and membership.role = 'student'
        and membership.status = 'active'
        and tenant_app.is_enabled
        and tenant_app.status = 'active'
        and enrollment.status = 'active'
        and enrollment.starts_at <= now()
        and (enrollment.ends_at is null or enrollment.ends_at > now())
    );
$$;

create or replace function private.current_staff_has_app_capability(
  p_tenant_id uuid,
  p_app_id uuid,
  p_capability text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_tenant_id = private.current_tenant_id()
    and p_capability in (
      'manage_availability', 'manage_students', 'manage_content',
      'manage_assessments', 'view_analytics'
    )
    and exists (
      select 1
      from public.profiles as profile
      join public.tenant_memberships as membership
        on membership.user_id = profile.id
       and membership.tenant_id = p_tenant_id
      join public.tenant_student_apps as tenant_app
        on tenant_app.tenant_id = membership.tenant_id
       and tenant_app.app_id = p_app_id
      left join public.staff_app_assignments as staff_access
        on staff_access.tenant_id = membership.tenant_id
       and staff_access.staff_id = membership.user_id
       and staff_access.app_id = tenant_app.app_id
       and staff_access.status = 'active'
      where profile.id = (select auth.uid())
        and coalesce(profile.status, 'active') = 'active'
        and membership.status = 'active'
        and membership.role in ('teacher', 'admin', 'ceo', 'tenant_super_admin')
        and (
          (
            membership.role in ('ceo', 'tenant_super_admin')
            and p_capability in (
              'manage_availability', 'manage_students', 'manage_content',
              'manage_assessments', 'view_analytics'
            )
          )
          or (
            tenant_app.is_enabled
            and tenant_app.status <> 'hidden'
            and staff_access.staff_id is not null
            and case p_capability
              when 'manage_students' then staff_access.can_manage_students
              when 'manage_content' then staff_access.can_manage_content
              when 'manage_assessments' then staff_access.can_manage_assessments
              when 'view_analytics' then staff_access.can_view_analytics
              else false
            end
          )
        )
    );
$$;

create or replace function private.current_user_has_app_capability(
  p_tenant_id uuid,
  p_app_id uuid,
  p_capability text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and coalesce(profile.status, 'active') = 'active'
      and (
        profile.global_role = 'platform_owner'
        or (
          profile.global_role = 'platform_deputy'
          and p_capability in ('manage_availability', 'manage_students', 'view_analytics')
        )
        or (
          profile.global_role = 'platform_admin'
          and p_capability in ('manage_content', 'manage_assessments', 'view_analytics')
        )
      )
  ) or private.current_staff_has_app_capability(
    p_tenant_id,
    p_app_id,
    p_capability
  );
$$;

create or replace function private.current_user_can_read_student_app(p_app_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and coalesce(profile.status, 'active') = 'active'
      and profile.global_role in (
        'platform_owner', 'platform_deputy', 'platform_admin',
        'platform_course_inspector'
      )
  ) or exists (
    select 1
    from public.profiles as profile
    join public.tenant_memberships as membership
      on membership.user_id = profile.id
    join public.tenant_student_apps as tenant_app
      on tenant_app.tenant_id = membership.tenant_id
     and tenant_app.app_id = p_app_id
    left join public.student_app_enrollments as enrollment
      on enrollment.tenant_id = membership.tenant_id
     and enrollment.student_id = membership.user_id
     and enrollment.app_id = tenant_app.app_id
    left join public.staff_app_assignments as staff_access
      on staff_access.tenant_id = membership.tenant_id
     and staff_access.staff_id = membership.user_id
     and staff_access.app_id = tenant_app.app_id
    where membership.tenant_id = private.current_tenant_id()
      and membership.user_id = (select auth.uid())
      and profile.id = membership.user_id
      and coalesce(profile.status, 'active') = 'active'
      and membership.status = 'active'
      and tenant_app.is_enabled
      and tenant_app.status = 'active'
      and (
        (
          membership.role = 'student'
          and enrollment.status = 'active'
          and enrollment.starts_at <= now()
          and (enrollment.ends_at is null or enrollment.ends_at > now())
        )
        or membership.role in ('ceo', 'tenant_super_admin')
        or (
          membership.role in ('teacher', 'admin')
          and staff_access.status = 'active'
        )
      )
  );
$$;

create or replace function private.current_teacher_has_student_app_access(
  p_tenant_id uuid,
  p_student_id uuid,
  p_app_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.current_staff_has_app_capability(
      p_tenant_id,
      p_app_id,
      'view_analytics'
    )
    and exists (
      select 1
      from public.tenant_student_assignments as assignment
      join public.student_app_enrollments as enrollment
        on enrollment.tenant_id = assignment.tenant_id
       and enrollment.student_id = assignment.student_id
       and enrollment.app_id = assignment.student_app_id
      where assignment.tenant_id = p_tenant_id
        and assignment.student_id = p_student_id
        and assignment.teacher_id = (select auth.uid())
        and assignment.student_app_id = p_app_id
        and enrollment.status = 'active'
        and enrollment.starts_at <= now()
        and (enrollment.ends_at is null or enrollment.ends_at > now())
    );
$$;

revoke all on function private.current_student_has_app_access(uuid, uuid, uuid) from public;
revoke all on function private.current_staff_has_app_capability(uuid, uuid, text) from public;
revoke all on function private.current_user_has_app_capability(uuid, uuid, text) from public;
revoke all on function private.current_user_can_read_student_app(uuid) from public;
revoke all on function private.current_teacher_has_student_app_access(uuid, uuid, uuid) from public;
grant execute on function private.current_student_has_app_access(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function private.current_staff_has_app_capability(uuid, uuid, text) to authenticated, service_role;
grant execute on function private.current_user_has_app_capability(uuid, uuid, text) to authenticated, service_role;
grant execute on function private.current_user_can_read_student_app(uuid) to authenticated, service_role;
grant execute on function private.current_teacher_has_student_app_access(uuid, uuid, uuid) to authenticated, service_role;

-- SECURITY DEFINER 学生写入函数会绕过 RLS，因此在事实表触发器中再次实时校验
-- “当前租户 + 当前学生 + 当前应用”。这样暂停应用授权后，旧页面或直接 RPC
-- 也不能继续写入学习数据。
create or replace function private.validate_student_app_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_student_id uuid;
  v_app_id uuid;
begin
  if auth.uid() is null or auth.role() = 'service_role' then
    return new;
  end if;

  if tg_table_name = 'conversation_practice_progress' then
    v_tenant_id := coalesce(new.tenant_id, private.current_tenant_id());
    v_student_id := new.user_id;
    select scenario.student_app_id into v_app_id
    from public.conversation_practice_scenarios as scenario
    where scenario.id = new.scenario_id
      and scenario.tenant_id = v_tenant_id;

  elsif tg_table_name = 'toolbox_practice_sessions' then
    v_tenant_id := coalesce(new.tenant_id, private.current_tenant_id());
    v_student_id := new.student_id;
    select exercise.student_app_id into v_app_id
    from public.growth_toolbox_exercises as exercise
    where exercise.id = new.exercise_id
      and (exercise.tenant_id is null or exercise.tenant_id = v_tenant_id);

  elsif tg_table_name = 'course_ebook_progress' then
    v_tenant_id := coalesce(new.tenant_id, private.current_tenant_id());
    v_student_id := new.student_id;
    select test.student_app_id into v_app_id
    from public.chapter_tests as test
    where test.slug = new.test_slug;

  elsif tg_table_name = 'chapter_test_attempts' then
    v_tenant_id := coalesce(new.tenant_id, private.current_tenant_id());
    v_student_id := new.student_id;
    select test.student_app_id into v_app_id
    from public.chapter_tests as test
    where test.id = new.test_id
      and test.slug = new.test_slug;

  elsif tg_table_name = 'lesson_progress' then
    v_tenant_id := coalesce(new.tenant_id, private.current_tenant_id());
    v_student_id := new.user_id;
    select course.student_app_id into v_app_id
    from public.courses as course
    where course.id = new.course_id
      and (course.tenant_id is null or course.tenant_id = v_tenant_id);

  elsif tg_table_name = 'learning_time_log' then
    v_tenant_id := coalesce(new.tenant_id, private.current_tenant_id());
    v_student_id := new.student_id;
    v_app_id := new.student_app_id;
  end if;

  -- 后台人员代学生维护数据仍由对应管理函数控制；这里只拦截学生本人写入。
  if v_student_id is distinct from auth.uid() then
    return new;
  end if;
  if v_app_id is null then
    raise exception '学习内容不存在或缺少应用归属';
  end if;
  if not private.current_student_has_app_access(
    v_tenant_id,
    v_student_id,
    v_app_id
  ) then
    raise exception '当前学生没有该应用的有效访问权限';
  end if;

  return new;
end;
$$;

drop trigger if exists conversation_progress_student_app_access
  on public.conversation_practice_progress;
create trigger conversation_progress_student_app_access
before insert or update of tenant_id, user_id, scenario_id
on public.conversation_practice_progress
for each row execute function private.validate_student_app_activity();

drop trigger if exists toolbox_session_student_app_access
  on public.toolbox_practice_sessions;
create trigger toolbox_session_student_app_access
before insert or update of tenant_id, student_id, exercise_id
on public.toolbox_practice_sessions
for each row execute function private.validate_student_app_activity();

drop trigger if exists ebook_progress_student_app_access
  on public.course_ebook_progress;
create trigger ebook_progress_student_app_access
before insert or update of tenant_id, student_id, test_slug
on public.course_ebook_progress
for each row execute function private.validate_student_app_activity();

drop trigger if exists chapter_attempt_student_app_access
  on public.chapter_test_attempts;
create trigger chapter_attempt_student_app_access
before insert or update of tenant_id, student_id, test_id, test_slug
on public.chapter_test_attempts
for each row execute function private.validate_student_app_activity();

drop trigger if exists lesson_progress_student_app_access
  on public.lesson_progress;
create trigger lesson_progress_student_app_access
before insert or update of tenant_id, user_id, course_id
on public.lesson_progress
for each row execute function private.validate_student_app_activity();

drop trigger if exists learning_time_student_app_access
  on public.learning_time_log;
create trigger learning_time_student_app_access
before insert or update of tenant_id, student_id, student_app_id
on public.learning_time_log
for each row execute function private.validate_student_app_activity();

create or replace function public.validate_student_teacher_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.student_id = new.teacher_id then
    raise exception '学生与负责老师不能是同一账号。';
  end if;

  if tg_op = 'UPDATE'
    and old.student_app_id is distinct from new.student_app_id then
    raise exception '师生关系的应用归属不可修改，请先解除后重新分配。';
  end if;

  if not exists (
    select 1
    from public.student_app_enrollments as enrollment
    where enrollment.tenant_id = new.tenant_id
      and enrollment.student_id = new.student_id
      and enrollment.app_id = new.student_app_id
      and enrollment.status = 'active'
      and enrollment.starts_at <= now()
      and (enrollment.ends_at is null or enrollment.ends_at > now())
  ) then
    raise exception '目标学生当前未开通该应用。';
  end if;

  if not exists (
    select 1
    from public.staff_app_assignments as staff_access
    where staff_access.tenant_id = new.tenant_id
      and staff_access.staff_id = new.teacher_id
      and staff_access.app_id = new.student_app_id
      and staff_access.status = 'active'
      and staff_access.access_role in ('teacher', 'operator', 'administrator')
      and staff_access.can_view_analytics
  ) then
    raise exception '目标老师没有该应用的有效教学权限。';
  end if;

  return new;
end;
$$;

-- ============================================================
-- 授权写入只能通过已认证 RPC，避免 service_role 绕过 RLS 后丢失 actor。
-- ============================================================

create or replace function public.set_student_application_enrollment(
  p_student_id uuid,
  p_app_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_tier text;
begin
  if v_tenant_id is null
    or not private.current_staff_has_app_capability(
      v_tenant_id, p_app_id, 'manage_students'
    ) then
    raise exception '当前账号没有管理该应用学生的权限';
  end if;
  if p_status not in ('active', 'paused', 'completed', 'cancelled') then
    raise exception '学生应用状态不正确';
  end if;

  select membership.membership_tier into v_tier
  from public.tenant_memberships as membership
  where membership.tenant_id = v_tenant_id
    and membership.user_id = p_student_id
    and membership.role = 'student'
    and membership.status = 'active';
  if not found then
    raise exception '目标账号不是当前机构的有效学生';
  end if;

  insert into public.student_app_enrollments (
    tenant_id, student_id, app_id, status, access_tier, enrolled_by
  ) values (
    v_tenant_id, p_student_id, p_app_id, p_status, v_tier, auth.uid()
  )
  on conflict (tenant_id, student_id, app_id) do update
  set status = excluded.status,
      access_tier = excluded.access_tier,
      enrolled_by = auth.uid(),
      updated_at = now();
end;
$$;

create or replace function public.set_staff_application_access(
  p_staff_id uuid,
  p_app_id uuid,
  p_status text,
  p_access_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := private.current_tenant_id();
begin
  if v_tenant_id is null
    or not private.current_staff_has_app_capability(
      v_tenant_id, p_app_id, 'manage_availability'
    ) then
    raise exception '只有机构负责人可以调整员工应用权限';
  end if;
  if p_status not in ('active', 'inactive') then
    raise exception '员工应用状态不正确';
  end if;
  if p_access_role not in ('administrator', 'operator', 'teacher', 'viewer') then
    raise exception '员工应用角色不正确';
  end if;
  if not exists (
    select 1
    from public.tenant_memberships as membership
    where membership.tenant_id = v_tenant_id
      and membership.user_id = p_staff_id
      and membership.role in ('teacher', 'admin', 'ceo', 'tenant_super_admin')
      and membership.status = 'active'
  ) then
    raise exception '目标账号不是当前机构的有效员工';
  end if;

  insert into public.staff_app_assignments (
    tenant_id, staff_id, app_id, access_role,
    can_manage_students, can_manage_content, can_manage_assessments,
    can_view_analytics, status, assigned_by
  ) values (
    v_tenant_id,
    p_staff_id,
    p_app_id,
    p_access_role,
    p_access_role in ('administrator', 'operator'),
    p_access_role = 'administrator',
    p_access_role in ('administrator', 'operator', 'teacher'),
    true,
    p_status,
    auth.uid()
  )
  on conflict (tenant_id, staff_id, app_id) do update
  set access_role = excluded.access_role,
      can_manage_students = excluded.can_manage_students,
      can_manage_content = excluded.can_manage_content,
      can_manage_assessments = excluded.can_manage_assessments,
      can_view_analytics = excluded.can_view_analytics,
      status = excluded.status,
      assigned_by = auth.uid(),
      updated_at = now();
end;
$$;

create or replace function public.set_application_teacher_assignment(
  p_student_id uuid,
  p_teacher_id uuid,
  p_app_id uuid,
  p_operation text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := private.current_tenant_id();
begin
  if v_tenant_id is null
    or not private.current_staff_has_app_capability(
      v_tenant_id, p_app_id, 'manage_students'
    ) then
    raise exception '当前账号没有管理该应用师生关系的权限';
  end if;
  if p_operation = 'remove' then
    delete from public.tenant_student_assignments
    where tenant_id = v_tenant_id
      and student_id = p_student_id
      and teacher_id = p_teacher_id
      and student_app_id = p_app_id;
  elsif p_operation = 'assign' then
    insert into public.tenant_student_assignments (
      tenant_id, student_id, teacher_id, student_app_id, assigned_by
    ) values (
      v_tenant_id, p_student_id, p_teacher_id, p_app_id, auth.uid()
    )
    on conflict (tenant_id, student_id, teacher_id, student_app_id) do nothing;
  else
    raise exception '师生分配操作不正确';
  end if;
end;
$$;

create or replace function public.set_tenant_application_settings(
  p_app_id uuid,
  p_is_enabled boolean,
  p_status text,
  p_custom_title text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_custom_title text := nullif(btrim(coalesce(p_custom_title, '')), '');
begin
  if v_tenant_id is null
    or not private.current_staff_has_app_capability(
      v_tenant_id, p_app_id, 'manage_availability'
    ) then
    raise exception '只有机构负责人可以修改应用开放设置';
  end if;
  if p_status not in ('active', 'coming_soon', 'hidden') then
    raise exception '机构应用状态不正确';
  end if;
  if char_length(coalesce(v_custom_title, '')) > 80 then
    raise exception '应用显示名称不能超过 80 个字';
  end if;

  update public.tenant_student_apps
  set is_enabled = p_is_enabled,
      status = p_status,
      custom_title = v_custom_title,
      updated_at = now()
  where tenant_id = v_tenant_id
    and app_id = p_app_id;
  if not found then
    raise exception '当前机构没有注册该应用';
  end if;
end;
$$;

revoke all on function public.set_student_application_enrollment(uuid, uuid, text) from public;
revoke all on function public.set_staff_application_access(uuid, uuid, text, text) from public;
revoke all on function public.set_application_teacher_assignment(uuid, uuid, uuid, text) from public;
revoke all on function public.set_tenant_application_settings(uuid, boolean, text, text) from public;
grant execute on function public.set_student_application_enrollment(uuid, uuid, text) to authenticated;
grant execute on function public.set_staff_application_access(uuid, uuid, text, text) to authenticated;
grant execute on function public.set_application_teacher_assignment(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.set_tenant_application_settings(uuid, boolean, text, text) to authenticated;

revoke insert, update, delete on public.student_app_enrollments from authenticated;
revoke insert, update, delete on public.staff_app_assignments from authenticated;
revoke update on public.tenant_student_apps from authenticated;

-- 师生应用关系也属于授权变更，纳入同一审计表。
alter table public.application_access_audit_logs
  drop constraint if exists application_access_audit_logs_subject_type_check;
alter table public.application_access_audit_logs
  add constraint application_access_audit_logs_subject_type_check
  check (subject_type in ('student', 'staff', 'tenant_app', 'teacher_assignment'));

create or replace function private.audit_application_access_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_app_id uuid;
  v_subject_type text;
  v_subject_user_id uuid;
begin
  if tg_op = 'DELETE' then
    v_tenant_id := old.tenant_id;
    v_app_id := case
      when tg_table_name = 'tenant_student_assignments' then old.student_app_id
      else old.app_id
    end;
  else
    v_tenant_id := new.tenant_id;
    v_app_id := case
      when tg_table_name = 'tenant_student_assignments' then new.student_app_id
      else new.app_id
    end;
  end if;

  v_subject_type := case tg_table_name
    when 'student_app_enrollments' then 'student'
    when 'staff_app_assignments' then 'staff'
    when 'tenant_student_assignments' then 'teacher_assignment'
    else 'tenant_app'
  end;
  v_subject_user_id := case tg_table_name
    when 'student_app_enrollments' then case
      when tg_op = 'DELETE' then old.student_id else new.student_id
    end
    when 'staff_app_assignments' then case
      when tg_op = 'DELETE' then old.staff_id else new.staff_id
    end
    when 'tenant_student_assignments' then case
      when tg_op = 'DELETE' then old.student_id else new.student_id
    end
    else null
  end;

  insert into public.application_access_audit_logs (
    tenant_id, app_id, actor_id, subject_type, subject_user_id,
    operation, before_data, after_data
  ) values (
    v_tenant_id,
    v_app_id,
    auth.uid(),
    v_subject_type,
    v_subject_user_id,
    lower(tg_op),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists tenant_student_assignments_app_audit
  on public.tenant_student_assignments;
create trigger tenant_student_assignments_app_audit
after insert or update or delete on public.tenant_student_assignments
for each row execute function private.audit_application_access_change();

-- 授权表的 RLS 也使用与服务端页面相同的“租户 + 应用 + capability”判断。
drop policy if exists "application managers manage student enrollments"
  on public.student_app_enrollments;
create policy "application managers manage student enrollments"
on public.student_app_enrollments for all to authenticated
using (
  private.current_user_has_app_capability(
    tenant_id, app_id, 'manage_students'
  )
)
with check (
  private.current_user_has_app_capability(
    tenant_id, app_id, 'manage_students'
  )
);

drop policy if exists "application staff read student enrollments"
  on public.student_app_enrollments;
create policy "application staff read student enrollments"
on public.student_app_enrollments for select to authenticated
using (
  private.current_user_has_app_capability(
    tenant_id, app_id, 'manage_students'
  )
  or private.current_user_has_app_capability(
    tenant_id, app_id, 'view_analytics'
  )
);

drop policy if exists "teachers read assigned student app enrollments"
  on public.student_app_enrollments;
create policy "teachers read assigned student app enrollments"
on public.student_app_enrollments for select to authenticated
using (
  private.current_teacher_has_student_app_access(
    tenant_id, student_id, app_id
  )
);

drop policy if exists "application executives manage staff assignments"
  on public.staff_app_assignments;
create policy "application executives manage staff assignments"
on public.staff_app_assignments for all to authenticated
using (
  private.current_user_has_app_capability(
    tenant_id, app_id, 'manage_availability'
  )
)
with check (
  private.current_user_has_app_capability(
    tenant_id, app_id, 'manage_availability'
  )
);

drop policy if exists "application managers update tenant apps"
  on public.tenant_student_apps;
create policy "application managers update tenant apps"
on public.tenant_student_apps for update to authenticated
using (
  private.current_user_has_app_capability(
    tenant_id, app_id, 'manage_availability'
  )
)
with check (
  private.current_user_has_app_capability(
    tenant_id, app_id, 'manage_availability'
  )
);

drop policy if exists "teachers read own assigned students"
  on public.tenant_student_assignments;
create policy "teachers read own assigned students"
on public.tenant_student_assignments for select to authenticated
using (
  teacher_id = (select auth.uid())
  and private.current_teacher_has_student_app_access(
    tenant_id, student_id, student_app_id
  )
);

drop policy if exists "tenant owner manages student assignments"
  on public.tenant_student_assignments;
create policy "application managers manage student assignments"
on public.tenant_student_assignments for all to authenticated
using (
  private.current_user_has_app_capability(
    tenant_id, student_app_id, 'manage_students'
  )
)
with check (
  private.current_user_has_app_capability(
    tenant_id, student_app_id, 'manage_students'
  )
);

-- 已发布平台课程不再对所有登录账号全局开放，必须拥有该应用的实时访问权。
drop policy if exists "authenticated users read published platform course categories"
  on public.course_categories;
create policy "authenticated users read published platform course categories"
on public.course_categories for select to authenticated
using (
  content_scope = 'platform'
  and is_published
  and private.current_user_can_read_student_app(student_app_id)
);

drop policy if exists "authenticated users read published platform courses"
  on public.courses;
create policy "authenticated users read published platform courses"
on public.courses for select to authenticated
using (
  content_scope = 'platform'
  and is_published
  and private.current_user_can_read_student_app(student_app_id)
);

drop policy if exists "authenticated users read published platform lessons"
  on public.lessons;
create policy "authenticated users read published platform lessons"
on public.lessons for select to authenticated
using (
  content_scope = 'platform'
  and is_published
  and exists (
    select 1
    from public.courses as course
    where course.id = lessons.course_id
      and private.current_user_can_read_student_app(course.student_app_id)
  )
);

drop policy if exists "authenticated users read published platform lesson resources"
  on public.lesson_resources;
create policy "authenticated users read published platform lesson resources"
on public.lesson_resources for select to authenticated
using (
  content_scope = 'platform'
  and is_published
  and exists (
    select 1
    from public.lessons as lesson
    join public.courses as course on course.id = lesson.course_id
    where lesson.id = lesson_resources.lesson_id
      and private.current_user_can_read_student_app(course.student_app_id)
  )
);

drop policy if exists "authenticated users read published platform course chapters"
  on public.course_chapters;
create policy "authenticated users read published platform course chapters"
on public.course_chapters for select to authenticated
using (
  content_scope = 'platform'
  and is_published
  and exists (
    select 1
    from public.lessons as lesson
    join public.courses as course on course.id = lesson.course_id
    where lesson.id = course_chapters.lesson_id
      and lesson.is_published
      and course.is_published
      and private.current_user_can_read_student_app(course.student_app_id)
  )
);

-- 机构自建课程同样按应用过滤；管理员查看草稿也要具备该应用内容权限。
drop policy if exists "tenant members read published course categories"
  on public.course_categories;
create policy "tenant members read published course categories"
on public.course_categories for select to authenticated
using (
  (
    tenant_id = (select private.current_tenant_id())
    and (
      (is_published and private.current_user_can_read_student_app(student_app_id))
      or private.current_staff_has_app_capability(
        tenant_id, student_app_id, 'manage_content'
      )
    )
  )
  or (select private.is_platform_owner())
);

drop policy if exists "tenant members read published courses"
  on public.courses;
create policy "tenant members read published courses"
on public.courses for select to authenticated
using (
  (
    tenant_id = (select private.current_tenant_id())
    and (
      (is_published and private.current_user_can_read_student_app(student_app_id))
      or private.current_staff_has_app_capability(
        tenant_id, student_app_id, 'manage_content'
      )
    )
  )
  or (select private.is_platform_owner())
);

drop policy if exists "tenant members read published lessons"
  on public.lessons;
create policy "tenant members read published lessons"
on public.lessons for select to authenticated
using (
  (
    tenant_id = (select private.current_tenant_id())
    and exists (
      select 1
      from public.courses as course
      where course.id = lessons.course_id
        and (
          (lessons.is_published and private.current_user_can_read_student_app(course.student_app_id))
          or private.current_staff_has_app_capability(
            lessons.tenant_id, course.student_app_id, 'manage_content'
          )
        )
    )
  )
  or (select private.is_platform_owner())
);

drop policy if exists "tenant members read published lesson resources"
  on public.lesson_resources;
create policy "tenant members read published lesson resources"
on public.lesson_resources for select to authenticated
using (
  (
    tenant_id = (select private.current_tenant_id())
    and exists (
      select 1
      from public.lessons as lesson
      join public.courses as course on course.id = lesson.course_id
      where lesson.id = lesson_resources.lesson_id
        and (
          (lesson_resources.is_published and private.current_user_can_read_student_app(course.student_app_id))
          or private.current_staff_has_app_capability(
            lesson_resources.tenant_id, course.student_app_id, 'manage_content'
          )
        )
    )
  )
  or (select private.is_platform_owner())
);

drop policy if exists "tenant members read published course chapters"
  on public.course_chapters;
create policy "tenant members read published course chapters"
on public.course_chapters for select to authenticated
using (
  (
    tenant_id = (select private.current_tenant_id())
    and exists (
      select 1
      from public.lessons as lesson
      join public.courses as course on course.id = lesson.course_id
      where lesson.id = course_chapters.lesson_id
        and (
          (
            course_chapters.is_published
            and lesson.is_published
            and course.is_published
            and private.current_user_can_read_student_app(course.student_app_id)
          )
          or private.current_staff_has_app_capability(
            course_chapters.tenant_id,
            course.student_app_id,
            'manage_content'
          )
        )
    )
  )
  or (select private.is_platform_owner())
);

-- 机构课程写策略也必须绑定目标应用，撤销某应用的内容权限后不能通过
-- Supabase 客户端直接修改该应用的分类或后代节点。
drop policy if exists "tenant admins manage course categories"
  on public.course_categories;
create policy "application content managers manage course categories"
on public.course_categories for all to authenticated
using (
  (
    tenant_id = (select private.current_tenant_id())
    and private.current_staff_has_app_capability(
      tenant_id, student_app_id, 'manage_content'
    )
  )
  or (select private.is_platform_owner())
)
with check (
  (
    tenant_id = (select private.current_tenant_id())
    and private.current_staff_has_app_capability(
      tenant_id, student_app_id, 'manage_content'
    )
  )
  or (select private.is_platform_owner())
);

drop policy if exists "tenant admins manage courses"
  on public.courses;
create policy "application content managers manage courses"
on public.courses for all to authenticated
using (
  (
    tenant_id = (select private.current_tenant_id())
    and private.current_staff_has_app_capability(
      tenant_id, student_app_id, 'manage_content'
    )
  )
  or (select private.is_platform_owner())
)
with check (
  (
    tenant_id = (select private.current_tenant_id())
    and private.current_staff_has_app_capability(
      tenant_id, student_app_id, 'manage_content'
    )
  )
  or (select private.is_platform_owner())
);

drop policy if exists "tenant admins manage lessons"
  on public.lessons;
create policy "application content managers manage lessons"
on public.lessons for all to authenticated
using (
  (
    tenant_id = (select private.current_tenant_id())
    and exists (
      select 1
      from public.courses as course
      where course.id = lessons.course_id
        and private.current_staff_has_app_capability(
          lessons.tenant_id, course.student_app_id, 'manage_content'
        )
    )
  )
  or (select private.is_platform_owner())
)
with check (
  (
    tenant_id = (select private.current_tenant_id())
    and exists (
      select 1
      from public.courses as course
      where course.id = lessons.course_id
        and private.current_staff_has_app_capability(
          lessons.tenant_id, course.student_app_id, 'manage_content'
        )
    )
  )
  or (select private.is_platform_owner())
);

drop policy if exists "tenant admins manage course chapters"
  on public.course_chapters;
create policy "application content managers manage course chapters"
on public.course_chapters for all to authenticated
using (
  (
    tenant_id = (select private.current_tenant_id())
    and exists (
      select 1
      from public.lessons as lesson
      join public.courses as course on course.id = lesson.course_id
      where lesson.id = course_chapters.lesson_id
        and private.current_staff_has_app_capability(
          course_chapters.tenant_id, course.student_app_id, 'manage_content'
        )
    )
  )
  or (select private.is_platform_owner())
)
with check (
  (
    tenant_id = (select private.current_tenant_id())
    and exists (
      select 1
      from public.lessons as lesson
      join public.courses as course on course.id = lesson.course_id
      where lesson.id = course_chapters.lesson_id
        and private.current_staff_has_app_capability(
          course_chapters.tenant_id, course.student_app_id, 'manage_content'
        )
    )
  )
  or (select private.is_platform_owner())
);

drop policy if exists "tenant admins insert lesson resources"
  on public.lesson_resources;
drop policy if exists "tenant admins update lesson resources"
  on public.lesson_resources;
drop policy if exists "tenant owner deletes lesson resources"
  on public.lesson_resources;
create policy "application content managers manage lesson resources"
on public.lesson_resources for all to authenticated
using (
  (
    tenant_id = (select private.current_tenant_id())
    and exists (
      select 1
      from public.lessons as lesson
      join public.courses as course on course.id = lesson.course_id
      where lesson.id = lesson_resources.lesson_id
        and private.current_staff_has_app_capability(
          lesson_resources.tenant_id, course.student_app_id, 'manage_content'
        )
    )
  )
  or (select private.is_platform_owner())
)
with check (
  (
    tenant_id = (select private.current_tenant_id())
    and exists (
      select 1
      from public.lessons as lesson
      join public.courses as course on course.id = lesson.course_id
      where lesson.id = lesson_resources.lesson_id
        and private.current_staff_has_app_capability(
          lesson_resources.tenant_id, course.student_app_id, 'manage_content'
        )
    )
  )
  or (select private.is_platform_owner())
);

drop policy if exists "standard question groups are readable by authorized staff"
  on public.chapter_tests;
create policy "standard question groups are readable by authorized staff"
on public.chapter_tests for select to authenticated
using (
  (select private.can_manage_standard_question_bank())
  or (
    status = 'published'
    and private.current_user_has_app_capability(
      private.current_tenant_id(),
      student_app_id,
      'manage_assessments'
    )
  )
);

drop policy if exists "standard questions are readable by authorized staff"
  on public.chapter_test_questions;
create policy "standard questions are readable by authorized staff"
on public.chapter_test_questions for select to authenticated
using (
  (select private.can_manage_standard_question_bank())
  or (
    status = 'published'
    and exists (
      select 1
      from public.chapter_tests as test
      where test.id = chapter_test_questions.test_id
        and test.status = 'published'
        and private.current_user_has_app_capability(
          private.current_tenant_id(),
          test.student_app_id,
          'manage_assessments'
        )
    )
  )
);

drop policy if exists "authorized staff read assessment papers"
  on public.assessment_papers;
create policy "authorized staff read assessment papers"
on public.assessment_papers for select to authenticated
using (
  public.current_user_can_manage_assessment_papers()
  or (
    status = 'published'
    and private.current_user_has_app_capability(
      private.current_tenant_id(),
      student_app_id,
      'manage_assessments'
    )
  )
);

drop policy if exists "authorized staff read assessment paper questions"
  on public.assessment_paper_questions;
create policy "authorized staff read assessment paper questions"
on public.assessment_paper_questions for select to authenticated
using (
  exists (
    select 1
    from public.assessment_papers as paper
    where paper.id = assessment_paper_questions.paper_id
      and (
        public.current_user_can_manage_assessment_papers()
        or (
          paper.status = 'published'
          and private.current_user_has_app_capability(
            private.current_tenant_id(),
            paper.student_app_id,
            'manage_assessments'
          )
        )
      )
  )
);

-- 互动教材目录和所有后代节点都沿 textbook.student_app_id 判定。
drop policy if exists "authenticated read textbook catalog"
  on public.digital_textbooks;
create policy "authenticated read textbook catalog"
on public.digital_textbooks for select to authenticated
using (
  public.current_user_can_manage_standard_question_bank()
  or (
    status = 'published'
    and private.current_user_can_read_student_app(student_app_id)
  )
);

drop policy if exists "authenticated read textbook versions"
  on public.digital_textbook_versions;
create policy "authenticated read textbook versions"
on public.digital_textbook_versions for select to authenticated
using (
  public.current_user_can_manage_standard_question_bank()
  or (
    status = 'published'
    and exists (
      select 1
      from public.digital_textbooks as textbook
      where textbook.id = digital_textbook_versions.textbook_id
        and textbook.status = 'published'
        and private.current_user_can_read_student_app(textbook.student_app_id)
    )
  )
);

drop policy if exists "authenticated read textbook chapters"
  on public.digital_textbook_chapters;
create policy "authenticated read textbook chapters"
on public.digital_textbook_chapters for select to authenticated
using (
  public.current_user_can_manage_standard_question_bank()
  or (
    status = 'published'
    and exists (
      select 1
      from public.digital_textbook_versions as version
      join public.digital_textbooks as textbook on textbook.id = version.textbook_id
      where version.id = digital_textbook_chapters.version_id
        and version.status = 'published'
        and textbook.status = 'published'
        and private.current_user_can_read_student_app(textbook.student_app_id)
    )
  )
);

drop policy if exists "authenticated read textbook modules"
  on public.digital_textbook_modules;
create policy "authenticated read textbook modules"
on public.digital_textbook_modules for select to authenticated
using (
  public.current_user_can_manage_standard_question_bank()
  or exists (
    select 1
    from public.digital_textbook_chapters as chapter
    join public.digital_textbook_versions as version on version.id = chapter.version_id
    join public.digital_textbooks as textbook on textbook.id = version.textbook_id
    where chapter.id = digital_textbook_modules.chapter_id
      and chapter.status = 'published'
      and version.status = 'published'
      and textbook.status = 'published'
      and private.current_user_can_read_student_app(textbook.student_app_id)
  )
);

drop policy if exists "authenticated read textbook nodes"
  on public.digital_textbook_nodes;
create policy "authenticated read textbook nodes"
on public.digital_textbook_nodes for select to authenticated
using (
  public.current_user_can_manage_standard_question_bank()
  or exists (
    select 1
    from public.digital_textbook_modules as module
    join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
    join public.digital_textbook_versions as version on version.id = chapter.version_id
    join public.digital_textbooks as textbook on textbook.id = version.textbook_id
    where module.id = digital_textbook_nodes.module_id
      and chapter.status = 'published'
      and version.status = 'published'
      and textbook.status = 'published'
      and private.current_user_can_read_student_app(textbook.student_app_id)
  )
);

drop policy if exists "authenticated read textbook activities"
  on public.digital_textbook_activities;
create policy "authenticated read textbook activities"
on public.digital_textbook_activities for select to authenticated
using (
  public.current_user_can_manage_standard_question_bank()
  or exists (
    select 1
    from public.digital_textbook_nodes as node
    join public.digital_textbook_modules as module on module.id = node.module_id
    join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
    join public.digital_textbook_versions as version on version.id = chapter.version_id
    join public.digital_textbooks as textbook on textbook.id = version.textbook_id
    where node.id = digital_textbook_activities.node_id
      and chapter.status = 'published'
      and version.status = 'published'
      and textbook.status = 'published'
      and private.current_user_can_read_student_app(textbook.student_app_id)
  )
);

create or replace function private.current_student_can_use_textbook_activity(
  p_tenant_id uuid,
  p_student_id uuid,
  p_activity_id uuid,
  p_version_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.digital_textbook_activities as activity
    join public.digital_textbook_nodes as node on node.id = activity.node_id
    join public.digital_textbook_modules as module on module.id = node.module_id
    join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
    join public.digital_textbook_versions as chapter_version
      on chapter_version.id = chapter.version_id
    join public.digital_textbooks as textbook
      on textbook.id = chapter_version.textbook_id
    join public.digital_textbook_versions as requested_version
      on requested_version.id = p_version_id
     and requested_version.id = chapter_version.id
    where activity.id = p_activity_id
      and chapter.status = 'published'
      and requested_version.status = 'published'
      and textbook.status = 'published'
      and private.current_student_has_app_access(
        p_tenant_id, p_student_id, textbook.student_app_id
      )
  );
$$;

create or replace function private.current_student_can_use_textbook_node(
  p_tenant_id uuid,
  p_student_id uuid,
  p_node_id uuid,
  p_version_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.digital_textbook_nodes as node
    join public.digital_textbook_modules as module on module.id = node.module_id
    join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
    join public.digital_textbook_versions as chapter_version
      on chapter_version.id = chapter.version_id
    join public.digital_textbooks as textbook
      on textbook.id = chapter_version.textbook_id
    join public.digital_textbook_versions as requested_version
      on requested_version.id = p_version_id
     and requested_version.id = chapter_version.id
    where node.id = p_node_id
      and chapter.status = 'published'
      and requested_version.status = 'published'
      and textbook.status = 'published'
      and private.current_student_has_app_access(
        p_tenant_id, p_student_id, textbook.student_app_id
      )
  );
$$;

revoke all on function private.current_student_can_use_textbook_activity(uuid, uuid, uuid, uuid) from public;
revoke all on function private.current_student_can_use_textbook_node(uuid, uuid, uuid, uuid) from public;
grant execute on function private.current_student_can_use_textbook_activity(uuid, uuid, uuid, uuid) to authenticated, service_role;
grant execute on function private.current_student_can_use_textbook_node(uuid, uuid, uuid, uuid) to authenticated, service_role;

drop policy if exists "students manage own textbook preferences"
  on public.digital_textbook_preferences;
create policy "students manage own textbook preferences"
on public.digital_textbook_preferences for all to authenticated
using (
  student_id = (select auth.uid())
  and exists (
    select 1
    from public.digital_textbooks as textbook
    where textbook.id = digital_textbook_preferences.textbook_id
      and private.current_student_has_app_access(
        digital_textbook_preferences.tenant_id,
        digital_textbook_preferences.student_id,
        textbook.student_app_id
      )
  )
)
with check (
  student_id = (select auth.uid())
  and exists (
    select 1
    from public.digital_textbooks as textbook
    where textbook.id = digital_textbook_preferences.textbook_id
      and private.current_student_has_app_access(
        digital_textbook_preferences.tenant_id,
        digital_textbook_preferences.student_id,
        textbook.student_app_id
      )
  )
);

drop policy if exists "students read own textbook attempts"
  on public.digital_textbook_attempts;
create policy "students read own textbook attempts"
on public.digital_textbook_attempts for select to authenticated
using (
  student_id = (select auth.uid())
  and private.current_student_can_use_textbook_activity(
    tenant_id, student_id, activity_id, version_id
  )
);

drop policy if exists "students create own textbook attempts"
  on public.digital_textbook_attempts;
create policy "students create own textbook attempts"
on public.digital_textbook_attempts for insert to authenticated
with check (
  student_id = (select auth.uid())
  and private.current_student_can_use_textbook_activity(
    tenant_id, student_id, activity_id, version_id
  )
);

drop policy if exists "students manage own textbook progress"
  on public.digital_textbook_node_progress;
create policy "students manage own textbook progress"
on public.digital_textbook_node_progress for all to authenticated
using (
  student_id = (select auth.uid())
  and private.current_student_can_use_textbook_node(
    tenant_id, student_id, node_id, version_id
  )
)
with check (
  student_id = (select auth.uid())
  and private.current_student_can_use_textbook_node(
    tenant_id, student_id, node_id, version_id
  )
);

-- 成长工具箱的目录、题目与练习事实此前只校验“已登录”。现在全部沿
-- exercise/item.student_app_id 或 session.student_app_id 继承同一应用边界。
drop policy if exists "authenticated read growth toolbox items"
  on public.growth_toolbox_items;
create policy "application users read growth toolbox items"
on public.growth_toolbox_items for select to authenticated
using (
  private.current_user_can_read_student_app(student_app_id)
  or private.current_user_has_app_capability(
    private.current_tenant_id(), student_app_id, 'manage_content'
  )
);

drop policy if exists "authenticated read growth toolbox vocabulary"
  on public.growth_toolbox_vocabulary;
create policy "application users read growth toolbox vocabulary"
on public.growth_toolbox_vocabulary for select to authenticated
using (
  private.current_user_can_read_student_app(student_app_id)
  or private.current_user_has_app_capability(
    private.current_tenant_id(), student_app_id, 'manage_content'
  )
);

drop policy if exists "authenticated read growth toolbox grammar"
  on public.growth_toolbox_grammar;
create policy "application users read growth toolbox grammar"
on public.growth_toolbox_grammar for select to authenticated
using (
  private.current_user_can_read_student_app(student_app_id)
  or private.current_user_has_app_capability(
    private.current_tenant_id(), student_app_id, 'manage_content'
  )
);

drop policy if exists "authenticated read published toolbox exercises"
  on public.growth_toolbox_exercises;
create policy "application users read toolbox exercises"
on public.growth_toolbox_exercises for select to authenticated
using (
  (
    status = 'published'
    and (tenant_id is null or tenant_id = (select private.current_tenant_id()))
    and private.current_user_can_read_student_app(student_app_id)
  )
  or private.current_user_has_app_capability(
    tenant_id, student_app_id, 'manage_content'
  )
);

drop policy if exists "authenticated read published toolbox questions"
  on public.growth_toolbox_questions;
create policy "application users read toolbox questions"
on public.growth_toolbox_questions for select to authenticated
using (
  exists (
    select 1
    from public.growth_toolbox_exercises as exercise
    where exercise.id = growth_toolbox_questions.exercise_id
      and (
        (
          exercise.status = 'published'
          and (exercise.tenant_id is null or exercise.tenant_id = (select private.current_tenant_id()))
          and private.current_user_can_read_student_app(exercise.student_app_id)
        )
        or private.current_user_has_app_capability(
          exercise.tenant_id, exercise.student_app_id, 'manage_content'
        )
      )
  )
);

drop policy if exists "students read own toolbox sessions"
  on public.toolbox_practice_sessions;
create policy "application users read toolbox sessions"
on public.toolbox_practice_sessions for select to authenticated
using (
  private.current_student_has_app_access(
    tenant_id, student_id, student_app_id
  )
  or private.current_teacher_has_student_app_access(
    tenant_id, student_id, student_app_id
  )
  or private.current_staff_has_app_capability(
    tenant_id, student_app_id, 'view_analytics'
  )
);

drop policy if exists "students read own toolbox attempts"
  on public.toolbox_practice_attempts;
create policy "application users read toolbox attempts"
on public.toolbox_practice_attempts for select to authenticated
using (
  exists (
    select 1
    from public.toolbox_practice_sessions as session
    where session.id = toolbox_practice_attempts.session_id
      and session.tenant_id = toolbox_practice_attempts.tenant_id
      and session.student_id = toolbox_practice_attempts.student_id
      and (
        private.current_student_has_app_access(
          session.tenant_id, session.student_id, session.student_app_id
        )
        or private.current_teacher_has_student_app_access(
          session.tenant_id, session.student_id, session.student_app_id
        )
        or private.current_staff_has_app_capability(
          session.tenant_id, session.student_app_id, 'view_analytics'
        )
      )
  )
);

drop policy if exists "students read own toolbox evaluations"
  on public.toolbox_practice_evaluations;
create policy "application users read toolbox evaluations"
on public.toolbox_practice_evaluations for select to authenticated
using (
  exists (
    select 1
    from public.toolbox_practice_attempts as attempt
    join public.toolbox_practice_sessions as session
      on session.id = attempt.session_id
     and session.tenant_id = attempt.tenant_id
     and session.student_id = attempt.student_id
    where attempt.id = toolbox_practice_evaluations.attempt_id
      and attempt.tenant_id = toolbox_practice_evaluations.tenant_id
      and (
        private.current_student_has_app_access(
          session.tenant_id, session.student_id, session.student_app_id
        )
        or private.current_teacher_has_student_app_access(
          session.tenant_id, session.student_id, session.student_app_id
        )
        or private.current_staff_has_app_capability(
          session.tenant_id, session.student_app_id, 'view_analytics'
        )
      )
  )
);

-- 教师读取事实数据时，每次都重新校验员工应用权限、学生应用授权和师生关系。
drop policy if exists "teachers read lesson progress of their assigned students"
  on public.lesson_progress;
create policy "teachers read lesson progress of their assigned students"
on public.lesson_progress for select to authenticated
using (
  exists (
    select 1
    from public.courses as course
    where course.id = lesson_progress.course_id
      and private.current_teacher_has_student_app_access(
        lesson_progress.tenant_id,
        lesson_progress.user_id,
        course.student_app_id
      )
  )
);

drop policy if exists "teachers read ebook progress of their assigned students"
  on public.course_ebook_progress;
create policy "teachers read ebook progress of their assigned students"
on public.course_ebook_progress for select to authenticated
using (
  private.current_teacher_has_student_app_access(
    tenant_id, student_id, student_app_id
  )
);

drop policy if exists "teachers read notes of their assigned students"
  on public.learning_record_notes;
create policy "teachers read notes of their assigned students"
on public.learning_record_notes for select to authenticated
using (
  private.current_teacher_has_student_app_access(
    tenant_id, student_id, student_app_id
  )
);

drop policy if exists "teachers read submissions of their assigned students"
  on public.learning_submissions;
create policy "teachers read submissions of their assigned students"
on public.learning_submissions for select to authenticated
using (
  exists (
    select 1
    from public.learning_assignments as assignment
    where assignment.id = learning_submissions.assignment_id
      and assignment.tenant_id = learning_submissions.tenant_id
      and private.current_teacher_has_student_app_access(
        learning_submissions.tenant_id,
        learning_submissions.student_id,
        assignment.student_app_id
      )
  )
);

drop policy if exists "teachers read test attempts of their assigned students"
  on public.chapter_test_attempts;
create policy "teachers read test attempts of their assigned students"
on public.chapter_test_attempts for select to authenticated
using (
  exists (
    select 1
    from public.chapter_tests as test
    where test.slug = chapter_test_attempts.test_slug
      and private.current_teacher_has_student_app_access(
        chapter_test_attempts.tenant_id,
        chapter_test_attempts.student_id,
        test.student_app_id
      )
  )
);

drop policy if exists "teachers read progress of their assigned students"
  on public.conversation_practice_progress;
create policy "teachers read progress of their assigned students"
on public.conversation_practice_progress for select to authenticated
using (
  exists (
    select 1
    from public.conversation_practice_scenarios as scenario
    where scenario.id = conversation_practice_progress.scenario_id
      and private.current_teacher_has_student_app_access(
        conversation_practice_progress.tenant_id,
        conversation_practice_progress.user_id,
        scenario.student_app_id
      )
  )
);

drop policy if exists "teachers read grade reviews of their assigned students"
  on public.grade_review_requests;
create policy "teachers read grade reviews of their assigned students"
on public.grade_review_requests for select to authenticated
using (
  exists (
    select 1
    from public.tenant_student_assignments as app_assignment
    where app_assignment.tenant_id = grade_review_requests.tenant_id
      and app_assignment.student_id = grade_review_requests.student_id
      and app_assignment.teacher_id = (select auth.uid())
      and private.current_teacher_has_student_app_access(
        app_assignment.tenant_id,
        app_assignment.student_id,
        app_assignment.student_app_id
      )
      and (
        (
          grade_review_requests.source_type = 'assignment_submission'
          and exists (
            select 1
            from public.learning_submissions as submission
            join public.learning_assignments as assignment
              on assignment.tenant_id = submission.tenant_id
             and assignment.id = submission.assignment_id
            where submission.tenant_id = grade_review_requests.tenant_id
              and submission.id = grade_review_requests.source_result_id
              and assignment.student_app_id = app_assignment.student_app_id
          )
        )
        or (
          grade_review_requests.source_type = 'chapter_test_attempt'
          and exists (
            select 1
            from public.chapter_test_attempts as attempt
            join public.chapter_tests as test on test.id = attempt.test_id
            where attempt.tenant_id = grade_review_requests.tenant_id
              and attempt.id = grade_review_requests.source_result_id
              and test.student_app_id = app_assignment.student_app_id
          )
        )
        or (
          grade_review_requests.source_type = 'manual_grade_record'
          and exists (
            select 1
            from public.grade_records as grade_record
            join public.grade_items as grade_item
              on grade_item.tenant_id = grade_record.tenant_id
             and grade_item.id = grade_record.item_id
            left join public.courses as course on course.id = grade_item.course_id
            left join public.learning_assignments as assignment
              on assignment.id = grade_item.source_assignment_id
            where grade_record.tenant_id = grade_review_requests.tenant_id
              and grade_record.id = grade_review_requests.record_id
              and coalesce(
                course.student_app_id,
                assignment.student_app_id
              ) = app_assignment.student_app_id
          )
        )
      )
  )
);

create or replace function public.create_learning_assignment_from_paper(
  p_paper_id uuid,
  p_course_id uuid,
  p_target_scope text,
  p_target_ids uuid[],
  p_starts_at timestamptz,
  p_due_at timestamptz,
  p_institution_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_paper public.assessment_papers%rowtype;
  v_paper_question public.assessment_paper_questions%rowtype;
  v_paper_key public.assessment_paper_question_keys%rowtype;
  v_assignment_id uuid;
  v_question_id uuid;
  v_course_app_id uuid;
  v_target_count integer;
  v_expected_target_count integer;
begin
  select * into v_paper
  from public.assessment_papers
  where id = p_paper_id
    and status = 'published';

  if v_tenant_id is null
    or not found
    or not private.current_staff_has_app_capability(
      v_tenant_id,
      v_paper.student_app_id,
      'manage_assessments'
    ) then
    raise exception '所选标准试卷不存在或当前账号没有该应用发布权限';
  end if;

  if not exists (
    select 1
    from public.tenant_student_apps as tenant_app
    where tenant_app.tenant_id = v_tenant_id
      and tenant_app.app_id = v_paper.student_app_id
      and tenant_app.is_enabled
      and tenant_app.status = 'active'
  ) then
    raise exception '该应用尚未正式开放，不能发布作业或考试';
  end if;

  p_institution_note := btrim(coalesce(p_institution_note, ''));
  if char_length(p_institution_note) > 2000 then
    raise exception '机构通知不能超过 2000 个字';
  end if;
  if p_target_scope not in ('all_students', 'selected_students') then
    raise exception '分配范围不正确';
  end if;
  p_starts_at := coalesce(p_starts_at, now());
  if p_due_at is null or p_due_at <= p_starts_at then
    raise exception '截止时间必须晚于开始时间';
  end if;

  if p_course_id is not null then
    select course.student_app_id into v_course_app_id
    from public.courses as course
    where course.id = p_course_id
      and course.is_published
      and (
        course.content_scope = 'platform'
        or course.tenant_id = v_tenant_id
      );
    if v_course_app_id is null then
      raise exception '所选课程不存在、尚未发布或不属于当前机构';
    end if;
    if v_course_app_id is distinct from v_paper.student_app_id then
      raise exception '所选课程与标准试卷不属于同一个应用';
    end if;
  end if;

  if p_target_scope = 'selected_students' then
    select count(distinct value)
    into v_expected_target_count
    from unnest(coalesce(p_target_ids, array[]::uuid[])) as value;
    if v_expected_target_count = 0 then
      raise exception '请至少选择一名学生';
    end if;

    select count(*) into v_target_count
    from (
      select distinct requested.value as student_id
      from unnest(p_target_ids) as requested(value)
      join public.tenant_memberships as membership
        on membership.tenant_id = v_tenant_id
       and membership.user_id = requested.value
       and membership.role = 'student'
       and membership.status = 'active'
      join public.student_app_enrollments as enrollment
        on enrollment.tenant_id = membership.tenant_id
       and enrollment.student_id = membership.user_id
       and enrollment.app_id = v_paper.student_app_id
       and enrollment.status = 'active'
       and enrollment.starts_at <= now()
       and (enrollment.ends_at is null or enrollment.ends_at > now())
    ) as valid_target;
    if v_target_count <> v_expected_target_count then
      raise exception '分配名单中包含未开通该应用的学生';
    end if;
  end if;

  insert into public.learning_assignments (
    tenant_id, student_app_id, title, description, assignment_type,
    course_id, target_scope, total_points, starts_at, due_at,
    duration_minutes, allow_resubmission, status, published_at,
    created_by, updated_by, source_paper_id, source_paper_code,
    source_paper_version, institution_note
  ) values (
    v_tenant_id, v_paper.student_app_id, v_paper.title, v_paper.description,
    v_paper.paper_type, p_course_id, p_target_scope, v_paper.total_points,
    p_starts_at, p_due_at, v_paper.duration_minutes,
    v_paper.allow_resubmission, 'published', now(), auth.uid(), auth.uid(),
    v_paper.id, v_paper.paper_code, v_paper.version, p_institution_note
  )
  returning id into v_assignment_id;

  for v_paper_question in
    select *
    from public.assessment_paper_questions
    where paper_id = v_paper.id
    order by sort_order
  loop
    insert into public.learning_assignment_questions (
      tenant_id, assignment_id, question_type, prompt, options, points,
      sort_order, source_bank_question_id, source_bank_version
    ) values (
      v_tenant_id, v_assignment_id, v_paper_question.question_type,
      v_paper_question.prompt, v_paper_question.options,
      v_paper_question.points, v_paper_question.sort_order,
      v_paper_question.source_bank_question_id,
      v_paper_question.source_bank_version
    )
    returning id into v_question_id;

    select * into v_paper_key
    from public.assessment_paper_question_keys
    where question_id = v_paper_question.id;

    if found then
      insert into public.learning_assignment_question_keys (
        tenant_id, question_id, correct_answer, explanation, updated_by
      ) values (
        v_tenant_id, v_question_id, v_paper_key.correct_answer,
        v_paper_key.explanation, auth.uid()
      );
    end if;
  end loop;

  if p_target_scope = 'selected_students' then
    insert into public.learning_assignment_targets (
      tenant_id, assignment_id, student_id
    )
    select v_tenant_id, v_assignment_id, requested.value
    from (
      select distinct value
      from unnest(p_target_ids) as value
    ) as requested
    on conflict do nothing;
  end if;

  return v_assignment_id;
end;
$$;

create or replace function public.current_user_can_view_learning_assignment(
  p_assignment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.learning_assignments as assignment
    where assignment.id = p_assignment_id
      and assignment.tenant_id = private.current_tenant_id()
      and (
        private.current_staff_has_app_capability(
          assignment.tenant_id,
          assignment.student_app_id,
          'manage_assessments'
        )
        or (
          assignment.status = 'published'
          and public.student_feature_allowed('learning_assignments')
          and private.current_student_has_app_access(
            assignment.tenant_id,
            (select auth.uid()),
            assignment.student_app_id
          )
          and (
            assignment.target_scope = 'all_students'
            or exists (
              select 1
              from public.learning_assignment_targets as target
              where target.assignment_id = assignment.id
                and target.student_id = (select auth.uid())
            )
          )
        )
      )
  );
$$;

create or replace function public.current_user_can_view_learning_assignment_questions(
  p_assignment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.learning_assignments as assignment
    where assignment.id = p_assignment_id
      and assignment.tenant_id = private.current_tenant_id()
      and (
        private.current_staff_has_app_capability(
          assignment.tenant_id,
          assignment.student_app_id,
          'manage_assessments'
        )
        or (
          public.current_user_can_view_learning_assignment(assignment.id)
          and assignment.starts_at <= now()
        )
      )
  );
$$;

drop policy if exists "tenant managers or assigned students read targets"
  on public.learning_assignment_targets;
create policy "application users read assignment targets"
on public.learning_assignment_targets for select to authenticated
using (
  exists (
    select 1
    from public.learning_assignments as assignment
    where assignment.id = learning_assignment_targets.assignment_id
      and assignment.tenant_id = learning_assignment_targets.tenant_id
      and (
        private.current_staff_has_app_capability(
          assignment.tenant_id,
          assignment.student_app_id,
          'manage_assessments'
        )
        or (
          learning_assignment_targets.student_id = (select auth.uid())
          and private.current_student_has_app_access(
            assignment.tenant_id,
            learning_assignment_targets.student_id,
            assignment.student_app_id
          )
        )
      )
  )
);

drop policy if exists "tenant managers or owners read submissions"
  on public.learning_submissions;
create policy "application users read submissions"
on public.learning_submissions for select to authenticated
using (
  exists (
    select 1
    from public.learning_assignments as assignment
    where assignment.id = learning_submissions.assignment_id
      and assignment.tenant_id = learning_submissions.tenant_id
      and (
        private.current_staff_has_app_capability(
          assignment.tenant_id,
          assignment.student_app_id,
          'manage_assessments'
        )
        or private.current_teacher_has_student_app_access(
          assignment.tenant_id,
          learning_submissions.student_id,
          assignment.student_app_id
        )
        or (
          learning_submissions.student_id = (select auth.uid())
          and private.current_student_has_app_access(
            assignment.tenant_id,
            learning_submissions.student_id,
            assignment.student_app_id
          )
        )
      )
  )
);

drop policy if exists "tenant managers or owners read submission answers"
  on public.learning_submission_answers;
create policy "application users read submission answers"
on public.learning_submission_answers for select to authenticated
using (
  exists (
    select 1
    from public.learning_submissions as submission
    join public.learning_assignments as assignment
      on assignment.id = submission.assignment_id
     and assignment.tenant_id = submission.tenant_id
    where submission.id = learning_submission_answers.submission_id
      and submission.tenant_id = learning_submission_answers.tenant_id
      and (
        private.current_staff_has_app_capability(
          assignment.tenant_id,
          assignment.student_app_id,
          'manage_assessments'
        )
        or private.current_teacher_has_student_app_access(
          assignment.tenant_id,
          submission.student_id,
          assignment.student_app_id
        )
        or (
          submission.student_id = (select auth.uid())
          and private.current_student_has_app_access(
            assignment.tenant_id,
            submission.student_id,
            assignment.student_app_id
          )
        )
      )
  )
);

comment on column public.assessment_papers.student_app_id is
  '标准试卷所属学生应用；从来源章节测试继承且不可跨应用修改。';
comment on column public.digital_textbooks.student_app_id is
  '互动教材所属学生应用；从课时所属课程继承且不可跨应用修改。';

-- ============================================================
-- 学习事实的学生自助与机构读取也必须实时校验应用授权。
-- ============================================================

drop policy if exists "tenant users read visible learning assignments"
  on public.learning_assignments;
create policy "tenant users read visible learning assignments"
on public.learning_assignments for select to authenticated
using (public.current_user_can_view_learning_assignment(id));

drop policy if exists "tenant users manage own lesson progress"
  on public.lesson_progress;
create policy "students manage own authorized lesson progress"
on public.lesson_progress for all to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.courses as course
    where course.id = lesson_progress.course_id
      and private.current_student_has_app_access(
        lesson_progress.tenant_id,
        lesson_progress.user_id,
        course.student_app_id
      )
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.courses as course
    where course.id = lesson_progress.course_id
      and private.current_student_has_app_access(
        lesson_progress.tenant_id,
        lesson_progress.user_id,
        course.student_app_id
      )
  )
);

drop policy if exists "students view own course test attempts"
  on public.chapter_test_attempts;
create policy "students view own authorized test attempts"
on public.chapter_test_attempts for select to authenticated
using (
  student_id = (select auth.uid())
  and exists (
    select 1
    from public.chapter_tests as test
    where (test.id = chapter_test_attempts.test_id or test.slug = chapter_test_attempts.test_slug)
      and private.current_student_has_app_access(
        chapter_test_attempts.tenant_id,
        chapter_test_attempts.student_id,
        test.student_app_id
      )
  )
);

drop policy if exists "tenant admins view course test attempts"
  on public.chapter_test_attempts;
create policy "application staff view course test attempts"
on public.chapter_test_attempts for select to authenticated
using (
  exists (
    select 1
    from public.chapter_tests as test
    where (test.id = chapter_test_attempts.test_id or test.slug = chapter_test_attempts.test_slug)
      and private.current_staff_has_app_capability(
        chapter_test_attempts.tenant_id,
        test.student_app_id,
        'view_analytics'
      )
  )
);

drop policy if exists "students view own ebook progress"
  on public.course_ebook_progress;
create policy "students view own ebook progress"
on public.course_ebook_progress for select to authenticated
using (
  private.current_student_has_app_access(
    tenant_id, student_id, student_app_id
  )
);

drop policy if exists "students add own ebook progress"
  on public.course_ebook_progress;
create policy "students add own ebook progress"
on public.course_ebook_progress for insert to authenticated
with check (
  private.current_student_has_app_access(
    tenant_id, student_id, student_app_id
  )
);

drop policy if exists "students update own ebook progress"
  on public.course_ebook_progress;
create policy "students update own ebook progress"
on public.course_ebook_progress for update to authenticated
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

drop policy if exists "students read own learning time log"
  on public.learning_time_log;
create policy "students read own learning time log"
on public.learning_time_log for select to authenticated
using (
  private.current_student_has_app_access(
    tenant_id, student_id, student_app_id
  )
);

drop policy if exists "students insert own toolbox learning time"
  on public.learning_time_log;
create policy "students insert own toolbox learning time"
on public.learning_time_log for insert to authenticated
with check (
  source = 'toolbox'
  and private.current_student_has_app_access(
    tenant_id, student_id, student_app_id
  )
);

drop policy if exists "tenant admins read learning time log"
  on public.learning_time_log;
create policy "application staff read learning time log"
on public.learning_time_log for select to authenticated
using (
  private.current_staff_has_app_capability(
    tenant_id, student_app_id, 'view_analytics'
  )
);

drop policy if exists "tenant managers or students read learning record notes"
  on public.learning_record_notes;
create policy "application users read learning record notes"
on public.learning_record_notes for select to authenticated
using (
  private.current_staff_has_app_capability(
    tenant_id, student_app_id, 'view_analytics'
  )
  or private.current_teacher_has_student_app_access(
    tenant_id, student_id, student_app_id
  )
  or (
    student_id = (select auth.uid())
    and visibility = 'student_visible'
    and status = 'active'
    and private.current_student_has_app_access(
      tenant_id, student_id, student_app_id
    )
  )
);

create or replace function public.current_user_can_view_conversation_scenario(
  p_scenario_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_practice_scenarios as scenario
    where scenario.id = p_scenario_id
      and scenario.tenant_id = private.current_tenant_id()
      and (
        private.current_staff_has_app_capability(
          scenario.tenant_id,
          scenario.student_app_id,
          'manage_assessments'
        )
        or (
          scenario.status = 'published'
          and public.student_feature_allowed('conversation_course')
          and private.current_student_has_app_access(
            scenario.tenant_id,
            (select auth.uid()),
            scenario.student_app_id
          )
        )
      )
  );
$$;

drop policy if exists "tenant users read visible conversation scenarios"
  on public.conversation_practice_scenarios;
create policy "tenant users read visible conversation scenarios"
on public.conversation_practice_scenarios for select to authenticated
using (public.current_user_can_view_conversation_scenario(id));

drop policy if exists "tenant managers or owners read conversation progress"
  on public.conversation_practice_progress;
create policy "application users read conversation progress"
on public.conversation_practice_progress for select to authenticated
using (
  exists (
    select 1
    from public.conversation_practice_scenarios as scenario
    where scenario.id = conversation_practice_progress.scenario_id
      and scenario.tenant_id = conversation_practice_progress.tenant_id
      and (
        private.current_staff_has_app_capability(
          scenario.tenant_id,
          scenario.student_app_id,
          'view_analytics'
        )
        or private.current_teacher_has_student_app_access(
          scenario.tenant_id,
          conversation_practice_progress.user_id,
          scenario.student_app_id
        )
        or (
          conversation_practice_progress.user_id = (select auth.uid())
          and private.current_student_has_app_access(
            scenario.tenant_id,
            conversation_practice_progress.user_id,
            scenario.student_app_id
          )
        )
      )
  )
);

create or replace function private.grade_review_student_app_id(p_review_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case review.source_type
    when 'assignment_submission' then (
      select assignment.student_app_id
      from public.learning_submissions as submission
      join public.learning_assignments as assignment
        on assignment.tenant_id = submission.tenant_id
       and assignment.id = submission.assignment_id
      where submission.id = review.source_result_id
    )
    when 'chapter_test_attempt' then (
      select test.student_app_id
      from public.chapter_test_attempts as attempt
      join public.chapter_tests as test on test.id = attempt.test_id
      where attempt.id = review.source_result_id
    )
    when 'manual_grade_record' then (
      select coalesce(course.student_app_id, assignment.student_app_id)
      from public.grade_records as grade_record
      join public.grade_items as grade_item
        on grade_item.tenant_id = grade_record.tenant_id
       and grade_item.id = grade_record.item_id
      left join public.courses as course on course.id = grade_item.course_id
      left join public.learning_assignments as assignment
        on assignment.id = grade_item.source_assignment_id
      where grade_record.id = review.record_id
    )
    else null
  end
  from public.grade_review_requests as review
  where review.id = p_review_id;
$$;

revoke all on function private.grade_review_student_app_id(uuid) from public;
grant execute on function private.grade_review_student_app_id(uuid) to authenticated, service_role;

drop policy if exists "tenant managers or owners read grade reviews"
  on public.grade_review_requests;
create policy "application users read grade reviews"
on public.grade_review_requests for select to authenticated
using (
  private.current_staff_has_app_capability(
    tenant_id,
    private.grade_review_student_app_id(id),
    'view_analytics'
  )
  or private.current_teacher_has_student_app_access(
    tenant_id,
    student_id,
    private.grade_review_student_app_id(id)
  )
  or (
    student_id = (select auth.uid())
    and private.current_student_has_app_access(
      tenant_id,
      student_id,
      private.grade_review_student_app_id(id)
    )
  )
);

commit;
