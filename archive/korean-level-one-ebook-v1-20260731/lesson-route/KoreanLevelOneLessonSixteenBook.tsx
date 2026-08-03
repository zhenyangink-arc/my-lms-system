"use client";

import HTMLFlipBook from "react-pageflip";
import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, BookOpenCheck, CheckCircle2, Gift, Headphones,
  House, Mail, MessageCircle, Mic2, NotebookPen, PartyPopper, Sparkles, Volume2,
} from "lucide-react";
import {
  buildKoreanEbookSectionMap, KoreanEbookCover, KoreanEbookHeading,
  KoreanEbookPage, KoreanEbookRevealButton, KoreanEbookSectionDivider,
  KoreanEbookSpeakButton, KoreanEbookTableOfContents, KoreanEbookVocabularyCard,
} from "./KoreanLevelOneBookTemplate";
import type { KoreanLevelOneLesson } from "./KoreanLevelOneLessonBook";

const BOOK_WIDTH = 1180;
const BOOK_HEIGHT = 822;
type Speak = (text: string) => void;
type Word = { korean: string; pronunciation?: string; type: string; chinese: string };
type Line = { speaker: string; korean: string; chinese: string };
type FlipBookHandle = { pageFlip: () => { flip: (page: number) => void; flipNext: () => void; flipPrev: () => void } | undefined };

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

const Page = forwardRef<HTMLDivElement, { children: ReactNode; number: string; cover?: boolean }>(
  function Page({ children, number, cover = false }, ref) {
    return <KoreanEbookPage ref={ref} number={number} header={TEMPLATE.headers[number] ?? "第16课 · 우리 집에 올 수 있어요?"} cover={cover} sectionMeta={TEMPLATE.pageMeta[number]} hideContentOverflow>{children}</KoreanEbookPage>;
  }
);

const gatheringWords: Word[] = [
  { korean: "모임", type: "名词", chinese: "聚会" }, { korean: "집들이", pronunciation: "집뜨리", type: "名词", chinese: "乔迁宴、温居" },
  { korean: "초대", type: "名词", chinese: "邀请" }, { korean: "초대장", type: "名词", chinese: "邀请函" },
  { korean: "손님", type: "名词", chinese: "客人" }, { korean: "답장", pronunciation: "답짱", type: "名词", chinese: "回信" },
  { korean: "약속", pronunciation: "약쏙", type: "名词", chinese: "约定" }, { korean: "준비", type: "名词", chinese: "准备" },
  { korean: "선물", type: "名词", chinese: "礼物" }, { korean: "음식", type: "名词", chinese: "食物" },
  { korean: "휴지", type: "名词", chinese: "卷筒卫生纸" }, { korean: "세제", type: "名词", chinese: "洗涤剂" },
];
const actionWords: Word[] = [
  { korean: "초대하다", type: "动词", chinese: "邀请" }, { korean: "방문하다", type: "动词", chinese: "拜访" },
  { korean: "파티를 하다", type: "动词", chinese: "办派对" }, { korean: "모이다", type: "动词", chinese: "集合" },
  { korean: "준비하다", type: "动词", chinese: "准备" }, { korean: "연락하다", pronunciation: "열라카다", type: "动词", chinese: "联系" },
  { korean: "도와주다", type: "动词", chinese: "帮助" }, { korean: "가져오다", type: "动词", chinese: "带来" },
  { korean: "만들다", pronunciation: "만들다", type: "动词", chinese: "制作" }, { korean: "치우다", type: "动词", chinese: "收拾" },
  { korean: "놀러 오다", type: "动词", chinese: "来玩" }, { korean: "장보다", type: "动词", chinese: "采购" },
];
const adverbWords: Word[] = [
  { korean: "일찍", pronunciation: "일찍", type: "副词", chinese: "早早地" }, { korean: "늦게", type: "副词", chinese: "晚地" },
  { korean: "빨리", type: "副词", chinese: "快地" }, { korean: "천천히", type: "副词", chinese: "慢慢地" },
  { korean: "같이", pronunciation: "가치", type: "副词", chinese: "一起" }, { korean: "혼자", type: "副词", chinese: "独自" },
  { korean: "열심히", type: "副词", chinese: "努力地" }, { korean: "미리", type: "副词", chinese: "提前" },
  { korean: "직접", pronunciation: "직쩝", type: "副词", chinese: "亲自" }, { korean: "꼭", pronunciation: "꼭", type: "副词", chinese: "一定" },
  { korean: "아직", type: "副词", chinese: "还、尚未" }, { korean: "함께", type: "副词", chinese: "共同、一起" },
];
const phraseWords: Word[] = [
  { korean: "올 수 있어요?", type: "能力表达", chinese: "能来吗？" }, { korean: "갈 수 없어요.", pronunciation: "갈 쑤 업써요", type: "能力表达", chinese: "不能去。" },
  { korean: "제가 준비할게요.", type: "承诺", chinese: "我来准备。" }, { korean: "음식을 사러 가요.", type: "目的", chinese: "去买食物。" },
  { korean: "음악을 들으면서 요리해요.", type: "同时动作", chinese: "边听音乐边做饭。" },
  { korean: "일찍 와 주세요.", type: "副词表达", chinese: "请早点来。" },
  { korean: "같이 준비할 수 있어요?", type: "能力表达", chinese: "能一起准备吗？" },
  { korean: "제가 먼저 연락할게요.", type: "承诺", chinese: "我会先联系。" },
  { korean: "친구를 만나러 가요.", type: "目的", chinese: "去见朋友。" },
  { korean: "이야기하면서 먹어요.", type: "同时动作", chinese: "边聊天边吃。" },
  { korean: "혼자 갈 수 없어요.", type: "能力表达", chinese: "不能独自去。" },
  { korean: "천천히 설명할게요.", type: "承诺", chinese: "我会慢慢说明。" },
];

