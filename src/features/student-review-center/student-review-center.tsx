import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Dumbbell,
  Layers3,
  RotateCcw,
} from "lucide-react";

import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import type { StudentReviewItem } from "./types";
import { MasterReviewItemButton } from "./master-review-item-button";

const SOURCE_LABELS: Record<string, string> = {
  chapter_quiz: "章节小测",
  teacher_homework: "老师作业",
  formal_chapter_exam: "正式章节考试",
  stage_exam: "阶段考试",
  midterm_exam: "期中考试",
  final_exam: "期末考试",
  specialized_practice: "专项训练",
  practice_self_check: "巩固自测",
  makeup_exam: "补考",
  student_bookmark: "学生收藏",
  teacher_speaking_writing_feedback: "口语写作建议",
};

const SKILL_LABELS: Record<string, string> = {
  listening: "听力",
  speaking: "口语",
  reading: "阅读",
  writing: "写作",
  grammar: "语法",
  vocabulary: "词汇",
};

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function textValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "是" : "否";
  if (Array.isArray(value)) return value.map(textValue).join("、");
  try {
    return JSON.stringify(value);
  } catch {
    return "—";
  }
}

function firstValue(snapshot: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (snapshot[key] != null && snapshot[key] !== "") return snapshot[key];
  }
  return null;
}

type ReviewCenterRoutes = {
  coursePracticeBaseHref: string;
  skillsBaseHref: string;
  trainingBaseHref: string;
  assignmentsBaseHref: string;
};

function sourceLink(item: StudentReviewItem, routes: ReviewCenterRoutes) {
  const chapterHref = item.courseSlug && item.chapterSlug
    ? `${routes.coursePracticeBaseHref}/${encodeURIComponent(item.courseSlug)}/${encodeURIComponent(item.chapterSlug)}`
    : null;
  if (
    item.sourceType === "specialized_practice"
  ) {
    return item.courseSlug && item.lessonSlug && item.chapterSlug
      ? {
          href: `${routes.trainingBaseHref}/${encodeURIComponent(item.skill)}/${encodeURIComponent(item.courseSlug)}/${encodeURIComponent(item.lessonSlug)}/${encodeURIComponent(item.chapterSlug)}`,
          label: "返回来源专项训练",
        }
      : {
          href: `${routes.skillsBaseHref}/${encodeURIComponent(item.skill)}`,
          label: "查看来源专项训练",
        };
  }
  if (["practice_self_check", "chapter_quiz", "student_bookmark"].includes(item.sourceType)) {
    return chapterHref
      ? { href: chapterHref, label: "返回来源章节巩固" }
      : { href: routes.coursePracticeBaseHref, label: "查看来源课程巩固" };
  }
  if ([
    "teacher_homework",
    "formal_chapter_exam",
    "stage_exam",
    "midterm_exam",
    "final_exam",
    "makeup_exam",
    "teacher_speaking_writing_feedback",
  ].includes(item.sourceType)) {
    return {
      href: `${routes.assignmentsBaseHref}/${encodeURIComponent(item.sourceId)}`,
      label: "查看来源作业或考试",
    };
  }
  return chapterHref
    ? { href: chapterHref, label: "返回来源章节巩固" }
    : { href: routes.coursePracticeBaseHref, label: "查看来源学习内容" };
}

