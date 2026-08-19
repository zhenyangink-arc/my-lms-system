begin;

-- 学生章节巩固进度以数据库为最终来源。巩固包本身已经固定所属学生应用，
-- 因此进度表不重复保存 student_app_id，RLS 通过 practice_unit_id 实时解析应用。
create table public.student_chapter_practice_progress (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants(id) on delete cascade,
  student_id uuid not null
    references public.profiles(id) on delete cascade,
  practice_unit_id uuid not null
    references public.chapter_practice_units(id) on delete cascade,
  status text not null default 'not_started' check (
    status in (
      'not_started',
      'in_progress',
      'needs_reinforcement',
      'mastered',
      'locked',
      'content_preparing'
    )
  ),
  progress_percent numeric(5, 2) not null default 0 check (
    progress_percent between 0 and 100
  ),
  mastery_percent numeric(5, 2) not null default 0 check (
    mastery_percent between 0 and 100
  ),
  completed_block_ids uuid[] not null default '{}'::uuid[],
  last_block_id uuid
    references public.chapter_practice_blocks(id) on delete set null,
  correct_count integer not null default 0 check (correct_count >= 0),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  started_at timestamptz,
  last_practiced_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_chapter_practice_progress_correct_within_attempt_check
    check (correct_count <= attempt_count),
  constraint student_chapter_practice_progress_unique_unit
    unique (tenant_id, student_id, practice_unit_id)
);

-- 统一复习项目保留来源引用与当时的内容、作答和反馈快照。
-- source_id/source_question_id 是多态 UUID，不绑定单一来源表。
create table public.student_review_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants(id) on delete cascade,
  student_id uuid not null
    references public.profiles(id) on delete cascade,
  student_app_id uuid not null
    references public.student_apps(id) on delete restrict,
  source_type text not null check (
    source_type in (
      'chapter_quiz',
      'teacher_homework',
      'formal_chapter_exam',
      'stage_exam',
      'midterm_exam',
      'final_exam',
      'specialized_practice',
      'practice_self_check',
      'makeup_exam',
      'student_bookmark',
      'teacher_speaking_writing_feedback'
    )
  ),
  source_id uuid not null,
  source_question_id uuid,
  course_id uuid references public.courses(id) on delete set null,
  course_chapter_id uuid
    references public.course_chapters(id) on delete set null,
  skill text not null check (
    skill in (
      'listening',
      'speaking',
      'reading',
      'writing',
      'grammar',
      'vocabulary'
    )
  ),
  content_snapshot jsonb not null default '{}'::jsonb check (
    jsonb_typeof(content_snapshot) = 'object'
  ),
  student_answer_snapshot jsonb not null default '{}'::jsonb check (
    jsonb_typeof(student_answer_snapshot) = 'object'
  ),
  feedback_snapshot jsonb not null default '{}'::jsonb check (
    jsonb_typeof(feedback_snapshot) = 'object'
  ),
  error_count integer not null default 0 check (error_count >= 0),
  status text not null default 'pending' check (
    status in ('pending', 'reviewing', 'mastered')
  ),
  last_reviewed_at timestamptz,
  mastered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_review_items_mastered_at_check check (
    (status = 'mastered' and mastered_at is not null)
    or (status <> 'mastered' and mastered_at is null)
  )
);

create index student_chapter_practice_progress_student_idx
  on public.student_chapter_practice_progress (
    tenant_id,
    student_id,
    last_practiced_at desc
  );
create index student_chapter_practice_progress_unit_idx
  on public.student_chapter_practice_progress (
    practice_unit_id,
    status,
    last_practiced_at desc
  );
create index student_review_items_student_status_idx
  on public.student_review_items (
    tenant_id,
    student_id,
    student_app_id,
    status,
    last_reviewed_at desc
  );
create index student_review_items_source_idx
  on public.student_review_items (source_type, source_id, source_question_id);
create index student_review_items_chapter_idx
  on public.student_review_items (
    tenant_id,
    student_id,
    course_chapter_id,
    status
  )
  where course_chapter_id is not null;

drop trigger if exists student_chapter_practice_progress_set_updated_at
  on public.student_chapter_practice_progress;
create trigger student_chapter_practice_progress_set_updated_at
before update on public.student_chapter_practice_progress
for each row execute function private.set_updated_at();

drop trigger if exists student_review_items_set_updated_at
  on public.student_review_items;
create trigger student_review_items_set_updated_at
before update on public.student_review_items
for each row execute function private.set_updated_at();

alter table public.student_chapter_practice_progress enable row level security;
alter table public.student_review_items enable row level security;

