begin;

select set_config('app.platform_content_migration', 'on', true);

-- The chapter-one assessment must return to editorial control in every
-- environment, including environments where it already existed as published.
update public.chapter_tests
set status = 'draft', updated_at = now()
where slug = 'korean-level-one-01';

do $questions$
declare
  v_test_id uuid;
begin
  select id into v_test_id
  from public.chapter_tests
  where slug = 'korean-level-one-01';

  if v_test_id is null then
    raise exception 'Cannot secure chapter 01: korean-level-one-01 test is missing';
  end if;

  -- Remove all prior/non-canonical items. Status alone cannot avoid collisions
  -- because (test_id, sort_order) is unique across every question status.
  delete from public.chapter_test_questions
  where test_id = v_test_id
    and question_key not in (
      'golden-01-01', 'golden-01-02', 'golden-01-03', 'golden-01-04',
      'golden-01-05', 'golden-01-06', 'golden-01-07', 'golden-01-08',
      'golden-01-09', 'golden-01-10', 'golden-01-11', 'golden-01-12'
    );

  -- Free canonical sort positions before deterministic upsert. This also
  -- repairs environments where the same keys had stale/reordered positions.
  update public.chapter_test_questions
  set sort_order = sort_order + 100, updated_at = now()
  where test_id = v_test_id;

  insert into public.chapter_test_questions (
    test_id, question_key, prompt, options, correct_option, explanation,
    skill, sort_order, question_type, default_points, difficulty, tags,
    status, version, is_chapter_test_item, ebook_section_step,
    ebook_page_reference
  )
  values
    (v_test_id, 'golden-01-01', '第一次见面时，哪一句是合适的问候？', '["안녕하세요?","안녕히 가세요.","감사합니다.","괜찮아요."]', 0, '안녕하세요? 用于礼貌地向见面对象问候。', 'recognition', 1, 'single_choice', 10, 'foundation', '["问候","母本§4"]', 'draft', 1, true, 'STEP 02', '母本 §4'),
    (v_test_id, 'golden-01-02', '韩语“저”在本课中的意思是什么？', '["我（谦称）","老师","朋友","名字"]', 0, '저 是说话人礼貌、谦逊的自称。', 'recognition', 2, 'single_choice', 10, 'foundation', '["词汇","母本§4"]', 'draft', 1, true, 'STEP 02', '母本 §4'),
    (v_test_id, 'golden-01-03', '“저는 학생___.”应填入哪一项？', '["예요","이에요","은","는"]', 1, '학생有收音，名词后接 이에요。', 'structure', 3, 'single_choice', 10, 'foundation', '["语法","母本§5.1"]', 'draft', 1, true, 'STEP 03', '母本 §5.1'),
    (v_test_id, 'golden-01-04', '“저는 리나___.”的正确形态是哪一项？', '["이에요","은","예요","는"]', 2, '리나没有收音，名词后接 예요。', 'structure', 4, 'single_choice', 10, 'foundation', '["语法","母本§5.1"]', 'draft', 1, true, 'STEP 03', '母本 §5.1'),
    (v_test_id, 'golden-01-05', '要把“지민 씨”设为话题，应写成哪一项？', '["지민 씨은","지민 씨는","지민 씨예요는","지민 씨이에요"]', 1, '씨没有收音，话题助词使用 는。', 'structure', 5, 'single_choice', 10, 'foundation', '["语法","母本§5.2"]', 'draft', 1, true, 'STEP 03', '母本 §5.2'),
    (v_test_id, 'golden-01-06', '哪一句能礼貌确认对方是不是学生？', '["학생은 지민 씨.","지민 씨는 학생이에요?","지민 씨 학생 까?","학생이 지민 씨는."]', 1, '身份确认问句保持 이에요/예요 形态，并在口语中使用疑问语调。', 'structure', 6, 'single_choice', 10, 'medium', '["确认问句","母本§5.3"]', 'draft', 1, true, 'STEP 03', '母本 §5.3'),
    (v_test_id, 'golden-01-07', '听到“지민 씨는 학생이에요?”时，哪一回答最完整？', '["네, 학생이에요.","학생?","저는?","안녕하세요."]', 0, '네 后补全身份信息，回答更清楚自然。', 'assembly', 7, 'single_choice', 10, 'medium', '["应答","母本§6"]', 'draft', 1, true, 'STEP 04', '母本 §6'),
    (v_test_id, 'golden-01-08', '“만나서 반가워요.”最适合出现在初次见面对话的什么位置？', '["确认地点时","自然收尾时","询问价格时","说明时间时"]', 1, '该表达用于初次见面后的礼貌回应和自然收尾。', 'reading', 8, 'single_choice', 10, 'foundation', '["对话","母本§7"]', 'draft', 1, true, 'STEP 05', '母本 §7'),
    (v_test_id, 'golden-01-09', '哪一组最符合本课初次见面对话的顺序？', '["告别→问候→身份→姓名","身份→告别→问候→姓名","问候→姓名→身份确认→礼貌收尾","姓名→购物→问候→告别"]', 2, '母本主对话按问候、交换姓名、确认身份、礼貌收尾展开。', 'assembly', 9, 'single_choice', 10, 'medium', '["对话结构","母本§7"]', 'draft', 1, true, 'STEP 05', '母本 §7'),
    (v_test_id, 'golden-01-10', '资料卡写着“이름: 왕밍 / 신분: 학생”，哪一句正确？', '["왕밍 씨는 선생님이에요.","왕밍 씨는 학생이에요.","왕밍 씨는 친구예요? 아니요.","왕밍 씨는 이름이에요."]', 1, '资料卡表明王明的身份是学生。', 'reading', 10, 'single_choice', 10, 'foundation', '["阅读","母本§9"]', 'draft', 1, true, 'STEP 07', '母本 §9'),
    (v_test_id, 'golden-01-11', '哪一句同时包含话题和身份说明？', '["학생이에요?","저는 왕밍이에요.","이름이 뭐예요?","만나서 반가워요."]', 1, '저는 设置话题，왕밍이에요 说明姓名身份信息。', 'structure', 11, 'single_choice', 10, 'medium', '["综合语法","母本§5"]', 'draft', 1, true, 'STEP 08', '母本 §5'),
    (v_test_id, 'golden-01-12', '课末双角色任务必须满足哪一项？', '["只说一句问候","单人背诵词汇","只写姓名资料卡","约30秒并至少8轮，包含问候、姓名、身份确认和收尾"]', 3, '母本要求完成约30秒、至少8轮的双角色初次见面对话。', 'assembly', 12, 'single_choice', 10, 'medium', '["任务合同","母本§10"]', 'draft', 1, true, 'STEP 08', '母本 §10')
  on conflict (test_id, question_key) do update set
    prompt = excluded.prompt,
    options = excluded.options,
    correct_option = excluded.correct_option,
    explanation = excluded.explanation,
    skill = excluded.skill,
    sort_order = excluded.sort_order,
    question_type = excluded.question_type,
    default_points = excluded.default_points,
    difficulty = excluded.difficulty,
    tags = excluded.tags,
    status = 'draft',
    version = excluded.version,
    is_chapter_test_item = excluded.is_chapter_test_item,
    ebook_section_step = excluded.ebook_section_step,
    ebook_page_reference = excluded.ebook_page_reference,
    updated_at = now();
