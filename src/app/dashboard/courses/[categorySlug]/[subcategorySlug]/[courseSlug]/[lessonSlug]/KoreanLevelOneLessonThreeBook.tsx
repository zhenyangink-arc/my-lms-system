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
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  Headphones,
  Library,
  MapPin,
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

type Speak = (text: string) => void;
type VocabularyItem = {
  korean: string;
  pronunciation?: string;
  type: string;
  chinese: string;
};

const LESSON_THREE_TEMPLATE = buildKoreanEbookSectionMap([
  { step: "第一步", label: "课前导航", dividerPage: 2, contentPages: [3] },
  { step: "第二步", label: "核心词汇表", dividerPage: 4, contentPages: [5, 6, 7] },
  { step: "第三步", label: "语法讲解", dividerPage: 8, contentPages: [9, 10, 11, 12] },
  { step: "第四步", label: "句型操练", dividerPage: 13, contentPages: [14, 15, 16] },
  { step: "第五步", label: "实战对话", dividerPage: 17, contentPages: [18, 19, 20, 21] },
  { step: "第六步", label: "听说任务", dividerPage: 22, contentPages: [23, 24, 25] },
  { step: "第七步", label: "读写拓展", dividerPage: 26, contentPages: [27, 28] },
  { step: "第八步", label: "自测与复盘", dividerPage: 29, contentPages: [30, 31] },
]);

const SectionStepContext = createContext("第八步");

function getSectionStep(number: string) {
  return LESSON_THREE_TEMPLATE.pageMeta[number]?.tag ?? "第八步";
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
        LESSON_THREE_TEMPLATE.headers[number] ??
        "第03课 · 한국어를 공부해요."
      }
      cover={cover}
      sectionMeta={LESSON_THREE_TEMPLATE.pageMeta[number]}
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
    <div
      className={`mt-4 grid grid-cols-3 gap-2 ${
        showChinese ? "" : "[&_[data-vocab-meaning]]:opacity-0"
      }`}
    >
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

function RuleCard({
  label,
  children,
  tone = "purple",
}: {
  label: string;
  children: ReactNode;
  tone?: "purple" | "amber" | "green" | "blue";
}) {
  const colors = {
    purple: "border-[#ddd0ee] bg-[#f7f2fc] text-[#75559a]",
    amber: "border-[#ead8be] bg-[#fff8ed] text-[#9b6b32]",
    green: "border-[#cfe3d4] bg-[#f2f8f3] text-[#487a54]",
    blue: "border-[#cfddec] bg-[#f1f6fb] text-[#3d6f9f]",
  };
  return (
    <section className={`rounded-2xl border p-4 ${colors[tone]}`}>
      <p className="text-[11px] font-black tracking-[0.1em]">{label}</p>
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
    <span className="flex items-center justify-between gap-2">
      <span>{children}</span>
      <KoreanEbookSpeakButton text={text} onSpeak={speak} compact />
    </span>
  );
}

function DialogueBlock({
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
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-black text-[#526c60]">
            {line.speaker}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-[#173f4a]">{line.korean}</p>
            <p
              className={`mt-1 text-[11px] font-bold text-[#71857b] transition ${
                showChinese ? "opacity-100" : "opacity-0"
              }`}
            >
              {line.chinese}
            </p>
          </div>
          <KoreanEbookSpeakButton text={line.korean} onSpeak={speak} />
        </div>
      ))}
    </div>
  );
}

const actionVerbs: VocabularyItem[] = [
  { korean: "공부하다", pronunciation: "공부하다", type: "动词", chinese: "学习" },
  { korean: "일하다", pronunciation: "일하다", type: "动词", chinese: "工作" },
  { korean: "쉬다", pronunciation: "쉬다", type: "动词", chinese: "休息" },
  { korean: "운동하다", pronunciation: "운동하다", type: "动词", chinese: "运动" },
  { korean: "자다", pronunciation: "자다", type: "动词", chinese: "睡觉" },
  { korean: "먹다", pronunciation: "먹따", type: "动词", chinese: "吃" },
  { korean: "마시다", pronunciation: "마시다", type: "动词", chinese: "喝" },
  { korean: "사다", pronunciation: "사다", type: "动词", chinese: "买" },
  { korean: "읽다", pronunciation: "익따", type: "动词", chinese: "读" },
  { korean: "보다", pronunciation: "보다", type: "动词", chinese: "看" },
  { korean: "듣다", pronunciation: "듣따", type: "动词", chinese: "听" },
  { korean: "만나다", pronunciation: "만나다", type: "动词", chinese: "见面" },
  { korean: "가다", pronunciation: "가다", type: "动词", chinese: "去" },
  { korean: "오다", pronunciation: "오다", type: "动词", chinese: "来" },
  { korean: "요리하다", pronunciation: "요리하다", type: "动词", chinese: "做饭" },
];

const placeNouns: VocabularyItem[] = [
  { korean: "집", pronunciation: "집", type: "场所名词", chinese: "家" },
  { korean: "학교", pronunciation: "학꾜", type: "场所名词", chinese: "学校" },
  { korean: "식당", pronunciation: "식땅", type: "场所名词", chinese: "餐厅" },
  { korean: "도서관", pronunciation: "도서관", type: "场所名词", chinese: "图书馆" },
  { korean: "커피숍", pronunciation: "커피숍", type: "场所名词", chinese: "咖啡厅" },
  { korean: "회사", pronunciation: "회사", type: "场所名词", chinese: "公司" },
  { korean: "공원", pronunciation: "공원", type: "场所名词", chinese: "公园" },
  { korean: "백화점", pronunciation: "배콰점", type: "场所名词", chinese: "百货商店" },
  { korean: "시장", pronunciation: "시장", type: "场所名词", chinese: "市场" },
  { korean: "극장", pronunciation: "극짱", type: "场所名词", chinese: "剧场／电影院" },
  { korean: "은행", pronunciation: "은행", type: "场所名词", chinese: "银行" },
  { korean: "병원", pronunciation: "병원", type: "场所名词", chinese: "医院" },
  { korean: "서점", pronunciation: "서점", type: "场所名词", chinese: "书店" },
  { korean: "편의점", pronunciation: "펴니점", type: "场所名词", chinese: "便利店" },
  { korean: "체육관", pronunciation: "체육꽌", type: "场所名词", chinese: "体育馆" },
];

