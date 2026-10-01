-- D1（草稿，未进入 supabase/migrations）：删除 capture_toolbox_review_item 的韩语兜底。
-- 背景：growth_toolbox_exercises.student_app_id 非空，题目又以外键挂在练习上，
-- 原 coalesce(..., 韩语应用) 只会在找不到练习时生效，实际不可达；去掉后学科归属只来自练习本身。
-- 正式迁移须在 Codex 线收尾后按 Architecture Gate 流程提交。
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
    -- 练习的应用归属是非空字段；找不到练习时不再兜底到韩语应用，直接跳过。
    if v_exercise.id is null then
      return new;
    end if;
    v_student_app_id := v_exercise.student_app_id;

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
