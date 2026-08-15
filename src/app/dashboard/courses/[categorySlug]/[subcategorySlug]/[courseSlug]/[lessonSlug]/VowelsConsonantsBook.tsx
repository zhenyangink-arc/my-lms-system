"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false });
import { Headphones, Lightbulb, Lock, Volume2 } from "lucide-react";

type PageProps = {
  children: React.ReactNode;
  cover?: boolean;
  goals?: boolean;
  header?: string;
  number: string | number;
};

type FlipBookHandle = {
  pageFlip: () => {
    flip: (page: number) => void;
    flipNext: () => void;
    flipPrev: () => void;
    update: () => void;
  } | undefined;
};

type LetterItem = {
  letter: string;
  sound: string;
  romanization: string;
  hint: string;
};

type LessonPage = {
  number: string;
  section: string;
  title: string;
  lead: string;
  tip: string;
  accent: "green" | "orange";
  items: readonly LetterItem[];
};

const BOOK_WIDTH = 1180;
const BOOK_HEIGHT = 822;
const MAX_BOOK_SCALE = 680 / 570;

const LESSON_PAGES: readonly LessonPage[] = [
  {
    number: "02",
    section: "2.1 元音和辅音是什么",
    title: "元音承载声音，辅音塑造声音",
    lead: "元音发音时气流比较通畅；辅音则会用嘴唇、舌头或喉咙短暂阻挡气流。两者组合，才会形成完整的韩语音节。",
    tip: "先分清两类字母，再开始记字形。看到竖线或横线构成的字母，多半是元音。",
    accent: "green",
    items: [
      { letter: "ㅏ", sound: "아", romanization: "a", hint: "元音｜张口发音" },
      { letter: "ㅗ", sound: "오", romanization: "o", hint: "元音｜双唇收圆" },
      { letter: "ㄱ", sound: "가", romanization: "g/k", hint: "辅音｜舌根抬起" },
      { letter: "ㅁ", sound: "마", romanization: "m", hint: "辅音｜双唇闭合" },
    ],
  },
  {
    number: "03",
    section: "2.2 基本元音",
    title: "先掌握 6 个核心元音",
    lead: "这 6 个元音是后续学习的中心。点击字母听声音，同时观察嘴巴是张开、收圆，还是向两侧展开。",
    tip: "每个音连续跟读三遍，发音过程中保持口型稳定。",
    accent: "green",
    items: [
      { letter: "ㅏ", sound: "아", romanization: "a", hint: "嘴巴自然张大" },
      { letter: "ㅓ", sound: "어", romanization: "eo", hint: "舌位稍向后" },
      { letter: "ㅗ", sound: "오", romanization: "o", hint: "双唇收圆" },
      { letter: "ㅜ", sound: "우", romanization: "u", hint: "双唇向前突出" },
      { letter: "ㅡ", sound: "으", romanization: "eu", hint: "嘴角向两侧拉" },
      { letter: "ㅣ", sound: "이", romanization: "i", hint: "嘴角微微展开" },
    ],
  },
  {
    number: "04",
    section: "2.2 基本元音",
    title: "多一笔，就会出现轻短的 y 音",
    lead: "在基本元音的短线旁再加一笔，就会形成带 y 音的元音。读的时候先快速滑过 y，再落到主要元音。",
    tip: "对比跟读：아—야、어—여、오—요、우—유。",
    accent: "green",
    items: [
      { letter: "ㅑ", sound: "야", romanization: "ya", hint: "ㅏ 前加轻短 y 音" },
      { letter: "ㅕ", sound: "여", romanization: "yeo", hint: "ㅓ 前加轻短 y 音" },
      { letter: "ㅛ", sound: "요", romanization: "yo", hint: "圆唇并带 y 音" },
      { letter: "ㅠ", sound: "유", romanization: "yu", hint: "双唇前突并带 y 音" },
      { letter: "ㅒ", sound: "얘", romanization: "yae", hint: "从 y 滑向 ae" },
      { letter: "ㅖ", sound: "예", romanization: "ye", hint: "从 y 滑向 e" },
    ],
  },
  {
    number: "05",
    section: "2.3 复合元音",
    title: "两个口型连续滑动，组成一个元音",
    lead: "复合元音看起来由两个元音结合而成，但发音时不能拆成两个音节，要在一个音节里顺滑完成。",
    tip: "从第一个口型自然滑向第二个口型，中间不要停顿。",
    accent: "green",
    items: [
      { letter: "ㅘ", sound: "와", romanization: "wa", hint: "ㅗ + ㅏ" },
      { letter: "ㅙ", sound: "왜", romanization: "wae", hint: "ㅗ + ㅐ" },
      { letter: "ㅚ", sound: "외", romanization: "oe", hint: "圆唇滑向 e" },
      { letter: "ㅝ", sound: "워", romanization: "wo", hint: "ㅜ + ㅓ" },
      { letter: "ㅞ", sound: "웨", romanization: "we", hint: "ㅜ + ㅔ" },
      { letter: "ㅟ", sound: "위", romanization: "wi", hint: "圆唇滑向 i" },
    ],
  },
  {
    number: "06",
    section: "2.4 基本辅音",
    title: "辅音的字形藏着发音位置",
    lead: "基本辅音会提示舌头、牙齿、嘴唇或喉咙的动作。先观察动作，再把辅音和 ㅏ 组合起来听声音。",
    tip: "不要单独拖长辅音；点击卡片时听整个示范音节。",
    accent: "orange",
    items: [
      { letter: "ㄱ", sound: "가", romanization: "g/k", hint: "舌根抬起" },
      { letter: "ㄴ", sound: "나", romanization: "n", hint: "舌尖抵住上齿龈" },
      { letter: "ㄷ", sound: "다", romanization: "d/t", hint: "舌尖短暂阻气" },
      { letter: "ㄹ", sound: "라", romanization: "r/l", hint: "舌尖轻弹" },
      { letter: "ㅁ", sound: "마", romanization: "m", hint: "双唇闭合" },
      { letter: "ㅂ", sound: "바", romanization: "b/p", hint: "双唇打开" },
    ],
  },
  {
    number: "07",
    section: "2.4 基本辅音",
    title: "继续认识常用基础辅音",
    lead: "这一组包含擦音、鼻音和喉音。特别注意 ㅇ：放在音节开头时通常不发音，放在末尾时读 ng。",
    tip: "对比 사、아、자、하，注意声音从口腔的哪个位置出现。",
    accent: "orange",
    items: [
      { letter: "ㅅ", sound: "사", romanization: "s", hint: "气流擦过齿缝" },
      { letter: "ㅇ", sound: "아", romanization: "silent/ng", hint: "开头不发音" },
      { letter: "ㅈ", sound: "자", romanization: "j", hint: "舌面短暂阻气" },
      { letter: "ㅎ", sound: "하", romanization: "h", hint: "气流通过喉咙" },
      { letter: "ㄱ", sound: "강", romanization: "ng", hint: "听末尾的 ㅇ" },
    ],
  },
  {
    number: "08",
    section: "2.5 送气音",
    title: "送气音：让气流更明显",
    lead: "送气音是在基础辅音上增加笔画形成的。发音时有明显气流，可以把手掌放在嘴前感受。",
    tip: "对比 가—카、다—타、바—파、자—차。",
    accent: "orange",
    items: [
      { letter: "ㅋ", sound: "카", romanization: "k", hint: "ㄱ 的送气音" },
      { letter: "ㅌ", sound: "타", romanization: "t", hint: "ㄷ 的送气音" },
      { letter: "ㅍ", sound: "파", romanization: "p", hint: "ㅂ 的送气音" },
      { letter: "ㅊ", sound: "차", romanization: "ch", hint: "ㅈ 的送气音" },
    ],
  },
  {
    number: "09",
    section: "2.6 紧音",
    title: "紧音：收紧后短促发出",
    lead: "紧音由两个相同的基础辅音并排组成。发音前先收紧喉部与发音器官，声音短促有力，但不要额外送气。",
    tip: "对比 가—까、다—따、바—빠、사—싸、자—짜。",
    accent: "orange",
    items: [
      { letter: "ㄲ", sound: "까", romanization: "kk", hint: "ㄱ 的紧音" },
      { letter: "ㄸ", sound: "따", romanization: "tt", hint: "ㄷ 的紧音" },
      { letter: "ㅃ", sound: "빠", romanization: "pp", hint: "ㅂ 的紧音" },
      { letter: "ㅆ", sound: "싸", romanization: "ss", hint: "ㅅ 的紧音" },
      { letter: "ㅉ", sound: "짜", romanization: "jj", hint: "ㅈ 的紧音" },
    ],
  },
  {
    number: "10",
    section: "2.7 元音与辅音组合",
    title: "把两类字母装进音节方块",
    lead: "竖向元音放在辅音右侧，横向元音放在辅音下方。虽然位置不同，朗读顺序始终是先辅音、后元音。",
    tip: "点击音节听读，再试着说出其中的辅音和元音。",
    accent: "green",
    items: [
      { letter: "가", sound: "가", romanization: "ㄱ + ㅏ", hint: "竖向元音放右侧" },
      { letter: "너", sound: "너", romanization: "ㄴ + ㅓ", hint: "竖向元音放右侧" },
      { letter: "모", sound: "모", romanization: "ㅁ + ㅗ", hint: "横向元音放下方" },
      { letter: "주", sound: "주", romanization: "ㅈ + ㅜ", hint: "横向元音放下方" },
      { letter: "위", sound: "위", romanization: "ㅇ + ㅟ", hint: "ㅇ 在开头不发音" },
    ],
  },
  {
    number: "11",
    section: "2.8 复习与自检",
    title: "看字形、听声音、说出类别",
    lead: "完成本章前，用三步检查自己：能否区分元音和辅音，能否听出基础音与送气音，能否把字母组合成音节。",
    tip: "随机点击卡片：先不看提示读一遍，再听示范音核对。",
    accent: "green",
    items: [
      { letter: "ㅑ", sound: "야", romanization: "元音", hint: "带 y 音的元音" },
      { letter: "ㄴ", sound: "나", romanization: "辅音", hint: "基础辅音" },
      { letter: "ㅋ", sound: "카", romanization: "辅音", hint: "送气音" },
      { letter: "ㅆ", sound: "싸", romanization: "辅音", hint: "紧音" },
      { letter: "와", sound: "와", romanization: "音节", hint: "ㅇ + ㅘ" },
      { letter: "파", sound: "파", romanization: "音节", hint: "ㅍ + ㅏ" },
    ],
  },
];

