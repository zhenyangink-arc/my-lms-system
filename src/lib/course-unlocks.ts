export type CatalogUnlockMode =
  | "immediate"
  | "previous_completed"
  | "prerequisite_completed"
  | "prerequisite_passed"
  | "scheduled"
  | "manual";

export type LessonUnlockRule = {
  id: string;
  unlock_mode: string | null;
  prerequisite_lesson_id: string | null;
  prerequisite_chapter_id: string | null;
  available_from: string | null;
  is_manually_locked: boolean | null;
};

export type CourseUnlockRule = {
  id: string;
  unlock_mode: string | null;
  prerequisite_course_id: string | null;
  available_from: string | null;
  is_manually_locked: boolean | null;
};

export type ChapterUnlockRule = {
  id: string;
  slug: string;
  unlock_mode: string | null;
  prerequisite_chapter_id: string | null;
  available_from: string | null;
  is_manually_locked: boolean | null;
};

function isAvailableByTime(value: string | null, now: Date) {
  if (!value) return true;
  const availableAt = new Date(value);
  return Number.isNaN(availableAt.getTime()) || availableAt.getTime() <= now.getTime();
}

export function isCourseUnlocked({
  course,
  courseIndex,
  orderedCourses,
  completedCourseIds,
  now = new Date(),
}: {
  course: CourseUnlockRule;
  courseIndex: number;
  orderedCourses: CourseUnlockRule[];
  completedCourseIds: ReadonlySet<string>;
  now?: Date;
}) {
  if (course.is_manually_locked) return false;

  const mode = (course.unlock_mode || "immediate") as CatalogUnlockMode;
  if (mode === "immediate" || mode === "manual") return true;
  if (mode === "scheduled") return isAvailableByTime(course.available_from, now);
  if (mode === "previous_completed") {
    const previous = orderedCourses[courseIndex - 1];
    return !previous || completedCourseIds.has(previous.id);
  }
  if (mode === "prerequisite_completed") {
    return !course.prerequisite_course_id || completedCourseIds.has(course.prerequisite_course_id);
  }

  return true;
}

export function isLessonUnlocked({
  lesson,
  lessonIndex,
  orderedLessons,
  completedLessonIds,
  prerequisiteChapterSlugById,
  passedChapterSlugs,
  now = new Date(),
}: {
  lesson: LessonUnlockRule;
  lessonIndex: number;
  orderedLessons: LessonUnlockRule[];
  completedLessonIds: ReadonlySet<string>;
  prerequisiteChapterSlugById: ReadonlyMap<string, string>;
  passedChapterSlugs: ReadonlySet<string>;
  now?: Date;
}) {
  if (lesson.is_manually_locked) return false;

  const mode = (lesson.unlock_mode || "immediate") as CatalogUnlockMode;
  if (mode === "immediate" || mode === "manual") return true;
  if (mode === "scheduled") return isAvailableByTime(lesson.available_from, now);
  if (mode === "previous_completed") {
    const previous = orderedLessons[lessonIndex - 1];
    return !previous || completedLessonIds.has(previous.id);
  }
  if (mode === "prerequisite_completed") {
    return !lesson.prerequisite_lesson_id || completedLessonIds.has(lesson.prerequisite_lesson_id);
  }
  if (mode === "prerequisite_passed") {
    if (lesson.prerequisite_chapter_id) {
      const prerequisiteSlug = prerequisiteChapterSlugById.get(lesson.prerequisite_chapter_id);
      return Boolean(prerequisiteSlug && passedChapterSlugs.has(prerequisiteSlug));
    }
    return !lesson.prerequisite_lesson_id || completedLessonIds.has(lesson.prerequisite_lesson_id);
  }

  return true;
}

export function getUnlockedChapterSlugs({
  chapters,
  passedChapterSlugs,
  now = new Date(),
}: {
  chapters: ChapterUnlockRule[];
  passedChapterSlugs: ReadonlySet<string>;
  now?: Date;
}) {
  const chapterSlugById = new Map(chapters.map((chapter) => [chapter.id, chapter.slug]));
  const unlocked = new Set<string>();

  chapters.forEach((chapter, index) => {
    if (chapter.is_manually_locked) return;
    const mode = (chapter.unlock_mode || "immediate") as CatalogUnlockMode;
    let isUnlocked = mode === "immediate" || mode === "manual";

    if (mode === "scheduled") isUnlocked = isAvailableByTime(chapter.available_from, now);
    if (mode === "previous_completed") {
      const previous = chapters[index - 1];
      isUnlocked = !previous || passedChapterSlugs.has(previous.slug);
    }
    if (mode === "prerequisite_completed" || mode === "prerequisite_passed") {
      const prerequisiteSlug = chapter.prerequisite_chapter_id
        ? chapterSlugById.get(chapter.prerequisite_chapter_id)
        : null;
      isUnlocked = !prerequisiteSlug || passedChapterSlugs.has(prerequisiteSlug);
    }

    if (isUnlocked) unlocked.add(chapter.slug);
  });

  return unlocked;
}