const objectWords: VocabularyItem[] = [
  { korean: "한국어", pronunciation: "한구거", type: "名词", chinese: "韩语" },
  { korean: "책", pronunciation: "책", type: "名词", chinese: "书" },
  { korean: "신문", pronunciation: "신문", type: "名词", chinese: "报纸" },
  { korean: "음악", pronunciation: "으막", type: "名词", chinese: "音乐" },
  { korean: "영화", pronunciation: "영화", type: "名词", chinese: "电影" },
  { korean: "커피", pronunciation: "커피", type: "名词", chinese: "咖啡" },
  { korean: "물", pronunciation: "물", type: "名词", chinese: "水" },
  { korean: "밥", pronunciation: "밥", type: "名词", chinese: "饭" },
  { korean: "과일", pronunciation: "과일", type: "名词", chinese: "水果" },
  { korean: "친구", pronunciation: "친구", type: "名词", chinese: "朋友" },
  { korean: "오늘", pronunciation: "오늘", type: "时间名词", chinese: "今天" },
  { korean: "지금", pronunciation: "지금", type: "副词", chinese: "现在" },
  { korean: "같이", pronunciation: "가치", type: "副词", chinese: "一起" },
  { korean: "어디", pronunciation: "어디", type: "代词", chinese: "哪里" },
  { korean: "뭐", pronunciation: "뭐", type: "代词", chinese: "什么" },
];

