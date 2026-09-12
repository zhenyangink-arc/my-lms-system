-- Phase 4B-1A: isolated-only until a separate production authorization.
-- New migration; old storage migration and old teaching/grading RPCs unchanged.
begin;
create table runtime_publish_private.dependency_fences (
 snapshot_id text primary key references runtime_publish_private.snapshots(id),
 scope jsonb not null, capture jsonb not null check(jsonb_typeof(capture)='object')
);
alter table runtime_publish_private.dependency_fences enable row level security;
revoke all on runtime_publish_private.dependency_fences from public,anon,authenticated,service_role;
create trigger immutable_dependency_fence before update or delete on runtime_publish_private.dependency_fences
 for each row execute function runtime_publish_private.immutable();

-- A SINGLE SQL statement / MVCC snapshot captures all content and grading
-- secrets, including absent child rows. No user/progress/permission data is fixed.
create function runtime_publish_private.capture(p_scope jsonb) returns jsonb
 language sql stable security definer set search_path='' as $capture$
 with digital_textbooks as materialized (select t.* from public.digital_textbooks t where t.id=(p_scope->>'textbookId')::uuid),
 digital_textbook_versions as materialized (select v.* from public.digital_textbook_versions v where v.id=(p_scope->>'versionId')::uuid and v.textbook_id=(p_scope->>'textbookId')::uuid),
 digital_textbook_chapters as materialized (select c.* from public.digital_textbook_chapters c where c.id=(p_scope->>'chapterId')::uuid and c.version_id=(p_scope->>'versionId')::uuid),
 digital_textbook_modules as materialized (select m.* from public.digital_textbook_modules m where m.chapter_id in(select id from digital_textbook_chapters)),
 digital_textbook_nodes as materialized (select n.* from public.digital_textbook_nodes n where n.module_id in(select id from digital_textbook_modules)),
 digital_textbook_activities as materialized (select a.* from public.digital_textbook_activities a where a.node_id in(select id from digital_textbook_nodes)),
 digital_textbook_activity_secrets as materialized (select s.* from public.digital_textbook_activity_secrets s where s.activity_id in(select id from digital_textbook_activities)),
 digital_textbook_media_assets as materialized (select m.* from public.digital_textbook_media_assets m where m.node_id in(select id from digital_textbook_nodes)),
 digital_textbook_listening_tracks as materialized (select t.* from public.digital_textbook_listening_tracks t where t.activity_id in(select id from digital_textbook_activities)),
 learning_agent_lessons as materialized (select l.* from public.learning_agent_lessons l where l.module_id in(select id from digital_textbook_modules)),
 learning_agent_profiles as materialized (select p.* from public.learning_agent_profiles p where p.id in(select agent_profile_id from learning_agent_lessons)),
 learning_agent_profile_secrets as materialized (select p.* from public.learning_agent_profile_secrets p where p.agent_profile_id in(select id from learning_agent_profiles)),
 learning_agent_script_versions as materialized (select v.* from public.learning_agent_script_versions v where v.lesson_id in(select id from learning_agent_lessons) and v.status='published'),
 learning_agent_script_nodes as materialized (select n.* from public.learning_agent_script_nodes n where n.script_version_id in(select id from learning_agent_script_versions)),
 learning_agent_node_interaction_secrets as materialized (select s.* from public.learning_agent_node_interaction_secrets s where s.node_id in(select id from learning_agent_script_nodes)),
 learning_agent_script_audio_assets as materialized (select a.* from public.learning_agent_script_audio_assets a where a.script_node_id in(select id from learning_agent_script_nodes)),
 chapter_tests as materialized (select t.* from public.chapter_tests t where t.id in(select chapter_test_id from digital_textbook_chapters))
 select jsonb_build_object('digital_textbooks',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from digital_textbooks r),
 'digital_textbook_versions',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from digital_textbook_versions r),
 'digital_textbook_chapters',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from digital_textbook_chapters r),
 'digital_textbook_modules',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from digital_textbook_modules r),
 'digital_textbook_nodes',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from digital_textbook_nodes r),
 'digital_textbook_activities',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from digital_textbook_activities r),
 'digital_textbook_activity_secrets',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from digital_textbook_activity_secrets r),
 'digital_textbook_media_assets',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from digital_textbook_media_assets r),
 'digital_textbook_listening_tracks',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from digital_textbook_listening_tracks r),
 'learning_agent_lessons',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from learning_agent_lessons r),
 'learning_agent_profiles',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from learning_agent_profiles r),
 'learning_agent_profile_secrets',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from learning_agent_profile_secrets r),
 'learning_agent_script_versions',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from learning_agent_script_versions r),
 'learning_agent_script_nodes',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from learning_agent_script_nodes r),
 'learning_agent_node_interaction_secrets',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from learning_agent_node_interaction_secrets r),
 'learning_agent_script_audio_assets',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from learning_agent_script_audio_assets r),
 'chapter_tests',(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from chapter_tests r));
$capture$;

