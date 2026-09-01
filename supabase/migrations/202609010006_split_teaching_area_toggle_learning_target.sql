begin;

-- "收起/展开教学区" was a single toggle target — clicking it flips whichever
-- state currently holds, so a script node that points the assistant at it
-- can't reliably guarantee "collapsed" vs "expanded" as the end state (it
-- depends on whatever a prior step, or the student, left it at). Split it
-- into two absolute, one-way actions instead, matching how
-- "显示/隐藏学习区" already work as two separate deterministic buttons (see
-- the corresponding JSX split in KoreanLevelOneSmartTextbook.tsx).
update public.smart_textbook_learning_target_registry
set target_key = replace(target_key, ':teaching-area:toggle', ':teaching-area:collapse'),
    label = '按钮2 · 收起教学区'
where target_key like '%:teaching-area:toggle';

insert into public.smart_textbook_learning_target_registry
  (module_code, target_key, page_key, page_label, region_key, region_label, label, scope, kind, supports_student_action, sort_order)
values
  ('orientation', 'orientation:teaching-area:expand', 'teaching_area', '教学区', 'header', '教学区顶栏', '按钮3 · 展开教学区（教学区已收起时出现）', 'element', 'button', true, 102),
  ('vocabulary', 'vocabulary:teaching-area:expand', 'teaching_area', '教学区', 'header', '教学区顶栏', '按钮3 · 展开教学区（教学区已收起时出现）', 'element', 'button', true, 102),
  ('grammar', 'grammar:teaching-area:expand', 'teaching_area', '教学区', 'header', '教学区顶栏', '按钮3 · 展开教学区（教学区已收起时出现）', 'element', 'button', true, 102),
  ('patterns', 'patterns:teaching-area:expand', 'teaching_area', '教学区', 'header', '教学区顶栏', '按钮3 · 展开教学区（教学区已收起时出现）', 'element', 'button', true, 102),
  ('dialogue', 'dialogue:teaching-area:expand', 'teaching_area', '教学区', 'header', '教学区顶栏', '按钮3 · 展开教学区（教学区已收起时出现）', 'element', 'button', true, 102),
  ('listen_speak', 'listen_speak:teaching-area:expand', 'teaching_area', '教学区', 'header', '教学区顶栏', '按钮3 · 展开教学区（教学区已收起时出现）', 'element', 'button', true, 102),
  ('read_write', 'read_write:teaching-area:expand', 'teaching_area', '教学区', 'header', '教学区顶栏', '按钮3 · 展开教学区（教学区已收起时出现）', 'element', 'button', true, 102),
  ('review', 'review:teaching-area:expand', 'teaching_area', '教学区', 'header', '教学区顶栏', '按钮3 · 展开教学区（教学区已收起时出现）', 'element', 'button', true, 102);

commit;
