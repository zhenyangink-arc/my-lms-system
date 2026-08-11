"use server";

import { revalidateDashboard } from "@/lib/revalidate-dashboard";

import {
  requireStandardQuestionBankManager,
} from "@/lib/question-bank";

export type QuestionBankActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function result(
  status: QuestionBankActionState["status"],
  message: string
): QuestionBankActionState {
  return { status, message };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function databaseMessage(message: string | undefined, fallback: string) {
  if (message && message.length <= 240 && /[\u3400-\u9fff]/u.test(message)) {
    return message;
  }
  return fallback;
}

function refreshQuestionBank() {
  revalidateDashboard("/dashboard/admin/question-bank");
  revalidateDashboard("/dashboard/admin/assignments");
  revalidateDashboard("/dashboard/assignments/korean");
}

export async function saveStandardQuestionAction(
  _previousState: QuestionBankActionState,
  formData: FormData
): Promise<QuestionBankActionState> {
  void _previousState;
  const { supabase } = await requireStandardQuestionBankManager();
  const questionId = String(formData.get("question_id") ?? "").trim();
  const testId = String(formData.get("test_id") ?? "").trim();
  const questionType = String(
    formData.get("question_type") ?? "single_choice"
  );
  const prompt = String(formData.get("prompt") ?? "").trim();
  const options = [
    ...new Set(
      String(formData.get("options_text") ?? "")
        .split(/\r?\n/u)
        .map((option) => option.trim())
        .filter(Boolean)
    ),
  ];
  const correctOptionNumber = Number(
    String(formData.get("correct_option_number") ?? "")
  );
  const correctAnswer = String(
    formData.get("correct_answer") ?? ""
  ).trim();
  const explanation = String(formData.get("explanation") ?? "").trim();
  const skill = String(formData.get("skill") ?? "").trim();
  const defaultPoints = Number(formData.get("default_points"));
  const difficulty = String(formData.get("difficulty") ?? "foundation");
  const tags = [
    ...new Set(
      String(formData.get("tags_text") ?? "")
        .split(/[,，]/u)
        .map((tag) => tag.trim())
        .filter(Boolean)
    ),
  ];
  const status = String(formData.get("status") ?? "draft");
  const ebookSectionStep = String(
    formData.get("ebook_section_step") ?? ""
  ).trim();
  const ebookPageReference = String(
    formData.get("ebook_page_reference") ?? ""
  ).trim();

  if (questionId && !isUuid(questionId)) {
    return result("error", "题目编号不正确。");
  }
  if (!isUuid(testId)) {
    return result("error", "请选择课程章节。");
  }
  if (questionType !== "single_choice") {
    return result("error", "章节测试题库只允许四选一题。");
  }
  if (prompt.length < 1 || prompt.length > 3000) {
    return result("error", "题目不能为空且不能超过 3000 个字。");
  }
  if (skill.length < 1 || skill.length > 80) {
    return result("error", "知识点需要填写 1 至 80 个字。");
  }
  if (
    !Number.isFinite(defaultPoints) ||
    defaultPoints <= 0 ||
    defaultPoints > 1000
  ) {
    return result("error", "默认分值需要大于 0 且不超过 1000。");
  }
  if (questionType === "single_choice" && options.length !== 4) {
    return result("error", "韩语字母入门单选题必须填写四个不同选项（A～D）。");
  }
  if (
    questionType === "single_choice" &&
    (!Number.isInteger(correctOptionNumber) ||
      correctOptionNumber < 1 ||
      correctOptionNumber > options.length)
  ) {
    return result("error", "请填写正确答案对应的选项序号。");
  }
  if (explanation.length > 3000) {
    return result("error", "解析不能超过 3000 个字。");
  }
  if (!["foundation", "medium"].includes(difficulty)) {
    return result("error", "章节测试题难度必须是基础或中等。");
  }
  if (!/^STEP 0[1-8]$/u.test(ebookSectionStep)) {
    return result("error", "请选择电子书目录来源。");
  }
  if (ebookPageReference.length > 80) {
    return result("error", "电子书页码说明不能超过 80 个字。");
  }

  const { error } = await supabase.rpc("save_standard_question", {
    p_question_id: questionId || null,
    p_test_id: testId,
    p_question_type: questionType,
    p_prompt: prompt,
    p_options: questionType === "single_choice" ? options : [],
    p_correct_option:
      questionType === "single_choice" ? correctOptionNumber - 1 : null,
    p_correct_answer:
      questionType === "single_choice" ? null : correctAnswer || null,
    p_explanation: explanation,
    p_skill: skill,
    p_default_points: defaultPoints,
    p_difficulty: difficulty,
    p_tags: tags,
    p_status: status,
    p_ebook_section_step: ebookSectionStep,
    p_ebook_page_reference: ebookPageReference,
  });

  if (error) {
    return result(
      "error",
      databaseMessage(error.message, "题目保存失败，请稍后重试。")
    );
  }

  refreshQuestionBank();
  return result(
    "success",
    questionId ? "题目已经更新并生成新版本。" : "章节测试题已经创建。"
  );
}

export async function deleteStandardQuestionAction(
  questionId: string,
  _previousState: QuestionBankActionState,
  _formData: FormData
): Promise<QuestionBankActionState> {
  void _previousState;
  void _formData;
  if (!isUuid(questionId)) return result("error", "题目编号不正确。");

  const { supabase } = await requireStandardQuestionBankManager();
  const { error } = await supabase.rpc("delete_standard_question", {
    p_question_id: questionId,
  });

  if (error) {
    return result(
      "error",
      databaseMessage(error.message, "题目删除失败，请稍后重试。")
    );
  }

  refreshQuestionBank();
  return result("success", "题目已经从标准题库删除。");
}
