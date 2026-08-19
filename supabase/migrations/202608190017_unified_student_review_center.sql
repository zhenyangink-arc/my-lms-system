begin;

-- 统一归集函数只由本迁移中的受控触发器和 RPC 调用。所有业务触发器都在
-- 自己的异常块中调用它，错题归集失败不会回滚原作答或原批改事务。
create or replace function private.normalize_student_review_skill(p_skill text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when lower(coalesce(p_skill, '')) in (
      'listening', 'speaking', 'reading', 'writing', 'grammar', 'vocabulary'
    ) then lower(p_skill)
    when lower(coalesce(p_skill, '')) ~ '(listen|audio|听力|听音)' then 'listening'
    when lower(coalesce(p_skill, '')) ~ '(speak|pronunciation|口语|发音)' then 'speaking'
    when lower(coalesce(p_skill, '')) ~ '(read|阅读|理解)' then 'reading'
    when lower(coalesce(p_skill, '')) ~ '(writ|作文|写作|书写)' then 'writing'
    when lower(coalesce(p_skill, '')) ~ '(vocab|word|词汇|单词)' then 'vocabulary'
    else 'grammar'
  end;
$$;

create or replace function private.merge_student_review_item(
  p_tenant_id uuid,
  p_student_id uuid,
  p_student_app_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_source_question_id uuid,
  p_course_id uuid,
  p_course_chapter_id uuid,
  p_skill text,
  p_content_snapshot jsonb,
  p_student_answer_snapshot jsonb,
  p_feedback_snapshot jsonb,
  p_occurred_at timestamptz default now(),
  p_error_count_delta integer default 1,
  p_created_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_occurred_at timestamptz := coalesce(p_occurred_at, now());
  v_feedback jsonb := coalesce(p_feedback_snapshot, '{}'::jsonb)
    || jsonb_build_object('lastErrorAt', to_jsonb(v_occurred_at));
begin
  if p_tenant_id is null or p_student_id is null or p_student_app_id is null
    or p_source_id is null then
    raise exception '复习项目缺少归属或来源';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_tenant_id::text || ':' || p_student_id::text || ':'
        || p_source_type || ':' || p_source_id::text || ':'
        || coalesce(p_source_question_id::text, 'none'),
      0
    )
  );

  select item.id into v_id
  from public.student_review_items as item
  where item.tenant_id = p_tenant_id
    and item.student_id = p_student_id
    and item.student_app_id = p_student_app_id
    and item.source_type = p_source_type
    and item.source_id = p_source_id
    and item.source_question_id is not distinct from p_source_question_id
  order by item.created_at, item.id
  limit 1
  for update;

  if v_id is null then
    insert into public.student_review_items (
      tenant_id, student_id, student_app_id, source_type, source_id,
      source_question_id, course_id, course_chapter_id, skill,
      content_snapshot, student_answer_snapshot, feedback_snapshot,
      error_count, status, created_at, updated_at
    ) values (
      p_tenant_id, p_student_id, p_student_app_id, p_source_type, p_source_id,
      p_source_question_id, p_course_id, p_course_chapter_id,
      private.normalize_student_review_skill(p_skill),
      coalesce(p_content_snapshot, '{}'::jsonb),
      coalesce(p_student_answer_snapshot, '{}'::jsonb),
      v_feedback, greatest(0, coalesce(p_error_count_delta, 0)), 'pending',
      coalesce(p_created_at, v_occurred_at), v_occurred_at
    ) returning id into v_id;
  else
    update public.student_review_items
    set course_id = coalesce(p_course_id, course_id),
        course_chapter_id = coalesce(p_course_chapter_id, course_chapter_id),
        skill = private.normalize_student_review_skill(p_skill),
        content_snapshot = coalesce(p_content_snapshot, content_snapshot),
        student_answer_snapshot = coalesce(
          p_student_answer_snapshot, student_answer_snapshot
        ),
        feedback_snapshot = v_feedback,
        error_count = error_count + greatest(0, coalesce(p_error_count_delta, 0)),
        status = 'pending',
        mastered_at = null,
        updated_at = v_occurred_at
    where id = v_id;
  end if;

  return v_id;
