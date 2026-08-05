import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock3,
  GraduationCap,
  LockKeyhole,
  PlayCircle,
  Route,
} from "lucide-react";

import { getCourseLevelLabel, getLessonTypeLabel } from "@/lib/course-labels";
import { isCourseUnlocked, isLessonUnlocked } from "@/lib/course-unlocks";
import { getKoreanBeginnerLesson } from "@/lib/korean-curriculum";
import { HangulLessonLaunchLink } from "./[subcategorySlug]/[courseSlug]/HangulLessonLaunchLink";

type LessonProgressStatus = "not_started" | "in_progress" | "completed";

type Category = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  sort_order: number;
};

type Course = {
  id: string;
  category_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  sort_order: number;
  level: string | null;
  unlock_mode: string | null;
  prerequisite_course_id: string | null;
  available_from: string | null;
  is_manually_locked: boolean | null;
};

type Lesson = {
  id: string;
  course_id: string;
  slug: string;
  title: string;
  description: string | null;
  lesson_type: string;
  duration_minutes: number;
  is_free_preview: boolean;
  sort_order: number;
  unlock_mode: string | null;
  prerequisite_lesson_id: string | null;
  prerequisite_chapter_id: string | null;
  available_from: string | null;
  is_manually_locked: boolean | null;
};

type LessonProgress = {
  lesson_id: string;
  status: LessonProgressStatus;
  progress_percent: number;
};

type LessonItem = {
  lesson: Lesson;
  course: Course;
  subcategory: Category;
  unlocked: boolean;
  progress: LessonProgress | undefined;
};

function getLearningStatus(items: LessonItem[]) {
  if (items.length === 0) return "upcoming" as const;
  if (items.every((item) => item.progress?.status === "completed")) {
    return "completed" as const;
  }
  if (items.some((item) => item.progress?.status === "in_progress" || item.progress?.status === "completed")) {
    return "in_progress" as const;
  }
  return "not_started" as const;
}

function getStatusLabel(status: ReturnType<typeof getLearningStatus>) {
  if (status === "completed") return "已完成";
  if (status === "in_progress") return "学习中";
  if (status === "upcoming") return "即将开放";
  return "未开始";
}

