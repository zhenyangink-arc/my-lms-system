"use client";

import HTMLFlipBook from "react-pageflip";
import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Compass,
  Headphones,
  History,
  Link2,
  MessageCircle,
  Mic2,
  NotebookPen,
  PencilLine,
  Sparkles,
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
  KoreanEbookVocabularyCard,
} from "./KoreanLevelOneBookTemplate";
import type { KoreanLevelOneLesson } from "./KoreanLevelOneLessonBook";

const BOOK_WIDTH = 1180;
const BOOK_HEIGHT = 822;

type PageProps = {
  children: ReactNode;
  number: string;
  section?: string;
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

type VocabularyItem = {
  korean: string;
  pronunciation?: string;
  type: string;
  chinese: string;
};

type Speak = (text: string) => void;

const LESSON_FIVE_TEMPLATE = buildKoreanEbookSectionMap([
  { step: "STEP 01", label: "课前导航", dividerPage: 2, contentPages: [3] },
  { step: "STEP 02", label: "核心词汇表", dividerPage: 4, contentPages: [5, 6, 7, 8] },
  { step: "STEP 03", label: "语法讲解", dividerPage: 9, contentPages: [10, 11, 12, 13] },
  { step: "STEP 04", label: "句型操练", dividerPage: 14, contentPages: [15, 16, 17] },
  { step: "STEP 05", label: "实战对话", dividerPage: 18, contentPages: [19, 20, 21] },
  { step: "STEP 06", label: "听说任务", dividerPage: 22, contentPages: [23, 24, 25] },
  { step: "STEP 07", label: "读写拓展", dividerPage: 26, contentPages: [27, 28] },
  { step: "STEP 08", label: "自测与复盘", dividerPage: 29, contentPages: [30, 31, 32] },
]);

const SectionStepContext = createContext("STEP 08");

function getSectionStep(number: string) {
  return LESSON_FIVE_TEMPLATE.pageMeta[number]?.tag ?? "STEP 08";
}

const Page = forwardRef<HTMLDivElement, PageProps>(function Page(
  { children, number, section, cover = false },
  ref
) {
  return (
    <KoreanEbookPage
      ref={ref}
      number={number}
      header={
        section ??
        LESSON_FIVE_TEMPLATE.headers[number] ??
        "第05课 · 주말에 친구를 만났어요."
      }
      cover={cover}
      sectionMeta={LESSON_FIVE_TEMPLATE.pageMeta[number]}
      hideContentOverflow
    >
      <SectionStepContext.Provider value={getSectionStep(number)}>
        {children}
      </SectionStepContext.Provider>
    </KoreanEbookPage>
  );
});

function Heading({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon: ReactNode;
  action?: ReactNode;
}) {
  return (
    <KoreanEbookHeading
      step={useContext(SectionStepContext)}
      title={title}
      description={description}
      icon={icon}
      action={action}
    />
  );
}

function VocabularyGrid({
  items,
  speak,
  showChinese,
}: {
  items: VocabularyItem[];
  speak: Speak;
  showChinese: boolean;
}) {
  return (
    <div className={`mt-4 grid grid-cols-3 gap-2 ${showChinese ? "" : "[&_[data-vocab-meaning]]:opacity-0"}`}>
      {items.map((item) => (
        <KoreanEbookVocabularyCard
          key={`${item.korean}-${item.type}-${item.chinese}`}
          {...item}
          onSpeak={speak}
          compact
        />
      ))}
    </div>
  );
}

function NoteBox({
  label,
  children,
  tone = "purple",
}: {
  label: string;
  children: ReactNode;
  tone?: "purple" | "amber" | "green" | "blue" | "rose";
}) {
  const colors = {
    purple: "border-[#ddd0ee] bg-[#f7f2fc] text-[#75559a]",
    amber: "border-[#ead8be] bg-[#fff8ed] text-[#9b6b32]",
    green: "border-[#cfe3d4] bg-[#f2f8f3] text-[#487a54]",
    blue: "border-[#cfddec] bg-[#f1f6fb] text-[#3d6f9f]",
    rose: "border-[#ead0d6] bg-[#fff4f6] text-[#a65b68]",
  };
  return (
    <section className={`rounded-2xl border p-4 ${colors[tone]}`}>
      <p className="text-[11px] font-black tracking-[0.08em]">{label}</p>
      <div className="mt-2 text-xs font-bold leading-6 text-[#45574f]">
        {children}
      </div>
    </section>
  );
}

function RuleSentence({
  children,
  text,
  speak,
}: {
  children: ReactNode;
  text: string;
  speak: Speak;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="min-w-0">{children}</span>
      <KoreanEbookSpeakButton text={text} onSpeak={speak} compact />
    </div>
  );
}

function Dialogue({
  lines,
  speak,
  showChinese,
}: {
  lines: Array<{ speaker: string; korean: string; chinese: string }>;
  speak: Speak;
  showChinese: boolean;
}) {
  return (
    <div className="mt-4 space-y-2.5">
      {lines.map((line, index) => (
        <div
          key={`${line.speaker}-${line.korean}`}
          className={`flex gap-3 rounded-2xl p-3 ${
            index % 2 === 0 ? "bg-[#f4f8f6]" : "bg-[#fff7ed]"
          }`}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-black">
            {line.speaker}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-[#173f4a]">{line.korean}</p>
            <p className={`mt-1 text-[11px] font-bold text-[#71857b] ${showChinese ? "opacity-100" : "opacity-0"}`}>{line.chinese}</p>
          </div>
          <KoreanEbookSpeakButton text={line.korean} onSpeak={speak} />
        </div>
      ))}
    </div>
  );
}

const numberWords: VocabularyItem[] = [
  { korean: "일", pronunciation: "일", type: "汉字词数字", chinese: "1" },
  { korean: "이", pronunciation: "이", type: "汉字词数字", chinese: "2" },
  { korean: "삼", pronunciation: "삼", type: "汉字词数字", chinese: "3" },
  { korean: "사", pronunciation: "사", type: "汉字词数字", chinese: "4" },
  { korean: "오", pronunciation: "오", type: "汉字词数字", chinese: "5" },
  { korean: "육", pronunciation: "육", type: "汉字词数字", chinese: "6" },
  { korean: "칠", pronunciation: "칠", type: "汉字词数字", chinese: "7" },
  { korean: "팔", pronunciation: "팔", type: "汉字词数字", chinese: "8" },
  { korean: "구", pronunciation: "구", type: "汉字词数字", chinese: "9" },
  { korean: "십", pronunciation: "십", type: "汉字词数字", chinese: "10" },
  { korean: "월", pronunciation: "월", type: "日期单位", chinese: "月" },
  { korean: "일", pronunciation: "일", type: "日期单位", chinese: "日／号" },
  { korean: "년", pronunciation: "년", type: "日期单位", chinese: "年" },
  { korean: "시", pronunciation: "시", type: "时间单位", chinese: "点／时" },
  { korean: "분", pronunciation: "분", type: "时间单位", chinese: "分" },
];

const monthWords: VocabularyItem[] = [
  { korean: "일월", pronunciation: "이뤌", type: "月份", chinese: "1月" },
  { korean: "이월", pronunciation: "이월", type: "月份", chinese: "2月" },
  { korean: "삼월", pronunciation: "사뭘", type: "月份", chinese: "3月" },
  { korean: "사월", pronunciation: "사월", type: "月份", chinese: "4月" },
  { korean: "오월", pronunciation: "오월", type: "月份", chinese: "5月" },
  { korean: "유월", pronunciation: "유월", type: "月份", chinese: "6月（例外）" },
  { korean: "칠월", pronunciation: "치뤌", type: "月份", chinese: "7月" },
  { korean: "팔월", pronunciation: "파뤌", type: "月份", chinese: "8月" },
  { korean: "구월", pronunciation: "구월", type: "月份", chinese: "9月" },
  { korean: "시월", pronunciation: "시월", type: "月份", chinese: "10月（例外）" },
  { korean: "십일월", pronunciation: "시비뤌", type: "月份", chinese: "11月" },
  { korean: "십이월", pronunciation: "시비월", type: "月份", chinese: "12月" },
  { korean: "생일", pronunciation: "생일", type: "时间名词", chinese: "生日" },
  { korean: "날짜", pronunciation: "날짜", type: "时间名词", chinese: "日期" },
  { korean: "며칠", pronunciation: "며칠", type: "疑问词", chinese: "几号／几天" },
];

const weekdayWords: VocabularyItem[] = [
  { korean: "월요일", pronunciation: "워료일", type: "星期", chinese: "星期一" },
  { korean: "화요일", pronunciation: "화요일", type: "星期", chinese: "星期二" },
  { korean: "수요일", pronunciation: "수요일", type: "星期", chinese: "星期三" },
  { korean: "목요일", pronunciation: "모교일", type: "星期", chinese: "星期四" },
  { korean: "금요일", pronunciation: "그묘일", type: "星期", chinese: "星期五" },
  { korean: "토요일", pronunciation: "토요일", type: "星期", chinese: "星期六" },
  { korean: "일요일", pronunciation: "이료일", type: "星期", chinese: "星期日" },
  { korean: "어제", pronunciation: "어제", type: "时间名词", chinese: "昨天" },
  { korean: "오늘", pronunciation: "오늘", type: "时间名词", chinese: "今天" },
  { korean: "내일", pronunciation: "내일", type: "时间名词", chinese: "明天" },
  { korean: "지금", pronunciation: "지금", type: "时间名词", chinese: "现在" },
  { korean: "주말", pronunciation: "주말", type: "时间名词", chinese: "周末" },
  { korean: "아침", pronunciation: "아침", type: "时间名词", chinese: "早晨" },
  { korean: "점심", pronunciation: "점심", type: "时间名词", chinese: "中午" },
  { korean: "저녁", pronunciation: "저녁", type: "时间名词", chinese: "晚上" },
];

const activityWords: VocabularyItem[] = [
  { korean: "끝나다", pronunciation: "끈나다", type: "动词", chinese: "结束" },
  { korean: "산책하다", pronunciation: "산채카다", type: "动词", chinese: "散步" },
  { korean: "사진을 찍다", pronunciation: "사진을 찍따", type: "动词表达", chinese: "拍照" },
  { korean: "미안하다", pronunciation: "미안하다", type: "形容词", chinese: "抱歉" },
  { korean: "만나다", pronunciation: "만나다", type: "动词", chinese: "见面" },
  { korean: "먹다", pronunciation: "먹따", type: "动词", chinese: "吃" },
  { korean: "마시다", pronunciation: "마시다", type: "动词", chinese: "喝" },
  { korean: "보다", pronunciation: "보다", type: "动词", chinese: "看" },
  { korean: "읽다", pronunciation: "익따", type: "动词", chinese: "读" },
  { korean: "듣다", pronunciation: "듣따", type: "动词", chinese: "听" },
  { korean: "공부하다", pronunciation: "공부하다", type: "动词", chinese: "学习" },
  { korean: "운동하다", pronunciation: "운동하다", type: "动词", chinese: "运动" },
  { korean: "쉬다", pronunciation: "쉬다", type: "动词", chinese: "休息" },
  { korean: "비가 오다", pronunciation: "비가 오다", type: "动词表达", chinese: "下雨" },
  { korean: "텔레비전을 보다", pronunciation: "텔레비전을 보다", type: "动词表达", chinese: "看电视" },
];

export function KoreanLevelOneLessonFiveBook({
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

  function toggle(key: string) {
    setRevealed((current) => ({ ...current, [key]: !current[key] }));
  }

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

  const pages = [
    <Page key="05-01" number="01">
      <KoreanEbookTableOfContents
        lessonNumber={5}
        pageMeta={LESSON_FIVE_TEMPLATE.pageMeta}
        onNavigate={(page) => flipBookRef.current?.pageFlip()?.flip(page)}
        entries={[
          { step: "01", title: "课前导航", pageRange: "02—03", detail: "建立时间轴" },
          { step: "02", title: "核心词汇表", pageRange: "04—08", detail: "数字·日期·活动" },
          { step: "03", title: "语法讲解", pageRange: "09—13", detail: "过去·时间·连接" },
          { step: "04", title: "句型操练", pageRange: "14—17", detail: "变形与叙事" },
          { step: "05", title: "实战对话", pageRange: "18—21", detail: "周末与生日" },
          { step: "06", title: "听说任务", pageRange: "22—25", detail: "听时间·说经历" },
          { step: "07", title: "读写拓展", pageRange: "26—28", detail: "读日记·写时间线" },
          { step: "08", title: "自测与复盘", pageRange: "29—33", detail: "转换·检测·完成" },
        ]}
      />
    </Page>,
    <Page key="05-02" number="02">
      <KoreanEbookSectionDivider
        step="STEP 01"
        title="课前导航"
        goal="把日期、星期和过去动作放到同一条时间轴上，并用 -고 讲清事件顺序。"
        icon={<Compass size={24} />}
      />
    </Page>,
    <Page key="05-03" number="03">
      <div className="flex h-full flex-col">
        <Heading title="从一句过去时，到一段故事" description="第五课的目标是回答：什么时候、做了什么、然后怎样、为什么。" icon={<History size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.chinese03)} onClick={() => toggle("chinese03")} />} />
        <div className="mt-5 grid grid-cols-2 gap-3">
          {[
            ["DATE", "오월 십일이에요.", "是5月10日。"],
            ["DAY", "금요일이에요.", "是星期五。"],
            ["PAST", "친구를 만났어요.", "见了朋友。"],
            ["SEQUENCE", "밥을 먹고 산책했어요.", "吃饭后散了步。"],
          ].map(([tag, korean, chinese]) => (
            <button key={tag} type="button" onClick={() => speak(korean)} className="rounded-2xl border border-[#e1e8e4] bg-white p-4 text-left">
              <p className="text-[10px] font-black text-[#bd741e]">{tag}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-sm font-black">{korean}</p>
                <Volume2 size={14} className="shrink-0 text-[#8a6aa6]" />
              </div>
              <p className={`mt-1 text-[11px] font-bold text-[#71857b] ${revealed.chinese03 ? "opacity-100" : "opacity-0"}`}>{chinese}</p>
            </button>
          ))}
        </div>
        <section className="mt-5 rounded-2xl bg-[#fff4e7] p-5">
          <p className="text-xs font-black text-[#a26024]">本课叙事发动机</p>
          <p className="mt-3 text-center text-lg font-black">
            日期／星期 + 时间에 + 动作1-고 + 动作2-았／었어요
          </p>
          <p className="mt-3 text-xs leading-6 text-[#6c6f69]">
            一个完整故事不需要很多难词，只需要准确的时间点、正确的过去时和清楚的动作顺序。
          </p>
        </section>
        <p className="mt-auto rounded-xl bg-[#f7faf8] p-3 text-[11px] font-bold text-[#60736a]">
          学习挑战：每学完一项语法，就把它加入同一个“我的周末”故事。
        </p>
      </div>
    </Page>,
    <Page key="05-04" number="04">
      <KoreanEbookSectionDivider
        step="STEP 02"
        title="核心词汇表"
        goal="先建立数字与日历系统，再补充能讲述周末经历的动作表达。"
        icon={<CalendarDays size={24} />}
      />
    </Page>,
    <Page key="05-05" number="05">
      <div className="flex h-full flex-col">
        <Heading title="1. 汉字词数字与时间单位" description="日期、分钟、号码和价格常使用汉字词数字；本页先掌握 1—10。" icon={<Clock3 size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.chinese05)} onClick={() => toggle("chinese05")} />} />
        <VocabularyGrid items={numberWords} speak={speak} showChinese={Boolean(revealed.chinese05)} />
        <NoteBox label="组合规律" tone="blue">
          11 = 십일，12 = 십이，20 = 이십，25 = 이십오。像搭积木一样按“十位＋个位”组合，不需要记新词。
        </NoteBox>
      </div>
    </Page>,
    <Page key="05-06" number="06">
      <div className="flex h-full flex-col">
        <Heading title="2. 月份与日期" description="数字直接加 월 构成月份，但 6 月和 10 月必须记住特殊形式。" icon={<CalendarDays size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.chinese06)} onClick={() => toggle("chinese06")} />} />
        <VocabularyGrid items={monthWords} speak={speak} showChinese={Boolean(revealed.chinese06)} />
        <p className="mt-auto rounded-xl bg-[#fff0df] p-3 text-[11px] font-bold text-[#b46624]">
          必记：육월 → <b>유월</b>，십월 → <b>시월</b>。不是发音随意变化，而是固定写法。
        </p>
      </div>
    </Page>,
    <Page key="05-07" number="07">
      <div className="flex h-full flex-col">
        <Heading title="3. 星期与时间词" description="星期由一个汉字词加 요일 构成；注意无需加 에 的四个高频时间词。" icon={<CalendarDays size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.chinese07)} onClick={() => toggle("chinese07")} />} />
        <VocabularyGrid items={weekdayWords} speak={speak} showChinese={Boolean(revealed.chinese07)} />
        <div className="mt-auto grid grid-cols-4 gap-2 text-center text-[10px] font-black text-[#a65b68]">
          {["어제 × 에", "오늘 × 에", "내일 × 에", "지금 × 에"].map((item) => <span key={item} className="rounded-xl bg-[#fff4f6] p-2">{item}</span>)}
        </div>
      </div>
    </Page>,
    <Page key="05-08" number="08">
      <div className="flex h-full flex-col">
        <Heading title="4. 周末活动与状态" description="把动作词直接与过去式一起记忆，为后面的叙事练习做准备。" icon={<Sparkles size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.chinese08)} onClick={() => toggle("chinese08")} />} />
        <VocabularyGrid items={activityWords} speak={speak} showChinese={Boolean(revealed.chinese08)} />
        <div className="mt-auto grid grid-cols-3 gap-2 text-center text-[10px] font-black">
          <span className="rounded-xl bg-[#f1eafb] p-2 text-[#75559a]">만나다 → 만났어요</span>
          <span className="rounded-xl bg-[#e7f5f1] p-2 text-[#347b69]">찍다 → 찍었어요</span>
          <span className="rounded-xl bg-[#fff0df] p-2 text-[#b46624]">미안하다 → 미안했어요</span>
        </div>
      </div>
    </Page>,
    <Page key="05-09" number="09">
      <KoreanEbookSectionDivider
        step="STEP 03"
        title="语法讲解"
        goal="依次掌握日期与星期、时间助词、过去时和动作连接，让句子从“一个点”变成“时间线”。"
        icon={<NotebookPen size={24} />}
      />
    </Page>,
    <Page key="05-10" number="10">
      <div className="flex h-full flex-col">
        <Heading title="1. 날짜와 요일" description="学习读写年月日和星期，并能询问“几月几号、星期几”。" icon={<CalendarDays size={22} />} />
        <section className="mt-4 rounded-2xl bg-[#f7f2fc] p-5 text-center">
          <p className="text-[11px] font-black text-[#75559a]">日期排列</p>
          <p className="mt-3 text-lg font-black">年 + 년　月 + 월　日 + 일</p>
          <p className="mt-3 text-sm font-black">이천이십육 년 오월 십일</p>
          <p className="mt-1 text-xs text-[#71857b]">2026年5月10日</p>
        </section>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <NoteBox label="询问日期" tone="blue">
            <RuleSentence text="오늘이 몇 월 며칠이에요?" speak={speak}>오늘이 <b>몇 월 며칠</b>이에요?</RuleSentence>
            <span className="block text-[10px] text-[#71857b]">今天是几月几号？</span>
            <RuleSentence text="생일이 몇 월 며칠이에요?" speak={speak}>생일이 몇 월 며칠이에요?</RuleSentence>
            <span className="block text-[10px] text-[#71857b]">生日是几月几号？</span>
          </NoteBox>
          <NoteBox label="询问星期" tone="green">
            <RuleSentence text="오늘이 무슨 요일이에요?" speak={speak}>오늘이 <b>무슨 요일</b>이에요?</RuleSentence>
            <span className="block text-[10px] text-[#71857b]">今天星期几？</span>
            <RuleSentence text="금요일이에요." speak={speak}>금요일이에요.</RuleSentence>
            <span className="block text-[10px] text-[#71857b]">是星期五。</span>
          </NoteBox>
        </div>
        <NoteBox label="两个必须记住的月份" tone="amber">
          6月写作、读作 <b>유월</b>，不能写 육월；10月写作、读作 <b>시월</b>，
          不能写 십월。其他月份按汉字词数字直接加 월。
        </NoteBox>
        <section className="mt-3 rounded-2xl border border-[#dce8e1] bg-white p-4">
          <p className="text-xs font-black">日期与星期是两个不同答案</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
            <p className="rounded-xl bg-[#f1f6fb] p-3"><b>오월 십일</b><br />日期</p>
            <p className="rounded-xl bg-[#f2f8f3] p-3"><b>금요일</b><br />星期</p>
          </div>
        </section>
        <p className="mt-auto text-[11px] font-bold text-[#71857b]">며칠 是“几号／几天”的固定疑问词，不要拆成 몇 일 来使用。</p>
      </div>
    </Page>,
    <Page key="05-11" number="11">
      <div className="flex h-full flex-col">
        <Heading title="2. 时间名词 + 에" description="把动作固定在具体时间点，相当于“在……时候”。" icon={<Clock3 size={22} />} />
        <section className="mt-4 rounded-2xl bg-[#f1f6fb] p-5 text-center">
          <p className="text-[11px] font-black text-[#3d6f9f]">时间句骨架</p>
          <p className="mt-3 text-lg font-black">具体时间 + 에 + 动作</p>
          <p className="mt-3 text-sm font-black">토요일에 친구를 만났어요.</p>
        </section>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <NoteBox label="通常加 에" tone="green">
            <RuleSentence text="월요일에" speak={speak}>월요일<b>에</b></RuleSentence>
            <RuleSentence text="오월 십일에" speak={speak}>오월 십일<b>에</b></RuleSentence>
            <RuleSentence text="주말에" speak={speak}>주말<b>에</b></RuleSentence>
            <RuleSentence text="아침에" speak={speak}>아침<b>에</b></RuleSentence>
          </NoteBox>
          <NoteBox label="固定不加 에" tone="rose">
            <RuleSentence text="어제 만났어요." speak={speak}>어제 만났어요.</RuleSentence>
            <RuleSentence text="오늘 공부해요." speak={speak}>오늘 공부해요.</RuleSentence>
            <RuleSentence text="내일 가요." speak={speak}>내일 가요.</RuleSentence>
            <RuleSentence text="지금 쉬어요." speak={speak}>지금 쉬어요.</RuleSentence>
          </NoteBox>
        </div>
        <NoteBox label="为什么这些词不加？" tone="purple">
          어제／오늘／내일／지금 本身已经直接指向说话时点，不需要 에 再定位。
          这是固定用法，必须整体记忆，而不是按中文“在昨天”逐字翻译。
        </NoteBox>
        <p className="mt-auto rounded-xl border border-[#dce8e1] p-3 text-xs">
          日期顺序：오월 십일에（5月10日）——月份在前，日期在后，最后加 에。
        </p>
      </div>
    </Page>,
    <Page key="05-12" number="12">
      <div className="flex h-full flex-col">
        <Heading title="3. V-았／었-" description="表示过去发生的动作或过去的状态；选择规则与现在时 -아／어요 同源。" icon={<History size={22} />} />
        <div className="mt-4 grid grid-cols-3 gap-3">
          <NoteBox label="ㅏ／ㅗ → -았어요" tone="amber">
            <RuleSentence text="가다. 갔어요." speak={speak}>가다 → 갔어요</RuleSentence>
            <RuleSentence text="보다. 봤어요." speak={speak}>보다 → 봤어요</RuleSentence>
            <RuleSentence text="만나다. 만났어요." speak={speak}>만나다 → 만났어요</RuleSentence>
          </NoteBox>
          <NoteBox label="其他元音 → -었어요" tone="blue">
            <RuleSentence text="먹다. 먹었어요." speak={speak}>먹다 → 먹었어요</RuleSentence>
            <RuleSentence text="마시다. 마셨어요." speak={speak}>마시다 → 마셨어요</RuleSentence>
            <RuleSentence text="쉬다. 쉬었어요." speak={speak}>쉬다 → 쉬었어요</RuleSentence>
          </NoteBox>
          <NoteBox label="하다 → 했어요" tone="green">
            <RuleSentence text="공부하다. 공부했어요." speak={speak}>공부하다 → 공부했어요</RuleSentence>
            <RuleSentence text="산책하다. 산책했어요." speak={speak}>산책하다 → 산책했어요</RuleSentence>
            <RuleSentence text="미안하다. 미안했어요." speak={speak}>미안하다 → 미안했어요</RuleSentence>
          </NoteBox>
        </div>
        <NoteBox label="不要在现在时后面直接加过去标记" tone="rose">
          不是 가요 + ㅆ어요。要回到词干 가-，再组合成 갔어요。把“词典形 → 词干 → 过去形”作为固定路线。
        </NoteBox>
        <section className="mt-3 rounded-2xl bg-[#f7f2fc] p-4">
          <p className="text-xs font-black text-[#75559a]">现在与过去的声音对照</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <p className="rounded-xl bg-white p-3">가요 → <b>갔어요</b></p>
            <p className="rounded-xl bg-white p-3">먹어요 → <b>먹었어요</b></p>
            <p className="rounded-xl bg-white p-3">해요 → <b>했어요</b></p>
          </div>
        </section>
        <p className="mt-auto text-[11px] font-bold text-[#71857b]">ㅆ 是“事情已经跨过现在”的时间标记，听到它就先想到过去。</p>
      </div>
    </Page>,
    <Page key="05-13" number="13">
      <div className="flex h-full flex-col">
        <Heading title="4. V-고" description="直接接在动词词干后，连接并列动作或先后发生的动作。" icon={<Link2 size={22} />} />
        <section className="mt-4 rounded-2xl bg-[#f7f2fc] p-5 text-center">
          <p className="text-[11px] font-black text-[#75559a]">连接结构</p>
          <p className="mt-3 text-lg font-black">动作1 词干 + 고 + 动作2（句尾时态）</p>
          <p className="mt-3 text-sm font-black">친구를 만나고 밥을 먹었어요.</p>
        </section>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <NoteBox label="先后顺序" tone="blue">
            <RuleSentence text="밥을 먹고 산책했어요." speak={speak}>밥을 먹고 산책했어요.</RuleSentence>
            <span className="block text-[10px] text-[#71857b]">吃了饭，然后散步。</span>
            <RuleSentence text="책을 읽고 잤어요." speak={speak}>책을 읽고 잤어요.</RuleSentence>
            <span className="block text-[10px] text-[#71857b]">看书后睡了。</span>
          </NoteBox>
          <NoteBox label="并列罗列" tone="green">
            <RuleSentence text="사진을 찍고 음악을 들었어요." speak={speak}>사진을 찍고 음악을 들었어요.</RuleSentence>
            <span className="block text-[10px] text-[#71857b]">拍了照，也听了音乐。</span>
            <RuleSentence text="공부하고 운동했어요." speak={speak}>공부하고 운동했어요.</RuleSentence>
          </NoteBox>
        </div>
        <NoteBox label="过去只放在最后一个句尾" tone="rose">
          整串动作的时态由最后一个谓语承担。说 <b>만나고 먹었어요</b>，不要说
          <span className="mx-1 rounded bg-white px-1">만났고 먹었어요</span>来表达普通先后。
        </NoteBox>
        <p className="mt-auto text-[11px] font-bold text-[#71857b]">-고 本身不表示过去，它只连接动作；整句时态由最后一个动词决定。</p>
      </div>
    </Page>,
    <Page key="05-14" number="14">
      <KoreanEbookSectionDivider
        step="STEP 04"
        title="句型操练"
        goal="完成日期星期问答、时间助词选择、现在时—过去时转换和 -고 叙事组装。"
        icon={<PencilLine size={24} />}
      />
    </Page>,
    <Page key="05-15" number="15">
      <div className="flex h-full flex-col">
        <Heading title="1. 动词三态转换表" description="从词典形出发，同时说出现在时和过去时，建立快速转换反射。" icon={<History size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.forms)} onClick={() => toggle("forms")} answer />} />
        <div className="mt-4 overflow-hidden rounded-2xl border border-[#ead8be]">
          <div className="grid grid-cols-3 bg-[#fff2df] px-4 py-3 text-[11px] font-black text-[#b46624]">
            <span>词典形</span><span>现在时</span><span>过去时</span>
          </div>
          {[
            ["가다", "가요", "갔어요"], ["보다", "봐요", "봤어요"], ["만나다", "만나요", "만났어요"],
            ["먹다", "먹어요", "먹었어요"], ["마시다", "마셔요", "마셨어요"], ["읽다", "읽어요", "읽었어요"],
            ["듣다", "들어요", "들었어요"], ["쉬다", "쉬어요", "쉬었어요"], ["찍다", "찍어요", "찍었어요"],
            ["공부하다", "공부해요", "공부했어요"], ["운동하다", "운동해요", "운동했어요"], ["산책하다", "산책해요", "산책했어요"],
          ].map(([base, present, past]) => (
            <div key={base} className="grid grid-cols-3 border-t border-[#eee4d6] bg-white px-4 py-2 text-[11px] font-bold">
              <span>{base}</span>
              <span className={revealed.forms ? "opacity-100" : "opacity-0"}>{present}</span>
              <span className={`text-[#b46624] ${revealed.forms ? "opacity-100" : "opacity-0"}`}>{past}</span>
            </div>
          ))}
        </div>
        <p className="mt-auto text-[11px] font-bold text-[#71857b]">训练法：遮住后两列，每个词必须在两秒内连续说出现在形和过去形。</p>
      </div>
    </Page>,
    <Page key="05-16" number="16">
      <div className="flex h-full flex-col">
        <Heading title="2. 时间助词诊断" description="判断是否需要 에；错误选项不是“少一点自然”，而是结构错误。" icon={<ClipboardCheck size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.time)} onClick={() => toggle("time")} answer />} />
        <div className="mt-4 space-y-2.5">
          {[
            ["월요일(에／×) 공부했어요.", "월요일에", "具体星期"],
            ["어제(에／×) 친구를 만났어요.", "어제", "固定不加 에"],
            ["주말(에／×) 영화를 봤어요.", "주말에", "时间范围"],
            ["오늘(에／×) 운동해요.", "오늘", "固定不加 에"],
            ["시월 십일(에／×) 만나요.", "시월 십일에", "具体日期"],
            ["지금(에／×) 뭐 해요?", "지금", "固定不加 에"],
          ].map(([question, answer, reason], index) => (
            <div key={question} className="grid grid-cols-[28px_1.1fr_1fr] items-center gap-3 rounded-xl border border-[#ead8be] bg-white p-3">
              <span className="text-xs font-black text-[#b46624]">{index + 1}</span>
              <p className="text-xs font-black">{question}</p>
              <p className={`text-[11px] font-bold text-[#347b69] ${revealed.time ? "opacity-100" : "opacity-0"}`}>{answer}<span className="ml-2 text-[#81938a]">· {reason}</span></p>
            </div>
          ))}
        </div>
        <p className="mt-auto rounded-xl bg-[#fff2df] p-3 text-[11px] font-bold text-[#8b642f]">四词口令：어제、오늘、내일、지금，后面永远不加 에。</p>
      </div>
    </Page>,
    <Page key="05-17" number="17">
      <div className="flex h-full flex-col">
        <Heading title="3. 故事组装台" description="把日期、星期、时间助词、过去式和 -고 放进同一段叙事。" icon={<PencilLine size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.story)} onClick={() => toggle("story")} answer />} />
        <div className="mt-4 space-y-3">
          {[
            ["5月10日／星期五", "오월 십일, 금요일이에요.", "日期＋星期"],
            ["星期五／见朋友", "금요일에 친구를 만났어요.", "时间＋过去"],
            ["朋友见面 → 吃饭", "친구를 만나고 밥을 먹었어요.", "先后"],
            ["看书 ＋ 看电视", "책을 읽고 텔레비전을 봤어요.", "并列"],
          ].map(([clue, answer, relation], index) => (
            <article key={clue} className="rounded-2xl border border-[#ead8be] bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black"><span className="mr-2 text-[#b46624]">{index + 1}.</span>{clue}</p>
                <span className="rounded-full bg-[#fff2df] px-3 py-1 text-[10px] font-black text-[#b46624]">{relation}</span>
              </div>
              <p className={`mt-3 text-sm font-black ${revealed.story ? "opacity-100" : "opacity-0"}`}>{answer}</p>
            </article>
          ))}
        </div>
        <NoteBox label="最后检查时态" tone="amber">
          日期和星期用 이에요／예요 说明；事件时间加 에；连续动作只让最后一个动词承担过去时。
        </NoteBox>
      </div>
    </Page>,
    <Page key="05-18" number="18">
      <KoreanEbookSectionDivider
        step="STEP 05"
        title="实战对话"
        goal="在周末回顾、生日邀约和迟到说明三个场景中讲清时间、顺序与原因。"
        icon={<MessageCircle size={24} />}
      />
    </Page>,
    <Page key="05-19" number="19">
      <div className="flex h-full flex-col">
        <Heading title="场景 1 · 周末做了什么？" description="目标：用过去时和 -고 回顾两个连续活动。" icon={<MessageCircle size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.chinese19)} onClick={() => toggle("chinese19")} />} />
        <Dialogue speak={speak} showChinese={Boolean(revealed.chinese19)} lines={[
          { speaker: "A", korean: "주말에 뭐 했어요?", chinese: "周末做什么了？" },
          { speaker: "B", korean: "친구를 만나고 밥을 먹었어요.", chinese: "见了朋友，然后吃了饭。" },
          { speaker: "A", korean: "사진도 찍었어요?", chinese: "也拍照了吗？" },
          { speaker: "B", korean: "네, 공원에서 사진을 찍었어요.", chinese: "是的，在公园拍了照。" },
        ]} />
        <section className="mt-4 rounded-2xl bg-[#fbeaec] p-4">
          <p className="text-xs font-black text-[#a65b68]">周末活动卡</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-black">
            <span className="rounded-xl bg-white p-3">영화를 봤어요</span>
            <span className="rounded-xl bg-white p-3">산책했어요</span>
            <span className="rounded-xl bg-white p-3">집에서 쉬었어요</span>
          </div>
        </section>
        <p className="mt-auto text-[11px] text-[#71857b]">도 表示“也”，让追问自然接续前面的活动。</p>
      </div>
    </Page>,
    <Page key="05-20" number="20">
      <div className="flex h-full flex-col">
        <Heading title="场景 2 · 生日是几号？" description="目标：询问日期，并用星期与具体日期安排见面。" icon={<CalendarDays size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.chinese20)} onClick={() => toggle("chinese20")} />} />
        <Dialogue speak={speak} showChinese={Boolean(revealed.chinese20)} lines={[
          { speaker: "A", korean: "생일이 몇 월 며칠이에요?", chinese: "生日是几月几号？" },
          { speaker: "B", korean: "유월 십오일이에요.", chinese: "6月15日。" },
          { speaker: "A", korean: "무슨 요일이에요?", chinese: "星期几？" },
          { speaker: "B", korean: "토요일이에요. 토요일에 만나요.", chinese: "星期六。星期六见吧。" },
        ]} />
        <NoteBox label="日期问法" tone="rose">
          몇 월（几月）＋ 며칠（几号）。回答时日期数字后直接接 일：
          십오일（15日）、이십일일（21日）。
        </NoteBox>
        <p className="mt-auto rounded-xl border border-[#ead0d6] p-3 text-xs">替换任务：用自己的生日和真实星期重新回答。</p>
      </div>
    </Page>,
    <Page key="05-21" number="21">
      <div className="flex h-full flex-col">
        <Heading title="场景 3 · 为什么迟到了？" description="扩展表达：认识会话词 그래서，并用 미안했어요 表达歉意；不列入本课四项核心语法。" icon={<History size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.chinese21)} onClick={() => toggle("chinese21")} />} />
        <Dialogue speak={speak} showChinese={Boolean(revealed.chinese21)} lines={[
          { speaker: "A", korean: "어제 왜 늦었어요?", chinese: "昨天为什么迟到了？" },
          { speaker: "B", korean: "비가 많이 왔어요.", chinese: "雨下得很大。" },
          { speaker: "B", korean: "그래서 버스가 늦었어요.", chinese: "所以公交车晚了。" },
          { speaker: "B", korean: "정말 미안했어요.", chinese: "真的很抱歉。" },
        ]} />
        <section className="mt-4 rounded-2xl bg-[#fbeaec] p-4">
          <p className="text-xs font-black text-[#a65b68]">因果替换卡</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold">
            <p className="rounded-xl bg-white p-3">아팠어요 → 집에서 쉬었어요</p>
            <p className="rounded-xl bg-white p-3">수업이 끝났어요 → 친구를 만났어요</p>
          </div>
        </section>
        <p className="mt-auto text-[11px] text-[#71857b]">왜（为什么）用于询问原因；回答时可以直接给原因，再用 그래서 接结果。</p>
      </div>
    </Page>,
    <Page key="05-22" number="22">
      <KoreanEbookSectionDivider
        step="STEP 06"
        title="听说任务"
        goal="听辨日期、过去时标记与事件顺序，再完成一段有时间线的个人经历表达。"
        icon={<Headphones size={24} />}
      />
    </Page>,
    <Page key="05-23" number="23">
      <div className="flex h-full flex-col">
        <Heading title="1. 日期听写" description="先听月份，再听日期；特别注意 유월 和 시월。" icon={<Headphones size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.dates)} onClick={() => toggle("dates")} answer />} />
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            ["삼월 이십일일", "3月21日"], ["유월 십오일", "6月15日"],
            ["시월 구일", "10月9日"], ["십이월 이십오일", "12月25日"],
            ["오월 팔일", "5月8日"], ["칠월 삼일", "7月3日"],
          ].map(([date, chinese], index) => (
            <button key={date} type="button" onClick={() => speak(date)} className="rounded-2xl border border-[#cfdfeb] bg-white p-4 text-left">
              <p className="text-[10px] font-black text-[#3e7fa3]">DATE AUDIO {index + 1}</p>
              <p className={`mt-3 text-sm font-black ${revealed.dates ? "opacity-100" : "opacity-0"}`}>{date}</p>
              <p className={`mt-1 text-[11px] font-bold text-[#71857b] ${revealed.dates ? "opacity-100" : "opacity-0"}`}>{chinese}</p>
            </button>
          ))}
        </div>
        <section className="mt-4 rounded-2xl bg-[#eef5fb] p-4">
          <p className="text-[11px] font-black text-[#3e7fa3]">日期拆分法</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-black">
            <span className="rounded-xl bg-white p-3">십이월<br/><small>12月</small></span>
            <span className="rounded-xl bg-white p-3">이십오<br/><small>25</small></span>
            <span className="rounded-xl bg-white p-3">일<br/><small>日／号</small></span>
          </div>
          <p className="mt-3 text-center text-xs font-bold">십이월 이십오일 = 12月25日</p>
        </section>
        <p className="mt-3 text-[11px] font-bold text-[#71857b]">听写顺序：先写月份，再写数字日期；유월、시월要按固定形式记录。</p>
      </div>
    </Page>,
    <Page key="05-24" number="24">
      <div className="flex h-full flex-col">
        <Heading title="2. 听见过去时" description="比较现在时和过去时，捕捉句尾中的 ㅆ 音及缩约后的整体声音。" icon={<Headphones size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.chinese24)} onClick={() => toggle("chinese24")} />} />
        <div className="mt-4 space-y-3">
          {[
            ["친구를 만나요. ／ 친구를 만났어요.", "现在见面 ／ 过去见了"],
            ["영화를 봐요. ／ 영화를 봤어요.", "现在看 ／ 过去看了"],
            ["밥을 먹어요. ／ 밥을 먹었어요.", "现在吃 ／ 过去吃了"],
            ["공부해요. ／ 공부했어요.", "现在学习 ／ 过去学习了"],
          ].map(([pair, meaning], index) => (
            <button key={pair} type="button" onClick={() => speak(pair.replace("／", ""))} className="w-full rounded-2xl border border-[#cfdfeb] bg-white p-4 text-left">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black">PAIR {index + 1}</p><Volume2 size={15} className="text-[#3e7fa3]" />
              </div>
              <p className="mt-3 text-sm font-black">{pair}</p>
              <p className={`mt-1 text-[10px] font-bold text-[#71857b] ${revealed.chinese24 ? "opacity-100" : "opacity-0"}`}>{meaning}</p>
            </button>
          ))}
        </div>
        <NoteBox label="跟读方法" tone="blue">
          不要把 ㅆ 单独拖出来读。先听整块“봤어요／했어요”，再用现在—过去成对跟读。
        </NoteBox>
      </div>
    </Page>,
    <Page key="05-25" number="25">
      <div className="flex h-full flex-col">
        <Heading title="3. 我的周末记忆路线" description="用 45 秒讲述三个时间点、三个动作和一个原因结果。" icon={<Mic2 size={22} />} />
        <div className="mt-5 grid grid-cols-2 gap-4">
          <section className="rounded-2xl border border-[#cfdfeb] bg-white p-5">
            <p className="text-xs font-black text-[#3e7fa3]">时间轴脚手架</p>
            <div className="mt-4 space-y-3 text-xs leading-6">
              <p>① 토요일에 ______.</p>
              <p>② ______하고／고 ______.</p>
              <p>③ 일요일에는 ______.</p>
              <p>④ 일요일에 ______고 ______.</p>
            </div>
          </section>
          <section className="rounded-2xl bg-[#eaf4fa] p-5">
            <p className="text-xs font-black text-[#3e7fa3]">示范</p>
            <p className="mt-4 text-sm font-black leading-7">
              토요일에 친구를 만났어요. 밥을 먹고 사진을 찍었어요.
              일요일에는 책을 읽고 집에서 쉬었어요.
            </p>
            <button type="button" onClick={() => speak("토요일에 친구를 만났어요. 밥을 먹고 사진을 찍었어요. 일요일에는 책을 읽고 집에서 쉬었어요.")} className="mt-4 rounded-full bg-white px-4 py-2 text-[11px] font-black text-[#3e7fa3]">播放示范</button>
          </section>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 text-[11px]">
          {["正确说出日期或星期", "具体时间 + 에 1 次", "过去式至少 3 个", "-고 连接至少 1 次"].map((item) => (
            <label key={item} className="flex items-center gap-2 rounded-xl bg-[#f7faf8] p-3"><input type="checkbox" className="accent-[#3e7fa3]" />{item}</label>
          ))}
        </div>
        <p className="mt-auto text-center text-[11px] font-bold text-[#71857b]">先画四格时间轴，再开口；画面会帮助你保持事件顺序。</p>
      </div>
    </Page>,
    <Page key="05-26" number="26">
      <KoreanEbookSectionDivider
        step="STEP 07"
        title="读写拓展"
        goal="阅读一篇周末记录识别日期、星期与动作顺序，再写出有清晰时间线的迷你日记。"
        icon={<BookOpenCheck size={24} />}
      />
    </Page>,
    <Page key="05-27" number="27">
      <div className="flex h-full flex-col">
        <Heading title="1. 阅读 · 수진 씨의 주말" description="圈出日期与星期，给过去式画线，用箭头连接 -고 前后的动作。" icon={<BookOpenCheck size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.reading)} onClick={() => toggle("reading")} answer />} />
        <section className="mt-5 rounded-2xl bg-[#eef8f4] p-5">
          <p className="text-sm font-black leading-8">
            토요일에 수진 씨는 친구를 만났어요. 같이 점심을 먹고 공원에서 산책했어요.
            사진도 많이 찍었어요. 일요일에는 비가 왔어요. 그래서 밖에 안 갔어요.
            집에서 책을 읽고 텔레비전을 봤어요.
          </p>
        </section>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className={`rounded-xl border border-[#cfe3d9] bg-white p-4 ${revealed.reading ? "opacity-100" : "opacity-0"}`}>
            <p className="font-black text-[#347b69]">星期六</p>
            <p className="mt-2 leading-6">见朋友 → 吃午饭 → 散步 → 拍照</p>
          </div>
          <div className={`rounded-xl border border-[#cfe3d9] bg-white p-4 ${revealed.reading ? "opacity-100" : "opacity-0"}`}>
            <p className="font-black text-[#347b69]">星期日</p>
            <p className="mt-2 leading-6">下雨 → 所以没出门 → 看书、看电视</p>
          </div>
        </div>
        <NoteBox label="阅读问题" tone="green">
          1. 토요일에 누구를 만났어요?<br />
          2. 공원에서 뭐 했어요?<br />
          3. 왜 일요일에 밖에 안 갔어요?
        </NoteBox>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-[#e7f5f1] px-4 py-3 text-xs font-bold text-[#347b69]">
          <span>阅读顺序：圈时间词 → 标过去式 ㅆ → 用箭头连接 -고 两侧动作。</span>
          <KoreanEbookSpeakButton text="같이 점심을 먹고 공원에서 산책했어요." onSpeak={speak} compact />
        </div>
      </div>
    </Page>,
    <Page key="05-28" number="28">
      <div className="flex h-full flex-col">
        <Heading title="2. 写作 · 四格周末日记" description="每格只写一句，但四句必须构成有时间、有顺序、有原因的完整故事。" icon={<PencilLine size={22} />} />
        <div className="mt-5 grid grid-cols-2 gap-3">
          {[
            ["01 · 时间起点", "______에 ______았／었어요."],
            ["02 · 动作发展", "______고 ______았／었어요."],
            ["03 · 第二时间点", "일요일에 ______았／었어요."],
            ["04 · 动作收尾", "______고 ______았／었어요."],
          ].map(([title, template]) => (
            <section key={title} className="rounded-2xl border border-[#cfe3d9] bg-white p-5">
              <p className="text-[10px] font-black text-[#347b69]">{title}</p>
              <p className="mt-3 text-sm font-black">{template}</p>
              <div className="mt-4 h-10 rounded-lg border-b border-dashed border-[#a8bbb2]" />
            </section>
          ))}
        </div>
        <NoteBox label="创新要求：让结果改变故事" tone="green">
          不要只写“做了A，又做了B”。让星期六和星期日各有不同活动，
          并使用 -고 把相关动作连成自然的时间线。
        </NoteBox>
        <p className="mt-auto rounded-xl bg-[#f7faf8] p-3 text-[11px] font-bold">写完后圈出所有 ㅆ，并确认 -고 前面的动词没有变过去时。</p>
      </div>
    </Page>,
    <Page key="05-29" number="29">
      <KoreanEbookSectionDivider
        step="STEP 08"
        title="自测与复盘"
        goal="先做动词转换，再完成十题检测和一段口语叙事，确认时间系统已经连通。"
        icon={<CheckCircle2 size={24} />}
      />
    </Page>,
    <Page key="05-30" number="30">
      <div className="flex h-full flex-col">
        <Heading title="1. 两秒过去式挑战" description="看到词典形后两秒内说出过去式，再展开核对。" icon={<History size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.past)} onClick={() => toggle("past")} answer />} />
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {[
            ["가다", "갔어요"], ["오다", "왔어요"], ["보다", "봤어요"],
            ["만나다", "만났어요"], ["먹다", "먹었어요"], ["마시다", "마셨어요"],
            ["읽다", "읽었어요"], ["듣다", "들었어요"], ["찍다", "찍었어요"],
            ["공부하다", "공부했어요"], ["산책하다", "산책했어요"], ["미안하다", "미안했어요"],
          ].map(([base, answer], index) => (
            <article key={base} className="rounded-xl border border-[#cfe3d4] bg-white p-3 text-center">
              <p className="text-[10px] font-black text-[#487a54]">{String(index + 1).padStart(2, "0")}</p>
              <p className="mt-1 text-sm font-black">{base}</p>
              <p className={`mt-2 rounded-lg bg-[#e8f4eb] p-2 text-[11px] font-black text-[#487a54] ${revealed.past ? "opacity-100" : "opacity-0"}`}>{answer}</p>
            </article>
          ))}
        </div>
        <p className="mt-auto text-center text-[11px] text-[#83948b]">10 个以上在两秒内完成：进入综合检测；否则回到第 15 页继续三态训练。</p>
      </div>
    </Page>,
    <Page key="05-31" number="31">
      <div className="flex h-full flex-col">
        <Heading title="2. 十题综合检测" description="同时检查日期星期、时间助词、过去式和 -고。" icon={<ClipboardCheck size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.test)} onClick={() => toggle("test")} answer />} />
        <div className="mt-4 grid grid-cols-2 gap-2">
          {[
            ["6月的正确写法", "유월"], ["10月的正确写法", "시월"],
            ["어제(에／×) 만났어요", "어제 만났어요"], ["금요일(에／×) 만나요", "금요일에 만나요"],
            ["가다 的过去式", "갔어요"], ["공부하다 的过去式", "공부했어요"],
            ["见朋友后吃饭", "친구를 만나고 밥을 먹었어요"], ["看书并看电视", "책을 읽고 텔레비전을 봤어요"],
            ["今天是星期几？", "오늘이 무슨 요일이에요?"], ["今天后面能否加 에", "不能"],
          ].map(([question, answer], index) => (
            <article key={question} className="rounded-xl border border-[#cfe3d4] bg-white p-2.5">
              <p className="text-[11px] font-black"><span className="mr-2 text-[#487a54]">{index + 1}.</span>{question}</p>
              <p className={`mt-1.5 rounded-lg bg-[#e8f4eb] px-2 py-1.5 text-[10px] font-black text-[#487a54] ${revealed.test ? "opacity-100" : "opacity-0"}`}>{answer}</p>
            </article>
          ))}
        </div>
        <p className="mt-auto text-center text-[11px] text-[#83948b]">9—10题：进入口语验收；8题以下：按错误类型返回对应语法页。</p>
      </div>
    </Page>,
    <Page key="05-32" number="32">
      <div className="flex h-full flex-col">
        <Heading title="3. 口语验收 · 过去的一天" description="不看稿讲述 45 秒，并回答“什么时候”和“为什么”两个追问。" icon={<Mic2 size={22} />} />
        <section className="mt-5 rounded-2xl border border-[#cfe3d4] bg-[#f2f8f3] p-5">
          <p className="text-xs font-black text-[#487a54]">四项必达信息</p>
          <ol className="mt-4 grid grid-cols-2 gap-3 text-xs leading-6">
            {["正确说出一个日期和星期", "一次时间名词 + 에", "三个正确过去式", "一次 -고 动作连接"].map((task, index) => (
              <li key={task} className="rounded-xl bg-white p-4 font-bold"><span className="mr-2 text-[#487a54]">{index + 1}.</span>{task}</li>
            ))}
          </ol>
        </section>
        <div className="mt-5 grid grid-cols-2 gap-4">
          <section className="rounded-2xl border border-[#dce8e1] bg-white p-5">
            <p className="text-xs font-black">时态自检</p>
            <div className="mt-4 space-y-3 text-xs">
              {["ㅏ／ㅗ → 았어요", "其他元音 → 었어요", "하다 → 했어요", "-고 前不放过去时"].map((item) => (
                <label key={item} className="flex items-center gap-3"><input type="checkbox" className="h-4 w-4 accent-[#487a54]" />{item}</label>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-[#eadfcf] bg-[#fffaf2] p-5">
            <p className="text-xs font-black text-[#9b6b32]">追问卡</p>
            <div className="mt-4 space-y-3 text-xs leading-5">
              <p>□ 언제 만났어요?</p>
              <p>□ 누구를 만났어요?</p>
              <p>□ 만나고 뭐 했어요?</p>
              <p>□ 왜 집에 있었어요?</p>
            </div>
          </section>
        </div>
        <button type="button" onClick={() => speak("오월 십일은 토요일이에요. 토요일에 친구를 만났어요. 같이 밥을 먹고 사진을 찍었어요. 일요일에는 책을 읽고 집에서 쉬었어요.")} className="mt-auto flex items-center justify-center gap-2 rounded-2xl bg-[#487a54] p-4 text-sm font-black text-white"><Volume2 size={16} />播放最终示范</button>
      </div>
    </Page>,
    <Page key="05-33-ending" number="33">
      <div className="flex h-full flex-col justify-center">
        <div className="mx-auto w-full max-w-[440px] text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f4eb] text-[#487a54]"><Sparkles size={27} /></span>
          <p className="mt-4 text-xs font-black tracking-[0.18em] text-[#487a54]">LESSON 05 · COMPLETE</p>
          <h2 className="mt-3 text-[34px] font-black text-[#1f2e28]">주말에 친구를 만났어요.</h2>
          <p className="mt-3 text-lg font-black text-[#303432]">你已经完成第五课</p>
          <p className="mx-auto mt-3 max-w-[380px] text-sm leading-7 text-[#60736a]">
            你已经能读日期和星期、说明动作发生的时间，并用过去时和 -고 讲述一段完整经历。
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-left">
            {[
              ["01", "日期星期", "날짜와 요일"],
              ["02", "标记时间", "N에"],
              ["03", "讲述过去", "V-았／었-"],
              ["04", "连接动作", "V-고"],
            ].map(([number, title, detail]) => (
              <div key={number} className="rounded-xl border border-[#dce8e1] bg-white px-4 py-3">
                <p className="text-[10px] font-black text-[#487a54]">{number}</p>
                <p className="mt-1 text-xs font-black">{title}</p>
                <p className="mt-1 text-[10px] leading-4 text-[#71857b]">{detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-[#cfe3d4] bg-[#f2f8f3] px-5 py-3.5 text-left">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black tracking-[0.14em] text-[#487a54]">LESSON 5 TEST · 本课测试</p>
                <p className="mt-1 text-xs font-bold text-[#52685e]">前往章节测试专区，检验日期星期、时间助词、过去时与动作顺序。</p>
              </div>
              <button type="button" onClick={() => window.location.assign("/dashboard/assignments/korean")} className="shrink-0 rounded-full bg-white px-3 py-2 text-[10px] font-black text-[#487a54] shadow-sm">前往测试专区</button>
            </div>
          </div>
          <div className="mt-4 rounded-2xl bg-[#eaf2fb] px-5 py-3.5 text-left">
            <p className="text-[10px] font-black tracking-[0.14em] text-[#3d6f9f]">NEXT · LESSON 06</p>
            <div className="mt-2 flex items-end justify-between gap-4">
              <div>
                <p className="text-lg font-black text-[#243d35]">얼마예요?</p>
                <p className="mt-1 text-[11px] text-[#60736a]">下一课：学习购物数量、价格与实际交易表达。</p>
              </div>
              <button type="button" onClick={() => flipBookRef.current?.pageFlip()?.flip(1)} className="shrink-0 rounded-full bg-white px-3 py-2 text-[10px] font-black text-[#3d6f9f] shadow-sm">返回目录</button>
            </div>
          </div>
          <p className="mt-1 text-[11px] font-bold text-[#6c7d74]">能讲述昨天，意味着你的韩语第一次拥有了时间。</p>
        </div>
      </div>
    </Page>,
  ];

  return (
    <section ref={containerRef} className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden">
      <div className="relative shrink-0" style={{ width: BOOK_WIDTH * scale, height: BOOK_HEIGHT * scale }}>
        <button type="button" onClick={() => flipBookRef.current?.pageFlip()?.flipPrev()} aria-label="上一页" className="absolute -left-14 top-1/2 z-20 -translate-y-1/2 rounded-full border border-[#cfe2d9] bg-white p-3 text-[#238777] shadow-lg transition hover:bg-[#e9f6f1]"><ArrowLeft size={18} /></button>
        <button type="button" onClick={() => flipBookRef.current?.pageFlip()?.flipNext()} aria-label="下一页" className="absolute -right-14 top-1/2 z-20 -translate-y-1/2 rounded-full border border-[#cfe2d9] bg-white p-3 text-[#238777] shadow-lg transition hover:bg-[#e9f6f1]"><ArrowRight size={18} /></button>
        <div className="absolute left-0 top-0 h-[822px] w-[1180px] origin-top-left" style={{ transform: `scale(${scale})` }}>
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
            <Page number="封面" cover>
              <KoreanEbookCover lesson={lesson} />
            </Page>
            {pages}
          </HTMLFlipBook>
        </div>
      </div>
    </section>
  );
}
