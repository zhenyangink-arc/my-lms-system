import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export const smartTextbookSubmissionSchema = z.object({
  activityId: z.string().uuid(),
  response: z.unknown(),
  locale: z.enum(["zh-CN", "ko-KR"]),
});

export type SmartTextbookSubmissionInput = z.infer<
  typeof smartTextbookSubmissionSchema
>;

export type SmartTextbookSubmitResult = {
  ok: boolean;
  correct: boolean | null;
  score: number | null;
  explanation: string;
  attemptNumber: number;
  preview: boolean;
  nodeId: string | null;
  nodeCompleted: boolean;
  completionPercent: number;
};

type SubmissionContext = {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  userId: string;
  tenantId: string | null;
  canSubmit: boolean;
  preview: boolean;
};

type GradeResult =
  | {
      ok: true;
      correct: boolean | null;
      score: number | null;
      meetsCompletionRequirements?: boolean;
    }
  | { ok: false; error: string };

function invalidResponse(message: string): GradeResult {
  return { ok: false, error: `作答结构无效：${message}` };
}

function invalidAnswerConfig(): GradeResult {
  return { ok: false, error: "活动判定配置不匹配，提交已拒绝。" };
}

async function recordObjectiveAttemptWithoutRpc({
  context,
  activity,
  versionId,
  response,
  result,
}: {
  context: SubmissionContext;
  activity: {
    id: string;
    node_id: string;
    max_attempts: number | null;
  };
  versionId: string;
  response: unknown;
  result: Extract<GradeResult, { ok: true }>;
}) {
  const { data: priorAttempts, error: priorError } = await context.admin
    .from("digital_textbook_attempts")
    .select("attempt_number,is_correct")
    .eq("tenant_id", context.tenantId!)
    .eq("student_id", context.userId)
    .eq("activity_id", activity.id)
    .order("attempt_number", { ascending: false });
  if (priorError) return { data: null, error: priorError };

  const completedAttempt = priorAttempts?.find(
    (attempt) => attempt.is_correct === true,
  );
  if (completedAttempt) {
    const { data: progress, error: progressReadError } = await context.admin
      .from("digital_textbook_node_progress")
      .select("status,completion_percent,mastery_score,attempt_count")
      .eq("tenant_id", context.tenantId!)
      .eq("student_id", context.userId)
      .eq("node_id", activity.node_id)
      .eq("version_id", versionId)
      .maybeSingle();
    if (progressReadError) return { data: null, error: progressReadError };
    return {
      data: {
        attempt_number: Number(completedAttempt.attempt_number),
        node_completed: progress?.status === "completed",
        completion_percent: Number(progress?.completion_percent ?? 100),
        mastery_score: Number(progress?.mastery_score ?? 100),
        node_attempt_count: Number(progress?.attempt_count ?? priorAttempts.length),
      },
      error: null,
    };
  }

  const maxAttempts = Number(activity.max_attempts) || 3;
  if ((priorAttempts?.length ?? 0) >= maxAttempts) {
    return {
      data: null,
      error: { message: `MAX_ATTEMPTS_REACHED: ${maxAttempts}` },
    };
  }
  const nextAttempt = Number(priorAttempts?.[0]?.attempt_number ?? 0) + 1;
  const { error: insertError } = await context.admin
    .from("digital_textbook_attempts")
    .insert({
      tenant_id: context.tenantId!,
      student_id: context.userId,
      activity_id: activity.id,
      version_id: versionId,
      attempt_number: nextAttempt,
      response: response ?? null,
      is_correct: result.correct,
      score: result.score,
    });
  if (insertError) return { data: null, error: insertError };

  const { data: nodeActivities, error: activitiesError } = await context.admin
    .from("digital_textbook_activities")
    .select("id,activity_type")
    .eq("node_id", activity.node_id);
  if (activitiesError) return { data: null, error: activitiesError };

  const requiredIds = (nodeActivities ?? [])
    .filter((item) => OBJECTIVE_ACTIVITY_TYPES.has(String(item.activity_type)))
    .map((item) => String(item.id));
  const { data: nodeAttempts, error: nodeAttemptsError } = requiredIds.length
    ? await context.admin
        .from("digital_textbook_attempts")
        .select("activity_id,is_correct,score")
        .eq("tenant_id", context.tenantId!)
        .eq("student_id", context.userId)
        .eq("version_id", versionId)
        .in("activity_id", requiredIds)
    : { data: [], error: null };
  if (nodeAttemptsError) return { data: null, error: nodeAttemptsError };

  const completedIds = new Set(
    (nodeAttempts ?? [])
      .filter((attempt) => attempt.is_correct === true)
      .map((attempt) => String(attempt.activity_id)),
  );
  const bestScores = new Map<string, number>();
  for (const attempt of nodeAttempts ?? []) {
    if (attempt.score == null) continue;
    const id = String(attempt.activity_id);
    bestScores.set(id, Math.max(bestScores.get(id) ?? 0, Number(attempt.score)));
  }
  const totalRequired = requiredIds.length;
  const completionPercent = totalRequired === 0
    ? 0
    : Math.round((100 * completedIds.size) / totalRequired);
  const masteryScore = totalRequired === 0
    ? 0
    : Math.round(
        requiredIds.reduce((sum, id) => sum + (bestScores.get(id) ?? 0), 0) /
          totalRequired,
      );

  const { count: nodeAttemptCount, error: countError } = await context.admin
    .from("digital_textbook_attempts")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", context.tenantId!)
    .eq("student_id", context.userId)
    .eq("version_id", versionId)
    .in("activity_id", requiredIds.length > 0 ? requiredIds : [activity.id]);
  if (countError) return { data: null, error: countError };

  const nodeCompleted = totalRequired > 0 && completedIds.size === totalRequired;
  const timestamp = new Date().toISOString();
  const { error: progressError } = await context.admin
    .from("digital_textbook_node_progress")
    .upsert(
      {
        tenant_id: context.tenantId!,
        student_id: context.userId,
        node_id: activity.node_id,
        version_id: versionId,
        status: nodeCompleted ? "completed" : "in_progress",
        completion_percent: completionPercent,
        mastery_score: masteryScore,
        attempt_count: nodeAttemptCount ?? 0,
        last_activity_at: timestamp,
        updated_at: timestamp,
      },
      { onConflict: "tenant_id,student_id,node_id,version_id" },
    );
  if (progressError) return { data: null, error: progressError };

  return {
    data: {
      attempt_number: nextAttempt,
      node_completed: nodeCompleted,
      completion_percent: completionPercent,
      mastery_score: masteryScore,
      node_attempt_count: nodeAttemptCount ?? 0,
    },
    error: null,
  };
}

