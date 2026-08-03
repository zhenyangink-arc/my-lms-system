"use client";

import HTMLFlipBook from "react-pageflip";
import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlarmClock,
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Headphones,
  Link2,
  MessageCircle,
  Mic2,
  NotebookPen,
  Route,
  Sparkles,
  TimerReset,
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
type Word = { korean: string; pronunciation?: string; type: string; chinese: string };
type Line = { speaker: string; korean: string; chinese: string };
type FlipBookHandle = {
  pageFlip: () =>
    | { flip: (page: number) => void; flipNext: () => void; flipPrev: () => void }
    | undefined;
};

const TEMPLATE = buildKoreanEbookSectionMap([
  { step: "STEP 01", label: "课前导航", dividerPage: 2, contentPages: [3] },
  { step: "STEP 02", label: "核心词汇", dividerPage: 4, contentPages: [5, 6, 7, 8] },
  { step: "STEP 03", label: "语法讲解", dividerPage: 9, contentPages: [10, 11, 12, 13] },
  { step: "STEP 04", label: "句型操练", dividerPage: 14, contentPages: [15, 16, 17] },
  { step: "STEP 05", label: "实战对话", dividerPage: 18, contentPages: [19, 20, 21] },
  { step: "STEP 06", label: "听说任务", dividerPage: 22, contentPages: [23, 24, 25] },
  { step: "STEP 07", label: "读写拓展", dividerPage: 26, contentPages: [27, 28] },
  { step: "STEP 08", label: "自测与复盘", dividerPage: 29, contentPages: [30, 31, 32, 33, 34] },
]);

const Page = forwardRef<
  HTMLDivElement,
  { children: ReactNode; number: string; cover?: boolean }
>(function Page({ children, number, cover = false }, ref) {
  return (
    <KoreanEbookPage
      ref={ref}
      number={number}
      header={TEMPLATE.headers[number] ?? "第 10 课 · 지금 몇 시예요?"}
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
      step={TEMPLATE.pageMeta[page]?.tag ?? "STEP 08"}
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
  tone?: "blue" | "rose" | "green" | "amber" | "purple";
}) {
  const tones = {
    blue: "border-[#cfddec] bg-[#f1f6fb] text-[#3d6f9f]",
    rose: "border-[#ead0d6] bg-[#fff4f6] text-[#a65b68]",
    green: "border-[#cfe3d4] bg-[#f2f8f3] text-[#487a54]",
    amber: "border-[#ead8be] bg-[#fff8ed] text-[#9b6b32]",
    purple: "border-[#ddd0ee] bg-[#f7f2fc] text-[#75559a]",
  };
  return (
    <section className={`mt-4 rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-[11px] font-black">{title}</p>
      <div className="mt-2 text-xs font-bold leading-6 text-[#45574f]">{children}</div>
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
    <div className={`mt-4 grid grid-cols-3 gap-3 ${showChinese ? "" : "[&_[data-vocab-meaning]]:opacity-0"}`}>
      {words.map((word) => (
        <KoreanEbookVocabularyCard
          key={`${word.korean}-${word.type}-${word.chinese}`}
          {...word}
          onSpeak={speak}
          compact={words.length >= 12}
        />
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
          className={`flex gap-2 rounded-xl p-3.5 ${index % 2 ? "bg-[#fff7ed]" : "bg-[#f4f8f6]"}`}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-black">
            {line.speaker}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-black leading-6">{line.korean}</p>
            <p className={`text-[10px] font-bold leading-5 text-[#71857b] ${showChinese ? "opacity-100" : "opacity-0"}`}>
              {line.chinese}
            </p>
          </div>
          <KoreanEbookSpeakButton text={line.korean} onSpeak={speak} compact />
        </div>
      ))}
    </div>
  );
}

const timeWords: Word[] = [
  { korean: "오전", type: "时间段", chinese: "上午" },
  { korean: "오후", type: "时间段", chinese: "下午" },
  { korean: "아침", type: "时间段／餐次", chinese: "早上／早饭" },
  { korean: "점심", type: "时间段／餐次", chinese: "中午／午饭" },
  { korean: "저녁", type: "时间段／餐次", chinese: "晚上／晚饭" },
  { korean: "밤", type: "时间段", chinese: "夜里" },
  { korean: "새벽", type: "时间段", chinese: "凌晨" },
  { korean: "평일", type: "日期范围", chinese: "工作日" },
  { korean: "주말", type: "日期范围", chinese: "周末" },
  { korean: "정오", type: "时刻", chinese: "正午" },
  { korean: "자정", type: "时刻", chinese: "午夜" },
  { korean: "반", type: "时间表达", chinese: "半／30分" },
  { korean: "쯤", type: "时间表达", chinese: "左右" },
  { korean: "동안", type: "时间名词", chinese: "期间" },
  { korean: "일정", type: "名词", chinese: "日程" },
];

const routineWords: Word[] = [
  { korean: "일어나다", type: "作息动词", chinese: "起床" },
  { korean: "씻다", type: "作息动词", chinese: "洗漱" },
  { korean: "준비하다", type: "作息动词", chinese: "准备" },
  { korean: "시작하다", type: "日程动词", chinese: "开始" },
  { korean: "끝나다", type: "日程动词", chinese: "结束" },
  { korean: "출발하다", type: "移动动词", chinese: "出发" },
  { korean: "도착하다", type: "移动动词", chinese: "到达" },
  { korean: "출근하다", type: "作息动词", chinese: "上班" },
  { korean: "퇴근하다", type: "作息动词", chinese: "下班" },
  { korean: "등교하다", type: "作息动词", chinese: "上学" },
  { korean: "수업하다", type: "日程动词", chinese: "上课" },
  { korean: "약속하다", type: "日程动词", chinese: "约定" },
  { korean: "계획하다", type: "日程动词", chinese: "计划" },
  { korean: "쉬다", type: "作息动词", chinese: "休息" },
  { korean: "자다", type: "作息动词", chinese: "睡觉" },
];

