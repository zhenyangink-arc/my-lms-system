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
  Pause,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Volume2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";

import type {
  SmartLocale,
  SmartSupportMode,
  SmartTextbookActivity,
  SmartTextbookData,
  SmartTextbookNode,
} from "@/lib/smart-digital-textbook";
import {
  checkSmartTextbookActivityPageAction,
  saveSmartTextbookPreferenceAction,
  submitSmartTextbookActivityAction,
} from "./smart-textbook-actions";
import {
  isServerConfirmedNodeCompletion,
  isSmartTextbookModuleCompleted,
} from "./smart-textbook-completion";
import { KoreanLevelOneCourseOverview } from "./KoreanLevelOneCourseOverview";

export type SmartTextbookShellProps = {
  backHref: string;
  textbook: SmartTextbookData;
  trackingDisabled: boolean;
  completionHref?: string;
  completionLabel?: string;
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
    tutor: "本章学习助手",
    grounded: "提供本章预设解释与练习提示",
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
    recordingUploading: "正在安全上传录音…",
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
    tutor: "단원 학습 도우미",
    grounded: "이 단원의 미리 준비된 설명과 연습 힌트를 제공합니다",
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
    recordingUploading: "녹음을 안전하게 업로드하고 있어요…",
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

function asBooleanArray(value: unknown) {
  return Array.isArray(value) ? value.map(Boolean) : [];
}

function speakKorean(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ko-KR";
  utterance.rate = 0.82;
  window.speechSynthesis.speak(utterance);
}

function speakKoreanSequence(
  texts: string[],
  options: {
    isCurrent: () => boolean;
    onStep: (index: number) => void;
    onComplete: () => void;
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

  const speakNext = (index: number) => {
    if (!options.isCurrent()) return;
    const text = sequence[index];
    if (!text) {
      options.onComplete();
      return;
    }
    options.onStep(index);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = 0.82;
    utterance.onend = () => speakNext(index + 1);
    utterance.onerror = () => speakNext(index + 1);
    window.speechSynthesis.speak(utterance);
  };

  speakNext(0);
}

function ContentRenderer({
  node,
  locale,
  supportMode,
  moduleHeader,
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
}) {
  const [sceneDialogueStep, setSceneDialogueStep] = useState(0);
  const [sceneDialoguePlaying, setSceneDialoguePlaying] = useState(false);
  const [activeDialogueGroupIndex, setActiveDialogueGroupIndex] = useState(0);
  const [activeGrammarCardIndex, setActiveGrammarCardIndex] = useState(0);
  const [guidedDialogueIndex, setGuidedDialogueIndex] = useState<number | null>(null);
  const [vocabularyPlaybackIndex, setVocabularyPlaybackIndex] = useState<number | null>(null);
  const [vocabularyPlaying, setVocabularyPlaying] = useState(false);
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
  const contrast = stringArray(content.contrast);
  const grammarCards = Array.isArray(content.grammarCards)
    ? content.grammarCards.map(objectValue)
    : [];
  const dialogueScenes = Array.isArray(content.dialogueScenes)
    ? content.dialogueScenes.map(objectValue)
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

  const playSceneDialogue = () => {
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
    });
  };

  const playGuidedDialogueLine = (index: number) => {
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
    const finish = () => {
      if (sceneDialogueRunRef.current === runId) setSceneDialoguePlaying(false);
    };
    utterance.onend = finish;
    utterance.onerror = finish;
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
          <figure className="relative mb-5 aspect-[4/3] overflow-hidden rounded-[22px] bg-[var(--surface-soft)] sm:aspect-[5/2]">
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
              onClick={playSceneDialogue}
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
              <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-white/90">
                <span>30 {locale === "ko-KR" ? "초 연속 말하기" : "秒连续表达"}</span>
                <span aria-hidden="true">·</span>
                <span>{targets.length} {locale === "ko-KR" ? "가지 의사소통 기능" : "项交流功能"}</span>
              </p>
            </figcaption>
          </figure>
        )}
        <section className="rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-5 sm:p-6">
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
                onClick={() => playGuidedDialogueLine(guidedDialogueIndex === null || guidedDialogueIndex >= sceneDialogueLines.length - 1 ? 0 : guidedDialogueIndex + 1)}
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
                onClick={playSceneDialogue}
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
              return (
              <button
                key={`${String(line.ko)}-${index}`}
                type="button"
                onClick={() => speakKorean(String(line.ko))}
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

  return (
    <div className="mt-8 space-y-10">
      {imageAssets.length > 0 && (
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
                    onClick={playSceneDialogue}
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

      {String(content.pattern ?? "") && (
        <div className="border-y border-slate-200 py-7">
          <p className="text-xs font-bold tracking-[.16em] text-slate-400">句型</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{String(content.pattern)}</p>
          {substitutions.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {substitutions.map((item) => (
                <span key={item} className="rounded-full bg-[var(--status-warning-surface)] px-3 py-1.5 text-sm font-semibold text-[var(--destructive)]">{item}</span>
              ))}
            </div>
          )}
        </div>
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

      {String(coach[locale] ?? "") && (
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
}: {
  activityId: string;
  locale: SmartLocale;
  onReady: (value: {
    durationSeconds: number;
    recordingEvidenceId: string;
  }) => void;
  onReset: () => void;
}) {
  const t = ui[locale];
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState("");

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setRecordingError(t.recordingDenied);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      setRecordingError("");
      onReset();
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
        const durationSeconds = Math.max(
          1,
          Math.round((Date.now() - startedAtRef.current) / 1000),
        );
        setUploading(true);
        try {
          const formData = new FormData();
          formData.set("recording", blob, "recording");
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
          onReady({
            durationSeconds,
            recordingEvidenceId: result.evidenceId,
          });
        } catch {
          setRecordingError(t.recordingUploadFailed);
          onReset();
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
    <div className="mt-5 flex flex-wrap items-center gap-4 border-y border-slate-200 py-5">
      <button type="button" onClick={toggleRecording} disabled={uploading} className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45 ${recording ? "bg-[var(--status-warning)]" : "bg-[var(--status-success)]"}`}>
        {recording ? <Square size={14} /> : <Mic size={15} />}
        {recording ? t.stopRecording : t.startRecording}
      </button>
      {audioUrl && <audio src={audioUrl} controls className="h-9 max-w-full" />}
      {uploading && <span role="status" className="text-xs font-semibold text-[var(--support)]">{t.recordingUploading}</span>}
      {audioUrl && !uploading && !recordingError && <span className="text-xs font-semibold text-[var(--status-success)]">{t.recorded}</span>}
      {recordingError && <p className="w-full text-xs font-semibold text-[var(--destructive)]">{recordingError}</p>}
    </div>
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
    activity.type === "single_choice" && configItems.length > 0;
  const usesFlipCards =
    groupedSingleChoice && activity.config.presentation === "flip_cards";
  const isGrammarPractice = ["choice", "judgment", "fill"].includes(
    String(activity.config.practiceKind ?? ""),
  );
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
      return stableIndexOrder(
        activity.options.length,
        `${activity.id}:ordering`,
        true,
      );
    }
    if (activity.type === "fill_blank" && configItems.length > 0) {
      return configItems.map(() => "");
    }
    if (groupedSingleChoice) return configItems.map(() => -1);
    if (requiresConfirmation) return { selection: -1, confirmed: false };
    if (activity.type === "speaking") {
      return { recorded: false, durationSeconds: 0, turns: 0, criteria: [] };
    }
    if (activity.type === "writing") {
      return { text: "", informationKinds: [], rubricConfirmed: false };
    }
    if (activity.type === "self_check") {
      return { checks: configItems.map(() => ""), returnNodes: [], note: "" };
    }
    return "";
  });
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [activeGroupedChoicePage, setActiveGroupedChoicePage] = useState(0);
  const [activeFillBlankPage, setActiveFillBlankPage] = useState(0);
  const [pageChecks, setPageChecks] = useState<Record<number, { results: boolean[]; answers: Array<number | string>; revealed: boolean }>>({});
  const [checkingPage, setCheckingPage] = useState(false);
  const [practiceFocused, setPracticeFocused] = useState(false);
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
  const activePageReady = activityCompleted || Boolean(activePageCheck && (activePageCheck.revealed || activePageCheck.results.every(Boolean)));

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
      itemIndices: activeGrammarItems.map(({ originalIndex }) => originalIndex),
      response: activeGrammarItems.map(({ originalIndex }) => values[originalIndex]),
    });
    setCheckingPage(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setPageChecks((current) => ({ ...current, [activeGrammarPage]: { ...result, revealed: false } }));
  }

  function revealGrammarAnswers() {
    if (!activePageCheck) return;
    const next = Array.isArray(answer) ? [...answer] : [];
    activeGrammarItems.forEach(({ originalIndex }, index) => { next[originalIndex] = activePageCheck.answers[index]; });
    setAnswer(next);
    setPageChecks((current) => ({ ...current, [activeGrammarPage]: { ...activePageCheck, revealed: true } }));
  }

  function clearActivePageCheck() {
    setPageChecks((current) => {
      const next = { ...current };
      delete next[activeGrammarPage];
      return next;
    });
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

  function hasResponse() {
    if (activity.type === "writing") {
      return typeof objectValue(answer).text === "string" && String(objectValue(answer).text).trim().length > 0;
    }
    if (activity.type === "speaking") {
      const response = objectValue(answer);
      return response.recorded === true && typeof response.durationSeconds === "number" && Number.isFinite(response.durationSeconds) && response.durationSeconds > 0 && typeof response.recordingEvidenceId === "string";
    }
    if (activity.type === "self_check") {
      const checks = objectValue(answer).checks;
      const returnNodes = objectValue(answer).returnNodes;
      return Array.isArray(checks) && checks.length === configItems.length && checks.every((item) => item === "can" || item === "review") && Array.isArray(returnNodes) && returnNodes.length > 0;
    }
    if (groupedSingleChoice) {
      return Array.isArray(answer) && answer.length === configItems.length && answer.every((item, index) => typeof item === "number" && Number.isInteger(item) && item >= 0 && item < stringArray(configItems[index]?.options).length);
    }
    if (requiresConfirmation) {
      const response = objectValue(answer);
      return typeof response.selection === "number" && Number.isInteger(response.selection) && response.selection >= 0 && response.selection < activity.options.length && response.confirmed === true;
    }
    if (activity.type === "single_choice" || activity.type === "listening") {
      return typeof answer === "number" && Number.isInteger(answer) && answer >= 0 && answer < activity.options.length;
    }
    if (activity.type === "multiple_choice") {
      return Array.isArray(answer) && answer.length > 0 && answer.every((item) => typeof item === "number" && Number.isInteger(item) && item >= 0 && item < activity.options.length) && new Set(answer).size === answer.length;
    }
    if (activity.type === "fill_blank") {
      return typeof answer === "string"
        ? answer.trim().length > 0
        : Array.isArray(answer) &&
            answer.length === configItems.length &&
            answer.every(
              (item) => typeof item === "string" && item.trim().length > 0,
            );
    }
    if (activity.type === "ordering") {
      return Array.isArray(answer) && answer.length === activity.options.length && answer.every((item) => typeof item === "number" && Number.isInteger(item) && item >= 0 && item < activity.options.length) && new Set(answer).size === activity.options.length;
    }
    return false;
  }

  function submit() {
    setFeedback(null);
    if (!hasResponse() || hasPendingAudio) {
      setMessage(hasPendingAudio ? t.audioPending : t.noResponse);
      return;
    }
    setMessage("");
    setNeedsReload(false);
    startTransition(async () => {
      try {
        const result = await submitSmartTextbookActivityAction({ activityId: activity.id, response: answer, locale });
        setFeedback(result);
        if (result.ok) {
          onCompleted({
            nodeId: result.nodeId,
            nodeCompleted: result.nodeCompleted,
            completionPercent: result.completionPercent,
            preview: result.preview,
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
      role={practiceFocused ? "dialog" : undefined}
      aria-modal={practiceFocused ? true : undefined}
      aria-label={practiceFocused
        ? locale === "ko-KR" ? "문법 집중 연습" : "语法专注练习"
        : undefined}
      onKeyDown={keepFocusInsidePractice}
      className={practiceFocused
        ? "fixed inset-0 z-[100] m-0 flex overflow-y-auto rounded-none border-0 bg-[var(--background)] p-4 sm:p-8"
        : isGrammarPractice
          ? "mt-5 rounded-[22px] bg-[var(--surface-soft)] p-5 sm:p-6"
          : "mt-10 rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-5 sm:p-6"}
    >
      <div className={practiceFocused
        ? "m-auto w-full max-w-4xl rounded-[32px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-5 shadow-[0_24px_80px_rgba(15,23,42,0.14)] sm:p-8"
        : ""}
      >
      <div className={isGrammarPractice ? "flex flex-col gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6" : "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6"}>
        <div>
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
          {isGrammarPractice && (
            <nav className="flex items-center gap-2" aria-label={locale === "ko-KR" ? "문법 연습 페이지" : "语法练习分页"}>
              <button type="button" disabled={activeGrammarPage === 0 && !onPreviousGrammarActivity} onClick={previousGrammarPage} className="min-h-9 rounded-lg px-3 text-sm font-bold text-[var(--foreground-secondary)] hover:bg-[var(--surface-soft)] disabled:opacity-30">{locale === "ko-KR" ? "이전" : "上一页"}</button>
              <span className="min-w-12 text-center text-xs font-bold tabular-nums text-[var(--foreground-muted)]">{grammarPageOffset + activeGrammarPage + 1} / 6</span>
              {(!isLastGrammarActivity || !isLastGrammarPracticePage) && <button type="button" disabled={!activePageReady} onClick={nextGrammarPage} className="min-h-9 rounded-lg px-3 text-sm font-bold text-[var(--primary)] hover:bg-[var(--accent)] disabled:opacity-30">{locale === "ko-KR" ? "다음" : "下一页"}</button>}
            </nav>
          )}
          {activityCompleted && (
            <span className="text-xs font-bold text-[var(--status-success)]">
              {feedback?.correct === null ? t.submittedForReview : t.submitted}
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
                <legend className="text-sm font-bold leading-6 text-[var(--foreground)]">{pageItemIndex + 1}. {String(item.question)}</legend>
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

      {activity.type === "listening" && !hasPendingAudio && (
        <div className="mt-6 flex flex-col items-stretch gap-4 border-y border-slate-200 bg-[var(--accent)]/55 px-4 py-5 sm:flex-row sm:items-center sm:px-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[var(--support)] shadow-sm">
            <Headphones size={19} />
          </span>
          <audio
            controls
            preload="none"
            src={`/api/digital-textbook/audio/${activity.id}`}
            className="h-10 w-full"
          />
          <span className="shrink-0 text-xs font-bold text-[var(--support)]">
            {t.listenPrivate}
          </span>
        </div>
      )}

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
                  <input value={values[originalIndex] ?? ""} onChange={(event) => {
                    const next = [...values];
                    next[originalIndex] = event.target.value;
                    setAnswer(next);
                    setFeedback(null);
                    clearActivePageCheck();
                  }} lang="ko" autoComplete="off" className={`min-h-12 rounded-xl border px-4 text-base font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${activePageCheck ? activePageCheck.results[pageItemIndex] || activePageCheck.revealed ? "border-[var(--status-success)] bg-[var(--status-success-surface)] text-[var(--status-success)]" : "border-[var(--destructive)] bg-[var(--destructive)]/10 text-[var(--destructive)]" : "border-[var(--border-subtle)] bg-[var(--surface-soft)] text-[var(--foreground)]"}`} placeholder={String(item.placeholder ?? "")} />
                </label>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {activity.type === "ordering" && (
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
        <div className="mt-6">
          <textarea value={String(objectValue(answer).text ?? "")} onChange={(event) => { setAnswer({ ...objectValue(answer), text: event.target.value }); setFeedback(null); }} lang="ko" rows={5} aria-label={activity.prompt[locale]} className="w-full resize-none border-x-0 border-b-2 border-t border-slate-200 bg-slate-50/50 px-4 py-4 text-[16px] leading-8 text-slate-900 outline-none focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2" placeholder="한국어로 4~5문장을 쓰세요." />
          <p className="mt-2 text-right text-xs text-slate-400">{t.writingCount} · {String(objectValue(answer).text ?? "").length}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {stringArray(activity.config.informationChecklist).map((label, index) => {
              const selected = asBooleanArray(objectValue(answer).informationKinds);
              return <label key={label} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-[var(--card)] px-3 py-2 text-sm"><input type="checkbox" checked={selected[index] ?? false} onChange={(event) => { const next = [...selected]; next[index] = event.target.checked; setAnswer({ ...objectValue(answer), informationKinds: next }); setFeedback(null); }} />{label}</label>;
            })}
          </div>
          <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={objectValue(answer).rubricConfirmed === true} onChange={(event) => { setAnswer({ ...objectValue(answer), rubricConfirmed: event.target.checked }); setFeedback(null); }} />{String(activity.config.rubricConfirmation ?? "我已按量规完成自查")}</label>
        </div>
      )}

      {activity.type === "speaking" && (
        <div>
          <RecordingControl
            activityId={activity.id}
            locale={locale}
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
        <div className="mt-6 space-y-5">
          {configItems.map((item, index) => {
            const current = stringArray(objectValue(answer).checks);
            return <fieldset key={String(item.id ?? index)}><legend className="text-sm font-bold leading-6">{String(item.label)}</legend><div className="mt-2 flex flex-wrap gap-2">{[["can", "能独立完成／혼자 할 수 있어요"], ["review", "需要复习／복습이 필요해요"]].map(([value, label]) => <button key={value} type="button" onClick={() => { const next = [...current]; next[index] = value; setAnswer({ ...objectValue(answer), checks: next }); setFeedback(null); }} className={`min-h-11 rounded-xl border px-3 py-2 text-sm ${current[index] === value ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border-subtle)]"}`}>{label}</button>)}</div></fieldset>;
          })}
          <fieldset><legend className="text-sm font-bold">{locale === "ko-KR" ? "다음 복습 위치" : "下一步复习位置"}</legend><div className="mt-2 flex flex-wrap gap-2">{(Array.isArray(activity.config.returnNodes) ? activity.config.returnNodes.map(objectValue) : []).map((item) => { const selected = stringArray(objectValue(answer).returnNodes); const value = String(item.value); return <button key={value} type="button" onClick={() => { const next = value === "none" ? ["none"] : selected.includes(value) ? selected.filter((entry) => entry !== value) : [...selected.filter((entry) => entry !== "none"), value]; setAnswer({ ...objectValue(answer), returnNodes: next }); setFeedback(null); }} className={`min-h-11 rounded-xl border px-3 py-2 text-sm ${selected.includes(value) ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border-subtle)]"}`}>{String(item.label)}</button>; })}</div></fieldset>
          <label className="grid gap-2 text-sm font-semibold">{locale === "ko-KR" ? "복습 메모 (선택)" : "个人复习备注（可选）"}<textarea rows={2} value={String(objectValue(answer).note ?? "")} onChange={(event) => setAnswer({ ...objectValue(answer), note: event.target.value })} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] p-3" /></label>
        </div>
      )}

      {hasPendingAudio && (
        <div className="mt-6 flex items-start gap-3 bg-[var(--accent)] px-5 py-4 text-sm leading-6 text-[var(--support)]">
          <Headphones size={19} className="mt-0.5 shrink-0" />
          <span><strong>{t.listenPrivate}</strong><br />{t.audioPending}</span>
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
        {isGrammarPractice && !activityCompleted && !activePageCheck && <button type="button" onClick={checkGrammarPage} disabled={checkingPage} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-bold text-[var(--primary-foreground)] disabled:opacity-40">{checkingPage ? (locale === "ko-KR" ? "확인 중…" : "检查中…") : (locale === "ko-KR" ? "정답 확인" : "检查答案")}</button>}
        {isGrammarPractice && !activityCompleted && activePageCheck && !activePageReady && <button type="button" onClick={revealGrammarAnswers} className="inline-flex shrink-0 items-center justify-center rounded-xl border border-[var(--primary)] px-5 py-2.5 text-sm font-bold text-[var(--primary)]">{locale === "ko-KR" ? "정답 보기" : "查看答案"}</button>}
        {(!isGrammarPractice || (isLastGrammarActivity && isLastGrammarPracticePage && activePageReady)) && <button type="button" onClick={submit} disabled={pending || hasPendingAudio || activityCompleted} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-bold text-[var(--primary-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto">
          {pending ? <Pause size={15} /> : activityCompleted ? <CheckCircle2 size={15} /> : <Send size={15} />} {activityCompleted ? t.submitted : t.submit}
        </button>}
      </div>
      )}
      </div>
    </section>
  );
}

export function SmartTextbookShell({ backHref, textbook, trackingDisabled, completionHref, completionLabel }: SmartTextbookShellProps) {
  const textbookRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [missionPage, setMissionPage] = useState<0 | 1>(0);
  const [activeGrammarPracticeIndex, setActiveGrammarPracticeIndex] = useState(0);
  const [locale, setLocale] = useState<SmartLocale>(textbook.preference.locale);
  const [supportMode, setSupportMode] = useState<SmartSupportMode>(textbook.preference.supportMode);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pathCollapsed, setPathCollapsed] = useState(false);
  const [assistantCollapsed, setAssistantCollapsed] = useState(true);
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
  const [tutorText, setTutorText] = useState("");
  const [tutorInput, setTutorInput] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [preferenceError, setPreferenceError] = useState("");
  const [preferenceNeedsReload, setPreferenceNeedsReload] = useState(false);
  const [isPending, startTransition] = useTransition();
  const activeModule = textbook.modules[activeIndex];
  const activeNodes = activeModule?.nodes ?? [];
  const t = ui[locale];
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

  function localize(value: { "zh-CN": string; "ko-KR": string }) {
    return value[locale];
  }

  function selectModule(index: number) {
    setMissionPage(0);
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

  function tutorReply(intent: "explain" | "hint" | "example" | "roleplay" | "ask") {
    const moduleTitle = localize(activeModule.title);
    const moduleDescription = localize(activeModule.description);
    const chapterGoal = localize(textbook.chapter.goal);
    const chapterScenario = localize(textbook.chapter.scenario);
    const koReplies = {
      explain: `${moduleTitle}: ${moduleDescription || chapterGoal} 화면의 예시를 소리 내어 읽고 현재 활동을 완성해 보세요.`,
      hint: `이번 단계의 목표는 “${chapterGoal}”입니다. 현재 화면의 핵심 표현과 안내 문장을 다시 확인해 보세요.`,
      example: `${moduleTitle}의 예문과 활동을 다시 확인한 뒤, 같은 구조로 자신의 문장을 만들어 보세요.`,
      roleplay: `“${chapterScenario}” 상황을 떠올려 보세요. 제가 상대 역할을 맡을 테니 현재 단원의 표현으로 먼저 말해 보세요.`,
      ask: tutorInput.trim() ? `질문은 “${tutorInput.trim()}”이군요. “${moduleTitle}”와 이번 장의 목표를 바탕으로 함께 살펴볼게요.` : "궁금한 내용을 입력해 주세요.",
    };
    const zhReplies = {
      explain: `“${moduleTitle}”：${moduleDescription || chapterGoal}。先朗读当前示例，再完成屏幕上的互动。`,
      hint: `本阶段目标是“${chapterGoal}”。请重新查看当前页面的关键表达和任务提示。`,
      example: `请参考“${moduleTitle}”中的例句与活动，用相同结构替换信息，组成自己的句子。`,
      roleplay: `现在进入“${chapterScenario}”场景。我来扮演对话对象，请使用本单元表达先开口。`,
      ask: tutorInput.trim() ? `你问的是“${tutorInput.trim()}”。我会结合“${moduleTitle}”和本章目标帮你拆解。` : "请先输入不明白的地方。",
    };
    setTutorText(supportMode === "immersion" ? koReplies[intent] : `${zhReplies[intent]}\n\n${supportMode === "bilingual" ? koReplies[intent] : ""}`.trim());
    if (intent === "ask") setTutorInput("");
  }

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
      setAssistantCollapsed((value) => !value);
      return;
    }

    setMobilePanel((value) => value === "assistant" ? null : "assistant");
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

  function renderTutorPanel(showHeader = true) {
    return (
      <div className="flex h-full flex-col overflow-hidden rounded-[26px] border border-[var(--border-subtle)] bg-[var(--card)] shadow-sm">
        {showHeader && <div className="border-b border-[var(--border-subtle)] px-5 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--primary)]">
              <MessageCircle size={18} />
            </span>
            <div>
              <p className="font-bold text-[var(--foreground)]">{t.tutor}</p>
              <p className="mt-0.5 text-[10px] leading-4 text-[var(--foreground-muted)]">{t.grounded}</p>
            </div>
          </div>
        </div>}
        <div className="smart-textbook-scroll flex-1 overflow-y-auto p-5">
          <div className="text-xs font-bold tracking-wide text-[var(--foreground-muted)]">{t.currentMission}</div>
          <p className="mt-2 text-sm font-bold leading-6 text-[var(--foreground)]">{localize(activeModule.title)}</p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {([['explain', t.explain], ['hint', t.hint], ['example', t.example], ['roleplay', t.roleplay]] as const).map(([intent, label]) => (
              <button
                key={intent}
                type="button"
                onClick={() => tutorReply(intent)}
                className="min-h-14 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-3 py-2 text-left text-xs font-semibold leading-5 text-[var(--foreground-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
              >
                {label}
              </button>
            ))}
          </div>
          {tutorText && (
            <div className="mt-5 whitespace-pre-line rounded-xl bg-[var(--accent)] px-4 py-4 text-sm leading-6 text-[var(--foreground-secondary)]">
              <Sparkles size={15} className="mb-2 text-[var(--primary)]" />
              {tutorText}
            </div>
          )}
        </div>
        <div className="border-t border-[var(--border-subtle)] p-4">
          <textarea
            value={tutorInput}
            onChange={(event) => setTutorInput(event.target.value)}
            rows={2}
            aria-label={t.ask}
            placeholder={t.ask}
            className="w-full resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-3 py-2 text-sm leading-5 text-[var(--foreground)] outline-none placeholder:text-[var(--foreground-muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
          />
          <button
            type="button"
            onClick={() => tutorReply('ask')}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2.5 text-sm font-bold text-white"
          >
            <Send size={14} /> {t.send}
          </button>
        </div>
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
      <header className="relative z-30 h-[70px] shrink-0 border-b border-[var(--border-subtle)] bg-[var(--card)] px-3 shadow-sm sm:px-5 lg:h-[78px] lg:px-7">
        <div className="flex h-full items-center justify-between gap-3">
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
            <Link href={backHref} className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-[var(--foreground-muted)] transition hover:text-[var(--foreground)]">
              <ArrowLeft size={17} />
              <span className="hidden sm:inline">{t.back}</span>
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4 lg:gap-6">
            <button
              type="button"
              onClick={toggleTutorPanel}
              className={`inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-xl border px-2.5 text-sm font-bold transition sm:px-3 ${!assistantCollapsed || mobilePanel === "assistant" ? "border-[var(--primary)] bg-[var(--accent)] text-[var(--primary)]" : "border-[var(--border-subtle)] bg-[var(--surface-soft)] text-[var(--foreground-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]"}`}
              aria-label={t.tutor}
              aria-expanded={!assistantCollapsed || mobilePanel === "assistant"}
            >
              <MessageCircle size={17} />
              <span className="hidden xl:inline">{t.tutor}</span>
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
            <div className="relative">
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
                <div className="absolute right-0 top-12 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-[22px] border border-[var(--border-subtle)] bg-[var(--card)] p-5 shadow-xl">
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

      <div className="flex min-h-0 flex-1 gap-3 p-3 lg:gap-4 lg:p-4">
        <aside className={`smart-textbook-scroll hidden shrink-0 overflow-y-auto rounded-[26px] border border-[var(--border-subtle)] bg-[var(--card)] px-3 py-5 shadow-sm transition-[width] duration-200 lg:block ${pathCollapsed ? "w-16" : "w-64"}`}>
          <div className={`flex items-center ${pathCollapsed ? "justify-center" : "justify-between px-3"}`}>
            {!pathCollapsed && <p className="text-[11px] font-bold tracking-[.2em] text-slate-400">{sidebarLabel}</p>}
            <button
              type="button"
              onClick={() => setPathCollapsed((value) => !value)}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/60 hover:text-slate-800"
              aria-label={locale === "ko-KR"
                ? pathCollapsed ? `${sidebarLabel} 펼치기` : `${sidebarLabel} 접기`
                : pathCollapsed ? `展开${sidebarLabel}` : `收起${sidebarLabel}`}
            >
              {pathCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            </button>
          </div>
          {renderChapterSidebar(pathCollapsed)}
        </aside>

        <main
          id="korean-textbook-content"
          tabIndex={0}
          aria-label={locale === "ko-KR" ? "교재 본문, 방향키와 페이지 키로 스크롤할 수 있습니다" : "教材正文，可使用方向键或翻页键滚动阅读"}
          className="smart-textbook-scroll min-w-0 flex-1 overflow-y-auto overscroll-contain rounded-[26px] border border-[var(--border-subtle)] bg-[var(--card)] shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <div className="w-full px-5 py-8 sm:px-8 sm:py-10 lg:px-10 xl:px-12">
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
              const hasReadyImage = node.media.some((asset) => asset.type === "image" && asset.status === "ready" && asset.url);
              const hasIntegratedImageHeader = nodeIndex === 0 && hasReadyImage;
              const usesDesktopImagePager = hasIntegratedImageHeader && node.activities.length > 0;
              const usesGrammarPager = Array.isArray(node.content.grammarCards) && node.content.grammarCards.length > 0;
              return (
              <article key={node.id} className="mt-8 rounded-[24px] border border-[var(--border-subtle)] p-5 first:mt-0 sm:mt-10 sm:p-7 sm:first:mt-0">
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
                {usesDesktopImagePager && (
                  <nav
                    className="mb-6 hidden items-center justify-between gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-1.5 lg:flex"
                    aria-label={locale === "ko-KR" ? "학습 목표 페이지" : "学习目标分页"}
                  >
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-current={missionPage === 0 ? "page" : undefined}
                        onClick={() => setMissionPage(0)}
                        className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] motion-reduce:transition-none ${missionPage === 0 ? "bg-[var(--card)] text-[var(--primary)] shadow-sm ring-1 ring-[var(--border-subtle)]" : "text-[var(--foreground-secondary)] hover:bg-[var(--card)] hover:text-[var(--foreground)]"}`}
                      >
                        <BookOpen size={17} aria-hidden="true" />
                        {usesGrammarPager
                          ? locale === "ko-KR" ? "문법 이해" : "语法理解"
                          : locale === "ko-KR" ? "장면과 표현" : "情景与表达"}
                      </button>
                      <button
                        type="button"
                        aria-current={missionPage === 1 ? "page" : undefined}
                        onClick={() => setMissionPage(1)}
                        className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] motion-reduce:transition-none ${missionPage === 1 ? "bg-[var(--card)] text-[var(--primary)] shadow-sm ring-1 ring-[var(--border-subtle)]" : "text-[var(--foreground-secondary)] hover:bg-[var(--card)] hover:text-[var(--foreground)]"}`}
                      >
                        <CheckCircle2 size={17} aria-hidden="true" />
                        {usesGrammarPager
                          ? locale === "ko-KR" ? "문법 연습" : "语法练习"
                          : locale === "ko-KR" ? "장면 진단" : "情景诊断"}
                      </button>
                    </div>
                    <span className="pr-3 text-xs font-bold tabular-nums text-[var(--foreground-muted)]" aria-live="polite">
                      {locale === "ko-KR" ? "이 목표" : "本目标"} {missionPage + 1} / 2
                    </span>
                  </nav>
                )}
                <div className={usesDesktopImagePager && missionPage === 1 ? "lg:hidden" : ""}>
                  <ContentRenderer
                    node={node}
                    locale={locale}
                    supportMode={supportMode}
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
                <div className={`${usesDesktopImagePager && missionPage === 0 ? "lg:hidden" : ""} ${usesDesktopImagePager ? "lg:[&>section:first-child]:mt-0" : ""}`}>
                  {node.activities.map((activity, activityIndex) => (
                    <div key={activity.id} hidden={usesGrammarPager && activityIndex !== activeGrammarPracticeIndex}>
                      <Activity
                        activity={activity}
                        locale={locale}
                        trackingDisabled={trackingDisabled}
                        onCompleted={recordCompletion}
                        round={usesGrammarPager ? undefined : { current: activityIndex + 1, total: node.activities.length }}
                        grammarPageOffset={activityIndex * 2}
                        onPreviousGrammarActivity={usesGrammarPager && activityIndex > 0 ? () => setActiveGrammarPracticeIndex(activityIndex - 1) : undefined}
                        onNextGrammarActivity={usesGrammarPager && activityIndex < node.activities.length - 1 ? () => setActiveGrammarPracticeIndex(activityIndex + 1) : undefined}
                        isLastGrammarActivity={usesGrammarPager && activityIndex === node.activities.length - 1}
                      />
                    </div>
                  ))}
                </div>
              </article>
              );
            })}
              </>
            )}
            <div className="h-12" />
          </div>
        </main>

        <aside className={`hidden shrink-0 overflow-hidden rounded-[26px] bg-[var(--card)] transition-[width,opacity,padding] duration-200 lg:flex ${assistantCollapsed ? "w-0 border-0 p-0 opacity-0" : "w-[340px] border border-[var(--border-subtle)] p-3 opacity-100 shadow-sm"}`} aria-hidden={assistantCollapsed}>
          {!assistantCollapsed && <div className="min-h-0 flex-1">{renderTutorPanel()}</div>}
        </aside>
      </div>

      <footer className="relative z-30 h-[72px] shrink-0 border-t border-[var(--border-subtle)] bg-[var(--card)] px-3 sm:px-5 lg:h-[76px] lg:px-7">
        <div className="flex h-full items-center justify-between gap-3">
          <button type="button" disabled={activeIndex === 0} onClick={() => selectModule(Math.max(0, activeIndex - 1))} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-1 text-xs font-bold text-slate-500 hover:bg-[var(--surface-soft)] hover:text-slate-900 disabled:opacity-25 sm:gap-2 sm:px-2 sm:text-sm">
            <ChevronLeft size={18} /> <span className="hidden min-[360px]:inline">{t.previous}</span>
          </button>
          <p className="hidden text-xs font-bold tabular-nums text-[var(--foreground-muted)] sm:block" aria-live="polite">
            {activeIndex + 1} / {textbook.modules.length}
          </p>
          {isLastModule ? (
            chapterTestHref && progressPercent >= 100 ? (
              <Link href={chapterTestHref} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--primary)] px-3.5 py-2.5 text-xs font-bold text-[var(--primary-foreground)] hover:opacity-90 sm:gap-2 sm:px-5 sm:text-sm">
                {t.chapterTest} <ChevronRight size={18} />
              </Link>
            ) : completionHref && progressPercent >= 100 ? (
              <Link href={completionHref} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--primary)] px-3.5 py-2.5 text-xs font-bold text-[var(--primary-foreground)] hover:opacity-90 sm:gap-2 sm:px-5 sm:text-sm">
                {completionLabel ?? t.next} <ChevronRight size={18} />
              </Link>
            ) : (
              <button type="button" disabled className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-200 px-3.5 py-2.5 text-xs font-bold text-slate-400 sm:px-5 sm:text-sm">
                {chapterTestHref ? "完成八个学习节点后解锁" : completionHref ? "完成本章后解锁" : t.testUnavailable}
              </button>
            )
          ) : (
            <button type="button" onClick={() => selectModule(Math.min(textbook.modules.length - 1, activeIndex + 1))} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--primary)] px-3.5 py-2.5 text-xs font-bold text-[var(--primary-foreground)] hover:opacity-90 sm:gap-2 sm:px-5 sm:text-sm">
              {t.next} <ChevronRight size={18} />
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
              <button type="button" onClick={() => setMobilePanel(null)} className="rounded-full bg-white p-2 text-slate-500" aria-label="关闭">
                <X size={17} />
              </button>
            </div>
            <div className="smart-textbook-scroll h-[calc(100%-3.25rem)] overflow-y-auto">
              {mobilePanel === "path" ? renderChapterSidebar(false) : renderTutorPanel(false)}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
