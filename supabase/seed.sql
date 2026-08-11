-- PUFFY LMS local-development seed data.
-- Applied by `supabase db reset` after all migrations.
-- Never reuse these credentials outside a disposable local Supabase instance.
--
-- Login ID: local-admin
-- Password: PuffyLocal123!
-- Internal Auth email: local-admin@accounts.puffy.invalid

begin;

-- Keep the seed idempotent when it is applied more than once to a local database.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000'::uuid,
  '10000000-0000-4000-8000-000000000101'::uuid,
  'authenticated',
  'authenticated',
  'local-admin@accounts.puffy.invalid',
  extensions.crypt('PuffyLocal123!', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"本地测试机构管理员","name":"本地测试机构管理员","login_id":"local-admin"}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
)
on conflict (id) do update
set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

insert into auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values (
  '10000000-0000-4000-8000-000000000201'::uuid,
  'local-admin@accounts.puffy.invalid',
  '10000000-0000-4000-8000-000000000101'::uuid,
  jsonb_build_object(
    'sub', '10000000-0000-4000-8000-000000000101',
    'email', 'local-admin@accounts.puffy.invalid',
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now()
)
on conflict (provider_id, provider) do update
set
  user_id = excluded.user_id,
  identity_data = excluded.identity_data,
  updated_at = now();

-- The project baseline owns the auth.users -> public.profiles provisioning
-- trigger. Fail loudly if that prerequisite is absent instead of creating a
-- partial account that appears in Auth but cannot enter the application.
do $$
begin
  if not exists (
    select 1
    from public.profiles
    where id = '10000000-0000-4000-8000-000000000101'::uuid
  ) then
    raise exception 'PUFFY seed prerequisite missing: auth user did not create public.profiles row';
  end if;
end;
$$;

insert into public.tenants (
  id,
  slug,
  name,
  status,
  plan_key,
  settings,
  created_by
)
values (
  '10000000-0000-4000-8000-000000000001'::uuid,
  'local-dev',
  'PUFFY 本地测试机构',
  'active',
  'starter',
  '{}'::jsonb,
  '10000000-0000-4000-8000-000000000101'::uuid
)
on conflict (id) do update
set
  slug = excluded.slug,
  name = excluded.name,
  status = excluded.status,
  plan_key = excluded.plan_key,
  settings = excluded.settings,
  created_by = excluded.created_by,
  updated_at = now();

insert into public.tenant_memberships (
  tenant_id,
  user_id,
  role,
  status,
  membership_tier,
  is_default,
  invited_by,
  joined_at
)
values (
  '10000000-0000-4000-8000-000000000001'::uuid,
  '10000000-0000-4000-8000-000000000101'::uuid,
  'tenant_super_admin',
  'active',
  'normal',
  true,
  '10000000-0000-4000-8000-000000000101'::uuid,
  now()
)
on conflict (tenant_id, user_id) do update
set
  role = excluded.role,
  status = excluded.status,
  membership_tier = excluded.membership_tier,
  is_default = excluded.is_default,
  invited_by = excluded.invited_by,
  joined_at = coalesce(public.tenant_memberships.joined_at, excluded.joined_at),
  updated_at = now();

update public.profiles
set
  email = 'local-admin@accounts.puffy.invalid',
  full_name = '本地测试机构管理员',
  login_id = 'local-admin',
  role = 'tenant_super_admin',
  global_role = 'tenant_super_admin',
  status = 'active',
  membership_tier = 'normal'
where id = '10000000-0000-4000-8000-000000000101'::uuid;

commit;
