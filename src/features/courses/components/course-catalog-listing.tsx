import Link from "next/link";
import { ChevronRight, Folders } from "lucide-react";

import {
  ManagementMetricStrip,
  ManagementNotice,
} from "@/components/layout/management-page";
import { scopeDashboardPath } from "@/lib/dashboard-path";
import { getCourseManagementData } from "../api/service";
import type {
  CourseCatalogNodeKind,
  CourseCatalogChapter,
  CourseCatalogCourse,
  CourseCatalogLesson,
  CourseCategory,
} from "../api/types";
import { CourseCatalogFolderTable } from "./course-catalog-tree";
import type { CourseCatalogFolderRow } from "./course-catalog-tree/columns";
import { KIND_DEFAULT_ICON } from "./course-catalog-tree/course-catalog-visuals";
import {
  CourseCatalogCreateDialog,
  CourseCatalogEditDialog,
} from "./course-catalog-action-dialogs";
import { getCreateChildTarget } from "./course-catalog-create-target";
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
      [Number(lesson.duration_minutes) > 0, "时长"],
      [childCount > 0, "章节"],
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

type FolderKind = "category" | "course" | "lesson";
type FolderRef = { kind: FolderKind; id: string };

function parseFolderParam(value?: string): FolderRef | null {
  if (!value) return null;
  const separatorIndex = value.indexOf(":");
  if (separatorIndex === -1) return null;
  const kind = value.slice(0, separatorIndex);
  const id = value.slice(separatorIndex + 1);
  if ((kind === "category" || kind === "course" || kind === "lesson") && id) {
    return { kind, id };
  }
  return null;
}

function folderHref(catalogRoute: string, ref: FolderRef | null) {
  return ref ? `${catalogRoute}?folder=${ref.kind}:${ref.id}` : catalogRoute;
}

function categoryRow(
  category: CourseCategory,
  childCount: number,
): CourseCatalogFolderRow {
  const quality = catalogCompleteness("category", category, childCount);
  return {
    key: `category:${category.id}`,
    id: category.id,
    kind: "category",
    kindLabel: KIND_LABELS.category,
    title: category.title,
    slug: category.slug,
    contentLabel: `${childCount} 个下级内容`,
    unlockMode: "不适用",
    isPublished: category.is_published,
    isLocked: false,
    sortOrder: category.sort_order,
    ...quality,
    node: category,
    canOpen: true,
  };
}

function courseRow(
  course: CourseCatalogCourse,
  childCount: number,
): CourseCatalogFolderRow {
  const quality = catalogCompleteness("course", course, childCount);
  return {
    key: `course:${course.id}`,
    id: course.id,
    kind: "course",
    kindLabel: KIND_LABELS.course,
    title: course.title,
    slug: course.slug,
    contentLabel: `${childCount} 个课时`,
    unlockMode: UNLOCK_LABELS[course.unlock_mode] ?? "未设置",
    isPublished: course.is_published,
    isLocked: course.is_manually_locked,
    sortOrder: course.sort_order,
    ...quality,
    node: course,
    canOpen: true,
  };
}

function lessonRow(
  lesson: CourseCatalogLesson,
  childCount: number,
): CourseCatalogFolderRow {
  const quality = catalogCompleteness("lesson", lesson, childCount);
  return {
    key: `lesson:${lesson.id}`,
    id: lesson.id,
    kind: "lesson",
    kindLabel: KIND_LABELS.lesson,
    title: lesson.title,
    slug: lesson.slug,
    contentLabel: `${childCount} 个章节`,
    unlockMode: UNLOCK_LABELS[lesson.unlock_mode] ?? "未设置",
    isPublished: lesson.is_published,
    isLocked: lesson.is_manually_locked,
    sortOrder: lesson.sort_order,
    ...quality,
    node: lesson,
    canOpen: true,
  };
}

function chapterRow(chapter: CourseCatalogChapter): CourseCatalogFolderRow {
  const quality = catalogCompleteness(
    "chapter",
    chapter,
    chapter.chapter_test_id ? 1 : 0,
  );
  return {
    key: `chapter:${chapter.id}`,
    id: chapter.id,
    kind: "chapter",
    kindLabel: KIND_LABELS.chapter,
    title: chapter.title,
    slug: chapter.slug,
    contentLabel: chapter.chapter_test_id
      ? "已关联章节测试"
      : `${chapter.duration_minutes} 分钟`,
    unlockMode: UNLOCK_LABELS[chapter.unlock_mode] ?? "未设置",
    isPublished: chapter.is_published,
    isLocked: chapter.is_manually_locked,
    sortOrder: chapter.sort_order,
    ...quality,
    node: chapter,
    canOpen: false,
  };
}

function sortBySortOrder<T extends { sort_order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order);
}

type CatalogData = {
  categories: CourseCategory[];
  courses: CourseCatalogCourse[];
  lessons: CourseCatalogLesson[];
  chapters: CourseCatalogChapter[];
};

