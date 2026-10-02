/** 只保留学生可见范围内的二级分类；范围为 null 表示该应用不限制，原样返回。 */
export function restrictToVisibleSubcategories<T extends { id: string }>(
  subcategories: readonly T[],
  visibleSubcategoryIds: ReadonlySet<string> | null,
): T[] {
  return visibleSubcategoryIds ? subcategories.filter((item) => visibleSubcategoryIds.has(item.id)) : [...subcategories];
}
