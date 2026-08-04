"use client";

import dynamic from "next/dynamic";

const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false });
import { forwardRef, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Compass,
  Headphones,
  Lightbulb,
  ListChecks,
  MessageCircle,
  Mic2,
  NotebookPen,
  Sparkles,
  Volume2,
} from "lucide-react";

import {
  buildKoreanEbookSectionMap,
  KoreanEbookCover,
  KoreanEbookHeading,
  KoreanEbookPage,
  KoreanEbookSectionDivider,
  KoreanEbookTableOfContents,
  KoreanEbookVocabularyCard,
} from "./KoreanLevelOneBookTemplate";

const BOOK_WIDTH = 1180;
const BOOK_HEIGHT = 822;

export const KOREAN_LEVEL_ONE_LESSON_PAGE_COUNT = 6;
export const KOREAN_LEVEL_ONE_LESSON_ONE_PAGE_COUNT = 32;
export const KOREAN_LEVEL_ONE_LESSON_TWO_PAGE_COUNT = 33;
export const KOREAN_LEVEL_ONE_LESSON_THREE_PAGE_COUNT = 33;
export const KOREAN_LEVEL_ONE_LESSON_FOUR_PAGE_COUNT = 32;
export const KOREAN_LEVEL_ONE_LESSON_FIVE_PAGE_COUNT = 34;
export const KOREAN_LEVEL_ONE_LESSON_SIX_PAGE_COUNT = 35;
export const KOREAN_LEVEL_ONE_LESSON_SEVEN_PAGE_COUNT = 35;
export const KOREAN_LEVEL_ONE_LESSON_EIGHT_PAGE_COUNT = 35;
export const KOREAN_LEVEL_ONE_LESSON_NINE_PAGE_COUNT = 35;
export const KOREAN_LEVEL_ONE_LESSON_TEN_PAGE_COUNT = 35;
export const KOREAN_LEVEL_ONE_LESSON_ELEVEN_PAGE_COUNT = 35;
export const KOREAN_LEVEL_ONE_LESSON_TWELVE_PAGE_COUNT = 36;
export const KOREAN_LEVEL_ONE_LESSON_THIRTEEN_PAGE_COUNT = 36;
export const KOREAN_LEVEL_ONE_LESSON_FOURTEEN_PAGE_COUNT = 36;
export const KOREAN_LEVEL_ONE_LESSON_FIFTEEN_PAGE_COUNT = 36;
export const KOREAN_LEVEL_ONE_LESSON_SIXTEEN_PAGE_COUNT = 36;

export function getKoreanLevelOneLessonPageCount(lessonNumber: number) {
  if (lessonNumber === 1) {
    return KOREAN_LEVEL_ONE_LESSON_ONE_PAGE_COUNT;
  }

  if (lessonNumber === 2) {
    return KOREAN_LEVEL_ONE_LESSON_TWO_PAGE_COUNT;
  }

  if (lessonNumber === 3) {
    return KOREAN_LEVEL_ONE_LESSON_THREE_PAGE_COUNT;
  }

  if (lessonNumber === 4) {
    return KOREAN_LEVEL_ONE_LESSON_FOUR_PAGE_COUNT;
  }

  if (lessonNumber === 5) {
    return KOREAN_LEVEL_ONE_LESSON_FIVE_PAGE_COUNT;
  }

  if (lessonNumber === 6) {
    return KOREAN_LEVEL_ONE_LESSON_SIX_PAGE_COUNT;
  }

  if (lessonNumber === 7) {
    return KOREAN_LEVEL_ONE_LESSON_SEVEN_PAGE_COUNT;
  }

  if (lessonNumber === 8) {
    return KOREAN_LEVEL_ONE_LESSON_EIGHT_PAGE_COUNT;
  }

  if (lessonNumber === 9) {
    return KOREAN_LEVEL_ONE_LESSON_NINE_PAGE_COUNT;
  }

  if (lessonNumber === 10) {
    return KOREAN_LEVEL_ONE_LESSON_TEN_PAGE_COUNT;
  }

  if (lessonNumber === 11) {
    return KOREAN_LEVEL_ONE_LESSON_ELEVEN_PAGE_COUNT;
  }

  if (lessonNumber === 12) {
    return KOREAN_LEVEL_ONE_LESSON_TWELVE_PAGE_COUNT;
  }

  if (lessonNumber === 13) {
    return KOREAN_LEVEL_ONE_LESSON_THIRTEEN_PAGE_COUNT;
  }

  if (lessonNumber === 14) {
    return KOREAN_LEVEL_ONE_LESSON_FOURTEEN_PAGE_COUNT;
  }

  if (lessonNumber === 15) {
    return KOREAN_LEVEL_ONE_LESSON_FIFTEEN_PAGE_COUNT;
  }

  if (lessonNumber === 16) {
    return KOREAN_LEVEL_ONE_LESSON_SIXTEEN_PAGE_COUNT;
  }

  return KOREAN_LEVEL_ONE_LESSON_PAGE_COUNT;
}

export type KoreanLevelOneLesson = {
  number: number;
  korean: string;
  chinese: string;
};

export const KOREAN_LEVEL_ONE_LESSONS: KoreanLevelOneLesson[] = [
  { number: 1, korean: "안녕하세요?", chinese: "你好？" },
  { number: 2, korean: "이거는 뭐예요?", chinese: "这是什么？" },
  { number: 3, korean: "한국어를 공부해요.", chinese: "我学习韩语。" },
  { number: 4, korean: "어디에 있어요?", chinese: "在哪里？" },
  { number: 5, korean: "주말에 친구를 만났어요.", chinese: "周末见了朋友。" },
  { number: 6, korean: "얼마예요?", chinese: "多少钱？" },
  { number: 7, korean: "날씨가 어때요?", chinese: "天气怎么样？" },
  { number: 8, korean: "영화 볼까요?", chinese: "去看电影好吗？" },
  { number: 9, korean: "이분은 누구세요?", chinese: "这位是谁？" },
  { number: 10, korean: "지금 몇 시예요?", chinese: "现在几点？" },
  { number: 11, korean: "감기에 걸렸어요.", chinese: "感冒了。" },
  { number: 12, korean: "여보세요.", chinese: "喂。" },
  { number: 13, korean: "서울역으로 가 주세요.", chinese: "请带我去首尔站。" },
  { number: 14, korean: "이 옷을 입어 보세요.", chinese: "请试穿这件衣服。" },
  { number: 15, korean: "여행을 가고 싶어요.", chinese: "我想去旅行。" },
  { number: 16, korean: "우리 집에 올 수 있어요?", chinese: "你能来我家吗？" },
];

const LESSON_ONE_TEMPLATE = buildKoreanEbookSectionMap([
  { step: "STEP 01", label: "课前导航", dividerPage: 2, contentPages: [3] },
  { step: "STEP 02", label: "核心词汇表", dividerPage: 4, contentPages: [5, 6, 7] },
  { step: "STEP 03", label: "语法解说", dividerPage: 8, contentPages: [9, 10, 11] },
  { step: "STEP 04", label: "句型操练", dividerPage: 12, contentPages: [13, 14, 15] },
  { step: "STEP 05", label: "实战对话", dividerPage: 16, contentPages: [17, 18, 19, 20] },
  { step: "STEP 06", label: "听说任务", dividerPage: 21, contentPages: [22, 23, 24] },
  { step: "STEP 07", label: "读写拓展", dividerPage: 25, contentPages: [26, 27] },
  { step: "STEP 08", label: "自测与复盘", dividerPage: 28, contentPages: [29, 30] },
]);

type PageProps = {
  children?: React.ReactNode;
  lesson: KoreanLevelOneLesson;
  number: string;
  cover?: boolean;
};

type FlipBookHandle = {
  pageFlip: () =>
    | {
        flip: (page: number) => void;
        flipNext: () => void;
        flipPrev: () => void;
      }
    | undefined;
};

const Page = forwardRef<HTMLDivElement, PageProps>(function Page(
  { children, lesson, number, cover = false },
  ref
) {
  const lessonNumber = String(lesson.number).padStart(2, "0");
  const sectionMeta =
    lesson.number === 1 ? LESSON_ONE_TEMPLATE.pageMeta[number] : undefined;
  const pageHeader =
    lesson.number === 1 && LESSON_ONE_TEMPLATE.headers[number]
      ? LESSON_ONE_TEMPLATE.headers[number]
      : `第${lessonNumber}课 · ${lesson.korean}`;

  return (
    <KoreanEbookPage
      ref={ref}
      number={number}
      header={pageHeader}
      cover={cover}
      sectionMeta={sectionMeta}
    >
      {children}
    </KoreanEbookPage>
  );
});

function LessonHeading({
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
    <KoreanEbookHeading
      step={step}
      title={title}
      description={description}
      icon={icon}
      action={action}
    />
  );
}

function SectionDivider({
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
  return (
    <KoreanEbookSectionDivider
      step={step}
      title={title}
      goal={goal}
      icon={icon}
    />
  );
}

function VocabCard({
  korean,
  pronunciation,
  type,
  chinese,
  onSpeak,
  compact = false,
}: {
  korean: string;
  pronunciation: string;
  type: string;
  chinese: string;
  onSpeak: (text: string) => void;
  compact?: boolean;
}) {
  return (
    <KoreanEbookVocabularyCard
      korean={korean}
      pronunciation={pronunciation}
      type={type}
      chinese={chinese}
      onSpeak={onSpeak}
      compact={compact}
    />
  );
}

function SentenceSpeakButton({
  text,
  onSpeak,
  color,
  compact = false,
}: {
  text: string;
  onSpeak: (text: string) => void;
  color: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSpeak(text)}
      aria-label={`播放例句：${text}`}
      className={`shrink-0 items-center justify-center rounded-full border border-[#dce8e1] bg-white transition hover:bg-[#f5faf8] ${compact ? "flex h-5 w-5" : "flex h-6 w-6"}`}
    >
      <Volume2 size={compact ? 10 : 12} style={{ color }} />
    </button>
  );
}

const DIALOGUE_SLOT_TERMS = /^(유나|지수|다니엘|하린|민우|소라|수빈|학생|회사원|선생님)$/;

function MaskedDialogueLine({ text }: { text: string }) {
  return (
    <>
      {text.split(/(유나|지수|다니엘|하린|민우|소라|수빈|학생|회사원|선생님)/g).map((part, index) =>
        DIALOGUE_SLOT_TERMS.test(part) ? (
          <span key={index} className="mx-0.5 inline-block min-w-9 border-b border-dashed border-[#94aca1] align-baseline text-transparent select-none">ㅤ</span>
        ) : (
          part
        )
      )}
    </>
  );
}

