const steps = [
  { key: "content", title: "课程结构" },
  { key: "textbooks", title: "教材制作" },
  { key: "teaching-scripts", title: "教学脚本" },
  { key: "toolbox", title: "练习工具" },
] as const;

/** Navigation only; destination pages retain their own authorization checks. */
export function courseContentSteps(access: {
  app: { slug: string };
  scope: string;
  globalRole: string | null;
  capabilities: { manageContent: boolean };
}) {
  if (access.app.slug !== "korean" || !access.capabilities.manageContent) return [];
  return steps.filter((step) => step.key !== "teaching-scripts" || (
    access.scope === "platform" && access.globalRole === "platform_owner"
  ));
}

export function practiceSourceLabel(source: string) {
  return source === "textbook" ? "教材导入副本" : "独立练习资源";
}

export const practiceSourceNotice = "教材导入内容是独立副本，不会随教材自动更新；在这里修改也不会改动教材。保存后会影响学生端练习，请先核对内容。";

/** Prefer published content; otherwise use the latest available version. */
export function selectTextbookVersion<T extends { version_number: unknown; status: unknown }>(versions: T[]) {
  const ordered = [...versions].sort((a, b) => Number(b.version_number) - Number(a.version_number));
  const selected = ordered.find(version => version.status === "published") ?? ordered[0];
  const newerDraft = selected ? ordered.find(version => version.status === "draft" && Number(version.version_number) > Number(selected.version_number)) : undefined;
  return { selected, newerDraft };
}
