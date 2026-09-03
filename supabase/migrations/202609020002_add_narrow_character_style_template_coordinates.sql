begin;

alter table public.learning_agent_character_style_templates
  add column if not exists narrow_character_x numeric not null default 90
    check (narrow_character_x between 10 and 90),
  add column if not exists narrow_character_y numeric not null default 6
    check (narrow_character_y between 0 and 80);

commit;
