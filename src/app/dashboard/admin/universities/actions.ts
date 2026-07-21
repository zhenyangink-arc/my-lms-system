"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin";

// randomUUID() 用 Web Crypto API 全局对象获取，node:crypto 在 Edge Runtime 下不可用
const randomUUID = () => crypto.randomUUID();

const ownerships = ["national", "public", "private"] as const;
const stages = ["language", "bachelor_fresh", "bachelor_transfer", "master", "doctor"] as const;
const disciplines = ["humanities_social", "science", "natural_sciences", "medicine"] as const;
const documentCategories = ["identity", "academic", "application", "financial", "language"] as const;
const visaTypes = ["d4_language", "d2_bachelor", "d2_master", "d2_doctor"] as const;
const visaStages = ["admission", "identity", "finance", "application", "appointment", "submission", "result", "entry"] as const;

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

function optionalDate(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("申请截止日期格式不正确。");
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error("申请截止日期不是有效日期。");
  }
  return value;
}

function revalidateUniversityManagement() {
  revalidatePath("/dashboard/admin/universities");
  revalidatePath("/dashboard/admin/documents");
  revalidatePath("/dashboard/admin/visa");
  revalidatePath("/dashboard/visa");
  revalidatePath("/dashboard/documents");
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
  const logoUrl = String(formData.get("logoUrl") ?? "").trim();
  const detailedIntroduction = String(formData.get("detailedIntroduction") ?? "").trim();
  const selectedStages = formData.getAll("admissionStages").map(String).filter((value) => stages.includes(value as (typeof stages)[number]));
  const selectedDisciplines = formData.getAll("disciplineGroups").map(String).filter((value) => disciplines.includes(value as (typeof disciplines)[number]));
  const highlights = String(formData.get("highlights") ?? "")
    .split(/[，,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
  const applicationDeadlines = Object.fromEntries(
    selectedStages.flatMap((stage) => {
      const deadline = optionalDate(formData, `deadline_${stage}`);
      return deadline ? [[stage, deadline]] : [];
    })
  );

  if (nameZh.length < 2 || nameZh.length > 80) throw new Error("大学中文名称需要填写 2—80 个字符。");
  if (nameKo.length < 2 || nameKo.length > 100) throw new Error("大学韩文名称需要填写 2—100 个字符。");
  if (!ownerships.includes(ownership as (typeof ownerships)[number])) throw new Error("请选择有效的学校性质。");
  if (!province || !city) throw new Error("地区和城市不能为空。");
  if (summary.length < 10 || summary.length > 800) throw new Error("学校介绍需要填写 10—800 个字符。");
  if (logoUrl && !/^https?:\/\//i.test(logoUrl)) throw new Error("校徽地址需要使用 http 或 https 链接。");
  if (detailedIntroduction.length > 12000) throw new Error("学校详细介绍不能超过 12000 个字符。");
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
    logo_url: logoUrl || null,
    detailed_introduction: detailedIntroduction || summary,
    highlights,
    application_deadlines: applicationDeadlines,
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

/** 管理员永久删除大学及其关联专业、对比和评估记录。 */
export async function deleteUniversityAction(universityId: string) {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("korean_universities")
    .delete()
    .eq("id", universityId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`删除大学失败：${error.message}`);
  if (!data) throw new Error("大学不存在或当前账号没有删除权限。");
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

/** 为单所大学新增五类申请资料要求；重新添加已删除的同名项目时直接恢复。 */
export async function createUniversityDocumentRequirementAction(
  universityId: string,
  admissionStage: string,
  category: string,
  formData: FormData
) {
  const { supabase } = await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!stages.includes(admissionStage as (typeof stages)[number])) {
    throw new Error("申请阶段无效。");
  }
  if (!documentCategories.includes(category as (typeof documentCategories)[number])) {
    throw new Error("申请资料分类无效。");
  }
  if (title.length < 1 || title.length > 100) {
    throw new Error("申请资料名称需要填写 1–100 个字符。");
  }
  if (description.length > 300) {
    throw new Error("申请资料备注不能超过 300 个字符。");
  }

  const { data: university, error: universityError } = await supabase
    .from("korean_universities")
    .select("id")
    .eq("id", universityId)
    .maybeSingle();

  if (universityError || !university) {
    throw new Error("找不到要维护的大学。");
  }

  const { data: existingRequirements, error: existingError } = await supabase
    .from("university_application_document_requirements")
    .select("id, is_active, title")
    .eq("university_id", universityId)
    .eq("admission_stage", admissionStage)
    .eq("category", category);

  if (existingError) {
    throw new Error(`申请资料检查失败：${existingError.message}`);
  }

  const normalizedTitle = title.toLocaleLowerCase("zh-CN");
  const existing = existingRequirements?.find(
    (requirement) => requirement.title.trim().toLocaleLowerCase("zh-CN") === normalizedTitle
  );

  if (existing?.is_active) {
    throw new Error("这所大学的该分类中已经有同名资料。");
  }

  if (existing) {
    const { error } = await supabase
      .from("university_application_document_requirements")
      .update({ is_active: true, title, description: description || null })
      .eq("id", existing.id)
      .eq("university_id", universityId);

    if (error) throw new Error(`恢复申请资料失败：${error.message}`);
    revalidateUniversityManagement();
    return;
  }

  const { data: lastRequirement, error: sortError } = await supabase
    .from("university_application_document_requirements")
    .select("sort_order")
    .eq("university_id", universityId)
    .eq("admission_stage", admissionStage)
    .eq("category", category)
    .eq("is_active", true)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sortError) throw new Error(`申请资料顺序读取失败：${sortError.message}`);

  const { error } = await supabase
    .from("university_application_document_requirements")
    .insert({
      university_id: universityId,
      requirement_key: `managed-${randomUUID()}`,
      admission_stage: admissionStage,
      category,
      title,
      description: description || null,
      sort_order: (lastRequirement?.sort_order ?? 0) + 10,
    });

  if (error) throw new Error(`新增申请资料失败：${error.message}`);
  revalidateUniversityManagement();
}

/** 直接修改资料名称或分类，并由数据库同步到对应学生申请表。 */
export async function updateUniversityDocumentRequirementAction(
  universityId: string,
  requirementId: string,
  formData: FormData
) {
  const { supabase } = await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const description = String(formData.get("description") ?? "").trim();

  if (!documentCategories.includes(category as (typeof documentCategories)[number])) {
    throw new Error("申请资料分类无效。");
  }
  if (title.length < 1 || title.length > 100) {
    throw new Error("申请资料名称需要填写 1–100 个字符。");
  }
  if (description.length > 300) {
    throw new Error("申请资料备注不能超过 300 个字符。");
  }

  const { data: current, error: currentError } = await supabase
    .from("university_application_document_requirements")
    .select("id, admission_stage, category, sort_order")
    .eq("id", requirementId)
    .eq("university_id", universityId)
    .eq("is_active", true)
    .maybeSingle();

  if (currentError) throw new Error(`申请资料读取失败：${currentError.message}`);
  if (!current) throw new Error("申请资料不存在或已经删除。");

  const { data: categoryRequirements, error: duplicateError } = await supabase
    .from("university_application_document_requirements")
    .select("id, title")
    .eq("university_id", universityId)
    .eq("admission_stage", current.admission_stage)
    .eq("category", category)
    .eq("is_active", true);

  if (duplicateError) throw new Error(`申请资料检查失败：${duplicateError.message}`);

  const normalizedTitle = title.toLocaleLowerCase("zh-CN");
  const hasDuplicate = categoryRequirements?.some(
    (requirement) =>
      requirement.id !== requirementId
      && requirement.title.trim().toLocaleLowerCase("zh-CN") === normalizedTitle
  );
  if (hasDuplicate) throw new Error("这所大学的该分类中已经有同名资料。");

  let sortOrder = current.sort_order;
  if (current.category !== category) {
    const { data: lastRequirement, error: sortError } = await supabase
      .from("university_application_document_requirements")
      .select("sort_order")
      .eq("university_id", universityId)
      .eq("admission_stage", current.admission_stage)
      .eq("category", category)
      .eq("is_active", true)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sortError) throw new Error(`申请资料顺序读取失败：${sortError.message}`);
    sortOrder = (lastRequirement?.sort_order ?? 0) + 10;
  }

  const { data, error } = await supabase
    .from("university_application_document_requirements")
    .update({ title, category, description: description || null, sort_order: sortOrder })
    .eq("id", requirementId)
    .eq("university_id", universityId)
    .eq("is_active", true)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`修改申请资料失败：${error.message}`);
  if (!data) throw new Error("申请资料不存在或已经删除。");
  revalidateUniversityManagement();
}

/** 在同一资料分类中上移或下移，并重新整理为稳定的 10 倍数顺序。 */
export async function moveUniversityDocumentRequirementAction(
  universityId: string,
  requirementId: string,
  direction: "up" | "down"
) {
  const { supabase } = await requireAdmin();
  if (direction !== "up" && direction !== "down") {
    throw new Error("申请资料排序方向无效。");
  }

  const { data: current, error: currentError } = await supabase
    .from("university_application_document_requirements")
    .select("id, admission_stage, category")
    .eq("id", requirementId)
    .eq("university_id", universityId)
    .eq("is_active", true)
    .maybeSingle();

  if (currentError) throw new Error(`申请资料读取失败：${currentError.message}`);
  if (!current) throw new Error("申请资料不存在或已经删除。");

  const { data: requirements, error: requirementsError } = await supabase
    .from("university_application_document_requirements")
    .select("id, university_id, requirement_key, admission_stage, category, title, description, sort_order, is_active")
    .eq("university_id", universityId)
    .eq("admission_stage", current.admission_stage)
    .eq("category", current.category)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  if (requirementsError) throw new Error(`申请资料顺序读取失败：${requirementsError.message}`);

  const currentIndex = requirements?.findIndex((requirement) => requirement.id === requirementId) ?? -1;
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= (requirements?.length ?? 0)) return;

  const reordered = [...(requirements ?? [])];
  [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];

  const { error } = await supabase
    .from("university_application_document_requirements")
    .upsert(
      reordered.map((requirement, index) => ({
        ...requirement,
        sort_order: (index + 1) * 10,
      })),
      { onConflict: "id" }
    );

  if (error) throw new Error(`申请资料排序失败：${error.message}`);
  revalidateUniversityManagement();
}

