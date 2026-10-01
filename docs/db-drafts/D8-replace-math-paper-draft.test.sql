-- D8 行为测试（依赖 D5、D7、D8 已执行）：整体替换草稿、原子性、权限与状态限制。全程在事务中，最后回滚。
begin;
create temp table t(seq serial, name text, got text, expected text) on commit drop;
grant all on t to public; grant usage on sequence t_seq_seq to public;
create function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true); end $$;
create function pg_temp.try(p_user uuid, p_sql text) returns text language plpgsql as $$
begin
  perform pg_temp.as_user(p_user);
  begin set local role authenticated; execute p_sql; reset role; return 'ok';
  exception when others then reset role; return 'denied: ' || left(sqlerrm, 50); end;
end $$;
grant execute on function pg_temp.as_user(uuid), pg_temp.try(uuid, text) to public;

do $$
declare
  v_owner uuid := '10000000-0000-4000-8000-000000000901';
  v_admin uuid := '10000000-0000-4000-8000-000000000101';
  v_student uuid := '10000000-0000-4000-8000-000000000911';
  v_app uuid := (select id from public.student_apps where slug = 'math');
  v_test uuid; v_paper uuid; v_pub uuid; v_kr uuid; r text; n int;
  v_old text := $q$[
    {"type":"math.expression","prompt":"旧题一","points":5,"explanation":"旧解析","mathSpec":{"expected":"2x+2","variables":[{"name":"x","min":-5,"max":5}],"seed":7}},
    {"type":"single_choice","prompt":"旧题二","points":5,"explanation":"旧","options":["1","2"],"correctAnswer":"2"}]$q$;
  v_new text := $q$[
    {"type":"math.numeric","prompt":"新题一","points":3,"explanation":"新解析","difficulty":"hard","mathSpec":{"expected":0.5,"tolerance":{"abs":0.01,"rel":0}}},
    {"type":"math.expression","prompt":"新题二","points":4,"explanation":"新","mathSpec":{"expected":"x^2","variables":[{"name":"x","min":0,"max":3}],"seed":99}},
    {"type":"single_choice","prompt":"新题三","points":3,"explanation":"新","options":["a","b","c"],"correctAnswer":"c"}]$q$;
