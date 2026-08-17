"use client";

import dynamic from "next/dynamic";

const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false });
import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  CloudRain,
  CloudSun,
  Headphones,
  Languages,
  Mic2,
  NotebookPen,
  Radio,
  Scale,
  Sparkles,
  Sun,
  Volume2,
} from "lucide-react";

import {
  buildKoreanEbookSectionMap,
  KoreanEbookCover,
  KoreanEbookHeading,
  KoreanEbookPage,
  KoreanEbookRevealButton,
  KoreanEbookSectionDivider,
  KoreanEbookSpeakButton,
  KoreanEbookTableOfContents,
  KoreanEbookTestLink,
  KoreanEbookVocabularyCard,
} from "./KoreanLevelOneBookTemplate";
import type { KoreanLevelOneLesson } from "./KoreanLevelOneLessonBook";

const BOOK_WIDTH = 1180;
const BOOK_HEIGHT = 822;

type Speak = (text: string) => void;
type Word = { korean: string; type: string; chinese: string };
type Line = { speaker: string; korean: string; chinese: string };
type FlipBookHandle = {
  pageFlip: () =>
    | { flip: (page: number) => void; flipNext: () => void; flipPrev: () => void }
    | undefined;
};

const TEMPLATE = buildKoreanEbookSectionMap([
  { step: "第一步", label: "课前导航", dividerPage: 2, contentPages: [3] },
  { step: "第二步", label: "核心词汇", dividerPage: 4, contentPages: [5, 6, 7, 8] },
  { step: "第三步", label: "语法讲解", dividerPage: 9, contentPages: [10, 11, 12, 13] },
  { step: "第四步", label: "句型操练", dividerPage: 14, contentPages: [15, 16, 17] },
  { step: "第五步", label: "实战对话", dividerPage: 18, contentPages: [19, 20, 21] },
  { step: "第六步", label: "听说任务", dividerPage: 22, contentPages: [23, 24, 25] },
  { step: "第七步", label: "读写拓展", dividerPage: 26, contentPages: [27, 28] },
  { step: "第八步", label: "自测与复盘", dividerPage: 29, contentPages: [30, 31, 32, 33, 34] },
]);

const Page = forwardRef<
  HTMLDivElement,
  { children: ReactNode; number: string; cover?: boolean }
>(function Page({ children, number, cover = false }, ref) {
  return (
    <KoreanEbookPage
      ref={ref}
      number={number}
      header={TEMPLATE.headers[number] ?? "第 7 课 · 날씨가 어때요?"}
      cover={cover}
      sectionMeta={TEMPLATE.pageMeta[number]}
      hideContentOverflow
    >
      {children}
    </KoreanEbookPage>
  );
});

function Heading({
  page,
  title,
  description,
  icon,
  action,
}: {
  page: string;
  title: string;
  description: string;
  icon: ReactNode;
  action?: ReactNode;
}) {
  return (
    <KoreanEbookHeading
      step={TEMPLATE.pageMeta[page]?.tag ?? "第八步"}
      title={title}
      description={description}
      icon={icon}
      action={action}
    />
  );
}

function Note({
  title,
  children,
  color = "blue",
}: {
  title: string;
  children: ReactNode;
  color?: "blue" | "rose" | "green" | "amber";
}) {
  const tones = {
    blue: "border-[var(--border)] bg-[var(--accent)] text-[var(--primary)]",
    rose: "border-[var(--border)] bg-[var(--card)] text-[var(--destructive)]",
    green: "border-[var(--border)] bg-[var(--status-success-surface)] text-[var(--status-success)]",
    amber: "border-[var(--border)] bg-[var(--status-warning-surface)] text-[var(--status-warning)]",
  };
  return (
    <section className={`mt-4 rounded-2xl border p-4 ${tones[color]}`}>
      <p className="text-[11px] font-bold">{title}</p>
      <div className="mt-2 text-xs font-bold leading-6 text-[var(--foreground-secondary)]">{children}</div>
    </section>
  );
}

function WordGrid({ items, speak, showChinese }: { items: Word[]; speak: Speak; showChinese: boolean }) {
  const dense = items.length > 12 || items.some((item) => item.korean.length > 9);
  return (
    <div className={`mt-4 grid grid-cols-3 ${dense ? "gap-2" : "gap-3"} ${showChinese ? "" : "[&_[data-vocab-meaning]]:opacity-0"}`}>
      {items.map((item) => (
        <KoreanEbookVocabularyCard
          key={`${item.korean}-${item.type}-${item.chinese}`}
          {...item}
          onSpeak={speak}
          compact={dense}
        />
      ))}
    </div>
  );
}

function RuleSentence({ children, text, speak }: { children: ReactNode; text: string; speak: Speak }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="min-w-0">{children}</span>
      <KoreanEbookSpeakButton text={text} onSpeak={speak} compact />
    </div>
  );
}

function Dialogue({ lines, speak, showChinese }: { lines: Line[]; speak: Speak; showChinese: boolean }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      {lines.map((line, index) => (
        <div
          key={`${index}-${line.speaker}-${line.korean}`}
          className={`flex gap-2.5 rounded-xl p-3.5 ${
            index % 2 ? "bg-[var(--status-warning-surface)]" : "bg-[var(--status-success-surface)]"
          }`}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold">
            {line.speaker}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold leading-5">{line.korean}</p>
            <p className={`mt-0.5 text-[10px] font-bold leading-4 text-[var(--foreground-secondary)] ${showChinese ? "opacity-100" : "opacity-0"}`}>{line.chinese}</p>
          </div>
          <KoreanEbookSpeakButton text={line.korean} onSpeak={speak} compact />
        </div>
      ))}
    </div>
  );
}

const seasonWords: Word[] = [
  { korean: "봄", type: "季节名词", chinese: "春天" },
  { korean: "여름", type: "季节名词", chinese: "夏天" },
  { korean: "가을", type: "季节名词", chinese: "秋天" },
  { korean: "겨울", type: "季节名词", chinese: "冬天" },
  { korean: "따뜻하다", type: "形容词", chinese: "温暖" },
  { korean: "덥다", type: "形容词", chinese: "热" },
  { korean: "시원하다", type: "形容词", chinese: "凉爽" },
  { korean: "춥다", type: "形容词", chinese: "冷" },
  { korean: "계절", type: "名词", chinese: "季节" },
  { korean: "날씨", type: "名词", chinese: "天气" },
  { korean: "기온", type: "名词", chinese: "气温" },
  { korean: "온도", type: "名词", chinese: "温度" },
];

