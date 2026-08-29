begin;

-- Teacher Kim is the fixed Korean instructor for every teaching-script node.
-- Preserve each node's existing position and voice preferences while forcing
-- the character identity and filling the default position when absent.
update public.learning_agent_script_nodes
set configuration = jsonb_set(
  configuration,
  '{virtualCharacter}',
  jsonb_build_object(
    'kind', 'uply-teacher',
    'position', 'right'
  )
  || coalesce(configuration -> 'virtualCharacter', '{}'::jsonb)
  || jsonb_build_object('kind', 'uply-teacher'),
  true
)
where configuration -> 'virtualCharacter' ->> 'kind' is distinct from 'uply-teacher'
   or configuration -> 'virtualCharacter' ->> 'position' is null;

commit;
