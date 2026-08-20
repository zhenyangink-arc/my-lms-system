begin;

-- Extend the shared release gate for the frozen Korean Level One final contract.
-- The legacy implementation still owns all generic checks; this wrapper adds the
-- final-specific invariants without changing the already-published midterm.
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
  v_issues text[];
  v_invalid_count integer;
  v_question record;
begin
  v_issues := private.assessment_paper_release_issues_with_temporary_notice(
    p_paper_id
  );
  select * into v_paper
  from public.assessment_papers
  where id = p_paper_id;

  if v_paper.paper_code = 'EX-K1-MID-V1' then
    select coalesce(array_agg(issue order by position), array[]::text[])
    into v_issues
    from unnest(v_issues) with ordinality as quality_issue(issue, position)
    where issue <> '有 5 道听力题仍使用 temporary 临时音频，正式发布前须完成听校并复制为新版本';
  end if;

  if v_paper.paper_type = 'exam'
    and v_paper.paper_code like 'EX-K1-FIN-%' then
    if v_paper.paper_code !~ '^EX-K1-FIN-V[0-9]+$' then
      v_issues := array_append(v_issues, '期末母卷代码必须符合 EX-K1-FIN-V{版本号}');
    end if;
    if v_paper.question_count <> 41 then
      v_issues := array_append(v_issues, '期末考试必须包含41题');
    end if;
    if v_paper.total_points <> 100 then
      v_issues := array_append(v_issues, '期末考试母卷总分必须等于100分');
    end if;
    if v_paper.duration_minutes <> 90 then
      v_issues := array_append(v_issues, '期末考试时长必须为90分钟');
    end if;
    if v_paper.passing_score <> 60 then
      v_issues := array_append(v_issues, '期末考试及格分必须为60分');
    end if;
    if v_paper.allow_resubmission then
      v_issues := array_append(v_issues, '期末考试不得允许重复提交');
    end if;
    if (
      select count(distinct question.skill)
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill in (
          'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
        )
    ) <> 6 then
      v_issues := array_append(v_issues, '期末考试的单词、语法、听力、口语、阅读、写作六项不齐全');
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
      v_issues := array_append(v_issues,
        '期末考试六项分值必须为单词15、语法20、听力15、口语15、阅读20、写作15');
    end if;

    for v_question in
      select question.question_code, question.points,
        case
          when question.question_code ~ '^V' then 1.25::numeric
          when question.question_code ~ '^G' then 2::numeric
          when question.question_code ~ '^L0[1-7]$' then 2::numeric
          when question.question_code = 'L08' then 1::numeric
          when question.question_code = 'S01' then 7::numeric
          when question.question_code = 'S02' then 8::numeric
          when question.question_code ~ '^R' then 2.5::numeric
          when question.question_code = 'W01' then 15::numeric
        end as expected_points
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.points <> case
          when question.question_code ~ '^V' then 1.25::numeric
          when question.question_code ~ '^G' then 2::numeric
          when question.question_code ~ '^L0[1-7]$' then 2::numeric
          when question.question_code = 'L08' then 1::numeric
          when question.question_code = 'S01' then 7::numeric
          when question.question_code = 'S02' then 8::numeric
          when question.question_code ~ '^R' then 2.5::numeric
          when question.question_code = 'W01' then 15::numeric
          else -1::numeric
        end
      order by question.sort_order
    loop
      v_issues := array_append(v_issues, format(
        '期末题 %s 分值应为 %s 分，当前为 %s 分',
        coalesce(v_question.question_code, '未编号题目'),
        v_question.expected_points, v_question.points
      ));
    end loop;

    select count(*) into v_invalid_count
    from public.assessment_paper_questions as question
    where question.paper_id = p_paper_id
      and (
        question.question_code is null
        or cardinality(question.source_chapters) = 0
        or nullif(btrim(question.source_knowledge), '') is null
      );
    if v_invalid_count > 0 then
      v_issues := array_append(v_issues, format(
        '有 %s 道期末题缺少稳定题号、章节来源或知识点快照', v_invalid_count
      ));
    end if;
    if (
      select count(distinct question.question_code)
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.question_code ~ '^(V(0[1-9]|1[0-2])|G(0[1-9]|10)|L0[1-8]|S0[1-2]|R0[1-8]|W01)$'
    ) <> 41 then
      v_issues := array_append(v_issues, '期末考试稳定题号集合不完整或重复');
    end if;
    if (
      select count(distinct chapter_key)
      from public.assessment_paper_questions as question
      cross join unnest(question.source_chapters) as chapter_key
      where question.paper_id = p_paper_id
        and chapter_key ~ '^K1-(0[1-9]|1[0-6])$'
    ) <> 16 then
      v_issues := array_append(v_issues, '期末考试必须覆盖第1—16章');
    end if;
    if exists (
      select required.chapter_key
      from (
        select format('K1-%s', lpad(chapter_number::text, 2, '0')) as chapter_key
        from generate_series(1, 16) as chapter_number
      ) as required
      where not exists (
        select 1
        from public.assessment_paper_questions as question
        where question.paper_id = p_paper_id
          and required.chapter_key = any(question.source_chapters)
      )
    ) then
      v_issues := array_append(v_issues, '期末考试前后册章节覆盖不平衡');
    end if;

    select count(*) into v_invalid_count
    from public.assessment_paper_questions as question
    join public.assessment_paper_question_keys as answer_key
      on answer_key.question_id = question.id
    where question.paper_id = p_paper_id
      and question.skill in ('vocabulary', 'grammar', 'listening', 'reading')
      and (
        not question.auto_graded
        or question.question_type <> 'single_choice'
        or jsonb_array_length(question.options) <> 4
        or (select count(distinct lower(btrim(option_value.value)))
            from jsonb_array_elements_text(question.options) as option_value(value)) <> 4
        or (select count(*) from jsonb_array_elements_text(question.options) as option_value(value)
            where option_value.value = answer_key.correct_answer) <> 1
      );
    if v_invalid_count > 0 then
      v_issues := array_append(v_issues, format(
        '有 %s 道期末客观题未满足四个唯一选项、唯一答案或自动判分合同', v_invalid_count
      ));
    end if;

    select count(*) into v_invalid_count
    from public.assessment_paper_questions as question
    join public.assessment_paper_question_keys as answer_key
      on answer_key.question_id = question.id
    where question.paper_id = p_paper_id
      and question.skill in ('speaking', 'writing')
      and (
        question.auto_graded
        or (question.skill = 'speaking' and question.question_type <> 'audio_recording')
        or (question.skill = 'writing' and question.question_type <> 'long_text')
        or jsonb_typeof(answer_key.rubric_snapshot -> 'criteria') <> 'array'
        or coalesce((
          select sum((criterion ->> 'maxPoints')::numeric)
          from jsonb_array_elements(answer_key.rubric_snapshot -> 'criteria') as criterion
        ), 0) <> question.points
      );
    if v_invalid_count > 0 then
      v_issues := array_append(v_issues, format(
        '有 %s 道期末主观题的作答方式或量规满分与题目分值不一致', v_invalid_count
      ));
    end if;

    select count(*) into v_invalid_count
    from public.assessment_paper_questions as question
    where question.paper_id = p_paper_id
      and question.skill = 'listening'
      and (nullif(btrim(question.stimulus_text), '') is null
        or question.audio_status <> 'temporary');
    if v_invalid_count > 0 then
      v_issues := array_append(v_issues, format(
        '有 %s 道期末听力题缺少材料快照或未保持 temporary 状态', v_invalid_count
      ));
    end if;
    select count(*) into v_invalid_count
    from public.assessment_paper_questions as question
    where question.paper_id = p_paper_id
      and question.skill = 'reading'
      and nullif(btrim(question.stimulus_text), '') is null;
    if v_invalid_count > 0 then
      v_issues := array_append(v_issues, format(
        '有 %s 道期末阅读题缺少材料快照', v_invalid_count
      ));
    end if;
    if exists (
      select 1 from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill <> 'listening'
        and question.audio_status <> 'not_applicable'
    ) then
      v_issues := array_append(v_issues, '期末非听力题的题干音频状态必须为 not_applicable');
    end if;
  end if;

  return v_issues;
