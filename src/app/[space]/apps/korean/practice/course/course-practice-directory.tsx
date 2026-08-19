import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  Dumbbell,
  Layers3,
  LockKeyhole,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Target,
} from "lucide-react";

import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import type { StudentReviewItem } from "@/features/student-review-center/types";
import type {
  CoursePracticeChapter,
  CoursePracticeCourse,
  CoursePracticeStatus,
} from "@/lib/course-practice-catalog";
import { getCoursePracticeDirectoryState } from "@/lib/course-practice-catalog";

const statusPresentation: Record<
  CoursePracticeStatus,
  { label: string; Icon: typeof Circle; color: string; surface: string }
> = {
  not_started: {
    label: "未开始",
    Icon: Circle,
    color: "var(--foreground-muted)",
    surface: "var(--surface-soft)",
  },
  in_progress: {
    label: "巩固中",
    Icon: PlayCircle,
    color: "var(--primary)",
    surface: "var(--accent)",
  },
  needs_review: {
    label: "待加强",
    Icon: AlertTriangle,
    color: "var(--status-warning)",
    surface: "var(--status-warning-surface)",
  },
  mastered: {
    label: "已掌握",
    Icon: CheckCircle2,
    color: "var(--status-success)",
    surface: "var(--status-success-surface)",
  },
  unavailable: {
    label: "未开放",
    Icon: LockKeyhole,
    color: "var(--foreground-muted)",
    surface: "var(--surface-soft)",
  },
  preparing: {
    label: "内容准备中",
    Icon: Clock3,
    color: "var(--support)",
    surface: "var(--support-surface)",
  },
};

const skillLabels: Record<string, string> = {
  listening: "听力",
  speaking: "口语",
  reading: "阅读",
  writing: "写作",
  grammar: "语法",
  vocabulary: "词汇",
};

type Focus = {
  course: CoursePracticeCourse;
  chapter: CoursePracticeChapter;
};

function chapterHref(baseHref: string, focus: Focus) {
  return `${baseHref}/${encodeURIComponent(focus.course.slug)}/${encodeURIComponent(focus.chapter.slug)}`;
}

function reviewTitle(item: StudentReviewItem) {
  for (const key of ["prompt", "blockTitle", "sourceTitle"]) {
    const value = item.contentSnapshot[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return item.chapterTitle ? `${item.chapterTitle}的待复习内容` : "待复习内容";
}

function ActionLink({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold transition focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
      style={{
        color: primary ? "var(--primary-foreground)" : "var(--foreground)",
        borderColor: primary ? "var(--primary)" : "var(--border)",
        backgroundColor: primary ? "var(--primary)" : "var(--card)",
        outlineColor: "var(--primary)",
      }}
    >
      {children}
    </Link>
  );
}

function RefreshLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold transition hover:border-[var(--primary)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
      style={{ borderColor: "var(--border)", outlineColor: "var(--primary)" }}
    >
      <RefreshCw size={16} aria-hidden="true" />
      {label}
    </a>
  );
}

function ChapterCard({
  chapter,
  course,
  baseHref,
}: {
  chapter: CoursePracticeChapter;
  course: CoursePracticeCourse;
  baseHref: string;
}) {
  const presentation = statusPresentation[chapter.status];
  const StatusIcon = presentation.Icon;
  const canEnter = chapter.isOpen && chapter.hasPublishedContent;
  const supportingText = chapter.lockedReason
    ?? (chapter.status === "preparing" ? "已开放，巩固内容发布后即可开始" : null);
  const body = (
    <>
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
        style={{ color: presentation.color, backgroundColor: presentation.surface }}
      >
        <StatusIcon size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold leading-6">{chapter.title}</span>
        <span className="app-muted-text mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5">
          <span>第 {String(chapter.number).padStart(2, "0")} 章</span>
          <span className="inline-flex items-center gap-1 font-bold" style={{ color: presentation.color }}>
            <StatusIcon size={13} aria-hidden="true" />
            {presentation.label}
          </span>
        </span>
        {supportingText ? (
          <span className="mt-1.5 flex items-start gap-1.5 text-xs font-medium leading-5 text-[var(--foreground-secondary)]">
            {chapter.status === "unavailable" ? (
              <LockKeyhole className="mt-0.5 shrink-0" size={13} aria-hidden="true" />
            ) : (
              <Clock3 className="mt-0.5 shrink-0" size={13} aria-hidden="true" />
            )}
            {supportingText}
          </span>
        ) : null}
      </span>
      <span
        className="col-span-2 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-bold sm:col-span-1"
        style={{
          color: canEnter ? "var(--primary)" : presentation.color,
          borderColor: "var(--border)",
          backgroundColor: "var(--card)",
        }}
      >
        {canEnter ? (chapter.status === "not_started" ? "开始" : "继续") : presentation.label}
        {canEnter ? <ArrowRight size={13} aria-hidden="true" /> : <StatusIcon size={13} aria-hidden="true" />}
      </span>
    </>
  );

  return canEnter ? (
    <Link
      href={`${baseHref}/${encodeURIComponent(course.slug)}/${encodeURIComponent(chapter.slug)}`}
      className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-2xl border p-3 transition hover:border-[var(--primary)] hover:shadow-sm focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 sm:grid-cols-[44px_minmax(0,1fr)_auto]"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", outlineColor: "var(--primary)" }}
    >
      {body}
    </Link>
  ) : (
    <article
      className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-2xl border p-3 sm:grid-cols-[44px_minmax(0,1fr)_auto]"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-soft)" }}
    >
      {body}
    </article>
  );
}

