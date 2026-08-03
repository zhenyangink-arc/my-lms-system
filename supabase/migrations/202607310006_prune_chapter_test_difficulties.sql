begin;

-- The current standard bank is used as the chapter-test pool. Keep only the
-- two teaching levels that are exposed by chapter-test management.
-- Preserve existing selections where possible, then fill every chapter to a
-- balanced 5 foundation + 5 medium test before removing the unused rows.
with ranked_questions as (
  select
    question.id,
    row_number() over (
      partition by question.test_id, question.difficulty
      order by question.is_chapter_test_item desc, question.sort_order, question.id
    ) as difficulty_rank
  from public.course_test_questions as question
  where question.status = 'published'
    and question.question_type = 'single_choice'
    and question.difficulty in ('foundation', 'medium')
), selected_questions as (
  select id
  from ranked_questions
  where difficulty_rank <= 5
)
update public.course_test_questions as question
set is_chapter_test_item = exists (
      select 1
      from selected_questions
      where selected_questions.id = question.id
    ),
    updated_at = now()
where question.difficulty in ('foundation', 'medium');

update public.course_tests as test
set version = test.version + 1,
    updated_at = now()
where exists (
  select 1
  from public.course_test_questions as question
  where question.test_id = test.id
    and question.difficulty in ('hard', 'expert')
);

delete from public.course_test_questions
where difficulty in ('hard', 'expert');

commit;
