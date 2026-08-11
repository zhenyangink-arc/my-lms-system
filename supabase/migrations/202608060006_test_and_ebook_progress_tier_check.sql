begin;

-- submit_course_test / record_ebook_progress 只检查了"登录+属于某个机构"，没检查会员
-- 档位是否达标——普通作业提交（learning_assignments 相关）已经在用
-- student_feature_allowed() 做这层校验，这两个接口漏了，导致低档位学生可以绕开页面
-- 上的会员限制直接调用接口提交章节测试成绩/写入教材阅读进度。这两个功能都挂在
-- "korean_course"（vip2 及以上）这个特性位下，跟页面上韩语课程内容的门槛保持一致。
create or replace function public.submit_course_test(p_test_slug text, p_answers jsonb)
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
  v_lesson_course_id uuid;
begin
  if v_user_id is null or v_tenant_id is null then raise exception '请登录有效的机构账号后再提交测试'; end if;
  if not public.student_feature_allowed('korean_course') then raise exception '当前会员档位没有权限提交这项测试'; end if;
  if jsonb_typeof(p_answers) is distinct from 'object' then raise exception '答案格式不正确'; end if;
  select * into v_test from public.course_tests where slug = p_test_slug and status = 'published';
  if not found then raise exception '没有找到这份章节测试'; end if;

  if v_test.lesson_id is not null and exists (
    select 1
    from public.course_tests as prior_test
    where prior_test.lesson_id = v_test.lesson_id
      and prior_test.status = 'published'
      and prior_test.chapter_number < v_test.chapter_number
      and not exists (
        select 1
        from public.course_test_attempts as prior_attempt
        where prior_attempt.tenant_id = v_tenant_id
          and prior_attempt.student_id = v_user_id
          and prior_attempt.test_id = prior_test.id
      )
  ) then
    raise exception '请先完成前面章节的测试，再提交这一章';
  end if;

  select count(*) into v_total_questions
  from public.course_test_questions
  where test_id = v_test.id
    and status = 'published'
    and question_type = 'single_choice'
    and is_chapter_test_item;
  if v_total_questions = 0 or (select count(*) from jsonb_object_keys(p_answers)) <> v_total_questions then
    raise exception '请完成全部题目后再交卷';
  end if;

  for v_question in
    select * from public.course_test_questions
    where test_id = v_test.id
      and status = 'published'
      and question_type = 'single_choice'
      and is_chapter_test_item
    order by sort_order
  loop
    if not (p_answers ? v_question.question_key) then raise exception '请完成全部题目后再交卷'; end if;
    begin
      v_selected := (p_answers ->> v_question.question_key)::integer;
    exception when invalid_text_representation then
      raise exception '有一道题的答案格式不正确';
    end;
    if v_selected < 0 or v_selected >= jsonb_array_length(v_question.options) then raise exception '有一道题的选项不正确'; end if;
    v_correct := v_selected = v_question.correct_option;
    if v_correct then v_correct_count := v_correct_count + 1; end if;
    v_dimension_correct := coalesce((v_dimensions -> v_question.skill ->> 'correct')::integer, 0) + case when v_correct then 1 else 0 end;
    v_dimension_total := coalesce((v_dimensions -> v_question.skill ->> 'total')::integer, 0) + 1;
    v_dimensions := jsonb_set(
      v_dimensions, array[v_question.skill],
      jsonb_build_object('label', coalesce(v_test.skills ->> v_question.skill, v_question.skill), 'correct', v_dimension_correct, 'total', v_dimension_total),
      true
    );
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'id', v_question.question_key,
      'selectedOption', v_selected,
      'correctOption', v_question.correct_option,
      'correct', v_correct,
      'explanation', v_question.explanation
    ));
  end loop;

  v_score := round((v_correct_count::numeric / v_total_questions::numeric) * 100);
  v_passed := v_score >= v_test.passing_score;
  for v_dimension_key, v_dimension_value in select key, value from jsonb_each(v_dimensions)
  loop
    v_dimension_correct := (v_dimension_value ->> 'correct')::integer;
    v_dimension_total := (v_dimension_value ->> 'total')::integer;
    v_dimension_scores := jsonb_set(
      v_dimension_scores, array[v_dimension_key],
      v_dimension_value || jsonb_build_object('percent', round((v_dimension_correct::numeric / v_dimension_total::numeric) * 100)),
      true
    );
  end loop;

  insert into public.course_test_attempts (
    tenant_id, student_id, test_id, test_slug, test_version, score,
    correct_count, total_questions, passed, answers, dimension_scores
  ) values (
    v_tenant_id, v_user_id, v_test.id, v_test.slug, v_test.version, v_score,
    v_correct_count, v_total_questions, v_passed, p_answers, v_dimension_scores
  ) returning id into v_attempt_id;

  if v_passed and v_test.lesson_id is not null then
    if not exists (
      select 1
      from public.course_tests as remaining_test
      where remaining_test.lesson_id = v_test.lesson_id
        and remaining_test.status = 'published'
        and not exists (
          select 1
          from public.course_test_attempts as passed_attempt
          where passed_attempt.tenant_id = v_tenant_id
            and passed_attempt.student_id = v_user_id
            and passed_attempt.test_id = remaining_test.id
            and passed_attempt.passed
        )
    ) then
      select course_id into v_lesson_course_id
      from public.lessons
      where id = v_test.lesson_id;

      if v_lesson_course_id is not null then
        insert into public.lesson_progress (
          user_id, tenant_id, course_id, lesson_id, status,
          progress_percent, started_at, last_viewed_at, completed_at, updated_at
        ) values (
          v_user_id, v_tenant_id, v_lesson_course_id, v_test.lesson_id, 'completed',
          100, now(), now(), now(), now()
        )
        on conflict (user_id, lesson_id) do update
        set status = 'completed',
            progress_percent = 100,
            completed_at = coalesce(public.lesson_progress.completed_at, excluded.completed_at),
            last_viewed_at = excluded.last_viewed_at,
            updated_at = excluded.updated_at;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'attemptId', v_attempt_id, 'score', v_score, 'correctCount', v_correct_count,
    'totalQuestions', v_total_questions, 'passed', v_passed,
    'dimensionScores', v_dimension_scores, 'questions', v_results
  );
