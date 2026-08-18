-- Replace the single-word check with one grouped exercise covering all 12
-- chapter-one core words. Prior attempts target different content and cannot
-- count as completion evidence for the expanded exercise.
do $$
declare
  vocabulary_activity_id uuid;
  vocabulary_node_id uuid;
begin
  select activity.id, activity.node_id
  into vocabulary_activity_id, vocabulary_node_id
  from public.digital_textbook_activities activity
  join public.digital_textbook_nodes node on node.id = activity.node_id
  join public.digital_textbook_modules module on module.id = node.module_id
  join public.digital_textbook_chapters chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions version on version.id = chapter.version_id
  join public.digital_textbooks textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and node.node_code = 'people-and-greetings'
    and activity.activity_key = 'vocabulary-check'
  limit 1;

  if vocabulary_activity_id is null then
    raise exception 'Cannot expand chapter-one vocabulary practice: activity is missing';
  end if;

  delete from public.digital_textbook_attempts
  where activity_id = vocabulary_activity_id;

  delete from public.digital_textbook_node_progress
  where node_id = vocabulary_node_id;

  update public.digital_textbook_activities
  set prompt = '{"zh-CN":"完成 12 个核心词的词义练习。","ko-KR":"핵심 어휘 12개의 뜻을 모두 확인하세요."}'::jsonb,
      instruction = '{"zh-CN":"每个单词选择一个正确释义，12 题全部作答后统一提交。","ko-KR":"각 단어에 맞는 뜻을 하나씩 고르고 12문항을 모두 푼 뒤 제출하세요."}'::jsonb,
      options = '[]'::jsonb,
      public_config = '{"presentation":"flip_cards","shuffle":true,"shuffleOptions":true,"items":[{"id":"word-jeo","question":"저","options":["我（谦称）","名字","朋友","老师"]},{"id":"word-ireum","question":"이름","options":["名字","学生","问候","韩语"]},{"id":"word-haksaeng","question":"학생","options":["老师","学生","朋友","人"]},{"id":"word-seonsaengnim","question":"선생님","options":["朋友","老师","学生","名字"]},{"id":"word-chingu","question":"친구","options":["人","老师","朋友","我（谦称）"]},{"id":"word-saram","question":"사람","options":["学生","人","第一次","见面"]},{"id":"word-mannada","question":"만나다","options":["问候","介绍","见面","学习"]},{"id":"word-insahada","question":"인사하다","options":["学习","介绍","问候","见面"]},{"id":"word-sogaehada","question":"소개하다","options":["介绍","问候","高兴、荣幸","韩语"]},{"id":"word-hangugeo","question":"한국어","options":["中国人","名字","韩语","老师"]},{"id":"word-cheoeum","question":"처음","options":["一起","第一次","朋友","高兴、荣幸"]},{"id":"word-bangapda","question":"반갑다","options":["询问","学习","高兴、荣幸","介绍"]}]}'::jsonb,
      max_attempts = 3,
      updated_at = now()
  where id = vocabulary_activity_id;

  update public.digital_textbook_activity_secrets
  set answer_key = '{"kind":"index_array","value":[0,0,1,1,2,1,2,2,0,2,1,2]}'::jsonb,
      explanation = '{"correct":{"zh-CN":"12 个核心词的词义均已掌握。","ko-KR":"핵심 어휘 12개의 뜻을 모두 바르게 확인했습니다."},"feedback":[{"zh-CN":"先区分人物身份词、动作词和功能表达。","ko-KR":"인물·신분 어휘, 동작 어휘와 기능 표현을 먼저 나누세요."},{"zh-CN":"结合词汇表中的搭配提示逐项回想，不要只凭选项位置作答。","ko-KR":"어휘표의 결합 표현을 떠올리며 각 단어의 뜻을 확인하세요."},{"zh-CN":"返回核心词汇表复习错误词，再完成全部 12 题。","ko-KR":"틀린 단어를 핵심 어휘표에서 복습한 뒤 12문항을 다시 완성하세요."}]}'::jsonb,
      updated_at = now()
  where activity_id = vocabulary_activity_id;
end $$;
