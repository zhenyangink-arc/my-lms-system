import "server-only";

import { loadUniversityCategoryScope } from "./major-scope.server";

/**
 * 大学课程对外的“课程可见范围”入口（公开入口之一，见 tests/subject-registry.test.mjs）：
 * 学生只看自己专业、关联公共课组与通识，返回可见的二级分类 id；教职人员与平台账号不受限（null）。
 * 读取失败会抛错，不静默放行也不静默隐藏。
 */
export async function loadUniversityVisibleSubcategoryIds(): Promise<ReadonlySet<string> | null> {
  const scope = await loadUniversityCategoryScope();
  return scope.restricted ? scope.categoryIds : null;
}
