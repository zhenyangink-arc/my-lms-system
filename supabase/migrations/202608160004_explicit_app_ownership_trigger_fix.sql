begin;

-- This trigger is shared by records, scenarios, teacher assignments, and
-- toolbox tables. Table-specific optional foreign keys must not be referenced
-- directly from the polymorphic NEW record.
create or replace function private.enforce_explicit_student_app_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(new);
  v_old_row jsonb := case
    when tg_op = 'UPDATE' then to_jsonb(old)
    else null
  end;
  v_student_app_id uuid := nullif(v_row ->> 'student_app_id', '')::uuid;
  v_parent_app_id uuid;
  v_related_id uuid;
begin
  if v_student_app_id is null then
    raise exception '缺少学生应用归属，拒绝写入';
  end if;

  if tg_table_name = 'growth_toolbox_items' then
    v_related_id := nullif(v_row ->> 'related_course_id', '')::uuid;
    if v_related_id is not null then
      select course.student_app_id into v_parent_app_id
      from public.courses as course
      where course.id = v_related_id;
      if v_parent_app_id is null
        or v_parent_app_id is distinct from v_student_app_id then
        raise exception '工具入口关联课程与入口不属于同一个应用';
      end if;
    end if;
  elsif tg_table_name = 'growth_toolbox_vocabulary' then
    v_related_id := nullif(v_row ->> 'source_chapter_id', '')::uuid;
    if v_related_id is not null then
      select textbook.student_app_id into v_parent_app_id
      from public.digital_textbook_chapters as chapter
      join public.digital_textbook_versions as version
        on version.id = chapter.version_id
      join public.digital_textbooks as textbook
        on textbook.id = version.textbook_id
      where chapter.id = v_related_id;
      if v_parent_app_id is null
        or v_parent_app_id is distinct from v_student_app_id then
        raise exception '工具箱词汇来源章节与词汇不属于同一个应用';
      end if;
    end if;
  end if;

  if tg_op = 'UPDATE'
    and nullif(v_old_row ->> 'student_app_id', '')::uuid
      is distinct from v_student_app_id then
    raise exception '应用归属创建后不可修改；请在目标应用重新创建数据';
  end if;
  return new;
end;
$$;

commit;
