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
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Compass,
  Headphones,
  ListChecks,
  MessageCircle,
  Mic2,
  NotebookPen,
  PackageSearch,
  PencilLine,
  ShoppingBag,
  Sparkles,
  Volume2,
} from "lucide-react";

import {
  buildKoreanEbookSectionMap,
  getKoreanEbookVocabularyTone,
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
  children: React.ReactNode;
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

const SectionStepContext = createContext("第八步");

function getSectionStep(number: string) {
  return LESSON_TWO_TEMPLATE.pageMeta[number]?.tag ?? "第八步";
}

const LESSON_TWO_TEMPLATE = buildKoreanEbookSectionMap([
  { step: "第一步", label: "课前导航", dividerPage: 2, contentPages: [3] },
  { step: "第二步", label: "核心词汇表", dividerPage: 4, contentPages: [5, 6, 7] },
  { step: "第三步", label: "语法解说", dividerPage: 8, contentPages: [9, 10, 11, 12] },
  { step: "第四步", label: "句型操练", dividerPage: 13, contentPages: [14, 15, 16] },
  { step: "第五步", label: "实战对话", dividerPage: 17, contentPages: [18, 19, 20, 21] },
  { step: "第六步", label: "听说任务", dividerPage: 22, contentPages: [23, 24, 25] },
  { step: "第七步", label: "读写拓展", dividerPage: 26, contentPages: [27, 28] },
  { step: "第八步", label: "自测与复盘", dividerPage: 29, contentPages: [30, 31] },
]);

const Page = forwardRef<HTMLDivElement, PageProps>(function Page(
  { children, number, section, cover = false },
  ref
) {
  const label =
    section ?? LESSON_TWO_TEMPLATE.headers[number] ?? "第02课 · 이거는 뭐예요?";

  return (
    <KoreanEbookPage
      ref={ref}
      number={number}
      header={label}
      cover={cover}
      sectionMeta={LESSON_TWO_TEMPLATE.pageMeta[number]}
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
  icon: React.ReactNode;
  action?: React.ReactNode;
}) {
  const step = useContext(SectionStepContext);
  return (
    <KoreanEbookHeading
      step={step}
      title={title}
      description={description}
      icon={icon}
      action={action}
    />
  );
}

function Divider({
  step,
  title,
  goal,
  icon,
}: {
  step: string;
  title: string;
  goal: string;
  icon: React.ReactNode;
}) {
  return (
    <KoreanEbookSectionDivider
      step={step}
      title={title}
      goal={goal}
      icon={icon}
    />
  );
}

function SpeakButton({ text, speak }: { text: string; speak: Speak }) {
  return <KoreanEbookSpeakButton text={text} onSpeak={speak} />;
}

function RevealButton({
  shown,
  onClick,
  answer = false,
}: {
  shown: boolean;
  onClick: () => void;
  answer?: boolean;
}) {
  return <KoreanEbookRevealButton shown={shown} onClick={onClick} answer={answer} />;
}

function getVocabularyTypeTone(type: string) {
  return getKoreanEbookVocabularyTone(type);
}

function VocabGrid({
  items,
  showMeaning,
  speak,
}: {
  items: Array<[string, string, string]>;
  showMeaning: boolean;
  speak: Speak;
}) {
  return (
    <div
      className={`mt-5 grid grid-cols-3 gap-2.5 ${
        showMeaning ? "" : "[&_[data-vocab-meaning]]:opacity-0"
      }`}
    >
      {items.map(([korean, chinese, type]) => (
        <KoreanEbookVocabularyCard
          key={korean}
          korean={korean}
          type={type}
          chinese={chinese}
          onSpeak={speak}
        />
      ))}
    </div>
  );
}

function Dialogue({
  lines,
  speak,
  showMeaning,
}: {
  lines: Array<[string, string, string]>;
  speak: Speak;
  showMeaning: boolean;
}) {
  return (
    <div className="mt-4 space-y-2">
      {lines.map(([speaker, korean, chinese], index) => (
        <article
          key={`${speaker}-${korean}`}
          className={`flex gap-3 rounded-2xl border px-4 py-2.5 ${
            index % 2 === 0
              ? "border-[var(--border)] bg-[var(--status-success-surface)]"
              : "border-[var(--border)] bg-[var(--card)]"
          }`}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white text-[11px] font-bold text-[var(--foreground-secondary)]">
            {speaker}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[13px] font-bold leading-5 text-[var(--status-success)]">
                {korean}
              </p>
              <SpeakButton text={korean} speak={speak} />
            </div>
            <p
              className={`mt-0.5 text-[10px] leading-4 text-[var(--foreground-secondary)] transition ${
                showMeaning ? "opacity-100" : "opacity-0"
              }`}
            >
              {chinese}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}

function PatternBox({
  pattern,
  meaning,
  examples,
  speak,
  compact = false,
}: {
  pattern: string;
  meaning: string;
  examples: Array<[string, string]>;
  speak: Speak;
  compact?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border border-[var(--border)] bg-[var(--card)] ${
        compact ? "p-4" : "p-5"
      }`}
    >
      <p className="text-xs font-bold text-[var(--primary)]">核心结构</p>
      <h4 className="mt-2 text-xl font-bold text-[var(--primary)]">{pattern}</h4>
      <p className="mt-2 text-xs leading-6 text-[var(--foreground-secondary)]">{meaning}</p>
      <div className={`${compact ? "mt-3" : "mt-4"} space-y-2`}>
        {examples.map(([korean, chinese]) => (
          <button
            key={korean}
            type="button"
            onClick={() => speak(korean)}
            className={`flex w-full items-center justify-between rounded-xl bg-white px-4 text-left ${
              compact ? "py-2" : "py-3"
            }`}
          >
            <span>
              <span className="block text-sm font-bold text-[var(--primary)]">
                {korean}
              </span>
              <span className="mt-1 block text-[11px] text-[var(--foreground-secondary)]">
                {chinese}
              </span>
            </span>
            <Volume2 aria-hidden="true" className="text-[var(--primary)]" size={15} />
          </button>
        ))}
      </div>
    </section>
  );
}

export function KoreanLevelOneLessonTwoBook({
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
    <Page key="02-01" number="01">
      <KoreanEbookTableOfContents
        lessonNumber={2}
        pageMeta={LESSON_TWO_TEMPLATE.pageMeta}
        onNavigate={(page) => flipBookRef.current?.pageFlip()?.flip(page)}
        entries={[
          { step: "01", title: "课前导航", pageRange: "02—03" },
          { step: "02", title: "核心词汇表", pageRange: "04—07" },
          {
            step: "03",
            title: "语法解说",
            pageRange: "08—12",
            detail: "N이／가 있어요(없어요)、指示物问答、N 주세요、名词连接",
          },
          { step: "04", title: "句型操练", pageRange: "13—16" },
          { step: "05", title: "实战对话", pageRange: "17—21" },
          { step: "06", title: "听说任务", pageRange: "22—25" },
          { step: "07", title: "读写拓展", pageRange: "26—28" },
          { step: "08", title: "自测与复盘", pageRange: "29—31" },
        ]}
      />
    </Page>,
    <Page key="02-02" number="02">
      <Divider
        step="第一步"
        title="课前导航"
        goal="从真实距离和使用场景出发，学会询问物品名称、说明手边有什么，并完成一次简单购买。"
        icon={<Compass aria-hidden="true" size={24} />}
      />
    </Page>,
    <Page key="02-03" number="03">
      <div className="flex h-full flex-col">
        <Heading
          title="1. 看见东西时，先会问、再会拿"
          description="这一课不从背单词开始，而是从教室和小商店中的四个连续动作开始。"
          icon={<Compass aria-hidden="true" size={22} />}
        />
        <section className="mt-5 grid grid-cols-[1.15fr_0.85fr] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--status-success-surface)]">
          <div className="px-5 py-4">
            <p className="text-[11px] font-bold tracking-[0.12em] text-[var(--status-success)]">
              本课交际任务
            </p>
            <h4 className="mt-2 text-base font-bold">
              找到需要的学习用品并礼貌提出请求
            </h4>
            <p className="mt-2 text-[11px] leading-5 text-[var(--foreground-secondary)]">
              场景：新生体验课前，你在服务台确认物品并领取课堂用品。
            </p>
          </div>
          <div className="border-l border-[var(--border)] bg-[var(--card)] px-5 py-4">
            <p className="text-[11px] font-bold text-[var(--status-warning)]">完成标准</p>
            <p className="mt-2 text-xs font-bold leading-5 text-[var(--status-warning)]">
              能根据远近选择指示词，并完成“询问—确认—请求—回应”。
            </p>
          </div>
        </section>
        <div className="mt-5 grid grid-cols-4 gap-3">
          {[
            ["01", "指给对方", "区分我这里、你那里和远处。"],
            ["02", "问清名称", "不会说时用 뭐예요? 提问。"],
            ["03", "说明有无", "表达手边有没有某件物品。"],
            ["04", "礼貌请求", "用 주세요 领取或购买物品。"],
          ].map(([number, title, text]) => (
            <article
              key={number}
              className="rounded-2xl border border-[var(--border)] bg-white p-4"
            >
              <span className="text-xs font-bold text-[var(--status-warning)]">
                {number}
              </span>
              <h4 className="mt-2 text-sm font-bold">{title}</h4>
              <p className="mt-2 text-[11px] leading-5 text-[var(--foreground-secondary)]">
                {text}
              </p>
            </article>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <section className="rounded-2xl bg-[var(--status-success-surface)] p-5">
            <p className="text-xs font-bold text-[var(--status-success)]">语言工具</p>
            <div className="mt-3 space-y-1.5 text-xs leading-5">
              <p><strong>N이／가 있어요(없어요)</strong>　说明物品有无</p>
              <p><strong>이거는／그거는／저거는 N이에요／예요</strong>　指物并说明名称</p>
              <p><strong>N 주세요</strong>　礼貌提出请求</p>
              <p><strong>N하고 N／N과／와 N</strong>　连接两个名词</p>
            </div>
          </section>
          <section className="rounded-2xl bg-[var(--status-warning-surface)] p-5">
            <p className="text-xs font-bold text-[var(--status-warning)]">对话路线</p>
            <p className="mt-3 text-xs font-bold leading-6">
              指物 → 问名称 → 确认有无 → 提出请求
            </p>
          </section>
        </div>
      </div>
    </Page>,
    <Page key="02-04" number="04">
      <Divider
        step="第二步"
        title="核心词汇表"
        goal="先掌握教室物品、随身物品和商店表达，再把它们放进完整句子中。"
        icon={<ListChecks aria-hidden="true" size={24} />}
      />
    </Page>,
    <Page key="02-05" number="05">
      <div className="flex h-full flex-col">
        <Heading
          title="1. 教室里常见的东西"
          description="点击喇叭听读；先看韩语猜意思，再显示中文核对。"
          icon={<Sparkles aria-hidden="true" size={22} />}
          action={
            <RevealButton
              shown={Boolean(revealed.vocab1)}
              onClick={() => toggle("vocab1")}
            />
          }
        />
        <VocabGrid
          showMeaning={Boolean(revealed.vocab1)}
          speak={speak}
          items={[
            ["책", "书", "名词"],
            ["공책", "笔记本", "名词"],
            ["연필", "铅笔", "名词"],
            ["지우개", "橡皮", "名词"],
            ["펜", "笔", "名词"],
            ["가방", "包", "名词"],
            ["사전", "词典", "名词"],
            ["책상", "书桌", "名词"],
            ["의자", "椅子", "名词"],
            ["칠판", "黑板", "名词"],
            ["종이", "纸", "名词"],
            ["교과서", "教材", "名词"],
          ]}
        />
        <p className="mt-auto rounded-2xl bg-[var(--status-success-surface)] px-5 py-3 text-xs leading-6">
          记忆动作：边指真实物品边说“이 책、이 공책、이 연필”，让词和位置一起进入记忆。
        </p>
      </div>
    </Page>,
    <Page key="02-06" number="06">
      <div className="flex h-full flex-col">
        <Heading
          title="2. 随身物品与生活用品"
          description="这些词可以直接用于“这是什么”和“我有／没有”的练习。"
          icon={<PackageSearch aria-hidden="true" size={22} />}
          action={
            <RevealButton
              shown={Boolean(revealed.vocab2)}
              onClick={() => toggle("vocab2")}
            />
          }
        />
        <VocabGrid
          showMeaning={Boolean(revealed.vocab2)}
          speak={speak}
          items={[
            ["휴대폰", "手机", "名词"],
            ["컴퓨터", "电脑", "名词"],
            ["시계", "钟表、手表", "名词"],
            ["안경", "眼镜", "名词"],
            ["우산", "雨伞", "名词"],
            ["열쇠", "钥匙", "名词"],
            ["카드", "卡片", "名词"],
            ["지갑", "钱包", "名词"],
            ["물", "水", "名词"],
            ["컵", "杯子", "名词"],
            ["신문", "报纸", "名词"],
            ["지도", "地图", "名词"],
          ]}
        />
        <div className="mt-auto grid grid-cols-2 gap-3 text-xs">
          <p className="rounded-2xl bg-[var(--accent)] p-4">
            <strong>发音留意：</strong> 휴대폰 连续读，不要逐个字母停顿。
          </p>
          <p className="rounded-2xl bg-[var(--status-warning-surface)] p-4">
            <strong>分类记忆：</strong> 放进包里的、放在桌上的、出门会带的。
          </p>
        </div>
      </div>
    </Page>,
    <Page key="02-07" number="07">
      <div className="flex h-full flex-col">
        <Heading
          title="3. 指物、询问与请求表达"
          description="这些不是孤立单词，而是可以立即拿来完成对话的工具。"
          icon={<ShoppingBag aria-hidden="true" size={22} />}
          action={
            <RevealButton
              shown={Boolean(revealed.vocab3)}
              onClick={() => toggle("vocab3")}
            />
          }
        />
        <div className="mt-5 grid grid-cols-2 gap-3">
          {[
            ["이거", "这个（靠近说话人）", "代词"],
            ["그거", "那个（靠近听话人／刚提到）", "代词"],
            ["저거", "那个（离双方都远）", "代词"],
            ["뭐", "什么", "代词"],
            ["여기", "这里", "副词"],
            ["거기", "那里（靠近对方）", "副词"],
            ["저기", "那边（远处）", "副词"],
            ["있어요", "有、在", "形容词"],
            ["없어요", "没有、不在", "形容词"],
            ["주세요", "请给我", "动词·表达"],
            ["맞아요", "对，是的", "形容词"],
            ["아니에요", "不是", "固定表达"],
          ].map(([korean, chinese, type]) => (
            <button
              key={korean}
              type="button"
              onClick={() => speak(korean)}
              className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-left"
            >
              <span className="min-w-0">
                <span className="text-sm font-bold">{korean}</span>
                <span
                  className={`ml-3 text-[11px] text-[var(--foreground-secondary)] transition ${
                    revealed.vocab3 ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {chinese}
                </span>
              </span>
              <span className="ml-2 flex shrink-0 items-center gap-1">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full ${getVocabularyTypeTone(type)}`}
                >
                  <Volume2 aria-hidden="true" size={11} />
                </span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${getVocabularyTypeTone(type)}`}
                >
                  {type}
                </span>
              </span>
            </button>
          ))}
        </div>
        <div className="mt-auto rounded-2xl bg-[var(--status-warning-surface)] p-4 text-xs leading-6">
          礼貌提示：向店员或不熟悉的人提出请求时，物品后接 주세요，声音平稳、句尾不要太急。
        </div>
      </div>
    </Page>,
    <Page key="02-08" number="08">
      <Divider
        step="第三步"
        title="语法解说"
        goal="掌握有无表达、指物说明、礼貌请求和名词连接四项核心语法，并把它们组合成完整交流。"
        icon={<BookOpenCheck aria-hidden="true" size={24} />}
      />
    </Page>,
    <Page key="02-09" number="09">
      <div className="flex h-full flex-col">
        <Heading
          title="1. N이／가 있어요(없어요)"
          description="用 이／가 标出存在或不存在的物品；名词有收音接 이，无收音接 가。"
          icon={<BookOpenCheck aria-hidden="true" size={22} />}
        />
        <div className="mt-5 grid grid-cols-2 gap-4">
          <PatternBox
            compact
            pattern="N이／가 있어요"
            meaning="表示“有……”或“某物在”。有收音的名词接 이，无收音的名词接 가。"
            speak={speak}
            examples={[
              ["연필이 있어요.", "有铅笔。"],
              ["지우개가 있어요.", "有橡皮。"],
              ["우산이 있어요?", "有雨伞吗？"],
            ]}
          />
          <PatternBox
            compact
            pattern="N이／가 없어요"
            meaning="表示“没有……”或“某物不在”。助词选择与 있어요 完全相同。"
            speak={speak}
            examples={[
              ["연필이 없어요.", "没有铅笔。"],
              ["지우개가 없어요.", "没有橡皮。"],
              ["우산이 없어요?", "没有雨伞吗？"],
            ]}
          />
        </div>
        <section className="mt-5 rounded-2xl border border-[var(--border)] bg-white p-4">
          <p className="text-xs font-bold text-[var(--primary)]">先看收音，再选择助词</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-center">
            {[
              ["책 + 이 → 책이", "책 有收音"],
              ["의자 + 가 → 의자가", "의자 无收音"],
            ].map(([form, rule]) => (
              <div key={form} className="rounded-xl bg-[var(--card)] px-3 py-3">
                <span className="block text-sm font-bold">{form}</span>
                <span className="mt-1 block text-[11px] text-[var(--foreground-secondary)]">{rule}</span>
              </div>
            ))}
          </div>
        </section>
        <div className="mt-4 grid grid-cols-2 gap-3 text-[11px] leading-5">
          <p className="rounded-xl bg-[var(--status-warning-surface)] p-3">
            <strong className="text-[var(--status-warning)]">使用注意：</strong>
            있어요／없어요 既可表示“有／没有”，也可按场景表示“在／不在”。
          </p>
          <p className="rounded-xl bg-[var(--status-warning-surface)] p-3">
            <strong className="text-[var(--destructive)]">常见错误：</strong>
            标准形式是 없어요，不是 없으요；이／가 只根据前面名词的收音选择。
          </p>
        </div>
        <p className="mt-auto text-center text-[11px] text-[var(--foreground-secondary)]">
          回答时可以省略已经明确的名词：네, 있어요.／아니요, 없어요.
        </p>
      </div>
    </Page>,
    <Page key="02-10" number="10">
      <div className="flex h-full flex-col">
        <Heading
          title="2. 이거는(그거는, 저거는) N이에요／예요"
          description="根据物品与说话双方的距离选择 이거、그거、저거，再用 이에요／예요说明名称。"
          icon={<MessageCircle aria-hidden="true" size={22} />}
        />
        <div className="mt-5 grid grid-cols-2 gap-4">
          <PatternBox
            compact
            pattern="이거는／그거는／저거는"
            meaning="이거 靠近说话人，그거 靠近听话人或刚刚提到，저거 离双方都较远。"
            speak={speak}
            examples={[
              ["이거는 뭐예요?", "这是什么？"],
              ["그거는 뭐예요?", "你那边那个是什么？"],
              ["저거는 뭐예요?", "远处那个是什么？"],
            ]}
          />
          <PatternBox
            compact
            pattern="N이에요／예요"
            meaning="有收音的名词接 이에요，无收音的名词接 예요；完整回答时接在物品名称后。"
            speak={speak}
            examples={[
              ["이거는 책이에요.", "这是书。"],
              ["그거는 시계예요.", "那个是钟表。"],
              ["저거는 우산이에요.", "远处那个是雨伞。"],
            ]}
          />
        </div>
        <div className="mt-5 rounded-2xl bg-[var(--status-warning-surface)] p-5">
          <p className="text-xs font-bold text-[var(--status-warning)]">对话节奏</p>
          <button
            type="button"
            onClick={() => speak("이거는 뭐예요? 이거는 공책이에요.")}
            className="mt-3 flex w-full items-center justify-between rounded-xl bg-white px-4 py-4 text-left"
          >
            <span className="text-base font-bold">
              이거는 뭐예요?　—　이거는 공책이에요.
            </span>
            <Volume2 aria-hidden="true" size={16} />
          </button>
          <p className="mt-3 text-[11px] leading-5 text-[var(--status-warning)]">
            问句句尾自然上扬，回答句尾稳定下降。先模仿语调，再关注助词。
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-3 text-[11px] leading-5">
            <p>
              <strong>使用注意：</strong>回答时可以只说“공책이에요”；需要强调所指物时再保留 이거는。
            </p>
            <p>
              <strong>常见错误：</strong>有收音说 책이에요，无收音说 시계예요，不能互换。
            </p>
          </div>
        </div>
      </div>
    </Page>,
    <Page key="02-11" number="11">
      <div className="flex h-full flex-col">
        <Heading
          title="3. N 주세요"
          description="在商店、服务台或课堂上，直接把需要的物品放在 주세요 前面，礼貌地表达“请给我……”。"
          icon={<ShoppingBag aria-hidden="true" size={22} />}
        />
        <section className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <p className="text-xs font-bold text-[var(--primary)]">核心结构</p>
          <div className="mt-3 flex items-center justify-center gap-3 text-center">
            <span className="rounded-xl bg-white px-5 py-3 text-lg font-bold">需要的物品 N</span>
            <span className="font-bold text-[var(--primary)]">＋</span>
            <span className="rounded-xl bg-white px-5 py-3 text-lg font-bold">주세요</span>
          </div>
          <p className="mt-3 text-center text-[11px] leading-5 text-[var(--foreground-secondary)]">
            주세요 来自 주다“给”，这里先作为完整的礼貌请求形式记忆。
          </p>
        </section>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            ["공책 주세요.", "请给我笔记本。"],
            ["물 주세요.", "请给我水。"],
            ["이거 주세요.", "请给我这个。"],
          ].map(([korean, chinese]) => (
            <button
              key={korean}
              type="button"
              onClick={() => speak(korean)}
              className="rounded-2xl border border-[var(--border)] bg-white p-4 text-left"
            >
              <span className="block text-sm font-bold">{korean}</span>
              <span className="mt-2 block text-[11px] text-[var(--foreground-secondary)]">{chinese}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs leading-5">
          <section className="rounded-2xl bg-[var(--status-warning-surface)] p-4">
            <p className="font-bold text-[var(--status-warning)]">使用注意</p>
            <p className="mt-2">购买或领取物品时，初级阶段直接说“N 주세요”最自然；语气保持平稳，不要读成命令。</p>
          </section>
          <section className="rounded-2xl bg-[var(--status-warning-surface)] p-4">
            <p className="font-bold text-[var(--destructive)]">不要混淆</p>
            <p className="mt-2"><strong>N이／가 있어요?</strong> 是询问“有没有”；<strong>N 주세요.</strong> 才是提出“请给我”的请求。</p>
          </section>
        </div>
        <section className="mt-auto rounded-2xl border border-[var(--border)] bg-white p-4">
          <p className="text-xs font-bold text-[var(--status-success)]">完整交流</p>
          <button
            type="button"
            onClick={() => speak("공책이 있어요? 네, 있어요. 공책 주세요. 네, 여기 있어요.")}
            className="mt-2 w-full rounded-xl bg-[var(--status-success-surface)] px-4 py-2.5 text-left"
          >
            <p className="text-[13px] font-bold leading-6">공책이 있어요? → 네, 있어요. → 공책 주세요. → 네, 여기 있어요.</p>
          </button>
        </section>
      </div>
    </Page>,
    <Page key="02-12" number="12">
      <div className="flex h-full flex-col">
        <Heading
          title="4. N하고 N, N과／와 N"
          description="三个形式都表示名词之间的“和”；하고 更常用于日常口语，과／와 更常见于书面或较正式表达。"
          icon={<ListChecks aria-hidden="true" size={22} />}
        />
        <section className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <p className="text-xs font-bold text-[var(--primary)]">接续规则</p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {[
              ["N하고 N", "不看收音，任何名词后都可以接 하고", "공책하고 연필"],
              ["N과 N", "前一个名词有收音时接 과", "책과 공책"],
              ["N와 N", "前一个名词无收音时接 와", "의자와 책상"],
            ].map(([form, rule, example]) => (
              <button
                key={form}
                type="button"
                onClick={() => speak(example)}
                className="rounded-2xl bg-white p-4 text-left"
              >
                <span className="block text-base font-bold text-[var(--primary)]">{form}</span>
                <span className="mt-2 block text-[11px] leading-5 text-[var(--foreground-secondary)]">{rule}</span>
                <span className="mt-3 block rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-bold">{example}</span>
              </button>
            ))}
          </div>
        </section>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs leading-5">
          <section className="rounded-2xl bg-[var(--status-success-surface)] p-4">
            <p className="font-bold text-[var(--status-success)]">如何选择</p>
            <p className="mt-2">日常对话优先使用 하고；需要较正式或书面的表达时，再根据前一个名词有没有收音选择 과／와。</p>
          </section>
          <section className="rounded-2xl bg-[var(--status-warning-surface)] p-4">
            <p className="font-bold text-[var(--destructive)]">常见错误</p>
            <p className="mt-2">判断 과／와 时只看它前面的名词：책有收音，所以是 책과；의자无收音，所以是 의자와。</p>
          </section>
        </div>
        <section className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-4">
          <p className="text-xs font-bold text-[var(--status-success)]">放进请求句</p>
          <button
            type="button"
            onClick={() => speak("공책하고 연필 주세요. 책과 공책이 있어요.")}
            className="mt-2 w-full rounded-xl bg-[var(--status-success-surface)] px-4 py-3 text-left"
          >
            <p className="text-sm font-bold">공책하고 연필 주세요.</p>
            <p className="mt-1 text-[11px] text-[var(--foreground-secondary)]">请给我笔记本和铅笔。</p>
          </button>
        </section>
        <p className="mt-auto text-center text-[11px] text-[var(--foreground-secondary)]">
          注意：하고／과／와 连接的是并列名词，不表示物品“有／没有”。
        </p>
      </div>
    </Page>,
    <Page key="02-13" number="13">
      <Divider
        step="第四步"
        title="句型操练"
        goal="通过距离判断、助词选择和信息转换，把规则变成不假思索的口头反应。"
        icon={<NotebookPen aria-hidden="true" size={24} />}
      />
    </Page>,
    <Page key="02-14" number="14">
      <div className="flex h-full flex-col">
        <Heading
          title="1. 距离反应训练"
          description="先读场景，再选择 이、그、저；完成后点击答案核对。"
          icon={<Compass aria-hidden="true" size={22} />}
          action={
            <RevealButton
              shown={Boolean(revealed.practice1)}
              onClick={() => toggle("practice1")}
              answer
            />
          }
        />
        <div className="mt-4 space-y-2">
          {[
            ["书在我手里：___ 책", "이 책"],
            ["包在你椅子旁：___ 가방", "그 가방"],
            ["钟挂在远处墙上：___ 시계", "저 시계"],
            ["刚才提到的手机：___ 휴대폰", "그 휴대폰"],
            ["我桌上的杯子：___ 컵", "이 컵"],
            ["走廊尽头的雨伞：___ 우산", "저 우산"],
          ].map(([prompt, answer], index) => (
            <article
              key={prompt}
              className="grid grid-cols-[36px_1fr_150px] items-center gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 py-3"
            >
              <span className="text-xs font-bold text-[var(--status-warning)]">
                {index + 1}
              </span>
              <p className="text-sm font-bold">{prompt}</p>
              <p
                className={`rounded-xl bg-[var(--status-warning-surface)] px-3 py-2 text-center text-xs font-bold text-[var(--status-warning)] transition ${
                  revealed.practice1 ? "opacity-100" : "opacity-0"
                }`}
              >
                {answer}
              </p>
            </article>
          ))}
        </div>
        <p className="mt-auto rounded-2xl bg-[var(--status-warning-surface)] p-4 text-xs leading-6">
          口头加练：把每个答案扩展成“___는 뭐예요?”，再自己回答物品名称。
        </p>
      </div>
    </Page>,
    <Page key="02-15" number="15">
      <div className="flex h-full flex-col">
        <Heading
          title="2. 选择 이／가，再说明有无"
          description="先看名词末尾有没有收音，然后完成句子。"
          icon={<PencilLine aria-hidden="true" size={22} />}
          action={
            <RevealButton
              shown={Boolean(revealed.practice2)}
              onClick={() => toggle("practice2")}
              answer
            />
          }
        />
        <div className="mt-5 grid grid-cols-2 gap-3">
          {[
            ["책___ 있어요.", "책이 있어요."],
            ["의자___ 없어요.", "의자가 없어요."],
            ["우산___ 있어요?", "우산이 있어요?"],
            ["시계___ 없어요.", "시계가 없어요."],
            ["연필___ 있어요.", "연필이 있어요."],
            ["지도___ 있어요?", "지도가 있어요?"],
            ["물___ 없어요.", "물이 없어요."],
            ["카드___ 있어요.", "카드가 있어요."],
          ].map(([prompt, answer], index) => (
            <button
              key={prompt}
              type="button"
              onClick={() => speak(answer)}
              className="rounded-2xl border border-[var(--border)] bg-white p-4 text-left"
            >
              <span className="text-[10px] font-bold text-[var(--status-warning)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="mt-2 text-sm font-bold">{prompt}</p>
              <p
                className={`mt-2 text-xs text-[var(--status-warning)] transition ${
                  revealed.practice2 ? "opacity-100" : "opacity-0"
                }`}
              >
                {answer}
              </p>
            </button>
          ))}
        </div>
        <div className="mt-auto rounded-2xl bg-[var(--status-warning-surface)] p-4 text-xs leading-6">
          自我检查：先说“有没有”，再把 있어요 换成 없어요，练习同一名词的两种答案。
        </div>
      </div>
    </Page>,
    <Page key="02-16" number="16">
      <div className="flex h-full flex-col">
        <Heading
          title="3. 把提示变成店内请求"
          description="每组都要说完整的“询问—确认—请求”，不要只说单个词。"
          icon={<ShoppingBag aria-hidden="true" size={22} />}
          action={
            <RevealButton
              shown={Boolean(revealed.practice3)}
              onClick={() => toggle("practice3")}
              answer
            />
          }
        />
        <div className="mt-4 space-y-2">
          {[
            ["공책＋연필／하고", "공책하고 연필 주세요."],
            ["책＋공책／과", "책과 공책 주세요."],
            ["의자＋책상／와", "의자와 책상이에요."],
            ["우산＋물／하고", "우산하고 물 주세요."],
            ["지도＋신문／와", "지도와 신문 주세요."],
          ].map(([prompt, answer], index) => (
            <article
              key={prompt}
              className="rounded-2xl border border-[var(--border)] bg-white px-4 py-2.5"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--status-warning-surface)] text-xs font-bold text-[var(--status-warning)]">
                  {index + 1}
                </span>
                <p className="text-sm font-bold">{prompt}</p>
              </div>
              <button
                type="button"
                onClick={() => speak(answer.replaceAll("—", ""))}
                className={`mt-2 w-full rounded-xl bg-[var(--status-warning-surface)] px-4 py-2 text-left text-xs font-bold leading-5 text-[var(--status-warning)] transition ${
                  revealed.practice3 ? "opacity-100" : "opacity-0"
                }`}
              >
                {answer}
              </button>
            </article>
          ))}
        </div>
        <p className="mt-auto text-center text-[11px] text-[var(--foreground-secondary)]">
          能在3秒内开始第一句，就算通过本区。
        </p>
      </div>
    </Page>,
    <Page key="02-17" number="17">
      <Divider
        step="第五步"
        title="实战对话"
        goal="把本课语言工具放进服务台、教室、文具店和便利店四个原创场景。"
        icon={<MessageCircle aria-hidden="true" size={24} />}
      />
    </Page>,
    <Page key="02-18" number="18">
      <div className="flex h-full flex-col">
        <Heading
          title="1. 服务台领取学习用品"
          description="任务：确认桌上的物品，并领取一本笔记本。"
          icon={<MessageCircle aria-hidden="true" size={22} />}
          action={
            <RevealButton
              shown={Boolean(revealed.dialog1)}
              onClick={() => toggle("dialog1")}
            />
          }
        />
        <Dialogue
          speak={speak}
          showMeaning={Boolean(revealed.dialog1)}
          lines={[
            ["A", "안녕하세요. 이거는 뭐예요?", "你好。这个是什么？"],
            ["B", "수업 공책이에요.", "是上课用的笔记本。"],
            ["A", "연필도 있어요?", "也有铅笔吗？"],
            ["B", "네, 여기 있어요.", "有，在这里。"],
            ["A", "공책하고 연필 주세요.", "请给我笔记本和铅笔。"],
            ["B", "네, 받으세요.", "好的，请收下。"],
          ]}
        />
        <div className="mt-auto rounded-2xl bg-[var(--status-warning-surface)] p-4 text-xs leading-6">
          替换任务：把“笔记本＋铅笔”换成“教材＋橡皮”，保持对话结构不变。
        </div>
      </div>
    </Page>,
    <Page key="02-19" number="19">
      <div className="flex h-full flex-col">
        <Heading
          title="2. 教室里寻找失物"
          description="任务：确认对方身边的雨伞是不是自己的。"
          icon={<PackageSearch aria-hidden="true" size={22} />}
          action={
            <RevealButton
              shown={Boolean(revealed.dialog2)}
              onClick={() => toggle("dialog2")}
            />
          }
        />
        <Dialogue
          speak={speak}
          showMeaning={Boolean(revealed.dialog2)}
          lines={[
            ["A", "민수 씨, 그거는 뭐예요?", "敏洙，你那边那个是什么？"],
            ["B", "우산이에요. 왜요?", "是雨伞。怎么了？"],
            ["A", "제 우산이 없어요.", "我的雨伞不见了。"],
            ["B", "이 우산이에요?", "是这把雨伞吗？"],
            ["A", "아니요. 제 우산은 검은색이에요.", "不是。我的雨伞是黑色的。"],
            ["B", "아, 저기에 있어요.", "啊，在那边。"],
          ]}
        />
        <div className="mt-auto grid grid-cols-2 gap-3 text-xs">
          <p className="rounded-2xl bg-[var(--status-success-surface)] p-4">
            <strong>找线索：</strong> 이、그、저 随着说话位置变化。
          </p>
          <p className="rounded-2xl bg-[var(--status-warning-surface)] p-4">
            <strong>拓展：</strong> 제 是“我的”的礼貌说法，本课只需认读。
          </p>
        </div>
      </div>
    </Page>,
    <Page key="02-20" number="20">
      <div className="flex h-full flex-col">
        <Heading
          title="3. 在文具店找商品"
          description="任务：先问物品名称，再确认有没有需要的颜色。"
          icon={<ShoppingBag aria-hidden="true" size={22} />}
          action={
            <RevealButton
              shown={Boolean(revealed.dialog3)}
              onClick={() => toggle("dialog3")}
            />
          }
        />
        <Dialogue
          speak={speak}
          showMeaning={Boolean(revealed.dialog3)}
          lines={[
            ["손", "저기요. 이거는 뭐예요?", "打扰一下。这个是什么？"],
            ["점", "메모지예요.", "是便签纸。"],
            ["손", "파란색도 있어요?", "也有蓝色的吗？"],
            ["점", "아니요, 파란색은 없어요. 노란색은 있어요.", "没有蓝色的。有黄色的。"],
            ["손", "그럼 노란색 메모지 주세요.", "那请给我黄色便签纸。"],
            ["점", "네, 여기 있습니다.", "好的，在这里。"],
          ]}
        />
        <p className="mt-auto rounded-2xl bg-[var(--status-warning-surface)] p-4 text-xs leading-6">
          손＝顾客，점＝店员。对话中的颜色是扩展信息；核心仍是 뭐예요、있어요／없어요、주세요。
        </p>
      </div>
    </Page>,
    <Page key="02-21" number="21">
      <div className="flex h-full flex-col">
        <Heading
          title="4. 便利店角色任务"
          description="不用背固定台词，根据任务卡完成一次20秒交流。"
          icon={<Mic2 aria-hidden="true" size={22} />}
        />
        <div className="mt-5 grid grid-cols-2 gap-4">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
            <p className="text-xs font-bold text-[var(--destructive)]">顾客卡</p>
            <h4 className="mt-3 text-lg font-bold">你需要水和一把雨伞</h4>
            <ol className="mt-4 space-y-3 text-xs leading-6">
              <li>1. 指着柜台上的物品问名称。</li>
              <li>2. 问店里有没有雨伞。</li>
              <li>3. 请求水和雨伞。</li>
              <li>4. 用 감사합니다 结束。</li>
            </ol>
          </section>
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--status-success-surface)] p-5">
            <p className="text-xs font-bold text-[var(--status-success)]">店员卡</p>
            <h4 className="mt-3 text-lg font-bold">水有，雨伞没有</h4>
            <ol className="mt-4 space-y-3 text-xs leading-6">
              <li>1. 回答物品名称。</li>
              <li>2. 对雨伞回答 없어요。</li>
              <li>3. 把水递给顾客。</li>
              <li>4. 用 네 或 여기 있어요 回应。</li>
            </ol>
          </section>
        </div>
        <button
          type="button"
          onClick={() =>
            speak(
              "이거는 뭐예요? 물이에요. 우산이 있어요? 아니요, 없어요. 그럼 물 주세요."
            )
          }
          className="mt-5 rounded-2xl bg-[var(--foreground)] p-5 text-left text-white"
        >
          <p className="text-xs font-bold text-[var(--border)]">需要提示时再听</p>
          <p
            className={`mt-3 text-sm font-bold leading-7 transition ${
              revealed.dialog4 ? "opacity-100" : "opacity-0"
            }`}
          >
            이거는 뭐예요? — 물이에요. — 우산이 있어요? — 아니요, 없어요. — 그럼 물 주세요.
          </p>
        </button>
        <RevealButton
          shown={Boolean(revealed.dialog4)}
          onClick={() => toggle("dialog4")}
        />
        <p className="mt-auto text-center text-[11px] text-[var(--foreground-secondary)]">
          完成后交换角色，再做一次。
        </p>
      </div>
    </Page>,
    <Page key="02-22" number="22">
      <Divider
        step="第六步"
        title="听说任务"
        goal="训练对距离词、物品名称和有无回答的即时辨认，并完成信息差交流。"
        icon={<Headphones aria-hidden="true" size={24} />}
      />
    </Page>,
    <Page key="02-23" number="23">
      <div className="flex h-full flex-col">
        <Heading
          title="1. 听距离，选物品"
          description="点击播放后，只根据听到的指示词选择 A、B 或 C。"
          icon={<Headphones aria-hidden="true" size={22} />}
        />
        <div className="mt-4 space-y-3">
          {[
            ["이 책 주세요.", ["A 我手边的书", "B 你手边的书", "C 远处的书"], "A"],
            ["그 우산은 뭐예요?", ["A 我手边的伞", "B 你手边的伞", "C 门外的伞"], "B"],
            ["저 가방은 누구 가방이에요?", ["A 我桌上的包", "B 你椅边的包", "C 远处架上的包"], "C"],
            ["그거는 시계예요.", ["A 这个", "B 你那边那个", "C 远处那个"], "B"],
          ].map(([audio, choices, answer], index) => (
            <article
              key={audio as string}
              className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[var(--primary)]">
                  音频 {index + 1}
                </p>
                <SpeakButton text={audio as string} speak={speak} />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(choices as string[]).map((choice) => (
                  <span
                    key={choice}
                    className="rounded-xl bg-white px-3 py-1.5 text-[11px] font-bold"
                  >
                    {choice}
                  </span>
                ))}
              </div>
              <p
                className={`mt-2 text-right text-xs font-bold text-[var(--primary)] transition ${
                  revealed.listen1 ? "opacity-100" : "opacity-0"
                }`}
              >
                答案：{answer}
              </p>
            </article>
          ))}
        </div>
        <div className="mt-auto">
          <RevealButton
            shown={Boolean(revealed.listen1)}
            onClick={() => toggle("listen1")}
            answer
          />
        </div>
      </div>
    </Page>,
    <Page key="02-24" number="24">
      <div className="flex h-full flex-col">
        <Heading
          title="2. 影子跟读：保持问答节奏"
          description="每句先听两遍，再在声音结束后立即复述；第三遍尝试同步跟读。"
          icon={<Mic2 aria-hidden="true" size={22} />}
        />
        <div className="mt-5 space-y-3">
          {[
            ["이거는 뭐예요?", "短问句，句尾轻轻上扬。"],
            ["휴대폰이에요.", "回答稳定下降，不必拖长。"],
            ["연필이 있어요?", "助词 이 和 있어요 连贯读。"],
            ["아니요, 연필은 없어요.", "先否定，再补充没有什么。"],
            ["그럼 지우개 주세요.", "그럼 后稍停，再说请求。"],
            ["네, 여기 있어요.", "回应简短自然。"],
          ].map(([korean, tip], index) => (
            <button
              key={korean}
              type="button"
              onClick={() => speak(korean)}
              className="flex w-full items-center gap-4 rounded-2xl border border-[var(--border)] bg-white p-4 text-left"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent)] text-xs font-bold text-[var(--primary)]">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{korean}</span>
                <span className="mt-1 block text-[11px] text-[var(--foreground-secondary)]">
                  {tip}
                </span>
              </span>
              <Volume2 aria-hidden="true" size={16} className="text-[var(--primary)]" />
            </button>
          ))}
        </div>
        <div className="mt-auto rounded-2xl bg-[var(--accent)] p-4 text-xs leading-6">
          录音自检：是否听得清 뭐예요、있어요、없어요 的句尾差异？是否每句话都没有中文式停顿？
        </div>
      </div>
    </Page>,
    <Page key="02-25" number="25">
      <div className="flex h-full flex-col">
        <Heading
          title="3. 信息差：我的包里有什么？"
          description="A 和 B 各自只看一张卡，通过韩语问答找出三处不同。"
          icon={<Mic2 aria-hidden="true" size={22} />}
        />
        <div className="mt-5 grid grid-cols-2 gap-4">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
            <p className="text-xs font-bold text-[var(--primary)]">A 卡</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["책", "연필", "휴대폰", "우산", "카드"].map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-white px-3 py-2 text-sm font-bold"
                >
                  {item}
                </span>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
            <p className="text-xs font-bold text-[var(--status-warning)]">B 卡</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["책", "지우개", "휴대폰", "안경", "카드"].map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-white px-3 py-2 text-sm font-bold"
                >
                  {item}
                </span>
              ))}
            </div>
          </section>
        </div>
        <section className="mt-5 rounded-2xl border border-[var(--border)] bg-white p-5">
          <p className="text-xs font-bold text-[var(--status-success)]">只能使用这些问句</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs font-bold">
            <button
              type="button"
              onClick={() => speak("가방에 연필이 있어요?")}
              className="rounded-xl bg-[var(--status-success-surface)] p-3 text-left"
            >
              가방에 연필이 있어요?
            </button>
            <button
              type="button"
              onClick={() => speak("네, 있어요.")}
              className="rounded-xl bg-[var(--status-success-surface)] p-3 text-left"
            >
              네, 있어요.
            </button>
            <button
              type="button"
              onClick={() => speak("아니요, 없어요.")}
              className="rounded-xl bg-[var(--status-success-surface)] p-3 text-left"
            >
              아니요, 없어요.
            </button>
            <button
              type="button"
              onClick={() => speak("그거는 뭐예요?")}
              className="rounded-xl bg-[var(--status-success-surface)] p-3 text-left"
            >
              그거는 뭐예요?
            </button>
          </div>
        </section>
        <p className="mt-auto text-center text-[11px] text-[var(--foreground-secondary)]">
          不直接念卡片；必须一问一答获得信息。
        </p>
      </div>
    </Page>,
    <Page key="02-26" number="26">
      <Divider
        step="第七步"
        title="读写拓展"
        goal="读懂一则简短失物信息，并用本课句型描述自己的学习用品。"
        icon={<PencilLine aria-hidden="true" size={24} />}
      />
    </Page>,
    <Page key="02-27" number="27">
      <div className="flex h-full flex-col">
        <Heading
          title="1. 阅读：失物招领台"
          description="先读短文回答问题，再显示参考答案。"
          icon={<BookOpenCheck aria-hidden="true" size={22} />}
          action={
            <RevealButton
              shown={Boolean(revealed.reading)}
              onClick={() => toggle("reading")}
              answer
            />
          }
        />
        <article className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--status-success-surface)] p-5">
          <p className="text-xs font-bold text-[var(--status-success)]">분실물 안내</p>
          <p className="mt-4 text-base font-bold leading-8">
            여기에 가방이 있어요. 검은색 가방이에요. 가방 안에 공책하고 안경이 있어요. 휴대폰은 없어요. 이 가방 주인은 안내 데스크로 오세요.
          </p>
          <p
            className={`mt-3 text-xs leading-6 text-[var(--foreground-secondary)] transition ${
              revealed.reading ? "opacity-100" : "opacity-0"
            }`}
          >
            这里有一个包，是黑色的。包里有笔记本和眼镜，没有手机。包的主人请到服务台。
          </p>
        </article>
        <div className="mt-5 space-y-3">
          {[
            ["1. 가방은 무슨 색이에요?", "검은색이에요."],
            ["2. 가방 안에 뭐가 있어요?", "공책하고 안경이 있어요."],
            ["3. 휴대폰이 있어요?", "아니요, 없어요."],
          ].map(([question, answer]) => (
            <div
              key={question}
              className="grid grid-cols-[1fr_190px] gap-3 rounded-xl border border-[var(--border)] bg-white p-3 text-xs"
            >
              <p className="font-bold">{question}</p>
              <p
                className={`text-[var(--status-success)] transition ${
                  revealed.reading ? "opacity-100" : "opacity-0"
                }`}
              >
                {answer}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-auto text-[11px] leading-5 text-[var(--foreground-secondary)]">
          “가방 안에”表示“在包里面”，属于阅读拓展；会认即可。
        </p>
      </div>
    </Page>,
    <Page key="02-28" number="28">
      <div className="flex h-full flex-col">
        <Heading
          title="2. 写作：我的学习包"
          description="按照三步写5句，不需要使用本课以外的复杂语法。"
          icon={<PencilLine aria-hidden="true" size={22} />}
        />
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            ["第一步", "介绍物品", "이거는 제 가방이에요."],
            ["第二步", "说明有什么", "가방에 책이 있어요."],
            ["第三步", "说明没有什么", "우산은 없어요."],
          ].map(([step, title, example]) => (
            <article
              key={step}
              className="rounded-2xl border border-[var(--border)] bg-[var(--status-success-surface)] p-4"
            >
              <p className="text-[10px] font-bold text-[var(--status-success)]">{step}</p>
              <h4 className="mt-2 text-sm font-bold">{title}</h4>
              <p className="mt-3 text-[11px] leading-5 text-[var(--foreground-secondary)]">
                {example}
              </p>
            </article>
          ))}
        </div>
        <section className="mt-5 rounded-2xl border border-[var(--border)] bg-white p-5">
          <p className="text-xs font-bold">写作框架</p>
          <div className="mt-4 space-y-3 text-sm">
            {[
              "이거는 제 __________이에요／예요.",
              "__________에 __________이／가 있어요.",
              "그리고 __________이／가 있어요.",
              "하지만 __________은／는 없어요.",
              "저는 이 __________을／를 좋아해요.",
            ].map((line) => (
              <p
                key={line}
                className="rounded-xl border border-dashed border-[var(--border)] px-4 py-3"
              >
                {line}
              </p>
            ))}
          </div>
        </section>
        <div className="mt-auto rounded-2xl bg-[var(--status-success-surface)] p-4 text-xs leading-6">
          检查：每句有没有句号？이／가 是否按收音选择？至少使用一次 있어요 和 없어요。
        </div>
      </div>
    </Page>,
    <Page key="02-29" number="29">
      <Divider
        step="第八步"
        title="自测与复盘"
        goal="用词汇、语法、阅读和口语四类任务确认自己是否真正具备本课能力。"
        icon={<CheckCircle2 aria-hidden="true" size={24} />}
      />
    </Page>,
    <Page key="02-30" number="30">
      <div className="flex h-full flex-col">
        <Heading
          title="1. 10题快速自测"
          description="先独立完成，再显示答案；答对8题以上即可进入口语验收。"
          icon={<CheckCircle2 aria-hidden="true" size={22} />}
          action={
            <RevealButton
              shown={Boolean(revealed.test)}
              onClick={() => toggle("test")}
              answer
            />
          }
        />
        <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3">
          {[
            ["1. 我手里的书：___ 책", "이"],
            ["2. 远处的包：___ 가방", "저"],
            ["3. “这是什么？”", "이거는 뭐예요?"],
            ["4. 책___ 있어요.", "이"],
            ["5. 의자___ 없어요.", "가"],
            ["6. “是钟表。”", "시계예요."],
            ["7. “请给我水。”", "물 주세요."],
            ["8. “没有雨伞。”", "우산이 없어요."],
            ["9. “笔记本和铅笔”（口语）", "공책하고 연필"],
            ["10. 책___ 공책／의자___ 책상", "과／와"],
          ].map(([question, answer]) => (
            <article
              key={question}
              className="rounded-xl border border-[var(--border)] bg-white px-4 py-3"
            >
              <p className="text-xs font-bold leading-5">{question}</p>
              <p
                className={`mt-2 rounded-lg bg-[var(--status-success-surface)] px-3 py-2 text-[11px] font-bold text-[var(--status-success)] transition ${
                  revealed.test ? "opacity-100" : "opacity-0"
                }`}
              >
                {answer}
              </p>
            </article>
          ))}
        </div>
        <p className="mt-auto text-center text-[11px] text-[var(--foreground-secondary)]">
          6—7题：回看语法页；5题以下：从词汇页重新跟读一轮。
        </p>
      </div>
    </Page>,
    <Page key="02-31" number="31">
      <div className="flex h-full flex-col">
        <Heading
          title="2. 口语验收与学习复盘"
          description="选择身边三件物品，完成一段不看稿的30秒表达。"
          icon={<Mic2 aria-hidden="true" size={22} />}
        />
        <section className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--status-success-surface)] p-5">
          <p className="text-xs font-bold text-[var(--status-success)]">口语任务</p>
          <ol className="mt-4 grid grid-cols-2 gap-3 text-xs leading-6">
            {[
              "指一件近处物品，问并回答名称。",
              "指一件远处物品，正确使用 저。",
              "说明自己有一件物品、没有一件物品。",
              "向同伴提出一次礼貌请求。",
            ].map((task, index) => (
              <li
                key={task}
                className="rounded-xl bg-white p-4 font-bold"
              >
                <span className="mr-2 text-[var(--status-success)]">{index + 1}.</span>
                {task}
              </li>
            ))}
          </ol>
        </section>
        <div className="mt-5 grid grid-cols-2 gap-4">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
            <p className="text-xs font-bold">我已经能做到</p>
            <div className="mt-4 space-y-3 text-xs">
              {[
                "根据距离选择 이／그／저",
                "询问并回答物品名称",
                "表达有或没有",
                "使用 주세요 提出请求",
              ].map((item) => (
                <label key={item} className="flex items-center gap-3">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--status-success)]" />
                  {item}
                </label>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
            <p className="text-xs font-bold text-[var(--status-warning)]">下一次练习重点</p>
            <div className="mt-4 space-y-3 text-xs leading-5">
              <p>□ 指示词反应速度</p>
              <p>□ 이／가 的选择</p>
              <p>□ 问句与回答的语调</p>
              <p>□ 请求时的礼貌程度</p>
            </div>
          </section>
        </div>
        <button
          type="button"
          onClick={() =>
            speak(
              "이거는 뭐예요? 공책이에요. 연필이 있어요? 네, 있어요. 그 연필 주세요."
            )
          }
          className="mt-auto flex items-center justify-center gap-2 rounded-2xl bg-[var(--status-success)] px-5 py-4 text-sm font-bold text-white"
        >
          <Volume2 aria-hidden="true" size={16} />
          播放最终示范节奏
        </button>
      </div>
    </Page>,
    <Page key="02-32-ending" number="32">
      <div className="flex h-full flex-col justify-center">
        <div className="mx-auto w-full max-w-[440px] text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--status-success-surface)] text-[var(--status-success)]">
            <Sparkles aria-hidden="true" size={27} />
          </span>
          <p className="mt-5 text-xs font-bold tracking-[0.18em] text-[var(--status-success)]">
            LESSON 02 · COMPLETE
          </p>
          <h3 className="mt-3 text-4xl font-bold text-[var(--status-success)]">
            이거는 뭐예요?
          </h3>
          <p className="mt-3 text-lg font-bold text-[var(--foreground)]">
            你已经完成第二课
          </p>
          <p className="mx-auto mt-3 max-w-[380px] text-sm leading-7 text-[var(--foreground-secondary)]">
            从询问物品名称，到表达有无、礼貌请求和连接名词，你已经能围绕身边物品完成一段完整交流。
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-left">
            {[
              ["01", "说明有无", "N이／가 있어요／없어요"],
              ["02", "指物说明", "이거는 N이에요／예요"],
              ["03", "礼貌请求", "N 주세요"],
              ["04", "连接名词", "N하고 N／N과／와 N"],
            ].map(([number, title, detail]) => (
              <div
                key={number}
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-3"
              >
                <p className="text-[10px] font-bold text-[var(--status-success)]">
                  {number}
                </p>
                <p className="mt-1 text-xs font-bold text-[var(--status-success)]">
                  {title}
                </p>
                <p className="mt-1 text-[10px] leading-4 text-[var(--foreground-secondary)]">
                  {detail}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--status-success-surface)] px-5 py-3.5 text-left">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold tracking-[0.14em] text-[var(--status-success)]">
                  LESSON 2 TEST · 本课测试
                </p>
                <p className="mt-1 text-xs font-bold text-[var(--foreground-secondary)]">
                  前往章节测试专区，检验本课词汇、语法、听辨和情境表达。
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  window.location.assign("/dashboard/assignments/korean")
                }
                className="shrink-0 rounded-full bg-white px-3 py-2 text-[10px] font-bold text-[var(--status-success)] shadow-sm"
              >
                前往测试专区
              </button>
            </div>
          </div>
          <div className="mt-5 rounded-2xl bg-[var(--accent)] px-5 py-4 text-left">
            <p className="text-[10px] font-bold tracking-[0.14em] text-[var(--primary)]">
              NEXT · LESSON 03
            </p>
            <div className="mt-2 flex items-end justify-between gap-4">
              <div>
                <p className="text-lg font-bold text-[var(--status-success)]">
                  한국어를 공부해요.
                </p>
                <p className="mt-1 text-[11px] text-[var(--foreground-secondary)]">
                  下一课：学习用动词表达正在做什么、学习什么。
                </p>
              </div>
              <button
                type="button"
                onClick={() => flipBookRef.current?.pageFlip()?.flip(1)}
                className="shrink-0 rounded-full bg-white px-3 py-2 text-[10px] font-bold text-[var(--primary)] shadow-sm"
              >
                返回目录
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs font-bold text-[var(--foreground-secondary)]">
            能够说清眼前的事物，就是把韩语带进真实生活的开始。
          </p>
        </div>
      </div>
    </Page>,
  ];

  return (
    <section
      ref={containerRef}
      className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden [&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-[var(--ring)] [&_button:focus-visible]:ring-offset-2 [&_input:focus-visible]:outline-none [&_input:focus-visible]:ring-2 [&_input:focus-visible]:ring-[var(--ring)] [&_input:focus-visible]:ring-offset-2"
    >
      <div
        className="relative shrink-0"
        style={{ width: BOOK_WIDTH * scale, height: BOOK_HEIGHT * scale }}
      >
        <button
          type="button"
          onClick={() => flipBookRef.current?.pageFlip()?.flipPrev()}
          aria-label="上一页"
          className="absolute -left-14 top-1/2 z-20 -translate-y-1/2 rounded-full border border-[var(--border)] bg-white p-3 text-[var(--status-success)] shadow-lg transition hover:bg-[var(--status-success-surface)]"
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </button>
        <button
          type="button"
          onClick={() => flipBookRef.current?.pageFlip()?.flipNext()}
          aria-label="下一页"
          className="absolute -right-14 top-1/2 z-20 -translate-y-1/2 rounded-full border border-[var(--border)] bg-white p-3 text-[var(--status-success)] shadow-lg transition hover:bg-[var(--status-success-surface)]"
        >
          <ArrowRight aria-hidden="true" size={18} />
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
