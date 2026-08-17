"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Award,
  CheckCircle2,
  ClipboardCheck,
  FilePenLine,
  SearchCheck,
  Trophy,
  XCircle,
} from "lucide-react";

import { LocalDateTime } from "@/components/LocalDateTime";
import { Button } from "@/components/ui/button";
import {
  SixDimensionRadar,
  languageSkillPresentation,
  type LanguageSkill as SharedLanguageSkill,
} from "@/components/analytics/SixDimensionRadar";
import { GradeReviewForm } from "./GradeReviewForm";
import {
  GRADE_DATE_TIME_OPTIONS,
  GRADE_REVIEW_STATUS_LABELS,
  type GradeReviewStatus,
} from "./config";

export type LanguageSkill = SharedLanguageSkill;

export type GradeSkillProfileItem = {
  skill: LanguageSkill;
  percentage: number | null;
  earnedPoints: number;
  totalPoints: number;
  questionCount: number;
  assessmentCount: number;
};

export type GradeCategory = "homework" | "exam";

type GradeResult = {
  key: string;
  category: "chapter_test" | GradeCategory;
  sourceType: "assignment_submission" | "chapter_test_attempt";
  sourceResultId: string;
  courseName: string;
  title: string;
  subtitle: string;
  typeLabel: string;
  score: number;
  totalPoints: number;
  passed: boolean;
  resultLabel: string;
  feedback: string;
  recordedAt: string;
  href: string;
  skills: LanguageSkill[];
};

type GradeReview = {
  id: string;
  source_type:
    | "manual_grade_record"
    | "assignment_submission"
    | "chapter_test_attempt";
  source_result_id: string | null;
  status: GradeReviewStatus;
  response: string;
};

const categoryPresentation = {
  homework: {
    label: "老师作业",
    shortLabel: "平时学习成果与老师批改",
    icon: FilePenLine,
    color: "var(--primary)",
    soft: "var(--accent)",
  },
  exam: {
    label: "正式考试",
    shortLabel: "阶段性正式成绩",
    icon: ClipboardCheck,
    color: "var(--support)",
    soft: "var(--support-surface)",
  },
} satisfies Record<
  GradeCategory,
  {
    label: string;
    shortLabel: string;
    icon: typeof FilePenLine;
    color: string;
    soft: string;
  }
>;

function reviewTone(status: GradeReviewStatus) {
  if (status === "resolved") {
    return {
      color: "var(--status-success)",
      background: "var(--status-success-surface)",
    };
  }
  if (status === "rejected") {
    return {
      color: "var(--foreground-muted)",
      background: "var(--surface-soft)",
    };
  }
  return {
    color: "var(--status-warning)",
    background: "var(--status-warning-surface)",
  };
}

function percentage(result: GradeResult) {
  return result.totalPoints > 0
    ? Math.max(0, Math.min(100, (result.score / result.totalPoints) * 100))
    : 0;
}

function averageOf(results: GradeResult[]) {
  if (results.length === 0) return null;
  return (
    results.reduce((sum, result) => sum + percentage(result), 0) /
    results.length
  );
}

function scoreLabel(value: number | null) {
  if (value == null) return "等待成绩积累";
  if (value >= 90) return "表现优秀";
  if (value >= 80) return "掌握良好";
  if (value >= 60) return "达到基础要求";
  return "需要重点巩固";
}

function isGradeCategory(value: string | null): value is GradeCategory {
  return value === "homework" || value === "exam";
}

function readStoredCategory(memoryKey: string) {
  try {
    const storedCategory = window.localStorage.getItem(memoryKey);
    return isGradeCategory(storedCategory) ? storedCategory : null;
  } catch {
    return null;
  }
}

function rememberCategory(memoryKey: string, category: GradeCategory) {
  try {
    window.localStorage.setItem(memoryKey, category);
  } catch {
    // 隐私模式或禁用本地存储时，URL 状态仍然可用。
  }
}

function readCategoryFromUrl() {
  const queryCategory = new URLSearchParams(window.location.search).get("type");
  return isGradeCategory(queryCategory) ? queryCategory : null;
}

