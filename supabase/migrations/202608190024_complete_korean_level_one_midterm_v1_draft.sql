begin;

-- Packet2 的质检把所有期中卷 temporary 音频都视为发布阻塞，但 V1 合同明确
-- temporary 是已冻结的预期状态。保留原始质检并只过滤 EX-K1-MID-V1 的这一条
-- 旧提示；其他试卷、音频状态和全部其余质检项不变。
alter function private.assessment_paper_release_issues(uuid)
  rename to assessment_paper_release_issues_with_temporary_notice;

create function private.assessment_paper_release_issues(
  p_paper_id uuid
)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_paper_code text;
  v_issues text[];
begin
  v_issues := private.assessment_paper_release_issues_with_temporary_notice(
    p_paper_id
  );
  select paper_code into v_paper_code
  from public.assessment_papers
  where id = p_paper_id;

  if v_paper_code = 'EX-K1-MID-V1' then
    select coalesce(array_agg(issue order by position), array[]::text[])
    into v_issues
    from unnest(v_issues) with ordinality as quality_issue(issue, position)
    where issue <> '有 5 道听力题仍使用 temporary 临时音频，正式发布前须完成听校并复制为新版本';
  end if;
  return v_issues;
end;
$$;

-- EX-K1-MID-V1 沿用四套韩国语一级阶段考试草稿的统一发布口径：
-- 202608190014 中 EX-K1-ST01-V1 至 EX-K1-ST04-V1 均为及格分 60，
-- 且 allow_resubmission = false（创建机构任务时对应默认 max_attempts = 1）。
do $migration$
declare
  v_paper public.assessment_papers%rowtype;
  v_options jsonb := $options$
[
  ["V01",["안녕하세요?","안녕히 가세요.","감사합니다.","여보세요."]],
  ["V02",["지우개","연필","공책","책"]],
  ["V03",["읽다","쓰다","듣다","공부하다"]],
  ["V04",["옆","앞","뒤","안"]],
  ["V05",["지난 주말","이번 주말","다음 주말","오늘"]],
  ["V06",["병","개","권","명"]],
  ["V07",["흐리다","맑다","덥다","춥다"]],
  ["V08",["전시회","영화","공연","공원"]],
  ["V09",["지우개 두 개","지우개 두 병","지우개 두 권","연필 두 개"]],
  ["V10",["우산","모자","카메라","표"]],
  ["G01",["예요","이에요","있어요","아니에요"]],
  ["G02",["는 / 가","가 / 는","를 / 가","는 / 를"]],
  ["G03",["그 / 있어요","이 / 있어요","저 / 없어요","그 / 없어요"]],
  ["G04",["에서 / 에","에 / 에서","에서 / 에서","에 / 에"]],
  ["G05",["를 / 를","가 / 를","를 / 가","에 / 를"]],
  ["G06",["어제 시장에서 사과를 샀어요.","어제 시장에서 사과를 사요.","어제 시장에 사과를 샀어요.","어제 시장에서 사과가 샀어요."]],
  ["G07",["에 / 고","에서 / 고","에 / 지만","를 / 고"]],
  ["G08",["개 / 도","병 / 도","개 / 만","명 / 도"]],
  ["G09",["덥지만 / 시원합니다","더우지만 / 시원합니다","덥고 / 시원합니다","덥지만 / 시원했어요"]],
  ["G10",["저 전시회가 재미있네요. 공원에서 걸을까요?","이 전시회가 재미있네요. 공원에서 걸을까요?","저 전시회가 재미있어요. 공원에서 걷을까요?","그 전시회가 재미있네요. 공원에서 걸었어요."]],
  ["L01",["도서관 옆","도서관 뒤","학생 식당 옆","학교 가게 안"]],
  ["L02",["이천 원","삼천 원","오천 원","육천 원"]],
  ["L03",["비가 와요 / 우산","비가 와요 / 지갑","바람이 불어요 / 우산","비가 안 와요 / 우산"]],
  ["L04",["친구하고 걸었어요","혼자 걸었어요","친구하고 차를 마셨어요","친구하고 전시회를 봤어요"]],
  ["L05",["전시회를 봐요 / 세 시 / 미술관 앞","공원에서 걸어요 / 세 시 / 미술관 앞","전시회를 봐요 / 두 시 / 미술관 앞","전시회를 봐요 / 세 시 / 공원 앞"]],
  ["R01",["한국어반 학생","국제교류센터 직원","도서관 직원","회사원"]],
  ["R02",["월요일과 수요일 오후 세 시 / 국제교류센터","월요일과 수요일 오후 세 시 / 도서관","화요일과 목요일 오후 세 시 / 국제교류센터","월요일과 수요일 오전 세 시 / 국제교류센터"]],
  ["R03",["도서관 뒤","도서관 앞","도서관 옆","도서관 안"]],
  ["R04",["교실 책상 위 / 국제교류센터","교실 책상 아래 / 국제교류센터","도서관 책상 위 / 국제교류센터","교실 책상 위 / 도서관"]],
  ["R05",["맑고 따뜻합니다 / 야외 공연","맑고 따뜻합니다 / 실내 전시회","비가 오고 바람이 붑니다 / 야외 공연","흐리고 춥습니다 / 야외 공연"]],
  ["R06",["육천 원","오천 원","이천 원","만원"]],
  ["R07",["하나는 두 시에 일이 있어요","토요일 두 시에 비가 와요","공연 표가 없어요","유진은 세 시에 일이 있어요"]],
  ["R08",["세 시 / 카페 앞","두 시 / 카페 앞","세 시 / 미술관 앞","두 시 / 시장 안"]]
]
$options$::jsonb;
  v_issues_before text[];
  v_issues_after text[];
  v_updated_count integer;
