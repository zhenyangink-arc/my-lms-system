-- Bootstrap non-login audit ownership and isolated published source snapshots
-- for the historical assessment-paper seed migrations. The real Korean Level
-- One chapter tests and digital textbook chapters remain draft.

begin;

lock table public.profiles in share row exclusive mode;

do $$
declare
  v_bootstrap_owner_id constant uuid := '14c00000-0000-4000-8000-000000000001'::uuid;
begin
  -- 007/008/014/023 select an active global platform owner, while 200002
  -- selects an active platform super admin. The profile consistency constraint
  -- makes those roles a pair, but check both historical predicates explicitly.
  if exists (
    select 1
    from public.profiles as profile
    where profile.global_role = 'platform_owner'
      and coalesce(profile.status, 'active') = 'active'
  ) or exists (
    select 1
    from public.profiles as profile
    where profile.role = 'platform_super_admin'
      and profile.status = 'active'
  ) then
    return;
  end if;

  -- This row deliberately has no email, phone, password, confirmed credential,
  -- or auth.identity. It cannot be used for an interactive sign-in.
  insert into auth.users (
    id,
    aud,
    role,
    encrypted_password,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_anonymous
  ) values (
    v_bootstrap_owner_id,
    'authenticated',
    'authenticated',
    null,
    '{"provider":"system","providers":[]}'::jsonb,
    '{"audit_subject":"bootstrap_platform_owner"}'::jsonb,
    now(),
    now(),
    false
  )
  on conflict (id) do nothing;

  insert into public.profiles (
    id,
    full_name,
    role,
    global_role,
    status,
    registration_source,
    registered_at
  ) values (
    v_bootstrap_owner_id,
    '平台引导审计主体',
    'platform_super_admin',
    'platform_owner',
    'active',
    'system',
    now()
  )
  on conflict (id) do update
  set full_name = excluded.full_name,
      role = excluded.role,
      global_role = excluded.global_role,
      status = excluded.status,
      registration_source = excluded.registration_source,
      registered_at = coalesce(public.profiles.registered_at, excluded.registered_at),
      updated_at = now();
end;
$$;

-- The paper seed migrations create draft, platform-only snapshots, but their
-- historical queries insist that the source chapter_tests rows are published.
-- Clone only the assessment sources instead of changing the editorial rows.
-- This internal, non-published lesson is migration infrastructure rather than
-- managed course content, so do not emit a tenant-scoped editorial audit row.
alter table public.lessons disable trigger lessons_audit_content_change;
alter table public.lessons disable trigger lessons_tenant_scope;

insert into public.lessons (
  id, course_id, slug, title, description, lesson_type, duration_minutes,
  is_free_preview, is_published, sort_order, allow_questions, tenant_id,
  content_scope, cover_focal_point, unlock_mode, is_manually_locked
)
select
  '14d00000-0000-4000-8000-000000000001'::uuid,
  source.course_id,
  'assessment-seed-sources-v1',
  '测评种子源（内部）',
  '仅承载历史迁移生成草稿试卷所需的独立题库快照。',
  'text',
  1,
  false,
  false,
  9999,
  false,
  source.tenant_id,
  source.content_scope,
  'center',
  'manual',
  true
from public.lessons as source
join public.courses as course on course.id = source.course_id
where course.slug = 'korean-beginner'
  and source.slug = 'basic-pronunciation'
limit 1;

alter table public.lessons enable trigger lessons_audit_content_change;
alter table public.lessons enable trigger lessons_tenant_scope;

insert into public.chapter_tests (
  id, slug, course_key, chapter_number, title, korean_title, description,
  duration_minutes, passing_score, skills, version, status, created_at,
  updated_at, lesson_id, student_app_id
)
select
  (
    '14d00000-0000-4000-8100-'
    || lpad(source.chapter_number::text, 12, '0')
  )::uuid,
  source.slug || '-assessment-seed-source-v1',
  source.course_key,
  source.chapter_number,
  source.title,
  source.korean_title,
  source.description,
  source.duration_minutes,
  source.passing_score,
  source.skills,
  source.version,
  'published',
  source.created_at,
  now(),
  '14d00000-0000-4000-8000-000000000001'::uuid,
  source.student_app_id
from public.chapter_tests as source
where source.student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
  and source.slug ~ '^korean-level-one-(0[1-9]|1[0-6])$'
  and source.status = 'draft';

