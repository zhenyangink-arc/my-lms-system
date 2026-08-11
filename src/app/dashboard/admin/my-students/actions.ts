"use server";

import { requireActiveUser } from "@/lib/auth";
import { getTeacherAssignedStudentIds } from "@/lib/student-assignments";
import { getUnlockedChapterSlugs } from "@/lib/course-unlocks";

export type StudentLessonStatus = "not_started" | "in_progress" | "completed";

export type StudentChapterStatus = StudentLessonStatus | "locked";

export type StudentChapter = {
  id: string;
  title: string;
  sortOrder: number;
  slug: string | null;
  status: StudentChapterStatus;
};

export type StudentLessonProgress = {
  lessonId: string;
  lessonTitle: string;
  status: StudentLessonStatus;
  progressPercent: number;
  completedChapters: number;
  readingSeconds: number;
  updatedAt: string | null;
  chapters: StudentChapter[];
};

export type StudentCourseProgress = {
  courseId: string;
  courseTitle: string;
  courseSlug: string | null;
  categoryTitle: string | null;
  categoryOrder: number;
  totalLessons: number;
  completedLessons: number;
  inProgressLessons: number;
  percent: number;
  lastLearnedAt: string | null;
  lessons: StudentLessonProgress[];
};

export type StudentCoursesResult =
  | { ok: true; courses: StudentCourseProgress[] }
  | { ok: false; error: string };

type LessonRow = {
  id: string;
  course_id: string;
  title: string;
  slug: string | null;
  sort_order: number | null;
};

type ProgressRow = {
  course_id: string;
  lesson_id: string;
  status: string;
  progress_percent: number | null;
  updated_at: string | null;
};

type CourseRow = {
  id: string;
  title: string;
  slug: string | null;
  category_id: string | null;
};

type CategoryRow = {
  id: string;
  parent_id: string | null;
  title: string;
  sort_order: number | null;
};

type ChapterRow = {
  id: string;
  lesson_id: string;
  title: string;
  sort_order: number | null;
  slug: string | null;
  unlock_mode: string | null;
  prerequisite_chapter_id: string | null;
  available_from: string | null;
  is_manually_locked: boolean | null;
};

