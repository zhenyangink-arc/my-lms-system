"use client";
import { normalizeTeachingVideo, teachingScriptSegments, teachingVideoIssues, type VideoTurnSlot } from "@/lib/teaching-video";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import { TeacherVideoPicker } from "./TeacherVideoPicker";

import { type KeyboardEvent as ReactKeyboardEvent, type SyntheticEvent as ReactSyntheticEvent, useActionState, useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, BookOpenText, CheckCircle2, Link2, LoaderCircle, MessageCircleQuestion, Pause, Play, Plus, RotateCcw, Route, ScrollText, Trash2, Volume2, VolumeX } from "lucide-react";

import {
  deleteCharacterStyleTemplateAction,
  saveCharacterStyleTemplateAction,
  saveTeachingScriptNodeAction,
  type TeachingScriptActionState,
} from "@/app/dashboard/admin/teaching-scripts/actions";
import { LEARNING_AGENT_BUFFER_PRESET_NONE_ID, LEARNING_AGENT_BUFFER_PRESETS } from "@/lib/learning-agent-buffer-presets";
import {
  isClassroomShotMode,
  type ClassroomShotPreference,
} from "@/lib/learning-agent-classroom-director";
import {
  buildGenericModuleLearningTargets,
  buildOrientationLearningTargets,
  defaultLearningTargetForPage,
  defaultLearningTargetForRegion,
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
  normalizeNarrowTeachingVirtualCharacterPlacement,
  normalizeSplitTeachingVirtualCharacterPlacement,
  normalizeTeachingVirtualCharacterPlacement,
  type TeachingBlackboardPlacement,
} from "@/lib/teaching-virtual-character";
import { TeachingBlackboardEditor } from "./TeachingBlackboardEditor";
import { VirtualCharacterStageEditor } from "./VirtualCharacterStageEditor";
import type { BlackboardLayoutTemplate, CharacterStyleTemplate, TeachingScriptActivity, TeachingScriptNode, TeachingScriptSpeechAsset } from "./types";

