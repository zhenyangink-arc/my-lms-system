import { z } from "zod";

import { isValidLoginId, normalizeLoginId } from "@/lib/login-id";

const loginIdSchema = z
  .string()
  .transform((value) => normalizeLoginId(value))
  .refine(isValidLoginId, {
    message: "登录账号只能使用 3 至 32 位小写字母、数字、短横线或下划线。",
  });

const initialPasswordSchema = z
  .string()
  .min(8, "初始密码需为 8 至 72 位，并同时包含字母和数字。")
  .max(72, "初始密码需为 8 至 72 位，并同时包含字母和数字。")
  .refine((value) => /[A-Za-z]/.test(value) && /[0-9]/.test(value), {
    message: "初始密码需为 8 至 72 位，并同时包含字母和数字。",
  });

const fullNameSchema = z
  .string()
  .trim()
  .min(2, "姓名需要填写 2 至 50 个字符。")
  .max(50, "姓名需要填写 2 至 50 个字符。");

export const createManagedAccountSchema = z.object({
  full_name: fullNameSchema,
  login_id: loginIdSchema,
  initial_password: initialPasswordSchema,
  role: z.enum(["teacher", "student"], {
    message: "这里只能创建员工或学生账号。",
  }),
  tenant_id: z.string().trim(),
});

export const createPlatformAccountSchema = z.object({
  full_name: fullNameSchema,
  login_id: loginIdSchema,
  initial_password: initialPasswordSchema,
  role: z.enum(
    ["platform_deputy", "platform_admin", "platform_course_inspector"],
    {
      message: "平台账号只能设为平台副负责人、平台管理员或平台课程巡检员。",
    },
  ),
});

export const updateAccountRoleSchema = z.object({
  role: z.string().trim().min(1, "请选择账号角色。"),
});

export const updateAccountStatusSchema = z
  .object({
    status: z.enum(["active", "inactive", "suspended"], {
      message: "请选择有效的账号状态。",
    }),
    deactivate_reason: z
      .string()
      .trim()
      .max(300, "状态原因不能超过 300 个字。"),
  })
  .refine(
    (value) => value.status === "active" || Boolean(value.deactivate_reason),
    {
      message: "暂停或停用账号时必须填写原因。",
      path: ["deactivate_reason"],
    },
  );

export const updateMembershipTierSchema = z.object({
  membership_tier: z.enum(["normal", "vip1", "vip2", "vip3"], {
    message: "请选择有效的学生会员档位。",
  }),
});

export const deleteAccountSchema = z.object({
  confirmation: z.string().trim(),
  deletion_reason: z
    .string()
    .trim()
    .min(2, "删除原因需要填写 2 至 300 个字。")
    .max(300, "删除原因需要填写 2 至 300 个字。"),
});

export type CreateManagedAccountValues = z.infer<
  typeof createManagedAccountSchema
>;
export type CreatePlatformAccountValues = z.infer<
  typeof createPlatformAccountSchema
>;
export type UpdateAccountRoleValues = z.infer<typeof updateAccountRoleSchema>;
export type UpdateAccountStatusValues = z.infer<
  typeof updateAccountStatusSchema
>;
export type UpdateMembershipTierValues = z.infer<
  typeof updateMembershipTierSchema
>;
export type DeleteAccountValues = z.infer<typeof deleteAccountSchema>;
