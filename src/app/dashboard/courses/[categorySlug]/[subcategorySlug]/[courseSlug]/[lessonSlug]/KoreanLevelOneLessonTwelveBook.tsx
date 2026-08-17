"use client";

import dynamic from "next/dynamic";

const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false });
import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Headphones,
  MessageCircle,
  Mic2,
  NotebookPen,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
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
type Speak = (text: string) => void;
type Line = { speaker: string; korean: string; chinese: string };
type Card = { label: string; korean: string; chinese: string };
type Word = { korean: string; type: string; chinese: string };
type FlipBookHandle = { pageFlip: () => { flip: (page: number) => void; flipNext: () => void; flipPrev: () => void } | undefined };

const TEMPLATE = buildKoreanEbookSectionMap([
  { step: "第一步", label: "课前导航", dividerPage: 2, contentPages: [3] },
  { step: "第二步", label: "核心词汇", dividerPage: 4, contentPages: [5, 6, 7, 8] },
  { step: "第三步", label: "语法讲解", dividerPage: 9, contentPages: [10, 11, 12, 13, 14] },
  { step: "第四步", label: "句型操练", dividerPage: 15, contentPages: [16, 17, 18] },
  { step: "第五步", label: "实战对话", dividerPage: 19, contentPages: [20, 21, 22] },
  { step: "第六步", label: "听说任务", dividerPage: 23, contentPages: [24, 25, 26] },
  { step: "第七步", label: "读写拓展", dividerPage: 27, contentPages: [28, 29] },
  { step: "第八步", label: "自测与复盘", dividerPage: 30, contentPages: [31, 32, 33, 34, 35] },
]);

const Page = forwardRef<HTMLDivElement, { children: ReactNode; number: string; cover?: boolean }>(
  function Page({ children, number, cover = false }, ref) {
    return <KoreanEbookPage ref={ref} number={number} header={TEMPLATE.headers[number] ?? "第 12 课 · 여보세요."} cover={cover} sectionMeta={TEMPLATE.pageMeta[number]} hideContentOverflow>{children}</KoreanEbookPage>;
  }
);

function Heading({ page, title, description, icon, action }: { page: string; title: string; description: string; icon: ReactNode; action?: ReactNode }) {
  return <KoreanEbookHeading step={TEMPLATE.pageMeta[page]?.tag ?? "第八步"} title={title} description={description} icon={icon} action={action} />;
}

function Note({ title, children, tone = "blue" }: { title: string; children: ReactNode; tone?: "blue" | "rose" | "green" | "amber" }) {
  const colors = { blue: "border-[var(--border)] bg-[var(--accent)]", rose: "border-[var(--border)] bg-[var(--card)]", green: "border-[var(--border)] bg-[var(--status-success-surface)]", amber: "border-[var(--border)] bg-[var(--status-warning-surface)]" };
  return <section className={`mt-4 rounded-2xl border p-4 ${colors[tone]}`}><p className="text-[11px] font-bold">{title}</p><div className="mt-2 text-xs font-bold leading-6 text-[var(--foreground-secondary)]">{children}</div></section>;
}

function SpeakLine({ text, speak, children }: { text: string; speak: Speak; children?: ReactNode }) {
  return <div className="flex items-center justify-between gap-2"><span className="min-w-0">{children ?? text}</span><KoreanEbookSpeakButton text={text} onSpeak={speak} compact /></div>;
}

function CardGrid({ cards, speak, showChinese, columns = 2 }: { cards: Card[]; speak: Speak; showChinese: boolean; columns?: 2 | 3 }) {
  return <div className={`mt-4 grid gap-3 ${columns === 3 ? "grid-cols-3" : "grid-cols-2"}`}>{cards.map((card) => <article key={`${card.label}-${card.korean}`} className="min-h-[82px] rounded-2xl border border-[var(--border)] bg-white p-5"><b className="text-[10px] text-[var(--primary)]">{card.label}</b><div className="mt-2 text-sm font-bold"><SpeakLine text={card.korean} speak={speak} /></div><p className={`mt-1 text-[10px] text-[var(--foreground-secondary)] ${showChinese ? "opacity-100" : "opacity-0"}`}>{card.chinese}</p></article>)}</div>;
}

function WordGrid({ words, speak, showChinese }: { words: Word[]; speak: Speak; showChinese: boolean }) {
  return <div className={`mt-4 grid grid-cols-3 gap-3 ${showChinese ? "" : "[&_[data-vocab-meaning]]:opacity-0"}`}>{words.map((word) => <KoreanEbookVocabularyCard key={`${word.korean}-${word.type}`} {...word} onSpeak={speak} compact={words.length >= 12} />)}</div>;
}

