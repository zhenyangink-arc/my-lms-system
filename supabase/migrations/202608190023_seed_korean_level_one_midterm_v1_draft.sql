begin;

-- 综合考试需要保留题号、章节证据和人工量规，继续使用现有母卷快照表，
-- 不把发布内容拆到新的旁路存储中。
alter table public.assessment_papers
  add column if not exists resubmission_policy_configured boolean not null default true;

alter table public.assessment_paper_questions
  add column if not exists audio_status text not null default 'not_applicable',
  add column if not exists question_code text,
  add column if not exists source_chapters text[] not null default '{}'::text[],
  add column if not exists source_knowledge text not null default '';

alter table public.assessment_paper_questions
  drop constraint if exists assessment_paper_questions_audio_status_check;
alter table public.assessment_paper_questions
  add constraint assessment_paper_questions_audio_status_check
    check (audio_status in ('not_applicable', 'pending', 'temporary', 'formal'));

alter table public.assessment_paper_questions
  drop constraint if exists assessment_paper_questions_question_code_check;
alter table public.assessment_paper_questions
  add constraint assessment_paper_questions_question_code_check
    check (question_code is null or question_code ~ '^[VGLSRW][0-9]{2}$');

alter table public.assessment_paper_question_keys
  add column if not exists rubric_snapshot jsonb not null default '{}'::jsonb;

alter table public.assessment_paper_question_keys
  drop constraint if exists assessment_paper_question_keys_rubric_snapshot_check;
alter table public.assessment_paper_question_keys
  add constraint assessment_paper_question_keys_rubric_snapshot_check
    check (jsonb_typeof(rubric_snapshot) = 'object');

comment on column public.assessment_papers.resubmission_policy_configured is
  '重复提交规则是否已经由内容负责人明确确认；false 时草稿不得发布。';
comment on column public.assessment_paper_questions.question_code is
  '冻结内容合同中的稳定题号，例如 V01、S01。';
comment on column public.assessment_paper_questions.source_chapters is
  '题目内容合同冻结的章节来源键。';
comment on column public.assessment_paper_questions.source_knowledge is
  '题目内容合同冻结的知识点说明。';
comment on column public.assessment_paper_question_keys.rubric_snapshot is
  '口语或写作题的人工评分量规快照；客观题为空对象。';

-- 扩展集中质检。期中卷允许以 temporary 状态保存草稿，但发布质检会明确指出
-- 正式音频尚未完成；合同未冻结的四选项也作为逐条阻塞项返回。
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
  v_is_chapter_exam boolean;
  v_is_midterm boolean;
  v_invalid_count integer;
  v_question record;
