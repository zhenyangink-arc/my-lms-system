begin;

-- 专项训练必须能够明确回到一门课程和一个章节。digital_textbook_chapters
-- 只覆盖已制作数字教材的章节，不能作为全课程的稳定关联，因此直接关联章节测试。
alter table public.growth_toolbox_exercises
  add column if not exists chapter_test_id uuid
    references public.chapter_tests(id) on delete cascade;

create index if not exists growth_toolbox_exercises_chapter_test_idx
  on public.growth_toolbox_exercises (student_app_id, skill, chapter_test_id)
  where status = 'published';

with skill_catalog(skill, label, instruction, skill_order) as (
  values
    ('listening',  '听力', '播放韩语材料后作答；可以重复播放，再根据本章知识判断。', 1),
    ('speaking',   '口语', '先大声读出或说出答案，再选择最符合本章情境的表达。', 2),
    ('reading',    '阅读', '阅读本章题干与表达，完成信息理解和规则判断。', 3),
    ('writing',    '写作', '先独立写出答案，再输入本章对应的韩语表达。', 4),
    ('grammar',    '语法', '围绕本章结构、助词和句型完成规则辨析。', 5),
    ('vocabulary', '词汇', '按本章语境辨认核心词语、字母和常用表达。', 6)
), chapter_catalog as (
  select
    test.*,
    lesson.course_id
  from public.chapter_tests as test
  left join public.lessons as lesson on lesson.id = test.lesson_id
  where test.status = 'published'
    and test.student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
)
insert into public.growth_toolbox_exercises (
  tenant_id,
  student_app_id,
  slug,
  skill,
  title,
  description,
  instructions,
  difficulty,
  source,
  course_id,
  chapter_test_id,
  content_payload,
  status,
  sort_order
)
select
  null,
  chapter.student_app_id,
  'chapter-' || chapter.slug || '-' || skill.skill,
  skill.skill,
  chapter.title || ' · ' || skill.label || '训练',
  case chapter.course_key
    when 'hangul-introduction' then '韩语字母入门'
    when 'korean-level-one' then '韩国语1级'
    else chapter.course_key
  end || ' · 第 ' || chapter.chapter_number || ' 章专项练习',
  skill.instruction,
  case
    when chapter.course_key = 'hangul-introduction' then 'beginner'
    when chapter.chapter_number <= 6 then 'beginner'
    when chapter.chapter_number <= 12 then 'intermediate'
    else 'advanced'
  end,
  'textbook',
  chapter.course_id,
  chapter.id,
  jsonb_build_object(
    'courseKey', chapter.course_key,
    'chapterSlug', chapter.slug,
    'chapterNumber', chapter.chapter_number,
    'chapterTitle', chapter.title,
    'chapterKoreanTitle', chapter.korean_title,
    'chapterDescription', chapter.description,
    'focus', coalesce(chapter.skills, '{}'::jsonb),
    'practiceMode', skill.skill
  ),
  'published',
  chapter.chapter_number * 10 + skill.skill_order
from chapter_catalog as chapter
cross join skill_catalog as skill
on conflict (tenant_id, student_app_id, slug) do update set
  skill = excluded.skill,
  title = excluded.title,
  description = excluded.description,
  instructions = excluded.instructions,
  difficulty = excluded.difficulty,
  source = excluded.source,
  course_id = excluded.course_id,
  chapter_test_id = excluded.chapter_test_id,
  content_payload = excluded.content_payload,
  status = excluded.status,
  sort_order = excluded.sort_order,
  updated_at = now();

