begin;

-- Generated from the accepted UPLY BOOK chapter-one master (read-only source).
-- source_sha256: 37977094fd834cb14a441ae319d0225ca81bab8b67e4c263ff52fca88e4e98e2
-- The converted chapter stays draft until editorial, native-language, audio and image review finish.

alter table public.digital_textbook_chapters
  add column if not exists production_status text,
  add column if not exists editorial_status text,
  add column if not exists native_review_status text,
  add column if not exists audio_status text,
  add column if not exists image_status text,
  add column if not exists source_revision text;

alter table public.digital_textbook_chapters
  drop constraint if exists digital_textbook_chapters_production_status_check;
alter table public.digital_textbook_chapters
  add constraint digital_textbook_chapters_production_status_check
  check (production_status in ('editorial_review', 'ready_for_publish', 'published'));

alter table public.digital_textbook_activity_secrets
  add column if not exists audio_status text not null default 'pending';
alter table public.digital_textbook_activity_secrets
  drop constraint if exists digital_textbook_activity_secrets_audio_status_check;
alter table public.digital_textbook_activity_secrets
  add constraint digital_textbook_activity_secrets_audio_status_check
  check (audio_status in ('pending', 'ready', 'rejected'));

-- A reserved object key is a binding target, not proof that a recording exists.
update public.digital_textbook_activity_secrets
set audio_status = 'pending', updated_at = now()
where audio_object_key is not null
  and audio_status is distinct from 'pending';

