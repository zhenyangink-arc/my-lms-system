"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Ear,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";

import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import {
  evaluateChapterPracticeListening,
  type ListeningEvaluationResult,
} from "../listening-actions";
import {
  isTemporaryListeningAudio,
  parseListeningMaterial,
} from "../student/listening";
import type { PublishedChapterPracticeBlock } from "../student/types";
import type { StudentChapterPracticeProgress } from "../student/types";

export function ListeningBlockContent({
  block,
  onPlay,
  onProgress,
}: {
  block: PublishedChapterPracticeBlock;
  onPlay?: () => void;
  onProgress?: (progress: StudentChapterPracticeProgress) => void;
}) {
  const material = useMemo(() => parseListeningMaterial(block), [block]);
  const temporaryAudio = isTemporaryListeningAudio(material);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [playCount, setPlayCount] = useState(0);
  const [speakingQuestionId, setSpeakingQuestionId] = useState<string | null>(
    null,
  );
  const [result, setResult] = useState<ListeningEvaluationResult | null>(null);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionAnswered, setSessionAnswered] = useState(0);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(
    () => () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    },
    [],
  );

  const playableQuestions = material.questions.filter(
    (question) => question.stimulus || question.audioUrl,
  );
  const judgeableQuestions = material.questions.filter(
    (question) => question.options.length > 0,
  );
  const answeredCount = judgeableQuestions.filter((question) =>
    Boolean(answers[question.id]?.trim()),
  ).length;

  function speak(text: string, questionId: string) {
    if (!("speechSynthesis" in window) || !text) {
      setError("当前浏览器不支持文本朗读，请改用支持语音合成的浏览器。");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = 0.85;
    utterance.onend = () => setSpeakingQuestionId(null);
    utterance.onerror = () => {
      setSpeakingQuestionId(null);
      setError("临时语音播放失败，请重试或检查浏览器语音设置。");
    };
    setError("");
    setSpeakingQuestionId(questionId);
    setPlayCount((count) => count + 1);
    onPlay?.();
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeakingQuestionId(null);
  }

  function submitAnswers() {
    if (answeredCount !== judgeableQuestions.length) {
      setError("请完成全部听辨题后再查看听后反馈。");
      return;
    }
    setError("");
    startTransition(async () => {
      const response = await evaluateChapterPracticeListening({
        blockId: block.id,
        answers: judgeableQuestions.map((question) => ({
          questionId: question.id,
          response: answers[question.id],
        })),
      });
      if (!response.ok) {
        setError(response.message);
        return;
      }
      setResult(response.result);
      setSessionCorrect((count) => count + response.result.correctCount);
      setSessionAnswered((count) => count + response.result.answeredCount);
      onProgress?.(response.progress);
    });
  }

  function retry() {
    setAnswers({});
    setResult(null);
    setError("");
  }

  if (!material.transcript && !material.audioUrl && material.questions.length === 0) {
    return (
      <p className="flex items-start gap-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-sm font-medium leading-6">
        <CircleAlert className="mt-1 shrink-0" size={16} aria-hidden="true" />
        本章暂未提供听力文本、音频或听辨题。其他巩固内容仍可正常使用。
      </p>
    );
  }

  const feedbackByQuestion = new Map(
    result?.feedback.map((item) => [item.questionId, item]) ?? [],
  );
  const sessionPercentage = sessionAnswered
    ? Math.round((sessionCorrect / sessionAnswered) * 100)
    : null;

  return (
    <div className="space-y-5">
      <div
        className="flex items-start gap-3 rounded-2xl border-2 border-[var(--border)] bg-[var(--surface-soft)] p-4"
        role="status"
      >
        {temporaryAudio ? (
          <AlertTriangle className="mt-0.5 shrink-0" size={20} aria-hidden="true" />
        ) : (
          <CheckCircle2 className="mt-0.5 shrink-0" size={20} aria-hidden="true" />
        )}
        <div>
          <p className="text-sm font-bold">
            {temporaryAudio ? "临时语音（非正式录音）" : "正式音频"}
          </p>
          <p className="mt-1 text-xs font-medium leading-5 text-[var(--foreground-secondary)]">
            {temporaryAudio
              ? material.audioStatus === "ready"
                ? "来源标记为已就绪，但当前巩固块没有可播放地址；本页使用浏览器文本朗读。"
                : "正式音频尚未提供；本页使用浏览器文本朗读，声音效果因设备而异。"
              : "播放的是当前已发布巩固块提供的音频地址。"}
          </p>
        </div>
      </div>

      <section className="rounded-2xl bg-[var(--surface-soft)] p-4">
        <CardTitleWithHint
          title="听前目标"
          description="先明确要捕捉的信息，再播放材料；目标来自本章已发布的听力来源。"
          headingLevel={3}
          titleClassName="text-base font-bold"
        />
        {material.objectives.length > 0 ? (
          <ul className="mt-3 grid gap-2 text-sm font-medium leading-6" role="list">
            {material.objectives.map((objective) => (
              <li key={objective} className="flex items-start gap-2">
                <Ear className="mt-1 shrink-0" size={15} aria-hidden="true" />
                <span>{objective}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm font-medium text-[var(--foreground-secondary)]">
            本章没有单独配置听前目标，请先阅读题目要求再播放材料。
          </p>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] p-4">
          <p className="text-xs font-bold text-[var(--foreground-secondary)]">本页播放次数</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{playCount}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] p-4" aria-live="polite">
          <p className="text-xs font-bold text-[var(--foreground-secondary)]">本页会话正确率</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {sessionPercentage === null ? "尚未作答" : `${sessionPercentage}%`}
          </p>
          {sessionAnswered > 0 ? (
            <p className="mt-1 text-xs font-medium text-[var(--foreground-secondary)]">
              累计答对 {sessionCorrect}/{sessionAnswered} 题
            </p>
          ) : null}
        </div>
      </div>

      {material.audioUrl ? (
        <section>
          <h3 className="text-base font-bold">本章听力材料</h3>
          <audio
            className="mt-3 w-full"
            controls
            preload="metadata"
            src={material.audioUrl}
            onPlay={() => {
              setPlayCount((count) => count + 1);
              onPlay?.();
            }}
          >
            当前浏览器不支持音频播放。
          </audio>
        </section>
      ) : null}

      {playableQuestions.length > 0 ? (
        <section>
          <CardTitleWithHint
            title="本章听力材料"
            description="每道材料都可以重复播放。作答前不显示文本，提交后会在听后反馈中显示。"
            headingLevel={3}
            titleClassName="text-base font-bold"
          />
          <div className="mt-3 grid gap-3">
            {playableQuestions.map((question, index) => (
              <div
                key={question.id}
                className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-sm font-bold">第 {index + 1} 段材料</p>
                {question.audioUrl ? (
                  <audio
                    controls
                    preload="metadata"
                    src={question.audioUrl}
                    onPlay={() => {
                      setPlayCount((count) => count + 1);
                      onPlay?.();
                    }}
                    className="w-full sm:max-w-sm"
                  >
                    当前浏览器不支持音频播放。
                  </audio>
                ) : speakingQuestionId === question.id ? (
                  <button
                    type="button"
                    onClick={stopSpeaking}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  >
                    <Pause size={16} aria-hidden="true" />
                    停止临时语音
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => speak(question.stimulus, question.id)}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-[var(--primary-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
                  >
                    <Volume2 size={16} aria-hidden="true" />
                    播放临时语音
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="text-base font-bold">听辨题</h3>
        {judgeableQuestions.length > 0 ? (
          <div className="mt-3 space-y-4">
            {judgeableQuestions.map((question, questionIndex) => {
              const feedback = feedbackByQuestion.get(question.id);
              return (
                <fieldset
                  key={question.id}
                  className="rounded-2xl border border-[var(--border)] p-4"
                >
                  <legend className="px-1 text-sm font-bold leading-6">
                    {questionIndex + 1}. {question.prompt}
                  </legend>
                  {question.hint ? (
                    <p className="mt-2 text-xs font-medium leading-5 text-[var(--foreground-secondary)]">
                      提示：{question.hint}
                    </p>
                  ) : null}
                  <div className="mt-3 grid gap-2">
                    {question.options.map((option) => {
                      const selected = answers[question.id] === option.value;
                      return (
                        <label
                          key={option.value}
                          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-soft)] focus-within:ring-2 focus-within:ring-[var(--ring)]"
                        >
                          <input
                            type="radio"
                            name={`listening-question-${block.id}-${question.id}`}
                            value={option.value}
                            checked={selected}
                            disabled={Boolean(result)}
                            onChange={() => {
                              setAnswers((current) => ({
                                ...current,
                                [question.id]: option.value,
                              }));
                              setError("");
                            }}
                            className="h-4 w-4 accent-[var(--primary)]"
                          />
                          <span>{option.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  {feedback ? (
                    <div
                      className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--surface-soft)] px-3 py-2 text-sm font-medium leading-6"
                      role="status"
                    >
                      {feedback.isCorrect ? (
                        <CheckCircle2 className="mt-1 shrink-0" size={16} aria-hidden="true" />
                      ) : (
                        <XCircle className="mt-1 shrink-0" size={16} aria-hidden="true" />
                      )}
                      <span>
                        {feedback.isCorrect ? "回答正确。" : "回答有误。"}
                        {feedback.explanation ? ` ${feedback.explanation}` : ""}
                      </span>
                    </div>
                  ) : null}
                </fieldset>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--surface-soft)] px-4 py-3 text-sm font-medium leading-6">
            <CircleAlert className="mt-1 shrink-0" size={16} aria-hidden="true" />
            本章听力来源暂未提供可作答的听辨题，可继续重复播放材料。
          </p>
        )}
      </section>

      <section className="rounded-2xl bg-[var(--surface-soft)] p-4" aria-live="polite">
        <h3 className="text-base font-bold">听后反馈</h3>
        {result ? (
          <div className="mt-3">
            <p className="text-sm font-bold">
              本轮答对 {result.correctCount}/{result.answeredCount} 题，正确率 {result.percentage}%
            </p>
            {material.transcript ? (
              <details className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                <summary className="min-h-8 cursor-pointer text-sm font-bold">查看本章听力文本</summary>
                <p className="mt-2 whitespace-pre-line text-sm font-medium leading-7" lang="ko">
                  {material.transcript}
                </p>
              </details>
            ) : null}
            <button
              type="button"
              onClick={retry}
              className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <RotateCcw size={16} aria-hidden="true" />
              再听一轮
            </button>
          </div>
        ) : (
          <p className="mt-2 text-sm font-medium leading-6 text-[var(--foreground-secondary)]">
            完成听辨题并提交后，这里会显示本轮正确率、逐题说明和听力文本。
          </p>
        )}
        {error ? (
          <p className="mt-3 flex items-start gap-2 text-sm font-bold" role="alert">
            <CircleAlert className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
            {error}
          </p>
        ) : null}
        {!result && judgeableQuestions.length > 0 ? (
          <button
            type="button"
            onClick={submitAnswers}
            disabled={isPending}
            className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-[var(--primary-foreground)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
          >
            {isPending ? <Play className="animate-pulse motion-reduce:animate-none" size={16} aria-hidden="true" /> : null}
            {isPending ? "正在核验" : "提交并查看反馈"}
          </button>
        ) : null}
      </section>
    </div>
  );
}
