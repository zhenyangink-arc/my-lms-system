begin;

alter table public.learning_agent_character_style_templates
  add column if not exists split_character_x numeric not null default 68
    check (split_character_x between 10 and 90),
  add column if not exists split_character_y numeric not null default 0
    check (split_character_y between 0 and 80),
  add column if not exists split_character_scale numeric not null default 0.82
    check (split_character_scale between 0.5 and 1.25),
  add column if not exists split_dialogue_x numeric not null default 78
    check (split_dialogue_x between 5 and 95),
  add column if not exists split_dialogue_y numeric not null default 30
    check (split_dialogue_y between 5 and 90);

commit;
