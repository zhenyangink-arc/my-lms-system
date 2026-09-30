"use server";

import { requireActiveUser } from "@/lib/auth";
import { refreshStudentHomeLearningForApp } from "@/features/student-home-learning/api/refresh-for-app";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasActiveStudentAppAccess } from "@/lib/student-app-access.server";
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
    .select("id,student_app_id")
    .eq("id", block.practice_unit_id)
    .eq("status", "published")
    .maybeSingle();
  if (
    unitError ||
    !unit ||
    block.source_type !== "growth_toolbox_exercise"
  ) {
    return { ok: false, message: "当前听辨题没有可用的判定来源。" };
  }

  // 应用来自练习单元本身；读取私有答案前必须确认学生当前能使用该应用。
  if (
    !(await hasActiveStudentAppAccess({
      supabase,
      tenantId: tenant.id,
      studentId: user.id,
      appId: unit.student_app_id,
    }))
  ) {
    return { ok: false, message: "当前账号没有可用的听音训练权限。" };
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
  refreshStudentHomeLearningForApp({
    tenantId: tenant.id,
    studentId: user.id,
    studentAppId: unit.student_app_id,
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
