"use server";

import { revalidatePath } from "next/cache";

import { requireStudentFeature } from "@/lib/student-permissions-server";

const universityStatuses = ["researching", "preparing"];

export async function addUniversityTargetAction(formData: FormData) {
  const { supabase, user } = await requireStudentFeature("university_target");
  const universityName = String(formData.get("universityName") ?? "").trim();
  const programName = String(formData.get("programName") ?? "").trim();
  const degreeLevel = String(formData.get("degreeLevel") ?? "language");

  if (universityName.length < 2 || universityName.length > 120) {
    throw new Error("大学名称需要填写 2—120 个字符。");
  }

  const { error } = await supabase.from("student_university_targets").insert({
    user_id: user.id,
    university_name: universityName,
    program_name: programName || null,
    degree_level: degreeLevel,
  });

  if (error) throw new Error("目标大学保存失败，请确认数据库迁移已经执行。");
  revalidatePath("/dashboard/universities");
  revalidatePath("/dashboard/universities/targets");
}

export async function updateUniversityStatusAction(id: string, formData: FormData) {
  const { supabase, user } = await requireStudentFeature("university_target");
  const status = String(formData.get("status") ?? "");
  if (!universityStatuses.includes(status)) throw new Error("无效的申请阶段。");

  const { data: existing } = await supabase
    .from("student_university_targets")
    .select("id, documents_locked_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!existing) throw new Error("找不到这个目标大学。");
  if (existing.documents_locked_at !== null) {
    throw new Error("这份申请表已锁定，请联系管理员解锁后再修改。");
  }

  const { error } = await supabase
    .from("student_university_targets")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error("申请阶段更新失败。");
  revalidatePath("/dashboard/universities");
  revalidatePath("/dashboard/universities/targets");
  revalidatePath("/dashboard/documents");
}
