"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Circle,
  CircleAlert,
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
import { useCallback, useEffect, useState } from "react";
import {
  KnowledgeInteractionLab,
  type KnowledgeInteractionType,
} from "./KnowledgeInteractionLab";
import { KnowledgeWorkbenchGuide } from "./KnowledgeWorkbenchGuide";

type WorkbenchMode = "explain" | "deconstruct" | "compare";

const EXPLAIN_TONE = { color: "#376f8a", soft: "#eaf4f7" };
const DECONSTRUCT_TONE = { color: "#70558f", soft: "#f2edf8" };
const COMPARE_TONE = { color: "#b06f3c", soft: "#fbf0e5" };

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
    tone: { color: "#8a6a2f", soft: "#f8f1df" },
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
    eyebrow: string;
    title: string;
    description: string;
    color: string;
    soft: string;
  }>
> = {
  explain: [
    {
      eyebrow: "结构公式",
      title: "音节的基本骨架",
      description: "初声＋中声＋可选终声，组合成一个完整的韩文音节方块。",
      ...EXPLAIN_TONE,
    },
    {
      eyebrow: "布局口诀",
      title: "右、下、底",
      description: "竖向元音放右边，横向元音放下边，终声固定放在底边。",
      color: "#8a6a2f",
      soft: "#f8f1df",
    },
    {
      eyebrow: "特别提醒",
      title: "位置不能空缺",
      description: "元音开头用 ㅇ 占据初声；ㄺ 等复合收音仍只占一个终声位置。",
      ...DECONSTRUCT_TONE,
    },
  ],
  deconstruct: [
    {
      eyebrow: "拆解顺序",
      title: "从底部向上看",
      description: "先看底部有没有终声，再找中声元音，最后确认剩余的初声。",
      ...DECONSTRUCT_TONE,
    },
    {
      eyebrow: "术语对照",
      title: "三个位置的名称",
      description: "初声 초성 · 中声 중성 · 终声 종성，终声也常被称为 받침。",
      ...EXPLAIN_TONE,
    },
    {
      eyebrow: "符号说明",
      title: "无终声与复合收音",
      description: "“—”表示没有终声；两个辅音并排时，整体仍属于终声位置。",
      color: "#8a6a2f",
      soft: "#f8f1df",
    },
  ],
  compare: [
    {
      eyebrow: "判别维度",
      title: "先找变化发生在哪里",
      description: "依次比较元音方向、终声有无，以及单收音或复合收音。",
      ...COMPARE_TONE,
    },
    {
      eyebrow: "迁移案例",
      title: "换一组也能看懂",
      description: "试着观察 나/노、다/달、일/읽，找出发生变化的位置。",
      ...DECONSTRUCT_TONE,
    },
    {
      eyebrow: "易错提醒",
      title: "字母多不等于音节多",
      description: "읽 虽然包含四个基本字母，书写时仍然只是一个音节方块。",
      ...EXPLAIN_TONE,
    },
  ],
};