end;
$$;

revoke all on function private.normalize_student_review_skill(text) from public;
revoke all on function private.merge_student_review_item(
  uuid, uuid, uuid, text, uuid, uuid, uuid, uuid, text, jsonb, jsonb,
  jsonb, timestamptz, integer, timestamptz
) from public;

-- 章节小测：交卷记录成功落库后，从服务端保存的答案和私有题库重新判定错题。
create or replace function private.capture_chapter_test_review_items()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_test public.chapter_tests%rowtype;
  v_question public.chapter_test_questions%rowtype;
  v_selected integer;
  v_course_id uuid;
  v_course_chapter_id uuid;
begin
  begin
    select * into v_test
    from public.chapter_tests
    where id = new.test_id;
    if v_test.id is null then return new; end if;

    select chapter.id, lesson.course_id
    into v_course_chapter_id, v_course_id
    from public.course_chapters as chapter
    join public.lessons as lesson on lesson.id = chapter.lesson_id
    where chapter.chapter_test_id = v_test.id
    order by chapter.created_at
    limit 1;

    for v_question in
      select question.*
      from public.chapter_test_questions as question
      where question.test_id = v_test.id
        and question.question_type = 'single_choice'
        and question.is_chapter_test_item
    loop
      if not (new.answers ? v_question.question_key) then continue; end if;
      begin
        v_selected := (new.answers ->> v_question.question_key)::integer;
      exception when others then
        continue;
      end;
      if v_selected = v_question.correct_option then continue; end if;

      perform private.merge_student_review_item(
        new.tenant_id, new.student_id, v_test.student_app_id,
        'chapter_quiz', v_test.id, v_question.id,
        v_course_id, v_course_chapter_id, v_question.skill,
        jsonb_build_object(
          'sourceVersion', v_test.version,
          'sourceAttemptId', new.id,
          'sourceTitle', v_test.title,
          'questionKey', v_question.question_key,
          'prompt', v_question.prompt,
          'options', v_question.options,
          'questionType', v_question.question_type,
          'originalSkill', v_question.skill
        ),
        jsonb_build_object(
          'selectedOption', v_selected,
          'selectedValue', v_question.options -> v_selected
        ),
        jsonb_build_object(
          'correctOption', v_question.correct_option,
          'correctAnswer', v_question.options -> v_question.correct_option,
          'explanation', v_question.explanation
        ),
        new.attempted_at, 1, new.attempted_at
      );
    end loop;
  exception when others then
    raise warning 'chapter test review capture skipped for attempt %: %',
      new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists chapter_test_attempts_capture_review_items
  on public.chapter_test_attempts;
create trigger chapter_test_attempts_capture_review_items
after insert on public.chapter_test_attempts
for each row execute function private.capture_chapter_test_review_items();

-- 专项训练：每个错误作答在 submit_toolbox_practice 的同一事务中完成归集。
create or replace function private.capture_toolbox_review_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

drop trigger if exists toolbox_practice_attempts_capture_review_item
  on public.toolbox_practice_attempts;
create trigger toolbox_practice_attempts_capture_review_item
after insert on public.toolbox_practice_attempts
for each row execute function private.capture_toolbox_review_item();

-- 作业/考试：批改完成、自动评分直接发布或退回重做时采集低分题；口语写作
-- 独立保存量规、单题评语、总体评语和改进任务。
create or replace function private.capture_learning_submission_review_items()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.learning_assignments%rowtype;
  v_paper public.assessment_papers%rowtype;
  v_answer record;
  v_source_type text;
  v_course_chapter_id uuid;
  v_is_feedback boolean;
  v_should_capture boolean;
  v_improvement_task text;
