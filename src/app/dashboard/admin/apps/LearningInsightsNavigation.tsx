import Link from "next/link";
import type { ManagementAppAccess } from "@/lib/management-apps";

export function LearningInsightsNavigation({ access, section }: { access: ManagementAppAccess; section: string }) {
  if (access.app.kind !== "learning" || !["grades", "records", "conversation", "settings"].includes(section)) return null;
  const items = [
    { key: "grades", title: "成绩分析", allowed: access.capabilities.viewAnalytics },
    { key: "records", title: "学习记录", allowed: access.capabilities.viewAnalytics },
    { key: "conversation", title: "会话与课堂", allowed: access.capabilities.manageAssessments },
    { key: "settings", title: "应用设置", allowed: access.capabilities.manageTenantAvailability },
  ];
  return <nav aria-label="学情与设置" className="mb-4 flex flex-wrap gap-2 border-b pb-3">{items.filter(item => item.allowed).map(item => <Link key={item.key} href={`${access.appPath}/${item.key}`} aria-current={section === item.key ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-lg border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${section === item.key ? "bg-[var(--foreground)] text-[var(--background)]" : "hover:bg-[var(--surface-soft)]"}`}>{item.title}</Link>)}</nav>;
}