do $$
begin
  if (
    select count(*)
    from public.chapter_tests as snapshot
    where snapshot.id::text like '14d00000-0000-4000-8100-%'
      and snapshot.status = 'published'
  ) <> 16 then
    raise exception '无法建立16章独立测评种子源快照';
  end if;
end;
$$;

-- Clone the chapter-test bank. These rows belong to the isolated source tests;
-- publishing them does not publish any real digital textbook chapter.
insert into public.chapter_test_questions (
  id, test_id, question_key, prompt, options, correct_option, explanation,
  skill, sort_order, created_at, updated_at, question_type, correct_answer,
  default_points, difficulty, tags, status, version, created_by, updated_by,
  is_chapter_test_item, ebook_section_step, ebook_page_reference
)
select
  gen_random_uuid(),
  snapshot.id,
  source_question.question_key,
  source_question.prompt,
  source_question.options,
  source_question.correct_option,
  source_question.explanation,
  source_question.skill,
  source_question.sort_order,
  source_question.created_at,
  now(),
  source_question.question_type,
  source_question.correct_answer,
  source_question.default_points,
  source_question.difficulty,
  source_question.tags,
  'published',
  source_question.version,
  source_question.created_by,
  source_question.updated_by,
  source_question.is_chapter_test_item,
  source_question.ebook_section_step,
  source_question.ebook_page_reference
from public.chapter_tests as source
join public.chapter_tests as snapshot
  on snapshot.chapter_number = source.chapter_number
 and snapshot.student_app_id = source.student_app_id
 and snapshot.slug = source.slug || '-assessment-seed-source-v1'
join public.chapter_test_questions as source_question
  on source_question.test_id = source.id
where source.student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
  and source.slug ~ '^korean-level-one-(0[1-9]|1[0-6])$';

-- New chapter tests receive an empty/default homework plan from the existing
-- trigger. Replace it with an exact copy of the real draft source plan.
update public.chapter_homework_plans as snapshot_plan
set title = source_plan.title,
    duration_minutes = source_plan.duration_minutes,
    passing_score = source_plan.passing_score,
    allow_resubmission = source_plan.allow_resubmission,
    status = 'published',
    version = source_plan.version,
    created_at = source_plan.created_at,
    updated_at = now()
from public.chapter_tests as snapshot,
     public.chapter_tests as source,
     public.chapter_homework_plans as source_plan
where snapshot_plan.test_id = snapshot.id
  and snapshot.slug = source.slug || '-assessment-seed-source-v1'
  and source_plan.test_id = source.id
  and source.student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
  and source.slug ~ '^korean-level-one-(0[1-9]|1[0-6])$';

delete from public.chapter_homework_questions as snapshot_question
using public.chapter_homework_plans as snapshot_plan,
      public.chapter_tests as snapshot
where snapshot_question.plan_id = snapshot_plan.id
  and snapshot_plan.test_id = snapshot.id
  and snapshot.slug ~ '-assessment-seed-source-v1$';

delete from public.chapter_homework_skill_settings as snapshot_setting
using public.chapter_homework_plans as snapshot_plan,
      public.chapter_tests as snapshot
where snapshot_setting.plan_id = snapshot_plan.id
  and snapshot_plan.test_id = snapshot.id
  and snapshot.slug ~ '-assessment-seed-source-v1$';

insert into public.chapter_homework_skill_settings (
  plan_id, language_skill, enabled, response_mode, target_question_count,
  target_points, duration_minutes, instructions, sort_order, created_at,
  updated_at
)
select
  snapshot_plan.id,
  source_setting.language_skill,
  source_setting.enabled,
  source_setting.response_mode,
  source_setting.target_question_count,
  source_setting.target_points,
  source_setting.duration_minutes,
  source_setting.instructions,
  source_setting.sort_order,
  source_setting.created_at,
  now()
from public.chapter_tests as source
join public.chapter_tests as snapshot
  on snapshot.slug = source.slug || '-assessment-seed-source-v1'
join public.chapter_homework_plans as source_plan
  on source_plan.test_id = source.id
join public.chapter_homework_plans as snapshot_plan
  on snapshot_plan.test_id = snapshot.id
join public.chapter_homework_skill_settings as source_setting
  on source_setting.plan_id = source_plan.id
