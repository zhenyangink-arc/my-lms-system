begin;

create or replace function public.submit_toolbox_practice(
  p_exercise_id uuid,
  p_answers jsonb,
  p_active_seconds integer,
  p_client_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid := private.current_tenant_id();
  v_exercise public.growth_toolbox_exercises%rowtype;
  v_session_id uuid;
  v_existing public.toolbox_practice_sessions%rowtype;
  v_answer jsonb;
  v_question record;
  v_question_id uuid;
  v_response text;
  v_normalized_response text;
  v_is_correct boolean;
  v_answered integer := 0;
  v_correct integer := 0;
  v_earned numeric := 0;
  v_max numeric := 0;
  v_item_count integer := 0;
begin
  if v_user_id is null or v_tenant_id is null then
    raise exception '请登录有效的机构账号后再提交练习';
  end if;

  if not exists (
    select 1
    from public.tenant_memberships as membership
    where membership.tenant_id = v_tenant_id
      and membership.user_id = v_user_id
      and membership.status = 'active'
      and membership.role = 'student'
  ) then
    raise exception '只有当前机构的学生账号可以提交练习';
  end if;

  if p_exercise_id is null or p_client_event_id is null then
    raise exception '练习编号不完整';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    raise exception '练习答案格式不正确';
  end if;
  if jsonb_array_length(p_answers) > 100 then
    raise exception '练习答案数量超过限制';
  end if;
  if coalesce(p_active_seconds, 0) not between 0 and 7200 then
    raise exception '练习时间不正确';
  end if;

  select * into v_exercise
  from public.growth_toolbox_exercises as exercise
  where exercise.id = p_exercise_id
    and exercise.status = 'published'
    and (exercise.tenant_id is null or exercise.tenant_id = v_tenant_id)
    and private.current_user_can_read_student_app(exercise.student_app_id);

  if v_exercise.id is null then
    raise exception '练习不存在、尚未发布或当前应用无权访问';
  end if;

  select count(*)::integer, coalesce(sum(question.max_score), 0)
    into v_item_count, v_max
  from public.growth_toolbox_questions as question
  where question.exercise_id = p_exercise_id;

  if v_item_count = 0 then
    raise exception '练习尚未配置题目';
  end if;

  insert into public.toolbox_practice_sessions (
    tenant_id,
    student_id,
    student_app_id,
    exercise_id,
    skill,
    status,
    active_seconds,
    item_count,
    answered_count,
    correct_count,
    earned_score,
    max_score,
    client_event_id,
    completed_at
  ) values (
    v_tenant_id,
    v_user_id,
    v_exercise.student_app_id,
    p_exercise_id,
    v_exercise.skill,
    'started',
    coalesce(p_active_seconds, 0),
    v_item_count,
    0,
    0,
    0,
    v_max,
    p_client_event_id,
    null
  )
  on conflict (tenant_id, student_id, client_event_id) do nothing
  returning id into v_session_id;

  if v_session_id is null then
    select * into v_existing
    from public.toolbox_practice_sessions
    where tenant_id = v_tenant_id
      and student_id = v_user_id
      and client_event_id = p_client_event_id;

    return jsonb_build_object(
      'sessionId', v_existing.id,
      'answeredCount', v_existing.answered_count,
      'correctCount', v_existing.correct_count,
      'earnedScore', v_existing.earned_score,
      'maxScore', v_existing.max_score,
      'percentage', case when v_existing.max_score > 0
        then round(v_existing.earned_score / v_existing.max_score * 100, 1)
        else 0 end,
      'duplicate', true
    );
  end if;

  for v_answer in
    select value from jsonb_array_elements(p_answers)
  loop
    begin
      v_question_id := (v_answer->>'questionId')::uuid;
    exception when others then
      continue;
    end;

    select
      question.id,
      question.primary_skill,
      question.question_type,
      question.max_score,
      answer_key.accepted_answers
    into v_question
    from public.growth_toolbox_questions as question
    join public.growth_toolbox_question_keys as answer_key
      on answer_key.question_id = question.id
    where question.id = v_question_id
      and question.exercise_id = p_exercise_id;

    if v_question.id is null then
      continue;
    end if;

    v_response := trim(coalesce(v_answer->>'response', ''));
    if v_response = '' then
      continue;
    end if;

    v_normalized_response := lower(
      regexp_replace(v_response, '[[:space:][:punct:]，。！？、]+', '', 'g')
    );
    select exists (
      select 1
      from jsonb_array_elements_text(v_question.accepted_answers) as accepted(value)
      where lower(
        regexp_replace(accepted.value, '[[:space:][:punct:]，。！？、]+', '', 'g')
      ) = v_normalized_response
    ) into v_is_correct;

    v_answered := v_answered + 1;
    v_correct := v_correct + case when v_is_correct then 1 else 0 end;
    v_earned := v_earned + case when v_is_correct then v_question.max_score else 0 end;

    insert into public.toolbox_practice_attempts (
      tenant_id,
      session_id,
      student_id,
      question_id,
      skill,
      response_payload,
      is_correct,
      earned_score,
      max_score,
      duration_seconds,
      evaluated_by
    ) values (
      v_tenant_id,
      v_session_id,
      v_user_id,
      v_question.id,
      v_question.primary_skill,
      jsonb_build_object('value', v_response),
      v_is_correct,
      case when v_is_correct then v_question.max_score else 0 end,
      v_question.max_score,
      case
        when coalesce(v_answer->>'durationSeconds', '') ~ '^[0-9]+$'
          then least((v_answer->>'durationSeconds')::integer, 7200)
        else 0
      end,
      'automatic'
    );
  end loop;

  update public.toolbox_practice_sessions
  set
    status = 'completed',
    answered_count = v_answered,
    correct_count = v_correct,
    earned_score = v_earned,
    completed_at = now(),
    updated_at = now()
  where id = v_session_id;

  return jsonb_build_object(
    'sessionId', v_session_id,
    'answeredCount', v_answered,
    'correctCount', v_correct,
    'earnedScore', v_earned,
    'maxScore', v_max,
    'percentage', case when v_max > 0
      then round(v_earned / v_max * 100, 1)
      else 0 end,
    'duplicate', false
  );
end;
$$;

revoke all on function public.submit_toolbox_practice(uuid, jsonb, integer, uuid)
  from public, anon;
grant execute on function public.submit_toolbox_practice(uuid, jsonb, integer, uuid)
  to authenticated;

comment on function public.submit_toolbox_practice(uuid, jsonb, integer, uuid) is
  '提交专项训练；数据库核验学生、机构、应用权限和私有答案，并写入对应 student_app_id。';

commit;
