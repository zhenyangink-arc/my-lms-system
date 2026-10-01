import "server-only";

import { createClient } from "@/lib/supabase/server";

import type { UniversityCategoryScope } from "./major-access.ts";

/**
 * 当前用户在大学课程中可见的二级分类（专业、公共课组、通识）。
 * 学生只能看到自己专业、关联公共课组与通识；教职人员和平台账号不受限。
 * 读取失败时抛错，不静默放行，也不静默隐藏。数据库规则见 docs/db-drafts/D9。
 */
export async function loadUniversityCategoryScope(): Promise<UniversityCategoryScope> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("university_category_scope");
  if (error) throw new Error(`大学课程专业范围读取失败：${error.message}`);
  const row = (Array.isArray(data) ? data[0] : data) as { restricted?: boolean; category_ids?: string[] | null } | null | undefined;
  if (!row || typeof row.restricted !== "boolean") throw new Error("大学课程专业范围读取失败：返回格式不正确。");
  return { restricted: row.restricted, categoryIds: new Set(row.category_ids ?? []) };
}
