"use server";

import { revalidatePath } from "next/cache";

import type { LearningAssignmentActionState } from "@/app/dashboard/assignments/action-state";
import { requireAssessmentPaperManager } from "@/lib/assessment-papers";

const languageSkills = [
  "listening",
  "speaking",
  "reading",
  "writing",
] as const;

const responseModes = new Set([
  "single_choice",
  "short_text",
  "long_text",
  "audio_recording",
  "mixed",
]);

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

export async function saveChapterHomeworkPlanAction(
  planId: string,
  _previousState: LearningAssignmentActionState,
  formData: FormData
): Promise<LearningAssignmentActionState> {
  void _previousState;
  if (!isUuid(planId)) return result("error", "章节作业计划编号不正确。");

  const durationMinutes = Number(formData.get("duration_minutes"));
  const passingScore = Number(formData.get("passing_score"));
  const status = String(formData.get("status") ?? "draft");
  const allowResubmission = formData.get("allow_resubmission") === "on";

  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 1 ||
    durationMinutes > 600
  ) {
    return result("error", "总时长需要填写 1 至 600 分钟。");
  }
  if (!Number.isFinite(passingScore) || passingScore < 0 || passingScore > 100) {
    return result("error", "及格线需要填写 0 至 100。");
  }
  if (!["draft", "published", "archived"].includes(status)) {
    return result("error", "作业计划状态不正确。");
  }

  const settings = languageSkills.map((skill, index) => {
    const responseMode = String(formData.get(`${skill}_response_mode`) ?? "");
    const targetQuestionCount = Number(
      formData.get(`${skill}_target_question_count`)
    );
    const targetPoints = Number(formData.get(`${skill}_target_points`));
    const skillDurationMinutes = Number(
      formData.get(`${skill}_duration_minutes`)
    );
    const instructions = String(
      formData.get(`${skill}_instructions`) ?? ""
    ).trim();

    return {
      plan_id: planId,
      language_skill: skill,
      enabled: formData.get(`${skill}_enabled`) === "on",
      response_mode: responseMode,
      target_question_count: targetQuestionCount,
      target_points: targetPoints,
      duration_minutes: skillDurationMinutes,
      instructions,
      sort_order: index + 1,
    };
  });

  for (const setting of settings) {
    if (!responseModes.has(setting.response_mode)) {
      return result("error", "听说读写的作答方式不正确。");
    }
    if (
      !Number.isInteger(setting.target_question_count) ||
      setting.target_question_count < 0 ||
      setting.target_question_count > 100
    ) {
      return result("error", "每项能力的目标题量需要填写 0 至 100。");
    }
    if (
      !Number.isFinite(setting.target_points) ||
      setting.target_points < 0 ||
      setting.target_points > 1000
    ) {
      return result("error", "每项能力的目标分值需要填写 0 至 1000。");
    }
    if (
      !Number.isInteger(setting.duration_minutes) ||
      setting.duration_minutes < 1 ||
      setting.duration_minutes > 180
    ) {
      return result("error", "每项能力的时长需要填写 1 至 180 分钟。");
    }
    if (setting.instructions.length > 2000) {
      return result("error", "每项能力的说明不能超过 2000 个字。");
    }
  }

  if (settings.some((setting) => !setting.enabled)) {
    return result("error", "每章必须保留听、说、读、写四项能力。");
  }

  const { supabase } = await requireAssessmentPaperManager();
  const { data: plan, error: planError } = await supabase
    .from("chapter_homework_plans")
    .update({
      duration_minutes: durationMinutes,
      passing_score: passingScore,
      allow_resubmission: allowResubmission,
      status,
    })
    .eq("id", planId)
    .select("id")
    .maybeSingle();

  if (planError || !plan) {
    return result("error", "章节作业计划保存失败，请稍后重试。");
  }

  const { error: settingsError } = await supabase
    .from("chapter_homework_skill_settings")
    .upsert(settings, { onConflict: "plan_id,language_skill" });

  if (settingsError) {
    return result("error", "听说读写配置保存失败，请稍后重试。");
  }

  revalidatePath("/dashboard/admin/assignments");
  revalidatePath("/dashboard/admin/assignments/homework");
  return result("success", "章节作业与听说读写配置已保存。");
}

export async function setChapterHomeworkPublicationAction(
  planId: string,
  nextStatus: "draft" | "published",
  _previousState: LearningAssignmentActionState,
  _formData: FormData
): Promise<LearningAssignmentActionState> {
  void _previousState;
  void _formData;
  if (!isUuid(planId)) return result("error", "章节作业计划编号不正确。");

  const { supabase } = await requireAssessmentPaperManager();
  if (nextStatus === "published") {
    const { data: settings, error: settingsError } = await supabase
      .from("chapter_homework_skill_settings")
      .select("language_skill,enabled")
      .eq("plan_id", planId);

    if (settingsError) {
      return result("error", "发布前校验失败，请稍后重试。");
    }

    const enabledSkills = new Set(
      (settings ?? [])
        .filter((setting) => setting.enabled)
        .map((setting) => setting.language_skill)
    );
    if (!languageSkills.every((skill) => enabledSkills.has(skill))) {
      return result("error", "听、说、读、写四项配置齐全后才能发布。");
    }
  }

  const { data: plan, error: planError } = await supabase
    .from("chapter_homework_plans")
    .update({ status: nextStatus })
    .eq("id", planId)
    .select("id")
    .maybeSingle();

  if (planError || !plan) {
    return result(
      "error",
      nextStatus === "published"
        ? "章节作业发布失败，请稍后重试。"
        : "章节作业撤回失败，请稍后重试。"
    );
  }

  revalidatePath("/dashboard/admin/assignments");
  revalidatePath("/dashboard/admin/assignments/homework");
  return result(
    "success",
    nextStatus === "published"
      ? "章节作业已发布。"
      : "章节作业已撤回并转为草稿。"
  );
}
