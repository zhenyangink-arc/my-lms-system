-- Forward-only. Install only together with the coordinated application release.
-- No existing evidence, attempts, objects, or legacy RPCs are modified.
begin;
create table recording_private.domain_control (
  singleton boolean primary key default true check (singleton),
  epoch bigint not null check (epoch > 0),
  state text not null check (state in ('open','draining','fenced')),
  enabled boolean not null default false,
  cohort jsonb not null default '[]' check (jsonb_typeof(cohort) = 'array')
);
insert into recording_private.domain_control values (true,1,'fenced',false,'[]');
create table recording_private.domain_instances (
  id text primary key check (length(id) between 1 and 128),
  acknowledged_epoch bigint not null check (acknowledged_epoch > 0)
);
create table recording_private.domain_requests (
  id uuid primary key,
  instance_id text not null references recording_private.domain_instances,
  epoch bigint not null,
  tenant_id uuid not null references public.tenants,
  student_id uuid not null references auth.users,
  domain text not null check (domain in ('v1','v2')),
  uploading_evidence_id uuid unique,
  started_at timestamptz not null default clock_timestamp()
);
-- No timeout reaper: an uncertain/crashed external upload must block cutover.
-- Operators may release a crash lease only after proving the old process and
-- all its external I/O are terminated. No application RPC force-releases it.
alter table recording_private.domain_control enable row level security;
alter table recording_private.domain_instances enable row level security;
alter table recording_private.domain_requests enable row level security;
revoke all on recording_private.domain_control, recording_private.domain_instances,
  recording_private.domain_requests from public,anon,authenticated,service_role;