begin
  select * into v_paper
  from public.assessment_papers
  where id = p_paper_id;
  if not found then
    return array['标准试卷不存在'];
  end if;

  v_is_chapter_exam := v_paper.paper_type = 'exam'
    and v_paper.paper_code ~ '^EX-K1-(0[1-9]|1[0-6])-V[0-9]+$';
  v_is_midterm := v_paper.paper_type = 'exam'
    and v_paper.paper_code like 'EX-K1-MID-%';

  if v_paper.question_count < 1 then
    v_issues := array_append(v_issues, '试卷没有题目');
  end if;
  if v_paper.duration_minutes is null then
    v_issues := array_append(v_issues, '未设置考试时长');
  end if;
  if v_paper.passing_score is null then
    v_issues := array_append(v_issues, '未设置及格分');
  end if;
  if not v_paper.resubmission_policy_configured then
    v_issues := array_append(v_issues, '重复提交规则尚未由内容负责人确认');
  end if;

  select count(*) into v_invalid_count
  from (
    select lower(btrim(question.prompt))
    from public.assessment_paper_questions as question
    where question.paper_id = p_paper_id
    group by lower(btrim(question.prompt))
    having count(*) > 1
  ) as duplicates;
  if v_invalid_count > 0 then
    v_issues := array_append(v_issues,
      format('存在 %s 组重复题干', v_invalid_count));
  end if;

  select count(*) into v_invalid_count
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
    );
  if v_invalid_count > 0 then
    v_issues := array_append(v_issues,
      format('有 %s 道题的题干、解析、分值或能力分类未完成', v_invalid_count));
  end if;

  select count(*) into v_invalid_count
  from public.assessment_paper_questions as question
  left join public.assessment_paper_question_keys as answer_key
    on answer_key.question_id = question.id
  where question.paper_id = p_paper_id
    and question.auto_graded
    and (
      nullif(btrim(answer_key.correct_answer), '') is null
      or nullif(btrim(answer_key.explanation), '') is null
    );
  if v_invalid_count > 0 then
    v_issues := array_append(v_issues,
      format('有 %s 道客观题缺少正确答案或解析', v_invalid_count));
  end if;

  select count(*) into v_invalid_count
  from public.assessment_paper_questions as question
  join public.assessment_paper_question_keys as answer_key
    on answer_key.question_id = question.id
  where question.paper_id = p_paper_id
    and question.auto_graded
    and (
      jsonb_array_length(question.options) < 2
      or not question.options @> jsonb_build_array(answer_key.correct_answer)
    );
  if v_invalid_count > 0 then
    v_issues := array_append(v_issues,
      format('有 %s 道客观题的可选项未完整冻结或不包含正确答案', v_invalid_count));
  end if;

  select count(*) into v_invalid_count
  from public.assessment_paper_questions as question
  where question.paper_id = p_paper_id
    and exists (
      select 1
      from jsonb_array_elements_text(question.options) as option_value(value)
      group by lower(btrim(option_value.value))
      having count(*) > 1
    );
  if v_invalid_count > 0 then
    v_issues := array_append(v_issues,
      format('有 %s 道题包含完全重复的选项', v_invalid_count));
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

  if v_is_midterm then
    if v_paper.paper_code !~ '^EX-K1-MID-V[0-9]+$' then
      v_issues := array_append(v_issues, '期中母卷代码必须符合 EX-K1-MID-V{版本号}');
    end if;
    if v_paper.total_points <> 100 then
      v_issues := array_append(v_issues, '期中考试母卷总分必须等于100分');
    end if;
    if (
      select count(distinct question.skill)
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill in (
          'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
        )
    ) <> 6 then
      v_issues := array_append(v_issues, '期中考试的单词、语法、听力、口语、阅读、写作六项不齐全');
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
        '期中考试六项分值必须为单词15、语法20、听力15、口语15、阅读20、写作15');
    end if;
    for v_question in
      select
        coalesce(question.question_code, '未编号题目') as question_code,
        question.points,
        case question.skill
          when 'vocabulary' then 1.5::numeric
          when 'grammar' then 2::numeric
          when 'listening' then 3::numeric
          when 'speaking' then 15::numeric
          when 'reading' then 2.5::numeric
          when 'writing' then 15::numeric
        end as expected_points
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill in (
          'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
        )
        and question.points <> case question.skill
          when 'vocabulary' then 1.5::numeric
          when 'grammar' then 2::numeric
          when 'listening' then 3::numeric
          when 'speaking' then 15::numeric
          when 'reading' then 2.5::numeric
          when 'writing' then 15::numeric
        end
      order by question.sort_order
    loop
      v_issues := array_append(
        v_issues,
        format(
          '期中题 %s 分值应为 %s 分，当前为 %s 分',
          v_question.question_code,
          v_question.expected_points,
          v_question.points
        )
      );
    end loop;
    if (
      select count(distinct chapter_key)
      from public.assessment_paper_questions as question
      cross join unnest(question.source_chapters) as chapter_key
      where question.paper_id = p_paper_id
        and chapter_key ~ '^K1-(0[1-9]|1[0-6])$'
    ) < 6 then
      v_issues := array_append(v_issues, '期中考试必须至少覆盖6个不同章节');
    end if;
    select count(*) into v_invalid_count
    from public.assessment_paper_questions as question
    where question.paper_id = p_paper_id
      and (
        question.question_code is null
        or cardinality(question.source_chapters) = 0
        or nullif(btrim(question.source_knowledge), '') is null
      );
    if v_invalid_count > 0 then
      v_issues := array_append(v_issues,
        format('有 %s 道期中题缺少稳定题号、章节来源或知识点快照', v_invalid_count));
    end if;
    if exists (
      select 1 from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill in ('vocabulary', 'grammar', 'listening', 'reading')
        and not question.auto_graded
    ) then
      v_issues := array_append(v_issues, '期中考试的单词、语法、听力或阅读客观题未配置自动判分');
    end if;
    if exists (
      select 1 from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill in ('speaking', 'writing')
        and question.auto_graded
    ) then
      v_issues := array_append(v_issues, '期中考试的口语和写作必须配置为人工批改');
    end if;
    select count(*) into v_invalid_count
    from public.assessment_paper_questions as question
    join public.assessment_paper_question_keys as answer_key
      on answer_key.question_id = question.id
    where question.paper_id = p_paper_id
      and question.skill in ('speaking', 'writing')
      and (
        (question.skill = 'speaking' and question.question_type <> 'audio_recording')
        or (question.skill = 'writing' and question.question_type <> 'long_text')
        or case
          when jsonb_typeof(answer_key.rubric_snapshot -> 'criteria') = 'array'
          then
            exists (
              select 1
              from jsonb_array_elements(
                answer_key.rubric_snapshot -> 'criteria'
              ) as criterion
              where jsonb_typeof(criterion -> 'maxPoints') <> 'number'
            )
            or coalesce((
              select sum((criterion ->> 'maxPoints')::numeric)
              from jsonb_array_elements(
                answer_key.rubric_snapshot -> 'criteria'
              ) as criterion
            ), 0) <> question.points
          else true
        end
      );
    if v_invalid_count > 0 then
      v_issues := array_append(v_issues,
        format('有 %s 道主观题的作答方式或量规满分与题目分值不一致', v_invalid_count));
    end if;
    select count(*) into v_invalid_count
    from public.assessment_paper_questions as question
    where question.paper_id = p_paper_id
      and question.skill = 'listening'
      and (
        nullif(btrim(question.stimulus_text), '') is null
        or question.audio_status not in ('temporary', 'formal')
      );
    if v_invalid_count > 0 then
      v_issues := array_append(v_issues,
        format('有 %s 道听力题缺少材料文本或有效音频状态', v_invalid_count));
    end if;
    select count(*) into v_invalid_count
    from public.assessment_paper_questions as question
    where question.paper_id = p_paper_id
      and question.skill = 'listening'
      and question.audio_status = 'temporary';
    if v_invalid_count > 0 then
      v_issues := array_append(v_issues,
        format('有 %s 道听力题仍使用 temporary 临时音频，正式发布前须完成听校并复制为新版本', v_invalid_count));
    end if;
    if exists (
      select 1 from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill = 'listening'
        and question.audio_status = 'formal'
    ) and v_paper.paper_code = 'EX-K1-MID-V1' then
      v_issues := array_append(v_issues, 'EX-K1-MID-V1 合同规定听力状态不得标记为 formal');
    end if;
  elsif v_is_chapter_exam then
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
      v_issues := array_append(v_issues,
        '六项分值必须为单词15、语法20、听力15、口语15、阅读20、写作15');
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
      select 1 from public.assessment_paper_questions as question
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

