"use server";

import { revalidatePath } from "next/cache";

import { requireStudentFeature } from "@/lib/student-permissions-server";

const universityStatuses = [
  "researching",
  "preparing",
  "applied",
  "interview",
  "offer",
  "rejected",
  "paused",
];

const defaultDocuments = [
  { document_key: "passport", title: "护照", category: "identity", sort_order: 10 },
  { document_key: "transcript", title: "成绩单", category: "academic", sort_order: 20 },
  { document_key: "graduation", title: "毕业证明", category: "academic", sort_order: 30 },
  { document_key: "study_plan", title: "学习计划书", category: "application", sort_order: 40 },
  { document_key: "recommendation", title: "推荐信", category: "application", sort_order: 50 },
  { document_key: "bank_statement", title: "存款证明", category: "financial", sort_order: 60 },
  { document_key: "language_score", title: "语言成绩证明", category: "language", sort_order: 70 },
];


export async function addUniversityTargetAction(formData: FormData) {
  const { supabase, user } = await requireStudentFeature("university_target");
  const universityName = String(formData.get("universityName") ?? "").trim();
  const programName = String(formData.get("programName") ?? "").trim();
  const degreeLevel = String(formData.get("degreeLevel") ?? "language");
  const deadline = String(formData.get("deadline") ?? "").trim();

  if (universityName.length < 2 || universityName.length > 120) {
    throw new Error("大学名称需要填写 2—120 个字符。");
  }

  const { error } = await supabase.from("student_university_targets").insert({
    user_id: user.id,
    university_name: universityName,
    program_name: programName || null,
    degree_level: degreeLevel,
    application_deadline: deadline || null,
  });

  if (error) throw new Error("目标大学保存失败，请确认数据库迁移已经执行。");
  revalidatePath("/dashboard/universities");
  revalidatePath("/dashboard/universities/targets");
}

export async function updateUniversityStatusAction(id: string, formData: FormData) {
  const { supabase, user } = await requireStudentFeature("university_target");
  const status = String(formData.get("status") ?? "");
  if (!universityStatuses.includes(status)) throw new Error("无效的申请阶段。");

  const { error } = await supabase
    .from("student_university_targets")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error("申请阶段更新失败。");
  revalidatePath("/dashboard/universities");
  revalidatePath("/dashboard/universities/targets");
}

export async function initializeApplicationDocumentsAction() {
  const { supabase, user } = await requireStudentFeature("application_documents");
  const { error } = await supabase.from("student_application_documents").upsert(
    defaultDocuments.map((item) => ({ ...item, user_id: user.id })),
    { onConflict: "user_id,document_key", ignoreDuplicates: true }
  );
  if (error) throw new Error("材料清单创建失败，请确认数据库迁移已经执行。");
  revalidatePath("/dashboard/documents");
}