begin
  if new.submission_state not in (
    'grading_completed', 'grade_released', 'revision_required'
  ) then return new; end if;
  if new.submission_state = old.submission_state then return new; end if;
  if new.submission_state = 'grade_released'
    and old.submission_state = 'grading_completed' then return new; end if;

  begin
    select * into v_assignment
    from public.learning_assignments where id = new.assignment_id;
    if v_assignment.id is null or v_assignment.student_app_id is null then
      return new;
    end if;
    if v_assignment.source_paper_id is not null then
      select * into v_paper
      from public.assessment_papers where id = v_assignment.source_paper_id;
    end if;

    select chapter.id into v_course_chapter_id
    from public.course_chapters as chapter
    where chapter.chapter_test_id = v_paper.source_test_id
    order by chapter.created_at
    limit 1;

    if v_assignment.assignment_type = 'homework' then
      v_source_type := 'teacher_homework';
    elsif coalesce(v_assignment.source_paper_code, v_paper.paper_code, '')
        ~* '(^|[-_])ST[0-9]'
      or coalesce(v_assignment.title, '') ~ '阶段考试' then
      v_source_type := 'stage_exam';
    elsif coalesce(v_assignment.source_paper_code, v_paper.paper_code, '')
        ~* '(MID|MIDTERM)'
      or coalesce(v_assignment.title, '') ~ '期中' then
      v_source_type := 'midterm_exam';
    elsif coalesce(v_assignment.source_paper_code, v_paper.paper_code, '')
        ~* '(FIN|FINAL)'
      or coalesce(v_assignment.title, '') ~ '期末' then
      v_source_type := 'final_exam';
    else
      v_source_type := 'formal_chapter_exam';
    end if;

    for v_answer in
      select
        answer.id, answer.question_id, answer.answer_text,
        answer.awarded_points, answer.rubric_scores, answer.grader_feedback,
        question.prompt, question.options, question.points,
        question.question_type, question.language_skill,
        question.stimulus_text, question.source_bank_question_id,
        question.source_bank_version, question.auto_graded,
        answer_key.correct_answer, answer_key.explanation
      from public.learning_submission_answers as answer
      join public.learning_assignment_questions as question
        on question.tenant_id = answer.tenant_id
       and question.id = answer.question_id
      left join public.learning_assignment_question_keys as answer_key
        on answer_key.question_id = question.id
      where answer.tenant_id = new.tenant_id
        and answer.submission_id = new.id
    loop
      v_is_feedback := v_answer.language_skill in ('speaking', 'writing');
      v_should_capture := coalesce(v_answer.awarded_points, 0) < v_answer.points
        or (v_is_feedback and (
          nullif(btrim(coalesce(v_answer.grader_feedback, '')), '') is not null
          or v_answer.rubric_scores is not null
          or nullif(btrim(coalesce(new.overall_feedback, '')), '') is not null
        ));
      if not v_should_capture then continue; end if;

      v_improvement_task := coalesce(
        nullif(btrim(coalesce(v_answer.grader_feedback, '')), ''),
        nullif(btrim(coalesce(new.overall_feedback, '')), ''),
        case when v_is_feedback
          then '按评分标准修改表达后重新提交练习。'
          else '复习正确答案与解析后重新作答。' end
      );

      perform private.merge_student_review_item(
        new.tenant_id, new.student_id, v_assignment.student_app_id,
        case when v_is_feedback
          then 'teacher_speaking_writing_feedback' else v_source_type end,
        v_assignment.id, v_answer.question_id,
        v_assignment.course_id, v_course_chapter_id, v_answer.language_skill,
        jsonb_build_object(
          'sourceVersion', coalesce(
            v_assignment.source_paper_version, v_paper.version, 1
          ),
          'sourcePaperId', v_assignment.source_paper_id,
          'sourcePaperCode', coalesce(
            v_assignment.source_paper_code, v_paper.paper_code
          ),
          'sourceSubmissionId', new.id,
          'sourceAttemptNumber', new.attempt_number,
          'sourceTitle', v_assignment.title,
          'prompt', v_answer.prompt,
          'stimulus', v_answer.stimulus_text,
          'options', v_answer.options,
          'questionType', v_answer.question_type,
          'points', v_answer.points,
          'sourceBankQuestionId', v_answer.source_bank_question_id,
          'sourceBankVersion', v_answer.source_bank_version
        ),
        jsonb_build_object('answer', v_answer.answer_text),
        jsonb_build_object(
          'correctAnswer', v_answer.correct_answer,
          'explanation', v_answer.explanation,
          'awardedPoints', v_answer.awarded_points,
          'maxPoints', v_answer.points,
          'rubric', v_answer.rubric_scores,
          'teacherComment', v_answer.grader_feedback,
          'overallComment', new.overall_feedback,
          'improvementTask', v_improvement_task,
          'gradingDecision', new.submission_state
        ),
        coalesce(new.graded_at, new.updated_at), 1,
        coalesce(new.graded_at, new.updated_at)
      );
    end loop;
  exception when others then
    raise warning 'assignment review capture skipped for submission %: %',
      new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists learning_submissions_capture_review_items
  on public.learning_submissions;
