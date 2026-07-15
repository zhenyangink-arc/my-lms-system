-- ============================================================
-- 个人资料毕业日期精确到日
-- 页面使用 2020.06.01 格式输入，数据库继续使用 date 类型可靠存储。
-- ============================================================

-- 旧约束只允许每月第一天；新需求需要保存真实毕业日期或预计毕业日期。
alter table public.profiles drop constraint if exists profiles_education_completion_check;
alter table public.profiles add constraint profiles_education_completion_check
  check (
    (education_level is null and education_status is null and education_completion_month is null)
    or (
      education_level is not null
      and education_status is not null
      and education_completion_month is not null
    )
  );

comment on column public.profiles.education_completion_month is
  '毕业日期或预计毕业日期；页面以 YYYY.MM.DD 输入，数据库以 date 类型保存';