function WordGrid({ words, speak, show }: { words: Word[]; speak: Speak; show: boolean }) {
  return <div className={`mt-4 grid grid-cols-3 gap-3 ${show ? "" : "[&_[data-vocab-meaning]]:opacity-0"}`}>{words.map((word) => <KoreanEbookVocabularyCard key={`${word.korean}-${word.type}`} {...word} onSpeak={speak} />)}</div>;
}
function Dialogue({ lines, speak, show }: { lines: Line[]; speak: Speak; show: boolean }) {
  return <div className="mt-4 grid grid-cols-2 gap-3">{lines.map((line, index) => <div key={`${index}-${line.korean}`} className={`flex gap-2.5 rounded-xl p-3.5 ${index % 2 ? "bg-[#fff7ed]" : "bg-[#f4f8f6]"}`}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-black">{line.speaker}</span><div className="min-w-0 flex-1"><p className="text-[13px] font-black leading-6">{line.korean}</p><p className={`text-[10px] font-bold leading-5 text-[#71857b] ${show ? "opacity-100" : "opacity-0"}`}>{line.chinese}</p></div><KoreanEbookSpeakButton text={line.korean} onSpeak={speak} compact /></div>)}</div>;
}
function Cards({ items, show }: { items: Array<[string, string]>; show: boolean }) {
  return <div className="mt-5 grid grid-cols-2 gap-3">{items.map(([q, a]) => <article key={`${q}-${a}`} className="min-h-[68px] rounded-xl border border-[#ead8be] bg-white p-4 text-xs font-black"><span>{q}</span><p className={`mt-3 leading-5 text-[#a65b68] ${show ? "opacity-100" : "opacity-0"}`}>{a}</p></article>)}</div>;
}
function Note({ title, children, tone = "green" }: { title: string; children: ReactNode; tone?: "green" | "rose" | "amber" }) {
  const style = tone === "rose" ? "border-[#ead0d6] bg-[#fff4f6]" : tone === "amber" ? "border-[#ead8be] bg-[#fff8ed]" : "border-[#cfe3d4] bg-[#f2f8f3]";
  return <section className={`rounded-2xl border p-5 ${style}`}><p className="text-xs font-black text-[#347b69]">{title}</p><div className="mt-2 text-[13px] font-bold leading-7 text-[#45574f]">{children}</div></section>;
}

const dialogues: Array<{ title: string; description: string; lines: Line[] }> = [
  { title: "场景 1 · 邀请朋友来温居", description: "确认对方能否参加，并说明时间、地点和需要准备的物品。", lines: [
    { speaker: "A", korean: "이번 토요일에 우리 집에서 집들이를 해요.", chinese: "这周六在我家办温居。" },
    { speaker: "B", korean: "정말요? 몇 시에 시작해요?", chinese: "真的吗？几点开始？" },
    { speaker: "A", korean: "오후 여섯 시에 시작해요. 올 수 있어요?", chinese: "下午六点开始。能来吗？" },
    { speaker: "B", korean: "네, 갈 수 있어요. 조금 일찍 갈게요.", chinese: "能去。我会稍微早点到。" },
    { speaker: "A", korean: "고마워요. 같이 음식을 준비해요.", chinese: "谢谢。一起准备食物吧。" },
    { speaker: "B", korean: "제가 케이크를 사러 갈게요.", chinese: "我去买蛋糕。" },
    { speaker: "A", korean: "좋아요. 다른 친구에게도 연락할게요.", chinese: "好。我也会联系其他朋友。" },
    { speaker: "B", korean: "네, 토요일에 만나요.", chinese: "好，周六见。" },
  ]},
  { title: "场景 2 · 聚会准备与分工", description: "用承诺表达主动分工，并用副词让安排更准确。", lines: [
    { speaker: "A", korean: "손님들이 오기 전에 뭘 준비할까요?", chinese: "客人来之前准备什么？" },
    { speaker: "B", korean: "제가 거실을 빨리 청소할게요.", chinese: "我来快速打扫客厅。" },
    { speaker: "A", korean: "그럼 저는 음식을 만들게요.", chinese: "那我来做食物。" },
    { speaker: "B", korean: "음악을 들으면서 같이 준비해요.", chinese: "边听音乐边一起准备吧。" },
    { speaker: "A", korean: "음료수도 사야 돼요.", chinese: "还必须买饮料。" },
    { speaker: "B", korean: "제가 음료수를 사러 다녀올게요.", chinese: "我去买饮料再回来。" },
    { speaker: "A", korean: "천천히 와도 돼요. 시간이 많아요.", chinese: "慢慢来也行，时间很多。" },
    { speaker: "B", korean: "알겠어요. 필요한 것을 미리 적어 주세요.", chinese: "知道了，请提前写好需要的东西。" },
  ]},
  { title: "场景 3 · 婉拒邀请并再约", description: "说明客观上不能参加的原因，再提出替代安排。", lines: [
    { speaker: "A", korean: "내일 제 생일 파티에 올 수 있어요?", chinese: "明天能来我的生日派对吗？" },
    { speaker: "B", korean: "미안하지만 내일은 갈 수 없어요.", chinese: "抱歉，明天不能去。" },
    { speaker: "A", korean: "무슨 일이 있어요?", chinese: "有什么事吗？" },
    { speaker: "B", korean: "부모님을 만나러 고향에 가요.", chinese: "要回老家见父母。" },
    { speaker: "A", korean: "그렇군요. 언제 돌아와요?", chinese: "原来如此，什么时候回来？" },
    { speaker: "B", korean: "일요일 저녁에 돌아올게요.", chinese: "我会周日晚回来。" },
    { speaker: "A", korean: "그럼 다음 주에 같이 밥을 먹어요.", chinese: "那下周一起吃饭吧。" },
    { speaker: "B", korean: "좋아요. 제가 먼저 연락할게요.", chinese: "好，我会先联系你。" },
  ]},
];

export function KoreanLevelOneLessonSixteenBook({ lesson, isFullscreen, initialPage = 0, onPageChange, speechRate = 0.78 }: { lesson: KoreanLevelOneLesson; isFullscreen: boolean; initialPage?: number; onPageChange?: (page: number) => void; speechRate?: number }) {
  const containerRef = useRef<HTMLElement>(null);
  const flipBookRef = useRef<FlipBookHandle>(null);
  const [scale, setScale] = useState(0.7);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setRevealed((current) => ({ ...current, [key]: !current[key] }));
  const speak = (text: string) => { if (!("speechSynthesis" in window)) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "ko-KR"; utterance.rate = speechRate; window.speechSynthesis.speak(utterance); };
  useEffect(() => { const resize = () => { const rect = containerRef.current?.getBoundingClientRect(); if (!rect) return; setScale(Math.min((rect.width - 34) / BOOK_WIDTH, (rect.height - 28) / BOOK_HEIGHT, isFullscreen ? 1 : 0.86)); }; resize(); const observer = new ResizeObserver(resize); if (containerRef.current) observer.observe(containerRef.current); return () => observer.disconnect(); }, [isFullscreen]);
  const heading = (page: string, title: string, description: string, icon: ReactNode, action?: ReactNode) => <KoreanEbookHeading step={TEMPLATE.pageMeta[page]?.tag ?? "STEP 08"} title={title} description={description} icon={icon} action={action} />;
  const reveal = (key: string, answer = false) => <KoreanEbookRevealButton shown={Boolean(revealed[key])} onClick={() => toggle(key)} answer={answer} />;
  const speakLine = (text: string) => <div className="flex items-center justify-between gap-2"><b>{text}</b><KoreanEbookSpeakButton text={text} onSpeak={speak} compact /></div>;
  const section = (page: string, title: string, description: string, icon: ReactNode, body: ReactNode, action?: ReactNode) => <div className="flex h-full flex-col">{heading(page, title, description, icon, action)}{body}</div>;
  const grammar = (page: string, title: string, purpose: string, rules: string[], examples: Array<[string, string]>, caution: string) => section(page, title, purpose, <NotebookPen size={22} />, <><div className="mt-4 grid grid-cols-2 gap-3"><Note title="构成规则">{rules.map((rule) => <p key={rule}>{rule}</p>)}</Note><Note title="注意点" tone="amber">{caution}</Note></div><div className="mt-4 grid grid-cols-2 gap-2">{examples.map(([ko, zh]) => <article key={ko} className="rounded-xl border border-[#dce8e1] bg-white p-3 text-xs">{speakLine(ko)}<p className={`mt-1 text-[10px] text-[#71857b] ${revealed[`c${page}`] ? "opacity-100" : "opacity-0"}`}>{zh}</p></article>)}</div><div className="mt-3 rounded-xl bg-[#f5f1fa] px-4 py-3 text-xs font-bold text-[#75559a]">口头替换：改变人物、时间、地点或物品，把本页例句再说两遍。</div></>, reveal(`c${page}`));

  const dividers: Record<string, [string, string, string, ReactNode]> = {
    "02": ["STEP 01", "课前导航", "建立“发出邀请—确认能否参加—分配任务—回复邀请”的聚会交际链。", <House key="a" />],
    "04": ["STEP 02", "核心词汇", "掌握聚会、邀请、准备动作、高频副词和四项核心表达。", <PartyPopper key="b" />],
    "09": ["STEP 03", "语法讲解", "四个语法各占一页：能力、承诺、移动目的和同时动作。", <NotebookPen key="c" />],
    "14": ["STEP 04", "句型操练", "把能否参加、主动分工、行动目的和同时动作组合起来。", <Mail key="d" />],
    "18": ["STEP 05", "实战对话", "完成邀请温居、聚会分工和婉拒再约三组八句对话。", <MessageCircle key="e" />],
    "22": ["STEP 06", "听说任务", "听懂聚会时间、参加能力、分工承诺和礼物选择。", <Headphones key="f" />],
    "26": ["STEP 07", "读写拓展", "读懂邀请函与回复，并独立写出完整邀请信息。", <BookOpenCheck key="g" />],
    "29": ["STEP 08", "自测与复盘", "综合检查词汇、四项语法、邀请回复与聚会交际能力。", <CheckCircle2 key="h" />],
  };

  function renderPage(number: string): ReactNode {
    if (dividers[number]) { const [step, title, goal, icon] = dividers[number]; return <KoreanEbookSectionDivider step={step} title={title} goal={goal} icon={icon} />; }
    if (number === "01") return <KoreanEbookTableOfContents lessonNumber={16} pageMeta={TEMPLATE.pageMeta} onNavigate={(page) => flipBookRef.current?.pageFlip()?.flip(page)} entries={[
      { step: "01", title: "课前导航", detail: "建立邀请表达链", pageRange: "02" }, { step: "02", title: "核心词汇", detail: "聚会·副词·礼物", pageRange: "04" },
      { step: "03", title: "语法讲解", detail: "四项压轴语法", pageRange: "09" }, { step: "04", title: "句型操练", detail: "能力·承诺·目的", pageRange: "14" },
      { step: "05", title: "实战对话", detail: "三组八句对话", pageRange: "18" }, { step: "06", title: "听说任务", detail: "温居与分工", pageRange: "22" },
      { step: "07", title: "读写拓展", detail: "邀请函与回复", pageRange: "26" }, { step: "08", title: "自测与复盘", detail: "1B综合验收", pageRange: "29" },
    ]} />;
    if (number === "03") return section(number, "本课学习路线", "从一句“能来吗”走到完整邀请、回复与聚会协作。", <House />, <div className="mt-5 grid grid-cols-2 gap-3">{[["01","说明活动","집들이를 해요"],["02","确认能力","올 수 있어요?"],["03","回应邀请","갈 수 있어요"],["04","主动分工","제가 할게요"],["05","说明目的","사러 가요"],["06","同步准备","들으면서 만들어요"],["07","准确表达","일찍·같이·미리"],["08","礼貌收尾","토요일에 만나요"]].map(([n,t,d])=><Note key={n} title={`${n} · ${t}`}>{d}</Note>)}</div>);
    if (["05","06","07","08"].includes(number)) {
      const data: Record<string, [string,string,Word[]]> = { "05":["聚会与邀请词汇","点击卡片朗读韩语，并按场景记忆。",gatheringWords], "06":["聚会准备动作","把动作和负责的人一起说出来。",actionWords], "07":["高频副词","副词通常放在所修饰的动词或形容词前。",adverbWords], "08":["本课核心表达预览","先理解交际功能，再进入四项语法。",phraseWords] };
      const [title, desc, words] = data[number]; return section(number,title,desc,<PartyPopper size={22}/>,<><WordGrid words={words} speak={speak} show={Boolean(revealed[`w${number}`])}/>{number==="05"&&<div className="mt-3 grid grid-cols-2 gap-3"><Note title="邀请例句">주말에 집들이를 해요.<br/>친구들을 초대해요.</Note><Note title="回复例句">초대장을 받았어요.<br/>오늘 답장을 보낼게요.</Note></div>}{number==="06"&&<div className="mt-3 grid grid-cols-2 gap-3"><Note title="准备例句">손님이 오기 전에 청소해요.<br/>음식을 직접 만들어요.</Note><Note title="分工例句">제가 장을 볼게요.<br/>친구가 음료수를 가져와요.</Note></div>}{number==="07"&&<Note title="位置提示" tone="amber">일찍 와요、빨리 청소해요、같이 준비해요、혼자 가요。副词本身通常不变形。</Note>}</>,reveal(`w${number}`));
    }
    if (number === "10") return grammar(number, "1. V-(으)ㄹ 수 있다/없다", "表示能力，或客观条件允许／不允许做某事。", ["无收音：-ㄹ 수 있어요/없어요", "有收音：-을 수 있어요/없어요", "ㄹ收音：直接接 수"], [["내일 우리 집에 올 수 있어요?","明天能来我家吗？"],["저는 매운 음식을 먹을 수 있어요.","我能吃辣的食物。"],["오늘은 늦게까지 있을 수 없어요.","今天不能待到很晚。"],["여기에서 파티를 할 수 있어요.","可以在这里办派对。"],["혼자서 준비할 수 있어요?","能独自准备吗？"],["차가 없어서 많이 가져올 수 없어요.","因为没有车，不能带很多东西来。"]], "“못+V”也表示做不到；本语法更适合明确讨论能力或条件。만들다→만들 수 있어요，ㄹ不重复。");
    if (number === "11") return grammar(number, "2. V-(으)ㄹ게요", "向听话人作出当场决定、承诺或主动承担。", ["无收音：-ㄹ게요", "有收音：-을게요", "ㄹ收音：直接接-게요"], [["제가 음식을 만들게요.","食物由我来做。"],["친구들에게 연락할게요.","我会联系朋友们。"],["케이크는 제가 찾을게요.","蛋糕我来找。"],["거실을 빨리 치울게요.","我会快速收拾客厅。"],["제가 먼저 도착할게요.","我会先到。"],["필요한 것을 메모할게요.","我会把需要的东西记下来。"]], "主语原则上是第一人称，并且有听话人作为承诺对象；单纯预测天气不用-ㄹ게요。");
    if (number === "12") return grammar(number, "3. V-(으)러 가다/오다", "说明去、来或往返的目的。", ["无收音或ㄹ收音：-러", "有收音：-으러", "句尾接가다/오다/다니다等移动动词"], [["친구를 만나러 가요.","去见朋友。"],["음식을 먹으러 식당에 가요.","去餐厅吃饭。"],["우리 집에 놀러 오세요.","请来我家玩。"],["한국어를 배우러 한국에 왔어요.","为了学韩语来到韩国。"],["집들이 선물을 사러 나가요.","出去买温居礼物。"],["준비를 도우러 일찍 왔어요.","为了帮忙准备而早早来了。"]], "前项必须是行动目的；不能把后项换成普通非移动动作。놀다→놀러 가요，ㄹ收音直接加-러。");
    if (number === "13") return grammar(number, "4. V-(으)면서", "同一主体一边做前项，一边做后项。", ["无收音或ㄹ收音：-면서", "有收音：-으면서", "两个动作同时进行"], [["음악을 들으면서 청소해요.","边听音乐边打扫。"],["친구하고 이야기하면서 요리해요.","边和朋友聊天边做饭。"],["음식을 먹으면서 영화를 봐요.","边吃东西边看电影。"],["노래하면서 집에 가요.","边唱歌边回家。"],["메뉴를 보면서 음식을 골라요.","边看菜单边选食物。"],["웃으면서 손님을 맞이해요.","微笑着迎接客人。"]], "初级阶段先遵守“前后主语相同”。若两个动作由不同的人完成，不使用这一结构硬连。");
    if (["15","16","17"].includes(number)) {
      const data: Record<string,[string,string,Array<[string,string]>]> = {
        "15":["能力形式训练","根据收音完成“能／不能”表达。",[["가다","갈 수 있어요"],["먹다","먹을 수 있어요"],["오다","올 수 있어요"],["만들다","만들 수 있어요"],["듣다","들을 수 있어요"],["돕다","도울 수 있어요"],["하다","할 수 없어요"],["찾다","찾을 수 없어요"],["놀다","놀 수 있어요"],["준비하다","준비할 수 있어요"]]],
        "16":["承诺与目的训练","区分“我来做”和“去做某事”。",[["我来准备","제가 준비할게요."],["我会联系","제가 연락할게요."],["去买食物","음식을 사러 가요."],["来我家玩","우리 집에 놀러 와요."],["去见朋友","친구를 만나러 가요."],["我来制作","제가 만들게요."],["去帮忙准备","준비를 도우러 가요."],["我会带礼物来","선물을 가져올게요."],["去买饮料","음료수를 사러 가요."],["我来收拾","제가 치울게요."]]],
        "17":["同时动作与副词","把两项动作和合适副词组成自然句。",[["听音乐＋打扫","음악을 들으면서 청소해요."],["聊天＋做饭","이야기하면서 요리해요."],["早一点＋来","일찍 와요."],["慢慢地＋吃","천천히 먹어요."],["一起＋准备","같이 준비해요."],["独自＋采购","혼자 장을 봐요."],["微笑＋迎接","웃으면서 맞이해요."],["努力＋帮助","열심히 도와줘요."],["提前＋联系","미리 연락해요."],["边看＋记录","보면서 메모해요."]]],
      }; const [title,desc,items]=data[number]; return section(number,title,desc,<NotebookPen size={22}/>,<Cards items={items} show={Boolean(revealed[`p${number}`])}/>,reveal(`p${number}`,true));
    }
    if (["19","20","21"].includes(number)) { const d=dialogues[Number(number)-19]; return section(number,d.title,d.description,<MessageCircle size={22}/>,<Dialogue lines={d.lines} speak={speak} show={Boolean(revealed[`d${number}`])}/>,reveal(`d${number}`)); }
    if (number === "23") return section(number,"1. 听力 · 温居邀请与分工","播放后记录时间、参加者、承诺和购物目的。",<Headphones size={22}/>,<><button type="button" onClick={()=>speak("토요일 오후 여섯 시에 지수 씨 집에서 집들이를 해요. 민수 씨는 일찍 올 수 있어요. 민수 씨가 음료수를 사러 갈게요. 수진 씨는 음악을 들으면서 음식을 만들 거예요. 모두 휴지나 세제를 선물로 준비하려고 해요.")} className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-[#a65b68] p-4 text-sm font-black text-white"><Volume2 size={17}/>播放温居安排</button><Cards items={[["时间","토요일 오후 6시"],["地点","지수 씨 집"],["谁能早来？","민수 씨"],["民秀的承诺","음료수를 사러 갈게요"],["秀珍同时做什么？","들으면서 만들어요"],["礼物","휴지나 세제"],["聚会类型","집들이"],["准备方式","같이 준비해요"]]} show={Boolean(revealed.listen)}/></>,reveal("listen",true));
    if (number === "24") return section(number,"2. 文化漫步 · 집들이 선물","了解传统寓意，同时尊重现代个人需求。",<Gift size={22}/>,<><div className="mt-4 grid grid-cols-2 gap-3"><Note title="휴지 · 卷筒纸">传统解释常把纸张顺畅展开，联系到生活和事情顺利展开。</Note><Note title="세제 · 洗涤剂">洗涤剂产生丰富泡沫，因此民间也会把它与财富、福气增长联系起来。</Note><Note title="现代选择" tone="amber">绿植、香氛、生活用品或礼券也很常见。礼物应结合主人的喜好、空间和实际需要。</Note><Note title="不是硬性规定" tone="rose">卫生纸和洗涤剂是知名的传统乔迁礼物，并非每位韩国人都要求收到，也不是唯一正确选择。</Note><Note title="拜访表达">초대해 줘서 고마워요.<br/>집이 정말 예쁘네요!</Note><Note title="送礼表达">집들이 선물이에요.<br/>마음에 들면 좋겠어요.</Note></div></>);
    if (number === "25") return section(number,"3. 60秒邀请与回复","两人轮流完成邀请、确认能力、承诺和分工。",<Mic2 size={22}/>,<div className="mt-4 grid grid-cols-2 gap-3"><Note title="邀请人">이번 ______에 ______을/를 해요.<br/>우리 집에 올 수 있어요?<br/>______을 준비해 주세요.<br/>같이 ______면서 준비해요.</Note><Note title="受邀人">네, 갈 수 있어요.<br/>제가 ______할게요.<br/>______을 사러 갈게요.<br/>조금 ______ 갈게요.</Note><Note title="不能参加时" tone="amber">미안하지만 갈 수 없어요.<br/>______러 가야 돼요.<br/>다음에 제가 먼저 연락할게요.</Note><Note title="必须包含">四项核心语法各至少一次，并使用两个本课副词。</Note><Note title="确认信息">몇 시에 시작해요?<br/>어디로 가면 돼요?</Note><Note title="礼貌收尾">초대해 줘서 고마워요.<br/>그날 만나요!</Note></div>);
    if (number === "27") return section(number,"1. 阅读 · 집들이 초대와 답장","找出邀请时间、地点、活动、是否参加和来宾承诺。",<BookOpenCheck size={22}/>,<><section className="mt-4 rounded-2xl border border-[#ead0d6] bg-white p-5"><p className="text-[11px] font-black text-[#a65b68]">초대</p><p className="mt-2 text-sm font-bold leading-7">이번 일요일 오후 다섯 시에 새 집에서 집들이를 해요. 같이 음식을 먹으면서 이야기하고 싶어요. 우리 집에 올 수 있어요?</p><p className="mt-3 text-[11px] font-black text-[#a65b68]">답장</p><p className="mt-2 text-sm font-bold leading-7">초대해 줘서 고마워요. 일요일에 갈 수 있어요. 제가 음료수를 사러 갈게요. 준비를 도울 수 있으니까 조금 일찍 갈게요.</p></section><Cards items={[["什么时候？","일요일 오후 5시"],["在哪里？","새 집"],["边做什么边聊天？","음식을 먹으면서"],["能参加吗？","갈 수 있어요"],["承诺做什么？","음료수를 사러 갈게요"],["何时到？","조금 일찍"]]} show={Boolean(revealed.read)}/></>,reveal("read",true));
    if (number === "28") return section(number,"2. 写作 · 我的邀请函与回复","分别写6—8句邀请和回复，信息必须具体。",<Mail size={22}/>,<><div className="mt-4 grid grid-cols-2 gap-3"><Note title="邀请函骨架">活动 → 日期 → 时间 → 地点 → 邀请对象 → 能否参加 → 一起做什么 → 联系方式</Note><Note title="回复骨架">感谢 → 能／不能参加 → 原因 → 到达时间 → 主动承诺 → 去买／带来物品</Note></div><section className="mt-4 rounded-2xl border border-dashed border-[#d9aeb8] bg-[#fff9fa] p-5"><p className="text-[11px] font-black text-[#a65b68]">原创示范</p><p className="mt-3 text-sm font-bold leading-7">토요일 저녁에 우리 집에서 작은 파티를 해요. 오후 여섯 시에 올 수 있어요? 친구들과 음악을 들으면서 저녁을 먹을 거예요. 올 수 있으면 금요일까지 연락해 주세요. 저는 갈 수 있어요. 조금 일찍 가서 준비를 도울게요. 그리고 케이크를 사러 갈게요.</p></section><div className="mt-3 grid grid-cols-2 gap-3 text-xs font-black"><span className="rounded-xl bg-[#f2f8f3] p-3">✓ 올 수 있어요?</span><span className="rounded-xl bg-[#fff8ed] p-3">✓ 제가 준비할게요.</span><span className="rounded-xl bg-[#f2f8f3] p-3">✓ 사러 갈게요.</span><span className="rounded-xl bg-[#fff8ed] p-3">✓ 들으면서 먹어요.</span></div></>);
    if (["30","31","32","33"].includes(number)) {
      const data: Record<string,[string,string,Array<[string,string]>]> = {
        "30":["1. 聚会与副词检测","看到中文后说出韩语。",[["聚会","모임"],["乔迁宴","집들이"],["邀请","초대하다"],["拜访","방문하다"],["早点","일찍"],["慢慢地","천천히"],["独自","혼자"],["努力地","열심히"],["提前","미리"],["共同、一起","함께"]]],
        "31":["2. 能力与承诺检测","完成正确形式。",[["오다 + 能","올 수 있어요"],["먹다 + 不能","먹을 수 없어요"],["만들다 + 能","만들 수 있어요"],["하다 + 我来","할게요"],["찾다 + 我来","찾을게요"],["듣다 + 我来","들을게요"],["놀다 + 我来","놀게요"],["가다 + 不能","갈 수 없어요"],["돕다 + 能","도울 수 있어요"],["준비하다 + 我来","준비할게요"]]],
        "32":["3. 目的与同时动作检测","完成完整表达。",[["去买礼物","선물을 사러 가요."],["来玩","놀러 와요."],["去见朋友","친구를 만나러 가요."],["边听边打扫","들으면서 청소해요."],["边吃边聊天","먹으면서 이야기해요."],["边走边通话","걸으면서 통화해요."],["去帮助朋友","친구를 도우러 가요."],["边看边选择","보면서 골라요."],["来参加聚会","모임에 참석하러 와요."],["边笑边说","웃으면서 말해요."]]],
        "33":["4. 易错点诊所","纠正收音、主语和动作关系。",[["먹ㄹ 수 있어요 ×","먹을 수 있어요 ✓"],["만들을 수 있어요 ×","만들 수 있어요 ✓"],["내일 비가 올게요 ×","내일 비가 올 거예요 ✓"],["민수 씨가 할게요 ×","제가 할게요 ✓"],["먹러 가요 ×","먹으러 가요 ✓"],["놀으러 가요 ×","놀러 가요 ✓"],["저는 듣으면서 ×","저는 들으면서 ✓"],["제가 요리하면서 친구가 청소해요 ×","主语不同，拆成两句 ✓"],["갈 수 있어요 없어요 ×","갈 수 없어요 ✓"],["친구가 올게요 ×","친구가 올 거예요 ✓"]]],
      }; const [title,desc,items]=data[number]; return section(number,title,desc,<CheckCircle2 size={22}/>,<Cards items={items} show={Boolean(revealed[`t${number}`])}/>,reveal(`t${number}`,true));
    }
    if (number === "34") return section(number,"5. 1B结业口语验收 · 我的聚会","完成不少于12句的邀请、回复和现场分工。",<Mic2 size={22}/>,<><section className="mt-4 rounded-2xl border border-[#ead0d6] bg-[#fff4f6] p-5"><div className="grid grid-cols-2 gap-3 text-xs">{["说明聚会类型","说出日期和时间","说明地点","询问能否参加","接受或婉拒","主动承担任务","说明行动目的","使用同时动作","使用两个副词","提到乔迁礼物"].map((task)=><label key={task} className="flex items-center gap-2 rounded-xl bg-white p-3 font-bold"><input type="checkbox" className="accent-[#a65b68]"/>{task}</label>)}</div></section><div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-black"><span className="rounded-xl bg-[#eef6fb] p-3">内容完整 40%</span><span className="rounded-xl bg-[#f2f8f3] p-3">语法正确 40%</span><span className="rounded-xl bg-[#fff8ed] p-3">表达自然 20%</span></div><button type="button" onClick={()=>speak("이번 토요일에 우리 집에서 집들이를 해요. 오후 여섯 시에 올 수 있어요? 네, 갈 수 있어요. 제가 음료수를 준비할게요. 케이크도 사러 갈게요. 조금 일찍 가서 음악을 들으면서 같이 준비해요.")} className="mt-auto flex items-center justify-center gap-2 rounded-2xl bg-[#a65b68] p-4 text-sm font-black text-white"><Volume2 size={16}/>播放原创示范</button></>);
    if (number === "35") return <div className="flex h-full flex-col justify-center"><div className="mx-auto w-full max-w-[440px] text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff0f3] text-[#a65b68]"><Sparkles size={27}/></span><p className="mt-4 text-xs font-black tracking-[0.18em] text-[#a65b68]">LESSON 16 · 1B COMPLETE</p><h2 className="mt-3 text-4xl font-black">우리 집에 올 수 있어요?</h2><p className="mt-3 text-lg font-black">你已经完成韩国语1级课程</p><p className="mx-auto mt-3 max-w-[400px] text-sm leading-7 text-[#60736a]">现在你能发出和回复邀请、询问能否参加、主动承诺分工、说明行动目的，并描述同时进行的动作。</p><div className="mt-4 grid grid-cols-2 gap-3 text-left">{[["01","能力条件","V-(으)ㄹ 수 있다/없다"],["02","承诺决定","V-(으)ㄹ게요"],["03","移动目的","V-(으)러 가다/오다"],["04","同时动作","V-(으)면서"]].map(([i,t,d])=><div key={i} className="rounded-xl border border-[#ead0d6] bg-white px-4 py-3"><p className="text-[10px] font-black text-[#a65b68]">{i}</p><p className="mt-1 text-xs font-black">{t}</p><p className="mt-1 text-[10px] text-[#71857b]">{d}</p></div>)}</div><button type="button" onClick={()=>flipBookRef.current?.pageFlip()?.flip(1)} className="mt-4 rounded-full bg-[#fff0f3] px-4 py-3 text-xs font-black text-[#a65b68]">返回目录</button></div></div>;
    return null;
  }

  const pages = Array.from({ length: 35 }, (_, index) => { const number = String(index + 1).padStart(2, "0"); return <Page key={`16-${number}`} number={number}>{renderPage(number)}</Page>; });
  return <section ref={containerRef} className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden"><div className="relative shrink-0" style={{ width: BOOK_WIDTH * scale, height: BOOK_HEIGHT * scale }}><button type="button" onClick={()=>flipBookRef.current?.pageFlip()?.flipPrev()} aria-label="上一页" className="absolute -left-14 top-1/2 z-20 -translate-y-1/2 rounded-full border border-[#ead0d6] bg-white p-3 text-[#a65b68] shadow-lg"><ArrowLeft size={18}/></button><button type="button" onClick={()=>flipBookRef.current?.pageFlip()?.flipNext()} aria-label="下一页" className="absolute -right-14 top-1/2 z-20 -translate-y-1/2 rounded-full border border-[#ead0d6] bg-white p-3 text-[#a65b68] shadow-lg"><ArrowRight size={18}/></button><div className="absolute left-0 top-0 h-[822px] w-[1180px] origin-top-left" style={{ transform: `scale(${scale})` }}><HTMLFlipBook ref={flipBookRef} width={590} height={822} startPage={initialPage} size="fixed" minWidth={590} maxWidth={590} minHeight={822} maxHeight={822} drawShadow maxShadowOpacity={0.32} flippingTime={650} usePortrait startZIndex={0} autoSize={false} showCover={false} mobileScrollSupport swipeDistance={24} clickEventForward useMouseEvents={false} showPageCorners={false} disableFlipByClick onFlip={(event)=>onPageChange?.(event.data)} className="h-[822px] w-[1180px]" style={{}}><Page number="封面" cover><KoreanEbookCover lesson={lesson}/></Page>{pages}</HTMLFlipBook></div></div></section>;
}
