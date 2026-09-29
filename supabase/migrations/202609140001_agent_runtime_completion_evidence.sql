-- Stage 1C: apply only to an explicitly disposable integration DB until target gates pass.
begin;
create or replace function agent_core_private.definition_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare a jsonb:=new.manifest->'artifacts'; k text; v jsonb;
begin
  perform agent_core_private.actor_guard(new.tenant_id,new.actor_id);
  if (new.manifest-'agentCode'-'definitionVersion'-'status'-'promptVersion'-'contextVersion'-'model'-'allowedSkillRefs'-'allowedToolRefs'-'policyVersion'-'budget'-'artifacts')<>'{}'::jsonb
    or new.manifest->>'agentCode' is distinct from new.agent_code
    or new.manifest#>>'{definitionVersion,name}' is distinct from new.agent_code
    or new.manifest#>>'{definitionVersion,version}' is distinct from new.version
    or new.manifest->>'status' is distinct from new.status
    or jsonb_typeof(new.manifest->'model') is distinct from 'object'
    or ((new.manifest->'model')-'provider'-'model'-'configVersion')<>'{}'::jsonb
    or new.manifest#>>'{promptVersion,version}' is null or new.manifest#>>'{contextVersion,version}' is null
  then raise exception 'INVALID_REQUEST'; end if;
  if new.manifest ? 'artifacts' then
    if jsonb_typeof(a) is distinct from 'object' or a->'schemaVersion' is distinct from '1'::jsonb
      or (a-'schemaVersion'-'definitionDigest'-'personaRef'-'privateInstructionsRef'-'skillDigest'-'toolsDigest'-'completionPolicyRef'-'requiredEvidenceToolRef')<>'{}'::jsonb
    then raise exception 'INVALID_REQUEST'; end if;
    foreach k in array array['definitionDigest','skillDigest','toolsDigest'] loop
      if not coalesce(a->>k ~ '^[a-f0-9]{64}$',false) then raise exception 'INVALID_REQUEST'; end if;
    end loop;
    foreach k in array array['personaRef','privateInstructionsRef','completionPolicyRef','requiredEvidenceToolRef'] loop
      v:=a->k;
      if jsonb_typeof(v) is distinct from 'object' or (v-'name'-'version')<>'{}'::jsonb
        or not coalesce(length(v->>'name') between 1 and 100,false) or not coalesce(length(v->>'version') between 1 and 100,false)
      then raise exception 'INVALID_REQUEST'; end if;
    end loop;
  end if;
  return new;
end $$;

