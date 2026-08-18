-- Keep chapters 02-16 aligned with chapter 01:
--   * every row in the core-vocabulary table becomes one practice item;
--   * every grammar point appears in both rounds of one focused exercise.
-- Vocabulary item counts are derived from node content instead of being fixed.
-- Migration 024 originally targeted an assessment slug rather than the actual
-- chapter slug. Reapply chapter-one transcriptions here for already-linked DBs.
with vocabulary_transcriptions(ko, transcription) as (
  values
    ('저', '저'), ('이름', '이름'), ('학생', '학쌩'), ('선생님', '선생님'),
    ('친구', '친구'), ('사람', '사람'), ('만나다', '만나다'),
    ('인사하다', '인사하다'), ('소개하다', '소개하다'), ('한국어', '한구거'),
    ('처음', '처음'), ('반갑다', '반갑따')
), chapter_one_vocabulary as (
  select node.id, node.content
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions as version on version.id = chapter.version_id
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and module.module_code = 'vocabulary'
), patched_vocabulary as (
  select
    source.id,
    jsonb_agg(
      word.value || jsonb_build_object(
        'transcription', coalesce(transcription.transcription, word.value->>'ko')
      )
      order by word.ordinality
    ) as vocabulary
  from chapter_one_vocabulary as source
  cross join lateral jsonb_array_elements(source.content->'vocabulary')
    with ordinality as word(value, ordinality)
  left join vocabulary_transcriptions as transcription
    on transcription.ko = word.value->>'ko'
  group by source.id
)
update public.digital_textbook_nodes as node
set content = jsonb_set(node.content, '{vocabulary}', patched.vocabulary, false),
    updated_at = now()
from patched_vocabulary as patched
where node.id = patched.id;

do $$
declare
  chapter_row record;
  vocabulary_activity_id uuid;
  vocabulary_node_id uuid;
  vocabulary_rows jsonb;
  vocabulary_items jsonb;
  vocabulary_answers jsonb;
  vocabulary_options jsonb;
  vocabulary_distractors jsonb;
  vocabulary_item jsonb;
  vocabulary_count integer;
  vocabulary_index integer;
  correct_meaning text;
