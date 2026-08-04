"use client";

import dynamic from "next/dynamic";

const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false });
import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Gift,
  Glasses,
  Headphones,
  MessageCircle,
  Mic2,
  NotebookPen,
  Shirt,
  ShoppingBag,
  Sparkles,
  Tags,
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
  { step: "STEP 01", label: "课前导航", dividerPage: 2, contentPages: [3] },
  { step: "STEP 02", label: "核心词汇", dividerPage: 4, contentPages: [5, 6, 7, 8] },
  { step: "STEP 03", label: "语法讲解", dividerPage: 9, contentPages: [10, 11, 12, 13] },
  { step: "STEP 04", label: "句型操练", dividerPage: 14, contentPages: [15, 16, 17] },
  { step: "STEP 05", label: "实战对话", dividerPage: 18, contentPages: [19, 20, 21] },
  { step: "STEP 06", label: "听说任务", dividerPage: 22, contentPages: [23, 24, 25] },
  { step: "STEP 07", label: "读写拓展", dividerPage: 26, contentPages: [27, 28] },
  { step: "STEP 08", label: "自测与复盘", dividerPage: 29, contentPages: [30, 31, 32, 33, 34, 35] },
]);

const Page = forwardRef<
  HTMLDivElement,
  { children: ReactNode; number: string; cover?: boolean }
>(function Page({ children, number, cover = false }, ref) {
  return (
    <KoreanEbookPage
      ref={ref}
      number={number}
      header={TEMPLATE.headers[number] ?? "第 14 课 · 이 옷을 입어 보세요"}
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
      className={`mt-4 grid grid-cols-3 ${words.length > 12 ? "gap-2" : "gap-3"} ${
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
          className="min-h-[82px] rounded-2xl border border-[#ead0d6] bg-white p-5"
        >
          <b className="text-[10px] text-[#a65b68]">{card.label}</b>
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
          className={`flex gap-2.5 rounded-xl p-3.5 ${
            index % 2 ? "bg-[#fff7ed]" : "bg-[#f4f8f6]"
          }`}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-black">
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
          className={`rounded-xl border border-[#ead8be] bg-white text-xs font-black ${
            items.length > 10 ? "min-h-[58px] p-3" : "min-h-[68px] p-4"
          }`}
        >
          <span>{question}</span>
          <p className={`mt-3 leading-5 text-[#a65b68] ${shown ? "opacity-100" : "opacity-0"}`}>
            {answer}
          </p>
        </article>
      ))}
    </div>
  );
}

const clothesWords: Word[] = [
  { korean: "옷", pronunciation: "옫", type: "服饰", chinese: "衣服" },
  { korean: "바지", pronunciation: "바지", type: "服饰", chinese: "裤子" },
  { korean: "치마", pronunciation: "치마", type: "服饰", chinese: "裙子" },
  { korean: "구두", pronunciation: "구두", type: "服饰", chinese: "皮鞋" },
  { korean: "운동화", pronunciation: "운동화", type: "服饰", chinese: "运动鞋" },
  { korean: "모자", pronunciation: "모자", type: "服饰", chinese: "帽子" },
  { korean: "안경", pronunciation: "안경", type: "配饰", chinese: "眼镜" },
  { korean: "가방", pronunciation: "가방", type: "配饰", chinese: "包" },
  { korean: "셔츠", pronunciation: "셔츠", type: "服饰", chinese: "衬衫" },
  { korean: "코트", pronunciation: "코트", type: "服饰", chinese: "大衣" },
  { korean: "양말", pronunciation: "양말", type: "服饰", chinese: "袜子" },
  { korean: "장갑", pronunciation: "장갑", type: "配饰", chinese: "手套" },
];

const adjectiveWords: Word[] = [
  { korean: "길다 → 길어요", pronunciation: "길다 → 기러요", type: "形容词", chinese: "长" },
  { korean: "짧다 → 짧아요", pronunciation: "짤따 → 짤바요", type: "形容词", chinese: "短" },
  { korean: "크다 → 커요", pronunciation: "크다 → 커요", type: "形容词", chinese: "大" },
  { korean: "작다 → 작아요", pronunciation: "작따 → 자가요", type: "形容词", chinese: "小" },
  { korean: "예쁘다 → 예뻐요", pronunciation: "예쁘다 → 예뻐요", type: "形容词", chinese: "漂亮" },
  { korean: "멋있다 → 멋있어요", pronunciation: "머싣따 → 머시써요", type: "形容词", chinese: "帅气／有型" },
  { korean: "어울리다", pronunciation: "어울리다", type: "状态动词", chinese: "合适／般配" },
  { korean: "편하다", pronunciation: "편하다", type: "形容词", chinese: "舒服" },
  { korean: "불편하다", pronunciation: "불편하다", type: "形容词", chinese: "不舒服" },
  { korean: "비슷하다", pronunciation: "비스타다", type: "形容词", chinese: "相似" },
  { korean: "밝다", pronunciation: "박따", type: "形容词", chinese: "明亮" },
  { korean: "어둡다", pronunciation: "어둡따", type: "形容词", chinese: "暗" },
];

