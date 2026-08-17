"use client";

import { useRef, useState, useTransition } from "react";

import type { KoreanBookReviewQuiz as KoreanBookReviewQuizData } from "@/lib/korean-book-review";
import { checkKoreanBookReviewAnswer } from "./actions";

type AnswerState = {
  selectedOption: number;
  correct: boolean;
};

export function KoreanBookReviewQuiz({
  quiz,
  onComplete,
}: {
  quiz: KoreanBookReviewQuizData;
  onComplete: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [pendingQuestionId, setPendingQuestionId] = useState("");
  const [isPending, startTransition] = useTransition();
  const correctCount = quiz.questions.filter(
    (question) => answers[question.id]?.correct
  ).length;
  const isComplete =
    quiz.questions.length > 0 && correctCount === quiz.questions.length;

  function answer(questionId: string, optionIndex: number) {
    const scrollTop = scrollRef.current?.scrollTop ?? 0;
    setPendingQuestionId(questionId);
    startTransition(async () => {
      const result = await checkKoreanBookReviewAnswer(
        quiz.testSlug,
        questionId,
        optionIndex
      );
      if (result.status === "success") {
        setAnswers((current) => ({
          ...current,
          [questionId]: {
            selectedOption: optionIndex,
            correct: result.correct,
          },
        }));
      }
      setPendingQuestionId("");
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollTop;
      });
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col [&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-[var(--ring)] [&_button:focus-visible]:ring-offset-2">
      <div
        ref={scrollRef}
        className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-2"
      >
        {quiz.questions.map((question, questionIndex) => {
          const answerState = answers[question.id];
          return (
            <section
              key={question.id}
              className="rounded-2xl border border-[var(--border)] bg-white p-3.5"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-bold text-[var(--status-success)]">
                  {questionIndex + 1}. {question.prompt}
                </h3>
                {answerState && (
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${
                      answerState.correct
                        ? "bg-[var(--status-success-surface)] text-[var(--status-success)]"
                        : "bg-[var(--status-warning-surface)] text-[var(--status-warning)]"
                    }`}
                  >
                    {answerState.correct ? "回答正确" : "再想一想"}
                  </span>
                )}
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-2 lg:grid-cols-4">
                {question.options.map((option, optionIndex) => {
                  const selected =
                    answerState?.selectedOption === optionIndex;
                  return (
                    <button
                      key={`${question.id}-${optionIndex}`}
                      type="button"
                      disabled={
                        isPending && pendingQuestionId === question.id
                      }
                      onClick={() => answer(question.id, optionIndex)}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition disabled:opacity-50 ${
                        selected && answerState.correct
                          ? "border-[var(--border)] bg-[var(--status-success-surface)] text-[var(--status-success)]"
                          : selected
                            ? "border-[var(--border)] bg-[var(--status-warning-surface)] text-[var(--status-warning)]"
                            : "border-[var(--border)] bg-[var(--card)] text-[var(--status-success)] hover:border-[var(--border)]"
                      }`}
                    >
                      {String.fromCharCode(65 + optionIndex)}. {option}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl bg-[var(--primary)] p-4 text-center text-white">
        <p className="text-sm font-bold">
          已答对 {correctCount} / {quiz.questions.length} 题
        </p>
        <p className="mt-1 text-xs text-white/70">
          {isComplete
            ? "全部回答正确，可以返回第一页。"
            : `还需答对 ${quiz.questions.length - correctCount} 题，才能返回第一页。`}
        </p>
        <button
          type="button"
          disabled={!isComplete}
          onClick={onComplete}
          className="mt-3 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white transition enabled:hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35"
        >
          返回第一页
        </button>
      </div>
    </div>
  );
}