export function CoursePracticeDirectory({
  courses,
  baseHref,
  appHref,
  reviewHref,
  skillsHref,
  reviewItems,
}: {
  courses: CoursePracticeCourse[];
  baseHref: string;
  appHref: string;
  reviewHref: string;
  skillsHref: string;
  reviewItems: StudentReviewItem[];
}) {
  const chapters = courses.flatMap((course) => course.chapters);
  const enterableCount = chapters.filter(
    (chapter) => chapter.isOpen && chapter.hasPublishedContent,
  ).length;
  const { focusCourseId, focusChapterId, hasInProgress, expandedCourseId } =
    getCoursePracticeDirectoryState(courses);
  const focusCourse = courses.find((course) => course.id === focusCourseId);
  const focusChapter = focusCourse?.chapters.find(
    (chapter) => chapter.id === focusChapterId,
  );
  const focus = focusCourse && focusChapter
    ? { course: focusCourse, chapter: focusChapter }
    : null;
  const isMasteredFocus = focus?.chapter.status === "mastered";
  const pendingReviewItems = reviewItems.filter((item) => item.status !== "mastered");
  const weakSkillCounts = new Map<string, number>();
  for (const item of pendingReviewItems) {
    weakSkillCounts.set(item.skill, (weakSkillCounts.get(item.skill) ?? 0) + 1);
  }
  const weakSkills = [...weakSkillCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const primaryWeakSkillHref = weakSkills[0]
    ? `${skillsHref}/${encodeURIComponent(weakSkills[0][0])}`
    : skillsHref;

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ color: "var(--primary)", backgroundColor: "var(--accent)" }}>
            <Layers3 size={20} aria-hidden="true" />
          </span>
          <h1 className="text-xl font-bold sm:text-2xl">课程巩固</h1>
        </div>
        <p className="app-muted-text text-sm">{courses.length} 门课程 · {enterableCount} 个可进入章节</p>
      </header>

      <section className="mt-5 overflow-hidden rounded-[28px] border bg-[var(--primary)] p-5 text-[var(--primary-foreground)] sm:p-6" aria-label="当前首要任务">
        {focus ? (
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="min-w-0">
              <CardTitleWithHint
                title={hasInProgress ? "继续巩固" : isMasteredFocus ? "回顾已掌握章节" : "从这里开始"}
                description={hasInProgress ? "已为你定位到最近仍在巩固的章节。" : isMasteredFocus ? "当前章节均已完成，你可以从最近学习的位置开始回顾。" : "当前没有进行中的章节，已为你定位到第一个可开始或待加强的章节。"}
                headingLevel={2}
                titleClassName="text-xl font-bold sm:text-2xl"
                hintLabel="查看当前任务的定位依据"
                tone="inverse"
              />
              <p className="mt-3 text-base font-bold leading-7">{focus.chapter.title}</p>
              <p className="mt-1 text-sm text-white/80">{focus.course.title} · {focus.chapter.lessonTitle}</p>
            </div>
            <Link
              href={chapterHref(baseHref, focus)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-[var(--primary)] transition hover:bg-white/90 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {hasInProgress ? "继续本章" : isMasteredFocus ? "回顾本章" : "开始本章"}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div>
            <CardTitleWithHint
              title="当前没有可进入的章节"
              description="课程可能尚未发布、开放条件尚未满足，或巩固内容仍在准备中。"
              headingLevel={2}
              titleClassName="text-xl font-bold sm:text-2xl"
              tone="inverse"
            />
            <div className="mt-5 flex flex-wrap gap-3">
              <a href={baseHref} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[var(--primary)]">
                <RefreshCw size={16} aria-hidden="true" />刷新开放状态
              </a>
              <Link href={appHref} className="inline-flex min-h-11 items-center rounded-xl border border-white/60 px-4 text-sm font-bold text-white">
                返回韩国语首页
              </Link>
            </div>
          </div>
        )}
      </section>

      {focus ? (
        <>
          <section className="app-card mt-5 rounded-3xl border p-5" aria-label="当前课程与章节">
            <CardTitleWithHint
              title="当前课程与章节"
              description="这里显示本次巩固任务所在的位置和当前状态。"
              headingLevel={2}
              titleClassName="text-lg font-bold"
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="app-soft-card rounded-2xl border p-4">
                <p className="app-muted-text text-xs font-bold">课程</p>
                <p className="mt-2 text-sm font-bold leading-6">{focus.course.title}</p>
              </div>
              <div className="app-soft-card rounded-2xl border p-4">
                <p className="app-muted-text text-xs font-bold">章节</p>
                <p className="mt-2 text-sm font-bold leading-6">第 {focus.chapter.number} 章 · {focus.chapter.title}</p>
              </div>
              <div className="app-soft-card rounded-2xl border p-4">
                <p className="app-muted-text text-xs font-bold">状态</p>
                <p className="mt-2 inline-flex items-center gap-2 text-sm font-bold">
                  {(() => {
                    const StatusIcon = statusPresentation[focus.chapter.status].Icon;
                    return <StatusIcon size={16} aria-hidden="true" />;
                  })()}
                  {statusPresentation[focus.chapter.status].label}
                  {focus.chapter.progressPercent > 0 ? ` · ${Math.round(focus.chapter.progressPercent)}%` : ""}
                </p>
              </div>
            </div>
          </section>

          <section className="app-card mt-5 rounded-3xl border p-5" aria-label="本章尚未完成的项目">
            <CardTitleWithHint
              title="本章尚未完成的项目"
              description="只列出当前发布版本中尚未完成的必做项目。"
              headingLevel={2}
              titleClassName="text-lg font-bold"
            />
            {focus.chapter.remainingItems.length > 0 ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {focus.chapter.remainingItems.map((item) => (
                  <div key={item.id} className="app-soft-card flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 text-sm font-bold">
                    <Circle className="shrink-0 text-[var(--primary)]" size={15} aria-hidden="true" />
                    {item.title}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--status-success-surface)] p-4">
                <p className="inline-flex items-center gap-2 text-sm font-bold text-[var(--status-success)]">
                  <CheckCircle2 size={18} aria-hidden="true" />本章必做项目已完成
                </p>
                <ActionLink href={reviewHref}>去复习错题<ArrowRight size={15} aria-hidden="true" /></ActionLink>
              </div>
            )}
          </section>
        </>
      ) : null}

      <section className="mt-5 grid gap-4 lg:grid-cols-2" aria-label="错题与薄弱能力">
        <article className="app-card rounded-3xl border p-5">
          <CardTitleWithHint
            title="最近错题"
            description="读取统一错题中心中尚未重新掌握的记录。"
            headingLevel={2}
            titleClassName="text-lg font-bold"
          />
          {pendingReviewItems.length > 0 ? (
            <div className="mt-4">
              <p className="text-3xl font-bold tabular-nums">{pendingReviewItems.length}</p>
              <p className="app-muted-text mt-1 text-sm">项待复习</p>
              <div className="mt-3 space-y-2">
                {pendingReviewItems.slice(0, 2).map((item) => (
                  <p key={item.id} className="app-soft-card flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-bold">
                    <RotateCcw className="shrink-0 text-[var(--status-warning)]" size={15} aria-hidden="true" />
                    {reviewTitle(item)}
                  </p>
                ))}
              </div>
              <div className="mt-3">
                <ActionLink href={reviewHref} primary>开始错题复习<ArrowRight size={15} aria-hidden="true" /></ActionLink>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed p-4">
              <p className="flex items-center gap-2 text-sm font-bold"><BookOpenCheck size={17} aria-hidden="true" />当前没有待复习错题</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <ActionLink href={skillsHref}>去专项训练<Dumbbell size={15} aria-hidden="true" /></ActionLink>
                <RefreshLink href={baseHref} label="刷新错题" />
              </div>
            </div>
          )}
        </article>

        <article className="app-card rounded-3xl border p-5">
          <CardTitleWithHint
            title="薄弱能力"
            description="按待复习记录的能力类型汇总，帮助你选择下一项专项训练。"
            headingLevel={2}
            titleClassName="text-lg font-bold"
          />
          {weakSkills.length > 0 ? (
            <div className="mt-4 space-y-2">
              {weakSkills.map(([skill, count]) => (
                <div key={skill} className="app-soft-card flex min-h-11 items-center justify-between rounded-xl border px-3 text-sm font-bold">
                  <span className="inline-flex items-center gap-2"><Target size={16} aria-hidden="true" />{skillLabels[skill] ?? skill}</span>
                  <span>{count} 项</span>
                </div>
              ))}
              <ActionLink href={primaryWeakSkillHref}>练习首要薄弱能力<ArrowRight size={15} aria-hidden="true" /></ActionLink>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed p-4">
              <p className="flex items-center gap-2 text-sm font-bold"><Sparkles size={17} aria-hidden="true" />完成练习后会生成能力建议</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <ActionLink href={skillsHref} primary>开始专项训练<Dumbbell size={15} aria-hidden="true" /></ActionLink>
                <ActionLink href={reviewHref}>查看错题中心<RotateCcw size={15} aria-hidden="true" /></ActionLink>
              </div>
            </div>
          )}
        </article>
      </section>

      <section className="app-card mt-5 rounded-[28px] border p-4 sm:p-5" aria-label="课程目录">
        <CardTitleWithHint
          title="课程目录"
          description="自动展开上次学习所在的课程，其余课程保持折叠。"
          headingLevel={2}
          titleClassName="text-xl font-bold"
        />
        {courses.length === 0 ? (
          <div className="app-soft-card mt-5 rounded-2xl border border-dashed p-8 text-center">
            <Layers3 className="mx-auto opacity-40" size={28} aria-hidden="true" />
            <p className="mt-3 text-sm font-bold">还没有可显示的课程</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <ActionLink href={appHref}>返回韩国语首页</ActionLink>
              <RefreshLink href={baseHref} label="刷新课程" />
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {courses.map((course) => {
              const chapterGroups = new Map<string, { title: string; chapters: CoursePracticeChapter[] }>();
              for (const chapter of course.chapters) {
                const group = chapterGroups.get(chapter.lesson_id) ?? { title: chapter.lessonTitle, chapters: [] };
                group.chapters.push(chapter);
                chapterGroups.set(chapter.lesson_id, group);
              }
              return (
                <details key={course.id} data-course-id={course.id} className="app-card group overflow-hidden rounded-3xl border" open={course.id === expandedCourseId}>
                  <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary)] [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold sm:text-lg">{course.title}</h3>
                        {!course.isOpen ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold" style={{ color: "var(--foreground-muted)", backgroundColor: "var(--surface-soft)" }}>
                            <LockKeyhole size={12} aria-hidden="true" />未开放
                          </span>
                        ) : null}
                      </div>
                      <p className="app-muted-text mt-1 text-xs">{course.chapters.length} 个已发布章节</p>
                    </div>
                    <ChevronDown className="shrink-0 transition-transform group-open:rotate-180" size={18} aria-hidden="true" />
                  </summary>
                  <div className="space-y-5 border-t p-3 sm:p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-soft)" }}>
                    {course.chapters.length === 0 ? (
                      <div className="rounded-2xl border border-dashed p-5 text-center">
                        <p className="text-sm font-bold">本课程暂时没有已发布章节</p>
                        <div className="mt-3 flex flex-wrap justify-center gap-2">
                          <RefreshLink href={baseHref} label="刷新章节" />
                          <ActionLink href={appHref}>返回课程列表</ActionLink>
                        </div>
                      </div>
                    ) : (
                      [...chapterGroups.entries()].map(([lessonId, group]) => (
                        <section key={lessonId} aria-label={group.title}>
                          <h4 className="mb-2 px-1 text-sm font-bold">{group.title}</h4>
                          <div className="space-y-2">
                            {group.chapters.map((chapter) => (
                              <ChapterCard key={chapter.id} chapter={chapter} course={course} baseHref={baseHref} />
                            ))}
                          </div>
                        </section>
                      ))
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