create table if not exists public.digital_textbook_media_assets (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.digital_textbook_nodes(id) on delete cascade,
  activity_id uuid references public.digital_textbook_activities(id) on delete cascade,
  asset_key text not null,
  media_type text not null check (media_type in ('image', 'audio')),
  purpose text not null,
  object_key text not null,
  production_status text not null default 'pending'
    check (production_status in ('pending', 'ready', 'rejected')),
  alt_text jsonb not null default '{}'::jsonb check (jsonb_typeof(alt_text) = 'object'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (node_id, asset_key)
);

create index if not exists digital_textbook_media_assets_node_idx
  on public.digital_textbook_media_assets(node_id, media_type, asset_key);

drop trigger if exists digital_textbook_media_assets_set_updated_at
  on public.digital_textbook_media_assets;
create trigger digital_textbook_media_assets_set_updated_at
before update on public.digital_textbook_media_assets
for each row execute function private.set_updated_at();

alter table public.digital_textbook_media_assets enable row level security;
revoke all on public.digital_textbook_media_assets from public, anon, authenticated;
grant all on public.digital_textbook_media_assets to service_role;

comment on table public.digital_textbook_media_assets is
  'Private media manifest. Reserved object keys and production state stay server-side; loaders expose only status and accessible descriptions.';

alter table public.course_ebook_progress
  add column if not exists completion_source text not null default 'ebook';
alter table public.course_ebook_progress
  drop constraint if exists course_ebook_progress_completion_source_check;
alter table public.course_ebook_progress
  add constraint course_ebook_progress_completion_source_check
  check (completion_source in ('ebook', 'smart_textbook', 'both'));

comment on column public.course_ebook_progress.completion_source is
  'Compatibility completion source. smart_textbook never fabricates ebook reading_seconds.';

-- Activity grading and derived node completion now run exclusively in the
-- authenticated Server Action. Do not let a browser manufacture successful
-- attempts or completed nodes through the REST API.
revoke insert on public.digital_textbook_attempts from authenticated;
revoke insert, update on public.digital_textbook_node_progress from authenticated;

do $seed$
declare
  textbook_uuid uuid;
  version_uuid uuid;
  chapter_uuid uuid;
  test_uuid uuid;
  module_uuid uuid;
  node_uuid uuid;
  activity_uuid uuid;
  module_seed jsonb;
  activity_seed jsonb;
  media_seed jsonb;
begin
  select textbook.id, version.id, chapter.id
  into textbook_uuid, version_uuid, chapter_uuid
  from public.digital_textbooks as textbook
  join public.digital_textbook_versions as version on version.textbook_id = textbook.id
  join public.digital_textbook_chapters as chapter on chapter.version_id = version.id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
  order by version.version_number desc
  limit 1;

  if chapter_uuid is null then
    raise exception 'Cannot convert chapter 01: smart textbook chapter was not found';
  end if;

  select id into test_uuid
  from public.chapter_tests
  where slug = 'korean-level-one-01'
  limit 1;

  -- The accepted environment already has this assessment. A migration-only
  -- local database did not, which left chapter_test_id null and made the
  -- completion bridge impossible to exercise. Seed only when it is absent.
  if test_uuid is null then
    insert into public.chapter_tests (
      id, lesson_id, slug, course_key, chapter_number, title, korean_title,
      description, duration_minutes, passing_score, skills, version, status,
      student_app_id
    )
    select
      'a3300000-0000-4000-8000-000000000001'::uuid,
      lesson.id,
      'korean-level-one-01',
      'korean-level-one',
      1,
      '第 01 章测试：你好？',
      '제01과 평가: 안녕하세요?',
      '检查问候、姓名与身份表达，以及初次见面对话的理解。',
      12,
      60,
      '{"recognition":"词汇识别","structure":"语法形态","reading":"对话理解","assembly":"表达组织"}'::jsonb,
      1,
      'draft',
      '10000000-0000-4000-8000-000000000001'::uuid
    from public.lessons as lesson
    join public.courses as course on course.id = lesson.course_id
    where course.slug = 'korean-beginner'
      and lesson.slug = 'basic-pronunciation'
    limit 1
    returning id into test_uuid;
  end if;

  if test_uuid is null then
    raise exception 'Cannot convert chapter 01: korean-level-one-01 test was not found and could not be seeded';
  end if;

  if not exists (
    select 1 from public.chapter_test_questions where test_id = test_uuid
  ) then
    insert into public.chapter_test_questions (
      test_id, question_key, prompt, options, correct_option, explanation,
      skill, sort_order, question_type, default_points, difficulty, tags,
      status, version, is_chapter_test_item, ebook_section_step,
      ebook_page_reference
    )
    values
      (test_uuid, 'golden-01-01', '第一次见面时，哪一句是合适的问候？', '["안녕하세요?","안녕히 가세요.","감사합니다.","괜찮아요."]', 0, '안녕하세요? 用于礼貌地向见面对象问候。', 'recognition', 1, 'single_choice', 10, 'foundation', '["问候","母本§4"]', 'published', 1, true, 'STEP 02', '母本 §4'),
      (test_uuid, 'golden-01-02', '韩语“저”在本课中的意思是什么？', '["我（谦称）","老师","朋友","名字"]', 0, '저 是说话人礼貌、谦逊的自称。', 'recognition', 2, 'single_choice', 10, 'foundation', '["词汇","母本§4"]', 'published', 1, true, 'STEP 02', '母本 §4'),
      (test_uuid, 'golden-01-03', '“저는 학생___.”应填入哪一项？', '["예요","이에요","은","는"]', 1, '학생有收音，名词后接 이에요。', 'structure', 3, 'single_choice', 10, 'foundation', '["语法","母本§5.1"]', 'published', 1, true, 'STEP 03', '母本 §5.1'),
      (test_uuid, 'golden-01-04', '“저는 리나___.”的正确形态是哪一项？', '["이에요","은","예요","는"]', 2, '리나没有收音，名词后接 예요。', 'structure', 4, 'single_choice', 10, 'foundation', '["语法","母本§5.1"]', 'published', 1, true, 'STEP 03', '母本 §5.1'),
      (test_uuid, 'golden-01-05', '要把“지민 씨”设为话题，应写成哪一项？', '["지민 씨은","지민 씨는","지민 씨예요는","지민 씨이에요"]', 1, '씨没有收音，话题助词使用 는。', 'structure', 5, 'single_choice', 10, 'foundation', '["语法","母本§5.2"]', 'published', 1, true, 'STEP 03', '母本 §5.2'),
      (test_uuid, 'golden-01-06', '哪一句能礼貌确认对方是不是学生？', '["학생은 지민 씨.","지민 씨는 학생이에요?","지민 씨 학생 까?","학생이 지민 씨는."]', 1, '身份确认问句保持 이에요/예요 形态，并在口语中使用疑问语调。', 'structure', 6, 'single_choice', 10, 'medium', '["确认问句","母本§5.3"]', 'published', 1, true, 'STEP 03', '母本 §5.3'),
      (test_uuid, 'golden-01-07', '听到“지민 씨는 학생이에요?”时，哪一回答最完整？', '["네, 학생이에요.","학생?","저는?","안녕하세요."]', 0, '네 后补全身份信息，回答更清楚自然。', 'assembly', 7, 'single_choice', 10, 'medium', '["应答","母本§6"]', 'published', 1, true, 'STEP 04', '母本 §6'),
      (test_uuid, 'golden-01-08', '“만나서 반가워요.”最适合出现在初次见面对话的什么位置？', '["确认地点时","自然收尾时","询问价格时","说明时间时"]', 1, '该表达用于初次见面后的礼貌回应和自然收尾。', 'reading', 8, 'single_choice', 10, 'foundation', '["对话","母本§7"]', 'published', 1, true, 'STEP 05', '母本 §7'),
      (test_uuid, 'golden-01-09', '哪一组最符合本课初次见面对话的顺序？', '["告别→问候→身份→姓名","身份→告别→问候→姓名","问候→姓名→身份确认→礼貌收尾","姓名→购物→问候→告别"]', 2, '母本主对话按问候、交换姓名、确认身份、礼貌收尾展开。', 'assembly', 9, 'single_choice', 10, 'medium', '["对话结构","母本§7"]', 'published', 1, true, 'STEP 05', '母本 §7'),
      (test_uuid, 'golden-01-10', '资料卡写着“이름: 왕밍 / 신분: 학생”，哪一句正确？', '["왕밍 씨는 선생님이에요.","왕밍 씨는 학생이에요.","왕밍 씨는 친구예요? 아니요.","왕밍 씨는 이름이에요."]', 1, '资料卡表明王明的身份是学生。', 'reading', 10, 'single_choice', 10, 'foundation', '["阅读","母本§9"]', 'published', 1, true, 'STEP 07', '母本 §9'),
      (test_uuid, 'golden-01-11', '哪一句同时包含话题和身份说明？', '["학생이에요?","저는 왕밍이에요.","이름이 뭐예요?","만나서 반가워요."]', 1, '저는 设置话题，왕밍이에요 说明姓名身份信息。', 'structure', 11, 'single_choice', 10, 'medium', '["综合语法","母本§5"]', 'published', 1, true, 'STEP 08', '母本 §5'),
      (test_uuid, 'golden-01-12', '课末双角色任务必须满足哪一项？', '["只说一句问候","单人背诵词汇","只写姓名资料卡","约30秒并至少8轮，包含问候、姓名、身份确认和收尾"]', 3, '母本要求完成约30秒、至少8轮的双角色初次见面对话。', 'assembly', 12, 'single_choice', 10, 'medium', '["任务合同","母本§10"]', 'published', 1, true, 'STEP 08', '母本 §10');
  end if;

  update public.chapter_test_questions
  set status = 'draft', updated_at = now()
  where test_id = test_uuid
    and question_key like 'golden-01-%';

  update public.digital_textbook_chapters
  set
    chapter_test_id = test_uuid,
    title = '{"zh-CN":"你好？","ko-KR":"안녕하세요?"}'::jsonb,
    scenario = '{"zh-CN":"王明第一次参加校园语言交换活动，在国际交流中心遇见同龄学生智敏。两人互相问候、介绍姓名与身份、确认对方身份并自然结束对话。","ko-KR":"왕밍은 캠퍼스 언어 교환 모임에 처음 참가합니다. 국제교류센터에서 또래 학생 지민을 만나 서로 인사하고 이름과 신분을 소개한 뒤 상대의 신분을 확인하고 자연스럽게 대화를 마칩니다."}'::jsonb,
    goal = '{"zh-CN":"使用问候、姓名、身份和确认表达，完成约 30 秒、至少 8 轮的双角色初次见面对话。","ko-KR":"인사, 이름, 신분, 확인 표현을 사용하여 약 30초 동안 8턴 이상의 두 역할 첫 만남 대화를 완성합니다."}'::jsonb,
    status = 'draft',
    production_status = 'editorial_review',
    editorial_status = 'pending',
    native_review_status = 'pending',
    audio_status = 'pending',
    image_status = 'pending',
    source_revision = 'UPLY BOOK 第01课 안녕하세요.md @ 2026-08-18 / sha256:37977094fd834cb14a441ae319d0225ca81bab8b67e4c263ff52fca88e4e98e2',
    updated_at = now()
  where id = chapter_uuid;

  for module_seed in
    select value from jsonb_array_elements($json$
    [
      {
        "code":"orientation","order":1,"accent":"sky","type":"mission","minutes":5,"nodeCode":"mission-map",
        "title":{"zh-CN":"课前导航","ko-KR":"학습 안내"},
        "description":{"zh-CN":"先看清人物、地点和课末任务，再开始学习。","ko-KR":"인물, 장소와 단원 과제를 먼저 확인하고 학습을 시작합니다."},
        "nodeTitle":{"zh-CN":"第一次见面，怎样开口？","ko-KR":"첫 만남에서 어떻게 말을 시작할까요?"},
        "content":{
          "lead":{"zh-CN":"王明在校园国际交流中心第一次见到智敏，需要先问候，再交换双方姓名与学生身份。","ko-KR":"왕밍은 국제교류센터에서 지민을 처음 만나 인사하고 서로의 이름과 학생 신분을 확인합니다."},
          "targets":[{"ko":"안녕하세요?","zh":"主动问候"},{"ko":"저는 왕밍이에요.","zh":"介绍姓名"},{"ko":"지민 씨는 학생이에요?","zh":"确认身份"},{"ko":"만나서 반가워요.","zh":"礼貌结束"}],
          "coach":{"zh-CN":"课末输出是两个角色交替至少 8 轮的对话，不以单人自我介绍代替。","ko-KR":"단원 마지막에는 한 사람의 독백이 아니라 두 역할이 8턴 이상 번갈아 말해야 합니다."},
          "completion":{"zh-CN":"答对不计分诊断后完成本节点。","ko-KR":"점수에 포함되지 않는 진단 문항을 맞히면 완료됩니다."},
          "nextNode":"people-and-greetings"
        }
      },
      {
        "code":"vocabulary","order":2,"accent":"jade","type":"learn","minutes":9,"nodeCode":"people-and-greetings",
        "title":{"zh-CN":"核心词汇","ko-KR":"핵심 어휘"},
        "description":{"zh-CN":"认出姓名、人物身份、见面与问候所需的 12 个核心词。","ko-KR":"이름, 신분, 만남과 인사에 필요한 핵심 어휘 12개를 익힙니다."},
        "nodeTitle":{"zh-CN":"先听懂“谁”和“做什么”","ko-KR":"누구인지, 무엇을 하는지 먼저 이해하기"},
        "content":{
          "lead":{"zh-CN":"按“看场景猜词—点读母稿跟读—用搭配说短句—回到对话再认”的顺序学习；正式点读音频均待制作。","ko-KR":"상황으로 뜻을 짐작하고, 음원을 따라 읽고, 결합 표현으로 말한 뒤 대화에서 다시 확인합니다. 정식 음원은 제작 대기 중입니다."},
          "vocabulary":[
            {"ko":"저","zh":"我（谦称）","pos":"代词","collocation":"저는 학생이에요."},
            {"ko":"이름","zh":"名字","pos":"名词","collocation":"이름이 뭐예요?"},
            {"ko":"학생","zh":"学生","pos":"名词","collocation":"학생이에요."},
            {"ko":"선생님","zh":"老师","pos":"名词","collocation":"선생님이에요."},
            {"ko":"친구","zh":"朋友","pos":"名词","collocation":"친구를 만나요."},
            {"ko":"사람","zh":"人","pos":"名词","collocation":"중국 사람이에요."},
            {"ko":"만나다","zh":"见面","pos":"动词","collocation":"처음 만나요."},
            {"ko":"인사하다","zh":"问候","pos":"动词","collocation":"친구에게 인사해요."},
            {"ko":"소개하다","zh":"介绍","pos":"动词","collocation":"자신을 소개해요."},
            {"ko":"한국어","zh":"韩语","pos":"名词","collocation":"한국어를 배워요."},
            {"ko":"처음","zh":"第一次","pos":"名词·副词","collocation":"처음 만나요."},
            {"ko":"반갑다","zh":"高兴、荣幸","pos":"形容词","collocation":"만나서 반가워요."}
          ],
          "coach":{"zh-CN":"12 词跟读与补句是自主练习；强制证据是词义题答对并确认已朗读整句。","ko-KR":"12개 어휘 따라 읽기와 문장 완성은 자율 연습이며, 뜻 문항 정답과 문장 낭독 확인이 필수 증거입니다."},
          "nextNode":"topic-and-copula"
        }
      },
      {
        "code":"grammar","order":3,"accent":"iris","type":"learn","minutes":14,"nodeCode":"topic-and-copula",
        "title":{"zh-CN":"语法讲解","ko-KR":"문법 이해"},
        "description":{"zh-CN":"用三张语法卡掌握身份判断、话题和确认疑问。","ko-KR":"세 장의 문법 카드로 신분 서술, 화제와 확인 질문을 익힙니다."},
        "nodeTitle":{"zh-CN":"把姓名和身份说完整","ko-KR":"이름과 신분을 완전하게 말하기"},
        "content":{
          "lead":{"zh-CN":"先看名词末音节是否有收音，再选择形态；问句不增加相当于汉语“吗”的成分。","ko-KR":"명사의 마지막 음절에 받침이 있는지 확인해 형태를 고르고, 질문에는 별도의 의문 요소를 더하지 않습니다."},
          "grammarCards":[
            {"form":"N이에요/예요","function":{"zh-CN":"说明姓名、国籍或身份。","ko-KR":"이름, 국적이나 신분을 설명합니다."},"rules":["有收音：N + 이에요","无收音：N + 예요","与前面名词连写；예요 不能写成 에요"],"examples":[{"ko":"저는 학생이에요.","zh":"我是学生。","audioId":"chapter-01-grammar-01-example-01","audioStatus":"pending"},{"ko":"저는 왕밍이에요. 네, 학생이에요.","zh":"我叫王明。是的，我是学生。","audioId":"chapter-01-grammar-01-example-02","audioStatus":"pending"},{"ko":"저는 리나예요. 학생이에요.","zh":"我叫丽娜。我是学生。","audioId":"chapter-01-grammar-01-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：저는 리나에요. 正确：저는 리나예요.","ko-KR":"잘못: 저는 리나에요. 바른 표현: 저는 리나예요."},"source":{"zh-CN":"母本 §5.1；旧版电子书精确页码待人工核对。","ko-KR":"원고 §5.1; 기존 전자책의 정확한 쪽수는 수동 확인이 필요합니다."}},
            {"form":"N은/는","function":{"zh-CN":"把“我”或对方设为当前谈话主题。","ko-KR":"나 또는 상대를 현재 대화의 화제로 제시합니다."},"rules":["有收音：N + 은","无收音：N + 는","은/는 不是“是”，句末仍需要谓语"],"examples":[{"ko":"저는 왕밍이에요.","zh":"我叫王明。","audioId":"chapter-01-grammar-02-example-01","audioStatus":"pending"},{"ko":"지민 씨는 학생이에요?","zh":"智敏，你是学生吗？","audioId":"chapter-01-grammar-02-example-02","audioStatus":"pending"},{"ko":"리나 씨는 중국 사람이에요?","zh":"丽娜，你是中国人吗？","audioId":"chapter-01-grammar-02-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：저 학생이에요는. 는 必须紧跟话题。","ko-KR":"잘못: 저 학생이에요는. 는은 화제 바로 뒤에 옵니다."},"source":{"zh-CN":"母本 §5.2；旧版电子书精确页码待人工核对。","ko-KR":"원고 §5.2; 기존 전자책의 정확한 쪽수는 수동 확인이 필요합니다."}},
            {"form":"N이에요/예요?","function":{"zh-CN":"礼貌确认对方的姓名、国籍或身份。","ko-KR":"상대의 이름, 국적이나 신분을 공손하게 확인합니다."},"rules":["书写形态与陈述句相同","口语句末自然上扬","回答应补全身份信息"],"examples":[{"ko":"지민 씨는 학생이에요?","zh":"智敏，你是学生吗？","audioId":"chapter-01-grammar-03-example-01","audioStatus":"pending"},{"ko":"왕밍 씨는 중국 사람이에요?","zh":"王明，你是中国人吗？","audioId":"chapter-01-grammar-03-example-02","audioStatus":"pending"},{"ko":"리나 씨는 선생님이에요? 아니요, 학생이에요.","zh":"丽娜，你是老师吗？不，我是学生。","audioId":"chapter-01-grammar-03-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：학생이에요 까? 正确：학생이에요?","ko-KR":"잘못: 학생이에요 까? 바른 표현: 학생이에요?"},"source":{"zh-CN":"母本 §5.3；旧版电子书精确页码待人工核对。","ko-KR":"원고 §5.3; 기존 전자책의 정확한 쪽수는 수동 확인이 필요합니다."}}
          ],
          "coach":{"zh-CN":"三项填空必须一次全部正确；功能解释与扩展形态练习为自主展示。","ko-KR":"세 빈칸을 모두 맞혀야 하며 기능 설명과 확장 연습은 자율 활동입니다."},
          "nextNode":"introduce-yourself"
        }
      },
      {
        "code":"patterns","order":4,"accent":"coral","type":"practice","minutes":10,"nodeCode":"introduce-yourself",
        "title":{"zh-CN":"句型操练","ko-KR":"문형 연습"},
        "description":{"zh-CN":"通过替换、排序、快答和个人化输出形成可调用语块。","ko-KR":"대치, 배열, 빠른 응답과 개인화 표현으로 바로 쓸 수 있는 말덩이를 만듭니다."},
        "nodeTitle":{"zh-CN":"从照着换到自己说","ko-KR":"바꾸어 말하기에서 스스로 말하기까지"},
        "content":{"lead":{"zh-CN":"按交际意义处理完整语块，不拆成单字。","ko-KR":"낱글자가 아니라 의사소통 의미를 가진 말덩이로 연습합니다."},"pattern":"안녕하세요? → 저는 [이름]이에요/예요. → 저는 [신분]이에요/예요. → 만나서 반가워요.","substitutions":["왕밍이에요","지민이에요","리나예요","학생이에요","선생님이에요","중국 사람이에요"],"substitutionGroups":[["저는 왕밍이에요.","저는 지민이에요.","저는 리나예요."],["저는 학생이에요.","저는 선생님이에요.","저는 중국 사람이에요."],["지민 씨는 학생이에요?","왕밍 씨는 선생님이에요?","리나 씨는 중국 사람이에요?"]],"quickResponse":["네, 학생이에요.","아니요, 선생님이에요."],"personalOutput":["真实姓名","真实或安全虚构国籍／地区","真实或安全虚构身份"],"coach":{"zh-CN":"排序题答对即完成；替换、快答与 3 句个人表达为自主练习。","ko-KR":"배열 문항을 맞히면 완료되며 대치, 빠른 응답과 세 문장 말하기는 자율 연습입니다."},"nextNode":"club-first-meeting"}
      },
      {
        "code":"dialogue","order":5,"accent":"sky","type":"mission","minutes":11,"nodeCode":"club-first-meeting",
        "title":{"zh-CN":"实战对话","ko-KR":"실전 대화"},
        "description":{"zh-CN":"在两个完整场景中听取信息、自然回应并交还话轮。","ko-KR":"두 개의 완전한 장면에서 정보를 듣고 자연스럽게 반응하며 차례를 주고받습니다."},
        "nodeTitle":{"zh-CN":"两个人真正轮流说","ko-KR":"두 사람이 실제로 번갈아 말하기"},
        "content":{"lead":{"zh-CN":"场景 1 为 8 轮主对话；场景 2 展示身份猜错后的自然更正。整段与逐句正式音频均待制作。","ko-KR":"장면 1은 8턴의 주 대화이고 장면 2는 신분을 잘못 짐작한 뒤 자연스럽게 고치는 대화입니다. 전체와 문장별 정식 음원은 제작 대기 중입니다."},"dialogueScenes":[{"title":"场景 1｜校园语言交换签到区","context":{"zh-CN":"王明与智敏同龄、第一次见面，交换姓名与学生身份并礼貌结束。","ko-KR":"동갑인 왕밍과 지민이 처음 만나 이름과 학생 신분을 확인하고 인사를 마칩니다."},"lines":[{"speaker":"지민","ko":"안녕하세요? 저는 김지민이에요.","zh":"你好，我叫金智敏。"},{"speaker":"왕밍","ko":"안녕하세요? 저는 왕밍이에요.","zh":"你好，我叫王明。"},{"speaker":"지민","ko":"왕밍 씨는 학생이에요?","zh":"王明，你是学生吗？"},{"speaker":"왕밍","ko":"네, 학생이에요. 한국어를 배워요.","zh":"是的，我是学生。我学韩语。"},{"speaker":"왕밍","ko":"지민 씨는 학생이에요?","zh":"智敏，你是学生吗？"},{"speaker":"지민","ko":"네, 저도 학생이에요.","zh":"是的，我也是学生。"},{"speaker":"왕밍","ko":"만나서 반가워요.","zh":"很高兴认识你。"},{"speaker":"지민","ko":"저도 만나서 반가워요.","zh":"我也很高兴认识你。"}]},{"title":"场景 2｜国际学生休息区","context":{"zh-CN":"敏智误以为丽娜是老师；丽娜礼貌更正为学生后，两人自然结束。","ko-KR":"민지가 리나를 선생님으로 잘못 생각하지만 리나가 학생이라고 공손히 고친 뒤 대화를 마칩니다."},"lines":[{"speaker":"민지","ko":"안녕하세요? 저는 민지예요.","zh":"你好，我叫敏智。"},{"speaker":"리나","ko":"안녕하세요? 저는 리나예요.","zh":"你好，我叫丽娜。"},{"speaker":"민지","ko":"리나 씨는 선생님이에요?","zh":"丽娜，你是老师吗？"},{"speaker":"리나","ko":"아니요, 학생이에요.","zh":"不，我是学生。"},{"speaker":"민지","ko":"아, 네. 만나서 반가워요.","zh":"啊，好的。很高兴认识你。"},{"speaker":"리나","ko":"저도 반가워요.","zh":"我也很高兴认识你。"}]}],"coach":{"zh-CN":"完成两场景身份事实组合题和场景 1 结束语回应题；替换与试录为自主练习。","ko-KR":"두 장면의 신분 사실 문항과 장면 1의 마무리 응답 문항을 완료합니다. 정보 바꾸기와 시험 녹음은 자율 연습입니다."},"nextNode":"listen-and-respond"}
      },
      {
        "code":"listen_speak","order":6,"accent":"jade","type":"practice","minutes":10,"nodeCode":"listen-and-respond",
        "title":{"zh-CN":"听说任务","ko-KR":"듣기·말하기"},
        "description":{"zh-CN":"先听出身份，再提交约 30 秒、至少 8 轮的双角色对话。","ko-KR":"먼저 신분을 듣고 약 30초, 8턴 이상의 두 역할 대화를 제출합니다."},
        "nodeTitle":{"zh-CN":"听出身份，再完成 30 秒交流","ko-KR":"신분을 듣고 30초 대화 완성하기"},
        "content":{"lead":{"zh-CN":"听力依据必须来自音频原话，不能根据人物形象猜答案。正式听力仍待母语审校、录制与文件核验。","ko-KR":"그림이 아니라 음성의 실제 표현을 근거로 답해야 합니다. 정식 듣기는 원어민 검수, 녹음과 파일 확인 대기 중입니다."},"listenFor":["姓名","国籍／地区","身份词","结束语"],"speakingFrame":"A/B：问候 → 双方姓名 → 身份确认问答 → 双方礼貌结束","speakingCriteria":["双方问候","双方姓名","至少一次身份确认问句","肯定或否定回答","双方礼貌结束"],"coach":{"zh-CN":"当前不提供发音评分；系统只核对录音时长、话轮数和学习者确认的五项信息。","ko-KR":"현재 발음 점수는 제공하지 않으며 녹음 시간, 대화 차례 수와 학습자가 확인한 다섯 정보만 기록합니다."},"nextNode":"profile-note"}
      },
      {
        "code":"read_write","order":7,"accent":"iris","type":"practice","minutes":10,"nodeCode":"profile-note",
        "title":{"zh-CN":"读写拓展","ko-KR":"읽기·쓰기"},
        "description":{"zh-CN":"读懂新成员卡中的姓名、国籍和身份，再写原创介绍。","ko-KR":"새 회원 카드의 이름, 국적과 신분을 읽고 독창적인 소개 글을 씁니다."},
        "nodeTitle":{"zh-CN":"读一张新成员卡，写自己的介绍","ko-KR":"새 회원 카드를 읽고 자기소개 쓰기"},
        "content":{"lead":{"zh-CN":"按“问候—姓名—国籍／地区—身份／学习内容—结束语”找信息。","ko-KR":"인사—이름—국적·지역—신분·학습 내용—마무리 순서로 정보를 찾습니다."},"reading":"안녕하세요? 저는 리나예요. 중국 사람이에요. 학생이에요. 한국어를 배워요. 만나서 반가워요.","questions":["이 사람의 이름은 뭐예요?","어느 나라 사람이에요?","학생이에요, 선생님이에요?"],"writingFrame":"안녕하세요? → 저는 ___이에요/예요. → ___ 사람이에요.／___를 배워요. → 저는 ___이에요/예요. → 만나서 반가워요.","rubric":["信息完整","核心语法","可理解度","格式与语气"],"originalExample":"안녕하세요? 저는 다니엘이에요. 캐나다 사람이에요. 저는 학생이에요. 만나서 반가워요.","coach":{"zh-CN":"阅读三题全部答对，并提交 4—5 句、至少四类信息且完成量规自查的原创介绍。","ko-KR":"읽기 세 문항을 모두 맞히고 네 가지 이상 정보를 담은 4~5문장의 독창적인 글과 평가표 점검을 제출합니다."},"nextNode":"can-do-check"}
      },
      {
        "code":"review","order":8,"accent":"coral","type":"review","minutes":8,"nodeCode":"can-do-check",
        "title":{"zh-CN":"自测与复盘","ko-KR":"자기 점검"},
        "description":{"zh-CN":"完成综合检测、五项 Can-do 自查并记录返回节点。","ko-KR":"종합 문항과 다섯 가지 Can-do를 점검하고 돌아갈 학습 위치를 기록합니다."},
        "nodeTitle":{"zh-CN":"我能独立完成第一次见面吗？","ko-KR":"첫 만남을 혼자 완성할 수 있나요?"},
        "content":{"lead":{"zh-CN":"把错误分到词汇、语法、理解或表达，再回到对应节点补练。","ko-KR":"오류를 어휘, 문법, 이해 또는 표현으로 나누고 해당 학습 위치로 돌아가 연습합니다."},"checklist":[{"ko":"안녕하세요?로 먼저 인사할 수 있어요.","zh":"我能主动问候"},{"ko":"이름과 신분을 소개할 수 있어요.","zh":"我能介绍姓名与身份"},{"ko":"상대의 신분을 묻고 대답할 수 있어요.","zh":"我能询问并回答身份"},{"ko":"만나서 반가워요로 자연스럽게 마칠 수 있어요.","zh":"我能自然结束交流"},{"ko":"두 역할로 30초 동안 대화할 수 있어요.","zh":"我能完成 30 秒、8 轮以上双角色对话"}],"returnMap":[{"reason":"词汇","node":"people-and-greetings"},{"reason":"语法","node":"topic-and-copula"},{"reason":"理解","node":"club-first-meeting"},{"reason":"表达","node":"listen-and-respond"}],"coach":{"zh-CN":"综合多选与五项自查都提交后完成；八节点全部完成才解锁章节测试。","ko-KR":"종합 복수 선택과 다섯 항목 자기 점검을 모두 제출하고 여덟 노드를 완료해야 단원 평가가 열립니다."},"nextNode":"chapter-test:korean-level-one-01"}
      }
    ]
    $json$::jsonb)
  loop
    insert into public.digital_textbook_modules (
      chapter_id, module_code, sort_order, accent_role, title, description
    ) values (
      chapter_uuid,
      module_seed ->> 'code',
      (module_seed ->> 'order')::integer,
      module_seed ->> 'accent',
      module_seed -> 'title',
      module_seed -> 'description'
    )
    on conflict (chapter_id, module_code) do update set
      sort_order = excluded.sort_order,
      accent_role = excluded.accent_role,
      title = excluded.title,
      description = excluded.description,
      updated_at = now()
    returning id into module_uuid;

    insert into public.digital_textbook_nodes (
      module_id, node_code, node_type, sort_order, estimated_minutes, title, content
    ) values (
      module_uuid,
      module_seed ->> 'nodeCode',
      module_seed ->> 'type',
      1,
      (module_seed ->> 'minutes')::integer,
      module_seed -> 'nodeTitle',
      module_seed -> 'content'
    )
    on conflict (module_id, node_code) do update set
      node_type = excluded.node_type,
      estimated_minutes = excluded.estimated_minutes,
      title = excluded.title,
      content = excluded.content,
      updated_at = now();
  end loop;

  -- Make room for newly split required activities before applying unique sort positions.
  update public.digital_textbook_activities as activity
  set sort_order = 2, updated_at = now()
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  where activity.node_id = node.id
    and module.chapter_id = chapter_uuid
    and activity.activity_key in ('dialogue-response', 'write-profile');

  for activity_seed in
    select value from jsonb_array_elements($activities$
    [
      {
        "nodeCode":"mission-map","key":"orientation-check","type":"single_choice","order":1,"maxAttempts":3,
        "prompt":{"zh-CN":"王明第一次在语言交换活动见到智敏，哪一句最适合先说？","ko-KR":"왕밍이 언어 교환 모임에서 지민을 처음 만났습니다. 가장 먼저 할 말은 무엇이에요?"},
        "instruction":{"zh-CN":"选择一个最符合“初次见面先问候”的表达；本题不计分。","ko-KR":"‘처음 만나서 먼저 인사하기’에 맞는 표현을 하나 고르세요. 점수에는 포함되지 않습니다."},
        "options":["안녕하세요?","얼마예요?","어디에 있어요?","감기에 걸렸어요."],
        "config":{"shuffle":false,"showScore":false},
        "answer":{"kind":"index","value":0},
        "explanation":{"correct":{"zh-CN":"안녕하세요? 能在这个场景自然开启交流。","ko-KR":"안녕하세요?는 이 상황에서 대화를 자연스럽게 시작합니다."},"feedback":[{"zh-CN":"先看人物关系：两人同龄、第一次见面。","ko-KR":"두 사람이 동갑이고 처음 만났다는 관계를 먼저 보세요."},{"zh-CN":"寻找“问候”功能，不要选价格、地点或健康表达。","ko-KR":"가격, 장소, 건강 표현이 아니라 인사 기능을 찾으세요."},{"zh-CN":"正确答案是 안녕하세요?；其他三句分别问价格、位置或说明感冒。","ko-KR":"정답은 안녕하세요?입니다. 다른 표현은 가격, 위치 또는 감기 상태를 말합니다."}]}
      },
      {
        "nodeCode":"people-and-greetings","key":"vocabulary-check","type":"single_choice","order":1,"maxAttempts":3,
        "prompt":{"zh-CN":"句子 저는 학생이에요. 中，저 是什么意思？","ko-KR":"저는 학생이에요.에서 저는 무슨 뜻이에요?"},
        "instruction":{"zh-CN":"选择词义，再用整句朗读一次。","ko-KR":"뜻을 하나 고른 뒤 문장 전체를 한 번 읽으세요."},
        "options":["我（谦称）","朋友","老师","名字"],
        "config":{"shuffle":false,"audioPending":true,"readAloudConfirmation":{"label":"已朗读整句","required":true}},
        "answer":{"kind":"index_confirmation","value":0},
        "explanation":{"correct":{"zh-CN":"저 是说话人对自己的谦称，整句意为“我是学生”。","ko-KR":"저는 말하는 사람이 자신을 낮추어 가리키는 말이며 문장은 ‘저는 학생이에요’라는 뜻입니다."},"feedback":[{"zh-CN":"看看 저는 后面是不是在介绍说话人自己。","ko-KR":"저는 뒤에서 말하는 사람 자신을 소개하는지 보세요."},{"zh-CN":"저 是代词，常与话题助词组成 저는。","ko-KR":"저는 대명사이며 주제 조사와 결합해 저는이 됩니다."},{"zh-CN":"正确答案是“我（谦称）”；还需要勾选已朗读整句。","ko-KR":"정답은 ‘저’이며 문장 전체를 읽었다는 확인도 필요합니다."}]}
      },
      {
        "nodeCode":"topic-and-copula","key":"grammar-fill","type":"fill_blank","order":1,"maxAttempts":3,
        "prompt":{"zh-CN":"连续完成三小题，检查判断词尾、话题助词和确认疑问句。","ko-KR":"서술격 어미, 주제 조사, 확인 의문문을 확인하는 세 문항을 완성하세요."},
        "instruction":{"zh-CN":"依次填写三个空；第三空须包含问号。","ko-KR":"세 빈칸을 차례로 쓰고 세 번째 답에는 물음표도 쓰세요."},
        "options":[],
        "config":{"normalize":"NFC","items":[{"id":"copula","label":"저는 리나___","placeholder":"이에요/예요"},{"id":"topic","label":"지민 씨___ 학생이에요.","placeholder":"은/는"},{"id":"confirmation","label":"지민 씨는 학생___","placeholder":"이에요?/예요?"}]},
        "answer":{"kind":"text_array","value":["예요","는","이에요?"]},
        "explanation":{"correct":{"zh-CN":"三项规范答案依次为 예요、는、이에요?。","ko-KR":"세 답은 차례로 예요, 는, 이에요?입니다."},"feedback":[{"zh-CN":"先判断每空负责说明身份、提出话题还是确认身份。","ko-KR":"각 빈칸이 신분 설명, 화제 제시, 신분 확인 중 어떤 기능인지 먼저 판단하세요."},{"zh-CN":"① 나 无收音；② 씨 后要话题助词；③ 학생 有收音且必须是问句。","ko-KR":"① 나는 받침이 없고 ② 씨 뒤에는 주제 조사가 필요하며 ③ 학생은 받침이 있고 질문이어야 합니다."},{"zh-CN":"完整句是 저는 리나예요.／지민 씨는 학생이에요.／지민 씨는 학생이에요?，请全部正确重做。","ko-KR":"완전한 문장은 저는 리나예요.／지민 씨는 학생이에요.／지민 씨는 학생이에요?입니다. 모두 다시 맞히세요."}]}
      },
      {
        "nodeCode":"introduce-yourself","key":"pattern-order","type":"ordering","order":1,"maxAttempts":3,
        "prompt":{"zh-CN":"把四个语块排成自然的自我介绍。","ko-KR":"네 개의 말덩이를 자연스러운 자기소개 순서로 배열하세요."},
        "instruction":{"zh-CN":"按“问候—姓名—身份—结束语”排序。","ko-KR":"‘인사—이름—신분—마무리’ 순서로 배열하세요."},
        "options":["만나서 반가워요.","저는 학생이에요.","안녕하세요?","저는 리나예요."],
        "config":{"resettable":true},
        "answer":{"kind":"order","value":[2,3,1,0]},
        "explanation":{"correct":{"zh-CN":"自然流程是问候、姓名、身份、结束语。","ko-KR":"자연스러운 흐름은 인사, 이름, 신분, 마무리입니다."},"feedback":[{"zh-CN":"先找开启交流和结束交流的两张卡。","ko-KR":"대화를 시작하고 마치는 두 카드를 먼저 찾으세요."},{"zh-CN":"中间两句先说姓名，再说身份。","ko-KR":"가운데에서는 이름을 먼저 말하고 신분을 말합니다."},{"zh-CN":"正确顺序：안녕하세요? → 저는 리나예요. → 저는 학생이에요. → 만나서 반가워요.。","ko-KR":"정답 순서: 안녕하세요? → 저는 리나예요. → 저는 학생이에요. → 만나서 반가워요."}]}
      },
      {
        "nodeCode":"club-first-meeting","key":"dialogue-fact-check","type":"single_choice","order":1,"maxAttempts":3,
        "prompt":{"zh-CN":"哪一组选项同时正确概括两个场景的身份信息？","ko-KR":"두 장면의 신분 정보를 모두 바르게 정리한 것은 무엇이에요?"},
        "instruction":{"zh-CN":"选择“场景 1 共同身份／场景 2 最初误认身份”的正确组合。","ko-KR":"‘장면 1의 공통 신분／장면 2에서 처음 짐작한 신분’의 맞는 조합을 고르세요."},
        "options":["학생／선생님","학생／회사원","선생님／학생","친구／의사"],
        "config":{"shuffle":false},
        "answer":{"kind":"index","value":0},
        "explanation":{"correct":{"zh-CN":"场景 1 两人都是学生；场景 2 最初误以为丽娜是老师。","ko-KR":"장면 1의 두 사람은 학생이고 장면 2에서는 리나를 처음에 선생님으로 생각했습니다."},"feedback":[{"zh-CN":"分别找两个场景直接出现的身份词，不要根据图片猜。","ko-KR":"그림으로 짐작하지 말고 두 장면에 직접 나온 신분 표현을 찾으세요."},{"zh-CN":"场景 1 看两次肯定回答；场景 2 看 아니요 之前的问题。","ko-KR":"장면 1의 두 긍정 대답과 장면 2의 아니요 앞 질문을 보세요."},{"zh-CN":"正确组合是“学生／老师”。","ko-KR":"정답 조합은 ‘학생／선생님’입니다."}]}
      },
      {
        "nodeCode":"club-first-meeting","key":"dialogue-response","type":"single_choice","order":2,"maxAttempts":3,
        "prompt":{"zh-CN":"新同学说 만나서 반가워요.，哪一句回应最自然？","ko-KR":"새 친구가 만나서 반가워요.라고 말했습니다. 가장 자연스러운 대답은 무엇이에요?"},
        "instruction":{"zh-CN":"选择既回应对方、又符合初次见面礼貌体的一句。","ko-KR":"상대의 말에 답하면서 첫 만남의 높임말에 맞는 문장을 고르세요."},
        "options":["저도 반가워요.","학생이에요?","얼마예요?","안녕."],
        "config":{"shuffle":false},
        "answer":{"kind":"index","value":0},
        "explanation":{"correct":{"zh-CN":"저도 반가워요. 是自然、对称的礼貌回应。","ko-KR":"저도 반가워요.는 자연스럽고 대칭적인 공손한 응답입니다."},"feedback":[{"zh-CN":"先判断对方是在提问，还是表达见面的喜悦。","ko-KR":"상대가 질문하는지 만남의 기쁨을 표현하는지 먼저 판단하세요."},{"zh-CN":"寻找含“我也”的对称回应。","ko-KR":"‘나도’라는 뜻을 가진 대칭 응답을 찾으세요."},{"zh-CN":"正确答案是 저도 반가워요.；저도 表示“我也”。","ko-KR":"정답은 저도 반가워요.이며 저도는 ‘나도’라는 뜻입니다."}]}
      },
      {
        "nodeCode":"listen-and-respond","key":"listening-identity","type":"listening","order":1,"maxAttempts":3,
        "prompt":{"zh-CN":"听音频，判断说话人的身份。","ko-KR":"음성을 듣고 말하는 사람의 신분을 고르세요."},
        "instruction":{"zh-CN":"依据音频原话作答，不根据人物图片猜测。","ko-KR":"그림이 아니라 음성의 말에 근거해 답하세요."},
        "options":["학생","선생님","회사원","의사"],
        "config":{"audioId":"chapter-01-listening-identity","audioStatus":"pending","normalReplayLimit":2,"slowReplayLimit":1},
        "answer":{"kind":"index","value":0},
        "explanation":{"correct":{"zh-CN":"答案是 학생；原文明确说 학생이에요.。","ko-KR":"정답은 학생이며 음성에서 학생이에요.라고 분명히 말합니다."},"feedback":[{"zh-CN":"再听一次自我介绍中表示身份的名词。","ko-KR":"자기소개에서 신분을 나타내는 명사를 다시 들어 보세요."},{"zh-CN":"目标句紧跟在国籍介绍后，句末是 -이에요。","ko-KR":"목표 문장은 국적 소개 바로 뒤에 나오고 -이에요로 끝납니다."},{"zh-CN":"答案是 학생；其他职业从未出现。","ko-KR":"정답은 학생이며 다른 직업은 음성에 나오지 않습니다."}]},
        "transcript":"안녕하세요? 저는 수진이에요. 한국 사람이에요. 저는 학생이에요. 한국어를 배워요. 만나서 반가워요.",
        "audioObjectKey":"korean-level-one/chapter-01/listening/chapter-01-listening-identity.mp3","audioStatus":"pending"
      },
      {
        "nodeCode":"listen-and-respond","key":"speaking-introduction","type":"speaking","order":2,"maxAttempts":3,
        "prompt":{"zh-CN":"完成约 30 秒、至少 8 轮的双角色初次见面对话。","ko-KR":"약 30초 동안 8턴 이상의 두 역할 첫 만남 대화를 완성하세요."},
        "instruction":{"zh-CN":"录音可播放后，填写话轮数并逐项确认五类信息，再主动提交。","ko-KR":"녹음을 재생할 수 있으면 대화 차례 수와 다섯 정보를 확인한 뒤 제출하세요."},
        "options":[],
        "config":{"minimumSeconds":25,"maximumSeconds":40,"minimumTurns":8,"requiredCriteria":5,"pronunciationScore":false,"criteria":["双方问候","双方姓名","至少一次身份确认问句","肯定或否定回答","双方礼貌结束"]},
        "answer":{"kind":"open"},
        "explanation":{"correct":{"zh-CN":"已记录可播放录音、时长、话轮数和五项信息自查；当前不提供发音准确率。","ko-KR":"재생 가능한 녹음, 시간, 대화 차례 수와 다섯 정보 점검을 기록했습니다. 현재 발음 정확도는 제공하지 않습니다."},"feedback":[{"zh-CN":"先检查是否录音，并确认两个角色都说了姓名和问候。","ko-KR":"먼저 녹음 여부와 두 역할의 이름 및 인사를 확인하세요."},{"zh-CN":"录音需 25—40 秒、至少 8 轮，并包含身份问答。","ko-KR":"녹음은 25~40초, 8턴 이상이어야 하며 신분 질문과 답이 있어야 합니다."},{"zh-CN":"对照五项清单补齐后重录；系统不提供虚假发音评分。","ko-KR":"다섯 항목을 보완해 다시 녹음하세요. 시스템은 부정확한 발음 점수를 제공하지 않습니다."}]}
      },
      {
        "nodeCode":"profile-note","key":"reading-profile","type":"single_choice","order":1,"maxAttempts":3,
        "prompt":{"zh-CN":"阅读新成员卡，完成姓名、国籍和身份三道事实理解题。","ko-KR":"새 회원 소개 카드를 읽고 이름, 국적, 신분에 관한 세 문제에 답하세요."},
        "instruction":{"zh-CN":"每题只选一个答案，依据必须来自卡片原句。","ko-KR":"문제마다 답을 하나만 고르고 소개 카드의 문장에서 근거를 찾으세요."},
        "options":[],
        "config":{"reading":"안녕하세요? 저는 리나예요. 중국 사람이에요. 학생이에요. 한국어를 배워요. 만나서 반가워요.","items":[{"id":"name","question":"이 사람의 이름은 뭐예요?","options":["리나","다니엘","수진","지민"]},{"id":"country","question":"어느 나라 사람이에요?","options":["중국 사람","한국 사람","캐나다 사람","회사원"]},{"id":"identity","question":"학생이에요, 선생님이에요?","options":["학생","선생님","회사원","의사"]}],"shuffle":false},
        "answer":{"kind":"index_array","value":[0,0,0]},
        "explanation":{"correct":{"zh-CN":"三题答案依次是 리나、중국 사람、학생。","ko-KR":"세 답은 차례로 리나, 중국 사람, 학생입니다."},"feedback":[{"zh-CN":"分别圈出姓名句、国籍句和身份句。","ko-KR":"이름 문장, 국적 문장과 신분 문장을 각각 찾으세요."},{"zh-CN":"不要把 한국어 误当成国籍，也不要凭形象猜职业。","ko-KR":"한국어를 국적으로 착각하거나 인상으로 직업을 짐작하지 마세요."},{"zh-CN":"依据依次是 저는 리나예요.／중국 사람이에요.／학생이에요.。","ko-KR":"근거는 저는 리나예요.／중국 사람이에요.／학생이에요.입니다."}]}
      },
      {
        "nodeCode":"profile-note","key":"write-profile","type":"writing","order":2,"maxAttempts":3,
        "prompt":{"zh-CN":"为语言交换社团写一张 4—5 句的新成员介绍卡。","ko-KR":"언어 교환 모임의 새 회원 소개를 4~5문장으로 쓰세요."},
        "instruction":{"zh-CN":"写安全的原创信息，不复制示范；完成四维量规自查。","ko-KR":"예시를 베끼지 말고 안전한 자기 정보를 쓴 뒤 네 가지 평가 기준을 점검하세요."},
        "options":[],
        "config":{"minSentences":4,"maxSentences":5,"minimumInformationKinds":4,"informationChecklist":["问候","姓名","国籍／地区或语言背景","身份","结束语"],"rubricConfirmation":"我已按信息完整、核心语法、可理解度、格式与语气完成自查"},
        "answer":{"kind":"open"},
        "explanation":{"correct":{"zh-CN":"已记录 4—5 句原创介绍与量规自查，不按唯一范文判定。","ko-KR":"4~5문장의 독창적인 소개와 평가표 점검을 기록했으며 하나의 예시 문장과 일치시키지 않습니다."},"feedback":[{"zh-CN":"先数信息点：姓名、两项身份信息和结束语是否齐全？","ko-KR":"이름, 두 가지 신분 정보와 마무리 인사가 있는지 먼저 세어 보세요."},{"zh-CN":"逐个检查名词末尾收音，再核对 이에요/예요 和 은/는。","ko-KR":"명사의 받침을 하나씩 확인하고 이에요/예요와 은/는을 점검하세요."},{"zh-CN":"需要 4—5 句、至少四类信息，并勾选量规自查。","ko-KR":"4~5문장, 네 종류 이상의 정보와 평가표 점검이 필요합니다."}]}
      },
      {
        "nodeCode":"can-do-check","key":"review-multiple","type":"multiple_choice","order":1,"maxAttempts":3,
        "prompt":{"zh-CN":"选择所有能直接帮助完成“初次见面对话”的表达。","ko-KR":"‘첫 만남 대화’를 직접 완성하는 데 도움이 되는 표현을 모두 고르세요."},
        "instruction":{"zh-CN":"全部选对且不多选才算正确。","ko-KR":"맞는 표현을 모두 고르고 틀린 표현은 고르지 않아야 합니다."},
        "options":["안녕하세요?","저는 학생이에요.","만나서 반가워요.","감기에 걸렸어요."],
        "config":{"selection":"multiple"},
        "answer":{"kind":"indices","value":[0,1,2]},
        "explanation":{"correct":{"zh-CN":"问候、身份和结束语都能直接完成本课任务。","ko-KR":"인사, 신분과 마무리 표현은 모두 이 단원의 과제를 직접 완성합니다."},"feedback":[{"zh-CN":"按对话流程检查：问候、身份、结束各需要一句。","ko-KR":"대화 흐름에서 인사, 신분, 마무리 표현을 각각 찾으세요."},{"zh-CN":"有一句属于健康场景，不属于本课任务。","ko-KR":"한 문장은 건강 상황의 표현으로 이 단원 과제와 관계없습니다."},{"zh-CN":"正确集合是 A、B、C；D 表示“感冒了”。","ko-KR":"정답은 A, B, C이며 D는 감기에 걸렸다는 뜻입니다."}]}
      },
      {
        "nodeCode":"can-do-check","key":"self-check","type":"self_check","order":2,"maxAttempts":3,
        "prompt":{"zh-CN":"根据实际表现完成五项 Can-do 自查，并确定下一步复习位置。","ko-KR":"실제 수행을 바탕으로 다섯 가지 Can-do를 점검하고 다음 복습 위치를 정하세요."},
        "instruction":{"zh-CN":"五项都要回应；需要复习时至少选一个返回节点，全部能完成时选择“无错／保持练习”。","ko-KR":"다섯 항목에 모두 응답하고 복습이 필요하면 돌아갈 위치를 하나 이상, 모두 가능하면 ‘오류 없음／계속 연습’을 고르세요."},
        "options":[],
        "config":{"requiredChecks":5,"items":[{"id":"greeting","label":"我能主动问候／먼저 인사할 수 있어요"},{"id":"introduction","label":"我能介绍姓名与身份／이름과 신분을 소개할 수 있어요"},{"id":"identity","label":"我能询问并回答身份／신분을 묻고 대답할 수 있어요"},{"id":"closing","label":"我能自然结束交流／자연스럽게 마칠 수 있어요"},{"id":"dialogue","label":"我能完成 30 秒双角色对话／30초 두 역할 대화를 할 수 있어요"}],"returnNodes":[{"value":"people-and-greetings","label":"词汇"},{"value":"topic-and-copula","label":"语法"},{"value":"club-first-meeting","label":"对话理解"},{"value":"listen-and-respond","label":"听说输出"},{"value":"profile-note","label":"读写"},{"value":"none","label":"无错／保持练习"}]},
        "answer":{"kind":"open"},
        "explanation":{"correct":{"zh-CN":"五项自查与返回位置已记录；主观自查不替代其他活动证据。","ko-KR":"다섯 항목과 복습 위치를 기록했습니다. 자기 점검은 다른 활동의 완료 증거를 대신하지 않습니다."},"feedback":[{"zh-CN":"先逐项回想问候、介绍、身份问答、结束语和双角色录音。","ko-KR":"인사, 소개, 신분 문답, 마무리와 두 역할 녹음을 항목별로 떠올려 보세요."},{"zh-CN":"把“需要复习”对应到具体的词汇、语法、理解、听说或读写节点。","ko-KR":"‘복습 필요’를 어휘, 문법, 이해, 듣기·말하기 또는 읽기·쓰기에 연결하세요."},{"zh-CN":"五项均须作答；有复习项时不能只选“无错”。","ko-KR":"다섯 항목에 모두 답하고 복습 항목이 있으면 ‘오류 없음’만 고를 수 없습니다."}]}
      }
    ]
    $activities$::jsonb)
  loop
    select node.id into node_uuid
    from public.digital_textbook_nodes as node
    join public.digital_textbook_modules as module on module.id = node.module_id
    where module.chapter_id = chapter_uuid
      and node.node_code = activity_seed ->> 'nodeCode';

    insert into public.digital_textbook_activities (
      node_id, activity_key, activity_type, sort_order,
      prompt, instruction, options, public_config, max_attempts
    ) values (
      node_uuid,
      activity_seed ->> 'key',
      activity_seed ->> 'type',
      (activity_seed ->> 'order')::integer,
      activity_seed -> 'prompt',
      activity_seed -> 'instruction',
      activity_seed -> 'options',
      activity_seed -> 'config',
      (activity_seed ->> 'maxAttempts')::integer
    )
    on conflict (node_id, activity_key) do update set
      activity_type = excluded.activity_type,
      sort_order = excluded.sort_order,
      prompt = excluded.prompt,
      instruction = excluded.instruction,
      options = excluded.options,
      public_config = excluded.public_config,
      max_attempts = excluded.max_attempts,
      updated_at = now()
    returning id into activity_uuid;

    insert into public.digital_textbook_activity_secrets (
      activity_id, answer_key, explanation, transcript_ko,
      audio_object_key, audio_status
    ) values (
      activity_uuid,
      activity_seed -> 'answer',
      activity_seed -> 'explanation',
      activity_seed ->> 'transcript',
      activity_seed ->> 'audioObjectKey',
      coalesce(activity_seed ->> 'audioStatus', 'pending')
    )
    on conflict (activity_id) do update set
      answer_key = excluded.answer_key,
      explanation = excluded.explanation,
      transcript_ko = excluded.transcript_ko,
      audio_object_key = excluded.audio_object_key,
      audio_status = excluded.audio_status,
      updated_at = now();
  end loop;

  -- Remove obsolete activities from the trial seed without touching other chapters.
  delete from public.digital_textbook_activities as activity
  using public.digital_textbook_nodes as node,
        public.digital_textbook_modules as module
  where activity.node_id = node.id
    and node.module_id = module.id
    and module.chapter_id = chapter_uuid
    and activity.activity_key not in (
      'orientation-check', 'vocabulary-check', 'grammar-fill', 'pattern-order',
      'dialogue-fact-check', 'dialogue-response', 'listening-identity',
      'speaking-introduction', 'reading-profile', 'write-profile',
      'review-multiple', 'self-check'
    );

  for media_seed in
    select value from jsonb_array_elements($images$
    [
      {"nodeCode":"mission-map","key":"chapter-01-image-01","purpose":"章节情境主图","objectKey":"korean-level-one/chapter-01/images/chapter-01-01-scene.png","alt":{"zh-CN":"校园国际交流中心签到区，两名同龄学生面对面微笑问候，背景有语言交换活动指示牌。","ko-KR":"캠퍼스 국제교류센터 접수대에서 또래 학생 두 명이 마주 보고 웃으며 인사합니다."},"width":1600,"height":900},
      {"nodeCode":"people-and-greetings","key":"chapter-01-image-02","purpose":"核心词汇人物与问候卡","objectKey":"korean-level-one/chapter-01/images/chapter-01-02-vocabulary.png","alt":{"zh-CN":"学生、老师、朋友初次见面和自我介绍四格教学卡，不在图内生成韩文。","ko-KR":"학생, 선생님, 친구의 첫 만남과 자기소개를 보여 주는 네 칸 학습 카드입니다."},"width":1200,"height":900},
      {"nodeCode":"topic-and-copula","key":"chapter-01-image-03","purpose":"主题与判断句语法结构图","objectKey":"korean-level-one/chapter-01/images/chapter-01-03-grammar.png","alt":{"zh-CN":"按收音分流选择 이에요/예요、은/는，并以问号和上扬箭头表示确认疑问。","ko-KR":"받침에 따라 이에요/예요와 은/는을 고르고 물음표와 상승 화살표로 확인 질문을 나타냅니다."},"width":1600,"height":900},
      {"nodeCode":"introduce-yourself","key":"chapter-01-image-04","purpose":"句型语块卡","objectKey":"korean-level-one/chapter-01/images/chapter-01-04-pattern-blocks.png","alt":{"zh-CN":"六张可移动的完整韩语语块卡，用于按交际意义排序。","ko-KR":"의사소통 의미에 따라 배열하는 여섯 장의 완전한 한국어 말덩이 카드입니다."},"width":1200,"height":900},
      {"nodeCode":"club-first-meeting","key":"chapter-01-image-05","purpose":"实战对话场景图","objectKey":"korean-level-one/chapter-01/images/chapter-01-05-dialogue.png","alt":{"zh-CN":"签到区与国际学生休息区的两组同龄学习者初次见面。","ko-KR":"접수대와 국제학생 휴게실에서 또래 학습자 두 쌍이 처음 만납니다."},"width":1600,"height":900},
      {"nodeCode":"listen-and-respond","key":"chapter-01-image-06","purpose":"听力人物身份信息图","objectKey":"korean-level-one/chapter-01/images/chapter-01-06-listening.png","alt":{"zh-CN":"学生、老师、公司职员和医生四张无文字人物身份线索卡。","ko-KR":"학생, 선생님, 회사원, 의사를 나타내는 글자 없는 네 장의 신분 단서 카드입니다."},"width":1200,"height":900},
      {"nodeCode":"profile-note","key":"chapter-01-image-07","purpose":"新成员介绍卡","objectKey":"korean-level-one/chapter-01/images/chapter-01-07-profile.png","alt":{"zh-CN":"含头像位置和五行短文区的校园语言交换社团新成员卡，不把阅读答案写进图片。","ko-KR":"프로필 자리와 다섯 줄 글 영역이 있는 언어 교환 모임 새 회원 카드이며 정답은 그림에 넣지 않습니다."},"width":1200,"height":1600},
      {"nodeCode":"can-do-check","key":"chapter-01-image-08","purpose":"最终任务流程图","objectKey":"korean-level-one/chapter-01/images/chapter-01-08-final-task.png","alt":{"zh-CN":"从问候、双方姓名、身份问答、礼貌结束到录音回听的双角色对话流程图。","ko-KR":"인사, 두 사람의 이름, 신분 문답, 마무리와 녹음 확인으로 이어지는 두 역할 대화 흐름도입니다."},"width":1600,"height":900}
    ]
    $images$::jsonb)
  loop
    select node.id into node_uuid
    from public.digital_textbook_nodes as node
    join public.digital_textbook_modules as module on module.id = node.module_id
    where module.chapter_id = chapter_uuid
      and node.node_code = media_seed ->> 'nodeCode';

    insert into public.digital_textbook_media_assets (
      node_id, asset_key, media_type, purpose, object_key,
      production_status, alt_text, metadata
    ) values (
      node_uuid,
      media_seed ->> 'key',
      'image',
      media_seed ->> 'purpose',
      media_seed ->> 'objectKey',
      'pending',
      media_seed -> 'alt',
      jsonb_build_object(
        'width', (media_seed ->> 'width')::integer,
        'height', (media_seed ->> 'height')::integer,
        'sourceStatus', '待制作'
      )
    )
    on conflict (node_id, asset_key) do update set
      purpose = excluded.purpose,
      object_key = excluded.object_key,
      production_status = excluded.production_status,
      alt_text = excluded.alt_text,
      metadata = excluded.metadata,
      updated_at = now();
  end loop;

  select node.id into node_uuid
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  where module.chapter_id = chapter_uuid
    and node.node_code = 'people-and-greetings';

  insert into public.digital_textbook_media_assets (
    node_id, asset_key, media_type, purpose, object_key,
    production_status, alt_text, metadata
  )
  select
    node_uuid,
    'chapter-01-vocabulary-' || lpad(item.ordinality::text, 2, '0'),
    'audio',
    '词汇原形点读',
    'korean-level-one/chapter-01/audio/vocabulary/chapter-01-vocabulary-' || lpad(item.ordinality::text, 2, '0') || '.mp3',
    'pending',
    jsonb_build_object('zh-CN', '词汇原形音频待制作', 'ko-KR', '어휘 기본형 음원 제작 대기'),
    jsonb_build_object('audioId', 'chapter-01-vocabulary-' || lpad(item.ordinality::text, 2, '0'), 'script', item.value ->> 'word')
  from jsonb_array_elements($vocab$[
    {"word":"저","collocation":"저는 학생이에요."},{"word":"이름","collocation":"이름이 뭐예요?"},
    {"word":"학생","collocation":"학생이에요."},{"word":"선생님","collocation":"선생님이에요."},
    {"word":"친구","collocation":"친구를 만나요."},{"word":"사람","collocation":"중국 사람이에요."},
    {"word":"만나다","collocation":"처음 만나요."},{"word":"인사하다","collocation":"친구에게 인사해요."},
    {"word":"소개하다","collocation":"자신을 소개해요."},{"word":"한국어","collocation":"한국어를 배워요."},
    {"word":"처음","collocation":"처음 만나요."},{"word":"반갑다","collocation":"만나서 반가워요."}
  ]$vocab$::jsonb) with ordinality as item(value, ordinality)
  on conflict (node_id, asset_key) do update set
    object_key = excluded.object_key,
    production_status = 'pending',
    metadata = excluded.metadata,
    updated_at = now();

  insert into public.digital_textbook_media_assets (
    node_id, asset_key, media_type, purpose, object_key,
    production_status, alt_text, metadata
  )
  select
    node_uuid,
    'chapter-01-vocabulary-collocation-' || lpad(item.ordinality::text, 2, '0'),
    'audio',
    '词汇搭配例句点读',
    'korean-level-one/chapter-01/audio/vocabulary/chapter-01-vocabulary-collocation-' || lpad(item.ordinality::text, 2, '0') || '.mp3',
    'pending',
    jsonb_build_object('zh-CN', '词汇搭配例句音频待制作', 'ko-KR', '어휘 결합 예문 음원 제작 대기'),
    jsonb_build_object('audioId', 'chapter-01-vocabulary-collocation-' || lpad(item.ordinality::text, 2, '0'), 'script', item.value ->> 'collocation')
  from jsonb_array_elements($vocab$[
    {"collocation":"저는 학생이에요."},{"collocation":"이름이 뭐예요?"},{"collocation":"학생이에요."},
    {"collocation":"선생님이에요."},{"collocation":"친구를 만나요."},{"collocation":"중국 사람이에요."},
    {"collocation":"처음 만나요."},{"collocation":"친구에게 인사해요."},{"collocation":"자신을 소개해요."},
    {"collocation":"한국어를 배워요."},{"collocation":"처음 만나요."},{"collocation":"만나서 반가워요."}
  ]$vocab$::jsonb) with ordinality as item(value, ordinality)
  on conflict (node_id, asset_key) do update set
    object_key = excluded.object_key,
    production_status = 'pending',
    metadata = excluded.metadata,
    updated_at = now();

  select node.id into node_uuid
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  where module.chapter_id = chapter_uuid
    and node.node_code = 'topic-and-copula';

  insert into public.digital_textbook_media_assets (
    node_id, asset_key, media_type, purpose, object_key,
    production_status, alt_text, metadata
  )
  select
    node_uuid,
    item.value ->> 'id',
    'audio',
    '语法卡母版与语境复现例句',
    'korean-level-one/chapter-01/audio/grammar/' || (item.value ->> 'id') || '.mp3',
    'pending',
    jsonb_build_object('zh-CN', '语法例句音频待制作', 'ko-KR', '문법 예문 음원 제작 대기'),
    jsonb_build_object('audioId', item.value ->> 'id', 'script', item.value ->> 'script')
  from jsonb_array_elements($grammarAudio$[
    {"id":"chapter-01-grammar-01-example-01","script":"저는 학생이에요."},
    {"id":"chapter-01-grammar-01-example-02","script":"저는 왕밍이에요. 네, 학생이에요."},
    {"id":"chapter-01-grammar-01-example-03","script":"저는 리나예요. 학생이에요."},
    {"id":"chapter-01-grammar-02-example-01","script":"저는 왕밍이에요."},
    {"id":"chapter-01-grammar-02-example-02","script":"지민 씨는 학생이에요?"},
    {"id":"chapter-01-grammar-02-example-03","script":"리나 씨는 중국 사람이에요?"},
    {"id":"chapter-01-grammar-03-example-01","script":"지민 씨는 학생이에요?"},
    {"id":"chapter-01-grammar-03-example-02","script":"왕밍 씨는 중국 사람이에요?"},
    {"id":"chapter-01-grammar-03-example-03","script":"리나 씨는 선생님이에요? 아니요, 학생이에요."}
  ]$grammarAudio$::jsonb) as item(value)
  on conflict (node_id, asset_key) do update set
    object_key = excluded.object_key,
    production_status = 'pending',
    metadata = excluded.metadata,
    updated_at = now();

  select node.id into node_uuid
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  where module.chapter_id = chapter_uuid
    and node.node_code = 'club-first-meeting';

  insert into public.digital_textbook_media_assets (
    node_id, asset_key, media_type, purpose, object_key,
    production_status, alt_text, metadata
  )
  select
    node_uuid,
    item.value ->> 'id',
    'audio',
    item.value ->> 'purpose',
    'korean-level-one/chapter-01/audio/dialogue/' || (item.value ->> 'id') || '.mp3',
    'pending',
    jsonb_build_object('zh-CN', '对话音频待制作', 'ko-KR', '대화 음원 제작 대기'),
    item.value - 'purpose'
  from jsonb_array_elements($dialogueAudio$[
    {"id":"chapter-01-dialogue-main-line-01","purpose":"主对话逐句","script":"안녕하세요? 저는 김지민이에요.","speaker":"F01／지민"},
    {"id":"chapter-01-dialogue-main-line-02","purpose":"主对话逐句","script":"안녕하세요? 저는 왕밍이에요.","speaker":"M01／왕밍"},
    {"id":"chapter-01-dialogue-main-line-03","purpose":"主对话逐句","script":"왕밍 씨는 학생이에요?","speaker":"F01／지민"},
    {"id":"chapter-01-dialogue-main-line-04","purpose":"主对话逐句","script":"네, 학생이에요. 한국어를 배워요.","speaker":"M01／왕밍"},
    {"id":"chapter-01-dialogue-main-line-05","purpose":"主对话逐句","script":"지민 씨는 학생이에요?","speaker":"M01／왕밍"},
    {"id":"chapter-01-dialogue-main-line-06","purpose":"主对话逐句","script":"네, 저도 학생이에요.","speaker":"F01／지민"},
    {"id":"chapter-01-dialogue-main-line-07","purpose":"主对话逐句","script":"만나서 반가워요.","speaker":"M01／왕밍"},
    {"id":"chapter-01-dialogue-main-line-08","purpose":"主对话逐句","script":"저도 만나서 반가워요.","speaker":"F01／지민"},
    {"id":"chapter-01-dialogue-main","purpose":"主对话整段","script":"第 6.1 节完整双角色脚本","speaker":"F01／M01"},
    {"id":"chapter-01-dialogue-alt-line-01","purpose":"第二对话逐句","script":"안녕하세요? 저는 민지예요.","speaker":"F02／민지"},
    {"id":"chapter-01-dialogue-alt-line-02","purpose":"第二对话逐句","script":"안녕하세요? 저는 리나예요.","speaker":"F03／리나"},
    {"id":"chapter-01-dialogue-alt-line-03","purpose":"第二对话逐句","script":"리나 씨는 선생님이에요?","speaker":"F02／민지"},
    {"id":"chapter-01-dialogue-alt-line-04","purpose":"第二对话逐句","script":"아니요, 학생이에요.","speaker":"F03／리나"},
    {"id":"chapter-01-dialogue-alt-line-05","purpose":"第二对话逐句","script":"아, 네. 만나서 반가워요.","speaker":"F02／민지"},
    {"id":"chapter-01-dialogue-alt-line-06","purpose":"第二对话逐句","script":"저도 반가워요.","speaker":"F03／리나"},
    {"id":"chapter-01-dialogue-alt","purpose":"第二对话整段","script":"第 6.2 节完整双角色脚本","speaker":"F02／F03"}
  ]$dialogueAudio$::jsonb) as item(value)
  on conflict (node_id, asset_key) do update set
    purpose = excluded.purpose,
    object_key = excluded.object_key,
    production_status = 'pending',
    metadata = excluded.metadata,
    updated_at = now();

  select node.id, activity.id into node_uuid, activity_uuid
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_activities as activity on activity.node_id = node.id
  where module.chapter_id = chapter_uuid
    and node.node_code = 'listen-and-respond'
    and activity.activity_key = 'listening-identity';

  insert into public.digital_textbook_media_assets (
    node_id, activity_id, asset_key, media_type, purpose, object_key,
    production_status, alt_text, metadata
  ) values
  (
    node_uuid, activity_uuid, 'chapter-01-listening-identity-normal', 'audio',
    '私有听力正常语速',
    'korean-level-one/chapter-01/listening/chapter-01-listening-identity-normal.mp3',
    'pending',
    '{"zh-CN":"正常语速听力待制作","ko-KR":"보통 속도 듣기 음원 제작 대기"}'::jsonb,
    '{"speaker":"F04／수진","scriptVisibility":"private"}'::jsonb
  ),
  (
    node_uuid, activity_uuid, 'chapter-01-listening-identity-slow', 'audio',
    '私有听力慢速',
    'korean-level-one/chapter-01/listening/chapter-01-listening-identity-slow.mp3',
    'pending',
    '{"zh-CN":"慢速听力待制作","ko-KR":"느린 속도 듣기 음원 제작 대기"}'::jsonb,
    '{"speaker":"F04／수진","scriptVisibility":"private"}'::jsonb
  )
  on conflict (node_id, asset_key) do update set
    activity_id = excluded.activity_id,
    purpose = excluded.purpose,
    object_key = excluded.object_key,
    production_status = 'pending',
    alt_text = excluded.alt_text,
    metadata = excluded.metadata,
    updated_at = now();
end;
$seed$;

-- A node is complete only after every required activity on that node has a
-- successful (true) or valid completion-type (null) attempt. Recalculate any
-- trial-version rows so an old one-activity completion cannot unlock the test.
with chapter_nodes as (
  select node.id
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions as version on version.id = chapter.version_id
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
)
update public.digital_textbook_node_progress as progress
set
  status = case
    when (
      select count(distinct activity.id)
      from public.digital_textbook_activities as activity
      join public.digital_textbook_attempts as attempt
        on attempt.activity_id = activity.id
       and attempt.tenant_id = progress.tenant_id
       and attempt.student_id = progress.student_id
       and attempt.version_id = progress.version_id
       and attempt.is_correct is distinct from false
      where activity.node_id = progress.node_id
    ) = (
      select count(*)
      from public.digital_textbook_activities as activity
      where activity.node_id = progress.node_id
    ) then 'completed'
    else 'in_progress'
  end,
  completion_percent = least(
    100,
    round(
      100.0 * (
        select count(distinct activity.id)
        from public.digital_textbook_activities as activity
        join public.digital_textbook_attempts as attempt
          on attempt.activity_id = activity.id
         and attempt.tenant_id = progress.tenant_id
         and attempt.student_id = progress.student_id
         and attempt.version_id = progress.version_id
         and attempt.is_correct is distinct from false
        where activity.node_id = progress.node_id
      ) / greatest(
        (select count(*) from public.digital_textbook_activities as activity where activity.node_id = progress.node_id),
        1
      )
    )::integer
  ),
  updated_at = now()
from chapter_nodes
where progress.node_id = chapter_nodes.id;

create or replace function private.sync_smart_textbook_chapter_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chapter_id uuid;
  v_test_slug text;
  v_student_app_id uuid;
  v_total_nodes integer;
  v_completed_nodes integer;
  v_total_activities integer;
  v_completed_activities integer;
begin
  if new.status <> 'completed' or new.completion_percent < 100 then
    return new;
  end if;

  select chapter.id, test.slug, test.student_app_id
  into v_chapter_id, v_test_slug, v_student_app_id
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
  join public.chapter_tests as test on test.id = chapter.chapter_test_id
  where node.id = new.node_id
    and chapter.version_id = new.version_id
    and test.status = 'published';

  if v_chapter_id is null then
    return new;
  end if;

  select count(*) into v_total_nodes
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  where module.chapter_id = v_chapter_id;

  select count(*) into v_completed_nodes
  from public.digital_textbook_node_progress as progress
  join public.digital_textbook_nodes as node on node.id = progress.node_id
  join public.digital_textbook_modules as module on module.id = node.module_id
  where module.chapter_id = v_chapter_id
    and progress.tenant_id = new.tenant_id
    and progress.student_id = new.student_id
    and progress.version_id = new.version_id
    and progress.status = 'completed'
    and progress.completion_percent = 100;

  if v_total_nodes <> 8 or v_completed_nodes <> v_total_nodes then
    return new;
  end if;

  select count(*) into v_total_activities
  from public.digital_textbook_activities as activity
  join public.digital_textbook_nodes as node on node.id = activity.node_id
  join public.digital_textbook_modules as module on module.id = node.module_id
  where module.chapter_id = v_chapter_id;

  select count(distinct activity.id) into v_completed_activities
  from public.digital_textbook_activities as activity
  join public.digital_textbook_nodes as node on node.id = activity.node_id
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_attempts as attempt
    on attempt.activity_id = activity.id
   and attempt.tenant_id = new.tenant_id
   and attempt.student_id = new.student_id
   and attempt.version_id = new.version_id
   and attempt.is_correct is distinct from false
  where module.chapter_id = v_chapter_id;

  if v_total_activities = 0 or v_completed_activities <> v_total_activities then
    return new;
  end if;

  -- Insert a truthful compatibility row. reading_seconds remains zero because
  -- completing interactive nodes is not the same as ebook reading time.
  insert into public.course_ebook_progress (
    tenant_id, student_id, student_app_id, test_slug,
    current_page, total_pages, progress_percent, read_pages,
    reading_seconds, completion_source, last_read_at, updated_at
  ) values (
    new.tenant_id, new.student_id, v_student_app_id, v_test_slug,
    0, 32, 0, '{}'::integer[],
    0, 'smart_textbook', now(), now()
  )
  on conflict (tenant_id, student_id, test_slug) do nothing;

  -- This update intentionally excludes reading_seconds, so the ebook clamp
  -- trigger cannot turn a smart-textbook completion into invented time.
  update public.course_ebook_progress as progress
  set
    progress_percent = 100,
    completion_source = case
      when progress.completion_source = 'both' then 'both'
      when progress.completion_source = 'ebook'
        and progress.progress_percent >= 100
        and progress.reading_seconds >= 600 then 'both'
      else 'smart_textbook'
    end,
    updated_at = now()
  where progress.tenant_id = new.tenant_id
    and progress.student_id = new.student_id
    and progress.test_slug = v_test_slug;

  return new;
end;
$$;

drop trigger if exists sync_smart_textbook_chapter_completion
  on public.digital_textbook_node_progress;
create trigger sync_smart_textbook_chapter_completion
after insert or update of status, completion_percent
on public.digital_textbook_node_progress
for each row execute function private.sync_smart_textbook_chapter_completion();

comment on function private.sync_smart_textbook_chapter_completion() is
  'When and only when all eight smart-textbook nodes and every required activity are complete, records a smart_textbook compatibility completion without fabricating ebook reading time.';

-- The trigger did not exist while the migration recalculated legacy node
-- rows above. Re-fire it for fully completed chapter-one rows so students who
-- already supplied every activity completion are not left behind.
with completed_chapter_rows as (
  select progress.tenant_id, progress.student_id, progress.node_id, progress.version_id
  from public.digital_textbook_node_progress as progress
  join public.digital_textbook_nodes as node on node.id = progress.node_id
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions as version on version.id = chapter.version_id
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and progress.status = 'completed'
    and progress.completion_percent = 100
)
update public.digital_textbook_node_progress as progress
set
  status = progress.status,
  completion_percent = progress.completion_percent
from completed_chapter_rows as completed
where progress.tenant_id = completed.tenant_id
  and progress.student_id = completed.student_id
  and progress.node_id = completed.node_id
  and progress.version_id = completed.version_id;

-- Keep the database guard aligned with the application gate. The prior-test
-- sequence remains unchanged; only the current-chapter completion evidence is unified.
create or replace function private.enforce_chapter_test_learning_prerequisites()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_test public.chapter_tests%rowtype;
  v_tenant_id uuid := private.current_tenant_id();
begin
  if auth.uid() is null or auth.role() = 'service_role' then
    return new;
  end if;

  if new.student_id is distinct from auth.uid()
    or new.tenant_id is distinct from v_tenant_id then
    raise exception '不能为其他学生或租户提交章节测试';
  end if;

  select * into v_test
  from public.chapter_tests
  where id = new.test_id
    and slug = new.test_slug
    and status = 'published';

  if not found then
    raise exception '没有找到这份章节测试';
  end if;

  if v_test.student_app_id is distinct from
    '10000000-0000-4000-8000-000000000001'::uuid then
    raise exception '这份测试不属于韩语学习应用';
  end if;

  if not public.student_feature_allowed('korean_course') then
    raise exception '当前会员档位没有权限提交这项测试';
  end if;

  if not exists (
    select 1
    from public.course_ebook_progress as progress
    where progress.tenant_id = new.tenant_id
      and progress.student_id = new.student_id
      and progress.student_app_id = v_test.student_app_id
      and progress.test_slug = v_test.slug
      and (
        progress.completion_source in ('smart_textbook', 'both')
        or (
          progress.progress_percent >= 100
          and progress.reading_seconds >= 600
        )
      )
  ) then
    raise exception '请先完成本章电子书或八个智能教材节点，再开始章节测试';
  end if;

  if exists (
    select 1
    from public.chapter_tests as prior_test
    where prior_test.student_app_id = v_test.student_app_id
      and prior_test.course_key = v_test.course_key
      and prior_test.status = 'published'
      and prior_test.chapter_number < v_test.chapter_number
      and not exists (
        select 1
        from public.chapter_test_attempts as prior_attempt
        where prior_attempt.tenant_id = new.tenant_id
          and prior_attempt.student_id = new.student_id
          and prior_attempt.test_id = prior_test.id
          and prior_attempt.passed
      )
  ) then
    raise exception '请先通过前面章节的测试，再开始本章测试';
  end if;

  return new;
end;
$$;

comment on function private.enforce_chapter_test_learning_prerequisites() is
  'Korean chapter-test guard: current tenant/student/app/tier, prior tests, and either verified ebook time or all eight smart-textbook nodes.';

commit;
