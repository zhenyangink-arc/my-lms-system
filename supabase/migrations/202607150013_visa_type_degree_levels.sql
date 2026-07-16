-- ============================================================
-- 签证类型改为业务实际经办的四种：语言研修、本科、硕士、博士
-- 旧的"暂未确定/学历课程/求职/其他类型"不再作为可选项。
-- 历史记录里这四类之外的旧值，先统一归到语言研修签证，
-- 顾问需要在账号里核对并手动更正真实的签证类型。
-- ============================================================

update public.student_visa_cases
set visa_type = 'd4_language'
where visa_type not in ('d4_language', 'd2_bachelor', 'd2_master', 'd2_doctor');

alter table public.student_visa_cases
  drop constraint if exists student_visa_cases_visa_type_check;

alter table public.student_visa_cases
  alter column visa_type set default 'd4_language';

alter table public.student_visa_cases
  add constraint student_visa_cases_visa_type_check
  check (visa_type in ('d4_language', 'd2_bachelor', 'd2_master', 'd2_doctor'));

comment on column public.student_visa_cases.visa_type is
  '签证类型：d4_language 语言研修签证，d2_bachelor 本科签证，d2_master 硕士签证，d2_doctor 博士签证';
