begin;

select set_config('app.platform_content_migration', 'on', true);

-- 专项训练使用与课程中心完全相同的“课程 → 课时 → 章节”目录。
-- 已有正式章节继续关联 chapter_tests；仅有首批课时正文的课程，先补一个
-- 与课时同名的训练章节，后续可以在管理端继续拆分而不改变专项训练路由。
alter table public.growth_toolbox_exercises
  add column if not exists course_chapter_id uuid
    references public.course_chapters(id) on delete set null;

create index if not exists growth_toolbox_exercises_course_chapter_idx
  on public.growth_toolbox_exercises (student_app_id, skill, course_chapter_id)
  where status = 'published';

alter table public.course_chapters disable trigger user;

insert into public.course_chapters (
  lesson_id,
  chapter_test_id,
  slug,
  title,
  description,
  duration_minutes,
  is_published,
  sort_order,
  completion_rule,
  unlock_mode,
  tenant_id,
  content_scope
)
select
  lesson.id,
  null,
  lesson.slug,
  lesson.title,
  lesson.description,
  greatest(1, coalesce(lesson.duration_minutes, 20)),
  true,
  1,
  'content_viewed',
  'immediate',
  lesson.tenant_id,
  lesson.content_scope
from public.lessons as lesson
join public.courses as course on course.id = lesson.course_id
where course.student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
  and course.is_published
  and lesson.is_published
  and not exists (
    select 1
    from public.course_chapters as existing
    where existing.lesson_id = lesson.id
      and existing.is_published
  )
on conflict (lesson_id, slug) do update set
  title = excluded.title,
  description = excluded.description,
  duration_minutes = excluded.duration_minutes,
  is_published = true,
  tenant_id = excluded.tenant_id,
  content_scope = excluded.content_scope,
  updated_at = now();

alter table public.course_chapters enable trigger user;

-- 把已经由正式章节题库生成的练习回填到课程中心章节，避免维护两套关系。
update public.growth_toolbox_exercises as exercise
set
  course_chapter_id = chapter.id,
  course_id = lesson.course_id,
  updated_at = now()
from public.course_chapters as chapter
join public.lessons as lesson on lesson.id = chapter.lesson_id
where chapter.chapter_test_id = exercise.chapter_test_id
  and exercise.student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
  and exercise.chapter_test_id is not null
  and (
    exercise.course_chapter_id is distinct from chapter.id
    or exercise.course_id is distinct from lesson.course_id
  );

with skill_catalog(skill, label, instruction, skill_order) as (
  values
    ('listening',  '听力', '先播放本课韩语材料，再围绕本课目标完成听辨。', 1),
    ('speaking',   '口语', '先开口复述本课表达，再完成情境与表达判断。', 2),
    ('reading',    '阅读', '结合本课正文、目标和注意事项完成阅读理解。', 3),
    ('writing',    '写作', '围绕本课表达完成理解题，并抄写一条韩语示例。', 4),
    ('grammar',    '语法', '根据本课重点与常见错误完成结构辨析。', 5),
    ('vocabulary', '词汇', '结合本课主题识别核心场景、词语和常用表达。', 6)
), catalog as (
  select
    course.id as course_id,
    course.slug as course_slug,
    course.title as course_title,
    course.level,
    course.sort_order as course_order,
    lesson.id as lesson_id,
    lesson.slug as lesson_slug,
    lesson.title as lesson_title,
    lesson.description as lesson_description,
    lesson.learning_objectives,
    lesson.lesson_tasks,
    lesson.key_points,
    lesson.common_mistakes,
    lesson.summary_text,
    lesson.sort_order as lesson_order,
    chapter.id as course_chapter_id,
    chapter.slug as chapter_slug,
    chapter.title as chapter_title,
    chapter.chapter_test_id,
    chapter.sort_order as chapter_order
  from public.courses as course
  join public.lessons as lesson on lesson.course_id = course.id
  join public.course_chapters as chapter on chapter.lesson_id = lesson.id
  where course.student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
    and course.is_published
    and lesson.is_published
    and chapter.is_published
    and chapter.chapter_test_id is null
)
insert into public.growth_toolbox_exercises (
  tenant_id,
  student_app_id,
  slug,
  skill,
  title,
  description,
  instructions,
  difficulty,
  source,
  course_id,
  course_chapter_id,
  chapter_test_id,
  content_payload,
  status,
  sort_order
)
select
  null,
  '10000000-0000-4000-8000-000000000001'::uuid,
  'catalog-' || catalog.course_slug || '-' || catalog.lesson_slug || '-' || catalog.chapter_slug || '-' || skill.skill,
  skill.skill,
  catalog.lesson_title || ' · ' || skill.label || '训练',
  catalog.course_title || ' · 与课程正文同步的专项练习',
  skill.instruction,
  case catalog.level
    when 'advanced' then 'advanced'
    when 'intermediate' then 'intermediate'
    else 'beginner'
  end,
  'platform',
  catalog.course_id,
  catalog.course_chapter_id,
  null,
  jsonb_build_object(
    'courseSlug', catalog.course_slug,
    'courseTitle', catalog.course_title,
    'lessonSlug', catalog.lesson_slug,
    'lessonTitle', catalog.lesson_title,
    'chapterSlug', catalog.chapter_slug,
    'chapterTitle', catalog.chapter_title,
    'chapterAligned', true,
    'practiceMode', skill.skill,
    'focus', jsonb_build_array(
      coalesce(nullif(split_part(catalog.learning_objectives, E'\n', 1), ''), catalog.lesson_description),
      coalesce(nullif(split_part(catalog.key_points, E'\n', 1), ''), catalog.summary_text)
    )
  ),
  'published',
  catalog.course_order * 1000 + catalog.lesson_order * 100 + catalog.chapter_order * 10 + skill.skill_order
