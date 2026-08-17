"use client";

import dynamic from "next/dynamic";

const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false });
import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ClipboardPlus,
  Cross,
  Headphones,
  HeartPulse,
  MessageCircle,
  Mic2,
  NotebookPen,
  Pill,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Thermometer,
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
type Word = { korean: string; pronunciation?: string; type: string; chinese: string };
type Line = { speaker: string; korean: string; chinese: string };
type FlipBookHandle = { pageFlip: () => { flip: (page: number) => void; flipNext: () => void; flipPrev: () => void } | undefined };

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

const Page = forwardRef<HTMLDivElement, { children: ReactNode; number: string; cover?: boolean }>(
  function Page({ children, number, cover = false }, ref) {
    return (
      <KoreanEbookPage
        ref={ref}
        number={number}
        header={TEMPLATE.headers[number] ?? "第 11 课 · 감기에 걸렸어요."}
        cover={cover}
        sectionMeta={TEMPLATE.pageMeta[number]}
        hideContentOverflow
      >
        {children}
      </KoreanEbookPage>
    );
  }
);

function Heading({ page, title, description, icon, action }: { page: string; title: string; description: string; icon: ReactNode; action?: ReactNode }) {
  return <KoreanEbookHeading step={TEMPLATE.pageMeta[page]?.tag ?? "第八步"} title={title} description={description} icon={icon} action={action} />;
}

function Note({ title, children, tone = "blue" }: { title: string; children: ReactNode; tone?: "blue" | "rose" | "green" | "amber" | "purple" }) {
  const tones = {
    blue: "border-[var(--border)] bg-[var(--accent)] text-[var(--primary)]",
    rose: "border-[var(--border)] bg-[var(--card)] text-[var(--destructive)]",
    green: "border-[var(--border)] bg-[var(--status-success-surface)] text-[var(--status-success)]",
    amber: "border-[var(--border)] bg-[var(--status-warning-surface)] text-[var(--status-warning)]",
    purple: "border-[var(--border)] bg-[var(--card)] text-[var(--primary)]",
  };
  return <section className={`mt-4 rounded-2xl border p-4 ${tones[tone]}`}><p className="text-[11px] font-bold">{title}</p><div className="mt-2 text-xs font-bold leading-6 text-[var(--foreground-secondary)]">{children}</div></section>;
}

function RuleSentence({ children, text, speak }: { children: ReactNode; text: string; speak: Speak }) {
  return <div className="flex items-center justify-between gap-2"><span className="min-w-0">{children}</span><KoreanEbookSpeakButton text={text} onSpeak={speak} compact /></div>;
}

function WordGrid({ words, speak, showChinese }: { words: Word[]; speak: Speak; showChinese: boolean }) {
  return <div className={`mt-4 grid grid-cols-3 gap-3 ${showChinese ? "" : "[&_[data-vocab-meaning]]:opacity-0"}`}>{words.map((word) => <KoreanEbookVocabularyCard key={`${word.korean}-${word.type}-${word.chinese}`} {...word} onSpeak={speak} compact={words.length >= 12} />)}</div>;
}

function Dialogue({ lines, speak, showChinese }: { lines: Line[]; speak: Speak; showChinese: boolean }) {
  return <div className="mt-4 grid grid-cols-2 gap-3">{lines.map((line, index) => (
    <div key={`${index}-${line.speaker}-${line.korean}`} className={`flex gap-2 rounded-xl p-3.5 ${index % 2 ? "bg-[var(--status-warning-surface)]" : "bg-[var(--status-success-surface)]"}`}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-bold">{line.speaker}</span>
      <div className="min-w-0 flex-1"><p className="text-[13px] font-bold leading-6">{line.korean}</p><p className={`text-[10px] font-bold leading-5 text-[var(--foreground-secondary)] ${showChinese ? "opacity-100" : "opacity-0"}`}>{line.chinese}</p></div>
      <KoreanEbookSpeakButton text={line.korean} onSpeak={speak} compact />
    </div>
  ))}</div>;
}

const bodyWords: Word[] = [
  { korean: "머리", type: "身体部位", chinese: "头／头发" }, { korean: "얼굴", type: "身体部位", chinese: "脸" },
  { korean: "눈", type: "身体部位", chinese: "眼睛" }, { korean: "코", type: "身体部位", chinese: "鼻子" },
  { korean: "입", type: "身体部位", chinese: "嘴巴" }, { korean: "귀", type: "身体部位", chinese: "耳朵" },
  { korean: "목", type: "身体部位", chinese: "脖子／喉咙" }, { korean: "배", type: "身体部位", chinese: "肚子" },
  { korean: "손", type: "身体部位", chinese: "手" }, { korean: "발", type: "身体部位", chinese: "脚" },
  { korean: "팔", type: "身体部位", chinese: "胳膊" }, { korean: "다리", type: "身体部位", chinese: "腿" },
  { korean: "허리", type: "身体部位", chinese: "腰" }, { korean: "이", type: "身体部位", chinese: "牙齿" },
  { korean: "몸", type: "身体名词", chinese: "身体" },
];

const symptomWords: Word[] = [
  { korean: "아프다 → 아파요", type: "症状形容词", chinese: "疼／生病" },
  { korean: "감기에 걸리다", type: "症状表达", chinese: "感冒" },
  { korean: "열이 나다", type: "症状表达", chinese: "发烧" },
  { korean: "기침을 하다", type: "症状表达", chinese: "咳嗽" },
  { korean: "콧물이 나다", type: "症状表达", chinese: "流鼻涕" },
  { korean: "목이 붓다", type: "症状表达", chinese: "喉咙肿" },
  { korean: "머리가 아프다", type: "症状表达", chinese: "头疼" },
  { korean: "배가 아프다", type: "症状表达", chinese: "肚子疼" },
  { korean: "어지럽다", type: "症状形容词", chinese: "头晕" },
  { korean: "피곤하다", type: "状态形容词", chinese: "疲劳" },
  { korean: "소화가 안 되다", type: "症状表达", chinese: "消化不良" },
  { korean: "잠을 못 자다", type: "症状表达", chinese: "睡不着" },
  { korean: "다치다", type: "症状动词", chinese: "受伤" },
  { korean: "낫다", type: "恢复动词", chinese: "痊愈／好转" },
  { korean: "심하다", type: "程度形容词", chinese: "严重" },
];

