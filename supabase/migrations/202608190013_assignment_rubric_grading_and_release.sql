begin;

-- Speaking and writing rubric details are stored with the answer snapshot.
-- The trigger below is the authoritative consistency boundary: a client cannot
-- persist a total that differs from the rubric sum.
alter table public.learning_submission_answers
  add column if not exists rubric_scores jsonb;

comment on column public.learning_submission_answers.rubric_scores is
  'Per-criterion speaking/writing scores. Keys are validated against the answer question language_skill.';

create or replace function public.enforce_learning_answer_rubric_scores()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_skill text;
  v_auto_graded boolean;
  v_question_points numeric(8,2);
  v_key_count integer;
  v_total numeric(8,2) := 0;
  v_value numeric(8,2);
  v_key text;
  v_keys text[];
  v_maxima numeric[];
  v_index integer;
begin
  select question.language_skill, question.auto_graded, question.points
  into v_skill, v_auto_graded, v_question_points
  from public.learning_assignment_questions as question
  where question.id = new.question_id
    and question.tenant_id = new.tenant_id;

  if not found then
    raise exception '评分题目不存在';
  end if;

  if v_auto_graded or v_skill not in ('speaking', 'writing') then
    if new.rubric_scores is not null then
      raise exception '只有口语和写作主观题可以保存分项评分';
    end if;
    return new;
  end if;

  if new.awarded_points is null and new.rubric_scores is null then
    return new;
  end if;
  if new.awarded_points is null or new.rubric_scores is null then
    raise exception '口语和写作得分必须同时包含分项评分与总分';
  end if;
  if jsonb_typeof(new.rubric_scores) <> 'object' then
    raise exception '分项评分必须是 JSON 对象';
  end if;

  if v_skill = 'speaking' then
    v_keys := array[
      'pronunciation_accuracy', 'fluency', 'grammar_vocabulary', 'task_completion'
    ];
    v_maxima := array[4, 4, 4, 3]::numeric[];
  else
    v_keys := array[
      'content_completeness', 'grammar_accuracy', 'vocabulary_use',
      'organization_expression', 'spelling_format'
    ];
    v_maxima := array[4, 4, 3, 2, 2]::numeric[];
  end if;

  select count(*) into v_key_count
  from jsonb_object_keys(new.rubric_scores);
  if v_key_count <> cardinality(v_keys) or not (new.rubric_scores ?& v_keys) then
    raise exception '分项评分项目与题目能力类型不一致';
  end if;

  for v_index in 1..cardinality(v_keys)
  loop
    v_key := v_keys[v_index];
    if jsonb_typeof(new.rubric_scores -> v_key) <> 'number' then
      raise exception '分项评分必须是数字';
    end if;
    begin
      v_value := (new.rubric_scores ->> v_key)::numeric;
    exception when others then
      raise exception '分项评分包含无效数字';
    end;
    if v_value < 0 or v_value > v_maxima[v_index] then
      raise exception '分项评分超出允许范围';
    end if;
    v_total := v_total + v_value;
  end loop;

  if v_total <> new.awarded_points then
    raise exception '分项分数之和必须与单题总分一致';
  end if;
  if v_total > v_question_points then
    raise exception '分项分数之和不能超过题目满分';
  end if;
  return new;
end;
$$;

drop trigger if exists learning_submission_answers_enforce_rubric_scores
  on public.learning_submission_answers;
create trigger learning_submission_answers_enforce_rubric_scores
before insert or update of question_id, awarded_points, rubric_scores
on public.learning_submission_answers
for each row execute function public.enforce_learning_answer_rubric_scores();

revoke all on function public.enforce_learning_answer_rubric_scores()
  from public, anon, authenticated;

-- Tenant-scoped, teacher-maintained comment library.
create table public.learning_grading_comments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 500),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, content)
);

create index learning_grading_comments_tenant_order_idx
  on public.learning_grading_comments (tenant_id, sort_order, created_at, id);

alter table public.learning_grading_comments enable row level security;
alter table public.learning_grading_comments force row level security;

create policy learning_grading_comments_select
on public.learning_grading_comments for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select public.current_user_is_assignment_manager())
);