const Page = forwardRef<HTMLDivElement, PageProps>(function Page(
  { children, cover = false, goals = false, header, number },
  ref
) {
  return (
    <div ref={ref} className={`h-full overflow-hidden shadow-[inset_0_0_28px_rgba(57,78,67,0.08)] ${
      goals ? "bg-[linear-gradient(145deg,#edf8f3_0%,#e4f3ed_100%)]" : "bg-[#fffef9]"
    }`}>
      {cover ? children : (
        <div className="flex h-full flex-col px-9 py-8">
          <div className={`flex items-center justify-between border-b pb-3 text-[11px] font-black tracking-[0.12em] ${
            goals ? "border-[#bedbce]" : "border-[#dce8e1]"
          }`}>
            <span className="text-[#238777]">{header}</span>
            <span className="text-[#789087]">第二章 · 元音和辅音</span>
          </div>
          <div className="min-h-0 flex-1 pt-5">{children}</div>
          <div className={`mt-4 flex items-center justify-between border-t pt-3 text-[11px] font-bold text-[#92a099] ${
            goals ? "border-[#bedbce]" : "border-[#e4ebe7]"
          }`}>
            <span>互动电子书</span>
            <span>{number}</span>
          </div>
        </div>
      )}
    </div>
  );
});

function LessonContent({ page, onSpeak }: { page: LessonPage; onSpeak: (text: string) => void }) {
  const green = page.accent === "green";

  return (
    <div className="flex h-full flex-col">
      <h2 className="text-3xl font-black leading-tight text-[#173f4a]">{page.title}</h2>
      <p className="mt-4 text-sm leading-7 text-[#60736a]">{page.lead}</p>

      <div className={`mt-5 grid flex-1 content-center gap-3 ${page.items.length >= 6 ? "grid-cols-3" : "grid-cols-2"}`}>
        {page.items.map((item) => (
          <button
            key={`${page.number}-${item.letter}`}
            type="button"
            onClick={() => onSpeak(item.sound)}
            className={`group rounded-[22px] border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
              green ? "border-[#d5e7df] hover:border-[#72b7a7]" : "border-[#eadfce] hover:border-[#d6975f]"
            }`}
          >
            <span className="flex items-start justify-between gap-2">
              <span className={`text-4xl font-black ${green ? "text-[#238777]" : "text-[#9b5e2e]"}`}>{item.letter}</span>
              <Volume2 size={16} className={green ? "text-[#72b7a7]" : "text-[#d6975f]"} />
            </span>
            <span className="mt-3 block text-sm font-black text-[#294f43]">{item.romanization}</span>
            <span className="mt-1 block text-xs leading-5 text-[#7a8d84]">{item.hint}</span>
          </button>
        ))}
      </div>

      <div className={`mt-5 flex gap-3 rounded-2xl p-4 ${green ? "bg-[#e9f6f1] text-[#42675b]" : "bg-[#fff2e2] text-[#765c49]"}`}>
        <Lightbulb size={18} className="mt-0.5 shrink-0" />
        <p className="text-sm font-bold leading-6">{page.tip}</p>
      </div>
    </div>
  );
}

