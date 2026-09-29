-- Stage 1D. Not applied to production/shared development by this build.
begin;
alter table public.agent_runs add column cancel_requested_at timestamptz, add column public_event_seq bigint not null default 0;

create function agent_core_private.student_transport_guard(p_tenant uuid,p_actor uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.tenant_memberships m on m.user_id=p.id
 join public.tenants t on t.id=m.tenant_id where p.id=p_actor and p.status='active'
 and m.tenant_id=p_tenant and m.status='active' and m.role='student' and t.status='active');
$$;
revoke all on function agent_core_private.student_transport_guard(uuid,uuid) from public,anon,authenticated,service_role;

create function public.get_student_agent_run_status_v1(p_tenant uuid,p_actor uuid,p_run uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.agent_runs; a public.agent_messages; d jsonb;
begin
 if not agent_core_private.student_transport_guard(p_tenant,p_actor) then return null; end if;
 select * into r from public.agent_runs where id=p_run and tenant_id=p_tenant and actor_id=p_actor and agent_code='student-ai-teacher';
 if not found then return null; end if;
 if r.status='completed' then
   select * into a from public.agent_messages where run_id=r.id and role='assistant' and state='final';
   select metadata->'details' into d from public.agent_run_events where run_id=r.id and kind='output.checked' order by seq desc limit 1;
   if a.id is null or d->>'completeness' not in ('complete','partial') then raise exception 'PERSISTENCE_FAILED'; end if;
 end if;
 return jsonb_strip_nulls(jsonb_build_object('protocolVersion',1,'runId',r.id,'conversationId',r.conversation_id,
 'status',r.status,'createdAt',r.created_at,'endedAt',r.ended_at,'finalAnswer',a.content,
 'sourceRefs',a.source_refs,'completeness',d->>'completeness','failureCode',case when r.status='failed' then r.terminal_reason end));
end $$;

create function public.request_agent_run_cancel_v1(p_tenant uuid,p_actor uuid,p_run uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.agent_runs;
begin
 if not agent_core_private.student_transport_guard(p_tenant,p_actor) then return null; end if;
 select * into r from public.agent_runs where id=p_run and tenant_id=p_tenant and actor_id=p_actor and agent_code='student-ai-teacher' for update;
 if not found then return null; end if;
 if r.status in ('completed','failed','cancelled') then return jsonb_build_object('result','already_terminal'); end if;
 -- Metadata only: do not consume the active worker's version/fence or terminal CAS.
 update public.agent_runs set cancel_requested_at=coalesce(cancel_requested_at,clock_timestamp()) where id=r.id;
 return jsonb_build_object('result','accepted');
end $$;

create function public.check_agent_run_cancel_v1(p_tenant uuid,p_actor uuid,p_run uuid,p_fence uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.agent_runs;
begin
 select * into r from public.agent_runs where id=p_run and tenant_id=p_tenant and actor_id=p_actor and fencing_token=p_fence;
 if not found then raise exception 'RUN_NOT_FOUND'; end if;
 return r.cancel_requested_at is not null;
end $$;

-- Keep the 1C evidence gate and original atomic CAS implementation intact.
alter function public.transition_agent_run_v1(uuid,uuid,uuid,text,integer,uuid,text,jsonb,text,text) rename to transition_agent_run_evidence_v1;
alter function public.transition_agent_run_evidence_v1(uuid,uuid,uuid,text,integer,uuid,text,jsonb,text,text) set schema agent_core_private;
revoke all on function agent_core_private.transition_agent_run_evidence_v1(uuid,uuid,uuid,text,integer,uuid,text,jsonb,text,text) from public,anon,authenticated,service_role;
create function public.transition_agent_run_v1(p_tenant uuid,p_actor uuid,p_run uuid,p_expected_status text,p_expected_version integer,p_fence uuid,p_to text,p_budget jsonb,p_final text default null,p_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.agent_runs;
begin
 select * into r from public.agent_runs where id=p_run and tenant_id=p_tenant and actor_id=p_actor for update;
 if not found then raise exception 'RUN_NOT_FOUND'; end if;
 if r.status in ('completed','failed','cancelled') or r.state_version is distinct from p_expected_version or r.fencing_token is distinct from p_fence
 or r.status is distinct from p_expected_status then raise exception 'PERSISTENCE_FAILED'; end if;
 if r.cancel_requested_at is not null and p_to not in ('failed','cancelled') then raise exception 'RUN_CANCELLED'; end if;
 return agent_core_private.transition_agent_run_evidence_v1(p_tenant,p_actor,p_run,p_expected_status,p_expected_version,p_fence,p_to,p_budget,p_final,p_reason);
end $$;
revoke all on function public.get_student_agent_run_status_v1(uuid,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.request_agent_run_cancel_v1(uuid,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.check_agent_run_cancel_v1(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.transition_agent_run_v1(uuid,uuid,uuid,text,integer,uuid,text,jsonb,text,text) from public,anon,authenticated,service_role;
grant execute on function public.get_student_agent_run_status_v1(uuid,uuid,uuid) to service_role;
grant execute on function public.request_agent_run_cancel_v1(uuid,uuid,uuid) to service_role;
grant execute on function public.check_agent_run_cancel_v1(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.transition_agent_run_v1(uuid,uuid,uuid,text,integer,uuid,text,jsonb,text,text) to service_role;
-- Disjoint bounded sequence blocks prevent duplicate seq on idempotent POST replay.
create function public.reserve_student_agent_event_sequence_v1(p_tenant uuid,p_actor uuid,p_run uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare base bigint;
begin
 if not agent_core_private.student_transport_guard(p_tenant,p_actor) then raise exception 'RUN_NOT_FOUND'; end if;
 update public.agent_runs set public_event_seq=public_event_seq+128 where id=p_run and tenant_id=p_tenant and actor_id=p_actor
 and agent_code='student-ai-teacher' and public_event_seq < 9007199254740000 returning public_event_seq-128 into base;
 if not found then raise exception 'RUN_NOT_FOUND'; end if;
 return base;
end $$;
revoke all on function public.reserve_student_agent_event_sequence_v1(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.reserve_student_agent_event_sequence_v1(uuid,uuid,uuid) to service_role;
commit;
