-- 智能教材只保存教学内容，不保存纯装饰性的眉题或技术类型标签。
-- 活动类型仍保留在结构化 activity_type 字段中供程序判断，但不直接展示给学生。

update public.digital_textbook_nodes
set
  content = content
    - 'eyebrow'
    - 'typeLabel'
    - 'type_label'
    - 'interactionLabel'
    - 'interaction_label',
  updated_at = now()
where content ?| array[
  'eyebrow',
  'typeLabel',
  'type_label',
  'interactionLabel',
  'interaction_label'
];

alter table public.digital_textbook_nodes
  drop constraint if exists digital_textbook_nodes_no_decorative_labels_check;

alter table public.digital_textbook_nodes
  add constraint digital_textbook_nodes_no_decorative_labels_check
  check (
    not (
      content ?| array[
        'eyebrow',
        'typeLabel',
        'type_label',
        'interactionLabel',
        'interaction_label'
      ]
    )
  );
