-- ============================================================
-- 学生完整个人资料与私有头像存储
-- 原有账号字段全部保留，新字段允许历史账号暂时为空。
-- ============================================================

alter table public.profiles
  add column if not exists gender text,
  add column if not exists birth_date date,
  add column if not exists avatar_path text,
  add column if not exists address_province text,
  add column if not exists address_city text,
  add column if not exists education_level text,
  add column if not exists education_status text,
  add column if not exists education_completion_month date,
  add column if not exists academic_average numeric(5,2),
  add column if not exists gaokao_has_score boolean,
  add column if not exists gaokao_score numeric(6,2),
  add column if not exists english_level text,
  add column if not exists math_level text,
  add column if not exists has_korean boolean,
  add column if not exists topik_level smallint,
  add column if not exists has_work_experience boolean,
  add column if not exists profile_data_version text not null default '2026-07';

-- 重新建立约束，确保管理控制台或接口写入时也遵守相同规则。
alter table public.profiles drop constraint if exists profiles_gender_check;
alter table public.profiles add constraint profiles_gender_check
  check (gender is null or gender in ('male', 'female'));

alter table public.profiles drop constraint if exists profiles_address_pair_check;
alter table public.profiles add constraint profiles_address_pair_check
  check (
    (address_province is null and address_city is null)
    or (nullif(btrim(address_province), '') is not null and nullif(btrim(address_city), '') is not null)
  );

alter table public.profiles drop constraint if exists profiles_education_level_check;
alter table public.profiles add constraint profiles_education_level_check
  check (
    education_level is null
    or education_level in ('bachelor', 'associate', 'high_school', 'secondary_vocational', 'technical_school')
  );

alter table public.profiles drop constraint if exists profiles_education_status_check;
alter table public.profiles add constraint profiles_education_status_check
  check (education_status is null or education_status in ('graduated', 'studying'));

alter table public.profiles drop constraint if exists profiles_education_completion_check;
alter table public.profiles add constraint profiles_education_completion_check
  check (
    (education_level is null and education_status is null and education_completion_month is null)
    or (
      education_level is not null
      and education_status is not null
      and education_completion_month is not null
      and extract(day from education_completion_month) = 1
    )
  );

alter table public.profiles drop constraint if exists profiles_academic_average_check;
alter table public.profiles add constraint profiles_academic_average_check
  check (academic_average is null or academic_average between 0 and 100);

alter table public.profiles drop constraint if exists profiles_gaokao_score_check;
alter table public.profiles add constraint profiles_gaokao_score_check
  check (
    gaokao_has_score is null
    or (gaokao_has_score = false and gaokao_score is null)
    or (gaokao_has_score = true and gaokao_score between 0 and 750)
  );

alter table public.profiles drop constraint if exists profiles_english_level_check;
alter table public.profiles add constraint profiles_english_level_check
  check (english_level is null or english_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));

alter table public.profiles drop constraint if exists profiles_math_level_check;
alter table public.profiles add constraint profiles_math_level_check
  check (math_level is null or math_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));

alter table public.profiles drop constraint if exists profiles_topik_level_check;
alter table public.profiles add constraint profiles_topik_level_check
  check (
    has_korean is null
    or (has_korean = false and topik_level is null)
    or (has_korean = true and topik_level between 1 and 6)
  );

-- 顾问常按教育阶段筛选学生档案，增加小型组合索引。
create index if not exists profiles_education_stage_idx
  on public.profiles (education_level, education_status);

-- 建立私有头像桶，限制为常见图片格式且单张不超过 2MB。
insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'profile-photos',
  'profile-photos',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 用户只能管理自己 UUID 文件夹中的头像。
drop policy if exists "users read own profile photos" on storage.objects;
create policy "users read own profile photos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users upload own profile photos" on storage.objects;
create policy "users upload own profile photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users update own profile photos" on storage.objects;
create policy "users update own profile photos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users delete own profile photos" on storage.objects;
create policy "users delete own profile photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

comment on column public.profiles.education_completion_month is '毕业月份或预计毕业月份，统一保存为当月第一天';
comment on column public.profiles.academic_average is '当前教育阶段的百分制平均成绩';
comment on column public.profiles.gaokao_score is '高中、中专或技工学校学生的高考成绩，可为空表示无成绩';
comment on column public.profiles.avatar_path is '私有 profile-photos 存储桶中的头像对象路径';
