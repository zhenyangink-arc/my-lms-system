const steps = [
  { key: "content", title: "课程结构", responsibility: "课程、课时与开放规则", boundary: "维护目录、顺序和教材关联；教材正文在教材制作中维护，普通课时保留自身内容功能。" },
  { key: "textbooks", title: "教材制作", responsibility: "章节内容与教材发布", boundary: "维护词汇、语法和互动内容。第一章通过内容工作台校验并发布教材；章节与关联测试的发布是另一项操作，不会更新教材快照。" },
  { key: "teaching-scripts", title: "教学脚本", responsibility: "教师讲解与教学编排", boundary: "维护教师讲解、任务、提问与反馈。发布脚本不等于发布教材；教材快照更新仍需回到教材制作完成校验。" },
  { key: "toolbox", title: "练习工具", responsibility: "材料引用、独立资源与工具设置", boundary: "章节材料引用、独立资源副本和学生工具入口分别管理；确认引用不生成题目，复制后不与教材自动同步。" },
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

export const practiceSourceNotice = "教材导入内容是独立副本，不会随教材自动更新；在这里修改也不会改动教材。保存后会影响学生端练习中实际读取这些资源的入口，不等于发布教材或生成专项题目，请先核对内容。";

/** Prefer published content; otherwise use the latest available version. */
export function selectTextbookVersion<T extends { version_number: unknown; status: unknown }>(versions: T[]) {
  const ordered = [...versions].sort((a, b) => Number(b.version_number) - Number(a.version_number));
  const selected = ordered.find(version => version.status === "published") ?? ordered[0];
  const newerDraft = selected ? ordered.find(version => version.status === "draft" && Number(version.version_number) > Number(selected.version_number)) : undefined;
  return { selected, newerDraft };
}