where source.student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
  and source.slug ~ '^korean-level-one-(0[1-9]|1[0-6])$';

-- Inserting skill settings invokes the existing synchronization trigger and
-- recreates generated placeholders. Remove those before copying the frozen
-- source questions below.
delete from public.chapter_homework_questions as snapshot_question
using public.chapter_homework_plans as snapshot_plan,
      public.chapter_tests as snapshot
where snapshot_question.plan_id = snapshot_plan.id
  and snapshot_plan.test_id = snapshot.id
  and snapshot.slug ~ '-assessment-seed-source-v1$';

insert into public.chapter_homework_questions (
  plan_id, language_skill, source_bank_question_id, source_bank_version,
  question_type, stimulus_text, prompt, options, correct_answer, explanation,
  difficulty, source_skill, points, sort_order, created_at, updated_at
)
select
  snapshot_plan.id,
  source_question.language_skill,
  coalesce(snapshot_bank_question.id, source_question.source_bank_question_id),
  source_question.source_bank_version,
  source_question.question_type,
  source_question.stimulus_text,
  source_question.prompt,
  source_question.options,
  source_question.correct_answer,
  source_question.explanation,
  source_question.difficulty,
  source_question.source_skill,
  source_question.points,
  source_question.sort_order,
  source_question.created_at,
  now()
from public.chapter_tests as source
join public.chapter_tests as snapshot
  on snapshot.slug = source.slug || '-assessment-seed-source-v1'
join public.chapter_homework_plans as source_plan
  on source_plan.test_id = source.id
join public.chapter_homework_plans as snapshot_plan
  on snapshot_plan.test_id = snapshot.id
join public.chapter_homework_questions as source_question
  on source_question.plan_id = source_plan.id
left join public.chapter_test_questions as source_bank_question
  on source_bank_question.id = source_question.source_bank_question_id
left join public.chapter_test_questions as snapshot_bank_question
  on snapshot_bank_question.test_id = snapshot.id
 and snapshot_bank_question.question_key = source_bank_question.question_key
where source.student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
  and source.slug ~ '^korean-level-one-(0[1-9]|1[0-6])$';

-- At this historical point the real draft plans intentionally have no reading
-- rows: the synchronizer only accepts published bank questions. Build reading
-- from the independently published cloned bank instead.
insert into public.chapter_homework_questions (
  plan_id, language_skill, source_bank_question_id, source_bank_version,
  question_type, stimulus_text, prompt, options, correct_answer, explanation,
  difficulty, source_skill, points, sort_order
)
select
  snapshot_plan.id,
  'reading',
  ranked.id,
  ranked.version,
  'single_choice',
  '',
  ranked.prompt,
  ranked.options,
  ranked.options ->> ranked.correct_option,
  ranked.explanation,
  ranked.difficulty,
  'reading',
  3,
  ranked.question_rank - 5
from public.chapter_tests as snapshot
join public.chapter_homework_plans as snapshot_plan
  on snapshot_plan.test_id = snapshot.id
cross join lateral (
  select
    question.*,
    row_number() over (
      order by question.sort_order, question.id
    )::integer as question_rank
  from public.chapter_test_questions as question
  where question.test_id = snapshot.id
    and question.status = 'published'
    and question.question_type = 'single_choice'
    and question.is_chapter_test_item
) as ranked
where snapshot.slug ~ '-assessment-seed-source-v1$'
  and ranked.question_rank between 6 and 10;

