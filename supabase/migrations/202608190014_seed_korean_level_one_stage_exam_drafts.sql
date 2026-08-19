begin;

-- 远程项目曾在本迁移的前置迁移 008/009 还是旧版内容时完成登记：
-- 008 未创建 audio_status，009 也未创建本迁移复用的集中质检函数。
-- 在尚未应用的本迁移中前向补齐这两个缺口，避免改写既有迁移历史。
alter table public.assessment_paper_questions
  add column if not exists audio_status text not null default 'not_applicable';

alter table public.assessment_paper_questions
  drop constraint if exists assessment_paper_questions_audio_status_check;

alter table public.assessment_paper_questions
  add constraint assessment_paper_questions_audio_status_check
    check (audio_status in ('not_applicable', 'pending', 'temporary', 'formal'));

comment on column public.assessment_paper_questions.audio_status is
  '听力快照的音频状态；temporary/pending 不得被误认为正式录音。';

-- 与当前 009 中的权威实现保持一致。新环境中这是幂等替换；发生历史漂移的
-- 远程环境则由此补建，供下面的阶段卷质检直接复用。
create or replace function private.assessment_paper_release_issues(
  p_paper_id uuid
)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_paper public.assessment_papers%rowtype;
  v_issues text[] := array[]::text[];
begin
  select * into v_paper
  from public.assessment_papers
  where id = p_paper_id;
  if not found then
    return array['标准试卷不存在'];
  end if;

  if v_paper.question_count < 1 then
    v_issues := array_append(v_issues, '试卷没有题目');
  end if;
  if v_paper.duration_minutes is null then
    v_issues := array_append(v_issues, '未设置考试时长');
  end if;
  if v_paper.passing_score is null then
    v_issues := array_append(v_issues, '未设置及格分');
  end if;
  if v_paper.allow_resubmission is null then
    v_issues := array_append(v_issues, '未设置重复提交规则');
  end if;
  if exists (
    select 1
    from public.assessment_paper_questions as question
    where question.paper_id = p_paper_id
    group by lower(btrim(question.prompt)), lower(btrim(question.stimulus_text))
    having count(*) > 1
  ) then
    v_issues := array_append(v_issues, '存在重复题干');
  end if;
  if exists (
    select 1
    from public.assessment_paper_questions as question
    left join public.assessment_paper_question_keys as answer_key
      on answer_key.question_id = question.id
    where question.paper_id = p_paper_id
      and (
        nullif(btrim(question.prompt), '') is null
        or question.points <= 0
        or answer_key.question_id is null
        or nullif(btrim(answer_key.explanation), '') is null
        or question.skill not in (
          'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
        )
      )
  ) then
    v_issues := array_append(v_issues, '存在题干、解析、分值或能力分类未完成的题目');
  end if;
  if (
    select count(*) from public.assessment_paper_questions as question
    where question.paper_id = p_paper_id
  ) <> v_paper.question_count then
    v_issues := array_append(v_issues, '试卷题量与题目快照不一致');
  end if;
  if (
    select coalesce(sum(question.points), 0)
    from public.assessment_paper_questions as question
    where question.paper_id = p_paper_id
  ) <> v_paper.total_points then
    v_issues := array_append(v_issues, '试卷总分与题目快照不一致');
  end if;
  if exists (
    select 1
    from public.assessment_paper_questions as question
    left join public.assessment_paper_question_keys as answer_key
      on answer_key.question_id = question.id
    where question.paper_id = p_paper_id
      and question.auto_graded
      and (
        nullif(btrim(answer_key.correct_answer), '') is null
        or nullif(btrim(answer_key.explanation), '') is null
        or jsonb_array_length(question.options) < 2
        or not question.options @> jsonb_build_array(answer_key.correct_answer)
      )
  ) then
    v_issues := array_append(
      v_issues, '客观题存在正确答案、选项或解析不完整的情况'
    );
  end if;

  if v_paper.paper_type = 'exam'
    and v_paper.paper_code ~ '^EX-K1-(0[1-9]|1[0-6])-V[0-9]+$' then
    if v_paper.total_points <> 100 then
      v_issues := array_append(v_issues, '正式章节考试总分必须等于100分');
    end if;
    if (
      select count(distinct question.skill)
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill in (
          'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
        )
    ) <> 6 then
      v_issues := array_append(v_issues, '单词、语法、听力、口语、阅读、写作六项不齐全');
    end if;
    if exists (
      select required.skill
      from (values
        ('vocabulary', 15::numeric), ('grammar', 20::numeric),
        ('listening', 15::numeric), ('speaking', 15::numeric),
        ('reading', 20::numeric), ('writing', 15::numeric)
      ) as required(skill, points)
      left join (
        select question.skill, sum(question.points) as points
        from public.assessment_paper_questions as question
        where question.paper_id = p_paper_id
        group by question.skill
      ) as actual using (skill)
      where coalesce(actual.points, 0) <> required.points
    ) then
      v_issues := array_append(
        v_issues, '六项分值必须为单词15、语法20、听力15、口语15、阅读20、写作15'
      );
    end if;
    if exists (
      select 1
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill in ('vocabulary', 'grammar', 'listening', 'reading')
        and not question.auto_graded
    ) then
      v_issues := array_append(v_issues, '单词、语法、听力或阅读客观题未配置自动判分');
    end if;
    if exists (
      select 1
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill in ('speaking', 'writing')
        and question.auto_graded
    ) then
      v_issues := array_append(v_issues, '口语和写作必须配置为人工批改');
    end if;
    if exists (
      select 1
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill = 'speaking'
        and question.question_type <> 'audio_recording'
    ) or exists (
      select 1
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill = 'writing'
        and question.question_type <> 'long_text'
    ) then
      v_issues := array_append(v_issues, '口语录音题或写作长文本题的作答方式不正确');
    end if;
    if exists (
      select 1
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill = 'listening'
        and (
          nullif(btrim(question.stimulus_text), '') is null
          or question.audio_status not in ('pending', 'temporary', 'formal')
        )
    ) then
      v_issues := array_append(v_issues, '听力题缺少听力文本或有效音频状态');
    end if;
  elsif v_paper.paper_type = 'homework' then
    if (
      select count(distinct question.skill)
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill in (
          'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
        )
    ) <> 6 then
      v_issues := array_append(v_issues, '章节作业的词汇、语法、听说读写六项内容不完整');
    end if;
    if exists (
      select 1
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill = 'listening'
        and nullif(btrim(question.stimulus_text), '') is null
    ) then
      v_issues := array_append(v_issues, '章节作业的听力题缺少韩语听力材料');
    end if;
  end if;

  return v_issues;
