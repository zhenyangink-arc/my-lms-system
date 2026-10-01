-- D8：整体替换数学试卷草稿（草稿；依赖 D5、D7。让平台负责人能修改草稿里的题目与规格）
-- 新增 public.replace_math_paper_draft()：仅限数学应用、仅限草稿；在一个事务里替换名称、说明、用时、及格线与全部题目、
-- 答案键、判题规格（题目校验与 create_math_paper 共用 private.insert_math_paper_questions）。
-- 试卷类型、所属容器、试卷编号与版本不变；任何校验失败整体回滚，原草稿保持原样。不改动任何既有函数。
begin;

create function public.replace_math_paper_draft(
  p_paper_id uuid, p_title text, p_description text, p_duration_minutes integer,
  p_passing_score numeric, p_allow_resubmission boolean, p_questions jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_paper public.assessment_papers%rowtype; v_total numeric(8,2); v_count integer;
begin
  if not public.current_user_can_manage_assessment_papers() then
    raise exception '只有平台负责人或指定管理员可以修改标准试卷';
  end if;
  select * into v_paper from public.assessment_papers where id = p_paper_id for update;
  if v_paper.id is null or not exists (
    select 1 from public.student_apps a where a.id = v_paper.student_app_id and a.slug = 'math'
  ) then
    raise exception '试卷不存在或不是数学试卷';
  end if;
  if v_paper.status <> 'draft' then
    raise exception '只有草稿试卷可以修改，请先复制为新草稿';
  end if;

  p_title := btrim(coalesce(p_title, '')); p_description := btrim(coalesce(p_description, ''));
  if char_length(p_title) not between 2 and 120 then raise exception '试卷名称需要填写 2 至 120 个字'; end if;
  if char_length(p_description) > 5000 then raise exception '试卷说明不能超过 5000 个字'; end if;
  if p_duration_minutes is not null and p_duration_minutes not between 1 and 600 then
    raise exception '建议用时需要在 1 至 600 分钟之间'; end if;
  if p_passing_score is not null and p_passing_score not between 0 and 100 then
    raise exception '及格线需要在 0 至 100 之间'; end if;

  delete from public.assessment_paper_questions where paper_id = p_paper_id; -- 答案键与判题规格级联删除
  select o_total, o_count into v_total, v_count from private.insert_math_paper_questions(p_paper_id, p_questions);
  update public.assessment_papers
  set title = p_title, description = p_description, duration_minutes = p_duration_minutes,
      passing_score = p_passing_score, allow_resubmission = coalesce(p_allow_resubmission, allow_resubmission),
      total_points = v_total, question_count = v_count, updated_by = auth.uid(), updated_at = now()
  where id = p_paper_id;
end $$;
revoke all on function public.replace_math_paper_draft(uuid, text, text, integer, numeric, boolean, jsonb) from public, anon;
grant execute on function public.replace_math_paper_draft(uuid, text, text, integer, numeric, boolean, jsonb) to authenticated;

commit;
