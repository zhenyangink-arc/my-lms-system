export const ROLE_ORDER = [
  "platform_deputy",
  "platform_admin",
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

/*
  平台和机构角色不能复用：
  - 平台负责人只能分配平台副负责人、平台管理员。
  - 机构负责人可以分配 CEO、管理员、老师、学生。
  - CEO 只能分配管理员、老师、学生。
*/
export type AccountScope = "platform" | "tenant";

export function getAssignableRoles(
  viewerRole: string,
  scope: AccountScope
): AppRole[] {
  if (scope === "platform") {
    return viewerRole === "platform_super_admin"
      ? ["platform_deputy", "platform_admin"]
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

/*
  前端按钮和服务端动作共用同一套范围判断；服务端还会验证账号是否
  具有当前机构成员关系，或是否属于无机构成员关系的平台账号。
*/
export function canManageTarget(
  viewerRole: string,
  targetRole: string,
  scope: AccountScope
) {
  if (scope === "platform") {
    return (
      viewerRole === "platform_super_admin" &&
      (targetRole === "platform_deputy" || targetRole === "platform_admin")
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
