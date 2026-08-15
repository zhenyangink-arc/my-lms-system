import Link from "next/link";

import { scopeDashboardPath } from "@/lib/dashboard-path";
import { getCourseManagementData } from "../api/service";
import type {
  CourseCatalogNodeKind,
  CourseCatalogChapter,
  CourseCatalogCourse,
  CourseCatalogLesson,
  CourseCategory,
} from "../api/types";
import { CourseCatalogTreeTable } from "./course-catalog-tree";
import type { CourseCatalogTreeRow } from "./course-catalog-tree/columns";
import { CourseCatalogCreateDialog } from "./course-catalog-action-dialogs";
import { CourseCatalogNodeView } from "./course-catalog-node-view";

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

function catalogCompleteness(
  kind: CourseCatalogNodeKind,
  node:
    | CourseCategory
    | CourseCatalogCourse
    | CourseCatalogLesson
    | CourseCatalogChapter,
  childCount: number,
) {
  const checks: Array<[boolean, string]> = [];
  if (kind === "category") {
    const category = node as CourseCategory;
    checks.push(
      [Boolean(category.description), "简介"],
      [Boolean(category.cover_object_key), "配图"],
      [Boolean(category.icon_name), "图标"],
    );
  } else if (kind === "course") {
    const course = node as CourseCatalogCourse;
    checks.push(
      [Boolean(course.description), "简介"],
      [Boolean(course.cover_object_key || course.cover_url), "封面"],
      [Boolean(course.level), "等级"],
      [childCount > 0, "课时"],
    );
  } else if (kind === "lesson") {
    const lesson = node as CourseCatalogLesson;
    checks.push(
      [Boolean(lesson.description), "简介"],
      [Boolean(lesson.cover_object_key), "配图"],
      [
        Boolean(
          lesson.video_object_key || lesson.video_url || lesson.content_text,
        ),
        "主体内容",
      ],
      [Boolean(lesson.learning_objectives), "学习目标"],
      [Boolean(lesson.summary_text), "课时小结"],
    );
  } else {
    const chapter = node as CourseCatalogChapter;
    checks.push(
      [Boolean(chapter.description), "简介"],
      [Boolean(chapter.cover_object_key), "配图"],
      [chapter.duration_minutes > 0, "时长"],
      [Boolean(chapter.completion_rule), "完成条件"],
    );
    if (
      chapter.completion_rule === "test_submitted" ||
      chapter.completion_rule === "test_passed"
    ) {
      checks.push([Boolean(chapter.chapter_test_id), "章节测试"]);
    }
  }
  const completed = checks.filter(([ready]) => ready).length;
  return {
    completeness: checks.length
      ? Math.round((completed / checks.length) * 100)
      : 100,
    missingItems: checks
      .filter(([ready]) => !ready)
      .map(([, label]) => label),
  };
}

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
    const quality = catalogCompleteness("chapter", chapter, chapter.chapter_test_id ? 1 : 0);
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
      ...quality,
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
    const quality = catalogCompleteness("lesson", lesson, children.length);
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
      ...quality,
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
    const quality = catalogCompleteness("course", course, children.length);
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
      ...quality,
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
    const quality = catalogCompleteness("category", category, children.length);
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
      ...quality,
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

export default async function CourseCatalogListing({
  searchParams,
  studentAppId,
  routeBasePath,
}: {
  searchParams: Promise<{ node?: string; id?: string }>;
  studentAppId?: string;
  routeBasePath?: string;
}) {
  const selection = await searchParams;
  const result = await getCourseManagementData(selection, studentAppId);
  const catalogRoute = routeBasePath ?? scopeDashboardPath(
    "/dashboard/admin/courses",
    result.dashboardBasePath,
  );
  const rows = buildCatalogTree(result);
  const selectedKind = ["category", "course", "lesson", "chapter"].includes(
    selection.node ?? "",
  )
    ? (selection.node as CourseCatalogNodeKind)
    : null;
  const selectedNode = selectedKind
    ? selectedKind === "category"
      ? result.categories.find((item) => item.id === selection.id)
      : selectedKind === "course"
        ? result.courses.find((item) => item.id === selection.id)
        : selectedKind === "lesson"
          ? result.lessons.find((item) => item.id === selection.id)
          : result.chapters.find((item) => item.id === selection.id)
    : null;

  return (
    <div className="space-y-4">
      {result.catalogErrorMessage && (
        <p className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          课程目录数据读取失败：{result.catalogErrorMessage}
        </p>
      )}
      {!result.canManage && (
        <p className="border border-[var(--app-border)] bg-[var(--app-soft-bg)] px-4 py-3 text-sm text-[var(--app-muted)]">
          当前账号可以查看平台课程，但只有平台负责人和平台管理员可以修改。
        </p>
      )}
      <section className="overflow-x-auto border border-[var(--app-border)] bg-[var(--app-card-bg)]">
        <table className="w-full min-w-[560px] border-collapse text-left text-xs">
          <thead className="bg-[var(--app-soft-bg)] text-[var(--app-muted)]">
            <tr>
              <th className="px-4 py-2.5 font-semibold">顶级分类</th>
              <th className="px-4 py-2.5 font-semibold">课程</th>
              <th className="px-4 py-2.5 font-semibold">课时</th>
              <th className="px-4 py-2.5 font-semibold">章节</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-[var(--app-border)]">
              <td className="px-4 py-3 font-mono text-base font-semibold">
                {result.categories.filter((item) => !item.parent_id).length}
              </td>
              <td className="px-4 py-3 font-mono text-base font-semibold">
                {result.courses.length}
              </td>
              <td className="px-4 py-3 font-mono text-base font-semibold">
                {result.lessons.length}
              </td>
              <td className="px-4 py-3 font-mono text-base font-semibold">
                {result.chapters.length}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
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
          dashboardBasePath={result.dashboardBasePath}
          routeBasePath={catalogRoute}
        />
      </section>

      {selectedKind && selectedNode && (
        <section id="course-content" className="scroll-mt-20 space-y-4 border-t border-[var(--app-border)] pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--app-text)]">
                内容与资料详情
              </h2>
              <p className="mt-1 text-xs text-[var(--app-muted)]">
                查看当前节点的封面、正文、教学信息和课时资料。
              </p>
            </div>
            <Link
              href={catalogRoute}
              className="inline-flex h-9 items-center border border-[var(--app-border)] px-4 text-xs font-semibold hover:bg-[var(--app-soft-bg)]"
            >
              收起详情
            </Link>
          </div>
          {selectedKind === "category" ? (
            <CourseCatalogNodeView kind="category" node={selectedNode as CourseCategory} />
          ) : selectedKind === "course" ? (
            <CourseCatalogNodeView kind="course" node={selectedNode as CourseCatalogCourse} />
          ) : selectedKind === "lesson" ? (
            <CourseCatalogNodeView
              kind="lesson"
              node={selectedNode as CourseCatalogLesson}
              resources={result.resources}
              resourceErrorMessage={result.resourceErrorMessage}
              canManage={result.canManage}
              canPermanentlyDeleteResources={result.canPermanentlyDeleteResources}
            />
          ) : (
            <CourseCatalogNodeView kind="chapter" node={selectedNode as CourseCatalogChapter} />
          )}
        </section>
      )}
    </div>
  );
}
