-- D2 行为测试：以不同学生身份对不同课时写入课时进度，记录放行 / 拒绝。全程在事务中，最后回滚。
-- 身份：vip2（报名韩语、英语）、vip1、普通会员、“资料角色被误设为 teacher 的普通会员”。
begin;

-- 以平台负责人身份临时新增一个韩语非试看课时（课程写入由现有触发器校验）
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000901', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000901","role":"authenticated"}', true);
insert into public.lessons (id, course_id, slug, title, description, lesson_type, duration_minutes, is_free_preview, is_published, sort_order, content_text, content_scope, unlock_mode)
values ('22000000-0000-4000-8000-0000000000d2', '21000000-0000-4000-8000-000000000001', 'korean-verify-lesson-2', 'D2 韩语正式课时', 'D2 测试', 'text', 10, false, true, 20, 'D2', 'platform', 'immediate');

-- 测试身份：verify-korean 只报名韩语；临时把它的档位改成不同值
create function pg_temp.d2_try(p_user uuid, p_lesson uuid) returns text language plpgsql as $$
declare v_course uuid; v_tenant uuid;
begin
  select course_id into v_course from public.lessons where id = p_lesson;
  select id into v_tenant from public.tenants where slug = 'local-dev';
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  begin
    set local role authenticated;
    insert into public.lesson_progress (user_id, course_id, lesson_id, tenant_id, status, progress_percent)
    values (p_user, v_course, p_lesson, v_tenant, 'in_progress', 10);
    raise exception 'D2_ALLOWED';
  exception when others then
    if sqlerrm = 'D2_ALLOWED' then return 'ALLOW'; end if;
    return 'DENY';
  end;
end $$;

create temp table d2_case(label text, user_id uuid, lesson_id uuid, ord int);
insert into d2_case values
  ('vip2 学生 · 韩语试看课时',  '10000000-0000-4000-8000-000000000911', '22000000-0000-4000-8000-000000000001', 1),
  ('vip2 学生 · 韩语正式课时',  '10000000-0000-4000-8000-000000000911', '22000000-0000-4000-8000-0000000000d2', 2),
  ('vip2 学生 · 英语试看课时',  '10000000-0000-4000-8000-000000000911', '22000000-0000-4000-8000-000000000011', 3),
  ('vip2 学生 · 英语正式课时',  '10000000-0000-4000-8000-000000000911', '22000000-0000-4000-8000-000000000012', 4),
  ('vip2 只报韩语 · 英语试看课时', '10000000-0000-4000-8000-000000000921', '22000000-0000-4000-8000-000000000011', 5);

create temp table d2_result(ord int, label text, outcome text);
insert into d2_result select ord, label, pg_temp.d2_try(user_id, lesson_id) from d2_case;

-- vip1 / 普通会员 / 资料角色误设
-- 以机构负责人身份修改成员信息（由现有触发器校验）
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000101', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000101","role":"authenticated"}', true);
update public.tenant_memberships set membership_tier = 'vip1' where user_id = '10000000-0000-4000-8000-000000000921';
insert into d2_result values
  (6, 'vip1 · 韩语试看课时', pg_temp.d2_try('10000000-0000-4000-8000-000000000921', '22000000-0000-4000-8000-000000000001')),
  (7, 'vip1 · 韩语正式课时', pg_temp.d2_try('10000000-0000-4000-8000-000000000921', '22000000-0000-4000-8000-0000000000d2'));
-- 以机构负责人身份修改成员信息（由现有触发器校验）
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000101', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000101","role":"authenticated"}', true);
update public.tenant_memberships set membership_tier = 'normal' where user_id = '10000000-0000-4000-8000-000000000921';
insert into d2_result values
  (8, '普通会员 · 韩语试看课时', pg_temp.d2_try('10000000-0000-4000-8000-000000000921', '22000000-0000-4000-8000-000000000001')),
  (9, '普通会员 · 韩语正式课时', pg_temp.d2_try('10000000-0000-4000-8000-000000000921', '22000000-0000-4000-8000-0000000000d2'));
-- 以机构负责人身份修改成员信息（由现有触发器校验）
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000101', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000101","role":"authenticated"}', true);
update public.profiles set role = 'teacher' where id = '10000000-0000-4000-8000-000000000921';
-- 资料同步触发器会把资料中的档位一并同步到成员关系，这里再设回普通会员
update public.tenant_memberships set role = 'student', membership_tier = 'normal' where user_id = '10000000-0000-4000-8000-000000000921';
insert into d2_result
select 10, '普通会员但资料角色误设为 teacher · 韩语正式课时（成员角色='
  || (select role || '，档位=' || membership_tier from public.tenant_memberships where user_id = '10000000-0000-4000-8000-000000000921') || '）',
  pg_temp.d2_try('10000000-0000-4000-8000-000000000921', '22000000-0000-4000-8000-0000000000d2');

select ord || '|' || label || '|' || outcome from d2_result order by ord;
rollback;
