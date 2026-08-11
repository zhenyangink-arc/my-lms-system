/**
 * 账号权限兼容入口。
 *
 * 新代码统一从 features/accounts 引用；旧账号组件暂时通过这里继续工作，
 * 避免迁移期间形成两套角色顺序和范围判断。
 */
export {
  ROLE_ORDER,
  ROLE_LABELS,
  STATUS_LABELS,
  getAssignableRoles,
  canManageTarget,
  type AppRole,
} from "@/features/accounts/constants/account-options";

export type { AccountScope } from "@/features/accounts/api/types";
