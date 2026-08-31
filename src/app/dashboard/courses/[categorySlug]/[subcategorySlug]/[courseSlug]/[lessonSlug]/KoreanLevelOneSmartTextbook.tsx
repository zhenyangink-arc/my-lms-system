"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  Clock3,
  Download,
  GripHorizontal,
  Headphones,
  Languages,
  Lightbulb,
  Map,
  Maximize2,
  Menu,
  MessageCircle,
  Mic,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  Presentation,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  VolumeX,
  X,
  XCircle,
} from "lucide-react";
import { type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useRef, useState, useTransition } from "react";

import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import { bufferLineForRequest, bufferSpeechAssetForRequest } from "@/lib/learning-agent-buffer-state";
import { RICH_TEXT_COLOR_VALUES, type RichChar } from "@/lib/rich-teaching-text";
import type { TeacherKimPose } from "@/lib/teacher-kim-character";

import type {
  SmartLocale,
  SmartSupportMode,
  SmartTextbookActivity,
  SmartTextbookData,
  SmartTextbookMediaAsset,
  SmartTextbookNode,
} from "@/lib/smart-digital-textbook";
import {
  checkSmartTextbookActivityPageAction,
  completeDialogueRoleplayAction,
  saveGuidedRepeatProgressAction,
  saveSmartTextbookPreferenceAction,
  submitSmartTextbookActivityAction,
} from "./smart-textbook-actions";
import {
  isServerConfirmedNodeCompletion,
  isSmartTextbookModuleCompleted,
} from "./smart-textbook-completion";
import {
  getSmartTextbookSkeletonModule,
  getSmartTextbookSkeletonPageLabels,
  shouldUseSmartTextbookTeachingFocusMode,
  SMART_TEXTBOOK_SHARED_LEARNING_LAYOUT,
} from "@/lib/smart-textbook-skeleton";
import { KoreanLevelOneCourseOverview } from "./KoreanLevelOneCourseOverview";

export type SmartTextbookShellProps = {
  backHref: string;
  textbook: SmartTextbookData;
  trackingDisabled: boolean;
  completionHref?: string;
  completionLabel?: string;
  /**
   * Course-admin preview mode: walks the scripted teaching flow for this
   * (possibly unpublished) script version instead of the published one, via
   * /api/learning-agent/preview-respond. Nothing is persisted — no session,
   * message, or attempt rows are written for these requests.
   */
  previewScriptVersionId?: string;
  /** Jump a fresh preview session straight to this node instead of node 1. */
  previewStartNodeKey?: string;
  /** Buffer line for the preview's actual start node, including draft versions. */
  previewOpeningBufferLine?: Partial<Record<SmartLocale, string>>;
  previewOpeningBufferSpeechAssetId?: Partial<Record<SmartLocale, string>>;
  /** Open the 学习区 on this module instead of the first one, so it matches whichever module's script is being previewed. */
  previewStartModuleIndex?: number;
};

type AnswerValue = unknown;
type Feedback = {
  ok: boolean;
  correct: boolean | null;
  explanation: string;
  preview: boolean;
  nodeId: string | null;
  nodeCompleted: boolean;
  completionPercent: number;
};

type TutorDisplay = {
  kind?: "overview" | "scene" | "sequence" | "expression" | "question" | "task" | "summary";
  title?: Partial<Record<SmartLocale, string>>;
  items?: Partial<Record<SmartLocale, string[]>>;
  korean?: string;
  translation?: Partial<Record<SmartLocale, string>>;
};

type TutorTask = {
  kind?: "play_expression_audio";
  instruction?: Partial<Record<SmartLocale, string>>;
  targetLabel?: Partial<Record<SmartLocale, string>>;
  targetKey?: string;
  eventType?: "audio_completed" | "activity_opened" | "activity_completed";
  required?: boolean;
};

type TutorVisualCue = {
  targetKey?: string;
  effect?: "pulse";
  pulseCount?: number;
  durationMs?: number;
};

type TutorCompanionPosition = {
  x: number;
  y: number;
  facing: "left" | "right";
  targetKey: string;
  phase: "travelling" | "waiting" | "completed";
};

type TutorCharacter = {
  kind?: "uply-teacher";
  pose?: TeacherKimPose;
  position?: "left" | "right";
  voiceEnabled?: boolean;
  voiceLanguage?: "auto" | SmartLocale;
  voiceRate?: number;
  speechAssetId?: string;
};

type TutorSpeechCue = {
  startMs: number;
  endMs: number;
  charStart: number;
  charEnd: number;
  text: string;
};

type TutorSpeechManifest = {
  audioUrl: string;
  durationMs: number;
  cues: TutorSpeechCue[];
  voiceManifest: Record<string, unknown>;
};

type TutorSpeechStatus = "idle" | "loading" | "playing" | "paused" | "ended" | "error";

const tutorCharacterImages: Record<NonNullable<TutorCharacter["pose"]>, { idle: string; speaking: string; blink: string }> = {
  greeting: {
    idle: "/api/learning-agent/characters/greeting-idle",
    speaking: "/api/learning-agent/characters/greeting-speaking",
    blink: "/api/learning-agent/characters/greeting-blink",
  },
  explaining: {
    idle: "/api/learning-agent/characters/explaining-idle",
    speaking: "/api/learning-agent/characters/explaining-speaking",
    blink: "/api/learning-agent/characters/explaining-blink",
  },
  encouraging: {
    idle: "/api/learning-agent/characters/encouraging-idle",
    speaking: "/api/learning-agent/characters/encouraging-speaking",
    blink: "/api/learning-agent/characters/encouraging-blink",
  },
  "pointing-left": {
    idle: "/api/learning-agent/characters/pointing-left-idle",
    speaking: "/api/learning-agent/characters/pointing-left-speaking",
    blink: "/api/learning-agent/characters/pointing-left-blink",
  },
  "repeat-after-me": {
    idle: "/api/learning-agent/characters/repeat-after-me-idle",
    speaking: "/api/learning-agent/characters/repeat-after-me-speaking",
    blink: "/api/learning-agent/characters/repeat-after-me-blink",
  },
  listening: {
    idle: "/api/learning-agent/characters/listening-idle",
    speaking: "/api/learning-agent/characters/listening-speaking",
    blink: "/api/learning-agent/characters/listening-blink",
  },
  "gentle-correction": {
    idle: "/api/learning-agent/characters/gentle-correction-idle",
    speaking: "/api/learning-agent/characters/gentle-correction-speaking",
    blink: "/api/learning-agent/characters/gentle-correction-blink",
  },
};

const tutorCompanionImages = {
  pointing: "/api/learning-agent/companions/a-han-pointing",
  seatedCombingPoster: "/api/learning-agent/companions/a-han-seated-combing-poster",
} as const;

function tutorCompanionTargetPosition(target: HTMLElement, targetKey: string): TutorCompanionPosition {
  const rect = target.getBoundingClientRect();
  const learningArea = target.closest<HTMLElement>("[data-learning-area-hidden]");
  const bounds = learningArea?.getBoundingClientRect() ?? {
    left: 0,
    right: window.innerWidth,
    top: 0,
    bottom: window.innerHeight,
  };
  const compact = window.innerWidth < 640;
  const width = compact ? 76 : 104;
  const height = compact ? 78 : 106;
  const gap = 8;
  const canStandLeft = rect.left - bounds.left >= width + gap;
  const x = canStandLeft
    ? rect.left - width - gap
    : Math.min(bounds.right - width - gap, Math.max(bounds.left + gap, rect.right + gap));
  const targetCenterY = rect.top + Math.min(rect.height / 2, 72);
  const y = Math.max(bounds.top + gap, Math.min(bounds.bottom - height - gap, targetCenterY - height / 2));
  return {
    x: Math.round(x),
    y: Math.round(y),
    facing: canStandLeft ? "right" : "left",
    targetKey,
    phase: "waiting",
  };
}

type TutorInteraction = {
  kind?: "single_choice";
  prompt?: Partial<Record<SmartLocale, string>>;
  options?: string[];
  required?: boolean;
  maxAttempts?: number;
};

const accentMap = {
  jade: { solid: "var(--status-success)", pale: "var(--status-success-surface)", glow: "color-mix(in srgb, var(--status-success) 16%, transparent)" },
  iris: { solid: "var(--primary)", pale: "var(--accent)", glow: "color-mix(in srgb, var(--primary) 16%, transparent)" },
  coral: { solid: "var(--status-warning)", pale: "var(--status-warning-surface)", glow: "color-mix(in srgb, var(--status-warning) 16%, transparent)" },
  sky: { solid: "var(--support)", pale: "var(--accent)", glow: "color-mix(in srgb, var(--support) 16%, transparent)" },
} as const;

const chapterOneKnowledgeMap = {
  orientation: {
    title: { "zh-CN": "初次见面交流目标", "ko-KR": "첫 만남의 대화 목표" },
    summary: { "zh-CN": "完成问候、姓名、身份与礼貌结束", "ko-KR": "인사, 이름, 신분, 마무리까지 완성하기" },
    icon: Map,
  },
  vocabulary: {
    title: { "zh-CN": "问候与人物身份", "ko-KR": "인사와 인물의 신분" },
    summary: { "zh-CN": "掌握问候、姓名与人物身份词", "ko-KR": "인사, 이름, 신분을 나타내는 어휘 익히기" },
    icon: Languages,
  },
  grammar: {
    title: { "zh-CN": "主题助词与判断句", "ko-KR": "주제 조사와 서술격 표현" },
    summary: { "zh-CN": "会选择 은/는 和 이에요/예요", "ko-KR": "은/는과 이에요/예요를 알맞게 선택하기" },
    icon: Lightbulb,
  },
  patterns: {
    title: { "zh-CN": "姓名与身份介绍", "ko-KR": "이름과 신분 소개" },
    summary: { "zh-CN": "组合姓名与身份介绍句", "ko-KR": "이름과 신분을 소개하는 문장 만들기" },
    icon: Sparkles,
  },
  dialogue: {
    title: { "zh-CN": "初次见面对话结构", "ko-KR": "첫 만남의 대화 구조" },
    summary: { "zh-CN": "组织完整的初次见面对话", "ko-KR": "첫 만남의 대화를 완전하게 구성하기" },
    icon: MessageCircle,
  },
  listen_speak: {
    title: { "zh-CN": "听辨与口头表达", "ko-KR": "듣기 구별과 말하기" },
    summary: { "zh-CN": "听出身份并完成 30 秒介绍", "ko-KR": "신분을 듣고 30초 자기소개 완성하기" },
    icon: Headphones,
  },
  read_write: {
    title: { "zh-CN": "个人介绍读写", "ko-KR": "자기소개 읽기와 쓰기" },
    summary: { "zh-CN": "读懂并写出个人介绍", "ko-KR": "자기소개 글을 읽고 직접 쓰기" },
    icon: BookOpen,
  },
  review: {
    title: { "zh-CN": "独立交流能力", "ko-KR": "독립적인 의사소통 능력" },
    summary: { "zh-CN": "独立完成初次见面交流", "ko-KR": "첫 만남의 대화를 혼자 완성하기" },
    icon: CheckCircle2,
  },
} as const;

const chapterZeroOutline = {
  orientation: {
    icon: Map,
    meta: { "zh-CN": "16 课 · 4 个阶段", "ko-KR": "16개 단원 · 4단계" },
  },
  patterns: {
    icon: Clock3,
    meta: { "zh-CN": "8 步 · 3 轮学习", "ko-KR": "8단계 · 3회 학습" },
  },
  listen_speak: {
    icon: Sparkles,
    meta: { "zh-CN": "4 类常用工具", "ko-KR": "4가지 학습 도구" },
  },
  review: {
    icon: CheckCircle2,
    meta: { "zh-CN": "3 项开课准备", "ko-KR": "3가지 학습 준비" },
  },
} as const;

const ui = {
  "zh-CN": {
    back: "返回课程",
    fullscreen: "全屏",
    exitFullscreen: "退出全屏",
    progress: "本章进度",
    minutes: "分钟",
    language: "语言与辅助",
    interfaceLanguage: "界面语言",
    supportMode: "学习辅助",
    chinese: "中文辅助",
    bilingual: "双语过渡",
    immersion: "韩语沉浸",
    learnerPath: "学习路径",
    currentMission: "当前任务",
    previous: "上一步",
    next: "下一步",
    chapterTest: "进入章节测试",
    tutor: "课程老师",
    grounded: "基于本章内容与真实学习进度进行指导",
    explain: "解释当前内容",
    hint: "给我一个提示",
    example: "再给一个例句",
    roleplay: "陪我练对话",
    ask: "输入你不明白的地方…",
    send: "发送",
    submit: "提交答案",
    submitted: "已完成",
    submittedForReview: "已提交待复核",
    submitFailed: "提交失败",
    correct: "回答正确",
    retry: "再想一想",
    preview: "平台预览：结果不会写入学生记录",
    listenPrivate: "听力音频",
    audioPending: "音频正在制作，当前听力练习暂不可用。",
    playWord: "播放设备语音",
    moveUp: "上移",
    moveDown: "下移",
    startRecording: "开始录音",
    stopRecording: "停止录音",
    recorded: "已完成录音，可以回听后提交",
    recordingDenied: "无法使用麦克风，请检查浏览器权限后重试。",
    recordingUploading: "正在保存录音…",
    recordingUploadFailed: "录音上传失败，请重新录制后再试。",
    speakingPracticeComplete: "录音练习已完成，本次不进行自动发音评分。",
    testUnavailable: "章节测试尚未配置",
    writingCount: "韩文字数",
    objective: "本章达成目标",
    scene: "真实场景",
    phrases: "本课可调用表达",
    word: "韩语",
    pronunciation: "发音",
    meaning: "释义",
    pos: "词性",
    collocation: "搭配提示",
    form: "形式",
    exampleLabel: "原创例句",
    dialogue: "情境对话",
    reading: "生活文本",
    checklist: "我会了清单",
    noResponse: "请先完成作答。",
    saved: "设置已保存",
    pageUpdated: "教材刚刚更新，请刷新页面后再试。",
    requestFailed: "操作没有完成，请稍后重试。",
    refreshPage: "刷新页面",
  },
  "ko-KR": {
    back: "강좌로 돌아가기",
    fullscreen: "전체 화면",
    exitFullscreen: "전체 화면 종료",
    progress: "단원 진도",
    minutes: "분",
    language: "언어와 도움",
    interfaceLanguage: "화면 언어",
    supportMode: "학습 도움",
    chinese: "중국어 도움",
    bilingual: "이중 언어",
    immersion: "한국어 몰입",
    learnerPath: "학습 경로",
    currentMission: "현재 과제",
    previous: "이전 단계",
    next: "다음 단계",
    chapterTest: "단원 평가 시작",
    tutor: "과정 선생님",
    grounded: "단원 내용과 실제 학습 진도에 맞춰 안내합니다",
    explain: "현재 내용 설명",
    hint: "힌트 하나",
    example: "예문 하나 더",
    roleplay: "대화 연습",
    ask: "궁금한 내용을 입력하세요…",
    send: "보내기",
    submit: "정답 제출",
    submitted: "완료",
    submittedForReview: "제출됨 · 검토 대기",
    submitFailed: "제출 실패",
    correct: "정답입니다",
    retry: "다시 생각해 보세요",
    preview: "플랫폼 미리보기: 학생 기록에 저장되지 않습니다",
    listenPrivate: "듣기 음원",
    audioPending: "음원을 제작하고 있어 현재 듣기 연습을 사용할 수 없습니다.",
    playWord: "기기 음성으로 듣기",
    moveUp: "위로",
    moveDown: "아래로",
    startRecording: "녹음 시작",
    stopRecording: "녹음 중지",
    recorded: "녹음이 끝났습니다. 다시 듣고 제출하세요",
    recordingDenied: "마이크를 사용할 수 없습니다. 브라우저 권한을 확인해 주세요.",
    recordingUploading: "녹음을 저장하고 있어요…",
    recordingUploadFailed: "녹음 업로드에 실패했습니다. 다시 녹음해 주세요.",
    speakingPracticeComplete: "녹음 연습을 마쳤습니다. 자동 발음 평가는 제공하지 않습니다.",
    testUnavailable: "단원 평가가 아직 준비되지 않았습니다",
    writingCount: "글자 수",
    objective: "단원 성취 목표",
    scene: "실제 상황",
    phrases: "이번 단원의 핵심 표현",
    word: "한국어",
    pronunciation: "발음",
    meaning: "뜻",
    pos: "품사",
    collocation: "결합 표현",
    form: "형태",
    exampleLabel: "예문",
    dialogue: "상황 대화",
    reading: "생활 텍스트",
    checklist: "할 수 있어요",
    noResponse: "먼저 답을 완성하세요.",
    saved: "설정을 저장했습니다",
    pageUpdated: "교재가 방금 업데이트되었습니다. 페이지를 새로 고친 뒤 다시 시도해 주세요.",
    requestFailed: "작업을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    refreshPage: "새로 고침",
  },
} as const;

function isStaleServerActionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /unexpected response was received from the server|failed to find server action/i.test(message);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function microphonePrerequisiteError(locale: SmartLocale) {
  if (!window.isSecureContext) {
    return locale === "ko-KR"
      ? "현재 페이지가 HTTP로 열려 있어 브라우저가 마이크를 차단했습니다. HTTPS 주소로 다시 열어 주세요. 같은 컴퓨터에서 개발 중이라면 localhost를 사용할 수 있습니다."
      : "当前页面使用 HTTP，浏览器已阻止麦克风。请改用 HTTPS 地址；如果是在同一台电脑上开发，也可以使用 localhost。";
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    return locale === "ko-KR"
      ? "현재 브라우저는 녹음 기능을 지원하지 않습니다. 최신 Chrome, Edge 또는 Safari에서 다시 시도해 주세요."
      : "当前浏览器不支持录音功能，请使用最新版 Chrome、Edge 或 Safari。";
  }
  return null;
}

function TypewriterText({ text, speed = 52, onProgress, onComplete }: { text: string; speed?: number; onProgress?: () => void; onComplete?: () => void }) {
  const [visibleLength, setVisibleLength] = useState(0);
  const onCompleteRef = useRef(onComplete);
  const onProgressRef = useRef(onProgress);
  const finishedRef = useRef(false);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);
  useEffect(() => {
    finishedRef.current = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || speed <= 0) {
      setVisibleLength(text.length);
      onProgressRef.current?.();
      finishedRef.current = true;
      const timer = window.setTimeout(() => onCompleteRef.current?.(), 0);
      return () => window.clearTimeout(timer);
    }
    setVisibleLength(0);
    let index = 0;
    let timer = 0;
    const revealNext = () => {
      index += 1;
      setVisibleLength(index);
      onProgressRef.current?.();
      if (index >= text.length) {
        finishedRef.current = true;
        onCompleteRef.current?.();
        return;
      }
      const current = text[index - 1];
      const pause = /[.?!。？！]/u.test(current) ? 220 : /[,，]/u.test(current) ? 120 : speed;
      timer = window.setTimeout(revealNext, pause);
    };
    timer = window.setTimeout(revealNext, speed);
    return () => window.clearTimeout(timer);
  }, [speed, text]);
  return <span>{text.slice(0, visibleLength)}{visibleLength < text.length && <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-current align-middle" aria-hidden="true" />}</span>;
}

/**
 * Renders the currently-revealed prefix of the tutor's scripted line with its
 * bold/underline/color formatting attached per character, so the existing
 * character-by-character reveal keeps its exact timing while formatting
 * appears progressively along with the text. Falls back to the plain string
 * whenever the rich buffer is missing or its prefix doesn't reconstruct the
 * same text (e.g. a non-scripted status message reusing the same state).
 */
function renderRichTutorText(visibleText: string, rich: RichChar[] | null): ReactNode {
  if (!visibleText) return visibleText;
  if (!rich || rich.length < visibleText.length) return visibleText;
  const visible = rich.slice(0, visibleText.length);
  if (visible.map((item) => item.char).join("") !== visibleText) return visibleText;
  const runs: Array<{ text: string; bold: boolean; underline: boolean; color: RichChar["color"] }> = [];
  for (const item of visible) {
    const last = runs[runs.length - 1];
    if (last && last.bold === item.bold && last.underline === item.underline && last.color === item.color) {
      last.text += item.char;
    } else {
      runs.push({ text: item.char, bold: item.bold, underline: item.underline, color: item.color });
    }
  }
  return runs.map((run, index) => (!run.bold && !run.underline && !run.color)
    ? run.text
    : (
      <span
        key={index}
        className={`${run.bold ? "font-bold" : ""} ${run.underline ? "underline" : ""}`}
        style={run.color ? { color: RICH_TEXT_COLOR_VALUES[run.color] } : undefined}
      >
        {run.text}
      </span>
    ));
}

function PatternConversationPractice({ activity, audioAssets, locale, trackingDisabled, onActivityCompleted }: {
  activity: SmartTextbookActivity;
  audioAssets: SmartTextbookMediaAsset[];
  locale: SmartLocale;
  trackingDisabled: boolean;
  onActivityCompleted?: (result: { nodeId: string | null; nodeCompleted: boolean; completionPercent: number; preview: boolean }) => void;
}) {
  const conversation = objectValue(activity.config.conversation);
  const steps = Array.isArray(conversation.steps) ? conversation.steps.map(objectValue) : [];
  const savedAnswers = Array.isArray(activity.response) ? activity.response.map(Number) : [];
  const [cursor, setCursor] = useState(activity.completed && savedAnswers.length > 0 ? steps.length : 0);
  const [answers, setAnswers] = useState<number[]>(savedAnswers);
  const [result, setResult] = useState<{ choiceIndex: number; optionIndex: number; correct: boolean } | null>(null);
  const [checking, setChecking] = useState(false);
  const [forceReplay, setForceReplay] = useState(false);
  const [voiceReadingEnabled, setVoiceReadingEnabled] = useState(false);
  const conversationScrollRef = useRef<HTMLDivElement>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const completed = cursor >= steps.length || (activity.completed && !forceReplay);
  const current = steps[cursor];
  const currentKind = String(current?.kind ?? "line");
  const currentOptions = stringArray(current?.options);
  const currentChoiceIndex = Number(current?.choiceIndex);
  const currentAnswer = result?.correct && result.choiceIndex === currentChoiceIndex ? currentOptions[result.optionIndex] ?? "" : "";
  const visibleSteps = steps.slice(0, Math.min(cursor + 1, steps.length));
  const title = String(objectValue(conversation.title)[locale] ?? (locale === "ko-KR" ? "첫 만남 대화 완성" : "完成初次见面对话"));
  const instruction = String(objectValue(conversation.instruction)[locale] ?? (locale === "ko-KR" ? "알맞은 대답을 골라 대화를 이어 가세요." : "选择合适的回答，让对话继续。"));
  const activeSpokenLine = currentKind === "choice" ? currentAnswer : String(current?.line ?? "");
  const activeAudioKey = String(current?.audioAssetKey ?? "");
  const activeAudioUrl = audioAssets.find((asset) => asset.key === activeAudioKey && asset.status === "ready")?.url ?? null;
  useEffect(() => {
    activeAudioRef.current?.pause();
    activeAudioRef.current = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    if (!voiceReadingEnabled) {
      return;
    }
    if (!activeSpokenLine) return;
    if (activeAudioUrl) {
      const audio = new Audio(activeAudioUrl);
      activeAudioRef.current = audio;
      void audio.play().catch(() => speakKorean(activeSpokenLine));
      return;
    }
    speakKorean(activeSpokenLine);
  }, [activeAudioUrl, activeSpokenLine, voiceReadingEnabled]);
  useEffect(() => () => {
    activeAudioRef.current?.pause();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);
  const scrollConversationToLatest = () => {
    const container = conversationScrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  };

  async function advance() {
    const next = cursor + 1;
    setResult(null);
    setCursor(next);
    if (next < steps.length || activity.completed || trackingDisabled) return;
    const submitted = await submitSmartTextbookActivityAction({ activityId: activity.id, response: answers, locale });
    if (submitted.ok) onActivityCompleted?.({ nodeId: submitted.nodeId, nodeCompleted: submitted.nodeCompleted, completionPercent: submitted.completionPercent, preview: submitted.preview });
  }

  async function choose(optionIndex: number) {
    if (checking || !Number.isInteger(currentChoiceIndex) || currentChoiceIndex < 0) return;
    setChecking(true);
    const checked = await checkSmartTextbookActivityPageAction({ activityId: activity.id, itemIndices: [currentChoiceIndex], response: [optionIndex] });
    setChecking(false);
    if (!checked.ok) return;
    const correct = Boolean(checked.results[0]);
    setResult({ choiceIndex: currentChoiceIndex, optionIndex, correct });
    if (!correct) return;
    const nextAnswers = [...answers];
    nextAnswers[currentChoiceIndex] = optionIndex;
    setAnswers(nextAnswers);
  }

  return <section className="rounded-[22px] border border-[var(--border-subtle)] bg-[var(--card)] p-5 sm:p-7">
    <div className="flex items-center justify-between gap-4"><CardTitleWithHint title={title} description={instruction} headingLevel={4} titleClassName="text-lg font-bold text-[var(--foreground)]" hintLabel={locale === "ko-KR" ? "대화 방법 보기" : "查看对话方法"} /><div className="flex shrink-0 items-center gap-2"><button type="button" role="switch" aria-checked={voiceReadingEnabled} onClick={() => setVoiceReadingEnabled((enabled) => !enabled)} className={`inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-xs font-bold transition ${voiceReadingEnabled ? "bg-[var(--accent)] text-[var(--primary)]" : "bg-[var(--surface-soft)] text-[var(--foreground-secondary)]"}`}><Volume2 size={14} aria-hidden="true" /><span>{locale === "ko-KR" ? "음성 읽기" : "语音朗读"}</span><span className={`relative h-4 w-7 rounded-full transition ${voiceReadingEnabled ? "bg-[var(--primary)]" : "bg-[var(--border-strong)]"}`} aria-hidden="true"><span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${voiceReadingEnabled ? "translate-x-3.5" : "translate-x-0.5"}`} /></span></button><span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${completed ? "bg-[var(--status-success-surface)] text-[var(--status-success)]" : "bg-[var(--surface-soft)] text-[var(--foreground-secondary)]"}`}>{completed && <CheckCircle2 size={14} aria-hidden="true" />}{completed ? locale === "ko-KR" ? "대화 완료" : "对话完成" : `${cursor + 1} / ${steps.length}`}</span></div></div>
    <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
      <div ref={conversationScrollRef} className="max-h-[520px] min-h-[380px] overflow-y-auto scroll-smooth rounded-[22px] bg-[var(--surface-soft)] p-4 sm:p-6"><div className="space-y-5" aria-live="polite">{visibleSteps.map((step, index) => {
        const kind = String(step.kind ?? "line");
        const isCurrent = index === cursor;
        const choiceIndex = Number(step.choiceIndex);
        const choiceOptions = stringArray(step.options);
        const line = kind === "choice" ? (isCurrent ? currentAnswer : choiceOptions[answers[choiceIndex]] ?? "") : String(step.line ?? "");
        if (kind === "choice" && !line) return null;
        const side = step.side === "right" ? "right" : "left";
        const speaker = String(objectValue(step.speaker)[locale] ?? step.speaker ?? "");
        return <div key={String(step.id ?? index)} className={`flex items-end gap-3 ${side === "right" ? "justify-end" : "justify-start"}`}><div className={`max-w-[78%] ${side === "right" ? "order-1 text-right" : "order-2"}`}><div className="mb-1 text-xs font-bold text-[var(--foreground-secondary)]">{speaker}</div><div className={`rounded-[20px] border px-5 py-3.5 text-left text-base font-bold leading-7 shadow-sm ${side === "right" ? "rounded-br-md border-[var(--primary)] bg-[var(--accent)] text-[var(--foreground)]" : "rounded-bl-md border-[var(--border-subtle)] bg-[var(--card)] text-[var(--foreground)]"}`} lang="ko">{isCurrent ? <TypewriterText text={line} speed={Number(step.typingSpeedMs) || 52} onProgress={scrollConversationToLatest} onComplete={() => window.setTimeout(advance, Number(step.afterMs) || 360)} /> : line}</div></div><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold shadow-sm ${side === "right" ? "order-2 bg-[var(--primary)] text-[var(--primary-foreground)]" : "order-1 bg-[var(--card)] text-[var(--primary)]"}`}>{speaker.slice(0, 1)}</div></div>;
      })}</div></div>
      <div className="rounded-[22px] border border-[var(--border-subtle)] bg-[var(--card)] p-5">{completed ? <div className="flex min-h-[300px] flex-col items-center justify-center text-center"><CheckCircle2 size={30} className="text-[var(--status-success)]" /><p className="mt-3 text-lg font-bold text-[var(--foreground)]">{locale === "ko-KR" ? "대화를 완성했어요" : "本段对话已完成"}</p><button type="button" onClick={() => { setForceReplay(true); setCursor(0); setAnswers([]); setResult(null); }} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-subtle)] px-4 text-sm font-bold"><RotateCcw size={16} />{locale === "ko-KR" ? "다시 연습" : "重新练习"}</button></div> : currentKind === "choice" && !currentAnswer ? <fieldset><legend className="text-sm font-bold text-[var(--foreground)]">{String(objectValue(current.prompt)[locale] ?? (locale === "ko-KR" ? "알맞은 말을 고르세요" : "选择合适的回答"))}</legend><div className="mt-4 grid gap-3">{currentOptions.map((option, optionIndex) => { const selectedResult = result?.choiceIndex === currentChoiceIndex && result.optionIndex === optionIndex ? result : null; return <button key={option} type="button" disabled={checking} onClick={() => choose(optionIndex)} className={`min-h-14 rounded-xl border px-4 py-3 text-left text-sm font-bold leading-6 transition ${selectedResult?.correct === false ? "border-[var(--destructive)] bg-[var(--destructive)]/10 text-[var(--destructive)]" : "border-[var(--border-subtle)] text-[var(--foreground)] hover:border-[var(--primary)] hover:bg-[var(--accent)]"}`}><span lang="ko">{option}</span>{selectedResult?.correct === false && <XCircle size={16} className="ml-2 inline" aria-label={locale === "ko-KR" ? "오답" : "错误"} />}</button>; })}</div></fieldset> : <div className="flex min-h-[300px] items-center justify-center text-center text-sm font-semibold text-[var(--foreground-muted)]">{currentAnswer ? locale === "ko-KR" ? "대답이 대화에 나타나고 있어요…" : "回答正在逐字加入对话…" : locale === "ko-KR" ? "상대방의 말을 듣고 있어요…" : "对方正在说话…"}</div>}</div>
    </div>
  </section>;
}

function PatternCompositionPractice({ activity, locale, trackingDisabled, onActivityCompleted }: {
  activity: SmartTextbookActivity;
  locale: SmartLocale;
  trackingDisabled: boolean;
  onActivityCompleted?: (result: { nodeId: string | null; nodeCompleted: boolean; completionPercent: number; preview: boolean }) => void;
}) {
  const composition = objectValue(activity.config.composition);
  const steps = Array.isArray(composition.steps) ? composition.steps.map(objectValue) : [];
  const savedAnswers = stringArray(activity.response);
  const [cursor, setCursor] = useState(activity.completed && savedAnswers.length === steps.length ? steps.length : 0);
  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>(savedAnswers);
  const [checking, setChecking] = useState(false);
  const [incorrect, setIncorrect] = useState(false);
  const [voiceReadingEnabled, setVoiceReadingEnabled] = useState(false);
  const dialogueRef = useRef<HTMLDivElement>(null);
  const current = steps[cursor];
  const currentPrompt = String(current?.prompt ?? "");
  const complete = cursor >= steps.length;
  const assembled = selectedTokens.join(" ").replace(/\s+([?.!,])/g, "$1");
  const visibleSteps = steps.slice(0, cursor);
  const title = String(objectValue(composition.title)[locale] ?? (locale === "ko-KR" ? "대화 조합하기" : "组合一段完整对话"));
  const instruction = String(objectValue(composition.instruction)[locale] ?? (locale === "ko-KR" ? "말덩이를 골라 대답을 완성하세요." : "按自然顺序选择语块，组成完整回答。"));

  useEffect(() => {
    const container = dialogueRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [cursor]);
  useEffect(() => {
    if (!voiceReadingEnabled) {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      return;
    }
    if (currentPrompt) speakKorean(currentPrompt);
  }, [currentPrompt, voiceReadingEnabled]);
  useEffect(() => () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); }, []);

  async function checkAnswer() {
    if (!assembled || checking) return;
    setChecking(true);
    const checked = await checkSmartTextbookActivityPageAction({ activityId: activity.id, itemIndices: [cursor], response: [assembled] });
    setChecking(false);
    if (!checked.ok || !checked.results[0]) {
      setIncorrect(true);
      return;
    }
    const nextAnswers = [...answers];
    nextAnswers[cursor] = assembled;
    setAnswers(nextAnswers);
    setIncorrect(false);
    if (voiceReadingEnabled) speakKorean(assembled);
    window.setTimeout(async () => {
      const nextCursor = cursor + 1;
      setCursor(nextCursor);
      setSelectedTokens([]);
      if (nextCursor < steps.length || activity.completed || trackingDisabled) return;
      const submitted = await submitSmartTextbookActivityAction({ activityId: activity.id, response: nextAnswers, locale });
      if (submitted.ok) onActivityCompleted?.({ nodeId: submitted.nodeId, nodeCompleted: submitted.nodeCompleted, completionPercent: submitted.completionPercent, preview: submitted.preview });
    }, 520);
  }

  return <section className="rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-5 sm:p-7">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <CardTitleWithHint title={title} description={instruction} headingLevel={4} titleClassName="text-lg font-bold text-[var(--foreground)]" hintLabel={locale === "ko-KR" ? "조합 방법 보기" : "查看组合方法"} />
      <div className="flex shrink-0 items-center gap-2"><button type="button" role="switch" aria-checked={voiceReadingEnabled} onClick={() => setVoiceReadingEnabled((enabled) => !enabled)} className={`inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${voiceReadingEnabled ? "bg-[var(--accent)] text-[var(--primary)]" : "bg-[var(--card)] text-[var(--foreground-secondary)]"}`}><Volume2 size={14} aria-hidden="true" /><span>{locale === "ko-KR" ? "음성 읽기" : "语音朗读"}</span><span className={`relative h-4 w-7 rounded-full transition ${voiceReadingEnabled ? "bg-[var(--primary)]" : "bg-[var(--border-strong)]"}`} aria-hidden="true"><span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${voiceReadingEnabled ? "translate-x-3.5" : "translate-x-0.5"}`} /></span></button><span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${complete ? "bg-[var(--status-success-surface)] text-[var(--status-success)]" : "bg-[var(--card)] text-[var(--foreground-secondary)]"}`}>{complete && <CheckCircle2 size={14} aria-hidden="true" />}{complete ? locale === "ko-KR" ? "완성" : "全部完成" : `${cursor + 1} / ${steps.length}`}</span></div>
    </div>
    <div className="mt-5 grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,.95fr)]">
      <div ref={dialogueRef} className="max-h-[520px] min-h-[420px] overflow-y-auto scroll-smooth rounded-[22px] border border-[var(--border-subtle)] bg-[var(--card)] p-5 sm:p-6" aria-live="polite">
        <div className="space-y-5">
          {visibleSteps.map((step, index) => <div key={String(step.id ?? index)} className="space-y-3"><div className="flex items-end gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-soft)] text-xs font-bold text-[var(--primary)]">{String(objectValue(step.speaker)[locale] ?? "").slice(0, 1)}</span><p className="max-w-[78%] rounded-[20px] rounded-bl-md border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-5 py-3 text-sm font-bold leading-6 text-[var(--foreground)]" lang="ko">{String(step.prompt ?? "")}</p></div><div className="flex justify-end"><p className="max-w-[78%] rounded-[20px] rounded-br-md border border-[var(--primary)] bg-[var(--accent)] px-5 py-3 text-sm font-bold leading-6 text-[var(--foreground)]" lang="ko">{answers[index]}</p></div></div>)}
          {!complete && current && <div className="flex items-end gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-soft)] text-xs font-bold text-[var(--primary)]">{String(objectValue(current.speaker)[locale] ?? "").slice(0, 1)}</span><p className="max-w-[78%] rounded-[20px] rounded-bl-md border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-5 py-3 text-sm font-bold leading-6 text-[var(--foreground)]" lang="ko"><TypewriterText text={String(current.prompt ?? "")} speed={45} /></p></div>}
        </div>
      </div>
      <div className="rounded-[22px] border border-[var(--border-subtle)] bg-[var(--card)] p-5 sm:p-6">
        {complete ? <div className="flex min-h-[370px] flex-col items-center justify-center text-center"><CheckCircle2 size={36} className="text-[var(--status-success)]" /><p className="mt-4 text-lg font-bold text-[var(--foreground)]">{locale === "ko-KR" ? "첫 만남 대화를 완성했어요" : "你已经组合完成初次见面对话"}</p><button type="button" onClick={() => { setCursor(0); setAnswers([]); setSelectedTokens([]); }} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] px-4 text-sm font-bold text-[var(--foreground)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"><RotateCcw size={16} aria-hidden="true" />{locale === "ko-KR" ? "다시 조합하기" : "重新组合"}</button></div> : current && <><CardTitleWithHint title={String(objectValue(current.task)[locale] ?? (locale === "ko-KR" ? "대답을 완성하세요" : "组成你的回答"))} description={String(objectValue(current.hint)[locale] ?? "")} headingLevel={4} titleClassName="text-base font-bold text-[var(--foreground)]" hintLabel={locale === "ko-KR" ? "힌트 보기" : "查看提示"} />
          <div className={`mt-5 min-h-20 rounded-2xl border-2 border-dashed p-4 ${incorrect ? "border-[var(--destructive)] bg-[var(--destructive)]/5" : selectedTokens.length ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border-strong)] bg-[var(--surface-soft)]"}`}><p className="text-xs font-bold text-[var(--foreground-secondary)]">{locale === "ko-KR" ? "나의 대답" : "我的回答"}</p><div className="mt-2 flex min-h-8 flex-wrap items-center gap-2" lang="ko">{selectedTokens.length ? selectedTokens.map((token, index) => <button key={`${token}-${index}`} type="button" onClick={() => { setSelectedTokens((tokens) => tokens.filter((_, tokenIndex) => tokenIndex !== index)); setIncorrect(false); }} className="min-h-9 rounded-lg bg-[var(--card)] px-3 text-sm font-bold text-[var(--foreground)] shadow-sm" aria-label={`${token}，${locale === "ko-KR" ? "제거" : "移除"}`}>{token}</button>) : <span className="text-sm font-semibold text-[var(--foreground-muted)]">{locale === "ko-KR" ? "아래 말덩이를 순서대로 고르세요" : "从下方依次选择语块"}</span>}</div></div>
          <div className="mt-5 flex flex-wrap gap-2">{stringArray(current.tokens).map((token, index) => <button key={`${token}-${index}`} type="button" onClick={() => { setSelectedTokens((tokens) => [...tokens, token]); setIncorrect(false); }} className="min-h-11 rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] px-4 text-sm font-bold text-[var(--foreground)] transition hover:border-[var(--primary)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">{token}</button>)}</div>
          <div className="mt-6 flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-5"><button type="button" onClick={() => { setSelectedTokens([]); setIncorrect(false); }} disabled={!selectedTokens.length} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-[var(--foreground-secondary)] disabled:opacity-35"><RotateCcw size={16} aria-hidden="true" />{locale === "ko-KR" ? "다시 놓기" : "重新排列"}</button><button type="button" onClick={checkAnswer} disabled={!selectedTokens.length || checking} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-5 text-sm font-bold text-[var(--primary-foreground)] disabled:cursor-not-allowed disabled:opacity-40">{checking ? locale === "ko-KR" ? "확인 중…" : "检查中…" : locale === "ko-KR" ? "대화에 넣기" : "加入对话"}</button></div>
          {incorrect && <p className="mt-3 flex items-center gap-2 text-sm font-bold text-[var(--destructive)]" role="status"><XCircle size={16} aria-hidden="true" />{locale === "ko-KR" ? "말덩이 순서를 다시 확인하세요." : "语块顺序还不自然，请重新调整。"}</p>}</>}
      </div>
    </div>
  </section>;
}

function asBooleanArray(value: unknown) {
  return Array.isArray(value) ? value.map(Boolean) : [];
}

function speakKorean(text: string, onComplete?: () => void) {
  if (!("speechSynthesis" in window)) {
    onComplete?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ko-KR";
  utterance.rate = 0.82;
  utterance.onend = () => onComplete?.();
  window.speechSynthesis.speak(utterance);
}

function commaChunkedRevealBreakpoints(text: string) {
  const breakpoints = [...text.matchAll(/[，,、。！？!?；;]/g)]
    .map((match) => (match.index ?? 0) + 1)
    .filter((index) => index < text.length);
  breakpoints.push(text.length);
  return breakpoints;
}

function speakTutorCharacterLine(
  text: string,
  character: TutorCharacter | null,
  onStatusChange?: (status: "playing" | "ended" | "error") => void,
  onTextProgress?: (revealedText: string) => void,
) {
  if (!text.trim() || character?.voiceEnabled === false || !("speechSynthesis" in window)) {
    onStatusChange?.("ended");
    onTextProgress?.(text);
    return;
  }
  const koreanCharacterCount = text.match(/[가-힣]/g)?.length ?? 0;
  const chineseCharacterCount = text.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const detectedLanguage: SmartLocale = koreanCharacterCount > chineseCharacterCount ? "ko-KR" : "zh-CN";
  const language = character?.voiceLanguage && character.voiceLanguage !== "auto"
    ? character.voiceLanguage
    : detectedLanguage;
  const voices = window.speechSynthesis.getVoices();
  const languageVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith(language.slice(0, 2).toLowerCase()));
  const preferredFemaleVoice = languageVoices.find((voice) =>
    /sunhi|xiaoxiao|xiaoyi|female|samantha|zira|tingting|meijia/i.test(voice.name),
  );
  const breakpoints = commaChunkedRevealBreakpoints(text);
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language;
  utterance.rate = Math.max(0.75, Math.min(1.25, Number(character?.voiceRate) || 1));
  utterance.pitch = 1.04;
  utterance.voice = preferredFemaleVoice ?? languageVoices[0] ?? null;
  let boundaryFired = false;
  utterance.onboundary = (event) => {
    boundaryFired = true;
    const breakpoint = breakpoints.find((index) => index > event.charIndex) ?? text.length;
    const segmentStart = breakpoints.filter((index) => index <= event.charIndex).pop() ?? 0;
    onTextProgress?.(text.slice(segmentStart, breakpoint));
  };
  utterance.onstart = () => onStatusChange?.("playing");
  utterance.onend = () => {
    if (!boundaryFired) onTextProgress?.(text);
    onStatusChange?.("ended");
  };
  utterance.onerror = () => {
    if (!boundaryFired) onTextProgress?.(text);
    onStatusChange?.("error");
  };
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function parseTutorSpeechManifest(value: unknown): TutorSpeechManifest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.audioUrl !== "string" || !record.audioUrl || !Array.isArray(record.cues)) return null;
  const cues = record.cues.flatMap((cue) => {
    if (!cue || typeof cue !== "object" || Array.isArray(cue)) return [];
    const item = cue as Record<string, unknown>;
    const startMs = Number(item.startMs);
    const endMs = Number(item.endMs);
    const charStart = Number(item.charStart);
    const charEnd = Number(item.charEnd);
    if (![startMs, endMs, charStart, charEnd].every(Number.isFinite)) return [];
    return [{ startMs, endMs, charStart, charEnd, text: String(item.text ?? "") }];
  });
  return {
    audioUrl: record.audioUrl,
    durationMs: Math.max(1, Number(record.durationMs) || 1),
    cues,
    voiceManifest: record.voiceManifest && typeof record.voiceManifest === "object" && !Array.isArray(record.voiceManifest)
      ? record.voiceManifest as Record<string, unknown>
      : {},
  };
}

function speakKoreanSequence(
  texts: string[],
  options: {
    isCurrent: () => boolean;
    onStep: (index: number) => void;
    onComplete: () => void;
    onPlaybackComplete?: () => void;
  },
) {
  if (!("speechSynthesis" in window)) {
    options.onComplete();
    return;
  }
  const sequence = texts.filter(Boolean);
  if (sequence.length === 0) {
    options.onComplete();
    return;
  }
  window.speechSynthesis.cancel();
  let playbackFailed = false;

  const speakNext = (index: number) => {
    if (!options.isCurrent()) return;
    const text = sequence[index];
    if (!text) {
      options.onComplete();
      if (!playbackFailed) options.onPlaybackComplete?.();
      return;
    }
    options.onStep(index);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = 0.82;
    utterance.onend = () => speakNext(index + 1);
    utterance.onerror = () => {
      playbackFailed = true;
      speakNext(index + 1);
    };
    window.speechSynthesis.speak(utterance);
  };

  speakNext(0);
}

function ListenSpeakLearningPanel({
  node,
  locale,
  supportMode,
  page,
  moduleHeader,
}: {
  node: SmartTextbookNode;
  locale: SmartLocale;
  supportMode: SmartSupportMode;
  page: number;
  moduleHeader?: { title: string; stepLabel: string; minutes: number };
}) {
  const content = node.content;
  const context = Object.keys(objectValue(content.listeningContext)).length > 0
    ? objectValue(content.listeningContext)
    : objectValue(content.lead);
  const focus = Array.isArray(content.listeningFocus)
    ? content.listeningFocus.map(objectValue)
    : stringArray(content.listenFor).map((item) => ({ "zh-CN": item, "ko-KR": item }));
  const fallbackSpeakingFrame = String(content.speakingFrame ?? "");
  const fallbackRepeatLines = fallbackSpeakingFrame.split("→").map((item) => item.trim()).filter(Boolean).map((item) => ({ ko: item, zh: item }));
  const repeatLines = Array.isArray(content.repeatLines) ? content.repeatLines.map(objectValue) : fallbackRepeatLines;
  const outputChecklist = stringArray(content.outputChecklist).length > 0
    ? stringArray(content.outputChecklist)
    : stringArray(content.speakingCriteria).length > 0
      ? stringArray(content.speakingCriteria)
      : stringArray(content.requiredInformation);
  const repeatTracks = Array.isArray(content.repeatTracks) && content.repeatTracks.length > 0
    ? content.repeatTracks.map(objectValue)
    : repeatLines.length > 0
      ? [{ id: "shared-speaking-frame", title: { "zh-CN": "本课表达框架", "ko-KR": "이번 단원 표현 틀" }, lines: repeatLines, keywords: outputChecklist }]
      : [];
  const repeatRecordingActivity = node.activities.find((activity) => activity.type === "speaking");
  const listeningActivity = node.activities.find((activity) => activity.type === "listening");
  const [repeatTask, setRepeatTask] = useState<0 | 1>(0);
  const [repeatTrackIndex, setRepeatTrackIndex] = useState(0);
  const [repeatLineIndex, setRepeatLineIndex] = useState(0);
  const [repeatLinePlaybackStarted, setRepeatLinePlaybackStarted] = useState(false);
  const [showRepeatTranscript, setShowRepeatTranscript] = useState(false);
  const [completedRepeatSegments, setCompletedRepeatSegments] = useState<Set<string>>(() => new Set(
    (repeatRecordingActivity?.guidedRepeatProgress ?? []).map((item) => `0:${item.trackIndex}:${item.segmentIndex}`),
  ));
  const repeatReferenceAudioRef = useRef<HTMLAudioElement | null>(null);
  const [repeatReferencePlaying, setRepeatReferencePlaying] = useState(false);
  const sceneImage = node.media.find((asset) => asset.type === "image" && asset.status === "ready" && asset.url);
  const showChinese = supportMode !== "immersion";

  if (page === 1 || page === 3) return null;

  if (page === 2) {
    const track = repeatTracks[repeatTrackIndex] ?? {};
    const lines = Array.isArray(track.lines) ? track.lines.map(objectValue) : repeatLines;
    const line = lines[Math.min(repeatLineIndex, Math.max(0, lines.length - 1))] ?? {};
    const segmentKey = `${repeatTask}:${repeatTrackIndex}:${repeatTask === 0 ? repeatLineIndex : 0}`;
    const trackCompleted = repeatTask === 0
      ? lines.length > 0 && lines.every((_, index) => completedRepeatSegments.has(`0:${repeatTrackIndex}:${index}`))
      : completedRepeatSegments.has(`1:${repeatTrackIndex}:0`);
    const resetRepeatLinePlayback = () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      setRepeatLinePlaybackStarted(false);
    };
    const playRepeatLine = (index: number) => {
      const nextIndex = Math.min(Math.max(index, 0), Math.max(lines.length - 1, 0));
      setRepeatLineIndex(nextIndex);
      speakKorean(String(lines[nextIndex]?.ko ?? ""), () => {
        const completionKey = `0:${repeatTrackIndex}:${nextIndex}`;
        setCompletedRepeatSegments((current) => new Set(current).add(completionKey));
        if (repeatRecordingActivity) {
          void saveGuidedRepeatProgressAction({
            activityId: repeatRecordingActivity.id,
            practiceKey: "repeat-line",
            trackIndex: repeatTrackIndex,
            segmentIndex: nextIndex,
          });
        }
      });
    };
    const stopRepeatReference = () => {
      const audio = repeatReferenceAudioRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      setRepeatReferencePlaying(false);
    };
    const playRepeatReference = () => {
      const audio = repeatReferenceAudioRef.current;
      if (!audio) return;
      audio.currentTime = 0;
      void audio.play();
    };
    return (
      <section className="rounded-[22px] bg-[var(--surface-soft)] p-5 sm:p-6" aria-label={locale === "ko-KR" ? "듣고 따라 말하기" : "跟读复现"}>
        <p className="sr-only">当前按钮播放设备示范音；正式音频上传后会在同一位置自动替换。</p>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--card)] p-2">
          <div className="flex items-center gap-2" role="tablist" aria-label={locale === "ko-KR" ? "따라 말하기 과제" : "跟读复现任务"}>
            {[locale === "ko-KR" ? "문장별 따라 말하기" : "逐句跟读", locale === "ko-KR" ? "전체 재현" : "整段复现"].map((label, index) => <button key={label} type="button" role="tab" aria-selected={repeatTask === index} onClick={() => { resetRepeatLinePlayback(); stopRepeatReference(); setRepeatTask(index as 0 | 1); setRepeatLineIndex(0); setShowRepeatTranscript(false); }} className={`min-h-11 rounded-xl px-4 text-sm font-bold ${repeatTask === index ? "bg-[var(--accent)] text-[var(--primary)] shadow-sm" : "text-[var(--foreground-secondary)] hover:bg-[var(--surface-soft)]"}`}>{label}</button>)}
          </div>
          <span className="pr-3 text-xs font-bold text-[var(--foreground-muted)]">{repeatTask + 1} / 2</span>
        </div>
        {repeatTracks.length > 1 && <div className="mt-4 flex flex-wrap gap-2">{repeatTracks.map((item, index) => { const itemLines = Array.isArray(item.lines) ? item.lines : []; const itemCompleted = repeatTask === 0 && itemLines.length > 0 && itemLines.every((_, lineIndex) => completedRepeatSegments.has(`0:${index}:${lineIndex}`)); return <button key={String(item.id ?? index)} type="button" onClick={() => { resetRepeatLinePlayback(); stopRepeatReference(); setRepeatTrackIndex(index); setRepeatLineIndex(0); setShowRepeatTranscript(false); }} className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 text-sm font-bold ${repeatTrackIndex === index ? "border-[var(--primary)] bg-[var(--accent)] text-[var(--primary)]" : "border-[var(--border-subtle)] bg-[var(--card)] text-[var(--foreground-secondary)]"}`}>{String(objectValue(item.title)[locale] ?? `听力 ${index + 1}`)}{itemCompleted && <CheckCircle2 size={15} className="text-[var(--status-success)]" aria-label={locale === "ko-KR" ? "완료" : "已完成"} />}</button>; })}</div>}

        {repeatTask === 0 ? <>{!repeatLinePlaybackStarted ? <div className="mt-5 flex min-h-24 items-center justify-between gap-4 rounded-[22px] border border-[var(--border-subtle)] bg-[var(--card)] px-5 py-4 sm:px-6">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-[var(--foreground)]">{locale === "ko-KR" ? "문장별 따라 말하기를 시작하세요" : "开始逐句跟读"}</p>{trackCompleted && <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--status-success)]"><CheckCircle2 size={14} aria-hidden="true" />{locale === "ko-KR" ? "완료" : "已完成"}</span>}</div><p className="mt-1 text-xs text-[var(--foreground-muted)]">{locale === "ko-KR" ? "시작하면 첫 문장이 자동으로 재생됩니다." : "点击后将自动播放第一句。"}</p></div>
          <button type="button" onClick={() => { setRepeatLinePlaybackStarted(true); playRepeatLine(0); }} disabled={lines.length === 0} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-bold text-[var(--primary-foreground)] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"><Play size={16} aria-hidden="true" />{trackCompleted ? locale === "ko-KR" ? "다시 재생" : "重新播放" : locale === "ko-KR" ? "재생 시작" : "开始播放"}</button>
        </div> : <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-[22px] bg-[var(--card)] p-6">
            <div className="flex items-center justify-between gap-4"><span className="text-xs font-bold text-[var(--primary)]">{String(repeatLineIndex + 1).padStart(2, "0")} / {lines.length}</span></div>
            <p className="mt-6 text-2xl font-bold leading-10 text-[var(--foreground)]" lang="ko">{String(line.ko ?? "")}</p>
            {showChinese && <p className="mt-2 text-sm text-[var(--foreground-muted)]">{String(line.zh ?? "")}</p>}
            <button type="button" onClick={() => playRepeatLine(repeatLineIndex)} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-subtle)] px-4 text-sm font-bold text-[var(--primary)]"><Volume2 size={16} />{locale === "ko-KR" ? "시범 음성" : "播放示范"}</button>
            <div className="mt-4 flex justify-between"><button type="button" disabled={repeatLineIndex === 0} onClick={() => { const nextIndex = Math.max(0, repeatLineIndex - 1); if (repeatLinePlaybackStarted) playRepeatLine(nextIndex); else setRepeatLineIndex(nextIndex); }} className="min-h-10 rounded-xl px-3 text-sm font-bold disabled:opacity-30">{locale === "ko-KR" ? "이전 문장" : "上一句"}</button><button type="button" disabled={repeatLineIndex >= lines.length - 1} onClick={() => { const nextIndex = Math.min(lines.length - 1, repeatLineIndex + 1); if (repeatLinePlaybackStarted) playRepeatLine(nextIndex); else setRepeatLineIndex(nextIndex); }} className="min-h-10 rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-[var(--primary-foreground)] disabled:opacity-30">{locale === "ko-KR" ? "다음 문장" : "下一句"}</button></div>
          </div>
          <ol className="rounded-[22px] border border-[var(--border-subtle)] bg-[var(--card)] p-4">{lines.map((item, index) => { const lineCompleted = completedRepeatSegments.has(`0:${repeatTrackIndex}:${index}`); return <li key={index}><button type="button" onClick={() => { if (repeatLinePlaybackStarted) playRepeatLine(index); else setRepeatLineIndex(index); }} className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-bold ${repeatLineIndex === index ? "bg-[var(--accent)] text-[var(--primary)]" : "text-[var(--foreground-secondary)]"}`}><span>{String(index + 1).padStart(2, "0")}</span><span className="min-w-0 flex-1 truncate" lang="ko">{String(item.ko ?? "")}</span>{lineCompleted && <CheckCircle2 size={16} className="shrink-0 text-[var(--status-success)]" aria-label={locale === "ko-KR" ? "완료" : "已完成"} />}</button></li>; })}</ol>
        </div>}{trackCompleted && <p className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[var(--status-success)]"><CheckCircle2 size={16} aria-hidden="true" />{locale === "ko-KR" ? "문장별 따라 말하기를 완료했습니다" : "逐句跟读已完成"}</p>}</> : <div className="mt-5 rounded-[22px] bg-[var(--card)] p-6">
          <CardTitleWithHint title={locale === "ko-KR" ? "키워드로 전체 내용을 재현하세요" : "根据关键词复现整段内容"} description={locale === "ko-KR" ? "전체 원고를 보지 않고 핵심어를 연결해 말하세요." : "不查看完整母稿，只根据关键词按原顺序复现。"} headingLevel={3} titleClassName="text-lg font-bold" hintLabel={locale === "ko-KR" ? "재현 방법 보기" : "查看复现方法"} />
          <div className="mt-5 flex flex-wrap gap-2">{stringArray(track.keywords).map((keyword) => <span key={keyword} className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-sm font-bold text-[var(--primary)]" lang="ko">{keyword}</span>)}</div>
          {repeatRecordingActivity && <RecordingControl activityId={repeatRecordingActivity.id} locale={locale} playbackLabel={locale === "ko-KR" ? "나의 재현" : "我的复现"} afterPlaybackActions={trackCompleted ? <div className="rounded-xl bg-[var(--surface-soft)] p-3"><p className="text-xs font-bold text-[var(--foreground-muted)]">{locale === "ko-KR" ? "녹음 후 비교" : "完成后对照"}</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={playRepeatReference} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] px-4 text-sm font-bold text-[var(--foreground-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"><Volume2 size={16} aria-hidden="true" />{repeatReferencePlaying ? locale === "ko-KR" ? "원음 재생 중" : "正在播放原音" : locale === "ko-KR" ? "원음과 비교" : "对照原音"}</button><button type="button" aria-expanded={showRepeatTranscript} onClick={() => setShowRepeatTranscript((visible) => !visible)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] px-4 text-sm font-bold text-[var(--foreground-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">{showRepeatTranscript ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}{showRepeatTranscript ? locale === "ko-KR" ? "원고 닫기" : "收起原稿" : locale === "ko-KR" ? "원고 보기" : "查看原稿"}</button></div></div> : undefined} uploadMetadata={{ practiceKey: "full-recall", trackIndex: repeatTrackIndex, segmentIndex: 0 }} onReset={() => { stopRepeatReference(); setShowRepeatTranscript(false); setCompletedRepeatSegments((current) => { const next = new Set(current); next.delete(segmentKey); return next; }); }} onReady={() => setCompletedRepeatSegments((current) => new Set(current).add(segmentKey))} />}
          {listeningActivity && <audio ref={repeatReferenceAudioRef} preload="none" src={`/api/digital-textbook/audio/${listeningActivity.id}?page=${repeatTrackIndex}`} onPlay={() => setRepeatReferencePlaying(true)} onPause={() => setRepeatReferencePlaying(false)} onEnded={() => setRepeatReferencePlaying(false)} hidden />}
          {showRepeatTranscript && <p className="mt-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-5 font-bold leading-8 text-[var(--foreground)]" lang="ko">{lines.map((item) => String(item.ko ?? "")).filter(Boolean).join(" ")}</p>}
          {trackCompleted && <p className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[var(--status-success)]"><CheckCircle2 size={16} />{locale === "ko-KR" ? "현재 음원 과제를 완료했습니다" : "当前音轨任务已完成"}</p>}
        </div>}
      </section>
    );
  }

  return (
    <section className="space-y-5" aria-label={locale === "ko-KR" ? "듣기 전 준비" : "听前准备"}>
      {sceneImage?.url && (
        <div data-learning-target="scene:image" tabIndex={-1} className="relative aspect-[5/2] min-h-[270px] overflow-hidden rounded-[22px] bg-[var(--surface-soft)] outline-none">
          <Image src={sceneImage.url} alt="" fill sizes="(min-width: 1024px) 1100px, 100vw" className="object-cover" priority />
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/75 to-transparent" aria-hidden="true" />
          {moduleHeader && <div className="absolute right-6 top-5 flex items-baseline gap-2 text-white drop-shadow"><span className="text-base font-bold">{moduleHeader.title}</span><span className="text-xs font-semibold">{moduleHeader.stepLabel} · {locale === "ko-KR" ? "예상" : "预计"} {moduleHeader.minutes} {locale === "ko-KR" ? "분" : "分钟"}</span></div>}
          <p className="absolute bottom-6 left-6 right-6 max-w-3xl text-lg font-bold leading-8 text-white drop-shadow sm:text-xl">{String(context[locale] ?? "")}</p>
        </div>
      )}
      <div className="rounded-[22px] bg-[var(--surface-soft)] p-5 sm:p-6">
        <CardTitleWithHint title={locale === "ko-KR" ? "무엇을 들어야 할까요?" : "先确定要听什么"} description={locale === "ko-KR" ? "전체 원고를 미리 읽지 말고 핵심 정보 네 가지를 먼저 확인하세요." : "不提前展示完整原文，只先建立四个信息目标。"} headingLevel={3} titleClassName="text-lg font-bold text-[var(--foreground)]" hintLabel={locale === "ko-KR" ? "듣기 방법 보기" : "查看听辨方法"} />
        <ol className="relative mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(focus.length > 0 ? focus : outputChecklist.map((item) => ({ "zh-CN": item, "ko-KR": item }))).map((item, index) => <li key={index} className="relative rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)] p-4"><span className="text-xs font-bold text-[var(--primary)]">{String(index + 1).padStart(2, "0")}</span><p className="mt-3 text-sm font-bold leading-6 text-[var(--foreground)]">{String(item[locale] ?? "")}</p></li>)}
        </ol>
      </div>
      {outputChecklist.length > 0 && <p className="sr-only">{outputChecklist.join("、")}</p>}
    </section>
  );
}

function ContentRenderer({
  node,
  locale,
  supportMode,
  moduleHeader,
  contentPage = 0,
  patternPage = 0,
  trackingDisabled = false,
  onActivityCompleted,
  onLearningEvent,
}: {
  node: SmartTextbookNode;
  locale: SmartLocale;
  supportMode: SmartSupportMode;
  moduleHeader?: {
    title: string;
    description: string;
    stepLabel: string;
    minutes: number;
  };
  contentPage?: number;
  patternPage?: number;
  trackingDisabled?: boolean;
  onActivityCompleted?: (result: { nodeId: string | null; nodeCompleted: boolean; completionPercent: number; preview: boolean }) => void;
  onLearningEvent?: (event: { eventType: "audio_completed"; targetKey: string }) => void;
}) {
  const [sceneDialogueStep, setSceneDialogueStep] = useState(0);
  const [sceneDialoguePlaying, setSceneDialoguePlaying] = useState(false);
  const [activeDialogueGroupIndex, setActiveDialogueGroupIndex] = useState(0);
  const [activeGrammarCardIndex, setActiveGrammarCardIndex] = useState(0);
  const [guidedDialogueIndex, setGuidedDialogueIndex] = useState<number | null>(null);
  const [vocabularyPlaybackIndex, setVocabularyPlaybackIndex] = useState<number | null>(null);
  const [vocabularyPlaying, setVocabularyPlaying] = useState(false);
  const [activePatternCardIndex, setActivePatternCardIndex] = useState(0);
  const [visitedPatternCardIndices, setVisitedPatternCardIndices] = useState<Set<number>>(() => new Set([0]));
  const [activePatternGroupIndex, setActivePatternGroupIndex] = useState(0);
  const [activePatternQuestionIndex, setActivePatternQuestionIndex] = useState(0);
  const [patternChoiceAnswers, setPatternChoiceAnswers] = useState<number[]>(() => Array(9).fill(-1));
  const [patternChoiceChecks, setPatternChoiceChecks] = useState<Record<number, boolean[]>>({});
  const [checkingPatternChoices, setCheckingPatternChoices] = useState(false);
  const [patternOutputTask, setPatternOutputTask] = useState<0 | 1>(() =>
    node.activities.find((activity) => activity.key === "pattern-order")?.completed ? 1 : 0,
  );
  const [completedPatternOutputTasks, setCompletedPatternOutputTasks] = useState<Set<string>>(() =>
    new Set(node.activities.filter((activity) => activity.completed).map((activity) => activity.key)),
  );
  const sceneDialogueRunRef = useRef(0);
  const sceneDialogueHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vocabularyRunRef = useRef(0);
  const vocabularyHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = ui[locale];
  const content = node.content;
  const showChinese = supportMode !== "immersion";
  const lead = objectValue(content.lead);
  const coach = objectValue(content.coach);
  const targets = Array.isArray(content.targets) ? content.targets.map(objectValue) : [];
  const configuredDialogueGroups = Array.isArray(content.dialogueGroups)
    ? content.dialogueGroups.map(objectValue)
    : [];
  const vocabulary = Array.isArray(content.vocabulary)
    ? content.vocabulary.map(objectValue)
    : [];
  const rules = Array.isArray(content.rules) ? content.rules.map(objectValue) : [];
  const dialogue = Array.isArray(content.dialogue)
    ? content.dialogue.map(objectValue)
    : [];
  const checklist = Array.isArray(content.checklist)
    ? content.checklist.map(objectValue)
    : [];
  const questions = stringArray(content.questions);
  const substitutions = stringArray(content.substitutions);
  const replacementSets = Array.isArray(content.replacementSets) ? content.replacementSets.map(stringArray) : [];
  const substitutionGroups = Array.isArray(content.substitutionGroups)
    ? content.substitutionGroups.map(stringArray)
    : replacementSets.length > 0
      ? replacementSets
      : substitutions.length > 0
        ? [substitutions]
        : [];
  const practice = objectValue(content.practice);
  const quickResponse = stringArray(content.quickResponse).length > 0
    ? stringArray(content.quickResponse)
    : typeof practice.quickResponse === "string" ? [String(practice.quickResponse)] : [];
  const personalOutput = stringArray(content.personalOutput).length > 0
    ? stringArray(content.personalOutput)
    : stringArray(content.personalFrames).length > 0
      ? stringArray(content.personalFrames)
      : typeof practice.personalOutput === "string" ? [String(practice.personalOutput)] : [];
  const patternChoiceActivity = node.activities.find((activity) => activity.key === "pattern-choice");
  const patternOrderActivity = node.activities.find((activity) => activity.type === "ordering");
  const patternComposeActivity = node.activities.find((activity) => activity.key === "pattern-compose");
  const patternForms = String(content.pattern ?? "").split("→").map((item) => item.trim()).filter(Boolean);
  const patternCards = Array.isArray(content.patternCards) && content.patternCards.length > 0
    ? content.patternCards.map(objectValue)
    : (patternForms.length > 0 ? patternForms : patternOrderActivity?.options ?? []).slice(0, 6).map((form, index) => ({
        form,
        function: {
          "zh-CN": `第 ${index + 1} 个表达节点`,
          "ko-KR": `${index + 1}번째 표현 단계`,
        },
        examples: substitutionGroups[index]?.length > 0 ? substitutionGroups[index] : [form],
      }));
  const isPatternContent = Boolean(patternOrderActivity);
  const patternConversation = objectValue(patternChoiceActivity?.config.conversation);
  const patternConversationSteps = Array.isArray(patternConversation.steps) ? patternConversation.steps.map(objectValue) : [];
  const patternChoiceGroups = Array.isArray(patternChoiceActivity?.config.groups) ? patternChoiceActivity.config.groups.map(objectValue) : [];
  const allPatternChoiceGroupsCompleted = patternChoiceGroups.length > 0 && patternChoiceGroups.every((_, index) => patternChoiceChecks[index]?.every(Boolean));

  function completePatternOutputTask(
    activityKey: string,
    result: { nodeId: string | null; nodeCompleted: boolean; completionPercent: number; preview: boolean },
  ) {
    if (!result.preview && !trackingDisabled) {
      setCompletedPatternOutputTasks((current) => new Set(current).add(activityKey));
    }
    onActivityCompleted?.(result);
  }

  async function checkPatternChoiceGroup(groupIndex: number) {
    if (!patternChoiceActivity) return;
    const group = patternChoiceGroups[groupIndex];
    const items = Array.isArray(group?.items) ? group.items.map(objectValue) : [];
    const offset = patternChoiceGroups.slice(0, groupIndex).reduce((total, current) => total + (Array.isArray(current.items) ? current.items.length : 0), 0);
    const responses = items.map((_, index) => patternChoiceAnswers[offset + index] ?? -1);
    if (responses.some((value) => value < 0)) return;
    setCheckingPatternChoices(true);
    const result = await checkSmartTextbookActivityPageAction({ activityId: patternChoiceActivity.id, itemIndices: items.map((_, index) => offset + index), response: responses });
    setCheckingPatternChoices(false);
    if (!result.ok) return;
    setPatternChoiceChecks((current) => ({ ...current, [groupIndex]: result.results }));
    const otherGroupsCorrect = patternChoiceGroups.every((_, index) => index === groupIndex || patternChoiceChecks[index]?.every(Boolean));
    if (result.results.every(Boolean) && otherGroupsCorrect && !patternChoiceActivity.completed && !trackingDisabled) {
      const submitted = await submitSmartTextbookActivityAction({ activityId: patternChoiceActivity.id, response: patternChoiceAnswers, locale });
      if (submitted.ok) onActivityCompleted?.({ nodeId: submitted.nodeId, nodeCompleted: submitted.nodeCompleted, completionPercent: submitted.completionPercent, preview: submitted.preview });
    }
  }
  const contrast = stringArray(content.contrast);
  const grammarCards = Array.isArray(content.grammarCards)
    ? content.grammarCards.map(objectValue)
    : [];
  const dialogueScenes = Array.isArray(content.dialogueScenes)
    ? content.dialogueScenes.map(objectValue)
    : [];
  const dialogueFlow = Array.isArray(content.dialogueFlow)
    ? content.dialogueFlow.map(objectValue)
    : [];
  const imageAssets = node.media.filter((asset) => asset.type === "image");
  const sceneImage = imageAssets.find((asset) => asset.status === "ready" && asset.url);
  const dialogueGroups = configuredDialogueGroups.length > 0
    ? configuredDialogueGroups
    : dialogueScenes.length > 0
      ? dialogueScenes.map((scene, index) => ({
          id: `scene-${index + 1}`,
          title: { "zh-CN": String(scene.title ?? `场景 ${index + 1}`), "ko-KR": String(scene.title ?? `장면 ${index + 1}`) },
          lines: Array.isArray(scene.lines) ? scene.lines : [],
        }))
    : [{
        id: "expressions",
        title: { "zh-CN": "核心表达", "ko-KR": "핵심 표현" },
        lines: targets,
      }];
  const activeDialogueGroup = dialogueGroups[Math.min(activeDialogueGroupIndex, dialogueGroups.length - 1)];
  const activeDialogueGroupLines = Array.isArray(activeDialogueGroup?.lines)
    ? activeDialogueGroup.lines.map(objectValue)
    : [];
  const sceneDialogueLines = activeDialogueGroupLines
    .map((line) => String(line.ko ?? "").trim())
    .filter(Boolean);
  const grammarExampleLines = grammarCards.flatMap((card) =>
    Array.isArray(card.examples)
      ? card.examples.map(objectValue).map((example) => String(example.ko ?? "").trim()).filter(Boolean)
      : [],
  );
  const scenePlaybackLines = grammarExampleLines.length > 0 ? grammarExampleLines : sceneDialogueLines;
  const activeScenePlaybackLine = sceneDialogueStep > 0
    ? scenePlaybackLines[sceneDialogueStep - 1] ?? null
    : null;
  const visibleSceneDialogueLines = sceneDialogueLines.slice(0, sceneDialogueStep);
  const leftSceneDialogue = visibleSceneDialogueLines
    .filter((_, index) => index % 2 === 0)
    .at(-1);
  const rightSceneDialogue = visibleSceneDialogueLines
    .filter((_, index) => index % 2 === 1)
    .at(-1);
  const activeVocabulary = vocabularyPlaybackIndex === null
    ? null
    : vocabulary[vocabularyPlaybackIndex] ?? null;
  const vocabularyHotspots = objectValue(sceneImage?.metadata.wordHotspots);
  const activeVocabularyHotspot = objectValue(
    vocabularyHotspots[String(activeVocabulary?.ko ?? "")],
  );
  const activeVocabularyHotspotLeft = Number(activeVocabularyHotspot.left);
  const activeVocabularyHotspotTop = Number(activeVocabularyHotspot.top);
  const hasActiveVocabularyHotspot = Number.isFinite(activeVocabularyHotspotLeft)
    && Number.isFinite(activeVocabularyHotspotTop);
  const sceneGoal = locale === "ko-KR"
    ? String(sceneImage?.metadata.goalKo ?? node.title[locale])
    : String(sceneImage?.metadata.goalZh ?? node.title[locale]);

  const playVocabularySequence = () => {
    const playableWords = vocabulary.filter((word) => String(word.ko ?? "").trim());
    if (playableWords.length === 0) return;

    const runId = vocabularyRunRef.current + 1;
    vocabularyRunRef.current = runId;
    if (vocabularyHideTimerRef.current) clearTimeout(vocabularyHideTimerRef.current);
    vocabularyHideTimerRef.current = null;
    window.speechSynthesis?.cancel();
    setVocabularyPlaybackIndex(null);
    setVocabularyPlaying(true);

    const finish = () => {
      if (vocabularyRunRef.current !== runId) return;
      setVocabularyPlaying(false);
      vocabularyHideTimerRef.current = setTimeout(() => {
        if (vocabularyRunRef.current === runId) setVocabularyPlaybackIndex(null);
      }, 5000);
    };

    if (!("speechSynthesis" in window)) {
      setVocabularyPlaybackIndex(0);
      finish();
      return;
    }

    const speakWord = (wordIndex: number) => {
      if (vocabularyRunRef.current !== runId) return;
      const word = playableWords[wordIndex];
      if (!word) {
        finish();
        return;
      }
      setVocabularyPlaybackIndex(vocabulary.indexOf(word));
      const utterances = [String(word.ko), String(word.collocation ?? "")].filter(Boolean);
      const speakUtterance = (utteranceIndex: number) => {
        if (vocabularyRunRef.current !== runId) return;
        const text = utterances[utteranceIndex];
        if (!text) {
          speakWord(wordIndex + 1);
          return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "ko-KR";
        utterance.rate = utteranceIndex === 0 ? 0.72 : 0.8;
        utterance.onend = () => speakUtterance(utteranceIndex + 1);
        utterance.onerror = () => window.setTimeout(
          () => speakUtterance(utteranceIndex + 1),
          utteranceIndex === 0 ? 900 : 1400,
        );
        window.speechSynthesis.speak(utterance);
      };
      speakUtterance(0);
    };

    speakWord(0);
  };

  const playSceneDialogue = (completionTargetKey?: string) => {
    const runId = sceneDialogueRunRef.current + 1;
    sceneDialogueRunRef.current = runId;
    if (sceneDialogueHideTimerRef.current) {
      clearTimeout(sceneDialogueHideTimerRef.current);
      sceneDialogueHideTimerRef.current = null;
    }
    setSceneDialogueStep(0);
    setSceneDialoguePlaying(true);
    setGuidedDialogueIndex(null);
    speakKoreanSequence(scenePlaybackLines, {
      isCurrent: () => sceneDialogueRunRef.current === runId,
      onStep: (index) => setSceneDialogueStep(index + 1),
      onComplete: () => {
        setSceneDialoguePlaying(false);
        sceneDialogueHideTimerRef.current = setTimeout(() => {
          if (sceneDialogueRunRef.current === runId) setSceneDialogueStep(0);
        }, 5000);
      },
      onPlaybackComplete: completionTargetKey
        ? () => onLearningEvent?.({ eventType: "audio_completed", targetKey: completionTargetKey })
        : undefined,
    });
  };

  const playGuidedDialogueLine = (index: number, completionTargetKey?: string) => {
    const nextIndex = Math.min(Math.max(index, 0), Math.max(sceneDialogueLines.length - 1, 0));
    const text = sceneDialogueLines[nextIndex];
    if (!text) return;

    const runId = sceneDialogueRunRef.current + 1;
    sceneDialogueRunRef.current = runId;
    if (sceneDialogueHideTimerRef.current) clearTimeout(sceneDialogueHideTimerRef.current);
    sceneDialogueHideTimerRef.current = null;
    window.speechSynthesis?.cancel();
    setGuidedDialogueIndex(nextIndex);
    setSceneDialogueStep(nextIndex + 1);
    setSceneDialoguePlaying(true);

    if (!("speechSynthesis" in window)) {
      setSceneDialoguePlaying(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = 0.78;
    const finish = (completed: boolean) => {
      if (sceneDialogueRunRef.current === runId) setSceneDialoguePlaying(false);
      if (completed && completionTargetKey) {
        onLearningEvent?.({ eventType: "audio_completed", targetKey: completionTargetKey });
      }
    };
    utterance.onend = () => finish(true);
    utterance.onerror = () => finish(false);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => () => {
    sceneDialogueRunRef.current += 1;
    vocabularyRunRef.current += 1;
    if (sceneDialogueHideTimerRef.current) clearTimeout(sceneDialogueHideTimerRef.current);
    if (vocabularyHideTimerRef.current) clearTimeout(vocabularyHideTimerRef.current);
    window.speechSynthesis?.cancel();
  }, []);

  if (node.code === "mission-map" && targets.length > 0) {
    return (
      <div className={sceneImage ? "" : "mt-6"}>
        {sceneImage?.url && (
          <figure data-learning-target="orientation:scene" tabIndex={-1} className="relative mb-5 aspect-[4/3] overflow-hidden rounded-[22px] bg-[var(--surface-soft)] outline-none sm:aspect-[5/2]">
            <div data-learning-target="scene:image" tabIndex={-1} className="absolute inset-0 outline-none">
              <Image
                src={sceneImage.url}
                alt={sceneImage.altText[locale]}
                fill
                unoptimized
                priority
                sizes="(min-width: 1280px) 70vw, (min-width: 1024px) 75vw, 100vw"
                className={`object-cover transition-transform duration-700 ease-out motion-reduce:transform-none motion-reduce:transition-none ${
                  sceneDialoguePlaying
                    ? sceneDialogueStep % 2 === 1
                      ? "translate-x-[1%] scale-[1.03]"
                      : "-translate-x-[1%] scale-[1.03]"
                    : "translate-x-0 scale-100"
                }`}
              />
              <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" aria-hidden="true" />
            </div>
            {moduleHeader && (
              <div className="absolute right-5 top-4 z-10 text-white [text-shadow:0_1px_3px_rgb(0_0_0_/_0.9)] sm:right-7 sm:top-6">
                <CardTitleWithHint
                  title={(
                    <>
                      <span>{moduleHeader.title}</span>
                      <span className="text-[11px] font-medium tabular-nums text-white/90">
                        {moduleHeader.stepLabel}
                        <span className="mx-1" aria-hidden="true">·</span>
                        {locale === "ko-KR" ? "예상" : "预计"} {moduleHeader.minutes} {t.minutes}
                      </span>
                    </>
                  )}
                  description={moduleHeader.description}
                  headingLevel={1}
                  tone="inverse"
                  className="items-center"
                  titleClassName="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-lg font-bold"
                  hintLabel={locale === "ko-KR" ? "학습 단계 설명 보기" : "查看学习步骤说明"}
                />
              </div>
            )}
            <button
              type="button"
              data-learning-target="orientation:scene:audio"
              onClick={() => playSceneDialogue("orientation:scene:audio")}
              aria-label={locale === "ko-KR" ? "장면 대화 재생" : "播放情景对话"}
              title={locale === "ko-KR" ? "장면 대화 재생" : "播放情景对话"}
              className="absolute left-5 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[var(--primary)] shadow-lg transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:left-7 sm:top-6"
            >
              <Volume2
                size={18}
                className={sceneDialoguePlaying ? "animate-pulse motion-reduce:animate-none" : ""}
                aria-hidden="true"
              />
            </button>
            {sceneDialogueStep > 0 && (
              <div className="absolute inset-x-4 top-[30%] z-20 space-y-2 sm:hidden" aria-live="polite">
                {leftSceneDialogue && (
                  <p className="w-fit animate-in rounded-2xl bg-white/95 px-3 py-2 text-sm font-bold text-slate-900 shadow-lg duration-300 fade-in-0 zoom-in-95 motion-reduce:animate-none">
                    {leftSceneDialogue}
                  </p>
                )}
                {rightSceneDialogue && (
                  <p className="ml-auto w-fit animate-in rounded-2xl bg-white/95 px-3 py-2 text-sm font-bold text-slate-900 shadow-lg duration-300 fade-in-0 zoom-in-95 motion-reduce:animate-none">
                    {rightSceneDialogue}
                  </p>
                )}
              </div>
            )}
            {leftSceneDialogue && (
              <button
                type="button"
                onClick={() => speakKorean(leftSceneDialogue)}
                aria-label={`${leftSceneDialogue}，${t.playWord}`}
                className="absolute left-[28%] top-[5%] z-20 hidden min-h-11 animate-in items-center gap-2 rounded-2xl bg-white/95 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-lg duration-300 fade-in-0 zoom-in-95 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] motion-reduce:animate-none sm:flex"
              >
                <span>{leftSceneDialogue}</span>
                <Volume2 size={13} className="text-[var(--primary)]" aria-hidden="true" />
                <span className="absolute -bottom-1 left-7 h-3 w-3 rotate-45 bg-white/95" />
              </button>
            )}
            {rightSceneDialogue && (
              <button
                type="button"
                onClick={() => speakKorean(rightSceneDialogue)}
                aria-label={`${rightSceneDialogue}，${t.playWord}`}
                className="absolute right-[24%] top-[18%] z-20 hidden min-h-11 animate-in items-center gap-2 rounded-2xl bg-white/95 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-lg duration-300 fade-in-0 zoom-in-95 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] motion-reduce:animate-none sm:flex"
              >
                <span>{rightSceneDialogue}</span>
                <Volume2 size={13} className="text-[var(--primary)]" aria-hidden="true" />
                <span className="absolute -bottom-1 right-7 h-3 w-3 rotate-45 bg-white/95" />
              </button>
            )}
            <figcaption className="absolute inset-x-0 bottom-0 z-10 max-w-2xl p-5 text-white [text-shadow:0_1px_3px_rgb(0_0_0_/_0.9)] sm:p-7 lg:p-8">
              <div data-learning-target="orientation:scene:title" tabIndex={-1} className="w-fit outline-none">
                <CardTitleWithHint
                  title={node.title[locale]}
                  description={(
                    <span className="space-y-2">
                      {String(lead[locale] ?? "") && <span className="block">{String(lead[locale])}</span>}
                      {String(coach[locale] ?? "") && <span className="block">{String(coach[locale])}</span>}
                    </span>
                  )}
                  headingLevel={4}
                  hintLabel={locale === "ko-KR" ? "상세 설명 보기" : "查看详细说明"}
                  tone="inverse"
                  titleClassName="text-2xl font-bold leading-tight tracking-tight sm:text-[28px]"
                />
              </div>
              <p data-learning-target="orientation:scene:meta" tabIndex={-1} className="mt-3 flex w-fit flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-white/90 outline-none">
                <span>30 {locale === "ko-KR" ? "초 연속 말하기" : "秒连续表达"}</span>
                <span aria-hidden="true">·</span>
                <span>{targets.length} {locale === "ko-KR" ? "가지 의사소통 기능" : "项交流功能"}</span>
              </p>
            </figcaption>
          </figure>
        )}
        <section data-learning-target="orientation:phrases" tabIndex={-1} className="rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-5 outline-none sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <CardTitleWithHint
              title={t.phrases}
              description={locale === "ko-KR" ? "대화 묶음을 고르고 한 문장 또는 전체 대화를 들어 보세요." : "选择一组对话，可以播放单句或整组对话。"}
              headingLevel={4}
              titleClassName="text-sm font-bold text-[var(--foreground)]"
              hintClassName="-ml-1"
              hintLabel={locale === "ko-KR" ? "대화 재생 방법 보기" : "查看对话播放说明"}
            />
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                data-learning-target="orientation:phrases:follow"
                onClick={() => playGuidedDialogueLine(guidedDialogueIndex === null || guidedDialogueIndex >= sceneDialogueLines.length - 1 ? 0 : guidedDialogueIndex + 1, "orientation:phrases:follow")}
                className="hidden min-h-11 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] px-3 text-xs font-bold text-[var(--foreground-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] motion-reduce:transition-none sm:flex"
              >
                <Mic size={17} aria-hidden="true" />
                <span>
                  {guidedDialogueIndex === null
                    ? locale === "ko-KR" ? "한 문장씩 따라 하기" : "逐句跟读"
                    : guidedDialogueIndex >= sceneDialogueLines.length - 1
                      ? locale === "ko-KR" ? "다시 따라 하기" : "重新跟读"
                      : locale === "ko-KR" ? "다음 문장" : "下一句"}
                </span>
              </button>
              <button
                type="button"
                data-learning-target="orientation:phrases:play-all"
                onClick={() => playSceneDialogue("orientation:phrases:play-all")}
                className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-[var(--accent)] px-3 text-xs font-bold text-[var(--primary)] transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] motion-reduce:transition-none"
                aria-label={locale === "ko-KR" ? "현재 대화 전체 재생" : "播放当前整组对话"}
              >
                <Volume2 size={18} aria-hidden="true" />
                <span>{locale === "ko-KR" ? "전체 듣기" : "整组播放"}</span>
              </button>
            </div>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-1" role="group" aria-label={locale === "ko-KR" ? "대화 묶음 선택" : "选择对话组"}>
            {dialogueGroups.map((group, index) => {
              const active = index === activeDialogueGroupIndex;
              const groupTitle = String(objectValue(group.title)[locale] ?? `${locale === "ko-KR" ? "대화" : "对话"} ${index + 1}`);
              return (
                <button
                  key={String(group.id ?? index)}
                  type="button"
                  data-learning-target={`orientation:phrases:group:${String(group.id ?? index)}`}
                  aria-pressed={active}
                  onClick={() => {
                    sceneDialogueRunRef.current += 1;
                    window.speechSynthesis?.cancel();
                    if (sceneDialogueHideTimerRef.current) clearTimeout(sceneDialogueHideTimerRef.current);
                    sceneDialogueHideTimerRef.current = null;
                    setSceneDialoguePlaying(false);
                    setSceneDialogueStep(0);
                    setGuidedDialogueIndex(null);
                    setActiveDialogueGroupIndex(index);
                  }}
                  className={`min-h-11 shrink-0 rounded-xl border px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] motion-reduce:transition-none ${active ? "border-[var(--primary)] bg-[var(--accent)] text-[var(--primary)]" : "border-[var(--border-subtle)] bg-[var(--card)] text-[var(--foreground-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]"}`}
                >
                  {groupTitle}
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {activeDialogueGroupLines.map((line, index) => {
              const activeLine = guidedDialogueIndex === index
                || (sceneDialoguePlaying && sceneDialogueStep - 1 === index);
              const learningTargetKey = `dialogue:${String(activeDialogueGroup?.id ?? activeDialogueGroupIndex)}:${index}`;
              return (
              <button
                key={`${String(line.ko)}-${index}`}
                type="button"
                onClick={() => {
                  const canTrackCompletion = "speechSynthesis" in window;
                  speakKorean(String(line.ko), canTrackCompletion
                    ? () => onLearningEvent?.({ eventType: "audio_completed", targetKey: learningTargetKey })
                    : undefined);
                }}
                data-learning-target={learningTargetKey}
                aria-current={activeLine ? "true" : undefined}
                className={`group min-h-[104px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)] p-4 text-left transition-colors hover:border-[var(--primary)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${activeLine ? "sm:border-[var(--primary)] sm:bg-[var(--accent)] sm:shadow-sm" : ""}`}
                title={t.playWord}
                aria-label={`${String(line.ko)}${showChinese ? `，${String(line.zh)}` : ""}，${t.playWord}`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-[var(--foreground-muted)]">
                    {String(line.speaker ?? (index % 2 === 0 ? "A" : "B"))}
                  </span>
                  <Volume2 size={14} className="text-[var(--primary)] transition-transform group-hover:scale-110" aria-hidden="true" />
                </span>
                <span className="mt-3 block text-[18px] font-bold leading-7 text-[var(--foreground)]">
                  {String(line.ko)}
                </span>
                {showChinese && (
                  <span className="mt-1 block text-xs font-semibold leading-5 text-[var(--foreground-secondary)]">
                    {String(line.zh)}
                  </span>
                )}
              </button>
            );})}
          </div>
        </section>
      </div>
    );
  }

  if (dialogueScenes.length > 0) {
    const currentScene = dialogueScenes[Math.min(activeDialogueGroupIndex, dialogueScenes.length - 1)] ?? {};
    const currentSceneTitleValue = currentScene.title;
    const currentSceneTitle = String(objectValue(currentSceneTitleValue)[locale] ?? currentSceneTitleValue ?? `${locale === "ko-KR" ? "장면" : "场景"} ${activeDialogueGroupIndex + 1}`);
    const currentSceneContext = String(objectValue(currentScene.context)[locale] ?? "");
    const currentSceneCoverage = stringArray(currentScene.coverage);
    const effectiveDialogueFlow = dialogueFlow.length > 0
      ? dialogueFlow
      : dialogueScenes.map((scene, index) => ({
          title: scene.title,
          description: scene.context,
          words: Array.isArray(scene.coverage) ? scene.coverage : [],
          order: index + 1,
        }));
    const coveredWords = Array.from(new Set(effectiveDialogueFlow.flatMap((item) => stringArray(item.words))));
    const renderDialogueSceneImage = () => sceneImage?.url ? (
      <figure className="relative aspect-[4/3] overflow-hidden rounded-[22px] bg-[var(--surface-soft)] sm:aspect-[5/2]">
        <Image
          src={sceneImage.url}
          alt={sceneImage.altText[locale]}
          fill
          unoptimized
          priority={Boolean(moduleHeader)}
          sizes="(min-width: 1280px) 70vw, (min-width: 1024px) 75vw, 100vw"
          className="object-cover object-center"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" aria-hidden="true" />
        {moduleHeader && (
          <div className="absolute right-5 top-4 z-10 max-w-[calc(100%-2.5rem)] text-white [text-shadow:0_1px_3px_rgb(0_0_0_/_0.9)] sm:right-7 sm:top-6">
            <CardTitleWithHint
              title={(
                <>
                  <span>{moduleHeader.title}</span>
                  <span className="text-[11px] font-medium tabular-nums text-white/90">
                    {moduleHeader.stepLabel}<span className="mx-1" aria-hidden="true">·</span>{locale === "ko-KR" ? "예상" : "预计"} {moduleHeader.minutes} {t.minutes}
                  </span>
                </>
              )}
              description={moduleHeader.description}
              headingLevel={1}
              tone="inverse"
              className="items-center"
              titleClassName="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-lg font-bold"
              hintLabel={locale === "ko-KR" ? "학습 단계 설명 보기" : "查看学习步骤说明"}
            />
          </div>
        )}
        <figcaption className="absolute inset-x-0 bottom-0 z-10 max-w-3xl p-5 text-white [text-shadow:0_1px_3px_rgb(0_0_0_/_0.9)] sm:p-7 lg:p-8">
          <CardTitleWithHint
            title={contentPage === 0 ? node.title[locale] : currentSceneTitle}
            description={contentPage === 0 ? String(lead[locale] ?? "") : currentSceneContext}
            headingLevel={4}
            tone="inverse"
            titleClassName="text-2xl font-bold leading-tight tracking-tight sm:text-[28px]"
            hintLabel={locale === "ko-KR" ? "장면 설명 보기" : "查看场景说明"}
          />
        </figcaption>
      </figure>
    ) : null;

    return contentPage === 0 ? (
      <div className="mt-8 space-y-7">
        {renderDialogueSceneImage()}
        <section className="rounded-[22px] bg-[var(--surface-soft)] px-5 py-6 sm:px-7 sm:py-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitleWithHint
              title={locale === "ko-KR" ? "대화가 이어지는 순서" : "真实对话如何展开"}
              description={locale === "ko-KR" ? "핵심 어휘가 실제 대화에서 어떤 기능을 하는지 순서대로 확인하세요." : "按照真实交流顺序，理解本章核心词在对话中承担的功能。"}
              headingLevel={4}
              titleClassName="text-lg font-bold text-[var(--foreground)]"
              hintLabel={locale === "ko-KR" ? "대화 순서 설명 보기" : "查看对话路径说明"}
            />
            {coveredWords.length > 0 && <span className="rounded-full bg-[var(--card)] px-3 py-1.5 text-xs font-bold tabular-nums text-[var(--primary)] ring-1 ring-[var(--border-subtle)]">{locale === "ko-KR" ? "핵심 어휘" : "核心词"} {coveredWords.length}</span>}
          </div>
          <div className="relative mt-7">
            <div className="absolute bottom-6 left-[19px] top-6 w-0.5 bg-[var(--primary)]/30" aria-hidden="true" />
            <ol className="space-y-7">
              {effectiveDialogueFlow.map((item, index) => {
                const titleValue = item.title;
                const itemTitle = String(objectValue(titleValue)[locale] ?? titleValue ?? `${locale === "ko-KR" ? "단계" : "步骤"} ${index + 1}`);
                const itemDescription = String(objectValue(item.description)[locale] ?? "");
                const words = stringArray(item.words);
                return (
                  <li key={`${itemTitle}-${index}`} className="relative grid grid-cols-[40px_minmax(0,1fr)] gap-4">
                    <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--primary)] bg-[var(--card)] text-xs font-bold tabular-nums text-[var(--primary)]">{String(index + 1).padStart(2, "0")}</span>
                    <div className="min-w-0 pt-1">
                      <CardTitleWithHint title={itemTitle} description={itemDescription} headingLevel={4} titleClassName="text-base font-bold text-[var(--foreground)]" hintLabel={locale === "ko-KR" ? "이 단계 설명 보기" : "查看此阶段说明"} />
                      {words.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{words.map((word) => <span key={word} lang="ko" className="rounded-lg bg-[var(--card)] px-3 py-1.5 text-sm font-bold text-[var(--foreground-secondary)] ring-1 ring-[var(--border-subtle)]">{word}</span>)}</div>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      </div>
    ) : (
      <div className="mt-8 space-y-6">
        <section className="overflow-hidden rounded-[22px] border border-[var(--border-subtle)] bg-[var(--card)]">
          <div className="flex gap-2 overflow-x-auto border-b border-[var(--border-subtle)] bg-[var(--surface-soft)] p-2" role="tablist" aria-label={locale === "ko-KR" ? "대화 장면 선택" : "选择对话场景"}>
            {dialogueScenes.map((scene, index) => {
              const titleValue = scene.title;
              const title = String(objectValue(titleValue)[locale] ?? titleValue ?? `${locale === "ko-KR" ? "장면" : "场景"} ${index + 1}`);
              return (
                <button
                  key={`${title}-${index}`}
                  type="button"
                  role="tab"
                  aria-selected={index === activeDialogueGroupIndex}
                  onClick={() => {
                    sceneDialogueRunRef.current += 1;
                    window.speechSynthesis?.cancel();
                    setSceneDialoguePlaying(false);
                    setSceneDialogueStep(0);
                    setGuidedDialogueIndex(null);
                    setActiveDialogueGroupIndex(index);
                  }}
                  className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${index === activeDialogueGroupIndex ? "bg-[var(--card)] text-[var(--primary)] shadow-sm ring-1 ring-[var(--border-subtle)]" : "text-[var(--foreground-secondary)] hover:bg-[var(--card)]"}`}
                >
                  {title}
                </button>
              );
            })}
          </div>
          <div className="p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <CardTitleWithHint title={currentSceneTitle} description={currentSceneContext} headingLevel={4} titleClassName="text-lg font-bold text-[var(--foreground)]" hintLabel={locale === "ko-KR" ? "장면 설명 보기" : "查看场景说明"} />
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={() => playGuidedDialogueLine(guidedDialogueIndex === null || guidedDialogueIndex >= sceneDialogueLines.length - 1 ? 0 : guidedDialogueIndex + 1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-subtle)] px-3 text-xs font-bold text-[var(--foreground-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"><Mic size={16} aria-hidden="true" />{guidedDialogueIndex === null ? locale === "ko-KR" ? "한 문장씩" : "逐句跟读" : guidedDialogueIndex >= sceneDialogueLines.length - 1 ? locale === "ko-KR" ? "다시" : "重新跟读" : locale === "ko-KR" ? "다음 문장" : "下一句"}</button>
                <button type="button" onClick={() => playSceneDialogue()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--accent)] px-3 text-xs font-bold text-[var(--primary)] hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"><Volume2 size={17} aria-hidden="true" />{locale === "ko-KR" ? "전체 듣기" : "整段播放"}</button>
                <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-bold tabular-nums text-[var(--foreground-secondary)]">{Math.max(guidedDialogueIndex ?? 0, 0) + 1} / {activeDialogueGroupLines.length}</span>
              </div>
            </div>
            {currentSceneCoverage.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-[var(--foreground-muted)]">{locale === "ko-KR" ? "이 장면의 핵심 어휘" : "本场核心词"}</span>{currentSceneCoverage.map((word) => <span key={word} lang="ko" className="rounded-lg bg-[var(--surface-soft)] px-2.5 py-1 text-xs font-bold text-[var(--foreground-secondary)]">{word}</span>)}</div>}
            <div className="mt-6 space-y-4" aria-live="polite">
              {activeDialogueGroupLines.map((line, index) => {
                const isLeft = index % 2 === 0;
                const activeLine = guidedDialogueIndex === index || (sceneDialoguePlaying && sceneDialogueStep - 1 === index);
                return (
                  <div key={`${String(line.speaker)}-${index}`} className={`flex ${isLeft ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[82%] ${isLeft ? "text-left" : "text-right"}`}>
                      <span className="mb-1.5 block text-xs font-bold text-[var(--foreground-muted)]">{String(line.speaker)}</span>
                      <div className={`rounded-2xl px-4 py-3 shadow-sm ring-1 transition-colors ${activeLine ? "bg-[var(--accent)] ring-[var(--primary)]" : isLeft ? "bg-[var(--surface-soft)] ring-[var(--border-subtle)]" : "bg-[var(--primary)] text-[var(--primary-foreground)] ring-[var(--primary)]"}`}>
                        <CardTitleWithHint
                          title={<button type="button" lang="ko" onClick={() => { setGuidedDialogueIndex(index); speakKorean(String(line.ko)); }} className="rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current">{String(line.ko)}</button>}
                          description={showChinese ? String(line.zh) : undefined}
                          headingLevel={4}
                          tone={!isLeft && !activeLine ? "inverse" : "default"}
                          titleClassName="text-base font-bold leading-7"
                          hintLabel={locale === "ko-KR" ? "문장 뜻 보기" : "查看句意"}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-10">
      {imageAssets.length > 0 && (!isPatternContent || patternPage === 0) && (
        <div className="space-y-4">
          {imageAssets.map((asset) => (
            asset.status === "ready" && asset.url ? (
              <figure
                key={asset.id}
                className="relative aspect-[4/3] overflow-hidden rounded-[22px] bg-[var(--surface-soft)] sm:aspect-[5/2]"
              >
                <Image
                  src={asset.url}
                  alt={asset.altText[locale]}
                  width={Number(asset.metadata.width) || 1600}
                  height={Number(asset.metadata.height) || 900}
                  unoptimized
                  priority={Boolean(moduleHeader)}
                  sizes="(min-width: 1280px) 70vw, (min-width: 1024px) 75vw, 100vw"
                  className="h-full w-full object-cover object-center"
                />
                {moduleHeader && (
                  <div className="absolute right-5 top-4 z-10 max-w-[calc(100%-2.5rem)] text-white [text-shadow:0_1px_3px_rgb(0_0_0_/_0.9)] sm:right-7 sm:top-6">
                    <CardTitleWithHint
                      title={(
                        <>
                          <span>{moduleHeader.title}</span>
                          <span className="text-[11px] font-medium tabular-nums text-white/90">
                            {moduleHeader.stepLabel}
                            <span className="mx-1" aria-hidden="true">·</span>
                            {locale === "ko-KR" ? "예상" : "预计"} {moduleHeader.minutes} {t.minutes}
                          </span>
                        </>
                      )}
                      description={vocabulary.length > 0 && String(lead[locale] ?? "")
                        ? `${moduleHeader.description} ${String(lead[locale])}`
                        : moduleHeader.description}
                      headingLevel={1}
                      tone="inverse"
                      className="items-center"
                      titleClassName="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-lg font-bold"
                      hintLabel={locale === "ko-KR" ? "학습 단계 설명 보기" : "查看学习步骤说明"}
                    />
                  </div>
                )}
                <span className="absolute inset-x-0 bottom-0 z-[5] h-2/5 bg-gradient-to-t from-black/60 via-black/15 to-transparent" aria-hidden="true" />
                {(dialogueScenes.length > 0 || grammarCards.length > 0) && (
                  <button
                    type="button"
                    onClick={() => playSceneDialogue()}
                    aria-label={grammarCards.length > 0
                      ? locale === "ko-KR" ? "문법 예문 연속 재생" : "连续播放语法例句"
                      : locale === "ko-KR" ? "현재 장면 대화 재생" : "播放当前场景对话"}
                    className="absolute left-5 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[var(--primary)] shadow-lg transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:left-7 sm:top-6"
                  >
                    <Volume2 size={18} className={sceneDialoguePlaying ? "animate-pulse motion-reduce:animate-none" : ""} aria-hidden="true" />
                  </button>
                )}
                {grammarCards.length > 0 && activeScenePlaybackLine && (
                  <button
                    type="button"
                    onClick={() => speakKorean(activeScenePlaybackLine)}
                    className="absolute bottom-6 left-6 z-20 max-w-[min(80%,42rem)] animate-in rounded-2xl bg-white/95 px-5 py-3 text-left text-xl font-bold leading-8 text-slate-950 shadow-xl fade-in-0 slide-in-from-bottom-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] motion-reduce:animate-none sm:bottom-8 sm:left-8"
                    aria-live="polite"
                  >
                    <span lang="ko">{activeScenePlaybackLine}</span>
                    <Volume2 size={14} className="ml-3 inline text-[var(--primary)]" aria-hidden="true" />
                  </button>
                )}
                {vocabulary.length === 0 && !activeScenePlaybackLine && (
                  <figcaption className="absolute inset-x-0 bottom-0 z-10 max-w-3xl p-5 text-white [text-shadow:0_1px_3px_rgb(0_0_0_/_0.9)] sm:p-7 lg:p-8">
                    <CardTitleWithHint
                      title={sceneGoal}
                      description={String(lead[locale] ?? "")}
                      headingLevel={4}
                      tone="inverse"
                      titleClassName="text-2xl font-bold leading-tight tracking-tight sm:text-[28px]"
                      hintLabel={locale === "ko-KR" ? "학습 목표 설명 보기" : "查看学习目标说明"}
                    />
                  </figcaption>
                )}
                {vocabulary.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={playVocabularySequence}
                      aria-label={locale === "ko-KR" ? "핵심 어휘와 결합 표현 연속 재생" : "连续播放核心词汇与搭配短句"}
                      title={locale === "ko-KR" ? "핵심 어휘 재생" : "播放核心词汇"}
                      className="absolute left-5 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[var(--status-success)] shadow-lg transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:left-6 sm:top-5"
                    >
                      <Volume2 size={18} className={vocabularyPlaying ? "animate-pulse motion-reduce:animate-none" : ""} aria-hidden="true" />
                    </button>
                    {!activeVocabulary && (
                      <div className="absolute inset-x-0 bottom-0 z-10 max-w-2xl p-5 text-white [text-shadow:0_1px_3px_rgb(0_0_0_/_0.9)] sm:p-7 lg:p-8">
                        <p className="text-2xl font-bold leading-tight tracking-tight sm:text-[28px]">
                          {locale === "ko-KR"
                            ? "이 단어들을 익혀 첫 만남의 자기소개 대화를 완성해 보세요."
                            : "认识这些词，用韩语完成初次见面的自我介绍。"}
                        </p>
                      </div>
                    )}
                    {activeVocabulary && (
                      <div
                        className={`absolute z-10 max-w-[min(72%,22rem)] animate-in rounded-xl border border-white/70 bg-white/92 px-4 py-3 text-slate-950 shadow-lg backdrop-blur-sm duration-300 fade-in-0 motion-reduce:animate-none ${hasActiveVocabularyHotspot ? "-translate-x-1/2 -translate-y-full slide-in-from-bottom-2" : "bottom-4 left-5 slide-in-from-bottom-2 sm:bottom-5 sm:left-6"}`}
                        style={hasActiveVocabularyHotspot ? {
                          left: `${Math.min(Math.max(activeVocabularyHotspotLeft, 16), 84)}%`,
                          top: `${Math.min(Math.max(activeVocabularyHotspotTop, 28), 92)}%`,
                        } : undefined}
                        aria-live="polite"
                      >
                        <p className="text-xl font-bold leading-7" lang="ko">{String(activeVocabulary.ko)}</p>
                        {showChinese && <p className="mt-0.5 text-xs font-semibold text-slate-600">{String(activeVocabulary.zh)}</p>}
                        {String(activeVocabulary.collocation ?? "") && (
                          <p className="mt-1 text-sm font-semibold leading-6 text-slate-800" lang="ko">{String(activeVocabulary.collocation)}</p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </figure>
            ) : (
              <div key={asset.id} className="flex items-start gap-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-5 py-4 text-sm leading-6 text-[var(--foreground-secondary)]">
                <BookOpen size={18} className="mt-0.5 shrink-0 text-[var(--foreground-muted)]" aria-hidden="true" />
                <span>
                  <strong className="text-[var(--foreground)]">{asset.purpose}</strong>
                  {` · ${asset.status === "rejected" ? "需重新制作" : "待制作"}`}
                  {String(asset.altText[locale] ?? "") ? ` · ${asset.altText[locale]}` : ""}
                </span>
              </div>
            )
          ))}
        </div>
      )}
      {vocabulary.length === 0 && !sceneImage && String(lead[locale] ?? "") && (
        <p className="max-w-3xl text-[17px] leading-8 text-slate-600">
          {String(lead[locale])}
        </p>
      )}

      {targets.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-bold tracking-[.18em] text-slate-400">
            {t.phrases.toUpperCase()}
          </p>
          <div className="border-y border-slate-200">
            {targets.map((target, index) => (
              <button
                key={`${String(target.ko)}-${index}`}
                type="button"
                onClick={() => speakKorean(String(target.ko))}
                className="grid w-full grid-cols-[36px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 border-b border-slate-100 px-1 py-4 text-left last:border-b-0 hover:bg-slate-50 sm:grid-cols-[44px_minmax(0,1fr)_minmax(0,.8fr)] sm:gap-4"
                title={t.playWord}
              >
                <span className="text-xs font-bold text-slate-300">0{index + 1}</span>
                <span className="text-lg font-semibold text-slate-900">{String(target.ko)}</span>
                {showChinese && <span className="col-start-2 text-sm text-slate-500 sm:col-start-auto">{String(target.zh)}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {vocabulary.length > 0 && (
        <div className="overflow-x-auto border-y border-slate-200">
          <div className="min-w-[620px]">
          <div className="grid grid-cols-[1.05fr_.8fr_.8fr_.55fr_1.4fr] gap-3 bg-slate-50/80 px-4 py-3 text-xs font-bold tracking-wide text-slate-500">
            <span>{t.word}</span>
            <span>{t.pronunciation}</span>
            <span>{t.meaning}</span>
            <span>{t.pos}</span>
            <span>{t.collocation}</span>
          </div>
          {vocabulary.map((word, index) => (
            <div
              key={`${String(word.ko)}-${index}`}
              className="grid grid-cols-[1.05fr_.8fr_.8fr_.55fr_1.4fr] items-center gap-3 border-t border-slate-100 px-4 py-4 text-sm"
            >
              <button
                type="button"
                onClick={() => speakKorean(String(word.ko))}
                className="group flex items-center gap-3 text-left text-[17px] font-semibold text-slate-900"
              >
                <Volume2 size={15} className="text-[var(--status-success)] transition group-hover:scale-110" />
                {String(word.ko)}
              </button>
              <span className="font-medium text-[var(--status-success)]">
                [{String(word.transcription || word.ko)}]
              </span>
              <span className={showChinese ? "text-slate-600" : "text-slate-300"}>
                {showChinese ? String(word.zh) : "—"}
              </span>
              <span className="text-slate-500">{String(word.pos)}</span>
              <span className="font-medium text-slate-700">{String(word.collocation)}</span>
            </div>
          ))}
          </div>
        </div>
      )}

      {rules.length > 0 && (
        <div className="overflow-x-auto border-y border-slate-200">
          <div className="min-w-[600px]">
          <div className="grid grid-cols-[1fr_1.3fr_1.3fr] bg-slate-50/80 px-4 py-3 text-xs font-bold text-slate-500">
            <span>{t.form}</span>
            <span>{t.exampleLabel}</span>
            <span>{showChinese ? t.meaning : "설명"}</span>
          </div>
          {rules.map((rule, index) => (
            <div key={index} className="grid grid-cols-[1fr_1.3fr_1.3fr] gap-4 border-t border-slate-100 px-4 py-5">
              <span className="font-bold text-[var(--primary)]">{String(rule.form)}</span>
              <span className="font-semibold text-slate-900">{String(rule.example)}</span>
              <span className="text-sm leading-6 text-slate-500">{showChinese ? String(rule.zh) : "받침 유무를 확인하세요."}</span>
            </div>
          ))}
          </div>
        </div>
      )}

      {grammarCards.length > 0 && (() => {
        const cardIndex = Math.min(activeGrammarCardIndex, grammarCards.length - 1);
        const card = grammarCards[cardIndex];
        const examples = Array.isArray(card.examples) ? card.examples.map(objectValue) : [];
        const caution = String(objectValue(card.caution)[locale] ?? "");
        const source = String(objectValue(card.source)[locale] ?? "");
        return (
          <section className="overflow-hidden rounded-[22px] border border-[var(--border-subtle)] bg-[var(--card)]">
            <div className="flex gap-2 overflow-x-auto border-b border-[var(--border-subtle)] bg-[var(--surface-soft)] p-2" role="tablist" aria-label={locale === "ko-KR" ? "문법 항목 선택" : "选择语法点"}>
              {grammarCards.map((item, index) => (
                <button
                  key={`${String(item.form)}-${index}`}
                  type="button"
                  role="tab"
                  aria-selected={index === cardIndex}
                  onClick={() => setActiveGrammarCardIndex(index)}
                  className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${index === cardIndex ? "bg-[var(--card)] text-[var(--primary)] shadow-sm ring-1 ring-[var(--border-subtle)]" : "text-[var(--foreground-secondary)] hover:bg-[var(--card)]"}`}
                >
                  {String(item.form)}
                </button>
              ))}
            </div>
            <div className="grid gap-7 p-5 sm:p-7 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
              <div>
                <CardTitleWithHint
                  title={String(card.form)}
                  description={String(objectValue(card.function)[locale] ?? "")}
                  headingLevel={4}
                  titleClassName="text-2xl font-bold text-[var(--foreground)]"
                  hintLabel={locale === "ko-KR" ? "문법 기능 보기" : "查看语法用途"}
                />
                <ul className="mt-5 space-y-3">
                  {stringArray(card.rules).map((rule, index) => (
                    <li key={rule} className="flex gap-3 rounded-xl bg-[var(--surface-soft)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--foreground)]">
                      <span className="text-[var(--primary)]">{String(index + 1).padStart(2, "0")}</span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
                {(caution || source) && (
                  <div className="mt-5">
                    <CardTitleWithHint
                      title={locale === "ko-KR" ? "주의와 출처" : "易错点与来源"}
                      description={<span className="space-y-2">{caution && <span className="block">{caution}</span>}{source && <span className="block text-xs opacity-80">{source}</span>}</span>}
                      headingLevel={4}
                      titleClassName="text-sm font-bold text-[var(--foreground-secondary)]"
                      hintLabel={locale === "ko-KR" ? "주의와 출처 보기" : "查看易错点与来源"}
                    />
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--foreground-secondary)]">{locale === "ko-KR" ? "예문을 눌러 들어 보세요" : "点击例句进行点读"}</p>
                <div className="mt-3 space-y-3">
                  {examples.map((example, index) => (
                    <button key={String(example.ko)} type="button" onClick={() => speakKorean(String(example.ko))} className="group flex w-full items-start justify-between gap-4 rounded-2xl border border-[var(--border-subtle)] px-5 py-4 text-left transition hover:border-[var(--primary)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                      <span>
                        <span className="block text-lg font-bold leading-7 text-[var(--foreground)]" lang="ko">{String(example.ko)}</span>
                        {showChinese && <span className="mt-1 block text-sm leading-6 text-[var(--foreground-secondary)]">{String(example.zh)}</span>}
                      </span>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--primary)]"><Volume2 size={15} aria-hidden="true" /></span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {contrast.length > 0 && (
        <div className="flex flex-wrap gap-x-8 gap-y-3 border-y border-slate-200 py-5">
          {contrast.map((item) => (
            <button key={item} type="button" onClick={() => speakKorean(item)} className="inline-flex items-center gap-2 font-semibold text-slate-800 hover:text-[var(--primary)]">
              <Volume2 size={14} /> {item}
            </button>
          ))}
        </div>
      )}

      {isPatternContent && patternPage === 0 && (
        <section>
          <div className="px-1 py-3 sm:px-3 sm:py-5">
            <div className="relative mx-auto max-w-5xl">
              <div className="absolute bottom-6 left-[23px] top-6 w-0.5 bg-[var(--primary)]/35" aria-hidden="true" />
            {patternCards.map((card, index) => {
              const examples = stringArray(card.examples);
              const isActive = index === Math.min(activePatternCardIndex, Math.max(patternCards.length - 1, 0));
              const hasVisited = visitedPatternCardIndices.has(index);
              const selectPatternCard = () => {
                setActivePatternCardIndex(index);
                setVisitedPatternCardIndices((current) => {
                  const next = new Set(current);
                  for (let visitedIndex = 0; visitedIndex <= index; visitedIndex += 1) {
                    next.add(visitedIndex);
                  }
                  return next;
                });
              };
              return (
                <article key={`${String(card.form)}-${index}`} className="relative grid grid-cols-[48px_minmax(0,1fr)] gap-5 pb-8 last:pb-0 sm:gap-6 sm:pb-10">
                  <div className="relative z-10 flex h-12 w-12 items-center justify-center">
                    <span className={`flex h-12 w-12 items-center justify-center rounded-full border-2 bg-[var(--card)] text-xs font-bold tabular-nums transition-colors motion-reduce:transition-none ${isActive ? "border-[var(--primary)] text-[var(--primary)] ring-4 ring-[var(--accent)]" : "border-[var(--border-strong)] text-[var(--foreground-muted)]"}`}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex min-h-12 w-full items-start gap-3 py-1">
                      <span className="flex min-w-0 flex-1 items-start gap-2">
                      <CardTitleWithHint
                        title={(
                          <button
                            type="button"
                            lang="ko"
                            aria-expanded={isActive}
                            onClick={selectPatternCard}
                            className="rounded-md text-left hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                          >
                            {String(card.form)}
                          </button>
                        )}
                        description={String(objectValue(card.function)[locale] ?? "")}
                        headingLevel={4}
                        className="items-start"
                        titleClassName="text-lg font-bold leading-7 text-[var(--foreground)] sm:text-xl sm:leading-8"
                        hintClassName="mt-0.5 shrink-0"
                        hintLabel={locale === "ko-KR" ? "문형 기능 보기" : "查看句型用途"}
                      />
                      {hasVisited && <CheckCircle2 size={16} className="mt-1.5 shrink-0 text-[var(--status-success)]" aria-label={locale === "ko-KR" ? "확인함" : "已查看"} />}
                      </span>
                      <button
                        type="button"
                        aria-expanded={isActive}
                        aria-label={locale === "ko-KR" ? `${index + 1}번 문형 ${isActive ? "현재 열림" : "펼치기"}` : `${isActive ? "当前已展开" : "展开"}第 ${index + 1} 个句型`}
                        onClick={selectPatternCard}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                      >
                        <ChevronRight size={17} aria-hidden="true" className={`transition-transform motion-reduce:transition-none ${isActive ? "rotate-90 text-[var(--primary)]" : ""}`} />
                      </button>
                    </div>
                    {isActive && (
                      <div className="mt-3 divide-y divide-[var(--border-subtle)] rounded-2xl bg-[var(--surface-soft)] px-5 py-2 shadow-sm ring-1 ring-[var(--border-subtle)]">
                        {examples.slice(0, 2).map((example) => <button key={example} type="button" onClick={() => speakKorean(example)} className="flex min-h-14 w-full items-center justify-between gap-3 py-3 text-left text-sm font-bold text-[var(--foreground)] transition-colors hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"><span lang="ko">{example}</span><Volume2 size={15} className="shrink-0 text-[var(--primary)]" aria-hidden="true" /></button>)}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
            </div>
          </div>
        </section>
      )}

      {isPatternContent && patternPage === 1 && patternChoiceActivity && patternConversationSteps.length > 0 && <PatternConversationPractice activity={patternChoiceActivity} audioAssets={node.media.filter((asset) => asset.type === "audio" && asset.purpose === "guided-conversation-line")} locale={locale} trackingDisabled={trackingDisabled} onActivityCompleted={onActivityCompleted} />}

      {isPatternContent && patternPage === 1 && patternConversationSteps.length === 0 && (() => {
        const groupIndex = Math.min(activePatternGroupIndex, Math.max(patternChoiceGroups.length - 1, 0));
        const group = patternChoiceGroups[groupIndex] ?? {};
        const items = Array.isArray(group.items) ? group.items.map(objectValue) : [];
        const offset = patternChoiceGroups.slice(0, groupIndex).reduce((total, current) => total + (Array.isArray(current.items) ? current.items.length : 0), 0);
        const groupCheck = patternChoiceChecks[groupIndex];
        const groupCompleted = Boolean(groupCheck?.every(Boolean));
        const itemIndex = Math.min(activePatternQuestionIndex, Math.max(items.length - 1, 0));
        const item = items[itemIndex] ?? {};
        const answerIndex = offset + itemIndex;
        const selected = patternChoiceAnswers[answerIndex] ?? -1;
        const options = stringArray(item.options);
        const scene = objectValue(item.scene);
        const left = objectValue(scene.left);
        const right = objectValue(scene.right);
        const answerSide = scene.answerSide === "left" ? "left" : "right";
        const localizedQuestion = objectValue(item.question);
        const question = String(localizedQuestion[locale] ?? item.question ?? "");
        const selectedAnswer = selected >= 0 ? options[selected] : "";
        const checked = groupCheck?.[itemIndex];
        const answerBubbleClass = groupCheck
          ? checked ? "border-[var(--status-success)] bg-[var(--status-success-surface)] text-[var(--status-success)]" : "border-[var(--destructive)] bg-[var(--destructive)]/10 text-[var(--destructive)]"
          : selected >= 0 ? "border-[var(--primary)] bg-[var(--accent)] text-[var(--foreground)]" : "border-dashed border-[var(--border-strong)] bg-[var(--card)] text-[var(--foreground-muted)]";
        const renderParticipant = (participant: Record<string, unknown>, fallback: string) => String(objectValue(participant.name)[locale] ?? participant.name ?? fallback);
        const renderParticipantMeta = (participant: Record<string, unknown>) => String(objectValue(participant.meta)[locale] ?? participant.meta ?? "");
        const renderParticipantLine = (participant: Record<string, unknown>) => String(objectValue(participant.line)[locale] ?? participant.line ?? "");
        return (
          <section className="overflow-hidden rounded-[22px] border border-[var(--border-subtle)] bg-[var(--card)]">
            <div className="flex gap-2 overflow-x-auto border-b border-[var(--border-subtle)] bg-[var(--surface-soft)] p-2" role="tablist" aria-label={locale === "ko-KR" ? "대치 연습 선택" : "选择替换训练"}>
              {patternChoiceGroups.map((item, index) => {
                const completed = patternChoiceActivity?.completed || Boolean(patternChoiceChecks[index]?.every(Boolean));
                return <button key={index} type="button" role="tab" aria-selected={index === groupIndex} onClick={() => { setActivePatternGroupIndex(index); setActivePatternQuestionIndex(0); }} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-bold ${index === groupIndex ? "bg-[var(--card)] text-[var(--primary)] shadow-sm ring-1 ring-[var(--border-subtle)]" : "text-[var(--foreground-secondary)] hover:bg-[var(--card)]"}`}>{String(objectValue(item.title)[locale] ?? `训练 ${index + 1}`)}{completed && <CheckCircle2 size={14} className="text-[var(--status-success)]" aria-label={locale === "ko-KR" ? "완료" : "已完成"} />}</button>;
              })}
            </div>
            <div className="p-5 sm:p-7">
              <div className="flex items-center justify-between gap-4">
                <CardTitleWithHint title={String(objectValue(group.title)[locale] ?? "替换操练")} description={String(objectValue(group.instruction)[locale] ?? "每题选择一个合适的形式。")} headingLevel={4} titleClassName="text-lg font-bold text-[var(--foreground)]" hintLabel={locale === "ko-KR" ? "연습 방법 보기" : "查看练习方法"} />
                {groupIndex < patternChoiceGroups.length - 1 && (groupCompleted || patternChoiceActivity?.completed) && <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--status-success-surface)] px-3 py-1.5 text-xs font-bold text-[var(--status-success)]"><CheckCircle2 size={14} aria-hidden="true" />{locale === "ko-KR" ? "완료" : "已完成"}</span>}
                {(allPatternChoiceGroupsCompleted || patternChoiceActivity?.completed) && groupIndex === patternChoiceGroups.length - 1 && <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--status-success-surface)] px-3 py-1.5 text-xs font-bold text-[var(--status-success)]"><CheckCircle2 size={14} aria-hidden="true" />{locale === "ko-KR" ? "전체 완료" : "全部完成"}</span>}
              </div>
              <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
              <div className="rounded-[22px] bg-[var(--surface-soft)] p-4 sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold text-[var(--foreground-secondary)]">{question}</p>
                  <span className="shrink-0 text-xs font-bold tabular-nums text-[var(--foreground-muted)]">{itemIndex + 1} / {items.length}</span>
                </div>
                <div className="mx-auto mt-6 max-w-4xl space-y-5" aria-live="polite">
                  <div className="flex items-end gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--card)] text-sm font-bold text-[var(--primary)] shadow-sm">{renderParticipant(left, locale === "ko-KR" ? "상대" : "对方").slice(0, 1)}</div>
                    <div className="max-w-[72%]">
                      <div className="mb-1 flex items-center gap-2 text-xs font-bold text-[var(--foreground-secondary)]"><span>{renderParticipant(left, locale === "ko-KR" ? "상대" : "对方")}</span>{renderParticipantMeta(left) && <span className="font-medium text-[var(--foreground-muted)]">{renderParticipantMeta(left)}</span>}</div>
                      <div className={`rounded-[20px_20px_20px_6px] border px-5 py-3.5 text-base font-bold leading-7 shadow-sm ${answerSide === "left" ? answerBubbleClass : "border-[var(--border-subtle)] bg-[var(--card)] text-[var(--foreground)]"}`} lang="ko">{answerSide === "left" ? selectedAnswer || (locale === "ko-KR" ? "아래에서 질문을 고르세요" : "从下方选择一句话") : renderParticipantLine(left)}{answerSide === "left" && groupCheck && (checked ? <CheckCircle2 size={16} className="ml-2 inline" aria-label={locale === "ko-KR" ? "정답" : "正确"} /> : <XCircle size={16} className="ml-2 inline" aria-label={locale === "ko-KR" ? "오답" : "错误"} />)}</div>
                    </div>
                  </div>
                  <div className="flex items-end justify-end gap-3">
                    <div className="max-w-[72%] text-right">
                      <div className="mb-1 flex items-center justify-end gap-2 text-xs font-bold text-[var(--foreground-secondary)]">{renderParticipantMeta(right) && <span className="font-medium text-[var(--foreground-muted)]">{renderParticipantMeta(right)}</span>}<span>{renderParticipant(right, locale === "ko-KR" ? "나" : "我")}</span></div>
                      <div className={`rounded-[20px_20px_6px_20px] border px-5 py-3.5 text-left text-base font-bold leading-7 shadow-sm ${answerSide === "right" ? answerBubbleClass : "border-[var(--border-subtle)] bg-[var(--card)] text-[var(--foreground)]"}`} lang="ko">{answerSide === "right" ? selectedAnswer || (locale === "ko-KR" ? "아래에서 대답을 고르세요" : "从下方选择一句话") : renderParticipantLine(right)}{answerSide === "right" && groupCheck && (checked ? <CheckCircle2 size={16} className="ml-2 inline" aria-label={locale === "ko-KR" ? "정답" : "正确"} /> : <XCircle size={16} className="ml-2 inline" aria-label={locale === "ko-KR" ? "오답" : "错误"} />)}</div>
                    </div>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-bold text-[var(--primary-foreground)] shadow-sm">{renderParticipant(right, locale === "ko-KR" ? "나" : "我").slice(0, 1)}</div>
                  </div>
                </div>
              </div>
              <fieldset className="rounded-[22px] border border-[var(--border-subtle)] bg-[var(--card)] p-5"><legend className="px-1 text-sm font-bold text-[var(--foreground)]">{locale === "ko-KR" ? "말풍선에 넣을 문장을 고르세요" : "选择一句放入对话气泡"}</legend><div className="mt-2 grid gap-3">{options.map((option, optionIndex) => {
                const isSelected = selected === optionIndex;
                return <button key={option} type="button" aria-pressed={isSelected} onClick={() => { const next = [...patternChoiceAnswers]; next[answerIndex] = optionIndex; setPatternChoiceAnswers(next); setPatternChoiceChecks((current) => { const updated = { ...current }; delete updated[groupIndex]; return updated; }); }} className={`min-h-14 rounded-xl border px-4 py-3 text-left text-sm font-bold leading-6 transition ${isSelected ? "border-[var(--primary)] bg-[var(--accent)] text-[var(--primary)]" : "border-[var(--border-subtle)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--primary)]"}`}><span lang="ko">{option}</span></button>;
              })}</div></fieldset>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-5">
                <div className="flex items-center gap-2"><button type="button" aria-label={locale === "ko-KR" ? "이전 문제" : "上一题"} onClick={() => setActivePatternQuestionIndex((current) => Math.max(0, current - 1))} disabled={itemIndex === 0} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] disabled:opacity-35"><ChevronLeft size={18} /></button><div className="flex gap-1.5" aria-label={locale === "ko-KR" ? "문제 진행" : "答题进度"}>{items.map((_, index) => { const answered = (patternChoiceAnswers[offset + index] ?? -1) >= 0; const result = groupCheck?.[index]; return <span key={index} className={`h-2.5 w-2.5 rounded-full ${result === true ? "bg-[var(--status-success)]" : result === false ? "bg-[var(--destructive)]" : answered ? "bg-[var(--primary)]" : "bg-[var(--border-strong)]"}`} />; })}</div><button type="button" aria-label={locale === "ko-KR" ? "다음 문제" : "下一题"} onClick={() => setActivePatternQuestionIndex((current) => Math.min(items.length - 1, current + 1))} disabled={itemIndex === items.length - 1} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] disabled:opacity-35"><ChevronRight size={18} /></button></div>
                <button type="button" onClick={() => checkPatternChoiceGroup(groupIndex)} disabled={checkingPatternChoices || items.some((_, index) => (patternChoiceAnswers[offset + index] ?? -1) < 0)} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-5 text-sm font-bold text-[var(--primary-foreground)] disabled:cursor-not-allowed disabled:opacity-40">{checkingPatternChoices ? locale === "ko-KR" ? "확인 중…" : "检查中…" : locale === "ko-KR" ? "정답 확인" : "检查答案"}</button>
              </div>
            </div>
          </section>
        );
      })()}

      {isPatternContent && patternPage === 1 && !patternChoiceActivity && (
        <section className="overflow-hidden rounded-[22px] border border-[var(--border-subtle)] bg-[var(--card)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-soft)] px-5 py-4">
            <CardTitleWithHint title={locale === "ko-KR" ? "표현을 바꾸어 말해 보세요" : "按语境替换表达"} description={locale === "ko-KR" ? "각 묶음에서 한 문장을 골라 소리 내어 읽으세요. 이 연습은 필수 점수에 포함되지 않습니다." : "从每组选择一句进行点读和替换；本页是正式排序任务前的学习支架，不单独计分。"} headingLevel={4} titleClassName="text-lg font-bold text-[var(--foreground)]" hintLabel={locale === "ko-KR" ? "대치 연습 설명 보기" : "查看替换练习说明"} />
            <span className="text-xs font-bold tabular-nums text-[var(--foreground-muted)]">{Math.min(activePatternGroupIndex + 1, Math.max(substitutionGroups.length, 1))} / {Math.max(substitutionGroups.length, 1)}</span>
          </div>
          {substitutionGroups.length > 0 ? (
            <div className="p-5 sm:p-7">
              <div className="flex flex-wrap gap-2" role="tablist" aria-label={locale === "ko-KR" ? "표현 묶음" : "表达分组"}>{substitutionGroups.map((_, index) => <button key={index} type="button" role="tab" aria-selected={activePatternGroupIndex === index} onClick={() => setActivePatternGroupIndex(index)} className={`min-h-11 rounded-xl px-4 text-sm font-bold ${activePatternGroupIndex === index ? "bg-[var(--accent)] text-[var(--primary)] shadow-sm" : "bg-[var(--surface-soft)] text-[var(--foreground-secondary)]"}`}>{locale === "ko-KR" ? `${index + 1}단계` : `第 ${index + 1} 组`}</button>)}</div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{(substitutionGroups[activePatternGroupIndex] ?? []).map((item, index) => <button key={`${index}-${item}`} type="button" onClick={() => speakKorean(item)} className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)] px-4 py-3 text-left font-bold leading-7 text-[var(--foreground)] transition hover:border-[var(--primary)] hover:bg-[var(--accent)]"><span lang="ko">{item}</span><Volume2 size={15} className="shrink-0 text-[var(--primary)]" aria-hidden="true" /></button>)}</div>
            </div>
          ) : (
            <p className="p-8 text-center text-sm font-semibold text-[var(--foreground-muted)]">{locale === "ko-KR" ? "이번 단원은 다음 페이지의 순서 활동으로 표현을 연습합니다." : "本章通过下一页的排序任务练习表达组织。"}</p>
          )}
        </section>
      )}

      {isPatternContent && patternPage === 2 && patternOrderActivity && patternComposeActivity ? (
        <section className="rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[var(--card)] p-2">
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label={locale === "ko-KR" ? "조합 출력 과제" : "组合输出任务"}>
              {[
                { key: "pattern-order", label: locale === "ko-KR" ? "자기소개 순서" : "自我介绍顺序", icon: BookOpen },
                { key: "pattern-compose", label: locale === "ko-KR" ? "쌍방향 대화" : "双向对话组合", icon: MessageCircle },
              ].map((task, index) => { const active = patternOutputTask === index; const completed = completedPatternOutputTasks.has(task.key); const Icon = task.icon; return <button key={task.key} type="button" role="tab" aria-selected={active} aria-controls={`pattern-output-panel-${index + 1}`} onClick={() => setPatternOutputTask(index as 0 | 1)} className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${active ? "bg-[var(--accent)] text-[var(--primary)] shadow-sm" : "text-[var(--foreground-secondary)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"}`}><Icon size={16} aria-hidden="true" /><span>{task.label}</span>{completed && <CheckCircle2 size={15} className="text-[var(--status-success)]" aria-label={locale === "ko-KR" ? "완료" : "已完成"} />}</button>; })}
            </div>
            <span className="pr-3 text-xs font-bold tabular-nums text-[var(--foreground-muted)]" aria-live="polite">{locale === "ko-KR" ? "과제" : "任务"} {patternOutputTask + 1} / 2</span>
          </div>
          <div id="pattern-output-panel-1" role="tabpanel" aria-label={locale === "ko-KR" ? "자기소개 순서" : "自我介绍顺序"} hidden={patternOutputTask !== 0}>
            <Activity activity={patternOrderActivity} locale={locale} trackingDisabled={trackingDisabled} onCompleted={(result) => completePatternOutputTask("pattern-order", result)} />
          </div>
          <div id="pattern-output-panel-2" role="tabpanel" aria-label={locale === "ko-KR" ? "쌍방향 대화" : "双向对话组合"} hidden={patternOutputTask !== 1}>
            <PatternCompositionPractice activity={patternComposeActivity} locale={locale} trackingDisabled={trackingDisabled} onActivityCompleted={(result) => completePatternOutputTask("pattern-compose", result)} />
          </div>
        </section>
      ) : isPatternContent && patternPage === 2 && patternOrderActivity ? (
        <section className="space-y-5">
          <div className="rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4 sm:p-5">
            <Activity activity={patternOrderActivity} locale={locale} trackingDisabled={trackingDisabled} onCompleted={(result) => completePatternOutputTask(patternOrderActivity.key, result)} />
          </div>
          {(quickResponse.length > 0 || personalOutput.length > 0) && <div className="grid gap-5 lg:grid-cols-2">
            {quickResponse.length > 0 && <div className="rounded-[22px] border border-[var(--border-subtle)] bg-[var(--card)] p-5 sm:p-6"><CardTitleWithHint title={locale === "ko-KR" ? "빠르게 대답하기" : "快速回应"} description={locale === "ko-KR" ? "정렬한 흐름을 실제 응답으로 연결하세요." : "把排好的表达顺序连接到实际回应中。"} headingLevel={4} titleClassName="text-lg font-bold" hintLabel={locale === "ko-KR" ? "연습 설명 보기" : "查看练习说明"} /><div className="mt-4 space-y-3">{quickResponse.map((item, index) => <button key={`${index}-${item}`} type="button" onClick={() => speakKorean(item)} className="flex min-h-14 w-full items-center gap-3 rounded-xl bg-[var(--surface-soft)] px-4 text-left text-sm font-bold text-[var(--foreground)]"><span className="text-[var(--primary)]">{String(index + 1).padStart(2, "0")}</span><span>{item}</span></button>)}</div></div>}
            {personalOutput.length > 0 && <div className="rounded-[22px] border border-[var(--border-subtle)] bg-[var(--card)] p-5 sm:p-6"><CardTitleWithHint title={locale === "ko-KR" ? "나의 표현 준비" : "准备个人表达"} description={locale === "ko-KR" ? "안전한 가상 정보를 사용해도 됩니다." : "可以使用安全的虚构信息准备下一步表达。"} headingLevel={4} titleClassName="text-lg font-bold" hintLabel={locale === "ko-KR" ? "준비 설명 보기" : "查看准备说明"} /><div className="mt-4 space-y-3">{personalOutput.map((item, index) => <div key={`${index}-${item}`} className="flex min-h-14 items-center gap-3 rounded-xl bg-[var(--surface-soft)] px-4 text-sm font-bold text-[var(--foreground)]"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs text-[var(--primary)]">{index + 1}</span><span>{item}</span></div>)}</div></div>}
          </div>}
        </section>
      ) : isPatternContent && patternPage === 2 && (
        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-[22px] border border-[var(--border-subtle)] bg-[var(--card)] p-5 sm:p-6">
            <CardTitleWithHint title={locale === "ko-KR" ? "빠르게 대답하기" : "快速回应"} description={locale === "ko-KR" ? "긍정하거나 신분을 바로잡는 응답을 듣고 따라 하세요." : "练习肯定身份和礼貌更正身份。"} headingLevel={4} titleClassName="text-lg font-bold text-[var(--foreground)]" hintLabel={locale === "ko-KR" ? "응답 연습 설명 보기" : "查看回应练习说明"} />
            <div className="mt-4 space-y-3">{quickResponse.map((item, index) => <button key={item} type="button" onClick={() => speakKorean(item)} className="flex min-h-16 w-full items-center gap-4 rounded-2xl border border-[var(--border-subtle)] px-4 text-left hover:border-[var(--primary)] hover:bg-[var(--accent)]"><span className="text-xs font-bold text-[var(--primary)]">{String(index + 1).padStart(2, "0")}</span><span className="flex-1 text-lg font-bold text-[var(--foreground)]" lang="ko">{item}</span><Volume2 size={15} className="text-[var(--primary)]" aria-hidden="true" /></button>)}</div>
          </div>
          <div className="rounded-[22px] border border-[var(--border-subtle)] bg-[var(--card)] p-5 sm:p-6">
            <CardTitleWithHint title={locale === "ko-KR" ? "나의 표현 준비" : "准备个人表达"} description={locale === "ko-KR" ? "다음 단계의 실제 대화 전에 세 가지 정보를 준비하세요." : "为下一步实战对话准备三项个人信息；可以使用安全虚构信息。"} headingLevel={4} titleClassName="text-lg font-bold text-[var(--foreground)]" hintLabel={locale === "ko-KR" ? "개인 표현 설명 보기" : "查看个人表达说明"} />
            <div className="mt-4 space-y-3">{personalOutput.map((item, index) => <div key={item} className="flex min-h-16 items-center gap-4 rounded-2xl bg-[var(--surface-soft)] px-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-[var(--primary)]">{index + 1}</span><span className="font-bold text-[var(--foreground)]">{item}</span></div>)}</div>
          </div>
        </section>
      )}

      {dialogue.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-bold tracking-[.18em] text-slate-400">{t.dialogue.toUpperCase()}</p>
          <div className="border-y border-slate-200">
            {dialogue.map((line, index) => (
              <button key={index} type="button" onClick={() => speakKorean(String(line.line))} className="grid w-full grid-cols-[56px_minmax(0,1fr)_20px] items-center gap-2 border-b border-slate-100 px-2 py-4 text-left last:border-b-0 hover:bg-slate-50 sm:grid-cols-[80px_1fr_24px]">
                <span className="text-xs font-bold text-[var(--support)]">{String(line.speaker)}</span>
                <span className="text-[16px] font-medium text-slate-800">{String(line.line)}</span>
                <Volume2 size={14} className="text-slate-300" />
              </button>
            ))}
          </div>
        </div>
      )}

      {dialogueScenes.length > 0 && (
        <div className="space-y-8">
          {dialogueScenes.map((scene, sceneIndex) => {
            const lines = Array.isArray(scene.lines) ? scene.lines.map(objectValue) : [];
            return (
              <section key={`${String(scene.title)}-${sceneIndex}`}>
                <CardTitleWithHint
                  title={String(scene.title)}
                  description={String(objectValue(scene.context)[locale] ?? "")}
                  headingLevel={4}
                  hintLabel={locale === "ko-KR" ? "장면 설명 보기" : "查看场景说明"}
                  titleClassName="text-lg font-bold text-[var(--foreground)]"
                />
                <div className="mt-3 border-y border-[var(--border-subtle)]">
                  {lines.map((line, index) => (
                    <div key={`${String(line.speaker)}-${index}`} className="grid grid-cols-[52px_minmax(0,1fr)] gap-3 border-b border-[var(--border-subtle)] py-4 last:border-b-0 sm:grid-cols-[72px_minmax(0,1fr)_minmax(0,.8fr)]">
                      <span className="text-xs font-bold text-[var(--support)]">{String(line.speaker)}</span>
                      <span className="font-medium leading-7 text-[var(--foreground)]">{String(line.ko)}</span>
                      {showChinese && <span className="col-start-2 text-sm leading-6 text-[var(--foreground-secondary)] sm:col-start-auto">{String(line.zh)}</span>}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs font-semibold text-[var(--foreground-muted)]">整段与逐句音频均待制作</p>
              </section>
            );
          })}
        </div>
      )}

      {String(content.reading ?? "") && (
        <div className="border-y border-slate-200 py-7">
          <p className="mb-4 text-xs font-bold tracking-[.18em] text-slate-400">{t.reading.toUpperCase()}</p>
          <p className="max-w-3xl text-xl font-medium leading-9 text-slate-900">{String(content.reading)}</p>
          {questions.length > 0 && (
            <ol className="mt-6 grid gap-2 text-sm text-slate-600">
              {questions.map((question, index) => <li key={question}>{index + 1}. {question}</li>)}
            </ol>
          )}
        </div>
      )}

      {String(content.speakingFrame ?? "") && (
        <div className="border-y border-slate-200 py-6">
          <p className="text-xs font-bold tracking-[.16em] text-slate-400">口语框架</p>
          <p className="mt-3 text-lg font-semibold leading-8 text-slate-900">{String(content.speakingFrame)}</p>
        </div>
      )}

      {String(content.writingFrame ?? "") && (
        <div className="border-y border-slate-200 py-6">
          <p className="text-xs font-bold tracking-[.16em] text-slate-400">写作框架</p>
          <p className="mt-3 text-lg font-semibold leading-8 text-slate-900">{String(content.writingFrame)}</p>
        </div>
      )}

      {checklist.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-bold tracking-[.18em] text-slate-400">{t.checklist.toUpperCase()}</p>
          <div className="border-y border-slate-200">
            {checklist.map((item, index) => (
              <div key={index} className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-y-1 border-b border-slate-100 py-4 last:border-b-0 sm:grid-cols-[28px_1fr_1fr]">
                <Check size={16} className="text-[var(--status-success)]" />
                <span className="font-semibold text-slate-800">{String(item.ko)}</span>
                {showChinese && <span className="col-start-2 text-sm text-slate-500 sm:col-start-auto">{String(item.zh)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {!isPatternContent && String(coach[locale] ?? "") && (
        <div className="flex gap-3 bg-[var(--background)] px-5 py-4 text-sm leading-6 text-slate-600">
          <Lightbulb size={18} className="mt-0.5 shrink-0 text-[var(--status-warning)]" />
          <span>{String(coach[locale])}</span>
        </div>
      )}
    </div>
  );
}

function RecordingControl({
  activityId,
  locale,
  onReady,
  onReset,
  uploadMetadata,
  minimumDurationSeconds,
  playbackLabel,
  afterPlaybackActions,
}: {
  activityId: string;
  locale: SmartLocale;
  onReady: (value: {
    durationSeconds: number;
    recordingEvidenceId: string;
  }) => void;
  onReset: () => void;
  uploadMetadata?: { practiceKey: "repeat-line" | "full-recall"; trackIndex: number; segmentIndex: number };
  minimumDurationSeconds?: number;
  playbackLabel?: string;
  afterPlaybackActions?: ReactNode;
}) {
  const t = ui[locale];
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const cancelRecordingRef = useRef(false);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingEvidenceId, setRecordingEvidenceId] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState("");
  const [restoringRecording, setRestoringRecording] = useState(Boolean(uploadMetadata));

  const audioUrlRef = useRef(audioUrl);
  const onReadyRef = useRef(onReady);
  useEffect(() => { audioUrlRef.current = audioUrl; }, [audioUrl]);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioUrlRef.current?.startsWith("blob:")) URL.revokeObjectURL(audioUrlRef.current);
  }, []);
  useEffect(() => {
    if (!uploadMetadata) {
      setRestoringRecording(false);
      return;
    }
    let cancelled = false;
    setRestoringRecording(true);
    setRecordingError("");
    if (audioUrlRef.current?.startsWith("blob:")) URL.revokeObjectURL(audioUrlRef.current);
    setAudioUrl(null);
    setRecordingEvidenceId(null);
    const search = new URLSearchParams({
      practiceKey: uploadMetadata.practiceKey,
      trackIndex: String(uploadMetadata.trackIndex),
      segmentIndex: String(uploadMetadata.segmentIndex),
    });
    void fetch(`/api/digital-textbook/recordings/${activityId}?${search.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("recording lookup failed");
        return response.json() as Promise<{ recording?: { evidenceId: string; playbackUrl: string } | null }>;
      })
      .then((result) => {
        if (cancelled || !result.recording) return;
        setAudioUrl(result.recording.playbackUrl);
        setRecordingEvidenceId(result.recording.evidenceId);
        onReadyRef.current({ durationSeconds: 1, recordingEvidenceId: result.recording.evidenceId });
      })
      .catch(() => {
        if (!cancelled) setRecordingError(locale === "ko-KR" ? "저장된 녹음을 불러오지 못했습니다. 다시 시도해 주세요." : "已保存的录音读取失败，请刷新后重试。");
      })
      .finally(() => { if (!cancelled) setRestoringRecording(false); });
    return () => { cancelled = true; };
  }, [activityId, locale, uploadMetadata?.practiceKey, uploadMetadata?.segmentIndex, uploadMetadata?.trackIndex]);

  function stopRecording() {
    cancelRecordingRef.current = false;
    recorderRef.current?.stop();
    setRecording(false);
  }

  function cancelRecording() {
    cancelRecordingRef.current = true;
    recorderRef.current?.stop();
    setRecording(false);
    setRecordingError("");
  }

  async function startRecording() {
    const prerequisiteError = microphonePrerequisiteError(locale);
    if (prerequisiteError) {
      setRecordingError(prerequisiteError);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      chunksRef.current = [];
      cancelRecordingRef.current = false;
      setRecordingError("");
      recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
      recorder.onstop = async () => {
        if (cancelRecordingRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
          chunksRef.current = [];
          cancelRecordingRef.current = false;
          return;
        }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const durationSeconds = Math.max(
          1,
          Math.round((Date.now() - startedAtRef.current) / 1000),
        );
        if (minimumDurationSeconds && durationSeconds < minimumDurationSeconds) {
          chunksRef.current = [];
          setRecordingError(locale === "ko-KR"
            ? `녹음이 ${durationSeconds}초입니다. ${minimumDurationSeconds}초 이상 녹음해 주세요. 짧은 녹음은 저장하지 않았습니다.`
            : `本次录音只有 ${durationSeconds} 秒，请至少录制 ${minimumDurationSeconds} 秒；短录音未保存。`);
          return;
        }
        setUploading(true);
        try {
          const formData = new FormData();
          formData.set("recording", blob, "recording");
          formData.set("durationSeconds", String(durationSeconds));
          if (uploadMetadata) {
            formData.set("practiceKey", uploadMetadata.practiceKey);
            formData.set("trackIndex", String(uploadMetadata.trackIndex));
            formData.set("segmentIndex", String(uploadMetadata.segmentIndex));
          }
          const response = await fetch(
            `/api/digital-textbook/recordings/${activityId}`,
            { method: "POST", body: formData },
          );
          const result = (await response.json()) as {
            evidenceId?: string;
            message?: string;
          };
          if (!response.ok || !result.evidenceId) {
            throw new Error(result.message ?? "recording upload failed");
          }
          const nextAudioUrl = URL.createObjectURL(blob);
          if (audioUrlRef.current?.startsWith("blob:")) URL.revokeObjectURL(audioUrlRef.current);
          setAudioUrl(nextAudioUrl);
          setRecordingEvidenceId(result.evidenceId);
          onReady({
            durationSeconds,
            recordingEvidenceId: result.evidenceId,
          });
        } catch {
          setRecordingError(t.recordingUploadFailed);
        } finally {
          setUploading(false);
        }
      };
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start();
      setRecording(true);
    } catch {
      setRecordingError(t.recordingDenied);
    }
  }

  return (
    <div className="mt-5 border-y border-[var(--border-subtle)] py-5">
      {restoringRecording ? <p role="status" className="text-xs font-semibold text-[var(--foreground-muted)]">{locale === "ko-KR" ? "저장된 녹음을 불러오고 있어요…" : "正在恢复已保存的录音…"}</p> : recording ? <div className="flex flex-wrap items-center gap-2"><div role="status" aria-live="polite" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--status-warning-surface)] px-4 text-sm font-bold text-[var(--status-warning)]"><Mic size={16} className="animate-pulse motion-reduce:animate-none" aria-hidden="true" />{locale === "ko-KR" ? "말하는 중…" : "正在说话…"}</div><button type="button" onClick={cancelRecording} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] px-4 text-sm font-bold text-[var(--foreground-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"><X size={15} aria-hidden="true" />{locale === "ko-KR" ? "취소" : "取消"}</button><button type="button" onClick={stopRecording} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--status-warning)] px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"><Square size={14} aria-hidden="true" />{locale === "ko-KR" ? "녹음 끝내기" : "结束录音"}</button></div> : <button type="button" onClick={startRecording} disabled={uploading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--status-success)] px-5 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-45"><Mic size={16} aria-hidden="true" />{audioUrl ? locale === "ko-KR" ? "다시 녹음" : "重新录制" : t.startRecording}</button>}
      {uploading && <p role="status" className="mt-3 text-xs font-semibold text-[var(--support)]">{t.recordingUploading}</p>}
      {audioUrl && recordingEvidenceId && !uploading && !restoringRecording && <div className={afterPlaybackActions ? "mt-4 grid gap-4 lg:grid-cols-2 lg:items-end" : "mt-4 min-w-0"}><div className="min-w-0">{playbackLabel && <p className="text-xs font-bold text-[var(--foreground-muted)]">{playbackLabel}</p>}<RoleplayRecordingPlayer activityId={activityId} recording={{ audioUrl, evidenceId: recordingEvidenceId, transcript: "" }} locale={locale} onError={setRecordingError} onDeleted={() => { if (audioUrl.startsWith("blob:")) URL.revokeObjectURL(audioUrl); setAudioUrl(null); setRecordingEvidenceId(null); onReset(); }} /></div>{afterPlaybackActions}</div>}
      {recordingError && <p className="w-full text-xs font-semibold text-[var(--destructive)]">{recordingError}</p>}
    </div>
  );
}

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function normalizeSpeechText(value: string) {
  return value.normalize("NFC").replace(/[^\p{Script=Hangul}\p{L}\p{N}]/gu, "");
}

function speechContentMatch(expected: string, actual: string) {
  const target = normalizeSpeechText(expected);
  const response = normalizeSpeechText(actual);
  if (!target || !response) return null;
  const previous = Array.from({ length: response.length + 1 }, (_, index) => index);
  for (let row = 1; row <= target.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= response.length; column += 1) {
      const above = previous[column];
      previous[column] = target[row - 1] === response[column - 1]
        ? diagonal
        : Math.min(diagonal, above, previous[column - 1]) + 1;
      diagonal = above;
    }
  }
  return Math.max(0, Math.round((1 - previous[response.length] / Math.max(target.length, response.length)) * 100));
}

function formatRecordingTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const seconds = Math.floor(value);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function RoleplayRecordingPlayer({ activityId, recording, locale, onDeleted, onError }: {
  activityId: string;
  recording: { audioUrl: string; evidenceId: string; transcript: string };
  locale: SmartLocale;
  onDeleted: () => void;
  onError: (message: string) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [recording.audioUrl]);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      await audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  async function deleteRecording() {
    if (!window.confirm(locale === "ko-KR" ? "이 녹음을 삭제할까요?" : "确定删除本轮录音吗？")) return;
    setDeleting(true);
    const response = await fetch(`/api/digital-textbook/recordings/${activityId}?evidenceId=${encodeURIComponent(recording.evidenceId)}`, { method: "DELETE" });
    setDeleting(false);
    if (!response.ok) {
      onError(locale === "ko-KR" ? "녹음을 삭제하지 못했습니다. 다시 시도하세요." : "录音删除失败，请重试。");
      return;
    }
    onDeleted();
  }

  return (
    <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-3">
      <audio ref={audioRef} src={recording.audioUrl} preload="metadata" onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onDurationChange={(event) => setDuration(event.currentTarget.duration)} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onEnded={() => setPlaying(false)} />
      <div className="flex items-center gap-3">
        <button type="button" onClick={togglePlayback} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--card)] text-[var(--foreground)] ring-1 ring-[var(--border-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" aria-label={playing ? locale === "ko-KR" ? "일시 정지" : "暂停录音" : locale === "ko-KR" ? "녹음 재생" : "播放录音"}>{playing ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}</button>
        <span className="shrink-0 text-xs font-bold tabular-nums text-[var(--foreground-secondary)]">{formatRecordingTime(currentTime)} / {formatRecordingTime(duration)}</span>
        <input type="range" min={0} max={Math.max(duration, 0)} step={0.1} value={Math.min(currentTime, duration || 0)} onChange={(event) => { const audio = audioRef.current; if (!audio) return; audio.currentTime = Number(event.target.value); setCurrentTime(audio.currentTime); }} className="min-w-0 flex-1 accent-[var(--primary)]" aria-label={locale === "ko-KR" ? "녹음 재생 위치" : "录音播放进度"} />
        <a href={recording.audioUrl} download={`dialogue-recording-${recording.evidenceId}.webm`} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-bold text-[var(--foreground-secondary)] hover:bg-[var(--card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"><Download size={16} aria-hidden="true" />{locale === "ko-KR" ? "다운로드" : "下载"}</a>
        <button type="button" disabled={deleting} onClick={deleteRecording} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-bold text-[var(--status-danger)] hover:bg-[var(--status-danger-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-45"><Trash2 size={16} aria-hidden="true" />{deleting ? locale === "ko-KR" ? "삭제 중…" : "删除中…" : locale === "ko-KR" ? "삭제" : "删除"}</button>
      </div>
    </div>
  );
}

function DialogueRoleplayPractice({ activity, scenes, locale, onActivityCompleted }: {
  activity: SmartTextbookActivity;
  scenes: Array<Record<string, unknown>>;
  locale: SmartLocale;
  onActivityCompleted?: (result: { nodeId: string | null; nodeCompleted: boolean; completionPercent: number; preview: boolean }) => void;
}) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [roleSide, setRoleSide] = useState<0 | 1>(0);
  const [learnerTurn, setLearnerTurn] = useState(0);
  const [dialogueStarted, setDialogueStarted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [transcript, setTranscript] = useState("");
  const [recordings, setRecordings] = useState<Record<number, { audioUrl: string; evidenceId: string; transcript: string }>>({});
  const [completionSaved, setCompletionSaved] = useState(activity.completed);
  const [completionPending, startCompletionTransition] = useTransition();
  const [opponentTextReady, setOpponentTextReady] = useState(false);
  const [opponentAudioReady, setOpponentAudioReady] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const transcriptRef = useRef("");
  const cancelRecordingRef = useRef(false);
  const recordingPlaybackRef = useRef<HTMLAudioElement | null>(null);
  const recordingsRef = useRef(recordings);
  const completionSyncKeysRef = useRef(new Set<string>());
  const scene = scenes[Math.min(sceneIndex, scenes.length - 1)] ?? {};
  const lines = Array.isArray(scene.lines) ? scene.lines.map(objectValue) : [];
  const learnerLineIndices = lines.map((_, index) => index).filter((index) => index % 2 === roleSide);
  const currentLineIndex = learnerLineIndices[Math.min(learnerTurn, Math.max(learnerLineIndices.length - 1, 0))] ?? 0;
  const precedingOpponentIndex = currentLineIndex > 0 && (currentLineIndex - 1) % 2 !== roleSide
    ? currentLineIndex - 1
    : null;
  const dialogueTurnReady = dialogueStarted && (precedingOpponentIndex === null || (opponentTextReady && opponentAudioReady));
  const complete = learnerLineIndices.length > 0 && learnerLineIndices.every((index) => recordings[index]);
  const scoredTurns = learnerLineIndices.map((index) => speechContentMatch(String(lines[index]?.ko ?? ""), recordings[index]?.transcript ?? "")).filter((score): score is number => score !== null);
  const contentScore = scoredTurns.length === learnerLineIndices.length && scoredTurns.length > 0
    ? Math.round(scoredTurns.reduce((total, score) => total + score, 0) / scoredTurns.length)
    : null;

  useEffect(() => { recordingsRef.current = recordings; }, [recordings]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    recordingPlaybackRef.current?.pause();
    Object.values(recordingsRef.current).forEach((item) => URL.revokeObjectURL(item.audioUrl));
  }, []);

  useEffect(() => {
    recordingPlaybackRef.current?.pause();
    recordingPlaybackRef.current = null;
    if (!dialogueStarted) {
      setOpponentTextReady(false);
      setOpponentAudioReady(false);
      window.speechSynthesis?.cancel();
      return;
    }
    setOpponentTextReady(precedingOpponentIndex === null);
    setOpponentAudioReady(precedingOpponentIndex === null);

    if (precedingOpponentIndex === null) return;
    const text = String(lines[precedingOpponentIndex]?.ko ?? "").trim();
    if (!text || !("speechSynthesis" in window)) {
      setOpponentAudioReady(true);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = 0.82;
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find((voice) => voice.lang.toLowerCase().startsWith("ko")) ?? null;
    utterance.onend = () => setOpponentAudioReady(true);
    utterance.onerror = () => setOpponentAudioReady(true);
    window.speechSynthesis.speak(utterance);

    return () => {
      utterance.onend = null;
      utterance.onerror = null;
      window.speechSynthesis.cancel();
    };
  }, [currentLineIndex, dialogueStarted, precedingOpponentIndex, roleSide, sceneIndex]);

  useEffect(() => {
    if (completionSaved || !scene.id) return;
    const syncKey = `${activity.id}:${String(scene.id)}:${roleSide}`;
    if (completionSyncKeysRef.current.has(syncKey)) return;
    completionSyncKeysRef.current.add(syncKey);
    let cancelled = false;
    startCompletionTransition(async () => {
      const completion = await completeDialogueRoleplayAction({
        activityId: activity.id,
        sceneId: String(scene.id),
        roleSide: roleSide === 0 ? "left" : "right",
      });
      if (cancelled || !completion.ok || completion.preview) return;
      setCompletionSaved(true);
      onActivityCompleted?.({
        nodeId: completion.nodeId,
        nodeCompleted: completion.nodeCompleted,
        completionPercent: completion.completionPercent,
        preview: completion.preview,
      });
    });
    return () => { cancelled = true; };
  }, [activity.id, completionSaved, roleSide, scene.id]);

  const resetPractice = (nextScene = sceneIndex, nextRole = roleSide) => {
    recordingPlaybackRef.current?.pause();
    recordingPlaybackRef.current = null;
    Object.values(recordings).forEach((item) => URL.revokeObjectURL(item.audioUrl));
    setRecordings({});
    setTranscript("");
    setLearnerTurn(0);
    setDialogueStarted(false);
    setError("");
    setSceneIndex(nextScene);
    setRoleSide(nextRole);
  };

  const playDialogueLine = (lineIndex: number) => {
    window.speechSynthesis?.cancel();
    recordingPlaybackRef.current?.pause();
    recordingPlaybackRef.current = null;
    const learnerRecording = lineIndex % 2 === roleSide ? recordings[lineIndex] : undefined;
    if (!learnerRecording) {
      speakKorean(String(lines[lineIndex]?.ko ?? ""));
      return;
    }
    const audio = new Audio(learnerRecording.audioUrl);
    recordingPlaybackRef.current = audio;
    audio.onended = () => { if (recordingPlaybackRef.current === audio) recordingPlaybackRef.current = null; };
    audio.play().catch(() => setError(locale === "ko-KR" ? "녹음을 재생하지 못했습니다. 다시 시도해 주세요." : "录音播放失败，请重新尝试。"));
  };

  const stopRecording = () => {
    cancelRecordingRef.current = false;
    recognitionRef.current?.stop();
    recorderRef.current?.stop();
    setRecording(false);
  };

  const cancelRecording = () => {
    cancelRecordingRef.current = true;
    recognitionRef.current?.stop();
    recorderRef.current?.stop();
    setRecording(false);
    setTranscript("");
    setError("");
  };

  const startRecording = async () => {
    if (!dialogueStarted) return;
    window.speechSynthesis?.cancel();
    recordingPlaybackRef.current?.pause();
    recordingPlaybackRef.current = null;
    const prerequisiteError = microphonePrerequisiteError(locale);
    if (prerequisiteError) {
      setError(prerequisiteError);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      transcriptRef.current = "";
      cancelRecordingRef.current = false;
      setTranscript("");
      setError("");
      let recognitionStarted = false;
      let settleRecognition: () => void = () => undefined;
      const recognitionSettled = new Promise<void>((resolve) => {
        settleRecognition = resolve;
      });
      recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
      recorder.onstop = async () => {
        if (cancelRecordingRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          chunksRef.current = [];
          cancelRecordingRef.current = false;
          return;
        }
        if (recognitionStarted) {
          await Promise.race([
            recognitionSettled,
            new Promise<void>((resolve) => window.setTimeout(resolve, 2_500)),
          ]);
        }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        stream.getTracks().forEach((track) => track.stop());
        setUploading(true);
        try {
          const formData = new FormData();
          formData.set("recording", blob, "recording");
          formData.set("sceneId", String(scene.id ?? sceneIndex));
          formData.set("roleSide", roleSide === 0 ? "left" : "right");
          formData.set("turnIndex", String(currentLineIndex));
          formData.set("transcript", transcriptRef.current);
          const response = await fetch(`/api/digital-textbook/recordings/${activity.id}`, { method: "POST", body: formData });
          const result = (await response.json()) as { evidenceId?: string; message?: string };
          if (!response.ok || !result.evidenceId) throw new Error(result.message ?? "upload failed");
          const nextRecording = { audioUrl: URL.createObjectURL(blob), evidenceId: result.evidenceId, transcript: transcriptRef.current };
          const previous = recordings[currentLineIndex];
          if (previous) URL.revokeObjectURL(previous.audioUrl);
          const nextRecordings = { ...recordings, [currentLineIndex]: nextRecording };
          setRecordings(nextRecordings);
          if (!completionSaved && learnerLineIndices.every((index) => nextRecordings[index])) {
            startCompletionTransition(async () => {
              const completion = await completeDialogueRoleplayAction({
                activityId: activity.id,
                sceneId: String(scene.id ?? sceneIndex),
                roleSide: roleSide === 0 ? "left" : "right",
              });
              if (!completion.ok) {
                setError(completion.message);
                return;
              }
              setCompletionSaved(true);
              onActivityCompleted?.({
                nodeId: completion.nodeId,
                nodeCompleted: completion.nodeCompleted,
                completionPercent: completion.completionPercent,
                preview: completion.preview,
              });
            });
          }
        } catch {
          setError(locale === "ko-KR" ? "녹음을 저장하지 못했습니다. 다시 시도하세요." : "录音保存失败，请重新录制。");
        } finally {
          setUploading(false);
        }
      };
      const speechWindow = window as unknown as {
        SpeechRecognition?: new () => BrowserSpeechRecognition;
        webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
      };
      const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
      if (Recognition) {
        const recognition = new Recognition();
        recognition.lang = "ko-KR";
        recognition.interimResults = false;
        recognition.continuous = true;
        recognition.onresult = (event) => {
          const values = Array.from(event.results).map((result) => result[0]?.transcript ?? "").join(" ").trim();
          if (values) {
            transcriptRef.current = values;
            setTranscript(values);
          }
        };
        recognition.onerror = () => settleRecognition();
        recognition.onend = () => settleRecognition();
        recognitionRef.current = recognition;
        try {
          recognition.start();
          recognitionStarted = true;
        } catch {
          settleRecognition();
        }
      } else {
        settleRecognition();
      }
      recorder.start();
      setRecording(true);
    } catch {
      setError(locale === "ko-KR" ? "마이크 권한을 확인하세요." : "请检查浏览器的麦克风权限。");
    }
  };

  return (
    <section className="rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <CardTitleWithHint title={activity.prompt[locale]} description={activity.instruction[locale]} headingLevel={4} titleClassName="text-lg font-bold text-[var(--foreground)]" hintLabel={locale === "ko-KR" ? "역할 연습 설명 보기" : "查看角色练习说明"} />
        <span className="rounded-full bg-[var(--card)] px-3 py-1.5 text-xs font-bold tabular-nums text-[var(--foreground-secondary)] ring-1 ring-[var(--border-subtle)]">{Object.keys(recordings).length} / {learnerLineIndices.length}</span>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {scenes.map((item, index) => <button key={String(item.id ?? index)} type="button" onClick={() => resetPractice(index, 0)} className={`min-h-11 rounded-xl px-4 text-sm font-bold ${index === sceneIndex ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "bg-[var(--card)] text-[var(--foreground-secondary)] ring-1 ring-[var(--border-subtle)]"}`}>{String(objectValue(item.title)[locale] ?? `${locale === "ko-KR" ? "장면" : "场景"} ${index + 1}`)}</button>)}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {[0, 1].map((side) => {
          const firstLine = lines.find((_, index) => index % 2 === side);
          return <button key={side} type="button" onClick={() => resetPractice(sceneIndex, side as 0 | 1)} className={`min-h-11 rounded-xl px-4 text-sm font-bold ${roleSide === side ? "bg-[var(--accent)] text-[var(--primary)] ring-1 ring-[var(--primary)]" : "bg-[var(--card)] text-[var(--foreground-secondary)] ring-1 ring-[var(--border-subtle)]"}`}>{locale === "ko-KR" ? "내 역할" : "扮演"}：{String(firstLine?.speaker ?? (side === 0 ? "A" : "B"))}</button>;
        })}
      </div>
      {!complete ? (
        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
          <div className="rounded-[22px] bg-[var(--card)] p-5 ring-1 ring-[var(--border-subtle)]">
            {!dialogueStarted ? <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center"><span className="flex size-12 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--primary)]"><MessageCircle size={21} aria-hidden="true" /></span><p className="mt-4 text-base font-bold text-[var(--foreground)]">{locale === "ko-KR" ? "준비되면 대화를 시작하세요" : "准备好后开始对话"}</p><p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">{locale === "ko-KR" ? "상대방의 대사가 글자와 음성으로 함께 시작됩니다." : "点击后，对方台词将逐字显示并同步朗读。"}</p><button type="button" onClick={() => setDialogueStarted(true)} className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-6 text-sm font-bold text-[var(--primary-foreground)] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"><Play size={16} fill="currentColor" aria-hidden="true" />{locale === "ko-KR" ? "대화 시작" : "开始对话"}</button></div> : <div className="space-y-3">
              {lines.slice(0, currentLineIndex + 1).map((line, index) => {
                if (index === currentLineIndex && !dialogueTurnReady) return null;
                const text = index === currentLineIndex && !recordings[index]
                  ? locale === "ko-KR" ? "내 차례예요" : "轮到你说"
                  : String(line.ko);
                const shouldType = index === precedingOpponentIndex || index === currentLineIndex;
                const hasPlayableLine = index !== currentLineIndex || Boolean(recordings[index]);
                return <div key={`${sceneIndex}-${roleSide}-${currentLineIndex}-${index}`} className={`flex ${index % 2 === 0 ? "justify-start" : "justify-end"}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm font-bold leading-6 ${index === currentLineIndex ? "bg-[var(--accent)] text-[var(--primary)] ring-1 ring-[var(--primary)]" : index % 2 === 0 ? "bg-[var(--surface-soft)] text-[var(--foreground)]" : "bg-[var(--primary)] text-[var(--primary-foreground)]"}`}><span className="mb-1 block text-[10px] opacity-70">{String(line.speaker)}</span><span lang={hasPlayableLine ? "ko" : undefined}>{shouldType ? <TypewriterText text={text} speed={48} onComplete={index === precedingOpponentIndex ? () => setOpponentTextReady(true) : undefined} /> : text}</span>{hasPlayableLine && <button type="button" onClick={() => playDialogueLine(index)} className="ml-1.5 inline-flex size-6 translate-y-0.5 items-center justify-center rounded-md opacity-65 transition hover:bg-black/5 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current" aria-label={index % 2 === roleSide && recordings[index] ? locale === "ko-KR" ? "내 녹음 다시 듣기" : "回听我的录音" : locale === "ko-KR" ? `${String(line.ko ?? "")} 다시 재생` : `重复播放：${String(line.ko ?? "")}`}><Volume2 size={12} aria-hidden="true" /></button>}</div></div>;
              })}
            </div>}
          </div>
          <div className="rounded-[22px] bg-[var(--card)] p-5 ring-1 ring-[var(--border-subtle)]">
            <p className="text-xs font-bold text-[var(--foreground-muted)]">{locale === "ko-KR" ? "목표 문장" : "本轮目标句"}</p>
            <p className="mt-3 text-lg font-bold leading-8 text-[var(--foreground)]" lang="ko"><span>{String(lines[currentLineIndex]?.ko ?? "")}</span><button type="button" onClick={() => playDialogueLine(currentLineIndex)} className="ml-2 inline-flex size-7 translate-y-1 items-center justify-center rounded-md text-[var(--foreground-muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" aria-label={recordings[currentLineIndex] ? locale === "ko-KR" ? "내 녹음 다시 듣기" : "回听我的录音" : locale === "ko-KR" ? "목표 문장 다시 재생" : "重复播放本轮目标句"}><Volume2 size={13} aria-hidden="true" /></button></p>
            <div className="mt-5">
              {recording ? (
                <div className="space-y-3">
                  <div role="status" aria-live="polite" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--status-warning-surface)] px-4 text-sm font-bold text-[var(--status-warning)]">
                    <Mic size={17} className="animate-pulse motion-reduce:animate-none" aria-hidden="true" />
                    {locale === "ko-KR" ? "말하는 중…" : "正在说话…"}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={cancelRecording} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] px-4 text-sm font-bold text-[var(--foreground-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"><X size={16} aria-hidden="true" />{locale === "ko-KR" ? "취소" : "取消"}</button>
                    <button type="button" onClick={stopRecording} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--status-warning)] px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"><Square size={15} aria-hidden="true" />{locale === "ko-KR" ? "녹음 끝내기" : "结束录音"}</button>
                  </div>
                </div>
              ) : (
                <button type="button" disabled={uploading || !dialogueStarted} onClick={startRecording} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--status-success)] text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-45"><Mic size={17} aria-hidden="true" />{!dialogueStarted ? locale === "ko-KR" ? "먼저 대화를 시작하세요" : "请先开始对话" : recordings[currentLineIndex] ? locale === "ko-KR" ? "다시 녹음" : "重新录制" : locale === "ko-KR" ? "말하기 시작" : "开始说话"}</button>
              )}
            </div>
            {uploading && <p role="status" className="mt-3 text-xs font-semibold text-[var(--support)]">{locale === "ko-KR" ? "녹음을 저장하고 있어요…" : "正在保存录音…"}</p>}
            {recordings[currentLineIndex] && !uploading && <><RoleplayRecordingPlayer activityId={activity.id} recording={recordings[currentLineIndex]} locale={locale} onError={setError} onDeleted={() => { const removed = recordings[currentLineIndex]; URL.revokeObjectURL(removed.audioUrl); setRecordings((current) => { const next = { ...current }; delete next[currentLineIndex]; return next; }); }} />{recordings[currentLineIndex].transcript && <p className="mt-3 rounded-xl bg-[var(--surface-soft)] p-3 text-sm font-semibold text-[var(--foreground-secondary)]">{locale === "ko-KR" ? "인식 결과" : "识别结果"}：<span lang="ko">{recordings[currentLineIndex].transcript}</span></p>}<button type="button" onClick={() => setLearnerTurn((current) => Math.min(learnerLineIndices.length - 1, current + 1))} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-[var(--primary-foreground)]">{learnerTurn === learnerLineIndices.length - 1 ? locale === "ko-KR" ? "결과 보기" : "查看结果" : locale === "ko-KR" ? "다음 차례" : "下一话轮"}</button></>}
            {error && <p role="alert" className="mt-3 text-xs font-semibold text-[var(--destructive)]">{error}</p>}
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-[22px] bg-[var(--card)] p-6 text-center ring-1 ring-[var(--border-subtle)] sm:p-8">
          <CheckCircle2 size={34} className="mx-auto text-[var(--status-success)]" />
          <p className="mt-3 text-xl font-bold text-[var(--foreground)]">{locale === "ko-KR" ? "역할 대화를 완성했어요" : "角色对话已完成"}</p>
          <p role="status" className="mt-2 text-sm font-semibold text-[var(--foreground-secondary)]">{completionPending ? locale === "ko-KR" ? "완료 상태를 저장하고 있어요…" : "正在保存完成状态…" : completionSaved ? locale === "ko-KR" ? "필수 녹음이 모두 저장되었습니다." : "必需录音已全部保存。" : locale === "ko-KR" ? "완료 상태를 다시 저장해 주세요." : "完成状态尚未保存，请重试。"}</p>
          {contentScore === null ? <p className="mt-3 text-sm text-[var(--foreground-secondary)]">{locale === "ko-KR" ? "현재 브라우저에서 한국어 인식 결과를 받지 못해 내용 점수를 만들지 않았습니다. 녹음은 정상적으로 저장되었습니다." : "当前浏览器未返回韩语识别结果，因此不生成内容分；录音已经正常保存。"}</p> : <><p className="mt-5 text-4xl font-bold tabular-nums text-[var(--primary)]">{contentScore}</p><p className="mt-2 text-sm font-bold text-[var(--foreground-secondary)]">{locale === "ko-KR" ? "대화 내용 일치도 · 발음 점수 아님" : "对话内容匹配度 · 不代表发音分数"}</p></>}
          <button type="button" onClick={() => resetPractice()} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-subtle)] px-4 text-sm font-bold text-[var(--foreground)]"><RotateCcw size={16} />{locale === "ko-KR" ? "다시 연습" : "重新练习"}</button>
        </div>
      )}
    </section>
  );
}

function ReadWriteLearningPanel({
  node,
  locale,
  page,
}: {
  node: SmartTextbookNode;
  locale: SmartLocale;
  page: number;
}) {
  const [activeReadingSentence, setActiveReadingSentence] = useState(0);
  const readingActivity = node.activities.find((activity) =>
    activity.type === "single_choice" && typeof activity.config.reading === "string",
  );
  const writingActivity = node.activities.find((activity) => activity.type === "writing");
  const contentReading = objectValue(node.content.reading);
  const contentReadingLines = stringArray(contentReading.lines);
  const readingText = String(
    readingActivity?.config.reading
      ?? (contentReadingLines.length > 0 ? contentReadingLines.join("\n") : node.content.reading)
      ?? "",
  );
  const readingSentences = readingText.split(/\n+|(?<=[.!?。！？])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
  const informationLabels = stringArray(writingActivity?.config.informationChecklist);
  const contentWriting = objectValue(node.content.writing);
  const writingFrame = String(node.content.writingFrame ?? contentWriting.frame ?? writingActivity?.config.structureFrame ?? "");
  const frameParts = writingFrame
    .split("→")
    .map((part) => part.trim())
    .filter(Boolean);
  const [draftLines, setDraftLines] = useState<string[]>(() =>
    Array.from({ length: Math.max(informationLabels.length, frameParts.length, 5) }, () => ""),
  );
  const sceneImage = node.media.find((asset) => asset.type === "image" && asset.status === "ready" && asset.url);
  const builderLabels = informationLabels.length > 0
    ? informationLabels
    : locale === "ko-KR"
      ? ["인사", "이름", "국적·지역", "신분·학습 내용", "마무리"]
      : ["问候", "姓名", "国籍／地区", "身份／学习内容", "结束语"];

  if (page === 0) {
    return (
      <section className="mt-6 overflow-hidden rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-soft)]">
        <div className="grid min-h-[520px] lg:grid-cols-[minmax(280px,.78fr)_minmax(0,1.22fr)]">
          <div data-learning-target="scene:image" tabIndex={-1} className="relative min-h-[320px] overflow-hidden bg-[color-mix(in_srgb,var(--primary)_8%,var(--surface-soft))] outline-none lg:min-h-full">
            {sceneImage?.url ? (
              <Image
                src={sceneImage.url}
                alt={sceneImage.altText[locale] ?? sceneImage.altText["zh-CN"] ?? ""}
                fill
                sizes="(min-width: 1024px) 34vw, 100vw"
                className="object-contain p-6 sm:p-8"
              />
            ) : (
              <div className="flex h-full min-h-[320px] items-center justify-center">
                <BookOpen size={46} className="text-[var(--primary)]" aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
            <CardTitleWithHint
              title={locale === "ko-KR" ? "이번 단원 자료를 읽어 보세요" : "阅读本课材料"}
              description={locale === "ko-KR" ? "문장을 차례로 누르고 문제에 필요한 근거를 찾으세요." : "依次点击句子，定位理解题需要的信息依据；这里不直接显示答案。"}
              headingLevel={3}
              titleClassName="text-xl font-bold text-[var(--foreground)]"
              hintLabel={locale === "ko-KR" ? "읽기 방법 보기" : "查看阅读方法"}
            />
            <div className="mt-6 space-y-2" lang="ko">
              {readingSentences.map((sentence, index) => {
                const active = activeReadingSentence === index;
                return (
                  <button
                    key={`${index}-${sentence}`}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setActiveReadingSentence(index)}
                    className={`grid min-h-14 w-full grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] motion-reduce:transition-none ${active ? "border-[var(--primary)] bg-[var(--card)] shadow-sm" : "border-transparent bg-[var(--card)]/55 hover:border-[var(--border-strong)]"}`}
                  >
                    <span className={`flex size-7 items-center justify-center rounded-full text-[11px] font-bold tabular-nums ${active ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "bg-[var(--surface-soft)] text-[var(--foreground-muted)]"}`}>{String(index + 1).padStart(2, "0")}</span>
                    <span className="text-base font-semibold leading-7 text-[var(--foreground)]">{sentence}</span>
                    <span className={`text-[11px] font-bold ${active ? "text-[var(--primary)]" : "text-[var(--foreground-muted)]"}`}>{locale === "ko-KR" ? `단서 ${index + 1}` : `线索 ${index + 1}`}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-5 text-sm leading-6 text-[var(--foreground-secondary)]">
              {locale === "ko-KR" ? "선택한 문장이 어떤 정보를 말하는지 확인한 뒤 정보 이해 페이지로 이동하세요." : "先确认每句话承担什么信息，再进入“信息理解”完成事实题。"}
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (page !== 2) return null;

  const previewLines = draftLines.map((line) => line.trim()).filter(Boolean);
  return (
    <section className="mt-6 overflow-hidden rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-soft)]">
      <div className="border-b border-[var(--border-subtle)] px-6 py-5 sm:px-8">
        <CardTitleWithHint
          title={locale === "ko-KR" ? "쓰기 흐름을 먼저 만드세요" : "搭建本课写作内容"}
          description={locale === "ko-KR" ? "예시의 순서만 참고하고 각 문장은 자신의 안전한 정보로 바꾸세요." : "只借用示范的表达顺序，把每个节点改成自己的安全信息；这一页不计入完成进度。"}
          headingLevel={3}
          titleClassName="text-xl font-bold text-[var(--foreground)]"
          hintLabel={locale === "ko-KR" ? "쓰기 준비 방법 보기" : "查看写作准备方法"}
        />
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,.95fr)]">
        <div className="border-b border-[var(--border-subtle)] p-6 lg:border-b-0 lg:border-r sm:p-8">
          <div className="relative space-y-4 before:absolute before:bottom-7 before:left-5 before:top-7 before:w-px before:bg-[var(--border-strong)]">
            {draftLines.map((line, index) => (
              <label key={index} className="relative grid grid-cols-[42px_minmax(0,1fr)] gap-4">
                <span className="z-[1] flex size-10 items-center justify-center rounded-full border-2 border-[var(--primary)] bg-[var(--card)] text-xs font-bold tabular-nums text-[var(--primary)]">{String(index + 1).padStart(2, "0")}</span>
                <span className="min-w-0">
                  <span className="mb-2 block text-xs font-bold text-[var(--foreground-secondary)]">{builderLabels[index] ?? (locale === "ko-KR" ? `문장 ${index + 1}` : `第 ${index + 1} 句`)}</span>
                  <input
                    value={line}
                    onChange={(event) => setDraftLines((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
                    lang="ko"
                    autoComplete="off"
                    className="min-h-12 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] px-4 text-base font-semibold text-[var(--foreground)] outline-none transition placeholder:text-[var(--foreground-muted)] focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                    placeholder={frameParts[index] ?? (locale === "ko-KR" ? "한국어 문장을 쓰세요" : "输入完整韩语句子")}
                  />
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-col p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-bold text-[var(--foreground)]">{locale === "ko-KR" ? "쓰기 미리 보기" : "写作预览"}</h4>
            <span className="rounded-full bg-[var(--card)] px-3 py-1.5 text-xs font-bold tabular-nums text-[var(--foreground-secondary)]">{previewLines.length} / {draftLines.length}</span>
          </div>
          <div className="mt-5 flex min-h-[300px] flex-1 flex-col justify-center rounded-[22px] border border-[var(--border-subtle)] bg-[var(--card)] px-6 py-7 shadow-sm">
            {previewLines.length > 0 ? (
              <p className="whitespace-pre-line text-lg font-bold leading-10 text-[var(--foreground)]" lang="ko">{previewLines.join("\n")}</p>
            ) : (
              <p className="text-center text-sm font-semibold leading-6 text-[var(--foreground-muted)]">{locale === "ko-KR" ? "왼쪽의 문장을 채우면 글이 여기에 나타납니다." : "填写左侧节点后，这里会形成完整短文。"}</p>
            )}
          </div>
          <p className="mt-4 text-sm leading-6 text-[var(--foreground-secondary)]">{locale === "ko-KR" ? "흐름을 확인한 뒤 독립 쓰기에서 4~5문장을 직접 작성하세요." : "确认表达顺序后，到“独立写作”重新写出 4—5 句原创介绍。"}</p>
        </div>
      </div>
    </section>
  );
}

function ReviewResultPanel({
  node,
  locale,
  savedResponses,
}: {
  node: SmartTextbookNode;
  locale: SmartLocale;
  savedResponses: Record<string, AnswerValue>;
}) {
  const reviewActivity = node.activities.find((activity) => activity.type === "multiple_choice");
  const selfCheckActivity = node.activities.find((activity) => activity.type === "self_check");
  const checkItems = Array.isArray(selfCheckActivity?.config.items) ? selfCheckActivity.config.items.map(objectValue) : [];
  const returnItems = Array.isArray(selfCheckActivity?.config.returnNodes) ? selfCheckActivity.config.returnNodes.map(objectValue) : [];
  const response = objectValue(selfCheckActivity ? savedResponses[selfCheckActivity.id] ?? selfCheckActivity.response : null);
  const checks = stringArray(response.checks);
  const returnNodes = stringArray(response.returnNodes);
  const completedTasks = Number(Boolean(reviewActivity && (reviewActivity.completed || savedResponses[reviewActivity.id] !== undefined)))
    + Number(Boolean(selfCheckActivity && (selfCheckActivity.completed || savedResponses[selfCheckActivity.id] !== undefined)));
  const ready = completedTasks === 2;
  const reviewCount = checks.filter((check) => check === "review").length;
  const selectedReturns = returnItems.filter((item) => returnNodes.includes(String(item.value)));

  return (
    <section className="mt-6 overflow-hidden rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-soft)]">
      <div className="border-b border-[var(--border-subtle)] px-6 py-5 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitleWithHint
            title={locale === "ko-KR" ? "이번 단원의 학습 결과" : "本章学习结果"}
            description={locale === "ko-KR" ? "객관식 결과와 자기 점검을 함께 보고 다음 학습 위치를 정하세요." : "综合客观题和能力自查形成复盘结果，不用单一分数代替真实学习证据。"}
            headingLevel={3}
            titleClassName="text-xl font-bold text-[var(--foreground)]"
            hintLabel={locale === "ko-KR" ? "결과 설명 보기" : "查看结果说明"}
          />
          <span className={`inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-xs font-bold ${ready ? "bg-[var(--status-success-surface)] text-[var(--status-success)]" : "bg-[var(--card)] text-[var(--foreground-secondary)]"}`}>
            {ready ? <CheckCircle2 size={15} aria-hidden="true" /> : <Circle size={15} aria-hidden="true" />}
            {ready ? (locale === "ko-KR" ? "복습 결과 완성" : "复盘结果已生成") : `${completedTasks} / 2`}
          </span>
        </div>
      </div>
      {!ready ? (
        <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-[var(--card)] text-[var(--primary)] shadow-sm"><CheckCircle2 size={25} aria-hidden="true" /></span>
          <h4 className="mt-5 text-lg font-bold text-[var(--foreground)]">{locale === "ko-KR" ? "두 활동을 먼저 완성하세요" : "先完成前两项任务"}</h4>
          <p className="mt-2 max-w-md text-sm leading-6 text-[var(--foreground-secondary)]">{locale === "ko-KR" ? "종합 점검과 다섯 항목 자기 점검을 제출하면 이곳에 복습 경로가 나타납니다." : "提交“综合自测”和“五项能力自查”后，这里会显示需要巩固的能力与建议返回位置。"}</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
          <div className="border-b border-[var(--border-subtle)] p-6 lg:border-b-0 lg:border-r sm:p-8">
            <div className="flex items-end justify-between gap-4">
              <div><p className="text-xs font-bold text-[var(--foreground-muted)]">{locale === "ko-KR" ? "능력 점검" : "能力自查"}</p><h4 className="mt-1 text-lg font-bold text-[var(--foreground)]">{reviewCount === 0 ? (locale === "ko-KR" ? "다섯 목표를 계속 유지하세요" : "五项目标均可继续保持") : (locale === "ko-KR" ? `${reviewCount}개 목표를 다시 연습하세요` : `有 ${reviewCount} 项需要复习`)}</h4></div>
              <span className="text-3xl font-bold tabular-nums text-[var(--primary)]">{checks.filter((check) => check === "can").length}<span className="text-sm text-[var(--foreground-muted)]"> / {checkItems.length}</span></span>
            </div>
            <div className="mt-6 space-y-2">
              {checkItems.map((item, index) => {
                const canDo = checks[index] === "can";
                return <div key={String(item.id ?? index)} className={`flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 ${canDo ? "border-[var(--status-success)]/35 bg-[var(--status-success-surface)]" : "border-[var(--status-warning)]/40 bg-[var(--status-warning-surface)]"}`}><span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${canDo ? "bg-[var(--status-success)] text-white" : "bg-[var(--status-warning)] text-white"}`}>{canDo ? <Check size={16} aria-hidden="true" /> : <RotateCcw size={15} aria-hidden="true" />}</span><span className="text-sm font-semibold leading-6 text-[var(--foreground)]">{String(item.label ?? "")}</span></div>;
              })}
            </div>
          </div>
          <div className="p-6 sm:p-8">
            <p className="text-xs font-bold text-[var(--foreground-muted)]">{locale === "ko-KR" ? "다음 학습 위치" : "下一步学习位置"}</p>
            <h4 className="mt-1 text-lg font-bold text-[var(--foreground)]">{returnNodes.includes("none") ? (locale === "ko-KR" ? "현재 흐름을 유지하세요" : "保持当前练习节奏") : (locale === "ko-KR" ? "필요한 부분만 다시 연습하세요" : "只返回需要巩固的板块")}</h4>
            <div className="mt-6 space-y-3">
              {(selectedReturns.length > 0 ? selectedReturns : [{ value: "none", label: locale === "ko-KR" ? "계속 연습" : "保持练习" }]).map((item, index) => (
                <div key={`${String(item.value)}-${index}`} className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)] px-4 py-4 shadow-sm"><span className="flex size-9 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--primary)]"><ChevronRight size={17} aria-hidden="true" /></span><span className="font-bold text-[var(--foreground)]">{String(item.label ?? "")}</span></div>
              ))}
            </div>
            {String(response.note ?? "").trim() && <div className="mt-5 rounded-2xl bg-[var(--card)] p-4 text-sm leading-6 text-[var(--foreground-secondary)] ring-1 ring-[var(--border-subtle)]"><span className="mb-1 block text-xs font-bold text-[var(--foreground-muted)]">{locale === "ko-KR" ? "나의 메모" : "我的复习备注"}</span>{String(response.note)}</div>}
          </div>
        </div>
      )}
    </section>
  );
}

function stableIndexOrder(length: number, seed: string, shuffle: boolean) {
  const order = Array.from({ length }, (_, index) => index);
  if (!shuffle || length < 2) return order;

  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  const random = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  for (let index = length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [order[index], order[target]] = [order[target], order[index]];
  }
  if (order.every((value, index) => value === index)) {
    order.push(order.shift()!);
  }
  return order;
}

function Activity({
  activity,
  locale,
  trackingDisabled,
  onCompleted,
  round,
  grammarPageOffset = 0,
  onPreviousGrammarActivity,
  onNextGrammarActivity,
  isLastGrammarActivity = false,
}: {
  activity: SmartTextbookActivity;
  locale: SmartLocale;
  trackingDisabled: boolean;
  round?: { current: number; total: number };
  grammarPageOffset?: number;
  onPreviousGrammarActivity?: () => void;
  onNextGrammarActivity?: () => void;
  isLastGrammarActivity?: boolean;
  onCompleted: (result: {
    nodeId: string | null;
    nodeCompleted: boolean;
    completionPercent: number;
    preview: boolean;
    activityId?: string;
    response?: AnswerValue;
  }) => void;
}) {
  const t = ui[locale];
  const configItems = Array.isArray(activity.config.items)
    ? activity.config.items.map(objectValue)
    : [];
  const fillBlankPages = configItems.reduce<Array<{
    key: string;
    items: Array<{ item: Record<string, unknown>; originalIndex: number }>;
  }>>((pages, item, originalIndex) => {
    const key = String(item.group ?? item.groupKo ?? "all");
    const page = pages.find((candidate) => candidate.key === key);
    if (page) page.items.push({ item, originalIndex });
    else pages.push({ key, items: [{ item, originalIndex }] });
    return pages;
  }, []);
  const groupedChoicePages = configItems.reduce<Array<{
    key: string;
    items: Array<{ item: Record<string, unknown>; originalIndex: number }>;
  }>>((pages, item, originalIndex) => {
    const key = String(item.group ?? item.groupKo ?? "all");
    const page = pages.find((candidate) => candidate.key === key);
    if (page) page.items.push({ item, originalIndex });
    else pages.push({ key, items: [{ item, originalIndex }] });
    return pages;
  }, []);
  const groupedSingleChoice =
    (activity.type === "single_choice" || activity.type === "listening") && configItems.length > 0;
  const isListeningQuiz = activity.type === "listening" && groupedSingleChoice;
  const usesFlipCards =
    groupedSingleChoice && activity.config.presentation === "flip_cards";
  const usesExpressionPath =
    activity.type === "ordering" && activity.config.presentation === "expression_path";
  const isGrammarPractice = ["choice", "judgment", "fill"].includes(
    String(activity.config.practiceKind ?? ""),
  );
  const isPagedChoicePractice = isGrammarPractice || isListeningQuiz;
  const usesFocusMode = activity.config.focusMode === true && !usesFlipCards;
  const requiresConfirmation = Boolean(activity.config.readAloudConfirmation);
  const optionOrder = stableIndexOrder(
    activity.options.length,
    `${activity.id}:options`,
    activity.config.shuffle === true,
  );
  const groupedOptionOrders = configItems.map((item, itemIndex) =>
    stableIndexOrder(
      stringArray(item.options).length,
      `${activity.id}:${String(item.id ?? itemIndex)}:options`,
      activity.config.shuffle === true ||
        activity.config.shuffleOptions === true,
    ),
  );
  const [answer, setAnswer] = useState<AnswerValue>(() => {
    if (activity.type === "multiple_choice") return [];
    if (activity.type === "ordering") {
      if (activity.completed && Array.isArray(activity.response)) {
        return activity.response.map(Number);
      }
      if (usesExpressionPath) return [];
      return stableIndexOrder(
        activity.options.length,
        `${activity.id}:ordering`,
        true,
      );
    }
    if (activity.type === "fill_blank" && configItems.length > 0) {
      return configItems.map(() => "");
    }
    if (groupedSingleChoice) {
      if (activity.completed && Array.isArray(activity.response)) {
        const savedResponse = activity.response as unknown[];
        return configItems.map((_, index) => Number(savedResponse[index] ?? -1));
      }
      const restored = configItems.map(() => -1);
      for (const page of activity.pageProgress) {
        page.itemIndices.forEach((originalIndex, index) => {
          restored[originalIndex] = Number(page.response[index] ?? -1);
        });
      }
      return restored;
    }
    if (requiresConfirmation) return { selection: -1, confirmed: false };
    if (activity.type === "speaking") {
      if (activity.completed && activity.response && typeof activity.response === "object" && !Array.isArray(activity.response)) {
        return activity.response;
      }
      return { recorded: false, durationSeconds: 0, turns: 0, criteria: [] };
    }
    if (activity.type === "writing") {
      if (activity.completed && activity.response && typeof activity.response === "object" && !Array.isArray(activity.response)) {
        return activity.response;
      }
      return { text: "", informationKinds: [], rubricConfirmed: false };
    }
    if (activity.type === "self_check") {
      if (activity.completed && activity.response && typeof activity.response === "object" && !Array.isArray(activity.response)) {
        return activity.response;
      }
      return { checks: configItems.map(() => ""), returnNodes: [], note: "" };
    }
    return "";
  });
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [activeGroupedChoicePage, setActiveGroupedChoicePage] = useState(0);
  const [activeFillBlankPage, setActiveFillBlankPage] = useState(0);
  const [pageChecks, setPageChecks] = useState<Record<number, { results: boolean[]; answers: Array<number | string>; revealed: boolean }>>(() => {
    if (!groupedSingleChoice) return {};
    if (!activity.completed) {
      return Object.fromEntries(activity.pageProgress.map((page) => [
        page.pageIndex,
        { results: page.results, answers: page.answers, revealed: page.results.every(Boolean) },
      ]));
    }
    if (!Array.isArray(activity.response)) return {};
    const savedResponse = activity.response as unknown[];
    return Object.fromEntries(
      groupedChoicePages.map((page, pageIndex) => [
        pageIndex,
        {
          results: page.items.map(() => true),
          answers: page.items.map(({ originalIndex }) => Number(savedResponse[originalIndex] ?? -1)),
          revealed: false,
        },
      ]),
    );
  });
  const [checkingPage, setCheckingPage] = useState(false);
  const [practiceFocused, setPracticeFocused] = useState(false);
  const [listeningTranscripts, setListeningTranscripts] = useState<Record<number, string>>({});
  const [transcriptVisible, setTranscriptVisible] = useState(false);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [speakingReferenceVisible, setSpeakingReferenceVisible] = useState(false);
  const [speakingOutlineIndex, setSpeakingOutlineIndex] = useState(0);
  const focusModeStartRef = useRef<HTMLButtonElement>(null);
  const focusModeCloseRef = useRef<HTMLButtonElement>(null);
  const activityCompleted =
    activity.completed ||
    (feedback?.ok === true && feedback.correct !== false);
  const [message, setMessage] = useState("");
  const [needsReload, setNeedsReload] = useState(false);
  const [pending, startTransition] = useTransition();
  const hasPendingAudio =
    activity.type === "listening" && activity.config.audioStatus !== "ready";
  const isLastGrammarPracticePage = activity.type === "fill_blank"
    ? activeFillBlankPage === fillBlankPages.length - 1
    : !groupedSingleChoice || activeGroupedChoicePage === groupedChoicePages.length - 1;
  const activeGrammarPage = activity.type === "fill_blank" ? activeFillBlankPage : activeGroupedChoicePage;
  const activeGrammarItems = activity.type === "fill_blank"
    ? (fillBlankPages[activeFillBlankPage]?.items ?? [])
    : (groupedChoicePages[activeGroupedChoicePage]?.items ?? []);
  const activePageCheck = pageChecks[activeGrammarPage];
  const activePageCompleted = Boolean(activePageCheck && (activePageCheck.revealed || activePageCheck.results.every(Boolean)));
  const activePageReady = activityCompleted || activePageCompleted;
  const canViewListeningTranscript = activity.type === "listening" && (
    isListeningQuiz ? Boolean(pageChecks[activeGrammarPage]) : activityCompleted
  );
  const listeningTranscript = listeningTranscripts[activeGrammarPage] ?? null;

  async function checkGrammarPage() {
    const values = Array.isArray(answer) ? answer : [];
    if (activeGrammarItems.some(({ originalIndex }) => String(values[originalIndex] ?? "").trim() === "" || Number(values[originalIndex]) < 0)) {
      setMessage(t.noResponse);
      return;
    }
    setCheckingPage(true);
    setMessage("");
    const result = await checkSmartTextbookActivityPageAction({
      activityId: activity.id,
      pageIndex: activeGrammarPage,
      itemIndices: activeGrammarItems.map(({ originalIndex }) => originalIndex),
      response: activeGrammarItems.map(({ originalIndex }) => values[originalIndex]),
    });
    setCheckingPage(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    const checkedPage = { ...result, revealed: false };
    setPageChecks((current) => ({ ...current, [activeGrammarPage]: checkedPage }));
    const allListeningPagesCompleted = isListeningQuiz && groupedChoicePages.every((_, pageIndex) => {
      const check = pageIndex === activeGrammarPage ? checkedPage : pageChecks[pageIndex];
      return Boolean(check && (check.revealed || check.results.every(Boolean)));
    });
    const finalCorrectPageCompleted = (isListeningQuiz || isLastGrammarActivity) && isLastGrammarPracticePage && result.results.every(Boolean);
    if ((allListeningPagesCompleted || finalCorrectPageCompleted) && !activityCompleted) {
      submit();
    }
  }

  function revealGrammarAnswers() {
    if (!activePageCheck) return;
    const next = Array.isArray(answer) ? [...answer] : [];
    activeGrammarItems.forEach(({ originalIndex }, index) => { next[originalIndex] = activePageCheck.answers[index]; });
    setAnswer(next);
    const revealedPage = { ...activePageCheck, revealed: true };
    setPageChecks((current) => ({ ...current, [activeGrammarPage]: revealedPage }));
    const allListeningPagesCompleted = isListeningQuiz && groupedChoicePages.every((_, pageIndex) => {
      const check = pageIndex === activeGrammarPage ? revealedPage : pageChecks[pageIndex];
      return Boolean(check && (check.revealed || check.results.every(Boolean)));
    });
    if (allListeningPagesCompleted && !activityCompleted) submit(next);
    if (isListeningQuiz) {
      void checkSmartTextbookActivityPageAction({
        activityId: activity.id,
        pageIndex: activeGrammarPage,
        itemIndices: activeGrammarItems.map(({ originalIndex }) => originalIndex),
        response: activeGrammarItems.map(({ originalIndex }) => next[originalIndex]),
      });
    }
  }

  function clearActivePageCheck() {
    setPageChecks((current) => {
      const next = { ...current };
      delete next[activeGrammarPage];
      return next;
    });
  }

  async function toggleListeningTranscript() {
    if (transcriptVisible) {
      setTranscriptVisible(false);
      return;
    }
    if (listeningTranscript) {
      setTranscriptVisible(true);
      return;
    }

    setTranscriptLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/digital-textbook/transcript/${activity.id}?page=${activeGrammarPage}`, {
        cache: "no-store",
      });
      const payload = await response.json() as { transcript?: string; message?: string };
      if (!response.ok || !payload.transcript) {
        setMessage(locale === "ko-KR" ? "원고를 불러오지 못했습니다." : "暂时无法读取音频母稿。");
        return;
      }
      setListeningTranscripts((current) => ({ ...current, [activeGrammarPage]: payload.transcript! }));
      setTranscriptVisible(true);
    } catch {
      setMessage(locale === "ko-KR" ? "원고를 불러오지 못했습니다." : "暂时无法读取音频母稿。");
    } finally {
      setTranscriptLoading(false);
    }
  }

  function previousGrammarPage() {
    if (activity.type === "fill_blank") {
      if (activeFillBlankPage === 0) onPreviousGrammarActivity?.();
      else setActiveFillBlankPage((page) => page - 1);
      return;
    }
    if (activeGroupedChoicePage === 0) onPreviousGrammarActivity?.();
    else setActiveGroupedChoicePage((page) => page - 1);
  }

  function nextGrammarPage() {
    if (activity.type === "fill_blank") {
      if (activeFillBlankPage === fillBlankPages.length - 1) {
        if (!activityCompleted) submit();
        onNextGrammarActivity?.();
      } else setActiveFillBlankPage((page) => page + 1);
      return;
    }
    if (activeGroupedChoicePage === groupedChoicePages.length - 1) {
      if (!activityCompleted) submit();
      onNextGrammarActivity?.();
    } else setActiveGroupedChoicePage((page) => page + 1);
  }

  useEffect(() => {
    if (!practiceFocused) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    focusModeCloseRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closePractice();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [practiceFocused]);

  useEffect(() => {
    setTranscriptVisible(false);
  }, [activeGrammarPage]);

  function hasResponse(responseValue: AnswerValue = answer) {
    if (activity.type === "writing") {
      return typeof objectValue(responseValue).text === "string" && String(objectValue(responseValue).text).trim().length > 0;
    }
    if (activity.type === "speaking") {
      const response = objectValue(responseValue);
      return response.recorded === true && typeof response.durationSeconds === "number" && Number.isFinite(response.durationSeconds) && response.durationSeconds > 0 && typeof response.recordingEvidenceId === "string";
    }
    if (activity.type === "self_check") {
      const checks = objectValue(responseValue).checks;
      const returnNodes = objectValue(responseValue).returnNodes;
      return Array.isArray(checks) && checks.length === configItems.length && checks.every((item) => item === "can" || item === "review") && Array.isArray(returnNodes) && returnNodes.length > 0;
    }
    if (groupedSingleChoice) {
      return Array.isArray(responseValue) && responseValue.length === configItems.length && responseValue.every((item, index) => typeof item === "number" && Number.isInteger(item) && item >= 0 && item < stringArray(configItems[index]?.options).length);
    }
    if (requiresConfirmation) {
      const response = objectValue(responseValue);
      return typeof response.selection === "number" && Number.isInteger(response.selection) && response.selection >= 0 && response.selection < activity.options.length && response.confirmed === true;
    }
    if (activity.type === "single_choice" || activity.type === "listening") {
      return typeof responseValue === "number" && Number.isInteger(responseValue) && responseValue >= 0 && responseValue < activity.options.length;
    }
    if (activity.type === "multiple_choice") {
      return Array.isArray(responseValue) && responseValue.length > 0 && responseValue.every((item) => typeof item === "number" && Number.isInteger(item) && item >= 0 && item < activity.options.length) && new Set(responseValue).size === responseValue.length;
    }
    if (activity.type === "fill_blank") {
      return typeof responseValue === "string"
        ? responseValue.trim().length > 0
        : Array.isArray(responseValue) &&
            responseValue.length === configItems.length &&
            responseValue.every(
              (item) => typeof item === "string" && item.trim().length > 0,
            );
    }
    if (activity.type === "ordering") {
      return Array.isArray(responseValue) && responseValue.length === activity.options.length && responseValue.every((item) => typeof item === "number" && Number.isInteger(item) && item >= 0 && item < activity.options.length) && new Set(responseValue).size === activity.options.length;
    }
    return false;
  }

  function submit(responseOverride?: AnswerValue) {
    const responseToSubmit = responseOverride === undefined ? answer : responseOverride;
    setFeedback(null);
    const overrideHasResponse = hasResponse(responseToSubmit);
    if (!overrideHasResponse || hasPendingAudio) {
      setMessage(hasPendingAudio ? t.audioPending : t.noResponse);
      return;
    }
    setMessage("");
    setNeedsReload(false);
    startTransition(async () => {
      try {
        const result = await submitSmartTextbookActivityAction({ activityId: activity.id, response: responseToSubmit, locale });
        setFeedback(result);
        if (result.ok) {
          onCompleted({
            nodeId: result.nodeId,
            nodeCompleted: result.nodeCompleted,
            completionPercent: result.completionPercent,
            preview: result.preview,
            activityId: activity.id,
            response: responseToSubmit,
          });
        }
      } catch (error) {
        const staleAction = isStaleServerActionError(error);
        setNeedsReload(staleAction);
        setMessage(staleAction ? t.pageUpdated : t.requestFailed);
      }
    });
  }

  const ordered: number[] = activity.type === "ordering" && Array.isArray(answer)
    ? answer.map(Number)
    : [];
  function moveOrder(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    [next[index], next[target]] = [next[target], next[index]];
    setAnswer(next);
    setFeedback(null);
  }
  function removeExpressionPathItem(index: number) {
    setAnswer(ordered.filter((_, itemIndex) => itemIndex !== index));
    setFeedback(null);
  }

  function showCard(index: number) {
    const lastIndex = Math.max(configItems.length - 1, 0);
    setActiveCardIndex(Math.min(Math.max(index, 0), lastIndex));
  }

  function closePractice() {
    setPracticeFocused(false);
    window.requestAnimationFrame(() => focusModeStartRef.current?.focus());
  }

  function keepFocusInsidePractice(event: React.KeyboardEvent<HTMLElement>) {
    if (!practiceFocused || event.key !== "Tab") return;
    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (controls.length === 0) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <section
      data-smart-textbook-activity-id={activity.id}
      role={practiceFocused ? "dialog" : undefined}
      aria-modal={practiceFocused ? true : undefined}
      aria-label={practiceFocused
        ? locale === "ko-KR" ? "문법 집중 연습" : "语法专注练习"
        : undefined}
      onKeyDown={keepFocusInsidePractice}
      className={`min-w-0 max-w-full ${practiceFocused
        ? "fixed inset-0 z-[100] m-0 flex overflow-y-auto rounded-none border-0 bg-[var(--background)] p-4 sm:p-8"
        : isGrammarPractice
          ? "mt-5 rounded-[22px] bg-[var(--surface-soft)] p-5 sm:p-6"
          : "mt-10 rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-5 sm:p-6"}`}
    >
      <div className={practiceFocused
        ? "m-auto w-full max-w-4xl rounded-[32px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-5 shadow-[0_24px_80px_rgba(15,23,42,0.14)] sm:p-8"
        : "min-w-0 max-w-full"}
      >
      <div className={isGrammarPractice ? "flex flex-col gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6" : "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6"}>
        <div className="min-w-0">
          {round && round.total > 1 && (
            <p className="mb-2 text-xs font-bold text-[var(--primary)]">
              {locale === "ko-KR"
                ? `연습 ${round.current} · 총 ${round.total}회`
                : `练习 ${round.current} · 共 ${round.total} 轮`}
            </p>
          )}
          <CardTitleWithHint
            title={isGrammarPractice ? (locale === "ko-KR" ? "이번 페이지 연습을 완성하세요" : "完成本页练习") : activity.prompt[locale]}
            description={activity.instruction[locale]}
            headingLevel={4}
            titleClassName={isGrammarPractice ? "text-lg font-bold leading-7 text-[var(--foreground)]" : "text-xl font-bold leading-8 text-[var(--foreground)]"}
            hintClassName="-ml-1"
            hintLabel={locale === "ko-KR" ? "문제 풀이 안내 보기" : "查看答题说明"}
          />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {isPagedChoicePractice && (
            <nav className="flex items-center gap-2" aria-label={isListeningQuiz ? (locale === "ko-KR" ? "듣기 문제 페이지" : "听辨题分页") : (locale === "ko-KR" ? "문법 연습 페이지" : "语法练习分页")}>
              <button type="button" disabled={activeGrammarPage === 0 && !onPreviousGrammarActivity} onClick={previousGrammarPage} className="min-h-9 rounded-lg px-3 text-sm font-bold text-[var(--foreground-secondary)] hover:bg-[var(--surface-soft)] disabled:opacity-30">{locale === "ko-KR" ? "이전" : "上一页"}</button>
              <span className="min-w-12 text-center text-xs font-bold tabular-nums text-[var(--foreground-muted)]">{isListeningQuiz ? activeGrammarPage + 1 : grammarPageOffset + activeGrammarPage + 1} / {isListeningQuiz ? groupedChoicePages.length : 6}</span>
              {(!isLastGrammarActivity || !isLastGrammarPracticePage) && <button type="button" disabled={!activePageReady} onClick={nextGrammarPage} className="min-h-9 rounded-lg px-3 text-sm font-bold text-[var(--primary)] hover:bg-[var(--accent)] disabled:opacity-30">{locale === "ko-KR" ? "다음" : "下一页"}</button>}
            </nav>
          )}
          {(activityCompleted || (isPagedChoicePractice && activePageCompleted)) && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--status-success-surface)] px-3 py-1.5 text-xs font-bold text-[var(--status-success)]" role="status">
              <CheckCircle2 size={14} aria-hidden="true" />
              {isPagedChoicePractice && (isListeningQuiz || isLastGrammarActivity) && isLastGrammarPracticePage && activityCompleted
                ? locale === "ko-KR" ? "전체 완료" : "全部完成"
                : isPagedChoicePractice
                  ? locale === "ko-KR" ? "완료" : "已完成"
                  : feedback?.correct === null ? t.submittedForReview : t.submitted}
            </span>
          )}
          {practiceFocused && (
            <button
              ref={focusModeCloseRef}
              type="button"
              onClick={closePractice}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] px-4 text-sm font-bold text-[var(--foreground-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] motion-reduce:transition-none"
            >
              <X size={17} aria-hidden="true" />
              {locale === "ko-KR" ? "집중 모드 종료" : "退出专注练习"}
            </button>
          )}
        </div>
      </div>

      {activity.type === "listening" && !hasPendingAudio && (
        <div className="mt-6 border-y border-slate-200 bg-[var(--accent)]/55 px-4 py-5 sm:px-5">
          <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[var(--support)] shadow-sm">
              <Headphones size={19} />
            </span>
            <audio
              controls
              controlsList="nodownload"
              preload="none"
              src={`/api/digital-textbook/audio/${activity.id}?page=${activeGrammarPage}`}
              className="h-10 w-full"
            />
            <span className="shrink-0 text-xs font-bold text-[var(--support)]">
              {t.listenPrivate}
            </span>
          </div>
          {canViewListeningTranscript && (
            <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
              <button
                type="button"
                aria-expanded={transcriptVisible}
                disabled={transcriptLoading}
                onClick={toggleListeningTranscript}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] px-4 text-sm font-bold text-[var(--foreground-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-50"
              >
                <BookOpen size={16} aria-hidden="true" />
                {transcriptLoading
                  ? locale === "ko-KR" ? "불러오는 중" : "正在读取"
                  : transcriptVisible
                    ? locale === "ko-KR" ? "원고 접기" : "收起音频母稿"
                    : locale === "ko-KR" ? "오디오 원고 보기" : "查看音频母稿"}
                {transcriptVisible ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
              </button>
              {transcriptVisible && listeningTranscript && (
                <div className="mt-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)] px-5 py-4" lang="ko">
                  <p className="whitespace-pre-wrap text-base font-semibold leading-8 text-[var(--foreground)]">
                    {listeningTranscript}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {hasPendingAudio && (
        <div className="mt-6 flex items-start gap-3 bg-[var(--accent)] px-5 py-4 text-sm leading-6 text-[var(--support)]">
          <Headphones size={19} className="mt-0.5 shrink-0" />
          <span><strong>{t.listenPrivate}</strong><br />{t.audioPending}</span>
        </div>
      )}

      {(activity.type === "single_choice" || activity.type === "listening") && !groupedSingleChoice && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)]">
          {optionOrder.map((originalIndex, displayIndex) => {
            const option = activity.options[originalIndex];
            const selected = requiresConfirmation
              ? Number(objectValue(answer).selection) === originalIndex
              : answer === originalIndex;
            return (
            <button key={`${originalIndex}-${option}`} type="button" disabled={hasPendingAudio} onClick={() => { setAnswer(requiresConfirmation ? { ...objectValue(answer), selection: originalIndex } : originalIndex); setFeedback(null); }} className={`grid w-full grid-cols-[36px_1fr_24px] items-center border-b border-[var(--border-subtle)] px-4 py-4 text-left last:border-b-0 ${selected ? "bg-[var(--accent)]" : "hover:bg-[var(--surface-soft)]"} disabled:cursor-not-allowed disabled:opacity-45`}>
              <span className="font-mono text-xs text-[var(--foreground-muted)]">{String.fromCharCode(65 + displayIndex)}</span>
              <span className="font-medium text-[var(--foreground)]">{option}</span>
              {selected ? <CheckCircle2 size={17} className="text-[var(--support)]" /> : <Circle size={17} className="text-[var(--foreground-muted)]" />}
            </button>
          );})}
        </div>
      )}

      {requiresConfirmation && (
        <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-[var(--card)] px-4 py-3 text-sm font-semibold text-[var(--foreground-secondary)]">
          <input
            type="checkbox"
            checked={objectValue(answer).confirmed === true}
            onChange={(event) => {
              setAnswer({ ...objectValue(answer), confirmed: event.target.checked });
              setFeedback(null);
            }}
            className="h-4 w-4"
          />
          {String(objectValue(activity.config.readAloudConfirmation).label ?? (locale === "ko-KR" ? "문장 전체를 읽었어요" : "已朗读整句"))}
        </label>
      )}

      {groupedSingleChoice && !usesFlipCards && (!usesFocusMode || practiceFocused) && (
        <div className="mt-4">
          <div className="divide-y divide-[var(--border-subtle)] rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)] px-5 pb-1 pt-4">
          {(groupedChoicePages[Math.min(activeGroupedChoicePage, groupedChoicePages.length - 1)]?.items ?? []).map(({ item, originalIndex }, pageItemIndex) => {
            const selectedAnswers = Array.isArray(answer) ? answer.map(Number) : [];
            const options = stringArray(item.options);
            return (
              <fieldset key={String(item.id ?? originalIndex)} className="py-4">
                <legend className="text-sm font-bold leading-6 text-[var(--foreground)]">{pageItemIndex + 1}. {String(objectValue(item.question)[locale] ?? item.question ?? "")}</legend>
                <div className={`mt-2 grid gap-2 ${activity.config.practiceKind === "judgment" ? "sm:grid-cols-2" : "sm:grid-cols-4"}`}>
                  {groupedOptionOrders[originalIndex].map((originalOptionIndex, displayOptionIndex) => {
                    const option = options[originalOptionIndex];
                    const optionLabel = activity.config.practiceKind === "judgment"
                      ? locale === "ko-KR"
                        ? originalOptionIndex === 0 ? "맞아요" : "틀려요"
                        : originalOptionIndex === 0 ? "正确" : "错误"
                      : option;
                    const selected = selectedAnswers[originalIndex] === originalOptionIndex;
                    const revealedCorrect = activePageCheck?.revealed && Number(activePageCheck.answers[pageItemIndex]) === originalOptionIndex;
                    const checkedTone = activePageCheck && selected
                      ? activePageCheck.results[pageItemIndex] || revealedCorrect
                        ? "border-[var(--status-success)] bg-[var(--status-success-surface)] text-[var(--status-success)]"
                        : "border-[var(--destructive)] bg-[var(--destructive)]/10 text-[var(--destructive)]"
                      : selected
                        ? "border-[var(--primary)] bg-[var(--accent)]"
                        : "border-[var(--border-subtle)] hover:border-[var(--primary)]";
                    return (
                    <button key={`${originalOptionIndex}-${option}`} type="button" onClick={() => {
                      const next = [...selectedAnswers];
                      next[originalIndex] = originalOptionIndex;
                      setAnswer(next);
                      setFeedback(null);
                      clearActivePageCheck();
                    }} className={`min-h-11 rounded-xl border px-3 py-2 text-left text-sm ${checkedTone}`}>
                      {String.fromCharCode(65 + displayOptionIndex)}. {optionLabel}
                    </button>
                  );})}
                </div>
              </fieldset>
            );
          })}
          </div>
        </div>
      )}

      {usesFocusMode && !practiceFocused && (
        <div className="mt-6 flex min-h-[260px] flex-col items-center justify-center rounded-[28px] border border-[var(--border-subtle)] bg-[var(--card)] px-6 py-10 text-center shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--primary)]">
            <Maximize2 size={24} aria-hidden="true" />
          </span>
          <h5 className="mt-5 text-xl font-bold text-[var(--foreground)]">
            {locale === "ko-KR" ? "설명을 가리고 문법을 연습해 보세요" : "遮住语法讲解再开始练习"}
          </h5>
          <p className="mt-2 max-w-md text-sm leading-6 text-[var(--foreground-secondary)]">
            {locale === "ko-KR"
              ? "집중 모드를 열면 위의 문법 설명이 가려지고 이번 연습만 보입니다."
              : "进入专注模式后，上面的语法规则和例句会被完全遮住，只显示本轮练习。"}
          </p>
          <button
            ref={focusModeStartRef}
            type="button"
            onClick={() => setPracticeFocused(true)}
            className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-6 text-sm font-bold text-[var(--primary-foreground)] transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            <Maximize2 size={17} aria-hidden="true" />
            {locale === "ko-KR" ? "집중 연습 시작" : "开始专注练习"}
          </button>
        </div>
      )}

      {usesFlipCards && (!usesFocusMode || practiceFocused) && (() => {
        const item = configItems[activeCardIndex] ?? {};
        const options = stringArray(item.options);
        const selectedAnswers = Array.isArray(answer) ? answer.map(Number) : [];
        const selectedOption = selectedAnswers[activeCardIndex] ?? -1;
        const answeredCount = selectedAnswers.filter((value) => value >= 0).length;
        const cardNumber = activeCardIndex + 1;
        const cardQuestion = String(item.question ?? "");

        return (
          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="font-bold text-[var(--foreground)]">
                {locale === "ko-KR"
                  ? `${cardNumber} / ${configItems.length}번째 단어`
                  : `第 ${cardNumber} / ${configItems.length} 个词`}
              </span>
              <span className="text-[var(--foreground-secondary)]">
                {locale === "ko-KR"
                  ? `${answeredCount}개 완료`
                  : `已作答 ${answeredCount} / ${configItems.length}`}
              </span>
            </div>

            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--border-subtle)]"
              role="progressbar"
              aria-label={locale === "ko-KR" ? "어휘 연습 진행률" : "词汇练习进度"}
              aria-valuemin={0}
              aria-valuemax={configItems.length}
              aria-valuenow={answeredCount}
            >
              <div
                className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${(answeredCount / configItems.length) * 100}%` }}
              />
            </div>

            <div className="mt-5 overflow-hidden rounded-[28px] border border-[var(--border-subtle)] bg-[var(--card)] shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <div className="border-b border-[var(--border-subtle)] bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--primary)_12%,transparent),transparent_62%)] px-6 py-7 text-center sm:py-8">
                <p className="text-xs font-bold text-[var(--primary)]">
                  {locale === "ko-KR" ? "알맞은 뜻을 고르세요" : "选择正确释义"}
                </p>
                <p lang="ko" className="mt-3 text-4xl font-bold tracking-tight text-[var(--foreground)] sm:text-5xl">
                  {cardQuestion}
                </p>
              </div>

              <fieldset className="p-5 sm:p-6">
                <legend className="sr-only">
                  {locale === "ko-KR" ? `${cardQuestion}의 뜻` : `${cardQuestion} 的正确释义`}
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {groupedOptionOrders[activeCardIndex].map((originalOptionIndex, displayOptionIndex) => {
                    const option = options[originalOptionIndex];
                    const selected = selectedOption === originalOptionIndex;
                    return (
                      <button
                        key={`${originalOptionIndex}-${option}`}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          const next = [...selectedAnswers];
                          next[activeCardIndex] = originalOptionIndex;
                          setAnswer(next);
                          setFeedback(null);
                        }}
                        className={`grid min-h-14 grid-cols-[30px_1fr_20px] items-center gap-3 rounded-2xl border px-4 py-3 text-left text-base font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--ring)] motion-reduce:transition-none ${selected ? "border-[var(--primary)] bg-[var(--accent)] text-[var(--foreground)] shadow-sm" : "border-[var(--border-subtle)] bg-[var(--surface-soft)] text-[var(--foreground-secondary)] hover:border-[var(--primary)] hover:bg-[var(--accent)]/45"}`}
                      >
                        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${selected ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "bg-[var(--card)] text-[var(--foreground-secondary)]"}`}>
                          {String.fromCharCode(65 + displayOptionIndex)}
                        </span>
                        <span>{option}</span>
                        {selected ? (
                          <CheckCircle2 size={19} className="text-[var(--primary)]" aria-hidden="true" />
                        ) : (
                          <Circle size={19} className="text-[var(--border-subtle)]" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            <div className="mt-5">
              <div className="flex flex-wrap justify-center gap-2" aria-label={locale === "ko-KR" ? "단어 카드 목록" : "词汇卡片列表"}>
                {configItems.map((card, index) => {
                  const answered = selectedAnswers[index] >= 0;
                  const current = index === activeCardIndex;
                  return (
                    <button
                      key={String(card.id ?? index)}
                      type="button"
                      onClick={() => showCard(index)}
                      aria-label={locale === "ko-KR" ? `${index + 1}번째 단어` : `第 ${index + 1} 个词`}
                      aria-current={current ? "step" : undefined}
                      className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition focus-visible:ring-2 focus-visible:ring-[var(--ring)] motion-reduce:transition-none ${current ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]" : answered ? "border-[var(--status-success)] bg-[var(--status-success-surface)] text-[var(--status-success)]" : "border-[var(--border-subtle)] bg-[var(--card)] text-[var(--foreground-secondary)] hover:border-[var(--primary)]"}`}
                    >
                      {answered && !current ? <Check size={14} aria-hidden="true" /> : index + 1}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => showCard(activeCardIndex - 1)}
                  disabled={activeCardIndex === 0}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] px-4 text-sm font-bold text-[var(--foreground-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-none"
                >
                  <ChevronLeft size={17} aria-hidden="true" />
                  {locale === "ko-KR" ? "이전" : "上一个"}
                </button>
                <button
                  type="button"
                  onClick={() => showCard(activeCardIndex + 1)}
                  disabled={activeCardIndex === configItems.length - 1}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] px-4 text-sm font-bold text-[var(--foreground-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-none"
                >
                  {locale === "ko-KR" ? "다음" : "下一个"}
                  <ChevronRight size={17} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {activity.type === "multiple_choice" && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)]">
          {optionOrder.map((originalIndex, displayIndex) => {
            const option = activity.options[originalIndex];
            const current = Array.isArray(answer) ? answer.map(Number) : [];
            const selected = current.includes(originalIndex);
            return <button key={`${originalIndex}-${option}`} type="button" onClick={() => { setAnswer(selected ? current.filter((item) => item !== originalIndex) : [...current, originalIndex]); setFeedback(null); }} className={`grid w-full grid-cols-[36px_1fr_24px] items-center border-b border-[var(--border-subtle)] px-4 py-4 text-left last:border-b-0 ${selected ? "bg-[var(--accent)]" : "hover:bg-[var(--surface-soft)]"}`}>
              <span className="font-mono text-xs text-[var(--foreground-muted)]">{String.fromCharCode(65 + displayIndex)}</span><span className="font-medium text-[var(--foreground)]">{option}</span>{selected ? <CheckCircle2 size={17} className="text-[var(--primary)]" /> : <Circle size={17} className="text-[var(--foreground-muted)]" />}
            </button>;
          })}
        </div>
      )}

      {activity.type === "fill_blank" && configItems.length === 0 && (
        <input value={typeof answer === "string" ? answer : ""} onChange={(event) => { setAnswer(event.target.value); setFeedback(null); }} lang="ko" autoComplete="off" aria-label={activity.prompt[locale]} className="mt-6 w-full border-x-0 border-b-2 border-t-0 border-slate-300 bg-transparent px-1 py-4 text-xl font-semibold text-slate-900 outline-none transition focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2" placeholder="한국어로 쓰세요" />
      )}

      {activity.type === "fill_blank" && configItems.length > 0 && (!usesFocusMode || practiceFocused) && (
        <div className="mt-4">
          <div className="divide-y divide-[var(--border-subtle)] rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)] px-5 pb-1 pt-4">
          {(fillBlankPages[Math.min(activeFillBlankPage, fillBlankPages.length - 1)]?.items ?? []).map(({ item, originalIndex }, pageItemIndex) => {
            const values = Array.isArray(answer) ? answer.map(String) : [];
            const grammarPoint = locale === "ko-KR"
              ? String(item.grammarPointKo ?? item.grammarPoint ?? "")
              : String(item.grammarPoint ?? "");
            return (
              <div key={String(item.id ?? originalIndex)}>
                <label className="grid gap-2 py-4 text-sm font-semibold text-[var(--foreground-secondary)]">
                  {grammarPoint && <span className="text-xs font-bold text-[var(--primary)]">{grammarPoint}</span>}
                  <span>{pageItemIndex + 1}. {String(item.label ?? item.prompt ?? "")}</span>
                  <span className="relative">
                    <input value={values[originalIndex] ?? ""} onChange={(event) => {
                      const next = [...values];
                      next[originalIndex] = event.target.value;
                      setAnswer(next);
                      setFeedback(null);
                      clearActivePageCheck();
                    }} lang="ko" autoComplete="off" aria-invalid={activePageCheck ? !activePageCheck.results[pageItemIndex] && !activePageCheck.revealed : undefined} className={`min-h-12 w-full rounded-xl border px-4 pr-12 text-base font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${activePageCheck ? activePageCheck.results[pageItemIndex] || activePageCheck.revealed ? "border-[var(--status-success)] bg-[var(--status-success-surface)] text-[var(--status-success)]" : "border-[var(--destructive)] bg-[var(--destructive)]/10 text-[var(--destructive)]" : "border-[var(--border-subtle)] bg-[var(--surface-soft)] text-[var(--foreground)]"}`} placeholder={String(item.placeholder ?? "")} />
                    {activePageCheck && (activePageCheck.results[pageItemIndex] || activePageCheck.revealed
                      ? <CheckCircle2 size={18} aria-label={locale === "ko-KR" ? "정답" : "正确"} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--status-success)]" />
                      : <XCircle size={18} aria-label={locale === "ko-KR" ? "오답" : "错误"} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--destructive)]" />)}
                  </span>
                </label>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {activity.type === "ordering" && usesExpressionPath && (
        <div className="mt-6 rounded-[22px] border border-[var(--border-subtle)] bg-[var(--card)] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-[var(--foreground)]">{locale === "ko-KR" ? "자기소개 흐름" : "自我介绍顺序"}</p>
            <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-bold tabular-nums text-[var(--foreground-secondary)]">{ordered.length} / {activity.options.length}</span>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-4 lg:gap-8" aria-label={locale === "ko-KR" ? "자기소개 표현 순서" : "自我介绍表达路径"}>
            {(Array.isArray(activity.config.pathLabels) ? activity.config.pathLabels.map(objectValue) : []).map((label, index) => {
              const optionIndex = ordered[index];
              const filled = Number.isInteger(optionIndex);
              const checkedTone = feedback?.correct === true ? "border-[var(--status-success)] bg-[var(--status-success-surface)]" : feedback?.correct === false ? "border-[var(--destructive)] bg-[var(--destructive)]/5" : filled ? "border-[var(--primary)] bg-[var(--accent)]" : "border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)]";
              return <div key={String(label.id ?? index)} className="relative min-w-0"><button type="button" disabled={!filled} onClick={() => removeExpressionPathItem(index)} className={`flex min-h-28 w-full flex-col items-start rounded-2xl border-2 p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${checkedTone}`} aria-label={filled ? `${activity.options[optionIndex]}，${locale === "ko-KR" ? "경로에서 빼기" : "从路径中移除"}` : undefined}><span className="text-xs font-bold text-[var(--primary)]">{String(label[locale] ?? index + 1)}</span><span className={`mt-3 text-base font-bold leading-6 ${filled ? "text-[var(--foreground)]" : "text-[var(--foreground-muted)]"}`} lang={filled ? "ko" : undefined}>{filled ? activity.options[optionIndex] : locale === "ko-KR" ? "표현을 고르세요" : "选择一句表达"}</span>{feedback && filled && <span className="mt-auto pt-2">{feedback.correct ? <CheckCircle2 size={16} className="text-[var(--status-success)]" aria-label={locale === "ko-KR" ? "정답" : "正确"} /> : <XCircle size={16} className="text-[var(--destructive)]" aria-label={locale === "ko-KR" ? "순서 오류" : "顺序错误"} />}</span>}</button>{index < activity.options.length - 1 && <ChevronRight size={18} className="absolute -right-6 top-1/2 z-10 hidden -translate-y-1/2 text-[var(--foreground-muted)] lg:block" aria-hidden="true" />}</div>;
            })}
          </div>
          <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
            <p className="text-xs font-bold text-[var(--foreground-secondary)]">{locale === "ko-KR" ? "아래 문장을 순서대로 고르세요" : "依次选择下面的句子"}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">{activity.options.map((option, optionIndex) => { const used = ordered.includes(optionIndex); return <button key={option} type="button" disabled={used || ordered.length >= activity.options.length} onClick={() => { setAnswer([...ordered, optionIndex]); setFeedback(null); }} className="min-h-12 rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] px-4 py-3 text-left text-sm font-bold text-[var(--foreground)] transition hover:border-[var(--primary)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-35" lang="ko">{option}</button>; })}</div>
            <div className="mt-4 flex justify-end"><button type="button" disabled={ordered.length !== activity.options.length} onClick={() => speakKorean(ordered.map((index) => activity.options[index]).join(" "))} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-subtle)] px-4 text-sm font-bold text-[var(--foreground-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-35"><Volume2 size={16} aria-hidden="true" />{locale === "ko-KR" ? "전체 듣기" : "整段朗读"}</button></div>
          </div>
        </div>
      )}

      {activity.type === "ordering" && !usesExpressionPath && (
        <div className="mt-6 border-y border-slate-200">
          {ordered.map((optionIndex, index) => (
            <div key={`${optionIndex}-${index}`} className="grid grid-cols-[40px_1fr_72px] items-center border-b border-slate-100 py-3 last:border-b-0">
              <span className="font-mono text-xs text-slate-400">0{index + 1}</span>
              <span className="text-lg font-semibold text-slate-800">{activity.options[optionIndex]}</span>
              <div className="flex justify-end gap-1">
                <button type="button" title={t.moveUp} aria-label={`${t.moveUp}：${activity.options[optionIndex]}`} disabled={index === 0} onClick={() => moveOrder(index, -1)} className="p-2 text-slate-400 hover:text-slate-900 disabled:opacity-20"><ChevronUp size={16} /></button>
                <button type="button" title={t.moveDown} aria-label={`${t.moveDown}：${activity.options[optionIndex]}`} disabled={index === ordered.length - 1} onClick={() => moveOrder(index, 1)} className="p-2 text-slate-400 hover:text-slate-900 disabled:opacity-20"><ChevronDown size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activity.type === "writing" && (
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
          <div className="overflow-hidden rounded-[22px] border border-[var(--border-subtle)] bg-[var(--card)] shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-soft)] px-5 py-3.5">
              <span className="text-xs font-bold text-[var(--foreground-secondary)]">{locale === "ko-KR" ? "나의 새 회원 소개" : "我的新成员介绍"}</span>
              <span className="text-xs font-bold tabular-nums text-[var(--foreground-muted)]">{t.writingCount} · {String(objectValue(answer).text ?? "").length}</span>
            </div>
            <textarea value={String(objectValue(answer).text ?? "")} onChange={(event) => { setAnswer({ ...objectValue(answer), text: event.target.value }); setFeedback(null); }} lang="ko" rows={9} aria-label={activity.prompt[locale]} className="w-full resize-none bg-[var(--card)] px-5 py-5 text-[17px] font-semibold leading-9 text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]" placeholder={locale === "ko-KR" ? "한국어로 4~5문장을 쓰세요." : "用韩语写 4—5 句原创介绍。"} />
          </div>
          <div className="rounded-[22px] border border-[var(--border-subtle)] bg-[var(--card)] p-5 sm:p-6">
            <h5 className="font-bold text-[var(--foreground)]">{locale === "ko-KR" ? "제출 전 확인" : "提交前检查"}</h5>
            <p className="mt-1 text-xs leading-5 text-[var(--foreground-muted)]">{locale === "ko-KR" ? "실제로 쓴 내용만 선택하세요." : "只勾选文章中实际写出的信息。"}</p>
          <div className="mt-4 space-y-2">
            {stringArray(activity.config.informationChecklist).map((label, index) => {
              const selected = asBooleanArray(objectValue(answer).informationKinds);
              return <label key={label} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm font-semibold transition ${selected[index] ? "border-[var(--status-success)] bg-[var(--status-success-surface)] text-[var(--foreground)]" : "border-[var(--border-subtle)] bg-[var(--surface-soft)] text-[var(--foreground-secondary)]"}`}><input type="checkbox" checked={selected[index] ?? false} onChange={(event) => { const next = [...selected]; next[index] = event.target.checked; setAnswer({ ...objectValue(answer), informationKinds: next }); setFeedback(null); }} className="size-4 accent-[var(--status-success)]" />{label}</label>;
            })}
          </div>
          <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 border-t border-[var(--border-subtle)] pt-4 text-sm font-semibold leading-6 text-[var(--foreground)]"><input type="checkbox" checked={objectValue(answer).rubricConfirmed === true} onChange={(event) => { setAnswer({ ...objectValue(answer), rubricConfirmed: event.target.checked }); setFeedback(null); }} className="mt-1 size-4 shrink-0 accent-[var(--primary)]" />{String(activity.config.rubricConfirmation ?? "我已按量规完成自查")}</label>
          </div>
        </div>
      )}

      {activity.type === "speaking" && activity.config.presentation === "independent_output" && (() => {
        const outlineItems = Array.isArray(activity.config.outlineItems) ? activity.config.outlineItems.map(objectValue) : [];
        const response = objectValue(answer);
        const outlineSelections = Array.isArray(response.outlineSelections)
          ? response.outlineSelections.map((item) =>
              typeof item === "string" && item !== "undefined" && item !== "null"
                ? item
                : "",
            )
          : [];
        const recorded = response.recorded === true;
        const durationSeconds = Number(response.durationSeconds ?? 0);
        const minimumSeconds = Number(activity.config.minimumSeconds ?? 15);
        const selectedCount = outlineSelections.filter(Boolean).length;
        const minimumOutlineItems = Number(activity.config.minimumOutlineItems ?? 4);
        const activeOutlineItem = outlineItems[Math.min(speakingOutlineIndex, Math.max(0, outlineItems.length - 1))] ?? {};
        const activeChoices = stringArray(activeOutlineItem.choices);
        const readyToComplete = recorded && durationSeconds >= minimumSeconds && selectedCount >= minimumOutlineItems;
        return <section className="mt-6 min-w-0 max-w-full overflow-hidden rounded-[24px] border border-[var(--border-subtle)] bg-[var(--card)]">
          <div className="border-b border-[var(--border-subtle)] bg-[var(--surface-soft)] px-5 py-5 sm:px-7">
            <div className="flex flex-wrap items-center justify-between gap-3"><CardTitleWithHint title={locale === "ko-KR" ? "표현 흐름 만들기" : "组织表达"} description={locale === "ko-KR" ? "다섯 단계에서 말할 표현을 고른 뒤 원고 없이 녹음하세요." : "依次选择五个表达节点，再脱离完整原稿进行录音。"} headingLevel={4} titleClassName="text-lg font-bold" hintLabel={locale === "ko-KR" ? "준비 방법 보기" : "查看准备方法"} /><span className="text-xs font-bold tabular-nums text-[var(--foreground-muted)]">{locale === "ko-KR" ? "선택" : "已选"} {selectedCount} / {outlineItems.length}</span></div>
            <div className="relative mt-5 grid min-w-0 grid-cols-5" role="tablist" aria-label={locale === "ko-KR" ? "표현 단계" : "表达步骤"}><span className="absolute left-[10%] right-[10%] top-5 h-px bg-[var(--border-strong)]" aria-hidden="true" />{outlineItems.map((item, index) => { const selected = Boolean(outlineSelections[index]); const active = speakingOutlineIndex === index; return <button key={String(item.id ?? index)} type="button" role="tab" aria-selected={active} onClick={() => setSpeakingOutlineIndex(index)} className="relative z-[1] flex min-h-16 min-w-0 flex-col items-center gap-2 px-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"><span className={`flex size-10 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold tabular-nums transition ${active ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm" : selected ? "border-[var(--status-success)] bg-[var(--status-success-surface)] text-[var(--status-success)]" : "border-[var(--border-strong)] bg-[var(--card)] text-[var(--foreground-muted)]"}`}>{selected && !active ? <Check size={15} aria-hidden="true" /> : String(index + 1).padStart(2, "0")}</span><span className={`max-w-full whitespace-normal [overflow-wrap:anywhere] text-xs font-bold ${active ? "text-[var(--primary)]" : "text-[var(--foreground-secondary)]"}`}>{String(objectValue(item.label)[locale] ?? "")}</span></button>; })}</div>
            <fieldset aria-label={String(objectValue(activeOutlineItem.label)[locale] ?? "")} className="mt-5 min-w-0 rounded-2xl bg-[var(--card)] px-4 py-4 ring-1 ring-[var(--border-subtle)]"><div className="flex min-w-0 flex-wrap gap-2">{activeChoices.map((choice) => { const selected = outlineSelections[speakingOutlineIndex] === choice; return <button key={choice} type="button" aria-pressed={selected} onClick={() => { const next = [...outlineSelections]; next[speakingOutlineIndex] = selected ? "" : choice; const criteria = next.filter(Boolean).map(() => true); setAnswer({ ...response, outlineSelections: next, criteria, turns: 0 }); setFeedback(null); }} className={`min-h-11 max-w-full whitespace-normal rounded-xl px-4 py-2.5 text-left text-sm font-bold [overflow-wrap:anywhere] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${selected ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "border border-[var(--border-subtle)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--primary)] hover:bg-[var(--accent)]"}`} lang="ko">{choice}</button>; })}</div></fieldset>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,.95fr)]">
            <div className="min-w-0 border-b border-[var(--border-subtle)] p-6 lg:border-b-0 lg:border-r sm:p-7"><div className="flex min-w-0 flex-wrap items-center justify-between gap-3"><CardTitleWithHint title={locale === "ko-KR" ? "나의 표현 개요" : "我的表达提纲"} description={locale === "ko-KR" ? "고른 표현을 순서대로 확인하세요." : "按顺序查看已经选择的表达。"} headingLevel={4} titleClassName="text-base font-bold" hintLabel={locale === "ko-KR" ? "개요 설명 보기" : "查看提纲说明"} />{activityCompleted && <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--status-success-surface)] px-3 py-1.5 text-xs font-bold text-[var(--status-success)]" role="status"><CheckCircle2 size={14} aria-hidden="true" />{locale === "ko-KR" ? "완료" : "已完成"}</span>}</div><div className="mt-5 min-h-52 min-w-0 rounded-2xl bg-[var(--surface-soft)] px-5 py-4">{outlineSelections.filter(Boolean).length > 0 ? <p className="max-w-full whitespace-normal text-lg font-bold leading-10 text-[var(--foreground)] [overflow-wrap:anywhere]" lang="ko">{outlineSelections.filter(Boolean).join(" ")}</p> : <div className="flex min-h-44 items-center justify-center text-center text-sm font-semibold text-[var(--foreground-muted)]">{locale === "ko-KR" ? "위 단계에서 말할 표현을 고르세요." : "请在上方选择准备表达的内容。"}</div>}</div></div>
            <div className="flex min-w-0 flex-col justify-between bg-[var(--surface-soft)]/60 p-6 sm:p-7"><div className="min-w-0"><div className="flex min-w-0 flex-wrap items-center justify-between gap-3"><CardTitleWithHint title={locale === "ko-KR" ? "독립 녹음" : "独立录音"} description={locale === "ko-KR" ? "개요만 보고 자신의 말로 소개하세요." : "只看提纲，用自己的话完成介绍。"} headingLevel={4} titleClassName="text-base font-bold" hintLabel={locale === "ko-KR" ? "녹음 방법 보기" : "查看录音方法"} />{activityCompleted && <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--status-success-surface)] px-3 py-1.5 text-xs font-bold text-[var(--status-success)]" role="status" aria-live="polite"><CheckCircle2 size={14} aria-hidden="true" />{locale === "ko-KR" ? "완료" : "已完成"}</span>}</div><div className="mt-6 flex justify-center"><div className={`flex size-24 items-center justify-center rounded-full ${recorded ? "bg-[var(--status-success-surface)] text-[var(--status-success)]" : "bg-[var(--accent)] text-[var(--primary)]"}`}><Mic size={34} aria-hidden="true" /></div></div><p className="mt-4 text-center text-sm font-bold text-[var(--foreground-secondary)]">{locale === "ko-KR" ? `최소 ${minimumSeconds}초` : `至少 ${minimumSeconds} 秒`} · {locale === "ko-KR" ? "현재" : "当前"} {durationSeconds}{locale === "ko-KR" ? "초" : " 秒"}</p></div><RecordingControl activityId={activity.id} locale={locale} minimumDurationSeconds={minimumSeconds} onReset={() => { setAnswer({ ...objectValue(answer), recorded: false, durationSeconds: 0, recordingEvidenceId: undefined }); setSpeakingReferenceVisible(false); }} onReady={({ durationSeconds: nextDuration, recordingEvidenceId }) => { const nextAnswer = { ...objectValue(answer), recorded: true, durationSeconds: nextDuration, recordingEvidenceId }; setAnswer(nextAnswer); if (nextDuration >= minimumSeconds && selectedCount >= minimumOutlineItems) submit(nextAnswer); }} /></div>
          </div>

          <div className="min-w-0 border-t border-[var(--border-subtle)] bg-[var(--surface-soft)] px-5 py-4 sm:px-7"><div className="flex min-w-0 flex-wrap items-center justify-between gap-4"><div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2 text-sm font-bold"><span className={selectedCount >= minimumOutlineItems ? "text-[var(--status-success)]" : "text-[var(--foreground-secondary)]"}>{selectedCount >= minimumOutlineItems && <CheckCircle2 size={15} className="mr-1.5 inline" aria-hidden="true" />}{locale === "ko-KR" ? "표현 항목" : "表达节点"} {selectedCount}/{outlineItems.length}</span><span className={durationSeconds >= minimumSeconds ? "text-[var(--status-success)]" : "text-[var(--foreground-secondary)]"}>{durationSeconds >= minimumSeconds && <CheckCircle2 size={15} className="mr-1.5 inline" aria-hidden="true" />}{locale === "ko-KR" ? "녹음" : "录音"} {durationSeconds}{locale === "ko-KR" ? "초" : " 秒"}</span><span className={readyToComplete ? "text-[var(--status-success)]" : "text-[var(--foreground-muted)]"}>{activityCompleted ? locale === "ko-KR" ? "완료" : "已完成" : readyToComplete ? locale === "ko-KR" ? "자동 제출 중" : "正在自动提交" : locale === "ko-KR" ? "준비 중" : "尚未达到要求"}</span></div>{recorded && <button type="button" aria-expanded={speakingReferenceVisible} onClick={() => setSpeakingReferenceVisible((visible) => !visible)} className="inline-flex min-h-11 max-w-full items-center gap-2 whitespace-normal rounded-xl px-3 text-left text-sm font-bold text-[var(--foreground-secondary)] hover:bg-[var(--card)] hover:text-[var(--primary)]">{speakingReferenceVisible ? <ChevronUp size={16} className="shrink-0" /> : <ChevronDown size={16} className="shrink-0" />}{speakingReferenceVisible ? locale === "ko-KR" ? "참고 표현 닫기" : "收起参考表达" : locale === "ko-KR" ? "참고 표현 보기" : "查看参考表达"}</button>}</div>{speakingReferenceVisible && <p className="mt-4 max-w-full whitespace-normal rounded-2xl bg-[var(--card)] p-5 font-bold leading-8 text-[var(--foreground)] [overflow-wrap:anywhere] ring-1 ring-[var(--border-subtle)]" lang="ko">{String(activity.config.referenceText ?? "")}</p>}</div>
        </section>;
      })()}

      {activity.type === "speaking" && activity.config.presentation !== "independent_output" && (
        <div>
          <RecordingControl
            activityId={activity.id}
            locale={locale}
            minimumDurationSeconds={Number(activity.config.minimumSeconds ?? 1)}
            onReset={() => setAnswer({ ...objectValue(answer), recorded: false, durationSeconds: 0, recordingEvidenceId: undefined })}
            onReady={({ durationSeconds, recordingEvidenceId }) => setAnswer({ ...objectValue(answer), recorded: true, durationSeconds, recordingEvidenceId })}
          />
          <label className="mt-3 grid max-w-xs gap-2 text-sm font-semibold text-[var(--foreground-secondary)]">{locale === "ko-KR" ? "역할이 바뀐 대화 차례 수" : "双角色交替话轮数"}<input type="number" min={0} max={30} value={Number(objectValue(answer).turns ?? 0)} onChange={(event) => setAnswer({ ...objectValue(answer), turns: Number(event.target.value) })} className="min-h-11 rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] px-3" /></label>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {stringArray(activity.config.criteria).map((label, index) => {
              const selected = asBooleanArray(objectValue(answer).criteria);
              return <label key={label} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-[var(--card)] px-3 py-2 text-sm"><input type="checkbox" checked={selected[index] ?? false} onChange={(event) => { const next = [...selected]; next[index] = event.target.checked; setAnswer({ ...objectValue(answer), criteria: next }); setFeedback(null); }} />{label}</label>;
            })}
          </div>
        </div>
      )}

      {activity.type === "self_check" && (
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.12fr)_minmax(320px,.88fr)]">
          <div className="rounded-[22px] border border-[var(--border-subtle)] bg-[var(--card)] p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3"><h5 className="font-bold text-[var(--foreground)]">{locale === "ko-KR" ? "다섯 가지 능력을 확인하세요" : "逐项确认五项能力"}</h5><span className="text-xs font-bold tabular-nums text-[var(--foreground-muted)]">{stringArray(objectValue(answer).checks).filter(Boolean).length} / {configItems.length}</span></div>
          <div className="relative space-y-3 before:absolute before:bottom-7 before:left-[19px] before:top-7 before:w-px before:bg-[var(--border-strong)]">
          {configItems.map((item, index) => {
            const current = stringArray(objectValue(answer).checks);
            return <fieldset key={String(item.id ?? index)} className="relative grid grid-cols-[40px_minmax(0,1fr)] gap-4"><span className={`z-[1] flex size-10 items-center justify-center rounded-full border-2 text-xs font-bold tabular-nums ${current[index] ? current[index] === "can" ? "border-[var(--status-success)] bg-[var(--status-success-surface)] text-[var(--status-success)]" : "border-[var(--status-warning)] bg-[var(--status-warning-surface)] text-[var(--status-warning)]" : "border-[var(--border-strong)] bg-[var(--card)] text-[var(--foreground-muted)]"}`}>{current[index] === "can" ? <Check size={15} aria-hidden="true" /> : current[index] === "review" ? <RotateCcw size={14} aria-hidden="true" /> : String(index + 1).padStart(2, "0")}</span><div className="min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4"><legend className="text-sm font-bold leading-6 text-[var(--foreground)]">{String(item.label)}</legend><div className="mt-3 grid grid-cols-2 gap-2">{[["can", locale === "ko-KR" ? "할 수 있어요" : "能独立完成"], ["review", locale === "ko-KR" ? "복습이 필요해요" : "需要复习"]].map(([value, label]) => <button key={value} type="button" aria-pressed={current[index] === value} onClick={() => { const next = [...current]; next[index] = value; setAnswer({ ...objectValue(answer), checks: next }); setFeedback(null); }} className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-bold transition ${current[index] === value ? value === "can" ? "border-[var(--status-success)] bg-[var(--status-success-surface)] text-[var(--status-success)]" : "border-[var(--status-warning)] bg-[var(--status-warning-surface)] text-[var(--status-warning)]" : "border-[var(--border-subtle)] bg-[var(--card)] text-[var(--foreground-secondary)] hover:border-[var(--primary)]"}`}>{label}</button>)}</div></div></fieldset>;
          })}
          </div>
          </div>
          <div className="rounded-[22px] border border-[var(--border-subtle)] bg-[var(--card)] p-5 sm:p-6">
          <fieldset><legend className="font-bold text-[var(--foreground)]">{locale === "ko-KR" ? "다음 복습 위치" : "选择下一步复习位置"}</legend><p className="mt-1 text-xs leading-5 text-[var(--foreground-muted)]">{locale === "ko-KR" ? "복습이 필요한 능력과 연결된 학습 위치를 고르세요." : "把需要复习的能力对应到具体板块；可以多选。"}</p><div className="mt-4 grid grid-cols-2 gap-2">{(Array.isArray(activity.config.returnNodes) ? activity.config.returnNodes.map(objectValue) : []).map((item) => { const selected = stringArray(objectValue(answer).returnNodes); const value = String(item.value); return <button key={value} type="button" aria-pressed={selected.includes(value)} onClick={() => { const next = value === "none" ? ["none"] : selected.includes(value) ? selected.filter((entry) => entry !== value) : [...selected.filter((entry) => entry !== "none"), value]; setAnswer({ ...objectValue(answer), returnNodes: next }); setFeedback(null); }} className={`min-h-12 rounded-xl border px-3 py-2 text-sm font-bold transition ${selected.includes(value) ? "border-[var(--primary)] bg-[var(--accent)] text-[var(--primary)]" : "border-[var(--border-subtle)] bg-[var(--surface-soft)] text-[var(--foreground-secondary)] hover:border-[var(--primary)]"}`}>{String(item.label)}</button>; })}</div></fieldset>
          <label className="mt-6 grid gap-2 border-t border-[var(--border-subtle)] pt-5 text-sm font-semibold text-[var(--foreground)]">{locale === "ko-KR" ? "복습 메모 (선택)" : "个人复习备注（可选）"}<textarea rows={5} value={String(objectValue(answer).note ?? "")} onChange={(event) => setAnswer({ ...objectValue(answer), note: event.target.value })} className="resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-3 leading-6 text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]" placeholder={locale === "ko-KR" ? "다음에 다시 볼 내용을 적으세요." : "记录下次重点复习的内容。"} /></label>
          </div>
        </div>
      )}

      {(!usesFocusMode || practiceFocused) && (
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
        <div className="min-h-10 flex-1">
          {message && (
            <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-[var(--destructive)]">
              <span>{message}</span>
              {needsReload && (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="rounded-lg border border-current px-3 py-1.5 text-xs font-bold hover:bg-[var(--destructive)]/5"
                >
                  {t.refreshPage}
                </button>
              )}
            </div>
          )}
          {feedback && (
            <div role={!feedback.ok ? "alert" : undefined} className={`flex items-start gap-2 text-sm leading-6 ${!feedback.ok || feedback.correct === false ? "text-[var(--destructive)]" : "text-[var(--status-success)]"}`}>
              {!feedback.ok || feedback.correct === false ? <RotateCcw size={16} className="mt-1 shrink-0" aria-hidden="true" /> : <CheckCircle2 size={16} className="mt-1 shrink-0" aria-hidden="true" />}
              <span>
                <strong>{!feedback.ok ? t.submitFailed : feedback.correct === false ? t.retry : feedback.correct === null ? t.submittedForReview : t.correct}</strong>
                {" · "}
                {feedback.explanation}
                {feedback.preview || trackingDisabled ? ` · ${t.preview}` : ""}
              </span>
            </div>
          )}
        </div>
        {isPagedChoicePractice && !activePageCheck && <button type="button" onClick={checkGrammarPage} disabled={checkingPage} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-bold text-[var(--primary-foreground)] disabled:opacity-40">{checkingPage ? (locale === "ko-KR" ? "확인 중…" : "检查中…") : (locale === "ko-KR" ? "정답 확인" : "检查答案")}</button>}
        {isPagedChoicePractice && activePageCheck && !activePageCheck.results.every(Boolean) && !activePageCheck.revealed && <button type="button" onClick={revealGrammarAnswers} className="inline-flex shrink-0 items-center justify-center rounded-xl border border-[var(--primary)] px-5 py-2.5 text-sm font-bold text-[var(--primary)]">{locale === "ko-KR" ? "정답 보기" : "查看答案"}</button>}
        {(!isPagedChoicePractice || ((isListeningQuiz || isLastGrammarActivity) && isLastGrammarPracticePage && activePageReady)) && <button type="button" onClick={() => submit()} disabled={pending || hasPendingAudio || activityCompleted} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-bold text-[var(--primary-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto">
          {pending ? <Pause size={15} /> : activityCompleted ? <CheckCircle2 size={15} /> : <Send size={15} />} {activityCompleted ? t.submitted : usesExpressionPath ? locale === "ko-KR" ? "순서 확인" : "检查顺序" : t.submit}
        </button>}
      </div>
      )}
      </div>
    </section>
  );
}

export function SmartTextbookShell({ backHref, textbook, trackingDisabled, completionHref, completionLabel, previewScriptVersionId, previewStartNodeKey, previewStartModuleIndex, previewOpeningBufferLine, previewOpeningBufferSpeechAssetId }: SmartTextbookShellProps) {
  const isPreviewMode = Boolean(previewScriptVersionId);
  const textbookRef = useRef<HTMLDivElement>(null);
  const tutorWindowRef = useRef<HTMLDivElement>(null);
  const tutorAnswerDialogRef = useRef<HTMLElement>(null);
  const tutorContinueButtonRef = useRef<HTMLButtonElement>(null);
  const tutorAnswerWasOpenRef = useRef(false);
  const tutorDragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const tutorAudioRef = useRef<HTMLAudioElement | null>(null);
  const tutorSpeechPlaybackRef = useRef<{ text: string; manifest: TutorSpeechManifest } | null>(null);
  const tutorRequestAbortRef = useRef<AbortController | null>(null);
  const tutorPausedRef = useRef(false);
  const tutorSessionIdsByModuleRef = useRef<Record<string, string>>(
    Object.fromEntries(Object.entries(textbook.activeTeachingSessions).map(([moduleId, session]) => [moduleId, session.id])),
  );
  const tutorVisitedModuleIdsRef = useRef(new Set(Object.keys(textbook.activeTeachingSessions)));
  const tutorCompanionTrackingFrameRef = useRef<number | null>(null);
  const textbookViewStateKey = `smart-textbook-view:${textbook.id}`;
  const [activeIndex, setActiveIndex] = useState(() => (isPreviewMode && typeof previewStartModuleIndex === "number"
    ? Math.max(0, Math.min(textbook.modules.length - 1, previewStartModuleIndex))
    : 0));
  const [missionPage, setMissionPage] = useState<0 | 1 | 2 | 3>(0);
  const [patternPage, setPatternPage] = useState<0 | 1 | 2>(0);
  const [activeGrammarPracticeIndex, setActiveGrammarPracticeIndex] = useState(0);
  const [locale, setLocale] = useState<SmartLocale>(textbook.preference.locale);
  const [supportMode, setSupportMode] = useState<SmartSupportMode>(textbook.preference.supportMode);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [teachingAreaCollapsed, setTeachingAreaCollapsed] = useState(false);
  const [assistantCollapsed, setAssistantCollapsed] = useState(true);
  const [tutorWindowPosition, setTutorWindowPosition] = useState<{ x: number; y: number } | null>(null);
  const [mobilePanel, setMobilePanel] = useState<"path" | "assistant" | null>(null);
  const [completedNodeIds, setCompletedNodeIds] = useState<Set<string>>(
    () =>
      new Set(
        textbook.progress
          .filter(
            (item) =>
              item.status === "completed" && item.completionPercent === 100,
          )
          .map((item) => item.nodeId),
      ),
  );
  const [nodeProgressById, setNodeProgressById] = useState<Record<string, number>>(
    () => Object.fromEntries(textbook.progress.map((item) => [item.nodeId, item.completionPercent])),
  );
  const [savedActivityResponses, setSavedActivityResponses] = useState<Record<string, AnswerValue>>(() =>
    Object.fromEntries(textbook.modules.flatMap((module) => module.nodes).flatMap((node) => node.activities).filter((activity) => activity.completed && activity.response !== null).map((activity) => [activity.id, activity.response])),
  );
  const [tutorText, setTutorText] = useState("");
  const [tutorTextRich, setTutorTextRich] = useState<RichChar[] | null>(null);
  const [tutorDisplay, setTutorDisplay] = useState<TutorDisplay | null>(null);
  const [tutorTask, setTutorTask] = useState<TutorTask | null>(null);
  const [tutorCharacter, setTutorCharacter] = useState<TutorCharacter | null>();
  const [tutorTaskCompleted, setTutorTaskCompleted] = useState(false);
  const [tutorInput, setTutorInput] = useState("");
  const [tutorSessionId, setTutorSessionId] = useState<string | undefined>(
    () => tutorSessionIdsByModuleRef.current[textbook.modules[0]?.id ?? ""],
  );
  const [tutorHasPreviousSession, setTutorHasPreviousSession] = useState(
    () => tutorVisitedModuleIdsRef.current.has(textbook.modules[0]?.id ?? ""),
  );
  const [tutorStarted, setTutorStarted] = useState(false);
  const [tutorPaused, setTutorPaused] = useState(false);
  const [tutorStatus, setTutorStatus] = useState<"idle" | "thinking" | "streaming" | "error">("idle");
  const [tutorQuestionOptions, setTutorQuestionOptions] = useState<string[]>([]);
  const [tutorInteraction, setTutorInteraction] = useState<TutorInteraction | null>(null);
  const [tutorAwaitingAnswer, setTutorAwaitingAnswer] = useState(false);
  const [tutorSelectedAnswer, setTutorSelectedAnswer] = useState("");
  const [tutorAnswerCorrect, setTutorAnswerCorrect] = useState<boolean | null>(null);
  const [tutorContinueLabel, setTutorContinueLabel] = useState("");
  const [tutorNextBufferLine, setTutorNextBufferLine] = useState<string | null>(() => {
    const initialLocale = textbook.preference.locale;
    if (previewScriptVersionId) {
      return previewOpeningBufferLine?.[initialLocale] ?? previewOpeningBufferLine?.["zh-CN"] ?? "";
    }
    const initialModule = textbook.modules[previewStartModuleIndex ?? 0];
    const resumedBufferLine = textbook.activeTeachingSessions[initialModule?.id ?? ""]?.bufferLine;
    return resumedBufferLine?.[initialLocale]
      ?? resumedBufferLine?.["zh-CN"]
      ?? initialModule?.openingBufferLine[initialLocale]
      ?? initialModule?.openingBufferLine["zh-CN"]
      ?? "";
  });
  const [tutorActiveBufferLine, setTutorActiveBufferLine] = useState<string | null>(null);
  const [tutorNextBufferSpeechAssetId, setTutorNextBufferSpeechAssetId] = useState<string | null>(() => {
    const initialLocale = textbook.preference.locale;
    if (previewScriptVersionId) {
      return previewOpeningBufferSpeechAssetId?.[initialLocale]
        ?? previewOpeningBufferSpeechAssetId?.["zh-CN"]
        ?? null;
    }
    const initialModule = textbook.modules[previewStartModuleIndex ?? 0];
    const sessionAssetIds = textbook.activeTeachingSessions[initialModule?.id ?? ""]?.bufferSpeechAssetId;
    return sessionAssetIds?.[initialLocale]
      ?? sessionAssetIds?.["zh-CN"]
      ?? initialModule?.openingBufferSpeechAssetId[initialLocale]
      ?? initialModule?.openingBufferSpeechAssetId["zh-CN"]
      ?? null;
  });
  const [tutorAutoContinue, setTutorAutoContinue] = useState(false);
  const tutorAutoContinuingRef = useRef(false);
  const [tutorTerminal, setTutorTerminal] = useState(false);
  const [tutorAction, setTutorAction] = useState<string | null>(null);
  const [tutorSpeechStatus, setTutorSpeechStatus] = useState<TutorSpeechStatus>("idle");
  const [tutorSpeechMuted, setTutorSpeechMuted] = useState(false);
  const [tutorBubbleVisible, setTutorBubbleVisible] = useState(false);
  const tutorBubbleHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tutorCompanion, setTutorCompanion] = useState<TutorCompanionPosition | null>(null);
  const [ahanIdleVisible, setAhanIdleVisible] = useState(false);
  const [learningAreaManuallyHidden, setLearningAreaManuallyHidden] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [preferenceError, setPreferenceError] = useState("");
  const [preferenceNeedsReload, setPreferenceNeedsReload] = useState(false);
  const [viewStateReady, setViewStateReady] = useState(false);
  const [isPending, startTransition] = useTransition();
  const activeModule = textbook.modules[activeIndex];
  const activeSessionBufferLine = textbook.activeTeachingSessions[activeModule?.id ?? ""]?.bufferLine;
  const activeOpeningBufferLine = isPreviewMode
    ? previewOpeningBufferLine?.[locale] || previewOpeningBufferLine?.["zh-CN"] || ""
    : activeSessionBufferLine?.[locale]
      || activeSessionBufferLine?.["zh-CN"]
      || activeModule?.openingBufferLine[locale]
      || activeModule?.openingBufferLine["zh-CN"]
      || "";
  const activeOpeningBufferSpeechAssetId = isPreviewMode
    ? previewOpeningBufferSpeechAssetId?.[locale] || previewOpeningBufferSpeechAssetId?.["zh-CN"] || null
    : activeSessionBufferLine
      ? activeSessionBufferLine && (textbook.activeTeachingSessions[activeModule?.id ?? ""]?.bufferSpeechAssetId[locale]
        || textbook.activeTeachingSessions[activeModule?.id ?? ""]?.bufferSpeechAssetId["zh-CN"]
        || null)
      : activeModule?.openingBufferSpeechAssetId[locale]
        || activeModule?.openingBufferSpeechAssetId["zh-CN"]
        || null;
  const activeNodes = activeModule?.nodes ?? [];
  const t = ui[locale];
  const agentName = textbook.agent?.displayName[locale]
    || textbook.agent?.displayName["zh-CN"]
    || t.tutor;
  const agentDescription = textbook.agent?.description[locale] || t.grounded;
  const accent = accentMap[activeModule?.accent ?? "sky"];
  const chapterLabel = locale === "ko-KR"
    ? `제${textbook.chapter.number}장`
    : `第 ${textbook.chapter.number} 章`;
  const sidebarLabel = locale === "ko-KR"
    ? textbook.chapter.number === 0 ? "과정 학습 경로" : "장 학습 경로"
    : textbook.chapter.number === 0 ? "课程导航" : "章节导航";

  function recordCompletion(result: {
    nodeId: string | null;
    nodeCompleted: boolean;
    completionPercent: number;
    preview: boolean;
  }) {
    if (!result.preview && result.nodeId) {
      setNodeProgressById((current) => ({
        ...current,
        [result.nodeId as string]: Math.max(0, Math.min(100, result.completionPercent)),
      }));
    }
    if (isServerConfirmedNodeCompletion(result)) {
      const completedNodeId = result.nodeId;
      setCompletedNodeIds((current) => new Set(current).add(completedNodeId));
    }
  }

  const moduleDone = (moduleIndex: number) => {
    return isSmartTextbookModuleCompleted(
      textbook.modules[moduleIndex],
      completedNodeIds,
    );
  };
  const completeCount = textbook.modules.filter((_, index) => moduleDone(index)).length;
  const progressPercent = Math.round((completeCount / Math.max(textbook.modules.length, 1)) * 100);
  const chapterTestHref = textbook.chapter.chapterTestSlug
    ? `/dashboard/assignments/korean/${encodeURIComponent(textbook.chapter.chapterTestSlug)}`
    : null;
  const isLastModule = activeIndex === textbook.modules.length - 1;
  const tutorSpeechInProgress = tutorSpeechStatus === "loading"
    || tutorSpeechStatus === "playing"
    || tutorSpeechStatus === "paused";
  const tutorContinueReady = tutorStarted
    && !tutorTerminal
    && !tutorPaused
    && tutorStatus !== "thinking"
    && tutorStatus !== "streaming"
    && !tutorSpeechInProgress
    && !tutorAwaitingAnswer
    && !(tutorTask?.required && !tutorTaskCompleted);
  useEffect(() => {
    if (!isPreviewMode || !tutorAutoContinue || !tutorContinueReady || tutorAutoContinuingRef.current) return;
    tutorAutoContinuingRef.current = true;
    void tutorReply("ready");
  }, [isPreviewMode, tutorAutoContinue, tutorContinueReady]);
  const tutorIsSpeakingNow = tutorStatus === "thinking"
    || tutorStatus === "streaming"
    || tutorSpeechStatus === "loading"
    || tutorSpeechStatus === "playing";
  useEffect(() => {
    if (tutorIsSpeakingNow) {
      if (tutorBubbleHideTimerRef.current) {
        clearTimeout(tutorBubbleHideTimerRef.current);
        tutorBubbleHideTimerRef.current = null;
      }
      setTutorBubbleVisible(true);
      return;
    }
    if (tutorSpeechStatus === "paused" || !tutorBubbleVisible) return;
    tutorBubbleHideTimerRef.current = setTimeout(() => {
      setTutorBubbleVisible(false);
      tutorBubbleHideTimerRef.current = null;
    }, 3000);
    return () => {
      if (tutorBubbleHideTimerRef.current) {
        clearTimeout(tutorBubbleHideTimerRef.current);
        tutorBubbleHideTimerRef.current = null;
      }
    };
  }, [tutorIsSpeakingNow, tutorSpeechStatus, tutorBubbleVisible]);
  const showTutorAnswerDialog = tutorStarted
    && !tutorPaused
    && tutorAwaitingAnswer
    && tutorQuestionOptions.length > 0
    && !tutorSpeechInProgress;
  const tutorFocusMode = shouldUseSmartTextbookTeachingFocusMode({
    tutorStarted,
    answerRequired: showTutorAnswerDialog,
    action: tutorAction,
    hasPendingLearningTask: Boolean(tutorTask && !tutorTaskCompleted),
  });
  const learningAreaHidden = tutorFocusMode || learningAreaManuallyHidden;
  const teachingAreaExpanded = learningAreaHidden;
  const learningHeaderNode = activeNodes[0];
  const learningHeaderSkeleton = activeModule ? getSmartTextbookSkeletonModule(activeModule.code) : null;
  const learningHeaderUsesPatterns = Boolean(learningHeaderNode && activeModule?.code === "patterns" && learningHeaderNode.activities.some((activity) => activity.type === "ordering"));
  const learningHeaderHasDialogueRoleplay = Boolean(learningHeaderNode?.activities.some((activity) => activity.key === "dialogue-roleplay"));
  const learningHeaderHasPager = Boolean(learningHeaderNode
    && learningHeaderNode.activities.length > 0
    && learningHeaderSkeleton);
  const learningHeaderSkeletonTargets = learningHeaderHasPager
    ? getSmartTextbookSkeletonPageLabels(activeModule.code, locale)
    : [];
  const learningHeaderTargets = activeModule.code === "dialogue" && !learningHeaderHasDialogueRoleplay
    ? learningHeaderSkeletonTargets.slice(0, -1)
    : learningHeaderSkeletonTargets;
  const learningHeaderTargetIndex = learningHeaderUsesPatterns ? patternPage : missionPage;
  const learningHeaderCurrentTargetIndex = Math.max(0, Math.min(learningHeaderTargetIndex, Math.max(learningHeaderTargets.length - 1, 0)));
  const learningHeaderCompletionPercent = learningHeaderNode
    ? completedNodeIds.has(learningHeaderNode.id)
      ? 100
      : Math.max(0, Math.min(100, nodeProgressById[learningHeaderNode.id] ?? 0))
    : 0;

  useEffect(() => {
    if (isPreviewMode) {
      setViewStateReady(true);
      return;
    }
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(textbookViewStateKey) ?? "null") as { activeIndex?: number; missionPage?: number; patternPage?: number } | null;
      if (saved && Number.isInteger(saved.activeIndex) && Number(saved.activeIndex) >= 0 && Number(saved.activeIndex) < textbook.modules.length) {
        setActiveIndex(Number(saved.activeIndex));
        if ([0, 1, 2, 3].includes(Number(saved.missionPage))) setMissionPage(Number(saved.missionPage) as 0 | 1 | 2 | 3);
        if ([0, 1, 2].includes(Number(saved.patternPage))) setPatternPage(Number(saved.patternPage) as 0 | 1 | 2);
      }
    } catch {
      window.sessionStorage.removeItem(textbookViewStateKey);
    }
    setViewStateReady(true);
  }, [isPreviewMode, textbook.modules.length, textbookViewStateKey]);

  useEffect(() => {
    if (!viewStateReady || isPreviewMode) return;
    window.sessionStorage.setItem(textbookViewStateKey, JSON.stringify({ activeIndex, missionPage, patternPage }));
  }, [activeIndex, isPreviewMode, missionPage, patternPage, textbookViewStateKey, viewStateReady]);

  useEffect(() => {
    tutorRequestAbortRef.current?.abort();
    tutorRequestAbortRef.current = null;
    tutorPausedRef.current = false;
    tutorAudioRef.current?.pause();
    tutorAudioRef.current = null;
    tutorSpeechPlaybackRef.current = null;
    setTutorSpeechStatus("idle");
    setTutorText("");
    setTutorTextRich(null);
    setTutorDisplay(null);
    setTutorTask(null);
    setTutorCharacter(undefined);
    setTutorTaskCompleted(false);
    setTutorInput("");
    const savedTutorSessionId = tutorSessionIdsByModuleRef.current[activeModule?.id ?? ""];
    setTutorSessionId(savedTutorSessionId);
    setTutorHasPreviousSession(tutorVisitedModuleIdsRef.current.has(activeModule?.id ?? ""));
    setTutorStarted(false);
    setTutorPaused(false);
    setTutorStatus("idle");
    setTutorQuestionOptions([]);
    setTutorInteraction(null);
    setTutorAwaitingAnswer(false);
    setTutorSelectedAnswer("");
    setTutorAnswerCorrect(null);
    setTutorContinueLabel("");
    setTutorNextBufferLine(activeOpeningBufferLine);
    setTutorNextBufferSpeechAssetId(activeOpeningBufferSpeechAssetId);
    setTutorTerminal(false);
    setTutorAction(null);
    setLearningAreaManuallyHidden(false);
  }, [activeModule?.id]);

  useEffect(() => {
    if (tutorAudioRef.current) tutorAudioRef.current.muted = tutorSpeechMuted;
  }, [tutorSpeechMuted]);

  useEffect(() => () => {
    tutorRequestAbortRef.current?.abort();
    tutorAudioRef.current?.pause();
    window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    if (!showTutorAnswerDialog) {
      if (!tutorAnswerWasOpenRef.current) return;
      tutorAnswerWasOpenRef.current = false;
      const returnFocusFrame = window.requestAnimationFrame(() => tutorContinueButtonRef.current?.focus());
      return () => window.cancelAnimationFrame(returnFocusFrame);
    }
    tutorAnswerWasOpenRef.current = true;
    const frame = window.requestAnimationFrame(() => {
      tutorAnswerDialogRef.current
        ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
        ?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [showTutorAnswerDialog, tutorQuestionOptions.length]);

  function localize(value: { "zh-CN": string; "ko-KR": string }) {
    return value[locale];
  }

  function selectModule(index: number) {
    setMissionPage(0);
    setPatternPage(0);
    setActiveGrammarPracticeIndex(0);
    setActiveIndex(index);
  }

  function savePreference(nextLocale: SmartLocale, nextSupport: SmartSupportMode) {
    const previousLocale = locale;
    const previousSupportMode = supportMode;
    setLocale(nextLocale);
    setSupportMode(nextSupport);
    setPreferenceError("");
    setPreferenceNeedsReload(false);
    startTransition(async () => {
      try {
        const result = await saveSmartTextbookPreferenceAction({
          textbookId: textbook.id,
          locale: nextLocale,
          supportMode: nextSupport,
        });
        if (!result.ok) {
          setLocale(previousLocale);
          setSupportMode(previousSupportMode);
          setPreferenceError(result.message);
        }
      } catch (error) {
        setLocale(previousLocale);
        setSupportMode(previousSupportMode);
        const staleAction = isStaleServerActionError(error);
        setPreferenceNeedsReload(staleAction);
        setPreferenceError(staleAction ? ui[nextLocale].pageUpdated : ui[nextLocale].requestFailed);
      }
    });
  }

  function stopTutorSpeech(nextStatus: TutorSpeechStatus = "idle") {
    const audio = tutorAudioRef.current;
    if (audio) {
      audio.onpause = null;
      audio.onplaying = null;
      audio.ontimeupdate = null;
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
    }
    tutorAudioRef.current = null;
    setTutorSpeechStatus(nextStatus);
  }

  function playTutorSpeech(text: string, manifest: TutorSpeechManifest) {
    stopTutorSpeech("loading");
    tutorSpeechPlaybackRef.current = { text, manifest };
    const audio = new Audio(manifest.audioUrl);
    audio.preload = "auto";
    audio.muted = tutorSpeechMuted;
    tutorAudioRef.current = audio;
    audio.ontimeupdate = () => {
      const currentMs = audio.currentTime * 1000;
      const activeCue = manifest.cues.findLast((cue) => cue.startMs <= currentMs);
      const linearCharacterEnd = Math.round((currentMs / Math.max(manifest.durationMs, 1)) * text.length);
      const characterEnd = activeCue?.charEnd ?? linearCharacterEnd;
      setTutorText(text.slice(0, Math.max(0, Math.min(text.length, characterEnd))));
    };
    audio.onplaying = () => setTutorSpeechStatus("playing");
    audio.onpause = () => {
      if (!audio.ended) setTutorSpeechStatus("paused");
    };
    audio.onended = () => {
      setTutorText(text);
      setTutorSpeechStatus("ended");
    };
    audio.onerror = () => {
      setTutorText(text);
      setTutorSpeechStatus("error");
    };
    if (tutorPausedRef.current) {
      setTutorText(text);
      setTutorSpeechStatus("paused");
    } else {
      void audio.play().catch(() => setTutorSpeechStatus("paused"));
    }
  }

  function playTutorBufferSpeech(text: string, manifest: TutorSpeechManifest) {
    return new Promise<void>((resolve) => {
      stopTutorSpeech("loading");
      const audio = new Audio(manifest.audioUrl);
      audio.preload = "auto";
      audio.muted = tutorSpeechMuted;
      tutorAudioRef.current = audio;
      const finish = (status: TutorSpeechStatus) => {
        setTutorText(text);
        setTutorSpeechStatus(status);
        resolve();
      };
      audio.ontimeupdate = () => {
        const currentMs = audio.currentTime * 1000;
        const activeCue = manifest.cues.findLast((cue) => cue.startMs <= currentMs);
        setTutorText(text.slice(0, activeCue?.charEnd ?? text.length));
      };
      audio.onplaying = () => setTutorSpeechStatus("playing");
      audio.onended = () => finish("ended");
      audio.onerror = () => finish("error");
      void audio.play().catch(() => finish("error"));
    });
  }

  function toggleTutorSpeech() {
    const audio = tutorAudioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => setTutorSpeechStatus("paused"));
    else audio.pause();
  }

  function replayTutorSpeech() {
    const playback = tutorSpeechPlaybackRef.current;
    if (!playback) return;
    setTutorText("");
    setTutorTextRich(null);
    playTutorSpeech(playback.text, playback.manifest);
  }

  function pauseTutorLesson() {
    if (!tutorStarted || tutorPaused) return;
    tutorPausedRef.current = true;
    setTutorPaused(true);
    if (tutorAudioRef.current && !tutorAudioRef.current.paused) tutorAudioRef.current.pause();
    window.speechSynthesis?.pause();
  }

  function resumeTutorLesson() {
    if (!tutorStarted || !tutorPaused) return;
    tutorPausedRef.current = false;
    setTutorPaused(false);
    const audio = tutorAudioRef.current;
    if (audio?.paused && !audio.ended) {
      void audio.play().catch(() => setTutorSpeechStatus("paused"));
    }
    window.speechSynthesis?.resume();
  }

  function exitTutorLesson() {
    tutorRequestAbortRef.current?.abort();
    tutorRequestAbortRef.current = null;
    tutorPausedRef.current = false;
    stopTutorSpeech("idle");
    tutorSpeechPlaybackRef.current = null;
    window.speechSynthesis?.cancel();
    setTutorText("");
    setTutorTextRich(null);
    setTutorDisplay(null);
    setTutorTask(null);
    setTutorCharacter(undefined);
    setTutorTaskCompleted(false);
    setTutorInput("");
    setTutorStarted(false);
    setTutorPaused(false);
    setTutorStatus("idle");
    setTutorQuestionOptions([]);
    setTutorInteraction(null);
    setTutorAwaitingAnswer(false);
    setTutorSelectedAnswer("");
    setTutorAnswerCorrect(null);
    setTutorContinueLabel("");
    setTutorNextBufferLine(activeOpeningBufferLine);
    setTutorNextBufferSpeechAssetId(activeOpeningBufferSpeechAssetId);
    setTutorTerminal(false);
    setTutorAction(null);
    setLearningAreaManuallyHidden(false);
  }

  async function tutorReply(
    intent: "explain" | "hint" | "example" | "roleplay" | "ask" | "ready" | "answer",
    answer?: string,
    restart = false,
    bufferLineOverride?: string,
    bufferSpeechAssetOverride?: string | null,
  ) {
    if (tutorPaused || tutorStatus === "thinking" || tutorStatus === "streaming") return;
    const requestIntent = intent === "explain" ? "start" : intent === "roleplay" ? "example" : intent;
    if (!textbook.agent) {
      setTutorStatus("error");
      setTutorText(locale === "ko-KR" ? "이 교재에 연결된 과정 선생님이 아직 없습니다." : "本教材尚未绑定课程老师。");
      return;
    }
    if (isPreviewMode && intent === "ask") {
      setTutorText(locale === "ko-KR" ? "미리보기 모드에서는 자유 질문을 지원하지 않습니다." : "预览模式不支持自由提问，仅用于走查已编排的教学流程。");
      return;
    }
    const message = intent === "ask" ? tutorInput.trim() : undefined;
    if (intent === "ask" && !message) {
      setTutorText(locale === "ko-KR" ? "궁금한 내용을 먼저 입력해 주세요." : "请先输入不明白的地方。");
      return;
    }

    setTutorStatus("thinking");
    setTutorText("");
    setTutorTextRich(null);
    stopTutorSpeech("idle");
    tutorSpeechPlaybackRef.current = null;
    window.speechSynthesis?.cancel();
    if (intent !== "answer") {
      setTutorSelectedAnswer("");
      setTutorAnswerCorrect(null);
    }
    if (intent === "ask") setTutorInput("");
    const requestAbortController = new AbortController();
    tutorRequestAbortRef.current?.abort();
    tutorRequestAbortRef.current = requestAbortController;
    const requestedBufferSpeechAssetId = bufferSpeechAssetForRequest(
      bufferSpeechAssetOverride,
      tutorNextBufferSpeechAssetId,
    );
    const activeBufferLine = requestIntent === "start" || intent === "ready"
      ? bufferLineForRequest(bufferLineOverride, tutorNextBufferLine, locale)
      : null;
    setTutorActiveBufferLine(activeBufferLine);
    let bufferSpeechDone: Promise<void> = Promise.resolve();
    let bufferSpeechActive = false;
    if (activeBufferLine && teachingAreaCharacter?.kind === "uply-teacher" && !tutorPausedRef.current) {
      bufferSpeechActive = true;
      setTutorSpeechStatus("loading");
      const browserSpeechFallback = () => new Promise<void>((resolve) => {
        const finish = () => {
          bufferSpeechActive = false;
          resolve();
        };
        requestAbortController.signal.addEventListener("abort", finish, { once: true });
        speakTutorCharacterLine(
          activeBufferLine,
          teachingAreaCharacter,
          (status) => {
            setTutorSpeechStatus(status === "playing" ? "playing" : "idle");
            if (status !== "playing") finish();
          },
          (revealedText) => setTutorText(revealedText),
        );
      });
      bufferSpeechDone = requestedBufferSpeechAssetId
        ? fetch(`/api/learning-agent/speech/${encodeURIComponent(requestedBufferSpeechAssetId)}`, {
            signal: requestAbortController.signal,
          })
            .then(async (speechResponse) => {
              if (!speechResponse.ok) throw new Error("buffer speech unavailable");
              const manifest = await speechResponse.json() as TutorSpeechManifest;
              await playTutorBufferSpeech(activeBufferLine, manifest);
            })
            .catch(() => requestAbortController.signal.aborted ? undefined : browserSpeechFallback())
            .then(() => { bufferSpeechActive = false; })
        : browserSpeechFallback();
    }
    try {
      const response = isPreviewMode
        ? await fetch("/api/learning-agent/preview-respond", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: requestAbortController.signal,
            body: JSON.stringify({
              scriptVersionId: previewScriptVersionId,
              sessionToken: tutorSessionId,
              restart,
              intent: requestIntent,
              locale,
              answer,
              startNodeKey: previewStartNodeKey,
            }),
          })
        : await fetch("/api/learning-agent/respond", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: requestAbortController.signal,
            body: JSON.stringify({
              textbookId: textbook.id,
              moduleId: activeModule.id,
              agentCode: textbook.agent.code,
              sessionId: tutorSessionId,
              restart,
              intent: requestIntent,
              locale,
              supportMode,
              message,
              answer,
            }),
          });
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null) as { error?: unknown } | null;
        throw new Error(typeof payload?.error === "string" ? payload.error : (locale === "ko-KR" ? `${agentName}이 응답하지 않았습니다.` : `${agentName}暂时没有响应。`));
      }

      const nextSessionId = response.headers.get("X-Learning-Agent-Session");
      if (nextSessionId) {
        tutorSessionIdsByModuleRef.current[activeModule.id] = nextSessionId;
        tutorVisitedModuleIdsRef.current.add(activeModule.id);
        setTutorSessionId(nextSessionId);
        setTutorHasPreviousSession(true);
      }
      const action = response.headers.get("X-Learning-Agent-Action");
      setTutorAction(action);
      const targetActivityId = response.headers.get("X-Learning-Agent-Target-Activity");
      const encodedOptions = response.headers.get("X-Learning-Agent-Question-Options");
      const encodedDisplay = response.headers.get("X-Learning-Agent-Display");
      const encodedTask = response.headers.get("X-Learning-Agent-Task");
      const encodedVisualCue = response.headers.get("X-Learning-Agent-Visual-Cue");
      const encodedInteraction = response.headers.get("X-Learning-Agent-Interaction");
      const encodedCharacter = response.headers.get("X-Learning-Agent-Character");
      const encodedScriptRich = response.headers.get("X-Learning-Agent-Script-Rich");
      try {
        const decodedScriptRich = encodedScriptRich ? JSON.parse(decodeURIComponent(encodedScriptRich)) : null;
        setTutorTextRich(Array.isArray(decodedScriptRich) ? decodedScriptRich as RichChar[] : null);
      } catch {
        setTutorTextRich(null);
      }
      let nextCharacter: TutorCharacter | null = null;
      let speechManifestPromise: Promise<TutorSpeechManifest | null> | null = null;
      let nextOptions: string[] = [];
      try {
        const decoded = encodedOptions ? JSON.parse(decodeURIComponent(encodedOptions)) : [];
        nextOptions = Array.isArray(decoded) ? decoded.filter((option): option is string => typeof option === "string") : [];
      } catch {
        nextOptions = [];
      }
      setTutorQuestionOptions(nextOptions);
      try {
        const decodedInteraction = encodedInteraction ? JSON.parse(decodeURIComponent(encodedInteraction)) : null;
        setTutorInteraction(decodedInteraction && typeof decodedInteraction === "object" && !Array.isArray(decodedInteraction)
          ? decodedInteraction as TutorInteraction
          : null);
      } catch {
        setTutorInteraction(null);
      }
      try {
        const decodedDisplay = encodedDisplay ? JSON.parse(decodeURIComponent(encodedDisplay)) : null;
        setTutorDisplay(decodedDisplay && typeof decodedDisplay === "object" && !Array.isArray(decodedDisplay) ? decodedDisplay as TutorDisplay : null);
      } catch {
        setTutorDisplay(null);
      }
      try {
        const decodedTask = encodedTask ? JSON.parse(decodeURIComponent(encodedTask)) : null;
        setTutorTask(decodedTask && typeof decodedTask === "object" && !Array.isArray(decodedTask) ? decodedTask as TutorTask : null);
      } catch {
        setTutorTask(null);
      }
      try {
        const decodedCharacter = encodedCharacter ? JSON.parse(decodeURIComponent(encodedCharacter)) : null;
        nextCharacter = decodedCharacter && typeof decodedCharacter === "object" && !Array.isArray(decodedCharacter)
          ? decodedCharacter as TutorCharacter
          : null;
        setTutorCharacter(nextCharacter);
      } catch {
        setTutorCharacter(null);
      }
      // Mark speech as pending as soon as we know this character might speak
      // at all — before the stream-reading loop below has any chance to flip
      // tutorStatus to "idle". Setting this only inside the speechAssetId
      // branch left a gap for lines with no cached audio yet: tutorStatus
      // would go idle while tutorSpeechStatus was still stuck on "idle" (its
      // resting state), so the auto-continue preview toggle read that as
      // "nothing is playing" and advanced before the browser's fallback
      // narration (spoken later, once completeTutorText is known) ever
      // started. speakTutorCharacterLine() below corrects this to "ended"
      // immediately if it turns out there's nothing to say after all.
      if (nextCharacter?.kind === "uply-teacher" && nextCharacter?.voiceEnabled !== false && !bufferSpeechActive) {
        setTutorSpeechStatus("loading");
      }
      if (nextCharacter?.speechAssetId) {
        speechManifestPromise = fetch(`/api/learning-agent/speech/${encodeURIComponent(nextCharacter.speechAssetId)}`, {
          cache: "no-store",
          signal: requestAbortController.signal,
        })
          .then(async (speechResponse) => speechResponse.ok
            ? parseTutorSpeechManifest(await speechResponse.json())
            : null)
          .catch(() => null);
      }
      try {
        const decodedVisualCue = encodedVisualCue ? JSON.parse(decodeURIComponent(encodedVisualCue)) : null;
        runTutorVisualCue(decodedVisualCue && typeof decodedVisualCue === "object" && !Array.isArray(decodedVisualCue)
          ? decodedVisualCue as TutorVisualCue
          : null);
      } catch {
        // A malformed optional cue must never block the teacher response.
      }
      const nextTutorTaskCompleted = response.headers.get("X-Learning-Agent-Task-Completed") === "true";
      setTutorTaskCompleted(nextTutorTaskCompleted);
      const nextTutorAwaitingAnswer = response.headers.get("X-Learning-Agent-Awaiting-Answer") === "true";
      if (action === SMART_TEXTBOOK_SHARED_LEARNING_LAYOUT.focusMode.revealForActivityAction
        || nextTutorAwaitingAnswer
        || Boolean(encodedTask && !nextTutorTaskCompleted)) {
        setLearningAreaManuallyHidden(false);
      }
      const answerResult = response.headers.get("X-Learning-Agent-Answer-Correct");
      setTutorAnswerCorrect(answerResult === null ? null : answerResult === "true");
      setTutorTerminal(response.headers.get("X-Learning-Agent-Terminal") === "true");
      const encodedContinueLabel = response.headers.get("X-Learning-Agent-Continue-Label");
      setTutorContinueLabel(encodedContinueLabel ? decodeURIComponent(encodedContinueLabel) : "");
      const encodedBufferLine = response.headers.get("X-Learning-Agent-Buffer-Line");
      if (requestIntent === "start" || intent === "ready") {
        setTutorNextBufferLine(encodedBufferLine === null ? null : decodeURIComponent(encodedBufferLine));
        setTutorNextBufferSpeechAssetId(response.headers.get("X-Learning-Agent-Buffer-Speech-Asset"));
      }
      tutorAutoContinuingRef.current = false;
      setTutorAutoContinue(isPreviewMode && response.headers.get("X-Learning-Agent-Auto-Continue") === "true");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let completeTutorText = "";
      setTutorStatus("streaming");
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) {
          completeTutorText += chunk;
          if (!speechManifestPromise && nextCharacter?.kind !== "uply-teacher") setTutorText((current) => current + chunk);
        }
      }
      const finalChunk = decoder.decode();
      if (finalChunk) {
        completeTutorText += finalChunk;
        if (!speechManifestPromise && nextCharacter?.kind !== "uply-teacher") setTutorText((current) => current + finalChunk);
      }
      setTutorAwaitingAnswer(nextTutorAwaitingAnswer);
      const speechManifest = await speechManifestPromise;
      await bufferSpeechDone;
      if (requestAbortController.signal.aborted) return;
      // Re-arm "loading" right before flipping tutorStatus idle: the buffer
      // line's own onend handler already reset tutorSpeechStatus to "idle"
      // once it finished, so without this the same gap the comment above
      // describes reopens right here for every reply that plays a buffer line.
      if (speechManifest || (nextCharacter?.kind === "uply-teacher" && nextCharacter?.voiceEnabled !== false)) {
        setTutorSpeechStatus("loading");
      }
      setTutorActiveBufferLine(null);
      setTutorStatus("idle");
      if (speechManifest) {
        playTutorSpeech(completeTutorText, speechManifest);
      } else {
        if (nextCharacter?.speechAssetId) setTutorSpeechStatus("error");
        if (nextCharacter?.kind === "uply-teacher" && !tutorPausedRef.current) {
          setTutorText("");
          speakTutorCharacterLine(
            completeTutorText,
            nextCharacter,
            (status) => setTutorSpeechStatus(status),
            (revealedText) => setTutorText(revealedText),
          );
        } else {
          setTutorText(completeTutorText);
        }
      }

      if (action === "focus_activity" && targetActivityId) {
        const activity = document.querySelector<HTMLElement>(`[data-smart-textbook-activity-id="${CSS.escape(targetActivityId)}"]`);
        activity?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
        activity?.focus({ preventScroll: true });
      } else if (action === "advance_module" && activeIndex < textbook.modules.length - 1) {
        selectModule(activeIndex + 1);
      }
    } catch (error) {
      if (requestAbortController.signal.aborted) return;
      window.speechSynthesis?.cancel();
      tutorSpeechPlaybackRef.current = null;
      setTutorSpeechStatus("idle");
      setTutorActiveBufferLine(null);
      setTutorStatus("error");
      setTutorText(error instanceof Error ? error.message : (locale === "ko-KR" ? "잠시 후 다시 시도해 주세요." : "请稍后重试。"));
    } finally {
      if (tutorRequestAbortRef.current === requestAbortController) tutorRequestAbortRef.current = null;
    }
  }

  function startTutorLesson(restart = false) {
    if (tutorStatus === "thinking" || tutorStatus === "streaming") return;
    tutorVisitedModuleIdsRef.current.add(activeModule.id);
    setTutorHasPreviousSession(true);
    setTeachingAreaCollapsed(false);
    setTutorAction(null);
    setLearningAreaManuallyHidden(false);
    tutorPausedRef.current = false;
    setTutorPaused(false);
    setTutorStarted(true);
    const restartBufferLine = restart
      ? activeModule?.openingBufferLine[locale] || activeModule?.openingBufferLine["zh-CN"] || ""
      : undefined;
    const restartBufferSpeechAssetId = restart
      ? activeModule?.openingBufferSpeechAssetId[locale] || activeModule?.openingBufferSpeechAssetId["zh-CN"] || null
      : undefined;
    void tutorReply("explain", undefined, restart, restartBufferLine, restartBufferSpeechAssetId);
  }

  function restartTutorLesson() {
    const confirmed = window.confirm(locale === "ko-KR"
      ? "현재 선생님 설명 진행을 지우고 처음부터 다시 시작할까요? 완료한 교재 활동 기록은 유지됩니다."
      : "确定从头重新开始老师讲解吗？当前讲解位置会重置，但已完成的教材活动记录会保留。");
    if (confirmed) startTutorLesson(true);
  }

  function visibleLearningTarget(targetKey: string) {
    const targets = Array.from(document.querySelectorAll<HTMLElement>(
      `[data-learning-target="${CSS.escape(targetKey)}"]`,
    ));
    return targets.find((target) => {
      const rect = target.getBoundingClientRect();
      const style = window.getComputedStyle(target);
      return rect.width > 0
        && rect.height > 0
        && style.display !== "none"
        && style.visibility !== "hidden";
    }) ?? null;
  }

  function prepareLearningTarget(targetKey: string) {
    if (targetKey.startsWith("orientation:")) {
      if (targetKey === "orientation:page:diagnosis" || targetKey.startsWith("orientation:diagnosis")) {
        setMissionPage(1);
      } else if (!targetKey.startsWith("orientation:header")) {
        setMissionPage(0);
      }
      return;
    }
    if (targetKey.startsWith("dialogue:") && activeModule.code === "orientation") {
      setMissionPage(0);
      return;
    }
    if (targetKey === "scene:image") {
      if (activeModule.code === "patterns") setPatternPage(0);
      else setMissionPage(0);
      return;
    }
    if (!targetKey.startsWith("activity:")) return;
    const activityId = targetKey.slice("activity:".length);
    const activity = activeNodes.flatMap((node) => node.activities).find((item) => item.id === activityId);
    if (!activity) return;
    if (activeModule.code === "orientation") {
      setMissionPage(1);
      return;
    }
    if (activeModule.code === "grammar") {
      const activityIndex = activeNodes.flatMap((node) => node.activities).findIndex((item) => item.id === activityId);
      if (activityIndex >= 0) setActiveGrammarPracticeIndex(activityIndex);
      return;
    }
    if (activeModule.code === "patterns") {
      if (activity.key === "pattern-choice") setPatternPage(0);
      else if (activity.key === "pattern-compose") setPatternPage(2);
      else setPatternPage(1);
      return;
    }
    if (activeModule.code === "dialogue" && activity.key === "dialogue-roleplay") {
      setMissionPage(3);
      return;
    }
    if (activeModule.code === "listen_speak") {
      setMissionPage(activity.type === "speaking" ? 3 : 1);
      return;
    }
    if (activeModule.code === "read_write") {
      setMissionPage(activity.type === "writing" ? 3 : 1);
      return;
    }
    if (activeModule.code === "review") {
      setMissionPage(activity.type === "self_check" ? 1 : 0);
    }
  }

  function focusTutorTask(attempt = 0) {
    if (!tutorTask?.targetKey) return;
    const target = visibleLearningTarget(tutorTask.targetKey);
    if (!target) {
      if (attempt === 0) prepareLearningTarget(tutorTask.targetKey);
      if (attempt < 6) window.setTimeout(() => focusTutorTask(attempt + 1), 120);
      return;
    }
    target?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    window.setTimeout(() => target?.focus({ preventScroll: true }), 350);
  }

  function runTutorVisualCue(cue: TutorVisualCue | null) {
    if (!cue?.targetKey) {
      setTutorCompanion(null);
      return;
    }
    const revealTarget = (attempt: number) => {
      const target = visibleLearningTarget(cue.targetKey!);
      if (!target) {
        if (attempt === 0) prepareLearningTarget(cue.targetKey!);
        if (attempt < 6) window.setTimeout(() => revealTarget(attempt + 1), 120);
        return;
      }
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      window.setTimeout(() => {
        target.focus({ preventScroll: true });
        const destination = tutorCompanionTargetPosition(target, cue.targetKey!);
        if (reduceMotion) {
          setTutorCompanion(destination);
        } else {
          setTutorCompanion((current) => {
            if (current) return { ...destination, phase: "travelling" };
            const teachingArea = document.querySelector<HTMLElement>("[data-smart-textbook-teaching-area]");
            const teachingBounds = teachingArea?.getBoundingClientRect();
            return {
              x: Math.round(Math.max(8, (teachingBounds?.right ?? 112) - 104)),
              y: Math.round(Math.max(8, (teachingBounds?.bottom ?? window.innerHeight) - 116)),
              facing: "right",
              targetKey: cue.targetKey!,
              phase: "travelling",
            };
          });
          window.setTimeout(() => {
            setTutorCompanion((current) => current?.targetKey === cue.targetKey
              ? { ...destination, phase: "travelling" }
              : current);
          }, 40);
          window.setTimeout(() => {
            setTutorCompanion((current) => current && current.targetKey === cue.targetKey
              ? { ...current, phase: "waiting" }
              : current);
          }, 600);
        }
        if (reduceMotion || typeof target.animate !== "function") {
          target.style.outline = "3px solid #f59e0b";
          target.style.outlineOffset = "4px";
          window.setTimeout(() => {
            target.style.removeProperty("outline");
            target.style.removeProperty("outline-offset");
          }, 1200);
          return;
        }
        target.animate([
          { offset: 0, boxShadow: "0 0 0 0 rgba(245, 158, 11, 0)", outline: "0 solid rgba(245, 158, 11, 0)" },
          { offset: 0.38, boxShadow: "0 0 0 10px rgba(245, 158, 11, .18)", outline: "3px solid rgba(245, 158, 11, .9)" },
          { offset: 0.62, boxShadow: "0 0 0 10px rgba(245, 158, 11, .18)", outline: "3px solid rgba(245, 158, 11, .9)" },
          { offset: 1, boxShadow: "0 0 0 16px rgba(245, 158, 11, 0)", outline: "0 solid rgba(245, 158, 11, 0)" },
        ], {
          duration: Math.max(400, Math.min(2500, Number(cue.durationMs) || 1000)),
          iterations: Math.max(1, Math.min(4, Number(cue.pulseCount) || 2)),
          easing: "cubic-bezier(.22, .61, .36, 1)",
        });
      }, reduceMotion ? 0 : 360);
    };
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => revealTarget(0)));
  }

  async function recordTutorLearningEvent(event: { eventType: "audio_completed"; targetKey: string }) {
    if (!tutorSessionId || !tutorTask || tutorTaskCompleted
      || tutorTask.eventType !== event.eventType || tutorTask.targetKey !== event.targetKey) return;
    if (isPreviewMode) {
      const response = await fetch("/api/learning-agent/preview-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptVersionId: previewScriptVersionId, sessionToken: tutorSessionId, ...event }),
      });
      if (!response.ok) return;
      const payload = await response.json().catch(() => null) as { sessionToken?: unknown } | null;
      if (typeof payload?.sessionToken === "string") setTutorSessionId(payload.sessionToken);
      setTutorTaskCompleted(true);
      return;
    }
    const response = await fetch("/api/learning-agent/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: tutorSessionId, ...event }),
    });
    if (response.ok) setTutorTaskCompleted(true);
  }

  useEffect(() => {
    const targetKey = tutorCompanion?.targetKey;
    if (!targetKey) return;
    const syncPosition = () => {
      if (tutorCompanionTrackingFrameRef.current !== null) {
        window.cancelAnimationFrame(tutorCompanionTrackingFrameRef.current);
      }
      tutorCompanionTrackingFrameRef.current = window.requestAnimationFrame(() => {
        const target = visibleLearningTarget(targetKey);
        if (!target) {
          setTutorCompanion(null);
          return;
        }
        const next = tutorCompanionTargetPosition(target, targetKey);
        setTutorCompanion((current) => current?.targetKey === targetKey
          ? { ...next, phase: current.phase }
          : current);
      });
    };
    window.addEventListener("resize", syncPosition);
    document.addEventListener("scroll", syncPosition, true);
    return () => {
      window.removeEventListener("resize", syncPosition);
      document.removeEventListener("scroll", syncPosition, true);
      if (tutorCompanionTrackingFrameRef.current !== null) {
        window.cancelAnimationFrame(tutorCompanionTrackingFrameRef.current);
        tutorCompanionTrackingFrameRef.current = null;
      }
    };
  }, [tutorCompanion?.targetKey]);

  useEffect(() => {
    setAhanIdleVisible(false);
    const canRunIdle = tutorStarted
      && !tutorPaused
      && !tutorCompanion
      && tutorStatus === "idle"
      && tutorSpeechStatus !== "loading"
      && tutorSpeechStatus !== "playing"
      && !tutorAwaitingAnswer
      && !showTutorAnswerDialog;
    if (!canRunIdle) return;

    let hideTimer: number | null = null;
    const showIdle = () => {
      setAhanIdleVisible(true);
      if (hideTimer !== null) window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setAhanIdleVisible(false), 9000);
    };
    const firstShowTimer = window.setTimeout(showIdle, 12000);
    const repeatTimer = window.setInterval(showIdle, 45000);
    return () => {
      window.clearTimeout(firstShowTimer);
      window.clearInterval(repeatTimer);
      if (hideTimer !== null) window.clearTimeout(hideTimer);
    };
  }, [
    activeModule?.id,
    showTutorAnswerDialog,
    tutorAwaitingAnswer,
    tutorCompanion,
    tutorPaused,
    tutorSpeechStatus,
    tutorStarted,
    tutorStatus,
  ]);

  useEffect(() => {
    if (!tutorTaskCompleted) return;
    setTutorCompanion((current) => current ? { ...current, phase: "completed" } : current);
    const returnTimer = window.setTimeout(() => {
      setTutorCompanion((current) => {
        if (!current) return null;
        const teachingArea = document.querySelector<HTMLElement>("[data-smart-textbook-teaching-area]");
        const teachingBounds = teachingArea?.getBoundingClientRect();
        return {
          x: Math.round(Math.max(8, (teachingBounds?.right ?? 112) - 104)),
          y: Math.round(Math.max(8, (teachingBounds?.bottom ?? window.innerHeight) - 116)),
          facing: "left",
          targetKey: "",
          phase: "travelling",
        };
      });
    }, 520);
    const hideTimer = window.setTimeout(() => setTutorCompanion(null), 1120);
    return () => {
      window.clearTimeout(returnTimer);
      window.clearTimeout(hideTimer);
    };
  }, [tutorTaskCompleted]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (
        event.isComposing ||
        target?.matches("input, textarea, select, [contenteditable='true']")
      ) return;
      if (event.altKey && event.key === "ArrowLeft") {
        setMissionPage(0);
        setActiveIndex((value) => Math.max(0, value - 1));
      }
      if (event.altKey && event.key === "ArrowRight") {
        setMissionPage(0);
        setActiveIndex((value) => Math.min(textbook.modules.length - 1, value + 1));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [textbook.modules.length]);

  useEffect(() => {
    function closeTutorWithEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (mobilePanel) setMobilePanel(null);
      if (!assistantCollapsed) setAssistantCollapsed(true);
    }

    window.addEventListener("keydown", closeTutorWithEscape);
    return () => window.removeEventListener("keydown", closeTutorWithEscape);
  }, [assistantCollapsed, mobilePanel]);

  useEffect(() => {
    function keepTutorWindowInView() {
      setTutorWindowPosition((current) => {
        if (!current) return current;
        const panel = tutorWindowRef.current;
        const width = panel?.offsetWidth ?? 400;
        const height = panel?.offsetHeight ?? 640;
        return {
          x: Math.max(12, Math.min(current.x, window.innerWidth - width - 12)),
          y: Math.max(82, Math.min(current.y, window.innerHeight - height - 12)),
        };
      });
    }

    window.addEventListener("resize", keepTutorWindowInView);
    return () => window.removeEventListener("resize", keepTutorWindowInView);
  }, []);

  useEffect(() => {
    function syncFullscreenState() {
      setIsFullscreen(document.fullscreenElement === textbookRef.current);
    }

    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  async function toggleFullscreen() {
    const textbookElement = textbookRef.current;
    if (!textbookElement) return;

    try {
      if (document.fullscreenElement === textbookElement) {
        await document.exitFullscreen();
      } else if (textbookElement.requestFullscreen) {
        await textbookElement.requestFullscreen();
      }
    } catch {
      // 浏览器拒绝全屏时保留当前教材界面，不中断学习。
    }
  }

  function toggleTutorPanel() {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setAssistantCollapsed((value) => {
        if (value) {
          const teachingAreaVisible = window.matchMedia("(min-width: 1280px)").matches;
          setTutorWindowPosition({
            x: teachingAreaVisible ? 60 : Math.max(12, window.innerWidth - 424),
            y: 94,
          });
        }
        return !value;
      });
      return;
    }

    setMobilePanel((value) => value === "assistant" ? null : "assistant");
  }

  function startTutorWindowDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const panel = tutorWindowRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    tutorDragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveTutorWindow(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = tutorDragRef.current;
    const panel = tutorWindowRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !panel) return;
    setTutorWindowPosition({
      x: Math.max(12, Math.min(event.clientX - drag.offsetX, window.innerWidth - panel.offsetWidth - 12)),
      y: Math.max(82, Math.min(event.clientY - drag.offsetY, window.innerHeight - panel.offsetHeight - 12)),
    });
  }

  function stopTutorWindowDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (tutorDragRef.current?.pointerId !== event.pointerId) return;
    tutorDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function renderChapterSidebar(compact = false) {
    if (compact) {
      return (
        <div className="mt-4 flex flex-col items-center gap-2" aria-label={sidebarLabel}>
          <span className="mb-1 text-[9px] font-bold text-[var(--foreground-muted)]">
            {chapterLabel}
          </span>
          {textbook.modules.map((module, index) => {
            const active = index === activeIndex;
            const done = moduleDone(index);
            return (
              <button
                key={module.id}
                type="button"
                onClick={() => {
                  selectModule(index);
                  setMobilePanel(null);
                }}
                aria-current={active ? "step" : undefined}
                aria-label={`${t.learnerPath} ${index + 1}: ${localize(module.title)}`}
                title={localize(module.title)}
                className={`flex h-9 w-9 items-center justify-center rounded-xl border text-[10px] font-bold tabular-nums transition-colors ${active ? "border-[var(--primary)] bg-[var(--accent)] text-[var(--primary)]" : "border-[var(--border-subtle)] bg-[var(--card)] text-[var(--foreground-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)]"}`}
              >
                {done ? <Check size={14} aria-hidden="true" /> : String(index + 1).padStart(2, "0")}
              </button>
            );
          })}
        </div>
      );
    }

    return (
      <div className="mt-4 px-2" aria-label={sidebarLabel}>
        <div className="rounded-2xl bg-[var(--surface-soft)] p-3.5">
          <div className="flex items-start justify-between gap-3">
            <CardTitleWithHint
              title={`${chapterLabel} · ${localize(textbook.chapter.title)}`}
              description={localize(textbook.chapter.goal)}
              headingLevel={2}
              titleClassName="break-keep text-xs font-bold leading-5 text-[var(--foreground)]"
              hintClassName="-my-2 -mr-2"
              hintLabel={locale === "ko-KR" ? "이 장의 목표 보기" : "查看本章目标"}
            />
            <span className="shrink-0 pt-0.5 text-[10px] font-bold tabular-nums text-[var(--foreground-muted)]">
              {activeIndex + 1} / {textbook.modules.length}
            </span>
          </div>
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--card)]"
            role="progressbar"
            aria-label={locale === "ko-KR" ? "이 장의 학습 진도" : "本章学习进度"}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
          >
            <div
              className="h-full rounded-full bg-[var(--status-success)] transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="relative mt-3">
          <span className="absolute bottom-5 left-[15px] top-5 w-px bg-[var(--border-subtle)]" aria-hidden="true" />
          <ol className="space-y-2" aria-label={locale === "ko-KR" ? "학습 단계" : "学习步骤"}>
            {textbook.modules.map((module, index) => {
              const active = index === activeIndex;
              const done = moduleDone(index);
              const chapterOneKnowledge = chapterOneKnowledgeMap[module.code as keyof typeof chapterOneKnowledgeMap];
              const chapterZeroModule = chapterZeroOutline[module.code as keyof typeof chapterZeroOutline];
              const NavigationIcon = chapterZeroModule?.icon ?? chapterOneKnowledge?.icon ?? BookOpen;
              const navigationTitle = textbook.chapter.number === 1
                ? chapterOneKnowledge?.title[locale] ?? localize(module.title)
                : localize(module.title);
              const navigationSummary = textbook.chapter.number === 1
                ? chapterOneKnowledge?.summary[locale] ?? localize(module.description)
                : localize(module.description);
              return (
                <li key={module.id} className="relative grid grid-cols-[32px_minmax(0,1fr)] items-start gap-2.5">
                  <span className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-[var(--card)] ${active ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm" : done ? "border-[var(--status-success)] text-[var(--status-success)]" : "border-[var(--border)] text-[var(--foreground-muted)]"}`}>
                    {done ? <Check size={14} aria-hidden="true" /> : <NavigationIcon size={14} aria-hidden="true" />}
                  </span>
                  <div className={`relative min-h-14 min-w-0 rounded-xl border px-2.5 py-2 transition-colors ${active ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border-subtle)] bg-[var(--card)] hover:border-[var(--primary)]"}`}>
                    <button
                      type="button"
                      onClick={() => {
                        selectModule(index);
                        setMobilePanel(null);
                      }}
                      aria-current={active ? "step" : undefined}
                      aria-label={`${t.learnerPath} ${index + 1}: ${navigationTitle}`}
                      className="absolute inset-0 rounded-xl text-left focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
                    >
                      <span className="sr-only">{navigationTitle}</span>
                    </button>
                    <div className="pointer-events-none relative z-10 flex min-h-10 items-center">
                      <CardTitleWithHint
                        title={navigationTitle}
                        description={navigationSummary}
                        headingLevel={3}
                        className="!w-full"
                        titleClassName="min-w-0 flex-1 break-keep text-xs font-bold leading-5 text-[var(--foreground)]"
                        hintClassName="pointer-events-auto -my-2 -mr-2"
                        hintLabel={locale === "ko-KR" ? `${navigationTitle} 상세 설명` : `查看${navigationTitle}说明`}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    );
  }

  const teachingAreaCharacter: TutorCharacter | null = tutorCharacter === undefined
    ? { kind: "uply-teacher", pose: "greeting", position: "right", voiceEnabled: true, voiceLanguage: "auto", voiceRate: 1 }
    : tutorCharacter;
  const teachingAreaCharacterFrames = teachingAreaCharacter?.kind === "uply-teacher"
    ? tutorCharacterImages[teachingAreaCharacter.pose ?? "greeting"]
    : null;

  function renderTutorPanel(showHeader = true, floating = false) {
    return (
      <div className={`flex h-full flex-col overflow-hidden rounded-[26px] border border-[var(--border-subtle)] shadow-sm ${floating ? "bg-[color-mix(in_srgb,var(--card)_92%,transparent)]" : "bg-[var(--card)]"}`}>
        {showHeader && <div className="border-b border-[var(--border-subtle)] px-5 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--primary)]">
              <MessageCircle size={18} />
            </span>
            <div>
              <p className="font-bold text-[var(--foreground)]">{agentName}</p>
              <p className="mt-0.5 text-[10px] leading-4 text-[var(--foreground-muted)]">{agentDescription}</p>
            </div>
          </div>
        </div>}
        <div className="smart-textbook-scroll flex-1 overflow-y-auto p-5">
          <div className="text-xs font-bold tracking-wide text-[var(--foreground-muted)]">{t.currentMission}</div>
          <p className="mt-2 text-sm font-bold leading-6 text-[var(--foreground)]">{localize(activeModule.title)}</p>
          {!tutorStarted ? (
            <div className="mt-5 grid gap-2">
              <button
                type="button"
                onClick={() => startTutorLesson(false)}
                disabled={!textbook.agent || tutorStatus === "thinking" || tutorStatus === "streaming"}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--status-warning)] px-4 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Play size={16} fill="currentColor" aria-hidden="true" />
                {tutorHasPreviousSession
                  ? (locale === "ko-KR" ? "이어서 학습" : "继续学习")
                  : (locale === "ko-KR" ? "준비됐어요. 수업 시작" : "我准备好了，开始学习")}
              </button>
              {tutorHasPreviousSession && (
                <button
                  type="button"
                  onClick={restartTutorLesson}
                  disabled={!textbook.agent || tutorStatus === "thinking" || tutorStatus === "streaming"}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] px-4 text-xs font-bold text-[var(--foreground-secondary)] transition hover:border-[var(--status-warning)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw size={15} aria-hidden="true" />
                  {locale === "ko-KR" ? "처음부터 다시 시작" : "重新开始"}
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="sticky top-0 z-10 mt-5 grid grid-cols-2 gap-2 bg-[var(--card)] py-2" role="group" aria-label={locale === "ko-KR" ? "학습 제어" : "学习控制"}>
                <button
                  type="button"
                  onClick={tutorPaused ? resumeTutorLesson : pauseTutorLesson}
                  disabled={tutorTerminal}
                  aria-pressed={tutorPaused}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] px-3 text-xs font-bold text-[var(--foreground-secondary)] transition hover:border-[var(--status-warning)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {tutorPaused ? <Play size={15} fill="currentColor" aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
                  {tutorTerminal
                    ? (locale === "ko-KR" ? "학습 완료" : "学习已完成")
                    : tutorPaused
                      ? (locale === "ko-KR" ? "학습 계속" : "继续学习")
                      : (locale === "ko-KR" ? "일시 정지" : "暂停学习")}
                </button>
                <button
                  type="button"
                  onClick={exitTutorLesson}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--destructive)_30%,var(--border-subtle))] bg-[var(--card)] px-3 text-xs font-bold text-[var(--destructive)] transition hover:border-[var(--destructive)]"
                >
                  <X size={15} aria-hidden="true" />
                  {locale === "ko-KR" ? "학습 종료" : "退出学习"}
                </button>
              </div>
              {tutorPaused && (
                <p className="mt-3 rounded-xl bg-[var(--surface-soft)] px-3 py-2.5 text-xs font-semibold leading-5 text-[var(--foreground-secondary)]" role="status">
                  {locale === "ko-KR" ? "현재 위치에서 학습을 일시 정지했어요." : "已在当前位置暂停，教材学习进度会保留。"}
                </p>
              )}
            </>
          )}
          {tutorStarted && !tutorTerminal && (
            <div className="mt-5 grid grid-cols-2 gap-2">
              {([['explain', t.explain], ['hint', t.hint], ['example', t.example], ['roleplay', t.roleplay]] as const).map(([intent, label]) => (
              <button
                key={intent}
                type="button"
                onClick={() => tutorReply(intent)}
                disabled={tutorPaused || tutorStatus === "thinking" || tutorStatus === "streaming"}
                className="min-h-14 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-3 py-2 text-left text-xs font-semibold leading-5 text-[var(--foreground-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:cursor-wait disabled:opacity-50"
              >
                {label}
              </button>
              ))}
            </div>
          )}
          {tutorText && (
            <div className="mt-5 whitespace-pre-line rounded-xl bg-[var(--accent)] px-4 py-4 text-sm leading-6 text-[var(--foreground-secondary)]">
              <Sparkles size={15} className="mb-2 text-[var(--primary)]" />
              {renderRichTutorText(tutorText, tutorTextRich)}
            </div>
          )}
        </div>
        {tutorStarted && !isPreviewMode && <div className="border-t border-[var(--border-subtle)] p-4">
          <textarea
            value={tutorInput}
            onChange={(event) => setTutorInput(event.target.value)}
            disabled={tutorPaused}
            rows={2}
            aria-label={t.ask}
            placeholder={t.ask}
            className="w-full resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-3 py-2 text-sm leading-5 text-[var(--foreground)] outline-none placeholder:text-[var(--foreground-muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => tutorReply('ask')}
            disabled={tutorPaused || tutorStatus === "thinking" || tutorStatus === "streaming"}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-50"
          >
            <Send size={14} /> {t.send}
          </button>
        </div>}
      </div>
    );
  }

  if (!activeModule) {
    return (
      <div className="fixed inset-0 z-50 flex min-h-[100dvh] items-center justify-center bg-[var(--background)] p-6 text-[var(--foreground)]">
        <div className="app-empty-state w-full max-w-xl rounded-2xl p-8 text-center">
          <BookOpen className="mx-auto text-[var(--foreground-muted)]" size={28} />
          <h3 className="mt-4 text-xl font-bold">本章暂无可学习内容</h3>
          <p className="app-muted-text mt-2 text-sm leading-6">教材模块尚未发布，请返回课程目录选择其他课时。</p>
          <Link href={backHref} className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-bold text-[var(--primary-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2">
            <ArrowLeft size={16} />{t.back}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={textbookRef}
      className="fixed inset-0 z-50 flex min-h-[100dvh] flex-col overflow-hidden bg-[var(--surface-soft)] text-[var(--foreground)] [&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-[var(--ring)] [&_a:focus-visible]:ring-offset-2 [&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-[var(--ring)] [&_button:focus-visible]:ring-offset-2"
      style={{ backgroundImage: `radial-gradient(circle at 12% 0%, ${accent.glow}, transparent 30%), radial-gradient(circle at 92% 88%, color-mix(in srgb, var(--primary) 8%, transparent), transparent 28%)` }}
    >
      <a href="#korean-textbook-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-[var(--card)] focus:px-4 focus:py-2 focus:text-sm focus:font-bold">
        跳到教材正文
      </a>
      {tutorCompanion && !learningAreaHidden && !showTutorAnswerDialog && (
        <div
          className="a-han-companion pointer-events-none fixed z-[45] w-[76px] sm:w-[104px]"
          data-phase={tutorCompanion.phase}
          style={{ left: tutorCompanion.x, top: tutorCompanion.y }}
          role="status"
          aria-label={locale === "ko-KR" ? "수업 도우미 아한이가 학습 위치를 가리키고 있어요" : "课堂陪伴宠物阿韩正在提示学习位置"}
        >
          <Image
            src={tutorCompanionImages.pointing}
            alt=""
            width={1312}
            height={1199}
            unoptimized
            priority
            className="h-auto w-full drop-shadow-[0_8px_12px_rgba(15,23,42,0.16)]"
            style={{ transform: tutorCompanion.facing === "right" ? "none" : "scaleX(-1)" }}
          />
        </div>
      )}
      <header className="relative z-30 h-[70px] shrink-0 border-b border-[var(--border-subtle)] bg-[var(--card)] px-3 shadow-sm sm:px-5 lg:h-[78px] lg:px-7">
        <div className="flex h-full items-center justify-start gap-3">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <button
              type="button"
              onClick={() => setMobilePanel("path")}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[var(--foreground-secondary)] lg:hidden"
              aria-label={sidebarLabel}
              aria-expanded={mobilePanel === "path"}
            >
              <Menu size={18} />
            </button>
            <Link href={backHref} className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 shrink-0 items-center gap-2 text-sm font-semibold text-[var(--foreground-muted)] transition hover:text-[var(--foreground)] sm:right-5 lg:right-7">
              <ArrowLeft size={17} />
              <span className="hidden sm:inline">{t.back}</span>
            </Link>
          </div>
          <div className="pointer-events-none absolute left-1/2 hidden max-w-[42vw] -translate-x-1/2 items-center gap-3 lg:flex">
            <p className="truncate text-[15px] font-bold text-[var(--foreground)]">
              {chapterLabel} · {localize(textbook.chapter.title)}
            </p>
            <span className="h-4 w-px shrink-0 bg-[var(--border-subtle)]" aria-hidden="true" />
            <span className="shrink-0 text-xs font-bold tabular-nums text-[var(--foreground-muted)]" aria-live="polite">
              {activeIndex + 1} / {textbook.modules.length}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4 lg:gap-5">
            <button
              type="button"
              onClick={toggleTutorPanel}
              className={`inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-xl border px-2.5 text-sm font-bold transition sm:px-3 ${!assistantCollapsed || mobilePanel === "assistant" ? "border-[var(--primary)] bg-[var(--accent)] text-[var(--primary)]" : "border-[var(--border-subtle)] bg-[var(--surface-soft)] text-[var(--foreground-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]"}`}
              aria-label={agentName}
              aria-expanded={!assistantCollapsed || mobilePanel === "assistant"}
            >
              <MessageCircle size={17} />
              <span className="hidden xl:inline">{agentName}</span>
            </button>
            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              aria-label={isFullscreen ? t.exitFullscreen : t.fullscreen}
              aria-pressed={isFullscreen}
              title={isFullscreen ? t.exitFullscreen : t.fullscreen}
              className="inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-2.5 text-sm font-bold text-[var(--foreground-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] sm:px-3"
            >
              {isFullscreen ? <Minimize2 size={17} aria-hidden="true" /> : <Maximize2 size={17} aria-hidden="true" />}
              <span className="hidden xl:inline">{isFullscreen ? t.exitFullscreen : t.fullscreen}</span>
            </button>
            <div className="relative order-first">
              <button
                type="button"
                onClick={() => setSettingsOpen((value) => !value)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-3 text-sm font-bold text-[var(--foreground-secondary)] sm:px-4"
                aria-expanded={settingsOpen}
              >
                <Languages size={16} className="text-[var(--primary)]" />
                <span className="hidden sm:inline">中 / 한</span>
                <ChevronDown size={14} />
              </button>
              {settingsOpen && (
                <div className="absolute left-0 top-12 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-[22px] border border-[var(--border-subtle)] bg-[var(--card)] p-5 shadow-xl">
                  <div className="mb-5 flex items-center justify-between">
                    <span className="font-bold text-slate-900">{t.language}</span>
                    <button type="button" onClick={() => setSettingsOpen(false)} className="p-1 text-slate-400" aria-label="关闭">
                      <X size={16} />
                    </button>
                  </div>
                  <p className="mb-2 text-xs font-bold text-slate-400">{t.interfaceLanguage}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["zh-CN", "ko-KR"] as SmartLocale[]).map((item) => (
                      <button key={item} type="button" disabled={isPending} onClick={() => savePreference(item, supportMode)} className={`rounded-xl px-3 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 ${locale === item ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>
                        {item === "zh-CN" ? "中文" : "한국어"}
                      </button>
                    ))}
                  </div>
                  <p className="mb-2 mt-5 text-xs font-bold text-slate-400">{t.supportMode}</p>
                  <div className="space-y-1">
                    {(["chinese", "bilingual", "immersion"] as SmartSupportMode[]).map((item) => (
                      <button key={item} type="button" disabled={isPending} onClick={() => savePreference(locale, item)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${supportMode === item ? "bg-[var(--accent)] text-[var(--primary)]" : "text-slate-600 hover:bg-slate-50"}`}>
                        <span>{t[item]}</span>{supportMode === item && <Check size={15} />}
                      </button>
                    ))}
                  </div>
                  {isPending && <p className="mt-3 text-xs text-slate-400">{t.saved}…</p>}
                  {preferenceError && (
                    <div role="alert" className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[var(--destructive)]/5 px-3 py-2.5 text-xs font-semibold text-[var(--destructive)]">
                      <span>{preferenceError}</span>
                      {preferenceNeedsReload && (
                        <button
                          type="button"
                          onClick={() => window.location.reload()}
                          className="shrink-0 rounded-lg border border-current px-2.5 py-1.5 font-bold"
                        >
                          {t.refreshPage}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 overflow-hidden border-x border-[var(--border-subtle)] bg-[var(--card)]">
        <aside
          aria-label={locale === "ko-KR" ? "수업 영역" : "教学区"}
          data-learning-agent-focus-mode={tutorFocusMode || undefined}
          data-learning-agent-expanded={teachingAreaExpanded || undefined}
          className="relative hidden shrink-0 overflow-hidden border-r border-[color-mix(in_srgb,var(--status-warning)_5%,var(--border-subtle))] bg-[color-mix(in_srgb,var(--status-warning)_3%,var(--card))] transition-[width] duration-200 motion-reduce:transition-none xl:flex xl:flex-col"
          style={{ width: teachingAreaExpanded
            ? "100%"
            : teachingAreaCollapsed
              ? `${SMART_TEXTBOOK_SHARED_LEARNING_LAYOUT.teachingArea.collapsedWidthPx}px`
              : `${SMART_TEXTBOOK_SHARED_LEARNING_LAYOUT.teachingArea.defaultWidthPercent}%` }}
        >
          <div className="relative flex shrink-0 items-center justify-center border-b border-[color-mix(in_srgb,var(--status-warning)_4%,var(--border-subtle))] px-2" style={{ height: SMART_TEXTBOOK_SHARED_LEARNING_LAYOUT.learningHeader.heightPx }}>
            {(!teachingAreaCollapsed || teachingAreaExpanded) && (
              <div className="flex min-w-0 items-center justify-center gap-2.5 px-12">
                <Presentation size={19} className="shrink-0 text-[var(--status-warning)]" aria-hidden="true" />
                <h2 className="truncate text-base font-bold text-[var(--foreground)]">{locale === "ko-KR" ? "수업 영역" : "教学区"}</h2>
              </div>
            )}
            {learningAreaManuallyHidden && !tutorFocusMode ? (
              <button
                type="button"
                onClick={() => setLearningAreaManuallyHidden(false)}
                className="absolute right-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold text-[var(--foreground-secondary)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
                aria-label={locale === "ko-KR" ? "학습 영역 표시" : "显示学习区"}
              >
                <PanelRightOpen size={17} aria-hidden="true" />
                <span>{locale === "ko-KR" ? "학습 영역 표시" : "显示学习区"}</span>
              </button>
            ) : !teachingAreaExpanded ? <button
              type="button"
              onClick={() => setTeachingAreaCollapsed((value) => !value)}
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--foreground-muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)] ${teachingAreaCollapsed ? "" : "absolute right-2"}`}
              aria-label={locale === "ko-KR"
                ? teachingAreaCollapsed ? "수업 영역 펼치기" : "수업 영역 접기"
                : teachingAreaCollapsed ? "展开教学区" : "收起教学区"}
              aria-expanded={!teachingAreaCollapsed}
            >
              {teachingAreaCollapsed ? <PanelLeftOpen size={17} aria-hidden="true" /> : <PanelLeftClose size={17} aria-hidden="true" />}
            </button> : null}
          </div>
          {(!teachingAreaCollapsed || teachingAreaExpanded) && (
            <div
              className={`smart-textbook-scroll flex min-h-0 flex-1 flex-col pb-6 pt-5 ${tutorStarted ? "overflow-y-auto" : "overflow-hidden"} ${teachingAreaExpanded ? "mx-auto w-full px-8" : "px-6"}`}
              style={teachingAreaExpanded ? { maxWidth: SMART_TEXTBOOK_SHARED_LEARNING_LAYOUT.teachingArea.focusedContentMaxWidthPx } : undefined}
              data-smart-textbook-teaching-area
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="shrink-0 text-[10px] font-bold text-[var(--foreground-muted)]">{locale === "ko-KR" ? "현재 수업" : "当前教学"}</span>
                <span className="shrink-0 text-[12px] font-semibold text-[var(--foreground-secondary)]">{chapterLabel} · {localize(textbook.chapter.title)}</span>
                <span className="h-3.5 w-px shrink-0 bg-[var(--border-subtle)]" aria-hidden="true" />
                <CardTitleWithHint
                  title={localize(activeModule.title)}
                  description={localize(activeModule.description)}
                  headingLevel={3}
                  className="min-w-0 items-center"
                  titleClassName="truncate text-sm font-bold leading-5 text-[var(--foreground)]"
                  hintClassName="-my-3 -mr-3 shrink-0"
                  hintLabel={locale === "ko-KR" ? "현재 수업 안내 보기" : "查看当前教学说明"}
                />
              </div>

              <div className="sticky top-0 z-20 mt-4 shrink-0 bg-[color-mix(in_srgb,var(--status-warning)_3%,var(--card))] pb-3" data-learning-agent-blackboard>
                <section
                  className={`relative rounded-2xl border border-[color-mix(in_srgb,var(--status-warning)_16%,var(--border-subtle))] bg-[var(--card)] shadow-sm ${teachingAreaExpanded ? "p-3" : "p-4"} ${tutorStarted ? "" : "flex-1"}`}
                  style={{ minHeight: tutorStarted ? SMART_TEXTBOOK_SHARED_LEARNING_LAYOUT.blackboard.minimumHeightPx : 0 }}
                  aria-labelledby="teaching-blackboard-title"
                >
                  <h3 id="teaching-blackboard-title" className={`${teachingAreaExpanded ? "text-base leading-7" : "text-sm leading-6"} font-bold text-[var(--foreground)]`}>
                    {tutorDisplay?.title?.[locale] || localize(activeModule.title)}
                  </h3>
                  {!tutorStarted && (
                    <div className="relative z-30 mt-4 grid max-w-xl gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => startTutorLesson(false)}
                        disabled={!textbook.agent || tutorStatus === "thinking" || tutorStatus === "streaming"}
                        className={`${tutorHasPreviousSession ? "" : "sm:col-span-2"} inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--status-warning)] px-5 py-3.5 text-sm font-bold text-white shadow-[0_8px_22px_color-mix(in_srgb,var(--status-warning)_22%,transparent)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_26px_color-mix(in_srgb,var(--status-warning)_30%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 motion-reduce:transform-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none`}
                      >
                        <Play size={16} fill="currentColor" aria-hidden="true" />
                        {tutorHasPreviousSession
                          ? (locale === "ko-KR" ? "이어서 학습" : "继续学习")
                          : (locale === "ko-KR" ? "준비됐어요. 수업 시작" : "我准备好了，开始学习")}
                      </button>
                      {tutorHasPreviousSession && (
                        <button
                          type="button"
                          onClick={restartTutorLesson}
                          disabled={!textbook.agent || tutorStatus === "thinking" || tutorStatus === "streaming"}
                          className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)] px-5 py-3.5 text-sm font-bold text-[var(--foreground-secondary)] transition hover:border-[var(--status-warning)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <RotateCcw size={16} aria-hidden="true" />
                          {locale === "ko-KR" ? "처음부터 다시 시작" : "重新开始"}
                        </button>
                      )}
                    </div>
                  )}
                  {tutorStarted && (tutorDisplay?.items?.[locale]?.length ?? 0) > 0 && (
                    <ol className={`mt-3 grid gap-2 ${tutorDisplay?.kind === "sequence" ? "grid-cols-2" : ""}`}>
                      {tutorDisplay?.items?.[locale]?.map((item, itemIndex) => (
                        <li key={`${item}-${itemIndex}`} className={`flex min-w-0 items-start gap-2 rounded-xl bg-[var(--surface-soft)] px-3 py-2 font-semibold text-[var(--foreground-secondary)] ${teachingAreaExpanded ? "text-sm leading-6" : "text-xs leading-5"}`}>
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--status-warning-surface)] text-[9px] font-bold text-[var(--status-warning)]">{itemIndex + 1}</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                  {tutorStarted && tutorDisplay?.korean && (
                    <div className="mt-3 border-l-2 border-[var(--status-warning)] pl-3">
                      <p lang="ko" className={`whitespace-pre-line font-bold text-[var(--foreground)] ${teachingAreaExpanded ? "text-base leading-7" : "text-sm leading-6"}`}>{tutorDisplay.korean}</p>
                      {tutorDisplay.translation?.[locale] && <p className={`mt-1 text-[var(--foreground-muted)] ${teachingAreaExpanded ? "text-xs leading-5" : "text-[11px] leading-5"}`}>{tutorDisplay.translation[locale]}</p>}
                    </div>
                  )}
                {teachingAreaCharacter?.kind === "uply-teacher" && (
                  <div
                    className={`pointer-events-none fixed z-40 ${teachingAreaExpanded ? "inset-x-0 bottom-[240px] mx-auto px-8" : "bottom-[300px] left-0 px-6"}`}
                    style={{
                      width: teachingAreaExpanded
                        ? "100%"
                        : teachingAreaCollapsed
                          ? `${SMART_TEXTBOOK_SHARED_LEARNING_LAYOUT.teachingArea.collapsedWidthPx}px`
                          : `${SMART_TEXTBOOK_SHARED_LEARNING_LAYOUT.teachingArea.defaultWidthPercent}%`,
                      maxWidth: teachingAreaExpanded ? SMART_TEXTBOOK_SHARED_LEARNING_LAYOUT.teachingArea.focusedContentMaxWidthPx : undefined,
                    }}
                  >
                    <div className={`absolute bottom-0 z-20 flex items-end justify-center ${teachingAreaExpanded ? "w-[16rem]" : "w-[18rem]"} ${!tutorStarted ? "left-1/2 -translate-x-1/2" : teachingAreaExpanded ? "right-0 translate-x-[clamp(2.5rem,6.4vw,8rem)]" : "right-0 translate-x-[clamp(3rem,8vw,10rem)]"}`}>
                      <div
                        className={`kim-teacher-breathe relative aspect-[1/2] w-auto max-w-full drop-shadow-[0_14px_20px_rgba(15,23,42,0.16)] motion-reduce:animate-none ${teachingAreaExpanded ? "h-[clamp(24rem,48vh,32rem)]" : "h-[clamp(26rem,56vh,34rem)]"}`}
                        data-speaking={tutorSpeechStatus === "playing" || undefined}
                      >
                        {teachingAreaCharacterFrames && ([
                          ["idle", teachingAreaCharacterFrames.idle, ""],
                          ["speaking", teachingAreaCharacterFrames.speaking, "kim-teacher-speaking-frame"],
                          ["blink", teachingAreaCharacterFrames.blink, "kim-teacher-blink-frame"],
                        ] as const).map(([frame, source, frameClass]) => (
                          <Image
                            key={frame}
                            src={source}
                            alt=""
                            width={512}
                            height={1024}
                            unoptimized
                            loading="eager"
                            className={`absolute inset-0 h-full w-full object-contain ${frameClass}`}
                          />
                        ))}
                        {tutorBubbleVisible && (
                          <div
                            className={`pointer-events-auto absolute right-full z-10 mr-2 w-fit motion-safe:animate-[smart-textbook-float-in_180ms_ease-out] ${teachingAreaExpanded ? "bottom-[clamp(17.5rem,33.6vh,24rem)] max-w-xs" : "bottom-[clamp(18rem,36vh,24rem)] max-w-xs"}`}
                          >
                        <div className="relative rounded-2xl border border-[color-mix(in_srgb,var(--status-warning)_20%,var(--border-subtle))] bg-[var(--card)] p-3 shadow-sm">
                          {teachingAreaCharacter?.kind === "uply-teacher" && (
                            <span className="absolute bottom-4 -right-1.5 h-3 w-3 rotate-45 border-r border-t border-[color-mix(in_srgb,var(--status-warning)_20%,var(--border-subtle))] bg-[var(--card)]" aria-hidden="true" />
                          )}
                          <div className="flex min-w-0 items-center justify-between gap-3">
                            <p className="truncate text-xs font-bold text-[var(--foreground)]">{agentName}</p>
                            <p className={`shrink-0 text-[10px] font-bold ${tutorStatus === "error" ? "text-[var(--destructive)]" : "text-[var(--status-success)]"}`}>
                              {!tutorStarted
                                ? (locale === "ko-KR" ? "시작 대기" : "等待开始")
                                : tutorPaused
                                  ? (locale === "ko-KR" ? "학습 일시 정지" : "学习已暂停")
                                : tutorSpeechStatus === "loading"
                                  ? (locale === "ko-KR" ? "음성 준비 중" : "语音准备中")
                                : tutorSpeechStatus === "playing"
                                  ? (locale === "ko-KR" ? "설명 중" : "正在讲课")
                                : tutorSpeechStatus === "paused"
                                  ? (locale === "ko-KR" ? "일시 정지" : "讲解已暂停")
                                : tutorStatus === "thinking" || tutorStatus === "streaming"
                                  ? (locale === "ko-KR" ? "설명 중" : "讲解中")
                                  : tutorStatus === "error"
                                    ? (locale === "ko-KR" ? "다시 시도해 주세요" : "请重试")
                                    : (locale === "ko-KR" ? "수업 중" : "教学中")}
                            </p>
                          </div>
                          <p className="mt-2 whitespace-pre-line text-[11px] leading-5 text-[var(--foreground-secondary)]" aria-live="polite" aria-busy={tutorStatus === "thinking" || tutorStatus === "streaming"}>
                            {tutorStatus === "thinking"
                              ? (tutorActiveBufferLine || (locale === "ko-KR" ? "다음 내용을 준비하고 있어요…" : "正在准备接下来的内容…"))
                              : tutorText ? renderRichTutorText(tutorText, tutorTextRich) : (tutorSpeechInProgress
                                ? "\u00a0"
                                : locale === "ko-KR"
                              ? "오른쪽 학습 영역의 장면을 먼저 살펴보세요. 준비가 되면 핵심 표현을 듣고 현재 활동을 완성해 보세요."
                              : "先观察右侧学习区中的场景。准备好后，听一听核心表达，再完成当前活动。")}
                          </p>
                          {tutorSpeechStatus !== "idle" && tutorSpeechPlaybackRef.current && (
                            <div className="mt-3 grid grid-cols-2 gap-1 border-t border-[var(--border-subtle)] pt-3">
                              <button
                                type="button"
                                onClick={toggleTutorSpeech}
                                disabled={tutorPaused || tutorSpeechStatus === "loading" || tutorSpeechStatus === "error" || tutorSpeechStatus === "ended"}
                                className="inline-flex min-h-7 items-center justify-start gap-1 rounded-lg px-1.5 text-[8px] font-bold text-[var(--foreground-secondary)] transition hover:bg-[var(--surface-soft)] disabled:opacity-40"
                              >
                                {tutorSpeechStatus === "playing" ? <Pause size={10} aria-hidden="true" /> : <Play size={10} aria-hidden="true" />}
                                {tutorSpeechStatus === "playing" ? (locale === "ko-KR" ? "일시 정지" : "暂停") : (locale === "ko-KR" ? "계속 듣기" : "继续")}
                              </button>
                              <button type="button" onClick={replayTutorSpeech} disabled={tutorPaused} className="inline-flex min-h-7 items-center justify-start gap-1 rounded-lg px-1.5 text-[8px] font-bold text-[var(--foreground-secondary)] transition hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-40">
                                <RotateCcw size={10} aria-hidden="true" />
                                {locale === "ko-KR" ? "다시 듣기" : "重播"}
                              </button>
                              <button type="button" onClick={exitTutorLesson} className="inline-flex min-h-7 items-center justify-start gap-1 rounded-lg px-1.5 text-[8px] font-bold text-[var(--destructive)] transition hover:bg-[color-mix(in_srgb,var(--destructive)_6%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                                <X size={10} aria-hidden="true" />
                                {locale === "ko-KR" ? "학습 종료" : "退出"}
                              </button>
                              <button type="button" onClick={() => setTutorSpeechMuted((current) => !current)} className="inline-flex min-h-7 items-center justify-start gap-1 rounded-lg px-1.5 text-[8px] font-bold text-[var(--foreground-secondary)] transition hover:bg-[var(--surface-soft)]" aria-pressed={tutorSpeechMuted}>
                                {tutorSpeechMuted ? <VolumeX size={10} aria-hidden="true" /> : <Volume2 size={10} aria-hidden="true" />}
                                {tutorSpeechMuted ? (locale === "ko-KR" ? "음소거 해제" : "取消静音") : (locale === "ko-KR" ? "음소거" : "静音")}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {ahanIdleVisible && !tutorCompanion && (
                    <div className="a-han-idle-companion absolute bottom-3 left-0 z-30 w-[7rem]">
                      <Image
                        src={tutorCompanionImages.seatedCombingPoster}
                        alt=""
                        width={320}
                        height={320}
                        unoptimized
                        className="a-han-idle-poster h-auto w-full drop-shadow-[0_8px_12px_rgba(15,23,42,0.14)]"
                      />
                    </div>
                  )}
                  </div>
                  </div>
                )}
                {teachingAreaCharacter?.kind !== "uply-teacher" && (
                  <div className="relative z-10 pt-2">
                        <div className={`relative rounded-2xl border border-[color-mix(in_srgb,var(--status-warning)_20%,var(--border-subtle))] bg-[var(--card)] shadow-sm ${teachingAreaExpanded ? "p-4" : "p-3"}`}>
                          {teachingAreaCharacter?.kind === "uply-teacher" && (
                            <span className="absolute bottom-4 -right-1.5 h-3 w-3 rotate-45 border-r border-t border-[color-mix(in_srgb,var(--status-warning)_20%,var(--border-subtle))] bg-[var(--card)]" aria-hidden="true" />
                          )}
                          <div className="flex min-w-0 items-center justify-between gap-3">
                            <p className={`truncate font-bold text-[var(--foreground)] ${teachingAreaExpanded ? "text-sm" : "text-xs"}`}>{agentName}</p>
                            <p className={`shrink-0 font-bold ${teachingAreaExpanded ? "text-xs" : "text-[10px]"} ${tutorStatus === "error" ? "text-[var(--destructive)]" : "text-[var(--status-success)]"}`}>
                              {!tutorStarted
                                ? (locale === "ko-KR" ? "시작 대기" : "等待开始")
                                : tutorPaused
                                  ? (locale === "ko-KR" ? "학습 일시 정지" : "学习已暂停")
                                : tutorSpeechStatus === "loading"
                                  ? (locale === "ko-KR" ? "음성 준비 중" : "语音准备中")
                                : tutorSpeechStatus === "playing"
                                  ? (locale === "ko-KR" ? "설명 중" : "正在讲课")
                                : tutorSpeechStatus === "paused"
                                  ? (locale === "ko-KR" ? "일시 정지" : "讲解已暂停")
                                : tutorStatus === "thinking" || tutorStatus === "streaming"
                                  ? (locale === "ko-KR" ? "설명 중" : "讲解中")
                                  : tutorStatus === "error"
                                    ? (locale === "ko-KR" ? "다시 시도해 주세요" : "请重试")
                                    : (locale === "ko-KR" ? "수업 중" : "教学中")}
                            </p>
                          </div>
                          <p className={`mt-2 whitespace-pre-line text-[var(--foreground-secondary)] ${teachingAreaExpanded ? "text-sm leading-6" : "text-[11px] leading-5"}`} aria-live="polite" aria-busy={tutorStatus === "thinking" || tutorStatus === "streaming"}>
                            {tutorStatus === "thinking"
                              ? (tutorActiveBufferLine || (locale === "ko-KR" ? "다음 내용을 준비하고 있어요…" : "正在准备接下来的内容…"))
                              : tutorText ? renderRichTutorText(tutorText, tutorTextRich) : (tutorSpeechInProgress
                                ? "\u00a0"
                                : locale === "ko-KR"
                              ? "오른쪽 학습 영역의 장면을 먼저 살펴보세요. 준비가 되면 핵심 표현을 듣고 현재 활동을 완성해 보세요."
                              : "先观察右侧学习区中的场景。准备好后，听一听核心表达，再完成当前活动。")}
                          </p>
                          {tutorSpeechStatus !== "idle" && tutorSpeechPlaybackRef.current && (
                            <div className="mt-3 grid grid-cols-2 gap-1 border-t border-[var(--border-subtle)] pt-3">
                              <button
                                type="button"
                                onClick={toggleTutorSpeech}
                                disabled={tutorPaused || tutorSpeechStatus === "loading" || tutorSpeechStatus === "error" || tutorSpeechStatus === "ended"}
                                className="inline-flex min-h-7 items-center justify-start gap-1 rounded-lg px-1.5 text-[8px] font-bold text-[var(--foreground-secondary)] transition hover:bg-[var(--surface-soft)] disabled:opacity-40"
                              >
                                {tutorSpeechStatus === "playing" ? <Pause size={10} aria-hidden="true" /> : <Play size={10} aria-hidden="true" />}
                                {tutorSpeechStatus === "playing" ? (locale === "ko-KR" ? "일시 정지" : "暂停") : (locale === "ko-KR" ? "계속 듣기" : "继续")}
                              </button>
                              <button type="button" onClick={replayTutorSpeech} disabled={tutorPaused} className="inline-flex min-h-7 items-center justify-start gap-1 rounded-lg px-1.5 text-[8px] font-bold text-[var(--foreground-secondary)] transition hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-40">
                                <RotateCcw size={10} aria-hidden="true" />
                                {locale === "ko-KR" ? "다시 듣기" : "重播"}
                              </button>
                              <button type="button" onClick={exitTutorLesson} className="inline-flex min-h-7 items-center justify-start gap-1 rounded-lg px-1.5 text-[8px] font-bold text-[var(--destructive)] transition hover:bg-[color-mix(in_srgb,var(--destructive)_6%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                                <X size={10} aria-hidden="true" />
                                {locale === "ko-KR" ? "학습 종료" : "退出"}
                              </button>
                              <button type="button" onClick={() => setTutorSpeechMuted((current) => !current)} className="inline-flex min-h-7 items-center justify-start gap-1 rounded-lg px-1.5 text-[8px] font-bold text-[var(--foreground-secondary)] transition hover:bg-[var(--surface-soft)]" aria-pressed={tutorSpeechMuted}>
                                {tutorSpeechMuted ? <VolumeX size={10} aria-hidden="true" /> : <Volume2 size={10} aria-hidden="true" />}
                                {tutorSpeechMuted ? (locale === "ko-KR" ? "음소거 해제" : "取消静音") : (locale === "ko-KR" ? "음소거" : "静音")}
                              </button>
                            </div>
                          )}
                        </div>
                  </div>
                )}
                </section>
              </div>

              <section className="mt-4 min-h-20 flex-1" aria-label={locale === "ko-KR" ? "수업 진행" : "教学操作"}>
                {tutorPaused && (
                  <p className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3 text-xs font-semibold leading-5 text-[var(--foreground-secondary)]" role="status">
                    {locale === "ko-KR" ? "학습을 일시 정지했어요. 위의 ‘학습 계속’을 누르면 현재 위치에서 이어집니다." : "学习已暂停。点击上方“继续学习”即可从当前位置接着学习，已完成的教材进度不会丢失。"}
                  </p>
                )}
                {tutorStarted && tutorTask && (
                  <div className={`mt-4 rounded-xl border p-3.5 ${tutorTaskCompleted ? "border-[var(--status-success)] bg-[var(--status-success-surface)]" : "border-[var(--status-warning)] bg-[var(--status-warning-surface)]"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`text-[10px] font-bold ${tutorTaskCompleted ? "text-[var(--status-success)]" : "text-[var(--status-warning)]"}`}>{tutorTaskCompleted ? (locale === "ko-KR" ? "학습 영역 과제 완료" : "学习区操作已完成") : (locale === "ko-KR" ? "오른쪽 학습 영역에서 과제를 완료하세요" : "现在请操作右侧学习区")}</p>
                        <p className="mt-1.5 text-xs font-semibold leading-5 text-[var(--foreground)]">{tutorTask.instruction?.[locale] || tutorTask.targetLabel?.[locale]}</p>
                      </div>
                      {tutorTaskCompleted && <CheckCircle2 size={18} className="shrink-0 text-[var(--status-success)]" aria-hidden="true" />}
                    </div>
                    {!tutorTaskCompleted && (
                      <button type="button" onClick={() => focusTutorTask()} disabled={tutorPaused} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--status-warning)] px-3 text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                        <Volume2 size={15} aria-hidden="true" />
                        {locale === "ko-KR" ? "학습 영역에서 음성 듣기" : "去学习区听音频"}
                      </button>
                    )}
                  </div>
                )}
                {tutorTerminal && tutorStatus === "idle" && (!tutorTask?.required || tutorTaskCompleted) && (
                  <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--status-success)]" role="status">
                    <CheckCircle2 size={14} aria-hidden="true" />
                    {locale === "ko-KR" ? "설명을 마쳤어요" : "本节讲解已完成"}
                  </p>
                )}
              </section>

            </div>
          )}
          {tutorContinueReady && (
            <div
              className="fixed bottom-[116px] z-[60] flex justify-center px-4"
              style={{
                left: 0,
                width: teachingAreaExpanded
                  ? "100%"
                  : teachingAreaCollapsed
                    ? `${SMART_TEXTBOOK_SHARED_LEARNING_LAYOUT.teachingArea.collapsedWidthPx}px`
                    : `${SMART_TEXTBOOK_SHARED_LEARNING_LAYOUT.teachingArea.defaultWidthPercent}%`,
              }}
            >
              <div className="grid w-full max-w-sm grid-cols-2 gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)] p-3 shadow-[0_12px_30px_rgba(15,23,42,0.18)] motion-safe:animate-[smart-textbook-float-in_180ms_ease-out]">
                <button type="button" onClick={() => tutorReply("hint")} className="min-h-11 rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] px-3 py-2 text-xs font-bold text-[var(--foreground-secondary)] transition hover:border-[var(--status-warning)] hover:text-[var(--foreground)]">
                  {locale === "ko-KR" ? "잘 모르겠어요" : "没听懂"}
                </button>
                <button type="button" onClick={() => tutorReply("example")} className="min-h-11 rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] px-3 py-2 text-xs font-bold text-[var(--foreground-secondary)] transition hover:border-[var(--status-warning)] hover:text-[var(--foreground)]">
                  {locale === "ko-KR" ? "예문 하나 더" : "再举一个例子"}
                </button>
                <button
                  ref={tutorContinueButtonRef}
                  type="button"
                  onClick={() => tutorReply("ready")}
                  className="col-span-2 min-h-11 rounded-xl border border-[color-mix(in_srgb,var(--status-warning)_42%,var(--border-subtle))] bg-[var(--status-warning-surface)] px-3 py-2 text-xs font-bold text-[var(--status-warning)] transition hover:border-[var(--status-warning)]"
                >
                  {tutorContinueLabel || (locale === "ko-KR" ? "다음 단계로 갈게요" : "继续下一步")}
                </button>
              </div>
            </div>
          )}
        </aside>

        <div className={`relative min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${learningAreaHidden ? "xl:hidden" : ""}`} data-learning-area-hidden={learningAreaHidden || undefined}>
        <div
          data-learning-target={activeModule.code === "orientation" ? "orientation:header" : undefined}
          tabIndex={activeModule.code === "orientation" ? -1 : undefined}
          className="relative hidden shrink-0 items-center gap-3 bg-[var(--card)] after:absolute after:bottom-0 after:left-[var(--learning-header-inset)] after:right-[var(--learning-header-inset)] after:h-px after:bg-[var(--border-subtle)] after:content-[''] xl:flex"
          style={{
            height: SMART_TEXTBOOK_SHARED_LEARNING_LAYOUT.learningHeader.heightPx,
            paddingInline: SMART_TEXTBOOK_SHARED_LEARNING_LAYOUT.learningHeader.contentInsetPx,
            "--learning-header-inset": `${SMART_TEXTBOOK_SHARED_LEARNING_LAYOUT.learningHeader.contentInsetPx}px`,
          } as CSSProperties}
        >
          <button
            type="button"
            data-learning-target={activeModule.code === "orientation" ? "orientation:header:hide" : undefined}
            onClick={() => setLearningAreaManuallyHidden(true)}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold text-[var(--foreground-secondary)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
            aria-label={locale === "ko-KR" ? "학습 영역 숨기기" : "隐藏学习区"}
          >
            <PanelRightClose size={17} aria-hidden="true" />
            <span>{locale === "ko-KR" ? "학습 영역 숨기기" : "隐藏学习区"}</span>
          </button>
          {learningHeaderTargets.length > 0 && (
            <nav className="flex min-w-0 flex-1 items-center justify-center gap-1" aria-label={locale === "ko-KR" ? "학습 목표 페이지" : "学习目标分页"}>
              {learningHeaderTargets.map((target, targetIndex) => (
                <button
                  key={target}
                  type="button"
                  data-learning-target={activeModule.code === "orientation"
                    ? `orientation:header:tab:${targetIndex === 0 ? "scene" : "diagnosis"}`
                    : undefined}
                  aria-current={learningHeaderCurrentTargetIndex === targetIndex ? "page" : undefined}
                  onClick={() => learningHeaderUsesPatterns
                    ? setPatternPage(targetIndex as 0 | 1 | 2)
                    : setMissionPage(targetIndex as 0 | 1 | 2 | 3)}
                  className={`inline-flex min-h-11 min-w-0 items-center justify-center rounded-xl px-2.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] motion-reduce:transition-none ${learningHeaderCurrentTargetIndex === targetIndex ? "bg-[var(--surface-soft)] text-[var(--primary)] ring-1 ring-[var(--border-subtle)]" : "text-[var(--foreground-secondary)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"}`}
                >
                  <span className="truncate">{target}</span>
                </button>
              ))}
            </nav>
          )}
          {learningHeaderTargets.length > 0 && (
            <div className="flex shrink-0 items-center gap-2" aria-label={locale === "ko-KR" ? "현재 목표 진행률" : "当前目标进度"}>
              <div data-learning-target={activeModule.code === "orientation" ? "orientation:header:progress" : undefined} tabIndex={activeModule.code === "orientation" ? -1 : undefined} className="flex items-center gap-2 outline-none">
                <div className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-[var(--border-subtle)] 2xl:block" role="progressbar" aria-label={locale === "ko-KR" ? "현재 목표 실제 완료율" : "当前目标实际完成度"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={learningHeaderCompletionPercent}>
                  <div className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${learningHeaderCompletionPercent === 100 ? "bg-[var(--status-success)]" : "bg-[var(--primary)]"}`} style={{ width: `${learningHeaderCompletionPercent}%` }} />
                </div>
                <span className={`text-[11px] font-bold tabular-nums ${learningHeaderCompletionPercent === 100 ? "text-[var(--status-success)]" : "text-[var(--primary)]"}`} aria-live="polite">{learningHeaderCompletionPercent}%</span>
              </div>
              <span data-learning-target={activeModule.code === "orientation" ? "orientation:header:goal" : undefined} tabIndex={activeModule.code === "orientation" ? -1 : undefined} className="whitespace-nowrap text-[11px] font-bold tabular-nums text-[var(--foreground-muted)] outline-none" aria-live="polite">
                {locale === "ko-KR" ? "목표" : "目标"} {learningHeaderCurrentTargetIndex + 1} / {learningHeaderTargets.length}
              </span>
            </div>
          )}
        </div>
        {showTutorAnswerDialog && (
          <div
            className="absolute inset-0 z-40 flex items-start justify-center overflow-y-auto bg-[color-mix(in_srgb,var(--card)_72%,transparent)] px-6 py-[clamp(2rem,10vh,6rem)] backdrop-blur-[2px]"
            data-learning-agent-answer-overlay
          >
            <section
              ref={tutorAnswerDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="tutor-answer-dialog-title"
              aria-describedby="tutor-answer-dialog-description"
              tabIndex={-1}
              onKeyDown={(event) => {
                if (event.key !== "Tab") return;
                const choices = Array.from(tutorAnswerDialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
                if (choices.length === 0) return;
                const firstChoice = choices[0];
                const lastChoice = choices[choices.length - 1];
                if (event.shiftKey && document.activeElement === firstChoice) {
                  event.preventDefault();
                  lastChoice.focus();
                } else if (!event.shiftKey && document.activeElement === lastChoice) {
                  event.preventDefault();
                  firstChoice.focus();
                }
              }}
              className="w-full max-w-2xl overflow-hidden rounded-[24px] border border-[color-mix(in_srgb,var(--status-warning)_30%,var(--border-subtle))] bg-[var(--card)] shadow-[0_24px_70px_rgba(15,23,42,0.18)] outline-none"
            >
              <div className="border-b border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--status-warning)_6%,var(--card))] px-6 py-5 sm:px-7">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-h-11 items-center gap-2 text-[11px] font-bold text-[var(--status-warning)]">
                    <MessageCircle size={14} aria-hidden="true" />
                    <span>{locale === "ko-KR" ? "이제 학생 차례예요" : "现在轮到你回答"}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2" role="group" aria-label={locale === "ko-KR" ? "학습 제어" : "学习控制"}>
                    <button
                      type="button"
                      onClick={pauseTutorLesson}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] px-3 text-xs font-bold text-[var(--foreground-secondary)] transition hover:border-[var(--status-warning)] hover:text-[var(--foreground)]"
                    >
                      <Pause size={15} aria-hidden="true" />
                      {locale === "ko-KR" ? "일시 정지" : "暂停"}
                    </button>
                    <button
                      type="button"
                      onClick={exitTutorLesson}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[color-mix(in_srgb,var(--destructive)_30%,var(--border-subtle))] bg-[var(--card)] px-3 text-xs font-bold text-[var(--destructive)] transition hover:border-[var(--destructive)] hover:bg-[color-mix(in_srgb,var(--destructive)_5%,var(--card))]"
                    >
                      <X size={15} aria-hidden="true" />
                      {locale === "ko-KR" ? "종료" : "退出"}
                    </button>
                  </div>
                </div>
                <h2 id="tutor-answer-dialog-title" className="mt-2 text-lg font-bold leading-7 text-[var(--foreground)] sm:text-xl">
                  {tutorInteraction?.prompt?.[locale] || (locale === "ko-KR" ? "알맞은 답을 고르세요." : "请选择你的回答。")}
                </h2>
                <p id="tutor-answer-dialog-description" className="mt-1.5 text-xs leading-5 text-[var(--foreground-muted)]">
                  {locale === "ko-KR" ? `${agentName}의 질문을 듣고 가장 알맞은 표현을 하나 선택하세요.` : `听完${agentName}的问题，从下面选择最合适的一句话。`}
                </p>
              </div>

              <div className="grid gap-2.5 px-6 py-5 sm:px-7 sm:py-6">
                {tutorQuestionOptions.map((option, optionIndex) => {
                  const selected = tutorSelectedAnswer === option;
                  const resultTone = selected && tutorAnswerCorrect === false
                    ? "border-[var(--destructive)] bg-[color-mix(in_srgb,var(--destructive)_7%,var(--card))] text-[var(--destructive)]"
                    : selected
                      ? "border-[var(--status-warning)] bg-[var(--status-warning-surface)] text-[var(--foreground)]"
                      : "border-[var(--border-subtle)] bg-[var(--card)] text-[var(--foreground)] hover:border-[color-mix(in_srgb,var(--status-warning)_55%,var(--border-subtle))] hover:bg-[color-mix(in_srgb,var(--status-warning)_4%,var(--card))]";
                  return (
                    <button
                      key={`${option}-${optionIndex}`}
                      type="button"
                      disabled={tutorStatus === "thinking" || tutorStatus === "streaming"}
                      onClick={() => {
                        setTutorSelectedAnswer(option);
                        setTutorAnswerCorrect(null);
                        void tutorReply("answer", option);
                      }}
                      className={`flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-65 ${resultTone}`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[10px] font-bold text-[var(--foreground-muted)]">{String.fromCharCode(65 + optionIndex)}</span>
                        <span lang="ko" className="min-w-0 text-base leading-6">{option}</span>
                      </span>
                      {selected && tutorAnswerCorrect === false && <XCircle size={18} className="shrink-0" aria-label={locale === "ko-KR" ? "다시 생각해 보세요" : "请再想一想"} />}
                    </button>
                  );
                })}

                <div className="min-h-6 pt-1 text-xs leading-5" aria-live="polite" aria-atomic="true">
                  {(tutorStatus === "thinking" || tutorStatus === "streaming") && (
                    <p className="text-[var(--foreground-muted)]">{locale === "ko-KR" ? "선생님이 답을 확인하고 있어요…" : "老师正在确认你的回答…"}</p>
                  )}
                  {tutorStatus === "idle" && tutorAnswerCorrect === false && tutorText && (
                    <p role="alert" className="font-semibold text-[var(--destructive)]">{renderRichTutorText(tutorText, tutorTextRich)}</p>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        <main
          id="korean-textbook-content"
          tabIndex={0}
          aria-hidden={showTutorAnswerDialog || undefined}
          inert={showTutorAnswerDialog || undefined}
          aria-label={locale === "ko-KR" ? "교재 본문, 방향키와 페이지 키로 스크롤할 수 있습니다" : "教材正文，可使用方向键或翻页键滚动阅读"}
          className="smart-textbook-scroll min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-[var(--card)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
        >
          <div className="w-full px-5 pb-8 pt-4 sm:px-8 sm:pb-10 sm:pt-5 lg:px-10 xl:px-12">
            {textbook.chapter.number === 0 ? (
              <>
                <KoreanLevelOneCourseOverview moduleCode={activeModule.code} locale={locale} />
                {activeNodes.flatMap((node) => node.activities).map((activity) => (
                  <Activity
                    key={activity.id}
                    activity={activity}
                    locale={locale}
                    trackingDisabled={trackingDisabled}
                    onCompleted={recordCompletion}
                  />
                ))}
              </>
            ) : (
              <>
            {activeIndex === 0 && textbook.chapter.number !== 1 && (
              <section className="mb-10 overflow-hidden rounded-[26px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-5 sm:p-7">
                <div className="mb-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--primary)]">
                    <BookOpen size={19} />
                  </span>
                  <div>
                    <h2 className="mt-1 text-lg font-bold">开始本章之前</h2>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-[var(--card)] p-5 ring-1 ring-[var(--border-subtle)]">
                  <p className="text-xs font-bold tracking-[.18em] text-[var(--support)]">{t.scene.toUpperCase()}</p>
                  <p className="mt-3 text-[15px] leading-7 text-[var(--foreground-secondary)] sm:text-[16px]">{localize(textbook.chapter.scenario)}</p>
                </div>
                <div className="rounded-2xl bg-[var(--card)] p-5 ring-1 ring-[var(--border-subtle)]">
                  <p className="text-xs font-bold tracking-[.18em] text-[var(--status-success)]">{t.objective.toUpperCase()}</p>
                  <p className="mt-3 text-[15px] leading-7 text-[var(--foreground-secondary)] sm:text-[16px]">{localize(textbook.chapter.goal)}</p>
                </div>
                </div>
              </section>
            )}
            {activeNodes.map((node, nodeIndex) => {
              const sharedModuleSkeleton = getSmartTextbookSkeletonModule(activeModule.code);
              const hasReadyImage = node.media.some((asset) => asset.type === "image" && asset.status === "ready" && asset.url);
              const readingActivity = node.activities.find((activity) => activity.type === "single_choice" && typeof activity.config.reading === "string");
              const writingActivity = node.activities.find((activity) => activity.type === "writing");
              const reviewActivity = node.activities.find((activity) => activity.type === "multiple_choice");
              const selfCheckActivity = node.activities.find((activity) => activity.type === "self_check");
              const usesReadWritePager = activeModule.code === "read_write" && Boolean(readingActivity && writingActivity);
              const usesReviewPager = activeModule.code === "review" && Boolean(reviewActivity && selfCheckActivity);
              const hasIntegratedImageHeader = nodeIndex === 0 && hasReadyImage;
              const usesDesktopImagePager = nodeIndex === 0 && node.activities.length > 0 && Boolean(sharedModuleSkeleton);
              const usesGrammarPager = Array.isArray(node.content.grammarCards) && node.content.grammarCards.length > 0;
              const usesPatternPager = activeModule.code === "patterns" && node.activities.some((activity) => activity.type === "ordering");
              const patternChoiceActivity = node.activities.find((activity) => activity.key === "pattern-choice");
              const patternOrderActivity = node.activities.find((activity) => activity.type === "ordering");
              const patternComposeActivity = node.activities.find((activity) => activity.key === "pattern-compose");
              const usesDialoguePager = Array.isArray(node.content.dialogueScenes) && node.content.dialogueScenes.length > 0;
              const usesListenSpeakPager = activeModule.code === "listen_speak"
                && node.activities.some((activity) => activity.type === "listening")
                && node.activities.some((activity) => activity.type === "speaking");
              const dialogueRoleplayActivity = node.activities.find((activity) => activity.key === "dialogue-roleplay");
              return (
              <article
                key={node.id}
                data-learning-target={nodeIndex === 0
                  ? activeModule.code === "orientation"
                    ? missionPage === 0 ? "orientation:page:scene" : "orientation:page:diagnosis"
                    : "content:current"
                  : undefined}
                tabIndex={nodeIndex === 0 ? -1 : undefined}
                className="mt-8 outline-none first:mt-0 sm:mt-10 sm:first:mt-0"
              >
                {!hasIntegratedImageHeader && <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="flex min-w-0 items-center gap-3">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent.solid }} />
                    {nodeIndex === 0 ? (
                      <CardTitleWithHint
                        title={(
                          <>
                            <span>{localize(activeModule.title)}</span>
                            <span className="text-[11px] font-medium tabular-nums text-[var(--foreground-muted)]">
                              {locale === "ko-KR" ? `제 ${String(activeIndex + 1).padStart(2, "0")} 단계` : `第 ${String(activeIndex + 1).padStart(2, "0")} 步`}
                              <span className="mx-1" aria-hidden="true">·</span>
                              {locale === "ko-KR" ? "예상" : "预计"} {activeNodes.reduce((total, currentNode) => total + currentNode.minutes, 0)} {t.minutes}
                            </span>
                          </>
                        )}
                        description={localize(activeModule.description)}
                        headingLevel={1}
                        className="items-center"
                        titleClassName="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-lg font-bold text-[var(--foreground)]"
                        hintClassName="-ml-1"
                        hintLabel={locale === "ko-KR" ? "학습 단계 설명 보기" : "查看学习步骤说明"}
                      />
                    ) : (
                      <h2 className="text-lg font-bold text-[var(--foreground)]">{localize(node.title)}</h2>
                    )}
                  </div>
                </div>}
                {usesListenSpeakPager && <ListenSpeakLearningPanel node={node} locale={locale} supportMode={supportMode} page={missionPage} moduleHeader={nodeIndex === 0 ? { title: localize(activeModule.title), stepLabel: locale === "ko-KR" ? `제 ${String(activeIndex + 1).padStart(2, "0")} 단계` : `第 ${String(activeIndex + 1).padStart(2, "0")} 步`, minutes: activeNodes.reduce((total, currentNode) => total + currentNode.minutes, 0) } : undefined} />}
                {usesReadWritePager && <ReadWriteLearningPanel node={node} locale={locale} page={missionPage} />}
                {usesReviewPager && missionPage === 2 && <ReviewResultPanel node={node} locale={locale} savedResponses={savedActivityResponses} />}
                <div
                  data-learning-target={usesPatternPager
                    ? `activity:${(patternPage === 0 ? patternChoiceActivity : patternPage === 2 ? patternComposeActivity : patternOrderActivity)?.id ?? ""}`
                    : undefined}
                  tabIndex={usesPatternPager ? -1 : undefined}
                  className={`${usesListenSpeakPager || usesReadWritePager || usesReviewPager ? "hidden" : usesDesktopImagePager && ((!usesPatternPager && !usesDialoguePager && missionPage === 1) || (usesDialoguePager && missionPage >= 2)) ? "lg:hidden" : ""} ${usesPatternPager ? "outline-none" : ""}`}
                >
                  <ContentRenderer
                    node={node}
                    locale={locale}
                    supportMode={supportMode}
                    contentPage={usesDialoguePager ? missionPage : 0}
                    patternPage={usesPatternPager ? patternPage : 0}
                    trackingDisabled={trackingDisabled}
                    onActivityCompleted={recordCompletion}
                    onLearningEvent={(event) => { void recordTutorLearningEvent(event); }}
                    moduleHeader={nodeIndex === 0 ? {
                      title: localize(activeModule.title),
                      description: localize(activeModule.description),
                      stepLabel: locale === "ko-KR"
                        ? `제 ${String(activeIndex + 1).padStart(2, "0")} 단계`
                        : `第 ${String(activeIndex + 1).padStart(2, "0")} 步`,
                      minutes: activeNodes.reduce((total, currentNode) => total + currentNode.minutes, 0),
                    } : undefined}
                  />
                </div>
                <div className={`${usesDesktopImagePager && (usesPatternPager ? patternPage !== 2 : usesDialoguePager ? missionPage !== 2 : usesReadWritePager ? ![1, 3].includes(missionPage) : usesReviewPager ? ![0, 1].includes(missionPage) : missionPage === 0) ? "lg:hidden" : ""} ${usesDesktopImagePager ? "lg:[&>section:first-child]:mt-0" : ""}`}>
                  {node.activities.filter((activity) => activity.key !== "dialogue-roleplay" && (!usesPatternPager || !["pattern-choice", "pattern-order", "pattern-compose"].includes(activity.key)) && (!usesListenSpeakPager || (missionPage === 1 && activity.type === "listening") || (missionPage === 3 && activity.type === "speaking")) && (!usesReadWritePager || (missionPage === 1 && activity.id === readingActivity?.id) || (missionPage === 3 && activity.id === writingActivity?.id)) && (!usesReviewPager || (missionPage === 0 && activity.id === reviewActivity?.id) || (missionPage === 1 && activity.id === selfCheckActivity?.id))).map((activity, activityIndex) => (
                    <div key={activity.id} data-learning-target={`activity:${activity.id}`} tabIndex={-1} hidden={usesGrammarPager && activityIndex !== activeGrammarPracticeIndex} className="outline-none">
                      <Activity
                        activity={activity}
                        locale={locale}
                        trackingDisabled={trackingDisabled}
                        onCompleted={(result) => {
                          recordCompletion(result);
                          if (!result.preview && result.activityId && result.response !== undefined) {
                            setSavedActivityResponses((current) => ({ ...current, [result.activityId!]: result.response }));
                          }
                        }}
                        round={usesGrammarPager || usesPatternPager || usesDialoguePager || usesListenSpeakPager || usesReadWritePager || usesReviewPager ? undefined : { current: activityIndex + 1, total: node.activities.length }}
                        grammarPageOffset={activityIndex * 2}
                        onPreviousGrammarActivity={usesGrammarPager && activityIndex > 0 ? () => setActiveGrammarPracticeIndex(activityIndex - 1) : undefined}
                        onNextGrammarActivity={usesGrammarPager && activityIndex < node.activities.length - 1 ? () => setActiveGrammarPracticeIndex(activityIndex + 1) : undefined}
                        isLastGrammarActivity={usesGrammarPager && activityIndex === node.activities.length - 1}
                      />
                    </div>
                  ))}
                </div>
                {usesDialoguePager && dialogueRoleplayActivity && missionPage === 3 && (
                  <div data-learning-target={`activity:${dialogueRoleplayActivity.id}`} tabIndex={-1} className="outline-none">
                    <DialogueRoleplayPractice
                      activity={dialogueRoleplayActivity}
                      scenes={(node.content.dialogueScenes as unknown[]).map(objectValue)}
                      locale={locale}
                      onActivityCompleted={recordCompletion}
                    />
                  </div>
                )}
              </article>
              );
            })}
              </>
            )}
            <div className="h-12" />
          </div>
        </main>
        </div>
        </div>

      </div>

      {!assistantCollapsed && tutorWindowPosition && (
        <aside
          ref={tutorWindowRef}
          role="dialog"
          aria-modal="false"
          aria-label={t.tutor}
          className="fixed z-40 hidden h-[min(680px,calc(100dvh-118px))] w-[400px] overflow-hidden rounded-[24px] border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--card)_92%,transparent)] shadow-2xl backdrop-blur-xl lg:flex lg:flex-col"
          style={{ left: tutorWindowPosition.x, top: tutorWindowPosition.y }}
        >
          <div
            className="flex h-14 shrink-0 touch-none select-none items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 cursor-grab active:cursor-grabbing"
            onPointerDown={startTutorWindowDrag}
            onPointerMove={moveTutorWindow}
            onPointerUp={stopTutorWindowDrag}
            onPointerCancel={stopTutorWindowDrag}
            aria-label={locale === "ko-KR" ? "학습 도우미 창 이동" : "拖动学习助手窗口"}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <GripHorizontal size={17} className="shrink-0 text-[var(--foreground-muted)]" aria-hidden="true" />
              <MessageCircle size={17} className="shrink-0 text-[var(--primary)]" aria-hidden="true" />
              <p className="truncate text-sm font-bold text-[var(--foreground)]">{t.tutor}</p>
            </div>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setAssistantCollapsed(true)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--foreground-muted)] transition hover:bg-[var(--card)] hover:text-[var(--foreground)]"
              aria-label={locale === "ko-KR" ? `${agentName} 닫기` : `关闭${agentName}`}
            >
              <X size={17} aria-hidden="true" />
            </button>
          </div>
          <div className="min-h-0 flex-1 p-3">{renderTutorPanel(false, true)}</div>
        </aside>
      )}

      <footer className="relative z-30 h-[68px] shrink-0 border-t-4 border-double border-[var(--border-subtle)] bg-[var(--card)] px-3 sm:px-5 lg:h-[72px] lg:px-7">
        <div className="flex h-full items-center justify-between gap-3">
          <button type="button" disabled={activeIndex === 0} onClick={() => selectModule(Math.max(0, activeIndex - 1))} className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl px-1 text-[11px] font-bold text-slate-500 hover:bg-[var(--surface-soft)] hover:text-slate-900 disabled:opacity-25 sm:gap-2 sm:px-2">
            <ChevronLeft size={16} /> <span className="hidden min-[360px]:inline">{t.previous}</span>
          </button>
          <nav className="smart-textbook-scroll hidden min-w-0 flex-1 overflow-x-auto px-2 lg:block" aria-label={locale === "ko-KR" ? "학습 단계 시간선" : "学习小节时间轴"}>
            <ol
              className="relative grid min-w-[760px]"
              style={{ gridTemplateColumns: `repeat(${textbook.modules.length}, minmax(0, 1fr))` }}
            >
              <span
                className="pointer-events-none absolute top-[9px] h-px bg-[var(--border-subtle)]"
                style={{ left: `${50 / Math.max(textbook.modules.length, 1)}%`, right: `${50 / Math.max(textbook.modules.length, 1)}%` }}
                aria-hidden="true"
              />
              {textbook.modules.map((module, index) => {
                const active = index === activeIndex;
                const done = moduleDone(index);
                const chapterOneKnowledge = chapterOneKnowledgeMap[module.code as keyof typeof chapterOneKnowledgeMap];
                const title = textbook.chapter.number === 1
                  ? chapterOneKnowledge?.title[locale] ?? localize(module.title)
                  : localize(module.title);
                return (
                  <li key={module.id} className="relative min-w-0 px-1">
                    <button
                      type="button"
                      onClick={() => selectModule(index)}
                      aria-current={active ? "step" : undefined}
                      aria-label={`${index + 1}. ${title}${done ? locale === "ko-KR" ? ", 완료" : "，已完成" : ""}`}
                      className={`group flex min-h-12 w-full flex-col items-center rounded-xl px-1 py-0.5 text-center transition hover:bg-[var(--surface-soft)] ${active ? "text-[var(--primary)]" : done ? "text-[var(--status-success)]" : "text-[var(--foreground-muted)]"}`}
                    >
                      <span className={`relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 bg-[var(--card)] text-[8px] font-bold tabular-nums ${active ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]" : done ? "border-[var(--status-success)] text-[var(--status-success)]" : "border-[var(--border)] text-[var(--foreground-muted)]"}`}>
                        {done && !active ? <Check size={10} aria-hidden="true" /> : index + 1}
                      </span>
                      <span className={`mt-0.5 line-clamp-2 text-[8px] font-semibold leading-[11px] ${active ? "text-[var(--foreground)]" : ""}`}>{title}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
          <p className="text-xs font-bold tabular-nums text-[var(--foreground-muted)] lg:hidden" aria-live="polite">{activeIndex + 1} / {textbook.modules.length}</p>
          {isLastModule ? (
            chapterTestHref && progressPercent >= 100 ? (
              <Link href={chapterTestHref} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--primary)] px-3.5 py-2 text-[11px] font-bold text-[var(--primary-foreground)] hover:opacity-90 sm:gap-2 sm:px-5">
                {t.chapterTest} <ChevronRight size={16} />
              </Link>
            ) : completionHref && progressPercent >= 100 ? (
              <Link href={completionHref} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--primary)] px-3.5 py-2 text-[11px] font-bold text-[var(--primary-foreground)] hover:opacity-90 sm:gap-2 sm:px-5">
                {completionLabel ?? t.next} <ChevronRight size={16} />
              </Link>
            ) : (
              <button type="button" disabled className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-200 px-3.5 py-2 text-[11px] font-bold text-slate-400 sm:px-5">
                {chapterTestHref ? "完成八个学习节点后解锁" : completionHref ? "完成本章后解锁" : t.testUnavailable}
              </button>
            )
          ) : (
            <button type="button" onClick={() => selectModule(Math.min(textbook.modules.length - 1, activeIndex + 1))} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--primary)] px-3.5 py-2 text-[11px] font-bold text-[var(--primary-foreground)] hover:opacity-90 sm:gap-2 sm:px-5">
              {t.next} <ChevronRight size={16} />
            </button>
          )}
        </div>
      </footer>

      {mobilePanel && (
        <div className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-sm lg:hidden" role="presentation" onClick={() => setMobilePanel(null)}>
          <aside className={`absolute bottom-0 top-0 w-[min(88vw,360px)] bg-[var(--background)] p-4 shadow-2xl ${mobilePanel === "path" ? "left-0" : "right-0"}`} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={mobilePanel === "path" ? sidebarLabel : t.tutor}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                {mobilePanel === "path" ? <BookOpen size={18} className="text-[var(--status-success)]" /> : <MessageCircle size={18} className="text-[var(--primary)]" />}
                {mobilePanel === "path" ? sidebarLabel : t.tutor}
              </div>
              <button type="button" autoFocus onClick={() => setMobilePanel(null)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--card)] text-[var(--foreground-muted)]" aria-label={locale === "ko-KR" ? "닫기" : "关闭"}>
                <X size={17} />
              </button>
            </div>
            <div className="smart-textbook-scroll h-[calc(100%_-_3.25rem)] overflow-y-auto">
              {mobilePanel === "path" ? renderChapterSidebar(false) : renderTutorPanel(false)}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
