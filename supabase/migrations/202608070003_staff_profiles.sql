-- ============================================================
-- 后台成员个人信息：独立存储（与学生档案字段分离）
--
-- 学生端个人资料（gender / birth_date 等）是学生档案字段，
-- 后台成员的人事信息不应写入其中。这里新建 staff_profiles 表，
-- 专门存放后台成员（平台/机构成员）的个人信息：
--   gender、birth_date、hired_at
-- 姓名与头像仍使用 profiles 的通用身份字段（full_name / avatar_path），
-- 这两个字段是所有账号共用的展示身份，不属于学生档案语义。
--
-- 同时收回之前临时加到 profiles 的 hired_at 列（尚未产生业务数据），
-- 确保学生档案表不混入后台人事字段。
-- ============================================================

begin;

create table public.staff_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  gender text,
  birth_date date,
  hired_at date,
  updated_at timestamptz not null default now(),
  constraint staff_profiles_gender_check check (gender in ('male', 'female'))
);

comment on table public.staff_profiles is
  '后台成员个人信息（平台/机构成员），与学生档案字段分离存储。';
comment on column public.staff_profiles.gender is '性别：male / female，可空表示不透露';
comment on column public.staff_profiles.birth_date is '出生日期';
comment on column public.staff_profiles.hired_at is '入职时间';

-- 后台成员只能读写自己的行。
alter table public.staff_profiles enable row level security;

create policy "users manage own staff profile"
on public.staff_profiles for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- 收回误加在 profiles 上的 hired_at（无业务数据，安全移除）。
alter table public.profiles drop column if exists hired_at;

commit;
