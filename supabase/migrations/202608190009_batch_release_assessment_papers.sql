begin;

-- 集中生成发布失败原因，供单套质检、批量发布和延迟约束触发器复用。
create or replace function private.assessment_paper_release_issues(
  p_paper_id uuid
)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_paper public.assessment_papers%rowtype;
  v_issues text[] := array[]::text[];
begin
  select * into v_paper
  from public.assessment_papers
  where id = p_paper_id;
  if not found then
    return array['标准试卷不存在'];
  end if;

  if v_paper.question_count < 1 then
    v_issues := array_append(v_issues, '试卷没有题目');
  end if;
  if v_paper.duration_minutes is null then
    v_issues := array_append(v_issues, '未设置考试时长');
  end if;
  if v_paper.passing_score is null then
    v_issues := array_append(v_issues, '未设置及格分');
  end if;
  if v_paper.allow_resubmission is null then
    v_issues := array_append(v_issues, '未设置重复提交规则');
  end if;
  if exists (
    select 1
    from public.assessment_paper_questions as question
    where question.paper_id = p_paper_id
    group by lower(btrim(question.prompt)), lower(btrim(question.stimulus_text))
    having count(*) > 1
  ) then
    v_issues := array_append(v_issues, '存在重复题干');
  end if;
  if exists (
    select 1
    from public.assessment_paper_questions as question
    left join public.assessment_paper_question_keys as answer_key
      on answer_key.question_id = question.id
    where question.paper_id = p_paper_id
      and (
        nullif(btrim(question.prompt), '') is null
        or question.points <= 0
        or answer_key.question_id is null
        or nullif(btrim(answer_key.explanation), '') is null
        or question.skill not in (
          'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
        )
      )
  ) then
    v_issues := array_append(v_issues, '存在题干、解析、分值或能力分类未完成的题目');
  end if;
  if (
    select count(*) from public.assessment_paper_questions as question
    where question.paper_id = p_paper_id
  ) <> v_paper.question_count then
    v_issues := array_append(v_issues, '试卷题量与题目快照不一致');
  end if;
  if (
    select coalesce(sum(question.points), 0)
    from public.assessment_paper_questions as question
    where question.paper_id = p_paper_id
  ) <> v_paper.total_points then
    v_issues := array_append(v_issues, '试卷总分与题目快照不一致');
  end if;
  if exists (
    select 1
    from public.assessment_paper_questions as question
    left join public.assessment_paper_question_keys as answer_key
      on answer_key.question_id = question.id
    where question.paper_id = p_paper_id
      and question.auto_graded
      and (
        nullif(btrim(answer_key.correct_answer), '') is null
        or nullif(btrim(answer_key.explanation), '') is null
        or jsonb_array_length(question.options) < 2
        or not question.options @> jsonb_build_array(answer_key.correct_answer)
      )
  ) then
    v_issues := array_append(
      v_issues, '客观题存在正确答案、选项或解析不完整的情况'
    );
  end if;

  if v_paper.paper_type = 'exam'
    and v_paper.paper_code ~ '^EX-K1-(0[1-9]|1[0-6])-V[0-9]+$' then
    if v_paper.total_points <> 100 then
      v_issues := array_append(v_issues, '正式章节考试总分必须等于100分');
    end if;
    if (
      select count(distinct question.skill)
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill in (
          'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
        )
    ) <> 6 then
      v_issues := array_append(v_issues, '单词、语法、听力、口语、阅读、写作六项不齐全');
    end if;
    if exists (
      select required.skill
      from (values
        ('vocabulary', 15::numeric), ('grammar', 20::numeric),
        ('listening', 15::numeric), ('speaking', 15::numeric),
        ('reading', 20::numeric), ('writing', 15::numeric)
      ) as required(skill, points)
      left join (
        select question.skill, sum(question.points) as points
        from public.assessment_paper_questions as question
        where question.paper_id = p_paper_id
        group by question.skill
      ) as actual using (skill)
      where coalesce(actual.points, 0) <> required.points
    ) then
      v_issues := array_append(
        v_issues, '六项分值必须为单词15、语法20、听力15、口语15、阅读20、写作15'
      );
    end if;
    if exists (
      select 1
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill in ('vocabulary', 'grammar', 'listening', 'reading')
        and not question.auto_graded
    ) then
      v_issues := array_append(v_issues, '单词、语法、听力或阅读客观题未配置自动判分');
    end if;
    if exists (
      select 1
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill in ('speaking', 'writing')
        and question.auto_graded
    ) then
      v_issues := array_append(v_issues, '口语和写作必须配置为人工批改');
    end if;
    if exists (
      select 1
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill = 'speaking'
        and question.question_type <> 'audio_recording'
    ) or exists (
      select 1
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill = 'writing'
        and question.question_type <> 'long_text'
    ) then
      v_issues := array_append(v_issues, '口语录音题或写作长文本题的作答方式不正确');
    end if;
    if exists (
      select 1
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill = 'listening'
        and (
          nullif(btrim(question.stimulus_text), '') is null
          or question.audio_status not in ('pending', 'temporary', 'formal')
        )
    ) then
      v_issues := array_append(v_issues, '听力题缺少听力文本或有效音频状态');
    end if;
  elsif v_paper.paper_type = 'homework' then
    if (
      select count(distinct question.skill)
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill in (
          'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
        )
    ) <> 6 then
      v_issues := array_append(v_issues, '章节作业的词汇、语法、听说读写六项内容不完整');
    end if;
    if exists (
      select 1
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill = 'listening'
        and nullif(btrim(question.stimulus_text), '') is null
    ) then
      v_issues := array_append(v_issues, '章节作业的听力题缺少韩语听力材料');
    end if;
  end if;

  return v_issues;
