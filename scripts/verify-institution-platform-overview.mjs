#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const dbContainer =
  process.env.LOCAL_SUPABASE_DB_CONTAINER ?? "supabase_db_my-lms-system";

const sql = String.raw`
begin;

insert into auth.users (id, email, aud, role, created_at, updated_at)
values
  ('b1100000-0000-4000-8000-000000000001', 'overview-owner-a@example.test', 'authenticated', 'authenticated', now(), now()),
  ('b1100000-0000-4000-8000-000000000002', 'overview-owner-b@example.test', 'authenticated', 'authenticated', now(), now()),
  ('b1100000-0000-4000-8000-000000000003', 'overview-platform@example.test', 'authenticated', 'authenticated', now(), now()),
  ('b1100000-0000-4000-8000-000000000004', 'overview-student-a@example.test', 'authenticated', 'authenticated', now(), now()),
  ('b1100000-0000-4000-8000-000000000005', 'overview-student-b@example.test', 'authenticated', 'authenticated', now(), now());

update public.profiles set role = 'tenant_super_admin', global_role = 'tenant_super_admin',
  full_name = '甲机构负责人', status = 'active'
where id = 'b1100000-0000-4000-8000-000000000001';
update public.profiles set role = 'tenant_super_admin', global_role = 'tenant_super_admin',
  full_name = '乙机构负责人', status = 'active'
where id = 'b1100000-0000-4000-8000-000000000002';
update public.profiles set role = 'platform_super_admin', global_role = 'platform_owner',
  full_name = '平台负责人', status = 'active'
where id = 'b1100000-0000-4000-8000-000000000003';
update public.profiles set role = 'student', global_role = 'member',
  full_name = '甲学生', status = 'active'
where id = 'b1100000-0000-4000-8000-000000000004';
update public.profiles set role = 'student', global_role = 'member',
  full_name = '乙学生', status = 'active'
where id = 'b1100000-0000-4000-8000-000000000005';

insert into public.tenants (id, slug, name, status, created_by)
values
  ('b1200000-0000-4000-8000-000000000001', 'overview-tenant-a', '概览甲机构', 'active', 'b1100000-0000-4000-8000-000000000001'),
  ('b1200000-0000-4000-8000-000000000002', 'overview-tenant-b', '概览乙机构', 'active', 'b1100000-0000-4000-8000-000000000002');

insert into public.tenant_memberships (
  tenant_id, user_id, role, status, is_default
) values
  ('b1200000-0000-4000-8000-000000000001', 'b1100000-0000-4000-8000-000000000001', 'tenant_super_admin', 'active', true),
  ('b1200000-0000-4000-8000-000000000001', 'b1100000-0000-4000-8000-000000000004', 'student', 'active', true),
  ('b1200000-0000-4000-8000-000000000002', 'b1100000-0000-4000-8000-000000000002', 'tenant_super_admin', 'active', true),
  ('b1200000-0000-4000-8000-000000000002', 'b1100000-0000-4000-8000-000000000005', 'student', 'active', true);

insert into public.student_app_enrollments (
  tenant_id, student_id, app_id, status, access_tier, starts_at, enrolled_by
) values
  ('b1200000-0000-4000-8000-000000000001', 'b1100000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'active', 'normal', '2026-08-01 00:00:00+00', 'b1100000-0000-4000-8000-000000000001'),
  ('b1200000-0000-4000-8000-000000000002', 'b1100000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'active', 'normal', '2026-08-01 00:00:00+00', 'b1100000-0000-4000-8000-000000000002');

insert into public.student_learning_activity_events (
  id, tenant_id, student_id, student_app_id, category, event_type,
  source_kind, source_id, dedupe_key, occurred_at
) values
  ('b1300000-0000-4000-8000-000000000001', 'b1200000-0000-4000-8000-000000000001', 'b1100000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'course', 'lesson_completed', 'fixture', 'a', 'overview:a', '2026-08-19 01:00:00+00'),
  ('b1300000-0000-4000-8000-000000000002', 'b1200000-0000-4000-8000-000000000002', 'b1100000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'task', 'assignment_graded', 'fixture', 'b', 'overview:b', '2026-08-19 01:00:00+00');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"b1100000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

do $$
declare
  v_payload jsonb;
begin
  v_payload := public.get_institution_platform_learning_overview(
    'b1200000-0000-4000-8000-000000000001',
    '2026-08-19 03:00:00+00'
  );
  if jsonb_array_length(v_payload -> 'institutions') <> 1
    or v_payload #>> '{institutions,0,tenant_id}'
      <> 'b1200000-0000-4000-8000-000000000001'
    or (v_payload #>> '{institutions,0,active_count}')::integer <> 1
  then
    raise exception '机构 A 查询混入其他机构或统计错误: %', v_payload;
  end if;

  begin
    perform public.get_institution_platform_learning_overview(
      'b1200000-0000-4000-8000-000000000002',
      '2026-08-19 03:00:00+00'
    );
    raise exception '机构 A 跨机构调用没有被拒绝';
  exception when sqlstate '42501' then
    null;
  end;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"b1100000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);

do $$
declare
  v_payload jsonb;
  v_tenant_b_active integer;
begin
  v_payload := public.get_institution_platform_learning_overview(
    null,
    '2026-08-19 03:00:00+00'
  );
  if v_payload ->> 'scope' <> 'platform'
    or not (v_payload -> 'institutions') @> '[{"tenant_id":"b1200000-0000-4000-8000-000000000001"}]'::jsonb
    or not (v_payload -> 'institutions') @> '[{"tenant_id":"b1200000-0000-4000-8000-000000000002"}]'::jsonb
  then
    raise exception '平台负责人没有获得全局机构汇总: %', v_payload;
  end if;
  select (institution ->> 'active_count')::integer
  into v_tenant_b_active
  from jsonb_array_elements(v_payload -> 'institutions') as institution
  where institution ->> 'tenant_id'
    = 'b1200000-0000-4000-8000-000000000002';
  if v_tenant_b_active <> 0 then
    raise exception '老师批改事件被错误计入学生今日活跃: %', v_payload;
  end if;
end;
$$;

select 'institution-platform-overview-db-verification:ok';
rollback;
`;

const result = spawnSync(
  "docker",
  [
    "exec",
    "-i",
    dbContainer,
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-At",
  ],
  { input: sql, encoding: "utf8" },
);

assert.equal(
  result.status,
  0,
  result.stderr || result.stdout || "database verification failed",
);
assert.match(result.stdout, /institution-platform-overview-db-verification:ok/);
console.log("institution-platform-overview-db-verification:ok");
