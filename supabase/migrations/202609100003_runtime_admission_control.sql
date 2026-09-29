-- Isolated Phase 4B-1B only. Does not enable Runtime or Recording.
begin;
create table runtime_publish_private.admission_control (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 revision bigint not null default 1 check(revision>0),
 cohort jsonb not null default '[]' check(jsonb_typeof(cohort)='array')
);
insert into runtime_publish_private.admission_control values(true,false,1,'[]');
alter table runtime_publish_private.admission_control enable row level security;
revoke all on runtime_publish_private.admission_control from public,anon,authenticated,service_role;
-- Operator control plane only; no browser-facing toggle. Monotonic revisions
-- invalidate an admission which overlapped any policy change, including ABA.
create function runtime_publish_private.admission_revision() returns trigger
 language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'ADMISSION_CONTROL_REQUIRED';end if;
 if exists(select 1 from jsonb_array_elements(new.cohort) c where jsonb_typeof(c)<>'object'
   or (select count(*) from jsonb_object_keys(c))<>2 or not(c?'tenantId' and c?'studentId')
   or (c->>'tenantId')!~'^[0-9a-f-]{36}$' or (c->>'studentId')!~'^[0-9a-f-]{36}$') then
  raise exception 'ADMISSION_COHORT_INVALID';end if;
 new.revision=old.revision+1;return new;
end$$;
create trigger admission_revision before update or delete on runtime_publish_private.admission_control
 for each row execute function runtime_publish_private.admission_revision();
create function public.runtime_admission_state_v1(p_tenant uuid,p_student uuid) returns jsonb
 language sql stable security definer set search_path='' as $$
 select jsonb_build_object('eligible',enabled and cohort @> jsonb_build_array(jsonb_build_object('tenantId',p_tenant,'studentId',p_student)),
 'revision',revision) from runtime_publish_private.admission_control where singleton;
$$;
-- Read-only prerequisite proof. This is NOT an evidence proof or permission to
-- bypass the coordinator lease. A fresh server HMAC confirms the app key matches
-- an enabled DB key without returning either secret. No evidence/attempt writes.
create function public.runtime_recording_dependency_v1(p_tenant uuid,p_student uuid,p_epoch bigint,p_instance text,
 p_key text,p_nonce uuid,p_time bigint,p_mac text) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare k bytea; message text; valid boolean; signature text; fn regprocedure;
begin
 if abs(extract(epoch from clock_timestamp())::bigint-p_time)>30 then raise exception 'ADMISSION_KEY_EXPIRED';end if;
 select secret into k from recording_private.proof_keys where id=p_key and enabled;
 message='runtime-admission/1|'||p_tenant||'|'||p_student||'|'||p_epoch||'|'||p_instance||'|'||p_key||'|'||p_nonce||'|'||p_time;
 if k is null or encode(recording_private.mac(convert_to(message,'UTF8'),k),'hex') is distinct from p_mac then
  raise exception 'ADMISSION_KEY_MISMATCH';end if;
 select exists(select 1 from recording_private.domain_control c where c.singleton and c.state='open'
  and c.enabled and c.epoch=p_epoch and c.cohort @> jsonb_build_array(jsonb_build_object('tenantId',p_tenant,'studentId',p_student))
  and exists(select 1 from recording_private.domain_instances where id=p_instance and acknowledged_epoch=p_epoch)) into valid;
 if not valid then raise exception 'ADMISSION_RECORDING_FENCED';end if;
 foreach signature in array array[
  'public.record_smart_textbook_speaking_attempt_v2(uuid,uuid,uuid,uuid,jsonb,uuid,jsonb,jsonb)',
  'public.complete_smart_textbook_roleplay_v2(uuid,uuid,uuid,uuid,text,text,jsonb,jsonb)',
  'public.claim_smart_textbook_recording_delete_v2(uuid,uuid,uuid,uuid,uuid,jsonb)',
  'public.finalize_smart_textbook_recording_delete_v2(uuid,uuid,uuid,uuid,uuid,jsonb)',
  'public.recording_domain_request_v1(text,uuid,text,bigint,uuid,uuid,text)',
  'public.recording_domain_upload_v1(text,uuid,text,bigint,uuid,uuid,text,uuid)'
 ] loop
  fn=to_regprocedure(signature);
  if fn is null or not has_function_privilege('service_role',fn,'EXECUTE') then raise exception 'ADMISSION_RECORDING_RPC_MISSING';end if;
 end loop;
 return jsonb_build_object('ready',true,'epoch',p_epoch);
end$$;
revoke all on function runtime_publish_private.admission_revision() from public,anon,authenticated,service_role;
revoke all on function public.runtime_admission_state_v1(uuid,uuid) from public,anon,authenticated;
revoke all on function public.runtime_recording_dependency_v1(uuid,uuid,bigint,text,text,uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.runtime_admission_state_v1(uuid,uuid) to service_role;
grant execute on function public.runtime_recording_dependency_v1(uuid,uuid,bigint,text,text,uuid,bigint,text) to service_role;
commit;
