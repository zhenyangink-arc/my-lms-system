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
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  Headphones,
  Map,
  MapPin,
  MessageCircle,
  Mic2,
  Navigation,
  NotebookPen,
  PencilLine,
  Search,
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

const LESSON_FOUR_TEMPLATE = buildKoreanEbookSectionMap([
  { step: "第一步", label: "课前导航", dividerPage: 2, contentPages: [3] },
  { step: "第二步", label: "核心词汇表", dividerPage: 4, contentPages: [5, 6, 7] },
  { step: "第三步", label: "语法讲解", dividerPage: 8, contentPages: [9, 10, 11, 12] },
  { step: "第四步", label: "句型操练", dividerPage: 13, contentPages: [14, 15, 16] },
  { step: "第五步", label: "实战对话", dividerPage: 17, contentPages: [18, 19, 20] },
  { step: "第六步", label: "听说任务", dividerPage: 21, contentPages: [22, 23, 24] },
  { step: "第七步", label: "读写拓展", dividerPage: 25, contentPages: [26, 27] },
  { step: "第八步", label: "自测与复盘", dividerPage: 28, contentPages: [29, 30] },
]);

const SectionStepContext = createContext("第八步");

function getSectionStep(number: string) {
  return LESSON_FOUR_TEMPLATE.pageMeta[number]?.tag ?? "第八步";
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
        LESSON_FOUR_TEMPLATE.headers[number] ??
        "第04课 · 어디에 있어요?"
      }
      cover={cover}
      sectionMeta={LESSON_FOUR_TEMPLATE.pageMeta[number]}
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
            <p className={`mt-1 text-[11px] font-bold text-[#71857b] ${showChinese ? "opacity-100" : "opacity-0"}`}>
              {line.chinese}
            </p>
          </div>
          <KoreanEbookSpeakButton text={line.korean} onSpeak={speak} />
        </div>
      ))}
    </div>
  );
}

const placeWords: VocabularyItem[] = [
  { korean: "교실", pronunciation: "교실", type: "场所名词", chinese: "教室" },
  { korean: "화장실", pronunciation: "화장실", type: "场所名词", chinese: "洗手间" },
  { korean: "사무실", pronunciation: "사무실", type: "场所名词", chinese: "办公室" },
  { korean: "휴게실", pronunciation: "휴게실", type: "场所名词", chinese: "休息室" },
  { korean: "병원", pronunciation: "병원", type: "场所名词", chinese: "医院" },
  { korean: "은행", pronunciation: "은행", type: "场所名词", chinese: "银行" },
  { korean: "우체국", pronunciation: "우체국", type: "场所名词", chinese: "邮局" },
  { korean: "약국", pronunciation: "약꾹", type: "场所名词", chinese: "药店" },
  { korean: "가게", pronunciation: "가게", type: "场所名词", chinese: "商店" },
  { korean: "편의점", pronunciation: "펴니점", type: "场所名词", chinese: "便利店" },
  { korean: "도서관", pronunciation: "도서관", type: "场所名词", chinese: "图书馆" },
  { korean: "식당", pronunciation: "식땅", type: "场所名词", chinese: "餐厅" },
  { korean: "학교", pronunciation: "학꾜", type: "场所名词", chinese: "学校" },
  { korean: "회사", pronunciation: "회사", type: "场所名词", chinese: "公司" },
  { korean: "카페", pronunciation: "카페", type: "场所名词", chinese: "咖啡厅" },
];

const anchorWords: VocabularyItem[] = [
  { korean: "선생님", pronunciation: "선생님", type: "人物名词", chinese: "老师" },
  { korean: "학생", pronunciation: "학쌩", type: "人物名词", chinese: "学生" },
  { korean: "사람", pronunciation: "사람", type: "人物名词", chinese: "人" },
  { korean: "우산", pronunciation: "우산", type: "名词", chinese: "雨伞" },
  { korean: "가방", pronunciation: "가방", type: "名词", chinese: "包" },
  { korean: "책", pronunciation: "책", type: "名词", chinese: "书" },
  { korean: "책상", pronunciation: "책쌍", type: "名词", chinese: "书桌" },
  { korean: "의자", pronunciation: "의자", type: "名词", chinese: "椅子" },
  { korean: "컴퓨터", pronunciation: "컴퓨터", type: "名词", chinese: "电脑" },
  { korean: "자동차", pronunciation: "자동차", type: "名词", chinese: "汽车" },
  { korean: "문", pronunciation: "문", type: "名词", chinese: "门" },
  { korean: "창문", pronunciation: "창문", type: "名词", chinese: "窗户" },
  { korean: "엘리베이터", pronunciation: "엘리베이터", type: "名词", chinese: "电梯" },
  { korean: "계단", pronunciation: "계단", type: "名词", chinese: "楼梯" },
  { korean: "입구", pronunciation: "입꾸", type: "名词", chinese: "入口" },
];

const positionWords: VocabularyItem[] = [
  { korean: "앞", pronunciation: "압", type: "方位名词", chinese: "前面" },
  { korean: "뒤", pronunciation: "뒤", type: "方位名词", chinese: "后面" },
  { korean: "옆", pronunciation: "엽", type: "方位名词", chinese: "旁边" },
  { korean: "위", pronunciation: "위", type: "方位名词", chinese: "上面" },
  { korean: "아래", pronunciation: "아래", type: "方位名词", chinese: "下面" },
  { korean: "밑", pronunciation: "믿", type: "方位名词", chinese: "底下" },
  { korean: "안", pronunciation: "안", type: "方位名词", chinese: "里面" },
  { korean: "밖", pronunciation: "박", type: "方位名词", chinese: "外面" },
  { korean: "여기", pronunciation: "여기", type: "指示代词", chinese: "这里" },
  { korean: "거기", pronunciation: "거기", type: "指示代词", chinese: "那里（近听者）" },
  { korean: "저기", pronunciation: "저기", type: "指示代词", chinese: "那里（远处）" },
  { korean: "오른쪽", pronunciation: "오른쪽", type: "方位名词", chinese: "右边" },
  { korean: "왼쪽", pronunciation: "왼쪽", type: "方位名词", chinese: "左边" },
  { korean: "근처", pronunciation: "근처", type: "方位名词", chinese: "附近" },
  { korean: "가운데", pronunciation: "가운데", type: "方位名词", chinese: "中间" },
];

