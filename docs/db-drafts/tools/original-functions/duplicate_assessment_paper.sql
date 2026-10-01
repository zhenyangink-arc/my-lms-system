CREATE OR REPLACE FUNCTION public.duplicate_assessment_paper(p_paper_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_source public.assessment_papers%rowtype;
  v_new_id uuid;
  v_new_code text;
begin
  if not public.current_user_can_manage_assessment_papers() then
    raise exception '当前账号不能复制标准试卷';
  end if;
  select * into v_source from public.assessment_papers
  where id = p_paper_id for update;
  if not found then raise exception '试卷不存在'; end if;

  v_new_code := case
    when v_source.paper_code ~ '^(HW|EX)-K1-((0[1-9]|1[0-6])|ST0[1-4]|MID|FIN)-V[0-9]+$'
      then regexp_replace(v_source.paper_code, '-V[0-9]+$',
        '-V' || (v_source.version + 1)::text)
    else (case when v_source.paper_type = 'homework' then 'HW-' else 'EX-' end)
      || lpad(nextval('public.assessment_paper_code_seq')::text, 6, '0')
  end;

  insert into public.assessment_papers (
    paper_code, paper_type, title, description, source_test_id,
    student_app_id, duration_minutes, passing_score, allow_resubmission,
    resubmission_policy_configured, total_points, question_count, version,
    status, created_by, updated_by
  ) values (
    v_new_code, v_source.paper_type, left(v_source.title || '（新版本）', 120),
    v_source.description, v_source.source_test_id, v_source.student_app_id,
    v_source.duration_minutes, v_source.passing_score, v_source.allow_resubmission,
    v_source.resubmission_policy_configured, v_source.total_points,
    v_source.question_count, v_source.version + 1, 'draft', auth.uid(), auth.uid()
  ) returning id into v_new_id;

  with copied as (
    insert into public.assessment_paper_questions (
      paper_id, source_bank_question_id, source_bank_version, question_type,
      stimulus_text, prompt, options, points, sort_order, difficulty, skill,
      audio_status, question_code, source_chapters, source_knowledge
    )
    select v_new_id, source_bank_question_id, source_bank_version, question_type,
      stimulus_text, prompt, options, points, sort_order, difficulty, skill,
      audio_status, question_code, source_chapters, source_knowledge
    from public.assessment_paper_questions where paper_id = p_paper_id
    order by sort_order returning id, sort_order
  )
  insert into public.assessment_paper_question_keys (
    question_id, correct_answer, explanation, rubric_snapshot
  )
  select copied.id, source_key.correct_answer, source_key.explanation,
    source_key.rubric_snapshot
  from copied
  join public.assessment_paper_questions as source_question
    on source_question.paper_id = p_paper_id
   and source_question.sort_order = copied.sort_order
  join public.assessment_paper_question_keys as source_key
    on source_key.question_id = source_question.id;

  return v_new_id;
end;
$function$

