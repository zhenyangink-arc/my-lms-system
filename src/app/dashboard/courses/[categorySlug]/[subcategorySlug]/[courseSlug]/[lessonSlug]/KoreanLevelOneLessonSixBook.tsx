"use client";

import dynamic from "next/dynamic";

const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false });
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
  Apple,
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  ClipboardCheck,
  Coffee,
  Compass,
  Headphones,
  MessageCircle,
  Mic2,
  NotebookPen,
  Package,
  PencilLine,
  Scale,
  ShoppingBag,
  Sparkles,
  Store,
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

const LESSON_SIX_TEMPLATE = buildKoreanEbookSectionMap([
  { step: "STEP 01", label: "课前导航", dividerPage: 2, contentPages: [3] },
  { step: "STEP 02", label: "核心词汇表", dividerPage: 4, contentPages: [5, 6, 7, 8] },
  { step: "STEP 03", label: "语法讲解", dividerPage: 9, contentPages: [10, 11, 12, 13] },
  { step: "STEP 04", label: "句型操练", dividerPage: 14, contentPages: [15, 16, 17] },
  { step: "STEP 05", label: "实战对话", dividerPage: 18, contentPages: [19, 20, 21] },
  { step: "STEP 06", label: "听说任务", dividerPage: 22, contentPages: [23, 24, 25] },
  { step: "STEP 07", label: "读写拓展", dividerPage: 26, contentPages: [27, 28] },
  { step: "STEP 08", label: "自测与复盘", dividerPage: 29, contentPages: [30, 31, 32, 33] },
]);

const SectionStepContext = createContext("STEP 08");

function getSectionStep(number: string) {
  return LESSON_SIX_TEMPLATE.pageMeta[number]?.tag ?? "STEP 08";
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
        LESSON_SIX_TEMPLATE.headers[number] ??
        "第06课 · 얼마예요?"
      }
      cover={cover}
      sectionMeta={LESSON_SIX_TEMPLATE.pageMeta[number]}
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
    <div className="mt-4 grid grid-cols-2 gap-3">
      {lines.map((line, index) => (
        <div
          key={`${index}-${line.speaker}-${line.korean}`}
          className={`flex gap-2.5 rounded-xl p-3.5 ${
            index % 2 === 0 ? "bg-[#f4f8f6]" : "bg-[#fff7ed]"
          }`}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-black">
            {line.speaker}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-black leading-5 text-[#173f4a]">{line.korean}</p>
            <p className={`mt-0.5 text-[10px] font-bold leading-4 text-[#71857b] ${showChinese ? "opacity-100" : "opacity-0"}`}>{line.chinese}</p>
          </div>
          <KoreanEbookSpeakButton text={line.korean} onSpeak={speak} compact />
        </div>
      ))}
    </div>
  );
}

const productWords: VocabularyItem[] = [
  { korean: "사과", pronunciation: "사과", type: "商品名词", chinese: "苹果" },
  { korean: "오렌지", pronunciation: "오렌지", type: "商品名词", chinese: "橙子" },
  { korean: "빵", pronunciation: "빵", type: "商品名词", chinese: "面包" },
  { korean: "우유", pronunciation: "우유", type: "商品名词", chinese: "牛奶" },
  { korean: "물", pronunciation: "물", type: "商品名词", chinese: "水" },
  { korean: "주스", pronunciation: "주스", type: "商品名词", chinese: "果汁" },
  { korean: "옷", pronunciation: "옫", type: "商品名词", chinese: "衣服" },
  { korean: "가방", pronunciation: "가방", type: "商品名词", chinese: "包" },
  { korean: "구두", pronunciation: "구두", type: "商品名词", chinese: "皮鞋" },
  { korean: "배", pronunciation: "배", type: "商品名词", chinese: "梨" },
  { korean: "딸기", pronunciation: "딸기", type: "商品名词", chinese: "草莓" },
  { korean: "커피", pronunciation: "커피", type: "商品名词", chinese: "咖啡" },
  { korean: "콜라", pronunciation: "콜라", type: "商品名词", chinese: "可乐" },
  { korean: "모자", pronunciation: "모자", type: "商品名词", chinese: "帽子" },
  { korean: "티셔츠", pronunciation: "티셔츠", type: "商品名词", chinese: "T恤" },
];

const adjectiveWords: VocabularyItem[] = [
  { korean: "싸다", pronunciation: "싸다", type: "形容词", chinese: "便宜" },
  { korean: "비싸다", pronunciation: "비싸다", type: "形容词", chinese: "贵" },
  { korean: "크다", pronunciation: "크다", type: "形容词", chinese: "大" },
  { korean: "작다", pronunciation: "작따", type: "形容词", chinese: "小" },
  { korean: "많다", pronunciation: "만타", type: "形容词", chinese: "多" },
  { korean: "좋다", pronunciation: "조타", type: "形容词", chinese: "好" },
  { korean: "맛있다", pronunciation: "마싣따", type: "形容词", chinese: "好吃" },
  { korean: "맛없다", pronunciation: "마덥따", type: "形容词", chinese: "不好吃" },
  { korean: "예쁘다", pronunciation: "예쁘다", type: "形容词", chinese: "漂亮" },
  { korean: "재미있다", pronunciation: "재미읻따", type: "形容词", chinese: "有趣" },
  { korean: "맵다", pronunciation: "맵따", type: "形容词", chinese: "辣" },
  { korean: "달다", pronunciation: "달다", type: "形容词", chinese: "甜" },
  { korean: "차갑다", pronunciation: "차갑따", type: "形容词", chinese: "凉／冰" },
  { korean: "따뜻하다", pronunciation: "따뜨타다", type: "形容词", chinese: "温暖" },
  { korean: "무겁다", pronunciation: "무겁따", type: "形容词", chinese: "重" },
];

const priceWords: VocabularyItem[] = [
  { korean: "백", pronunciation: "백", type: "汉字词数字", chinese: "百" },
  { korean: "천", pronunciation: "천", type: "汉字词数字", chinese: "千" },
  { korean: "만", pronunciation: "만", type: "汉字词数字", chinese: "万" },
  { korean: "원", pronunciation: "원", type: "货币单位", chinese: "韩元" },
  { korean: "오백 원", pronunciation: "오배권", type: "价格", chinese: "500韩元" },
  { korean: "천 원", pronunciation: "처눤", type: "价格", chinese: "1,000韩元" },
  { korean: "삼천 원", pronunciation: "삼처눤", type: "价格", chinese: "3,000韩元" },
  { korean: "오천 원", pronunciation: "오처눤", type: "价格", chinese: "5,000韩元" },
  { korean: "만 원", pronunciation: "마눤", type: "价格", chinese: "10,000韩元" },
  { korean: "얼마", pronunciation: "얼마", type: "疑问词", chinese: "多少／多少钱" },
  { korean: "가격", pronunciation: "가격", type: "名词", chinese: "价格" },
  { korean: "돈", pronunciation: "돈", type: "名词", chinese: "钱" },
  { korean: "카드", pronunciation: "카드", type: "名词", chinese: "卡" },
  { korean: "현금", pronunciation: "현금", type: "名词", chinese: "现金" },
  { korean: "영수증", pronunciation: "영수증", type: "名词", chinese: "小票" },
];

