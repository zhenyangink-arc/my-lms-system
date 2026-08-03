begin;

create table if not exists public.digital_textbooks (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null unique references public.lessons(id) on delete restrict,
  slug text not null unique,
  level_code text not null,
  title jsonb not null check (jsonb_typeof(title) = 'object'),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.digital_textbook_versions (
  id uuid primary key default gen_random_uuid(),
  textbook_id uuid not null references public.digital_textbooks(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  release_notes text not null default '',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (textbook_id, version_number)
);

create table if not exists public.digital_textbook_chapters (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.digital_textbook_versions(id) on delete cascade,
  chapter_test_id uuid references public.chapter_tests(id) on delete set null,
  slug text not null,
  chapter_number integer not null check (chapter_number > 0),
  title jsonb not null check (jsonb_typeof(title) = 'object'),
  scenario jsonb not null default '{}'::jsonb check (jsonb_typeof(scenario) = 'object'),
  goal jsonb not null default '{}'::jsonb check (jsonb_typeof(goal) = 'object'),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (version_id, slug),
  unique (version_id, chapter_number)
);

create table if not exists public.digital_textbook_modules (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.digital_textbook_chapters(id) on delete cascade,
  module_code text not null check (module_code in (
    'orientation', 'vocabulary', 'grammar', 'patterns',
    'dialogue', 'listen_speak', 'read_write', 'review'
  )),
  sort_order integer not null check (sort_order between 1 and 8),
  accent_role text not null check (accent_role in ('jade', 'iris', 'coral', 'sky')),
  title jsonb not null check (jsonb_typeof(title) = 'object'),
  description jsonb not null default '{}'::jsonb check (jsonb_typeof(description) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chapter_id, module_code),
  unique (chapter_id, sort_order)
);

create table if not exists public.digital_textbook_nodes (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.digital_textbook_modules(id) on delete cascade,
  node_code text not null,
  node_type text not null check (node_type in ('learn', 'practice', 'mission', 'review')),
  sort_order integer not null check (sort_order > 0),
  estimated_minutes integer not null default 5 check (estimated_minutes between 1 and 90),
  title jsonb not null check (jsonb_typeof(title) = 'object'),
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, node_code),
  unique (module_id, sort_order)
);

create table if not exists public.digital_textbook_activities (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.digital_textbook_nodes(id) on delete cascade,
  activity_key text not null,
  activity_type text not null check (activity_type in (
    'single_choice', 'multiple_choice', 'fill_blank', 'ordering',
    'listening', 'speaking', 'writing', 'self_check'
  )),
  sort_order integer not null check (sort_order > 0),
  prompt jsonb not null check (jsonb_typeof(prompt) = 'object'),
  instruction jsonb not null default '{}'::jsonb check (jsonb_typeof(instruction) = 'object'),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  public_config jsonb not null default '{}'::jsonb check (jsonb_typeof(public_config) = 'object'),
  max_attempts integer not null default 3 check (max_attempts between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (node_id, activity_key),
  unique (node_id, sort_order)
);

-- This table is deliberately separated from browser-readable content.
create table if not exists public.digital_textbook_activity_secrets (
  activity_id uuid primary key references public.digital_textbook_activities(id) on delete cascade,
  answer_key jsonb not null default '{}'::jsonb check (jsonb_typeof(answer_key) = 'object'),
  explanation jsonb not null default '{}'::jsonb check (jsonb_typeof(explanation) = 'object'),
  transcript_ko text,
  audio_object_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.digital_textbook_preferences (
  tenant_id uuid not null default private.current_tenant_id() references public.tenants(id) on delete cascade,
  student_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  textbook_id uuid not null references public.digital_textbooks(id) on delete cascade,
  interface_locale text not null default 'zh-CN' check (interface_locale in ('zh-CN', 'ko-KR')),
  support_mode text not null default 'bilingual' check (support_mode in ('chinese', 'bilingual', 'immersion')),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, student_id, textbook_id)
);

create table if not exists public.digital_textbook_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id() references public.tenants(id) on delete cascade,
  student_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  activity_id uuid not null references public.digital_textbook_activities(id) on delete cascade,
  version_id uuid not null references public.digital_textbook_versions(id) on delete restrict,
  attempt_number integer not null check (attempt_number > 0),
  response jsonb not null default '{}'::jsonb,
  is_correct boolean,
  score numeric(5,2) check (score is null or score between 0 and 100),
  created_at timestamptz not null default now(),
  unique (tenant_id, student_id, activity_id, attempt_number)
);

create table if not exists public.digital_textbook_node_progress (
  tenant_id uuid not null default private.current_tenant_id() references public.tenants(id) on delete cascade,
  student_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  node_id uuid not null references public.digital_textbook_nodes(id) on delete cascade,
  version_id uuid not null references public.digital_textbook_versions(id) on delete restrict,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  completion_percent integer not null default 0 check (completion_percent between 0 and 100),
  mastery_score integer not null default 0 check (mastery_score between 0 and 100),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_activity_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, student_id, node_id, version_id)
);

