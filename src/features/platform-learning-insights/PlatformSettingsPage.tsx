import { PlatformSettingEditor } from "./PlatformSettingEditor";
import Link from "next/link";
import { requireManagementAppAccess } from "@/lib/management-apps";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import { ManagementNotice } from "@/components/layout/management-page";
import { getPlatformAppDirectory } from "./service";
import type { SearchParams } from "./model";

export async function PlatformSettingsPage({ appSlug, searchParams }: { appSlug: string; searchParams: SearchParams }) {
  const access = await requireManagementAppAccess("platform", appSlug);
  if (access.scope !== "platform" || !access.capabilities.manageTenantAvailability) throw new Error("当前账号没有应用设置权限。");
  const first = (key: string) => { const value = searchParams[key]; return Array.isArray(value) ? value[0] : value; };
  const search = (first("q") ?? "").trim().slice(0, 80);
  const state = ["open", "closed", "coming_soon", "hidden"].includes(first("state") ?? "") ? first("state")! : "all";
  const directory = await getPlatformAppDirectory(access.appId).then(rows => ({ rows, hasError: false })).catch(() => ({ rows: [], hasError: true }));
  const { rows: registrations, hasError } = directory;
  const rows = registrations.flatMap(row => {
    const tenant = Array.isArray(row.tenant) ? row.tenant[0] : row.tenant;
    if (!tenant) return [];
    const effective = tenant.status !== "active" || !row.is_enabled ? "closed" : access.app.status !== "active" ? access.app.status : row.status === "active" ? "open" : row.status;
    return [{ ...row, tenant, effective }];
  });
  const filtered = rows.filter(row => (!search || `${row.tenant.name} ${row.custom_title ?? ""}`.toLowerCase().includes(search.toLowerCase())) && (state === "all" || row.effective === state)).sort((a, b) => a.tenant.name.localeCompare(b.tenant.name, "zh-CN"));
  const page = Math.min(Math.max(1, Math.floor(Number(first("page")) || 1)), Math.max(1, Math.ceil(filtered.length / 20)));
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const pageHref = (value: number) => `?${new URLSearchParams({ q: search, state, page: String(value) })}`;
  const labels: Record<string, string> = { active: "运行中", open: "已开放", closed: "已停用", coming_soon: "建设中", hidden: "已隐藏" };
  const capabilities = [
    ["机构开放设置", access.capabilities.manageTenantAvailability],
    ["学生与教学分配", access.capabilities.manageStudents],
    ["课程内容管理", access.capabilities.manageContent],
    ["教学与考核管理", access.capabilities.manageAssessments],
    ["学情分析", access.capabilities.viewAnalytics],
  ] as const;
  return <div className="space-y-4">
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="app-card border p-4">
        <CardTitleWithHint headingLevel={2} title="应用运行规则" description="平台标准应用状态由平台配置统一维护。机构可设置自己的显示名称、运行状态与启停开关；机构关闭不删除历史学习记录。" titleClassName="text-sm font-semibold" />
        <dl className="mt-2 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="app-muted-text">平台应用</dt><dd>{access.app.title}</dd></div><div className="flex justify-between gap-3"><dt className="app-muted-text">平台状态</dt><dd>{labels[access.app.status] ?? access.app.status}</dd></div><div className="flex justify-between gap-3"><dt className="app-muted-text">已注册机构</dt><dd>{hasError ? "暂不可用" : rows.length}</dd></div><div className="flex justify-between gap-3"><dt className="app-muted-text">实际开放机构</dt><dd>{hasError ? "暂不可用" : rows.filter(row => row.effective === "open").length}</dd></div></dl>
      </section>
      <section className="app-card border p-4">
        <CardTitleWithHint headingLevel={2} title="当前账号权限" description="以下权限根据当前平台角色计算。平台开放设置权限允许调整机构应用状态，不包含学生个案管理权限。" titleClassName="text-sm font-semibold" />
        <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-2">{capabilities.map(([label, enabled]) => <div key={label} className="flex justify-between gap-2 border-b pb-2"><dt>{label}</dt><dd className="font-medium">{enabled ? "已授权" : "未授权"}</dd></div>)}</dl>
      </section>
    </div>
    <section className="app-card min-w-0 border p-4">
      <CardTitleWithHint headingLevel={2} title="机构开放清单" description="实际开放需要机构运行中、平台应用运行中、机构应用运行中且启用开关打开。平台负责人和副负责人可调整机构应用设置，保存时记录变更并检查是否已被其他人修改。机构资料入口用于管理机构生命周期。" titleClassName="text-sm font-semibold" />
      <form method="get" className="mt-2 flex flex-wrap items-end gap-3"><label className="flex min-w-40 flex-1 flex-col gap-1 text-sm">机构或显示名称<input name="q" defaultValue={search} maxLength={80} className="app-input h-11 border px-3" placeholder="输入名称搜索" /></label><label className="flex flex-col gap-1 text-sm">实际状态<select name="state" defaultValue={state} className="app-input h-11 border px-3"><option value="all">全部状态</option><option value="open">已开放</option><option value="closed">已停用</option><option value="coming_soon">建设中</option><option value="hidden">已隐藏</option></select></label><button type="submit" className="min-h-11 bg-[var(--primary)] px-4 text-sm text-white">应用筛选</button><Link href={`${access.appPath}/settings`} className="inline-flex min-h-11 items-center border px-4 text-sm">重置</Link></form>
      {hasError ? <ManagementNotice tone="warning">机构开放状态暂时无法读取，请稍后刷新。</ManagementNotice> : <>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><caption className="sr-only">机构应用开放状态</caption><thead><tr className="border-b bg-[var(--surface-soft)]">{["机构", "显示名称", "启用开关", "机构应用状态", "实际状态", "管理入口"].map(label => <th key={label} scope="col" className="px-3 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{filtered.slice((page - 1) * 20, page * 20).map(row => <tr key={row.tenant_id} className="border-b"><th scope="row" className="px-3 py-3 font-medium">{row.tenant.name}</th><td className="px-3 py-3">{row.custom_title || access.app.title}</td><td className="px-3 py-3">{row.is_enabled ? "开启" : "关闭"}</td><td className="px-3 py-3">{labels[row.status] ?? row.status}</td><td className="px-3 py-3">{labels[row.effective] ?? row.effective}{row.tenant.status !== "active" && <span className="app-muted-text block text-xs">机构未运行</span>}</td><td className="px-3 py-3"><PlatformSettingEditor appSlug={appSlug} tenantId={row.tenant_id} name={row.tenant.name} enabled={row.is_enabled} status={row.status} customTitle={row.custom_title} updatedAt={row.updated_at} /><Link className="inline-flex min-h-11 items-center text-[var(--primary)] underline" href={`${access.dashboardBasePath}/admin/tenants/${row.tenant_id}`}>机构资料</Link></td></tr>)}{!filtered.length && <tr><td colSpan={6} className="app-muted-text py-8 text-center">{rows.length ? "没有符合筛选条件的机构。" : "暂无机构注册此应用。"}</td></tr>}</tbody></table></div>
        <nav aria-label="机构开放清单分页" className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm"><span>{filtered.length} 家机构 · 第 {page} / {pages} 页</span><div className="flex gap-3">{page > 1 && <Link href={pageHref(page - 1)} className="inline-flex min-h-11 items-center border px-3">上一页</Link>}{page < pages && <Link href={pageHref(page + 1)} className="inline-flex min-h-11 items-center border px-3">下一页</Link>}</div></nav>
      </>}
    </section>
  </div>;
}
