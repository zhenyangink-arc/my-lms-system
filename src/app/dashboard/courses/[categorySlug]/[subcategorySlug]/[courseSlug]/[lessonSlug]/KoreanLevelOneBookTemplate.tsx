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
  "STEP 01": { color: "#bd741e", soft: "#fff0df" },
  "STEP 02": { color: "#3d6f9f", soft: "#eaf2fb" },
  "STEP 03": { color: "#75559a", soft: "#f1eafb" },
  "STEP 04": { color: "#b46624", soft: "#fff2df" },
  "STEP 05": { color: "#a65b68", soft: "#fbeaec" },
  "STEP 06": { color: "#3e7fa3", soft: "#eaf4fa" },
  "STEP 07": { color: "#347b69", soft: "#e7f5f1" },
  "STEP 08": { color: "#487a54", soft: "#e8f4eb" },
};

export function getKoreanEbookStepTone(step: string) {
  const normalizedStep =
    Object.keys(KOREAN_EBOOK_SECTION_TONES).find((key) => step.includes(key)) ??
    "STEP 08";
  return KOREAN_EBOOK_SECTION_TONES[normalizedStep];
}

export function getKoreanEbookStepToneClass(step: string) {
  if (step.includes("STEP 01")) return "bg-[#fff0df] text-[#bd741e]";
  if (step.includes("STEP 02")) return "bg-[#eaf2fb] text-[#3d6f9f]";
  if (step.includes("STEP 03")) return "bg-[#f1eafb] text-[#75559a]";
  if (step.includes("STEP 04")) return "bg-[#fff2df] text-[#b46624]";
  if (step.includes("STEP 05")) return "bg-[#fbeaec] text-[#a65b68]";
  if (step.includes("STEP 06")) return "bg-[#eaf4fa] text-[#3e7fa3]";
  if (step.includes("STEP 07")) return "bg-[#e7f5f1] text-[#347b69]";
  return "bg-[#e8f4eb] text-[#487a54]";
}