function writeCategoryToUrl(
  category: GradeCategory,
  method: "pushState" | "replaceState",
) {
  const url = new URL(window.location.href);
  url.searchParams.set("type", category);
  window.history[method](
    null,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}

function SkillRadar({
  category,
  profile,
}: {
  category: GradeCategory;
  profile: GradeSkillProfileItem[];
}) {
  const categoryStyle = categoryPresentation[category];
  return (
    <SixDimensionRadar
      eyebrow={categoryStyle.label}
      title="六维学习能力"
      description="查看听、说、读、写、词汇与语法表现"
      icon={categoryStyle.icon}
      color={categoryStyle.color}
      soft={categoryStyle.soft}
      data={profile.map((item) => ({
        skill: item.skill,
        value: item.percentage,
        evidenceCount: item.questionCount,
        activityCount: item.assessmentCount,
      }))}
      evidenceText={(item) =>
        item.evidenceCount
          ? `${item.evidenceCount} 道有效评分题 · ${item.activityCount ?? 0} 次考核`
          : "暂无带此能力标记的成绩"
      }
      emptyMessage={`目前的已批改${categoryStyle.label}还没有六维能力标记。完成带能力维度的${categoryStyle.label}后，这里会自动形成六边形。`}
      insightLabel="本次能力解读"
      evidenceOnly
      deemphasizeSparseInsight
    />
  );
}

export function GradeBoard({
  results,
  reviews,
  skillProfiles,
  isStudent,
  dataError,
  memoryKey,
}: {
  results: GradeResult[];
  reviews: GradeReview[];
  skillProfiles: Record<GradeCategory, GradeSkillProfileItem[]>;
  isStudent: boolean;
  dataError: boolean;
  memoryKey: string;
}) {
  const [category, setCategory] = useState<GradeCategory>("homework");

  useEffect(() => {
    const urlCategory = readCategoryFromUrl();
    const initialCategory =
      urlCategory ?? readStoredCategory(memoryKey) ?? "homework";

    rememberCategory(memoryKey, initialCategory);
    if (!urlCategory) writeCategoryToUrl(initialCategory, "replaceState");
    const initialSyncFrame = window.requestAnimationFrame(() => {
      setCategory(initialCategory);
    });

    const syncCategoryFromHistory = () => {
      const historyCategory = readCategoryFromUrl() ?? "homework";
      setCategory(historyCategory);
      rememberCategory(memoryKey, historyCategory);
    };

    window.addEventListener("popstate", syncCategoryFromHistory);
    return () => {
      window.cancelAnimationFrame(initialSyncFrame);
      window.removeEventListener("popstate", syncCategoryFromHistory);
    };
  }, [memoryKey]);

  function selectCategory(nextCategory: GradeCategory) {
    if (nextCategory === category) return;
    setCategory(nextCategory);
    rememberCategory(memoryKey, nextCategory);
    writeCategoryToUrl(nextCategory, "pushState");
  }
  const reviewBySource = useMemo(
    () =>
      new Map(
        reviews
          .filter((review) => review.source_result_id)
          .map((review) => [
            `${review.source_type}:${review.source_result_id}`,
            review,
          ]),
      ),
    [reviews],
  );
  const resultsByCategory = useMemo(
    () => ({
      homework: results.filter((result) => result.category === "homework"),
      exam: results.filter((result) => result.category === "exam"),
    }),
    [results],
  );
  const filteredResults = resultsByCategory[category];
  const activeAverage = averageOf(filteredResults);
  const bestResult = [...filteredResults].sort(
    (a, b) => percentage(b) - percentage(a),
  )[0];
  const passedCount = filteredResults.filter((result) => result.passed).length;
  const activeSourceKeys = new Set(
    filteredResults.map(
      (result) => `${result.sourceType}:${result.sourceResultId}`,
    ),
  );
  const pendingReviews = reviews.filter(
    (review) =>
      review.source_result_id &&
      activeSourceKeys.has(`${review.source_type}:${review.source_result_id}`) &&
      (review.status === "pending" || review.status === "reviewing"),
  ).length;
  const passRate = filteredResults.length
    ? (passedCount / filteredResults.length) * 100
    : null;
  const activePresentation = categoryPresentation[category];
  const ActiveIcon = activePresentation.icon;

  return (
    <div className="space-y-5">
      <section
        id="grade-overview"
        aria-labelledby="grade-center-title"
        data-grade-category-selector
        className="scroll-mt-24 space-y-4"
      >
        <header className="flex flex-col gap-4 px-1 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h2
              id="grade-center-title"
              className="text-2xl font-bold tracking-[-0.03em] sm:text-3xl"
            >
              我的成绩
            </h2>
            <p className="app-muted-text mt-2 text-sm font-medium leading-6">
              章节测试请在对应章节内查看。
            </p>
          </div>
          <nav
            className="flex flex-wrap gap-2"
            aria-label="成绩页快捷跳转"
          >
            {[
              ["概览", "#grade-overview"],
              ["能力", "#grade-skills"],
              ["明细", "#grade-details"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] px-4 text-xs font-semibold transition-colors hover:bg-[var(--surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              >
                {label}
              </a>
            ))}
          </nav>
        </header>

        <div
          className="app-card grid grid-cols-2 gap-2 rounded-2xl border bg-[var(--surface-soft)] p-2"
          role="group"
          aria-label="选择成绩类型"
        >
          {(Object.keys(categoryPresentation) as GradeCategory[]).map((key) => {
            const item = categoryPresentation[key];
            const Icon = item.icon;
            const active = category === key;
            return (
              <Button
                key={key}
                type="button"
                variant="outline"
                onClick={() => selectCategory(key)}
                aria-pressed={active}
                className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-left transition-[border-color,background-color,color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] sm:px-4"
                style={{
                  color: active ? item.color : "var(--foreground)",
                  backgroundColor: active
                    ? "var(--card)"
                    : "transparent",
                  borderColor: active ? item.color : "var(--border-subtle)",
                }}
              >
                <Icon size={18} className="shrink-0" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">
                    {item.label}
                  </span>
                  <span className="app-muted-text mt-0.5 hidden text-xs font-medium sm:block">
                    {item.shortLabel}
                  </span>
                </span>
                {active && (
                  <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-semibold">
                    <CheckCircle2 size={13} aria-hidden="true" />
                    当前
                  </span>
                )}
              </Button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <h2
              id="active-grade-overview-title"
              className="text-lg font-bold tracking-tight"
            >
              {activePresentation.label}概览
            </h2>
            <p className="app-muted-text mt-1 text-xs font-medium">
              {scoreLabel(activeAverage)}
            </p>
          </div>
          <span
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            当前查看{activePresentation.label}，共 {filteredResults.length}
            条成绩记录
          </span>
        </div>

        <div className="app-card grid grid-cols-2 overflow-hidden rounded-2xl border xl:grid-cols-4">
          {[
            {
              label: "平均得分率",
              value: activeAverage == null ? "—" : `${activeAverage.toFixed(1)}%`,
              icon: Award,
              color: activePresentation.color,
              soft: activePresentation.soft,
            },
            {
              label: "最高得分率",
              value: bestResult ? `${percentage(bestResult).toFixed(1)}%` : "—",
              icon: Trophy,
              color: "var(--support)",
              soft: "var(--support-surface)",
            },
            {
              label: "达标率",
              value: passRate == null ? "—" : `${passRate.toFixed(0)}%`,
              icon: CheckCircle2,
              color: "var(--status-success)",
              soft: "var(--status-success-surface)",
            },
            {
              label: "复核处理中",
              value: String(pendingReviews),
              icon: SearchCheck,
              color: "var(--status-warning)",
              soft: "var(--status-warning-surface)",
            },
          ].map((item, index) => {
            const Icon = item.icon;
            return (
              <article
                key={item.label}
                className={`${index < 2 ? "border-b" : ""} ${index % 2 === 1 ? "border-l" : ""} flex min-h-24 items-center gap-3 border-[var(--border-subtle)] p-4 xl:border-b-0 ${index > 0 ? "xl:border-l" : "xl:border-l-0"}`}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ color: item.color, backgroundColor: item.soft }}
                >
                  <Icon size={17} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-bold tabular-nums sm:text-xl">
                    {item.value}
                  </p>
                  <p className="app-muted-text mt-1 text-xs font-medium">
                    {item.label}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div id="grade-skills" className="scroll-mt-24">
        <SkillRadar category={category} profile={skillProfiles[category]} />
      </div>

      <section
        id="grade-details"
        aria-labelledby="grade-detail-title"
        className="scroll-mt-24"
      >
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-1">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{
                color: activePresentation.color,
                backgroundColor: activePresentation.soft,
              }}
            >
              <ActiveIcon size={16} aria-hidden="true" />
            </span>
            <div>
              <h2 id="grade-detail-title" className="text-base font-bold">
                {activePresentation.label}成绩明细
              </h2>
              <p className="app-muted-text mt-0.5 text-xs font-medium">
                按最近批改时间排列
              </p>
            </div>
          </div>
          <span className="app-muted-text text-xs font-medium">
            共 {filteredResults.length} 条
          </span>
        </div>

        {filteredResults.length > 0 && (
          <div className="app-card divide-y divide-[var(--border-subtle)] overflow-hidden rounded-2xl border">
            {filteredResults.map((result) => {
            const review = reviewBySource.get(
              `${result.sourceType}:${result.sourceResultId}`,
            );
            const tone = review ? reviewTone(review.status) : null;
            const percent = percentage(result);
            const canRequestAgain =
              !review ||
              review.status === "resolved" ||
              review.status === "rejected";
            return (
              <article
                key={result.key}
                className="p-4 sm:p-5"
              >
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      color: activePresentation.color,
                      backgroundColor: activePresentation.soft,
                    }}
                  >
                    <ActiveIcon size={17} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-xs font-semibold"
                      style={{ color: activePresentation.color }}
                    >
                      {result.courseName} · {result.typeLabel}
                    </p>
                    <h3 className="mt-1 text-sm font-bold leading-5">
                      {result.title}
                    </h3>
                    <p className="app-muted-text mt-1 text-xs font-medium leading-5">
                      {result.subtitle} ·{" "}
                      <LocalDateTime
                        value={result.recordedAt}
                        options={GRADE_DATE_TIME_OPTIONS}
                      />
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xl font-bold tabular-nums sm:text-2xl">
                      {percent.toFixed(1)}%
                    </p>
                    <p className="app-muted-text mt-0.5 text-xs font-medium tabular-nums">
                      {result.score} / {result.totalPoints} 分
                    </p>
                  </div>
                </div>

                <div
                  className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--surface-soft)]"
                  role="progressbar"
                  aria-label={`${result.title}得分率`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Number(percent.toFixed(1))}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${percent}%`,
                      backgroundColor: result.passed
                        ? "var(--status-success)"
                        : "var(--status-warning)",
                    }}
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold"
                    style={{
                      color: result.passed
                        ? "var(--status-success)"
                        : "var(--status-warning)",
                      backgroundColor: result.passed
                        ? "var(--status-success-surface)"
                        : "var(--status-warning-surface)",
                    }}
                  >
                    {result.passed ? (
                      <CheckCircle2 size={12} aria-hidden="true" />
                    ) : (
                      <XCircle size={12} aria-hidden="true" />
                    )}
                    {result.resultLabel}
                  </span>
                  {result.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full px-2.5 py-1.5 text-xs font-semibold"
                      style={{
                        color: languageSkillPresentation[skill].color,
                        backgroundColor: languageSkillPresentation[skill].soft,
                      }}
                    >
                      {languageSkillPresentation[skill].label} ·{" "}
                      {languageSkillPresentation[skill].fullLabel}
                    </span>
                  ))}
                  {review && tone && (
                    <span
                      className="rounded-full px-2.5 py-1.5 text-xs font-semibold"
                      style={{
                        color: tone.color,
                        backgroundColor: tone.background,
                      }}
                    >
                      复核：{GRADE_REVIEW_STATUS_LABELS[review.status]}
                    </span>
                  )}
                </div>

                {(result.feedback || review?.response) && (
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {result.feedback && (
                      <div className="border-l-2 border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5">
                        <p className="app-muted-text text-xs font-semibold">
                          老师评语
                        </p>
                        <p
                          className="mt-1.5 line-clamp-3 text-sm font-medium leading-6"
                          title={result.feedback}
                        >
                          {result.feedback}
                        </p>
                      </div>
                    )}
                    {review?.response && (
                      <div className="border-l-2 border-[var(--status-success)] bg-[var(--status-success-surface)] px-3 py-2.5">
                        <p className="text-xs font-semibold text-[var(--status-success)]">
                          复核回复
                        </p>
                        <p
                          className="mt-1.5 line-clamp-3 text-sm font-medium leading-6"
                          title={review.response}
                        >
                          {review.response}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
                  <Link
                    href={result.href}
                    className="inline-flex min-h-11 items-center gap-1 text-xs font-semibold"
                    style={{ color: "var(--support)" }}
                  >
                    查看原记录
                    <ArrowRight size={12} aria-hidden="true" />
                  </Link>
                  {isStudent && canRequestAgain && (
                    <GradeReviewForm
                      sourceType={result.sourceType}
                      sourceResultId={result.sourceResultId}
                    />
                  )}
                </div>
              </article>
            );
            })}
          </div>
        )}

        {filteredResults.length === 0 && !dataError && (
          <div className="app-card rounded-2xl border border-dashed p-10 text-center">
            <ActiveIcon
              className="mx-auto opacity-30"
              size={34}
              aria-hidden="true"
            />
            <h3 className="mt-3 font-bold">
              暂无{activePresentation.label}成绩
            </h3>
            <p className="app-muted-text mt-2 text-sm font-medium">
              完成并产生成绩后，会自动显示在这里。
            </p>
          </div>
        )}
      </section>

    </div>
  );
}
