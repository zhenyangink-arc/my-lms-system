-- Synthetic schema dependencies only. Never a production migration.
-- Exercise the historical default-public pgcrypto install, not just a clean
-- extensions install. The v2 migration must not relocate an existing extension.
create extension pgcrypto;
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role', true)$$;
grant usage on schema auth to service_role, authenticated, anon;
create table auth.users(id uuid primary key);
create table public.tenants(id uuid primary key);
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[],updated_at timestamptz);
create table storage.objects(bucket_id text,name text,metadata jsonb,primary key(bucket_id,name));
create table public.digital_textbook_chapters(id uuid primary key,version_id uuid not null);
create table public.digital_textbook_modules(id uuid primary key,chapter_id uuid references public.digital_textbook_chapters);
create table public.digital_textbook_nodes(id uuid primary key,module_id uuid references public.digital_textbook_modules,content jsonb not null default '{}');
create table public.digital_textbook_activities(id uuid primary key,node_id uuid references public.digital_textbook_nodes,
  activity_type text,max_attempts int,counts_toward_completion boolean,public_config jsonb default '{}');
create table public.digital_textbook_attempts(tenant_id uuid,student_id uuid,activity_id uuid,version_id uuid,
  attempt_number int,response jsonb,is_correct boolean,score numeric,meets_completion_requirements boolean,
  unique(tenant_id,student_id,activity_id,attempt_number));
create table public.digital_textbook_node_progress(tenant_id uuid,student_id uuid,node_id uuid,version_id uuid,
  status text,completion_percent int,mastery_score int,attempt_count int,last_activity_at timestamptz,updated_at timestamptz,
  primary key(tenant_id,student_id,node_id,version_id));
grant usage on schema public,storage to service_role;
grant all on all tables in schema public,storage to service_role;