const scheduleWords: Word[] = [
  { korean: "아침을 먹다", type: "作息词块", chinese: "吃早饭" },
  { korean: "점심을 먹다", type: "作息词块", chinese: "吃午饭" },
  { korean: "저녁을 먹다", type: "作息词块", chinese: "吃晚饭" },
  { korean: "학교에 가다", type: "移动词块", chinese: "去学校" },
  { korean: "회사에 가다", type: "移动词块", chinese: "去公司" },
  { korean: "집에 오다", type: "移动词块", chinese: "回家" },
  { korean: "버스를 타다", type: "交通词块", chinese: "坐公交车" },
  { korean: "지하철을 타다", type: "交通词块", chinese: "坐地铁" },
  { korean: "친구를 만나다", type: "约会词块", chinese: "见朋友" },
  { korean: "운동을 하다", type: "活动词块", chinese: "运动" },
  { korean: "숙제를 하다", type: "学习词块", chinese: "做作业" },
  { korean: "회의를 하다", type: "工作词块", chinese: "开会" },
  { korean: "장을 보다", type: "生活词块", chinese: "买菜／购物" },
  { korean: "산책하다", type: "活动词块", chinese: "散步" },
  { korean: "일찍", type: "副词", chinese: "早早地" },
];

const formWords: Word[] = [
  { korean: "가다 → 가서", type: "-아서/어서", chinese: "去后／去……" },
  { korean: "만나다 → 만나서", type: "-아서/어서", chinese: "见面后" },
  { korean: "먹다 → 먹어서", type: "-아서/어서", chinese: "吃后／因为吃" },
  { korean: "읽다 → 읽어서", type: "-아서/어서", chinese: "读后／因为读" },
  { korean: "공부하다 → 공부해서", type: "-아서/어서", chinese: "学习后／因为学习" },
  { korean: "출발하다 → 출발해서", type: "-아서/어서", chinese: "出发后" },
  { korean: "가다 → 갈 거예요", type: "未来计划", chinese: "打算去" },
  { korean: "하다 → 할 거예요", type: "未来计划", chinese: "打算做" },
  { korean: "먹다 → 먹을 거예요", type: "未来计划", chinese: "打算吃" },
  { korean: "읽다 → 읽을 거예요", type: "未来计划", chinese: "打算读" },
  { korean: "듣다 → 들을 거예요", type: "ㄷ不规则未来", chinese: "打算听" },
  { korean: "춥다 → 추울 거예요", type: "ㅂ不规则未来", chinese: "将会冷" },
];

const dividers: Record<string, { step: string; title: string; goal: string; icon: ReactNode }> = {
  "02": { step: "STEP 01", title: "课前导航", goal: "从读准一个时刻，走向安排完整日程：说明起止范围、动作链和未来计划。", icon: <CalendarClock size={24} /> },
  "04": { step: "STEP 02", title: "核心词汇", goal: "把时间段、作息动词和日程词块绑定记忆，让词汇直接进入时间轴。", icon: <AlarmClock size={24} /> },
  "09": { step: "STEP 03", title: "语法讲解", goal: "四项语法各占一页：精确时间、起止范围、紧密动作链和未来计划。", icon: <NotebookPen size={24} /> },
  "14": { step: "STEP 04", title: "句型操练", goal: "同时训练固有词小时、汉字词分钟、부터/까지和两种“然后”。", icon: <TimerReset size={24} /> },
  "18": { step: "STEP 05", title: "实战对话", goal: "在上学日、周末计划和旅行行程中完成三组不少于八句的交流。", icon: <MessageCircle size={24} /> },
  "22": { step: "STEP 06", title: "听说任务", goal: "从语音中抓住时间点、动作顺序和计划，再口头重建日程。", icon: <Headphones size={24} /> },
  "26": { step: "STEP 07", title: "读写拓展", goal: "读懂一日安排，并写出有起止、有动作链、有未来计划的原创日程。", icon: <BookOpenCheck size={24} /> },
  "29": { step: "STEP 08", title: "自测与复盘", goal: "检查时间表达、范围助词、动作连接与未来时，并完成口语验收。", icon: <CheckCircle2 size={24} /> },
};