const initialState: TeachingScriptActionState = { status: "idle" };
const HINT_SPEECH_SEGMENT_INDEX = 197;
const EXAMPLE_SPEECH_SEGMENT_INDEX = 198;

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
    const timer = window.setTimeout(() => {
      setContentHash("");
      setChecking(Boolean(normalized));
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
    const timer = window.setTimeout(() => {
      setAudioStatus("idle");
      setAudioError("");
    }, 0);
    return () => window.clearTimeout(timer);
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
  const reviewSurfaceClass = state === "ready"
    ? "border-[var(--status-success)]/25 bg-[var(--status-success-surface)]"
    : "border-[var(--border)] bg-[var(--card)]";

  return (
    <div className={`mt-2 rounded-lg border px-3 py-2.5 ${reviewSurfaceClass}`} aria-busy={audioStatus === "loading" || checking}>
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

export type TeachingScriptEditorSection = "script" | "content" | "interaction" | "flow";
type EditorSection = TeachingScriptEditorSection;

const errorSectionByField: Partial<Record<string, EditorSection>> = {
  nodeKey: "flow",
  nodeType: "flow",
  titleZh: "script",
  titleKo: "script",
  scriptZh: "script",
  scriptKo: "script",
  hintZh: "script",
  exampleZh: "script",
  bufferPresetId: "script",
  scriptPerformances: "script",
  displayKind: "content",
  displayTitleZh: "content",
  displayItemsZh: "content",
  displayKorean: "content",
  displayTranslationZh: "content",
  displaySlidesJson: "content",
  virtualCharacterKind: "content",
  virtualCharacterPosition: "content",
  studentTaskKind: "interaction",
  studentTaskInstructionZh: "interaction",
  studentTaskTargetKey: "interaction",
  operationCompleteFeedbackZh: "interaction",
  visualCueTargetKey: "content",
  petActionTargetKey: "content",
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

const errorFocusSelectorByField: Partial<Record<string, string>> = {
  nodeKey: '[name="node_key"]',
  nodeType: '[name="node_type"]',
  titleZh: '[name="title_zh"]',
  titleKo: '[name="title_zh"]',
  scriptZh: '[name="script_zh"]',
  scriptKo: '[name="script_zh"]',
  hintZh: '[name="hint_zh"]',
  exampleZh: '[name="example_zh"]',
  bufferPresetId: '[role="radiogroup"][aria-label="选择系统兜底台词"] button',
  scriptPerformances: '[name="script_pose"]',
  virtualCharacterKind: '[name="virtual_character_kind"]',
  virtualCharacterPosition: '[name="virtual_character_position"]',
  studentTaskKind: '#participation-mode-options button',
  studentTaskInstructionZh: '[name="student_task_instruction_zh"]',
  studentTaskTargetKey: '[aria-describedby~="student-task-target-error"]',
  operationCompleteFeedbackZh: '[name="operation_complete_feedback_zh"]',
  visualCueTargetKey: '[name="visual_cue_target_key"]',
  petActionTargetKey: '[aria-describedby~="pet-action-target-error"]',
  interactionKind: '[name="interaction_kind"]',
  interactionPromptZh: '[name="interaction_prompt_zh"]',
  interactionOptions: '[name="interaction_option"]',
  interactionCorrectOption: '[name="interaction_correct_option"]',
  interactionCorrectFeedbackZh: '[name="interaction_correct_feedback_zh"]',
  interactionIncorrectFeedbackZh: '[name="interaction_incorrect_feedback_zh"]',
  referenceActivityId: '[name="reference_activity_id"]',
  remediationNodeKey: '[name="remediation_node_key"]',
  flowMode: '[role="radiogroup"][aria-label="完成后的去向"] button',
  nextNodeKey: '[name="next_node_key"]',
  continueLabelZh: '[name="continue_label_zh"]',
};

type FlowMode = "sequence" | "jump" | "end";
type ScriptLearningLayout = "split" | "learning" | "teaching";
type ParticipationMode = "listen" | "operation" | "question" | "operation_and_question";

const classroomShotOptions: Array<{
  value: ClassroomShotPreference;
  label: string;
  description: string;
}> = [
  { value: "auto", label: "自动导演", description: "根据讲解、操作、提问和反馈自动选择" },
  { value: "teacher_closeup", label: "老师主讲", description: "突出金老师，适合开场和情绪引导" },
  { value: "teacher_blackboard", label: "老师＋黑板", description: "老师与当前教学画面同时出现" },
  { value: "learning_closeup", label: "教材特写", description: "把注意力交给学生需要操作的内容" },
  { value: "interaction", label: "学生互动", description: "突出问题、选项或待完成的活动" },
  { value: "feedback", label: "老师反馈", description: "突出完成结果与老师针对性讲解" },
];

const classroomShotLabels = Object.fromEntries(
  classroomShotOptions.map((option) => [option.value, option.label]),
) as Record<ClassroomShotPreference, string>;

type ScriptPerformance = {
  pose: TeacherKimPose;
  voiceEnabled: boolean;
  voiceLanguage: "auto" | "zh-CN" | "ko-KR";
  voiceRate: number;
  /** Only honored in the platform-owner preview: skip waiting for "继续" and play straight into the next 台词. */
  autoContinueToNext: boolean;
  learningLayout: ScriptLearningLayout;
  classroomShot: ClassroomShotPreference;
  characterX: number;
  characterY: number;
  characterScale: number;
  dialogueX: number;
  dialogueY: number;
  splitCharacterX: number;
  splitCharacterY: number;
  splitCharacterScale: number;
  splitDialogueX: number;
  splitDialogueY: number;
  narrowCharacterX: number;
  narrowCharacterY: number;
  narrowCharacterScale: number;
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
  const splitPlacement = normalizeSplitTeachingVirtualCharacterPlacement(performance, fallback.position);
  const narrowPlacement = normalizeNarrowTeachingVirtualCharacterPlacement(performance);
  const learningLayout = performance.learningLayout === "learning" || performance.learningLayout === "teaching"
    ? performance.learningLayout
    : "split";
  const classroomShot = performance.classroomShot === "auto" || isClassroomShotMode(performance.classroomShot)
    ? performance.classroomShot as ClassroomShotPreference
    : "auto";
  return {
    pose,
    voiceEnabled: performance.voiceEnabled !== false,
    voiceLanguage,
    voiceRate: Number.isFinite(voiceRate) ? Math.max(0.75, Math.min(1.25, voiceRate)) : 1,
    autoContinueToNext: performance.autoContinueToNext === true,
    learningLayout,
    classroomShot,
    characterX: placement.x,
    characterY: placement.y,
    characterScale: placement.scale,
    dialogueX: placement.dialogueX,
    dialogueY: placement.dialogueY,
    splitCharacterX: splitPlacement.x,
    splitCharacterY: splitPlacement.y,
    splitCharacterScale: splitPlacement.scale,
    splitDialogueX: splitPlacement.dialogueX,
    splitDialogueY: splitPlacement.dialogueY,
    narrowCharacterX: narrowPlacement.x,
    narrowCharacterY: narrowPlacement.y,
    narrowCharacterScale: narrowPlacement.scale,
  };
}

/** All three stage layouts' coordinates for one script line, as a single
 * hidden field instead of a dozen parallel `script_*_x`/`script_*_y` inputs.
 * `saveTeachingScriptNodeAction` parses this straight back through the same
 * normalizers that produced it. */
function scriptPlacementPayload(performance: ScriptPerformance | undefined) {
  return JSON.stringify({
    characterX: performance?.characterX ?? 75,
    characterY: performance?.characterY ?? 0,
    characterScale: performance?.characterScale ?? 1,
    dialogueX: performance?.dialogueX ?? 85,
    dialogueY: performance?.dialogueY ?? 30,
    splitCharacterX: performance?.splitCharacterX ?? 68,
    splitCharacterY: performance?.splitCharacterY ?? 0,
    splitCharacterScale: performance?.splitCharacterScale ?? 0.82,
    splitDialogueX: performance?.splitDialogueX ?? 78,
    splitDialogueY: performance?.splitDialogueY ?? 30,
    narrowCharacterX: performance?.narrowCharacterX ?? 90,
    narrowCharacterY: performance?.narrowCharacterY ?? 6,
    narrowCharacterScale: performance?.narrowCharacterScale ?? 0.6,
  });
}

const editorSteps: Array<{
  id: EditorSection;
  label: string;
  icon: typeof ScrollText;
}> = [
  { id: "script", label: "老师说什么", icon: ScrollText },
  { id: "content", label: "学生看到什么", icon: BookOpenText },
  { id: "interaction", label: "学生做什么", icon: MessageCircleQuestion },
  { id: "flow", label: "说完后去哪里", icon: Route },
];

const panelClass = "space-y-4";
const fieldClass = "grid gap-2 px-4 py-3 text-sm font-medium md:grid-cols-[7rem_minmax(0,1fr)]";
const inputClass = "app-input min-h-11 w-full border px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-65";
/** No `overflow-hidden` here (only rounding/dividers): Chromium clips a native
 * <select>'s popup hit-testing to any ancestor with `overflow: hidden` (the
 * popup still paints outside it, but clicks past that boundary silently miss),
 * so an option other than the currently selected one becomes unclickable for
 * any <select> nested in a clipped section — several of these groups (学生互动,
 * 后续流程, and the "学习区联动" cascading pickers) have one near the bottom. */
const formGroupClass = "rounded-xl divide-y divide-[var(--border)] border border-[var(--border)] bg-[var(--card)]";
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
  formId,
  node,
  allNodes,
  activities,
  learningTargets,
  templates,
  blackboardLayoutTemplates,
  moduleCode,
  moduleOrder,
  returnTo,
  editable,
  previewUrl,
  editorSection,
  onEditorSectionChange,
  showSectionNavigation = true,
  interactionFocusRequest,
  onStartFlowBinding,
  flowBindingRequest,
  onFlowBindingApplied,
  onDirtyChange,
  onPendingChange,
}: {
  formId?: string;
  node: TeachingScriptNode;
  allNodes: TeachingScriptNode[];
  activities: TeachingScriptActivity[];
  learningTargets: SmartTextbookLearningTarget[];
  templates: CharacterStyleTemplate[];
  blackboardLayoutTemplates: BlackboardLayoutTemplate[];
  moduleCode: string;
  moduleOrder: number;
  returnTo: string;
  editable: boolean;
  /** Same "预览完整流程" link the studio header uses — empty string when this
   * module's chapter doesn't support the live preview (only chapter 1 does).
   * Lets the stage editor show the real 学习区 content instead of a blank
   * placeholder in split/narrow mode. */
  previewUrl?: string;
  editorSection: TeachingScriptEditorSection;
  onEditorSectionChange: (section: TeachingScriptEditorSection) => void;
  showSectionNavigation?: boolean;
  interactionFocusRequest?: { id: number; target: "teacher_prompt" | "student_response" | "teacher_feedback" } | null;
  onStartFlowBinding?: () => void;
  flowBindingRequest?: { id: number; targetNodeKey: string } | null;
  onFlowBindingApplied?: (requestId: number) => void;
  onDirtyChange: (dirty: boolean) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [teacherVideo, setTeacherVideo] = useState(() => {
    const config = normalizeTeachingVideo(node.configuration.teacherVideo);
    return node.configuration.teacherVideo || !editable ? config : { ...config, mode: "video" as const };
  });
  const visibleEditorSteps = teacherVideo.mode === "video"
    ? editorSteps.filter((step) => step.id !== "content").map((step) => ({ ...step, label: step.id === "script" ? "1. 播放视频" : step.id === "interaction" ? "2. 学生回应与反馈" : "3. 完成后去哪里" }))
    : editorSteps;
  useEffect(() => {
    if (teacherVideo.mode !== "video" || editorSection !== "content") return;
    const frame = requestAnimationFrame(() => onEditorSectionChange("script"));
    return () => cancelAnimationFrame(frame);
  }, [teacherVideo.mode, editorSection, onEditorSectionChange]);
  useEffect(() => {
    if (!interactionFocusRequest || editorSection !== "interaction") return;
    const frame = window.requestAnimationFrame(() => {
      const selectors = interactionFocusRequest.target === "teacher_prompt"
        ? ['[data-video-turn="task"] button', '[data-video-turn="question"] button', '[name="student_task_instruction_zh"]', '[name="interaction_prompt_zh"]', '[name="reference_activity_id"]', '#participation-mode-title']
        : interactionFocusRequest.target === "student_response"
          ? ['[aria-describedby~="student-task-target-error"]', '[name="interaction_option"]', '[name="reference_activity_id"]', '#participation-mode-title']
          : ['[data-video-turn="operationFeedback"] button', '[data-video-turn="correctFeedback"] button', '[name="operation_complete_feedback_zh"]', '[name="interaction_correct_feedback_zh"]', '[name="remediation_node_key"]', '#participation-mode-title'];
      const target = selectors.map((selector) => formRef.current?.querySelector<HTMLElement>(selector)).find((element) => element && element.getClientRects().length > 0);
      target?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      target?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editorSection, interactionFocusRequest]);
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const dirtyVersionRef = useRef(0);
  const submittedVersionRef = useRef(0);
  const nextSubmitModeRef = useRef<"auto" | "manual">("manual");
  const submittedModeRef = useRef<"auto" | "manual">("manual");
  const display = objectConfiguration(node, "display");
  const studentTask = objectConfiguration(node, "studentTask");
  const petAction = objectConfiguration(node, "petAction");
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
    : moduleCode === "orientation"
      ? buildOrientationLearningTargets({ activities })
      : buildGenericModuleLearningTargets({ moduleCode, activities });
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
  const storedPetActionTargetKey = String(petAction.targetKey ?? "");
  const storedPetActionTarget = actionableLearningTargets.find((item) => item.key === storedPetActionTargetKey);
  const [scriptLines, setScriptLines] = useState(() => {
    const lines = teachingScriptSegments(node.script, node.configuration);
    return lines.length > 0 ? lines : [""];
  });
  const [bufferLineZh, setBufferLineZh] = useState(() => configuredText(node, "bufferLine", "zh-CN"));
  const [bufferLineKo, setBufferLineKo] = useState(() => configuredText(node, "bufferLine", "ko-KR"));
  const [selectedBufferPresetId, setSelectedBufferPresetId] = useState(() => {
    const configuredPresetId = String(node.configuration.bufferPresetId ?? "");
    if (configuredPresetId === LEARNING_AGENT_BUFFER_PRESET_NONE_ID) return configuredPresetId;
    if (LEARNING_AGENT_BUFFER_PRESETS.some((preset) => preset.id === configuredPresetId)) return configuredPresetId;
    const configuredZh = configuredText(node, "bufferLine", "zh-CN").trim();
    const configuredKo = configuredText(node, "bufferLine", "ko-KR").trim();
    if (!configuredZh && !configuredKo) return LEARNING_AGENT_BUFFER_PRESET_NONE_ID;
    return LEARNING_AGENT_BUFFER_PRESETS.find((preset) =>
      preset.text["zh-CN"] === configuredZh && preset.text["ko-KR"] === configuredKo,
    )?.id ?? "";
  });
  const bufferPresetAudioRef = useRef<HTMLAudioElement | null>(null);
  const [bufferPresetAudioStatus, setBufferPresetAudioStatus] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const [hintZh, setHintZh] = useState(() => configuredText(node, "hint", "zh-CN"));
  const [exampleZh, setExampleZh] = useState(() => configuredText(node, "example", "zh-CN"));
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
  const bufferLineIsEmpty = bufferLineZh.trim() === "" && bufferLineKo.trim() === "";
  const selectedBufferPreset = LEARNING_AGENT_BUFFER_PRESETS.find((preset) => preset.id === selectedBufferPresetId) ?? null;
  const selectedBufferPresetSelectValue = selectedBufferPresetId;
  const bufferLineUnmatched = !bufferLineIsEmpty && !selectedBufferPreset;

  useEffect(() => () => bufferPresetAudioRef.current?.pause(), []);

  async function playSelectedBufferPreset() {
    if (!selectedBufferPreset) return;
    bufferPresetAudioRef.current?.pause();
    setBufferPresetAudioStatus("loading");
    try {
      const assetRef = `buffer-preset:${selectedBufferPreset.id}:zh-CN`;
      const response = await fetch(`/api/learning-agent/speech/${encodeURIComponent(assetRef)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("preview unavailable");
      const payload = await response.json() as { audioUrl?: unknown };
      if (typeof payload.audioUrl !== "string" || !payload.audioUrl) throw new Error("preview unavailable");
      const audio = new Audio(payload.audioUrl);
      bufferPresetAudioRef.current = audio;
      audio.onplaying = () => setBufferPresetAudioStatus("playing");
      audio.onended = () => setBufferPresetAudioStatus("idle");
      audio.onerror = () => setBufferPresetAudioStatus("error");
      await audio.play();
    } catch {
      setBufferPresetAudioStatus("error");
    }
  }

  function selectBufferPreset(value: string) {
    markDirty();
    setBufferPresetAudioStatus("idle");
    setSelectedBufferPresetId(value);
    if (value === LEARNING_AGENT_BUFFER_PRESET_NONE_ID) {
      setBufferLineZh("");
      setBufferLineKo("");
      return;
    }
    const preset = LEARNING_AGENT_BUFFER_PRESETS.find((item) => item.id === value);
    if (!preset) return;
    setBufferLineZh(preset.text["zh-CN"]);
    setBufferLineKo(preset.text["ko-KR"]);
  }
  const setEditorSection = onEditorSectionChange;
  const [selectedCharacterLineIndex, setSelectedCharacterLineIndex] = useState(0);
  const [blackboardSlides, setBlackboardSlides] = useState<TeachingBlackboardSlide[]>(() =>
    teachingBlackboardSlidesFromDisplay(display),
  );
  const [blackboardPlacement, setBlackboardPlacement] = useState<TeachingBlackboardPlacement>(() =>
    normalizeTeachingBlackboardPlacement(display.placement),
  );
  const [dirty, setDirty] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [lastSubmittedMode, setLastSubmittedMode] = useState<"auto" | "manual">("manual");
  const applyStyleDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const [currentNodeTemplateId, setCurrentNodeTemplateId] = useState("");
  const [newTemplateName, setNewTemplateName] = useState("");
  const [saveTemplatePending, startSaveTemplateTransition] = useTransition();
  const [saveTemplateError, setSaveTemplateError] = useState("");
  const [deleteTemplatePending, startDeleteTemplateTransition] = useTransition();
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
  const [petActionTargetKey, setPetActionTargetKey] = useState(storedPetActionTargetKey);
  const [petActionPageKey, setPetActionPageKey] = useState(
    storedPetActionTarget?.pageKey ?? (storedPetActionTargetKey ? "legacy" : ""),
  );
  const [petActionRegionKey, setPetActionRegionKey] = useState(storedPetActionTarget?.regionKey ?? "");
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
  const [state, action, pending] = useActionState(async (previousState: TeachingScriptActionState, formData: FormData) => {
    const result = await saveTeachingScriptNodeAction(previousState, formData);
    if (result.status === "success") {
      setLastSavedAt(new Date());
      if (submittedVersionRef.current === dirtyVersionRef.current) {
        setDirty(false);
        setSaveFeedback("saved");
        onDirtyChange(false);
      } else {
        setSaveFeedback("dirty");
      }
    } else if (result.status === "error") {
      setSaveFeedback("error");
      setDirty(true);
      onDirtyChange(true);
      if (submittedModeRef.current !== "auto" && result.fieldErrors) {
        const firstInvalidField = Object.keys(result.fieldErrors).find((key) => result.fieldErrors?.[key]?.length);
        const section = firstInvalidField ? errorSectionByField[firstInvalidField] : undefined;
        if (section) setEditorSection(section);
        window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
      }
    }
    return result;
  }, initialState);
  const supplementalExplanationCount = Number(Boolean(hintZh.trim())) + Number(Boolean(exampleZh.trim()));
  const filledScriptLineCount = scriptLines.filter((line) => line.trim()).length;
  const generatedScriptSpeechCount = scriptLines.filter((_, index) =>
    node.speechAssets.some((asset) => asset.locale === "zh-CN" && asset.segmentIndex === index && asset.productionStatus === "ready"),
  ).length;
  const videoIssues = teachingVideoIssues({ video: teacherVideo, lines: scriptLines, hasTask: studentTaskKind !== "none", hasQuestion: interactionKind !== "none" });
  const editorStepStates: Record<EditorSection, string> = {
    script: teacherVideo.mode === "video" ? videoIssues.some((issue) => issue.section === "script") ? "待配置" : "已配置" : scriptLines.some((line) => line.trim()) ? "已完成" : "需填写",
    content: blackboardSlides.some((slide) => slide.elements.some((element) => element.content.trim() || element.translation?.trim())) ? "已完成" : "按需设置",
    interaction: videoIssues.some((issue) => issue.section === "interaction") || (studentTaskKind !== "none" && !studentTaskTargetKey) ? "待配置" : interactionKind !== "none" || studentTaskKind !== "none" ? "待校验" : "无需回应",
    flow: flowMode === "end" || flowMode === "sequence" || nextNodeKey ? "已完成" : "需设置",
  };
  const learningLayoutLabels: Record<ScriptLearningLayout, string> = {
    split: "教学区 30% · 学习区 70%",
    learning: "学习区全屏",
    teaching: "教学区全屏",
  };
  const learningLayoutSummary = Array.from(new Set(
    scriptPerformances.map((performance) => learningLayoutLabels[performance.learningLayout]),
  )).join("、");

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
  const selectedPetActionTarget = actionableLearningTargets.find((item) => item.key === petActionTargetKey);
  const petActionPages = Array.from(new Map(
    actionableLearningTargets.map((item) => [item.pageKey, { key: item.pageKey, label: item.pageLabel }]),
  ).values());
  const petActionRegions = Array.from(new Map(
    actionableLearningTargets
      .filter((item) => item.pageKey === petActionPageKey)
      .map((item) => [item.regionKey, { key: item.regionKey, label: item.regionLabel }]),
  ).values());
  const petActionObjects = actionableLearningTargets.filter((item) =>
    item.pageKey === petActionPageKey && item.regionKey === petActionRegionKey,
  );
  const selectedPetActionPath = selectedPetActionTarget
    ? [selectedPetActionTarget.pageLabel, selectedPetActionTarget.regionLabel, selectedPetActionTarget.label]
        .filter((item, index, values) => index === 0 || item !== values[index - 1])
        .join(" → ")
    : "";
  const participationMode: ParticipationMode = studentTaskKind !== "none"
    ? interactionKind !== "none" ? "operation_and_question" : "operation"
    : interactionKind !== "none" ? "question" : "listen";
  const interactionPerspective = interactionFocusRequest?.target ?? null;
  const participationModePresentation = interactionPerspective === "teacher_prompt"
    ? {
        title: "选择老师如何发起",
        description: "设置老师讲解之后实际说出的操作要求或问题。",
        ariaLabel: "老师发起方式",
        options: [
          ["listen", "不再发起", "老师讲解后直接进入后续流程"],
          ["operation", "发出操作要求", "老师说出要求，再让学生操作"],
          ["question", "提出一个问题", "老师说出问题，再等待学生回答"],
          ["operation_and_question", "先要求操作，再提问", "操作完成并反馈后，老师继续提问"],
        ] as const,
      }
    : interactionPerspective === "teacher_feedback"
      ? {
          title: "选择老师在哪些回应后反馈",
          description: "设置学生完成操作或回答后，老师需要给出的反馈。",
          ariaLabel: "老师反馈方式",
          options: [
            ["listen", "无需单独反馈", "本小节没有学生操作或回答"],
            ["operation", "操作完成后反馈", "确认操作完成，再进入后续流程"],
            ["question", "回答后反馈", "根据答对或答错给出不同反馈"],
            ["operation_and_question", "分别反馈两次", "操作完成后反馈，回答后再次反馈"],
          ] as const,
        }
      : interactionPerspective === "student_response"
        ? {
            title: "选择学生如何回应",
            description: "设置学生需要完成的操作、回答，或两者的先后顺序。",
            ariaLabel: "学生回应方式",
            options: [
              ["listen", "无需学生回应", "学生只听老师讲解"],
              ["operation", "完成一个操作", "学生亲自操作学习区"],
              ["question", "回答一个问题", "学生完成理解检查或教材活动"],
              ["operation_and_question", "操作后回答", "学生先操作，再完成理解检查"],
            ] as const,
          }
        : {
            title: "选择本小节的教学回合",
            description: "统一安排老师发起、学生回应和老师反馈。",
            ariaLabel: "教学回合方式",
            options: [
              ["listen", "只听老师讲解", "不要求操作或回答"],
              ["operation", "完成一个操作", "学生亲自操作学习区"],
              ["question", "回答一个问题", "完成理解检查或教材活动"],
              ["operation_and_question", "操作后回答", "先操作，再完成理解检查"],
            ] as const,
          };
  const interactionSummary = interactionKind === "single_choice"
    ? "回答新建的单选检查"
    : interactionKind === "referenced_activity"
      ? "完成教材已有活动"
      : "";
  const participationSummary = [
    "老师讲解",
    studentTaskKind !== "none" ? "老师提出操作要求" : "",
    studentTaskKind !== "none" ? `学生完成操作${effectiveStudentTaskPath ? `：${effectiveStudentTaskPath}` : "（目标待设置）"}` : "",
    studentTaskKind !== "none" ? "老师确认操作完成" : "",
    interactionKind !== "none" ? "老师提出问题" : "",
    interactionSummary,
    interactionKind !== "none" ? "老师根据回答反馈" : "",
    "进入后续流程",
  ].filter(Boolean).join(" → ");
  const selectedNextNode = allNodes.find((item) => item.key === nextNodeKey);
  const flowDestinationSummary = flowMode === "end"
    ? "结束当前学习步骤"
    : flowMode === "jump"
      ? selectedNextNode ? `跳到第 ${selectedNextNode.order} 小节：${selectedNextNode.title["zh-CN"]}` : "跳转目标待设置"
      : "按左侧顺序进入下一小节";
  const teachingFlowSummary = participationSummary.replace(/ → 进入后续流程$/, ` → ${flowDestinationSummary}`);
  const editorSectionDescriptions: Record<EditorSection, string> = {
    script: teacherVideo.mode === "video" ? `${scriptLines.length} 个片段 · ${teacherVideo.explanations.filter(Boolean).length} 个视频已绑定` : `${filledScriptLineCount}/${scriptLines.length} 句台词 · ${generatedScriptSpeechCount}/${scriptLines.length} 句语音`,
    content: blackboardSlides.length > 0
      ? `${blackboardSlides.length} 张教学画面${selectedLearningTargetPath ? " · 已关联学习区" : ""}`
      : selectedLearningTargetPath ? "已关联学习区" : "按需设置教学画面",
    interaction: participationMode === "listen" ? "学生只听老师讲解" : participationSummary,
    flow: flowDestinationSummary,
  };

  function selectParticipationMode(mode: ParticipationMode) {
    markDirty();
    if (mode === "listen") {
      setStudentTaskKind("none");
      setInteractionKind("none");
      return;
    }
    if (mode === "operation") {
      setStudentTaskKind("play_expression_audio");
      setInteractionKind("none");
      return;
    }
    if (mode === "question") {
      setStudentTaskKind("none");
      setInteractionKind((current) => current === "none" ? "single_choice" : current);
      return;
    }
    setStudentTaskKind("play_expression_audio");
    setInteractionKind((current) => current === "none" ? "single_choice" : current);
  }

  function markDirty(event?: ReactSyntheticEvent) {
    if (!editable) return;
    if (event && event.target instanceof Element && event.target.closest("[data-style-template-controls], [data-teacher-video-picker-controls]")) return;
    dirtyVersionRef.current += 1;
    setDirty(true);
    setSaveFeedback("dirty");
    onDirtyChange(true);
  }

  useEffect(() => {
    if (!flowBindingRequest || !editable) return;
    const frame = window.requestAnimationFrame(() => {
      markDirty();
      setFlowMode("jump");
      setNextNodeKey(flowBindingRequest.targetNodeKey);
      setEditorSection("flow");
      onFlowBindingApplied?.(flowBindingRequest.id);
    });
    return () => window.cancelAnimationFrame(frame);
  // The request id is the event boundary. The callbacks intentionally aren't
  // dependencies: applying a binding must happen exactly once per axis click.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, flowBindingRequest?.id]);

  function saveCurrentStyleAsTemplate() {
    const name = newTemplateName.trim();
    if (!name) return;
    if (dirty) {
      window.alert("请先保存当前小节，再存为模板。");
      return;
    }
    setSaveTemplateError("");
    startSaveTemplateTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("node_id", node.id);
        formData.set("name", name);
        formData.set("return_to", returnTo);
        await saveCharacterStyleTemplateAction(formData);
        setNewTemplateName("");
      } catch (error) {
        setSaveTemplateError(error instanceof Error ? error.message : "保存模板失败，请重试。");
      }
    });
  }

  function deleteTemplate(templateId: string) {
    if (!window.confirm("确定删除这个模板吗？")) return;
    setSaveTemplateError("");
    startDeleteTemplateTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("template_id", templateId);
        formData.set("return_to", returnTo);
        await deleteCharacterStyleTemplateAction(formData);
        if (currentNodeTemplateId === templateId) setCurrentNodeTemplateId("");
      } catch (error) {
        setSaveTemplateError(error instanceof Error ? error.message : "删除模板失败，请重试。");
      }
    });
  }

  function applyTemplateToCurrentNode() {
    const template = templates.find((item) => item.id === currentNodeTemplateId);
    if (!template) return;
    markDirty();
    setScriptPerformances((current) => current.map((item) => ({
      ...item,
      characterX: template.characterX,
      characterY: template.characterY,
      characterScale: template.characterScale,
      dialogueX: template.dialogueX,
      dialogueY: template.dialogueY,
      splitCharacterX: template.splitCharacterX,
      splitCharacterY: template.splitCharacterY,
      splitCharacterScale: template.splitCharacterScale,
      splitDialogueX: template.splitDialogueX,
      splitDialogueY: template.splitDialogueY,
      narrowCharacterX: template.narrowCharacterX,
      narrowCharacterY: template.narrowCharacterY,
      narrowCharacterScale: template.narrowCharacterScale,
    })));
    setBlackboardPlacement({ x: template.blackboardX, y: template.blackboardY, scale: template.blackboardScale });
    applyStyleDetailsRef.current?.removeAttribute("open");
  }

  function handleEditorTabKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % visibleEditorSteps.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + visibleEditorSteps.length) % visibleEditorSteps.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = visibleEditorSteps.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    setEditorSection(visibleEditorSteps[nextIndex].id);
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
    const nextTarget = defaultLearningTargetForPage(availableLearningTargets, pageKey);
    setVisualCueRegionKey(nextTarget?.regionKey ?? "");
    setVisualCueTargetKey(nextTarget?.key ?? "");
  }

  function selectLearningTargetRegion(regionKey: string) {
    markDirty();
    setVisualCueRegionKey(regionKey);
    const nextTarget = defaultLearningTargetForRegion(availableLearningTargets, visualCuePageKey, regionKey);
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

  function selectPetActionPage(pageKey: string) {
    markDirty();
    setPetActionPageKey(pageKey);
    if (!pageKey) {
      setPetActionRegionKey("");
      setPetActionTargetKey("");
      return;
    }
    const pageTargets = actionableLearningTargets.filter((item) => item.pageKey === pageKey);
    const nextTarget = pageTargets[0];
    setPetActionRegionKey(nextTarget?.regionKey ?? "");
    setPetActionTargetKey(nextTarget?.key ?? "");
  }

  function selectPetActionRegion(regionKey: string) {
    markDirty();
    setPetActionRegionKey(regionKey);
    const nextTarget = actionableLearningTargets.find((item) =>
      item.pageKey === petActionPageKey && item.regionKey === regionKey,
    );
    setPetActionTargetKey(nextTarget?.key ?? "");
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
    if (!editable || !dirty || pending || saveFeedback !== "dirty") return;
    const timer = window.setTimeout(() => {
      const form = formRef.current;
      if (!form) return;
      nextSubmitModeRef.current = "auto";
      form.requestSubmit();
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [dirty, editable, pending, saveFeedback]);

  const formErrorEntries = Object.entries(state.fieldErrors ?? {}).flatMap(([field, messages]) =>
    messages.map((message) => ({ field, message })),
  );

  function focusErrorField(field: string) {
    const section = errorSectionByField[field] ?? "script";
    setEditorSection(section);
    window.requestAnimationFrame(() => {
      const panel = formRef.current?.querySelector<HTMLElement>(`#teaching-${section}-panel`);
      const target = errorFocusSelectorByField[field]
        ? panel?.querySelector<HTMLElement>(errorFocusSelectorByField[field]!)
        : panel?.querySelector<HTMLElement>('[aria-invalid="true"]');
      const focusTarget = target ?? panel;
      focusTarget?.closest("details")?.setAttribute("open", "");
      focusTarget?.scrollIntoView({ block: "center" });
      focusTarget?.focus({ preventScroll: true });
    });
  }
  useEffect(() => {
    onPendingChange(pending);
  }, [onPendingChange, pending]);

  return (
    <form
      id={formId}
      ref={formRef}
      action={action}
      onSubmitCapture={() => {
        submittedModeRef.current = nextSubmitModeRef.current;
        setLastSubmittedMode(nextSubmitModeRef.current);
        nextSubmitModeRef.current = "manual";
        submittedVersionRef.current = dirtyVersionRef.current;
        setSaveFeedback("saving");
      }}
      onChangeCapture={markDirty}
      onInputCapture={markDirty}
      className="space-y-4"
      data-teacher-video-mode={teacherVideo.mode}
      data-interaction-perspective={state.status === "error" ? "all" : interactionFocusRequest?.target ?? "all"}
      key={node.id}
    >
      <input type="hidden" name="node_id" value={node.id} />
      <input type="hidden" name="node_updated_at" value={node.updatedAt} />
      <input type="hidden" name="return_to" value={returnTo} />
      <input type="hidden" name="display_kind" value={String(display.kind ?? "overview")} />
      <input type="hidden" name="teacher_video_json" value={JSON.stringify(teacherVideo)} />

      {showSectionNavigation || teacherVideo.mode === "video" ? <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-2.5" aria-labelledby="current-node-settings-title">
        <div id="current-node-settings-title" className="mb-2 px-1">
          <CardTitleWithHint headingLevel={3} title="当前小节设置" description={teacherVideo.mode === "video" ? "先选视频，再安排学生回应和完成后的去向。选择下方步骤编辑，方向键可切换步骤。" : "先完成老师台词，其余内容按需要打开。"} hintLabel="查看小节设置说明" titleClassName="text-sm font-bold" />
        </div>
        <div className="grid gap-2 md:grid-cols-3" role="tablist" aria-label="当前小节设置">
          {visibleEditorSteps.map((step, index) => {
            const Icon = step.icon;
            const selected = editorSection === step.id;
            const needsAttention = /^(需|待)/.test(editorStepStates[step.id]);
            return (
              <button
                key={step.id}
                ref={(element) => { tabRefs.current[index] = element; }}
                id={`teaching-${step.id}-tab`}
                type="button"
                role="tab"
                aria-controls={`teaching-${step.id}-panel`}
                aria-selected={selected}
                aria-label={`${step.label}，${editorStepStates[step.id]}，${editorSectionDescriptions[step.id]}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setEditorSection(step.id)}
                onKeyDown={(event) => handleEditorTabKeyDown(event, index)}
                className={`group flex w-full items-center gap-2 rounded-lg border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] ${step.id === "script" && teacherVideo.mode !== "video" ? "min-h-[4.75rem] px-4 py-3 md:col-span-3" : "min-h-12 px-3 py-2"} ${selected ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)] hover:bg-[var(--accent)]/40"}`}
              >
                <span className={`flex size-7 shrink-0 items-center justify-center rounded-md ${selected ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "bg-[var(--muted)] text-[var(--foreground-secondary)]"}`}><Icon size={15} aria-hidden="true" /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="block text-sm font-bold text-[var(--foreground)]">{step.label}</span>
                    <span className={`shrink-0 text-xs font-semibold ${needsAttention ? "text-[var(--status-warning)]" : "text-[var(--status-success)]"}`}>{editorStepStates[step.id]}</span>
                  </span>
                  {teacherVideo.mode !== "video" && <span className="mt-1 block line-clamp-1 text-xs leading-5 text-[var(--foreground-secondary)]">{editorSectionDescriptions[step.id]}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </section> : (
        <div className="sr-only" aria-hidden="true">
          {editorSteps.map((step) => <span key={step.id} id={`teaching-${step.id}-tab`}>{step.label}</span>)}
        </div>
      )}

        <div className="min-w-0 space-y-4">
      {videoIssues.length > 0 && <details className="rounded-lg border border-[var(--status-warning)] bg-[var(--card)] px-3 text-sm" aria-label="视频待配置项目">
        <summary className="min-h-11 cursor-pointer py-3 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">还有 {videoIssues.length} 项视频配置需要完成<span className="ml-2 text-xs font-normal text-[var(--muted-foreground)]">展开查看</span></summary>
        <ul className="mt-2 space-y-1">{videoIssues.map((issue, index) => <li key={`${issue.section}-${index}`}><button type="button" className="py-1 text-left underline underline-offset-4" onClick={() => setEditorSection(issue.section)}>{issue.message}</button></li>)}</ul>
      </details>}
      {state.status === "error" && formErrorEntries.length > 0 && (
        <div ref={errorSummaryRef} tabIndex={-1} role="alert" className="border border-[var(--status-danger)] bg-[var(--status-danger-surface)] px-4 py-3 text-sm text-[var(--status-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--status-danger)]">
          <p className="font-semibold">当前小节有 {formErrorEntries.length} 项需要修改。点击提示可直接定位。</p>
          <ul className="mt-2 space-y-1">
            {formErrorEntries.map(({ field, message }, index) => (
              <li key={`${field}-${message}-${index}`}>
                <button type="button" onClick={() => focusErrorField(field)} className="flex min-h-11 w-full items-center rounded-lg px-2 text-left text-xs font-semibold leading-5 underline decoration-current/40 underline-offset-4 transition hover:bg-[var(--card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--status-danger)]">
                  {message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid items-start gap-4">
        <div className="min-w-0">
          <div id="teaching-script-panel" tabIndex={-1} hidden={editorSection !== "script"} role="tabpanel" aria-labelledby="teaching-script-tab" className={panelClass}>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2">
              <label className="flex flex-wrap items-center gap-3 text-sm font-semibold">老师呈现方式
                <select className={`${inputClass} !w-auto max-w-full`} value={teacherVideo.mode} disabled={!editable} onChange={(event) => { markDirty(); setTeacherVideo((current) => ({ ...current, mode: event.target.value === "video" ? "video" : "legacy" })); }}>
                  <option value="video">教师视频课堂</option><option value="legacy">原有形象与朗读</option>
                </select>
              </label>
              {teacherVideo.mode === "video" && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={teacherVideo.continuous} disabled={!editable} onChange={(event) => { markDirty(); setTeacherVideo((current) => ({ ...current, continuous: event.target.checked })); }} />连续播放讲解片段，遇到学生任务时等待</label>}
            </div>
            <section className={formGroupClass} aria-labelledby="script-group-title">
            <div className="border-l-2 border-l-transparent bg-[var(--muted)]/50 px-4 py-3">
              <h3 id="script-group-title" className={formSectionTitleClass}>小节基本设置</h3>
            </div>
            <div className="divide-y divide-[var(--border)] bg-[var(--muted)]/15">
            <label className={fieldClass}>
              <span className={formFieldLabelClass}>小节名称</span>
              <input name="title_zh" defaultValue={node.title["zh-CN"]} disabled={!editable} maxLength={80} aria-invalid={Boolean(state.fieldErrors?.titleZh?.length) || undefined} aria-describedby={state.fieldErrors?.titleZh?.length ? "title-zh-error" : undefined} className={inputClass} />
              <FieldError id="title-zh-error" errors={state.fieldErrors?.titleZh} />
            </label>
            <details hidden={teacherVideo.mode === "video"} className="group">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] [&::-webkit-details-marker]:hidden">
                <span>语音默认设置</span>
                <span className="text-xs font-medium text-[var(--muted-foreground)]">{sectionDefaultVoice.language === "auto" ? "自动判断" : sectionDefaultVoice.language === "zh-CN" ? "中文" : "韩语"} · {sectionDefaultVoice.rate === 0.85 ? "慢速" : sectionDefaultVoice.rate === 1.15 ? "稍快" : "标准"}</span>
              </summary>
              <div className="grid gap-3 border-t border-[var(--border)] px-4 py-3 sm:grid-cols-[minmax(9rem,1fr)_minmax(7rem,0.7fr)_auto] sm:items-end">
                <label className="min-w-0 space-y-1.5 text-xs font-medium">
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
                <label className="min-w-0 space-y-1.5 text-xs font-medium">
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
                  className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary)] transition hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  应用到全部台词
                </button>
              </div>
            </details>
            </div>
            <div hidden={teacherVideo.mode === "video"} className="border-l-4 border-l-[var(--primary)] bg-[var(--accent)]/45 px-4 py-3">
              <h3 className={formSectionTitleClass}>开场过渡</h3>
            </div>
            <div hidden={teacherVideo.mode === "video"} className="px-4 py-3">
              <h3 id="buffer-line-label" className="text-sm font-semibold">过渡台词</h3>
              <fieldset className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                <legend className="px-1 text-xs font-bold text-[var(--foreground)]">系统兜底台词库</legend>
                <input type="hidden" name="buffer_preset_id" value={teacherVideo.mode === "video" ? LEARNING_AGENT_BUFFER_PRESET_NONE_ID : selectedBufferPresetSelectValue} />
                <div
                  className="mt-1 grid gap-2 sm:grid-cols-2"
                  role="radiogroup"
                  aria-label="选择系统兜底台词"
                  aria-invalid={Boolean(state.fieldErrors?.bufferPresetId?.length) || undefined}
                  aria-describedby={state.fieldErrors?.bufferPresetId?.length ? "buffer-preset-error" : undefined}
                >
                  {[
                    { id: LEARNING_AGENT_BUFFER_PRESET_NONE_ID, label: "不显示过渡台词" },
                    ...LEARNING_AGENT_BUFFER_PRESETS.map((preset, index) => ({ id: preset.id, label: `${index + 1}. ${preset.text["zh-CN"]}` })),
                  ].map((option) => {
                    const selected = selectedBufferPresetSelectValue === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={!editable}
                        onClick={() => selectBufferPreset(option.id)}
                        className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-45 ${selected ? "border-[var(--primary)] bg-[var(--accent)] font-semibold text-[var(--primary)]" : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground-secondary)] hover:border-[var(--primary)] hover:bg-[var(--accent)]/45"}`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    disabled={!selectedBufferPreset || bufferPresetAudioStatus === "loading"}
                    onClick={() => void playSelectedBufferPreset()}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--primary)] px-4 text-xs font-bold text-[var(--primary)] transition hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {bufferPresetAudioStatus === "loading" ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
                    {bufferPresetAudioStatus === "playing" ? "正在试听" : "试听语音"}
                  </button>
                </div>
                {bufferPresetAudioStatus === "error" && <p className="mt-1 text-xs font-semibold text-[var(--status-danger)]" role="alert">试听语音暂时无法读取，请稍后重试。</p>}
                {bufferLineUnmatched && (
                  <p className="mt-2 text-xs font-semibold text-[var(--status-danger)]" role="alert">
                    当前保存的过渡台词（“{bufferLineZh || bufferLineKo}”）不在系统兜底台词库中，可能是预设文案上线前录入的旧内容。请在上方重新选择一条，否则无法保存这个小节。
                  </p>
                )}
              </fieldset>
              <FieldError id="buffer-preset-error" errors={state.fieldErrors?.bufferPresetId} />
              {selectedBufferPreset && (
                <div className="mt-3 grid items-stretch gap-3 xl:grid-cols-2">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                    <p className="text-xs font-bold text-[var(--foreground-muted)]">中文台词</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-[var(--foreground)]">{selectedBufferPreset.text["zh-CN"]}</p>
                    <p className="mt-3 text-xs font-bold text-[var(--foreground-muted)]">韩文台词</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-[var(--foreground)]">{selectedBufferPreset.text["ko-KR"]}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--status-success)] bg-[var(--status-success-surface)] p-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-[var(--status-success)]">
                      <CheckCircle2 size={17} aria-hidden="true" />
                      系统预设语音已就绪
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[var(--foreground-secondary)]">中文使用金老师中文声线，韩文使用金老师韩语声线；学生端会按当前语言自动播放。</p>
                  </div>
                </div>
              )}
            </div>
            <div className="border-l-4 border-l-[var(--primary)] bg-[var(--card)] px-4 py-3">
              <h3 className={formSectionTitleClass}>正式讲解</h3>
            </div>
            <div className="grid items-start gap-4 bg-[var(--muted)]/25 p-4 xl:grid-cols-2">
              {scriptLines.map((line, index) => (
                <article key={index} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <label htmlFor={`script-line-${index}`} className="flex items-center gap-2 text-sm font-bold text-[var(--foreground)]">
                      <span className="flex size-7 items-center justify-center rounded-full bg-[var(--primary)] text-xs text-[var(--primary-foreground)]">{index + 1}</span>
                      <span>{teacherVideo.mode === "video" ? "讲解片段" : "台词"} {index + 1}</span>
                    </label>
                    {index < scriptLines.length - 1 && (teacherVideo.mode === "video" ? teacherVideo.continuous : scriptPerformances[index]?.autoContinueToNext) && <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold text-[var(--primary)]">{teacherVideo.mode === "video" ? "连续播放" : "已连接下一句"}</span>}
                  </div>
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
                    {teacherVideo.mode === "video" && <div className="mt-3"><TeacherVideoPicker key={`${index}-${teacherVideo.explanations[index]?.objectKey ?? "empty"}`} label={`片段 ${index + 1} 的讲解视频`} value={teacherVideo.explanations[index]} transcript={line} editable={editable} onChange={(binding) => { markDirty(); setTeacherVideo((current) => { const explanations = [...current.explanations]; explanations[index] = binding; return { ...current, explanations }; }); }} /></div>}
                    <p hidden={teacherVideo.mode === "video"} className="mt-2 text-xs leading-5 text-[var(--foreground-secondary)]">
                      {scriptPerformances[index]?.voiceEnabled === false ? "只显示文字" : `${scriptPerformances[index]?.voiceLanguage === "zh-CN" ? "中文" : scriptPerformances[index]?.voiceLanguage === "ko-KR" ? "韩语" : "自动判断语言"}朗读 · ${scriptPerformances[index]?.voiceRate === 0.85 ? "慢速" : scriptPerformances[index]?.voiceRate === 1.15 ? "稍快" : "标准语速"}`}
                      {` · ${classroomShotLabels[scriptPerformances[index]?.classroomShot ?? "auto"]} · ${learningLayoutLabels[scriptPerformances[index]?.learningLayout ?? "split"]} · ${TEACHER_KIM_POSE_LABELS[scriptPerformances[index]?.pose ?? "explaining"]}`}
                    </p>
                    <div hidden={teacherVideo.mode === "video"}><ScriptSpeechReview
                      text={line}
                      performance={scriptPerformances[index] ?? scriptPerformanceConfiguration(null, {})}
                      asset={node.speechAssets.find((item) => item.locale === "zh-CN" && item.segmentIndex === index)}
                      fromPublishedVersion={node.speechAssetsFromPublishedVersion}
                    /></div>
                    <details hidden={teacherVideo.mode === "video"} className="mt-2 border-t border-[var(--border)] px-1 py-2">
                      <summary className="min-h-11 cursor-pointer text-xs font-semibold leading-[2.75rem] text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">展开表现设置</summary>
                      <div className="mt-2 grid gap-3 border-t border-[var(--border)] pt-3 sm:grid-cols-2">
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
                      <fieldset className="space-y-1.5 sm:col-span-2">
                        <legend className="block text-xs font-semibold text-[var(--foreground)]">课堂镜头</legend>
                        <p className="text-xs leading-5 text-[var(--foreground-secondary)]">自动导演会按照教学环节切换；只有这句台词需要特殊构图时才手动指定。</p>
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" role="radiogroup" aria-label={`台词 ${index + 1} 的课堂镜头`}>
                          {classroomShotOptions.map((option) => {
                            const selected = (scriptPerformances[index]?.classroomShot ?? "auto") === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                disabled={!editable}
                                onClick={() => {
                                  markDirty();
                                  setScriptPerformances((current) => current.map((item, performanceIndex) => {
                                    if (performanceIndex !== index) return item;
                                    const learningLayout: ScriptLearningLayout = option.value === "teacher_closeup"
                                      || option.value === "teacher_blackboard"
                                      || option.value === "feedback"
                                      ? "teaching"
                                      : option.value === "learning_closeup"
                                        ? "learning"
                                        : "split";
                                    return { ...item, classroomShot: option.value, learningLayout };
                                  }));
                                }}
                                className={`min-h-16 rounded-lg border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 ${selected ? "border-[var(--primary)] bg-[var(--accent)] text-[var(--primary)]" : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground-secondary)] hover:border-[var(--primary)]"}`}
                              >
                                <span className="block text-xs font-bold">{option.label}</span>
                                <span className={`mt-1 block text-[11px] leading-4 ${selected ? "text-[var(--primary)]/80" : "text-[var(--foreground-muted)]"}`}>{option.description}</span>
                              </button>
                            );
                          })}
                        </div>
                        <input type="hidden" name="script_classroom_shot" value={scriptPerformances[index]?.classroomShot ?? "auto"} />
                      </fieldset>
                      <fieldset className="space-y-1.5 sm:col-span-2">
                        <legend className="block text-xs font-semibold text-[var(--foreground)]">说到本句时的界面</legend>
                        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={`台词 ${index + 1} 的教学界面布局`}>
                          {([
                            ["split", "教学区 30% · 学习区 70%"],
                            ["learning", "学习区全屏"],
                            ["teaching", "教学区全屏"],
                          ] as const).map(([layout, label]) => {
                            const selected = (scriptPerformances[index]?.learningLayout ?? "split") === layout;
                            return (
                              <button
                                key={layout}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                disabled={!editable}
                                onClick={() => {
                                  markDirty();
                                  setScriptPerformances((current) => current.map((item, performanceIndex) => performanceIndex === index ? { ...item, learningLayout: layout } : item));
                                }}
                                className={`min-h-11 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 ${selected ? "border-[var(--primary)] bg-[var(--accent)] text-[var(--primary)]" : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground-secondary)] hover:border-[var(--primary)]"}`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                        <input type="hidden" name="script_learning_layout" value={scriptPerformances[index]?.learningLayout ?? "split"} />
                      </fieldset>
                      </div>
                    </details>
                    <input type="hidden" name="script_auto_continue" value={scriptPerformances[index]?.autoContinueToNext ? "on" : "off"} />
                    <input type="hidden" name="script_placement" value={scriptPlacementPayload(scriptPerformances[index])} />
                    <div className="mt-2 flex flex-wrap gap-1">
                      {teacherVideo.mode !== "video" && index < scriptLines.length - 1 && (
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
                            setTeacherVideo((current) => ({ ...current, explanations: current.explanations.filter((_, itemIndex) => itemIndex !== index) }));
                            setScriptPerformances((current) => current.filter((_, performanceIndex) => performanceIndex !== index));
                          }}
                          aria-label={`删除台词 ${index + 1}`}
                          className="inline-flex min-h-11 items-center gap-1.5 px-3 text-sm font-semibold text-[var(--destructive)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destructive)]"
                        >
                          <Trash2 size={15} aria-hidden="true" />删除
                        </button>
                      )}
                    </div>
                </article>
              ))}
              {editable && (
                <div className="py-2 xl:col-span-2">
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
              {state.fieldErrors?.scriptZh?.length ? <div id="script-zh-error" className="text-xs text-[var(--status-danger)] xl:col-span-2" role="alert">{state.fieldErrors.scriptZh[0]}</div> : null}
            </div>
            <details className="group bg-[var(--muted)]/15">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 border-l-2 border-l-transparent bg-[var(--muted)]/50 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] [&::-webkit-details-marker]:hidden">
                <span className="text-sm font-semibold text-[var(--foreground)]">补充讲解</span>
                <span className="rounded-full bg-[var(--card)] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted-foreground)]">已填写 {supplementalExplanationCount}/2</span>
              </summary>
              <div className="grid gap-4 border-t border-[var(--border)] p-4 xl:grid-cols-2">
                <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                  <label htmlFor="hint-zh" className="block text-sm font-semibold text-[var(--foreground)]">没听懂时的提示</label>
                  <FormattableTextarea id="hint-zh" name="hint_zh" value={hintZh} onChange={setHintZh} onDirty={markDirty} disabled={!editable} rows={3} maxLength={600} className={`${inputClass} resize-y py-3 text-sm leading-6`} />
                  <ScriptSpeechReview text={hintZh} performance={scriptPerformances[0] ?? scriptPerformanceConfiguration(null, {})} asset={node.speechAssets.find((item) => item.locale === "zh-CN" && item.segmentIndex === HINT_SPEECH_SEGMENT_INDEX)} fromPublishedVersion={node.speechAssetsFromPublishedVersion} />
                </div>
                <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                  <label htmlFor="example-zh" className="block text-sm font-semibold text-[var(--foreground)]">再举一个例子</label>
                  <FormattableTextarea id="example-zh" name="example_zh" value={exampleZh} onChange={setExampleZh} onDirty={markDirty} disabled={!editable} rows={3} maxLength={600} className={`${inputClass} resize-y py-3 text-sm leading-6`} />
                  <ScriptSpeechReview text={exampleZh} performance={scriptPerformances[0] ?? scriptPerformanceConfiguration(null, {})} asset={node.speechAssets.find((item) => item.locale === "zh-CN" && item.segmentIndex === EXAMPLE_SPEECH_SEGMENT_INDEX)} fromPublishedVersion={node.speechAssetsFromPublishedVersion} />
                </div>
              </div>
            </details>
            <input type="hidden" name="title_ko" value={node.title["ko-KR"]} />
            <input type="hidden" name="script_ko" value={node.script["ko-KR"]} />
            </section>
          </div>

          <div id="teaching-content-panel" tabIndex={-1} hidden={teacherVideo.mode === "video" || editorSection !== "content"} role="tabpanel" aria-labelledby="teaching-content-tab" className={panelClass}>
            <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]" aria-labelledby="content-sequence-title">
              <div className="border-b border-[var(--border)] bg-[var(--muted)]/30 px-4 py-3">
                <h3 id="content-sequence-title" className="text-sm font-bold text-[var(--foreground)]">播放时会按这个顺序执行</h3>
              </div>
              <ol className="grid divide-y divide-[var(--border)] lg:grid-cols-4 lg:divide-x lg:divide-y-0">
                <li className="flex min-w-0 gap-3 p-4">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-[var(--primary)]">1</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-[var(--foreground)]">切换界面</p>
                      <button type="button" onClick={() => setEditorSection("script")} className="min-h-7 shrink-0 text-xs font-semibold text-[var(--primary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">去修改</button>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[var(--foreground-secondary)]">{learningLayoutSummary || "教学区 30% · 学习区 70%"}</p>
                  </div>
                </li>
                <li className="flex min-w-0 gap-3 p-4">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-[var(--primary)]">2</span>
                <div className="min-w-0"><p className="text-sm font-bold text-[var(--foreground)]">{teacherVideo.mode === "video" ? "播放教师视频" : "展示老师"}</p><p className="mt-1 text-xs leading-5 text-[var(--foreground-secondary)]">{teacherVideo.mode === "video" ? `${teacherVideo.explanations.filter(Boolean).length}/${scriptLines.length} 个讲解片段已绑定视频` : `已为 ${scriptLines.length} 句台词设置人物表现`}</p></div>
                </li>
                <li className="flex min-w-0 gap-3 p-4">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-[var(--primary)]">3</span>
                  <div className="min-w-0"><p className="text-sm font-bold text-[var(--foreground)]">播放黑板</p><p className="mt-1 text-xs leading-5 text-[var(--foreground-secondary)]">{blackboardSlides.length > 0 ? `共 ${blackboardSlides.length} 张画面` : "未设置黑板画面"}</p></div>
                </li>
                <li className="flex min-w-0 gap-3 p-4">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-[var(--primary)]">4</span>
                  <div className="min-w-0"><p className="text-sm font-bold text-[var(--foreground)]">联动学习区</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--foreground-secondary)]">{selectedLearningTargetPath || "未设置讲解指向"}</p></div>
                </li>
              </ol>
            </section>

            <section className={formGroupClass} aria-labelledby="virtual-character-group-title">
            <div className={`${formSectionClass} flex flex-wrap items-center justify-between gap-3`}>
              <h3 id="virtual-character-group-title" className={formSectionTitleClass}>2. 教学区布局与人物</h3>
              <details ref={applyStyleDetailsRef} className="group relative shrink-0">
                <summary
                  className={`inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary)] transition hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] [&::-webkit-details-marker]:hidden ${!editable ? "pointer-events-none opacity-45" : ""}`}
                >
                  样式模板
                </summary>
                <div data-style-template-controls className="absolute right-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-xl">
                  <p className="text-xs leading-5 text-[var(--muted-foreground)]">把当前小节满意的人物位置、大小和黑板位置存成模板；打开别的小节后，选这个模板点应用，就能保持一致的站位。</p>
                  <div className="mt-3 flex items-end gap-2 border-b border-[var(--border)] pb-3">
                    <label className="flex-1 space-y-1.5 text-xs font-medium">
                      <span className="block font-semibold text-[var(--foreground)]">把当前小节的样式存为新模板</span>
                      <input
                        value={newTemplateName}
                        onChange={(event) => setNewTemplateName(event.target.value)}
                        disabled={!editable}
                        maxLength={60}
                        placeholder="例如：老师站右侧-标准"
                        className={inputClass}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={!editable || saveTemplatePending || !newTemplateName.trim()}
                      onClick={saveCurrentStyleAsTemplate}
                      className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--primary)] px-2.5 text-xs font-semibold text-[var(--primary)] transition hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {saveTemplatePending ? <LoaderCircle size={13} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
                      存为模板
                    </button>
                  </div>
                  <label className="mt-3 block space-y-1.5 text-xs font-medium">
                    <span className="block font-semibold text-[var(--foreground)]">把模板应用到当前小节（还需手动保存）</span>
                    <div className="flex items-center gap-2">
                      <select value={currentNodeTemplateId} onChange={(event) => setCurrentNodeTemplateId(event.target.value)} className={`${inputClass} flex-1`}>
                        <option value="">选择模板…</option>
                        {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                      </select>
                      {currentNodeTemplateId && (
                        <button
                          type="button"
                          onClick={() => deleteTemplate(currentNodeTemplateId)}
                          disabled={deleteTemplatePending}
                          aria-label="删除这个模板"
                          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--status-danger)] transition hover:bg-[var(--status-danger-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {deleteTemplatePending ? <LoaderCircle size={13} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Trash2 size={13} aria-hidden="true" />}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={!editable || !currentNodeTemplateId}
                        onClick={applyTemplateToCurrentNode}
                        className="inline-flex min-h-9 shrink-0 items-center rounded-lg border border-[var(--primary)] px-2.5 text-xs font-semibold text-[var(--primary)] transition hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        应用
                      </button>
                    </div>
                  </label>
                  {saveTemplateError && <p className="mt-1.5 text-[11px] text-[var(--status-danger)]">{saveTemplateError}</p>}
                </div>
              </details>
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
              previewUrl={previewUrl}
            />
            </section>

            <section className={formGroupClass} aria-labelledby="display-content-group-title">
            <div className={formSectionClass}>
              <h3 id="display-content-group-title" className={formSectionTitleClass}>3. 黑板画面</h3>
            </div>
            <input type="hidden" name="display_items_zh" value="" />
            <TeachingBlackboardEditor key={node.id} display={display} scriptLines={scriptLines} disabled={!editable} onDirty={markDirty} onSlidesChange={setBlackboardSlides} layoutTemplates={blackboardLayoutTemplates} returnTo={returnTo} />
            <FieldError errors={state.fieldErrors?.displaySlidesJson} />
            </section>

            <details className={`${formGroupClass} group`} aria-labelledby="learning-area-group-title">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span id="learning-area-group-title" className="block text-sm font-bold text-[var(--foreground)]">4. 学习区联动</span>
                <span className="mt-0.5 block truncate text-xs text-[var(--foreground-muted)]">{[selectedLearningTargetPath || (studentTaskKind !== "none" ? "已安排学生操作" : "未设置，仅播放教学内容"), selectedPetActionTarget ? "已设置宠物操作" : ""].filter(Boolean).join("・")}</span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-[var(--primary)] group-open:hidden">展开高级设置</span>
              <span className="hidden shrink-0 text-xs font-semibold text-[var(--foreground-muted)] group-open:inline">收起</span>
            </summary>
            <div className="border-t border-[var(--border)]">
            <div className={fieldClass}>
              <h4 className={formFieldLabelClass}>老师讲解指向</h4>
              <div>
              {availableLearningTargets.length > 0 ? (
                <div className="grid gap-3 lg:grid-cols-3">
                  <fieldset className="space-y-1.5">
                    <legend className="block text-xs font-semibold text-[var(--foreground-secondary)]">1. 选择页面或固定区域</legend>
                    <div className="grid gap-1.5" role="radiogroup" aria-label="老师讲解指向的页面或固定区域">
                      {[
                        { key: "", label: "不做突出提示" },
                        ...learningTargetPages,
                        ...(visualCuePageKey === "legacy" ? [{ key: "legacy", label: "已保存的旧目标" }] : []),
                      ].map((page) => {
                        const selected = visualCuePageKey === page.key;
                        return (
                          <button
                            key={page.key || "none"}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            disabled={!editable || page.key === "legacy"}
                            onClick={() => selectLearningTargetPage(page.key)}
                            className={`min-h-11 w-full rounded-lg border px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-65 ${selected ? "border-[var(--primary)] bg-[var(--accent)] font-semibold text-[var(--primary)]" : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground-secondary)] hover:border-[var(--primary)] hover:bg-[var(--accent)]/45"}`}
                          >
                            {page.label}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                  <label className="space-y-1.5">
                    <span className="block text-xs font-semibold text-[var(--foreground-secondary)]">2. 选择区域</span>
                    <select
                      value={visualCueRegionKey}
                      onInput={(event) => {
                        event.stopPropagation();
                        selectLearningTargetRegion(event.currentTarget.value);
                      }}
                      onChange={(event) => selectLearningTargetRegion(event.currentTarget.value)}
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
                      onInput={(event) => {
                        event.stopPropagation();
                        markDirty();
                        setVisualCueTargetKey(event.currentTarget.value);
                      }}
                      onChange={(event) => setVisualCueTargetKey(event.currentTarget.value)}
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
              <h4 className={formFieldLabelClass}>宠物操作</h4>
              <div>
                {actionableLearningTargets.length > 0 ? (
                  <div className="grid gap-3 lg:grid-cols-3">
                    <label className="space-y-1.5">
                      <span className="block text-xs font-semibold text-[var(--foreground-secondary)]">1. 选择页面</span>
                      <select value={petActionPageKey} onInput={(event) => { event.stopPropagation(); selectPetActionPage(event.currentTarget.value); }} onChange={(event) => selectPetActionPage(event.currentTarget.value)} disabled={!editable} className={inputClass}>
                        <option value="">不安排宠物操作</option>
                        {petActionPages.map((page) => <option key={page.key} value={page.key}>{page.label}</option>)}
                        {petActionPageKey === "legacy" && <option value="legacy">已保存的旧目标</option>}
                      </select>
                    </label>
                    <label className="space-y-1.5">
                      <span className="block text-xs font-semibold text-[var(--foreground-secondary)]">2. 选择区域</span>
                      <select value={petActionRegionKey} onInput={(event) => { event.stopPropagation(); selectPetActionRegion(event.currentTarget.value); }} onChange={(event) => selectPetActionRegion(event.currentTarget.value)} disabled={!editable || !petActionPageKey || petActionPageKey === "legacy"} className={inputClass}>
                        {!petActionRegionKey && <option value="">请先选择页面</option>}
                        {petActionRegions.map((region) => <option key={region.key} value={region.key}>{region.label}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1.5">
                      <span className="block text-xs font-semibold text-[var(--foreground-secondary)]">3. 选择按钮或表达</span>
                      <select
                        value={selectedPetActionTarget?.key ?? ""}
                        onInput={(event) => { event.stopPropagation(); markDirty(); setPetActionTargetKey(event.currentTarget.value); }}
                        onChange={(event) => setPetActionTargetKey(event.currentTarget.value)}
                        disabled={!editable || !petActionRegionKey}
                        aria-invalid={Boolean(state.fieldErrors?.petActionTargetKey?.length) || undefined}
                        aria-describedby={state.fieldErrors?.petActionTargetKey?.length ? "pet-action-target-error" : undefined}
                        className={inputClass}
                      >
                        {!selectedPetActionTarget && <option value="">请先选择区域</option>}
                        {petActionObjects.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                      </select>
                    </label>
                  </div>
                ) : (
                  <p className="app-muted-text text-xs leading-5">当前学习步骤还没有可供宠物操作的按钮或表达。</p>
                )}
                <input type="hidden" name="pet_action_target_key" value={petActionTargetKey} />
                {selectedPetActionPath && (
                  <p className="mt-3 border-l-2 border-[var(--primary)] bg-[var(--accent)] px-3 py-2 text-xs font-semibold leading-5 text-[var(--foreground-secondary)]">
                    当前宠物操作目标：{selectedPetActionPath}
                  </p>
                )}
                {petActionPageKey === "legacy" && (
                  <p className="mt-3 border-l-2 border-[var(--status-warning)] bg-[var(--status-warning-surface)] px-3 py-2 text-xs leading-5 text-[var(--foreground-secondary)]" role="alert">
                    这条小节保存的是旧目标，请重新选择宠物要操作的按钮或表达。
                  </p>
                )}
                <FieldError id="pet-action-target-error" errors={state.fieldErrors?.petActionTargetKey} />
              </div>
            </div>
            </div>
            </details>
          </div>

          <div id="teaching-interaction-panel" tabIndex={-1} hidden={editorSection !== "interaction"} role="tabpanel" aria-labelledby="teaching-interaction-tab" className={panelClass}>
            {teacherVideo.mode === "video" && interactionPerspective !== "teacher_feedback" && <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              {studentTaskKind !== "none" && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={teacherVideo.taskInExplanation} disabled={!editable} onChange={(event) => { markDirty(); setTeacherVideo((current) => ({ ...current, taskInExplanation: event.target.checked })); }} />讲解视频已包含操作要求，结束后直接让学生操作</label>}
              {interactionKind !== "none" && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={teacherVideo.questionInExplanation} disabled={!editable} onChange={(event) => { markDirty(); setTeacherVideo((current) => ({ ...current, questionInExplanation: event.target.checked })); }} />讲解视频已包含提问，进入回答环节时直接显示题目</label>}
            </div>}
            {teacherVideo.mode === "video" && interactionPerspective !== "student_response" && <div className="grid gap-3 md:grid-cols-2">
              {([
                ["task", "老师发起：操作要求", studentTaskKind !== "none" && !teacherVideo.taskInExplanation, "teacher_prompt"],
                ["question", "老师发起：提出问题", interactionKind !== "none" && !teacherVideo.questionInExplanation, "teacher_prompt"],
                ["operationFeedback", "老师反馈：操作完成", studentTaskKind !== "none", "teacher_feedback"],
                ["correctFeedback", "老师反馈：答对", interactionKind !== "none", "teacher_feedback"],
                ["incorrectFeedback", "老师反馈：答错", interactionKind !== "none", "teacher_feedback"],
              ] as const).filter(([, , enabled, perspective]) => enabled && (!interactionPerspective || interactionPerspective === perspective)).map(([slot, label]) => <div key={slot} data-video-turn={slot}><TeacherVideoPicker key={`${slot}-${teacherVideo.turns[slot as VideoTurnSlot]?.objectKey ?? "empty"}`} label={label} value={teacherVideo.turns[slot as VideoTurnSlot]} editable={editable} onChange={(binding) => { markDirty(); setTeacherVideo((current) => ({ ...current, turns: { ...current.turns, [slot]: binding } })); }} /></div>)}
            </div>}
            <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]" aria-labelledby="participation-mode-title">
              <div className="border-b border-[var(--border)] bg-[var(--muted)]/30 px-4 py-3">
                <h3 id="participation-mode-title" tabIndex={-1} className="text-sm font-bold text-[var(--foreground)]">{interactionPerspective === "teacher_feedback" ? "学生回应后的反馈" : participationModePresentation.title}</h3>
                <p className="mt-1 text-xs leading-5 text-[var(--foreground-secondary)]">{participationModePresentation.description}</p>
              </div>
              {interactionPerspective === "teacher_feedback" && <p className="p-4 text-sm">{participationMode === "listen" ? "本小节没有学生回应，无需配置反馈。请先在学生回应中设置操作或回答。" : "分别设置操作完成、答对和答错后的反馈。未绑定视频时显示反馈文字。"}</p>}
              {interactionPerspective === "teacher_prompt" && <p className="p-4 text-sm">这里设置老师说出的要求或问题。需要更改学生做什么，请点击编排轴的“学生回应”。</p>}
              <div id="participation-mode-options" hidden={interactionPerspective === "teacher_feedback" || interactionPerspective === "teacher_prompt"} className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-4" role="radiogroup" aria-label={participationModePresentation.ariaLabel}>
                {participationModePresentation.options.map(([mode, label, description]) => {
                  const selected = participationMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={!editable}
                      onClick={() => selectParticipationMode(mode)}
                      className={`min-h-20 rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 ${selected ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]"}`}
                    >
                      <span className="block text-sm font-bold text-[var(--foreground)]">{label}</span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--foreground-secondary)]">{description}</span>
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3" role="status" aria-atomic="true">
                <p className="text-xs font-semibold leading-5 text-[var(--foreground-secondary)]">课堂执行顺序：{participationSummary}</p>
              </div>
            </section>

            {participationMode !== "listen" && (
              <ol className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 md:grid-cols-3" aria-label="当前教学回合步骤">
                <li className={`rounded-lg p-3 ${interactionPerspective === "teacher_prompt" ? "ring-2 ring-[var(--primary)] bg-[var(--accent)]" : "bg-[var(--accent)]"}`}><span className="text-xs font-bold text-[var(--primary)]">1　老师发起</span><p className="mt-1 text-xs leading-5 text-[var(--foreground-secondary)]">老师先说出操作要求或问题，不把任务静默地丢给学生。</p></li>
                <li className={`rounded-lg p-3 ${interactionPerspective === "student_response" ? "ring-2 ring-[var(--primary)] bg-[var(--accent)]" : "bg-[var(--surface-soft)]"}`}><span className="text-xs font-bold text-[var(--foreground)]">2　学生回应</span><p className="mt-1 text-xs leading-5 text-[var(--foreground-secondary)]">学生完成指定操作、选择答案，或按顺序完成两者。</p></li>
                <li className={`rounded-lg p-3 ${interactionPerspective === "teacher_feedback" ? "ring-2 ring-[var(--status-success)] bg-[var(--status-success-surface)]" : "bg-[var(--status-success-surface)]"}`}><span className="text-xs font-bold text-[var(--status-success)]">3　老师反馈</span><p className="mt-1 text-xs leading-5 text-[var(--foreground-secondary)]">老师确认完成情况，再引导学生进入下一环节。</p></li>
              </ol>
            )}

            <input type="hidden" name="student_task_kind" value={studentTaskKind} />
            {studentTaskKind !== "none" && (
              <details id="student-task-settings" open className="group overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
                <summary className="flex min-h-16 cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-[var(--foreground)]">老师发起：提出操作要求</span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--foreground-secondary)]">{effectiveStudentTaskPath || "已经启用学生操作，但操作目标还没有设置。"}</span>
                  </span>
                  <span className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary)] group-open:hidden">设置操作目标</span>
                  <span className="hidden min-h-11 shrink-0 items-center px-3 text-xs font-semibold text-[var(--foreground-secondary)] group-open:inline-flex">收起设置</span>
                </summary>
                <fieldset className="border-t border-[var(--border)] bg-[var(--muted)]/15">
                  <legend className="sr-only">学生操作设置</legend>
                  <div className="divide-y divide-[var(--border)]">
                    <label className="grid gap-2 px-3 py-3 text-sm md:grid-cols-[8rem_minmax(0,1fr)] md:items-start"><span className="pt-2.5 font-semibold text-[var(--foreground)]">老师实际说的话</span><span><textarea name="student_task_instruction_zh" defaultValue={localizedConfigurationText(studentTask, "instruction")} disabled={!editable} rows={2} maxLength={300} placeholder="例如：请点击右侧第一句，并完整听完语音。" aria-invalid={Boolean(state.fieldErrors?.studentTaskInstructionZh?.length) || undefined} aria-describedby={state.fieldErrors?.studentTaskInstructionZh?.length ? "student-task-instruction-error" : undefined} className={`${inputClass} resize-y py-2.5 leading-6`} /><span className="app-muted-text mt-1 block text-xs leading-5">这句话会由老师角色说出来；说完后学生再执行操作。</span><FieldError id="student-task-instruction-error" errors={state.fieldErrors?.studentTaskInstructionZh} /></span></label>
                    <div className="px-3 py-3">
                      <p className="mb-2 text-sm font-semibold text-[var(--foreground)]">学生回应：需要操作哪里</p>
                      <label className="flex min-h-11 items-center gap-2 border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-medium text-[var(--foreground)]">
                        <input type="checkbox" name="student_task_follow_visual_cue" checked={studentTaskFollowsVisualCue} onChange={(event) => setStudentTaskFollowsVisualCue(event.target.checked)} disabled={!editable} className="size-4 accent-[var(--primary)]" />
                        使用老师讲解指向的对象
                      </label>
                      {studentTaskFollowsVisualCue ? (
                        effectiveStudentTaskPath ? (
                          <p className="mt-3 border-l-2 border-[var(--primary)] bg-[var(--accent)] px-3 py-2 text-xs font-semibold leading-5 text-[var(--foreground-secondary)]">已联动：{effectiveStudentTaskPath}</p>
                        ) : (
                          <p className="mt-3 border-l-2 border-[var(--status-warning)] bg-[var(--status-warning-surface)] px-3 py-2 text-xs leading-5 text-[var(--foreground-secondary)]" role="alert">当前老师讲解指向不是可操作的按钮或表达。请把讲解指向改为具体按钮或表达，或者关闭联动后单独选择。</p>
                        )
                      ) : (
                        <>
                          <div className="mt-3 grid gap-3 lg:grid-cols-3">
                            <label className="space-y-1.5"><span className="block text-xs font-semibold text-[var(--foreground-secondary)]">1. 选择页面</span><select value={studentTaskPageKey} onInput={(event) => { event.stopPropagation(); selectStudentTaskPage(event.currentTarget.value); }} onChange={(event) => selectStudentTaskPage(event.currentTarget.value)} disabled={!editable} className={inputClass}><option value="">请选择页面</option>{studentTaskPages.map((page) => <option key={page.key} value={page.key}>{page.label}</option>)}{studentTaskPageKey === "legacy" && <option value="legacy">已保存的旧目标</option>}</select></label>
                            <label className="space-y-1.5"><span className="block text-xs font-semibold text-[var(--foreground-secondary)]">2. 选择区域</span><select value={studentTaskRegionKey} onInput={(event) => { event.stopPropagation(); selectStudentTaskRegion(event.currentTarget.value); }} onChange={(event) => selectStudentTaskRegion(event.currentTarget.value)} disabled={!editable || !studentTaskPageKey || studentTaskPageKey === "legacy"} className={inputClass}>{!studentTaskRegionKey && <option value="">请先选择页面</option>}{studentTaskRegions.map((region) => <option key={region.key} value={region.key}>{region.label}</option>)}</select></label>
                            <label className="space-y-1.5"><span className="block text-xs font-semibold text-[var(--foreground-secondary)]">3. 选择按钮或表达</span><select value={selectedStudentTaskTarget?.key ?? ""} onInput={(event) => { event.stopPropagation(); markDirty(); setStudentTaskTargetKey(event.currentTarget.value); }} onChange={(event) => setStudentTaskTargetKey(event.currentTarget.value)} disabled={!editable || !studentTaskRegionKey} aria-invalid={Boolean(state.fieldErrors?.studentTaskTargetKey?.length) || undefined} aria-describedby={state.fieldErrors?.studentTaskTargetKey?.length ? "student-task-target-error" : undefined} className={inputClass}>{!selectedStudentTaskTarget && <option value="">请先选择区域</option>}{studentTaskObjects.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
                          </div>
                          {selectedStudentTaskPath && <p className="mt-3 border-l-2 border-l-[var(--primary)] bg-[var(--accent)] px-3 py-2 text-xs font-semibold leading-5 text-[var(--foreground-secondary)]">当前操作目标：{selectedStudentTaskPath}</p>}
                          {studentTaskPageKey === "legacy" && <p className="mt-3 border-l-2 border-l-[var(--status-warning)] bg-[var(--status-warning-surface)] px-3 py-2 text-xs leading-5 text-[var(--foreground-secondary)]">这条小节保存的是旧目标，请重新选择学生要操作的按钮或表达。</p>}
                        </>
                      )}
                      <input type="hidden" name="student_task_target_key" value={effectiveStudentTaskTarget?.key ?? ""} />
                      <input type="hidden" name="student_task_target_label_zh" value={(effectiveStudentTaskTarget?.label ?? "").slice(0, 100)} />
                      <FieldError id="student-task-target-error" errors={state.fieldErrors?.studentTaskTargetKey} />
                    </div>
                  </div>
                </fieldset>
              </details>
            )}

            {studentTaskKind !== "none" && (
              <section className={formGroupClass} aria-labelledby="operation-feedback-title">
                <div className={formSectionClass}><h3 id="operation-feedback-title" className={formSectionTitleClass}>老师反馈：学生完成操作后</h3></div>
                <label className={fieldClass}><span className={formFieldLabelClass}>老师实际说的话</span><span><textarea name="operation_complete_feedback_zh" defaultValue={localizedConfigurationText(node.configuration, "operationCompleteFeedback")} disabled={!editable} rows={2} maxLength={600} placeholder={interactionKind !== "none" ? "例如：很好，操作完成了。接下来回答老师一个问题。" : "例如：很好，你已经完整听完了，我们继续。"} aria-invalid={Boolean(state.fieldErrors?.operationCompleteFeedbackZh?.length) || undefined} aria-describedby={state.fieldErrors?.operationCompleteFeedbackZh?.length ? "operation-feedback-error" : undefined} className={`${inputClass} resize-y py-3 leading-6`} /><span className="app-muted-text mt-1 block text-xs leading-5">留空时使用系统的自然反馈；填写后会按这句话播放。</span><FieldError id="operation-feedback-error" errors={state.fieldErrors?.operationCompleteFeedbackZh} /></span></label>
              </section>
            )}

            {interactionKind === "none" && <input type="hidden" name="interaction_kind" value="none" />}

            {interactionKind !== "none" && (
            <section className={formGroupClass} aria-labelledby="interaction-group-title">
            <div className={formSectionClass}>
              <h3 id="interaction-group-title" className={formSectionTitleClass}>提问回合：老师提问 → 学生回答 → 老师反馈</h3>
            </div>
            <label className={fieldClass}><span className={formFieldLabelClass}>问题来源</span><select name="interaction_kind" value={interactionKind} onChange={(event) => setInteractionKind(event.target.value as typeof interactionKind)} aria-controls="custom-interaction-settings referenced-interaction-settings" aria-expanded={interactionKind !== "none"} disabled={!editable} className={inputClass}><option value="none">不要求学生回答</option><option value="single_choice">老师新建一个单选问题</option><option value="referenced_activity">老师引导学生完成教材活动</option></select></label>
            {interactionKind === "none" && (
              <p className="app-muted-text px-4 pb-4 text-xs leading-5">这个小节暂不需要学生互动，学生看完老师讲解后可以直接继续下一步。如果想检查学生是否听懂，可以改选“新建必答单选检查”或“使用教材已有活动”。</p>
            )}
            <div id="custom-interaction-settings" hidden={interactionKind !== "single_choice"} className="divide-y divide-[var(--border)]">
            <label className={fieldClass}><span className={formFieldLabelClass}>老师实际提出的问题</span><span><textarea name="interaction_prompt_zh" defaultValue={localizedConfigurationText(interaction, "prompt")} disabled={!editable} rows={3} maxLength={300} placeholder="例如：刚才第一句问候表达是哪一个？" aria-invalid={Boolean(state.fieldErrors?.interactionPromptZh?.length) || undefined} aria-describedby={state.fieldErrors?.interactionPromptZh?.length ? "interaction-prompt-error" : undefined} className={`${inputClass} resize-y py-3 leading-6`} /><span className="app-muted-text mt-1 block text-xs leading-5">老师会先把问题说完，随后才显示回答选项。</span><FieldError id="interaction-prompt-error" errors={state.fieldErrors?.interactionPromptZh} /></span></label>
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
            <details open={interactionPerspective === "teacher_feedback" || undefined} className="group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] [&::-webkit-details-marker]:hidden">
                <span>答题反馈设置</span>
                <span className="text-xs text-[var(--primary)] group-open:hidden">展开</span>
                <span className="hidden text-xs text-[var(--foreground-secondary)] group-open:inline">收起</span>
              </summary>
              <div className="divide-y divide-[var(--border)] border-t border-[var(--border)] bg-[var(--muted)]/15">
                <div className="px-4 py-4">
                  <label className="block max-w-sm space-y-2 text-sm"><span className="block font-semibold text-[var(--foreground)]">最多尝试次数</span><input name="interaction_max_attempts" type="number" min={1} max={5} defaultValue={Number(interaction.maxAttempts ?? 3)} disabled={!editable} className={`${inputClass} tabular-nums`} /><span className="app-muted-text block text-xs leading-5">答错后可以重新选择；次数用完后公布正确答案并继续。</span></label>
                </div>
                <label className={fieldClass}><span className={formFieldLabelClass}>答对后的老师反馈</span><textarea name="interaction_correct_feedback_zh" defaultValue={node.interactionSecret?.correctFeedback["zh-CN"] ?? ""} disabled={!editable} rows={3} maxLength={600} aria-invalid={Boolean(state.fieldErrors?.interactionCorrectFeedbackZh?.length) || undefined} aria-describedby={state.fieldErrors?.interactionCorrectFeedbackZh?.length ? "interaction-correct-feedback-error" : undefined} className={`${inputClass} resize-y py-3 leading-6`} /><FieldError id="interaction-correct-feedback-error" errors={state.fieldErrors?.interactionCorrectFeedbackZh} /></label>
                <label className={fieldClass}><span className={formFieldLabelClass}>答错后的老师提示</span><textarea name="interaction_incorrect_feedback_zh" defaultValue={node.interactionSecret?.incorrectFeedback["zh-CN"] ?? ""} disabled={!editable} rows={3} maxLength={600} aria-invalid={Boolean(state.fieldErrors?.interactionIncorrectFeedbackZh?.length) || undefined} aria-describedby={state.fieldErrors?.interactionIncorrectFeedbackZh?.length ? "interaction-incorrect-feedback-error" : undefined} className={`${inputClass} resize-y py-3 leading-6`} /><FieldError id="interaction-incorrect-feedback-error" errors={state.fieldErrors?.interactionIncorrectFeedbackZh} /></label>
              </div>
            </details>
            </div>
            <div id="referenced-interaction-settings" hidden={interactionKind !== "referenced_activity"} className="divide-y divide-[var(--border)]">
              <label className={fieldClass}><span className={formFieldLabelClass}>教材活动</span><span><select name="reference_activity_id" value={referenceActivityId} onChange={(event) => setReferenceActivityId(event.target.value)} disabled={!editable} aria-invalid={Boolean(state.fieldErrors?.referenceActivityId?.length) || undefined} aria-describedby={state.fieldErrors?.referenceActivityId?.length ? "reference-activity-error" : undefined} className={inputClass}><option value="">请选择教材活动</option>{activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.prompt["zh-CN"] || activity.key}</option>)}</select><FieldError id="reference-activity-error" errors={state.fieldErrors?.referenceActivityId} /></span></label>
              <label className={fieldClass}><span className={formFieldLabelClass}>答错后的补充讲解</span><span><select name="remediation_node_key" defaultValue={node.remediationNodeKey ?? ""} disabled={!editable} className={inputClass}><option value="">使用活动自带提示</option>{allNodes.filter((item) => item.id !== node.id).map((item) => <option key={item.id} value={item.key}>使用第 {item.order} 小节台词：{item.title["zh-CN"]}</option>)}</select><span className="app-muted-text mt-1 block text-xs leading-5">答错时引用所选小节的老师台词作为提示，不改变后续教学顺序。</span></span></label>
            </div>
            </section>
            )}
          </div>

          <div id="teaching-flow-panel" tabIndex={-1} hidden={editorSection !== "flow"} role="tabpanel" aria-labelledby="teaching-flow-tab" className={panelClass}>
            <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3" aria-labelledby="teaching-flow-summary-title">
              <h3 id="teaching-flow-summary-title" className="text-sm font-bold text-[var(--foreground)]">当前教学流程</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--foreground-secondary)]" role="status" aria-atomic="true">{teachingFlowSummary}</p>
            </section>

            <section className={formGroupClass} aria-labelledby="flow-group-title">
            <div className={formSectionClass}>
              <h3 id="flow-group-title" className={formSectionTitleClass}>完成后的流程</h3>
            </div>
            <fieldset className="p-4">
              <legend className="sr-only">选择完成后的去向</legend>
              <div className="grid gap-3 md:grid-cols-3" role="radiogroup" aria-label="完成后的去向">
                {([
                  ["sequence", "按顺序继续", "进入左侧列表中的下一小节"],
                  ["jump", "跳到指定小节", "适合分支讲解或指定补充内容"],
                  ["end", "结束当前学习步骤", "学生完成后返回课程进度"],
                ] as const).map(([mode, label, description]) => {
                  const selected = flowMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={!editable}
                      onClick={() => {
                        markDirty();
                        setFlowMode(mode);
                        if (mode !== "jump") setNextNodeKey("");
                      }}
                      className={`min-h-24 rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 ${selected ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]"}`}
                    >
                      <span className="block text-sm font-bold text-[var(--foreground)]">{label}</span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--foreground-secondary)]">{description}</span>
                    </button>
                  );
                })}
              </div>
              <input type="hidden" name="flow_mode" value={flowMode} />
            </fieldset>
            {flowMode === "jump" ? (
              <div className={fieldClass}>
                <span className={formFieldLabelClass}>跳转到</span>
                <div className="space-y-2">
                  <select name="next_node_key" value={nextNodeKey} onChange={(event) => setNextNodeKey(event.target.value)} disabled={!editable} aria-invalid={Boolean(state.fieldErrors?.nextNodeKey?.length) || undefined} aria-describedby={state.fieldErrors?.nextNodeKey?.length ? "next-node-error" : undefined} className={inputClass}><option value="">请选择目标小节</option>{allNodes.filter((item) => item.id !== node.id).map((item) => <option key={item.id} value={item.key}>{item.order}. {item.title["zh-CN"]}</option>)}</select>
                  {onStartFlowBinding && (
                    <button type="button" onClick={onStartFlowBinding} disabled={!editable} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary)] transition hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50">
                      <Route size={15} aria-hidden="true" />从编排轴选择目标
                    </button>
                  )}
                  <FieldError id="next-node-error" errors={state.fieldErrors?.nextNodeKey} />
                </div>
              </div>
            ) : <input type="hidden" name="next_node_key" value="" />}
            <input type="hidden" name="terminal" value={flowMode === "end" ? "on" : ""} />
            <input type="hidden" name="required" value="on" />
            {flowMode !== "end" ? (
              <details className="border-t border-[var(--border)] px-4 py-3">
                <summary className="min-h-11 cursor-pointer text-sm font-semibold leading-[2.75rem] text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">继续按钮设置</summary>
                <label className="mt-2 block max-w-xl space-y-2"><span className="block text-sm font-semibold text-[var(--foreground)]">按钮文案</span><input name="continue_label_zh" defaultValue={configuredText(node, "continueLabel")} disabled={!editable} maxLength={40} placeholder="默认：继续下一步" className={inputClass} /></label>
              </details>
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

        </div>

      {editable && (
        <div className="px-1 pt-1">
          <p
            className={saveFeedback === "error" ? "text-sm text-[var(--status-danger)]" : saveFeedback === "dirty" ? "text-sm font-medium text-[var(--status-warning)]" : saveFeedback === "saved" ? "text-sm text-[var(--status-success)]" : "text-sm text-[var(--muted-foreground)]"}
            role={saveFeedback === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {saveFeedback === "saving"
              ? lastSubmittedMode === "auto" ? "正在自动保存到草稿…" : "正在保存到草稿…"
              : saveFeedback === "error"
                ? `${lastSubmittedMode === "auto" ? "自动保存失败" : "保存失败"}：${state.message || "请稍后重试。"} 修改仍保留在当前页面。`
                : saveFeedback === "dirty"
                  ? "有未保存的修改，停止输入后会自动保存。"
                  : saveFeedback === "saved" && lastSavedAt
                    ? `已保存到草稿 · ${lastSavedAt.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`
                    : "修改会自动保存到草稿，不会立即影响学生。"}
          </p>
        </div>
      )}
    </form>
  );
}