const OBJECTIVE_ACTIVITY_TYPES = new Set([
  "single_choice",
  "multiple_choice",
  "fill_blank",
  "ordering",
  "listening",
]);

const OPEN_ACTIVITY_TYPES = new Set(["speaking", "writing", "self_check"]);
const SPEAKING_RECORDING_BUCKET = "digital-textbook-student-recordings";
const MIN_SPEAKING_RECORDING_BYTES = 2_048;

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/gu, " ");
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIntegerInRange(value: unknown, upperBound: number) {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < upperBound
  );
}

function isStrictIntegerArray(
  value: unknown,
  upperBound: number,
): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((item) => isIntegerInRange(item, upperBound))
  );
}

function isStrictStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function finiteConfigNumber(
  config: Record<string, unknown>,
  key: string,
  fallback: number,
) {
  const value = Number(config[key] ?? fallback);
  return Number.isFinite(value) ? value : fallback;
}

function splitSentences(value: string) {
  return value
    .normalize("NFC")
    .split(/[.!?。！？]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function verifySpeakingRecordingEvidence(
  context: SubmissionContext,
  activityId: string,
  responseValue: unknown,
) {
  if (!context.tenantId || !isObject(responseValue)) return null;
  const evidenceId = responseValue.recordingEvidenceId;
  if (
    typeof evidenceId !== "string" ||
    !z.string().uuid().safeParse(evidenceId).success
  ) {
    return null;
  }

  const { data: evidence, error } = await context.admin
    .from("digital_textbook_speaking_evidence")
    .select("id,object_key,byte_size,mime_type,created_at,consumed_at")
    .eq("id", evidenceId)
    .eq("tenant_id", context.tenantId)
    .eq("student_id", context.userId)
    .eq("activity_id", activityId)
    .maybeSingle();
  if (
    error ||
    !evidence ||
    evidence.consumed_at ||
    Number(evidence.byte_size) < MIN_SPEAKING_RECORDING_BYTES ||
    Date.parse(String(evidence.created_at)) < Date.now() - 24 * 60 * 60 * 1_000
  ) {
    return null;
  }

  const prefix = `${context.tenantId}/${context.userId}/${activityId}`;
  const filename = String(evidence.object_key).slice(prefix.length + 1);
  if (
    String(evidence.object_key) !== `${prefix}/${filename}` ||
    !filename.startsWith(`${evidenceId}.`)
  ) {
    return null;
  }
  const { data: objects, error: metadataError } = await context.admin.storage
    .from(SPEAKING_RECORDING_BUCKET)
    .list(prefix, { search: filename, limit: 2 });
  const storedObject = objects?.find((item) => item.name === filename);
  const storedSize = Number(storedObject?.metadata?.size ?? 0);
  const storedMime = String(
    storedObject?.metadata?.mimetype ??
      storedObject?.metadata?.contentType ??
      "",
  ).split(";", 1)[0];
  if (
    metadataError ||
    !storedObject ||
    storedSize < MIN_SPEAKING_RECORDING_BYTES ||
    storedSize !== Number(evidence.byte_size) ||
    storedMime !== String(evidence.mime_type)
  ) {
    return null;
  }

  return evidenceId;
}

function gradeWriting(
  publicConfigValue: unknown,
  responseValue: unknown,
): GradeResult {
  const config = asObject(publicConfigValue);
  const requireCompletionChecklist =
    config.requireCompletionChecklist === true;
  if (
    !isObject(responseValue) ||
    typeof responseValue.text !== "string" ||
    responseValue.text.trim().length === 0 ||
    (responseValue.informationKinds !== undefined &&
      (!Array.isArray(responseValue.informationKinds) ||
        responseValue.informationKinds.some(
          (item) => typeof item !== "boolean",
        ))) ||
    (responseValue.rubricConfirmed !== undefined &&
      typeof responseValue.rubricConfirmed !== "boolean") ||
    (requireCompletionChecklist &&
      (!Array.isArray(responseValue.informationKinds) ||
        typeof responseValue.rubricConfirmed !== "boolean"))
  ) {
    return invalidResponse("写作答案必须包含非空文本和合法的写作记录字段。");
  }
  const text = responseValue.text.trim();
  const sentences = splitSentences(text);
  const normalizedSentences = sentences.map(normalizeText);
  const hangulCharacters = text.match(/[가-힣]/gu)?.length ?? 0;
  const minSentences = finiteConfigNumber(config, "minSentences", 4);
  const maxSentences = finiteConfigNumber(config, "maxSentences", 5);
  const minimumHangulCharacters = finiteConfigNumber(
    config,
    "minimumHangulCharacters",
    20,
  );
  const requiredPhraseGroups = asArray(config.requiredPhraseGroups)
    .map((group) => asArray(group).map(normalizeText).filter(Boolean))
    .filter((group) => group.length > 0);
  const normalizedText = normalizeText(text);
  const matchedPhraseGroups = requiredPhraseGroups.filter((group) =>
    group.some((phrase) => normalizedText.includes(phrase)),
  ).length;
  const minimumPhraseGroups = finiteConfigNumber(
    config,
    "minimumPhraseGroups",
    requiredPhraseGroups.length,
  );
  const requiredInformationKinds = finiteConfigNumber(
    config,
    "minimumInformationKinds",
    asArray(config.informationChecklist).length,
  );
  const informationKinds = Array.isArray(responseValue.informationKinds)
    ? responseValue.informationKinds
    : [];

  const valid =
    sentences.length >= minSentences &&
    sentences.length <= maxSentences &&
    new Set(normalizedSentences).size === sentences.length &&
    normalizedSentences.every((sentence) => sentence.length >= 5) &&
    hangulCharacters >= minimumHangulCharacters &&
    matchedPhraseGroups >= minimumPhraseGroups &&
    (!requireCompletionChecklist ||
      (informationKinds.length === requiredInformationKinds &&
        informationKinds.every((item) => item === true) &&
        responseValue.rubricConfirmed === true));

  // Open submissions always remain unscored. Completion qualification is kept
  // separate so a below-threshold attempt cannot enter objective mastery math.
  return {
    ok: true,
    correct: null,
    score: null,
    meetsCompletionRequirements: valid,
  };
}

function gradeOpenActivity(
  activityType: string,
  publicConfigValue: unknown,
  responseValue: unknown,
): GradeResult {
  const config = asObject(publicConfigValue);
  if (!isObject(responseValue)) {
    return invalidResponse("开放活动答案必须是对象。");
  }
  const response = responseValue;

  if (activityType === "speaking") {
    // Browser-reported duration, turn count and checkboxes can satisfy the
    // submission contract, but never produce is_correct=true or a score.
    const enforceCompletionRequirements =
      config.enforceCompletionRequirements === true;
    const minimumSeconds = finiteConfigNumber(config, "minimumSeconds", 1);
    const maximumSeconds = finiteConfigNumber(
      config,
      "maximumSeconds",
      Number.POSITIVE_INFINITY,
    );
    const minimumTurns = finiteConfigNumber(config, "minimumTurns", 0);
    const requiredCriteria = finiteConfigNumber(config, "requiredCriteria", 0);
    const durationSeconds =
      typeof response.durationSeconds === "number"
        ? response.durationSeconds
        : Number.NaN;
    const hasValidStructure =
      response.recorded === true &&
      Number.isFinite(durationSeconds) &&
      durationSeconds > 0 &&
      (response.turns === undefined ||
        (typeof response.turns === "number" &&
          Number.isInteger(response.turns) &&
          response.turns >= 0)) &&
      (response.criteria === undefined ||
        (Array.isArray(response.criteria) &&
          response.criteria.every((item) => typeof item === "boolean")));
    if (!hasValidStructure) {
      return invalidResponse("口语答案必须包含有效录音时长和合法的口语记录字段。");
    }
    const meetsCompletionRequirements =
      !enforceCompletionRequirements ||
      (durationSeconds >= minimumSeconds &&
        durationSeconds <= maximumSeconds &&
        typeof response.turns === "number" &&
        Number.isInteger(response.turns) &&
        response.turns >= minimumTurns &&
        Array.isArray(response.criteria) &&
        response.criteria.length >= requiredCriteria &&
        response.criteria.every((item) => item === true));
    return {
      ok: true,
      correct: null,
      score: null,
      meetsCompletionRequirements,
    };
  }

  if (activityType === "writing") {
    return gradeWriting(publicConfigValue, responseValue);
  }

  if (activityType === "self_check") {
    if (
      !isStrictStringArray(response.checks) ||
      !isStrictStringArray(response.returnNodes) ||
      response.checks.length === 0 ||
      response.returnNodes.length === 0 ||
      response.checks.some((item) => item.trim().length === 0) ||
      response.returnNodes.some((item) => item.trim().length === 0) ||
      (response.note !== undefined && typeof response.note !== "string")
    ) {
      return invalidResponse("自检答案必须包含非空的字符串数组。");
    }
    const checks = response.checks;
    const returnNodes = response.returnNodes;
    const allowedReturnNodes = new Set(
      asArray(config.returnNodes)
        .map(asObject)
        .map((item) => String(item.value ?? ""))
        .filter(Boolean),
    );
    const hasReview = checks.includes("review");
    const requiredChecks = finiteConfigNumber(config, "requiredChecks", 5);
    const valid =
      checks.length === requiredChecks &&
      checks.every((item) => item === "can" || item === "review") &&
      returnNodes.length > 0 &&
      returnNodes.every((item) => allowedReturnNodes.has(item)) &&
      (hasReview
        ? returnNodes.some((item) => item !== "none") &&
          !returnNodes.includes("none")
        : returnNodes.length === 1 && returnNodes[0] === "none");
    return {
      ok: true,
      correct: null,
      score: null,
      meetsCompletionRequirements: valid,
    };
  }

  return { ok: false, error: "无法识别开放活动类型，提交已拒绝。" };
}

export function gradeSmartTextbookActivity(
  answerKeyValue: unknown,
  response: unknown,
  activityType: string,
  publicConfigValue: unknown,
  optionsValue: unknown = [],
): GradeResult {
  if (
    !OBJECTIVE_ACTIVITY_TYPES.has(activityType) &&
    !OPEN_ACTIVITY_TYPES.has(activityType)
  ) {
    return { ok: false, error: "无法识别活动类型，提交已拒绝。" };
  }

  const answerKey = asObject(answerKeyValue);
  const kind = typeof answerKey.kind === "string" ? answerKey.kind : "";
  const expected = answerKey.value;
  const options = asArray(optionsValue);

  if (OPEN_ACTIVITY_TYPES.has(activityType)) {
    return kind === "open"
      ? gradeOpenActivity(activityType, publicConfigValue, response)
      : { ok: false, error: "活动判定配置不匹配，提交已拒绝。" };
  }
  if (kind === "open") {
    return { ok: false, error: "活动判定配置不匹配，提交已拒绝。" };
  }

  if (kind === "index") {
    if (activityType !== "single_choice" && activityType !== "listening") {
      return { ok: false, error: "活动判定配置不匹配，提交已拒绝。" };
    }
    if (!isIntegerInRange(expected, options.length)) {
      return invalidAnswerConfig();
    }
    if (!isIntegerInRange(response, options.length)) {
      return invalidResponse("选项索引必须是范围内的整数。");
    }
    const correct = response === expected;
    return { ok: true, correct, score: correct ? 100 : 0 };
  }
  if (kind === "indices") {
    if (activityType !== "multiple_choice") {
      return { ok: false, error: "活动判定配置不匹配，提交已拒绝。" };
    }
    if (
      !isStrictIntegerArray(expected, options.length) ||
      expected.length === 0 ||
      new Set(expected).size !== expected.length
    ) {
      return invalidAnswerConfig();
    }
    if (
      !isStrictIntegerArray(response, options.length) ||
      response.length === 0 ||
      new Set(response).size !== response.length
    ) {
      return invalidResponse("多选答案必须包含至少一个互不重复的有效索引。");
    }
    const given = [...response].sort((left, right) => left - right);
    const wanted = [...expected].sort((left, right) => left - right);
    const correct = JSON.stringify(given) === JSON.stringify(wanted);
    return { ok: true, correct, score: correct ? 100 : 0 };
  }
  if (kind === "order") {
    if (activityType !== "ordering") {
      return { ok: false, error: "活动判定配置不匹配，提交已拒绝。" };
    }
    const isPermutation = (value: unknown): value is number[] =>
      isStrictIntegerArray(value, options.length) &&
      value.length === options.length &&
      new Set(value).size === options.length;
    if (!isPermutation(expected)) return invalidAnswerConfig();
    if (!isPermutation(response)) {
      return invalidResponse("排序答案必须完整包含全部选项且不得重复。");
    }
    const correct = JSON.stringify(response) === JSON.stringify(expected);
    return { ok: true, correct, score: correct ? 100 : 0 };
  }
  if (kind === "text") {
    if (activityType !== "fill_blank") {
      return { ok: false, error: "活动判定配置不匹配，提交已拒绝。" };
    }
    if (typeof expected !== "string" || expected.trim().length === 0) {
      return invalidAnswerConfig();
    }
    if (typeof response !== "string" || response.trim().length === 0) {
      return invalidResponse("文本答案必须是非空字符串。");
    }
    const correct = normalizeText(response) === normalizeText(expected);
    return { ok: true, correct, score: correct ? 100 : 0 };
  }
  if (kind === "text_array") {
    if (activityType !== "fill_blank") {
      return { ok: false, error: "活动判定配置不匹配，提交已拒绝。" };
    }
    if (
      !isStrictStringArray(expected) ||
      expected.length === 0 ||
      expected.some((item) => item.trim().length === 0)
    ) {
      return invalidAnswerConfig();
    }
    if (
      !isStrictStringArray(response) ||
      response.length !== expected.length ||
      response.some((item) => item.trim().length === 0)
    ) {
      return invalidResponse("填空答案必须是长度匹配的非空字符串数组。");
    }
    const given = response.map(normalizeText);
    const wanted = expected.map(normalizeText);
    const correct = JSON.stringify(given) === JSON.stringify(wanted);
    return { ok: true, correct, score: correct ? 100 : 0 };
  }
  if (kind === "index_array") {
    if (activityType !== "single_choice" && activityType !== "listening") {
      return { ok: false, error: "活动判定配置不匹配，提交已拒绝。" };
    }
    const config = asObject(publicConfigValue);
    const directItems = asArray(config.items).map(asObject);
    const groupedItems = asArray(config.groups).flatMap((group) =>
      asArray(asObject(group).items).map(asObject),
    );
    const conversationItems = asArray(asObject(config.conversation).steps)
      .map(asObject)
      .filter((step) => step.kind === "choice");
    const items = directItems.length > 0 ? directItems : groupedItems.length > 0 ? groupedItems : conversationItems;
    const validIndexArray = (value: unknown): value is number[] =>
      Array.isArray(value) &&
      value.length === items.length &&
      value.every((item, index) =>
        isIntegerInRange(item, asArray(items[index]?.options).length),
      );
    if (items.length === 0 || !validIndexArray(expected)) {
      return invalidAnswerConfig();
    }
    if (!validIndexArray(response)) {
      return invalidResponse("分组选择答案必须为每组提供一个有效索引。");
    }
    const correct = JSON.stringify(response) === JSON.stringify(expected);
    return { ok: true, correct, score: correct ? 100 : 0 };
  }
  if (kind === "index_confirmation") {
    if (activityType !== "single_choice") {
      return { ok: false, error: "活动判定配置不匹配，提交已拒绝。" };
    }
    if (!isIntegerInRange(expected, options.length)) {
      return invalidAnswerConfig();
    }
    if (
      !isObject(response) ||
      !isIntegerInRange(response.selection, options.length) ||
      response.confirmed !== true
    ) {
      return invalidResponse("确认答案必须包含有效选项并明确确认。");
    }
    const correct = response.selection === expected;
    return { ok: true, correct, score: correct ? 100 : 0 };
  }

  return { ok: false, error: "无法识别答案类型，提交已拒绝。" };
}

function localizedFeedback(
  value: unknown,
  locale: "zh-CN" | "ko-KR",
  attemptNumber: number,
  correct: boolean | null,
) {
  const explanation = asObject(value);
  const correctText = asObject(explanation.correct);
  const feedback = asArray(explanation.feedback);
  const selected = asObject(feedback[Math.min(Math.max(attemptNumber - 1, 0), 2)]);
  return String(
    (correct !== false ? correctText[locale] : selected[locale]) ??
      explanation[locale] ??
      explanation["zh-CN"] ??
      "",
  );
}

function failure(
  explanation: string,
  preview: boolean,
  attemptNumber = 0,
): SmartTextbookSubmitResult {
  return {
    ok: false,
    correct: null,
    score: null,
    explanation,
    attemptNumber,
    preview,
    nodeId: null,
    nodeCompleted: false,
    completionPercent: 0,
  };
}

export async function submitSmartTextbookActivityForContext(
  input: unknown,
  context: SubmissionContext,
): Promise<SmartTextbookSubmitResult> {
  const parsed = smartTextbookSubmissionSchema.safeParse(input);
  if (!parsed.success) return failure("提交内容无效。", context.preview);
  if (!context.canSubmit) {
    return failure("当前账号没有智能教材学习权限。", context.preview);
  }

  const { data: activity, error: activityError } = await context.supabase
    .from("digital_textbook_activities")
    .select("id,node_id,activity_type,options,public_config,max_attempts")
    .eq("id", parsed.data.activityId)
    .maybeSingle();
  if (activityError || !activity) {
    return failure("找不到这项练习。", context.preview);
  }

  const [{ data: secretData, error: secretError }, { data: node, error: nodeError }] =
    await Promise.all([
      context.admin
        .from("digital_textbook_activity_secrets")
        .select(
          activity.activity_type === "listening"
            ? "answer_key,explanation,audio_object_key,audio_status"
            : "answer_key,explanation",
        )
        .eq("activity_id", activity.id)
        .maybeSingle(),
      // The learner-facing activity query above is the authorization gate.
      // Resolve its server-only version relationship with the admin client so
      // node RLS does not make a valid, visible activity look unconfigured.
      context.admin
        .from("digital_textbook_nodes")
        .select(
          "id,module_id,digital_textbook_modules!inner(chapter_id,digital_textbook_chapters!inner(version_id))",
        )
        .eq("id", activity.node_id)
        .maybeSingle(),
    ]);

  if (secretError || nodeError || !secretData || !node) {
    return failure("练习的判定配置尚未完成。", context.preview);
  }
  const secret = secretData as unknown as {
    answer_key: unknown;
    explanation: unknown;
    audio_object_key?: string | null;
    audio_status?: string | null;
  };
  if (
    activity.activity_type === "listening" &&
    (!("audio_object_key" in secret) ||
      !secret.audio_object_key ||
      !("audio_status" in secret) ||
      secret.audio_status !== "ready")
  ) {
    return failure(
      "听力音频仍待录制与核验，当前不能提交本活动。",
      context.preview,
    );
  }

  const result = gradeSmartTextbookActivity(
    secret.answer_key,
    parsed.data.response,
    String(activity.activity_type),
    activity.public_config,
    activity.options,
  );
  if (!result.ok) return failure(result.error, context.preview);

  const speakingEvidenceId =
    activity.activity_type === "speaking"
      ? await verifySpeakingRecordingEvidence(
          context,
          String(activity.id),
          parsed.data.response,
        )
      : null;
  if (activity.activity_type === "speaking" && !speakingEvidenceId) {
    return failure(
      "未找到可核验的本人录音，请重新录制并等待上传完成后再提交。",
      context.preview,
    );
  }

  if (context.preview) {
    return {
      ok: true,
      correct: result.correct,
      score: result.score,
      explanation: localizedFeedback(
        secret.explanation,
        parsed.data.locale,
        1,
        result.correct,
      ),
      attemptNumber: 1,
      preview: true,
      nodeId: String(activity.node_id),
      nodeCompleted: false,
      completionPercent: 0,
    };
  }
  if (!context.tenantId) {
    return failure("当前账号没有可用的学习空间。", false);
  }

  const nestedModules = asObject(node.digital_textbook_modules);
  const nestedChapter = asObject(nestedModules.digital_textbook_chapters);
  const versionId = String(nestedChapter.version_id ?? "");
  if (!versionId) return failure("教材版本关系不完整。", false);

  let { data: recordData, error: recordError } =
    activity.activity_type === "speaking" &&
    result.meetsCompletionRequirements === true
      ? await context.admin.rpc("record_smart_textbook_speaking_attempt", {
          p_tenant_id: context.tenantId,
          p_student_id: context.userId,
          p_activity_id: activity.id,
          p_version_id: versionId,
          p_response: parsed.data.response ?? null,
          p_evidence_id: speakingEvidenceId,
        })
      : result.meetsCompletionRequirements !== undefined
        ? await context.admin.rpc("record_smart_textbook_attempt", {
            p_tenant_id: context.tenantId,
            p_student_id: context.userId,
            p_activity_id: activity.id,
            p_version_id: versionId,
            p_response: parsed.data.response ?? null,
            p_is_correct: result.correct,
            p_score: result.score,
            p_meets_completion_requirements:
              result.meetsCompletionRequirements,
          })
      : await context.admin.rpc("record_smart_textbook_attempt", {
          p_tenant_id: context.tenantId,
          p_student_id: context.userId,
          p_activity_id: activity.id,
          p_version_id: versionId,
          p_response: parsed.data.response ?? null,
          p_is_correct: result.correct,
          p_score: result.score,
        });
  if (
    recordError?.code === "PGRST202" &&
    OBJECTIVE_ACTIVITY_TYPES.has(String(activity.activity_type))
  ) {
    const fallback = await recordObjectiveAttemptWithoutRpc({
      context,
      activity: {
        id: String(activity.id),
        node_id: String(activity.node_id),
        max_attempts: activity.max_attempts,
      },
      versionId,
      response: parsed.data.response,
      result,
    });
    recordData = fallback.data;
    recordError = fallback.error as typeof recordError;
  }
  const record = Array.isArray(recordData) ? recordData[0] : recordData;
  if (recordError || !record) {
    const maxAttemptsReached = recordError?.message?.includes(
      "MAX_ATTEMPTS_REACHED",
    );
    return failure(
      maxAttemptsReached
        ? `本活动最多提交 ${Number(activity.max_attempts) || 3} 次。`
        : "作答或学习进度暂时没有保存，请重新提交。",
      false,
    );
  }

  const attemptNumber = Number(record.attempt_number);
  return {
    ok: true,
    correct: result.correct,
    score: result.score,
    explanation: localizedFeedback(
      secret.explanation,
      parsed.data.locale,
      attemptNumber,
      result.correct,
    ),
    attemptNumber,
    preview: false,
    nodeId: String(activity.node_id),
    nodeCompleted: record.node_completed === true,
    completionPercent: Math.max(
      0,
      Math.min(100, Number(record.completion_percent) || 0),
    ),
  };
}
