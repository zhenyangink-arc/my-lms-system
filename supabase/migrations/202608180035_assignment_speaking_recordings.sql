begin;

-- 私有录音仍放在已存在的学生录音桶中，独立证据表确保录音归属到
-- 明确的机构、学生、作业和口语题，浏览器不能直接读取对象。
create table if not exists public.learning_assignment_recording_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  assignment_id uuid not null,
  question_id uuid not null,
  object_key text not null unique,
  byte_size bigint not null check (byte_size between 2048 and 10485760),
  mime_type text not null check (
    mime_type in ('audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg')
  ),
  created_at timestamptz not null default now(),
  consumed_submission_id uuid,
  consumed_at timestamptz,
  foreign key (tenant_id, assignment_id)
    references public.learning_assignments(tenant_id, id) on delete cascade,
  foreign key (tenant_id, question_id)
    references public.learning_assignment_questions(tenant_id, id) on delete cascade,
  foreign key (tenant_id, consumed_submission_id)
    references public.learning_submissions(tenant_id, id)
    on delete set null (consumed_submission_id),
  check (
    (consumed_submission_id is null and consumed_at is null)
    or (consumed_submission_id is not null and consumed_at is not null)
  )
);

create index if not exists learning_assignment_recording_owner_idx
  on public.learning_assignment_recording_evidence (
    tenant_id, student_id, assignment_id, question_id, created_at desc
  );

alter table public.learning_assignment_recording_evidence enable row level security;
revoke all on public.learning_assignment_recording_evidence from anon, authenticated;
grant select, insert, update, delete
  on public.learning_assignment_recording_evidence to service_role;

comment on table public.learning_assignment_recording_evidence is
  '章节作业口语题的私有录音证据；只通过受控 API 上传和签名读取。';

commit;
