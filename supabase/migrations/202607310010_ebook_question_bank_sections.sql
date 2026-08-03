-- 题库统一记录电子书目录来源，出题、组卷和复盘都能回到对应学习分区。

alter table public.chapter_test_questions
  add column if not exists ebook_section_step text not null default 'STEP 08',
  add column if not exists ebook_page_reference text not null default '';

update public.chapter_test_questions
set ebook_section_step = case
  when skill = 'vocabulary' then 'STEP 02'
  when skill = 'grammar' then 'STEP 03'
  when skill = 'communication' then 'STEP 05'
  else 'STEP 08'
end;

alter table public.chapter_test_questions
  drop constraint if exists chapter_test_questions_ebook_section_check,
  add constraint chapter_test_questions_ebook_section_check
    check (ebook_section_step in (
      'STEP 01', 'STEP 02', 'STEP 03', 'STEP 04',
      'STEP 05', 'STEP 06', 'STEP 07', 'STEP 08'
    ));

alter table public.homework_bank_materials
  add column if not exists ebook_section_step text not null default 'STEP 06',
  add column if not exists ebook_page_reference text not null default '';
alter table public.exam_bank_materials
  add column if not exists ebook_section_step text not null default 'STEP 06',
  add column if not exists ebook_page_reference text not null default '';
alter table public.homework_bank_questions
  add column if not exists ebook_section_step text not null default 'STEP 08',
  add column if not exists ebook_page_reference text not null default '';
alter table public.exam_bank_questions
  add column if not exists ebook_section_step text not null default 'STEP 08',
  add column if not exists ebook_page_reference text not null default '';

update public.homework_bank_materials
set ebook_section_step = case when language_skill = 'listening' then 'STEP 06' else 'STEP 07' end;
update public.exam_bank_materials
set ebook_section_step = case when language_skill = 'listening' then 'STEP 06' else 'STEP 07' end;
update public.homework_bank_questions
set ebook_section_step = case
  when language_skill in ('listening', 'speaking') then 'STEP 06'
  when language_skill in ('reading', 'writing') then 'STEP 07'
  else 'STEP 08'
end;
update public.exam_bank_questions
set ebook_section_step = case
  when language_skill in ('listening', 'speaking') then 'STEP 06'
  when language_skill in ('reading', 'writing') then 'STEP 07'
  else 'STEP 08'
end;

do $block$
declare
  v_table text;
begin
  foreach v_table in array array[
    'homework_bank_materials', 'exam_bank_materials',
    'homework_bank_questions', 'exam_bank_questions'
  ] loop
    execute format(
      'alter table public.%I drop constraint if exists %I',
      v_table,
      v_table || '_ebook_section_check'
    );
    execute format(
      'alter table public.%I add constraint %I check (ebook_section_step in (''STEP 01'', ''STEP 02'', ''STEP 03'', ''STEP 04'', ''STEP 05'', ''STEP 06'', ''STEP 07'', ''STEP 08''))',
      v_table,
      v_table || '_ebook_section_check'
    );
  end loop;
end;
$block$;

drop function if exists public.save_standard_question(
  uuid, uuid, text, text, jsonb, integer, text, text, text,
  numeric, text, jsonb, text
);

