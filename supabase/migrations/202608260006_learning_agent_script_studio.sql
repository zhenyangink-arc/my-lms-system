begin;

create table public.learning_agent_script_versions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.learning_agent_lessons(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  title jsonb not null default '{}'::jsonb check (jsonb_typeof(title) = 'object'),
  change_note text not null default '' check (char_length(change_note) <= 500),
  created_by uuid references auth.users(id) on delete set null,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, version_number)
);

create unique index learning_agent_script_versions_one_draft_idx
  on public.learning_agent_script_versions(lesson_id)
  where status = 'draft';
create unique index learning_agent_script_versions_one_published_idx
  on public.learning_agent_script_versions(lesson_id)
  where status = 'published';
create index learning_agent_script_versions_lesson_idx
  on public.learning_agent_script_versions(lesson_id, version_number desc);

create table public.learning_agent_script_nodes (
  id uuid primary key default gen_random_uuid(),
  script_version_id uuid not null references public.learning_agent_script_versions(id) on delete cascade,
  node_key text not null check (node_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  node_type text not null check (node_type in (
    'opening', 'explanation', 'example', 'question', 'instruction', 'summary'
  )),
  sort_order integer not null check (sort_order between 1 and 200),
  title jsonb not null default '{}'::jsonb check (jsonb_typeof(title) = 'object'),
  teacher_script jsonb not null check (jsonb_typeof(teacher_script) = 'object'),
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  reference_activity_id uuid references public.digital_textbook_activities(id) on delete set null,
  action_type text not null default 'none' check (action_type in (
    'none', 'focus_activity', 'play_expression', 'complete_lesson'
  )),
  next_node_key text,
  remediation_node_key text,
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (script_version_id, node_key),
  constraint learning_agent_script_nodes_version_order_key
    unique (script_version_id, sort_order) deferrable initially immediate
);

create index learning_agent_script_nodes_version_idx
  on public.learning_agent_script_nodes(script_version_id, sort_order);

create table public.learning_agent_node_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.learning_agent_sessions(id) on delete cascade,
  script_version_id uuid not null references public.learning_agent_script_versions(id) on delete cascade,
  node_id uuid not null references public.learning_agent_script_nodes(id) on delete cascade,
  response jsonb not null default '{}'::jsonb check (jsonb_typeof(response) = 'object'),
  is_correct boolean,
  created_at timestamptz not null default now()
);

create index learning_agent_node_attempts_student_idx
  on public.learning_agent_node_attempts(tenant_id, student_id, session_id, created_at desc);