export function KoreanLevelOneLessonBook({
  lesson,
  isFullscreen,
  initialPage = 0,
  onPageChange,
  speechRate = 0.78,
}: {
  lesson: KoreanLevelOneLesson;
  isFullscreen: boolean;
  initialPage?: number;
  onPageChange?: (page: number) => void;
  speechRate?: number;
}) {
  const containerRef = useRef<HTMLElement>(null);
  const flipBookRef = useRef<FlipBookHandle>(null);
  const [scale, setScale] = useState(0.7);
  const [showThirdPageMeanings, setShowThirdPageMeanings] = useState(false);
  const [showFourthPageMeanings, setShowFourthPageMeanings] = useState(false);
  const [showFifthPageMeanings, setShowFifthPageMeanings] = useState(false);
  const [showSixthPageMeanings, setShowSixthPageMeanings] = useState(false);
  const [showSeventhPageMeanings, setShowSeventhPageMeanings] = useState(false);
  const [showEighthPageMeanings, setShowEighthPageMeanings] = useState(false);
  const [showNinthPageAnswers, setShowNinthPageAnswers] = useState(false);
  const [showTenthPageAnswers, setShowTenthPageAnswers] = useState(false);
  const [showEleventhPageAnswers, setShowEleventhPageAnswers] = useState(false);
  const [showTwelfthPageMeanings, setShowTwelfthPageMeanings] = useState(false);
  const [showThirteenthPageMeanings, setShowThirteenthPageMeanings] = useState(false);
  const [showFourteenthPageMeanings, setShowFourteenthPageMeanings] = useState(false);
  const [showFifteenthPageMeanings, setShowFifteenthPageMeanings] = useState(false);
  const [showSixteenthPageAnswers, setShowSixteenthPageAnswers] = useState(false);
  const [showSeventeenthPageAnswers, setShowSeventeenthPageAnswers] = useState(false);
  const [showTwentiethPageSample, setShowTwentiethPageSample] = useState(false);
  const [showTwentyNinthPageAnswers, setShowTwentyNinthPageAnswers] = useState(false);
  const lessonNumber = String(lesson.number).padStart(2, "0");

  function speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = speechRate;
    window.speechSynthesis.speak(utterance);
  }

  useEffect(() => {
    const resize = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setScale(
        Math.min(
          (rect.width - 34) / BOOK_WIDTH,
          (rect.height - 28) / BOOK_HEIGHT,
          isFullscreen ? 1 : 0.86
        )
      );
    };

    resize();
    const observer = new ResizeObserver(resize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isFullscreen]);

  const lessonOnePages =
    lesson.number === 1
      ? [
          <Page key="lesson-1-01" lesson={lesson} number="01">
            <KoreanEbookTableOfContents
              lessonNumber={1}
              pageMeta={LESSON_ONE_TEMPLATE.pageMeta}
              onNavigate={(page) => flipBookRef.current?.pageFlip()?.flip(page)}
              entries={[
                { step: "01", title: "课前导航", pageRange: "02—03" },
                { step: "02", title: "核心词汇表", pageRange: "04—07" },
                {
                  step: "03",
                  title: "语法解说",
                  pageRange: "08—11",
                  detail: "N이에요／예요、N은／는、确认疑问句",
                },
                { step: "04", title: "句型操练", pageRange: "12—15" },
                { step: "05", title: "实战对话", pageRange: "16—20" },
                { step: "06", title: "听说任务", pageRange: "21—24" },
                { step: "07", title: "读写拓展", pageRange: "25—27" },
                { step: "08", title: "自测与复盘", pageRange: "28—30" },
              ]}
            />
          </Page>,
          <Page key="lesson-1-02-divider" lesson={lesson} number="02">
            <SectionDivider
              step="STEP 01"
              title="课前导航"
              goal="先知道本课学什么、会在哪些场景使用，以及完成学习后能够做什么。"
              icon={<Compass size={24} />}
            />
          </Page>,
          <Page key="lesson-1-03" lesson={lesson} number="03">
            <div className="flex h-full flex-col">
              <LessonHeading
                step="STEP 01 · 课前导航"
                title="1. 这一课，我们先学会打招呼"
                description="从一句“你好”开始，在第一次见面时完成问候、介绍自己和简单回应。"
                icon={<Compass size={22} />}
              />
              <section className="mt-5 grid grid-cols-[1.15fr_0.85fr] overflow-hidden rounded-2xl border border-[#d7e8e1] bg-[#f2f8f5]">
                <div className="px-5 py-4">
                  <p className="text-[11px] font-black tracking-[0.12em] text-[#4d907f]">
                    本课交际任务
                  </p>
                  <h3 className="mt-1.5 text-base font-black text-[#294f43]">
                    和第一次见面的同学互相认识
                  </h3>
                  <p className="mt-2 text-[11px] leading-5 text-[#71857b]">
                    场景：韩语体验课开始前，你和旁边的同学第一次见面。
                  </p>
                </div>
                <div className="flex flex-col justify-center border-l border-[#e5dccf] bg-[#fff8ee] px-5 py-4">
                  <p className="text-[11px] font-bold text-[#a17b50]">完成标准</p>
                  <p className="mt-1.5 text-xs font-black leading-5 text-[#765c49]">
                    不看提示，完成一段20秒的两人交流。
                  </p>
                </div>
              </section>

              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  ["01", "听得懂", "听出对方是在问候，还是在确认姓名或身份。"],
                  ["02", "说得出", "说“你好”，再用一句话介绍自己的名字和身份。"],
                  ["03", "接得上", "用“是／不是”回应，并礼貌结束这次认识。"],
                ].map(([number, title, text]) => (
                  <article key={number} className="rounded-2xl border border-[#dce8e1] bg-white p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-[#b87131]">{number}</span>
                      <h3 className="text-sm font-black text-[#294f43]">{title}</h3>
                    </div>
                    <p className="mt-2 text-[11px] leading-5 text-[#71857b]">{text}</p>
                  </article>
                ))}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4">
                <section className="rounded-2xl bg-[#e7f4ef] p-5">
                  <p className="text-xs font-black text-[#238777]">本课要学的语法</p>
                  <div className="mt-3 space-y-2 text-xs leading-5 text-[#45675d]">
                    <p><strong className="text-[#173f4a]">N은／는</strong>　提出“我／某个人”这个话题</p>
                    <p><strong className="text-[#173f4a]">N이에요／예요</strong>　说明姓名或身份</p>
                    <p><strong className="text-[#173f4a]">句末升调 ↗</strong>　把说明变成确认问题</p>
                  </div>
                  <div className="mt-3 border-t border-[#cfe5db] pt-3 text-[11px] leading-5">
                    <span className="font-black text-[#347b69]">发音小提示：</span>
                    <span>韩语里相邻音节有时会自然连在一起。现在不必记规则，先整体听、整体跟读；以后会学到“连音”。</span>
                  </div>
                </section>
                <section className="rounded-2xl bg-[#fff3e3] p-5">
                  <p className="text-xs font-black text-[#b87131]">本课对话路线</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-black text-[#765c49]">
                    <span className="rounded-full bg-white px-3 py-2">问好</span>
                    <span>→</span>
                    <span className="rounded-full bg-white px-3 py-2">说名字</span>
                    <span>→</span>
                    <span className="rounded-full bg-white px-3 py-2">说身份</span>
                    <span>→</span>
                    <span className="rounded-full bg-white px-3 py-2">回应</span>
                  </div>
                </section>
              </div>
              <p className="mt-auto text-center text-[11px] font-bold text-[#83948b]">
                零基础提示：先听整句、跟着说，再理解语法；这一课不要求一次记住所有单词。
              </p>
            </div>
          </Page>,
          <Page key="lesson-1-04-divider" lesson={lesson} number="04">
            <SectionDivider
              step="STEP 02"
              title="核心词汇表"
              goal="认识完成问候、自我介绍与礼貌回应所需的基础词和完整表达。"
              icon={<ListChecks size={24} />}
            />
          </Page>,
          <Page key="lesson-1-05" lesson={lesson} number="05">
            <div className="flex h-full flex-col">
              <LessonHeading
                step="STEP 02 · 核心词汇表"
                title="1. 先认识本课最基础的词"
                description="从人物、场所和简单动作入手，为后面的自我介绍与对话做准备。"
                icon={<Sparkles size={22} />}
                action={
                  <button
                    type="button"
                    onClick={() => setShowThirdPageMeanings((show) => !show)}
                    className="shrink-0 rounded-full border border-[#d7e8e1] bg-[#f7fbf9] px-3 py-1.5 text-[11px] font-black text-[#347b69] transition hover:bg-[#eaf5f0]"
                  >
                    {showThirdPageMeanings ? "隐藏中文释义" : "显示中文释义"}
                  </button>
                }
              />
              <div className={`mt-5 grid grid-cols-3 gap-2 ${showThirdPageMeanings ? "" : "[&_[data-vocab-meaning]]:opacity-0"}`}>
                <VocabCard korean="저" pronunciation="저" onSpeak={speak} type="代词" chinese="我（礼貌说法）" />
                <VocabCard korean="이름" pronunciation="이름" onSpeak={speak} type="名词" chinese="名字" />
                <VocabCard korean="학생" pronunciation="학쌩" onSpeak={speak} type="名词" chinese="学生" />
                <VocabCard korean="선생님" pronunciation="선생님" onSpeak={speak} type="名词" chinese="老师" />
                <VocabCard korean="친구" pronunciation="친구" onSpeak={speak} type="名词" chinese="朋友" />
                <VocabCard korean="사람" pronunciation="사람" onSpeak={speak} type="名词" chinese="人" />
                <VocabCard korean="만나다" pronunciation="만나다" onSpeak={speak} type="动词" chinese="见面、遇见" />
                <VocabCard korean="인사하다" pronunciation="인사하다" onSpeak={speak} type="动词" chinese="问候、打招呼" />
                <VocabCard korean="말하다" pronunciation="말하다" onSpeak={speak} type="动词" chinese="说、讲话" />
                <VocabCard korean="배우다" pronunciation="배우다" onSpeak={speak} type="动词" chinese="学习（某种技能）" />
                <VocabCard korean="소개하다" pronunciation="소개하다" onSpeak={speak} type="动词" chinese="介绍" />
                <VocabCard korean="묻다" pronunciation="묻따" onSpeak={speak} type="动词" chinese="询问" />
                <VocabCard korean="듣다" pronunciation="듣따" onSpeak={speak} type="动词" chinese="听" />
                <VocabCard korean="한국어" pronunciation="한구거" onSpeak={speak} type="名词" chinese="韩语、韩国语" />
                <VocabCard korean="처음" pronunciation="처음" onSpeak={speak} type="名词" chinese="最初、第一次" />
                <VocabCard korean="같이" pronunciation="가치" onSpeak={speak} type="副词" chinese="一起、共同" />
                <VocabCard korean="학교" pronunciation="학꾜" onSpeak={speak} type="名词" chinese="学校" />
                <VocabCard korean="교실" pronunciation="교실" onSpeak={speak} type="名词" chinese="教室" />
              </div>
              <div className="mt-auto rounded-2xl bg-[#e5f3ee] px-5 py-4 text-xs leading-6 text-[#315f52]">
                记忆方法：先把人物词和动作词配对听读，如“朋友—见面”“学生—学习”；先记住意思，不急着造句。
              </div>
            </div>
          </Page>,
          <Page key="lesson-1-06" lesson={lesson} number="06">
            <div className="flex h-full flex-col">
              <LessonHeading
                step="STEP 02 · 核心词汇表"
                title="2. 问候、回应与礼貌表达"
                description="先积累初次见面时常用的完整表达；知道使用时机即可，不急着逐字分析。"
                icon={<MessageCircle size={22} />}
                action={
                  <button
                    type="button"
                    onClick={() => setShowFourthPageMeanings((show) => !show)}
                    className="shrink-0 rounded-full border border-[#d7e8e1] bg-[#f7fbf9] px-3 py-1.5 text-[11px] font-black text-[#347b69] transition hover:bg-[#eaf5f0]"
                  >
                    {showFourthPageMeanings ? "隐藏中文释义" : "显示中文释义"}
                  </button>
                }
              />
              <div className={`mt-4 ${showFourthPageMeanings ? "" : "[&_[data-vocab-meaning]]:opacity-0"}`}>
                <div className="flex items-center gap-2 text-[11px] font-black text-[#4f6f89]">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#eaf2fb] text-[9px]">01</span>
                  <span>初次见面</span>
                  <span className="h-px flex-1 bg-[#dce5ec]" />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <VocabCard compact korean="안녕하세요?" pronunciation="안녕하세요" onSpeak={speak} type="固定表达" chinese="您好／你好？" />
                  <VocabCard compact korean="네" pronunciation="네" onSpeak={speak} type="副词" chinese="是、好的" />
                  <VocabCard compact korean="아니요" pronunciation="아니요" onSpeak={speak} type="副词" chinese="不是、不" />
                  <VocabCard compact korean="반가워요" pronunciation="반가워요" onSpeak={speak} type="形容词" chinese="很高兴认识你" />
                  <VocabCard compact korean="처음" pronunciation="처음" onSpeak={speak} type="名词·副词" chinese="第一次、初次" />
                  <VocabCard compact korean="이름이 뭐예요?" pronunciation="이르미 뭐예요" onSpeak={speak} type="固定表达" chinese="叫什么名字？" />
                </div>

                <div className="mt-5 flex items-center gap-2 text-[11px] font-black text-[#9a644d]">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#fbeaec] text-[9px]">02</span>
                  <span>礼貌互动与告别</span>
                  <span className="h-px flex-1 bg-[#ecdde0]" />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <VocabCard compact korean="감사합니다" pronunciation="감사함니다" onSpeak={speak} type="固定表达" chinese="谢谢" />
                  <VocabCard compact korean="죄송합니다" pronunciation="죄송함니다" onSpeak={speak} type="固定表达" chinese="对不起" />
                  <VocabCard compact korean="괜찮아요" pronunciation="괜차나요" onSpeak={speak} type="形容词" chinese="没关系、没问题" />
                  <VocabCard compact korean="안녕히 가세요" pronunciation="안녕히 가세요" onSpeak={speak} type="固定表达" chinese="请慢走、再见" />
                  <VocabCard compact korean="안녕히 계세요" pronunciation="안녕히 계세요" onSpeak={speak} type="固定表达" chinese="请留步、再见" />
                  <VocabCard compact korean="실례합니다" pronunciation="실례함니다" onSpeak={speak} type="固定表达" chinese="劳驾、打扰一下" />
                </div>
              </div>
              <div className="mt-5 rounded-xl border border-[#ead3a7] bg-[#fff7e8] px-4 py-2">
                <p className="text-[10px] leading-4 text-[#806344]">
                  <span className="mr-1 font-black text-[#b87131]">搭配提示：</span>
                  “감사합니다／죄송합니다”用于互动回应；告别时根据谁离开选择“가세요”或“계세요”。
                </p>
              </div>
            </div>
          </Page>,
          <Page key="lesson-1-07" lesson={lesson} number="07">
            <div className="flex h-full flex-col">
              <LessonHeading
                step="STEP 02 · 核心词汇表"
                title="3. 先听单词，再猜短句"
                description="单词先辨音，短句先猜意；需要时再显示中文核对答案。"
                icon={<Lightbulb size={22} />}
                action={
                  <button
                    type="button"
                    onClick={() => setShowFifthPageMeanings((show) => !show)}
                    className="shrink-0 rounded-full border border-[#d7e8e1] bg-[#f7fbf9] px-3 py-1.5 text-[11px] font-black text-[#347b69] transition hover:bg-[#eaf5f0]"
                  >
                    {showFifthPageMeanings ? "隐藏中文释义" : "显示中文释义"}
                  </button>
                }
              />
              <div className="mt-5 grid grid-cols-3 gap-2">
                {[
                  ["01", "点喇叭", "先只听声音"],
                  ["02", "猜意思", "判断使用场景"],
                  ["03", "再核对", "显示中文答案"],
                ].map(([number, title, detail]) => (
                  <div key={number} className="rounded-xl bg-[#f4f7f5] px-3 py-3 text-center">
                    <p className="text-[13px] font-black leading-5">
                      <span className="mr-1 text-[#3e7fa3]">{number}</span>
                      {title}
                    </p>
                    <p className="mt-1 text-[11px] leading-4 text-[#7b8882]">{detail}</p>
                  </div>
                ))}
              </div>

              <div className={`mt-4 grid grid-cols-2 gap-4 ${showFifthPageMeanings ? "" : "[&_[data-vocab-meaning]]:opacity-0"}`}>
                <section className="rounded-2xl border border-[#d7e5ed] bg-[#f8fbfd] p-4">
                  <div className="flex items-center justify-between border-b border-[#dfe9ef] pb-2">
                    <span className="text-xs font-black text-[#3e7fa3]">01 · 听单词</span>
                    <span className="text-[9px] text-[#7b8e98]">听清声音，再猜意思</span>
                  </div>
                  <div className="mt-2 divide-y divide-[#e5edf1]">
                    {[
                      ["네", "네", "是、好的"],
                      ["아니요", "아니요", "不是、不"],
                      ["처음", "처음", "第一次、初次"],
                      ["이름", "이름", "名字"],
                    ].map(([korean, pronunciation, chinese]) => (
                      <div key={korean} className="flex items-center justify-between py-2">
                        <div>
                          <p className="text-xs font-black">{korean}</p>
                          <span className="text-[9px] font-bold text-[#668394]">[{pronunciation}]</span>
                          <span data-vocab-meaning className="ml-2 text-[9px] font-black text-[#3e7fa3]">{chinese}</span>
                        </div>
                        <SentenceSpeakButton text={korean} onSpeak={speak} color="#3e7fa3" />
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-[#e5dceb] bg-[#fbf9fc] p-4">
                  <div className="flex items-center justify-between border-b border-[#e9e2ed] pb-2">
                    <span className="text-xs font-black text-[#75559a]">02 · 猜短句</span>
                    <span className="text-[9px] text-[#8c8093]">听完再显示中文</span>
                  </div>
                  <div className="mt-2 space-y-2">
                    {[
                      ["안녕하세요?", "您好／你好？"],
                      ["이름이 뭐예요?", "叫什么名字？"],
                      ["만나서 반가워요.", "很高兴认识你。"],
                    ].map(([korean, chinese], index) => (
                      <div key={korean} className="rounded-xl bg-white px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] font-black text-[#a38bb6]">0{index + 1}</span>
                          <p className="min-w-0 flex-1 text-xs font-black">{korean}</p>
                          <SentenceSpeakButton text={korean} onSpeak={speak} color="#75559a" />
                        </div>
                        <span data-vocab-meaning className="mt-1 block pl-6 text-[9px] font-black text-[#75559a]">{chinese}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#eef7f3] px-5 py-3 text-[10px] font-black">
                <span className="text-[#347b69]">初次见面声音路线</span>
                <span className="rounded-full bg-white px-3 py-1.5">안녕하세요?</span>
                <span className="text-[#9eaaa4]">→</span>
                <span className="rounded-full bg-white px-3 py-1.5">안녕하세요.</span>
                <span className="text-[#9eaaa4]">→</span>
                <span className="rounded-full bg-white px-3 py-1.5">만나서 반가워요.</span>
              </div>
              <section className="mt-4 rounded-2xl border border-[#e2dcec] bg-[#f8f5fb] px-5 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#75559a]">60秒跟读任务</span>
                  <span className="text-[10px] font-bold text-[#887c92]">完成标准：听懂3个词，并说出2个短句。</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] font-bold">
                  <span>□ 只听一遍</span><span>→</span><span>□ 跟读两遍</span><span>→</span><span>□ 隐藏中文再说一遍</span>
                </div>
              </section>
            </div>
          </Page>,
          <Page key="lesson-1-08-divider" lesson={lesson} number="08">
            <SectionDivider
              step="STEP 03"
              title="语法解说"
              goal="理解“是……”和主题助词的基本用法，并学会用语调完成确认提问。"
              icon={<Lightbulb size={24} />}
            />
          </Page>,
          <Page key="lesson-1-09" lesson={lesson} number="09">
            <div className="flex h-full flex-col">
              <LessonHeading
                step="STEP 03 · 语法解说"
                title="1. N이에요／예요：“是..”"
                description="名词后加이에요／예요，相当于中文里的“是……”。它直接接在名词后面，用于解释、说明或确认人或事物的身份、属性。"
                icon={<ListChecks size={22} />}
                action={
                  <button
                    type="button"
                    onClick={() => setShowSixthPageMeanings((show) => !show)}
                    className="shrink-0 rounded-full border border-[#d7e8e1] bg-[#f7fbf9] px-3 py-1.5 text-[11px] font-black text-[#347b69] transition hover:bg-[#eaf5f0]"
                  >
                    {showSixthPageMeanings ? "隐藏中文释义" : "显示中文释义"}
                  </button>
                }
              />
              <div className="mt-5 flex items-center justify-center gap-3 rounded-2xl bg-[#f5f7f5] px-5 py-2 text-xs font-bold">
                <span>先看名词最后一个音节</span>
                <span className="text-[#a7afa9]">→</span>
                <span className="rounded-full bg-[#fff0df] px-3 py-1 text-[#a86020]">无收音</span>
                <span className="text-[#a7afa9]">／</span>
                <span className="rounded-full bg-[#eaf3f9] px-3 py-1 text-[#35688f]">有收音</span>
              </div>

              <div className="mt-3 space-y-3">
                <article className="grid grid-cols-[104px_1fr] overflow-hidden rounded-2xl border border-[#ecd9c4] bg-white">
                  <div className="flex flex-col items-center justify-center bg-[#fff3e4] px-3 py-3 text-center">
                    <span className="text-[10px] font-black tracking-[0.12em] text-[#a86020]">无收音</span>
                    <strong className="mt-1 text-xl font-black text-[#a86020]">예요</strong>
                  </div>
                  <div className="px-5 py-3">
                    <div className="flex items-center justify-between border-b border-[#eee8df] pb-2">
                      <p className="text-sm font-black">名词 + <span className="text-[#a86020]">예요</span></p>
                      <span className="text-[11px] font-bold text-[#8c8174]">민지 + 예요 → 민지예요</span>
                    </div>
                    <div className={`divide-y divide-[#f0ede8] text-[12px] leading-5 ${showSixthPageMeanings ? "" : "[&_[data-grammar-meaning]]:opacity-0"}`}>
                      <p className="grid grid-cols-[1fr_112px] items-center py-1.5"><span className="flex items-center gap-1">저는 민지<span className="font-black text-[#a86020]">예요</span>.<SentenceSpeakButton text="저는 민지예요." onSpeak={speak} color="#a86020" /></span><span data-grammar-meaning className="text-[#707973] transition-opacity">我是敏智。</span></p>
                      <p className="grid grid-cols-[1fr_112px] items-center py-1.5"><span className="flex items-center gap-1">유키는 친구<span className="font-black text-[#a86020]">예요</span>.<SentenceSpeakButton text="유키는 친구예요." onSpeak={speak} color="#a86020" /></span><span data-grammar-meaning className="text-[#707973] transition-opacity">优纪是朋友。</span></p>
                      <p className="grid grid-cols-[1fr_112px] items-center py-1.5"><span className="flex items-center gap-1">이 사람은 지수<span className="font-black text-[#a86020]">예요</span>.<SentenceSpeakButton text="이 사람은 지수예요." onSpeak={speak} color="#a86020" /></span><span data-grammar-meaning className="text-[#707973] transition-opacity">这个人是智秀。</span></p>
                    </div>
                  </div>
                </article>

                <article className="grid grid-cols-[104px_1fr] overflow-hidden rounded-2xl border border-[#cfdfeb] bg-white">
                  <div className="flex flex-col items-center justify-center bg-[#edf5fa] px-3 py-3 text-center">
                    <span className="text-[10px] font-black tracking-[0.12em] text-[#35688f]">有收音</span>
                    <strong className="mt-1 text-xl font-black text-[#35688f]">이에요</strong>
                  </div>
                  <div className="px-5 py-3">
                    <div className="flex items-center justify-between border-b border-[#e3e9ed] pb-2">
                      <p className="text-sm font-black">名词 + <span className="text-[#35688f]">이에요</span></p>
                      <span className="text-[11px] font-bold text-[#74828c]">학생 + 이에요 → 학생이에요</span>
                    </div>
                    <div className={`divide-y divide-[#edf0f2] text-[12px] leading-5 ${showSixthPageMeanings ? "" : "[&_[data-grammar-meaning]]:opacity-0"}`}>
                      <p className="grid grid-cols-[1fr_112px] items-center py-1.5"><span className="flex items-center gap-1">저는 학생<span className="font-black text-[#35688f]">이에요</span>.<SentenceSpeakButton text="저는 학생이에요." onSpeak={speak} color="#35688f" /></span><span data-grammar-meaning className="text-[#707973] transition-opacity">我是学生。</span></p>
                      <p className="grid grid-cols-[1fr_112px] items-center py-1.5"><span className="flex items-center gap-1">수빈은 선생님<span className="font-black text-[#35688f]">이에요</span>.<SentenceSpeakButton text="수빈은 선생님이에요." onSpeak={speak} color="#35688f" /></span><span data-grammar-meaning className="text-[#707973] transition-opacity">秀彬是老师。</span></p>
                      <p className="grid grid-cols-[1fr_112px] items-center py-1.5"><span className="flex items-center gap-1">이름은 민준<span className="font-black text-[#35688f]">이에요</span>.<SentenceSpeakButton text="이름은 민준이에요." onSpeak={speak} color="#35688f" /></span><span data-grammar-meaning className="text-[#707973] transition-opacity">名字是敏俊。</span></p>
                    </div>
                  </div>
                </article>
              </div>
              <section className="mt-3 rounded-2xl border border-[#f0d6d0] bg-[#fff7f5] px-5 py-3">
                <span className="block text-xs font-black text-[#b85f4d]">错误示范</span>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[
                    ["먹다예요", "먹다：吃"],
                    ["공부하다예요", "공부하다：学习"],
                    ["만나다예요", "만나다：见面"],
                  ].map(([wrong, meaning]) => (
                    <div key={wrong} className="rounded-lg border border-[#f1d9d4] bg-white px-3 py-1.5">
                      <span className="block text-[11px] font-black text-[#b85f4d] line-through">{wrong}</span>
                      <span className="mt-0.5 block text-[10px] text-[#7e7774]">{meaning}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] leading-4 text-[#6f746f]">💡 它们都是动词，不能直接接이에요／예요。</p>
                <p className="mt-2 text-[11px] leading-4 text-[#6f746f]">💡 书写时，名词和“이에요/예요”之间不能有空格，必须紧挨着连写。</p>
              </section>
            </div>
          </Page>,
          <Page key="lesson-1-10" lesson={lesson} number="10">
            <div className="flex h-full flex-col">
              <LessonHeading
                step="STEP 03 · 语法解说"
                title="2. N은／는：主题助词"
                description="은／는接在名词后，把谈话主题提到前面。作用：确立整个句子要论述的中心对象。听者一听到“은/는”，就知道接下来的内容都是围绕这个词展开的。"
                icon={<ListChecks size={22} />}
                action={
                  <button
                    type="button"
                    onClick={() => setShowSeventhPageMeanings((show) => !show)}
                    className="shrink-0 rounded-full border border-[#d7e8e1] bg-[#f7fbf9] px-3 py-1.5 text-[11px] font-black text-[#347b69] transition hover:bg-[#eaf5f0]"
                  >
                    {showSeventhPageMeanings ? "隐藏中文释义" : "显示中文释义"}
                  </button>
                }
              />
              <section className="mt-4 grid grid-cols-[68px_1fr] items-center rounded-2xl border border-[#dde5e1] bg-[#f6f8f7] px-4 py-3">
                <span className="text-xs font-black tracking-[0.1em] text-[#6f5a8f]">是什么</span>
                <div className="border-l border-[#d9e1dd] pl-4">
                  <p className="text-[13px] font-black">主题助词：接在名词后，先指出这句话“说的是谁／什么”</p>
                  <p className="mt-1 text-xs leading-5 text-[#707973]">例如 저는 = “至于我”；后面再接对我的说明。</p>
                </div>
              </section>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <article className="overflow-hidden rounded-2xl border border-[#ddd3eb] bg-white">
                  <div className="flex items-center justify-between bg-[#f4effa] px-4 py-2">
                    <span className="text-[11px] font-black text-[#725693]">有收音</span>
                    <strong className="text-lg font-black text-[#725693]">은</strong>
                  </div>
                  <div className="px-4 py-3 text-xs">
                    <p><span className="font-black">민준</span> + <span className="font-black text-[#725693]">은</span> → 민준<span className="font-black text-[#725693]">은</span></p>
                    <div className="mt-2 space-y-1 text-xs text-[#707973]">
                      <p className="flex items-center justify-between gap-2"><span>① 민준<span className="font-black text-[#725693]">은</span> 학생이에요.</span><SentenceSpeakButton compact text="민준은 학생이에요." onSpeak={speak} color="#725693" /></p>
                      <p className="flex items-center justify-between gap-2"><span>② 수빈<span className="font-black text-[#725693]">은</span> 선생님이에요.</span><SentenceSpeakButton compact text="수빈은 선생님이에요." onSpeak={speak} color="#725693" /></p>
                    </div>
                  </div>
                </article>
                <article className="overflow-hidden rounded-2xl border border-[#cfe3dc] bg-white">
                  <div className="flex items-center justify-between bg-[#edf7f3] px-4 py-2">
                    <span className="text-[11px] font-black text-[#347b69]">无收音</span>
                    <strong className="text-lg font-black text-[#347b69]">는</strong>
                  </div>
                  <div className="px-4 py-3 text-xs">
                    <p><span className="font-black">민지</span> + <span className="font-black text-[#347b69]">는</span> → 민지<span className="font-black text-[#347b69]">는</span></p>
                    <div className="mt-2 space-y-1 text-xs text-[#707973]">
                      <p className="flex items-center justify-between gap-2"><span>① 민지<span className="font-black text-[#347b69]">는</span> 학생이에요.</span><SentenceSpeakButton compact text="민지는 학생이에요." onSpeak={speak} color="#347b69" /></p>
                      <p className="flex items-center justify-between gap-2"><span>② 유키<span className="font-black text-[#347b69]">는</span> 친구예요.</span><SentenceSpeakButton compact text="유키는 친구예요." onSpeak={speak} color="#347b69" /></p>
                    </div>
                  </div>
                </article>
              </div>

              <section className="mt-3 mb-2 rounded-2xl border border-[#dce8e1] bg-white px-5 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black tracking-[0.1em] text-[#56665f]">把一句话搭起来</span>
                  <span className="text-[11px] text-[#88928d]">主题 + 说明</span>
                </div>
                <div className="mt-2.5 flex items-center justify-center gap-2 text-xs font-black">
                  <span className="rounded-lg bg-[#edf7f3] px-3 py-1.5">저<span className="text-[#347b69]">는</span></span>
                  <span className="text-[#aab1ad]">+</span>
                  <span className="rounded-lg bg-[#eef5fa] px-3 py-1.5">학생<span className="text-[#35688f]">이에요</span></span>
                  <span className="text-[#aab1ad]">→</span>
                  <span className="flex items-center gap-1 text-sm">저<span className="text-[#347b69]">는</span> 학생<span className="text-[#35688f]">이에요</span>.<SentenceSpeakButton compact text="저는 학생이에요." onSpeak={speak} color="#35688f" /></span>
                </div>
                <div className={`mt-3 grid grid-cols-2 gap-2 border-t border-[#e8edea] pt-3 text-xs leading-5 ${showSeventhPageMeanings ? "" : "[&_[data-sentence-meaning]]:opacity-0"}`}>
                  <div className="flex items-start justify-between gap-2 rounded-lg bg-[#fafbf9] px-3 py-2"><div><p>저<span className="font-black text-[#347b69]">는</span> 유키<span className="font-black text-[#a86020]">예요</span>.</p><p data-sentence-meaning className="text-[11px] text-[#707973] transition-opacity">我是优纪。</p></div><SentenceSpeakButton compact text="저는 유키예요." onSpeak={speak} color="#a86020" /></div>
                  <div className="flex items-start justify-between gap-2 rounded-lg bg-[#fafbf9] px-3 py-2"><div><p>지수<span className="font-black text-[#347b69]">는</span> 한국 사람<span className="font-black text-[#35688f]">이에요</span>.</p><p data-sentence-meaning className="text-[11px] text-[#707973] transition-opacity">智秀是韩国人。</p></div><SentenceSpeakButton compact text="지수는 한국 사람이에요." onSpeak={speak} color="#35688f" /></div>
                  <div className="flex items-start justify-between gap-2 rounded-lg bg-[#fafbf9] px-3 py-2"><div><p>이름<span className="font-black text-[#725693]">은</span> 민서<span className="font-black text-[#a86020]">예요</span>.</p><p data-sentence-meaning className="text-[11px] text-[#707973] transition-opacity">名字是敏书。</p></div><SentenceSpeakButton compact text="이름은 민서예요." onSpeak={speak} color="#a86020" /></div>
                  <div className="flex items-start justify-between gap-2 rounded-lg bg-[#fafbf9] px-3 py-2"><div><p>저<span className="font-black text-[#347b69]">는</span> 회사원<span className="font-black text-[#35688f]">이에요</span>.</p><p data-sentence-meaning className="text-[11px] text-[#707973] transition-opacity">我是公司职员。</p></div><SentenceSpeakButton compact text="저는 회사원이에요." onSpeak={speak} color="#35688f" /></div>
                </div>
              </section>

              <p className="mt-auto rounded-xl bg-[#fff8ee] px-4 py-2 text-[11px] leading-5">
                💡初学者常将其与主格助词“이/가”混淆。“이/가”通常用来引出新信息、强调动作的执行者（“是谁做的”）；而“은/는”则用来描述已知信息、强调动作的内容（“它怎么样了”）或是进行对比。
              </p>
            </div>
          </Page>,
          <Page key="lesson-1-11" lesson={lesson} number="11">
            <div className="flex h-full flex-col">
              <LessonHeading
                step="STEP 03 · 语法解说"
                title="3. 确认疑问句：语调上扬"
                description="想确认对方的姓名或身份时，不需要更换句尾。形式不变，保留이에요／예요，让声音在句末自然上扬即可。"
                icon={<MessageCircle size={22} />}
                action={
                  <button
                    type="button"
                    onClick={() => setShowEighthPageMeanings((show) => !show)}
                    className="shrink-0 rounded-full border border-[#d7e8e1] bg-[#f7fbf9] px-3 py-1.5 text-[11px] font-black text-[#347b69] transition hover:bg-[#eaf5f0]"
                  >
                    {showEighthPageMeanings ? "隐藏中文释义" : "显示中文释义"}
                  </button>
                }
              />
              <section className="mt-4 grid grid-cols-[82px_1fr] items-center rounded-2xl border border-[#dce8e1] bg-[#f5f8f6] px-5 py-3">
                <span className="text-[13px] font-black tracking-[0.1em] text-[#75559a]">核心规则</span>
                <p className="border-l border-[#d9e1dd] pl-5 text-[13px] leading-5">
                  <strong>词形不变</strong>，只改变句末语调和标点：陈述句用 <strong>.</strong>，问句用 <strong>?</strong>。
                </p>
              </section>

              <section className={`mt-3 grid grid-cols-2 gap-3 ${showEighthPageMeanings ? "" : "[&_[data-question-meaning]]:opacity-0"}`}>
                <article className="rounded-2xl border border-[#eadcc8] bg-[#fffaf3] px-5 py-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-[#a86020]">陈述 · 语调平稳 →</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-black text-[#a86020]">.</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <p className="text-lg font-black">학생<span className="text-[#35688f]">이에요</span>.</p>
                    <SentenceSpeakButton compact text="학생이에요." onSpeak={speak} color="#a86020" />
                  </div>
                  <p data-question-meaning className="mt-1 text-xs text-[#707973] transition-opacity">是学生。</p>
                </article>
                <article className="rounded-2xl border border-[#d9d0e7] bg-[#faf7fd] px-5 py-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-[#725693]">确认 · 句末上扬 ↗</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-black text-[#725693]">?</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <p className="text-lg font-black">학생<span className="text-[#35688f]">이에요</span>?</p>
                    <SentenceSpeakButton compact text="학생이에요?" onSpeak={speak} color="#725693" />
                  </div>
                  <p data-question-meaning className="mt-1 text-xs text-[#707973] transition-opacity">是学生吗？</p>
                </article>
              </section>

              <section className="mt-3 rounded-2xl border border-[#dce8e1] bg-white px-5 py-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-black">听句末，判断对方在确认什么</h3>
                  <span className="text-[11px] text-[#88928d]">先听，再看句子</span>
                </div>
                <div className={`mt-2.5 grid grid-cols-3 gap-2 ${showEighthPageMeanings ? "" : "[&_[data-question-meaning]]:opacity-0"}`}>
                  {[
                    ["민서예요?", "是敏书吗？", "#a86020"],
                    ["한국 사람이에요?", "是韩国人吗？", "#35688f"],
                    ["회사원이에요?", "是公司职员吗？", "#725693"],
                  ].map(([korean, chinese, color], index) => (
                    <div key={korean} className="rounded-xl bg-[#f7f9f8] px-3 py-2.5">
                      <span className="text-[10px] font-black text-[#9aa39e]">0{index + 1}</span>
                      <div className="mt-1 flex items-center justify-between gap-1">
                        <p className="text-[13px] font-black">{korean}</p>
                        <SentenceSpeakButton compact text={korean} onSpeak={speak} color={color} />
                      </div>
                      <p data-question-meaning className="mt-1 text-[11px] text-[#707973] transition-opacity">{chinese}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className={`mt-3 grid grid-cols-[72px_1fr] overflow-hidden rounded-2xl border border-[#dce8e1] ${showEighthPageMeanings ? "" : "[&_[data-question-meaning]]:opacity-0"}`}>
                <div className="flex items-center justify-center bg-[#edf5f1] text-xs font-black text-[#347b69]">怎么回答</div>
                <div className="grid grid-cols-2">
                  {[
                    ["네, 학생이에요.", "是的，我是学生。", "#347b69"],
                    ["아니요, 선생님이에요.", "不是，我是老师。", "#725693"],
                    ["네, 한국 사람이에요.", "是的，我是韩国人。", "#35688f"],
                    ["아니요, 회사원이에요.", "不是，我是公司职员。", "#a86020"],
                  ].map(([korean, chinese, color], index) => (
                    <div
                      key={korean}
                      className={`border-l border-[#dce8e1] px-3 py-2 ${index > 1 ? "border-t" : ""}`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-black">{korean}<SentenceSpeakButton compact text={korean} onSpeak={speak} color={color} /></div>
                      <p data-question-meaning className="mt-0.5 text-[11px] text-[#707973] transition-opacity">{chinese}</p>
                    </div>
                  ))}
                </div>
              </section>

              <p className="mt-6 rounded-xl bg-[#fff8ee] px-4 py-2 text-xs leading-5">
                💡只把声音抬得很高会显得生硬。把上扬放在最后的“요”附近，幅度自然一些即可。
                💡韩国人之间两个人的对话，无特殊情况，通常会省略“你”“我”。
              </p>
            </div>
          </Page>,
          <Page key="lesson-1-12-divider" lesson={lesson} number="12">
            <SectionDivider
              step="STEP 04"
              title="句型操练"
              goal="把刚学的助词、句尾和确认语调，练成可以快速说出口的句子。"
              icon={<NotebookPen size={24} />}
            />
          </Page>,
          <Page key="lesson-1-13" lesson={lesson} number="13">
            <div className="flex h-full flex-col">
              <LessonHeading
                step="STEP 04 · 句型操练"
                title="1. 判断收音，选择은／는"
                description="先看主题名词最后一个音节：有收音接은，无收音接는。选好助词后，再把整句话连起来说。"
                icon={<NotebookPen size={22} />}
                action={
                  <button
                    type="button"
                    onClick={() => setShowNinthPageAnswers((show) => !show)}
                    className="shrink-0 rounded-full border border-[#d7e8e1] bg-[#f7fbf9] px-3 py-1.5 text-[11px] font-black text-[#347b69] transition hover:bg-[#eaf5f0]"
                  >
                    {showNinthPageAnswers ? "隐藏参考答案" : "显示参考答案"}
                  </button>
                }
              />

              <div className="mt-2 grid grid-cols-3 gap-2">
                {[
                  ["01", "找主题", "圈出句子开头的名词"],
                  ["02", "看收音", "有收音用은，无收音用는"],
                  ["03", "连起来", "补全助词并读完整句"],
                ].map(([number, title, detail]) => (
                  <div key={number} className="rounded-xl bg-[#f5f8f6] px-3 py-2.5">
                    <p className="text-xs font-black"><span className="mr-1.5 text-[#725693]">{number}</span>{title}</p>
                    <p className="mt-1 text-[10px] leading-4 text-[#707973]">{detail}</p>
                  </div>
                ))}
              </div>

              <section className="mt-3 flex items-center justify-center gap-3 rounded-2xl border border-[#dce8e1] bg-white px-5 py-3 font-black">
                <span className="rounded-lg bg-[#fff7eb] px-3 py-1.5 text-sm">主题名词</span>
                <span className="text-[#aab1ad]">+</span>
                <span className="rounded-lg bg-[#f4effa] px-3 py-1.5 text-sm text-[#725693]">은</span>
                <span className="text-[#aab1ad]">／</span>
                <span className="rounded-lg bg-[#edf7f3] px-3 py-1.5 text-sm text-[#347b69]">는</span>
                <span className="text-[#aab1ad]">+</span>
                <span className="rounded-lg bg-[#eef5fa] px-3 py-1.5 text-sm">主题说明</span>
              </section>

              <div className={`mt-3 grid grid-cols-2 gap-2 ${showNinthPageAnswers ? "" : "[&_[data-practice-answer]]:opacity-0"}`}>
                {[
                  ["01", "민준", "有收音", "학생이에요.", "민준은 학생이에요.", "#725693"],
                  ["02", "지수", "无收音", "회사원이에요.", "지수는 회사원이에요.", "#347b69"],
                  ["03", "이름", "有收音", "민서예요.", "이름은 민서예요.", "#725693"],
                  ["04", "유나", "无收音", "친구예요.", "유나는 친구예요.", "#347b69"],
                  ["05", "선생님", "有收音", "한국 사람이에요.", "선생님은 한국 사람이에요.", "#725693"],
                  ["06", "저", "无收音", "학생이에요.", "저는 학생이에요.", "#347b69"],
                  ["07", "민서", "无收音", "선생님이에요.", "민서는 선생님이에요.", "#347b69"],
                  ["08", "회사원", "有收音", "준호예요.", "회사원은 준호예요.", "#725693"],
                ].map(([number, topic, hint, ending, answer, color]) => (
                  <article key={number} className="rounded-xl border border-[#dce8e1] bg-white px-4 py-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-black"><span className="mr-2 text-[10px] text-[#9aa39e]">{number}</span>{topic}</p>
                      <span className="text-[10px] font-bold" style={{ color }}>{hint}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1 border-t border-dashed border-[#e3e9e5] pt-1.5 text-xs">
                      <span>{topic}</span>
                      <span className="inline-block w-12 border-b-2 border-dashed border-[#9eb8ad]">&nbsp;</span>
                      <span>{ending}</span>
                    </div>
                    <div data-practice-answer className="mt-1 flex items-center justify-between gap-2 text-xs font-black transition-opacity">
                      <span style={{ color }}>{answer}</span>
                      <SentenceSpeakButton compact text={answer} onSpeak={speak} color={color} />
                    </div>
                  </article>
                ))}
              </div>

              <p className="mt-2 rounded-xl bg-[#fff8ee] px-4 py-2 text-[11px] leading-5">
                💡 先只读“主题＋助词”，如 민준은、지수는；熟练后再接后半句。
              </p>
            </div>
          </Page>,
          <Page key="lesson-1-14" lesson={lesson} number="14">
            <div className="flex h-full flex-col">
              <LessonHeading
                step="STEP 04 · 句型操练"
                title="2. 选对句尾，完成组句"
                description="把姓名或身份放进句型，先观察最后一个音节有没有收音，再选择이에요或예요。"
                icon={<NotebookPen size={22} />}
                action={
                  <button
                    type="button"
                    onClick={() => setShowTenthPageAnswers((show) => !show)}
                    className="shrink-0 rounded-full border border-[#d7e8e1] bg-[#f7fbf9] px-3 py-1.5 text-[11px] font-black text-[#347b69] transition hover:bg-[#eaf5f0]"
                  >
                    {showTenthPageAnswers ? "隐藏参考答案" : "显示参考答案"}
                  </button>
                }
              />
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  ["01", "放进去", "把提示词放在저는后面"],
                  ["02", "看收音", "判断选이에요还是예요"],
                  ["03", "说完整", "连成一句并朗读两遍"],
                ].map(([number, title, detail]) => (
                  <div key={number} className="rounded-xl bg-[#f5f8f6] px-3 py-2.5">
                    <p className="text-xs font-black"><span className="mr-1.5 text-[#b87131]">{number}</span>{title}</p>
                    <p className="mt-1 text-[10px] leading-4 text-[#707973]">{detail}</p>
                  </div>
                ))}
              </div>

              <section className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-[#dce8e1] bg-white px-5 py-3 font-black">
                <span className="rounded-lg bg-[#edf7f3] px-3 py-1.5 text-sm">저<span className="text-[#347b69]">는</span></span>
                <span className="text-[#aab1ad]">+</span>
                <span className="rounded-lg bg-[#fff7eb] px-3 py-1.5 text-sm">提示词</span>
                <span className="text-[#aab1ad]">+</span>
                <span className="rounded-lg bg-[#eef5fa] px-3 py-1.5 text-sm"><span className="text-[#35688f]">이에요</span>／<span className="text-[#a86020]">예요</span></span>
              </section>

              <div className={`mt-3 grid grid-cols-2 gap-2 ${showTenthPageAnswers ? "" : "[&_[data-practice-answer]]:opacity-0"}`}>
                {[
                  ["01", "민서", "名字 · 无收音", "저는 민서예요.", "#a86020"],
                  ["02", "준호", "名字 · 无收音", "저는 준호예요.", "#a86020"],
                  ["03", "학생", "身份 · 有收音", "저는 학생이에요.", "#35688f"],
                  ["04", "회사원", "职业 · 有收音", "저는 회사원이에요.", "#35688f"],
                  ["05", "친구", "关系 · 无收音", "저는 친구예요.", "#a86020"],
                  ["06", "한국 사람", "国籍 · 有收音", "저는 한국 사람이에요.", "#35688f"],
                  ["07", "선생님", "职业 · 有收音", "저는 선생님이에요.", "#35688f"],
                  ["08", "일본 사람", "国籍 · 有收音", "저는 일본 사람이에요.", "#35688f"],
                ].map(([number, word, hint, answer, color]) => (
                  <article key={number} className="rounded-xl border border-[#dce8e1] bg-white px-4 py-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-black"><span className="mr-2 text-[10px] text-[#9aa39e]">{number}</span>{word}</p>
                      <span className="text-[10px] text-[#707973]">{hint}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1 border-t border-dashed border-[#e3e9e5] pt-1.5 text-xs">
                      <span>저는 {word}</span>
                      <span className="inline-block w-20 border-b-2 border-dashed border-[#9eb8ad]">&nbsp;</span>
                      <span>.</span>
                    </div>
                    <div data-practice-answer className="mt-1 flex items-center justify-between gap-2 text-xs font-black transition-opacity">
                      <span style={{ color }}>{answer}</span>
                      <SentenceSpeakButton compact text={answer} onSpeak={speak} color={color} />
                    </div>
                  </article>
                ))}
              </div>

              <p className="mt-auto rounded-xl bg-[#fff8ee] px-4 py-2 text-[11px] leading-5">
                ✍️ 最后把提示词换成你的真实姓名和身份，不看答案再说一次。
              </p>
            </div>
          </Page>,
          <Page key="lesson-1-15" lesson={lesson} number="15">
            <div className="flex h-full flex-col">
              <LessonHeading
                step="STEP 04 · 句型操练"
                title="3. 陈述、确认，再回应"
                description="先读陈述句，再用句末上扬把它变成提问，最后根据资料卡作出肯定或否定回答。"
                icon={<NotebookPen size={22} />}
                action={
                  <button
                    type="button"
                    onClick={() => setShowEleventhPageAnswers((show) => !show)}
                    className="shrink-0 rounded-full border border-[#d7e8e1] bg-[#f7fbf9] px-3 py-1.5 text-[11px] font-black text-[#347b69] transition hover:bg-[#eaf5f0]"
                  >
                    {showEleventhPageAnswers ? "隐藏参考答案" : "显示参考答案"}
                  </button>
                }
              />
              <section className="mt-4 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center rounded-2xl border border-[#dce8e1] bg-[#f7f9f8] px-5 py-2.5 text-center">
                <div><span className="text-[10px] font-black text-[#a86020]">01</span><p className="mt-0.5 text-xs font-black">平稳陈述 →</p></div>
                <span className="text-[#b8bfbb]">→</span>
                <div><span className="text-[10px] font-black text-[#725693]">02</span><p className="mt-0.5 text-xs font-black">句末上扬 ↗</p></div>
                <span className="text-[#b8bfbb]">→</span>
                <div><span className="text-[10px] font-black text-[#347b69]">03</span><p className="mt-0.5 text-xs font-black">立即回应</p></div>
              </section>

              <div className={`mt-3 space-y-1.5 ${showEleventhPageAnswers ? "" : "[&_[data-round-answer]]:opacity-0"}`}>
                {[
                  ["01", "资料：준호＝회사원", "준호는 회사원이에요.", "준호는 회사원이에요?", "네, 회사원이에요.", "#347b69"],
                  ["02", "资料：유나＝선생님", "유나는 학생이에요.", "유나는 학생이에요?", "아니요, 선생님이에요.", "#725693"],
                  ["03", "资料：민서＝친구", "민서는 친구예요.", "민서는 친구예요?", "네, 친구예요.", "#347b69"],
                  ["04", "资料：지수＝회사원", "지수는 선생님이에요.", "지수는 선생님이에요?", "아니요, 회사원이에요.", "#a86020"],
                  ["05", "资料：다니엘＝학생", "다니엘은 친구예요.", "다니엘은 친구예요?", "아니요, 학생이에요.", "#35688f"],
                ].map(([number, profile, statement, question, answer, color]) => (
                  <article key={number} className="overflow-hidden rounded-2xl border border-[#dce8e1] bg-white">
                    <div className="flex items-center justify-between bg-[#f5f8f6] px-4 py-1.5">
                      <p className="text-[10px] font-black text-[#b87131]">ROUND {number}</p>
                      <span className="text-[10px] font-bold text-[#707973]">{profile}</span>
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 px-4 py-2 text-xs">
                      <div>
                        <span className="text-[9px] font-black text-[#a86020]">陈述</span>
                        <p className="mt-1">{statement}</p>
                      </div>
                      <span className="text-[#c0c6c2]">→</span>
                      <div data-round-answer className="transition-opacity">
                        <span className="text-[9px] font-black text-[#725693]">确认</span>
                        <div className="mt-1 flex items-center gap-1"><p className="font-black">{question}</p><SentenceSpeakButton compact text={question} onSpeak={speak} color="#725693" /></div>
                      </div>
                      <span className="text-[#c0c6c2]">→</span>
                      <div data-round-answer className="transition-opacity">
                        <span className="text-[9px] font-black text-[#347b69]">回应</span>
                        <div className="mt-1 flex items-center gap-1"><p className="font-black" style={{ color }}>{answer}</p><SentenceSpeakButton compact text={answer} onSpeak={speak} color={color} /></div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="mt-auto grid grid-cols-[104px_1fr] overflow-hidden rounded-xl border border-[#d9d0e7] bg-[#faf7fd]">
                <div className="flex items-center justify-center bg-[#f1ebf7] text-xs font-black text-[#725693]">3秒挑战</div>
                <p className="px-4 py-2 text-[11px] leading-5">遮住答案，根据资料卡在3秒内说出“确认问题＋回应”；完成后交换角色。</p>
              </div>
            </div>
          </Page>,
          <Page key="lesson-1-16-divider" lesson={lesson} number="16">
            <SectionDivider
              step="STEP 05"
              title="实战对话"
              goal="在原创的初次见面情境中，完成问候、介绍、确认与礼貌收尾。"
              icon={<MessageCircle size={24} />}
            />
          </Page>,
          <Page key="lesson-1-17" lesson={lesson} number="17">
            <div className="flex h-full flex-col">
              <LessonHeading
                step="STEP 05 · 实战对话"
                title="1. 完整场景：体验课开始前"
                description="敏书和俊浩第一次坐在一起。他们从问候开始，交换姓名，再确认彼此的身份。"
                icon={<MessageCircle size={22} />}
                action={
                  <button
                    type="button"
                    onClick={() => setShowTwelfthPageMeanings((show) => !show)}
                    className="shrink-0 rounded-full border border-[#d7e8e1] bg-[#f7fbf9] px-3 py-1.5 text-[11px] font-black text-[#347b69] transition hover:bg-[#eaf5f0]"
                  >
                    {showTwelfthPageMeanings ? "隐藏中文释义" : "显示中文释义"}
                  </button>
                }
              />
              <section className="mt-4 grid grid-cols-[88px_1fr_1fr] overflow-hidden rounded-2xl border border-[#dce8e1] text-xs">
                <div className="flex items-center justify-center bg-[#edf5f1] font-black text-[#347b69]">人物资料</div>
                <div className="border-l border-[#dce8e1] px-4 py-2.5"><strong>민서</strong><span className="ml-2 text-[#707973]">学生</span></div>
                <div className="border-l border-[#dce8e1] px-4 py-2.5"><strong>준호</strong><span className="ml-2 text-[#707973]">公司职员</span></div>
              </section>
              <div className={`mt-3 space-y-2 ${showTwelfthPageMeanings ? "" : "[&_[data-dialogue-meaning]]:opacity-0"}`}>
                {[
                  ["민서", "안녕하세요? 저는 민서예요.", "你好，我是敏书。"],
                  ["준호", "안녕하세요. 저는 준호예요.", "你好，我是俊浩。"],
                  ["민서", "학생이에요?", "你是学生吗？"],
                  ["준호", "아니요, 회사원이에요.", "不是，我是公司职员。"],
                  ["민서", "저는 학생이에요.", "我是学生。"],
                  ["준호", "만나서 반가워요.", "很高兴认识你。"],
                  ["민서", "반가워요.", "我也很高兴。"],
                ].map(([speaker, line, chinese], index) => (
                  <div
                    key={`${speaker}-${line}`}
                    className={`grid grid-cols-[48px_1fr_auto] items-center gap-3 rounded-xl px-4 py-2.5 ${
                      index % 2 === 0 ? "bg-[#f5f8f6]" : "border border-[#e1e8e4] bg-white"
                    }`}
                  >
                    <span className={`text-xs font-black ${index % 2 === 0 ? "text-[#347b69]" : "text-[#725693]"}`}>{speaker}</span>
                    <div>
                      <p className="text-sm font-black">{line}</p>
                      <p data-dialogue-meaning className="mt-0.5 text-[10px] text-[#707973] transition-opacity">{chinese}</p>
                    </div>
                    <SentenceSpeakButton compact text={line} onSpeak={speak} color={index % 2 === 0 ? "#347b69" : "#725693"} />
                  </div>
                ))}
              </div>
              <p className="mt-auto rounded-xl bg-[#fff8ee] px-4 py-2 text-[11px] leading-5">
                阅读顺序：先分清谁在说话，再找出“问候—姓名—身份—收尾”四个部分。
              </p>
            </div>
          </Page>,
          <Page key="lesson-1-18" lesson={lesson} number="18">
            <div className="flex h-full flex-col">
              <LessonHeading
                step="STEP 05 · 实战对话"
                title="2. 看懂对话的五步交流路线"
                description="完整对话不需要逐字背诵。记住每一步的交际作用，就能替换人物和身份，说出自己的版本。"
                icon={<MessageCircle size={22} />}
                action={
                  <button
                    type="button"
                    onClick={() => setShowThirteenthPageMeanings((show) => !show)}
                    className="shrink-0 rounded-full border border-[#d7e8e1] bg-[#f7fbf9] px-3 py-1.5 text-[11px] font-black text-[#347b69] transition hover:bg-[#eaf5f0]"
                  >
                    {showThirteenthPageMeanings ? "隐藏中文提示" : "显示中文提示"}
                  </button>
                }
              />
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#f5f8f6] px-5 py-3 text-[11px] font-black">
                {["问候", "报姓名", "确认身份", "回答", "礼貌收尾"].map((item, index) => (
                  <div key={item} className="flex items-center gap-2">
                    <span className="text-[#b87131]">0{index + 1}</span><span>{item}</span>
                    {index < 4 && <span className="ml-2 text-[#b8bfbb]">→</span>}
                  </div>
                ))}
              </div>
              <div className={`mt-3 grid grid-cols-2 gap-2.5 ${showThirteenthPageMeanings ? "" : "[&_[data-dialogue-meaning]]:opacity-0"}`}>
                {[
                  ["01 · 问候", "안녕하세요?", "先礼貌地打开交流。", "#347b69"],
                  ["02 · 报姓名", "저는 유나예요.", "把姓名换成自己的名字。", "#a86020"],
                  ["03 · 确认身份", "선생님이에요?", "句末上扬，确认对方身份。", "#725693"],
                  ["04 · 回答", "아니요, 학생이에요.", "先回答，再给出正确信息。", "#35688f"],
                  ["05 · 礼貌收尾", "만나서 반가워요.", "结束第一次见面的交流。", "#347b69"],
                  ["替换槽", "저는 ______예요／이에요.", "姓名和身份都可以放进句型。", "#b87131"],
                ].map(([number, korean, use, color]) => (
                  <article key={number} className="rounded-xl border border-[#dce8e1] bg-white px-4 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black" style={{ color }}>{number}</p>
                      <SentenceSpeakButton compact text={korean.replace("______", "민서")} onSpeak={speak} color={color} />
                    </div>
                    <p className="mt-1.5 text-sm font-black">{korean}</p>
                    <p data-dialogue-meaning className="mt-1 text-[10px] leading-4 text-[#707973] transition-opacity">{use}</p>
                  </article>
                ))}
              </div>
              <div className="mt-auto grid grid-cols-[92px_1fr] overflow-hidden rounded-xl border border-[#d9d0e7] bg-[#faf7fd]">
                <div className="flex items-center justify-center bg-[#f1ebf7] text-xs font-black text-[#725693]">替换任务</div>
                <p className="px-4 py-2 text-[11px] leading-5">把人物改成你和同桌，依次完成“问候＋姓名＋身份确认＋回答＋收尾”。</p>
              </div>
            </div>
          </Page>,
          <Page key="lesson-1-19" lesson={lesson} number="19">
            <div className="flex h-full flex-col">
              <LessonHeading
                step="STEP 05 · 实战对话"
                title="3. 场景 A、B：完成一段完整对话"
                description="场景A先主动介绍自己；场景B先询问姓名。比较两种不同的开场方式。"
                icon={<MessageCircle size={22} />}
                action={
                  <button
                    type="button"
                    onClick={() => setShowFourteenthPageMeanings((show) => !show)}
                    className="shrink-0 rounded-full border border-[#d7e8e1] bg-[#f7fbf9] px-3 py-1.5 text-[11px] font-black text-[#347b69] transition hover:bg-[#eaf5f0]"
                  >
                    {showFourteenthPageMeanings ? "隐藏中文释义" : "显示中文释义"}
                  </button>
                }
              />
              <div className={`mt-4 grid grid-cols-2 gap-3 ${showFourteenthPageMeanings ? "" : "[&_[data-dialogue-meaning]]:opacity-0"}`}>
                {[
                  {
                    label: "场景 A · 先主动介绍自己",
                    color: "#347b69",
                    mask: false,
                    lines: [
                      ["A", "안녕하세요?", "你好。"],
                      ["B", "안녕하세요.", "你好。"],
                      ["A", "저는 유나예요.", "我是有娜。"],
                      ["B", "저는 지수예요.", "我是智秀。"],
                      ["A", "학생이에요?", "你是学生吗？"],
                      ["B", "네, 학생이에요.", "是的，我是学生。"],
                      ["B", "회사원이에요?", "你是公司职员吗？"],
                      ["A", "아니요, 선생님이에요.", "不是，我是老师。"],
                      ["B", "선생님이에요?", "你是老师吗？"],
                      ["A", "네, 선생님이에요.", "是的，我是老师。"],
                      ["B", "만나서 반가워요.", "很高兴认识你。"],
                    ],
                  },
                  {
                    label: "场景 B · 先询问对方姓名",
                    color: "#725693",
                    lines: [
                      ["A", "안녕하세요? 이름이 뭐예요?", "你好，你叫什么名字？"],
                      ["B", "저는 다니엘이에요.", "我是丹尼尔。"],
                      ["B", "이름이 뭐예요?", "你叫什么名字？"],
                      ["A", "저는 하린이에요.", "我是夏凛。"],
                      ["B", "회사원이에요?", "你是公司职员吗？"],
                      ["A", "아니요, 학생이에요.", "不是，我是学生。"],
                      ["A", "학생이에요?", "你是学生吗？"],
                      ["B", "아니요, 회사원이에요.", "不是，我是公司职员。"],
                      ["A", "회사원이에요?", "你是公司职员吗？"],
                      ["B", "네, 회사원이에요.", "是的，我是公司职员。"],
                      ["A", "만나서 반가워요.", "很高兴认识你。"],
                    ],
                  },
                ].map(({ label, color, lines, mask = true }) => (
                  <article key={label} className="overflow-hidden rounded-2xl border border-[#dce8e1] bg-white">
                    <div className="px-4 py-2 text-xs font-black text-white" style={{ backgroundColor: color }}>{label}</div>
                    <div className="divide-y divide-[#edf0ee] px-3">
                      {lines.map(([speaker, line, chinese]) => (
                        <div key={`${speaker}-${line}`} className="grid grid-cols-[20px_1fr_auto] items-start gap-2 py-1">
                          <span className="text-[11px] font-black" style={{ color }}>{speaker}</span>
                          <div>
                            <p className="text-xs font-black leading-5">{mask ? <MaskedDialogueLine text={line} /> : line}</p>
                            <p data-dialogue-meaning className="mt-0.5 text-[10px] leading-4 text-[#707973] transition-opacity">{chinese}</p>
                          </div>
                          <SentenceSpeakButton compact text={line} onSpeak={speak} color={color} />
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
              <p className="mt-auto text-center text-[11px] text-[#83948b]">完成标准：不看中文，连续完成一段20秒的初次见面对话。</p>
            </div>
          </Page>,
          <Page key="lesson-1-20" lesson={lesson} number="20">
            <div className="flex h-full flex-col">
              <LessonHeading
                step="STEP 05 · 实战对话"
                title="4. 场景 C、D：听出不同的身份回应"
                description="场景C先确认姓名并纠正；场景D先确认身份，再交换姓名。比较不同的信息顺序。"
                icon={<MessageCircle size={22} />}
                action={
                  <button
                    type="button"
                    onClick={() => setShowFifteenthPageMeanings((show) => !show)}
                    className="shrink-0 rounded-full border border-[#d7e8e1] bg-[#f7fbf9] px-3 py-1.5 text-[11px] font-black text-[#347b69] transition hover:bg-[#eaf5f0]"
                  >
                    {showFifteenthPageMeanings ? "隐藏中文释义" : "显示中文释义"}
                  </button>
                }
              />
              <div className={`mt-4 grid grid-cols-2 gap-3 ${showFifteenthPageMeanings ? "" : "[&_[data-dialogue-meaning]]:opacity-0"}`}>
                {[
                  {
                    label: "场景 C · 先确认姓名并纠正",
                    color: "#35688f",
                    lines: [
                      ["A", "안녕하세요?", "你好。"],
                      ["B", "안녕하세요.", "你好。"],
                      ["A", "수빈이에요?", "你是秀彬吗？"],
                      ["B", "아니요, 저는 민우예요.", "不是，我是民宇。"],
                      ["B", "이름이 뭐예요?", "你叫什么名字？"],
                      ["A", "저는 소라예요.", "我是素拉。"],
                      ["B", "학생이에요?", "你是学生吗？"],
                      ["A", "네, 학생이에요.", "是的，我是学生。"],
                      ["A", "선생님이에요?", "你是老师吗？"],
                      ["B", "네, 선생님이에요.", "是的，我是老师。"],
                      ["A", "만나서 반가워요.", "很高兴认识你。"],
                    ],
                  },
                  {
                    label: "场景 D · 先确认身份再问姓名",
                    color: "#a86020",
                    lines: [
                      ["A", "안녕하세요?", "你好。"],
                      ["B", "안녕하세요.", "你好。"],
                      ["A", "선생님이에요?", "你是老师吗？"],
                      ["B", "아니요, 회사원이에요.", "不是，我是公司职员。"],
                      ["B", "학생이에요?", "你是学生吗？"],
                      ["A", "네, 학생이에요.", "是的，我是学生。"],
                      ["A", "이름이 뭐예요?", "你叫什么名字？"],
                      ["B", "저는 수빈이에요.", "我是秀彬。"],
                      ["B", "이름이 뭐예요?", "你叫什么名字？"],
                      ["A", "저는 하린이에요.", "我是夏凛。"],
                      ["B", "만나서 반가워요.", "很高兴认识你。"],
                    ],
                  },
                ].map(({ label, color, lines }) => (
                  <article key={label} className="overflow-hidden rounded-2xl border border-[#dce8e1] bg-white">
                    <div className="px-4 py-2 text-xs font-black text-white" style={{ backgroundColor: color }}>{label}</div>
                    <div className="divide-y divide-[#edf0ee] px-3">
                      {lines.map(([speaker, line, chinese]) => (
                        <div key={`${speaker}-${line}`} className="grid grid-cols-[20px_1fr_auto] items-start gap-2 py-0.5">
                          <span className="text-[11px] font-black" style={{ color }}>{speaker}</span>
                          <div>
                            <p className="text-xs font-black leading-5"><MaskedDialogueLine text={line} /></p>
                            <p data-dialogue-meaning className="mt-0.5 text-[10px] leading-4 text-[#707973] transition-opacity">{chinese}</p>
                          </div>
                          <SentenceSpeakButton compact text={line} onSpeak={speak} color={color} />
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
              <p className="mt-auto text-center text-[11px] text-[#83948b]">听清“네／아니요”后，再跟着说出完整的身份信息。</p>
            </div>
          </Page>,
          <Page key="lesson-1-21-divider" lesson={lesson} number="21">
            <SectionDivider
              step="STEP 06"
              title="听说任务"
              goal="从听辨姓名和身份开始，逐步练到确认、纠正、跟读和角色扮演。"
              icon={<Headphones size={24} />}
            />
          </Page>,
          <Page key="lesson-1-22" lesson={lesson} number="22">
            <div className="flex h-full flex-col">
              <LessonHeading
                step="STEP 06 · 听说任务"
                title="1. 抓住姓名和身份"
                description="每段听两遍：第一遍只找姓名，第二遍再判断学生、老师或公司职员。不要逐字翻译。"
                icon={<Headphones size={22} />}
                action={
                  <button
                    type="button"
                    onClick={() => setShowSixteenthPageAnswers((show) => !show)}
                    className="shrink-0 rounded-full border border-[#d7e8e1] bg-[#f7fbf9] px-3 py-1.5 text-[11px] font-black text-[#347b69] transition hover:bg-[#eaf5f0]"
                  >
                    {showSixteenthPageAnswers ? "隐藏答案" : "显示答案"}
                  </button>
                }
              />
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  {
                    label: "片段 01",
                    script: "안녕하세요? 저는 민우예요. 학생이에요.",
                    answer: "민우／学生",
                  },
                  {
                    label: "片段 02",
                    script: "저는 유나예요. 회사원이에요.",
                    answer: "유나／公司职员",
                  },
                  {
                    label: "片段 03",
                    script: "안녕하세요. 저는 하린이에요. 선생님이에요.",
                    answer: "하린／老师",
                  },
                  {
                    label: "片段 04",
                    script: "저는 다니엘이에요. 학생이에요.",
                    answer: "다니엘／学生",
                  },
                ].map(({ label, script, answer }) => (
                  <article key={label} className="rounded-2xl border border-[#dce8e1] bg-white p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-black text-[#294f43]">{label}</p>
                      <button
                        type="button"
                        onClick={() => speak(script)}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#e5f3ee] px-3 py-2 text-xs font-black text-[#238777]"
                      >
                        <Volume2 size={15} />
                        播放
                      </button>
                    </div>
                    <div className="mt-3 space-y-2 text-xs">
                      <p>姓名：<span className="inline-block w-20 border-b border-dashed border-[#9eb8ad]">&nbsp;</span></p>
                      <p>身份：□ 学生　□ 老师　□ 公司职员</p>
                    </div>
                    <p className={showSixteenthPageAnswers ? "mt-3 rounded-lg bg-[#f5f8f6] px-3 py-2 text-[11px] font-black opacity-100" : "mt-3 rounded-lg bg-[#f5f8f6] px-3 py-2 text-[11px] font-black opacity-0"}>答案：{answer}</p>
                  </article>
                ))}
              </div>
              <section className="mt-4 rounded-xl bg-[#fff8ee] px-4 py-3 text-[11px] leading-5"><strong>听音技巧：</strong>姓名通常紧跟在저는后面；身份词通常出现在이에요／예요前面。</section>
              <p className="mt-auto text-center text-xs text-[#83948b]">四段全部完成后再显示答案，只核对姓名和身份两个关键词。</p>
            </div>
          </Page>,
          <Page key="lesson-1-23" lesson={lesson} number="23">
            <div className="flex h-full flex-col">
              <LessonHeading
                step="STEP 06 · 听说任务"
                title="2. 听确认与纠正"
                description="重点听네和아니요。判断第一个信息是否正确，并记录说话人最后给出的真实信息。"
                icon={<Headphones size={22} />}
                action={
                  <button
                    type="button"
                    onClick={() => setShowSeventeenthPageAnswers((show) => !show)}
                    className="shrink-0 rounded-full border border-[#d7e8e1] bg-[#f7fbf9] px-3 py-1.5 text-[11px] font-black text-[#347b69] transition hover:bg-[#eaf5f0]"
                  >
                    {showSeventeenthPageAnswers ? "隐藏答案" : "显示答案"}
                  </button>
                }
              />
              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  {
                    label: "片段 01",
                    script: "학생이에요? 네, 학생이에요.",
                    answer: "正确／学生",
                  },
                  {
                    label: "片段 02",
                    script: "회사원이에요? 아니요, 선생님이에요.",
                    answer: "错误／老师",
                  },
                  {
                    label: "片段 03",
                    script: "수빈이에요? 아니요, 저는 소라예요.",
                    answer: "错误／소라",
                  },
                  {
                    label: "片段 04",
                    script: "선생님이에요? 네, 선생님이에요.",
                    answer: "正确／老师",
                  },
                ].map(({ label, script, answer }) => (
                  <article key={label} className="rounded-2xl border border-[#dce8e1] bg-white p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-black text-[#294f43]">{label}</p>
                      <button
                        type="button"
                        onClick={() => speak(script)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#edf5fb] px-3 py-2 text-xs font-black text-[#47779d]"
                      >
                        <Volume2 size={15} />
                        播放
                      </button>
                    </div>
                    <div className="mt-3 space-y-2 text-xs leading-5 text-[#344b42]">
                      <p>第一信息：□ 正确　□ 错误</p>
                      <p>最终信息：<span className="inline-block w-20 border-b border-dashed border-[#9eb8ad]">&nbsp;</span></p>
                    </div>
                    <p className={`mt-3 rounded-lg bg-[#f5f8f6] px-3 py-2 text-[11px] font-black transition ${showSeventeenthPageAnswers ? "opacity-100" : "opacity-0"}`}>
                      答案：{answer}
                    </p>
                  </article>
                ))}
              </div>
              <div className="mt-4 rounded-2xl bg-[#fff8ee] px-5 py-4 text-xs leading-6 text-[#6f593f]">
                <strong>判断口诀：</strong>听到네，保留前面的信息；听到아니요，继续听后面的纠正内容。不要在아니요处停止记录。
              </div>
              <p className="mt-auto text-center text-xs text-[#83948b]">每段先判断“对不对”，再写下最终信息，训练听力中的信息更新。</p>
            </div>
          </Page>,
          <Page key="lesson-1-24" lesson={lesson} number="24">
            <div className="flex h-full flex-col">
              <LessonHeading
                step="STEP 06 · 听说任务"
                title="3. 跟读、接话，再完成角色扮演"
                description="先模仿语音和停顿，再离开文字完成一轮交流。不会的地方可以停一下，但尽量不要切换成中文。"
                icon={<Mic2 size={22} />}
              />
              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  ["01", "只听整段", "不看文字，感受问候、确认和回应的节奏。"],
                  ["02", "逐句跟读", "点每句右侧喇叭，听完立即模仿。"],
                  ["03", "遮住文本", "只看功能提示，独立完成整段交流。"],
                ].map(([number, title, detail]) => (
                  <div key={number} className="rounded-xl bg-[#f5f8f6] px-4 py-3">
                    <p className="text-[10px] font-black text-[#b87131]">{number}</p>
                    <p className="mt-1 text-sm font-black text-[#294f43]">{title}</p>
                    <p className="mt-1 text-[11px] leading-4 text-[#71857b]">{detail}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-[1.2fr_0.8fr] gap-4">
                <section className="rounded-2xl border border-[#dce8e1] bg-white p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-[#294f43]">跟读路线</h3>
                    <button
                      type="button"
                      onClick={() => speak("안녕하세요? 저는 민서예요. 안녕하세요. 저는 준호예요. 학생이에요? 아니요, 회사원이에요. 만나서 반가워요.")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#edf5fb] px-3 py-2 text-[11px] font-black text-[#47779d]"
                    >
                      <Volume2 size={14} /> 听整段
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {[
                      ["A", "안녕하세요? 저는 민서예요."],
                      ["B", "안녕하세요. 저는 준호예요."],
                      ["A", "학생이에요?"],
                      ["B", "아니요, 회사원이에요."],
                      ["A", "만나서 반가워요."],
                    ].map(([role, line], index) => (
                      <div key={`${role}-${line}`} className="flex items-center gap-2 rounded-lg bg-[#f8faf9] px-3 py-2">
                        <span className="w-4 text-[10px] font-black text-[#b87131]">{role}</span>
                        <p className="min-w-0 flex-1 text-[13px] font-bold text-[#243d35]">{line}</p>
                        <SentenceSpeakButton text={line} onSpeak={speak} color={index % 2 ? "#47779d" : "#b87131"} compact />
                      </div>
                    ))}
                  </div>
                </section>
                <section className="rounded-2xl border border-[#eadfce] bg-[#fffaf3] p-5">
                  <h3 className="text-sm font-black text-[#6f593f]">接话挑战</h3>
                  <p className="mt-2 text-[11px] leading-5 text-[#806d56]">老师或同伴读提示，你必须在3秒内用韩语回应。</p>
                  <div className="mt-3 space-y-2.5 text-xs leading-5 text-[#53483a]">
                    <p>① 对方先向你问候</p>
                    <p>② 对方询问你的姓名</p>
                    <p>③ 对方猜错你的身份</p>
                    <p>④ 对方说“很高兴认识你”</p>
                  </div>
                  <p className="mt-4 rounded-lg bg-white px-3 py-2 text-[11px] font-bold leading-5 text-[#8a6d49]">
                    必须使用：안녕하세요／저는…／아니요／반가워요
                  </p>
                </section>
              </div>
              <div className="mt-4 rounded-2xl bg-[#e8f3ef] px-5 py-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-[#315f52]">30秒角色扮演</p>
                  <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-[#347b69]">不看范文</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-[#4d6d62]">完成：问候 → 介绍姓名 → 确认或纠正身份 → 礼貌收尾。交换角色后，把姓名和身份全部换掉再说一次。</p>
              </div>
              <p className="mt-auto text-center text-xs text-[#83948b]">能让对方听懂关键信息，比一次说得完全正确更重要。</p>
            </div>
          </Page>,
          <Page key="lesson-1-25-divider" lesson={lesson} number="25">
            <SectionDivider
              step="STEP 07"
              title="读写拓展"
              goal="读懂简短自我介绍，再用已学结构写出属于自己的介绍卡。"
              icon={<BookOpenCheck size={24} />}
            />
          </Page>,
          <Page key="lesson-1-26" lesson={lesson} number="26">
            <div className="flex h-full flex-col">
              <LessonHeading
                step="STEP 07 · 读写拓展"
                title="1. 阅读：体验课的自我介绍卡"
                description="先找姓名和身份，再完整读一遍。"
                icon={<BookOpenCheck size={22} />}
              />
              <div className="mt-7 rounded-3xl border border-[#dce8e1] bg-[#f8fbf9] p-6">
                <p className="text-xs font-black tracking-[0.14em] text-[#238777]">한국어 체험 수업 · 자기소개 카드</p>
                <div className="mt-5 rounded-2xl bg-white p-5">
                  <p className="text-lg font-black leading-8 text-[#173f4a]">
                    안녕하세요? 저는 소라예요.<br />
                    저는 학생이에요.<br />
                    만나서 반가워요.
                  </p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4">
                {[
                  ["1", "이름이 뭐예요?", "소라예요."],
                  ["2", "학생이에요?", "네, 학생이에요."],
                  ["3", "선생님이에요?", "아니요, 학생이에요."],
                  ["4", "마지막 표현은 뭐예요?", "만나서 반가워요."],
                ].map(([number, question, answer]) => (
                  <div key={number} className="rounded-2xl border border-[#dce8e1] p-4">
                    <p className="text-xs font-black text-[#b87131]">Q{number}</p>
                    <p className="mt-2 text-xs font-bold text-[#294f43]">{question}</p>
                    <p className="mt-2 text-xs text-[#71857b]">{answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </Page>,
          <Page key="lesson-1-27" lesson={lesson} number="27">
            <div className="flex h-full flex-col">
              <LessonHeading
                step="STEP 07 · 读写拓展"
                title="2. 写作：制作你的自我介绍卡"
                description="不要翻译长句，只用本课学过的结构写3—4句。"
                icon={<NotebookPen size={22} />}
                action={
                  <button
                    type="button"
                    onClick={() => setShowTwentiethPageSample((show) => !show)}
                    className="shrink-0 rounded-full border border-[#d7e8e1] bg-[#f7fbf9] px-3 py-1.5 text-[11px] font-black text-[#347b69] transition hover:bg-[#eaf5f0]"
                  >
                    {showTwentiethPageSample ? "隐藏样本" : "显示样本"}
                  </button>
                }
              />
              <div className="mt-7 grid grid-cols-[180px_1fr] gap-5">
                <div className="rounded-3xl bg-[#173f4a] p-6 text-white">
                  <p className="text-xs font-black tracking-[0.14em] text-[#9fd7c8]">写作要素</p>
                  <ol className="mt-5 space-y-4 text-sm">
                    <li>① 问候</li>
                    <li>② 姓名</li>
                    <li>③ 身份</li>
                    <li>④ 礼貌回应</li>
                  </ol>
                </div>
                <div className="rounded-3xl border border-[#dce8e1] bg-[#fbfdfb] p-6">
                  {showTwentiethPageSample ? (
                    <>
                      <p className="text-xs font-black text-[#b87131]">ORIGINAL SAMPLE · 原创样本</p>
                      <div className="mt-5 space-y-4 text-sm font-bold text-[#294f43]">
                        <p className="border-b border-[#e5eee9] pb-2">안녕하세요?</p>
                        <p className="border-b border-[#e5eee9] pb-2">저는 하늘이에요.</p>
                        <p className="border-b border-[#e5eee9] pb-2">저는 회사원이에요.</p>
                        <p className="border-b border-[#e5eee9] pb-2">만나서 반가워요.</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-black text-[#238777]">MY CARD</p>
                      <div className="mt-5 space-y-4 text-sm text-[#60736a]">
                        <p className="border-b border-dashed border-[#cfe2d9] pb-2">안녕하세요?</p>
                        <p className="border-b border-dashed border-[#cfe2d9] pb-2">저는 ____________________.</p>
                        <p className="border-b border-dashed border-[#cfe2d9] pb-2">저는 ____________________.</p>
                        <p className="border-b border-dashed border-[#cfe2d9] pb-2">____________________________.</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-6 rounded-2xl bg-[#fff2df] px-5 py-4 text-xs leading-6 text-[#806344]">
                自查：이에요／예요是否按收音选择？是否至少使用一次은／는？结尾是否礼貌？
              </div>
              <p className="mt-auto text-center text-xs text-[#83948b]">
                写完后遮住资料卡，用同样信息口头介绍自己。
              </p>
            </div>
          </Page>,
          <Page key="lesson-1-28-divider" lesson={lesson} number="28">
            <SectionDivider
              step="STEP 08"
              title="自测与复盘"
              goal="离开范文独立完成小测，并确认自己是否能完成一次基础的初见交流。"
              icon={<CheckCircle2 size={24} />}
            />
          </Page>,
          <Page key="lesson-1-29" lesson={lesson} number="29">
            <div className="flex h-full flex-col">
              <LessonHeading
                step="STEP 08 · 自测与复盘"
                title="1. 综合自测：从形式到交流"
                description="共8题，每题1分。先独立写出完整答案，全部完成后再统一核对。"
                icon={<CheckCircle2 size={22} />}
                action={
                  <button
                    type="button"
                    onClick={() => setShowTwentyNinthPageAnswers((show) => !show)}
                    className="shrink-0 rounded-full border border-[#d7e8e1] bg-[#f7fbf9] px-3 py-1.5 text-[11px] font-black text-[#347b69] transition hover:bg-[#eaf5f0]"
                  >
                    {showTwentyNinthPageAnswers ? "隐藏参考答案" : "全部完成后核对"}
                  </button>
                }
              />
              <div className="mt-4 flex items-center justify-between rounded-xl bg-[#f3f7f4] px-4 py-2.5 text-[11px] text-[#60736a]">
                <span><strong className="text-[#355e49]">作答规则：</strong>句尾、助词和标点都要写完整。</span>
                <span className="font-black text-[#487a54]">得分：____／8</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  ["01", "학생 + 이에요／예요", "학생이에요."],
                  ["02", "유나 + 이에요／예요", "유나예요."],
                  ["03", "민준 + 은／는", "민준은"],
                  ["04", "민지 + 은／는", "민지는"],
                  ["05", "用韩语说“我是老师”", "저는 선생님이에요."],
                  ["06", "把“是公司职员”变成确认问题", "회사원이에요?"],
                  ["07", "否定后纠正为“是学生”", "아니요, 학생이에요."],
                  ["08", "先问候，再说“我是하늘”", "안녕하세요? 저는 하늘이에요."],
                ].map(([number, prompt, answer]) => (
                  <article key={number} className="rounded-xl border border-[#dce8e1] px-3.5 py-2.5">
                    <div className="flex items-start gap-2">
                      <p className="shrink-0 text-[11px] font-black text-[#b87131]">{number}</p>
                      <p className="text-[11px] font-bold leading-4 text-[#294f43]">{prompt}</p>
                    </div>
                    <p className="mt-1.5 rounded-md bg-[#f8fbf9] px-2 py-1.5 text-[10px] leading-4 text-[#71857b]">
                      {showTwentyNinthPageAnswers ? <>参考：<strong>{answer}</strong></> : "作答：________________________"}
                    </p>
                  </article>
                ))}
              </div>
              <div className="mt-3 rounded-xl bg-[#e8f4eb] px-4 py-3">
                <div className="grid grid-cols-3 gap-3 text-[10px] leading-4 text-[#46624e]">
                  <p><strong>7—8分：</strong>进入第30页完成口头复盘。</p>
                  <p><strong>5—6分：</strong>先记录错因，再重做错题。</p>
                  <p><strong>0—4分：</strong>按第30页路线回到对应STEP。</p>
                </div>
              </div>
              <p className="mt-auto text-center text-[11px] text-[#83948b]">核对时只给正确答案计分；漏写助词或句尾也要标记为需要复习。</p>
            </div>
          </Page>,
          <Page key="lesson-1-30" lesson={lesson} number="30">
            <div className="flex h-full flex-col">
              <LessonHeading
                step="STEP 08 · 自测与复盘"
                title="2. 找到错因，完成第二次输出"
                description="复盘不是把答案再抄一遍，而是判断自己卡在哪一步，并马上做一次针对性练习。"
                icon={<CheckCircle2 size={22} />}
              />
              <div className="mt-4 grid grid-cols-[1.05fr_0.95fr] gap-3">
                <section className="rounded-2xl border border-[#dce8e1] bg-white p-4">
                  <h3 className="text-xs font-black text-[#294f43]">① 错因诊断：勾选最符合的一项</h3>
                  <div className="mt-3 space-y-2">
                    {[
                      ["A", "词语想不起来", "回到 STEP 02 · 第5—7页"],
                      ["B", "收音判断错误", "回到 STEP 03 · 第9—10页"],
                      ["C", "不会确认或纠正", "回到 STEP 03、06 · 第11、23页"],
                      ["D", "知道规则但说不出来", "回到 STEP 04 · 第13—15页"],
                      ["E", "对话顺序容易中断", "回到 STEP 05 · 第17—20页"],
                    ].map(([code, reason, route]) => (
                      <div key={code} className="rounded-lg bg-[#f7faf8] px-3 py-2">
                        <p className="text-[11px] font-black text-[#4b6257]">□ {code}　{reason}</p>
                        <p className="mt-0.5 pl-5 text-[9px] text-[#7a8c83]">{route}</p>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="rounded-2xl bg-[#173f4a] p-4 text-white">
                  <h3 className="text-xs font-black text-[#b8ded2]">② “我会了”能力清单</h3>
                  <div className="mt-3 space-y-2 text-[11px] leading-5 text-white/80">
                    <p>□ 我能听懂问候和身份问题</p>
                    <p>□ 我能正确使用이에요／예요</p>
                    <p>□ 我能正确使用은／는</p>
                    <p>□ 我能用네／아니요回应</p>
                    <p>□ 我能完成20秒初见交流</p>
                    <p>□ 我能写3—4句自我介绍</p>
                  </div>
                  <p className="mt-3 border-t border-white/15 pt-3 text-[10px] leading-4 text-white/65">有两项以上未勾选，就按左侧路线只复习对应内容。</p>
                </section>
              </div>
              <section className="mt-3 rounded-2xl border border-[#d8e5de] bg-[#f7fbf8] px-4 py-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-[#315f52]">③ 20秒二次输出任务</h3>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black text-[#487a54]">不看前文</span>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-[#52675d]">
                  向一位“第一次见面的同学”问候，介绍姓名和身份；确认对方身份，对方否定后继续回应，最后礼貌结束。
                </p>
                <div className="mt-2 grid grid-cols-4 gap-2 text-center text-[9px] font-bold text-[#6d7f76]">
                  <span className="rounded-md bg-white py-1.5">问候</span>
                  <span className="rounded-md bg-white py-1.5">自我介绍</span>
                  <span className="rounded-md bg-white py-1.5">确认／纠正</span>
                  <span className="rounded-md bg-white py-1.5">礼貌收尾</span>
                </div>
              </section>
              <section className="mt-3 rounded-xl bg-[#fff4e5] px-4 py-3">
                <h3 className="text-[11px] font-black text-[#806344]">④ 写下你的复习决定</h3>
                <div className="mt-2 grid grid-cols-3 gap-3 text-[10px] leading-4 text-[#806d56]">
                  <p>我要重做：STEP ____</p>
                  <p>我要再练：____________</p>
                  <p>完成日期：____／____</p>
                </div>
              </section>
              <p className="mt-auto text-center text-[11px] font-bold text-[#61766c]">完成标准：第二次输出比第一次更连贯，并能说清自己改正了什么。</p>
            </div>
          </Page>,
          <Page key="lesson-1-31-ending" lesson={lesson} number="31">
            <div className="flex h-full flex-col justify-center">
              <div className="mx-auto w-full max-w-[440px] text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff0df] text-[#bd741e]">
                  <Sparkles size={27} />
                </span>
                <p className="mt-5 text-xs font-black tracking-[0.18em] text-[#b87131]">LESSON 01 · COMPLETE</p>
                <h2 className="mt-3 text-4xl font-black text-[#1f2e28]">안녕하세요?</h2>
                <p className="mt-3 text-lg font-black text-[#303432]">你已经完成第一课</p>
                <p className="mx-auto mt-3 max-w-[370px] text-sm leading-7 text-[#60736a]">
                  从听懂一句问候，到独立完成一次初见交流，你已经把本课的词汇、语法和表达真正连了起来。
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-left">
                  {[
                    ["01", "开口问候", "自然说出안녕하세요?"],
                    ["02", "介绍自己", "说明姓名和简单身份"],
                    ["03", "确认与纠正", "听懂并使用네／아니요"],
                    ["04", "礼貌收尾", "完成一段20秒交流"],
                  ].map(([number, title, detail]) => (
                    <div key={number} className="rounded-xl border border-[#dce8e1] bg-white px-4 py-3">
                      <p className="text-[10px] font-black text-[#b87131]">{number}</p>
                      <p className="mt-1 text-xs font-black text-[#294f43]">{title}</p>
                      <p className="mt-1 text-[10px] leading-4 text-[#71857b]">{detail}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl border border-[#eadfce] bg-[#fffaf3] px-5 py-3.5 text-left">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black tracking-[0.14em] text-[#a17b50]">LESSON 1 TEST · 本课测试</p>
                      <p className="mt-1 text-xs font-bold text-[#5f5140]">进入章节测试专区，查看本课开放的词汇、语法、听辨与情境表达测试。</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => window.location.assign("/dashboard/assignments/korean")}
                      className="shrink-0 rounded-full bg-white px-3 py-2 text-[10px] font-black text-[#a17b50] shadow-sm"
                    >
                      前往测试专区
                    </button>
                  </div>
                </div>
                <div className="mt-5 rounded-2xl bg-[#eaf2fb] px-5 py-4 text-left">
                  <p className="text-[10px] font-black tracking-[0.14em] text-[#3d6f9f]">NEXT · LESSON 02</p>
                  <div className="mt-2 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-lg font-black text-[#243d35]">이거는 뭐예요?</p>
                      <p className="mt-1 text-[11px] text-[#60736a]">下一课：学会询问并说明事物名称。</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => flipBookRef.current?.pageFlip()?.flip(1)}
                      className="shrink-0 rounded-full bg-white px-3 py-2 text-[10px] font-black text-[#3d6f9f] shadow-sm"
                    >
                      返回目录
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-xs font-bold text-[#6c7d74]">学会第一句，就是能够继续说出下一句的开始。</p>
              </div>
            </div>
          </Page>,
        ]
      : [];

  return (
    <section
      ref={containerRef}
      className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden"
    >
      <div
        className="relative shrink-0"
        style={{ width: BOOK_WIDTH * scale, height: BOOK_HEIGHT * scale }}
      >
        <button
          type="button"
          onClick={() => flipBookRef.current?.pageFlip()?.flipPrev()}
          aria-label="上一页"
          className="absolute -left-14 top-1/2 z-20 -translate-y-1/2 rounded-full border border-[#cfe2d9] bg-white p-3 text-[#238777] shadow-lg transition hover:bg-[#e9f6f1]"
        >
          <ArrowLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => flipBookRef.current?.pageFlip()?.flipNext()}
          aria-label="下一页"
          className="absolute -right-14 top-1/2 z-20 -translate-y-1/2 rounded-full border border-[#cfe2d9] bg-white p-3 text-[#238777] shadow-lg transition hover:bg-[#e9f6f1]"
        >
          <ArrowRight size={18} />
        </button>

        <div
          className="absolute left-0 top-0 h-[822px] w-[1180px] origin-top-left"
          style={{ transform: `scale(${scale})` }}
        >
          <HTMLFlipBook
            ref={flipBookRef}
            width={590}
            height={822}
            startPage={initialPage}
            size="fixed"
            minWidth={590}
            maxWidth={590}
            minHeight={822}
            maxHeight={822}
            drawShadow
            maxShadowOpacity={0.32}
            flippingTime={650}
            usePortrait
            startZIndex={0}
            autoSize={false}
            showCover={false}
            mobileScrollSupport
            swipeDistance={24}
            clickEventForward
            useMouseEvents={false}
            showPageCorners={false}
            disableFlipByClick
            onFlip={(event) => onPageChange?.(event.data)}
            className="h-[822px] w-[1180px]"
            style={{}}
          >
            <Page lesson={lesson} number="封面" cover>
              <KoreanEbookCover
                lesson={lesson}
                subtitle="适配课程进度的独立学习笔记"
              />
            </Page>
            {lesson.number === 1
              ? lessonOnePages
              : ["01", "02", "03", "04", "05"].map((pageNumber) => (
                  <Page
                    key={`${lesson.number}-${pageNumber}`}
                    lesson={lesson}
                    number={pageNumber}
                  >
                    <div className="h-full" aria-label={`第${lessonNumber}课空白内容页`} />
                  </Page>
                ))}
          </HTMLFlipBook>
        </div>
      </div>
    </section>
  );
}
