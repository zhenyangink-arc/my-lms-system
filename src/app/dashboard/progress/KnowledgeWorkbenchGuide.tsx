"use client";

import {
  AudioLines,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type WorkbenchMode = "explain" | "deconstruct" | "compare";

type GuideStep = {
  title: string;
  description: string;
  instruction: string;
  target?: string;
  mode?: WorkbenchMode;
  color: string;
  soft: string;
};

const guideSteps: GuideStep[] = [
  {
    title: "欢迎进入知识精研工作台",
    description:
      "学习顺序是：精讲理解结构，拆解看清位置，对比发现差异，最后进入互动练习。",
    instruction: "跟随高亮区域逐步操作，随时可以关闭或重新打开本指引。",
    color: "#8a6a2f",
    soft: "#f8f1df",
  },
  {
    title: "先认识三个学习区域",
    description: "顶部依次是精讲、拆解和对比。完成当前区域后，再进入下一个区域。",
    instruction: "现在从“精讲”开始。",
    target: "mode-tabs",
    mode: "explain",
    color: "#376f8a",
    soft: "#eaf4f7",
  },
  {
    title: "第一步：查看精讲案例",
    description:
      "依次点击 가、고、한、읽，观察竖向元音、横向元音、单收音和复合收音。",
    instruction: "请至少点击不同案例，右侧掌握路径会记录查看进度。",
    target: "explain-cases",
    mode: "explain",
    color: "#376f8a",
    soft: "#eaf4f7",
  },
  {
    title: "第二步：动手改变音节",
    description: "分别更换初声、中声和终声，中央的音节方块会实时重新组合。",
    instruction: "尝试拼出一个没有终声的音节，再拼出一个带复合收音的音节。",
    target: "syllable-builder",
    mode: "explain",
    color: "#b06f3c",
    soft: "#fbf0e5",
  },
  {
    title: "第三步：完成知识收束",
    description: "这里整理了结构公式、布局口诀和特别提醒。",
    instruction: "进入拆解前，快速读完三张小卡片。",
    target: "summary-explain",
    mode: "explain",
    color: "#70558f",
    soft: "#f2edf8",
  },
  {
    title: "第四步：拆解音节",
    description: "进入拆解区，依次查看五个音节，分清初声、中声和终声。",
    instruction: "先找底部终声，再找元音，最后确认初声。",
    target: "deconstruct-content",
    mode: "deconstruct",
    color: "#70558f",
    soft: "#f2edf8",
  },
  {
    title: "第五步：比较差异",
    description: "进入对比区，观察元音方向、终声有无，以及字母与音节的区别。",
    instruction: "完成三组对比，找出每组发生变化的位置。",
    target: "compare-content",
    mode: "compare",
    color: "#b06f3c",
    soft: "#fbf0e5",
  },
  {
    title: "第六步：检查掌握路径",
    description: "右侧会显示精讲、拆解和对比的真实案例完成数量。",
    instruction: "只有三个区域全部完成，互动练习台才会开放。",
    target: "mastery-path",
    color: "#376f8a",
    soft: "#eaf4f7",
  },
  {
    title: "最后：进入互动练习台",
    description: "前置学习完成后，在这里开启拼装、拆解、纠错和分类练习。",
    instruction: "答对时会获得即时反馈；关闭后可以继续上次进度。",
    target: "interaction-launch",
    color: "#8a6a2f",
    soft: "#f8f1df",
  },
];

type HighlightRect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export function KnowledgeWorkbenchGuide({
  onClose,
  onModeChange,
}: {
  onClose: () => void;
  onModeChange: (mode: WorkbenchMode) => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);
  const step = guideSteps[stepIndex];

  const speakStep = useCallback(() => {
    if (!voiceEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      `${step.title}。${step.description}。${step.instruction}`
    );
    utterance.lang = "zh-CN";
    utterance.rate = 0.92;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }, [step, voiceEnabled]);

  useEffect(() => {
    if (step.mode) onModeChange(step.mode);
  }, [onModeChange, step.mode]);

  useEffect(() => {
    let locateTimer = 0;
    let measureTimer = 0;

    function measureHighlight() {
      if (!step.target) {
        setHighlightRect(null);
        return;
      }

      const target = document.querySelector<HTMLElement>(
        `[data-guide="${step.target}"]`
      );
      if (!target) {
        setHighlightRect(null);
        return;
      }

      const rect = target.getBoundingClientRect();
      const padding = 8;
      setHighlightRect({
        top: Math.max(6, rect.top - padding),
        left: Math.max(6, rect.left - padding),
        right: Math.min(window.innerWidth - 6, rect.right + padding),
        bottom: Math.min(window.innerHeight - 6, rect.bottom + padding),
        width: Math.min(window.innerWidth - 12, rect.width + padding * 2),
        height: Math.min(window.innerHeight - 12, rect.height + padding * 2),
      });
    }

    locateTimer = window.setTimeout(() => {
      if (!step.target) {
        setHighlightRect(null);
        return;
      }
      const target = document.querySelector<HTMLElement>(
        `[data-guide="${step.target}"]`
      );
      if (!target) return;
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      measureTimer = window.setTimeout(measureHighlight, 300);
    }, 100);

    window.addEventListener("resize", measureHighlight);
    window.addEventListener("scroll", measureHighlight, true);
    return () => {
      window.clearTimeout(locateTimer);
      window.clearTimeout(measureTimer);
      window.removeEventListener("resize", measureHighlight);
      window.removeEventListener("scroll", measureHighlight, true);
    };
  }, [step.target, step.mode]);

  useEffect(() => {
    const timer = window.setTimeout(speakStep, 340);
    return () => {
      window.clearTimeout(timer);
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [speakStep]);

  function closeGuide() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    onClose();
  }

  const viewportHeight =
    typeof window === "undefined" ? 900 : window.innerHeight;
  const viewportWidth =
    typeof window === "undefined" ? 1440 : window.innerWidth;
  const panelTop = highlightRect
    ? highlightRect.bottom + 220 < viewportHeight
      ? highlightRect.bottom + 12
      : Math.max(12, highlightRect.top - 208)
    : undefined;
  const panelLeft = highlightRect
    ? Math.min(
        Math.max(12, highlightRect.left),
        Math.max(12, viewportWidth - 380)
      )
    : undefined;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[240]"
      role="dialog"
      aria-modal="true"
    >
      {highlightRect ? (
        <>
          <div
            className="pointer-events-auto fixed left-0 right-0 top-0 bg-black/60"
            style={{ height: highlightRect.top }}
          />
          <div
            className="pointer-events-auto fixed bottom-0 left-0 right-0 bg-black/60"
            style={{ top: highlightRect.bottom }}
          />
          <div
            className="pointer-events-auto fixed left-0 bg-black/60"
            style={{
              top: highlightRect.top,
              width: highlightRect.left,
              height: highlightRect.height,
            }}
          />
          <div
            className="pointer-events-auto fixed right-0 bg-black/60"
            style={{
              top: highlightRect.top,
              left: highlightRect.right,
              height: highlightRect.height,
            }}
          />
          <div
            className="pointer-events-none fixed rounded-3xl border-[3px] shadow-[0_0_0_5px_rgba(255,255,255,.35),0_12px_40px_rgba(0,0,0,.3)]"
            style={{
              top: highlightRect.top,
              left: highlightRect.left,
              width: highlightRect.width,
              height: highlightRect.height,
              borderColor: step.color,
            }}
          />
        </>
      ) : (
        <div className="pointer-events-auto fixed inset-0 bg-black/65" />
      )}

      <section
        className={`app-card pointer-events-auto fixed w-[calc(100%-1.5rem)] max-w-[360px] rounded-3xl border p-4 shadow-2xl ${
          highlightRect ? "" : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        }`}
        style={{
          top: panelTop,
          left: panelLeft,
          borderColor: step.color,
          backgroundColor: "var(--card)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <span
            className="rounded-full px-2.5 py-1 text-[9px] font-bold"
            style={{ color: step.color, backgroundColor: step.soft }}
          >
            {stepIndex + 1} / {guideSteps.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setVoiceEnabled((current) => !current)}
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{ color: step.color, backgroundColor: step.soft }}
              aria-label={voiceEnabled ? "关闭语音说明" : "开启语音说明"}
              title={voiceEnabled ? "关闭语音说明" : "开启语音说明"}
            >
              {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
            <button
              type="button"
              onClick={speakStep}
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{ color: step.color, backgroundColor: step.soft }}
              aria-label="重播当前语音"
              title="重播当前语音"
            >
              <AudioLines size={14} />
            </button>
            <button
              type="button"
              onClick={closeGuide}
              className="flex h-8 w-8 items-center justify-center rounded-full border"
              aria-label="关闭教学指引"
              title="关闭教学指引"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <h2 className="mt-3 text-base font-bold">{step.title}</h2>
        <p className="app-muted-text mt-2 text-xs leading-6">
          {step.description}
        </p>
        <p
          className="mt-3 rounded-2xl px-3 py-2.5 text-[10px] font-bold leading-5"
          style={{ color: step.color, backgroundColor: step.soft }}
        >
          {step.instruction}
        </p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={stepIndex === 0}
            onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
            className="inline-flex items-center gap-1 text-[10px] font-bold disabled:opacity-30"
          >
            <ChevronLeft size={13} />
            上一步
          </button>
          <div className="flex gap-1">
            {guideSteps.map((item, index) => (
              <span
                key={item.title}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: index === stepIndex ? 18 : 6,
                  backgroundColor:
                    index <= stepIndex ? step.color : "var(--border-subtle)",
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              if (stepIndex === guideSteps.length - 1) {
                closeGuide();
              } else {
                setStepIndex((current) => current + 1);
              }
            }}
            className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-[10px] font-bold text-white"
            style={{ backgroundColor: step.color }}
          >
            {stepIndex === guideSteps.length - 1 ? "开始学习" : "下一步"}
            {stepIndex < guideSteps.length - 1 && <ChevronRight size={13} />}
          </button>
        </div>
      </section>
    </div>
  );
}
