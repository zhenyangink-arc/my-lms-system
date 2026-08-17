import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BookmarkCheck,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  GitCompareArrows,
  Headphones,
  Layers3,
  ListTree,
  LockKeyhole,
  Trash2,
  XCircle,
} from "lucide-react";

import { isPlatformTenantManagerRole } from "@/lib/admin";
import { requireActiveUser } from "@/lib/auth";
import { getUnlockedKoreanTestSlugs } from "@/lib/korean-learning-unlocks";
import { parseQuestionOptions } from "@/lib/korean-chapter-tests";
import { withStudentAppSchemaFallback } from "@/lib/student-app-data";
import { getStudentAppPath, STUDENT_APP_IDS } from "@/lib/student-apps";
import { createAdminClient } from "@/lib/supabase/admin";
import { removeCourseQuestionReviewAction } from "./actions";
import { KnowledgeResearchWorkbench } from "./KnowledgeResearchWorkbench";

type ReviewRow = {
  question_id: string;
  test_id: string;
  created_at: string;
};

type ReviewQuestionRow = {
  id: string;
  test_id: string;
  question_key: string;
  prompt: string;
  options: unknown;
};

type ReviewTestRow = {
  id: string;
  slug: string;
  course_key: string;
  chapter_number: number;
  title: string;
  korean_title: string;
};

type ReviewItem = {
  questionId: string;
  addedAt: string;
  question: ReviewQuestionRow;
  test: ReviewTestRow;
};

type KnowledgeChapterRow = ReviewTestRow & {
  lesson_id: string;
  description: string;
};

type EbookProgressRow = {
  test_slug: string;
  progress_percent: number;
};

type TestAttemptRow = {
  test_id: string | null;
  test_slug: string;
  score: number;
  passed: boolean;
};

type LearningCourse = {
  key: string;
  eyebrow: string;
  title: string;
  chapters: KnowledgeChapterRow[];
};

const reviewDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function courseLabel(courseKey: string) {
  return courseKey === "korean-level-one" ? "韩国语1级" : "韩语字母入门";
}

export type LearningArea = "knowledge" | "listening" | "review";

