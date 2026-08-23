do $$
declare
  pattern_choice_id uuid;
  config jsonb;
  replacements jsonb := '[
    {"title":{"zh-CN":"介绍姓名","ko-KR":"이름 소개"},"scenes":[
      {"answerSide":"right","left":{"name":{"zh-CN":"智敏","ko-KR":"지민"},"line":"이름이 뭐예요?"},"right":{"name":{"zh-CN":"王明","ko-KR":"왕밍"},"meta":{"zh-CN":"姓名卡 · 王明","ko-KR":"이름 카드 · 왕밍"}}},
      {"answerSide":"right","left":{"name":{"zh-CN":"王明","ko-KR":"왕밍"},"line":"이름이 뭐예요?"},"right":{"name":{"zh-CN":"莉娜","ko-KR":"리나"},"meta":{"zh-CN":"姓名卡 · 莉娜","ko-KR":"이름 카드 · 리나"}}},
      {"answerSide":"right","left":{"name":{"zh-CN":"王明","ko-KR":"왕밍"},"line":"이름이 뭐예요?"},"right":{"name":{"zh-CN":"智敏","ko-KR":"지민"},"meta":{"zh-CN":"姓名卡 · 金智敏","ko-KR":"이름 카드 · 김지민"}}}
    ]},
    {"title":{"zh-CN":"介绍身份","ko-KR":"신분 소개"},"scenes":[
      {"answerSide":"right","left":{"name":{"zh-CN":"智敏","ko-KR":"지민"},"line":"무슨 일을 해요?"},"right":{"name":{"zh-CN":"王明","ko-KR":"왕밍"},"meta":{"zh-CN":"身份卡 · 学生","ko-KR":"신분 카드 · 학생"}}},
      {"answerSide":"right","left":{"name":{"zh-CN":"王明","ko-KR":"왕밍"},"line":"무슨 일을 해요?"},"right":{"name":{"zh-CN":"莉娜","ko-KR":"리나"},"meta":{"zh-CN":"身份卡 · 医生","ko-KR":"신분 카드 · 의사"}}},
      {"answerSide":"right","left":{"name":{"zh-CN":"莉娜","ko-KR":"리나"},"line":"무슨 일을 해요?"},"right":{"name":{"zh-CN":"智敏","ko-KR":"지민"},"meta":{"zh-CN":"身份卡 · 老师","ko-KR":"신분 카드 · 선생님"}}}
    ]},
    {"title":{"zh-CN":"询问对方","ko-KR":"상대에게 묻기"},"scenes":[
      {"answerSide":"left","left":{"name":{"zh-CN":"我","ko-KR":"나"},"meta":{"zh-CN":"选择确认问句","ko-KR":"확인 질문 고르기"}},"right":{"name":{"zh-CN":"智敏","ko-KR":"지민"},"meta":{"zh-CN":"已知信息 · 学生","ko-KR":"알고 있는 정보 · 학생"},"line":"안녕하세요."}},
      {"answerSide":"left","left":{"name":{"zh-CN":"我","ko-KR":"나"},"meta":{"zh-CN":"选择确认问句","ko-KR":"확인 질문 고르기"}},"right":{"name":{"zh-CN":"莉娜","ko-KR":"리나"},"meta":{"zh-CN":"已知信息 · 医生","ko-KR":"알고 있는 정보 · 의사"},"line":"안녕하세요."}},
      {"answerSide":"left","left":{"name":{"zh-CN":"我","ko-KR":"나"},"meta":{"zh-CN":"选择确认问句","ko-KR":"확인 질문 고르기"}},"right":{"name":{"zh-CN":"王明","ko-KR":"왕밍"},"meta":{"zh-CN":"已知信息 · 老师","ko-KR":"알고 있는 정보 · 선생님"},"line":"안녕하세요."}}
    ]}
  ]'::jsonb;
  group_index integer;
  item_index integer;
begin
  select activity.id, activity.public_config
  into pattern_choice_id, config
  from public.digital_textbook_activities as activity
  join public.digital_textbook_nodes as node on node.id = activity.node_id
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions as version on version.id = chapter.version_id
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and module.module_code = 'patterns'
    and node.node_code = 'introduce-yourself'
    and activity.activity_key = 'pattern-choice'
  order by version.version_number desc
  limit 1;

  if pattern_choice_id is null then
    raise exception 'Cannot add conversation scenes: pattern-choice activity is missing';
  end if;

  for group_index in 0..2 loop
    config := jsonb_set(config, array['groups', group_index::text, 'title'], replacements #> array[group_index::text, 'title'], true);
    for item_index in 0..2 loop
      config := jsonb_set(config, array['groups', group_index::text, 'items', item_index::text, 'scene'], replacements #> array[group_index::text, 'scenes', item_index::text], true);
    end loop;
  end loop;

  update public.digital_textbook_activities
  set public_config = config, updated_at = now()
  where id = pattern_choice_id;
end $$;