export function VowelsConsonantsBook({
  isFullscreen,
  speechRate = 1,
  initialPage = 0,
  onPageChange,
  onStartTest,
  testLocked,
  live,
}: {
  isFullscreen: boolean;
  speechRate?: number;
  initialPage?: number;
  onPageChange?: (page: number) => void;
  onStartTest: () => void;
  testLocked: boolean;
  /** 伴学课堂：远端翻页指令 + 画笔/批注覆盖层。 */
  live?: {
    page: number | null;
    overlay: React.ReactNode | null;
  };
}) {
  const containerRef = useRef<HTMLElement>(null);
  const flipBookRef = useRef<FlipBookHandle>(null);
  const speechTimerRef = useRef<number | null>(null);
  const speechRequestRef = useRef(0);
  const lastLivePageRef = useRef<number | null>(null);
  const [bookScale, setBookScale] = useState(1);

  // 伴学课堂：跟随远端翻页指令（防循环由课堂层 lastRemotePage 保证）。
  useEffect(() => {
    if (live?.page == null) return;
    if (live.page === lastLivePageRef.current) return;
    lastLivePageRef.current = live.page;
    flipBookRef.current?.pageFlip()?.flip(live.page);
  }, [live?.page]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let animationFrame = 0;
    const resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        const cap = isFullscreen ? MAX_BOOK_SCALE : 1;
        const nextScale = Math.min(
          container.clientWidth / BOOK_WIDTH,
          container.clientHeight / BOOK_HEIGHT,
          cap
        );
        setBookScale(Math.max(0.1, nextScale));
        flipBookRef.current?.pageFlip()?.update();
      });
    });
    resizeObserver.observe(container);
    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, [isFullscreen]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") flipBookRef.current?.pageFlip()?.flipPrev();
      if (event.key === "ArrowRight") flipBookRef.current?.pageFlip()?.flipNext();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => () => {
    if (speechTimerRef.current !== null) window.clearTimeout(speechTimerRef.current);
    window.speechSynthesis?.cancel();
  }, []);

  function speakKorean(text: string) {
    if (!("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const requestId = ++speechRequestRef.current;
    if (speechTimerRef.current !== null) window.clearTimeout(speechTimerRef.current);
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = speechRate;
    const voice = synth.getVoices().find((item) => item.lang.toLowerCase().startsWith("ko"));
    if (voice) utterance.voice = voice;
    speechTimerRef.current = window.setTimeout(() => {
      if (requestId === speechRequestRef.current) synth.speak(utterance);
    }, 60);
  }

  return (
    <section ref={containerRef} className="mt-0 flex h-full min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
      <div
        className={`relative shrink-0 ${isFullscreen ? "" : "-translate-y-2.5"}`}
        style={{ width: BOOK_WIDTH * bookScale, height: BOOK_HEIGHT * bookScale }}
      >
        <button
          type="button"
          onClick={() => flipBookRef.current?.pageFlip()?.flipPrev()}
          aria-label="电子书上一页"
          className="absolute left-[-58px] top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#cfe2d9] bg-white text-2xl font-black text-[#238777] shadow-lg"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => flipBookRef.current?.pageFlip()?.flipNext()}
          aria-label="电子书下一页"
          className="absolute right-[-58px] top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#cfe2d9] bg-white text-2xl font-black text-[#238777] shadow-lg"
        >
          →
        </button>

        <div className="absolute left-0 top-0 h-[822px] w-[1180px] origin-top-left" style={{ transform: `scale(${bookScale})` }}>
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
            useMouseEvents={true}
            showPageCorners={false}
            disableFlipByClick
            onFlip={(event) => onPageChange?.(event.data)}
            className="h-[822px] w-[1180px]"
            style={{}}
          >
            <Page number={0} cover>
              <div className="relative flex h-full flex-col justify-between overflow-hidden bg-[radial-gradient(circle_at_top_right,_#d8f0e7_0,_transparent_32%),linear-gradient(145deg,_#fffef9_0%,_#e8f6f0_100%)] px-10 py-11 text-center">
                <div aria-hidden="true" className="absolute bottom-0 left-0 right-0 h-[40%] bg-[#173f4a]" />
                <div className="relative">
                  <p className="text-2xl font-black tracking-[0.22em] text-[#b87131]">韩语字母入门</p>
                  <div className="mx-auto mt-2 h-px w-48 bg-[#cfe2d9]" />
                </div>
                <div className="relative">
                  <p className="text-base font-black tracking-[0.16em] text-[#238777]">第二章</p>
                  <h1 className="mt-5 text-5xl font-black tracking-tight text-[#173f4a]">元音和辅音</h1>
                  <p className="mt-4 text-lg font-bold text-[#60736a]">先听声音，再看动作</p>
                  <p className="mx-auto mt-7 max-w-sm text-base leading-8 text-[#60736a]">
                    用口型认识元音，用发音部位认识辅音，再把它们组合成完整音节。
                  </p>
                  <div className="mt-16 flex justify-center gap-4">
                    {["ㅏ", "ㄱ", "가"].map((letter, index) => (
                      <span key={letter} className={`flex h-16 w-16 items-center justify-center rounded-2xl text-3xl font-black ${index === 2 ? "bg-[#238777] text-white" : "bg-white text-[#238777] shadow-sm ring-1 ring-[#d7e8e1]"}`}>
                        {letter}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="relative flex items-center justify-between text-sm font-bold text-white/80">
                  <span className="inline-flex items-center gap-2"><Headphones size={16} />互动电子书</span>
                  <span>10 个学习主题</span>
                </div>
              </div>
            </Page>

            <Page number="00" header="目录">
              <div className="flex h-full flex-col justify-center text-center">
                <p className="text-xs font-black tracking-[0.18em] text-[#238777]">第二章</p>
                <h2 className="mt-3 text-3xl font-black text-[#173f4a]">目录</h2>
                <ol className="mt-8 divide-y divide-[#dce8e1] rounded-2xl border border-[#dce8e1] bg-white px-5 text-left">
                  {[
                    [1, "本章学习目标"],
                    [2, "2.1 元音和辅音是什么"],
                    [3, "2.2 基本元音"],
                    [5, "2.3 复合元音"],
                    [6, "2.4 基本辅音"],
                    [8, "2.5 送气音"],
                    [9, "2.6 紧音"],
                    [10, "2.7 元音与辅音组合"],
                    [11, "2.8 复习与自检"],
                    [12, "2.9 本章结束"],
                  ].map(([pageNumber, title]) => (
                    <li key={pageNumber}>
                      <button
                        type="button"
                        onClick={() => flipBookRef.current?.pageFlip()?.flip(Number(pageNumber) + 1)}
                        className="flex w-full items-center justify-between py-3 text-left text-sm font-bold text-[#526c60] transition hover:text-[#238777]"
                      >
                        <span>{title}</span>
                        <span className="font-black text-[#238777]">{String(pageNumber).padStart(2, "0")}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            </Page>

            <Page number="01" header="本章学习目标" goals>
              <div className="flex h-full flex-col">
                <p className="text-xs font-black tracking-[0.18em] text-[#238777]">第二章 · GOALS</p>
                <h2 className="mt-3 text-3xl font-black text-[#173f4a]">学完这一章，你将能够</h2>
                <p className="mt-4 text-sm leading-7 text-[#60736a]">
                  从口型、舌位和气流出发认识元音与辅音，并把字形、声音和发音动作建立稳定联系。
                </p>
                <div className="mt-7 grid flex-1 content-center gap-4">
                  {[
                    ["01", "辨认元音和辅音", "能看字形判断字母类别，并说出常用字母的基本读音。"],
                    ["02", "掌握发音动作", "能通过口型、舌位与气流区分基本音、送气音和紧音。"],
                    ["03", "完成音节组合", "能把辅音和元音放进正确位置，拼读简单的韩语音节。"],
                  ].map(([number, title, description]) => (
                    <section key={number} className="grid grid-cols-[54px_1fr] gap-4 rounded-[22px] border border-[#dce8e1] bg-white p-5">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e7f4ef] text-sm font-black text-[#238777]">{number}</span>
                      <div>
                        <h3 className="text-base font-black text-[#294f43]">{title}</h3>
                        <p className="mt-1 text-xs leading-6 text-[#71857b]">{description}</p>
                      </div>
                    </section>
                  ))}
                </div>
                <div className="mt-6 rounded-2xl bg-[#fff3e3] p-4 text-sm font-bold leading-6 text-[#765c49]">
                  阅读建议：每学一个字母，都要完成“看字形、听声音、跟读三遍”。
                </div>
              </div>
            </Page>

            {LESSON_PAGES.map((page) => (
              <Page key={page.number} number={page.number} header={page.section}>
                <LessonContent page={page} onSpeak={speakKorean} />
              </Page>
            ))}

            <Page number="12" header="2.9 本章结束">
              <div className="relative flex h-full flex-col items-center justify-center overflow-hidden text-center">
                <div aria-hidden="true" className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#e4f3ed]" />
                <div aria-hidden="true" className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-[#fff0dc]" />
                <div className="relative">
                  <p className="text-sm font-black tracking-[0.2em] text-[#b87131]">第二章完成</p>
                  <h2 className="mt-5 text-4xl font-black text-[#173f4a]">元音和辅音学习完成</h2>
                  <p className="mx-auto mt-5 max-w-md text-base leading-8 text-[#60736a]">
                    你已经认识了基本元音、复合元音、基础辅音、送气音和紧音。接下来通过本章测试检查自己是否真正掌握。
                  </p>

                  <div className="mx-auto mt-9 grid max-w-md grid-cols-3 gap-3">
                    {[
                      ["ㅏ", "元音"],
                      ["ㄱ", "辅音"],
                      ["가", "音节"],
                    ].map(([letter, label]) => (
                      <div key={letter} className="rounded-2xl border border-[#d8e7e0] bg-white p-4 shadow-sm">
                        <p className="text-3xl font-black text-[#238777]">{letter}</p>
                        <p className="mt-2 text-xs font-bold text-[#789087]">{label}</p>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={onStartTest}
                    disabled={testLocked}
                    title={testLocked ? "完成本章学习目标后解锁测试" : undefined}
                    className="mt-10 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#238777] px-8 py-4 text-base font-black text-white shadow-lg transition enabled:hover:-translate-y-0.5 enabled:hover:bg-[#1d7468] disabled:cursor-not-allowed disabled:bg-[#a9afa9] disabled:shadow-none"
                  >
                    {testLocked && <Lock size={17} />}
                    进入本章测试
                  </button>
                  <p className="mt-4 text-xs font-bold text-[#8a9b93]">
                    {testLocked ? "完成本章学习目标后解锁测试" : "完成测试后将解锁下一章"}
                  </p>
                </div>
              </div>
            </Page>

          </HTMLFlipBook>
          {live?.overlay}
        </div>
      </div>
    </section>
  );
}
