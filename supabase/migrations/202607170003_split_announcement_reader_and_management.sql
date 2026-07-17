-- ============================================================
-- 通知公告前后台分离
-- 正常登录账号只能读取已发布公告；负责人、CEO、指定管理员读取全部记录。
-- 公告写入规则仍沿用原有管理权限，不向学生开放任何写操作。
-- ============================================================

drop policy if exists "authorized staff read announcements" on public.announcements;
drop policy if exists "active users read published announcements" on public.announcements;

create policy "active users read published announcements"
on public.announcements for select to authenticated
using (
  public.current_user_can_access_announcements()
  or (
    status = 'published'
    and exists (
      select 1
      from public.profiles as viewer
      where viewer.id = auth.uid()
        and coalesce(viewer.status, 'active') = 'active'
    )
  )
);

comment on policy "active users read published announcements" on public.announcements is
  '正常登录账号只读已发布公告，公告管理人员可读取草稿和归档记录';
