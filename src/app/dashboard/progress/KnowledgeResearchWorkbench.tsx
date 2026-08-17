"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Circle,
  CircleHelp,
  GitCompareArrows,
  ListTree,
  LockKeyhole,
  Maximize2,
  Minimize2,
  Play,
  RotateCcw,
  Shapes,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import {
  KnowledgeInteractionLab,
  type KnowledgeInteractionType,
} from "./KnowledgeInteractionLab";
import { KnowledgeWorkbenchGuide } from "./KnowledgeWorkbenchGuide";

type WorkbenchMode = "explain" | "deconstruct" | "compare";

const EXPLAIN_TONE = { color: "var(--primary)", soft: "var(--accent)" };
const DECONSTRUCT_TONE = { color: "var(--support)", soft: "var(--support-surface)" };
const COMPARE_TONE = { color: "var(--status-warning)", soft: "var(--status-warning-surface)" };

const modes = [
  {
    id: "explain" as const,
    label: "精讲",
    description: "动手拼出音节",
    icon: BookOpenCheck,
    ...EXPLAIN_TONE,
  },
  {
    id: "deconstruct" as const,
    label: "拆解",
    description: "看清三个位置",
    icon: ListTree,
    ...DECONSTRUCT_TONE,
  },
  {
    id: "compare" as const,
    label: "对比",
    description: "辨别组合差异",
    icon: GitCompareArrows,
    ...COMPARE_TONE,
  },
];

const initials = [
  { value: "ㄱ", index: 0 },
  { value: "ㄴ", index: 2 },
  { value: "ㅁ", index: 6 },
  { value: "ㅇ", index: 11 },
  { value: "ㅎ", index: 18 },
];

const vowels = [
  { value: "ㅏ", index: 0, layout: "vertical" },
  { value: "ㅓ", index: 4, layout: "vertical" },
  { value: "ㅗ", index: 8, layout: "horizontal" },
  { value: "ㅜ", index: 13, layout: "horizontal" },
  { value: "ㅡ", index: 18, layout: "horizontal" },
  { value: "ㅣ", index: 20, layout: "vertical" },
];

const finals = [
  { value: "", label: "无", index: 0 },
  { value: "ㄱ", label: "ㄱ", index: 1 },
  { value: "ㄴ", label: "ㄴ", index: 4 },
  { value: "ㄺ", label: "ㄺ", index: 9 },
  { value: "ㅁ", label: "ㅁ", index: 16 },
  { value: "ㅇ", label: "ㅇ", index: 21 },
];

const explainCases = [
  {
    syllable: "가",
    label: "竖向元音",
    description: "ㄱ + ㅏ，元音放在初声右侧",
    initial: initials[0],
    vowel: vowels[0],
    finalLetter: finals[0],
    tone: EXPLAIN_TONE,
  },
  {
    syllable: "고",
    label: "横向元音",
    description: "ㄱ + ㅗ，元音放在初声下方",
    initial: initials[0],
    vowel: vowels[2],
    finalLetter: finals[0],
    tone: DECONSTRUCT_TONE,
  },
  {
    syllable: "한",
    label: "带有终声",
    description: "ㅎ + ㅏ + ㄴ，收音位于方块底部",
    initial: initials[4],
    vowel: vowels[0],
    finalLetter: finals[2],
    tone: COMPARE_TONE,
  },
  {
    syllable: "읽",
    label: "复合收音",
    description: "ㅇ + ㅣ + ㄺ，底部收音由两个辅音组成",
    initial: initials[3],
    vowel: vowels[5],
    finalLetter: finals[3],
    tone: { color: "var(--foreground-secondary)", soft: "var(--surface-soft)" },
  },
];

const syllableSamples = [
  {
    syllable: "한",
    initial: "ㅎ",
    vowel: "ㅏ",
    final: "ㄴ",
    note: "三个位置都完整",
  },
  {
    syllable: "글",
    initial: "ㄱ",
    vowel: "ㅡ",
    final: "ㄹ",
    note: "横向元音在辅音下方",
  },
  {
    syllable: "가",
    initial: "ㄱ",
    vowel: "ㅏ",
    final: "—",
    note: "没有终声也能成块",
  },
  {
    syllable: "공",
    initial: "ㄱ",
    vowel: "ㅗ",
    final: "ㅇ",
    note: "终声固定在最下方",
  },
  {
    syllable: "읽",
    initial: "ㅇ",
    vowel: "ㅣ",
    final: "ㄺ",
    note: "复合收音也占同一个终声位置",
  },
];

