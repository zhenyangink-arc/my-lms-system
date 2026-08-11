-- Baseline recovered from the production schema by read-only catalog queries
-- on 2026-08-11. This migration must remain safe on databases where the
-- profiles table and Auth provisioning trigger already exist.

begin;

create table if not exists public.profiles (
  id uuid not null,
  full_name text,
  role text not null default 'student'::text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'active'::text,
  deactivated_at timestamptz,
  deactivated_by uuid,
  deactivate_reason text,
  email text,
  registered_at timestamptz,
  registration_source text not null default 'email'::text,
  last_active_at timestamptz,
  profile_completed_at timestamptz,
  gender text,
  birth_date date,
  avatar_path text,
  address_province text,
  address_city text,
  education_level text,
  education_status text,
  education_completion_month date,
  academic_average numeric,
  gaokao_has_score boolean,
  gaokao_score numeric,
  english_level text,
  math_level text,
  has_korean boolean,
  topik_level smallint,
  has_work_experience boolean,
  profile_data_version text not null default '2026-07'::text,
  membership_tier text not null default 'normal'::text,
  membership_updated_at timestamptz,
  membership_updated_by uuid,
  login_id text,
  global_role text not null default 'member'::text
);

-- CREATE TABLE IF NOT EXISTS does not repair a partially-created historical
-- table. Add every catalog-confirmed column idempotently before constraints.
alter table public.profiles
  add column if not exists id uuid,
  add column if not exists full_name text,
  add column if not exists role text not null default 'student'::text,
  add column if not exists avatar_url text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists status text not null default 'active'::text,
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivated_by uuid,
  add column if not exists deactivate_reason text,
  add column if not exists email text,
  add column if not exists registered_at timestamptz,
  add column if not exists registration_source text not null default 'email'::text,
  add column if not exists last_active_at timestamptz,
  add column if not exists profile_completed_at timestamptz,
  add column if not exists gender text,
  add column if not exists birth_date date,
  add column if not exists avatar_path text,
  add column if not exists address_province text,
  add column if not exists address_city text,
  add column if not exists education_level text,
  add column if not exists education_status text,
  add column if not exists education_completion_month date,
  add column if not exists academic_average numeric,
  add column if not exists gaokao_has_score boolean,
  add column if not exists gaokao_score numeric,
  add column if not exists english_level text,
  add column if not exists math_level text,
  add column if not exists has_korean boolean,
  add column if not exists topik_level smallint,
  add column if not exists has_work_experience boolean,
  add column if not exists profile_data_version text not null default '2026-07'::text,
  add column if not exists membership_tier text not null default 'normal'::text,
  add column if not exists membership_updated_at timestamptz,
  add column if not exists membership_updated_by uuid,
  add column if not exists login_id text,
  add column if not exists global_role text not null default 'member'::text;

