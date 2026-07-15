-- ============================================================
-- 修复旧版申请材料状态
-- 旧页面允许只改状态而不上传文件；这些记录不能直接进入新的审核流程。
-- ============================================================

-- 没有真实提交版本的旧审核状态统一退回“准备中”，学生可重新选择文件提交。
update public.student_application_documents
set
  status = 'preparing',
  storage_path = null,
  original_file_name = null,
  file_size_bytes = null,
  file_mime_type = null,
  submitted_at = null,
  review_started_at = null,
  reviewed_at = null,
  reviewed_by = null,
  review_note = null
where status in ('pending_review', 'reviewing', 'approved', 'revision_required')
  and submission_version = 0;

-- 从数据库层保证：只有存在真实文件版本的材料才能进入审核与确认状态。
alter table public.student_application_documents
  drop constraint if exists student_application_documents_review_file_check;

alter table public.student_application_documents
  add constraint student_application_documents_review_file_check
  check (
    status in ('not_started', 'preparing')
    or (
      storage_path is not null
      and original_file_name is not null
      and file_size_bytes is not null
      and submission_version > 0
      and submitted_at is not null
    )
  );

comment on constraint student_application_documents_review_file_check
on public.student_application_documents is
  '没有真实上传文件和提交版本的材料不得进入审核流程';
