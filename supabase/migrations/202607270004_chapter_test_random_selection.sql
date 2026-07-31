-- 平台章节测试一键选题：以受控 RPC 原子替换某章当前测试题。
create or replace function public.replace_chapter_test_questions(
  p_test_id uuid,
  p_question_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requested_count integer;
  v_valid_count integer;
begin
  if not public.current_user_can_manage_assessment_papers() then
    raise exception '只有平台负责人或指定管理员可以设置章节测试题目';
  end if;

  if not exists (
    select 1
    from public.course_tests
    where id = p_test_id
      and status <> 'archived'
  ) then
    raise exception '章节测试不存在或已经归档';
  end if;

  select count(distinct question_id)
  into v_requested_count
  from unnest(coalesce(p_question_ids, array[]::uuid[])) as question_id;

  if v_requested_count not between 1 and 100 then
    raise exception '章节测试需要选择 1 至 100 道题目';
  end if;

  if cardinality(coalesce(p_question_ids, array[]::uuid[])) <> v_requested_count then
    raise exception '选题中不能包含重复题目';
  end if;

  select count(*)
  into v_valid_count
  from public.course_test_questions
  where id = any(p_question_ids)
    and test_id = p_test_id
    and status = 'published'
    and question_type = 'single_choice';

  if v_valid_count <> v_requested_count then
    raise exception '选题中包含不属于本章、未发布或非单选题的内容';
  end if;

  update public.course_test_questions
  set is_chapter_test_item = id = any(p_question_ids),
      updated_by = auth.uid(),
      updated_at = now()
  where test_id = p_test_id
    and question_type = 'single_choice';

  update public.course_tests
  set version = version + 1,
      updated_at = now()
  where id = p_test_id;

  return v_requested_count;
end;
$$;

revoke all on function public.replace_chapter_test_questions(uuid, uuid[])
  from public;
grant execute on function public.replace_chapter_test_questions(uuid, uuid[])
  to authenticated;

comment on function public.replace_chapter_test_questions(uuid, uuid[]) is
  '平台按难度随机选题后，原子替换指定章节当前提供给学生的测试题目。';
