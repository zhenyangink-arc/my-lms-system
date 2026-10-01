-- D9 行为测试（依赖 D9 已执行；验证库里需有 fixtures.sql 的基础账号）。全程在事务中，最后回滚。
-- 账号：901 平台负责人，101 机构负责人，911 学生（有大学课程应用授权），921 学生（没有大学课程授权），931 老师。
-- 输出每行 “序号 名称~实际~预期~PASS/FAIL”。
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
  exception when others then reset role; return 'denied: ' || left(sqlerrm, 40); end;
end $$;
-- 当前用户的可见范围：“是否受限|可见二级分类 slug（排序）”
create function pg_temp.scope_of(p_user uuid) returns text language plpgsql as $$
declare v_restricted boolean; v_ids uuid[]; v_names text;
begin
  perform pg_temp.as_user(p_user);
  set local role authenticated;
  select s.restricted, s.category_ids into v_restricted, v_ids from public.university_category_scope() s;
  reset role;  -- 按 slug 查名字要在超级用户下做（921 没有大学课程授权，读不到这些分类）
  select coalesce(string_agg(c.slug, ',' order by c.slug), '') into v_names from public.course_categories c where c.id = any (v_ids);
  return format('%s|%s', case when v_restricted then 'true' else 'false' end, v_names);
end $$;
grant execute on function pg_temp.as_user(uuid), pg_temp.try(uuid, text), pg_temp.scope_of(uuid) to public;

do $$
declare
  v_owner uuid := '10000000-0000-4000-8000-000000000901';
  v_admin uuid := '10000000-0000-4000-8000-000000000101';
  v_s1 uuid := '10000000-0000-4000-8000-000000000911';
  v_s2 uuid := '10000000-0000-4000-8000-000000000921';
  v_teacher uuid := '10000000-0000-4000-8000-000000000931';
  v_tenant uuid := '10000000-0000-4000-8000-000000000001';
  v_uni uuid := (select id from public.student_apps where slug = 'university');
  v_kr uuid := (select id from public.student_apps where slug = 'korean');
  c_top uuid := '20000000-0000-4000-8000-0000000000d0';
  c_cs uuid := '20000000-0000-4000-8000-0000000000d1';
  c_law uuid := '20000000-0000-4000-8000-0000000000d2';
  c_se uuid := '20000000-0000-4000-8000-0000000000d3';
  c_sci uuid := '20000000-0000-4000-8000-0000000000d4';
  c_gen uuid := '20000000-0000-4000-8000-0000000000d5';
  c_kr uuid := '20000000-0000-4000-8000-0000000000d6';
  r text; n int;
  pol_before text; pol_after text;
