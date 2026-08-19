"use server";

import { z } from "zod";

import { refreshStudentHomeLearning } from "@/features/student-home-learning/api/refresh";
import { requireActiveUser } from "@/lib/auth";
import {
  STUDENT_APP_IDS,
  type StudentAppSlug,
} from "@/lib/student-apps";
import {
  loadCurrentStudentWeeklyPlan,
  saveCurrentStudentWeeklyPlan,
} from "./api/service";
import type { StudentWeeklyLearningPlanSummary } from "./types";

const studentAppIdSchema = z.uuid();
const planInputSchema = z
  .object({
    studentAppId: studentAppIdSchema,
    targetDays: z.number().int().min(1).max(7),
    targetMinutes: z.number().int().min(1).max(10_080),
    preferredDays: z
      .array(z.number().int().min(1).max(7))
      .max(7)
      .default([]),
  })
  .superRefine((input, context) => {
    if (new Set(input.preferredDays).size !== input.preferredDays.length) {
      context.addIssue({
        code: "custom",
        path: ["preferredDays"],
        message: "偏好学习日不能重复。",
      });
    }
    if (input.preferredDays.length > input.targetDays) {
      context.addIssue({
        code: "custom",
        path: ["preferredDays"],
        message: "偏好学习日不能多于目标学习天数。",
      });
    }
  });

export type StudentWeeklyPlanActionResult =
  | { ok: true; summary: StudentWeeklyLearningPlanSummary }
  | { ok: false; message: string };

function appSlugForId(studentAppId: string): StudentAppSlug | null {
  const entry = Object.entries(STUDENT_APP_IDS).find(
    ([, appId]) => appId === studentAppId,
  );
  return (entry?.[0] as StudentAppSlug | undefined) ?? null;
}

async function requireStudentPlanContext(studentAppId: string) {
  const { supabase, tenant, profile, user } = await requireActiveUser();
  if (!tenant?.id || profile?.role !== "student") {
    return null;
  }
  const appSlug = appSlugForId(studentAppId);
  if (!appSlug) return null;
  return { supabase, tenant, user, appSlug };
}

/** 读取身份始终来自服务端会话；客户端只选择应用，不能指定 student_id。 */
export async function getCurrentStudentWeeklyPlanAction(
  input: unknown,
): Promise<StudentWeeklyPlanActionResult> {
  const parsed = studentAppIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "学习应用编号无效，请刷新后重试。" };
  }
  const context = await requireStudentPlanContext(parsed.data);
  if (!context) {
    return { ok: false, message: "只有当前机构的学生账号可以查看周计划。" };
  }
  try {
    const summary = await loadCurrentStudentWeeklyPlan({
      supabase: context.supabase,
      tenantId: context.tenant.id,
      studentId: context.user.id,
      studentAppId: parsed.data,
    });
    return { ok: true, summary };
  } catch {
    return { ok: false, message: "本周学习目标读取失败，请稍后重试。" };
  }
}

/** 当前周使用 upsert 调整；周起点及 student_id 均不接受客户端输入。 */
export async function setCurrentStudentWeeklyPlanAction(
  input: unknown,
): Promise<StudentWeeklyPlanActionResult> {
  const parsed = planInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "学习天数、分钟目标或偏好日期无效。" };
  }
  const context = await requireStudentPlanContext(parsed.data.studentAppId);
  if (!context) {
    return { ok: false, message: "只有当前机构的学生账号可以设置周计划。" };
  }

  try {
    const now = new Date();
    await saveCurrentStudentWeeklyPlan({
      supabase: context.supabase,
      tenantId: context.tenant.id,
      studentId: context.user.id,
      studentAppId: parsed.data.studentAppId,
      targetDays: parsed.data.targetDays,
      targetMinutes: parsed.data.targetMinutes,
      preferredDays: [...parsed.data.preferredDays].sort((a, b) => a - b),
      now,
    });
    const summary = await loadCurrentStudentWeeklyPlan({
      supabase: context.supabase,
      tenantId: context.tenant.id,
      studentId: context.user.id,
      studentAppId: parsed.data.studentAppId,
      now,
    });
    refreshStudentHomeLearning({
      tenantId: context.tenant.id,
      studentId: context.user.id,
      studentAppId: parsed.data.studentAppId,
      appSlug: context.appSlug,
      space: context.tenant.slug,
    });
    return { ok: true, summary };
  } catch {
    return { ok: false, message: "本周学习目标保存失败，请稍后重试。" };
  }
}