end;
$$;

do $migration$
declare
  v_owner_id uuid;
  v_source_test public.chapter_tests%rowtype;
  v_paper_id uuid;
  v_question_id uuid;
  v_item jsonb;
  v_sort_order integer := 0;
  v_listening_a text := $text$[전화]
직원: 네, 학교 보건실입니다.
소라: 안녕하세요. 오늘 오후 두 시에 상담하기로 한 소라예요. 지금 수업을 듣고 있어서 두 시에는 못 가요.
직원: 수업은 몇 시에 끝나요?
소라: 두 시 반에 끝나요. 끝나서 바로 보건실로 갈 거예요. 세 시쯤 괜찮지요?
직원: 네, 세 시에 오세요. 열이 있으면 운동하지 말고 물을 많이 마셔야 돼요.
소라: 네, 알겠습니다.$text$;
  v_listening_b text := $text$[택시 안]
기사: 어디로 가세요?
민준: 서울역 3번 출구로 가 주세요. 부산에서 오는 할머니를 만나려고 해요.
기사: 네. 지금 길이 조금 막혀서 삼십 분쯤 걸려요.
민준: 괜찮아요. 역에 도착하면 선물 가게에도 갈 거예요.
기사: 어떤 선물을 사려고 하세요?
민준: 할머니께 드릴 작고 가벼운 가방을 사고 싶어요. 시간이 있으면 직접 들어 볼게요.$text$;
  v_listening_c text := $text$[동아리 음성 메시지]
