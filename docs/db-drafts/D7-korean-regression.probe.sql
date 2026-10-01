-- D7 韩语回归探针：在事务中走一遍韩语“题库 → 试卷 → 发布校验 → 机构布置作业”，输出已归一化（不含 ID 与时间）的结果。
-- D7 执行前后各跑一次，两份输出必须逐行一致。全程在事务中，最后回滚。
begin;
create temp table probe(seq serial, name text, outcome text) on commit drop;
grant all on probe to public; grant usage on sequence probe_seq_seq to public;

create function pg_temp.as_user(p_user uuid, p_role text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', p_role)::text, true);
end $$;

do $$
declare
  v_owner uuid := '10000000-0000-4000-8000-000000000901';
  v_admin uuid := '10000000-0000-4000-8000-000000000101';
  v_lesson uuid := '22000000-0000-4000-8000-000000000001';
  v_test uuid; v_dup uuid; v_hw uuid; v_q1 uuid; v_q2 uuid; v_paper uuid; v_bad uuid; v_asg uuid; v_pq uuid;
  r text;
begin
  insert into public.chapter_tests (slug, course_key, chapter_number, title, lesson_id)
  values ('probe-d7-test', 'korean-1', 1, '探针章节', v_lesson) returning id into v_test;
  insert into public.chapter_test_questions (test_id, question_key, prompt, options, correct_option, explanation, skill, sort_order, ebook_section_step)
  values (v_test, 'q1', '题一', '["A","B","C","D"]', 1, '解析一', 'vocabulary', 1, 'STEP 01') returning id into v_q1;
  insert into public.chapter_test_questions (test_id, question_key, prompt, options, correct_option, explanation, skill, sort_order, ebook_section_step)
  values (v_test, 'q2', '题二', '["A","B","C","D"]', 2, '解析二', 'grammar', 2, 'STEP 01') returning id into v_q2;
  select count(*)::text into r from public.chapter_homework_plans where test_id = v_test;
  insert into probe(name, outcome) values ('0 容器触发的作业计划行数', r);

  -- 平台负责人：创建并发布试卷
  perform pg_temp.as_user(v_owner, 'authenticated'); set local role authenticated;
  begin
    v_paper := public.create_assessment_paper_from_bank('探针试卷', '', 'exam', v_test, 30, 60, true, false,
      jsonb_build_array(jsonb_build_object('questionId', v_q1, 'points', 5), jsonb_build_object('questionId', v_q2, 'points', 5)));
    perform public.change_assessment_paper_status(v_paper, 'published');
    reset role;
    select format('status=%s count=%s total=%s', status, question_count, total_points) into r from public.assessment_papers where id = v_paper;
    insert into probe(name, outcome) values ('1 创建并发布韩语试卷', r);
  exception when others then reset role; insert into probe(name, outcome) values ('1 创建并发布韩语试卷', 'error: ' || sqlerrm); end;

  -- 发布校验：正常试卷无问题；把一道题的 skill 清空后必须被报出
  if v_paper is not null then
    insert into probe(name, outcome) values ('2a 正常试卷发布校验问题', coalesce(array_to_string(private.assessment_paper_release_issues(v_paper), ' | '), 'NULL'));
    v_bad := public.create_assessment_paper_from_bank('探针草稿', '', 'exam', v_test, 30, 60, true, false,
      jsonb_build_array(jsonb_build_object('questionId', v_q1, 'points', 5)));
    select id into v_pq from public.assessment_paper_questions where paper_id = v_bad limit 1;
    update public.assessment_paper_questions set skill = '' where id = v_pq;
    insert into probe(name, outcome) values ('2b skill 为空的韩语试卷校验问题', coalesce(array_to_string(private.assessment_paper_release_issues(v_bad), ' | '), 'NULL'));
    update public.assessment_paper_questions set skill = 'vocabulary' where id = v_pq;
    update public.assessment_papers set duration_minutes = null where id = v_bad;
    insert into probe(name, outcome) values ('2c 缺时长的试卷校验问题', coalesce(array_to_string(private.assessment_paper_release_issues(v_bad), ' | '), 'NULL'));

    perform pg_temp.as_user(v_owner, 'authenticated'); set local role authenticated;
    begin
      v_dup := public.duplicate_assessment_paper(v_paper);
      reset role;
      select format('status=%s count=%s total=%s', status, question_count, total_points) into r from public.assessment_papers where id = v_dup;
      insert into probe(name, outcome) values ('2d 复制试卷', r);
      select string_agg(format('%s/%s/%s/%s/%s', q.sort_order, q.question_type, q.skill, q.auto_graded, coalesce(k.correct_answer, '-')), ' ; ' order by q.sort_order)
        into r from public.assessment_paper_questions q left join public.assessment_paper_question_keys k on k.question_id = q.id where q.paper_id = v_dup;
      insert into probe(name, outcome) values ('2e 复制出的试卷题', r);
    exception when others then reset role; insert into probe(name, outcome) values ('2d 复制试卷', 'error: ' || sqlerrm); end;

    -- 机构管理员：布置作业
    perform pg_temp.as_user(v_admin, 'authenticated'); set local role authenticated;
    begin
      v_asg := public.create_learning_assignment_from_paper_with_unlock(v_paper, null, 'all_students', null, now(), now() + interval '2 days', '探针通知', false);
      reset role;
      select string_agg(format('%s/%s/%s/%s/%s', q.sort_order, q.question_type, q.language_skill, q.auto_graded, coalesce(k.correct_answer, '-')), ' ; ' order by q.sort_order)
        into r from public.learning_assignment_questions q left join public.learning_assignment_question_keys k on k.question_id = q.id where q.assignment_id = v_asg;
      insert into probe(name, outcome) values ('3a 布置作业后的题目（序/题型/技能/自动判分/答案）', r);
      select format('status=%s total=%s src=%s', status, total_points, source_paper_code is not null) into r from public.learning_assignments where id = v_asg;
      insert into probe(name, outcome) values ('3b 作业状态', r);
    exception when others then reset role; insert into probe(name, outcome) values ('3 布置作业', 'error: ' || sqlerrm); end;
    -- 作业类型试卷：只有两项技能，发布校验与布置都必须报“六项内容不完整”
    perform pg_temp.as_user(v_owner, 'authenticated'); set local role authenticated;
    v_hw := public.create_assessment_paper_from_bank('探针作业', '', 'homework', v_test, 30, 60, true, false,
      jsonb_build_array(jsonb_build_object('questionId', v_q1, 'points', 5), jsonb_build_object('questionId', v_q2, 'points', 5)));
    perform public.change_assessment_paper_status(v_hw, 'published');
    reset role;
    insert into probe(name, outcome) values ('2f 作业类型两项技能试卷的发布校验问题', coalesce(array_to_string(private.assessment_paper_release_issues(v_hw), ' | '), 'NULL'));
    perform pg_temp.as_user(v_admin, 'authenticated'); set local role authenticated;
    begin
      perform public.create_learning_assignment_from_paper_with_unlock(v_hw, null, 'all_students', null, now(), now() + interval '2 days', '', false);
      reset role; insert into probe(name, outcome) values ('3d 作业类型两项技能试卷布置', 'ok(不应出现)');
    exception when others then reset role; insert into probe(name, outcome) values ('3d 作业类型两项技能试卷布置', 'denied: ' || left(sqlerrm, 40)); end;
    perform pg_temp.as_user(v_admin, 'authenticated'); set local role authenticated;
    begin
      perform public.create_learning_assignment_from_paper_with_unlock(v_bad, null, 'all_students', null, now(), now() + interval '2 days', '', false);
      reset role; insert into probe(name, outcome) values ('3c 草稿试卷不能布置', 'ok(不应出现)');
    exception when others then reset role; insert into probe(name, outcome) values ('3c 草稿试卷不能布置', 'denied: ' || left(sqlerrm, 40)); end;
  end if;
end $$;
select name, outcome from probe order by seq;
rollback;