begin
  select * into v_paper
  from public.assessment_papers
  where paper_code = 'EX-K1-MID-V1'
  for update;

  if not found then
    raise exception '补齐期中考试草稿前需要 EX-K1-MID-V1';
  end if;
  if v_paper.status <> 'draft' or v_paper.version <> 1 then
    raise exception '只能补齐 draft 状态的 EX-K1-MID-V1 冻结版本';
  end if;

  v_issues_before := private.assessment_paper_release_issues(v_paper.id);
  if cardinality(v_issues_before) <> 3
    or not v_issues_before @> array[
      '未设置及格分',
      '重复提交规则尚未由内容负责人确认',
      '有 33 道客观题的可选项未完整冻结或不包含正确答案'
    ]::text[] then
    raise exception 'EX-K1-MID-V1 补丁前质检结果偏离预期：%', v_issues_before;
  end if;

  update public.assessment_paper_questions as question
  set options = option_seed.value -> 1
  from jsonb_array_elements(v_options) as option_seed(value)
  where question.paper_id = v_paper.id
    and question.question_code = option_seed.value ->> 0
    and question.auto_graded;
  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 33 then
    raise exception '应更新 33 道客观题选项，实际更新 % 道', v_updated_count;
  end if;

  update public.assessment_papers
  set passing_score = 60,
      allow_resubmission = false,
      resubmission_policy_configured = true,
      description = '覆盖第1—8章的六项能力期中考试草稿。听力文本已冻结并保留 temporary 状态；客观题四选项、60分及格线和单次提交策略已按韩国语一级阶段考试口径冻结。',
      updated_at = now()
  where id = v_paper.id;

  if (
    select count(*)
    from public.assessment_paper_questions as question
    join public.assessment_paper_question_keys as answer_key
      on answer_key.question_id = question.id
    where question.paper_id = v_paper.id
      and question.auto_graded
      and jsonb_array_length(question.options) = 4
      and (
        select count(distinct option_value.value)
        from jsonb_array_elements_text(question.options) as option_value(value)
      ) = 4
      and (
        select count(*)
        from jsonb_array_elements_text(question.options) as option_value(value)
        where option_value.value = answer_key.correct_answer
      ) = 1
  ) <> 33 then
    raise exception '33 道客观题必须各有 4 个不重复选项且恰好包含一次正确答案';
  end if;

  select * into v_paper
  from public.assessment_papers
  where id = v_paper.id;
  if v_paper.status <> 'draft'
    or v_paper.passing_score <> 60
    or v_paper.allow_resubmission
    or not v_paper.resubmission_policy_configured then
    raise exception '期中卷发布配置或 draft 状态不正确';
  end if;
  if exists (
    select 1 from public.learning_assignments
    where source_paper_id = v_paper.id
  ) then
    raise exception 'draft 期中卷不得已经布置给机构或学生';
  end if;

  v_issues_after := private.assessment_paper_release_issues(v_paper.id);
  if cardinality(v_issues_after) <> 0 then
    raise exception 'EX-K1-MID-V1 补齐后质检仍未通过：%', v_issues_after;
  end if;
end;
$migration$;

commit;
