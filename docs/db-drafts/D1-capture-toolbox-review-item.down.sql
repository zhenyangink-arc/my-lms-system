-- D1 回滚：恢复 capture_toolbox_review_item 的原定义（取自 202608190017_unified_student_review_center.sql 应用后的数据库定义）
begin;
CREATE OR REPLACE FUNCTION private.capture_toolbox_review_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_question public.growth_toolbox_questions%rowtype;
  v_key public.growth_toolbox_question_keys%rowtype;
  v_exercise public.growth_toolbox_exercises%rowtype;
  v_student_app_id uuid;
begin
  if new.is_correct is distinct from false or new.question_id is null then
    return new;
  end if;
  begin
    select * into v_question
    from public.growth_toolbox_questions where id = new.question_id;
    select * into v_key
    from public.growth_toolbox_question_keys where question_id = new.question_id;
    select * into v_exercise
    from public.growth_toolbox_exercises where id = v_question.exercise_id;
    v_student_app_id := coalesce(
      v_exercise.student_app_id,
      '10000000-0000-4000-8000-000000000001'::uuid
    );

    perform private.merge_student_review_item(
      new.tenant_id, new.student_id, v_student_app_id,
      'specialized_practice', v_exercise.id, v_question.id,
      v_exercise.course_id, v_exercise.course_chapter_id,
      coalesce(v_question.primary_skill, new.skill),
      jsonb_build_object(
        'sourceVersion', 1,
        'sourceSessionId', new.session_id,
        'sourceAttemptId', new.id,
        'sourceTitle', v_exercise.title,
        'prompt', v_question.prompt,
        'questionType', v_question.question_type,
        'content', v_question.content_payload,
        'maxScore', v_question.max_score
      ),
      new.response_payload,
      jsonb_build_object(
        'acceptedAnswers', v_key.accepted_answers,
        'rubric', v_key.rubric,
        'explanation', v_key.explanation,
        'earnedScore', new.earned_score,
        'maxScore', new.max_score
      ),
      new.answered_at, 1, new.answered_at
    );
  exception when others then
    raise warning 'toolbox review capture skipped for attempt %: %', new.id, sqlerrm;
  end;
  return new;
end;
$function$

;
commit;