/** 停用大学资料要求：未提交项会删除，已提交项由数据库安全归档。 */
export async function deleteUniversityDocumentRequirementAction(
  universityId: string,
  requirementId: string
) {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("university_application_document_requirements")
    .update({ is_active: false })
    .eq("id", requirementId)
    .eq("university_id", universityId)
    .eq("is_active", true)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`删除申请资料失败：${error.message}`);
  if (!data) throw new Error("申请资料不存在或已经删除。");
  revalidateUniversityManagement();
}

export async function createUniversityVisaRequirementAction(
  universityId: string,
  visaType: string,
  stage: string,
  formData: FormData
) {
  const { supabase } = await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!visaTypes.includes(visaType as (typeof visaTypes)[number])) {
    throw new Error("签证类型无效。");
  }
  if (!visaStages.includes(stage as (typeof visaStages)[number])) {
    throw new Error("签证资料阶段无效。");
  }
  if (title.length < 1 || title.length > 100) {
    throw new Error("签证资料名称需要填写 1–100 个字符。");
  }
  if (description.length > 300) {
    throw new Error("签证资料备注不能超过 300 个字符。");
  }

  const { data: university, error: universityError } = await supabase
    .from("korean_universities")
    .select("id")
    .eq("id", universityId)
    .maybeSingle();

  if (universityError || !university) throw new Error("找不到要维护的大学。");

  const { data: existingRequirements, error: existingError } = await supabase
    .from("university_visa_application_requirements")
    .select("id, is_active, title")
    .eq("university_id", universityId)
    .eq("visa_type", visaType)
    .eq("stage", stage);

  if (existingError) throw new Error(`签证资料检查失败：${existingError.message}`);

  const normalizedTitle = title.toLocaleLowerCase("zh-CN");
  const existing = existingRequirements?.find(
    (requirement) => requirement.title.trim().toLocaleLowerCase("zh-CN") === normalizedTitle
  );

  if (existing?.is_active) throw new Error("该签证类型中已经有同名资料。");

  if (existing) {
    const { error } = await supabase
      .from("university_visa_application_requirements")
      .update({ is_active: true, title, description: description || null })
      .eq("id", existing.id)
      .eq("university_id", universityId);

    if (error) throw new Error(`恢复签证资料失败：${error.message}`);
    revalidateUniversityManagement();
    return;
  }

  const { data: lastRequirement, error: sortError } = await supabase
    .from("university_visa_application_requirements")
    .select("sort_order")
    .eq("university_id", universityId)
    .eq("visa_type", visaType)
    .eq("stage", stage)
    .eq("is_active", true)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sortError) throw new Error(`签证资料顺序读取失败：${sortError.message}`);

  const { error } = await supabase
    .from("university_visa_application_requirements")
    .insert({
      university_id: universityId,
      visa_type: visaType,
      requirement_key: `managed-${randomUUID()}`,
      stage,
      title,
      description: description || null,
      sort_order: (lastRequirement?.sort_order ?? 0) + 10,
    });

  if (error) throw new Error(`新增签证资料失败：${error.message}`);
  revalidateUniversityManagement();
}