const comparisons = [
  {
    label: "元音方向",
    left: "가",
    right: "고",
    leftParts: "ㄱ + ㅏ",
    rightParts: "ㄱ + ㅗ",
    explanation: "ㅏ 是竖向元音，放在初声右边；ㅗ 是横向元音，放在初声下方。",
  },
  {
    label: "有无终声",
    left: "가",
    right: "각",
    leftParts: "ㄱ + ㅏ",
    rightParts: "ㄱ + ㅏ + ㄱ",
    explanation: "增加终声后，音节块仍是一个整体，但底部多出收音位置。",
  },
  {
    label: "字母与音节",
    left: "ㄱ ㅏ",
    right: "가",
    leftParts: "两个独立字母",
    rightParts: "一个音节方块",
    explanation: "韩文是音素文字，但书写时通常把字母组合成音节方块。",
  },
];

const summaryContent: Record<
  WorkbenchMode,
  Array<{
    title: string;
    description: string;
  }>
> = {
  explain: [
    {
      title: "音节的基本骨架",
      description: "初声＋中声＋可选终声，组合成一个完整的韩文音节方块。",
    },
    {
      title: "右、下、底",
      description: "竖向元音放右边，横向元音放下边，终声固定放在底边。",
    },
    {
      title: "位置不能空缺",
      description: "元音开头用 ㅇ 占据初声；ㄺ 等复合收音仍只占一个终声位置。",
    },
  ],
  deconstruct: [
    {
      title: "从底部向上看",
      description: "先看底部有没有终声，再找中声元音，最后确认剩余的初声。",
    },
    {
      title: "三个位置的名称",
      description: "初声 초성 · 中声 중성 · 终声 종성，终声也常被称为 받침。",
    },
    {
      title: "无终声与复合收音",
      description: "“—”表示没有终声；两个辅音并排时，整体仍属于终声位置。",
    },
  ],
  compare: [
    {
      title: "先找变化发生在哪里",
      description: "依次比较元音方向、终声有无，以及单收音或复合收音。",
    },
    {
      title: "换一组也能看懂",
      description: "试着观察 나/노、다/달、일/읽，找出发生变化的位置。",
    },
    {
      title: "字母多不等于音节多",
      description: "읽 虽然包含四个基本字母，书写时仍然只是一个音节方块。",
    },
  ],
};

function KnowledgeSummaryStrip({ mode }: { mode: WorkbenchMode }) {
  return (
    <section
      data-guide={`summary-${mode}`}
      className="mt-5 border-t pt-4"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold">知识收束</p>
        <span className="app-muted-text text-[9px]">进入下一部分前快速整理</span>
      </div>
      <div
        className="mt-3 grid overflow-hidden rounded-2xl border md:grid-cols-3"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        {summaryContent[mode].map((item, index) => (
          <article
            key={item.title}
            className="min-h-[112px] border-t p-4 first:border-t-0 md:border-l md:border-t-0 md:first:border-l-0"
            style={{
              borderColor: "var(--border-subtle)",
              backgroundColor:
                index === 0 ? "var(--surface-soft)" : "var(--card)",
            }}
          >
            <CardTitleWithHint
              title={item.title}
              description={item.description}
              headingLevel={3}
              titleClassName="text-xs font-bold"
            />
          </article>
        ))}
      </div>
    </section>
  );
}

function composeHangul(initialIndex: number, vowelIndex: number, finalIndex: number) {
  return String.fromCharCode(
    0xac00 + initialIndex * 21 * 28 + vowelIndex * 28 + finalIndex
  );
}

function ChoiceButton({
  selected,
  tone = EXPLAIN_TONE,
  children,
  onClick,
}: {
  selected: boolean;
  tone?: { color: string; soft: string };
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border px-3 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
      style={{
        color: selected ? "white" : "var(--foreground)",
        borderColor: selected
          ? tone.color
          : "var(--border-subtle)",
        backgroundColor: selected
          ? tone.color
          : "var(--card)",
        outlineColor: tone.color,
      }}
    >
      {children}
    </button>
  );
}

