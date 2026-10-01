-- D1 行为测试：在事务中构造英语、韩语专项练习各一题并答错，检查复习记录的应用归属，最后回滚。
begin;
create temp table d1_result(app text, review_items int) on commit drop;
do $$
declare
  v_tenant uuid := (select id from public.tenants where slug = 'local-dev');
  v_student uuid := '10000000-0000-4000-8000-000000000911';
  r record; v_ex uuid; v_q uuid; v_s uuid;
begin
  for r in select slug, id from public.student_apps where slug in ('english','korean') loop
    insert into public.growth_toolbox_exercises (tenant_id, slug, skill, title, student_app_id, status)
    values (v_tenant, 'd1-test-' || r.slug, 'vocabulary', 'D1 测试练习 ' || r.slug, r.id, 'published')
    returning id into v_ex;
    insert into public.growth_toolbox_questions (exercise_id, primary_skill, question_type, prompt)
    values (v_ex, 'vocabulary', 'single_choice', 'D1 测试题') returning id into v_q;
    insert into public.growth_toolbox_question_keys (question_id, accepted_answers) values (v_q, '["A"]'::jsonb);
    insert into public.toolbox_practice_sessions (tenant_id, student_id, exercise_id, skill, client_event_id, student_app_id)
    values (v_tenant, v_student, v_ex, 'vocabulary', gen_random_uuid(), r.id) returning id into v_s;
    insert into public.toolbox_practice_attempts (tenant_id, session_id, student_id, question_id, skill, is_correct, response_payload)
    values (v_tenant, v_s, v_student, v_q, 'vocabulary', false, '{"answer":"B"}'::jsonb);
    insert into d1_result
    select r.slug, count(*) from public.student_review_items
    where student_id = v_student and student_app_id = r.id and source_question_id = v_q;
  end loop;
end $$;
select app, review_items from d1_result order by app;
rollback;
