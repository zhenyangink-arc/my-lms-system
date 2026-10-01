-- D8 回滚：删除 replace_math_paper_draft。不影响已保存的试卷。
begin;
drop function if exists public.replace_math_paper_draft(uuid, text, text, integer, numeric, boolean, jsonb);
commit;
