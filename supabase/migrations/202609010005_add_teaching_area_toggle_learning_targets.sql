begin;

-- The "隐藏学习区" button (already registered as "<module>:header:hide") only
-- toggles the panel off — a teacher stepping through a script needs to be
-- able to bring it back too, and separately collapse/expand the teaching
-- area column itself. All three are real, clickable UI-chrome toggles the
-- teacher may want the assistant to actually press mid-lesson (see
-- KoreanLevelOneSmartTextbook.tsx's "显示学习区"/"收起教学区" buttons), so
-- they're marked supports_student_action so they're selectable for both
-- "老师讲解指向" and "宠物代点".
update public.smart_textbook_learning_target_registry
set supports_student_action = true
where target_key like '%:header:hide';

insert into public.smart_textbook_learning_target_registry
  (module_code, target_key, page_key, page_label, region_key, region_label, label, scope, kind, supports_student_action, sort_order)
values
  ('orientation', 'orientation:teaching-area:show-learning-area', 'teaching_area', '教学区', 'header', '教学区顶栏', '按钮1 · 显示学习区（学习区被隐藏时出现）', 'element', 'button', true, 100),
  ('orientation', 'orientation:teaching-area:toggle', 'teaching_area', '教学区', 'header', '教学区顶栏', '按钮2 · 收起/展开教学区', 'element', 'button', true, 101),
  ('vocabulary', 'vocabulary:teaching-area:show-learning-area', 'teaching_area', '教学区', 'header', '教学区顶栏', '按钮1 · 显示学习区（学习区被隐藏时出现）', 'element', 'button', true, 100),
  ('vocabulary', 'vocabulary:teaching-area:toggle', 'teaching_area', '教学区', 'header', '教学区顶栏', '按钮2 · 收起/展开教学区', 'element', 'button', true, 101),
  ('grammar', 'grammar:teaching-area:show-learning-area', 'teaching_area', '教学区', 'header', '教学区顶栏', '按钮1 · 显示学习区（学习区被隐藏时出现）', 'element', 'button', true, 100),
  ('grammar', 'grammar:teaching-area:toggle', 'teaching_area', '教学区', 'header', '教学区顶栏', '按钮2 · 收起/展开教学区', 'element', 'button', true, 101),
  ('patterns', 'patterns:teaching-area:show-learning-area', 'teaching_area', '教学区', 'header', '教学区顶栏', '按钮1 · 显示学习区（学习区被隐藏时出现）', 'element', 'button', true, 100),
  ('patterns', 'patterns:teaching-area:toggle', 'teaching_area', '教学区', 'header', '教学区顶栏', '按钮2 · 收起/展开教学区', 'element', 'button', true, 101),
  ('dialogue', 'dialogue:teaching-area:show-learning-area', 'teaching_area', '教学区', 'header', '教学区顶栏', '按钮1 · 显示学习区（学习区被隐藏时出现）', 'element', 'button', true, 100),
  ('dialogue', 'dialogue:teaching-area:toggle', 'teaching_area', '教学区', 'header', '教学区顶栏', '按钮2 · 收起/展开教学区', 'element', 'button', true, 101),
  ('listen_speak', 'listen_speak:teaching-area:show-learning-area', 'teaching_area', '教学区', 'header', '教学区顶栏', '按钮1 · 显示学习区（学习区被隐藏时出现）', 'element', 'button', true, 100),
  ('listen_speak', 'listen_speak:teaching-area:toggle', 'teaching_area', '教学区', 'header', '教学区顶栏', '按钮2 · 收起/展开教学区', 'element', 'button', true, 101),
  ('read_write', 'read_write:teaching-area:show-learning-area', 'teaching_area', '教学区', 'header', '教学区顶栏', '按钮1 · 显示学习区（学习区被隐藏时出现）', 'element', 'button', true, 100),
  ('read_write', 'read_write:teaching-area:toggle', 'teaching_area', '教学区', 'header', '教学区顶栏', '按钮2 · 收起/展开教学区', 'element', 'button', true, 101),
  ('review', 'review:teaching-area:show-learning-area', 'teaching_area', '教学区', 'header', '教学区顶栏', '按钮1 · 显示学习区（学习区被隐藏时出现）', 'element', 'button', true, 100),
  ('review', 'review:teaching-area:toggle', 'teaching_area', '教学区', 'header', '教学区顶栏', '按钮2 · 收起/展开教学区', 'element', 'button', true, 101);

commit;