do $migration$
declare
  v_owner_id uuid;
  v_source_test public.chapter_tests%rowtype;
  v_paper_id uuid;
  v_question_id uuid;
  v_item jsonb;
  v_sort_order integer := 0;
  v_seed jsonb := $seed$
[
  ["V01","vocabulary",1.5,"第一次见到新同学，哪一句是礼貌问候？","안녕하세요?","与告别、致谢、电话用语干扰项区分。",["K1-01"],"初次见面问候"],
  ["V02","vocabulary",1.5,"课堂上需要‘橡皮’，应选择哪个词？","지우개","干扰项使用同章其他物品词。",["K1-02"],"课堂物品"],
  ["V03","vocabulary",1.5,"表示‘在图书馆读书’中的动作词是哪一个？","읽다","只检查词义，不在本题重复考助词。",["K1-03"],"日常活动"],
  ["V04","vocabulary",1.5,"‘办公室在楼梯旁边’中的‘旁边’是？","옆","与 앞/뒤/안 区分。",["K1-04"],"校园方位"],
  ["V05","vocabulary",1.5,"表示‘上周末’的词组是哪一个？","지난 주말","与今天、明天、平日时间词区分。",["K1-05"],"周末时间表达"],
  ["V06","vocabulary",1.5,"购买一瓶牛奶时使用哪个量词？","병","与同章通用量词 개 区分。",["K1-06"],"商品数量与量词"],
  ["V07","vocabulary",1.5,"天气预报说‘阴’，对应哪个词？","흐리다","使用词典形，避免把形态变化混入词汇题。",["K1-07"],"天气词汇"],
  ["V08","vocabulary",1.5,"周末去看‘展览’，应选择哪个词？","전시회","与电影、演出、公园等活动词区分。",["K1-08"],"周末活动"],
  ["V09","vocabulary",1.5,"文具店要买‘两块橡皮’，核心名词组合是哪一项？","지우개 두 개","综合识别物品、固有数词与 개。",["K1-02","K1-06"],"课堂物品＋固有词数量和通用量词"],
  ["V10","vocabulary",1.5,"下雨天去户外活动，最需要准备什么？","우산","新语境中的词义选择。",["K1-07","K1-08"],"天气准备物＋周末活动"],
  ["G01","grammar",2,"저는 리나___.","예요","리나 无收音，接 예요。",["K1-01"],"N이에요/예요"],
  ["G02","grammar",2,"민수___ 학생이에요. 교실에 컴퓨터___ 있어요.","는 / 가","身份介绍设置话题用 는；无收音名词作为存在对象用 가。",["K1-01","K1-02"],"话题助词与存在主语助词"],
  ["G03","grammar",2,"物品在听话人手边：“___ 연필이에요? 그리고 지우개가 ___?”","그 / 있어요","听话人近处用 그；询问有无用 있어요?。",["K1-02"],"距离指示＋存在问句"],
  ["G04","grammar",2,"도서관___ 책을 읽어요. 도서관은 본관 뒤___ 있어요.","에서 / 에","阅读动作发生处用 에서；静态位置用 에。",["K1-03","K1-04"],"动作场所 에서 与存在位置 에"],
  ["G05","grammar",2,"친구___ 만나고 같이 커피___ 마셔요.","를 / 를","两个无收音对象名词后均用 를。",["K1-03"],"动作对象 N을/를"],
  ["G06","grammar",2,"昨天在市场买了苹果","어제 시장에서 사과를 샀어요.","사다 的过去时为 샀어요，动作场所保留 에서。",["K1-05"],"过去时 V/A-았/었어요"],
  ["G07","grammar",2,"토요일___ 친구를 만나___ 영화를 봤어요.","에 / 고","时间点用 에；顺接两个动作使用 -고。",["K1-05"],"时间 에＋动作连接 -고"],
  ["G08","grammar",2,"사과 세 ___ 주세요. 우산___ 주세요.","개 / 도","苹果用通用量词 개；追加‘雨伞也要’用 도。",["K1-06"],"固有词数量量词＋N도"],
  ["G09","grammar",2,"낮에는 ___ 밤에는 ___. 表达‘白天热但夜里凉爽’","덥지만 / 시원합니다","덥다→덥지만；播报体使用 시원합니다。",["K1-07"],"ㅂ不规则＋-지만＋正式体"],
  ["G10","grammar",2,"看到远处展览海报后作出反应，并提议去公园走走","저 전시회가 재미있네요. 공원에서 걸을까요?","걷다 在元音词尾前变为 걸-；远处名词前用 저；现场新发现用 -네요。正式录题时选项必须保持整句自然。",["K1-08"],"ㄷ不规则提议、指示冠形词、新发现表达"],
  ["L01","listening",3,"学校商店在哪里？","도서관 옆","原文直接说明商店在图书馆旁边。",["K1-04"],"地点与方位","A"],
  ["L02","listening",3,"一个苹果多少钱？","이천 원","原文为 한 개에 이천 원。",["K1-06"],"数量、量词与金额","A"],
  ["L03","listening",3,"下午天气怎样，智秀建议准备什么？","비가 와요 / 우산","原文明确下雨并建议准备雨伞。",["K1-07"],"天气反差与准备建议","A"],
  ["L04","listening",3,"俊浩上周日在公园做了什么？","친구하고 걸었어요","只依据第一段过去经历作答。",["K1-05"],"过去经历与动作连接","B"],
  ["L05","listening",3,"两人最终决定做什么，何时何地见？","전시회를 봐요 / 세 시 / 미술관 앞","下雨后改为室内展览，最后一句确认时间地点。",["K1-07","K1-08"],"天气导致计划调整、邀约与最终确认","B"],
  ["S01","speaking",15,"你在校园迎新日接待一名新同学。录制 55—70 秒、8—10 轮的双角色对话。先互相问候并说明姓名或身份，再告诉对方活动地点及一个方位关系；根据当天一种天气情况提出活动建议，对方给出接受或调整，最后确认活动、时间和地点。必须出现：两个角色、问候与身份、一个校园方位、一个天气事实、一个 -(으)ㄹ까요? 提议、一次接受或调整、最终时间地点确认。禁止照抄任一教材示范对话或本文听力文本；仅单人连续朗读不满足任务。",null,"人工批改必须保存四维分项、总分和自然语言反馈。无录音、损坏录音或内容不可辨认时不得自动给分，应进入现有人工处理流程。",["K1-01","K1-04","K1-07","K1-08"],"身份介绍、校园地点与方位、天气说明、活动提议与计划调整"],
  ["R01","reading",2.5,"천위 的身份是什么？","한국어반 학생","报名卡直接信息。",["K1-01"],"姓名与身份","A"],
  ["R02","reading",2.5,"他何时何地学习韩语？","월요일과 수요일 오후 세 시 / 국제교류센터","同时整合时间和动作地点。",["K1-03"],"日常活动与动作场所","A"],
  ["R03","reading",2.5,"国际交流中心相对图书馆在哪里？","도서관 뒤","依据 도서관 뒤에 있어요。",["K1-04"],"校园方位","A"],
  ["R04","reading",2.5,"现在笔记本在哪里，천위 周三去哪里？","교실 책상 위 / 국제교류센터","分别提取当前静态位置和人物移动目的地。",["K1-02","K1-04"],"物品指示、存在位置与移动目的地","A"],
  ["R05","reading",2.5,"周六天气与户外活动分别是什么？","맑고 따뜻합니다 / 야외 공연","合并公告中的两处事实。",["K1-07","K1-08"],"天气并列与活动信息","B"],
  ["R06","reading",2.5,"买四个苹果要多少钱？","육천 원","依据 네 개에 육천 원。",["K1-06"],"数量、量词与金额","B"],
  ["R07","reading",2.5,"为什么没有按最初建议的两点见面？","하나는 두 시에 일이 있어요","原因来自对邀请的调整回应，不得用天气替代。",["K1-08"],"邀约回应与调整","B"],
  ["R08","reading",2.5,"最终约定何时何地见？","세 시 / 카페 앞","最终确认句覆盖地点，前一句覆盖时间。",["K1-08"],"提议、接受与最终确认","B"],
  ["W01","writing",15,"给学习小组写一段 7—9 句的周末消息。先用过去时写上周末买过的一种物品或参加过的一项活动，并写清一个数量或金额；再说明本周末的一种天气情况，提出第一项活动建议。因为天气、时间或票务原因调整一次方案，最后写清新的活动、时间和地点。必须出现：过去时经历、数量或金额、天气事实、-(으)ㄹ까요? 提议、调整理由、不同的备选活动、最终时间和地点。禁止复制教材、阶段卷或本文听力／阅读中的完整示范答案。题目只提供要求，不提供可直接替换词语后提交的范文。",null,"人工批改必须保存五维分项、总分和自然语言反馈。空白、明显抄题或无法辨认的提交不得由客观题判分逻辑处理。",["K1-05","K1-06","K1-07","K1-08"],"过去经历、数量与金额、天气说明、建议与备选方案"]
]
$seed$::jsonb;
  v_listening_a text := $text$지수: 안녕하세요? 저는 지수예요. 한국어반 학생이에요.
