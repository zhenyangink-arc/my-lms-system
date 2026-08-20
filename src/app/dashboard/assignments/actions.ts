"use server";

import { revalidateDashboard } from "@/lib/revalidate-dashboard";

import { refreshStudentHomeLearning } from "@/features/student-home-learning/api/refresh";
import { requireAssignmentManager, requireAssignmentStudent } from "@/lib/learning-assignments";
import { STUDENT_APP_IDS } from "@/lib/student-apps";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  initialAssignmentRemediationState,
  type AssignmentRemediationState,
  type LearningAssignmentActionState,
} from "./action-state";
import {
  ASSIGNMENT_STATUSES,
  SUBMISSION_WORKFLOW_STATES,
  SUBMISSION_WORKFLOW_STATE_LABELS,
  type AssignmentStatus,
  type SubmissionWorkflowState,
} from "./config";

function result(status: "success" | "error", message: string): LearningAssignmentActionState {
  return { status, message };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function friendlyDatabaseError(message: string | undefined, fallback: string) {
  if (message && message.length <= 240 && /[\u3400-\u9fff]/u.test(message)) return message;
  return fallback;
}

function parseKoreanDateTime(value: string) {
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
    ? `${value}:00+09:00`
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)
      ? `${value}+09:00`
      : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function refreshAssignmentPages(assignmentId?: string) {
  revalidateDashboard("/dashboard/assignments");
  revalidateDashboard("/dashboard/admin/assignments");
  revalidateDashboard("/dashboard/grades");
  if (assignmentId) {
    revalidateDashboard(`/dashboard/assignments/${assignmentId}`);
    revalidateDashboard(`/dashboard/admin/assignments/${assignmentId}`);
  }
}

export async function submitAssignmentRemediationAction(
  questionId: string,
  _previousState: AssignmentRemediationState,
  formData: FormData
): Promise<AssignmentRemediationState> {
  void _previousState;
  if (!isUuid(questionId)) {
    return { ...initialAssignmentRemediationState, status: "error", message: "错题编号不正确。" };
  }
  const answer = String(formData.get("answer") ?? "").trim();
  if (!answer || answer.length > 10000) {
    return { ...initialAssignmentRemediationState, status: "error", message: "请填写有效的重练答案。" };
  }
  const { supabase } = await requireAssignmentStudent();
  const { data, error } = await supabase.rpc(
    "submit_assignment_remediation_answer",
    { p_question_id: questionId, p_answer: answer }
  );
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return { ...initialAssignmentRemediationState, status: "error", message: friendlyDatabaseError(error?.message, "错题答案暂时无法判定，请稍后重试。") };
  }
  const resultData = data as {
    correct?: unknown;
    message?: unknown;
    correctAnswer?: unknown;
    explanation?: unknown;
  };
  const correct = resultData.correct === true;
  return {
    status: correct ? "correct" : "incorrect",
    message: String(resultData.message ?? (correct ? "回答正确。" : "再检查一次答案。")),
    correctAnswer: resultData.correctAnswer == null ? null : String(resultData.correctAnswer),
    explanation: resultData.explanation == null ? null : String(resultData.explanation),
  };
}

export async function changeLearningAssignmentStatusAction(
  assignmentId: string,
  nextStatus: AssignmentStatus,
  _previousState: LearningAssignmentActionState,
  _formData: FormData
): Promise<LearningAssignmentActionState> {
  void _previousState;
  void _formData;
  if (!isUuid(assignmentId) || !ASSIGNMENT_STATUSES.includes(nextStatus)) return result("error", "任务状态参数不正确。");
  const { supabase } = await requireAssignmentManager();
  const { error } = await supabase.rpc("change_learning_assignment_status", {
    p_assignment_id: assignmentId,
    p_status: nextStatus,
  });
  if (error) return result("error", friendlyDatabaseError(error.message, "任务状态更新失败，请稍后重试。"));
  refreshAssignmentPages(assignmentId);
  return result("success", nextStatus === "published" ? "任务已经发布。" : nextStatus === "closed" ? "任务已经关闭。" : "任务已经转为草稿。");
}

export async function updateLearningAssignmentDeadlineAction(
  assignmentId: string,
  _previousState: LearningAssignmentActionState,
  formData: FormData
): Promise<LearningAssignmentActionState> {
  void _previousState;
  if (!isUuid(assignmentId)) return result("error", "任务编号不正确。");
  const dueAt = parseKoreanDateTime(String(formData.get("due_at") ?? ""));
  if (!dueAt || dueAt.getTime() <= new Date().getTime()) return result("error", "新的截止时间必须晚于当前时间。");
  const { supabase } = await requireAssignmentManager();
  const { error } = await supabase.rpc("update_learning_assignment_deadline", {
    p_assignment_id: assignmentId,
    p_due_at: dueAt.toISOString(),
  });
  if (error) return result("error", friendlyDatabaseError(error.message, "截止时间更新失败，请稍后重试。"));
  refreshAssignmentPages(assignmentId);
  return result("success", "新的截止时间已经生效。");
}