export async function updateUniversityVisaRequirementAction(
  universityId: string,
  requirementId: string,
  formData: FormData
) {
  const { supabase } = await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const stage = String(formData.get("stage") ?? "");
  const description = String(formData.get("description") ?? "").trim();

  if (!visaStages.includes(stage as (typeof visaStages)[number])) {
    throw new Error("签证资料阶段无效。");
  }
  if (title.length < 1 || title.length > 100) {
    throw new Error("签证资料名称需要填写 1–100 个字符。");
  }
  if (description.length > 300) {
    throw new Error("签证资料备注不能超过 300 个字符。");
  }

  const { data: current, error: currentError } = await supabase
    .from("university_visa_application_requirements")
    .select("id, visa_type, stage, sort_order")
    .eq("id", requirementId)
    .eq("university_id", universityId)
    .eq("is_active", true)
    .maybeSingle();

  if (currentError) throw new Error(`签证资料读取失败：${currentError.message}`);
  if (!current) throw new Error("签证资料不存在或已经删除。");

  const { data: stageRequirements, error: duplicateError } = await supabase
    .from("university_visa_application_requirements")
    .select("id, title")
    .eq("university_id", universityId)
    .eq("visa_type", current.visa_type)
    .eq("stage", stage)
    .eq("is_active", true);

  if (duplicateError) throw new Error(`签证资料检查失败：${duplicateError.message}`);

  const normalizedTitle = title.toLocaleLowerCase("zh-CN");
  const hasDuplicate = stageRequirements?.some(
    (requirement) => requirement.id !== requirementId
      && requirement.title.trim().toLocaleLowerCase("zh-CN") === normalizedTitle
  );
  if (hasDuplicate) throw new Error("该签证阶段中已经有同名资料。");

  let sortOrder = current.sort_order;
  if (current.stage !== stage) {
    const { data: lastRequirement, error: sortError } = await supabase
      .from("university_visa_application_requirements")
      .select("sort_order")
      .eq("university_id", universityId)
      .eq("visa_type", current.visa_type)
      .eq("stage", stage)
      .eq("is_active", true)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sortError) throw new Error(`签证资料顺序读取失败：${sortError.message}`);
    sortOrder = (lastRequirement?.sort_order ?? 0) + 10;
  }

  const { data, error } = await supabase
    .from("university_visa_application_requirements")
    .update({ title, stage, description: description || null, sort_order: sortOrder })
    .eq("id", requirementId)
    .eq("university_id", universityId)
    .eq("is_active", true)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`修改签证资料失败：${error.message}`);
  if (!data) throw new Error("签证资料不存在或已经删除。");
  revalidateUniversityManagement();
}