function getFolderChildren(
  ref: FolderRef | null,
  data: CatalogData,
): CourseCatalogFolderRow[] {
  const { categories, courses, lessons, chapters } = data;

  const categoryChildCount = (categoryId: string) =>
    categories.filter((item) => item.parent_id === categoryId).length +
    courses.filter((item) => item.category_id === categoryId).length;
  const courseChildCount = (courseId: string) =>
    lessons.filter((item) => item.course_id === courseId).length;
  const lessonChildCount = (lessonId: string) =>
    chapters.filter((item) => item.lesson_id === lessonId).length;

  if (!ref) {
    const categoryIds = new Set(categories.map((item) => item.id));
    const courseIds = new Set(courses.map((item) => item.id));
    const lessonIds = new Set(lessons.map((item) => item.id));
    const rootCategories = sortBySortOrder(
      categories.filter((item) => !item.parent_id),
    );
    const orphanCourses = sortBySortOrder(
      courses.filter(
        (item) => !item.category_id || !categoryIds.has(item.category_id),
      ),
    );
    const orphanLessons = sortBySortOrder(
      lessons.filter((item) => !courseIds.has(item.course_id)),
    );
    const orphanChapters = sortBySortOrder(
      chapters.filter((item) => !lessonIds.has(item.lesson_id)),
    );
    return [
      ...rootCategories.map((category) =>
        categoryRow(category, categoryChildCount(category.id)),
      ),
      ...orphanCourses.map((course) =>
        courseRow(course, courseChildCount(course.id)),
      ),
      ...orphanLessons.map((lesson) =>
        lessonRow(lesson, lessonChildCount(lesson.id)),
      ),
      ...orphanChapters.map((chapter) => chapterRow(chapter)),
    ];
  }

  if (ref.kind === "category") {
    const subcategories = sortBySortOrder(
      categories.filter((item) => item.parent_id === ref.id),
    );
    const childCourses = sortBySortOrder(
      courses.filter((item) => item.category_id === ref.id),
    );
    return [
      ...subcategories.map((category) =>
        categoryRow(category, categoryChildCount(category.id)),
      ),
      ...childCourses.map((course) =>
        courseRow(course, courseChildCount(course.id)),
      ),
    ];
  }

  if (ref.kind === "course") {
    const childLessons = sortBySortOrder(
      lessons.filter((item) => item.course_id === ref.id),
    );
    return childLessons.map((lesson) =>
      lessonRow(lesson, lessonChildCount(lesson.id)),
    );
  }

  const childChapters = sortBySortOrder(
    chapters.filter((item) => item.lesson_id === ref.id),
  );
  return childChapters.map((chapter) => chapterRow(chapter));
}

type BreadcrumbEntry = {
  label: string;
  href: string;
  kind: FolderKind | null;
};

function buildBreadcrumb(
  ref: FolderRef | null,
  data: CatalogData,
  catalogRoute: string,
): BreadcrumbEntry[] {
  const trail: FolderRef[] = [];
  let cursor: FolderRef | null = ref;
  while (cursor) {
    const node: FolderRef = cursor;
    trail.unshift(node);
    if (node.kind === "category") {
      const category = data.categories.find((item) => item.id === node.id);
      cursor = category?.parent_id
        ? { kind: "category", id: category.parent_id }
        : null;
    } else if (node.kind === "course") {
      const course = data.courses.find((item) => item.id === node.id);
      cursor = course?.category_id
        ? { kind: "category", id: course.category_id }
        : null;
    } else {
      const lesson = data.lessons.find((item) => item.id === node.id);
      cursor = lesson ? { kind: "course", id: lesson.course_id } : null;
    }
  }

  const crumbs: BreadcrumbEntry[] = [
    { label: "课程结构", href: catalogRoute, kind: null },
  ];
  for (const item of trail) {
    const title =
      item.kind === "category"
        ? data.categories.find((c) => c.id === item.id)?.title
        : item.kind === "course"
          ? data.courses.find((c) => c.id === item.id)?.title
          : data.lessons.find((l) => l.id === item.id)?.title;
    crumbs.push({
      label: title ?? "未知",
      href: folderHref(catalogRoute, item),
      kind: item.kind,
    });
  }
  return crumbs;
}

