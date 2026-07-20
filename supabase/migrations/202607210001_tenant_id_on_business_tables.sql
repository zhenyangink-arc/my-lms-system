-- ============================================================
-- 多租户阶段 B（结构层）：业务表接入 tenant_id
--
-- 目标：
-- 1. 每张租户业务表增加不可为空的 tenant_id，并回填历史数据。
-- 2. 父子表建立 (tenant_id, id) 复合外键，数据库层面阻止跨租户挂接。
-- 3. 统一 BEFORE INSERT 触发器：客户端写入自动落在当前租户；
--    服务端（service_role）写入缺少租户上下文时按归属用户推导，推导不出则报错。
-- 4. 租户内自然键（slug、user_id+task_key 等）改为包含 tenant_id。
--
-- 平台共享目录（korean_universities、korean_university_programs、schools、
-- school_programs、university_*_requirements）与全局身份表 profiles 不加 tenant_id。
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 辅助函数：某用户的默认租户（回填与服务端写入推导共用）
-- ------------------------------------------------------------
create or replace function private.default_tenant_of(target_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select membership.tenant_id
  from public.tenant_memberships as membership
  where membership.user_id = target_user_id
  order by
    (membership.status = 'active') desc,
    membership.is_default desc,
    membership.created_at,
    membership.tenant_id
  limit 1;
$$;

revoke all on function private.default_tenant_of(uuid) from public;
grant execute on function private.default_tenant_of(uuid) to authenticated, service_role;

-- ------------------------------------------------------------
-- 统一租户写入约束：
-- INSERT 缺 tenant_id 时按「当前用户租户 → 行归属用户默认租户」推导；
-- UPDATE 禁止改动 tenant_id。
-- ------------------------------------------------------------
create or replace function private.enforce_tenant_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved uuid;
  row_json jsonb;
  owner_id uuid;
begin
  if tg_op = 'UPDATE' then
    if new.tenant_id is distinct from old.tenant_id then
      raise exception '不能把数据移动到其他租户';
    end if;
    return new;
  end if;

  if new.tenant_id is null then
    resolved := private.current_tenant_id();

    if resolved is null then
      row_json := to_jsonb(new);
      owner_id := coalesce(
        nullif(row_json->>'user_id', '')::uuid,
        nullif(row_json->>'student_id', '')::uuid,
        nullif(row_json->>'target_user_id', '')::uuid,
        nullif(row_json->>'admin_id', '')::uuid,
        nullif(row_json->>'actor_id', '')::uuid,
        nullif(row_json->>'created_by', '')::uuid
      );
      if owner_id is not null then
        resolved := private.default_tenant_of(owner_id);
      end if;
    end if;

    new.tenant_id := resolved;
  end if;

  if new.tenant_id is null then
    raise exception '缺少租户上下文，拒绝写入：服务端任务必须显式提供 tenant_id';
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- 逐表接入。宏观顺序：先加列，再按「归属用户 / 父表」回填，
-- 兜底回填到 PUFFY 兼容租户，然后 NOT NULL + 外键 + 索引 + 触发器。
-- ------------------------------------------------------------
do $$
declare
  bootstrap constant uuid := '00000000-0000-4000-8000-000000000001'::uuid;

  -- owner_column 为空表示没有归属用户列，直接回填 bootstrap；
  -- 子表在父表回填后再按父表覆盖。
  target record;
begin
  for target in
    select * from (values
      ('course_categories',                       null::text),
      ('courses',                                 null::text),
      ('lessons',                                 null::text),
      ('lesson_resources',                        null::text),
      ('lesson_progress',                         null::text),
      ('lesson_questions',                        null::text),
      ('announcements',                           'created_by'),
      ('announcement_admin_assignments',          'admin_id'),
      ('learning_assignments',                    'created_by'),
      ('learning_assignment_questions',           null),
      ('learning_assignment_question_keys',       null),
      ('learning_assignment_targets',             null),
      ('learning_submissions',                    null),
      ('learning_submission_answers',             null),
      ('conversation_practice_scenarios',         'created_by'),
      ('conversation_practice_progress',          null),
      ('conversation_practice_admin_assignments', 'admin_id'),
      ('help_articles',                           'created_by'),
      ('help_tickets',                            'user_id'),
      ('help_ticket_messages',                    null),
      ('help_center_admin_assignments',           'admin_id'),
      ('grade_items',                             'created_by'),
      ('grade_records',                           null),
      ('grade_review_requests',                   null),
      ('grade_center_admin_assignments',          'admin_id'),
      ('learning_record_notes',                   'student_id'),
      ('learning_record_admin_assignments',       'admin_id'),
      ('library_resources',                       'created_by'),
      ('library_downloads',                       null),
      ('library_favorites',                       null),
      ('library_admin_assignments',               'admin_id'),
      ('student_university_targets',              'user_id'),
      ('student_university_comparisons',          'user_id'),
      ('student_university_assessments',          'user_id'),
      ('student_application_documents',           'user_id'),
      ('student_visa_cases',                      'user_id'),
      ('student_visa_tasks',                      'user_id'),
      ('student_visa_task_events',                null),
      ('ai_token_usage',                          'user_id'),
      ('account_management_audit_logs',           'target_user_id'),
      ('account_deletion_audit_logs',             'actor_id'),
      ('course_content_audit_logs',               'actor_id'),
      ('student_service_card_deletion_logs',      'target_user_id')
    ) as t(table_name, owner_column)
  loop
    execute format('alter table public.%I add column if not exists tenant_id uuid', target.table_name);

    -- 回填是纯数据迁移：临时停用行级触发器（权限触发器会拒绝无会话上下文的更新，
    -- updated_at 触发器会污染时间戳）。回填完成后统一恢复。
    execute format('alter table public.%I disable trigger user', target.table_name);

    if target.owner_column is not null then
      execute format(
        'update public.%I set tenant_id = coalesce(private.default_tenant_of(%I), %L) where tenant_id is null',
        target.table_name, target.owner_column, bootstrap
      );
    end if;
  end loop;
end;
$$;

-- 子表按父表回填，保证父子租户一致（先父后子的依赖顺序）。
update public.lessons as child
set tenant_id = parent.tenant_id
from public.courses as parent
where child.course_id = parent.id and child.tenant_id is null;

update public.lesson_resources as child
set tenant_id = parent.tenant_id
from public.lessons as parent
where child.lesson_id = parent.id and child.tenant_id is null;

update public.lesson_progress as child
set tenant_id = parent.tenant_id
from public.lessons as parent
where child.lesson_id = parent.id and child.tenant_id is null;

update public.lesson_questions as child
set tenant_id = parent.tenant_id
from public.lessons as parent
where child.lesson_id = parent.id and child.tenant_id is null;

update public.learning_assignment_questions as child
set tenant_id = parent.tenant_id
from public.learning_assignments as parent
where child.assignment_id = parent.id and child.tenant_id is null;

update public.learning_assignment_question_keys as child
set tenant_id = parent.tenant_id
from public.learning_assignment_questions as parent
where child.question_id = parent.id and child.tenant_id is null;

update public.learning_assignment_targets as child
set tenant_id = parent.tenant_id
from public.learning_assignments as parent
where child.assignment_id = parent.id and child.tenant_id is null;

update public.learning_submissions as child
set tenant_id = parent.tenant_id
from public.learning_assignments as parent
where child.assignment_id = parent.id and child.tenant_id is null;

update public.learning_submission_answers as child
set tenant_id = parent.tenant_id
from public.learning_submissions as parent
where child.submission_id = parent.id and child.tenant_id is null;

update public.conversation_practice_progress as child
set tenant_id = parent.tenant_id
from public.conversation_practice_scenarios as parent
where child.scenario_id = parent.id and child.tenant_id is null;

update public.help_ticket_messages as child
set tenant_id = parent.tenant_id
from public.help_tickets as parent
where child.ticket_id = parent.id and child.tenant_id is null;

update public.grade_records as child
set tenant_id = parent.tenant_id
from public.grade_items as parent
where child.item_id = parent.id and child.tenant_id is null;

update public.grade_review_requests as child
set tenant_id = parent.tenant_id
from public.grade_records as parent
where child.record_id = parent.id and child.tenant_id is null;

update public.library_downloads as child
set tenant_id = parent.tenant_id
from public.library_resources as parent
where child.resource_id = parent.id and child.tenant_id is null;

update public.library_favorites as child
set tenant_id = parent.tenant_id
from public.library_resources as parent
where child.resource_id = parent.id and child.tenant_id is null;

update public.student_visa_task_events as child
set tenant_id = parent.tenant_id
from public.student_visa_tasks as parent
where child.task_id = parent.id and child.tenant_id is null;

-- 兜底：仍未确定归属的历史行全部划入 PUFFY 兼容租户。
do $$
declare
  target record;
begin
  for target in
    select unnest(array[
      'course_categories','courses','lessons','lesson_resources','lesson_progress','lesson_questions',
      'announcements','announcement_admin_assignments',
      'learning_assignments','learning_assignment_questions','learning_assignment_question_keys',
      'learning_assignment_targets','learning_submissions','learning_submission_answers',
      'conversation_practice_scenarios','conversation_practice_progress','conversation_practice_admin_assignments',
      'help_articles','help_tickets','help_ticket_messages','help_center_admin_assignments',
      'grade_items','grade_records','grade_review_requests','grade_center_admin_assignments',
      'learning_record_notes','learning_record_admin_assignments',
      'library_resources','library_downloads','library_favorites','library_admin_assignments',
      'student_university_targets','student_university_comparisons','student_university_assessments',
      'student_application_documents','student_visa_cases','student_visa_tasks','student_visa_task_events',
      'ai_token_usage','account_management_audit_logs','account_deletion_audit_logs',
      'course_content_audit_logs','student_service_card_deletion_logs'
    ]) as table_name
  loop
    execute format(
      'update public.%I set tenant_id = %L where tenant_id is null',
      target.table_name, '00000000-0000-4000-8000-000000000001'::uuid
    );

    execute format('alter table public.%I enable trigger user', target.table_name);

    execute format('alter table public.%I alter column tenant_id set not null', target.table_name);

    execute format(
      'alter table public.%I add constraint %I foreign key (tenant_id) references public.tenants(id) on delete restrict',
      target.table_name, target.table_name || '_tenant_id_fkey'
    );

    execute format(
      'create index if not exists %I on public.%I (tenant_id)',
      target.table_name || '_tenant_id_idx', target.table_name
    );

    execute format('drop trigger if exists %I on public.%I', target.table_name || '_tenant_scope', target.table_name);
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function private.enforce_tenant_scope()',
      target.table_name || '_tenant_scope', target.table_name
    );
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- 父表复合候选键 (tenant_id, id)，供子表复合外键引用
-- ------------------------------------------------------------
alter table public.course_categories             add constraint course_categories_tenant_id_id_key             unique (tenant_id, id);
alter table public.courses                       add constraint courses_tenant_id_id_key                       unique (tenant_id, id);
alter table public.lessons                       add constraint lessons_tenant_id_id_key                       unique (tenant_id, id);
alter table public.learning_assignments          add constraint learning_assignments_tenant_id_id_key          unique (tenant_id, id);
alter table public.learning_assignment_questions add constraint learning_assignment_questions_tenant_id_id_key unique (tenant_id, id);
alter table public.learning_submissions          add constraint learning_submissions_tenant_id_id_key          unique (tenant_id, id);
alter table public.conversation_practice_scenarios add constraint conversation_practice_scenarios_tenant_id_id_key unique (tenant_id, id);
alter table public.help_tickets                  add constraint help_tickets_tenant_id_id_key                  unique (tenant_id, id);
alter table public.grade_items                   add constraint grade_items_tenant_id_id_key                   unique (tenant_id, id);
alter table public.grade_records                 add constraint grade_records_tenant_id_id_key                 unique (tenant_id, id);
alter table public.library_resources             add constraint library_resources_tenant_id_id_key             unique (tenant_id, id);
alter table public.student_university_targets    add constraint student_university_targets_tenant_id_id_key    unique (tenant_id, id);
alter table public.student_visa_tasks            add constraint student_visa_tasks_tenant_id_id_key            unique (tenant_id, id);