grant select on public.learning_grading_comments to authenticated;
revoke insert, update, delete on public.learning_grading_comments from authenticated;
grant all on public.learning_grading_comments to service_role;

insert into public.learning_grading_comments (tenant_id, content, sort_order)
select tenant.id, seed.content, seed.sort_order
from public.tenants as tenant
cross join (values
  ('整体完成认真，继续保持。', 10),
  ('口语内容完整，请继续注意发音和语速。', 20),
  ('语法基本正确，请检查词尾和助词使用。', 30),
  ('请根据单题评语订正后重新提交。', 40)
) as seed(content, sort_order)
on conflict (tenant_id, content) do nothing;

create or replace function public.seed_learning_grading_comments_for_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.learning_grading_comments (tenant_id, content, sort_order)
  values
    (new.id, '整体完成认真，继续保持。', 10),
    (new.id, '口语内容完整，请继续注意发音和语速。', 20),
    (new.id, '语法基本正确，请检查词尾和助词使用。', 30),
    (new.id, '请根据单题评语订正后重新提交。', 40)
  on conflict (tenant_id, content) do nothing;
  return new;
end;
$$;

drop trigger if exists tenants_seed_learning_grading_comments on public.tenants;
create trigger tenants_seed_learning_grading_comments
after insert on public.tenants
for each row execute function public.seed_learning_grading_comments_for_tenant();

revoke all on function public.seed_learning_grading_comments_for_tenant()
  from public, anon, authenticated;

