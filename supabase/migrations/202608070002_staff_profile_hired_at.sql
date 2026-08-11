-- ============================================================
-- 后台成员个人信息：新增入职时间字段
--
-- 后台成员（平台/机构成员）在个人信息页自助维护性别、出生日期与
-- 入职时间。性别、出生日期复用 profiles.gender / birth_date；
-- 入职时间不在原表结构中（机构成员关系 joined_at 只覆盖机构侧且
-- 由系统写入），因此为所有后台账号统一新增 hired_at。
--
-- hired_at 不在 enforce_profile_self_service_fields 的保护字段清单内，
-- 本人可自助更新，符合个人信息自助维护语义。
-- ============================================================

alter table public.profiles
  add column if not exists hired_at date;

comment on column public.profiles.hired_at is
  '入职时间：后台成员人事信息，由成员本人在个人信息页自助维护。';
