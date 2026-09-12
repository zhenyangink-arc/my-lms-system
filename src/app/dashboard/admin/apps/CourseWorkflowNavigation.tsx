import Link from "next/link";
import { getDigitalTextbookManagementData } from "@/features/digital-textbook/api/service";
import { courseContentSteps } from "@/lib/course-content-workflow";
import { workflowChapters, workflowHref } from "@/lib/course-workflow-context";
import type { ManagementAppAccess } from "@/lib/management-apps";

export async function CourseWorkflowNavigation({ access, section, chapterId }: {
  access: ManagementAppAccess; section: string; chapterId?: string;
}) {
  const steps = courseContentSteps(access);
  // The context selector must not introduce a stricter authorization gate on the catalog.
  const canReadTextbooks = access.scope !== "platform" || access.globalRole === "platform_owner" || access.globalRole === "platform_admin";
  const data = canReadTextbooks ? await getDigitalTextbookManagementData(access.appId) : null;
  const chapters = data && !data.hasError ? workflowChapters(data.courses) : [];
  const selected = chapters.find(chapter => chapter.id === chapterId);
  return <div className="mb-5 space-y-3 border-b border-[var(--border)] pb-3">
    {canReadTextbooks && <form action={`${access.appPath}/${section}`} method="get" className="flex flex-wrap items-end gap-2">
      <label className="grid min-w-0 gap-1 text-sm">当前章节与教材版本
        <select key={chapterId ?? "all"} name="chapter" defaultValue={selected?.id ?? ""} disabled={Boolean(data?.hasError)} className="app-input min-h-11 max-w-full rounded-md border px-3 sm:max-w-xl">
          <option value="">全部章节</option>
          {chapters.map(chapter => <option key={chapter.id} value={chapter.id}>{chapter.label}</option>)}
        </select>
      </label>
      <button type="submit" disabled={Boolean(data?.hasError)} className="min-h-11 rounded-md border border-[var(--border)] px-3 text-sm disabled:opacity-50">定位章节</button>
    </form>}
    {data?.hasError && <p role="status" className="text-sm">章节目录读取不完整，请刷新重试。</p>}
    {chapterId && !selected && !data?.hasError && <p role="status" className="text-sm">当前章节不存在或不在可查看范围内，请重新选择。</p>}
    <nav aria-label="课程内容工作导航" className="flex flex-wrap gap-2">
      {steps.map(step => <Link key={step.key} href={workflowHref(access.appPath, step.key, chapterId)} aria-current={section === step.key ? "page" : undefined}
        className={`rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${section === step.key ? "bg-[var(--surface-soft)] text-[var(--foreground)]" : "text-[var(--foreground-muted)] hover:bg-[var(--surface-soft)]"}`}>
        {step.title}
      </Link>)}
    </nav>
  </div>;
}
