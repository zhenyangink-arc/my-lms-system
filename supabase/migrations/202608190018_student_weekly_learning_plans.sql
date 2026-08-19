begin;

create table public.student_weekly_learning_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants(id) on delete cascade,
  student_id uuid not null
    references public.profiles(id) on delete cascade,
  student_app_id uuid not null
    references public.student_apps(id) on delete restrict,
  week_start_date date not null default (
    date_trunc('week', timezone('Asia/Seoul', now()))::date
  ),
  target_days smallint not null check (target_days between 1 and 7),
  target_minutes integer not null check (target_minutes between 1 and 10080),
  preferred_days smallint[] not null default '{}'::smallint[] check (
    cardinality(preferred_days) <= 7
    and preferred_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_weekly_learning_plans_week_starts_monday_check
    check (extract(isodow from week_start_date) = 1),
  constraint student_weekly_learning_plans_unique_week
    unique (tenant_id, student_id, student_app_id, week_start_date)
);

drop trigger if exists student_weekly_learning_plans_set_updated_at
  on public.student_weekly_learning_plans;
create trigger student_weekly_learning_plans_set_updated_at
before update on public.student_weekly_learning_plans
for each row execute function private.set_updated_at();

alter table public.student_weekly_learning_plans enable row level security;

-- 读取沿用统一学生学习行为权限：学生本人、应用范围内的负责老师、
-- 本机构负责人和平台负责人均由既有函数按租户、学生、应用实时判断。
create policy "authorized users read student weekly learning plans"
on public.student_weekly_learning_plans for select to authenticated
using (
  private.current_user_can_view_student_activity(
    tenant_id,
    student_id,
    student_app_id
  )
);

-- 学生只能为自己当前仍有权访问的应用创建本周计划。周起点以韩国时间的
-- 周一为准，客户端不能通过传入其他日期创建或覆盖历史周记录。
create policy "students insert own current weekly learning plan"
on public.student_weekly_learning_plans for insert to authenticated
with check (
  private.current_student_has_app_access(
    tenant_id,
    student_id,
    student_app_id
  )
  and week_start_date = (
    date_trunc('week', timezone('Asia/Seoul', statement_timestamp()))::date
  )
);

-- 仅当前周允许调整；using 与 with check 同时约束旧行和新行，防止把历史
-- 记录移入当前周或把当前记录改写成其他周。表不提供 delete 策略。
create policy "students update own current weekly learning plan"
on public.student_weekly_learning_plans for update to authenticated
using (
  private.current_student_has_app_access(
    tenant_id,
    student_id,
    student_app_id
  )
  and week_start_date = (
    date_trunc('week', timezone('Asia/Seoul', statement_timestamp()))::date
  )
)
with check (
  private.current_student_has_app_access(
    tenant_id,
    student_id,
    student_app_id
  )
  and week_start_date = (
    date_trunc('week', timezone('Asia/Seoul', statement_timestamp()))::date
  )
);

revoke all on public.student_weekly_learning_plans
  from public, anon, authenticated;
grant select, insert, update on public.student_weekly_learning_plans
  to authenticated;
grant all on public.student_weekly_learning_plans to service_role;

comment on table public.student_weekly_learning_plans is
  '按租户、学生、学生应用和韩国时区周一保存的个人周学习目标；历史周只读保留';
comment on column public.student_weekly_learning_plans.week_start_date is
  'Asia/Seoul 本地日期所在 ISO 周的周一；数据库默认值和写策略均按该时区计算';
comment on column public.student_weekly_learning_plans.preferred_days is
  '偏好学习日，ISO 星期数：1=周一，7=周日；空数组表示未指定';

commit;