-- ------------------------------------------------------------
-- 子表改用复合外键：普通外键无法证明父子同租户
-- 可空引用使用 on delete set null (列)，避免把 tenant_id 一并置空。
-- ------------------------------------------------------------
alter table public.courses
  drop constraint courses_category_id_fkey,
  add constraint courses_category_id_fkey
    foreign key (tenant_id, category_id) references public.course_categories (tenant_id, id)
    on delete set null (category_id);

alter table public.lessons
  drop constraint lessons_course_id_fkey,
  add constraint lessons_course_id_fkey
    foreign key (tenant_id, course_id) references public.courses (tenant_id, id) on delete cascade;

alter table public.lesson_resources
  drop constraint lesson_resources_lesson_id_fkey,
  add constraint lesson_resources_lesson_id_fkey
    foreign key (tenant_id, lesson_id) references public.lessons (tenant_id, id) on delete cascade;

alter table public.lesson_progress
  drop constraint lesson_progress_lesson_id_fkey,
  add constraint lesson_progress_lesson_id_fkey
    foreign key (tenant_id, lesson_id) references public.lessons (tenant_id, id) on delete cascade;

alter table public.lesson_progress
  drop constraint lesson_progress_course_id_fkey,
  add constraint lesson_progress_course_id_fkey
    foreign key (tenant_id, course_id) references public.courses (tenant_id, id) on delete cascade;

