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
    if new.source_type <> 'lesson' or new.source_id is null then
      raise exception '课程学习必须绑定真实课时';
    end if;
    if v_course_id is null or not exists (
      select 1 from public.lessons as lesson
      where lesson.id = new.source_id
        and lesson.course_id = v_course_id
        and lesson.is_published
    ) then
      raise exception '绑定课时未发布或不属于模板课程';
    end if;
  end if;
  if tg_op <> 'DELETE' and new.source_type = 'lesson' and new.activity_type <> 'course' then
    raise exception '只有课程学习活动可以绑定课时';
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
        and (item.source_type <> 'lesson' or item.source_id is null)
    ) then
      raise exception '课程学习项目必须全部绑定真实课时';
    end if;
  end if;
  return new;
end;
$$;

create trigger curriculum_plan_template_publish_guard
before update of status on public.curriculum_plan_templates
for each row execute function private.guard_curriculum_plan_template_publish();

commit;
