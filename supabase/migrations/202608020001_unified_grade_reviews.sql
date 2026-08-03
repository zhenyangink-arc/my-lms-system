begin;

-- 成绩中心不再复制作业、考试或章节测试成绩。复核申请直接关联真实结果，
-- 同时保留一份提交时快照，避免章节测试重做覆盖旧成绩后丢失复核上下文。
alter table public.grade_review_requests
  alter column record_id drop not null,
  add column if not exists source_type text,
  add column if not exists source_result_id uuid,
  add column if not exists source_title text not null default '',
  add column if not exists source_score numeric(8,2),
  add column if not exists source_total_points numeric(8,2),
  add column if not exists source_context jsonb not null default '{}'::jsonb;

update public.grade_review_requests as review
set
  source_type = 'manual_grade_record',
  source_title = item.title,
  source_score = record.score,
  source_total_points = item.total_points,
  source_context = jsonb_build_object('grade_item_id', item.id)
from public.grade_records as record
join public.grade_items as item
  on item.tenant_id = record.tenant_id
 and item.id = record.item_id
where review.tenant_id = record.tenant_id
  and review.record_id = record.id
  and review.source_type is null;

update public.grade_review_requests
set source_type = 'manual_grade_record'
where source_type is null;

alter table public.grade_review_requests
  alter column source_type set not null,
  add constraint grade_review_requests_source_type_check
    check (source_type in (
      'manual_grade_record',
      'assignment_submission',
      'chapter_test_attempt'
    )),
  add constraint grade_review_requests_source_reference_check
    check (
      (
        source_type = 'manual_grade_record'
        and record_id is not null
        and source_result_id is null
      )
      or
      (
        source_type in ('assignment_submission', 'chapter_test_attempt')
        and record_id is null
        and source_result_id is not null
      )
    ),
  add constraint grade_review_requests_source_score_check
    check (
      source_score is null
      or source_score >= 0
    ),
  add constraint grade_review_requests_source_total_check
    check (
      source_total_points is null
      or source_total_points > 0
    );

create unique index if not exists grade_review_requests_source_result_unique_idx
  on public.grade_review_requests (
    tenant_id,
    student_id,
    source_type,
    source_result_id
  )
  where source_result_id is not null;

create index if not exists grade_review_requests_source_lookup_idx
  on public.grade_review_requests (
    tenant_id,
    source_type,
    source_result_id
  );

create or replace function public.request_source_grade_review(
  p_source_type text,
  p_source_result_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_review_id uuid;
  v_existing_status text;
  v_source_title text;
  v_source_score numeric;
  v_source_total numeric;
  v_source_context jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then
    raise exception '请先登录后再申请成绩复核';
  end if;

  if p_source_type not in ('assignment_submission', 'chapter_test_attempt') then
    raise exception '成绩来源不正确';
  end if;

  if char_length(trim(coalesce(p_reason, ''))) not between 2 and 2000 then
    raise exception '复核原因需要填写 2 至 2000 个字';
  end if;

  if p_source_type = 'assignment_submission' then
    select
      assignment.title,
      submission.score,
      assignment.total_points,
      jsonb_build_object(
        'assignment_id', assignment.id,
        'assignment_type', assignment.assignment_type,
        'attempt_number', submission.attempt_number
      )
    into
      v_source_title,
      v_source_score,
      v_source_total,
      v_source_context
    from public.learning_submissions as submission
    join public.learning_assignments as assignment
      on assignment.tenant_id = submission.tenant_id
     and assignment.id = submission.assignment_id
    where submission.tenant_id = v_tenant_id
      and submission.id = p_source_result_id
      and submission.student_id = auth.uid()
      and submission.status = 'graded'
      and submission.score is not null;
  else
    select
      coalesce(test.title, attempt.test_slug),
      attempt.score,
      100,
      jsonb_build_object(
        'test_slug', attempt.test_slug,
        'correct_count', attempt.correct_count,
        'total_questions', attempt.total_questions,
        'passed', attempt.passed
      )
    into
      v_source_title,
      v_source_score,
      v_source_total,
      v_source_context
    from public.chapter_test_attempts as attempt
    left join public.chapter_tests as test
      on test.slug = attempt.test_slug
    where attempt.tenant_id = v_tenant_id
      and attempt.id = p_source_result_id
      and attempt.student_id = auth.uid();
  end if;

  if v_source_title is null then
    raise exception '未找到可复核的成绩记录';
  end if;

  select review.id, review.status
  into v_review_id, v_existing_status
  from public.grade_review_requests as review
  where review.tenant_id = v_tenant_id
    and review.student_id = auth.uid()
    and review.source_type = p_source_type
    and review.source_result_id = p_source_result_id;

  if v_existing_status in ('pending', 'reviewing') then
    raise exception '该成绩已有正在处理的复核申请';
  end if;

  if v_review_id is null then
    insert into public.grade_review_requests (
      tenant_id,
      record_id,
      student_id,
      source_type,
      source_result_id,
      source_title,
      source_score,
      source_total_points,
      source_context,
      reason
    )
    values (
      v_tenant_id,
      null,
      auth.uid(),
      p_source_type,
      p_source_result_id,
      v_source_title,
      v_source_score,
      v_source_total,
      v_source_context,
      trim(p_reason)
    )
    returning id into v_review_id;
  else
    update public.grade_review_requests
    set
      source_title = v_source_title,
      source_score = v_source_score,
      source_total_points = v_source_total,
      source_context = v_source_context,
      reason = trim(p_reason),
      status = 'pending',
      response = '',
      handled_by = null,
      requested_at = now(),
      handled_at = null,
      updated_at = now()
    where id = v_review_id;
  end if;

  return v_review_id;
end;
$function$;

revoke all on function public.request_source_grade_review(text, uuid, text)
  from public, anon;
grant execute on function public.request_source_grade_review(text, uuid, text)
  to authenticated;

comment on column public.grade_review_requests.source_type is
  '真实成绩来源：作业提交、章节测试结果；manual_grade_record 仅兼容历史数据。';
comment on column public.grade_review_requests.source_context is
  '复核申请提交时的来源上下文快照，保证源成绩被覆盖后仍可追溯。';
comment on function public.request_source_grade_review(text, uuid, text) is
  '学生针对本人真实作业提交或章节测试结果发起成绩复核。';

commit;
