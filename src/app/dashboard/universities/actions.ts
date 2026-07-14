"use server";

import { revalidatePath } from "next/cache";

import { requireActiveUser } from "@/lib/auth";

const admissionStages = [
  "language",
  "bachelor_fresh",
  "bachelor_transfer",
  "master",
  "doctor",
] as const;

const disciplineGroups = [
  "humanities_social",
  "science",
  "natural_sciences",
  "medicine",
] as const;

type AdmissionStage = (typeof admissionStages)[number];
type DisciplineGroup = (typeof disciplineGroups)[number];

export type UniversityAssessmentState = {
  status: "idle" | "success" | "error";
  message: string;
  score?: number;
  resultLabel?: "匹配度较高" | "可以冲刺" | "建议先提升";
  breakdown?: {
    academic: number;
    language: number;
    budget: number;
    discipline: number;
  };
};

function isAdmissionStage(value: string): value is AdmissionStage {
  return admissionStages.includes(value as AdmissionStage);
}

function isDisciplineGroup(value: string): value is DisciplineGroup {
  return disciplineGroups.includes(value as DisciplineGroup);
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function degreeLevelFromTrack(track: AdmissionStage) {
  if (track === "language") return "language";
  if (track === "master") return "master";
  if (track === "doctor") return "doctor";
  return "bachelor";
}

/** 大学模块拆分为多个页面后，写操作需要同步刷新全部相关入口。 */
function revalidateUniversityRoutes() {
  revalidatePath("/dashboard/universities");
  revalidatePath("/dashboard/universities/targets");
  revalidatePath("/dashboard/universities/library");
  revalidatePath("/dashboard/universities/comparison");
}

/** 在学校卡片上切换“四校对比”状态。 */
export async function toggleUniversityComparisonAction(
  universityId: string
) {
  const { supabase, user } = await requireActiveUser();

  const { data: university } = await supabase
    .from("korean_universities")
    .select("id")
    .eq("id", universityId)
    .eq("is_published", true)
    .maybeSingle();

  if (!university) {
    throw new Error("找不到这所大学，请刷新页面后重试。");
  }

  const { data: existing } = await supabase
    .from("student_university_comparisons")
    .select("id")
    .eq("user_id", user.id)
    .eq("university_id", universityId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("student_university_comparisons")
      .delete()
      .eq("id", existing.id)
      .eq("user_id", user.id);

    if (error) throw new Error("移出对比失败，请稍后重试。");
  } else {
    const { error } = await supabase
      .from("student_university_comparisons")
      .insert({ user_id: user.id, university_id: universityId });

    if (error) {
      if (error.message.includes("最多对比四所大学")) {
        throw new Error("每次最多对比四所大学，请先移除一所。");
      }
      throw new Error("加入对比失败，请稍后重试。");
    }
  }

  revalidateUniversityRoutes();
}

/** 从对比页明确移除学校，不使用“切换”语义，避免重复提交后重新加入。 */
export async function removeUniversityComparisonAction(universityId: string) {
  const { supabase, user } = await requireActiveUser();
  const { error } = await supabase
    .from("student_university_comparisons")
    .delete()
    .eq("user_id", user.id)
    .eq("university_id", universityId);

  if (error) throw new Error("移出对比失败，请稍后重试。");
  revalidateUniversityRoutes();
}

/** 一次清空当前学生的对比清单。 */
export async function clearUniversityComparisonsAction() {
  const { supabase, user } = await requireActiveUser();
  const { error } = await supabase
    .from("student_university_comparisons")
    .delete()
    .eq("user_id", user.id);

  if (error) throw new Error("清空对比失败，请稍后重试。");
  revalidateUniversityRoutes();
}

/** 从学校库把大学加入目标列表，保留原来的申请进度管理能力。 */
export async function addLibraryUniversityTargetAction(
  universityId: string,
  formData: FormData
) {
  const { supabase, user } = await requireActiveUser();
  const requestedTrack = String(formData.get("admissionTrack") ?? "language");
  const admissionTrack = isAdmissionStage(requestedTrack)
    ? requestedTrack
    : "language";

  const { data: university } = await supabase
    .from("korean_universities")
    .select("id, name_zh, admission_stages")
    .eq("id", universityId)
    .eq("is_published", true)
    .maybeSingle();

  if (!university) {
    throw new Error("找不到这所大学，请刷新页面后重试。");
  }

  const availableStages = (university.admission_stages ?? []) as string[];
  const finalTrack = availableStages.includes(admissionTrack)
    ? admissionTrack
    : (availableStages[0] as AdmissionStage | undefined) ?? "language";

  const { data: existingTarget } = await supabase
    .from("student_university_targets")
    .select("id")
    .eq("user_id", user.id)
    .eq("university_id", universityId)
    .maybeSingle();

  const payload = {
    university_name: university.name_zh,
    degree_level: degreeLevelFromTrack(finalTrack),
    admission_track: finalTrack,
    status: "researching",
  };

  const { error } = existingTarget
    ? await supabase
        .from("student_university_targets")
        .update(payload)
        .eq("id", existingTarget.id)
        .eq("user_id", user.id)
    : await supabase.from("student_university_targets").insert({
        ...payload,
        user_id: user.id,
        university_id: universityId,
      });

  if (error) throw new Error("加入目标大学失败，请稍后重试。");
  revalidateUniversityRoutes();
}

/** 在“我的目标学校”页面填写完整信息后添加或更新目标。 */
export async function addUniversityTargetFromFormAction(formData: FormData) {
  const { supabase, user } = await requireActiveUser();
  const universityId = String(formData.get("universityId") ?? "");
  const requestedTrack = String(formData.get("admissionTrack") ?? "language");
  const programName = String(formData.get("programName") ?? "").trim();
  const deadline = String(formData.get("deadline") ?? "").trim();
  const priority = Number(formData.get("priority") ?? 3);

  if (!isAdmissionStage(requestedTrack)) {
    throw new Error("请选择有效的申请阶段。");
  }
  if (programName.length > 120) {
    throw new Error("专业名称不能超过 120 个字符。");
  }
  if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
    throw new Error("请选择有效的申请截止日期。");
  }
  if (!Number.isInteger(priority) || priority < 1 || priority > 5) {
    throw new Error("目标优先级需要在 1—5 之间。");
  }

  const { data: university } = await supabase
    .from("korean_universities")
    .select("id, name_zh, admission_stages")
    .eq("id", universityId)
    .eq("is_published", true)
    .maybeSingle();

  if (!university) throw new Error("找不到这所大学，请刷新后重试。");
  const availableStages = university.admission_stages as string[];
  const finalTrack = availableStages.includes(requestedTrack)
    ? requestedTrack
    : (availableStages[0] as AdmissionStage | undefined);
  if (!finalTrack || !isAdmissionStage(finalTrack)) {
    throw new Error("这所大学暂时没有可用的申请阶段。");
  }

  const payload = {
    university_name: university.name_zh,
    program_name: programName || null,
    degree_level: degreeLevelFromTrack(finalTrack),
    admission_track: finalTrack,
    application_deadline: deadline || null,
    priority,
  };
  const { data: existing } = await supabase
    .from("student_university_targets")
    .select("id")
    .eq("user_id", user.id)
    .eq("university_id", universityId)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("student_university_targets")
        .update(payload)
        .eq("id", existing.id)
        .eq("user_id", user.id)
    : await supabase.from("student_university_targets").insert({
        ...payload,
        user_id: user.id,
        university_id: universityId,
        status: "researching",
      });

  if (error) throw new Error("目标学校保存失败，请稍后重试。");
  revalidateUniversityRoutes();
}

