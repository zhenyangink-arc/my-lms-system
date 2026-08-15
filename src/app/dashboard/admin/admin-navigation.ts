import type { LucideIcon } from "lucide-react";
import {
  Award,
  Building2,
  ChartNoAxesCombined,
  BellRing,
  BookOpenCheck,
  ClipboardCheck,
  Files,
  FolderTree,
  GraduationCap,
  Headphones,
  History,
  KeyRound,
  LayoutGrid,
  PanelsTopLeft,
  Library,
  LibraryBig,
  MessagesSquare,
  ShieldCheck,
  Users,
  UsersRound,
  UserRoundCheck,
  Wrench,
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
  requiresDocumentReviewAccess?: boolean;
  requiresTenantManagementAccess?: boolean;
  requiresQuestionBankAccess?: boolean;
  requiresVisaManagementAccess?: boolean;
  requiresStudentAssignmentAccess?: boolean;
  /** 旧版平铺入口保留路由兼容，但主导航改由应用中心承载。 */
  legacyApplicationEntry?: boolean;
};

const allStaffRoles: UserRole[] = ["teacher", "admin", "ceo", "tenant_super_admin", "platform_super_admin"];
const assessmentPaperRoles: UserRole[] = [...allStaffRoles, "tenant_operator"];
const applicationCenterRoles: UserRole[] = [...allStaffRoles, "tenant_operator"];
const adminRoles: UserRole[] = ["admin", "ceo", "tenant_super_admin", "platform_super_admin"];
const helpCenterRoles: UserRole[] = ["teacher", "ceo", "tenant_super_admin", "platform_super_admin"];
const gradeOverviewRoles: UserRole[] = ["admin", "ceo", "tenant_super_admin", "platform_super_admin"];
// 教学类模块：老师也能进入（数据按自己负责的学生过滤）。
const teachingOverviewRoles: UserRole[] = ["teacher", ...gradeOverviewRoles];
const executiveRoles: UserRole[] = ["ceo", "tenant_super_admin", "platform_super_admin"];
const tenantManagerRoles: UserRole[] = ["platform_super_admin", "tenant_operator"];
const questionBankRoles: UserRole[] = [
  "platform_super_admin",
  "tenant_operator",
];
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
    label: "课程树管理",
    description: "配置成长首页课程树展示哪些分类与课程（分类与课程都开启才显示）。",
    href: "/dashboard/admin/home-tree",
    icon: FolderTree,
    group: "overview",
    roles: adminRoles,
    color: "var(--app-secondary)",
    softColor: "var(--app-secondary-soft)",
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
    roles: assessmentPaperRoles,
    color: "var(--app-accent)",
    softColor: "var(--app-accent-soft)",
    legacyApplicationEntry: true,
  },
  {
    label: "平台标准题库",
    description: "仅平台维护标准题目，并用于制作完整标准试卷。",
    href: "/dashboard/admin/question-bank",
    icon: LibraryBig,
    group: "teaching",
    roles: questionBankRoles,
    color: "var(--app-secondary)",
    softColor: "var(--app-secondary-soft)",
    requiresQuestionBankAccess: true,
  },
  {
    label: "会话练习管理",
    description: "创建情景会话、发布练习并查看学生复盘数据。",
    href: "/dashboard/admin/conversation-practice",
    icon: MessagesSquare,
    group: "teaching",
    roles: teachingOverviewRoles,
    color: "var(--app-secondary)",
    softColor: "var(--app-secondary-soft)",
    requiresConversationPracticeAccess: true,
    legacyApplicationEntry: true,
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
    roles: helpCenterRoles,
    color: "var(--app-success)",
    softColor: "var(--app-success-soft)",
    requiresHelpCenterAccess: true,
  },
  {
    label: "学生管理",
    description: "把学生划给负责老师，查看老师名下学生名单。",
    href: "/dashboard/admin/student-assignments",
    icon: UsersRound,
    group: "organization",
    roles: ["admin", "tenant_super_admin", "platform_super_admin"],
    color: "var(--app-accent)",
    softColor: "var(--app-accent-soft)",
    requiresStudentAssignmentAccess: true,
    legacyApplicationEntry: true,
  },
  {
    label: "我的学生",
    description: "查看机构负责人分配给你负责的学生名单。",
    href: "/dashboard/admin/my-students",
    icon: UserRoundCheck,
    group: "teaching",
    roles: ["teacher"],
    color: "var(--app-accent)",
    softColor: "var(--app-accent-soft)",
    legacyApplicationEntry: true,
  },
  {
    label: "成绩管理",
    description: "平台查看机构汇总，机构端处理真实成绩与复核。",
    href: "/dashboard/admin/grades",
    icon: Award,
    group: "teaching",
    roles: teachingOverviewRoles,
    color: "var(--app-warm)",
    softColor: "var(--app-warm-soft)",
    requiresGradeCenterAccess: true,
    legacyApplicationEntry: true,
  },
  {
    label: "学习记录管理",
    description: "平台查看机构汇总，机构端维护辅导记录与学习计划。",
    href: "/dashboard/admin/records",
    icon: History,
    group: "teaching",
    roles: teachingOverviewRoles,
    color: "var(--app-accent)",
    softColor: "var(--app-accent-soft)",
    requiresLearningRecordAccess: true,
    legacyApplicationEntry: true,
  },
  {
    label: "资料库管理",
    description: "平台统一维护资料；机构以表格查看并下载已发布内容。",
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
    legacyApplicationEntry: true,
  },
  {
    label: "互动教材管理",
    description: "维护互动教材章节、词汇与发布状态，内容同步到学生端。",
    href: "/dashboard/admin/digital-textbook",
    icon: BookOpenCheck,
    group: "teaching",
    roles: ["platform_super_admin", "tenant_operator"],
    color: "var(--app-accent)",
    softColor: "var(--app-accent-soft)",
    legacyApplicationEntry: true,
  },
  {
    label: "成长工具箱管理",
    description: "配置学生端成长工具箱的练习入口：名称、图标、颜色、排序与启停。",
    href: "/dashboard/admin/growth-toolbox",
    icon: Wrench,
    group: "teaching",
    roles: ["platform_super_admin", "tenant_operator"],
    color: "var(--app-warm)",
    softColor: "var(--app-warm-soft)",
    legacyApplicationEntry: true,
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
    legacyApplicationEntry: true,
  },
  {
    label: "资料审核",
    description: "按目标大学申请单核对资料进度、退回补充并保留审核记录。",
    href: "/dashboard/admin/documents",
    icon: Files,
    group: "service",
    roles: adminRoles,
    color: "var(--app-warm)",
    softColor: "var(--app-warm-soft)",
    requiresDocumentReviewAccess: true,
    legacyApplicationEntry: true,
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
    requiresVisaManagementAccess: true,
    legacyApplicationEntry: true,
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
    canManageDocumentReviews?: boolean;
    canManageTenants?: boolean;
    canAccessQuestionBank?: boolean;
    canManageVisas?: boolean;
    canManageStudentAssignments?: boolean;
  } = {}
) {
  return ADMIN_NAVIGATION.filter(
    (item) =>
      !item.legacyApplicationEntry &&
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