export function KnowledgeResearchWorkbench({
  chapterSlug,
  courseTitle,
  chapterNumber,
  chapterTitle,
  chapterKoreanTitle,
  chapterDescription,
  backHref,
  ebookHref,
  chapterTestHref,
}: {
  chapterSlug: string;
  courseTitle: string;
  chapterNumber: number;
  chapterTitle: string;
  chapterKoreanTitle?: string;
  chapterDescription?: string;
  backHref: string;
  ebookHref: string;
  chapterTestHref: string;
}) {
  const [mode, setMode] = useState<WorkbenchMode>("explain");
  const [exploredExplainCases, setExploredExplainCases] = useState<Set<number>>(
    () => new Set([0])
  );
  const [exploredDeconstructCases, setExploredDeconstructCases] = useState<
    Set<number>
  >(() => new Set());
  const [exploredCompareCases, setExploredCompareCases] = useState<Set<number>>(
    () => new Set()
  );
  const [initial, setInitial] = useState(initials[0]);
  const [vowel, setVowel] = useState(vowels[0]);
  const [finalLetter, setFinalLetter] = useState(finals[0]);
  const [sampleIndex, setSampleIndex] = useState(0);
  const [comparisonIndex, setComparisonIndex] = useState(0);
  const [masteredInteractions, setMasteredInteractions] = useState<
    Set<KnowledgeInteractionType>
  >(() => new Set());
  const [labVersion, setLabVersion] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasInteractionStarted, setHasInteractionStarted] = useState(false);
  const [isInteractionOpen, setIsInteractionOpen] = useState(false);
  const interactionLaunchRef = useRef<HTMLButtonElement>(null);
  const interactionCloseRef = useRef<HTMLButtonElement>(null);
  // 服务端渲染时永远拿不到 localStorage，初始值必须和客户端首次渲染一致，
  // 否则会触发 hydration mismatch；实际的"是否已读过引导"改在挂载后用 effect 恢复。
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const progressStorageKey = `knowledge-workbench-progress:${chapterSlug}`;

  useEffect(() => {
    try {
      if (
        window.localStorage.getItem("knowledge-workbench-guide-v1") !== "seen"
      ) {
        // 本地存储是外部数据源；挂载后才知道是否要展示引导，这里的 setState
        // 属于"用外部快照同步组件状态"，不是可以用惰性初始值替代的场景。
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsGuideOpen(true);
      }
    } catch {
      // 本地存储不可用时按"未看过引导"处理，直接展示引导。
      setIsGuideOpen(true);
    }
  }, []);

  // 掌握进度过去只存在组件的 useState 里，刷新页面就清零；按章节 key 落到
  // localStorage，至少能在同一台设备上跨刷新保留已探索/已掌握的案例。
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(progressStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        exploredExplainCases?: number[];
        exploredDeconstructCases?: number[];
        exploredCompareCases?: number[];
        masteredInteractions?: KnowledgeInteractionType[];
      };
      // 下面几处都是把本地缓存的历史进度同步进组件状态，同理需要关闭该规则。
      if (Array.isArray(parsed.exploredExplainCases)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setExploredExplainCases(new Set([0, ...parsed.exploredExplainCases]));
      }
      if (Array.isArray(parsed.exploredDeconstructCases)) {
        setExploredDeconstructCases(new Set(parsed.exploredDeconstructCases));
      }
      if (Array.isArray(parsed.exploredCompareCases)) {
        setExploredCompareCases(new Set(parsed.exploredCompareCases));
      }
      if (Array.isArray(parsed.masteredInteractions)) {
        setMasteredInteractions(new Set(parsed.masteredInteractions));
      }
    } catch {
      // 本地缓存损坏时忽略，按未探索处理。
    }
  }, [progressStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        progressStorageKey,
        JSON.stringify({
          exploredExplainCases: [...exploredExplainCases],
          exploredDeconstructCases: [...exploredDeconstructCases],
          exploredCompareCases: [...exploredCompareCases],
          masteredInteractions: [...masteredInteractions],
        })
      );
    } catch {
      // 本地存储不可用时静默忽略，不影响当前会话内的练习。
    }
  }, [
    exploredExplainCases,
    exploredDeconstructCases,
    exploredCompareCases,
    masteredInteractions,
    progressStorageKey,
  ]);

  const syllable = composeHangul(initial.index, vowel.index, finalLetter.index);
  const sample = syllableSamples[sampleIndex];
  const comparison = comparisons[comparisonIndex];
  const prerequisiteItems = [
    {
      id: "explain" as const,
      label: "精讲",
      count: exploredExplainCases.size,
      required: explainCases.length,
      tone: EXPLAIN_TONE,
    },
    {
      id: "deconstruct" as const,
      label: "拆解",
      count: exploredDeconstructCases.size,
      required: syllableSamples.length,
      tone: DECONSTRUCT_TONE,
    },
    {
      id: "compare" as const,
      label: "对比",
      count: exploredCompareCases.size,
      required: comparisons.length,
      tone: COMPARE_TONE,
    },
  ];
  const completedPrerequisiteCount = prerequisiteItems.filter(
    (item) => item.count >= item.required
  ).length;
  const isInteractionReady = completedPrerequisiteCount === 3;
  const progress = Math.round(
    ((completedPrerequisiteCount + masteredInteractions.size) / 7) * 100
  );
  const interactionButtonLabel = !isInteractionReady
    ? `完成前置学习 ${completedPrerequisiteCount}/3`
    : masteredInteractions.size === 4
      ? "查看互动结果"
      : hasInteractionStarted
        ? "继续互动练习"
        : "开始互动练习";

  function switchMode(nextMode: WorkbenchMode) {
    setMode(nextMode);
    if (nextMode === "deconstruct") {
      setExploredDeconstructCases((current) => {
        const next = new Set(current);
        next.add(sampleIndex);
        return next;
      });
    }
    if (nextMode === "compare") {
      setExploredCompareCases((current) => {
        const next = new Set(current);
        next.add(comparisonIndex);
        return next;
      });
    }
  }

  function recordExploredCase(
    setter: React.Dispatch<React.SetStateAction<Set<number>>>,
    index: number
  ) {
    setter((current) => {
      const next = new Set(current);
      next.add(index);
      return next;
    });
  }

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (isGuideOpen) {
        window.localStorage.setItem("knowledge-workbench-guide-v1", "seen");
        setIsGuideOpen(false);
        setMode("explain");
      } else if (isInteractionOpen) {
        setIsInteractionOpen(false);
        window.requestAnimationFrame(() => interactionLaunchRef.current?.focus());
      } else {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isGuideOpen, isInteractionOpen]);

  useEffect(() => {
    if (isInteractionOpen) interactionCloseRef.current?.focus();
  }, [isInteractionOpen]);

  const closeInteraction = useCallback(() => {
    setIsInteractionOpen(false);
    window.requestAnimationFrame(() => interactionLaunchRef.current?.focus());
  }, []);

  // 全屏工作台展开时，背景页面之前还能滚动，容易造成背景和弹层同时滚动的错乱体验。
  useEffect(() => {
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  function toggleFullscreen() {
    setIsFullscreen((current) => !current);
  }

  const handleGuideModeChange = useCallback((nextMode: WorkbenchMode) => {
    setMode(nextMode);
  }, []);

  const closeGuide = useCallback(() => {
    window.localStorage.setItem("knowledge-workbench-guide-v1", "seen");
    setIsGuideOpen(false);
    setMode("explain");
  }, []);

  return (
    <div
      className={`grid w-full items-start gap-4 xl:grid-cols-[minmax(0,1fr)_290px] ${
        isFullscreen
          ? "fixed inset-0 z-[100] h-dvh overflow-y-auto p-3 sm:p-5"
          : ""
      }`}
      style={{
        backgroundColor: isFullscreen ? "var(--background)" : undefined,
      }}
    >
      <header
        className={`app-card col-span-full rounded-2xl border p-4 sm:p-5 ${
          isFullscreen ? "sticky top-0 z-20 shadow-sm" : ""
        }`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:items-center">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
              style={{
                color: "var(--primary-hover)",
                backgroundColor: "var(--accent)",
              }}
              aria-hidden="true"
            >
              <BookOpenCheck size={23} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-[0.08em] app-muted-text">
                {courseTitle}
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
                第 {String(chapterNumber).padStart(2, "0")} 章 · {chapterTitle}
              </h2>
              <p className="mt-1 text-sm app-muted-text">
                {chapterKoreanTitle ? `${chapterKoreanTitle} · ` : ""}
                {chapterDescription}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <div
              className="mr-auto min-w-28 rounded-xl px-3 py-2 sm:mr-2"
              style={{ backgroundColor: "var(--surface-soft)" }}
            >
              <div className="flex items-center justify-between gap-3 text-[11px] font-bold">
                <span className="app-muted-text">本章掌握</span>
                <span className="tabular-nums" style={{ color: "var(--primary-hover)" }}>
                  {progress}%
                </span>
              </div>
              <div
                className="mt-1.5 h-1.5 overflow-hidden rounded-full"
                style={{ backgroundColor: "var(--card)" }}
              >
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{
                    width: `${progress}%`,
                    backgroundColor: "var(--primary)",
                  }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsInteractionOpen(false);
                setIsGuideOpen(true);
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold transition-colors hover:bg-[var(--surface-soft)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
              style={{
                borderColor: "var(--border)",
                outlineColor: "var(--primary)",
              }}
            >
              <CircleHelp size={16} aria-hidden="true" />
              <span className="hidden sm:inline">学习指引</span>
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold transition-colors hover:bg-[var(--surface-soft)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
              style={{
                borderColor: "var(--border)",
                outlineColor: "var(--primary)",
              }}
            >
              {isFullscreen ? (
                <Minimize2 size={16} aria-hidden="true" />
              ) : (
                <Maximize2 size={16} aria-hidden="true" />
              )}
              <span className="hidden sm:inline">
                {isFullscreen ? "退出全屏" : "全屏学习"}
              </span>
            </button>
            <Link
              href={backHref}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold transition-colors hover:bg-[var(--surface-soft)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
              style={{ outlineColor: "var(--primary)" }}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              返回章节
            </Link>
          </div>
        </div>
      </header>

      <section className="app-card overflow-hidden rounded-3xl border">
        <div
          data-guide="mode-tabs"
          role="tablist"
          aria-label="精研学习方式"
          className="grid grid-cols-3 gap-1 border-b p-2"
          style={{
            borderColor: "var(--border-subtle)",
            backgroundColor: "var(--surface-soft)",
          }}
        >
          {modes.map((item) => {
            const Icon = item.icon;
            const selected = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => switchMode(item.id)}
                className="flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
                style={{
                  color: selected
                    ? "var(--primary-hover)"
                    : "var(--foreground-muted)",
                  borderColor: selected
                    ? "var(--primary)"
                    : "transparent",
                  backgroundColor: selected
                    ? "var(--card)"
                    : "transparent",
                  outlineColor: "var(--primary)",
                }}
              >
                <Icon size={17} aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        {mode === "explain" && (
          <div className="p-4 sm:p-6">
            <div
              className="rounded-2xl border px-4 py-3"
              style={{
                borderColor: COMPARE_TONE.color,
                backgroundColor: COMPARE_TONE.soft,
              }}
            >
              <p className="text-xs font-bold" style={{ color: COMPARE_TONE.color }}>
                先抓住一个核心规则
              </p>
              <p className="mt-1 text-sm font-bold leading-6">
                韩文字母不是简单横排，而是按“初声＋中声＋可选终声”装进一个音节方块。
              </p>
            </div>

            <div
              data-guide="explain-cases"
              className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              {explainCases.map((item, index) => {
                const selected = syllable === item.syllable;
                return (
                  <button
                    key={item.syllable}
                    type="button"
                    onClick={() => {
                      recordExploredCase(setExploredExplainCases, index);
                      setInitial(item.initial);
                      setVowel(item.vowel);
                      setFinalLetter(item.finalLetter);
                    }}
                    aria-pressed={selected}
                    className="group flex min-h-11 items-center gap-3 rounded-2xl border p-3 text-left transition-[border-color,box-shadow] hover:shadow-sm focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
                    style={{
                      borderColor: selected
                        ? item.tone.color
                        : "var(--border-subtle)",
                      backgroundColor: item.tone.soft,
                      outlineColor: item.tone.color,
                    }}
                  >
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold"
                      style={{
                        color: selected ? "white" : item.tone.color,
                        backgroundColor: selected
                          ? item.tone.color
                          : "var(--card)",
                      }}
                    >
                      {item.syllable}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[9px] font-bold">
                        案例 {index + 1} · {item.label}
                      </span>
                      <span className="app-muted-text mt-1 block text-[9px] leading-4">
                        {item.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div
              data-guide="syllable-builder"
              className="mt-4 grid gap-4 lg:grid-cols-[minmax(280px,.82fr)_minmax(0,1.18fr)]"
            >
              <div
                className="flex min-h-[330px] flex-col items-center justify-center rounded-3xl border p-5 text-center"
                style={{
                  borderColor: "var(--border-subtle)",
                  backgroundColor: "var(--surface-soft)",
                }}
              >
                <p className="app-muted-text text-[10px] font-bold tracking-[0.12em]">
                  实时音节方块
                </p>
                <div
                  className="mt-4 flex h-36 w-36 items-center justify-center rounded-[2rem] border text-7xl font-bold shadow-sm"
                  style={{
                    color: DECONSTRUCT_TONE.color,
                    borderColor: DECONSTRUCT_TONE.color,
                    backgroundColor: "var(--card)",
                  }}
                >
                  {syllable}
                </div>
                <div className="mt-4 flex items-center gap-2 text-sm font-bold">
                  <span>{initial.value}</span>
                  <span className="app-muted-text">＋</span>
                  <span>{vowel.value}</span>
                  {finalLetter.value && (
                    <>
                      <span className="app-muted-text">＋</span>
                      <span>{finalLetter.value}</span>
                    </>
                  )}
                  <ArrowRight size={14} style={{ color: EXPLAIN_TONE.color }} aria-hidden="true" />
                  <span style={{ color: EXPLAIN_TONE.color }}>{syllable}</span>
                </div>
                <p className="app-muted-text mt-3 text-[10px] leading-5">
                  {vowel.layout === "vertical"
                    ? `${vowel.value} 是竖向元音，所以放在初声右边。`
                    : `${vowel.value} 是横向元音，所以放在初声下方。`}
                </p>
              </div>

              <div className="space-y-4">
                <div
                  className="rounded-2xl border p-4"
                  style={{
                    borderColor: EXPLAIN_TONE.soft,
                    backgroundColor: EXPLAIN_TONE.soft,
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold">① 选择初声</p>
                    <span className="app-muted-text text-[9px]">辅音位置</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {initials.map((item) => (
                      <ChoiceButton
                        key={item.value}
                        selected={initial.value === item.value}
                        tone={EXPLAIN_TONE}
                        onClick={() => setInitial(item)}
                      >
                        {item.value}
                      </ChoiceButton>
                    ))}
                  </div>
                </div>

                <div
                  className="rounded-2xl border p-4"
                  style={{
                    borderColor: "var(--border)",
                    backgroundColor: "var(--surface-soft)",
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold">② 选择中声</p>
                    <span className="app-muted-text text-[9px]">元音决定布局</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {vowels.map((item) => (
                      <ChoiceButton
                        key={item.value}
                        selected={vowel.value === item.value}
                        tone={COMPARE_TONE}
                        onClick={() => setVowel(item)}
                      >
                        {item.value}
                      </ChoiceButton>
                    ))}
                  </div>
                </div>

                <div
                  className="rounded-2xl border p-4"
                  style={{
                    borderColor: DECONSTRUCT_TONE.soft,
                    backgroundColor: DECONSTRUCT_TONE.soft,
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold">③ 添加终声</p>
                    <span className="app-muted-text text-[9px]">可选的收音位置</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {finals.map((item) => (
                      <ChoiceButton
                        key={item.label}
                        selected={finalLetter.label === item.label}
                        tone={DECONSTRUCT_TONE}
                        onClick={() => setFinalLetter(item)}
                      >
                        {item.label}
                      </ChoiceButton>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <KnowledgeSummaryStrip mode="explain" />
          </div>
        )}

        {mode === "deconstruct" && (
          <div data-guide="deconstruct-content" className="p-4 sm:p-6">
            <div className="flex flex-wrap gap-2">
              {syllableSamples.map((item, index) => (
                <button
                  key={item.syllable}
                  type="button"
                  onClick={() => {
                    recordExploredCase(setExploredDeconstructCases, index);
                    setSampleIndex(index);
                  }}
                  aria-pressed={sampleIndex === index}
                  className="min-h-11 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
                  style={{
                    color:
                      sampleIndex === index
                        ? "white"
                        : "var(--foreground)",
                    borderColor:
                      sampleIndex === index
                        ? DECONSTRUCT_TONE.color
                        : "var(--border-subtle)",
                    backgroundColor:
                      sampleIndex === index
                        ? DECONSTRUCT_TONE.color
                        : "var(--card)",
                    outlineColor: DECONSTRUCT_TONE.color,
                  }}
                >
                  {item.syllable}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[.72fr_1.28fr]">
              <div
                className="flex min-h-[330px] items-center justify-center rounded-3xl border"
                style={{
                  borderColor: "var(--border-subtle)",
                  backgroundColor: DECONSTRUCT_TONE.soft,
                }}
              >
                <span className="text-8xl font-bold" style={{ color: DECONSTRUCT_TONE.color }}>
                  {sample.syllable}
                </span>
              </div>

              <div
                className="rounded-3xl border p-5"
                style={{
                  borderColor: DECONSTRUCT_TONE.soft,
                  backgroundColor: DECONSTRUCT_TONE.soft,
                }}
              >
                <p className="app-muted-text text-[10px] font-bold tracking-[0.12em]">
                  点击后逐层看清
                </p>
                <div className="mt-5 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2">
                  {[
                    ["初声", sample.initial],
                    ["中声", sample.vowel],
                    ["终声", sample.final],
                  ].map(([label, value], index) => (
                    <div key={label} className="contents">
                      <div
                        className="rounded-2xl border p-4 text-center"
                        style={{
                          borderColor: DECONSTRUCT_TONE.color,
                          backgroundColor: "var(--card)",
                        }}
                      >
                        <p className="app-muted-text text-[9px] font-bold">{label}</p>
                        <p className="mt-2 text-3xl font-bold">{value}</p>
                      </div>
                      {index < 2 && (
                        <span className="app-muted-text text-lg font-bold">＋</span>
                      )}
                    </div>
                  ))}
                </div>
                <div
                  className="mt-5 flex items-start gap-3 rounded-2xl p-4"
                  style={{ backgroundColor: "var(--card)" }}
                >
                  <Shapes
                    className="mt-0.5 shrink-0"
                    size={17}
                    style={{ color: DECONSTRUCT_TONE.color }}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-xs font-bold">{sample.note}</p>
                    <p className="app-muted-text mt-1 text-[10px] leading-5">
                      阅读时先把整个方块当作一个音节，再观察内部字母的位置。
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <KnowledgeSummaryStrip mode="deconstruct" />
          </div>
        )}

        {mode === "compare" && (
          <div data-guide="compare-content" className="p-4 sm:p-6">
            <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="space-y-2">
                {comparisons.map((item, index) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      recordExploredCase(setExploredCompareCases, index);
                      setComparisonIndex(index);
                    }}
                    aria-pressed={comparisonIndex === index}
                    className="flex min-h-11 w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
                    style={{
                      color:
                        comparisonIndex === index
                          ? COMPARE_TONE.color
                          : "var(--foreground)",
                      borderColor:
                        comparisonIndex === index
                          ? COMPARE_TONE.color
                          : "var(--border-subtle)",
                      backgroundColor:
                        comparisonIndex === index
                          ? COMPARE_TONE.soft
                          : "var(--card)",
                      outlineColor: COMPARE_TONE.color,
                    }}
                  >
                    {item.label}
                    <ArrowRight size={13} aria-hidden="true" />
                  </button>
                ))}
              </div>

              <div
                className="rounded-3xl border p-5"
                style={{
                  borderColor: COMPARE_TONE.soft,
                  backgroundColor: COMPARE_TONE.soft,
                }}
              >
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  {[
                    [comparison.left, comparison.leftParts],
                    [comparison.right, comparison.rightParts],
                  ].map(([character, parts], index) => (
                    <div key={`${character}-${index}`} className="contents">
                      <div
                        className="rounded-3xl border p-5 text-center"
                        style={{ backgroundColor: "var(--card)" }}
                      >
                        <p className="text-6xl font-bold">{character}</p>
                        <p className="app-muted-text mt-3 text-[10px] font-bold">
                          {parts}
                        </p>
                      </div>
                      {index === 0 && (
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold"
                          style={{
                            color: COMPARE_TONE.color,
                            backgroundColor: "var(--card)",
                          }}
                        >
                          对比
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <p
                  className="mt-4 rounded-2xl px-4 py-3 text-xs font-bold leading-6"
                  style={{
                    color: COMPARE_TONE.color,
                    backgroundColor: "var(--card)",
                  }}
                >
                  {comparison.explanation}
                </p>
              </div>
            </div>
            <KnowledgeSummaryStrip mode="compare" />
          </div>
        )}
      </section>

      <aside
        className="app-card rounded-3xl border p-4 xl:sticky xl:top-4"
        aria-label="本章学习进度"
      >
        <section data-guide="mastery-path">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold">本章进度</p>
              <p className="mt-0.5 text-[10px] app-muted-text">
                依次完成精讲、拆解和对比
              </p>
            </div>
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: EXPLAIN_TONE.color }}
            >
              {progress}%
            </span>
          </div>
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full"
            style={{ backgroundColor: "var(--surface-soft)" }}
          >
            <div
              className="h-full rounded-full transition-[width]"
              style={{
                width: `${progress}%`,
                backgroundColor: EXPLAIN_TONE.color,
              }}
            />
          </div>
          <div className="mt-3 space-y-1">
            {prerequisiteItems.map((item) => {
              const done = item.count >= item.required;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => switchMode(item.id)}
                  className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2 text-left transition-colors hover:bg-[var(--surface-soft)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
                  style={{ outlineColor: "var(--primary)" }}
                >
                  {done ? (
                    <CheckCircle2 size={16} style={{ color: "var(--status-success)" }} aria-hidden="true" />
                  ) : (
                    <Circle className="app-muted-text" size={16} aria-hidden="true" />
                  )}
                  <span
                    className="text-[11px] font-bold"
                    style={{ color: done ? "var(--status-success)" : item.tone.color }}
                  >
                    {item.label}
                  </span>
                  <span className="app-muted-text ml-auto text-[10px] tabular-nums">
                    {Math.min(item.count, item.required)} / {item.required}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section
          data-guide="interaction-launch"
          className="mt-4 border-t pt-4"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold">互动练习</p>
              <p className="mt-0.5 text-[10px] app-muted-text">
                拼装、拆解、纠错与分类
              </p>
            </div>
            <span className="text-[10px] font-bold tabular-nums app-muted-text">
              {masteredInteractions.size} / 4
            </span>
          </div>
          <button
            ref={interactionLaunchRef}
            type="button"
            disabled={!isInteractionReady}
            onClick={() => {
              if (!isInteractionReady) return;
              setHasInteractionStarted(true);
              setIsInteractionOpen(true);
            }}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold text-white transition-opacity enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
            style={{
              backgroundColor: isInteractionReady
                ? "var(--primary)"
                : "var(--foreground-muted)",
              outlineColor: "var(--primary)",
            }}
          >
            {isInteractionReady ? <Play size={14} aria-hidden="true" /> : <LockKeyhole size={14} aria-hidden="true" />}
            {interactionButtonLabel}
          </button>
          <p className="app-muted-text mt-2 text-center text-[10px] leading-5">
            {isInteractionReady
              ? hasInteractionStarted
                ? "拼装、拆解、纠错和分类将在独立互动平台中完成。"
                : "前置学习已完成，点击上方按钮开放互动练习台。"
              : "完成精讲、拆解和对比的全部案例后开放。"}
          </p>
        </section>

        <section
          className="mt-4 border-t pt-4"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <p className="mb-2 text-xs font-bold">课程入口</p>
          <Link
            href={ebookHref}
            className="flex min-h-11 items-center justify-between rounded-xl border px-3 py-3 text-xs font-bold transition-colors hover:bg-[var(--surface-soft)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
            style={{
              borderColor: "var(--border)",
              outlineColor: "var(--primary)",
            }}
          >
            对应电子书
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
          <Link
            href={chapterTestHref}
            className="mt-2 flex min-h-11 items-center justify-between rounded-xl px-3 py-3 text-xs font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
            style={{
              backgroundColor: "var(--primary)",
              outlineColor: "var(--primary)",
            }}
          >
            进入章节测试
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </section>

        <button
          type="button"
          onClick={() => {
            setMode("explain");
            setExploredExplainCases(new Set([0]));
            setExploredDeconstructCases(new Set());
            setExploredCompareCases(new Set());
            setInitial(initials[0]);
            setVowel(vowels[0]);
            setFinalLetter(finals[0]);
            setSampleIndex(0);
            setComparisonIndex(0);
            setMasteredInteractions(new Set());
            setHasInteractionStarted(false);
            setIsInteractionOpen(false);
            setLabVersion((current) => current + 1);
          }}
          className="app-muted-text mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-[10px] font-bold transition-colors hover:bg-[var(--surface-soft)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
          style={{ outlineColor: "var(--primary)" }}
        >
          <RotateCcw size={13} aria-hidden="true" />
          重置本章进度
        </button>
      </aside>

      {hasInteractionStarted && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="韩文结构互动练习"
          className={`fixed inset-0 z-[160] items-center justify-center bg-foreground/60 p-3 sm:p-6 ${
            isInteractionOpen ? "flex" : "hidden"
          }`}
        >
          <section className="app-card flex max-h-[94dvh] w-full max-w-[1180px] flex-col overflow-hidden rounded-3xl border shadow-2xl">
            <div
              className="flex items-center justify-between gap-4 border-b px-4 py-3 sm:px-5"
              style={{
                borderColor: "var(--border-subtle)",
                backgroundColor: "var(--surface-soft)",
              }}
            >
              <div>
                <p className="text-sm font-bold">韩文结构互动练习</p>
                <p className="app-muted-text mt-0.5 text-[9px]">
                  拼装 · 拆解 · 纠错 · 分类
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="rounded-full px-2.5 py-1 text-[9px] font-bold"
                  style={{
                    color:
                      masteredInteractions.size === 4
                        ? "var(--status-success)"
                        : DECONSTRUCT_TONE.color,
                    backgroundColor:
                      masteredInteractions.size === 4
                        ? "var(--status-success-surface)"
                        : DECONSTRUCT_TONE.soft,
                  }}
                >
                  {masteredInteractions.size === 4
                    ? "全部完成"
                    : `${masteredInteractions.size} / 4 项完成`}
                </span>
                <button
                  ref={interactionCloseRef}
                  type="button"
                  onClick={closeInteraction}
                  className="flex h-11 w-11 items-center justify-center rounded-full border focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
                  style={{ outlineColor: "var(--primary)" }}
                  aria-label="关闭互动练习"
                  title="关闭互动练习"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <KnowledgeInteractionLab
                key={labVersion}
                onMasteryChange={(interactionType) =>
                  setMasteredInteractions((current) => {
                    const next = new Set(current);
                    next.add(interactionType);
                    return next;
                  })
                }
              />
            </div>
          </section>
        </div>
      )}

      {isGuideOpen && (
        <KnowledgeWorkbenchGuide
          onClose={closeGuide}
          onModeChange={handleGuideModeChange}
        />
      )}
    </div>
  );
}