-- 读取权限沿用学生学习行为账本：学生本人、应用范围内的负责老师、
-- 本机构负责人以及平台负责人分别由既有统一函数实时判断。
create policy "authorized users read student chapter practice progress"
on public.student_chapter_practice_progress for select to authenticated
using (
  exists (
    select 1
    from public.chapter_practice_units as practice_unit
    where practice_unit.id = student_chapter_practice_progress.practice_unit_id
      and private.current_user_can_view_student_activity(
        student_chapter_practice_progress.tenant_id,
        student_chapter_practice_progress.student_id,
        practice_unit.student_app_id
      )
  )
);

create policy "students insert own chapter practice progress"
on public.student_chapter_practice_progress for insert to authenticated
with check (
  exists (
    select 1
    from public.chapter_practice_units as practice_unit
    where practice_unit.id = student_chapter_practice_progress.practice_unit_id
      and private.current_student_has_app_access(
        student_chapter_practice_progress.tenant_id,
        student_chapter_practice_progress.student_id,
        practice_unit.student_app_id
      )
  )
);

create policy "students update own chapter practice progress"
on public.student_chapter_practice_progress for update to authenticated
using (
  exists (
    select 1
    from public.chapter_practice_units as practice_unit
    where practice_unit.id = student_chapter_practice_progress.practice_unit_id
      and private.current_student_has_app_access(
        student_chapter_practice_progress.tenant_id,
        student_chapter_practice_progress.student_id,
        practice_unit.student_app_id
      )
  )
)
with check (
  exists (
    select 1
    from public.chapter_practice_units as practice_unit
    where practice_unit.id = student_chapter_practice_progress.practice_unit_id
      and private.current_student_has_app_access(
        student_chapter_practice_progress.tenant_id,
        student_chapter_practice_progress.student_id,
        practice_unit.student_app_id
      )
  )
);

create policy "students delete own chapter practice progress"
on public.student_chapter_practice_progress for delete to authenticated
using (
  exists (
    select 1
    from public.chapter_practice_units as practice_unit
    where practice_unit.id = student_chapter_practice_progress.practice_unit_id
      and private.current_student_has_app_access(
        student_chapter_practice_progress.tenant_id,
        student_chapter_practice_progress.student_id,
        practice_unit.student_app_id
      )
  )
);

create policy "authorized users read student review items"
on public.student_review_items for select to authenticated
using (
  private.current_user_can_view_student_activity(
    tenant_id,
    student_id,
    student_app_id
  )
);

create policy "students insert own review items"
on public.student_review_items for insert to authenticated
with check (
  private.current_student_has_app_access(
    tenant_id,
    student_id,
    student_app_id
  )
);

create policy "students update own review items"
on public.student_review_items for update to authenticated
using (
  private.current_student_has_app_access(
    tenant_id,
    student_id,
    student_app_id
  )
)
with check (
  private.current_student_has_app_access(
    tenant_id,
    student_id,
    student_app_id
  )
);

create policy "students delete own review items"
on public.student_review_items for delete to authenticated
using (
  private.current_student_has_app_access(
    tenant_id,
    student_id,
    student_app_id
  )
);

revoke all
  on public.student_chapter_practice_progress, public.student_review_items
  from public, anon, authenticated;
grant select, insert, update, delete
  on public.student_chapter_practice_progress, public.student_review_items
  to authenticated;
grant all
  on public.student_chapter_practice_progress, public.student_review_items
  to service_role;

comment on table public.student_chapter_practice_progress is
  '按租户、学生和巩固包版本保存章节巩固进度与掌握结果';
comment on column public.student_chapter_practice_progress.status is
  '状态：not_started 未开始，in_progress 巩固中，needs_reinforcement 待加强，mastered 已掌握，locked 未开放，content_preparing 内容准备中';
comment on column public.student_chapter_practice_progress.completed_block_ids is
  '已完成的 chapter_practice_blocks UUID 列表';
comment on table public.student_review_items is
  '跨测试、作业、考试、专项训练、巩固与师生反馈来源的统一复习项目';
comment on column public.student_review_items.source_type is
  '允许值：chapter_quiz 章节小测，teacher_homework 老师作业，formal_chapter_exam 正式章节考试，stage_exam 阶段考试，midterm_exam 期中考试，final_exam 期末考试，specialized_practice 专项训练，practice_self_check 巩固自测，makeup_exam 补考，student_bookmark 学生主动收藏，teacher_speaking_writing_feedback 口语写作老师建议';
comment on column public.student_review_items.source_id is
  '多态来源任务或试卷版本 UUID，由 source_type 确定来源表';
comment on column public.student_review_items.source_question_id is
  '多态来源题目 UUID；口语写作整体建议等无单题来源时为空';
comment on column public.student_review_items.content_snapshot is
  '加入统一复习中心时保存的原题或原任务快照';
comment on column public.student_review_items.student_answer_snapshot is
  '学生原答案快照，可保存客观题、文本或录音引用';
comment on column public.student_review_items.feedback_snapshot is
  '正确答案、评分建议、评分标准、老师评语与改进任务快照';

commit;
