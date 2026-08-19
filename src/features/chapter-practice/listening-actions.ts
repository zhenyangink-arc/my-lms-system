"use server";

import { requireActiveUser } from "@/lib/auth";
import { refreshStudentHomeLearning } from "@/features/student-home-learning/api/refresh";
import { createAdminClient } from "@/lib/supabase/admin";
import { STUDENT_APP_IDS } from "@/lib/student-apps";
import { recordStudentChapterPracticeProgress } from "./student/progress-service";
import type { StudentChapterPracticeProgress } from "./student/types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ListeningAnswer = { questionId: string; response: string };

export type ListeningEvaluationResult = {
  answeredCount: number;
  correctCount: number;
  percentage: number;
  feedback: Array<{
    questionId: string;
    isCorrect: boolean;
    explanation: string;
  }>;
};

export type ListeningEvaluationResponse =
  | {
      ok: true;
      result: ListeningEvaluationResult;
      progress: StudentChapterPracticeProgress;
    }
  | { ok: false; message: string };

function normalizeAnswer(value: string) {
  return value
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

export async function evaluateChapterPracticeListening(input: {
  blockId: string;
  answers: ListeningAnswer[];
}): Promise<ListeningEvaluationResponse> {
  if (
    !UUID_PATTERN.test(input.blockId) ||
    !Array.isArray(input.answers) ||
    input.answers.length < 1 ||
    input.answers.length > 100
  ) {
    return { ok: false, message: "听辨题提交内容不完整，请刷新后重试。" };
  }

  const answers = input.answers.map((answer) => ({
    questionId: String(answer.questionId ?? ""),
    response: String(answer.response ?? "").trim().slice(0, 5000),
  }));
  if (
    answers.some(
      (answer) =>
        !UUID_PATTERN.test(answer.questionId) || !answer.response.length,
    )
  ) {
    return { ok: false, message: "请完成全部可判定听辨题后再查看反馈。" };
  }

  const { supabase, tenant, profile, user } = await requireActiveUser();
  if (!tenant?.id || profile?.role !== "student") {
    return { ok: false, message: "只有当前机构的学生账号可以核验听辨题。" };
  }

  const [tenantAppResult, enrollmentResult] = await Promise.all([
    supabase
      .from("tenant_student_apps")
      .select("is_enabled,status")
      .eq("tenant_id", tenant.id)
      .eq("app_id", STUDENT_APP_IDS.korean)
      .maybeSingle(),
    supabase
      .from("student_app_enrollments")
      .select("status,starts_at,ends_at")
      .eq("tenant_id", tenant.id)
      .eq("student_id", user.id)
      .eq("app_id", STUDENT_APP_IDS.korean)
      .maybeSingle(),
  ]);
  const tenantApp = tenantAppResult.data;
  const enrollment = enrollmentResult.data;
  const now = Date.now();
  const startsAt = enrollment?.starts_at
    ? Date.parse(enrollment.starts_at)
    : null;
  const endsAt = enrollment?.ends_at ? Date.parse(enrollment.ends_at) : null;
  if (
    tenantAppResult.error ||
    !tenantApp?.is_enabled ||
    tenantApp.status !== "active" ||
    enrollmentResult.error ||
    !enrollment ||
    enrollment.status !== "active" ||
    (startsAt !== null && Number.isFinite(startsAt) && startsAt > now) ||
    (endsAt !== null && Number.isFinite(endsAt) && endsAt <= now)
  ) {
    return { ok: false, message: "当前账号没有可用的韩国语听音训练权限。" };
  }

  const { data: block, error: blockError } = await supabase
    .from("chapter_practice_blocks")
    .select("practice_unit_id,source_type,source_id")
    .eq("id", input.blockId)
    .eq("block_type", "listening")
    .eq("status", "published")
    .maybeSingle();
  if (blockError || !block?.practice_unit_id || !block.source_id) {
    return { ok: false, message: "当前听音训练未发布或已更新，请刷新页面。" };
  }

  const { data: unit, error: unitError } = await supabase
    .from("chapter_practice_units")
    .select("id")
    .eq("id", block.practice_unit_id)
    .eq("student_app_id", STUDENT_APP_IDS.korean)
    .eq("status", "published")
    .maybeSingle();
  if (
    unitError ||
    !unit ||
    block.source_type !== "growth_toolbox_exercise"
  ) {
    return { ok: false, message: "当前听辨题没有可用的判定来源。" };
  }

  const admin = createAdminClient();
  const questionIds = answers.map((answer) => answer.questionId);
  const { data: questions, error: questionError } = await admin
    .from("growth_toolbox_questions")
    .select("id")
    .eq("exercise_id", block.source_id)
    .in("id", questionIds);
  if (questionError || !questions?.length) {
    return { ok: false, message: "听辨题判定配置暂不可用，请稍后再试。" };
  }
  const validQuestionIds = questions.map((question) => question.id);
  const { data: keys, error: keyError } = await admin
    .from("growth_toolbox_question_keys")
    .select("question_id,accepted_answers,explanation")
    .in("question_id", validQuestionIds);
  if (keyError || !keys?.length) {
    return { ok: false, message: "本章听辨题暂未配置答案，已保留你的页面作答。" };
  }

  const answerByQuestion = new Map(
    answers.map((answer) => [answer.questionId, answer.response]),
  );
  const feedback = keys.flatMap((key) => {
    const response = answerByQuestion.get(key.question_id);
    const accepted = Array.isArray(key.accepted_answers)
      ? key.accepted_answers.map((value) => String(value))
      : [];
    if (!response || accepted.length === 0) return [];
    const normalized = normalizeAnswer(response);
    return [
      {
        questionId: key.question_id,
        isCorrect: accepted.some(
          (answer) => normalizeAnswer(answer) === normalized,
        ),
        explanation: String(key.explanation ?? "").trim(),
      },
    ];
  });
  if (feedback.length !== answers.length) {
    return {
      ok: false,
      message: "部分听辨题缺少判定配置，本次未计算正确率。",
    };
  }

  const correctCount = feedback.filter((item) => item.isCorrect).length;
  const progress = await recordStudentChapterPracticeProgress({
    supabase,
    tenantId: tenant.id,
    studentId: user.id,
    practiceUnitId: block.practice_unit_id,
    mutation: {
      kind: "listening_attempt",
      blockId: input.blockId,
      correctCount,
      attemptCount: feedback.length,
    },
  });
  try {
    const { error: reviewError } = await supabase.rpc(
      "record_student_practice_listening_reviews",
      {
        p_block_id: input.blockId,
        p_answers: answers,
      },
    );
    if (reviewError) {
      console.warn("听辨进度已保存，但错题归集失败", reviewError.message);
    }
  } catch (reviewError) {
    console.warn("听辨进度已保存，但错题归集失败", reviewError);
  }
  refreshStudentHomeLearning({
    tenantId: tenant.id,
    studentId: user.id,
    studentAppId: STUDENT_APP_IDS.korean,
    appSlug: "korean",
    space: tenant.slug,
  });
  return {
    ok: true,
    result: {
      answeredCount: feedback.length,
      correctCount,
      percentage: Math.round((correctCount / feedback.length) * 100),
      feedback,
    },
    progress,
  };
}
