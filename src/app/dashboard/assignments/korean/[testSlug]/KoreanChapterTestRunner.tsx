"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  CheckCircle2,
  Clock3,
  EyeOff,
  Lightbulb,
  Maximize2,
  Minimize2,
  Play,
  RotateCcw,
  Send,
  Target,
  Trophy,
  XCircle,
} from "lucide-react";

import type { PublicKoreanChapterTest } from "@/lib/korean-chapter-tests";
import {
  addKoreanQuestionToReviewAction,
  removeKoreanQuestionFromReviewAction,
  submitKoreanChapterTestAction,
  type KoreanChapterTestResult,
} from "../actions";

function hashSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededShuffle<T>(items: T[], seed: string) {
  const shuffled = [...items];
  let state = hashSeed(seed) || 1;
  const random = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

export function KoreanChapterTestRunner({
  test,
  previewMode,
  initialShuffleSeed,
  initialReviewedQuestionKeys,
  ebookHref,
}: {
  test: PublicKoreanChapterTest;
  previewMode: boolean;
  initialShuffleSeed: string;
  initialReviewedQuestionKeys: string[];
  ebookHref: string;
}) {
  const [shuffleSeed, setShuffleSeed] = useState(initialShuffleSeed);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<KoreanChapterTestResult | null>(null);
  const [message, setMessage] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(
    test.durationMinutes * 60
  );
  const [hasExamStarted, setHasExamStarted] = useState(false);
  const [markedQuestions, setMarkedQuestions] = useState<
    Record<string, boolean>
  >(() =>
    Object.fromEntries(
      initialReviewedQuestionKeys.map((questionKey) => [questionKey, true])
    )
  );
  const [eliminatedOptions, setEliminatedOptions] = useState<
    Record<string, number[]>
  >({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [reviewPending, startReviewTransition] = useTransition();
  const startedAtRef = useRef<number | null>(null);
  const examAreaRef = useRef<HTMLElement | null>(null);

  const shuffledQuestions = useMemo(
    () => seededShuffle(test.questions, `${shuffleSeed}-questions`),
    [shuffleSeed, test.questions]
  );
  const visibleQuestions = shuffledQuestions.slice(currentIndex, currentIndex + 1);
  const currentQuestion = visibleQuestions[0];
  const answeredCount = Object.keys(answers).length;
  const resultByQuestionId = useMemo(
    () => new Map(result?.questions?.map((item) => [item.id, item]) ?? []),
    [result]
  );

  useEffect(() => {
    if (!hasExamStarted || result || remainingSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [hasExamStarted, remainingSeconds, result]);

  function startExam() {
    if (hasExamStarted || result) return;
    startedAtRef.current = Date.now();
    setHasExamStarted(true);
    setMessage("");
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === examAreaRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  async function toggleFullscreen() {
    const examArea = examAreaRef.current;
    if (!examArea) return;

    try {
      if (document.fullscreenElement === examArea) {
        await document.exitFullscreen();
      } else {
        if (document.fullscreenElement) await document.exitFullscreen();
        await examArea.requestFullscreen();
      }
    } catch {
      setMessage("当前浏览器无法进入全屏模式。");
    }
  }

  function selectOption(questionId: string, originalOptionIndex: number) {
    if (!hasExamStarted || result) return;
    if (startedAtRef.current === null) startedAtRef.current = Date.now();
    setAnswers((current) => ({
      ...current,
      [questionId]: originalOptionIndex,
    }));
    setMessage("");
  }

  function toggleQuestionReview(questionId: string) {
    if (reviewPending) return;
    const isReviewed = Boolean(markedQuestions[questionId]);

    startReviewTransition(async () => {
      const reviewResult = isReviewed
        ? await removeKoreanQuestionFromReviewAction({
            testSlug: test.slug,
            questionKey: questionId,
          })
        : await addKoreanQuestionToReviewAction({
            testSlug: test.slug,
            questionKey: questionId,
          });
      setMessage(reviewResult.message);
      if (reviewResult.status === "success") {
        setMarkedQuestions((current) => ({
          ...current,
          [questionId]: !isReviewed,
        }));
      }
    });
  }

  function toggleElimination(questionId: string, originalOptionIndex: number) {
    if (
      !hasExamStarted ||
      result ||
      answers[questionId] === originalOptionIndex
    ) return;
    setEliminatedOptions((current) => {
      const eliminated = current[questionId] ?? [];
      return {
        ...current,
        [questionId]: eliminated.includes(originalOptionIndex)
          ? eliminated.filter((index) => index !== originalOptionIndex)
          : [...eliminated, originalOptionIndex],
      };
    });
  }

  function submitTest() {
    if (!hasExamStarted) {
      setMessage("请先在答题工具中点击“开始答题”。");
      return;
    }
    if (answeredCount !== test.questions.length) {
      const firstUnansweredIndex = shuffledQuestions.findIndex(
        (question) => answers[question.id] === undefined
      );
      setCurrentIndex(Math.max(0, firstUnansweredIndex));
      setMessage(`还有 ${test.questions.length - answeredCount} 题未完成。`);
      return;
    }

    setMessage("");
    startTransition(async () => {
      const nextResult = await submitKoreanChapterTestAction({
        testSlug: test.slug,
        answers,
      });
      setResult(nextResult);
      setMessage(nextResult.message);
      if (nextResult.status === "success") {
        const startedAt = startedAtRef.current;
        setElapsedSeconds(
          startedAt === null
            ? 0
            : Math.max(1, Math.round((Date.now() - startedAt) / 1000))
        );
        setCurrentIndex(0);
      }
    });
  }

  function restartTest() {
    setAnswers({});
    setResult(null);
    setMessage("");
    setElapsedSeconds(null);
    setRemainingSeconds(test.durationMinutes * 60);
    setHasExamStarted(false);
    setEliminatedOptions({});
    startedAtRef.current = null;
    setShuffleSeed(crypto.randomUUID());
    setCurrentIndex(0);
  }

  function formatElapsedTime(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes} 分 ${seconds} 秒` : `${seconds} 秒`;
  }

  function formatCountdown(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  const countdownTone =
    remainingSeconds <= 2 * 60
      ? {
          color: "#c94f45",
          borderColor: "#e6a09a",
          backgroundColor: "#fff0ed",
        }
      : remainingSeconds <= 5 * 60
        ? {
            color: "#a87922",
            borderColor: "#e6cb83",
            backgroundColor: "#fff7df",
          }
        : {
            color: "var(--app-success)",
            borderColor: "var(--app-success)",
            backgroundColor: "var(--app-success-soft)",
          };
  const successfulResult = result?.status === "success" ? result : null;
  const dimensionCards = successfulResult
    ? Object.entries(successfulResult.dimensionScores ?? {}).map(
        ([skill, dimension]) => ({
          skill,
          label: dimension.label,
          percent: dimension.percent,
          detail: `${dimension.correct} / ${dimension.total} 题`,
        })
      )
    : Object.entries(test.skills)
        .filter((entry): entry is [string, string] => Boolean(entry[1]))
        .map(([skill, label]) => ({
          skill,
          label,
          percent: null,
          detail: "交卷后显示",
        }));

  return (
    <>
      <section className="hidden">
        <div className="app-card flex min-h-[176px] flex-col items-center justify-center rounded-3xl border p-4 text-center">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              color: successfulResult?.passed
                ? "var(--app-success)"
                : successfulResult
                  ? "var(--app-warm)"
                  : "var(--app-success)",
              backgroundColor: successfulResult?.passed
                ? "var(--app-success-soft)"
                : successfulResult
                  ? "var(--app-warm-soft)"
                  : "var(--app-success-soft)",
            }}
          >
            {successfulResult?.passed ? <Trophy size={19} /> : <Target size={19} />}
          </span>
          <p className="mt-2 text-3xl font-black">
            {successfulResult?.score ?? "—"}
          </p>
          <p className="app-muted-text mt-1 text-[10px] font-black">
            {successfulResult
              ? `答对 ${successfulResult.correctCount}/${successfulResult.totalQuestions} 题`
              : `共 ${test.questions.length} 题`}
          </p>
          <p
            className="mt-1 text-[11px] font-black"
            style={{
              color: successfulResult?.passed
                ? "var(--app-success)"
                : successfulResult
                  ? "var(--app-warm)"
                  : "var(--app-success)",
            }}
          >
            {successfulResult
              ? successfulResult.passed
                ? "达到本章掌握线"
                : "建议复习后再试"
              : "交卷后显示成绩"}
          </p>
        </div>

        <div
          className="app-card flex min-h-[176px] flex-col rounded-3xl border p-4"
          style={{
            background:
              successfulResult?.passed || !successfulResult
                ? "linear-gradient(135deg, var(--app-card-bg), var(--app-success-soft))"
                : "linear-gradient(135deg, var(--app-card-bg), var(--app-warm-soft))",
          }}
        >
          <h2 className="text-sm font-black">能力分布</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {dimensionCards.map((dimension) => (
                    <div
                      key={dimension.skill}
                      className="app-card rounded-xl border p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-black">{dimension.label}</p>
                        <span className="text-xs font-black">
                          {dimension.percent === null ? "—" : `${dimension.percent}%`}
                        </span>
                      </div>
                      <div
                        className="mt-2 h-1.5 overflow-hidden rounded-full"
                        style={{ backgroundColor: "var(--app-soft-bg)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${dimension.percent ?? 0}%`,
                            backgroundColor:
                              dimension.percent !== null &&
                              dimension.percent >= test.passingScore
                                ? "var(--app-success)"
                                : "var(--app-warm)",
                          }}
                        />
                      </div>
                      <p className="app-muted-text mt-1.5 text-[9px]">
                        {dimension.detail}
                      </p>
                    </div>
                  ))}
          </div>
          {successfulResult && !previewMode && !successfulResult.saved && (
            <p className="app-muted-text mt-3 text-[10px]">
              本次评分已完成，但成绩记录尚未写入数据库；应用最新数据库迁移后即可自动保存。
            </p>
          )}
        </div>
      </section>

      <section
        ref={examAreaRef}
        className={`grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)] ${
          isFullscreen
            ? "h-screen overflow-y-auto p-4 xl:place-content-center xl:grid-cols-[300px_minmax(0,960px)_300px]"
            : "xl:grid-cols-[300px_minmax(0,1fr)_300px]"
        }`}
        style={{
          backgroundColor: isFullscreen ? "var(--app-bg)" : undefined,
        }}
      >
        <aside className="app-card h-fit rounded-3xl border p-4 lg:sticky lg:top-5">
          <div
            className="rounded-2xl border p-3"
            style={{ borderColor: "var(--app-border-soft)" }}
          >
            <div className="relative flex min-h-12 items-center justify-center">
              <span
                className="absolute left-0 flex h-9 w-9 items-center justify-center rounded-xl"
                style={{
                  color: successfulResult?.passed
                    ? "var(--app-success)"
                    : successfulResult
                      ? "var(--app-warm)"
                      : "var(--app-success)",
                  backgroundColor: successfulResult?.passed
                    ? "var(--app-success-soft)"
                    : successfulResult
                      ? "var(--app-warm-soft)"
                      : "var(--app-success-soft)",
                }}
              >
                {successfulResult?.passed ? (
                  <Trophy size={17} />
                ) : (
                  <Target size={17} />
                )}
              </span>
              <div className="min-w-0 text-center">
                <p className="text-2xl font-black">
                  {successfulResult ? `${successfulResult.score} 分` : "—"}
                </p>
                <p
                  className="mt-1 text-[10px] font-black"
                  style={{
                    color: successfulResult?.passed
                      ? "var(--app-success)"
                      : successfulResult
                        ? "var(--app-warm)"
                        : "var(--app-success)",
                  }}
                >
                  {successfulResult
                    ? successfulResult.passed
                      ? "达到本章掌握线"
                      : "建议复习后再试"
                    : "交卷后显示成绩"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <p className="text-xs font-black">答题进度</p>
            <span className="app-muted-text text-[10px] font-black">
              {answeredCount}/{test.questions.length}
            </span>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full"
            style={{ backgroundColor: "var(--app-soft-bg)" }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(answeredCount / test.questions.length) * 100}%`,
                backgroundColor: "var(--app-secondary)",
              }}
            />
          </div>

          <div className="mt-4 grid grid-cols-6 gap-1.5">
            {shuffledQuestions.map((question, index) => {
              const review = resultByQuestionId.get(question.id);
              const active = index === currentIndex;
              const answered = answers[question.id] !== undefined;
              return (
                <button
                  key={question.id}
                  type="button"
                  disabled={!hasExamStarted && !result}
                  onClick={() => setCurrentIndex(index)}
                  aria-label={`前往第 ${index + 1} 题`}
                  className="relative flex aspect-square items-center justify-center rounded-lg border text-[10px] font-black transition disabled:cursor-not-allowed disabled:opacity-55"
                  style={{
                    color: active
                      ? "white"
                      : review
                        ? review.correct
                          ? "var(--app-success)"
                          : "#c94f45"
                        : answered
                          ? "var(--app-secondary)"
                          : "var(--app-muted)",
                    backgroundColor: active
                      ? "var(--app-secondary)"
                      : review
                        ? review.correct
                          ? "var(--app-success-soft)"
                          : "#fff0ed"
                        : answered
                          ? "var(--app-secondary-soft)"
                          : "var(--app-card-bg)",
                    borderColor: active
                      ? "var(--app-secondary)"
                      : "var(--app-border-soft)",
                  }}
                >
                  {index + 1}
                  {markedQuestions[question.id] && (
                    <Bookmark
                      size={8}
                      className="absolute right-0.5 top-0.5 fill-current"
                    />
                  )}
                </button>
              );
            })}
          </div>
          <div
            className="mt-4 rounded-2xl border p-3"
            style={{ borderColor: "var(--app-border-soft)" }}
          >
            <p className="text-[10px] font-black">本次答题统计</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
              {[
                {
                  label: "答对",
                  value:
                    result?.status === "success"
                      ? String(result.correctCount ?? 0)
                      : "—",
                  color: "var(--app-success)",
                },
                {
                  label: "答错",
                  value:
                    result?.status === "success"
                      ? String(
                          (result.totalQuestions ?? 0) -
                            (result.correctCount ?? 0)
                        )
                      : "—",
                  color: "var(--app-warm)",
                },
                {
                  label: "用时",
                  value:
                    elapsedSeconds === null
                      ? "—"
                      : formatElapsedTime(elapsedSeconds),
                  color: "var(--app-secondary)",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl px-1 py-2"
                  style={{ backgroundColor: "var(--app-soft-bg)" }}
                >
                  <p
                    className="truncate text-xs font-black"
                    style={{ color: item.color }}
                    title={item.value}
                  >
                    {item.value}
                  </p>
                  <p className="app-muted-text mt-0.5 text-[8px] font-black">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <p className="text-[10px] font-black">能力分布</p>
            <div className="mt-2 space-y-2">
              {dimensionCards.map((dimension) => (
                <div
                  key={dimension.skill}
                  className="rounded-xl border p-2.5"
                  style={{ borderColor: "var(--app-border-soft)" }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-[9px] font-black">
                        {dimension.label}
                      </p>
                      <span className="app-muted-text shrink-0 text-[8px]">
                        {dimension.detail}
                      </span>
                    </div>
                    <span className="text-[10px] font-black">
                      {dimension.percent === null
                        ? "—"
                        : `${dimension.percent}%`}
                    </span>
                  </div>
                  <div
                    className="mt-1.5 h-1 overflow-hidden rounded-full"
                    style={{ backgroundColor: "var(--app-soft-bg)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${dimension.percent ?? 0}%`,
                        backgroundColor:
                          dimension.percent !== null &&
                          dimension.percent >= test.passingScore
                            ? "var(--app-success)"
                            : "var(--app-warm)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {successfulResult && !previewMode && !successfulResult.saved && (
            <p className="app-muted-text mt-3 text-[9px] leading-4">
              本次评分已完成，但成绩记录尚未写入数据库；应用最新数据库迁移后即可自动保存。
            </p>
          )}
          {successfulResult && (
            <button
              type="button"
              onClick={restartTest}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[10px] font-black text-white"
              style={{ backgroundColor: "var(--app-secondary)" }}
            >
              <RotateCcw size={14} />
              重新完整测试
            </button>
          )}
          <div className="app-muted-text mt-4 flex items-center gap-1.5 text-[10px]">
            <Clock3 size={12} />
            建议连续完成，中途不会自动交卷
          </div>
        </aside>

        <article className="app-card rounded-3xl border p-4 sm:p-5">
          <div className="grid gap-4">
            {visibleQuestions.map((question, visibleIndex) => {
              const questionIndex = currentIndex + visibleIndex;
              const review = resultByQuestionId.get(question.id);
              const selectedOption = answers[question.id];
              const displayedOptions = seededShuffle(
                question.options.map((option, originalIndex) => ({
                  option,
                  originalIndex,
                })),
                `${shuffleSeed}-${question.id}-options`
              );

              return (
                <section
                  key={question.id}
                  className="rounded-2xl border p-4 sm:p-5"
                  style={{ borderColor: "var(--app-border-soft)" }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className="rounded-full px-3 py-1.5 text-[10px] font-black"
                      style={{
                        color: "var(--app-secondary)",
                        backgroundColor: "var(--app-secondary-soft)",
                      }}
                    >
                      第 {questionIndex + 1} 题 / {test.questions.length}
                    </span>
                    <span className="app-muted-text text-[10px] font-black">
                      {test.skills[question.skill]}
                    </span>
                  </div>

                  <h2 className="mt-4 min-h-14 text-base font-black leading-7 sm:text-lg">
                    {question.prompt}
                  </h2>

                  <div className="mt-4 space-y-2.5">
                    {displayedOptions.map(
                      ({ option, originalIndex }, optionIndex) => {
                        const selected = selectedOption === originalIndex;
                        const isCorrectOption =
                          Boolean(result) &&
                          review?.correctOption === originalIndex;
                        const isWrongSelected =
                          Boolean(result) &&
                          selected &&
                          review?.correct === false;
                        const eliminated = (
                          eliminatedOptions[question.id] ?? []
                        ).includes(originalIndex);

                        return (
                          <div
                            key={`${question.id}-option-${optionIndex}`}
                            className="flex w-full overflow-hidden rounded-xl border text-xs font-bold transition"
                            style={{
                              color: isCorrectOption
                                ? "var(--app-success)"
                                : isWrongSelected
                                  ? "#c94f45"
                                  : "var(--app-foreground)",
                              backgroundColor: isCorrectOption
                                ? "var(--app-success-soft)"
                                : isWrongSelected
                                  ? "#fff0ed"
                                  : selected
                                    ? "var(--app-secondary-soft)"
                                    : "var(--app-card-bg)",
                              borderColor: isCorrectOption
                                ? "var(--app-success)"
                                : isWrongSelected
                                  ? "#c94f45"
                                  : selected
                                    ? "var(--app-secondary)"
                                    : "var(--app-border-soft)",
                              opacity: eliminated ? 0.48 : 1,
                            }}
                          >
                            <button
                              type="button"
                              disabled={
                                !hasExamStarted ||
                                Boolean(result) ||
                                eliminated
                              }
                              onClick={() =>
                                selectOption(question.id, originalIndex)
                              }
                              className="flex min-w-0 flex-1 items-center gap-2.5 p-3 text-left transition enabled:hover:bg-black/[0.02] disabled:cursor-default"
                            >
                              <span
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-black"
                                style={{
                                  backgroundColor:
                                    isCorrectOption ||
                                    isWrongSelected ||
                                    selected
                                      ? "rgba(255,255,255,.7)"
                                      : "var(--app-soft-bg)",
                                }}
                              >
                                {String.fromCharCode(65 + optionIndex)}
                              </span>
                              <span
                                className={`min-w-0 flex-1 ${eliminated ? "line-through" : ""}`}
                              >
                                {option}
                              </span>
                              {isCorrectOption && <CheckCircle2 size={16} />}
                              {isWrongSelected && <XCircle size={16} />}
                            </button>
                            {!result && (
                              <button
                                type="button"
                                disabled={!hasExamStarted || selected}
                                onClick={() =>
                                  toggleElimination(
                                    question.id,
                                    originalIndex
                                  )
                                }
                                aria-label={
                                  eliminated ? "恢复这个选项" : "排除这个选项"
                                }
                                title={
                                  eliminated ? "恢复选项" : "排除选项"
                                }
                                className="flex w-10 shrink-0 items-center justify-center border-l transition hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-30"
                                style={{
                                  borderColor: "var(--app-border-soft)",
                                  color: eliminated
                                    ? "var(--app-warm)"
                                    : "var(--app-muted)",
                                }}
                              >
                                <EyeOff size={14} />
                              </button>
                            )}
                          </div>
                        );
                      }
                    )}
                  </div>

                  {review && (
                    <div
                      className="mt-4 rounded-xl border p-3"
                      style={{
                        color: review.correct
                          ? "var(--app-success)"
                          : "var(--app-warm)",
                        backgroundColor: review.correct
                          ? "var(--app-success-soft)"
                          : "var(--app-warm-soft)",
                        borderColor: review.correct
                          ? "var(--app-success)"
                          : "var(--app-warm)",
                      }}
                    >
                      <p className="text-[10px] font-black">
                        {review.correct ? "回答正确" : "本题需要复习"}
                      </p>
                      <p className="mt-1.5 text-[11px] font-bold leading-5">
                        {review.explanation}
                      </p>
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <div
            className="mt-5 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderColor: "var(--app-border-soft)" }}
          >
            <button
              type="button"
              disabled={!hasExamStarted || currentIndex === 0}
              onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
              className="app-soft-card inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black disabled:opacity-35"
            >
              <ArrowLeft size={14} />
              上一题
            </button>

            <div className="order-first text-center sm:order-none">
              {message && (
                <p
                  aria-live="polite"
                  className="text-xs font-black"
                  style={{
                    color:
                      result?.status === "success" && result.passed
                        ? "var(--app-success)"
                        : "var(--app-warm)",
                  }}
                >
                  {message}
                </p>
              )}
              {!result && currentIndex >= test.questions.length - 1 && (
                <button
                  type="button"
                  disabled={pending || !hasExamStarted}
                  onClick={submitTest}
                  className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
                  style={{ backgroundColor: "var(--app-success)" }}
                >
                  <Send size={14} />
                  {pending ? "正在评分…" : "交卷并查看结果"}
                </button>
              )}
            </div>

            <button
              type="button"
              disabled={
                !hasExamStarted ||
                currentIndex >= test.questions.length - 1
              }
              onClick={() =>
                setCurrentIndex((index) =>
                  Math.min(test.questions.length - 1, index + 1)
                )
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-35"
              style={{ backgroundColor: "var(--app-secondary)" }}
            >
              下一题
              <ArrowRight size={14} />
            </button>
          </div>
        </article>

        <aside className="app-card h-fit rounded-3xl border p-4 lg:col-start-2 xl:col-start-auto xl:h-full xl:self-stretch">
          <p className="text-center text-xs font-black">答题工具</p>

          <div
            className="mt-3 rounded-2xl border p-3 text-center"
            style={{
              borderColor: countdownTone.borderColor,
              backgroundColor: countdownTone.backgroundColor,
            }}
          >
            <div
              className="flex items-center justify-center gap-1.5 text-[9px] font-black"
              style={{ color: countdownTone.color }}
            >
              <Clock3 size={12} />
              剩余时间
            </div>
            <p
              className="mt-1 font-mono text-2xl font-black tracking-wider"
              style={{ color: countdownTone.color }}
            >
              {formatCountdown(remainingSeconds)}
            </p>
            {!hasExamStarted && !result && (
              <button
                type="button"
                onClick={startExam}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[10px] font-black text-white transition hover:-translate-y-0.5"
                style={{ backgroundColor: "var(--app-success)" }}
              >
                <Play size={13} fill="currentColor" />
                开始答题
              </button>
            )}
            {hasExamStarted && !result && (
              <p
                className="mt-2 text-[9px] font-black"
                style={{ color: countdownTone.color }}
              >
                计时进行中
              </p>
            )}
            {remainingSeconds === 0 && (
              <p
                className="mt-1 text-[9px] font-black"
                style={{ color: countdownTone.color }}
              >
                时间已到，请尽快交卷
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[10px] font-black transition hover:-translate-y-0.5"
            style={{
              color: "var(--app-foreground)",
              borderColor: "var(--app-border-soft)",
              backgroundColor: "var(--app-card-bg)",
            }}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {isFullscreen ? "退出全屏" : "全屏考试"}
          </button>

          <a
            href={ebookHref}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[10px] font-black transition hover:-translate-y-0.5"
            style={{
              color: "var(--app-secondary)",
              borderColor: "var(--app-secondary)",
              backgroundColor: "var(--app-secondary-soft)",
            }}
          >
            <BookOpen size={14} />
            查看本章电子书
          </a>

          <button
            type="button"
            disabled={reviewPending}
            onClick={() => toggleQuestionReview(currentQuestion.id)}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[10px] font-black transition enabled:hover:-translate-y-0.5 disabled:cursor-default"
            style={{
              color: markedQuestions[currentQuestion.id]
                ? "var(--app-secondary)"
                : "var(--app-foreground)",
              borderColor: markedQuestions[currentQuestion.id]
                ? "var(--app-secondary)"
                : "var(--app-border-soft)",
              backgroundColor: markedQuestions[currentQuestion.id]
                ? "var(--app-secondary-soft)"
                : "var(--app-card-bg)",
            }}
          >
            {markedQuestions[currentQuestion.id] ? (
              <BookmarkCheck size={14} />
            ) : (
              <Bookmark size={14} />
            )}
            {reviewPending
              ? "正在更新…"
              : markedQuestions[currentQuestion.id]
                ? "取消加入复习"
                : "加入复习"}
          </button>

          <div
            className="mt-5 rounded-xl border p-3"
            style={{
              color: "var(--app-muted)",
              borderColor: "var(--app-border-soft)",
              backgroundColor: "var(--app-soft-bg)",
            }}
          >
            <p className="flex items-center gap-1.5 text-[9px] font-black">
              <Lightbulb size={11} />
              Tip
            </p>
            <p className="mt-1.5 text-[9px] leading-4">
              点击选项右侧的排除图标，可暂时划掉不确定的答案；再次点击即可恢复，不会直接提交选择。
            </p>
          </div>
        </aside>
      </section>

    </>
  );
}
