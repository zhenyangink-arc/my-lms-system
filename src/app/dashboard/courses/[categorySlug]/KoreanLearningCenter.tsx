import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock3,
  GraduationCap,
  LockKeyhole,
  LockOpen,
  PlayCircle,
  RotateCcw,
  Route,
} from "lucide-react";

import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import { getCourseLevelLabel, getLessonTypeLabel } from "@/lib/course-labels";
import { getUnlockedChapterSlugs, isCourseUnlocked, isLessonUnlocked } from "@/lib/course-unlocks";
import { getKoreanBeginnerLesson } from "@/lib/korean-curriculum";
import { AnchorDetailsOpener } from "./AnchorDetailsOpener";
import { HangulLessonLaunchLink } from "./[subcategorySlug]/[courseSlug]/HangulLessonLaunchLink";

type LessonProgressStatus = "not_started" | "in_progress" | "completed";

type Category = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_object_key: string | null;
  cover_alt: string | null;
  cover_focal_point: string | null;
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
  cover_object_key: string | null;
  cover_alt: string | null;
  cover_focal_point: string | null;
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
  cover_object_key: string | null;
  cover_alt: string | null;
  cover_focal_point: string | null;
};

type LessonProgress = {
  lesson_id: string;
  status: LessonProgressStatus;
  progress_percent: number;
};