function Dialogue({ lines, speak, showChinese }: { lines: Line[]; speak: Speak; showChinese: boolean }) {
  return <div className="mt-4 grid grid-cols-2 gap-3">{lines.map((line, index) => <div key={`${index}-${line.korean}`} className={`flex gap-2 rounded-xl p-3.5 ${index % 2 ? "bg-[var(--status-warning-surface)]" : "bg-[var(--status-success-surface)]"}`}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-bold">{line.speaker}</span><div className="min-w-0 flex-1"><p className="text-[13px] font-bold leading-6">{line.korean}</p><p className={`text-[10px] font-bold leading-5 text-[var(--foreground-secondary)] ${showChinese ? "opacity-100" : "opacity-0"}`}>{line.chinese}</p></div><KoreanEbookSpeakButton text={line.korean} onSpeak={speak} compact /></div>)}</div>;
}

const phoneWords: Word[] = [
  { korean: "여보세요", type: "电话开场语", chinese: "喂？" }, { korean: "전화하다", type: "通讯动词", chinese: "打电话" },
  { korean: "전화를 걸다", type: "通讯表达", chinese: "拨打电话" }, { korean: "전화를 받다", type: "通讯表达", chinese: "接电话" },
  { korean: "전화를 끊다", type: "通讯表达", chinese: "挂电话" }, { korean: "전화를 잘못 걸다", type: "通讯表达", chinese: "打错电话" },
  { korean: "통화하다", type: "通讯动词", chinese: "通话" }, { korean: "휴대폰", type: "通讯名词", chinese: "手机" },
  { korean: "전화번호", type: "通讯名词", chinese: "电话号码" }, { korean: "연락하다", type: "通讯动词", chinese: "联系" },
  { korean: "문자", type: "通讯名词", chinese: "短信" }, { korean: "메시지", type: "通讯名词", chinese: "消息" },
  { korean: "부재중 전화", type: "通讯名词", chinese: "未接来电" }, { korean: "신호", type: "通讯名词", chinese: "信号" }, { korean: "번호", type: "名词", chinese: "号码" },
];
const stateWords: Word[] = [
  { korean: "바쁘다 → 바빠요", type: "状态形容词", chinese: "忙" }, { korean: "아프다 → 아파요", type: "状态形容词", chinese: "疼／生病" },
  { korean: "피곤하다", type: "状态形容词", chinese: "疲劳" }, { korean: "회의하다", type: "日常动词", chinese: "开会" },
  { korean: "운전하다", type: "日常动词", chinese: "开车" }, { korean: "수업하다", type: "日常动词", chinese: "上课" },
  { korean: "일하다", type: "日常动词", chinese: "工作" }, { korean: "식사하다", type: "日常动词", chinese: "吃饭" },
  { korean: "자다", type: "日常动词", chinese: "睡觉" }, { korean: "씻다", type: "日常动词", chinese: "洗漱" },
  { korean: "기다리다", type: "日常动词", chinese: "等待" }, { korean: "확인하다", type: "日常动词", chinese: "确认" },
];
const callPhrases: Word[] = [
  { korean: "누구세요?", type: "身份确认", chinese: "您是哪位？" }, { korean: "거기 지훈 씨 집이지요?", type: "号码确认", chinese: "那里是志勋家吧？" },
  { korean: "잠깐 통화할 수 있어요?", type: "通话请求", chinese: "能通话一会儿吗？" }, { korean: "지금 통화 중이에요", type: "通话状态", chinese: "现在正在通话" },
  { korean: "나중에 다시 전화할게요", type: "结束表达", chinese: "稍后再打给你" }, { korean: "메시지를 남겨 주세요", type: "留言表达", chinese: "请留言" },
  { korean: "전화를 잘못 거셨어요", type: "错误号码", chinese: "您打错了" }, { korean: "번호를 확인해 주세요", type: "号码确认", chinese: "请确认号码" },
  { korean: "잘 안 들려요", type: "线路问题", chinese: "听不清楚" }, { korean: "전화가 끊겼어요", type: "线路问题", chinese: "电话断了" },
  { korean: "그런데요", type: "电话回应", chinese: "是的，怎么了？" }, { korean: "알겠습니다", type: "电话回应", chinese: "知道了" },
];
const formWords: Word[] = [
  { korean: "춥다 → 춥지요?", type: "-지요?", chinese: "很冷吧？" }, { korean: "보다 → 봤지요?", type: "-지요?", chinese: "看过了吧？" },
  { korean: "집 → 집이지요?", type: "N-(이)지요?", chinese: "是家吧？" }, { korean: "학교 → 학교지요?", type: "N-(이)지요?", chinese: "是学校吧？" },
  { korean: "먹다 → 먹고 있어요", type: "进行时", chinese: "正在吃" }, { korean: "운전하다 → 운전하고 있어요", type: "进行时", chinese: "正在开车" },
  { korean: "못 만나요", type: "客观否定", chinese: "没法见面" }, { korean: "운전 못 해요", type: "客观否定", chinese: "不会开车" },
  { korean: "아프다 → 아파서", type: "原因连接", chinese: "因为疼" }, { korean: "바쁘다 → 바빠서", type: "原因连接", chinese: "因为忙" },
  { korean: "피곤하다 → 피곤해서", type: "原因连接", chinese: "因为累" }, { korean: "비가 오다 → 비가 와서", type: "原因连接", chinese: "因为下雨" },
];

const dividers: Record<string, { step: string; title: string; goal: string; icon: ReactNode }> = {
  "02": { step: "第一步", title: "课前导航", goal: "完成“接听—确认身份—询问状态—说明原因—约定回电”的电话交际链。", icon: <PhoneCall aria-hidden="true" size={24} /> },
  "04": { step: "第二步", title: "核心词汇", goal: "掌握电话专用词、状态动词、电话固定句和五项语法形态。", icon: <Phone aria-hidden="true" size={24} /> },
  "09": { step: "第三步", title: "语法讲解", goal: "五个语法各占一页：确认、名词确认、进行、客观不能和原因。", icon: <NotebookPen aria-hidden="true" size={24} /> },
  "15": { step: "第四步", title: "句型操练", goal: "在身份确认、当前状态和电话原因之间建立快速反应。", icon: <PhoneIncoming aria-hidden="true" size={24} /> },
  "19": { step: "第五步", title: "实战对话", goal: "完成三组不少于八句的真实电话交流。", icon: <MessageCircle aria-hidden="true" size={24} /> },
  "23": { step: "第六步", title: "听说任务", goal: "从通话中提取人物、状态、原因和后续安排。", icon: <Headphones aria-hidden="true" size={24} /> },
  "27": { step: "第七步", title: "读写拓展", goal: "读懂电话留言并写出清楚、礼貌、可执行的回电记录。", icon: <BookOpenCheck aria-hidden="true" size={24} /> },
  "30": { step: "第八步", title: "自测与复盘", goal: "检查电话词汇、五项语法和完整通话能力。", icon: <CheckCircle2 aria-hidden="true" size={24} /> },
};

export function KoreanLevelOneLessonTwelveBook({ lesson, isFullscreen, initialPage = 0, onPageChange, speechRate = 0.78 }: { lesson: KoreanLevelOneLesson; isFullscreen: boolean; initialPage?: number; onPageChange?: (page: number) => void; speechRate?: number }) {
  const containerRef = useRef<HTMLElement>(null);
  const flipBookRef = useRef<FlipBookHandle>(null);
  const [scale, setScale] = useState(0.7);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setRevealed((current) => ({ ...current, [key]: !current[key] }));
  const speak = (text: string) => { if (!("speechSynthesis" in window)) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "ko-KR"; utterance.rate = speechRate; window.speechSynthesis.speak(utterance); };
  useEffect(() => { const resize = () => { const rect = containerRef.current?.getBoundingClientRect(); if (!rect) return; setScale(Math.min((rect.width - 34) / BOOK_WIDTH, (rect.height - 28) / BOOK_HEIGHT, isFullscreen ? 1 : 0.86)); }; resize(); const observer = new ResizeObserver(resize); if (containerRef.current) observer.observe(containerRef.current); return () => observer.disconnect(); }, [isFullscreen]);
  const content = (number: string, title: string, description: string, icon: ReactNode, body: ReactNode, action?: ReactNode) => <div className="flex h-full flex-col"><Heading page={number} title={title} description={description} icon={icon} action={action} />{body}</div>;

  const dialogues: Record<string, { title: string; description: string; lines: Line[] }> = {
    "20": { title: "场景 1 · 确认身份与号码", description: "用-(이)지요?确认号码，再自然进入通话。", lines: [
      { speaker: "A", korean: "여보세요, 거기 지훈 씨 휴대폰이지요?", chinese: "喂，是志勋的手机吧？" }, { speaker: "B", korean: "네, 그런데요. 누구세요?", chinese: "是的，怎么了？您是哪位？" },
      { speaker: "A", korean: "저 민수예요. 지훈 씨, 지금 바쁘지요?", chinese: "我是民洙。志勋，你现在很忙吧？" }, { speaker: "B", korean: "아니요, 지금은 괜찮아요.", chinese: "不，现在没关系。" },
      { speaker: "A", korean: "내일 회의가 세 시지요?", chinese: "明天会议是三点吧？" }, { speaker: "B", korean: "네, 세 시에 시작해요.", chinese: "是的，三点开始。" },
      { speaker: "A", korean: "회의실은 이 층이지요?", chinese: "会议室在二楼吧？" }, { speaker: "B", korean: "네, 맞아요. 내일 봐요.", chinese: "对。明天见。" },
    ]},
    "21": { title: "场景 2 · 正在开车，无法接听", description: "用进行时说明状态，用못和原因表达无法通话。", lines: [
      { speaker: "A", korean: "여보세요, 지금 뭐 하고 있어요?", chinese: "喂，现在在做什么？" }, { speaker: "B", korean: "지금 운전하고 있어요.", chinese: "现在正在开车。" },
      { speaker: "A", korean: "잠깐 통화할 수 있어요?", chinese: "能通话一会儿吗？" }, { speaker: "B", korean: "미안해요. 운전하고 있어서 오래 통화 못 해요.", chinese: "对不起，因为正在开车，不能长时间通话。" },
      { speaker: "A", korean: "그럼 언제 통화할 수 있어요?", chinese: "那么什么时候能通话？" }, { speaker: "B", korean: "삼십 분 후에는 괜찮아요.", chinese: "三十分钟后可以。" },
      { speaker: "A", korean: "제가 나중에 다시 전화할게요.", chinese: "我稍后再打给你。" }, { speaker: "B", korean: "네, 도착해서 연락할게요.", chinese: "好，到达后我联系你。" },
    ]},
    "22": { title: "场景 3 · 本人不在与留言", description: "确认接听地点后，为暂时不在的人留下清楚的回电信息。", lines: [
      { speaker: "A", korean: "여보세요, 거기 수진 씨 집이지요?", chinese: "喂，那里是秀珍家吧？" }, { speaker: "B", korean: "네, 맞아요. 그런데 수진 씨는 지금 없어요.", chinese: "是的。不过秀珍现在不在。" },
      { speaker: "A", korean: "아, 그래요? 저는 민수예요.", chinese: "啊，是吗？我是民洙。" }, { speaker: "B", korean: "네, 민수 씨. 메시지를 남길까요?", chinese: "好的，民洙。要留言吗？" },
      { speaker: "A", korean: "네. 내일 세 시 회의 때문에 전화했어요.", chinese: "好的。我因为明天三点的会议打来了电话。" }, { speaker: "B", korean: "네, 알겠습니다.", chinese: "好的，知道了。" },
      { speaker: "A", korean: "그리고 오후 여섯 시에 다시 전화할게요.", chinese: "另外，我下午六点再打来。" }, { speaker: "B", korean: "네, 메시지를 남길게요.", chinese: "好的，我会留言。" },
    ]},
  };

  function renderPage(number: string) {
    if (number === "01") return <KoreanEbookTableOfContents lessonNumber={12} pageMeta={TEMPLATE.pageMeta} onNavigate={(target) => flipBookRef.current?.pageFlip()?.flip(target)} entries={[
      { step: "01", title: "课前导航", pageRange: "02—03", detail: "建立完整通话流程" }, { step: "02", title: "核心词汇", pageRange: "04—08", detail: "电话·状态·固定句·形态" },
      { step: "03", title: "语法讲解", pageRange: "09—14", detail: "五项电话核心语法" }, { step: "04", title: "句型操练", pageRange: "15—18", detail: "确认·进行·原因" },
      { step: "05", title: "实战对话", pageRange: "19—22", detail: "三组八句电话交流" }, { step: "06", title: "听说任务", pageRange: "23—26", detail: "听通话·做留言" },
      { step: "07", title: "读写拓展", pageRange: "27—29", detail: "读留言·写回电记录" }, { step: "08", title: "自测与复盘", pageRange: "30—35", detail: "综合验收与结束页" },
    ]} />;
    if (dividers[number]) return <KoreanEbookSectionDivider {...dividers[number]} />;
    if (dialogues[number]) { const d = dialogues[number]; return content(number, d.title, d.description, <PhoneCall aria-hidden="true" size={22} />, <><Dialogue lines={d.lines} speak={speak} showChinese={Boolean(revealed[`chinese${number}`])} /><Note title="角色交换" tone="rose">替换姓名、当前状态和原因，再完成一轮不少于八句的电话对话。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed[`chinese${number}`])} onClick={() => toggle(`chinese${number}`)} />); }
    const pages: Record<string, ReactNode> = {
      "03": content("03", "一通电话的五步结构", "接听、确认、询问、说明原因、约定后续，每一步都有固定语言任务。", <Phone aria-hidden="true" size={22} />, <><CardGrid cards={[
        { label: "接听", korean: "여보세요?", chinese: "喂？" }, { label: "确认", korean: "지훈 씨 휴대폰이지요?", chinese: "是志勋的手机吧？" },
        { label: "状态", korean: "지금 운전하고 있어요.", chinese: "现在正在开车。" }, { label: "原因", korean: "바빠서 전화를 못 받아요.", chinese: "因为忙，没法接电话。" },
        { label: "请求", korean: "잠깐 통화할 수 있어요?", chinese: "能通话一会儿吗？" }, { label: "后续", korean: "나중에 다시 전화할게요.", chinese: "稍后我再打给你。" },
      ]} speak={speak} showChinese={Boolean(revealed.chinese03)} /><Note title="最终任务" tone="amber">完成一段10句电话：确认身份、询问状态、使用进行时、说明不能通话的原因，并约定回电。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese03)} onClick={() => toggle("chinese03")} />),
      "05": content("05", "1. 电话交际词汇", "这些表达属于电话专用语境，不能随意替换成面对面问候。", <Phone aria-hidden="true" size={22} />, <><WordGrid words={phoneWords} speak={speak} showChinese={Boolean(revealed.chinese05)} /><Note title="电话动作顺序" tone="green"><SpeakLine text="전화를 걸고, 받고, 마지막에 끊어요." speak={speak} /><span className={revealed.chinese05 ? "" : "opacity-0"}>拨打电话、接听，最后挂断。</span></Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese05)} onClick={() => toggle("chinese05")} />),
      "06": content("06", "2. 状态与日常动词", "进行时和原因句需要大量状态、工作与生活动词。", <PhoneIncoming aria-hidden="true" size={22} />, <><WordGrid words={stateWords} speak={speak} showChinese={Boolean(revealed.chinese06)} /><Note title="하다动词中的못">운전하다 → 운전 못 해요；수영하다 → 수영 못 해요。못通常插在名词与하다之间。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese06)} onClick={() => toggle("chinese06")} />),
      "07": content("07", "3. 电话固定表达", "把开场、线路问题、留言和结束语作为完整词块记忆。", <PhoneCall aria-hidden="true" size={22} />, <><WordGrid words={callPhrases} speak={speak} showChinese={Boolean(revealed.chinese07)} /><Note title="线路不清楚时" tone="rose"><SpeakLine text="잘 안 들려요. 다시 말해 주세요." speak={speak} /><span className={revealed.chinese07 ? "" : "opacity-0"}>听不清楚，请再说一遍。</span></Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese07)} onClick={() => toggle("chinese07")} />),
      "08": content("08", "4. 本课核心形态", "先熟悉语音和整体形态，再进入五页规则拆解。", <NotebookPen aria-hidden="true" size={22} />, <><WordGrid words={formWords} speak={speak} showChinese={Boolean(revealed.chinese08)} /><Note title="先判断交际功能" tone="amber">确认事实用-지요?；描述当下动作用-고 있어요；客观做不到用못；说明原因用-아서/어서。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese08)} onClick={() => toggle("chinese08")} />),
      "10": content("10", "1. A/V-지요?", "说话人已有判断，通过-지요?寻求确认、认同或共同记忆。", <NotebookPen aria-hidden="true" size={22} />, <><CardGrid cards={[
        { label: "现在事实", korean: "오늘 날씨가 춥지요?", chinese: "今天天气很冷吧？" }, { label: "过去确认", korean: "어제 영화를 봤지요?", chinese: "昨天看电影了吧？" },
        { label: "状态确认", korean: "지금 바쁘지요?", chinese: "现在很忙吧？" }, { label: "口语缩约", korean: "지금 괜찮죠?", chinese: "现在可以吧？" },
        { label: "共同记忆", korean: "우리 내일 만나지요?", chinese: "我们明天见面吧？" }, { label: "信息确认", korean: "수업이 끝났지요?", chinese: "课程结束了吧？" },
      ]} speak={speak} showChinese={Boolean(revealed.chinese10)} /><Note title="时态位置">过去标记先形成봤어요，再接지요：봤지요?。不能把过去标记放在지요后。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese10)} onClick={() => toggle("chinese10")} />),
      "11": content("11", "2. N-(이)지요?", "名词确认句在电话中用于确认身份、号码、地点与时间。", <PhoneIncoming aria-hidden="true" size={22} />, <><CardGrid cards={[
        { label: "有收音 + 이지요?", korean: "선생님이지요?", chinese: "是老师吧？" }, { label: "无收音 + 지요?", korean: "학교지요?", chinese: "是学校吧？" },
        { label: "确认号码", korean: "지훈 씨 휴대폰이지요?", chinese: "是志勋的手机吧？" }, { label: "确认时间", korean: "회의가 세 시지요?", chinese: "会议是三点吧？" },
        { label: "确认地点", korean: "거기 병원이지요?", chinese: "那里是医院吧？" }, { label: "确认姓名", korean: "민수 씨지요?", chinese: "是民洙吧？" },
      ]} speak={speak} showChinese={Boolean(revealed.chinese11)} /><Note title="口语形式">이지요?常缩为이죠?，지요?常缩为죠?。书面教学先掌握完整形态。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese11)} onClick={() => toggle("chinese11")} />),
      "12": content("12", "3. V-고 있어요", "表示动作正在进行或某状态正在持续，词干直接加-고 있어요。", <PhoneCall aria-hidden="true" size={22} />, <><CardGrid cards={[
        { label: "通话", korean: "친구하고 통화하고 있어요.", chinese: "正在和朋友通话。" }, { label: "吃饭", korean: "지금 밥을 먹고 있어요.", chinese: "现在正在吃饭。" },
        { label: "开车", korean: "운전하고 있어요.", chinese: "正在开车。" }, { label: "开会", korean: "회의하고 있어요.", chinese: "正在开会。" },
        { label: "等待", korean: "친구를 기다리고 있어요.", chinese: "正在等朋友。" }, { label: "移动", korean: "지금 집에 가고 있어요.", chinese: "现在正在回家。" },
      ]} speak={speak} showChinese={Boolean(revealed.chinese12)} /><Note title="不是所有状态都用进行时">바쁘다、아프다本身就是状态，通常说바빠요、아파요，不说바쁘고 있어요。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese12)} onClick={() => toggle("chinese12")} />),
      "13": content("13", "4. 못 + V", "表示能力不足或客观条件不允许，与主观选择的안不同。", <PhoneMissed aria-hidden="true" size={22} />, <><CardGrid cards={[
        { label: "客观不能", korean: "오늘 친구를 못 만나요.", chinese: "今天没法见朋友。" }, { label: "无法接听", korean: "전화를 못 받아요.", chinese: "没法接电话。" },
        { label: "하다动词", korean: "저는 운전 못 해요.", chinese: "我不会开车。" }, { label: "能力限制", korean: "한국어를 잘 못 해요.", chinese: "韩语说得不太好。" },
        { label: "环境限制", korean: "여기에서 통화 못 해요.", chinese: "在这里不能通话。" }, { label: "时间限制", korean: "오늘은 오래 못 이야기해요.", chinese: "今天不能聊太久。" },
      ]} speak={speak} showChinese={Boolean(revealed.chinese13)} /><Note title="안 vs 못" tone="rose">안 먹어요：主观上不吃；못 먹어요：因身体、能力或环境原因吃不了。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese13)} onClick={() => toggle("chinese13")} />),
      "14": content("14", "5. A/V-아서/어서 · 原因", "前项说明原因，后项说明由此产生的结果；变形同第10课。", <NotebookPen aria-hidden="true" size={22} />, <><CardGrid cards={[
        { label: "ㅡ脱落", korean: "배가 아파서 밥을 못 먹어요.", chinese: "因为肚子疼，吃不了饭。" }, { label: "있다 → 있어서", korean: "회의가 있어서 전화를 못 받아요.", chinese: "因为有会议，没法接电话。" },
        { label: "오다 → 와서", korean: "비가 와서 안 나갔어요.", chinese: "因为下雨，所以没出去。" }, { label: "피곤하다", korean: "피곤해서 일찍 자요.", chinese: "因为累，所以早睡。" },
        { label: "바쁘다 → 바빠서", korean: "바빠서 지금 통화 못 해요.", chinese: "因为忙，现在不能通话。" }, { label: "信号原因", korean: "신호가 안 좋아서 잘 안 들려요.", chinese: "因为信号不好，听不清楚。" },
      ]} speak={speak} showChinese={Boolean(revealed.chinese14)} /><Note title="两个禁区" tone="rose">原因用法前项不用过去形：왔어서×，와서✓；后项不能接命令或共动句。</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese14)} onClick={() => toggle("chinese14")} />),
      "16": content("16", "1. 电话确认实验", "根据名词有无收音以及句子类型选择지요或이지요。", <PhoneIncoming aria-hidden="true" size={22} />, <Exercise items={[
        ["지훈 씨 집", "지훈 씨 집이지요?"], ["회사", "회사지요?"], ["선생님", "선생님이지요?"], ["세 시", "세 시지요?"],
        ["어제 보다", "어제 봤지요?"], ["지금 바쁘다", "지금 바쁘지요?"], ["내일 만나다", "내일 만나지요?"], ["괜찮다", "괜찮지요?"],
        ["병원", "병원이지요?"], ["민수 씨", "민수 씨지요?"],
      ]} shown={Boolean(revealed.confirm)} />, <KoreanEbookRevealButton shown={Boolean(revealed.confirm)} onClick={() => toggle("confirm")} answer />),
      "17": content("17", "2. 正在做什么？", "把动词转换为进行时，再用电话问答完成信息交换。", <PhoneCall aria-hidden="true" size={22} />, <Exercise items={[
        ["통화하다", "통화하고 있어요."], ["운전하다", "운전하고 있어요."], ["밥을 먹다", "밥을 먹고 있어요."], ["회의하다", "회의하고 있어요."],
        ["일하다", "일하고 있어요."], ["친구를 기다리다", "친구를 기다리고 있어요."], ["수업하다", "수업하고 있어요."], ["자다", "자고 있어요."],
        ["집에 가다", "집에 가고 있어요."], ["메시지를 쓰다", "메시지를 쓰고 있어요."],
      ]} shown={Boolean(revealed.progressive)} />, <KoreanEbookRevealButton shown={Boolean(revealed.progressive)} onClick={() => toggle("progressive")} answer />),
      "18": content("18", "3. 안、못与原因诊所", "先判断是主观不做还是客观不能，再补充自然原因。", <PhoneMissed aria-hidden="true" size={22} />, <Exercise items={[
        ["不想接电话", "전화를 안 받아요."], ["因为正在开车不能久聊", "운전하고 있어서 오래 통화 못 해요."], ["不吃肉", "고기를 안 먹어요."], ["牙疼吃不了", "이가 아파서 못 먹어요."],
        ["不去聚会", "모임에 안 가요."], ["太忙没法去", "바빠서 못 가요."], ["不会游泳", "수영 못 해요."], ["今天不运动", "오늘 운동 안 해요."],
        ["信号不好，听不清楚", "신호가 안 좋아서 잘 안 들려요."], ["正在上课，不能接电话", "수업하고 있어서 전화를 못 받아요."],
      ]} shown={Boolean(revealed.negative)} />, <KoreanEbookRevealButton shown={Boolean(revealed.negative)} onClick={() => toggle("negative")} answer />),
      "24": content("24", "1. 听力 · 通话信息表", "抓住打电话的人、当前状态、不能通话的原因和回电时间。", <Headphones aria-hidden="true" size={22} />, <><button type="button" onClick={() => speak("여보세요, 지훈 씨지요? 지금 통화할 수 있어요? 미안해요. 지금 회의하고 있어서 오래 통화 못 해요. 회의가 다섯 시에 끝나요. 제가 다섯 시 반에 다시 전화할게요.")} className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] p-4 text-sm font-bold text-white"><Volume2 aria-hidden="true" size={17} />播放电话录音</button><Exercise items={[["接听人", "지훈 씨"], ["当前状态", "회의하고 있어요"], ["不能做什么", "오래 통화 못 해요"], ["原因", "회의"], ["结束时间", "다섯 시"], ["回电时间", "다섯 시 반"], ["使用的确认句", "지훈 씨지요?"], ["谁会再次打电话？", "말하는 사람"]]} shown={Boolean(revealed.listening)} /></>, <KoreanEbookRevealButton shown={Boolean(revealed.listening)} onClick={() => toggle("listening")} answer />),
      "25": content("25", "2. 电话留言四要素", "一条可执行留言必须让对方知道谁、为什么、何时和如何回复。", <PhoneCall aria-hidden="true" size={22} />, <><CardGrid cards={[
        { label: "谁", korean: "민수 씨가 전화했어요.", chinese: "民洙来过电话。" }, { label: "什么事", korean: "내일 회의 시간 때문에 전화했어요.", chinese: "因为明天的会议时间打来了电话。" },
        { label: "当前原因", korean: "지금 운전하고 있어서 오래 통화 못 해요.", chinese: "正在开车，不能长时间通话。" }, { label: "后续", korean: "여섯 시 이후에 다시 전화해 주세요.", chinese: "请六点以后回电。" },
        { label: "联系方式", korean: "이 번호로 연락해 주세요.", chinese: "请联系这个号码。" }, { label: "确认信息", korean: "회의실은 2층이지요?", chinese: "会议室在二楼吧？" },
      ]} speak={speak} showChinese={Boolean(revealed.chinese25)} /><Note title="留言模板">______ 씨가 전화했어요. ______해서 지금 오래 통화 못 해요. ______ 시 이후에 다시 전화해 주세요.</Note></>, <KoreanEbookRevealButton shown={Boolean(revealed.chinese25)} onClick={() => toggle("chinese25")} />),
      "26": content("26", "3. 60秒电话挑战", "不看稿完成确认、状态、原因和后续安排。", <Mic2 aria-hidden="true" size={22} />, <><div className="mt-4 grid grid-cols-2 gap-3"><Note title="来电者">여보세요, ______ 씨지요?<br/>지금 뭐 하고 있어요?<br/>잠깐 통화할 수 있어요?<br/>그럼 언제 다시 전화할까요?</Note><Note title="接听者" tone="green">네, 그런데요.<br/>지금 ______고 있어요.<br/>______해서 통화를 못 해요.<br/>______에 다시 전화해 주세요.</Note><Note title="听不清时" tone="rose">잘 안 들려요.<br/>다시 말해 주세요.</Note><Note title="结束通话" tone="amber">네, 알겠습니다.<br/>나중에 다시 전화할게요.</Note></div><div className="mt-4 grid grid-cols-2 gap-2 text-[11px] font-bold text-[var(--primary)]">{["场景 A · 正在开会","场景 B · 正在开车","场景 C · 身体不舒服","场景 D · 信号不好"].map((item) => <span key={item} className="rounded-xl bg-[var(--card)] px-3 py-3">{item}</span>)}</div><p className="mt-4 text-center text-[11px] font-bold text-[var(--foreground-secondary)]">至少使用：-(이)지요?、-고 있어요、못、-아서/어서各一次。</p></>),
      "28": content("28", "1. 阅读 · 부재중 전화 메모", "提取留言中的人物、原因、时间与请求。", <BookOpenCheck aria-hidden="true" size={22} />, <><section className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-5"><p className="text-[11px] font-bold text-[var(--status-success)]">전화 메모</p><p className="mt-3 text-sm font-bold leading-7">지훈 씨, 민수 씨가 오후 두 시에 전화했어요. 내일 회의 장소가 회사 회의실이지요? 회의 장소 때문에 전화했어요. 민수 씨는 지금 운전하고 있어서 오래 통화 못 해요. 오후 여섯 시 이후에 민수 씨에게 다시 전화해 주세요.</p></section><Exercise items={[["谁来过电话？", "민수 씨"], ["几点来电？", "오후 두 시"], ["因为什么来电？", "회의 장소"], ["为什么不能长时间通话？", "운전하고 있어서"], ["什么时候回电？", "오후 여섯 시 이후"], ["使用了哪个确认句？", "회사 회의실이지요?"], ["留言留给谁？", "지훈 씨"], ["要给谁回电？", "민수 씨"]]} shown={Boolean(revealed.reading)} /></>, <KoreanEbookRevealButton shown={Boolean(revealed.reading)} onClick={() => toggle("reading")} answer />),
      "29": content("29", "2. 写作 · 我的电话留言", "写7—9句原创留言，信息必须可以执行。", <NotebookPen aria-hidden="true" size={22} />, <><div className="mt-4 grid grid-cols-2 gap-3"><Note title="内容骨架" tone="green">接听人 → 来电者 → 确认对象 → 当前状态 → 原因 → 无法做 → 回电时间 → 请求</Note><Note title="语法清单" tone="amber">-(이)지요?一次<br/>-고 있어요一次<br/>못一次<br/>-아서/어서一次</Note></div><section className="mt-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] p-5"><p className="text-[11px] font-bold text-[var(--status-success)]">原创示范</p><p className="mt-3 text-sm font-bold leading-7">수진 씨, 민수 씨가 전화했어요. 내일 약속이 세 시지요? 약속 시간 때문에 전화했어요. 민수 씨는 지금 회의하고 있어서 오래 통화 못 해요. 회의가 끝나고 다시 연락할 거예요. 다섯 시 이후에 전화해 주세요.</p></section><div className="mt-4 grid grid-cols-2 gap-2 text-[11px] font-bold text-[var(--status-success)]">{["✓ 来电者姓名","✓ 来电原因","✓ 可回电时间","✓ 明确后续请求"].map((item) => <span key={item} className="rounded-xl bg-[var(--status-success-surface)] px-3 py-2">{item}</span>)}</div></>),
      "31": content("31", "1. 电话词汇闪测", "看到中文后两秒内说出韩语。", <Phone aria-hidden="true" size={22} />, <Exercise items={[
        ["喂", "여보세요"], ["打电话", "전화를 걸다"], ["接电话", "전화를 받다"], ["打错电话", "전화를 잘못 걸다"],
        ["通话", "통화하다"], ["手机", "휴대폰"], ["电话号码", "전화번호"], ["未接来电", "부재중 전화"],
        ["正在开会", "회의하고 있어요"], ["正在开车", "운전하고 있어요"], ["稍后回电", "나중에 다시 전화하다"], ["留言", "메시지를 남기다"],
      ]} shown={Boolean(revealed.words)} />, <KoreanEbookRevealButton shown={Boolean(revealed.words)} onClick={() => toggle("words")} answer />),
      "32": content("32", "2. 确认与进行时检测", "完成-(이)지요?和-고 있어요。", <NotebookPen aria-hidden="true" size={22} />, <Exercise items={[
        ["선생님 + 지요?", "선생님이지요?"], ["학교 + 지요?", "학교지요?"], ["어제 보다 + 지요?", "어제 봤지요?"], ["바쁘다 + 지요?", "바쁘지요?"],
        ["통화하다 + 고 있어요", "통화하고 있어요"], ["운전하다 + 고 있어요", "운전하고 있어요"], ["먹다 + 고 있어요", "먹고 있어요"], ["기다리다 + 고 있어요", "기다리고 있어요"],
        ["민수 씨 + 지요?", "민수 씨지요?"], ["집에 가다 + 고 있어요", "집에 가고 있어요"],
      ]} shown={Boolean(revealed.forms)} />, <KoreanEbookRevealButton shown={Boolean(revealed.forms)} onClick={() => toggle("forms")} answer />),
      "33": content("33", "3. 못与原因检测", "区分主观否定与客观不能，并遵守原因句禁区。", <CheckCircle2 aria-hidden="true" size={22} />, <Exercise items={[
        ["因为忙，没法见朋友。", "바빠서 친구를 못 만나요."], ["因为肚子疼，吃不了饭。", "배가 아파서 밥을 못 먹어요."],
        ["因为有会议，没法接电话。", "회의가 있어서 전화를 못 받아요."], ["因为下雨，昨天没出去。", "어제 비가 와서 안 나갔어요."],
        ["我不会开车。", "저는 운전 못 해요."], ["我主观上不喝咖啡。", "저는 커피를 안 마셔요."],
        ["信号不好，听不清楚。", "신호가 안 좋아서 잘 안 들려요."], ["正在上课，不能接电话。", "수업하고 있어서 전화를 못 받아요."],
        ["因为累，不能久聊。", "피곤해서 오래 이야기 못 해요."], ["今天不想打电话。", "오늘은 전화 안 하고 싶어요."],
      ]} shown={Boolean(revealed.grammar)} />, <KoreanEbookRevealButton shown={Boolean(revealed.grammar)} onClick={() => toggle("grammar")} answer />),
      "34": content("34", "4. 口语验收 · 十句完整通话", "交换角色完成通话，并处理一次无法长时间通话的情况。", <Mic2 aria-hidden="true" size={22} />, <><section className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--status-success-surface)] p-5"><p className="text-xs font-bold text-[var(--status-success)]">八项必达信息</p><div className="mt-4 grid grid-cols-2 gap-3 text-xs">{["用여보세요接听","确认身份或号码","询问当前状态","使用进行时","说明客观不能","给出原因","约定回电时间","礼貌结束"].map((task) => <label key={task} className="flex items-center gap-2 rounded-xl bg-white p-3 font-bold"><input type="checkbox" className="accent-[var(--status-success)]" />{task}</label>)}</div></section><div className="mt-4 grid grid-cols-3 gap-3 text-center text-[11px] font-bold"><span className="rounded-xl bg-[var(--accent)] px-3 py-2 text-[var(--primary)]">信息完整 40%</span><span className="rounded-xl bg-[var(--status-success-surface)] px-3 py-2 text-[var(--status-success)]">语法正确 40%</span><span className="rounded-xl bg-[var(--status-warning-surface)] px-3 py-2 text-[var(--status-warning)]">语气自然 20%</span></div><button type="button" onClick={() => speak("여보세요, 지훈 씨 휴대폰이지요? 네, 그런데요. 지금 뭐 하고 있어요? 지금 운전하고 있어요. 잠깐 통화할 수 있어요? 미안해요. 운전하고 있어서 오래 통화 못 해요. 그럼 언제 다시 전화할까요? 삼십 분 후에 전화해 주세요. 네, 나중에 다시 전화할게요. 감사합니다.")} className="mt-auto flex items-center justify-center gap-2 rounded-2xl bg-[var(--status-success)] p-4 text-sm font-bold text-white"><Volume2 aria-hidden="true" size={16} />播放十句示范</button></>),
      "35": <div className="flex h-full flex-col justify-center"><div className="mx-auto w-full max-w-[440px] text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--status-success-surface)] text-[var(--status-success)]"><Sparkles aria-hidden="true" size={27} /></span><p className="mt-4 text-xs font-bold tracking-[0.18em] text-[var(--status-success)]">LESSON 12 · COMPLETE</p><h3 className="mt-3 text-4xl font-bold">여보세요.</h3><p className="mt-3 text-lg font-bold">你已经完成第十二课</p><p className="mx-auto mt-3 max-w-[390px] text-sm leading-7 text-[var(--foreground-secondary)]">现在你能确认电话对象、说明正在做的事、解释无法通话的原因，并留下清楚的回电信息。</p><div className="mt-4 grid grid-cols-2 gap-3 text-left">{[["01","寻求确认","A/V-지요?"],["02","确认名词","N-(이)지요?"],["03","说明进行","V-고 있어요"],["04","客观不能","못 + V"],["05","表达原因","A/V-아서/어서"]].map(([i,t,d]) => <div key={i} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3"><p className="text-[10px] font-bold text-[var(--status-success)]">{i}</p><p className="mt-1 text-xs font-bold">{t}</p><p className="mt-1 text-[10px] text-[var(--foreground-secondary)]">{d}</p></div>)}</div><button type="button" onClick={() => flipBookRef.current?.pageFlip()?.flip(1)} className="mt-4 rounded-full bg-[var(--accent)] px-4 py-3 text-xs font-bold text-[var(--primary)]">返回目录</button></div></div>,
    };
    return pages[number];
  }

  function Exercise({ items, shown }: { items: string[][]; shown: boolean }) {
    return <div className="mt-5 grid grid-cols-2 gap-3">{items.map(([question, answer]) => <article key={`${question}-${answer}`} className={`rounded-xl border border-[var(--border)] bg-white text-xs font-bold ${items.length > 10 ? "min-h-[58px] p-3" : "min-h-[68px] p-4"}`}><span>{question}</span><p className={`mt-3 leading-5 text-[var(--status-success)] ${shown ? "opacity-100" : "opacity-0"}`}>{answer}</p></article>)}</div>;
  }

  const pages = Array.from({ length: 35 }, (_, index) => { const number = String(index + 1).padStart(2, "0"); return <Page key={`12-${number}`} number={number}>{renderPage(number)}</Page>; });
  return <section ref={containerRef} className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden [&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-[var(--ring)] [&_button:focus-visible]:ring-offset-2 [&_input:focus-visible]:outline-none [&_input:focus-visible]:ring-2 [&_input:focus-visible]:ring-[var(--ring)] [&_input:focus-visible]:ring-offset-2"><div className="relative shrink-0" style={{ width: BOOK_WIDTH * scale, height: BOOK_HEIGHT * scale }}><button type="button" onClick={() => flipBookRef.current?.pageFlip()?.flipPrev()} aria-label="上一页" className="absolute -left-14 top-1/2 z-20 -translate-y-1/2 rounded-full border border-[var(--border)] bg-white p-3 text-[var(--status-success)] shadow-lg"><ArrowLeft aria-hidden="true" size={18} /></button><button type="button" onClick={() => flipBookRef.current?.pageFlip()?.flipNext()} aria-label="下一页" className="absolute -right-14 top-1/2 z-20 -translate-y-1/2 rounded-full border border-[var(--border)] bg-white p-3 text-[var(--status-success)] shadow-lg"><ArrowRight aria-hidden="true" size={18} /></button><div className="absolute left-0 top-0 h-[822px] w-[1180px] origin-top-left" style={{ transform: `scale(${scale})` }}><HTMLFlipBook ref={flipBookRef} width={590} height={822} startPage={initialPage} size="fixed" minWidth={590} maxWidth={590} minHeight={822} maxHeight={822} drawShadow maxShadowOpacity={0.32} flippingTime={650} usePortrait startZIndex={0} autoSize={false} showCover={false} mobileScrollSupport swipeDistance={24} clickEventForward useMouseEvents={true} showPageCorners={false} disableFlipByClick onFlip={(event) => onPageChange?.(event.data)} className="h-[822px] w-[1180px]" style={{}}><Page number="封面" cover><KoreanEbookCover lesson={lesson} /></Page>{pages}</HTMLFlipBook></div></div></section>;
}