export async function submitLearningAssignmentAction(
  assignmentId: string,
  _previousState: LearningAssignmentActionState,
  formData: FormData
): Promise<LearningAssignmentActionState> {
  void _previousState;
  if (!isUuid(assignmentId)) return result("error", "任务编号不正确。");
  const { supabase, user, tenant } = await requireAssignmentStudent();
  const { data: deliveryPaperId, error: deliveryPaperError } = await supabase.rpc(
    "current_user_assignment_delivery_paper_id",
    { p_assignment_id: assignmentId },
  );
  if (deliveryPaperError) {
    return result("error", "任务试卷暂时无法确认，请刷新页面重试。");
  }
  const questionQuery = supabase
    .from("learning_assignment_questions")
    .select("id,question_type")
    .eq("assignment_id", assignmentId)
    .order("sort_order", { ascending: true });
  const { data: questions, error: questionError } = typeof deliveryPaperId === "string"
    ? await questionQuery.eq("delivery_paper_id", deliveryPaperId)
    : await questionQuery.is("delivery_paper_id", null);
  if (questionError || !questions?.length) return result("error", "任务题目暂时无法读取，请刷新页面重试。");

  const answers = questions.map((question) => ({
    questionId: question.id,
    answer: String(formData.get(`answer_${question.id}`) ?? "").trim(),
  }));
  const submissionIntent = String(
    formData.get("submission_intent") ?? "complete"
  );
  if (![
    "complete",
    "confirmed_incomplete",
    "time_expired",
  ].includes(submissionIntent)) {
    return result("error", "提交方式不正确，请刷新页面后重试。");
  }
  const emptyIndex = answers.findIndex((answer) => !answer.answer);
  if (emptyIndex >= 0 && submissionIntent === "complete") {
    return result("error", `请完成第 ${emptyIndex + 1} 题后再提交。`);
  }
  if (answers.some((answer) => answer.answer.length > 10000)) return result("error", "单题答案不能超过 10000 个字。");
  const submissionRequestId = String(
    formData.get("submission_request_id") ?? ""
  );
  if (!isUuid(submissionRequestId)) {
    return result("error", "提交请求编号不正确，请刷新页面后重试。");
  }

  const audioAnswers = answers.filter((answer) => answer.answer &&
    questions.some(
      (question) =>
        question.id === answer.questionId &&
        question.question_type === "audio_recording"
    )
  );
  if (audioAnswers.length > 0) {
    if (!tenant || audioAnswers.some((answer) => !isUuid(answer.answer))) {
      return result("error", "口语录音尚未上传完成，请重新录制后提交。");
    }
    const admin = createAdminClient();
    const { data: evidence } = await admin
      .from("learning_assignment_recording_evidence")
      .select("id,question_id")
      .eq("tenant_id", tenant.id)
      .eq("student_id", user.id)
      .eq("assignment_id", assignmentId)
      .in("id", audioAnswers.map((answer) => answer.answer));
    const validEvidence = new Map(
      (evidence ?? []).map((item) => [item.id, item.question_id])
    );
    if (
      audioAnswers.some(
        (answer) => validEvidence.get(answer.answer) !== answer.questionId
      )
    ) {
      return result("error", "口语录音与本题不匹配，请重新录制后提交。");
    }
  }

  const { data, error } = await supabase.rpc("submit_learning_assignment", {
    p_assignment_id: assignmentId,
    p_answers: answers,
    p_request_id: submissionRequestId,
    p_submission_intent: submissionIntent,
  });
  if (error) return result("error", friendlyDatabaseError(error.message, "提交失败，请稍后重试。"));
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return result("error", "服务器没有返回有效的提交凭证，请使用原页面重试。");
  }
  const submissionResult = data as {
    submissionId?: unknown;
    attemptNumber?: unknown;
    workflowState?: unknown;
    idempotent?: unknown;
  };
  refreshAssignmentPages(assignmentId);
  if (tenant?.id) {
    refreshStudentHomeLearning({
      tenantId: tenant.id,
      studentId: user.id,
      studentAppId: STUDENT_APP_IDS.korean,
      appSlug: "korean",
      space: tenant.slug,
    });
  }
  const workflowState = String(submissionResult.workflowState ?? "");
  if (!SUBMISSION_WORKFLOW_STATES.includes(workflowState as SubmissionWorkflowState)) {
    return result("error", "服务器返回的提交状态无法识别，请刷新页面核对提交记录。");
  }
  const submissionId = String(submissionResult.submissionId ?? "");
  const { data: receipt } = isUuid(submissionId)
    ? await supabase
        .from("student_learning_submissions")
        .select("submitted_at,attempt_number,submission_state")
        .eq("id", submissionId)
        .eq("student_id", user.id)
        .maybeSingle()
    : { data: null };
  const authoritativeState = SUBMISSION_WORKFLOW_STATES.includes(
    receipt?.submission_state as SubmissionWorkflowState,
  )
    ? (receipt?.submission_state as SubmissionWorkflowState)
    : (workflowState as SubmissionWorkflowState);
  const retryMessage = submissionResult.idempotent === true
    ? "系统已确认此前的同一请求提交成功。"
    : "";
  return {
    status: "success",
    message: `${retryMessage}${SUBMISSION_WORKFLOW_STATE_LABELS[authoritativeState]}。`,
    submissionState: authoritativeState,
    submittedAt: receipt?.submitted_at ?? new Date().toISOString(),
    attemptNumber:
      Number(receipt?.attempt_number ?? submissionResult.attemptNumber) || undefined,
  };
}