function KnowledgeSummaryStrip({ mode }: { mode: WorkbenchMode }) {
  return (
    <section
      data-guide={`summary-${mode}`}
      className="mt-5 border-t pt-4"
      style={{ borderColor: "var(--app-border-soft)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black">知识收束</p>
        <span className="app-muted-text text-[9px]">进入下一部分前快速整理</span>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {summaryContent[mode].map((item) => (
          <article
            key={item.eyebrow}
            className="min-h-[118px] rounded-2xl border p-4"
            style={{ borderColor: item.color, backgroundColor: item.soft }}
          >
            <p
              className="text-[9px] font-black tracking-[0.12em]"
              style={{ color: item.color }}
            >
              {item.eyebrow}
            </p>
            <h3 className="mt-2 text-xs font-black">{item.title}</h3>
            <p className="app-muted-text mt-1.5 text-[10px] leading-5">
              {item.description}
            </p>
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
      className="flex min-h-9 min-w-10 items-center justify-center rounded-xl border px-3 text-sm font-black transition hover:-translate-y-0.5"
      style={{
        color: selected ? "white" : "var(--app-text)",
        borderColor: selected
          ? tone.color
          : "var(--app-border-soft)",
        backgroundColor: selected
          ? tone.color
          : "var(--app-card-bg)",
      }}
    >
      {children}
    </button>
  );
}

export function KnowledgeResearchWorkbench({
  chapterSlug,
}: {
  chapterSlug: string;
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
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [hasInteractionStarted, setHasInteractionStarted] = useState(false);
  const [isInteractionOpen, setIsInteractionOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("knowledge-workbench-guide-v1") !== "seen";
  });

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
      } else {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isGuideOpen, isInteractionOpen]);

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
          ? "fixed inset-0 z-[100] h-dvh overflow-y-auto p-4 sm:p-6"
          : ""
      }`}
      style={{
        backgroundColor: isFullscreen ? "#f7f4ed" : undefined,
      }}
    >
      <section className="app-card overflow-hidden rounded-3xl border">
        <div
          data-guide="mode-tabs"
          className="flex flex-wrap items-center gap-2 border-b p-2.5"
          style={{
            borderColor: "var(--app-border-soft)",
            backgroundColor: "#f6f3ed",
          }}
        >
          {modes.map((item) => {
            const Icon = item.icon;
            const selected = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => switchMode(item.id)}
                className="flex min-w-[132px] flex-1 items-center gap-2.5 rounded-2xl px-4 py-3 text-left transition"
                style={{
                  color: selected ? "white" : "var(--app-text)",
                  backgroundColor: selected
                    ? item.color
                    : item.soft,
                  boxShadow: selected
                    ? `0 8px 24px color-mix(in srgb, ${item.color} 22%, transparent)`
                    : undefined,
                }}
              >
                <Icon size={17} />
                <span>
                  <span className="block text-xs font-black">{item.label}</span>
                  <span
                    className="mt-0.5 block text-[9px] font-bold"
                    style={{
                      color: selected
                        ? "rgba(255,255,255,.78)"
                        : "var(--app-muted)",
                    }}
                  >
                    {item.description}
                  </span>
                </span>
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
              <p className="text-xs font-black" style={{ color: COMPARE_TONE.color }}>
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
                    className="group flex items-center gap-3 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm"
                    style={{
                      borderColor: selected
                        ? item.tone.color
                        : "var(--app-border-soft)",
                      backgroundColor: item.tone.soft,
                    }}
                  >
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl font-black"
                      style={{
                        color: selected ? "white" : item.tone.color,
                        backgroundColor: selected
                          ? item.tone.color
                          : "var(--app-card-bg)",
                      }}
                    >
                      {item.syllable}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[9px] font-black">
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
                  borderColor: "var(--app-border-soft)",
                  backgroundColor: "#f8f1df",
                }}
              >
                <p className="app-muted-text text-[10px] font-black tracking-[0.12em]">
                  实时音节方块
                </p>
                <div
                  className="mt-4 flex h-36 w-36 items-center justify-center rounded-[2rem] border text-7xl font-black shadow-sm"
                  style={{
                    color: DECONSTRUCT_TONE.color,
                    borderColor: DECONSTRUCT_TONE.color,
                    backgroundColor: "var(--app-card-bg)",
                  }}
                >
                  {syllable}
                </div>
                <div className="mt-4 flex items-center gap-2 text-sm font-black">
                  <span>{initial.value}</span>
                  <span className="app-muted-text">＋</span>
                  <span>{vowel.value}</span>
                  {finalLetter.value && (
                    <>
                      <span className="app-muted-text">＋</span>
                      <span>{finalLetter.value}</span>
                    </>
                  )}
                  <ArrowRight size={14} style={{ color: EXPLAIN_TONE.color }} />
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
                    <p className="text-xs font-black">① 选择初声</p>
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
                    borderColor: "#f6e8d6",
                    backgroundColor: "#f9f1e6",
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black">② 选择中声</p>
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
                    <p className="text-xs font-black">③ 添加终声</p>
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
                  className="rounded-xl border px-4 py-2.5 text-sm font-black transition"
                  style={{
                    color:
                      sampleIndex === index
                        ? "white"
                        : "var(--app-text)",
                    borderColor:
                      sampleIndex === index
                        ? DECONSTRUCT_TONE.color
                        : "var(--app-border-soft)",
                    backgroundColor:
                      sampleIndex === index
                        ? DECONSTRUCT_TONE.color
                        : "var(--app-card-bg)",
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
                  borderColor: "var(--app-border-soft)",
                  backgroundColor: DECONSTRUCT_TONE.soft,
                }}
              >
                <span className="text-8xl font-black" style={{ color: DECONSTRUCT_TONE.color }}>
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
                <p className="app-muted-text text-[10px] font-black tracking-[0.12em]">
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
                          backgroundColor: "var(--app-card-bg)",
                        }}
                      >
                        <p className="app-muted-text text-[9px] font-black">{label}</p>
                        <p className="mt-2 text-3xl font-black">{value}</p>
                      </div>
                      {index < 2 && (
                        <span className="app-muted-text text-lg font-black">＋</span>
                      )}
                    </div>
                  ))}
                </div>
                <div
                  className="mt-5 flex items-start gap-3 rounded-2xl p-4"
                  style={{ backgroundColor: "var(--app-card-bg)" }}
                >
                  <Shapes
                    className="mt-0.5 shrink-0"
                    size={17}
                    style={{ color: DECONSTRUCT_TONE.color }}
                  />
                  <div>
                    <p className="text-xs font-black">{sample.note}</p>
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
                    className="flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-xs font-black transition"
                    style={{
                      color:
                        comparisonIndex === index
                          ? COMPARE_TONE.color
                          : "var(--app-text)",
                      borderColor:
                        comparisonIndex === index
                          ? COMPARE_TONE.color
                          : "var(--app-border-soft)",
                      backgroundColor:
                        comparisonIndex === index
                          ? COMPARE_TONE.soft
                          : "var(--app-card-bg)",
                    }}
                  >
                    {item.label}
                    <ArrowRight size={13} />
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
                        style={{ backgroundColor: "var(--app-card-bg)" }}
                      >
                        <p className="text-6xl font-black">{character}</p>
                        <p className="app-muted-text mt-3 text-[10px] font-black">
                          {parts}
                        </p>
                      </div>
                      {index === 0 && (
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-black"
                          style={{
                            color: COMPARE_TONE.color,
                            backgroundColor: "var(--app-card-bg)",
                          }}
                        >
                          VS
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <p
                  className="mt-4 rounded-2xl px-4 py-3 text-xs font-bold leading-6"
                  style={{
                    color: COMPARE_TONE.color,
                    backgroundColor: "var(--app-card-bg)",
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

      <aside className="space-y-4 xl:sticky xl:top-4">
        <button
          type="button"
          onClick={toggleFullscreen}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black transition hover:-translate-y-0.5"
          style={{
            color: DECONSTRUCT_TONE.color,
            borderColor: DECONSTRUCT_TONE.color,
            backgroundColor: DECONSTRUCT_TONE.soft,
          }}
        >
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          {isFullscreen ? "退出全屏" : "全屏工作台"}
        </button>

        <button
          type="button"
          onClick={() => {
            setIsInteractionOpen(false);
            setIsGuideOpen(true);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black transition hover:-translate-y-0.5"
          style={{
            color: "#8a6a2f",
            borderColor: "#d8bd7f",
            backgroundColor: "#f8f1df",
          }}
        >
          <CircleHelp size={15} />
          打开教学指引
        </button>

        <section
          data-guide="mastery-path"
          className="app-card rounded-3xl border p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-black">掌握路径</p>
            <span className="text-xs font-black" style={{ color: EXPLAIN_TONE.color }}>
              {progress}%
            </span>
          </div>
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full"
            style={{ backgroundColor: "var(--app-secondary-soft)" }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progress}%`,
                backgroundColor: EXPLAIN_TONE.color,
              }}
            />
          </div>
          <div className="mt-4 space-y-3">
            {prerequisiteItems.map((item) => {
              const done = item.count >= item.required;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => switchMode(item.id)}
                  className="flex w-full items-center gap-2.5 text-left"
                >
                  {done ? (
                    <CheckCircle2 size={16} style={{ color: "var(--app-success)" }} />
                  ) : (
                    <Circle className="app-muted-text" size={16} />
                  )}
                  <span
                    className="text-[11px] font-black"
                    style={{ color: done ? "var(--app-success)" : item.tone.color }}
                  >
                    {item.label}
                  </span>
                  <span className="app-muted-text ml-auto text-[9px]">
                    {Math.min(item.count, item.required)} / {item.required}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section
          data-guide="interaction-launch"
          className="rounded-3xl border p-4"
          style={{
            borderColor: isInteractionReady
              ? COMPARE_TONE.color
              : "var(--app-border-soft)",
            backgroundColor: isInteractionReady
              ? COMPARE_TONE.soft
              : "#f6f3ed",
          }}
        >
          <div className="mb-3 flex items-center gap-1.5">
            <p className="text-xs font-black">互动练习台</p>
            <span className="group/hint relative flex items-center">
              <CircleAlert
                className="app-muted-text"
                size={13}
                aria-hidden="true"
              />
              <span className="app-card pointer-events-none invisible absolute right-full top-1/2 z-[180] mr-2 w-60 -translate-y-1/2 rounded-2xl border p-3 text-[10px] font-bold leading-5 opacity-0 shadow-lg transition group-hover/hint:visible group-hover/hint:opacity-100">
                完成精讲、拆解和对比的前置学习后，开放互动练习台。
              </span>
            </span>
          </div>
          <button
            type="button"
            disabled={!isInteractionReady}
            onClick={() => {
              if (!isInteractionReady) return;
              setHasInteractionStarted(true);
              setIsInteractionOpen(true);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-black text-white transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              backgroundColor: isInteractionReady
                ? COMPARE_TONE.color
                : "var(--app-muted)",
            }}
          >
            {isInteractionReady ? <Play size={14} /> : <LockKeyhole size={14} />}
            {interactionButtonLabel}
          </button>
          <p className="app-muted-text mt-2 text-center text-[9px] leading-4">
            {isInteractionReady
              ? hasInteractionStarted
                ? "拼装、拆解、纠错和分类将在独立互动平台中完成。"
                : "前置学习已完成，点击上方按钮开放互动练习台。"
              : "完成精讲、拆解和对比的全部案例后开放。"}
          </p>
        </section>

        <section className="app-card rounded-3xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-black">互动完成度</p>
            <span className="text-xs font-black" style={{ color: DECONSTRUCT_TONE.color }}>
              {masteredInteractions.size} / 4
            </span>
          </div>
          <p className="app-muted-text mt-2 text-[10px] leading-5">
            每类互动答对 3 题后计为完成。
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              ["assemble", "拼装", EXPLAIN_TONE],
              ["deconstruct", "拆解", DECONSTRUCT_TONE],
              ["repair", "纠错", COMPARE_TONE],
              ["classify", "分类", { color: "#8a6a2f", soft: "#f8f1df" }],
            ].map(([interactionType, label, tone]) => {
              const completed = masteredInteractions.has(
                interactionType as KnowledgeInteractionType
              );
              const itemTone = tone as typeof EXPLAIN_TONE;
              return (
                <span
                  key={String(interactionType)}
                  className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[10px] font-black"
                  style={{
                    color: completed ? "var(--app-success)" : itemTone.color,
                    backgroundColor: completed
                      ? "var(--app-success-soft)"
                      : itemTone.soft,
                  }}
                >
                  {completed ? (
                    <CheckCircle2 size={12} />
                  ) : (
                    <Circle size={12} />
                  )}
                  {String(label)}
                </span>
              );
            })}
          </div>
        </section>

        <section className="app-card rounded-3xl border p-3">
          <Link
            href={`/dashboard/courses/korean/korean-basic/korean-beginner/hangul-introduction?chapter=${encodeURIComponent(chapterSlug)}`}
            className="flex items-center justify-between rounded-2xl px-3 py-3 text-xs font-black"
          >
            返回对应电子书
            <ArrowRight size={13} />
          </Link>
          <Link
            href={`/dashboard/assignments/korean/${encodeURIComponent(chapterSlug)}`}
            className="mt-1 flex items-center justify-between rounded-2xl px-3 py-3 text-xs font-black text-white"
            style={{ backgroundColor: EXPLAIN_TONE.color }}
          >
            进入章节测试
            <ArrowRight size={13} />
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
          className="app-muted-text flex w-full items-center justify-center gap-2 py-2 text-[10px] font-black"
        >
          <RotateCcw size={12} />
          重置本次工作台
        </button>
      </aside>

      {hasInteractionStarted && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="韩文结构互动练习"
          className={`fixed inset-0 z-[160] items-center justify-center p-3 sm:p-6 ${
            isInteractionOpen ? "flex" : "hidden"
          }`}
          style={{ backgroundColor: "rgba(29, 27, 24, 0.66)" }}
        >
          <section className="app-card flex max-h-[94dvh] w-full max-w-[1180px] flex-col overflow-hidden rounded-3xl border shadow-2xl">
            <div
              className="flex items-center justify-between gap-4 border-b px-4 py-3 sm:px-5"
              style={{
                borderColor: "var(--app-border-soft)",
                backgroundColor: "#f6f3ed",
              }}
            >
              <div>
                <p className="text-sm font-black">韩文结构互动练习</p>
                <p className="app-muted-text mt-0.5 text-[9px]">
                  拼装 · 拆解 · 纠错 · 分类
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="rounded-full px-2.5 py-1 text-[9px] font-black"
                  style={{
                    color:
                      masteredInteractions.size === 4
                        ? "var(--app-success)"
                        : DECONSTRUCT_TONE.color,
                    backgroundColor:
                      masteredInteractions.size === 4
                        ? "var(--app-success-soft)"
                        : DECONSTRUCT_TONE.soft,
                  }}
                >
                  {masteredInteractions.size === 4
                    ? "全部完成"
                    : `${masteredInteractions.size} / 4 项完成`}
                </span>
                <button
                  type="button"
                  onClick={() => setIsInteractionOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border"
                  aria-label="关闭互动练习"
                  title="关闭互动练习"
                >
                  <X size={15} />
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