const weatherWords: Word[] = [
  { korean: "맑다", type: "形容词", chinese: "晴朗" },
  { korean: "흐리다", type: "形容词", chinese: "阴天" },
  { korean: "비가 오다", type: "天气表达", chinese: "下雨" },
  { korean: "눈이 오다", type: "天气表达", chinese: "下雪" },
  { korean: "바람이 불다", type: "天气表达", chinese: "刮风" },
  { korean: "구름이 많다", type: "天气表达", chinese: "多云" },
  { korean: "비", type: "天气名词", chinese: "雨" },
  { korean: "눈", type: "天气名词", chinese: "雪" },
  { korean: "바람", type: "天气名词", chinese: "风" },
  { korean: "구름", type: "天气名词", chinese: "云" },
  { korean: "오늘", type: "时间名词", chinese: "今天" },
  { korean: "내일", type: "时间名词", chinese: "明天" },
  { korean: "아침", type: "时间名词", chinese: "早晨" },
  { korean: "낮", type: "时间名词", chinese: "白天" },
  { korean: "밤", type: "时间名词", chinese: "夜晚" },
];

const irregularWords: Word[] = [
  { korean: "춥다 → 추워요", type: "ㅂ不规则形容词", chinese: "冷" },
  { korean: "덥다 → 더워요", type: "ㅂ不规则形容词", chinese: "热" },
  { korean: "쉽다 → 쉬워요", type: "ㅂ不规则形容词", chinese: "容易" },
  { korean: "어렵다 → 어려워요", type: "ㅂ不规则形容词", chinese: "困难" },
  { korean: "맵다 → 매워요", type: "ㅂ不规则形容词", chinese: "辣" },
  { korean: "싱겁다 → 싱거워요", type: "ㅂ不规则形容词", chinese: "淡" },
  { korean: "무겁다 → 무거워요", type: "ㅂ不规则形容词", chinese: "重" },
  { korean: "가볍다 → 가벼워요", type: "ㅂ不规则形容词", chinese: "轻" },
  { korean: "돕다 → 도와요", type: "ㅂ不规则动词", chinese: "帮助（오型）" },
  { korean: "곱다 → 고와요", type: "ㅂ不规则形容词", chinese: "美丽（오型）" },
  { korean: "입다 → 입어요", type: "规则动词", chinese: "穿（保留ㅂ）" },
  { korean: "잡다 → 잡아요", type: "规则动词", chinese: "抓（保留ㅂ）" },
];

const compareWords: Word[] = [
  { korean: "크다", type: "形容词", chinese: "大" },
  { korean: "작다", type: "形容词", chinese: "小" },
  { korean: "비싸다", type: "形容词", chinese: "贵" },
  { korean: "싸다", type: "形容词", chinese: "便宜" },
  { korean: "좋다", type: "形容词", chinese: "好" },
  { korean: "나쁘다", type: "形容词", chinese: "坏" },
  { korean: "길다", type: "形容词", chinese: "长" },
  { korean: "짧다", type: "形容词", chinese: "短" },
  { korean: "높다", type: "形容词", chinese: "高" },
  { korean: "낮다", type: "形容词", chinese: "低" },
  { korean: "같다", type: "形容词", chinese: "相同" },
  { korean: "다르다", type: "形容词", chinese: "不同" },
];

const dividers: Record<string, { step: string; title: string; goal: string; icon: ReactNode }> = {
  "02": { step: "第一步", title: "课前导航", goal: "从日常问答走向正式天气播报：描述天气、比较季节，并根据场合切换句尾。", icon: <CloudSun aria-hidden="true" size={24} /> },
  "04": { step: "第二步", title: "核心词汇", goal: "把季节和典型天气绑定记忆，再用成对形容词建立比较网络。", icon: <Sun aria-hidden="true" size={24} /> },
  "09": { step: "第三步", title: "语法讲解", goal: "每个语法独占一页，掌握结构、规则、使用场景和常见错误。", icon: <NotebookPen aria-hidden="true" size={24} /> },
  "14": { step: "第四步", title: "句型操练", goal: "识别后接词尾是元音还是辅音，再决定 ㅂ 是否脱落。", icon: <Languages aria-hidden="true" size={24} /> },
  "18": { step: "第五步", title: "实战对话", goal: "完成询问、描述、比较、计划和建议；每组对话不少于八句。", icon: <Mic2 aria-hidden="true" size={24} /> },
  "22": { step: "第六步", title: "听说任务", goal: "从关键词听辨到正式播报，输出时间、天气变化和出行建议。", icon: <Radio aria-hidden="true" size={24} /> },
  "26": { step: "第七步", title: "读写拓展", goal: "读懂生活化天气预报，写出有季节特征、转折和正式体的原创短文。", icon: <BookOpenCheck aria-hidden="true" size={24} /> },
  "29": { step: "第八步", title: "自测与复盘", goal: "检查词汇、ㅂ变化、连接词、正式体和八句综合表达。", icon: <CheckCircle2 aria-hidden="true" size={24} /> },
};