create index if not exists digital_textbook_chapters_test_idx
  on public.digital_textbook_chapters(chapter_test_id);
create index if not exists digital_textbook_nodes_module_idx
  on public.digital_textbook_nodes(module_id, sort_order);
create index if not exists digital_textbook_activities_node_idx
  on public.digital_textbook_activities(node_id, sort_order);
create index if not exists digital_textbook_attempts_student_idx
  on public.digital_textbook_attempts(tenant_id, student_id, created_at desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'digital_textbooks', 'digital_textbook_versions', 'digital_textbook_chapters',
    'digital_textbook_modules', 'digital_textbook_nodes', 'digital_textbook_activities',
    'digital_textbook_activity_secrets', 'digital_textbook_preferences',
    'digital_textbook_node_progress'
  ] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function private.set_updated_at()',
      table_name,
      table_name
    );
  end loop;
end $$;

alter table public.digital_textbooks enable row level security;
alter table public.digital_textbook_versions enable row level security;
alter table public.digital_textbook_chapters enable row level security;
alter table public.digital_textbook_modules enable row level security;
alter table public.digital_textbook_nodes enable row level security;
alter table public.digital_textbook_activities enable row level security;
alter table public.digital_textbook_activity_secrets enable row level security;
alter table public.digital_textbook_preferences enable row level security;
alter table public.digital_textbook_attempts enable row level security;
alter table public.digital_textbook_node_progress enable row level security;

create policy "authenticated read textbook catalog"
on public.digital_textbooks for select to authenticated
using (status = 'published' or public.current_user_can_manage_standard_question_bank());
create policy "authenticated read textbook versions"
on public.digital_textbook_versions for select to authenticated
using (status = 'published' or public.current_user_can_manage_standard_question_bank());
create policy "authenticated read textbook chapters"
on public.digital_textbook_chapters for select to authenticated
using (status = 'published' or public.current_user_can_manage_standard_question_bank());
create policy "authenticated read textbook modules"
on public.digital_textbook_modules for select to authenticated using (true);
create policy "authenticated read textbook nodes"
on public.digital_textbook_nodes for select to authenticated using (true);
create policy "authenticated read textbook activities"
on public.digital_textbook_activities for select to authenticated using (true);

create policy "students manage own textbook preferences"
on public.digital_textbook_preferences for all to authenticated
using (student_id = auth.uid() and private.is_tenant_member(tenant_id))
with check (student_id = auth.uid() and tenant_id = private.current_tenant_id());
create policy "students read own textbook attempts"
on public.digital_textbook_attempts for select to authenticated
using (student_id = auth.uid() and private.is_tenant_member(tenant_id));
create policy "students create own textbook attempts"
on public.digital_textbook_attempts for insert to authenticated
with check (student_id = auth.uid() and tenant_id = private.current_tenant_id());
create policy "students manage own textbook progress"
on public.digital_textbook_node_progress for all to authenticated
using (student_id = auth.uid() and private.is_tenant_member(tenant_id))
with check (student_id = auth.uid() and tenant_id = private.current_tenant_id());

revoke all on public.digital_textbook_activity_secrets from anon, authenticated;
grant select on public.digital_textbooks, public.digital_textbook_versions,
  public.digital_textbook_chapters, public.digital_textbook_modules,
  public.digital_textbook_nodes, public.digital_textbook_activities to authenticated;
grant select, insert, update on public.digital_textbook_preferences to authenticated;
grant select, insert on public.digital_textbook_attempts to authenticated;
grant select, insert, update on public.digital_textbook_node_progress to authenticated;
grant all on all tables in schema public to service_role;

do $$
declare
  lesson_uuid uuid;
  test_uuid uuid;
  textbook_uuid uuid;
  version_uuid uuid;
  chapter_uuid uuid;
  module_uuid uuid;
  node_uuid uuid;
  activity_uuid uuid;