end;
$$;

-- 每四章一套阶段考试。阶段卷只保存为草稿；正式录音和平台人工审核完成前不得发布。
-- 每套严格采用 12/8/4/2/8/2 的题量和 15/20/15/15/20/15 的六项分值。
do $migration$
declare
  v_owner_id uuid;
  v_stage jsonb;
  v_item jsonb;
  v_paper_id uuid;
  v_question_id uuid;
  v_source_test_id uuid;
  v_sort_order integer;
  v_skill text;
  v_question_type text;
  v_points numeric(8,2);
  v_options jsonb;
  v_answer text;
  v_issues text[];
  v_seed jsonb := $stage_seed$
[
  {
    "stage":1,
    "code":"EX-K1-ST01-V1",
    "title":"韩国语一级第一阶段考试（第1—4章）",
    "description":"综合检查问候与身份、物品指示、日常活动及校园位置；重点辨析은/는与이/가、에与에서、이/그/저及있다/없다。听力使用临时语音。",
    "duration":65,
    "vocabulary":[
      ["初次见面时，哪一句最自然？",["안녕하세요?","안녕히 가세요.","잘 먹었습니다.","여보세요."],"안녕하세요?","안녕하세요?用于见面问候，其余分别用于告别、餐后致谢或接电话。"],
      ["请选择与‘学生’对应的韩语。",["학생","선생님","회사원","의사"],"학생","학생表示学生，要与教师、公司职员和医生区分。"],
      ["说话人手边的书应使用哪一表达？",["이 책","그 책","저 책","어느 책"],"이 책","이指靠近说话人的对象，因此使用이 책。"],
      ["‘教室里有电脑’中的‘电脑’是？",["컴퓨터","우산","지갑","시계"],"컴퓨터","컴퓨터是电脑；其余是雨伞、钱包和钟表。"],
      ["与‘每天学习韩语’最匹配的动词是？",["공부하다","만나다","사다","자다"],"공부하다","공부하다表示学习，能与한국어를自然搭配。"],
      ["‘在图书馆看书’中的场所是？",["도서관","식당","은행","병원"],"도서관","도서관是图书馆，是看书这一动作发生的典型场所。"],
      ["表示‘经常’的频率副词是？",["자주","안","지금","아주"],"자주","자주表示经常；안是否定副词。"],
      ["校园问路时，‘洗手间’是？",["화장실","교실","사무실","운동장"],"화장실","화장실表示洗手间，其他选项是教室、办公室和操场。"],
      ["‘书在桌子上面’中的‘上面’是？",["위","아래","앞","뒤"],"위","위表示上面，与아래、앞、뒤形成方位对比。"],
      ["请选择正确搭配。",["친구를 만나다","학교를 있다","책에 읽다","식당을 가다"],"친구를 만나다","만나다的对象用을/를；存在、阅读场所和移动目的地的助词不同。"],
      ["想确认某物是什么，应使用哪个疑问词？",["무엇","누구","어디","언제"],"무엇","무엇询问事物；누구、어디、언제分别询问人物、地点、时间。"],
      ["‘银行在学校旁边’中的‘旁边’是？",["옆","안","밖","사이"],"옆","옆表示旁边；안、밖、사이分别表示里面、外面、之间。"]
    ],
    "grammar":[
      ["저___ 학생이에요. 请选择主题助词。",["는","가","를","에"],"는","저后用主题助词는，介绍自己的身份。"],
      ["교실___ 컴퓨터가 있어요. 请选择存在地点助词。",["에","에서","를","와"],"에","있다/없다的存在地点使用에。"],
      ["저는 도서관___ 책을 읽어요. 请选择动作场所助词。",["에서","에","가","도"],"에서","阅读动作发生的场所使用에서，与存在地点에区分。"],
      ["가: 이것은 사전이에요? 나: 아니요, 사전___.",["이 아니에요","가 없어요","을 안 해요","에 있어요"],"이 아니에요","名词否定使用이/가 아니에요；사전有收音，使用이 아니에요。"],
      ["민수 씨___ 학교에 가요. 请选择突出主语的助词。",["가","는","를","에서"],"가","在回答谁去学校时，用이/가突出主语；민수 씨后接가。"],
      ["‘我不喝咖啡’最自然的是？",["저는 커피를 안 마셔요.","저는 커피가 없어요.","저는 커피에 마셔요.","저는 커피를 아니에요."],"저는 커피를 안 마셔요.","动作否定把안放在动词前；其余混用了存在、地点或名词否定。"],
      ["老师旁边有学生。请选择正确句子。",["선생님 옆에 학생이 있어요.","선생님 옆에서 학생을 있어요.","선생님 옆을 학생이 가요.","선생님 옆에 학생은 읽어요."],"선생님 옆에 학생이 있어요.","方位名词后接에表示存在地点，存在主体用이/가。"],
      ["请把‘那支笔也请给我’补充完整：그 펜___ 주세요.",["도","만","에서","에게"],"도","도表示追加‘也’，并与주세요礼貌请求结合。"]
    ],
    "listeningStimulus":"유나: 안녕하세요? 저는 유나예요. 한국어를 공부해요.\n민수: 안녕하세요? 저는 민수예요. 유나 씨, 이 가방은 유나 씨 가방이에요?\n유나: 아니요, 제 가방이 아니에요. 제 가방은 저 의자 옆에 있어요.\n민수: 아, 그래요? 그럼 이 가방은 누구 가방이에요?\n유나: 수진 씨 가방이에요. 수진 씨는 지금 도서관에서 책을 읽어요.\n민수: 도서관이 어디에 있어요?\n유나: 학생 식당 앞에 있어요. 같이 갈까요?\n민수: 네, 좋아요.",
    "listening":[
      ["两人最先谈到的物品是什么？",["가방","책","우산","컴퓨터"],"가방","对话先询问이 가방，因此物品是书包。"],
      ["유나的书包在哪里？",["의자 옆","도서관 안","식당 앞","교실 위"],"의자 옆","유나明确说제 가방은 저 의자 옆에 있어요。"],
      ["수진现在在做什么？",["도서관에서 책을 읽어요.","식당에서 밥을 먹어요.","교실에서 공부해요.","학교에 가요."],"도서관에서 책을 읽어요.","对话直接说明수진在图书馆看书。"],
      ["图书馆在什么地方？",["학생 식당 앞","의자 옆","학교 밖","교실 뒤"],"학생 식당 앞","유나回答图书馆在学生食堂前面。"]
    ],
    "speaking":[
      ["你在新班级遇到同学。录制45—60秒双角色对话：互相问候并介绍姓名、国籍或身份，再询问并确认桌上两件物品是谁的。至少使用은/는、이/가、이/그/저和아니다。","任务综合第1—2章身份与物品场景。按发音4分、流利度4分、语法词汇4分、任务完成度3分人工评分。"],
      ["新同学找不到图书馆。录制45—60秒校园引导对话：说明当前位置、图书馆方位、沿途一个地点，并说到达后要做的活动。至少对比使用에和에서。","任务综合第3—4章活动与位置表达。按统一口语四维量规人工评分。"]
    ],
    "readingStimulus":"[新生校园留言]\n안녕하세요? 저는 왕리예요. 중국 사람이고 한국어반 학생이에요. 저는 아침에 교실에서 한국어를 공부해요. 점심에는 학생 식당에서 밥을 먹어요. 오후에는 도서관에서 책을 읽어요. 도서관은 학생 식당 앞에 있어요. 제 우산은 도서관 안 책상 아래에 있어요. 이 우산은 파란색이에요. 비가 오면 우산을 가져가세요.",
    "reading":[
      ["왕리是什么身份？",["한국어반 학생","도서관 직원","식당 선생님","회사원"],"한국어반 학생","首段明确说明왕리是韩语班学生。"],
      ["왕리早上在哪里学习？",["교실","도서관","학생 식당","운동장"],"교실","文中说아침에 교실에서 한국어를 공부해요。"],
      ["午饭后进行的活动是？",["책을 읽어요.","밥을 먹어요.","친구를 만나요.","집에 가요."],"책을 읽어요.","下午活动是到图书馆看书。"],
      ["图书馆在哪里？",["학생 식당 앞","교실 옆","학교 밖","운동장 뒤"],"학생 식당 앞","材料明确给出도서관은 학생 식당 앞에 있어요。"],
      ["雨伞位于哪里？",["책상 아래","의자 위","가방 안","문 앞"],"책상 아래","文中说雨伞在图书馆内的桌子下面。"],
      ["雨伞是什么颜色？",["파란색","빨간색","검은색","흰색"],"파란색","이 우산은 파란색이에요直接给出颜色。"],
      ["哪一句正确概括了材料中的助词使用？",["动作场所用에서，存在地点用에。","动作场所和存在地点都只用를。","移动目的地只能用에서。","身份名词后必须用에。"],"动作场所用에서，存在地点用에。","공부해요/먹어요/읽어요的场所用에서，있어요的地点用에。"],
      ["这则留言最后的主要作用是什么？",["提醒下雨时取伞","邀请去看电影","介绍商品价格","说明周末天气"],"提醒下雨时取伞","末句비가 오면 우산을 가져가세요用于提醒取伞。"]
    ],
    "writing":[
      ["写一段6—8句的自我与校园日常介绍。必须包含姓名或身份、两项日常活动、两个不同场所、一个频率表达，并正确对比使用에和에서。","内容完整4分、语法准确4分、词汇3分、结构表达2分、拼写格式2分；综合第1、3、4章人工评分。"],
      ["写一则5—7句的失物寻找留言：说明物品名称与特征、它原来的位置、现在是否存在，并用이/그/저至少一次请求同学帮助。","按统一写作五维量规人工评分；综合第2章物品指示与第4章方位存在表达。"]
    ]
  },
  {
    "stage":2,"code":"EX-K1-ST02-V1","title":"韩国语一级第二阶段考试（第5—8章）","description":"综合检查周末经历、购物数量、天气预报和活动邀约；重点辨析过去时与当前建议、-고与-지만、ㅂ/ㄷ不规则、正式体与日常礼貌体。听力使用临时语音。","duration":70,
    "vocabulary":[
      ["‘上周末’是？",["지난 주말","이번 주말","다음 주","오늘 아침"],"지난 주말","지난 주말表示已经过去的周末。"],
      ["表示‘见朋友’的正确搭配是？",["친구를 만나다","친구에 사다","친구가 듣다","친구에서 오다"],"친구를 만나다","만나다的对象使用을/를。"],
      ["购物时询问价格应说？",["얼마예요?","몇 시예요?","어디예요?","누구예요?"],"얼마예요?","얼마예요?用于询问金额。"],
      ["用于数衣服或纸张等的量词是？",["벌","명","병","권"],"벌","벌可用于数衣服；명数人、병数瓶、권数书。"],
      ["‘再给一个’中的‘再、另外’是？",["더","안","아주","먼저"],"더","더表示追加数量。"],
      ["‘阴天’的基本形是？",["흐리다","맑다","덥다","시원하다"],"흐리다","흐리다表示阴；其余是晴、热、凉爽。"],
      ["下雨时最需要准备什么？",["우산","표","지갑","사진"],"우산","우산是雨伞，与下雨准备场景匹配。"],
      ["‘展览会’是？",["전시회","공연","영화","산책"],"전시회","전시회是展览会，其他是演出、电影和散步。"],
      ["‘听音乐’的正确搭配是？",["음악을 듣다","음악을 걷다","음악에 찍다","음악이 만나다"],"음악을 듣다","듣다与음악搭配表示听音乐。"],
      ["‘票卖完了/没有票’中的‘票’是？",["표","돈","옷","날씨"],"표","표表示票。"],
      ["表达接受建议的自然回应是？",["좋아요.","비가 와요.","얼마예요?","처음 뵙겠습니다."],"좋아요.","좋아요用于接受建议。"],
      ["与‘白天热，晚上凉爽’对应的时段组合是？",["낮／밤","아침／봄","주말／겨울","오늘／우산"],"낮／밤","낮和밤分别表示白天与夜晚。"]
    ],
    "grammar":[
      ["어제 친구를 ___. 请选择만나다的过去礼貌体。",["만났어요","만나요","만날까요","만납니다"],"만났어요","어제要求过去时，만나다变为만났어요。"],
      ["시장에서 과일을 사고 집에 갔어요. -고表示什么关系？",["动作先后连接","强烈转折","否定","能力"],"动作先后连接","-고连接买水果和回家两个连续动作。"],
      ["사과 두 ___ 주세요.",["개","명","권","벌"],"개","개是通用个数量词，适合苹果。"],
      ["덥다的日常礼貌体是？",["더워요","덥어요","더우어요","덥습니다요"],"더워요","덥다发生ㅂ不规则变化：덥+어요→더워요。"],
      ["낮에는 덥___ 밤에는 시원해요.",["지만","고","까요","에서"],"지만","前后天气形成反差，使用-지만。"],
      ["듣다变为建议形应是？",["들을까요?","듣을까요?","들까요?","듣까요?"],"들을까요?","듣다在元音词尾前发生ㄷ不规则，形成들을까요?。"],
      ["远处的展览海报应说？",["저 전시회 포스터","이 전시회 포스터","그 전시회 포스터만","전시회가 저"],"저 전시회 포스터","저修饰远离双方的名词。"],
      ["刚看到漂亮风景时最自然的是？",["정말 아름답네요!","아름다웠어요?","아름답지만요.","아름다워 주세요."],"정말 아름답네요!","-네요表达现场新发现或感叹。"]
    ],
    "listeningStimulus":"서연: 민수 씨, 지난 주말에 뭐 했어요?\n민수: 토요일에 시장에서 사과와 우산을 샀어요. 사과는 다섯 개에 만 원이었어요.\n서연: 우산도 샀어요?\n민수: 네. 일요일 오후에 비가 왔어요. 새 우산을 쓰고 미술관에 갔어요.\n서연: 전시회가 어땠어요?\n민수: 사람이 많았지만 정말 재미있었어요. 이번 주말에도 같이 갈까요?\n서연: 좋아요. 그런데 토요일에는 공연을 봐요. 일요일 두 시는 어때요?\n민수: 괜찮네요. 미술관 앞에서 만나요.",
    "listening":[
      ["민수周六买了什么？",["사과와 우산","공연 표와 옷","책과 사진","영화 표와 과일"],"사과와 우산","第二轮明确说买了苹果和雨伞。"],
      ["为什么周日用了新雨伞？",["비가 왔어요.","눈이 왔어요.","날씨가 더웠어요.","바람이 없었어요."],"비가 왔어요.","对话说明周日下午下雨。"],
      ["민수怎样评价展览？",["사람이 많았지만 재미있었어요.","사람이 없고 지루했어요.","표가 없어서 못 갔어요.","날씨가 추웠어요."],"사람이 많았지만 재미있었어요.","原话用-지만对比人多和有趣。"],
      ["两人约定何时何地见面？",["일요일 두 시／미술관 앞","토요일 두 시／극장 앞","일요일 네 시／시장","토요일 세 시／공원"],"일요일 두 시／미술관 앞","서연提出周日两点，最后确认美术馆前。"]
    ],
    "speaking":[
      ["录制50—70秒双角色对话：先讲一次周末购物经历（日期、商品、数量、价格），再根据天气提出本周末活动建议和备选方案。至少使用过去时、量词、-지만和-(으)ㄹ까요?。","综合第5—8章，按统一口语四维量规人工评分。"],
      ["以天气播报员和听众两个角色录制45—60秒对话：播报今天与明天的天气，听众据此准备物品并调整原有外出计划。必须使用ㅂ或ㄷ不规则形式及正式体。","同时检查天气信息、准备行为和邀约调整，按口语量规人工评分。"]
    ],
    "readingStimulus":"[周末活动公告与聊天]\n이번 주말 부산 문화 시장\n토요일 오전에는 맑고 따뜻합니다. 시장에서 과일과 옷을 팝니다. 사과는 세 개에 오천 원이고 티셔츠는 한 벌에 이만 원입니다. 오후 네 시에는 야외 공연이 있습니다.\n일요일 오전에는 흐리고 오후에는 비가 옵니다. 미술관 전시회는 오전 열 시부터 오후 여섯 시까지입니다.\n유나: 토요일 공연을 볼까요?\n준호: 좋아요. 하지만 오후에는 일이 있어요. 그럼 일요일 오전에 전시회를 볼까요?\n유나: 괜찮네요. 우산을 가지고 열한 시에 미술관 앞에서 만나요.",
    "reading":[
      ["周六上午天气如何？",["맑고 따뜻해요.","흐리고 비가 와요.","춥고 눈이 와요.","덥지만 바람이 불어요."],"맑고 따뜻해요.","公告第一句给出周六上午晴朗温暖。"],
      ["苹果价格是多少？",["세 개에 오천 원","한 개에 만 원","다섯 개에 이만 원","세 개에 이만 원"],"세 개에 오천 원","公告明确标注三个苹果五千韩元。"],
      ["周六下午四点有什么？",["야외 공연","미술관 전시회","영화","산책 모임"],"야외 공연","公告说明下午四点有户外演出。"],
      ["周日下午天气如何？",["비가 와요.","맑아요.","눈이 와요.","더워요."],"비가 와요.","材料明确说明周日下午下雨。"],
      ["为什么준호不接受周六演出计划？",["오후에 일이 있어요.","표가 너무 비싸요.","비가 와요.","공연이 재미없어요."],"오후에 일이 있어요.","聊天中준호说明下午有事。"],
      ["替代活动是什么？",["일요일 오전 전시회","토요일 오전 쇼핑","일요일 오후 공연","토요일 밤 영화"],"일요일 오전 전시회","两人把计划改为周日上午看展。"],
      ["见面时需要带什么？",["우산","겉옷","책","표"],"우산","最后一句要求带伞，与周日雨天信息呼应。"],
      ["材料如何跨场景组织信息？",["先给天气与活动，再通过对话调整计划。","只列商品，不含计划。","只讲过去经历。","只比较正式体和非正式体。"],"先给天气与活动，再通过对话调整计划。","公告提供依据，对话据此完成时间和活动调整。"]
    ],
    "writing":[
      ["写一篇7—9句周末记录与新计划：先用过去时写购物或活动经历（含数量、价格），再说明天气，并用-(으)ㄹ까요?提出下一次活动及备选。","综合第5—8章，按写作五维量规人工评分。"],
      ["根据自拟的两天天气，写一则6—8句活动通知。包含-고描述并列天气、-지만表达反差、正式体预报、准备建议、具体时间地点。","检查天气播报与邀约组织，按统一写作量规人工评分。"]
    ]
  },
  {
    "stage":3,"code":"EX-K1-ST03-V1","title":"韩国语一级第三阶段考试（第9—12章）","description":"综合检查家庭职业、日程计划、健康咨询和电话联系；重点辨析主体敬语、时间范围、未来计划、禁止与义务、进行与原因表达。听力使用临时语音。","duration":70,
    "vocabulary":[
      ["‘父母’是？",["부모님","형제","친구","동료"],"부모님","부모님表示父母并带有敬意。"],
      ["‘医生’是？",["의사","회사원","요리사","학생"],"의사","의사表示医生。"],
      ["‘会说韩语’中的‘会、能够’是？",["할 수 있다","하고 싶다","하고 있다","해야 하다"],"할 수 있다","-(으)ㄹ 수 있다表达能力。"],
      ["‘上午九点’是？",["오전 아홉 시","오후 아홉 시","아홉 분","구 월"],"오전 아홉 시","오전表示上午，时刻使用固有数词아홉和量词시。"],
      ["表示‘从九点到十二点’的组合是？",["아홉 시부터 열두 시까지","아홉 시에 열두 시에서","아홉 시와 열두 시만","아홉 시보다 열두 시"],"아홉 시부터 열두 시까지","부터/까지表示时间起点和终点。"],
      ["‘感冒’是？",["감기","약","병원","기침"],"감기","감기表示感冒；其余是药、医院和咳嗽。"],
      ["‘嗓子疼’是？",["목이 아프다","배가 고프다","손을 씻다","약을 먹다"],"목이 아프다","목이 아프다表示嗓子或脖子疼。"],
      ["‘必须吃药’中的‘药’是？",["약","물","전화","메시지"],"약","약是药，常与먹다搭配。"],
      ["接电话时的固定开场是？",["여보세요.","안녕히 주무세요.","잘 먹겠습니다.","얼마예요?"],"여보세요.","여보세요用于电话开场。"],
      ["‘回电话’是？",["다시 전화하다","전화를 끊다","메시지를 읽다","약속을 취소하다"],"다시 전화하다","다시 전화하다表示再次拨打或回电话。"],
      ["‘正在开会’中的‘会议’是？",["회의","수업","여행","운동"],"회의","회의表示会议，常见表达是회의 중이다或회의하고 있다。"],
      ["说明不能接电话的‘理由’是？",["이유","시간","직업","증상"],"이유","이유表示原因、理由。"]
    ],
    "grammar":[
      ["할머니께서 지금 집에 ___. 请选择主体敬语。",["계세요","있어요","있으세요가","계셔요를"],"계세요","있다的主体敬语是계시다，礼貌体为계세요。"],
      ["아버지는 운전을 ___. 请选择하다的主体敬语。",["하세요","해요를","하십니다가","했어요만"],"하세요","主体是需要尊敬的아버지，하다可用하세요。"],
      ["오후 한 시___ 세 시___ 수업이 있어요.",["부터／까지","에／에서","와／도","만／보다"],"부터／까지","时间范围使用부터...까지。"],
      ["내일 병원에 ___. 请选择未来计划表达。",["갈 거예요","갔어요","가고 있어요","가지 마세요"],"갈 거예요","내일与-(으)ㄹ 거예요共同表达未来计划。"],
      ["병원에서 뛰___. 请选择禁止表达。",["지 마세요","어야 해요","고 있어요","을 수 있어요"],"지 마세요","-지 마세요用于礼貌禁止。"],
      ["감기에 걸렸으면 약을 먹___. 请选择义务表达。",["어야 해요","고 싶어요","지 못해요","고 있어요"],"어야 해요","-아/어야 해요表示应当、必须。"],
      ["지금 회의를 ___. 请选择进行表达。",["하고 있어요","할 거예요","하지 마세요","한 적이 있어요"],"하고 있어요","-고 있다表示动作正在进行。"],
      ["감기에 걸려___ 오늘 못 만나요.",["서","지만","고","까요"],"서","-아/어서连接原因和结果；感冒是不能见面的原因。"]
    ],
    "listeningStimulus":"지민: 여보세요. 수진 씨, 지금 통화할 수 있어요?\n수진: 미안해요. 지금 병원에서 어머니를 기다리고 있어요. 어머니께서 감기에 걸리셨어요.\n지민: 많이 아프세요?\n수진: 열이 나고 목이 아프세요. 의사 선생님은 물을 많이 마시고 오늘은 밖에 나가지 말라고 하셨어요.\n지민: 그럼 오늘 세 시 회의에 못 와요?\n수진: 네. 회의가 끝난 후에 다시 전화할 수 있어요?\n지민: 네. 회의는 세 시부터 네 시 반까지예요. 다섯 시에 전화하세요.\n수진: 알겠어요. 내일은 회사에 갈 거예요.",
    "listening":[
      ["수진现在在哪里？",["병원","회사","집","학교"],"병원","수진说正在医院等母亲。"],
      ["母亲有哪些症状？",["열이 나고 목이 아파요.","배가 아프고 기침이 없어요.","손이 아프고 배가 고파요.","감기는 없고 피곤해요."],"열이 나고 목이 아파요.","对话明确提到发烧和嗓子疼。"],
      ["会议几点结束？",["네 시 반","세 시","다섯 시","두 시 반"],"네 시 반","会议从三点到四点半。"],
      ["수진下一步如何联系？",["다섯 시에 다시 전화해요.","지금 메시지를 보내요.","네 시에 병원에 와요.","내일 세 시에 전화해요."],"다섯 시에 다시 전화해요.","지민要求会议后五点再打电话。"]
    ],
    "speaking":[
      ["录制50—70秒电话对话：先确认对方身份和是否方便通话，再说明家人生病的症状、医生建议，并因故调整当天日程和约定回电时间。至少使用主体敬语、-고 있다、-아/어서。","综合第9—12章，按统一口语量规人工评分。"],
      ["录制45—60秒双角色日程协调：介绍一位家人的职业与能力，说明自己从几点到几点的安排，再提出明天计划；对方给出一条禁止和一条义务建议。","检查家庭、时间、计划与健康表达的综合运用。"]
    ],
    "readingStimulus":"[家庭日程与健康留言]\n우리 어머니는 의사이세요. 한국어와 영어를 하실 수 있어요. 평일에는 오전 여덟 시부터 오후 다섯 시까지 병원에서 일하세요. 오늘은 감기에 걸리셔서 집에서 쉬고 계세요. 열이 나고 기침도 하세요. 의사 친구가 ‘찬 음식을 먹지 마세요. 물을 많이 마셔야 해요.’라고 메시지를 보냈어요.\n저는 지금 회사에서 회의하고 있어서 바로 집에 못 가요. 회의는 두 시부터 네 시까지예요. 네 시 반에 어머니께 전화하고 약을 살 거예요. 저녁에는 집에서 어머니와 같이 있을 거예요.",
    "reading":[
      ["母亲的职业是什么？",["의사","회사원","선생님","학생"],"의사","第一句说明母亲是医生。"],
      ["母亲会哪些语言？",["한국어와 영어","한국어와 중국어","영어와 일본어","중국어만"],"한국어와 영어","材料说明她会韩语和英语。"],
      ["母亲平日工作到几点？",["오후 다섯 시","오후 네 시","오전 여덟 시","오후 두 시"],"오후 다섯 시","工作时间是上午八点到下午五点。"],
      ["母亲今天为什么在家？",["감기에 걸렸어요.","회의가 있어요.","여행을 가요.","전화를 기다려요."],"감기에 걸렸어요.","因感冒而在家休息。"],
      ["朋友禁止她做什么？",["찬 음식을 먹는 것","물을 마시는 것","집에서 쉬는 것","약을 사는 것"],"찬 음식을 먹는 것","引用消息使用먹지 마세요禁止吃凉食。"],
      ["必须做什么？",["물을 많이 마셔야 해요.","밖에 나가야 해요.","회의해야 해요.","전화를 끊어야 해요."],"물을 많이 마셔야 해요.","材料以-아/어야 해요说明多喝水的义务。"],
      ["叙述者为何不能马上回家？",["회의하고 있어서","병원에서 일해서","감기에 걸려서","전화를 못 해서"],"회의하고 있어서","正在开会是不能立即回家的原因。"],
      ["叙述者四点半要做什么？",["어머니께 전화해요.","회의를 시작해요.","병원에서 일해요.","찬 음식을 먹어요."],"어머니께 전화해요.","材料明确计划四点半给母亲打电话。"]
    ],
    "writing":[
      ["写一则7—9句电话后留言：说明联系对象、当前正在做的事、不能通话的原因、从几点到几点的日程、回电时间和明天计划。","综合第10、12章，按写作五维量规人工评分。"],
      ["写一张6—8句家庭健康照护卡：介绍家人身份或职业，用敬语写两项症状，并给出一条-지 마세요禁止和两条-아/어야 해요建议。","综合第9、11章，按统一写作量规人工评分。"]
    ]
  },
  {
    "stage":4,"code":"EX-K1-ST04-V1","title":"韩国语一级第四阶段考试（第13—16章）","description":"综合检查交通问路、服装购物、旅行计划与家庭邀请；重点辨析-(으)로方向/手段、定语修饰、条件与愿望、能力、承诺、移动目的和同时动作。听力使用临时语音。","duration":75,
    "vocabulary":[
      ["‘地铁’是？",["지하철","택시","버스 정류장","기차역"],"지하철","지하철表示地铁。"],
      ["‘一直往前走’中的‘一直’是？",["쭉","벌써","아직","같이"],"쭉","쭉用于指示持续直行。"],
      ["‘在首尔站下车’的正确搭配是？",["서울역에서 내리다","서울역을 타다","서울역에 갈아입다","서울역으로 입다"],"서울역에서 내리다","下车地点用에서，动词为내리다。"],
      ["‘换乘’是？",["갈아타다","갈아입다","돌아가다","구경하다"],"갈아타다","갈아타다用于换乘交通工具；갈아입다是换衣服。"],
      ["‘试穿’是？",["입어 보다","타 보다","먹어 보다","가 보다"],"입어 보다","입어 보다表示尝试穿衣。"],
      ["‘长裙’是？",["긴 치마","짧은 바지","큰 모자","작은 신발"],"긴 치마","길다修饰치마时形成긴 치마。"],
      ["服装店中‘顾客’的尊敬称呼是？",["손님","기사님","부모님","동생"],"손님","손님用于称呼顾客。"],
      ["‘名胜古迹’是？",["명소","교통","초대","준비"],"명소","명소表示有名的景点。"],
      ["‘预订住宿’的正确搭配是？",["숙소를 예약하다","숙소를 초대하다","숙소로 입다","숙소가 갈아타다"],"숙소를 예약하다","숙소를 예약하다表示预订住宿。"],
      ["‘邀请朋友’是？",["친구를 초대하다","친구를 출발하다","친구에게 내리다","친구가 준비되다"],"친구를 초대하다","초대하다的邀请对象用을/를。"],
      ["‘带来食物’中的‘带来’是？",["가져오다","갈아타다","돌아오다","들어가다"],"가져오다","가져오다表示把物品带到说话地点。"],
      ["‘同时听音乐和做饭’中的‘做饭’是？",["요리하다","여행하다","운전하다","구경하다"],"요리하다","요리하다表示做饭，可与-(으)면서连接同时动作。"]
    ],
    "grammar":[
      ["서울역___ 가 주세요. 请选择方向助词。",["으로","에서","부터","에게"],"으로","-(으)로可以表示移动方向。"],
      ["부산___ 서울___ 기차로 왔어요.",["에서／까지","으로／에게","부터／만","와／도"],"에서／까지","地点起点和终点用에서...까지。"],
      ["길다修饰치마时是？",["긴 치마","길은 치마","길는 치마","길을 치마"],"긴 치마","ㄹ收音形容词在-(으)ㄴ前脱落，形成긴。"],
      ["손님, 이 옷을 ___. 请选择试穿建议。",["입어 보세요","입고 싶어요","입을 수 있어요?","입으면서 가요"],"입어 보세요","-아/어 보세요用于礼貌建议尝试。"],
      ["시간이 있___ 제주도에 가고 싶어요.",["으면","지만","고","어서"],"으면","-(으)면表示实现旅行愿望的条件。"],
      ["민수 씨는 제주도에 가고 ___. 请选择有依据的第三人愿望。",["싶어 해요","싶어요","갈 수 있어요","가 주세요"],"싶어 해요","第三人愿望通常用-고 싶어하다。"],
      ["내일 우리 집에 올 ___?",["수 있어요","고 있어요","지 마세요","어야 해요"],"수 있어요","-(으)ㄹ 수 있어요?用于询问能力或可能性。"],
      ["음악을 들___ 요리해요.",["으면서","으러","으면","을게요"],"으면서","-(으)면서连接同一主体同时进行的两个动作。"]
    ],
    "listeningStimulus":"유나: 민수 씨, 토요일에 우리 집에 올 수 있어요? 제주도 여행 사진을 같이 보고 싶어요.\n민수: 네, 갈 수 있어요. 그런데 어떻게 가요?\n유나: 시청역에서 이 호선으로 갈아타고 한강역에서 내리세요. 일 번 출구로 나와서 쭉 걸으세요.\n민수: 알겠어요. 무엇을 가져갈까요?\n유나: 과일을 가져와 주세요. 저는 음악을 들으면서 요리할게요.\n민수: 좋아요. 여행 때 산 파란 셔츠를 입고 갈게요.\n유나: 그 셔츠 예뻐요. 토요일 다섯 시까지 와 주세요. 비가 오면 택시로 오세요.",
    "listening":[
      ["邀请的主要目的是什么？",["여행 사진을 같이 봐요.","옷을 사러 가요.","서울역에 가요.","지하철을 구경해요."],"여행 사진을 같이 봐요.","开头说明想一起看济州旅行照片。"],
      ["민수应在哪一站下车？",["한강역","시청역","서울역","제주역"],"한강역","路线说明在市厅站换乘、汉江站下车。"],
      ["谁准备什么？",["민수는 과일, 유나는 요리","민수는 요리, 유나는 셔츠","민수는 택시, 유나는 과일","민수는 사진, 유나는 지하철"],"민수는 과일, 유나는 요리","유나请민수带水果，自己会做饭。"],
      ["下雨时建议使用什么交通工具？",["택시","지하철","버스","기차"],"택시","最后一句说如果下雨就乘出租车来。"]
    ],
    "speaking":[
      ["录制50—70秒双角色邀请对话：邀请朋友到家里看旅行照片，确认能否来、到达时间、路线换乘、双方准备物品，并用-(으)면서说明一项同时进行的准备。","综合第13、15、16章，按统一口语量规人工评分。"],
      ["录制45—60秒旅行购物情景：顾客说明旅行目的地与想做的活动，店员据天气推荐服装、请顾客试穿；顾客比较两件衣服并承诺购买或再考虑。","综合第14—15章服装定语、试穿建议、愿望与承诺表达。"]
    ],
    "readingStimulus":"[旅行前邀请与路线]\n수진 씨, 이번 토요일에 우리 집에 올 수 있어요? 다음 달에 강원도로 여행을 가고 싶어서 같이 계획하고 싶어요. 우리 집은 중앙역에서 버스로 십 분쯤 걸려요. 중앙역 삼 번 출구로 나와서 초록색 버스를 타세요. 은행 앞에서 내리고 오른쪽으로 쭉 걸으면 흰 건물이 있어요. 그 건물 이 층이에요.\n강원도는 지금 바람이 불고 추워요. 따뜻한 옷과 편한 신발을 준비해야 해요. 저는 숙소를 예약할게요. 수진 씨는 기차표를 살 수 있어요? 토요일 다섯 시까지 오세요. 저는 여행 영상을 보면서 저녁을 만들게요.",
    "reading":[
      ["邀请对方来的目的是什么？",["강원도 여행을 계획해요.","옷을 팔아요.","은행에서 일해요.","기차를 갈아타요."],"강원도 여행을 계획해요.","邀请是为了共同制定江原道旅行计划。"],
      ["从中央站应走哪个出口？",["삼 번 출구","일 번 출구","오 번 출구","칠 번 출구"],"삼 번 출구","路线明确指定三号出口。"],
      ["在哪里下公交车？",["은행 앞","흰 건물 앞","중앙역 안","집 뒤"],"은행 앞","材料要求在银行前下车。"],
      ["目的地建筑有什么特征？",["흰 건물","긴 건물","파란 건물","작은 은행"],"흰 건물","右转直走后会看到白色建筑。"],
      ["江原道现在天气如何？",["바람이 불고 추워요.","맑고 더워요.","비가 오지만 따뜻해요.","눈이 없고 시원해요."],"바람이 불고 추워요.","材料直接说明有风且冷。"],
      ["需要准备哪组物品？",["따뜻한 옷과 편한 신발","짧은 치마와 우산","과일과 약","표와 전화"],"따뜻한 옷과 편한 신발","根据天气需要暖和衣服和舒适鞋子。"],
      ["双方如何分工？",["说话人订住宿，수진买车票。","说话人买衣服，수진做饭。","说话人买车票，수진订住宿。","两人都只看视频。"],"说话人订住宿，수진买车票。","文本用-(으)ㄹ게요和能力问句明确分工。"],
      ["说话人做晚饭时同时做什么？",["여행 영상을 봐요.","기차를 타요.","옷을 입어 봐요.","은행으로 걸어요."],"여행 영상을 봐요.","末句用-(으)면서说明边看旅行视频边做晚饭。"]
    ],
    "writing":[
      ["写一则7—9句到家邀请：说明邀请目的、能否参加、到达时间、从车站出发的路线与交通手段、双方准备分工，并使用-(으)ㄹ게요和-(으)면서。","综合第13、16章，按写作五维量规人工评分。"],
      ["写一份7—9句旅行计划：说明目的地、条件、本人愿望与一位同伴的愿望、正在进行的准备，并根据天气选择和描述服装，至少使用一个形容词定语和-아/어 보다。","综合第14—15章，按统一写作量规人工评分。"]
    ]
  }
]
$stage_seed$::jsonb;
begin
  select profile.id into v_owner_id
  from public.profiles as profile
  where profile.global_role = 'platform_owner'
    and coalesce(profile.status, 'active') = 'active'
  order by profile.created_at
  limit 1;
  if v_owner_id is null then
    raise exception '生成阶段考试草稿前需要一名有效的平台负责人';
  end if;

  for v_stage in select value from jsonb_array_elements(v_seed)
  loop
    if exists (
      select 1 from public.assessment_papers
      where paper_code = v_stage ->> 'code'
    ) then
      raise exception '阶段考试%已经存在；不得覆盖历史试卷，请创建新版本',
        v_stage ->> 'code';
    end if;

    select test.id into v_source_test_id
    from public.chapter_tests as test
    where test.student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
      and test.chapter_number = 1 + ((v_stage ->> 'stage')::integer - 1) * 4
      and test.status = 'published';
    if v_source_test_id is null then
      raise exception '阶段%缺少已发布的起始章节源稿', v_stage ->> 'stage';
    end if;

    insert into public.assessment_papers (
      paper_code, paper_type, title, description, source_test_id,
      student_app_id, duration_minutes, passing_score, allow_resubmission,
      total_points, question_count, version, status, created_by, updated_by
    ) values (
      v_stage ->> 'code', 'exam', v_stage ->> 'title',
      v_stage ->> 'description', v_source_test_id,
      '10000000-0000-4000-8000-000000000001'::uuid,
      (v_stage ->> 'duration')::integer, 60, false,
      0, 0, 1, 'draft', v_owner_id, v_owner_id
    ) returning id into v_paper_id;

    v_sort_order := 0;
    foreach v_skill in array array[
      'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
    ]
    loop
      for v_item in
        select value from jsonb_array_elements(v_stage -> v_skill)
      loop
        v_question_type := case
          when v_skill = 'speaking' then 'audio_recording'
          when v_skill = 'writing' then 'long_text'
          else 'single_choice'
        end;
        v_points := case v_skill
          when 'vocabulary' then 1.25
          when 'grammar' then 2.50
          when 'listening' then 3.75
          when 'speaking' then 7.50
          when 'reading' then 2.50
          when 'writing' then 7.50
        end;
        v_options := case when v_question_type = 'single_choice'
          then v_item -> 1 else '[]'::jsonb end;
        v_answer := case when v_question_type = 'single_choice'
          then v_item ->> 2 else null end;

        insert into public.assessment_paper_questions (
          paper_id, source_bank_question_id, source_bank_version, question_type,
          stimulus_text, prompt, options, points, sort_order, difficulty, skill,
          audio_status
        ) values (
          v_paper_id, null, 1, v_question_type,
          case
            when v_skill = 'listening' then v_stage ->> 'listeningStimulus'
            when v_skill = 'reading' then v_stage ->> 'readingStimulus'
            else ''
          end,
          v_item ->> 0, v_options, v_points, v_sort_order,
          case when v_skill in ('vocabulary', 'grammar') then 'medium' else 'hard' end,
          v_skill,
          case when v_skill = 'listening' then 'temporary' else 'not_applicable' end
        ) returning id into v_question_id;

        insert into public.assessment_paper_question_keys (
          question_id, correct_answer, explanation
        ) values (
          v_question_id, v_answer,
          case when v_question_type = 'single_choice'
            then v_item ->> 3 else v_item ->> 1 end
        );
        v_sort_order := v_sort_order + 1;
      end loop;
    end loop;

    update public.assessment_papers
    set question_count = v_sort_order,
        total_points = (
          select sum(question.points)
          from public.assessment_paper_questions as question
          where question.paper_id = v_paper_id
        ),
        updated_at = now()
    where id = v_paper_id;

    -- 复用 202608190009 的权威质检函数；阶段卷另做同标准的六项精确断言，
    -- 不改变既有发布治理函数，也不把草稿切换为 published。
    v_issues := private.assessment_paper_release_issues(v_paper_id);
    if cardinality(v_issues) > 0 then
      raise exception '阶段考试%未通过既有发布前质检：%',
        v_stage ->> 'code', array_to_string(v_issues, '；');
    end if;
    if v_sort_order <> 36 or exists (
      select required.skill
      from (values
        ('vocabulary', 12, 15::numeric), ('grammar', 8, 20::numeric),
        ('listening', 4, 15::numeric), ('speaking', 2, 15::numeric),
        ('reading', 8, 20::numeric), ('writing', 2, 15::numeric)
      ) as required(skill, question_count, points)
      left join (
        select question.skill, count(*)::integer as question_count,
          sum(question.points) as points
        from public.assessment_paper_questions as question
        where question.paper_id = v_paper_id
        group by question.skill
      ) as actual using (skill)
      where coalesce(actual.question_count, 0) <> required.question_count
        or coalesce(actual.points, 0) <> required.points
    ) then
      raise exception '阶段考试%题量或六项分值不正确', v_stage ->> 'code';
    end if;
  end loop;

  if (
    select count(*) from public.assessment_papers as paper
    where paper.paper_code ~ '^EX-K1-ST0[1-4]-V1$'
      and paper.paper_type = 'exam'
      and paper.status = 'draft'
      and paper.total_points = 100
      and paper.question_count = 36
      and paper.duration_minutes between 60 and 75
  ) <> 4 then
    raise exception '4套韩国语一级阶段考试草稿没有完整生成';
  end if;
end;
$migration$;

commit;