const careWords: Word[] = [
  { korean: "병원", type: "医疗场所", chinese: "医院" }, { korean: "약국", type: "医疗场所", chinese: "药店" },
  { korean: "의사", type: "医疗人员", chinese: "医生" }, { korean: "간호사", type: "医疗人员", chinese: "护士" },
  { korean: "환자", type: "医疗人员", chinese: "患者" }, { korean: "약", type: "医疗用品", chinese: "药" },
  { korean: "처방전", type: "医疗用品", chinese: "处方" }, { korean: "체온", type: "医疗名词", chinese: "体温" },
  { korean: "진료", type: "医疗名词", chinese: "诊疗" }, { korean: "예약", type: "医疗名词", chinese: "预约" },
  { korean: "약을 먹다", type: "治疗词块", chinese: "吃药" }, { korean: "푹 쉬다", type: "治疗词块", chinese: "充分休息" },
  { korean: "물을 마시다", type: "治疗词块", chinese: "喝水" }, { korean: "체온을 재다", type: "治疗词块", chinese: "量体温" },
  { korean: "진찰을 받다", type: "治疗词块", chinese: "接受诊察" },
];

const adviceWords: Word[] = [
  { korean: "마시지 마세요", type: "禁止表达", chinese: "请不要喝" }, { korean: "운동하지 마세요", type: "禁止表达", chinese: "请不要运动" },
  { korean: "나가지 마세요", type: "禁止表达", chinese: "请不要出去" }, { korean: "늦게 자지 마세요", type: "禁止表达", chinese: "请不要晚睡" },
  { korean: "약을 먹어야 돼요", type: "义务表达", chinese: "必须吃药" }, { korean: "푹 쉬어야 돼요", type: "义务表达", chinese: "必须充分休息" },
  { korean: "병원에 가야 돼요", type: "义务表达", chinese: "必须去医院" }, { korean: "물을 마셔야 돼요", type: "义务表达", chinese: "必须喝水" },
  { korean: "물만 마셔요", type: "限定表达", chinese: "只喝水" }, { korean: "집에서만 쉬어요", type: "限定表达", chinese: "只在家休息" },
  { korean: "아침에만 먹어요", type: "限定表达", chinese: "只在早上吃" }, { korean: "하루에 세 번", type: "服药表达", chinese: "一天三次" },
];

const dividers: Record<string, { step: string; title: string; goal: string; icon: ReactNode }> = {
  "02": { step: "第一步", title: "课前导航", goal: "建立“描述症状—确认情况—给出必须事项—说明禁止事项”的医疗交流链。", icon: <Stethoscope aria-hidden="true" size={24} /> },
  "04": { step: "第二步", title: "核心词汇", goal: "把身体部位、症状、医疗用品和建议表达组成可直接使用的词块。", icon: <HeartPulse aria-hidden="true" size={24} /> },
  "09": { step: "第三步", title: "语法讲解", goal: "四项语法各占一页：ㅡ脱落、禁止、限定和义务表达。", icon: <NotebookPen aria-hidden="true" size={24} /> },
  "14": { step: "第四步", title: "句型操练", goal: "从症状匹配进入医生建议，准确区分能做、不能做和必须做。", icon: <ClipboardPlus aria-hidden="true" size={24} /> },
  "18": { step: "第五步", title: "实战对话", goal: "在医院、药店和朋友关怀三个场景中完成三组八句交流。", icon: <MessageCircle aria-hidden="true" size={24} /> },
  "22": { step: "第六步", title: "听说任务", goal: "听取症状与服药信息，并口头生成结构清楚的就医对话。", icon: <Headphones aria-hidden="true" size={24} /> },
  "26": { step: "第七步", title: "读写拓展", goal: "读懂初级健康说明卡，写出语言学习用途的症状与建议记录。", icon: <BookOpenCheck aria-hidden="true" size={24} /> },
  "29": { step: "第八步", title: "自测与复盘", goal: "检查身体词汇、ㅡ变化、禁止、限定与义务表达。", icon: <CheckCircle2 aria-hidden="true" size={24} /> },
};

