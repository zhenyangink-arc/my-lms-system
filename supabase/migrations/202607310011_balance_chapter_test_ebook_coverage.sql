-- 韩国语 1 级章节测试按电子书内容均衡抽题，并修复机械拼接的中等词汇干扰项。

update public.chapter_test_questions as question
set ebook_section_step = case
  when question.skill = 'vocabulary' then 'STEP 02'
  when question.skill = 'grammar'
    and substring(question.question_key from 2)::integer between 9 and 11
    then 'STEP 04'
  when question.skill = 'grammar' then 'STEP 03'
  when question.skill = 'communication' then 'STEP 05'
  else 'STEP 08'
end
where exists (
  select 1
  from public.chapter_tests as test
  where test.id = question.test_id
    and test.course_key = 'korean-level-one'
);

-- 每档 5 道正式题：2 道语法、2 道词汇、1 道情境，共 10 道。
update public.chapter_test_questions as question
set is_chapter_test_item = question.question_key in (
  'f01', 'f02', 'f12', 'f15', 'f18',
  'm01', 'm02', 'm12', 'm15', 'm18'
)
where exists (
  select 1
  from public.chapter_tests as test
  where test.id = question.test_id
    and test.course_key = 'korean-level-one'
);

with vocabulary_questions as (
  select
    question.id,
    question.test_id,
    test.chapter_number,
    question.options ->> question.correct_option as correct_text
  from public.chapter_test_questions as question
  join public.chapter_tests as test on test.id = question.test_id
  where test.course_key = 'korean-level-one'
    and question.question_key in ('m15', 'm16', 'm17')
),
replacement as (
  select
    target.id,
    target.chapter_number,
    target.correct_text,
    (
      select jsonb_agg(candidate.correct_text order by candidate.rank)
      from (
        select pool.correct_text, row_number() over (order by md5(pool.correct_text || target.id::text)) as rank
        from (
          select distinct other.correct_text
          from vocabulary_questions as other
          where other.test_id <> target.test_id
            and other.correct_text <> target.correct_text
        ) as pool
        order by md5(pool.correct_text || target.id::text)
        limit 3
      ) as candidate
    ) as distractors
  from vocabulary_questions as target
)
update public.chapter_test_questions as question
set
  prompt = format(
    '[중급] 제%s과의 핵심 어휘로 알맞은 것을 고르세요.',
    replacement.chapter_number
  ),
  options = jsonb_build_array(replacement.correct_text) || replacement.distractors,
  correct_option = 0,
  explanation = format(
    '정답은 “%s”입니다. 이 표현은 제%s과의 핵심 어휘입니다.',
    replacement.correct_text,
    replacement.chapter_number
  ),
  ebook_section_step = 'STEP 02',
  version = question.version + 1,
  updated_at = now()
from replacement
where question.id = replacement.id;

comment on column public.chapter_test_questions.is_chapter_test_item is
  '学生章节测试抽题范围；韩国语1级每档覆盖语法、词汇和情境。';
