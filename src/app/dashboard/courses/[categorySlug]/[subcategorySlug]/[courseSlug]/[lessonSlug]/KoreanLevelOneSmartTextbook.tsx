"use client";

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
  Menu,
  MessageCircle,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Volume2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import type {
  SmartLocale,
  SmartSupportMode,
  SmartTextbookActivity,
  SmartTextbookData,
  SmartTextbookNode,
} from "@/lib/smart-digital-textbook";
import {
  saveSmartTextbookPreferenceAction,
  submitSmartTextbookActivityAction,
} from "./smart-textbook-actions";

type Props = {
  backHref: string;
  textbook: SmartTextbookData;
  trackingDisabled: boolean;
};

type AnswerValue = number | number[] | string | boolean;
type Feedback = {
  ok: boolean;
  correct: boolean | null;
  explanation: string;
  preview: boolean;
};

const accentMap = {
  jade: { solid: "var(--status-success)", pale: "var(--status-success-surface)", glow: "color-mix(in srgb, var(--status-success) 16%, transparent)" },
  iris: { solid: "var(--primary)", pale: "var(--accent)", glow: "color-mix(in srgb, var(--primary) 16%, transparent)" },
  coral: { solid: "var(--status-warning)", pale: "var(--status-warning-surface)", glow: "color-mix(in srgb, var(--status-warning) 16%, transparent)" },
  sky: { solid: "var(--support)", pale: "var(--accent)", glow: "color-mix(in srgb, var(--support) 16%, transparent)" },
} as const;

const ui = {
  "zh-CN": {
    back: "返回课程",
    chapter: "第一章",
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
    speakingPracticeComplete: "录音练习已完成，本次不进行自动发音评分。",
    testUnavailable: "章节测试尚未配置",
    writingCount: "韩文字数",
    objective: "本章达成目标",
    scene: "真实场景",
    phrases: "本课可调用表达",
    word: "韩语",
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
  },
  "ko-KR": {
    back: "강좌로 돌아가기",
    chapter: "제1장",
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
    speakingPracticeComplete: "녹음 연습을 마쳤습니다. 자동 발음 평가는 제공하지 않습니다.",
    testUnavailable: "단원 평가가 아직 준비되지 않았습니다",
    writingCount: "글자 수",
    objective: "단원 성취 목표",
    scene: "실제 상황",
    phrases: "이번 단원의 핵심 표현",
    word: "한국어",
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
  },
} as const;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function speakKorean(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ko-KR";
  utterance.rate = 0.82;
  window.speechSynthesis.speak(utterance);
}

function StepStatus({ done, active }: { done: boolean; active: boolean }) {
  if (done) return <CheckCircle2 size={17} className="text-[var(--status-success)]" />;
  if (active) return <Circle size={17} className="fill-current text-current" />;
  return <Circle size={17} className="text-slate-300" />;
}

