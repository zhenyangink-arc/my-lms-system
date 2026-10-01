-- D5 行为测试：题型约束、判题规格读写与权限、机器判题结果写入与权限。全程在事务中，最后回滚。
-- 身份：管理员 ...101（机构超级管理员）、老师 ...931（只分配到英语）、学生 ...911。
begin;
create temp table d5_result(seq serial, name text, outcome text) on commit drop;
grant all on d5_result to public;
grant usage on sequence d5_result_seq_seq to public;

-- 以指定身份与数据库角色执行一条语句，成功返回 ok，失败返回错误信息（前 60 字）
create function pg_temp.try(p_user uuid, p_role text, p_sql text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', p_role)::text, true);
  begin
    execute 'set local role ' || p_role;
    execute p_sql;
    reset role;
    return 'ok';
  exception when others then
    reset role;
    return 'denied: ' || left(sqlerrm, 60);
  end;
end $$;
grant execute on function pg_temp.try(uuid, text, text) to public;

-- 以调用者的权限写入判题规格（D5 不再提供写入函数；浏览器角色直接写必须被拒）
create function pg_temp.set_spec(p_question uuid, p_grader text, p_spec jsonb, p_by uuid) returns void language sql as $$
  insert into public.math_question_specs (question_id, tenant_id, grader_key, spec, updated_by)
  select q.id, q.tenant_id, p_grader, p_spec, p_by from public.learning_assignment_questions q where q.id = p_question
  on conflict (question_id) do update set grader_key = excluded.grader_key, spec = excluded.spec;
$$;
grant execute on function pg_temp.set_spec(uuid, text, jsonb, uuid) to public;

do $$
declare
  v_t uuid := '10000000-0000-4000-8000-000000000001';
  v_assign uuid := '23000000-0000-4000-8000-000000000021';
  v_admin uuid := '10000000-0000-4000-8000-000000000101';
  v_teacher uuid := '10000000-0000-4000-8000-000000000931';
  v_student uuid := '10000000-0000-4000-8000-000000000911';
  q_expr uuid := '24000000-0000-4000-8000-0000000d5001';
  q_num uuid := '24000000-0000-4000-8000-0000000d5002';
  q_text uuid := '24000000-0000-4000-8000-0000000d5003';
  v_sub uuid := '25000000-0000-4000-8000-0000000d5001';
  a_expr uuid := '26000000-0000-4000-8000-0000000d5001';
  a_text uuid := '26000000-0000-4000-8000-0000000d5003';
  r text;
  v_auto boolean;
  v_n int;
begin
  -- 1 题型约束
  insert into public.learning_assignment_questions (id, tenant_id, assignment_id, question_type, prompt, points, sort_order)
  values (q_expr, v_t, v_assign, 'math.expression', '化简', 5, 91),
         (q_num, v_t, v_assign, 'math.numeric', '求值', 2, 92),
         (q_text, v_t, v_assign, 'short_text', '普通简答', 1, 93);
  insert into d5_result(name, outcome) values ('1a 两种数学题型可写入', 'ok');
  select auto_graded into v_auto from public.learning_assignment_questions where id = q_expr;
  insert into d5_result(name, outcome) values ('1b 数学题 auto_graded = false', v_auto::text);
  insert into d5_result(name, outcome)
  select '1c 未登记题型被拒', pg_temp.try(null, 'postgres',
    format($f$insert into public.learning_assignment_questions (tenant_id, assignment_id, question_type, prompt, points, sort_order) values (%L, %L, 'math.foo', 'x', 1, 99)$f$, v_t, v_assign));

  -- 2 判题规格
  r := pg_temp.try(v_admin, 'postgres', format($f$select pg_temp.set_spec(%L, 'math.expression-equivalence', '{"expected":"2x+2","variables":[{"name":"x","min":-5,"max":5}],"seed":7}'::jsonb, '10000000-0000-4000-8000-000000000101')$f$, q_expr));
  insert into d5_result(name, outcome) values ('2a 合法规格可写入（postgres 角色）', r);
  insert into d5_result(name, outcome) values ('2b 判题器与题型不匹配被拒（postgres 角色）',
    pg_temp.try(v_admin, 'postgres', format($f$select pg_temp.set_spec(%L, 'math.numeric', '{"expected":1,"tolerance":{"abs":0.001,"rel":0}}'::jsonb, '10000000-0000-4000-8000-000000000101')$f$, q_expr)));
  insert into d5_result(name, outcome) values ('2c 非对象规格被拒',
    pg_temp.try(v_admin, 'postgres', format($f$select pg_temp.set_spec(%L, 'math.expression-equivalence', '[]'::jsonb, '10000000-0000-4000-8000-000000000101')$f$, q_expr)));
  insert into d5_result(name, outcome) values ('2d 老师直接写规格被拒（浏览器角色无写权限）',
    pg_temp.try(v_teacher, 'authenticated', format($f$select pg_temp.set_spec(%L, 'math.numeric', '{"expected":1,"tolerance":{"abs":0.001,"rel":0}}'::jsonb, '10000000-0000-4000-8000-000000000101')$f$, q_num)));
  insert into d5_result(name, outcome) values ('2e 学生直接写规格被拒',
    pg_temp.try(v_student, 'authenticated', format($f$select pg_temp.set_spec(%L, 'math.numeric', '{"expected":1,"tolerance":{"abs":0.001,"rel":0}}'::jsonb, '10000000-0000-4000-8000-000000000101')$f$, q_num)));
  insert into d5_result(name, outcome) values ('2d2 机构管理员直接写规格被拒',
    pg_temp.try(v_admin, 'authenticated', format($f$select pg_temp.set_spec(%L, 'math.numeric', '{"expected":1,"tolerance":{"abs":0.001,"rel":0}}'::jsonb, %L)$f$, q_num, v_admin)));
  insert into d5_result(name, outcome) values ('2f 浏览器角色不能直接写规格表',
    pg_temp.try(v_admin, 'authenticated', format($f$insert into public.math_question_specs (question_id, tenant_id, grader_key, spec, updated_by) values (%L, %L, 'math.numeric', '{"expected":1,"tolerance":{"abs":0.001,"rel":0}}', %L)$f$, q_num, v_t, v_admin)));
  insert into d5_result(name, outcome) values ('2g 超大规格被拒',
    pg_temp.try(v_admin, 'postgres', format($f$select pg_temp.set_spec(%L, 'math.expression-equivalence', jsonb_build_object('expected', repeat('x', 5000)), '10000000-0000-4000-8000-000000000101')$f$, q_expr)));
  for r in select unnest(array[
      '{"seed":1,"variables":[{"name":"x","min":0,"max":1}]}',
      '{"expected":"x","seed":1.5,"variables":[{"name":"x","min":0,"max":1}]}',
      '{"expected":"x","seed":1,"variables":[]}',
      '{"expected":"x","seed":1,"variables":[{"name":"x","min":"0","max":1}]}',
      '{"expected":"x","seed":1,"variables":[{"name":"x","min":0,"max":1}],"tolerance":{"abs":-1,"rel":0}}',
      '{"expected":5,"seed":1,"variables":[{"name":"x","min":0,"max":1}]}'
    ]) loop
    insert into d5_result(name, outcome) values ('2j 畸形表达式规格被拒：' || left(r, 40),
      pg_temp.try(v_admin, 'postgres', format($f$select pg_temp.set_spec(%L, 'math.expression-equivalence', %L::jsonb, '10000000-0000-4000-8000-000000000101')$f$, q_expr, r)));
  end loop;
  for r in select unnest(array[
      '{"expected":1}',
      '{"expected":"1","tolerance":{"abs":0,"rel":0}}',
      '{"expected":1,"tolerance":{"abs":"0","rel":0}}',
      '{"expected":1,"tolerance":{"abs":0}}'
    ]) loop
    insert into d5_result(name, outcome) values ('2k 畸形数值规格被拒：' || left(r, 40),
      pg_temp.try(v_admin, 'postgres', format($f$select pg_temp.set_spec(%L, 'math.numeric', %L::jsonb, '10000000-0000-4000-8000-000000000101')$f$, q_num, r)));
  end loop;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  select count(*) into v_n from public.math_question_specs;
  reset role;
  insert into d5_result(name, outcome) values ('2h 管理员可读规格（应为 1）', v_n::text);
  perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_student::text, true);
  set local role authenticated;
  select count(*) into v_n from public.math_question_specs;
  reset role;
  insert into d5_result(name, outcome) values ('2i 学生读规格（应为 0）', v_n::text);

  -- 3 机器判题结果
  insert into public.learning_submissions (id, tenant_id, assignment_id, student_id, attempt_number, request_id, request_payload_hash, submission_state, objective_graded_at)
  values (v_sub, v_t, v_assign, v_student, 91, gen_random_uuid(), 'd5', 'objective_graded_pending_manual', now());
  insert into public.learning_submission_answers (id, tenant_id, submission_id, question_id, answer_text)
  values (a_expr, v_t, v_sub, q_expr, '2(x+1)'), (a_text, v_t, v_sub, q_text, '随便');

  insert into d5_result(name, outcome) values ('3a 管理员不能直接调用写入 RPC',
    pg_temp.try(v_admin, 'authenticated', format($f$select public.record_learning_machine_grade(%L, 'math.expression-equivalence', '1.0.0', 'correct', 5, 'equivalent_on_samples', '{}'::jsonb)$f$, a_expr)));
  insert into d5_result(name, outcome) values ('3b 服务端写入成功',
    pg_temp.try(null, 'service_role', format($f$select public.record_learning_machine_grade(%L, 'math.expression-equivalence', '1.0.0', 'correct', 5, 'equivalent_on_samples', '{"seed":7}'::jsonb)$f$, a_expr)));
  insert into d5_result(name, outcome) values ('3c 重判新增一行',
    pg_temp.try(null, 'service_role', format($f$select public.record_learning_machine_grade(%L, 'math.expression-equivalence', '1.0.1', 'incorrect', 0, 'value_mismatch', '{}'::jsonb)$f$, a_expr)));
  select count(*) into v_n from public.learning_submission_machine_grades where answer_id = a_expr;
  insert into d5_result(name, outcome) values ('3c2 自动补判（only_if_missing）遇到已有结果不再新增',
    pg_temp.try(null, 'service_role', format($f$select public.record_learning_machine_grade(%L, 'math.expression-equivalence', '1.0.0', 'correct', 5, 'equivalent_on_samples', '{}'::jsonb, true)$f$, a_expr)));
  insert into d5_result(name, outcome) values ('3d 留痕行数（应为 2）', v_n::text);
  select max(revision) into v_n from public.learning_submission_machine_grades where answer_id = a_expr;
  insert into d5_result(name, outcome) values ('3e 最新修订号（应为 2）', v_n::text);
  insert into d5_result(name, outcome) values ('3f 建议得分超过满分被拒',
    pg_temp.try(null, 'service_role', format($f$select public.record_learning_machine_grade(%L, 'math.expression-equivalence', '1.0.0', 'correct', 6, 'x', '{}'::jsonb)$f$, a_expr)));
  insert into d5_result(name, outcome) values ('3g error 带得分被拒',
    pg_temp.try(null, 'service_role', format($f$select public.record_learning_machine_grade(%L, 'math.expression-equivalence', '1.0.0', 'error', 0, 'x', '{}'::jsonb)$f$, a_expr)));
  insert into d5_result(name, outcome) values ('3h error 无得分可写入',
    pg_temp.try(null, 'service_role', format($f$select public.record_learning_machine_grade(%L, 'math.expression-equivalence', '1.0.0', 'error', null, 'invalid_answer', '{}'::jsonb)$f$, a_expr)));
  insert into d5_result(name, outcome) values ('3i 判题器键与题型不符被拒',
    pg_temp.try(null, 'service_role', format($f$select public.record_learning_machine_grade(%L, 'math.numeric', '1.0.0', 'correct', 5, 'x', '{}'::jsonb)$f$, a_expr)));
  insert into d5_result(name, outcome) values ('3j 非数学题被拒',
    pg_temp.try(null, 'service_role', format($f$select public.record_learning_machine_grade(%L, 'math.numeric', '1.0.0', 'correct', 1, 'x', '{}'::jsonb)$f$, a_text)));
  insert into d5_result(name, outcome) values ('3k 不存在的答案被拒',
    pg_temp.try(null, 'service_role', $f$select public.record_learning_machine_grade(gen_random_uuid(), 'math.numeric', '1.0.0', 'correct', 1, 'x', '{}'::jsonb)$f$));

  -- 4 读取权限
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  select count(*) into v_n from public.learning_submission_machine_grades;
  reset role;
  insert into d5_result(name, outcome) values ('4a 管理员可读机器判题（应为 3）', v_n::text);
  foreach r in array array[v_student::text, v_teacher::text] loop
    perform set_config('request.jwt.claims', json_build_object('sub', r, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', r, true);
    set local role authenticated;
    select count(*) into v_n from public.learning_submission_machine_grades;
    reset role;
    insert into d5_result(name, outcome) values ('4b 学生/老师（无数学应用权限）读到行数（应为 0）：' || left(r, 36), v_n::text);
  end loop;
  insert into d5_result(name, outcome) values ('4c 浏览器角色不能直接写机器判题',
    pg_temp.try(v_admin, 'authenticated', format($f$insert into public.learning_submission_machine_grades (tenant_id, answer_id, revision, grader_key, grader_version, verdict, suggested_points, reason) values (%L, %L, 9, 'math.numeric', '1', 'correct', 1, 'x')$f$, v_t, a_expr)));

  -- 5 状态与规格冻结
  update public.learning_submissions set submission_state = 'grading_completed', grading_completed_at = now() where id = v_sub;
  insert into d5_result(name, outcome) values ('5a 提交已批改完成后不能写机器判题',
    pg_temp.try(null, 'service_role', format($f$select public.record_learning_machine_grade(%L, 'math.expression-equivalence', '1.0.0', 'correct', 5, 'x', '{}'::jsonb)$f$, a_expr)));
  insert into d5_result(name, outcome) values ('5b 已有作答后不能改规格（postgres 角色）',
    pg_temp.try(v_admin, 'postgres', format($f$select pg_temp.set_spec(%L, 'math.expression-equivalence', '{"expected":"x","variables":[{"name":"x","min":0,"max":1}],"seed":1}'::jsonb, '10000000-0000-4000-8000-000000000101')$f$, q_expr)));
  insert into d5_result(name, outcome) values ('5c 删除带作答与规格的数学题（级联）不被规格触发器拦截',
    pg_temp.try(null, 'postgres', format($f$delete from public.learning_assignment_questions where id = %L$f$, q_expr)));
  select count(*) into v_n from public.math_question_specs where question_id = q_expr;
  insert into d5_result(name, outcome) values ('5d 规格随题目级联删除（应为 0）', v_n::text);
end $$;
select seq, name, outcome from d5_result order by seq;
rollback;
