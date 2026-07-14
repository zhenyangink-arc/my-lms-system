"use server";

import { revalidatePath } from "next/cache";

import { requireActiveUser } from "@/lib/auth";

const universityStatuses = [
  "researching",
  "preparing",
  "applied",
  "interview",
  "offer",
  "rejected",
  "paused",
];
const documentStatuses = [
  "not_started",
  "preparing",
  "uploaded",
  "reviewing",
  "approved",
  "revision_required",
];
const visaStatuses = ["pending", "in_progress", "completed", "blocked"];

const defaultDocuments = [
  { document_key: "passport", title: "护照", category: "identity", sort_order: 10 },
  { document_key: "transcript", title: "成绩单", category: "academic", sort_order: 20 },
  { document_key: "graduation", title: "毕业证明", category: "academic", sort_order: 30 },
  { document_key: "study_plan", title: "学习计划书", category: "application", sort_order: 40 },
  { document_key: "recommendation", title: "推荐信", category: "application", sort_order: 50 },
  { document_key: "bank_statement", title: "存款证明", category: "financial", sort_order: 60 },
  { document_key: "language_score", title: "语言成绩证明", category: "language", sort_order: 70 },
];

const defaultVisaTasks = [
  { task_key: "admission", title: "确认标准入学许可书", description: "核对学校名称、课程和入学时间。", sort_order: 10 },
  { task_key: "passport", title: "确认护照有效期", description: "护照有效期应覆盖预计在韩学习时间。", sort_order: 20 },
  { task_key: "financial", title: "准备资金证明", description: "按领馆和学校要求准备存款材料。", sort_order: 30 },
  { task_key: "application", title: "填写签证申请表", description: "确保姓名、护照号和联系方式准确。", sort_order: 40 },
  { task_key: "appointment", title: "预约并提交材料", description: "确认递交地点、时间和所需原件。", sort_order: 50 },
  { task_key: "result", title: "查询签证结果", description: "保存受理凭证并关注补件通知。", sort_order: 60 },
];

export async function addUniversityTargetAction(formData: FormData) {
  const { supabase, user } = await requireActiveUser();
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
  const { supabase, user } = await requireActiveUser();
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
  const { supabase, user } = await requireActiveUser();
  const { error } = await supabase.from("student_application_documents").upsert(
    defaultDocuments.map((item) => ({ ...item, user_id: user.id })),
    { onConflict: "user_id,document_key", ignoreDuplicates: true }
  );
  if (error) throw new Error("材料清单创建失败，请确认数据库迁移已经执行。");
  revalidatePath("/dashboard/documents");
}

export async function updateDocumentStatusAction(id: string, formData: FormData) {
  const { supabase, user } = await requireActiveUser();
  const status = String(formData.get("status") ?? "");
  if (!documentStatuses.includes(status)) throw new Error("无效的材料状态。");

  const { error } = await supabase
    .from("student_application_documents")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error("材料状态更新失败。");
  revalidatePath("/dashboard/documents");
}

export async function initializeVisaTasksAction() {
  const { supabase, user } = await requireActiveUser();
  const { error } = await supabase.from("student_visa_tasks").upsert(
    defaultVisaTasks.map((item) => ({ ...item, user_id: user.id })),
    { onConflict: "user_id,task_key", ignoreDuplicates: true }
  );
  if (error) throw new Error("签证清单创建失败，请确认数据库迁移已经执行。");
  revalidatePath("/dashboard/visa");
}

export async function updateVisaTaskStatusAction(id: string, formData: FormData) {
  const { supabase, user } = await requireActiveUser();
  const status = String(formData.get("status") ?? "");
  if (!visaStatuses.includes(status)) throw new Error("无效的签证任务状态。");

  const { error } = await supabase
    .from("student_visa_tasks")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error("签证任务更新失败。");
  revalidatePath("/dashboard/visa");
}