function ReviewItemCard({
  item,
  routes,
}: {
  item: StudentReviewItem;
  routes: ReviewCenterRoutes;
}) {
  const prompt = textValue(
    firstValue(item.contentSnapshot, ["prompt", "blockTitle", "sourceTitle"]),
  );
  const sourceTitle = textValue(item.contentSnapshot.sourceTitle);
  const sourceVersion = textValue(item.contentSnapshot.sourceVersion);
  const studentAnswer = firstValue(item.studentAnswerSnapshot, [
    "answer",
    "selectedValue",
    "reviewTopics",
    "value",
  ]);
  const correctAnswer = firstValue(item.feedbackSnapshot, [
    "correctAnswer",
    "acceptedAnswers",
    "expectedAnswer",
  ]);
  const explanation = firstValue(item.feedbackSnapshot, [
    "explanation",
    "improvementTask",
  ]);
  const teacherComment = firstValue(item.feedbackSnapshot, [
    "teacherComment",
    "overallComment",
  ]);
  const rubric = item.feedbackSnapshot.rubric;
  const lastErrorAt = firstValue(item.feedbackSnapshot, ["lastErrorAt"]);
  const source = sourceLink(item, routes);
  return (
    <article className="app-card flex flex-col rounded-3xl border p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <CardTitleWithHint
          title={prompt}
          description={`${sourceTitle} · 版本 ${sourceVersion}`}
          headingLevel={2}
          titleClassName="text-base font-bold leading-7"
        />
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
          style={{
            color: item.status === "mastered"
              ? "var(--status-success)"
              : "var(--status-warning)",
            backgroundColor: item.status === "mastered"
              ? "var(--status-success-surface)"
              : "var(--status-warning-surface)",
          }}
        >
          {item.status === "mastered" ? (
            <CheckCircle2 size={13} aria-hidden="true" />
          ) : (
            <RotateCcw size={13} aria-hidden="true" />
          )}
          {item.status === "mastered" ? "已重新掌握" : "待复习"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
        <span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1">
          {SOURCE_LABELS[item.sourceType] ?? "学习活动"}
        </span>
        <span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1">
          {SKILL_LABELS[item.skill] ?? item.skill}
        </span>
        <span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1">
          错误或建议 {item.errorCount} 次
        </span>
      </div>

      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-2xl bg-[var(--surface-soft)] p-4">
          <dt className="text-xs font-bold text-[var(--foreground-secondary)]">你的原答案</dt>
          <dd className="mt-2 whitespace-pre-wrap break-words font-medium leading-6">
            {textValue(studentAnswer)}
          </dd>
        </div>
        <div className="rounded-2xl bg-[var(--status-success-surface)] p-4">
          <dt className="text-xs font-bold text-[var(--status-success)]">正确答案或改进建议</dt>
          <dd className="mt-2 whitespace-pre-wrap break-words font-medium leading-6">
            {textValue(correctAnswer ?? explanation)}
          </dd>
        </div>
      </dl>

      {teacherComment || rubric ? (
        <div className="mt-3 rounded-2xl border border-[var(--border-subtle)] p-4 text-sm leading-6">
          {teacherComment ? <p>老师评语：{textValue(teacherComment)}</p> : null}
          {rubric ? <p className="mt-2">评分标准：{textValue(rubric)}</p> : null}
          {explanation ? <p className="mt-2">改进任务：{textValue(explanation)}</p> : null}
        </div>
      ) : explanation && correctAnswer ? (
        <p className="mt-3 rounded-2xl border border-[var(--border-subtle)] p-4 text-sm leading-6">
          {textValue(explanation)}
        </p>
      ) : null}

      <div className="mt-auto flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="text-xs leading-5 text-[var(--foreground-secondary)]">
          <p>{item.courseTitle ?? "未关联课程"} · {item.chapterTitle ?? "未关联章节"}</p>
          <p>
            最近错误或建议：{lastErrorAt
              ? dateFormatter.format(new Date(String(lastErrorAt)))
              : dateFormatter.format(new Date(item.updatedAt))}
          </p>
          {item.lastReviewedAt ? (
            <p>最近复习：{dateFormatter.format(new Date(item.lastReviewedAt))}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {source ? (
            <Link
              href={source.href}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-bold transition-colors hover:bg-[var(--surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              {source.label}
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          ) : null}
          {item.status !== "mastered" ? (
            <MasterReviewItemButton itemId={item.id} />
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function StudentReviewCenter({
  items,
  error,
  ...routes
}: {
  items: StudentReviewItem[];
  error: string | null;
} & ReviewCenterRoutes) {
  const pendingItems = items.filter((item) => item.status !== "mastered");
  const masteredItems = items.filter((item) => item.status === "mastered");
  return (
    <main className="mx-auto w-full max-w-6xl overflow-x-clip px-4 py-6 sm:px-6 lg:px-8">
      <section className="app-card rounded-3xl border p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">错题复习</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">
              复习来自小测、巩固、专项训练和老师批改的待加强内容。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-[var(--surface-soft)] px-4 py-3 text-center">
              <p className="text-xl font-bold tabular-nums">{pendingItems.length}</p>
              <p className="text-xs text-[var(--foreground-secondary)]">待复习</p>
            </div>
            <div className="rounded-2xl bg-[var(--status-success-surface)] px-4 py-3 text-center">
              <p className="text-xl font-bold tabular-nums text-[var(--status-success)]">{masteredItems.length}</p>
              <p className="text-xs text-[var(--foreground-secondary)]">已掌握</p>
            </div>
          </div>
        </div>
        <nav aria-label="巩固板块切换" className="mt-5 flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-4">
          <Link
            href={routes.coursePracticeBaseHref}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <Layers3 size={16} aria-hidden="true" />
            课程巩固
          </Link>
          <Link
            href={routes.skillsBaseHref}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <Dumbbell size={16} aria-hidden="true" />
            专项训练
          </Link>
        </nav>
      </section>

      {error ? (
        <section role="alert" className="mt-5 rounded-2xl border border-[var(--status-warning)] bg-[var(--status-warning-surface)] p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="shrink-0 text-[var(--status-warning)]" size={20} aria-hidden="true" />
            <div>
              <h2 className="font-bold">错题记录加载失败</h2>
              <p className="mt-1 text-sm leading-6">{error}</p>
            </div>
          </div>
        </section>
      ) : null}

      {!error && pendingItems.length === 0 ? (
        <section className="app-card mt-5 rounded-3xl border border-dashed p-10 text-center">
          <BookOpenCheck className="mx-auto opacity-35" size={34} aria-hidden="true" />
          <h2 className="mt-3 font-bold">当前没有待复习内容</h2>
          <p className="mt-2 text-sm text-[var(--foreground-secondary)]">
            后续答错题目或收到老师改进建议时，会自动显示在这里。
          </p>
        </section>
      ) : null}

      {pendingItems.length > 0 ? (
        <section className="mt-6" aria-labelledby="pending-review-title">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={18} className="text-[var(--primary)]" aria-hidden="true" />
            <h2 id="pending-review-title" className="text-xl font-bold">待复习内容</h2>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {pendingItems.map((item) => <ReviewItemCard key={item.id} item={item} routes={routes} />)}
          </div>
        </section>
      ) : null}

      {masteredItems.length > 0 ? (
        <details className="app-card mt-6 rounded-3xl border p-5 sm:p-6">
          <summary className="min-h-11 cursor-pointer py-2 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
            最近重新掌握的内容（{masteredItems.length}）
          </summary>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {masteredItems.map((item) => <ReviewItemCard key={item.id} item={item} routes={routes} />)}
          </div>
        </details>
      ) : null}
    </main>
  );
}
