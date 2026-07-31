begin;

create table if not exists public.course_tests (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  course_key text not null,
  chapter_number integer not null check (chapter_number > 0),
  title text not null,
  korean_title text not null default '',
  description text not null default '',
  duration_minutes integer not null default 10 check (duration_minutes between 1 and 180),
  passing_score integer not null default 80 check (passing_score between 1 and 100),
  skills jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_test_questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.course_tests(id) on delete cascade,
  question_key text not null,
  prompt text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) >= 2),
  correct_option integer not null check (correct_option >= 0),
  explanation text not null,
  skill text not null,
  sort_order integer not null check (sort_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (test_id, question_key),
  unique (test_id, sort_order),
  constraint course_test_questions_answer_in_options_check
    check (correct_option < jsonb_array_length(options))
);

alter table public.course_tests enable row level security;
alter table public.course_test_questions enable row level security;

-- 学生不能直接读取题库表，尤其不能读取 correct_option。
-- Next.js 服务端使用 service_role 读取并在发送给浏览器前移除答案字段。
revoke all on public.course_tests from anon, authenticated;
revoke all on public.course_test_questions from anon, authenticated;
grant select, insert, update, delete on public.course_tests to service_role;
grant select, insert, update, delete on public.course_test_questions to service_role;

insert into public.course_tests (
  slug, course_key, chapter_number, title, korean_title, description,
  duration_minutes, passing_score, skills, version, status
)
values
  (
    'meet-hangul', 'hangul-introduction', 1, '认识韩文', '한글 알아보기',
    '检查你是否理解韩文的设计原理、音节方块和最基础的拼合规则。',
    8, 80,
    '{"concept":"韩文基本概念","structure":"音节方块结构","assembly":"基础字母拼合"}'::jsonb,
    1, 'published'
  ),
  (
    'vowels-and-consonants', 'hangul-introduction', 2, '元音和辅音', '모음과 자음',
    '检查字母辨认、基础音与送气音/紧音的区别，以及音节拼合能力。',
    10, 80,
    '{"recognition":"字母辨认","concept":"发音类别","assembly":"音节拼合"}'::jsonb,
    1, 'published'
  ),
  (
    'batchim-and-reading', 'hangul-introduction', 3, '收音与拼读', '받침과 읽기',
    '检查收音位置、七大代表音和带收音音节的正确拆分与拼读方法。',
    10, 80,
    '{"batchim":"收音规则","reading":"音节拼读","strategy":"拼读方法"}'::jsonb,
    1, 'published'
  ),
  (
    'pronunciation-rules-and-reading', 'hangul-introduction', 4,
    '发音规则与实用拼读', '발음 규칙과 읽기',
    '检查连音、紧音化、激音化、鼻音化、流音化及实际读音判断步骤。',
    12, 80,
    '{"rules":"音变规则","reading":"实际读音","strategy":"判断流程"}'::jsonb,
    1, 'published'
  )
on conflict (slug) do update set
  course_key = excluded.course_key,
  chapter_number = excluded.chapter_number,
  title = excluded.title,
  korean_title = excluded.korean_title,
  description = excluded.description,
  duration_minutes = excluded.duration_minutes,
  passing_score = excluded.passing_score,
  skills = excluded.skills,
  version = excluded.version,
  status = excluded.status,
  updated_at = now();

delete from public.course_test_questions
where test_id in (
  select id from public.course_tests
  where course_key = 'hangul-introduction'
);

insert into public.course_test_questions
  (test_id, question_key, prompt, options, correct_option, explanation, skill, sort_order)