create trigger learning_submissions_capture_review_items
after update of submission_state on public.learning_submissions
for each row execute function private.capture_learning_submission_review_items();

-- 巩固自测由学生保存进度成功后单独调用。函数重新读取已发布块并校验主题，
-- 客户端不能伪造课程、章节、能力或题目快照。
create or replace function public.record_student_practice_self_check_review(
  p_practice_unit_id uuid,
  p_block_id uuid,
  p_review_topics text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid := private.current_tenant_id();
  v_unit public.chapter_practice_units%rowtype;
  v_block public.chapter_practice_blocks%rowtype;
  v_course_id uuid;
  v_topics text[];
  v_topic text;
  v_skill_key text;
begin
  if v_user_id is null or v_tenant_id is null then
    raise exception '请登录后再保存自我检测';
  end if;
  select * into v_unit
  from public.chapter_practice_units
  where id = p_practice_unit_id and status = 'published';
  select * into v_block
  from public.chapter_practice_blocks
  where id = p_block_id
    and practice_unit_id = p_practice_unit_id
    and block_type = 'self_check'
    and status = 'published';
  if v_unit.id is null or v_block.id is null
    or not private.current_student_has_app_access(
      v_tenant_id, v_user_id, v_unit.student_app_id
    ) then
    raise exception '自我检测内容不存在或当前账号无权保存';
  end if;
  if coalesce(array_length(p_review_topics, 1), 0) = 0 then return null; end if;
  if array_length(p_review_topics, 1) > 20
    or exists (select 1 from unnest(p_review_topics) as topic where char_length(topic) > 500) then
    raise exception '待加强主题数量或长度不正确';
  end if;

  if jsonb_typeof(v_block.content_payload -> 'skills') = 'array' then
    select array_agg(distinct btrim(value)) into v_topics
    from jsonb_array_elements_text(v_block.content_payload -> 'skills') as value
    where btrim(value) <> '';
  elsif jsonb_typeof(v_block.content_payload -> 'skills') = 'object' then
    select array_agg(distinct btrim(value)) into v_topics
    from jsonb_each_text(v_block.content_payload -> 'skills')
    where btrim(value) <> '';
  elsif nullif(btrim(v_block.content_payload ->> 'prompt'), '') is not null then
    v_topics := array[btrim(v_block.content_payload ->> 'prompt')];
  else
    v_topics := array[v_unit.title];
  end if;
  if exists (
    select 1 from unnest(p_review_topics) as requested(topic)
    where not (requested.topic = any(coalesce(v_topics, array[]::text[])))
  ) then
    raise exception '待加强主题与当前发布内容不一致';
  end if;

  v_topic := p_review_topics[1];
  if jsonb_typeof(v_block.content_payload -> 'skills') = 'object' then
    select key into v_skill_key
    from jsonb_each_text(v_block.content_payload -> 'skills')
    where value = v_topic
    limit 1;
  end if;
  select lesson.course_id into v_course_id
  from public.course_chapters as chapter
  join public.lessons as lesson on lesson.id = chapter.lesson_id
  where chapter.id = v_unit.course_chapter_id;

  return private.merge_student_review_item(
    v_tenant_id, v_user_id, v_unit.student_app_id,
    'practice_self_check', v_unit.id, v_block.id,
    v_course_id, v_unit.course_chapter_id,
    coalesce(v_skill_key, v_topic),
    jsonb_build_object(
      'sourceVersion', v_unit.version,
      'sourceTitle', v_unit.title,
      'blockTitle', v_block.title,
      'prompt', '判断本章主题是否已经掌握',
      'topics', v_topics,
      'reviewTopics', p_review_topics,
      'sourceBlockType', v_block.block_type
    ),
    jsonb_build_object(
      'reviewTopics', p_review_topics,
      'answer', '还需加强'
    ),
    jsonb_build_object(
      'expectedAnswer', '已经掌握',
      'improvementTask', '回看待加强主题并完成对应练习后，再次进行自我检测。'
    ),
    now(), 1, now()
  );
end;
$$;

-- 听辨题由原有服务端判题流程保存进度后追加调用。RPC 再次读取发布内容和
-- 私有答案，客户端不能伪造题目、正确答案、课程章节或学生归属。
create or replace function public.record_student_practice_listening_reviews(
  p_block_id uuid,
  p_answers jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid := private.current_tenant_id();
  v_block public.chapter_practice_blocks%rowtype;
  v_unit public.chapter_practice_units%rowtype;
  v_course_id uuid;
  v_answer jsonb;
  v_question public.growth_toolbox_questions%rowtype;
  v_key public.growth_toolbox_question_keys%rowtype;
  v_response text;
  v_is_correct boolean;
  v_count integer := 0;
begin
  if v_user_id is null or v_tenant_id is null then
    raise exception '请登录后再保存听辨结果';
  end if;
  if jsonb_typeof(p_answers) <> 'array'
    or jsonb_array_length(p_answers) not between 1 and 100 then
    raise exception '听辨作答内容不完整';
  end if;
  select * into v_block
  from public.chapter_practice_blocks
  where id = p_block_id
    and block_type = 'listening'
    and status = 'published';
  select * into v_unit
  from public.chapter_practice_units
  where id = v_block.practice_unit_id
    and status = 'published';
  if v_block.id is null or v_unit.id is null
    or v_block.source_type is distinct from 'growth_toolbox_exercise'
    or v_block.source_id is null
    or not private.current_student_has_app_access(
      v_tenant_id, v_user_id, v_unit.student_app_id
    ) then
    raise exception '听辨内容不存在或当前账号无权保存';
  end if;
  select lesson.course_id into v_course_id
  from public.course_chapters as chapter
  join public.lessons as lesson on lesson.id = chapter.lesson_id
  where chapter.id = v_unit.course_chapter_id;

  for v_answer in select value from jsonb_array_elements(p_answers)
  loop
    begin
      v_response := btrim(v_answer ->> 'response');
      if nullif(v_response, '') is null or char_length(v_response) > 5000 then
        raise exception '听辨答案长度不正确';
      end if;
      select * into v_question
      from public.growth_toolbox_questions
      where id = (v_answer ->> 'questionId')::uuid
        and exercise_id = v_block.source_id;
      select * into v_key
      from public.growth_toolbox_question_keys
      where question_id = v_question.id;
      if v_question.id is null or v_key.question_id is null then
        raise exception '听辨题或答案配置不存在';
      end if;
      select exists (
        select 1
        from jsonb_array_elements_text(v_key.accepted_answers) as accepted(value)
        where lower(regexp_replace(btrim(accepted.value), '[[:space:][:punct:]]+', '', 'g'))
          = lower(regexp_replace(v_response, '[[:space:][:punct:]]+', '', 'g'))
      ) into v_is_correct;
      if v_is_correct then continue; end if;

      perform private.merge_student_review_item(
        v_tenant_id, v_user_id, v_unit.student_app_id,
        'practice_self_check', v_unit.id, v_question.id,
        v_course_id, v_unit.course_chapter_id, 'listening',
        jsonb_build_object(
          'sourceVersion', v_unit.version,
          'sourceTitle', v_unit.title,
          'blockTitle', v_block.title,
          'sourceBlockId', v_block.id,
          'sourceExerciseId', v_block.source_id,
          'prompt', v_question.prompt,
          'questionType', v_question.question_type,
          'content', v_question.content_payload,
          'maxScore', v_question.max_score
        ),
        jsonb_build_object('answer', v_response),
        jsonb_build_object(
          'acceptedAnswers', v_key.accepted_answers,
          'correctAnswer', v_key.accepted_answers -> 0,
          'explanation', v_key.explanation,
          'improvementTask', '重听本题材料，对照解析完成一次正确作答。'
        ),
        now(), 1, now()
      );
      v_count := v_count + 1;
    exception when others then
      raise exception '听辨错题校验失败：%', sqlerrm;
    end;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.record_student_practice_self_check_review(
  uuid, uuid, text[]
) from public, anon;
grant execute on function public.record_student_practice_self_check_review(
  uuid, uuid, text[]
) to authenticated;
revoke all on function public.record_student_practice_listening_reviews(
  uuid, jsonb
) from public, anon;
grant execute on function public.record_student_practice_listening_reviews(
  uuid, jsonb
) to authenticated;

-- 旧收藏的实时兼容与一次性历史迁移。历史记录使用原 created_at/updated_at，
-- 原表不做 delete/update，重复执行时只更新同一个统一复习项目。
create or replace function private.capture_legacy_chapter_review_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_test public.chapter_tests%rowtype;
  v_question public.chapter_test_questions%rowtype;
  v_course_id uuid;
  v_course_chapter_id uuid;
  v_latest_answer jsonb;
begin
  begin
    select * into v_test from public.chapter_tests where id = new.test_id;
    select * into v_question
    from public.chapter_test_questions where id = new.question_id;
    if v_test.id is null or v_question.id is null then return new; end if;
    select chapter.id, lesson.course_id
    into v_course_chapter_id, v_course_id
    from public.course_chapters as chapter
    join public.lessons as lesson on lesson.id = chapter.lesson_id
    where chapter.chapter_test_id = v_test.id
    order by chapter.created_at
    limit 1;
    select jsonb_build_object(
      'selectedOption', (attempt.answers ->> v_question.question_key)::integer,
      'selectedValue', v_question.options ->
        ((attempt.answers ->> v_question.question_key)::integer)
    ) into v_latest_answer
    from public.chapter_test_attempts as attempt
    where attempt.tenant_id = new.tenant_id
      and attempt.student_id = new.student_id
      and attempt.test_id = new.test_id
      and attempt.answers ? v_question.question_key
    order by attempt.attempted_at desc
    limit 1;

    perform private.merge_student_review_item(
      new.tenant_id, new.student_id, v_test.student_app_id,
      'student_bookmark', v_test.id, v_question.id,
      v_course_id, v_course_chapter_id, v_question.skill,
      jsonb_build_object(
        'legacyReviewId', new.id,
        'sourceVersion', v_test.version,
        'sourceTitle', v_test.title,
        'questionKey', v_question.question_key,
        'prompt', v_question.prompt,
        'options', v_question.options,
        'questionType', v_question.question_type,
        'legacyBookmarkedAt', new.created_at
      ),
      coalesce(v_latest_answer, jsonb_build_object(
        'answerUnavailable', true,
        'reason', '旧收藏记录未保存学生作答，且未找到对应历史作答。'
      )),
      jsonb_build_object(
        'correctOption', v_question.correct_option,
        'correctAnswer', v_question.options -> v_question.correct_option,
        'explanation', v_question.explanation,
        'bookmarkUpdatedAt', new.updated_at
      ),
      new.updated_at, 0, new.created_at
    );
  exception when others then
    raise warning 'legacy bookmark capture skipped for review %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists chapter_test_question_reviews_capture_unified_item
  on public.chapter_test_question_reviews;
create trigger chapter_test_question_reviews_capture_unified_item
after insert or update on public.chapter_test_question_reviews
for each row execute function private.capture_legacy_chapter_review_item();

-- PostgreSQL 不能直接以复合行调用 trigger 函数，使用与触发器相同的查询逻辑
-- 的轻量包装器供一次性迁移循环调用。
create or replace function private.capture_legacy_chapter_review_item_row(
  p_review public.chapter_test_question_reviews
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_test public.chapter_tests%rowtype;
  v_question public.chapter_test_questions%rowtype;
  v_course_id uuid;
  v_course_chapter_id uuid;
  v_latest_answer jsonb;
begin
  select * into v_test from public.chapter_tests where id = p_review.test_id;
  select * into v_question
  from public.chapter_test_questions where id = p_review.question_id;
  if v_test.id is null or v_question.id is null then return; end if;
  select chapter.id, lesson.course_id
  into v_course_chapter_id, v_course_id
  from public.course_chapters as chapter
  join public.lessons as lesson on lesson.id = chapter.lesson_id
  where chapter.chapter_test_id = v_test.id
  order by chapter.created_at
  limit 1;
  select jsonb_build_object(
    'selectedOption', (attempt.answers ->> v_question.question_key)::integer,
    'selectedValue', v_question.options ->
      ((attempt.answers ->> v_question.question_key)::integer)
  ) into v_latest_answer
  from public.chapter_test_attempts as attempt
  where attempt.tenant_id = p_review.tenant_id
    and attempt.student_id = p_review.student_id
    and attempt.test_id = p_review.test_id
    and attempt.answers ? v_question.question_key
  order by attempt.attempted_at desc
  limit 1;
  perform private.merge_student_review_item(
    p_review.tenant_id, p_review.student_id, v_test.student_app_id,
    'student_bookmark', v_test.id, v_question.id,
    v_course_id, v_course_chapter_id, v_question.skill,
    jsonb_build_object(
      'legacyReviewId', p_review.id,
      'sourceVersion', v_test.version,
      'sourceTitle', v_test.title,
      'questionKey', v_question.question_key,
      'prompt', v_question.prompt,
      'options', v_question.options,
      'questionType', v_question.question_type,
      'legacyBookmarkedAt', p_review.created_at
    ),
    coalesce(v_latest_answer, jsonb_build_object(
      'answerUnavailable', true,
      'reason', '旧收藏记录未保存学生作答，且未找到对应历史作答。'
    )),
    jsonb_build_object(
      'correctOption', v_question.correct_option,
      'correctAnswer', v_question.options -> v_question.correct_option,
      'explanation', v_question.explanation,
      'bookmarkUpdatedAt', p_review.updated_at
    ),
    p_review.updated_at, 0, p_review.created_at
  );
end;
$$;

-- 函数定义顺序需要包装器先存在；重新创建公开迁移函数以固定依赖。
create or replace function public.migrate_chapter_test_question_reviews_to_review_items()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_review public.chapter_test_question_reviews%rowtype;
  v_count integer := 0;
begin
  if auth.role() is distinct from 'service_role'
    and current_user not in ('postgres', 'supabase_admin') then
    raise exception '只有数据库迁移或服务角色可以执行历史收藏迁移';
  end if;
  for v_review in
    select * from public.chapter_test_question_reviews order by created_at, id
  loop
    perform private.capture_legacy_chapter_review_item_row(v_review);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.migrate_chapter_test_question_reviews_to_review_items()
  from public, anon, authenticated;
grant execute on function public.migrate_chapter_test_question_reviews_to_review_items()
  to service_role;

-- 一次性执行；返回值只用于迁移日志，原收藏表不发生任何写操作。
select public.migrate_chapter_test_question_reviews_to_review_items();

comment on function public.migrate_chapter_test_question_reviews_to_review_items() is
  '幂等映射 chapter_test_question_reviews 到 student_review_items。部署迁移已执行；需要补跑时使用 service_role 调用 RPC。';
comment on function public.record_student_practice_self_check_review(uuid, uuid, text[]) is
  '学生巩固自测保存成功后调用；只归集当前发布内容中标记为还需加强的主题。';
comment on function public.record_student_practice_listening_reviews(uuid, jsonb) is
  '学生听辨进度保存成功后调用；使用发布题目私有答案归集错题。';

commit;
