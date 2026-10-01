-- D11 行为测试：在事务中以平台负责人身份调用，检查“今日活跃学生”随时区变化；最后回滚。
-- 前置：lms-verify 库（verify-owner 为平台负责人；local-dev 机构有 verify-student 等学生）。
begin;

-- 只留我们构造的活动（回滚后恢复）
delete from public.student_learning_activity_events;
-- 事件：2026-10-01 15:30Z（首尔 10/2 00:30，纽约 10/1 11:30）
insert into public.student_learning_activity_events
  (tenant_id, student_id, student_app_id, category, event_type, source_kind, source_id, dedupe_key, occurred_at)
values ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000911', '10000000-0000-4000-8000-000000000002',
        'course', 'lesson_viewed', 'lesson', 'd11-a', 'd11-a', '2026-10-01T15:30:00Z');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000901', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000901","role":"authenticated"}', true);
set local role authenticated;

create temp table d11_out(name text, result text) on commit drop;
grant all on d11_out to authenticated;

-- now = 2026-10-01 10:00Z（首尔 10/1 19:00，纽约 10/1 06:00）。首尔今天 = [9/30 15:00Z, 10/1 15:00Z)，纽约今天 = [10/1 04:00Z, 10/2 04:00Z)
insert into d11_out
select '今日活跃人数：不传时区 = 首尔 = 0', (r -> 'institutions' -> 0 ->> 'active_count')
from (select public.get_institution_platform_learning_overview(null, '2026-10-01T10:00:00Z') r) x;
insert into d11_out
select '今日活跃人数：显式首尔 = 0', (r -> 'institutions' -> 0 ->> 'active_count')
from (select public.get_institution_platform_learning_overview(null, '2026-10-01T10:00:00Z', 'Asia/Seoul') r) x;
insert into d11_out
select '今日活跃人数：纽约 = 1', (r -> 'institutions' -> 0 ->> 'active_count')
from (select public.get_institution_platform_learning_overview(null, '2026-10-01T10:00:00Z', 'America/New_York') r) x;
insert into d11_out
select '空字符串时区 = 首尔：与不传结果逐字一致 = true',
  (public.get_institution_platform_learning_overview(null, '2026-10-01T10:00:00Z', '')
   = public.get_institution_platform_learning_overview(null, '2026-10-01T10:00:00Z'))::text;

do $$
begin
  perform public.get_institution_platform_learning_overview(null, now(), 'Mars/Olympus');
  insert into d11_out values ('无效时区被拒 = 22023', 'NOT REJECTED');
exception when others then
  insert into d11_out values ('无效时区被拒 = 22023', sqlstate);
end $$;

-- 授权不变：平台负责人传机构 id 仍被拒；学生被拒
do $$
begin
  perform public.get_institution_platform_learning_overview('10000000-0000-4000-8000-000000000001', now(), 'Asia/Seoul');
  insert into d11_out values ('平台负责人传机构 id 被拒 = 42501', 'NOT REJECTED');
exception when others then
  insert into d11_out values ('平台负责人传机构 id 被拒 = 42501', sqlstate);
end $$;
reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000911', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000911","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  perform public.get_institution_platform_learning_overview('10000000-0000-4000-8000-000000000001', now(), 'Asia/Seoul');
  insert into d11_out values ('学生调用被拒 = 42501', 'NOT REJECTED');
exception when others then
  insert into d11_out values ('学生调用被拒 = 42501', sqlstate);
end $$;
reset role;
insert into d11_out values ('anon 无执行权限 = false', has_function_privilege('anon', 'public.get_institution_platform_learning_overview(uuid,timestamptz,text)', 'execute')::text);
insert into d11_out values ('authenticated 有执行权限 = true', has_function_privilege('authenticated', 'public.get_institution_platform_learning_overview(uuid,timestamptz,text)', 'execute')::text);
insert into d11_out values ('旧 2 参数签名已不存在（只剩 1 个重载）= 1', (select count(*) from pg_proc where proname = 'get_institution_platform_learning_overview')::text);

select name || '  =>  ' || result as check from d11_out;
rollback;