create function public.capture_runtime_publication_v1(p_actor uuid,p_scope jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
begin
 perform runtime_publish_private.owner_guard(p_actor);
 return runtime_publish_private.capture(p_scope);
end $$;

-- Common lock ordering: authoring fence -> publication scope -> pointer.
-- Reject non-READ-COMMITTED writers: their old MVCC snapshot could miss a newly
-- installed fence after waiting. A rollback is explicit, before any learner write.
create function runtime_publish_private.authoring_lock() returns void
 language plpgsql security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation') <> 'read committed' then
  raise exception 'PUBLICATION_AUTHORING_ISOLATION_REQUIRED' using errcode='40001';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(4171, 2);
end $$;
create function runtime_publish_private.lock_authoring_statement() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 -- TRUNCATE takes AccessExclusiveLock before statement triggers; never wait
 -- for the authoring advisory lock while holding that conflicting table lock.
 if tg_op='TRUNCATE' then raise exception 'PUBLICATION_DEPENDENCY_TRUNCATE_FORBIDDEN'; end if;
 perform runtime_publish_private.authoring_lock();return null;
end $$;
create function runtime_publish_private.check_authoring_statement() returns trigger
 language plpgsql security definer set search_path='' as $$
declare f runtime_publish_private.dependency_fences%rowtype;
begin
 -- VOLATILE trigger queries get a fresh READ COMMITTED snapshot after the lock.
 -- AFTER statement sees our own writes; failure rolls back the whole statement.
 for f in select * from runtime_publish_private.dependency_fences order by snapshot_id loop
  if runtime_publish_private.capture(f.scope) is distinct from f.capture then
   raise exception 'PUBLISHED_DEPENDENCY_IMMUTABLE_USE_NEW_VERSION' using errcode='40001';
  end if;
 end loop;
 return null;
end $$;
create trigger runtime_publish_lock before insert or update or delete or truncate on public.digital_textbooks
 for each statement execute function runtime_publish_private.lock_authoring_statement();
create trigger runtime_publish_fence after insert or update or delete or truncate on public.digital_textbooks
 for each statement execute function runtime_publish_private.check_authoring_statement();
create trigger runtime_publish_lock before insert or update or delete or truncate on public.digital_textbook_versions
 for each statement execute function runtime_publish_private.lock_authoring_statement();
create trigger runtime_publish_fence after insert or update or delete or truncate on public.digital_textbook_versions
 for each statement execute function runtime_publish_private.check_authoring_statement();
create trigger runtime_publish_lock before insert or update or delete or truncate on public.digital_textbook_chapters
 for each statement execute function runtime_publish_private.lock_authoring_statement();
create trigger runtime_publish_fence after insert or update or delete or truncate on public.digital_textbook_chapters
 for each statement execute function runtime_publish_private.check_authoring_statement();
create trigger runtime_publish_lock before insert or update or delete or truncate on public.digital_textbook_modules
 for each statement execute function runtime_publish_private.lock_authoring_statement();
create trigger runtime_publish_fence after insert or update or delete or truncate on public.digital_textbook_modules
 for each statement execute function runtime_publish_private.check_authoring_statement();
create trigger runtime_publish_lock before insert or update or delete or truncate on public.digital_textbook_nodes
 for each statement execute function runtime_publish_private.lock_authoring_statement();
create trigger runtime_publish_fence after insert or update or delete or truncate on public.digital_textbook_nodes
 for each statement execute function runtime_publish_private.check_authoring_statement();
create trigger runtime_publish_lock before insert or update or delete or truncate on public.digital_textbook_activities
 for each statement execute function runtime_publish_private.lock_authoring_statement();
create trigger runtime_publish_fence after insert or update or delete or truncate on public.digital_textbook_activities
 for each statement execute function runtime_publish_private.check_authoring_statement();
create trigger runtime_publish_lock before insert or update or delete or truncate on public.digital_textbook_activity_secrets
 for each statement execute function runtime_publish_private.lock_authoring_statement();
create trigger runtime_publish_fence after insert or update or delete or truncate on public.digital_textbook_activity_secrets
 for each statement execute function runtime_publish_private.check_authoring_statement();
create trigger runtime_publish_lock before insert or update or delete or truncate on public.digital_textbook_media_assets
 for each statement execute function runtime_publish_private.lock_authoring_statement();
create trigger runtime_publish_fence after insert or update or delete or truncate on public.digital_textbook_media_assets
 for each statement execute function runtime_publish_private.check_authoring_statement();
create trigger runtime_publish_lock before insert or update or delete or truncate on public.digital_textbook_listening_tracks
 for each statement execute function runtime_publish_private.lock_authoring_statement();
create trigger runtime_publish_fence after insert or update or delete or truncate on public.digital_textbook_listening_tracks
 for each statement execute function runtime_publish_private.check_authoring_statement();
create trigger runtime_publish_lock before insert or update or delete or truncate on public.learning_agent_lessons
 for each statement execute function runtime_publish_private.lock_authoring_statement();
create trigger runtime_publish_fence after insert or update or delete or truncate on public.learning_agent_lessons
 for each statement execute function runtime_publish_private.check_authoring_statement();
create trigger runtime_publish_lock before insert or update or delete or truncate on public.learning_agent_profiles
 for each statement execute function runtime_publish_private.lock_authoring_statement();
create trigger runtime_publish_fence after insert or update or delete or truncate on public.learning_agent_profiles
 for each statement execute function runtime_publish_private.check_authoring_statement();
create trigger runtime_publish_lock before insert or update or delete or truncate on public.learning_agent_profile_secrets
 for each statement execute function runtime_publish_private.lock_authoring_statement();
create trigger runtime_publish_fence after insert or update or delete or truncate on public.learning_agent_profile_secrets
 for each statement execute function runtime_publish_private.check_authoring_statement();
create trigger runtime_publish_lock before insert or update or delete or truncate on public.learning_agent_script_versions
 for each statement execute function runtime_publish_private.lock_authoring_statement();
create trigger runtime_publish_fence after insert or update or delete or truncate on public.learning_agent_script_versions
 for each statement execute function runtime_publish_private.check_authoring_statement();
create trigger runtime_publish_lock before insert or update or delete or truncate on public.learning_agent_script_nodes
 for each statement execute function runtime_publish_private.lock_authoring_statement();
create trigger runtime_publish_fence after insert or update or delete or truncate on public.learning_agent_script_nodes
 for each statement execute function runtime_publish_private.check_authoring_statement();
create trigger runtime_publish_lock before insert or update or delete or truncate on public.learning_agent_node_interaction_secrets
 for each statement execute function runtime_publish_private.lock_authoring_statement();
create trigger runtime_publish_fence after insert or update or delete or truncate on public.learning_agent_node_interaction_secrets
 for each statement execute function runtime_publish_private.check_authoring_statement();
create trigger runtime_publish_lock before insert or update or delete or truncate on public.learning_agent_script_audio_assets
 for each statement execute function runtime_publish_private.lock_authoring_statement();
create trigger runtime_publish_fence after insert or update or delete or truncate on public.learning_agent_script_audio_assets
 for each statement execute function runtime_publish_private.check_authoring_statement();
create trigger runtime_publish_lock before insert or update or delete or truncate on public.chapter_tests
 for each statement execute function runtime_publish_private.lock_authoring_statement();
create trigger runtime_publish_fence after insert or update or delete or truncate on public.chapter_tests
 for each statement execute function runtime_publish_private.check_authoring_statement();

create function public.publish_runtime_snapshot_v2(p_actor uuid,p_scope jsonb,p_expected jsonb,p_operation text,p_bundle jsonb,p_target text)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; captured jsonb;
begin
 perform runtime_publish_private.owner_guard(p_actor);
 perform runtime_publish_private.authoring_lock();
 if p_operation='publish' then
  captured:=runtime_publish_private.capture(p_scope);
  if p_bundle#>'{privatePayload,dependencies}' is distinct from captured then
   raise exception 'PUBLICATION_SOURCE_CAPTURE_CONFLICT' using errcode='40001';
  end if;
  if jsonb_array_length(captured->'digital_textbook_activity_secrets') <> jsonb_array_length(captured->'digital_textbook_activities') then
   raise exception 'PUBLICATION_GRADER_DEPENDENCY_MISSING';
  end if;
 else
  if not exists(select 1 from runtime_publish_private.dependency_fences where snapshot_id=p_target) then
   raise exception 'PUBLICATION_UNFENCED_ROLLBACK';
  end if;
 end if;
 result:=public.publish_runtime_snapshot_v1(p_actor,p_scope,p_expected,p_operation,p_bundle,p_target);
 if p_operation='publish' then
  insert into runtime_publish_private.dependency_fences values(p_bundle->>'snapshotId',p_scope,captured)
   on conflict(snapshot_id) do nothing;
 end if;
 return result;
end $$;
-- Old immutable artifacts are NOT silently upgraded. Only fenced publications
-- may execute live legacy domain services. Pointer rollback retains every fence.
create function public.assert_runtime_dependency_fence_v1(p_snapshot text,p_capture jsonb) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from runtime_publish_private.dependency_fences
 where snapshot_id=p_snapshot and capture=p_capture);
$$;
revoke all on all functions in schema runtime_publish_private from public,anon,authenticated,service_role;
revoke execute on function public.publish_runtime_snapshot_v1(uuid,jsonb,jsonb,text,jsonb,text) from service_role;
revoke all on function public.capture_runtime_publication_v1(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.publish_runtime_snapshot_v2(uuid,jsonb,jsonb,text,jsonb,text) from public,anon,authenticated;
revoke all on function public.assert_runtime_dependency_fence_v1(text,jsonb) from public,anon,authenticated;
grant execute on function public.capture_runtime_publication_v1(uuid,jsonb) to service_role;
grant execute on function public.publish_runtime_snapshot_v2(uuid,jsonb,jsonb,text,jsonb,text) to service_role;
grant execute on function public.assert_runtime_dependency_fence_v1(text,jsonb) to service_role;
commit;