export async function moveUniversityVisaRequirementAction(
  universityId: string,
  requirementId: string,
  direction: "up" | "down"
) {
  const { supabase } = await requireAdmin();
  if (direction !== "up" && direction !== "down") throw new Error("签证资料排序方向无效。");

  const { data: current, error: currentError } = await supabase
    .from("university_visa_application_requirements")
    .select("id, visa_type, stage")
    .eq("id", requirementId)
    .eq("university_id", universityId)
    .eq("is_active", true)
    .maybeSingle();

  if (currentError) throw new Error(`签证资料读取失败：${currentError.message}`);
  if (!current) throw new Error("签证资料不存在或已经删除。");

  const { data: requirements, error: requirementsError } = await supabase
    .from("university_visa_application_requirements")
    .select("id, university_id, visa_type, requirement_key, stage, title, description, sort_order, is_active")
    .eq("university_id", universityId)
    .eq("visa_type", current.visa_type)
    .eq("stage", current.stage)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  if (requirementsError) throw new Error(`签证资料顺序读取失败：${requirementsError.message}`);

  const currentIndex = requirements?.findIndex((requirement) => requirement.id === requirementId) ?? -1;
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= (requirements?.length ?? 0)) return;

  const reordered = [...(requirements ?? [])];
  [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];

  const { error } = await supabase
    .from("university_visa_application_requirements")
    .upsert(
      reordered.map((requirement, index) => ({
        ...requirement,
        sort_order: (index + 1) * 10,
      })),
      { onConflict: "id" }
    );

  if (error) throw new Error(`签证资料排序失败：${error.message}`);
  revalidateUniversityManagement();
}

export async function deleteUniversityVisaRequirementAction(
  universityId: string,
  requirementId: string
) {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("university_visa_application_requirements")
    .update({ is_active: false })
    .eq("id", requirementId)
    .eq("university_id", universityId)
    .eq("is_active", true)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`删除签证资料失败：${error.message}`);
  if (!data) throw new Error("签证资料不存在或已经删除。");
  revalidateUniversityManagement();
}