create function public.recording_domain_request_v1(
  p_operation text,p_request_id uuid,p_instance_id text,p_epoch bigint,
  p_tenant_id uuid,p_student_id uuid,p_domain text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare c recording_private.domain_control%rowtype;
  r recording_private.domain_requests%rowtype; actual_domain text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'RECORDING_FORBIDDEN'; end if;
  -- All admission/check/release/control operations take this same lock first.
  select * into strict c from recording_private.domain_control where singleton for update;
  if p_operation = 'release' then
    delete from recording_private.domain_requests where id=p_request_id and instance_id=p_instance_id
      and epoch=p_epoch and tenant_id=p_tenant_id and student_id=p_student_id and domain=p_domain
      and uploading_evidence_id is null;
    if not found then raise exception 'RECORDING_LEASE_MISMATCH'; end if;
    return jsonb_build_object('released',true);
  end if;
  actual_domain := case when c.enabled and c.cohort @> jsonb_build_array(jsonb_build_object(
    'tenantId',p_tenant_id::text,'studentId',p_student_id::text)) then 'v2' else 'v1' end;
  if p_epoch is distinct from c.epoch or p_domain is distinct from actual_domain
    or not exists(select 1 from recording_private.domain_instances where id=p_instance_id and acknowledged_epoch=c.epoch)
    then raise exception 'RECORDING_EPOCH_MISMATCH'; end if;
  if p_operation = 'enter' then
    if c.state <> 'open' then raise exception 'RECORDING_DRAINING'; end if;
    -- Rollback is deliberately conservative across this learner's whole domain.
    if p_domain='v1' and exists(select 1 from public.digital_textbook_speaking_evidence e
      where e.tenant_id=p_tenant_id and e.student_id=p_student_id and
        (e.metadata ? 'runtimeBinding' or e.metadata ? 'lifecycle'))
      then raise exception 'RECORDING_ROLLBACK_FENCED'; end if;
    insert into recording_private.domain_requests(id,instance_id,epoch,tenant_id,student_id,domain)
      values(p_request_id,p_instance_id,p_epoch,p_tenant_id,p_student_id,p_domain);
  elsif p_operation = 'check' then
    select * into r from recording_private.domain_requests where id=p_request_id;
    if not found or r.instance_id is distinct from p_instance_id or r.epoch is distinct from p_epoch
      or r.tenant_id is distinct from p_tenant_id or r.student_id is distinct from p_student_id
      or r.domain is distinct from p_domain or c.state='fenced'
      then raise exception 'RECORDING_LEASE_MISMATCH'; end if;
    -- Already admitted requests may finish while draining; switch is prohibited
    -- until their leases (including cleanup/retries) have all been released.
  else raise exception 'RECORDING_OPERATION_INVALID'; end if;
  return jsonb_build_object('epoch',c.epoch,'domain',actual_domain,'requestId',p_request_id);
end $$;
revoke all on function public.recording_domain_request_v1(text,uuid,text,bigint,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.recording_domain_request_v1(text,uuid,text,bigint,uuid,uuid,text) to service_role;

-- Protect an unpublished upload identity from parallel replacement/consumption.
-- Reservation must precede INSERT; an existing identity can never be reserved
-- again. Thus a successful settled check cannot race a later PUT for that ID.
create function public.recording_domain_upload_v1(
  p_operation text,p_request_id uuid,p_instance_id text,p_epoch bigint,
  p_tenant_id uuid,p_student_id uuid,p_domain text,p_evidence_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform public.recording_domain_request_v1('check',p_request_id,p_instance_id,p_epoch,p_tenant_id,p_student_id,p_domain);
  if p_domain <> 'v2' or p_evidence_id is null then raise exception 'RECORDING_OPERATION_INVALID'; end if;
  if p_operation='reserve' then
    if exists(select 1 from public.digital_textbook_speaking_evidence where id=p_evidence_id)
      then raise exception 'RECORDING_UPLOAD_ID_CONFLICT'; end if;
    update recording_private.domain_requests set uploading_evidence_id=p_evidence_id
      where id=p_request_id and uploading_evidence_id is null;
    if not found then raise exception 'RECORDING_UPLOAD_CONFLICT'; end if;
  elsif p_operation='settle' then
    update recording_private.domain_requests set uploading_evidence_id=null
      where id=p_request_id and uploading_evidence_id=p_evidence_id;
    if not found then raise exception 'RECORDING_UPLOAD_CONFLICT'; end if;
  elsif p_operation='assert-settled' then
    if exists(select 1 from recording_private.domain_requests where uploading_evidence_id=p_evidence_id)
      then raise exception 'RECORDING_UPLOAD_PENDING'; end if;
  else raise exception 'RECORDING_OPERATION_INVALID'; end if;
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.recording_domain_upload_v1(text,uuid,text,bigint,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.recording_domain_upload_v1(text,uuid,text,bigint,uuid,uuid,text,uuid) to service_role;

-- Operator-only control. Intentionally NOT granted to service_role; no web API.
create function recording_private.transition_domain(p_operation text,p_epoch bigint,
  p_enabled boolean default false,p_cohort jsonb default '[]') returns void
language plpgsql security definer set search_path='' as $$
declare c recording_private.domain_control%rowtype; entry jsonb;
begin
  select * into strict c from recording_private.domain_control where singleton for update;
  if p_operation='drain' and c.state='open' and p_epoch=c.epoch then
    update recording_private.domain_control set state='draining';
  elsif p_operation='fence' and c.state='draining' and p_epoch=c.epoch then
    if exists(select 1 from recording_private.domain_requests) then raise exception 'RECORDING_NOT_DRAINED'; end if;
    update recording_private.domain_control set state='fenced';
  elsif p_operation='switch' and c.state='fenced' and p_epoch=c.epoch+1 then
    if exists(select 1 from recording_private.domain_requests) then raise exception 'RECORDING_NOT_DRAINED'; end if;
    if not exists(select 1 from recording_private.domain_instances) or exists(
      select 1 from recording_private.domain_instances where acknowledged_epoch<>p_epoch)
      then raise exception 'RECORDING_INSTANCES_NOT_ACKNOWLEDGED'; end if;
    if p_enabled is null or jsonb_typeof(p_cohort) is distinct from 'array' then raise exception 'RECORDING_COHORT_INVALID'; end if;
    for entry in select value from jsonb_array_elements(p_cohort) loop
      if jsonb_typeof(entry) <> 'object' or (select count(*) from jsonb_object_keys(entry))<>2
        or not(entry ?& array['tenantId','studentId']) then raise exception 'RECORDING_COHORT_INVALID'; end if;
      perform (entry->>'tenantId')::uuid,(entry->>'studentId')::uuid;
      if entry->>'tenantId' is null or entry->>'studentId' is null then raise exception 'RECORDING_COHORT_INVALID'; end if;
    end loop;
    if (select count(*) from jsonb_array_elements(p_cohort)) <> (select count(distinct value) from jsonb_array_elements(p_cohort))
      then raise exception 'RECORDING_COHORT_INVALID'; end if;
    update recording_private.domain_control set epoch=p_epoch,enabled=p_enabled,cohort=p_cohort;
  elsif p_operation='open' and c.state='fenced' and p_epoch=c.epoch then
    if not exists(select 1 from recording_private.domain_instances) or exists(select 1 from recording_private.domain_instances where acknowledged_epoch<>p_epoch)
      then raise exception 'RECORDING_INSTANCES_NOT_ACKNOWLEDGED'; end if;
    update recording_private.domain_control set state='open';
  else raise exception 'RECORDING_TRANSITION_INVALID'; end if;
end $$;
revoke all on function recording_private.transition_domain(text,bigint,boolean,jsonb) from public,anon,authenticated,service_role;
commit;
