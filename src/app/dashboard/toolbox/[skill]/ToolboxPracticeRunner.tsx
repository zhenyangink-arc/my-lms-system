"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Mic,
  RotateCcw,
  Send,
  Volume2,
} from "lucide-react";

import {
  submitToolboxPractice,
  type ToolboxPracticeResult,
} from "@/app/dashboard/toolbox/actions";

type ChoiceOption = { value: string; label: string };

export type ToolboxQuestion = {
  id: string;
  questionType: "single_choice" | "true_false" | "short_text";
  prompt: string;
  options: ChoiceOption[];
  hint: string;
  stimulus: string;
  speakBeforeAnswer: boolean;
  maxScore: number;
};

export type ToolboxExercise = {
  id: string;
  skill:
    | "listening"
    | "speaking"
    | "reading"
    | "writing"
    | "grammar"
    | "vocabulary";
  title: string;
  description: string;
  instructions: string;
  passageTitle: string;
  passage: string;
  helper: string;
};

function createEventId() {
  if (
    typeof window !== "undefined" &&
    typeof window.crypto?.randomUUID === "function"
  ) {
    return window.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
    const value = Math.floor(Math.random() * 16);
    const resolved = token === "x" ? value : (value & 0x3) | 0x8;
    return resolved.toString(16);
  });
}

