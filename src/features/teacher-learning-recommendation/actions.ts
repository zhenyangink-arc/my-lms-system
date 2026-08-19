"use server";

import { z } from "zod";

import { requireActiveUser } from "@/lib/auth";
import {
  createTeacherLearningRecommendation,
  withdrawTeacherLearningRecommendation,
} from "./api/service";
import {
  TEACHER_RECOMMENDATION_SOURCE_TYPES,
  type TeacherRecommendationActionResult,
} from "./types";

const baseCreateSchema = z.object({
  studentAppId: z.uuid(),
  sourceType: z.enum(TEACHER_RECOMMENDATION_SOURCE_TYPES),
  sourceId: z.uuid(),
  title: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(1).max(2_000),
  isRequired: z.boolean(),
  startsAt: z.iso.datetime({ offset: true }).optional(),
  dueAt: z.iso.datetime({ offset: true }),
});

const createSchema = z.discriminatedUnion("targetScope", [
  baseCreateSchema.extend({
    targetScope: z.literal("class"),
    classId: z.uuid(),
  }).strict(),
  baseCreateSchema.extend({
    targetScope: z.literal("student"),
    studentId: z.uuid(),
  }).strict(),
]).superRefine((input, context) => {
  const startsAt = input.startsAt ? Date.parse(input.startsAt) : Date.now();
  if (Date.parse(input.dueAt) <= startsAt) {
    context.addIssue({
      code: "custom",
      path: ["dueAt"],
      message: "截止时间必须晚于开始时间。",
    });
  }
});

const recommendationIdSchema = z.uuid();

async function requireTeacherRecommendationContext() {
  const { supabase, tenant, profile, user } = await requireActiveUser();
  if (!tenant?.id || profile?.role !== "teacher") return null;
  return { supabase, tenant, user };
}

/** teacher_id 只取服务端已验证会话；严格输入 schema 会拒绝额外身份字段。 */
export async function createTeacherLearningRecommendationAction(
  input: unknown,
): Promise<TeacherRecommendationActionResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "推荐目标、内容、原因或时间无效。" };
  }
  const context = await requireTeacherRecommendationContext();
  if (!context) {
    return { ok: false, message: "只有当前机构的老师账号可以创建推荐。" };
  }

  try {
    const recommendation = await createTeacherLearningRecommendation({
      supabase: context.supabase,
      tenantId: context.tenant.id,
      teacherId: context.user.id,
      space: context.tenant.slug,
      input: parsed.data,
    });
    return { ok: true, recommendation };
  } catch {
    return { ok: false, message: "推荐创建失败，请核对负责范围和推荐内容。" };
  }
}

/** 只接收推荐 id；归属、尚未开始和状态转换由服务层过滤并由 RLS/触发器复核。 */
export async function withdrawTeacherLearningRecommendationAction(
  input: unknown,
): Promise<TeacherRecommendationActionResult> {
  const parsed = recommendationIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "推荐编号无效，请刷新后重试。" };
  }
  const context = await requireTeacherRecommendationContext();
  if (!context) {
    return { ok: false, message: "只有当前机构的老师账号可以撤回推荐。" };
  }

  try {
    const recommendation = await withdrawTeacherLearningRecommendation({
      supabase: context.supabase,
      tenantId: context.tenant.id,
      teacherId: context.user.id,
      recommendationId: parsed.data,
      space: context.tenant.slug,
    });
    return { ok: true, recommendation };
  } catch {
    return { ok: false, message: "推荐已开始、已撤回或不在你的负责范围内。" };
  }
}
