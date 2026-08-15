import Link from "next/link";
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
import { STUDENT_APP_IDS } from "@/lib/student-apps";
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

type LearningArea = "knowledge" | "listening" | "review";

function ChapterDirectory({
  area,
  course,
  unlockedChapterSlugs,
  ebookProgressBySlug,
  attemptByTestSlug,
  selectedChapterSlug,
  reviewCountByTestSlug,
  defaultOpen = false,
}: {
  area: "knowledge" | "listening";
  course: LearningCourse;
  unlockedChapterSlugs: Set<string>;
  ebookProgressBySlug: Map<string, number>;
  attemptByTestSlug: Map<string, TestAttemptRow>;
  selectedChapterSlug?: string;
  reviewCountByTestSlug?: Map<string, number>;
  defaultOpen?: boolean;
}) {
  const color =
    area === "knowledge" ? "var(--app-accent)" : "var(--app-secondary)";
  const soft =
    area === "knowledge"
      ? "var(--app-accent-soft)"
      : "var(--app-secondary-soft)";
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
      style={{ borderColor: "var(--app-border)" }}
      open={defaultOpen}
    >
      <summary
        className="flex cursor-pointer list-none items-center gap-3 p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--app-accent)] sm:p-5 [&::-webkit-details-marker]:hidden"
        style={{ backgroundColor: "var(--app-soft-bg)" }}
      >
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{ color, backgroundColor: soft }}
        >
          {area === "knowledge" ? <Layers3 size={19} /> : <Headphones size={19} />}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-[9px] font-black tracking-[0.14em]"
            style={{ color }}
          >
            {course.eyebrow}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-base font-black sm:text-lg">{course.title}</h2>
            <span className="text-[10px] font-bold app-muted-text">
              {passedCount}/{course.chapters.length} 章通过
            </span>
            <div className="h-1.5 w-16 overflow-hidden rounded-full sm:w-20" style={{ backgroundColor: "var(--app-soft-bg)" }}>
              <div className="h-full rounded-full" style={{ width: `${courseProgressPercent}%`, backgroundColor: color }} />
            </div>
            <span className="text-[10px] font-black" style={{ color }}>
              深化进度 {courseProgressPercent}%
            </span>
          </div>
        </div>
        <ChevronDown className="shrink-0 transition-transform group-open:rotate-180" size={16} aria-hidden="true" />
      </summary>

      <div className="space-y-2 border-t p-3 sm:p-4" style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-soft-bg)" }}>
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
            ? "var(--app-success)"
            : failed
              ? "var(--app-warm)"
              : "var(--app-muted)";
          const statusBorder = passed
            ? "var(--app-success)"
            : failed
              ? "var(--app-warm)"
              : "var(--app-border-soft)";
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
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[10px] font-black"
                style={{ color: isUnlocked ? statusColor : "var(--app-muted)", backgroundColor: isUnlocked ? "var(--app-card-bg)" : "var(--app-soft-bg)" }}
              >
                {!isUnlocked ? <LockKeyhole size={15} /> : passed ? <CheckCircle2 size={16} /> : failed ? <XCircle size={16} /> : String(chapter.chapter_number).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-black">{chapter.title}</h3>
                  {chapter.korean_title && <span className="text-[10px] app-muted-text">{chapter.korean_title}</span>}
                  {reviewCount > 0 && (
                    <span className="rounded-full px-2 py-0.5 text-[9px] font-black" style={{ color: "var(--app-success)", backgroundColor: "var(--app-success-soft)" }}>
                      {reviewCount} 题待复习
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[10px] font-bold app-muted-text">
                  CHAPTER {String(chapter.chapter_number).padStart(2, "0")} · {statusLabel}
                </p>
              </div>
              <span
                className="col-span-2 inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border px-3 py-2 text-[10px] font-black sm:col-span-1"
                style={{ color: isUnlocked ? color : "var(--app-muted)", borderColor: "var(--app-border)", backgroundColor: "var(--app-card-bg)" }}
              >
                {isUnlocked ? (progress > 0 || attempt ? "继续" : "开始") : "未开放"}
                {isUnlocked && <ArrowRight size={11} />}
              </span>
            </>
          );

          return isUnlocked ? (
            <Link
              key={chapter.id}
              href={`?area=${area}&course=${encodeURIComponent(course.key)}&chapter=${encodeURIComponent(chapter.slug)}`}
              className="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-2xl border p-3 transition hover:-translate-y-0.5 hover:shadow-sm sm:grid-cols-[40px_minmax(0,1fr)_auto]"
              style={{
                borderColor: isSelected ? color : statusBorder,
                background: passed
                  ? "linear-gradient(135deg, var(--app-card-bg), var(--app-success-soft))"
                  : failed
                    ? "linear-gradient(135deg, var(--app-card-bg), var(--app-warm-soft))"
                    : "var(--app-card-bg)",
                boxShadow: isSelected
                  ? `0 0 0 3px ${soft}`
                  : undefined,
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
                backgroundColor: "var(--app-soft-bg)",
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

export default async function DeepLearningPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; course?: string; chapter?: string }>;
}) {
  const params = await searchParams;
  const activeArea: LearningArea =
    params.area === "knowledge" ||
    params.area === "listening" ||
    params.area === "review"
      ? params.area
      : "knowledge";
  const { supabase, user, profile, platformProfile } = await requireActiveUser();
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
    { data: questionData },
    { data: testData },
    { data: knowledgeChapterData },
    { data: attemptData },
    { data: ebookProgressData },
  ] = await Promise.all([
    questionIds.length
      ? admin
          .from("chapter_test_questions")
          .select("id,test_id,question_key,prompt,options")
          .in("id", questionIds)
      : Promise.resolve({ data: [] }),
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
      : Promise.resolve({ data: [] }),
    withStudentAppSchemaFallback(
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
    ),
    supabase
      .from("chapter_test_attempts")
      .select("test_slug,score,passed")
      .eq("student_id", user.id),
    withStudentAppSchemaFallback(
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
    ),
  ]);
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
    (attemptData ?? []).map((attempt) => String(attempt.test_slug))
  );
  const attemptByTestSlug = new Map(
    ((attemptData ?? []) as TestAttemptRow[]).map((attempt) => [
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
  const selectedKnowledgeChapter =
    activeArea === "knowledge" && selectedCourse && params.chapter
      ? selectedCourse.chapters.find(
          (chapter) =>
            chapter.slug === params.chapter &&
            unlockedChapterSlugs.has(chapter.slug)
        ) ?? null
      : null;
  const selectedListeningChapter =
    activeArea === "listening" && selectedCourse && params.chapter
      ? selectedCourse.chapters.find(
          (chapter) =>
            chapter.slug === params.chapter &&
            unlockedChapterSlugs.has(chapter.slug)
        ) ?? null
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
    ? `?area=knowledge&course=${encodeURIComponent(recommendedCourse.key)}&chapter=${encodeURIComponent(recommendedChapter.slug)}`
    : "?area=knowledge";

  return (
    <div className="mx-auto w-full max-w-[1440px] overflow-x-clip px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <nav className="app-card mt-4 grid grid-cols-3 gap-1 rounded-2xl border p-1.5" aria-label="深化学习功能">
        <Link
          href="?area=knowledge"
          className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[10px] font-black transition sm:text-xs"
          style={activeArea === "knowledge" ? { color: "var(--app-accent-strong)", backgroundColor: "color-mix(in srgb, var(--app-accent) 28%, transparent)" } : { color: "var(--app-muted)" }}
        >
          <Layers3 size={14} className="shrink-0" />
          <span className="truncate">知识精研</span>
        </Link>
        <Link
          href="?area=listening"
          className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[10px] font-black transition sm:text-xs"
          style={activeArea === "listening" ? { color: "var(--app-secondary)", backgroundColor: "color-mix(in srgb, var(--app-secondary) 28%, transparent)" } : { color: "var(--app-muted)" }}
        >
          <Headphones size={14} className="shrink-0" />
          <span className="truncate">听音训练</span>
          <span className="hidden rounded-full px-1.5 py-0.5 text-[8px] sm:inline" style={{ backgroundColor: "var(--app-card-bg)" }}>逐步开放</span>
        </Link>
        <Link
          href="?area=review"
          className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[10px] font-black transition sm:text-xs"
          style={activeArea === "review" ? { color: "var(--app-success)", backgroundColor: "color-mix(in srgb, var(--app-success) 28%, transparent)" } : { color: "var(--app-muted)" }}
        >
          <BookmarkCheck size={14} className="shrink-0" />
          <span className="truncate">待复习题</span>
          <span className="rounded-full px-1.5 py-0.5 text-[8px]" style={{ backgroundColor: "var(--app-card-bg)" }}>{reviewItems.length}</span>
        </Link>
      </nav>

      {activeArea === "knowledge" && !selectedKnowledgeChapter && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="app-card rounded-[28px] border p-4 sm:p-5" aria-labelledby="knowledge-route-title">
            <div
              className="mb-4 flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5"
              style={{ backgroundColor: "color-mix(in srgb, var(--app-warm-soft) 70%, transparent)" }}
            >
              <div>
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}
                  >
                    <ListTree size={18} aria-hidden="true" />
                  </span>
                  <h2 id="knowledge-route-title" className="text-lg font-black sm:text-xl">课程与章节路线</h2>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="app-card rounded-xl border px-3 py-2 text-center w-[88px]">
                  <p className="text-base font-black">{knowledgeProgressPercent}%</p>
                  <p className="text-[10px] font-bold app-muted-text whitespace-nowrap">知识精研总进度</p>
                </div>
                <div className="app-card rounded-xl border px-3 py-2 text-center w-[88px]">
                  <p className="text-base font-black">{unlockedChapters.length}</p>
                  <p className="text-[10px] font-bold app-muted-text whitespace-nowrap">已开放章节</p>
                </div>
                <div className="app-card rounded-xl border px-3 py-2 text-center w-[88px]">
                  <p className="text-base font-black">{knowledgeChapters.length}</p>
                  <p className="text-[10px] font-bold app-muted-text whitespace-nowrap">总章节</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {knowledgeCourses.map((course) => (
                <ChapterDirectory
                  key={course.key}
                  area="knowledge"
                  course={course}
                  unlockedChapterSlugs={unlockedChapterSlugs}
                  ebookProgressBySlug={ebookProgressBySlug}
                  attemptByTestSlug={attemptByTestSlug}
                  selectedChapterSlug={params.chapter}
                  reviewCountByTestSlug={reviewCountByTestSlug}
                  defaultOpen={false}
                />
              ))}
            </div>
          </section>

          <aside className="order-first space-y-4 lg:order-last lg:sticky lg:top-24" aria-label="深化学习建议">
            <section className="app-card relative overflow-hidden rounded-[28px] border p-5" style={{ borderColor: "var(--app-accent)", background: "linear-gradient(145deg, var(--app-accent-soft), var(--app-card-bg) 72%)" }}>
              <span className="absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-70" style={{ backgroundColor: "var(--app-accent-soft)" }} aria-hidden="true" />
              <div className="relative">
                <p className="flex items-center gap-2 text-xs font-black" style={{ color: "var(--app-accent-strong)" }}>
                  <BookOpenCheck size={15} />继续深化
                </p>
                {recommendedChapter && recommendedCourse ? (
                  <>
                    <h2 className="mt-4 text-xl font-black leading-snug">{recommendedChapter.title}</h2>
                    <p className="mt-2 text-xs font-bold app-muted-text">{recommendedCourse.title} · CHAPTER {String(recommendedChapter.chapter_number).padStart(2, "0")}</p>
                    <div className="mt-5 rounded-2xl border p-3.5" style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-card-bg)" }}>
                      <div className="flex items-center justify-between gap-3 text-xs font-bold">
                        <span>电子书 {recommendedReadingProgress}%</span>
                        <span style={{ color: recommendedAttempt?.passed ? "var(--app-success)" : "var(--app-muted)" }}>
                          {recommendedAttempt ? (recommendedAttempt.passed ? "测试已通过" : `${recommendedAttempt.score} 分 · 未通过`) : "尚未测试"}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--app-soft-bg)" }}>
                        <div className="h-full rounded-full" style={{ width: `${recommendedAttempt?.passed ? 100 : recommendedReadingProgress}%`, backgroundColor: "var(--app-accent)" }} />
                      </div>
                    </div>
                    <Link href={recommendedHref} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition hover:opacity-90" style={{ color: "var(--app-accent-contrast)", backgroundColor: "var(--app-accent-strong)" }}>
                      <ArrowRight size={16} />继续精研
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
                  <p className="mt-1 text-2xl font-black">{reviewItems.length}</p>
                </div>
                <BookmarkCheck size={22} style={{ color: "var(--app-success)" }} />
              </div>
              {reviewItems.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {reviewItems.slice(0, 2).map((item) => (
                    <p key={item.questionId} className="line-clamp-2 rounded-xl px-3 py-2 text-[10px] font-bold" style={{ backgroundColor: "var(--app-soft-bg)" }}>
                      {item.question.prompt}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs leading-5 app-muted-text">章节测试中加入复习的题目会集中显示在这里。</p>
              )}
              <Link href="?area=review" className="mt-4 inline-flex items-center gap-1.5 text-xs font-black" style={{ color: "var(--app-success)" }}>
                {reviewItems.length > 0 ? "查看全部复习题" : "进入复习区"}<ArrowRight size={12} />
              </Link>
            </section>
          </aside>
        </div>
      )}

      {activeArea === "knowledge" && (
        <div className="mt-5 space-y-5">
          {selectedKnowledgeChapter && selectedCourse && (
            <>
            <div className="flex items-center justify-between gap-3">
              <Link
                href={`?area=knowledge&course=${encodeURIComponent(selectedCourse.key)}`}
                className="app-muted-text inline-flex items-center gap-1.5 text-[10px] font-black"
              >
                ← 返回章节列表
              </Link>
              <span className="app-muted-text text-[10px] font-black">
                {selectedCourse.title}
              </span>
            </div>
            {selectedKnowledgeChapter.slug === "meet-hangul" ? (
              <KnowledgeResearchWorkbench
                chapterSlug={selectedKnowledgeChapter.slug}
              />
            ) : (
            <section className="app-card rounded-3xl border p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="app-muted-text text-[10px] font-black">
                    {courseLabel(selectedKnowledgeChapter.course_key)} · 第{" "}
                    {selectedKnowledgeChapter.chapter_number} 章
                  </p>
                  <h2 className="mt-1 text-xl font-black">
                    {selectedKnowledgeChapter.title}
                  </h2>
                  {selectedKnowledgeChapter.korean_title && (
                    <p className="app-muted-text mt-1 text-xs">
                      {selectedKnowledgeChapter.korean_title}
                    </p>
                  )}
                </div>
                <span
                  className="rounded-full px-3 py-1.5 text-[10px] font-black"
                  style={{
                    color: "var(--app-accent)",
                    backgroundColor: "var(--app-accent-soft)",
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
                        style={{ color: "var(--app-accent)" }}
                      />
                      <h3 className="mt-3 text-sm font-black">
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
            )}
            </>
          )}
        </div>
      )}

      {activeArea === "listening" && !selectedListeningChapter && (
        <section className="app-card mt-5 rounded-[28px] border p-4 sm:p-5" aria-labelledby="listening-route-title">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3 px-1">
            <div>
              <div className="flex items-center gap-2">
                <h2 id="listening-route-title" className="text-lg font-black sm:text-xl">听音训练路线</h2>
                <span className="rounded-full px-2 py-1 text-[9px] font-black" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}>
                  逐步开放
                </span>
              </div>
              <p className="mt-1 text-xs app-muted-text">按课程展开章节；已开放的章节可进入听音工作区。</p>
            </div>
            <span className="rounded-xl px-3 py-2 text-[10px] font-bold app-muted-text" style={{ backgroundColor: "var(--app-soft-bg)" }}>
              听音内容正在按章完善
            </span>
          </div>
          <div className="space-y-3">
            {knowledgeCourses.map((course) => (
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
                className="app-muted-text inline-flex items-center gap-1.5 text-[10px] font-black"
              >
                ← 返回章节列表
              </Link>
              <span className="app-muted-text text-[10px] font-black">
                {selectedCourse.title}
              </span>
            </div>
            <section className="app-card rounded-3xl border p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="app-muted-text text-[10px] font-black">
                    {courseLabel(selectedListeningChapter.course_key)} · 第{" "}
                    {selectedListeningChapter.chapter_number} 章
                  </p>
                  <h2 className="mt-1 text-xl font-black">
                    {selectedListeningChapter.title}
                  </h2>
                  {selectedListeningChapter.korean_title && (
                    <p className="app-muted-text mt-1 text-xs">
                      {selectedListeningChapter.korean_title}
                    </p>
                  )}
                </div>
                <span
                  className="rounded-full px-3 py-1.5 text-[10px] font-black"
                  style={{
                    color: "var(--app-secondary)",
                    backgroundColor: "var(--app-secondary-soft)",
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
                <p className="mt-3 text-xs font-black">
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
              <BookmarkCheck size={18} style={{ color: "var(--app-success)" }} />
              <h2 className="text-xl font-black">待复习题</h2>
            </div>
            <p className="app-muted-text mt-1 text-xs">
              共 {reviewItems.length} 道题，按最近加入时间排列
            </p>
          </div>
          <Link
            href="/dashboard/assignments/korean"
            className="inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-black"
            style={{
              color: "var(--app-secondary)",
              borderColor: "var(--app-border-soft)",
              backgroundColor: "var(--app-card-bg)",
            }}
          >
            前往章节测试
            <ArrowRight size={13} />
          </Link>
        </div>

        {reviewError && (
          <div
            className="mt-4 rounded-2xl border p-4 text-xs font-bold"
            style={{
              color: "var(--app-warm)",
              borderColor: "var(--app-warm)",
              backgroundColor: "var(--app-warm-soft)",
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
                      className="rounded-full px-2.5 py-1 text-[10px] font-black"
                      style={{
                        color: "var(--app-success)",
                        backgroundColor: "var(--app-success-soft)",
                      }}
                    >
                      {courseLabel(item.test.course_key)}
                    </span>
                    <span className="app-muted-text text-[10px] font-black">
                      CHAPTER{" "}
                      {String(item.test.chapter_number).padStart(2, "0")}
                    </span>
                  </div>
                  <span className="app-muted-text text-[9px]">
                    {reviewDateFormatter.format(new Date(item.addedAt))} 加入
                  </span>
                </div>

                <div className="mt-4">
                  <p className="app-muted-text text-[10px] font-black">
                    {item.test.title}
                    {item.test.korean_title
                      ? ` · ${item.test.korean_title}`
                      : ""}
                  </p>
                  <h3 className="mt-2 text-sm font-black leading-6">
                    {item.question.prompt}
                  </h3>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {options.map((option, index) => (
                    <div
                      key={`${item.questionId}-${index}`}
                      className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[11px] font-bold"
                      style={{
                        borderColor: "var(--app-border-soft)",
                        backgroundColor: "var(--app-soft-bg)",
                      }}
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[9px] font-black"
                        style={{ backgroundColor: "var(--app-card-bg)" }}
                      >
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span>{option}</span>
                    </div>
                  ))}
                </div>

                <div
                  className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t pt-4"
                  style={{ borderColor: "var(--app-border-soft)" }}
                >
                  <Link
                    href={`/dashboard/assignments/korean/${item.test.slug}`}
                    className="inline-flex items-center gap-1.5 text-xs font-black"
                    style={{ color: "var(--app-secondary)" }}
                  >
                    返回章节测试
                    <ArrowRight size={12} />
                  </Link>
                  <form action={removeAction}>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-black"
                      style={{
                        color: "var(--app-muted)",
                        borderColor: "var(--app-border-soft)",
                        backgroundColor: "var(--app-card-bg)",
                      }}
                    >
                      <Trash2 size={12} />
                      移出复习
                    </button>
                  </form>
                </div>
              </article>
            );
          })}
        </div>

        {!reviewError && reviewItems.length === 0 && (
          <div className="app-card mt-4 rounded-3xl border border-dashed p-10 text-center">
            <BookOpenCheck
              className="mx-auto opacity-30"
              size={34}
              aria-hidden="true"
            />
            <p className="mt-3 text-sm font-black">还没有待复习题</p>
            <p className="app-muted-text mt-2 text-xs">
              在章节测试中点击“加入复习”，不熟悉的题目就会集中显示在这里。
            </p>
          </div>
        )}
      </section>}
    </div>
  );
}
