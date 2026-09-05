"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  CheckCircle2,
  Languages,
  LoaderCircle,
  MessageCircle,
  PlayCircle,
  Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import { Input } from "@/components/ui/input";

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
  { value: "all", label: "全部" },
  { value: "in_progress", label: "进行中" },
  { value: "not_started", label: "未开始" },
  { value: "completed", label: "已完成" },
  { value: "preparing", label: "内容准备中" },
];

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "korean-basic": Languages,
  "korean-life": MessageCircle,
  "korean-topik": BookOpenCheck,
};

const STATUS_PRESENTATION: Record<
  KoreanCourseLearningStatus,
  { label: string; color: string; soft: string }
> = {
  preparing: {
    label: "内容准备中",
    color: "var(--status-warning)",
    soft: "var(--status-warning-surface)",
  },
  not_started: {
    label: "未开始",
    color: "var(--support)",
    soft: "var(--support-surface)",
  },
  in_progress: {
    label: "进行中",
    color: "var(--primary-hover)",
    soft: "var(--accent)",
  },
  completed: {
    label: "已完成",
    color: "var(--status-success)",
    soft: "var(--status-success-surface)",
  },
};

const COURSE_LEVEL_PRESENTATION = {
  beginner: { label: "入门基础", sequenceLabel: "初级" },
  intermediate: { label: "能力进阶", sequenceLabel: "中级" },
  advanced: { label: "综合提升", sequenceLabel: "高级" },
} as const;

type CourseLevelKey = keyof typeof COURSE_LEVEL_PRESENTATION;

function resolveCourseLevel(level: string | null): CourseLevelKey {
  if (level === "intermediate" || level === "advanced") return level;
  return "beginner";
}

function progressColor(progressPercent: number) {
  if (progressPercent >= 100) return "var(--status-success)";
  if (progressPercent > 0) return "var(--primary)";
  return "var(--foreground-muted)";
}

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("zh-CN");
}