create or replace function public.create_learning_grading_comment(p_content text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_id uuid;
  v_content text := btrim(coalesce(p_content, ''));
  v_sort_order integer;
begin
  if v_tenant_id is null or not public.current_user_is_assignment_manager() then
    raise exception '当前账号没有维护常用评语的权限';
  end if;
  if char_length(v_content) not between 1 and 500 then
    raise exception '常用评语必须为 1 到 500 个字';
  end if;
  select coalesce(max(comment.sort_order), 0) + 10 into v_sort_order
  from public.learning_grading_comments as comment
  where comment.tenant_id = v_tenant_id;
  insert into public.learning_grading_comments (
    tenant_id, content, sort_order, created_by, updated_by
  ) values (
    v_tenant_id, v_content, v_sort_order, auth.uid(), auth.uid()
  ) returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception '这条常用评语已经存在';
end;
$$;

create or replace function public.update_learning_grading_comment(
  p_comment_id uuid,
  p_content text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_content text := btrim(coalesce(p_content, ''));
begin
  if v_tenant_id is null or not public.current_user_is_assignment_manager() then
    raise exception '当前账号没有维护常用评语的权限';
  end if;
  if char_length(v_content) not between 1 and 500 then
    raise exception '常用评语必须为 1 到 500 个字';
  end if;
  update public.learning_grading_comments
  set content = v_content, updated_by = auth.uid(), updated_at = now()
  where id = p_comment_id and tenant_id = v_tenant_id;
  if not found then raise exception '常用评语不存在'; end if;
exception when unique_violation then
  raise exception '这条常用评语已经存在';
end;
$$;

create or replace function public.delete_learning_grading_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := private.current_tenant_id();
begin
  if v_tenant_id is null or not public.current_user_is_assignment_manager() then
    raise exception '当前账号没有维护常用评语的权限';
  end if;
  delete from public.learning_grading_comments
  where id = p_comment_id and tenant_id = v_tenant_id;
  if not found then raise exception '常用评语不存在'; end if;
end;
$$;

revoke all on function public.create_learning_grading_comment(text)
  from public, anon;
revoke all on function public.update_learning_grading_comment(uuid, text)
  from public, anon;
revoke all on function public.delete_learning_grading_comment(uuid)
  from public, anon;
grant execute on function public.create_learning_grading_comment(text)
  to authenticated;
grant execute on function public.update_learning_grading_comment(uuid, text)
  to authenticated;
grant execute on function public.delete_learning_grading_comment(uuid)
  to authenticated;

-- A completed manual grade must be explicitly confirmed before release. The
-- confirmation may release immediately or wait for the configured release time.
alter table public.learning_submissions
  add column if not exists grade_release_confirmed_at timestamptz,
  add column if not exists grade_release_confirmed_by uuid
    references public.profiles(id) on delete set null;

create or replace function public.grade_learning_submission(
  p_submission_id uuid,
  p_decision text,
  p_overall_feedback text,
  p_scores jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission public.learning_submissions%rowtype;
  v_item jsonb;
  v_answer_id uuid;
  v_points numeric(8,2);
  v_feedback text;
  v_rubric_scores jsonb;
  v_max_points numeric(8,2);
  v_total numeric(8,2) := 0;
  v_expected integer;
  v_received integer;
begin
  select submission.* into v_submission
  from public.learning_submissions as submission
  join public.learning_assignments as assignment
    on assignment.tenant_id = submission.tenant_id
   and assignment.id = submission.assignment_id
  where submission.id = p_submission_id
    and submission.tenant_id = private.current_tenant_id()
    and private.current_staff_has_app_capability(
      assignment.tenant_id, assignment.student_app_id, 'manage_assessments'
    )
    and (
      public.current_profile_role() <> 'teacher'
      or private.current_teacher_has_student_app_access(
        assignment.tenant_id, submission.student_id, assignment.student_app_id
      )
    )
  for update of submission;

  if v_submission.id is null then
    raise exception '提交记录不存在或当前账号没有该应用的批改权限';
  end if;
  if v_submission.submission_state = 'grade_released' then
    raise exception '成绩已经发布，不能再次修改批改结果';
  end if;
  if p_decision not in ('graded', 'revision_required') then
    raise exception '批改结果不正确';
  end if;
  p_overall_feedback := btrim(coalesce(p_overall_feedback, ''));
  if char_length(p_overall_feedback) > 3000 then
    raise exception '总体评语不能超过 3000 个字';
  end if;
  if p_decision = 'revision_required' and char_length(p_overall_feedback) < 2 then
    raise exception '退回重做时必须填写明确原因';
  end if;
  if p_scores is null or jsonb_typeof(p_scores) <> 'array' then
    raise exception '评分数据格式不正确';
  end if;

  select count(*) into v_expected
  from public.learning_submission_answers
  where tenant_id = v_submission.tenant_id and submission_id = p_submission_id;
  select count(distinct value->>'answerId') into v_received
  from jsonb_array_elements(p_scores) as value;
  if v_expected = 0 or v_received <> v_expected
    or jsonb_array_length(p_scores) <> v_expected then
    raise exception '请填写全部题目的评分';
  end if;

  for v_item in select value from jsonb_array_elements(p_scores)
  loop
    begin
      v_answer_id := (v_item->>'answerId')::uuid;
      v_points := (v_item->>'points')::numeric;
    exception when others then
      raise exception '评分中包含无效数据';
    end;
    v_feedback := nullif(btrim(coalesce(v_item->>'feedback', '')), '');
    v_rubric_scores := case
      when v_item ? 'rubricScores' and jsonb_typeof(v_item->'rubricScores') = 'object'
        then v_item->'rubricScores'
      else null
    end;
    if v_feedback is not null and char_length(v_feedback) > 2000 then
      raise exception '单题评语不能超过 2000 个字';
    end if;

    select question.points into v_max_points
    from public.learning_submission_answers as answer
    join public.learning_assignment_questions as question
      on question.tenant_id = answer.tenant_id and question.id = answer.question_id
    where answer.id = v_answer_id
      and answer.tenant_id = v_submission.tenant_id
      and answer.submission_id = p_submission_id;
    if not found then raise exception '评分中包含不属于本次提交的答案'; end if;
    if v_points < 0 or v_points > v_max_points then
      raise exception '单题得分必须在 0 分和题目满分之间';
    end if;

    update public.learning_submission_answers
    set awarded_points = v_points,
        rubric_scores = v_rubric_scores,
        grader_feedback = v_feedback,
        updated_at = now()
    where id = v_answer_id and tenant_id = v_submission.tenant_id;
    v_total := v_total + v_points;
  end loop;

  update public.learning_submissions
  set status = case when p_decision = 'revision_required'
        then 'revision_required' else 'submitted' end,
      score = null,
      computed_score = case when p_decision = 'graded' then v_total else null end,
      overall_feedback = nullif(p_overall_feedback, ''),
      submission_state = case when p_decision = 'revision_required'
        then 'revision_required' else 'grading_completed' end,
      grading_completed_at = case when p_decision = 'graded' then now() else null end,
      grade_release_confirmed_at = null,
      grade_release_confirmed_by = null,
      grade_released_at = null,
      graded_at = now(),
      graded_by = auth.uid(),
      updated_at = now()
  where id = p_submission_id and tenant_id = v_submission.tenant_id;
end;
$$;

create or replace function public.release_learning_submission_grade(p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission public.learning_submissions%rowtype;
  v_assignment public.learning_assignments%rowtype;
  v_release_now boolean;
begin
  select submission.* into v_submission
  from public.learning_submissions as submission
  join public.learning_assignments as assignment
    on assignment.tenant_id = submission.tenant_id
   and assignment.id = submission.assignment_id
  where submission.id = p_submission_id
    and submission.tenant_id = private.current_tenant_id()
    and private.current_staff_has_app_capability(
      assignment.tenant_id, assignment.student_app_id, 'manage_assessments'
    )
    and (
      public.current_profile_role() <> 'teacher'
      or private.current_teacher_has_student_app_access(
        assignment.tenant_id, submission.student_id, assignment.student_app_id
      )
    )
  for update of submission;

  if v_submission.id is null then
    raise exception '提交记录不存在或当前账号没有该应用的发布权限';
  end if;
  select assignment.* into v_assignment
  from public.learning_assignments as assignment
  where assignment.id = v_submission.assignment_id
    and assignment.tenant_id = v_submission.tenant_id;
  if v_submission.submission_state <> 'grading_completed'
    or v_submission.computed_score is null
    or v_submission.grading_completed_at is null then
    raise exception '只有完成全部批改后才能发布成绩';
  end if;
  if exists (
    select 1 from public.learning_submission_answers as answer
    where answer.tenant_id = v_submission.tenant_id
      and answer.submission_id = v_submission.id
      and answer.awarded_points is null
  ) then
    raise exception '仍有主观题未完成评分，不能发布成绩';
  end if;

  v_release_now := v_assignment.grade_release_at is null
    or v_assignment.grade_release_at <= now();
  update public.learning_submissions
  set grade_release_confirmed_at = now(),
      grade_release_confirmed_by = auth.uid(),
      status = case when v_release_now then 'graded' else 'submitted' end,
      score = case when v_release_now then computed_score else null end,
      submission_state = case when v_release_now
        then 'grade_released' else 'grading_completed' end,
      grade_released_at = case when v_release_now then now() else null end,
      updated_at = now()
  where id = v_submission.id and tenant_id = v_submission.tenant_id;

  return jsonb_build_object(
    'released', v_release_now,
    'scheduled', not v_release_now,
    'releaseAt', v_assignment.grade_release_at
  );
end;
$$;

create or replace function public.release_current_user_due_assignment_grades()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_released integer;
begin
  if auth.uid() is null or public.current_profile_role() <> 'student'
    or not public.is_active_account() then
    return 0;
  end if;

  update public.learning_submissions as submission
  set status = 'graded', score = submission.computed_score,
      submission_state = 'grade_released', grade_released_at = now(),
      updated_at = now()
  from public.learning_assignments as assignment
  where assignment.tenant_id = submission.tenant_id
    and assignment.id = submission.assignment_id
    and submission.tenant_id = private.current_tenant_id()
    and submission.student_id = auth.uid()
    and submission.submission_state = 'grading_completed'
    and submission.grade_release_confirmed_at is not null
    and assignment.grade_release_at is not null
    and assignment.grade_release_at <= now();
  get diagnostics v_released = row_count;
  return v_released;
end;
$$;

revoke all on function public.release_learning_submission_grade(uuid)
  from public, anon;
grant execute on function public.release_learning_submission_grade(uuid)
  to authenticated;

comment on column public.learning_submissions.grade_release_confirmed_at is
  'Teacher confirmation prerequisite for final grade release.';

commit;
