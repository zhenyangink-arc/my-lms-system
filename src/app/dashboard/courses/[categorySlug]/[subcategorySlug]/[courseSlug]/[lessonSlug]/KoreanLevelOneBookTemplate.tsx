"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";

import type { KoreanLevelOneLesson } from "./KoreanLevelOneLessonBook";

export type KoreanEbookSectionTone = {
  color: string;
  soft: string;
};

export type KoreanEbookPageMeta = KoreanEbookSectionTone & {
  tag: string;
  label: string;
  progress: string;
};

export type KoreanEbookTocEntry = {
  step: string;
  title: string;
  pageRange: string;
  detail?: string;
};

export type KoreanEbookSectionDefinition = {
  step: string;
  label: string;
  dividerPage: number;
  contentPages: number[];
};

export const KOREAN_EBOOK_SECTION_TONES: Record<string, KoreanEbookSectionTone> = {
  "第一步": { color: "var(--status-warning)", soft: "var(--status-warning-surface)" },
  "第二步": { color: "var(--primary)", soft: "var(--accent)" },
  "第三步": { color: "var(--primary)", soft: "var(--accent)" },
  "第四步": { color: "var(--status-warning)", soft: "var(--status-warning-surface)" },
  "第五步": { color: "var(--destructive)", soft: "var(--status-warning-surface)" },
  "第六步": { color: "var(--primary)", soft: "var(--accent)" },
  "第七步": { color: "var(--status-success)", soft: "var(--status-success-surface)" },
  "第八步": { color: "var(--status-success)", soft: "var(--status-success-surface)" },
};

export function getKoreanEbookStepTone(step: string) {
  const normalizedStep =
    Object.keys(KOREAN_EBOOK_SECTION_TONES).find((key) => step.includes(key)) ??
    "第八步";
  return KOREAN_EBOOK_SECTION_TONES[normalizedStep];
}

export function getKoreanEbookStepToneClass(step: string) {
  if (step.includes("第一步")) return "bg-[var(--status-warning-surface)] text-[var(--status-warning)]";
  if (step.includes("第二步")) return "bg-[var(--accent)] text-[var(--primary)]";
  if (step.includes("第三步")) return "bg-[var(--accent)] text-[var(--primary)]";
  if (step.includes("第四步")) return "bg-[var(--status-warning-surface)] text-[var(--status-warning)]";
  if (step.includes("第五步")) return "bg-[var(--status-warning-surface)] text-[var(--destructive)]";
  if (step.includes("第六步")) return "bg-[var(--accent)] text-[var(--primary)]";
  if (step.includes("第七步")) return "bg-[var(--status-success-surface)] text-[var(--status-success)]";
  return "bg-[var(--status-success-surface)] text-[var(--status-success)]";
}

export function getKoreanEbookVocabularyTone(type: string) {
  if (type.includes("名词")) return "bg-[var(--accent)] text-[var(--primary)]";
  if (type.includes("动词")) return "bg-[var(--status-warning-surface)] text-[var(--status-warning)]";
  if (type.includes("代词")) return "bg-[var(--accent)] text-[var(--primary)]";
  if (type.includes("副词")) return "bg-[var(--status-warning-surface)] text-[var(--status-warning)]";
  if (type.includes("形容词")) return "bg-[var(--status-warning-surface)] text-[var(--destructive)]";
  if (type.includes("表达") || type.includes("回答")) {
    return "bg-[var(--status-success-surface)] text-[var(--status-success)]";
  }
  return "bg-[var(--status-warning-surface)] text-[var(--destructive)]";
}

function formatBookPage(page: number) {
  return String(page).padStart(2, "0");
}

export function buildKoreanEbookSectionMap(
  sections: KoreanEbookSectionDefinition[]
) {
  const headers: Record<string, string> = { "01": "目录" };
  const pageMeta: Record<string, KoreanEbookPageMeta> = {};

  for (const section of sections) {
    const tone = getKoreanEbookStepTone(section.step);
    const dividerPage = formatBookPage(section.dividerPage);
    const header = `${section.step} · ${section.label}`;

    headers[dividerPage] = header;
    pageMeta[dividerPage] = {
      tag: section.step,
      label: section.label,
      progress: "分区起始页",
      color: tone.color,
      soft: tone.soft,
    };

    section.contentPages.forEach((page, index) => {
      const pageNumber = formatBookPage(page);
      headers[pageNumber] = header;
      pageMeta[pageNumber] = {
        tag: section.step,
        label: section.label,
        progress: `${index + 1} / ${section.contentPages.length}`,
        color: tone.color,
        soft: tone.soft,
      };
    });
  }

  return { headers, pageMeta };
}