function ContentRenderer({
  node,
  locale,
  supportMode,
}: {
  node: SmartTextbookNode;
  locale: SmartLocale;
  supportMode: SmartSupportMode;
}) {
  const t = ui[locale];
  const content = node.content;
  const showChinese = supportMode !== "immersion";
  const lead = objectValue(content.lead);
  const coach = objectValue(content.coach);
  const targets = Array.isArray(content.targets) ? content.targets.map(objectValue) : [];
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

  return (
    <div className="mt-8 space-y-10">
      {String(lead[locale] ?? "") && (
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
          <div className="grid grid-cols-[1.15fr_.85fr_.55fr_1.5fr] bg-slate-50/80 px-4 py-3 text-xs font-bold tracking-wide text-slate-500">
            <span>{t.word}</span>
            <span>{t.meaning}</span>
            <span>{t.pos}</span>
            <span>{t.collocation}</span>
          </div>
          {vocabulary.map((word, index) => (
            <div
              key={`${String(word.ko)}-${index}`}
              className="grid grid-cols-[1.15fr_.85fr_.55fr_1.5fr] items-center border-t border-slate-100 px-4 py-4 text-sm"
            >
              <button
                type="button"
                onClick={() => speakKorean(String(word.ko))}
                className="group flex items-center gap-3 text-left text-[17px] font-semibold text-slate-900"
              >
                <Volume2 size={15} className="text-[var(--status-success)] transition group-hover:scale-110" />
                {String(word.ko)}
              </button>
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
  locale,
  onReady,
}: {
  locale: SmartLocale;
  onReady: () => void;
}) {
  const t = ui[locale];
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
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
      recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
        onReady();
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setRecordingError(t.recordingDenied);
    }
  }

  return (
    <div className="mt-5 flex flex-wrap items-center gap-4 border-y border-slate-200 py-5">
      <button type="button" onClick={toggleRecording} className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white ${recording ? "bg-[var(--status-warning)]" : "bg-[var(--status-success)]"}`}>
        {recording ? <Square size={14} /> : <Mic size={15} />}
        {recording ? t.stopRecording : t.startRecording}
      </button>
      {audioUrl && <audio src={audioUrl} controls className="h-9 max-w-full" />}
      {audioUrl && <span className="text-xs font-semibold text-[var(--status-success)]">{t.recorded}</span>}
      {recordingError && <p className="w-full text-xs font-semibold text-[var(--destructive)]">{recordingError}</p>}
    </div>
  );
}

function Activity({
  activity,
  locale,
  trackingDisabled,
  onCompleted,
}: {
  activity: SmartTextbookActivity;
  locale: SmartLocale;
  trackingDisabled: boolean;
  onCompleted: (activityId: string) => void;
}) {
  const t = ui[locale];
  const [answer, setAnswer] = useState<AnswerValue>(() =>
    activity.type === "multiple_choice" ? [] : activity.type === "ordering" ? activity.options.map((_, index) => index) : ""
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const hasPendingAudio =
    activity.type === "listening" && activity.config.audioStatus !== "ready";

  function hasResponse() {
    if (typeof answer === "string") return answer.trim().length > 0;
    if (Array.isArray(answer)) return answer.length > 0;
    return typeof answer === "number" || answer === true;
  }

  function submit() {
    if (!hasResponse() || hasPendingAudio) {
      setMessage(hasPendingAudio ? t.audioPending : t.noResponse);
      return;
    }
    setMessage("");
    startTransition(async () => {
      const result = await submitSmartTextbookActivityAction({ activityId: activity.id, response: answer, locale });
      setFeedback(result);
      if (result.ok && result.correct !== false) onCompleted(activity.id);
    });
  }

  const ordered = activity.type === "ordering" && Array.isArray(answer) ? answer : [];
  function moveOrder(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    [next[index], next[target]] = [next[target], next[index]];
    setAnswer(next);
    setFeedback(null);
  }

  return (
    <section className="mt-12 border-t-2 border-slate-900 pt-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div>
          <p className="text-xs font-bold tracking-[.18em] text-slate-400">INTERACTION · {activity.type.replace("_", " ").toUpperCase()}</p>
          <h5 className="mt-3 text-xl font-bold leading-8 text-slate-900">{activity.prompt[locale]}</h5>
          <p className="mt-1 text-sm text-slate-500">{activity.instruction[locale]}</p>
        </div>
        {feedback?.ok && <span className="shrink-0 text-xs font-bold text-[var(--status-success)]">{t.submitted}</span>}
      </div>

      {(activity.type === "single_choice" || activity.type === "listening") && (
        <div className="mt-6 border-y border-slate-200">
          {activity.options.map((option, index) => (
            <button key={option} type="button" disabled={hasPendingAudio} onClick={() => { setAnswer(index); setFeedback(null); }} className={`grid w-full grid-cols-[36px_1fr_24px] items-center border-b border-slate-100 px-2 py-4 text-left last:border-b-0 ${answer === index ? "bg-slate-50" : "hover:bg-slate-50/70"} disabled:cursor-not-allowed disabled:opacity-45`}>
              <span className="font-mono text-xs text-slate-400">{String.fromCharCode(65 + index)}</span>
              <span className="font-medium text-slate-800">{option}</span>
              {answer === index ? <CheckCircle2 size={17} className="text-[var(--support)]" /> : <Circle size={17} className="text-slate-200" />}
            </button>
          ))}
        </div>
      )}

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
        <div className="mt-6 border-y border-slate-200">
          {activity.options.map((option, index) => {
            const selected = Array.isArray(answer) && answer.includes(index);
            return <button key={option} type="button" onClick={() => { const current = Array.isArray(answer) ? answer : []; setAnswer(selected ? current.filter((item) => item !== index) : [...current, index]); setFeedback(null); }} className={`grid w-full grid-cols-[36px_1fr_24px] items-center border-b border-slate-100 px-2 py-4 text-left last:border-b-0 ${selected ? "bg-slate-50" : "hover:bg-slate-50/70"}`}>
              <span className="font-mono text-xs text-slate-400">{String.fromCharCode(65 + index)}</span><span className="font-medium text-slate-800">{option}</span>{selected ? <CheckCircle2 size={17} className="text-[var(--primary)]" /> : <Circle size={17} className="text-slate-200" />}
            </button>;
          })}
        </div>
      )}

      {activity.type === "fill_blank" && (
        <input value={typeof answer === "string" ? answer : ""} onChange={(event) => { setAnswer(event.target.value); setFeedback(null); }} lang="ko" autoComplete="off" aria-label={activity.prompt[locale]} className="mt-6 w-full border-x-0 border-b-2 border-t-0 border-slate-300 bg-transparent px-1 py-4 text-xl font-semibold text-slate-900 outline-none transition focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2" placeholder="한국어로 쓰세요" />
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
          <textarea value={typeof answer === "string" ? answer : ""} onChange={(event) => { setAnswer(event.target.value); setFeedback(null); }} lang="ko" rows={5} aria-label={activity.prompt[locale]} className="w-full resize-none border-x-0 border-b-2 border-t border-slate-200 bg-slate-50/50 px-4 py-4 text-[16px] leading-8 text-slate-900 outline-none focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2" placeholder="한국어로 3~5문장을 쓰세요." />
          <p className="mt-2 text-right text-xs text-slate-400">{t.writingCount} · {typeof answer === "string" ? answer.length : 0}</p>
        </div>
      )}

      {activity.type === "speaking" && <RecordingControl locale={locale} onReady={() => setAnswer(true)} />}

      {hasPendingAudio && (
        <div className="mt-6 flex items-start gap-3 bg-[var(--accent)] px-5 py-4 text-sm leading-6 text-[var(--support)]">
          <Headphones size={19} className="mt-0.5 shrink-0" />
          <span><strong>{t.listenPrivate}</strong><br />{t.audioPending}</span>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
        <div className="min-h-10 flex-1">
          {message && <p className="text-sm text-[var(--destructive)]">{message}</p>}
          {feedback && (
            <div className={`flex items-start gap-2 text-sm leading-6 ${feedback.correct === false ? "text-[var(--destructive)]" : "text-[var(--status-success)]"}`}>
              {feedback.correct === false ? <RotateCcw size={16} className="mt-1 shrink-0" /> : <CheckCircle2 size={16} className="mt-1 shrink-0" />}
              <span>
                <strong>{activity.type === "speaking" ? t.submitted : feedback.correct === false ? t.retry : t.correct}</strong>
                {" · "}
                {activity.type === "speaking" ? t.speakingPracticeComplete : feedback.explanation}
                {feedback.preview || trackingDisabled ? ` · ${t.preview}` : ""}
              </span>
            </div>
          )}
        </div>
        <button type="button" onClick={submit} disabled={pending || hasPendingAudio} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto">
          {pending ? <Pause size={15} /> : <Send size={15} />} {t.submit}
        </button>
      </div>
    </section>
  );
}

export function KoreanLevelOneSmartTextbook({ backHref, textbook, trackingDisabled }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [locale, setLocale] = useState<SmartLocale>(textbook.preference.locale);
  const [supportMode, setSupportMode] = useState<SmartSupportMode>(textbook.preference.supportMode);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pathCollapsed, setPathCollapsed] = useState(false);
  const [assistantCollapsed, setAssistantCollapsed] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"path" | "assistant" | null>(null);
  const [completedActivities, setCompletedActivities] = useState<Set<string>>(new Set());
  const [tutorText, setTutorText] = useState("");
  const [tutorInput, setTutorInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const activeModule = textbook.modules[activeIndex];
  const activeNodes = activeModule?.nodes ?? [];
  const t = ui[locale];
  const accent = accentMap[activeModule?.accent ?? "sky"];

  const completedNodeIds = useMemo(() => new Set(textbook.progress.filter((item) => item.status === "completed").map((item) => item.nodeId)), [textbook.progress]);
  const moduleDone = (moduleIndex: number) => {
    const currentModule = textbook.modules[moduleIndex];
    if (!currentModule) return false;
    return currentModule.nodes.every(
      (node) =>
        completedNodeIds.has(node.id) ||
        (node.activities.length > 0 &&
          node.activities.every((activity) => completedActivities.has(activity.id))),
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

  function savePreference(nextLocale: SmartLocale, nextSupport: SmartSupportMode) {
    setLocale(nextLocale);
    setSupportMode(nextSupport);
    startTransition(async () => {
      await saveSmartTextbookPreferenceAction({
        textbookId: textbook.id,
        locale: nextLocale,
        supportMode: nextSupport,
      });
    });
  }

  function tutorReply(intent: "explain" | "hint" | "example" | "roleplay" | "ask") {
    const koReplies = {
      explain: `${localize(activeModule.title)}에서는 “안녕하세요? → 저는 …예요/이에요 → 만나서 반가워요”의 흐름을 익혀요. 지금 화면의 예를 소리 내어 두 번 읽어 보세요.`,
      hint: "정답을 바로 고르기 전에 마지막 음절에 받침이 있는지 확인하세요. 학생은 받침이 있으므로 이에요를 사용합니다.",
      example: "안녕하세요? 저는 소라예요. 저는 회사원이에요. 만나서 반가워요.",
      roleplay: "제가 먼저 할게요. 안녕하세요? 저는 지우예요. 이름이 뭐예요?",
      ask: tutorInput.trim() ? `질문의 핵심은 “${tutorInput.trim()}”이군요. 이 단원에서는 먼저 인사, 이름, 신분, 마무리의 네 기능 중 어디에 해당하는지 확인해 보세요.` : "궁금한 내용을 입력해 주세요.",
    };
    const zhReplies = {
      explain: `“${activeModule.title["zh-CN"]}”的核心路径是：안녕하세요? → 저는 …예요/이에요 → 만나서 반가워요。先跟读两遍，再完成当前互动。`,
      hint: "先别急着看答案，检查前面名词最后一个音节有没有收音：학생 有收音，所以接 이에요。",
      example: "新例句：안녕하세요? 저는 소라예요. 저는 회사원이에요. 만나서 반가워요.",
      roleplay: "我先扮演新同学：안녕하세요? 저는 지우예요. 이름이 뭐예요? 你用韩语回答。",
      ask: tutorInput.trim() ? `你问的是“${tutorInput.trim()}”。先把它归到问候、姓名、身份、结束语中的一个功能，我会只用本章内容帮你拆解。` : "请先输入不明白的地方。",
    };
    setTutorText(supportMode === "immersion" ? koReplies[intent] : `${zhReplies[intent]}\n\n${supportMode === "bilingual" ? koReplies[intent] : ""}`.trim());
    if (intent === "ask") setTutorInput("");
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey && event.key === "ArrowLeft") setActiveIndex((value) => Math.max(0, value - 1));
      if (event.altKey && event.key === "ArrowRight") setActiveIndex((value) => Math.min(textbook.modules.length - 1, value + 1));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [textbook.modules.length]);

  function renderPathNavigation(compact = false) {
    return (
      <nav className={compact ? "mt-3 space-y-1" : "mt-5"} aria-label={t.learnerPath}>
        {textbook.modules.map((module, index) => {
          const active = index === activeIndex;
          const done = moduleDone(index);
          const moduleAccent = accentMap[module.accent];
          return (
            <button
              key={module.id}
              type="button"
              onClick={() => {
                setActiveIndex(index);
                setMobilePanel(null);
              }}
              aria-current={active ? "step" : undefined}
              aria-label={`${t.learnerPath} ${index + 1}: ${localize(module.title)}`}
              title={compact ? localize(module.title) : undefined}
              className={`relative flex w-full items-start transition ${compact ? "justify-center rounded-xl px-2 py-3" : "gap-3 rounded-2xl px-3 py-3.5 text-left"} ${active ? "bg-white/85 shadow-sm" : "hover:bg-white/50"}`}
            >
              {!compact && index < textbook.modules.length - 1 && (
                <span className="absolute left-[19px] top-9 h-[35px] w-px bg-slate-200" />
              )}
              <span
                className="relative z-10 mt-0.5 bg-[var(--background)]"
                style={{ color: active ? moduleAccent.solid : undefined }}
              >
                <StepStatus done={done} active={active} />
              </span>
              {!compact && (
                <span className="min-w-0">
                  <span className={`block text-[11px] font-bold tracking-widest ${active ? "text-slate-500" : "text-slate-300"}`}>
                    第 {String(index + 1).padStart(2, "0")} 步
                  </span>
                  <span className={`mt-0.5 block truncate text-sm font-bold ${active ? "text-slate-900" : "text-slate-600"}`}>
                    {localize(module.title)}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </nav>
    );
  }

  function renderTutorPanel(showHeader = true) {
    return (
      <div className="flex h-full flex-col overflow-hidden rounded-[26px] bg-white/78 shadow-sm ring-1 ring-white">
        {showHeader && <div className="border-b border-white px-5 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--primary)]">
              <MessageCircle size={18} />
            </span>
            <div>
              <p className="font-bold text-slate-900">{t.tutor}</p>
              <p className="mt-0.5 text-[10px] leading-4 text-slate-400">{t.grounded}</p>
            </div>
          </div>
        </div>}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="text-xs font-bold tracking-wide text-slate-400">{t.currentMission}</div>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-800">{localize(activeModule.title)}</p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {([['explain', t.explain], ['hint', t.hint], ['example', t.example], ['roleplay', t.roleplay]] as const).map(([intent, label]) => (
              <button
                key={intent}
                type="button"
                onClick={() => tutorReply(intent)}
                className="min-h-14 rounded-xl bg-white/85 px-3 py-2 text-left text-xs font-semibold leading-5 text-slate-600 shadow-sm hover:text-[var(--primary)]"
              >
                {label}
              </button>
            ))}
          </div>
          {tutorText && (
            <div className="mt-5 whitespace-pre-line rounded-xl bg-[var(--background)] px-4 py-4 text-sm leading-6 text-slate-600">
              <Sparkles size={15} className="mb-2 text-[var(--primary)]" />
              {tutorText}
            </div>
          )}
        </div>
        <div className="border-t border-white p-4">
          <textarea
            value={tutorInput}
            onChange={(event) => setTutorInput(event.target.value)}
            rows={2}
            aria-label={t.ask}
            placeholder={t.ask}
            className="w-full resize-none rounded-xl bg-white/85 px-3 py-2 text-sm leading-5 text-slate-700 outline-none placeholder:text-slate-300 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
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
      className="fixed inset-0 z-50 flex min-h-[100dvh] flex-col overflow-hidden bg-[var(--background)] text-slate-900 [&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-[var(--ring)] [&_a:focus-visible]:ring-offset-2 [&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-[var(--ring)] [&_button:focus-visible]:ring-offset-2"
      style={{ backgroundImage: `radial-gradient(circle at 18% 8%, ${accent.glow}, transparent 28%), radial-gradient(circle at 90% 86%, color-mix(in srgb, var(--primary) 10%, transparent), transparent 24%)` }}
    >
      <header className="relative z-30 h-[66px] shrink-0 border-b border-white/70 bg-white/72 px-3 backdrop-blur-2xl sm:px-5 lg:h-[74px] lg:px-7">
        <div className="flex h-full items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <button
              type="button"
              onClick={() => setMobilePanel("path")}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/80 text-slate-600 shadow-sm lg:hidden"
              aria-label={t.learnerPath}
              aria-expanded={mobilePanel === "path"}
            >
              <Menu size={18} />
            </button>
            <Link href={backHref} className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
              <ArrowLeft size={17} />
              <span className="hidden sm:inline">{t.back}</span>
            </Link>
            <span className="hidden h-5 w-px bg-slate-200 sm:block" />
            <div className="min-w-0">
              <div className="hidden items-center gap-2 sm:flex">
                <span className="text-xs font-bold tracking-[.18em] text-[var(--primary)]">{textbook.levelCode}</span>
                <span className="text-xs text-slate-300">/</span>
                <span className="text-xs font-semibold text-slate-500">{t.chapter}</span>
              </div>
              <h3 className="truncate text-sm font-bold tracking-tight text-slate-900 sm:mt-0.5 sm:text-lg">
                {localize(textbook.chapter.title)}
              </h3>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4 lg:gap-6">
            <div className="hidden w-36 md:block lg:w-48">
              <div className="mb-1.5 flex justify-between text-[11px] font-bold text-slate-500">
                <span>{t.progress}</span><span>{progressPercent}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPercent}%`, backgroundColor: "var(--status-success)" }} />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobilePanel("assistant")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-[var(--primary)] shadow-sm lg:hidden"
              aria-label={t.tutor}
              aria-expanded={mobilePanel === "assistant"}
            >
              <MessageCircle size={17} />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setSettingsOpen((value) => !value)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/85 px-3 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-white sm:px-4"
                aria-expanded={settingsOpen}
              >
                <Languages size={16} className="text-[var(--primary)]" />
                <span className="hidden sm:inline">中 / 한</span>
                <ChevronDown size={14} />
              </button>
              {settingsOpen && (
                <div className="absolute right-0 top-12 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-[22px] bg-white/95 p-5 shadow-sm ring-1 ring-white backdrop-blur-2xl">
                  <div className="mb-5 flex items-center justify-between">
                    <span className="font-bold text-slate-900">{t.language}</span>
                    <button type="button" onClick={() => setSettingsOpen(false)} className="p-1 text-slate-400" aria-label="关闭">
                      <X size={16} />
                    </button>
                  </div>
                  <p className="mb-2 text-xs font-bold text-slate-400">{t.interfaceLanguage}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["zh-CN", "ko-KR"] as SmartLocale[]).map((item) => (
                      <button key={item} type="button" onClick={() => savePreference(item, supportMode)} className={`rounded-xl px-3 py-2 text-sm font-bold ${locale === item ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>
                        {item === "zh-CN" ? "中文" : "한국어"}
                      </button>
                    ))}
                  </div>
                  <p className="mb-2 mt-5 text-xs font-bold text-slate-400">{t.supportMode}</p>
                  <div className="space-y-1">
                    {(["chinese", "bilingual", "immersion"] as SmartSupportMode[]).map((item) => (
                      <button key={item} type="button" onClick={() => savePreference(locale, item)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold ${supportMode === item ? "bg-[var(--accent)] text-[var(--primary)]" : "text-slate-600 hover:bg-slate-50"}`}>
                        <span>{t[item]}</span>{supportMode === item && <Check size={15} />}
                      </button>
                    ))}
                  </div>
                  {isPending && <p className="mt-3 text-xs text-slate-400">{t.saved}…</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className={`hidden shrink-0 overflow-y-auto px-3 py-5 transition-[width] duration-200 lg:block ${pathCollapsed ? "w-[72px]" : "w-[268px]"}`}>
          <div className={`flex items-center ${pathCollapsed ? "justify-center" : "justify-between px-3"}`}>
            {!pathCollapsed && <p className="text-[11px] font-bold tracking-[.2em] text-slate-400">{t.learnerPath.toUpperCase()}</p>}
            <button type="button" onClick={() => setPathCollapsed((value) => !value)} className="rounded-lg p-2 text-slate-400 hover:bg-white/60 hover:text-slate-800" aria-label={pathCollapsed ? "展开学习路径" : "收起学习路径"}>
              {pathCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            </button>
          </div>
          {renderPathNavigation(pathCollapsed)}
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto bg-white">
          <div className="mx-auto max-w-[900px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10 xl:px-14">
            {activeIndex === 0 && (
              <div className="mb-9 grid gap-6 border-b border-slate-200 pb-8 sm:grid-cols-2 sm:gap-8 lg:mb-12 lg:pb-10">
                <div>
                  <p className="text-xs font-bold tracking-[.18em] text-[var(--support)]">{t.scene.toUpperCase()}</p>
                  <p className="mt-3 text-[15px] leading-7 text-slate-600 sm:text-[16px]">{localize(textbook.chapter.scenario)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold tracking-[.18em] text-[var(--status-success)]">{t.objective.toUpperCase()}</p>
                  <p className="mt-3 text-[15px] leading-7 text-slate-600 sm:text-[16px]">{localize(textbook.chapter.goal)}</p>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
              <div>
                <p className="text-xs font-bold tracking-[.08em]" style={{ color: accent.solid }}>第 {String(activeIndex + 1).padStart(2, "0")} 步</p>
                <h3 className="mt-3 text-2xl font-bold tracking-[-.04em] text-slate-950 sm:text-[34px]">{localize(activeModule.title)}</h3>
                <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-500 sm:text-[16px]">{localize(activeModule.description)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-400 sm:pt-1">
                <Clock3 size={15} /> {activeNodes.reduce((total, node) => total + node.minutes, 0)} {t.minutes}
              </div>
            </div>
            {activeNodes.map((node) => (
              <article key={node.id} className="mt-10 sm:mt-12">
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent.solid }} />
                  <h4 className="text-lg font-bold text-slate-900">{localize(node.title)}</h4>
                </div>
                <ContentRenderer node={node} locale={locale} supportMode={supportMode} />
                {node.activities.map((activity) => (
                  <Activity key={activity.id} activity={activity} locale={locale} trackingDisabled={trackingDisabled} onCompleted={(id) => setCompletedActivities((current) => new Set(current).add(id))} />
                ))}
              </article>
            ))}
            <div className="h-12" />
          </div>
        </main>

        <aside className={`hidden shrink-0 flex-col border-l border-white/70 bg-white/48 p-3 backdrop-blur-xl transition-[width] duration-200 lg:flex ${assistantCollapsed ? "w-[72px]" : "w-[328px]"}`}>
          <div className={`mb-2 flex shrink-0 ${assistantCollapsed ? "justify-center" : "justify-start"}`}>
            <button type="button" onClick={() => setAssistantCollapsed((value) => !value)} className="rounded-lg p-2 text-slate-400 hover:bg-white/70 hover:text-slate-800" aria-label={assistantCollapsed ? "展开学习助手" : "收起学习助手"}>
              {assistantCollapsed ? <PanelRightOpen size={17} /> : <PanelRightClose size={17} />}
            </button>
          </div>
          {assistantCollapsed ? (
            <button type="button" onClick={() => setAssistantCollapsed(false)} className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--primary)]" aria-label={t.tutor}>
              <MessageCircle size={18} />
            </button>
          ) : <div className="min-h-0 flex-1">{renderTutorPanel()}</div>}
        </aside>
      </div>

      <footer className="relative z-30 h-[70px] shrink-0 border-t border-white/70 bg-white/78 px-3 backdrop-blur-2xl sm:px-5 lg:h-[76px] lg:px-7">
        <div className="flex h-full items-center justify-between gap-3">
          <button type="button" disabled={activeIndex === 0} onClick={() => setActiveIndex((value) => Math.max(0, value - 1))} className="inline-flex min-w-0 items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900 disabled:opacity-25 sm:gap-2 sm:text-sm">
            <ChevronLeft size={18} /> <span className="hidden min-[360px]:inline">{t.previous}</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400">{activeIndex + 1} / {textbook.modules.length}</span>
            <div className="hidden items-center gap-1.5 sm:flex">
              {textbook.modules.map((module, index) => (
                <button key={module.id} type="button" onClick={() => setActiveIndex(index)} aria-label={`Step ${index + 1}`} className={`h-1.5 rounded-full transition-all ${index === activeIndex ? "w-8" : "w-1.5"}`} style={{ backgroundColor: index === activeIndex ? accent.solid : moduleDone(index) ? "var(--status-success)" : "var(--border)" }} />
              ))}
            </div>
          </div>
          {isLastModule ? (
            chapterTestHref ? (
              <Link href={chapterTestHref} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-2.5 text-xs font-bold text-white hover:bg-slate-700 sm:gap-2 sm:px-5 sm:text-sm">
                {t.chapterTest} <ChevronRight size={18} />
              </Link>
            ) : (
              <button type="button" disabled className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-200 px-3.5 py-2.5 text-xs font-bold text-slate-400 sm:px-5 sm:text-sm">
                {t.testUnavailable}
              </button>
            )
          ) : (
            <button type="button" onClick={() => setActiveIndex((value) => Math.min(textbook.modules.length - 1, value + 1))} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-2.5 text-xs font-bold text-white hover:bg-slate-700 sm:gap-2 sm:px-5 sm:text-sm">
              {t.next} <ChevronRight size={18} />
            </button>
          )}
        </div>
      </footer>

      {mobilePanel && (
        <div className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-sm lg:hidden" role="presentation" onClick={() => setMobilePanel(null)}>
          <aside className={`absolute bottom-0 top-0 w-[min(88vw,360px)] bg-[var(--background)] p-4 shadow-2xl ${mobilePanel === "path" ? "left-0" : "right-0"}`} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={mobilePanel === "path" ? t.learnerPath : t.tutor}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                {mobilePanel === "path" ? <BookOpen size={18} className="text-[var(--status-success)]" /> : <MessageCircle size={18} className="text-[var(--primary)]" />}
                {mobilePanel === "path" ? t.learnerPath : t.tutor}
              </div>
              <button type="button" onClick={() => setMobilePanel(null)} className="rounded-full bg-white p-2 text-slate-500" aria-label="关闭">
                <X size={17} />
              </button>
            </div>
            <div className="h-[calc(100%-3.25rem)] overflow-y-auto">
              {mobilePanel === "path" ? renderPathNavigation(false) : renderTutorPanel(false)}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
