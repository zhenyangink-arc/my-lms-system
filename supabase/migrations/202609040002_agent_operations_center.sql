begin;

alter table public.guide_agent_messages
  add column if not exists response_mode text
    check (response_mode is null or response_mode in ('local_rule', 'model')),
  add column if not exists first_token_ms integer
    check (first_token_ms is null or first_token_ms >= 0),
  add column if not exists total_duration_ms integer
    check (total_duration_ms is null or total_duration_ms >= 0);

create table if not exists public.guide_agent_navigation_rules (
  id uuid primary key default gen_random_uuid(),
  agent_profile_id uuid not null references public.learning_agent_profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  trigger_phrases text[] not null check (cardinality(trigger_phrases) between 1 and 20),
  action_type text not null check (action_type in ('navigate', 'highlight')),
  target_path text not null check (target_path ~ '^/dashboard(?:[/?#]|$)'),
  target_element_id text check (
    target_element_id is null or target_element_id ~ '^[A-Za-z][A-Za-z0-9:._-]{0,99}$'
  ),
  response_text text not null check (char_length(btrim(response_text)) between 2 and 200),
  priority integer not null default 100 check (priority between 0 and 1000),
  status text not null default 'enabled' check (status in ('enabled', 'disabled')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_profile_id, name),
  check (action_type = 'navigate' or target_element_id is not null)
);

create index if not exists guide_agent_navigation_rules_lookup_idx
  on public.guide_agent_navigation_rules(agent_profile_id, status, priority desc, updated_at desc);

create trigger guide_agent_navigation_rules_set_updated_at
before update on public.guide_agent_navigation_rules
for each row execute function private.set_updated_at();

create table if not exists public.guide_agent_operation_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 2 and 80),
  target_type text not null check (char_length(target_type) between 2 and 80),
  target_id uuid,
  summary text not null check (char_length(summary) between 2 and 240),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists guide_agent_operation_logs_created_idx
  on public.guide_agent_operation_logs(created_at desc);

alter table public.guide_agent_navigation_rules enable row level security;
alter table public.guide_agent_operation_logs enable row level security;

revoke all on public.guide_agent_navigation_rules from public, anon, authenticated;
revoke all on public.guide_agent_operation_logs from public, anon, authenticated;
grant all on public.guide_agent_navigation_rules to service_role;
grant all on public.guide_agent_operation_logs to service_role;

insert into public.guide_agent_navigation_rules (
  agent_profile_id,
  name,
  trigger_phrases,
  action_type,
  target_path,
  response_text,
  priority,
  status
)
select profile.id, seed.name, seed.trigger_phrases, 'navigate', seed.target_path,
       seed.response_text, seed.priority, 'enabled'
from public.learning_agent_profiles profile
cross join (
  values
    ('继续韩语学习', array['继续学习', '进入韩语1级', '打开韩语1级课程'], '/dashboard/courses', '好的，正在为你打开韩语课程。', 300),
    ('打开课程中心', array['打开课程中心', '进入课程中心', '我的课程在哪里'], '/dashboard/courses', '好的，正在为你打开课程中心。', 250),
    ('打开巩固中心', array['打开巩固中心', '进入巩固中心', '查看学习进度'], '/dashboard/practice/course', '好的，正在为你打开课程巩固中心。', 220),
    ('打开专项练习', array['打开专项练习', '进入专项训练', '专项练习在哪里'], '/dashboard/practice/skills', '好的，正在为你打开专项练习。', 210),
    ('打开作业与考试', array['打开作业与考试', '进入作业', '查看考试'], '/dashboard/assignments', '好的，正在为你打开作业与考试。', 200),
    ('打开大学中心', array['打开大学中心', '进入大学中心', '查看目标大学'], '/dashboard/universities', '好的，正在为你打开大学中心。', 190)
) as seed(name, trigger_phrases, target_path, response_text, priority)
where profile.agent_code = 'uply-guide-agent'
on conflict (agent_profile_id, name) do nothing;

comment on table public.guide_agent_navigation_rules is
  '平台负责人维护的导航 Agent 本地规则，仅由服务端读取与修改。';
comment on table public.guide_agent_operation_logs is
  'Agent 运营中心的不可变操作审计记录，仅平台负责人可通过服务端查看。';

commit;
