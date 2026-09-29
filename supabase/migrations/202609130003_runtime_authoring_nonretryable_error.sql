-- Permanent publication-policy rejection is not a serialization failure.
-- PostgREST 14 retries 40001; PT409 returns the same refusal without retrying.
-- Preserve the fence predicate, lock ordering, privileges and all stored data.
begin;

create or replace function runtime_publish_private.check_authoring_statement()
returns trigger language plpgsql security definer set search_path='' as $$
declare f runtime_publish_private.dependency_fences%rowtype;
begin
 for f in select d.* from runtime_publish_private.dependency_fences d
  where not exists(select 1 from runtime_publish_private.retired_snapshots r where r.snapshot_id=d.snapshot_id) order by d.snapshot_id loop
  if runtime_publish_private.capture(f.scope) is distinct from runtime_publish_private.semantic_capture(f.capture) then
   raise exception 'PUBLISHED_DEPENDENCY_IMMUTABLE_USE_EDIT_WINDOW' using errcode='PT409';
  end if;
 end loop;
 return null;
end $$;

commit;
