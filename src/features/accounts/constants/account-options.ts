import type { AccountScope } from "../api/types";

export const ROLE_ORDER = [
  "platform_deputy",
  "platform_admin",
  "platform_course_inspector",
  "tenant_super_admin",
  "ceo",
  "admin",
  "teacher",
  "student",
] as const;

export type AppRole = (typeof ROLE_ORDER)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  platform_deputy: "平台副负责人",
  platform_admin: "平台管理员",
  platform_course_inspector: "平台课程巡检员",
  tenant_super_admin: "机构负责人",
  ceo: "CEO",
  admin: "管理员",
  teacher: "老师",
  student: "学生",
};

export const STATUS_LABELS: Record<string, string> = {
  active: "正常",
  inactive: "已停用",
  suspended: "暂停",
};

export const TENANT_ROLE_FILTERS = [
  { value: "all", label: "全部账号" },
  { value: "ceo", label: "负责人" },
  { value: "admin", label: "管理员" },
  { value: "teacher", label: "老师" },
  { value: "student", label: "学生" },
] as const;

export const PLATFORM_ROLE_FILTERS = [
  { value: "all", label: "全部平台账号" },
  { value: "platform_deputy", label: "平台副负责人" },
  { value: "platform_admin", label: "平台管理员" },
  { value: "platform_course_inspector", label: "平台课程巡检员" },
] as const;

export const STATUS_FILTERS = [
  { value: "all", label: "全部状态" },
  { value: "active", label: "正常" },
  { value: "inactive", label: "已停用" },
  { value: "suspended", label: "暂停" },
] as const;

export const MEMBERSHIP_FILTERS = [
  { value: "all", label: "全部会员档位" },
  { value: "normal", label: "普通学生" },
  { value: "vip1", label: "一级会员学生" },
  { value: "vip2", label: "二级会员学生" },
  { value: "vip3", label: "三级会员学生" },
] as const;

export const PROFILE_FILTERS = [
  { value: "all", label: "全部资料状态" },
  { value: "started", label: "资料已建档" },
  { value: "pending", label: "等待完善资料" },
] as const;

export const SORT_OPTIONS = [
  { value: "newest", label: "最新注册" },
  { value: "oldest", label: "最早注册" },
  { value: "name", label: "按姓名" },
  { value: "activity", label: "最近活跃" },
] as const;

export const GROUP_LABELS: Record<string, string> = {
  platform_deputy: "平台副负责人",
  platform_admin: "平台管理员",
  platform_course_inspector: "平台课程巡检员",
  ceo: "运营负责人",
  admin: "管理员",
  teacher: "老师",
  student: "学生",
};

export const PLATFORM_ROLE_TONES: Record<
  string,
  { color: string; backgroundColor: string }
> = {
  platform_deputy: {
    color: "var(--status-warning)",
    backgroundColor: "var(--status-warning-surface)",
  },
  platform_admin: {
    color: "var(--primary-hover)",
    backgroundColor: "var(--accent)",
  },
  platform_course_inspector: {
    color: "var(--support)",
    backgroundColor: "var(--surface-soft)",
  },
};

export const TENANT_ROLE_TONES: Record<
  string,
  { color: string; backgroundColor: string }
> = {
  ceo: {
    color: "var(--status-warning)",
    backgroundColor: "var(--status-warning-surface)",
  },
  admin: {
    color: "var(--primary-hover)",
    backgroundColor: "var(--accent)",
  },
  teacher: {
    color: "var(--support)",
    backgroundColor: "var(--surface-soft)",
  },
  student: {
    color: "var(--status-success)",
    backgroundColor: "var(--status-success-surface)",
  },
};

export const ACCOUNT_STATUS_TONES: Record<
  string,
  { dot: string; text: string }
> = {
  active: { dot: "var(--status-success)", text: "var(--status-success)" },
  inactive: {
    dot: "var(--foreground-subtle)",
    text: "var(--foreground-muted)",
  },
  suspended: { dot: "var(--status-warning)", text: "var(--status-warning)" },
};

export function getAssignableRoles(
  viewerRole: string,
  scope: AccountScope,
): AppRole[] {
  if (scope === "platform") {
    return viewerRole === "platform_super_admin"
      ? ["platform_deputy", "platform_admin", "platform_course_inspector"]
      : [];
  }

  if (viewerRole === "tenant_super_admin") {
    return ["ceo", "admin", "teacher", "student"];
  }

  if (viewerRole === "ceo") {
    return ["admin", "teacher", "student"];
  }

  return [];
}

export function canManageTarget(
  viewerRole: string,
  targetRole: string,
  scope: AccountScope,
) {
  if (scope === "platform") {
    return (
      viewerRole === "platform_super_admin" &&
      (targetRole === "platform_deputy" ||
        targetRole === "platform_admin" ||
        targetRole === "platform_course_inspector")
    );
  }

  if (viewerRole === "tenant_super_admin") {
    return targetRole !== "tenant_super_admin";
  }

  if (viewerRole === "ceo") {
    return targetRole !== "tenant_super_admin" && targetRole !== "ceo";
  }

  return false;
}
