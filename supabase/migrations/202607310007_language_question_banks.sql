begin;

-- Canonical chapter-test names. Compatibility views at the end keep older
-- stored functions and clients operational while application code migrates.
alter table public.course_tests rename to chapter_tests;
alter table public.course_test_questions rename to chapter_test_questions;
alter table public.course_test_attempts rename to chapter_test_attempts;
alter table public.course_question_reviews rename to chapter_test_question_reviews;

alter table public.chapter_test_questions
  drop constraint if exists course_test_questions_difficulty_check;
alter table public.chapter_test_questions
  add constraint chapter_test_questions_difficulty_check
  check (difficulty in ('foundation', 'medium'));

create or replace function private.korean_bank_text_is_valid(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    char_length(trim(coalesce(p_value, ''))) > 0
    and coalesce(p_value, '') ~ '[가-힣]'
    and coalesce(p_value, '') !~ '[㐀-䶿一-鿿]';
$$;

create or replace function private.korean_bank_optional_text_is_valid(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    char_length(trim(coalesce(p_value, ''))) = 0
    or private.korean_bank_text_is_valid(p_value);
$$;

create or replace function private.korean_bank_options_are_valid(
  p_options jsonb,
  p_expected_count integer default 4
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_option jsonb;
begin
  if jsonb_typeof(p_options) <> 'array'
    or jsonb_array_length(p_options) <> p_expected_count then
    return false;
  end if;

  for v_option in select value from jsonb_array_elements(p_options)
  loop
    if jsonb_typeof(v_option) <> 'string'
      or not private.korean_bank_text_is_valid(v_option #>> '{}') then
      return false;
    end if;
  end loop;

  return (
    select count(distinct value #>> '{}') = p_expected_count
    from jsonb_array_elements(p_options)
  );
end;
$$;

create table public.homework_bank_materials (
  id uuid primary key default gen_random_uuid(),
  chapter_test_id uuid references public.chapter_tests(id) on delete set null,
  language_skill text not null check (language_skill in ('listening', 'reading')),
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  material_length text not null check (material_length in ('short', 'medium', 'long')),
  title_ko text not null check (private.korean_bank_text_is_valid(title_ko)),
  content_ko text not null default '',
  audio_path text,
  audio_duration_seconds integer check (audio_duration_seconds is null or audio_duration_seconds > 0),
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'retired')),
  version integer not null default 1 check (version > 0),
  tags jsonb not null default '[]'::jsonb check (jsonb_typeof(tags) = 'array'),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint homework_bank_material_payload_check check (
    (
      language_skill = 'listening'
      and nullif(trim(audio_path), '') is not null
      and char_length(trim(content_ko)) = 0
    )
    or (
      language_skill = 'reading'
      and private.korean_bank_text_is_valid(content_ko)
      and audio_path is null
    )
  )
);

create table public.homework_bank_material_secrets (
  material_id uuid primary key references public.homework_bank_materials(id) on delete cascade,
  transcript_ko text not null check (private.korean_bank_text_is_valid(transcript_ko)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.homework_bank_questions (
  id uuid primary key default gen_random_uuid(),
  chapter_test_id uuid references public.chapter_tests(id) on delete set null,
  material_id uuid references public.homework_bank_materials(id) on delete restrict,
  language_skill text not null check (language_skill in ('listening', 'speaking', 'reading', 'writing')),
  assessment_category text not null check (char_length(trim(assessment_category)) between 1 and 80),
  question_type text not null check (
    question_type in ('single_choice', 'multiple_choice', 'fill_blank', 'ordering', 'audio_response', 'long_text')
  ),
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  prompt_ko text not null check (private.korean_bank_text_is_valid(prompt_ko)),
  options_ko jsonb not null default '[]'::jsonb,
  min_response_characters integer check (min_response_characters is null or min_response_characters > 0),
  max_response_characters integer check (max_response_characters is null or max_response_characters > 0),
  preparation_seconds integer check (preparation_seconds is null or preparation_seconds >= 0),
  min_recording_seconds integer check (min_recording_seconds is null or min_recording_seconds > 0),
  max_recording_seconds integer check (max_recording_seconds is null or max_recording_seconds > 0),
  default_points numeric(8,2) not null default 1 check (default_points > 0 and default_points <= 1000),
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'retired')),
  version integer not null default 1 check (version > 0),
  tags jsonb not null default '[]'::jsonb check (jsonb_typeof(tags) = 'array'),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint homework_bank_question_skill_type_check check (
    (language_skill = 'listening' and question_type = 'single_choice' and material_id is not null)
    or (language_skill = 'speaking' and question_type = 'audio_response' and material_id is null)
    or (language_skill = 'reading' and question_type in ('single_choice', 'multiple_choice', 'fill_blank', 'ordering') and material_id is not null)
    or (language_skill = 'writing' and question_type = 'long_text' and material_id is null)
  ),
  constraint homework_bank_question_options_check check (
    case
      when question_type in ('single_choice', 'multiple_choice', 'ordering')
        then private.korean_bank_options_are_valid(options_ko, 4)
      else jsonb_typeof(options_ko) = 'array' and jsonb_array_length(options_ko) = 0
    end
  ),
  constraint homework_bank_writing_length_check check (
    (question_type <> 'long_text' and min_response_characters is null and max_response_characters is null)
    or (
      question_type = 'long_text'
      and min_response_characters is not null
      and max_response_characters is not null
      and min_response_characters <= max_response_characters
    )
  ),
  constraint homework_bank_speaking_duration_check check (
    (question_type <> 'audio_response' and min_recording_seconds is null and max_recording_seconds is null)
    or (
      question_type = 'audio_response'
      and min_recording_seconds is not null
      and max_recording_seconds is not null
      and min_recording_seconds <= max_recording_seconds
    )
  )
);

create table public.homework_bank_question_keys (
  question_id uuid primary key references public.homework_bank_questions(id) on delete cascade,
  answer_key jsonb not null default '{}'::jsonb check (jsonb_typeof(answer_key) = 'object'),
  explanation_ko text not null default '' check (private.korean_bank_optional_text_is_valid(explanation_ko)),
  sample_answer_ko text not null default '' check (private.korean_bank_optional_text_is_valid(sample_answer_ko)),
  rubric_ko text not null default '' check (private.korean_bank_optional_text_is_valid(rubric_ko)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.exam_bank_materials (
  id uuid primary key default gen_random_uuid(),
  chapter_test_id uuid references public.chapter_tests(id) on delete set null,
  language_skill text not null check (language_skill in ('listening', 'reading')),
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  material_length text not null check (material_length in ('short', 'medium', 'long')),
  title_ko text not null check (private.korean_bank_text_is_valid(title_ko)),
  content_ko text not null default '',
  audio_path text,
  audio_duration_seconds integer check (audio_duration_seconds is null or audio_duration_seconds > 0),
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'retired')),
  version integer not null default 1 check (version > 0),
  tags jsonb not null default '[]'::jsonb check (jsonb_typeof(tags) = 'array'),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exam_bank_material_payload_check check (
    (
      language_skill = 'listening'
      and nullif(trim(audio_path), '') is not null
      and char_length(trim(content_ko)) = 0
    )
    or (
      language_skill = 'reading'
      and private.korean_bank_text_is_valid(content_ko)
      and audio_path is null
    )
  )
);

create table public.exam_bank_material_secrets (
  material_id uuid primary key references public.exam_bank_materials(id) on delete cascade,
  transcript_ko text not null check (private.korean_bank_text_is_valid(transcript_ko)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.exam_bank_questions (
  id uuid primary key default gen_random_uuid(),
  chapter_test_id uuid references public.chapter_tests(id) on delete set null,
  material_id uuid references public.exam_bank_materials(id) on delete restrict,
  language_skill text not null check (language_skill in ('listening', 'speaking', 'reading', 'writing')),
  assessment_category text not null check (char_length(trim(assessment_category)) between 1 and 80),
  question_type text not null check (
    question_type in ('single_choice', 'multiple_choice', 'fill_blank', 'ordering', 'audio_response', 'long_text')
  ),
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  prompt_ko text not null check (private.korean_bank_text_is_valid(prompt_ko)),
  options_ko jsonb not null default '[]'::jsonb,
  min_response_characters integer check (min_response_characters is null or min_response_characters > 0),
  max_response_characters integer check (max_response_characters is null or max_response_characters > 0),
  preparation_seconds integer check (preparation_seconds is null or preparation_seconds >= 0),
  min_recording_seconds integer check (min_recording_seconds is null or min_recording_seconds > 0),
  max_recording_seconds integer check (max_recording_seconds is null or max_recording_seconds > 0),
  default_points numeric(8,2) not null default 1 check (default_points > 0 and default_points <= 1000),
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'retired')),
  version integer not null default 1 check (version > 0),
  tags jsonb not null default '[]'::jsonb check (jsonb_typeof(tags) = 'array'),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exam_bank_question_skill_type_check check (
    (language_skill = 'listening' and question_type = 'single_choice' and material_id is not null)
    or (language_skill = 'speaking' and question_type = 'audio_response' and material_id is null)
    or (language_skill = 'reading' and question_type in ('single_choice', 'multiple_choice', 'fill_blank', 'ordering') and material_id is not null)
    or (language_skill = 'writing' and question_type = 'long_text' and material_id is null)
  ),
  constraint exam_bank_question_options_check check (
    case
      when question_type in ('single_choice', 'multiple_choice', 'ordering')
        then private.korean_bank_options_are_valid(options_ko, 4)
      else jsonb_typeof(options_ko) = 'array' and jsonb_array_length(options_ko) = 0
    end
  ),
  constraint exam_bank_writing_length_check check (
    (question_type <> 'long_text' and min_response_characters is null and max_response_characters is null)
    or (
      question_type = 'long_text'
      and min_response_characters is not null
      and max_response_characters is not null
      and min_response_characters <= max_response_characters
    )
  ),
  constraint exam_bank_speaking_duration_check check (
    (question_type <> 'audio_response' and min_recording_seconds is null and max_recording_seconds is null)
    or (
      question_type = 'audio_response'
      and min_recording_seconds is not null
      and max_recording_seconds is not null
      and min_recording_seconds <= max_recording_seconds
    )
  )
);

create table public.exam_bank_question_keys (
  question_id uuid primary key references public.exam_bank_questions(id) on delete cascade,
  answer_key jsonb not null default '{}'::jsonb check (jsonb_typeof(answer_key) = 'object'),
  explanation_ko text not null default '' check (private.korean_bank_optional_text_is_valid(explanation_ko)),
  sample_answer_ko text not null default '' check (private.korean_bank_optional_text_is_valid(sample_answer_ko)),
  rubric_ko text not null default '' check (private.korean_bank_optional_text_is_valid(rubric_ko)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index homework_bank_materials_filter_idx
  on public.homework_bank_materials(language_skill, difficulty, material_length, status);
create index homework_bank_questions_filter_idx
  on public.homework_bank_questions(language_skill, assessment_category, question_type, difficulty, status);
create index homework_bank_questions_chapter_idx
  on public.homework_bank_questions(chapter_test_id, language_skill);
create index exam_bank_materials_filter_idx
  on public.exam_bank_materials(language_skill, difficulty, material_length, status);
create index exam_bank_questions_filter_idx
  on public.exam_bank_questions(language_skill, assessment_category, question_type, difficulty, status);
create index exam_bank_questions_chapter_idx
  on public.exam_bank_questions(chapter_test_id, language_skill);

create trigger homework_bank_materials_set_updated_at
before update on public.homework_bank_materials
for each row execute function private.set_updated_at();
create trigger homework_bank_material_secrets_set_updated_at
before update on public.homework_bank_material_secrets
for each row execute function private.set_updated_at();
create trigger homework_bank_questions_set_updated_at
before update on public.homework_bank_questions
for each row execute function private.set_updated_at();
create trigger homework_bank_question_keys_set_updated_at
before update on public.homework_bank_question_keys
for each row execute function private.set_updated_at();
create trigger exam_bank_materials_set_updated_at
before update on public.exam_bank_materials
for each row execute function private.set_updated_at();
create trigger exam_bank_material_secrets_set_updated_at
before update on public.exam_bank_material_secrets
for each row execute function private.set_updated_at();
create trigger exam_bank_questions_set_updated_at
before update on public.exam_bank_questions
for each row execute function private.set_updated_at();
create trigger exam_bank_question_keys_set_updated_at
before update on public.exam_bank_question_keys
for each row execute function private.set_updated_at();

alter table public.homework_bank_materials enable row level security;
alter table public.homework_bank_material_secrets enable row level security;
alter table public.homework_bank_questions enable row level security;
alter table public.homework_bank_question_keys enable row level security;
alter table public.exam_bank_materials enable row level security;
alter table public.exam_bank_material_secrets enable row level security;
alter table public.exam_bank_questions enable row level security;
alter table public.exam_bank_question_keys enable row level security;

create policy "question bank managers manage homework materials"
on public.homework_bank_materials for all to authenticated
using (public.current_user_can_manage_assessment_papers())
with check (public.current_user_can_manage_assessment_papers());
create policy "question bank managers manage homework material secrets"
on public.homework_bank_material_secrets for all to authenticated
using (public.current_user_can_manage_assessment_papers())
with check (public.current_user_can_manage_assessment_papers());
create policy "question bank managers manage homework questions"
on public.homework_bank_questions for all to authenticated
using (public.current_user_can_manage_assessment_papers())
with check (public.current_user_can_manage_assessment_papers());
create policy "question bank managers manage homework question keys"
on public.homework_bank_question_keys for all to authenticated
using (public.current_user_can_manage_assessment_papers())
with check (public.current_user_can_manage_assessment_papers());
create policy "question bank managers manage exam materials"
on public.exam_bank_materials for all to authenticated
using (public.current_user_can_manage_assessment_papers())
with check (public.current_user_can_manage_assessment_papers());
create policy "question bank managers manage exam material secrets"
on public.exam_bank_material_secrets for all to authenticated
using (public.current_user_can_manage_assessment_papers())
with check (public.current_user_can_manage_assessment_papers());
create policy "question bank managers manage exam questions"
on public.exam_bank_questions for all to authenticated
using (public.current_user_can_manage_assessment_papers())
with check (public.current_user_can_manage_assessment_papers());
create policy "question bank managers manage exam question keys"
on public.exam_bank_question_keys for all to authenticated
using (public.current_user_can_manage_assessment_papers())
with check (public.current_user_can_manage_assessment_papers());

grant select, insert, update, delete on
  public.homework_bank_materials,
  public.homework_bank_material_secrets,
  public.homework_bank_questions,
  public.homework_bank_question_keys,
  public.exam_bank_materials,
  public.exam_bank_material_secrets,
  public.exam_bank_questions,
  public.exam_bank_question_keys
to authenticated, service_role;

-- Old table names remain as security-invoker, automatically updatable views.
create view public.course_tests with (security_invoker = true) as
select * from public.chapter_tests;
create view public.course_test_questions with (security_invoker = true) as
select * from public.chapter_test_questions;
create view public.course_test_attempts with (security_invoker = true) as
select * from public.chapter_test_attempts;
create view public.course_question_reviews with (security_invoker = true) as
select * from public.chapter_test_question_reviews;

grant select on public.course_tests to authenticated, service_role;
grant select, insert, update, delete on public.course_test_questions to authenticated, service_role;
grant select, insert, update, delete on public.course_test_attempts to authenticated, service_role;
grant select, insert, update, delete on public.course_question_reviews to authenticated, service_role;

comment on table public.chapter_test_questions is
  '章节测试题库；只保存基础和中等难度的四选一题。';
comment on table public.homework_bank_material_secrets is
  '作业听力原文，仅平台题库管理员可读，绝不发送到学生端。';
comment on table public.exam_bank_material_secrets is
  '考试听力原文，仅平台题库管理员可读，绝不发送到学生端。';
comment on table public.homework_bank_question_keys is
  '作业题库答案、解析、参考答案和评分标准的受保护数据。';
comment on table public.exam_bank_question_keys is
  '考试题库答案、解析、参考答案和评分标准的受保护数据。';

commit;
