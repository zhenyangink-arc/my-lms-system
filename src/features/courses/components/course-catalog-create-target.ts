import type {
  CourseCatalogChapter,
  CourseCatalogCourse,
  CourseCatalogLesson,
  CourseCatalogNode,
  CourseCategory,
} from "../api/types";

export type CourseCatalogActionOptions = {
  categories: CourseCategory[];
  courses: CourseCatalogCourse[];
  lessons: CourseCatalogLesson[];
  chapters: CourseCatalogChapter[];
  studentAppId?: string;
};

export type CreateTarget =
  | { kind: "category"; parentId?: string; title: string; sortOrder: number }
  | { kind: "course"; categoryId: string; title: string; sortOrder: number }
  | { kind: "lesson"; courseId: string; title: string; sortOrder: number }
  | { kind: "chapter"; lessonId: string; title: string; sortOrder: number };

export function getCreateChildTarget(
  node: CourseCatalogNode,
  options: CourseCatalogActionOptions,
): CreateTarget | null {
  if ("parent_id" in node) {
    if (!node.parent_id)
      return {
        kind: "category",
        parentId: node.id,
        title: `在"${node.title}"中新建分类`,
        sortOrder:
          options.categories.filter((item) => item.parent_id === node.id)
            .length * 10 + 10,
      };
    return {
      kind: "course",
      categoryId: node.id,
      title: `在"${node.title}"中新建课程`,
      sortOrder:
        options.courses.filter((item) => item.category_id === node.id)
          .length * 10 + 10,
    };
  }
  if ("category_id" in node)
    return {
      kind: "lesson",
      courseId: node.id,
      title: `在"${node.title}"中新建课时`,
      sortOrder:
        options.lessons.filter((item) => item.course_id === node.id).length *
          10 +
        10,
    };
  if ("course_id" in node)
    return {
      kind: "chapter",
      lessonId: node.id,
      title: `在"${node.title}"中新建章节`,
      sortOrder:
        options.chapters.filter((item) => item.lesson_id === node.id)
          .length * 10 + 10,
    };
  return null;
}