const counterWords: VocabularyItem[] = [
  { korean: "하나 → 한", pronunciation: "하나 한", type: "固有词数字", chinese: "1／一（量词前）" },
  { korean: "둘 → 두", pronunciation: "둘 두", type: "固有词数字", chinese: "2／二（量词前）" },
  { korean: "셋 → 세", pronunciation: "셋 세", type: "固有词数字", chinese: "3／三（量词前）" },
  { korean: "넷 → 네", pronunciation: "넷 네", type: "固有词数字", chinese: "4／四（量词前）" },
  { korean: "다섯", pronunciation: "다섯", type: "固有词数字", chinese: "5" },
  { korean: "여섯", pronunciation: "여섣", type: "固有词数字", chinese: "6" },
  { korean: "일곱", pronunciation: "일곱", type: "固有词数字", chinese: "7" },
  { korean: "여덟", pronunciation: "여덜", type: "固有词数字", chinese: "8" },
  { korean: "아홉", pronunciation: "아홉", type: "固有词数字", chinese: "9" },
  { korean: "열", pronunciation: "열", type: "固有词数字", chinese: "10" },
  { korean: "스물 → 스무", pronunciation: "스물 스무", type: "固有词数字", chinese: "20（量词前）" },
  { korean: "개", pronunciation: "개", type: "量词", chinese: "个" },
  { korean: "병", pronunciation: "병", type: "量词", chinese: "瓶" },
  { korean: "잔", pronunciation: "잔", type: "量词", chinese: "杯" },
  { korean: "그릇", pronunciation: "그륻", type: "量词", chinese: "碗" },
];