이번 토요일에 바다에 가서 해변 청소를 할 거예요. 비가 오면 박물관에서 환경 전시를 볼 거예요.
아침 여덟 시에 학교 정문에서 만날 수 있어요? 저는 음료수를 준비할게요.
유나 씨는 김밥을 만들고, 다니엘 씨는 장갑을 사러 갈 거예요.
버스에서 음악을 들으면서 같이 가요. 오늘 저녁까지 답장해 주세요.$text$;
  v_reading_a text := $text$[신입생 안내 봉사]
저는 한국어반 학생 리나예요. 제 어머니는 학교 선생님이세요.
어머니는 외국어를 잘하시고 월요일 오전 열 시부터 열두 시까지 국제교류센터에서 봉사하세요.
저는 화요일 오후 한 시에 학생회관 안내 데스크에 가서 신입생에게 교실과 도서관 위치를 알려 줄 거예요.
안내 데스크는 학생회관 1층 계단 옆에 있어요. 책상 위에 학교 지도와 연필이 있습니다.$text$;
  v_reading_b text := $text$[학생 지원 메시지]
민수 씨는 감기에 걸려서 오늘 수업에 못 옵니다. 오후 네 시까지 기숙사에서 쉬어야 합니다.
네 시 반에 학교 정문으로 나오세요. 지원 선생님이 택시를 부를 거예요.
학교에서 한빛병원까지 이십 분쯤 걸립니다. 병원에 도착하면 1층 접수대로 가 주세요.
지금 전화 통화가 어려우면 문자로 이름과 증상을 보내 주세요.$text$;
  v_reading_c text := $text$[여행 동아리 교환 행사]
다음 토요일 오후 두 시부터 다섯 시까지 동아리방에서 여행 물건을 교환합니다.
깨끗한 옷이나 가방을 가져오세요. 너무 큰 옷은 받지 않습니다. 입어 보고 싶은 옷이 있으면 직원한테 말하세요.