export function KoreanLevelOneLessonTenBook({
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

  const content = (
    number: string,
    title: string,
    description: string,
    icon: ReactNode,
    body: ReactNode,
    action?: ReactNode
  ) => (
    <div className="flex h-full flex-col">
      <Heading page={number} title={title} description={description} icon={icon} action={action} />
      {body}
    </div>
  );

  const dialogues: Record<string, { title: string; description: string; lines: Line[] }> = {
    "19": {
      title: "场景 1 · 上学日早晨",
      description: "询问起床、出发和到校时间，完成一条真实晨间时间轴。",
      lines: [
        { speaker: "敏", korean: "평일에는 몇 시에 일어나요?", chinese: "工作日几点起床？" },
        { speaker: "俊", korean: "오전 일곱 시에 일어나요.", chinese: "上午七点起床。" },
        { speaker: "敏", korean: "일어나서 먼저 뭐 해요?", chinese: "起床后先做什么？" },
        { speaker: "俊", korean: "씻어서 아침을 먹어요.", chinese: "洗漱后吃早饭。" },
        { speaker: "敏", korean: "몇 시에 집에서 출발해요?", chinese: "几点从家出发？" },
        { speaker: "俊", korean: "일곱 시 사십 분에 출발해요.", chinese: "七点四十分出发。" },
        { speaker: "敏", korean: "학교까지 얼마나 걸려요?", chinese: "到学校需要多久？" },
        { speaker: "俊", korean: "삼십 분쯤 걸려서 여덟 시 십 분에 도착해요.", chinese: "大约三十分钟，八点十分到。" },
      ],
    },
    "20": {
      title: "场景 2 · 周末怎么安排？",
      description: "商量周末时间范围，并说出紧密相连的活动和未来计划。",
      lines: [
        { speaker: "智", korean: "이번 주말에 뭐 할 거예요?", chinese: "这周末打算做什么？" },
        { speaker: "秀", korean: "오전에 운동할 거예요.", chinese: "上午打算运动。" },
        { speaker: "智", korean: "몇 시부터 몇 시까지 해요?", chinese: "从几点做到几点？" },
        { speaker: "秀", korean: "아홉 시부터 열 시 반까지 해요.", chinese: "从九点到十点半。" },
        { speaker: "智", korean: "운동해서 바로 집에 갈 거예요?", chinese: "运动后马上回家吗？" },
        { speaker: "秀", korean: "아니요. 친구를 만나서 점심을 먹을 거예요.", chinese: "不。打算见朋友后一起吃午饭。" },
        { speaker: "智", korean: "저녁에는요?", chinese: "晚上呢？" },
        { speaker: "秀", korean: "집에서 책을 읽고 일찍 잘 거예요.", chinese: "在家看书，然后早睡。" },
      ],
    },
    "21": {
      title: "场景 3 · 一日旅行行程",
      description: "用地点起止、出发到达和未来时确认可执行的旅行计划。",
      lines: [
        { speaker: "娜", korean: "내일 몇 시에 출발할 거예요?", chinese: "明天几点出发？" },
        { speaker: "浩", korean: "새벽 여섯 시 반에 출발할 거예요.", chinese: "凌晨六点半出发。" },
        { speaker: "娜", korean: "서울부터 부산까지 기차로 가요?", chinese: "从首尔到釜山坐火车吗？" },
        { speaker: "浩", korean: "네, 아홉 시쯤 부산에 도착할 거예요.", chinese: "是的，九点左右到釜山。" },
        { speaker: "娜", korean: "도착해서 먼저 어디에 갈 거예요?", chinese: "到达后先去哪里？" },
        { speaker: "浩", korean: "호텔에 가서 짐을 놓을 거예요.", chinese: "去酒店放行李。" },
        { speaker: "娜", korean: "오후 일정은 어떻게 돼요?", chinese: "下午日程怎么安排？" },
        { speaker: "浩", korean: "두 시부터 다섯 시까지 바다를 보고 시장에 갈 거예요.", chinese: "两点到五点看海，然后去市场。" },
      ],
    },
  };

  function renderPage(number: string) {
    if (number === "01") {
      return (
        <KoreanEbookTableOfContents
          lessonNumber={10}
          pageMeta={TEMPLATE.pageMeta}
          onNavigate={(target) => flipBookRef.current?.pageFlip()?.flip(target)}
          entries={[
            { step: "01", title: "课前导航", pageRange: "02—03", detail: "建立一日日程任务" },
            { step: "02", title: "核心词汇", pageRange: "04—08", detail: "时间段·作息·日程词块" },
            { step: "03", title: "语法讲解", pageRange: "09—13", detail: "时间·范围·动作链·计划" },
            { step: "04", title: "句型操练", pageRange: "14—17", detail: "读钟表并连接日程" },
            { step: "05", title: "实战对话", pageRange: "18—21", detail: "三组八句日程交流" },
            { step: "06", title: "听说任务", pageRange: "22—25", detail: "听时间轴·说计划" },
            { step: "07", title: "读写拓展", pageRange: "26—28", detail: "读日程·写安排" },
            { step: "08", title: "自测与复盘", pageRange: "29—34", detail: "综合验收与结束页" },
          ]}
        />
      );
    }

    if (dividers[number]) return <KoreanEbookSectionDivider {...dividers[number]} />;

    if (dialogues[number]) {
      const dialogue = dialogues[number];
      return content(
        number,
        dialogue.title,
        dialogue.description,
        <MessageCircle size={22} />,
        <>
          <Dialogue lines={dialogue.lines} speak={speak} showChinese={Boolean(revealed[`chinese${number}`])} />
          <Note title="角色交换" tone="rose">替换时间、地点和活动，再完成一轮不少于八句的日程对话。</Note>
        </>,
        <KoreanEbookRevealButton shown={Boolean(revealed[`chinese${number}`])} onClick={() => toggle(`chinese${number}`)} />
      );
    }

    const pages: Record<string, ReactNode> = {
      "03": content("03", "把一天变成可执行的时间轴", "不只回答“几点”，还要说明从何时到何时、先做什么，以及接下来打算做什么。", <Route size={22} />, <>
        <div className="mt-5 grid grid-cols-2 gap-3">{[
          ["时刻", "오후 세 시 반에 만나요.", "下午三点半见。"],
          ["范围", "아홉 시부터 여섯 시까지 일해요.", "从九点工作到六点。"],
          ["动作链", "식당에 가서 점심을 먹어요.", "去餐厅吃午饭。"],
          ["计划", "주말에 집에서 쉴 거예요.", "周末打算在家休息。"],
          ["到达", "오전 여덟 시에 학교에 도착해요.", "上午八点到学校。"],
          ["收尾", "밤 열한 시쯤 잘 거예요.", "夜里十一点左右睡觉。"],
        ].map(([tag, korean, chinese]) => (
          <button key={tag} type="button" onClick={() => speak(korean)} className="rounded-2xl border border-[#dce8e1] bg-white p-4 text-left">
            <b className="text-[10px] text-[#bd741e]">{tag}</b>
            <div className="mt-2 flex items-center justify-between gap-2"><p className="text-sm font-black">{korean}</p><Volume2 size={14} className="shrink-0 text-[#8a6aa6]" /></div>
            <p className={`mt-1 text-[11px] text-[#71857b] ${revealed.chinese03 ? "opacity-100" : "opacity-0"}`}>{chinese}</p>
          </button>
        ))}</div>
        <Note title="最终任务" tone="amber">用 8—10 句介绍自己某一天：至少包含三个准确时刻、一个起止范围、一组紧密动作和两个未来计划。</Note>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese03)} onClick={() => toggle("chinese03")} />),
      "05": content("05", "1. 时间段与日程单位", "时间段放在具体时刻前面，可以迅速消除上午、下午的歧义。", <Clock3 size={22} />, <><WordGrid words={timeWords} speak={speak} showChinese={Boolean(revealed.chinese05)} /><Note title="时间层级">大范围在前，精确时刻在后：평일 아침 일곱 시／주말 오후 세 시 반。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese05)} onClick={() => toggle("chinese05")} />),
      "06": content("06", "2. 日常作息动词", "把动词放到真实时间点上记忆，不再只背词典形。", <AlarmClock size={22} />, <><WordGrid words={routineWords} speak={speak} showChinese={Boolean(revealed.chinese06)} /><Note title="成对记忆" tone="green">출발하다 ↔ 도착하다；시작하다 ↔ 끝나다；출근하다 ↔ 퇴근하다。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese06)} onClick={() => toggle("chinese06")} />),
      "07": content("07", "3. 一日行程词块", "完整词块已经包含宾语或地点，能直接接时间表达和句尾。", <Route size={22} />, <><WordGrid words={scheduleWords} speak={speak} showChinese={Boolean(revealed.chinese07)} /><Note title="直接套入时间轴" tone="amber">오전 여덟 시에 학교에 가요. 오후 여섯 시에 집에 와요.</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese07)} onClick={() => toggle("chinese07")} />),
      "08": content("08", "4. 连接形与未来形", "先熟悉本课会反复出现的形态，再进入规则推导。", <Link2 size={22} />, <><WordGrid words={formWords} speak={speak} showChinese={Boolean(revealed.chinese08)} /><Note title="不规则预警" tone="rose">들을 거예요 中 ㄷ→ㄹ；추울 거예요 中 ㅂ→우。变化来自后接的元音词尾。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese08)} onClick={() => toggle("chinese08")} />),
      "10": content("10", "1. 시간 · 精确时间表达", "小时用固有词数字，分钟用汉字词数字；时间段放在最前面。", <Clock3 size={22} />, <>
        <div className="mt-4 grid grid-cols-2 gap-3">{[
          ["整点", "오전 아홉 시", "上午9点"],
          ["分钟", "오후 세 시 십오 분", "下午3点15分"],
          ["半点", "저녁 일곱 시 반", "晚上7点半"],
          ["大约", "밤 열한 시쯤", "夜里11点左右"],
          ["凌晨时刻", "새벽 다섯 시 사십 분", "凌晨5点40分"],
          ["正午时刻", "정오 열두 시", "正午12点"],
        ].map(([label, korean, chinese]) => <article key={label} className="rounded-2xl border border-[#ddd0ee] bg-white p-4"><b className="text-[#75559a]">{label}</b><div className="mt-3 text-base font-black"><RuleSentence text={korean} speak={speak}>{korean}</RuleSentence></div><p className={`mt-1 text-xs text-[#71857b] ${revealed.chinese10 ? "opacity-100" : "opacity-0"}`}>{chinese}</p></article>)}</div>
        <Note title="两套数字分工" tone="purple">세 시（3点）用固有词 세；십오 분（15分）用汉字词 십오。不要说 삼 시，也不要说 열다섯 분。</Note>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese10)} onClick={() => toggle("chinese10")} />),
      "11": content("11", "2. N부터 N까지", "부터标记起点，까지标记终点；既可连接时间，也可连接空间。", <Route size={22} />, <>
        <div className="mt-4 space-y-3">{[
          ["时间范围", "오전 아홉 시부터 오후 여섯 시까지 일해요.", "从上午9点工作到下午6点。"],
          ["星期范围", "월요일부터 금요일까지 학교에 가요.", "从周一到周五去学校。"],
          ["地点范围", "집부터 학교까지 걸어가요.", "从家走到学校。"],
          ["开放范围", "오후부터 비가 와요.", "从下午开始下雨。"],
        ].map(([kind, korean, chinese]) => <article key={kind} className="rounded-2xl border border-[#ddd0ee] bg-white p-4"><b className="text-[11px] text-[#75559a]">{kind}</b><div className="mt-2 text-sm font-black"><RuleSentence text={korean} speak={speak}>{korean}</RuleSentence></div><p className={`mt-1 text-xs text-[#71857b] ${revealed.chinese11 ? "opacity-100" : "opacity-0"}`}>{chinese}</p></article>)}</div>
        <Note title="可以只出现一边" tone="amber">只强调起点时可用 N부터；只强调终点时可用 N까지。两者不一定每次成对出现。</Note>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese11)} onClick={() => toggle("chinese11")} />),
      "12": content("12", "3. V-아서／어서", "连接紧密相关的动作；前项常表示移动、方式、前提或原因。", <Link2 size={22} />, <>
        <div className="mt-4 grid grid-cols-3 gap-3">{[
          ["ㅏ／ㅗ → -아서", "가다 → 가서", "만나다 → 만나서"],
          ["其他元音 → -어서", "먹다 → 먹어서", "읽다 → 읽어서"],
          ["하다 → 해서", "공부하다 → 공부해서", "출발하다 → 출발해서"],
        ].map(([rule, first, second]) => <article key={rule} className="rounded-2xl border border-[#ddd0ee] bg-white p-4"><b className="text-[11px] text-[#75559a]">{rule}</b><div className="mt-3 text-xs font-black"><RuleSentence text={first.replace(" → ", ". ")} speak={speak}>{first}</RuleSentence><RuleSentence text={second.replace(" → ", ". ")} speak={speak}>{second}</RuleSentence></div></article>)}</div>
        <Note title="动作链与原因" tone="green"><RuleSentence text="식당에 가서 밥을 먹어요." speak={speak}>식당에 가서 밥을 먹어요.（去餐厅吃饭）</RuleSentence><RuleSentence text="피곤해서 일찍 자요." speak={speak}>피곤해서 일찍 자요.（因为累，所以早睡）</RuleSentence></Note>
        <Note title="与 -고 的核心差异" tone="rose">-고 只是把动作排在一起；-아서/어서 强调前项为后项创造地点、条件、方式或原因。</Note>
        <div className="grid grid-cols-2 gap-3">
          <Note title="移动后的行动" tone="amber"><RuleSentence text="도서관에 가서 책을 읽어요." speak={speak}>도서관에 가서 책을 읽어요.</RuleSentence><span>去图书馆看书。</span></Note>
          <Note title="前提后的行动" tone="blue"><RuleSentence text="친구를 만나서 같이 운동해요." speak={speak}>친구를 만나서 같이 운동해요.</RuleSentence><span>见朋友后一起运动。</span></Note>
        </div>
      </>),
      "13": content("13", "4. V-(으)ㄹ 거예요", "表示未来计划、意图或有根据的预测，空格必须保留。", <CalendarClock size={22} />, <>
        <div className="mt-4 grid grid-cols-2 gap-3">{[
          ["无收音 + ㄹ 거예요", "가다 → 갈 거예요", "하다 → 할 거예요"],
          ["有收音 + 을 거예요", "먹다 → 먹을 거예요", "읽다 → 읽을 거예요"],
          ["ㄹ收音直接 + 거예요", "살다 → 살 거예요", "만들다 → 만들 거예요"],
          ["不规则变化", "듣다 → 들을 거예요", "춥다 → 추울 거예요"],
          ["日程计划", "출발하다 → 출발할 거예요", "도착하다 → 도착할 거예요"],
          ["作息计划", "쉬다 → 쉴 거예요", "자다 → 잘 거예요"],
        ].map(([rule, first, second]) => <article key={rule} className="rounded-2xl border border-[#ddd0ee] bg-white p-4"><b className="text-[#75559a]">{rule}</b><div className="mt-3 text-sm font-black"><RuleSentence text={first.replace(" → ", ". ")} speak={speak}>{first}</RuleSentence><RuleSentence text={second.replace(" → ", ". ")} speak={speak}>{second}</RuleSentence></div></article>)}</div>
        <Note title="书写与含义" tone="amber">갈 거예요 要分写。说话人可控的动作多译为“打算”；天气等不可控状态多译为“将会”。</Note>
      </>),
      "15": content("15", "1. 时间组装实验", "按“时间段—小时—分钟—에”的顺序组装。", <Clock3 size={22} />, <>
        <div className="mt-4 grid grid-cols-2 gap-2.5">{[
          ["上午 7:00", "오전 일곱 시에"], ["下午 2:30", "오후 두 시 반에"],
          ["晚上 8:15", "저녁 여덟 시 십오 분에"], ["凌晨 5:40", "새벽 다섯 시 사십 분에"],
          ["夜里 11点左右", "밤 열한 시쯤"], ["正午 12:00", "정오에"],
          ["上午 9:05", "오전 아홉 시 오 분에"], ["下午 4:50", "오후 네 시 오십 분에"],
          ["上午 10:20", "오전 열 시 이십 분에"], ["晚上 9:45", "밤 아홉 시 사십오 분에"],
          ["下午 1:10", "오후 한 시 십 분에"], ["凌晨 4:30", "새벽 네 시 반에"],
        ].map(([prompt, answer]) => <article key={prompt} className="grid min-h-[62px] grid-cols-[1fr_1.25fr] items-center rounded-xl border border-[#ead8be] bg-white p-4 text-xs font-black"><span>{prompt}</span><span className={`text-[#9b6b32] ${revealed.time ? "opacity-100" : "opacity-0"}`}>{answer}</span></article>)}</div>
        <Note title="零分不读">整点只说 일곱 시，不说 일곱 시 영 분；“半”用 반，放在 시 后。</Note>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.time)} onClick={() => toggle("time")} answer />),
      "16": content("16", "2. 起点和终点诊所", "判断缺少的是 부터、까지，还是两者都需要。", <Route size={22} />, <>
        <div className="mt-4 space-y-2.5">{[
          ["아홉 시(　) 열두 시(　) 수업해요.", "아홉 시부터 열두 시까지 수업해요."],
          ["월요일(　) 금요일(　) 일해요.", "월요일부터 금요일까지 일해요."],
          ["집(　) 학교(　) 버스를 타요.", "집부터 학교까지 버스를 타요."],
          ["오후(　) 비가 올 거예요.", "오후부터 비가 올 거예요."],
          ["다섯 시(　) 숙제를 끝낼 거예요.", "다섯 시까지 숙제를 끝낼 거예요."],
          ["서울(　) 부산(　) 기차로 가요.", "서울부터 부산까지 기차로 가요."],
          ["아침(　) 점심(　) 수업해요.", "아침부터 점심까지 수업해요."],
          ["주말(　) 여행할 거예요.", "주말부터 여행할 거예요."],
          ["열 시(　) 도착해야 돼요.", "열 시까지 도착해야 돼요."],
          ["학교(　) 집(　) 걸어가요.", "학교부터 집까지 걸어가요."],
        ].map(([question, answer]) => <article key={question} className="grid grid-cols-2 gap-3 rounded-xl border border-[#ead8be] bg-white p-3 text-xs font-black"><span>{question}</span><span className={`text-[#9b6b32] ${revealed.range ? "opacity-100" : "opacity-0"}`}>{answer}</span></article>)}</div>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.range)} onClick={() => toggle("range")} answer />),
      "17": content("17", "3. -고 还是 -아서／어서？", "根据动作之间是否存在直接逻辑联系来选择。", <Link2 size={22} />, <>
        <div className="mt-4 grid grid-cols-2 gap-3">{[
          ["친구를 만나서 영화를 봐요.", "见到朋友后一起看电影", "-아서/어서：共同活动的前提"],
          ["식당에 가서 밥을 먹어요.", "去餐厅吃饭", "-아서/어서：移动后在该地行动"],
          ["밥을 먹고 전화를 해요.", "吃饭后打电话", "-고：单纯先后"],
          ["책을 읽고 음악을 들어요.", "看书，也听音乐", "-고：并列罗列"],
          ["피곤해서 집에서 쉬어요.", "因为累在家休息", "-아서/어서：原因"],
          ["운동하고 숙제할 거예요.", "打算运动并做作业", "-고：两个独立计划"],
          ["카페에 가서 친구를 만나요.", "去咖啡厅见朋友", "-아서/어서：移动后的行动"],
          ["샤워하고 음악을 들어요.", "洗澡后听音乐", "-고：单纯先后"],
        ].map(([korean, chinese, reason]) => <article key={korean} className="rounded-2xl border border-[#ead8be] bg-white p-4"><RuleSentence text={korean} speak={speak}><span className="text-sm font-black">{korean}</span></RuleSentence><p className="mt-1 text-[10px] text-[#71857b]">{chinese}</p><p className={`mt-2 text-[10px] font-black text-[#9b6b32] ${revealed.connector ? "opacity-100" : "opacity-0"}`}>{reason}</p></article>)}</div>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.connector)} onClick={() => toggle("connector")} answer />),
      "23": content("23", "1. 听力 · 一天的时间轴", "第一遍记时刻，第二遍补动作，第三遍确认起止范围。", <Headphones size={22} />, <>
        <button type="button" onClick={() => speak("저는 평일 아침 여섯 시 반에 일어납니다. 씻어서 일곱 시에 아침을 먹습니다. 여덟 시부터 오후 네 시까지 학교에서 공부합니다. 집에 와서 저녁을 먹고 숙제합니다. 밤 열한 시에 잘 거예요.")} className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-[#3e7fa3] p-4 text-sm font-black text-white"><Volume2 size={17} />播放一日日程</button>
        <div className="mt-5 grid grid-cols-2 gap-3">{[
          ["起床", "아침 여섯 시 반"], ["早餐", "일곱 시"], ["学校", "여덟 시부터 오후 네 시까지"],
          ["回家后", "저녁／숙제"], ["睡觉", "밤 열한 시"], ["未来句", "잘 거예요"],
          ["起止范围", "여덟 시부터 네 시까지"], ["连接动作", "씻어서 아침을 먹다"],
        ].map(([label, answer]) => <article key={label} className="rounded-2xl border border-[#cfddec] bg-white p-3"><b className="text-[11px] text-[#3e7fa3]">{label}</b><p className={`mt-2 text-sm font-black ${revealed.listening ? "opacity-100" : "opacity-0"}`}>{answer}</p></article>)}</div>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.listening)} onClick={() => toggle("listening")} answer />),
      "24": content("24", "2. 日程重建卡", "把五张信息卡按时间顺序排列，再逐条复述。", <TimerReset size={22} />, <>
        <div className="mt-4 space-y-2.5">{[
          ["01", "오전 일곱 시에 일어나요."], ["02", "씻어서 아침을 먹어요."],
          ["03", "여덟 시부터 네 시까지 공부해요."], ["04", "친구를 만나서 같이 운동해요."],
          ["05", "밤에는 책을 읽고 잘 거예요."],
          ["06", "밤 열한 시쯤 잠을 잘 거예요."],
        ].map(([step, sentence]) => <article key={step} className="grid grid-cols-[55px_1fr] items-center rounded-xl border border-[#cfddec] bg-white p-3"><b className="text-[#3e7fa3]">{step}</b><RuleSentence text={sentence} speak={speak}><span className="text-sm font-black">{sentence}</span></RuleSentence></article>)}</div>
        <Note title="复述升级">第二轮不看文字，只看 01—05；第三轮把时间和活动替换成自己的真实安排。</Note>
      </>),
      "25": content("25", "3. 60秒未来日程播报", "用三个时间点、一个范围和两组动作链介绍明天。", <Mic2 size={22} />, <>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Note title="表达脚手架" tone="blue"><RuleSentence text="내일 아침 일곱 시에 일어날 거예요." speak={speak}>내일 아침 ______에 일어날 거예요.</RuleSentence><RuleSentence text="아홉 시부터 열두 시까지 공부할 거예요." speak={speak}>______부터 ______까지 공부할 거예요.</RuleSentence><RuleSentence text="친구를 만나서 점심을 먹을 거예요." speak={speak}>친구를 만나서 ______을 거예요.</RuleSentence></Note>
          <Note title="四项检查" tone="green">□ 小时与分钟数字正确<br />□ 부터／까지位置正确<br />□ -아서/어서动作有关联<br />□ 거예요正确分写</Note>
          <Note title="上午场景" tone="amber">起床 → 洗漱 → 早餐<br/>上学／上班 → 午餐</Note>
          <Note title="晚间场景" tone="purple">回家 → 晚饭 → 学习<br/>休息 → 睡觉</Note>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] font-black text-[#75559a]">{["版本 A · 工作日","版本 B · 周末","版本 C · 考试日","版本 D · 旅行日"].map((item) => <span key={item} className="rounded-xl bg-[#f7f2fb] px-3 py-3">{item}</span>)}</div>
        <p className="mt-4 text-center text-[11px] font-bold text-[#71857b]">先画时间轴再说；说话时只看时间点，不读完整稿。</p>
      </>),
      "27": content("27", "1. 阅读 · 민지의 평일", "找出所有时刻、范围、连接形和未来计划。", <BookOpenCheck size={22} />, <>
        <section className="mt-4 rounded-2xl border border-[#cfe3d4] bg-white p-5"><p className="text-[11px] font-black text-[#347b69]">민지의 하루</p><p className="mt-3 text-sm font-bold leading-7">민지는 평일 아침 여섯 시 사십 분에 일어나요. 씻어서 일곱 시에 아침을 먹어요. 여덟 시부터 오후 세 시까지 학교에서 공부해요. 수업이 끝나서 도서관에 가요. 다섯 시까지 숙제를 하고 집에 와요. 오늘 밤에는 일찍 잘 거예요.</p></section>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">{[
          ["几点起床？", "아침 여섯 시 사십 분"], ["在学校待到几点？", "오후 세 시까지"],
          ["下课后去哪里？", "도서관"], ["今晚有什么计划？", "일찍 잘 거예요"],
          ["早餐前做什么？", "씻어요"], ["作业做到几点？", "다섯 시까지"],
        ].map(([question, answer], index) => <article key={question} className="rounded-xl bg-[#e7f5f1] p-3 font-bold"><p><span className="mr-2 text-[#347b69]">{index + 1}.</span>{question}</p><p className={`mt-2 text-[#347b69] ${revealed.reading ? "opacity-100" : "opacity-0"}`}>{answer}</p></article>)}</div>
        <Note title="阅读定位顺序" tone="green">先圈出所有“시／분”，再找부터／까지，最后标记-아서/어서和-(으)ㄹ 거예요。</Note>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.reading)} onClick={() => toggle("reading")} answer />),
      "28": content("28", "2. 写作 · 我的明日日程", "写 8—10 句原创计划，让别人能够按时间轴复原你的一天。", <NotebookPen size={22} />, <>
        <div className="mt-4 grid grid-cols-2 gap-3"><Note title="内容骨架" tone="green">起床 → 上午安排 → 起止范围 → 午后移动 → 紧密动作 → 晚间计划 → 睡觉</Note><Note title="语法清单" tone="amber">精确时间 3 次<br/>부터/까지 1 次<br/>-아서/어서 2 次<br/>-(으)ㄹ 거예요 3 次</Note></div>
        <section className="mt-4 rounded-2xl border border-dashed border-[#9fc8b9] bg-[#fbfdfa] p-5"><p className="text-[11px] font-black text-[#347b69]">原创示范</p><p className="mt-3 text-sm font-bold leading-7">내일은 아침 일곱 시에 일어날 거예요. 씻어서 아침을 먹을 거예요. 아홉 시부터 열두 시까지 한국어를 공부할 거예요. 점심에는 친구를 만나서 같이 밥을 먹을 거예요. 오후에는 카페에 가서 책을 읽을 거예요. 밤 열한 시쯤 잘 거예요.</p></section>
        <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] font-black text-[#347b69]">{["✓ 三个准确时刻","✓ 一个起止范围","✓ 两组紧密动作","✓ 三个未来计划"].map((item) => <span key={item} className="rounded-xl bg-[#f2f8f3] px-3 py-2">{item}</span>)}</div>
      </>),
      "30": content("30", "1. 时间与作息闪测", "看到中文后两秒内说出韩语。", <AlarmClock size={22} />, <div className="mt-4 grid grid-cols-3 gap-2.5">{[
        ["上午", "오전"], ["下午", "오후"], ["凌晨", "새벽"], ["工作日", "평일"],
        ["起床", "일어나다"], ["开始", "시작하다"], ["结束", "끝나다"], ["出发", "출발하다"],
        ["到达", "도착하다"], ["上班", "출근하다"], ["下班", "퇴근하다"], ["计划", "계획하다"],
      ].map(([chinese, korean], index) => <article key={`${chinese}-${korean}`} className="rounded-xl border border-[#cfe3d4] bg-white p-3 text-center"><p className="text-[10px] text-[#487a54]">{index + 1}</p><b>{chinese}</b><p className={`mt-2 rounded-lg bg-[#e8f4eb] p-2 text-xs font-black ${revealed.words ? "opacity-100" : "opacity-0"}`}>{korean}</p></article>)}</div>, <KoreanEbookRevealButton shown={Boolean(revealed.words)} onClick={() => toggle("words")} answer />),
      "31": content("31", "2. 时间与范围检测", "检查两套数字、时间段顺序和부터／까지。", <Clock3 size={22} />, <>
        <div className="mt-4 grid grid-cols-2 gap-2.5">{[
          ["下午3:30", "오후 세 시 반"], ["上午8:15", "오전 여덟 시 십오 분"],
          ["从9点到12点", "아홉 시부터 열두 시까지"], ["从周一到周五", "월요일부터 금요일까지"],
          ["到下午5点", "오후 다섯 시까지"], ["从家到公司", "집부터 회사까지"],
          ["夜里11点左右", "밤 열한 시쯤"], ["凌晨6:40", "새벽 여섯 시 사십 분"],
          ["上午10:20", "오전 열 시 이십 분"], ["晚上9:45", "밤 아홉 시 사십오 분"],
          ["从早上到中午", "아침부터 점심까지"], ["到夜里12点", "밤 열두 시까지"],
        ].map(([question, answer]) => <article key={question} className="rounded-xl border border-[#cfe3d4] bg-white p-3"><b>{question}</b><p className={`mt-2 text-sm font-black text-[#487a54] ${revealed.timeTest ? "opacity-100" : "opacity-0"}`}>{answer}</p></article>)}</div>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.timeTest)} onClick={() => toggle("timeTest")} answer />),
      "32": content("32", "3. 综合语法检测", "完成动作连接和未来计划表达。", <CheckCircle2 size={22} />, <div className="mt-4 space-y-2">{[
        ["去餐厅吃饭。", "식당에 가서 밥을 먹어요."],
        ["见朋友后一起看电影。", "친구를 만나서 같이 영화를 봐요."],
        ["周末打算在家休息。", "주말에 집에서 쉴 거예요."],
        ["明天打算听音乐。", "내일 음악을 들을 거예요."],
        ["天气将会很冷。", "날씨가 추울 거예요."],
        ["吃饭后打算打电话。（单纯先后）", "밥을 먹고 전화할 거예요."],
        ["去图书馆看书。", "도서관에 가서 책을 읽어요."],
        ["明天打算早早出发。", "내일 일찍 출발할 거예요."],
        ["见朋友后一起吃饭。", "친구를 만나서 같이 밥을 먹어요."],
        ["夜里打算听音乐。", "밤에 음악을 들을 거예요."],
      ].map(([question, answer], index) => <article key={question} className="grid grid-cols-2 gap-3 rounded-xl border border-[#cfe3d4] bg-white p-3 text-xs font-bold"><span>{index + 1}. {question}</span><span className={`text-[#487a54] ${revealed.grammar ? "opacity-100" : "opacity-0"}`}>{answer}</span></article>)}</div>, <KoreanEbookRevealButton shown={Boolean(revealed.grammar)} onClick={() => toggle("grammar")} answer />),
      "33": content("33", "4. 口语验收 · 我的明天", "不看稿连续讲述 60 秒，再回答三个时间追问。", <Mic2 size={22} />, <>
        <section className="mt-4 rounded-2xl border border-[#cfe3d4] bg-[#f2f8f3] p-5"><p className="text-xs font-black text-[#487a54]">八项必达信息</p><div className="mt-4 grid grid-cols-2 gap-3 text-xs">{["三个准确时刻","一个上午／下午时间段","一个부터/까지范围","一次移动后行动","一次原因连接","三个未来计划","一个ㄷ不规则未来形","结尾说明睡觉时间"].map((task) => <label key={task} className="flex items-center gap-2 rounded-xl bg-white p-3 font-bold"><input type="checkbox" className="accent-[#487a54]" />{task}</label>)}</div></section>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center text-[11px] font-black"><span className="rounded-xl bg-[#f1f6fb] px-3 py-2 text-[#3d6f9f]">时间完整 40%</span><span className="rounded-xl bg-[#f2f8f3] px-3 py-2 text-[#487a54]">语法正确 40%</span><span className="rounded-xl bg-[#fff8ed] px-3 py-2 text-[#9a6b2f]">表达自然 20%</span></div>
        <button type="button" onClick={() => speak("내일 아침 일곱 시에 일어날 거예요. 씻어서 아침을 먹을 거예요. 아홉 시부터 열두 시까지 공부할 거예요. 점심에는 친구를 만나서 밥을 먹을 거예요. 오후에는 도서관에 가서 책을 읽을 거예요. 저녁에는 음악을 들을 거예요. 밤 열한 시에 잘 거예요.")} className="mt-auto flex items-center justify-center gap-2 rounded-2xl bg-[#487a54] p-4 text-sm font-black text-white"><Volume2 size={16} />播放七句示范</button>
      </>),
      "34": <div className="flex h-full flex-col justify-center"><div className="mx-auto w-full max-w-[440px] text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f4eb] text-[#487a54]"><Sparkles size={27} /></span><p className="mt-4 text-xs font-black tracking-[0.18em] text-[#487a54]">LESSON 10 · COMPLETE</p><h2 className="mt-3 text-4xl font-black">지금 몇 시예요?</h2><p className="mt-3 text-lg font-black">你已经完成第十课</p><p className="mx-auto mt-3 max-w-[390px] text-sm leading-7 text-[#60736a]">现在你能准确表达时刻和日程范围，区分两种动作连接方式，并完整说明未来计划。</p><div className="mt-4 grid grid-cols-2 gap-3 text-left">{[
        ["01", "精确读时", "시간 표현"], ["02", "说明范围", "N부터 N까지"],
        ["03", "连接动作", "V-아서/어서"], ["04", "表达计划", "V-(으)ㄹ 거예요"],
      ].map(([index, title, detail]) => <div key={index} className="rounded-xl border border-[#dce8e1] bg-white px-4 py-3"><p className="text-[10px] font-black text-[#487a54]">{index}</p><p className="mt-1 text-xs font-black">{title}</p><p className="mt-1 text-[10px] text-[#71857b]">{detail}</p></div>)}</div><div className="mt-4 rounded-2xl border border-[#cfe3d4] bg-[#f2f8f3] px-5 py-3.5 text-left"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black tracking-[0.14em] text-[#487a54]">LESSON 10 TEST · 本课测试</p><p className="mt-1 text-xs font-bold text-[#52685e]">检验时间、日程范围、动作连接和未来计划。</p></div><button type="button" onClick={() => window.location.assign("/dashboard/assignments/korean")} className="shrink-0 rounded-full bg-white px-3 py-2 text-[10px] font-black text-[#487a54] shadow-sm">前往测试专区</button></div></div><button type="button" onClick={() => flipBookRef.current?.pageFlip()?.flip(1)} className="mt-4 rounded-full bg-[#eaf2fb] px-4 py-3 text-xs font-black text-[#3d6f9f]">返回目录</button></div></div>,
    };

    return pages[number];
  }

  const pages = Array.from({ length: 34 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return <Page key={`10-${number}`} number={number}>{renderPage(number)}</Page>;
  });

  return (
    <section ref={containerRef} className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden">
      <div className="relative shrink-0" style={{ width: BOOK_WIDTH * scale, height: BOOK_HEIGHT * scale }}>
        <button type="button" onClick={() => flipBookRef.current?.pageFlip()?.flipPrev()} aria-label="上一页" className="absolute -left-14 top-1/2 z-20 -translate-y-1/2 rounded-full border border-[#cfe2d9] bg-white p-3 text-[#238777] shadow-lg"><ArrowLeft size={18} /></button>
        <button type="button" onClick={() => flipBookRef.current?.pageFlip()?.flipNext()} aria-label="下一页" className="absolute -right-14 top-1/2 z-20 -translate-y-1/2 rounded-full border border-[#cfe2d9] bg-white p-3 text-[#238777] shadow-lg"><ArrowRight size={18} /></button>
        <div className="absolute left-0 top-0 h-[822px] w-[1180px] origin-top-left" style={{ transform: `scale(${scale})` }}>
          <HTMLFlipBook ref={flipBookRef} width={590} height={822} startPage={initialPage} size="fixed" minWidth={590} maxWidth={590} minHeight={822} maxHeight={822} drawShadow maxShadowOpacity={0.32} flippingTime={650} usePortrait startZIndex={0} autoSize={false} showCover={false} mobileScrollSupport swipeDistance={24} clickEventForward useMouseEvents={false} showPageCorners={false} disableFlipByClick onFlip={(event) => onPageChange?.(event.data)} className="h-[822px] w-[1180px]" style={{}}>
            <Page number="封面" cover><KoreanEbookCover lesson={lesson} /></Page>
            {pages}
          </HTMLFlipBook>
        </div>
      </div>
    </section>
  );
}
