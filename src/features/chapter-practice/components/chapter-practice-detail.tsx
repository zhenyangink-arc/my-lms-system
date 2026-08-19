"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  Circle,
  CircleDot,
  CloudOff,
  Dumbbell,
  Ear,
  GitCompareArrows,
  ListChecks,
  LoaderCircle,
  Mic,
  PenLine,
  RotateCcw,
  Shapes,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  KnowledgeInteractionLab,
  type KnowledgeInteractionType,
} from "@/app/dashboard/progress/KnowledgeInteractionLab";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import { updateStudentChapterPracticeProgressAction } from "../progress-actions";
import {
  readLegacyInteractionProgress,
  readStudentPracticeProgressCache,
  writeStudentPracticeProgressCache,
} from "../student/progress-cache";
import {
  calculateStudentPracticeProgress,
  emptyStudentPracticeProgress,
  mergeProgressSnapshots,
} from "../student/progress-model";
import {
  isHangulPracticeChapter,
  orderPublishedChapterPracticeBlocks,
} from "../student/model";
import type {
  PublishedChapterPracticeBlock,
  PublishedChapterPracticeUnit,
  StudentChapterPracticeProgress,
} from "../student/types";
import { ChapterPracticeSelfCheck } from "./chapter-practice-self-check";
import { PublishedBlockContent } from "./published-block-content";

const ALL_INTERACTIONS: KnowledgeInteractionType[] = [
  "assemble",
  "deconstruct",
  "repair",
  "classify",
];

const BLOCK_ICONS: Record<string, LucideIcon> = {
  overview: BookOpenCheck,
  vocabulary: ListChecks,
  grammar: Shapes,
  comparison: GitCompareArrows,
  interaction: Shapes,
  listening: Ear,
  speaking: Mic,
  reading: BookOpenCheck,
  writing: PenLine,
  review: RotateCcw,
  self_check: CheckCircle2,
};

function BlockState({ completed }: { completed: boolean }) {
  const Icon = completed ? CheckCircle2 : Circle;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
      style={{
        color: completed ? "var(--status-success)" : "var(--foreground-secondary)",
        backgroundColor: completed
          ? "var(--status-success-surface)"
          : "var(--surface-soft)",
      }}
    >
      <Icon size={13} aria-hidden="true" />
      {completed ? "已复习" : "待复习"}
    </span>
  );
}

function PracticeBlockCard({
  block,
  completed,
  onComplete,
  onListeningPlay,
  onListeningProgress,
}: {
  block: PublishedChapterPracticeBlock;
  completed: boolean;
  onComplete: () => void;
  onListeningPlay: () => void;
  onListeningProgress: (progress: StudentChapterPracticeProgress) => void;
}) {
  const Icon = BLOCK_ICONS[block.blockType] ?? CircleDot;
  return (
    <section
      id={`practice-block-${block.id}`}
      className="scroll-mt-6 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[var(--primary)]">
            <Icon size={19} aria-hidden="true" />
          </span>
          <CardTitleWithHint
            title={block.title}
            description={block.instructions}
            headingLevel={2}
            titleClassName="text-lg font-bold leading-7"
          />
        </div>
        <BlockState completed={completed} />
      </div>

      <div className="mt-5">
        <PublishedBlockContent
          block={block}
          onListeningPlay={onListeningPlay}
          onListeningProgress={onListeningProgress}
        />
      </div>
      <button
        type="button"
        aria-pressed={completed}
        disabled={completed}
        onClick={onComplete}
        className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-bold transition-colors hover:bg-[var(--surface-soft)] disabled:cursor-default disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        {completed ? (
          <CheckCircle2 size={16} aria-hidden="true" />
        ) : (
          <Circle size={16} aria-hidden="true" />
        )}
        {completed ? "已完成本块" : "标记本块已复习"}
      </button>
    </section>
  );
}

function HangulInteractionSection({
  block,
  mastered,
  onMasteryChange,
}: {
  block: PublishedChapterPracticeBlock;
  mastered: ReadonlySet<KnowledgeInteractionType>;
  onMasteryChange: (type: KnowledgeInteractionType) => void;
}) {
  return (
    <section
      id={`practice-block-${block.id}`}
      className="scroll-mt-6 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <CardTitleWithHint
          title={block.title || "字母拼合互动"}
          description={block.instructions}
          headingLevel={2}
          titleClassName="text-lg font-bold"
        />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-xs font-bold text-[var(--foreground-secondary)]">
          <CheckCircle2 size={13} aria-hidden="true" />
          已掌握 {mastered.size}/4 类
        </span>
      </div>
      <div className="mt-5">
        <KnowledgeInteractionLab
          initialMastered={mastered}
          onMasteryChange={onMasteryChange}
        />
      </div>
    </section>
  );
}

