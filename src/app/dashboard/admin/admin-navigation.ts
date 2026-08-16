import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ChartNoAxesCombined,
  BellRing,
  BookOpenCheck,
  Headphones,
  KeyRound,
  LayoutGrid,
  PanelsTopLeft,
  Library,
  Users,
} from "lucide-react";

import type { UserRole } from "@/lib/admin";

export type AdminNavigationItem = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  group: "overview" | "teaching" | "content" | "service" | "support" | "organization";
  roles: UserRole[];
  color: string;
  softColor: string;
  requiresConversationPracticeAccess?: boolean;
  requiresAnnouncementAccess?: boolean;
  requiresHelpCenterAccess?: boolean;
  requiresGradeCenterAccess?: boolean;
  requiresLearningRecordAccess?: boolean;
  requiresLibraryAccess?: boolean;
  requiresDocumentReviewAccess?: boolean;
  requiresTenantManagementAccess?: boolean;
  requiresQuestionBankAccess?: boolean;
  requiresVisaManagementAccess?: boolean;
  requiresStudentAssignmentAccess?: boolean;
};

const allStaffRoles: UserRole[] = ["teacher", "admin", "ceo", "tenant_super_admin", "platform_super_admin"];
const applicationCenterRoles: UserRole[] = [...allStaffRoles, "tenant_operator"];
const adminRoles: UserRole[] = ["admin", "ceo", "tenant_super_admin", "platform_super_admin"];
const helpCenterRoles: UserRole[] = ["teacher", "ceo", "tenant_super_admin", "platform_super_admin"];
const executiveRoles: UserRole[] = ["ceo", "tenant_super_admin", "platform_super_admin"];
const tenantManagerRoles: UserRole[] = ["platform_super_admin", "tenant_operator"];
const courseInspectorRoles: UserRole[] = ["platform_course_inspector"];

export const ADMIN_NAVIGATION: AdminNavigationItem[] = [
  {
    label: "应用中心",
    description: "按韩语、英语、数学、大学课程和留学服务进入独立运营空间。",
    href: "/dashboard/admin/apps",
    icon: PanelsTopLeft,
    group: "overview",
    roles: applicationCenterRoles,
    color: "var(--app-accent)",
    softColor: "var(--app-accent-soft)",
  },
  {
    label: "课程前台巡检",
    description: "以只读巡检模式进入全部已发布课程，不受学生端课程限制。",
    href: "/dashboard/courses",
    icon: BookOpenCheck,
    group: "overview",
    roles: courseInspectorRoles,
    color: "var(--app-accent)",
    softColor: "var(--app-accent-soft)",
  },
  {
    label: "模型用量",
    description: "查看智能对话的输入、输出和总用量。",
    href: "/dashboard/admin/token-usage",
    icon: ChartNoAxesCombined,
    group: "organization",
    roles: executiveRoles,
    color: "var(--app-warm)",
    softColor: "var(--app-warm-soft)",
  },
  {
    label: "管理首页",
    description: "查看当前身份可用的全部管理模块。",
    href: "/dashboard/admin",
    icon: LayoutGrid,
    group: "overview",
    roles: allStaffRoles,
    color: "var(--app-accent)",
    softColor: "var(--app-accent-soft)",
  },
  {
    label: "通知公告管理",
    description: "起草、发布、修改和归档学生端通知公告。",
    href: "/dashboard/admin/announcements",
    icon: BellRing,
    group: "support",
    roles: adminRoles,
    color: "var(--app-accent)",
    softColor: "var(--app-accent-soft)",
    requiresAnnouncementAccess: true,
  },
  {
    label: "帮助中心管理",
    description: "维护帮助文章，接收、回复和处理学生求助。",
    href: "/dashboard/admin/help",
    icon: Headphones,
    group: "support",
    roles: helpCenterRoles,
    color: "var(--app-success)",
    softColor: "var(--app-success-soft)",
    requiresHelpCenterAccess: true,
  },
  {
    label: "资料库管理",
    description: "平台统一维护资料；机构以表格查看并下载已发布内容。",
    href: "/dashboard/admin/library",
    icon: Library,
    group: "content",
    roles: adminRoles,
    color: "var(--app-success)",
    softColor: "var(--app-success-soft)",
    requiresLibraryAccess: true,
  },
  {
    label: "账号管理",
    description: "管理账号角色、状态与运营权限。",
    href: "/dashboard/admin/accounts",
    icon: Users,
    group: "organization",
    roles: executiveRoles,
    color: "var(--app-secondary)",
    softColor: "var(--app-secondary-soft)",
  },
  {
    label: "租户管理",
    description: "开通和查看多个独立组织的租户。",
    href: "/dashboard/admin/tenants",
    icon: Building2,
    group: "organization",
    roles: tenantManagerRoles,
    color: "var(--app-warm)",
    softColor: "var(--app-warm-soft)",
    requiresTenantManagementAccess: true,
  },
  {
    label: "权限中心",
    description: "查看并更改平台与各机构在 Supabase 中的实际模块授权。",
    href: "/dashboard/admin/permissions",
    icon: KeyRound,
    group: "organization",
    roles: ["platform_super_admin"],
    color: "var(--app-accent)",
    softColor: "var(--app-accent-soft)",
  },
];