alter table public.lesson_questions
  drop constraint lesson_questions_lesson_id_fkey,
  add constraint lesson_questions_lesson_id_fkey
    foreign key (tenant_id, lesson_id) references public.lessons (tenant_id, id) on delete cascade;

alter table public.lesson_questions
  drop constraint lesson_questions_course_id_fkey,
  add constraint lesson_questions_course_id_fkey
    foreign key (tenant_id, course_id) references public.courses (tenant_id, id) on delete cascade;

alter table public.learning_assignments
  drop constraint learning_assignments_course_id_fkey,
  add constraint learning_assignments_course_id_fkey
    foreign key (tenant_id, course_id) references public.courses (tenant_id, id)
    on delete set null (course_id);

alter table public.learning_assignment_questions
  drop constraint learning_assignment_questions_assignment_id_fkey,
  add constraint learning_assignment_questions_assignment_id_fkey
    foreign key (tenant_id, assignment_id) references public.learning_assignments (tenant_id, id) on delete cascade;

alter table public.learning_assignment_question_keys
  drop constraint learning_assignment_question_keys_question_id_fkey,
  add constraint learning_assignment_question_keys_question_id_fkey
    foreign key (tenant_id, question_id) references public.learning_assignment_questions (tenant_id, id) on delete cascade;