type ProgressMutation = {
  kind:
    | "complete_block"
    | "self_check"
    | "listening_attempt"
    | "listening_play"
    | "interaction_complete";
  blockId: string;
  correctCount?: number;
  attemptCount?: number;
  reviewTopics?: string[];
};

export function ChapterPracticeDetail({
  unit,
  courseKey,
  courseTitle,
  chapterNumber,
  chapterTitle,
  chapterSlug,
  backHref,
  chapterTestHref,
  skillsHref,
  reviewHref,
  cacheKey,
  initialProgress,
  chapterTestPassed,
  chapterTestAvailable,
}: {
  unit: PublishedChapterPracticeUnit;
  courseKey: string;
  courseTitle: string;
  chapterNumber: number;
  chapterTitle: string;
  chapterSlug: string;
  backHref: string;
  chapterTestHref: string;
  skillsHref: string;
  reviewHref: string;
  cacheKey: string;
  initialProgress: StudentChapterPracticeProgress | null;
  chapterTestPassed: boolean;
  chapterTestAvailable: boolean;
}) {
  const blocks = useMemo(
    () => orderPublishedChapterPracticeBlocks(unit.blocks),
    [unit.blocks],
  );
  const isHangulChapter = useMemo(
    () => isHangulPracticeChapter({ courseKey, blocks }),
    [blocks, courseKey],
  );
  const emptyProgress = useMemo(
    () =>
      calculateStudentPracticeProgress({
        facts: emptyStudentPracticeProgress(unit.id),
        blocks,
        completionRule: unit.completionRule,
        chapterTestPassed,
        chapterTestAvailable,
      }),
    [blocks, chapterTestAvailable, chapterTestPassed, unit.completionRule, unit.id],
  );
  const [progress, setProgress] = useState(
    () => initialProgress ?? emptyProgress,
  );
  const progressRef = useRef(progress);
  const [masteredInteractions, setMasteredInteractions] = useState<
    Set<KnowledgeInteractionType>
  >(() => new Set());
  const masteredRef = useRef(masteredInteractions);
  const [syncError, setSyncError] = useState("");
  const [isSyncPending, startSyncTransition] = useTransition();
  const interactionBlock = blocks.find(
    (block) => block.blockType === "interaction",
  );
  const selfCheck = blocks.find((block) => block.blockType === "self_check");
  const contentBlocks = blocks.filter(
    (block) =>
      block.blockType !== "self_check" &&
      !(isHangulChapter && block.id === interactionBlock?.id),
  );

  function cacheProgress(
    next: StudentChapterPracticeProgress,
    pending: boolean,
    interactions = masteredRef.current,
  ) {
    writeStudentPracticeProgressCache(cacheKey, {
      progress: next,
      pending,
      masteredInteractions: [...interactions],
    });
  }

  function acceptProgress(
    next: StudentChapterPracticeProgress,
    pending: boolean,
  ) {
    progressRef.current = next;
    setProgress(next);
    cacheProgress(next, pending);
  }

  function sendMutation(
    input:
      | (ProgressMutation & { practiceUnitId: string })
      | {
          practiceUnitId: string;
          kind: "cache_merge" | "legacy_import";
          snapshot: StudentChapterPracticeProgress;
        },
  ) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSyncError("当前离线，进度已保存在本机，联网后会自动同步。");
      return;
    }
    startSyncTransition(async () => {
      try {
        const response = await updateStudentChapterPracticeProgressAction(input);
        if (!response.ok) {
          setSyncError(`${response.message} 已保留本机进度，联网后可重试。`);
          return;
        }
        const local = progressRef.current;
        const merged = mergeProgressSnapshots({
          server: response.progress,
          local,
        });
        const serverTime = Date.parse(response.progress.lastPracticedAt ?? "");
        const localTime = Date.parse(local.lastPracticedAt ?? "");
        const stillPending =
          Number.isFinite(localTime) &&
          (!Number.isFinite(serverTime) || localTime > serverTime);
        acceptProgress(merged, stillPending);
        setSyncError("");
      } catch {
        setSyncError("网络暂不可用，进度已保存在本机，联网后会自动同步。");
      }
    });
  }

  function recordMutation(mutation: ProgressMutation) {
    const current = progressRef.current;
    if (
      mutation.kind === "complete_block" &&
      current.completedBlockIds.includes(mutation.blockId)
    ) {
      return;
    }
    const now = new Date().toISOString();
    const completedBlockIds = new Set(current.completedBlockIds);
    if (
      [
        "complete_block",
        "self_check",
        "interaction_complete",
      ].includes(mutation.kind)
    ) {
      completedBlockIds.add(mutation.blockId);
    }
    let next = calculateStudentPracticeProgress({
      facts: {
        ...current,
        completedBlockIds: [...completedBlockIds],
        lastBlockId: mutation.blockId,
        correctCount: current.correctCount + (mutation.correctCount ?? 0),
        attemptCount: current.attemptCount + (mutation.attemptCount ?? 0),
        startedAt: current.startedAt ?? now,
        lastPracticedAt: now,
      },
      blocks,
      completionRule: unit.completionRule,
      chapterTestPassed,
      chapterTestAvailable,
    });
    if (next.progressPercent >= 100 && !next.completedAt) {
      next = { ...next, completedAt: now };
    }
    acceptProgress(next, true);
    sendMutation({ practiceUnitId: unit.id, ...mutation });
  }

  useEffect(() => {
    const cached = readStudentPracticeProgressCache(cacheKey);
    const completedInteraction = Boolean(
      interactionBlock &&
        initialProgress?.completedBlockIds.includes(interactionBlock.id),
    );
    const cachedInteractions = completedInteraction
      ? ALL_INTERACTIONS
      : cached?.masteredInteractions ?? [];
    masteredRef.current = new Set(cachedInteractions);
    // 本地缓存属于挂载后读取的外部快照。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMasteredInteractions(new Set(cachedInteractions));

    if (cached) {
      const merged = mergeProgressSnapshots({
        server: initialProgress,
        local: cached.progress,
      });
      acceptProgress(merged, merged !== initialProgress && cached.pending);
      if (merged !== initialProgress) {
        sendMutation({
          practiceUnitId: unit.id,
          kind: "cache_merge",
          snapshot: merged,
        });
      }
      return;
    }

    if (initialProgress) {
      acceptProgress(initialProgress, false);
      return;
    }

    const legacyInteractions = readLegacyInteractionProgress(chapterSlug);
    if (!legacyInteractions.length) {
      acceptProgress(emptyProgress, false);
      return;
    }
    const legacySet = new Set(legacyInteractions);
    masteredRef.current = legacySet;
    setMasteredInteractions(legacySet);
    const now = new Date().toISOString();
    const legacyCompleted =
      interactionBlock && legacySet.size === ALL_INTERACTIONS.length
        ? [interactionBlock.id]
        : [];
    const imported = calculateStudentPracticeProgress({
      facts: {
        ...emptyProgress,
        completedBlockIds: legacyCompleted,
        lastBlockId: legacyCompleted[0] ?? null,
        startedAt: now,
        lastPracticedAt: now,
      },
      blocks,
      completionRule: unit.completionRule,
      chapterTestPassed,
      chapterTestAvailable,
    });
    acceptProgress(imported, true);
    sendMutation({
      practiceUnitId: unit.id,
      kind: "legacy_import",
      snapshot: imported,
    });
    // 初始服务端快照或巩固版本变化时重新执行；交互中的状态不作为依赖。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, unit.id]);

  useEffect(() => {
    function synchronizePendingCache() {
      const cached = readStudentPracticeProgressCache(cacheKey);
      if (!cached?.pending) return;
      sendMutation({
        practiceUnitId: unit.id,
        kind: "cache_merge",
        snapshot: cached.progress,
      });
    }
    window.addEventListener("online", synchronizePendingCache);
    return () => window.removeEventListener("online", synchronizePendingCache);
    // sendMutation 始终通过 ref 读取最新快照，避免反复注册监听器。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, unit.id]);

  const completedCount = progress.completedBlockIds.filter((id) =>
    blocks.some((block) => block.id === id),
  ).length;
  const accuracy = progress.attemptCount
    ? Math.round((progress.correctCount / progress.attemptCount) * 100)
    : null;
  const statusLabel = {
    not_started: "未开始",
    in_progress: "巩固中",
    needs_reinforcement: "待加强",
    mastered: "已掌握",
  }[progress.status];
  const StatusIcon =
    progress.status === "mastered"
      ? CheckCircle2
      : progress.status === "needs_reinforcement"
        ? AlertTriangle
        : progress.status === "in_progress"
          ? CircleDot
          : Circle;

  return (
    <div className="space-y-5">
      <Link
        href={backHref}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-bold text-[var(--foreground-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        返回课程巩固目录
      </Link>

      <nav
        aria-label="巩固板块切换"
        className="flex flex-wrap gap-2"
      >
        <Link
          href={skillsHref}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-bold transition-colors hover:bg-[var(--surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <Dumbbell size={16} aria-hidden="true" />
          练习本章专项能力
        </Link>
        <Link
          href={reviewHref}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-bold transition-colors hover:bg-[var(--surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <RotateCcw size={16} aria-hidden="true" />
          查看错题复习
        </Link>
      </nav>

      <header className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--primary)]">
              {courseTitle} · 第 {chapterNumber} 章
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              {chapterTitle}
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[var(--foreground-secondary)]">
              {unit.title}。页面仅展示本章当前已发布且启用的巩固内容。
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 md:w-auto md:shrink-0 sm:grid-cols-4">
            <div className="rounded-2xl bg-[var(--surface-soft)] px-3 py-2.5">
              <p className="text-xs font-bold text-[var(--foreground-secondary)]">巩固进度</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{progress.progressPercent}%</p>
            </div>
            <div className="rounded-2xl bg-[var(--surface-soft)] px-3 py-2.5">
              <p className="text-xs font-bold text-[var(--foreground-secondary)]">练习正确率</p>
              <p className="mt-1 text-lg font-bold tabular-nums">
                {accuracy === null ? "暂无" : `${accuracy}%`}
              </p>
            </div>
            <div className="rounded-2xl bg-[var(--surface-soft)] px-3 py-2.5">
              <p className="text-xs font-bold text-[var(--foreground-secondary)]">掌握度</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{progress.masteryPercent}%</p>
            </div>
            <div className="rounded-2xl bg-[var(--surface-soft)] px-3 py-2.5">
              <p className="text-xs font-bold text-[var(--foreground-secondary)]">当前状态</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-bold">
                <StatusIcon size={16} aria-hidden="true" />
                {statusLabel}
              </p>
            </div>
          </div>
        </div>
        <div
          className="mt-4 flex items-center gap-2 text-xs font-medium text-[var(--foreground-secondary)]"
          role="status"
          aria-live="polite"
        >
          {isSyncPending ? (
            <LoaderCircle className="animate-spin motion-reduce:animate-none" size={14} aria-hidden="true" />
          ) : syncError ? (
            <CloudOff size={14} aria-hidden="true" />
          ) : (
            <CheckCircle2 size={14} aria-hidden="true" />
          )}
          {isSyncPending
            ? "正在同步学习进度"
            : syncError || "学习进度已保存，可在其他设备继续"}
        </div>
      </header>

      <nav
        aria-label="本章巩固内容"
        className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3"
      >
        <ul className="flex flex-wrap gap-2">
          {blocks.map((block) => (
            <li key={block.id}>
              <a
                href={`#practice-block-${block.id}`}
                className="inline-flex min-h-11 items-center rounded-xl bg-[var(--surface-soft)] px-3 text-xs font-bold transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                {block.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <main id="practice-content" className="space-y-5">
        {contentBlocks.map((block) => (
          <PracticeBlockCard
            key={block.id}
            block={block}
            completed={progress.completedBlockIds.includes(block.id)}
            onComplete={() =>
              recordMutation({ kind: "complete_block", blockId: block.id })
            }
            onListeningPlay={() =>
              recordMutation({ kind: "listening_play", blockId: block.id })
            }
            onListeningProgress={(savedProgress) => {
              acceptProgress(savedProgress, false);
              setSyncError("");
            }}
          />
        ))}

        {isHangulChapter && interactionBlock ? (
          <HangulInteractionSection
            block={interactionBlock}
            mastered={masteredInteractions}
            onMasteryChange={(type) => {
              const next = new Set(masteredRef.current).add(type);
              masteredRef.current = next;
              setMasteredInteractions(next);
              cacheProgress(progressRef.current, true, next);
              if (
                next.size === ALL_INTERACTIONS.length &&
                !progressRef.current.completedBlockIds.includes(interactionBlock.id)
              ) {
                recordMutation({
                  kind: "interaction_complete",
                  blockId: interactionBlock.id,
                });
              }
            }}
          />
        ) : null}

        {selfCheck ? (
          <ChapterPracticeSelfCheck
            block={selfCheck}
            chapterTitle={chapterTitle}
            backHref={backHref}
            chapterTestHref={chapterTestHref}
            onCompleted={(result, reviewTopics) =>
              recordMutation({
                kind: "self_check",
                blockId: selfCheck.id,
                correctCount: result.masteredCount,
                attemptCount: result.topicCount,
                reviewTopics,
              })
            }
          />
        ) : null}
      </main>

      <p className="sr-only" aria-live="polite">
        已完成 {completedCount}/{blocks.length} 个内容块
      </p>
    </div>
  );
}
