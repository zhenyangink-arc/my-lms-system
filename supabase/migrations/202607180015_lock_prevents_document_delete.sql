-- ============================================================
-- 管理员锁定的申请资料项目不能被删除，必须先解锁。
-- ============================================================

drop policy if exists "admins delete application checklist items"
  on public.student_application_documents;
create policy "admins delete application checklist items"
on public.student_application_documents for delete
to authenticated
using (
  admin_locked_at is null
  and exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
);

notify pgrst, 'reload schema';
