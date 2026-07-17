"use server";

import { revalidatePath } from "next/cache";

import { requireAssignmentManager, requireAssignmentStudent } from "@/lib/learning-assignments";
import type { LearningAssignmentActionState } from "./action-state";
import {
  ASSIGNMENT_STATUSES,
  ASSIGNMENT_TYPES,
  QUESTION_TYPES,
  type AssignmentStatus,
  type AssignmentType,
  type QuestionType,
} from "./config";

type QuestionInput = {
  type?: unknown;
  prompt?: unknown;
  options?: unknown;
  points?: unknown;
  correctAnswer?: unknown;
  explanation?: unknown;
};

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
  revalidatePath("/dashboard/assignments");
  revalidatePath("/dashboard/admin/assignments");
  revalidatePath("/dashboard/grades");
  if (assignmentId) {
    revalidatePath(`/dashboard/assignments/${assignmentId}`);
    revalidatePath(`/dashboard/admin/assignments/${assignmentId}`);
  }
}

export async function createLearningAssignmentAction(
  _previousState: LearningAssignmentActionState,
  formData: FormData
): Promise<LearningAssignmentActionState> {
  void _previousState;
  const { supabase } = await requireAssignmentManager();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const assignmentType = String(formData.get("assignment_type") ?? "homework");
  const courseIdValue = String(formData.get("course_id") ?? "").trim();
  const targetScope = String(formData.get("target_scope") ?? "all_students");
  const targetIds = formData.getAll("target_ids").map(String).filter(isUuid);
  const dueAt = parseKoreanDateTime(String(formData.get("due_at") ?? ""));
  const durationValue = String(formData.get("duration_minutes") ?? "").trim();
  const durationMinutes = durationValue ? Number(durationValue) : null;
  const allowResubmission = formData.get("allow_resubmission") === "on";
  const publish = String(formData.get("intent") ?? "draft") === "publish";

  if (title.length < 2 || title.length > 120) return result("error", "标题需要填写 2 至 120 个字。");
  if (description.length > 5000) return result("error", "任务说明不能超过 5000 个字。");
  if (!ASSIGNMENT_TYPES.includes(assignmentType as AssignmentType)) return result("error", "请选择有效的任务类型。");
  if (courseIdValue && !isUuid(courseIdValue)) return result("error", "所选课程不正确。");
  if (!dueAt || dueAt.getTime() <= Date.now()) return result("error", "截止时间必须晚于当前时间。");
  if (durationMinutes !== null && (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 600)) {
    return result("error", "建议用时需要填写 1 至 600 分钟。");
  }
  if (!["all_students", "selected_students"].includes(targetScope)) return result("error", "请选择有效的分配范围。");
  if (targetScope === "selected_students" && targetIds.length === 0) return result("error", "请至少选择一名学生。");

  let rawQuestions: QuestionInput[];
  try {
    const parsed = JSON.parse(String(formData.get("questions_json") ?? "[]"));
    if (!Array.isArray(parsed)) throw new Error("invalid");
    rawQuestions = parsed as QuestionInput[];
  } catch {
    return result("error", "题目数据读取失败，请刷新页面后重试。");
  }
  if (rawQuestions.length < 1 || rawQuestions.length > 50) return result("error", "请设置 1 至 50 道题目。");

  const questions = [];
  for (const [index, rawQuestion] of rawQuestions.entries()) {
    const questionType = String(rawQuestion.type ?? "");
    const prompt = String(rawQuestion.prompt ?? "").trim();
    const points = Number(rawQuestion.points);
    const options = Array.isArray(rawQuestion.options)
      ? [...new Set(rawQuestion.options.map(String).map((option) => option.trim()).filter(Boolean))]
      : [];
    const correctAnswer = String(rawQuestion.correctAnswer ?? "").trim();
    const explanation = String(rawQuestion.explanation ?? "").trim();

    if (!QUESTION_TYPES.includes(questionType as QuestionType)) return result("error", `第 ${index + 1} 题类型不正确。`);
    if (prompt.length < 1 || prompt.length > 3000) return result("error", `第 ${index + 1} 题题目不能为空且不能超过 3000 个字。`);
    if (!Number.isFinite(points) || points <= 0 || points > 1000) return result("error", `第 ${index + 1} 题分值需要大于 0 且不超过 1000。`);
    if (questionType === "single_choice" && options.length < 2) return result("error", `第 ${index + 1} 道选择题至少需要两个不同选项。`);
    if (questionType === "single_choice" && correctAnswer && !options.includes(correctAnswer)) {
      return result("error", `第 ${index + 1} 题参考答案不在选项中。`);
    }
    if (explanation.length > 3000) return result("error", `第 ${index + 1} 题解析不能超过 3000 个字。`);
    questions.push({ type: questionType, prompt, points, options, correctAnswer, explanation });
  }

  const { data, error } = await supabase.rpc("create_learning_assignment", {
    p_title: title,
    p_description: description,
    p_assignment_type: assignmentType,
    p_course_id: courseIdValue || null,
    p_target_scope: targetScope,
    p_target_ids: targetScope === "selected_students" ? targetIds : [],
    p_due_at: dueAt.toISOString(),
    p_duration_minutes: durationMinutes,
    p_allow_resubmission: allowResubmission,
    p_publish: publish,
    p_questions: questions,
  });

  if (error || !data) return result("error", friendlyDatabaseError(error?.message, "任务保存失败，请稍后重试。"));
  refreshAssignmentPages(String(data));
  return result("success", publish ? "任务已经发布，学生端现在可以查看。" : "任务草稿已经保存。");
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
  const { supabase } = await requireAssignmentStudent();
  const { data: questions, error: questionError } = await supabase
    .from("learning_assignment_questions")
    .select("id")
    .eq("assignment_id", assignmentId)
    .order("sort_order", { ascending: true });
  if (questionError || !questions?.length) return result("error", "任务题目暂时无法读取，请刷新页面重试。");

  const answers = questions.map((question) => ({
    questionId: question.id,
    answer: String(formData.get(`answer_${question.id}`) ?? "").trim(),
  }));
  const emptyIndex = answers.findIndex((answer) => !answer.answer);
  if (emptyIndex >= 0) return result("error", `请完成第 ${emptyIndex + 1} 题后再提交。`);
  if (answers.some((answer) => answer.answer.length > 10000)) return result("error", "单题答案不能超过 10000 个字。");

  const { error } = await supabase.rpc("submit_learning_assignment", {
    p_assignment_id: assignmentId,
    p_answers: answers,
  });
  if (error) return result("error", friendlyDatabaseError(error.message, "提交失败，请稍后重试。"));
  refreshAssignmentPages(assignmentId);
  return result("success", "作答已经提交，老师批改后会在这里显示结果。");
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
    const points = Number(String(formData.get(`score_${answer.id}`) ?? ""));
    const feedback = String(formData.get(`feedback_${answer.id}`) ?? "").trim();
    if (!Number.isFinite(points) || points < 0) return result("error", `第 ${index + 1} 题得分不正确。`);
    if (feedback.length > 2000) return result("error", `第 ${index + 1} 题评语不能超过 2000 个字。`);
    scores.push({ answerId: answer.id, points, feedback });
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
  refreshAssignmentPages(submission?.assignment_id ?? undefined);
  return result("success", decision === "graded" ? "成绩与评语已经发布给学生。" : "任务已退回学生重做。");
}
