-- ============================================================
-- 管理员可以直接锁定/解锁某个学生某份目标大学申请表的资料清单，
-- 效果与学生自己点"上传"锁定一致；此前只有学生自己能更新这张表。
-- ============================================================

drop policy if exists "admins update university targets"
  on public.student_university_targets;
create policy "admins update university targets"
on public.student_university_targets for update
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
);

notify pgrst, 'reload schema';
