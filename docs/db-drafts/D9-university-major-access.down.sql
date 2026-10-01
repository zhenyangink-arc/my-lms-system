-- D9 回滚：只删除 D9 新增的对象，不影响任何既有表与函数。
begin;
drop function if exists public.set_student_major_enrollment(uuid, uuid, text);
drop function if exists public.set_university_category_access(uuid, text, uuid[]);
drop function if exists public.university_category_scope();
drop table if exists public.student_major_enrollments;
drop table if exists public.university_category_major_links;
drop table if exists public.university_category_access;
drop function if exists private.check_student_major_enrollment();
drop function if exists private.check_university_major_link();
drop function if exists private.clear_links_when_not_shared();
drop function if exists private.check_university_category_access();
drop function if exists private.university_category_mode(uuid);
drop function if exists private.university_second_level_category(uuid);
drop function if exists private.university_app_id();
commit;