export default async function CourseCatalogListing({
  searchParams,
  studentAppId,
  routeBasePath,
  textbookRoute,
}: {
  searchParams: Promise<{ node?: string; id?: string; folder?: string }>;
  studentAppId?: string;
  routeBasePath?: string;
  textbookRoute?: string;
}) {
  const selection = await searchParams;
  const result = await getCourseManagementData(selection, studentAppId);
  const catalogRoute = routeBasePath ?? scopeDashboardPath(
    "/dashboard/admin/courses",
    result.dashboardBasePath,
  );

  const requestedFolder = parseFolderParam(selection.folder);
  const currentFolderNode = !requestedFolder
    ? undefined
    : requestedFolder.kind === "category"
      ? result.categories.find((item) => item.id === requestedFolder.id)
      : requestedFolder.kind === "course"
        ? result.courses.find((item) => item.id === requestedFolder.id)
        : result.lessons.find((item) => item.id === requestedFolder.id);
  const folderRef = currentFolderNode ? requestedFolder : null;

  const breadcrumb = buildBreadcrumb(folderRef, result, catalogRoute);
  const folderRows = getFolderChildren(folderRef, result);
  const createTarget = folderRef
    ? getCreateChildTarget(currentFolderNode!, {
        categories: result.categories,
        courses: result.courses,
        lessons: result.lessons,
        chapters: result.chapters,
        studentAppId,
      })
    : {
        kind: "category" as const,
        title: "新建顶级分类",
        sortOrder:
          result.categories.filter((item) => !item.parent_id).length * 10 +
          10,
      };

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
        <ManagementNotice tone="warning">
          课程目录数据读取失败：{result.catalogErrorMessage}
        </ManagementNotice>
      )}
      {!result.canManage && (
        <ManagementNotice>
          当前账号可以查看平台课程，但只有平台负责人和平台管理员可以修改。
        </ManagementNotice>
      )}
      <ManagementMetricStrip
        label="课程结构概况"
        items={[
          {
            label: "顶级分类",
            value: result.categories.filter((item) => !item.parent_id).length,
          },
          { label: "课程", value: result.courses.length },
          { label: "课时", value: result.lessons.length },
          { label: "章节", value: result.chapters.length },
        ]}
      />
      <section className="space-y-3">
        <nav aria-label="当前目录位置" className="flex flex-wrap items-center gap-1 text-xs text-[var(--foreground-muted)]">
          {breadcrumb.map((crumb, index) => {
            const CrumbIcon = crumb.kind ? KIND_DEFAULT_ICON[crumb.kind] : Folders;
            return (
              <span key={crumb.href} className="flex items-center gap-1">
                {index > 0 && <ChevronRight size={12} aria-hidden="true" />}
                {index === breadcrumb.length - 1 ? (
                  <span className="flex items-center gap-1 font-medium text-[var(--foreground)]">
                    <CrumbIcon size={12} aria-hidden="true" />
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="flex items-center gap-1 hover:text-[var(--foreground)] hover:underline"
                  >
                    <CrumbIcon size={12} aria-hidden="true" />
                    {crumb.label}
                  </Link>
                )}
              </span>
            );
          })}
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-[var(--foreground)]">
                {folderRef ? currentFolderNode!.title : "课程结构"}
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-medium text-[var(--foreground-muted)]">
                {folderRef ? KIND_LABELS[folderRef.kind] : "顶层"}
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--foreground-muted)]">
              {folderRef
                ? "点击下级内容进入下一层，或使用面包屑返回上一层。"
                : "先建立课程层级与开放规则，再进入教材制作填写学生真正学习的内容。"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {textbookRoute && (
              <Link
                href={textbookRoute}
                className="management-secondary-button inline-flex h-9 items-center border px-4 text-xs font-semibold"
              >
                进入教材制作
              </Link>
            )}
            {result.canManage && folderRef && (
              <CourseCatalogEditDialog
                node={currentFolderNode!}
                options={{
                  categories: result.categories,
                  courses: result.courses,
                  lessons: result.lessons,
                  chapters: result.chapters,
                  studentAppId,
                }}
              />
            )}
            {result.canManage && createTarget && (
              <CourseCatalogCreateDialog
                primary
                studentAppId={studentAppId}
                target={createTarget}
              />
            )}
          </div>
        </div>
        <CourseCatalogFolderTable
          rows={folderRows}
          canManage={result.canManage}
          options={{
            categories: result.categories,
            courses: result.courses,
            lessons: result.lessons,
            chapters: result.chapters,
            studentAppId,
          }}
          dashboardBasePath={result.dashboardBasePath}
          routeBasePath={catalogRoute}
          catalogRoute={catalogRoute}
          folderParam={folderRef ? `${folderRef.kind}:${folderRef.id}` : undefined}
        />
      </section>

      {selectedKind && selectedNode && (
        <section id="course-content" className="scroll-mt-20 space-y-4 border-t border-[var(--border)] pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--foreground)]">
                结构与资料详情
              </h2>
              <p className="mt-1 text-xs text-[var(--foreground-muted)]">
                查看当前节点的基础资料、顺序、开放状态和关联资源。
              </p>
            </div>
            <Link
              href={folderHref(catalogRoute, folderRef)}
              className="management-secondary-button inline-flex h-9 items-center border px-4 text-xs font-semibold"
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
              textbookHref={textbookRoute}
            />
          ) : (
            <CourseCatalogNodeView kind="chapter" node={selectedNode as CourseCatalogChapter} />
          )}
        </section>
      )}
    </div>
  );
}
