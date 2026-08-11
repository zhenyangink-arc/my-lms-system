"use client";

import dynamic from "next/dynamic";

const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false });
import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Bus,
  CheckCircle2,
  CircleParking,
  Headphones,
  MapPinned,
  MessageCircle,
  Mic2,
  Navigation,
  NotebookPen,
  Route,
  Sparkles,
  TrainFront,
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

type Speak = (text: string) => void;
type Line = { speaker: string; korean: string; chinese: string };
type Card = { label: string; korean: string; chinese: string };
type Word = { korean: string; pronunciation?: string; type: string; chinese: string };
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
  { step: "第八步", label: "自测与复盘", dividerPage: 29, contentPages: [30, 31, 32, 33, 34, 35] },
]);

const Page = forwardRef<
  HTMLDivElement,
  { children: ReactNode; number: string; cover?: boolean }
>(function Page({ children, number, cover = false }, ref) {
  return (
    <KoreanEbookPage
      ref={ref}
      number={number}
      header={TEMPLATE.headers[number] ?? "第 13 课 · 서울역으로 가 주세요"}
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
  tone = "blue",
}: {
  title: string;
  children: ReactNode;
  tone?: "blue" | "rose" | "green" | "amber";
}) {
  const tones = {
    blue: "border-[#cfddec] bg-[#f1f6fb]",
    rose: "border-[#ead0d6] bg-[#fff4f6]",
    green: "border-[#cfe3d4] bg-[#f2f8f3]",
    amber: "border-[#ead8be] bg-[#fff8ed]",
  };
  return (
    <section className={`mt-4 rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-[11px] font-black">{title}</p>
      <div className="mt-2 text-xs font-bold leading-6 text-[#45574f]">{children}</div>
    </section>
  );
}

function SpeakLine({
  text,
  speak,
  children,
}: {
  text: string;
  speak: Speak;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="min-w-0">{children ?? text}</span>
      <KoreanEbookSpeakButton text={text} onSpeak={speak} compact />
    </div>
  );
}

function WordGrid({
  words,
  speak,
  showChinese,
}: {
  words: Word[];
  speak: Speak;
  showChinese: boolean;
}) {
  return (
    <div
      className={`mt-4 grid grid-cols-3 gap-3 ${
        showChinese ? "" : "[&_[data-vocab-meaning]]:opacity-0"
      }`}
    >
      {words.map((word) => (
        <KoreanEbookVocabularyCard
          key={`${word.korean}-${word.type}-${word.chinese}`}
          {...word}
          onSpeak={speak}
          compact={words.length > 12}
        />
      ))}
    </div>
  );
}

function CardGrid({
  cards,
  speak,
  showChinese,
}: {
  cards: Card[];
  speak: Speak;
  showChinese: boolean;
}) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      {cards.map((card) => (
        <article
          key={`${card.label}-${card.korean}`}
          className="min-h-[82px] rounded-2xl border border-[#cfddec] bg-white p-5"
        >
          <b className="text-[10px] text-[#3d6f9f]">{card.label}</b>
          <div className="mt-2 text-sm font-black">
            <SpeakLine text={card.korean} speak={speak} />
          </div>
          <p
            className={`mt-1 text-[10px] text-[#71857b] ${
              showChinese ? "opacity-100" : "opacity-0"
            }`}
          >
            {card.chinese}
          </p>
        </article>
      ))}
    </div>
  );
}

function Dialogue({
  lines,
  speak,
  showChinese,
}: {
  lines: Line[];
  speak: Speak;
  showChinese: boolean;
}) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      {lines.map((line, index) => (
        <div
          key={`${index}-${line.speaker}-${line.korean}`}
          className={`flex gap-2 rounded-xl p-3.5 ${
            index % 2 ? "bg-[#fff7ed]" : "bg-[#f4f8f6]"
          }`}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-black">
            {line.speaker}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-black leading-6">{line.korean}</p>
            <p
              className={`text-[10px] font-bold leading-5 text-[#71857b] ${
                showChinese ? "opacity-100" : "opacity-0"
              }`}
            >
              {line.chinese}
            </p>
          </div>
          <KoreanEbookSpeakButton text={line.korean} onSpeak={speak} compact />
        </div>
      ))}
    </div>
  );
}

function Exercise({
  items,
  shown,
}: {
  items: Array<[string, string]>;
  shown: boolean;
}) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-3">
      {items.map(([question, answer]) => (
        <article
          key={`${question}-${answer}`}
          className={`rounded-xl border border-[#cfe3d4] bg-white text-xs font-black ${
            items.length > 10 ? "min-h-[58px] p-3" : "min-h-[68px] p-4"
          }`}
        >
          <span>{question}</span>
          <p
            className={`mt-3 leading-5 text-[#347b69] ${
              shown ? "opacity-100" : "opacity-0"
            }`}
          >
            {answer}
          </p>
        </article>
      ))}
    </div>
  );
}

const transportWords: Word[] = [
  { korean: "버스", pronunciation: "버스", type: "交通工具", chinese: "公交车" },
  { korean: "지하철", pronunciation: "지하철", type: "交通工具", chinese: "地铁" },
  { korean: "택시", pronunciation: "택씨", type: "交通工具", chinese: "出租车" },
  { korean: "기차", pronunciation: "기차", type: "交通工具", chinese: "火车" },
  { korean: "비행기", pronunciation: "비행기", type: "交通工具", chinese: "飞机" },
  { korean: "자전거", pronunciation: "자전거", type: "交通工具", chinese: "自行车" },
  { korean: "자동차", pronunciation: "자동차", type: "交通工具", chinese: "汽车" },
  { korean: "고속버스", pronunciation: "고속뻐스", type: "交通工具", chinese: "高速巴士" },
  { korean: "배", pronunciation: "배", type: "交通工具", chinese: "船" },
];

const movementWords: Word[] = [
  { korean: "타다", pronunciation: "타다", type: "移动动词", chinese: "乘坐" },
  { korean: "내리다", pronunciation: "내리다", type: "移动动词", chinese: "下车" },
  { korean: "갈아타다", pronunciation: "가라타다", type: "移动动词", chinese: "换乘" },
  { korean: "걸어가다", pronunciation: "거러가다", type: "移动动词", chinese: "走着去" },
  { korean: "출발하다", pronunciation: "출발하다", type: "移动动词", chinese: "出发" },
  { korean: "도착하다", pronunciation: "도차카다", type: "移动动词", chinese: "到达" },
  { korean: "걸리다", pronunciation: "걸리다", type: "交通动词", chinese: "花费时间" },
  { korean: "막히다", pronunciation: "마키다", type: "交通动词", chinese: "堵塞／堵车" },
  { korean: "세우다", pronunciation: "세우다", type: "交通动词", chinese: "停车" },
  { korean: "지나다", pronunciation: "지나다", type: "移动动词", chinese: "经过" },
  { korean: "건너다", pronunciation: "건너다", type: "移动动词", chinese: "穿过／横过" },
  { korean: "돌아가다", pronunciation: "도라가다", type: "移动动词", chinese: "转弯／绕行" },
];

const facilityWords: Word[] = [
  { korean: "역", pronunciation: "역", type: "交通设施", chinese: "站／车站" },
  { korean: "정류장", pronunciation: "정뉴장", type: "交通设施", chinese: "公交车站" },
  { korean: "승강장", pronunciation: "승강장", type: "交通设施", chinese: "站台" },
  { korean: "출구", pronunciation: "출구", type: "交通设施", chinese: "出口" },
  { korean: "입구", pronunciation: "입꾸", type: "交通设施", chinese: "入口" },
  { korean: "교통카드", pronunciation: "교통카드", type: "交通用品", chinese: "交通卡" },
  { korean: "표", pronunciation: "표", type: "交通用品", chinese: "票" },
  { korean: "노선", pronunciation: "노선", type: "交通名词", chinese: "线路" },
  { korean: "환승", pronunciation: "환승", type: "交通名词", chinese: "换乘" },
  { korean: "오른쪽", pronunciation: "오른쪽", type: "方向词", chinese: "右边" },
  { korean: "왼쪽", pronunciation: "왼쪽", type: "方向词", chinese: "左边" },
  { korean: "똑바로", pronunciation: "똑빠로", type: "方向词", chinese: "一直／径直" },
];

const pronunciationWords: Word[] = [
  { korean: "서울역", pronunciation: "서울력", type: "车站发音", chinese: "首尔站" },
  { korean: "강남역", pronunciation: "강남녁", type: "车站发音", chinese: "江南站" },
  { korean: "지하철역", pronunciation: "지하철력", type: "车站发音", chinese: "地铁站" },
  { korean: "갈아타요", pronunciation: "가라타요", type: "连音", chinese: "换乘" },
  { korean: "몇 번", pronunciation: "멷 뻔", type: "音变", chinese: "几号／几次" },
  { korean: "버스를 타요", pronunciation: "버스를 타요", type: "乘车词块", chinese: "坐公交车" },
  { korean: "역에서 내려요", pronunciation: "여게서 내려요", type: "下车词块", chinese: "在车站下车" },
  { korean: "시간이 걸려요", pronunciation: "시가니 걸려요", type: "时间词块", chinese: "需要时间" },
  { korean: "길이 막혀요", pronunciation: "기리 마켜요", type: "路况词块", chinese: "堵车" },
];

const dividers: Record<
  string,
  { step: string; title: string; goal: string; icon: ReactNode }
> = {
  "02": {
    step: "第一步",
    title: "课前导航",
    goal: "建立“说明计划—选择交通工具—确认路线—提出请求—到达目的地”的交际链。",
    icon: <MapPinned size={24} />,
  },
  "04": {
    step: "第二步",
    title: "核心词汇",
    goal: "掌握交通工具、移动动词、交通设施、方向词和车站发音。",
    icon: <Bus size={24} />,
  },
  "09": {
    step: "第三步",
    title: "语法讲解",
    goal: "四个语法各占一页：计划、地点起终点、请求与方向／交通手段。",
    icon: <NotebookPen size={24} />,
  },
  "14": {
    step: "第四步",
    title: "句型操练",
    goal: "把旅行计划、路线、交通工具和司机请求组合成完整表达。",
    icon: <Route size={24} />,
  },
  "18": {
    step: "第五步",
    title: "实战对话",
    goal: "完成出租车、地铁问路和假期计划三组八句交通对话。",
    icon: <MessageCircle size={24} />,
  },
  "22": {
    step: "第六步",
    title: "听说任务",
    goal: "从路线说明中抓住出发地、换乘站、出口、时间与交通方式。",
    icon: <Headphones size={24} />,
  },
  "26": {
    step: "第七步",
    title: "读写拓展",
    goal: "读懂交通路线说明，并写出从出发地到目的地的完整路线。",
    icon: <BookOpenCheck size={24} />,
  },
  "29": {
    step: "第八步",
    title: "自测与复盘",
    goal: "检查交通词汇、四项语法、发音和完整出行交际能力。",
    icon: <CheckCircle2 size={24} />,
  },
};

export function KoreanLevelOneLessonThirteenBook({
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
  const toggle = (key: string) =>
    setRevealed((current) => ({ ...current, [key]: !current[key] }));
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

  const content = (
    number: string,
    title: string,
    description: string,
    icon: ReactNode,
    body: ReactNode,
    action?: ReactNode
  ) => (
    <div className="flex h-full flex-col">
      <Heading
        page={number}
        title={title}
        description={description}
        icon={icon}
        action={action}
      />
      {body}
    </div>
  );

  const dialogues: Record<
    string,
    { title: string; description: string; lines: Line[] }
  > = {
    "19": {
      title: "场景 1 · 出租车去首尔站",
      description: "告诉司机目的地，询问时间，并在安全地点请求停车。",
      lines: [
        { speaker: "A", korean: "기사님, 서울역으로 가 주세요.", chinese: "师傅，请带我去首尔站。" },
        { speaker: "B", korean: "네, 알겠습니다. 어느 길로 갈까요?", chinese: "好的。走哪条路呢？" },
        { speaker: "A", korean: "시간이 얼마나 걸려요?", chinese: "需要多长时间？" },
        { speaker: "B", korean: "지금은 길이 조금 막혀요.", chinese: "现在路上有点堵。" },
        { speaker: "A", korean: "그럼 삼십 분쯤 걸려요?", chinese: "那么大约需要三十分钟吗？" },
        { speaker: "B", korean: "네, 아마 그 정도 걸릴 거예요.", chinese: "是的，大概需要那么久。" },
        { speaker: "A", korean: "서울역 앞에서 세워 주세요.", chinese: "请在首尔站前面停车。" },
        { speaker: "B", korean: "네, 도착했습니다.", chinese: "好的，到了。" },
      ],
    },
    "20": {
      title: "场景 2 · 地铁换乘问路",
      description: "确认乘车区间、换乘站和出口号码。",
      lines: [
        { speaker: "A", korean: "서울역에서 경복궁에 가려고 해요. 어떻게 가요?", chinese: "我打算从首尔站去景福宫。怎么走？" },
        { speaker: "B", korean: "서울역에서 충무로역까지 4호선을 타세요.", chinese: "从首尔站到忠武路站请乘坐4号线。" },
        { speaker: "A", korean: "충무로역에서 갈아타요?", chinese: "在忠武路站换乘吗？" },
        { speaker: "B", korean: "네, 3호선으로 갈아타세요.", chinese: "是的，请换乘3号线。" },
        { speaker: "A", korean: "몇 번 출구로 나가요?", chinese: "从几号出口出去？" },
        { speaker: "B", korean: "5번 출구로 나가세요.", chinese: "请从5号出口出去。" },
        { speaker: "A", korean: "시간이 얼마나 걸려요?", chinese: "需要多长时间？" },
        { speaker: "B", korean: "이십오 분쯤 걸려요.", chinese: "大约需要二十五分钟。" },
      ],
    },
    "21": {
      title: "场景 3 · 安排假期旅行",
      description: "用计划表达和交通手段说明完整旅行安排。",
      lines: [
        { speaker: "A", korean: "이번 방학에 뭐 하려고 해요?", chinese: "这个假期打算做什么？" },
        { speaker: "B", korean: "부산으로 여행을 가려고 해요.", chinese: "我打算去釜山旅行。" },
        { speaker: "A", korean: "서울에서 부산까지 어떻게 가요?", chinese: "从首尔到釜山怎么去？" },
        { speaker: "B", korean: "기차로 가려고 해요.", chinese: "我打算坐火车去。" },
        { speaker: "A", korean: "기차표를 샀어요?", chinese: "买火车票了吗？" },
        { speaker: "B", korean: "아직 안 샀어요. 오늘 사려고 해요.", chinese: "还没买。今天打算买。" },
        { speaker: "A", korean: "부산에서 어디에 갈 거예요?", chinese: "在釜山要去哪里？" },
        { speaker: "B", korean: "바다에 가고 시장도 구경할 거예요.", chinese: "要去海边，也会逛市场。" },
      ],
    },
  };

  function renderPage(number: string) {
    if (number === "01") {
      return (
        <KoreanEbookTableOfContents
          lessonNumber={13}
          pageMeta={TEMPLATE.pageMeta}
          onNavigate={(target) => flipBookRef.current?.pageFlip()?.flip(target)}
          entries={[
            { step: "01", title: "课前导航", pageRange: "02—03", detail: "建立完整出行流程" },
            { step: "02", title: "核心词汇", pageRange: "04—08", detail: "工具·移动·设施·发音" },
            { step: "03", title: "语法讲解", pageRange: "09—13", detail: "四项交通核心语法" },
            { step: "04", title: "句型操练", pageRange: "14—17", detail: "计划·路线·请求" },
            { step: "05", title: "实战对话", pageRange: "18—21", detail: "三组八句交通交流" },
            { step: "06", title: "听说任务", pageRange: "22—25", detail: "听路线·说路线" },
            { step: "07", title: "读写拓展", pageRange: "26—28", detail: "读行程·写路线" },
            { step: "08", title: "自测与复盘", pageRange: "29—35", detail: "综合验收与结束页" },
          ]}
        />
      );
    }
    if (dividers[number]) {
      return <KoreanEbookSectionDivider {...dividers[number]} />;
    }
    if (dialogues[number]) {
      const dialogue = dialogues[number];
      return content(
        number,
        dialogue.title,
        dialogue.description,
        <MessageCircle size={22} />,
        <>
          <Dialogue
            lines={dialogue.lines}
            speak={speak}
            showChinese={Boolean(revealed[`chinese${number}`])}
          />
          <Note title="角色交换" tone="rose">
            替换目的地、交通工具、换乘站和时间，再完成一轮不少于八句的交通对话。
          </Note>
        </>,
        <KoreanEbookRevealButton
          shown={Boolean(revealed[`chinese${number}`])}
          onClick={() => toggle(`chinese${number}`)}
        />
      );
    }

    const pages: Record<string, ReactNode> = {
      "03": content(
        "03",
        "一次出行的五步路线",
        "先说计划，再确认起终点、选择交通工具、提出请求，最后确认时间。",
        <Route size={22} />,
        <>
          <CardGrid
            cards={[
              { label: "计划", korean: "서울에 가려고 해요.", chinese: "打算去首尔。" },
              { label: "区间", korean: "집에서 역까지 걸어가요.", chinese: "从家走到车站。" },
              { label: "交通", korean: "지하철로 가요.", chinese: "坐地铁去。" },
              { label: "请求", korean: "서울역으로 가 주세요.", chinese: "请带我去首尔站。" },
              { label: "换乘", korean: "시청역에서 2호선으로 갈아타요.", chinese: "在市厅站换乘2号线。" },
              { label: "时间", korean: "삼십 분쯤 걸려요.", chinese: "大约需要30分钟。" },
            ]}
            speak={speak}
            showChinese={Boolean(revealed.chinese03)}
          />
          <Note title="最终任务" tone="amber">
            完成一段10句交通交流：说出计划、起点、终点、交通工具、换乘地点、出口和预计时间。
          </Note>
        </>,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.chinese03)}
          onClick={() => toggle("chinese03")}
        />
      ),
      "05": content(
        "05",
        "1. 交通工具",
        "交通工具既可以作타다的宾语，也可以接-(으)로表示出行手段。",
        <Bus size={22} />,
        <>
          <WordGrid
            words={transportWords}
            speak={speak}
            showChinese={Boolean(revealed.chinese05)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Note title="타다 搭配">
              <SpeakLine text="버스를 타고 회사에 가요." speak={speak} />
              <span className={revealed.chinese05 ? "" : "opacity-0"}>坐公交车去公司。</span>
            </Note>
            <Note title="-(으)로 搭配" tone="green">
              <SpeakLine text="지하철로 가면 빨라요." speak={speak} />
              <span className={revealed.chinese05 ? "" : "opacity-0"}>坐地铁去的话很快。</span>
            </Note>
          </div>
        </>,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.chinese05)}
          onClick={() => toggle("chinese05")}
        />
      ),
      "06": content(
        "06",
        "2. 交通与移动动词",
        "乘车、下车、换乘和花费时间都有固定助词搭配。",
        <TrainFront size={22} />,
        <>
          <WordGrid
            words={movementWords}
            speak={speak}
            showChinese={Boolean(revealed.chinese06)}
          />
          <Note title="搭配优先">
            버스를 타요／서울역에서 내려요／시청역에서 갈아타요／삼십 분 걸려요。
          </Note>
        </>,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.chinese06)}
          onClick={() => toggle("chinese06")}
        />
      ),
      "07": content(
        "07",
        "3. 交通设施与方向",
        "在真实车站里，出口、站台、线路和方向词比单个地名更重要。",
        <MapPinned size={22} />,
        <>
          <WordGrid
            words={facilityWords}
            speak={speak}
            showChinese={Boolean(revealed.chinese07)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Note title="出口指示">
              <SpeakLine text="3번 출구로 나가세요." speak={speak} />
              <span className={revealed.chinese07 ? "" : "opacity-0"}>请从3号出口出去。</span>
            </Note>
            <Note title="站台指示" tone="green">
              <SpeakLine text="이쪽 승강장에서 기다리세요." speak={speak} />
              <span className={revealed.chinese07 ? "" : "opacity-0"}>请在这边站台等候。</span>
            </Note>
          </div>
        </>,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.chinese07)}
          onClick={() => toggle("chinese07")}
        />
      ),
      "08": content(
        "08",
        "4. 车站发音与交通词块",
        "站名遇到역时常出现ㄴ或ㄹ添加；先听整体，再记拼写。",
        <Headphones size={22} />,
        <>
          <WordGrid
            words={pronunciationWords}
            speak={speak}
            showChinese={Boolean(revealed.chinese08)}
          />
          <Note title="听报站提示" tone="rose">
            강남역写作不变，但常听成[강남녁]；지하철역常听成[지하철력]。发音变化不能反过来改变拼写。
          </Note>
        </>,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.chinese08)}
          onClick={() => toggle("chinese08")}
        />
      ),
      "10": content(
        "10",
        "1. V-(으)려고 하다",
        "表示说话人的意图或尚未实施的计划，相当于“打算……”。",
        <NotebookPen size={22} />,
        <>
          <CardGrid
            cards={[
              { label: "无收音 + 려고", korean: "제주도에 가려고 해요.", chinese: "打算去济州岛。" },
              { label: "有收音 + 으려고", korean: "점심을 먹으려고 해요.", chinese: "打算吃午饭。" },
              { label: "ㄹ收音特例", korean: "방학에 놀려고 해요.", chinese: "假期打算玩。" },
              { label: "否定计划", korean: "오늘은 안 나가려고 해요.", chinese: "今天打算不出门。" },
              { label: "旅行计划", korean: "주말에 부산을 구경하려고 해요.", chinese: "周末打算游览釜山。" },
              { label: "出发计划", korean: "아침 일찍 출발하려고 해요.", chinese: "打算早上早早出发。" },
            ]}
            speak={speak}
            showChinese={Boolean(revealed.chinese10)}
          />
          <Note title="使用限制">
            主要接动作动词，表达有意识的计划；天气、价格等无意志状态一般不能作为说话人的“打算”。
          </Note>
        </>,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.chinese10)}
          onClick={() => toggle("chinese10")}
        />
      ),
      "11": content(
        "11",
        "2. N에서 N까지",
        "连接两个地点，表示移动范围的起点和终点。",
        <Route size={22} />,
        <>
          <CardGrid
            cards={[
              { label: "步行区间", korean: "집에서 학교까지 걸어가요.", chinese: "从家走到学校。" },
              { label: "城市区间", korean: "서울에서 부산까지 기차를 타요.", chinese: "从首尔到釜山坐火车。" },
              { label: "地铁区间", korean: "시청역에서 강남역까지 가요.", chinese: "从市厅站到江南站。" },
              { label: "询问距离", korean: "여기에서 역까지 멀어요?", chinese: "从这里到车站远吗？" },
              { label: "机场路线", korean: "공항에서 호텔까지 택시로 가요.", chinese: "从机场到酒店坐出租车。" },
              { label: "短程耗时", korean: "정류장에서 집까지 오 분 걸려요.", chinese: "从车站到家需要5分钟。" },
            ]}
            speak={speak}
            showChinese={Boolean(revealed.chinese11)}
          />
          <Note title="부터～까지 vs 에서～까지" tone="amber">
            时间范围用9시부터 6시까지；地点范围用집에서 역까지。初级阶段先按“时间／地点”分开记忆。
          </Note>
        </>,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.chinese11)}
          onClick={() => toggle("chinese11")}
        />
      ),
      "12": content(
        "12",
        "3. V-아/어 주다",
        "表示为别人做某事；请求时常使用礼貌形式-아/어 주세요。",
        <CircleParking size={22} />,
        <>
          <CardGrid
            cards={[
              { label: "가다 → 가 주세요", korean: "서울역으로 가 주세요.", chinese: "请带我去首尔站。" },
              { label: "세우다 → 세워 주세요", korean: "여기에서 세워 주세요.", chinese: "请在这里停车。" },
              { label: "기다리다 → 기다려 주세요", korean: "잠깐 기다려 주세요.", chinese: "请稍等。" },
              { label: "알려 주다", korean: "가는 길을 알려 주세요.", chinese: "请告诉我路线。" },
              { label: "目的地请求", korean: "이 주소로 가 주세요.", chinese: "请去这个地址。" },
              { label: "说话速度", korean: "천천히 말해 주세요.", chinese: "请慢慢说。" },
            ]}
            speak={speak}
            showChinese={Boolean(revealed.chinese12)}
          />
          <Note title="空格与语气">
            教学书写采用가 주세요、세워 주세요。주세요使请求更礼貌，但仍应避免对陌生人使用过强命令语气。
          </Note>
        </>,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.chinese12)}
          onClick={() => toggle("chinese12")}
        />
      ),
      "13": content(
        "13",
        "4. N-(으)로",
        "表示移动方向或交通手段；根据名词最后的收音选择로／으로。",
        <Navigation size={22} />,
        <>
          <CardGrid
            cards={[
              { label: "无收音 + 로", korean: "학교로 가요.", chinese: "朝学校去。" },
              { label: "有收音 + 으로", korean: "서울역으로 가 주세요.", chinese: "请带我去首尔站。" },
              { label: "ㄹ收音 + 로", korean: "지하철로 왔어요.", chinese: "坐地铁来的。" },
              { label: "方向", korean: "오른쪽으로 가세요.", chinese: "请向右走。" },
              { label: "交通手段", korean: "버스로 회사에 가요.", chinese: "坐公交去公司。" },
              { label: "左转方向", korean: "왼쪽으로 도세요.", chinese: "请向左转。" },
            ]}
            speak={speak}
            showChinese={Boolean(revealed.chinese13)}
          />
          <Note title="判断最后一个音节" tone="rose">
            서울역最后是역，收音为ㄱ，所以用서울역으로；지하철最后收音为ㄹ，属于特例，用지하철로。
          </Note>
        </>,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.chinese13)}
          onClick={() => toggle("chinese13")}
        />
      ),
      "15": content(
        "15",
        "1. 假期计划工坊",
        "把动词变成-(으)려고 해요，并说明目的地或交通工具。",
        <NotebookPen size={22} />,
        <Exercise
          items={[
            ["제주도에 가다", "제주도에 가려고 해요."],
            ["기차표를 사다", "기차표를 사려고 해요."],
            ["친구를 만나다", "친구를 만나려고 해요."],
            ["집에서 쉬다", "집에서 쉬려고 해요."],
            ["공원에서 놀다", "공원에서 놀려고 해요."],
            ["지하철을 타다", "지하철을 타려고 해요."],
            ["서울을 구경하다", "서울을 구경하려고 해요."],
            ["아침 일찍 출발하다", "아침 일찍 출발하려고 해요."],
            ["부산에서 머무르다", "부산에서 머무르려고 해요."],
            ["호텔을 예약하다", "호텔을 예약하려고 해요."],
          ]}
          shown={Boolean(revealed.plan)}
        />,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.plan)}
          onClick={() => toggle("plan")}
          answer
        />
      ),
      "16": content(
        "16",
        "2. 起点、终点与交通工具",
        "先连接地点区间，再选择-(으)로或을/를 타다表达交通方式。",
        <Route size={22} />,
        <Exercise
          items={[
            ["家→学校／步行", "집에서 학교까지 걸어가요."],
            ["首尔→釜山／火车", "서울에서 부산까지 기차로 가요."],
            ["机场→酒店／出租车", "공항에서 호텔까지 택시를 타요."],
            ["这里→车站／公交车", "여기에서 역까지 버스로 가요."],
            ["市厅站→江南站／地铁", "시청역에서 강남역까지 지하철을 타요."],
            ["学校→图书馆／自行车", "학교에서 도서관까지 자전거로 가요."],
            ["酒店→机场／出租车", "호텔에서 공항까지 택시로 가요."],
            ["釜山→首尔／飞机", "부산에서 서울까지 비행기로 가요."],
            ["车站→景福宫／地铁", "역에서 경복궁까지 지하철로 가요."],
            ["宿舍→学校／公交", "기숙사에서 학교까지 버스로 가요."],
          ]}
          shown={Boolean(revealed.route)}
        />,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.route)}
          onClick={() => toggle("route")}
          answer
        />
      ),
      "17": content(
        "17",
        "3. 出租车请求实验",
        "把目的地、方向和动作组合成自然、礼貌的司机请求。",
        <CircleParking size={22} />,
        <Exercise
          items={[
            ["请带我去首尔站。", "서울역으로 가 주세요."],
            ["请在这里停车。", "여기에서 세워 주세요."],
            ["请向右走。", "오른쪽으로 가 주세요."],
            ["请直走。", "똑바로 가 주세요."],
            ["请稍等。", "잠깐 기다려 주세요."],
            ["请告诉我地铁站。", "지하철역을 알려 주세요."],
            ["请从5号出口出去。", "5번 출구로 나가 주세요."],
            ["请在市厅站换乘。", "시청역에서 갈아타 주세요."],
            ["请开慢一点。", "천천히 가 주세요."],
            ["请打开后备箱。", "트렁크를 열어 주세요."],
          ]}
          shown={Boolean(revealed.request)}
        />,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.request)}
          onClick={() => toggle("request")}
          answer
        />
      ),
      "23": content(
        "23",
        "1. 听力 · 地铁路线信息表",
        "听路线，记录起点、换乘站、线路、出口和预计时间。",
        <Headphones size={22} />,
        <>
          <button
            type="button"
            onClick={() =>
              speak(
                "서울역에서 경복궁까지 지하철로 가세요. 서울역에서 4호선을 타고 충무로역에서 3호선으로 갈아타세요. 경복궁역에서 내려서 5번 출구로 나가세요. 이십오 분쯤 걸려요."
              )
            }
            className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-[#3e7fa3] p-4 text-sm font-black text-white"
          >
            <Volume2 size={17} />
            播放地铁路线
          </button>
          <Exercise
            items={[
              ["目的地", "경복궁"],
              ["交通工具", "지하철"],
              ["换乘站", "충무로역"],
              ["换乘线路", "3호선"],
              ["出口", "5번 출구"],
              ["预计时间", "이십오 분쯤"],
              ["上车线路", "4호선"],
              ["下车站", "경복궁역"],
            ]}
            shown={Boolean(revealed.listening)}
          />
        </>,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.listening)}
          onClick={() => toggle("listening")}
          answer
        />
      ),
      "24": content(
        "24",
        "2. 询问交通时间",
        "用얼마나 걸려요?询问耗时，用时间数量回答。",
        <TrainFront size={22} />,
        <>
          <CardGrid
            cards={[
              { label: "询问", korean: "시간이 얼마나 걸려요?", chinese: "需要多长时间？" },
              { label: "完整区间", korean: "집에서 회사까지 얼마나 걸려요?", chinese: "从家到公司需要多久？" },
              { label: "公交车", korean: "버스로 삼십 분 걸려요.", chinese: "坐公交车需要三十分钟。" },
              { label: "堵车", korean: "길이 막혀서 한 시간 걸려요.", chinese: "因为堵车需要一小时。" },
              { label: "出租车", korean: "택시로 이십 분 걸려요.", chinese: "坐出租车需要20分钟。" },
              { label: "步行", korean: "걸어서 십 분 걸려요.", chinese: "步行需要10分钟。" },
            ]}
            speak={speak}
            showChinese={Boolean(revealed.chinese24)}
          />
          <Note title="回答公式" tone="green">
            起点에서 终点까지 + 交通工具로 + 时间 + 걸려요。
          </Note>
        </>,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.chinese24)}
          onClick={() => toggle("chinese24")}
        />
      ),
      "25": content(
        "25",
        "3. 60秒路线说明挑战",
        "不看稿说明一条包含换乘、出口和时间的完整路线。",
        <Mic2 size={22} />,
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Note title="问路者">
              ______에 가려고 해요.
              <br />
              어떻게 가요?
              <br />
              어디에서 갈아타요?
              <br />
              얼마나 걸려요?
            </Note>
            <Note title="指路者" tone="green">
              ______에서 ______까지 가세요.
              <br />
              ______으로 갈아타세요.
              <br />
              ______번 출구로 나가세요.
              <br />
              ______분쯤 걸려요.
            </Note>
            <Note title="换乘确认" tone="amber">
              몇 호선으로 갈아타요?
              <br />
              어디에서 내려요?
            </Note>
            <Note title="方向确认" tone="rose">
              어느 출구로 나가요?
              <br />
              왼쪽으로 가요?
            </Note>
          </div>
          <p className="mt-auto text-center text-[11px] font-bold text-[#71857b]">
            至少使用：-(으)려고 하다、에서～까지、-아/어 주세요、-(으)로各一次。
          </p>
        </>
      ),
      "27": content(
        "27",
        "1. 阅读 · 서울역에서 경복궁까지",
        "找出路线中的交通工具、下车站、出口、步行方向与总时间。",
        <BookOpenCheck size={22} />,
        <>
          <section className="mt-4 rounded-2xl border border-[#cfe3d4] bg-white p-5">
            <p className="text-[11px] font-black text-[#347b69]">길 안내</p>
            <p className="mt-3 text-sm font-bold leading-7">
              서울역에서 경복궁까지 지하철로 가세요. 서울역에서 4호선을 타고
              충무로역에서 3호선으로 갈아타세요. 경복궁역에서 내려서 5번
              출구로 나가세요. 출구에서 경복궁까지 똑바로 걸어가세요. 모두
              이십오 분쯤 걸려요.
            </p>
          </section>
          <Exercise
            items={[
              ["从哪里出发？", "서울역"],
              ["首先坐几号线？", "4호선"],
              ["在哪里换乘？", "충무로역"],
              ["换乘几号线？", "3호선"],
              ["从几号出口出去？", "5번 출구"],
              ["总共需要多久？", "이십오 분쯤"],
              ["在哪里下车？", "경복궁역"],
              ["出站后怎么走？", "똑바로 걸어가요"],
            ]}
            shown={Boolean(revealed.reading)}
          />
        </>,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.reading)}
          onClick={() => toggle("reading")}
          answer
        />
      ),
      "28": content(
        "28",
        "2. 写作 · 我的上学路线",
        "写7—9句原创路线说明，读者必须能够照着路线到达。",
        <NotebookPen size={22} />,
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Note title="内容骨架" tone="green">
              起点 → 终点 → 交通工具 → 上车 → 换乘 → 下车 → 出口 → 时间
            </Note>
            <Note title="语法清单" tone="amber">
              -(으)려고 하다一次
              <br />
              에서～까지一次
              <br />
              -(으)로两次
              <br />
              타다／내리다各一次
            </Note>
          </div>
          <section className="mt-4 rounded-2xl border border-dashed border-[#9fc8b9] bg-[#fbfdfa] p-5">
            <p className="text-[11px] font-black text-[#347b69]">原创示范</p>
            <p className="mt-3 text-sm font-bold leading-7">
              저는 아침에 학교에 가려고 해요. 집에서 학교까지 버스와 지하철로
              가요. 집 앞 정류장에서 273번 버스를 타요. 신촌역에서 내려서
              2호선으로 갈아타요. 홍대입구역에서 내려서 9번 출구로 나가요.
              출구에서 학교까지 걸어가요. 모두 오십 분쯤 걸려요.
            </p>
          </section>
          <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] font-black text-[#347b69]">
            {[
              "✓ 가려고 해요",
              "✓ 집에서 학교까지",
              "✓ 2호선으로 갈아타요",
              "✓ 9번 출구로 나가요",
            ].map((item) => (
              <span key={item} className="rounded-xl bg-[#f2f8f3] px-3 py-2">
                {item}
              </span>
            ))}
          </div>
        </>
      ),
      "30": content(
        "30",
        "1. 交通词汇闪测",
        "看到中文后两秒内说出韩语，并检查固定助词搭配。",
        <Bus size={22} />,
        <Exercise
          items={[
            ["公交车", "버스"],
            ["地铁", "지하철"],
            ["出租车", "택시"],
            ["火车", "기차"],
            ["换乘", "갈아타다"],
            ["下车", "내리다"],
            ["公交车站", "정류장"],
            ["出口", "출구"],
            ["交通卡", "교통카드"],
            ["堵车", "막히다"],
            ["花费时间", "걸리다"],
            ["一直走", "똑바로 가다"],
          ]}
          shown={Boolean(revealed.words)}
        />,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.words)}
          onClick={() => toggle("words")}
          answer
        />
      ),
      "31": content(
        "31",
        "2. 计划与区间检测",
        "完成-(으)려고 하다与地点에서～까지。",
        <NotebookPen size={22} />,
        <Exercise
          items={[
            ["가다 + 려고 해요", "가려고 해요."],
            ["먹다 + 으려고 해요", "먹으려고 해요."],
            ["놀다 + 려고 해요", "놀려고 해요."],
            ["여행하다 + 려고 해요", "여행하려고 해요."],
            ["家到学校", "집에서 학교까지"],
            ["首尔到釜山", "서울에서 부산까지"],
            ["这里到车站", "여기에서 역까지"],
            ["机场到酒店", "공항에서 호텔까지"],
            ["출발하다 + 려고", "출발하려고 해요."],
            ["예약하다 + 려고", "예약하려고 해요."],
          ]}
          shown={Boolean(revealed.forms)}
        />,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.forms)}
          onClick={() => toggle("forms")}
          answer
        />
      ),
      "32": content(
        "32",
        "3. 请求与方向检测",
        "根据收音选择로／으로，并完成礼貌请求。",
        <Navigation size={22} />,
        <Exercise
          items={[
            ["学校 + 로", "학교로"],
            ["家 + 으로", "집으로"],
            ["地铁 + 로", "지하철로"],
            ["首尔站 + 으로", "서울역으로"],
            ["请去。", "가 주세요."],
            ["请停车。", "세워 주세요."],
            ["请等待。", "기다려 주세요."],
            ["请告诉我。", "알려 주세요."],
            ["公交 + 로", "버스로"],
            ["请慢慢走。", "천천히 가 주세요."],
          ]}
          shown={Boolean(revealed.direction)}
        />,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.direction)}
          onClick={() => toggle("direction")}
          answer
        />
      ),
      "33": content(
        "33",
        "4. 易错点诊所",
        "纠正时间与地点范围、交通工具助词以及역结尾判断。",
        <CheckCircle2 size={22} />,
        <Exercise
          items={[
            ["집부터 역까지 ×", "집에서 역까지 ✓"],
            ["9시에서 6시까지 ×", "9시부터 6시까지 ✓"],
            ["버스로 타요 ×", "버스를 타요 ✓"],
            ["택시를 왔어요 ×", "택시로 왔어요 ✓"],
            ["서울역로 ×", "서울역으로 ✓"],
            ["지하철으로 ×", "지하철로 ✓"],
            ["강남역 [강남역] ×", "강남역 [강남녁] ✓"],
            ["지하철역 [지하처력] ×", "지하철역 [지하철력] ✓"],
            ["기차를 부산에 가요 ×", "기차로 부산에 가요 ✓"],
            ["오른쪽을 가세요 ×", "오른쪽으로 가세요 ✓"],
          ]}
          shown={Boolean(revealed.errors)}
        />,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.errors)}
          onClick={() => toggle("errors")}
          answer
        />
      ),
      "34": content(
        "34",
        "5. 口语验收 · 十句完整路线",
        "交换角色完成问路，并给出一条真正可以执行的交通路线。",
        <Mic2 size={22} />,
        <>
          <section className="mt-4 rounded-2xl border border-[#cfe3d4] bg-[#f2f8f3] p-5">
            <p className="text-xs font-black text-[#487a54]">八项必达信息</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              {[
                "说出目的地",
                "表达出行计划",
                "说明起点与终点",
                "选择交通工具",
                "说明换乘站",
                "说明出口",
                "询问所需时间",
                "礼貌结束",
              ].map((task) => (
                <label
                  key={task}
                  className="flex items-center gap-2 rounded-xl bg-white p-3 font-bold"
                >
                  <input type="checkbox" className="accent-[#487a54]" />
                  {task}
                </label>
              ))}
            </div>
          </section>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center text-[11px] font-black">
            <span className="rounded-xl bg-[#f1f6fb] px-3 py-2 text-[#3d6f9f]">路线完整 40%</span>
            <span className="rounded-xl bg-[#f2f8f3] px-3 py-2 text-[#487a54]">语法正确 40%</span>
            <span className="rounded-xl bg-[#fff8ed] px-3 py-2 text-[#9a6b2f]">表达自然 20%</span>
          </div>
          <button
            type="button"
            onClick={() =>
              speak(
                "서울역에서 경복궁에 가려고 해요. 어떻게 가요? 서울역에서 충무로역까지 4호선을 타세요. 충무로역에서 갈아타요? 네, 3호선으로 갈아타세요. 몇 번 출구로 나가요? 5번 출구로 나가세요. 시간이 얼마나 걸려요? 이십오 분쯤 걸려요. 네, 감사합니다."
              )
            }
            className="mt-auto flex items-center justify-center gap-2 rounded-2xl bg-[#487a54] p-4 text-sm font-black text-white"
          >
            <Volume2 size={16} />
            播放十句示范
          </button>
        </>
      ),
      "35": (
        <div className="flex h-full flex-col justify-center">
          <div className="mx-auto w-full max-w-[440px] text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f4eb] text-[#487a54]">
              <Sparkles size={27} />
            </span>
            <p className="mt-4 text-xs font-black tracking-[0.18em] text-[#487a54]">
              LESSON 13 · COMPLETE
            </p>
            <h2 className="mt-3 text-4xl font-black">서울역으로 가 주세요.</h2>
            <p className="mt-3 text-lg font-black">你已经完成第十三课</p>
            <p className="mx-auto mt-3 max-w-[390px] text-sm leading-7 text-[#60736a]">
              现在你能说明出行计划、选择交通工具、描述起点和终点、完成换乘，并向司机或路人提出礼貌请求。
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-left">
              {[
                ["01", "表达计划", "V-(으)려고 하다"],
                ["02", "地点区间", "N에서 N까지"],
                ["03", "礼貌请求", "V-아/어 주다"],
                ["04", "方向与工具", "N-(으)로"],
              ].map(([index, title, detail]) => (
                <div
                  key={index}
                  className="rounded-xl border border-[#dce8e1] bg-white px-4 py-3"
                >
                  <p className="text-[10px] font-black text-[#487a54]">{index}</p>
                  <p className="mt-1 text-xs font-black">{title}</p>
                  <p className="mt-1 text-[10px] text-[#71857b]">{detail}</p>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => flipBookRef.current?.pageFlip()?.flip(1)}
              className="mt-4 rounded-full bg-[#eaf2fb] px-4 py-3 text-xs font-black text-[#3d6f9f]"
            >
              返回目录
            </button>
          </div>
        </div>
      ),
    };
    return pages[number];
  }

  const pages = Array.from({ length: 35 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return (
      <Page key={`13-${number}`} number={number}>
        {renderPage(number)}
      </Page>
    );
  });

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
          className="absolute -left-14 top-1/2 z-20 -translate-y-1/2 rounded-full border border-[#cfe2d9] bg-white p-3 text-[#238777] shadow-lg"
        >
          <ArrowLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => flipBookRef.current?.pageFlip()?.flipNext()}
          aria-label="下一页"
          className="absolute -right-14 top-1/2 z-20 -translate-y-1/2 rounded-full border border-[#cfe2d9] bg-white p-3 text-[#238777] shadow-lg"
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
            useMouseEvents={true}
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