-- Add the production constraints only when their names are absent. Existing
-- definitions are deliberately left untouched so applying this baseline to
-- production is a no-op rather than an implicit schema rewrite.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_pkey') then
    alter table public.profiles add constraint profiles_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_id_fkey') then
    alter table public.profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_deactivated_by_fkey') then
    alter table public.profiles add constraint profiles_deactivated_by_fkey foreign key (deactivated_by) references public.profiles(id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_membership_updated_by_fkey') then
    alter table public.profiles add constraint profiles_membership_updated_by_fkey foreign key (membership_updated_by) references auth.users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_academic_average_check') then
    alter table public.profiles add constraint profiles_academic_average_check check (academic_average is null or academic_average >= 0::numeric and academic_average <= 100::numeric);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_address_pair_check') then
    alter table public.profiles add constraint profiles_address_pair_check check (address_province is null and address_city is null or nullif(btrim(address_province), ''::text) is not null and nullif(btrim(address_city), ''::text) is not null);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_education_completion_check') then
    alter table public.profiles add constraint profiles_education_completion_check check (education_level is null and education_status is null and education_completion_month is null or education_level is not null and education_status is not null and education_completion_month is not null);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_education_level_check') then
    alter table public.profiles add constraint profiles_education_level_check check (education_level is null or education_level = any (array['bachelor'::text, 'associate'::text, 'high_school'::text, 'secondary_vocational'::text, 'technical_school'::text]));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_education_status_check') then
    alter table public.profiles add constraint profiles_education_status_check check (education_status is null or education_status = any (array['graduated'::text, 'studying'::text]));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_english_level_check') then
    alter table public.profiles add constraint profiles_english_level_check check (english_level is null or english_level = any (array['A1'::text, 'A2'::text, 'B1'::text, 'B2'::text, 'C1'::text, 'C2'::text]));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_gaokao_score_check') then
    alter table public.profiles add constraint profiles_gaokao_score_check check (gaokao_has_score is null or gaokao_has_score = false and gaokao_score is null or gaokao_has_score = true and gaokao_score >= 0::numeric and gaokao_score <= 750::numeric);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_gender_check') then
    alter table public.profiles add constraint profiles_gender_check check (gender is null or gender = any (array['male'::text, 'female'::text]));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_global_role_check') then
    alter table public.profiles add constraint profiles_global_role_check check (global_role = any (array['platform_owner'::text, 'platform_deputy'::text, 'platform_admin'::text, 'platform_course_inspector'::text, 'tenant_super_admin'::text, 'member'::text]));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_login_id_check') then
    alter table public.profiles add constraint profiles_login_id_check check (login_id is null or login_id = lower(login_id) and login_id ~ '^[a-z0-9][a-z0-9_-]{2,31}$'::text);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_math_level_check') then
    alter table public.profiles add constraint profiles_math_level_check check (math_level is null or math_level = any (array['A1'::text, 'A2'::text, 'B1'::text, 'B2'::text, 'C1'::text, 'C2'::text]));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_membership_tier_check') then
    alter table public.profiles add constraint profiles_membership_tier_check check (membership_tier = any (array['normal'::text, 'vip1'::text, 'vip2'::text, 'vip3'::text]));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_role_check') then
    alter table public.profiles add constraint profiles_role_check check (role = any (array['student'::text, 'teacher'::text, 'admin'::text, 'ceo'::text, 'platform_super_admin'::text, 'platform_course_inspector'::text, 'tenant_super_admin'::text, 'tenant_operator'::text]));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_role_global_consistency_check') then
    alter table public.profiles add constraint profiles_role_global_consistency_check check (role = 'platform_super_admin'::text and global_role = 'platform_owner'::text or role = 'tenant_operator'::text and global_role = 'platform_deputy'::text or role = 'admin'::text and global_role = 'platform_admin'::text or role = 'platform_course_inspector'::text and global_role = 'platform_course_inspector'::text or role = 'tenant_super_admin'::text and global_role = 'tenant_super_admin'::text or role = any (array['student'::text, 'teacher'::text, 'admin'::text, 'ceo'::text]) and global_role = 'member'::text);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_status_check') then
    alter table public.profiles add constraint profiles_status_check check (status = any (array['active'::text, 'inactive'::text, 'suspended'::text]));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_topik_level_check') then
    alter table public.profiles add constraint profiles_topik_level_check check (has_korean is null or has_korean = false and topik_level is null or has_korean = true and topik_level >= 1 and topik_level <= 6);
  end if;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name'),
    'student'
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and tgname = 'on_auth_user_created'
      and not tgisinternal
  ) then
    create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
  end if;
end;
$$;

alter table public.profiles enable row level security;

-- The four production policies depend on objects introduced by later
-- migrations (tenant_memberships and private/public permission helpers).
-- On an empty database this block intentionally defers them; migration
-- 202607210002 and its follow-ups create and evolve the same four policies.
-- On an existing environment where all dependencies exist, any missing policy
-- is restored with the production-catalog definition below.
do $$
begin
  if to_regclass('public.tenant_memberships') is not null
     and to_regprocedure('private.current_tenant_id()') is not null
     and to_regprocedure('private.is_platform_owner()') is not null
     and to_regprocedure('public.is_executive_account()') is not null
     and to_regprocedure('public.is_owner_account()') is not null then

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'Users can view own profile') then
      create policy "Users can view own profile"
      on public.profiles for select to authenticated
      using (((select auth.uid()) = id) or (select private.is_platform_owner()));
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'Users can update own profile') then
      create policy "Users can update own profile"
      on public.profiles for update to authenticated
      using (((select auth.uid()) = id) or (select private.is_platform_owner()))
      with check (((select auth.uid()) = id) or (select private.is_platform_owner()));
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'Executives read profiles of their tenant members') then
      create policy "Executives read profiles of their tenant members"
      on public.profiles for select to authenticated
      using (
        ((select public.is_executive_account()) and exists (
          select 1
          from public.tenant_memberships as membership
          where membership.user_id = profiles.id
            and membership.tenant_id = (select private.current_tenant_id())
        ))
        or (select private.is_platform_owner())
      );
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'Executives manage subordinate tenant member profiles') then
      create policy "Executives manage subordinate tenant member profiles"
      on public.profiles for update to authenticated
      using (
        (
          exists (
            select 1
            from public.tenant_memberships as membership
            where membership.user_id = profiles.id
              and membership.tenant_id = (select private.current_tenant_id())
          )
          and role <> 'tenant_operator'::text
          and (
            (select public.is_owner_account())
            or ((select public.is_executive_account()) and role <> all (array['tenant_super_admin'::text, 'ceo'::text]))
          )
        )
        or (select private.is_platform_owner())
      )
      with check (
        (
          exists (
            select 1
            from public.tenant_memberships as membership
            where membership.user_id = profiles.id
              and membership.tenant_id = (select private.current_tenant_id())
          )
          and role <> 'tenant_operator'::text
          and (
            (select public.is_owner_account())
            or ((select public.is_executive_account()) and role <> all (array['tenant_super_admin'::text, 'ceo'::text]))
          )
        )
        or (select private.is_platform_owner())
      );
    end if;
  end if;
end;
$$;

commit;
