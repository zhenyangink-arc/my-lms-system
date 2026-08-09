import { getCourseManagementData } from "../api/service";
import type {
  CourseCatalogChapter,
  CourseCatalogCourse,
  CourseCatalogLesson,
  CourseCategory,
} from "../api/types";
import { CourseCatalogTreeTable } from "./course-catalog-tree";
import type { CourseCatalogTreeRow } from "./course-catalog-tree/columns";
import { CourseCatalogCreateDialog } from "./course-catalog-action-dialogs";

const KIND_LABELS = {
  category: "分类",
  course: "课程",
  lesson: "课时",
  chapter: "章节",
} as const;

const UNLOCK_LABELS: Record<string, string> = {
  immediate: "立即开放",
  previous_completed: "完成上一项后开放",
  prerequisite_completed: "完成指定前置内容后开放",
  prerequisite_passed: "通过指定前置内容后开放",
  scheduled: "定时开放",
  manual: "管理员确认",
};

function buildCatalogTree({
  categories,
  courses,
  lessons,
  chapters,
}: {
  categories: CourseCategory[];
  courses: CourseCatalogCourse[];
  lessons: CourseCatalogLesson[];
  chapters: CourseCatalogChapter[];
}) {
  const categoriesByParent = new Map<string, CourseCategory[]>();
  const coursesByCategory = new Map<string, CourseCatalogCourse[]>();
  const lessonsByCourse = new Map<string, CourseCatalogLesson[]>();
  const chaptersByLesson = new Map<string, CourseCatalogChapter[]>();

  for (const category of categories) {
    if (!category.parent_id) continue;
    categoriesByParent.set(category.parent_id, [
      ...(categoriesByParent.get(category.parent_id) ?? []),
      category,
    ]);
  }
  for (const course of courses) {
    if (!course.category_id) continue;
    coursesByCategory.set(course.category_id, [
      ...(coursesByCategory.get(course.category_id) ?? []),
      course,
    ]);
  }
  for (const lesson of lessons) {
    lessonsByCourse.set(lesson.course_id, [
      ...(lessonsByCourse.get(lesson.course_id) ?? []),
      lesson,
    ]);
  }
  for (const chapter of chapters) {
    chaptersByLesson.set(chapter.lesson_id, [
      ...(chaptersByLesson.get(chapter.lesson_id) ?? []),
      chapter,
    ]);
  }

  const visitedCategories = new Set<string>();
  const visitedCourses = new Set<string>();
  const visitedLessons = new Set<string>();
  const visitedChapters = new Set<string>();

  function chapterRow(
    chapter: CourseCatalogChapter,
    parentTitle: string,
  ): CourseCatalogTreeRow {
    visitedChapters.add(chapter.id);
    return {
      key: `chapter:${chapter.id}`,
      id: chapter.id,
      kind: "chapter",
      kindLabel: KIND_LABELS.chapter,
      title: chapter.title,
      slug: chapter.slug,
      parentTitle,
      contentLabel: chapter.chapter_test_id
        ? "已关联章节测试"
        : `${chapter.duration_minutes} 分钟`,
      unlockMode: UNLOCK_LABELS[chapter.unlock_mode] ?? "未设置",
      isPublished: chapter.is_published,
      isLocked: chapter.is_manually_locked,
      sortOrder: chapter.sort_order,
      node: chapter,
      children: [],
    };
  }

  function lessonRow(
    lesson: CourseCatalogLesson,
    parentTitle: string,
  ): CourseCatalogTreeRow {
    visitedLessons.add(lesson.id);
    const children = (chaptersByLesson.get(lesson.id) ?? []).map((chapter) =>
      chapterRow(chapter, lesson.title),
    );
    return {
      key: `lesson:${lesson.id}`,
      id: lesson.id,
      kind: "lesson",
      kindLabel: KIND_LABELS.lesson,
      title: lesson.title,
      slug: lesson.slug,
      parentTitle,
      contentLabel: `${children.length} 个章节`,
      unlockMode: UNLOCK_LABELS[lesson.unlock_mode] ?? "未设置",
      isPublished: lesson.is_published,
      isLocked: lesson.is_manually_locked,
      sortOrder: lesson.sort_order,
      node: lesson,
      children,
    };
  }

  function courseRow(
    course: CourseCatalogCourse,
    parentTitle: string,
  ): CourseCatalogTreeRow {
    visitedCourses.add(course.id);
    const children = (lessonsByCourse.get(course.id) ?? []).map((lesson) =>
      lessonRow(lesson, course.title),
    );
    return {
      key: `course:${course.id}`,
      id: course.id,
      kind: "course",
      kindLabel: KIND_LABELS.course,
      title: course.title,
      slug: course.slug,
      parentTitle,
      contentLabel: `${children.length} 个课时`,
      unlockMode: UNLOCK_LABELS[course.unlock_mode] ?? "未设置",
      isPublished: course.is_published,
      isLocked: course.is_manually_locked,
      sortOrder: course.sort_order,
      node: course,
      children,
    };
  }

  function categoryRow(
    category: CourseCategory,
    parentTitle: string,
  ): CourseCatalogTreeRow {
    visitedCategories.add(category.id);
    const childCategories = (categoriesByParent.get(category.id) ?? [])
      .filter((child) => !visitedCategories.has(child.id))
      .map((child) => categoryRow(child, category.title));
    const childCourses = (coursesByCategory.get(category.id) ?? []).map(
      (course) => courseRow(course, category.title),
    );
    const children = [...childCategories, ...childCourses];
    return {
      key: `category:${category.id}`,
      id: category.id,
      kind: "category",
      kindLabel: KIND_LABELS.category,
      title: category.title,
      slug: category.slug,
      parentTitle,
      contentLabel: `${children.length} 个下级内容`,
      unlockMode: "不适用",
      isPublished: category.is_published,
      isLocked: false,
      sortOrder: category.sort_order,
      node: category,
      children,
    };
  }

  const roots = categories
    .filter((category) => !category.parent_id)
    .map((category) => categoryRow(category, "顶级目录"));
  for (const category of categories) {
    if (!visitedCategories.has(category.id)) {
      roots.push(categoryRow(category, "未归类"));
    }
  }
  for (const course of courses) {
    if (!visitedCourses.has(course.id)) roots.push(courseRow(course, "未归类"));
  }
  for (const lesson of lessons) {
    if (!visitedLessons.has(lesson.id)) roots.push(lessonRow(lesson, "未归类"));
  }
  for (const chapter of chapters) {
    if (!visitedChapters.has(chapter.id)) {
      roots.push(chapterRow(chapter, "未归类"));
    }
  }
  return roots;
}

export default async function CourseCatalogListing() {
  const result = await getCourseManagementData();
  const rows = buildCatalogTree(result);

  return (
    <div className="space-y-4">
      {result.catalogErrorMessage && (
        <p className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          课程目录数据读取失败：{result.catalogErrorMessage}
        </p>
      )}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--app-text)]">
              课程目录结构
            </h2>
            <p className="mt-1 text-xs text-[var(--app-muted)]">
              按分类、课程、课时和章节查看并维护平台课程层级。
            </p>
          </div>
          {result.canManage && (
            <CourseCatalogCreateDialog
              primary
              target={{
                kind: "category",
                title: "新建顶级分类",
                sortOrder:
                  result.categories.filter((item) => !item.parent_id).length *
                    10 +
                  10,
              }}
            />
          )}
        </div>
        <CourseCatalogTreeTable
          data={rows}
          canManage={result.canManage}
          categories={result.categories}
          courses={result.courses}
          lessons={result.lessons}
          chapters={result.chapters}
        />
      </section>
    </div>
  );
}