alter table public.learning_assignment_targets
  drop constraint learning_assignment_targets_assignment_id_fkey,
  add constraint learning_assignment_targets_assignment_id_fkey
    foreign key (tenant_id, assignment_id) references public.learning_assignments (tenant_id, id) on delete cascade;

alter table public.learning_submissions
  drop constraint learning_submissions_assignment_id_fkey,
  add constraint learning_submissions_assignment_id_fkey
    foreign key (tenant_id, assignment_id) references public.learning_assignments (tenant_id, id) on delete cascade;

alter table public.learning_submission_answers
  drop constraint learning_submission_answers_submission_id_fkey,
  add constraint learning_submission_answers_submission_id_fkey
    foreign key (tenant_id, submission_id) references public.learning_submissions (tenant_id, id) on delete cascade;

alter table public.learning_submission_answers
  drop constraint learning_submission_answers_question_id_fkey,
  add constraint learning_submission_answers_question_id_fkey
    foreign key (tenant_id, question_id) references public.learning_assignment_questions (tenant_id, id) on delete cascade;

alter table public.grade_items
  drop constraint grade_items_source_assignment_id_fkey,
  add constraint grade_items_source_assignment_id_fkey
    foreign key (tenant_id, source_assignment_id) references public.learning_assignments (tenant_id, id)
    on delete set null (source_assignment_id);

alter table public.grade_records
  drop constraint grade_records_item_id_fkey,
  add constraint grade_records_item_id_fkey
    foreign key (tenant_id, item_id) references public.grade_items (tenant_id, id) on delete cascade;

alter table public.grade_review_requests
  drop constraint grade_review_requests_record_id_fkey,
  add constraint grade_review_requests_record_id_fkey
    foreign key (tenant_id, record_id) references public.grade_records (tenant_id, id) on delete cascade;

alter table public.help_ticket_messages
  drop constraint help_ticket_messages_ticket_id_fkey,
  add constraint help_ticket_messages_ticket_id_fkey
    foreign key (tenant_id, ticket_id) references public.help_tickets (tenant_id, id) on delete cascade;

alter table public.library_downloads
  drop constraint library_downloads_resource_id_fkey,
  add constraint library_downloads_resource_id_fkey
    foreign key (tenant_id, resource_id) references public.library_resources (tenant_id, id) on delete cascade;