export const KoreanEbookPage = forwardRef<
  HTMLDivElement,
  {
    children?: React.ReactNode;
    number: string;
    header: string;
    sectionMeta?: KoreanEbookPageMeta;
    cover?: boolean;
    hideContentOverflow?: boolean;
    learningTools?: boolean;
  }
>(function KoreanEbookPage(
  {
    children,
    number,
    header,
    sectionMeta,
    cover = false,
    hideContentOverflow = false,
    learningTools = false,
  },
  ref
) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [hasTranslations, setHasTranslations] = useState(false);
  const [hasAnswers, setHasAnswers] = useState(false);
  const [showTranslations, setShowTranslations] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);

  useEffect(() => {
    if (!learningTools || !contentRef.current) return;
    setHasTranslations(
      Boolean(contentRef.current.querySelector("[data-ebook-translation]"))
    );
    setHasAnswers(
      Boolean(contentRef.current.querySelector("[data-ebook-answer]"))
    );
  }, [children, learningTools]);

  function speakPageKorean() {
    if (!contentRef.current || !("speechSynthesis" in window)) return;

    const lines = contentRef.current.innerText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => /[가-힣]/.test(line))
      .filter((line, index, allLines) => allLines.indexOf(line) === index);

    if (lines.length === 0) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(lines.join(" "));
    utterance.lang = "ko-KR";
    utterance.rate = 0.78;
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div
      ref={ref}
      data-book-page={number}
      className="h-full overflow-hidden bg-[var(--card)] text-[var(--foreground)] shadow-sm"
    >
      {cover ? (
        children
      ) : (
        <div className="book-black-copy relative flex h-full flex-col px-10 py-6">
          <div className="flex min-h-8 items-start justify-between gap-3 border-b border-[var(--border)] pb-2 text-[12px] font-bold tracking-[0.12em]">
            <span className="text-[var(--foreground)]">{header}</span>
            {learningTools && (
              <div className="flex shrink-0 items-center gap-1.5 tracking-normal">
                <button
                  type="button"
                  onClick={speakPageKorean}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--status-success-surface)] text-[var(--status-success)] transition hover:bg-[var(--status-success-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
                  aria-label="朗读本页韩语"
                  title="朗读本页韩语"
                >
                  <Volume2 size={13} />
                </button>
                {hasTranslations && (
                  <KoreanEbookRevealButton
                    shown={showTranslations}
                    onClick={() => setShowTranslations((shown) => !shown)}
                    wording="中文"
                  />
                )}
                {hasAnswers && (
                  <KoreanEbookRevealButton
                    shown={showAnswers}
                    onClick={() => setShowAnswers((shown) => !shown)}
                    answer
                  />
                )}
              </div>
            )}
          </div>
          {sectionMeta && (
            <div
              className="absolute right-0 top-28 flex h-28 w-8 items-center justify-center rounded-l-xl text-[10px] font-bold tracking-[0.08em]"
              style={{
                backgroundColor: sectionMeta.soft,
                color: sectionMeta.color,
                writingMode: "vertical-rl",
              }}
              aria-label={`${sectionMeta.tag} ${sectionMeta.label}`}
            >
              {sectionMeta.tag}
            </div>
          )}
          <div
            ref={contentRef}
            data-page-content
            className={`min-h-0 flex-1 pt-5 ${
              hideContentOverflow ? "overflow-hidden" : ""
            } ${
              learningTools && !showTranslations
                ? "[&_[data-ebook-translation]]:pointer-events-none [&_[data-ebook-translation]]:select-none [&_[data-ebook-translation]]:opacity-0"
                : ""
            } ${
              learningTools && !showAnswers
                ? "[&_[data-ebook-answer]]:pointer-events-none [&_[data-ebook-answer]]:select-none [&_[data-ebook-answer]]:opacity-0"
                : ""
            }`}
          >
            {children}
          </div>
          <div className="mt-3 flex justify-between border-t border-[var(--border)] pt-2 text-[12px] font-bold text-[var(--foreground-muted)]">
            <span>
              {sectionMeta
                ? `韩国语 1级 · ${sectionMeta.label} · ${sectionMeta.progress}`
                : "韩国语 1级"}
            </span>
            <span>{number}</span>
          </div>
        </div>
      )}
    </div>
  );
});