create function public.append_agent_run_event_v2(p_tenant uuid,p_actor uuid,p_run uuid,p_version integer,p_fence uuid,p_event jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare r public.agent_runs; d jsonb:=p_event->'details'; k text; v jsonb;
begin
  -- Only a failure audit may use stop-only cleanup after membership expiry/revocation.
  if p_event->>'kind' is distinct from 'run.failure' then perform agent_core_private.actor_guard(p_tenant,p_actor); end if;
  select * into r from public.agent_runs where id=p_run and tenant_id=p_tenant and actor_id=p_actor for update;
  if not found then raise exception 'RUN_NOT_FOUND'; end if;
  if r.state_version is distinct from p_version or r.fencing_token is distinct from p_fence or r.status in ('completed','failed','cancelled') then raise exception 'PERSISTENCE_FAILED'; end if;
  if p_event->>'kind' is null or p_event->>'kind' not in ('run.started','permission.checked','context.resolved','skill.selected','model.started','tool.started','tool.requested','tool.completed','evidence.checked','output.checked','definition.pinned','prompt.assembled','run.failure')
    or (p_event-'kind'-'runId'-'at'-'modelCallId'-'toolCallId'-'skillRunId'-'contextSnapshotId'-'errorCode'-'details')<>'{}'::jsonb
    or p_event->>'runId' is distinct from p_run::text or jsonb_typeof(d) is distinct from 'object'
    or (d-'definitionDigest'-'authorityDigest'-'promptDigest'-'profileRef'-'skillRef'-'toolRef'-'promptVersion'-'contextVersion'-'policyVersion'-'modelConfigVersion'-'stage'-'status'-'revision'-'segmentRef'-'sourceRefs'-'completeness'-'asOf'-'byteEstimate'-'sections')<>'{}'::jsonb
  then raise exception 'INVALID_REQUEST'; end if;
  foreach k in array array['definitionDigest','authorityDigest','promptDigest'] loop
    if d ? k and not coalesce(d->>k ~ '^[a-f0-9]{64}$',false) then raise exception 'INVALID_REQUEST'; end if;
  end loop;
  foreach k in array array['profileRef','skillRef','toolRef','promptVersion','contextVersion','policyVersion'] loop
    if d ? k then
      v:=d->k;
      if jsonb_typeof(v) is distinct from 'object' or (v-'name'-'version')<>'{}'::jsonb
        or not coalesce(length(v->>'name') between 1 and 100,false) or not coalesce(length(v->>'version') between 1 and 100,false)
      then raise exception 'INVALID_REQUEST'; end if;
    end if;
  end loop;
  if d ? 'stage' and not coalesce(d->>'stage' in ('intake','admission','context','planning','corrective','tool','final','persistence'),false) then raise exception 'INVALID_REQUEST'; end if;
  if d ? 'status' and not coalesce(d->>'status' in ('pass','fail','ok','partial','stale','denied','unavailable'),false) then raise exception 'INVALID_REQUEST'; end if;
  if d ? 'completeness' and not coalesce(d->>'completeness' in ('complete','partial'),false) then raise exception 'INVALID_REQUEST'; end if;
  if d ? 'modelConfigVersion' and not coalesce(length(d->>'modelConfigVersion') between 1 and 100,false) then raise exception 'INVALID_REQUEST'; end if;
  if d ? 'byteEstimate' and (jsonb_typeof(d->'byteEstimate')<>'number' or (d->>'byteEstimate')::numeric not between 0 and 1000000 or trunc((d->>'byteEstimate')::numeric)<>(d->>'byteEstimate')::numeric) then raise exception 'INVALID_REQUEST'; end if;
  if d ? 'asOf' then perform (d->>'asOf')::timestamptz; end if;
  foreach k in array array['revision','segmentRef'] loop
    if d ? k and not coalesce(d->>k ~ '^ta1:[a-z_]+:[a-f0-9]{64}$',false) then raise exception 'INVALID_REQUEST'; end if;
  end loop;
  if d ? 'sourceRefs' then
    if jsonb_typeof(d->'sourceRefs')<>'array' or jsonb_array_length(d->'sourceRefs')>3 then raise exception 'INVALID_REQUEST'; end if;
    for v in select value from jsonb_array_elements(d->'sourceRefs') loop
      if jsonb_typeof(v)<>'string' or not coalesce(v#>>'{}' ~ '^ta1:[a-z_]+:[a-f0-9]{64}$',false) then raise exception 'INVALID_REQUEST'; end if;
    end loop;
  end if;
  if d ? 'sections' then
    if jsonb_typeof(d->'sections')<>'array' or jsonb_array_length(d->'sections')>8 then raise exception 'INVALID_REQUEST'; end if;
    for v in select value from jsonb_array_elements(d->'sections') loop
      if not coalesce(v#>>'{}' in ('base','role','persona','skill','constraints','context','history','question'),false) then raise exception 'INVALID_REQUEST'; end if;
    end loop;
  end if;
  if p_event->>'kind'='context.resolved' and (p_event->>'contextSnapshotId' is null or (r.context_metadata ? 'snapshotId' and r.context_metadata->>'snapshotId' is distinct from p_event->>'contextSnapshotId')) then raise exception 'INVALID_REQUEST'; end if;
  insert into public.agent_run_events(tenant_id,actor_id,run_id,seq,kind,model_call_id,tool_call_id,skill_run_id,metadata)
    select p_tenant,p_actor,p_run,coalesce(max(seq),0)+1,p_event->>'kind',(p_event->>'modelCallId')::uuid,p_event->>'toolCallId',(p_event->>'skillRunId')::uuid,
      jsonb_strip_nulls(jsonb_build_object('errorCode',p_event->>'errorCode','contextSnapshotId',p_event->>'contextSnapshotId','details',d,'stateVersion',p_version)) from public.agent_run_events where run_id=p_run;
  if p_event->>'kind'='context.resolved' then
    update public.agent_runs set context_metadata=jsonb_build_object('snapshotId',(p_event->>'contextSnapshotId')::uuid) where id=p_run;
  end if;
end $$;

-- Preserve v1 atomic CAS/budget/message implementation. All completion entry points
-- now enforce the generic artifact-bearing profile's persisted guard evidence.
alter function public.transition_agent_run_v1(uuid,uuid,uuid,text,integer,uuid,text,jsonb,text,text) rename to transition_agent_run_base_v1;
alter function public.transition_agent_run_base_v1(uuid,uuid,uuid,text,integer,uuid,text,jsonb,text,text) set schema agent_core_private;
revoke all on function agent_core_private.transition_agent_run_base_v1(uuid,uuid,uuid,text,integer,uuid,text,jsonb,text,text) from public,anon,authenticated,service_role;
create function public.transition_agent_run_v1(p_tenant uuid,p_actor uuid,p_run uuid,p_expected_status text,p_expected_version integer,p_fence uuid,p_to text,p_budget jsonb,p_final text default null,p_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.agent_runs; definition jsonb; evidence jsonb; output jsonb; tool jsonb; result jsonb;
begin
  select * into r from public.agent_runs where id=p_run and tenant_id=p_tenant and actor_id=p_actor for update;
  if not found then raise exception 'RUN_NOT_FOUND'; end if;
  select manifest into definition from public.agent_definition_versions where id=r.definition_id;
  if p_to='completed' and definition ? 'artifacts' then
    select metadata into evidence from public.agent_run_events where run_id=p_run and kind='evidence.checked' order by seq desc limit 1;
    select metadata into output from public.agent_run_events where run_id=p_run and kind='output.checked' order by seq desc limit 1;
    select metadata into tool from public.agent_run_events where run_id=p_run and kind='tool.completed'
      and metadata#>'{details,toolRef}'=definition#>'{artifacts,requiredEvidenceToolRef}' order by seq desc limit 1;
    if evidence#>>'{details,status}' is distinct from 'pass' or (evidence->>'stateVersion')::int is distinct from r.state_version
      or evidence#>>'{details,revision}' is null or evidence#>>'{details,segmentRef}' is null
      or not coalesce((evidence#>'{details,sourceRefs}') @> jsonb_build_array(evidence#>>'{details,segmentRef}'),false)
      or not coalesce(tool#>>'{details,status}' in ('ok','partial'),false)
      or tool#>>'{details,revision}' is distinct from evidence#>>'{details,revision}'
      or tool#>>'{details,segmentRef}' is distinct from evidence#>>'{details,segmentRef}'
    then raise exception 'REQUIRED_EVIDENCE_MISSING'; end if;
    if output#>>'{details,status}' is distinct from 'pass' or (output->>'stateVersion')::int is distinct from r.state_version
      or output->'details' is distinct from evidence->'details' then raise exception 'SKILL_OUTPUT_INVALID'; end if;
  end if;
  result:=agent_core_private.transition_agent_run_base_v1(p_tenant,p_actor,p_run,p_expected_status,p_expected_version,p_fence,p_to,p_budget,p_final,p_reason);
  if p_to='completed' and definition ? 'artifacts' then
    update public.agent_messages set source_refs=output#>'{details,sourceRefs}' where run_id=p_run and role='assistant';
  end if;
  return result;
end $$;
revoke all on function public.append_agent_run_event_v2(uuid,uuid,uuid,integer,uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.transition_agent_run_v1(uuid,uuid,uuid,text,integer,uuid,text,jsonb,text,text) from public,anon,authenticated,service_role;
grant execute on function public.append_agent_run_event_v2(uuid,uuid,uuid,integer,uuid,jsonb) to service_role;
grant execute on function public.transition_agent_run_v1(uuid,uuid,uuid,text,integer,uuid,text,jsonb,text,text) to service_role;
commit;