alter table public.library_favorites
  drop constraint library_favorites_resource_id_fkey,
  add constraint library_favorites_resource_id_fkey
    foreign key (tenant_id, resource_id) references public.library_resources (tenant_id, id) on delete cascade;

alter table public.conversation_practice_progress
  drop constraint conversation_practice_progress_scenario_id_fkey,
  add constraint conversation_practice_progress_scenario_id_fkey
    foreign key (tenant_id, scenario_id) references public.conversation_practice_scenarios (tenant_id, id) on delete cascade;

alter table public.student_application_documents
  drop constraint student_application_documents_target_id_fkey,
  add constraint student_application_documents_target_id_fkey
    foreign key (tenant_id, target_id) references public.student_university_targets (tenant_id, id) on delete cascade;

alter table public.student_visa_cases
  drop constraint student_visa_cases_source_target_id_fkey,
  add constraint student_visa_cases_source_target_id_fkey
    foreign key (tenant_id, source_target_id) references public.student_university_targets (tenant_id, id)
    on delete set null (source_target_id);

alter table public.student_visa_task_events
  drop constraint student_visa_task_events_task_id_fkey,
  add constraint student_visa_task_events_task_id_fkey
    foreign key (tenant_id, task_id) references public.student_visa_tasks (tenant_id, id) on delete cascade;

-- ------------------------------------------------------------
-- 租户内自然键：把 tenant_id 放进唯一约束
-- ------------------------------------------------------------
alter table public.course_categories
  drop constraint course_categories_slug_key,
  add constraint course_categories_tenant_slug_key unique (tenant_id, slug);

alter table public.courses
  drop constraint courses_slug_key,
  add constraint courses_tenant_slug_key unique (tenant_id, slug);

alter table public.student_university_comparisons
  drop constraint student_university_comparisons_user_id_university_id_key,
  add constraint student_university_comparisons_tenant_user_university_key unique (tenant_id, user_id, university_id);

alter table public.student_visa_cases
  drop constraint student_visa_cases_user_id_key,
  add constraint student_visa_cases_tenant_user_key unique (tenant_id, user_id);

alter table public.student_visa_tasks
  drop constraint student_visa_tasks_user_id_task_key_key,
  add constraint student_visa_tasks_tenant_user_task_key unique (tenant_id, user_id, task_key);

-- 模块管理员授权：同一管理员可以在不同租户分别授权
alter table public.announcement_admin_assignments drop constraint announcement_admin_assignments_pkey;
alter table public.announcement_admin_assignments add constraint announcement_admin_assignments_pkey primary key (tenant_id, admin_id);

alter table public.conversation_practice_admin_assignments drop constraint conversation_practice_admin_assignments_pkey;
alter table public.conversation_practice_admin_assignments add constraint conversation_practice_admin_assignments_pkey primary key (tenant_id, admin_id);

alter table public.help_center_admin_assignments drop constraint help_center_admin_assignments_pkey;
alter table public.help_center_admin_assignments add constraint help_center_admin_assignments_pkey primary key (tenant_id, admin_id);

alter table public.grade_center_admin_assignments drop constraint grade_center_admin_assignments_pkey;
alter table public.grade_center_admin_assignments add constraint grade_center_admin_assignments_pkey primary key (tenant_id, admin_id);

alter table public.learning_record_admin_assignments drop constraint learning_record_admin_assignments_pkey;
alter table public.learning_record_admin_assignments add constraint learning_record_admin_assignments_pkey primary key (tenant_id, admin_id);

alter table public.library_admin_assignments drop constraint library_admin_assignments_pkey;
alter table public.library_admin_assignments add constraint library_admin_assignments_pkey primary key (tenant_id, admin_id);

-- 常用查询索引（tenant_id 在最前）
create index if not exists help_tickets_tenant_status_created_idx on public.help_tickets (tenant_id, status, created_at desc);
create index if not exists lesson_progress_tenant_user_updated_idx on public.lesson_progress (tenant_id, user_id, updated_at desc);
create index if not exists announcements_tenant_status_published_idx on public.announcements (tenant_id, status, published_at desc);
create index if not exists learning_assignments_tenant_status_idx on public.learning_assignments (tenant_id, status, published_at desc);
create index if not exists ai_token_usage_tenant_created_idx on public.ai_token_usage (tenant_id, created_at desc);

comment on function private.enforce_tenant_scope() is
  '业务表统一租户约束：插入自动落当前租户（服务端按归属用户推导），禁止跨租户改行';

commit;
