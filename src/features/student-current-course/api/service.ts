import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getCourseLearningPath } from "@/features/student-home-learning/routes";
import { isCourseUnlocked, isLessonUnlocked } from "@/lib/course-unlocks";
import { STUDENT_APP_IDS } from "@/lib/student-apps";

type CategoryRow = {
  id: string;
  parent_id: string | null;
  slug: string;
  sort_order: number;
};

type CourseRow = {
  id: string;
  category_id: string | null;
  slug: string;
  title: string;
  sort_order: number;
  unlock_mode: string | null;
  prerequisite_course_id: string | null;
  available_from: string | null;
  is_manually_locked: boolean | null;
};

type LessonRow = {
  id: string;
  course_id: string;
  slug: string;
  title: string;
  sort_order: number;
  unlock_mode: string | null;
  prerequisite_lesson_id: string | null;
  prerequisite_chapter_id: string | null;
  available_from: string | null;
  is_manually_locked: boolean | null;
};

type ProgressRow = {
  lesson_id: string;
  status: string | null;
  progress_percent: number | string | null;
  last_viewed_at: string | null;
  updated_at: string | null;
};

export type StudentCurrentCourse = {
  courseId: string;
  lessonId: string;
  courseTitle: string;
  lessonTitle: string;
  progressPercent: number;
  lessonProgressPercent: number;
  status: "not_started" | "in_progress" | "completed";
  updatedAt: string;
  continueHref: string;
};

function throwReadError(label: string, error: { message: string } | null) {
  if (error) throw new Error(`门户当前课程${label}读取失败`, { cause: error });
}

function normalizeProgress(row: ProgressRow | undefined) {
  const percentage = Math.max(
    0,
    Math.min(100, Number(row?.progress_percent) || 0),
  );
  const completed = row?.status === "completed" || percentage >= 100;
  const started = completed || row?.status === "in_progress" || percentage > 0;
  return {
    percentage: completed ? 100 : percentage,
    status: completed
      ? ("completed" as const)
      : started
        ? ("in_progress" as const)
        : ("not_started" as const),
  };
}

