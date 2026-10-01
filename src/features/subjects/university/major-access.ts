// 大学课程“专业可见范围”的纯逻辑（可见模式、表单解析）；数据库规则见 docs/db-drafts/D9。

export const CATEGORY_ACCESS_MODES = ["major", "shared", "public"] as const;
export type CategoryAccessMode = (typeof CATEGORY_ACCESS_MODES)[number];

export const CATEGORY_ACCESS_MODE_LABELS: Record<CategoryAccessMode, string> = {
  major: "专业（只有选了该专业的学生可见）",
  shared: "公共课组（选了任一关联专业的学生可见）",
  public: "通识（所有学生可见）",
};

export function parseCategoryAccessMode(value: unknown): CategoryAccessMode | null {
  return typeof value === "string" && (CATEGORY_ACCESS_MODES as readonly string[]).includes(value)
    ? (value as CategoryAccessMode)
    : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseUuid(value: unknown): string | null {
  return typeof value === "string" && UUID.test(value) ? value : null;
}

/** 非 shared 模式不带关联专业；shared 模式下去重并丢弃无效 id。 */
export function normalizeMajorIds(mode: CategoryAccessMode, values: unknown[]): string[] {
  if (mode !== "shared") return [];
  return [...new Set(values.map(parseUuid).filter((id): id is string => id !== null))];
}

/** 学生范围：restricted 为 false 表示不受限；否则只能看 ids 里的二级分类。 */
export type UniversityCategoryScope = { restricted: boolean; categoryIds: ReadonlySet<string> };

export function isCategoryVisible(scope: UniversityCategoryScope, categoryId: string): boolean {
  return !scope.restricted || scope.categoryIds.has(categoryId);
}

export function filterVisibleCategories<T extends { id: string }>(scope: UniversityCategoryScope, categories: readonly T[]): T[] {
  return scope.restricted ? categories.filter((category) => scope.categoryIds.has(category.id)) : [...categories];
}