function ChapterDirectory({
  area,
  course,
  unlockedChapterSlugs,
  ebookProgressBySlug,
  attemptByTestSlug,
  selectedChapterSlug,
  reviewCountByTestSlug,
  chapterBaseHref,
  defaultOpen = false,
}: {
  area: "knowledge" | "listening";
  course: LearningCourse;
  unlockedChapterSlugs: Set<string>;
  ebookProgressBySlug: Map<string, number>;
  attemptByTestSlug: Map<string, TestAttemptRow>;
  selectedChapterSlug?: string;
  reviewCountByTestSlug?: Map<string, number>;
  chapterBaseHref?: string;
  defaultOpen?: boolean;
}) {
  const color =
    area === "knowledge" ? "var(--primary)" : "var(--support)";
  const soft =
    area === "knowledge"
      ? "var(--accent)"
      : "var(--support-surface)";
  const passedCount = course.chapters.filter(
    (chapter) => attemptByTestSlug.get(chapter.slug)?.passed === true,
  ).length;
  const courseProgressPercent = course.chapters.length > 0
    ? Math.round(
        course.chapters.reduce((total, chapter) => {
          const passed = attemptByTestSlug.get(chapter.slug)?.passed === true;
          return total + (passed ? 100 : ebookProgressBySlug.get(chapter.slug) ?? 0);
        }, 0) / course.chapters.length,
      )
    : 0;

  return (
    <details
      className="app-card group overflow-hidden rounded-3xl border"
      style={{ borderColor: "var(--border)" }}
      open={defaultOpen}
    >
      <summary
        className="flex cursor-pointer list-none items-center gap-3 p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary)] sm:p-5 [&::-webkit-details-marker]:hidden"
        style={{ backgroundColor: "var(--surface-soft)" }}
      >
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{ color, backgroundColor: soft }}
        >
          {area === "knowledge" ? (
            <Layers3 size={19} aria-hidden="true" />
          ) : (
            <Headphones size={19} aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-[9px] font-bold tracking-[0.14em]"
            style={{ color }}
          >
            {course.eyebrow}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-base font-bold sm:text-lg">{course.title}</h2>
            <span className="text-[10px] font-bold app-muted-text">
              {passedCount}/{course.chapters.length} 章通过
            </span>
            <div className="h-1.5 w-16 overflow-hidden rounded-full sm:w-20" style={{ backgroundColor: "var(--surface-soft)" }}>
              <div className="h-full rounded-full" style={{ width: `${courseProgressPercent}%`, backgroundColor: color }} />
            </div>
            <span className="text-[10px] font-bold" style={{ color }}>
              深化进度 {courseProgressPercent}%
            </span>
          </div>
        </div>
        <ChevronDown className="shrink-0 transition-transform group-open:rotate-180" size={16} aria-hidden="true" />
      </summary>

      <div className="space-y-2 border-t p-3 sm:p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-soft)" }}>
        {course.chapters.map((chapter) => {
          const isUnlocked = unlockedChapterSlugs.has(chapter.slug);
          const isSelected = selectedChapterSlug === chapter.slug;
          const progress = ebookProgressBySlug.get(chapter.slug) ?? 0;
          const attempt = isUnlocked
            ? attemptByTestSlug.get(chapter.slug)
            : undefined;
          const passed = attempt?.passed === true;
          const failed = Boolean(attempt) && !passed;
          const reviewCount = reviewCountByTestSlug?.get(chapter.slug) ?? 0;
          const statusColor = passed
            ? "var(--status-success)"
            : failed
              ? "var(--status-warning)"
              : "var(--foreground-muted)";
          const statusBorder = passed
            ? "var(--status-success)"
            : failed
              ? "var(--status-warning)"
              : "var(--border-subtle)";
          const statusLabel = !isUnlocked
            ? "完成上一章测试后开放"
            : attempt
              ? `${attempt.score} 分 · ${passed ? "已通过" : "未通过"}`
              : progress > 0
                ? `电子书 ${progress}% · 未测试`
                : "尚未开始";
          const content = (
            <>
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold"
                style={{ color: isUnlocked ? statusColor : "var(--foreground-muted)", backgroundColor: isUnlocked ? "var(--card)" : "var(--surface-soft)" }}
              >
                {!isUnlocked ? <LockKeyhole size={15} aria-hidden="true" /> : passed ? <CheckCircle2 size={16} aria-hidden="true" /> : failed ? <XCircle size={16} aria-hidden="true" /> : String(chapter.chapter_number).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold">{chapter.title}</h3>
                  {chapter.korean_title && <span className="text-[10px] app-muted-text">{chapter.korean_title}</span>}
                  {reviewCount > 0 && (
                    <span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ color: "var(--status-success)", backgroundColor: "var(--status-success-surface)" }}>
                      {reviewCount} 题待复习
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[10px] font-bold app-muted-text">
                  CHAPTER {String(chapter.chapter_number).padStart(2, "0")} · {statusLabel}
                </p>
              </div>
              <span
                className="col-span-2 inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border px-3 py-2 text-[10px] font-bold sm:col-span-1"
                style={{ color: isUnlocked ? color : "var(--foreground-muted)", borderColor: "var(--border)", backgroundColor: "var(--card)" }}
              >
                {isUnlocked ? (progress > 0 || attempt ? "继续" : "开始") : "未开放"}
                {isUnlocked && <ArrowRight size={11} aria-hidden="true" />}
              </span>
            </>
          );

          return isUnlocked ? (
            <Link
              key={chapter.id}
              href={
                chapterBaseHref
                  ? `${chapterBaseHref}/${encodeURIComponent(course.key)}/${encodeURIComponent(chapter.slug)}`
                  : `?area=${area}&course=${encodeURIComponent(course.key)}&chapter=${encodeURIComponent(chapter.slug)}`
              }
              className="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-2xl border p-3 transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 sm:grid-cols-[40px_minmax(0,1fr)_auto]"
              style={{
                borderColor: isSelected ? color : statusBorder,
                background: passed
                  ? "linear-gradient(135deg, var(--card), var(--status-success-surface))"
                  : failed
                    ? "linear-gradient(135deg, var(--card), var(--status-warning-surface))"
                    : "var(--card)",
                boxShadow: isSelected
                  ? `0 0 0 3px ${soft}`
                  : undefined,
                outlineColor: color,
              }}
            >
              {content}
            </Link>
          ) : (
            <article
              key={chapter.id}
              className="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-2xl border p-3 opacity-60 sm:grid-cols-[40px_minmax(0,1fr)_auto]"
              style={{
                borderColor: statusBorder,
                backgroundColor: "var(--surface-soft)",
              }}
            >
              {content}
            </article>
          );
        })}
      </div>
    </details>
  );
}

