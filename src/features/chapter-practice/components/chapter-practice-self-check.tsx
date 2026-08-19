"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import {
  evaluateChapterPracticeSelfCheck,
  selfCheckTopics,
} from "../student/model";
import type {
  ChapterPracticeSelfCheckResult,
  PublishedChapterPracticeBlock,
} from "../student/types";

export function ChapterPracticeSelfCheck({
  block,
  chapterTitle,
  backHref,
  chapterTestHref,
  onCompleted,
}: {
  block: PublishedChapterPracticeBlock;
  chapterTitle: string;
  backHref: string;
  chapterTestHref: string;
  onCompleted: (
    result: ChapterPracticeSelfCheckResult,
    reviewTopics: string[],
  ) => void;
}) {
  const topics = useMemo(
    () => selfCheckTopics(block, chapterTitle),
    [block, chapterTitle],
  );
  const passingScore = Number(block.contentPayload.passingScore) || 80;
  const testSlug =
    typeof block.contentPayload.testSlug === "string"
      ? block.contentPayload.testSlug
      : "";
  const [answers, setAnswers] = useState<
    Record<string, "mastered" | "review">
  >({});
  const [error, setError] = useState("");
  const [result, setResult] = useState<ChapterPracticeSelfCheckResult | null>(
    null,
  );

  function submit() {
    if (Object.keys(answers).length !== topics.length) {
      setError("请完成每一项判断后再查看结果。");
      return;
    }
    setError("");
    const nextResult = evaluateChapterPracticeSelfCheck({
      answers,
      topics,
      passingScore,
    });
    setResult(nextResult);
    onCompleted(
      nextResult,
      topics.filter((_, index) => answers[String(index)] === "review"),
    );
  }

  function restart() {
    setAnswers({});
    setError("");
    setResult(null);
  }

  if (result) {
    const ResultIcon = result.passed ? CheckCircle2 : CircleAlert;
    return (
      <section
        id={`practice-block-${block.id}`}
        className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6"
        aria-labelledby="practice-result-title"
      >
        <div id="practice-result" aria-live="polite" aria-atomic="true" role="status">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{
              color: result.passed
                ? "var(--status-success)"
                : "var(--status-warning)",
              backgroundColor: result.passed
                ? "var(--status-success-surface)"
                : "var(--status-warning-surface)",
            }}
          >
            <ResultIcon size={24} aria-hidden="true" />
          </span>
          <h2 id="practice-result-title" className="mt-4 text-xl font-bold">
            巩固结果：{result.passed ? "可以继续" : "建议再练一次"}
          </h2>
          <p className="mt-2 text-sm font-medium leading-6 text-[var(--foreground-secondary)]">
            本次自评 {result.score} 分，掌握 {result.masteredCount} / {result.topicCount} 项；
            本章建议线为 {result.passingScore} 分。
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">
            {result.passed
              ? "你已能辨认本章主要内容。章节测试会使用私有答案进行正式核验。"
              : "这不是失败记录。先回看标记为“还需加强”的主题，再重新自检即可。"}
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={restart}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-bold transition-colors hover:bg-[var(--surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <RotateCcw size={16} aria-hidden="true" />
            重新练习
          </button>
          {testSlug ? (
            <Link
              href={`${chapterTestHref}/${encodeURIComponent(testSlug)}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
            >
              进入章节测试
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          ) : (
            <a
              href="#practice-content"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
            >
              回看本章内容
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          )}
          <Link
            href={backHref}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-bold transition-colors hover:bg-[var(--surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            返回巩固目录
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      id={`practice-block-${block.id}`}
      className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6"
    >
      <CardTitleWithHint
        title={block.title}
        description={block.instructions}
        headingLevel={2}
        titleClassName="text-lg font-bold"
      />
      <p className="mt-3 text-sm leading-6 text-[var(--foreground-secondary)]">
        请按当前真实感受判断每个本章主题。提交后会给出评分和下一步建议，并保存本次巩固结果。
      </p>
      <div className="mt-5 space-y-4">
        {topics.map((topic, index) => (
          <fieldset
            key={`${topic}-${index}`}
            className="rounded-2xl border border-[var(--border-subtle)] p-4"
          >
            <legend className="px-1 text-sm font-bold leading-6">
              {index + 1}. {topic}
            </legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[
                ["mastered", "已经掌握"],
                ["review", "还需加强"],
              ].map(([value, label]) => {
                const selected = answers[String(index)] === value;
                return (
                  <label
                    key={value}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm font-bold transition-colors hover:bg-[var(--surface-soft)]"
                    style={{
                      borderColor: selected ? "var(--primary)" : "var(--border)",
                      backgroundColor: selected ? "var(--accent)" : "var(--card)",
                    }}
                  >
                    <input
                      type="radio"
                      name={`self-check-${block.id}-${index}`}
                      value={value}
                      checked={selected}
                      onChange={() => {
                        setAnswers((current) => ({
                          ...current,
                          [String(index)]: value as "mastered" | "review",
                        }));
                        setError("");
                      }}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      {error ? (
        <p
          role="alert"
          className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--status-warning-surface)] px-3 py-2 text-sm font-bold text-[var(--status-warning)]"
        >
          <CircleAlert size={16} aria-hidden="true" />
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={submit}
        className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
      >
        查看巩固结果
        <ArrowRight size={16} aria-hidden="true" />
      </button>
    </section>
  );
}
