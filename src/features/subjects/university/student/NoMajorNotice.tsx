/** 学生还没有所属专业时的提示：此时只能看到通识课，需要老师在管理端为学生选择专业。 */
export function NoMajorNotice() {
  return (
    <div role="status" className="app-soft-card rounded-2xl border px-4 py-3 text-sm font-medium leading-6">
      你还没有所属专业，目前只能看到通识课。请联系老师为你选择专业，选好后会显示你专业的课程。
    </div>
  );
}