export function KoreanCourseCatalogBrowser({
  sections,
}: {
  sections: KoreanCourseCatalogSection[];
}) {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const deferredSearch = useDeferredValue(search);

  const filteredSections = useMemo(() => {
    const query = normalizeSearch(deferredSearch);
    return sections.map((section) => {
      const filteredCourses = section.courses.filter((course) => {
        const matchesStatus = status === "all" || course.learningStatus === status;
        const searchableText = `${section.title} ${course.title} ${course.description ?? ""}`.toLocaleLowerCase("zh-CN");
        return matchesStatus && (!query || searchableText.includes(query));
      });
      return {
        ...section,
        lessonCount: filteredCourses.reduce(
          (total, course) => total + course.totalLessons,
          0,
        ),
        courses: filteredCourses,
      };
    });
  }, [deferredSearch, sections, status]);

  const visibleSections = filteredSections.filter(
    (section) => section.courses.length > 0,
  );
  const visibleCourseCount = visibleSections.reduce(
    (total, section) => total + section.courses.length,
    0,
  );
  const totalCourseCount = sections.reduce(
    (total, section) => total + section.courses.length,
    0,
  );

  return (
    <>
      <section className="app-card rounded-2xl border p-3 sm:p-4" aria-label="查找和筛选韩语课程">
        <nav aria-label="韩语课程分类" className="flex flex-wrap gap-2">
          {visibleSections.map((section) => {
            const CategoryIcon = CATEGORY_ICONS[section.slug] ?? BookOpen;

            return (
              <a
                key={section.id}
                href={`#course-category-${section.slug}`}
                className="inline-flex min-h-11 flex-1 basis-40 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                style={{ color: "var(--primary-hover)" }}
              >
                <CategoryIcon size={17} aria-hidden="true" />
                <span>{section.title}</span>
                <span className="app-muted-text tabular-nums">{section.courses.length}</span>
              </a>
            );
          })}
        </nav>

        <div className="mt-3 grid gap-3 border-t border-[var(--border-subtle)] pt-3 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.2fr)_auto] lg:items-center">
          <label className="app-input flex min-h-11 items-center gap-2 rounded-xl border px-3 focus-within:ring-2 focus-within:ring-[var(--primary)]">
            <Search size={17} className="shrink-0 text-[var(--foreground-muted)]" aria-hidden="true" />
            <span className="sr-only">搜索韩语课程</span>
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索课程名称或简介"
              className="h-auto min-w-0 flex-1 border-0 bg-transparent px-0 py-0 text-base shadow-none placeholder:text-[var(--foreground-muted)] focus-visible:ring-0 lg:text-sm"
            />
          </label>

          <div
            className="grid grid-cols-2 gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-1 sm:grid-cols-5"
            role="group"
            aria-label="按学习状态筛选课程"
          >
            {FILTERS.map((filter) => {
              const active = status === filter.value;
              return (
                <Button
                  key={filter.value}
                  type="button"
                  variant="ghost"
                  onClick={() => setStatus(filter.value)}
                  aria-pressed={active}
                  className="min-h-10 cursor-pointer rounded-lg px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                  style={{
                    color: active ? "var(--primary-hover)" : "var(--foreground-muted)",
                    backgroundColor: active ? "var(--card)" : "transparent",
                    boxShadow: active ? "var(--shadow-surface)" : "none",
                  }}
                >
                  {filter.label}
                </Button>
              );
            })}
          </div>

          <p className="app-muted-text text-xs font-medium tabular-nums" aria-live="polite">
            显示 {visibleCourseCount} / {totalCourseCount} 门课程
          </p>
        </div>
      </section>

      <div aria-labelledby="korean-course-catalog-title" className="space-y-8">
        {visibleSections.map((section) => {
          const CategoryIcon = CATEGORY_ICONS[section.slug] ?? BookOpen;
          const sectionTitleId = `course-category-title-${section.slug}`;

          return (
            <section
              key={section.id}
              id={`course-category-${section.slug}`}
              aria-labelledby={sectionTitleId}
              className="scroll-mt-28"
            >
              <div
                className="relative mb-4 overflow-hidden rounded-2xl border p-4 sm:p-5"
                style={{
                  borderColor: "var(--border)",
                  background: "linear-gradient(135deg, var(--card), var(--accent))",
                }}
              >
                <span
                  className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-[var(--support-surface)] opacity-50 blur-2xl"
                  aria-hidden="true"
                />
                <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    {section.coverObjectKey ? (
                      <Image
                        src={`/api/course-assets/category/${section.id}`}
                        alt={section.coverAlt || `${section.title}封面`}
                        width={640}
                        height={360}
                        unoptimized
                        className="aspect-video w-24 shrink-0 rounded-xl border border-[var(--border-subtle)] object-cover shadow-sm sm:w-32"
                        style={{ objectPosition: section.coverFocalPoint || "50% 50%" }}
                      />
                    ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--primary-hover)]">
                      <CategoryIcon size={21} aria-hidden="true" />
                    </span>
                    )}
                    <div className="min-w-0">
                      <CardTitleWithHint
                        title={<span id={sectionTitleId}>{section.title}</span>}
                        description={section.description || "课程已按教学顺序编号，可依次学习，也可以自由选择。"}
                        headingLevel={2}
                        titleClassName="text-xl font-bold tracking-tight sm:text-2xl"
                      />
                    </div>
                  </div>
                  <p className="app-muted-text shrink-0 text-xs font-semibold tabular-nums">
                    显示 {section.courses.length} 门课程 · 共 {section.lessonCount} 个课时
                  </p>
                </div>
              </div>

              <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-3">
                {section.courses.map((course) => {
                  const presentation = STATUS_PRESENTATION[course.learningStatus];
                  const levelKey = resolveCourseLevel(course.level);
                  const levelPresentation = COURSE_LEVEL_PRESENTATION[levelKey];
                  const progressTone = course.progressPercent >= 100
                    ? progressColor(course.progressPercent)
                    : "var(--course-level-color)";
                  const buttonLabel =
                    course.learningStatus === "preparing"
                      ? "查看课程介绍"
                      : course.learningStatus === "completed"
                        ? "复习课程"
                        : course.learningStatus === "in_progress"
                          ? "继续学习"
                          : "开始学习";

                  return (
                    <article
                      key={course.id}
                      data-course-level={levelKey}
                      className="korean-level-card group relative flex h-full min-h-[370px] flex-col overflow-hidden rounded-2xl border transition-[border-color,box-shadow] hover:shadow-md"
                    >
                      <span className="course-level-rail" aria-hidden="true" />
                      <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-5">
                        <div className="flex items-start gap-1">
                          <span className="course-level-badge inline-flex min-h-8 items-center gap-2 rounded-full px-3 text-xs font-bold">
                            <span className="tabular-nums">{String(course.sequence).padStart(2, "0")}</span>
                            <span aria-hidden="true">·</span>
                            {levelPresentation.sequenceLabel}
                          </span>
                          {course.coverObjectKey ? (
                            <CardTitleWithHint
                              title={course.title}
                              description={course.description}
                              headingLevel={3}
                              titleClassName="sr-only"
                              hintClassName="!h-8 !w-8 !pt-1"
                              hintLabel={`查看${course.title}课程说明`}
                            />
                          ) : null}
                        </div>
                        <span
                          className="inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold"
                          style={{ color: presentation.color, backgroundColor: presentation.soft }}
                        >
                          {course.learningStatus === "preparing" ? (
                            <LoaderCircle size={13} aria-hidden="true" />
                          ) : course.learningStatus === "completed" ? (
                            <CheckCircle2 size={13} aria-hidden="true" />
                          ) : null}
                          {presentation.label}
                        </span>
                      </div>

                      {course.coverObjectKey && (
                        <div className="course-level-cover relative overflow-hidden border-y border-[var(--border-subtle)] bg-[var(--surface-soft)]">
                          <Image
                            src={`/api/course-assets/course/${course.id}`}
                            alt={course.coverAlt || `${course.title}封面`}
                            loading="lazy"
                            width={640}
                            height={360}
                            unoptimized
                            className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-[1.015] motion-reduce:transition-none"
                            style={{ objectPosition: course.coverFocalPoint || "50% 50%" }}
                          />
                        </div>
                      )}

                      <div className="flex flex-1 flex-col p-5">
                        {!course.coverObjectKey ? (
                          <div className="min-w-0">
                            <p className="course-level-kicker mb-1 text-xs font-bold">
                              第 {course.sequence} 课 · {levelPresentation.label}
                            </p>
                          <CardTitleWithHint
                            title={course.title}
                            description={course.description}
                            headingLevel={3}
                            titleClassName="line-clamp-2 min-h-14 text-xl font-bold leading-7 tracking-tight"
                          />
                          </div>
                        ) : null}

                        <div className="mt-auto">
                          {course.learningStatus === "preparing" ? (
                            <div className="rounded-xl border border-dashed border-[var(--status-warning)] bg-[var(--status-warning-surface)] p-3">
                              <p className="text-xs font-semibold text-[var(--status-warning)]">尚未发布可学习课时</p>
                              <p className="app-muted-text mt-1 text-xs font-medium">课程介绍可以查看，正式内容发布后即可开始。</p>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center justify-between gap-3 text-xs">
                                <span className="app-muted-text font-medium">{course.totalLessons} 个课时</span>
                                <strong className="tabular-nums" style={{ color: progressTone }}>
                                  {course.progressPercent}%
                                </strong>
                              </div>
                              <div
                                className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-soft)]"
                                role="progressbar"
                                aria-label={`${course.title}学习进度`}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={course.progressPercent}
                              >
                                <div
                                  className="h-full rounded-full transition-[width] motion-reduce:transition-none"
                                  style={{ width: `${course.progressPercent}%`, backgroundColor: progressTone }}
                                />
                              </div>
                              <p className="app-muted-text mt-2 text-xs font-medium tabular-nums">
                                已完成 {course.completedLessons} / {course.totalLessons} 个课时
                              </p>
                            </>
                          )}

                          <Link
                            href={course.href}
                            className="course-level-action mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold shadow-sm transition-[filter,box-shadow] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--course-level-color)] focus-visible:ring-offset-2"
                            aria-label={`${buttonLabel}：${course.title}`}
                          >
                            <PlayCircle size={17} aria-hidden="true" />
                            {buttonLabel}
                            <ArrowRight size={15} aria-hidden="true" />
                          </Link>
                        </div>
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
            <Search size={28} className="text-[var(--foreground-muted)]" aria-hidden="true" />
            <h2 className="mt-3 text-base font-bold">没有找到符合条件的课程</h2>
            <p className="app-muted-text mt-1 text-sm font-medium">更换关键词或学习状态后再试。</p>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearch("");
                setStatus("all");
              }}
              className="mt-4 min-h-11 cursor-pointer rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              清除筛选
            </Button>
          </section>
        )}
      </div>
    </>
  );
}