create function public.save_standard_question(
  p_question_id uuid,
  p_test_id uuid,
  p_question_type text,
  p_prompt text,
  p_options jsonb,
  p_correct_option integer,
  p_correct_answer text,
  p_explanation text,
  p_skill text,
  p_default_points numeric,
  p_difficulty text,
  p_tags jsonb,
  p_status text,
  p_ebook_section_step text,
  p_ebook_page_reference text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_question_id uuid;
  v_sort_order integer;
  v_current_test_id uuid;
begin
  if not private.can_manage_standard_question_bank() then
    raise exception '当前账号没有标准题库编辑权限';
  end if;

  p_prompt := btrim(coalesce(p_prompt, ''));
  p_explanation := btrim(coalesce(p_explanation, ''));
  p_skill := btrim(coalesce(p_skill, ''));
  p_correct_answer := nullif(btrim(coalesce(p_correct_answer, '')), '');
  p_options := coalesce(p_options, '[]'::jsonb);
  p_tags := coalesce(p_tags, '[]'::jsonb);
  p_ebook_section_step := btrim(coalesce(p_ebook_section_step, ''));
  p_ebook_page_reference := btrim(coalesce(p_ebook_page_reference, ''));

  perform 1 from public.chapter_tests where id = p_test_id;
  if not found then raise exception '所选课程章节不存在'; end if;
  if p_question_type <> 'single_choice' then raise exception '章节测试题库只允许四选一题'; end if;
  if char_length(p_prompt) not between 1 and 3000 then raise exception '题目不能为空且不能超过 3000 个字'; end if;
  if char_length(p_explanation) > 3000 then raise exception '解析不能超过 3000 个字'; end if;
  if char_length(p_skill) not between 1 and 80 then raise exception '知识点需要填写 1 至 80 个字'; end if;
  if p_default_points is null or p_default_points <= 0 or p_default_points > 1000 then raise exception '默认分值需要大于 0 且不超过 1000'; end if;
  if p_difficulty not in ('foundation', 'medium') then raise exception '章节测试题难度只能是基础或中等'; end if;
  if p_status not in ('draft', 'published', 'archived') then raise exception '发布状态不正确'; end if;
  if jsonb_typeof(p_tags) <> 'array' then raise exception '标签格式不正确'; end if;
  if p_ebook_section_step not in ('STEP 01', 'STEP 02', 'STEP 03', 'STEP 04', 'STEP 05', 'STEP 06', 'STEP 07', 'STEP 08') then
    raise exception '请选择电子书目录来源';
  end if;
  if char_length(p_ebook_page_reference) > 80 then raise exception '电子书页码说明不能超过 80 个字'; end if;
  if jsonb_typeof(p_options) <> 'array' or jsonb_array_length(p_options) <> 4 then raise exception '章节测试单选题必须正好有四个选项'; end if;
  if p_correct_option is null or p_correct_option < 0 or p_correct_option >= 4 then raise exception '请选择正确答案'; end if;
  p_correct_answer := null;

  if p_question_id is null then
    select coalesce(max(sort_order), 0) + 1 into v_sort_order
    from public.chapter_test_questions where test_id = p_test_id;
    insert into public.chapter_test_questions (
      test_id, question_key, prompt, options, correct_option, correct_answer,
      explanation, skill, sort_order, question_type, default_points, difficulty,
      tags, status, version, created_by, updated_by, is_chapter_test_item,
      ebook_section_step, ebook_page_reference
    ) values (
      p_test_id, 'bank-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
      p_prompt, p_options, p_correct_option, p_correct_answer, p_explanation,
      p_skill, v_sort_order, p_question_type, p_default_points, p_difficulty,
      p_tags, p_status, 1, auth.uid(), auth.uid(), false,
      p_ebook_section_step, p_ebook_page_reference
    ) returning id into v_question_id;
  else
    select test_id into v_current_test_id
    from public.chapter_test_questions where id = p_question_id;
    if not found then raise exception '题目不存在'; end if;
    if v_current_test_id <> p_test_id then
      select coalesce(max(sort_order), 0) + 1 into v_sort_order
      from public.chapter_test_questions where test_id = p_test_id;
    else
      select sort_order into v_sort_order
      from public.chapter_test_questions where id = p_question_id;
    end if;
    update public.chapter_test_questions set
      test_id = p_test_id,
      prompt = p_prompt,
      options = p_options,
      correct_option = p_correct_option,
      correct_answer = p_correct_answer,
      explanation = p_explanation,
      skill = p_skill,
      sort_order = v_sort_order,
      question_type = p_question_type,
      default_points = p_default_points,
      difficulty = p_difficulty,
      tags = p_tags,
      status = p_status,
      version = version + 1,
      ebook_section_step = p_ebook_section_step,
      ebook_page_reference = p_ebook_page_reference,
      updated_by = auth.uid(),
      updated_at = now()
    where id = p_question_id
    returning id into v_question_id;
  end if;
  return v_question_id;
end;
$function$;

revoke all on function public.save_standard_question(
  uuid, uuid, text, text, jsonb, integer, text, text, text,
  numeric, text, jsonb, text, text, text
) from public;
grant execute on function public.save_standard_question(
  uuid, uuid, text, text, jsonb, integer, text, text, text,
  numeric, text, jsonb, text, text, text
) to authenticated;

create index if not exists chapter_test_questions_ebook_section_idx
  on public.chapter_test_questions(test_id, ebook_section_step, difficulty);
create index if not exists homework_bank_questions_ebook_section_idx
  on public.homework_bank_questions(chapter_test_id, ebook_section_step, language_skill);
create index if not exists exam_bank_questions_ebook_section_idx
  on public.exam_bank_questions(chapter_test_id, ebook_section_step, language_skill);

comment on column public.chapter_test_questions.ebook_section_step is '对应电子书目录 STEP 01—08';
comment on column public.homework_bank_questions.ebook_section_step is '对应电子书目录 STEP 01—08';
comment on column public.exam_bank_questions.ebook_section_step is '对应电子书目录 STEP 01—08';