export function KoreanLevelOneLessonFourBook({
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
    <Page key="04-01" number="01">
      <KoreanEbookTableOfContents
        lessonNumber={4}
        pageMeta={LESSON_FOUR_TEMPLATE.pageMeta}
        onNavigate={(page) => flipBookRef.current?.pageFlip()?.flip(page)}
        entries={[
          { step: "01", title: "课前导航", pageRange: "02—03", detail: "建立空间坐标" },
          { step: "02", title: "核心词汇表", pageRange: "04—07", detail: "场所·参照物·方位" },
          { step: "03", title: "语法讲解", pageRange: "08—12", detail: "四项位置语法" },
          { step: "04", title: "句型操练", pageRange: "13—16", detail: "助词与空间组装" },
          { step: "05", title: "实战对话", pageRange: "17—20", detail: "校园与街区问路" },
          { step: "06", title: "听说任务", pageRange: "21—24", detail: "听位置·说路线" },
          { step: "07", title: "读写拓展", pageRange: "25—27", detail: "读地图·写位置" },
          { step: "08", title: "自测与复盘", pageRange: "28—31", detail: "检测并完成本课" },
        ]}
      />
    </Page>,
    <Page key="04-02" number="02">
      <KoreanEbookSectionDivider
        step="第一步"
        title="课前导航"
        goal="建立“介绍地点—确认存在—表达移动—描述相对位置”的完整空间表达链。"
        icon={<Compass size={24} />}
      />
    </Page>,
    <Page key="04-03" number="03">
      <div className="flex h-full flex-col">
        <Heading
          title="从一个点，到一张地图"
          description="第四课不只是记方位词，而是学会选择正确的空间视角。"
          icon={<Map size={22} />}
          action={<KoreanEbookRevealButton shown={Boolean(revealed.chinese03)} onClick={() => toggle("chinese03")} />}
        />
        <div className="mt-5 grid grid-cols-2 gap-3">
          {[
            ["介绍当前位置", "여기가 교실이에요.", "这里是教室。"],
            ["说明人或物在哪", "선생님이 교실에 있어요.", "老师在教室。"],
            ["表达移动目的地", "우체국에 가요.", "去邮局。"],
            ["精确描述相对位置", "은행이 우체국 옆에 있어요.", "银行在邮局旁边。"],
          ].map(([title, korean, chinese], index) => (
            <button
              key={korean}
              type="button"
              onClick={() => speak(korean)}
              className="rounded-2xl border border-[#e1e8e4] bg-white p-4 text-left"
            >
              <p className="text-[10px] font-black text-[#bd741e]">0{index + 1} · {title}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-sm font-black">{korean}</p>
                <Volume2 size={14} className="shrink-0 text-[#8a6aa6]" />
              </div>
              <p className={`mt-1 text-[11px] font-bold text-[#71857b] ${revealed.chinese03 ? "opacity-100" : "opacity-0"}`}>{chinese}</p>
            </button>
          ))}
        </div>
        <section className="mt-5 rounded-2xl bg-[#fff4e7] p-5">
          <p className="text-xs font-black text-[#a26024]">三个空间问题</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <p className="rounded-xl bg-white p-3 text-xs font-black">여기가 어디예요?<span className="mt-1 block text-[10px] text-[#81938a]">这里是哪儿？</span></p>
            <p className="rounded-xl bg-white p-3 text-xs font-black">어디에 있어요?<span className="mt-1 block text-[10px] text-[#81938a]">在哪里？</span></p>
            <p className="rounded-xl bg-white p-3 text-xs font-black">어디에 가요?<span className="mt-1 block text-[10px] text-[#81938a]">去哪儿？</span></p>
          </div>
        </section>
        <p className="mt-auto rounded-xl bg-[#f7faf8] p-3 text-[11px] font-bold leading-5 text-[#60736a]">
          学习策略：先看句尾是“是、存在、移动还是动作”，再决定地点前用什么助词。
        </p>
      </div>
    </Page>,
    <Page key="04-04" number="04">
      <KoreanEbookSectionDivider
        step="第二步"
        title="核心词汇表"
        goal="用场所、参照物和方位词组成空间词块，点击卡片听读音。"
        icon={<Building2 size={24} />}
      />
    </Page>,
    <Page key="04-05" number="05">
      <div className="flex h-full flex-col">
        <Heading title="1. 场所与建筑" description="把建筑词和 에 가요／에 있어요 成对记忆。" icon={<Building2 size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.chinese05)} onClick={() => toggle("chinese05")} />} />
        <VocabularyGrid items={placeWords} speak={speak} showChinese={Boolean(revealed.chinese05)} />
        <p className="mt-auto rounded-xl bg-[#eef5fb] p-3 text-[11px] font-bold text-[#3d6f9f]">
          发音提示：학교 [학꾜]、식당 [식땅]、약국 [약꾹] 中会出现紧音化。
        </p>
      </div>
    </Page>,
    <Page key="04-06" number="06">
      <div className="flex h-full flex-col">
        <Heading title="2. 人物与定位参照物" description="描述位置时，需要先确定“谁／什么”以及作为参照的物体。" icon={<Search size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.chinese06)} onClick={() => toggle("chinese06")} />} />
        <VocabularyGrid items={anchorWords} speak={speak} showChinese={Boolean(revealed.chinese06)} />
        <p className="mt-auto rounded-xl bg-[#eef8f4] p-3 text-[11px] font-bold text-[#347b69]">
          词块：책상 위（桌上）／의자 아래（椅子下）／문 옆（门旁边）。
        </p>
      </div>
    </Page>,
    <Page key="04-07" number="07">
      <div className="flex h-full flex-col">
        <Heading title="3. 方位与指示词" description="方位词在韩语中按名词使用，后面通常接 에，再接 있어요。" icon={<Navigation size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.chinese07)} onClick={() => toggle("chinese07")} />} />
        <VocabularyGrid items={positionWords} speak={speak} showChinese={Boolean(revealed.chinese07)} />
        <div className="mt-auto grid grid-cols-3 gap-2 text-center text-[10px] font-black">
          <span className="rounded-xl bg-[#f1eafb] p-2 text-[#75559a]">책상 위에</span>
          <span className="rounded-xl bg-[#e7f5f1] p-2 text-[#347b69]">의자 아래에</span>
          <span className="rounded-xl bg-[#fff0df] p-2 text-[#b46624]">문 옆에</span>
        </div>
      </div>
    </Page>,
    <Page key="04-08" number="08">
      <KoreanEbookSectionDivider
        step="第三步"
        title="语法讲解"
        goal="每页解决一种空间关系，并用第三课的 에서 做对照，形成不会混淆的判断路径。"
        icon={<NotebookPen size={24} />}
      />
    </Page>,
    <Page key="04-09" number="09">
      <div className="flex h-full flex-col">
        <Heading
          title="1. 여기가 N이에요／예요"
          description="用于指着当前场所进行介绍，意思是“这里是……”。"
          icon={<NotebookPen size={22} />}
        />
        <section className="mt-4 rounded-2xl bg-[#f7f2fc] p-5 text-center">
          <p className="text-[11px] font-black text-[#75559a]">结构拆解</p>
          <p className="mt-3 text-lg font-black">여기 + 가 + N이에요／예요</p>
          <p className="mt-2 text-xs text-[#71857b]">这里 ＋ 主格助词 ＋ 是某场所</p>
        </section>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <NoteBox label="N 有收音 → 이에요" tone="blue">
            <RuleSentence text="여기가 교실이에요." speak={speak}>여기가 교실<b>이에요</b>.</RuleSentence>
            <span className="block text-[10px] text-[#71857b]">这里是教室。</span>
            <RuleSentence text="여기가 식당이에요." speak={speak}>여기가 식당<b>이에요</b>.</RuleSentence>
          </NoteBox>
          <NoteBox label="N 无收音 → 예요" tone="green">
            <RuleSentence text="여기가 학교예요." speak={speak}>여기가 학교<b>예요</b>.</RuleSentence>
            <span className="block text-[10px] text-[#71857b]">这里是学校。</span>
            <RuleSentence text="여기가 가게예요." speak={speak}>여기가 가게<b>예요</b>.</RuleSentence>
          </NoteBox>
        </div>
        <NoteBox label="여기는 与 여기가 的观察" tone="amber">
          本课先用 <b>여기가</b> 回答“这里是哪儿”，突出“这里”就是答案。여기는 带话题色彩，
          后续会逐渐体会；不要简单理解成一个对、一个错。
        </NoteBox>
        <p className="mt-auto rounded-xl border border-[#dce8e1] p-3 text-xs">
          <b className="text-[#75559a]">快速输出：</b>指着你所在的地方，说“여기가 ______이에요／예요.”
        </p>
      </div>
    </Page>,
    <Page key="04-10" number="10">
      <div className="flex h-full flex-col">
        <Heading
          title="2. N에 있어요／없어요"
          description="表示人或物在／不在某地点。存在主体通常用 이／가 标记。"
          icon={<MapPin size={22} />}
        />
        <section className="mt-4 rounded-2xl bg-[#f1f6fb] p-5 text-center">
          <p className="text-[11px] font-black text-[#3d6f9f]">存在句骨架</p>
          <p className="mt-3 text-lg font-black">人／物 + 이／가 + 场所 + 에 + 있어요／없어요</p>
          <p className="mt-3 text-sm font-black">선생님이 사무실에 있어요.</p>
        </section>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <NoteBox label="있어요 · 在／存在" tone="green">
            <RuleSentence text="책이 책상에 있어요." speak={speak}>책이 책상에 있어요.</RuleSentence>
            <span className="block text-[10px] text-[#71857b]">书在书桌那里。</span>
            <RuleSentence text="학생이 교실에 있어요." speak={speak}>학생이 교실에 있어요.</RuleSentence>
            <span className="block text-[10px] text-[#71857b]">学生在教室。</span>
          </NoteBox>
          <NoteBox label="없어요 · 不在／不存在" tone="rose">
            <RuleSentence text="우산이 집에 없어요." speak={speak}>우산이 집에 없어요.</RuleSentence>
            <span className="block text-[10px] text-[#71857b]">伞不在家。</span>
            <RuleSentence text="선생님이 사무실에 없어요." speak={speak}>선생님이 사무실에 없어요.</RuleSentence>
            <span className="block text-[10px] text-[#71857b]">老师不在办公室。</span>
          </NoteBox>
        </div>
        <NoteBox label="第二课知识升级" tone="purple">
          第二课“우산이 있어요”只说明有伞；本课加入“집에”，就能说明伞存在的地点。
          <b> 에</b> 像把存在钉在地图上的一个点。
        </NoteBox>
        <p className="mt-auto text-[11px] font-bold text-[#71857b]">
          问句：선생님이 어디에 있어요? 回答：사무실에 있어요.
        </p>
      </div>
    </Page>,
    <Page key="04-11" number="11">
      <div className="flex h-full flex-col">
        <Heading
          title="3. 场所 N에 가요／와요"
          description="-에 标记移动的目的地：从说话者所在位置判断“去”还是“来”。"
          icon={<Navigation size={22} />}
        />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <NoteBox label="가요 · 离开这里去那里" tone="blue">
            <RuleSentence text="은행에 가요." speak={speak}>은행<b>에 가요</b>.</RuleSentence>
            <span className="block text-[10px] text-[#71857b]">去银行。</span>
            <RuleSentence text="어디에 가요?" speak={speak}>어디<b>에 가요</b>?</RuleSentence>
            <span className="block text-[10px] text-[#71857b]">去哪里？</span>
          </NoteBox>
          <NoteBox label="와요 · 朝这里来" tone="green">
            <RuleSentence text="친구가 학교에 와요." speak={speak}>친구가 학교<b>에 와요</b>.</RuleSentence>
            <span className="block text-[10px] text-[#71857b]">朋友来学校。</span>
            <RuleSentence text="회사에 와요." speak={speak}>회사<b>에 와요</b>.</RuleSentence>
            <span className="block text-[10px] text-[#71857b]">来公司。</span>
          </NoteBox>
        </div>
        <section className="mt-3 rounded-2xl bg-[#fff8ed] p-5">
          <p className="text-xs font-black text-[#9b6b32]">视角比中文翻译更重要</p>
          <div className="mt-3 flex items-center justify-center gap-3 text-xs font-black">
            <span className="rounded-full bg-white px-4 py-2">我所在的位置</span>
            <span>← 와요</span>
            <span className="text-[#9b6b32]">移动的人</span>
            <span>가요 →</span>
            <span className="rounded-full bg-white px-4 py-2">其他地点</span>
          </div>
        </section>
        <NoteBox label="同一个 에，两种空间功能" tone="purple">
          집<b>에 있어요</b>：家是静止存在点；집<b>에 가요</b>：家是移动终点。
          判断依据不是 에 本身，而是句尾谓语。
        </NoteBox>
        <p className="mt-auto text-[11px] font-bold text-[#71857b]">
          注意：动作目的地说 학교에 가요，不说 학교에서 가요。
        </p>
      </div>
    </Page>,
    <Page key="04-12" number="12">
      <div className="flex h-full flex-col">
        <Heading
          title="4. N + 方位词 + 에"
          description="以一个名词为参照点，再用方位词精确说明人或物的位置。"
          icon={<Map size={22} />}
          action={<KoreanEbookRevealButton shown={Boolean(revealed.chinese12)} onClick={() => toggle("chinese12")} />}
        />
        <section className="mt-4 rounded-2xl bg-[#f7f2fc] p-5 text-center">
          <p className="text-[11px] font-black text-[#75559a]">完整结构</p>
          <p className="mt-3 text-lg font-black">存在主体 + 이／가 + 基准名词 + 方位词 + 에 + 있어요</p>
          <p className="mt-3 text-sm font-black">은행이 우체국 옆에 있어요.</p>
        </section>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-bold">
          {[
            ["책상 위에", "桌子上面"],
            ["의자 아래에", "椅子下面"],
            ["문 앞에", "门前"],
            ["학교 뒤에", "学校后面"],
            ["가방 안에", "包里面"],
            ["건물 밖에", "建筑外面"],
          ].map(([korean, chinese]) => (
            <div key={korean} className="rounded-xl border border-[#ddd0ee] bg-white p-3">
              <RuleSentence text={korean} speak={speak}><span className="font-black">{korean}</span></RuleSentence>
              <p className={`mt-1 text-[10px] text-[#81938a] ${revealed.chinese12 ? "opacity-100" : "opacity-0"}`}>{chinese}</p>
            </div>
          ))}
        </div>
        <NoteBox label="아래 与 밑" tone="amber">
          两者都可表示“下面”。아래 更中性、范围更广；밑 常让人感觉直接在某物底部或下方。
          初级位置句中二者经常可以替换。
        </NoteBox>
        <p className="mt-auto text-[11px] font-bold text-[#71857b]">
          易错点：基准名词后不加“的”。直接说 책상 위에，不说 책상의 위에。
        </p>
      </div>
    </Page>,
    <Page key="04-13" number="13">
      <KoreanEbookSectionDivider
        step="第四步"
        title="句型操练"
        goal="从判断句尾开始，选择 에／에서，再把方位关系组装成完整位置句。"
        icon={<PencilLine size={24} />}
      />
    </Page>,
    <Page key="04-14" number="14">
      <div className="flex h-full flex-col">
        <Heading
          title="1. 에 还是 에서？"
          description="先看句尾意义：存在与移动用 에，具体动作发生地用 에서。"
          icon={<ClipboardCheck size={22} />}
          action={<KoreanEbookRevealButton shown={Boolean(revealed.particles)} onClick={() => toggle("particles")} answer />}
        />
        <div className="mt-4 space-y-2.5">
          {[
            ["학교(에／에서) 가요.", "학교에 가요.", "移动目的地"],
            ["선생님이 교실(에／에서) 있어요.", "교실에 있어요.", "静止存在"],
            ["도서관(에／에서) 책을 읽어요.", "도서관에서 읽어요.", "动作发生地"],
            ["식당(에／에서) 밥을 먹어요.", "식당에서 먹어요.", "动作发生地"],
            ["우산이 가방(에／에서) 있어요.", "가방에 있어요.", "物品存在"],
            ["친구가 회사(에／에서) 와요.", "회사에 와요.", "移动终点"],
          ].map(([question, answer, reason], index) => (
            <div key={question} className="grid grid-cols-[28px_1.15fr_1fr] items-center gap-3 rounded-xl border border-[#ead8be] bg-white p-3">
              <span className="text-xs font-black text-[#b46624]">{index + 1}</span>
              <p className="text-xs font-black">{question}</p>
              <p className={`text-[11px] font-bold text-[#347b69] ${revealed.particles ? "opacity-100" : "opacity-0"}`}>
                {answer}<span className="ml-2 text-[#81938a]">· {reason}</span>
              </p>
            </div>
          ))}
        </div>
        <section className="mt-auto rounded-2xl bg-[#fff2df] p-4 text-xs leading-6">
          <b className="text-[#b46624]">死规律的准确版本：</b>
          가요／와요／있어요／없어요 前面的地点用 에；공부해요／먹어요／읽어요 等动作发生地用 에서。
        </section>
      </div>
    </Page>,
    <Page key="04-15" number="15">
      <div className="flex h-full flex-col">
        <Heading
          title="2. 谁在哪里？"
          description="根据线索完成存在句，注意存在主体的 이／가 和地点的 에。"
          icon={<Search size={22} />}
          action={<KoreanEbookRevealButton shown={Boolean(revealed.location)} onClick={() => toggle("location")} answer />}
        />
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            ["선생님 + 사무실", "선생님이 사무실에 있어요."],
            ["학생 + 교실", "학생이 교실에 있어요."],
            ["우산 + 집 + 不在", "우산이 집에 없어요."],
            ["책 + 가방里面", "책이 가방 안에 있어요."],
            ["자동차 + 建筑前", "자동차가 건물 앞에 있어요."],
            ["약국 + 银行旁边", "약국이 은행 옆에 있어요."],
          ].map(([clue, answer], index) => (
            <article key={clue} className="rounded-2xl border border-[#ead8be] bg-white p-4">
              <p className="text-[10px] font-black text-[#b46624]">MISSION {index + 1}</p>
              <p className="mt-2 text-xs font-black">{clue}</p>
              <p className={`mt-3 rounded-lg bg-[#fff8ed] p-2 text-[11px] font-black text-[#8b642f] ${revealed.location ? "opacity-100" : "opacity-0"}`}>{answer}</p>
            </article>
          ))}
        </div>
        <p className="mt-auto text-[11px] leading-5 text-[#71857b]">
          检查顺序：谁／什么 → 이／가 → 在哪里 → 에 → 있어요／없어요。
        </p>
      </div>
    </Page>,
    <Page key="04-16" number="16">
      <div className="flex h-full flex-col">
        <Heading title="3. 空间句组装台" description="把打乱的信息按“主体—参照点—方位—存在”重新组织。" icon={<PencilLine size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.assembly)} onClick={() => toggle("assembly")} answer />} />
        <div className="mt-4 space-y-3">
          {[
            [["책", "책상", "위", "있어요"], "책이 책상 위에 있어요."],
            [["가방", "의자", "아래", "있어요"], "가방이 의자 아래에 있어요."],
            [["화장실", "엘리베이터", "옆", "있어요"], "화장실이 엘리베이터 옆에 있어요."],
            [["선생님", "교실", "없어요"], "선생님이 교실에 없어요."],
          ].map(([parts, answer], index) => (
            <article key={answer as string} className="rounded-2xl border border-[#ead8be] bg-white p-4">
              <div className="flex flex-wrap gap-2">
                {(parts as string[]).map((part) => <span key={part} className="rounded-full bg-[#fff2df] px-3 py-1 text-[11px] font-black text-[#b46624]">{part}</span>)}
              </div>
              <p className={`mt-3 text-sm font-black ${revealed.assembly ? "opacity-100" : "opacity-0"}`}>{index + 1}. {answer as string}</p>
            </article>
          ))}
        </div>
        <NoteBox label="空间表达的两层结构" tone="amber">
          “책상 위”先组成“桌子上面”这个位置块，再在整个位置块后加 에：
          <b> [책상 위] + 에</b>。不要拆成 책상에 위。
        </NoteBox>
      </div>
    </Page>,
    <Page key="04-17" number="17">
      <KoreanEbookSectionDivider
        step="第五步"
        title="实战对话"
        goal="在校园、街区和室内寻物三个场景中完成问路、定位与确认。"
        icon={<MessageCircle size={24} />}
      />
    </Page>,
    <Page key="04-18" number="18">
      <div className="flex h-full flex-col">
        <Heading title="场景 1 · 初到学校" description="目标：介绍场所，并询问人物是否在某处。" icon={<Building2 size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.chinese18)} onClick={() => toggle("chinese18")} />} />
        <Dialogue
          speak={speak}
          showChinese={Boolean(revealed.chinese18)}
          lines={[
            { speaker: "A", korean: "여기가 어디예요?", chinese: "这里是哪儿？" },
            { speaker: "B", korean: "여기가 교실이에요.", chinese: "这里是教室。" },
            { speaker: "A", korean: "선생님이 교실에 있어요?", chinese: "老师在教室吗？" },
            { speaker: "B", korean: "아니요, 교실에 없어요. 사무실에 있어요.", chinese: "不，不在教室。在办公室。" },
          ]}
        />
        <NoteBox label="对话技巧：已知主体可以省略" tone="rose">
          第四句省略 선생님이，因为双方都知道在谈老师。省略重复信息能让口语更自然。
        </NoteBox>
        <p className="mt-auto rounded-xl border border-[#ead0d6] p-3 text-xs">
          替换任务：把 교실／사무실 换成 휴게실／식당，重新演练。
        </p>
      </div>
    </Page>,
    <Page key="04-19" number="19">
      <div className="flex h-full flex-col">
        <Heading title="场景 2 · 街区问路" description="目标：询问目的地，并用建筑之间的相对位置回答。" icon={<Navigation size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.chinese19)} onClick={() => toggle("chinese19")} />} />
        <Dialogue
          speak={speak}
          showChinese={Boolean(revealed.chinese19)}
          lines={[
            { speaker: "A", korean: "어디에 가요?", chinese: "去哪儿？" },
            { speaker: "B", korean: "우체국에 가요.", chinese: "去邮局。" },
            { speaker: "A", korean: "우체국이 어디에 있어요?", chinese: "邮局在哪里？" },
            { speaker: "B", korean: "은행 옆에 있어요.", chinese: "在银行旁边。" },
          ]}
        />
        <section className="mt-4 rounded-2xl bg-[#fbeaec] p-4">
          <p className="text-xs font-black text-[#a65b68]">街区替换卡</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-black">
            <span className="rounded-xl bg-white p-3">약국 ↔ 병원 옆</span>
            <span className="rounded-xl bg-white p-3">은행 ↔ 우체국 앞</span>
            <span className="rounded-xl bg-white p-3">편의점 ↔ 학교 뒤</span>
          </div>
        </section>
        <p className="mt-auto text-[11px] text-[#71857b]">回答中可省略已知的“우체국이”，直接说“은행 옆에 있어요.”</p>
      </div>
    </Page>,
    <Page key="04-20" number="20">
      <div className="flex h-full flex-col">
        <Heading title="场景 3 · 我的东西去哪了？" description="目标：用室内参照物精确寻找物品。" icon={<Search size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.chinese20)} onClick={() => toggle("chinese20")} />} />
        <Dialogue
          speak={speak}
          showChinese={Boolean(revealed.chinese20)}
          lines={[
            { speaker: "A", korean: "제 가방이 어디에 있어요?", chinese: "我的包在哪里？" },
            { speaker: "B", korean: "의자 아래에 있어요.", chinese: "在椅子下面。" },
            { speaker: "A", korean: "가방 안에 책이 있어요?", chinese: "包里有书吗？" },
            { speaker: "B", korean: "네, 책하고 우산이 있어요.", chinese: "有，有书和雨伞。" },
          ]}
        />
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            ["컴퓨터", "책상 위에"],
            ["우산", "문 옆에"],
            ["책", "가방 안에"],
          ].map(([item, place]) => (
            <button key={item} type="button" onClick={() => speak(`${item}가 ${place} 있어요.`)} className="rounded-xl border border-[#ead0d6] bg-white p-3 text-left">
              <p className="text-xs font-black text-[#a65b68]">{item}</p>
              <p className="mt-1 text-[11px] font-bold">{place} 있어요</p>
            </button>
          ))}
        </div>
        <p className="mt-auto rounded-xl bg-[#fff4f6] p-3 text-[11px] font-bold text-[#8d5b64]">
          创意挑战：闭眼让同伴移动一件物品，再用三个位置问题找到它。
        </p>
      </div>
    </Page>,
    <Page key="04-21" number="21">
      <KoreanEbookSectionDivider
        step="第六步"
        title="听说任务"
        goal="从句尾识别空间功能，再根据听到的方位关系还原简易地图。"
        icon={<Headphones size={24} />}
      />
    </Page>,
    <Page key="04-22" number="22">
      <div className="flex h-full flex-col">
        <Heading title="1. 听句尾，判断空间功能" description="先听最后一个谓语，再判断前面的地点是存在点、目的地还是动作舞台。" icon={<Headphones size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.listening)} onClick={() => toggle("listening")} answer />} />
        <div className="mt-4 space-y-3">
          {[
            ["학교에 가요.", "移动目的地", "에"],
            ["학교에 있어요.", "静止存在点", "에"],
            ["학교에서 공부해요.", "动作发生地", "에서"],
            ["친구가 학교에 와요.", "移动终点", "에"],
          ].map(([sentence, functionName, particle], index) => (
            <article key={sentence} className="rounded-2xl border border-[#cfdfeb] bg-white p-4">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => speak(sentence)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf4fa] text-[#3e7fa3]"><Volume2 size={16} /></button>
                <p className="flex-1 text-xs font-black">音频 {index + 1}</p>
                <p className={`text-[11px] font-black text-[#3e7fa3] ${revealed.listening ? "opacity-100" : "opacity-0"}`}>{functionName} · {particle}</p>
              </div>
            </article>
          ))}
        </div>
        <NoteBox label="听力捷径" tone="blue">
          听到 있어요／없어요 先找“在哪里”；听到 가요／와요 找“去哪儿／来哪儿”；
          听到具体动作动词，再检查是否用了 에서。
        </NoteBox>
      </div>
    </Page>,
    <Page key="04-23" number="23">
      <div className="flex h-full flex-col">
        <Heading title="2. 听位置，摆地图" description="准备三张建筑卡。播放句子后，按听到的关系摆放卡片。" icon={<Map size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.mapAnswer)} onClick={() => toggle("mapAnswer")} answer />} />
        <div className="mt-5 grid grid-cols-2 gap-4">
          {[
            ["은행이 우체국 옆에 있어요.", "银行｜邮局", "左右相邻"],
            ["약국이 병원 앞에 있어요.", "药店｜医院", "前后排列"],
            ["편의점이 학교 뒤에 있어요.", "便利店｜学校", "前后排列"],
            ["화장실이 계단 오른쪽에 있어요.", "洗手间｜楼梯", "左右排列"],
          ].map(([sentence, cards, relation], index) => (
            <button key={sentence} type="button" onClick={() => speak(sentence)} className="rounded-2xl border border-[#cfdfeb] bg-white p-4 text-left">
              <p className="text-[10px] font-black text-[#3e7fa3]">地图语音 {index + 1}</p>
              <p className="mt-2 text-xs font-black">{cards}</p>
              <p className={`mt-2 text-[10px] text-[#81938a] ${revealed.mapAnswer ? "opacity-100" : "opacity-0"}`}>摆放类型：{relation}</p>
            </button>
          ))}
        </div>
        <section className="mt-5 rounded-2xl bg-[#eaf4fa] p-5">
          <p className="text-xs font-black text-[#3e7fa3]">第二轮升级</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-6">
            <li>只听一次完成摆放。</li>
            <li>不看文字复述完整句。</li>
            <li>交换两个建筑的位置，自己说新句。</li>
          </ol>
        </section>
        <p className="mt-auto text-center text-[11px] font-bold text-[#71857b]">把声音转成空间画面，方位词才会真正变成直觉。</p>
      </div>
    </Page>,
    <Page key="04-24" number="24">
      <div className="flex h-full flex-col">
        <Heading title="3. 一分钟校园向导" description="从入口开始，介绍三个地点的位置，并回答同伴的追问。" icon={<Mic2 size={22} />} />
        <div className="mt-5 grid grid-cols-2 gap-4">
          <section className="rounded-2xl border border-[#cfdfeb] bg-white p-5">
            <p className="text-xs font-black text-[#3e7fa3]">表达脚手架</p>
            <div className="mt-4 space-y-3 text-xs leading-6">
              <p>① 여기가 학교 입구예요.</p>
              <p>② 교실이 ______에 있어요.</p>
              <p>③ 화장실이 ______ 옆에 있어요.</p>
              <p>④ 사무실에 선생님이 있어요.</p>
            </div>
          </section>
          <section className="rounded-2xl bg-[#eaf4fa] p-5">
            <p className="text-xs font-black text-[#3e7fa3]">同伴追问</p>
            <div className="mt-4 space-y-3 text-xs leading-6">
              <p>□ 여기가 어디예요?</p>
              <p>□ 화장실이 어디에 있어요?</p>
              <p>□ 선생님이 사무실에 있어요?</p>
              <p>□ 지금 어디에 가요?</p>
            </div>
          </section>
        </div>
        <NoteBox label="验收标准" tone="blue">
          至少使用：1 次 이에요／예요、2 次 에 있어요、1 次 에 가요，以及 2 个不同方位词。
        </NoteBox>
        <button type="button" onClick={() => speak("여기가 학교 입구예요. 교실이 사무실 옆에 있어요. 화장실이 계단 오른쪽에 있어요.")} className="mt-auto flex items-center justify-center gap-2 rounded-2xl bg-[#3e7fa3] p-3 text-xs font-black text-white"><Volume2 size={16} />播放向导示范</button>
      </div>
    </Page>,
    <Page key="04-25" number="25">
      <KoreanEbookSectionDivider
        step="第七步"
        title="读写拓展"
        goal="阅读楼层说明提取空间关系，再制作一张可供别人使用的中文—韩语位置卡。"
        icon={<BookOpenCheck size={24} />}
      />
    </Page>,
    <Page key="04-26" number="26">
      <div className="flex h-full flex-col">
        <Heading title="1. 阅读 · 우리 학교 1층" description="圈出建筑，给方位词画线，再把地点放到简易平面图中。" icon={<BookOpenCheck size={22} />} action={<KoreanEbookRevealButton shown={Boolean(revealed.reading)} onClick={() => toggle("reading")} answer />} />
        <section className="mt-5 rounded-2xl bg-[#eef8f4] p-5">
          <p className="text-sm font-black leading-8">
            여기가 우리 학교 1층이에요. 입구 앞에 안내 데스크가 있어요.
            사무실이 교실 옆에 있어요. 화장실은 계단 오른쪽에 있어요.
            휴게실이 사무실 뒤에 있어요. 선생님은 지금 사무실에 있어요.
          </p>
        </section>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            ["사무실", "교실 옆"],
            ["화장실", "계단 오른쪽"],
            ["휴게실", "사무실 뒤"],
            ["선생님", "사무실 안"],
          ].map(([target, location]) => (
            <div key={target} className={`flex items-center justify-between rounded-xl border border-[#cfe3d9] bg-white p-3 text-xs ${revealed.reading ? "opacity-100" : "opacity-0"}`}>
              <b>{target}</b><span className="font-bold text-[#347b69]">{location}</span>
            </div>
          ))}
        </div>
        <NoteBox label="阅读问题" tone="green">
          1. 사무실이 어디에 있어요?<br />
          2. 화장실이 계단 왼쪽에 있어요?<br />
          3. 선생님이 어디에 있어요?
        </NoteBox>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-[#e7f5f1] px-4 py-3 text-xs font-bold text-[#347b69]">
          <span>阅读顺序：圈目标地点 → 找参照物 → 标方位词 → 确认句尾 있어요。</span>
          <KoreanEbookSpeakButton text="화장실은 계단 오른쪽에 있어요." onSpeak={speak} compact />
        </div>
      </div>
    </Page>,
    <Page key="04-27" number="27">
      <div className="flex h-full flex-col">
        <Heading title="2. 写作 · 我的空间说明卡" description="选择一个真实空间，用五句话让没去过的人也能找到目标。" icon={<PencilLine size={22} />} />
        <div className="mt-5 grid grid-cols-[1fr_1.4fr] gap-4">
          <section className="rounded-2xl bg-[#e7f5f1] p-5">
            <p className="text-xs font-black text-[#347b69]">可以选择</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center text-[11px] font-black">
              {["我的教室", "学校一楼", "家附近", "常去的商店"].map((item) => <span key={item} className="rounded-xl bg-white p-3">{item}</span>)}
            </div>
          </section>
          <section className="rounded-2xl border border-[#cfe3d9] bg-white p-5">
            <p className="text-xs font-black">五句模板</p>
            <div className="mt-3 space-y-2 text-xs leading-6">
              <p>여기가 ______이에요／예요.</p>
              <p>______이／가 ______에 있어요.</p>
              <p>______이／가 ______ 옆에 있어요.</p>
              <p>______은／는 ______에 없어요.</p>
              <p>저는 지금 ______에 가요.</p>
            </div>
          </section>
        </div>
        <section className="mt-5 rounded-2xl border border-dashed border-[#77a997] bg-[#fbfdfc] p-5">
          <p className="text-xs font-black text-[#347b69]">创新要求</p>
          <p className="mt-2 text-xs leading-6">
            不要只列地点。选择一个“寻找任务”，例如“找到洗手间”或“找到我的书”，
            让每个位置句都推动任务向前。
          </p>
        </section>
        <p className="mt-auto rounded-xl bg-[#f7faf8] p-3 text-[11px] font-bold">检查：是否出现介绍、存在、方位、否定、移动五种信息？</p>
      </div>
    </Page>,
    <Page key="04-28" number="28">
      <KoreanEbookSectionDivider
        step="第八步"
        title="自测与复盘"
        goal="用十题检测空间助词和句型，再完成一次不看稿的位置说明。"
        icon={<CheckCircle2 size={24} />}
      />
    </Page>,
    <Page key="04-29" number="29">
      <div className="flex h-full flex-col">
        <Heading
          title="1. 十题核心检测"
          description="先回答，再展开答案；每个错误都要能说出对应判断依据。"
          icon={<ClipboardCheck size={22} />}
          action={<KoreanEbookRevealButton shown={Boolean(revealed.test)} onClick={() => toggle("test")} answer />}
        />
        <div className="mt-4 grid grid-cols-2 gap-2">
          {[
            ["这里是教室。", "여기가 교실이에요."],
            ["这里是学校。", "여기가 학교예요."],
            ["老师在办公室。", "선생님이 사무실에 있어요."],
            ["伞不在家。", "우산이 집에 없어요."],
            ["去邮局。", "우체국에 가요."],
            ["朋友来学校。", "친구가 학교에 와요."],
            ["书在桌上。", "책이 책상 위에 있어요."],
            ["包在椅子下。", "가방이 의자 아래에 있어요."],
            ["在学校学习。", "학교에서 공부해요."],
            ["学校里有人。", "학교에 사람이 있어요."],
          ].map(([question, answer], index) => (
            <article key={question} className="rounded-xl border border-[#cfe3d4] bg-white p-2.5">
              <p className="text-[11px] font-black"><span className="mr-2 text-[#487a54]">{index + 1}.</span>{question}</p>
              <p className={`mt-1.5 rounded-lg bg-[#e8f4eb] px-2 py-1.5 text-[10px] font-black text-[#487a54] ${revealed.test ? "opacity-100" : "opacity-0"}`}>{answer}</p>
            </article>
          ))}
        </div>
        <p className="mt-auto text-center text-[11px] text-[#83948b]">9—10题：进入口语验收；8题以下：回看第 09—12 页。</p>
      </div>
    </Page>,
    <Page key="04-30" number="30">
      <div className="flex h-full flex-col">
        <Heading title="2. 口语验收 · 看图定位" description="选一个空间，不看稿连续说 40 秒，并回答两次追问。" icon={<Mic2 size={22} />} />
        <section className="mt-5 rounded-2xl border border-[#cfe3d4] bg-[#f2f8f3] p-5">
          <p className="text-xs font-black text-[#487a54]">四个必达任务</p>
          <ol className="mt-4 grid grid-cols-2 gap-3 text-xs leading-6">
            {[
              "介绍当前位置是什么",
              "说明一个人或物在哪里",
              "说明自己要去哪里",
              "使用两个不同方位词",
            ].map((task, index) => (
              <li key={task} className="rounded-xl bg-white p-4 font-bold"><span className="mr-2 text-[#487a54]">{index + 1}.</span>{task}</li>
            ))}
          </ol>
        </section>
        <div className="mt-5 grid grid-cols-2 gap-4">
          <section className="rounded-2xl border border-[#dce8e1] bg-white p-5">
            <p className="text-xs font-black">语法自检</p>
            <div className="mt-4 space-y-3 text-xs">
              {["이에요／예요 选择正确", "存在和移动都用 에", "动作发生地使用 에서", "方位词后添加 에"].map((item) => (
                <label key={item} className="flex items-center gap-3"><input type="checkbox" className="h-4 w-4 accent-[#487a54]" />{item}</label>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-[#eadfcf] bg-[#fffaf2] p-5">
            <p className="text-xs font-black text-[#9b6b32]">追问卡</p>
            <div className="mt-4 space-y-3 text-xs leading-5">
              <p>□ 여기가 어디예요?</p>
              <p>□ ______이 어디에 있어요?</p>
              <p>□ 지금 어디에 가요?</p>
              <p>□ ______ 옆에 뭐가 있어요?</p>
            </div>
          </section>
        </div>
        <button type="button" onClick={() => speak("여기가 학교예요. 교실이 사무실 옆에 있어요. 선생님이 사무실에 있어요. 저는 지금 도서관에 가요.")} className="mt-auto flex items-center justify-center gap-2 rounded-2xl bg-[#487a54] p-4 text-sm font-black text-white"><Volume2 size={16} />播放最终示范</button>
      </div>
    </Page>,
    <Page key="04-31-ending" number="31">
      <div className="flex h-full flex-col justify-center">
        <div className="mx-auto w-full max-w-[440px] text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f4eb] text-[#487a54]"><Sparkles size={27} /></span>
          <p className="mt-4 text-xs font-black tracking-[0.18em] text-[#487a54]">LESSON 04 · COMPLETE</p>
          <h2 className="mt-3 text-4xl font-black text-[#1f2e28]">어디에 있어요?</h2>
          <p className="mt-3 text-lg font-black text-[#303432]">你已经完成第四课</p>
          <p className="mx-auto mt-3 max-w-[380px] text-sm leading-7 text-[#60736a]">
            你已经能介绍场所、确认人物和物品的位置、表达移动目的地，并使用方位词建立清楚的空间关系。
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-left">
            {[
              ["01", "介绍场所", "여기가 N이에요／예요"],
              ["02", "说明存在", "N에 있어요／없어요"],
              ["03", "表达移动", "N에 가요／와요"],
              ["04", "精确定位", "N + 方位词 + 에"],
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
                <p className="text-[10px] font-black tracking-[0.14em] text-[#487a54]">LESSON 4 TEST · 本课测试</p>
                <p className="mt-1 text-xs font-bold text-[#52685e]">前往章节测试专区，检验位置助词、方位听辨与地图表达。</p>
              </div>
              <button type="button" onClick={() => window.location.assign("/dashboard/assignments/korean")} className="shrink-0 rounded-full bg-white px-3 py-2 text-[10px] font-black text-[#487a54] shadow-sm">前往测试专区</button>
            </div>
          </div>
          <div className="mt-4 rounded-2xl bg-[#eaf2fb] px-5 py-3.5 text-left">
            <p className="text-[10px] font-black tracking-[0.14em] text-[#3d6f9f]">NEXT · LESSON 05</p>
            <div className="mt-2 flex items-end justify-between gap-4">
              <div>
                <p className="text-lg font-black text-[#243d35]">주말에 친구를 만났어요.</p>
                <p className="mt-1 text-[11px] text-[#60736a]">下一课：进入过去时，讲述已经发生的周末活动。</p>
              </div>
              <button type="button" onClick={() => flipBookRef.current?.pageFlip()?.flip(1)} className="shrink-0 rounded-full bg-white px-3 py-2 text-[10px] font-black text-[#3d6f9f] shadow-sm">返回目录</button>
            </div>
          </div>
          <p className="mt-1 text-[11px] font-bold text-[#6c7d74]">能说清“在哪里”，就能让韩语真正进入现实空间。</p>
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
