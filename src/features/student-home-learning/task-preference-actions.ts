"use server";

import { z } from "zod";

import { requireActiveUser } from "@/lib/auth";
import {
  STUDENT_APP_IDS,
  type StudentAppSlug,
} from "@/lib/student-apps";
import { refreshStudentHomeLearning } from "./api/refresh";
import {
  restoreStudentLearningTask,
  snoozeStudentLearningTask,
  STUDENT_TASK_SNOOZE_OPTIONS,
} from "./api/task-preference-service";
import { HOME_LEARNING_SOURCE_TYPES } from "./api/types";

const taskPreferenceIdentityShape = {
  studentAppId: z.uuid(),
  taskKey: z.string().min(1).max(500),
} as const;

function validateTaskPreferenceIdentity(
  input: { studentAppId: string; taskKey: string },
  context: z.RefinementCtx,
) {
  const prefix = `${input.studentAppId}:`;
  const remainder = input.taskKey.startsWith(prefix)
    ? input.taskKey.slice(prefix.length)
    : "";
  const separator = remainder.indexOf(":");
  const sourceType = separator < 0 ? "" : remainder.slice(0, separator);
  const sourceId = separator < 0 ? "" : remainder.slice(separator + 1);
  if (
    !input.taskKey.startsWith(prefix) ||
    !HOME_LEARNING_SOURCE_TYPES.includes(
      sourceType as (typeof HOME_LEARNING_SOURCE_TYPES)[number],
    ) ||
    !sourceId
  ) {
    context.addIssue({
      code: "custom",
      path: ["taskKey"],
      message: "任务标识格式无效。",
    });
  }
}

const taskPreferenceIdentitySchema = z
  .object(taskPreferenceIdentityShape)
  .strict()
  .superRefine(validateTaskPreferenceIdentity);

const snoozeSchema = z
  .object({
    ...taskPreferenceIdentityShape,
    option: z.enum(STUDENT_TASK_SNOOZE_OPTIONS),
  })
  .strict()
  .superRefine(validateTaskPreferenceIdentity);

export type StudentTaskPreferenceActionResult =
  | { ok: true }
  | { ok: false; message: string };

function appSlugForId(studentAppId: string): StudentAppSlug | null {
  const entry = Object.entries(STUDENT_APP_IDS).find(
    ([, appId]) => appId === studentAppId,
  );
  return (entry?.[0] as StudentAppSlug | undefined) ?? null;
}

async function requireStudentTaskPreferenceContext(studentAppId: string) {
  const { supabase, tenant, profile, user } = await requireActiveUser();
  const appSlug = appSlugForId(studentAppId);
  if (!tenant?.id || profile?.role !== "student" || !appSlug) return null;
  return { supabase, tenant, user, appSlug };
}

function refreshPreferenceScope(
  context: NonNullable<
    Awaited<ReturnType<typeof requireStudentTaskPreferenceContext>>
  >,
  studentAppId: string,
) {
  refreshStudentHomeLearning({
    tenantId: context.tenant.id,
    studentId: context.user.id,
    studentAppId,
    appSlug: context.appSlug,
    space: context.tenant.slug,
  });
}

/** 学生身份只取服务端会话；数据库触发器最终复核并拒绝所有必做来源。 */
export async function snoozeStudentLearningTaskAction(
  input: unknown,
): Promise<StudentTaskPreferenceActionResult> {
  const parsed = snoozeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "任务标识或提醒时间无效。" };
  }
  const context = await requireStudentTaskPreferenceContext(
    parsed.data.studentAppId,
  );
  if (!context) {
    return { ok: false, message: "只有当前机构的学生可以暂缓学习建议。" };
  }

  try {
    await snoozeStudentLearningTask({
      supabase: context.supabase,
      tenantId: context.tenant.id,
      studentId: context.user.id,
      ...parsed.data,
    });
    refreshPreferenceScope(context, parsed.data.studentAppId);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("必做任务不可暂缓")) {
      return { ok: false, message: "必做任务和截止提醒不能暂缓。" };
    }
    return { ok: false, message: "暂缓失败，请刷新任务后重试。" };
  }
}

export async function restoreStudentLearningTaskAction(
  input: unknown,
): Promise<StudentTaskPreferenceActionResult> {
  const parsed = taskPreferenceIdentitySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "任务标识无效。" };
  }
  const context = await requireStudentTaskPreferenceContext(
    parsed.data.studentAppId,
  );
  if (!context) {
    return { ok: false, message: "只有当前机构的学生可以恢复学习建议。" };
  }

  try {
    await restoreStudentLearningTask({
      supabase: context.supabase,
      tenantId: context.tenant.id,
      studentId: context.user.id,
      ...parsed.data,
    });
    refreshPreferenceScope(context, parsed.data.studentAppId);
    return { ok: true };
  } catch {
    return { ok: false, message: "恢复失败，请稍后重试。" };
  }
}