from catalog
cross join skill_catalog as skill
on conflict (tenant_id, student_app_id, slug) do update set
  skill = excluded.skill,
  title = excluded.title,
  description = excluded.description,
  instructions = excluded.instructions,
  difficulty = excluded.difficulty,
  source = excluded.source,
  course_id = excluded.course_id,
  course_chapter_id = excluded.course_chapter_id,
  chapter_test_id = excluded.chapter_test_id,
  content_payload = excluded.content_payload,
  status = excluded.status,
  sort_order = excluded.sort_order,
  updated_at = now();

-- 新目录课时先配置一组轻量但明确对应正文的题目。正式章节仍继续使用
-- chapter_test_questions 的五题题库，不会被这里覆盖。
with synthetic_exercises as (
  select
    exercise.id as exercise_id,
    exercise.skill,
    course.title as course_title,
    lesson.title as lesson_title,
    lesson.description,
    coalesce(
      nullif(split_part(lesson.learning_objectives, E'\n', 1), ''),
      nullif(lesson.description, ''),
      '理解本课核心内容'
    ) as first_objective,
    coalesce(
      nullif(split_part(lesson.lesson_tasks, E'\n', 1), ''),
      nullif(split_part(lesson.key_points, E'\n', 1), ''),
      '结合课程正文完成本课练习'
    ) as first_task,
    coalesce(
      nullif(split_part(lesson.common_mistakes, E'\n', 1), ''),
      nullif(lesson.summary_text, ''),
      '完成后回到课程正文复习'
    ) as first_reminder,
    coalesce(korean_line.value, '안녕하세요.') as korean_example
  from public.growth_toolbox_exercises as exercise
  join public.course_chapters as chapter on chapter.id = exercise.course_chapter_id
  join public.lessons as lesson on lesson.id = chapter.lesson_id
  join public.courses as course on course.id = lesson.course_id
  left join lateral (
    select trim(line) as value
    from regexp_split_to_table(coalesce(lesson.content_text, ''), E'\n') as line
    where line ~ '[가-힣]'
    order by length(trim(line)) desc
    limit 1
  ) as korean_line on true
  where exercise.student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
    and exercise.tenant_id is null
    and exercise.status = 'published'
    and exercise.course_chapter_id is not null
    and exercise.chapter_test_id is null
), generated as (
  select synthetic.*, series.question_number
  from synthetic_exercises as synthetic
  cross join generate_series(1, 5) as series(question_number)
)
insert into public.growth_toolbox_questions (
  exercise_id,
  primary_skill,
  question_type,
  prompt,
  content_payload,
  max_score,
  difficulty,
  sort_order
)
select
  generated.exercise_id,
  generated.skill,
  case when generated.skill = 'writing' and generated.question_number = 5
    then 'short_text'
    else 'single_choice'
  end,
  case generated.question_number
    when 1 then '这组训练对应哪一课？'
    when 2 then '这组训练属于哪门课程？'
    when 3 then '本课首先要达成哪一项学习目标？'
    when 4 then '哪一种练习方式与本课任务直接对应？'
    else case generated.skill
      when 'writing' then '请完整抄写本课韩语示例。'
      when 'listening' then '听完示例后，哪一项是本课的学习提醒？'
      when 'speaking' then '先朗读示例，再选择本课需要注意的事项。'
      else '完成本组专项训练后，应该重点回顾什么？'
    end
  end,
  jsonb_build_object(
    'options', case when generated.skill = 'writing' and generated.question_number = 5
      then '[]'::jsonb
      else jsonb_build_array(
        jsonb_build_object(
          'value', 'a',
          'label', case generated.question_number
            when 1 then generated.lesson_title
            when 2 then generated.course_title
            when 3 then generated.first_objective
            when 4 then generated.first_task
            else generated.first_reminder
          end
        ),
        jsonb_build_object('value', 'b', 'label', '跳过课程内容，只查看总分'),
        jsonb_build_object('value', 'c', 'label', '与当前课程无关的自由练习')
      )
    end,
    'hint', case
      when generated.skill = 'writing' and generated.question_number = 5 then '先看清空格和句尾，再完整输入。'
      when generated.skill = 'speaking' then '选择前先把韩语示例大声读一遍。'
      else '答案来自当前课程的正文、目标或注意事项。'
    end,
    'stimulus', case when generated.skill = 'listening' then generated.korean_example else '' end,
    'speakBeforeAnswer', generated.skill = 'speaking',
    'catalogAligned', true,
    'koreanExample', generated.korean_example
  ),
  20,
  'beginner',
  generated.question_number