create table public.learning_agent_publish_logs (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.learning_agent_lessons(id) on delete cascade,
  script_version_id uuid not null references public.learning_agent_script_versions(id) on delete cascade,
  action text not null check (action in (
    'create_draft', 'publish', 'archive', 'add_node', 'update_node', 'delete_node', 'reorder_node'
  )),
  actor_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create index learning_agent_publish_logs_lesson_idx
  on public.learning_agent_publish_logs(lesson_id, created_at desc);

alter table public.learning_agent_sessions
  add column script_version_id uuid references public.learning_agent_script_versions(id) on delete set null,
  add column current_node_id uuid references public.learning_agent_script_nodes(id) on delete set null,
  add column teaching_state jsonb not null default '{}'::jsonb check (jsonb_typeof(teaching_state) = 'object');

alter table public.learning_agent_messages
  drop constraint if exists digital_textbook_teaching_messages_intent_check;
alter table public.learning_agent_messages
  drop constraint if exists learning_agent_messages_intent_check;
alter table public.learning_agent_messages
  add constraint learning_agent_messages_intent_check
  check (intent is null or intent in ('start', 'hint', 'example', 'ready', 'ask', 'answer'));

drop trigger if exists learning_agent_script_versions_set_updated_at on public.learning_agent_script_versions;
create trigger learning_agent_script_versions_set_updated_at
before update on public.learning_agent_script_versions
for each row execute function private.set_updated_at();

drop trigger if exists learning_agent_script_nodes_set_updated_at on public.learning_agent_script_nodes;
create trigger learning_agent_script_nodes_set_updated_at
before update on public.learning_agent_script_nodes
for each row execute function private.set_updated_at();

alter table public.learning_agent_script_versions enable row level security;
alter table public.learning_agent_script_nodes enable row level security;
alter table public.learning_agent_node_attempts enable row level security;
alter table public.learning_agent_publish_logs enable row level security;

create policy "authenticated read published learning agent script versions"
on public.learning_agent_script_versions for select to authenticated
using (status = 'published');

create policy "platform owner manages learning agent script versions"
on public.learning_agent_script_versions for all to authenticated
using ((select private.is_platform_owner()))
with check ((select private.is_platform_owner()));

create policy "authenticated read published learning agent script nodes"
on public.learning_agent_script_nodes for select to authenticated
using (exists (
  select 1 from public.learning_agent_script_versions version
  where version.id = script_version_id and version.status = 'published'
));

create policy "platform owner manages learning agent script nodes"
on public.learning_agent_script_nodes for all to authenticated
using ((select private.is_platform_owner()))
with check ((select private.is_platform_owner()));

create policy "students read own learning agent node attempts"
on public.learning_agent_node_attempts for select to authenticated
using (student_id = auth.uid() and private.is_tenant_member(tenant_id));

create policy "platform owner reads learning agent publish logs"
on public.learning_agent_publish_logs for select to authenticated
using ((select private.is_platform_owner()));

grant select on public.learning_agent_script_versions,
  public.learning_agent_script_nodes,
  public.learning_agent_node_attempts,
  public.learning_agent_publish_logs to authenticated;
grant all on public.learning_agent_script_versions,
  public.learning_agent_script_nodes,
  public.learning_agent_node_attempts,
  public.learning_agent_publish_logs to service_role;

create or replace function public.create_learning_agent_script_draft(
  p_lesson_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_existing uuid;
  v_published uuid;
  v_created uuid;
  v_next_version integer;
begin
  if auth.uid() is null or not private.is_platform_owner() then
    raise exception '只有平台负责人可以编辑教学脚本';
  end if;

  perform 1 from public.learning_agent_lessons where id = p_lesson_id for update;
  if not found then raise exception '没有找到对应的教学模块'; end if;

  select id into v_existing
  from public.learning_agent_script_versions
  where lesson_id = p_lesson_id and status = 'draft'
  limit 1;
  if v_existing is not null then return v_existing; end if;

  select coalesce(max(version_number), 0) + 1 into v_next_version
  from public.learning_agent_script_versions
  where lesson_id = p_lesson_id;

  select id into v_published
  from public.learning_agent_script_versions
  where lesson_id = p_lesson_id and status = 'published'
  limit 1;

  insert into public.learning_agent_script_versions (
    lesson_id, version_number, status, title, created_by
  )
  select p_lesson_id, v_next_version, 'draft',
    coalesce((select title from public.learning_agent_script_versions where id = v_published), '{}'::jsonb),
    auth.uid()
  returning id into v_created;

  if v_published is not null then
    insert into public.learning_agent_script_nodes (
      script_version_id, node_key, node_type, sort_order, title, teacher_script,
      configuration, reference_activity_id, action_type, next_node_key,
      remediation_node_key, is_required
    )
    select v_created, node_key, node_type, sort_order, title, teacher_script,
      configuration, reference_activity_id, action_type, next_node_key,
      remediation_node_key, is_required
    from public.learning_agent_script_nodes
    where script_version_id = v_published
    order by sort_order;
  end if;

  insert into public.learning_agent_publish_logs (
    lesson_id, script_version_id, action, actor_id, details
  ) values (
    p_lesson_id, v_created, 'create_draft', auth.uid(),
    jsonb_build_object('sourceVersionId', v_published)
  );

  return v_created;
end;
$$;

create or replace function public.publish_learning_agent_script_version(
  p_script_version_id uuid,
  p_change_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_version public.learning_agent_script_versions%rowtype;
  v_node_count integer;
  v_missing_link text;
begin
  if auth.uid() is null or not private.is_platform_owner() then
    raise exception '只有平台负责人可以发布教学脚本';
  end if;

  select * into v_version
  from public.learning_agent_script_versions
  where id = p_script_version_id
  for update;
  if not found then raise exception '没有找到要发布的教学脚本'; end if;
  if v_version.status <> 'draft' then raise exception '只有草稿版本可以发布'; end if;

  select count(*) into v_node_count
  from public.learning_agent_script_nodes
  where script_version_id = p_script_version_id;
  if v_node_count = 0 then raise exception '教学脚本至少需要一个节点'; end if;

  if exists (
    select 1 from public.learning_agent_script_nodes node
    where node.script_version_id = p_script_version_id
      and nullif(trim(node.teacher_script->>'zh-CN'), '') is null
  ) then
    raise exception '每个教学节点都必须填写中文老师台词';
  end if;

  select coalesce(node.next_node_key, node.remediation_node_key) into v_missing_link
  from public.learning_agent_script_nodes node
  where node.script_version_id = p_script_version_id
    and (
      (node.next_node_key is not null and not exists (
        select 1 from public.learning_agent_script_nodes target
        where target.script_version_id = p_script_version_id and target.node_key = node.next_node_key
      ))
      or
      (node.remediation_node_key is not null and not exists (
        select 1 from public.learning_agent_script_nodes target
        where target.script_version_id = p_script_version_id and target.node_key = node.remediation_node_key
      ))
    )
  limit 1;
  if v_missing_link is not null then raise exception '教学节点存在无效的后续节点'; end if;

  update public.learning_agent_script_versions
  set status = 'archived'
  where lesson_id = v_version.lesson_id and status = 'published';

  update public.learning_agent_script_versions
  set status = 'published',
      change_note = left(trim(coalesce(p_change_note, '')), 500),
      published_by = auth.uid(),
      published_at = now()
  where id = p_script_version_id;

  update public.learning_agent_lessons
  set revision = v_version.version_number,
      status = 'published'
  where id = v_version.lesson_id;

  insert into public.learning_agent_publish_logs (
    lesson_id, script_version_id, action, actor_id, details
  ) values (
    v_version.lesson_id, p_script_version_id, 'publish', auth.uid(),
    jsonb_build_object('changeNote', left(trim(coalesce(p_change_note, '')), 500), 'nodeCount', v_node_count)
  );

  return jsonb_build_object(
    'scriptVersionId', p_script_version_id,
    'versionNumber', v_version.version_number,
    'nodeCount', v_node_count
  );
end;
$$;

revoke all on function public.create_learning_agent_script_draft(uuid) from public, anon;
revoke all on function public.publish_learning_agent_script_version(uuid, text) from public, anon;
grant execute on function public.create_learning_agent_script_draft(uuid) to authenticated;
grant execute on function public.publish_learning_agent_script_version(uuid, text) to authenticated;

create or replace function public.move_learning_agent_script_node(
  p_node_id uuid,
  p_direction text
)
returns boolean
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_node public.learning_agent_script_nodes%rowtype;
  v_neighbor public.learning_agent_script_nodes%rowtype;
begin
  if auth.uid() is null or not private.is_platform_owner() then
    raise exception '只有平台负责人可以调整教学节点';
  end if;
  if p_direction not in ('up', 'down') then raise exception '节点移动方向不正确'; end if;

  select node.* into v_node
  from public.learning_agent_script_nodes node
  join public.learning_agent_script_versions version on version.id = node.script_version_id
  where node.id = p_node_id and version.status = 'draft'
  for update of node;
  if not found then raise exception '只有草稿节点可以调整顺序'; end if;

  if p_direction = 'up' then
    select * into v_neighbor
    from public.learning_agent_script_nodes
    where script_version_id = v_node.script_version_id and sort_order < v_node.sort_order
    order by sort_order desc limit 1 for update;
  else
    select * into v_neighbor
    from public.learning_agent_script_nodes
    where script_version_id = v_node.script_version_id and sort_order > v_node.sort_order
    order by sort_order asc limit 1 for update;
  end if;

  if v_neighbor.id is null then return false; end if;
  set constraints learning_agent_script_nodes_version_order_key deferred;
  update public.learning_agent_script_nodes set sort_order = v_neighbor.sort_order where id = v_node.id;
  update public.learning_agent_script_nodes set sort_order = v_node.sort_order where id = v_neighbor.id;

  insert into public.learning_agent_publish_logs (
    lesson_id, script_version_id, action, actor_id, details
  )
  select version.lesson_id, v_node.script_version_id, 'reorder_node', auth.uid(),
    jsonb_build_object('nodeId', v_node.id, 'direction', p_direction)
  from public.learning_agent_script_versions version
  where version.id = v_node.script_version_id;

  return true;
end;
$$;

revoke all on function public.move_learning_agent_script_node(uuid, text) from public, anon;
grant execute on function public.move_learning_agent_script_node(uuid, text) to authenticated;

do $$
declare
  v_lesson_id uuid;
  v_script_version_id uuid;
  v_orientation_activity_id uuid;
begin
  select lesson.id into v_lesson_id
  from public.learning_agent_lessons lesson
  join public.learning_agent_profiles profile on profile.id = lesson.agent_profile_id
  join public.digital_textbook_modules module on module.id = lesson.module_id
  join public.digital_textbook_chapters chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions version on version.id = chapter.version_id
  join public.digital_textbooks textbook on textbook.id = version.textbook_id
  where profile.agent_code = 'uply-korean-teacher'
    and textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and module.module_code = 'orientation'
  limit 1;

  if v_lesson_id is null then return; end if;

  select id into v_script_version_id
  from public.learning_agent_script_versions
  where lesson_id = v_lesson_id and status = 'published'
  limit 1;

  if v_script_version_id is null then
    insert into public.learning_agent_script_versions (
      lesson_id, version_number, status, title, change_note, published_at
    ) values (
      v_lesson_id, 1, 'published',
      '{"zh-CN":"第一章课前导航教学脚本","ko-KR":"1과 학습 안내 수업 대본"}'::jsonb,
      '建立第一章课前导航的节点式教学流程', now()
    ) returning id into v_script_version_id;
  end if;

  select activity.id into v_orientation_activity_id
  from public.digital_textbook_activities activity
  join public.digital_textbook_nodes node on node.id = activity.node_id
  join public.digital_textbook_modules module on module.id = node.module_id
  where module.id = (select module_id from public.learning_agent_lessons where id = v_lesson_id)
    and activity.activity_key = 'orientation-check'
  limit 1;

  insert into public.learning_agent_script_nodes (
    script_version_id, node_key, node_type, sort_order, title, teacher_script,
    configuration, reference_activity_id, action_type, next_node_key, remediation_node_key
  ) values
  (
    v_script_version_id, 'welcome', 'opening', 1,
    '{"zh-CN":"开始上课","ko-KR":"수업 시작"}',
    '{"zh-CN":"你好，我是 UPLY 韩语老师。今天我们学习第一次见面时怎样自然地用韩语开口。学完这一小节，你会知道先说什么、怎样介绍自己，以及怎样礼貌结束对话。","ko-KR":"안녕하세요. UPLY 한국어 선생님입니다. 오늘은 처음 만났을 때 자연스럽게 대화를 시작하는 방법을 배워요."}',
    '{"hint":{"zh-CN":"先记住今天的顺序：问候、介绍、确认、结束。"}}',
    null, 'none', 'observe-scene', null
  ),
  (
    v_script_version_id, 'observe-scene', 'instruction', 2,
    '{"zh-CN":"观察情景","ko-KR":"장면 관찰"}',
    '{"zh-CN":"先看右侧图片。王明和智敏在校园国际交流中心第一次见面。第一次见面不能直接进入复杂话题，通常要先用一句礼貌的问候建立交流。","ko-KR":"오른쪽 그림을 먼저 보세요. 왕밍과 지민은 교내 국제교류센터에서 처음 만났습니다. 먼저 공손하게 인사하며 대화를 시작합니다."}',
    '{"hint":{"zh-CN":"注意两个人物的关系：他们是第一次见面。"}}',
    null, 'none', 'explain-order', null
  ),
  (
    v_script_version_id, 'explain-order', 'explanation', 3,
    '{"zh-CN":"交流顺序","ko-KR":"대화 순서"}',
    '{"zh-CN":"这次见面的交流顺序很清楚：先说 안녕하세요? 进行问候，再用 저는 …이에요/예요 介绍姓名或身份，接着确认对方信息，最后说 만나서 반가워요 表达见面的礼貌。","ko-KR":"대화 순서는 인사, 자기소개, 상대 정보 확인, 마무리 인사입니다."}',
    '{"example":{"zh-CN":"例如：안녕하세요? 저는 왕밍이에요. 만나서 반가워요."},"hint":{"zh-CN":"把它记成四步：问候 → 自我介绍 → 确认身份 → 礼貌结束。"}}',
    null, 'none', 'model-dialogue', null
  ),
  (
    v_script_version_id, 'model-dialogue', 'example', 4,
    '{"zh-CN":"听懂示范","ko-KR":"대화 예시"}',
    '{"zh-CN":"看一组最短示范。王明先说“안녕하세요?”，智敏回答“네, 안녕하세요?”。这里的 네 表示对问候作出自然回应，不需要逐字翻译成一句完整中文。","ko-KR":"왕밍이 먼저 “안녕하세요?”라고 말하고 지민이 “네, 안녕하세요?”라고 대답합니다."}',
    '{"example":{"zh-CN":"王明：안녕하세요?\n智敏：네, 안녕하세요?"},"hint":{"zh-CN":"先听谁主动开口，再听对方怎样回应。"}}',
    null, 'none', 'check-understanding', null
  ),
  (
    v_script_version_id, 'check-understanding', 'question', 5,
    '{"zh-CN":"理解检查","ko-KR":"이해 확인"}',
    '{"zh-CN":"现在检查一下：王明和智敏第一次见面时，最先说了哪一句？","ko-KR":"왕밍과 지민이 처음 만났을 때 가장 먼저 한 말은 무엇인가요?"}',
    '{"hint":{"zh-CN":"回想刚才示范对话的第一句。"}}',
    v_orientation_activity_id, 'none', 'lesson-mission', 'model-dialogue'
  ),
  (
    v_script_version_id, 'lesson-mission', 'explanation', 6,
    '{"zh-CN":"本课任务","ko-KR":"이번 과제"}',
    '{"zh-CN":"很好。还要注意，本课最后不是完成一段单人自我介绍，而是让两个角色交替完成至少八轮对话。所以从现在开始，要把每个表达看成一次真实交流中的一句话。","ko-KR":"이번 단원의 마지막 과제는 혼자 자기소개하는 것이 아니라 두 역할이 여덟 턴 이상 번갈아 대화하는 것입니다."}',
    '{"hint":{"zh-CN":"课末目标是双向对话，不是一个人连续说完。"}}',
    null, 'none', 'ready-for-practice', null
  ),
  (
    v_script_version_id, 'ready-for-practice', 'summary', 7,
    '{"zh-CN":"开始练习","ko-KR":"연습 시작"}',
    '{"zh-CN":"现在你已经知道初次见面的基本顺序：先问候，再介绍和确认信息，最后礼貌结束。接下来请完成右侧的情景诊断，我会根据你的真实作答继续帮助你。","ko-KR":"이제 첫 만남의 기본 순서를 알았습니다. 오른쪽의 상황 진단을 완성해 보세요."}',
    '{"terminal":true,"continueLabel":{"zh-CN":"开始情景诊断","ko-KR":"상황 진단 시작"}}',
    v_orientation_activity_id, 'focus_activity', null, null
  )
  on conflict (script_version_id, node_key) do nothing;
end;
$$;

commit;