begin
  select lesson.id into lesson_uuid
  from public.lessons as lesson
  join public.courses as course on course.id = lesson.course_id
  where lesson.slug = 'basic-pronunciation'
    and course.slug = 'korean-beginner'
  order by lesson.created_at
  limit 1;

  if lesson_uuid is null then
    raise exception 'Cannot seed smart textbook: korean-beginner/basic-pronunciation lesson was not found';
  end if;

  select id into test_uuid from public.chapter_tests where slug = 'korean-level-one-01' limit 1;

  insert into public.digital_textbooks (lesson_id, slug, level_code, title, status)
  values (
    lesson_uuid,
    'korean-level-one-smart',
    'A1-1',
    jsonb_build_object('zh-CN', '韩国语 1 级', 'ko-KR', '한국어 1급'),
    'published'
  )
  on conflict (lesson_id) do update set
    slug = excluded.slug,
    level_code = excluded.level_code,
    title = excluded.title,
    status = excluded.status,
    updated_at = now()
  returning id into textbook_uuid;

  insert into public.digital_textbook_versions (textbook_id, version_number, status, release_notes, published_at)
  values (textbook_uuid, 1, 'published', '第一章智能交互数字教材试水版', now())
  on conflict (textbook_id, version_number) do update set
    status = excluded.status,
    release_notes = excluded.release_notes,
    published_at = coalesce(public.digital_textbook_versions.published_at, excluded.published_at),
    updated_at = now()
  returning id into version_uuid;

  insert into public.digital_textbook_chapters (
    version_id, chapter_test_id, slug, chapter_number, title, scenario, goal, status
  ) values (
    version_uuid,
    test_uuid,
    'hello',
    1,
    jsonb_build_object('zh-CN', '你好？', 'ko-KR', '안녕하세요?'),
    jsonb_build_object(
      'zh-CN', '第一次在校园里见到同学，完成得体的问候与自我介绍。',
      'ko-KR', '캠퍼스에서 처음 만난 친구에게 인사하고 자신을 소개합니다.'
    ),
    jsonb_build_object(
      'zh-CN', '能使用 안녕하세요?、저는 …예요/이에요 和 만나서 반가워요 完成 30 秒初次见面对话。',
      'ko-KR', '안녕하세요?, 저는 …예요/이에요, 만나서 반가워요를 사용해 30초 첫 만남 대화를 할 수 있습니다.'
    ),
    'published'
  )
  on conflict (version_id, slug) do update set
    chapter_test_id = excluded.chapter_test_id,
    title = excluded.title,
    scenario = excluded.scenario,
    goal = excluded.goal,
    status = excluded.status,
    updated_at = now()
  returning id into chapter_uuid;

  -- 01 课前导航
  insert into public.digital_textbook_modules (chapter_id, module_code, sort_order, accent_role, title, description)
  values (chapter_uuid, 'orientation', 1, 'sky',
    jsonb_build_object('zh-CN','课前导航','ko-KR','학습 안내'),
    jsonb_build_object('zh-CN','先看场景与目标，再用 30 秒诊断找到最适合的起点。','ko-KR','상황과 목표를 확인하고 30초 진단으로 출발점을 찾습니다.'))
  on conflict (chapter_id, module_code) do update set title=excluded.title, description=excluded.description, accent_role=excluded.accent_role, updated_at=now()
  returning id into module_uuid;
  insert into public.digital_textbook_nodes (module_id,node_code,node_type,sort_order,estimated_minutes,title,content)
  values (module_uuid,'mission-map','mission',1,3,
    jsonb_build_object('zh-CN','今天要完成的真实任务','ko-KR','오늘의 실제 과제'),
    jsonb_build_object(
      'eyebrow',jsonb_build_object('zh-CN','CAMPUS · FIRST MEETING','ko-KR','캠퍼스 · 첫 만남'),
      'lead',jsonb_build_object('zh-CN','你刚加入语言交换社团，需要先问候，再介绍姓名与身份。','ko-KR','언어 교환 동아리에 처음 왔습니다. 먼저 인사하고 이름과 신분을 소개하세요.'),
      'targets',jsonb_build_array(
        jsonb_build_object('ko','안녕하세요?','zh','自然发起问候'),
        jsonb_build_object('ko','저는 왕밍이에요.','zh','介绍姓名'),
        jsonb_build_object('ko','저는 학생이에요.','zh','说明身份'),
        jsonb_build_object('ko','만나서 반가워요.','zh','礼貌结束')
      ),
      'coach',jsonb_build_object('zh-CN','先完整说出来，再追求发音完美。','ko-KR','먼저 끝까지 말하고, 그다음 발음을 다듬으세요.')
    ))
  on conflict (module_id,node_code) do update set title=excluded.title,content=excluded.content,updated_at=now()
  returning id into node_uuid;
  insert into public.digital_textbook_activities (node_id,activity_key,activity_type,sort_order,prompt,instruction,options,public_config)
  values (node_uuid,'orientation-check','single_choice',1,
    jsonb_build_object('zh-CN','처음 만난 사람에게 가장 알맞은 인사는 무엇입니까?','ko-KR','처음 만난 사람에게 가장 알맞은 인사는 무엇입니까?'),
    jsonb_build_object('zh-CN','选出最自然的第一句话。','ko-KR','가장 자연스러운 첫 문장을 고르세요.'),
    jsonb_build_array('안녕하세요?','잘 자요.','다녀오세요.','축하합니다.'),
    jsonb_build_object('keyboard','1-4'))
  on conflict (node_id,activity_key) do update set prompt=excluded.prompt,instruction=excluded.instruction,options=excluded.options,updated_at=now()
  returning id into activity_uuid;
  insert into public.digital_textbook_activity_secrets (activity_id,answer_key,explanation)
  values (activity_uuid,'{"kind":"index","value":0}'::jsonb,jsonb_build_object('zh-CN','初次见面从 안녕하세요? 开始最自然。','ko-KR','첫 만남에서는 안녕하세요?로 시작하는 것이 가장 자연스럽습니다.'))
  on conflict (activity_id) do update set answer_key=excluded.answer_key,explanation=excluded.explanation,updated_at=now();

  -- 02 核心词汇表
  insert into public.digital_textbook_modules (chapter_id,module_code,sort_order,accent_role,title,description)
  values (chapter_uuid,'vocabulary',2,'jade',jsonb_build_object('zh-CN','核心词汇表','ko-KR','핵심 어휘'),jsonb_build_object('zh-CN','只学完成本课交流所需的高频词。','ko-KR','이번 대화에 꼭 필요한 빈출 어휘를 익힙니다.'))
  on conflict (chapter_id,module_code) do update set title=excluded.title,description=excluded.description,accent_role=excluded.accent_role,updated_at=now()
  returning id into module_uuid;
  insert into public.digital_textbook_nodes (module_id,node_code,node_type,sort_order,estimated_minutes,title,content)
  values (module_uuid,'people-and-greetings','learn',1,7,jsonb_build_object('zh-CN','人物与问候','ko-KR','사람과 인사'),jsonb_build_object(
    'lead',jsonb_build_object('zh-CN','点击韩语词即可听读音；先认词，再把词放进句子。','ko-KR','한국어 단어를 눌러 발음을 듣고 문장 속에서 사용하세요.'),
    'vocabulary',jsonb_build_array(
      jsonb_build_object('ko','안녕하세요?','zh','您好 / 你好','pos','표현','collocation','안녕하세요? 저는 …'),
      jsonb_build_object('ko','저','zh','我（谦称）','pos','대명사','collocation','저는 …예요/이에요'),
      jsonb_build_object('ko','이름','zh','名字','pos','명사','collocation','이름이 뭐예요?'),
      jsonb_build_object('ko','학생','zh','学生','pos','명사','collocation','학생이에요'),
      jsonb_build_object('ko','선생님','zh','老师','pos','명사','collocation','선생님이에요'),
      jsonb_build_object('ko','만나다','zh','见面','pos','동사','collocation','만나서 반가워요'),
      jsonb_build_object('ko','반갑다','zh','高兴、荣幸','pos','형용사','collocation','반가워요'),
      jsonb_build_object('ko','네 / 아니요','zh','是 / 不是','pos','응답','collocation','네, 맞아요 / 아니요')
    )))
  on conflict (module_id,node_code) do update set title=excluded.title,content=excluded.content,updated_at=now()
  returning id into node_uuid;
  insert into public.digital_textbook_activities (
    node_id, activity_key, activity_type, sort_order,
    prompt, instruction, options, public_config
  )
  values (
    node_uuid,
    'vocabulary-check',
    'single_choice',
    1,
    jsonb_build_object(
      'zh-CN', '“저는 학생이에요.”에서 “저”는 누구를 가리킵니까?',
      'ko-KR', '“저는 학생이에요.”에서 “저”는 누구를 가리킵니까?'
    ),
    jsonb_build_object(
      'zh-CN', '根据句子选择。',
      'ko-KR', '문장을 보고 고르세요.'
    ),
    jsonb_build_array('말하는 사람', '듣는 사람', '선생님', '친구들'),
    '{}'::jsonb
  )
  on conflict (node_id, activity_key) do update set
    prompt = excluded.prompt,
    instruction = excluded.instruction,
    options = excluded.options,
    public_config = excluded.public_config,
    updated_at = now()
  returning id into activity_uuid;
  -- The vocabulary answer is inserted after the seed block with a stable activity lookup.

  -- 03 语法解说
  insert into public.digital_textbook_modules (chapter_id,module_code,sort_order,accent_role,title,description)
  values (chapter_uuid,'grammar',3,'iris',jsonb_build_object('zh-CN','语法解说','ko-KR','문법 이해'),jsonb_build_object('zh-CN','理解 은/는 与 예요/이에요 的选择条件。','ko-KR','은/는과 예요/이에요의 선택 조건을 이해합니다.'))
  on conflict (chapter_id,module_code) do update set title=excluded.title,description=excluded.description,accent_role=excluded.accent_role,updated_at=now()
  returning id into module_uuid;
  insert into public.digital_textbook_nodes (module_id,node_code,node_type,sort_order,estimated_minutes,title,content)
  values (module_uuid,'topic-and-copula','learn',1,9,jsonb_build_object('zh-CN','把“我”和身份连起来','ko-KR','나와 신분을 연결하기'),jsonb_build_object(
    'rules',jsonb_build_array(
      jsonb_build_object('form','받침 없음 + 는','example','저 + 는 → 저는','zh','元音结尾后用 는'),
      jsonb_build_object('form','받침 있음 + 은','example','학생 + 은 → 학생은','zh','收音结尾后用 은'),
      jsonb_build_object('form','받침 없음 + 예요','example','친구 + 예요 → 친구예요','zh','无收音名词后用 예요'),
      jsonb_build_object('form','받침 있음 + 이에요','example','학생 + 이에요 → 학생이에요','zh','有收音名词后用 이에요')
    ),
    'contrast',jsonb_build_array('저는 유나예요.','저는 학생이에요.','민수는 선생님이에요.'),
    'coach',jsonb_build_object('zh-CN','选择 예요/이에요 时只看前面名词最后一个音节有没有收音。','ko-KR','예요/이에요는 앞 명사의 마지막 음절에 받침이 있는지만 확인하세요.')
  ))
  on conflict (module_id,node_code) do update set title=excluded.title,content=excluded.content,updated_at=now()
  returning id into node_uuid;
  insert into public.digital_textbook_activities (node_id,activity_key,activity_type,sort_order,prompt,instruction,options)
  values (node_uuid,'grammar-fill','fill_blank',1,jsonb_build_object('zh-CN','빈칸에 알맞은 말을 쓰세요: 저는 학생____.','ko-KR','빈칸에 알맞은 말을 쓰세요: 저는 학생____.'),jsonb_build_object('zh-CN','只填写缺少的部分。','ko-KR','빠진 부분만 쓰세요.'),'[]'::jsonb)
  on conflict (node_id,activity_key) do update set prompt=excluded.prompt,instruction=excluded.instruction,options=excluded.options,updated_at=now()
  returning id into activity_uuid;
  insert into public.digital_textbook_activity_secrets (activity_id,answer_key,explanation)
  values (activity_uuid,'{"kind":"text","value":"이에요"}'::jsonb,jsonb_build_object('zh-CN','학생 的最后一个音节 생 有收音 ㄹ，所以使用 이에요。','ko-KR','학생의 마지막 음절 생에 받침 ㄹ이 있으므로 이에요를 씁니다.'))
  on conflict (activity_id) do update set answer_key=excluded.answer_key,explanation=excluded.explanation,updated_at=now();

  -- 04 句型操练
  insert into public.digital_textbook_modules (chapter_id,module_code,sort_order,accent_role,title,description)
  values (chapter_uuid,'patterns',4,'coral',jsonb_build_object('zh-CN','句型操练','ko-KR','문형 연습'),jsonb_build_object('zh-CN','从替换到重组，让句型可以快速调用。','ko-KR','대치와 배열로 문형을 빠르게 꺼내 쓰는 연습을 합니다.'))
  on conflict (chapter_id,module_code) do update set title=excluded.title,description=excluded.description,accent_role=excluded.accent_role,updated_at=now()
  returning id into module_uuid;
  insert into public.digital_textbook_nodes (module_id,node_code,node_type,sort_order,estimated_minutes,title,content)
  values (module_uuid,'introduce-yourself','practice',1,8,jsonb_build_object('zh-CN','四块拼出自我介绍','ko-KR','네 조각으로 자기소개 만들기'),jsonb_build_object(
    'pattern','저는 [이름]이에요/예요. 저는 [신분]이에요/예요.',
    'substitutions',jsonb_build_array('민지','왕밍','학생','선생님','회사원'),
    'coach',jsonb_build_object('zh-CN','先确定话题“저는”，再放姓名，最后补句尾。','ko-KR','먼저 저는을 놓고 이름을 넣은 뒤 문장 끝을 완성하세요.')
  ))
  on conflict (module_id,node_code) do update set title=excluded.title,content=excluded.content,updated_at=now()
  returning id into node_uuid;
  insert into public.digital_textbook_activities (node_id,activity_key,activity_type,sort_order,prompt,instruction,options)
  values (node_uuid,'pattern-order','ordering',1,jsonb_build_object('zh-CN','자연스러운 자기소개 문장을 만드세요.','ko-KR','자연스러운 자기소개 문장을 만드세요.'),jsonb_build_object('zh-CN','把四个片段排成一句话。','ko-KR','네 조각을 올바른 순서로 배열하세요.'),jsonb_build_array('저는','왕밍','이에요','.'))
  on conflict (node_id,activity_key) do update set prompt=excluded.prompt,instruction=excluded.instruction,options=excluded.options,updated_at=now()
  returning id into activity_uuid;
  insert into public.digital_textbook_activity_secrets (activity_id,answer_key,explanation)
  values (activity_uuid,'{"kind":"order","value":[0,1,2,3]}'::jsonb,jsonb_build_object('zh-CN','基本顺序是“话题 + 名字 + 句尾”。','ko-KR','기본 순서는 “화제 + 이름 + 문장 끝”입니다.'))
  on conflict (activity_id) do update set answer_key=excluded.answer_key,explanation=excluded.explanation,updated_at=now();

  -- 05 实战对话
  insert into public.digital_textbook_modules (chapter_id,module_code,sort_order,accent_role,title,description)
  values (chapter_uuid,'dialogue',5,'sky',jsonb_build_object('zh-CN','实战对话','ko-KR','실전 대화'),jsonb_build_object('zh-CN','在新的校园场景中组合问候、姓名和身份。','ko-KR','새로운 캠퍼스 상황에서 인사, 이름, 신분 표현을 연결합니다.'))
  on conflict (chapter_id,module_code) do update set title=excluded.title,description=excluded.description,accent_role=excluded.accent_role,updated_at=now()
  returning id into module_uuid;
  insert into public.digital_textbook_nodes (module_id,node_code,node_type,sort_order,estimated_minutes,title,content)
  values (module_uuid,'club-first-meeting','mission',1,8,jsonb_build_object('zh-CN','语言交换社团初见','ko-KR','언어 교환 동아리 첫 만남'),jsonb_build_object(
    'dialogue',jsonb_build_array(
      jsonb_build_object('speaker','유나','line','안녕하세요? 저는 유나예요.'),
      jsonb_build_object('speaker','왕밍','line','안녕하세요? 저는 왕밍이에요.'),
      jsonb_build_object('speaker','유나','line','학생이에요?'),
      jsonb_build_object('speaker','왕밍','line','네, 학생이에요. 만나서 반가워요.'),
      jsonb_build_object('speaker','유나','line','저도 반가워요!')
    ),
    'mission',jsonb_build_object('zh-CN','替换姓名和身份，与学习助手完成一轮对话。','ko-KR','이름과 신분을 바꾸어 학습 도우미와 한 번 대화하세요.')
  ))
  on conflict (module_id,node_code) do update set title=excluded.title,content=excluded.content,updated_at=now()
  returning id into node_uuid;
  insert into public.digital_textbook_activities (node_id,activity_key,activity_type,sort_order,prompt,instruction,options)
  values (node_uuid,'dialogue-response','single_choice',1,jsonb_build_object('zh-CN','“만나서 반가워요.”에 가장 자연스러운 대답은 무엇입니까?','ko-KR','“만나서 반가워요.”에 가장 자연스러운 대답은 무엇입니까?'),jsonb_build_object('zh-CN','选出对话中最自然的回应。','ko-KR','가장 자연스러운 응답을 고르세요.'),jsonb_build_array('저도 반가워요.','안녕히 가세요.','잘 먹겠습니다.','괜찮아요.'))
  on conflict (node_id,activity_key) do update set prompt=excluded.prompt,instruction=excluded.instruction,options=excluded.options,updated_at=now()
  returning id into activity_uuid;
  insert into public.digital_textbook_activity_secrets (activity_id,answer_key,explanation)
  values (activity_uuid,'{"kind":"index","value":0}'::jsonb,jsonb_build_object('zh-CN','저도 반가워요 表示“我也很高兴认识你”。','ko-KR','저도 반가워요는 상대방의 인사에 자연스럽게 화답하는 표현입니다.'))
  on conflict (activity_id) do update set answer_key=excluded.answer_key,explanation=excluded.explanation,updated_at=now();

  -- 06 听说任务（听力原文只进入 secrets）
  insert into public.digital_textbook_modules (chapter_id,module_code,sort_order,accent_role,title,description)
  values (chapter_uuid,'listen_speak',6,'jade',jsonb_build_object('zh-CN','听说任务','ko-KR','듣기·말하기'),jsonb_build_object('zh-CN','抓住姓名与身份，再完成 30 秒连续表达。','ko-KR','이름과 신분을 듣고 30초 연속 말하기를 완성합니다.'))
  on conflict (chapter_id,module_code) do update set title=excluded.title,description=excluded.description,accent_role=excluded.accent_role,updated_at=now()
  returning id into module_uuid;
  insert into public.digital_textbook_nodes (module_id,node_code,node_type,sort_order,estimated_minutes,title,content)
  values (module_uuid,'listen-and-respond','practice',1,10,jsonb_build_object('zh-CN','听关键信息，再开口','ko-KR','핵심 정보를 듣고 말하기'),jsonb_build_object(
    'listenFor',jsonb_build_array('이름','신분','마지막 인사'),
    'speakingFrame','안녕하세요? 저는 ___예요/이에요. 저는 ___예요/이에요. 만나서 반가워요.',
    'privacy',jsonb_build_object('zh-CN','听力原文不发送到学生浏览器；播放器只获取受保护音频。','ko-KR','듣기 대본은 학생 브라우저로 전송하지 않으며 보호된 오디오만 재생합니다.')
  ))
  on conflict (module_id,node_code) do update set title=excluded.title,content=excluded.content,updated_at=now()
  returning id into node_uuid;
  insert into public.digital_textbook_activities (node_id,activity_key,activity_type,sort_order,prompt,instruction,options,public_config)
  values (node_uuid,'listening-identity','listening',1,jsonb_build_object('zh-CN','들은 내용과 같은 것을 고르세요.','ko-KR','들은 내용과 같은 것을 고르세요.'),jsonb_build_object('zh-CN','播放音频，选择人物身份。','ko-KR','음성을 듣고 인물의 신분을 고르세요.'),jsonb_build_array('학생이에요.','선생님이에요.','회사원이에요.','의사예요.'),jsonb_build_object('audioStatus','pending-private-upload','replayLimit',2))
  on conflict (node_id,activity_key) do update set prompt=excluded.prompt,instruction=excluded.instruction,options=excluded.options,public_config=excluded.public_config,updated_at=now()
  returning id into activity_uuid;
  insert into public.digital_textbook_activity_secrets (activity_id,answer_key,explanation,transcript_ko,audio_object_key)
  values (activity_uuid,'{"kind":"index","value":0}'::jsonb,jsonb_build_object('zh-CN','人物明确说了“저는 학생이에요”。','ko-KR','인물이 “저는 학생이에요”라고 말했습니다.'),'안녕하세요? 저는 수진이에요. 저는 학생이에요. 만나서 반가워요.',null)
  on conflict (activity_id) do update set answer_key=excluded.answer_key,explanation=excluded.explanation,transcript_ko=excluded.transcript_ko,audio_object_key=excluded.audio_object_key,updated_at=now();
  insert into public.digital_textbook_activities (node_id,activity_key,activity_type,sort_order,prompt,instruction,options,public_config)
  values (node_uuid,'speaking-introduction','speaking',2,jsonb_build_object('zh-CN','30초 동안 자신을 소개해 보세요.','ko-KR','30초 동안 자신을 소개해 보세요.'),jsonb_build_object('zh-CN','录音并回听；至少包含问候、姓名、身份和结束语。','ko-KR','녹음하고 다시 들으세요. 인사, 이름, 신분, 마무리 인사를 포함하세요.'),'[]'::jsonb,jsonb_build_object('minimumSeconds',8,'selfCheck',jsonb_build_array('안녕하세요','저는','이에요','반가워요')))
  on conflict (node_id,activity_key) do update set prompt=excluded.prompt,instruction=excluded.instruction,public_config=excluded.public_config,updated_at=now()
  returning id into activity_uuid;
  insert into public.digital_textbook_activity_secrets (activity_id,answer_key,explanation)
  values (activity_uuid,'{"kind":"open"}'::jsonb,jsonb_build_object('zh-CN','先检查是否完成四个交际功能，再回听语速和停顿。','ko-KR','네 가지 의사소통 기능을 모두 수행했는지 확인하고 속도와 쉼을 다시 들어 보세요.'))
  on conflict (activity_id) do update set answer_key=excluded.answer_key,explanation=excluded.explanation,updated_at=now();

  -- 07 读写拓展
  insert into public.digital_textbook_modules (chapter_id,module_code,sort_order,accent_role,title,description)
  values (chapter_uuid,'read_write',7,'iris',jsonb_build_object('zh-CN','读写拓展','ko-KR','읽기·쓰기'),jsonb_build_object('zh-CN','从社团留言中提取信息，再写一段自己的介绍。','ko-KR','동아리 소개 글에서 정보를 찾고 자신의 소개 글을 씁니다.'))
  on conflict (chapter_id,module_code) do update set title=excluded.title,description=excluded.description,accent_role=excluded.accent_role,updated_at=now()
  returning id into module_uuid;
  insert into public.digital_textbook_nodes (module_id,node_code,node_type,sort_order,estimated_minutes,title,content)
  values (module_uuid,'profile-note','practice',1,10,jsonb_build_object('zh-CN','读一张新成员便条','ko-KR','새 회원 메모 읽기'),jsonb_build_object(
    'reading','안녕하세요? 저는 김하늘이에요. 한국 사람이에요. 저는 대학생이에요. 중국어를 공부해요. 만나서 반가워요!',
    'questions',jsonb_build_array('이름이 뭐예요?','어느 나라 사람이에요?','무엇을 공부해요?'),
    'writingFrame','안녕하세요? 저는 ___예요/이에요. ___ 사람이에요. 저는 ___예요/이에요. 만나서 반가워요.'
  ))
  on conflict (module_id,node_code) do update set title=excluded.title,content=excluded.content,updated_at=now()
  returning id into node_uuid;
  insert into public.digital_textbook_activities (node_id,activity_key,activity_type,sort_order,prompt,instruction,options,public_config)
  values (node_uuid,'write-profile','writing',1,jsonb_build_object('zh-CN','동아리 게시판에 자기소개를 쓰세요.','ko-KR','동아리 게시판에 자기소개를 쓰세요.'),jsonb_build_object('zh-CN','用 3—5 句介绍姓名、国籍或身份；正式作答内容使用韩语。','ko-KR','3~5문장으로 이름, 국적 또는 신분을 소개하세요.'),'[]'::jsonb,jsonb_build_object('minCharacters',35,'maxCharacters',160,'language','ko'))
  on conflict (node_id,activity_key) do update set prompt=excluded.prompt,instruction=excluded.instruction,public_config=excluded.public_config,updated_at=now()
  returning id into activity_uuid;
  insert into public.digital_textbook_activity_secrets (activity_id,answer_key,explanation)
  values (activity_uuid,'{"kind":"open"}'::jsonb,jsonb_build_object('zh-CN','检查句子是否包含问候、姓名、身份和结束语。','ko-KR','인사, 이름, 신분, 마무리 인사가 포함되었는지 확인하세요.'))
  on conflict (activity_id) do update set answer_key=excluded.answer_key,explanation=excluded.explanation,updated_at=now();

  -- 08 自测与复盘
  insert into public.digital_textbook_modules (chapter_id,module_code,sort_order,accent_role,title,description)
  values (chapter_uuid,'review',8,'coral',jsonb_build_object('zh-CN','自测与复盘','ko-KR','자기 점검'),jsonb_build_object('zh-CN','确认是否能独立完成初次见面的交流闭环。','ko-KR','첫 만남의 대화를 혼자 완성할 수 있는지 확인합니다.'))
  on conflict (chapter_id,module_code) do update set title=excluded.title,description=excluded.description,accent_role=excluded.accent_role,updated_at=now()
  returning id into module_uuid;
  insert into public.digital_textbook_nodes (module_id,node_code,node_type,sort_order,estimated_minutes,title,content)
  values (module_uuid,'can-do-check','review',1,6,jsonb_build_object('zh-CN','我会了吗？','ko-KR','이제 할 수 있나요?'),jsonb_build_object(
    'checklist',jsonb_build_array(
      jsonb_build_object('ko','먼저 인사할 수 있어요.','zh','我能主动问候'),
      jsonb_build_object('ko','이름과 신분을 소개할 수 있어요.','zh','我能介绍姓名与身份'),
      jsonb_build_object('ko','상대방의 이름과 신분을 들을 수 있어요.','zh','我能听出姓名和身份'),
      jsonb_build_object('ko','만나서 반갑다고 말할 수 있어요.','zh','我能礼貌结束对话')
    ),
    'next',jsonb_build_object('zh-CN','低于 3 项：回到语法或听说任务；完成 4 项：进入章节测试。','ko-KR','3개 미만이면 문법 또는 듣기·말하기로 돌아가고, 4개면 단원 평가로 이동하세요.')
  ))
  on conflict (module_id,node_code) do update set title=excluded.title,content=excluded.content,updated_at=now()
  returning id into node_uuid;
  insert into public.digital_textbook_activities (node_id,activity_key,activity_type,sort_order,prompt,instruction,options)
  values (node_uuid,'review-multiple','multiple_choice',1,jsonb_build_object('zh-CN','처음 만난 사람에게 할 수 있는 말을 모두 고르세요.','ko-KR','처음 만난 사람에게 할 수 있는 말을 모두 고르세요.'),jsonb_build_object('zh-CN','可以多选。','ko-KR','복수 선택이 가능합니다.'),jsonb_build_array('안녕하세요?','저는 민지예요.','만나서 반가워요.','잘 자요.'))
  on conflict (node_id,activity_key) do update set prompt=excluded.prompt,instruction=excluded.instruction,options=excluded.options,updated_at=now()
  returning id into activity_uuid;
  insert into public.digital_textbook_activity_secrets (activity_id,answer_key,explanation)
  values (activity_uuid,'{"kind":"indices","value":[0,1,2]}'::jsonb,jsonb_build_object('zh-CN','问候、自我介绍、表达见面高兴都适合初次见面；잘 자요 是睡前用语。','ko-KR','인사, 자기소개, 반가움 표현은 첫 만남에 알맞고 잘 자요는 잠자기 전 표현입니다.'))
  on conflict (activity_id) do update set answer_key=excluded.answer_key,explanation=excluded.explanation,updated_at=now();