export function KoreanLevelOneLessonElevenBook({ lesson, isFullscreen, initialPage = 0, onPageChange, speechRate = 0.78 }: { lesson: KoreanLevelOneLesson; isFullscreen: boolean; initialPage?: number; onPageChange?: (page: number) => void; speechRate?: number }) {
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

  const content = (number: string, title: string, description: string, icon: ReactNode, body: ReactNode, action?: ReactNode) => (
    <div className="flex h-full flex-col"><Heading page={number} title={title} description={description} icon={icon} action={action} />{body}</div>
  );

  const dialogues: Record<string, { title: string; description: string; lines: Line[] }> = {
    "19": { title: "场景 1 · 医院问诊", description: "准确说明症状、持续时间和严重程度，并听懂医生建议。", lines: [
      { speaker: "医", korean: "어디가 아파요?", chinese: "哪里不舒服？" }, { speaker: "患", korean: "머리가 아프고 열이 나요.", chinese: "头疼并且发烧。" },
      { speaker: "医", korean: "언제부터 아팠어요?", chinese: "从什么时候开始不舒服？" }, { speaker: "患", korean: "어제 저녁부터 아팠어요.", chinese: "从昨天晚上开始。" },
      { speaker: "医", korean: "기침도 해요?", chinese: "也咳嗽吗？" }, { speaker: "患", korean: "네, 기침을 하고 콧물도 나요.", chinese: "是的，咳嗽，也流鼻涕。" },
      { speaker: "医", korean: "감기에 걸렸어요. 약을 먹어야 돼요.", chinese: "感冒了，必须吃药。" }, { speaker: "医", korean: "오늘은 운동하지 말고 푹 쉬세요.", chinese: "今天不要运动，请充分休息。" },
    ]},
    "20": { title: "场景 2 · 药店取药", description: "确认服药次数、时间和饮食限制。", lines: [
      { speaker: "药", korean: "어디가 불편하세요?", chinese: "哪里不舒服？" }, { speaker: "客", korean: "목이 아프고 기침을 해요.", chinese: "喉咙疼并且咳嗽。" },
      { speaker: "药", korean: "이 약을 드세요.", chinese: "请服用这个药。" }, { speaker: "客", korean: "하루에 몇 번 먹어야 돼요?", chinese: "一天必须吃几次？" },
      { speaker: "药", korean: "하루에 세 번 먹어야 돼요.", chinese: "一天必须吃三次。" }, { speaker: "客", korean: "식사 전에 먹어요?", chinese: "饭前吃吗？" },
      { speaker: "药", korean: "아니요, 식사 후에만 드세요.", chinese: "不，请只在饭后服用。" }, { speaker: "药", korean: "약을 먹을 때 술을 마시지 마세요.", chinese: "服药时请不要喝酒。" },
    ]},
    "21": { title: "场景 3 · 朋友的关心", description: "说明身体状态，并用本课语法给出生活建议。", lines: [
      { speaker: "友", korean: "오늘 얼굴이 안 좋아 보여요.", chinese: "今天看起来脸色不好。" }, { speaker: "我", korean: "네, 감기에 걸렸어요.", chinese: "是的，感冒了。" },
      { speaker: "友", korean: "열이 나요?", chinese: "发烧吗？" }, { speaker: "我", korean: "열은 없지만 목이 많이 아파요.", chinese: "不发烧，但喉咙很疼。" },
      { speaker: "友", korean: "따뜻한 물을 많이 마셔야 돼요.", chinese: "必须多喝温水。" }, { speaker: "我", korean: "커피는 마셔도 돼요?", chinese: "可以喝咖啡吗？" },
      { speaker: "友", korean: "오늘은 물만 마시고 커피는 마시지 마세요.", chinese: "今天只喝水，不要喝咖啡。" }, { speaker: "我", korean: "네, 집에서 푹 쉴게요.", chinese: "好，我会在家充分休息。" },
    ]},
  };

  function renderPage(number: string) {
    if (number === "01") return <KoreanEbookTableOfContents lessonNumber={11} pageMeta={TEMPLATE.pageMeta} onNavigate={(target) => flipBookRef.current?.pageFlip()?.flip(target)} entries={[
      { step: "01", title: "课前导航", pageRange: "02—03", detail: "建立看病交流流程" }, { step: "02", title: "核心词汇", pageRange: "04—08", detail: "身体·症状·医疗·建议" },
      { step: "03", title: "语法讲解", pageRange: "09—13", detail: "ㅡ脱落·禁止·限定·义务" }, { step: "04", title: "句型操练", pageRange: "14—17", detail: "症状匹配与建议生成" },
      { step: "05", title: "实战对话", pageRange: "18—21", detail: "三组八句医疗交流" }, { step: "06", title: "听说任务", pageRange: "22—25", detail: "听症状·说建议" },
      { step: "07", title: "读写拓展", pageRange: "26—28", detail: "读说明·写健康记录" }, { step: "08", title: "自测与复盘", pageRange: "29—34", detail: "综合验收与结束页" },
    ]} />;
    if (dividers[number]) return <KoreanEbookSectionDivider {...dividers[number]} />;
    if (dialogues[number]) {
      const dialogue = dialogues[number];
      return content(number, dialogue.title, dialogue.description, <MessageCircle aria-hidden="true" size={22} />, <><Dialogue lines={dialogue.lines} speak={speak} showChinese={Boolean(revealed[`chinese${number}`])} /><Note title="角色交换" tone="rose">替换症状、持续时间和建议，再完成一轮不少于八句的对话。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed[`chinese${number}`])} onClick={() => toggle(`chinese${number}`)} />);
    }

    const pages: Record<string, ReactNode> = {
      "03": content("03", "医生的万能三连击", "先听症状，再说明必须做的事，最后提醒不能做的事。", <Stethoscope aria-hidden="true" size={22} />, <>
        <div className="mt-5 grid grid-cols-2 gap-3">{[
          ["症状", "배가 아파요.", "肚子疼。"], ["诊断", "감기에 걸렸어요.", "感冒了。"],
          ["必须", "약을 먹어야 돼요.", "必须吃药。"], ["禁止", "운동하지 마세요.", "请不要运动。"],
          ["限定", "따뜻한 물만 마셔요.", "只喝温水。"], ["复查", "계속 아프면 다시 오세요.", "持续不适请再来。" ],
        ].map(([tag, korean, chinese]) => <button key={tag} type="button" onClick={() => speak(korean)} className="rounded-2xl border border-[var(--border)] bg-white p-4 text-left"><b className="text-[10px] text-[var(--status-warning)]">{tag}</b><div className="mt-2 flex items-center justify-between gap-2"><p className="text-sm font-bold">{korean}</p><Volume2 aria-hidden="true" size={14} className="shrink-0 text-[var(--primary)]" /></div><p className={`mt-1 text-[11px] text-[var(--foreground-secondary)] ${revealed.chinese03 ? "opacity-100" : "opacity-0"}`}>{chinese}</p></button>)}</div>
        <Note title="语言学习边界" tone="amber">本课练习韩语看病表达。真实不适、持续高烧、呼吸困难或严重疼痛时，应及时联系专业医疗机构。</Note>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese03)} onClick={() => toggle("chinese03")} />),
      "05": content("05", "1. 身体部位", "身体部位通常加 이/가，再接 아파요描述疼痛。", <Activity aria-hidden="true" size={22} />, <><WordGrid words={bodyWords} speak={speak} showChinese={Boolean(revealed.chinese05)} /><Note title="句型词块">머리가 아파요／배가 아파요／목이 아파요。不要把身体部位误标成动作宾语。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese05)} onClick={() => toggle("chinese05")} />),
      "06": content("06", "2. 常见症状", "症状既有形容词，也有“名词 + 이/가 + 动词”的固定搭配。", <Thermometer aria-hidden="true" size={22} />, <><WordGrid words={symptomWords} speak={speak} showChinese={Boolean(revealed.chinese06)} /><Note title="搭配优先">韩语说 열이 나요、기침을 해요、콧물이 나요；不要逐字翻译中文结构。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese06)} onClick={() => toggle("chinese06")} />),
      "07": content("07", "3. 医疗场所与治疗词块", "从挂号、问诊到取药，把名词和动作一起记。", <Cross aria-hidden="true" size={22} />, <><WordGrid words={careWords} speak={speak} showChinese={Boolean(revealed.chinese07)} /><Note title="流程地图" tone="green">병원 → 진찰을 받다 → 처방전 → 약국 → 약을 먹다。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese07)} onClick={() => toggle("chinese07")} />),
      "08": content("08", "4. 禁止、必须与限定词块", "先熟悉完整医嘱，再在语法页拆解规则。", <ShieldAlert aria-hidden="true" size={22} />, <><WordGrid words={adviceWords} speak={speak} showChinese={Boolean(revealed.chinese08)} /><Note title="建议组合" tone="rose">약을 먹어야 돼요. 그리고 오늘은 운동하지 마세요.</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese08)} onClick={() => toggle("chinese08")} />),
      "10": content("10", "1. ㅡ 탈락", "词干末尾ㅡ遇到아/어词尾时脱落，再看前一音节决定아或어。", <NotebookPen aria-hidden="true" size={22} />, <>
        <div className="mt-4 grid grid-cols-3 gap-3">{[
          ["前一元音ㅏ／ㅗ", "아프다 → 아파요", "바쁘다 → 바빠요"],
          ["前一元音为其他", "예쁘다 → 예뻐요", "기쁘다 → 기뻐요"],
          ["前面没有音节", "크다 → 커요", "쓰다 → 써요"],
        ].map(([rule, first, second]) => <article key={rule} className="rounded-2xl border border-[var(--border)] bg-white p-4"><b className="text-[11px] text-[var(--primary)]">{rule}</b><div className="mt-3 text-xs font-bold"><RuleSentence text={first.replace(" → ", ". ")} speak={speak}>{first}</RuleSentence><RuleSentence text={second.replace(" → ", ". ")} speak={speak}>{second}</RuleSentence></div></article>)}</div>
        <Note title="判断路线" tone="purple">去掉다 → 确认词干末尾ㅡ → ㅡ脱落 → 查看前一音节元音 → 连接아요或어요。</Note>
        <Note title="本课核心句" tone="green"><RuleSentence text="머리가 아파요." speak={speak}>머리가 아파요.（头疼）</RuleSentence><RuleSentence text="오늘 많이 바빠요." speak={speak}>오늘 많이 바빠요.（今天很忙）</RuleSentence></Note>
        <div className="grid grid-cols-2 gap-3">
          <Note title="其他元音练习" tone="amber"><RuleSentence text="기분이 슬퍼요." speak={speak}>슬프다 → 슬퍼요</RuleSentence><RuleSentence text="몸이 나빠요." speak={speak}>나쁘다 → 나빠요</RuleSentence></Note>
          <Note title="无前一音节练习" tone="blue"><RuleSentence text="불을 꺼요." speak={speak}>끄다 → 꺼요</RuleSentence><RuleSentence text="해가 떠요." speak={speak}>뜨다 → 떠요</RuleSentence></Note>
        </div>
      </>),
      "11": content("11", "2. V-지 마세요", "词干直接加지 마세요，表达禁止、劝阻或礼貌提醒。", <ShieldAlert aria-hidden="true" size={22} />, <>
        <div className="mt-4 space-y-3">{[
          ["饮食", "술을 마시지 마세요.", "请不要喝酒。"], ["活动", "오늘은 운동하지 마세요.", "今天请不要运动。"],
          ["作息", "늦게 자지 마세요.", "请不要晚睡。"], ["外出", "밖에 나가지 마세요.", "请不要外出。"],
        ].map(([kind, korean, chinese]) => <article key={kind} className="rounded-2xl border border-[var(--border)] bg-white p-4"><b className="text-[11px] text-[var(--primary)]">{kind}</b><div className="mt-2 text-sm font-bold"><RuleSentence text={korean} speak={speak}>{korean}</RuleSentence></div><p className={`mt-1 text-xs text-[var(--foreground-secondary)] ${revealed.chinese11 ? "opacity-100" : "opacity-0"}`}>{chinese}</p></article>)}</div>
        <Note title="不需要动词变形" tone="rose">먹다 → 먹지 마세요，하다 → 하지 마세요。不要先变成먹어요或해요。</Note>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese11)} onClick={() => toggle("chinese11")} />),
      "12": content("12", "3. N만", "限定为“只、仅仅”；通常替换이/가或을/를，但排在에、에서后面。", <Pill aria-hidden="true" size={22} />, <>
        <div className="mt-4 grid grid-cols-2 gap-3">{[
          ["替换 을/를", "물만 마셔요.", "只喝水。"], ["替换 이/가", "선생님만 계세요.", "只有老师在。"],
          ["地点助词保留", "집에서만 쉬어요.", "只在家休息。"], ["时间助词保留", "아침에만 약을 먹어요.", "只在早上吃药。"],
          ["数量限定", "약을 한 알만 먹어요.", "只吃一粒药。"], ["对象限定", "의사 선생님만 만나요.", "只见医生。" ],
        ].map(([rule, korean, chinese]) => <article key={rule} className="rounded-2xl border border-[var(--border)] bg-white p-4"><b className="text-[var(--primary)]">{rule}</b><div className="mt-3 text-sm font-bold"><RuleSentence text={korean} speak={speak}>{korean}</RuleSentence></div><p className={`mt-1 text-xs text-[var(--foreground-secondary)] ${revealed.chinese12 ? "opacity-100" : "opacity-0"}`}>{chinese}</p></article>)}</div>
        <Note title="助词顺序" tone="amber">집에서 + 만 → 집에서만；아침에 + 만 → 아침에만。不能说집만 공부해요来表达“只在家学习”。</Note>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese12)} onClick={() => toggle("chinese12")} />),
      "13": content("13", "4. V-아야／어야 되다", "表示义务、必要条件或必须采取的行动，口语常用돼요。", <ClipboardPlus aria-hidden="true" size={22} />, <>
        <div className="mt-4 grid grid-cols-2 gap-3">{[
          ["ㅏ／ㅗ → -아야 돼요", "가다 → 가야 돼요", "자다 → 자야 돼요"],
          ["其他元音 → -어야 돼요", "먹다 → 먹어야 돼요", "쉬다 → 쉬어야 돼요"],
          ["하다 → 해야 돼요", "공부하다 → 공부해야 돼요", "운동하다 → 운동해야 돼요"],
          ["ㅡ脱落后连接", "아프다 → 아파야 돼요", "쓰다 → 써야 돼요"],
          ["健康建议", "마시다 → 마셔야 돼요", "자다 → 자야 돼요"],
          ["就医行动", "받다 → 받아야 돼요", "재다 → 재야 돼요"],
        ].map(([rule, first, second]) => <article key={rule} className="rounded-2xl border border-[var(--border)] bg-white p-4"><b className="text-[var(--primary)]">{rule}</b><div className="mt-3 text-sm font-bold"><RuleSentence text={first.replace(" → ", ". ")} speak={speak}>{first}</RuleSentence><RuleSentence text={second.replace(" → ", ". ")} speak={speak}>{second}</RuleSentence></div></article>)}</div>
        <Note title="되다的缩约" tone="green">되어요 → 돼요，因此口语写먹어야 돼요。不要把돼写成되。</Note>
      </>),
      "15": content("15", "1. 症状匹配实验", "根据身体部位选择自然的症状表达。", <HeartPulse aria-hidden="true" size={22} />, <>
        <div className="mt-4 grid grid-cols-2 gap-2.5">{[
          ["머리", "머리가 아파요."], ["배", "배가 아파요."], ["목", "목이 아프고 부었어요."], ["코", "콧물이 나요."],
          ["몸", "열이 나고 피곤해요."], ["귀", "귀가 아파요."], ["다리", "다리를 다쳤어요."], ["이", "이가 아파요."],
          ["허리", "허리가 아파요."], ["눈", "눈이 아파요."], ["손", "손을 다쳤어요."], ["얼굴", "얼굴이 부었어요."],
        ].map(([part, answer]) => <article key={part} className="grid grid-cols-[70px_1fr] items-center rounded-xl border border-[var(--border)] bg-white p-3"><b>{part}</b><span className={`text-sm font-bold text-[var(--status-warning)] ${revealed.symptom ? "opacity-100" : "opacity-0"}`}>{answer}</span></article>)}</div>
        <Note title="先判断表达类型" tone="amber">疼痛通常用“身体部位 + 이/가 + 아파요”；受伤通常用“身体部位 + 을/를 + 다쳤어요”。</Note>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.symptom)} onClick={() => toggle("symptom")} answer />),
      "16": content("16", "2. 医生建议生成器", "把同一症状转换成“必须做”和“不要做”两类建议。", <Stethoscope aria-hidden="true" size={22} />, <>
        <div className="mt-4 space-y-2.5">{[
          ["감기에 걸렸어요.", "약을 먹어야 돼요.", "운동하지 마세요."],
          ["열이 많이 나요.", "병원에 가야 돼요.", "밖에 나가지 마세요."],
          ["목이 아파요.", "따뜻한 물을 마셔야 돼요.", "찬 음료를 마시지 마세요."],
          ["많이 피곤해요.", "푹 쉬어야 돼요.", "늦게 자지 마세요."],
          ["배가 아파요.", "진찰을 받아야 돼요.", "찬 음식을 먹지 마세요."],
          ["허리를 다쳤어요.", "병원에 가야 돼요.", "무리하게 움직이지 마세요."],
          ["잠을 못 잤어요.", "일찍 자야 돼요.", "커피를 많이 마시지 마세요."],
          ["소화가 안 돼요.", "따뜻한 물을 마셔야 돼요.", "기름진 음식을 먹지 마세요."],
        ].map(([symptom, must, ban]) => <article key={symptom} className="grid grid-cols-3 gap-3 rounded-xl border border-[var(--border)] bg-white p-3 text-xs font-bold"><span>{symptom}</span><span className={`text-[var(--status-success)] ${revealed.advice ? "opacity-100" : "opacity-0"}`}>{must}</span><span className={`text-[var(--destructive)] ${revealed.advice ? "opacity-100" : "opacity-0"}`}>{ban}</span></article>)}</div>
        <p className="mt-3 grid grid-cols-3 text-center text-[10px] font-bold text-[var(--foreground-secondary)]"><span>症状</span><span>必须做</span><span>不要做</span></p>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.advice)} onClick={() => toggle("advice")} answer />),
      "17": content("17", "3. 만 助词诊所", "判断만替换原助词，还是排在时间、地点助词后面。", <Pill aria-hidden="true" size={22} />, <>
        <div className="mt-4 grid grid-cols-2 gap-3">{[
          ["물(을) + 만", "물만 마셔요."], ["과일(을) + 만", "과일만 먹어요."],
          ["선생님(이) + 만", "선생님만 계세요."], ["집에서 + 만", "집에서만 쉬어요."],
          ["아침에 + 만", "아침에만 약을 먹어요."], ["병원에 + 만", "병원에만 가요."],
          ["약(을) + 만", "약만 먹어요."], ["한 알 + 만", "한 알만 먹어요."],
          ["식사 후에 + 만", "식사 후에만 먹어요."], ["주말에 + 만", "주말에만 쉬어요."],
        ].map(([formula, answer]) => <article key={formula} className="rounded-2xl border border-[var(--border)] bg-white p-4"><b className="text-[11px] text-[var(--status-warning)]">{formula}</b><p className={`mt-2 text-sm font-bold ${revealed.only ? "opacity-100" : "opacity-0"}`}>{answer}</p></article>)}</div>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.only)} onClick={() => toggle("only")} answer />),
      "23": content("23", "1. 听力 · 症状记录表", "第一遍抓身体部位，第二遍补症状和持续时间。", <Headphones aria-hidden="true" size={22} />, <>
        <button type="button" onClick={() => speak("어제 저녁부터 목이 아프고 기침을 했어요. 오늘 아침에는 열도 났어요. 콧물이 나고 몸이 많이 피곤해요. 병원에 가서 진찰을 받아야 돼요.")} className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] p-4 text-sm font-bold text-white"><Volume2 aria-hidden="true" size={17} />播放症状描述</button>
        <div className="mt-5 grid grid-cols-2 gap-3">{[
          ["开始时间", "어제 저녁"], ["疼痛部位", "목"], ["呼吸道症状", "기침／콧물"],
          ["全身症状", "열／피곤함"], ["必须做", "병원에 가다"], ["医疗行动", "진찰을 받다"],
          ["开始的日期", "어제"], ["建议的顺序", "병원 → 진찰"],
        ].map(([label, answer]) => <article key={label} className="rounded-2xl border border-[var(--border)] bg-white p-3"><b className="text-[11px] text-[var(--primary)]">{label}</b><p className={`mt-2 text-sm font-bold ${revealed.listening ? "opacity-100" : "opacity-0"}`}>{answer}</p></article>)}</div>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.listening)} onClick={() => toggle("listening")} answer />),
      "24": content("24", "2. 医嘱四步卡", "按“症状—必须—禁止—限定”顺序复述。", <ClipboardPlus aria-hidden="true" size={22} />, <>
        <div className="mt-4 space-y-2.5">{[
          ["01 症状", "감기에 걸려서 열이 나요."], ["02 必须", "약을 먹고 푹 쉬어야 돼요."],
          ["03 禁止", "오늘은 운동하지 마세요."], ["04 限定", "따뜻한 물만 마시세요."],
          ["05 复查", "계속 아프면 다시 병원에 가세요."],
          ["06 确认", "약은 식사 후에만 드세요."],
        ].map(([step, sentence]) => <article key={step} className="grid grid-cols-[80px_1fr] items-center rounded-xl border border-[var(--border)] bg-white p-3"><b className="text-[var(--primary)]">{step}</b><RuleSentence text={sentence} speak={speak}><span className="text-sm font-bold">{sentence}</span></RuleSentence></article>)}</div>
        <Note title="安全表达">语言练习中只使用一般性建议；不要根据练习文本自行诊断或改变真实药物用法。</Note>
      </>),
      "25": content("25", "3. 90秒问诊角色扮演", "病人至少说明三项信息，医生至少给出三条建议。", <Mic2 aria-hidden="true" size={22} />, <>
        <div className="mt-4 grid grid-cols-2 gap-3"><Note title="病人脚手架">어디가 아파요?<br/>______부터 아팠어요.<br/>______도 나고 ______도 해요.<br/>많이／조금 아파요.</Note><Note title="医生脚手架" tone="green">______해야 돼요.<br/>______지 마세요.<br/>______만 드세요.<br/>계속 아프면 다시 오세요.</Note><Note title="症状替换" tone="amber">머리／목／배／허리<br/>열／기침／콧물／피곤</Note><Note title="建议替换" tone="purple">약을 먹다／푹 쉬다<br/>물을 마시다／병원에 가다</Note></div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] font-bold text-[var(--primary)]"><span className="rounded-xl bg-[var(--card)] px-3 py-3">场景 A · 感冒与发烧</span><span className="rounded-xl bg-[var(--card)] px-3 py-3">场景 B · 肚子疼</span></div>
        <p className="mt-4 rounded-xl bg-[var(--card)] p-3 text-center text-[11px] font-bold text-[var(--destructive)]">验收：症状3项＋持续时间＋必须1项＋禁止1项＋限定1项。</p>
      </>),
      "27": content("27", "1. 阅读 · 감기 안내 카드", "找出症状、服用说明、禁止事项和需要再次就医的条件。", <BookOpenCheck aria-hidden="true" size={22} />, <>
        <section className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-5"><p className="text-[11px] font-bold text-[var(--status-success)]">감기에 걸렸을 때</p><p className="mt-3 text-sm font-bold leading-7">감기에 걸리면 목이 아프고 열이 날 수 있어요. 물을 많이 마시고 푹 쉬어야 돼요. 약은 식사 후에만 드세요. 술을 마시지 말고 무리하게 운동하지 마세요. 열이 계속 나거나 숨쉬기가 힘들면 병원에 가세요.</p></section>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">{[
          ["必须做哪两件事？", "물을 마시다／푹 쉬다"], ["药什么时候吃？", "식사 후에만"],
          ["不能做什么？", "술／무리한 운동"], ["什么情况下去医院？", "열이 계속 나거나 숨쉬기가 힘들 때"],
          ["出现哪些症状？", "목이 아프다／열이 나다"], ["限定助词在哪里？", "식사 후에만"],
        ].map(([question, answer], index) => <article key={question} className="rounded-xl bg-[var(--status-success-surface)] p-3 font-bold"><p><span className="mr-2 text-[var(--status-success)]">{index + 1}.</span>{question}</p><p className={`mt-2 text-[var(--status-success)] ${revealed.reading ? "opacity-100" : "opacity-0"}`}>{answer}</p></article>)}</div>
        <Note title="阅读边界" tone="rose">这是一张语言学习卡，不是诊断或处方。真实症状、药物剂量和就医时间应以专业医疗人员的意见为准。</Note>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.reading)} onClick={() => toggle("reading")} answer />),
      "28": content("28", "2. 写作 · 症状与建议记录", "写 8—10 句虚构练习，不填写真实隐私或真实处方信息。", <NotebookPen aria-hidden="true" size={22} />, <>
        <div className="mt-4 grid grid-cols-2 gap-3"><Note title="内容骨架" tone="green">开始时间 → 三项症状 → 程度 → 必须做 → 禁止做 → 限定 → 后续行动</Note><Note title="语法清单" tone="amber">ㅡ脱落2次<br/>-지 마세요2次<br/>N만2次<br/>-아야/어야 돼요2次</Note></div>
        <section className="mt-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] p-5"><p className="text-[11px] font-bold text-[var(--status-success)]">原创示范</p><p className="mt-3 text-sm font-bold leading-7">어제부터 머리가 아프고 열이 나요. 기침도 조금 해요. 오늘은 집에서만 쉬어야 돼요. 따뜻한 물을 많이 마시고 약을 먹어야 돼요. 찬 음료를 마시지 마세요. 무리하게 운동하지 마세요. 계속 아프면 병원에 가야 돼요.</p></section>
        <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] font-bold text-[var(--status-success)]">{["✓ 开始时间与程度","✓ 三项不同症状","✓ 必须／禁止／限定","✓ 再次就医条件"].map((item) => <span key={item} className="rounded-xl bg-[var(--status-success-surface)] px-3 py-2">{item}</span>)}</div>
      </>),
      "30": content("30", "1. 身体与症状闪测", "看到中文后两秒内说出韩语。", <HeartPulse aria-hidden="true" size={22} />, <div className="mt-4 grid grid-cols-3 gap-2.5">{[
        ["头", "머리"], ["喉咙", "목"], ["肚子", "배"], ["腿", "다리"],
        ["疼", "아프다"], ["感冒", "감기에 걸리다"], ["发烧", "열이 나다"], ["咳嗽", "기침을 하다"],
        ["流鼻涕", "콧물이 나다"], ["疲劳", "피곤하다"], ["吃药", "약을 먹다"], ["充分休息", "푹 쉬다"],
      ].map(([chinese, korean], index) => <article key={`${chinese}-${korean}`} className="rounded-xl border border-[var(--border)] bg-white p-3 text-center"><p className="text-[10px] text-[var(--status-success)]">{index + 1}</p><b>{chinese}</b><p className={`mt-2 rounded-lg bg-[var(--status-success-surface)] p-2 text-xs font-bold ${revealed.words ? "opacity-100" : "opacity-0"}`}>{korean}</p></article>)}</div>, <KoreanEbookRevealButton shown={Boolean(revealed.words)} onClick={() => toggle("words")} answer />),
      "31": content("31", "2. ㅡ 脱落检测", "去掉ㅡ后，根据前一音节元音选择아요或어요。", <NotebookPen aria-hidden="true" size={22} />, <>
        <div className="mt-4 grid grid-cols-2 gap-2.5">{[
          ["아프다 + 아/어요", "아파요"], ["바쁘다 + 아/어요", "바빠요"], ["예쁘다 + 아/어요", "예뻐요"], ["기쁘다 + 아/어요", "기뻐요"],
          ["크다 + 아/어요", "커요"], ["쓰다 + 아/어요", "써요"], ["나쁘다 + 아/어요", "나빠요"], ["슬프다 + 아/어요", "슬퍼요"],
          ["끄다 + 아/어요", "꺼요"], ["뜨다 + 아/어요", "떠요"], ["고프다 + 아/어요", "고파요"], ["잠그다 + 아/어요", "잠가요"],
        ].map(([question, answer]) => <article key={question} className="rounded-xl border border-[var(--border)] bg-white p-3"><b>{question}</b><p className={`mt-2 text-sm font-bold text-[var(--status-success)] ${revealed.eu ? "opacity-100" : "opacity-0"}`}>{answer}</p></article>)}</div>
      </>, <KoreanEbookRevealButton shown={Boolean(revealed.eu)} onClick={() => toggle("eu")} answer />),
      "32": content("32", "3. 综合语法检测", "完成禁止、限定和义务表达。", <CheckCircle2 aria-hidden="true" size={22} />, <div className="mt-4 space-y-2">{[
        ["请不要喝酒。", "술을 마시지 마세요."], ["今天请不要运动。", "오늘은 운동하지 마세요."],
        ["只喝水。", "물만 마셔요."], ["只在家休息。", "집에서만 쉬어요."],
        ["必须吃药。", "약을 먹어야 돼요."], ["必须去医院。", "병원에 가야 돼요."],
        ["只在饭后吃药。", "식사 후에만 약을 먹어요."], ["请不要晚睡。", "늦게 자지 마세요."],
        ["必须充分休息。", "푹 쉬어야 돼요."], ["请不要喝冷饮。", "찬 음료를 마시지 마세요."],
      ].map(([question, answer], index) => <article key={question} className="grid grid-cols-2 gap-3 rounded-xl border border-[var(--border)] bg-white p-3 text-xs font-bold"><span>{index + 1}. {question}</span><span className={`text-[var(--status-success)] ${revealed.grammar ? "opacity-100" : "opacity-0"}`}>{answer}</span></article>)}</div>, <KoreanEbookRevealButton shown={Boolean(revealed.grammar)} onClick={() => toggle("grammar")} answer />),
      "33": content("33", "4. 口语验收 · 医生与病人", "不看稿完成至少十句问诊交流，交换角色后再做一次。", <Mic2 aria-hidden="true" size={22} />, <>
        <section className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--status-success-surface)] p-5"><p className="text-xs font-bold text-[var(--status-success)]">八项必达信息</p><div className="mt-4 grid grid-cols-2 gap-3 text-xs">{["询问哪里不舒服","说明开始时间","说出三项症状","使用一个ㅡ脱落词","给出两项必须事项","给出两项禁止事项","使用N만一次","说明再次就医条件"].map((task) => <label key={task} className="flex items-center gap-2 rounded-xl bg-white p-3 font-bold"><input type="checkbox" className="accent-[var(--status-success)]" />{task}</label>)}</div></section>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center text-[11px] font-bold"><span className="rounded-xl bg-[var(--accent)] px-3 py-2 text-[var(--primary)]">症状完整 40%</span><span className="rounded-xl bg-[var(--status-success-surface)] px-3 py-2 text-[var(--status-success)]">语法正确 40%</span><span className="rounded-xl bg-[var(--status-warning-surface)] px-3 py-2 text-[var(--status-warning)]">表达自然 20%</span></div>
        <button type="button" onClick={() => speak("어디가 아파요? 어제부터 머리가 아프고 열이 나요. 기침도 해요. 감기에 걸렸어요. 약을 먹어야 돼요. 따뜻한 물을 많이 마셔야 돼요. 오늘은 운동하지 마세요. 술도 마시지 마세요. 집에서만 푹 쉬세요. 계속 아프면 다시 병원에 오세요.")} className="mt-auto flex items-center justify-center gap-2 rounded-2xl bg-[var(--status-success)] p-4 text-sm font-bold text-white"><Volume2 aria-hidden="true" size={16} />播放十句示范</button>
      </>),
      "34": <div className="flex h-full flex-col justify-center"><div className="mx-auto w-full max-w-[440px] text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--status-success-surface)] text-[var(--status-success)]"><Sparkles aria-hidden="true" size={27} /></span><h3 className="mt-3 text-4xl font-bold">감기에 걸렸어요.</h3><p className="mt-3 text-lg font-bold">你已经完成第十一课</p><p className="mx-auto mt-3 max-w-[390px] text-sm leading-7 text-[var(--foreground-secondary)]">现在你能描述常见症状，理解初级医疗建议，并正确表达“不要、只、必须”。</p><div className="mt-4 grid grid-cols-2 gap-3 text-left">{[
        ["01", "掌握变化", "ㅡ 탈락"], ["02", "表达禁止", "V-지 마세요"],
        ["03", "限定范围", "N만"], ["04", "说明义务", "V-아야/어야 돼요"],
      ].map(([index, title, detail]) => <div key={index} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3"><p className="text-[10px] font-bold text-[var(--status-success)]">{index}</p><p className="mt-1 text-xs font-bold">{title}</p><p className="mt-1 text-[10px] text-[var(--foreground-secondary)]">{detail}</p></div>)}</div><div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--status-success-surface)] px-5 py-3.5 text-left"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold tracking-[0.14em] text-[var(--status-success)]">本课测试</p><p className="mt-1 text-xs font-bold text-[var(--foreground-secondary)]">检验身体、症状、禁止、限定和义务表达。</p></div><KoreanEbookTestLink /></div></div><button type="button" onClick={() => flipBookRef.current?.pageFlip()?.flip(1)} className="mt-4 rounded-full bg-[var(--accent)] px-4 py-3 text-xs font-bold text-[var(--primary)]">返回目录</button></div></div>,
    };
    return pages[number];
  }

  const pages = Array.from({ length: 34 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return <Page key={`11-${number}`} number={number}>{renderPage(number)}</Page>;
  });

  return <section ref={containerRef} className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden [&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-[var(--ring)] [&_button:focus-visible]:ring-offset-2 [&_input:focus-visible]:outline-none [&_input:focus-visible]:ring-2 [&_input:focus-visible]:ring-[var(--ring)] [&_input:focus-visible]:ring-offset-2"><div className="relative shrink-0" style={{ width: BOOK_WIDTH * scale, height: BOOK_HEIGHT * scale }}>
    <button type="button" onClick={() => flipBookRef.current?.pageFlip()?.flipPrev()} aria-label="上一页" className="absolute -left-14 top-1/2 z-20 -translate-y-1/2 rounded-full border border-[var(--border)] bg-white p-3 text-[var(--status-success)] shadow-lg"><ArrowLeft aria-hidden="true" size={18} /></button>
    <button type="button" onClick={() => flipBookRef.current?.pageFlip()?.flipNext()} aria-label="下一页" className="absolute -right-14 top-1/2 z-20 -translate-y-1/2 rounded-full border border-[var(--border)] bg-white p-3 text-[var(--status-success)] shadow-lg"><ArrowRight aria-hidden="true" size={18} /></button>
    <div className="absolute left-0 top-0 h-[822px] w-[1180px] origin-top-left" style={{ transform: `scale(${scale})` }}><HTMLFlipBook ref={flipBookRef} width={590} height={822} startPage={initialPage} size="fixed" minWidth={590} maxWidth={590} minHeight={822} maxHeight={822} drawShadow maxShadowOpacity={0.32} flippingTime={650} usePortrait startZIndex={0} autoSize={false} showCover={false} mobileScrollSupport swipeDistance={24} clickEventForward useMouseEvents={true} showPageCorners={false} disableFlipByClick onFlip={(event) => onPageChange?.(event.data)} className="h-[822px] w-[1180px]" style={{}}><Page number="封面" cover><KoreanEbookCover lesson={lesson} /></Page>{pages}</HTMLFlipBook></div>
  </div></section>;
}
