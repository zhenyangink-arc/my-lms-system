"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  Languages,
  MessageCircle,
  Play,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";

export type KoreanCourseLearningStatus =
  | "preparing"
  | "not_started"
  | "in_progress"
  | "completed";

export type KoreanCourseCatalogItem = {
  id: string;
  sequence: number;
  title: string;
  description: string | null;
  level: string | null;
  coverObjectKey: string | null;
  coverAlt: string | null;
  coverFocalPoint: string | null;
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
  learningStatus: KoreanCourseLearningStatus;
  currentLessonTitle: string | null;
  currentChapterTitle: string | null;
  href: string;
};

export type KoreanCourseCatalogSection = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverObjectKey: string | null;
  coverAlt: string | null;
  coverFocalPoint: string | null;
  lessonCount: number;
  courses: KoreanCourseCatalogItem[];
};

type StatusFilter = "all" | KoreanCourseLearningStatus;

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "全部课程" },
  { value: "in_progress", label: "进行中" },
  { value: "not_started", label: "未开始" },
  { value: "completed", label: "已完成" },
];

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "korean-basic": Languages,
  "korean-life": MessageCircle,
  "korean-topik": BookOpenCheck,
};

const STATUS_LABEL: Record<KoreanCourseLearningStatus, string> = {
  preparing: "内容准备中",
  not_started: "未开始",
  in_progress: "进行中",
  completed: "已完成",
};

function CourseProgress({ course, compact = false }: { course: KoreanCourseCatalogItem; compact?: boolean }) {
  if (course.learningStatus === "preparing") {
    return <p className="text-xs font-semibold text-[var(--status-warning)]">内容准备中</p>;
  }

  return (
    <div className={compact ? "mt-3" : "mt-5"}>
      <div className="flex items-center justify-between gap-3 text-xs font-medium">
        <span className="app-muted-text">已完成 {course.completedLessons} / {course.totalLessons} 课时</span>
        <span className="font-bold tabular-nums text-[var(--foreground)]">{course.progressPercent}%</span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-soft)]"
        role="progressbar"
        aria-label={`${course.title}学习进度`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={course.progressPercent}
      >
        <div
          className="h-full rounded-full bg-[var(--primary)] transition-[width] motion-reduce:transition-none"
          style={{ width: `${course.progressPercent}%` }}
        />
      </div>
    </div>
  );
}

