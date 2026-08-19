export type CoursePracticeStatus =
  | "not_started"
  | "in_progress"
  | "needs_review"
  | "mastered"
  | "unavailable"
  | "preparing";

export type CoursePracticeCourseRow = {
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

export type CoursePracticeLessonRow = {
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

export type CoursePracticeChapterRow = {
  id: string;
  lesson_id: string;
  chapter_test_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  sort_order: number;
  unlock_mode: string | null;
  prerequisite_chapter_id: string | null;
  available_from: string | null;
  is_manually_locked: boolean | null;
};

export type CoursePracticeAttemptRow = {
  test_id: string | null;
  test_slug: string;
  score: number;
  passed: boolean;
};

export type CoursePracticeEbookProgressRow = {
  test_slug: string;
  progress_percent: number;
};

export type CoursePracticeLessonProgressRow = {
  lesson_id: string;
  status: string;
};

export type CoursePracticeProgressRow = {
  course_chapter_id: string;
  status: "not_started" | "in_progress" | "needs_reinforcement" | "mastered";
  progress_percent: number;
  mastery_percent: number;
  completed_block_ids?: string[];
  last_practiced_at?: string | null;
  remaining_items?: Array<{ id: string; title: string }>;
};

export type CoursePracticeChapter = CoursePracticeChapterRow & {
  number: number;
  lessonSlug: string;
  lessonTitle: string;
  isOpen: boolean;
  hasPublishedContent: boolean;
  status: CoursePracticeStatus;
  progressPercent: number;
  lastPracticedAt: string | null;
  remainingItems: Array<{ id: string; title: string }>;
  lockedReason: string | null;
  attempt: CoursePracticeAttemptRow | null;
};

export type CoursePracticeCourse = CoursePracticeCourseRow & {
  isOpen: boolean;
  lockedReason: string | null;
  chapters: CoursePracticeChapter[];
};

export type CoursePracticeDirectoryState = {
  focusCourseId: string | null;
  focusChapterId: string | null;
  hasInProgress: boolean;
  expandedCourseId: string | null;
};

function progressTimestamp(value: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function getCoursePracticeDirectoryState(
  courses: CoursePracticeCourse[],
): CoursePracticeDirectoryState {
  const all = courses.flatMap((course) =>
    course.chapters.map((chapter) => ({ course, chapter })),
  );
  const recent = [...all]
    .filter(({ chapter }) => progressTimestamp(chapter.lastPracticedAt) > 0)
    .sort(
      (a, b) =>
        progressTimestamp(b.chapter.lastPracticedAt) -
        progressTimestamp(a.chapter.lastPracticedAt),
    );
  const inProgress = [...all]
    .filter(({ chapter }) => chapter.status === "in_progress")
    .sort(
      (a, b) =>
        progressTimestamp(b.chapter.lastPracticedAt) -
        progressTimestamp(a.chapter.lastPracticedAt),
    );
  const next = all.find(
    ({ chapter }) =>
      chapter.isOpen &&
      chapter.hasPublishedContent &&
      (chapter.status === "needs_review" || chapter.status === "not_started"),
  );
  const revisitable = recent.find(
    ({ chapter }) => chapter.isOpen && chapter.hasPublishedContent,
  ) ?? all.find(
    ({ chapter }) => chapter.isOpen && chapter.hasPublishedContent,
  );
  const focus = inProgress[0] ?? next ?? revisitable ?? null;
  return {
    focusCourseId: focus?.course.id ?? null,
    focusChapterId: focus?.chapter.id ?? null,
    hasInProgress: inProgress.length > 0,
    expandedCourseId:
      recent[0]?.course.id ?? focus?.course.id ?? courses[0]?.id ?? null,
  };
}

type CoursePracticeRuleResult = {
  isOpen: boolean;
  blocker:
    | "manual"
    | "scheduled"
    | "previous_completed"
    | "prerequisite_completed"
    | "prerequisite_passed"
    | null;
};

function isAvailable(value: string | null, now: Date) {
  if (!value) return true;
  const timestamp = new Date(value).getTime();
  return !Number.isNaN(timestamp) && timestamp <= now.getTime();
}

function evaluateRule({
  unlockMode,
  availableFrom,
  manuallyLocked,
  previousCompleted,
  prerequisiteCompleted,
  prerequisitePassed = prerequisiteCompleted,
  now,
}: {
  unlockMode: string | null;
  availableFrom: string | null;
  manuallyLocked: boolean | null;
  previousCompleted: boolean;
  prerequisiteCompleted: boolean;
  prerequisitePassed?: boolean;
  now: Date;
}): CoursePracticeRuleResult {
  if (manuallyLocked) return { isOpen: false, blocker: "manual" };

  const mode = unlockMode || "immediate";
  if (mode === "scheduled") {
    const isOpen = isAvailable(availableFrom, now);
    return { isOpen, blocker: isOpen ? null : "scheduled" };
  }
  if (mode === "previous_completed") {
    return { isOpen: previousCompleted, blocker: previousCompleted ? null : mode };
  }
  if (mode === "prerequisite_completed") {
    return { isOpen: prerequisiteCompleted, blocker: prerequisiteCompleted ? null : mode };
  }
  if (mode === "prerequisite_passed") {
    return { isOpen: prerequisitePassed, blocker: prerequisitePassed ? null : mode };
  }
  const isOpen = mode === "immediate" || mode === "manual";
  return { isOpen, blocker: isOpen ? null : "manual" };
}

function scheduledReason(availableFrom: string | null) {
  if (!availableFrom) return "需等待开放时间";
  const date = new Date(availableFrom);
  if (Number.isNaN(date.getTime())) return "需等待开放时间";
  return `需等到${new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(date)}开放`;
}

function ruleReason({
  result,
  availableFrom,
  previousLabel,
  prerequisiteLabel,
}: {
  result: CoursePracticeRuleResult;
  availableFrom: string | null;
  previousLabel: string;
  prerequisiteLabel: string;
}) {
  if (result.isOpen) return null;
  if (result.blocker === "scheduled") return scheduledReason(availableFrom);
  if (result.blocker === "previous_completed") return `需先完成${previousLabel}`;
  if (result.blocker === "prerequisite_completed") return `需先完成${prerequisiteLabel}`;
  if (result.blocker === "prerequisite_passed") return `需先通过${prerequisiteLabel}的测试`;
  return "需管理员开放";
}

export function buildCoursePracticeCatalog({
  courses,
  lessons,
  chapters,
  publishedPracticeChapterIds,
  lessonProgress,
  attempts,
  ebookProgress,
  practiceProgress = [],
  now = new Date(),
}: {
  courses: CoursePracticeCourseRow[];
  lessons: CoursePracticeLessonRow[];
  chapters: CoursePracticeChapterRow[];
  publishedPracticeChapterIds: ReadonlySet<string>;
  lessonProgress: CoursePracticeLessonProgressRow[];
  attempts: CoursePracticeAttemptRow[];
  ebookProgress: CoursePracticeEbookProgressRow[];
  practiceProgress?: CoursePracticeProgressRow[];
  now?: Date;
}): CoursePracticeCourse[] {
  const completedLessonIds = new Set(
    lessonProgress
      .filter((progress) => progress.status === "completed")
      .map((progress) => progress.lesson_id),
  );
  const lessonsByCourseId = new Map<string, CoursePracticeLessonRow[]>();
  for (const lesson of lessons) {
    const siblings = lessonsByCourseId.get(lesson.course_id) ?? [];
    siblings.push(lesson);
    lessonsByCourseId.set(lesson.course_id, siblings);
  }
  for (const siblings of lessonsByCourseId.values()) {
    siblings.sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  }

  const completedCourseIds = new Set<string>();
  for (const course of courses) {
    const courseLessons = lessonsByCourseId.get(course.id) ?? [];
    if (
      courseLessons.length > 0 &&
      courseLessons.every((lesson) => completedLessonIds.has(lesson.id))
    ) {
      completedCourseIds.add(course.id);
    }
  }

  const attemptByChapterId = new Map<string, CoursePracticeAttemptRow>();
  const attemptByTestId = new Map<string, CoursePracticeAttemptRow>();
  const attemptBySlug = new Map<string, CoursePracticeAttemptRow>();
  const keepBestAttempt = (
    map: Map<string, CoursePracticeAttemptRow>,
    key: string,
    attempt: CoursePracticeAttemptRow,
  ) => {
    const current = map.get(key);
    if (
      !current ||
      (!current.passed && attempt.passed) ||
      (current.passed === attempt.passed && attempt.score > current.score)
    ) {
      map.set(key, attempt);
    }
  };
  for (const attempt of attempts) {
    if (attempt.test_id) keepBestAttempt(attemptByTestId, attempt.test_id, attempt);
    keepBestAttempt(attemptBySlug, attempt.test_slug, attempt);
  }
  for (const chapter of chapters) {
    const attempt =
      (chapter.chapter_test_id
        ? attemptByTestId.get(chapter.chapter_test_id)
        : null) ?? attemptBySlug.get(chapter.slug);
    if (attempt) attemptByChapterId.set(chapter.id, attempt);
  }
  const ebookProgressBySlug = new Map(
    ebookProgress.map((progress) => [progress.test_slug, progress.progress_percent]),
  );
  const practiceProgressByChapterId = new Map(
    practiceProgress.map((progress) => [progress.course_chapter_id, progress]),
  );
  const completedChapterIds = new Set<string>();
  const passedChapterIds = new Set<string>();
  for (const chapter of chapters) {
    const attempt = attemptByChapterId.get(chapter.id);
    if (attempt?.passed) {
      completedChapterIds.add(chapter.id);
      passedChapterIds.add(chapter.id);
    }
    if ((ebookProgressBySlug.get(chapter.slug) ?? 0) >= 100) {
      completedChapterIds.add(chapter.id);
    }
  }

  const orderedCourses = [...courses].sort(
    (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id),
  );
  const coursesByCategory = new Map<string, CoursePracticeCourseRow[]>();
  for (const course of orderedCourses) {
    const categoryKey = course.category_id ?? "";
    const siblings = coursesByCategory.get(categoryKey) ?? [];
    siblings.push(course);
    coursesByCategory.set(categoryKey, siblings);
  }

  return orderedCourses.map((course) => {
    const siblingCourses = coursesByCategory.get(course.category_id ?? "") ?? [];
    const courseIndex = siblingCourses.findIndex((item) => item.id === course.id);
    const previousCourse = siblingCourses[courseIndex - 1];
    const courseRule = evaluateRule({
      unlockMode: course.unlock_mode,
      availableFrom: course.available_from,
      manuallyLocked: course.is_manually_locked,
      previousCompleted: !previousCourse || completedCourseIds.has(previousCourse.id),
      prerequisiteCompleted:
        !course.prerequisite_course_id ||
        completedCourseIds.has(course.prerequisite_course_id),
      now,
    });
    const courseOpen = courseRule.isOpen;
    const prerequisiteCourse = courses.find(
      (item) => item.id === course.prerequisite_course_id,
    );
    const courseLockedReason = ruleReason({
      result: courseRule,
      availableFrom: course.available_from,
      previousLabel: previousCourse ? `上一门课程「${previousCourse.title}」` : "上一门课程",
      prerequisiteLabel: prerequisiteCourse
        ? `前置课程「${prerequisiteCourse.title}」`
        : "前置课程",
    });
    const courseLessons = lessonsByCourseId.get(course.id) ?? [];
    let chapterNumber = 0;
    const catalogChapters: CoursePracticeChapter[] = [];

    courseLessons.forEach((lesson, lessonIndex) => {
      const previousLesson = courseLessons[lessonIndex - 1];
      const prerequisiteLessonCompleted = Boolean(
        lesson.prerequisite_lesson_id &&
          completedLessonIds.has(lesson.prerequisite_lesson_id),
      );
      const prerequisiteChapterCompleted = Boolean(
        lesson.prerequisite_chapter_id &&
          completedChapterIds.has(lesson.prerequisite_chapter_id),
      );
      const lessonRule = evaluateRule({
          unlockMode: lesson.unlock_mode,
          availableFrom: lesson.available_from,
          manuallyLocked: lesson.is_manually_locked,
          previousCompleted:
            !previousLesson || completedLessonIds.has(previousLesson.id),
          prerequisiteCompleted:
            (!lesson.prerequisite_lesson_id || prerequisiteLessonCompleted) &&
            (!lesson.prerequisite_chapter_id || prerequisiteChapterCompleted),
          prerequisitePassed: lesson.prerequisite_chapter_id
            ? passedChapterIds.has(lesson.prerequisite_chapter_id) ||
              prerequisiteLessonCompleted
            : !lesson.prerequisite_lesson_id || prerequisiteLessonCompleted,
          now,
        });
      const lessonOpen = courseOpen && lessonRule.isOpen;
      const prerequisiteLesson = lessons.find(
        (item) => item.id === lesson.prerequisite_lesson_id,
      );
      const prerequisiteLessonChapter = chapters.find(
        (item) => item.id === lesson.prerequisite_chapter_id,
      );
      const lessonLockedReason = courseLockedReason ?? ruleReason({
        result: lessonRule,
        availableFrom: lesson.available_from,
        previousLabel: previousLesson ? `上一课时「${previousLesson.title}」` : "上一课时",
        prerequisiteLabel: prerequisiteLessonChapter
          ? `前置章节「${prerequisiteLessonChapter.title}」`
          : prerequisiteLesson
            ? `前置课时「${prerequisiteLesson.title}」`
            : "前置内容",
      });
      const lessonChapters = chapters
        .filter((chapter) => chapter.lesson_id === lesson.id)
        .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));

      lessonChapters.forEach((chapter, chapterIndex) => {
        chapterNumber += 1;
        const previousChapter = lessonChapters[chapterIndex - 1];
        const chapterRule = evaluateRule({
            unlockMode: chapter.unlock_mode,
            availableFrom: chapter.available_from,
            manuallyLocked: chapter.is_manually_locked,
            previousCompleted:
              !previousChapter || completedChapterIds.has(previousChapter.id),
            prerequisiteCompleted:
              !chapter.prerequisite_chapter_id ||
              completedChapterIds.has(chapter.prerequisite_chapter_id),
            prerequisitePassed:
              !chapter.prerequisite_chapter_id ||
              passedChapterIds.has(chapter.prerequisite_chapter_id),
            now,
          });
        const chapterOpen = lessonOpen && chapterRule.isOpen;
        const prerequisiteChapter = chapters.find(
          (item) => item.id === chapter.prerequisite_chapter_id,
        );
        const lockedReason = lessonLockedReason ?? ruleReason({
          result: chapterRule,
          availableFrom: chapter.available_from,
          previousLabel: previousChapter ? `上一章「${previousChapter.title}」` : "上一章",
          prerequisiteLabel: prerequisiteChapter
            ? `前置章节「${prerequisiteChapter.title}」`
            : "前置章节",
        });
        const hasPublishedContent = publishedPracticeChapterIds.has(chapter.id);
        const attempt = attemptByChapterId.get(chapter.id) ?? null;
        const savedPracticeProgress = practiceProgressByChapterId.get(chapter.id);
        const progressPercent = Number(savedPracticeProgress?.progress_percent) || 0;
        const status: CoursePracticeStatus = !chapterOpen
          ? "unavailable"
          : !hasPublishedContent
            ? "preparing"
            : savedPracticeProgress?.status === "mastered"
              ? "mastered"
              : savedPracticeProgress?.status === "needs_reinforcement"
                ? "needs_review"
                : savedPracticeProgress?.status === "in_progress"
                  ? "in_progress"
                  : "not_started";

        catalogChapters.push({
          ...chapter,
          number: chapterNumber,
          lessonSlug: lesson.slug,
          lessonTitle: lesson.title,
          isOpen: chapterOpen,
          hasPublishedContent,
          status,
          progressPercent,
          lastPracticedAt: savedPracticeProgress?.last_practiced_at ?? null,
          remainingItems: savedPracticeProgress?.remaining_items ?? [],
          lockedReason,
          attempt,
        });
      });
    });

    return {
      ...course,
      isOpen: courseOpen,
      lockedReason: courseLockedReason,
      chapters: catalogChapters,
    };
  });
}
