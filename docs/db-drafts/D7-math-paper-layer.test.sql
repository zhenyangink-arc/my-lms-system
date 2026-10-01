-- D7 行为测试（依赖 D5、D7 已执行；需要验证库已开放数学应用并让 verify-student 报名数学）：
-- 数学试卷“创建 → 发布 → 机构布置 → 学生提交 → 机器判题”走通，并检查权限与负向用例。全程在事务中，最后回滚。
begin;
create temp table t(seq serial, name text, got text, expected text) on commit drop;
grant all on t to public; grant usage on sequence t_seq_seq to public;
create function pg_temp.as_user(p_user uuid, p_role text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', p_role)::text, true);
end $$;
-- 以指定身份执行 SQL；成功返回 ok，失败返回错误前 50 字
create function pg_temp.try(p_user uuid, p_role text, p_sql text) returns text language plpgsql as $$
begin
  perform pg_temp.as_user(p_user, p_role);
  begin
    execute 'set local role ' || p_role; execute p_sql; reset role; return 'ok';
  exception when others then reset role; return 'denied: ' || left(sqlerrm, 50); end;
end $$;
grant execute on function pg_temp.as_user(uuid, text), pg_temp.try(uuid, text, text) to public;

do $$
declare
  v_owner uuid := '10000000-0000-4000-8000-000000000901';
  v_admin uuid := '10000000-0000-4000-8000-000000000101';
  v_teacher uuid := '10000000-0000-4000-8000-000000000931';
  v_student uuid := '10000000-0000-4000-8000-000000000911';
  v_app uuid := (select id from public.student_apps where slug = 'math');
  v_cat uuid := '20000000-0000-4000-8000-0000000000e7';
  v_course uuid := '21000000-0000-4000-8000-0000000000e7';
  v_lesson uuid := '22000000-0000-4000-8000-0000000000e7';
  v_test uuid; v_paper uuid; v_hw uuid; v_dup uuid; v_nospec uuid; v_ret uuid; v_exam_asg uuid; v_policy uuid; v_eval uuid; v_del uuid; v_asg uuid; v_sub uuid; v_ans_expr uuid; v_ans_num uuid; v_ans_choice uuid;
  r text; n int;
  v_questions text := $q$[
    {"type":"math.expression","prompt":"化简 2(x+1)","points":5,"explanation":"展开","difficulty":"medium","mathSpec":{"expected":"2x+2","variables":[{"name":"x","min":-5,"max":5}],"seed":7}},
    {"type":"math.numeric","prompt":"求 1/3（保留三位小数）","points":3,"explanation":"约 0.333","mathSpec":{"expected":0.3333,"tolerance":{"abs":0.001,"rel":0}}},
    {"type":"single_choice","prompt":"2+2=?","points":2,"explanation":"四","options":["3","4","5"],"correctAnswer":"4"}]$q$;
begin
  -- 数学课程 / 课时 / 试卷容器（验证库默认没有）
  perform pg_temp.as_user(v_owner, 'authenticated');
  insert into public.course_categories (id, parent_id, slug, title, description, is_published, sort_order, content_scope, student_app_id)
  values (v_cat, null, 'math-e7', '数学课程', 'D7 测试', true, 30, 'platform', v_app);
  insert into public.courses (id, category_id, slug, title, description, level, is_published, sort_order, content_scope, unlock_mode, student_app_id)
  values (v_course, v_cat, 'math-e7-course', '大学数学一', 'D7 测试', 'beginner', true, 10, 'platform', 'immediate', v_app);
  insert into public.lessons (id, course_id, slug, title, description, lesson_type, duration_minutes, is_free_preview, is_published, sort_order, content_text, content_scope, unlock_mode)
  values (v_lesson, v_course, 'math-e7-lesson', '极限', 'D7', 'text', 10, false, true, 1, 'D7', 'platform', 'immediate');
  insert into public.chapter_tests (slug, course_key, chapter_number, title, lesson_id)
  values ('math-e7-test', 'math-1', 1, '数学试卷容器', v_lesson) returning id into v_test;

  -- 1 创建与发布
  perform pg_temp.as_user(v_owner, 'authenticated'); set local role authenticated;
  v_paper := public.create_math_paper('数学试卷', '', 'exam', v_test, 30, 60, false, v_questions::jsonb);
  reset role;
  select format('status=%s count=%s total=%s', status, question_count, total_points) into r from public.assessment_papers where id = v_paper;
  insert into t(name, got, expected) values ('1a 创建草稿试卷', r, 'status=draft count=3 total=10.00');
  select count(*) into n from public.math_paper_question_specs where paper_question_id in (select id from public.assessment_paper_questions where paper_id = v_paper);
  insert into t(name, got, expected) values ('1b 写入 2 条试卷规格', n::text, '2');
  select string_agg(question_type || ':' || auto_graded::text || ':[' || skill || ']', ',' order by sort_order) into r from public.assessment_paper_questions where paper_id = v_paper;
  insert into t(name, got, expected) values ('1c 题型 / 自动判分 / skill', r, 'math.expression:false:[],math.numeric:false:[],single_choice:true:[]');
  insert into t(name, got, expected) values ('1d 发布校验无问题（数学 skill 为空）', coalesce(array_to_string(private.assessment_paper_release_issues(v_paper), ' | '), 'NULL'), '');
  perform pg_temp.as_user(v_owner, 'authenticated'); set local role authenticated;
  perform public.change_assessment_paper_status(v_paper, 'published');
  reset role;
  -- 作业类型试卷（学生作答不需要先“开始考试”），用于第 4、5 节
  perform pg_temp.as_user(v_owner, 'authenticated'); set local role authenticated;
  v_hw := public.create_math_paper('数学作业', '', 'homework', v_test, 30, 60, true, v_questions::jsonb);
  perform public.change_assessment_paper_status(v_hw, 'published');
  reset role;
  insert into t(name, got, expected) values ('1e 发布后规格不可改',
    pg_temp.try(null, 'postgres', format($f$update public.math_paper_question_specs set spec = spec where paper_question_id in (select id from public.assessment_paper_questions where paper_id = %L)$f$, v_paper)), 'denied: 已发布或已停止提供的试卷的判题规格不可修改，请复制为新草稿');

  -- 2 权限与负向
  insert into t(name, got, expected) values ('2a 机构管理员不能创建数学试卷',
    pg_temp.try(v_admin, 'authenticated', format($f$select public.create_math_paper('X试卷', '', 'exam', %L, 30, 60, false, %L::jsonb)$f$, v_test, v_questions)), 'denied: 只有平台负责人或指定管理员可以创建标准试卷');
  insert into t(name, got, expected) values ('2b 学生不能创建',
    pg_temp.try(v_student, 'authenticated', format($f$select public.create_math_paper('X试卷', '', 'exam', %L, 30, 60, false, %L::jsonb)$f$, v_test, v_questions)), 'denied: 只有平台负责人或指定管理员可以创建标准试卷');
  for r in select unnest(array[
      '[{"type":"math.numeric","prompt":"x","points":1,"explanation":"e"}]',
      '[{"type":"math.numeric","prompt":"x","points":1,"explanation":"e","mathSpec":{"expected":"1"}}]',
      '[{"type":"math.numeric","prompt":"x","points":1,"explanation":"e","correctAnswer":"1","mathSpec":{"expected":1,"tolerance":{"abs":0,"rel":0}}}]',
      '[{"type":"math.numeric","prompt":"x","points":1,"mathSpec":{"expected":1,"tolerance":{"abs":0,"rel":0}}}]',
      '[{"type":"single_choice","prompt":"x","points":1,"explanation":"e","options":["a","b"],"correctAnswer":"c"}]',
      '[{"type":"single_choice","prompt":"x","points":1,"explanation":"e","options":["a","b"],"correctAnswer":"a","mathSpec":{"expected":1,"tolerance":{"abs":0,"rel":0}}}]',
      '[{"type":"short_text","prompt":"x","points":1,"explanation":"e"}]',
      '[{"type":"math.numeric","prompt":"x","points":0,"explanation":"e","mathSpec":{"expected":1,"tolerance":{"abs":0,"rel":0}}}]',
      '[]'
    ]) loop
    insert into t(name, got, expected) values ('2c 畸形题目被拒：' || left(r, 46),
      left(pg_temp.try(v_owner, 'authenticated', format($f$select public.create_math_paper('X试卷', '', 'exam', %L, 30, 60, false, %L::jsonb)$f$, v_test, r)), 6), 'denied');
  end loop;
  insert into t(name, got, expected) values ('2d 韩语容器不能用于数学试卷（用不存在的容器代替）',
    left(pg_temp.try(v_owner, 'authenticated', format($f$select public.create_math_paper('X试卷', '', 'exam', gen_random_uuid(), 30, 60, false, %L::jsonb)$f$, v_questions)), 40), 'denied: 试卷容器必须是数学应用中已发布的章节测试');
  select count(*) into n from public.assessment_papers where title = 'X试卷';
  insert into t(name, got, expected) values ('2e 被拒的创建不留下试卷', n::text, '0');

  -- 3 复制试卷带规格
  perform pg_temp.as_user(v_owner, 'authenticated'); set local role authenticated;
  v_dup := public.duplicate_assessment_paper(v_paper);
  reset role;
  select count(*) into n from public.math_paper_question_specs where paper_question_id in (select id from public.assessment_paper_questions where paper_id = v_dup);
  insert into t(name, got, expected) values ('3a 复制试卷同时复制 2 条规格', n::text, '2');

  -- 4 机构布置 → 学生提交 → 机器判题
  perform pg_temp.as_user(v_admin, 'authenticated'); set local role authenticated;
  v_asg := public.create_learning_assignment_from_paper_with_unlock(v_hw, v_course, 'all_students', null, now() - interval '1 minute', now() + interval '2 days', '', false);
  reset role;
  select count(*) into n from public.math_question_specs s join public.learning_assignment_questions q on q.id = s.question_id where q.assignment_id = v_asg;
  insert into t(name, got, expected) values ('4a 布置后作业题带 2 条规格（D5 表）', n::text, '2');
  select string_agg(question_type || ':' || auto_graded::text, ',' order by sort_order) into r from public.learning_assignment_questions where assignment_id = v_asg;
  insert into t(name, got, expected) values ('4b 作业题题型与自动判分', r, 'math.expression:false,math.numeric:false,single_choice:true');
  select (select id from public.learning_assignment_questions where assignment_id = v_asg and question_type = 'math.expression') into v_ans_expr;
  select (select id from public.learning_assignment_questions where assignment_id = v_asg and question_type = 'math.numeric') into v_ans_num;
  select (select id from public.learning_assignment_questions where assignment_id = v_asg and question_type = 'single_choice') into v_ans_choice;

  perform pg_temp.as_user(v_student, 'authenticated'); set local role authenticated;
  begin
    r := (public.submit_learning_assignment(v_asg, jsonb_build_array(
      jsonb_build_object('questionId', v_ans_expr, 'answer', '2x+2'),
      jsonb_build_object('questionId', v_ans_num, 'answer', '1/3'),
      jsonb_build_object('questionId', v_ans_choice, 'answer', '4')), gen_random_uuid(), 'complete'))->>'workflowState';
    reset role;
  exception when others then reset role; r := 'error: ' || sqlerrm; end;
  insert into t(name, got, expected) values ('4c 学生提交后的状态', r, 'objective_graded_pending_manual');
  select id into v_sub from public.learning_submissions where assignment_id = v_asg and student_id = v_student;
  select string_agg(coalesce(awarded_points::text, 'null'), ',' order by q.sort_order) into r
  from public.learning_submission_answers a join public.learning_assignment_questions q on q.id = a.question_id where a.submission_id = v_sub;
  insert into t(name, got, expected) values ('4d 提交时得分（数学题待判，选择题自动 2）', r, 'null,null,2.00');
  select id into v_ans_expr from public.learning_submission_answers where submission_id = v_sub and question_id = (select id from public.learning_assignment_questions where assignment_id = v_asg and question_type = 'math.expression');
  insert into t(name, got, expected) values ('4e 服务端写入机器判题',
    pg_temp.try(null, 'service_role', format($f$select public.record_learning_machine_grade(%L, 'math.expression-equivalence', '1.0.0', 'correct', 5, 'equivalent_on_samples', '{}'::jsonb)$f$, v_ans_expr)), 'ok');
  perform pg_temp.as_user(v_admin, 'authenticated'); set local role authenticated;
  select count(*) into n from public.learning_submission_machine_grades where answer_id = v_ans_expr;
  reset role;
  insert into t(name, got, expected) values ('4f 机构管理员可读机器判题', n::text, '1');
  -- 教师批改沿用现有函数：为全部题给分
  perform pg_temp.as_user(v_admin, 'authenticated'); set local role authenticated;
  begin
    perform public.grade_learning_submission(v_sub, 'graded', '', (select jsonb_agg(jsonb_build_object('answerId', a.id, 'points', case q.question_type when 'math.expression' then 5 when 'math.numeric' then 3 else 2 end) order by q.sort_order)
      from public.learning_submission_answers a join public.learning_assignment_questions q on q.id = a.question_id where a.submission_id = v_sub));
    reset role; r := 'ok';
  exception when others then reset role; r := 'error: ' || sqlerrm; end;
  insert into t(name, got, expected) values ('4g 教师批改（现有函数）', r, 'ok');
  select submission_state || '/' || computed_score into r from public.learning_submissions where id = v_sub;
  insert into t(name, got, expected) values ('4h 批改后状态与得分', r, 'grading_completed/10.00');

  -- 5 数学应用的作业类型试卷不再被“六项齐全”卡住；韩语仍然被卡（见韩语回归探针）
  insert into t(name, got, expected) values ('5a 数学作业类型试卷发布校验无问题', coalesce(array_to_string(private.assessment_paper_release_issues(v_hw), ' | '), 'NULL'), '');

  -- 6 完整性：数学题缺少规格时不能发布 / 布置；已发布试卷不能新增规格；删除草稿试卷级联删除规格
  perform pg_temp.as_user(v_owner, 'authenticated'); set local role authenticated;
  v_nospec := public.create_math_paper('缺规格试卷', '', 'exam', v_test, 30, 60, false, v_questions::jsonb);
  reset role;
  delete from public.math_paper_question_specs where paper_question_id = (select id from public.assessment_paper_questions where paper_id = v_nospec and question_type = 'math.numeric');
  insert into t(name, got, expected) values ('6a 缺规格的试卷校验问题', coalesce(array_to_string(private.assessment_paper_release_issues(v_nospec), ' | '), 'NULL'), '有 1 道数学题缺少判题规格');
  perform pg_temp.as_user(v_owner, 'authenticated'); set local role authenticated;
  perform public.change_assessment_paper_status(v_nospec, 'published');
  reset role;
  insert into t(name, got, expected) values ('6b 缺规格的试卷不能布置',
    pg_temp.try(v_admin, 'authenticated', format($f$select public.create_learning_assignment_from_paper_with_unlock(%L, %L, 'all_students', null, now(), now() + interval '2 days', '', false)$f$, v_nospec, v_course)), 'denied: 标准试卷中有数学题缺少判题规格');
  insert into t(name, got, expected) values ('6c 已发布试卷不能新增规格',
    pg_temp.try(null, 'postgres', format($f$insert into public.math_paper_question_specs (paper_question_id, grader_key, spec, updated_by) select id, 'math.numeric', '{"expected":1,"tolerance":{"abs":0,"rel":0}}', %L from public.assessment_paper_questions where paper_id = %L and question_type = 'math.numeric'$f$, v_owner, v_nospec)), 'denied: 已发布或已停止提供的试卷的判题规格不可修改，请复制为新草稿');
  perform pg_temp.as_user(v_owner, 'authenticated'); set local role authenticated;
  v_del := public.create_math_paper('待删草稿', '', 'exam', v_test, 30, 60, false, v_questions::jsonb);
  reset role;
  insert into t(name, got, expected) values ('6d 删除草稿试卷题（级联）不被规格触发器拦截',
    pg_temp.try(null, 'postgres', format($f$delete from public.assessment_paper_questions where paper_id = %L$f$, v_del)), 'ok');
  select count(*) into n from public.math_paper_question_specs where paper_question_id not in (select id from public.assessment_paper_questions);
  insert into t(name, got, expected) values ('6e 无孤立规格', n::text, '0');
  insert into t(name, got, expected) values ('6f 删除整份草稿试卷（级联）',
    pg_temp.try(null, 'postgres', format($f$delete from public.assessment_papers where id = %L$f$, v_del)), 'ok');

  -- 7 补考端到端：已发布的数学考试 → 结课资格记录标记未通过 → 配置补考 → 补考题带判题规格
  perform pg_temp.as_user(v_owner, 'authenticated'); set local role authenticated;
  v_ret := public.create_math_paper('数学补考卷', '', 'exam', v_test, 30, 60, false, v_questions::jsonb);
  perform public.change_assessment_paper_status(v_ret, 'published');
  reset role;
  perform pg_temp.as_user(v_admin, 'authenticated'); set local role authenticated;
  v_exam_asg := public.create_learning_assignment_from_paper_with_unlock(v_paper, v_course, 'all_students', null, now() - interval '1 minute', now() + interval '2 days', '', false);
  reset role;
  perform pg_temp.as_user(v_owner, 'authenticated');
  insert into public.course_completion_policies (student_app_id, course_id, policy_code, version, title, created_by)
  values (v_app, v_course, 'MATH-D7-POLICY', 1, 'D7 测试策略', v_owner) returning id into v_policy;
  insert into public.student_course_completion_evaluations (
    tenant_id, student_id, student_app_id, course_id, policy_id, policy_version, status, eligible,
    requirements_snapshot, evidence_snapshot, missing_requirements, evaluation_version, evaluation_fingerprint)
  values ('10000000-0000-4000-8000-000000000001', v_student, v_app, v_course, v_policy, 1, 'not_eligible', false,
    '{}', '{}', jsonb_build_array(jsonb_build_object('key', 'final', 'category', 'final_exam', 'title', '期末考试', 'status', 'failed',
      'reason', '未通过', 'sourceId', v_exam_asg::text)), 'v1', repeat('a', 32)) returning id into v_eval;
  perform pg_temp.as_user(v_admin, 'authenticated'); set local role authenticated;
  begin
    perform public.configure_learning_assignment_retake(v_eval, v_exam_asg, v_ret, now() + interval '3 days', now() + interval '5 days', 'highest', null);
    reset role; r := 'ok';
  exception when others then reset role; r := 'error: ' || sqlerrm; end;
  insert into t(name, got, expected) values ('7a 配置补考成功', r, 'ok');
  select count(*) into n from public.learning_assignment_questions q join public.math_question_specs s on s.question_id = q.id
  where q.assignment_id = v_exam_asg and q.delivery_paper_id = v_ret;
  insert into t(name, got, expected) values ('7b 补考题带 2 条判题规格', n::text, '2');
  select string_agg(question_type || ':' || auto_graded::text, ',' order by sort_order) into r
  from public.learning_assignment_questions where assignment_id = v_exam_asg and delivery_paper_id = v_ret;
  insert into t(name, got, expected) values ('7c 补考题题型与自动判分', r, 'math.expression:false,math.numeric:false,single_choice:true');
end $$;
select seq, name, got, expected, case when got = expected then 'PASS' else 'FAIL' end as result from t order by seq;
rollback;
