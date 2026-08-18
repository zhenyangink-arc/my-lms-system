begin;

alter table public.digital_textbook_attempts
  add column if not exists meets_completion_requirements boolean not null default false;

comment on column public.digital_textbook_attempts.meets_completion_requirements is
  'Separate completion qualification for open activities; never used as a numeric mastery score.';

-- Preserve the meaning of historical open attempts before normalizing every
-- persisted open activity to the shared NULL/NULL correctness contract.
update public.digital_textbook_attempts as attempt
set meets_completion_requirements = true
from public.digital_textbook_activities as activity
where activity.id = attempt.activity_id
  and activity.activity_type in ('speaking', 'writing', 'self_check')
  and attempt.is_correct is null
  and attempt.score is null;

update public.digital_textbook_attempts as attempt
set is_correct = null,
    score = null
from public.digital_textbook_activities as activity
where activity.id = attempt.activity_id
  and activity.activity_type in ('speaking', 'writing', 'self_check')
  and (attempt.is_correct is not null or attempt.score is not null);

-- Repair any already-persisted mastery values immediately; otherwise a learner
-- who makes no further attempt could retain a score calculated by the old path.
with objective_best_scores as (
  select
    progress.tenant_id,
    progress.student_id,
    progress.node_id,
    progress.version_id,
    activity.id as activity_id,
    max(attempt.score) as best_score
  from public.digital_textbook_node_progress as progress
  left join public.digital_textbook_activities as activity
    on activity.node_id = progress.node_id
   and activity.counts_toward_completion
   and activity.activity_type in (
     'single_choice', 'multiple_choice', 'fill_blank', 'ordering', 'listening'
   )
  left join public.digital_textbook_attempts as attempt
    on attempt.activity_id = activity.id
   and attempt.tenant_id = progress.tenant_id
   and attempt.student_id = progress.student_id
   and attempt.version_id = progress.version_id
  group by
    progress.tenant_id,
    progress.student_id,
    progress.node_id,
    progress.version_id,
    activity.id
), recalculated_mastery as (
  select
    tenant_id,
    student_id,
    node_id,
    version_id,
    coalesce(round(avg(best_score)), 0)::integer as mastery_score
  from objective_best_scores
  group by tenant_id, student_id, node_id, version_id
)
update public.digital_textbook_node_progress as progress
set mastery_score = recalculated.mastery_score,
    updated_at = now()
from recalculated_mastery as recalculated
where progress.tenant_id = recalculated.tenant_id
  and progress.student_id = recalculated.student_id
  and progress.node_id = recalculated.node_id
  and progress.version_id = recalculated.version_id
  and progress.mastery_score is distinct from recalculated.mastery_score;

drop function public.record_smart_textbook_attempt(
  uuid, uuid, uuid, uuid, jsonb, boolean, numeric
);

create function public.record_smart_textbook_attempt(
  p_tenant_id uuid,
  p_student_id uuid,
  p_activity_id uuid,
  p_version_id uuid,
  p_response jsonb,
  p_is_correct boolean,
  p_score numeric,
  p_meets_completion_requirements boolean
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
  v_activity_type text;
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

  select activity.node_id, activity.activity_type, activity.max_attempts
  into v_node_id, v_activity_type, v_max_attempts
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

  if v_activity_type in ('speaking', 'writing', 'self_check') then
    if p_is_correct is not null or p_score is not null then
      raise exception 'SMART_TEXTBOOK_OPEN_ACTIVITY_CANNOT_BE_SCORED'
        using errcode = '22023';
    end if;
    if p_meets_completion_requirements is null then
      raise exception 'SMART_TEXTBOOK_OPEN_ACTIVITY_QUALIFICATION_REQUIRED'
        using errcode = '22023';
    end if;
  elsif p_meets_completion_requirements is not null then
    raise exception 'SMART_TEXTBOOK_OBJECTIVE_ACTIVITY_QUALIFICATION_FORBIDDEN'
      using errcode = '22023';
  end if;

  -- Serialize attempt numbering and max-attempt enforcement per learner/activity.
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
    response, is_correct, score, meets_completion_requirements
  ) values (
    p_tenant_id, p_student_id, p_activity_id, p_version_id, v_attempt_number,
    coalesce(p_response, 'null'::jsonb), p_is_correct, p_score,
    coalesce(p_meets_completion_requirements, false)
  );

  -- Keep the attempt and its derived progress update atomic for a learner/node.
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
   and (
     attempt.is_correct is true
     or (
       activity.activity_type in ('speaking', 'writing', 'self_check')
       and attempt.meets_completion_requirements
     )
   )
  where activity.node_id = v_node_id
    and activity.counts_toward_completion;

  v_completion_percent := case
    when v_total_required = 0 then 0
    else round(100.0 * v_completed_required / v_total_required)::integer
  end;

  -- Open activities are excluded by type, even if legacy or forged rows ever
  -- contain a numeric score. Only objective activity scores affect mastery.
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
      and activity.activity_type in (
        'single_choice', 'multiple_choice', 'fill_blank', 'ordering', 'listening'
      )
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

-- Keep the shared seven-argument RPC available for already-built callers. It
-- can only represent a qualifying open submission; legacy false/0 attempts are
-- rejected and must use the explicit qualification argument after upgrading.
create function public.record_smart_textbook_attempt(
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
  v_activity_type text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'SMART_TEXTBOOK_SERVICE_ROLE_REQUIRED'
      using errcode = '42501';
  end if;

  select activity.activity_type
  into v_activity_type
  from public.digital_textbook_activities as activity
  where activity.id = p_activity_id;

  if v_activity_type in ('speaking', 'writing', 'self_check')
    and (p_is_correct is not null or p_score is not null) then
    raise exception 'SMART_TEXTBOOK_OPEN_ACTIVITY_CANNOT_BE_SCORED'
      using errcode = '22023';
  end if;

  return query
  select recorder.*
  from public.record_smart_textbook_attempt(
    p_tenant_id,
    p_student_id,
    p_activity_id,
    p_version_id,
    p_response,
    p_is_correct,
    p_score,
    case
      when v_activity_type in ('speaking', 'writing', 'self_check') then true
      else null
    end
  ) as recorder;
end;
$$;

revoke all on function public.record_smart_textbook_attempt(
  uuid, uuid, uuid, uuid, jsonb, boolean, numeric, boolean
) from public, anon, authenticated;
grant execute on function public.record_smart_textbook_attempt(
  uuid, uuid, uuid, uuid, jsonb, boolean, numeric, boolean
) to service_role;
revoke all on function public.record_smart_textbook_attempt(
  uuid, uuid, uuid, uuid, jsonb, boolean, numeric
) from public, anon, authenticated;
grant execute on function public.record_smart_textbook_attempt(
  uuid, uuid, uuid, uuid, jsonb, boolean, numeric
) to service_role;

comment on function public.record_smart_textbook_attempt(
  uuid, uuid, uuid, uuid, jsonb, boolean, numeric, boolean
) is
  'Service-only atomic attempt recorder. Open activities always persist NULL correctness and score, use a separate completion-qualification flag, and never contribute to mastery.';
comment on function public.record_smart_textbook_attempt(
  uuid, uuid, uuid, uuid, jsonb, boolean, numeric
) is
  'Service-only compatibility entry point. Legacy open NULL/NULL submissions qualify for completion; false/0 is rejected.';

commit;
