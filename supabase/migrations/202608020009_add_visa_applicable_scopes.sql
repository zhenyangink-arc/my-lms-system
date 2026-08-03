alter table public.university_visa_application_requirements
  add column if not exists applicable_scopes text[] not null default '{}'::text[];

update public.university_visa_application_requirements
set applicable_scopes = case visa_type
  when 'd4_language' then array['language']::text[]
  when 'd2_bachelor' then array['bachelor_fresh', 'bachelor_transfer']::text[]
  when 'd2_master' then array['master']::text[]
  when 'd2_doctor' then array['doctor']::text[]
  else '{}'::text[]
end
where cardinality(applicable_scopes) = 0;

alter table public.university_visa_application_requirements
  drop constraint if exists university_visa_requirements_applicable_scopes_check;

alter table public.university_visa_application_requirements
  add constraint university_visa_requirements_applicable_scopes_check
  check (
    cardinality(applicable_scopes) > 0
    and applicable_scopes <@ array['language', 'bachelor_fresh', 'bachelor_transfer', 'master', 'doctor']::text[]
  );

comment on column public.university_visa_application_requirements.applicable_scopes is
  '适用学习阶段；本科 D-2 可分别标记本科新入和本科插班。';
