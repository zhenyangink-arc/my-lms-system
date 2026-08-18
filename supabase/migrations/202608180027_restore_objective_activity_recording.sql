-- Restore the minimum service-only recording contract required by objective
-- smart-textbook activities in databases that predate chapter-one security.
alter table public.digital_textbook_activities
  add column if not exists counts_toward_completion boolean not null default true;

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
    raise exception 'SMART_TEXTBOOK_SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  if p_score is not null and (p_score < 0 or p_score > 100) then
    raise exception 'SMART_TEXTBOOK_SCORE_OUT_OF_RANGE' using errcode = '22023';
  end if;

  select activity.node_id, activity.max_attempts
  into v_node_id, v_max_attempts
  from public.digital_textbook_activities activity
  join public.digital_textbook_nodes node on node.id = activity.node_id
  join public.digital_textbook_modules module on module.id = node.module_id
  join public.digital_textbook_chapters chapter on chapter.id = module.chapter_id
  where activity.id = p_activity_id
    and chapter.version_id = p_version_id;

  if v_node_id is null then
    raise exception 'SMART_TEXTBOOK_ACTIVITY_VERSION_MISMATCH' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_tenant_id::text || ':' || p_student_id::text || ':' || p_activity_id::text, 0)
  );

  select coalesce(max(attempt.attempt_number), 0), count(*)::integer
  into v_attempt_number, v_node_attempt_count
  from public.digital_textbook_attempts attempt
  where attempt.tenant_id = p_tenant_id
    and attempt.student_id = p_student_id
    and attempt.activity_id = p_activity_id;

  if v_node_attempt_count >= v_max_attempts then
    raise exception 'MAX_ATTEMPTS_REACHED: %', v_max_attempts using errcode = 'P0001';
  end if;

  v_attempt_number := v_attempt_number + 1;

  insert into public.digital_textbook_attempts (
    tenant_id, student_id, activity_id, version_id, attempt_number,
    response, is_correct, score
  ) values (
    p_tenant_id, p_student_id, p_activity_id, p_version_id, v_attempt_number,
    coalesce(p_response, 'null'::jsonb), p_is_correct, p_score
  );

  perform pg_advisory_xact_lock(
    hashtextextended(p_tenant_id::text || ':' || p_student_id::text || ':' || v_node_id::text, 1)
  );

  select count(*)::integer
  into v_total_required
  from public.digital_textbook_activities activity
  where activity.node_id = v_node_id
    and activity.counts_toward_completion;

  select count(distinct activity.id)::integer
  into v_completed_required
  from public.digital_textbook_activities activity
  join public.digital_textbook_attempts attempt
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
    from public.digital_textbook_activities activity
    left join public.digital_textbook_attempts attempt
      on attempt.activity_id = activity.id
     and attempt.tenant_id = p_tenant_id
     and attempt.student_id = p_student_id
     and attempt.version_id = p_version_id
    where activity.node_id = v_node_id
      and activity.counts_toward_completion
    group by activity.id
  ) best;

  select count(*)::integer
  into v_node_attempt_count
  from public.digital_textbook_attempts attempt
  join public.digital_textbook_activities activity on activity.id = attempt.activity_id
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
    case when v_total_required > 0 and v_completed_required = v_total_required
      then 'completed' else 'in_progress' end,
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