function formatSeconds(total: number) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function ToolboxPracticeRunner({
  exercise,
  questions,
  backHref,
  accent,
  soft,
}: {
  exercise: ToolboxExercise;
  questions: ToolboxQuestion[];
  backHref: string;
  accent: string;
  soft: string;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [result, setResult] = useState<ToolboxPracticeResult | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const questionSecondsRef = useRef<Record<string, number>>({});
  const eventIdRef = useRef<string | null>(null);
  const currentQuestion = questions[currentIndex];

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible" || result) return;
      setElapsedSeconds((value) => Math.min(7200, value + 1));
      const questionId = questions[currentIndex]?.id;
      if (questionId) {
        questionSecondsRef.current[questionId] = Math.min(
          7200,
          (questionSecondsRef.current[questionId] ?? 0) + 1,
        );
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [currentIndex, questions, result]);

  const answeredCount = questions.filter((question) =>
    Boolean(answers[question.id]?.trim()),
  ).length;
  const progress = questions.length
    ? Math.round((answeredCount / questions.length) * 100)
    : 0;

  function updateAnswer(value: string) {
    setAnswers((current) => ({ ...current, [currentQuestion.id]: value }));
    setError("");
  }

  function playStimulus() {
    if (!currentQuestion.stimulus || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentQuestion.stimulus);
    utterance.lang = "ko-KR";
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  }

  function submit() {
    if (answeredCount !== questions.length) {
      const firstUnanswered = questions.findIndex(
        (question) => !answers[question.id]?.trim(),
      );
      if (firstUnanswered >= 0) setCurrentIndex(firstUnanswered);
      setError("请完成全部题目后再提交。");
      return;
    }

    eventIdRef.current ??= createEventId();
    setError("");
    startTransition(async () => {
      const response = await submitToolboxPractice({
        exerciseId: exercise.id,
        clientEventId: eventIdRef.current!,
        activeSeconds: elapsedSeconds,
        answers: questions.map((question) => ({
          questionId: question.id,
          response: answers[question.id],
          durationSeconds: questionSecondsRef.current[question.id] ?? 0,
        })),
      });
      if (!response.ok) {
        setError(response.message);
        return;
      }
      setResult(response.result);
    });
  }

  function restart() {
    setCurrentIndex(0);
    setAnswers({});
    setElapsedSeconds(0);
    setResult(null);
    setError("");
    eventIdRef.current = null;
    questionSecondsRef.current = {};
  }

  if (result) {
    return (
      <section className="app-card rounded-[2rem] border p-6 text-center sm:p-10">
        <span
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ color: accent, backgroundColor: soft }}
        >
          <CheckCircle2 size={30} aria-hidden="true" />
        </span>
        <p className="mt-5 text-[10px] font-bold tracking-[0.14em]" style={{ color: accent }}>
          练习结果已保存
        </p>
        <h2 className="mt-2 text-2xl font-bold">本次得分 {result.percentage.toFixed(1)}%</h2>
        <p className="app-muted-text mt-2 text-sm font-bold">
          答对 {result.correctCount} / {result.answeredCount} 题 · 有效练习 {formatSeconds(elapsedSeconds)}
        </p>
        <div className="mx-auto mt-6 grid max-w-lg gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={restart}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-5 text-sm font-bold transition hover:bg-[var(--surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            style={{ borderColor: "var(--border)" }}
          >
            <RotateCcw size={16} aria-hidden="true" />
            再练一次
          </button>
          <Link
            href={backHref}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-bold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            style={{ backgroundColor: accent }}
          >
            查看能力画像
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(300px,0.72fr)_minmax(0,1.28fr)] xl:items-start">
      <aside className="space-y-4 xl:sticky xl:top-5">
        {exercise.passage && (
          <section className="app-card rounded-[2rem] border p-5 sm:p-6">
            <p className="text-[10px] font-bold tracking-[0.14em]" style={{ color: accent }}>
              阅读材料
            </p>
            <h2 className="mt-2 text-lg font-bold">{exercise.passageTitle}</h2>
            <p className="mt-4 whitespace-pre-line text-base font-bold leading-8" lang="ko">
              {exercise.passage}
            </p>
          </section>
        )}

        <section className="app-soft-card rounded-3xl border p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold">本轮进度</p>
            <span className="text-xs font-bold tabular-nums" style={{ color: accent }}>
              {answeredCount}/{questions.length}
            </span>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--card)]"
            role="progressbar"
            aria-label="练习完成进度"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span
              className="block h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${progress}%`, backgroundColor: accent }}
            />
          </div>
          <div className="app-muted-text mt-4 flex items-center gap-2 text-xs font-bold tabular-nums">
            <Clock3 size={14} aria-hidden="true" />
            有效练习 {formatSeconds(elapsedSeconds)}
          </div>
          <p className="app-muted-text mt-3 text-[10px] font-bold leading-5">
            时间只用于学习记录，不直接增加能力分。切换到其他标签页时会暂停。
          </p>
        </section>
      </aside>

      <section className="app-card rounded-[2rem] border p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold tracking-[0.14em]" style={{ color: accent }}>
              第 {currentIndex + 1} 题 · 共 {questions.length} 题
            </p>
            <h2 className="mt-2 text-xl font-bold leading-8">{currentQuestion.prompt}</h2>
          </div>
          <span className="rounded-full px-3 py-1.5 text-[10px] font-bold" style={{ color: accent, backgroundColor: soft }}>
            {currentQuestion.maxScore} 分
          </span>
        </div>

        {currentQuestion.hint && (
          <p className="mt-4 rounded-2xl px-4 py-3 text-xs font-bold leading-5" style={{ backgroundColor: soft }}>
            提示：{currentQuestion.hint}
          </p>
        )}

        {currentQuestion.stimulus && (
          <section
            className="mt-4 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-soft)" }}
            aria-label="听力材料"
          >
            <div>
              <p className="text-sm font-bold">播放本题韩语材料</p>
              <p className="app-muted-text mt-1 text-xs font-bold">可以重复播放，材料文字不会提前显示。</p>
            </div>
            <button
              type="button"
              onClick={playStimulus}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
              style={{ backgroundColor: accent, outlineColor: accent }}
            >
              <Volume2 size={16} aria-hidden="true" />
              播放韩语
            </button>
          </section>
        )}

        {currentQuestion.speakBeforeAnswer && (
          <p className="mt-4 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold" style={{ color: accent, backgroundColor: soft }}>
            <Mic size={16} aria-hidden="true" />
            先把你认为正确的表达大声说出来，再选择答案。
          </p>
        )}

        <div className="mt-6">
          {currentQuestion.questionType === "short_text" ? (
            <div>
              <label htmlFor={`answer-${currentQuestion.id}`} className="text-xs font-bold">
                你的答案
              </label>
              <textarea
                id={`answer-${currentQuestion.id}`}
                value={answers[currentQuestion.id] ?? ""}
                onChange={(event) => updateAnswer(event.target.value)}
                rows={5}
                lang="ko"
                maxLength={5000}
                className="mt-2 min-h-36 w-full resize-y rounded-2xl border bg-[var(--card)] px-4 py-3 text-base font-bold leading-7 outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--accent)]"
                style={{ borderColor: "var(--border)" }}
                placeholder="请在这里输入完整的韩语句子"
              />
            </div>
          ) : (
            <fieldset>
              <legend className="sr-only">请选择答案</legend>
              <div className="grid gap-3">
                {currentQuestion.options.map((option) => {
                  const selected = answers[currentQuestion.id] === option.value;
                  return (
                    <label
                      key={option.value}
                      className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold transition hover:bg-[var(--surface-soft)]"
                      style={{
                        borderColor: selected ? accent : "var(--border)",
                        backgroundColor: selected ? soft : "var(--card)",
                      }}
                    >
                      <input
                        type="radio"
                        name={`question-${currentQuestion.id}`}
                        value={option.value}
                        checked={selected}
                        onChange={() => updateAnswer(option.value)}
                        className="h-4 w-4 accent-[var(--primary)]"
                      />
                      <span lang="ko">{option.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="mt-5 flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-bold"
            style={{ color: "var(--status-warning)", backgroundColor: "var(--status-warning-surface)" }}
          >
            <CircleAlert size={15} aria-hidden="true" />
            {error}
          </p>
        )}

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-5">
          <button
            type="button"
            disabled={currentIndex === 0 || isPending}
            onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ borderColor: "var(--border)" }}
          >
            <ArrowLeft size={15} aria-hidden="true" />
            上一题
          </button>

          {currentIndex < questions.length - 1 ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => setCurrentIndex((value) => Math.min(questions.length - 1, value + 1))}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-xs font-bold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: accent }}
            >
              下一题
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isPending}
              onClick={submit}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-xs font-bold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: accent }}
            >
              <Send size={15} aria-hidden="true" />
              {isPending ? "正在核验…" : "提交练习"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