export function KoreanEbookHeading({
  step,
  title,
  description,
  icon,
  action,
}: {
  step: string;
  title: string;
  description?: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div>
      <p className="sr-only">{step}</p>
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${getKoreanEbookStepToneClass(step)}`}
        >
          {icon}
        </span>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <h3 className="text-2xl font-bold leading-tight text-[var(--foreground)]">
            {title}
          </h3>
          {action}
        </div>
      </div>
      {description && (
        <p className="mt-3 text-sm leading-7 text-[var(--foreground-secondary)]">{description}</p>
      )}
    </div>
  );
}

export function KoreanEbookSectionDivider({
  step,
  title,
  goal,
  icon,
}: {
  step: string;
  title: string;
  goal: string;
  icon: React.ReactNode;
}) {
  const tone = getKoreanEbookStepTone(step);

  return (
    <div className="flex h-full flex-col justify-center px-9">
      <div className="max-w-[430px]">
        <div className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ backgroundColor: tone.soft, color: tone.color }}
          >
            {icon}
          </span>
          <p
            className="text-sm font-bold tracking-[0.16em]"
            style={{ color: tone.color }}
          >
            LEARNING SECTION
          </p>
        </div>
        <p
          className="mt-9 text-lg font-bold tracking-[0.14em]"
          style={{ color: tone.color }}
        >
          {step}
        </p>
        <h3 className="mt-3 text-4xl font-bold tracking-tight text-[var(--foreground)]">
          {title}
        </h3>
        <div
          className="mt-7 rounded-2xl px-5 py-4"
          style={{ backgroundColor: tone.soft }}
        >
          <p className="text-xs font-bold" style={{ color: tone.color }}>
            本区学习目标
          </p>
          <p className="mt-2 text-sm leading-7 text-[var(--foreground)]">{goal}</p>
        </div>
      </div>
    </div>
  );
}

export function KoreanEbookRevealButton({
  shown,
  onClick,
  answer = false,
  wording = "中文",
}: {
  shown: boolean;
  onClick: () => void;
  answer?: boolean;
  wording?: string;
}) {
  const target = answer ? "答案" : wording;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={shown}
      className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--status-success-surface)] px-3 py-1.5 text-[11px] font-bold text-[var(--status-success)] transition hover:bg-[var(--status-success-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
    >
      {shown ? `隐藏${target}` : `显示${target}`}
    </button>
  );
}

export function KoreanEbookSpeakButton({
  text,
  onSpeak,
  compact = false,
}: {
  text: string;
  onSpeak: (text: string) => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSpeak(text)}
      className={`flex shrink-0 items-center justify-center bg-[var(--status-success-surface)] text-[var(--status-success)] transition hover:bg-[var(--status-success-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 ${
        compact ? "h-5 w-5 rounded-full" : "h-8 w-8 rounded-xl"
      }`}
      aria-label={`播放 ${text}`}
    >
      <Volume2 size={compact ? 11 : 15} />
    </button>
  );
}

export function KoreanEbookVocabularyCard({
  korean,
  pronunciation,
  type,
  chinese,
  onSpeak,
  compact = false,
}: {
  korean: string;
  pronunciation?: string;
  type: string;
  chinese: string;
  onSpeak: (text: string) => void;
  compact?: boolean;
}) {
  const tone = getKoreanEbookVocabularyTone(type);
  const textColor = tone.split(" ")[1];
  const displayedPronunciation = pronunciation ?? korean;

  return (
    <button
      type="button"
      onClick={() => onSpeak(korean)}
      aria-label={`播放${korean}的读音`}
      className={`rounded-xl border border-[var(--border)] bg-white text-left transition hover:border-[var(--border)] hover:bg-[var(--status-success-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 ${
        compact ? "px-2.5 py-1.5" : "px-3 py-2.5"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4
            className={`${compact ? "text-[13px]" : "text-[15px]"} font-bold leading-5 text-[var(--foreground)]`}
          >
            {korean}
          </h4>
          {displayedPronunciation && (
            <span
              className={`block font-bold leading-4 text-[var(--foreground-secondary)] ${
                compact ? "text-[9px]" : "mt-0.5 text-[10px]"
              }`}
            >
              [{displayedPronunciation}]
            </span>
          )}
        </div>
        <span className="flex shrink-0 items-center gap-1">
          <span
            className={`flex items-center justify-center rounded-full ${
              compact ? "h-4 w-4" : "h-5 w-5"
            } ${tone}`}
          >
            <Volume2 size={compact ? 9 : 11} />
          </span>
          <span
            className={`rounded-full px-1.5 font-bold ${
              compact ? "py-px text-[8px]" : "py-0.5 text-[9px]"
            } ${tone}`}
          >
            {type}
          </span>
        </span>
      </div>
      <span
        data-vocab-meaning
        data-ebook-translation
        className={`block font-bold leading-4 ${
          compact ? "text-[10px]" : "mt-0.5 text-[11px]"
        } ${textColor}`}
      >
        {chinese}
      </span>
    </button>
  );
}

export function KoreanEbookTableOfContents({
  lessonNumber,
  entries,
  onNavigate,
  pageMeta,
}: {
  lessonNumber: number;
  entries: KoreanEbookTocEntry[];
  onNavigate: (page: number) => void;
  pageMeta: Record<string, KoreanEbookPageMeta>;
}) {
  return (
    <div className="flex h-full flex-col justify-center text-center">
      <p className="text-xs font-bold tracking-[0.18em] text-[var(--status-success)]">
        LESSON {String(lessonNumber).padStart(2, "0")}
      </p>
      <h3 className="mt-3 text-2xl font-bold tracking-tight text-[var(--foreground)]">
        目录
      </h3>
      <ol className="mt-7 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-white px-5 text-left">
        {entries.map(({ step, title, pageRange, detail }) => {
          const startPage = pageRange.slice(0, 2);
          return (
            <li key={step}>
              <button
                type="button"
                onClick={() => onNavigate(Number.parseInt(pageRange, 10))}
                className="flex w-full items-center justify-between py-3 text-left text-sm font-bold text-[var(--foreground-secondary)] transition hover:text-[var(--status-success)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
              >
                <span className="flex items-baseline gap-2">
                  <span>{step}. {title}</span>
                  {detail && (
                    <span className="text-[11px] font-bold text-[var(--foreground-secondary)]">
                      {detail}
                    </span>
                  )}
                </span>
                <span
                  className="font-bold"
                  style={{ color: pageMeta[startPage]?.color }}
                >
                  {startPage}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function KoreanEbookCover({
  lesson,
  subtitle = "基于本课交际目标独立创作的电子学习书",
}: {
  lesson: KoreanLevelOneLesson;
  subtitle?: string;
}) {
  const lessonNumber = String(lesson.number).padStart(2, "0");
  return (
    <div className="relative h-full overflow-hidden bg-[var(--status-warning-surface)] text-[var(--foreground)]">
      <div className="absolute -right-16 -top-20 h-72 w-72 rounded-full border-[38px] border-[var(--border)]" />
      <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-[var(--status-success-surface)]" />
      <div className="relative flex h-full flex-col px-14 py-12">
        <div className="flex items-center justify-between text-[11px] font-bold tracking-[0.2em] text-[var(--foreground-secondary)]">
          <span>韩国语</span>
          <span>一级</span>
        </div>
        <div className="my-auto">
          <p className="text-sm font-bold tracking-[0.28em] text-[var(--destructive)]">
            韩语1级学习和语法全解
          </p>
          <div className="mt-7 flex items-end gap-6">
            <span className="text-[76px] font-bold leading-none tracking-[-0.07em]">
              {lessonNumber}
            </span>
            <span className="mb-2 text-lg font-bold tracking-[0.2em] text-[var(--destructive)]">
              LESSON
            </span>
          </div>
          <div className="mt-9 border-t border-[var(--foreground)]/25 pt-7">
            <h3 className="text-[42px] font-bold leading-tight tracking-[-0.04em]">
              {lesson.korean}
            </h3>
            <p className="mt-4 text-xl font-bold text-[var(--foreground)]">
              {lesson.chinese}
            </p>
          </div>
        </div>
        <div className="rounded-3xl bg-[var(--foreground)] px-7 py-6 text-white">
          <p className="text-xs font-bold tracking-[0.18em] text-[var(--border)]">
            第 {lessonNumber} 课
          </p>
          <p className="mt-3 text-sm font-bold text-white/70">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
