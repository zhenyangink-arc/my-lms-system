"use client";

import dynamic from "next/dynamic";

const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false });
import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Clapperboard,
  Headphones,
  Languages,
  MapPin,
  MessageCircle,
  Mic2,
  Music2,
  NotebookPen,
  Sparkles,
  Tickets,
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
      header={TEMPLATE.headers[number] ?? "第 8 课 · 영화 볼까요?"}
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
    blue: "border-[var(--border)] bg-[var(--accent)] text-[var(--primary)]",
    rose: "border-[var(--border)] bg-[var(--card)] text-[var(--destructive)]",
    green: "border-[var(--border)] bg-[var(--status-success-surface)] text-[var(--status-success)]",
    amber: "border-[var(--border)] bg-[var(--status-warning-surface)] text-[var(--status-warning)]",
  };
  return (
    <section className={`mt-4 rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-[11px] font-bold">{title}</p>
      <div className="mt-2 text-xs font-bold leading-6 text-[var(--foreground-secondary)]">{children}</div>
    </section>
  );
}

function WordGrid({ words, speak, showChinese }: { words: Word[]; speak: Speak; showChinese: boolean }) {
  const dense = words.length > 12 || words.some((word) => word.korean.length > 9);
  return (
    <div className={`mt-4 grid grid-cols-3 ${dense ? "gap-2" : "gap-3"} ${showChinese ? "" : "[&_[data-vocab-meaning]]:opacity-0"}`}>
      {words.map((word) => (
        <KoreanEbookVocabularyCard
          key={`${word.korean}-${word.type}-${word.chinese}`}
          {...word}
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

const activityWords: Word[] = [
  { korean: "영화", type: "休闲名词", chinese: "电影" },
  { korean: "음악", type: "休闲名词", chinese: "音乐" },
  { korean: "공연", type: "休闲名词", chinese: "演出" },
  { korean: "전시회", type: "休闲名词", chinese: "展览会" },
  { korean: "산책하다", type: "动词", chinese: "散步" },
  { korean: "영화를 보다", type: "活动表达", chinese: "看电影" },
  { korean: "음악을 듣다", type: "活动表达", chinese: "听音乐" },
  { korean: "사진을 찍다", type: "活动表达", chinese: "拍照" },
  { korean: "친구를 만나다", type: "活动表达", chinese: "见朋友" },
  { korean: "커피를 마시다", type: "活动表达", chinese: "喝咖啡" },
  { korean: "재미있다", type: "形容词", chinese: "有趣" },
  { korean: "재미없다", type: "形容词", chinese: "没意思" },
  { korean: "좋다", type: "形容词", chinese: "好" },
  { korean: "괜찮다", type: "形容词", chinese: "不错／没关系" },
  { korean: "바쁘다", type: "形容词", chinese: "忙" },
];

const appointmentWords: Word[] = [
  { korean: "같이", type: "副词", chinese: "一起" },
  { korean: "언제", type: "疑问词", chinese: "什么时候" },
  { korean: "어디", type: "疑问词", chinese: "哪里" },
  { korean: "무슨", type: "疑问冠词", chinese: "什么样的" },
  { korean: "몇 시", type: "时间表达", chinese: "几点" },
  { korean: "오전", type: "时间名词", chinese: "上午" },
  { korean: "오후", type: "时间名词", chinese: "下午" },
  { korean: "주말", type: "时间名词", chinese: "周末" },
  { korean: "약속", type: "名词", chinese: "约定" },
  { korean: "시간", type: "名词", chinese: "时间" },
  { korean: "영화관", type: "场所名词", chinese: "电影院" },
  { korean: "공원", type: "场所名词", chinese: "公园" },
  { korean: "앞", type: "方位名词", chinese: "前面" },
  { korean: "표", type: "名词", chinese: "票" },
  { korean: "예매하다", type: "动词", chinese: "预订" },
];

const dWords: Word[] = [
  { korean: "듣다 → 들어요", type: "ㄷ不规则动词", chinese: "听" },
  { korean: "걷다 → 걸어요", type: "ㄷ不规则动词", chinese: "走／步行" },
  { korean: "묻다 → 물어요", type: "ㄷ不规则动词", chinese: "问" },
  { korean: "깨닫다 → 깨달아요", type: "ㄷ不规则动词", chinese: "领悟" },
  { korean: "싣다 → 실어요", type: "ㄷ不规则动词", chinese: "装载" },
  { korean: "받다 → 받아요", type: "规则动词", chinese: "收到" },
  { korean: "닫다 → 닫아요", type: "规则动词", chinese: "关闭" },
  { korean: "믿다 → 믿어요", type: "规则动词", chinese: "相信" },
  { korean: "얻다 → 얻어요", type: "规则动词", chinese: "得到" },
  { korean: "뜯다 → 뜯어요", type: "规则动词", chinese: "拆开" },
  { korean: "듣고", type: "辅音词尾形态", chinese: "听，并且……" },
  { korean: "듣지만", type: "辅音词尾形态", chinese: "听，但是……" },
];

const pointingWords: Word[] = [
  { korean: "이 영화", type: "指示冠词表达", chinese: "这部电影" },
  { korean: "그 음악", type: "指示冠词表达", chinese: "那首音乐" },
  { korean: "저 사람", type: "指示冠词表达", chinese: "那边那个人" },
  { korean: "이 책", type: "指示冠词表达", chinese: "这本书" },
  { korean: "그 카페", type: "指示冠词表达", chinese: "那家咖啡店" },
  { korean: "저 건물", type: "指示冠词表达", chinese: "那边那栋楼" },
  { korean: "이것", type: "指示代词", chinese: "这个东西" },
  { korean: "그것", type: "指示代词", chinese: "那个东西" },
  { korean: "저것", type: "指示代词", chinese: "那边那个东西" },
  { korean: "이 사람", type: "指示冠词表达", chinese: "这个人" },
  { korean: "그 장소", type: "指示冠词表达", chinese: "那个地点" },
  { korean: "저 영화관", type: "指示冠词表达", chinese: "那边的电影院" },
];

const dividers: Record<string, { step: string; title: string; goal: string; icon: ReactNode }> = {
  "02": { step: "第一步", title: "课前导航", goal: "完成“提出活动—商量方案—确定约会—体验后评价”的完整交际链。", icon: <Clapperboard aria-hidden="true" size={24} /> },
  "04": { step: "第二步", title: "核心词汇", goal: "围绕休闲活动、约会信息、ㄷ结尾动词和指示表达建立词汇网络。", icon: <Music2 aria-hidden="true" size={24} /> },
  "09": { step: "第三步", title: "语法讲解", goal: "四个语法各占一页，解释结构、使用场景、变形规则和易错点。", icon: <NotebookPen aria-hidden="true" size={24} /> },
  "14": { step: "第四步", title: "句型操练", goal: "先判断词尾开头，再决定 ㄷ 是否变成 ㄹ；同步练习提议和感叹。", icon: <Languages aria-hidden="true" size={24} /> },
  "18": { step: "第五步", title: "实战对话", goal: "通过三组八句以上对话完成电影、散步和音乐活动的商量。", icon: <MessageCircle aria-hidden="true" size={24} /> },
  "22": { step: "第六步", title: "听说任务", goal: "把活动、时间、地点、集合方式和备选方案组合成可执行的约定。", icon: <CalendarDays aria-hidden="true" size={24} /> },
  "26": { step: "第七步", title: "读写拓展", goal: "读懂活动邀请，并写出包含提议、回应与评价的原创信息。", icon: <BookOpenCheck aria-hidden="true" size={24} /> },
  "29": { step: "第八步", title: "自测与复盘", goal: "综合检查词汇、ㄷ变化、指示冠词、感叹词尾与约会表达。", icon: <CheckCircle2 aria-hidden="true" size={24} /> },
};

export function KoreanLevelOneLessonEightBook({
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
      title: "场景 1 · 周末看电影",
      description: "提出建议，商量电影、时间和集合地点。",
      lines: [
        { speaker: "智", korean: "이번 주말에 시간 있어요?", chinese: "这周末有时间吗？" },
        { speaker: "敏", korean: "네, 토요일 오후에 괜찮아요.", chinese: "有，周六下午可以。" },
        { speaker: "智", korean: "같이 영화 볼까요?", chinese: "我们一起看电影好吗？" },
        { speaker: "敏", korean: "좋아요. 무슨 영화를 볼까요?", chinese: "好。我们看什么电影呢？" },
        { speaker: "智", korean: "이 영화를 볼까요? 재미있대요.", chinese: "看这部电影好吗？听说很有趣。" },
        { speaker: "敏", korean: "좋네요! 몇 시에 만날까요?", chinese: "真不错！几点见面呢？" },
        { speaker: "智", korean: "두 시에 영화관 앞에서 만나요.", chinese: "两点在电影院门口见。" },
        { speaker: "敏", korean: "네, 제가 표를 예매할게요.", chinese: "好，我来订票。" },
      ],
    },
    "20": {
      title: "场景 2 · 公园散步",
      description: "用 ㄷ 不规则动词讨论走路和听音乐。",
      lines: [
        { speaker: "秀", korean: "오늘 날씨가 정말 좋네요!", chinese: "今天天气真好啊！" },
        { speaker: "宇", korean: "네, 따뜻하고 맑네요.", chinese: "是啊，又暖和又晴朗。" },
        { speaker: "秀", korean: "공원에서 같이 걸을까요?", chinese: "一起在公园走走好吗？" },
        { speaker: "宇", korean: "좋아요. 음악도 들을까요?", chinese: "好。也听音乐好吗？" },
        { speaker: "秀", korean: "네, 그 음악을 듣고 싶어요.", chinese: "好，我想听那首音乐。" },
        { speaker: "宇", korean: "공원이 아주 조용하네요.", chinese: "公园真安静啊。" },
        { speaker: "秀", korean: "한 시간쯤 걷고 커피를 마셔요.", chinese: "走一个小时左右再喝咖啡吧。" },
        { speaker: "宇", korean: "좋아요. 저 카페에 갈까요?", chinese: "好。去那边那家咖啡店好吗？" },
      ],
    },
    "21": {
      title: "场景 3 · 方案发生变化",
      description: "拒绝原方案时给出理由，并立刻提出备选活动。",
      lines: [
        { speaker: "娜", korean: "오늘 공연을 볼까요?", chinese: "今天看演出好吗？" },
        { speaker: "浩", korean: "미안해요. 오늘은 조금 바빠요.", chinese: "对不起，今天有点忙。" },
        { speaker: "娜", korean: "그럼 내일 만날까요?", chinese: "那么明天见面好吗？" },
        { speaker: "浩", korean: "네, 내일은 괜찮아요.", chinese: "好，明天可以。" },
        { speaker: "娜", korean: "이 전시회를 볼까요?", chinese: "看这个展览好吗？" },
        { speaker: "浩", korean: "사진이 정말 멋있네요!", chinese: "照片真精彩啊！" },
        { speaker: "娜", korean: "전시회를 보고 음악도 들을까요?", chinese: "看完展览也听音乐好吗？" },
        { speaker: "浩", korean: "좋아요. 내일 세 시에 만나요.", chinese: "好。明天三点见。" },
      ],
    },
  };

  function renderPage(number: string) {
    if (number === "01") {
      return (
        <KoreanEbookTableOfContents
          lessonNumber={8}
          pageMeta={TEMPLATE.pageMeta}
          onNavigate={(target) => flipBookRef.current?.pageFlip()?.flip(target)}
          entries={[
            { step: "01", title: "课前导航", pageRange: "02—03", detail: "建立约会任务链" },
            { step: "02", title: "核心词汇", pageRange: "04—08", detail: "活动·约会·ㄷ动词·指示" },
            { step: "03", title: "语法讲解", pageRange: "09—13", detail: "提议·不规则·指示·感叹" },
            { step: "04", title: "句型操练", pageRange: "14—17", detail: "元音触发与辅音保持" },
            { step: "05", title: "实战对话", pageRange: "18—21", detail: "三组八句约会交流" },
            { step: "06", title: "听说任务", pageRange: "22—25", detail: "从提议到确认" },
            { step: "07", title: "读写拓展", pageRange: "26—28", detail: "读邀请·写计划" },
            { step: "08", title: "自测与复盘", pageRange: "29—34", detail: "全书收束验收" },
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
        <MessageCircle aria-hidden="true" size={22} />,
        <>
          <Dialogue lines={dialogue.lines} speak={speak} showChinese={Boolean(revealed[`chinese${number}`])} />
          <Note title="角色交换" tone="rose">替换活动、时间和地点，再完成一轮八句对话。</Note>
        </>,
        <KoreanEbookRevealButton shown={Boolean(revealed[`chinese${number}`])} onClick={() => toggle(`chinese${number}`)} />
      );
    }

    const pages: Record<string, ReactNode> = {
      "03": content("03", "一场约会需要哪些表达？", "把四个语法放进真实商量流程，而不是孤立背句型。", <Tickets aria-hidden="true" size={22} />, <>
        <div className="mt-5 grid grid-cols-2 gap-3">{[
          ["提议", "같이 영화 볼까요?", "一起看电影好吗？"],
          ["选择", "이 영화를 볼까요?", "看这部电影好吗？"],
          ["确认", "몇 시에 만날까요?", "几点见面呢？"],
          ["感叹", "정말 재미있네요!", "真有趣啊！"],
      ].map(([tag, korean, chinese]) => <button key={tag} type="button" onClick={() => speak(korean)} className="rounded-2xl border border-[var(--border)] bg-white p-4 text-left"><b className="text-[10px] text-[var(--status-warning)]">{tag}</b><div className="mt-2 flex items-center justify-between gap-2"><p className="text-sm font-bold">{korean}</p><Volume2 aria-hidden="true" size={14} className="shrink-0 text-[var(--primary)]"/></div><p className={`mt-1 text-[11px] text-[var(--foreground-secondary)] ${revealed.chinese03 ? "opacity-100" : "opacity-0"}`}>{chinese}</p></button>)}</div>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[10px] font-bold">{[
          ["①", "提议活动"], ["②", "选择对象"], ["③", "敲定约会"], ["④", "体验评价"],
        ].map(([index, label]) => <div key={index} className="rounded-xl bg-[var(--status-warning-surface)] px-2 py-3"><span className="text-[var(--status-warning)]">{index}</span><p className="mt-1">{label}</p></div>)}</div>
        <p className="mt-3 rounded-xl border border-dashed border-[var(--border)] px-4 py-3 text-xs font-bold text-[var(--status-warning)]">先用 “같이 무엇을 할까요?” 发起，再追问 “언제／어디에서 만날까요?”。</p>
        <Note title="最终任务" tone="amber">完成至少八句约会对话：必须有提议、回应、一个替代方案、时间地点和体验评价。</Note>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese03)} onClick={() => toggle("chinese03")} />),
      "05": content("05", "1. 休闲活动与评价", "把活动名词、动作和评价组合成完整表达。", <Clapperboard aria-hidden="true" size={22} />, <><WordGrid words={activityWords} speak={speak} showChinese={Boolean(revealed.chinese05)} /><Note title="组合输出">영화를 보고 음악을 들어요. 이 영화는 정말 재미있네요!</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese05)} onClick={() => toggle("chinese05")} />),
      "06": content("06", "2. 约会信息", "商量活动时要补全时间、地点和集合方式。", <CalendarDays aria-hidden="true" size={22} />, <><WordGrid words={appointmentWords} speak={speak} showChinese={Boolean(revealed.chinese06)} /><Note title="五要素" tone="green">谁 + 什么时候 + 在哪里 + 做什么 + 如何确认。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese06)} onClick={() => toggle("chinese06")} />),
      "07": content("07", "3. ㄷ 结尾动词家族", "先区分不规则动词与“老实人”规则动词。", <Languages aria-hidden="true" size={22} />, <><WordGrid words={dWords} speak={speak} showChinese={Boolean(revealed.chinese07)} /><Note title="两大规则例外" tone="rose">받다 → 받아요，닫다 → 닫아요。它们即使遇到元音词尾，ㄷ 也不变。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese07)} onClick={() => toggle("chinese07")} />),
      "08": content("08", "4. 指示冠词与代词", "이/그/저 后面必须跟名词；이것/그것/저것可以独立出现。", <MapPin aria-hidden="true" size={22} />, <><WordGrid words={pointingWords} speak={speak} showChinese={Boolean(revealed.chinese08)} /><Note title="距离地图">이：靠近说话人；그：靠近听话人或双方已知；저：远离双方。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese08)} onClick={() => toggle("chinese08")} />),
      "10": content("10", "1. V-(으)ㄹ까요?", "提出共同建议或询问对方意见，语气开放而礼貌。", <MessageCircle aria-hidden="true" size={22} />, <>
        <div className="mt-5 grid grid-cols-2 gap-3">{[
          ["无收音 + ㄹ까요?", "보다 → 볼까요?", "가다 → 갈까요?"],
          ["有收音 + 을까요?", "먹다 → 먹을까요?", "읽다 → 읽을까요?"],
          ["ㄹ收音直接 + 까요?", "만들다 → 만들까요?", "놀다 → 놀까요?"],
          ["ㄷ不规则先变形", "듣다 → 들을까요?", "걷다 → 걸을까요?"],
        ].map(([rule, first, second]) => <article key={rule} className="rounded-2xl border border-[var(--border)] bg-white p-4"><b className="text-[var(--primary)]">{rule}</b><div className="mt-3 text-sm font-bold"><RuleSentence text={first.replace(" → ", ". ")} speak={speak}>{first}</RuleSentence><RuleSentence text={second.replace(" → ", ". ")} speak={speak}>{second}</RuleSentence></div></article>)}</div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <article className="rounded-xl bg-[var(--accent)] p-3"><b className="text-[var(--primary)]">共同提议</b><div className="mt-2 font-bold"><RuleSentence text="같이 점심을 먹을까요?" speak={speak}>같이 점심을 먹을까요?</RuleSentence></div><p className="mt-1 text-[var(--foreground-secondary)]">我们一起吃午饭好吗？</p></article>
          <article className="rounded-xl bg-[var(--accent)] p-3"><b className="text-[var(--primary)]">询问选择</b><div className="mt-2 font-bold"><RuleSentence text="무슨 음악을 들을까요?" speak={speak}>무슨 음악을 들을까요?</RuleSentence></div><p className="mt-1 text-[var(--foreground-secondary)]">我们听什么音乐呢？</p></article>
        </div>
        <Note title="回应方式" tone="green">接受：좋아요／그래요。调整：세 시는 어때요? 拒绝时先说理由，再给备选方案。</Note>
      </>),
      "11": content("11", "2. ㄷ 불규칙", "部分 ㄷ 结尾动词遇到元音词尾时，ㄷ 变为 ㄹ。", <Languages aria-hidden="true" size={22} />, <>
        <div className="mt-4 grid grid-cols-3 gap-3">{[
          ["듣다", "들 + 어요", "들어요"],
          ["걷다", "걸 + 어요", "걸어요"],
          ["묻다", "물 + 어요", "물어요"],
          ["듣다", "들 + 을까요?", "들을까요?"],
          ["걷다", "걸 + 을까요?", "걸을까요?"],
          ["받다", "받 + 아요", "받아요"],
        ].map(([base, middle, result]) => <article key={`${base}-${result}`} className="rounded-2xl border border-[var(--border)] bg-white p-3"><RuleSentence text={base} speak={speak}><b>{base}</b></RuleSentence><RuleSentence text={middle.replace(" + ", " ")} speak={speak}><span className="text-[10px] text-[var(--primary)]">{middle}</span></RuleSentence><RuleSentence text={result} speak={speak}><strong className="text-sm text-[var(--primary)]">{result}</strong></RuleSentence></article>)}</div>
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 rounded-2xl bg-[var(--accent)] p-4 text-center text-xs font-bold">
          <span>是不是<br/>ㄷ 不规则词？</span><span className="text-[var(--primary)]">→</span><span>后面是否<br/>以元音开始？</span><span className="text-[var(--primary)]">→</span><span className="text-[var(--primary)]">是：ㄷ → ㄹ<br/>否：保留 ㄷ</span>
        </div>
        <p className="mt-3 rounded-xl border border-dashed border-[var(--border)] px-4 py-3 text-xs font-bold">例外要整词记忆：<button type="button" onClick={() => speak("문을 닫아요. 선물을 받아요.")} className="ml-2 text-[var(--primary)] underline decoration-dotted">문을 닫아요. 선물을 받아요.</button></p>
        <Note title="辅音词尾保持 ㄷ" tone="rose">듣고、듣지만、듣습니다。后接词尾以 ㄱ、ㅈ、ㅅ 等辅音开始，不触发变化。</Note>
      </>),
      "12": content("12", "3. 이/그/저 + 名词", "指示冠词不能单独使用，必须限定紧随其后的名词。", <MapPin aria-hidden="true" size={22} />, <>
        <div className="mt-5 grid grid-cols-3 gap-3 text-center">{[
          ["이", "说话人附近", "이 영화／이 가방"],
          ["그", "听话人附近或双方已知", "그 책／그 카페"],
          ["저", "远离双方", "저 사람／저 건물"],
        ].map(([word, meaning, example]) => <article key={word} className="rounded-2xl border border-[var(--border)] bg-white p-5"><RuleSentence text={word} speak={speak}><span className="text-3xl font-bold text-[var(--primary)]">{word}</span></RuleSentence><p className="mt-2 text-[11px] text-[var(--foreground-secondary)]">{meaning}</p><div className="mt-3 text-sm font-bold"><RuleSentence text={example.replace("／", ". ")} speak={speak}>{example}</RuleSentence></div></article>)}</div>
        <div className="mt-4 grid grid-cols-2 gap-3"><Note title="冠词：不能独立">이 영화가 재미있어요.<br/>这部电影有趣。</Note><Note title="代词：可以独立" tone="green">이것이 재미있어요.<br/>这个很有趣。</Note></div>
        <section className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-xs">
          <p className="font-bold text-[var(--primary)]">对话里的 그 还可以指“双方刚才谈到的对象”</p>
          <div className="mt-2 font-bold"><RuleSentence text="그 영화를 저도 보고 싶어요." speak={speak}>그 영화를 저도 보고 싶어요.</RuleSentence></div>
          <p className="mt-1 text-[var(--foreground-secondary)]">那部电影我也想看。这里不一定表示距离，而是承接共同话题。</p>
        </section>
      </>),
      "13": content("13", "4. A/V-네요", "亲身体验或刚发现事实后发出感叹，词干直接加 -네요。", <Sparkles aria-hidden="true" size={22} />, <>
        <div className="mt-4 space-y-3">{[
          ["재미있다", "이 영화 정말 재미있네요!", "这部电影真有趣啊！"],
          ["춥다", "오늘 날씨가 춥네요!", "今天天气真冷啊！"],
          ["좋다", "이 음악이 정말 좋네요!", "这首音乐真好听啊！"],
          ["사람이 많다", "영화관에 사람이 많네요!", "电影院人真多啊！"],
        ].map(([base, korean, chinese]) => <button key={base} type="button" onClick={() => speak(korean)} className="block w-full rounded-2xl border border-[var(--border)] bg-white p-4 text-left"><b className="text-[10px] text-[var(--primary)]">{base} → -네요</b><div className="mt-2 flex items-center justify-between gap-2"><p className="text-base font-bold">{korean}</p><Volume2 aria-hidden="true" size={14} className="shrink-0 text-[var(--primary)]"/></div><p className={`mt-1 text-xs text-[var(--foreground-secondary)] ${revealed.chinese13 ? "opacity-100" : "opacity-0"}`}>{chinese}</p></button>)}</div>
        <Note title="不是普通陈述" tone="amber">재미있어요只是评价；재미있네요带有“亲自发现后觉得真有趣”的现场感。</Note>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese13)} onClick={() => toggle("chinese13")} />),
      "15": content("15", "1. ㄷ 不规则“照妖镜”", "同一个动词遇到元音词尾和辅音词尾时横向比较。", <Languages aria-hidden="true" size={22} />, <>
        <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)]"><div className="grid grid-cols-5 bg-[var(--card)] p-3 text-center text-[11px] font-bold"><span>基本形</span><span>-어요</span><span>-(으)ㄹ까요?</span><span>-고</span><span>-습니다</span></div>{[
          ["듣다", "들어요", "들을까요?", "듣고", "듣습니다"],
          ["걷다", "걸어요", "걸을까요?", "걷고", "걷습니다"],
          ["묻다", "물어요", "물을까요?", "묻고", "묻습니다"],
          ["받다", "받아요", "받을까요?", "받고", "받습니다"],
        ].map((row) => <div key={row[0]} className="grid grid-cols-5 border-t border-[var(--border)] p-3 text-center text-xs font-bold">{row.map((cell, index) => <span key={`${row[0]}-${index}`} className={`${index === 1 || index === 2 ? "text-[var(--destructive)]" : ""} ${index > 0 && !revealed.forms ? "opacity-0" : "opacity-100"}`}>{cell}</span>)}</div>)}</div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-bold">{[
          ["무슨 음악을 들어요?", "听什么音乐？"],
          ["같이 음악을 들을까요?", "一起听音乐好吗？"],
          ["음악을 듣고 걸어요.", "听着音乐走路。"],
          ["선물을 받아요.", "收到礼物。"],
        ].map(([korean, chinese]) => <button key={korean} type="button" onClick={() => speak(korean)} className="rounded-xl bg-[var(--card)] p-3 text-left"><span>{korean}</span><p className="mt-1 text-[10px] text-[var(--foreground-secondary)]">{chinese}</p></button>)}</div>
        <Note title="判断顺序" tone="rose">先确认是不是不规则词，再看词尾是否以元音开头。받다、닫다从第一步就判定为规则词。</Note>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.forms)} onClick={() => toggle("forms")} answer />),
      "16": content("16", "2. 提议句生成器", "从活动、时间和地点三个槽位生成自然提议。", <CalendarDays aria-hidden="true" size={22} />, <>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">{[
          ["活动", "영화를 보다", "음악을 듣다", "공원에서 걷다"],
          ["时间", "오늘", "내일 오후", "이번 주말"],
          ["地点", "영화관", "공원", "그 카페"],
        ].map(([title, ...items]) => <article key={title} className="rounded-2xl border border-[var(--border)] bg-white p-4"><b className="text-[var(--status-warning)]">{title}</b>{items.map((item) => <p key={item} className="mt-3 text-xs font-bold">{item}</p>)}</article>)}</div>
        <div className={`mt-5 rounded-2xl bg-[var(--status-warning-surface)] p-5 text-center ${revealed.generator ? "opacity-100" : "opacity-0"}`}><RuleSentence text="내일 오후에 공원에서 같이 걸을까요?" speak={speak}><span className="text-xl font-bold">내일 오후에 공원에서 같이 걸을까요?</span></RuleSentence><p className="mt-2 text-xs text-[var(--foreground-secondary)]">明天下午一起在公园散步好吗？</p></div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] font-bold">{[
          ["接受", "좋아요!"], ["调整", "세 시는 어때요?"], ["替代", "그럼 영화를 볼까요?"],
        ].map(([label, korean]) => <button key={label} type="button" onClick={() => speak(korean)} className="rounded-xl bg-white p-3 shadow-sm"><span className="text-[var(--status-warning)]">{label}</span><p className="mt-1">{korean}</p></button>)}</div>
        <Note title="自然顺序">时间 → 地点 → 一起 → 活动提议。并非每句都要全部出现，但约定最终必须补齐。</Note>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.generator)} onClick={() => toggle("generator")} answer />),
      "17": content("17", "3. 指示与感叹配对", "先指出对象，再表达现场发现。", <Sparkles aria-hidden="true" size={22} />, <>
        <div className="mt-4 grid grid-cols-2 gap-3">{[
          ["이 영화", "정말 재미있네요!", "这部电影真有趣啊！"],
          ["그 음악", "아주 좋네요!", "那首音乐真好听啊！"],
          ["저 건물", "정말 크네요!", "那栋楼真大啊！"],
          ["이 가방", "아주 가볍네요!", "这个包真轻啊！"],
          ["그 카페", "사람이 많네요!", "那家咖啡店人真多啊！"],
          ["저 공원", "정말 조용하네요!", "那个公园真安静啊！"],
        ].map(([target, reaction, chinese]) => <article key={target} className="rounded-2xl border border-[var(--border)] bg-white p-4"><RuleSentence text={target} speak={speak}><b className="text-[var(--status-warning)]">{target}</b></RuleSentence><div className="mt-2 text-sm font-bold"><RuleSentence text={reaction} speak={speak}>{reaction}</RuleSentence></div><p className={`mt-1 text-[10px] text-[var(--foreground-secondary)] ${revealed.chinese17 ? "opacity-100" : "opacity-0"}`}>{chinese}</p></article>)}</div>
        <Note title="说话视角" tone="amber">选择 이/그/저 时先观察距离和共同认知，而不是机械对应中文“这/那”。</Note>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese17)} onClick={() => toggle("chinese17")} />),
      "23": content("23", "1. 五步约会卡", "把模糊的“有空见面”变成真正可执行的计划。", <CalendarDays aria-hidden="true" size={22} />, <>
        <div className="mt-4 space-y-2.5">{[
          ["01 提议", "같이 영화 볼까요?"],
          ["02 选项目", "이 영화를 볼까요?"],
          ["03 定时间", "토요일 세 시에 만날까요?"],
          ["04 定地点", "영화관 앞에서 만나요."],
          ["05 再确认", "제가 표를 예매할게요."],
        ].map(([step, sentence]) => <article key={step} className="grid grid-cols-[90px_1fr] rounded-xl border border-[var(--border)] bg-white p-3 text-sm"><b className="text-[var(--primary)]">{step}</b><span className="font-bold">{sentence}</span></article>)}</div>
        <section className="mt-4 rounded-2xl bg-[var(--accent)] p-4">
          <p className="text-[11px] font-bold text-[var(--primary)]">30 秒口头排练</p>
          <div className="mt-2 flex items-center justify-between gap-3 text-xs font-bold"><span>换掉“电影／周六／电影院”，重新说完整五步。</span><KoreanEbookSpeakButton text="같이 공연을 볼까요? 일요일 세 시에 공연장 앞에서 만나요. 제가 표를 예매할게요." onSpeak={speak} compact /></div>
        </section>
        <Note title="计划闭环">一个自然对话不能停在“좋아요”。接受建议后还要继续确定时间、地点和行动负责人。</Note>
      </>),
      "24": content("24", "2. 听力 · 约会信息表", "听两遍，提取活动、时间、地点和准备事项。", <Headphones aria-hidden="true" size={22} />, <>
        <button type="button" onClick={() => speak("이번 주 토요일에 같이 영화 볼까요? 오후 세 시 영화가 좋아요. 두 시 반에 영화관 앞에서 만나요. 제가 표를 예매할게요. 영화가 끝나고 그 카페에서 커피도 마셔요.")} className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] p-4 text-sm font-bold text-white"><Volume2 aria-hidden="true" size={17}/>播放约会语音</button>
        <div className="mt-5 grid grid-cols-2 gap-3">{[
          ["活动", "영화를 보다／커피를 마시다"],
          ["日期", "이번 주 토요일"],
          ["集合", "두 시 반／영화관 앞"],
          ["准备", "표를 예매하다"],
        ].map(([label, answer]) => <article key={label} className="rounded-2xl border border-[var(--border)] bg-white p-4"><b className="text-[var(--primary)]">{label}</b><p className={`mt-2 text-sm font-bold ${revealed.listening ? "opacity-100" : "opacity-0"}`}>{answer}</p></article>)}</div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
          <div className="rounded-xl bg-[var(--accent)] p-3">① 圈出时间数字</div>
          <div className="rounded-xl bg-[var(--accent)] p-3">② 标记集合地点</div>
          <div className="rounded-xl bg-[var(--accent)] p-3">③ 排列活动顺序</div>
        </div>
        <Note title="听力策略">第一遍抓数字和地点；第二遍补活动顺序和谁负责什么。</Note>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.listening)} onClick={() => toggle("listening")} answer />),
      "25": content("25", "3. 备选方案挑战", "拒绝时不让对话中断：理由 + 新时间或新活动。", <MessageCircle aria-hidden="true" size={22} />, <>
        <div className="mt-4 grid grid-cols-2 gap-3">{[
          ["오늘 영화 볼까요?", "오늘은 바빠요. 내일 볼까요?"],
          ["공원에서 걸을까요?", "비가 와요. 카페에 갈까요?"],
          ["이 영화를 볼까요?", "재미없어요. 그 영화를 볼까요?"],
          ["세 시에 만날까요?", "세 시는 어려워요. 네 시는 어때요?"],
        ].map(([proposal, alternative]) => <article key={proposal} className="rounded-2xl border border-[var(--border)] bg-white p-4"><p className="text-xs font-bold">{proposal}</p><p className="mt-3 text-xs font-bold text-[var(--primary)]">→ {alternative}</p></article>)}</div>
        <section className="mt-4 rounded-2xl bg-[var(--accent)] p-4">
          <p className="text-[11px] font-bold text-[var(--primary)]">不让对话中断的三步</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-bold">
            <span className="rounded-lg bg-white p-3">미안해요<br/><small>先表示歉意</small></span>
            <span className="rounded-lg bg-white p-3">오늘은 바빠요<br/><small>简短说明理由</small></span>
            <span className="rounded-lg bg-white p-3">내일 볼까요?<br/><small>立即给替代方案</small></span>
          </div>
        </section>
        <div className="mt-4 flex items-center justify-between rounded-xl border border-dashed border-[var(--border)] p-3 text-xs font-bold"><span>口头替换：下雨／没时间／电影没意思</span><KoreanEbookSpeakButton text="미안해요. 오늘은 시간이 없어요. 내일 만날까요?" onSpeak={speak} compact /></div>
        <Note title="礼貌商量" tone="green">否定方案，不否定对方。先简短说明原因，再立即给可执行替代方案。</Note>
      </>),
      "27": content("27", "1. 阅读 · 周末邀请", "判断提议内容、集合信息和备选方案。", <BookOpenCheck aria-hidden="true" size={22} />, <>
        <section className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-5"><p className="text-[11px] font-bold text-[var(--status-success)]">민수에게</p><p className="mt-3 text-sm font-bold leading-7">이번 주 토요일에 같이 영화 볼까요? 새로 나온 이 영화가 정말 재미있대요. 오후 두 시에 영화관 앞에서 만나요. 영화가 끝나고 음악도 들을까요? 시간이 없으면 일요일에 만나요. 답장 기다릴게요.</p></section>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">{[
          ["主要活动是什么？", "영화를 봐요."],
          ["什么时候、在哪里集合？", "토요일 오후 두 시／영화관 앞"],
          ["第二个活动是什么？", "음악을 들어요."],
          ["不能周六见面的备选方案是什么？", "일요일에 만나요."],
        ].map(([question, answer], index) => <div key={question} className="rounded-xl bg-[var(--status-success-surface)] p-3 font-bold"><p><span className="mr-2 text-[var(--status-success)]">{index + 1}.</span>{question}</p><p className={`mt-2 text-[var(--status-success)] ${revealed.reading ? "opacity-100" : "opacity-0"}`}>{answer}</p></div>)}</div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] font-bold">
          <span className="rounded-xl border border-[var(--border)] bg-white p-3">提议：영화 볼까요?</span>
          <span className="rounded-xl border border-[var(--border)] bg-white p-3">追加：음악도 들을까요?</span>
          <span className="rounded-xl border border-[var(--border)] bg-white p-3">备选：일요일에 만나요.</span>
        </div>
        <p className="mt-3 rounded-xl bg-[var(--status-success-surface)] px-4 py-3 text-xs font-bold text-[var(--status-success)]">阅读顺序：先圈活动，再框时间地点，最后找 “없으면” 后面的备选方案。</p>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.reading)} onClick={() => toggle("reading")} answer />),
      "28": content("28", "2. 写作 · 我的约会邀请", "写 7—9 句原创邀请，必须让对方知道如何行动。", <NotebookPen aria-hidden="true" size={22} />, <>
        <div className="mt-4 grid grid-cols-2 gap-3"><Note title="内容骨架" tone="green">问候 → 提议 → 选择对象 → 时间 → 地点 → 追加活动 → 备选方案 → 请求回复</Note><Note title="语法清单" tone="amber">-(으)ㄹ까요? 两次<br/>이/그/저 + 名词一次<br/>ㄷ不规则一次<br/>-네요一次</Note></div>
        <section className="mt-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] p-5"><p className="text-[11px] font-bold text-[var(--status-success)]">原创示范</p><p className="mt-3 text-sm font-bold leading-7">지수 씨, 주말에 시간 있어요? 같이 공원에서 걸을까요? 저 공원이 조용하고 좋대요. 오후 세 시에 입구에서 만나요. 걸으면서 음악도 들을까요? 날씨가 춥네요. 따뜻한 옷을 입으세요. 시간이 없으면 다음 주에 만나요.</p></section>
        <section className="mt-4 rounded-2xl bg-[var(--status-success-surface)] p-4">
          <p className="text-[11px] font-bold text-[var(--status-success)]">交稿前自检</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold">{["对方知道做什么","有明确日期和时间","有明确集合地点","拒绝时还有备选方案"].map((item) => <label key={item} className="flex items-center gap-2 rounded-lg bg-white p-2.5"><input type="checkbox" className="accent-[var(--status-success)]"/>{item}</label>)}</div>
        </section>
      </>),
      "30": content("30", "1. 词汇闪测", "看到中文后两秒内说出韩语。", <Clapperboard aria-hidden="true" size={22} />, <div className="mt-4 grid grid-cols-3 gap-2.5">{[
        ["电影", "영화"], ["音乐", "음악"], ["散步", "산책하다"], ["有趣", "재미있다"],
        ["没意思", "재미없다"], ["听", "듣다"], ["走", "걷다"], ["问", "묻다"],
        ["收到", "받다"], ["关闭", "닫다"], ["一起", "같이"], ["预订", "예매하다"],
      ].map(([chinese, korean], index) => <article key={`${chinese}-${korean}`} className="rounded-xl border border-[var(--border)] bg-white p-3 text-center"><p className="text-[10px] text-[var(--status-success)]">{index + 1}</p><b>{chinese}</b><p className={`mt-2 rounded-lg bg-[var(--status-success-surface)] p-2 text-xs font-bold ${revealed.words ? "opacity-100" : "opacity-0"}`}>{korean}</p></article>)}</div>, <KoreanEbookRevealButton shown={Boolean(revealed.words)} onClick={() => toggle("words")} answer />),
      "31": content("31", "2. ㄷ 变形检测", "元音词尾变 ㄹ，辅音词尾保留 ㄷ；规则动词始终不变。", <Languages aria-hidden="true" size={22} />, <>
        <div className="mt-4 grid grid-cols-2 gap-2.5">{[
          ["듣다 + 어요", "들어요"], ["듣다 + 을까요?", "들을까요?"],
          ["듣다 + 고", "듣고"], ["듣다 + 습니다", "듣습니다"],
          ["걷다 + 어요", "걸어요"], ["묻다 + 어요", "물어요"],
          ["받다 + 아요", "받아요"], ["받다 + 을까요?", "받을까요?"],
          ["닫다 + 아요", "닫아요"], ["닫다 + 고", "닫고"],
        ].map(([question, answer], index) => <article key={`${question}-${index}`} className="rounded-xl border border-[var(--border)] bg-white p-3"><b>{question}</b><p className={`mt-2 text-sm font-bold text-[var(--status-success)] ${revealed.change ? "opacity-100" : "opacity-0"}`}>{answer}</p></article>)}</div>
        <Note title="合格标准" tone="green">至少答对 9 题，并能解释 듣고 与 들어요 为什么不同。</Note>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.change)} onClick={() => toggle("change")} answer />),
      "32": content("32", "3. 综合句型检测", "完成提议、指示和感叹表达。", <CheckCircle2 aria-hidden="true" size={22} />, <div className="mt-4 space-y-2">{[
        ["一起看电影好吗？", "같이 영화 볼까요?"],
        ["我们听什么音乐呢？", "무슨 음악을 들을까요?"],
        ["这部电影真有趣啊！", "이 영화 정말 재미있네요!"],
        ["那首音乐真好听啊！", "그 음악이 정말 좋네요!"],
        ["在公园走走好吗？", "공원에서 걸을까요?"],
        ["这个很贵。", "이것이 비싸요."],
        ["那边那个人是谁？", "저 사람은 누구예요?"],
        ["这首音乐真好听啊！", "이 음악이 정말 좋네요!"],
        ["明天下午见面好吗？", "내일 오후에 만날까요?"],
      ].map(([question, answer], index) => <article key={`${question}-${index}`} className="grid grid-cols-2 gap-3 rounded-xl border border-[var(--border)] bg-white p-3 text-xs font-bold"><span>{index + 1}. {question}</span><span className={`text-[var(--status-success)] ${revealed.test ? "opacity-100" : "opacity-0"}`}>{answer}</span></article>)}</div>, <KoreanEbookRevealButton shown={Boolean(revealed.test)} onClick={() => toggle("test")} answer />),
      "33": content("33", "4. 全书终极口语任务", "不看稿完成至少八句约会对话，并在活动后追加两句评价。", <Mic2 aria-hidden="true" size={22} />, <>
        <section className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--status-success-surface)] p-5"><p className="text-xs font-bold text-[var(--status-success)]">八项必达信息</p><div className="mt-4 grid grid-cols-2 gap-3 text-xs">{["询问是否有空","提出共同活动","选择具体对象","商量时间","确定地点","使用ㄷ不规则","使用-네요评价","给出备选方案"].map((task, index) => <label key={`${task}-${index}`} className="flex items-center gap-2 rounded-xl bg-white p-3 font-bold"><input type="checkbox" className="accent-[var(--status-success)]" />{task}</label>)}</div></section>
        <button type="button" onClick={() => speak("이번 주말에 시간 있어요? 네, 토요일 오후에 괜찮아요. 같이 영화 볼까요? 좋아요. 이 영화를 볼까요? 정말 재미있겠네요. 두 시에 영화관 앞에서 만날까요? 네, 영화가 끝나고 음악도 들어요. 그 음악이 정말 좋네요. 시간이 없으면 일요일에 만나요.")} className="mt-auto flex items-center justify-center gap-2 rounded-2xl bg-[var(--status-success)] p-4 text-sm font-bold text-white"><Volume2 aria-hidden="true" size={16} />播放十句示范</button>
      </>),
      "34": <div className="flex h-full flex-col justify-center"><div className="mx-auto w-full max-w-[440px] text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--status-success-surface)] text-[var(--status-success)]"><Sparkles aria-hidden="true" size={27} /></span><h3 className="mt-3 text-4xl font-bold">영화 볼까요?</h3><p className="mt-3 text-lg font-bold">你已经完成韩国语 1A</p><p className="mx-auto mt-3 max-w-[390px] text-sm leading-7 text-[var(--foreground-secondary)]">现在你能主动提出活动、商量约会、处理方案变化，并自然表达现场发现与评价。</p><div className="mt-4 grid grid-cols-2 gap-3 text-left">{[
        ["01", "提出建议", "V-(으)ㄹ까요?"], ["02", "掌握变化", "ㄷ 불규칙"],
        ["03", "指示对象", "이/그/저 + N"], ["04", "表达感叹", "A/V-네요"],
      ].map(([index, title, detail]) => <div key={index} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3"><p className="text-[10px] font-bold text-[var(--status-success)]">{index}</p><p className="mt-1 text-xs font-bold">{title}</p><p className="mt-1 text-[10px] text-[var(--foreground-secondary)]">{detail}</p></div>)}</div><div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--status-success-surface)] px-5 py-3.5 text-left"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold tracking-[0.14em] text-[var(--status-success)]">1A 综合测试</p><p className="mt-1 text-xs font-bold text-[var(--foreground-secondary)]">前往测试专区，完成韩国语 1A 阶段验收。</p></div><KoreanEbookTestLink /></div></div><button type="button" onClick={() => flipBookRef.current?.pageFlip()?.flip(1)} className="mt-4 rounded-full bg-[var(--accent)] px-4 py-3 text-xs font-bold text-[var(--primary)]">返回目录</button></div></div>,
    };
    return pages[number];
  }

  const pages = Array.from({ length: 34 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return <Page key={`08-${number}`} number={number}>{renderPage(number)}</Page>;
  });

  return (
    <section ref={containerRef} className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden [&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-[var(--ring)] [&_button:focus-visible]:ring-offset-2 [&_input:focus-visible]:outline-none [&_input:focus-visible]:ring-2 [&_input:focus-visible]:ring-[var(--ring)] [&_input:focus-visible]:ring-offset-2">
      <div className="relative shrink-0" style={{ width: BOOK_WIDTH * scale, height: BOOK_HEIGHT * scale }}>
        <button type="button" onClick={() => flipBookRef.current?.pageFlip()?.flipPrev()} aria-label="上一页" className="absolute -left-14 top-1/2 z-20 -translate-y-1/2 rounded-full border border-[var(--border)] bg-white p-3 text-[var(--status-success)] shadow-lg"><ArrowLeft aria-hidden="true" size={18} /></button>
        <button type="button" onClick={() => flipBookRef.current?.pageFlip()?.flipNext()} aria-label="下一页" className="absolute -right-14 top-1/2 z-20 -translate-y-1/2 rounded-full border border-[var(--border)] bg-white p-3 text-[var(--status-success)] shadow-lg"><ArrowRight aria-hidden="true" size={18} /></button>
        <div className="absolute left-0 top-0 h-[822px] w-[1180px] origin-top-left" style={{ transform: `scale(${scale})` }}>
          <HTMLFlipBook ref={flipBookRef} width={590} height={822} startPage={initialPage} size="fixed" minWidth={590} maxWidth={590} minHeight={822} maxHeight={822} drawShadow maxShadowOpacity={0.32} flippingTime={650} usePortrait startZIndex={0} autoSize={false} showCover={false} mobileScrollSupport swipeDistance={24} clickEventForward useMouseEvents={true} showPageCorners={false} disableFlipByClick onFlip={(event) => onPageChange?.(event.data)} className="h-[822px] w-[1180px]" style={{}}>
            <Page number="封面" cover><KoreanEbookCover lesson={lesson} /></Page>
            {pages}
          </HTMLFlipBook>
        </div>
      </div>
    </section>
  );
}