export function KoreanCourseCatalogBrowser({ sections }: { sections: KoreanCourseCatalogSection[] }) {
  const [status, setStatus] = useState<StatusFilter>("all");

  const allCourses = useMemo(() => sections.flatMap((section) => section.courses), [sections]);
  const focusCourse =
    allCourses.find((course) => course.learningStatus === "in_progress") ??
    allCourses.find((course) => course.learningStatus === "not_started") ??
    allCourses.find((course) => course.learningStatus === "completed");

  const filteredSections = useMemo(() => {
    return sections.map((section) => ({
      ...section,
      courses: section.courses.filter(
        (course) => status === "all" || course.learningStatus === status,
      ),
    }));
  }, [sections, status]);

  const visibleSections = filteredSections.filter((section) => section.courses.length > 0);
  const visibleCourseCount = visibleSections.reduce((total, section) => total + section.courses.length, 0);
  return (
    <div className="space-y-8">
      {focusCourse && (
        <section className="app-card overflow-hidden rounded-[2rem] border" aria-labelledby="learning-focus-title">
          <div className="grid lg:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)]">
            <div className="flex min-h-64 flex-col justify-center p-6 sm:p-8">
              <p className="text-sm font-semibold text-[var(--primary-hover)]">
                {focusCourse.learningStatus === "in_progress" ? "接着上次的进度" : "从这里开始"}
              </p>
              <h2 id="learning-focus-title" className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                {focusCourse.title}
              </h2>
              {focusCourse.currentLessonTitle && (
                <div
                  className="mt-4 border-l-2 pl-4"
                  style={{ borderColor: "var(--primary)" }}
                >
                  <p className="text-sm font-semibold sm:text-base">
                    {focusCourse.currentLessonTitle}
                  </p>
                  {focusCourse.currentChapterTitle && (
                    <p className="app-muted-text mt-1 text-sm font-medium">
                      {focusCourse.currentChapterTitle}
                    </p>
                  )}
                </div>
              )}
              <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <CourseProgress course={focusCourse} compact />
                </div>
                <Link
                  href={focusCourse.href}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-bold text-[var(--primary-foreground)] shadow-sm transition hover:bg-[var(--primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
                >
                  <Play size={15} fill="currentColor" aria-hidden="true" />
                  {focusCourse.learningStatus === "in_progress" ? "继续学习" : focusCourse.learningStatus === "completed" ? "复习课程" : "开始学习"}
                </Link>
              </div>
            </div>
            <div className="relative min-h-56 overflow-hidden bg-[var(--surface-soft)] lg:min-h-64">
              {focusCourse.coverObjectKey ? (
                <Image
                  src={`/api/course-assets/course/${focusCourse.id}`}
                  alt={focusCourse.coverAlt || `${focusCourse.title}封面`}
                  fill
                  priority
                  unoptimized
                  sizes="(min-width: 1024px) 38vw, 100vw"
                  className="object-cover"
                  style={{ objectPosition: focusCourse.coverFocalPoint || "50% 50%" }}
                />
              ) : (
                <div className="flex h-full min-h-56 items-center justify-center text-[var(--primary)] lg:min-h-64">
                  <Languages size={64} strokeWidth={1.25} aria-hidden="true" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" aria-hidden="true" />
            </div>
          </div>
        </section>
      )}

      <section aria-labelledby="course-directory-title">
        <div className="border-b border-[var(--border-subtle)] pb-5">
          <h2 id="course-directory-title" className="text-2xl font-bold tracking-tight">课程目录</h2>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="按学习状态筛选课程">
            {FILTERS.map((filter) => {
              const active = status === filter.value;
              return (
                <Button
                  key={filter.value}
                  type="button"
                  variant="ghost"
                  onClick={() => setStatus(filter.value)}
                  aria-pressed={active}
                  className="min-h-10 shrink-0 cursor-pointer rounded-full border px-4 text-sm font-semibold"
                  style={{
                    color: active ? "var(--primary-foreground)" : "var(--foreground-secondary)",
                    backgroundColor: active ? "var(--primary)" : "var(--card)",
                    borderColor: active ? "var(--primary)" : "var(--border-subtle)",
                  }}
                >
                  {filter.label}
                </Button>
              );
            })}
          </div>
          <p className="app-muted-text shrink-0 text-xs font-medium tabular-nums" aria-live="polite">{visibleCourseCount} 门课程</p>
        </div>
      </section>

      <div aria-labelledby="course-directory-title" className="space-y-10">
        {visibleSections.map((section) => {
          const CategoryIcon = CATEGORY_ICONS[section.slug] ?? BookOpen;
          const sectionTitleId = `course-category-title-${section.slug}`;

          return (
            <section key={section.id} aria-labelledby={sectionTitleId}>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--primary-hover)]">
                    <CategoryIcon size={19} aria-hidden="true" />
                  </span>
                  <CardTitleWithHint
                    title={<span id={sectionTitleId}>{section.title}</span>}
                    description={section.description || "课程已按教学顺序排列，可依次学习，也可以自由选择。"}
                    headingLevel={2}
                    titleClassName="text-xl font-bold tracking-tight"
                  />
                </div>
                <span className="app-muted-text shrink-0 text-xs font-medium tabular-nums">{section.courses.length} 门</span>
              </div>

              <div
                className="grid justify-start gap-4"
                style={{
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(min(100%, 300px), 360px))",
                }}
              >
                {section.courses.map((course) => {
                  const actionLabel = course.learningStatus === "in_progress" ? "继续" : course.learningStatus === "completed" ? "复习" : course.learningStatus === "preparing" ? "查看" : "开始";
                  const actionColors =
                    course.learningStatus === "in_progress"
                      ? {
                          backgroundColor: "var(--primary)",
                          color: "var(--primary-foreground)",
                        }
                      : course.learningStatus === "completed"
                        ? {
                            backgroundColor: "var(--status-success-surface)",
                            color: "var(--status-success)",
                          }
                        : course.learningStatus === "preparing"
                          ? {
                              backgroundColor: "var(--status-warning-surface)",
                              color: "var(--status-warning)",
                            }
                          : {
                              backgroundColor: "var(--support-surface)",
                              color: "var(--support)",
                            };

                  return (
                    <article key={course.id} className="app-card group flex h-full flex-col overflow-hidden rounded-2xl border transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-[var(--primary)] hover:shadow-md motion-reduce:transform-none">
                      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[var(--surface-soft)]">
                        {course.coverObjectKey ? (
                          <Image
                            src={`/api/course-assets/course/${course.id}`}
                            alt={course.coverAlt || `${course.title}封面`}
                            fill
                            loading="lazy"
                            unoptimized
                            sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                            className="object-cover transition-transform duration-300 group-hover:scale-[1.025] motion-reduce:transition-none"
                            style={{ objectPosition: course.coverFocalPoint || "50% 50%" }}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[var(--foreground-muted)]"><BookOpen size={30} strokeWidth={1.5} aria-hidden="true" /></div>
                        )}
                        <span
                          className="absolute right-3 top-3 rounded-full border border-white/60 px-2.5 py-1 text-xs font-semibold shadow-sm backdrop-blur-md"
                          style={{ backgroundColor: "color-mix(in srgb, var(--card) 88%, transparent)" }}
                        >
                          {STATUS_LABEL[course.learningStatus]}
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col p-4">
                        <h3 className="sr-only">{course.title}</h3>
                        <div className="mt-auto">
                          <CourseProgress course={course} compact />
                        </div>
                        <Link
                          href={course.href}
                          className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-[filter,box-shadow] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                          style={actionColors}
                          aria-label={`${actionLabel}：${course.title}`}
                        >
                          {actionLabel}<ArrowRight size={15} aria-hidden="true" />
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}

        {visibleCourseCount === 0 && (
          <section className="app-empty-state flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed p-6 text-center">
            <BookOpen size={28} className="text-[var(--foreground-muted)]" aria-hidden="true" />
            <h2 className="mt-3 text-base font-bold">当前状态下没有课程</h2>
            <p className="app-muted-text mt-1 text-sm">切换学习状态后再试。</p>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStatus("all")}
              className="mt-4 min-h-11 cursor-pointer rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--primary-hover)]"
            >
              查看全部课程
            </Button>
          </section>
        )}
      </div>
    </div>
  );
}