지아: 저는 다음 달에 산으로 여행을 가고 싶어요. 따뜻한 코트가 필요해요.
도윤: 저는 바다에 가는 친구한테 줄 작은 가방을 가져갈게요.
지아: 비가 오면 박물관도 구경할 수 있지요?
도윤: 네. 제가 지도도 가져올게요. 행사가 끝나면 같이 숙소를 예약하러 가요.$text$;
  v_speaking_one_rubric jsonb := $rubric$
{"criteria":[{"key":"task_completion","label":"任务完成","maxPoints":3,"anchors":"七项信息与6—8轮完成度"},{"key":"grammar_vocabulary","label":"语法与词汇","maxPoints":2,"anchors":"进行、原因、时间和建议表达"},{"key":"pronunciation_interaction","label":"发音与互动","maxPoints":2,"anchors":"整体可懂且双角色衔接清楚"}],"feedbackRequired":true}
$rubric$::jsonb;
  v_speaking_two_rubric jsonb := $rubric$
{"criteria":[{"key":"task_completion","label":"综合任务完成","maxPoints":3,"anchors":"八项信息与8—10轮完成度"},{"key":"grammar_vocabulary","label":"语法与词汇","maxPoints":2,"anchors":"方向、修饰、条件、愿望和承诺"},{"key":"pronunciation","label":"发音与可懂度","maxPoints":2,"anchors":"整体清楚可理解"},{"key":"interaction","label":"互动衔接","maxPoints":1,"anchors":"提议、回应、分工和确认构成双向交流"}],"feedbackRequired":true}
$rubric$::jsonb;
  v_writing_rubric jsonb := $rubric$
{"criteria":[{"key":"content","label":"内容完整","maxPoints":4,"anchors":"十项信息且9—11句"},{"key":"grammar","label":"语法准确","maxPoints":4,"anchors":"时间、方向、修饰、愿望、条件和承诺"},{"key":"vocabulary","label":"词汇使用","maxPoints":3,"anchors":"交通、礼物、天气、活动和分工词汇"},{"key":"organization","label":"组织与衔接","maxPoints":2,"anchors":"会面到分工确认顺序清楚"},{"key":"spelling_format","label":"拼写与格式","maxPoints":2,"anchors":"分句、空格和标点可读"}],"feedbackRequired":true}
$rubric$::jsonb;
  v_seed jsonb := $seed$
