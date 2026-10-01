-- D6 行为测试（依赖 D5 已执行）：用 create_learning_assignment 出数学题，并回归旧题型。全程在事务中，最后回滚。
begin;
create temp table d6_result(seq serial, name text, outcome text) on commit drop;
grant all on d6_result to public;
grant usage on sequence d6_result_seq_seq to public;

create function pg_temp.try(p_user uuid, p_sql text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  begin
    set local role authenticated;
    execute p_sql;
    reset role;
    return 'ok';
  exception when others then
    reset role;
    return 'denied: ' || left(sqlerrm, 60);
  end;
end $$;
grant execute on function pg_temp.try(uuid, text) to public;

-- 租户课程（create_learning_assignment 只接受本机构的课程；验证库里的课程是平台级的，没有数学课程）
insert into public.course_categories (id, parent_id, slug, title, description, is_published, sort_order, content_scope, student_app_id, tenant_id)
select v.id, null, v.slug, v.title, 'D6 测试', true, 30, 'tenant', a.id, '10000000-0000-4000-8000-000000000001'
from (values ('20000000-0000-4000-8000-0000000000d6'::uuid, 'math-d6', '数学课程', 'math'),
             ('20000000-0000-4000-8000-0000000000d7'::uuid, 'korean-d6', '韩语课程', 'korean')) v(id, slug, title, app)
join public.student_apps a on a.slug = v.app;
insert into public.courses (id, category_id, slug, title, description, level, is_published, sort_order, content_scope, unlock_mode, student_app_id, tenant_id)
select v.id, v.cat, v.slug, v.title, 'D6 测试', 'beginner', true, 10, 'tenant', 'immediate', a.id, '10000000-0000-4000-8000-000000000001'
from (values ('21000000-0000-4000-8000-0000000000d6'::uuid, '20000000-0000-4000-8000-0000000000d6'::uuid, 'math-d6-course', '大学数学一', 'math'),
             ('21000000-0000-4000-8000-0000000000d7'::uuid, '20000000-0000-4000-8000-0000000000d7'::uuid, 'korean-d6-course', '韩语一', 'korean')) v(id, cat, slug, title, app)
join public.student_apps a on a.slug = v.app;

do $$
declare
  v_admin uuid := '10000000-0000-4000-8000-000000000101';
  v_student uuid := '10000000-0000-4000-8000-000000000911';
  v_math_course uuid := '21000000-0000-4000-8000-0000000000d6';
  v_kr_course uuid := '21000000-0000-4000-8000-0000000000d7';
  v_expr text := '{"type":"math.expression","prompt":"化简","points":5,"mathSpec":{"expected":"2x+2","variables":[{"name":"x","min":-5,"max":5}],"seed":7}}';
  v_num text := '{"type":"math.numeric","prompt":"求值","points":2,"explanation":"1/3","mathSpec":{"expected":0.3333,"tolerance":{"abs":0.001,"rel":0}}}';
  v_short text := '{"type":"short_text","prompt":"普通简答","points":1,"correctAnswer":"答案"}';
  v_n int; v_auto text;
  function_call text := 'select public.create_learning_assignment(''D6 测试作业'', '''', ''homework'', %L, ''all_students'', null, now() + interval ''1 day'', null, false, false, %L::jsonb)';
begin
  insert into d6_result(name, outcome) values ('1a 数学课程下出数学题（表达式 + 数值 + 简答）',
    pg_temp.try(v_admin, format(function_call, v_math_course, '[' || v_expr || ',' || v_num || ',' || v_short || ']')));
  select count(*) into v_n from public.math_question_specs s join public.learning_assignment_questions q on q.id = s.question_id where q.prompt in ('化简', '求值');
  insert into d6_result(name, outcome) values ('1b 写入 2 条判题规格', v_n::text);
  select string_agg(question_type || ':' || auto_graded::text, ',' order by sort_order) into v_auto
  from public.learning_assignment_questions q join public.learning_assignments a on a.id = q.assignment_id where a.title = 'D6 测试作业';
  insert into d6_result(name, outcome) values ('1c 题型与自动判分标记', v_auto);
  select count(*) into v_n from public.learning_assignment_question_keys k join public.learning_assignment_questions q on q.id = k.question_id where q.prompt in ('化简', '求值', '普通简答');
  insert into d6_result(name, outcome) values ('1d 答案键行数（简答 1 + 数值题解析 1 = 2）', v_n::text);
  select a.student_app_id = (select id from public.student_apps where slug = 'math') into v_auto from public.learning_assignments a where a.title = 'D6 测试作业';
  insert into d6_result(name, outcome) values ('1e 作业归属数学应用', v_auto);

  insert into d6_result(name, outcome) values ('2a 数学题缺少 mathSpec 被拒',
    pg_temp.try(v_admin, format(function_call, v_math_course, '[{"type":"math.numeric","prompt":"x","points":1}]')));
  insert into d6_result(name, outcome) values ('2b 数学题规格畸形被拒',
    pg_temp.try(v_admin, format(function_call, v_math_course, '[{"type":"math.numeric","prompt":"x","points":1,"mathSpec":{"expected":"1"}}]')));
  insert into d6_result(name, outcome) values ('2c 数学题带 correctAnswer 被拒',
    pg_temp.try(v_admin, format(function_call, v_math_course, '[{"type":"math.numeric","prompt":"x","points":1,"correctAnswer":"1","mathSpec":{"expected":1,"tolerance":{"abs":0,"rel":0}}}]')));
  insert into d6_result(name, outcome) values ('2d 非数学题带 mathSpec 被拒',
    pg_temp.try(v_admin, format(function_call, v_math_course, '[{"type":"short_text","prompt":"x","points":1,"mathSpec":{"expected":1,"tolerance":{"abs":0,"rel":0}}}]')));
  insert into d6_result(name, outcome) values ('2e 未登记题型仍被拒',
    pg_temp.try(v_admin, format(function_call, v_math_course, '[{"type":"math.foo","prompt":"x","points":1}]')));
  insert into d6_result(name, outcome) values ('2f 学生不能出题',
    pg_temp.try(v_student, format(function_call, v_math_course, '[' || v_expr || ']')));

  -- 回归：旧题型、韩语课程
  insert into d6_result(name, outcome) values ('3a 韩语课程出旧题型（选择 + 简答 + 链接）仍成功',
    pg_temp.try(v_admin, format(function_call, v_kr_course,
      '[{"type":"single_choice","prompt":"选","points":1,"options":["A","B"],"correctAnswer":"A"},{"type":"short_text","prompt":"答","points":1},{"type":"file_link","prompt":"链","points":1}]')));
  insert into d6_result(name, outcome) values ('3b 旧题型选择题选项不足仍被拒',
    pg_temp.try(v_admin, format(function_call, v_kr_course, '[{"type":"single_choice","prompt":"选","points":1,"options":["A"]}]')));
  insert into d6_result(name, outcome) values ('3c 录音题仍不能通过此入口创建',
    pg_temp.try(v_admin, format(function_call, v_kr_course, '[{"type":"audio_recording","prompt":"录","points":1}]')));
  select count(*) into v_n from public.math_question_specs;
  insert into d6_result(name, outcome) values ('3d 被拒的创建不留下规格（总数仍为 2）', v_n::text);
end $$;
select seq, name, outcome from d6_result order by seq;
rollback;
