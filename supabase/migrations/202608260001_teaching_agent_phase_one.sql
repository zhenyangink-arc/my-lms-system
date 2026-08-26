begin;

create table if not exists public.digital_textbook_teaching_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null unique references public.digital_textbook_modules(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  revision integer not null default 1 check (revision > 0),
  objectives jsonb not null default '{}'::jsonb check (jsonb_typeof(objectives) = 'object'),
  guardrails jsonb not null default '{}'::jsonb check (jsonb_typeof(guardrails) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.digital_textbook_teaching_steps (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.digital_textbook_teaching_lessons(id) on delete cascade,
  step_key text not null check (step_key in ('start', 'hint', 'example', 'ready')),
  sort_order integer not null check (sort_order between 1 and 20),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  action_type text not null default 'none' check (action_type in ('none', 'focus_activity', 'advance_module')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, step_key),
  unique (lesson_id, sort_order)
);

create table if not exists public.digital_textbook_teaching_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.digital_textbook_teaching_lessons(id) on delete cascade,
  locale text not null default 'zh-CN' check (locale in ('zh-CN', 'ko-KR')),
  support_mode text not null default 'bilingual' check (support_mode in ('chinese', 'bilingual', 'immersion')),
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  current_step_key text not null default 'start' check (current_step_key in ('start', 'hint', 'example', 'ready')),
  last_action jsonb not null default '{}'::jsonb check (jsonb_typeof(last_action) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.digital_textbook_teaching_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.digital_textbook_teaching_sessions(id) on delete cascade,
  role text not null check (role in ('student', 'assistant', 'system')),
  intent text check (intent is null or intent in ('start', 'hint', 'example', 'ready', 'ask')),
  content text not null check (char_length(content) between 1 and 4000),
  action jsonb not null default '{}'::jsonb check (jsonb_typeof(action) = 'object'),
  provider text,
  model text,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  created_at timestamptz not null default now()
);

create index if not exists digital_textbook_teaching_sessions_student_idx
  on public.digital_textbook_teaching_sessions(tenant_id, student_id, updated_at desc);
create index if not exists digital_textbook_teaching_messages_session_idx
  on public.digital_textbook_teaching_messages(session_id, created_at);

drop trigger if exists digital_textbook_teaching_lessons_set_updated_at on public.digital_textbook_teaching_lessons;
create trigger digital_textbook_teaching_lessons_set_updated_at
before update on public.digital_textbook_teaching_lessons
for each row execute function private.set_updated_at();
drop trigger if exists digital_textbook_teaching_steps_set_updated_at on public.digital_textbook_teaching_steps;
create trigger digital_textbook_teaching_steps_set_updated_at
before update on public.digital_textbook_teaching_steps
for each row execute function private.set_updated_at();
drop trigger if exists digital_textbook_teaching_sessions_set_updated_at on public.digital_textbook_teaching_sessions;
create trigger digital_textbook_teaching_sessions_set_updated_at
before update on public.digital_textbook_teaching_sessions
for each row execute function private.set_updated_at();

alter table public.digital_textbook_teaching_lessons enable row level security;
alter table public.digital_textbook_teaching_steps enable row level security;
alter table public.digital_textbook_teaching_sessions enable row level security;
alter table public.digital_textbook_teaching_messages enable row level security;

create policy "authenticated read published teaching lessons"
on public.digital_textbook_teaching_lessons for select to authenticated
using (status = 'published');
create policy "authenticated read published teaching steps"
on public.digital_textbook_teaching_steps for select to authenticated
using (exists (
  select 1 from public.digital_textbook_teaching_lessons lesson
  where lesson.id = lesson_id and lesson.status = 'published'
));
create policy "students read own teaching sessions"
on public.digital_textbook_teaching_sessions for select to authenticated
using (student_id = auth.uid() and private.is_tenant_member(tenant_id));
create policy "students read own teaching messages"
on public.digital_textbook_teaching_messages for select to authenticated
using (exists (
  select 1 from public.digital_textbook_teaching_sessions session
  where session.id = session_id
    and session.student_id = auth.uid()
    and private.is_tenant_member(session.tenant_id)
));

grant select on public.digital_textbook_teaching_lessons,
  public.digital_textbook_teaching_steps,
  public.digital_textbook_teaching_sessions,
  public.digital_textbook_teaching_messages to authenticated;
grant all on public.digital_textbook_teaching_lessons,
  public.digital_textbook_teaching_steps,
  public.digital_textbook_teaching_sessions,
  public.digital_textbook_teaching_messages to service_role;

insert into public.digital_textbook_teaching_lessons (
  module_id,
  status,
  objectives,
  guardrails
)
select
  module.id,
  'published',
  jsonb_build_object(
    'zh-CN', coalesce(nullif(module.description->>'zh-CN', ''), module.title->>'zh-CN'),
    'ko-KR', coalesce(nullif(module.description->>'ko-KR', ''), module.title->>'ko-KR')
  ),
  jsonb_build_object(
    'maxReplyCharacters', 260,
    'allowedActions', jsonb_build_array('none', 'focus_activity', 'advance_module'),
    'usePublishedContentOnly', true
  )
from public.digital_textbook_modules module
join public.digital_textbook_chapters chapter on chapter.id = module.chapter_id
join public.digital_textbook_versions version on version.id = chapter.version_id
join public.digital_textbooks textbook on textbook.id = version.textbook_id
where textbook.status = 'published'
  and version.status = 'published'
  and chapter.status = 'published'
on conflict (module_id) do nothing;

insert into public.digital_textbook_teaching_steps (
  lesson_id,
  step_key,
  sort_order,
  content,
  action_type
)
select lesson.id, seed.step_key, seed.sort_order,
  jsonb_build_object(
    'zh-CN', replace(replace(seed.zh_text, '{title}', coalesce(module.title->>'zh-CN', '当前内容')), '{goal}', coalesce(nullif(module.description->>'zh-CN', ''), module.title->>'zh-CN', '完成当前学习任务')),
    'ko-KR', replace(replace(seed.ko_text, '{title}', coalesce(module.title->>'ko-KR', '현재 내용')), '{goal}', coalesce(nullif(module.description->>'ko-KR', ''), module.title->>'ko-KR', '현재 학습 활동을 완성합니다'))
  ),
  seed.action_type
from public.digital_textbook_teaching_lessons lesson
join public.digital_textbook_modules module on module.id = lesson.module_id
cross join (values
  ('start', 1, '现在学习“{title}”。本节目标是：{goal}。先看右侧内容，我会按当前进度一步步带你完成。', '지금 “{title}”을 학습합니다. 이번 목표는 {goal}입니다. 오른쪽 내용을 먼저 보고 현재 진도에 맞춰 한 단계씩 진행해 보세요.', 'none'),
  ('hint', 2, '先不用一次记住全部内容。找到右侧任务中的关键词，确认它在句子里的作用，再完成当前这一小步。', '한 번에 전부 외우지 않아도 됩니다. 오른쪽 활동에서 핵심어를 찾고 문장 속 역할을 확인한 뒤 현재 단계만 완성해 보세요.', 'focus_activity'),
  ('example', 3, '请先模仿右侧已经发布的例句，只替换一个人物、地点或身份信息；不要同时改变整个句子。', '오른쪽에 제시된 예문을 먼저 따라 하고 인물, 장소 또는 신분 정보 하나만 바꾸어 말해 보세요.', 'focus_activity'),
  ('ready', 4, '很好。接下来检查右侧尚未完成的活动；完成后我会根据真实学习进度决定进入下一步还是继续巩固。', '좋습니다. 오른쪽에서 아직 완료하지 않은 활동을 확인하세요. 완료 뒤 실제 학습 진도에 따라 다음 단계로 갈지 더 연습할지 정합니다.', 'focus_activity')
) as seed(step_key, sort_order, zh_text, ko_text, action_type)
on conflict (lesson_id, step_key) do nothing;

commit;
