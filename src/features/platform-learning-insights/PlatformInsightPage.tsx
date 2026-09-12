import { InstitutionFollowups } from "./InstitutionFollowups";
import Link from "next/link";
import { ManagementNotice } from "@/components/layout/management-page";
import { parseInsightFilters, type InsightMode, type SearchParams } from "./model";
import { loadPlatformInsights } from "./service";
import { InsightBoard } from "./InsightBoard";

export async function PlatformInsightPage({ appSlug, mode, searchParams }: { appSlug: string; mode: InsightMode; searchParams: SearchParams }) {
  const filters = parseInsightFilters(searchParams);
  const data = await loadPlatformInsights(appSlug, mode, filters);
  const unavailable = data.errors.some(error => error !== "累计六维能力");
  return <div className="space-y-4">
    {mode === "conversation" && appSlug === "korean" && data.access.globalRole === "platform_owner" && <div className="flex justify-end"><Link href={`${data.access.appPath}/conversation/scenarios`} className="inline-flex min-h-11 items-center border px-4 text-sm font-medium">管理平台会话场景</Link></div>}
    <form method="get" className="app-card flex flex-wrap items-end gap-3 border p-4">
      <label className="flex min-w-36 flex-col gap-1 text-sm">统计时间<select name="days" defaultValue={filters.days} className="app-input h-11 border px-3"><option value="7">最近 7 天</option><option value="30">最近 30 天</option><option value="90">最近 90 天</option></select></label>
      <label className="flex min-w-44 max-w-full flex-1 flex-col gap-1 text-sm">机构范围<select name="tenant" defaultValue={filters.tenant} className="app-input h-11 min-w-0 border px-3"><option value="">全部已注册机构</option>{data.invalidTenant && <option value={filters.tenant}>机构不在当前应用范围</option>}{data.tenants.map(tenant => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}</select></label>
      {mode === "grades" && <label className="flex min-w-36 flex-col gap-1 text-sm">成绩来源<select name="source" defaultValue={filters.source} className="app-input h-11 border px-3"><option value="all">全部来源</option><option value="homework">作业</option><option value="exam">正式考试</option><option value="chapter">章节测试</option></select></label>}
      {mode === "grades" && <label className="flex min-w-44 max-w-full flex-col gap-1 text-sm">课程范围<select aria-label="课程范围" name="course" defaultValue={filters.course} className="app-input h-11 max-w-full border px-3"><option value="">全部课程（含未关联成绩）</option>{data.invalidCourse && <option value={filters.course}>课程不在当前范围</option>}{data.courses.map(course => <option key={course.id} value={course.id}>{course.title}{course.tenant_id ? ` · ${data.tenants.find(tenant => tenant.id === course.tenant_id)?.name ?? "机构课程"}` : " · 平台课程"}</option>)}</select></label>}
      <button type="submit" className="min-h-11 bg-[var(--primary)] px-4 text-sm font-medium text-white">应用筛选</button>
      <Link href={`${data.access.appPath}/${mode}`} className="inline-flex min-h-11 items-center border px-4 text-sm">重置</Link>
    </form>
    <p className="app-muted-text text-xs">最近 {filters.days} 天，与此前等长时段比较。平台仅展示机构汇总，当前状态指标另行标注。</p>
    {data.errors.length > 0 && <ManagementNotice tone="warning">{data.errors.join("、")}暂时无法读取。请刷新重试；未读取的数据不会显示为零。</ManagementNotice>}
    {data.invalidCourse ? <ManagementNotice tone="warning">所选课程不属于当前应用或机构，请重新选择。</ManagementNotice> : data.invalidTenant ? <ManagementNotice tone="warning">所选机构未注册当前应用，请重新选择机构范围。</ManagementNotice> : unavailable ? <div className="app-card border p-8 text-center text-sm">统计暂不可用，请稍后重试。</div> : <InsightBoard key={`${mode}:${filters.days}:${filters.tenant}:${filters.source}:${filters.course}`} mode={mode} days={filters.days} report={data.report} skillsAvailable={!data.errors.includes("累计六维能力")} courseSelected={Boolean(filters.course)} />}
    {data.access.capabilities.manageTenantAvailability && (filters.tenant && !data.invalidTenant ? <InstitutionFollowups key={`${filters.tenant}:${mode}`} appSlug={appSlug} appId={data.access.appId} tenant={filters.tenant} tenantName={data.tenants.find(tenant => tenant.id === filters.tenant)?.name ?? "所选机构"} topic={mode} /> : <p className="app-muted-text text-sm">选择具体机构后，可记录处理进度和复查结果。</p>)}
  </div>;
}