-- 每个章节、每项能力选取五道最匹配的正式章节题。听力保留朗读材料，
-- 写作改为输入正确韩语表达，其余能力使用选择题并继续由私有答案表评分。
with source_candidates as (
  select
    exercise.id as exercise_id,
    exercise.skill as target_skill,
    question.id as source_question_id,
    question.prompt,
    question.options,
    question.correct_option,
    question.explanation,
    question.skill as source_skill,
    row_number() over (
      partition by exercise.id
      order by
        case exercise.skill
          when 'vocabulary' then
            case when lower(question.skill) = 'vocabulary' or question.skill in ('recognition', '字母辨认', '字母分类') then 0 else 1 end
          when 'grammar' then
            case when lower(question.skill) = 'grammar' or question.skill in ('structure', 'rules', 'batchim', '音节结构', '收音规则', '发音规则') then 0 else 1 end
          when 'speaking' then
            case when lower(question.skill) = 'communication' or question.skill in ('assembly', '实际拼读', '字母拼合') then 0 else 1 end
          when 'writing' then
            case when lower(question.skill) in ('grammar', 'communication') or question.skill in ('assembly', 'structure', '字母拼合', '音节结构') then 0 else 1 end
          when 'reading' then
            case when lower(question.skill) = 'reading' or question.skill in ('实际拼读', 'strategy', '判断流程') then 0 else 1 end
          else 0
        end,
        question.sort_order,
        question.id
    )::integer as question_rank
  from public.growth_toolbox_exercises as exercise
  join public.chapter_test_questions as question
    on question.test_id = exercise.chapter_test_id
  where exercise.student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
    and exercise.tenant_id is null
    and exercise.status = 'published'
    and exercise.chapter_test_id is not null
    and question.status = 'published'
    and question.question_type = 'single_choice'
    and question.correct_option is not null
), selected_source as (
  select * from source_candidates where question_rank <= 5
)
insert into public.growth_toolbox_questions (
  exercise_id,
  primary_skill,
  question_type,
  prompt,
  content_payload,
  max_score,
  difficulty,
  sort_order
)
select
  source.exercise_id,
  source.target_skill,
  case when source.target_skill = 'writing' then 'short_text' else 'single_choice' end,
  case source.target_skill
    when 'listening' then '听材料后，选择最合适的答案。'
    when 'speaking' then '先开口说出答案，再选择最符合本章情境的表达。'
    when 'writing' then source.prompt || ' 请写出正确的韩语答案。'
    else source.prompt
  end,
  jsonb_build_object(
    'options', case
      when source.target_skill = 'writing' then '[]'::jsonb
      else coalesce((
        select jsonb_agg(
          jsonb_build_object('value', option.value, 'label', option.value)
          order by option.ordinality
        )
        from jsonb_array_elements_text(source.options)
          with ordinality as option(value, ordinality)
      ), '[]'::jsonb)
    end,
    'hint', case
      when source.target_skill = 'writing' then '请先独立书写，再输入完整答案。'
      when source.target_skill = 'speaking' then '选择前先把答案大声说一遍。'
      else '本题对应：' || coalesce(nullif(source.source_skill, ''), '本章重点')
    end,
    'stimulus', case when source.target_skill = 'listening' then source.prompt else '' end,
    'speakBeforeAnswer', source.target_skill = 'speaking',
    'sourceQuestionId', source.source_question_id
  ),
  20,
  'beginner',
  source.question_rank
from selected_source as source
on conflict (exercise_id, sort_order) do update set
  primary_skill = excluded.primary_skill,
  question_type = excluded.question_type,
  prompt = excluded.prompt,
  content_payload = excluded.content_payload,
  max_score = excluded.max_score,
  difficulty = excluded.difficulty,
  updated_at = now();

insert into public.growth_toolbox_question_keys (
  question_id,
  accepted_answers,
  rubric,
  explanation
)
select
  question.id,
  jsonb_build_array(
    source.options ->> source.correct_option
  ),
  jsonb_build_object(
    'sourceQuestionId', source.id,
    'chapterAligned', true
  ),
  source.explanation
from public.growth_toolbox_questions as question
join public.chapter_test_questions as source
  on source.id = (question.content_payload ->> 'sourceQuestionId')::uuid
join public.growth_toolbox_exercises as exercise
  on exercise.id = question.exercise_id
where exercise.student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
  and exercise.chapter_test_id is not null
on conflict (question_id) do update set
  accepted_answers = excluded.accepted_answers,
  rubric = excluded.rubric,
  explanation = excluded.explanation,
  updated_at = now();

comment on column public.growth_toolbox_exercises.chapter_test_id is
  '专项训练对应的正式课程章节；用于保持六项能力、课程、章节和解锁顺序一致。';

commit;
