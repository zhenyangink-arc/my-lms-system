"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin";
import { schoolCategories } from "./school-config";

const categoryValues = schoolCategories.map((item) => item.value) as string[];
const ownershipValues = ["national", "public", "private", "other"];
const stageValues = ["language", "bachelor_fresh", "bachelor_transfer", "master", "doctor", "high_school", "vocational", "technical", "other"];
const disciplineValues = ["humanities_social", "science", "natural_sciences", "medicine", "arts", "engineering", "other"];

function textValue(formData: FormData, key: string, maxLength: number) {
  return String(formData.get(key) ?? "").trim().slice(0, maxLength);
}

function revalidateSchoolRoutes(categorySlug?: string, schoolId?: string) {
  revalidatePath("/dashboard/admin/schools");
  if (categorySlug) revalidatePath(`/dashboard/admin/schools/${categorySlug}`);
  if (categorySlug && schoolId) revalidatePath(`/dashboard/admin/schools/${categorySlug}/${schoolId}`);
  revalidatePath("/dashboard/admin/universities");
  revalidatePath("/dashboard/universities/library");
}

function parseSchoolForm(formData: FormData) {
  const category = textValue(formData, "category", 40);
  const nameZh = textValue(formData, "nameZh", 120);
  const ownership = textValue(formData, "ownership", 30);
  if (!categoryValues.includes(category)) throw new Error("无效的学校分类。");
  if (nameZh.length < 2) throw new Error("学校名称至少需要两个字符。");
  if (!ownershipValues.includes(ownership)) throw new Error("请选择有效的学校性质。");

  return {
    category,
    name_zh: nameZh,
    name_local: textValue(formData, "nameLocal", 160) || null,
    logo_url: textValue(formData, "logoUrl", 800) || null,
    ownership,
    province: textValue(formData, "province", 80) || null,
    city: textValue(formData, "city", 80) || null,
    summary: textValue(formData, "summary", 1200) || null,
    detailed_introduction: textValue(formData, "detailedIntroduction", 12000) || null,
    is_published: formData.get("isPublished") === "on",
    is_featured: formData.get("isFeatured") === "on",
    sort_order: Math.max(0, Number(formData.get("sortOrder") ?? 0) || 0),
  };
}

export async function createSchoolAction(categorySlug: string, formData: FormData) {
  const { supabase } = await requireAdmin();
  const payload = parseSchoolForm(formData);
  const { error } = await supabase.from("schools").insert({ ...payload, slug: `${payload.category}-${randomUUID()}` });
  if (error) throw new Error(`新增学校失败：${error.message}`);
  revalidateSchoolRoutes(categorySlug);
}

export async function updateSchoolAction(categorySlug: string, schoolId: string, formData: FormData) {
  const { supabase } = await requireAdmin();
  const payload = parseSchoolForm(formData);
  const { data: school, error: readError } = await supabase.from("schools").select("source_korean_university_id").eq("id", schoolId).maybeSingle();
  if (readError || !school) throw new Error("找不到要更新的学校。");

  const { error } = await supabase.from("schools").update(payload).eq("id", schoolId);
  if (error) throw new Error(`学校资料更新失败：${error.message}`);

  // 韩国大学仍是学生目标与对比的关联源，因此同步更新兼容表。
  if (school.source_korean_university_id) {
    const { error: koreanError } = await supabase.from("korean_universities").update({
      name_zh: payload.name_zh,
      name_ko: payload.name_local || payload.name_zh,
      logo_url: payload.logo_url,
      ownership: payload.ownership === "other" ? "private" : payload.ownership,
      province: payload.province || "待完善",
      city: payload.city || "待完善",
      summary: payload.summary || "学校资料正在完善中。",
      detailed_introduction: payload.detailed_introduction,
      is_published: payload.is_published,
      is_featured: payload.is_featured,
      sort_order: payload.sort_order,
    }).eq("id", school.source_korean_university_id);
    if (koreanError) throw new Error(`韩国大学兼容数据同步失败：${koreanError.message}`);
  }
  revalidateSchoolRoutes(categorySlug, schoolId);
}

export async function toggleSchoolPublishedAction(categorySlug: string, schoolId: string, nextPublished: boolean) {
  const { supabase } = await requireAdmin();
  const { data: school } = await supabase.from("schools").select("source_korean_university_id").eq("id", schoolId).maybeSingle();
  const { error } = await supabase.from("schools").update({ is_published: nextPublished }).eq("id", schoolId);
  if (error) throw new Error("学校展示状态更新失败。");
  if (school?.source_korean_university_id) await supabase.from("korean_universities").update({ is_published: nextPublished }).eq("id", school.source_korean_university_id);
  revalidateSchoolRoutes(categorySlug, schoolId);
}

function parseProgramForm(formData: FormData) {
  const nameZh = textValue(formData, "nameZh", 160);
  const educationStage = textValue(formData, "educationStage", 40);
  const disciplineGroup = textValue(formData, "disciplineGroup", 40);
  if (nameZh.length < 2) throw new Error("专业名称至少需要两个字符。");
  if (!stageValues.includes(educationStage) || !disciplineValues.includes(disciplineGroup)) throw new Error("请选择有效的教育阶段和学科类别。");
  return {
    name_zh: nameZh,
    name_local: textValue(formData, "nameLocal", 180) || null,
    education_stage: educationStage,
    discipline_group: disciplineGroup,
    introduction: textValue(formData, "introduction", 5000) || null,
    duration_text: textValue(formData, "durationText", 120) || null,
    tuition_note: textValue(formData, "tuitionNote", 500) || null,
    admission_requirement: textValue(formData, "admissionRequirement", 2000) || null,
    is_published: formData.get("isPublished") === "on",
    sort_order: Math.max(0, Number(formData.get("sortOrder") ?? 0) || 0),
  };
}

export async function createSchoolProgramAction(categorySlug: string, schoolId: string, formData: FormData) {
  const { supabase } = await requireAdmin();
  const payload = parseProgramForm(formData);
  const { error } = await supabase.from("school_programs").insert({ ...payload, school_id: schoolId });
  if (error) throw new Error(`新增专业失败：${error.message}`);
  revalidateSchoolRoutes(categorySlug, schoolId);
}

export async function updateSchoolProgramAction(categorySlug: string, schoolId: string, programId: string, formData: FormData) {
  const { supabase } = await requireAdmin();
  const payload = parseProgramForm(formData);
  const { error } = await supabase.from("school_programs").update(payload).eq("id", programId).eq("school_id", schoolId);
  if (error) throw new Error(`专业更新失败：${error.message}`);
  revalidateSchoolRoutes(categorySlug, schoolId);
}

export async function deleteSchoolProgramAction(categorySlug: string, schoolId: string, programId: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("school_programs").delete().eq("id", programId).eq("school_id", schoolId);
  if (error) throw new Error("专业删除失败。");
  revalidateSchoolRoutes(categorySlug, schoolId);
}
