begin;

-- 正式章节考试需要在快照中明确记录听力音频状态。当前批次只有已确认文本和
-- 临时语音，后续替换正式录音时必须复制为新版本，不能改写已发布快照。
alter table public.assessment_paper_questions
  add column if not exists audio_status text not null default 'not_applicable';

alter table public.assessment_paper_questions
  drop constraint if exists assessment_paper_questions_audio_status_check;

alter table public.assessment_paper_questions
  add constraint assessment_paper_questions_audio_status_check
    check (audio_status in ('not_applicable', 'pending', 'temporary', 'formal'));

comment on column public.assessment_paper_questions.audio_status is
  '听力快照的音频状态；temporary/pending 不得被误认为正式录音。';

-- 第2至16章各生成一套六项正式章节考试草稿。题目来自已确认的六项章节源稿，
-- 只抽取代表题，不把核心词汇练习和两轮语法练习原样全部搬入正式考试。
do $$
declare
  v_owner_id uuid;
  v_test public.chapter_tests%rowtype;
  v_plan public.chapter_homework_plans%rowtype;
  v_paper_id uuid;
  v_paper_question_id uuid;
  v_question record;
  v_sort_order integer;
  v_chapter_code text;
  v_chapter_title text;
  v_options jsonb;
  v_points numeric(8,2);
  v_target_points numeric(8,2);