end;
$$;

create or replace function public.record_ebook_progress(p_test_slug text, p_current_page integer, p_total_pages integer, p_new_read_pages integer[])
returns course_ebook_progress
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid := private.current_tenant_id();
  v_row public.course_ebook_progress%rowtype;
  v_existing integer[];
  v_merged integer[];
  v_percent integer;
begin
  if v_user_id is null or v_tenant_id is null then
    raise exception '请登录有效的机构账号后再记录学习进度';
  end if;
  if not public.student_feature_allowed('korean_course') then
    raise exception '当前会员档位没有权限记录这本教材的学习进度';
  end if;
  if p_total_pages is null or p_total_pages <= 0 or p_total_pages > 2000 then
    raise exception '总页数不正确';
  end if;

  -- 用 advisory lock 把同一学生同一本书的并发保存串行化：加锁之后再读旧值，
  -- 保证同一时刻只有一次保存在合并、写回，杜绝后一次用旧集合整表覆盖前一次。
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_tenant_id::text || ':' || v_user_id::text || ':' || p_test_slug,
      0
    )
  );

  select read_pages into v_existing
  from public.course_ebook_progress
  where student_id = v_user_id and test_slug = p_test_slug;

  select coalesce(array_agg(distinct page order by page), '{}'::integer[])
  into v_merged
  from unnest(coalesce(v_existing, '{}'::integer[]) || coalesce(p_new_read_pages, '{}'::integer[])) as page
  where page >= 0 and page < p_total_pages;

  v_percent := least(100, round(coalesce(array_length(v_merged, 1), 0)::numeric / p_total_pages * 100));

  insert into public.course_ebook_progress (
    tenant_id, student_id, test_slug, current_page, total_pages,
    read_pages, progress_percent, last_read_at, updated_at
  ) values (
    v_tenant_id, v_user_id, p_test_slug,
    least(greatest(p_current_page, 0), p_total_pages - 1),
    p_total_pages, v_merged, v_percent, now(), now()
  )
  on conflict (student_id, test_slug) do update
  set
    current_page = least(greatest(p_current_page, 0), p_total_pages - 1),
    total_pages = p_total_pages,
    read_pages = v_merged,
    progress_percent = v_percent,
    last_read_at = now(),
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

commit;