begin
  perform pg_temp.as_user(v_owner);
  insert into public.course_categories (id, parent_id, slug, title, description, is_published, sort_order, content_scope, student_app_id)
  values ('20000000-0000-4000-8000-0000000000e8', null, 'math-e8', '数学课程', 'D8', true, 30, 'platform', v_app);
  insert into public.courses (id, category_id, slug, title, description, level, is_published, sort_order, content_scope, unlock_mode, student_app_id)
  values ('21000000-0000-4000-8000-0000000000e8', '20000000-0000-4000-8000-0000000000e8', 'math-e8', '大学数学一', 'D8', 'beginner', true, 10, 'platform', 'immediate', v_app);
  insert into public.lessons (id, course_id, slug, title, description, lesson_type, duration_minutes, is_free_preview, is_published, sort_order, content_text, content_scope, unlock_mode)
  values ('22000000-0000-4000-8000-0000000000e8', '21000000-0000-4000-8000-0000000000e8', 'math-e8-l', '极限', 'D8', 'text', 10, false, true, 1, 'D8', 'platform', 'immediate');
  insert into public.chapter_tests (slug, course_key, chapter_number, title, lesson_id)
  values ('math-e8-test', 'math-e8', 1, '数学容器', '22000000-0000-4000-8000-0000000000e8') returning id into v_test;

  set local role authenticated;
  v_paper := public.create_math_paper('原试卷', '旧说明', 'exam', v_test, 30, 60, false, v_old::jsonb);
  v_pub := public.create_math_paper('已发布试卷', '', 'exam', v_test, 30, 60, false, v_old::jsonb);
  perform public.change_assessment_paper_status(v_pub, 'published');
  reset role;
  select format('count=%s total=%s', question_count, total_points) into r from public.assessment_papers where id = v_paper;
  insert into t(name, got, expected) values ('0 原草稿', r, 'count=2 total=10.00');

  -- 1 整体替换
  insert into t(name, got, expected) values ('1a 平台负责人整体替换草稿',
    pg_temp.try(v_owner, format($f$select public.replace_math_paper_draft(%L, '新名称', '新说明', 45, 70, true, %L::jsonb)$f$, v_paper, v_new)), 'ok');
  select format('%s|%s|%s|%s|%s|count=%s total=%s|%s', title, description, duration_minutes, passing_score, allow_resubmission, question_count, total_points, status)
    into r from public.assessment_papers where id = v_paper;
  insert into t(name, got, expected) values ('1b 元数据与汇总已更新', r, '新名称|新说明|45|70.00|t|count=3 total=10.00|draft');
  select string_agg(question_type || ':' || prompt || ':' || difficulty, ',' order by sort_order) into r from public.assessment_paper_questions where paper_id = v_paper;
  insert into t(name, got, expected) values ('1c 题目已全部替换', r, 'math.numeric:新题一:hard,math.expression:新题二:foundation,single_choice:新题三:foundation');
  select count(*) into n from public.math_paper_question_specs s join public.assessment_paper_questions q on q.id = s.paper_question_id where q.paper_id = v_paper;
  insert into t(name, got, expected) values ('1d 规格 2 条（旧规格已删除，无孤立规格）', n::text || '/' || (select count(*) from public.math_paper_question_specs)::text, '2/3');
  select count(*) into n from public.assessment_paper_question_keys k join public.assessment_paper_questions q on q.id = k.question_id where q.paper_id = v_paper;
  insert into t(name, got, expected) values ('1e 答案键 3 条', n::text, '3');
  select string_agg(coalesce(k.correct_answer, '-'), ',' order by q.sort_order) into r from public.assessment_paper_question_keys k join public.assessment_paper_questions q on q.id = k.question_id where q.paper_id = v_paper;
  insert into t(name, got, expected) values ('1f 选择题答案键更新', r, '-,-,c');
  select format('%s/%s/%s', paper_type, source_test_id = v_test, version) into r from public.assessment_papers where id = v_paper;
  insert into t(name, got, expected) values ('1g 类型、容器、版本不变', r, 'exam/t/1');
  insert into t(name, got, expected) values ('1h 替换后发布校验无问题', coalesce(array_to_string(private.assessment_paper_release_issues(v_paper), ' | '), 'NULL'), '');

  -- 2 原子性：校验失败时原草稿保持原样
  insert into t(name, got, expected) values ('2a 题目校验失败被拒',
    left(pg_temp.try(v_owner, format($f$select public.replace_math_paper_draft(%L, '失败名称', '', 30, 60, false, '[{"type":"math.numeric","prompt":"x","points":1,"explanation":"e"}]'::jsonb)$f$, v_paper)), 40), 'denied: 第 1 题缺少合法的判题规格');
  select format('%s|count=%s', title, (select count(*) from public.assessment_paper_questions where paper_id = v_paper)) into r from public.assessment_papers where id = v_paper;
  insert into t(name, got, expected) values ('2b 失败后原内容不变', r, '新名称|count=3');
  select count(*) into n from public.math_paper_question_specs where paper_question_id not in (select id from public.assessment_paper_questions);
  insert into t(name, got, expected) values ('2c 无孤立规格', n::text, '0');
  for r in select unnest(array['[]', 'null', '"x"', '{}']) loop
    insert into t(name, got, expected) values ('2d 题目数组非法被拒：' || r,
      left(pg_temp.try(v_owner, format($f$select public.replace_math_paper_draft(%L, '名称', '', 30, 60, false, %L::jsonb)$f$, v_paper, r)), 6), 'denied');
  end loop;
  for r in select unnest(array['a', repeat('长', 121)]) loop
    insert into t(name, got, expected) values ('2e 名称不合法被拒：' || left(r, 5),
      left(pg_temp.try(v_owner, format($f$select public.replace_math_paper_draft(%L, %L, '', 30, 60, false, %L::jsonb)$f$, v_paper, r, v_new)), 6), 'denied');
  end loop;
  insert into t(name, got, expected) values ('2f 用时越界被拒',
    left(pg_temp.try(v_owner, format($f$select public.replace_math_paper_draft(%L, '名称', '', 601, 60, false, %L::jsonb)$f$, v_paper, v_new)), 6), 'denied');
  insert into t(name, got, expected) values ('2g 及格线越界被拒',
    left(pg_temp.try(v_owner, format($f$select public.replace_math_paper_draft(%L, '名称', '', 30, 101, false, %L::jsonb)$f$, v_paper, v_new)), 6), 'denied');

  -- 3 状态与权限
  insert into t(name, got, expected) values ('3a 已发布试卷不能整体替换',
    pg_temp.try(v_owner, format($f$select public.replace_math_paper_draft(%L, '名称', '', 30, 60, false, %L::jsonb)$f$, v_pub, v_new)), 'denied: 只有草稿试卷可以修改，请先复制为新草稿');
  insert into t(name, got, expected) values ('3b 机构管理员不能替换',
    pg_temp.try(v_admin, format($f$select public.replace_math_paper_draft(%L, '名称', '', 30, 60, false, %L::jsonb)$f$, v_paper, v_new)), 'denied: 只有平台负责人或指定管理员可以修改标准试卷');
  insert into t(name, got, expected) values ('3c 学生不能替换',
    pg_temp.try(v_student, format($f$select public.replace_math_paper_draft(%L, '名称', '', 30, 60, false, %L::jsonb)$f$, v_paper, v_new)), 'denied: 只有平台负责人或指定管理员可以修改标准试卷');
  insert into t(name, got, expected) values ('3d 不存在的试卷被拒',
    pg_temp.try(v_owner, format($f$select public.replace_math_paper_draft(gen_random_uuid(), '名称', '', 30, 60, false, %L::jsonb)$f$, v_new)), 'denied: 试卷不存在或不是数学试卷');
  insert into t(name, got, expected) values ('3e 匿名角色没有执行权限',
    left(pg_temp.try(null, format($f$select public.replace_math_paper_draft(%L, '名称', '', 30, 60, false, %L::jsonb)$f$, v_paper, v_new)), 6), 'denied');

  -- 4 非数学试卷不能用这个函数改（韩语试卷）
  insert into public.chapter_tests (slug, course_key, chapter_number, title, lesson_id)
  values ('kr-e8-test', 'korean-1', 1, '韩语容器', '22000000-0000-4000-8000-000000000001') returning id into v_test;
  insert into public.chapter_test_questions (test_id, question_key, prompt, options, correct_option, explanation, skill, sort_order, ebook_section_step)
  values (v_test, 'q1', '题', '["A","B","C","D"]', 1, '解析', 'vocabulary', 1, 'STEP 01');
  perform pg_temp.as_user(v_owner); set local role authenticated;
  v_kr := public.create_assessment_paper_from_bank('韩语草稿', '', 'exam', v_test, 30, 60, false, false,
    jsonb_build_array(jsonb_build_object('questionId', (select id from public.chapter_test_questions where test_id = v_test limit 1), 'points', 5)));
  reset role;
  insert into t(name, got, expected) values ('4a 韩语试卷不能用此函数修改',
    pg_temp.try(v_owner, format($f$select public.replace_math_paper_draft(%L, '名称', '', 30, 60, false, %L::jsonb)$f$, v_kr, v_new)), 'denied: 试卷不存在或不是数学试卷');
  select format('%s|%s', title, question_count) into r from public.assessment_papers where id = v_kr;
  insert into t(name, got, expected) values ('4b 韩语试卷未被改动', r, '韩语草稿|1');
end $$;
select seq, name, got, expected, case when got = expected then 'PASS' else 'FAIL' end as result from t order by seq;
rollback;
