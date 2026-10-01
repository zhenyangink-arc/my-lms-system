import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

import type { UniversityStudentScope } from "./major-access.ts";

/**
 * 当前用户在大学课程中可见的二级分类（专业、公共课组、通识）。
 * 学生只能看到自己专业、关联公共课组与通识；教职人员和平台账号不受限。
 * 读取失败时抛错，不静默放行，也不静默隐藏。数据库规则见 docs/db-drafts/D9。
 *
 * 用 React `cache` 在同一次请求里去重：布局拦截、页面过滤、资料库会各调一次，只查一次库。
 */
export const loadUniversityCategoryScope = cache(async (): Promise<UniversityStudentScope> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("university_category_scope");
  if (error) throw new Error(`大学课程专业范围读取失败：${error.message}`);
  const row = (Array.isArray(data) ? data[0] : data) as { restricted?: boolean; category_ids?: string[] | null } | null | undefined;
  if (!row || typeof row.restricted !== "boolean") throw new Error("大学课程专业范围读取失败：返回格式不正确。");
  if (!row.restricted) return { restricted: false, categoryIds: new Set(), hasActiveMajor: true };

  // 学生：再查一次自己是否有生效的专业（只读自己的记录），用来决定是否提示“还没有所属专业”
  const { count, error: majorError } = await supabase
    .from("student_major_enrollments")
    .select("category_id", { count: "exact", head: true })
    .eq("status", "active");
  if (majorError) throw new Error(`大学课程专业读取失败：${majorError.message}`);
  return { restricted: true, categoryIds: new Set(row.category_ids ?? []), hasActiveMajor: (count ?? 0) > 0 };
});
