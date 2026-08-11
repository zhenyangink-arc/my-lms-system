begin;

insert into public.course_categories (
  id,
  parent_id,
  slug,
  title,
  description,
  icon_name,
  cover_url,
  accent_color,
  is_published,
  sort_order,
  created_at,
  updated_at
)
values (
  'b02743e2-0fd3-4eff-b4ce-fab1fd6eb555'::uuid,
  null,
  'korean',
  '韩语课程',
  '发音、语法、TOPIK、生活韩语等韩国留学基础语言课程。',
  'Languages',
  null,
  'indigo',
  true,
  2,
  '2026-07-10 03:15:59.73521+00'::timestamptz,
  '2026-07-10 03:32:32.480957+00'::timestamptz
)
on conflict do nothing;

insert into public.course_categories (
  id,
  parent_id,
  slug,
  title,
  description,
  icon_name,
  cover_url,
  accent_color,
  is_published,
  sort_order,
  created_at,
  updated_at
)
values (
  '1a933f0d-0f75-4e65-bdba-6a0097bcfc2c'::uuid,
  'b02743e2-0fd3-4eff-b4ce-fab1fd6eb555'::uuid,
  'korean-basic',
  '基础韩语',
  '韩语发音、基础词汇、基础语法和日常表达。',
  'Languages',
  null,
  'indigo',
  true,
  1,
  '2026-07-10 03:48:30.161847+00'::timestamptz,
  '2026-07-10 03:48:30.161847+00'::timestamptz
)
on conflict do nothing;

insert into public.courses (
  id,
  category_id,
  category,
  slug,
  title,
  description,
  level,
  icon_name,
  cover_url,
  is_published,
  sort_order,
  created_at,
  updated_at,
  support_teacher_name,
  support_teacher_status,
  ai_support_enabled,
  support_message
)
values (
  '2f79a679-6e25-4cf9-9f71-455905584787'::uuid,
  '1a933f0d-0f75-4e65-bdba-6a0097bcfc2c'::uuid,
  'korean',
  'korean-beginner',
  '韩语初级',
  '面向零基础学生，学习韩语发音、基础词汇、日常表达和简单语法。',
  'beginner',
  'Languages',
  null,
  true,
  1,
  '2026-07-10 03:23:56.531897+00'::timestamptz,
  '2026-07-10 03:56:05.2113+00'::timestamptz,
  '金老师',
  'online',
  true,
  '学习韩语发音时，如果不确定发音是否正确，可以向老师提问。'
)
on conflict do nothing;

insert into public.lessons (
  id,
  course_id,
  slug,
  title,
  description,
  lesson_type,
  duration_minutes,
  is_free_preview,
  is_published,
  sort_order,
  created_at,
  updated_at,
  content_text,
  video_url,
  video_provider,
  attachment_url,
  attachment_label,
  teacher_note,
  allow_questions,
  learning_objectives,
  lesson_tasks,
  key_points,
  case_study,
  common_mistakes,
  summary_text,
  reflection_questions,
  extra_note,
  video_object_key,
  video_mime_type
)
values
  (
    '6ad20a2b-2306-4173-9d3f-73eb9691ff58'::uuid,
    '2f79a679-6e25-4cf9-9f71-455905584787'::uuid,
    'hangul-introduction',
    '第 1 课：韩文字母入门',
    '认识韩文字母的基本结构和发音方式。',
    'video',
    15,
    true,
    true,
    1,
    '2026-07-10 04:22:05.262194+00'::timestamptz,
    '2026-07-10 04:22:05.262194+00'::timestamptz,
    E'韩文字母是学习韩语的第一步。韩文由元音和辅音组成，通过组合可以形成音节。\r\n\r\n学习韩文字母时，建议先掌握以下内容：\r\n\r\n1. 基础元音的形状和发音。\r\n2. 基础辅音的形状和发音。\r\n3. 元音和辅音如何组合成一个音节。\r\n4. 如何正确读出简单单词。\r\n\r\n初学阶段不要只背字母表，更重要的是反复听、跟读和书写。',
    null,
    null,
    null,
    '韩文字母练习表',
    '本课重点是掌握韩文字母结构，不要求一次记住所有发音。',
    true,
    E'完成本课后，你将能够：\r\n\r\n1. 认识韩文字母的基本结构。\r\n2. 区分韩语元音和辅音。\r\n3. 理解韩文音节组合方式。',
    E'本课任务：\r\n\r\n1. 阅读韩文字母基础说明。\r\n2. 观察元音和辅音的组合方式。\r\n3. 尝试书写 5 个简单韩文音节。\r\n4. 跟读基础发音。',
    E'本课重点：\r\n\r\n1. 韩文由元音和辅音组合形成音节。\r\n2. 初学阶段要同时练习看、听、读、写。\r\n3. 不要只背字母表，要结合发音练习。',
    E'案例分析：\r\n\r\n学生 B 学习韩语时只背字母表，但没有进行听读练习。虽然能认出字母，但看到单词时不能准确读出发音。\r\n\r\n这个案例说明，韩文字母学习必须结合发音和音节组合训练。',
    E'常见错误：\r\n\r\n1. 只背字母，不练发音。\r\n2. 混淆相似元音。\r\n3. 忽视辅音在不同位置的发音变化。\r\n4. 只看罗马音，不读韩文字母。',
    E'本课小结：\r\n\r\n韩文字母是韩语学习的基础。掌握元音、辅音和音节组合方式后，学生才能进一步学习词汇、句子和日常表达。',
    E'课后思考：\r\n\r\n1. 韩文音节由哪些部分组成？\r\n2. 你觉得最难区分的元音是哪几个？\r\n3. 你能写出 5 个简单韩文音节吗？',
    '建议学生每天用 10 分钟练习韩文字母书写和跟读。',
    null,
    'video/mp4'
  ),
  (
    '26fd3e57-e6cf-4df9-8514-646786f61e1d'::uuid,
    '2f79a679-6e25-4cf9-9f71-455905584787'::uuid,
    'basic-pronunciation',
    '第 2 课：韩国语1级',
    '学习基础元音、辅音和简单音节的发音。',
    'video',
    20,
    false,
    true,
    2,
    '2026-07-10 04:22:05.262194+00'::timestamptz,
    '2026-08-01 08:40:22.590516+00'::timestamptz,
    null, null, null, null, null, null, true,
    null, null, null, null, null, null, null, null, null,
    'video/mp4'
  ),
  (
    'e1e77ed7-832e-48af-9ac3-07d2af546c15'::uuid,
    '2f79a679-6e25-4cf9-9f71-455905584787'::uuid,
    'daily-greetings',
    '第 3 课：韩国语2级',
    '学习你好、谢谢、再见等基础日常表达。',
    'video',
    15,
    false,
    true,
    3,
    '2026-07-10 04:22:05.262194+00'::timestamptz,
    '2026-08-01 08:40:22.590516+00'::timestamptz,
    null, null, null, null, null, null, true,
    null, null, null, null, null, null, null, null, null,
    'video/mp4'
  )
on conflict do nothing;

commit;