begin
  for chapter_row in
    select chapter.id, chapter.chapter_number
    from public.digital_textbook_chapters as chapter
    join public.digital_textbook_versions as version on version.id = chapter.version_id
    join public.digital_textbooks as textbook on textbook.id = version.textbook_id
    where textbook.slug = 'korean-level-one-smart'
      and chapter.chapter_number between 2 and 16
    order by chapter.chapter_number
  loop
    select activity.id, node.id, node.content->'vocabulary'
    into vocabulary_activity_id, vocabulary_node_id, vocabulary_rows
    from public.digital_textbook_modules as module
    join public.digital_textbook_nodes as node on node.module_id = module.id
    join public.digital_textbook_activities as activity on activity.node_id = node.id
    where module.chapter_id = chapter_row.id
      and module.module_code = 'vocabulary'
      and activity.activity_key = 'vocabulary-check'
    limit 1;

    vocabulary_count := coalesce(jsonb_array_length(vocabulary_rows), 0);
    if vocabulary_activity_id is null or vocabulary_count = 0 then
      raise exception 'Cannot expand chapter % vocabulary practice: activity or vocabulary rows are missing',
        chapter_row.chapter_number;
    end if;

    vocabulary_items := '[]'::jsonb;
    vocabulary_answers := '[]'::jsonb;

    for vocabulary_index in 0..vocabulary_count - 1 loop
      vocabulary_item := vocabulary_rows->vocabulary_index;
      correct_meaning := vocabulary_item->>'zh';

      select coalesce(jsonb_agg(candidate.meaning order by candidate.distance), '[]'::jsonb)
      into vocabulary_distractors
      from (
        select source.meaning, min(source.distance) as distance
        from (
          select
            vocabulary_rows->((vocabulary_index + distance) % vocabulary_count)->>'zh' as meaning,
            distance
          from generate_series(1, vocabulary_count - 1) as distance
        ) as source
        where source.meaning is not null
          and source.meaning <> correct_meaning
        group by source.meaning
        order by min(source.distance)
        limit 3
      ) as candidate;

      if jsonb_array_length(vocabulary_distractors) <> 3 then
        raise exception 'Cannot build four distinct options for chapter % vocabulary item %',
          chapter_row.chapter_number, vocabulary_index + 1;
      end if;

      vocabulary_options := jsonb_build_array(correct_meaning) || vocabulary_distractors;
      vocabulary_items := vocabulary_items || jsonb_build_array(jsonb_build_object(
        'id', format('word-%s-%s', chapter_row.chapter_number, vocabulary_index + 1),
        'question', vocabulary_item->>'ko',
        'transcription', coalesce(vocabulary_item->>'transcription', vocabulary_item->>'ko'),
        'options', vocabulary_options
      ));
      vocabulary_answers := vocabulary_answers || jsonb_build_array(0);
    end loop;

    delete from public.digital_textbook_attempts
    where activity_id = vocabulary_activity_id;

    delete from public.digital_textbook_node_progress
    where node_id = vocabulary_node_id;

    update public.digital_textbook_activities
    set activity_type = 'single_choice',
        prompt = jsonb_build_object(
          'zh-CN', format('完成 %s 个核心词的词义练习。', vocabulary_count),
          'ko-KR', format('핵심 어휘 %s개의 뜻을 모두 확인하세요.', vocabulary_count)
        ),
        instruction = jsonb_build_object(
          'zh-CN', '每个单词都练习一遍；全部作答后统一提交。',
          'ko-KR', '각 단어를 한 번씩 연습하고 모든 문항에 답한 뒤 제출하세요.'
        ),
        options = '[]'::jsonb,
        public_config = jsonb_build_object(
          'presentation', 'flip_cards',
          'focusMode', true,
          'shuffle', true,
          'shuffleOptions', true,
          'practiceRule', 'every_vocabulary_item_once',
          'sourceVocabularyCount', vocabulary_count,
          'items', vocabulary_items
        ),
        updated_at = now()
    where id = vocabulary_activity_id;

    update public.digital_textbook_activity_secrets
    set answer_key = jsonb_build_object('kind', 'index_array', 'value', vocabulary_answers),
        explanation = jsonb_build_object(
          'correct', jsonb_build_object(
            'zh-CN', format('%s 个核心词的词义均已完成。', vocabulary_count),
            'ko-KR', format('핵심 어휘 %s개의 뜻을 모두 확인했습니다.', vocabulary_count)
          ),
          'feedback', jsonb_build_array(
            jsonb_build_object('zh-CN', '先区分人物、场所、动作和状态等词类。', 'ko-KR', '사람, 장소, 동작과 상태 어휘를 먼저 구별하세요.'),
            jsonb_build_object('zh-CN', '结合词汇表中的音标和搭配逐项回想。', 'ko-KR', '어휘표의 발음 표기와 결합 표현을 함께 떠올리세요.'),
            jsonb_build_object('zh-CN', '返回核心词汇表复习错误词，再完成整组练习。', 'ko-KR', '틀린 단어를 핵심 어휘표에서 복습한 뒤 전체 연습을 다시 완성하세요.')
          )
        ),
        updated_at = now()
    where activity_id = vocabulary_activity_id;
  end loop;
end $$;

