"use server";

import { z } from "zod";

import { refreshStudentHomeLearningData } from "@/features/student-home-learning/api/refresh";
import { isPlatformCourseAuditorRole } from "@/lib/admin";
import { requireActiveUser } from "@/lib/auth";
import {
  canUseStudentFeature,
  normalizeMembershipTier,
} from "@/lib/student-permissions";
import { STUDENT_APP_IDS } from "@/lib/student-apps";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  submitSmartTextbookActivityForContext,
  type SmartTextbookSubmitResult,
} from "./smart-textbook-submission";

const preferenceSchema = z.object({
  textbookId: z.string().uuid(),
  locale: z.enum(["zh-CN", "ko-KR"]),
  supportMode: z.enum(["chinese", "bilingual", "immersion"]),
});

const pageCheckSchema = z.object({
  activityId: z.string().uuid(),
  itemIndices: z.array(z.number().int().nonnegative()).min(1).max(3),
  response: z.array(z.union([z.number().int().nonnegative(), z.string()])),
});

export async function checkSmartTextbookActivityPageAction(input: unknown) {
  const parsed = pageCheckSchema.safeParse(input);
  if (!parsed.success || parsed.data.response.length !== parsed.data.itemIndices.length) {
    return { ok: false as const, message: "本页作答内容无效。" };
  }
  const { supabase, profile, platformProfile } = await requireActiveUser();
  if (
    !isPlatformCourseAuditorRole(platformProfile?.role) &&
    !canUseStudentFeature(
      profile?.role ?? "student",
      normalizeMembershipTier(profile?.membership_tier),
      "korean_course",
    )
  ) {
    return { ok: false as const, message: "当前账号没有智能教材学习权限。" };
  }
  const { data: activity } = await supabase
    .from("digital_textbook_activities")
    .select("id,activity_type")
    .eq("id", parsed.data.activityId)
    .maybeSingle();
  if (!activity) return { ok: false as const, message: "找不到这项练习。" };
  const { data: secret } = await createAdminClient()
    .from("digital_textbook_activity_secrets")
    .select("answer_key")
    .eq("activity_id", activity.id)
    .maybeSingle();
  const answerKey = secret?.answer_key as { kind?: string; value?: unknown } | null;
  const expected = Array.isArray(answerKey?.value) ? answerKey.value : [];
  if (
    !["index_array", "text_array"].includes(String(answerKey?.kind)) ||
    parsed.data.itemIndices.some((index) => index >= expected.length)
  ) {
    return { ok: false as const, message: "练习的判定配置尚未完成。" };
  }
  const answers = parsed.data.itemIndices.map((index) => expected[index] as number | string);
  const normalize = (value: number | string) => typeof value === "string"
    ? value.normalize("NFC").trim().replace(/\s+/gu, " ")
    : value;
  return {
    ok: true as const,
    results: parsed.data.response.map((value, index) => normalize(value) === normalize(answers[index])),
    answers,
  };
}

export async function saveSmartTextbookPreferenceAction(input: unknown) {
  const parsed = preferenceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "设置内容无效。" };

  const { supabase, user, tenant, profile, platformProfile } =
    await requireActiveUser();
  if (isPlatformCourseAuditorRole(platformProfile?.role)) {
    return { ok: true, message: "平台预览模式仅在当前浏览器中切换。" };
  }
  if (!tenant) return { ok: false, message: "当前账号没有可用的学习空间。" };
  if (
    !canUseStudentFeature(
      profile?.role ?? "student",
      normalizeMembershipTier(profile?.membership_tier),
      "korean_course",
    )
  ) {
    return { ok: false, message: "当前账号没有智能教材学习权限。" };
  }

  const { data: textbook } = await supabase
    .from("digital_textbooks")
    .select("id")
    .eq("id", parsed.data.textbookId)
    .eq("status", "published")
    .maybeSingle();
  if (!textbook) return { ok: false, message: "教材不存在或尚未发布。" };

  const admin = createAdminClient();
  const { error } = await admin.from("digital_textbook_preferences").upsert(
    {
      tenant_id: tenant.id,
      student_id: user.id,
      textbook_id: parsed.data.textbookId,
      interface_locale: parsed.data.locale,
      support_mode: parsed.data.supportMode,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,student_id,textbook_id" },
  );

  return error
    ? { ok: false, message: "设置暂时没有保存，请稍后再试。" }
    : { ok: true, message: "学习语言偏好已保存。" };
}

export async function submitSmartTextbookActivityAction(
  input: unknown,
): Promise<SmartTextbookSubmitResult> {
  const { supabase, user, tenant, profile, platformProfile } =
    await requireActiveUser();
  const preview = isPlatformCourseAuditorRole(platformProfile?.role);

  const result = await submitSmartTextbookActivityForContext(input, {
    supabase,
    admin: createAdminClient(),
    userId: user.id,
    tenantId: tenant?.id ?? null,
    canSubmit: canUseStudentFeature(
      profile?.role ?? "student",
      normalizeMembershipTier(profile?.membership_tier),
      "korean_course",
    ),
    preview,
  });
  if (result.ok && !preview && tenant?.id) {
    refreshStudentHomeLearningData({
      tenantId: tenant.id,
      studentId: user.id,
      studentAppId: STUDENT_APP_IDS.korean,
    });
  }
  return result;
}