end $$;

insert into public.digital_textbook_activity_secrets (activity_id,answer_key,explanation)
select
  activity.id,
  '{"kind":"index","value":0}'::jsonb,
  jsonb_build_object(
    'zh-CN', '저 是说话人对自己的谦称。',
    'ko-KR', '저는 말하는 사람이 자신을 낮추어 가리키는 말입니다.'
  )
from public.digital_textbook_activities as activity
where activity.activity_key = 'vocabulary-check'
on conflict (activity_id) do update set
  answer_key = excluded.answer_key,
  explanation = excluded.explanation,
  updated_at = now();

comment on table public.digital_textbooks is '智能交互数字教材顶层骨架，与真实课程课时一一对应。';
comment on table public.digital_textbook_chapters is '教材章节；通过 chapter_test_id 与章节测试题库建立明确关系。';
comment on table public.digital_textbook_modules is '固定八步教学模块，所有后续电子书复用该骨架。';
comment on table public.digital_textbook_nodes is '可排序、可追踪的最小学路径节点。';
comment on table public.digital_textbook_activities is '浏览器可读的活动题面与公开配置，不包含答案和听力原文。';
comment on table public.digital_textbook_activity_secrets is '仅后端可读的答案、解析、听力原文和私有音频对象键。';

commit;
