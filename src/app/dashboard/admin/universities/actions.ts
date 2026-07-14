"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin";

const ownerships = ["national", "public", "private"] as const;
const stages = ["language", "bachelor_fresh", "bachelor_transfer", "master", "doctor"] as const;
const disciplines = ["humanities_social", "science", "natural_sciences", "medicine"] as const;

function optionalInteger(value: FormDataEntryValue | null) {
  if (value === null || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function requiredInteger(formData: FormData, key: string, minimum = 0) {
  const parsed = Number(formData.get(key));
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${key} 不是有效的数字。`);
  }
  return parsed;
}

function revalidateUniversityManagement() {
  revalidatePath("/dashboard/admin/universities");
  revalidatePath("/dashboard/universities");
  revalidatePath("/dashboard/universities/targets");
  revalidatePath("/dashboard/universities/library");
  revalidatePath("/dashboard/universities/comparison");
}

/** 把管理表单转换成数据库字段，并在服务端进行完整校验。 */
function parseUniversityForm(formData: FormData) {
  const nameZh = String(formData.get("nameZh") ?? "").trim();
  const nameKo = String(formData.get("nameKo") ?? "").trim();
  const ownership = String(formData.get("ownership") ?? "");
  const province = String(formData.get("province") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const selectedStages = formData.getAll("admissionStages").map(String).filter((value) => stages.includes(value as (typeof stages)[number]));
  const selectedDisciplines = formData.getAll("disciplineGroups").map(String).filter((value) => disciplines.includes(value as (typeof disciplines)[number]));
  const highlights = String(formData.get("highlights") ?? "")
    .split(/[，,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);

  if (nameZh.length < 2 || nameZh.length > 80) throw new Error("大学中文名称需要填写 2—80 个字符。");
  if (nameKo.length < 2 || nameKo.length > 100) throw new Error("大学韩文名称需要填写 2—100 个字符。");
  if (!ownerships.includes(ownership as (typeof ownerships)[number])) throw new Error("请选择有效的学校性质。");
  if (!province || !city) throw new Error("地区和城市不能为空。");
  if (summary.length < 10 || summary.length > 800) throw new Error("学校介绍需要填写 10—800 个字符。");
  if (selectedStages.length === 0) throw new Error("至少选择一个申请阶段。");
  if (selectedDisciplines.length === 0) throw new Error("至少选择一个优势学科。");

  const tuitionMinKrw = requiredInteger(formData, "tuitionMinKrw");
  const tuitionMaxKrw = requiredInteger(formData, "tuitionMaxKrw");
  const tuitionMinCny = requiredInteger(formData, "tuitionMinCny", 20_000);
  const tuitionMaxCny = requiredInteger(formData, "tuitionMaxCny", 20_000);
  if (tuitionMaxKrw < tuitionMinKrw || tuitionMaxCny < tuitionMinCny) throw new Error("学费上限不能低于下限。");

  return {
    name_zh: nameZh,
    name_ko: nameKo,
    ownership,
    province,
    city,
    admission_stages: selectedStages,
    discipline_groups: selectedDisciplines,
    tuition_min_krw: tuitionMinKrw,
    tuition_max_krw: tuitionMaxKrw,
    tuition_min_cny: tuitionMinCny,
    tuition_max_cny: tuitionMaxCny,
    tuition_reference_year: requiredInteger(formData, "tuitionReferenceYear", 2000),
    qs_rank_display: String(formData.get("qsRankDisplay") ?? "").trim() || null,
    qs_rank_sort: optionalInteger(formData.get("qsRankSort")),
    qs_ranking_year: optionalInteger(formData.get("qsRankingYear")),
    joongang_rank_display: String(formData.get("joongangRankDisplay") ?? "").trim() || null,
    joongang_rank_sort: optionalInteger(formData.get("joongangRankSort")),
    joongang_ranking_year: optionalInteger(formData.get("joongangRankingYear")),
    summary,
    highlights,
    is_featured: formData.get("isFeatured") === "on",
    is_published: formData.get("isPublished") === "on",
    sort_order: requiredInteger(formData, "sortOrder"),
  };
}

/** 管理员新增大学，技术标识由服务端自动生成，不暴露英文配置。 */
export async function createUniversityAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const payload = parseUniversityForm(formData);
  const { error } = await supabase.from("korean_universities").insert({
    ...payload,
    slug: `managed-${randomUUID()}`,
    name_en: payload.name_zh,
  });

  if (error) throw new Error(`新增大学失败：${error.message}`);
  revalidateUniversityManagement();
}

/** 管理员修正学校介绍、地区、学费、排名和筛选标签。 */
export async function updateUniversityAction(universityId: string, formData: FormData) {
  const { supabase } = await requireAdmin();
  const payload = parseUniversityForm(formData);
  const { error } = await supabase
    .from("korean_universities")
    .update(payload)
    .eq("id", universityId);

  if (error) throw new Error(`大学资料更新失败：${error.message}`);
  revalidateUniversityManagement();
}

/** “停止展示”保留历史目标和评估记录，比直接删除学校数据更安全。 */
export async function toggleUniversityPublishedAction(universityId: string, nextPublished: boolean) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("korean_universities")
    .update({ is_published: nextPublished })
    .eq("id", universityId);

  if (error) throw new Error("学校展示状态修改失败。");
  revalidateUniversityManagement();
}