end;
$questions$;

alter table public.digital_textbook_activities
  add column if not exists counts_toward_completion boolean not null default true;

update public.digital_textbook_activities
set counts_toward_completion = activity_type not in ('speaking', 'writing', 'self_check'),
    updated_at = now();

-- Writing evidence is evaluated from the submitted text itself. Client-side
-- checklist booleans are deliberately absent from these requirements.
update public.digital_textbook_activities as activity
set public_config = activity.public_config || jsonb_build_object(
      'minimumHangulCharacters', 20,
      'minimumPhraseGroups', 4,
      'requiredPhraseGroups', jsonb_build_array(
        jsonb_build_array('안녕하세요'),
        jsonb_build_array('저는', '제 이름'),
        jsonb_build_array('학생이에요', '선생님이에요', '회사원이에요', '사람이에요'),
        jsonb_build_array('만나서 반가워요')
      )
    ),
    updated_at = now()
where activity.activity_key = 'write-profile'
  and activity.activity_type = 'writing';

revoke insert on public.digital_textbook_attempts from authenticated;
revoke insert, update, delete on public.digital_textbook_node_progress from authenticated;

create or replace function public.record_smart_textbook_attempt(
  p_tenant_id uuid,
  p_student_id uuid,
  p_activity_id uuid,
  p_version_id uuid,
  p_response jsonb,
  p_is_correct boolean,
  p_score numeric
)
returns table (
  attempt_number integer,
  node_completed boolean,
  completion_percent integer,
  mastery_score integer,
  node_attempt_count integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_node_id uuid;
  v_max_attempts integer;
  v_attempt_number integer;
  v_total_required integer;
  v_completed_required integer;
  v_completion_percent integer;
  v_mastery_score integer;
  v_node_attempt_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'SMART_TEXTBOOK_SERVICE_ROLE_REQUIRED'
      using errcode = '42501';
  end if;

  if p_score is not null and (p_score < 0 or p_score > 100) then
    raise exception 'SMART_TEXTBOOK_SCORE_OUT_OF_RANGE'
      using errcode = '22023';
  end if;

  select activity.node_id, activity.max_attempts
  into v_node_id, v_max_attempts
  from public.digital_textbook_activities as activity
  join public.digital_textbook_nodes as node on node.id = activity.node_id
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
  where activity.id = p_activity_id
    and chapter.version_id = p_version_id;

  if v_node_id is null then
    raise exception 'SMART_TEXTBOOK_ACTIVITY_VERSION_MISMATCH'
      using errcode = '22023';
  end if;

  -- The transaction-scoped advisory lock makes max-attempt checking and the
  -- next number a single atomic operation for this learner/activity.
  perform pg_advisory_xact_lock(
    hashtextextended(
      p_tenant_id::text || ':' || p_student_id::text || ':' || p_activity_id::text,
      0
    )
  );

  select coalesce(max(attempt.attempt_number), 0), count(*)::integer
  into v_attempt_number, v_node_attempt_count
  from public.digital_textbook_attempts as attempt
  where attempt.tenant_id = p_tenant_id
    and attempt.student_id = p_student_id
    and attempt.activity_id = p_activity_id;

  if v_node_attempt_count >= v_max_attempts then
    raise exception 'MAX_ATTEMPTS_REACHED: %', v_max_attempts
      using errcode = 'P0001';
  end if;

  v_attempt_number := v_attempt_number + 1;

  insert into public.digital_textbook_attempts (
    tenant_id, student_id, activity_id, version_id, attempt_number,
    response, is_correct, score
  ) values (
    p_tenant_id, p_student_id, p_activity_id, p_version_id, v_attempt_number,
    coalesce(p_response, 'null'::jsonb), p_is_correct, p_score
  );

  -- Serialize derived progress updates per learner/node as well. Any progress
  -- error aborts this function and rolls back the attempt in the same transaction.
  perform pg_advisory_xact_lock(
    hashtextextended(
      p_tenant_id::text || ':' || p_student_id::text || ':' || v_node_id::text,
      1
    )
  );

  select count(*)::integer
  into v_total_required
  from public.digital_textbook_activities as activity
  where activity.node_id = v_node_id
    and activity.counts_toward_completion;

  select count(distinct activity.id)::integer
  into v_completed_required
  from public.digital_textbook_activities as activity
  join public.digital_textbook_attempts as attempt
    on attempt.activity_id = activity.id
   and attempt.tenant_id = p_tenant_id
   and attempt.student_id = p_student_id
   and attempt.version_id = p_version_id
   and attempt.is_correct is true
  where activity.node_id = v_node_id
    and activity.counts_toward_completion;

  v_completion_percent := case
    when v_total_required = 0 then 0
    else round(100.0 * v_completed_required / v_total_required)::integer
  end;

  select coalesce(round(avg(best.best_score)), 0)::integer
  into v_mastery_score
  from (
    select max(attempt.score) as best_score
    from public.digital_textbook_activities as activity
    left join public.digital_textbook_attempts as attempt
      on attempt.activity_id = activity.id
     and attempt.tenant_id = p_tenant_id
     and attempt.student_id = p_student_id
     and attempt.version_id = p_version_id
    where activity.node_id = v_node_id
      and activity.counts_toward_completion
    group by activity.id
  ) as best;

  select count(*)::integer
  into v_node_attempt_count
  from public.digital_textbook_attempts as attempt
  join public.digital_textbook_activities as activity
    on activity.id = attempt.activity_id
  where activity.node_id = v_node_id
    and attempt.tenant_id = p_tenant_id
    and attempt.student_id = p_student_id
    and attempt.version_id = p_version_id;

  insert into public.digital_textbook_node_progress (
    tenant_id, student_id, node_id, version_id, status,
    completion_percent, mastery_score, attempt_count,
    last_activity_at, updated_at
  ) values (
    p_tenant_id, p_student_id, v_node_id, p_version_id,
    case
      when v_total_required > 0 and v_completed_required = v_total_required
        then 'completed'
      else 'in_progress'
    end,
    v_completion_percent, v_mastery_score, v_node_attempt_count,
    now(), now()
  )
  on conflict (tenant_id, student_id, node_id, version_id) do update set
    status = excluded.status,
    completion_percent = excluded.completion_percent,
    mastery_score = excluded.mastery_score,
    attempt_count = excluded.attempt_count,
    last_activity_at = excluded.last_activity_at,
    updated_at = excluded.updated_at;

  return query select
    v_attempt_number,
    v_total_required > 0 and v_completed_required = v_total_required,
    v_completion_percent,
    v_mastery_score,
    v_node_attempt_count;
end;
$$;

revoke all on function public.record_smart_textbook_attempt(
  uuid, uuid, uuid, uuid, jsonb, boolean, numeric
) from public, anon, authenticated;
grant execute on function public.record_smart_textbook_attempt(
  uuid, uuid, uuid, uuid, jsonb, boolean, numeric
) to service_role;

comment on function public.record_smart_textbook_attempt(
  uuid, uuid, uuid, uuid, jsonb, boolean, numeric
) is
  'Service-only atomic attempt recorder. Enforces max_attempts and derives node progress exclusively from is_correct=true objective activities.';

-- Repair rows previously completed through NULL attempts. Open submissions are
-- retained as attempts, but only true objective evidence counts from now on.
with summary as (
  select
    progress.tenant_id,
    progress.student_id,
    progress.node_id,
    progress.version_id,
    count(distinct activity.id) filter (
      where activity.counts_toward_completion
    )::integer as total_required,
    count(distinct activity.id) filter (
      where activity.counts_toward_completion and attempt.is_correct is true
    )::integer as completed_required
  from public.digital_textbook_node_progress as progress
  left join public.digital_textbook_activities as activity
    on activity.node_id = progress.node_id
  left join public.digital_textbook_attempts as attempt
    on attempt.activity_id = activity.id
   and attempt.tenant_id = progress.tenant_id
   and attempt.student_id = progress.student_id
   and attempt.version_id = progress.version_id
  group by
    progress.tenant_id, progress.student_id, progress.node_id, progress.version_id
)
update public.digital_textbook_node_progress as progress
set
  status = case
    when summary.total_required > 0
      and summary.completed_required = summary.total_required then 'completed'
    else 'in_progress'
  end,
  completion_percent = case
    when summary.total_required = 0 then 0
    else round(100.0 * summary.completed_required / summary.total_required)::integer
  end,
  updated_at = now()
from summary
where progress.tenant_id = summary.tenant_id
  and progress.student_id = summary.student_id
  and progress.node_id = summary.node_id
  and progress.version_id = summary.version_id;

create or replace function private.sync_smart_textbook_chapter_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chapter_id uuid;
  v_test_slug text;
  v_student_app_id uuid;
  v_total_nodes integer;
  v_completed_nodes integer;
  v_total_activities integer;
  v_completed_activities integer;
begin
  if new.status <> 'completed' or new.completion_percent < 100 then
    return new;
  end if;

  select chapter.id, test.slug, test.student_app_id
  into v_chapter_id, v_test_slug, v_student_app_id
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
  join public.chapter_tests as test on test.id = chapter.chapter_test_id
  where node.id = new.node_id
    and chapter.version_id = new.version_id
    and test.status = 'published';

  if v_chapter_id is null then return new; end if;

  select count(*) into v_total_nodes
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  where module.chapter_id = v_chapter_id;

  select count(*) into v_completed_nodes
  from public.digital_textbook_node_progress as progress
  join public.digital_textbook_nodes as node on node.id = progress.node_id
  join public.digital_textbook_modules as module on module.id = node.module_id
  where module.chapter_id = v_chapter_id
    and progress.tenant_id = new.tenant_id
    and progress.student_id = new.student_id
    and progress.version_id = new.version_id
    and progress.status = 'completed'
    and progress.completion_percent = 100;

  if v_total_nodes <> 8 or v_completed_nodes <> v_total_nodes then
    return new;
  end if;

  select count(*) into v_total_activities
  from public.digital_textbook_activities as activity
  join public.digital_textbook_nodes as node on node.id = activity.node_id
  join public.digital_textbook_modules as module on module.id = node.module_id
  where module.chapter_id = v_chapter_id
    and activity.counts_toward_completion;

  select count(distinct activity.id) into v_completed_activities
  from public.digital_textbook_activities as activity
  join public.digital_textbook_nodes as node on node.id = activity.node_id
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_attempts as attempt
    on attempt.activity_id = activity.id
   and attempt.tenant_id = new.tenant_id
   and attempt.student_id = new.student_id
   and attempt.version_id = new.version_id
   and attempt.is_correct is true
  where module.chapter_id = v_chapter_id
    and activity.counts_toward_completion;

  if v_total_activities = 0 or v_completed_activities <> v_total_activities then
    return new;
  end if;

  insert into public.course_ebook_progress (
    tenant_id, student_id, student_app_id, test_slug,
    current_page, total_pages, progress_percent, read_pages,
    reading_seconds, completion_source, last_read_at, updated_at
  ) values (
    new.tenant_id, new.student_id, v_student_app_id, v_test_slug,
    0, 32, 0, '{}'::integer[], 0, 'smart_textbook', now(), now()
  )
  on conflict (tenant_id, student_id, test_slug) do nothing;

  update public.course_ebook_progress as progress
  set
    progress_percent = 100,
    completion_source = case
      when progress.completion_source = 'both' then 'both'
      when progress.completion_source = 'ebook'
        and progress.progress_percent >= 100
        and progress.reading_seconds >= 600 then 'both'
      else 'smart_textbook'
    end,
    updated_at = now()
  where progress.tenant_id = new.tenant_id
    and progress.student_id = new.student_id
    and progress.test_slug = v_test_slug;

  return new;
end;
$$;

-- Revoke compatibility unlocks that were derived only from fail-open evidence.
update public.course_ebook_progress as ebook
set
  completion_source = case
    when ebook.completion_source = 'both' then 'ebook'
    else 'ebook'
  end,
  progress_percent = case
    when ebook.reading_seconds >= 600 then ebook.progress_percent
    else 0
  end,
  updated_at = now()
where ebook.test_slug = 'korean-level-one-01'
  and ebook.completion_source in ('smart_textbook', 'both')
  and not exists (
    select 1
    from public.digital_textbook_chapters as chapter
    join public.digital_textbook_modules as module on module.chapter_id = chapter.id
    join public.digital_textbook_nodes as node on node.module_id = module.id
    join public.digital_textbook_node_progress as progress
      on progress.node_id = node.id
     and progress.version_id = chapter.version_id
     and progress.tenant_id = ebook.tenant_id
     and progress.student_id = ebook.student_id
     and progress.status = 'completed'
     and progress.completion_percent = 100
    where chapter.chapter_test_id = (
      select id from public.chapter_tests where slug = 'korean-level-one-01'
    )
    group by chapter.id
    having count(distinct node.id) = 8
  );

commit;