export function getKoreanEbookVocabularyTone(type: string) {
  if (type.includes("名词")) return "bg-[#e8f0fb] text-[#3d6f9f]";
  if (type.includes("动词")) return "bg-[#fff0df] text-[#b46624]";
  if (type.includes("代词")) return "bg-[#f1eafb] text-[#75559a]";
  if (type.includes("副词")) return "bg-[#fff6d9] text-[#a37a14]";
  if (type.includes("形容词")) return "bg-[#fcecf4] text-[#a65778]";
  if (type.includes("表达") || type.includes("回答")) {
    return "bg-[#e6f4ef] text-[#347b69]";
  }
  return "bg-[#fbeaec] text-[#a65b68]";
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
      className="h-full overflow-hidden bg-[#fffef9] text-[#294f43] shadow-[inset_0_0_28px_rgba(57,78,67,0.08)]"
    >
      {cover ? (
        children
      ) : (
        <div className="book-black-copy relative flex h-full flex-col px-10 py-6">
          <div className="flex min-h-8 items-start justify-between gap-3 border-b border-[#dce8e1] pb-2 text-[12px] font-black tracking-[0.12em]">
            <span className="text-[#303432]">{header}</span>
            {learningTools && (
              <div className="flex shrink-0 items-center gap-1.5 tracking-normal">
                <button
                  type="button"
                  onClick={speakPageKorean}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-[#cfe2d9] bg-[#f7fbf9] text-[#238777] transition hover:bg-[#e8f4ef]"
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
              className="absolute right-0 top-28 flex h-28 w-8 items-center justify-center rounded-l-xl text-[10px] font-black tracking-[0.08em]"
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
          <div className="mt-3 flex justify-between border-t border-[#e4ebe7] pt-2 text-[12px] font-bold text-[#92a099]">
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
          <h2 className="text-2xl font-black leading-tight text-[#173f4a]">
            {title}
          </h2>
          {action}
        </div>
      </div>
      {description && (
        <p className="mt-3 text-sm leading-7 text-[#60736a]">{description}</p>
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
            className="text-sm font-black tracking-[0.16em]"
            style={{ color: tone.color }}
          >
            LEARNING SECTION
          </p>
        </div>
        <p
          className="mt-9 text-lg font-black tracking-[0.14em]"
          style={{ color: tone.color }}
        >
          {step}
        </p>
        <h2 className="mt-3 text-4xl font-black tracking-tight text-[#1f2e28]">
          {title}
        </h2>
        <div
          className="mt-7 rounded-2xl px-5 py-4"
          style={{ backgroundColor: tone.soft }}
        >
          <p className="text-xs font-black" style={{ color: tone.color }}>
            本区学习目标
          </p>
          <p className="mt-2 text-sm leading-7 text-[#3f5149]">{goal}</p>
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
      className="shrink-0 rounded-full border border-[#d7e8e1] bg-[#f7fbf9] px-3 py-1.5 text-[11px] font-black text-[#347b69] transition hover:bg-[#eaf5f0]"
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
      className={`flex shrink-0 items-center justify-center bg-[#e8f4ef] text-[#238777] transition hover:bg-[#d8eee5] ${
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
      className={`rounded-xl border border-[#dce8e1] bg-white text-left transition hover:border-[#79b9aa] hover:bg-[#f5faf8] ${
        compact ? "px-2.5 py-1.5" : "px-3 py-2.5"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3
            className={`${compact ? "text-[13px]" : "text-[15px]"} font-black leading-5 text-[#173f4a]`}
          >
            {korean}
          </h3>
          {displayedPronunciation && (
            <span
              className={`block font-bold leading-4 text-[#5f7f75] ${
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
            className={`rounded-full px-1.5 font-black ${
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
      <p className="text-xs font-black tracking-[0.18em] text-[#238777]">
        LESSON {String(lessonNumber).padStart(2, "0")}
      </p>
      <h2 className="mt-3 text-2xl font-black tracking-tight text-[#173f4a]">
        目录
      </h2>
      <ol className="mt-7 divide-y divide-[#dce8e1] rounded-2xl border border-[#dce8e1] bg-white px-5 text-left">
        {entries.map(({ step, title, pageRange, detail }) => {
          const startPage = pageRange.slice(0, 2);
          return (
            <li key={step}>
              <button
                type="button"
                onClick={() => onNavigate(Number.parseInt(pageRange, 10))}
                className="flex w-full items-center justify-between py-3 text-left text-sm font-bold text-[#526c60] transition hover:text-[#238777]"
              >
                <span className="flex items-baseline gap-2">
                  <span>{step}. {title}</span>
                  {detail && (
                    <span className="text-[11px] font-bold text-[#81938a]">
                      {detail}
                    </span>
                  )}
                </span>
                <span
                  className="font-black"
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
    <div className="relative h-full overflow-hidden bg-[#f4efe4] text-[#232726]">
      <div className="absolute -right-16 -top-20 h-72 w-72 rounded-full border-[38px] border-[#e7dac6]" />
      <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-[#dcebe4]" />
      <div className="relative flex h-full flex-col px-14 py-12">
        <div className="flex items-center justify-between text-[11px] font-black tracking-[0.2em] text-[#6f746f]">
          <span>KOREAN LANGUAGE</span>
          <span>LEVEL 1</span>
        </div>
        <div className="my-auto">
          <p className="text-sm font-black tracking-[0.28em] text-[#b85f4d]">
            韩语1级学习和语法全解
          </p>
          <div className="mt-7 flex items-end gap-6">
            <span className="text-[76px] font-black leading-none tracking-[-0.07em]">
              {lessonNumber}
            </span>
            <span className="mb-2 text-lg font-black tracking-[0.2em] text-[#b85f4d]">
              LESSON
            </span>
          </div>
          <div className="mt-9 border-t border-[#232726]/25 pt-7">
            <h1 className="text-[42px] font-black leading-tight tracking-[-0.04em]">
              {lesson.korean}
            </h1>
            <p className="mt-4 text-xl font-black text-[#555b58]">
              {lesson.chinese}
            </p>
          </div>
        </div>
        <div className="rounded-3xl bg-[#424b47] px-7 py-6 text-white">
          <p className="text-xs font-black tracking-[0.18em] text-[#d8c39b]">
            第 {lessonNumber} 课
          </p>
          <p className="mt-3 text-sm font-bold text-white/70">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