export function KoreanLevelOneLessonSixBook({
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
    <Page key="06-01" number="01">
      <KoreanEbookTableOfContents
        lessonNumber={6}
        pageMeta={LESSON_SIX_TEMPLATE.pageMeta}
        onNavigate={(page) => flipBookRef.current?.pageFlip()?.flip(page)}
        entries={[
          { step: "01", title: "课前导航", pageRange: "02—03", detail: "建立购物流程" },
          { step: "02", title: "核心词汇表", pageRange: "04—08", detail: "商品·状态·数字" },
          { step: "03", title: "语法讲解", pageRange: "09—13", detail: "请求·量词·描述·包含" },
          { step: "04", title: "句型操练", pageRange: "14—17", detail: "数量与价格转换" },
          { step: "05", title: "实战对话", pageRange: "18—21", detail: "三组八句交易" },
          { step: "06", title: "听说任务", pageRange: "22—25", detail: "听价格·完成购买" },
          { step: "07", title: "读写拓展", pageRange: "26—28", detail: "读广告·写商品卡" },
          { step: "08", title: "自测与复盘", pageRange: "29—34", detail: "双数字系统验收" },
        ]}
      />
    </Page>,
    <Page key="06-02" number="02">
      <KoreanEbookSectionDivider
        step="STEP 01"
        title="课前导航"
        goal="完成“看商品—问价格—说数量—描述特点—礼貌购买”的完整交易。"
        icon={<Compass size={24} />}
      />
    </Page>,
    <Page key="06-03" number="03">
      <div className="flex h-full flex-col">
        <Heading title="一笔交易需要哪些韩语？" description="价格与数量使用不同数字系统，先看任务，再学习语言工具。" icon={<ShoppingBag size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.chinese03)} onClick={() => toggle("chinese03")} />} />
        <div className="mt-5 grid grid-cols-2 gap-3">
          {[
            ["ASK", "이거 얼마예요?", "这个多少钱？"],
            ["PRICE", "한 개에 천 원이에요.", "一个一千韩元。"],
            ["DESCRIBE", "사과가 싸고 맛있어요.", "苹果便宜又好吃。"],
            ["BUY", "사과 세 개 주세요.", "请给我三个苹果。"],
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
          <p className="text-xs font-black text-[#a26024]">双数字系统</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-center">
            <p className="rounded-xl bg-white p-3 text-sm font-black">세 개<span className="mt-1 block text-[10px] text-[#81938a]">数量：固有词数字</span></p>
            <p className="rounded-xl bg-white p-3 text-sm font-black">삼천 원<span className="mt-1 block text-[10px] text-[#81938a]">金额：汉字词数字</span></p>
          </div>
        </section>
        <p className="mt-auto rounded-xl bg-[#f7faf8] p-3 text-[11px] font-bold text-[#60736a]">
          本课目标：能在不看提示的情况下完成至少 8 句购物对话。
        </p>
      </div>
    </Page>,
    <Page key="06-04" number="04">
      <KoreanEbookSectionDivider step="STEP 02" title="核心词汇表" goal="按照商品、状态、价格和数量分类建立购物词汇网络。" icon={<Package size={24} />} />
    </Page>,
    <Page key="06-05" number="05">
      <div className="flex h-full flex-col">
        <Heading title="1. 常见商品" description="点击卡片听读音，再用“商品 + 주세요”完成最短购买表达。" icon={<ShoppingBag size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.chinese05)} onClick={() => toggle("chinese05")} />} />
        <VocabularyGrid items={productWords} speak={speak} showChinese={Boolean(revealed.chinese05)} />
        <p className="mt-auto rounded-xl bg-[#eef5fb] p-3 text-[11px] font-bold text-[#3d6f9f]">商品词块：사과를 사요／우유를 마셔요／구두가 비싸요。</p>
      </div>
    </Page>,
    <Page key="06-06" number="06">
      <div className="flex h-full flex-col">
        <Heading title="2. 商品状态与评价" description="形容词可直接以 -아/어요 结句，用来评价价格、大小、味道和外观。" icon={<Scale size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.chinese06)} onClick={() => toggle("chinese06")} />} />
        <VocabularyGrid items={adjectiveWords} speak={speak} showChinese={Boolean(revealed.chinese06)} />
        <p className="mt-auto rounded-xl bg-[#fff4f6] p-3 text-[11px] font-bold text-[#a65b68]">成对记忆：싸요 ↔ 비싸요／커요 ↔ 작아요／맛있어요 ↔ 맛없어요。</p>
      </div>
    </Page>,
    <Page key="06-07" number="07">
      <div className="flex h-full flex-col">
        <Heading title="3. 金额与支付" description="韩元金额使用汉字词数字，先按万、千、百拆分，再从大到小读。" icon={<BadgeDollarSign size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.chinese07)} onClick={() => toggle("chinese07")} />} />
        <VocabularyGrid items={priceWords} speak={speak} showChinese={Boolean(revealed.chinese07)} />
        <p className="mt-auto rounded-xl bg-[#eef8f4] p-3 text-[11px] font-bold text-[#347b69]">12,500원 = 만 이천오백 원；数字中为 0 的位不读。</p>
      </div>
    </Page>,
    <Page key="06-08" number="08">
      <div className="flex h-full flex-col">
        <Heading title="4. 固有词数字与量词" description="数商品时使用固有词数字；1、2、3、4、20 在量词前会缩写。" icon={<Package size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.chinese08)} onClick={() => toggle("chinese08")} />} />
        <VocabularyGrid items={counterWords} speak={speak} showChinese={Boolean(revealed.chinese08)} />
        <div className="mt-auto grid grid-cols-5 gap-1.5 text-center text-[9px] font-black text-[#b46624]">
          {["한 개", "두 병", "세 잔", "네 그릇", "스무 살"].map((item) => <span key={item} className="rounded-lg bg-[#fff0df] p-2">{item}</span>)}
        </div>
      </div>
    </Page>,
    <Page key="06-09" number="09">
      <KoreanEbookSectionDivider step="STEP 03" title="语法讲解" goal="四个语法各占一页：礼貌请求、数量表达、特征描述和“也”的包含关系。" icon={<NotebookPen size={24} />} />
    </Page>,
    <Page key="06-10" number="10">
      <div className="flex h-full flex-col">
        <Heading title="1. V-(으)세요" description="礼貌地请求或指示对方做某事，购物和服务场景中非常常用。" icon={<NotebookPen size={22} />} />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <NoteBox label="无收音／ㄹ收音 → -세요" tone="blue">
            <RuleSentence text="사다. 사세요." speak={speak}>사다 → 사세요（请买）</RuleSentence>
            <RuleSentence text="주다. 주세요." speak={speak}>주다 → 주세요（请给）</RuleSentence>
            <RuleSentence text="만들다. 만드세요." speak={speak}>만들다 → 만드세요（请做）</RuleSentence>
          </NoteBox>
          <NoteBox label="有收音 → -으세요" tone="green">
            <RuleSentence text="앉다. 앉으세요." speak={speak}>앉다 → 앉으세요（请坐）</RuleSentence>
            <RuleSentence text="읽다. 읽으세요." speak={speak}>읽다 → 읽으세요（请读）</RuleSentence>
            <RuleSentence text="먹다. 먹으세요." speak={speak}>먹다 → 먹으세요（请吃）</RuleSentence>
          </NoteBox>
        </div>
        <section className="mt-3 rounded-2xl bg-[#f7f2fc] p-5 text-center">
          <p className="text-[11px] font-black text-[#75559a]">购物核心结构</p>
          <p className="mt-3 text-lg font-black">商品 + 数量 + 주세요</p>
          <p className="mt-3 text-sm font-black">우유 두 병 주세요.</p>
        </section>
        <NoteBox label="좀 让请求更柔和" tone="amber">
          사과 좀 주세요 中的 좀 原意是“一点”，在请求中常起缓和语气的作用。
          商品和数量明确时也可以省略。
        </NoteBox>
        <p className="mt-auto text-[11px] font-bold text-[#71857b]">주세요 已经是 주다 的请求形式，不要再说 주으세요。</p>
      </div>
    </Page>,
    <Page key="06-11" number="11">
      <div className="flex h-full flex-col">
        <Heading title="2. 固有词数字 + 量词" description="数量放在商品后面：商品 + 固有词数字 + 个／瓶／杯／碗。" icon={<Package size={22} />} />
        <section className="mt-4 rounded-2xl bg-[#f1f6fb] p-5 text-center">
          <p className="text-[11px] font-black text-[#3d6f9f]">数量结构</p>
          <p className="mt-3 text-lg font-black">商品 + 한／두／세／네 + 量词</p>
          <div className="mx-auto mt-3 max-w-md space-y-1 text-sm font-black">
            <RuleSentence text="주스 두 병" speak={speak}>주스 두 병</RuleSentence>
            <RuleSentence text="커피 세 잔" speak={speak}>커피 세 잔</RuleSentence>
            <RuleSentence text="비빔밥 네 그릇" speak={speak}>비빔밥 네 그릇</RuleSentence>
          </div>
        </section>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <NoteBox label="量词选择" tone="green">
            개：普通物品<br />병：瓶装饮料<br />잔：杯装饮料<br />그릇：碗装食物
          </NoteBox>
          <NoteBox label="五个缩写" tone="rose">
            <RuleSentence text="하나. 한." speak={speak}>하나 → 한</RuleSentence>
            <RuleSentence text="둘. 두." speak={speak}>둘 → 두</RuleSentence>
            <RuleSentence text="셋. 세." speak={speak}>셋 → 세</RuleSentence>
            <RuleSentence text="넷. 네." speak={speak}>넷 → 네</RuleSentence>
            <RuleSentence text="스물. 스무." speak={speak}>스물 → 스무</RuleSentence>
          </NoteBox>
        </div>
        <NoteBox label="数字系统不要混用" tone="purple">
          三个苹果说 사과 <b>세 개</b>，不用 삼 개；三千韩元说 <b>삼천 원</b>，不用 세천 원。
        </NoteBox>
        <p className="mt-auto text-[11px] font-bold text-[#71857b]">商品有 을/를 时可说 사과를 세 개 주세요；口语购物中也常省略助词。</p>
      </div>
    </Page>,
    <Page key="06-12" number="12">
      <div className="flex h-full flex-col">
        <Heading title="3. N이／가 + A-아／어요" description="用形容词描述商品特征；商品是被描述的主语，所以使用 이／가。" icon={<Scale size={22} />} />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <NoteBox label="有收音 + 이" tone="blue">
            <RuleSentence text="가방이 비싸요." speak={speak}>가방<b>이</b> 비싸요.</RuleSentence>
            <span className="block text-[10px] text-[#71857b]">包很贵。</span>
            <RuleSentence text="옷이 커요." speak={speak}>옷<b>이</b> 커요.</RuleSentence>
            <span className="block text-[10px] text-[#71857b]">衣服很大。</span>
          </NoteBox>
          <NoteBox label="无收音 + 가" tone="green">
            <RuleSentence text="사과가 맛있어요." speak={speak}>사과<b>가</b> 맛있어요.</RuleSentence>
            <span className="block text-[10px] text-[#71857b]">苹果很好吃。</span>
            <RuleSentence text="구두가 예뻐요." speak={speak}>구두<b>가</b> 예뻐요.</RuleSentence>
            <span className="block text-[10px] text-[#71857b]">皮鞋很漂亮。</span>
          </NoteBox>
        </div>
        <section className="mt-3 rounded-2xl bg-[#fff8ed] p-4">
          <p className="text-xs font-black text-[#9b6b32]">绝不能用 을／를 的原因</p>
          <p className="mt-2 text-xs leading-6">
            비싸요、맛있어요 是对商品状态的描述，不是施加到商品上的动作。
            因此商品是主语：가방<b>이</b> 비싸요，而不是 가방을 비싸요。
          </p>
        </section>
        <NoteBox label="形容词变形提醒" tone="purple">
          싸다 → 싸요／크다 → 커요／작다 → 작아요／예쁘다 → 예뻐요。
          本课重点是句子角色，变形仍沿用第三课 -아／어요 规则。
        </NoteBox>
        <section className="mt-3 grid grid-cols-2 gap-3 text-xs font-black">
          <button type="button" onClick={() => speak("우유가 차가워요.")} className="rounded-xl bg-[#f1f6fb] p-3 text-left">우유가 차가워요.<span className="mt-1 block text-[10px] font-bold text-[#71857b]">牛奶很凉。</span></button>
          <button type="button" onClick={() => speak("이 가방이 무거워요.")} className="rounded-xl bg-[#f2f8f3] p-3 text-left">이 가방이 무거워요.<span className="mt-1 block text-[10px] font-bold text-[#71857b]">这个包很重。</span></button>
        </section>
      </div>
    </Page>,
    <Page key="06-13" number="13">
      <div className="flex h-full flex-col">
        <Heading title="4. N도" description="表示“也、还”，直接替换原来位置上的 이／가 或 을／를。" icon={<Sparkles size={22} />} />
        <section className="mt-4 rounded-2xl bg-[#f7f2fc] p-5 text-center">
          <p className="text-[11px] font-black text-[#75559a]">包含结构</p>
          <p className="mt-3 text-lg font-black">已知项目 + 新增项目도 + 谓语</p>
          <p className="mt-3 text-sm font-black">빵을 샀어요. 우유도 샀어요.</p>
        </section>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <NoteBox label="替换 을／를" tone="blue">
            <RuleSentence text="사과를 샀어요." speak={speak}>사과를 샀어요.</RuleSentence>
            <RuleSentence text="오렌지도 샀어요." speak={speak}>오렌지<b>도</b> 샀어요.</RuleSentence>
            买了苹果，也买了橙子。
          </NoteBox>
          <NoteBox label="替换 이／가" tone="green">
            <RuleSentence text="사과가 싸요." speak={speak}>사과가 싸요.</RuleSentence>
            <RuleSentence text="오렌지도 싸요." speak={speak}>오렌지<b>도</b> 싸요.</RuleSentence>
            苹果便宜，橙子也便宜。
          </NoteBox>
        </div>
        <NoteBox label="不要叠加助词" tone="rose">
          本课语境中说 우유도，不说 우유를도；说 가방도，不说 가방이도。
          도 自己接管了原助词的位置。
        </NoteBox>
        <p className="mt-auto text-[11px] font-bold text-[#71857b]">使用 도 前，语境里应该已经有一个同类项目，否则“也”没有参照对象。</p>
      </div>
    </Page>,
    <Page key="06-14" number="14">
      <KoreanEbookSectionDivider step="STEP 04" title="句型操练" goal="在数字系统、量词变形、助词选择和单价表达之间建立快速反应。" icon={<PencilLine size={24} />} />
    </Page>,
    <Page key="06-15" number="15">
      <div className="flex h-full flex-col">
        <Heading title="1. 数量还是金额？" description="看到单位后先选择数字系统，再完成韩语表达。" icon={<BadgeDollarSign size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.numbers)} onClick={() => toggle("numbers")} answer />} />
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            ["3个苹果", "사과 세 개", "固有词数字"],
            ["3,000韩元", "삼천 원", "汉字词数字"],
            ["2瓶牛奶", "우유 두 병", "固有词数字"],
            ["12,000韩元", "만 이천 원", "汉字词数字"],
            ["4杯咖啡", "커피 네 잔", "固有词数字"],
            ["20个橙子", "오렌지 스무 개", "固有词数字"],
          ].map(([prompt, answer, system], index) => (
            <article key={`${prompt}-${index}`} className="rounded-2xl border border-[#ead8be] bg-white p-4">
              <p className="text-[10px] font-black text-[#b46624]">{system}</p>
              <p className="mt-2 text-xs font-black">{prompt}</p>
              <p className={`mt-3 rounded-lg bg-[#fff8ed] p-2 text-[11px] font-black text-[#8b642f] ${revealed.numbers ? "opacity-100" : "opacity-0"}`}>{answer}</p>
            </article>
          ))}
        </div>
        <p className="mt-auto rounded-xl bg-[#fff2df] p-3 text-[11px] font-bold text-[#8b642f]">先找单位：看到 원 用汉字词；看到 개／병／잔／그릇 用固有词。</p>
      </div>
    </Page>,
    <Page key="06-16" number="16">
      <div className="flex h-full flex-col">
        <Heading title="2. 购物句修理站" description="找出每句唯一的结构错误，再展开正确答案。" icon={<ClipboardCheck size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.repair)} onClick={() => toggle("repair")} answer />} />
        <div className="mt-4 space-y-2.5">
          {[
            ["사과 삼 개 주세요.", "사과 세 개 주세요.", "数量要用固有词"],
            ["우유 한 개 주세요.", "우유 한 병 주세요.", "瓶装饮料用 병"],
            ["가방을 비싸요.", "가방이 비싸요.", "形容词主语用 이"],
            ["사과를도 샀어요.", "사과도 샀어요.", "도 替换 을/를"],
            ["앉세요.", "앉으세요.", "有收音加 으세요"],
            ["한 개 천 원이에요.", "한 개에 천 원이에요.", "单价标准要加 에"],
          ].map(([wrong, correct, reason], index) => (
            <div key={`${wrong}-${index}`} className="grid grid-cols-[28px_1fr_1fr] items-center gap-3 rounded-xl border border-[#ead8be] bg-white p-3">
              <span className="text-xs font-black text-[#b46624]">{index + 1}</span>
              <p className="text-xs font-black text-[#a65b68] line-through">{wrong}</p>
              <p className={`text-[11px] font-bold text-[#347b69] ${revealed.repair ? "opacity-100" : "opacity-0"}`}>{correct}<span className="ml-2 text-[#81938a]">· {reason}</span></p>
            </div>
          ))}
        </div>
        <p className="mt-auto text-[11px] font-bold text-[#71857b]">修理句子时按顺序检查：数字系统 → 量词 → 助词 → 词尾。</p>
      </div>
    </Page>,
    <Page key="06-17" number="17">
      <div className="flex h-full flex-col">
        <Heading title="3. 单价计算实验" description="数量后的 에 表示“每……”，不是地点或时间。" icon={<BadgeDollarSign size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.calculation)} onClick={() => toggle("calculation")} answer />} />
        <section className="mt-4 rounded-2xl bg-[#fff8ed] p-5 text-center">
          <p className="text-[11px] font-black text-[#9b6b32]">单价结构</p>
          <p className="mt-3 text-lg font-black">数量单位 + 에 + 价格 + 이에요／예요</p>
          <p className="mt-3 text-sm font-black">한 개에 천 원이에요.</p>
        </section>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {[
            ["사과", "한 개에 오백 원", "3个 = 1,500원"],
            ["우유", "한 병에 이천 원", "2瓶 = 4,000원"],
            ["커피", "한 잔에 삼천 원", "3杯 = 9,000원"],
            ["비빔밥", "한 그릇에 팔천 원", "2碗 = 16,000원"],
          ].map(([product, unitPrice, total]) => (
            <article key={product} className="rounded-xl border border-[#ead8be] bg-white p-4">
              <p className="text-xs font-black text-[#b46624]">{product}</p>
              <p className="mt-2 text-sm font-black">{unitPrice}</p>
              <p className={`mt-1 text-[10px] font-bold text-[#71857b] ${revealed.calculation ? "opacity-100" : "opacity-0"}`}>{total}</p>
            </article>
          ))}
        </div>
        <NoteBox label="同一个 에 的新功能" tone="amber">
          학교에（去学校／在学校）、금요일에（星期五）、한 개에（每一个）。
          要根据前面的名词和整句场景判断，不要只背一个中文译法。
        </NoteBox>
      </div>
    </Page>,
    <Page key="06-18" number="18">
      <KoreanEbookSectionDivider step="STEP 05" title="实战对话" goal="在水果店、咖啡店和服装店完成三组不少于八句的真实交易。" icon={<MessageCircle size={24} />} />
    </Page>,
    <Page key="06-19" number="19">
      <div className="flex h-full flex-col">
        <Heading title="场景 1 · 水果店" description="目标：询问单价、评价商品、决定数量并追加购买。" icon={<Apple size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.chinese19)} onClick={() => toggle("chinese19")} />} />
        <Dialogue speak={speak} showChinese={Boolean(revealed.chinese19)} lines={[
          { speaker: "客", korean: "안녕하세요. 사과가 얼마예요?", chinese: "您好，苹果多少钱？" },
          { speaker: "店", korean: "한 개에 천 원이에요.", chinese: "一个一千韩元。" },
          { speaker: "客", korean: "사과가 맛있어요?", chinese: "苹果好吃吗？" },
          { speaker: "店", korean: "네, 아주 달고 맛있어요.", chinese: "是的，很甜、很好吃。" },
          { speaker: "客", korean: "그럼 사과 세 개 주세요.", chinese: "那么请给我三个苹果。" },
          { speaker: "店", korean: "네. 오렌지도 필요하세요?", chinese: "好的。也需要橙子吗？" },
          { speaker: "客", korean: "네, 오렌지 두 개도 주세요.", chinese: "需要，也请给我两个橙子。" },
          { speaker: "店", korean: "모두 오천 원이에요.", chinese: "一共五千韩元。" },
        ]} />
        <p className="mt-auto rounded-xl bg-[#fff4f6] p-3 text-[11px] font-bold text-[#8d5b64]">八句任务：把商品、单价和数量全部替换，保持交易逻辑不变。</p>
      </div>
    </Page>,
    <Page key="06-20" number="20">
      <div className="flex h-full flex-col">
        <Heading title="场景 2 · 咖啡店" description="目标：使用 병／잔／그릇 区分容器，并礼貌追加订单。" icon={<Coffee size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.chinese20)} onClick={() => toggle("chinese20")} />} />
        <Dialogue speak={speak} showChinese={Boolean(revealed.chinese20)} lines={[
          { speaker: "客", korean: "따뜻한 커피 있어요?", chinese: "有热咖啡吗？" },
          { speaker: "店", korean: "네, 있어요.", chinese: "有。" },
          { speaker: "客", korean: "커피 한 잔에 얼마예요?", chinese: "一杯咖啡多少钱？" },
          { speaker: "店", korean: "한 잔에 삼천 원이에요.", chinese: "一杯三千韩元。" },
          { speaker: "客", korean: "커피 두 잔 주세요.", chinese: "请给我两杯咖啡。" },
          { speaker: "店", korean: "다른 음료도 드릴까요?", chinese: "还需要其他饮料吗？" },
          { speaker: "客", korean: "물 한 병도 주세요.", chinese: "也请给我一瓶水。" },
          { speaker: "店", korean: "네, 모두 칠천 원이에요.", chinese: "好的，一共七千韩元。" },
        ]} />
        <p className="mt-auto rounded-xl bg-[#fff4f6] p-3 text-[11px] font-bold text-[#8d5b64]">注意：커피는 잔，물은 병；容器改变，量词也要跟着改变。</p>
      </div>
    </Page>,
    <Page key="06-21" number="21">
      <div className="flex h-full flex-col">
        <Heading title="场景 3 · 服装店" description="目标：询问价格、描述大小和贵贱，并决定是否购买。" icon={<Store size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.chinese21)} onClick={() => toggle("chinese21")} />} />
        <Dialogue speak={speak} showChinese={Boolean(revealed.chinese21)} lines={[
          { speaker: "客", korean: "이 티셔츠 얼마예요?", chinese: "这件T恤多少钱？" },
          { speaker: "店", korean: "이만 원이에요.", chinese: "两万韩元。" },
          { speaker: "客", korean: "조금 비싸요.", chinese: "有点贵。" },
          { speaker: "店", korean: "하지만 옷이 아주 좋아요.", chinese: "但是衣服质量很好。" },
          { speaker: "客", korean: "큰 티셔츠도 있어요?", chinese: "也有大号T恤吗？" },
          { speaker: "店", korean: "네, 큰 티셔츠도 있어요.", chinese: "有，也有大号。" },
          { speaker: "客", korean: "그럼 이 티셔츠를 주세요.", chinese: "那么请给我这件T恤。" },
          { speaker: "店", korean: "네, 카드로 계산하세요.", chinese: "好的，请刷卡结账。" },
        ]} />
        <p className="mt-auto rounded-xl bg-[#fff4f6] p-3 text-[11px] font-bold text-[#8d5b64]">角色交换：顾客必须评价两项特征，店员必须用 도 补充另一件商品。</p>
      </div>
    </Page>,
    <Page key="06-22" number="22">
      <KoreanEbookSectionDivider step="STEP 06" title="听说任务" goal="听辨金额、数量与量词，再在时间限制内完成一笔完整购买。" icon={<Headphones size={24} />} />
    </Page>,
    <Page key="06-23" number="23">
      <div className="flex h-full flex-col">
        <Heading title="1. 金额听辨" description="先判断万、千、百的层级，再写阿拉伯数字。" icon={<Headphones size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.prices)} onClick={() => toggle("prices")} answer />} />
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            ["오백 원", "500원"], ["삼천 원", "3,000원"], ["칠천오백 원", "7,500원"],
            ["만 원", "10,000원"], ["만 이천 원", "12,000원"], ["이만 오천 원", "25,000원"],
          ].map(([price, number], index) => (
            <button key={`${price}-${index}`} type="button" onClick={() => speak(price)} className="rounded-2xl border border-[#cfdfeb] bg-white p-4 text-left">
              <p className="text-[10px] font-black text-[#3e7fa3]">PRICE AUDIO {index + 1}</p>
              <p className={`mt-3 text-sm font-black ${revealed.prices ? "opacity-100" : "opacity-0"}`}>{price}</p>
              <p className={`mt-1 text-[11px] font-bold text-[#71857b] ${revealed.prices ? "opacity-100" : "opacity-0"}`}>{number}</p>
            </button>
          ))}
        </div>
        <section className="mt-4 rounded-2xl bg-[#eef5fb] p-4">
          <p className="text-[11px] font-black text-[#3e7fa3]">金额拆分法</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-black">
            <span className="rounded-xl bg-white p-3">만<br/><small>10,000</small></span>
            <span className="rounded-xl bg-white p-3">이천<br/><small>2,000</small></span>
            <span className="rounded-xl bg-white p-3">오백<br/><small>500</small></span>
          </div>
          <p className="mt-3 text-center text-xs font-bold">만 이천오백 원 = 12,500원</p>
        </section>
        <p className="mt-3 text-[11px] font-bold text-[#71857b]">先写位值，再相加；没有出现的十位或百位直接记作 0。</p>
      </div>
    </Page>,
    <Page key="06-24" number="24">
      <div className="flex h-full flex-col">
        <Heading title="2. 听数量，选商品" description="听到数字与量词后，判断顾客买了什么、多少。" icon={<Headphones size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.orders)} onClick={() => toggle("orders")} answer />} />
        <div className="mt-4 space-y-3">
          {[
            ["사과 세 개하고 우유 한 병 주세요.", "苹果3个＋牛奶1瓶"],
            ["커피 두 잔하고 빵 네 개 주세요.", "咖啡2杯＋面包4个"],
            ["물 다섯 병하고 주스 두 병 주세요.", "水5瓶＋果汁2瓶"],
            ["비빔밥 세 그릇하고 콜라 세 병 주세요.", "拌饭3碗＋可乐3瓶"],
          ].map(([sentence, order], index) => (
            <button key={`${sentence}-${index}`} type="button" onClick={() => speak(sentence)} className="w-full rounded-2xl border border-[#cfdfeb] bg-white p-4 text-left">
              <div className="flex items-center justify-between"><p className="text-xs font-black">ORDER {index + 1}</p><Volume2 size={15} className="text-[#3e7fa3]" /></div>
              <p className={`mt-2 text-[11px] font-bold text-[#71857b] ${revealed.orders ? "opacity-100" : "opacity-0"}`}>{order}</p>
            </button>
          ))}
        </div>
        <NoteBox label="听力顺序" tone="blue">
          先抓商品，再抓数字，最后用量词确认单位。如果只听数字而忽略 병／잔，很容易买错。
        </NoteBox>
      </div>
    </Page>,
    <Page key="06-25" number="25">
      <div className="flex h-full flex-col">
        <Heading title="3. 60秒购物挑战" description="顾客和店员各完成至少四句，整段对话不得少于八句。" icon={<Mic2 size={22} />} />
        <div className="mt-5 grid grid-cols-2 gap-4">
          <section className="rounded-2xl border border-[#cfdfeb] bg-white p-5">
            <p className="text-xs font-black text-[#3e7fa3]">顾客必须说</p>
            <div className="mt-4 space-y-3 text-xs leading-6">
              <p>① ______ 얼마예요?</p>
              <p>② ______이／가 ______아요／어요.</p>
              <p>③ ______ 두／세 ______ 주세요.</p>
              <p>④ ______도 주세요.</p>
            </div>
          </section>
          <section className="rounded-2xl bg-[#eaf4fa] p-5">
            <p className="text-xs font-black text-[#3e7fa3]">店员必须说</p>
            <div className="mt-4 space-y-3 text-xs leading-6">
              <p>① 한 ______에 ______ 원이에요.</p>
              <p>② 네, ______이／가 좋아요.</p>
              <p>③ 다른 ______도 필요하세요?</p>
              <p>④ 모두 ______ 원이에요.</p>
            </div>
          </section>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 text-[11px]">
          {["两套数字没有混用", "量词符合商品容器", "请求使用 주세요", "至少一次使用 도"].map((item) => (
            <label key={item} className="flex items-center gap-2 rounded-xl bg-[#f7faf8] p-3"><input type="checkbox" className="accent-[#3e7fa3]" />{item}</label>
          ))}
        </div>
        <p className="mt-auto text-center text-[11px] font-bold text-[#71857b]">先完成交易，再追求速度；说错数字会直接改变现实结果。</p>
      </div>
    </Page>,
    <Page key="06-26" number="26">
      <KoreanEbookSectionDivider step="STEP 07" title="读写拓展" goal="读取促销广告中的数量、单价和商品特点，再独立制作一张韩语商品卡。" icon={<ShoppingBag size={24} />} />
    </Page>,
    <Page key="06-27" number="27">
      <div className="flex h-full flex-col">
        <Heading title="1. 阅读 · 오늘의 과일 가게" description="圈出价格，给量词画线，判断哪件商品更便宜。" icon={<ShoppingBag size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.reading)} onClick={() => toggle("reading")} answer />} />
        <section className="mt-5 rounded-2xl bg-[#eef8f4] p-5">
          <p className="text-sm font-black leading-8">
            오늘 사과가 아주 싸요. 사과는 한 개에 오백 원이에요.
            오렌지는 한 개에 천 원이에요. 딸기도 맛있어요.
            딸기는 한 상자에 오천 원이에요. 사과 세 개를 사면 오렌지 한 개도 드려요.
          </p>
        </section>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          {[
            ["사과", "500원／개", "便宜"],
            ["오렌지", "1,000원／개", "较贵"],
            ["딸기", "5,000원／盒", "促销商品"],
          ].map(([product, price, note]) => (
            <div key={product} className={`rounded-xl border border-[#cfe3d9] bg-white p-3 ${revealed.reading ? "opacity-100" : "opacity-0"}`}>
              <p className="text-xs font-black text-[#347b69]">{product}</p>
              <p className="mt-1 text-sm font-black">{price}</p>
              <p className="mt-1 text-[10px] text-[#71857b]">{note}</p>
            </div>
          ))}
        </div>
        <NoteBox label="阅读问题" tone="green">
          1. 사과 한 개에 얼마예요?<br />
          2. 무엇이 더 비싸요?<br />
          3. 사과 세 개를 사면 무엇도 줘요?
        </NoteBox>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-[#e7f5f1] px-4 py-3 text-xs font-bold text-[#347b69]">
          <span>阅读顺序：圈单价 에 → 标数量 → 找 도 后面的赠品。</span>
          <KoreanEbookSpeakButton text="사과 세 개를 사면 오렌지 한 개도 드려요." onSpeak={speak} compact />
        </div>
      </div>
    </Page>,
    <Page key="06-28" number="28">
      <div className="flex h-full flex-col">
        <Heading title="2. 写作 · 我的商品广告" description="选择一种商品，用价格、特点和赠品信息制作一张可交易的广告。" icon={<PencilLine size={22} />} />
        <div className="mt-5 grid grid-cols-[1fr_1.4fr] gap-4">
          <section className="rounded-2xl bg-[#e7f5f1] p-5">
            <p className="text-xs font-black text-[#347b69]">广告必须包含</p>
            <ol className="mt-3 list-decimal space-y-2 pl-4 text-xs leading-6">
              <li>商品名称</li>
              <li>数量单位 + 에 单价</li>
              <li>两个形容词评价</li>
              <li>一个 도 追加信息</li>
              <li>주세요 请求句</li>
            </ol>
          </section>
          <section className="rounded-2xl border border-[#cfe3d9] bg-white p-5">
            <p className="text-xs font-black">广告模板</p>
            <div className="mt-3 space-y-2 text-xs leading-6">
              <p>오늘 ______이／가 싸요!</p>
              <p>한 ______에 ______ 원이에요.</p>
              <p>______고 ______아요／어요.</p>
              <p>______도 드려요.</p>
              <p>지금 주문하세요!</p>
            </div>
          </section>
        </div>
        <NoteBox label="创新要求：价格必须可计算" tone="green">
          给出单价后，再设计一个购买数量，让同伴计算总价。广告不是装饰，而是一道真实交易任务。
        </NoteBox>
        <p className="mt-auto rounded-xl bg-[#f7faf8] p-3 text-[11px] font-bold">写完后检查：金额是否用汉字词，数量是否用固有词。</p>
      </div>
    </Page>,
    <Page key="06-29" number="29">
      <KoreanEbookSectionDivider step="STEP 08" title="自测与复盘" goal="先完成数字和量词测试，再完成语法检测、价格计算和八句口语验收。" icon={<CheckCircle2 size={24} />} />
    </Page>,
    <Page key="06-30" number="30">
      <div className="flex h-full flex-col">
        <Heading title="1. 数字系统快反" description="看到提示后两秒内说出韩语，展开核对。" icon={<BadgeDollarSign size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.quick)} onClick={() => toggle("quick")} answer />} />
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {[
            ["1个", "한 개"], ["2瓶", "두 병"], ["3杯", "세 잔"], ["4碗", "네 그릇"],
            ["20个", "스무 개"], ["500원", "오백 원"], ["1,000원", "천 원"], ["3,000원", "삼천 원"],
            ["10,000원", "만 원"], ["12,000원", "만 이천 원"], ["25,000원", "이만 오천 원"], ["3个3,000원", "세 개／삼천 원"],
          ].map(([prompt, answer], index) => (
            <article key={`${prompt}-${index}`} className="rounded-xl border border-[#cfe3d4] bg-white p-3 text-center">
              <p className="text-[10px] font-black text-[#487a54]">{String(index + 1).padStart(2, "0")}</p>
              <p className="mt-1 text-sm font-black">{prompt}</p>
              <p className={`mt-2 rounded-lg bg-[#e8f4eb] p-2 text-[10px] font-black text-[#487a54] ${revealed.quick ? "opacity-100" : "opacity-0"}`}>{answer}</p>
            </article>
          ))}
        </div>
        <p className="mt-auto text-center text-[11px] text-[#83948b]">10题以上在两秒内完成，再进入语法检测。</p>
      </div>
    </Page>,
    <Page key="06-31" number="31">
      <div className="flex h-full flex-col">
        <Heading title="2. 十题语法检测" description="检查请求、量词、形容词主语、도 和单价 에。" icon={<ClipboardCheck size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.test)} onClick={() => toggle("test")} answer />} />
        <div className="mt-4 grid grid-cols-2 gap-2">
          {[
            ["请坐。", "앉으세요."], ["请给我三个苹果。", "사과 세 개 주세요."],
            ["一瓶牛奶", "우유 한 병"], ["四杯咖啡", "커피 네 잔"],
            ["包很贵。", "가방이 비싸요."], ["苹果好吃。", "사과가 맛있어요."],
            ["也买了牛奶。", "우유도 샀어요."], ["橙子也便宜。", "오렌지도 싸요."],
            ["一个一千韩元。", "한 개에 천 원이에요."], ["两个3,000韩元。", "두 개에 삼천 원이에요."],
          ].map(([question, answer], index) => (
            <article key={`${question}-${index}`} className="rounded-xl border border-[#cfe3d4] bg-white p-2.5">
              <p className="text-[11px] font-black"><span className="mr-2 text-[#487a54]">{index + 1}.</span>{question}</p>
              <p className={`mt-1.5 rounded-lg bg-[#e8f4eb] px-2 py-1.5 text-[10px] font-black text-[#487a54] ${revealed.test ? "opacity-100" : "opacity-0"}`}>{answer}</p>
            </article>
          ))}
        </div>
        <p className="mt-auto text-center text-[11px] text-[#83948b]">9—10题：进入价格计算；8题以下：回看第10—13页。</p>
      </div>
    </Page>,
    <Page key="06-32" number="32">
      <div className="flex h-full flex-col">
        <Heading title="3. 购物小票计算" description="根据单价和数量说出总价，再检查数字系统。" icon={<BadgeDollarSign size={22} />} />
        <div className="mt-4 space-y-3">
          {[
            ["사과", "한 개에 500원", "세 개", "1,500원 · 천오백 원"],
            ["우유", "한 병에 2,000원", "두 병", "4,000원 · 사천 원"],
            ["커피", "한 잔에 3,000원", "네 잔", "12,000원 · 만 이천 원"],
            ["티셔츠", "한 개에 20,000원", "두 개", "40,000원 · 사만 원"],
          ].map(([product, unit, count, total]) => (
            <article key={product} className="grid grid-cols-[70px_1fr_70px_1fr] items-center gap-3 rounded-2xl border border-[#cfe3d4] bg-white p-4 text-xs">
              <b className="text-[#487a54]">{product}</b><span>{unit}</span><b>{count}</b><span className="font-black">{total}</span>
            </article>
          ))}
        </div>
        <section className="mt-5 rounded-2xl bg-[#e8f4eb] p-5">
          <p className="text-xs font-black text-[#487a54]">口头小票</p>
          <p className="mt-3 text-sm font-black leading-7">
            사과 세 개는 천오백 원이고 우유 두 병은 사천 원이에요. 모두 오천오백 원이에요.
          </p>
        </section>
        <p className="mt-auto text-[11px] font-bold text-[#71857b]">现实购物中总价最重要：算完以后必须用韩语完整读出。</p>
      </div>
    </Page>,
    <Page key="06-33" number="33">
      <div className="flex h-full flex-col">
        <Heading title="4. 口语验收 · 八句完整交易" description="不看稿完成至少八句购物对话，并正确结算总价。" icon={<Mic2 size={22} />} />
        <section className="mt-5 rounded-2xl border border-[#cfe3d4] bg-[#f2f8f3] p-5">
          <p className="text-xs font-black text-[#487a54]">六项必达信息</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            {["询问一次价格", "说出一次单价", "正确使用一个量词", "评价一种商品", "使用一次 도", "使用 주세요 完成购买"].map((task, index) => (
              <label key={`${task}-${index}`} className="flex items-center gap-2 rounded-xl bg-white p-3 font-bold"><input type="checkbox" className="accent-[#487a54]" />{task}</label>
            ))}
          </div>
        </section>
        <div className="mt-5 grid grid-cols-2 gap-4">
          <NoteBox label="顾客追问卡" tone="green">
            이거 얼마예요?<br />
            한 개에 얼마예요?<br />
            이것이 맛있어요?<br />
            다른 것도 있어요?
          </NoteBox>
          <NoteBox label="店员应答卡" tone="amber">
            한 ______에 ______ 원이에요.<br />
            네, 아주 좋아요.<br />
            ______도 있어요.<br />
            모두 ______ 원이에요.
          </NoteBox>
        </div>
        <button type="button" onClick={() => speak("사과가 얼마예요? 한 개에 천 원이에요. 사과가 맛있어요? 네, 아주 맛있어요. 그럼 사과 세 개 주세요. 오렌지도 필요하세요? 네, 두 개도 주세요. 모두 오천 원이에요.")} className="mt-auto flex items-center justify-center gap-2 rounded-2xl bg-[#487a54] p-4 text-sm font-black text-white"><Volume2 size={16} />播放八句示范</button>
      </div>
    </Page>,
    <Page key="06-34-ending" number="34">
      <div className="flex h-full flex-col justify-center">
        <div className="mx-auto w-full max-w-[440px] text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f4eb] text-[#487a54]"><Sparkles size={27} /></span>
          <p className="mt-4 text-xs font-black tracking-[0.18em] text-[#487a54]">LESSON 06 · COMPLETE</p>
          <h2 className="mt-3 text-4xl font-black text-[#1f2e28]">얼마예요?</h2>
          <p className="mt-3 text-lg font-black text-[#303432]">你已经完成第六课</p>
          <p className="mx-auto mt-3 max-w-[380px] text-sm leading-7 text-[#60736a]">
            你已经能询问价格、说明数量、评价商品，并在八句以上的对话中完成一笔真实交易。
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-left">
            {[
              ["01", "礼貌请求", "V-(으)세요"],
              ["02", "计算数量", "固有词数字 + 量词"],
              ["03", "描述商品", "N이／가 + A-아／어요"],
              ["04", "追加项目", "N도"],
            ].map(([number, title, detail]) => (
              <div key={`${number}-${title}`} className="rounded-xl border border-[#dce8e1] bg-white px-4 py-3">
                <p className="text-[10px] font-black text-[#487a54]">{number}</p>
                <p className="mt-1 text-xs font-black">{title}</p>
                <p className="mt-1 text-[10px] leading-4 text-[#71857b]">{detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-[#cfe3d4] bg-[#f2f8f3] px-5 py-3.5 text-left">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black tracking-[0.14em] text-[#487a54]">LESSON 6 TEST · 本课测试</p>
                <p className="mt-1 text-xs font-bold text-[#52685e]">前往章节测试专区，检验双数字系统、量词、价格与购物表达。</p>
              </div>
              <button type="button" onClick={() => window.location.assign("/dashboard/assignments/korean")} className="shrink-0 rounded-full bg-white px-3 py-2 text-[10px] font-black text-[#487a54] shadow-sm">前往测试专区</button>
            </div>
          </div>
          <div className="mt-4 rounded-2xl bg-[#eaf2fb] px-5 py-4 text-left">
            <p className="text-[10px] font-black tracking-[0.14em] text-[#3d6f9f]">NEXT · LESSON 07</p>
            <div className="mt-2 flex items-end justify-between gap-4">
              <div>
                <p className="text-lg font-black text-[#243d35]">날씨가 어때요?</p>
                <p className="mt-1 text-[11px] text-[#60736a]">下一课：学习天气、季节和更正式的描述方式。</p>
              </div>
              <button type="button" onClick={() => flipBookRef.current?.pageFlip()?.flip(1)} className="shrink-0 rounded-full bg-white px-3 py-2 text-[10px] font-black text-[#3d6f9f] shadow-sm">返回目录</button>
            </div>
          </div>
          <p className="mt-2 text-xs font-bold text-[#6c7d74]">能独立完成一次购买，韩语就真正进入了生活。</p>
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
