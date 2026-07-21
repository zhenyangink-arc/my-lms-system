import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Layers3, LockKeyhole, PanelsTopLeft, ShieldCheck, Sparkles } from "lucide-react";

import { isAssignmentManagerRole } from "@/lib/learning-assignments";
import { getConversationPracticeAccess } from "@/lib/conversation-practice";
import { getAnnouncementAccess } from "@/lib/announcements";
import { getHelpCenterAccess } from "@/lib/help-center";
import { getGradeCenterAccess } from "@/lib/grade-center";
import { getLearningRecordAccess } from "@/lib/learning-records";
import { getLibraryAccess } from "@/lib/resource-library";
import { requireActiveUser } from "@/lib/auth";
import { isPlatformTenantManagerRole, isValidRole } from "@/lib/admin";
import { getDashboardBasePath, scopeDashboardPath } from "@/lib/dashboard-path";
import {
  ADMIN_GROUP_LABELS,
  getAdminRoleLabel,
  getVisibleAdminNavigation,
} from "./admin-navigation";


export const runtime = "edge";
export default async function AdminCenterPage() {
  const auth = await requireActiveUser();
  const role = auth.platformProfile?.role === "platform_super_admin" ? "platform_super_admin" : auth.profile?.role;
  if (!isValidRole(role) || (!isAssignmentManagerRole(role) && !isPlatformTenantManagerRole(role))) {
    redirect("/dashboard");
  }

  const [conversationAccess, announcementAccess, helpAccess, gradeAccess, recordAccess, libraryAccess] = await Promise.all([
    getConversationPracticeAccess(),
    getAnnouncementAccess(),
    getHelpCenterAccess(),
    getGradeCenterAccess(),
    getLearningRecordAccess(),
    getLibraryAccess(),
  ]);
  const visibleItems = getVisibleAdminNavigation(role, {
    canManageConversationPractice: conversationAccess.canManage,
    canAccessAnnouncements: announcementAccess.canAccess,
    canManageHelpCenter: helpAccess.canManage,
    canManageGradeCenter: gradeAccess.canManage,
    canManageLearningRecords: recordAccess.canManage,
    canManageLibrary: libraryAccess.canManage,
    canManageTenants: isPlatformTenantManagerRole(auth.platformProfile?.role),
  }).filter((item) => item.group !== "overview");
  const dashboardBasePath = getDashboardBasePath(auth.tenant?.slug);
  const groups = ["teaching", "service", "organization"] as const;

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <section className="app-card overflow-hidden rounded-3xl border p-5 sm:p-6" style={{ background: "linear-gradient(125deg, var(--app-hero-start), var(--app-card-bg), var(--app-accent-soft))" }}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-end">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><PanelsTopLeft size={15} />管理中心</span>
            <h1 className="mt-3 text-2xl font-black tracking-tight">把管理工作集中到一个清晰入口</h1>
            <p className="app-muted-text mt-2 max-w-2xl text-sm leading-6">课程、教学任务、院校服务与账号权限按业务分组。左侧管理导航可以随时收起，为内容操作留出更多空间。</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="app-card rounded-2xl border p-4"><Layers3 size={19} style={{ color: "var(--app-accent)" }} /><p className="mt-3 text-2xl font-black">{visibleItems.length}</p><p className="app-muted-text mt-1 text-xs font-bold">当前可用模块</p></div>
            <div className="app-card rounded-2xl border p-4"><ShieldCheck size={19} style={{ color: "var(--app-success)" }} /><p className="mt-3 text-lg font-black">{getAdminRoleLabel(role)}</p><p className="app-muted-text mt-1 text-xs font-bold">当前管理身份</p></div>
          </div>
        </div>
      </section>

      {groups.map((group) => {
        const items = visibleItems.filter((item) => item.group === group);
        if (items.length === 0) return null;
        return (
          <section key={group} className="space-y-4">
            <div><h2 className="text-xl font-black">{ADMIN_GROUP_LABELS[group]}</h2><p className="app-muted-text mt-1 text-xs">选择模块进入对应工作台。</p></div>
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={scopeDashboardPath(item.href, dashboardBasePath)} className="app-card group rounded-3xl border p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
                    <div className="flex items-start gap-4">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ color: item.color, backgroundColor: item.softColor }}><Icon size={22} /></span>
                      <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h3 className="text-lg font-black">{item.label}</h3><ArrowRight className="shrink-0 transition group-hover:translate-x-1" size={17} /></div><p className="app-muted-text mt-2 text-xs leading-5">{item.description}</p></div>
                    </div>
                    <div className="mt-5 flex items-center justify-between border-t pt-4 text-xs font-black" style={{ borderColor: "var(--app-border-soft)", color: item.color }}><span>进入管理</span><Sparkles size={14} /></div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className="app-soft-card flex items-start gap-3 rounded-2xl border p-4 text-xs leading-5 app-muted-text"><LockKeyhole className="mt-0.5 shrink-0" size={16} /><p>页面入口和服务端权限使用同一角色规则。未授权模块不会显示，直接输入地址也会被原有服务端检查拦截。</p></section>
    </div>
  );
}
