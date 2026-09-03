begin;

alter table public.learning_agent_character_style_templates
  add column if not exists narrow_character_scale numeric not null default 0.6
    check (narrow_character_scale between 0.5 and 1.25);

commit;
