"use server";

import { revalidateDashboard } from "@/lib/revalidate-dashboard";

import type { LearningAssignmentActionState } from "@/app/dashboard/assignments/action-state";
import {
  requireAssessmentPaperManager,
  requireAssessmentPaperPublisher,
} from "@/lib/assessment-papers";

type SelectedQuestionInput = {
  questionId?: unknown;
  points?: unknown;
};

function result(
  status: "success" | "error",
  message: string
): LearningAssignmentActionState {
  return { status, message };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function friendlyDatabaseError(message: string | undefined, fallback: string) {
  if (message && message.length <= 240 && /[\u3400-\u9fff]/u.test(message)) {
    return message;
  }
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

function refreshPaperPages(type?: string, assignmentId?: string) {
  revalidateDashboard("/dashboard/admin/assignments");
  revalidateDashboard("/dashboard/admin/assignments/homework");
  revalidateDashboard("/dashboard/admin/assignments/exam");
  revalidateDashboard("/dashboard/assignments");
  if (type) revalidateDashboard(`/dashboard/admin/assignments/${type}`);
  if (assignmentId) {
    revalidateDashboard(`/dashboard/admin/assignments/${assignmentId}`);
    revalidateDashboard(`/dashboard/assignments/${assignmentId}`);
  }
}

export async function createAssessmentPaperAction(
  fixedType: "homework" | "exam",
  _previousState: LearningAssignmentActionState,
  formData: FormData
): Promise<LearningAssignmentActionState> {
  void _previousState;
  const { supabase } = await requireAssessmentPaperManager();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const sourceTestId = String(formData.get("source_test_id") ?? "").trim();
  const durationValue = String(formData.get("duration_minutes") ?? "").trim();
  const passingScoreValue = String(formData.get("passing_score") ?? "").trim();
  const durationMinutes = durationValue ? Number(durationValue) : null;
  const passingScore = passingScoreValue ? Number(passingScoreValue) : null;
  const allowResubmission = formData.get("allow_resubmission") === "on";
  const publish = String(formData.get("intent") ?? "draft") === "publish";

  if (publish) {
    const { data: canRelease } = await supabase.rpc(
      "current_user_can_release_assessment_papers"
    );
    if (canRelease !== true) {
      return result("error", "草稿可以保存，但只有平台负责人可以发布给机构。");
    }
  }

  if (title.length < 2 || title.length > 120) {
    return result("error", "试卷名称需要填写 2 至 120 个字。");
  }
  if (description.length > 5000) {
    return result("error", "试卷说明不能超过 5000 个字。");
  }
  if (!isUuid(sourceTestId)) {
    return result("error", "请选择有效的题库章节。");
  }
  if (
    durationMinutes !== null &&
    (!Number.isInteger(durationMinutes) ||
      durationMinutes < 1 ||
      durationMinutes > 600)
  ) {
    return result("error", "建议用时需要填写 1 至 600 分钟。");
  }
  if (
    passingScore !== null &&
    (!Number.isFinite(passingScore) ||
      passingScore < 0 ||
      passingScore > 100)
  ) {
    return result("error", "及格线需要填写 0 至 100。");
  }

  let rawQuestions: SelectedQuestionInput[];
  try {
    const parsed = JSON.parse(
      String(formData.get("selected_questions_json") ?? "[]")
    );
    if (!Array.isArray(parsed)) throw new Error("invalid");
    rawQuestions = parsed as SelectedQuestionInput[];
  } catch {
    return result("error", "选题数据读取失败，请刷新页面后重试。");
  }

  if (rawQuestions.length < 1 || rawQuestions.length > 100) {
    return result("error", "每套试卷需要选择 1 至 100 道题目。");
  }

  const selectedIds = new Set<string>();
  const questions = [];
  for (const [index, rawQuestion] of rawQuestions.entries()) {
    const questionId = String(rawQuestion.questionId ?? "").trim();
    const points = Number(rawQuestion.points);
    if (!isUuid(questionId)) {
      return result("error", `第 ${index + 1} 道标准题编号不正确。`);
    }
    if (selectedIds.has(questionId)) {
      return result("error", "同一套试卷不能重复使用同一道题。");
    }
    if (!Number.isFinite(points) || points <= 0 || points > 1000) {
      return result(
        "error",
        `第 ${index + 1} 题分值需要大于 0 且不超过 1000。`
      );
    }
    selectedIds.add(questionId);
    questions.push({ questionId, points });
  }

  const { data, error } = await supabase.rpc(
    "create_assessment_paper_from_bank",
    {
      p_title: title,
      p_description: description,
      p_paper_type: fixedType,
      p_source_test_id: sourceTestId,
      p_duration_minutes: durationMinutes,
      p_passing_score: passingScore,
      p_allow_resubmission: allowResubmission,
      p_publish: publish,
      p_questions: questions,
    }
  );

  if (error || !data) {
    return result(
      "error",
      friendlyDatabaseError(error?.message, "标准试卷保存失败，请稍后重试。")
    );
  }

  refreshPaperPages(fixedType);
  return result(
    "success",
    publish
      ? "标准试卷已经发布，机构端现在可以选择整卷。"
      : "标准试卷草稿已经保存。"
  );
}

export async function changeAssessmentPaperStatusAction(
  paperId: string,
  type: "homework" | "exam",
  nextStatus: "draft" | "published" | "retired" | "archived",
  _previousState: LearningAssignmentActionState,
  _formData: FormData
): Promise<LearningAssignmentActionState> {
  void _previousState;
  void _formData;
  if (!isUuid(paperId)) return result("error", "试卷编号不正确。");
  const { supabase } = await requireAssessmentPaperManager();
  const { data: canRelease } = await supabase.rpc(
    "current_user_can_release_assessment_papers"
  );
  if (canRelease !== true) {
    return result("error", "只有平台负责人可以改变试卷的机构可见状态。");
  }
  const { error } = await supabase.rpc("change_assessment_paper_status", {
    p_paper_id: paperId,
    p_status: nextStatus,
  });
  if (error) {
    return result(
      "error",
      friendlyDatabaseError(error.message, "试卷状态更新失败，请稍后重试。")
    );
  }
  refreshPaperPages(type);
  return result(
    "success",
    nextStatus === "published"
      ? "试卷已经发布给机构选择。"
      : nextStatus === "retired"
        ? "试卷已停止提供，既有任务不受影响。"
        : nextStatus === "archived"
          ? "试卷已经归档。"
          : "试卷已经转为草稿。"
  );
}

export async function duplicateAssessmentPaperAction(
  paperId: string,
  type: "homework" | "exam",
  _previousState: LearningAssignmentActionState,
  _formData: FormData
): Promise<LearningAssignmentActionState> {
  void _previousState;
  void _formData;
  if (!isUuid(paperId)) return result("error", "试卷编号不正确。");
  const { supabase } = await requireAssessmentPaperManager();
  const { data, error } = await supabase.rpc("duplicate_assessment_paper", {
    p_paper_id: paperId,
  });
  if (error || !data) {
    return result(
      "error",
      friendlyDatabaseError(error?.message, "复制试卷失败，请稍后重试。")
    );
  }
  refreshPaperPages(type);
  return result("success", "已经生成一份新的试卷草稿，可以继续新增其他试卷。");
}

export async function publishAssessmentPaperAction(
  fixedType: "homework" | "exam",
  _previousState: LearningAssignmentActionState,
  formData: FormData
): Promise<LearningAssignmentActionState> {
  void _previousState;
  const { supabase } = await requireAssessmentPaperPublisher();
  const paperId = String(formData.get("paper_id") ?? "").trim();
  const courseId = String(formData.get("course_id") ?? "").trim();
  const targetScope = String(
    formData.get("target_scope") ?? "all_students"
  );
  const targetIds = formData.getAll("target_ids").map(String).filter(isUuid);
  const startsAt = parseKoreanDateTime(
    String(formData.get("starts_at") ?? "")
  );
  const dueAt = parseKoreanDateTime(String(formData.get("due_at") ?? ""));
  const institutionNote = String(
    formData.get("institution_note") ?? ""
  ).trim();
  const unlockAfterChapterCompletion =
    fixedType === "homework" &&
    formData.get("unlock_after_chapter_completion") === "on";
  const dueDaysAfterUnlock = Number(
    String(formData.get("due_days_after_unlock") ?? "3")
  );

  if (!isUuid(paperId)) return result("error", "请选择有效的标准试卷。");
  if (courseId && !isUuid(courseId)) {
    return result("error", "所选机构课程不正确。");
  }
  if (!["all_students", "selected_students"].includes(targetScope)) {
    return result("error", "请选择有效的发布范围。");
  }
  if (targetScope === "selected_students" && targetIds.length === 0) {
    return result("error", "请至少选择一名学生。");
  }
  if (!startsAt || !dueAt || dueAt.getTime() <= startsAt.getTime()) {
    return result("error", "截止时间必须晚于开始时间。");
  }
  if (institutionNote.length > 2000) {
    return result("error", "机构通知不能超过 2000 个字。");
  }
  if (
    unlockAfterChapterCompletion &&
    (!Number.isInteger(dueDaysAfterUnlock) ||
      dueDaysAfterUnlock < 1 ||
      dueDaysAfterUnlock > 30)
  ) {
    return result("error", "完成章节后的提交期限需要填写 1 至 30 天。");
  }

  const { data: paper, error: paperError } = await supabase
    .from("assessment_papers")
    .select("paper_type,status")
    .eq("id", paperId)
    .eq("status", "published")
    .maybeSingle();
  if (paperError || !paper || paper.paper_type !== fixedType) {
    return result("error", "所选试卷不存在、类型不符或已经停止提供。");
  }

  const { data, error } = await supabase.rpc(
    "create_learning_assignment_from_paper_with_unlock",
    {
      p_paper_id: paperId,
      p_course_id: courseId || null,
      p_target_scope: targetScope,
      p_target_ids: targetScope === "selected_students" ? targetIds : [],
      p_starts_at: startsAt.toISOString(),
      p_due_at: dueAt.toISOString(),
      p_institution_note: institutionNote,
      p_unlock_after_chapter_completion: unlockAfterChapterCompletion,
      p_due_days_after_unlock: unlockAfterChapterCompletion
        ? dueDaysAfterUnlock
        : null,
    }
  );

  if (error || !data) {
    return result(
      "error",
      friendlyDatabaseError(error?.message, "试卷发布失败，请稍后重试。")
    );
  }

  refreshPaperPages(fixedType, String(data));
  return result(
    "success",
    fixedType === "homework"
      ? unlockAfterChapterCompletion
        ? "整套作业卷已经发布，学生完成对应章节后开放。"
        : "整套作业卷已经发布给学生。"
      : "整套考试卷已经发布给学生。"
  );
}

export async function replaceChapterTestQuestionsAction(
  testId: string,
  _previousState: LearningAssignmentActionState,
  formData: FormData
): Promise<LearningAssignmentActionState> {
  void _previousState;
  if (!isUuid(testId)) return result("error", "章节测试编号不正确。");
  const { supabase } = await requireAssessmentPaperManager();

  let questionIds: string[];
  try {
    const parsed = JSON.parse(
      String(formData.get("selected_questions_json") ?? "[]")
    );
    if (!Array.isArray(parsed)) throw new Error("invalid");
    questionIds = parsed.map(String);
  } catch {
    return result("error", "随机选题结果读取失败，请重新选题。");
  }
  if (
    questionIds.length < 1 ||
    questionIds.length > 100 ||
    questionIds.some((questionId) => !isUuid(questionId))
  ) {
    return result("error", "章节测试需要选择 1 至 100 道有效题目。");
  }
  if (new Set(questionIds).size !== questionIds.length) {
    return result("error", "章节测试不能包含重复题目。");
  }

  const { data, error } = await supabase.rpc(
    "replace_chapter_test_questions",
    {
      p_test_id: testId,
      p_question_ids: questionIds,
    }
  );
  if (error || data == null) {
    return result(
      "error",
      friendlyDatabaseError(
        error?.message,
        "章节测试题目更新失败，请稍后重试。"
      )
    );
  }

  revalidateDashboard("/dashboard/admin/assignments");
  revalidateDashboard("/dashboard/admin/assignments/chapter-tests");
  revalidateDashboard("/dashboard/admin/question-bank");
  revalidateDashboard("/dashboard/assignments/korean");
  revalidateDashboard("/dashboard/assignments/korean/[testSlug]", "page");
  return result(
    "success",
    `已更新当前章节测试，共 ${Number(data)} 道题；学生新进入测试时立即使用。`
  );
}

export async function updateChapterTestDurationAction(
  testId: string,
  _previousState: LearningAssignmentActionState,
  formData: FormData
): Promise<LearningAssignmentActionState> {
  void _previousState;
  if (!isUuid(testId)) {
    return result("error", "章节测试编号不正确。");
  }

  const durationMinutes = Number(
    String(formData.get("duration_minutes") ?? "").trim()
  );
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 1 ||
    durationMinutes > 180
  ) {
    return result("error", "测试时长需要填写 1 至 180 分钟。");
  }

  const { supabase } = await requireAssessmentPaperManager();
  const { data, error } = await supabase
    .from("chapter_tests")
    .update({ duration_minutes: durationMinutes })
    .eq("id", testId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return result(
      "error",
      friendlyDatabaseError(error?.message, "测试时长保存失败，请稍后重试。")
    );
  }

  revalidateDashboard("/dashboard/admin/assignments");
  revalidateDashboard("/dashboard/admin/assignments/chapter-tests");
  revalidateDashboard("/dashboard/assignments/korean");
  revalidateDashboard("/dashboard/assignments/korean/[testSlug]", "page");
  return result("success", `测试时长已更新为 ${durationMinutes} 分钟。`);
}
