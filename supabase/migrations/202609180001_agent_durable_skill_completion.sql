-- R7D-C34b. Versioned Agent evidence policy; isolated validation only.
-- No publication DDL, new authority/store or historical artifact reinterpretation.
begin;
create function agent_core_private.validate_artifact_v2(m jsonb) returns void language plpgsql set search_path='' as $$
declare a jsonb:=m->'artifacts';k text;v jsonb;req jsonb;
begin
 if a->'schemaVersion' is distinct from '2'::jsonb
  or (a-'schemaVersion'-'definitionDigest'-'personaRef'-'privateInstructionsRef'-'skillDigest'-'toolsDigest'-'completionPolicyRef'-'requiredEvidence')<>'{}'::jsonb
  or jsonb_typeof(a->'requiredEvidence') is distinct from 'array' then raise exception 'INVALID_REQUEST';end if;
 if jsonb_array_length(a->'requiredEvidence') not between 1 and 8 then raise exception 'INVALID_REQUEST';end if;
 foreach k in array array['definitionDigest','skillDigest','toolsDigest'] loop
  if not coalesce(a->>k ~ '^[a-f0-9]{64}$',false) then raise exception 'INVALID_REQUEST';end if;
 end loop;
 foreach k in array array['personaRef','privateInstructionsRef','completionPolicyRef'] loop
  v:=a->k;
  if jsonb_typeof(v) is distinct from 'object' or (v-'name'-'version')<>'{}'::jsonb or not coalesce(length(v->>'name') between 1 and 100,false) or not coalesce(length(v->>'version') between 1 and 100,false) then raise exception 'INVALID_REQUEST';end if;
 end loop;
 if (select count(distinct value) from jsonb_array_elements(a->'requiredEvidence'))<>jsonb_array_length(a->'requiredEvidence') then raise exception 'INVALID_REQUEST';end if;
 for req in select value from jsonb_array_elements(a->'requiredEvidence') loop
  if jsonb_typeof(req) is distinct from 'object' or (req-'kind'-'toolRef')<>'{}'::jsonb
   or not coalesce(m->'allowedToolRefs' @> jsonb_build_array(req->'toolRef'),false) then raise exception 'INVALID_REQUEST';end if;
  if req->>'kind'='durable_execution_facts' then
   if req->'toolRef' is distinct from '{"name":"get_current_lesson_execution_facts","version":"1.1.0"}'::jsonb then raise exception 'INVALID_REQUEST';end if;
  elsif req->>'kind'='lesson_context' then
   if req->'toolRef' is distinct from '{"name":"get_current_lesson_context","version":"1.0.0"}'::jsonb then raise exception 'INVALID_REQUEST';end if;
  else raise exception 'INVALID_REQUEST';end if;
 end loop;
