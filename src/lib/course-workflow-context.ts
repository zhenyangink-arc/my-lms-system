import type { DigitalTextbookCourse } from "../features/digital-textbook/api/types";

export function workflowChapters(courses: DigitalTextbookCourse[]) {
  return courses.flatMap(course => course.lessons.flatMap(lesson => lesson.textbooks.flatMap(textbook => textbook.chapters.map(chapter => ({
    id: chapter.id,
    lessonId: lesson.id,
    versionId: chapter.versionId,
    label: `${course.title} › ${lesson.title} › ${textbook.title} › 第 ${chapter.number} 章 · 教材版本 ${chapter.versionNumber}（${chapter.versionStatus === "published" ? "已发布" : chapter.versionStatus === "draft" ? "草稿" : "已归档"}）`,
  })))));
}

export function workflowHref(base: string, section: string, chapterId?: string) {
  const query = new URLSearchParams();
  if (chapterId) query.set("chapter", chapterId);
  return `${base}/${section}${query.size ? `?${query}` : ""}`;
}
