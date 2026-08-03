import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookmarkCheck,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CircleDashed,
  GitCompareArrows,
  Headphones,
  Layers3,
  ListTree,
  LockKeyhole,
  Trash2,
  XCircle,
} from "lucide-react";

import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";
import { isPlatformTenantManagerRole } from "@/lib/admin";
import { requireActiveUser } from "@/lib/auth";
import { getUnlockedKoreanTestSlugs } from "@/lib/korean-learning-unlocks";
import { parseQuestionOptions } from "@/lib/korean-chapter-tests";
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

function EntryTitle({
  title,
  hint,
  large = false,
  tooltipSide = "right",
}: {
  title: string;
  hint: string;
  large?: boolean;
  tooltipSide?: "left" | "right";
}) {
  return (
    <div className="mt-5 flex items-center gap-1.5">
      <h2 className={`${large ? "text-xl" : "text-lg"} font-black`}>{title}</h2>
      <span className="group/hint relative flex shrink-0 items-center">
        <CircleAlert
          className="app-muted-text"
          size={14}
          aria-hidden="true"
        />
        <span className={`app-card pointer-events-none invisible absolute top-1/2 z-30 w-64 -translate-y-1/2 rounded-2xl border p-3 text-xs font-medium leading-5 opacity-0 shadow-lg transition group-hover/hint:visible group-hover/hint:opacity-100 ${tooltipSide === "left" ? "right-full mr-2" : "left-full ml-2"}`}>
          {hint}
        </span>
      </span>
    </div>
  );
}

type LearningArea = "knowledge" | "listening" | "review";

function CourseSelectionCards({
  area,
  courses,
  selectedCourseKey,
}: {
  area: "knowledge" | "listening";
  courses: LearningCourse[];
  selectedCourseKey: string | null;
}) {
  const color =
    area === "knowledge" ? "var(--app-accent)" : "var(--app-secondary)";
  const soft =
    area === "knowledge"
      ? "var(--app-accent-soft)"
      : "var(--app-secondary-soft)";

  return (
    <section className="grid gap-4 md:grid-cols-2">
      {courses.map((course) => {
        const isSelected = selectedCourseKey === course.key;
        return (
          <Link
            key={course.key}
            href={`?area=${area}&course=${encodeURIComponent(course.key)}`}
            className="app-card group rounded-3xl border p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
            style={{
              borderColor: isSelected ? color : "var(--app-border)",
              background: `linear-gradient(135deg, var(--app-card-bg), ${soft})`,
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  className="text-[10px] font-black tracking-[0.15em]"
                  style={{ color }}
                >
                  {course.eyebrow}
                </p>
                <h2 className="mt-1 text-xl font-black">{course.title}</h2>
              </div>
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ color, backgroundColor: "var(--app-card-bg)" }}
              >
                <ArrowRight
                  className="transition group-hover:translate-x-0.5"
                  size={16}
                />
              </span>
            </div>
            <p className="app-muted-text mt-4 text-[10px] font-black">
              {course.chapters.length} 个章节
            </p>
          </Link>
        );
      })}
    </section>
  );
}