const wearingWords: Word[] = [
  { korean: "옷을 입다", pronunciation: "오슬 입따", type: "穿戴动词", chinese: "穿衣服" },
  { korean: "바지를 입다", pronunciation: "바지를 입따", type: "穿戴动词", chinese: "穿裤子" },
  { korean: "구두를 신다", pronunciation: "구두를 신따", type: "穿戴动词", chinese: "穿皮鞋" },
  { korean: "양말을 신다", pronunciation: "양마를 신따", type: "穿戴动词", chinese: "穿袜子" },
  { korean: "모자를 쓰다", pronunciation: "모자를 쓰다", type: "穿戴动词", chinese: "戴帽子" },
  { korean: "안경을 쓰다", pronunciation: "안경을 쓰다", type: "穿戴动词", chinese: "戴眼镜" },
  { korean: "반지를 끼다", pronunciation: "반지를 끼다", type: "穿戴动词", chinese: "戴戒指" },
  { korean: "장갑을 끼다", pronunciation: "장가블 끼다", type: "穿戴动词", chinese: "戴手套" },
  { korean: "시계를 차다", pronunciation: "시계를 차다", type: "穿戴动词", chinese: "戴手表" },
  { korean: "옷을 벗다", pronunciation: "오슬 벋따", type: "穿戴动词", chinese: "脱衣服" },
  { korean: "사이즈", pronunciation: "사이즈", type: "购物名词", chinese: "尺码" },
  { korean: "탈의실", pronunciation: "타리실", type: "购物名词", chinese: "试衣间" },
];

const cultureWords: Word[] = [
  { korean: "선물", pronunciation: "선물", type: "礼物", chinese: "礼物" },
  { korean: "포장하다", pronunciation: "포장하다", type: "购物动词", chinese: "包装" },
  { korean: "선물을 주다", pronunciation: "선무를 주다", type: "赠送表达", chinese: "送礼物" },
  { korean: "선물을 드리다", pronunciation: "선무를 드리다", type: "敬语表达", chinese: "向长辈赠送礼物" },
  { korean: "친구한테", pronunciation: "친구한테", type: "对象助词", chinese: "给朋友" },
  { korean: "부모님께", pronunciation: "부모님께", type: "敬语助词", chinese: "给父母" },
  { korean: "신발", pronunciation: "신발", type: "文化词", chinese: "鞋子" },
  { korean: "빨간색", pronunciation: "빨간색", type: "颜色", chinese: "红色" },
  { korean: "카드", pronunciation: "카드", type: "礼物", chinese: "卡片" },
];

const pronunciationWords: Word[] = [
  { korean: "짧다", pronunciation: "짤따", type: "ㄼ双收音", chinese: "短" },
  { korean: "짧은 치마", pronunciation: "짤븐 치마", type: "连音", chinese: "短裙" },
  { korean: "넓다", pronunciation: "널따", type: "ㄼ双收音", chinese: "宽" },
  { korean: "읽다", pronunciation: "익따", type: "ㄺ双收音", chinese: "读" },
  { korean: "읽어요", pronunciation: "일거요", type: "连音", chinese: "阅读" },
  { korean: "없다", pronunciation: "업따", type: "ㅄ双收音", chinese: "没有" },
  { korean: "있는 옷", pronunciation: "인는 옫", type: "鼻音化", chinese: "有的衣服" },
  { korean: "멋있는 옷", pronunciation: "머신는 옫", type: "连音", chinese: "有型的衣服" },
  { korean: "옷을 입다", pronunciation: "오슬 입따", type: "连音", chinese: "穿衣服" },
];

const dividers: Record<
  string,
  { step: string; title: string; goal: string; icon: ReactNode }
> = {
  "02": {
    step: "STEP 01",
    title: "课前导航",
    goal: "建立“描述商品—选择尺码—建议试穿—评价搭配—决定购买／送礼”的购物交际链。",
    icon: <ShoppingBag size={24} />,
  },
  "04": {
    step: "STEP 02",
    title: "核心词汇",
    goal: "掌握服饰、外观形容词、穿戴动词、购物与送礼表达。",
    icon: <Shirt size={24} />,
  },
  "09": {
    step: "STEP 03",
    title: "语法讲解",
    goal: "四个语法各占一页：形容词定语、ㄹ脱落、尝试建议和动作对象。",
    icon: <NotebookPen size={24} />,
  },
  "14": {
    step: "STEP 04",
    title: "句型操练",
    goal: "把商品特征、穿戴动作、试穿建议和送礼对象组合成完整表达。",
    icon: <Tags size={24} />,
  },
  "18": {
    step: "STEP 05",
    title: "实战对话",
    goal: "完成试衣、试鞋和生日礼物三组八句购物对话。",
    icon: <MessageCircle size={24} />,
  },
  "22": {
    step: "STEP 06",
    title: "听说任务",
    goal: "从购物对话中提取商品、颜色、尺码、评价、收礼人和最终决定。",
    icon: <Headphones size={24} />,
  },
  "26": {
    step: "STEP 07",
    title: "读写拓展",
    goal: "读懂商品推荐，并写出包含特征、试穿建议和送礼对象的推荐文。",
    icon: <BookOpenCheck size={24} />,
  },
  "29": {
    step: "STEP 08",
    title: "自测与复盘",
    goal: "检查服饰词汇、四项语法、穿戴搭配、双收音和购物交际能力。",
    icon: <CheckCircle2 size={24} />,
  },
};

