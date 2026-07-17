-- 学生只能读取已经发布项目中的本人成绩；管理人员仍可读取全部成绩。
drop policy if exists "managers or owners read grade records" on public.grade_records;
create policy "managers or owners read grade records"
on public.grade_records for select to authenticated
using (
  public.current_user_can_manage_grade_center()
  or (
    student_id = auth.uid()
    and exists (
      select 1 from public.grade_items as item
      where item.id = grade_records.item_id
        and item.status = 'published'
    )
  )
);