-- Listening uses the canonical private textbook activity, following the 004
-- correction, but writes into the isolated snapshot plan.
insert into public.chapter_homework_questions (
  plan_id, language_skill, question_type, stimulus_text, prompt, options,
  correct_answer, explanation, difficulty, source_skill, points, sort_order
)
select
  snapshot_plan.id,
  'listening',
  'single_choice',
  secret.transcript_ko,
  coalesce(activity.prompt ->> 'zh-CN', activity.prompt ->> 'ko-KR'),
  activity.options,
  activity.options ->> ((secret.answer_key ->> 'value')::integer),
  coalesce(secret.explanation #>> '{correct,zh-CN}', '根据听力原文判断。'),
  'medium',
  'listening',
  15,
  row_number() over (
    partition by snapshot_plan.id order by activity.sort_order, activity.id
  )::integer
from public.chapter_tests as source
join public.chapter_tests as snapshot
  on snapshot.slug = source.slug || '-assessment-seed-source-v1'
join public.chapter_homework_plans as snapshot_plan
  on snapshot_plan.test_id = snapshot.id
join public.digital_textbook_chapters as chapter
  on chapter.chapter_test_id = source.id
join public.digital_textbook_modules as module on module.chapter_id = chapter.id
join public.digital_textbook_nodes as node on node.module_id = module.id
join public.digital_textbook_activities as activity on activity.node_id = node.id
join public.digital_textbook_activity_secrets as secret
  on secret.activity_id = activity.id
where source.student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
  and source.slug ~ '^korean-level-one-(0[1-9]|1[0-6])$'
  and activity.activity_type = 'listening'
  and secret.answer_key ->> 'kind' = 'index'
  and nullif(btrim(coalesce(secret.transcript_ko, '')), '') is not null;

update public.chapter_homework_skill_settings as setting
set target_question_count = (
      select count(*)::integer
      from public.chapter_homework_questions as question
      where question.plan_id = setting.plan_id
        and question.language_skill = setting.language_skill
    ),
    updated_at = now()
from public.chapter_homework_plans as snapshot_plan,
     public.chapter_tests as snapshot
where setting.plan_id = snapshot_plan.id
  and snapshot_plan.test_id = snapshot.id
  and snapshot.slug ~ '-assessment-seed-source-v1$';

-- Keep the compatibility course_tests view bound to the physical table, then
-- expose a temporary chapter_tests view that maps only the isolated snapshots
-- to the historical slugs expected by 007/008/014/023/200002.
alter table public.chapter_tests
  rename to chapter_test_editorial_and_seed_sources;

create view public.chapter_tests with (security_invoker = true) as
select
  source.id,
  case
    when source.slug ~ '-assessment-seed-source-v1$' then
      regexp_replace(source.slug, '-assessment-seed-source-v1$', '')
    else source.slug
  end as slug,
  source.course_key,
  source.chapter_number,
  source.title,
  source.korean_title,
  source.description,
  source.duration_minutes,
  source.passing_score,
  source.skills,
  source.version,
  source.status,
  source.created_at,
  source.updated_at,
  source.lesson_id,
  source.student_app_id
from public.chapter_test_editorial_and_seed_sources as source;

-- The final historical consumer is 200002. Restore the canonical physical
-- table automatically at that migration's transaction boundary, so migrations
-- 200003 onward and the application see the normal updatable/RLS-protected
-- chapter_tests table rather than the temporary compatibility view.
create or replace function private.restore_chapter_test_catalog_after_seed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if to_regclass('public.chapter_test_editorial_and_seed_sources') is null then
    return new;
  end if;

  if (
    select count(*)
    from public.chapter_test_editorial_and_seed_sources as source
    where source.slug ~ '^korean-level-one-(0[1-9]|1[0-6])$'
      and source.status = 'draft'
  ) <> 16 then
    raise exception '真实16章草稿状态发生变化，拒绝恢复题库目录';
  end if;

  -- Migration 004 runs after this bootstrap and may add canonical listening
  -- questions to the isolated plans. Reconcile the per-skill targets only
  -- after the final historical paper seed has consumed those plans.
  update public.chapter_homework_skill_settings as setting
  set target_question_count = (
        select count(*)::integer
        from public.chapter_homework_questions as question
        where question.plan_id = setting.plan_id
          and question.language_skill = setting.language_skill
      ),
      updated_at = now()
  from public.chapter_homework_plans as snapshot_plan,
       public.chapter_test_editorial_and_seed_sources as snapshot
  where setting.plan_id = snapshot_plan.id
    and snapshot_plan.test_id = snapshot.id
    and snapshot.slug ~ '-assessment-seed-source-v1$';

  execute 'drop view public.chapter_tests';
  execute 'alter table public.chapter_test_editorial_and_seed_sources rename to chapter_tests';
  return new;
end;
$$;

revoke all on function private.restore_chapter_test_catalog_after_seed()
  from public;

create constraint trigger restore_chapter_test_catalog_after_final_seed
after insert on public.assessment_papers
deferrable initially deferred
for each row
when (new.paper_code = 'EX-K1-FIN-V1')
execute function private.restore_chapter_test_catalog_after_seed();

commit;
