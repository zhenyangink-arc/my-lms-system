-- R3A: infrastructure maintenance only. Never resumes execution.
begin;

-- Bounded tenant sweep; terminal history does not occupy this index.
create index agent_runs_reconcile_deadline on public.agent_runs(tenant_id,deadline_at,id)
  where status in ('created','running','waiting_tool');

create function public.find_reconcilable_agent_runs_v1(p_tenant uuid,p_limit integer default 50)
returns table(run_id uuid,status text,deadline_at timestamptz,lease_expires_at timestamptz,
  cancel_requested_at timestamptz,state_version integer,fencing_token uuid)
language plpgsql security definer set search_path='' as $$
declare cutoff timestamptz:=clock_timestamp()-interval '6 seconds';
begin
  if p_tenant is null or p_limit is null or p_limit not between 1 and 100 then raise exception 'INVALID_REQUEST'; end if;
  return query select r.id,r.status,r.deadline_at,r.lease_expires_at,r.cancel_requested_at,r.state_version,r.fencing_token
    from public.agent_runs r where r.tenant_id=p_tenant and r.status in ('created','running','waiting_tool')
    and r.deadline_at <= cutoff
    order by r.deadline_at,r.id limit p_limit;
end $$;

create function public.reconcile_agent_run_v1(p_tenant uuid,p_run uuid,p_expected_version integer,p_fence uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.agent_runs; previous text; target text; reason text; stamp timestamptz; sequence bigint;
begin
  if p_tenant is null or p_run is null or p_expected_version is null or p_expected_version<1 or p_fence is null
    then raise exception 'INVALID_REQUEST'; end if;
  select * into r from public.agent_runs where tenant_id=p_tenant and id=p_run for update;
  if not found then return jsonb_build_object('result','not_found'); end if;
  -- Terminal winner is immutable, even if the scanner saw an older version/fence.
  if r.status in ('completed','failed','cancelled') then
    return jsonb_build_object('result','already_terminal','status',r.status);
  end if;
  if r.state_version<>p_expected_version or r.fencing_token<>p_fence then
    return jsonb_build_object('result','fence_conflict');
  end if;
  stamp:=clock_timestamp();
  -- Admission fixes lease=deadline; no heartbeat/ownership-death guess. Deadline
  -- already denies completion. Allow existing 3 x 2s stop-only cleanup first.
  if r.deadline_at>stamp-interval '6 seconds' then
    return jsonb_build_object('result','not_eligible','status',r.status);
  end if;
  previous:=r.status;
  if r.cancel_requested_at is not null and r.cancel_requested_at<r.deadline_at then
    target:='cancelled'; reason:='RUN_CANCELLED';
  else target:='failed'; reason:='DEADLINE_EXCEEDED'; end if;
  update public.agent_runs set status=target,state_version=state_version+1,ended_at=stamp,terminal_reason=reason
    where id=r.id and tenant_id=p_tenant and state_version=p_expected_version and fencing_token=p_fence;
  if not found then return jsonb_build_object('result','fence_conflict'); end if;
  select coalesce(max(seq),0) into sequence from public.agent_run_events where run_id=r.id;
  insert into public.agent_run_events(tenant_id,actor_id,run_id,seq,kind,metadata) values
    (r.tenant_id,r.actor_id,r.id,sequence+1,'run.reconciled',jsonb_build_object('reason',reason,'previousStatus',previous,
      'deadlineExceeded',true,'cancelRequested',r.cancel_requested_at is not null,'reconcilerVersion','deadline-terminal-v1')),
    (r.tenant_id,r.actor_id,r.id,sequence+2,'run.'||target,'{}'::jsonb);
  -- No message, usage, context, teaching data, or answer.final is written.
  return jsonb_build_object('result','reconciled','status',target,'reason',reason);
end $$;

create function public.reconcile_agent_run_batch_v1(p_tenant uuid,p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare candidate record; outcome jsonb; outcomes jsonb:='[]'; reconciled_cancelled integer:=0;
  reconciled_deadline_failed integer:=0;
begin
  -- A single bounded transaction. Any exception rolls back the entire batch;
  -- caller records a failed invocation, never reports a partial commit as success.
  for candidate in select * from public.find_reconcilable_agent_runs_v1(p_tenant,p_limit) loop
    outcome:=public.reconcile_agent_run_v1(p_tenant,candidate.run_id,candidate.state_version,candidate.fencing_token);
    outcomes:=outcomes||jsonb_build_array(jsonb_build_object('runId',candidate.run_id)||outcome);
    if outcome->>'result'='reconciled' then
      if outcome->>'status'='cancelled' then reconciled_cancelled:=reconciled_cancelled+1;
      else reconciled_deadline_failed:=reconciled_deadline_failed+1; end if;
    end if;
  end loop;
  return jsonb_build_object('contractVersion','deadline-terminal-v1','results',outcomes,
    'reconciledCancelled',reconciled_cancelled,'reconciledDeadlineFailed',reconciled_deadline_failed,'reconcileError',0);
end $$;

do $$ declare signature regprocedure; begin
  foreach signature in array array[
    'public.find_reconcilable_agent_runs_v1(uuid,integer)'::regprocedure,
    'public.reconcile_agent_run_v1(uuid,uuid,integer,uuid)'::regprocedure,
    'public.reconcile_agent_run_batch_v1(uuid,integer)'::regprocedure] loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',signature);
    execute format('grant execute on function %s to service_role',signature);
  end loop;
end $$;
commit;
