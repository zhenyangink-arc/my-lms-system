-- D5 回滚。若已有数学题（question_type 为 math.*），先删除这些题及其作答，否则收紧约束会失败。
begin;
drop function if exists public.record_learning_machine_grade(uuid, text, text, text, numeric, text, jsonb);
drop function if exists public.set_math_question_spec(uuid, text, jsonb);
drop table if exists public.learning_submission_machine_grades;
drop table if exists public.math_question_specs;
drop function if exists private.check_math_question_spec_type();
alter table public.learning_assignment_questions
  drop constraint learning_assignment_questions_question_type_check;
alter table public.learning_assignment_questions
  add constraint learning_assignment_questions_question_type_check
  check (question_type = any (array['short_text', 'long_text', 'single_choice', 'file_link', 'audio_recording']));
commit;
