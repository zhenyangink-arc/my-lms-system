begin;

-- 章节作业从听说读写四项扩展为词汇、语法、听说读写六项。
alter table public.chapter_homework_skill_settings
  drop constraint if exists chapter_homework_skill_settings_language_skill_check,
  drop constraint if exists chapter_homework_skill_settings_sort_order_check,
  drop constraint if exists chapter_homework_skill_settings_plan_id_sort_order_key;

alter table public.chapter_homework_skill_settings
  add constraint chapter_homework_skill_settings_language_skill_check
    check (language_skill in (
      'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
    )),
  add constraint chapter_homework_skill_settings_sort_order_check
    check (sort_order between 1 and 6);

alter table public.chapter_homework_questions
  drop constraint if exists chapter_homework_questions_language_skill_check;

alter table public.chapter_homework_questions
  add constraint chapter_homework_questions_language_skill_check
    check (language_skill in (
      'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
    ));

-- 先重排旧四项，避免加入词汇、语法时触发排序唯一键冲突。
update public.chapter_homework_skill_settings
set sort_order = case language_skill
  when 'listening' then 3
  when 'speaking' then 4
  when 'reading' then 5
  when 'writing' then 6
  else sort_order
end;

insert into public.chapter_homework_skill_settings (
  plan_id, language_skill, enabled, response_mode, target_question_count,
  target_points, duration_minutes, instructions, sort_order
)
select
  plan.id,
  seed.language_skill,
  true,
  seed.response_mode,
  seed.target_question_count,
  seed.target_points,
  seed.duration_minutes,
  seed.instructions,
  seed.sort_order
from public.chapter_homework_plans as plan
cross join (
  values
    ('vocabulary', 'short_text', 1, 15::numeric, 8,
      '根据中文意思写出对应的韩语核心词汇；本章全部核心词汇各练习一次。', 1),
    ('grammar', 'mixed', 2, 15::numeric, 8,
      '本章每个语法点完成两轮：先写语法形式，再用该语法独立造句。', 2)
) as seed(
  language_skill, response_mode, target_question_count, target_points,
  duration_minutes, instructions, sort_order
)
on conflict (plan_id, language_skill) do update set
  enabled = true,
  response_mode = excluded.response_mode,
  target_points = excluded.target_points,
  duration_minutes = excluded.duration_minutes,
  instructions = excluded.instructions,
  sort_order = excluded.sort_order;

update public.chapter_homework_skill_settings
set target_points = case language_skill
      when 'vocabulary' then 15
      when 'grammar' then 15
      when 'listening' then 15
      when 'speaking' then 20
      when 'reading' then 15
      when 'writing' then 20
    end,
    sort_order = case language_skill
      when 'vocabulary' then 1
      when 'grammar' then 2
      when 'listening' then 3
      when 'speaking' then 4
      when 'reading' then 5
      when 'writing' then 6
    end
where language_skill in (
  'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
);

alter table public.chapter_homework_skill_settings
  add constraint chapter_homework_skill_settings_plan_id_sort_order_key
    unique (plan_id, sort_order);

-- 标准作业卷与学生任务保留六项分组及题干材料，并支持录音题。
alter table public.assessment_papers
  add column if not exists source_homework_plan_id uuid
    references public.chapter_homework_plans(id) on delete restrict;

create unique index if not exists assessment_papers_homework_plan_unique_idx
  on public.assessment_papers (source_homework_plan_id)
  where source_homework_plan_id is not null;

alter table public.assessment_paper_questions
  add column if not exists stimulus_text text not null default '',
  drop constraint if exists assessment_paper_questions_question_type_check;

alter table public.assessment_paper_questions
  add constraint assessment_paper_questions_question_type_check
    check (question_type in (
      'short_text', 'long_text', 'single_choice', 'file_link', 'audio_recording'
    )),
  add constraint assessment_paper_questions_stimulus_text_check
    check (char_length(stimulus_text) <= 5000);

alter table public.learning_assignment_questions
  add column if not exists language_skill text not null default '',
  add column if not exists stimulus_text text not null default '',
  drop constraint if exists learning_assignment_questions_question_type_check;

alter table public.learning_assignment_questions
  add constraint learning_assignment_questions_question_type_check
    check (question_type in (
      'short_text', 'long_text', 'single_choice', 'file_link', 'audio_recording'
    )),
  add constraint learning_assignment_questions_language_skill_check
    check (language_skill in (
      '', 'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
    )),
  add constraint learning_assignment_questions_stimulus_text_check
    check (char_length(stimulus_text) <= 5000);

