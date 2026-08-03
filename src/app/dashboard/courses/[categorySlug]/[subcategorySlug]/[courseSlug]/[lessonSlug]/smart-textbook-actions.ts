"use server";

import { z } from "zod";

import { isPlatformCourseAuditorRole } from "@/lib/admin";
import { requireActiveUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const preferenceSchema = z.object({
  textbookId: z.string().uuid(),
  locale: z.enum(["zh-CN", "ko-KR"]),
  supportMode: z.enum(["chinese", "bilingual", "immersion"]),
});

const submitSchema = z.object({
  activityId: z.string().uuid(),
  response: z.unknown(),
  locale: z.enum(["zh-CN", "ko-KR"]),
});

type SubmitResult = {
  ok: boolean;
  correct: boolean | null;
  score: number | null;
  explanation: string;
  attemptNumber: number;
  preview: boolean;
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, "");
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function grade(answerKeyValue: unknown, response: unknown) {
  const answerKey = asObject(answerKeyValue);
  const kind = String(answerKey.kind ?? "open");
  const expected = answerKey.value;

  if (kind === "open") return { correct: null, score: null };
  if (kind === "index") {
    const correct = Number(response) === Number(expected);
    return { correct, score: correct ? 100 : 0 };
  }
  if (kind === "indices") {
    const given = Array.isArray(response) ? response.map(Number).sort() : [];
    const wanted = Array.isArray(expected) ? expected.map(Number).sort() : [];
    const correct = JSON.stringify(given) === JSON.stringify(wanted);
    return { correct, score: correct ? 100 : 0 };
  }
  if (kind === "order") {
    const given = Array.isArray(response) ? response.map(Number) : [];
    const wanted = Array.isArray(expected) ? expected.map(Number) : [];
    const correct = JSON.stringify(given) === JSON.stringify(wanted);
    return { correct, score: correct ? 100 : 0 };
  }
  if (kind === "text") {
    const correct = normalizeText(response) === normalizeText(expected);
    return { correct, score: correct ? 100 : 0 };
  }
  return { correct: null, score: null };
}

export async function saveSmartTextbookPreferenceAction(input: unknown) {
  const parsed = preferenceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "设置内容无效。" };

  const { user, tenant, platformProfile } = await requireActiveUser();
  if (isPlatformCourseAuditorRole(platformProfile?.role)) {
    return { ok: true, message: "平台预览模式仅在当前浏览器中切换。" };
  }
  if (!tenant) return { ok: false, message: "当前账号没有可用的学习空间。" };

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
    { onConflict: "tenant_id,student_id,textbook_id" }
  );

  return error
    ? { ok: false, message: "设置暂时没有保存，请稍后再试。" }
    : { ok: true, message: "学习语言偏好已保存。" };
}

export async function submitSmartTextbookActivityAction(
  input: unknown
): Promise<SubmitResult> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      correct: null,
      score: null,
      explanation: "提交内容无效。",
      attemptNumber: 0,
      preview: false,
    };
  }

  const { user, tenant, platformProfile } = await requireActiveUser();
  const admin = createAdminClient();
  const isPreview = isPlatformCourseAuditorRole(platformProfile?.role);

  const { data: activity, error: activityError } = await admin
    .from("digital_textbook_activities")
    .select("id,node_id,activity_type")
    .eq("id", parsed.data.activityId)
    .maybeSingle();
  if (activityError || !activity) {
    return {
      ok: false,
      correct: null,
      score: null,
      explanation: "找不到这项练习。",
      attemptNumber: 0,
      preview: isPreview,
    };
  }

  const [{ data: secret }, { data: node }] = await Promise.all([
    admin
      .from("digital_textbook_activity_secrets")
      .select("answer_key,explanation")
      .eq("activity_id", activity.id)
      .maybeSingle(),
    admin
      .from("digital_textbook_nodes")
      .select("id,module_id,digital_textbook_modules!inner(chapter_id,digital_textbook_chapters!inner(version_id))")
      .eq("id", activity.node_id)
      .maybeSingle(),
  ]);

  if (!secret || !node) {
    return {
      ok: false,
      correct: null,
      score: null,
      explanation: "练习的判定配置尚未完成。",
      attemptNumber: 0,
      preview: isPreview,
    };
  }

  const result = grade(secret.answer_key, parsed.data.response);
  const explanationObject = asObject(secret.explanation);
  const explanation = String(
    explanationObject[parsed.data.locale] ?? explanationObject["zh-CN"] ?? ""
  );

  if (isPreview) {
    return {
      ok: true,
      ...result,
      explanation,
      attemptNumber: 1,
      preview: true,
    };
  }

  if (!tenant) {
    return {
      ok: false,
      correct: null,
      score: null,
      explanation: "当前账号没有可用的学习空间。",
      attemptNumber: 0,
      preview: false,
    };
  }

  const nestedModules = asObject(node.digital_textbook_modules);
  const nestedChapter = asObject(nestedModules.digital_textbook_chapters);
  const versionId = String(nestedChapter.version_id ?? "");
  if (!versionId) {
    return {
      ok: false,
      correct: null,
      score: null,
      explanation: "教材版本关系不完整。",
      attemptNumber: 0,
      preview: false,
    };
  }

  const { count } = await admin
    .from("digital_textbook_attempts")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenant.id)
    .eq("student_id", user.id)
    .eq("activity_id", activity.id);
  const attemptNumber = (count ?? 0) + 1;

  const { error: attemptError } = await admin.from("digital_textbook_attempts").insert({
    tenant_id: tenant.id,
    student_id: user.id,
    activity_id: activity.id,
    version_id: versionId,
    attempt_number: attemptNumber,
    response: parsed.data.response ?? null,
    is_correct: result.correct,
    score: result.score,
  });
  if (attemptError) {
    return {
      ok: false,
      correct: null,
      score: null,
      explanation: "作答暂时没有保存，请重新提交。",
      attemptNumber,
      preview: false,
    };
  }

  const masteryScore =
    result.correct === true ? (attemptNumber === 1 ? 100 : 80) : result.correct === false ? 35 : 60;
  await admin.from("digital_textbook_node_progress").upsert(
    {
      tenant_id: tenant.id,
      student_id: user.id,
      node_id: activity.node_id,
      version_id: versionId,
      status: "completed",
      completion_percent: 100,
      mastery_score: masteryScore,
      attempt_count: attemptNumber,
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,student_id,node_id,version_id" }
  );

  return {
    ok: true,
    ...result,
    explanation,
    attemptNumber,
    preview: false,
  };
}