export function KoreanLearningCenter({
  variant = "korean",
  parentCategory,
  subcategories,
  courses,
  lessons,
  progressList,
  prerequisiteChapterSlugEntries,
  passedChapterSlugs,
  readingProgressEntries,
  bypassLearningSequence,
}: {
  variant?: "korean" | "service";
  parentCategory: Category;
  subcategories: Category[];
  courses: Course[];
  lessons: Lesson[];
  progressList: LessonProgress[];
  prerequisiteChapterSlugEntries: Array<[string, string]>;
  passedChapterSlugs: string[];
  readingProgressEntries: Array<[string, number]>;
  bypassLearningSequence: boolean;
}) {
  const isService = variant === "service";
  const progressMap = new Map(progressList.map((progress) => [progress.lesson_id, progress]));
  const readingProgressByLessonId = new Map(readingProgressEntries);
  const completedLessonIds = new Set(
    progressList
      .filter((progress) => progress.status === "completed")
      .map((progress) => progress.lesson_id),
  );
  const prerequisiteChapterSlugById = new Map(prerequisiteChapterSlugEntries);
  const passedChapterSlugSet = new Set(passedChapterSlugs);
  const lessonsByCourseId = new Map<string, Lesson[]>();

  lessons.forEach((lesson) => {
    const courseLessons = lessonsByCourseId.get(lesson.course_id) ?? [];
    courseLessons.push(lesson);
    lessonsByCourseId.set(lesson.course_id, courseLessons);
  });

  const completedCourseIds = new Set(
    courses
      .filter((course) => {
        const courseLessons = lessonsByCourseId.get(course.id) ?? [];
        return courseLessons.length > 0 && courseLessons.every((lesson) => completedLessonIds.has(lesson.id));
      })
      .map((course) => course.id),
  );

  const lessonItems: LessonItem[] = [];
  const courseUnlockedById = new Map<string, boolean>();

  subcategories.forEach((subcategory) => {
    const orderedCourses = courses.filter((course) => course.category_id === subcategory.id);

    orderedCourses.forEach((course, courseIndex) => {
      const courseUnlocked =
        bypassLearningSequence ||
        isCourseUnlocked({
          course,
          courseIndex,
          orderedCourses,
          completedCourseIds,
        });
      courseUnlockedById.set(course.id, courseUnlocked);

      const orderedLessons = lessonsByCourseId.get(course.id) ?? [];
      orderedLessons.forEach((lesson, lessonIndex) => {
        const lessonUnlocked =
          courseUnlocked &&
          (bypassLearningSequence ||
            isLessonUnlocked({
              lesson,
              lessonIndex,
              orderedLessons,
              completedLessonIds,
              prerequisiteChapterSlugById,
              passedChapterSlugs: passedChapterSlugSet,
            }));

        const savedProgress = progressMap.get(lesson.id);
        const readingProgress = readingProgressByLessonId.get(lesson.id) ?? 0;
        const effectiveProgress =
          savedProgress?.status === "completed" || savedProgress?.status === "in_progress"
            ? savedProgress
            : readingProgress > 0
              ? {
                  lesson_id: lesson.id,
                  status: "in_progress" as const,
                  progress_percent: Math.max(savedProgress?.progress_percent ?? 0, readingProgress),
                }
              : savedProgress;

        lessonItems.push({
          lesson,
          course,
          subcategory,
          unlocked: lessonUnlocked,
          progress: effectiveProgress,
        });
      });
    });
  });

  const unlockedLessonItems = lessonItems.filter((item) => item.unlocked);
  const recommendedLesson =
    unlockedLessonItems.find((item) => item.progress?.status === "in_progress") ??
    unlockedLessonItems.find((item) => item.progress?.status !== "completed") ??
    unlockedLessonItems[0];
  const completedCount = lessonItems.filter((item) => item.progress?.status === "completed").length;
  const progressPercent = lessonItems.length > 0
    ? Math.round(
        lessonItems.reduce((total, item) => total + (item.progress?.progress_percent ?? 0), 0) /
          lessonItems.length,
      )
    : 0;
  const recommendedHref = recommendedLesson
    ? `/dashboard/courses/${parentCategory.slug}/${recommendedLesson.subcategory.slug}/${recommendedLesson.course.slug}/${recommendedLesson.lesson.slug}`
    : null;
  const recommendedIsCompleted = recommendedLesson?.progress?.status === "completed";
  const recommendedIsInProgress = recommendedLesson?.progress?.status === "in_progress";
  const recommendedLabel = recommendedIsCompleted
    ? "复习课程"
    : recommendedIsInProgress
      ? "继续学习"
      : isService
        ? "开始准备"
        : "开始第一课";
  const recommendedTitle = recommendedLesson
    ? (isService ? null : getKoreanBeginnerLesson(recommendedLesson.lesson.slug)?.title) ?? recommendedLesson.lesson.title
    : null;
  const recommendedProgress = recommendedLesson?.progress?.progress_percent ?? 0;
  const centerColor = isService ? "var(--app-accent)" : "var(--app-secondary)";
  const centerSoft = isService ? "var(--app-accent-soft)" : "var(--app-secondary-soft)";
  const stageMetricLabel = isService ? "准备阶段" : "学习阶段";
  const curriculumTitle = isService ? "完整服务路线" : "完整学习路线";
  const nextActionLabel = isService ? "接下来完成" : "接下来学";
  const totalProgressLabel = isService ? "留学服务总进度" : "韩语总进度";

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <Link
        href="/dashboard/courses"
        className="inline-flex items-center gap-2 text-sm font-bold app-muted-text transition hover:opacity-75"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        返回我的课程
      </Link>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="app-card rounded-[28px] border p-4 sm:p-5" aria-labelledby="course-curriculum-title">
          <div className="mb-4 flex items-center justify-between gap-4 px-1">
            <div>
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ color: centerColor, backgroundColor: centerSoft }}
                >
                  <Route size={18} aria-hidden="true" />
                </span>
                <h3 id="course-curriculum-title" className="text-lg font-black sm:text-xl">{curriculumTitle}</h3>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="app-card rounded-2xl border p-3 text-center sm:px-4">
                <p className="text-xl font-black sm:text-2xl">{progressPercent}%</p>
                <p className="mt-0.5 text-[11px] font-bold app-muted-text">总进度</p>
              </div>
              <div className="app-card rounded-2xl border p-3 text-center sm:px-4">
                <p className="text-xl font-black sm:text-2xl">{subcategories.length}</p>
                <p className="mt-0.5 text-[11px] font-bold app-muted-text">{stageMetricLabel}</p>
              </div>
              <div className="app-card rounded-2xl border p-3 text-center sm:px-4">
                <p className="text-xl font-black sm:text-2xl">{lessons.length}</p>
                <p className="mt-0.5 text-[11px] font-bold app-muted-text">可见课时</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {subcategories.map((subcategory, subcategoryIndex) => {
              const subcategoryCourses = courses.filter((course) => course.category_id === subcategory.id);
              const subcategoryItems = lessonItems.filter((item) => item.subcategory.id === subcategory.id);
              const status = getLearningStatus(subcategoryItems);

              return (
                <details
                  key={subcategory.id}
                  id={`stage-${subcategory.slug}`}
                  className="group scroll-mt-24 overflow-hidden rounded-2xl border"
                  style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-card-bg)" }}
                >
                  <summary
                    className="flex cursor-pointer list-none items-center gap-3 p-3.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--app-secondary)] sm:p-4 [&::-webkit-details-marker]:hidden"
                    style={{ backgroundColor: "var(--app-secondary-soft)" }}
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-black"
                      style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}
                    >
                      {String(subcategoryIndex + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-black">{subcategory.title}</h4>
                      <p className="mt-0.5 text-xs app-muted-text">
                        {subcategoryCourses.length} 门课程 · {subcategoryItems.length} 个可见课时
                      </p>
                    </div>
                    <span
                      className="hidden rounded-full px-2.5 py-1 text-[10px] font-black sm:inline-flex"
                      style={{
                        color: status === "upcoming" ? "var(--app-warm)" : "var(--app-secondary)",
                        backgroundColor: status === "upcoming" ? "var(--app-warm-soft)" : "var(--app-secondary-soft)",
                      }}
                    >
                      {getStatusLabel(status)}
                    </span>
                    <ChevronDown size={17} className="shrink-0 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
                  </summary>

                  <div className="space-y-3 border-t p-3 sm:p-4" style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-soft-bg)" }}>
                    {subcategoryCourses.length > 0 ? subcategoryCourses.map((course) => {
                      const courseItems = lessonItems.filter((item) => item.course.id === course.id);
                      const courseUnlocked = courseUnlockedById.get(course.id) ?? false;
                      const courseStatus = getLearningStatus(courseItems);
                      const levelLabel = getCourseLevelLabel(course.level);
                      const courseCompletedCount = courseItems.filter((item) => item.progress?.status === "completed").length;
                      const courseProgressPercent = courseItems.length > 0
                        ? Math.round(
                            courseItems.reduce((total, item) => total + (item.progress?.progress_percent ?? 0), 0) /
                              courseItems.length,
                          )
                        : 0;

                      return (
                        <details
                          key={course.id}
                          id={`course-${course.slug}`}
                          className="group/course scroll-mt-24 overflow-hidden rounded-2xl border"
                          style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-card-bg)" }}
                        >
                          <summary
                            className="flex cursor-pointer list-none items-center gap-3 p-3.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--app-secondary)] [&::-webkit-details-marker]:hidden"
                            style={{
                              borderLeft: courseUnlocked ? "4px solid var(--app-accent)" : "4px solid transparent",
                              backgroundColor: courseUnlocked ? "var(--app-card-bg)" : "var(--app-soft-bg)",
                            }}
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ color: courseUnlocked ? "var(--app-accent-strong)" : "var(--app-muted)", backgroundColor: "var(--app-card-bg)" }}>
                              {courseUnlocked ? <GraduationCap size={18} aria-hidden="true" /> : <LockKeyhole size={16} aria-hidden="true" />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h5 className="font-black">{course.title}</h5>
                                {levelLabel && <span className="rounded-full px-2 py-0.5 text-[10px] font-black app-muted-text" style={{ backgroundColor: "var(--app-soft-bg)" }}>{levelLabel}</span>}
                                <span className="shrink-0 text-xs app-muted-text">
                                  {courseItems.length > 0
                                    ? `${courseCompletedCount}/${courseItems.length} 课时完成 · ${getStatusLabel(courseStatus)}`
                                    : courseUnlocked
                                      ? "课程内容即将开放"
                                      : "完成前置课程后开放"}
                                </span>
                                {courseUnlocked && courseItems.length > 0 && (
                                  <>
                                    <div className="h-1.5 w-16 overflow-hidden rounded-full sm:w-20" style={{ backgroundColor: "var(--app-soft-bg)" }}>
                                      <div
                                        className="h-full rounded-full"
                                        style={{ width: `${courseProgressPercent}%`, backgroundColor: "var(--app-accent)" }}
                                      />
                                    </div>
                                    <span className="shrink-0 text-[10px] font-black" style={{ color: "var(--app-accent-strong)" }}>
                                      课程进度 {courseProgressPercent}%
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <ChevronDown size={16} className="shrink-0 transition-transform duration-200 group-open/course:rotate-180" aria-hidden="true" />
                          </summary>

                          <div
                            className="space-y-2 border-t p-3 sm:ml-4 sm:p-4"
                            style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-soft-bg)" }}
                          >
                            {courseItems.length > 0 ? courseItems.map((item, lessonIndex) => {
                              const curatedLesson = isService ? undefined : getKoreanBeginnerLesson(item.lesson.slug);
                              const lessonTitle = curatedLesson?.title ?? item.lesson.title;
                              const status = item.progress?.status ?? "not_started";
                              const lessonHref = `/dashboard/courses/${parentCategory.slug}/${subcategory.slug}/${course.slug}/${item.lesson.slug}`;

                              return (
                                <div
                                  key={item.lesson.id}
                                  className="grid grid-cols-[36px_minmax(0,1fr)] items-center gap-x-3 gap-y-3 rounded-xl border p-3.5 sm:grid-cols-[36px_minmax(0,1fr)_auto]"
                                  style={{
                                    borderColor: "var(--app-border)",
                                    borderLeft: status === "in_progress" ? "3px solid var(--app-accent)" : "3px solid transparent",
                                    backgroundColor:
                                      status === "in_progress"
                                        ? "var(--app-accent-soft)"
                                        : status === "completed"
                                          ? "var(--app-success-soft)"
                                          : "var(--app-card-bg)",
                                  }}
                                >
                                  <span
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black"
                                    style={{
                                      color: status === "completed" ? "var(--app-success)" : status === "in_progress" ? "var(--app-accent-strong)" : item.unlocked ? centerColor : "var(--app-muted)",
                                      backgroundColor: "var(--app-card-bg)",
                                    }}
                                  >
                                    {status === "completed" ? <CheckCircle2 size={17} aria-hidden="true" /> : String(lessonIndex + 1).padStart(2, "0")}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-bold">{lessonTitle}</p>
                                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] app-muted-text">
                                      <span>{getLessonTypeLabel(item.lesson.lesson_type)}</span>
                                      <span className="inline-flex items-center gap-1"><Clock3 size={11} aria-hidden="true" />{item.lesson.duration_minutes} 分钟</span>
                                      {curatedLesson && <span>{curatedLesson.focus}</span>}
                                    </p>
                                  </div>
                                  <HangulLessonLaunchLink
                                    href={lessonHref}
                                    shouldEnterFullscreen={!isService && (item.lesson.slug === "hangul-introduction" || item.lesson.slug === "basic-pronunciation")}
                                    locked={!item.unlocked}
                                    className="col-span-2 inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-black transition hover:opacity-90 sm:col-span-1"
                                    style={{ borderColor: "var(--app-border)", color: item.unlocked ? centerColor : "var(--app-muted)", backgroundColor: "var(--app-card-bg)" }}
                                  >
                                    {item.unlocked ? <PlayCircle size={14} aria-hidden="true" /> : <LockKeyhole size={13} aria-hidden="true" />}
                                    {!item.unlocked ? "尚未解锁" : status === "completed" ? "复习" : status === "in_progress" ? "继续" : "开始"}
                                  </HangulLessonLaunchLink>
                                </div>
                              );
                            }) : (
                              <p className="rounded-xl border border-dashed p-4 text-center text-xs app-muted-text" style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-card-bg)" }}>
                                {courseUnlocked ? "课程内容正在准备中" : "完成前置课程后自动开放"}
                              </p>
                            )}
                          </div>
                        </details>
                      );
                    }) : (
                      <p className="rounded-2xl border border-dashed p-5 text-center text-sm app-muted-text" style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-card-bg)" }}>
                        这一阶段的课程正在准备中
                      </p>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </section>

        <aside className="order-first space-y-4 lg:order-last lg:sticky lg:top-24" aria-label="当前学习进度">
          <section className="app-card rounded-[24px] border p-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold app-muted-text">{totalProgressLabel}</p>
                <p className="mt-1 text-3xl font-black">{progressPercent}%</p>
              </div>
              <span className="rounded-full px-2.5 py-1 text-[10px] font-black" style={{ color: "var(--app-success)", backgroundColor: "var(--app-success-soft)" }}>
                {completedCount} 课时完成
              </span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--app-soft-bg)" }}>
              <div className="h-full rounded-full" style={{ width: `${progressPercent}%`, backgroundColor: "var(--app-success)" }} />
            </div>
          </section>

          <section
            className="app-card relative overflow-hidden rounded-[28px] border p-5 shadow-sm"
            style={{ borderColor: centerColor, background: `linear-gradient(145deg, ${centerSoft}, var(--app-card-bg) 72%)` }}
          >
            <span className="absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-70" style={{ backgroundColor: centerSoft }} aria-hidden="true" />
            <div className="relative">
              <p className="flex items-center gap-2 text-xs font-black" style={{ color: centerColor }}>
                <PlayCircle size={15} aria-hidden="true" />
                {nextActionLabel}
              </p>
              {recommendedLesson && recommendedTitle ? (
                <>
                  <h3 className="mt-4 text-xl font-black leading-snug">{recommendedTitle}</h3>
                  <p className="mt-2 text-xs font-bold app-muted-text">
                    {recommendedLesson.subcategory.title} · {recommendedLesson.course.title}
                  </p>
                  <div className="mt-5 rounded-2xl border p-3.5" style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-card-bg)" }}>
                    <div className="flex items-center justify-between gap-3 text-xs font-bold">
                      <span>{recommendedIsInProgress ? "本课学习进度" : `${recommendedLesson.lesson.duration_minutes} 分钟`}</span>
                      {recommendedIsInProgress && <span>{recommendedProgress}%</span>}
                    </div>
                    {recommendedIsInProgress && (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--app-soft-bg)" }}>
                        <div className="h-full rounded-full" style={{ width: `${recommendedProgress}%`, backgroundColor: centerColor }} />
                      </div>
                    )}
                  </div>
                  <HangulLessonLaunchLink
                    href={recommendedHref ?? "#"}
                    shouldEnterFullscreen={!isService && (recommendedLesson.lesson.slug === "hangul-introduction" || recommendedLesson.lesson.slug === "basic-pronunciation")}
                    locked={!recommendedHref}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black shadow-sm transition hover:opacity-90"
                    style={{ color: "var(--app-accent-contrast)", backgroundColor: "var(--app-accent-strong)" }}
                  >
                    <PlayCircle size={17} aria-hidden="true" />
                    {recommendedLabel}
                  </HangulLessonLaunchLink>
                </>
              ) : (
                <p className="mt-4 rounded-2xl p-4 text-sm font-bold app-muted-text" style={{ backgroundColor: "var(--app-card-bg)" }}>暂无可进入的课时</p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
