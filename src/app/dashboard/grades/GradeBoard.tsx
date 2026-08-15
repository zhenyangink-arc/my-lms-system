"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Award,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  FilePenLine,
  GraduationCap,
  SearchCheck,
  Trophy,
  XCircle,
} from "lucide-react";

import { LocalDateTime } from "@/components/LocalDateTime";
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
    color: "var(--app-accent)",
    soft: "var(--app-accent-soft)",
  },
  exam: {
    label: "正式考试",
    shortLabel: "阶段性正式成绩",
    icon: ClipboardCheck,
    color: "var(--app-warm)",
    soft: "var(--app-warm-soft)",
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
      color: "var(--app-success)",
      background: "var(--app-success-soft)",
    };
  }
  if (status === "rejected") {
    return {
      color: "var(--app-muted)",
      background: "var(--app-soft-bg)",
    };
  }
  return {
    color: "var(--app-warm)",
    background: "var(--app-warm-soft)",
  };
}

function percentage(result: GradeResult) {
  return result.totalPoints > 0
    ? Math.max(0, Math.min(100, (result.score / result.totalPoints) * 100))
    : 0;
}

function averageOf(results: GradeResult[]) {
  if (results.length === 0) return null;
  return results.reduce((sum, result) => sum + percentage(result), 0) / results.length;
}

function scoreLabel(value: number | null) {
  if (value == null) return "等待成绩积累";
  if (value >= 90) return "表现优秀";
  if (value >= 80) return "掌握良好";
  if (value >= 60) return "达到基础要求";
  return "需要重点巩固";
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
      eyebrow={`${categoryStyle.label}能力画像`}
      title={`${categoryStyle.label} · 六维学习能力`}
      description={`只使用${categoryStyle.label}中带能力标记的有效逐题得分`}
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
    />
  );
}