function timestamp(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * 门户只从正式发布的课程与课时中选取继续位置。
 * 专项练习、章节练习和阅读训练都不参与这里的课程判断。
 */
export async function loadStudentCurrentKoreanCourse({
  supabase,
  studentId,
  space,
  now = new Date(),
}: {
  supabase: SupabaseClient;
  studentId: string;
  space: string;
  now?: Date;
}): Promise<StudentCurrentCourse | null> {
  const { data: rootCategory, error: rootCategoryError } = await supabase
    .from("course_categories")
    .select("id,parent_id,slug,sort_order")
    .eq("slug", "korean")
    .is("parent_id", null)
    .eq("is_published", true)
    .maybeSingle();
  throwReadError("主分类", rootCategoryError);
  if (!rootCategory) return null;

  const { data: subcategoryData, error: subcategoryError } = await supabase
    .from("course_categories")
    .select("id,parent_id,slug,sort_order")
    .eq("parent_id", rootCategory.id)
    .eq("is_published", true)
    .order("sort_order", { ascending: true });
  throwReadError("分类", subcategoryError);

  const subcategories = (subcategoryData ?? []) as CategoryRow[];
  if (subcategories.length === 0) return null;
  const subcategoryById = new Map(
    subcategories.map((subcategory) => [subcategory.id, subcategory]),
  );

  const { data: courseData, error: courseError } = await supabase
    .from("courses")
    .select(
      "id,category_id,slug,title,sort_order,unlock_mode,prerequisite_course_id,available_from,is_manually_locked",
    )
    .in(
      "category_id",
      subcategories.map((subcategory) => subcategory.id),
    )
    .eq("student_app_id", STUDENT_APP_IDS.korean)
    .eq("is_published", true)
    .order("sort_order", { ascending: true });
  throwReadError("目录", courseError);

  const courses = ((courseData ?? []) as CourseRow[]).sort((left, right) => {
    const categoryDifference =
      (subcategoryById.get(left.category_id ?? "")?.sort_order ?? 0) -
      (subcategoryById.get(right.category_id ?? "")?.sort_order ?? 0);
    return categoryDifference || left.sort_order - right.sort_order;
  });
  if (courses.length === 0) return null;

  const { data: lessonData, error: lessonError } = await supabase
    .from("lessons")
    .select(
      "id,course_id,slug,title,sort_order,unlock_mode,prerequisite_lesson_id,prerequisite_chapter_id,available_from,is_manually_locked",
    )
    .in(
      "course_id",
      courses.map((course) => course.id),
    )
    .eq("is_published", true)
    .order("sort_order", { ascending: true });
  throwReadError("课时", lessonError);

  const lessons = (lessonData ?? []) as LessonRow[];
  if (lessons.length === 0) return null;
  const lessonIds = lessons.map((lesson) => lesson.id);
  const prerequisiteChapterIds = [
    ...new Set(
      lessons
        .map((lesson) => lesson.prerequisite_chapter_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [progressResult, prerequisiteChapterResult, passedAttemptResult] =
    await Promise.all([
      supabase
        .from("lesson_progress")
        .select(
          "lesson_id,status,progress_percent,last_viewed_at,updated_at",
        )
        .eq("user_id", studentId)
        .in("lesson_id", lessonIds),
      prerequisiteChapterIds.length > 0
        ? supabase
            .from("course_chapters")
            .select("id,lesson_id,slug")
            .in("id", prerequisiteChapterIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("chapter_test_attempts")
        .select("test_slug")
        .eq("student_id", studentId)
        .eq("passed", true),
    ]);
  throwReadError("进度", progressResult.error);
  throwReadError("解锁关系", prerequisiteChapterResult.error);
  throwReadError("测试进度", passedAttemptResult.error);

  const progressByLessonId = new Map(
    ((progressResult.data ?? []) as ProgressRow[]).map((progress) => [
      progress.lesson_id,
      progress,
    ]),
  );
  const completedLessonIds = new Set(
    lessons
      .filter(
        (lesson) =>
          normalizeProgress(progressByLessonId.get(lesson.id)).status ===
          "completed",
      )
      .map((lesson) => lesson.id),
  );
  const passedChapterSlugs = new Set(
    (passedAttemptResult.data ?? []).map((attempt) => String(attempt.test_slug)),
  );
  const lessonsByCourseId = new Map<string, LessonRow[]>();
  for (const lesson of lessons) {
    const courseLessons = lessonsByCourseId.get(lesson.course_id) ?? [];
    courseLessons.push(lesson);
    lessonsByCourseId.set(lesson.course_id, courseLessons);
  }
  for (const courseLessons of lessonsByCourseId.values()) {
    courseLessons.sort((left, right) => left.sort_order - right.sort_order);
  }

  const prerequisiteChapterSlugById = new Map(
    (prerequisiteChapterResult.data ?? []).map((chapter) => [
      String(chapter.id),
      String(chapter.slug),
    ]),
  );
  const prerequisiteChapterLessonIdById = new Map(
    (prerequisiteChapterResult.data ?? []).map((chapter) => [
      String(chapter.id),
      String(chapter.lesson_id),
    ]),
  );
  // 历史学员可能已通过上一课的最终章节测试，但旧流程没有补写
  // lesson_progress。既然后一课已被正式解锁，就不能再把他送回上一课。
  for (const lesson of lessons) {
    if (
      lesson.unlock_mode !== "prerequisite_passed" ||
      !lesson.prerequisite_chapter_id
    ) {
      continue;
    }
    const prerequisiteSlug = prerequisiteChapterSlugById.get(
      lesson.prerequisite_chapter_id,
    );
    if (!prerequisiteSlug || !passedChapterSlugs.has(prerequisiteSlug)) continue;
    const prerequisiteLessonId =
      lesson.prerequisite_lesson_id ??
      prerequisiteChapterLessonIdById.get(lesson.prerequisite_chapter_id);
    if (prerequisiteLessonId) completedLessonIds.add(prerequisiteLessonId);
  }
  const completedCourseIds = new Set(
    courses
      .filter((course) => {
        const courseLessons = lessonsByCourseId.get(course.id) ?? [];
        return (
          courseLessons.length > 0 &&
          courseLessons.every((lesson) => completedLessonIds.has(lesson.id))
        );
      })
      .map((course) => course.id),
  );
  const availableLocations: Array<{ course: CourseRow; lesson: LessonRow }> = [];
  for (const subcategory of subcategories) {
    const categoryCourses = courses.filter(
      (course) => course.category_id === subcategory.id,
    );
    categoryCourses.forEach((course, courseIndex) => {
      if (
        !isCourseUnlocked({
          course,
          courseIndex,
          orderedCourses: categoryCourses,
          completedCourseIds,
          now,
        })
      ) {
        return;
      }
      const courseLessons = lessonsByCourseId.get(course.id) ?? [];
      courseLessons.forEach((lesson, lessonIndex) => {
        if (
          isLessonUnlocked({
            lesson,
            lessonIndex,
            orderedLessons: courseLessons,
            completedLessonIds,
            prerequisiteChapterSlugById,
            passedChapterSlugs,
            now,
          })
        ) {
          availableLocations.push({ course, lesson });
        }
      });
    });
  }
  if (availableLocations.length === 0) return null;

  const activeLocation = [...availableLocations]
    .filter(({ lesson }) => {
      const status = normalizeProgress(progressByLessonId.get(lesson.id)).status;
      return status === "in_progress";
    })
    .sort((left, right) => {
      const leftProgress = progressByLessonId.get(left.lesson.id);
      const rightProgress = progressByLessonId.get(right.lesson.id);
      return (
        timestamp(rightProgress?.last_viewed_at ?? rightProgress?.updated_at) -
        timestamp(leftProgress?.last_viewed_at ?? leftProgress?.updated_at)
      );
    })[0];
  const nextLocation = availableLocations.find(
    ({ lesson }) => !completedLessonIds.has(lesson.id),
  );
  const completedLocation = [...availableLocations]
    .reverse()
    .find(({ lesson }) => completedLessonIds.has(lesson.id));
  const selectedLocation = activeLocation ?? nextLocation ?? completedLocation;
  if (!selectedLocation) return null;

  const { course, lesson } = selectedLocation;
  const subcategory = course.category_id
    ? subcategoryById.get(course.category_id)
    : null;
  if (!subcategory) return null;

  const courseLessons = lessonsByCourseId.get(course.id) ?? [];
  const courseProgress = courseLessons.length
    ? Math.round(
        courseLessons.reduce(
          (total, courseLesson) =>
            total +
            (completedLessonIds.has(courseLesson.id)
              ? 100
              : normalizeProgress(progressByLessonId.get(courseLesson.id))
                  .percentage),
          0,
        ) / courseLessons.length,
      )
    : 0;
  const selectedProgress = normalizeProgress(progressByLessonId.get(lesson.id));

  return {
    courseId: course.id,
    lessonId: lesson.id,
    courseTitle: course.title,
    lessonTitle: lesson.title,
    progressPercent: courseProgress,
    lessonProgressPercent: selectedProgress.percentage,
    status: selectedProgress.status,
    updatedAt:
      progressByLessonId.get(lesson.id)?.last_viewed_at ??
      progressByLessonId.get(lesson.id)?.updated_at ??
      new Date(0).toISOString(),
    continueHref: getCourseLearningPath(space, {
      categorySlug: String(rootCategory.slug),
      subcategorySlug: subcategory.slug,
      courseSlug: course.slug,
      lessonSlug: lesson.slug,
    }),
  };
}