export function KoreanLevelOneLessonFourteenBook({
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
      title: "场景 1 · 在服装店试衣",
      description: "描述想要的衣服，比较尺码，并接受店员的试穿建议。",
      lines: [
        { speaker: "A", korean: "어서 오세요. 어떤 옷을 찾으세요?", chinese: "欢迎光临。您在找什么样的衣服？" },
        { speaker: "B", korean: "예쁜 재킷을 찾고 있어요.", chinese: "我在找漂亮的夹克。" },
        { speaker: "A", korean: "이 파란 재킷은 어때요?", chinese: "这件蓝色夹克怎么样？" },
        { speaker: "B", korean: "예쁘지만 저한테 조금 커요.", chinese: "很漂亮，不过对我来说有点大。" },
        { speaker: "A", korean: "그럼 이 작은 재킷을 입어 보세요.", chinese: "那么请试穿一下这件小一点的夹克。" },
        { speaker: "B", korean: "네, 어디에서 입어 봐요?", chinese: "好的，在哪里试穿？" },
        { speaker: "A", korean: "저쪽 탈의실에서 입어 보세요.", chinese: "请在那边的试衣间试穿。" },
        { speaker: "B", korean: "네, 한번 입어 볼게요.", chinese: "好的，我试穿一下。" },
      ],
    },
    "20": {
      title: "场景 2 · 选择合适的鞋",
      description: "评价鞋子的大小和外观，再比较哪一双更适合衣服。",
      lines: [
        { speaker: "A", korean: "이 구두가 어때요?", chinese: "这双皮鞋怎么样？" },
        { speaker: "B", korean: "디자인은 멋있지만 조금 작아요.", chinese: "设计很有型，不过有点小。" },
        { speaker: "A", korean: "그럼 한 사이즈 큰 구두를 신어 보세요.", chinese: "那么请试穿大一码的皮鞋。" },
        { speaker: "B", korean: "네, 이건 발에 잘 맞아요.", chinese: "好的，这双很合脚。" },
        { speaker: "A", korean: "검은색 구두도 있어요.", chinese: "也有黑色的皮鞋。" },
        { speaker: "B", korean: "그 구두도 신어 볼게요.", chinese: "那双我也试穿一下。" },
        { speaker: "A", korean: "어떤 구두가 더 마음에 들어요?", chinese: "更喜欢哪双鞋？" },
        { speaker: "B", korean: "검은색 구두가 제 옷하고 더 잘 어울려요.", chinese: "黑色皮鞋和我的衣服更搭。" },
      ],
    },
    "21": {
      title: "场景 3 · 给母亲挑生日礼物",
      description: "选择适合长辈的礼物，并正确使用께与드리다。",
      lines: [
        { speaker: "A", korean: "어머니 생신 선물을 사려고 해요.", chinese: "我打算买母亲的生日礼物。" },
        { speaker: "B", korean: "어떤 선물을 생각하고 있어요?", chinese: "在考虑什么礼物？" },
        { speaker: "A", korean: "예쁜 가방을 드리려고 해요.", chinese: "我打算送一只漂亮的包。" },
        { speaker: "B", korean: "이 작은 가방은 어때요?", chinese: "这个小包怎么样？" },
        { speaker: "A", korean: "이 색깔이 어머니께 잘 어울릴까요?", chinese: "这个颜色适合母亲吗？" },
        { speaker: "B", korean: "네, 아주 잘 어울릴 거예요.", chinese: "是的，应该非常适合。" },
        { speaker: "A", korean: "그럼 이 가방을 포장해 주세요.", chinese: "那么请把这个包包装起来。" },
        { speaker: "B", korean: "네, 예쁘게 포장해 드릴게요.", chinese: "好的，我会为您精美包装。" },
      ],
    },
  };

  function renderPage(number: string) {
    if (number === "01") {
      return (
        <KoreanEbookTableOfContents
          lessonNumber={14}
          pageMeta={TEMPLATE.pageMeta}
          onNavigate={(target) => flipBookRef.current?.pageFlip()?.flip(target)}
          entries={[
            { step: "01", title: "课前导航", pageRange: "02—03", detail: "建立完整购物流程" },
            { step: "02", title: "核心词汇", pageRange: "04—08", detail: "服饰·形容词·穿戴·文化" },
            { step: "03", title: "语法讲解", pageRange: "09—13", detail: "四项购物核心语法" },
            { step: "04", title: "句型操练", pageRange: "14—17", detail: "定语·试穿·送礼" },
            { step: "05", title: "实战对话", pageRange: "18—21", detail: "三组八句购物交流" },
            { step: "06", title: "听说任务", pageRange: "22—25", detail: "听推荐·做建议" },
            { step: "07", title: "读写拓展", pageRange: "26—28", detail: "读商品·写推荐" },
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
            替换商品、颜色、尺码、评价和收礼人，再完成一轮不少于八句的购物对话。
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
        "一次购物的五步结构",
        "描述商品、确认大小、建议试穿、评价搭配，最后决定购买或送礼。",
        <ShoppingBag size={22} />,
        <>
          <CardGrid
            cards={[
              { label: "描述", korean: "작은 가방을 찾고 있어요.", chinese: "正在找小包。" },
              { label: "试穿", korean: "이 옷을 입어 보세요.", chinese: "请试穿这件衣服。" },
              { label: "评价", korean: "이 모자가 잘 어울려요.", chinese: "这顶帽子很适合你。" },
              { label: "送礼", korean: "부모님께 선물을 드려요.", chinese: "给父母送礼物。" },
              { label: "确认尺码", korean: "한 사이즈 작은 것도 있어요?", chinese: "有小一码的吗？" },
              { label: "决定购买", korean: "이 치마로 할게요.", chinese: "我要这条裙子。" },
            ]}
            speak={speak}
            showChinese={Boolean(revealed.chinese03)}
          />
          <Note title="最终任务" tone="amber">
            完成一段10句购物交流：说出商品特征、尺码、穿戴动作、试穿建议、搭配评价和送礼对象。
          </Note>
        </>,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.chinese03)}
          onClick={() => toggle("chinese03")}
        />
      ),
      "05": content(
        "05",
        "1. 服饰与配饰",
        "记忆服饰时同时绑定正确的穿戴动词，避免全部翻译成“穿”。",
        <Shirt size={22} />,
        <>
          <WordGrid
            words={clothesWords}
            speak={speak}
            showChinese={Boolean(revealed.chinese05)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Note title="服饰搭配">셔츠를 입고 바지를 입어요.</Note>
            <Note title="配饰搭配" tone="green">안경을 쓰고 가방을 메요.</Note>
          </div>
        </>,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.chinese05)}
          onClick={() => toggle("chinese05")}
        />
      ),
      "06": content(
        "06",
        "2. 外观与穿着评价",
        "用大小、长短、外观和舒适度描述商品，再用어울리다评价搭配。",
        <Tags size={22} />,
        <WordGrid
          words={adjectiveWords}
          speak={speak}
          showChinese={Boolean(revealed.chinese06)}
        />,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.chinese06)}
          onClick={() => toggle("chinese06")}
        />
      ),
      "07": content(
        "07",
        "3. 穿戴动词",
        "衣服、鞋袜、帽子眼镜、戒指手套和手表分别使用不同动词。",
        <Glasses size={22} />,
        <>
          <WordGrid
            words={wearingWords}
            speak={speak}
            showChinese={Boolean(revealed.chinese07)}
          />
          <Note title="身体位置记忆法">
            身上입다／脚上신다／头脸쓰다／手指与手部끼다／手腕차다。
          </Note>
        </>,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.chinese07)}
          onClick={() => toggle("chinese07")}
        />
      ),
      "08": content(
        "08",
        "4. 送礼表达与双收音发音",
        "先掌握赠送对象与敬语，再辨认짧다等双收音的实际读音。",
        <Gift size={22} />,
        <>
          <WordGrid
            words={[...cultureWords, ...pronunciationWords]}
            speak={speak}
            showChinese={Boolean(revealed.chinese08)}
          />
          <Note title="发音纠错" tone="rose">
            짧다读[짤따]：ㄼ在这里保留ㄹ音，后面的ㄷ紧音化；遇到元音时짧은读[짤븐]，ㅂ连到下一音节。
          </Note>
        </>,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.chinese08)}
          onClick={() => toggle("chinese08")}
        />
      ),
      "10": content(
        "10",
        "1. A-(으)ㄴ N",
        "把形容词放在名词前作定语，相当于中文“……的 + 名词”。",
        <NotebookPen size={22} />,
        <>
          <CardGrid
            cards={[
              { label: "无收音 + ㄴ", korean: "큰 옷 / 싼 구두", chinese: "大衣服／便宜的鞋" },
              { label: "有收音 + 은", korean: "작은 가방 / 좋은 선물", chinese: "小包／好礼物" },
              { label: "있다 → 있는", korean: "재미있는 영화", chinese: "有趣的电影" },
              { label: "없다 → 없는", korean: "주머니가 없는 바지", chinese: "没有口袋的裤子" },
              { label: "예쁘다 → 예쁜", korean: "예쁜 원피스", chinese: "漂亮的连衣裙" },
              { label: "편하다 → 편한", korean: "편한 운동화", chinese: "舒适的运动鞋" },
            ]}
            speak={speak}
            showChinese={Boolean(revealed.chinese10)}
          />
          <Note title="先找词干">
            크다→크→큰，예쁘다→예쁘→예쁜。있다／없다虽表示状态，作定语时固定用있는／없는。
          </Note>
        </>,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.chinese10)}
          onClick={() => toggle("chinese10")}
        />
      ),
      "11": content(
        "11",
        "2. ㄹ 탈락",
        "词干以ㄹ收音结尾，遇到ㄴ、ㅂ、ㅅ开头的词尾时，ㄹ脱落。",
        <NotebookPen size={22} />,
        <>
          <CardGrid
            cards={[
              { label: "길다 + ㄴ", korean: "긴 치마", chinese: "长裙" },
              { label: "멀다 + ㄴ", korean: "먼 가게", chinese: "远处的商店" },
              { label: "길다 + ㅂ니다", korean: "깁니다.", chinese: "很长（正式体）" },
              { label: "길다 + 세요", korean: "기세요.", chinese: "很长（主体敬语）" },
              { label: "둥글다 + ㄴ", korean: "둥근 안경", chinese: "圆形眼镜" },
              { label: "가늘다 + ㄴ", korean: "가는 벨트", chinese: "细腰带" },
            ]}
            speak={speak}
            showChinese={Boolean(revealed.chinese11)}
          />
          <Note title="不要把两个规则拆开" tone="amber">
            길다先因ㄴ脱落ㄹ，再加ㄴ形成긴；不能写成길은，也不能写成길ㄴ。
          </Note>
        </>,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.chinese11)}
          onClick={() => toggle("chinese11")}
        />
      ),
      "12": content(
        "12",
        "3. V-아/어 보세요",
        "礼貌建议对方尝试某个动作；购物时常用于试穿、试戴和试用。",
        <Shirt size={22} />,
        <>
          <CardGrid
            cards={[
              { label: "입다 → 입어", korean: "이 옷을 입어 보세요.", chinese: "请试穿这件衣服。" },
              { label: "신다 → 신어", korean: "이 구두를 신어 보세요.", chinese: "请试穿这双鞋。" },
              { label: "쓰다 → 써", korean: "이 모자를 써 보세요.", chinese: "请戴一下这顶帽子。" },
              { label: "끼다 → 껴", korean: "이 반지를 껴 보세요.", chinese: "请试戴一下这枚戒指。" },
              { label: "차다 → 차", korean: "이 시계를 차 보세요.", chinese: "请试戴一下这块手表。" },
              { label: "메다 → 메", korean: "이 가방을 메 보세요.", chinese: "请背一下这个包。" },
            ]}
            speak={speak}
            showChinese={Boolean(revealed.chinese12)}
          />
          <Note title="보세요不是“看”">
            这里보다是辅助动词，整体表示“尝试做”。教学书写采用입어 보세요，中间留空格。
          </Note>
        </>,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.chinese12)}
          onClick={() => toggle("chinese12")}
        />
      ),
      "13": content(
        "13",
        "4. N한테／께",
        "标记动作的接受者；한테用于一般口语，께用于需要尊敬的对象。",
        <Gift size={22} />,
        <>
          <CardGrid
            cards={[
              { label: "平辈／晚辈", korean: "친구한테 선물을 줘요.", chinese: "给朋友送礼物。" },
              { label: "长辈敬语", korean: "부모님께 선물을 드려요.", chinese: "给父母送礼物。" },
              { label: "发送", korean: "동생한테 메시지를 보내요.", chinese: "给弟弟／妹妹发消息。" },
              { label: "询问长辈", korean: "선생님께 질문을 드려요.", chinese: "向老师提问。" },
              { label: "送给同事", korean: "동료한테 카드를 줘요.", chinese: "给同事卡片。" },
              { label: "献给祖母", korean: "할머니께 꽃을 드려요.", chinese: "给奶奶送花。" },
            ]}
            speak={speak}
            showChinese={Boolean(revealed.chinese13)}
          />
          <Note title="助词与动词一起升级" tone="rose">
            对长辈不只把한테换成께，주다也常换成敬语드리다：부모님께 선물을 드려요。
          </Note>
        </>,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.chinese13)}
          onClick={() => toggle("chinese13")}
        />
      ),
      "15": content(
        "15",
        "1. 形容词定语工坊",
        "把基本形转换成名词前的修饰形，并注意있다／없다和ㄹ脱落。",
        <NotebookPen size={22} />,
        <Exercise
          items={[
            ["크다 + 옷", "큰 옷"],
            ["싸다 + 구두", "싼 구두"],
            ["작다 + 가방", "작은 가방"],
            ["좋다 + 선물", "좋은 선물"],
            ["예쁘다 + 치마", "예쁜 치마"],
            ["멋있다 + 모자", "멋있는 모자"],
            ["길다 + 바지", "긴 바지"],
            ["짧다 + 치마", "짧은 치마"],
            ["편하다 + 운동화", "편한 운동화"],
            ["없다 + 주머니", "없는 주머니"],
          ]}
          shown={Boolean(revealed.modifier)}
        />,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.modifier)}
          onClick={() => toggle("modifier")}
          answer
        />
      ),
      "16": content(
        "16",
        "2. 穿戴动作配对",
        "先判断身体位置，再选择입다、신다、쓰다、끼다或차다。",
        <Glasses size={22} />,
        <Exercise
          items={[
            ["衣服", "옷을 입어요."],
            ["裙子", "치마를 입어요."],
            ["运动鞋", "운동화를 신어요."],
            ["袜子", "양말을 신어요."],
            ["帽子", "모자를 써요."],
            ["眼镜", "안경을 써요."],
            ["手套", "장갑을 껴요."],
            ["手表", "시계를 차요."],
            ["戒指", "반지를 껴요."],
            ["包", "가방을 메요."],
          ]}
          shown={Boolean(revealed.wearing)}
        />,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.wearing)}
          onClick={() => toggle("wearing")}
          answer
        />
      ),
      "17": content(
        "17",
        "3. 试穿与送礼实验",
        "把穿戴动作变成建议句，并根据收礼人选择한테／께和주다／드리다。",
        <Gift size={22} />,
        <Exercise
          items={[
            ["请试穿这件衣服。", "이 옷을 입어 보세요."],
            ["请试穿这双鞋。", "이 구두를 신어 보세요."],
            ["请戴一下帽子。", "이 모자를 써 보세요."],
            ["请试戴戒指。", "이 반지를 껴 보세요."],
            ["给朋友礼物。", "친구한테 선물을 줘요."],
            ["给弟弟一只包。", "동생한테 가방을 줘요."],
            ["给父母礼物。", "부모님께 선물을 드려요."],
            ["给老师卡片。", "선생님께 카드를 드려요."],
            ["请试戴手表。", "이 시계를 차 보세요."],
            ["给奶奶送花。", "할머니께 꽃을 드려요."],
          ]}
          shown={Boolean(revealed.practice)}
        />,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.practice)}
          onClick={() => toggle("practice")}
          answer
        />
      ),
      "23": content(
        "23",
        "1. 听力 · 服装店购物单",
        "听购物对话，记录商品、颜色、尺码、问题和最终决定。",
        <Headphones size={22} />,
        <>
          <button
            type="button"
            onClick={() =>
              speak(
                "어서 오세요. 어떤 옷을 찾으세요? 검은색 바지를 찾고 있어요. 이 긴 바지는 어때요? 디자인은 멋있지만 저한테 조금 커요. 그럼 한 사이즈 작은 바지를 입어 보세요. 네, 입어 볼게요."
              )
            }
            className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-[#a65b68] p-4 text-sm font-black text-white"
          >
            <Volume2 size={17} />
            播放购物对话
          </button>
          <Exercise
            items={[
              ["商品", "바지"],
              ["颜色", "검은색"],
              ["长度", "긴 바지"],
              ["问题", "조금 커요"],
              ["店员建议", "한 사이즈 작은 바지"],
              ["最终决定", "입어 볼게요"],
              ["顾客想要的颜色", "검은색"],
              ["顾客接下来做什么", "바지를 입어 봐요"],
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
        "2. 礼物对象与文化提醒",
        "选择礼物时既要考虑敬语，也要区分传统说法与现代个人偏好。",
        <Gift size={22} />,
        <>
          <CardGrid
            cards={[
              { label: "朋友", korean: "친구한테 모자를 줘요.", chinese: "给朋友帽子。" },
              { label: "父母", korean: "부모님께 가방을 드려요.", chinese: "给父母包。" },
              { label: "鞋子说法", korean: "신발을 선물하면 도망간대요.", chinese: "民间说送鞋后对方会“跑掉”。" },
              { label: "红笔提醒", korean: "이름을 빨간색으로 쓰지 마세요.", chinese: "传统上避免用红笔写姓名。" },
              { label: "给老师", korean: "선생님께 스카프를 드려요.", chinese: "给老师围巾。" },
              { label: "给朋友", korean: "친구한테 예쁜 카드를 줘요.", chinese: "给朋友漂亮的卡片。" },
            ]}
            speak={speak}
            showChinese={Boolean(revealed.chinese24)}
          />
          <Note title="文化不是硬性规则" tone="rose">
            “恋人送鞋会分手”和“避免红笔写姓名”属于广为人知的传统观念。现代生活中并非人人遵守；送礼前尊重对方偏好最重要。
          </Note>
        </>,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.chinese24)}
          onClick={() => toggle("chinese24")}
        />
      ),
      "25": content(
        "25",
        "3. 60秒商品推荐挑战",
        "不看稿推荐一件商品，并给出试穿建议和适合的收礼人。",
        <Mic2 size={22} />,
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Note title="顾客">
              ______을 찾고 있어요.
              <br />
              조금 ______아요/어요.
              <br />
              어디에서 입어 봐요?
              <br />
              ______한테/께 주려고 해요.
            </Note>
            <Note title="店员" tone="green">
              이 ______은/는 어때요?
              <br />
              ______(으)ㄴ 상품이에요.
              <br />
              한번 ______아/어 보세요.
              <br />
              아주 잘 어울릴 거예요.
            </Note>
            <Note title="追问">
              다른 색도 있어요?
              <br />
              한 사이즈 큰 것도 있어요?
              <br />
              가격이 얼마예요?
            </Note>
            <Note title="自然收尾" tone="amber">
              잘 어울리네요.
              <br />
              이걸로 할게요.
              <br />
              선물로 포장해 주세요.
            </Note>
            <Note title="尺码替换">
              조금 커요／작아요.
              <br />
              한 사이즈 큰／작은 것도 있어요?
            </Note>
            <Note title="送礼对象" tone="green">
              친구한테 주려고 해요.
              <br />
              부모님께 드리려고 해요.
            </Note>
          </div>
          <p className="mt-auto text-center text-[11px] font-bold text-[#71857b]">
            至少使用：A-(으)ㄴ N、ㄹ脱落词、-아/어 보세요、한테／께各一次。
          </p>
        </>
      ),
      "27": content(
        "27",
        "1. 阅读 · 선물 추천",
        "找出推荐商品的外观、尺寸、穿戴动作、适合对象与文化提醒。",
        <BookOpenCheck size={22} />,
        <>
          <section className="mt-4 rounded-2xl border border-[#ead0d6] bg-white p-5">
            <p className="text-[11px] font-black text-[#a65b68]">오늘의 선물 추천</p>
            <p className="mt-3 text-sm font-bold leading-7">
              이 가방은 작고 가벼운 가방이에요. 밝은 색이 아주 예뻐요. 짧은
              끈과 긴 끈이 모두 있어서 편하게 사용할 수 있어요. 어머니께 드릴
              선물을 찾는 분에게 잘 어울려요. 가게에서 직접 메어 보세요.
              선물할 때는 예쁜 카드도 같이 준비해 보세요.
            </p>
          </section>
          <Exercise
            items={[
              ["商品是什么？", "가방"],
              ["大小和重量？", "작고 가벼워요"],
              ["颜色怎么样？", "밝고 예뻐요"],
              ["有几种带子？", "짧은 끈과 긴 끈"],
              ["适合送给谁？", "어머니"],
              ["建议尝试什么？", "직접 메어 보세요"],
              ["为什么方便？", "짧은 끈과 긴 끈이 있어요"],
              ["还建议准备什么？", "예쁜 카드"],
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
        "2. 写作 · 我的商品推荐",
        "写7—9句原创推荐，让读者知道商品特征、试用方法和适合对象。",
        <NotebookPen size={22} />,
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Note title="内容骨架" tone="green">
              商品 → 颜色 → 大小 → 长短 → 穿戴动作 → 试用建议 → 收礼人 → 理由
            </Note>
            <Note title="语法清单" tone="amber">
              A-(으)ㄴ N两次
              <br />
              ㄹ脱落词一次
              <br />
              -아/어 보세요一次
              <br />
              한테／께一次
            </Note>
          </div>
          <section className="mt-4 rounded-2xl border border-dashed border-[#d9aeb8] bg-[#fff9fa] p-5">
            <p className="text-[11px] font-black text-[#a65b68]">原创示范</p>
            <p className="mt-3 text-sm font-bold leading-7">
              이 모자는 밝은 파란색이에요. 작고 가벼운 모자라서 편해요. 긴
              머리에도 잘 어울려요. 디자인이 단순하지만 멋있어요. 가게에서
              직접 써 보세요. 저는 이 모자를 친구한테 선물하려고 해요. 친구가
              파란색을 좋아해서 이 모자가 좋은 선물이 될 거예요.
            </p>
          </section>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs font-black">
            <span className="rounded-xl bg-[#f2f8f3] p-3">✓ 예쁜 모자</span>
            <span className="rounded-xl bg-[#fff8ed] p-3">✓ 긴 머리</span>
            <span className="rounded-xl bg-[#f2f8f3] p-3">✓ 써 보세요</span>
            <span className="rounded-xl bg-[#fff8ed] p-3">✓ 친구한테 선물해요</span>
          </div>
        </>
      ),
      "30": content(
        "30",
        "1. 服饰词汇闪测",
        "看到中文后两秒内说出韩语，并配对正确穿戴动词。",
        <Shirt size={22} />,
        <Exercise
          items={[
            ["衣服", "옷"],
            ["裤子", "바지"],
            ["裙子", "치마"],
            ["皮鞋", "구두"],
            ["运动鞋", "운동화"],
            ["帽子", "모자"],
            ["眼镜", "안경"],
            ["手套", "장갑"],
            ["穿衣服", "옷을 입다"],
            ["穿鞋", "신발을 신다"],
            ["戴帽子", "모자를 쓰다"],
            ["戴手表", "시계를 차다"],
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
        "2. 形容词定语检测",
        "根据收音和特殊词形完成A-(으)ㄴ N。",
        <NotebookPen size={22} />,
        <Exercise
          items={[
            ["크다 + 옷", "큰 옷"],
            ["싸다 + 가방", "싼 가방"],
            ["작다 + 모자", "작은 모자"],
            ["좋다 + 선물", "좋은 선물"],
            ["예쁘다 + 치마", "예쁜 치마"],
            ["재미있다 + 영화", "재미있는 영화"],
            ["길다 + 바지", "긴 바지"],
            ["짧다 + 치마", "짧은 치마"],
            ["편하다 + 운동화", "편한 운동화"],
            ["없다 + 주머니", "없는 주머니"],
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
        "3. 试穿与送礼检测",
        "完成建议句，并让助词与敬语动词保持一致。",
        <Gift size={22} />,
        <Exercise
          items={[
            ["입다 + 보세요", "입어 보세요."],
            ["신다 + 보세요", "신어 보세요."],
            ["쓰다 + 보세요", "써 보세요."],
            ["끼다 + 보세요", "껴 보세요."],
            ["朋友 + 礼物", "친구한테 선물을 줘요."],
            ["弟弟妹妹 + 包", "동생한테 가방을 줘요."],
            ["父母 + 礼物", "부모님께 선물을 드려요."],
            ["老师 + 卡片", "선생님께 카드를 드려요."],
            ["차다 + 보세요", "차 보세요."],
            ["奶奶 + 花", "할머니께 꽃을 드려요."],
          ]}
          shown={Boolean(revealed.gift)}
        />,
        <KoreanEbookRevealButton
          shown={Boolean(revealed.gift)}
          onClick={() => toggle("gift")}
          answer
        />
      ),
      "33": content(
        "33",
        "4. 发音与易错点诊所",
        "纠正ㄹ脱落、双收音、穿戴动词和敬语对象的常见错误。",
        <CheckCircle2 size={22} />,
        <Exercise
          items={[
            ["길은 치마 ×", "긴 치마 ✓"],
            ["짧다 [짭따] ×", "짧다 [짤따] ✓"],
            ["짧은 [짜븐] ×", "짧은 [짤븐] ✓"],
            ["구두를 입어요 ×", "구두를 신어요 ✓"],
            ["안경을 입어요 ×", "안경을 써요 ✓"],
            ["시계를 끼어요 ×", "시계를 차요 ✓"],
            ["부모님한테 줘요 △", "부모님께 드려요 ✓"],
            ["친구께 드려요 △", "친구한테 줘요 ✓"],
            ["긴은 바지 ×", "긴 바지 ✓"],
            ["모자를 입어요 ×", "모자를 써요 ✓"],
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
        "5. 口语验收 · 十句完整购物",
        "交换角色完成购物，并正确描述商品、建议试穿和决定送礼。",
        <Mic2 size={22} />,
        <>
          <section className="mt-4 rounded-2xl border border-[#ead0d6] bg-[#fff4f6] p-5">
            <p className="text-xs font-black text-[#a65b68]">八项必达信息</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              {[
                "说出目标商品",
                "使用形容词定语",
                "说明大小或长短",
                "使用正确穿戴动词",
                "提出试穿建议",
                "评价是否般配",
                "说明收礼对象",
                "礼貌决定购买",
              ].map((task) => (
                <label
                  key={task}
                  className="flex items-center gap-2 rounded-xl bg-white p-3 font-bold"
                >
                  <input type="checkbox" className="accent-[#a65b68]" />
                  {task}
                </label>
              ))}
            </div>
          </section>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-black">
            <span className="rounded-xl bg-[#eef6fb] p-3">商品描述 40%</span>
            <span className="rounded-xl bg-[#f2f8f3] p-3">语法正确 40%</span>
            <span className="rounded-xl bg-[#fff8ed] p-3">交流自然 20%</span>
          </div>
          <button
            type="button"
            onClick={() =>
              speak(
                "어서 오세요. 어떤 옷을 찾으세요? 예쁜 치마를 찾고 있어요. 이 긴 치마는 어때요? 저한테 조금 커요. 그럼 이 짧은 치마를 입어 보세요. 어디에서 입어 봐요? 저쪽 탈의실에서 입어 보세요. 네, 잘 어울리면 어머니께 드리려고 해요. 좋은 선물이 될 거예요."
              )
            }
            className="mt-auto flex items-center justify-center gap-2 rounded-2xl bg-[#a65b68] p-4 text-sm font-black text-white"
          >
            <Volume2 size={16} />
            播放十句示范
          </button>
        </>
      ),
      "35": (
        <div className="flex h-full flex-col justify-center">
          <div className="mx-auto w-full max-w-[440px] text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff0f3] text-[#a65b68]">
              <Sparkles size={27} />
            </span>
            <p className="mt-4 text-xs font-black tracking-[0.18em] text-[#a65b68]">
              LESSON 14 · COMPLETE
            </p>
            <h2 className="mt-3 text-4xl font-black">이 옷을 입어 보세요.</h2>
            <p className="mt-3 text-lg font-black">你已经完成第十四课</p>
            <p className="mx-auto mt-3 max-w-[390px] text-sm leading-7 text-[#60736a]">
              现在你能描述服饰特征、正确使用穿戴动词、建议别人试穿，并根据收礼对象选择恰当的助词与敬语。
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-left">
              {[
                ["01", "修饰名词", "A-(으)ㄴ N"],
                ["02", "词干变化", "ㄹ 탈락"],
                ["03", "建议尝试", "V-아/어 보세요"],
                ["04", "动作对象", "N한테／께"],
              ].map(([index, title, detail]) => (
                <div
                  key={index}
                  className="rounded-xl border border-[#ead0d6] bg-white px-4 py-3"
                >
                  <p className="text-[10px] font-black text-[#a65b68]">{index}</p>
                  <p className="mt-1 text-xs font-black">{title}</p>
                  <p className="mt-1 text-[10px] text-[#71857b]">{detail}</p>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => flipBookRef.current?.pageFlip()?.flip(1)}
              className="mt-4 rounded-full bg-[#fff0f3] px-4 py-3 text-xs font-black text-[#a65b68]"
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
      <Page key={`14-${number}`} number={number}>
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
          className="absolute -left-14 top-1/2 z-20 -translate-y-1/2 rounded-full border border-[#ead0d6] bg-white p-3 text-[#a65b68] shadow-lg"
        >
          <ArrowLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => flipBookRef.current?.pageFlip()?.flipNext()}
          aria-label="下一页"
          className="absolute -right-14 top-1/2 z-20 -translate-y-1/2 rounded-full border border-[#ead0d6] bg-white p-3 text-[#a65b68] shadow-lg"
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