values
  ((select id from public.course_tests where slug = 'meet-hangul'), 'c1-q1',
   '韩文音节方块至少由哪两类字母组成？', '["辅音和元音","汉字和元音","数字和辅音"]', 0,
   '韩文音节的基本骨架是“开头辅音＋元音”，有时还会在底部加入收音。', 'concept', 1),
  ((select id from public.course_tests where slug = 'meet-hangul'), 'c1-q2',
   '一个完整的韩文方块通常表示什么？', '["一个音节","一个句子","一个标点"]', 0,
   '判断韩语音节数量时先数方块，而不是数方块内部的字母。', 'structure', 2),
  ((select id from public.course_tests where slug = 'meet-hangul'), 'c1-q3',
   '《训民正音》创制韩文的主要目的是什么？', '["方便百姓记录语言","代替所有外语","只供王室使用"]', 0,
   '韩文被设计为容易学、容易写、容易读，让普通人也能记录自己的语言。', 'concept', 3),
  ((select id from public.course_tests where slug = 'meet-hangul'), 'c1-q4',
   '韩文基础辅音的字形主要模仿什么？', '["发音器官","动物形状","数字笔画"]', 0,
   'ㄱ、ㄴ、ㅁ、ㅇ 等基础辅音会提示舌头、嘴唇或喉咙的发音动作。', 'concept', 4),
  ((select id from public.course_tests where slug = 'meet-hangul'), 'c1-q5',
   '竖向元音“ㅏ”通常放在开头辅音的什么位置？', '["右侧","下方","顶部"]', 0,
   '竖向元音采用左右结构：辅音在左，元音在右。', 'structure', 5),
  ((select id from public.course_tests where slug = 'meet-hangul'), 'c1-q6',
   '横向元音“ㅗ”通常放在开头辅音的什么位置？', '["右侧","下方","左侧"]', 1,
   '横向元音采用上下结构：辅音在上，元音在下。', 'structure', 6),
  ((select id from public.course_tests where slug = 'meet-hangul'), 'c1-q7',
   '“ㄱ＋ㅏ”组合成哪个音节？', '["나","고","가"]', 2,
   'ㄱ 与竖向元音 ㅏ 左右组合，形成 가。', 'assembly', 7),
  ((select id from public.course_tests where slug = 'meet-hangul'), 'c1-q8',
   '“ㅁ＋ㅗ”组合成哪个音节？', '["마","모","무"]', 1,
   'ㅗ 是横向元音，放在 ㅁ 下方，形成 모。', 'assembly', 8),
  ((select id from public.course_tests where slug = 'meet-hangul'), 'c1-q9',
   '辅音“ㅇ”放在音节开头时通常怎样发音？', '["读 ng","不发音","读 m"]', 1,
   'ㅇ 在开头只承担元音占位作用；放在收音位置时才读 ng。', 'assembly', 9),
  ((select id from public.course_tests where slug = 'meet-hangul'), 'c1-q10',
   '收音应该放在音节方块的什么位置？', '["顶部","底部","右侧"]', 1,
   '收音是音节末尾的辅音，写在同一个音节方块的底部。', 'structure', 10),

  ((select id from public.course_tests where slug = 'vowels-and-consonants'), 'c2-q1',
   '下面哪一个是元音？', '["ㄱ","ㅏ","ㅁ"]', 1,
   'ㅏ 是基本元音；ㄱ 和 ㅁ 都是辅音。', 'recognition', 1),
  ((select id from public.course_tests where slug = 'vowels-and-consonants'), 'c2-q2',
   '下面哪一个是复合元音？', '["ㅏ","ㅘ","ㄴ"]', 1,
   'ㅘ 由 ㅗ 与 ㅏ 结合，发音时在一个音节内顺滑完成。', 'recognition', 2),
  ((select id from public.course_tests where slug = 'vowels-and-consonants'), 'c2-q3',
   '下面哪一个是基础辅音？', '["ㅁ","ㅘ","ㅏ"]', 0,
   'ㅁ 是基础辅音，发音时双唇闭合。', 'recognition', 3),
  ((select id from public.course_tests where slug = 'vowels-and-consonants'), 'c2-q4',
   '下面哪一个是送气音？', '["ㅋ","ㄴ","ㅆ"]', 0,
   'ㅋ 是 ㄱ 对应的送气音，发音时有明显气流。', 'concept', 4),
  ((select id from public.course_tests where slug = 'vowels-and-consonants'), 'c2-q5',
   '下面哪一个是紧音？', '["ㄱ","ㅋ","ㄲ"]', 2,
   'ㄲ 是紧音，动作紧而短促，不能把它读成明显送气的 ㅋ。', 'concept', 5),
  ((select id from public.course_tests where slug = 'vowels-and-consonants'), 'c2-q6',
   '哪一组是基础音与送气音的对比？', '["가—카","가—까","아—야"]', 0,
   'ㄱ—ㅋ 是基础音与送气音的对应关系；ㄱ—ㄲ 是基础音与紧音。', 'concept', 6),
  ((select id from public.course_tests where slug = 'vowels-and-consonants'), 'c2-q7',
   '“ㅇ”放在音节末尾时通常读什么？', '["不发音","ng","n"]', 1,
   'ㅇ 在开头不发音，在收音位置读 ng。', 'recognition', 7),
  ((select id from public.course_tests where slug = 'vowels-and-consonants'), 'c2-q8',
   '“ㄱ＋ㅏ”组合成哪个音节？', '["나","가","고"]', 1,
   '辅音 ㄱ 与竖向元音 ㅏ 组合成 가。', 'assembly', 8),
  ((select id from public.course_tests where slug = 'vowels-and-consonants'), 'c2-q9',
   '“ㅁ＋ㅜ”组合成哪个音节？', '["마","모","무"]', 2,
   '横向元音 ㅜ 放在 ㅁ 下方，组成 무。', 'assembly', 9),
  ((select id from public.course_tests where slug = 'vowels-and-consonants'), 'c2-q10',
   '看到横向元音时，正确的音节布局是什么？',
   '["辅音在左、元音在右","辅音在上、元音在下","元音在上、辅音在下"]', 1,
   'ㅗ、ㅜ、ㅡ 等横向元音使用上下结构。', 'assembly', 10),

  ((select id from public.course_tests where slug = 'batchim-and-reading'), 'c3-q1',
   '收音位于音节方块的什么位置？', '["顶部","底部","右侧"]', 1,
   '音节底部的辅音负责把声音收住，因此称为收音。', 'batchim', 1),
  ((select id from public.course_tests where slug = 'batchim-and-reading'), 'c3-q2',
   '下面哪个音节带有“ㄴ”收音？', '["가","한","모"]', 1,
   '한 由 ㅎ＋ㅏ＋ㄴ 组成，底部的 ㄴ 是收音。', 'batchim', 2),
  ((select id from public.course_tests where slug = 'batchim-and-reading'), 'c3-q3',
   '韩语收音通常归纳为几个代表音？', '["5 个","7 个","10 个"]', 1,
   '常用的七大代表收音是 ㄱ、ㄴ、ㄷ、ㄹ、ㅁ、ㅂ、ㅇ。', 'batchim', 3),
  ((select id from public.course_tests where slug = 'batchim-and-reading'), 'c3-q4',
   '“옷”末尾的 ㅅ 通常归到哪类代表音？', '["ㄱ 类","ㄷ 类","ㅂ 类"]', 1,
   'ㅅ 在收音位置通常归入 ㄷ 类，以短促、不爆破的 t 类动作收尾。', 'batchim', 4),
  ((select id from public.course_tests where slug = 'batchim-and-reading'), 'c3-q5',
   '哪个收音读作 ng？', '["ㄴ","ㅁ","ㅇ"]', 2,
   'ㅇ 在音节底部读作 ng 鼻音。', 'batchim', 5),
  ((select id from public.course_tests where slug = 'batchim-and-reading'), 'c3-q6',
   '“ㅂ＋ㅏ＋ㅂ”组成哪个音节？', '["밤","밥","반"]', 1,
   '开头 ㅂ、元音 ㅏ、收音 ㅂ 合在一个方块中，组成 밥。', 'reading', 6),
  ((select id from public.course_tests where slug = 'batchim-and-reading'), 'c3-q7',
   '“문”中的收音是哪一个字母？', '["ㅁ","ㅜ","ㄴ"]', 2,
   '문 的拼读顺序是 ㅁ→ㅜ→ㄴ，底部 ㄴ 是收音。', 'reading', 7),
  ((select id from public.course_tests where slug = 'batchim-and-reading'), 'c3-q8',
   'ㄱ 类收音主要在哪里收住声音？', '["舌根","双唇","鼻腔"]', 0,
   'ㄱ 类收音在舌根位置停止，不把末尾气流爆破出来。', 'batchim', 8),
  ((select id from public.course_tests where slug = 'batchim-and-reading'), 'c3-q9',
   '“각”内部有三个字母，它读作几个音节？', '["一个音节","两个音节","三个音节"]', 0,
   '一个方块就是一个音节；底部 ㄱ 只是给 가 增加收尾动作。', 'reading', 9),
  ((select id from public.course_tests where slug = 'batchim-and-reading'), 'c3-q10',
   '初学带收音音节时，最可靠的拼读顺序是什么？',
   '["直接猜整个词","开头辅音→元音→底部收音","只读元音并忽略收音"]', 1,
   '先按位置拆开，再按“开头辅音→元音→收音”合回一个声音。', 'strategy', 10),

  ((select id from public.course_tests where slug = 'pronunciation-rules-and-reading'), 'c4-q1',
   '“한국어”的实际读音是哪一个？', '["[한국어]","[한구거]","[한구커]"]', 1,
   '국 的 ㄱ 收音移到后一音节元音前，发生连音：국·어→구·거。', 'reading', 1),
  ((select id from public.course_tests where slug = 'pronunciation-rules-and-reading'), 'c4-q2',
   '“학교”中发生了什么主要变化？', '["紧音化","鼻音化","流音化"]', 0,
   'ㄱ 收音后面的平音 ㄱ 变为紧音 ㄲ，读作 [학꾜]。', 'rules', 2),
  ((select id from public.course_tests where slug = 'pronunciation-rules-and-reading'), 'c4-q3',
   'ㅎ 与 ㄷ 相遇通常形成哪个激音？', '["ㄸ","ㅌ","ㅊ"]', 1,
   'ㅎ 提供送气，使 ㄷ 变成对应的激音 ㅌ，例如 좋다 [조타]。', 'rules', 3),
  ((select id from public.course_tests where slug = 'pronunciation-rules-and-reading'), 'c4-q4',
   '“국물”中 ㄱ 为什么读成 ㅇ？', '["连音","鼻音化","腭化"]', 1,
   'ㄱ 类收音遇到鼻音 ㅁ 时变为同位置的鼻音 ㅇ，读作 [궁물]。', 'rules', 4),
  ((select id from public.course_tests where slug = 'pronunciation-rules-and-reading'), 'c4-q5',
   '“연락”的实际读音是哪一个？', '["[연락]","[열락]","[연낙]"]', 1,
   'ㄴ 与 ㄹ 相遇时常统一为 ㄹ＋ㄹ，发生流音化。', 'reading', 5),
  ((select id from public.course_tests where slug = 'pronunciation-rules-and-reading'), 'c4-q6',
   '“같이”中发生的规则是什么？', '["腭化","ㄴ 添加","ㅎ 脱落"]', 0,
   'ㄷ、ㅌ 收音遇到 이 时会变为 ㅈ、ㅊ，같이 读作 [가치]。', 'rules', 6),
  ((select id from public.course_tests where slug = 'pronunciation-rules-and-reading'), 'c4-q7',
   '分析“꽃잎”时，第一步需要做什么？', '["添加 ㄴ","直接变成紧音","删除收音"]', 0,
   '先在 이 前添加 ㄴ，再继续处理代表收音与鼻音化，最终读作 [꼰닙]。', 'strategy', 7),
  ((select id from public.course_tests where slug = 'pronunciation-rules-and-reading'), 'c4-q8',
   '“좋아요”中的 ㅎ 通常怎样处理？', '["变成紧音","弱化或脱落","变成 ㄴ"]', 1,
   'ㅎ 位于元音环境中会弱化，좋아요 常读作 [조아요]。', 'rules', 8),
  ((select id from public.course_tests where slug = 'pronunciation-rules-and-reading'), 'c4-q9',
   '“감사합니다”中 ㅂ＋ㄴ 的实际变化是什么？', '["ㅂ＋ㄹ","ㅁ＋ㄴ","ㅍ＋ㄴ"]', 1,
   'ㅂ 类收音遇到鼻音 ㄴ 时变成 ㅁ，读作 [감사함니다]。', 'reading', 9),
  ((select id from public.course_tests where slug = 'pronunciation-rules-and-reading'), 'c4-q10',
   '遇到陌生韩语词时，最可靠的第一步是什么？',
   '["直接猜整体读音","划分音节并找出收音","只看中文意思"]', 1,
   '先“分音节、找收音”，再看后一音节并选择规则，能够把陌生词也按步骤读出来。', 'strategy', 10);

alter table public.course_test_attempts
  add column if not exists test_id uuid references public.course_tests(id) on delete restrict;

update public.course_test_attempts as attempt
set test_id = test.id
from public.course_tests as test
where attempt.test_slug = test.slug
  and attempt.test_id is null;

create index if not exists course_test_attempts_test_id_idx
  on public.course_test_attempts(test_id);

comment on table public.course_tests is
  '课程形成性测试配置。题库仅允许后端 service_role 读取。';
comment on table public.course_test_questions is
  '课程测试题目、选项、正确答案与解析。学生端无直接读取权限。';

commit;
