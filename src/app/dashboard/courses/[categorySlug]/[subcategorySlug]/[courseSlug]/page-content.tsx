import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  Clock,
  GraduationCap,
  Languages,
  Lock,
  MessageCircleMore,
  PlayCircle,
  Sparkles,
} from "lucide-react";

import { requireActiveUser } from "@/lib/auth";
import { isPlatformCourseAuditorRole } from "@/lib/admin";
import {
  getCourseLevelLabel,
  getLessonTypeLabel,
} from "@/lib/course-labels";
import { getKoreanBeginnerLesson } from "@/lib/korean-curriculum";
import { isLessonUnlocked } from "@/lib/course-unlocks";
import { isCourseUnlocked } from "@/lib/course-unlocks";
import { HangulLessonLaunchLink } from "./HangulLessonLaunchLink";


type LessonProgressStatus = "not_started" | "in_progress" | "completed";

type CourseCategory = {
  id: string;
  parent_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  accent_color: string | null;
};

type Course = {
  id: string;
  category_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  icon_name: string | null;
  cover_url: string | null;
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

const progressStatusLabelMap: Record<LessonProgressStatus, string> = {
  not_started: "未完成",
  in_progress: "进行中",
  completed: "已完成",
};

const accentColorMap: Record<string, string> = {
  indigo: "#6366f1",
  blue: "#2563eb",
  emerald: "#16a34a",
  purple: "#9333ea",
  orange: "#f97316",
};

function resolveProgressStatus(
  status: string | null | undefined
): LessonProgressStatus {
  if (
    status === "not_started" ||
    status === "in_progress" ||
    status === "completed"
  ) {
    return status;
  }

  return "not_started";
}

function getStatusAccent(status: LessonProgressStatus) {
  if (status === "completed") {
    return "#16a34a";
  }

  if (status === "in_progress") {
    return "#2563eb";
  }

  return "var(--app-muted)";
}

function getLessonLockLabel(unlockMode: string | null) {
  if (unlockMode === "scheduled") return "尚未到开放时间";
  if (unlockMode === "previous_completed") return "完成上一单元后开放";
  if (unlockMode === "prerequisite_completed") return "完成前置单元后开放";
  if (unlockMode === "prerequisite_passed") return "通过前置章节后开放";
  return "当前单元暂未开放";
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{
    categorySlug: string;
    subcategorySlug: string;
    courseSlug: string;
  }>;
}) {
  const { categorySlug, subcategorySlug, courseSlug } = await params;

  const { supabase, user, profile, platformProfile } = await requireActiveUser();
  const isPlatformAudit = isPlatformCourseAuditorRole(platformProfile?.role);
  const bypassLearningSequence = isPlatformAudit || profile?.role !== "student";

  /**
   * 1. 查询一级课程板块
   */
  const { data: parentCategoryData } = await supabase
    .from("course_categories")
    .select("id, parent_id, slug, title, description, accent_color")
    .eq("slug", categorySlug)
    .is("parent_id", null)
    .eq("is_published", true)
    .maybeSingle();

  if (!parentCategoryData) {
    notFound();
  }

  const parentCategory = parentCategoryData as CourseCategory;

  /**
   * 2. 查询二级分类
   */
  const { data: subcategoryData } = await supabase
    .from("course_categories")
    .select("id, parent_id, slug, title, description, accent_color")
    .eq("slug", subcategorySlug)
    .eq("parent_id", parentCategory.id)
    .eq("is_published", true)
    .maybeSingle();

  if (!subcategoryData) {
    notFound();
  }

  const subcategory = subcategoryData as CourseCategory;

  /**
   * 3. 查询具体课程
   */
  const { data: courseData } = await supabase
    .from("courses")
    .select(
      "id, category_id, slug, title, description, level, icon_name, cover_url, unlock_mode, prerequisite_course_id, available_from, is_manually_locked"
    )
    .eq("slug", courseSlug)
    .eq("category_id", subcategory.id)
    .eq("is_published", true)
    .maybeSingle();

  if (!courseData) {
    notFound();
  }

  const course = courseData as Course;

  if (parentCategory.slug === "korean" || parentCategory.slug === "service") {
    redirect(`/dashboard/courses/${parentCategory.slug}#course-${course.slug}`);
  }

  if (!bypassLearningSequence) {
    const { data: orderedCourseData } = await supabase
      .from("courses")
      .select("id,unlock_mode,prerequisite_course_id,available_from,is_manually_locked")
      .eq("category_id", subcategory.id)
      .eq("is_published", true)
      .order("sort_order", { ascending: true });
    const orderedCourseRules = (orderedCourseData ?? []) as Array<{
      id: string;
      unlock_mode: string | null;
      prerequisite_course_id: string | null;
      available_from: string | null;
      is_manually_locked: boolean | null;
    }>;
    const currentCourseIndex = orderedCourseRules.findIndex((item) => item.id === course.id);
    const previousCourseId = currentCourseIndex > 0 ? orderedCourseRules[currentCourseIndex - 1]?.id : null;
    const completionCandidateIds = Array.from(
      new Set([course.prerequisite_course_id, previousCourseId].filter((id): id is string => Boolean(id))),
    );
    const completedCourseIds = new Set<string>();
    if (completionCandidateIds.length > 0) {
      const { data: prerequisiteLessonData } = await supabase
        .from("lessons")
        .select("id,course_id")
        .in("course_id", completionCandidateIds)
        .eq("is_published", true);
      const prerequisiteLessons = prerequisiteLessonData ?? [];
      const { data: prerequisiteProgressData } = prerequisiteLessons.length
        ? await supabase
            .from("lesson_progress")
            .select("lesson_id,status")
            .eq("user_id", user.id)
            .in("lesson_id", prerequisiteLessons.map((item) => item.id))
        : { data: [] };
      const completedLessonIds = new Set(
        (prerequisiteProgressData ?? [])
          .filter((item) => item.status === "completed")
          .map((item) => String(item.lesson_id)),
      );
      for (const candidateId of completionCandidateIds) {
        const candidateLessons = prerequisiteLessons.filter((item) => item.course_id === candidateId);
        if (candidateLessons.length > 0 && candidateLessons.every((item) => completedLessonIds.has(String(item.id)))) {
          completedCourseIds.add(candidateId);
        }
      }
    }
    const courseUnlocked = isCourseUnlocked({
      course,
      courseIndex: Math.max(0, currentCourseIndex),
      orderedCourses: orderedCourseRules,
      completedCourseIds,
    });
    if (!courseUnlocked) {
      redirect(`/dashboard/courses/${parentCategory.slug}/${subcategory.slug}`);
    }
  }

  /**
   * 4. 查询课程下的课时
   */
  const { data: lessonData } = await supabase
    .from("lessons")
    .select(
      "id, course_id, slug, title, description, lesson_type, duration_minutes, is_free_preview, sort_order, unlock_mode, prerequisite_lesson_id, prerequisite_chapter_id, available_from, is_manually_locked"
    )
    .eq("course_id", course.id)
    .eq("is_published", true)
    .order("sort_order", { ascending: true });

  const lessons = (lessonData ?? []) as Lesson[];

  /**
   * 5. 查询当前用户的课时学习进度
   */
  let progressList: LessonProgress[] = [];

  if (!isPlatformAudit && user && lessons.length > 0) {
    const lessonIds = lessons.map((lesson) => lesson.id);

    const { data: progressData } = await supabase
      .from("lesson_progress")
      .select("lesson_id, status, progress_percent")
      .eq("user_id", user.id)
      .in("lesson_id", lessonIds);

    progressList = (progressData ?? []).map((item) => ({
      lesson_id: item.lesson_id,
      status: resolveProgressStatus(item.status),
      progress_percent: item.progress_percent ?? 0,
    }));
  }

  const progressMap = new Map<string, LessonProgress>();

  progressList.forEach((progress) => {
    progressMap.set(progress.lesson_id, progress);
  });

  const totalLessons = lessons.length;

  const completedCount = lessons.filter((lesson) => {
    const progress = progressMap.get(lesson.id);

    return progress?.status === "completed";
  }).length;

  const courseProgressPercent =
    totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  const isFocusCategory =
    parentCategory.slug === "service" || parentCategory.slug === "korean";
  const isKoreanBeginner =
    parentCategory.slug === "korean" &&
    subcategory.slug === "korean-basic" &&
    course.slug === "korean-beginner";
  const completedLessonIds = new Set(
    progressList
      .filter((progress) => progress.status === "completed")
      .map((progress) => progress.lesson_id),
  );
  const prerequisiteChapterIds = Array.from(
    new Set(
      lessons
        .map((lesson) => lesson.prerequisite_chapter_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const prerequisiteChapterSlugById = new Map<string, string>();
  if (prerequisiteChapterIds.length > 0) {
    const { data: prerequisiteChapterData } = await supabase
      .from("course_chapters")
      .select("id,slug")
      .in("id", prerequisiteChapterIds);
    for (const chapter of prerequisiteChapterData ?? []) {
      prerequisiteChapterSlugById.set(String(chapter.id), String(chapter.slug));
    }
  }
  const passedChapterSlugs = new Set<string>();
  if (!isPlatformAudit && prerequisiteChapterIds.length > 0) {
    const { data: attemptData } = await supabase
      .from("chapter_test_attempts")
      .select("test_slug")
      .eq("student_id", user.id)
      .eq("passed", true);
    for (const attempt of attemptData ?? []) {
      passedChapterSlugs.add(String(attempt.test_slug));
    }
  }
  const accentColor = isFocusCategory
    ? parentCategory.slug === "service"
      ? "var(--app-accent)"
      : "var(--app-secondary)"
    : accentColorMap[subcategory.accent_color ?? "indigo"] ??
      accentColorMap.indigo;

  return (
    <>

      <div
        className={
          isFocusCategory
            ? "mx-auto w-full max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8"
            : "space-y-5 p-5"
        }
      >
        {/* 返回路径 */}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/dashboard/courses/${parentCategory.slug}/${subcategory.slug}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-900"
          >
            <ArrowLeft size={16} />
            返回{subcategory.title}
          </Link>

          <span className="text-sm text-gray-300">/</span>

          <Link
            href={`/dashboard/courses/${parentCategory.slug}`}
            className="text-sm font-medium text-gray-500 transition hover:text-gray-900"
          >
            {parentCategory.title}
          </Link>

          <span className="text-sm text-gray-300">/</span>

          <Link
            href="/dashboard/courses"
            className="text-sm font-medium text-gray-500 transition hover:text-gray-900"
          >
            我的课程
          </Link>
        </div>

        {/* 课程信息 + 课程进度 */}
        <section
          className="app-card rounded-3xl border p-5 shadow-sm"
          style={
            isFocusCategory
              ? {
                  background:
                    parentCategory.slug === "service"
                      ? "linear-gradient(125deg, var(--app-card-bg), var(--app-hero-start))"
                      : "linear-gradient(125deg, var(--app-card-bg), var(--app-hero-end))",
                }
              : undefined
          }
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-start">
            <div className="flex gap-4">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border"
                style={{
                  backgroundColor: "var(--app-soft-bg)",
                  borderColor: "var(--app-border)",
                  color: accentColor,
                }}
              >
                <GraduationCap size={32} />
              </div>

              <div>
                <div className="mb-3 flex flex-wrap gap-2">
                  <span
                    className="rounded-full border px-3 py-1 text-xs font-semibold"
                    style={{
                      backgroundColor: "var(--app-soft-bg)",
                      borderColor: "var(--app-border)",
                      color: accentColor,
                    }}
                  >
                    {subcategory.title}
                  </span>

                  {course.level && (
                    <span
                      className="rounded-full border px-3 py-1 text-xs font-medium"
                      style={{
                        backgroundColor: "var(--app-soft-bg)",
                        borderColor: "var(--app-border)",
                        color: "var(--app-text-soft)",
                      }}
                    >
                      {getCourseLevelLabel(course.level)}
                    </span>
                  )}

                  <span
                    className="rounded-full border px-3 py-1 text-xs font-medium"
                    style={{
                      backgroundColor: "var(--app-soft-bg)",
                      borderColor: "var(--app-border)",
                      color: "var(--app-text-soft)",
                    }}
                  >
                    共 {totalLessons} 个课时
                  </span>
                </div>

                <h2 className="text-2xl font-black tracking-tight text-gray-900">
                  {course.title}
                </h2>

                <p className="mt-2 text-sm leading-6 text-gray-500">
                  {course.description || "暂无课程简介"}
                </p>
              </div>
            </div>

            <div className="lg:border-l lg:pl-6" style={{ borderColor: "var(--app-border)" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-gray-900">课程进度</p>

                  <p className="mt-1 text-xs text-gray-500">
                    已完成 {completedCount} / {totalLessons} 个课时
                  </p>
                </div>

                <p className="text-2xl font-black tracking-tight text-gray-900">
                  {courseProgressPercent}%
                </p>
              </div>

              <div
                className="mt-4 h-2 overflow-hidden rounded-full"
                style={{ backgroundColor: "var(--app-soft-bg)" }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${courseProgressPercent}%`,
                    backgroundColor: "var(--app-success)",
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* 课时列表 */}
        {isKoreanBeginner && (
          <section className="overflow-hidden rounded-3xl border border-[#dce9e7] bg-[linear-gradient(135deg,#f7fffd_0%,#f8fbff_55%,#fffaf2_100%)] p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-black text-[#21867a] shadow-sm ring-1 ring-[#d8ebe7]">
                  <Sparkles size={14} />
                  零基础三段式学习路径
                </div>
                <h3 className="mt-4 text-2xl font-black tracking-tight text-[#173f4a]">
                  从认识韩文，到完成韩国语 2 级
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#617982]">
                  先建立字母与拼读能力，再进入词汇、句型和生活场景表达。三课依次推进，形成完整的韩语初级学习闭环。
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-black text-[#53727a]">
                <div className="rounded-2xl bg-white/75 px-3 py-3 ring-1 ring-[#dfebe9]"><Languages className="mx-auto mb-1.5 text-[#2a9485]" size={18} />字母</div>
                <div className="rounded-2xl bg-white/75 px-3 py-3 ring-1 ring-[#dfebe9]"><MessageCircleMore className="mx-auto mb-1.5 text-[#5f8ee8]" size={18} />表达</div>
                <div className="rounded-2xl bg-white/75 px-3 py-3 ring-1 ring-[#dfebe9]"><GraduationCap className="mx-auto mb-1.5 text-[#d29345]" size={18} />进阶</div>
              </div>
            </div>
          </section>
        )}

        <section className="app-card rounded-3xl border p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h3 className="text-lg font-black tracking-tight text-gray-900">
              课时列表
            </h3>

            <BookOpenCheck className="text-gray-300" size={28} />
          </div>

          {lessons.length > 0 ? (
            <div className="space-y-4">
              {lessons.map((lesson, index) => {
                const progress = progressMap.get(lesson.id);
                const curatedLesson = isKoreanBeginner
                  ? getKoreanBeginnerLesson(lesson.slug)
                  : null;
                const lessonLocked =
                  !isPlatformAudit &&
                  !isLessonUnlocked({
                    lesson,
                    lessonIndex: index,
                    orderedLessons: lessons,
                    completedLessonIds,
                    prerequisiteChapterSlugById,
                    passedChapterSlugs,
                  });

                const status = progress?.status ?? "not_started";
                const progressPercent = progress?.progress_percent ?? 0;

                const statusLabel = progressStatusLabelMap[status];
                const lessonTypeLabel = getLessonTypeLabel(lesson.lesson_type);

                const isCompleted = status === "completed";
                const isInProgress = status === "in_progress";
                const statusAccent = getStatusAccent(status);

                return (
                  <div
                    key={lesson.id}
                    className="app-card rounded-2xl border p-4 shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex gap-4">
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-sm font-black"
                          style={{
                            backgroundColor: "var(--app-soft-bg)",
                            borderColor: "var(--app-border)",
                            color: statusAccent,
                          }}
                        >
                          {isCompleted ? (
                            <CheckCircle2 size={21} />
                          ) : (
                            String(index + 1).padStart(2, "0")
                          )}
                        </div>

                        <div>
                          <div className="mb-2 flex flex-wrap gap-2">
                            {curatedLesson && (
                              <span className="rounded-full bg-[#e8f6f2] px-3 py-1 text-xs font-black text-[#238777]">
                                {curatedLesson.stage}
                              </span>
                            )}
                            <span
                              className="rounded-full border px-3 py-1 text-xs font-medium"
                              style={{
                                backgroundColor: "var(--app-soft-bg)",
                                borderColor: "var(--app-border)",
                                color: "var(--app-text-soft)",
                              }}
                            >
                              {lessonTypeLabel}
                            </span>

                            <span
                              className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium"
                              style={{
                                backgroundColor: "var(--app-soft-bg)",
                                borderColor: "var(--app-border)",
                                color: "var(--app-text-soft)",
                              }}
                            >
                              <Clock size={13} />
                              {lesson.duration_minutes} 分钟
                            </span>

                            {lesson.is_free_preview && (
                              <span
                                className="rounded-full border px-3 py-1 text-xs font-semibold"
                                style={{
                                  backgroundColor: "var(--app-soft-bg)",
                                  borderColor: "var(--app-border)",
                                  color: "#16a34a",
                                }}
                              >
                                可试看
                              </span>
                            )}

                            <span
                              className="rounded-full border px-3 py-1 text-xs font-semibold"
                              style={{
                                backgroundColor: "var(--app-soft-bg)",
                                borderColor: "var(--app-border)",
                                color: statusAccent,
                              }}
                            >
                              {statusLabel}
                            </span>
                          </div>

                          <h4 className="font-bold text-gray-900">
                            {curatedLesson?.title ?? lesson.title}
                          </h4>

                          <p className="mt-1 text-sm leading-6 text-gray-500">
                            {(curatedLesson?.description ?? lesson.description) || "暂无课时简介"}
                          </p>
                          {curatedLesson && (
                            <p className="mt-2 text-xs font-bold tracking-wide text-[#789097]">
                              学习重点：{curatedLesson.focus}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="w-full shrink-0 lg:w-56">
                        <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                          <span>学习进度</span>
                          <span>{progressPercent}%</span>
                        </div>

                        <div
                          className="h-2 overflow-hidden rounded-full"
                          style={{ backgroundColor: "var(--app-soft-bg)" }}
                        >
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${progressPercent}%`,
                              backgroundColor: isCompleted
                                ? "#16a34a"
                                : "var(--app-accent)",
                            }}
                          />
                        </div>

                        <HangulLessonLaunchLink
                          href={`/dashboard/courses/${parentCategory.slug}/${subcategory.slug}/${course.slug}/${lesson.slug}`}
                          shouldEnterFullscreen={lesson.slug === "hangul-introduction" || lesson.slug === "basic-pronunciation"}
                          locked={lessonLocked}
                          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:opacity-90"
                          style={{
                            backgroundColor: isCompleted
                              ? "var(--lesson-review-bg)"
                              : isInProgress
                                ? "var(--lesson-continue-bg)"
                                : "var(--lesson-start-bg)",
                            color: isCompleted
                              ? "var(--lesson-review-text)"
                              : isInProgress
                                ? "var(--lesson-continue-text)"
                                : "var(--lesson-start-text)",
                            borderColor: isCompleted
                              ? "var(--lesson-review-border)"
                              : isInProgress
                                ? "var(--lesson-continue-border)"
                                : "var(--lesson-start-border)",
                          }}
                        >
                          {lessonLocked ? (
                            <Lock size={15} />
                          ) : (
                            <PlayCircle size={15} />
                          )}
                          {lessonLocked
                            ? getLessonLockLabel(lesson.unlock_mode)
                            : isCompleted
                            ? "复习课时"
                            : isInProgress
                              ? "继续学习"
                              : "开始学习"}
                        </HangulLessonLaunchLink>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="app-empty-state rounded-2xl p-6 text-center">
              <p className="font-semibold text-gray-900">暂无课时</p>
              <p className="mt-2 text-sm text-gray-500">
                当前课程还没有发布课时。
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