end $$;
create function agent_core_private.validate_typed_evidence(e jsonb) returns void language plpgsql set search_path='' as $$
declare k text;v jsonb;rest jsonb;
begin
 if jsonb_typeof(e) is distinct from 'object' then raise exception 'INVALID_REQUEST';end if;
 rest:=e-'kind'-'toolRef'-'skillRef'-'runId'-'skillRunId'-'modelCallId'-'toolCallId'-'subjectRef'-'tenantRef'-'scopeRef'-'lessonRef'-'versionRef'-'contentBinding'-'revision'-'asOf'-'readStartedAt'-'deadlineAt';
 foreach k in array array['subjectRef','tenantRef','scopeRef','lessonRef','versionRef','contentBinding','revision'] loop
  if not coalesce(e->>k ~ '^ta1:[a-z_]+:[a-f0-9]{64}$',false) then raise exception 'INVALID_REQUEST';end if;
 end loop;
 foreach k in array array['runId','skillRunId','modelCallId'] loop if e->>k is null then raise exception 'INVALID_REQUEST';end if;perform (e->>k)::uuid;end loop;
 foreach k in array array['asOf','readStartedAt','deadlineAt'] loop if e->>k is null then raise exception 'INVALID_REQUEST';end if;perform (e->>k)::timestamptz;end loop;
 if not coalesce(length(e->>'toolCallId') between 1 and 200,false) then raise exception 'INVALID_REQUEST';end if;
 foreach k in array array['toolRef','skillRef'] loop
  v:=e->k;if jsonb_typeof(v) is distinct from 'object' or (v-'name'-'version')<>'{}'::jsonb or not coalesce(length(v->>'name') between 1 and 100,false) or not coalesce(length(v->>'version') between 1 and 100,false) then raise exception 'INVALID_REQUEST';end if;
 end loop;
 if e->>'kind'='durable_execution_facts' then
  if (rest-'facts'-'activityRef'-'snapshotRef'-'receiptRef'-'executionNodeRef'-'sourceTeachingNodeRef'-'storage'-'receiptContract')<>'{}'::jsonb
   or e->>'storage' is distinct from 'CURRENT_PUBLISHED_DB' or e->>'receiptContract' is distinct from 'activity-completion/3'
   or e->'toolRef' is distinct from '{"name":"get_current_lesson_execution_facts","version":"1.1.0"}'::jsonb
   then raise exception 'REQUIRED_EVIDENCE_MISSING';end if;
  foreach k in array array['activityRef','snapshotRef','receiptRef','executionNodeRef','sourceTeachingNodeRef'] loop
   if not coalesce(e->>k ~ '^ta1:[a-z_]+:[a-f0-9]{64}$',false) then raise exception 'INVALID_REQUEST';end if;
  end loop;
  v:=e->'facts';
  if jsonb_typeof(v) is distinct from 'object' or (v-'completionStatus'-'attemptCount'-'latestResult'-'nodeProgress'-'currentTeachingNode'-'currentPositionAvailability')<>'{}'::jsonb
   or not coalesce(v->>'completionStatus' in ('COMPLETED','INCOMPLETE'),false)
   or not coalesce(v->>'latestResult' in ('CORRECT','INCORRECT','UNKNOWN'),false)
   or v->'currentTeachingNode' is distinct from 'null'::jsonb
   or v->>'currentPositionAvailability' is distinct from 'unavailable'
   or jsonb_typeof(v->'attemptCount') is distinct from 'number'
   or not coalesce((v->>'attemptCount')::numeric between 0 and 20,false)
   or trunc((v->>'attemptCount')::numeric)<>(v->>'attemptCount')::numeric
   or not (v ? 'nodeProgress') then raise exception 'INVALID_REQUEST';end if;
  if v->'nodeProgress'<>'null'::jsonb then
   v:=v->'nodeProgress';
   if jsonb_typeof(v) is distinct from 'object' or (v-'status'-'completionPercent'-'masteryScore'-'attemptCount')<>'{}'::jsonb
    or not coalesce(v->>'status' in ('not_started','in_progress','completed'),false)
    or jsonb_typeof(v->'attemptCount') is distinct from 'number'
    or not coalesce((v->>'attemptCount')::numeric between 0 and 10000,false)
    or trunc((v->>'attemptCount')::numeric)<>(v->>'attemptCount')::numeric then raise exception 'INVALID_REQUEST';end if;
   foreach k in array array['completionPercent','masteryScore'] loop
    if jsonb_typeof(v->k) is distinct from 'number' or not coalesce((v->>k)::numeric between 0 and 100,false) then raise exception 'INVALID_REQUEST';end if;
   end loop;
  end if;
  if not coalesce(e->>'activityRef' ~ '^ta1:activity:[a-f0-9]{64}$',false) then raise exception 'REQUIRED_EVIDENCE_MISSING';end if;
 elsif e->>'kind'='lesson_context' then
  if (rest-'segmentRef'-'sourceRefs')<>'{}'::jsonb or not coalesce(e->>'segmentRef' ~ '^ta1:segment:[a-f0-9]{64}$',false)
   or jsonb_typeof(e->'sourceRefs') is distinct from 'array' or not coalesce(e->'sourceRefs' @> jsonb_build_array(e->>'segmentRef'),false)
   or e->'toolRef' is distinct from '{"name":"get_current_lesson_context","version":"1.0.0"}'::jsonb
   then raise exception 'REQUIRED_EVIDENCE_MISSING';end if;
  if jsonb_array_length(e->'sourceRefs') not between 1 and 3 then raise exception 'INVALID_REQUEST';end if;
  for v in select value from jsonb_array_elements(e->'sourceRefs') loop if not coalesce(v#>>'{}' ~ '^ta1:[a-z_]+:[a-f0-9]{64}$',false) then raise exception 'INVALID_REQUEST';end if;end loop;
 else raise exception 'INVALID_REQUEST';end if;
end $$;
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
  if new.manifest->'allowedSkillRefs' @> '[{"name":"summarize-current-lesson-execution","version":"1.1.0"}]'::jsonb then
    if a->'schemaVersion' is distinct from '2'::jsonb
     or a->'completionPolicyRef' is distinct from '{"name":"student-execution-summary","version":"1.1.0"}'::jsonb
     or not coalesce(a->'requiredEvidence' @> '[{"kind":"durable_execution_facts","toolRef":{"name":"get_current_lesson_execution_facts","version":"1.1.0"}}]'::jsonb,false)
     then raise exception 'REQUIRED_EVIDENCE_MISSING';end if;
  end if;
  if new.manifest#>'{artifacts,schemaVersion}'='2'::jsonb then
    perform agent_core_private.validate_artifact_v2(new.manifest);
  else
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
  end if;
  return new;
end $$;
create or replace function public.append_agent_run_event_v2(p_tenant uuid,p_actor uuid,p_run uuid,p_version integer,p_fence uuid,p_event jsonb)
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
    or (d-'definitionDigest'-'authorityDigest'-'promptDigest'-'profileRef'-'skillRef'-'toolRef'-'promptVersion'-'contextVersion'-'policyVersion'-'modelConfigVersion'-'stage'-'status'-'revision'-'segmentRef'-'sourceRefs'-'completeness'-'asOf'-'byteEstimate'-'sections'-'evidenceSet'-'outputDigest')<>'{}'::jsonb
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
  if d ? 'outputDigest' and not coalesce(d->>'outputDigest' ~ '^[a-f0-9]{64}$',false) then raise exception 'INVALID_REQUEST';end if;
  if d ? 'evidenceSet' then
    if jsonb_typeof(d->'evidenceSet') is distinct from 'array' or jsonb_array_length(d->'evidenceSet') not between 1 and 8 then raise exception 'INVALID_REQUEST';end if;
    for v in select value from jsonb_array_elements(d->'evidenceSet') loop perform agent_core_private.validate_typed_evidence(v);end loop;
  end if;
  insert into public.agent_run_events(tenant_id,actor_id,run_id,seq,kind,model_call_id,tool_call_id,skill_run_id,metadata)
    select p_tenant,p_actor,p_run,coalesce(max(seq),0)+1,p_event->>'kind',(p_event->>'modelCallId')::uuid,p_event->>'toolCallId',(p_event->>'skillRunId')::uuid,
      case when d ? 'evidenceSet' then jsonb_strip_nulls(jsonb_build_object('errorCode',p_event->>'errorCode','contextSnapshotId',p_event->>'contextSnapshotId','stateVersion',p_version)) || jsonb_build_object('details',d) else jsonb_strip_nulls(jsonb_build_object('errorCode',p_event->>'errorCode','contextSnapshotId',p_event->>'contextSnapshotId','details',d,'stateVersion',p_version)) end from public.agent_run_events where run_id=p_run;
  if p_event->>'kind'='context.resolved' then
    update public.agent_runs set context_metadata=jsonb_build_object('snapshotId',(p_event->>'contextSnapshotId')::uuid) where id=p_run;
  end if;
end $$;
create or replace function agent_core_private.transition_agent_run_evidence_v1(p_tenant uuid,p_actor uuid,p_run uuid,p_expected_status text,p_expected_version integer,p_fence uuid,p_to text,p_budget jsonb,p_final text default null,p_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.agent_runs; definition jsonb; evidence jsonb; output jsonb; tool jsonb; result jsonb; requirement jsonb; item jsonb; tool_event public.agent_run_events; evidence_event public.agent_run_events; output_event public.agent_run_events; requirements jsonb; safe_refs jsonb;
begin
  select * into r from public.agent_runs where id=p_run and tenant_id=p_tenant and actor_id=p_actor for update;
  if not found then raise exception 'RUN_NOT_FOUND'; end if;
  select manifest into definition from public.agent_definition_versions where id=r.definition_id;
  if p_to='completed' and definition#>'{artifacts,schemaVersion}'='2'::jsonb then
    requirements:=definition#>'{artifacts,requiredEvidence}';
    perform agent_core_private.validate_artifact_v2(definition);
    select * into evidence_event from public.agent_run_events where run_id=p_run and kind='evidence.checked' order by seq desc limit 1;
    select * into output_event from public.agent_run_events where run_id=p_run and kind='output.checked' order by seq desc limit 1;
    evidence:=evidence_event.metadata;output:=output_event.metadata;
    if evidence#>>'{details,status}' is distinct from 'pass'
     or (evidence->>'stateVersion')::int is distinct from r.state_version
     or jsonb_typeof(evidence#>'{details,evidenceSet}') is distinct from 'array'
     or jsonb_array_length(evidence#>'{details,evidenceSet}') is distinct from jsonb_array_length(requirements)
     then raise exception 'REQUIRED_EVIDENCE_MISSING';end if;
    safe_refs:='[]'::jsonb;
    for requirement in select value from jsonb_array_elements(requirements) loop
      if (select count(*) from jsonb_array_elements(evidence#>'{details,evidenceSet}') e where e->>'kind'=requirement->>'kind' and e->'toolRef'=requirement->'toolRef')<>1 then raise exception 'REQUIRED_EVIDENCE_MISSING';end if;
      select value into item from jsonb_array_elements(evidence#>'{details,evidenceSet}') where value->>'kind'=requirement->>'kind' and value->'toolRef'=requirement->'toolRef';
      perform agent_core_private.validate_typed_evidence(item);
      select * into tool_event from public.agent_run_events where run_id=p_run and kind='tool.completed'
       and metadata#>'{details,toolRef}'=requirement->'toolRef' order by seq desc limit 1;
      if item->>'runId' is distinct from p_run::text or item->'skillRef' is distinct from r.skill_ref
       or item->>'skillRunId' is distinct from tool_event.skill_run_id::text
       or item->>'skillRunId' is distinct from evidence_event.skill_run_id::text
       or item->>'modelCallId' is distinct from tool_event.model_call_id::text
       or item->>'toolCallId' is distinct from tool_event.tool_call_id
       or item->>'subjectRef' is distinct from 'ta1:subject:'||encode(sha256(convert_to(to_jsonb(p_actor::text)::text,'UTF8')),'hex')
       or item->>'tenantRef' is distinct from 'ta1:tenant:'||encode(sha256(convert_to(to_jsonb(p_tenant::text)::text,'UTF8')),'hex')
       or item->>'scopeRef' is distinct from r.scope_ref
       or (item->>'deadlineAt')::timestamptz is distinct from r.deadline_at
       or (item->>'readStartedAt')::timestamptz < r.created_at
       or (item->>'asOf')::timestamptz < (item->>'readStartedAt')::timestamptz
       or (item->>'asOf')::timestamptz > clock_timestamp()
       or (item->>'asOf')::timestamptz < clock_timestamp()-interval '30 seconds'
       or (item->>'deadlineAt')::timestamptz<=clock_timestamp()
       or not coalesce(tool_event.metadata#>>'{details,status}' in ('ok','partial'),false)
       or not coalesce(tool_event.metadata#>'{details,evidenceSet}' @> jsonb_build_array(item),false)
       or tool_event.seq>=evidence_event.seq
       then raise exception 'REQUIRED_EVIDENCE_MISSING';end if;
      if item->>'kind'='durable_execution_facts' then
       if p_final::jsonb->'contract' is distinct from definition#>'{artifacts,completionPolicyRef}'
        or not coalesce(p_final::jsonb @> (item->'facts'),false)
        or p_final::jsonb->>'activityRef' is distinct from item->>'activityRef'
        or p_final::jsonb->>'revision' is distinct from item->>'revision'
        then raise exception 'SKILL_OUTPUT_INVALID';end if;
      end if;
      -- A later failed request/completion invalidates an older successful receipt.
      if exists(select 1 from public.agent_run_events e where e.run_id=p_run and e.kind in ('tool.requested','tool.completed') and e.seq>tool_event.seq and e.metadata#>'{details,toolRef}'=requirement->'toolRef') then raise exception 'REQUIRED_EVIDENCE_MISSING';end if;
      safe_refs:=safe_refs||case when item->>'kind'='durable_execution_facts' then jsonb_build_array(item->>'activityRef') else item->'sourceRefs' end;
    end loop;
    if output#>>'{details,status}' is distinct from 'pass' or (output->>'stateVersion')::int is distinct from r.state_version
      or output_event.skill_run_id is distinct from evidence_event.skill_run_id
      or output_event.seq<=evidence_event.seq
      or ((output->'details')-'outputDigest') is distinct from evidence->'details'
      or output#>'{details,sourceRefs}' is distinct from safe_refs
      or output#>>'{details,outputDigest}' is distinct from encode(sha256(convert_to(p_final,'UTF8')),'hex')
      then raise exception 'SKILL_OUTPUT_INVALID';end if;
  else
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
  end if;
  result:=agent_core_private.transition_agent_run_base_v1(p_tenant,p_actor,p_run,p_expected_status,p_expected_version,p_fence,p_to,p_budget,p_final,p_reason);
  if p_to='completed' and definition ? 'artifacts' then
    update public.agent_messages set source_refs=output#>'{details,sourceRefs}' where run_id=p_run and role='assistant';
  end if;
  return result;
end $$;
-- Preserve public cancellation wrapper and private base CAS/fencing identities.
revoke all on function agent_core_private.validate_artifact_v2(jsonb) from public,anon,authenticated,service_role;
revoke all on function agent_core_private.validate_typed_evidence(jsonb) from public,anon,authenticated,service_role;
revoke all on function agent_core_private.transition_agent_run_evidence_v1(uuid,uuid,uuid,text,integer,uuid,text,jsonb,text,text) from public,anon,authenticated,service_role;
commit;
