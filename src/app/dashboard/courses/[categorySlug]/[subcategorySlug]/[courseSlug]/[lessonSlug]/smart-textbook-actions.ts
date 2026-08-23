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

const dialogueRoleplayCompletionSchema = z.object({
  activityId: z.string().uuid(),
  sceneId: z.string().min(1).max(80),
  roleSide: z.enum(["left", "right"]),
});

export async function completeDialogueRoleplayAction(input: unknown) {
  const parsed = dialogueRoleplayCompletionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "角色实战信息无效。" };
  const { supabase, user, tenant, profile, platformProfile } = await requireActiveUser();
  const preview = isPlatformCourseAuditorRole(platformProfile?.role);
  if (!tenant || (!preview && !canUseStudentFeature(
    profile?.role ?? "student",
    normalizeMembershipTier(profile?.membership_tier),
    "korean_course",
  ))) return { ok: false as const, message: "当前账号没有智能教材学习权限。" };

  const { data: activity } = await supabase
    .from("digital_textbook_activities")
    .select("id,node_id,public_config")
    .eq("id", parsed.data.activityId)
    .maybeSingle();
  if (!activity || activity.public_config?.practiceKind !== "dialogue_roleplay") {
    return { ok: false as const, message: "找不到角色实战活动。" };
  }

  const admin = createAdminClient();
  const { data: node } = await admin
    .from("digital_textbook_nodes")
    .select("id,content,digital_textbook_modules!inner(digital_textbook_chapters!inner(version_id))")
    .eq("id", activity.node_id)
    .maybeSingle();
  const content = node?.content && typeof node.content === "object" && !Array.isArray(node.content)
    ? node.content as Record<string, unknown>
    : {};
  const scenes = Array.isArray(content.dialogueScenes) ? content.dialogueScenes : [];
  const scene = scenes.find((item) => item && typeof item === "object" && String((item as Record<string, unknown>).id) === parsed.data.sceneId) as Record<string, unknown> | undefined;
  const lines = Array.isArray(scene?.lines) ? scene.lines : [];
  const roleParity = parsed.data.roleSide === "left" ? 0 : 1;
  const requiredTurns = lines.map((_, index) => index).filter((index) => index % 2 === roleParity);
  if (requiredTurns.length === 0) return { ok: false as const, message: "当前角色没有可录制的话轮。" };

  const { data: evidence } = await admin
    .from("digital_textbook_speaking_evidence")
    .select("id,metadata")
    .eq("tenant_id", tenant.id)
    .eq("student_id", user.id)
    .eq("activity_id", activity.id)
    .contains("metadata", { sceneId: parsed.data.sceneId, roleSide: parsed.data.roleSide });
  const recordedTurns = new Set((evidence ?? []).map((item) => Number(item.metadata?.turnIndex)));
  if (!requiredTurns.every((turn) => recordedTurns.has(turn))) {
    return { ok: false as const, message: "请完成当前角色的全部录音话轮。" };
  }
  if (preview) return { ok: true as const, preview: true, nodeId: String(activity.node_id), nodeCompleted: false, completionPercent: 0 };

  const moduleRelation = node?.digital_textbook_modules as unknown as { digital_textbook_chapters?: { version_id?: string } } | null;
  const versionId = String(moduleRelation?.digital_textbook_chapters?.version_id ?? "");
  if (!versionId) return { ok: false as const, message: "教材版本关系不完整。" };
  const { data: existingAttempt } = await admin
    .from("digital_textbook_attempts")
    .select("attempt_number")
    .eq("tenant_id", tenant.id)
    .eq("student_id", user.id)
    .eq("activity_id", activity.id)
    .eq("version_id", versionId)
    .eq("meets_completion_requirements", true)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingAttempt) {
    const { data: progress } = await admin
      .from("digital_textbook_node_progress")
      .select("status,completion_percent")
      .eq("tenant_id", tenant.id)
      .eq("student_id", user.id)
      .eq("node_id", activity.node_id)
      .eq("version_id", versionId)
      .maybeSingle();
    return {
      ok: true as const,
      preview: false,
      nodeId: String(activity.node_id),
      nodeCompleted: progress?.status === "completed" || Number(progress?.completion_percent) === 100,
      completionPercent: Math.max(0, Math.min(100, Number(progress?.completion_percent) || 0)),
    };
  }
  const { data: recordData, error } = await admin.rpc("record_smart_textbook_attempt", {
    p_tenant_id: tenant.id,
    p_student_id: user.id,
    p_activity_id: activity.id,
    p_version_id: versionId,
    p_response: { sceneId: parsed.data.sceneId, roleSide: parsed.data.roleSide, recordedTurns: requiredTurns },
    // Open speaking evidence completes the activity without inventing correctness or a score.
    p_is_correct: null,
    p_score: null,
    p_meets_completion_requirements: true,
  });
  const record = Array.isArray(recordData) ? recordData[0] : recordData;
  if (error || !record) return { ok: false as const, message: "角色实战进度暂时没有保存，请重试。" };
  await admin
    .from("digital_textbook_speaking_evidence")
    .update({ consumed_at: new Date().toISOString(), consumed_attempt_number: Number(record.attempt_number) })
    .in("id", (evidence ?? []).filter((item) => requiredTurns.includes(Number(item.metadata?.turnIndex))).map((item) => item.id));
  refreshStudentHomeLearningData({ tenantId: tenant.id, studentId: user.id, studentAppId: STUDENT_APP_IDS.korean });
  return {
    ok: true as const,
    preview: false,
    nodeId: String(activity.node_id),
    nodeCompleted: record.node_completed === true,
    completionPercent: Math.max(0, Math.min(100, Number(record.completion_percent) || 0)),
  };
}

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