begin
  select profile.id into v_owner_id
  from public.profiles as profile
  where profile.global_role = 'platform_owner'
    and coalesce(profile.status, 'active') = 'active'
  order by profile.created_at
  limit 1;
  if v_owner_id is null then
    raise exception '生成正式章节考试草稿前需要一名有效的平台负责人';
  end if;

  if (
    select count(*)
    from public.chapter_tests as test
    where test.student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
      and test.slug ~ '^korean-level-one-(0[2-9]|1[0-6])$'
      and test.status = 'published'
  ) <> 15 then
    raise exception '韩国语一级第2至16章必须恰好有15个已发布章节源稿';
  end if;

  for v_test in
    select test.*
    from public.chapter_tests as test
    where test.student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
      and test.slug ~ '^korean-level-one-(0[2-9]|1[0-6])$'
      and test.status = 'published'
    order by test.chapter_number
  loop
    v_chapter_code := lpad(v_test.chapter_number::text, 2, '0');
    v_chapter_title := regexp_replace(
      v_test.title,
      '^第[[:space:]]*[0-9]+[[:space:]]*章测试：[[:space:]]*',
      ''
    );

    select plan.* into v_plan
    from public.chapter_homework_plans as plan
    where plan.test_id = v_test.id;
    if v_plan.id is null then
      raise exception '第%章缺少六项权威源稿', v_test.chapter_number;
    end if;

    if (
      select count(distinct question.language_skill)
      from public.chapter_homework_questions as question
      where question.plan_id = v_plan.id
        and question.language_skill in (
          'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
        )
        and (question.language_skill <> 'grammar'
          or nullif(btrim(question.correct_answer), '') is not null)
        and nullif(btrim(question.prompt), '') is not null
    ) <> 6 then
      raise exception '第%章正式考试的六项源题不完整', v_test.chapter_number;
    end if;

    if exists (
      select 1
      from public.chapter_homework_questions as question
      where question.plan_id = v_plan.id
        and question.language_skill in (
          'vocabulary', 'grammar', 'listening', 'reading'
        )
        and (question.language_skill <> 'grammar'
          or nullif(btrim(question.correct_answer), '') is not null)
        and (
          nullif(btrim(question.correct_answer), '') is null
          or nullif(btrim(question.explanation), '') is null
          or (question.language_skill = 'listening'
            and nullif(btrim(question.stimulus_text), '') is null)
        )
    ) then
      raise exception '第%章客观题答案、解析或听力文本不完整', v_test.chapter_number;
    end if;

    if exists (
      select 1 from public.assessment_papers
      where paper_code = 'EX-K1-' || v_chapter_code || '-V1'
    ) then
      raise exception '第%章V1正式考试已经存在；不得覆盖历史试卷，请创建新版本',
        v_test.chapter_number;
    end if;

    insert into public.assessment_papers (
      paper_code, paper_type, title, description, source_test_id,
      student_app_id, duration_minutes, passing_score, allow_resubmission,
      total_points, question_count, version, status, created_by, updated_by
    ) values (
      'EX-K1-' || v_chapter_code || '-V1', 'exam',
      '韩国语一级第' || v_chapter_code || '章正式章节考试：' || v_chapter_title,
      '按单词、语法、听力、口语、阅读和写作六项检查本章学习目标；听力当前使用临时语音。',
      v_test.id, v_test.student_app_id, 40,
      coalesce(v_test.passing_score, 60), false,
      0, 0, 1, 'draft', v_owner_id, v_owner_id
    ) returning id into v_paper_id;

    v_sort_order := 0;
    for v_question in
      with ranked as (
        select
          question.*,
          row_number() over (
            partition by question.language_skill order by question.sort_order, question.id
          ) as skill_rank
        from public.chapter_homework_questions as question
        where question.plan_id = v_plan.id
          and question.language_skill in (
            'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
          )
          and (question.language_skill <> 'grammar'
            or nullif(btrim(question.correct_answer), '') is not null)
      ), selected as (
        select ranked.*
        from ranked
        where ranked.skill_rank <= case ranked.language_skill
          when 'vocabulary' then 5
          when 'grammar' then 4
          when 'listening' then 2
          when 'speaking' then 1
          when 'reading' then 2
          when 'writing' then 1
        end
      )
      select
        selected.*,
        row_number() over (
          partition by selected.language_skill order by selected.skill_rank
        ) as selected_rank,
        count(*) over (partition by selected.language_skill) as selected_count
      from selected
      order by case selected.language_skill
        when 'vocabulary' then 1 when 'grammar' then 2
        when 'listening' then 3 when 'speaking' then 4
        when 'reading' then 5 when 'writing' then 6
      end, selected.skill_rank
    loop
      v_target_points := case v_question.language_skill
        when 'vocabulary' then 15 when 'grammar' then 20
        when 'listening' then 15 when 'speaking' then 15
        when 'reading' then 20 when 'writing' then 15
      end;
      v_points := case
        when v_question.selected_rank = v_question.selected_count then
          v_target_points
            - round(v_target_points / v_question.selected_count, 2)
              * (v_question.selected_count - 1)
        else round(v_target_points / v_question.selected_count, 2)
      end;

      if v_question.language_skill in (
        'vocabulary', 'grammar', 'listening', 'reading'
      ) then
        if jsonb_array_length(v_question.options) >= 2
          and v_question.options @> jsonb_build_array(v_question.correct_answer) then
          v_options := v_question.options;
        else
          select jsonb_agg(choice.answer order by choice.choice_order)
          into v_options
          from (
            select v_question.correct_answer as answer, 0::bigint as choice_order
            union all
            select distractor.correct_answer, distractor.choice_order
            from (
              select distinct on (other.correct_answer)
                other.correct_answer,
                row_number() over (order by other.sort_order, other.id) as choice_order
              from public.chapter_homework_questions as other
              where (
                  other.plan_id = v_plan.id
                  or (
                    v_question.language_skill = 'grammar'
                    and exists (
                      select 1
                      from public.chapter_homework_plans as other_plan
                      join public.chapter_tests as other_test
                        on other_test.id = other_plan.test_id
                      where other_plan.id = other.plan_id
                        and other_test.student_app_id = v_test.student_app_id
                    )
                  )
                )
                and other.language_skill = v_question.language_skill
                and nullif(btrim(other.correct_answer), '') is not null
                and other.correct_answer <> v_question.correct_answer
              order by other.correct_answer, other.sort_order, other.id
              limit 3
            ) as distractor
          ) as choice;
        end if;
        if jsonb_array_length(coalesce(v_options, '[]'::jsonb)) < 2 then
          raise exception '第%章%题缺少可用干扰选项',
            v_test.chapter_number, v_question.language_skill;
        end if;
      else
        v_options := '[]'::jsonb;
      end if;

      insert into public.assessment_paper_questions (
        paper_id, source_bank_question_id, source_bank_version, question_type,
        stimulus_text, prompt, options, points, sort_order, difficulty, skill,
        audio_status
      ) values (
        v_paper_id, v_question.source_bank_question_id,
        coalesce(v_question.source_bank_version, 1),
        case v_question.language_skill
          when 'speaking' then 'audio_recording'
          when 'writing' then 'long_text'
          else 'single_choice'
        end,
        case when v_question.language_skill = 'listening'
          then v_question.stimulus_text else '' end,
        case when v_question.language_skill in (
          'vocabulary', 'grammar', 'listening', 'reading'
        ) then '请选择正确答案：' || left(v_question.prompt, 2988)
        else left(v_question.prompt, 3000) end,
        v_options, v_points, v_sort_order, v_question.difficulty,
        v_question.language_skill,
        case when v_question.language_skill = 'listening'
          then 'temporary' else 'not_applicable' end
      ) returning id into v_paper_question_id;

      insert into public.assessment_paper_question_keys (
        question_id, correct_answer, explanation
      ) values (
        v_paper_question_id,
        case when v_question.language_skill in ('speaking', 'writing')
          then null else v_question.correct_answer end,
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
        where question.paper_id = v_paper_id
        group by question.skill
      ) as actual using (skill)
      where coalesce(actual.points, 0) <> required.points
    ) then
      raise exception '第%章六项正式考试分值配置不正确', v_test.chapter_number;
    end if;
  end loop;

  if (
    select count(*) from public.assessment_papers as paper
    where paper.paper_code ~ '^EX-K1-(0[2-9]|1[0-6])-V1$'
      and paper.paper_type = 'exam'
      and paper.status = 'draft'
      and paper.total_points = 100
  ) <> 15 then
    raise exception '第2至16章的15套正式章节考试草稿没有完整生成';
  end if;
end;
$$;

commit;
