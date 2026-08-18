begin;

-- 第一章试运行只生成草稿。平台负责人仍需在管理页面完成最终质检和发布。
do $$
declare
  v_owner_id uuid;
  v_test public.chapter_tests%rowtype;
  v_plan public.chapter_homework_plans%rowtype;
  v_paper_id uuid;
  v_paper_question_id uuid;
  v_question record;
  v_sort_order integer;
begin
  select profile.id into v_owner_id
  from public.profiles as profile
  where profile.global_role = 'platform_owner'
    and coalesce(profile.status, 'active') = 'active'
  order by profile.created_at
  limit 1;
  if v_owner_id is null then
    raise exception '生成第一章试运行试卷前需要一名有效的平台负责人';
  end if;

  select test.* into v_test
  from public.chapter_tests as test
  where test.student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
    and test.slug = 'korean-level-one-01'
    and test.status = 'published';
  if v_test.id is null then
    raise exception '韩国语一级第一章正式题库不存在或尚未发布';
  end if;

  select plan.* into v_plan
  from public.chapter_homework_plans as plan
  where plan.test_id = v_test.id;
  if v_plan.id is null then
    raise exception '韩国语一级第一章六项作业源稿不存在';
  end if;

  if not exists (
    select 1 from public.assessment_papers
    where source_homework_plan_id = v_plan.id
  ) then
    insert into public.assessment_papers (
      paper_code, paper_type, title, description, source_test_id,
      source_homework_plan_id, student_app_id, duration_minutes,
      passing_score, allow_resubmission, total_points, question_count,
      version, status, created_by, updated_by
    ) values (
      'HW-K1-01-V1', 'homework', '韩国语一级第01章标准作业：你好？',
      '完成本章全部核心词汇、两轮语法，以及听力、口语、阅读和写作练习。',
      v_test.id, v_plan.id, v_test.student_app_id, v_plan.duration_minutes,
      v_plan.passing_score, v_plan.allow_resubmission, 0, 0, 1, 'draft',
      v_owner_id, v_owner_id
    ) returning id into v_paper_id;

    v_sort_order := 0;
    for v_question in
      select question.*
      from public.chapter_homework_questions as question
      where question.plan_id = v_plan.id
      order by case question.language_skill
        when 'vocabulary' then 1
        when 'grammar' then 2
        when 'listening' then 3
        when 'speaking' then 4
        when 'reading' then 5
        when 'writing' then 6
      end, question.sort_order
    loop
      insert into public.assessment_paper_questions (
        paper_id, source_bank_question_id, source_bank_version, question_type,
        stimulus_text, prompt, options, points, sort_order, difficulty, skill
      ) values (
        v_paper_id, v_question.source_bank_question_id,
        coalesce(v_question.source_bank_version, 1), v_question.question_type,
        v_question.stimulus_text, left(v_question.prompt, 3000),
        v_question.options, v_question.points, v_sort_order,
        v_question.difficulty, v_question.language_skill
      ) returning id into v_paper_question_id;

      insert into public.assessment_paper_question_keys (
        question_id, correct_answer, explanation
      ) values (
        v_paper_question_id, v_question.correct_answer,
        left(v_question.explanation, 3000)
      );
      v_sort_order := v_sort_order + 1;
    end loop;

    update public.assessment_papers
    set question_count = v_sort_order,
        total_points = (
          select coalesce(sum(question.points), 0)
          from public.assessment_paper_questions as question
          where question.paper_id = v_paper_id
        ),
        updated_at = now()
    where id = v_paper_id;
  end if;

  if not exists (
    select 1 from public.assessment_papers
    where paper_code = 'EX-K1-01-V1'
  ) then
    insert into public.assessment_papers (
      paper_code, paper_type, title, description, source_test_id,
      student_app_id, duration_minutes, passing_score, allow_resubmission,
      total_points, question_count, version, status, created_by, updated_by
    ) values (
      'EX-K1-01-V1', 'exam', '韩国语一级第01章章节考试：你好？',
      '检查本章问候、人物身份、主题判断、姓名和身份介绍等学习目标。',
      v_test.id, v_test.student_app_id, v_test.duration_minutes,
      v_test.passing_score, false, 0, 0, 1, 'draft', v_owner_id, v_owner_id
    ) returning id into v_paper_id;

    v_sort_order := 0;
    for v_question in
      select question.*
      from public.chapter_test_questions as question
      where question.test_id = v_test.id
        and question.status = 'published'
      order by question.sort_order
    loop
      insert into public.assessment_paper_questions (
        paper_id, source_bank_question_id, source_bank_version, question_type,
        prompt, options, points, sort_order, difficulty, skill
      ) values (
        v_paper_id, v_question.id, v_question.version,
        v_question.question_type, v_question.prompt, v_question.options,
        v_question.default_points, v_sort_order,
        v_question.difficulty, v_question.skill
      ) returning id into v_paper_question_id;

      insert into public.assessment_paper_question_keys (
        question_id, correct_answer, explanation
      ) values (
        v_paper_question_id,
        case when v_question.question_type = 'single_choice'
          then v_question.options ->> v_question.correct_option
          else v_question.correct_answer end,
        nullif(v_question.explanation, '')
      );
      v_sort_order := v_sort_order + 1;
    end loop;

    update public.assessment_papers
    set question_count = v_sort_order,
        total_points = (
          select coalesce(sum(question.points), 0)
          from public.assessment_paper_questions as question
          where question.paper_id = v_paper_id
        ),
        updated_at = now()
    where id = v_paper_id;
  end if;
end;
$$;

commit;