민호: 안녕하세요? 학교 가게가 어디에 있어요?
지수: 도서관 옆에 있어요.
민호: 지수 씨는 거기에서 무엇을 사요?
지수: 사과하고 우산을 사요. 사과는 세 개 있고 우산은 한 개 있어요.
민호: 사과는 얼마예요?
지수: 한 개에 이천 원이에요.
민호: 오늘 오후에 비가 와요?
지수: 네, 비가 오지만 바람은 안 불어요. 우산을 준비하세요.$text$;
  v_listening_b text := $text$서연: 지난 일요일에 뭐 했어요?
준호: 친구하고 공원에서 걸었어요. 그리고 카페에서 차를 마셨어요.
서연: 이번 토요일에도 공원에서 걸을까요?
준호: 오전에는 덥지만 오후에는 시원해요. 세 시는 어때요?
서연: 좋아요. 그런데 오후에 비가 와요.
준호: 그럼 실내 전시회를 볼까요?
서연: 괜찮네요. 세 시에 미술관 앞에서 만나요.$text$;
  v_reading_a text := $text$[언어 교환 신청 카드]
이름: 천위
신분: 한국어반 학생
월요일과 수요일 오후 세 시에 국제교류센터에서 한국어를 공부해요.
국제교류센터는 도서관 뒤에 있어요.

