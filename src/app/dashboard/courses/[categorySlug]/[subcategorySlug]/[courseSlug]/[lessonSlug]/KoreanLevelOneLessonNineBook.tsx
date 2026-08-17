"use client";

import dynamic from "next/dynamic";

const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false });
import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ContactRound,
  Crown,
  Headphones,
  HeartHandshake,
  House,
  Languages,
  Mic2,
  NotebookPen,
  Sparkles,
  UsersRound,
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
      header={TEMPLATE.headers[number] ?? "第 9 课 · 이분은 누구세요?"}
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
  tone?: "blue" | "rose" | "green" | "amber" | "purple";
}) {
  const tones = {
    blue: "border-[var(--border)] bg-[var(--accent)] text-[var(--primary)]",
    rose: "border-[var(--border)] bg-[var(--card)] text-[var(--destructive)]",
    green: "border-[var(--border)] bg-[var(--status-success-surface)] text-[var(--status-success)]",
    amber: "border-[var(--border)] bg-[var(--status-warning-surface)] text-[var(--status-warning)]",
    purple: "border-[var(--border)] bg-[var(--card)] text-[var(--primary)]",
  };
  return (
    <section className={`mt-4 rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-[11px] font-bold">{title}</p>
      <div className="mt-2 text-xs font-bold leading-6 text-[var(--foreground-secondary)]">{children}</div>
    </section>
  );
}

function WordGrid({ words, speak, showChinese }: { words: Word[]; speak: Speak; showChinese: boolean }) {
  return (
    <div className={`mt-4 grid grid-cols-3 ${words.length > 12 ? "gap-0.5" : "gap-3"} ${showChinese ? "" : "[&_[data-vocab-meaning]]:opacity-0"}`}>
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
          className={`flex gap-2 rounded-xl p-3.5 ${
            index % 2 ? "bg-[var(--status-warning-surface)]" : "bg-[var(--status-success-surface)]"
          }`}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-bold">
            {line.speaker}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold leading-6">{line.korean}</p>
            <p className={`text-[10px] font-bold leading-5 text-[var(--foreground-secondary)] ${showChinese ? "opacity-100" : "opacity-0"}`}>{line.chinese}</p>
          </div>
          <KoreanEbookSpeakButton text={line.korean} onSpeak={speak} compact />
        </div>
      ))}
    </div>
  );
}

const familyWords: Word[] = [
  { korean: "할아버지", type: "家庭名词", chinese: "爷爷／外公" },
  { korean: "할머니", type: "家庭名词", chinese: "奶奶／外婆" },
  { korean: "아버지", type: "家庭名词", chinese: "爸爸" },
  { korean: "어머니", type: "家庭名词", chinese: "妈妈" },
  { korean: "형", type: "家庭名词", chinese: "哥哥（男性使用）" },
  { korean: "오빠", type: "家庭名词", chinese: "哥哥（女性使用）" },
  { korean: "누나", type: "家庭名词", chinese: "姐姐（男性使用）" },
  { korean: "언니", type: "家庭名词", chinese: "姐姐（女性使用）" },
  { korean: "동생", type: "家庭名词", chinese: "弟弟／妹妹" },
  { korean: "남편", type: "家庭名词", chinese: "丈夫" },
  { korean: "아내", type: "家庭名词", chinese: "妻子" },
  { korean: "아들", type: "家庭名词", chinese: "儿子" },
  { korean: "딸", type: "家庭名词", chinese: "女儿" },
  { korean: "부모님", type: "家庭敬称", chinese: "父母" },
  { korean: "가족", type: "名词", chinese: "家庭／家人" },
];

const ageWords: Word[] = [
  { korean: "스물 → 스무 살", type: "固有词数字", chinese: "20岁" },
  { korean: "서른 살", type: "固有词数字", chinese: "30岁" },
  { korean: "마흔 살", type: "固有词数字", chinese: "40岁" },
  { korean: "쉰 살", type: "固有词数字", chinese: "50岁" },
  { korean: "예순 살", type: "固有词数字", chinese: "60岁" },
  { korean: "일흔 살", type: "固有词数字", chinese: "70岁" },
  { korean: "여든 살", type: "固有词数字", chinese: "80岁" },
  { korean: "아흔 살", type: "固有词数字", chinese: "90岁" },
  { korean: "스물한 살", type: "年龄表达", chinese: "21岁" },
  { korean: "서른두 살", type: "年龄表达", chinese: "32岁" },
  { korean: "마흔다섯 살", type: "年龄表达", chinese: "45岁" },
  { korean: "살", type: "量词", chinese: "岁（普通表达）" },
];

const honorificNouns: Word[] = [
  { korean: "연세", type: "敬语名词", chinese: "年龄" },
  { korean: "성함", type: "敬语名词", chinese: "姓名" },
  { korean: "댁", type: "敬语名词", chinese: "府上／家" },
  { korean: "생신", type: "敬语名词", chinese: "生日" },
  { korean: "분", type: "敬语量词", chinese: "位" },
  { korean: "말씀", type: "敬语名词", chinese: "话／讲话" },
  { korean: "진지", type: "敬语名词", chinese: "饭" },
  { korean: "어르신", type: "敬称", chinese: "老人家／长者" },
  { korean: "선생님", type: "敬称", chinese: "老师／先生" },
  { korean: "부모님", type: "敬称", chinese: "父母" },
  { korean: "할아버님", type: "敬称", chinese: "爷爷（更尊敬）" },
  { korean: "할머님", type: "敬称", chinese: "奶奶（更尊敬）" },
];

const honorificVerbs: Word[] = [
  { korean: "있다 → 계시다", type: "特殊敬语动词", chinese: "在／有" },
  { korean: "먹다 → 드시다", type: "特殊敬语动词", chinese: "吃" },
  { korean: "마시다 → 드시다", type: "特殊敬语动词", chinese: "喝" },
  { korean: "자다 → 주무시다", type: "特殊敬语动词", chinese: "睡觉" },
  { korean: "죽다 → 돌아가시다", type: "特殊敬语动词", chinese: "去世" },
  { korean: "말하다 → 말씀하시다", type: "特殊敬语动词", chinese: "说" },
  { korean: "가다 → 가시다", type: "主体敬语", chinese: "去" },
  { korean: "읽다 → 읽으시다", type: "主体敬语", chinese: "读" },
  { korean: "바쁘다 → 바쁘시다", type: "主体敬语", chinese: "忙" },
  { korean: "살다 → 사시다", type: "主体敬语", chinese: "居住" },
  { korean: "잘하다", type: "能力表达", chinese: "擅长" },
  { korean: "잘 못하다", type: "能力表达", chinese: "不太擅长" },
  { korean: "못하다", type: "能力表达", chinese: "不会／不能" },
  { korean: "요리하다", type: "动词", chinese: "做饭" },
  { korean: "운전하다", type: "动词", chinese: "开车" },
];

const dividers: Record<string, { step: string; title: string; goal: string; icon: ReactNode }> = {
  "02": { step: "第一步", title: "课前导航", goal: "从家庭照片出发，完成身份、关系、年龄、能力和长辈日常的得体介绍。", icon: <UsersRound aria-hidden="true" size={24} /> },
  "04": { step: "第二步", title: "核心词汇", goal: "建立家庭成员、年龄数字、敬语名词和敬语动词四组词汇网络。", icon: <House aria-hidden="true" size={24} /> },
  "09": { step: "第三步", title: "语法讲解", goal: "四个语法各占一页，讲清所属、能力、名词敬语和主体敬语。", icon: <NotebookPen aria-hidden="true" size={24} /> },
  "14": { step: "第四步", title: "句型操练", goal: "把普通表达升级为敬语，并判断年龄、姓名、家和日常动作该换哪些词。", icon: <Crown aria-hidden="true" size={24} /> },
  "18": { step: "第五步", title: "实战对话", goal: "通过三组八句对话介绍家人、询问长辈并完成电话问候。", icon: <HeartHandshake aria-hidden="true" size={24} /> },
  "22": { step: "第六步", title: "听说任务", goal: "读懂家庭树和人物档案，完成一段有关系、有年龄、有能力的介绍。", icon: <ContactRound aria-hidden="true" size={24} /> },
  "26": { step: "第七步", title: "读写拓展", goal: "阅读家庭介绍，写出普通信息与主体敬语搭配正确的原创短文。", icon: <BookOpenCheck aria-hidden="true" size={24} /> },
  "29": { step: "第八步", title: "自测与复盘", goal: "综合检查家庭词汇、年龄、敬语词汇和四项核心语法。", icon: <CheckCircle2 aria-hidden="true" size={24} /> },
};

export function KoreanLevelOneLessonNineBook({
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
      title: "场景 1 · 第一次见朋友的父亲",
      description: "确认身份、职业和能力，并始终把长辈作为敬语主体。",
      lines: [
        { speaker: "秀", korean: "민수 씨, 이분은 누구세요?", chinese: "民洙，这位是谁？" },
        { speaker: "敏", korean: "제 아버지세요.", chinese: "是我的父亲。" },
        { speaker: "秀", korean: "아버님은 선생님이세요?", chinese: "令尊是老师吗？" },
        { speaker: "敏", korean: "아니요, 의사세요.", chinese: "不是，是医生。" },
        { speaker: "秀", korean: "요리를 잘하세요?", chinese: "他擅长做饭吗？" },
        { speaker: "敏", korean: "네, 한국 요리를 아주 잘하세요.", chinese: "是的，他很会做韩国菜。" },
        { speaker: "秀", korean: "주말에도 병원에 가세요?", chinese: "周末也去医院吗？" },
        { speaker: "敏", korean: "아니요, 주말에는 댁에서 쉬세요.", chinese: "不，周末在家休息。" },
      ],
    },
    "20": {
      title: "场景 2 · 看家庭照片",
      description: "介绍家庭关系、年龄和每个人擅长的事情。",
      lines: [
        { speaker: "珍", korean: "이 사진은 누구의 사진이에요?", chinese: "这是谁的照片？" },
        { speaker: "安", korean: "제 가족의 사진이에요.", chinese: "是我的全家福。" },
        { speaker: "珍", korean: "이분은 할머니세요?", chinese: "这位是奶奶吗？" },
        { speaker: "安", korean: "네, 할머니세요. 일흔두 살이세요.", chinese: "是的，是奶奶，72岁。" },
        { speaker: "珍", korean: "옆에 있는 분은 누구세요?", chinese: "旁边这位是谁？" },
        { speaker: "安", korean: "제 어머니세요. 노래를 잘하세요.", chinese: "是我妈妈，很会唱歌。" },
        { speaker: "珍", korean: "동생도 있어요?", chinese: "也有弟弟妹妹吗？" },
        { speaker: "安", korean: "네, 남동생이 한 명 있어요.", chinese: "有一个弟弟。" },
      ],
    },
    "21": {
      title: "场景 3 · 给奶奶打电话",
      description: "用敬语姓名、年龄和特殊敬语动词完成问候。",
      lines: [
        { speaker: "孙", korean: "할머니, 안녕하세요? 지금 댁에 계세요?", chinese: "奶奶您好，现在在家吗？" },
        { speaker: "奶", korean: "응, 집에 있다. 우리 손녀 잘 지냈니?", chinese: "嗯，在家。我的孙女过得好吗？" },
        { speaker: "孙", korean: "네, 잘 지냈어요. 진지 드셨어요?", chinese: "我很好。您吃饭了吗？" },
        { speaker: "奶", korean: "그래, 조금 전에 먹었다.", chinese: "吃了，刚刚吃的。" },
        { speaker: "孙", korean: "요즘도 아침에 산책하세요?", chinese: "最近早晨还散步吗？" },
        { speaker: "奶", korean: "그럼, 매일 공원에서 걷는다.", chinese: "当然，每天在公园走走。" },
        { speaker: "孙", korean: "이번 생신에 제가 댁에 갈게요.", chinese: "这次生日我会去您家。" },
        { speaker: "奶", korean: "고맙다. 그때 만나자.", chinese: "谢谢，到时见。" },
      ],
    },
  };

  function renderPage(number: string) {
    if (number === "01") {
      return (
        <KoreanEbookTableOfContents
          lessonNumber={9}
          pageMeta={TEMPLATE.pageMeta}
          onNavigate={(target) => flipBookRef.current?.pageFlip()?.flip(target)}
          entries={[
            { step: "01", title: "课前导航", pageRange: "02—03", detail: "建立家庭介绍任务" },
            { step: "02", title: "核心词汇", pageRange: "04—08", detail: "家庭·年龄·敬语名词·敬语动词" },
            { step: "03", title: "语法讲解", pageRange: "09—13", detail: "所属·能力·名词敬语·主体敬语" },
            { step: "04", title: "句型操练", pageRange: "14—17", detail: "普通表达升级" },
            { step: "05", title: "实战对话", pageRange: "18—21", detail: "三组八句家庭交流" },
            { step: "06", title: "听说任务", pageRange: "22—25", detail: "家庭树与人物档案" },
            { step: "07", title: "读写拓展", pageRange: "26—28", detail: "读介绍·写家人" },
            { step: "08", title: "自测与复盘", pageRange: "29—34", detail: "敬语综合验收" },
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
        <HeartHandshake aria-hidden="true" size={22} />,
        <>
          <Dialogue lines={dialogue.lines} speak={speak} showChinese={Boolean(revealed[`chinese${number}`])} />
          <Note title="角色交换" tone="rose">替换人物关系、年龄和能力，再完成一轮八句对话。</Note>
        </>,
        <KoreanEbookRevealButton shown={Boolean(revealed[`chinese${number}`])} onClick={() => toggle(`chinese${number}`)} />
      );
    }

    const pages: Record<string, ReactNode> = {
      "03": content("03", "介绍家人时要切换两套语言", "谈自己的信息用普通表达；谈值得尊敬的主体时同步升级名词、谓语和提问方式。", <UsersRound aria-hidden="true" size={22} />, <>
        <div className="mt-5 grid grid-cols-2 gap-3">{[
          ["身份", "이분은 제 아버지세요.", "这位是我的父亲。"],
          ["年龄", "연세가 어떻게 되세요?", "您多大年纪？"],
          ["能力", "요리를 아주 잘하세요.", "他很擅长做饭。"],
          ["日常", "어머니는 댁에 계세요.", "母亲在家。"],
          ["姓名", "성함이 어떻게 되세요?", "您尊姓大名？"],
          ["职业", "아버지는 의사세요.", "父亲是医生。"],
      ].map(([tag, korean, chinese]) => <button key={tag} type="button" onClick={() => speak(korean)} className="rounded-2xl border border-[var(--border)] bg-white p-4 text-left"><b className="text-[10px] text-[var(--status-warning)]">{tag}</b><div className="mt-2 flex items-center justify-between gap-2"><p className="text-sm font-bold">{korean}</p><Volume2 aria-hidden="true" size={14} className="shrink-0 text-[var(--primary)]"/></div><p className={`mt-1 text-[11px] text-[var(--foreground-secondary)] ${revealed.chinese03 ? "opacity-100" : "opacity-0"}`}>{chinese}</p></button>)}</div>
        <Note title="最终任务" tone="amber">用 8—10 句介绍两位家人：说明关系、年龄、职业、能力和日常活动；长辈信息必须使用敬语。</Note>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese03)} onClick={() => toggle("chinese03")} />),
      "05": content("05", "1. 家庭成员", "형/오빠、누나/언니会随说话者性别变化，不能只按中文机械翻译。", <UsersRound aria-hidden="true" size={22} />, <><WordGrid words={familyWords} speak={speak} showChinese={Boolean(revealed.chinese05)} /><Note title="称呼视角">男性称哥哥为 형、姐姐为 누나；女性称哥哥为 오빠、姐姐为 언니。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese05)} onClick={() => toggle("chinese05")} />),
      "06": content("06", "2. 年龄专用数字", "年龄使用固有词数字加 살；20在量词前变为 스무。", <ContactRound aria-hidden="true" size={22} />, <><WordGrid words={ageWords} speak={speak} showChinese={Boolean(revealed.chinese06)} /><Note title="20的关键变化" tone="rose">20岁：스무 살；21岁：스물한 살。只有整20在 살 前用 스무，带个位时恢复 스물-。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese06)} onClick={() => toggle("chinese06")} />),
      "07": content("07", "3. 敬语名词", "对长辈提问时不能只给普通名词加礼貌句尾，名词本身也要升级。", <Crown aria-hidden="true" size={22} />, <><WordGrid words={honorificNouns} speak={speak} showChinese={Boolean(revealed.chinese07)} /><Note title="提问升级" tone="amber">이름 → 성함，나이 → 연세，집 → 댁，생일 → 생신，사람 → 분。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese07)} onClick={() => toggle("chinese07")} />),
      "08": content("08", "4. 敬语动词与能力表达", "有特殊敬语动词时优先使用特殊词；没有时再添加 -(으)시-。", <Languages aria-hidden="true" size={22} />, <><WordGrid words={honorificVerbs} speak={speak} showChinese={Boolean(revealed.chinese08)} /><Note title="能力三级">잘하다：擅长；잘 못하다：不太擅长；못하다：不会或因条件不能做。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese08)} onClick={() => toggle("chinese08")} />),
      "10": content("10", "1. N(의) N", "连接两个名词表示所属、关系或类别；口语中的助词 의 常读作 [에]。", <House aria-hidden="true" size={22} />, <>
        <div className="mt-5 grid grid-cols-2 gap-3">{[
          ["基本结构", "선생님의 책", "老师的书"],
          ["家庭关系", "민수의 아버지", "民洙的父亲"],
          ["저 + 의 → 제", "제 어머니", "我的母亲（谦辞）"],
          ["나 + 의 → 내", "내 동생", "我的弟弟／妹妹（平辈）"],
          ["家庭所属", "수진 씨의 가족", "秀珍的家人"],
          ["地点类别", "학교 선생님", "学校老师"],
      ].map(([rule, korean, chinese]) => <article key={rule} className="rounded-2xl border border-[var(--border)] bg-white p-4"><b className="text-[var(--primary)]">{rule}</b><div className="mt-3 text-base font-bold"><RuleSentence text={korean} speak={speak}>{korean}</RuleSentence></div><p className={`mt-1 text-xs text-[var(--foreground-secondary)] ${revealed.chinese10 ? "opacity-100" : "opacity-0"}`}>{chinese}</p></article>)}</div>
        <Note title="发音与省略" tone="purple">어머니의 常读作 [어머니에]。关系清楚时 의 也可能省略，如 우리 가족、학교 선생님。</Note>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese10)} onClick={() => toggle("chinese10")} />),
      "11": content("11", "2. N을/를 잘하다", "用宾格助词标记能力领域，再区分擅长、不太擅长和不会。", <CheckCircle2 aria-hidden="true" size={22} />, <>
        <div className="mt-4 space-y-3">{[
          ["잘하다", "아버지는 요리를 잘하세요.", "父亲很擅长做饭。"],
          ["잘 못하다", "저는 수영을 잘 못해요.", "我不太会游泳。"],
          ["못하다", "동생은 운전을 못해요.", "弟弟不会开车。"],
      ].map(([level, korean, chinese]) => <button key={level} type="button" onClick={() => speak(korean)} className="block w-full rounded-2xl border border-[var(--border)] bg-white p-4 text-left"><b className="text-[11px] text-[var(--primary)]">{level}</b><div className="mt-2 flex items-center justify-between gap-2"><p className="text-base font-bold">{korean}</p><Volume2 aria-hidden="true" size={14} className="shrink-0 text-[var(--primary)]"/></div><p className={`mt-1 text-xs text-[var(--foreground-secondary)] ${revealed.chinese11 ? "opacity-100" : "opacity-0"}`}>{chinese}</p></button>)}</div>
        <Note title="잘 못하다 要分写" tone="rose">잘 못하다表示“做得不太好”；못하다更接近“不会／不能”。对长辈说能力时谓语升级为 잘하세요。</Note>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese11)} onClick={() => toggle("chinese11")} />),
      "12": content("12", "3. N(이)세요", "介绍长辈或尊敬对象的身份，相当于 이에요/예요 的敬语版本。", <Crown aria-hidden="true" size={22} />, <>
        <div className="mt-5 grid grid-cols-2 gap-3">{[
          ["有收音 + 이세요", "선생님 → 선생님이세요.", "是老师。"],
          ["无收音 + 세요", "의사 → 의사세요.", "是医生。"],
          ["身份提问", "이분은 누구세요?", "这位是谁？"],
          ["关系介绍", "제 어머니세요.", "是我的母亲。"],
          ["职业介绍", "아버지는 의사세요.", "父亲是医生。"],
          ["数量敬语", "두 분이세요.", "是两位。"],
      ].map(([rule, korean, chinese]) => <article key={rule} className="rounded-2xl border border-[var(--border)] bg-white p-4"><b className="text-[var(--primary)]">{rule}</b><div className="mt-3 text-sm font-bold"><RuleSentence text={korean.replace(" → ", ". ")} speak={speak}>{korean}</RuleSentence></div><p className={`mt-1 text-xs text-[var(--foreground-secondary)] ${revealed.chinese12 ? "opacity-100" : "opacity-0"}`}>{chinese}</p></article>)}</div>
        <Note title="敬语指向" tone="amber">不是因为听话人年长就使用，而是因为句子的“是……”所指对象值得尊敬。</Note>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese12)} onClick={() => toggle("chinese12")} />),
      "13": content("13", "4. A/V-(으)시-", "把值得尊敬的主体放在主语位置时，在谓语词干后加入主体敬语词尾。", <Crown aria-hidden="true" size={22} />, <>
        <div className="mt-4 grid grid-cols-2 gap-3">{[
          ["无收音 + 시", "가다 → 가세요", "바쁘다 → 바쁘세요"],
          ["有收音 + 으시", "읽다 → 읽으세요", "찾다 → 찾으세요"],
          ["ㄹ收音脱落", "살다 → 사세요", "알다 → 아세요"],
          ["特殊敬语优先", "있다 → 계세요", "먹다 → 드세요"],
          ["日常动作", "자다 → 주무세요", "말하다 → 말씀하세요"],
          ["形容词敬语", "아프다 → 아프세요", "좋다 → 좋으세요"],
        ].map(([rule, first, second]) => <article key={rule} className="rounded-2xl border border-[var(--border)] bg-white p-4"><b className="text-[var(--primary)]">{rule}</b><div className="mt-3 text-sm font-bold"><RuleSentence text={first.replace(" → ", ". ")} speak={speak}>{first}</RuleSentence><RuleSentence text={second.replace(" → ", ". ")} speak={speak}>{second}</RuleSentence></div></article>)}</div>
        <Note title="主语必须匹配" tone="rose">❌ 제가 학교에 가세요　✅ 제가 학교에 가요　✅ 아버지가 학교에 가세요。</Note>
      </>),
      "15": content("15", "1. 年龄转换实验", "普通年龄用 살；询问长辈时换成 연세，并使用主体敬语句尾。", <ContactRound aria-hidden="true" size={22} />, <>
        <div className="mt-4 grid grid-cols-2 gap-2.5">{[
          ["20", "스무 살"], ["21", "스물한 살"], ["34", "서른네 살"], ["45", "마흔다섯 살"],
          ["50", "쉰 살"], ["63", "예순세 살"], ["72", "일흔두 살"], ["88", "여든여덟 살"],
          ["30", "서른 살"], ["41", "마흔한 살"], ["56", "쉰여섯 살"], ["90", "아흔 살"],
        ].map(([number, korean]) => <article key={number} className="grid grid-cols-[65px_1fr] items-center rounded-xl border border-[var(--border)] bg-white p-3"><b className="text-[var(--status-warning)]">{number}岁</b><span className={`text-sm font-bold transition ${revealed.age ? "opacity-100" : "opacity-0"}`}>{korean}</span></article>)}</div>
        <div className="mt-4 grid grid-cols-2 gap-3"><Note title="平辈">몇 살이에요?<br/>스물한 살이에요.</Note><Note title="长辈" tone="amber">연세가 어떻게 되세요?<br/>연세가 일흔두 살이세요.</Note></div>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.age)} onClick={() => toggle("age")} answer />),
      "16": content("16", "2. 普通词 → 敬语词", "句尾礼貌并不等于主体敬语；名词和特殊动词也要一起升级。", <Crown aria-hidden="true" size={22} />, <>
        <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)]"><div className="grid grid-cols-3 bg-[var(--card)] p-3 text-center text-[11px] font-bold"><span>普通表达</span><span>敬语表达</span><span>完整句子</span></div>{[
          ["이름", "성함", "성함이 어떻게 되세요?"],
          ["나이", "연세", "연세가 어떻게 되세요?"],
          ["집", "댁", "댁에 계세요."],
          ["생일", "생신", "생신이 언제세요?"],
          ["있다", "계시다", "할머니가 계세요."],
          ["먹다", "드시다", "진지를 드세요."],
          ["자다", "주무시다", "일찍 주무세요."],
          ["말하다", "말씀하시다", "천천히 말씀하세요."],
          ["죽다", "돌아가시다", "할아버지가 돌아가셨어요."],
          ["사람", "분", "이분은 누구세요?"],
        ].map((row) => <div key={row[0]} className="grid grid-cols-3 border-t border-[var(--border)] p-3 text-center text-xs font-bold">{row.map((cell, index) => <span key={`${row[0]}-${index}`} className={`${index === 1 ? "text-[var(--destructive)]" : ""} ${index > 0 && !revealed.honorificTable ? "opacity-0" : "opacity-100"}`}>{cell}</span>)}</div>)}</div>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.honorificTable)} onClick={() => toggle("honorificTable")} answer />),
      "17": content("17", "3. 敬语升级诊所", "找出不自然之处，再完成名词、主语和谓语的同步升级。", <Languages aria-hidden="true" size={22} />, <>
        <div className="mt-4 space-y-2.5">{[
          ["할머니는 몇 살이에요?", "할머니는 연세가 어떻게 되세요?"],
          ["아버지가 집에 있어요.", "아버지가 댁에 계세요."],
          ["선생님이 밥을 먹어요.", "선생님이 진지를 드세요."],
          ["어머니가 자요.", "어머니가 주무세요."],
          ["이 사람은 누구예요?", "이분은 누구세요?"],
          ["아버지는 의사예요.", "아버지는 의사세요."],
          ["아버지가 서울에 살아요.", "아버지가 서울에 사세요."],
          ["할머니가 많이 아파요.", "할머니가 많이 아프세요."],
        ].map(([ordinary, honorific]) => <article key={ordinary} className="grid grid-cols-[1fr_30px_1fr] items-center rounded-xl border border-[var(--border)] bg-white p-3 text-xs font-bold"><span className="text-[var(--destructive)]">{ordinary}</span><span>→</span><span className={`text-[var(--status-success)] transition ${revealed.clinic ? "opacity-100" : "opacity-0"}`}>{honorific}</span></article>)}</div>
        <Note title="三层检查" tone="amber">先看称呼和名词，再看特殊敬语动词，最后检查 -(으)시- 与主语是否匹配。</Note>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.clinic)} onClick={() => toggle("clinic")} answer />),
      "23": content("23", "1. 家庭树表达", "从中心人物出发，用 제／내 和 가족称谓说明关系。", <UsersRound aria-hidden="true" size={22} />, <>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">{[
          ["祖父母", "할아버지 · 할머니", "연세가 일흔 살이세요."],
          ["父母", "아버지 · 어머니", "두 분 모두 회사원이세요."],
          ["兄弟姐妹", "형／오빠 · 누나／언니 · 동생", "동생이 한 명 있어요."],
          ["配偶", "남편 · 아내", "제 남편은 요리를 잘해요."],
          ["子女", "아들 · 딸", "딸이 두 명 있어요."],
          ["全家", "우리 가족", "우리 가족은 다섯 명이에요."],
          ["父母敬称", "아버님 · 어머님", "부모님 두 분이세요."],
          ["本人", "저／나", "저는 막내예요."],
        ].map(([group, words, sentence]) => <button key={group} type="button" onClick={() => speak(sentence)} className="rounded-2xl border border-[var(--border)] bg-white p-4 text-center"><b className="text-[var(--primary)]">{group}</b><p className="mt-2 text-xs font-bold">{words}</p><p className="mt-2 text-[10px] text-[var(--foreground-secondary)]">{sentence}</p></button>)}</div>
        <Note title="文化小提示">韩国日常介绍自己的父母常使用 아버지、어머니；对他人的父母可用 아버님、어머님表示尊敬。</Note>
      </>),
      "24": content("24", "2. 听力 · 人物档案", "听两遍，记录关系、年龄、职业、能力和所在地。", <Headphones aria-hidden="true" size={22} />, <>
        <button type="button" onClick={() => speak("이분은 제 어머니세요. 성함은 김미영이세요. 쉰여덟 살이시고 선생님이세요. 중국어를 잘하시고 요리도 아주 잘하세요. 지금은 부산에 사세요.")} className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] p-4 text-sm font-bold text-white"><Volume2 aria-hidden="true" size={17} />播放人物介绍</button>
        <div className="mt-5 grid grid-cols-2 gap-3">{[
          ["关系", "어머니"], ["姓名", "김미영"], ["年龄", "쉰여덟 살"], ["职业", "선생님"],
          ["能力", "중국어／요리"], ["居住地", "부산"],
          ["身份句", "제 어머니세요"], ["敬语谓语", "잘하세요／사세요"],
        ].map(([label, answer]) => <article key={label} className="rounded-2xl border border-[var(--border)] bg-white p-3"><b className="text-[11px] text-[var(--primary)]">{label}</b><p className={`mt-2 text-sm font-bold transition ${revealed.listening ? "opacity-100" : "opacity-0"}`}>{answer}</p></article>)}</div>
        <p className="mt-4 text-center text-[11px] font-bold text-[var(--foreground-secondary)]">先听写关键词，再点击右上角核对完整人物档案。</p>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.listening)} onClick={() => toggle("listening")} answer />),
      "25": content("25", "3. 家庭采访卡", "先判断对方谈的是本人、平辈还是长辈，再选择合适问题。", <Mic2 aria-hidden="true" size={22} />, <>
        <div className="mt-4 grid grid-cols-2 gap-3">{[
          ["家庭人数", "가족이 몇 명이에요?"],
          ["身份", "이분은 누구세요?"],
          ["长辈姓名", "성함이 어떻게 되세요?"],
          ["长辈年龄", "연세가 어떻게 되세요?"],
          ["职业", "무슨 일을 하세요?"],
          ["能力", "무엇을 잘하세요?"],
          ["居住", "어디에 사세요?"],
          ["日常", "주말에 무엇을 하세요?"],
        ].map(([topic, question]) => <button key={topic} type="button" onClick={() => speak(question)} className="rounded-2xl border border-[var(--border)] bg-white p-4 text-left"><b className="text-[10px] text-[var(--primary)]">{topic}</b><p className="mt-2 text-sm font-bold">{question}</p></button>)}</div>
        <Note title="提问礼貌" tone="amber">询问同伴本人可用 몇 살이에요?；询问对方长辈应改用 연세가 어떻게 되세요?</Note>
      </>),
      "27": content("27", "1. 阅读 · 三代人的家", "区分作者自己的普通信息与长辈的主体敬语表达。", <BookOpenCheck aria-hidden="true" size={22} />, <>
        <section className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-5"><p className="text-[11px] font-bold text-[var(--status-success)]">우리 가족</p><p className="mt-3 text-sm font-bold leading-7">우리 가족은 여섯 명입니다. 할머니, 부모님, 누나, 남동생 그리고 저입니다. 할머니는 일흔다섯 살이시고 댁에 계십니다. 아버지는 회사원이시고 운전을 잘하십니다. 어머니는 선생님이시고 요리를 아주 잘하십니다. 누나는 음악을 잘하지만 저는 노래를 잘 못합니다.</p></section>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">{[
          ["家里共有几个人？", "여섯 명"], ["奶奶多大年纪？", "일흔다섯 살"],
          ["父亲擅长什么？", "운전"], ["作者和姐姐的能力有什么不同？", "누나는 음악을 잘하지만 저는 노래를 잘 못합니다."],
          ["母亲的职业是什么？", "선생님"], ["奶奶在哪里？", "댁에 계십니다"],
        ].map(([question, answer], index) => <article key={question} className="rounded-xl bg-[var(--status-success-surface)] p-3 font-bold"><p><span className="mr-2 text-[var(--status-success)]">{index + 1}.</span>{question}</p><p className={`mt-2 text-[var(--status-success)] transition ${revealed.reading ? "opacity-100" : "opacity-0"}`}>{answer}</p></article>)}</div>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.reading)} onClick={() => toggle("reading")} answer />),
      "28": content("28", "2. 写作 · 我的家庭介绍", "写 8—10 句原创介绍，不必公开真实姓名，可使用虚构资料练习。", <NotebookPen aria-hidden="true" size={22} />, <>
        <div className="mt-4 grid grid-cols-2 gap-3"><Note title="内容骨架" tone="green">人数 → 两位家人身份 → 年龄 → 职业 → 能力 → 日常 → 自己与家人的共同点</Note><Note title="语法清单" tone="amber">제／내、잘하다三级、N(이)세요、-(으)시-各至少一次</Note></div>
        <section className="mt-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] p-5"><p className="text-[11px] font-bold text-[var(--status-success)]">原创示范</p><p className="mt-3 text-sm font-bold leading-7">우리 가족은 네 명이에요. 이분은 제 아버지세요. 쉰두 살이시고 회사원이세요. 운동을 잘하시지만 요리는 잘 못하세요. 제 어머니는 선생님이세요. 어머니는 요리를 아주 잘하시고 책을 많이 읽으세요. 저는 음악을 잘하지만 제 동생은 노래를 못해요.</p></section>
        <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] font-bold text-[var(--status-success)]">{["✓ 两种家庭关系","✓ 年龄与职业","✓ 能力三级比较","✓ 名词／主体敬语"].map((item) => <span key={item} className="rounded-xl bg-[var(--status-success-surface)] px-3 py-2">{item}</span>)}</div>
      </>),
      "30": content("30", "1. 家庭与年龄闪测", "看到中文后两秒内说出韩语。", <UsersRound aria-hidden="true" size={22} />, <div className="mt-4 grid grid-cols-3 gap-2.5">{[
        ["爷爷", "할아버지"], ["奶奶", "할머니"], ["父亲", "아버지"], ["母亲", "어머니"],
        ["丈夫", "남편"], ["妻子", "아내"], ["儿子", "아들"], ["女儿", "딸"],
        ["20岁", "스무 살"], ["50岁", "쉰 살"], ["70岁", "일흔 살"], ["90岁", "아흔 살"],
      ].map(([chinese, korean], index) => <article key={`${chinese}-${korean}`} className="rounded-xl border border-[var(--border)] bg-white p-3 text-center"><p className="text-[10px] text-[var(--status-success)]">{index + 1}</p><b>{chinese}</b><p className={`mt-2 rounded-lg bg-[var(--status-success-surface)] p-2 text-xs font-bold transition ${revealed.words ? "opacity-100" : "opacity-0"}`}>{korean}</p></article>)}</div>, <KoreanEbookRevealButton shown={Boolean(revealed.words)} onClick={() => toggle("words")} answer />),
      "31": content("31", "2. 敬语词汇检测", "把普通词升级为对长辈使用的表达。", <Crown aria-hidden="true" size={22} />, <>
        <div className="mt-4 grid grid-cols-2 gap-2.5">{[
          ["이름", "성함"], ["나이", "연세"], ["집", "댁"], ["생일", "생신"],
          ["사람", "분"], ["있다", "계시다"], ["먹다", "드시다"], ["자다", "주무시다"],
          ["말하다", "말씀하시다"], ["죽다", "돌아가시다"],
          ["밥", "진지"], ["부모", "부모님"],
        ].map(([ordinary, honorific], index) => <article key={`${ordinary}-${index}`} className="grid min-h-[54px] grid-cols-[1fr_30px_1fr] items-center rounded-xl border border-[var(--border)] bg-white p-4 text-xs font-bold"><span>{ordinary}</span><span>→</span><span className={`text-[var(--status-success)] transition ${revealed.honorifics ? "opacity-100" : "opacity-0"}`}>{honorific}</span></article>)}</div>
        <Note title="敏感词说明" tone="rose">돌아가시다用于礼貌说明某人去世。本课以识别为主，不把它用于轻率的日常提问。</Note>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.honorifics)} onClick={() => toggle("honorifics")} answer />),
      "32": content("32", "3. 综合句型检测", "完成所属、能力、名词敬语和主体敬语表达。", <CheckCircle2 aria-hidden="true" size={22} />, <div className="mt-4 space-y-2">{[
        ["这位是我的父亲。", "이분은 제 아버지세요."],
        ["母亲很擅长做饭。", "어머니는 요리를 잘하세요."],
        ["我不太会游泳。", "저는 수영을 잘 못해요."],
        ["父亲正在看报纸。", "아버지가 신문을 읽으세요."],
        ["奶奶在家。", "할머니가 댁에 계세요."],
        ["您尊姓大名？", "성함이 어떻게 되세요?"],
        ["父亲是医生。", "아버지는 의사세요."],
        ["母亲正在休息。", "어머니가 쉬세요."],
        ["爷爷正在用餐。", "할아버지가 진지를 드세요."],
        ["老师住在首尔。", "선생님이 서울에 사세요."],
      ].map(([question, answer], index) => <article key={`${question}-${index}`} className="grid grid-cols-2 gap-3 rounded-xl border border-[var(--border)] bg-white p-3 text-xs font-bold"><span>{index + 1}. {question}</span><span className={`text-[var(--status-success)] transition ${revealed.grammar ? "opacity-100" : "opacity-0"}`}>{answer}</span></article>)}</div>, <KoreanEbookRevealButton shown={Boolean(revealed.grammar)} onClick={() => toggle("grammar")} answer />),
      "33": content("33", "4. 口语验收 · 十句家庭介绍", "不看稿介绍两位家人，再回答同伴的三个追问。", <Mic2 aria-hidden="true" size={22} />, <>
        <section className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--status-success-surface)] p-5"><p className="text-xs font-bold text-[var(--status-success)]">八项必达信息</p><div className="mt-4 grid grid-cols-2 gap-3 text-xs">{["说明家庭人数","介绍两种关系","使用제或내","说出一个年龄","介绍职业","比较能力等级","使用N(이)세요","使用特殊敬语动词"].map((task, index) => <label key={`${task}-${index}`} className="flex items-center gap-2 rounded-xl bg-white p-3 font-bold"><input type="checkbox" className="accent-[var(--status-success)]" />{task}</label>)}</div></section>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center text-[11px] font-bold"><span className="rounded-xl bg-[var(--accent)] px-3 py-2 text-[var(--primary)]">信息完整 40%</span><span className="rounded-xl bg-[var(--status-success-surface)] px-3 py-2 text-[var(--status-success)]">敬语正确 40%</span><span className="rounded-xl bg-[var(--status-warning-surface)] px-3 py-2 text-[var(--status-warning)]">表达自然 20%</span></div>
        <button type="button" onClick={() => speak("우리 가족은 네 명이에요. 이분은 제 아버지세요. 아버지는 쉰두 살이세요. 회사원이시고 운전을 잘하세요. 주말에는 댁에서 책을 읽으세요. 이분은 제 어머니세요. 어머니는 선생님이세요. 요리를 아주 잘하시고 음악도 좋아하세요. 지금은 부모님 두 분 모두 부산에 사세요. 저는 주말마다 부모님 댁에 가요.")} className="mt-auto flex items-center justify-center gap-2 rounded-2xl bg-[var(--status-success)] p-4 text-sm font-bold text-white"><Volume2 aria-hidden="true" size={16} />播放十句示范</button>
      </>),
      "34": <div className="flex h-full flex-col justify-center"><div className="mx-auto w-full max-w-[440px] text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--status-success-surface)] text-[var(--status-success)]"><Sparkles aria-hidden="true" size={27} /></span><p className="mt-4 text-xs font-bold tracking-[0.18em] text-[var(--status-success)]">LESSON 09 · COMPLETE</p><h3 className="mt-3 text-4xl font-bold">이분은 누구세요?</h3><p className="mt-3 text-lg font-bold">你已经完成第九课</p><p className="mx-auto mt-3 max-w-[390px] text-sm leading-7 text-[var(--foreground-secondary)]">现在你能介绍家庭关系与能力，并根据主体身份正确切换名词敬语、身份敬语和动作敬语。</p><div className="mt-4 grid grid-cols-2 gap-3 text-left">{[
        ["01", "说明所属", "N(의) N"], ["02", "评价能力", "N을/를 잘하다"],
        ["03", "敬语身份", "N(이)세요"], ["04", "主体敬语", "A/V-(으)시-"],
      ].map(([index, title, detail]) => <div key={index} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3"><p className="text-[10px] font-bold text-[var(--status-success)]">{index}</p><p className="mt-1 text-xs font-bold">{title}</p><p className="mt-1 text-[10px] text-[var(--foreground-secondary)]">{detail}</p></div>)}</div><div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--status-success-surface)] px-5 py-3.5 text-left"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold tracking-[0.14em] text-[var(--status-success)]">LESSON 9 TEST · 本课测试</p><p className="mt-1 text-xs font-bold text-[var(--foreground-secondary)]">检验家庭、年龄、能力表达和主体敬语。</p></div><button type="button" onClick={() => window.location.assign("/dashboard/assignments/korean")} className="shrink-0 rounded-full bg-white px-3 py-2 text-[10px] font-bold text-[var(--status-success)] shadow-sm">前往测试专区</button></div></div><button type="button" onClick={() => flipBookRef.current?.pageFlip()?.flip(1)} className="mt-4 rounded-full bg-[var(--accent)] px-4 py-3 text-xs font-bold text-[var(--primary)]">返回目录</button></div></div>,
    };
    return pages[number];
  }

  const pages = Array.from({ length: 34 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return <Page key={`09-${number}`} number={number}>{renderPage(number)}</Page>;
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
