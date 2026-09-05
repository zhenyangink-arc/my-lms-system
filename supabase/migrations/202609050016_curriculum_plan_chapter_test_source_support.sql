-- ============================================================
-- "章节测试"活动类型现在只能手写标题，没有绑定任何真实测试，机构端
-- 因此完全看不到学生有没有真的做过这次测试。这里比照"课程学习"必须
-- 绑定课时/章节的规则，让"章节测试"活动类型必须绑定 chapter_tests
-- 里的真实测试（must belong to a published lesson under the
-- template's course），发布前也要求全部绑定完整。
-- source_type = 'chapter_test' 早在 202609050001 建表时就已经在
-- source_type 的 check 约束允许值里，这里只是补齐触发器校验。
-- ============================================================

begin;

create or replace function private.guard_curriculum_plan_template_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_duration_days integer;
  v_course_id uuid;
begin
  select template.status, template.duration_days, template.course_id
  into v_status, v_duration_days, v_course_id
  from public.curriculum_plan_templates as template
  where template.id = coalesce(new.template_id, old.template_id);

  if v_status is distinct from 'draft' then
    raise exception '已发布或停用的标准计划不能修改明细，请复制为新版本';
  end if;
  if tg_op <> 'DELETE' and new.day_offset >= v_duration_days then
    raise exception '计划项目超出模板总天数';
  end if;
  if tg_op <> 'DELETE' and new.activity_type = 'course' then
    if new.source_type not in ('lesson', 'chapter') or new.source_id is null then
      raise exception '课程学习必须绑定真实课时或章节';
    end if;
    if new.source_type = 'lesson' and (
      v_course_id is null or not exists (
        select 1 from public.lessons as lesson
        where lesson.id = new.source_id
          and lesson.course_id = v_course_id
          and lesson.is_published
      )
    ) then
      raise exception '绑定课时未发布或不属于模板课程';
    end if;
    if new.source_type = 'chapter' and (
      v_course_id is null or not exists (
        select 1
        from public.course_chapters as chapter
        join public.lessons as lesson on lesson.id = chapter.lesson_id
        where chapter.id = new.source_id
          and chapter.is_published
          and lesson.course_id = v_course_id
          and lesson.is_published
      )
    ) then
      raise exception '绑定章节未发布或不属于模板课程';
    end if;
  end if;
  if tg_op <> 'DELETE' and new.activity_type = 'chapter_test' then
    if new.source_type <> 'chapter_test' or new.source_id is null then
      raise exception '章节测试必须绑定真实测试';
    end if;
    if v_course_id is null or not exists (
      select 1
      from public.chapter_tests as test
      join public.lessons as lesson on lesson.id = test.lesson_id
      where test.id = new.source_id
        and test.status = 'published'
        and lesson.course_id = v_course_id
        and lesson.is_published
    ) then
      raise exception '绑定测试未发布或不属于模板课程';
    end if;
  end if;
  if tg_op <> 'DELETE' and new.source_type in ('lesson', 'chapter') and new.activity_type <> 'course' then
    raise exception '只有课程学习活动可以绑定课时或章节';
  end if;
  if tg_op <> 'DELETE' and new.source_type = 'chapter_test' and new.activity_type <> 'chapter_test' then
    raise exception '只有章节测试活动可以绑定测试';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function private.guard_curriculum_plan_template_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'draft' and new.status = 'published' then
    if not exists (
      select 1 from public.curriculum_plan_template_items as item
      where item.template_id = new.id
    ) then
      raise exception '至少添加一个计划项目后才能发布';
    end if;
    if exists (
      select 1 from public.curriculum_plan_template_items as item
      where item.template_id = new.id
        and item.activity_type = 'course'
        and (item.source_type not in ('lesson', 'chapter') or item.source_id is null)
    ) then
      raise exception '课程学习项目必须全部绑定真实课时或章节';
    end if;
    if exists (
      select 1 from public.curriculum_plan_template_items as item
      where item.template_id = new.id
        and item.activity_type = 'chapter_test'
        and (item.source_type <> 'chapter_test' or item.source_id is null)
    ) then
      raise exception '章节测试项目必须全部绑定真实测试';
    end if;
  end if;
  return new;
end;
$$;

commit;
