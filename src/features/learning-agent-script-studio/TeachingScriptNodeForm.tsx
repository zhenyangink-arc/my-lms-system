"use client";

import { type KeyboardEvent as ReactKeyboardEvent, useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, BookOpenText, CheckCircle2, Link2, LoaderCircle, MessageCircleQuestion, Pause, Play, Plus, RotateCcw, Route, ScrollText, Trash2, VolumeX } from "lucide-react";

import {
  saveTeachingScriptNodeAction,
  type TeachingScriptActionState,
} from "@/app/dashboard/admin/teaching-scripts/actions";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import {
  buildOrientationLearningTargets,
  type SmartTextbookLearningTarget,
} from "@/lib/smart-textbook-learning-targets";
import {
  RICH_TEXT_COLOR_LABELS,
  RICH_TEXT_COLOR_VALUES,
  stripRichText,
  type RichTextColor,
} from "@/lib/rich-teaching-text";
import {
  isTeacherKimPose,
  TEACHER_KIM_POSES,
  TEACHER_KIM_POSE_LABELS,
  type TeacherKimPose,
} from "@/lib/teacher-kim-character";
import { teachingBlackboardSlidesFromDisplay, type TeachingBlackboardSlide } from "@/lib/teaching-blackboard";
import {
  normalizeTeachingBlackboardPlacement,
  normalizeTeachingVirtualCharacterPlacement,
  type TeachingBlackboardPlacement,
} from "@/lib/teaching-virtual-character";
import { TeachingBlackboardEditor } from "./TeachingBlackboardEditor";
import { VirtualCharacterStageEditor } from "./VirtualCharacterStageEditor";
import type { TeachingScriptActivity, TeachingScriptNode, TeachingScriptSpeechAsset } from "./types";

const initialState: TeachingScriptActionState = { status: "idle" };

function configuredText(node: TeachingScriptNode, key: string, locale: "zh-CN" | "ko-KR" = "zh-CN") {
  const value = node.configuration[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return String((value as Record<string, unknown>)[locale] ?? "");
}

function objectConfiguration(node: TeachingScriptNode, key: string) {
  const value = node.configuration[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function localizedConfigurationText(configuration: Record<string, unknown>, key: string) {
  const value = configuration[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return String((value as Record<string, unknown>)["zh-CN"] ?? "");
}

function FieldError({ id, errors }: { id?: string; errors?: string[] }) {
  if (!errors?.length) return null;
  return <span id={id} className="text-xs text-[var(--status-danger)] md:col-start-2" role="alert">{errors[0]}</span>;
}

function speechRate(value: number) {
  const percent = Math.round((Math.max(0.75, Math.min(1.25, value || 1)) - 1) * 100);
  return `${percent >= 0 ? "+" : ""}${percent}%`;
}

async function textSha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value.trim()));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function voiceLabel(manifest: Record<string, unknown>) {
  const voices = Array.isArray(manifest.voices)
    ? manifest.voices.filter((voice): voice is string => typeof voice === "string")
    : [];
  if (!voices.length) return "金老师正式声线";
  return voices.map((voice) => {
    if (voice.includes("Xiaoxiao")) return "中文·晓晓";
    if (voice.includes("SunHi")) return "韩语·SunHi";
    return voice;
  }).join(" + ");
}

const RICH_TEXT_COLORS = Object.keys(RICH_TEXT_COLOR_VALUES) as RichTextColor[];

/**
 * Textarea with a selection-triggered formatting toolbar (bold / underline /
 * color / clear) that wraps the selected text in the [b][u][color=] markup
 * parsed by src/lib/rich-teaching-text.ts. No external editor library —
 * scoped deliberately tiny since only two things ever need to read the
 * markup: this toolbar and the student-facing renderer.
 */
function FormattableTextarea({
  id,
  name,
  value,
  defaultValue,
  onChange,
  disabled,
  rows,
  maxLength,
  placeholder,
  className,
  onDirty,
  ariaLabelledBy,
  ariaDescribedBy,
  ariaInvalid,
}: {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  className?: string;
  onDirty?: () => void;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
}) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(value ?? defaultValue ?? "");
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isControlled) setInternalValue(value ?? "");
  }, [isControlled, value]);

  const currentValue = isControlled ? (value ?? "") : internalValue;

  function commitValue(nextValue: string, nextSelection?: { start: number; end: number }) {
    if (!isControlled) setInternalValue(nextValue);
    onChange?.(nextValue);
    onDirty?.();
    if (nextSelection) {
      setSelection(nextSelection);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(nextSelection.start, nextSelection.end);
      });
    }
  }

  function updateSelectionFromEvent() {
    const el = textareaRef.current;
    if (!el) return;
    setSelection(el.selectionStart !== el.selectionEnd ? { start: el.selectionStart, end: el.selectionEnd } : null);
  }

  function wrapSelection(openTag: string, closeTag: string) {
    if (!selection || selection.start === selection.end) return;
    const { start, end } = selection;
    const already = currentValue.slice(start - openTag.length, start) === openTag
      && currentValue.slice(end, end + closeTag.length) === closeTag;
    if (already) {
      commitValue(
        currentValue.slice(0, start - openTag.length) + currentValue.slice(start, end) + currentValue.slice(end + closeTag.length),
        { start: start - openTag.length, end: end - openTag.length },
      );
    } else {
      commitValue(
        currentValue.slice(0, start) + openTag + currentValue.slice(start, end) + closeTag + currentValue.slice(end),
        { start: start + openTag.length, end: end + openTag.length },
      );
    }
  }

  function clearFormatting() {
    if (!selection || selection.start === selection.end) return;
    const { start, end } = selection;
    const stripped = stripRichText(currentValue.slice(start, end));
    commitValue(
      currentValue.slice(0, start) + stripped + currentValue.slice(end),
      { start, end: start + stripped.length },
    );
  }

  const hasSelection = Boolean(selection && selection.end > selection.start && !disabled);

  return (
    <div ref={wrapperRef} className="space-y-1.5">
      {hasSelection && (
        <div role="toolbar" aria-label="文字格式工具栏" className="flex flex-wrap items-center gap-1 border border-[var(--border)] bg-[var(--card)] p-1.5">
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => wrapSelection("[b]", "[/b]")} aria-label="加粗" className="inline-flex h-11 min-w-11 items-center justify-center px-2 text-xs font-bold hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">B</button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => wrapSelection("[u]", "[/u]")} aria-label="下划线" className="inline-flex h-11 min-w-11 items-center justify-center px-2 text-xs font-semibold underline hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">U</button>
          <span aria-hidden="true" className="mx-1 h-5 w-px bg-[var(--border)]" />
          {RICH_TEXT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => wrapSelection(`[color=${color}]`, "[/color]")}
              aria-label={`文字颜色：${RICH_TEXT_COLOR_LABELS[color]}`}
              className="inline-flex h-11 w-11 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <span aria-hidden="true" className="block h-4 w-4 rounded-full border border-[var(--border)]" style={{ backgroundColor: RICH_TEXT_COLOR_VALUES[color] }} />
            </button>
          ))}
          <span aria-hidden="true" className="mx-1 h-5 w-px bg-[var(--border)]" />
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={clearFormatting} className="inline-flex min-h-11 items-center px-3 text-xs font-medium text-[var(--foreground-secondary)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">清除格式</button>
        </div>
      )}
      <textarea
        ref={textareaRef}
        id={id}
        name={name}
        value={currentValue}
        onChange={(event) => commitValue(event.target.value)}
        onSelect={updateSelectionFromEvent}
        onMouseUp={updateSelectionFromEvent}
        onTouchEnd={updateSelectionFromEvent}
        onKeyUp={updateSelectionFromEvent}
        onBlur={(event) => {
          const next = event.relatedTarget as Node | null;
          if (!next || !wrapperRef.current?.contains(next)) setSelection(null);
        }}
        disabled={disabled}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid || undefined}
        className={className}
      />
    </div>
  );
}

