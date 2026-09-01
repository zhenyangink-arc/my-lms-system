begin;

-- Seed the shared header/page skeleton for the other 7 module types
-- (vocabulary, grammar, patterns, dialogue, listen_speak, read_write, review).
-- The "orientation" module was seeded separately in
-- 202609010003_add_smart_textbook_learning_target_registry.sql; these 7 share
-- the exact same header bar and per-page layout structure (see
-- src/lib/smart-textbook-skeleton.ts and the shared header-bar rendering in
-- KoreanLevelOneSmartTextbook.tsx), so their rows follow the same convention:
-- one region+hide button+N tabs+2 status labels for the header, one layout
-- target per page. Every practice activity inside these modules also becomes
-- a target automatically at read time (see buildGenericModuleLearningTargets
-- in src/lib/smart-textbook-learning-targets.ts) — those are not stored here
-- since they depend on each chapter's own authored activities.
insert into public.smart_textbook_learning_target_registry
  (module_code, target_key, page_key, page_label, region_key, region_label, label, scope, kind, supports_student_action, sort_order)
values
  ('vocabulary', 'vocabulary:header', 'header', '固定顶部栏', 'header', '顶部栏', '整个顶部栏', 'region', 'layout', false, 0),
  ('vocabulary', 'vocabulary:header:hide', 'header', '固定顶部栏', 'header', '顶部栏', '按钮1 · 隐藏学习区', 'element', 'button', false, 1),
  ('vocabulary', 'vocabulary:header:tab:scene_and_words', 'header', '固定顶部栏', 'header', '顶部栏', '页签1 · 情景词汇', 'element', 'tab', false, 2),
  ('vocabulary', 'vocabulary:header:tab:vocabulary_practice', 'header', '固定顶部栏', 'header', '顶部栏', '页签2 · 词汇练习', 'element', 'tab', false, 3),
  ('vocabulary', 'vocabulary:header:progress', 'header', '固定顶部栏', 'header', '顶部栏', '信息1 · 当前目标完成度', 'element', 'status', false, 4),
  ('vocabulary', 'vocabulary:header:goal', 'header', '固定顶部栏', 'header', '顶部栏', '信息2 · 当前目标序号', 'element', 'status', false, 5),
  ('vocabulary', 'vocabulary:page:scene_and_words', 'scene_and_words', '第1页 · 情景词汇', 'page', '整个页面', '整个"情景词汇"页面', 'page', 'layout', false, 6),
  ('vocabulary', 'vocabulary:page:vocabulary_practice', 'vocabulary_practice', '第2页 · 词汇练习', 'page', '整个页面', '整个"词汇练习"页面', 'page', 'layout', false, 7),
  ('grammar', 'grammar:header', 'header', '固定顶部栏', 'header', '顶部栏', '整个顶部栏', 'region', 'layout', false, 0),
  ('grammar', 'grammar:header:hide', 'header', '固定顶部栏', 'header', '顶部栏', '按钮1 · 隐藏学习区', 'element', 'button', false, 1),
  ('grammar', 'grammar:header:tab:grammar_explanation', 'header', '固定顶部栏', 'header', '顶部栏', '页签1 · 语法理解', 'element', 'tab', false, 2),
  ('grammar', 'grammar:header:tab:grammar_practice', 'header', '固定顶部栏', 'header', '顶部栏', '页签2 · 语法练习', 'element', 'tab', false, 3),
  ('grammar', 'grammar:header:progress', 'header', '固定顶部栏', 'header', '顶部栏', '信息1 · 当前目标完成度', 'element', 'status', false, 4),
  ('grammar', 'grammar:header:goal', 'header', '固定顶部栏', 'header', '顶部栏', '信息2 · 当前目标序号', 'element', 'status', false, 5),
  ('grammar', 'grammar:page:grammar_explanation', 'grammar_explanation', '第1页 · 语法理解', 'page', '整个页面', '整个"语法理解"页面', 'page', 'layout', false, 6),
  ('grammar', 'grammar:page:grammar_practice', 'grammar_practice', '第2页 · 语法练习', 'page', '整个页面', '整个"语法练习"页面', 'page', 'layout', false, 7),
  ('patterns', 'patterns:header', 'header', '固定顶部栏', 'header', '顶部栏', '整个顶部栏', 'region', 'layout', false, 0),
  ('patterns', 'patterns:header:hide', 'header', '固定顶部栏', 'header', '顶部栏', '按钮1 · 隐藏学习区', 'element', 'button', false, 1),
  ('patterns', 'patterns:header:tab:pattern_library', 'header', '固定顶部栏', 'header', '顶部栏', '页签1 · 句型库', 'element', 'tab', false, 2),
  ('patterns', 'patterns:header:tab:guided_substitution', 'header', '固定顶部栏', 'header', '顶部栏', '页签2 · 替换操练', 'element', 'tab', false, 3),
  ('patterns', 'patterns:header:tab:combined_output', 'header', '固定顶部栏', 'header', '顶部栏', '页签3 · 组合输出', 'element', 'tab', false, 4),
  ('patterns', 'patterns:header:progress', 'header', '固定顶部栏', 'header', '顶部栏', '信息1 · 当前目标完成度', 'element', 'status', false, 5),
  ('patterns', 'patterns:header:goal', 'header', '固定顶部栏', 'header', '顶部栏', '信息2 · 当前目标序号', 'element', 'status', false, 6),
  ('patterns', 'patterns:page:pattern_library', 'pattern_library', '第1页 · 句型库', 'page', '整个页面', '整个"句型库"页面', 'page', 'layout', false, 7),
  ('patterns', 'patterns:page:guided_substitution', 'guided_substitution', '第2页 · 替换操练', 'page', '整个页面', '整个"替换操练"页面', 'page', 'layout', false, 8),
  ('patterns', 'patterns:page:combined_output', 'combined_output', '第3页 · 组合输出', 'page', '整个页面', '整个"组合输出"页面', 'page', 'layout', false, 9),
  ('dialogue', 'dialogue:header', 'header', '固定顶部栏', 'header', '顶部栏', '整个顶部栏', 'region', 'layout', false, 0),
  ('dialogue', 'dialogue:header:hide', 'header', '固定顶部栏', 'header', '顶部栏', '按钮1 · 隐藏学习区', 'element', 'button', false, 1),
  ('dialogue', 'dialogue:header:tab:dialogue_guide', 'header', '固定顶部栏', 'header', '顶部栏', '页签1 · 对话说明', 'element', 'tab', false, 2),
  ('dialogue', 'dialogue:header:tab:scene_dialogue', 'header', '固定顶部栏', 'header', '顶部栏', '页签2 · 场景切换', 'element', 'tab', false, 3),
  ('dialogue', 'dialogue:header:tab:comprehension', 'header', '固定顶部栏', 'header', '顶部栏', '页签3 · 理解与回应', 'element', 'tab', false, 4),
  ('dialogue', 'dialogue:header:tab:roleplay', 'header', '固定顶部栏', 'header', '顶部栏', '页签4 · 角色实战', 'element', 'tab', false, 5),
  ('dialogue', 'dialogue:header:progress', 'header', '固定顶部栏', 'header', '顶部栏', '信息1 · 当前目标完成度', 'element', 'status', false, 6),
  ('dialogue', 'dialogue:header:goal', 'header', '固定顶部栏', 'header', '顶部栏', '信息2 · 当前目标序号', 'element', 'status', false, 7),
  ('dialogue', 'dialogue:page:dialogue_guide', 'dialogue_guide', '第1页 · 对话说明', 'page', '整个页面', '整个"对话说明"页面', 'page', 'layout', false, 8),
  ('dialogue', 'dialogue:page:scene_dialogue', 'scene_dialogue', '第2页 · 场景切换', 'page', '整个页面', '整个"场景切换"页面', 'page', 'layout', false, 9),
  ('dialogue', 'dialogue:page:comprehension', 'comprehension', '第3页 · 理解与回应', 'page', '整个页面', '整个"理解与回应"页面', 'page', 'layout', false, 10),
  ('dialogue', 'dialogue:page:roleplay', 'roleplay', '第4页 · 角色实战', 'page', '整个页面', '整个"角色实战"页面', 'page', 'layout', false, 11),
  ('listen_speak', 'listen_speak:header', 'header', '固定顶部栏', 'header', '顶部栏', '整个顶部栏', 'region', 'layout', false, 0),
  ('listen_speak', 'listen_speak:header:hide', 'header', '固定顶部栏', 'header', '顶部栏', '按钮1 · 隐藏学习区', 'element', 'button', false, 1),
  ('listen_speak', 'listen_speak:header:tab:listening_preparation', 'header', '固定顶部栏', 'header', '顶部栏', '页签1 · 听前准备', 'element', 'tab', false, 2),
  ('listen_speak', 'listen_speak:header:tab:listening_comprehension', 'header', '固定顶部栏', 'header', '顶部栏', '页签2 · 听辨信息', 'element', 'tab', false, 3),
  ('listen_speak', 'listen_speak:header:tab:shadowing', 'header', '固定顶部栏', 'header', '顶部栏', '页签3 · 跟读复现', 'element', 'tab', false, 4),
  ('listen_speak', 'listen_speak:header:tab:independent_speaking', 'header', '固定顶部栏', 'header', '顶部栏', '页签4 · 独立表达', 'element', 'tab', false, 5),
  ('listen_speak', 'listen_speak:header:progress', 'header', '固定顶部栏', 'header', '顶部栏', '信息1 · 当前目标完成度', 'element', 'status', false, 6),
  ('listen_speak', 'listen_speak:header:goal', 'header', '固定顶部栏', 'header', '顶部栏', '信息2 · 当前目标序号', 'element', 'status', false, 7),
  ('listen_speak', 'listen_speak:page:listening_preparation', 'listening_preparation', '第1页 · 听前准备', 'page', '整个页面', '整个"听前准备"页面', 'page', 'layout', false, 8),
  ('listen_speak', 'listen_speak:page:listening_comprehension', 'listening_comprehension', '第2页 · 听辨信息', 'page', '整个页面', '整个"听辨信息"页面', 'page', 'layout', false, 9),
  ('listen_speak', 'listen_speak:page:shadowing', 'shadowing', '第3页 · 跟读复现', 'page', '整个页面', '整个"跟读复现"页面', 'page', 'layout', false, 10),
  ('listen_speak', 'listen_speak:page:independent_speaking', 'independent_speaking', '第4页 · 独立表达', 'page', '整个页面', '整个"独立表达"页面', 'page', 'layout', false, 11),
  ('read_write', 'read_write:header', 'header', '固定顶部栏', 'header', '顶部栏', '整个顶部栏', 'region', 'layout', false, 0),
  ('read_write', 'read_write:header:hide', 'header', '固定顶部栏', 'header', '顶部栏', '按钮1 · 隐藏学习区', 'element', 'button', false, 1),
  ('read_write', 'read_write:header:tab:reading_source', 'header', '固定顶部栏', 'header', '顶部栏', '页签1 · 阅读资料', 'element', 'tab', false, 2),
  ('read_write', 'read_write:header:tab:reading_comprehension', 'header', '固定顶部栏', 'header', '顶部栏', '页签2 · 信息理解', 'element', 'tab', false, 3),
  ('read_write', 'read_write:header:tab:writing_scaffold', 'header', '固定顶部栏', 'header', '顶部栏', '页签3 · 写作搭建', 'element', 'tab', false, 4),
  ('read_write', 'read_write:header:tab:independent_writing', 'header', '固定顶部栏', 'header', '顶部栏', '页签4 · 独立写作', 'element', 'tab', false, 5),
  ('read_write', 'read_write:header:progress', 'header', '固定顶部栏', 'header', '顶部栏', '信息1 · 当前目标完成度', 'element', 'status', false, 6),
  ('read_write', 'read_write:header:goal', 'header', '固定顶部栏', 'header', '顶部栏', '信息2 · 当前目标序号', 'element', 'status', false, 7),
  ('read_write', 'read_write:page:reading_source', 'reading_source', '第1页 · 阅读资料', 'page', '整个页面', '整个"阅读资料"页面', 'page', 'layout', false, 8),
  ('read_write', 'read_write:page:reading_comprehension', 'reading_comprehension', '第2页 · 信息理解', 'page', '整个页面', '整个"信息理解"页面', 'page', 'layout', false, 9),
  ('read_write', 'read_write:page:writing_scaffold', 'writing_scaffold', '第3页 · 写作搭建', 'page', '整个页面', '整个"写作搭建"页面', 'page', 'layout', false, 10),
  ('read_write', 'read_write:page:independent_writing', 'independent_writing', '第4页 · 独立写作', 'page', '整个页面', '整个"独立写作"页面', 'page', 'layout', false, 11),
  ('review', 'review:header', 'header', '固定顶部栏', 'header', '顶部栏', '整个顶部栏', 'region', 'layout', false, 0),
  ('review', 'review:header:hide', 'header', '固定顶部栏', 'header', '顶部栏', '按钮1 · 隐藏学习区', 'element', 'button', false, 1),
  ('review', 'review:header:tab:comprehensive_check', 'header', '固定顶部栏', 'header', '顶部栏', '页签1 · 综合自测', 'element', 'tab', false, 2),
  ('review', 'review:header:tab:can_do_check', 'header', '固定顶部栏', 'header', '顶部栏', '页签2 · 能力自查', 'element', 'tab', false, 3),
  ('review', 'review:header:tab:review_result', 'header', '固定顶部栏', 'header', '顶部栏', '页签3 · 复盘结果', 'element', 'tab', false, 4),
  ('review', 'review:header:progress', 'header', '固定顶部栏', 'header', '顶部栏', '信息1 · 当前目标完成度', 'element', 'status', false, 5),
  ('review', 'review:header:goal', 'header', '固定顶部栏', 'header', '顶部栏', '信息2 · 当前目标序号', 'element', 'status', false, 6),
  ('review', 'review:page:comprehensive_check', 'comprehensive_check', '第1页 · 综合自测', 'page', '整个页面', '整个"综合自测"页面', 'page', 'layout', false, 7),
  ('review', 'review:page:can_do_check', 'can_do_check', '第2页 · 能力自查', 'page', '整个页面', '整个"能力自查"页面', 'page', 'layout', false, 8),
  ('review', 'review:page:review_result', 'review_result', '第3页 · 复盘结果', 'page', '整个页面', '整个"复盘结果"页面', 'page', 'layout', false, 9);

commit;
