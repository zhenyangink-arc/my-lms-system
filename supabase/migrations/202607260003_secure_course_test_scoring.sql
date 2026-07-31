begin;

revoke insert on public.course_test_attempts from authenticated;
drop policy if exists "students record own course test attempts"
  on public.course_test_attempts;

create or replace function public.submit_course_test(
  p_test_slug text,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid := private.current_tenant_id();
  v_test public.course_tests%rowtype;
  v_question public.course_test_questions%rowtype;
  v_selected integer;
  v_correct boolean;
  v_correct_count integer := 0;
  v_total_questions integer := 0;
  v_score integer;
  v_passed boolean;
  v_results jsonb := '[]'::jsonb;
  v_dimensions jsonb := '{}'::jsonb;
  v_dimension_scores jsonb := '{}'::jsonb;
  v_dimension_key text;
  v_dimension_value jsonb;
  v_dimension_correct integer;
  v_dimension_total integer;
  v_attempt_id uuid;
begin
  if v_user_id is null or v_tenant_id is null then
    raise exception '请登录有效的机构账号后再提交测试';
  end if;

  if jsonb_typeof(p_answers) is distinct from 'object' then
    raise exception '答案格式不正确';
  end if;

  select *
  into v_test
  from public.course_tests
  where slug = p_test_slug
    and status = 'published';

  if not found then
    raise exception '没有找到这份章节测试';
  end if;

  select count(*)
  into v_total_questions
  from public.course_test_questions
  where test_id = v_test.id;

  if v_total_questions = 0
    or (select count(*) from jsonb_object_keys(p_answers)) <> v_total_questions then
    raise exception '请完成全部题目后再交卷';
  end if;

  for v_question in
    select *
    from public.course_test_questions
    where test_id = v_test.id
    order by sort_order
  loop
    if not (p_answers ? v_question.question_key) then
      raise exception '请完成全部题目后再交卷';
    end if;

    begin
      v_selected := (p_answers ->> v_question.question_key)::integer;
    exception
      when invalid_text_representation then
        raise exception '有一道题的答案格式不正确';
    end;

    if v_selected < 0
      or v_selected >= jsonb_array_length(v_question.options) then
      raise exception '有一道题的选项不正确';
    end if;

    v_correct := v_selected = v_question.correct_option;
    if v_correct then
      v_correct_count := v_correct_count + 1;
    end if;

    v_dimension_correct :=
      coalesce((v_dimensions -> v_question.skill ->> 'correct')::integer, 0)
      + case when v_correct then 1 else 0 end;
    v_dimension_total :=
      coalesce((v_dimensions -> v_question.skill ->> 'total')::integer, 0) + 1;
    v_dimensions := jsonb_set(
      v_dimensions,
      array[v_question.skill],
      jsonb_build_object(
        'label', coalesce(v_test.skills ->> v_question.skill, v_question.skill),
        'correct', v_dimension_correct,
        'total', v_dimension_total
      ),
      true
    );

    v_results := v_results || jsonb_build_array(
      jsonb_build_object(
        'id', v_question.question_key,
        'selectedOption', v_selected,
        'correctOption', v_question.correct_option,
        'correct', v_correct,
        'explanation', v_question.explanation
      )
    );
  end loop;

  v_score := round(
    (v_correct_count::numeric / v_total_questions::numeric) * 100
  );
  v_passed := v_score >= v_test.passing_score;

  for v_dimension_key, v_dimension_value in
    select key, value
    from jsonb_each(v_dimensions)
  loop
    v_dimension_correct := (v_dimension_value ->> 'correct')::integer;
    v_dimension_total := (v_dimension_value ->> 'total')::integer;
    v_dimension_scores := jsonb_set(
      v_dimension_scores,
      array[v_dimension_key],
      v_dimension_value || jsonb_build_object(
        'percent',
        round(
          (v_dimension_correct::numeric / v_dimension_total::numeric) * 100
        )
      ),
      true
    );
  end loop;

  insert into public.course_test_attempts (
    tenant_id,
    student_id,
    test_id,
    test_slug,
    test_version,
    score,
    correct_count,
    total_questions,
    passed,
    answers,
    dimension_scores
  )
  values (
    v_tenant_id,
    v_user_id,
    v_test.id,
    v_test.slug,
    v_test.version,
    v_score,
    v_correct_count,
    v_total_questions,
    v_passed,
    p_answers,
    v_dimension_scores
  )
  returning id into v_attempt_id;

  return jsonb_build_object(
    'attemptId', v_attempt_id,
    'score', v_score,
    'correctCount', v_correct_count,
    'totalQuestions', v_total_questions,
    'passed', v_passed,
    'dimensionScores', v_dimension_scores,
    'questions', v_results
  );
end;
$$;

revoke all on function public.submit_course_test(text, jsonb) from public;
grant execute on function public.submit_course_test(text, jsonb) to authenticated;

comment on function public.submit_course_test(text, jsonb) is
  '在数据库内部读取答案键、评分并记录课程测试，防止客户端直接写入伪造成绩。';

commit;
