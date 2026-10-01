CREATE OR REPLACE FUNCTION private.assessment_paper_release_issues_with_temporary_notice(p_paper_id uuid)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_paper public.assessment_papers%rowtype;
  v_issues text[] := array[]::text[];
  v_is_chapter_exam boolean;
  v_is_midterm boolean;
  v_invalid_count integer;
  v_question record;
begin
  select * into v_paper
  from public.assessment_papers
  where id = p_paper_id;
  if not found then
    return array['标准试卷不存在'];
  end if;

  v_is_chapter_exam := v_paper.paper_type = 'exam'
    and v_paper.paper_code ~ '^EX-K1-(0[1-9]|1[0-6])-V[0-9]+$';
  v_is_midterm := v_paper.paper_type = 'exam'
    and v_paper.paper_code like 'EX-K1-MID-%';

  if v_paper.question_count < 1 then
    v_issues := array_append(v_issues, '试卷没有题目');
  end if;
  if v_paper.duration_minutes is null then
    v_issues := array_append(v_issues, '未设置考试时长');
  end if;
  if v_paper.passing_score is null then
    v_issues := array_append(v_issues, '未设置及格分');
  end if;
  if not v_paper.resubmission_policy_configured then
    v_issues := array_append(v_issues, '重复提交规则尚未由内容负责人确认');
  end if;

  select count(*) into v_invalid_count
  from (
    select lower(btrim(question.prompt))
    from public.assessment_paper_questions as question
    where question.paper_id = p_paper_id
    group by lower(btrim(question.prompt))
    having count(*) > 1
  ) as duplicates;
  if v_invalid_count > 0 then
    v_issues := array_append(v_issues,
      format('存在 %s 组重复题干', v_invalid_count));
  end if;

  select count(*) into v_invalid_count
  from public.assessment_paper_questions as question
  left join public.assessment_paper_question_keys as answer_key
    on answer_key.question_id = question.id
  where question.paper_id = p_paper_id
    and (
      nullif(btrim(question.prompt), '') is null
      or question.points <= 0
      or answer_key.question_id is null
      or nullif(btrim(answer_key.explanation), '') is null
      or question.skill not in (
        'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
      )
    );
  if v_invalid_count > 0 then
    v_issues := array_append(v_issues,
      format('有 %s 道题的题干、解析、分值或能力分类未完成', v_invalid_count));
  end if;

  select count(*) into v_invalid_count
  from public.assessment_paper_questions as question
  left join public.assessment_paper_question_keys as answer_key
    on answer_key.question_id = question.id
  where question.paper_id = p_paper_id
    and question.auto_graded
    and (
      nullif(btrim(answer_key.correct_answer), '') is null
      or nullif(btrim(answer_key.explanation), '') is null
    );
  if v_invalid_count > 0 then
    v_issues := array_append(v_issues,
      format('有 %s 道客观题缺少正确答案或解析', v_invalid_count));
  end if;

  select count(*) into v_invalid_count
  from public.assessment_paper_questions as question
  join public.assessment_paper_question_keys as answer_key
    on answer_key.question_id = question.id
  where question.paper_id = p_paper_id
    and question.auto_graded
    and (
      jsonb_array_length(question.options) < 2
      or not question.options @> jsonb_build_array(answer_key.correct_answer)
    );
  if v_invalid_count > 0 then
    v_issues := array_append(v_issues,
      format('有 %s 道客观题的可选项未完整冻结或不包含正确答案', v_invalid_count));
  end if;

  select count(*) into v_invalid_count
  from public.assessment_paper_questions as question
  where question.paper_id = p_paper_id
    and exists (
      select 1
      from jsonb_array_elements_text(question.options) as option_value(value)
      group by lower(btrim(option_value.value))
      having count(*) > 1
    );
  if v_invalid_count > 0 then
    v_issues := array_append(v_issues,
      format('有 %s 道题包含完全重复的选项', v_invalid_count));
  end if;

  if (
    select count(*) from public.assessment_paper_questions as question
    where question.paper_id = p_paper_id
  ) <> v_paper.question_count then
    v_issues := array_append(v_issues, '试卷题量与题目快照不一致');
  end if;
  if (
    select coalesce(sum(question.points), 0)
    from public.assessment_paper_questions as question
    where question.paper_id = p_paper_id
  ) <> v_paper.total_points then
    v_issues := array_append(v_issues, '试卷总分与题目快照不一致');
  end if;

  if v_is_midterm then
    if v_paper.paper_code !~ '^EX-K1-MID-V[0-9]+$' then
      v_issues := array_append(v_issues, '期中母卷代码必须符合 EX-K1-MID-V{版本号}');
    end if;
    if v_paper.total_points <> 100 then
      v_issues := array_append(v_issues, '期中考试母卷总分必须等于100分');
    end if;
    if (
      select count(distinct question.skill)
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill in (
          'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
        )
    ) <> 6 then
      v_issues := array_append(v_issues, '期中考试的单词、语法、听力、口语、阅读、写作六项不齐全');
    end if;
    if exists (
      select required.skill
      from (values
        ('vocabulary', 15::numeric), ('grammar', 20::numeric),
        ('listening', 15::numeric), ('speaking', 15::numeric),
        ('reading', 20::numeric), ('writing', 15::numeric)
      ) as required(skill, points)
      left join (
        select question.skill, sum(question.points) as points
        from public.assessment_paper_questions as question
        where question.paper_id = p_paper_id
        group by question.skill
      ) as actual using (skill)
      where coalesce(actual.points, 0) <> required.points
    ) then
      v_issues := array_append(v_issues,
        '期中考试六项分值必须为单词15、语法20、听力15、口语15、阅读20、写作15');
    end if;
    for v_question in
      select
        coalesce(question.question_code, '未编号题目') as question_code,
        question.points,
        case question.skill
          when 'vocabulary' then 1.5::numeric
          when 'grammar' then 2::numeric
          when 'listening' then 3::numeric
          when 'speaking' then 15::numeric
          when 'reading' then 2.5::numeric
          when 'writing' then 15::numeric
        end as expected_points
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill in (
          'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
        )
        and question.points <> case question.skill
          when 'vocabulary' then 1.5::numeric
          when 'grammar' then 2::numeric
          when 'listening' then 3::numeric
          when 'speaking' then 15::numeric
          when 'reading' then 2.5::numeric
          when 'writing' then 15::numeric
        end
      order by question.sort_order
    loop
      v_issues := array_append(
        v_issues,
        format(
          '期中题 %s 分值应为 %s 分，当前为 %s 分',
          v_question.question_code,
          v_question.expected_points,
          v_question.points
        )
      );
    end loop;
    if (
      select count(distinct chapter_key)
      from public.assessment_paper_questions as question
      cross join unnest(question.source_chapters) as chapter_key
      where question.paper_id = p_paper_id
        and chapter_key ~ '^K1-(0[1-9]|1[0-6])$'
    ) < 6 then
      v_issues := array_append(v_issues, '期中考试必须至少覆盖6个不同章节');
    end if;
    select count(*) into v_invalid_count
    from public.assessment_paper_questions as question
    where question.paper_id = p_paper_id
      and (
        question.question_code is null
        or cardinality(question.source_chapters) = 0
        or nullif(btrim(question.source_knowledge), '') is null
      );
    if v_invalid_count > 0 then
      v_issues := array_append(v_issues,
        format('有 %s 道期中题缺少稳定题号、章节来源或知识点快照', v_invalid_count));
    end if;
    if exists (
      select 1 from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill in ('vocabulary', 'grammar', 'listening', 'reading')
        and not question.auto_graded
    ) then
      v_issues := array_append(v_issues, '期中考试的单词、语法、听力或阅读客观题未配置自动判分');
    end if;
    if exists (
      select 1 from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill in ('speaking', 'writing')
        and question.auto_graded
    ) then
      v_issues := array_append(v_issues, '期中考试的口语和写作必须配置为人工批改');
    end if;
    select count(*) into v_invalid_count
    from public.assessment_paper_questions as question
    join public.assessment_paper_question_keys as answer_key
      on answer_key.question_id = question.id
    where question.paper_id = p_paper_id
      and question.skill in ('speaking', 'writing')
      and (
        (question.skill = 'speaking' and question.question_type <> 'audio_recording')
        or (question.skill = 'writing' and question.question_type <> 'long_text')
        or case
          when jsonb_typeof(answer_key.rubric_snapshot -> 'criteria') = 'array'
          then
            exists (
              select 1
              from jsonb_array_elements(
                answer_key.rubric_snapshot -> 'criteria'
              ) as criterion
              where jsonb_typeof(criterion -> 'maxPoints') <> 'number'
            )
            or coalesce((
              select sum((criterion ->> 'maxPoints')::numeric)
              from jsonb_array_elements(
                answer_key.rubric_snapshot -> 'criteria'
              ) as criterion
            ), 0) <> question.points
          else true
        end
      );
    if v_invalid_count > 0 then
      v_issues := array_append(v_issues,
        format('有 %s 道主观题的作答方式或量规满分与题目分值不一致', v_invalid_count));
    end if;
    select count(*) into v_invalid_count
    from public.assessment_paper_questions as question
    where question.paper_id = p_paper_id
      and question.skill = 'listening'
      and (
        nullif(btrim(question.stimulus_text), '') is null
        or question.audio_status not in ('temporary', 'formal')
      );
    if v_invalid_count > 0 then
      v_issues := array_append(v_issues,
        format('有 %s 道听力题缺少材料文本或有效音频状态', v_invalid_count));
    end if;
    select count(*) into v_invalid_count
    from public.assessment_paper_questions as question
    where question.paper_id = p_paper_id
      and question.skill = 'listening'
      and question.audio_status = 'temporary';
    if v_invalid_count > 0 then
      v_issues := array_append(v_issues,
        format('有 %s 道听力题仍使用 temporary 临时音频，正式发布前须完成听校并复制为新版本', v_invalid_count));
    end if;
    if exists (
      select 1 from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill = 'listening'
        and question.audio_status = 'formal'
    ) and v_paper.paper_code = 'EX-K1-MID-V1' then
      v_issues := array_append(v_issues, 'EX-K1-MID-V1 合同规定听力状态不得标记为 formal');
    end if;
  elsif v_is_chapter_exam then
    if v_paper.total_points <> 100 then
      v_issues := array_append(v_issues, '正式章节考试总分必须等于100分');
    end if;
    if (
      select count(distinct question.skill)
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill in (
          'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
        )
    ) <> 6 then
      v_issues := array_append(v_issues, '单词、语法、听力、口语、阅读、写作六项不齐全');
    end if;
    if exists (
      select required.skill
      from (values
        ('vocabulary', 15::numeric), ('grammar', 20::numeric),
        ('listening', 15::numeric), ('speaking', 15::numeric),
        ('reading', 20::numeric), ('writing', 15::numeric)
      ) as required(skill, points)
      left join (
        select question.skill, sum(question.points) as points
        from public.assessment_paper_questions as question
        where question.paper_id = p_paper_id
        group by question.skill
      ) as actual using (skill)
      where coalesce(actual.points, 0) <> required.points
    ) then
      v_issues := array_append(v_issues,
        '六项分值必须为单词15、语法20、听力15、口语15、阅读20、写作15');
    end if;
  elsif v_paper.paper_type = 'homework' then
    if (
      select count(distinct question.skill)
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill in (
          'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
        )
    ) <> 6 then
      v_issues := array_append(v_issues, '章节作业的词汇、语法、听说读写六项内容不完整');
    end if;
    if exists (
      select 1 from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill = 'listening'
        and nullif(btrim(question.stimulus_text), '') is null
    ) then
      v_issues := array_append(v_issues, '章节作业的听力题缺少韩语听力材料');
    end if;
  end if;

  return v_issues;
end;
$function$