from generated
on conflict (exercise_id, sort_order) do update set
  primary_skill = excluded.primary_skill,
  question_type = excluded.question_type,
  prompt = excluded.prompt,
  content_payload = excluded.content_payload,
  max_score = excluded.max_score,
  difficulty = excluded.difficulty,
  updated_at = now();

insert into public.growth_toolbox_question_keys (
  question_id,
  accepted_answers,
  rubric,
  explanation
)
select
  question.id,
  case when exercise.skill = 'writing' and question.sort_order = 5
    then jsonb_build_array(question.content_payload ->> 'koreanExample')
    else jsonb_build_array('a')
  end,
  jsonb_build_object(
    'courseChapterId', exercise.course_chapter_id,
    'catalogAligned', true
  ),
  '本题直接取自当前课程课时的正文、学习目标、练习任务或注意事项。'
from public.growth_toolbox_questions as question
join public.growth_toolbox_exercises as exercise on exercise.id = question.exercise_id
where exercise.student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
  and exercise.course_chapter_id is not null
  and exercise.chapter_test_id is null
on conflict (question_id) do update set
  accepted_answers = excluded.accepted_answers,
  rubric = excluded.rubric,
  explanation = excluded.explanation,
  updated_at = now();

create unique index if not exists growth_toolbox_exercises_course_chapter_unique_idx
  on public.growth_toolbox_exercises (student_app_id, skill, course_chapter_id)
  where course_chapter_id is not null;

do $$
begin
  if exists (
    select 1
    from public.growth_toolbox_exercises as exercise
    join public.course_chapters as chapter on chapter.id = exercise.course_chapter_id
    join public.lessons as lesson on lesson.id = chapter.lesson_id
    join public.courses as course on course.id = lesson.course_id
    where exercise.student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
      and (
        course.student_app_id is distinct from exercise.student_app_id
        or course.id is distinct from exercise.course_id
        or course.content_scope <> 'platform'
        or course.tenant_id is not null
      )
  ) then
    raise exception '专项训练与课程目录的应用域或内容域不一致，回滚迁移';
  end if;

  if exists (
    select 1
    from public.courses as course
    join public.lessons as lesson on lesson.course_id = course.id and lesson.is_published
    join public.course_chapters as chapter on chapter.lesson_id = lesson.id and chapter.is_published
    cross join (values ('listening'), ('speaking'), ('reading'), ('writing'), ('grammar'), ('vocabulary')) as skill(name)
    where course.student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
      and course.is_published
      and not exists (
        select 1
        from public.growth_toolbox_exercises as exercise
        where exercise.student_app_id = course.student_app_id
          and exercise.course_chapter_id = chapter.id
          and exercise.skill = skill.name
          and exercise.status = 'published'
      )
  ) then
    raise exception '仍有已发布韩语课程章节没有六项专项训练，回滚迁移';
  end if;
end;
$$;

comment on column public.growth_toolbox_exercises.course_chapter_id is
  '专项训练对应课程中心的真实章节；通过该章节回到所属课时与课程。';

commit;