function ScriptSpeechReview({
  text,
  performance,
  asset,
  fromPublishedVersion,
}: {
  text: string;
  performance: ScriptPerformance;
  asset?: TeachingScriptSpeechAsset;
  fromPublishedVersion: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [contentHash, setContentHash] = useState("");
  const [checking, setChecking] = useState(Boolean(text.trim()));
  const [audioStatus, setAudioStatus] = useState<"idle" | "loading" | "playing" | "paused" | "ended" | "error">("idle");
  const [audioError, setAudioError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const normalized = stripRichText(text).trim();
    setContentHash("");
    setChecking(Boolean(normalized));
    const timer = window.setTimeout(() => {
      if (!normalized) {
        setChecking(false);
        return;
      }
      void textSha256(normalized).then((hash) => {
        if (!cancelled) {
          setContentHash(hash);
          setChecking(false);
        }
      });
    }, 160);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [text]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.onpause = null;
      audio.pause();
      audioRef.current = null;
    }
    setAudioStatus("idle");
    setAudioError("");
  }, [asset?.id, contentHash, performance.voiceEnabled, performance.voiceRate]);

  useEffect(() => () => audioRef.current?.pause(), []);

  const hashMatches = Boolean(asset && contentHash && asset.contentHash === contentHash);
  const rateMatches = Boolean(asset && String(asset.voiceManifest.rate ?? "+0%") === speechRate(performance.voiceRate));
  const matched = performance.voiceEnabled
    && asset?.productionStatus === "ready"
    && hashMatches
    && rateMatches;

  async function playAudio(restart = false) {
    if (!matched || !asset) return;
    setAudioError("");
    let audio = audioRef.current;
    try {
      if (!audio) {
        setAudioStatus("loading");
        const response = await fetch(`/api/learning-agent/speech/${encodeURIComponent(asset.id)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("无法读取这条语音，请稍后重试。");
        const payload = await response.json() as { audioUrl?: unknown };
        if (typeof payload.audioUrl !== "string" || !payload.audioUrl) throw new Error("语音地址无效。");
        audio = new Audio(payload.audioUrl);
        audio.preload = "auto";
        audio.onplaying = () => setAudioStatus("playing");
        audio.onpause = () => {
          if (!audio?.ended) setAudioStatus("paused");
        };
        audio.onended = () => setAudioStatus("ended");
        audio.onerror = () => {
          setAudioStatus("error");
          setAudioError("语音加载失败，请稍后重试。");
        };
        audioRef.current = audio;
      }
      if (restart || audio.ended) audio.currentTime = 0;
      await audio.play();
    } catch (error) {
      setAudioStatus("error");
      setAudioError(error instanceof Error ? error.message : "语音播放失败，请稍后重试。");
    }
  }

  function toggleAudio() {
    const audio = audioRef.current;
    if (audio && !audio.paused) audio.pause();
    else void playAudio(false);
  }

  let state: "disabled" | "checking" | "missing" | "stale" | "ready" = "missing";
  let statusText = "这句台词还没有生成语音";
  if (!performance.voiceEnabled) {
    state = "disabled";
    statusText = "这句设置为只显示文字，不朗读";
  } else if (!text.trim()) {
    state = "disabled";
    statusText = "填写台词后才能生成和校对语音";
  } else if (checking) {
    state = "checking";
    statusText = "正在核对当前台词与语音…";
  } else if (!asset) {
    state = "missing";
  } else if (asset.productionStatus !== "ready") {
    state = "missing";
    statusText = asset.productionStatus === "failed" ? "语音生成失败，需要重新生成" : "语音正在生成中";
  } else if (!hashMatches) {
    state = "stale";
    statusText = "台词已修改，旧语音已停用，需要重新生成";
  } else if (!rateMatches) {
    state = "stale";
    statusText = "语速设置已修改，需要重新生成语音";
  } else {
    state = "ready";
    statusText = "语音与当前台词一致";
  }

  const StatusIcon = state === "ready"
    ? CheckCircle2
    : state === "checking"
      ? LoaderCircle
      : state === "disabled"
        ? VolumeX
        : AlertTriangle;
  const statusClass = state === "ready"
    ? "text-[var(--status-success)]"
    : state === "stale" || state === "missing"
      ? "text-[var(--status-warning)]"
      : "text-[var(--muted-foreground)]";

  return (
    <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5" aria-busy={audioStatus === "loading" || checking}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className={`inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold ${statusClass}`}>
          <StatusIcon size={15} className={state === "checking" ? "animate-spin motion-reduce:animate-none" : ""} aria-hidden="true" />
          <span>{statusText}</span>
        </span>
        {matched && asset && (
          <span className="text-xs text-[var(--muted-foreground)]">
            {voiceLabel(asset.voiceManifest)} · {(asset.durationMs / 1000).toFixed(1)} 秒
            {asset.updatedAt ? ` · ${asset.updatedAt.replace("T", " ").slice(0, 16)} 生成` : ""}
            {fromPublishedVersion ? " · 已发布版本" : ""}
          </span>
        )}
      </div>
      {matched && asset && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleAudio}
            disabled={audioStatus === "loading"}
            className="inline-flex min-h-11 items-center gap-2 border border-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary)] transition hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-wait disabled:opacity-50"
          >
            {audioStatus === "loading"
              ? <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              : audioStatus === "playing"
                ? <Pause size={15} aria-hidden="true" />
                : <Play size={15} aria-hidden="true" />}
            {audioStatus === "loading" ? "正在读取…" : audioStatus === "playing" ? "暂停试听" : audioStatus === "paused" ? "继续试听" : "试听语音"}
          </button>
          <button type="button" onClick={() => void playAudio(true)} className="inline-flex min-h-11 items-center gap-2 px-3 text-xs font-semibold text-[var(--foreground-secondary)] transition hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
            <RotateCcw size={15} aria-hidden="true" />重新播放
          </button>
          <span className="text-xs text-[var(--muted-foreground)]">正式语音</span>
        </div>
      )}
      {audioError && <p className="mt-2 text-xs font-medium text-[var(--status-danger)]" role="alert">{audioError}</p>}
    </div>
  );
}

type EditorSection = "script" | "content" | "interaction" | "flow";

const errorSectionByField: Partial<Record<string, EditorSection>> = {
  nodeKey: "flow",
  nodeType: "flow",
  titleZh: "script",
  titleKo: "script",
  scriptZh: "script",
  scriptKo: "script",
  hintZh: "script",
  exampleZh: "script",
  bufferLineZh: "script",
  scriptPerformances: "script",
  displayKind: "content",
  displayTitleZh: "content",
  displayItemsZh: "content",
  displayKorean: "content",
  displayTranslationZh: "content",
  displaySlidesJson: "content",
  virtualCharacterKind: "content",
  virtualCharacterPosition: "content",
  studentTaskKind: "content",
  studentTaskTargetKey: "content",
  visualCueTargetKey: "content",
  interactionKind: "interaction",
  interactionPromptZh: "interaction",
  interactionOptions: "interaction",
  interactionCorrectOption: "interaction",
  interactionCorrectFeedbackZh: "interaction",
  interactionIncorrectFeedbackZh: "interaction",
  referenceActivityId: "interaction",
  remediationNodeKey: "interaction",
  flowMode: "flow",
  nextNodeKey: "flow",
  continueLabelZh: "flow",
};

type FlowMode = "sequence" | "jump" | "end";

type ScriptPerformance = {
  pose: TeacherKimPose;
  voiceEnabled: boolean;
  voiceLanguage: "auto" | "zh-CN" | "ko-KR";
  voiceRate: number;
  /** Only honored in the platform-owner preview: skip waiting for "继续" and play straight into the next 台词. */
  autoContinueToNext: boolean;
  characterX: number;
  characterY: number;
  characterScale: number;
};

type InteractionOptionEditor = {
  id: string;
  value: string;
};

function scriptPerformanceConfiguration(value: unknown, fallback: Record<string, unknown>): ScriptPerformance {
  const performance = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : fallback;
  const pose = isTeacherKimPose(performance.pose) ? performance.pose : "explaining";
  const voiceLanguage = performance.voiceLanguage === "zh-CN" || performance.voiceLanguage === "ko-KR"
    ? performance.voiceLanguage
    : "auto";
  const voiceRate = Number(performance.voiceRate);
  const placement = normalizeTeachingVirtualCharacterPlacement(performance, fallback.position);
  return {
    pose,
    voiceEnabled: performance.voiceEnabled !== false,
    voiceLanguage,
    voiceRate: Number.isFinite(voiceRate) ? Math.max(0.75, Math.min(1.25, voiceRate)) : 1,
    autoContinueToNext: performance.autoContinueToNext === true,
    characterX: placement.x,
    characterY: placement.y,
    characterScale: placement.scale,
  };
}

const editorSteps: Array<{
  id: EditorSection;
  label: string;
  description: string;
  icon: typeof ScrollText;
}> = [
  { id: "script", label: "老师台词", description: "先写这一小节怎么讲", icon: ScrollText },
  { id: "content", label: "画面与人物", description: "安排黑板内容、人物动作和学习区联动", icon: BookOpenText },
  { id: "interaction", label: "学生互动", description: "按需让学生参与并设置反馈", icon: MessageCircleQuestion },
  { id: "flow", label: "后续流程", description: "最后决定如何进入下一小节", icon: Route },
];

const panelClass = "space-y-4";
const fieldClass = "grid gap-2 px-4 py-3 text-sm font-medium md:grid-cols-[7rem_minmax(0,1fr)]";
const inputClass = "app-input min-h-11 w-full border px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-65";
const formGroupClass = "overflow-hidden rounded-xl divide-y divide-[var(--border)] border border-[var(--border)] bg-[var(--card)]";
const formSectionClass = "border-l-2 border-l-[var(--primary)] bg-[var(--muted)]/30 px-4 py-3";
const formSectionTitleClass = "text-sm font-semibold leading-6 text-[var(--foreground)]";
const formFieldLabelClass = "pt-3 font-semibold leading-6 text-[var(--foreground)]";

const stepLearningTargetLabels: Record<number, { content: string; scene: string }> = {
  1: { content: "整个“课前导航”学习内容区", scene: "页面顶部的课前导航情景图片" },
  2: { content: "整个“核心词汇”学习内容区", scene: "页面顶部的核心词汇情景图片" },
  3: { content: "整个“语法讲解”学习内容区", scene: "页面顶部的语法讲解情景图片" },
  4: { content: "整个“句型操练”学习内容区", scene: "页面顶部的句型操练情景图片" },
  5: { content: "整个“实战对话”学习内容区", scene: "页面顶部的实战对话情景图片" },
  6: { content: "整个“听说任务”学习内容区", scene: "页面顶部的听说任务情景图片" },
  7: { content: "整个“读写拓展”学习内容区", scene: "页面顶部的读写拓展情景图片" },
  8: { content: "整个“自测与复盘”学习内容区", scene: "页面顶部的自测与复盘情景图片" },
};

function teachingActivityLabel(type: string) {
  if (type === "single_choice") return "单选题";
  if (type === "multiple_choice") return "多选题";
  if (type === "ordering") return "排序练习";
  if (type === "listening") return "听力任务";
  if (type === "speaking") return "口语任务";
  if (type === "writing") return "写作任务";
  if (type === "self_check") return "自我检查";
  return "互动活动";
}

export function TeachingScriptNodeForm({
  node,
  allNodes,
  activities,
  learningTargets,
  moduleCode,
  moduleOrder,
  chapterNumber,
  returnTo,
  editable,
  onDirtyChange,
}: {
  node: TeachingScriptNode;
  allNodes: TeachingScriptNode[];
  activities: TeachingScriptActivity[];
  learningTargets: SmartTextbookLearningTarget[];
  moduleCode: string;
  moduleOrder: number;
  chapterNumber: number;
  returnTo: string;
  editable: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveTeachingScriptNodeAction, initialState);
  const formRef = useRef<HTMLFormElement | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const display = objectConfiguration(node, "display");
  const studentTask = objectConfiguration(node, "studentTask");
  const visualCue = objectConfiguration(node, "visualCue");
  const virtualCharacter = objectConfiguration(node, "virtualCharacter");
  const interaction = objectConfiguration(node, "interaction");
  const storedInteractionOptions = Array.isArray(interaction.options)
    ? interaction.options.filter((item): item is string => typeof item === "string")
    : [];
  const initialInteractionOptions = storedInteractionOptions.length >= 2
    ? storedInteractionOptions
    : ["", ""];
  const initialInteractionKind = interaction.kind === "single_choice"
    ? "single_choice"
    : node.referenceActivityId
      ? "referenced_activity"
      : "none";
  const initialFlowMode: FlowMode = node.configuration.terminal === true
    ? "end"
    : node.nextNodeKey
      ? "jump"
      : "sequence";
  const learningTargetLabels = stepLearningTargetLabels[moduleOrder] ?? {
    content: "当前步骤主要内容",
    scene: "当前步骤情景图片",
  };
  const availableLearningTargets = learningTargets.length > 0
    ? learningTargets
    : moduleCode === "orientation" && chapterNumber === 1
      ? buildOrientationLearningTargets({ activities })
      : [];
  const knownVisualCueTargetKeys = new Set([
    "",
    "content:current",
    "scene:image",
    ...activities.map((activity) => `activity:${activity.id}`),
  ]);
  const storedVisualCueTargetKey = String(visualCue.targetKey ?? "");
  const storedLearningTarget = availableLearningTargets.find((item) => item.key === storedVisualCueTargetKey);
  const actionableLearningTargets = availableLearningTargets.filter((item) => item.supportsStudentAction);
  const storedStudentTaskTargetKey = String(studentTask.targetKey ?? "");
  const storedStudentTaskTarget = actionableLearningTargets.find((item) => item.key === storedStudentTaskTargetKey);
  const [scriptLines, setScriptLines] = useState(() => {
    const lines = node.script["zh-CN"].split(/\n\s*\n/);
    return lines.length > 0 ? lines : [""];
  });
  const [bufferLineZh, setBufferLineZh] = useState(() => configuredText(node, "bufferLine", "zh-CN"));
  const [bufferLineKo, setBufferLineKo] = useState(() => configuredText(node, "bufferLine", "ko-KR"));
  const storedScriptPerformances = Array.isArray(node.configuration.scriptPerformances)
    ? node.configuration.scriptPerformances
    : [];
  const [scriptPerformances, setScriptPerformances] = useState<ScriptPerformance[]>(() =>
    scriptLines.map((_, index) => scriptPerformanceConfiguration(storedScriptPerformances[index], {
      ...virtualCharacter,
      pose: virtualCharacter.pose ?? (index === 0 ? "greeting" : "explaining"),
    })),
  );
  const [sectionDefaultVoice, setSectionDefaultVoice] = useState<{ language: ScriptPerformance["voiceLanguage"]; rate: number }>(() => ({
    language: scriptPerformanceConfiguration(storedScriptPerformances[0], virtualCharacter).voiceLanguage,
    rate: scriptPerformanceConfiguration(storedScriptPerformances[0], virtualCharacter).voiceRate,
  }));
  const [editorSection, setEditorSection] = useState<EditorSection>("script");
  const [selectedCharacterLineIndex, setSelectedCharacterLineIndex] = useState(0);
  const [blackboardSlides, setBlackboardSlides] = useState<TeachingBlackboardSlide[]>(() =>
    teachingBlackboardSlidesFromDisplay(display),
  );
  const [blackboardPlacement, setBlackboardPlacement] = useState<TeachingBlackboardPlacement>(() =>
    normalizeTeachingBlackboardPlacement(display.placement),
  );
  const [dirty, setDirty] = useState(false);
  const [visualCueTargetKey, setVisualCueTargetKey] = useState(storedVisualCueTargetKey);
  const [visualCuePageKey, setVisualCuePageKey] = useState(
    storedLearningTarget?.pageKey ?? (storedVisualCueTargetKey ? "legacy" : ""),
  );
  const [visualCueRegionKey, setVisualCueRegionKey] = useState(storedLearningTarget?.regionKey ?? "");
  const [studentTaskKind, setStudentTaskKind] = useState(String(studentTask.kind ?? "none"));
  const [studentTaskTargetKey, setStudentTaskTargetKey] = useState(storedStudentTaskTargetKey);
  const [studentTaskFollowsVisualCue, setStudentTaskFollowsVisualCue] = useState(
    typeof studentTask.followVisualCue === "boolean"
      ? studentTask.followVisualCue
      : !storedStudentTaskTargetKey || storedStudentTaskTargetKey === storedVisualCueTargetKey,
  );
  const [studentTaskPageKey, setStudentTaskPageKey] = useState(
    storedStudentTaskTarget?.pageKey ?? (storedStudentTaskTargetKey ? "legacy" : ""),
  );
  const [studentTaskRegionKey, setStudentTaskRegionKey] = useState(storedStudentTaskTarget?.regionKey ?? "");
  const [interactionKind, setInteractionKind] = useState(initialInteractionKind);
  const [referenceActivityId, setReferenceActivityId] = useState(node.referenceActivityId ?? "");
  const [flowMode, setFlowMode] = useState<FlowMode>(initialFlowMode);
  const [nextNodeKey, setNextNodeKey] = useState(node.nextNodeKey ?? "");
  const [interactionOptionRows, setInteractionOptionRows] = useState<InteractionOptionEditor[]>(() =>
    initialInteractionOptions.map((value, index) => ({ id: `stored-option-${index}`, value })),
  );
  const [interactionCorrectOptionIndex, setInteractionCorrectOptionIndex] = useState(() =>
    Math.max(0, Math.min(initialInteractionOptions.length - 1, node.interactionSecret?.correctOptionIndex ?? 0)),
  );

  const selectedLearningTarget = availableLearningTargets.find((item) => item.key === visualCueTargetKey);
  const learningTargetPages = Array.from(new Map(
    availableLearningTargets.map((item) => [item.pageKey, { key: item.pageKey, label: item.pageLabel }]),
  ).values());
  const learningTargetRegions = Array.from(new Map(
    availableLearningTargets
      .filter((item) => item.pageKey === visualCuePageKey)
      .map((item) => [item.regionKey, { key: item.regionKey, label: item.regionLabel }]),
  ).values());
  const learningTargetObjects = availableLearningTargets.filter((item) =>
    item.pageKey === visualCuePageKey && item.regionKey === visualCueRegionKey,
  );
  const selectedLearningTargetPath = selectedLearningTarget
    ? [selectedLearningTarget.pageLabel, selectedLearningTarget.regionLabel, selectedLearningTarget.label]
        .filter((item, index, values) => index === 0 || item !== values[index - 1])
        .join(" → ")
    : "";
  const selectedStudentTaskTarget = actionableLearningTargets.find((item) => item.key === studentTaskTargetKey);
  const studentTaskPages = Array.from(new Map(
    actionableLearningTargets.map((item) => [item.pageKey, { key: item.pageKey, label: item.pageLabel }]),
  ).values());
  const studentTaskRegions = Array.from(new Map(
    actionableLearningTargets
      .filter((item) => item.pageKey === studentTaskPageKey)
      .map((item) => [item.regionKey, { key: item.regionKey, label: item.regionLabel }]),
  ).values());
  const studentTaskObjects = actionableLearningTargets.filter((item) =>
    item.pageKey === studentTaskPageKey && item.regionKey === studentTaskRegionKey,
  );
  const selectedStudentTaskPath = selectedStudentTaskTarget
    ? [selectedStudentTaskTarget.pageLabel, selectedStudentTaskTarget.regionLabel, selectedStudentTaskTarget.label]
        .filter((item, index, values) => index === 0 || item !== values[index - 1])
        .join(" → ")
    : "";
  const linkedStudentTaskTarget = selectedLearningTarget?.supportsStudentAction
    ? selectedLearningTarget
    : undefined;
  const effectiveStudentTaskTarget = studentTaskFollowsVisualCue
    ? linkedStudentTaskTarget
    : selectedStudentTaskTarget;
  const effectiveStudentTaskPath = effectiveStudentTaskTarget
    ? [effectiveStudentTaskTarget.pageLabel, effectiveStudentTaskTarget.regionLabel, effectiveStudentTaskTarget.label]
        .filter((item, index, values) => index === 0 || item !== values[index - 1])
        .join(" → ")
    : "";

  function markDirty() {
    if (!editable) return;
    setDirty(true);
    onDirtyChange(true);
  }

  function handleEditorTabKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % editorSteps.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + editorSteps.length) % editorSteps.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = editorSteps.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    setEditorSection(editorSteps[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  }

  function selectLearningTargetPage(pageKey: string) {
    markDirty();
    setVisualCuePageKey(pageKey);
    if (!pageKey) {
      setVisualCueRegionKey("");
      setVisualCueTargetKey("");
      return;
    }
    const pageTargets = availableLearningTargets.filter((item) => item.pageKey === pageKey);
    const nextTarget = pageTargets.find((item) => item.scope === "page")
      ?? pageTargets.find((item) => item.scope === "region")
      ?? pageTargets[0];
    setVisualCueRegionKey(nextTarget?.regionKey ?? "");
    setVisualCueTargetKey(nextTarget?.key ?? "");
  }

  function selectLearningTargetRegion(regionKey: string) {
    markDirty();
    setVisualCueRegionKey(regionKey);
    const regionTargets = availableLearningTargets.filter((item) =>
      item.pageKey === visualCuePageKey && item.regionKey === regionKey,
    );
    const nextTarget = regionTargets.find((item) => item.scope === "page" || item.scope === "region")
      ?? regionTargets[0];
    setVisualCueTargetKey(nextTarget?.key ?? "");
  }

  function selectStudentTaskPage(pageKey: string) {
    markDirty();
    setStudentTaskPageKey(pageKey);
    if (!pageKey) {
      setStudentTaskRegionKey("");
      setStudentTaskTargetKey("");
      return;
    }
    const pageTargets = actionableLearningTargets.filter((item) => item.pageKey === pageKey);
    const nextTarget = pageTargets[0];
    setStudentTaskRegionKey(nextTarget?.regionKey ?? "");
    setStudentTaskTargetKey(nextTarget?.key ?? "");
  }

  function selectStudentTaskRegion(regionKey: string) {
    markDirty();
    setStudentTaskRegionKey(regionKey);
    const nextTarget = actionableLearningTargets.find((item) =>
      item.pageKey === studentTaskPageKey && item.regionKey === regionKey,
    );
    setStudentTaskTargetKey(nextTarget?.key ?? "");
  }

  function updateInteractionOption(index: number, value: string) {
    setInteractionOptionRows((current) => current.map((option, optionIndex) =>
      optionIndex === index ? { ...option, value } : option,
    ));
  }

  function addInteractionOption() {
    markDirty();
    setInteractionOptionRows((current) => current.length >= 6
      ? current
      : [...current, { id: crypto.randomUUID(), value: "" }]);
  }

  function removeInteractionOption(index: number) {
    markDirty();
    setInteractionOptionRows((current) => current.length <= 2
      ? current
      : current.filter((_, optionIndex) => optionIndex !== index));
    setInteractionCorrectOptionIndex((current) => {
      if (current === index) return 0;
      return current > index ? current - 1 : current;
    });
  }

  function moveInteractionOption(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= interactionOptionRows.length) return;
    markDirty();
    setInteractionOptionRows((current) => {
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
    setInteractionCorrectOptionIndex((current) => {
      if (current === index) return targetIndex;
      if (current === targetIndex) return index;
      return current;
    });
  }

  useEffect(() => {
    if (state.status === "success") {
      setDirty(false);
      onDirtyChange(false);
      router.refresh();
    }
  }, [onDirtyChange, router, state.status]);

  const formErrorMessages = Object.values(state.fieldErrors ?? {}).flat();
  useEffect(() => {
    if (state.status !== "error" || !state.fieldErrors) return;
    const firstInvalidField = Object.keys(state.fieldErrors).find((key) => state.fieldErrors?.[key]?.length);
    const section = firstInvalidField ? errorSectionByField[firstInvalidField] : undefined;
    if (section) setEditorSection(section);
    window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
  }, [state.fieldErrors, state.status]);

  return (
    <form ref={formRef} action={action} onChangeCapture={markDirty} onInputCapture={markDirty} className="space-y-4" key={node.id}>
      <input type="hidden" name="node_id" value={node.id} />
      <input type="hidden" name="return_to" value={returnTo} />
      <input type="hidden" name="display_kind" value={String(display.kind ?? "overview")} />

      <div className="flex flex-wrap gap-1 rounded-xl border border-[var(--border)] bg-[var(--muted)]/35 p-1" role="tablist" aria-label="教学小节编辑步骤">
        {editorSteps.map((step, index) => {
          const Icon = step.icon;
          const selected = editorSection === step.id;
          return (
            <div
              key={step.id}
              className={`relative min-h-12 min-w-[9.5rem] flex-1 rounded-lg transition sm:flex-none ${selected ? "bg-[var(--card)] text-[var(--primary)] shadow-sm" : "text-[var(--foreground-secondary)] hover:bg-[var(--card)]/70"}`}
            >
              <button
                ref={(element) => { tabRefs.current[index] = element; }}
                id={`teaching-${step.id}-tab`}
                type="button"
                role="tab"
                aria-controls={`teaching-${step.id}-panel`}
                aria-selected={selected}
                aria-label={`第 ${index + 1} 步：${step.label}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setEditorSection(step.id)}
                onKeyDown={(event) => handleEditorTabKeyDown(event, index)}
                className="flex min-h-12 w-full min-w-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 pr-10 text-left text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
              >
                <span className="tabular-nums text-[var(--muted-foreground)]">{index + 1}</span>
                <Icon size={15} className="shrink-0" aria-hidden="true" />
                <span>{step.label}</span>
              </button>
              <CardTitleWithHint
                title={<span className="sr-only">{step.label}</span>}
                description={step.description}
                headingLevel={3}
                className="absolute right-2.5 top-1/2 shrink-0 -translate-y-1/2 gap-0"
                titleClassName="sr-only"
                hintLabel={`查看${step.label}说明`}
              />
            </div>
          );
        })}
      </div>

      {state.status === "error" && formErrorMessages.length > 0 && (
        <div ref={errorSummaryRef} tabIndex={-1} role="alert" className="border border-[var(--status-danger)] bg-[var(--status-danger-surface)] px-4 py-3 text-sm text-[var(--status-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--status-danger)]">
          <p className="font-semibold">当前小节有 {formErrorMessages.length} 项需要修改，已打开第一个错误所在的设置。</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5">
            {formErrorMessages.map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}
          </ul>
        </div>
      )}

      <div className="grid items-start gap-4">
        <div className="min-w-0">
          <div id="teaching-script-panel" hidden={editorSection !== "script"} role="tabpanel" aria-labelledby="teaching-script-tab" className={panelClass}>
            <section className={formGroupClass} aria-labelledby="script-group-title">
            <div className={formSectionClass}>
              <CardTitleWithHint title={<span id="script-group-title">小节讲解</span>} description="小节名称和老师台词由你决定。提示与补充例子只在学生主动需要时出现。" headingLevel={3} titleClassName={formSectionTitleClass} hintClassName="-my-2" hintLabel="查看小节讲解说明" />
            </div>
            <label className={fieldClass}>
              <span className={formFieldLabelClass}>小节名称</span>
              <input name="title_zh" defaultValue={node.title["zh-CN"]} disabled={!editable} maxLength={80} aria-invalid={Boolean(state.fieldErrors?.titleZh?.length) || undefined} aria-describedby={state.fieldErrors?.titleZh?.length ? "title-zh-error" : undefined} className={inputClass} />
              <FieldError id="title-zh-error" errors={state.fieldErrors?.titleZh} />
            </label>
            <div className={fieldClass}>
              <CardTitleWithHint
                title="小节默认语音"
                description="先在这里定好这一小节的朗读语言和语速，套用到全部台词后，只需要单独修改需要不一样的那几句。"
                headingLevel={4}
                titleClassName={formFieldLabelClass}
                hintClassName="-my-3 -mr-3"
                hintLabel="查看小节默认语音说明"
              />
              <div className="flex flex-wrap items-end gap-3 rounded-lg bg-[var(--muted)]/30 p-3">
                <label className="space-y-1.5 text-xs font-medium">
                  <span className="block font-semibold text-[var(--foreground)]">朗读语言</span>
                  <select
                    value={sectionDefaultVoice.language}
                    onChange={(event) => setSectionDefaultVoice((current) => ({ ...current, language: event.target.value as ScriptPerformance["voiceLanguage"] }))}
                    disabled={!editable}
                    className={inputClass}
                  >
                    <option value="auto">自动判断</option>
                    <option value="zh-CN">中文</option>
                    <option value="ko-KR">韩语</option>
                  </select>
                </label>
                <label className="space-y-1.5 text-xs font-medium">
                  <span className="block font-semibold text-[var(--foreground)]">语速</span>
                  <select
                    value={String(sectionDefaultVoice.rate)}
                    onChange={(event) => setSectionDefaultVoice((current) => ({ ...current, rate: Number(event.target.value) }))}
                    disabled={!editable}
                    className={inputClass}
                  >
                    <option value="0.85">慢速</option>
                    <option value="1">标准</option>
                    <option value="1.15">稍快</option>
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!editable}
                  onClick={() => {
                    markDirty();
                    setScriptPerformances((current) => current.map((item) => ({ ...item, voiceEnabled: true, voiceLanguage: sectionDefaultVoice.language, voiceRate: sectionDefaultVoice.rate })));
                  }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary)] transition hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-45 sm:ml-auto"
                >
                  应用到全部台词
                </button>
              </div>
            </div>
            <div className={fieldClass}>
              <CardTitleWithHint
                title={<span id="buffer-line-label" className={formFieldLabelClass}>过渡台词</span>}
                description="进入这个小节时，在正式讲解加载完成之前，老师立即先说的第一句话。用来填补网络等待的空白，不需要很长，一两句自然的过渡语就够了。"
                headingLevel={3}
                hintLabel="查看过渡台词说明"
              />
              <div className="min-w-0 rounded-lg bg-[var(--muted)]/20 p-3">
                <FormattableTextarea id="buffer-line-zh" name="buffer_line_zh" value={bufferLineZh} onChange={setBufferLineZh} onDirty={markDirty} disabled={!editable} rows={3} maxLength={200} placeholder="例如：稍等一下，我看看这里怎么讲…" ariaLabelledBy="buffer-line-label" className={`${inputClass} min-h-24 resize-y py-3 text-sm leading-6`} />
                <ScriptSpeechReview
                  text={bufferLineZh}
                  performance={scriptPerformances[0] ?? scriptPerformanceConfiguration(null, {})}
                  asset={node.speechAssets.find((item) => item.locale === "zh-CN" && item.segmentIndex === 199)}
                  fromPublishedVersion={node.speechAssetsFromPublishedVersion}
                />
              </div>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {scriptLines.map((line, index) => (
                <div key={index} className={fieldClass}>
                  <label htmlFor={`script-line-${index}`} className={formFieldLabelClass}>台词 {index + 1}</label>
                  <div>
                    <FormattableTextarea
                      id={`script-line-${index}`}
                      name="script_zh"
                      value={line}
                      onChange={(nextValue) => setScriptLines((current) => current.map((item, lineIndex) => lineIndex === index ? nextValue : item))}
                      onDirty={markDirty}
                      ariaInvalid={Boolean(state.fieldErrors?.scriptZh?.length)}
                      ariaDescribedBy={state.fieldErrors?.scriptZh?.length ? "script-zh-error" : undefined}
                      disabled={!editable}
                      rows={2}
                      maxLength={1600}
                      className={`${inputClass} resize-y overflow-y-hidden py-3 text-sm leading-7`}
                    />
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <label className="space-y-1.5 text-xs font-medium">
                        <span className="block font-semibold text-[var(--foreground)]">人物动作</span>
                        <select
                          name="script_pose"
                          value={scriptPerformances[index]?.pose ?? "explaining"}
                          onChange={(event) => setScriptPerformances((current) => current.map((item, performanceIndex) => performanceIndex === index ? { ...item, pose: event.target.value as ScriptPerformance["pose"] } : item))}
                          disabled={!editable}
                          className={inputClass}
                        >
                          {TEACHER_KIM_POSES.map((pose) => (
                            <option key={pose} value={pose}>{TEACHER_KIM_POSE_LABELS[pose]}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1.5 text-xs font-medium">
                        <span className="block font-semibold text-[var(--foreground)]">语音</span>
                        <select
                          name="script_voice"
                          value={scriptPerformances[index]?.voiceEnabled === false ? "off" : "on"}
                          onChange={(event) => setScriptPerformances((current) => current.map((item, performanceIndex) => performanceIndex === index ? { ...item, voiceEnabled: event.target.value === "on" } : item))}
                          disabled={!editable}
                          className={inputClass}
                        >
                          <option value="on">朗读这句台词</option>
                          <option value="off">只显示文字</option>
                        </select>
                      </label>
                      {scriptPerformances[index]?.voiceEnabled !== false && (
                        <>
                          <label className="space-y-1.5 text-xs font-medium">
                            <span className="block font-semibold text-[var(--foreground)]">朗读语言</span>
                            <select
                              name="script_voice_language"
                              value={scriptPerformances[index]?.voiceLanguage ?? "auto"}
                              onChange={(event) => setScriptPerformances((current) => current.map((item, performanceIndex) => performanceIndex === index ? { ...item, voiceLanguage: event.target.value as ScriptPerformance["voiceLanguage"] } : item))}
                              disabled={!editable}
                              className={inputClass}
                            >
                              <option value="auto">自动判断</option>
                              <option value="zh-CN">中文</option>
                              <option value="ko-KR">韩语</option>
                            </select>
                          </label>
                          <label className="space-y-1.5 text-xs font-medium">
                            <span className="block font-semibold text-[var(--foreground)]">语速</span>
                            <select
                              name="script_voice_rate"
                              value={String(scriptPerformances[index]?.voiceRate ?? 1)}
                              onChange={(event) => setScriptPerformances((current) => current.map((item, performanceIndex) => performanceIndex === index ? { ...item, voiceRate: Number(event.target.value) } : item))}
                              disabled={!editable}
                              className={inputClass}
                            >
                              <option value="0.85">慢速</option>
                              <option value="1">标准</option>
                              <option value="1.15">稍快</option>
                            </select>
                          </label>
                        </>
                      )}
                      {scriptPerformances[index]?.voiceEnabled === false && (
                        <>
                          <input type="hidden" name="script_voice_language" value={scriptPerformances[index]?.voiceLanguage ?? "auto"} />
                          <input type="hidden" name="script_voice_rate" value={String(scriptPerformances[index]?.voiceRate ?? 1)} />
                        </>
                      )}
                    </div>
                    <ScriptSpeechReview
                      text={line}
                      performance={scriptPerformances[index] ?? scriptPerformanceConfiguration(null, {})}
                      asset={node.speechAssets.find((item) => item.locale === "zh-CN" && item.segmentIndex === index)}
                      fromPublishedVersion={node.speechAssetsFromPublishedVersion}
                    />
                    <input type="hidden" name="script_auto_continue" value={scriptPerformances[index]?.autoContinueToNext ? "on" : "off"} />
                    <input type="hidden" name="script_character_x" value={String(scriptPerformances[index]?.characterX ?? 75)} />
                    <input type="hidden" name="script_character_y" value={String(scriptPerformances[index]?.characterY ?? 0)} />
                    <input type="hidden" name="script_character_scale" value={String(scriptPerformances[index]?.characterScale ?? 1)} />
                    <div className="mt-2 flex flex-wrap gap-1">
                      {index < scriptLines.length - 1 && (
                        <button
                          type="button"
                          disabled={!editable}
                          onClick={() => {
                            markDirty();
                            setScriptPerformances((current) => current.map((item, performanceIndex) => performanceIndex === index ? { ...item, autoContinueToNext: !item.autoContinueToNext } : item));
                          }}
                          aria-pressed={scriptPerformances[index]?.autoContinueToNext ?? false}
                          aria-label={`连接台词 ${index + 1} 和台词 ${index + 2}，完整流程预览时自动连续播放，不用点“继续”`}
                          title="仅在顶部“预览完整流程”里生效：连接后这两句会自动连续播放，不用中途点“继续”；真实学生不受影响。"
                          className={`inline-flex min-h-11 items-center gap-1.5 px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 ${scriptPerformances[index]?.autoContinueToNext ? "text-[var(--primary)]" : "text-[var(--foreground-secondary)]"}`}
                        >
                          <Link2 size={15} aria-hidden="true" />
                          {scriptPerformances[index]?.autoContinueToNext ? "已连接下一句（预览自动播放）" : "连接下一句"}
                        </button>
                      )}
                      {editable && scriptLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            markDirty();
                            const nextLines = scriptLines.filter((_, lineIndex) => lineIndex !== index);
                            setScriptLines(nextLines);
                            setScriptPerformances((current) => current.filter((_, performanceIndex) => performanceIndex !== index));
                          }}
                          aria-label={`删除台词 ${index + 1}`}
                          className="inline-flex min-h-11 items-center gap-1.5 px-3 text-sm font-semibold text-[var(--destructive)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destructive)]"
                        >
                          <Trash2 size={15} aria-hidden="true" />删除
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {editable && (
                <div className="px-4 py-4 md:pl-[11.5rem]">
                  <button
                    type="button"
                    onClick={() => {
                      markDirty();
                      setScriptLines((current) => [...current, ""]);
                      setScriptPerformances((current) => [...current, scriptPerformanceConfiguration(null, {
                        ...virtualCharacter,
                        pose: virtualCharacter.pose ?? "explaining",
                        voiceEnabled: true,
                        voiceLanguage: sectionDefaultVoice.language,
                        voiceRate: sectionDefaultVoice.rate,
                      })]);
                    }}
                    className="inline-flex min-h-11 items-center gap-2 border border-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  >
                    <Plus size={16} aria-hidden="true" />增加台词
                  </button>
                </div>
              )}
              {state.fieldErrors?.scriptZh?.length ? <div id="script-zh-error" className="px-4 pb-4 text-xs text-[var(--status-danger)] md:pl-[11.5rem]" role="alert">{state.fieldErrors.scriptZh[0]}</div> : null}
            </div>
            <label className={fieldClass}>
              <span className={formFieldLabelClass}>没听懂时的提示</span>
              <FormattableTextarea name="hint_zh" defaultValue={configuredText(node, "hint")} onDirty={markDirty} disabled={!editable} rows={3} maxLength={600} className={`${inputClass} resize-y py-3 text-sm leading-6`} />
            </label>
            <label className={fieldClass}>
              <span className={formFieldLabelClass}>再举一个例子</span>
              <FormattableTextarea name="example_zh" defaultValue={configuredText(node, "example")} onDirty={markDirty} disabled={!editable} rows={3} maxLength={600} className={`${inputClass} resize-y py-3 text-sm leading-6`} />
            </label>
            <details className="px-4 py-4">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">韩文标题与台词</summary>
              <div className="mt-4 grid gap-4">
                <label className="space-y-2 text-sm"><span className="block font-semibold text-[var(--foreground)]">韩文小节名称</span><input name="title_ko" defaultValue={node.title["ko-KR"]} disabled={!editable} maxLength={80} className={inputClass} /></label>
                <div className="space-y-2 text-sm">
                  <label htmlFor="buffer-line-ko" className="block font-semibold text-[var(--foreground)]">韩文过渡台词</label>
                  <textarea id="buffer-line-ko" name="buffer_line_ko" value={bufferLineKo} onChange={(event) => { setBufferLineKo(event.target.value); markDirty(); }} disabled={!editable} rows={3} maxLength={200} placeholder="例如：잠시만요, 이 부분을 한번 볼게요…" className={`${inputClass} min-h-24 resize-y py-3 leading-6`} />
                  <ScriptSpeechReview
                    text={bufferLineKo}
                    performance={scriptPerformances[0] ?? scriptPerformanceConfiguration(null, {})}
                    asset={node.speechAssets.find((item) => item.locale === "ko-KR" && item.segmentIndex === 199)}
                    fromPublishedVersion={node.speechAssetsFromPublishedVersion}
                  />
                </div>
                <label className="space-y-2 text-sm"><span className="block font-semibold text-[var(--foreground)]">韩文老师台词</span><textarea name="script_ko" defaultValue={node.script["ko-KR"]} disabled={!editable} rows={5} maxLength={1600} className={`${inputClass} resize-y py-3 leading-6`} /></label>
              </div>
            </details>
            </section>
          </div>

          <div id="teaching-content-panel" hidden={editorSection !== "content"} role="tabpanel" aria-labelledby="teaching-content-tab" className={panelClass}>
            <section className={formGroupClass} aria-labelledby="display-content-group-title">
            <div className={formSectionClass}>
              <CardTitleWithHint title={<span id="display-content-group-title">黑板内容</span>} description="这是学生展示内容：像编辑演示文稿一样安排学生看到的重点。黑板只放标题、要点和例句，老师的详细讲解仍在“老师台词”里编辑。" headingLevel={3} titleClassName={formSectionTitleClass} hintClassName="-my-2" hintLabel="查看黑板内容说明" />
            </div>
            <input type="hidden" name="display_items_zh" value="" />
            <TeachingBlackboardEditor key={node.id} display={display} scriptLines={scriptLines} disabled={!editable} onDirty={markDirty} onSlidesChange={setBlackboardSlides} />
            <FieldError errors={state.fieldErrors?.displaySlidesJson} />
            </section>

            <section className={formGroupClass} aria-labelledby="virtual-character-group-title">
            <div className={formSectionClass}>
              <CardTitleWithHint title={<span id="virtual-character-group-title">虚拟人物</span>} description="逐句设置金老师出现的位置、大小和动作。舞台中的效果会同步到学生端；语音仍在“老师台词”中设置。" headingLevel={4} titleClassName={formSectionTitleClass} hintClassName="-my-2" hintLabel="查看虚拟人物说明" />
            </div>
            <input type="hidden" name="virtual_character_kind" value="uply-teacher" />
            <input type="hidden" name="virtual_character_position" value={(scriptPerformances[0]?.characterX ?? 75) < 50 ? "left" : "right"} />
            <VirtualCharacterStageEditor
              scriptLines={scriptLines}
              performances={scriptPerformances}
              blackboardSlides={blackboardSlides}
              blackboardPlacement={blackboardPlacement}
              selectedIndex={selectedCharacterLineIndex}
              onSelectedIndexChange={setSelectedCharacterLineIndex}
              onPerformanceChange={(index, patch) => setScriptPerformances((current) => current.map((item, performanceIndex) => performanceIndex === index ? { ...item, ...patch } : item))}
              onBlackboardPlacementChange={(patch) => setBlackboardPlacement((current) => ({ ...current, ...patch }))}
              disabled={!editable}
              onDirty={markDirty}
            />
            </section>

            <section className={formGroupClass} aria-labelledby="learning-area-group-title">
            <div className={formSectionClass}>
              <CardTitleWithHint title={<span id="learning-area-group-title">学习区联动</span>} description="需要学生看图或听右侧音频时再设置。" headingLevel={4} titleClassName={formSectionTitleClass} hintClassName="-my-2" hintLabel="查看学习区联动说明" />
            </div>
            <div className={fieldClass}>
              <CardTitleWithHint
                title="老师讲解指向"
                description="选择后，学生端会自动切到对应页面，把这个区域滚动到中间并闪动提示；选择按钮只会突出按钮，不会替学生点击。"
                headingLevel={4}
                titleClassName={formFieldLabelClass}
                hintClassName="-my-3 -mr-3"
                hintLabel="查看老师讲解指向说明"
              />
              <div>
              {availableLearningTargets.length > 0 ? (
                <div className="grid gap-3 lg:grid-cols-3">
                  <label className="space-y-1.5">
                    <span className="block text-xs font-semibold text-[var(--foreground-secondary)]">1. 选择页面或固定区域</span>
                    <select
                      value={visualCuePageKey}
                      onInput={(event) => event.stopPropagation()}
                      onChange={(event) => {
                        event.stopPropagation();
                        selectLearningTargetPage(event.target.value);
                      }}
                      disabled={!editable}
                      className={inputClass}
                    >
                      <option value="">不做突出提示</option>
                      {learningTargetPages.map((page) => <option key={page.key} value={page.key}>{page.label}</option>)}
                      {visualCuePageKey === "legacy" && <option value="legacy">已保存的旧目标</option>}
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="block text-xs font-semibold text-[var(--foreground-secondary)]">2. 选择区域</span>
                    <select
                      value={visualCueRegionKey}
                      onInput={(event) => event.stopPropagation()}
                      onChange={(event) => {
                        event.stopPropagation();
                        selectLearningTargetRegion(event.target.value);
                      }}
                      disabled={!editable || !visualCuePageKey || visualCuePageKey === "legacy"}
                      className={inputClass}
                    >
                      {!visualCueRegionKey && <option value="">请先选择页面</option>}
                      {learningTargetRegions.map((region) => <option key={region.key} value={region.key}>{region.label}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="block text-xs font-semibold text-[var(--foreground-secondary)]">3. 选择具体对象</span>
                    <select
                      value={selectedLearningTarget?.key ?? ""}
                      onInput={(event) => event.stopPropagation()}
                      onChange={(event) => {
                        event.stopPropagation();
                        markDirty();
                        setVisualCueTargetKey(event.target.value);
                      }}
                      disabled={!editable || !visualCueRegionKey}
                      className={inputClass}
                    >
                      {!selectedLearningTarget && <option value="">请先选择区域</option>}
                      {learningTargetObjects.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                    </select>
                  </label>
                  <input type="hidden" name="visual_cue_target_key" value={visualCueTargetKey} />
                </div>
              ) : (
              <select name="visual_cue_target_key" value={visualCueTargetKey} onChange={(event) => setVisualCueTargetKey(event.target.value)} disabled={!editable} className={inputClass}>
                <optgroup label="页面范围">
                  <option value="">不做突出提示</option>
                  <option value="content:current">{learningTargetLabels.content}</option>
                </optgroup>
                <optgroup label="图片">
                  <option value="scene:image">{learningTargetLabels.scene}</option>
                </optgroup>
                {activities.length > 0 && (
                  <optgroup label="题目与学习任务">
                    {activities.map((activity, index) => (
                      <option key={activity.id} value={`activity:${activity.id}`}>
                        {teachingActivityLabel(activity.type)} {index + 1}：{activity.prompt["zh-CN"] || "未填写题目"}
                      </option>
                    ))}
                  </optgroup>
                )}
                {visualCueTargetKey && !knownVisualCueTargetKeys.has(visualCueTargetKey) && <option value={visualCueTargetKey}>已保存的旧目标</option>}
              </select>
              )}
              {selectedLearningTargetPath && (
                <span className="mt-3 block border-l-2 border-[var(--primary)] bg-[var(--accent)] px-3 py-2 text-xs font-semibold leading-5 text-[var(--foreground-secondary)]">
                  当前指向：{selectedLearningTargetPath}
                </span>
              )}
              {visualCuePageKey === "legacy" && (
                <span className="mt-3 block border-l-2 border-[var(--status-warning)] bg-[var(--status-warning-surface)] px-3 py-2 text-xs leading-5 text-[var(--foreground-secondary)]">
                  这条小节保存的是旧目标。重新选择页面后，就会改用新的分层目标。
                </span>
              )}
              {visualCueTargetKey && (
                <fieldset className="mt-4 border border-[var(--border)] bg-[var(--muted)]/20 px-4 pb-4 pt-3">
                  <legend className="px-1 text-xs font-bold text-[var(--foreground-secondary)]">突出提示设置</legend>
                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="space-y-2 text-sm"><span className="block font-semibold text-[var(--foreground)]">提示效果</span><select name="visual_cue_effect" defaultValue={String(visualCue.effect ?? "pulse")} disabled={!editable} className={inputClass}><option value="pulse">暖黄色轻柔闪动</option></select></label>
                    <label className="space-y-2 text-sm"><span className="block font-semibold text-[var(--foreground)]">闪动次数</span><select name="visual_cue_pulse_count" defaultValue={String(visualCue.pulseCount ?? 2)} disabled={!editable} className={inputClass}><option value="1">1 次</option><option value="2">2 次</option><option value="3">3 次</option><option value="4">4 次</option></select></label>
                    <label className="space-y-2 text-sm"><span className="block font-semibold text-[var(--foreground)]">单次时长</span><input name="visual_cue_duration_ms" type="number" min={400} max={2500} step={100} defaultValue={Number(visualCue.durationMs ?? 1000)} disabled={!editable} className={`${inputClass} tabular-nums`} /></label>
                  </div>
                </fieldset>
              )}
              </div>
            </div>
            <div className={fieldClass}>
              <CardTitleWithHint
                title="学生操作"
                description="这是学生必须亲自完成的操作；没有完成时，“继续下一步”会保持不可用。"
                headingLevel={4}
                titleClassName={formFieldLabelClass}
                hintClassName="-my-3 -mr-3"
                hintLabel="查看学生操作说明"
              />
              <div>
                <select name="student_task_kind" defaultValue={studentTaskKind} onChange={(event) => setStudentTaskKind(event.target.value)} aria-controls="student-task-settings" aria-expanded={studentTaskKind !== "none"} disabled={!editable} className={inputClass}><option value="none">不安排操作，只听老师讲解</option><option value="play_expression_audio">要求学生播放并完整听完指定表达</option></select>
                <fieldset id="student-task-settings" hidden={studentTaskKind === "none"} className="mt-4 border border-[var(--border)] bg-[var(--muted)]/15">
                  <legend className="ml-3 px-1 text-xs font-bold text-[var(--foreground-secondary)]">学生操作设置</legend>
                  <div className="divide-y divide-[var(--border)]">
                    <label className="grid gap-2 px-3 py-3 text-sm md:grid-cols-[8rem_minmax(0,1fr)] md:items-start"><span className="pt-2.5 font-semibold text-[var(--foreground)]">给学生的操作提示</span><textarea name="student_task_instruction_zh" defaultValue={localizedConfigurationText(studentTask, "instruction")} disabled={!editable} rows={2} maxLength={300} placeholder="例如：请点击右侧第一句，并完整听完语音。" className={`${inputClass} resize-y py-2.5 leading-6`} /></label>
                    <div className="px-3 py-3">
                      <p className="mb-2 text-sm font-semibold text-[var(--foreground)]">学生需要操作哪里</p>
                      <label className="flex min-h-11 items-center gap-2 border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-medium text-[var(--foreground)]">
                        <input
                          type="checkbox"
                          name="student_task_follow_visual_cue"
                          checked={studentTaskFollowsVisualCue}
                          onChange={(event) => setStudentTaskFollowsVisualCue(event.target.checked)}
                          disabled={!editable}
                          className="size-4 accent-[var(--primary)]"
                        />
                        使用老师讲解指向的对象
                      </label>
                      {studentTaskFollowsVisualCue ? (
                        effectiveStudentTaskPath ? (
                          <p className="mt-3 border-l-2 border-[var(--primary)] bg-[var(--accent)] px-3 py-2 text-xs font-semibold leading-5 text-[var(--foreground-secondary)]">
                            已联动：{effectiveStudentTaskPath}
                          </p>
                        ) : (
                          <p className="mt-3 border-l-2 border-[var(--status-warning)] bg-[var(--status-warning-surface)] px-3 py-2 text-xs leading-5 text-[var(--foreground-secondary)]" role="alert">
                            当前老师讲解指向不是可操作的按钮或表达。请把讲解指向改为具体按钮或表达，或者关闭联动后单独选择。
                          </p>
                        )
                      ) : (
                        <>
                          <div className="mt-3 grid gap-3 lg:grid-cols-3">
                            <label className="space-y-1.5"><span className="block text-xs font-semibold text-[var(--foreground-secondary)]">1. 选择页面</span><select value={studentTaskPageKey} onInput={(event) => event.stopPropagation()} onChange={(event) => { event.stopPropagation(); selectStudentTaskPage(event.target.value); }} disabled={!editable} className={inputClass}><option value="">请选择页面</option>{studentTaskPages.map((page) => <option key={page.key} value={page.key}>{page.label}</option>)}{studentTaskPageKey === "legacy" && <option value="legacy">已保存的旧目标</option>}</select></label>
                            <label className="space-y-1.5"><span className="block text-xs font-semibold text-[var(--foreground-secondary)]">2. 选择区域</span><select value={studentTaskRegionKey} onInput={(event) => event.stopPropagation()} onChange={(event) => { event.stopPropagation(); selectStudentTaskRegion(event.target.value); }} disabled={!editable || !studentTaskPageKey || studentTaskPageKey === "legacy"} className={inputClass}>{!studentTaskRegionKey && <option value="">请先选择页面</option>}{studentTaskRegions.map((region) => <option key={region.key} value={region.key}>{region.label}</option>)}</select></label>
                            <label className="space-y-1.5"><span className="block text-xs font-semibold text-[var(--foreground-secondary)]">3. 选择按钮或表达</span><select value={selectedStudentTaskTarget?.key ?? ""} onInput={(event) => event.stopPropagation()} onChange={(event) => { event.stopPropagation(); markDirty(); setStudentTaskTargetKey(event.target.value); }} disabled={!editable || !studentTaskRegionKey} aria-invalid={Boolean(state.fieldErrors?.studentTaskTargetKey?.length) || undefined} aria-describedby={state.fieldErrors?.studentTaskTargetKey?.length ? "student-task-target-error" : undefined} className={inputClass}>{!selectedStudentTaskTarget && <option value="">请先选择区域</option>}{studentTaskObjects.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
                          </div>
                          {selectedStudentTaskPath && <p className="mt-3 border-l-2 border-[var(--primary)] bg-[var(--accent)] px-3 py-2 text-xs font-semibold leading-5 text-[var(--foreground-secondary)]">当前操作目标：{selectedStudentTaskPath}</p>}
                          {studentTaskPageKey === "legacy" && <p className="mt-3 border-l-2 border-[var(--status-warning)] bg-[var(--status-warning-surface)] px-3 py-2 text-xs leading-5 text-[var(--foreground-secondary)]">这条小节保存的是旧目标，请重新选择学生要操作的按钮或表达。</p>}
                        </>
                      )}
                      <input type="hidden" name="student_task_target_key" value={effectiveStudentTaskTarget?.key ?? ""} />
                      <input type="hidden" name="student_task_target_label_zh" value={(effectiveStudentTaskTarget?.label ?? "").slice(0, 100)} />
                      <FieldError id="student-task-target-error" errors={state.fieldErrors?.studentTaskTargetKey} />
                    </div>
                  </div>
                </fieldset>
              </div>
            </div>
            </section>
          </div>

          <div id="teaching-interaction-panel" hidden={editorSection !== "interaction"} role="tabpanel" aria-labelledby="teaching-interaction-tab" className={panelClass}>
            <section className={formGroupClass} aria-labelledby="interaction-group-title">
            <div className={formSectionClass}>
              <CardTitleWithHint title={<span id="interaction-group-title">学生互动</span>} description="可以新建单选理解检查，也可以直接使用教材中已有的活动；学生完成回答后才能继续。" headingLevel={3} titleClassName={formSectionTitleClass} hintClassName="-my-2" hintLabel="查看学生互动说明" />
            </div>
            <label className={fieldClass}><span className={formFieldLabelClass}>回应方式</span><select name="interaction_kind" value={interactionKind} onChange={(event) => setInteractionKind(event.target.value as typeof interactionKind)} aria-controls="custom-interaction-settings referenced-interaction-settings" aria-expanded={interactionKind !== "none"} disabled={!editable} className={inputClass}><option value="none">不要求学生回答</option><option value="single_choice">新建必答单选检查</option><option value="referenced_activity">使用教材已有活动</option></select></label>
            {interactionKind === "none" && (
              <p className="app-muted-text px-4 pb-4 text-xs leading-5">这个小节暂不需要学生互动，学生看完老师讲解后可以直接继续下一步。如果想检查学生是否听懂，可以改选“新建必答单选检查”或“使用教材已有活动”。</p>
            )}
            <div id="custom-interaction-settings" hidden={interactionKind !== "single_choice"} className="divide-y divide-[var(--border)]">
            <label className={fieldClass}><span className={formFieldLabelClass}>老师提出的问题</span><textarea name="interaction_prompt_zh" defaultValue={localizedConfigurationText(interaction, "prompt")} disabled={!editable} rows={3} maxLength={300} aria-invalid={Boolean(state.fieldErrors?.interactionPromptZh?.length) || undefined} aria-describedby={state.fieldErrors?.interactionPromptZh?.length ? "interaction-prompt-error" : undefined} className={`${inputClass} resize-y py-3 leading-6`} /><FieldError id="interaction-prompt-error" errors={state.fieldErrors?.interactionPromptZh} /></label>
            <div className={fieldClass}>
              <span id="interaction-options-label" className={formFieldLabelClass}>学生可选回答</span>
              <fieldset aria-labelledby="interaction-options-label" aria-describedby={state.fieldErrors?.interactionOptions?.length ? "interaction-options-error" : undefined} className="min-w-0 space-y-2">
                <legend className="sr-only">学生可选回答与正确答案</legend>
                {interactionOptionRows.map((option, index) => (
                  <div key={option.id} className={`grid min-w-0 gap-2 border p-2 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] ${interactionCorrectOptionIndex === index ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border)]"}`}>
                    <label className="flex min-h-11 items-center gap-2 px-2 text-xs font-semibold text-[var(--foreground-secondary)]">
                      <input type="radio" name="interaction_correct_option" value={index + 1} checked={interactionCorrectOptionIndex === index} onChange={() => setInteractionCorrectOptionIndex(index)} disabled={!editable} className="size-4 accent-[var(--primary)]" />
                      正确答案
                    </label>
                    <label className="min-w-0">
                      <span className="sr-only">选项 {String.fromCharCode(65 + index)}</span>
                      <input name="interaction_option" value={option.value} onChange={(event) => updateInteractionOption(index, event.target.value)} disabled={!editable} maxLength={300} placeholder={`选项 ${String.fromCharCode(65 + index)}`} className={inputClass} />
                    </label>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => moveInteractionOption(index, -1)} disabled={!editable || index === 0} aria-label={`上移选项 ${String.fromCharCode(65 + index)}`} className="flex size-11 items-center justify-center border border-[var(--border)] bg-[var(--card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-35"><ArrowUp size={15} aria-hidden="true" /></button>
                      <button type="button" onClick={() => moveInteractionOption(index, 1)} disabled={!editable || index === interactionOptionRows.length - 1} aria-label={`下移选项 ${String.fromCharCode(65 + index)}`} className="flex size-11 items-center justify-center border border-[var(--border)] bg-[var(--card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-35"><ArrowDown size={15} aria-hidden="true" /></button>
                      <button type="button" onClick={() => removeInteractionOption(index)} disabled={!editable || interactionOptionRows.length <= 2} aria-label={`删除选项 ${String.fromCharCode(65 + index)}`} className="flex size-11 items-center justify-center border border-[var(--destructive)] text-[var(--destructive)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destructive)] disabled:cursor-not-allowed disabled:opacity-35"><Trash2 size={15} aria-hidden="true" /></button>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addInteractionOption} disabled={!editable || interactionOptionRows.length >= 6} className="inline-flex min-h-11 items-center gap-2 border border-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-45"><Plus size={15} aria-hidden="true" />新增选项</button>
                <p className="app-muted-text text-xs leading-5">支持 2—6 个选项。直接勾选正确答案；移动或删除选项时，正确答案会跟随调整。</p>
                <FieldError id="interaction-options-error" errors={state.fieldErrors?.interactionOptions} />
              </fieldset>
              <input type="hidden" name="interaction_options" value={interactionOptionRows.map((option) => option.value).join("\n")} />
              <input type="hidden" name="interaction_required" value="on" />
            </div>
            <div className="px-4 py-4">
              <label className="block max-w-sm space-y-2 text-sm"><span className="block font-semibold text-[var(--foreground)]">最多尝试次数</span><input name="interaction_max_attempts" type="number" min={1} max={5} defaultValue={Number(interaction.maxAttempts ?? 3)} disabled={!editable} className={`${inputClass} tabular-nums`} /><span className="app-muted-text block text-xs leading-5">答错后可以重新选择；次数用完后公布正确答案并继续。</span></label>
            </div>
            <label className={fieldClass}><span className={formFieldLabelClass}>答对后的老师反馈</span><textarea name="interaction_correct_feedback_zh" defaultValue={node.interactionSecret?.correctFeedback["zh-CN"] ?? ""} disabled={!editable} rows={3} maxLength={600} aria-invalid={Boolean(state.fieldErrors?.interactionCorrectFeedbackZh?.length) || undefined} aria-describedby={state.fieldErrors?.interactionCorrectFeedbackZh?.length ? "interaction-correct-feedback-error" : undefined} className={`${inputClass} resize-y py-3 leading-6`} /><FieldError id="interaction-correct-feedback-error" errors={state.fieldErrors?.interactionCorrectFeedbackZh} /></label>
            <label className={fieldClass}><span className={formFieldLabelClass}>答错后的老师提示</span><textarea name="interaction_incorrect_feedback_zh" defaultValue={node.interactionSecret?.incorrectFeedback["zh-CN"] ?? ""} disabled={!editable} rows={3} maxLength={600} aria-invalid={Boolean(state.fieldErrors?.interactionIncorrectFeedbackZh?.length) || undefined} aria-describedby={state.fieldErrors?.interactionIncorrectFeedbackZh?.length ? "interaction-incorrect-feedback-error" : undefined} className={`${inputClass} resize-y py-3 leading-6`} /><FieldError id="interaction-incorrect-feedback-error" errors={state.fieldErrors?.interactionIncorrectFeedbackZh} /></label>
            </div>
            <div id="referenced-interaction-settings" hidden={interactionKind !== "referenced_activity"} className="divide-y divide-[var(--border)]">
              <label className={fieldClass}><span className={formFieldLabelClass}>教材活动</span><span><select name="reference_activity_id" value={referenceActivityId} onChange={(event) => setReferenceActivityId(event.target.value)} disabled={!editable} aria-invalid={Boolean(state.fieldErrors?.referenceActivityId?.length) || undefined} aria-describedby={state.fieldErrors?.referenceActivityId?.length ? "reference-activity-error" : undefined} className={inputClass}><option value="">请选择教材活动</option>{activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.prompt["zh-CN"] || activity.key}</option>)}</select><FieldError id="reference-activity-error" errors={state.fieldErrors?.referenceActivityId} /></span></label>
              <label className={fieldClass}><span className={formFieldLabelClass}>答错后的补充讲解</span><span><select name="remediation_node_key" defaultValue={node.remediationNodeKey ?? ""} disabled={!editable} className={inputClass}><option value="">使用活动自带提示</option>{allNodes.filter((item) => item.id !== node.id).map((item) => <option key={item.id} value={item.key}>使用第 {item.order} 小节台词：{item.title["zh-CN"]}</option>)}</select><span className="app-muted-text mt-1 block text-xs leading-5">答错时引用所选小节的老师台词作为提示，不改变后续教学顺序。</span></span></label>
            </div>
            </section>
          </div>

          <div id="teaching-flow-panel" hidden={editorSection !== "flow"} role="tabpanel" aria-labelledby="teaching-flow-tab" className={panelClass}>
            <section className={formGroupClass} aria-labelledby="flow-group-title">
            <div className={formSectionClass}>
              <CardTitleWithHint title={<span id="flow-group-title">完成后的流程</span>} description="三种方式互斥：按左侧顺序继续、跳转到指定小节，或者结束当前学习步骤。" headingLevel={3} titleClassName={formSectionTitleClass} hintClassName="-my-2" hintLabel="查看完成后的流程说明" />
            </div>
            <label className={fieldClass}><span className={formFieldLabelClass}>完成后</span><select name="flow_mode" value={flowMode} onChange={(event) => setFlowMode(event.target.value as FlowMode)} disabled={!editable} className={inputClass}><option value="sequence">按左侧顺序进入下一小节</option><option value="jump">跳转到指定小节</option><option value="end">结束当前学习步骤</option></select></label>
            {flowMode === "jump" ? (
              <label className={fieldClass}><span className={formFieldLabelClass}>跳转到</span><select name="next_node_key" value={nextNodeKey} onChange={(event) => setNextNodeKey(event.target.value)} disabled={!editable} aria-invalid={Boolean(state.fieldErrors?.nextNodeKey?.length) || undefined} aria-describedby={state.fieldErrors?.nextNodeKey?.length ? "next-node-error" : undefined} className={inputClass}><option value="">请选择目标小节</option>{allNodes.filter((item) => item.id !== node.id).map((item) => <option key={item.id} value={item.key}>{item.order}. {item.title["zh-CN"]}</option>)}</select><FieldError id="next-node-error" errors={state.fieldErrors?.nextNodeKey} /></label>
            ) : <input type="hidden" name="next_node_key" value="" />}
            <input type="hidden" name="terminal" value={flowMode === "end" ? "on" : ""} />
            <input type="hidden" name="required" value="on" />
            {flowMode !== "end" ? (
              <label className={fieldClass}><span className={formFieldLabelClass}>继续按钮文案</span><input name="continue_label_zh" defaultValue={configuredText(node, "continueLabel")} disabled={!editable} maxLength={40} placeholder="默认：继续下一步" className={inputClass} /></label>
            ) : <input type="hidden" name="continue_label_zh" value="" />}
            <details className="px-4 py-4">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">系统信息</summary>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm font-medium"><span className="block">小节类型</span><select name="node_type" defaultValue={node.type} disabled={!editable} aria-invalid={Boolean(state.fieldErrors?.nodeType?.length) || undefined} aria-describedby={state.fieldErrors?.nodeType?.length ? "node-type-error" : undefined} className={inputClass}><option value="opening">课堂开场</option><option value="instruction">观察或操作引导</option><option value="explanation">知识讲解</option><option value="example">例句示范</option><option value="question">理解检查</option><option value="summary">课堂总结</option></select><FieldError id="node-type-error" errors={state.fieldErrors?.nodeType} /></label>
                <label className="space-y-2 text-sm font-medium"><span className="block">系统标识</span><input name="node_key" defaultValue={node.key} readOnly className={`${inputClass} font-mono text-xs opacity-75`} /></label>
              </div>
            </details>
            </section>
          </div>
        </div>

      </div>

      {editable && (
        <div className="sticky bottom-0 z-20 flex min-h-16 items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 shadow-[0_-8px_20px_color-mix(in_srgb,var(--background)_78%,transparent)]">
          <p className={state.status === "error" ? "text-sm text-[var(--status-danger)]" : dirty ? "text-sm font-medium text-[var(--status-warning)]" : state.status === "success" ? "text-sm text-[var(--status-success)]" : "text-sm text-[var(--muted-foreground)]"} role={state.status === "error" ? "alert" : "status"} aria-live="polite">{dirty ? "有未保存的修改。保存后才会写入草稿。" : state.message || "修改会先保存到草稿，不会立即影响学生。"}</p>
          <button type="submit" disabled={pending} className="inline-flex min-h-11 shrink-0 items-center justify-center bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">{pending ? "正在保存…" : "保存当前小节"}</button>
        </div>
      )}
    </form>
  );
}
