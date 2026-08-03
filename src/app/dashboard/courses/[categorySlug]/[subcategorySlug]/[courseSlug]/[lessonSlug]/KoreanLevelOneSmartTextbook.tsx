"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Bot,
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
  Mic,
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
  jade: { solid: "#2F8F7D", pale: "#E8F3F0", glow: "rgba(47,143,125,.16)" },
  iris: { solid: "#6F72E6", pale: "#EEEFFD", glow: "rgba(111,114,230,.16)" },
  coral: { solid: "#E58B68", pale: "#FBEEE9", glow: "rgba(229,139,104,.16)" },
  sky: { solid: "#5C9ECF", pale: "#EAF3F9", glow: "rgba(92,158,207,.16)" },
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
    tutor: "AI 学习助手",
    grounded: "只围绕本章内容提供解释与练习",
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
    listenPrivate: "受保护听力",
    audioPending: "本章听力原文已存入后端密表；音频录制完成后将从私有通道播放。",
    playWord: "播放读音",
    moveUp: "上移",
    moveDown: "下移",
    startRecording: "开始录音",
    stopRecording: "停止录音",
    recorded: "已完成录音，可以回听后提交",
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
    tutor: "AI 학습 도우미",
    grounded: "이 단원의 내용만 바탕으로 설명하고 연습합니다",
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
    listenPrivate: "보호된 듣기",
    audioPending: "듣기 대본은 서버의 비공개 영역에 저장되었습니다. 녹음 후 비공개 경로로 재생됩니다.",
    playWord: "발음 듣기",
    moveUp: "위로",
    moveDown: "아래로",
    startRecording: "녹음 시작",
    stopRecording: "녹음 중지",
    recorded: "녹음이 끝났습니다. 다시 듣고 제출하세요",
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
  if (done) return <CheckCircle2 size={17} className="text-[#2F8F7D]" />;
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
                className="grid w-full grid-cols-[44px_minmax(0,1fr)_minmax(0,.8fr)] items-center gap-4 border-b border-slate-100 px-1 py-4 text-left last:border-b-0 hover:bg-slate-50"
                title={t.playWord}
              >
                <span className="text-xs font-bold text-slate-300">0{index + 1}</span>
                <span className="text-lg font-semibold text-slate-900">{String(target.ko)}</span>
                {showChinese && <span className="text-sm text-slate-500">{String(target.zh)}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {vocabulary.length > 0 && (
        <div className="overflow-hidden border-y border-slate-200">
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
                <Volume2 size={15} className="text-[#2F8F7D] transition group-hover:scale-110" />
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
      )}

      {rules.length > 0 && (
        <div className="border-y border-slate-200">
          <div className="grid grid-cols-[1fr_1.3fr_1.3fr] bg-slate-50/80 px-4 py-3 text-xs font-bold text-slate-500">
            <span>{t.form}</span>
            <span>{t.exampleLabel}</span>
            <span>{showChinese ? t.meaning : "설명"}</span>
          </div>
          {rules.map((rule, index) => (
            <div key={index} className="grid grid-cols-[1fr_1.3fr_1.3fr] gap-4 border-t border-slate-100 px-4 py-5">
              <span className="font-bold text-[#6F72E6]">{String(rule.form)}</span>
              <span className="font-semibold text-slate-900">{String(rule.example)}</span>
              <span className="text-sm leading-6 text-slate-500">{showChinese ? String(rule.zh) : "받침 유무를 확인하세요."}</span>
            </div>
          ))}
        </div>
      )}

      {contrast.length > 0 && (
        <div className="flex flex-wrap gap-x-8 gap-y-3 border-y border-slate-200 py-5">
          {contrast.map((item) => (
            <button key={item} type="button" onClick={() => speakKorean(item)} className="inline-flex items-center gap-2 font-semibold text-slate-800 hover:text-[#6F72E6]">
              <Volume2 size={14} /> {item}
            </button>
          ))}
        </div>
      )}

      {String(content.pattern ?? "") && (
        <div className="border-y border-slate-200 py-7">
          <p className="text-xs font-bold tracking-[.16em] text-slate-400">PATTERN</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{String(content.pattern)}</p>
          {substitutions.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {substitutions.map((item) => (
                <span key={item} className="rounded-full bg-[#FBEEE9] px-3 py-1.5 text-sm font-semibold text-[#B45E3E]">{item}</span>
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
              <button key={index} type="button" onClick={() => speakKorean(String(line.line))} className="grid w-full grid-cols-[80px_1fr_24px] items-center border-b border-slate-100 px-2 py-4 text-left last:border-b-0 hover:bg-slate-50">
                <span className="text-xs font-bold text-[#5C9ECF]">{String(line.speaker)}</span>
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
          <p className="text-xs font-bold tracking-[.16em] text-slate-400">SPEAKING FRAME</p>
          <p className="mt-3 text-lg font-semibold leading-8 text-slate-900">{String(content.speakingFrame)}</p>
        </div>
      )}

      {String(content.writingFrame ?? "") && (
        <div className="border-y border-slate-200 py-6">
          <p className="text-xs font-bold tracking-[.16em] text-slate-400">WRITING FRAME</p>
          <p className="mt-3 text-lg font-semibold leading-8 text-slate-900">{String(content.writingFrame)}</p>
        </div>
      )}

      {checklist.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-bold tracking-[.18em] text-slate-400">{t.checklist.toUpperCase()}</p>
          <div className="border-y border-slate-200">
            {checklist.map((item, index) => (
              <div key={index} className="grid grid-cols-[28px_1fr_1fr] items-center border-b border-slate-100 py-4 last:border-b-0">
                <Check size={16} className="text-[#2F8F7D]" />
                <span className="font-semibold text-slate-800">{String(item.ko)}</span>
                {showChinese && <span className="text-sm text-slate-500">{String(item.zh)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {String(coach[locale] ?? "") && (
        <div className="flex gap-3 bg-[#F4F7F6] px-5 py-4 text-sm leading-6 text-slate-600">
          <Lightbulb size={18} className="mt-0.5 shrink-0 text-[#E58B68]" />
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

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
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
  }

  return (
    <div className="mt-5 flex flex-wrap items-center gap-4 border-y border-slate-200 py-5">
      <button type="button" onClick={toggleRecording} className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white ${recording ? "bg-[#E58B68]" : "bg-[#2F8F7D]"}`}>
        {recording ? <Square size={14} /> : <Mic size={15} />}
        {recording ? t.stopRecording : t.startRecording}
      </button>
      {audioUrl && <audio src={audioUrl} controls className="h-9" />}
      {audioUrl && <span className="text-xs font-semibold text-[#2F8F7D]">{t.recorded}</span>}
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
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-xs font-black tracking-[.18em] text-slate-400">INTERACTION · {activity.type.replace("_", " ").toUpperCase()}</p>
          <h3 className="mt-3 text-xl font-bold leading-8 text-slate-900">{activity.prompt[locale]}</h3>
          <p className="mt-1 text-sm text-slate-500">{activity.instruction[locale]}</p>
        </div>
        {feedback?.ok && <span className="shrink-0 text-xs font-bold text-[#2F8F7D]">{t.submitted}</span>}
      </div>

      {(activity.type === "single_choice" || activity.type === "listening") && (
        <div className="mt-6 border-y border-slate-200">
          {activity.options.map((option, index) => (
            <button key={option} type="button" disabled={hasPendingAudio} onClick={() => { setAnswer(index); setFeedback(null); }} className={`grid w-full grid-cols-[36px_1fr_24px] items-center border-b border-slate-100 px-2 py-4 text-left last:border-b-0 ${answer === index ? "bg-slate-50" : "hover:bg-slate-50/70"} disabled:cursor-not-allowed disabled:opacity-45`}>
              <span className="font-mono text-xs text-slate-400">{String.fromCharCode(65 + index)}</span>
              <span className="font-medium text-slate-800">{option}</span>
              {answer === index ? <CheckCircle2 size={17} className="text-[#5C9ECF]" /> : <Circle size={17} className="text-slate-200" />}
            </button>
          ))}
        </div>
      )}

      {activity.type === "listening" && !hasPendingAudio && (
        <div className="mt-6 flex items-center gap-4 border-y border-slate-200 bg-[#EAF3F9]/55 px-5 py-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#5C9ECF] shadow-sm">
            <Headphones size={19} />
          </span>
          <audio
            controls
            preload="none"
            src={`/api/digital-textbook/audio/${activity.id}`}
            className="h-10 w-full"
          />
          <span className="shrink-0 text-xs font-bold text-[#356F9C]">
            {t.listenPrivate}
          </span>
        </div>
      )}

      {activity.type === "multiple_choice" && (
        <div className="mt-6 border-y border-slate-200">
          {activity.options.map((option, index) => {
            const selected = Array.isArray(answer) && answer.includes(index);
            return <button key={option} type="button" onClick={() => { const current = Array.isArray(answer) ? answer : []; setAnswer(selected ? current.filter((item) => item !== index) : [...current, index]); setFeedback(null); }} className={`grid w-full grid-cols-[36px_1fr_24px] items-center border-b border-slate-100 px-2 py-4 text-left last:border-b-0 ${selected ? "bg-slate-50" : "hover:bg-slate-50/70"}`}>
              <span className="font-mono text-xs text-slate-400">{String.fromCharCode(65 + index)}</span><span className="font-medium text-slate-800">{option}</span>{selected ? <CheckCircle2 size={17} className="text-[#6F72E6]" /> : <Circle size={17} className="text-slate-200" />}
            </button>;
          })}
        </div>
      )}

      {activity.type === "fill_blank" && (
        <input value={typeof answer === "string" ? answer : ""} onChange={(event) => { setAnswer(event.target.value); setFeedback(null); }} lang="ko" autoComplete="off" className="mt-6 w-full border-x-0 border-b-2 border-t-0 border-slate-300 bg-transparent px-1 py-4 text-xl font-semibold text-slate-900 outline-none transition focus:border-[#6F72E6]" placeholder="한국어로 쓰세요" />
      )}

      {activity.type === "ordering" && (
        <div className="mt-6 border-y border-slate-200">
          {ordered.map((optionIndex, index) => (
            <div key={`${optionIndex}-${index}`} className="grid grid-cols-[40px_1fr_72px] items-center border-b border-slate-100 py-3 last:border-b-0">
              <span className="font-mono text-xs text-slate-400">0{index + 1}</span>
              <span className="text-lg font-semibold text-slate-800">{activity.options[optionIndex]}</span>
              <div className="flex justify-end gap-1">
                <button type="button" title={t.moveUp} disabled={index === 0} onClick={() => moveOrder(index, -1)} className="p-2 text-slate-400 hover:text-slate-900 disabled:opacity-20"><ChevronUp size={16} /></button>
                <button type="button" title={t.moveDown} disabled={index === ordered.length - 1} onClick={() => moveOrder(index, 1)} className="p-2 text-slate-400 hover:text-slate-900 disabled:opacity-20"><ChevronDown size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activity.type === "writing" && (
        <div className="mt-6">
          <textarea value={typeof answer === "string" ? answer : ""} onChange={(event) => { setAnswer(event.target.value); setFeedback(null); }} lang="ko" rows={5} className="w-full resize-none border-x-0 border-b-2 border-t border-slate-200 bg-slate-50/50 px-4 py-4 text-[16px] leading-8 text-slate-900 outline-none focus:border-[#6F72E6]" placeholder="한국어로 3~5문장을 쓰세요." />
          <p className="mt-2 text-right text-xs text-slate-400">{t.writingCount} · {typeof answer === "string" ? answer.length : 0}</p>
        </div>
      )}

      {activity.type === "speaking" && <RecordingControl locale={locale} onReady={() => setAnswer(true)} />}

      {hasPendingAudio && (
        <div className="mt-6 flex items-start gap-3 bg-[#EAF3F9] px-5 py-4 text-sm leading-6 text-[#356F9C]">
          <Headphones size={19} className="mt-0.5 shrink-0" />
          <span><strong>{t.listenPrivate}</strong><br />{t.audioPending}</span>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-5">
        <div className="min-h-10 flex-1">
          {message && <p className="text-sm text-[#B45E3E]">{message}</p>}
          {feedback && (
            <div className={`flex items-start gap-2 text-sm leading-6 ${feedback.correct === false ? "text-[#B45E3E]" : "text-[#247565]"}`}>
              {feedback.correct === false ? <RotateCcw size={16} className="mt-1 shrink-0" /> : <CheckCircle2 size={16} className="mt-1 shrink-0" />}
              <span><strong>{feedback.correct === false ? t.retry : t.correct}</strong> · {feedback.explanation}{feedback.preview || trackingDisabled ? ` · ${t.preview}` : ""}</span>
            </div>
          )}
        </div>
        <button type="button" onClick={submit} disabled={pending || hasPendingAudio} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40">
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
    const module = textbook.modules[moduleIndex];
    if (!module) return false;
    const activityIds = module.nodes.flatMap((node) => node.activities.map((activity) => activity.id));
    return module.nodes.every((node) => completedNodeIds.has(node.id)) || (activityIds.length > 0 && activityIds.every((id) => completedActivities.has(id)));
  };
  const completeCount = textbook.modules.filter((_, index) => moduleDone(index)).length;
  const progressPercent = Math.round((completeCount / Math.max(textbook.modules.length, 1)) * 100);

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

  if (!activeModule) return null;

  return (
    <div className="fixed inset-0 z-50 min-w-[1180px] overflow-hidden bg-[#F4F7F6] text-slate-900" style={{ backgroundImage: `radial-gradient(circle at 18% 8%, ${accent.glow}, transparent 28%), radial-gradient(circle at 90% 86%, rgba(111,114,230,.10), transparent 24%)` }}>
      <header className="absolute inset-x-0 top-0 z-20 h-[74px] border-b border-white/70 bg-white/72 px-7 backdrop-blur-2xl">
        <div className="flex h-full items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"><ArrowLeft size={17} /> {t.back}</Link>
            <span className="h-5 w-px bg-slate-200" />
            <div>
              <div className="flex items-center gap-2"><span className="text-xs font-black tracking-[.18em] text-[#6F72E6]">{textbook.levelCode}</span><span className="text-xs text-slate-300">/</span><span className="text-xs font-semibold text-slate-500">{t.chapter}</span></div>
              <h1 className="mt-0.5 text-lg font-black tracking-tight text-slate-900">{localize(textbook.chapter.title)}</h1>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="w-48">
              <div className="mb-1.5 flex justify-between text-[11px] font-bold text-slate-500"><span>{t.progress}</span><span>{progressPercent}%</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPercent}%`, backgroundColor: "#2F8F7D" }} /></div>
            </div>
            <div className="relative">
              <button type="button" onClick={() => setSettingsOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-sm font-bold text-slate-700 shadow-[0_8px_30px_rgba(31,46,42,.08)] ring-1 ring-white"><Languages size={16} className="text-[#6F72E6]" /> 中 / 한 <ChevronDown size={14} /></button>
              {settingsOpen && (
                <div className="absolute right-0 top-12 w-80 overflow-hidden rounded-[22px] bg-white/92 p-5 shadow-[0_24px_80px_rgba(31,46,42,.18)] ring-1 ring-white backdrop-blur-2xl">
                  <div className="mb-5 flex items-center justify-between"><span className="font-black text-slate-900">{t.language}</span><button type="button" onClick={() => setSettingsOpen(false)} className="p-1 text-slate-400"><X size={16} /></button></div>
                  <p className="mb-2 text-xs font-bold text-slate-400">{t.interfaceLanguage}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["zh-CN", "ko-KR"] as SmartLocale[]).map((item) => <button key={item} type="button" onClick={() => savePreference(item, supportMode)} className={`rounded-xl px-3 py-2 text-sm font-bold ${locale === item ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>{item === "zh-CN" ? "中文" : "한국어"}</button>)}
                  </div>
                  <p className="mb-2 mt-5 text-xs font-bold text-slate-400">{t.supportMode}</p>
                  <div className="space-y-1">
                    {(["chinese", "bilingual", "immersion"] as SmartSupportMode[]).map((item) => <button key={item} type="button" onClick={() => savePreference(locale, item)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold ${supportMode === item ? "bg-[#EEEFFD] text-[#5053BD]" : "text-slate-600 hover:bg-slate-50"}`}><span>{t[item]}</span>{supportMode === item && <Check size={15} />}</button>)}
                  </div>
                  {isPending && <p className="mt-3 text-xs text-slate-400">{t.saved}…</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <aside className="absolute bottom-[76px] left-0 top-[74px] w-[268px] overflow-y-auto px-5 py-7">
        <p className="px-3 text-[11px] font-black tracking-[.2em] text-slate-400">{t.learnerPath.toUpperCase()}</p>
        <nav className="mt-5">
          {textbook.modules.map((module, index) => {
            const active = index === activeIndex;
            const done = moduleDone(index);
            const moduleAccent = accentMap[module.accent];
            return (
              <button key={module.id} type="button" onClick={() => setActiveIndex(index)} className={`relative flex w-full items-start gap-3 px-3 py-3.5 text-left transition ${active ? "bg-white/75 shadow-[0_10px_28px_rgba(31,46,42,.06)]" : "hover:bg-white/40"}`}>
                {index < textbook.modules.length - 1 && <span className="absolute left-[19px] top-9 h-[35px] w-px bg-slate-200" />}
                <span className="relative z-10 mt-0.5 bg-[#F4F7F6]" style={{ color: active ? moduleAccent.solid : undefined }}><StepStatus done={done} active={active} /></span>
                <span className="min-w-0"><span className={`block text-[11px] font-black tracking-widest ${active ? "text-slate-500" : "text-slate-300"}`}>STEP {String(index + 1).padStart(2, "0")}</span><span className={`mt-0.5 block truncate text-sm font-bold ${active ? "text-slate-900" : "text-slate-600"}`}>{localize(module.title)}</span></span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="absolute bottom-[76px] left-[268px] right-[328px] top-[74px] overflow-y-auto bg-white">
        <div className="mx-auto max-w-[900px] px-12 py-12 xl:px-16">
          {activeIndex === 0 && (
            <div className="mb-12 grid grid-cols-2 gap-8 border-b border-slate-200 pb-10">
              <div><p className="text-xs font-black tracking-[.18em] text-[#5C9ECF]">{t.scene.toUpperCase()}</p><p className="mt-3 text-[16px] leading-7 text-slate-600">{localize(textbook.chapter.scenario)}</p></div>
              <div><p className="text-xs font-black tracking-[.18em] text-[#2F8F7D]">{t.objective.toUpperCase()}</p><p className="mt-3 text-[16px] leading-7 text-slate-600">{localize(textbook.chapter.goal)}</p></div>
            </div>
          )}
          <div className="flex items-start justify-between gap-8">
            <div><p className="text-xs font-black tracking-[.22em]" style={{ color: accent.solid }}>STEP {String(activeIndex + 1).padStart(2, "0")}</p><h2 className="mt-3 text-[34px] font-black tracking-[-.04em] text-slate-950">{localize(activeModule.title)}</h2><p className="mt-3 max-w-2xl text-[16px] leading-7 text-slate-500">{localize(activeModule.description)}</p></div>
            <div className="flex shrink-0 items-center gap-2 pt-1 text-xs font-semibold text-slate-400"><Clock3 size={15} /> {activeNodes.reduce((total, node) => total + node.minutes, 0)} {t.minutes}</div>
          </div>
          {activeNodes.map((node) => (
            <article key={node.id} className="mt-12">
              <div className="flex items-center gap-3"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent.solid }} /><h3 className="text-lg font-black text-slate-900">{localize(node.title)}</h3></div>
              <ContentRenderer node={node} locale={locale} supportMode={supportMode} />
              {node.activities.map((activity) => <Activity key={activity.id} activity={activity} locale={locale} trackingDisabled={trackingDisabled} onCompleted={(id) => setCompletedActivities((current) => new Set(current).add(id))} />)}
            </article>
          ))}
          <div className="h-16" />
        </div>
      </main>

      <aside className="absolute bottom-[76px] right-0 top-[74px] w-[328px] border-l border-white/70 bg-white/48 p-5 backdrop-blur-xl">
        <div className="flex h-full flex-col overflow-hidden rounded-[26px] bg-white/70 shadow-[0_24px_80px_rgba(31,46,42,.08)] ring-1 ring-white">
          <div className="border-b border-white px-5 py-5"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EEEFFD] text-[#6F72E6]"><Bot size={19} /></span><div><p className="font-black text-slate-900">{t.tutor}</p><p className="mt-0.5 text-[10px] leading-4 text-slate-400">{t.grounded}</p></div></div></div>
          <div className="flex-1 overflow-y-auto p-5">
            <div className="text-xs font-bold tracking-wide text-slate-400">{t.currentMission}</div>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-800">{localize(activeModule.title)}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {([['explain',t.explain],['hint',t.hint],['example',t.example],['roleplay',t.roleplay]] as const).map(([intent,label]) => <button key={intent} type="button" onClick={() => tutorReply(intent)} className="min-h-14 bg-white/80 px-3 py-2 text-left text-xs font-semibold leading-5 text-slate-600 shadow-[0_6px_24px_rgba(31,46,42,.05)] hover:text-[#6F72E6]">{label}</button>)}
            </div>
            {tutorText && <div className="mt-5 whitespace-pre-line bg-[#F4F7F6] px-4 py-4 text-sm leading-6 text-slate-600"><Sparkles size={15} className="mb-2 text-[#6F72E6]" />{tutorText}</div>}
          </div>
          <div className="border-t border-white p-4"><textarea value={tutorInput} onChange={(event) => setTutorInput(event.target.value)} rows={2} placeholder={t.ask} className="w-full resize-none bg-white/80 px-3 py-2 text-sm leading-5 text-slate-700 outline-none placeholder:text-slate-300" /><button type="button" onClick={() => tutorReply('ask')} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#6F72E6] px-4 py-2.5 text-sm font-bold text-white"><Send size={14} /> {t.send}</button></div>
        </div>
      </aside>

      <footer className="absolute inset-x-0 bottom-0 z-20 h-[76px] border-t border-white/70 bg-white/72 px-7 backdrop-blur-2xl">
        <div className="flex h-full items-center justify-between">
          <button type="button" disabled={activeIndex === 0} onClick={() => setActiveIndex((value) => Math.max(0, value - 1))} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 disabled:opacity-25"><ChevronLeft size={18} /> {t.previous}</button>
          <div className="flex items-center gap-2"><span className="text-xs font-semibold text-slate-400">{activeIndex + 1} / {textbook.modules.length}</span>{textbook.modules.map((module, index) => <button key={module.id} type="button" onClick={() => setActiveIndex(index)} aria-label={`Step ${index + 1}`} className={`h-1.5 rounded-full transition-all ${index === activeIndex ? "w-8" : "w-1.5"}`} style={{ backgroundColor: index === activeIndex ? accent.solid : moduleDone(index) ? "#2F8F7D" : "#CBD5E1" }} />)}</div>
          <button type="button" disabled={activeIndex === textbook.modules.length - 1} onClick={() => setActiveIndex((value) => Math.min(textbook.modules.length - 1, value + 1))} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-30">{activeIndex === textbook.modules.length - 1 ? t.chapterTest : t.next} <ChevronRight size={18} /></button>
        </div>
      </footer>
    </div>
  );
}