do $$
declare
  grammar_specs jsonb := $grammar_specs$
  [
    {"chapter":2,"points":[
      {"zh":"N이/가 있어요·없어요","ko":"N이/가 있어요·없어요","count":2},
      {"zh":"이/그/저 + N；이거/그거/저거","ko":"이/그/저 + N; 이거/그거/저거","count":1,"addition":{"label":"说话人和听话人都离得远：___ 우산이에요?","answer":"저"}},
      {"zh":"N 주세요","ko":"N 주세요","count":1,"addition":{"label":"공책 ___（请给我笔记本）","answer":"주세요"}},
      {"zh":"N하고 N；N과/와 N","ko":"N하고 N; N과/와 N","count":1,"addition":{"label":"책___ 공책 주세요.（有收音后的书面连接）","answer":"과"}}
    ]},
    {"chapter":3,"points":[
      {"zh":"V/A-아/어요","ko":"V/A-아/어요","count":2},
      {"zh":"N을/를","ko":"N을/를","count":2},
      {"zh":"场所 N에서","ko":"장소 N에서","count":1,"addition":{"label":"도서관___ 책을 읽어요.","answer":"에서"}},
      {"zh":"안 + V/A","ko":"안 + V/A","count":1,"addition":{"label":"오늘은 커피를 ___ 마셔요.（否定）","answer":"안"}}
    ]},
    {"chapter":4,"points":[
      {"zh":"场所 + 에 있어요/없어요","ko":"장소 + 에 있어요/없어요","count":2,"labels":["일층___ 있어요.","본관 뒤___ 있어요."]},
      {"zh":"目的地 + 에 가요/와요","ko":"목적지 + 에 가요/와요","count":2,"labels":["학생 식당___ 가요.","도서관___ 와요."]},
      {"zh":"参照物 + 方位名词 + 에","ko":"기준 장소 + 위치 명사 + 에","count":1,"labels":["사무실은 계단 ___ 있어요."],"addition":{"label":"도서관은 본관 ___ 있어요.（后面）","answer":"뒤에"}}
    ]},
    {"chapter":5,"points":[
      {"zh":"日期读法","ko":"날짜 읽기","count":1,"addition":{"label":"10월 4일 → ___","answer":"시월 사일"}},
      {"zh":"时间 + 에","ko":"시간 + 에","count":1,"addition":{"label":"월요일___ 학교에 갔어요.","answer":"에"}},
      {"zh":"V/A-았/었어요","ko":"V/A-았/었어요","count":3},
      {"zh":"V-고","ko":"V-고","count":1,"addition":{"label":"친구를 만나___ 밥을 먹었어요.","answer":"고"}}
    ]},
    {"chapter":6,"points":[
      {"zh":"V-(으)세요","ko":"V-(으)세요","count":2},
      {"zh":"固有词数 + 量词","ko":"고유어 수 + 단위 명사","count":2},
      {"zh":"N이/가 + 形容词","ko":"N이/가 + 형용사","count":1,"addition":{"label":"사과___ 싸요.（主格助词）","answer":"가"}},
      {"zh":"N도","ko":"N도","count":1,"addition":{"label":"바나나___ 두 개 주세요.（也）","answer":"도"}}
    ]},
    {"chapter":7,"points":[
      {"zh":"ㅂ 不规则礼貌体","ko":"ㅂ 불규칙 해요체","count":2},
      {"zh":"V/A-지만","ko":"V/A-지만","count":1,"addition":{"label":"비가 오___ 따뜻해요.（转折）","answer":"지만"}},
      {"zh":"V/A-(스)ㅂ니다","ko":"V/A-(스)ㅂ니다","count":2},
      {"zh":"V/A-고","ko":"V/A-고","count":1,"addition":{"label":"날씨가 맑___ 따뜻합니다.（并列）","answer":"고"}}
    ]},
    {"chapter":8,"points":[
      {"zh":"V-(으)ㄹ까요?","ko":"V-(으)ㄹ까요?","count":2,"indices":[0,1]},
      {"zh":"ㄷ 不规则","ko":"ㄷ 불규칙","count":2,"indices":[2,5]},
      {"zh":"이/그/저 + N","ko":"이/그/저 + N","count":1,"indices":[3],"addition":{"label":"双方都离得远：___ 전시회에 갈까요?","answer":"저"}},
      {"zh":"V/A-네요","ko":"V/A-네요","count":1,"indices":[4],"addition":{"label":"날씨가 좋___!（刚发现）","answer":"네요"}}
    ]},
    {"chapter":9,"points":[
      {"zh":"N의 N","ko":"N의 N","count":1,"addition":{"label":"민수 씨___ 어머니（表示所属）","answer":"의"}},
      {"zh":"N을/를 잘하다","ko":"N을/를 잘하다","count":1,"addition":{"label":"운동___ 잘하세요.","answer":"을"}},
      {"zh":"N(이)세요","ko":"N(이)세요","count":2},
      {"zh":"V-(으)시-","ko":"V-(으)시-","count":2}
    ]},
    {"chapter":10,"points":[
      {"zh":"韩语时间表达","ko":"한국어 시간 표현","count":1,"addition":{"label":"上午9:30（写韩语时间短语）→ ___","answer":"오전 아홉 시 반"}},
      {"zh":"N부터 N까지","ko":"N부터 N까지","count":2},
      {"zh":"V-아서/어서（动作衔接）","ko":"V-아서/어서（동작 연결）","count":1,"addition":{"label":"도서관에 가다 → 도서관에 ___ 공부해요.","answer":"가서"}},
      {"zh":"V-(으)ㄹ 거예요","ko":"V-(으)ㄹ 거예요","count":2}
    ]},
    {"chapter":11,"points":[
      {"zh":"ㅡ 脱落礼貌体","ko":"ㅡ 탈락 해요체","count":2},
      {"zh":"V-지 마세요","ko":"V-지 마세요","count":1,"addition":{"label":"찬 음료를 마시다 → 찬 음료를 ___","answer":"마시지 마세요"}},
      {"zh":"N만","ko":"N만","count":1,"addition":{"label":"물___ 마셔요.（只）","answer":"만"}},
      {"zh":"V-아/어야 돼요","ko":"V-아/어야 돼요","count":2}
    ]},
    {"chapter":12,"points":[
      {"zh":"V-지요?","ko":"V-지요?","count":1,"addition":{"label":"내일 학교에 가___?（确认约定，保留问号）","answer":"지요?"}},
      {"zh":"N(이)지요?","ko":"N(이)지요?","count":2},
      {"zh":"V-고 있어요","ko":"V-고 있어요","count":1,"addition":{"label":"공부하다 → 공부___（正在学习）","answer":"하고 있어요"}},
      {"zh":"못 + V","ko":"못 + V","count":1,"addition":{"label":"오늘은 학교에 ___ 가요.（不能去）","answer":"못"}},
      {"zh":"V/A-아서/어서（原因）","ko":"V/A-아서/어서（이유）","count":2}
    ]},
    {"chapter":13,"points":[
      {"zh":"V-(으)려고 하다","ko":"V-(으)려고 하다","count":2},
      {"zh":"N에서 N까지","ko":"N에서 N까지","count":2},
      {"zh":"V-아/어 주세요","ko":"V-아/어 주세요","count":1,"addition":{"label":"기다리다 → ___（礼貌请求等待）","answer":"기다려 주세요"}},
      {"zh":"N(으)로","ko":"N(으)로","count":3}
    ]},
    {"chapter":14,"points":[
      {"zh":"A-(으)ㄴ N","ko":"A-(으)ㄴ N","count":3,"indices":[0,1,3]},
      {"zh":"ㄹ 脱落定语","ko":"ㄹ 탈락 관형형","count":1,"indices":[2],"addition":{"label":"멀다 → ___ 곳（ㄹ脱落定语）","answer":"먼"}},
      {"zh":"V-아/어 보세요","ko":"V-아/어 보세요","count":2,"indices":[4,5]},
      {"zh":"N한테/께","ko":"N한테/께","count":2,"indices":[6,7]}
    ]},
    {"chapter":15,"points":[
      {"zh":"A/V-(으)면","ko":"A/V-(으)면","count":7},
      {"zh":"V-는 N","ko":"V-는 N","count":3},
      {"zh":"V-고 싶다","ko":"V-고 싶다","count":1,"addition":{"label":"보다（说话人本人愿望；礼貌体）","answer":"보고 싶어요"}},
      {"zh":"V-고 싶어 하다","ko":"V-고 싶어 하다","count":1,"labels":["谈论朋友：찍다（第三人愿望；礼貌体）"],"addition":{"label":"谈论弟弟/妹妹：가다（第三人愿望；礼貌体）","answer":"가고 싶어 해요"}}
    ]},
    {"chapter":16,"points":[
      {"zh":"V-(으)ㄹ 수 있다/없다","ko":"V-(으)ㄹ 수 있다/없다","count":2},
      {"zh":"V-(으)ㄹ게요","ko":"V-(으)ㄹ게요","count":2},
      {"zh":"V-(으)러 가다/오다","ko":"V-(으)러 가다/오다","count":2},
      {"zh":"V-(으)면서","ko":"V-(으)면서","count":2}
    ]}
  ]
  $grammar_specs$::jsonb;
  chapter_spec jsonb;
  point_spec jsonb;
  chapter_row record;
  grammar_activity_id uuid;
  grammar_node_id uuid;
  existing_items jsonb;
  existing_answers jsonb;
  first_round_items jsonb;
  second_round_items jsonb;
  first_round_answers jsonb;
  second_round_answers jsonb;
  merged_items jsonb;
  merged_answers jsonb;
  current_item jsonb;
  addition jsonb;
  point_count integer;
  existing_count integer;
  source_index integer;
  source_item_index integer;
  extra_index integer;
  point_index integer;
  expected_existing_count integer;
  grammar_point_count integer;
  answers_text text;