[공책 메모]
이 공책은 천위 씨 공책이에요.
지금 교실 책상 위에 있어요.
천위 씨는 수요일에 국제교류센터에 와요.$text$;
  v_reading_b text := $text$[주말 동네 시장]
토요일에는 맑고 따뜻합니다. 오전 열 시부터 시장을 엽니다.
사과는 네 개에 육천 원이고 우유는 두 병에 오천 원입니다.
오후 두 시에는 야외 공연이 있습니다.
일요일 오후에는 비가 오고 바람이 붑니다.

유진: 토요일 두 시에 공연을 볼까요?
하나: 좋아요. 그런데 저는 두 시에 일이 있어요.
유진: 그럼 세 시에 시장 안 카페에서 만날까요?
하나: 괜찮네요. 공연 후에 카페 앞에서 만나요.$text$;
  v_speaking_rubric jsonb := $rubric$
{"criteria":[
  {"key":"task_completion","label":"任务完成","maxPoints":5,"anchors":"5：七项必备信息齐全且 8—10 轮；4：缺 1 项；2—3：缺 2—3 项或轮次不足；1：只能完成零散回应；0：无有效作答或完全离题。"},
  {"key":"grammar_vocabulary","label":"语法与词汇","maxPoints":4,"anchors":"4：目标表达使用准确，错误不影响意义；3：少量错误但信息清楚；2：多处错误，部分信息需推断；1：错误持续妨碍理解；0：无可评分韩语。"},
  {"key":"pronunciation_intelligibility","label":"发音与可懂度","maxPoints":3,"anchors":"3：整体清楚，个别偏差不影响理解；2：有若干偏差但仍可理解；1：频繁需要猜测；0：无法理解或无声音。不得显示或伪造自动发音分。"},
  {"key":"fluency_interaction","label":"流利度与互动","maxPoints":3,"anchors":"3：角色衔接自然、停顿基本不妨碍交流；2：有明显停顿但能完成互动；1：大量停顿或近似逐词拼接；0：无互动证据。"}
]}
$rubric$::jsonb;
  v_writing_rubric jsonb := $rubric$
{"criteria":[
  {"key":"content_completeness","label":"内容完整","maxPoints":4,"anchors":"4：七项信息齐全且 7—9 句；3：缺 1 项；2：缺 2—3 项；1：只有零散相关信息；0：无有效作答或完全离题。"},
  {"key":"grammar_accuracy","label":"语法准确","maxPoints":4,"anchors":"4：过去时、数量／金额、天气和提议结构基本准确；3：少量错误不影响意义；2：多处错误但主要信息可辨；1：错误严重妨碍理解；0：无可评分韩语。"},
  {"key":"vocabulary_use","label":"词汇使用","maxPoints":3,"anchors":"3：词汇适切并覆盖经历、天气和活动；2：范围有限或有少量误用；1：误用频繁且高度重复；0：无有效韩语词汇。"},
  {"key":"organization_cohesion","label":"组织与衔接","maxPoints":2,"anchors":"2：过去经历→当前条件→建议→调整→确认顺序清楚；1：顺序或衔接有缺口但仍可跟随；0：无法识别组织关系。"},
  {"key":"spelling_format","label":"拼写与格式","maxPoints":2,"anchors":"2：分句清楚、助词连写和基本空格／标点可接受；1：错误较多但仍可读；0：格式或拼写导致大部分内容不可读。"}
]}
$rubric$::jsonb;
begin
  select profile.id into v_owner_id
  from public.profiles as profile
  where profile.global_role = 'platform_owner'
    and coalesce(profile.status, 'active') = 'active'
  order by profile.created_at
  limit 1;
  if v_owner_id is null then
    raise exception '生成期中考试草稿前需要一名有效的平台负责人';
  end if;

  select test.* into v_source_test
  from public.chapter_tests as test
  where test.student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
    and test.slug = 'korean-level-one-08'
    and test.status = 'published';
  if v_source_test.id is null then
    raise exception '生成期中考试草稿前需要已发布的韩国语一级第8章源稿';
  end if;

  if exists (select 1 from public.assessment_papers where paper_code = 'EX-K1-MID-V1') then
    raise exception 'EX-K1-MID-V1 已存在；冻结版本不得覆盖，请复制为 V2';
  end if;

  insert into public.assessment_papers (
    paper_code, paper_type, title, description, source_test_id,
    student_app_id, duration_minutes, passing_score, allow_resubmission,
    resubmission_policy_configured, total_points, question_count, version,
    status, created_by, updated_by
  ) values (
    'EX-K1-MID-V1', 'exam', '韩国语一级期中考试（第1—8章）',
    '覆盖第1—8章的六项能力期中考试草稿。听力文本已冻结，当前仅标记临时音频；客观题干扰项、及格线与重复提交规则仍待内容负责人确认。',
    v_source_test.id, v_source_test.student_app_id, 75, null, false, false,
    100, 35, 1, 'draft', v_owner_id, v_owner_id
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
        when v_item ->> 1 = 'listening' and v_item ->> 8 = 'A' then v_listening_a
        when v_item ->> 1 = 'listening' and v_item ->> 8 = 'B' then v_listening_b
        when v_item ->> 1 = 'reading' and v_item ->> 8 = 'A' then v_reading_a
        when v_item ->> 1 = 'reading' and v_item ->> 8 = 'B' then v_reading_b
        else ''
      end,
      v_item ->> 3,
      case when v_item ->> 4 is null then '[]'::jsonb
        else jsonb_build_array(v_item ->> 4) end,
      (v_item ->> 2)::numeric, v_sort_order,
      case when v_item ->> 1 in ('vocabulary', 'grammar') then 'medium' else 'hard' end,
      v_item ->> 1,
      case when v_item ->> 1 = 'listening' then 'temporary' else 'not_applicable' end,
      v_item ->> 0,
      array(select jsonb_array_elements_text(v_item -> 6)),
      v_item ->> 7
    ) returning id into v_question_id;

    insert into public.assessment_paper_question_keys (
      question_id, correct_answer, explanation, rubric_snapshot
    ) values (
      v_question_id, v_item ->> 4, v_item ->> 5,
      case v_item ->> 1
        when 'speaking' then v_speaking_rubric
        when 'writing' then v_writing_rubric
        else '{}'::jsonb
      end
    );
    v_sort_order := v_sort_order + 1;
  end loop;

  if v_sort_order <> 35 or (
    select coalesce(sum(question.points), 0)
    from public.assessment_paper_questions as question
    where question.paper_id = v_paper_id
  ) <> 100 then
    raise exception '期中考试快照题量或总分与内容合同不一致';
  end if;
