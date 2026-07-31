import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Info, Layers3, LockKeyhole, PanelsTopLeft, ShieldCheck } from "lucide-react";

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
      <section className="app-card rounded-3xl border p-5 sm:p-6" style={{ background: "linear-gradient(125deg, var(--app-hero-start), var(--app-card-bg), var(--app-accent-soft))" }}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><PanelsTopLeft size={15} />管理中心</span>
            <div className="group relative mt-3 flex w-fit items-center gap-1.5">
              <h1 className="text-2xl font-black tracking-tight">把管理工作集中到一个清晰入口</h1>
              <Info className="app-muted-text shrink-0 cursor-help" size={15} />
              <div className="invisible absolute left-0 top-full z-20 w-72 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100">
                <div role="tooltip" className="app-card rounded-2xl border p-3 text-xs leading-5 app-muted-text shadow-lg">
                  课程、教学任务、院校服务与账号权限按业务分组。左侧管理导航可以随时收起，为内容操作留出更多空间。
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="app-card rounded-xl border p-2.5">
              <div className="flex items-center gap-2"><Layers3 size={15} style={{ color: "var(--app-accent)" }} /><p className="text-base font-black">{visibleItems.length}</p></div>
              <p className="app-muted-text mt-1 text-[11px] font-bold">当前可用模块</p>
            </div>
            <div className="app-card rounded-xl border p-2.5">
              <div className="flex items-center gap-2"><ShieldCheck size={15} style={{ color: "var(--app-success)" }} /><p className="truncate text-base font-black">{getAdminRoleLabel(role)}</p></div>
              <p className="app-muted-text mt-1 text-[11px] font-bold">当前管理身份</p>
            </div>
          </div>
        </div>
      </section>

      {groups.map((group) => {
        const items = visibleItems.filter((item) => item.group === group);
        if (items.length === 0) return null;
        return (
          <section key={group} className="space-y-3">
            <h2 className="text-lg font-black">{ADMIN_GROUP_LABELS[group]}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={scopeDashboardPath(item.href, dashboardBasePath)} className="app-card group flex items-center gap-3 rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-lg">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ color: item.color, backgroundColor: item.softColor }}><Icon size={18} /></span>
                    <div className="flex min-w-0 flex-1 items-center gap-1">
                      <h3 className="min-w-0 truncate text-sm font-black">{item.label}</h3>
                      <span className="group/info relative shrink-0">
                        <Info className="app-muted-text cursor-help" size={13} />
                        <div className="invisible absolute right-0 top-full z-20 w-64 pt-2 opacity-0 transition group-hover/info:visible group-hover/info:opacity-100">
                          <div role="tooltip" className="app-card rounded-2xl border p-3 text-left text-xs leading-5 app-muted-text shadow-lg">
                            {item.description}
                          </div>
                        </div>
                      </span>
                      <ArrowRight className="ml-auto shrink-0 transition group-hover:translate-x-1" size={15} style={{ color: item.color }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="group relative inline-flex items-center gap-1.5">
        <LockKeyhole className="app-muted-text shrink-0" size={13} />
        <span className="app-muted-text cursor-help text-xs font-bold">权限说明</span>
        <div className="invisible absolute bottom-full left-0 z-20 w-80 pb-2 opacity-0 transition group-hover:visible group-hover:opacity-100">
          <div role="tooltip" className="app-card rounded-2xl border p-3 text-xs leading-5 app-muted-text shadow-lg">
            页面入口和服务端权限使用同一角色规则。未授权模块不会显示，直接输入地址也会被原有服务端检查拦截。
          </div>
        </div>
      </div>
    </div>
  );
}
