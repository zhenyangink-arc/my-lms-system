-- D10 行为测试：在事务中以 verify-teacher 身份调用，检查日界线随时区变化；最后回滚。
-- 前置：lms-verify 库已执行 fixtures-english-teacher.sql（verify-teacher 负责 verify-student 的英语应用）。
-- 约定：每行输出 “检查名 | 结果”，期望值写在检查名里。
begin;

-- 只留我们构造的活动，避免库里已有事件干扰（回滚后恢复）
delete from public.student_learning_activity_events
 where student_id = '10000000-0000-4000-8000-000000000911'
   and student_app_id = '10000000-0000-4000-8000-000000000002';

-- 事件 1：2026-09-28 03:00Z（首尔 9/28 12:00，纽约 9/27 23:00）
insert into public.student_learning_activity_events
  (tenant_id, student_id, student_app_id, category, event_type, source_kind, source_id, dedupe_key, occurred_at)
values ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000911', '10000000-0000-4000-8000-000000000002',
        'course', 'lesson_viewed', 'lesson', 'd10-a', 'd10-a', '2026-09-28T03:00:00Z');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000931', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000931","role":"authenticated"}', true);
set local role authenticated;

create temp table d10_out(name text, result text) on commit drop;
grant all on d10_out to authenticated;

-- 以下 now = 2026-10-01 10:00Z（首尔 10/1 19:00，纽约 10/1 06:00）
insert into d10_out
select '连续未学习天数：不传时区 = 首尔 = 3', (r -> 'students' -> 0 ->> 'inactive_days')
from (select public.get_teacher_class_today_snapshot('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', null, '2026-10-01T10:00:00Z') r) x;
insert into d10_out
select '连续未学习天数：显式首尔 = 3', (r -> 'students' -> 0 ->> 'inactive_days')
from (select public.get_teacher_class_today_snapshot('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', null, '2026-10-01T10:00:00Z', 'Asia/Seoul') r) x;
insert into d10_out
select '连续未学习天数：纽约 = 4', (r -> 'students' -> 0 ->> 'inactive_days')
from (select public.get_teacher_class_today_snapshot('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', null, '2026-10-01T10:00:00Z', 'America/New_York') r) x;
insert into d10_out
select '空字符串时区 = 首尔：与不传结果逐字一致 = true',
  (public.get_teacher_class_today_snapshot('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', null, '2026-10-01T10:00:00Z', '')
   = public.get_teacher_class_today_snapshot('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', null, '2026-10-01T10:00:00Z'))::text;

-- 事件 2：2026-10-01 15:30Z（首尔 10/2 00:30，纽约 10/1 11:30），对 now = 10/1 10:00Z 来说在“未来”，
-- 仅用来区分“是否落在今天”的区间：首尔今天是 [9/30 15:00Z, 10/1 15:00Z)，纽约今天是 [10/1 04:00Z, 10/2 04:00Z)
reset role;
insert into public.student_learning_activity_events
  (tenant_id, student_id, student_app_id, category, event_type, source_kind, source_id, dedupe_key, occurred_at)
values ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000911', '10000000-0000-4000-8000-000000000002',
        'course', 'lesson_viewed', 'lesson', 'd10-b', 'd10-b', '2026-10-01T15:30:00Z');
set local role authenticated;

insert into d10_out
select '今天已学习：首尔（15:30Z 不在今天）= false', (r -> 'students' -> 0 ->> 'studied_today')
from (select public.get_teacher_class_today_snapshot('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', null, '2026-10-01T10:00:00Z', 'Asia/Seoul') r) x;
insert into d10_out
select '今天已学习：纽约（15:30Z 在今天）= true', (r -> 'students' -> 0 ->> 'studied_today')
from (select public.get_teacher_class_today_snapshot('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', null, '2026-10-01T10:00:00Z', 'America/New_York') r) x;

-- 错误路径
do $$
begin
  perform public.get_teacher_class_today_snapshot('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', null, now(), 'Mars/Olympus');
  insert into d10_out values ('无效时区被拒 = 22023', 'NOT REJECTED');
exception when others then
  insert into d10_out values ('无效时区被拒 = 22023', sqlstate);
end $$;

-- 授权不变：学生、匿名不能调用；函数权限
reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000911', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000911","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  perform public.get_teacher_class_today_snapshot('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', null, now(), 'Asia/Seoul');
  insert into d10_out values ('学生调用被拒 = 42501', 'NOT REJECTED');
exception when others then
  insert into d10_out values ('学生调用被拒 = 42501', sqlstate);
end $$;
reset role;
insert into d10_out values ('anon 无执行权限 = false', has_function_privilege('anon', 'public.get_teacher_class_today_snapshot(uuid,uuid,uuid,timestamptz,text)', 'execute')::text);
insert into d10_out values ('authenticated 有执行权限 = true', has_function_privilege('authenticated', 'public.get_teacher_class_today_snapshot(uuid,uuid,uuid,timestamptz,text)', 'execute')::text);
insert into d10_out values ('旧 4 参数签名已不存在（只剩 1 个重载）= 1', (select count(*) from pg_proc where proname = 'get_teacher_class_today_snapshot')::text);

select name || '  =>  ' || result as check from d10_out;
rollback;
