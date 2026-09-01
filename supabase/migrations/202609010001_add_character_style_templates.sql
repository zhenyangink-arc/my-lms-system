begin;

create table public.learning_agent_character_style_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  virtual_character_position text not null check (virtual_character_position in ('left', 'right')),
  character_x numeric not null check (character_x between 10 and 90),
  character_y numeric not null check (character_y between 0 and 80),
  character_scale numeric not null check (character_scale between 0.75 and 1.25),
  dialogue_x numeric not null check (dialogue_x between 5 and 95),
  dialogue_y numeric not null check (dialogue_y between 5 and 90),
  blackboard_x numeric not null check (blackboard_x between 10 and 90),
  blackboard_y numeric not null check (blackboard_y between 0 and 70),
  blackboard_scale numeric not null check (blackboard_scale between 0.75 and 1.5),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index learning_agent_character_style_templates_created_idx
  on public.learning_agent_character_style_templates(created_at desc);

drop trigger if exists learning_agent_character_style_templates_set_updated_at on public.learning_agent_character_style_templates;
create trigger learning_agent_character_style_templates_set_updated_at
before update on public.learning_agent_character_style_templates
for each row execute function private.set_updated_at();

alter table public.learning_agent_character_style_templates enable row level security;

create policy "platform owner manages character style templates"
on public.learning_agent_character_style_templates for all to authenticated
using ((select private.is_platform_owner()))
with check ((select private.is_platform_owner()));

grant select on public.learning_agent_character_style_templates to authenticated;
grant all on public.learning_agent_character_style_templates to service_role;

commit;
