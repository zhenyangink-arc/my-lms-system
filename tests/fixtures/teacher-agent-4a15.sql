-- ISOLATED TEST DEPENDENCIES ONLY. Applied to a network-none disposable DB.
-- Agent tables themselves are extracted from the existing migration DDL.
alter table public.digital_textbook_chapters add column title jsonb, add column status text;
alter table public.digital_textbook_modules add column title jsonb, add column description jsonb, add column sort_order integer;
alter table public.digital_textbook_nodes add column sort_order integer, add column title jsonb;
alter table public.digital_textbook_activities add column sort_order integer, add column prompt jsonb, add column options jsonb;
create table public.digital_textbooks(id uuid primary key,status text,agent_profile_id uuid);
create table public.digital_textbook_versions(id uuid primary key,textbook_id uuid,status text);
create table public.digital_textbook_activity_secrets(activity_id uuid primary key,answer_key jsonb,explanation jsonb);