export function KoreanLevelOneLessonThreeBook({
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
    <Page key="03-01" number="01">
      <KoreanEbookTableOfContents
        lessonNumber={3}
        pageMeta={LESSON_THREE_TEMPLATE.pageMeta}
        onNavigate={(page) => flipBookRef.current?.pageFlip()?.flip(page)}
        entries={[
          { step: "01", title: "课前导航", pageRange: "02—03", detail: "建立动作句地图" },
          { step: "02", title: "核心词汇表", pageRange: "04—07", detail: "动作·场所·对象" },
          { step: "03", title: "语法讲解", pageRange: "08—12", detail: "四项核心语法" },
          { step: "04", title: "句型操练", pageRange: "13—16", detail: "从变形到造句" },
          { step: "05", title: "实战对话", pageRange: "17—21", detail: "校园与日常场景" },
          { step: "06", title: "听说任务", pageRange: "22—25", detail: "听辨·跟读·表达" },
          { step: "07", title: "读写拓展", pageRange: "26—28", detail: "阅读行动路线" },
          { step: "08", title: "自测与复盘", pageRange: "29—32", detail: "检测并完成本课" },
        ]}
      />
    </Page>,
    <Page key="03-02" number="02">
      <KoreanEbookSectionDivider
        step="第一步"
        title="课前导航"
        goal="先建立“谁—在哪里—做什么”的句子骨架，再把词汇和语法逐层装进去。"
        icon={<Compass size={24} />}
      />
    </Page>,
    <Page key="03-03" number="03">
      <div className="flex h-full flex-col">
        <Heading
          title="这一课，你要会说什么？"
          description="第三课的核心不是背单个动词，而是能描述一段真实的日常行动。"
          icon={<MapPin size={22} />}
          action={
            <KoreanEbookRevealButton
              shown={Boolean(revealed.navigation)}
              onClick={() => toggle("navigation")}
            />
          }
        />
        <div className="mt-5 grid grid-cols-2 gap-3">
          {[
            ["01", "现在做什么", "지금 한국어를 공부해요.", "现在学习韩语。"],
            ["02", "动作的对象", "책을 읽어요.", "看书。"],
            ["03", "动作的场所", "도서관에서 공부해요.", "在图书馆学习。"],
            ["04", "表达不做", "오늘은 운동 안 해요.", "今天不运动。"],
          ].map(([number, title, korean, chinese]) => (
            <button
              key={number}
              type="button"
              onClick={() => speak(korean)}
              className="rounded-2xl border border-[#e1e8e4] bg-white p-4 text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black text-[#bd741e]">{number} · {title}</p>
                <Volume2 size={13} className="text-[#238777]" />
              </div>
              <p className="mt-2 text-sm font-black text-[#173f4a]">{korean}</p>
              <p className={`mt-1 text-[11px] font-bold text-[#71857b] transition ${revealed.navigation ? "opacity-100" : "opacity-0"}`}>{chinese}</p>
            </button>
          ))}
        </div>
        <section className="mt-5 rounded-2xl bg-[#fff4e7] p-5">
          <p className="text-xs font-black text-[#a26024]">本课句子发动机</p>
          <p className="mt-3 text-center text-lg font-black text-[#294f43]">
            场所에서 + 对象을／를 +（안）动作아요／어요
          </p>
          <p className="mt-3 text-xs leading-6 text-[#6c6f69]">
            韩语中各成分可以按语境省略，但动词通常放在句尾。先抓住句尾，就能更快听懂整句。
          </p>
        </section>
        <div className="mt-auto rounded-2xl border border-[#dce8e1] bg-[#f7faf8] p-4 text-xs leading-6">
          <span className="font-black text-[#238777]">学习挑战：</span>
          每学完一个语法，就用“图书馆、咖啡厅、家”各造一个新句子。
        </div>
      </div>
    </Page>,
    <Page key="03-04" number="04">
      <KoreanEbookSectionDivider
        step="第二步"
        title="核心词汇表"
        goal="按“动作—场所—对象”建立词汇网络，点击卡片即可听韩语读音。"
        icon={<Library size={24} />}
      />
    </Page>,
    <Page key="03-05" number="05">
      <div className="flex h-full flex-col">
        <Heading
          title="1. 动作动词"
          description="先记词典形，再观察口语形。带 하다 的动词会统一变成 해요。"
          icon={<Sparkles size={22} />}
          action={
            <KoreanEbookRevealButton
              shown={Boolean(revealed.actionWords)}
              onClick={() => toggle("actionWords")}
            />
          }
        />
        <VocabularyGrid items={actionVerbs} speak={speak} showChinese={Boolean(revealed.actionWords)} />
        <p className="mt-auto rounded-xl bg-[#fff5e8] p-3 text-[11px] font-bold leading-5 text-[#8b642f]">
          发音提示：읽다 的实际读音接近 [익따]，먹다 接近 [먹따]；先听再跟读，不要逐字母硬拼。
        </p>
      </div>
    </Page>,
    <Page key="03-06" number="06">
      <div className="flex h-full flex-col">
        <Heading
          title="2. 场所名词"
          description="这些地点既可与 에 表示去向或存在，也可与 에서 表示动作发生地。"
          icon={<MapPin size={22} />}
          action={
            <KoreanEbookRevealButton
              shown={Boolean(revealed.placeWords)}
              onClick={() => toggle("placeWords")}
            />
          }
        />
        <VocabularyGrid items={placeNouns} speak={speak} showChinese={Boolean(revealed.placeWords)} />
        <p className="mt-auto rounded-xl bg-[#eef5fb] p-3 text-[11px] font-bold leading-5 text-[#3d6f9f]">
          词块记忆：학교에 가요（去学校）／학교에서 공부해요（在学校学习）。
        </p>
      </div>
    </Page>,
    <Page key="03-07" number="07">
      <div className="flex h-full flex-col">
        <Heading
          title="3. 动作对象与辅助词"
          description="把名词和动词成对记忆，比只背中文意思更容易开口。"
          icon={<BookOpenCheck size={22} />}
          action={
            <KoreanEbookRevealButton
              shown={Boolean(revealed.objectWords)}
              onClick={() => toggle("objectWords")}
            />
          }
        />
        <VocabularyGrid items={objectWords} speak={speak} showChinese={Boolean(revealed.objectWords)} />
        <div className="mt-auto grid grid-cols-3 gap-2 text-center text-[10px] font-black">
          {[
            ["책을 읽어요", "bg-[#f1eafb] text-[#75559a]"],
            ["음악을 들어요", "bg-[#e7f5f1] text-[#347b69]"],
            ["친구를 만나요", "bg-[#fff0df] text-[#b46624]"],
          ].map(([sentence, tone]) => (
            <button
              key={sentence}
              type="button"
              onClick={() => speak(sentence)}
              className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 ${tone}`}
            >
              <Volume2 size={10} />
              {sentence}
            </button>
          ))}
        </div>
      </div>
    </Page>,
    <Page key="03-08" number="08">
      <KoreanEbookSectionDivider
        step="第三步"
        title="语法讲解"
        goal="四个语法各占一页：理解意义、掌握形式、辨认易错点，并立即完成一句输出。"
        icon={<NotebookPen size={24} />}
      />
    </Page>,
    <Page key="03-09" number="09">
      <div className="flex h-full flex-col">
        <Heading
          title="1. V／A-아／어요"
          description="非格式体敬语的现在时句尾，用于日常陈述、提问和回答。"
          icon={<NotebookPen size={22} />}
        />
        <div className="mt-4 grid grid-cols-3 gap-3">
          <RuleCard label="① ㅏ／ㅗ → -아요" tone="amber">
            <RuleSentence text="가다. 가요." speak={speak}>가다 → 가요</RuleSentence>
            <RuleSentence text="보다. 봐요." speak={speak}>보다 → 봐요</RuleSentence>
            <RuleSentence text="자다. 자요." speak={speak}>자다 → 자요</RuleSentence>
          </RuleCard>
          <RuleCard label="② 其他元音 → -어요" tone="blue">
            <RuleSentence text="먹다. 먹어요." speak={speak}>먹다 → 먹어요</RuleSentence>
            <RuleSentence text="읽다. 읽어요." speak={speak}>읽다 → 읽어요</RuleSentence>
            <RuleSentence text="쉬다. 쉬어요." speak={speak}>쉬다 → 쉬어요</RuleSentence>
          </RuleCard>
          <RuleCard label="③ 하다 → 해요" tone="green">
            <RuleSentence text="공부하다. 공부해요." speak={speak}>공부하다 → 공부해요</RuleSentence>
            <RuleSentence text="일하다. 일해요." speak={speak}>일하다 → 일해요</RuleSentence>
            <RuleSentence text="운동하다. 운동해요." speak={speak}>운동하다 → 운동해요</RuleSentence>
          </RuleCard>
        </div>
        <RuleCard label="为什么会缩约？" tone="purple">
          보다 + 아요 不是机械地保留两个元音，而会缩约成 <b>봐요</b>；마시다 + 어요 会形成
          <b> 마셔요</b>。初级阶段先把常见口语形当作完整声音记住。
        </RuleCard>
        <section className="mt-3 rounded-2xl border border-[#ead8be] bg-white p-4">
          <p className="text-xs font-black text-[#9b6b32]">语调决定句子功能</p>
          <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
            <p className="rounded-xl bg-[#fff8ed] p-3"><b>공부해요.</b><br />下降语调：在学习。</p>
            <p className="rounded-xl bg-[#fff8ed] p-3"><b>공부해요?</b><br />上扬语调：学习吗？</p>
          </div>
        </section>
        <p className="mt-auto text-[11px] font-bold text-[#71857b]">
          注意：本页是口语敬语，不等于不礼貌；它比书面正式体更适合熟人和一般日常场景。
        </p>
      </div>
    </Page>,
    <Page key="03-10" number="10">
      <div className="flex h-full flex-col">
        <Heading
          title="2. N-을／를"
          description="宾格助词标记动作直接作用的对象，帮助听者快速识别“做什么”。"
          icon={<NotebookPen size={22} />}
        />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <RuleCard label="有收音 + 을" tone="blue">
            <RuleSentence text="책을 읽어요." speak={speak}>책<b>을</b> 읽어요.</RuleSentence>
            <RuleSentence text="밥을 먹어요." speak={speak}>밥<b>을</b> 먹어요.</RuleSentence>
            <RuleSentence text="음악을 들어요." speak={speak}>음악<b>을</b> 들어요.</RuleSentence>
          </RuleCard>
          <RuleCard label="无收音 + 를" tone="green">
            <RuleSentence text="커피를 마셔요." speak={speak}>커피<b>를</b> 마셔요.</RuleSentence>
            <RuleSentence text="친구를 만나요." speak={speak}>친구<b>를</b> 만나요.</RuleSentence>
            <RuleSentence text="영화를 봐요." speak={speak}>영화<b>를</b> 봐요.</RuleSentence>
          </RuleCard>
        </div>
        <section className="mt-3 rounded-2xl bg-[#f7f2fc] p-4">
          <p className="text-xs font-black text-[#75559a]">判断顺序</p>
          <p className="mt-2 text-xs leading-6">
            先找到动作动词 → 再问“这个动作作用于什么？” → 找到对象名词 → 看名词末尾有没有收音。
          </p>
          <p className="mt-2 text-center text-base font-black text-[#294f43]">
            친구 + 를 + 만나요
          </p>
        </section>
        <RuleCard label="口语省略不等于随便省略" tone="amber">
          当对象已非常明确时，口语中可以说 “책 읽어요.”。学习阶段建议先保留 을／를，
          因为它能让句子关系更清楚，也便于建立正确语感。
        </RuleCard>
        <div className="mt-auto rounded-xl border border-[#dce8e1] p-3 text-xs">
          <b className="text-[#3d6f9f]">快速检查：</b>
          “사과___ 사요” 中 사과 无收音，所以填 <b>를</b>。
        </div>
      </div>
    </Page>,
    <Page key="03-11" number="11">
      <div className="flex h-full flex-col">
        <Heading
          title="3. 场所 N-에서"
          description="表示动作实际发生的地点，相当于“在某地做……”。"
          icon={<MapPin size={22} />}
        />
        <section className="mt-4 rounded-2xl bg-[#f1f6fb] p-5 text-center">
          <p className="text-[11px] font-black text-[#3d6f9f]">核心结构</p>
          <p className="mt-3 text-lg font-black text-[#173f4a]">
            场所 + 에서 + 对象 + 을／를 + 动作
          </p>
          <p className="mt-3 text-sm font-black">도서관에서 책을 읽어요.</p>
          <p className="mt-1 text-xs text-[#71857b]">在图书馆看书。</p>
        </section>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <RuleCard label="-에：存在／移动的终点" tone="amber">
            <RuleSentence text="학교에 가요." speak={speak}>학교<b>에</b> 가요.</RuleSentence>
            <span className="block text-[10px] font-medium text-[#71857b]">去学校。</span>
            <RuleSentence text="집에 있어요." speak={speak}>집<b>에</b> 있어요.</RuleSentence>
            <span className="block text-[10px] font-medium text-[#71857b]">在家。</span>
          </RuleCard>
          <RuleCard label="-에서：动作发生的舞台" tone="green">
            <RuleSentence text="학교에서 공부해요." speak={speak}>학교<b>에서</b> 공부해요.</RuleSentence>
            <span className="block text-[10px] font-medium text-[#71857b]">在学校学习。</span>
            <RuleSentence text="집에서 쉬어요." speak={speak}>집<b>에서</b> 쉬어요.</RuleSentence>
            <span className="block text-[10px] font-medium text-[#71857b]">在家休息。</span>
          </RuleCard>
        </div>
        <RuleCard label="不要只按中文“在”来选择" tone="purple">
          中文都可以译成“在”，韩语却要看句尾：있어요／없어요 表示存在时常用 에；
          공부해요／먹어요／일해요 等动作发生时用 에서。
        </RuleCard>
        <p className="mt-auto text-[11px] font-bold text-[#71857b]">
          记忆画面：에 是地图上的“点”，에서 是动作展开的“舞台”。
        </p>
      </div>
    </Page>,
    <Page key="03-12" number="12">
      <div className="flex h-full flex-col">
        <Heading
          title="4. 안 + V／A"
          description="把 안 放在谓语前，表达“不做”或“不是某种状态”。"
          icon={<NotebookPen size={22} />}
        />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <RuleCard label="普通动词：안 + 动词" tone="blue">
            <RuleSentence text="안 가요." speak={speak}>안 가요（不去）</RuleSentence>
            <RuleSentence text="안 먹어요." speak={speak}>안 먹어요（不吃）</RuleSentence>
            <RuleSentence text="안 자요." speak={speak}>안 자요（不睡）</RuleSentence>
          </RuleCard>
          <RuleCard label="名词 + 하다：插入中间" tone="green">
            <RuleSentence text="공부 안 해요." speak={speak}>공부 안 해요（不学习）</RuleSentence>
            <RuleSentence text="운동 안 해요." speak={speak}>운동 안 해요（不运动）</RuleSentence>
            <RuleSentence text="일 안 해요." speak={speak}>일 안 해요（不工作）</RuleSentence>
          </RuleCard>
        </div>
        <section className="mt-3 rounded-2xl border border-[#ead8be] bg-[#fff8ed] p-4">
          <p className="text-xs font-black text-[#9b6b32]">结构拆解</p>
          <p className="mt-2 text-sm font-black text-[#294f43]">
            공부하다 = 공부（学习这件事）+ 하다（做）
          </p>
          <p className="mt-2 text-xs leading-6">
            因此否定的是“做”，自然说 <b>공부 안 해요</b>。初学阶段不要说
            <span className="mx-1 rounded bg-[#fde7e7] px-1 text-[#a84d4d]">안 공부해요</span>。
          </p>
        </section>
        <RuleCard label="语用提示：안 常表示当前选择" tone="purple">
          “오늘 커피 안 마셔요.” 更像“今天不喝咖啡”。如果要表达能力上“不会／不能”，
          后续会学习 못；两者不能简单互换。
        </RuleCard>
        <div className="mt-auto rounded-xl bg-[#e8f4eb] p-3 text-xs font-bold text-[#487a54]">
          一秒改句：운동해요 → 운동 안 해요；책을 읽어요 → 책을 안 읽어요。
        </div>
      </div>
    </Page>,
    <Page key="03-13" number="13">
      <KoreanEbookSectionDivider
        step="第四步"
        title="句型操练"
        goal="先练词尾变形，再选择助词，最后把动作、对象与场所组合成完整句。"
        icon={<PencilLine size={24} />}
      />
    </Page>,
    <Page key="03-14" number="14">
      <div className="flex h-full flex-col">
        <Heading
          title="1. 动词变形工坊"
          description="先判断词干末尾元音，再说出口语形。点击按钮核对答案。"
          icon={<PencilLine size={22} />}
          action={<KoreanEbookRevealButton shown={Boolean(revealed.conjugation)} onClick={() => toggle("conjugation")} answer />}
        />
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            ["가다", "가요", "ㅏ → 아요"],
            ["보다", "봐요", "ㅗ + 아요 → 와요"],
            ["먹다", "먹어요", "其他元音 → 어요"],
            ["마시다", "마셔요", "ㅣ + 어요 → 여요"],
            ["쉬다", "쉬어요", "ㅟ + 어요"],
            ["듣다", "들어요", "本词发生 ㄷ 不规则"],
            ["공부하다", "공부해요", "하다 → 해요"],
            ["운동하다", "운동해요", "하다 → 해요"],
          ].map(([base, answer, clue]) => (
            <div key={base} className="rounded-xl border border-[#ead8be] bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-black">{base}</p>
                <span className="text-[10px] font-bold text-[#9b6b32]">{clue}</span>
              </div>
              <p className={`mt-2 rounded-lg bg-[#fff8ed] px-3 py-2 text-xs font-black text-[#b46624] ${revealed.conjugation ? "opacity-100" : "opacity-0"}`}>
                {answer}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-auto text-[11px] leading-5 text-[#71857b]">
          创新记忆法：不要只背“规则编号”，把 가요／먹어요／해요 当成三个声音抽屉，新动词放进对应抽屉。
        </p>
      </div>
    </Page>,
    <Page key="03-15" number="15">
      <div className="flex h-full flex-col">
        <Heading
          title="2. 助词选择实验"
          description="观察名词末尾和句尾动词，分别选择 을／를、에／에서。"
          icon={<ClipboardCheck size={22} />}
          action={<KoreanEbookRevealButton shown={Boolean(revealed.particles)} onClick={() => toggle("particles")} answer />}
        />
        <div className="mt-4 space-y-2.5">
          {[
            ["저는 책( 을 / 를 ) 읽어요.", "책을 읽어요.", "책有收音"],
            ["민수 씨는 커피( 을 / 를 ) 마셔요.", "커피를 마셔요.", "커피无收音"],
            ["학교( 에 / 에서 ) 공부해요.", "학교에서 공부해요.", "学习是动作"],
            ["친구가 집( 에 / 에서 ) 있어요.", "집에 있어요.", "있어요表示存在"],
            ["공원( 에 / 에서 ) 운동해요.", "공원에서 운동해요.", "运动在此发生"],
            ["백화점( 에 / 에서 ) 가요.", "백화점에 가요.", "가요的目的地"],
          ].map(([question, answer, clue], index) => (
            <div key={question} className="grid grid-cols-[28px_1fr_1fr] items-center gap-3 rounded-xl border border-[#dce8e1] bg-white p-3">
              <span className="text-xs font-black text-[#b46624]">{index + 1}</span>
              <p className="text-xs font-black">{question}</p>
              <p className={`text-[11px] font-bold text-[#347b69] ${revealed.particles ? "opacity-100" : "opacity-0"}`}>
                {answer}<span className="ml-2 text-[#81938a]">· {clue}</span>
              </p>
            </div>
          ))}
        </div>
        <section className="mt-auto rounded-2xl bg-[#fff2df] p-4 text-xs leading-6">
          <b className="text-[#b46624]">解题顺序：</b>
          을／를 看前面的名词收音；에／에서 看后面的谓语意义。
        </section>
      </div>
    </Page>,
    <Page key="03-16" number="16">
      <div className="flex h-full flex-col">
        <Heading
          title="3. 句子组装台"
          description="按“时间／人物—场所—对象—动作”的顺序组织信息，重点保持动词在句尾。"
          icon={<PencilLine size={22} />}
          action={
            <KoreanEbookRevealButton
              shown={Boolean(revealed.assembly)}
              onClick={() => toggle("assembly")}
              answer
            />
          }
        />
        <div className="mt-4 space-y-3">
          {[
            ["지금", "도서관", "한국어", "공부하다", "지금 도서관에서 한국어를 공부해요."],
            ["오늘", "식당", "밥", "먹다", "오늘 식당에서 밥을 먹어요."],
            ["주말", "공원", "친구", "만나다", "주말에 공원에서 친구를 만나요."],
            ["오늘", "집", "운동하다", "안", "오늘 집에서 운동 안 해요."],
          ].map((parts, index) => {
            const answer = parts[parts.length - 1];
            return (
              <article key={answer} className="rounded-2xl border border-[#ead8be] bg-white p-4">
                <div className="flex flex-wrap gap-2">
                  {parts.slice(0, -1).map((part) => (
                    <span key={part} className="rounded-full bg-[#fff2df] px-3 py-1 text-[11px] font-black text-[#b46624]">{part}</span>
                  ))}
                </div>
                <p className={`mt-3 text-sm font-black text-[#294f43] transition ${revealed.assembly ? "opacity-100" : "opacity-0"}`}>{index + 1}. {answer}</p>
              </article>
            );
          })}
        </div>
        <p className="mt-auto rounded-xl bg-[#f7faf8] p-3 text-[11px] font-bold leading-5 text-[#60736a]">
          更自然的韩语不等于固定死顺序；这里先用稳定骨架建立准确度，熟练后再根据重点调整。
        </p>
      </div>
    </Page>,
    <Page key="03-17" number="17">
      <KoreanEbookSectionDivider
        step="第五步"
        title="实战对话"
        goal="进入四个生活场景：课间、图书馆、午休和周末计划，把语法变成即时交流。"
        icon={<MessageCircle size={24} />}
      />
    </Page>,
    <Page key="03-18" number="18">
      <div className="flex h-full flex-col">
        <Heading
          title="场景 1 · 课间在做什么？"
          description="目标：用现在时询问并回答眼前的动作。"
          icon={<MessageCircle size={22} />}
          action={<KoreanEbookRevealButton shown={Boolean(revealed.dialogueOne)} onClick={() => toggle("dialogueOne")} />}
        />
        <DialogueBlock
          speak={speak}
          showChinese={Boolean(revealed.dialogueOne)}
          lines={[
            { speaker: "A", korean: "지금 뭐 해요?", chinese: "现在做什么？" },
            { speaker: "B", korean: "한국어를 공부해요.", chinese: "学习韩语。" },
            { speaker: "A", korean: "어디에서 공부해요?", chinese: "在哪里学习？" },
            { speaker: "B", korean: "교실에서 공부해요.", chinese: "在教室学习。" },
          ]}
        />
        <section className="mt-5 rounded-2xl bg-[#fbeaec] p-4">
          <p className="text-xs font-black text-[#a65b68]">替换练习</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold">
            <p className="rounded-xl bg-white p-3">신문을 읽어요.</p>
            <p className="rounded-xl bg-white p-3">음악을 들어요.</p>
            <p className="rounded-xl bg-white p-3">커피를 마셔요.</p>
            <p className="rounded-xl bg-white p-3">친구를 만나요.</p>
          </div>
        </section>
        <p className="mt-auto text-[11px] text-[#71857b]">回答时已知的“저는”可以省略，让口语更自然。</p>
      </div>
    </Page>,
    <Page key="03-19" number="19">
      <div className="flex h-full flex-col">
        <Heading
          title="场景 2 · 图书馆偶遇"
          description="目标：表达动作对象，并自然使用否定。"
          icon={<Library size={22} />}
          action={<KoreanEbookRevealButton shown={Boolean(revealed.dialogueTwo)} onClick={() => toggle("dialogueTwo")} />}
        />
        <DialogueBlock
          speak={speak}
          showChinese={Boolean(revealed.dialogueTwo)}
          lines={[
            { speaker: "A", korean: "도서관에서 뭐 해요?", chinese: "在图书馆做什么？" },
            { speaker: "B", korean: "책을 읽어요. 수진 씨는요?", chinese: "看书。秀珍呢？" },
            { speaker: "A", korean: "저는 책 안 읽어요.", chinese: "我不看书。" },
            { speaker: "A", korean: "한국어를 공부해요.", chinese: "我学习韩语。" },
          ]}
        />
        <RuleCard label="会话接力词：N은／는요?" tone="purple">
          “수진 씨는요?” 相当于“秀珍呢？”。它把话题自然交给对方，不必重复完整问题。
        </RuleCard>
        <div className="mt-auto rounded-2xl border border-[#ead0d6] bg-white p-4 text-xs">
          <b className="text-[#a65b68]">你的版本：</b>
          把 도서관 换成 커피숍，把 책 换成 커피，重新演一遍。
        </div>
      </div>
    </Page>,
    <Page key="03-20" number="20">
      <div className="flex h-full flex-col">
        <Heading
          title="场景 3 · 午休时间"
          description="目标：用 장소에서 + 목적어를 + 동사 描述完整行动。"
          icon={<MessageCircle size={22} />}
          action={<KoreanEbookRevealButton shown={Boolean(revealed.dialogueThree)} onClick={() => toggle("dialogueThree")} />}
        />
        <DialogueBlock
          speak={speak}
          showChinese={Boolean(revealed.dialogueThree)}
          lines={[
            { speaker: "A", korean: "점심에 어디에서 밥을 먹어요?", chinese: "中午在哪里吃饭？" },
            { speaker: "B", korean: "학교 식당에서 먹어요.", chinese: "在学校餐厅吃。" },
            { speaker: "A", korean: "커피도 마셔요?", chinese: "也喝咖啡吗？" },
            { speaker: "B", korean: "아니요, 오늘은 커피 안 마셔요.", chinese: "不，今天不喝咖啡。" },
          ]}
        />
        <section className="mt-4 rounded-2xl bg-[#fff5f0] p-4">
          <p className="text-xs font-black text-[#a65b68]">信息层级</p>
          <div className="mt-3 flex items-center justify-center gap-2 text-[11px] font-black">
            <span className="rounded-full bg-white px-3 py-2">점심에 · 时间</span>
            <span>→</span>
            <span className="rounded-full bg-white px-3 py-2">식당에서 · 场所</span>
            <span>→</span>
            <span className="rounded-full bg-white px-3 py-2">밥을 먹어요 · 动作</span>
          </div>
        </section>
        <p className="mt-auto text-[11px] leading-5 text-[#71857b]">도 表示“也”，这里作为自然会话扩展词理解即可。</p>
      </div>
    </Page>,
    <Page key="03-21" number="21">
      <div className="flex h-full flex-col">
        <Heading
          title="场景 4 · 周末行动卡"
          description="目标：根据地点卡和动作卡即时生成对话，不依赖固定台词。"
          icon={<Sparkles size={22} />}
          action={<KoreanEbookRevealButton shown={Boolean(revealed.weekendCards)} onClick={() => toggle("weekendCards")} />}
        />
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          {[
            ["공원", "운동해요", "在公园运动"],
            ["시장", "과일을 사요", "在市场买水果"],
            ["극장", "영화를 봐요", "在电影院看电影"],
            ["커피숍", "친구를 만나요", "在咖啡厅见朋友"],
            ["집", "음악을 들어요", "在家听音乐"],
            ["도서관", "책을 읽어요", "在图书馆看书"],
          ].map(([place, action, chinese]) => (
            <button key={place} type="button" onClick={() => speak(`${place}에서 ${action}.`)} className="rounded-2xl border border-[#ead0d6] bg-white p-4">
              <div className="flex items-center justify-center gap-1.5">
                <p className="text-xs font-black text-[#a65b68]">{place}</p>
                <Volume2 size={11} className="text-[#238777]" />
              </div>
              <p className="mt-2 text-sm font-black">{action}</p>
              <p className={`mt-1 text-[10px] text-[#81938a] transition ${revealed.weekendCards ? "opacity-100" : "opacity-0"}`}>{chinese}</p>
            </button>
          ))}
        </div>
        <section className="mt-5 rounded-2xl bg-[#fbeaec] p-5">
          <p className="text-xs font-black text-[#a65b68]">双人规则</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-6">
            <li>学生甲问：주말에 어디에서 뭐 해요?</li>
            <li>学生乙随机选一张卡回答。</li>
            <li>学生甲再问一个是非问题，学生乙必须用 안 回答一次。</li>
          </ol>
        </section>
        <p className="mt-auto text-center text-[11px] font-bold text-[#71857b]">同一张卡说出两个版本，才算真正掌握。</p>
      </div>
    </Page>,
    <Page key="03-22" number="22">
      <KoreanEbookSectionDivider
        step="第六步"
        title="听说任务"
        goal="训练助词、词尾和否定位置的听辨，再完成带节奏的独立表达。"
        icon={<Headphones size={24} />}
      />
    </Page>,
    <Page key="03-23" number="23">
      <div className="flex h-full flex-col">
        <Heading
          title="1. 听见句子的骨架"
          description="不要逐词翻译，先听场所、对象和最后的动作。"
          icon={<Headphones size={22} />}
          action={<KoreanEbookRevealButton shown={Boolean(revealed.listening)} onClick={() => toggle("listening")} answer />}
        />
        <div className="mt-4 space-y-3">
          {[
            ["도서관에서 한국어를 공부해요.", "场所：도서관／对象：한국어／动作：공부해요"],
            ["커피숍에서 친구를 만나요.", "场所：커피숍／对象：친구／动作：만나요"],
            ["오늘 회사에서 일 안 해요.", "场所：회사／否定动作：일 안 해요"],
            ["시장에서 과일을 사요.", "场所：시장／对象：과일／动作：사요"],
          ].map(([sentence, answer], index) => (
            <article key={sentence} className="rounded-2xl border border-[#cfdfeb] bg-white p-4">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => speak(sentence)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf4fa] text-[#3e7fa3]"><Volume2 size={16} /></button>
                <p className="text-xs font-black">音频 {index + 1} · 听两遍后再看分析</p>
              </div>
              <p className={`mt-3 rounded-lg bg-[#f1f6fb] px-3 py-2 text-[11px] font-bold text-[#3d6f9f] ${revealed.listening ? "opacity-100" : "opacity-0"}`}>{answer}</p>
            </article>
          ))}
        </div>
        <p className="mt-auto text-center text-[11px] font-bold text-[#71857b]">
          四段全部听完后，再使用标题栏右侧的“显示答案”统一核对。
        </p>
      </div>
    </Page>,
    <Page key="03-24" number="24">
      <div className="flex h-full flex-col">
        <Heading title="2. 节奏跟读" description="用短停顿切分信息块，句尾不拖长，问句只在最后自然上扬。" icon={<Mic2 size={22} />} />
        <section className="mt-5 rounded-2xl bg-[#eaf4fa] p-5 text-center">
          <p className="text-xs font-black text-[#3e7fa3]">三拍句</p>
          <p className="mt-4 text-xl font-black">도서관에서 ／ 책을 ／ 읽어요.</p>
          <p className="mt-2 text-xs text-[#71857b]">场所 ／ 对象 ／ 动作</p>
          <button type="button" onClick={() => speak("도서관에서 책을 읽어요.")} className="mt-4 rounded-full bg-white px-4 py-2 text-xs font-black text-[#3e7fa3]">播放完整节奏</button>
        </section>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            ["공원에서 ／ 운동해요.", "两拍：场所＋动作"],
            ["식당에서 ／ 밥을 ／ 먹어요.", "三拍：场所＋对象＋动作"],
            ["오늘은 ／ 커피 ／ 안 마셔요.", "三拍：主题＋对象＋否定动作"],
            ["학교에서 ／ 뭐 해요?", "两拍：场所＋疑问动作"],
          ].map(([sentence, note]) => (
            <button key={sentence} type="button" onClick={() => speak(sentence.replaceAll("／", ""))} className="rounded-xl border border-[#cfdfeb] bg-white p-4 text-left">
              <p className="text-sm font-black">{sentence}</p>
              <p className="mt-2 text-[10px] font-bold text-[#3e7fa3]">{note}</p>
            </button>
          ))}
        </div>
        <p className="mt-auto text-[11px] leading-5 text-[#71857b]">跟读三轮：看文字慢读 → 跟音频同步 → 遮住文字独立说。</p>
      </div>
    </Page>,
    <Page key="03-25" number="25">
      <div className="flex h-full flex-col">
        <Heading title="3. 我的行动播报" description="用 30 秒说明今天在哪里做什么，以及一件今天不做的事。" icon={<Mic2 size={22} />} />
        <div className="mt-5 grid grid-cols-2 gap-4">
          <section className="rounded-2xl border border-[#cfdfeb] bg-white p-5">
            <p className="text-xs font-black text-[#3e7fa3]">表达脚手架</p>
            <div className="mt-4 space-y-3 text-xs leading-6">
              <p>① 지금 저는 ______에 있어요.</p>
              <p>② ______에서 ______을／를 해요.</p>
              <p>③ 그리고 ______을／를 ______.</p>
              <p>④ 오늘은 ______ 안 해요.</p>
            </div>
          </section>
          <section className="rounded-2xl bg-[#eaf4fa] p-5">
            <p className="text-xs font-black text-[#3e7fa3]">示范</p>
            <p className="mt-4 text-sm font-black leading-7">
              지금 저는 학교에 있어요. 도서관에서 한국어를 공부해요. 그리고 책을 읽어요. 오늘은 운동 안 해요.
            </p>
            <button type="button" onClick={() => speak("지금 저는 학교에 있어요. 도서관에서 한국어를 공부해요. 그리고 책을 읽어요. 오늘은 운동 안 해요.")} className="mt-4 rounded-full bg-white px-4 py-2 text-[11px] font-black text-[#3e7fa3]">播放示范</button>
          </section>
        </div>
        <section className="mt-5 rounded-2xl border border-[#dce8e1] p-5">
          <p className="text-xs font-black">自我评分 · 每项 1 分</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            {["有一个 에서 场所", "有一个 을／를 对象", "词尾使用 아／어요", "안 的位置正确"].map((item) => (
              <label key={item} className="flex items-center gap-2 rounded-xl bg-[#f7faf8] p-3">
                <input type="checkbox" className="accent-[#3e7fa3]" />{item}
              </label>
            ))}
          </div>
        </section>
        <p className="mt-auto text-center text-[11px] font-bold text-[#71857b]">目标不是一次说快，而是信息完整、助词清楚、句尾稳定。</p>
      </div>
    </Page>,
    <Page key="03-26" number="26">
      <KoreanEbookSectionDivider
        step="第七步"
        title="读写拓展"
        goal="从短文中提取人物行动路线，再写出属于自己的三地点学习日记。"
        icon={<BookOpenCheck size={24} />}
      />
    </Page>,
    <Page key="03-27" number="27">
      <div className="flex h-full flex-col">
        <Heading
          title="1. 阅读 · 지민 씨의 하루"
          description="先圈出场所，再给动作画线，最后判断哪件事没有做。"
          icon={<BookOpenCheck size={22} />}
          action={<KoreanEbookRevealButton shown={Boolean(revealed.reading)} onClick={() => toggle("reading")} answer />}
        />
        <section className="mt-5 rounded-2xl bg-[#eef8f4] p-5">
          <p className="text-sm font-black leading-8">
            지민 씨는 아침에 학교에 가요. 학교에서 한국어를 공부해요.
            점심에는 친구하고 식당에서 밥을 먹어요. 오후에는 도서관에서 책을 읽어요.
            오늘은 커피를 안 마셔요. 저녁에는 집에서 쉬어요.
          </p>
        </section>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          {[
            ["학교", "한국어를 공부해요", "上午"],
            ["식당", "친구하고 밥을 먹어요", "中午"],
            ["도서관", "책을 읽어요", "下午"],
          ].map(([place, action, time]) => (
            <div key={place} className={`rounded-xl border border-[#cfe3d9] bg-white p-3 transition ${revealed.reading ? "opacity-100" : "opacity-0"}`}>
              <p className="text-[10px] font-black text-[#347b69]">{time}</p>
              <p className="mt-1 text-sm font-black">{place}</p>
              <p className="mt-1 text-[10px] text-[#71857b]">{action}</p>
            </div>
          ))}
        </div>
        <RuleCard label="阅读检查" tone="green">
          1. 지민 씨는 어디에서 책을 읽어요?<br />
          2. 누구하고 밥을 먹어요?<br />
          3. 오늘 무엇을 안 마셔요?
        </RuleCard>
        <p className="mt-auto text-[11px] text-[#71857b]">提示：阅读时先找 에／에서／을／를，助词会替你标出句子关系。</p>
      </div>
    </Page>,
    <Page key="03-28" number="28">
      <div className="flex h-full flex-col">
        <Heading title="2. 写作 · 我的三地点日记" description="选择三个地点，每个地点写一个动作，最后补充一个否定句。" icon={<PencilLine size={22} />} />
        <div className="mt-5 grid grid-cols-[1fr_1.4fr] gap-4">
          <section className="rounded-2xl bg-[#e7f5f1] p-5">
            <p className="text-xs font-black text-[#347b69]">写作清单</p>
            <ol className="mt-3 list-decimal space-y-2 pl-4 text-xs leading-6">
              <li>时间词至少 1 个</li>
              <li>에서 场所至少 2 个</li>
              <li>을／를 宾语至少 2 个</li>
              <li>안 否定句 1 个</li>
            </ol>
          </section>
          <section className="rounded-2xl border border-[#cfe3d9] bg-white p-5">
            <p className="text-xs font-black">句子模板</p>
            <div className="mt-3 space-y-3 text-xs leading-6">
              <p>아침에 ______에서 ______.</p>
              <p>오후에 ______에서 ______을／를 ______.</p>
              <p>저녁에 ______에서 ______.</p>
              <p>오늘은 ______ 안 ______.</p>
            </div>
          </section>
        </div>
        <section className="mt-5 rounded-2xl border border-dashed border-[#77a997] bg-[#fbfdfc] p-5">
          <p className="text-xs font-black text-[#347b69]">创意升级 · 路线而不是句子堆</p>
          <p className="mt-2 text-xs leading-6">
            用 “그리고（然后／并且）” 连接两句，让读者感受到一天的移动：
            <b> 학교에서 공부해요. 그리고 도서관에서 책을 읽어요.</b>
          </p>
        </section>
        <div className="mt-auto flex items-center gap-3 rounded-xl bg-[#f7faf8] p-3 text-[11px] font-bold">
          <CheckCircle2 size={16} className="text-[#347b69]" />
          写完后只检查三件事：助词、안 的位置、动词是否在句尾。
        </div>
      </div>
    </Page>,
    <Page key="03-29" number="29">
      <KoreanEbookSectionDivider
        step="第八步"
        title="自测与复盘"
        goal="通过八题知识检测和一次口语验收，确认自己能够描述真实日常行动。"
        icon={<CheckCircle2 size={24} />}
      />
    </Page>,
    <Page key="03-30" number="30">
      <div className="flex h-full flex-col">
        <Heading
          title="1. 八题核心检测"
          description="先独立完成，再展开答案。每题都对应一个可解释的规则。"
          icon={<ClipboardCheck size={22} />}
          action={<KoreanEbookRevealButton shown={Boolean(revealed.test)} onClick={() => toggle("test")} answer />}
        />
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {[
            ["가다 的口语形", "가요"],
            ["공부하다 的口语形", "공부해요"],
            ["책(을／를) 읽어요", "책을 읽어요"],
            ["커피(을／를) 마셔요", "커피를 마셔요"],
            ["도서관(에／에서) 공부해요", "도서관에서 공부해요"],
            ["집(에／에서) 있어요", "집에 있어요"],
            ["운동하다 的否定", "운동 안 해요"],
            ["오늘 커피를 ___ 마셔요", "안"],
          ].map(([question, answer], index) => (
            <article key={question} className="rounded-xl border border-[#cfe3d4] bg-white p-3">
              <p className="text-[11px] font-black"><span className="mr-2 text-[#487a54]">{index + 1}.</span>{question}</p>
              <p className={`mt-2 rounded-lg bg-[#e8f4eb] px-3 py-2 text-[11px] font-black text-[#487a54] ${revealed.test ? "opacity-100" : "opacity-0"}`}>{answer}</p>
            </article>
          ))}
        </div>
        <p className="mt-auto text-center text-[11px] text-[#83948b]">7—8题：进入口语验收；6题以下：回看对应语法页并重做一题。</p>
      </div>
    </Page>,
    <Page key="03-31" number="31">
      <div className="flex h-full flex-col">
        <Heading title="2. 口语验收 · 我的一天" description="不看稿完成 40 秒表达，并回答一个追问。" icon={<Mic2 size={22} />} />
        <section className="mt-5 rounded-2xl border border-[#cfe3d4] bg-[#f2f8f3] p-5">
          <p className="text-xs font-black text-[#487a54]">必含信息</p>
          <ol className="mt-4 grid grid-cols-2 gap-3 text-xs leading-6">
            {[
              "一个现在正在做的动作",
              "两个不同的动作场所",
              "两个带 을／를 的动作对象",
              "一个使用 안 的否定句",
            ].map((task, index) => (
              <li key={task} className="rounded-xl bg-white p-4 font-bold">
                <span className="mr-2 text-[#487a54]">{index + 1}.</span>{task}
              </li>
            ))}
          </ol>
        </section>
        <div className="mt-5 grid grid-cols-2 gap-4">
          <section className="rounded-2xl border border-[#dce8e1] bg-white p-5">
            <p className="text-xs font-black">我已经能做到</p>
            <div className="mt-4 space-y-3 text-xs">
              {["根据元音选择 아／어요", "根据收音选择 을／를", "区分 에 与 에서", "正确放置 안"].map((item) => (
                <label key={item} className="flex items-center gap-3"><input type="checkbox" className="h-4 w-4 accent-[#487a54]" />{item}</label>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-[#eadfcf] bg-[#fffaf2] p-5">
            <p className="text-xs font-black text-[#9b6b32]">追问卡</p>
            <div className="mt-4 space-y-3 text-xs leading-5">
              <p>□ 어디에서 공부해요?</p>
              <p>□ 뭐를 먹어요?</p>
              <p>□ 오늘 운동해요?</p>
              <p>□ 주말에 뭐 해요?</p>
            </div>
          </section>
        </div>
        <button type="button" onClick={() => speak("저는 학교에서 한국어를 공부해요. 도서관에서 책을 읽어요. 오늘은 커피 안 마셔요.")} className="mt-auto flex items-center justify-center gap-2 rounded-2xl bg-[#487a54] px-5 py-4 text-sm font-black text-white">
          <Volume2 size={16} />播放最终示范
        </button>
      </div>
    </Page>,
    <Page key="03-32-ending" number="32">
      <div className="flex h-full flex-col justify-center">
        <div className="mx-auto w-full max-w-[440px] text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f4eb] text-[#487a54]"><Sparkles size={27} /></span>
          <p className="mt-5 text-xs font-black tracking-[0.18em] text-[#487a54]">LESSON 03 · COMPLETE</p>
          <h2 className="mt-3 text-4xl font-black text-[#1f2e28]">한국어를 공부해요.</h2>
          <p className="mt-3 text-lg font-black text-[#303432]">你已经完成第三课</p>
          <p className="mx-auto mt-3 max-w-[380px] text-sm leading-7 text-[#60736a]">
            你已经能把动作、对象、场所和否定组合起来，描述此刻与日常生活中的真实行动。
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-left">
            {[
              ["01", "日常敬语", "V／A-아／어요"],
              ["02", "标记对象", "N-을／를"],
              ["03", "动作场所", "场所 N-에서"],
              ["04", "简短否定", "안 + V／A"],
            ].map(([number, title, detail]) => (
              <div key={number} className="rounded-xl border border-[#dce8e1] bg-white px-4 py-3">
                <p className="text-[10px] font-black text-[#487a54]">{number}</p>
                <p className="mt-1 text-xs font-black text-[#294f43]">{title}</p>
                <p className="mt-1 text-[10px] leading-4 text-[#71857b]">{detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-[#cfe3d4] bg-[#f2f8f3] px-5 py-3.5 text-left">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black tracking-[0.14em] text-[#487a54]">LESSON 3 TEST · 本课测试</p>
                <p className="mt-1 text-xs font-bold text-[#52685e]">前往章节测试专区，检验词尾、助词、听辨与场景表达。</p>
              </div>
              <button type="button" onClick={() => window.location.assign("/dashboard/assignments/korean")} className="shrink-0 rounded-full bg-white px-3 py-2 text-[10px] font-black text-[#487a54] shadow-sm">前往测试专区</button>
            </div>
          </div>
          <div className="mt-5 rounded-2xl bg-[#eaf2fb] px-5 py-4 text-left">
            <p className="text-[10px] font-black tracking-[0.14em] text-[#3d6f9f]">NEXT · LESSON 04</p>
            <div className="mt-2 flex items-end justify-between gap-4">
              <div>
                <p className="text-lg font-black text-[#243d35]">어디에 있어요?</p>
                <p className="mt-1 text-[11px] text-[#60736a]">下一课：学习说明人物与物品的具体位置。</p>
              </div>
              <button type="button" onClick={() => flipBookRef.current?.pageFlip()?.flip(1)} className="shrink-0 rounded-full bg-white px-3 py-2 text-[10px] font-black text-[#3d6f9f] shadow-sm">返回目录</button>
            </div>
          </div>
          <p className="mt-3 text-xs font-bold text-[#6c7d74]">当你能说清“在哪里做什么”，韩语就开始拥有了行动。</p>
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