type CourseChapter = {
  id: string;
  lesson_id: string;
  slug: string;
  title: string;
  sort_order: number;
  unlock_mode: string | null;
  prerequisite_chapter_id: string | null;
  available_from: string | null;
  is_manually_locked: boolean | null;
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

function getChapterSequenceLabel(chapters: CourseChapter[], chapterIndex: number) {
  const startsWithOverview = chapters[0]?.slug.endsWith("-00") ?? false;
  return String(chapterIndex + (startsWithOverview ? 0 : 1)).padStart(2, "0");
}

function isPrepLesson(lesson: Lesson) {
  return lesson.title.startsWith("预备课");
}

function getLessonSequenceLabel(lessonItems: LessonItem[], lessonIndex: number) {
  const item = lessonItems[lessonIndex];
  if (!item || isPrepLesson(item.lesson)) return "预备课";
  const levelPosition = lessonItems
    .slice(0, lessonIndex + 1)
    .filter((prior) => prior.course.id === item.course.id && !isPrepLesson(prior.lesson))
    .length;
  return `第 ${levelPosition} 课`;
}

export function KoreanLearningCenter({
  variant = "korean",
  parentCategory,
  subcategories,
  courses,
  lessons,
  chapters,
  progressList,
  prerequisiteChapterSlugEntries,
  passedChapterSlugs,
  completedChapterSlugs,
  chapterProgressEntries,
  readingProgressEntries,
  bypassLearningSequence,
  selectedCourseSlug,
  courseBasePath,
}: {
  variant?: "korean" | "service";
  parentCategory: Category;
  subcategories: Category[];
  courses: Course[];
  lessons: Lesson[];
  chapters: CourseChapter[];
  progressList: LessonProgress[];
  prerequisiteChapterSlugEntries: Array<[string, string]>;
  passedChapterSlugs: string[];
  completedChapterSlugs: string[];
  chapterProgressEntries: Array<[string, number]>;
  readingProgressEntries: Array<[string, number]>;
  bypassLearningSequence: boolean;
  selectedCourseSlug?: string;
  courseBasePath: string;
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
  const completedChapterSlugSet = new Set(completedChapterSlugs);
  const chapterProgressBySlug = new Map(chapterProgressEntries);
  const lessonsByCourseId = new Map<string, Lesson[]>();
  const chaptersByLessonId = new Map<string, CourseChapter[]>();

  lessons.forEach((lesson) => {
    const courseLessons = lessonsByCourseId.get(lesson.course_id) ?? [];
    courseLessons.push(lesson);
    lessonsByCourseId.set(lesson.course_id, courseLessons);
  });

  chapters.forEach((chapter) => {
    const lessonChapters = chaptersByLessonId.get(chapter.lesson_id) ?? [];
    lessonChapters.push(chapter);
    chaptersByLessonId.set(chapter.lesson_id, lessonChapters);
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
        const hasChapterProgress = (chaptersByLessonId.get(lesson.id)?.length ?? 0) > 0;
        const effectiveProgress =
          savedProgress?.status === "completed"
            ? savedProgress
            : hasChapterProgress && (savedProgress?.status === "in_progress" || readingProgress > 0)
              ? {
                  lesson_id: lesson.id,
                  status: "in_progress" as const,
                  progress_percent: Math.max(savedProgress?.progress_percent ?? 0, readingProgress),
                }
              : savedProgress?.status === "in_progress"
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

  const selectedCourse = selectedCourseSlug
    ? courses.find((course) => course.slug === selectedCourseSlug)
    : undefined;
  const visibleCourses = selectedCourse ? [selectedCourse] : courses;
  const visibleCourseIds = new Set(visibleCourses.map((course) => course.id));
  const visibleSubcategories = selectedCourse
    ? subcategories.filter(
        (subcategory) => subcategory.id === selectedCourse.category_id,
      )
    : subcategories;
  const visibleLessonItems = selectedCourse
    ? lessonItems.filter((item) => visibleCourseIds.has(item.course.id))
    : lessonItems;
  const visibleLessons = selectedCourse
    ? lessons.filter((lesson) => visibleCourseIds.has(lesson.course_id))
    : lessons;
  const unlockedLessonItems = visibleLessonItems.filter((item) => item.unlocked);
  const recommendedLesson =
    unlockedLessonItems.find((item) => item.progress?.status === "in_progress") ??
    unlockedLessonItems.find((item) => item.progress?.status !== "completed") ??
    unlockedLessonItems[0];
  const completedCount = visibleLessonItems.filter((item) => item.progress?.status === "completed").length;
  const progressPercent = visibleLessonItems.length > 0
    ? Math.round(
        visibleLessonItems.reduce((total, item) => total + (item.progress?.progress_percent ?? 0), 0) /
          visibleLessonItems.length,
      )
    : 0;
  const recommendedLessonHref = recommendedLesson
    ? `${courseBasePath}/${parentCategory.slug}/${recommendedLesson.subcategory.slug}/${recommendedLesson.course.slug}/${recommendedLesson.lesson.slug}`
    : null;
  const recommendedLessonTitle = recommendedLesson
    ? (isService ? null : getKoreanBeginnerLesson(recommendedLesson.lesson.slug)?.title) ?? recommendedLesson.lesson.title
    : null;
  const recommendedChapters = recommendedLesson
    ? (chaptersByLessonId.get(recommendedLesson.lesson.id) ?? [])
    : [];
  const recommendedUnlockedChapterSlugs = bypassLearningSequence
    ? new Set(recommendedChapters.map((chapter) => chapter.slug))
    : getUnlockedChapterSlugs({
        chapters: recommendedChapters,
        passedChapterSlugs: passedChapterSlugSet,
        completedChapterSlugs: completedChapterSlugSet,
      });
  const recommendedChapter =
    recommendedChapters.find((chapter) => {
      const progress = chapterProgressBySlug.get(chapter.slug) ?? 0;
      const completed =
        recommendedLesson?.progress?.status === "completed" ||
        completedChapterSlugSet.has(chapter.slug);
      const accessible =
        completed || progress > 0 || recommendedUnlockedChapterSlugs.has(chapter.slug);
      return accessible && !completed && progress > 0 && progress < 100;
    }) ??
    recommendedChapters.find((chapter) => {
      const progress = chapterProgressBySlug.get(chapter.slug) ?? 0;
      const completed =
        recommendedLesson?.progress?.status === "completed" ||
        completedChapterSlugSet.has(chapter.slug);
      const accessible =
        completed || progress > 0 || recommendedUnlockedChapterSlugs.has(chapter.slug);
      return accessible && !completed;
    }) ??
    (recommendedLesson?.progress?.status === "completed" ? recommendedChapters[0] : undefined);
  const recommendedChapterIndex = recommendedChapter
    ? recommendedChapters.findIndex((chapter) => chapter.id === recommendedChapter.id)
    : -1;
  const recommendedChapterSequenceLabel = recommendedChapterIndex >= 0
    ? getChapterSequenceLabel(recommendedChapters, recommendedChapterIndex)
    : null;
  const recommendedIsOverview = recommendedChapter?.slug.endsWith("-00") ?? false;
  const recommendedChapterCompleted = Boolean(
    recommendedChapter &&
      (recommendedLesson?.progress?.status === "completed" ||
        completedChapterSlugSet.has(recommendedChapter.slug)),
  );
  const recommendedProgress = recommendedChapter
    ? recommendedChapterCompleted
      ? 100
      : (chapterProgressBySlug.get(recommendedChapter.slug) ?? 0)
    : (recommendedLesson?.progress?.progress_percent ?? 0);
  const recommendedIsCompleted = recommendedChapter
    ? recommendedChapterCompleted
    : recommendedLesson?.progress?.status === "completed";
  const recommendedIsInProgress = recommendedChapter
    ? !recommendedChapterCompleted && recommendedProgress > 0
    : recommendedLesson?.progress?.status === "in_progress";
  const recommendedLabel = recommendedIsCompleted
    ? recommendedIsOverview ? "复习总览" : recommendedChapter ? "复习本章" : "复习课程"
    : recommendedIsInProgress
      ? recommendedIsOverview ? "继续总览" : recommendedChapter ? "继续本章" : "继续学习"
      : isService
        ? "开始准备"
        : recommendedIsOverview ? "开始总览" : recommendedChapter ? "开始本章" : "开始第一课";
  const recommendedTitle = recommendedChapter?.title ?? recommendedLessonTitle;
  const recommendedContextLabel = recommendedChapter && recommendedLessonTitle && recommendedChapterSequenceLabel
    ? `${recommendedLessonTitle} · 第 ${recommendedChapterSequenceLabel} 章`
    : recommendedLesson
      ? `${recommendedLesson.subcategory.title} · ${recommendedLesson.course.title}`
      : "";
  const recommendedHref = recommendedChapter && recommendedLessonHref
    ? `${recommendedLessonHref}?chapter=${encodeURIComponent(recommendedChapter.slug)}`
    : recommendedLessonHref;
  const recommendedChapterCount = recommendedLesson
    ? (chaptersByLessonId.get(recommendedLesson.lesson.id)?.length ?? 0)
    : 0;
  const recommendedDurationLabel = recommendedLesson
    ? recommendedChapter
      ? "预计 1 小时"
      : recommendedChapterCount > 0
        ? `${recommendedChapterCount} 小时`
      : `${recommendedLesson.lesson.duration_minutes} 分钟`
    : "";
  const centerColor = isService ? "var(--primary)" : "var(--support)";
  const centerSoft = isService ? "var(--accent)" : "var(--support-surface)";
  const stageMetricLabel = isService ? "准备阶段" : "学习阶段";
  const curriculumTitle = selectedCourse
    ? `${selectedCourse.title}学习路线`
    : isService
      ? "完整服务路线"
      : "完整学习路线";
  const nextActionLabel = isService ? "接下来完成" : "接下来学";
  const totalProgressLabel = selectedCourse
    ? `${selectedCourse.title}进度`
    : isService
      ? "留学服务总进度"
      : "韩语总进度";

  const getLessonLaunchHref = ({
    lessonHref,
    lessonChapters,
    lessonStatus,
    unlockedChapterSlugs,
  }: {
    lessonHref: string;
    lessonChapters: CourseChapter[];
    lessonStatus: LessonProgressStatus;
    unlockedChapterSlugs: Set<string>;
  }) => {
    const isCompleted = (chapter: CourseChapter) =>
      lessonStatus === "completed" || completedChapterSlugSet.has(chapter.slug);
    const isAccessible = (chapter: CourseChapter) =>
      isCompleted(chapter) ||
      (chapterProgressBySlug.get(chapter.slug) ?? 0) > 0 ||
      unlockedChapterSlugs.has(chapter.slug);
    const launchChapter =
      lessonChapters.find((chapter) => {
        const progress = chapterProgressBySlug.get(chapter.slug) ?? 0;
        return isAccessible(chapter) && !isCompleted(chapter) && progress > 0 && progress < 100;
      }) ??
      lessonChapters.find(
        (chapter) => isAccessible(chapter) && !isCompleted(chapter),
      ) ??
      (lessonStatus === "completed" ? lessonChapters[0] : undefined);

    return launchChapter
      ? `${lessonHref}?chapter=${encodeURIComponent(launchChapter.slug)}`
      : lessonHref;
  };

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-5 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <AnchorDetailsOpener />
      <Link
        href={courseBasePath}
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
                <h3 id="course-curriculum-title" className="text-lg font-bold sm:text-xl">{curriculumTitle}</h3>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="app-card rounded-2xl border p-3 text-center sm:px-4">
                <p className="text-xl font-bold sm:text-2xl">{progressPercent}%</p>
                <p className="mt-0.5 text-[11px] font-bold app-muted-text">总进度</p>
              </div>
              <div className="app-card rounded-2xl border p-3 text-center sm:px-4">
                <p className="text-xl font-bold sm:text-2xl">{visibleSubcategories.length}</p>
                <p className="mt-0.5 text-[11px] font-bold app-muted-text">{stageMetricLabel}</p>
              </div>
              <div className="app-card rounded-2xl border p-3 text-center sm:px-4">
                <p className="text-xl font-bold sm:text-2xl">{visibleLessons.length}</p>
                <p className="mt-0.5 text-[11px] font-bold app-muted-text">可见课时</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {selectedCourse ? (
              <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visibleLessonItems.map((item, lessonIndex) => {
                  const curatedLesson = isService
                    ? undefined
                    : getKoreanBeginnerLesson(item.lesson.slug);
                  const lessonTitle = curatedLesson?.title ?? item.lesson.title;
                  const status = item.progress?.status ?? "not_started";
                  const lessonHref = `${courseBasePath}/${parentCategory.slug}/${item.subcategory.slug}/${item.course.slug}/${item.lesson.slug}`;
                  const lessonChapters = chaptersByLessonId.get(item.lesson.id) ?? [];
                  const completedChapterCount = status === "completed"
                    ? lessonChapters.length
                    : lessonChapters.filter((chapter) =>
                        completedChapterSlugSet.has(chapter.slug),
                      ).length;
                  const lessonProgressPercent =
                    status === "completed"
                      ? 100
                      : Math.min(100, Math.max(0, item.progress?.progress_percent ?? 0));
                  const unlockedChapterSlugs = bypassLearningSequence
                    ? new Set(lessonChapters.map((chapter) => chapter.slug))
                    : getUnlockedChapterSlugs({
                        chapters: lessonChapters,
                        passedChapterSlugs: passedChapterSlugSet,
                        completedChapterSlugs: completedChapterSlugSet,
                      });
                  const lessonLaunchHref = getLessonLaunchHref({
                    lessonHref,
                    lessonChapters,
                    lessonStatus: status,
                    unlockedChapterSlugs,
                  });

                  if (item.lesson.cover_object_key) {
                    return (
                      <article
                        key={item.lesson.id}
                        className="app-card group overflow-hidden rounded-[24px] border border-[var(--border-subtle)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg motion-reduce:transform-none"
                      >
                        <div className="relative aspect-video overflow-hidden bg-[var(--surface-soft)]">
                          <Image
                            src={`/api/course-assets/lesson/${item.lesson.id}`}
                            alt={item.lesson.cover_alt || `${item.lesson.title}封面`}
                            fill
                            sizes="(min-width: 1280px) 22vw, (min-width: 768px) 40vw, 100vw"
                            unoptimized
                            className="object-cover transition-transform duration-500 group-hover:scale-[1.018] motion-reduce:transition-none"
                            style={{
                              objectPosition: item.lesson.cover_focal_point || "50% 50%",
                            }}
                          />

                        <div
                          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-black/10"
                          aria-hidden="true"
                        />

                        <div className="absolute left-3 right-3 top-3 flex items-start justify-end gap-1">
                          <CardTitleWithHint
                            title={lessonTitle}
                            description={
                              <span>
                                {item.lesson.description || "完成本课学习内容与练习。"}
                                {curatedLesson ? ` 学习重点：${curatedLesson.focus}` : ""}
                              </span>
                            }
                            headingLevel={4}
                            titleClassName="sr-only"
                            className="drop-shadow-sm"
                            hintClassName="!h-8 !w-8 !pt-1 text-slate-700"
                            hintLabel={`查看${item.lesson.title}课程说明`}
                          />
                          <span
                            className="inline-flex min-h-7 items-center gap-1 rounded-full border border-white/60 bg-white/90 px-2.5 text-[10px] font-bold shadow-sm backdrop-blur-sm"
                            style={{
                              color:
                                status === "completed"
                                  ? "var(--status-success)"
                                  : status === "in_progress"
                                    ? "var(--primary-hover)"
                                    : item.unlocked
                                      ? centerColor
                                      : "var(--foreground-muted)",
                            }}
                          >
                            {status === "completed" ? (
                              <CheckCircle2 size={12} aria-hidden="true" />
                            ) : null}
                            {!item.unlocked ? "待解锁" : getStatusLabel(status)}
                          </span>
                        </div>

                        <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                          <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-bold">
                            <span className="inline-flex items-center gap-1">
                              <Clock3 size={12} aria-hidden="true" />
                              {lessonChapters.length > 0
                                ? `${lessonChapters.length} 小时`
                                : `${item.lesson.duration_minutes} 分钟`}
                            </span>
                            <span className="tabular-nums">{lessonProgressPercent}%</span>
                          </div>
                          <div className="h-1 overflow-hidden rounded-full bg-white/30">
                            <div
                              className="h-full rounded-full bg-white"
                              style={{ width: `${lessonProgressPercent}%` }}
                            />
                          </div>
                          <HangulLessonLaunchLink
                            href={lessonLaunchHref}
                            shouldEnterFullscreen={
                              !isService &&
                              (item.lesson.slug === "hangul-introduction" ||
                                item.lesson.slug === "basic-pronunciation")
                            }
                            locked={!item.unlocked}
                            className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-white/45 bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-900 shadow-sm backdrop-blur-sm transition hover:bg-white"
                            style={{}}
                          >
                            {!item.unlocked ? (
                              <LockKeyhole size={13} aria-hidden="true" />
                            ) : status === "completed" ? (
                              <RotateCcw size={14} aria-hidden="true" />
                            ) : (
                              <PlayCircle size={14} aria-hidden="true" />
                            )}
                            {!item.unlocked
                              ? "完成前置内容后进入"
                              : status === "completed"
                                ? "复习课时"
                                : status === "in_progress"
                                  ? "继续学习"
                                  : "开始学习"}
                          </HangulLessonLaunchLink>
                        </div>

                        </div>

                        {lessonChapters.length > 0 ? (
                          <details
                            open={status === "in_progress"}
                            className="group/cover-chapters border-t border-[var(--border-subtle)]"
                          >
                            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] [&::-webkit-details-marker]:hidden">
                              <span>
                                章节目录 · {completedChapterCount}/{lessonChapters.length}
                              </span>
                              <span className="inline-flex items-center gap-1.5 app-muted-text">
                                查看章节
                                <ChevronDown
                                  size={15}
                                  className="transition-transform group-open/cover-chapters:rotate-180"
                                  aria-hidden="true"
                                />
                              </span>
                            </summary>

                            <ol className="space-y-1 border-t border-[var(--border-subtle)] bg-[var(--surface-soft)] p-2">
                              {lessonChapters.map((chapter, chapterIndex) => {
                                const chapterCompleted =
                                  status === "completed" ||
                                  completedChapterSlugSet.has(chapter.slug);
                                const chapterProgress = chapterCompleted
                                  ? 100
                                  : (chapterProgressBySlug.get(chapter.slug) ?? 0);
                                const chapterUnlocked =
                                  chapterCompleted ||
                                  chapterProgress > 0 ||
                                  (item.unlocked && unlockedChapterSlugs.has(chapter.slug));
                                const chapterStatusLabel = chapterCompleted
                                  ? "已完成"
                                  : chapterProgress > 0
                                    ? `学习中 ${chapterProgress}%`
                                    : chapterUnlocked
                                      ? "可学习"
                                      : "待解锁";
                                const chapterContent = (
                                  <>
                                    <span
                                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold"
                                      style={{
                                        color: chapterCompleted
                                          ? "var(--status-success)"
                                          : chapterUnlocked
                                            ? centerColor
                                            : "var(--foreground-muted)",
                                        backgroundColor: "var(--card)",
                                      }}
                                    >
                                      {chapterCompleted ? (
                                        <CheckCircle2 size={15} aria-hidden="true" />
                                      ) : (
                                        getChapterSequenceLabel(lessonChapters, chapterIndex)
                                      )}
                                    </span>
                                    <span className="min-w-0 flex-1 text-xs font-bold">
                                      {chapter.title}
                                    </span>
                                    <span className="shrink-0 text-[10px] font-bold app-muted-text">
                                      {chapterStatusLabel}
                                    </span>
                                    {chapterUnlocked ? (
                                      <LockOpen
                                        size={16}
                                        className={
                                          chapterCompleted
                                            ? "shrink-0 -scale-x-100 text-[var(--status-success)]"
                                            : "shrink-0 -scale-x-100 text-[var(--support)]"
                                        }
                                        aria-label={chapterCompleted ? "已完成，已解锁" : "已解锁"}
                                      />
                                    ) : (
                                      <LockKeyhole size={13} aria-label="待解锁" />
                                    )}
                                  </>
                                );

                                return (
                                  <li key={chapter.id}>
                                    {chapterUnlocked ? (
                                      <HangulLessonLaunchLink
                                        href={`${lessonHref}?chapter=${encodeURIComponent(chapter.slug)}`}
                                        shouldEnterFullscreen={!isService && (item.lesson.slug === "hangul-introduction" || item.lesson.slug === "basic-pronunciation")}
                                        locked={false}
                                        className="flex min-h-11 items-center gap-2 rounded-lg border border-transparent px-2.5 py-1.5 transition hover:border-[var(--border)] hover:bg-[var(--card)]"
                                      >
                                        {chapterContent}
                                      </HangulLessonLaunchLink>
                                    ) : (
                                      <div
                                        className="flex min-h-10 items-center gap-2 rounded-lg px-2.5 py-1.5 opacity-60"
                                        aria-label={`${chapter.title}，${chapterStatusLabel}`}
                                      >
                                        {chapterContent}
                                      </div>
                                    )}
                                  </li>
                                );
                              })}
                            </ol>
                          </details>
                        ) : null}
                      </article>
                    );
                  }

                  return (
                    <article
                      key={item.lesson.id}
                      className="app-card flex min-h-[320px] flex-col overflow-hidden rounded-[24px] border p-5 shadow-sm"
                      style={{
                        borderColor:
                          status === "in_progress"
                            ? "var(--primary)"
                            : "var(--border)",
                        backgroundColor:
                          status === "completed"
                            ? "var(--status-success-surface)"
                            : "var(--card)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold"
                          style={{ color: centerColor, backgroundColor: centerSoft }}
                        >
                          {status === "completed" ? (
                            <CheckCircle2 size={20} aria-hidden="true" />
                          ) : (
                            String(lessonIndex + 1).padStart(2, "0")
                          )}
                        </span>
                        <span
                          className="rounded-full px-2.5 py-1 text-[10px] font-bold"
                          style={{
                            color:
                              status === "completed"
                                ? "var(--status-success)"
                                : status === "in_progress"
                                  ? "var(--primary-hover)"
                                  : item.unlocked
                                    ? centerColor
                                    : "var(--foreground-muted)",
                            backgroundColor: "var(--surface-soft)",
                          }}
                        >
                          {!item.unlocked ? "待解锁" : getStatusLabel(status)}
                        </span>
                      </div>

                      <div className="mt-5">
                        <p className="text-[11px] font-bold tracking-[.14em] app-muted-text">
                          {item.course.title} · {getLessonSequenceLabel(visibleLessonItems, lessonIndex)}
                        </p>
                        <CardTitleWithHint
                          className="mt-2"
                          headingLevel={4}
                          title={lessonTitle}
                          description={curatedLesson?.focus ?? item.lesson.description ?? "完成本课学习内容与练习。"}
                          titleClassName="text-xl font-bold leading-snug"
                        />
                      </div>

                      <div className="mt-5 rounded-2xl bg-[var(--surface-soft)] p-3.5">
                        <div className="flex items-center justify-between gap-3 text-xs font-bold">
                          <span className="inline-flex items-center gap-1.5 app-muted-text">
                            <Clock3 size={13} aria-hidden="true" />
                            {lessonChapters.length > 0
                              ? `${lessonChapters.length} 小时`
                              : `${item.lesson.duration_minutes} 分钟`}
                          </span>
                          <span style={{ color: centerColor }}>
                            {lessonChapters.length > 0
                              ? `${completedChapterCount}/${lessonChapters.length} 章节 · 课程进度 ${lessonProgressPercent}%`
                              : `课程进度 ${lessonProgressPercent}%`}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--card)]">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${lessonProgressPercent}%`,
                              backgroundColor:
                                status === "completed"
                                  ? "var(--status-success)"
                                  : centerColor,
                            }}
                          />
                        </div>
                      </div>

                      <div className="mt-auto pt-5">
                        <HangulLessonLaunchLink
                          href={lessonLaunchHref}
                          shouldEnterFullscreen={
                            !isService &&
                            (item.lesson.slug === "hangul-introduction" ||
                              item.lesson.slug === "basic-pronunciation")
                          }
                          locked={!item.unlocked}
                          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
                          style={{
                            color: !item.unlocked
                              ? "var(--primary-foreground)"
                              : status === "completed"
                                ? "var(--lesson-review-text)"
                                : status === "in_progress"
                                  ? "var(--lesson-continue-text)"
                                  : "var(--lesson-start-text)",
                            backgroundColor: !item.unlocked
                              ? "var(--foreground-muted)"
                              : status === "completed"
                                ? "var(--lesson-review-bg)"
                                : status === "in_progress"
                                  ? "var(--lesson-continue-bg)"
                                  : "var(--lesson-start-bg)",
                            borderColor: !item.unlocked
                              ? "var(--foreground-muted)"
                              : status === "completed"
                                ? "var(--lesson-review-border)"
                                : status === "in_progress"
                                  ? "var(--lesson-continue-border)"
                                  : "var(--lesson-start-border)",
                          }}
                        >
                          {!item.unlocked ? (
                            <LockKeyhole size={15} aria-hidden="true" />
                          ) : status === "completed" ? (
                            <RotateCcw size={16} aria-hidden="true" />
                          ) : (
                            <PlayCircle size={16} aria-hidden="true" />
                          )}
                          {!item.unlocked
                            ? "完成前置内容后进入"
                            : status === "completed"
                              ? "复习本课"
                              : status === "in_progress"
                                ? "继续学习"
                                : "开始学习"}
                        </HangulLessonLaunchLink>

                        {lessonChapters.length > 0 && (
                          <details className="group/chapters mt-3 overflow-hidden rounded-xl border border-[var(--border-subtle)]">
                            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] [&::-webkit-details-marker]:hidden">
                              <span>章节目录</span>
                              <ChevronDown
                                size={15}
                                className="transition-transform group-open/chapters:rotate-180"
                                aria-hidden="true"
                              />
                            </summary>
                            <ol className="space-y-1 border-t border-[var(--border-subtle)] p-2">
                              {lessonChapters.map((chapter, chapterIndex) => {
                                const chapterCompleted =
                                  status === "completed" || completedChapterSlugSet.has(chapter.slug);
                                const chapterProgress = chapterCompleted
                                  ? 100
                                  : (chapterProgressBySlug.get(chapter.slug) ?? 0);
                                // 历史学习事实优先于当前顺序规则：已经读过或通过测试的章节不能重新上锁。
                                const chapterUnlocked =
                                  chapterCompleted ||
                                  chapterProgress > 0 ||
                                  (item.unlocked && unlockedChapterSlugs.has(chapter.slug));
                                return (
                                  <li key={chapter.id}>
                                    {chapterUnlocked ? (
                                      <HangulLessonLaunchLink
                                        href={`${lessonHref}?chapter=${encodeURIComponent(chapter.slug)}`}
                                        shouldEnterFullscreen={!isService && (item.lesson.slug === "hangul-introduction" || item.lesson.slug === "basic-pronunciation")}
                                        locked={false}
                                        className="flex min-h-11 items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-bold transition hover:bg-[var(--accent)]"
                                      >
                                        <span className="app-muted-text">
                                          {getChapterSequenceLabel(lessonChapters, chapterIndex)}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate">{chapter.title}</span>
                                        <LockOpen
                                          size={16}
                                          className={chapterCompleted ? "shrink-0 -scale-x-100 text-[var(--status-success)]" : "shrink-0 -scale-x-100 text-[var(--support)]"}
                                          aria-label={chapterCompleted ? "已完成，已解锁" : "已解锁"}
                                        />
                                      </HangulLessonLaunchLink>
                                    ) : (
                                      <div className="flex min-h-10 items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-bold opacity-55">
                                        <span>{getChapterSequenceLabel(lessonChapters, chapterIndex)}</span>
                                        <span className="min-w-0 flex-1 truncate">{chapter.title}</span>
                                        <LockKeyhole size={13} aria-label="待解锁" />
                                      </div>
                                    )}
                                  </li>
                                );
                              })}
                            </ol>
                          </details>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : visibleSubcategories.map((subcategory, subcategoryIndex) => {
              const subcategoryCourses = visibleCourses.filter((course) => course.category_id === subcategory.id);
              const subcategoryItems = visibleLessonItems.filter((item) => item.subcategory.id === subcategory.id);
              const status = getLearningStatus(subcategoryItems);

              return (
                <details
                  key={subcategory.id}
                  id={`stage-${subcategory.slug}`}
                  open={Boolean(selectedCourse) || status === "in_progress"}
                  className="group scroll-mt-24 overflow-hidden rounded-2xl border"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
                >
                  <summary
                    className="flex cursor-pointer list-none items-center gap-3 p-3.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--support)] sm:p-4 [&::-webkit-details-marker]:hidden"
                    style={{ backgroundColor: "var(--support-surface)" }}
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold"
                      style={{ color: "var(--support)", backgroundColor: "var(--support-surface)" }}
                    >
                      {String(subcategoryIndex + 1).padStart(2, "0")}
                    </span>
                    {subcategory.cover_object_key && (
                      <img
                        src={`/api/course-assets/category/${subcategory.id}`}
                        alt={subcategory.cover_alt || `${subcategory.title}封面`}
                        className="hidden aspect-video w-24 shrink-0 rounded-lg border border-[var(--border-subtle)] object-cover sm:block"
                        style={{ objectPosition: subcategory.cover_focal_point || "50% 50%" }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <CardTitleWithHint
                        headingLevel={4}
                        title={subcategory.title}
                        description={`${subcategoryCourses.length} 门课程 · ${subcategoryItems.length} 个可见课时`}
                        titleClassName="font-bold"
                      />
                    </div>
                    <span
                      className="hidden rounded-full px-2.5 py-1 text-[10px] font-bold sm:inline-flex"
                      style={{
                        color: status === "upcoming" ? "var(--status-warning)" : "var(--support)",
                        backgroundColor: status === "upcoming" ? "var(--status-warning-surface)" : "var(--support-surface)",
                      }}
                    >
                      {getStatusLabel(status)}
                    </span>
                    <ChevronDown size={17} className="shrink-0 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
                  </summary>

                  <div className="space-y-3 border-t p-3 sm:p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-soft)" }}>
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
                          open={courseStatus === "in_progress"}
                          className="group/course scroll-mt-24 overflow-hidden rounded-2xl border"
                          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
                        >
                          <summary
                            className="flex cursor-pointer list-none items-center gap-3 p-3.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--support)] [&::-webkit-details-marker]:hidden"
                            style={{
                              borderLeft: courseUnlocked ? "4px solid var(--primary)" : "4px solid transparent",
                              backgroundColor: courseUnlocked ? "var(--card)" : "var(--surface-soft)",
                            }}
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ color: courseUnlocked ? "var(--primary-hover)" : "var(--foreground-muted)", backgroundColor: "var(--card)" }}>
                              {courseUnlocked ? <GraduationCap size={18} aria-hidden="true" /> : <LockKeyhole size={16} aria-hidden="true" />}
                            </span>
                            {course.cover_object_key && (
                              <img
                                src={`/api/course-assets/course/${course.id}`}
                                alt={course.cover_alt || `${course.title}封面`}
                                className="aspect-video w-28 shrink-0 rounded-xl border border-[var(--border-subtle)] object-cover shadow-sm"
                                style={{ objectPosition: course.cover_focal_point || "50% 50%" }}
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h5 className="font-bold">{course.title}</h5>
                                {levelLabel && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold app-muted-text" style={{ backgroundColor: "var(--surface-soft)" }}>{levelLabel}</span>}
                                <span className="shrink-0 text-xs app-muted-text">
                                  {courseItems.length > 0
                                    ? `${courseCompletedCount}/${courseItems.length} 课时完成 · ${getStatusLabel(courseStatus)}`
                                    : courseUnlocked
                                      ? "课程内容即将开放"
                                      : "完成前置课程后开放"}
                                </span>
                                {courseUnlocked && courseItems.length > 0 && (
                                  <>
                                    <div className="h-1.5 w-16 overflow-hidden rounded-full sm:w-20" style={{ backgroundColor: "var(--surface-soft)" }}>
                                      <div
                                        className="h-full rounded-full"
                                        style={{ width: `${courseProgressPercent}%`, backgroundColor: "var(--primary)" }}
                                      />
                                    </div>
                                    <span className="shrink-0 text-[10px] font-bold" style={{ color: "var(--primary-hover)" }}>
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
                            style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-soft)" }}
                          >
                            {courseItems.length > 0 ? courseItems.map((item, lessonIndex) => {
                              const curatedLesson = isService ? undefined : getKoreanBeginnerLesson(item.lesson.slug);
                              const lessonTitle = curatedLesson?.title ?? item.lesson.title;
                              const status = item.progress?.status ?? "not_started";
                              const lessonHref = `${courseBasePath}/${parentCategory.slug}/${subcategory.slug}/${course.slug}/${item.lesson.slug}`;

                              const lessonChapters = chaptersByLessonId.get(item.lesson.id) ?? [];
                              const completedChapterCount = status === "completed"
                                ? lessonChapters.length
                                : lessonChapters.filter((chapter) =>
                                    completedChapterSlugSet.has(chapter.slug),
                                  ).length;
                              const unlockedChapterSlugs = bypassLearningSequence
                                ? new Set(lessonChapters.map((chapter) => chapter.slug))
                                : getUnlockedChapterSlugs({
                                    chapters: lessonChapters,
                                    passedChapterSlugs: passedChapterSlugSet,
                                    completedChapterSlugs: completedChapterSlugSet,
                                  });
                              const lessonLaunchHref = getLessonLaunchHref({
                                lessonHref,
                                lessonChapters,
                                lessonStatus: status,
                                unlockedChapterSlugs,
                              });

                              if (lessonChapters.length > 0) {
                                return (
                                  <details
                                    key={item.lesson.id}
                                    open={status === "in_progress"}
                                    className="group/lesson overflow-hidden rounded-xl border"
                                    style={{
                                      borderColor: "var(--border)",
                                      borderLeft: status === "in_progress" ? "3px solid var(--primary)" : "3px solid transparent",
                                      backgroundColor:
                                        status === "in_progress"
                                          ? "var(--accent)"
                                          : status === "completed"
                                            ? "var(--status-success-surface)"
                                            : "var(--card)",
                                    }}
                                  >
                                    <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 p-3.5 outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] [&::-webkit-details-marker]:hidden">
                                      <span
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold"
                                        style={{
                                          color: status === "completed" ? "var(--status-success)" : status === "in_progress" ? "var(--primary-hover)" : item.unlocked ? centerColor : "var(--foreground-muted)",
                                          backgroundColor: "var(--card)",
                                        }}
                                      >
                                        {status === "completed" ? <CheckCircle2 size={17} aria-hidden="true" /> : String(lessonIndex + 1).padStart(2, "0")}
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <p className="font-bold">{lessonTitle}</p>
                                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] app-muted-text">
                                          <span>{getLessonTypeLabel(item.lesson.lesson_type)}</span>
                                          <span className="inline-flex items-center gap-1">
                                            <Clock3 size={11} aria-hidden="true" />
                                            {lessonChapters.length} 小时
                                          </span>
                                          <span>{completedChapterCount}/{lessonChapters.length} 章节完成</span>
                                          {curatedLesson && <span>{curatedLesson.focus}</span>}
                                        </p>
                                      </div>
                                      <span className="hidden text-[11px] font-bold app-muted-text sm:inline">展开目录</span>
                                      <ChevronDown size={16} className="shrink-0 transition-transform duration-200 group-open/lesson:rotate-180" aria-hidden="true" />
                                    </summary>

                                    <div className="border-t p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
                                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                                        <p className="text-xs font-bold app-muted-text">章节学习目录</p>
                                        <HangulLessonLaunchLink
                                          href={lessonLaunchHref}
                                          shouldEnterFullscreen={!isService && (item.lesson.slug === "hangul-introduction" || item.lesson.slug === "basic-pronunciation")}
                                          locked={!item.unlocked}
                                          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                                          style={{
                                            borderColor: !item.unlocked
                                              ? "var(--border)"
                                              : status === "completed"
                                                ? "var(--lesson-review-border)"
                                                : status === "in_progress"
                                                  ? "var(--lesson-continue-border)"
                                                  : "var(--lesson-start-border)",
                                            color: !item.unlocked
                                              ? "var(--foreground-muted)"
                                              : status === "completed"
                                                ? "var(--lesson-review-text)"
                                                : status === "in_progress"
                                                  ? "var(--lesson-continue-text)"
                                                  : "var(--lesson-start-text)",
                                            backgroundColor: !item.unlocked
                                              ? "var(--card)"
                                              : status === "completed"
                                                ? "var(--lesson-review-bg)"
                                                : status === "in_progress"
                                                  ? "var(--lesson-continue-bg)"
                                                  : "var(--lesson-start-bg)",
                                          }}
                                        >
                                          {!item.unlocked ? (
                                            <LockKeyhole size={13} aria-hidden="true" />
                                          ) : status === "completed" ? (
                                            <RotateCcw size={14} aria-hidden="true" />
                                          ) : (
                                            <PlayCircle size={14} aria-hidden="true" />
                                          )}
                                          {!item.unlocked ? "完成前置内容后进入" : status === "completed" ? "复习本课" : "进入本课"}
                                        </HangulLessonLaunchLink>
                                      </div>

                                      <ol className="grid gap-2 lg:grid-cols-2">
                                        {lessonChapters.map((chapter, chapterIndex) => {
                                          const chapterCompleted =
                                            status === "completed" || completedChapterSlugSet.has(chapter.slug);
                                          const chapterProgress = chapterCompleted
                                            ? 100
                                            : (chapterProgressBySlug.get(chapter.slug) ?? 0);
                                          // 历史学习事实优先于当前顺序规则：已经读过或通过测试的章节不能重新上锁。
                                          const chapterUnlocked =
                                            chapterCompleted ||
                                            chapterProgress > 0 ||
                                            (item.unlocked && unlockedChapterSlugs.has(chapter.slug));
                                          const chapterStatusLabel = chapterCompleted
                                            ? "已完成"
                                            : chapterProgress > 0
                                              ? `学习中 ${chapterProgress}%`
                                              : chapterUnlocked
                                                ? "可学习"
                                                : "待解锁";
                                          const chapterContent = (
                                            <>
                                              <span
                                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold"
                                                style={{ color: chapterCompleted ? "var(--status-success)" : chapterProgress > 0 || chapterUnlocked ? centerColor : "var(--foreground-muted)", backgroundColor: "var(--surface-soft)" }}
                                              >
                                                {chapterCompleted ? <CheckCircle2 size={15} aria-hidden="true" /> : getChapterSequenceLabel(lessonChapters, chapterIndex)}
                                              </span>
                                              <span className="min-w-0 flex-1 text-sm font-bold">{chapter.title}</span>
                                              <span className="shrink-0 text-[10px] font-bold app-muted-text">
                                                {chapterStatusLabel}
                                              </span>
                                              {chapterUnlocked ? (
                                                <LockOpen
                                                  size={16}
                                                  className={chapterCompleted ? "shrink-0 -scale-x-100 text-[var(--status-success)]" : "shrink-0 -scale-x-100 text-[var(--support)]"}
                                                  aria-label={chapterCompleted ? "已完成，已解锁" : "已解锁"}
                                                />
                                              ) : (
                                                <LockKeyhole
                                                  size={14}
                                                  className="text-[var(--foreground-muted)]"
                                                  aria-label="待解锁"
                                                />
                                              )}
                                            </>
                                          );

                                          return (
                                            <li key={chapter.id}>
                                              {chapterUnlocked ? (
                                                <HangulLessonLaunchLink
                                                  href={`${lessonHref}?chapter=${encodeURIComponent(chapter.slug)}`}
                                                  shouldEnterFullscreen={!isService && (item.lesson.slug === "hangul-introduction" || item.lesson.slug === "basic-pronunciation")}
                                                  locked={false}
                                                  className="flex min-h-11 items-center gap-3 rounded-lg border p-2.5 transition hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                                                  style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-soft)" }}
                                                >
                                                  {chapterContent}
                                                </HangulLessonLaunchLink>
                                              ) : (
                                                <div
                                                  className="flex min-h-11 items-center gap-3 rounded-lg border p-2.5 opacity-70"
                                                  style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-soft)" }}
                                                  aria-label={`${chapter.title}，${chapterStatusLabel}`}
                                                >
                                                  {chapterContent}
                                                </div>
                                              )}
                                            </li>
                                          );
                                        })}
                                      </ol>
                                    </div>
                                  </details>
                                );
                              }

                              return (
                                <div
                                  key={item.lesson.id}
                                  className="grid grid-cols-[36px_minmax(0,1fr)] items-center gap-x-3 gap-y-3 rounded-xl border p-3.5 sm:grid-cols-[36px_minmax(0,1fr)_auto]"
                                  style={{
                                    borderColor: "var(--border)",
                                    borderLeft: status === "in_progress" ? "3px solid var(--primary)" : "3px solid transparent",
                                    backgroundColor:
                                      status === "in_progress"
                                        ? "var(--accent)"
                                        : status === "completed"
                                          ? "var(--status-success-surface)"
                                          : "var(--card)",
                                  }}
                                >
                                  <span
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold"
                                    style={{
                                      color: status === "completed" ? "var(--status-success)" : status === "in_progress" ? "var(--primary-hover)" : item.unlocked ? centerColor : "var(--foreground-muted)",
                                      backgroundColor: "var(--card)",
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
                                    href={lessonLaunchHref}
                                    shouldEnterFullscreen={!isService && (item.lesson.slug === "hangul-introduction" || item.lesson.slug === "basic-pronunciation")}
                                    locked={!item.unlocked}
                                    className="col-span-2 inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition hover:opacity-90 sm:col-span-1"
                                    style={{ borderColor: "var(--border)", color: item.unlocked ? centerColor : "var(--foreground-muted)", backgroundColor: "var(--card)" }}
                                  >
                                    {item.unlocked ? <PlayCircle size={14} aria-hidden="true" /> : <LockKeyhole size={13} aria-hidden="true" />}
                                    {!item.unlocked ? "尚未解锁" : status === "completed" ? "复习" : status === "in_progress" ? "继续" : "开始"}
                                  </HangulLessonLaunchLink>
                                </div>
                              );
                            }) : (
                              <p className="rounded-xl border border-dashed p-4 text-center text-xs app-muted-text" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
                                {courseUnlocked ? "课程内容正在准备中" : "完成前置课程后自动开放"}
                              </p>
                            )}
                          </div>
                        </details>
                      );
                    }) : (
                      <p className="rounded-2xl border border-dashed p-5 text-center text-sm app-muted-text" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
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
                <p className="mt-1 text-3xl font-bold">{progressPercent}%</p>
              </div>
              <span className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ color: "var(--status-success)", backgroundColor: "var(--status-success-surface)" }}>
                {completedCount} 课时完成
              </span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--surface-soft)" }}>
              <div className="h-full rounded-full" style={{ width: `${progressPercent}%`, backgroundColor: "var(--status-success)" }} />
            </div>
          </section>

          <section
            className="app-card relative overflow-hidden rounded-[28px] border p-5 shadow-sm"
            style={{ borderColor: centerColor, background: `linear-gradient(145deg, ${centerSoft}, var(--card) 72%)` }}
          >
            <span className="absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-70" style={{ backgroundColor: centerSoft }} aria-hidden="true" />
            <div className="relative">
              <p className="flex items-center gap-2 text-xs font-bold" style={{ color: centerColor }}>
                <PlayCircle size={15} aria-hidden="true" />
                {nextActionLabel}
              </p>
              {recommendedLesson && recommendedTitle ? (
                <>
                  <CardTitleWithHint
                    className="mt-4"
                    headingLevel={3}
                    title={recommendedTitle}
                    description={recommendedContextLabel}
                    titleClassName="text-xl font-bold leading-snug"
                  />
                  <div className="mt-5 rounded-2xl border p-3.5" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
                    <div className="flex items-center justify-between gap-3 text-xs font-bold">
                      <span>{recommendedIsInProgress ? recommendedIsOverview ? "总览学习进度" : recommendedChapter ? "本章学习进度" : "本课学习进度" : recommendedDurationLabel}</span>
                      {recommendedIsInProgress && <span>{recommendedProgress}%</span>}
                    </div>
                    {recommendedIsInProgress && (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--surface-soft)" }}>
                        <div className="h-full rounded-full" style={{ width: `${recommendedProgress}%`, backgroundColor: centerColor }} />
                      </div>
                    )}
                  </div>
                  <HangulLessonLaunchLink
                    href={recommendedHref ?? "#"}
                    shouldEnterFullscreen={!isService && (recommendedLesson.lesson.slug === "hangul-introduction" || recommendedLesson.lesson.slug === "basic-pronunciation")}
                    locked={!recommendedHref}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold shadow-sm transition hover:opacity-90"
                    style={{ color: "var(--primary-foreground)", backgroundColor: "var(--primary-hover)" }}
                  >
                    <PlayCircle size={17} aria-hidden="true" />
                    {recommendedLabel}
                  </HangulLessonLaunchLink>
                </>
              ) : (
                <p className="mt-4 rounded-2xl p-4 text-sm font-bold app-muted-text" style={{ backgroundColor: "var(--card)" }}>暂无可进入的课时</p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