export function GradeBoard({
  results,
  reviews,
  skillProfiles,
  isStudent,
  dataError,
}: {
  results: GradeResult[];
  reviews: GradeReview[];
  skillProfiles: Record<GradeCategory, GradeSkillProfileItem[]>;
  isStudent: boolean;
  dataError: boolean;
}) {
  const [category, setCategory] = useState<GradeCategory>(() =>
    results.some((result) => result.category === "homework")
      ? "homework"
      : "exam",
  );
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
  const filteredResults = results.filter(
    (result) => result.category === category,
  );
  const overallAverage = averageOf(results);
  const bestResult = [...results].sort(
    (a, b) => percentage(b) - percentage(a),
  )[0];
  const passedCount = results.filter((result) => result.passed).length;
  const pendingReviews = reviews.filter(
    (review) => review.status === "pending" || review.status === "reviewing",
  ).length;
  const passRate = results.length ? (passedCount / results.length) * 100 : null;
  const activePresentation = categoryPresentation[category];
  const ActiveIcon = activePresentation.icon;

  return (
    <div className="space-y-5">
      <section
        className="app-card relative overflow-hidden rounded-[2rem] border p-5 sm:p-6"
        style={{
          background:
            "linear-gradient(135deg, var(--app-hero-end), var(--app-card-bg) 52%, var(--app-secondary-soft))",
        }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full opacity-40 blur-3xl"
          style={{ backgroundColor: "var(--app-secondary-soft)" }}
        />
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(620px,1.2fr)] xl:items-stretch">
          <div className="flex max-w-xl flex-col justify-center">
            <span
              className="w-fit inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-black tracking-[0.08em]"
              style={{
                color: "var(--app-secondary)",
                backgroundColor: "var(--app-secondary-soft)",
              }}
            >
              <GraduationCap size={14} aria-hidden="true" />
              学习成果总览
            </span>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              {scoreLabel(overallAverage)}
            </h1>
            <p className="app-muted-text mt-3 max-w-lg text-sm font-bold leading-7">
              集中查看老师批改后的作业与正式考试，先了解整体表现，再定位能力强项和需要巩固的方向。
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-[9px] font-black">
              <span className="rounded-full bg-[var(--app-card-bg)] px-3 py-2">
                老师作业 {results.filter((item) => item.category === "homework").length} 项
              </span>
              <span className="rounded-full bg-[var(--app-card-bg)] px-3 py-2">
                正式考试 {results.filter((item) => item.category === "exam").length} 项
              </span>
              <span className="rounded-full bg-[var(--app-card-bg)] px-3 py-2 text-[var(--app-muted)]">
                章节测试在章节内查看
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1.1fr_1fr_1fr]">
            <article className="app-soft-card col-span-2 flex min-h-40 items-center gap-5 rounded-3xl border p-5 sm:col-span-1 sm:row-span-2 sm:flex-col sm:items-start sm:justify-between">
              <div>
                <p className="app-muted-text text-[10px] font-black tracking-[0.08em]">
                  综合平均得分率
                </p>
                <p className="mt-2 text-3xl font-black tabular-nums sm:text-4xl">
                  {overallAverage == null ? "—" : overallAverage.toFixed(1)}
                  {overallAverage != null && (
                    <span className="ml-1 text-sm text-[var(--app-muted)]">%</span>
                  )}
                </p>
                <p className="mt-1 text-[10px] font-black text-[var(--app-accent)]">
                  {scoreLabel(overallAverage)}
                </p>
              </div>
              <div
                role="img"
                aria-label={
                  overallAverage == null
                    ? "暂无综合平均成绩"
                    : `综合平均得分率 ${overallAverage.toFixed(1)}%`
                }
                className="relative ml-auto flex h-20 w-20 shrink-0 items-center justify-center rounded-full sm:ml-0"
                style={{
                  background: `conic-gradient(var(--app-accent) ${overallAverage ?? 0}%, var(--app-soft-bg) 0)`,
                }}
              >
                <span className="absolute inset-[7px] rounded-full bg-[var(--app-card-bg)]" />
                <BarChart3
                  size={20}
                  aria-hidden="true"
                  className="relative text-[var(--app-accent)]"
                />
              </div>
            </article>

            {[
              {
                label: "最高得分率",
                value: bestResult ? `${percentage(bestResult).toFixed(1)}%` : "—",
                icon: Trophy,
                color: "var(--app-warm)",
                soft: "var(--app-warm-soft)",
              },
              {
                label: "达标率",
                value: passRate == null ? "—" : `${passRate.toFixed(0)}%`,
                icon: CheckCircle2,
                color: "var(--app-success)",
                soft: "var(--app-success-soft)",
              },
              {
                label: "复核处理中",
                value: `${pendingReviews}`,
                icon: SearchCheck,
                color: "var(--app-secondary)",
                soft: "var(--app-secondary-soft)",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.label}
                  className="app-soft-card flex min-w-0 items-center gap-3 rounded-2xl border p-3.5"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ color: item.color, backgroundColor: item.soft }}
                  >
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-base font-black tabular-nums">
                      {item.value}
                    </p>
                    <p className="app-muted-text mt-1 text-[9px] font-black leading-4">
                      {item.label}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section aria-labelledby="category-skill-profile-title">
        <div className="mb-3 px-1">
          <p className="text-[10px] font-black tracking-[0.12em] text-[var(--app-accent)]">
            分类能力画像
          </p>
          <h2 id="category-skill-profile-title" className="mt-1 text-lg font-black tracking-tight">
            老师作业与正式考试分别分析
          </h2>
          <p className="app-muted-text mt-1 text-xs font-bold">
            两类成绩互不混算，分别生成六边形学习能力
          </p>
        </div>
        <div className="grid gap-5 2xl:grid-cols-2">
          <SkillRadar category="homework" profile={skillProfiles.homework} />
          <SkillRadar category="exam" profile={skillProfiles.exam} />
        </div>
      </section>

      <section className="app-card rounded-[2rem] border p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-black tracking-[0.12em] text-[var(--app-accent)]">
              成绩分类
            </p>
            <h2 className="mt-1 text-lg font-black tracking-tight">
              选择要查看的成绩类型
            </h2>
            <p className="app-muted-text mt-1 text-xs font-bold">
              作业用于观察日常掌握，考试用于确认阶段成果
            </p>
          </div>
          <p className="app-muted-text text-xs font-black">
            共 {results.length} 条成绩
          </p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {(Object.keys(categoryPresentation) as GradeCategory[]).map((key) => {
            const item = categoryPresentation[key];
            const Icon = item.icon;
            const active = category === key;
            const categoryResults = results.filter(
              (result) => result.category === key,
            );
            const categoryAverage = averageOf(categoryResults);
            const categoryPassed = categoryResults.filter(
              (result) => result.passed,
            ).length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                aria-pressed={active}
                className="app-soft-card group relative min-h-36 overflow-hidden rounded-3xl border p-4 text-left transition hover:border-[var(--app-accent)] sm:p-5"
                style={{
                  backgroundColor: active ? item.soft : "var(--app-card-bg)",
                  borderColor: active ? item.color : "var(--app-border-soft)",
                  boxShadow: active ? `0 0 0 1px ${item.color}` : undefined,
                }}
              >
                <span
                  aria-hidden="true"
                  className="absolute -bottom-14 -right-12 h-40 w-40 rounded-full opacity-40"
                  style={{ backgroundColor: item.soft }}
                />
                <span className="relative flex items-start gap-4">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                    style={{ color: item.color, backgroundColor: item.soft }}
                  >
                    <Icon size={19} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                      <span>
                        <span className="block text-base font-black">
                          {item.label}
                        </span>
                        <span className="app-muted-text mt-1 block text-[10px] font-bold">
                          {item.shortLabel}
                        </span>
                      </span>
                      <span className="text-right" style={{ color: item.color }}>
                        <span className="block text-2xl font-black tabular-nums">
                          {categoryResults.length}
                        </span>
                        <span className="mt-0.5 block text-[8px] font-black">
                          条记录
                        </span>
                      </span>
                    </span>
                    <span className="mt-4 grid grid-cols-2 gap-2">
                      <span className="rounded-xl bg-[var(--app-card-bg)]/80 px-3 py-2">
                        <span className="app-muted-text block text-[8px] font-black">平均得分率</span>
                        <span className="mt-1 block text-xs font-black">
                          {categoryAverage == null ? "—" : `${categoryAverage.toFixed(1)}%`}
                        </span>
                      </span>
                      <span className="rounded-xl bg-[var(--app-card-bg)]/80 px-3 py-2">
                        <span className="app-muted-text block text-[8px] font-black">达标记录</span>
                        <span className="mt-1 block text-xs font-black">
                          {categoryPassed} / {categoryResults.length}
                        </span>
                      </span>
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="app-card rounded-[2rem] border p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
          <div className="flex items-center gap-2">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{
                color: activePresentation.color,
                backgroundColor: activePresentation.soft,
              }}
            >
              <ActiveIcon size={15} />
            </span>
            <div>
              <h3 className="text-sm font-black">
                {activePresentation.label}成绩明细
              </h3>
              <p className="app-muted-text text-[10px] font-bold">
                按最近批改时间排列
              </p>
            </div>
          </div>
          {averageOf(filteredResults) != null && (
            <span
              className="rounded-full px-3 py-1.5 text-[10px] font-black"
              style={{
                color: activePresentation.color,
                backgroundColor: activePresentation.soft,
              }}
            >
              当前分类平均 {averageOf(filteredResults)?.toFixed(1)}%
            </span>
          )}
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
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
                className="app-card flex h-full flex-col overflow-hidden rounded-3xl border"
              >
                <div className="flex items-start gap-3 border-b border-[var(--app-border-soft)] px-5 py-4">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      color: activePresentation.color,
                      backgroundColor: activePresentation.soft,
                    }}
                  >
                    <ActiveIcon size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black" style={{ color: activePresentation.color }}>
                      {result.courseName} · {result.typeLabel}
                    </p>
                    <h4 className="mt-1 text-sm font-black leading-5">
                      {result.title}
                    </h4>
                    <p className="app-muted-text mt-1 text-[9px] font-bold">
                      {result.subtitle} · <LocalDateTime value={result.recordedAt} options={GRADE_DATE_TIME_OPTIONS} />
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-2xl font-black tabular-nums">
                      {result.score}
                      <span className="app-muted-text text-[10px]">
                        /{result.totalPoints}
                      </span>
                    </p>
                    <p className="app-muted-text mt-0.5 text-[9px] font-black">
                      {percent.toFixed(1)}%
                    </p>
                  </div>
                </div>

                <div className="flex flex-1 flex-col px-5 py-4">
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--app-soft-bg)]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${percent}%`,
                        backgroundColor: result.passed
                          ? "var(--app-success)"
                          : "var(--app-warm)",
                      }}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[9px] font-black"
                      style={{
                        color: result.passed
                          ? "var(--app-success)"
                          : "var(--app-warm)",
                        backgroundColor: result.passed
                          ? "var(--app-success-soft)"
                          : "var(--app-warm-soft)",
                      }}
                    >
                      {result.passed ? (
                        <CheckCircle2 size={10} />
                      ) : (
                        <XCircle size={10} />
                      )}
                      {result.resultLabel}
                    </span>
                    {result.skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full px-2.5 py-1.5 text-[9px] font-black"
                        style={{
                          color: languageSkillPresentation[skill].color,
                          backgroundColor: languageSkillPresentation[skill].soft,
                        }}
                      >
                        {languageSkillPresentation[skill].label} · {languageSkillPresentation[skill].fullLabel}
                      </span>
                    ))}
                    {review && tone && (
                      <span
                        className="rounded-full px-2.5 py-1.5 text-[9px] font-black"
                        style={{ color: tone.color, backgroundColor: tone.background }}
                      >
                        复核：{GRADE_REVIEW_STATUS_LABELS[review.status]}
                      </span>
                    )}
                  </div>

                  {result.feedback && (
                    <div className="mt-4 rounded-2xl bg-[var(--app-soft-bg)] px-4 py-3">
                      <p className="app-muted-text text-[9px] font-black">
                        老师评语
                      </p>
                      <p className="mt-1.5 line-clamp-3 text-xs font-bold leading-5">
                        {result.feedback}
                      </p>
                    </div>
                  )}
                  {review?.response && (
                    <div className="mt-3 rounded-2xl bg-[var(--app-success-soft)] px-4 py-3">
                      <p className="text-[9px] font-black text-[var(--app-success)]">
                        复核回复
                      </p>
                      <p className="mt-1.5 text-xs font-bold leading-5">
                        {review.response}
                      </p>
                    </div>
                  )}

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[var(--app-border-soft)] pt-4">
                    <Link
                      href={result.href}
                      className="inline-flex items-center gap-1 text-[10px] font-black"
                      style={{ color: "var(--app-secondary)" }}
                    >
                      查看原记录
                      <ArrowRight size={10} />
                    </Link>
                    {isStudent && canRequestAgain && (
                      <GradeReviewForm
                        sourceType={result.sourceType}
                        sourceResultId={result.sourceResultId}
                      />
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {filteredResults.length === 0 && !dataError && (
          <div className="app-card rounded-3xl border border-dashed p-10 text-center">
            <ActiveIcon className="mx-auto opacity-30" size={34} />
            <h3 className="mt-3 font-black">
              暂无{activePresentation.label}成绩
            </h3>
            <p className="app-muted-text mt-2 text-xs">
              完成并产生成绩后，会自动显示在这里。
            </p>
          </div>
        )}
      </section>

      <section className="app-soft-card flex items-center gap-3 rounded-2xl border p-4">
        <Award size={18} className="shrink-0 text-[var(--app-secondary)]" />
        <p className="app-muted-text text-[10px] font-bold leading-5">
          六维能力画像只使用有明确能力标记的逐题成绩；没有标记的成绩仍会出现在成绩明细中，但不会被强行计入听、说、读、写、词汇或语法分析。
        </p>
      </section>
    </div>
  );
}