/** 只删除当前学生自己的目标记录。 */
export async function deleteUniversityTargetAction(targetId: string) {
  const { supabase, user } = await requireActiveUser();
  const { error } = await supabase
    .from("student_university_targets")
    .delete()
    .eq("id", targetId)
    .eq("user_id", user.id);

  if (error) throw new Error("删除目标学校失败，请稍后重试。");
  revalidateUniversityRoutes();
}

/**
 * 在线评估只提供初步选校参考，不替代大学招生审查或顾问人工判断。
 * 分数在服务端重新计算，避免客户端直接提交伪造结果。
 */
export async function saveUniversityAssessmentAction(
  universityId: string,
  _previousState: UniversityAssessmentState,
  formData: FormData
): Promise<UniversityAssessmentState> {
  const { supabase, user } = await requireActiveUser();
  const admissionStage = String(formData.get("admissionStage") ?? "");
  const disciplineGroup = String(formData.get("disciplineGroup") ?? "");
  const academicScore = Number(formData.get("academicScore"));
  const topikLevel = Number(formData.get("topikLevel"));
  const annualBudgetCny = Number(formData.get("annualBudgetCny"));

  if (!isAdmissionStage(admissionStage) || !isDisciplineGroup(disciplineGroup)) {
    return { status: "error", message: "请选择有效的申请阶段和优势学科。" };
  }

  if (!Number.isFinite(academicScore) || academicScore < 0 || academicScore > 100) {
    return { status: "error", message: "平均成绩需要填写 0—100 之间的数字。" };
  }

  if (!Number.isInteger(topikLevel) || topikLevel < 0 || topikLevel > 6) {
    return { status: "error", message: "请选择有效的韩语能力等级。" };
  }

  if (
    !Number.isFinite(annualBudgetCny) ||
    annualBudgetCny < 20000 ||
    annualBudgetCny > 100000
  ) {
    return { status: "error", message: "年度学费预算需要在 2万—10万元之间。" };
  }

  const { data: university } = await supabase
    .from("korean_universities")
    .select(
      "id, admission_stages, discipline_groups, tuition_min_cny, tuition_max_cny, qs_rank_sort, joongang_rank_sort"
    )
    .eq("id", universityId)
    .eq("is_published", true)
    .maybeSingle();

  if (!university) {
    return { status: "error", message: "学校资料不存在，请刷新页面后重试。" };
  }

  if (!(university.admission_stages as string[]).includes(admissionStage)) {
    return { status: "error", message: "这所大学当前未收录所选申请阶段。" };
  }

  const rank = university.qs_rank_sort ?? university.joongang_rank_sort ?? 700;
  const academicBaseline = rank <= 50 ? 92 : rank <= 150 ? 86 : rank <= 500 ? 80 : 74;
  const academicMatch = clamp(62 + (academicScore - academicBaseline) * 3.2);

  const requiredTopik =
    admissionStage === "language"
      ? 0
      : admissionStage === "bachelor_fresh"
        ? 3
        : 4;
  const languageMatch = clamp(58 + (topikLevel - requiredTopik) * 14);

  const tuitionMidpoint =
    (university.tuition_min_cny + university.tuition_max_cny) / 2;
  const budgetMatch =
    annualBudgetCny >= university.tuition_max_cny
      ? 100
      : annualBudgetCny >= tuitionMidpoint
        ? 82
        : annualBudgetCny >= university.tuition_min_cny
          ? 68
          : 35;

  const disciplineMatch = (university.discipline_groups as string[]).includes(
    disciplineGroup
  )
    ? 100
    : 45;

  const matchScore = clamp(
    academicMatch * 0.45 +
      languageMatch * 0.25 +
      budgetMatch * 0.2 +
      disciplineMatch * 0.1
  );
  const resultLabel =
    matchScore >= 80
      ? "匹配度较高"
      : matchScore >= 62
        ? "可以冲刺"
        : "建议先提升";
  const breakdown = {
    academic: academicMatch,
    language: languageMatch,
    budget: budgetMatch,
    discipline: disciplineMatch,
  };

  const { error } = await supabase.from("student_university_assessments").insert({
    user_id: user.id,
    university_id: universityId,
    admission_stage: admissionStage,
    discipline_group: disciplineGroup,
    academic_score: academicScore,
    topik_level: topikLevel,
    annual_budget_cny: Math.round(annualBudgetCny),
    match_score: matchScore,
    result_label: resultLabel,
    score_breakdown: breakdown,
  });

  if (error) {
    return { status: "error", message: "评估结果保存失败，请稍后重试。" };
  }

  revalidateUniversityRoutes();
  return {
    status: "success",
    message: "初步评估已完成并保存，可以把结果交给顾问进一步复核。",
    score: matchScore,
    resultLabel,
    breakdown,
  };
}