begin
  -- 共用表的策略指纹（D9 不应改动任何既有策略；这里只能比较“测试期间”不变，上线前后对比见 rehearse-d9.sh）
  select md5(string_agg(tablename || policyname || coalesce(qual, '') || coalesce(with_check, ''), '|' order by tablename, policyname))
    into pol_before from pg_policies where tablename in ('courses', 'course_categories', 'lessons', 'student_app_enrollments');

  -- 准备：学生 911 开通大学课程；大学课程分类树（以超级用户身份直接写入）
  perform pg_temp.as_user(v_admin);
  update public.tenant_student_apps set status = 'active', is_enabled = true where tenant_id = v_tenant and app_id = v_uni;
  insert into public.student_app_enrollments (tenant_id, student_id, app_id, status, access_tier)
  values (v_tenant, v_s1, v_uni, 'active', 'vip2') on conflict do nothing;
  perform pg_temp.as_user(v_owner);
  insert into public.course_categories (id, parent_id, slug, title, description, is_published, sort_order, content_scope, student_app_id) values
    (c_top, null, 'd9-uni', '大学课程', 'D9', true, 90, 'platform', v_uni),
    (c_cs, c_top, 'd9-cs', '计算机', 'D9', true, 10, 'platform', v_uni),
    (c_law, c_top, 'd9-law', '法学', 'D9', true, 20, 'platform', v_uni),
    (c_se, c_top, 'd9-se', '软件工程', 'D9', true, 30, 'platform', v_uni),
    (c_sci, c_top, 'd9-sci', '理工公共课', 'D9', true, 40, 'platform', v_uni),
    (c_gen, c_top, 'd9-gen', '通识课', 'D9', true, 50, 'platform', v_uni),
    (c_kr, null, 'd9-kr', '韩语板块', 'D9', true, 91, 'platform', v_kr);
  insert into public.course_categories (id, parent_id, slug, title, description, is_published, sort_order, content_scope, student_app_id)
  values ('20000000-0000-4000-8000-0000000000d7', c_kr, 'd9-kr-sub', '韩语二级', 'D9', true, 1, 'platform', v_kr);

  -- 1 设置可见模式：权限
  insert into t(name, got, expected) values ('1a 机构负责人不能设置可见模式', pg_temp.try(v_admin, format($f$select public.set_university_category_access(%L, 'public')$f$, c_gen)) like 'denied%', 'true');
  insert into t(name, got, expected) values ('1b 学生不能设置可见模式', pg_temp.try(v_s1, format($f$select public.set_university_category_access(%L, 'public')$f$, c_gen)) like 'denied%', 'true');
  insert into t(name, got, expected) values ('1c 平台负责人设置通识课为 public', pg_temp.try(v_owner, format($f$select public.set_university_category_access(%L, 'public')$f$, c_gen)), 'ok');
  insert into t(name, got, expected) values ('1d 平台负责人设置理工公共课为 shared 并关联计算机、软件工程',
    pg_temp.try(v_owner, format($f$select public.set_university_category_access(%L, 'shared', array[%L, %L]::uuid[])$f$, c_sci, c_cs, c_se)), 'ok');
  select count(*) into n from public.university_category_major_links where category_id = c_sci;
  insert into t(name, got, expected) values ('1e 关联了 2 个专业', n::text, '2');

  -- 2 校验
  insert into t(name, got, expected) values ('2a 顶层分类不能设置可见模式', pg_temp.try(v_owner, format($f$select public.set_university_category_access(%L, 'public')$f$, c_top)) like 'denied%', 'true');
  insert into t(name, got, expected) values ('2b 其他应用的分类不能设置可见模式', pg_temp.try(v_owner, format($f$select public.set_university_category_access(%L, 'public')$f$, '20000000-0000-4000-8000-0000000000d7')) like 'denied%', 'true');
  insert into t(name, got, expected) values ('2c 非 shared 模式不能带关联专业', pg_temp.try(v_owner, format($f$select public.set_university_category_access(%L, 'public', array[%L]::uuid[])$f$, c_gen, c_cs)) like 'denied%', 'true');
  insert into t(name, got, expected) values ('2d 公共课组不能被当作专业关联', pg_temp.try(v_owner, format($f$select public.set_university_category_access(%L, 'shared', array[%L]::uuid[])$f$, c_sci, c_gen)) like 'denied%', 'true');
  insert into t(name, got, expected) values ('2e 无效模式被拒', pg_temp.try(v_owner, format($f$select public.set_university_category_access(%L, 'x')$f$, c_gen)) like 'denied%', 'true');
  select count(*) into n from public.university_category_major_links where category_id = c_sci;
  insert into t(name, got, expected) values ('2f 被拒的整体替换没有改动原关联（仍为 2）', n::text, '2');

  -- 3 学生所属专业：权限与校验
  insert into t(name, got, expected) values ('3a 机构负责人给 911 设置计算机专业', pg_temp.try(v_admin, format($f$select public.set_student_major_enrollment(%L, %L)$f$, v_s1, c_cs)), 'ok');
  insert into t(name, got, expected) values ('3b 学生自己不能设置专业', pg_temp.try(v_s1, format($f$select public.set_student_major_enrollment(%L, %L)$f$, v_s1, c_law)) like 'denied%', 'true');
  insert into t(name, got, expected) values ('3c 没有大学课程授权的学生 921 不能选专业', pg_temp.try(v_admin, format($f$select public.set_student_major_enrollment(%L, %L)$f$, v_s2, c_cs)) like 'denied%', 'true');
  insert into t(name, got, expected) values ('3d 不能选公共课组作为专业', pg_temp.try(v_admin, format($f$select public.set_student_major_enrollment(%L, %L)$f$, v_s1, c_sci)) like 'denied%', 'true');
  insert into t(name, got, expected) values ('3e 不能选其他应用的分类', pg_temp.try(v_admin, format($f$select public.set_student_major_enrollment(%L, %L)$f$, v_s1, '20000000-0000-4000-8000-0000000000d7')) like 'denied%', 'true');
  insert into t(name, got, expected) values ('3f 老师（无管理学生能力）不能设置', pg_temp.try(v_teacher, format($f$select public.set_student_major_enrollment(%L, %L)$f$, v_s1, c_law)) like 'denied%', 'true');
  insert into t(name, got, expected) values ('3g 无效状态被拒', pg_temp.try(v_admin, format($f$select public.set_student_major_enrollment(%L, %L, 'x')$f$, v_s1, c_law)) like 'denied%', 'true');
  insert into t(name, got, expected) values ('3h 直接写表被拒（authenticated 无写权限）', pg_temp.try(v_admin, format($f$insert into public.student_major_enrollments (tenant_id, student_id, category_id) values (%L, %L, %L)$f$, v_tenant, v_s1, c_law)) like 'denied%', 'true');

  -- 4 读取
  perform pg_temp.as_user(v_s1); set local role authenticated;
  select count(*) into n from public.student_major_enrollments; reset role;
  insert into t(name, got, expected) values ('4a 学生 911 只能读到自己的 1 条专业记录', n::text, '1');
  perform pg_temp.as_user(v_s2); set local role authenticated;
  select count(*) into n from public.student_major_enrollments; reset role;
  insert into t(name, got, expected) values ('4b 学生 921 读不到别人的专业记录', n::text, '0');
  perform pg_temp.as_user(v_admin); set local role authenticated;
  select count(*) into n from public.student_major_enrollments; reset role;
  insert into t(name, got, expected) values ('4c 机构负责人读到本机构记录', n::text, '1');

  -- 5 可见范围
  insert into t(name, got, expected) values ('5a 911（计算机）：看到计算机、理工公共课、通识课，看不到法学', pg_temp.scope_of(v_s1), 'true|d9-cs,d9-gen,d9-sci');
  insert into t(name, got, expected) values ('5b 921（未选专业）：只看到通识课', pg_temp.scope_of(v_s2), 'true|d9-gen');
  insert into t(name, got, expected) values ('5c 老师不受限', pg_temp.scope_of(v_teacher), 'false|');
  insert into t(name, got, expected) values ('5d 机构负责人不受限', pg_temp.scope_of(v_admin), 'false|');
  insert into t(name, got, expected) values ('5e 平台负责人不受限', pg_temp.scope_of(v_owner), 'false|');
  insert into t(name, got, expected) values ('5f 增加法学专业（辅修）', pg_temp.try(v_admin, format($f$select public.set_student_major_enrollment(%L, %L)$f$, v_s1, c_law)), 'ok');
  insert into t(name, got, expected) values ('5g 911（计算机 + 法学）：多看到法学', pg_temp.scope_of(v_s1), 'true|d9-cs,d9-gen,d9-law,d9-sci');
  insert into t(name, got, expected) values ('5h 暂停计算机：理工公共课仍因关联不到有效专业而消失（只剩法学、通识课）',
    pg_temp.try(v_admin, format($f$select public.set_student_major_enrollment(%L, %L, 'paused')$f$, v_s1, c_cs)), 'ok');
  insert into t(name, got, expected) values ('5i 暂停后的范围', pg_temp.scope_of(v_s1), 'true|d9-gen,d9-law');
  -- 5j 未登录：先清空会话里的用户，再取范围
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  insert into t(name, got, expected) values ('5j 未登录：受限且为空',
    (select format('%s|%s', case when restricted then 'true' else 'false' end, coalesce(array_length(category_ids, 1), 0)) from public.university_category_scope() limit 1), 'true|0');

  -- 6 模式变更保护
  insert into t(name, got, expected) values ('6a 有学生选择的专业不能改成 public', pg_temp.try(v_owner, format($f$select public.set_university_category_access(%L, 'public')$f$, c_law)) like 'denied%', 'true');
  insert into t(name, got, expected) values ('6b 被公共课组关联的专业不能改成 public', pg_temp.try(v_owner, format($f$select public.set_university_category_access(%L, 'public')$f$, c_se)) like 'denied%', 'true');
  insert into t(name, got, expected) values ('6c 公共课组改成 public 时关联被清除', pg_temp.try(v_owner, format($f$select public.set_university_category_access(%L, 'public')$f$, c_sci)), 'ok');
  select count(*) into n from public.university_category_major_links where category_id = c_sci;
  insert into t(name, got, expected) values ('6d 关联为 0', n::text, '0');

  -- 7 级联删除
  delete from public.course_categories where id = c_law;
  select count(*) into n from public.student_major_enrollments where category_id = c_law;
  insert into t(name, got, expected) values ('7a 删除专业分类后学生专业记录一并删除', n::text, '0');

  -- 8 共用表策略没有被改动
  select md5(string_agg(tablename || policyname || coalesce(qual, '') || coalesce(with_check, ''), '|' order by tablename, policyname))
    into pol_after from pg_policies where tablename in ('courses', 'course_categories', 'lessons', 'student_app_enrollments');
  insert into t(name, got, expected) values ('8 courses / course_categories / lessons / student_app_enrollments 的策略指纹不变', (pol_before = pol_after)::text, 'true');
end $$;

select seq || ' ' || name || '~' || got || '~' || expected || '~' || case when got = expected then 'PASS' else 'FAIL' end from t order by seq;
rollback;