export async function gradeLearningSubmissionAction(
  submissionId: string,
  _previousState: LearningAssignmentActionState,
  formData: FormData
): Promise<LearningAssignmentActionState> {
  void _previousState;
  if (!isUuid(submissionId)) return result("error", "提交记录编号不正确。");
  const { supabase } = await requireAssignmentManager();
  const decision = String(formData.get("decision") ?? "graded");
  const overallFeedback = String(formData.get("overall_feedback") ?? "").trim();
  if (!["graded", "revision_required"].includes(decision)) return result("error", "请选择有效的批改结果。");
  if (decision === "revision_required" && overallFeedback.length < 2) return result("error", "退回重做时必须填写明确原因。");
  if (overallFeedback.length > 3000) return result("error", "总体评语不能超过 3000 个字。");

  const { data: answers, error: answerError } = await supabase
    .from("learning_submission_answers")
    .select("id")
    .eq("submission_id", submissionId);
  if (answerError || !answers?.length) return result("error", "学生答案暂时无法读取，请刷新页面重试。");

  const scores = [];
  for (const [index, answer] of answers.entries()) {
    const rubricKind = String(formData.get(`rubric_kind_${answer.id}`) ?? "");
    const rubricKeys = rubricKind === "speaking"
      ? ["pronunciation_accuracy", "fluency", "grammar_vocabulary", "task_completion"]
      : rubricKind === "writing"
        ? ["content_completeness", "grammar_accuracy", "vocabulary_use", "organization_expression", "spelling_format"]
        : [];
    const rubricScores = rubricKeys.length > 0
      ? Object.fromEntries(rubricKeys.map((key) => [
          key,
          Number(String(formData.get(`rubric_${answer.id}_${key}`) ?? "")),
        ]))
      : null;
    const points = rubricScores
      ? Object.values(rubricScores).reduce((total, value) => total + value, 0)
      : Number(String(formData.get(`score_${answer.id}`) ?? ""));
    const feedback = String(formData.get(`feedback_${answer.id}`) ?? "").trim();
    if (!Number.isFinite(points) || points < 0) return result("error", `第 ${index + 1} 题得分不正确。`);
    if (rubricScores && Object.values(rubricScores).some((value) => !Number.isFinite(value) || value < 0)) {
      return result("error", `第 ${index + 1} 题的分项评分不正确。`);
    }
    if (feedback.length > 2000) return result("error", `第 ${index + 1} 题评语不能超过 2000 个字。`);
    scores.push({ answerId: answer.id, points, feedback, rubricScores });
  }

  const { data: submission } = await supabase
    .from("learning_submissions")
    .select("assignment_id")
    .eq("id", submissionId)
    .maybeSingle();
  const { error } = await supabase.rpc("grade_learning_submission", {
    p_submission_id: submissionId,
    p_decision: decision,
    p_overall_feedback: overallFeedback,
    p_scores: scores,
  });
  if (error) return result("error", friendlyDatabaseError(error.message, "批改结果保存失败，请稍后重试。"));
  const { data: gradedSubmission } = await supabase
    .from("learning_submissions")
    .select("submission_state")
    .eq("id", submissionId)
    .maybeSingle();
  refreshAssignmentPages(submission?.assignment_id ?? undefined);
  if (decision === "revision_required") {
    return result("success", "任务已退回学生重做。");
  }
  return result(
    "success",
    gradedSubmission?.submission_state === "grading_completed"
      ? "批改已经保存，请核对暂定总分后确认发布成绩。"
      : "批改结果已经保存。"
  );
}

export async function releaseLearningSubmissionGradeAction(
  submissionId: string,
  _previousState: LearningAssignmentActionState,
  _formData: FormData
): Promise<LearningAssignmentActionState> {
  void _previousState;
  void _formData;
  if (!isUuid(submissionId)) return result("error", "提交记录编号不正确。");
  const { supabase } = await requireAssignmentManager();
  const { data: submission } = await supabase
    .from("learning_submissions")
    .select("assignment_id")
    .eq("id", submissionId)
    .maybeSingle();
  const { data, error } = await supabase.rpc("release_learning_submission_grade", {
    p_submission_id: submissionId,
  });
  if (error) return result("error", friendlyDatabaseError(error.message, "成绩发布失败，请稍后重试。"));
  refreshAssignmentPages(submission?.assignment_id ?? undefined);
  const releaseResult = data && typeof data === "object" && !Array.isArray(data)
    ? data as { released?: unknown; scheduled?: unknown }
    : null;
  return result(
    "success",
    releaseResult?.released === true
      ? "成绩与评语已经发布给学生。"
      : "已经确认发布，成绩将在设定的公开时间向学生显示。"
  );
}
