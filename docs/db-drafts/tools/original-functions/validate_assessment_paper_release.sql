CREATE OR REPLACE FUNCTION private.validate_assessment_paper_release(p_paper_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_paper public.assessment_papers%rowtype;
  v_question_count integer;
  v_total_points numeric;
begin
  select * into v_paper from public.assessment_papers where id = p_paper_id;
  if v_paper.id is null or v_paper.status <> 'published' then
    raise exception '所选标准试卷当前不可发布';
  end if;
  select count(*), coalesce(sum(question.points), 0)
  into v_question_count, v_total_points
  from public.assessment_paper_questions as question
  where question.paper_id = p_paper_id;
  if v_question_count <> v_paper.question_count
    or v_total_points <> v_paper.total_points then
    raise exception '标准试卷题量或总分与题目快照不一致';
  end if;
  if exists (
    select 1
    from public.assessment_paper_questions as question
    left join public.assessment_paper_question_keys as answer_key
      on answer_key.question_id = question.id
    where question.paper_id = p_paper_id
      and question.auto_graded
      and nullif(btrim(coalesce(answer_key.correct_answer, '')), '') is null
  ) then
    raise exception '标准试卷中有客观题缺少正确答案';
  end if;

  if v_paper.paper_type = 'homework' then
    if (
      select count(distinct question.skill)
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill in (
          'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
        )
    ) <> 6 then
      raise exception '章节作业的词汇、语法、听说读写六项内容不完整';
    end if;
    if exists (
      select 1
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill = 'listening'
        and nullif(btrim(question.stimulus_text), '') is null
    ) then
      raise exception '章节作业的听力题缺少韩语听力材料';
    end if;
    if v_paper.source_homework_plan_id is not null and exists (
      select 1
      from (
        select source.language_skill, count(*) as expected_count
        from public.chapter_homework_questions as source
        where source.plan_id = v_paper.source_homework_plan_id
        group by source.language_skill
      ) as expected
      left join (
        select question.skill as language_skill, count(*) as actual_count
        from public.assessment_paper_questions as question
        where question.paper_id = p_paper_id
        group by question.skill
      ) as actual using (language_skill)
      where expected.expected_count <> coalesce(actual.actual_count, 0)
    ) then
      raise exception '章节作业与平台发布的词汇、语法或六项题目数量不一致';
    end if;
  end if;
end;
$function$

