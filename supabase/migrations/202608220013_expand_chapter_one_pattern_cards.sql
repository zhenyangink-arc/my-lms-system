do $$
declare
  pattern_node_id uuid;
begin
  select node.id into pattern_node_id
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions as version on version.id = chapter.version_id
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and module.module_code = 'patterns'
    and node.node_code = 'introduce-yourself'
  order by version.version_number desc
  limit 1;

  if pattern_node_id is null then
    raise exception 'Cannot expand chapter-one pattern cards: node is missing';
  end if;

  update public.digital_textbook_nodes
  set content = jsonb_set(
        coalesce(content, '{}'::jsonb),
        '{patternCards}',
        '[
          {"form":"저는 [이름]이에요/예요.","function":{"zh-CN":"介绍自己的姓名。","ko-KR":"자신의 이름을 소개합니다."},"examples":["저는 왕밍이에요.","저는 리나예요."]},
          {"form":"저는 [신분]이에요/예요.","function":{"zh-CN":"说明自己的身份或国籍。","ko-KR":"자신의 신분이나 국적을 말합니다."},"examples":["저는 학생이에요.","저는 중국 사람이에요."]},
          {"form":"[이름] 씨는 [신분]이에요/예요?","function":{"zh-CN":"礼貌确认对方的身份。","ko-KR":"상대의 신분을 공손하게 확인합니다."},"examples":["지민 씨는 학생이에요?","리나 씨는 선생님이에요?"]},
          {"form":"네, [신분]이에요. / 아니요, [신분]이에요.","function":{"zh-CN":"肯定身份，或者礼貌更正身份。","ko-KR":"신분을 확인하거나 공손하게 바로잡습니다."},"examples":["네, 학생이에요.","아니요, 선생님이에요."]}
        ]'::jsonb,
        true
      ),
      updated_at = now()
  where id = pattern_node_id;
end $$;
