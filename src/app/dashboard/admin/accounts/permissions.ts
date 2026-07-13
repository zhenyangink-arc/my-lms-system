export const ROLE_ORDER = [
  "super_admin",
  "ceo",
  "admin",
  "teacher",
  "student",
] as const;

export type AppRole = (typeof ROLE_ORDER)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "老板",
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
  当前登录者（viewerRole）可以把账号改成哪些角色。

  注意：super_admin（老板）不会出现在这个数组里，
  不管是老板自己还是 CEO 在操作，都不能通过这个页面把人改成老板。
  老板身份只能通过数据库手动设置，不走这个 UI。

  老板 super_admin → 可以改成 CEO / 管理员 / 老师 / 学生
  CEO ceo          → 只能改成 管理员 / 老师 / 学生
  其他角色         → 不会进到这个页面，返回空数组兜底
*/
export function getAssignableRoles(viewerRole: string): AppRole[] {
  if (viewerRole === "super_admin") {
    return ["ceo", "admin", "teacher", "student"];
  }

  if (viewerRole === "ceo") {
    return ["admin", "teacher", "student"];
  }

  return [];
}

/*
  当前登录者（viewerRole）能不能管理目标账号（targetRole）。

  老板 → 能管理所有人（但老板本来就不会出现在列表里，这条其实用不到）
  CEO  → 不能管理老板、不能管理其他 CEO

  注意：这个函数只用来在前端隐藏按钮，
  真正的安全边界是 SQL 21 里的 RLS policy。
*/
export function canManageTarget(viewerRole: string, targetRole: string) {
  if (viewerRole === "super_admin") {
    return true;
  }

  if (viewerRole === "ceo") {
    return targetRole !== "super_admin" && targetRole !== "ceo";
  }

  return false;
}