end;
$migration$;

-- 复制综合考试时保留全部来源与量规快照，并沿用稳定代码升级版本号。
create or replace function public.duplicate_assessment_paper(
  p_paper_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.assessment_papers%rowtype;
  v_new_id uuid;
  v_new_code text;
begin
  if not public.current_user_can_manage_assessment_papers() then
    raise exception '当前账号不能复制标准试卷';
  end if;
  select * into v_source from public.assessment_papers
  where id = p_paper_id for update;
  if not found then raise exception '试卷不存在'; end if;

  v_new_code := case
    when v_source.paper_code ~ '^(HW|EX)-K1-((0[1-9]|1[0-6])|ST0[1-4]|MID|FIN)-V[0-9]+$'
      then regexp_replace(v_source.paper_code, '-V[0-9]+$',
        '-V' || (v_source.version + 1)::text)
    else (case when v_source.paper_type = 'homework' then 'HW-' else 'EX-' end)
      || lpad(nextval('public.assessment_paper_code_seq')::text, 6, '0')
  end;

  insert into public.assessment_papers (
    paper_code, paper_type, title, description, source_test_id,
    student_app_id, duration_minutes, passing_score, allow_resubmission,
    resubmission_policy_configured, total_points, question_count, version,
    status, created_by, updated_by
  ) values (
    v_new_code, v_source.paper_type, left(v_source.title || '（新版本）', 120),
    v_source.description, v_source.source_test_id, v_source.student_app_id,
    v_source.duration_minutes, v_source.passing_score, v_source.allow_resubmission,
    v_source.resubmission_policy_configured, v_source.total_points,
    v_source.question_count, v_source.version + 1, 'draft', auth.uid(), auth.uid()
  ) returning id into v_new_id;

  with copied as (
    insert into public.assessment_paper_questions (
      paper_id, source_bank_question_id, source_bank_version, question_type,
      stimulus_text, prompt, options, points, sort_order, difficulty, skill,
      audio_status, question_code, source_chapters, source_knowledge
    )
    select v_new_id, source_bank_question_id, source_bank_version, question_type,
      stimulus_text, prompt, options, points, sort_order, difficulty, skill,
      audio_status, question_code, source_chapters, source_knowledge
    from public.assessment_paper_questions where paper_id = p_paper_id
    order by sort_order returning id, sort_order
  )
  insert into public.assessment_paper_question_keys (
    question_id, correct_answer, explanation, rubric_snapshot
  )
  select copied.id, source_key.correct_answer, source_key.explanation,
    source_key.rubric_snapshot
  from copied
  join public.assessment_paper_questions as source_question
    on source_question.paper_id = p_paper_id
   and source_question.sort_order = copied.sort_order
  join public.assessment_paper_question_keys as source_key
    on source_key.question_id = source_question.id;

  return v_new_id;
end;
$$;

commit;
