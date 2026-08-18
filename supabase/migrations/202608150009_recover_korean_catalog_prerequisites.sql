begin;

-- Fresh migration-only databases did not contain these two production-recovered
-- catalog prerequisites. Keep the later, already-applied catalog migration
-- immutable and supply only the rows it explicitly requires.
select set_config('app.platform_content_migration', 'on', true);

alter table public.course_categories disable trigger user;

insert into public.course_categories (
  id, parent_id, slug, title, description, icon_name, accent_color,
  is_published, sort_order, tenant_id, content_scope, student_app_id
)
values
  (
    'be68db58-845c-4cc5-bfbd-c13d2398643d'::uuid,
    'b02743e2-0fd3-4eff-b4ce-fab1fd6eb555'::uuid,
    'korean-life',
    '生活韩语',
    '校园、住宿、餐饮、购物、交通与就医等在韩生活场景。',
    'MessageCircle',
    'emerald',
    true,
    2,
    null,
    'platform',
    '10000000-0000-4000-8000-000000000001'::uuid
  ),
  (
    '6c0fb0b9-4c9e-4b58-8b0f-9d4733deac8f'::uuid,
    'b02743e2-0fd3-4eff-b4ce-fab1fd6eb555'::uuid,
    'korean-topik',
    'TOPIK 备考',
    '韩国语能力考试词汇、语法、听力与阅读训练。',
    'BookOpenCheck',
    'violet',
    true,
    3,
    null,
    'platform',
    '10000000-0000-4000-8000-000000000001'::uuid
  )
on conflict (slug) where content_scope = 'platform' do update set
  parent_id = excluded.parent_id,
  slug = excluded.slug,
  title = excluded.title,
  description = excluded.description,
  icon_name = excluded.icon_name,
  accent_color = excluded.accent_color,
  is_published = excluded.is_published,
  sort_order = excluded.sort_order,
  tenant_id = excluded.tenant_id,
  content_scope = excluded.content_scope,
  student_app_id = excluded.student_app_id,
  updated_at = now();

alter table public.course_categories enable trigger user;

alter table public.courses disable trigger user;

insert into public.courses (
  id, category_id, category, slug, title, description, level, icon_name,
  is_published, sort_order, support_teacher_name, support_teacher_status,
  ai_support_enabled, support_message, tenant_id, content_scope, unlock_mode,
  is_manually_locked, student_app_id
)
values
  (
    'a3100000-0000-4000-8000-000000000003'::uuid,
    '1a933f0d-0f75-4e65-bdba-6a0097bcfc2c'::uuid,
    'korean', 'korean-intermediate', '韩语中级',
    '连接基础表达，训练场景会话、阅读与写作。', 'intermediate',
    'Languages', true, 2, '金老师', 'offline', true,
    '遇到表达组织问题时，可以向老师说明你想表达的完整意思。',
    null, 'platform', 'immediate', false,
    '10000000-0000-4000-8000-000000000001'::uuid
  ),
  (
    'a3100000-0000-4000-8000-000000000004'::uuid,
    '1a933f0d-0f75-4e65-bdba-6a0097bcfc2c'::uuid,
    'korean', 'korean-advanced', '韩语高级',
    '训练复杂表达、新闻与学术阅读、讨论和正式写作。', 'advanced',
    'Languages', true, 3, '金老师', 'offline', true,
    '可以把需要修改的观点结构和正式表达交给老师一起检查。',
    null, 'platform', 'immediate', false,
    '10000000-0000-4000-8000-000000000001'::uuid
  )
on conflict (slug) where content_scope = 'platform' do update set
  category_id = excluded.category_id,
  category = excluded.category,
  slug = excluded.slug,
  title = excluded.title,
  description = excluded.description,
  level = excluded.level,
  icon_name = excluded.icon_name,
  is_published = excluded.is_published,
  sort_order = excluded.sort_order,
  support_teacher_name = excluded.support_teacher_name,
  support_teacher_status = excluded.support_teacher_status,
  ai_support_enabled = excluded.ai_support_enabled,
  support_message = excluded.support_message,
  tenant_id = excluded.tenant_id,
  content_scope = excluded.content_scope,
  unlock_mode = excluded.unlock_mode,
  is_manually_locked = excluded.is_manually_locked,
  student_app_id = excluded.student_app_id,
  updated_at = now();

alter table public.courses enable trigger user;

alter table public.lessons disable trigger user;

with lesson_shells (id, course_slug, lesson_slug, title, description, sort_order) as (
  values
    ('a3210000-0000-4000-8000-000000000001'::uuid, 'korean-intermediate', 'intermediate-grammar-bridge', '第 1 课：中级语法衔接', '建立中级连接表达、时态语气和句子扩展能力。', 1),
    ('a3210000-0000-4000-8000-000000000002'::uuid, 'korean-intermediate', 'situational-conversation', '第 2 课：场景会话进阶', '围绕学习、生活和公共服务场景提升连贯会话能力。', 2),
    ('a3210000-0000-4000-8000-000000000003'::uuid, 'korean-intermediate', 'reading-and-writing', '第 3 课：中级阅读与写作', '训练段落理解、信息提取和基础主题写作。', 3),
    ('a3210000-0000-4000-8000-000000000004'::uuid, 'korean-advanced', 'advanced-grammar-expression', '第 1 课：高级语法与表达', '掌握复杂句式、语体差异和更自然的高级表达。', 1),
    ('a3210000-0000-4000-8000-000000000005'::uuid, 'korean-advanced', 'news-and-academic-reading', '第 2 课：新闻与学术阅读', '阅读新闻和学术类文本，训练观点与论据识别。', 2),
    ('a3210000-0000-4000-8000-000000000006'::uuid, 'korean-advanced', 'discussion-and-writing', '第 3 课：讨论与高级写作', '进行观点讨论、论证组织和正式文章写作。', 3)
)
insert into public.lessons (
  id, course_id, slug, title, description, lesson_type, duration_minutes,
  is_free_preview, is_published, sort_order, allow_questions, tenant_id,
  content_scope, unlock_mode, is_manually_locked
)
select
  shell.id, course.id, shell.lesson_slug, shell.title, shell.description,
  'text', 20, false, false, shell.sort_order, true, null, 'platform',
  'immediate', false
from lesson_shells as shell
join public.courses as course
  on course.slug = shell.course_slug
 and course.student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
 and course.content_scope = 'platform'
 and course.tenant_id is null
on conflict (course_id, slug) do nothing;

alter table public.lessons enable trigger user;

commit;