-- 每次同步都从当前教材和当前章节题库重建，保证词汇数量随教材变化，
-- 且每个语法点严格产生“识别形式 + 独立运用”两轮练习。
create or replace function private.sync_chapter_homework_six_skills(
  p_test_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_id uuid;
  v_vocab_count integer := 0;
  v_grammar_count integer := 0;
begin
  select plan.id into v_plan_id
  from public.chapter_homework_plans as plan
  where plan.test_id = p_test_id;

  if v_plan_id is null then
    return;
  end if;

  delete from public.chapter_homework_questions
  where plan_id = v_plan_id;

  with vocabulary_items as (
    select
      item.value,
      item.ordinality::integer as item_order,
      count(*) over ()::integer as item_count
    from public.digital_textbook_chapters as chapter
    join public.digital_textbook_modules as module
      on module.chapter_id = chapter.id and module.module_code = 'vocabulary'
    join public.digital_textbook_nodes as node on node.module_id = module.id
    cross join lateral jsonb_array_elements(node.content -> 'vocabulary')
      with ordinality as item(value, ordinality)
    where chapter.chapter_test_id = p_test_id
  ), scored as (
    select *, round(15.0 / item_count, 2) as ordinary_points
    from vocabulary_items
  )
  insert into public.chapter_homework_questions (
    plan_id, language_skill, question_type, prompt, options, correct_answer,
    explanation, difficulty, source_skill, points, sort_order
  )
  select
    v_plan_id,
    'vocabulary',
    'short_text',
    '请写出“' || coalesce(value ->> 'zh', '') || '”对应的韩语核心词汇。',
    '[]'::jsonb,
    value ->> 'ko',
    '参考读音：' || coalesce(value ->> 'transcription', value ->> 'ko', '')
      || case when coalesce(value ->> 'collocation', '') <> ''
        then '；教材搭配：' || (value ->> 'collocation') else '' end,
    'foundation',
    'vocabulary',
    case when item_order = item_count
      then 15 - ordinary_points * (item_count - 1)
      else ordinary_points
    end,
    item_order
  from scored;

  get diagnostics v_vocab_count = row_count;

  with grammar_items as (
    select
      card.value,
      card.ordinality::integer as card_order,
      count(*) over ()::integer as card_count
    from public.digital_textbook_chapters as chapter
    join public.digital_textbook_modules as module
      on module.chapter_id = chapter.id and module.module_code = 'grammar'
    join public.digital_textbook_nodes as node on node.module_id = module.id
    cross join lateral jsonb_array_elements(node.content -> 'grammarCards')
      with ordinality as card(value, ordinality)
    where chapter.chapter_test_id = p_test_id
  ), rounds as (
    select grammar_items.*, round_no,
      ((card_order - 1) * 2 + round_no)::integer as item_order,
      (card_count * 2)::integer as item_count
    from grammar_items cross join generate_series(1, 2) as round_no
  ), scored as (
    select *, round(15.0 / item_count, 2) as ordinary_points
    from rounds
  )
  insert into public.chapter_homework_questions (
    plan_id, language_skill, question_type, prompt, options, correct_answer,
    explanation, difficulty, source_skill, points, sort_order
  )
  select
    v_plan_id,
    'grammar',
    case when round_no = 1 then 'short_text' else 'long_text' end,
    case when round_no = 1 then
      '第 1 轮：请写出具有“'
        || coalesce(value #>> '{function,zh-CN}', value ->> 'form', '')
        || '”作用的本章语法形式。'
    else
      '第 2 轮：请使用 ' || coalesce(value ->> 'form', '本语法')
        || ' 写一个符合本章情境的完整韩语句子。'
    end,
    '[]'::jsonb,
    case when round_no = 1 then value ->> 'form' else null end,
    coalesce(value #>> '{caution,zh-CN}', '')
      || case when jsonb_array_length(coalesce(value -> 'examples', '[]'::jsonb)) > 0
        then ' 示例：' || coalesce(value #>> '{examples,0,ko}', '') else '' end,
    case when round_no = 1 then 'foundation' else 'medium' end,
    'grammar',
    case when item_order = item_count
      then 15 - ordinary_points * (item_count - 1)
      else ordinary_points
    end,
    item_order
  from scored;

  get diagnostics v_grammar_count = row_count;

  insert into public.chapter_homework_questions (
    plan_id, language_skill, source_bank_question_id, source_bank_version,
    question_type, stimulus_text, prompt, options, correct_answer,
    explanation, difficulty, source_skill, points, sort_order
  )
  select
    v_plan_id, 'listening', ranked.id, ranked.version, 'single_choice',
    ranked.prompt, '听材料后，选择正确答案。', ranked.options,
    ranked.options ->> ranked.correct_option, ranked.explanation,
    ranked.difficulty, 'listening', 3, ranked.question_rank
  from (
    select question.*,
      row_number() over (order by question.sort_order, question.id)::integer
        as question_rank
    from public.course_test_questions as question
    where question.test_id = p_test_id
      and question.status = 'published'
      and question.question_type = 'single_choice'
      and question.is_chapter_test_item
  ) as ranked
  where ranked.question_rank between 1 and 5;

  insert into public.chapter_homework_questions (
    plan_id, language_skill, source_bank_question_id, source_bank_version,
    question_type, stimulus_text, prompt, options, correct_answer,
    explanation, difficulty, source_skill, points, sort_order
  )
  select
    v_plan_id, 'reading', ranked.id, ranked.version, 'single_choice', '',
    ranked.prompt, ranked.options, ranked.options ->> ranked.correct_option,
    ranked.explanation, ranked.difficulty, 'reading', 3,
    ranked.question_rank - 5
  from (
    select question.*,
      row_number() over (order by question.sort_order, question.id)::integer
        as question_rank
    from public.course_test_questions as question
    where question.test_id = p_test_id
      and question.status = 'published'
      and question.question_type = 'single_choice'
      and question.is_chapter_test_item
  ) as ranked
  where ranked.question_rank between 6 and 10;

  insert into public.chapter_homework_questions (
    plan_id, language_skill, question_type, prompt, options, correct_answer,
    explanation, difficulty, source_skill, points, sort_order
  )
  select
    setting.plan_id,
    setting.language_skill,
    case when setting.language_skill = 'speaking'
      then 'audio_recording' else 'long_text' end,
    setting.instructions,
    '[]'::jsonb,
    null,
    case when setting.language_skill = 'speaking'
      then '由教师结合发音、流利度、准确度和完整度评分。'
      else '由教师结合内容、语法、词汇和连贯性评分。' end,
    'medium',
    setting.language_skill,
    20,
    1
  from public.chapter_homework_skill_settings as setting
  where setting.plan_id = v_plan_id
    and setting.language_skill in ('speaking', 'writing');

  update public.chapter_homework_skill_settings
  set target_question_count = case language_skill
      when 'vocabulary' then v_vocab_count
      when 'grammar' then v_grammar_count
      when 'listening' then 5
      when 'speaking' then 1
      when 'reading' then 5
      when 'writing' then 1
    end,
    enabled = true
  where plan_id = v_plan_id;
end;
$$;

-- 平台负责人发布章节作业时，原子生成一套机构可直接选择的标准作业卷。
create or replace function public.publish_chapter_homework_plan(
  p_plan_id uuid,
  p_status text default 'published'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.chapter_homework_plans%rowtype;
  v_test public.course_tests%rowtype;
  v_paper_id uuid;
  v_paper_code text;
  v_student_app_id uuid;
  v_question record;
  v_paper_question_id uuid;
  v_sort_order integer := 0;
  v_enabled_skill_count integer;
begin
  if not public.current_user_can_manage_assessment_papers() then
    raise exception '只有平台负责人可以发布章节作业';
  end if;
  if p_status not in ('draft', 'published') then
    raise exception '章节作业状态不正确';
  end if;

  select * into v_plan
  from public.chapter_homework_plans
  where id = p_plan_id
  for update;
  if not found then
    raise exception '章节作业计划不存在';
  end if;

  select * into v_test from public.course_tests where id = v_plan.test_id;
  select test.student_app_id into v_student_app_id
  from public.chapter_tests as test where test.id = v_plan.test_id;
  if v_test.id is null or v_student_app_id is null then
    raise exception '章节作业缺少有效的章节或应用归属';
  end if;

  perform private.sync_chapter_homework_six_skills(v_plan.test_id);

  select count(*) into v_enabled_skill_count
  from public.chapter_homework_skill_settings
  where plan_id = v_plan.id and enabled
    and target_question_count > 0
    and language_skill in (
      'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
    );
  if v_enabled_skill_count <> 6 then
    raise exception '词汇、语法、听力、口语、阅读、写作六项内容齐全后才能发布';
  end if;

  select id, paper_code into v_paper_id, v_paper_code
  from public.assessment_papers
  where source_homework_plan_id = v_plan.id
  for update;

  if v_paper_id is null then
    v_paper_code := 'HW-' || lpad(
      nextval('public.assessment_paper_code_seq')::text, 6, '0'
    );
    insert into public.assessment_papers (
      paper_code, paper_type, title, description, source_test_id,
      source_homework_plan_id, student_app_id, duration_minutes,
      passing_score, allow_resubmission, total_points, question_count,
      version, status, published_at, created_by, updated_by
    ) values (
      v_paper_code, 'homework', v_plan.title,
      '按本章教材完成词汇、语法、听力、口语、阅读、写作六项练习。',
      v_plan.test_id, v_plan.id, v_student_app_id, v_plan.duration_minutes,
      v_plan.passing_score, v_plan.allow_resubmission, 0, 0, 1,
      p_status, case when p_status = 'published' then now() else null end,
      auth.uid(), auth.uid()
    ) returning id into v_paper_id;
  else
    update public.assessment_papers
    set title = v_plan.title,
        description = '按本章教材完成词汇、语法、听力、口语、阅读、写作六项练习。',
        duration_minutes = v_plan.duration_minutes,
        passing_score = v_plan.passing_score,
        allow_resubmission = v_plan.allow_resubmission,
        version = version + 1,
        status = p_status,
        published_at = case when p_status = 'published' then now() else null end,
        updated_by = auth.uid(),
        updated_at = now()
    where id = v_paper_id;
    delete from public.assessment_paper_questions where paper_id = v_paper_id;
  end if;

  for v_question in
    select question.*
    from public.chapter_homework_questions as question
    where question.plan_id = v_plan.id
    order by case question.language_skill
      when 'vocabulary' then 1 when 'grammar' then 2
      when 'listening' then 3 when 'speaking' then 4
      when 'reading' then 5 when 'writing' then 6 end,
      question.sort_order
  loop
    insert into public.assessment_paper_questions (
      paper_id, source_bank_question_id, source_bank_version, question_type,
      stimulus_text, prompt, options, points, sort_order, difficulty, skill
    ) values (
      v_paper_id, v_question.source_bank_question_id,
      coalesce(v_question.source_bank_version, 1), v_question.question_type,
      v_question.stimulus_text, left(v_question.prompt, 3000),
      v_question.options, v_question.points, v_sort_order,
      v_question.difficulty, v_question.language_skill
    ) returning id into v_paper_question_id;

    insert into public.assessment_paper_question_keys (
      question_id, correct_answer, explanation
    ) values (
      v_paper_question_id, v_question.correct_answer,
      left(v_question.explanation, 3000)
    );
    v_sort_order := v_sort_order + 1;
  end loop;

  update public.assessment_papers
  set question_count = v_sort_order,
      total_points = (
        select coalesce(sum(points), 0)
        from public.assessment_paper_questions where paper_id = v_paper_id
      ),
      updated_at = now()
  where id = v_paper_id;

  update public.chapter_homework_plans
  set status = p_status,
      version = case when status is distinct from p_status then version + 1 else version end,
      updated_at = now()
  where id = v_plan.id;

  return v_paper_id;
end;
$$;

revoke all on function public.publish_chapter_homework_plan(uuid, text)
  from public, anon;
grant execute on function public.publish_chapter_homework_plan(uuid, text)
  to authenticated;

-- 发布到机构时，把六项分组和材料一并复制到学生任务快照。
create or replace function public.create_learning_assignment_from_paper(
  p_paper_id uuid,
  p_course_id uuid,
  p_target_scope text,
  p_target_ids uuid[],
  p_starts_at timestamptz,
  p_due_at timestamptz,
  p_institution_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_paper public.assessment_papers%rowtype;
  v_paper_question public.assessment_paper_questions%rowtype;
  v_paper_key public.assessment_paper_question_keys%rowtype;
  v_assignment_id uuid;
  v_question_id uuid;
  v_course_app_id uuid;
  v_target_count integer;
  v_expected_target_count integer;
begin
  select * into v_paper from public.assessment_papers
  where id = p_paper_id and status = 'published';
  if v_tenant_id is null or not found
    or not private.current_staff_has_app_capability(
      v_tenant_id, v_paper.student_app_id, 'manage_assessments'
    ) then
    raise exception '所选标准试卷不存在或当前账号没有该应用发布权限';
  end if;
  if not exists (
    select 1 from public.tenant_student_apps as tenant_app
    where tenant_app.tenant_id = v_tenant_id
      and tenant_app.app_id = v_paper.student_app_id
      and tenant_app.is_enabled and tenant_app.status = 'active'
  ) then
    raise exception '该应用尚未正式开放，不能发布作业或考试';
  end if;

  p_institution_note := btrim(coalesce(p_institution_note, ''));
  if char_length(p_institution_note) > 2000 then
    raise exception '机构通知不能超过 2000 个字';
  end if;
  if p_target_scope not in ('all_students', 'selected_students') then
    raise exception '分配范围不正确';
  end if;
  p_starts_at := coalesce(p_starts_at, now());
  if p_due_at is null or p_due_at <= p_starts_at then
    raise exception '截止时间必须晚于开始时间';
  end if;

  if p_course_id is not null then
    select course.student_app_id into v_course_app_id
    from public.courses as course
    where course.id = p_course_id and course.is_published
      and (course.content_scope = 'platform' or course.tenant_id = v_tenant_id);
    if v_course_app_id is null then
      raise exception '所选课程不存在、尚未发布或不属于当前机构';
    end if;
    if v_course_app_id is distinct from v_paper.student_app_id then
      raise exception '所选课程与标准试卷不属于同一个应用';
    end if;
  end if;

  if p_target_scope = 'selected_students' then
    select count(distinct value) into v_expected_target_count
    from unnest(coalesce(p_target_ids, array[]::uuid[])) as value;
    if v_expected_target_count = 0 then raise exception '请至少选择一名学生'; end if;
    select count(*) into v_target_count from (
      select distinct requested.value as student_id
      from unnest(p_target_ids) as requested(value)
      join public.tenant_memberships as membership
        on membership.tenant_id = v_tenant_id
       and membership.user_id = requested.value
       and membership.role = 'student' and membership.status = 'active'
      join public.student_app_enrollments as enrollment
        on enrollment.tenant_id = membership.tenant_id
       and enrollment.student_id = membership.user_id
       and enrollment.app_id = v_paper.student_app_id
       and enrollment.status = 'active' and enrollment.starts_at <= now()
       and (enrollment.ends_at is null or enrollment.ends_at > now())
    ) as valid_target;
    if v_target_count <> v_expected_target_count then
      raise exception '分配名单中包含未开通该应用的学生';
    end if;
  end if;

  insert into public.learning_assignments (
    tenant_id, student_app_id, title, description, assignment_type,
    course_id, target_scope, total_points, starts_at, due_at,
    duration_minutes, allow_resubmission, status, published_at,
    created_by, updated_by, source_paper_id, source_paper_code,
    source_paper_version, institution_note
  ) values (
    v_tenant_id, v_paper.student_app_id, v_paper.title, v_paper.description,
    v_paper.paper_type, p_course_id, p_target_scope, v_paper.total_points,
    p_starts_at, p_due_at, v_paper.duration_minutes,
    v_paper.allow_resubmission, 'published', now(), auth.uid(), auth.uid(),
    v_paper.id, v_paper.paper_code, v_paper.version, p_institution_note
  ) returning id into v_assignment_id;

  for v_paper_question in
    select * from public.assessment_paper_questions
    where paper_id = v_paper.id order by sort_order
  loop
    insert into public.learning_assignment_questions (
      tenant_id, assignment_id, question_type, language_skill, stimulus_text,
      prompt, options, points, sort_order, source_bank_question_id,
      source_bank_version
    ) values (
      v_tenant_id, v_assignment_id, v_paper_question.question_type,
      v_paper_question.skill, v_paper_question.stimulus_text,
      v_paper_question.prompt, v_paper_question.options,
      v_paper_question.points, v_paper_question.sort_order,
      v_paper_question.source_bank_question_id,
      v_paper_question.source_bank_version
    ) returning id into v_question_id;

    select * into v_paper_key from public.assessment_paper_question_keys
    where question_id = v_paper_question.id;
    if found then
      insert into public.learning_assignment_question_keys (
        tenant_id, question_id, correct_answer, explanation, updated_by
      ) values (
        v_tenant_id, v_question_id, v_paper_key.correct_answer,
        v_paper_key.explanation, auth.uid()
      );
    end if;
  end loop;

  if p_target_scope = 'selected_students' then
    insert into public.learning_assignment_targets (
      tenant_id, assignment_id, student_id
    ) select v_tenant_id, v_assignment_id, requested.value
    from (select distinct value from unnest(p_target_ids) as value) as requested
    on conflict do nothing;
  end if;
  return v_assignment_id;
end;
$$;

-- 回填韩国语一级 1—16 章的六项作业题，不自动发布，交由平台负责人确认。
select private.sync_chapter_homework_six_skills(test.id)
from public.course_tests as test
where test.slug ~ '^korean-level-one-(0[1-9]|1[0-6])$';

comment on function private.sync_chapter_homework_six_skills(uuid) is
  '从互动教材核心词汇、语法卡和章节题库重建六项章节作业。';
comment on function public.publish_chapter_homework_plan(uuid, text) is
  '平台负责人发布章节作业，并同步为机构可选择的标准作业卷。';

commit;