export function KoreanLevelOneLessonSevenBook({
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
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setRevealed((current) => ({ ...current, [key]: !current[key] }));
  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = speechRate;
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    const resize = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setScale(Math.min((rect.width - 34) / BOOK_WIDTH, (rect.height - 28) / BOOK_HEIGHT, isFullscreen ? 1 : 0.86));
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isFullscreen]);

  const page = (number: string, title: string, description: string, icon: ReactNode, body: ReactNode, action?: ReactNode) => (
    <Page key={`07-${number}`} number={number}>
      <div className="flex h-full flex-col">
        <Heading page={number} title={title} description={description} icon={icon} action={action} />
        {body}
      </div>
    </Page>
  );

  const pages: ReactNode[] = [
    <Page key="07-01" number="01">
      <KoreanEbookTableOfContents lessonNumber={7} pageMeta={TEMPLATE.pageMeta} onNavigate={(target) => flipBookRef.current?.pageFlip()?.flip(target)} entries={[
        { step: "01", title: "课前导航", pageRange: "02—03", detail: "建立天气播报任务" },
        { step: "02", title: "核心词汇", pageRange: "04—08", detail: "季节·天气·不规则·对比" },
        { step: "03", title: "语法讲解", pageRange: "09—13", detail: "ㅂ变化·转折·正式体·并列" },
        { step: "04", title: "句型操练", pageRange: "14—17", detail: "看词尾完成转换" },
        { step: "05", title: "实战对话", pageRange: "18—21", detail: "三组八句交流" },
        { step: "06", title: "听说任务", pageRange: "22—25", detail: "听懂并制作播报" },
        { step: "07", title: "读写拓展", pageRange: "26—28", detail: "读预报·写季节" },
        { step: "08", title: "自测与复盘", pageRange: "29—34", detail: "综合验收" },
      ]} />
    </Page>,
  ];

  for (const number of ["02", "04", "09", "14", "18", "22", "26", "29"]) {
    const item = dividers[number];
    pages.push(<Page key={`07-${number}`} number={number}><KoreanEbookSectionDivider {...item} /></Page>);
  }

  pages.push(
    page("03", "今天的天气任务", "同一条天气信息，要学会用日常体交流，也要能改写成正式播报体。", <CloudSun aria-hidden="true" size={22} />,
      <><div className="mt-5 grid grid-cols-2 gap-3">{[
        ["오늘 날씨가 어때요?", "今天天气怎么样？"],
        ["맑고 따뜻해요.", "晴朗而且温暖。"],
        ["낮은 덥지만 밤은 시원해요.", "白天热，但是夜晚凉爽。"],
        ["내일은 비가 옵니다.", "明天有雨（正式播报）。"],
      ].map(([korean, chinese]) => <button key={korean} type="button" onClick={() => speak(korean)} className="rounded-2xl border border-[var(--border)] bg-white p-4 text-left"><div className="mt-2 flex items-center justify-between gap-2"><p className="text-sm font-bold">{korean}</p><Volume2 aria-hidden="true" size={14} className="shrink-0 text-[var(--primary)]"/></div><p className={`mt-1 text-[11px] font-bold text-[var(--foreground-secondary)] ${revealed.chinese03 ? "opacity-100" : "opacity-0"}`}>{chinese}</p></button>)}</div>
      <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[10px] font-bold">{[["①","提问"],["②","并列描述"],["③","比较反差"],["④","正式播报"]].map(([index,label]) => <div key={index} className="rounded-xl bg-[var(--status-warning-surface)] px-2 py-3"><span className="text-[var(--status-warning)]">{index}</span><p className="mt-1">{label}</p></div>)}</div>
      <p className="mt-3 rounded-xl border border-dashed border-[var(--border)] px-4 py-3 text-xs font-bold text-[var(--status-warning)]">先描述“现在”，再说“变化”，最后根据天气给出准备建议。</p>
      <Note title="最终产出" color="amber">完成至少八句天气交流，并独立播报“今天—明天—出行建议”三部分信息。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese03)} onClick={() => toggle("chinese03")} />),
    page("05", "1. 四季与温度", "先记固定搭配，再替换城市和时间。", <Sun aria-hidden="true" size={22} />, <><WordGrid items={seasonWords} speak={speak} showChinese={Boolean(revealed.chinese05)} /><Note title="四季记忆链">봄은 따뜻해요 → 여름은 더워요 → 가을은 시원해요 → 겨울은 추워요.</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese05)} onClick={() => toggle("chinese05")} />),
    page("06", "2. 天空与降水", "韩语常用“名词 + 이/가 + 动词”描述天气现象。", <CloudRain aria-hidden="true" size={22} />, <><WordGrid items={weatherWords} speak={speak} showChinese={Boolean(revealed.chinese06)} /><Note title="搭配意识" color="green">비가 와요（下雨）、눈이 와요（下雪）、바람이 불어요（刮风）。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese06)} onClick={() => toggle("chinese06")} />),
    page("07", "3. ㅂ 结尾词家族", "不是所有 ㅂ 结尾词都不规则；先分“会脱落”和“保持原样”。", <Languages aria-hidden="true" size={22} />, <><WordGrid items={irregularWords} speak={speak} showChinese={Boolean(revealed.chinese07)} /><Note title="规则例外" color="rose">입다、잡다、좁다等遇到元音词尾时仍保留 ㅂ。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese07)} onClick={() => toggle("chinese07")} />),
    page("08", "4. 对比形容词", "成对记忆，快速完成季节、城市和物品比较。", <Scale aria-hidden="true" size={22} />, <><WordGrid items={compareWords} speak={speak} showChinese={Boolean(revealed.chinese08)} /><Note title="组合输出">여름은 길고 겨울은 짧아요.　서울은 크지만 우리 고향은 작아요.</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese08)} onClick={() => toggle("chinese08")} />),
    page("10", "1. ㅂ 불규칙", "部分 ㅂ 结尾词遇到元音词尾时，ㅂ 脱落并添加 우；돕다、곱다少数词变为 오。", <Languages aria-hidden="true" size={22} />,
      <><div className="mt-4 grid grid-cols-3 gap-3">{[["춥다","추우 + 어요","추워요"],["덥다","더우 + 어요","더워요"],["어렵다","어려우 + 어요","어려워요"],["맵다","매우 + 어요","매워요"],["돕다","도오 + 아요","도와요"],["입다","입 + 어요","입어요"]].map(([base,middle,result]) => <article key={base} className="rounded-2xl border border-[var(--border)] bg-white p-3"><RuleSentence text={base} speak={speak}><b>{base}</b></RuleSentence><RuleSentence text={middle.replace(" + ", " ")} speak={speak}><span className="text-[10px] text-[var(--primary)]">{middle}</span></RuleSentence><RuleSentence text={result} speak={speak}><strong className="text-sm text-[var(--primary)]">{result}</strong></RuleSentence></article>)}</div>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 rounded-2xl bg-[var(--accent)] p-4 text-center text-xs font-bold"><span>是不是<br/>ㅂ 不规则词？</span><span className="text-[var(--primary)]">→</span><span>词尾是否<br/>以元音开始？</span><span className="text-[var(--primary)]">→</span><span className="text-[var(--primary)]">是：ㅂ → 우/오<br/>否：保留 ㅂ</span></div>
      <p className="mt-3 rounded-xl border border-dashed border-[var(--border)] px-4 py-3 text-xs font-bold"><button type="button" onClick={() => speak("겨울은 추워요. 하지만 옷을 입어요.")} className="text-[var(--primary)] underline decoration-dotted">겨울은 추워요. 하지만 옷을 입어요.</button>：춥다变化，입다保持规则。</p>
      <Note title="照妖镜" color="rose">元音词尾触发变化：추워요。辅音词尾保持原样：춥지만、춥고、춥습니다。</Note></>),
    page("11", "2. A/V-지만", "词干直接加 -지만，连接意义相反或形成反差的两个分句。", <Scale aria-hidden="true" size={22} />,
      <><div className="mt-5 rounded-2xl bg-[var(--card)] p-5"><p className="text-center text-sm font-bold">前项事实 <span className="mx-3 text-[var(--primary)]">+ 지만 +</span> 后项反差</p><div className="mx-auto mt-4 max-w-sm"><RuleSentence text="여름은 덥지만 겨울은 추워요." speak={speak}><span className="text-xl font-bold">여름은 덥지만 겨울은 추워요.</span></RuleSentence></div><p className="mt-2 text-center text-xs text-[var(--foreground-secondary)]">夏天热，但是冬天冷。</p></div><div className="mt-4 grid grid-cols-2 gap-3"><Note title="形容词"><RuleSentence text="비싸지만" speak={speak}>비싸지만</RuleSentence><RuleSentence text="좋지만" speak={speak}>좋지만</RuleSentence><RuleSentence text="춥지만" speak={speak}>춥지만</RuleSentence></Note><Note title="动词" color="green"><RuleSentence text="가지만" speak={speak}>가지만</RuleSentence><RuleSentence text="먹지만" speak={speak}>먹지만</RuleSentence><RuleSentence text="공부하지만" speak={speak}>공부하지만</RuleSentence></Note></div><p className="mt-3 rounded-xl bg-[var(--card)] px-4 py-3 text-xs font-bold">后项通常是说话人更想强调的信息：비싸지만 좋아요（贵，但是好）。</p><Note title="易错点" color="rose">❌ 추워지만　✅ 춥지만。-지만 以辅音 ㅈ 开始，ㅂ 不脱落。</Note></>),
    page("12", "3. A/V-습니다／ㅂ니다", "正式敬语终结词尾，用于播音、报告、演讲和正式服务场合。", <Radio aria-hidden="true" size={22} />,
      <><div className="mt-4 grid grid-cols-2 gap-3">{[["无收音 + ㅂ니다","오다 → 옵니다","크다 → 큽니다"],["有收音 + 습니다","작다 → 작습니다","맑다 → 맑습니다"],["ㅂ 不规则保持原样","춥다 → 춥습니다","덥다 → 덥습니다"],["하다 → 합니다","따뜻하다 → 따뜻합니다","공부하다 → 공부합니다"]].map(([title,a,b]) => <article key={title} className="rounded-2xl border border-[var(--border)] bg-white p-4"><b className="text-[var(--primary)]">{title}</b><div className="mt-3 text-sm font-bold"><RuleSentence text={a.replace(" → ", ". ")} speak={speak}>{a}</RuleSentence><RuleSentence text={b.replace(" → ", ". ")} speak={speak}>{b}</RuleSentence></div></article>)}</div>
      <section className="mt-4 rounded-2xl bg-[var(--accent)] p-4"><p className="text-[11px] font-bold text-[var(--primary)]">播报句尾配套</p><div className="mt-2 grid grid-cols-2 gap-3 text-xs font-bold"><RuleSentence text="오늘은 맑습니다." speak={speak}>陈述：오늘은 맑습니다.</RuleSentence><RuleSentence text="날씨가 어떻습니까?" speak={speak}>提问：날씨가 어떻습니까?</RuleSentence></div></section>
      <Note title="语体统一" color="amber">一段播报统一使用正式体；朋友聊天统一使用 -아/어요，不要半途切换。</Note></>),
    page("13", "4. A/V-고", "接形容词表示状态并存，接动词表示动作先后或并列。", <BookOpenCheck aria-hidden="true" size={22} />,
      <><div className="mt-5 space-y-3">{[["状态 + 状态","이 가방은 싸고 가벼워요.","这个包又便宜又轻。"],["天气 + 天气","오늘은 맑고 따뜻해요.","今天晴朗而且温暖。"],["动作 + 动作","아침을 먹고 학교에 가요.","吃完早饭去学校。"]].map(([kind,korean,chinese]) => <article key={kind} className="rounded-2xl border border-[var(--border)] bg-white p-4"><b className="text-[11px] text-[var(--primary)]">{kind}</b><div className="mt-2 text-base font-bold"><RuleSentence text={korean} speak={speak}>{korean}</RuleSentence></div><p className="mt-1 text-xs text-[var(--foreground-secondary)]">{chinese}</p></article>)}</div><div className="grid grid-cols-2 gap-3"><Note title="-고：信息相加" color="green"><RuleSentence text="맑고 따뜻해요." speak={speak}>맑고 따뜻해요.</RuleSentence></Note><Note title="-지만：信息转折" color="rose"><RuleSentence text="맑지만 추워요." speak={speak}>맑지만 추워요.</RuleSentence></Note></div></>),
    page("15", "1. ㅂ 不规则“照妖镜”", "横向比较同一个词遇到四种词尾时的形态。", <Sparkles aria-hidden="true" size={22} />,
      <><div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)]"><div className="grid grid-cols-5 bg-[var(--card)] p-3 text-center text-[11px] font-bold"><span>基本形</span><span>-어요</span><span>-지만</span><span>-고</span><span>-습니다</span></div>{[["춥다","추워요","춥지만","춥고","춥습니다"],["덥다","더워요","덥지만","덥고","덥습니다"],["어렵다","어려워요","어렵지만","어렵고","어렵습니다"],["가볍다","가벼워요","가볍지만","가볍고","가볍습니다"]].map(row => <div key={row[0]} className="grid grid-cols-5 border-t border-[var(--border)] p-3 text-center text-xs font-bold">{row.map((cell,index) => <span key={`${row[0]}-${index}`} className={`${index === 1 ? "text-[var(--destructive)]" : ""} ${index > 0 && !revealed.forms ? "opacity-0" : "opacity-100"}`}>{cell}</span>)}</div>)}</div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-bold">{[["오늘은 추워요.","今天很冷。"],["춥지만 산책해요.","虽然冷，但去散步。"],["춥고 바람이 불어요.","天气冷而且刮风。"],["내일은 춥습니다.","明天寒冷（正式体）。"]].map(([korean,chinese]) => <button key={korean} type="button" onClick={() => speak(korean)} className="rounded-xl bg-[var(--card)] p-3 text-left"><span>{korean}</span><p className="mt-1 text-[10px] text-[var(--foreground-secondary)]">{chinese}</p></button>)}</div>
      <Note title="判断秘诀" color="rose">本页只有 -어요 触发脱落；其余三个词尾均以辅音开始，ㅂ 必须保留。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.forms)} onClick={() => toggle("forms")} answer />),
    page("16", "2. 日常体 → 正式体", "把朋友间天气对话改写成电视或课堂播报。", <Radio aria-hidden="true" size={22} />,
      <><div className="mt-4 space-y-2.5">{[["오늘 날씨가 좋아요.","오늘 날씨가 좋습니다."],["비가 와요.","비가 옵니다."],["날씨가 추워요.","날씨가 춥습니다."],["하늘이 맑아요.","하늘이 맑습니다."],["바람이 불어요.","바람이 붑니다."],["내일은 더워요.","내일은 덥습니다."]].map(([casual,formal]) => <article key={casual} className="grid grid-cols-[1fr_30px_1fr] items-center rounded-xl border border-[var(--border)] bg-white p-3 text-sm font-bold"><RuleSentence text={casual} speak={speak}>{casual}</RuleSentence><span className="text-[var(--status-warning)]">→</span><span className={revealed.formal ? "opacity-100" : "opacity-0"}><RuleSentence text={formal} speak={speak}>{formal}</RuleSentence></span></article>)}</div><Note title="不要机械追加">오다 → 옵니다、불다 → 붑니다；正式体要从词干开始连接。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.formal)} onClick={() => toggle("formal")} answer />),
    page("17", "3. -고 还是 -지만？", "判断两条信息是并列补充，还是形成意外反差。", <Scale aria-hidden="true" size={22} />,
      <><div className="mt-4 grid grid-cols-2 gap-3">{[["봄은 따뜻하고 꽃이 많아요.","并列：고"],["오늘은 맑지만 추워요.","反差：지만"],["가방이 싸고 가벼워요.","并列：고"],["한국어는 어렵지만 재미있어요.","反差：지만"],["비가 오고 바람이 불어요.","并列：고"],["여름은 덥지만 좋아해요.","反差：지만"]].map(([sentence,hint]) => <article key={sentence} className="rounded-2xl border border-[var(--border)] bg-white p-4"><p className={`text-[10px] font-bold text-[var(--status-warning)] ${revealed.connector ? "opacity-100" : "opacity-0"}`}>{hint}</p><div className="mt-2 text-sm font-bold"><RuleSentence text={sentence} speak={speak}>{sentence}</RuleSentence></div></article>)}</div><div className="mt-4 grid grid-cols-2 gap-3 text-xs font-bold"><p className="rounded-xl bg-[var(--status-warning-surface)] p-3">信息同方向、同时成立 → <span className="text-[var(--status-warning)]">-고</span></p><p className="rounded-xl bg-[var(--status-warning-surface)] p-3">后项与预期形成反差 → <span className="text-[var(--status-warning)]">-지만</span></p></div><Note title="表达者的选择" color="amber">关键不是词汇，而是你想表达“相加”还是“转折”。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.connector)} onClick={() => toggle("connector")} answer />),
  );

  const dialogues: Array<[string, string, string, ReactNode, Line[]]> = [
    ["19","场景 1 · 出门前看天气","根据今天的天气决定携带物品。",<CloudRain aria-hidden="true" key="dialogue-19" size={22}/>,[
      {speaker:"敏",korean:"오늘 날씨가 어때요?",chinese:"今天天气怎么样？"},{speaker:"俊",korean:"아침에는 맑고 따뜻해요.",chinese:"早晨晴朗而且温暖。"},
      {speaker:"敏",korean:"오후에도 따뜻해요?",chinese:"下午也暖和吗？"},{speaker:"俊",korean:"아니요. 오후에는 비가 와요.",chinese:"不，下午会下雨。"},
      {speaker:"敏",korean:"비가 많이 와요?",chinese:"雨下得大吗？"},{speaker:"俊",korean:"비는 많이 오지 않지만 바람이 불어요.",chinese:"雨不大，但是会刮风。"},
      {speaker:"敏",korean:"그럼 우산을 가지고 갈게요.",chinese:"那我带伞去。"},{speaker:"俊",korean:"밤에는 추우니까 겉옷도 입으세요.",chinese:"夜里冷，也请穿外套。"},
    ]],
    ["20","场景 2 · 比较两个季节","使用 -고 与 -지만表达共同点和反差。",<Sun aria-hidden="true" key="dialogue-20" size={22}/>,[
      {speaker:"安",korean:"어느 계절을 좋아해요?",chinese:"你喜欢哪个季节？"},{speaker:"美",korean:"저는 가을을 좋아해요.",chinese:"我喜欢秋天。"},
      {speaker:"安",korean:"왜 가을을 좋아해요?",chinese:"为什么喜欢秋天？"},{speaker:"美",korean:"날씨가 시원하고 하늘이 맑아요.",chinese:"天气凉爽，天空也晴朗。"},
      {speaker:"安",korean:"겨울은 어때요?",chinese:"冬天怎么样？"},{speaker:"美",korean:"눈은 예쁘지만 날씨가 너무 추워요.",chinese:"雪很美，但是天气太冷。"},
      {speaker:"安",korean:"저는 춥지만 겨울도 좋아해요.",chinese:"虽然冷，我也喜欢冬天。"},{speaker:"美",korean:"그럼 겨울에 같이 여행해요.",chinese:"那我们冬天一起旅行吧。"},
    ]],
    ["21","场景 3 · 正式天气连线","播报员和记者统一使用正式体。",<Radio aria-hidden="true" key="dialogue-21" size={22}/>,[
      {speaker:"播",korean:"서울의 날씨는 어떻습니까?",chinese:"首尔的天气怎么样？"},{speaker:"记",korean:"현재 서울은 맑고 따뜻합니다.",chinese:"目前首尔晴朗温暖。"},
      {speaker:"播",korean:"부산도 맑습니까?",chinese:"釜山也晴朗吗？"},{speaker:"记",korean:"부산은 흐리고 비가 옵니다.",chinese:"釜山阴天并下雨。"},
      {speaker:"播",korean:"기온은 어떻습니까?",chinese:"气温怎么样？"},{speaker:"记",korean:"낮에는 따뜻하지만 밤에는 춥습니다.",chinese:"白天温暖，但夜里寒冷。"},
      {speaker:"播",korean:"무엇을 준비해야 합니까?",chinese:"需要准备什么？"},{speaker:"记",korean:"우산과 따뜻한 옷을 준비하십시오.",chinese:"请准备雨伞和保暖衣物。"},
    ]],
  ];
  dialogues.forEach(([number,title,description,icon,lines]) => pages.push(page(number,title,description,icon,<><Dialogue lines={lines} speak={speak} showChinese={Boolean(revealed[`chinese${number}`])}/><Note title="角色交换" color="rose">替换时间、地点和天气后，再完成一轮八句对话。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed[`chinese${number}`])} onClick={() => toggle(`chinese${number}`)} />)));

  pages.push(
    page("23", "1. 听力抓三类信息", "先听时间，再听天气，最后听变化与建议。", <Headphones aria-hidden="true" size={22} />,
      <><button type="button" onClick={() => speak("오늘 아침은 맑고 따뜻합니다. 오후에는 흐리고 비가 옵니다. 밤에는 바람이 불고 춥습니다. 외출할 때 우산과 따뜻한 옷을 준비하세요.")} className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] p-4 text-sm font-bold text-white"><Volume2 aria-hidden="true" size={17}/>播放完整播报</button><div className="mt-5 grid grid-cols-3 gap-3">{[["时间","아침／오후／밤"],["天气","맑다／흐리다／비"],["建议","우산／따뜻한 옷"]].map(([title,answer]) => <article key={title} className="rounded-2xl border border-[var(--border)] bg-white p-4 text-center"><b className="text-[var(--primary)]">{title}</b><p className={`mt-3 text-sm font-bold ${revealed.listening ? "opacity-100" : "opacity-0"}`}>{answer}</p></article>)}</div><div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] font-bold"><span className="rounded-xl bg-[var(--accent)] p-3">① 画时间轴</span><span className="rounded-xl bg-[var(--accent)] p-3">② 记录天气词</span><span className="rounded-xl bg-[var(--accent)] p-3">③ 对应携带物</span></div><div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-bold"><span className="rounded-xl border border-[var(--border)] p-3">아침<br/>맑고 따뜻하다</span><span className="rounded-xl border border-[var(--border)] p-3">오후<br/>흐리고 비</span><span className="rounded-xl border border-[var(--border)] p-3">밤<br/>바람 + 춥다</span></div><p className="mt-3 text-center text-[10px] font-bold text-[var(--primary)]">时间词通常在句首，是切分播报段落的重要信号。</p><Note title="听力策略">第一遍只记时间轴，第二遍补天气，第三遍检查连接词与句尾。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.listening)} onClick={() => toggle("listening")} answer />),
    page("24", "2. 三段式播报模板", "每段只承担一个功能，信息更清楚。", <Radio aria-hidden="true" size={22} />,
      <><div className="mt-4 space-y-3">{[["01 当前","현재 서울은 맑고 따뜻합니다.","地点与当前天气"],["02 变化","오후에는 흐리지만 비는 오지 않습니다.","时间变化与反差"],["03 建议","밤에는 추우니까 따뜻한 옷을 준비하세요.","行动建议"]].map(([number,korean,chinese]) => <article key={number} className="grid grid-cols-[75px_1fr] gap-4 rounded-2xl border border-[var(--border)] bg-white p-4"><b className="text-[var(--primary)]">{number}</b><div><RuleSentence text={korean} speak={speak}><span className="text-sm font-bold">{korean}</span></RuleSentence><p className={`mt-1 text-[11px] text-[var(--foreground-secondary)] ${revealed.chinese24 ? "opacity-100" : "opacity-0"}`}>{chinese}</p></div></article>)}</div><section className="mt-4 rounded-2xl bg-[var(--accent)] p-4 text-xs"><p className="font-bold text-[var(--primary)]">替换槽位</p><p className="mt-2 font-bold">地点：서울／부산　时间：아침／오후／밤　天气：맑다／흐리다／춥다　建议：우산／겉옷</p></section><Note title="播报语气">事实用 -습니다/ㅂ니다；给听众的建议可用 -으세요/세요。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese24)} onClick={() => toggle("chinese24")} />),
    page("25", "3. 城市天气播报台", "选择两个城市，播报共同点和差异。", <Mic2 aria-hidden="true" size={22} />,
      <><div className="mt-4 grid grid-cols-2 gap-3">{[["서울","서울은 맑지만 춥습니다."],["부산","부산은 흐리고 따뜻합니다."],["제주","제주는 비가 오고 바람이 붑니다."],["강릉","강릉은 눈이 오고 춥습니다."]].map(([city,sentence]) => <button key={city} type="button" onClick={() => speak(sentence)} className="rounded-2xl border border-[var(--border)] bg-white p-4 text-left"><b className="text-[var(--primary)]">{city}</b><p className="mt-2 text-sm font-bold">{sentence}</p></button>)}</div><section className="mt-4 rounded-2xl bg-[var(--accent)] p-4"><p className="text-[11px] font-bold text-[var(--primary)]">四句播报骨架</p><div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold"><span className="rounded-lg bg-white p-3">① 城市 A 当前天气</span><span className="rounded-lg bg-white p-3">② 城市 B 当前天气</span><span className="rounded-lg bg-white p-3">③ 用 -지만 比较</span><span className="rounded-lg bg-white p-3">④ 给出行建议</span></div></section><Note title="90秒挑战">任选两座城市：各说当前天气，用 -지만 比较差异，最后给出出行建议。</Note></>),
    page("27", "1. 阅读 · 周末天气卡", "先找时间与地点，再给活动安排做决定。", <BookOpenCheck aria-hidden="true" size={22} />,
      <><section className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-5"><p className="text-[11px] font-bold text-[var(--status-success)]">주말 날씨</p><p className="mt-3 text-sm font-bold leading-7">토요일 아침은 맑고 따뜻합니다. 오후에는 구름이 많지만 비는 오지 않습니다. 일요일은 아침부터 비가 오고 바람이 붑니다. 토요일에는 공원에 가기 좋지만 일요일에는 실내 활동이 좋습니다.</p></section><div className="mt-4 grid grid-cols-2 gap-3 text-xs">{[["哪一天适合去公园？","토요일"],["周日有哪两种天气现象？","비가 오고 바람이 붑니다."],["-지만表达哪组反差？","토요일은 공원／일요일은 실내 활동"],["把最后一句改成日常体。","토요일에는 공원에 가기 좋지만 일요일에는 실내 활동이 좋아요."]].map(([question,answer],index) => <div key={question} className="rounded-xl bg-[var(--status-success-surface)] p-3 font-bold"><p><span className="mr-2 text-[var(--status-success)]">{index+1}.</span>{question}</p><p className={`mt-2 text-[var(--status-success)] ${revealed.reading ? "opacity-100" : "opacity-0"}`}>{answer}</p></div>)}</div><div className="mt-4 flex items-center justify-between rounded-xl bg-[var(--status-success-surface)] px-4 py-3 text-xs font-bold text-[var(--status-success)]"><span>阅读顺序：圈日期 → 标天气 → 判断活动。</span><KoreanEbookSpeakButton text="토요일에는 공원에 가기 좋지만 일요일에는 실내 활동이 좋습니다." onSpeak={speak} compact /></div><p className="mt-3 text-center text-[10px] font-bold text-[var(--status-success)]">正式体文本中的 -습니다／ㅂ니다 也能帮助你识别句子边界。</p></>, <KoreanEbookRevealButton shown={Boolean(revealed.reading)} onClick={() => toggle("reading")} answer />),
    page("28", "2. 写作 · 我喜欢的季节", "写 6—8 句，加入自己的地点、活动和理由。", <NotebookPen aria-hidden="true" size={22} />,
      <><div className="mt-4 grid grid-cols-2 gap-3"><Note title="内容骨架" color="green">季节 → 两个天气特征 → 活动 → 不便 → 比较 → 总结</Note><Note title="语言清单" color="amber">ㅂ不规则、-고、-지만、正式体各至少一次</Note></div><section className="mt-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] p-5"><p className="text-[11px] font-bold text-[var(--status-success)]">原创示范</p><p className="mt-3 text-sm font-bold leading-7">제가 좋아하는 계절은 가을입니다. 가을은 시원하고 하늘이 맑습니다. 주말에 공원에서 산책합니다. 밤에는 조금 춥지만 공기가 좋습니다. 여름은 덥고 비가 많이 옵니다. 그래서 저는 가을을 더 좋아합니다.</p></section><section className="mt-4 rounded-2xl bg-[var(--status-success-surface)] p-4"><p className="text-[11px] font-bold text-[var(--status-success)]">交稿前自检</p><div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold">{["至少两个天气特征","有一项季节活动","-고 与 -지만 意义正确","全文语体保持一致"].map((item) => <label key={item} className="flex items-center gap-2 rounded-lg bg-white p-2.5"><input type="checkbox" className="accent-[var(--status-success)]"/>{item}</label>)}</div></section></>),
    page("30", "1. 天气词汇闪测", "看到中文后两秒内说出韩语。", <CloudSun aria-hidden="true" size={22} />,
      <div className="mt-4 grid grid-cols-3 gap-2.5">{[["温暖","따뜻하다"],["炎热","덥다"],["凉爽","시원하다"],["寒冷","춥다"],["晴朗","맑다"],["阴天","흐리다"],["下雨","비가 오다"],["下雪","눈이 오다"],["刮风","바람이 불다"],["轻","가볍다"],["重","무겁다"],["困难","어렵다"]].map(([chinese,korean],index) => <article key={`${chinese}-${korean}`} className="rounded-xl border border-[var(--border)] bg-white p-3 text-center"><p className="text-[10px] text-[var(--status-success)]">{index+1}</p><b>{chinese}</b><p className={`mt-2 rounded-lg bg-[var(--status-success-surface)] p-2 text-xs font-bold ${revealed.words ? "opacity-100" : "opacity-0"}`}>{korean}</p></article>)}</div>, <KoreanEbookRevealButton shown={Boolean(revealed.words)} onClick={() => toggle("words")} answer />),
    page("31", "2. ㅂ 变形检测", "分别连接元音词尾与辅音词尾。", <Languages aria-hidden="true" size={22} />,
      <><div className="mt-4 grid grid-cols-2 gap-2.5">{[["춥다 + 어요","추워요"],["춥다 + 지만","춥지만"],["덥다 + 고","덥고"],["덥다 + 습니다","덥습니다"],["맵다 + 어요","매워요"],["어렵다 + 지만","어렵지만"],["가볍다 + 어요","가벼워요"],["무겁다 + 고","무겁고"],["돕다 + 아요","도와요"],["입다 + 어요","입어요"]].map(([question,answer],index) => <article key={`${question}-${index}`} className="rounded-xl border border-[var(--border)] bg-white p-3"><b>{question}</b><p className={`mt-2 text-sm font-bold text-[var(--status-success)] ${revealed.change ? "opacity-100" : "opacity-0"}`}>{answer}</p></article>)}</div><Note title="合格标准" color="green">至少答对 9 题，并解释为什么 춥지만 不变成 추워지만。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.change)} onClick={() => toggle("change")} answer />),
    page("32", "3. 综合句型检测", "完成连接词和正式体转换。", <CheckCircle2 aria-hidden="true" size={22} />,
      <div className="mt-4 space-y-2">{[["今天晴朗而温暖。","오늘은 맑고 따뜻해요."],["夏天热，但是冬天冷。","여름은 덥지만 겨울은 추워요."],["明天下雨。（正式体）","내일은 비가 옵니다."],["天气很冷。（正式体）","날씨가 춥습니다."],["这个包又轻又便宜。","이 가방은 가볍고 싸요."],["韩语难但是有趣。","한국어는 어렵지만 재미있어요."],["济州岛下雨而且刮风。","제주는 비가 오고 바람이 불어요."],["今天阴天，但是不冷。","오늘은 흐리지만 춥지 않아요."],["釜山很温暖。（正式体）","부산은 따뜻합니다."]].map(([question,answer],index) => <article key={`${question}-${index}`} className="grid grid-cols-2 gap-3 rounded-xl border border-[var(--border)] bg-white p-3 text-xs font-bold"><span>{index+1}. {question}</span><span className={`text-[var(--status-success)] ${revealed.test ? "opacity-100" : "opacity-0"}`}>{answer}</span></article>)}</div>, <KoreanEbookRevealButton shown={Boolean(revealed.test)} onClick={() => toggle("test")} answer />),
    page("33", "4. 口语验收 · 八句天气交流", "不看稿完成至少八句，交换角色后再做一次。", <Mic2 aria-hidden="true" size={22} />,
      <><section className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--status-success-surface)] p-5"><p className="text-xs font-bold text-[var(--status-success)]">六项必达信息</p><div className="mt-4 grid grid-cols-2 gap-3 text-xs">{["询问今天的天气","描述两种并存状态","使用一个ㅂ不规则词","用-지만表达反差","比较两个季节或城市","用正式体播报一句"].map((task,index) => <label key={`${task}-${index}`} className="flex items-center gap-2 rounded-xl bg-white p-3 font-bold"><input type="checkbox" className="accent-[var(--status-success)]"/>{task}</label>)}</div></section><button type="button" onClick={() => speak("오늘 날씨가 어때요? 아침에는 맑고 따뜻해요. 오후에도 따뜻해요? 아니요, 오후에는 흐리지만 비는 오지 않아요. 어느 계절을 좋아해요? 저는 시원하고 하늘이 맑은 가을을 좋아해요. 내일 날씨는 어떻습니까? 내일은 비가 오고 날씨가 춥습니다.")} className="mt-auto flex items-center justify-center gap-2 rounded-2xl bg-[var(--status-success)] p-4 text-sm font-bold text-white"><Volume2 aria-hidden="true" size={16}/>播放八句示范</button></>),
    <Page key="07-34" number="34"><div className="flex h-full flex-col justify-center"><div className="mx-auto w-full max-w-[440px] text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--status-success-surface)] text-[var(--status-success)]"><Sparkles aria-hidden="true" size={27}/></span><h3 className="mt-3 text-4xl font-bold">날씨가 어때요?</h3><p className="mt-3 text-lg font-bold">你已经完成第七课</p><p className="mx-auto mt-3 max-w-[380px] text-sm leading-7 text-[var(--foreground-secondary)]">现在你能描述天气与季节、比较特征，并在日常体与正式播报体之间正确切换。</p><div className="mt-4 grid grid-cols-2 gap-3 text-left">{[["01","掌握变化","ㅂ 불규칙"],["02","表达反差","A/V-지만"],["03","正式播报","A/V-습니다/ㅂ니다"],["04","并列信息","A/V-고"]].map(([number,title,detail]) => <div key={number} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3"><p className="text-[10px] font-bold text-[var(--status-success)]">{number}</p><p className="mt-1 text-xs font-bold">{title}</p><p className="mt-1 text-[10px] text-[var(--foreground-secondary)]">{detail}</p></div>)}</div><div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--status-success-surface)] px-5 py-3.5 text-left"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold tracking-[0.14em] text-[var(--status-success)]">本课测试</p><p className="mt-1 text-xs font-bold text-[var(--foreground-secondary)]">检验天气词汇、语法变形与正式播报。</p></div><KoreanEbookTestLink /></div></div><button type="button" onClick={() => flipBookRef.current?.pageFlip()?.flip(1)} className="mt-4 rounded-full bg-[var(--accent)] px-4 py-3 text-xs font-bold text-[var(--primary)]">返回目录</button></div></div></Page>,
  );

  pages.sort((a, b) => {
    const first = Number((a as { props: { number: string } }).props.number);
    const second = Number((b as { props: { number: string } }).props.number);
    return first - second;
  });

  return (
    <section ref={containerRef} className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden [&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-[var(--ring)] [&_button:focus-visible]:ring-offset-2 [&_input:focus-visible]:outline-none [&_input:focus-visible]:ring-2 [&_input:focus-visible]:ring-[var(--ring)] [&_input:focus-visible]:ring-offset-2">
      <div className="relative shrink-0" style={{ width: BOOK_WIDTH * scale, height: BOOK_HEIGHT * scale }}>
        <button type="button" onClick={() => flipBookRef.current?.pageFlip()?.flipPrev()} aria-label="上一页" className="absolute -left-14 top-1/2 z-20 -translate-y-1/2 rounded-full border border-[var(--border)] bg-white p-3 text-[var(--status-success)] shadow-lg"><ArrowLeft aria-hidden="true" size={18}/></button>
        <button type="button" onClick={() => flipBookRef.current?.pageFlip()?.flipNext()} aria-label="下一页" className="absolute -right-14 top-1/2 z-20 -translate-y-1/2 rounded-full border border-[var(--border)] bg-white p-3 text-[var(--status-success)] shadow-lg"><ArrowRight aria-hidden="true" size={18}/></button>
        <div className="absolute left-0 top-0 h-[822px] w-[1180px] origin-top-left" style={{ transform: `scale(${scale})` }}>
          <HTMLFlipBook ref={flipBookRef} width={590} height={822} startPage={initialPage} size="fixed" minWidth={590} maxWidth={590} minHeight={822} maxHeight={822} drawShadow maxShadowOpacity={0.32} flippingTime={650} usePortrait startZIndex={0} autoSize={false} showCover={false} mobileScrollSupport swipeDistance={24} clickEventForward useMouseEvents={true} showPageCorners={false} disableFlipByClick onFlip={(event) => onPageChange?.(event.data)} className="h-[822px] w-[1180px]" style={{}}>
            <Page number="封面" cover><KoreanEbookCover lesson={lesson}/></Page>
            {pages}
          </HTMLFlipBook>
        </div>
      </div>
    </section>
  );
}