end;
$$;

create or replace function private.validate_assessment_paper_release(
  p_paper_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paper public.assessment_papers%rowtype;
  v_issues text[];
begin
  select * into v_paper
  from public.assessment_papers
  where id = p_paper_id;
  if v_paper.id is null or v_paper.status <> 'published' then
    raise exception '所选标准试卷当前不可发布';
  end if;
  v_issues := private.assessment_paper_release_issues(p_paper_id);
  if cardinality(v_issues) > 0 then
    raise exception '发布前质检未通过：%', array_to_string(v_issues, '；');
  end if;
end;
$$;

create or replace function public.get_assessment_paper_release_quality(
  p_paper_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_issues text[];
begin
  if not public.current_user_can_manage_assessment_papers() then
    raise exception '当前账号不能查看标准试卷质检结果';
  end if;
  v_issues := private.assessment_paper_release_issues(p_paper_id);
  return jsonb_build_object(
    'ready', cardinality(v_issues) = 0,
    'issues', to_jsonb(v_issues)
  );
end;
$$;

-- 复制正式考试时连同听力状态一起生成新草稿版本，旧版本保持原样。
create or replace function public.duplicate_assessment_paper(
  p_paper_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.assessment_papers%rowtype;
  v_new_id uuid;
  v_new_code text;
begin
  if not public.current_user_can_manage_assessment_papers() then
    raise exception '当前账号不能复制标准试卷';
  end if;
  select * into v_source
  from public.assessment_papers
  where id = p_paper_id
  for update;
  if not found then raise exception '试卷不存在'; end if;

  v_new_code := case
    when v_source.paper_code ~ '^(HW|EX)-K1-(0[1-9]|1[0-6])-V[0-9]+$' then
      regexp_replace(
        v_source.paper_code,
        '-V[0-9]+$',
        '-V' || (v_source.version + 1)::text
      )
    else
      case when v_source.paper_type = 'homework' then 'HW-' else 'EX-' end
        || lpad(nextval('public.assessment_paper_code_seq')::text, 6, '0')
  end;

  insert into public.assessment_papers (
    paper_code, paper_type, title, description, source_test_id,
    student_app_id, duration_minutes, passing_score, allow_resubmission,
    total_points, question_count, version, status, created_by, updated_by
  ) values (
    v_new_code, v_source.paper_type,
    left(v_source.title || '（新版本）', 120), v_source.description,
    v_source.source_test_id, v_source.student_app_id,
    v_source.duration_minutes, v_source.passing_score,
    v_source.allow_resubmission, v_source.total_points,
    v_source.question_count, v_source.version + 1, 'draft',
    auth.uid(), auth.uid()
  ) returning id into v_new_id;

  with copied as (
    insert into public.assessment_paper_questions (
      paper_id, source_bank_question_id, source_bank_version, question_type,
      stimulus_text, prompt, options, points, sort_order, difficulty, skill,
      audio_status
    )
    select
      v_new_id, source_bank_question_id, source_bank_version, question_type,
      stimulus_text, prompt, options, points, sort_order, difficulty, skill,
      audio_status
    from public.assessment_paper_questions
    where paper_id = p_paper_id
    order by sort_order
    returning id, sort_order
  )
  insert into public.assessment_paper_question_keys (
    question_id, correct_answer, explanation
  )
  select copied.id, source_key.correct_answer, source_key.explanation
  from copied
  join public.assessment_paper_questions as source_question
    on source_question.paper_id = p_paper_id
   and source_question.sort_order = copied.sort_order
  join public.assessment_paper_question_keys as source_key
    on source_key.question_id = source_question.id;

  return v_new_id;
end;
$$;

-- 已经离开草稿状态的版本永远不能回到可编辑草稿；需要调整时必须复制新版本。
create or replace function public.change_assessment_paper_status(
  p_paper_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paper public.assessment_papers%rowtype;
  v_issues text[];
begin
  if not public.current_user_can_release_assessment_papers() then
    raise exception '只有平台负责人可以改变试卷的机构可见状态';
  end if;
  if p_status not in ('draft', 'published', 'retired', 'archived') then
    raise exception '试卷状态不正确';
  end if;
  select * into v_paper
  from public.assessment_papers
  where id = p_paper_id
  for update;
  if not found then raise exception '试卷不存在'; end if;
  if v_paper.status <> 'draft' and p_status = 'draft' then
    raise exception '已发布或已停止提供的试卷不能退回可编辑草稿，请复制为新版本';
  end if;
  if p_status = 'published' then
    if v_paper.status <> 'draft' then
      raise exception '只有从未发布的草稿可以发布；历史版本请复制为新版本';
    end if;
    v_issues := private.assessment_paper_release_issues(p_paper_id);
    if cardinality(v_issues) > 0 then
      raise exception '发布前质检未通过：%', array_to_string(v_issues, '；');
    end if;
  end if;

  update public.assessment_papers
  set status = p_status,
      published_at = case when p_status = 'published' then now() else published_at end,
      updated_by = auth.uid(), updated_at = now()
  where id = p_paper_id;
end;
$$;

-- 补齐历史治理触发器的 INSERT 缺口，防止向已发布快照追加题目或答案。
create or replace function private.prevent_released_paper_question_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paper_id uuid := case when tg_op = 'DELETE' then old.paper_id else new.paper_id end;
begin
  if exists (
    select 1 from public.assessment_papers as paper
    where paper.id = v_paper_id and paper.status <> 'draft'
  ) then
    raise exception '已发布或已停止提供的试卷题目不可直接修改，请复制为新草稿';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists assessment_paper_questions_lock_released
  on public.assessment_paper_questions;
create trigger assessment_paper_questions_lock_released
before insert or update or delete on public.assessment_paper_questions
for each row execute function private.prevent_released_paper_question_mutation();

create or replace function private.prevent_released_paper_key_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_question_id uuid := case when tg_op = 'DELETE' then old.question_id else new.question_id end;
begin
  if exists (
    select 1
    from public.assessment_paper_questions as question
    join public.assessment_papers as paper on paper.id = question.paper_id
    where question.id = v_question_id and paper.status <> 'draft'
  ) then
    raise exception '已发布或已停止提供的试卷答案不可直接修改，请复制为新草稿';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists assessment_paper_keys_lock_released
  on public.assessment_paper_question_keys;
create trigger assessment_paper_keys_lock_released
before insert or update or delete on public.assessment_paper_question_keys
for each row execute function private.prevent_released_paper_key_mutation();

-- 平台负责人原子发布一组草稿。先锁定并逐套复检，再只改变发布状态；
-- 绝不更新题干、答案、分值或任何已经发布的试卷。
create or replace function public.publish_assessment_paper_batch(
  p_paper_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paper public.assessment_papers%rowtype;
  v_issues text[];
  v_published_count integer := 0;
begin
  if not public.current_user_can_release_assessment_papers() then
    raise exception '只有平台负责人可以批量发布标准试卷';
  end if;
  if p_paper_ids is null
    or cardinality(p_paper_ids) not between 1 and 100
    or (
      select count(distinct paper_id)
      from unnest(p_paper_ids) as requested(paper_id)
    ) <> cardinality(p_paper_ids) then
    raise exception '批量发布的试卷编号不正确';
  end if;

  for v_paper in
    select paper.*
    from unnest(p_paper_ids) with ordinality as requested(paper_id, position)
    join public.assessment_papers as paper on paper.id = requested.paper_id
    order by paper.id
    for update of paper
  loop
    if v_paper.status <> 'draft' then
      raise exception '试卷%不存在或不是草稿，批量发布已全部取消', v_paper.paper_code;
    end if;
    v_issues := private.assessment_paper_release_issues(v_paper.id);
    if cardinality(v_issues) > 0 then
      raise exception '试卷%发布前质检未通过：%',
        v_paper.paper_code, array_to_string(v_issues, '；');
    end if;

    update public.assessment_papers
    set status = 'published', published_at = now(),
        updated_by = auth.uid(), updated_at = now()
    where id = v_paper.id and status = 'draft';
    v_published_count := v_published_count + 1;
  end loop;

  if v_published_count <> cardinality(p_paper_ids) then
    raise exception '批量发布中包含不存在的试卷，所有试卷均保持原状态';
  end if;
  return v_published_count;
end;
$$;

revoke all on function public.publish_assessment_paper_batch(uuid[])
  from public, anon;
grant execute on function public.publish_assessment_paper_batch(uuid[])
  to authenticated;

comment on function public.publish_assessment_paper_batch(uuid[]) is
  '平台负责人原子发布一组质检合格草稿；只改变状态，不覆盖历史内容。';

commit;
