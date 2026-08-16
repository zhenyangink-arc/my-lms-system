begin;

-- PostgreSQL stores table-style ACLs on views as well. They cannot be
-- truncated in practice, but keep the client privilege contract uniform for
-- every relation exposed through PostgREST.
do $$
declare
  target_relation record;
begin
  for target_relation in
    select format('%I.%I', namespace.nspname, relation.relname) as qualified_name
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('v', 'm', 'f')
  loop
    execute format(
      'revoke truncate, references, trigger on table %s from anon, authenticated',
      target_relation.qualified_name
    );
    execute format(
      'revoke insert, update, delete on table %s from anon',
      target_relation.qualified_name
    );
  end loop;
end;
$$;

commit;