function ChapterDirectory({
  area,
  course,
  unlockedChapterSlugs,
  ebookProgressBySlug,
  attemptByTestSlug,
  selectedChapterSlug,
}: {
  area: "knowledge" | "listening";
  course: LearningCourse;
  unlockedChapterSlugs: Set<string>;
  ebookProgressBySlug: Map<string, number>;
  attemptByTestSlug: Map<string, TestAttemptRow>;
  selectedChapterSlug?: string;
}) {
  const color =
    area === "knowledge" ? "var(--app-accent)" : "var(--app-secondary)";
  const soft =
    area === "knowledge"
      ? "var(--app-accent-soft)"
      : "var(--app-secondary-soft)";

  return (
    <details
      className="app-card group rounded-3xl border p-4 sm:p-5"
      style={{
        background: `linear-gradient(135deg, var(--app-card-bg) 20%, ${soft})`,
      }}
      open
    >
      <summary className="flex cursor-pointer list-none items-end justify-between gap-3">
        <div>
          <p
            className="text-[10px] font-black tracking-[0.15em]"
            style={{ color }}
          >
            {course.eyebrow}
          </p>
          <h2 className="mt-1 text-xl font-black">{course.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="app-soft-card rounded-full border px-3 py-1.5 text-[10px] font-black">
            {course.chapters.length} 章
          </span>
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ color, backgroundColor: soft }}
          >
            <ChevronDown
              className="transition-transform group-open:rotate-180"
              size={15}
              aria-hidden="true"
            />
          </span>
        </div>
      </summary>

      <div
        className={`mt-4 grid ${area === "knowledge" ? "gap-x-7 gap-y-8" : "gap-2.5"} sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6`}
      >
        {course.chapters.map((chapter, chapterIndex) => {
          const isUnlocked = unlockedChapterSlugs.has(chapter.slug);
          const isSelected = selectedChapterSlug === chapter.slug;
          const progress = ebookProgressBySlug.get(chapter.slug) ?? 0;
          const attempt = isUnlocked
            ? attemptByTestSlug.get(chapter.slug)
            : undefined;
          const passed = attempt?.passed === true;
          const failed = Boolean(attempt) && !passed;
          const statusColor = passed
            ? "var(--app-success)"
            : failed
              ? "var(--app-warm)"
              : "var(--app-muted)";
          const statusSoft = passed
            ? "var(--app-success-soft)"
            : failed
              ? "var(--app-warm-soft)"
              : "var(--app-card-bg)";
          const statusBorder = passed
            ? "var(--app-success)"
            : failed
              ? "var(--app-warm)"
              : "var(--app-border-soft)";
          const isCircular = area === "knowledge";
          const content = isCircular ? (
            <>
              <span
                className="text-[8px] font-black tracking-[0.12em]"
                style={{ color }}
              >
                CHAPTER {String(chapter.chapter_number).padStart(2, "0")}
              </span>
              <h3 className="mt-2 line-clamp-2 text-xs font-black leading-5">
                {chapter.title}
              </h3>
              {chapter.korean_title && (
                <p className="app-muted-text mt-0.5 max-w-full truncate text-[8px]">
                  {chapter.korean_title}
                </p>
              )}
              <span
                className="mt-2 flex h-7 w-7 items-center justify-center rounded-full"
                style={{
                  color: isUnlocked ? statusColor : "#c94f45",
                  backgroundColor: isUnlocked ? statusSoft : "#fff0ed",
                }}
              >
                {!isUnlocked ? (
                  <LockKeyhole size={14} strokeWidth={2.6} />
                ) : passed ? (
                  <CheckCircle2 size={11} />
                ) : failed ? (
                  <XCircle size={11} />
                ) : (
                  <CircleDashed size={11} />
                )}
              </span>
              <p
                className="mt-1 text-[8px] font-black"
                style={{ color: isUnlocked ? statusColor : "var(--app-muted)" }}
              >
                {!isUnlocked
                  ? "未开放"
                  : attempt
                    ? `${attempt.score} 分 · ${passed ? "已通过" : "未通过"}`
                    : "未测试"}
              </p>
              {isUnlocked && progress > 0 && (
                <p className="app-muted-text mt-0.5 text-[8px]">
                  电子书 {progress}%
                </p>
              )}
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <span
                  className="rounded-full px-2 py-1 text-[8px] font-black"
                  style={{ color, backgroundColor: soft }}
                >
                  CHAPTER {String(chapter.chapter_number).padStart(2, "0")}
                </span>
                {isUnlocked ? (
                  <ArrowRight size={13} style={{ color }} />
                ) : (
                  <LockKeyhole className="app-muted-text" size={12} />
                )}
              </div>
              <h3 className="mt-3 text-xs font-black leading-5">
                {chapter.title}
              </h3>
              {chapter.korean_title && (
                <p className="app-muted-text mt-0.5 truncate text-[9px]">
                  {chapter.korean_title}
                </p>
              )}
              <p className="app-muted-text mt-3 text-[9px] font-bold">
                {!isUnlocked
                  ? "完成上一章测试后开放"
                  : attempt
                    ? `${attempt.score} 分 · ${passed ? "已通过" : "未通过"}`
                    : "未测试"}
              </p>
              {isUnlocked && progress > 0 && (
                <p className="app-muted-text mt-1 text-[8px]">
                  电子书进度 {progress}%
                </p>
              )}
            </>
          );

          const chapterNode = isUnlocked ? (
            <Link
              key={chapter.id}
              href={`?area=${area}&course=${encodeURIComponent(course.key)}&chapter=${encodeURIComponent(chapter.slug)}`}
              className={`${isCircular ? "mx-auto flex aspect-square w-full max-w-[150px] flex-col items-center justify-center rounded-full p-4 text-center" : "rounded-2xl p-3"} border transition hover:-translate-y-1 hover:shadow-md`}
              style={{
                borderColor: isSelected ? color : statusBorder,
                background: passed
                  ? "linear-gradient(135deg, var(--app-card-bg), var(--app-success-soft))"
                  : failed
                    ? "linear-gradient(135deg, var(--app-card-bg), var(--app-warm-soft))"
                    : "linear-gradient(135deg, var(--app-card-bg), var(--app-secondary-soft))",
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
              className={`${isCircular ? "mx-auto flex aspect-square w-full max-w-[150px] flex-col items-center justify-center rounded-full p-4 text-center" : "rounded-2xl p-3"} border opacity-60`}
              style={{
                borderColor: statusBorder,
                backgroundColor: "var(--app-soft-bg)",
              }}
            >
              {content}
            </article>
          );

          if (!isCircular) {
            return chapterNode;
          }

          const isLastChapter = chapterIndex === course.chapters.length - 1;
          const smEndsRow = (chapterIndex + 1) % 2 === 0;
          const lgEndsRow = (chapterIndex + 1) % 4 === 0;
          const xlEndsRow = (chapterIndex + 1) % 6 === 0;
          const horizontalConnector =
            "sm:-right-5 sm:top-1/2 sm:bottom-auto sm:left-auto sm:-translate-y-1/2 sm:rotate-0";
          const downwardConnector =
            "left-1/2 -bottom-5 -translate-x-1/2 rotate-90";

          return (
            <div key={chapter.id} className="relative flex justify-center">
              {chapterNode}
              {!isLastChapter && (
                <ArrowRight
                  aria-hidden="true"
                  size={17}
                  className={`pointer-events-none absolute z-10 ${downwardConnector} ${horizontalConnector} ${
                    smEndsRow
                      ? "sm:left-1/2 sm:-bottom-5 sm:right-auto sm:top-auto sm:-translate-x-1/2 sm:translate-y-0 sm:rotate-90"
                      : ""
                  } ${
                    lgEndsRow
                      ? "lg:left-1/2 lg:-bottom-5 lg:right-auto lg:top-auto lg:-translate-x-1/2 lg:translate-y-0 lg:rotate-90"
                      : "lg:-right-5 lg:top-1/2 lg:bottom-auto lg:left-auto lg:translate-x-0 lg:-translate-y-1/2 lg:rotate-0"
                  } ${
                    xlEndsRow
                      ? "xl:left-1/2 xl:-bottom-5 xl:right-auto xl:top-auto xl:-translate-x-1/2 xl:translate-y-0 xl:rotate-90"
                      : "xl:-right-5 xl:top-1/2 xl:bottom-auto xl:left-auto xl:translate-x-0 xl:-translate-y-1/2 xl:rotate-0"
                  }`}
                  style={{ color: "var(--app-muted)" }}
                />
              )}
            </div>
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
  const activeArea: LearningArea | null =
    params.area === "knowledge" ||
    params.area === "listening" ||
    params.area === "review"
      ? params.area
      : null;
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
      ? admin
          .from("chapter_tests")
          .select("id,slug,course_key,chapter_number,title,korean_title")
          .in("id", testIds)
      : Promise.resolve({ data: [] }),
    admin
      .from("chapter_tests")
      .select("id,lesson_id,slug,course_key,chapter_number,title,korean_title,description")
      .in("course_key", ["hangul-introduction", "korean-level-one"])
      .eq("status", "published")
      .order("chapter_number", { ascending: true }),
    supabase
      .from("chapter_test_attempts")
      .select("test_slug,score,passed")
      .eq("student_id", user.id),
    supabase
      .from("course_ebook_progress")
      .select("test_slug,progress_percent")
      .eq("student_id", user.id),
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

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
      {activeArea && selectedKnowledgeChapter?.slug !== "meet-hangul" && (
        <section
          className="app-card overflow-hidden rounded-3xl border p-5 sm:p-6"
          style={{
            background:
              "linear-gradient(125deg, var(--app-hero-end), var(--app-card-bg), var(--app-secondary-soft))",
          }}
        >
        <div className="flex items-start justify-between gap-4">
          <DashboardTitleWithHint
            title={
              activeArea === "knowledge"
                ? "知识精研"
                : activeArea === "listening"
                  ? "听音训练"
                  : activeArea === "review"
                    ? "待复习题"
                    : "深化学习"
            }
            description={
              activeArea === "knowledge"
                ? "按照课程与章节开展精讲、拆解和对比学习。"
                : activeArea === "listening"
                  ? "按照课程与章节开展辨音、听写和跟读训练。"
                  : activeArea === "review"
                    ? "集中查看和处理在章节测试中加入复习的题目。"
                    : "通过知识精研、听音训练和待复习题，把教材重点与个人薄弱项集中学透。"
            }
          />
          <span
            className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl sm:flex"
            style={{
              color: "var(--app-secondary)",
              backgroundColor: "var(--app-secondary-soft)",
            }}
          >
            <BarChart3 size={22} aria-hidden="true" />
          </span>
        </div>
        </section>
      )}

      {!activeArea && (
      <section className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)_minmax(220px,1fr)]">
        <Link
          href="?area=knowledge"
          className="app-card group rounded-3xl border p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
          style={{
            borderColor:
              activeArea === "knowledge"
                ? "var(--app-accent)"
                : "var(--app-border)",
            background:
              "linear-gradient(135deg, var(--app-card-bg), var(--app-accent-soft))",
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-2xl"
              style={{
                color: "var(--app-accent)",
                backgroundColor: "var(--app-card-bg)",
              }}
            >
              <Layers3 size={20} />
            </span>
            <ArrowRight
              className="transition group-hover:translate-x-1"
              size={17}
              style={{ color: "var(--app-accent)" }}
            />
          </div>
          <EntryTitle
            title="知识精研"
            hint="围绕同一个知识点，在精讲、结构拆解和易混对比之间切换，逐层掌握。"
            large
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              ["精讲", BookOpenCheck],
              ["拆解", ListTree],
              ["对比", GitCompareArrows],
            ].map(([label, Icon]) => {
              const FeatureIcon = Icon as typeof BookOpenCheck;
              return (
                <span
                  key={String(label)}
                  className="app-soft-card inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-black"
                >
                  <FeatureIcon size={12} />
                  {String(label)}
                </span>
              );
            })}
          </div>
        </Link>

        <Link
          href="?area=listening"
          className="app-card group rounded-3xl border p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
          style={{
            borderColor:
              activeArea === "listening"
                ? "var(--app-secondary)"
                : "var(--app-border)",
            background:
              "linear-gradient(145deg, var(--app-card-bg), var(--app-secondary-soft))",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-2xl"
              style={{
                color: "var(--app-secondary)",
                backgroundColor: "var(--app-card-bg)",
              }}
            >
              <Headphones size={20} />
            </span>
            <ArrowRight
              className="transition group-hover:translate-x-1"
              size={17}
              style={{ color: "var(--app-secondary)" }}
            />
          </div>
          <EntryTitle
            title="听音训练"
            hint="通过辨音、听写和跟读等方式进行专项听力训练。"
          />
        </Link>

        <Link
          href="?area=review"
          className="app-card group rounded-3xl border p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
          style={{
            borderColor:
              activeArea === "review"
                ? "var(--app-success)"
                : "var(--app-border)",
            background:
              "linear-gradient(145deg, var(--app-card-bg), var(--app-success-soft))",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-2xl"
              style={{
                color: "var(--app-success)",
                backgroundColor: "var(--app-card-bg)",
              }}
            >
              <BookmarkCheck size={20} />
            </span>
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-black"
              style={{
                color: "var(--app-success)",
                backgroundColor: "var(--app-card-bg)",
              }}
            >
              {reviewItems.length} 题
            </span>
          </div>
          <EntryTitle
            title="待复习题"
            hint="集中查看并处理在章节测试中主动加入复习的题目。"
            tooltipSide="left"
          />
        </Link>
      </section>
      )}

      {activeArea === "knowledge" && (
        <div className="mt-5 space-y-5">
          {!selectedCourse && (
            <CourseSelectionCards
              area="knowledge"
              courses={knowledgeCourses}
              selectedCourseKey={selectedCourseKey}
            />
          )}

          {selectedCourse && !selectedKnowledgeChapter && (
            <>
              <div className="flex items-center justify-between gap-3">
                <Link
                  href="?area=knowledge"
                  className="app-muted-text inline-flex items-center gap-1.5 text-[10px] font-black"
                >
                  ← 返回课程选择
                </Link>
                <span className="app-muted-text text-[10px] font-black">
                  当前课程：{selectedCourse.title}
                </span>
              </div>
            <ChapterDirectory
              area="knowledge"
              course={selectedCourse}
              unlockedChapterSlugs={unlockedChapterSlugs}
              ebookProgressBySlug={ebookProgressBySlug}
              attemptByTestSlug={attemptByTestSlug}
            />
            </>
          )}

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

      {activeArea === "listening" && (
        <div className="mt-5 space-y-5">
          {!selectedCourse && (
            <CourseSelectionCards
              area="listening"
              courses={knowledgeCourses}
              selectedCourseKey={selectedCourseKey}
            />
          )}

          {selectedCourse && !selectedListeningChapter && (
            <>
              <div className="flex items-center justify-between gap-3">
                <Link
                  href="?area=listening"
                  className="app-muted-text inline-flex items-center gap-1.5 text-[10px] font-black"
                >
                  ← 返回课程选择
                </Link>
                <span className="app-muted-text text-[10px] font-black">
                  当前课程：{selectedCourse.title}
                </span>
              </div>
            <ChapterDirectory
              area="listening"
              course={selectedCourse}
              unlockedChapterSlugs={unlockedChapterSlugs}
              ebookProgressBySlug={ebookProgressBySlug}
              attemptByTestSlug={attemptByTestSlug}
            />
            </>
          )}

          {selectedListeningChapter && selectedCourse && (
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
          )}
        </div>
      )}

      {activeArea === "review" && <section className="mt-5">
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
