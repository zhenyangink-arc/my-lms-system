"use server";

import { revalidatePath } from "next/cache";

import { requireManagementAppAccess } from "@/lib/management-apps";
import { createClient } from "@/lib/supabase/server";

import {
  normalizeMajorIds,
  parseCategoryAccessMode,
  parseUuid,
} from "../major-access.ts";

const STATUSES = new Set(["active", "cancelled"]);

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** 机构：给学生添加或移除所属专业。权限与归属由数据库函数最终校验。 */
export async function setStudentMajorAction(formData: FormData) {
  const access = await requireManagementAppAccess(text(formData, "space"), "university");
  if (access.scope !== "tenant" || !access.tenantId) throw new Error("请进入具体机构的大学课程工作区后再设置学生专业。");
  if (!access.capabilities.manageStudents) throw new Error("当前账号没有管理该应用学生的权限。");
  const studentId = parseUuid(text(formData, "student_id"));
  const categoryId = parseUuid(text(formData, "category_id"));
  const status = text(formData, "status") || "active";
  if (!studentId || !categoryId) throw new Error("请选择学生和专业。");
  if (!STATUSES.has(status)) throw new Error("无效的专业状态。");

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_student_major_enrollment", {
    p_student_id: studentId,
    p_category_id: categoryId,
    p_status: status,
  });
  if (error) throw new Error(`学生专业保存失败：${error.message}`);
  revalidatePath(`${access.appPath}/students`);
}

/** 平台：设置二级分类的可见模式与关联专业。权限由数据库函数最终校验。 */
export async function setCategoryAccessAction(formData: FormData) {
  const access = await requireManagementAppAccess(text(formData, "space"), "university");
  if (access.scope !== "platform" || !access.capabilities.manageContent) throw new Error("只有平台负责人或平台管理员可以设置专业可见范围。");
  const categoryId = parseUuid(text(formData, "category_id"));
  const mode = parseCategoryAccessMode(text(formData, "mode"));
  if (!categoryId || !mode) throw new Error("请选择分类和可见模式。");
  const majorIds = normalizeMajorIds(mode, formData.getAll("major_ids"));
  if (mode === "shared" && majorIds.length === 0) throw new Error("公共课组至少要关联一个专业。");

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_university_category_access", {
    p_category_id: categoryId,
    p_mode: mode,
    p_major_ids: majorIds,
  });
  if (error) throw new Error(`专业可见范围保存失败：${error.message}`);
  revalidatePath(`${access.appPath}/content`);
}