/** 老师查看自己负责学生的课程与学习进度。 */
export async function getStudentCoursesAction(
  studentId: string
): Promise<StudentCoursesResult> {
  if (!studentId) return { ok: false, error: "缺少学生编号，请刷新页面后重试。" };

  try {
    const { supabase, user, profile, tenant } = await requireActiveUser();
    if (profile?.role !== "teacher" || !tenant) {
      return { ok: false, error: "当前账号不是老师或不在机构工作台内。" };
    }

    // 只能查看分配给自己负责的学生。
    const assignedIds = await getTeacherAssignedStudentIds(supabase, tenant.id, user.id);
    if (!assignedIds.includes(studentId)) {
      return { ok: false, error: "该学生不在你的负责名单中。" };
    }

    const [progressResult, courseResult, lessonResult] = await Promise.all([
      supabase
        .from("lesson_progress")
        .select("course_id, lesson_id, status, progress_percent, updated_at")
        .eq("tenant_id", tenant.id)
        .eq("user_id", studentId),
      supabase
        .from("courses")
        .select("id, title, slug, category_id")
        .or(`tenant_id.is.null,tenant_id.eq.${tenant.id}`)
        .eq("is_published", true),
      supabase
        .from("lessons")
        .select("id, course_id, title, slug, sort_order")
        .or(`tenant_id.is.null,tenant_id.eq.${tenant.id}`)
        .eq("is_published", true)
        .order("sort_order", { ascending: true }),
    ]);

    if (progressResult.error) return { ok: false, error: "学习进度读取失败，请稍后重试。" };

    const progressRows = (progressResult.data ?? []) as ProgressRow[];
    const courses = (courseResult.data ?? []) as CourseRow[];
    const lessons = (lessonResult.data ?? []) as LessonRow[];

    // 课程板块树：courses.category_id → 二级分类 → 一级板块（如 留学服务课程/韩语课程）。
    const { data: categoryData } = await supabase
      .from("course_categories")
      .select("id, parent_id, title, sort_order")
      .eq("content_scope", "platform");
    const categoryInfoById = new Map(
      ((categoryData ?? []) as CategoryRow[]).map((category) => [
        category.id,
        category,
      ])
    );

    // 课时下的章（目录层级：课程 → 课时 → 章），与学生端课时页一致只取已发布章。
    const chaptersByLesson = new Map<string, StudentChapter[]>();
    const passedTestSlugs = new Set<string>();
    if (lessons.length > 0) {
      const { data: chapterData } = await supabase
        .from("course_chapters")
        .select(
          "id, lesson_id, title, sort_order, slug, unlock_mode, prerequisite_chapter_id, available_from, is_manually_locked"
        )
        .in("lesson_id", lessons.map((lesson) => lesson.id))
        .eq("is_published", true)
        .order("sort_order", { ascending: true });
      const chapterRows = (chapterData ?? []) as ChapterRow[];

      // 章完成状态：章节测试通过（test_slug 与章 slug 对应，与学生端解锁逻辑一致）。
      const { data: passedAttemptData } = await supabase
        .from("chapter_test_attempts")
        .select("test_slug")
        .eq("tenant_id", tenant.id)
        .eq("student_id", studentId)
        .eq("passed", true);
      for (const attempt of passedAttemptData ?? []) {
        passedTestSlugs.add(String(attempt.test_slug));
      }

      // 章解锁范围与学生端一致（如韩语课按“通过前一章测试”顺序解锁）。
      const unlockedChapterSlugs = getUnlockedChapterSlugs({
        chapters: chapterRows.map((chapter) => ({
          id: chapter.id,
          slug: chapter.slug ?? "",
          unlock_mode: chapter.unlock_mode,
          prerequisite_chapter_id: chapter.prerequisite_chapter_id,
          available_from: chapter.available_from,
          is_manually_locked: chapter.is_manually_locked,
        })),
        passedChapterSlugs: passedTestSlugs,
      });
      for (const chapter of chapterRows) {
        const list = chaptersByLesson.get(chapter.lesson_id) ?? [];
        list.push({
          id: chapter.id,
          title: chapter.title,
          sortOrder: chapter.sort_order ?? 0,
          slug: chapter.slug,
          status: chapter.slug && !unlockedChapterSlugs.has(chapter.slug)
            ? "locked"
            : "not_started",
        });
        chaptersByLesson.set(chapter.lesson_id, list);
      }
    }

    // 电子书阅读进度（时间制）：reading_seconds 累计阅读秒数，与学生端一致。
    const { data: ebookProgressData } = await supabase
      .from("course_ebook_progress")
      .select("test_slug, reading_seconds")
      .eq("tenant_id", tenant.id)
      .eq("student_id", studentId);
    const readingSecondsByTestSlug = new Map<string, number>(
      (ebookProgressData ?? []).map((row) => [
        String(row.test_slug),
        Number(row.reading_seconds) || 0,
      ])
    );

    const lessonsByCourse = new Map<string, LessonRow[]>();
    for (const lesson of lessons) {
      const list = lessonsByCourse.get(lesson.course_id) ?? [];
      list.push(lesson);
      lessonsByCourse.set(lesson.course_id, list);
    }

    const progressByCourse = new Map<string, ProgressRow[]>();
    for (const row of progressRows) {
      const list = progressByCourse.get(row.course_id) ?? [];
      list.push(row);
      progressByCourse.set(row.course_id, list);
    }

    const coursesOut: StudentCourseProgress[] = [];
    for (const course of courses) {
      const courseProgress = progressByCourse.get(course.id) ?? [];
      const courseLessons = lessonsByCourse.get(course.id) ?? [];
      const completedLessons = courseProgress.filter(
        (row) => row.status === "completed"
      ).length;
      const inProgressLessons = courseProgress.filter(
        (row) => row.status === "in_progress"
      ).length;
      const lastLearnedAt = courseProgress.reduce<string | null>((latest, row) => {
        if (!row.updated_at) return latest;
        return !latest || row.updated_at > latest ? row.updated_at : latest;
      }, null);

      const lessonsOut: StudentLessonProgress[] = courseLessons.map((lesson) => {
        const progress = courseProgress.find((row) => row.lesson_id === lesson.id);
        const chapters = (chaptersByLesson.get(lesson.id) ?? []).map((chapter) => {
          const lessonHasProgress =
            progress?.status === "in_progress" ||
            (progress?.progress_percent ?? 0) > 0;
          return {
            ...chapter,
            status: chapter.status === "locked"
              ? "locked"
              : chapter.slug && passedTestSlugs.has(chapter.slug)
                ? "completed"
                : lessonHasProgress
                  ? "in_progress"
                  : "not_started",
          } as StudentChapter;
        });
        const completedChapters = chapters.filter(
          (chapter) => chapter.status === "completed"
        ).length;
        const readingSeconds = chapters.reduce(
          (total, chapter) =>
            total +
            (chapter.slug ? readingSecondsByTestSlug.get(chapter.slug) ?? 0 : 0),
          0
        );
        if (!progress) {
          return {
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            status: "not_started",
            progressPercent: 0,
            completedChapters,
            readingSeconds,
            updatedAt: null,
            chapters,
          };
        }
        return {
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          status:
            progress.status === "completed"
              ? "completed"
              : progress.status === "in_progress"
                ? "in_progress"
                : "not_started",
          progressPercent: progress.progress_percent ?? 0,
          completedChapters,
          readingSeconds,
          updatedAt: progress.updated_at,
          chapters,
        };
      });

      const percent =
        courseLessons.length > 0
          ? Math.round((completedLessons / courseLessons.length) * 100)
          : 0;

      // 没有已发布课时的课程 = 学生端不可学（内容未做），不显示。
      if (courseLessons.length === 0) continue;

      const subCategory = course.category_id ? categoryInfoById.get(course.category_id) : null;
      const topCategory = subCategory?.parent_id
        ? categoryInfoById.get(subCategory.parent_id)
        : subCategory;

      coursesOut.push({
        courseId: course.id,
        courseTitle: course.title,
        courseSlug: course.slug,
        categoryTitle: topCategory?.title ?? subCategory?.title ?? "其他课程",
        categoryOrder: topCategory?.sort_order ?? subCategory?.sort_order ?? 999,
        totalLessons: courseLessons.length,
        completedLessons,
        inProgressLessons,
        percent,
        lastLearnedAt,
        lessons: lessonsOut,
      });
    }

    // 按板块排序，组内：有学习进度的课程在前（按最近学习），未开始的在后（按标题）。
    coursesOut.sort((a, b) => {
      if (a.categoryOrder !== b.categoryOrder) {
        return a.categoryOrder - b.categoryOrder;
      }
      if (a.lastLearnedAt && b.lastLearnedAt) {
        return b.lastLearnedAt.localeCompare(a.lastLearnedAt);
      }
      if (a.lastLearnedAt) return -1;
      if (b.lastLearnedAt) return 1;
      return a.courseTitle.localeCompare(b.courseTitle, "zh-CN");
    });

    return { ok: true, courses: coursesOut };
  } catch (error) {
    console.error("老师查看学生课程进度失败：", error);
    return { ok: false, error: "课程进度加载失败，请稍后重试。" };
  }
}
