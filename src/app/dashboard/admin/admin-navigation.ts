import type { LucideIcon } from "lucide-react";
import {
  Award,
  Building2,
  ChartNoAxesCombined,
  BellRing,
  BookOpenCheck,
  ClipboardCheck,
  Files,
  GraduationCap,
  Headphones,
  History,
  LayoutGrid,
  Library,
  MessagesSquare,
  ShieldCheck,
  Users,
} from "lucide-react";

import type { UserRole } from "@/lib/admin";

export type AdminNavigationItem = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  group: "overview" | "teaching" | "service" | "organization";
  roles: UserRole[];
  color: string;
  softColor: string;
  requiresConversationPracticeAccess?: boolean;
  requiresAnnouncementAccess?: boolean;
  requiresHelpCenterAccess?: boolean;
  requiresGradeCenterAccess?: boolean;
  requiresLearningRecordAccess?: boolean;
  requiresLibraryAccess?: boolean;
  requiresTenantManagementAccess?: boolean;
};

const allStaffRoles: UserRole[] = ["teacher", "admin", "ceo", "tenant_super_admin", "platform_super_admin"];
const adminRoles: UserRole[] = ["admin", "ceo", "tenant_super_admin", "platform_super_admin"];
const executiveRoles: UserRole[] = ["ceo", "tenant_super_admin", "platform_super_admin"];
const tenantManagerRoles: UserRole[] = ["platform_super_admin", "tenant_operator"];

export const ADMIN_NAVIGATION: AdminNavigationItem[] = [
  {
    label: "Token 用量",
    description: "查看 AI 对话的输入、输出和总 Token 消耗。",
    href: "/dashboard/admin/token-usage",
    icon: ChartNoAxesCombined,
    group: "overview",
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
    label: "作业考试管理",
    description: "布置任务、查看提交并逐题批改。",
    href: "/dashboard/admin/assignments",
    icon: ClipboardCheck,
    group: "teaching",
    roles: allStaffRoles,
    color: "var(--app-accent)",
    softColor: "var(--app-accent-soft)",
  },
  {
    label: "会话练习管理",
    description: "创建情景会话、发布练习并查看学生复盘数据。",
    href: "/dashboard/admin/conversation-practice",
    icon: MessagesSquare,
    group: "teaching",
    roles: adminRoles,
    color: "var(--app-secondary)",
    softColor: "var(--app-secondary-soft)",
    requiresConversationPracticeAccess: true,
  },
  {
    label: "通知公告管理",
    description: "起草、发布、修改和归档学生端通知公告。",
    href: "/dashboard/admin/announcements",
    icon: BellRing,
    group: "organization",
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
    group: "organization",
    roles: adminRoles,
    color: "var(--app-success)",
    softColor: "var(--app-success-soft)",
    requiresHelpCenterAccess: true,
  },
  {
    label: "成绩管理",
    description: "录入、发布学生成绩并处理成绩复核申请。",
    href: "/dashboard/admin/grades",
    icon: Award,
    group: "teaching",
    roles: adminRoles,
    color: "var(--app-warm)",
    softColor: "var(--app-warm-soft)",
    requiresGradeCenterAccess: true,
  },
  {
    label: "学习记录管理",
    description: "维护学生辅导记录、阶段评价与后续学习计划。",
    href: "/dashboard/admin/records",
    icon: History,
    group: "teaching",
    roles: adminRoles,
    color: "var(--app-accent)",
    softColor: "var(--app-accent-soft)",
    requiresLearningRecordAccess: true,
  },
  {
    label: "资料库管理",
    description: "上传和整理学习资料，控制发布状态并查看获取情况。",
    href: "/dashboard/admin/library",
    icon: Library,
    group: "teaching",
    roles: adminRoles,
    color: "var(--app-success)",
    softColor: "var(--app-success-soft)",
    requiresLibraryAccess: true,
  },
  {
    label: "课程管理",
    description: "维护课程结构、课时内容与学习资源。",
    href: "/dashboard/admin/courses",
    icon: BookOpenCheck,
    group: "teaching",
    roles: adminRoles,
    color: "var(--app-secondary)",
    softColor: "var(--app-secondary-soft)",
  },
  {
    label: "韩国大学管理",
    description: "新增韩国大学、维护学费与排名，数据会同步到学生端学校库。",
    href: "/dashboard/admin/universities",
    icon: GraduationCap,
    group: "service",
    roles: adminRoles,
    color: "var(--app-secondary)",
    softColor: "var(--app-secondary-soft)",
  },
  {
    label: "资料审核",
    description: "审核学生申请材料与历史提交版本。",
    href: "/dashboard/admin/documents",
    icon: Files,
    group: "service",
    roles: adminRoles,
    color: "var(--app-warm)",
    softColor: "var(--app-warm-soft)",
  },
  {
    label: "签证管理",
    description: "跟进签证档案、任务状态与审核意见。",
    href: "/dashboard/admin/visa",
    icon: ShieldCheck,
    group: "service",
    roles: adminRoles,
    color: "var(--app-success)",
    softColor: "var(--app-success-soft)",
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
];

export const ADMIN_GROUP_LABELS: Record<AdminNavigationItem["group"], string> = {
  overview: "总览",
  teaching: "教学运营",
  service: "留学服务",
  organization: "组织权限",
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
    canManageTenants?: boolean;
  } = {}
) {
  return ADMIN_NAVIGATION.filter(
    (item) =>
      item.roles.includes(role) &&
      (!item.requiresConversationPracticeAccess || options.canManageConversationPractice === true) &&
      (!item.requiresAnnouncementAccess || options.canAccessAnnouncements === true) &&
      (!item.requiresHelpCenterAccess || options.canManageHelpCenter === true) &&
      (!item.requiresGradeCenterAccess || options.canManageGradeCenter === true) &&
      (!item.requiresLearningRecordAccess || options.canManageLearningRecords === true) &&
      (!item.requiresLibraryAccess || options.canManageLibrary === true) &&
      (!item.requiresTenantManagementAccess || options.canManageTenants === true)
  );
}

export function getAdminRoleLabel(role: UserRole) {
  if (role === "platform_super_admin") return "平台负责人";
  if (role === "tenant_super_admin") return "机构负责人";
  if (role === "tenant_operator") return "副负责人";
  if (role === "ceo") return "运营负责人";
  if (role === "admin") return "管理员";
  if (role === "teacher") return "教师";
  return "学生";
}
