begin;

create table public.learning_agent_blackboard_layout_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  background text not null check (background in ('plain', 'warm', 'grid')),
  elements jsonb not null check (jsonb_typeof(elements) = 'array' and jsonb_array_length(elements) between 1 and 12),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index learning_agent_blackboard_layout_templates_created_idx
  on public.learning_agent_blackboard_layout_templates(created_at desc);

drop trigger if exists learning_agent_blackboard_layout_templates_set_updated_at on public.learning_agent_blackboard_layout_templates;
create trigger learning_agent_blackboard_layout_templates_set_updated_at
before update on public.learning_agent_blackboard_layout_templates
for each row execute function private.set_updated_at();

alter table public.learning_agent_blackboard_layout_templates enable row level security;

create policy "platform owner manages blackboard layout templates"
on public.learning_agent_blackboard_layout_templates for all to authenticated
using ((select private.is_platform_owner()))
with check ((select private.is_platform_owner()));

grant select on public.learning_agent_blackboard_layout_templates to authenticated;
grant all on public.learning_agent_blackboard_layout_templates to service_role;

commit;