export const ADMIN_GROUP_LABELS: Record<AdminNavigationItem["group"], string> = {
  overview: "工作台",
  teaching: "教学与学生",
  content: "内容中心",
  service: "留学服务",
  support: "消息与支持",
  organization: "平台与组织",
};

export function getVisibleAdminNavigation(
  role: UserRole,
  options: {
    canManageConversationPractice?: boolean;
    canAccessAnnouncements?: boolean;
    canManageHelpCenter?: boolean;
    canManageGradeCenter?: boolean;
    canManageLearningRecords?: boolean;
    canManageLibrary?: boolean;
    canManageDocumentReviews?: boolean;
    canManageTenants?: boolean;
    canAccessQuestionBank?: boolean;
    canManageVisas?: boolean;
    canManageStudentAssignments?: boolean;
  } = {}
) {
  // 应用业务只能从应用中心进入；这里保留真正跨应用的支持与组织模块。
  return ADMIN_NAVIGATION.filter(
    (item) =>
      item.roles.includes(role) &&
      (!item.requiresConversationPracticeAccess || options.canManageConversationPractice === true) &&
      (!item.requiresAnnouncementAccess || options.canAccessAnnouncements === true) &&
      (!item.requiresHelpCenterAccess || options.canManageHelpCenter === true) &&
      (!item.requiresGradeCenterAccess || options.canManageGradeCenter === true) &&
      (!item.requiresLearningRecordAccess || options.canManageLearningRecords === true) &&
      (!item.requiresLibraryAccess || options.canManageLibrary === true) &&
      (!item.requiresDocumentReviewAccess || options.canManageDocumentReviews === true) &&
      (!item.requiresTenantManagementAccess || options.canManageTenants === true) &&
      (!item.requiresQuestionBankAccess || options.canAccessQuestionBank === true) &&
      (!item.requiresVisaManagementAccess || options.canManageVisas === true) &&
      (!item.requiresStudentAssignmentAccess ||
        options.canManageStudentAssignments === true ||
        role === "tenant_super_admin" ||
        role === "platform_super_admin")
  );
}

export function getAdminRoleLabel(role: UserRole) {
  if (role === "platform_super_admin") return "平台负责人";
  if (role === "platform_course_inspector") return "平台课程巡检员";
  if (role === "tenant_super_admin") return "机构负责人";
  if (role === "tenant_operator") return "副负责人";
  if (role === "ceo") return "运营负责人";
  if (role === "admin") return "管理员";
  if (role === "teacher") return "教师";
  return "学生";
}