begin
  for chapter_row in
    select chapter.id, chapter.chapter_number
    from public.digital_textbook_chapters as chapter
    join public.digital_textbook_versions as version on version.id = chapter.version_id
    join public.digital_textbooks as textbook on textbook.id = version.textbook_id
    where textbook.slug = 'korean-level-one-smart'
      and chapter.chapter_number between 2 and 16
    order by chapter.chapter_number
  loop
    select value into chapter_spec
    from jsonb_array_elements(grammar_specs)
    where (value->>'chapter')::integer = chapter_row.chapter_number;

    select activity.id, node.id, activity.public_config->'items', secret.answer_key->'value'
    into grammar_activity_id, grammar_node_id, existing_items, existing_answers
    from public.digital_textbook_modules as module
    join public.digital_textbook_nodes as node on node.module_id = module.id
    join public.digital_textbook_activities as activity on activity.node_id = node.id
    join public.digital_textbook_activity_secrets as secret on secret.activity_id = activity.id
    where module.chapter_id = chapter_row.id
      and module.module_code = 'grammar'
      and activity.activity_key = 'grammar-fill'
    limit 1;

    if chapter_spec is null or grammar_activity_id is null then
      raise exception 'Cannot expand chapter % grammar practice: specification or activity is missing',
        chapter_row.chapter_number;
    end if;

    select coalesce(sum((value->>'count')::integer), 0)
    into expected_existing_count
    from jsonb_array_elements(chapter_spec->'points');

    if jsonb_array_length(existing_items) <> expected_existing_count
       or jsonb_array_length(existing_answers) <> expected_existing_count then
      raise exception 'Chapter % grammar source count changed: expected %, got % items and % answers',
        chapter_row.chapter_number,
        expected_existing_count,
        jsonb_array_length(existing_items),
        jsonb_array_length(existing_answers);
    end if;

    first_round_items := '[]'::jsonb;
    second_round_items := '[]'::jsonb;
    first_round_answers := '[]'::jsonb;
    second_round_answers := '[]'::jsonb;
    source_index := 0;
    point_index := 0;
    grammar_point_count := jsonb_array_length(chapter_spec->'points');

    for point_spec in
      select value from jsonb_array_elements(chapter_spec->'points')
    loop
      point_index := point_index + 1;
      point_count := (point_spec->>'count')::integer;

      source_item_index := case
        when point_spec ? 'indices' then (point_spec->'indices'->>0)::integer
        else source_index
      end;
      current_item := existing_items->source_item_index;
      if point_spec ? 'labels' and jsonb_array_length(point_spec->'labels') > 0 then
        current_item := current_item || jsonb_build_object('label', point_spec->'labels'->>0);
      end if;
      current_item := current_item || jsonb_build_object(
        'id', format('chapter-%s-round-1-point-%s', chapter_row.chapter_number, point_index),
        'group', '第一轮',
        'groupKo', '첫 번째 연습',
        'grammarPoint', point_spec->>'zh',
        'grammarPointKo', point_spec->>'ko'
      );
      first_round_items := first_round_items || jsonb_build_array(current_item);
      first_round_answers := first_round_answers || jsonb_build_array(existing_answers->source_item_index);

      if point_count >= 2 then
        source_item_index := case
          when point_spec ? 'indices' then (point_spec->'indices'->>1)::integer
          else source_index + 1
        end;
        current_item := existing_items->source_item_index;
        if point_spec ? 'labels' and jsonb_array_length(point_spec->'labels') > 1 then
          current_item := current_item || jsonb_build_object('label', point_spec->'labels'->>1);
        end if;
        second_round_answers := second_round_answers || jsonb_build_array(existing_answers->source_item_index);
      else
        addition := point_spec->'addition';
        if addition is null then
          raise exception 'Chapter % grammar point % needs a second exercise',
            chapter_row.chapter_number, point_index;
        end if;
        current_item := jsonb_build_object(
          'label', addition->>'label',
          'placeholder', '请输入答案'
        );
        second_round_answers := second_round_answers || jsonb_build_array(addition->'answer');
      end if;

      current_item := current_item || jsonb_build_object(
        'id', format('chapter-%s-round-2-point-%s', chapter_row.chapter_number, point_index),
        'group', '第二轮',
        'groupKo', '두 번째 연습',
        'grammarPoint', point_spec->>'zh',
        'grammarPointKo', point_spec->>'ko'
      );
      second_round_items := second_round_items || jsonb_build_array(current_item);

      if point_count > 2 then
        for extra_index in 2..point_count - 1 loop
          source_item_index := case
            when point_spec ? 'indices' then (point_spec->'indices'->>extra_index)::integer
            else source_index + extra_index
          end;
          current_item := existing_items->source_item_index;
          if point_spec ? 'labels' and jsonb_array_length(point_spec->'labels') > extra_index then
            current_item := current_item || jsonb_build_object('label', point_spec->'labels'->>extra_index);
          end if;
          current_item := current_item || jsonb_build_object(
            'id', format('chapter-%s-round-2-point-%s-extra-%s', chapter_row.chapter_number, point_index, extra_index - 1),
            'group', '第二轮',
            'groupKo', '두 번째 연습',
            'grammarPoint', point_spec->>'zh',
            'grammarPointKo', point_spec->>'ko'
          );
          second_round_items := second_round_items || jsonb_build_array(current_item);
          second_round_answers := second_round_answers || jsonb_build_array(existing_answers->source_item_index);
        end loop;
      end if;

      source_index := source_index + point_count;
    end loop;

    merged_items := first_round_items || second_round_items;
    merged_answers := first_round_answers || second_round_answers;

    if jsonb_array_length(merged_items) < grammar_point_count * 2
       or jsonb_array_length(merged_items) <> jsonb_array_length(merged_answers) then
      raise exception 'Chapter % grammar expansion failed validation', chapter_row.chapter_number;
    end if;

    select string_agg(value, '、' order by ordinality)
    into answers_text
    from jsonb_array_elements_text(merged_answers) with ordinality;

    delete from public.digital_textbook_attempts
    where activity_id = grammar_activity_id;

    delete from public.digital_textbook_node_progress
    where node_id = grammar_node_id;

    update public.digital_textbook_activities
    set prompt = jsonb_build_object(
          'zh-CN', format('连续完成两轮 %s 小题，覆盖本章每个语法点。', jsonb_array_length(merged_items)),
          'ko-KR', format('두 번의 연습, %s문항으로 이 단원의 모든 문법 항목을 확인하세요.', jsonb_array_length(merged_items))
        ),
        instruction = jsonb_build_object(
          'zh-CN', '每个语法点至少练习两遍；两轮全部作答后统一提交。',
          'ko-KR', '각 문법 항목을 두 번 이상 연습하고 두 번의 연습을 모두 푼 뒤 제출하세요.'
        ),
        public_config = public_config || jsonb_build_object(
          'focusMode', true,
          'shuffle', false,
          'practiceRule', 'each_grammar_point_twice',
          'grammarPointCount', grammar_point_count,
          'items', merged_items
        ),
        updated_at = now()
    where id = grammar_activity_id;

    update public.digital_textbook_activity_secrets
    set answer_key = jsonb_build_object('kind', 'text_array', 'value', merged_answers),
        explanation = jsonb_build_object(
          'correct', jsonb_build_object(
            'zh-CN', format('两轮答案依次为：%s。', answers_text),
            'ko-KR', format('두 번의 연습 답은 차례로 %s입니다.', answers_text)
          ),
          'feedback', jsonb_build_array(
            jsonb_build_object('zh-CN', '先按题目上方的语法点判断功能，再检查词干和收音。', 'ko-KR', '문항 위 문법 항목의 기능을 먼저 판단하고 어간과 받침을 확인하세요.'),
            jsonb_build_object('zh-CN', '对照第一轮与第二轮，找出同一语法在不同词形中的变化。', 'ko-KR', '첫 번째와 두 번째 연습을 비교해 같은 문법의 형태 변화를 찾으세요.'),
            jsonb_build_object('zh-CN', '返回语法解说复习错误点，再完成两轮全部题目。', 'ko-KR', '틀린 문법 설명을 복습한 뒤 두 번의 연습을 모두 다시 완성하세요.')
          )
        ),
        updated_at = now()
    where activity_id = grammar_activity_id;
  end loop;
end $$;