export async function DeepLearningPage({
  searchParams,
  forcedArea,
  knowledgeChapterBaseHref,
  knowledgeLessonOnly = false,
}: {
  searchParams: Promise<{ area?: string; course?: string; chapter?: string }>;
  forcedArea?: LearningArea;
  knowledgeChapterBaseHref?: string;
  knowledgeLessonOnly?: boolean;
}) {
  const params = await searchParams;
  const activeArea: LearningArea = forcedArea ?? (
    params.area === "knowledge" ||
    params.area === "listening" ||
    params.area === "review"
      ? params.area
      : "knowledge"
  );
  const { supabase, user, tenant, profile, platformProfile } = await requireActiveUser();
  const reviewAreaHref = tenant?.slug
    ? getStudentAppPath(tenant.slug, "korean", "practice/review")
    : "?area=review";
  const assignmentsBaseHref = tenant?.slug
    ? getStudentAppPath(tenant.slug, "korean", "assignments/korean")
    : "/dashboard/assignments/korean";
  const needsCourseData = activeArea !== "review";
  const { data: reviewData, error: reviewError } = await supabase
    .from("chapter_test_question_reviews")
    .select("question_id,test_id,created_at")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });
  const reviews = (reviewData ?? []) as ReviewRow[];
  const questionIds = [...new Set(reviews.map((review) => review.question_id))];
  const testIds = [...new Set(reviews.map((review) => review.test_id))];
  const admin = createAdminClient();
  const [
    { data: questionData, error: questionError },
    { data: testData, error: testError },
    { data: knowledgeChapterData, error: knowledgeChapterError },
    { data: attemptData, error: attemptError },
    { data: ebookProgressData, error: ebookProgressError },
  ] = await Promise.all([
    questionIds.length
      ? admin
          .from("chapter_test_questions")
          .select("id,test_id,question_key,prompt,options")
          .in("id", questionIds)
      : Promise.resolve({ data: [], error: null }),
    testIds.length
      ? withStudentAppSchemaFallback(
          admin
            .from("chapter_tests")
            .select("id,slug,course_key,chapter_number,title,korean_title")
            .eq("student_app_id", STUDENT_APP_IDS.korean)
            .in("id", testIds),
          () =>
            admin
              .from("chapter_tests")
              .select("id,slug,course_key,chapter_number,title,korean_title")
              .in("id", testIds),
        )
      : Promise.resolve({ data: [], error: null }),
    needsCourseData
      ? withStudentAppSchemaFallback(
          admin
            .from("chapter_tests")
            .select("id,lesson_id,slug,course_key,chapter_number,title,korean_title,description")
            .eq("student_app_id", STUDENT_APP_IDS.korean)
            .in("course_key", ["hangul-introduction", "korean-level-one"])
            .eq("status", "published")
            .order("chapter_number", { ascending: true }),
          () =>
            admin
              .from("chapter_tests")
              .select("id,lesson_id,slug,course_key,chapter_number,title,korean_title,description")
              .in("course_key", ["hangul-introduction", "korean-level-one"])
              .eq("status", "published")
              .order("chapter_number", { ascending: true }),
        )
      : Promise.resolve({ data: [], error: null }),
    needsCourseData
      ? supabase
          .from("chapter_test_attempts")
          .select("test_id,test_slug,score,passed")
          .eq("student_id", user.id)
      : Promise.resolve({ data: [], error: null }),
    needsCourseData
      ? withStudentAppSchemaFallback(
          supabase
            .from("course_ebook_progress")
            .select("test_slug,progress_percent")
            .eq("student_id", user.id)
            .eq("student_app_id", STUDENT_APP_IDS.korean),
          () =>
            supabase
              .from("course_ebook_progress")
              .select("test_slug,progress_percent")
              .eq("student_id", user.id),
        )
      : Promise.resolve({ data: [], error: null }),
  ]);
  const courseDataError = Boolean(
    knowledgeChapterError || attemptError || ebookProgressError,
  );
  const reviewDataError = Boolean(reviewError || questionError || testError);
  const questionById = new Map(
    ((questionData ?? []) as ReviewQuestionRow[]).map((question) => [
      question.id,
      question,
    ])
  );
  const testById = new Map(
    ((testData ?? []) as ReviewTestRow[]).map((test) => [test.id, test])
  );
  const reviewItems = reviews
    .map((review): ReviewItem | null => {
      const question = questionById.get(review.question_id);
      const test = testById.get(review.test_id);
      if (!question || !test) return null;
      return {
        questionId: review.question_id,
        addedAt: review.created_at,
        question,
        test,
      };
    })
    .filter((item): item is ReviewItem => item !== null);
  const reviewCountByTestSlug = new Map<string, number>();
  for (const item of reviewItems) {
    reviewCountByTestSlug.set(
      item.test.slug,
      (reviewCountByTestSlug.get(item.test.slug) ?? 0) + 1,
    );
  }
  const knowledgeChapters =
    (knowledgeChapterData ?? []) as KnowledgeChapterRow[];
  const knowledgeTestIds = new Set(
    knowledgeChapters.map((chapter) => chapter.id),
  );
  const knowledgeTestSlugs = new Set(
    knowledgeChapters.map((chapter) => chapter.slug),
  );
  const koreanAttempts = ((attemptData ?? []) as TestAttemptRow[]).filter(
    (attempt) =>
      attempt.test_id
        ? knowledgeTestIds.has(attempt.test_id)
        : knowledgeTestSlugs.has(attempt.test_slug),
  );
  const knowledgeCourses: LearningCourse[] = [
    {
      key: "hangul-introduction",
      eyebrow: "字母启蒙",
      title: "韩语字母入门",
      chapters: knowledgeChapters.filter(
        (chapter) => chapter.course_key === "hangul-introduction"
      ),
    },
    {
      key: "korean-level-one",
      eyebrow: "基础表达",
      title: "韩国语1级",
      chapters: knowledgeChapters.filter(
        (chapter) => chapter.course_key === "korean-level-one"
      ),
    },
  ];
  const unlockedChapterSlugs = getUnlockedKoreanTestSlugs(
    koreanAttempts.map((attempt) => attempt.test_slug),
  );
  const attemptByTestSlug = new Map(
    koreanAttempts.map((attempt) => [
      attempt.test_slug,
      attempt,
    ])
  );
  if (isPlatformTenantManagerRole(platformProfile?.role ?? profile?.role)) {
    for (const chapter of knowledgeChapters) {
      unlockedChapterSlugs.add(chapter.slug);
    }
  }
  const ebookProgressBySlug = new Map(
    ((ebookProgressData ?? []) as EbookProgressRow[]).map((progress) => [
      progress.test_slug,
      progress.progress_percent,
    ])
  );
  const selectedCourseKey = knowledgeCourses.some(
    (course) => course.key === params.course
  )
    ? params.course ?? null
    : null;
  const selectedCourse =
    knowledgeCourses.find((course) => course.key === selectedCourseKey) ??
    null;
  const requestedKnowledgeChapter =
    activeArea === "knowledge" && selectedCourse && params.chapter
      ? selectedCourse.chapters.find(
          (chapter) => chapter.slug === params.chapter,
        ) ?? null
      : null;
  const selectedKnowledgeChapter =
    requestedKnowledgeChapter &&
    unlockedChapterSlugs.has(requestedKnowledgeChapter.slug)
      ? requestedKnowledgeChapter
      : null;
  const requestedListeningChapter =
    activeArea === "listening" && selectedCourse && params.chapter
      ? selectedCourse.chapters.find(
          (chapter) => chapter.slug === params.chapter,
        ) ?? null
      : null;
  const selectedListeningChapter =
    requestedListeningChapter &&
    unlockedChapterSlugs.has(requestedListeningChapter.slug)
      ? requestedListeningChapter
      : null;
  const unlockedChapters = knowledgeChapters.filter((chapter) =>
    unlockedChapterSlugs.has(chapter.slug),
  );
  const passedChapterCount = knowledgeChapters.filter(
    (chapter) => attemptByTestSlug.get(chapter.slug)?.passed === true,
  ).length;
  const knowledgeProgressPercent = knowledgeChapters.length > 0
    ? Math.round((passedChapterCount / knowledgeChapters.length) * 100)
    : 0;
  const recommendedChapter =
    unlockedChapters.find(
      (chapter) =>
        (ebookProgressBySlug.get(chapter.slug) ?? 0) > 0 &&
        attemptByTestSlug.get(chapter.slug)?.passed !== true,
    ) ??
    unlockedChapters.find(
      (chapter) => attemptByTestSlug.get(chapter.slug)?.passed !== true,
    ) ??
    unlockedChapters[0];
  const recommendedCourse = recommendedChapter
    ? knowledgeCourses.find((course) => course.key === recommendedChapter.course_key) ?? null
    : null;
  const recommendedReadingProgress = recommendedChapter
    ? ebookProgressBySlug.get(recommendedChapter.slug) ?? 0
    : 0;
  const recommendedAttempt = recommendedChapter
    ? attemptByTestSlug.get(recommendedChapter.slug)
    : undefined;
  const recommendedHref = recommendedChapter && recommendedCourse
    ? knowledgeChapterBaseHref
      ? `${knowledgeChapterBaseHref}/${encodeURIComponent(recommendedCourse.key)}/${encodeURIComponent(recommendedChapter.slug)}`
      : `?area=knowledge&course=${encodeURIComponent(recommendedCourse.key)}&chapter=${encodeURIComponent(recommendedChapter.slug)}`
    : "?area=knowledge";

  if (knowledgeLessonOnly) {
    if (courseDataError) {
      return (
        <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
          <section role="alert" className="app-card rounded-3xl border p-8 text-center">
            <XCircle className="mx-auto" size={32} aria-hidden="true" />
            <h2 className="mt-3 text-lg font-bold">章节暂时无法读取</h2>
            <p className="app-muted-text mt-2 text-sm leading-6">
              学习数据加载失败，请稍后刷新页面；你也可以先返回课程巩固目录。
            </p>
            <Link
              href={knowledgeChapterBaseHref ?? "?area=knowledge"}
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-bold focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
              style={{ borderColor: "var(--border)", outlineColor: "var(--primary)" }}
            >
              返回课程巩固目录
            </Link>
          </section>
        </div>
      );
    }
    if (requestedKnowledgeChapter && !selectedKnowledgeChapter) {
      return (
        <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
          <section className="app-card rounded-3xl border p-8 text-center">
            <LockKeyhole className="mx-auto" size={32} aria-hidden="true" />
            <h2 className="mt-3 text-lg font-bold">本章尚未开放</h2>
            <p className="app-muted-text mt-2 text-sm leading-6">
              请先完成上一章测试，再返回这里继续精研。
            </p>
            <Link
              href={knowledgeChapterBaseHref ?? "?area=knowledge"}
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-bold focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
              style={{ borderColor: "var(--border)", outlineColor: "var(--primary)" }}
            >
              返回课程巩固目录
            </Link>
          </section>
        </div>
      );
    }
    if (!selectedKnowledgeChapter || !selectedCourse || !knowledgeChapterBaseHref) {
      notFound();
    }

    return (
      <div className="mx-auto w-full max-w-[1440px] overflow-x-clip px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <KnowledgeResearchWorkbench
          chapterSlug={selectedKnowledgeChapter.slug}
          courseTitle={selectedCourse.title}
          courseEyebrow={selectedCourse.eyebrow}
          chapterNumber={selectedKnowledgeChapter.chapter_number}
          chapterTitle={selectedKnowledgeChapter.title}
          chapterKoreanTitle={selectedKnowledgeChapter.korean_title}
          chapterDescription={selectedKnowledgeChapter.description}
          backHref={`${knowledgeChapterBaseHref}?course=${encodeURIComponent(selectedCourse.key)}`}
          ebookHref={`${
            tenant?.slug
              ? getStudentAppPath(
                  tenant.slug,
                  "korean",
                  "courses/korean/korean-basic/korean-beginner/hangul-introduction"
                )
              : "/dashboard/courses/korean/korean-basic/korean-beginner/hangul-introduction"
          }?chapter=${encodeURIComponent(selectedKnowledgeChapter.slug)}`}
          chapterTestHref={`${assignmentsBaseHref}/${encodeURIComponent(selectedKnowledgeChapter.slug)}`}
        />
      </div>
    );
  }

  if (needsCourseData && courseDataError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <section role="alert" className="app-card rounded-3xl border p-8 text-center">
          <XCircle className="mx-auto" size={32} aria-hidden="true" />
          <h2 className="mt-3 text-lg font-bold">巩固内容暂时无法读取</h2>
          <p className="app-muted-text mt-2 text-sm leading-6">
            课程与进度数据加载失败，请稍后刷新页面再试。
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] overflow-x-clip px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      {!forcedArea && <nav className="app-card mt-4 grid grid-cols-3 gap-1 rounded-2xl border p-1.5" aria-label="深化学习功能">
        <Link
          href="?area=knowledge"
          aria-current={activeArea === "knowledge" ? "page" : undefined}
          className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[10px] font-bold transition focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 sm:text-xs"
          style={activeArea === "knowledge" ? { color: "var(--primary-hover)", backgroundColor: "color-mix(in srgb, var(--primary) 28%, transparent)" } : { color: "var(--foreground-muted)" }}
        >
          <Layers3 size={14} className="shrink-0" aria-hidden="true" />
          <span className="truncate">知识精研</span>
        </Link>
        <Link
          href="?area=listening"
          aria-current={activeArea === "listening" ? "page" : undefined}
          className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[10px] font-bold transition focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 sm:text-xs"
          style={activeArea === "listening" ? { color: "var(--support)", backgroundColor: "color-mix(in srgb, var(--support) 28%, transparent)" } : { color: "var(--foreground-muted)" }}
        >
          <Headphones size={14} className="shrink-0" aria-hidden="true" />
          <span className="truncate">听音训练</span>
          <span className="hidden rounded-full px-1.5 py-0.5 text-[8px] sm:inline" style={{ backgroundColor: "var(--card)" }}>逐步开放</span>
        </Link>
        <Link
          href="?area=review"
          aria-current={activeArea === "review" ? "page" : undefined}
          className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[10px] font-bold transition focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 sm:text-xs"
          style={activeArea === "review" ? { color: "var(--status-success)", backgroundColor: "color-mix(in srgb, var(--status-success) 28%, transparent)" } : { color: "var(--foreground-muted)" }}
        >
          <BookmarkCheck size={14} className="shrink-0" aria-hidden="true" />
          <span className="truncate">待复习题</span>
          <span className="rounded-full px-1.5 py-0.5 text-[8px]" style={{ backgroundColor: "var(--card)" }}>{reviewItems.length}</span>
        </Link>
      </nav>}

      {activeArea === "knowledge" && !selectedKnowledgeChapter && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="app-card rounded-[28px] border p-4 sm:p-5" aria-labelledby="knowledge-route-title">
            <div
              className="mb-4 flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5"
              style={{ backgroundColor: "color-mix(in srgb, var(--status-warning-surface) 70%, transparent)" }}
            >
              <div>
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ color: "var(--support)", backgroundColor: "var(--support-surface)" }}
                  >
                    <ListTree size={18} aria-hidden="true" />
                  </span>
                  <h2 id="knowledge-route-title" className="text-lg font-bold sm:text-xl">课程与章节路线</h2>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="app-card rounded-xl border px-3 py-2 text-center w-[88px]">
                  <p className="text-base font-bold">{knowledgeProgressPercent}%</p>
                  <p className="text-[10px] font-bold app-muted-text whitespace-nowrap">知识精研总进度</p>
                </div>
                <div className="app-card rounded-xl border px-3 py-2 text-center w-[88px]">
                  <p className="text-base font-bold">{unlockedChapters.length}</p>
                  <p className="text-[10px] font-bold app-muted-text whitespace-nowrap">已开放章节</p>
                </div>
                <div className="app-card rounded-xl border px-3 py-2 text-center w-[88px]">
                  <p className="text-base font-bold">{knowledgeChapters.length}</p>
                  <p className="text-[10px] font-bold app-muted-text whitespace-nowrap">总章节</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {knowledgeChapters.length === 0 ? (
                <div className="app-soft-card rounded-2xl border border-dashed p-8 text-center">
                  <BookOpenCheck className="mx-auto opacity-40" size={28} aria-hidden="true" />
                  <p className="mt-3 text-sm font-bold">暂无可练习章节</p>
                  <p className="app-muted-text mt-2 text-xs leading-5">
                    课程章节发布后会显示在这里。
                  </p>
                </div>
              ) : knowledgeCourses.map((course) => (
                <ChapterDirectory
                  key={course.key}
                  area="knowledge"
                  course={course}
                  unlockedChapterSlugs={unlockedChapterSlugs}
                  ebookProgressBySlug={ebookProgressBySlug}
                  attemptByTestSlug={attemptByTestSlug}
                  selectedChapterSlug={params.chapter}
                  reviewCountByTestSlug={reviewCountByTestSlug}
                  chapterBaseHref={knowledgeChapterBaseHref}
                  defaultOpen={false}
                />
              ))}
            </div>
          </section>

          <aside className="order-first space-y-4 lg:order-last lg:sticky lg:top-24" aria-label="深化学习建议">
            <section className="app-card relative overflow-hidden rounded-[28px] border p-5" style={{ borderColor: "var(--primary)", background: "linear-gradient(145deg, var(--accent), var(--card) 72%)" }}>
              <span className="absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-70" style={{ backgroundColor: "var(--accent)" }} aria-hidden="true" />
              <div className="relative">
                <p className="flex items-center gap-2 text-xs font-bold" style={{ color: "var(--primary-hover)" }}>
                  <BookOpenCheck size={15} aria-hidden="true" />继续深化
                </p>
                {recommendedChapter && recommendedCourse ? (
                  <>
                    <h2 className="mt-4 text-xl font-bold leading-snug">{recommendedChapter.title}</h2>
                    <p className="mt-2 text-xs font-bold app-muted-text">{recommendedCourse.title} · CHAPTER {String(recommendedChapter.chapter_number).padStart(2, "0")}</p>
                    <div className="mt-5 rounded-2xl border p-3.5" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
                      <div className="flex items-center justify-between gap-3 text-xs font-bold">
                        <span>电子书 {recommendedReadingProgress}%</span>
                        <span style={{ color: recommendedAttempt?.passed ? "var(--status-success)" : "var(--foreground-muted)" }}>
                          {recommendedAttempt ? (recommendedAttempt.passed ? "测试已通过" : `${recommendedAttempt.score} 分 · 未通过`) : "尚未测试"}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--surface-soft)" }}>
                        <div className="h-full rounded-full" style={{ width: `${recommendedAttempt?.passed ? 100 : recommendedReadingProgress}%`, backgroundColor: "var(--primary)" }} />
                      </div>
                    </div>
                    <Link href={recommendedHref} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition hover:opacity-90 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2" style={{ color: "var(--primary-foreground)", backgroundColor: "var(--primary-hover)", outlineColor: "var(--primary)" }}>
                      <ArrowRight size={16} aria-hidden="true" />继续精研
                    </Link>
                  </>
                ) : (
                  <p className="mt-4 text-sm font-bold app-muted-text">当前没有可进入的章节。</p>
                )}
              </div>
            </section>

            <section className="app-card rounded-[24px] border p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold app-muted-text">待复习题</p>
                  <p className="mt-1 text-2xl font-bold">{reviewItems.length}</p>
                </div>
                <BookmarkCheck size={22} style={{ color: "var(--status-success)" }} aria-hidden="true" />
              </div>
              {reviewItems.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {reviewItems.slice(0, 2).map((item) => (
                    <p key={item.questionId} className="line-clamp-2 rounded-xl px-3 py-2 text-[10px] font-bold" style={{ backgroundColor: "var(--surface-soft)" }}>
                      {item.question.prompt}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs leading-5 app-muted-text">章节测试中加入复习的题目会集中显示在这里。</p>
              )}
              <Link href={reviewAreaHref} className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-lg text-xs font-bold focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2" style={{ color: "var(--status-success)", outlineColor: "var(--primary)" }}>
                {reviewItems.length > 0 ? "查看全部复习题" : "进入复习区"}<ArrowRight size={12} aria-hidden="true" />
              </Link>
            </section>
          </aside>
        </div>
      )}

      {activeArea === "knowledge" && (
        <div className="mt-5 space-y-5">
          {selectedKnowledgeChapter && selectedCourse && (
            selectedKnowledgeChapter.slug === "meet-hangul" ? (
              <KnowledgeResearchWorkbench
                chapterSlug={selectedKnowledgeChapter.slug}
                courseTitle={selectedCourse.title}
                courseEyebrow={selectedCourse.eyebrow}
                chapterNumber={selectedKnowledgeChapter.chapter_number}
                chapterTitle={selectedKnowledgeChapter.title}
                chapterKoreanTitle={selectedKnowledgeChapter.korean_title}
                chapterDescription={selectedKnowledgeChapter.description}
                backHref={`?area=knowledge&course=${encodeURIComponent(selectedCourse.key)}`}
                ebookHref={`${
                  tenant?.slug
                    ? getStudentAppPath(
                        tenant.slug,
                        "korean",
                        "courses/korean/korean-basic/korean-beginner/hangul-introduction"
                      )
                    : "/dashboard/courses/korean/korean-basic/korean-beginner/hangul-introduction"
                }?chapter=${encodeURIComponent(selectedKnowledgeChapter.slug)}`}
                chapterTestHref={`${assignmentsBaseHref}/${encodeURIComponent(selectedKnowledgeChapter.slug)}`}
              />
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={`?area=knowledge&course=${encodeURIComponent(selectedCourse.key)}`}
                    className="app-muted-text inline-flex min-h-11 items-center gap-1.5 rounded-lg text-[11px] font-bold focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
                    style={{ outlineColor: "var(--primary)" }}
                  >
                    ← 返回章节列表
                  </Link>
                  <span className="app-muted-text text-[11px] font-bold">
                    {selectedCourse.title}
                  </span>
                </div>
                <section className="app-card rounded-3xl border p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="app-muted-text text-[10px] font-bold">
                        {courseLabel(selectedKnowledgeChapter.course_key)} · 第{" "}
                        {selectedKnowledgeChapter.chapter_number} 章
                      </p>
                      <h2 className="mt-1 text-xl font-bold">
                        {selectedKnowledgeChapter.title}
                      </h2>
                      {selectedKnowledgeChapter.korean_title && (
                        <p className="app-muted-text mt-1 text-xs">
                          {selectedKnowledgeChapter.korean_title}
                        </p>
                      )}
                    </div>
                    <span
                      className="rounded-full px-3 py-1.5 text-[10px] font-bold"
                      style={{
                        color: "var(--primary)",
                        backgroundColor: "var(--accent)",
                      }}
                    >
                      知识精研工作区
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    {[
                      ["精讲", BookOpenCheck, "讲清本章核心知识与使用场景"],
                      ["拆解", ListTree, "逐层展开结构、组合与推导过程"],
                      ["对比", GitCompareArrows, "集中辨别相近知识与易混项"],
                    ].map(([label, Icon, description]) => {
                      const WorkspaceIcon = Icon as typeof BookOpenCheck;
                      return (
                        <article
                          key={String(label)}
                          className="app-soft-card rounded-2xl border p-4"
                        >
                          <WorkspaceIcon
                            size={18}
                            style={{ color: "var(--primary)" }}
                            aria-hidden="true"
                          />
                          <h3 className="mt-3 text-sm font-bold">
                            {String(label)}
                          </h3>
                          <p className="app-muted-text mt-1 text-[10px] leading-5">
                            {String(description)}
                          </p>
                        </article>
                      );
                    })}
                  </div>
                </section>
              </>
            )
          )}
        </div>
      )}

      {activeArea === "listening" && !selectedListeningChapter && (
        <section className="app-card mt-5 rounded-[28px] border p-4 sm:p-5" aria-labelledby="listening-route-title">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3 px-1">
            <div>
              <div className="flex items-center gap-2">
                <h2 id="listening-route-title" className="text-lg font-bold sm:text-xl">听音训练路线</h2>
                <span className="rounded-full px-2 py-1 text-[9px] font-bold" style={{ color: "var(--support)", backgroundColor: "var(--support-surface)" }}>
                  逐步开放
                </span>
              </div>
              <p className="mt-1 text-xs app-muted-text">按课程展开章节；已开放的章节可进入听音工作区。</p>
            </div>
            <span className="rounded-xl px-3 py-2 text-[10px] font-bold app-muted-text" style={{ backgroundColor: "var(--surface-soft)" }}>
              听音内容正在按章完善
            </span>
          </div>
          <div className="space-y-3">
            {knowledgeChapters.length === 0 ? (
              <div className="app-soft-card rounded-2xl border border-dashed p-8 text-center">
                <Headphones className="mx-auto opacity-40" size={28} aria-hidden="true" />
                <p className="mt-3 text-sm font-bold">暂无听音章节</p>
                <p className="app-muted-text mt-2 text-xs leading-5">
                  听音章节发布后会显示在这里。
                </p>
              </div>
            ) : knowledgeCourses.map((course) => (
              <ChapterDirectory
                key={course.key}
                area="listening"
                course={course}
                unlockedChapterSlugs={unlockedChapterSlugs}
                ebookProgressBySlug={ebookProgressBySlug}
                attemptByTestSlug={attemptByTestSlug}
                selectedChapterSlug={params.chapter}
                defaultOpen={false}
              />
            ))}
          </div>
        </section>
      )}

      {activeArea === "listening" && selectedListeningChapter && selectedCourse && (
        <div className="mt-5 space-y-5">
            <>
            <div className="flex items-center justify-between gap-3">
              <Link
                href={`?area=listening&course=${encodeURIComponent(selectedCourse.key)}`}
                className="app-muted-text inline-flex min-h-11 items-center gap-1.5 rounded-lg text-[10px] font-bold focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
                style={{ outlineColor: "var(--primary)" }}
              >
                ← 返回章节列表
              </Link>
              <span className="app-muted-text text-[10px] font-bold">
                {selectedCourse.title}
              </span>
            </div>
            <section className="app-card rounded-3xl border p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="app-muted-text text-[10px] font-bold">
                    {courseLabel(selectedListeningChapter.course_key)} · 第{" "}
                    {selectedListeningChapter.chapter_number} 章
                  </p>
                  <h2 className="mt-1 text-xl font-bold">
                    {selectedListeningChapter.title}
                  </h2>
                  {selectedListeningChapter.korean_title && (
                    <p className="app-muted-text mt-1 text-xs">
                      {selectedListeningChapter.korean_title}
                    </p>
                  )}
                </div>
                <span
                  className="rounded-full px-3 py-1.5 text-[10px] font-bold"
                  style={{
                    color: "var(--support)",
                    backgroundColor: "var(--support-surface)",
                  }}
                >
                  听音训练工作区
                </span>
              </div>
              <div className="app-soft-card mt-5 rounded-2xl border border-dashed p-6 text-center">
                <Headphones
                  className="mx-auto opacity-35"
                  size={30}
                  aria-hidden="true"
                />
                <p className="mt-3 text-xs font-bold">
                  本章听音内容将在这里展开
                </p>
              </div>
            </section>
            </>
        </div>
      )}

      {activeArea === "review" && <section id="guide-target-review-questions" className="mt-5 scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BookmarkCheck size={18} style={{ color: "var(--status-success)" }} aria-hidden="true" />
              <h2 className="text-xl font-bold">待复习题</h2>
            </div>
            <p className="app-muted-text mt-1 text-xs">
              共 {reviewItems.length} 道题，按最近加入时间排列
            </p>
          </div>
          <Link
            href={assignmentsBaseHref}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-bold focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
            style={{
              color: "var(--support)",
              borderColor: "var(--border-subtle)",
              backgroundColor: "var(--card)",
              outlineColor: "var(--primary)",
            }}
          >
            前往章节测试
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>

        {reviewDataError && (
          <div
            className="mt-4 rounded-2xl border p-4 text-xs font-bold"
            style={{
              color: "var(--status-warning)",
              borderColor: "var(--status-warning)",
              backgroundColor: "var(--status-warning-surface)",
            }}
          >
            待复习题暂时无法读取，请确认最新数据库迁移已经应用。
          </div>
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {reviewItems.map((item) => {
            const removeAction = removeCourseQuestionReviewAction.bind(
              null,
              item.questionId
            );
            const options = parseQuestionOptions(item.question.options);
            return (
              <article
                key={item.questionId}
                className="app-card flex flex-col rounded-3xl border p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-bold"
                      style={{
                        color: "var(--status-success)",
                        backgroundColor: "var(--status-success-surface)",
                      }}
                    >
                      {courseLabel(item.test.course_key)}
                    </span>
                    <span className="app-muted-text text-[10px] font-bold">
                      CHAPTER{" "}
                      {String(item.test.chapter_number).padStart(2, "0")}
                    </span>
                  </div>
                  <span className="app-muted-text text-[9px]">
                    {reviewDateFormatter.format(new Date(item.addedAt))} 加入
                  </span>
                </div>

                <div className="mt-4">
                  <p className="app-muted-text text-[10px] font-bold">
                    {item.test.title}
                    {item.test.korean_title
                      ? ` · ${item.test.korean_title}`
                      : ""}
                  </p>
                  <h3 className="mt-2 text-sm font-bold leading-6">
                    {item.question.prompt}
                  </h3>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {options.map((option, index) => (
                    <div
                      key={`${item.questionId}-${index}`}
                      className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[11px] font-bold"
                      style={{
                        borderColor: "var(--border-subtle)",
                        backgroundColor: "var(--surface-soft)",
                      }}
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold"
                        style={{ backgroundColor: "var(--card)" }}
                      >
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span>{option}</span>
                    </div>
                  ))}
                </div>

                <div
                  className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t pt-4"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <Link
                    href={`${assignmentsBaseHref}/${encodeURIComponent(item.test.slug)}`}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-xs font-bold focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
                    style={{ color: "var(--support)", outlineColor: "var(--primary)" }}
                  >
                    返回章节测试
                    <ArrowRight size={12} aria-hidden="true" />
                  </Link>
                  <form action={removeAction}>
                    <button
                      type="submit"
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-bold focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
                      style={{
                        color: "var(--foreground-muted)",
                        borderColor: "var(--border-subtle)",
                        backgroundColor: "var(--card)",
                        outlineColor: "var(--primary)",
                      }}
                    >
                      <Trash2 size={12} aria-hidden="true" />
                      移出复习
                    </button>
                  </form>
                </div>
              </article>
            );
          })}
        </div>

        {!reviewDataError && reviewItems.length === 0 && (
          <div className="app-card mt-4 rounded-3xl border border-dashed p-10 text-center">
            <BookOpenCheck
              className="mx-auto opacity-30"
              size={34}
              aria-hidden="true"
            />
            <p className="mt-3 text-sm font-bold">还没有待复习题</p>
            <p className="app-muted-text mt-2 text-xs">
              在章节测试中点击“加入复习”，不熟悉的题目就会集中显示在这里。
            </p>
          </div>
        )}
      </section>}
    </div>
  );
}

export default function LegacyDeepLearningPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; course?: string; chapter?: string }>;
}) {
  return <DeepLearningPage searchParams={searchParams} />;
}