[
  ["V01","vocabulary",1.25,"第一次向同学说明‘我是学生’，核心身份名词是？",["학생","선생님","회사원","의사"],"학생","只判定自我身份词。",["K1-01"],"身份词汇",null],
  ["V02","vocabulary",1.25,"课堂上要写字，最需要哪件物品？",["연필","우산","표","약"],"연필","干扰项来自其他生活领域。",["K1-02"],"课堂物品",null],
  ["V03","vocabulary",1.25,"‘在图书馆学习’中的动作是？",["공부하다","도착하다","갈아타다","예약하다"],"공부하다","不混考助词。",["K1-03"],"日常活动",null],
  ["V04","vocabulary",1.25,"‘银行在学校前面’中的‘前面’是？",["앞","뒤","옆","안"],"앞","四个选项均为位置词。",["K1-04"],"方位名词",null],
  ["V05","vocabulary",1.25,"两瓶水中的量词是？",["병","권","명","벌"],"병","与书、人、衣服的量词区分。",["K1-06"],"量词",null],
  ["V06","vocabulary",1.25,"天气预报说有风，对应哪个词？",["바람","구름","계절","기온"],"바람","判定天气名词。",["K1-07"],"天气",null],
  ["V07","vocabulary",1.25,"‘父母’的敬称是？",["부모님","손님","선생님","기사"],"부모님","区分同样含 님 的其他人物词。",["K1-09"],"家庭称谓",null],
  ["V08","vocabulary",1.25,"表示‘日程、安排’的词是？",["일정","약속","수업","숙제"],"일정","其余为约定、课程、作业。",["K1-10"],"日程",null],
  ["V09","vocabulary",1.25,"‘咳嗽’对应哪个词？",["기침","감기","열","약"],"기침","区分症状、疾病、发热和药。",["K1-11"],"症状",null],
  ["V10","vocabulary",1.25,"从地铁下来，应使用哪个动作？",["내리다","타다","출발하다","갈아타다"],"내리다","只检查交通动作词义。",["K1-13"],"交通动作",null],
  ["V11","vocabulary",1.25,"‘尺寸’对应哪个词？",["사이즈","색깔","선물","가방"],"사이즈","与颜色、礼物、包区分。",["K1-14"],"服装购物",null],
  ["V12","vocabulary",1.25,"旅行前需要预订住宿，对应动作是？",["예약하다","구경하다","준비하다","연락하다"],"예약하다","语境锁定‘预订’。",["K1-15"],"旅行准备",null],
  ["G01","grammar",2,"저는 학생___. 제 어머니는 의사___.",["이에요 / 세요","이세요 / 예요","예요 / 이세요","세요 / 이에요"],"이에요 / 세요","自己用普通礼貌体；尊敬且无收音的 의사 接 세요。",["K1-01","K1-09"],"普通身份句与敬语身份句",null],
  ["G02","grammar",2,"학생 식당___ 점심을 먹어요. 식당은 도서관 옆___ 있어요.",["에서 / 에","에 / 에서","에서 / 에서","에 / 에"],"에서 / 에","动作处用 에서，静态存在处用 에。",["K1-03","K1-04"],"动作场所与存在位置",null],
  ["G03","grammar",2,"强调去图书馆后紧接着做作业",["도서관에 가서 숙제할 거예요.","도서관에 가고 숙제했어요.","도서관에서 가서 숙제할 거예요.","도서관에 가지만 숙제할 거예요."],"도서관에 가서 숙제할 거예요.","目的地用 에，紧密先后用 가서。",["K1-05","K1-10"],"-고 与动作链 -아서/어서、未来计划",null],
  ["G04","grammar",2,"오늘은 날씨가 ___. 어제는 머리가 많이 ___.",["더워요 / 아팠어요","덥어요 / 아프었어요","더어요 / 아파요","더워요 / 아프았어요"],"더워요 / 아팠어요","덥다→더워요；아프다→아팠어요。",["K1-07","K1-11"],"ㅂ 不规则与 ㅡ 脱落",null],
  ["G05","grammar",2,"내일 기차표를 살 ___. 제가 지금 예약___.",["거예요 / 할게요","게요 / 할 거예요","수 있어요 / 했어요","거예요 / 하고 싶어 해요"],"거예요 / 할게요","前句陈述计划；后句回应分工并承诺。",["K1-10","K1-16"],"既定未来计划与第一人称当场承诺",null],
  ["G06","grammar",2,"医生劝病人不要运动，并请多喝水。",["운동하지 마세요. 물을 많이 마셔 주세요.","운동해 주세요. 물을 마시지 마세요.","운동하지 않아요. 물만 마실게요.","운동 못 하세요. 물을 마시러 가요."],"운동하지 마세요. 물을 많이 마셔 주세요.","-지 마세요 表禁止；-아/어 주세요 表请求。",["K1-11","K1-13"],"禁止建议与请求",null],
  ["G07","grammar",2,"지금 회의___. 그래서 전화를 ___ 받아요.",["하고 있어요 / 못","해요 / 안","했어요 / 못하고","하고 싶어요 / 못"],"하고 있어요 / 못","正在开会导致无法接电话。",["K1-12"],"进行体与客观不能",null],
  ["G08","grammar",2,"서울역___ 가 주세요.",["으로","에서","까지","부터"],"으로","有收音且非 ㄹ 的 역 接 으로。",["K1-13"],"方向 N-(으)로",null],
  ["G09","grammar",2,"저는 ___ 코트를 입어 보고 싶어요.",["긴","길은","길는","길고"],"긴","길다 修饰名词时为 긴。",["K1-14"],"A-(으)ㄴ N 与 ㄹ 脱落",null],
  ["G10","grammar",2,"저는 제주도에 가고 ___. 지민 씨도 바다를 보고 ___.",["싶어요 / 싶어 해요","싶어 해요 / 싶어요","싶어요 / 싶어요","싶을게요 / 싶어 해요"],"싶어요 / 싶어 해요","第一人称用 -고 싶다；第三人愿望用 -고 싶어 하다。",["K1-15"],"本人愿望与有依据的第三人愿望",null],
  ["L01","listening",2,"소라 为什么两点不能去？",["수업을 듣고 있어서","전화를 못 받아서","병원에 가려고 해서","숙제를 하고 싶어서"],"수업을 듣고 있어서","原因在本人第二句直接出现。",["K1-10","K1-12"],"时刻、进行体与原因","A"],
  ["L02","listening",2,"最终约定几点去保健室？",["오후 세 시","오후 두 시","오후 두 시 반","오전 세 시"],"오후 세 시","区分下课时间与到访时间。",["K1-10","K1-11"],"时刻与保健室","A"],
  ["L03","listening",2,"工作人员给了什么建议？",["운동하지 말고 물을 많이 마셔야 돼요","운동하고 약만 먹어야 돼요","물을 마시지 말고 쉬어야 돼요","세 시부터 운동해야 돼요"],"운동하지 말고 물을 많이 마셔야 돼요","两项建议必须同时匹配。",["K1-11","K1-12"],"禁止、义务与电话理解","A"],
  ["L04","listening",2,"민준 要去哪里，目的是什么？",["서울역 3번 출구 / 할머니를 만나려고","부산역 3번 출구 / 가방을 바꾸려고","서울역 정문 / 기사를 만나려고","공항 출구 / 여행하려고"],"서울역 3번 출구 / 할머니를 만나려고","整合目的地和移动意图。",["K1-13"],"方向与意图","B"],
  ["L05","listening",2,"预计路上多久？",["삼십 분쯤","십삼 분쯤","한 시간 반","세 시간"],"삼십 분쯤","依据司机说明。",["K1-10","K1-13"],"时间长度与交通","B"],
  ["L06","listening",2,"他想买什么礼物？",["작고 가벼운 가방","길고 무거운 코트","작은 운동화","큰 여행 가방"],"작고 가벼운 가방","两个属性和物品都须一致。",["K1-14"],"服装配件与形容","B"],
  ["L07","listening",2,"下雨时活动如何变化？",["박물관에서 환경 전시를 봐요","해변에서 수영해요","학교에서 영화를 봐요","시장에 가서 옷을 사요"],"박물관에서 환경 전시를 봐요","识别条件后的备用方案。",["K1-07","K1-15"],"天气条件与旅行活动","C"],
  ["L08","listening",1,"谁去买手套？",["다니엘 씨","유나 씨","말하는 사람","기사"],"다니엘 씨","依据明确分工句。",["K1-16"],"准备分工与移动目的","C"],
  ["S01","speaking",7,"录制35—50秒、6—8轮双角色电话：说明正在做什么及不能按原时间赴约的原因，确认结束时间，用 -(으)ㄹ까요? 改约明确时间和地点，给出一条健康建议并结束通话。人物、时间和事实须自行设定，不得复制教材、期中卷或听力A。",[],null,"人工批改必须保存三维分项、题目总分和自然语言反馈；无有效录音进入人工异常处理。",["K1-08","K1-10","K1-11","K1-12"],"进行、原因、邀约、健康建议与电话互动",null],
  ["S02","speaking",8,"录制45—60秒、8—10轮双角色交流：准备接待来访朋友，确认车站到见面地点路线，选择适合天气的小礼物，说明想做的活动及天气不好时的备选，分配至少两项任务并用 -(으)ㄹ게요 承诺和确认。不得照抄教材或听力C。",[],null,"人工批改必须保存四维分项、题目总分和自然语言反馈；无有效录音进入人工异常处理。",["K1-13","K1-14","K1-15","K1-16"],"路线、礼物、条件、愿望、分工与承诺",null],
  ["R01","reading",2.5,"리나 的母亲是谁，擅长什么？",["학교 선생님 / 외국어","한국어반 학생 / 운동","회사원 / 요리","의사 / 노래"],"학교 선생님 / 외국어","合并前两句事实。",["K1-01","K1-09"],"身份、职业、能力与敬语","A"],
  ["R02","reading",2.5,"리나 周二将做什么？",["안내 데스크에 가서 신입생에게 위치를 알려 줘요","도서관에서 어머니를 만나요","교실에서 외국어를 공부해요","국제교류센터에서 지도를 사요"],"안내 데스크에 가서 신입생에게 위치를 알려 줘요","区分本人任务与母亲任务。",["K1-02","K1-03"],"物品地点与日常动作","A"],
  ["R03","reading",2.5,"服务台在哪里？",["학생회관 1층 계단 옆","국제교류센터 계단 앞","도서관 2층 안","교실 책상 위"],"학생회관 1층 계단 옆","直接定位信息。",["K1-04","K1-05"],"方位与日程信息","A"],
  ["R04","reading",2.5,"민수 为什么不能上课，几点前要做什么？",["감기에 걸려서 / 네 시까지 쉬어요","길이 막혀서 / 네 시 반까지 운전해요","회의가 있어서 / 네 시까지 전화해요","약속이 있어서 / 이십 분 쉬어요"],"감기에 걸려서 / 네 시까지 쉬어요","整合病因和时间要求。",["K1-11","K1-13"],"症状、原因与起止范围","B"],
  ["R05","reading",2.5,"不能通话时应怎样提供信息？",["문자로 이름과 증상을 보내요","택시 기사에게 전화해요","접수대에서 수업을 들어요","정문으로 약을 보내요"],"문자로 이름과 증상을 보내요","依据最后一句。",["K1-12","K1-13"],"电话障碍与请求","B"],
  ["R06","reading",2.5,"活动不接收什么？",["너무 큰 옷","깨끗한 옷","작은 가방","여행 지도"],"너무 큰 옷","公告中的否定条件。",["K1-14"],"服装属性","C"],
  ["R07","reading",2.5,"지아 想去哪里，需要什么？",["산 / 따뜻한 코트","바다 / 작은 가방","박물관 / 운동화","섬 / 긴 치마"],"산 / 따뜻한 코트","合并本人愿望和所需物品。",["K1-14","K1-15"],"形容词定语与旅行愿望","C"],
  ["R08","reading",2.5,"活动结束后两人计划做什么？",["숙소를 예약하러 가요","코트를 입으러 산에 가요","친구를 만나러 바다에 가요","동아리방을 청소하면서 자요"],"숙소를 예약하러 가요","依据最后一句，区别活动中的其他动作。",["K1-15","K1-16"],"旅行准备与移动目的","C"],
  ["W01","writing",15,"以接待交换生的学生身份，写9—11句的一日接待安排：写清日期、准确时间、见面地点、交通或方向；准备一件有数量或金额信息且带属性描述的小礼物；提出想做的活动和天气不好时的备选；分配两项准备工作并用第一人称作出至少一项 -(으)ㄹ게요 承诺。不得复制教材、期中卷或本卷材料。",[],null,"人工批改必须保存五维分项、题目总分和自然语言反馈；空白、抄题或无法辨认的提交不得自动判分。",["K1-06","K1-07","K1-10","K1-13","K1-14","K1-15","K1-16"],"日期时间、路线、量价、礼物修饰、愿望、条件备选、分工与承诺",null]
]
$seed$::jsonb;
begin
  select profile.id into v_owner_id
  from public.profiles as profile
  where profile.role = 'platform_super_admin'
    and profile.status = 'active'
  order by profile.created_at
  limit 1;
  if v_owner_id is null then
    raise exception '生成期末考试草稿前需要一名有效的平台负责人';
  end if;

  select test.* into v_source_test
  from public.chapter_tests as test
  where test.student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
    and test.slug = 'korean-level-one-16'
    and test.status = 'published';
  if v_source_test.id is null then
    raise exception '生成期末考试草稿前需要已发布的韩国语一级第16章源稿';
  end if;
  if exists (select 1 from public.assessment_papers where paper_code = 'EX-K1-FIN-V1') then
    raise exception 'EX-K1-FIN-V1 已存在；冻结版本不得覆盖，请复制为 V2';
  end if;

  insert into public.assessment_papers (
    paper_code, paper_type, title, description, source_test_id,
    student_app_id, duration_minutes, passing_score, allow_resubmission,
    resubmission_policy_configured, total_points, question_count, version,
    status, created_by, updated_by
  ) values (
    'EX-K1-FIN-V1', 'exam', '韩国语一级期末考试（第1—16章）',
    '覆盖第1—16章六项能力的期末考试冻结草稿。41题、四选项、答案、解析、材料和量规均按V1内容合同保存；听力保留temporary状态。',
    v_source_test.id, v_source_test.student_app_id, 90, 60, false, true,
    100, 41, 1, 'draft', v_owner_id, v_owner_id
  ) returning id into v_paper_id;

  for v_item in select value from jsonb_array_elements(v_seed)
  loop
    insert into public.assessment_paper_questions (
      paper_id, source_bank_question_id, source_bank_version, question_type,
      stimulus_text, prompt, options, points, sort_order, difficulty, skill,
      audio_status, question_code, source_chapters, source_knowledge
    ) values (
      v_paper_id, null, 1,
      case v_item ->> 1
        when 'speaking' then 'audio_recording'
        when 'writing' then 'long_text'
        else 'single_choice'
      end,
      case
        when v_item ->> 1 = 'listening' and v_item ->> 9 = 'A' then v_listening_a
        when v_item ->> 1 = 'listening' and v_item ->> 9 = 'B' then v_listening_b
        when v_item ->> 1 = 'listening' and v_item ->> 9 = 'C' then v_listening_c
        when v_item ->> 1 = 'reading' and v_item ->> 9 = 'A' then v_reading_a
        when v_item ->> 1 = 'reading' and v_item ->> 9 = 'B' then v_reading_b
        when v_item ->> 1 = 'reading' and v_item ->> 9 = 'C' then v_reading_c
        else ''
      end,
      v_item ->> 3, v_item -> 4, (v_item ->> 2)::numeric, v_sort_order,
      case when v_item ->> 1 in ('vocabulary', 'grammar') then 'medium' else 'hard' end,
      v_item ->> 1,
      case when v_item ->> 1 = 'listening' then 'temporary' else 'not_applicable' end,
      v_item ->> 0, array(select jsonb_array_elements_text(v_item -> 7)), v_item ->> 8
    ) returning id into v_question_id;

    insert into public.assessment_paper_question_keys (
      question_id, correct_answer, explanation, rubric_snapshot
    ) values (
      v_question_id, v_item ->> 5, v_item ->> 6,
      case v_item ->> 0
        when 'S01' then v_speaking_one_rubric
        when 'S02' then v_speaking_two_rubric
        when 'W01' then v_writing_rubric
        else '{}'::jsonb
      end
    );
    v_sort_order := v_sort_order + 1;
  end loop;

  if v_sort_order <> 41 or (
    select coalesce(sum(question.points), 0)
    from public.assessment_paper_questions as question
    where question.paper_id = v_paper_id
  ) <> 100 then
    raise exception '期末考试快照题量或总分与内容合同不一致';
  end if;
  if cardinality(private.assessment_paper_release_issues(v_paper_id)) <> 0 then
    raise exception 'EX-K1-FIN-V1 草稿质检未通过：%',
      private.assessment_paper_release_issues(v_paper_id);
  end if;
  if exists (
    select 1 from public.learning_assignments where source_paper_id = v_paper_id
  ) then
    raise exception 'draft 期末卷不得已经布置给机构或学生';
  end if;
end;
$migration$;

commit;
