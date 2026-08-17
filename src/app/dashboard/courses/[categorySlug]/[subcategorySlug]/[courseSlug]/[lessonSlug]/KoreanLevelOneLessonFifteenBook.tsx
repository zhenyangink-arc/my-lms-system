"use client";

import dynamic from "next/dynamic";

const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false });
import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, BookOpenCheck, CheckCircle2, Compass, Headphones,
  Map, MessageCircle, Mic2, NotebookPen, Sparkles, Volume2,
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
  { step: "第一步", label: "课前导航", dividerPage: 2, contentPages: [3] },
  { step: "第二步", label: "核心词汇", dividerPage: 4, contentPages: [5, 6, 7, 8] },
  { step: "第三步", label: "语法讲解", dividerPage: 9, contentPages: [10, 11, 12, 13] },
  { step: "第四步", label: "句型操练", dividerPage: 14, contentPages: [15, 16, 17] },
  { step: "第五步", label: "实战对话", dividerPage: 18, contentPages: [19, 20, 21] },
  { step: "第六步", label: "听说任务", dividerPage: 22, contentPages: [23, 24, 25] },
  { step: "第七步", label: "读写拓展", dividerPage: 26, contentPages: [27, 28] },
  { step: "第八步", label: "自测与复盘", dividerPage: 29, contentPages: [30, 31, 32, 33, 34, 35] },
]);

const Page = forwardRef<HTMLDivElement, { children: ReactNode; number: string; cover?: boolean }>(
  function Page({ children, number, cover = false }, ref) {
    return <KoreanEbookPage ref={ref} number={number} header={TEMPLATE.headers[number] ?? "第15课 · 여행을 가고 싶어요"} cover={cover} sectionMeta={TEMPLATE.pageMeta[number]} hideContentOverflow>{children}</KoreanEbookPage>;
  }
);

const travelWords: Word[] = [
  { korean: "여행", type: "名词", chinese: "旅行" }, { korean: "여행지", type: "名词", chinese: "旅行地" },
  { korean: "바다", type: "名词", chinese: "海" }, { korean: "산", type: "名词", chinese: "山" },
  { korean: "섬", pronunciation: "섬", type: "名词", chinese: "岛" }, { korean: "여권", pronunciation: "여꿘", type: "名词", chinese: "护照" },
  { korean: "표", type: "名词", chinese: "票" }, { korean: "사진", type: "名词", chinese: "照片" },
  { korean: "경치", type: "名词", chinese: "风景" }, { korean: "숙소", pronunciation: "숙쏘", type: "名词", chinese: "住处" },
  { korean: "지도", type: "名词", chinese: "地图" }, { korean: "해외", type: "名词", chinese: "海外" },
];
const actionWords: Word[] = [
  { korean: "여행을 가다", type: "动词", chinese: "去旅行" }, { korean: "구경하다", type: "动词", chinese: "参观、逛" },
  { korean: "사진을 찍다", pronunciation: "사진을 찍따", type: "动词", chinese: "拍照" }, { korean: "쉬다", type: "动词", chinese: "休息" },
  { korean: "예약하다", type: "动词", chinese: "预订" }, { korean: "준비하다", type: "动词", chinese: "准备" },
  { korean: "출발하다", type: "动词", chinese: "出发" }, { korean: "도착하다", pronunciation: "도차카다", type: "动词", chinese: "到达" },
  { korean: "머물다", type: "动词", chinese: "停留" }, { korean: "등산하다", type: "动词", chinese: "登山" },
  { korean: "수영하다", type: "动词", chinese: "游泳" }, { korean: "맛보다", pronunciation: "맏뽀다", type: "动词", chinese: "品尝" },
];
const placeWords: Word[] = [
  { korean: "제주도", type: "地名", chinese: "济州岛" }, { korean: "부산", type: "地名", chinese: "釜山" },
  { korean: "경주", type: "地名", chinese: "庆州" }, { korean: "해운대", type: "地名", chinese: "海云台" },
  { korean: "한라산", type: "地名", chinese: "汉拿山" }, { korean: "불국사", pronunciation: "불국싸", type: "地名", chinese: "佛国寺" },
  { korean: "신혼여행", type: "名词", chinese: "蜜月旅行" }, { korean: "국내 여행", pronunciation: "궁내 여행", type: "名词", chinese: "国内旅行" },
  { korean: "해외여행", type: "名词", chinese: "海外旅行" },
  { korean: "성산일출봉", type: "地名", chinese: "城山日出峰" },
  { korean: "대릉원", type: "地名", chinese: "大陵苑" },
  { korean: "감천문화마을", type: "地名", chinese: "甘川文化村" },
];
const soundWords: Word[] = [
  { korean: "밥 먹다", pronunciation: "밤 먹따", type: "鼻音化", chinese: "吃饭" },
  { korean: "국물", pronunciation: "궁물", type: "鼻音化", chinese: "汤汁" },
  { korean: "한국말", pronunciation: "한궁말", type: "鼻音化", chinese: "韩国话" },
  { korean: "작년", pronunciation: "장년", type: "鼻音化", chinese: "去年" },
  { korean: "십 년", pronunciation: "심 년", type: "鼻音化", chinese: "十年" },
  { korean: "입문", pronunciation: "임문", type: "鼻音化", chinese: "入门" },
  { korean: "먹는", pronunciation: "멍는", type: "鼻音化", chinese: "吃的" },
  { korean: "앞문", pronunciation: "암문", type: "鼻音化", chinese: "前门" },
  { korean: "닫는", pronunciation: "단는", type: "鼻音化", chinese: "关着的" },
  { korean: "백만", pronunciation: "뱅만", type: "鼻音化", chinese: "一百万" },
  { korean: "합니다", pronunciation: "함니다", type: "鼻音化", chinese: "做（正式体）" },
  { korean: "몇 명", pronunciation: "면 명", type: "鼻音化", chinese: "几个人" },
];

function WordGrid({ words, speak, show }: { words: Word[]; speak: Speak; show: boolean }) {
  return <div className={`mt-4 grid grid-cols-3 gap-3 ${show ? "" : "[&_[data-vocab-meaning]]:opacity-0"}`}>{words.map((word) => <KoreanEbookVocabularyCard key={`${word.korean}-${word.type}`} {...word} onSpeak={speak} />)}</div>;
}
function Dialogue({ lines, speak, show }: { lines: Line[]; speak: Speak; show: boolean }) {
  return <div className="mt-4 grid grid-cols-2 gap-3">{lines.map((line, index) => <div key={`${index}-${line.korean}`} className={`flex gap-2.5 rounded-xl p-3.5 ${index % 2 ? "bg-[var(--status-warning-surface)]" : "bg-[var(--status-success-surface)]"}`}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold">{line.speaker}</span><div className="min-w-0 flex-1"><p className="text-[13px] font-bold leading-6">{line.korean}</p><p className={`text-[10px] font-bold leading-5 text-[var(--foreground-secondary)] ${show ? "opacity-100" : "opacity-0"}`}>{line.chinese}</p></div><KoreanEbookSpeakButton text={line.korean} onSpeak={speak} compact /></div>)}</div>;
}
function Cards({ items, show }: { items: Array<[string, string]>; show: boolean }) {
  return <div className="mt-5 grid grid-cols-2 gap-3">{items.map(([q, a]) => <article key={`${q}-${a}`} className="min-h-[68px] rounded-xl border border-[var(--border)] bg-white p-4 text-xs font-bold"><span>{q}</span><p className={`mt-3 leading-5 text-[var(--destructive)] ${show ? "opacity-100" : "opacity-0"}`}>{a}</p></article>)}</div>;
}
function Note({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-[var(--border)] bg-[var(--status-success-surface)] p-5"><p className="text-xs font-bold text-[var(--status-success)]">{title}</p><div className="mt-2 text-[13px] font-bold leading-7 text-[var(--foreground-secondary)]">{children}</div></section>;
}

const dialogues: Array<{ title: string; description: string; lines: Line[] }> = [
  { title: "场景 1 · 讨论暑假旅行", description: "用条件句询问计划，并表达自己的旅行愿望。", lines: [
    { speaker: "A", korean: "이번 방학에 뭐 하고 싶어요?", chinese: "这个假期想做什么？" },
    { speaker: "B", korean: "시간이 있으면 여행을 가고 싶어요.", chinese: "如果有时间，我想去旅行。" },
    { speaker: "A", korean: "어디에 가고 싶어요?", chinese: "想去哪里？" },
    { speaker: "B", korean: "바다가 아름다운 제주도에 가고 싶어요.", chinese: "想去海景美丽的济州岛。" },
    { speaker: "A", korean: "제주도에서 뭘 하고 싶어요?", chinese: "想在济州岛做什么？" },
    { speaker: "B", korean: "바다를 구경하고 사진을 찍고 싶어요.", chinese: "想看海并拍照。" },
    { speaker: "A", korean: "표가 싸면 저도 같이 갈게요.", chinese: "如果票便宜，我也一起去。" },
    { speaker: "B", korean: "좋아요. 오늘 같이 찾아봐요.", chinese: "好，今天一起查查吧。" },
  ]},
  { title: "场景 2 · 推荐韩国旅行地", description: "用动词定语介绍自己喜欢、常去或想参观的地方。", lines: [
    { speaker: "A", korean: "한국에서 좋아하는 여행지가 어디예요?", chinese: "在韩国喜欢的旅行地是哪里？" },
    { speaker: "B", korean: "제가 좋아하는 여행지는 경주예요.", chinese: "我喜欢的旅行地是庆州。" },
    { speaker: "A", korean: "경주에서 볼 수 있는 곳이 많아요?", chinese: "庆州可看的地方多吗？" },
    { speaker: "B", korean: "네, 옛날 역사를 보여 주는 곳이 많아요.", chinese: "是的，有很多展现古代历史的地方。" },
    { speaker: "A", korean: "사람들이 많이 가는 곳은 어디예요?", chinese: "人们常去哪里？" },
    { speaker: "B", korean: "불국사와 대릉원에 많이 가요.", chinese: "很多人去佛国寺和大陵苑。" },
    { speaker: "A", korean: "날씨가 좋으면 저도 가고 싶어요.", chinese: "天气好我也想去。" },
    { speaker: "B", korean: "봄에 가면 경치가 정말 아름다워요.", chinese: "春天去景色非常美。" },
  ]},
  { title: "场景 3 · 朋友的旅行愿望", description: "区别“我想……”和对第三人的客观愿望描述。", lines: [
    { speaker: "A", korean: "민수 씨도 같이 여행을 가고 싶어 해요?", chinese: "民秀也想一起旅行吗？" },
    { speaker: "B", korean: "네, 민수 씨는 부산에 가고 싶어 해요.", chinese: "是的，民秀想去釜山。" },
    { speaker: "A", korean: "왜 부산에 가고 싶어 해요?", chinese: "他为什么想去釜山？" },
    { speaker: "B", korean: "해운대에서 수영하고 싶어 해요.", chinese: "他想在海云台游泳。" },
    { speaker: "A", korean: "지수 씨는요?", chinese: "智秀呢？" },
    { speaker: "B", korean: "지수 씨는 조용한 섬에서 쉬고 싶어 해요.", chinese: "智秀想在安静的岛上休息。" },
    { speaker: "A", korean: "모두 시간이 맞으면 좋겠어요.", chinese: "希望大家时间能合得上。" },
    { speaker: "B", korean: "네, 이번 주에 계획을 세워 봐요.", chinese: "好，这周试着做计划吧。" },
  ]},
];

export function KoreanLevelOneLessonFifteenBook({ lesson, isFullscreen, initialPage = 0, onPageChange, speechRate = 0.78 }: { lesson: KoreanLevelOneLesson; isFullscreen: boolean; initialPage?: number; onPageChange?: (page: number) => void; speechRate?: number }) {
  const containerRef = useRef<HTMLElement>(null);
  const flipBookRef = useRef<FlipBookHandle>(null);
  const [scale, setScale] = useState(0.7);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setRevealed((current) => ({ ...current, [key]: !current[key] }));
  const speak = (text: string) => { if (!("speechSynthesis" in window)) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "ko-KR"; utterance.rate = speechRate; window.speechSynthesis.speak(utterance); };
  useEffect(() => { const resize = () => { const rect = containerRef.current?.getBoundingClientRect(); if (!rect) return; setScale(Math.min((rect.width - 34) / BOOK_WIDTH, (rect.height - 28) / BOOK_HEIGHT, isFullscreen ? 1 : 0.86)); }; resize(); const observer = new ResizeObserver(resize); if (containerRef.current) observer.observe(containerRef.current); return () => observer.disconnect(); }, [isFullscreen]);
  const heading = (page: string, title: string, description: string, icon: ReactNode, action?: ReactNode) => <KoreanEbookHeading step={TEMPLATE.pageMeta[page]?.tag ?? "第八步"} title={title} description={description} icon={icon} action={action} />;
  const reveal = (key: string, answer = false) => <KoreanEbookRevealButton shown={Boolean(revealed[key])} onClick={() => toggle(key)} answer={answer} />;
  const speakLine = (text: string) => <div className="flex items-center justify-between gap-2"><b>{text}</b><KoreanEbookSpeakButton text={text} onSpeak={speak} compact /></div>;
  const section = (page: string, title: string, description: string, icon: ReactNode, body: ReactNode, action?: ReactNode) => <div className="flex h-full flex-col">{heading(page, title, description, icon, action)}{body}</div>;
  const grammar = (page: string, title: string, purpose: string, rules: string[], examples: Array<[string, string]>, caution: string) => section(page, title, purpose, <NotebookPen aria-hidden="true" size={22} />, <><div className="mt-4 grid grid-cols-2 gap-3"><Note title="构成规则">{rules.map((rule) => <p key={rule}>{rule}</p>)}</Note><Note title="注意点">{caution}</Note></div><div className="mt-4 grid grid-cols-2 gap-2">{examples.map(([ko, zh]) => <article key={ko} className="rounded-xl border border-[var(--border)] bg-white p-3 text-xs">{speakLine(ko)}<p className={`mt-1 text-[10px] text-[var(--foreground-secondary)] ${revealed[`c${page}`] ? "opacity-100" : "opacity-0"}`}>{zh}</p></article>)}</div><div className="mt-3 rounded-xl bg-[var(--accent)] px-4 py-3 text-xs font-bold text-[var(--primary)]">口头替换：改变旅行时间、目的地、人物或活动，把本页例句再说两遍。</div></>, reveal(`c${page}`));

  const dividers: Record<string, [string, string, string, ReactNode]> = {
    "02": ["第一步", "课前导航", "建立“选择目的地—说明愿望—判断条件—制定计划”的旅行表达链。", <Compass aria-hidden="true" key="a" />],
    "04": ["第二步", "核心词汇", "掌握旅行地点、用品、活动、韩国目的地和鼻音化词汇。", <Map aria-hidden="true" key="b" />],
    "09": ["第三步", "语法讲解", "四个语法各占一页：条件、动词定语、第一二人称愿望、第三人称愿望。", <NotebookPen aria-hidden="true" key="c" />],
    "14": ["第四步", "句型操练", "把条件、目的地、活动和不同人物的愿望组合成完整表达。", <Compass aria-hidden="true" key="d" />],
    "18": ["第五步", "实战对话", "完成三组各八句的计划、推荐与旅行愿望对话。", <MessageCircle aria-hidden="true" key="e" />],
    "22": ["第六步", "听说任务", "听懂目的地、旅行活动、条件和人物愿望，并完成口头规划。", <Headphones aria-hidden="true" key="f" />],
    "26": ["第七步", "读写拓展", "读懂原创旅行推荐，并写出自己的旅行计划。", <BookOpenCheck aria-hidden="true" key="g" />],
    "29": ["第八步", "自测与复盘", "综合检查旅行词汇、四项语法、鼻音化和交际能力。", <CheckCircle2 aria-hidden="true" key="h" />],
  };

  function renderPage(number: string): ReactNode {
    if (dividers[number]) { const [step, title, goal, icon] = dividers[number]; return <KoreanEbookSectionDivider step={step} title={title} goal={goal} icon={icon} />; }
    if (number === "01") return <KoreanEbookTableOfContents lessonNumber={15} pageMeta={TEMPLATE.pageMeta} onNavigate={(page) => flipBookRef.current?.pageFlip()?.flip(page)} entries={[
      { step: "01", title: "课前导航", detail: "建立旅行表达链", pageRange: "02" }, { step: "02", title: "核心词汇", detail: "旅行·地点·发音", pageRange: "04" },
      { step: "03", title: "语法讲解", detail: "四项核心语法", pageRange: "09" }, { step: "04", title: "句型操练", detail: "条件与愿望", pageRange: "14" },
      { step: "05", title: "实战对话", detail: "三组八句对话", pageRange: "18" }, { step: "06", title: "听说任务", detail: "蜜月与旅行计划", pageRange: "22" },
      { step: "07", title: "读写拓展", detail: "旅行推荐文", pageRange: "26" }, { step: "08", title: "自测与复盘", detail: "综合验收", pageRange: "29" },
    ]} />;
    if (number === "03") return section(number, "本课学习路线", "从“想去哪儿”走到一份完整、自然的旅行计划。", <Compass aria-hidden="true" />, <div className="mt-5 grid grid-cols-2 gap-3">{[["01","选地点","여행지"],["02","设条件","-(으)면"],["03","说愿望","-고 싶다"],["04","谈他人","-고 싶어 하다"],["05","做推荐","V-는 N"],["06","安排活动","구경하다·찍다"],["07","准备交通","표·비행기·기차"],["08","完成计划","什么时候、和谁、做什么"]].map(([n,t,d])=><Note key={n} title={`${n} · ${t}`}>{d}</Note>)}</div>);
    if (["05","06","07","08"].includes(number)) {
      const data: Record<string, [string,string,Word[]]> = { "05":["旅行地点与用品","点击每张卡片可朗读韩语。",travelWords], "06":["旅行活动动词","把“去哪儿”和“做什么”一起记忆。",actionWords], "07":["韩国旅行地与蜜月话题","地名是旅行对话中的高频信息。",placeWords], "08":["发音 · 鼻音化 2","ㄱ、ㄷ、ㅂ在ㄴ、ㅁ前分别趋向ㅇ、ㄴ、ㅁ。",soundWords] };
      const [title, desc, words] = data[number]; return section(number,title,desc,<Map aria-hidden="true" size={22}/>,<><WordGrid words={words} speak={speak} show={Boolean(revealed[`w${number}`])}/>{number==="05"&&<div className="mt-3 grid grid-cols-2 gap-3"><Note title="目的地例句">바다와 산 중에 어디에 가고 싶어요?</Note><Note title="准备例句">여권과 비행기 표를 미리 준비해요.</Note></div>}{number==="06"&&<div className="mt-3 grid grid-cols-2 gap-3"><Note title="活动例句">경치를 구경하고 사진을 찍어요.</Note><Note title="休息例句">숙소에서 쉬고 맛있는 음식을 맛봐요.</Note></div>}{number==="07"&&<div className="mt-3 grid grid-cols-2 gap-3"><Note title="海边旅行">부산에 가면 해운대를 구경하고 싶어요.</Note><Note title="历史旅行">경주에서 불국사와 대릉원을 보고 싶어요.</Note></div>}{number==="08"&&<Note title="不要按拼写逐字硬读">鼻音化改变的是实际发音，不改变书写。밥 먹다读作[밤 먹따]；后面的ㅁ促使前面的ㅂ变为鼻音ㅁ。</Note>}</>,reveal(`w${number}`));
    }
    if (number === "10") return grammar(number, "1. A/V-(으)면", "表示“如果……的话”的条件或假设。", ["无收音或ㄹ收音：-면", "有收音：-으면"], [["날씨가 좋으면 바다에 가요.","天气好就去海边。"],["시간이 있으면 여행을 가고 싶어요.","有时间的话想去旅行。"],["표가 싸면 부산에도 갈 거예요.","票便宜的话也打算去釜山。"],["길이 멀면 비행기를 타요.","路远的话坐飞机。"],["비가 오면 박물관을 구경해요.","下雨的话就参观博物馆。"],["숙소가 좋으면 이틀 더 머물 거예요.","住处好的话打算多住两天。"]], "ㄹ收音不脱落：길다→길면、멀다→멀면。条件从句通常放在结果之前。");
    if (number === "11") return grammar(number, "2. V-는 N", "把现在正在发生或经常发生的动作放到名词前。", ["所有动词词干基本都加-는", "ㄹ收音脱落后加-는"], [["제가 좋아하는 여행지는 제주도예요.","我喜欢的旅行地是济州岛。"],["지금 읽는 책은 여행 책이에요.","现在读的是旅行书。"],["부산으로 가는 기차예요.","这是开往釜山的火车。"],["친구가 만드는 계획이 좋아요.","朋友制定的计划很好。"],["사람들이 많이 찾는 해변이에요.","这是人们常去的海滩。"],["제가 머무는 숙소는 역 근처예요.","我住的住处在车站附近。"]], "这是动词定语，不要与第14课形容词定语混用：좋아하는 곳✓，좋은 곳✓，좋는 곳×。");
    if (number === "12") return grammar(number, "3. V-고 싶다", "表达自己的愿望，或在疑问句中询问对方愿望。", ["动词词干直接加-고 싶어요", "第一人称陈述／第二人称疑问"], [["저는 제주도에 가고 싶어요.","我想去济州岛。"],["바다에서 수영하고 싶어요.","我想在海里游泳。"],["어디에서 쉬고 싶어요?","你想在哪里休息？"],["무슨 사진을 찍고 싶어요?","你想拍什么照片？"],["경주에서 한복을 입어 보고 싶어요.","我想在庆州试穿韩服。"],["여행 중에 어떤 음식을 맛보고 싶어요?","旅行中想品尝什么食物？"]], "第三人称不能直接断定其内心；描述他人观察到的愿望时使用-고 싶어 하다。");
    if (number === "13") return grammar(number, "4. V-고 싶어 하다", "客观描述第三人称表现出来的愿望。", ["动词词干+-고 싶어 해요", "主语通常用은/는或이/가"], [["민수 씨는 한국에 가고 싶어 해요.","民秀想去韩国。"],["동생이 사진을 찍고 싶어 해요.","弟弟/妹妹想拍照。"],["부모님은 산에서 쉬고 싶어 하세요.","父母想在山里休息。"],["친구들이 제주도를 구경하고 싶어 해요.","朋友们想逛济州岛。"],["지수 씨는 섬에서 오래 머물고 싶어 해요.","智秀想在岛上多住一段时间。"],["아이들은 바다에서 놀고 싶어 해요.","孩子们想在海边玩。"]], "敬语主体可说-고 싶어 하세요。不要把“第三人称绝对不能用-고 싶어요”机械化；转述、小说内心视角等语境可能不同，本课先掌握日常客观表达。");
    if (["15","16","17"].includes(number)) {
      const data: Record<string,[string,string,Array<[string,string]>]> = {
        "15":["条件句变形训练","先判断有没有收音，再完成条件形式。",[["가다 + 면","가면"],["먹다 + 으면","먹으면"],["길다 + 면","길면"],["좋다 + 으면","좋으면"],["춥다 + 으면","추우면"],["듣다 + 으면","들으면"],["있다 + 으면","있으면"],["바쁘다 + 면","바쁘면"],["멀다 + 면","멀면"],["돕다 + 으면","도우면"]]],
        "16":["动词定语训练","把动作变成修饰后面名词的定语。",[["좋아하다 + 여행지","좋아하는 여행지"],["가다 + 기차","가는 기차"],["읽다 + 책","읽는 책"],["만들다 + 계획","만드는 계획"],["찍다 + 사진","찍는 사진"],["먹다 + 음식","먹는 음식"],["살다 + 도시","사는 도시"],["듣다 + 음악","듣는 음악"],["머물다 + 숙소","머무는 숙소"],["찾다 + 장소","찾는 장소"]]],
        "17":["人物愿望选择","根据主语选择-고 싶다或-고 싶어 하다。",[["저 + 제주도","저는 제주도에 가고 싶어요."],["어디 + 당신","어디에 가고 싶어요?"],["민수 + 부산","민수 씨는 부산에 가고 싶어 해요."],["동생 + 수영","동생은 수영하고 싶어 해요."],["부모님 + 휴식","부모님은 쉬고 싶어 하세요."],["우리 + 여행","우리는 여행을 가고 싶어요."],["친구들 + 구경","친구들은 구경하고 싶어 해요."],["저 + 사진","저는 사진을 찍고 싶어요."],["선생님 + 경주","선생님은 경주에 가고 싶어 하세요."],["무엇 + 당신","무엇을 하고 싶어요?"]]],
      }; const [title,desc,items]=data[number]; return section(number,title,desc,<NotebookPen aria-hidden="true" size={22}/>,<Cards items={items} show={Boolean(revealed[`p${number}`])}/>,reveal(`p${number}`,true));
    }
    if (["19","20","21"].includes(number)) { const d=dialogues[Number(number)-19]; return section(number,d.title,d.description,<MessageCircle aria-hidden="true" size={22}/>,<Dialogue lines={d.lines} speak={speak} show={Boolean(revealed[`d${number}`])}/>,reveal(`d${number}`)); }
    if (number === "23") return section(number,"1. 听力 · 两个人的旅行计划","播放对话后记录人物、条件、目的地、活动和交通方式。",<Headphones aria-hidden="true" size={22}/>,<><button type="button" onClick={()=>speak("수진 씨는 시간이 있으면 제주도에 가고 싶어 해요. 제주도에서 바다를 구경하고 사진을 찍고 싶어 해요. 민수 씨는 부산에 가고 싶어 해요. 표가 싸면 기차를 타고 갈 거예요.")} className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-[var(--destructive)] p-4 text-sm font-bold text-white"><Volume2 aria-hidden="true" size={17}/>播放旅行计划</button><Cards items={[["수진的条件","시간이 있으면"],["수진的目的地","제주도"],["수진的活动","바다 구경·사진 찍기"],["민수的目的地","부산"],["민수的条件","표가 싸면"],["交通方式","기차"],["谁想拍照？","수진 씨"],["谁想去釜山？","민수 씨"]]} show={Boolean(revealed.listen)}/></>,reveal("listen",true));
    if (number === "24") return section(number,"2. 文化漫步 · 韩国代表旅行地","了解旅行地的特色，再用自己的理由作选择。",<Map aria-hidden="true" size={22}/>,<><div className="mt-4 grid grid-cols-2 gap-3"><Note title="제주도 · 济州岛">韩国最大的岛，以火山地貌、海景、柑橘和地方饮食闻名。</Note><Note title="부산 · 釜山">港口城市，海云台等海滨区域是代表性目的地。</Note><Note title="경주 · 庆州">新罗历史文化遗产集中，常被形容为“没有屋顶的博物馆”。</Note><Note title="旅行选择没有标准答案">传统蜜月地包括济州岛；现代旅行者也会按照预算、假期和个人喜好选择国内外目的地。</Note><Note title="推荐表达">바다를 좋아하면 부산을 추천해요.</Note><Note title="历史旅行表达">역사에 관심이 있으면 경주에 가 보세요.</Note></div></>);
    if (number === "25") return section(number,"3. 60秒旅行愿望发表","不看稿介绍自己或朋友的旅行计划。",<Mic2 aria-hidden="true" size={22}/>,<div className="mt-4 grid grid-cols-2 gap-3"><Note title="说自己的愿望">시간이 있으면 ______에 가고 싶어요.<br/>거기에서 ______고 싶어요.<br/>제가 좋아하는 곳은 ______예요.</Note><Note title="说朋友的愿望">제 친구는 ______에 가고 싶어 해요.<br/>______면 같이 갈 거예요.<br/>우리는 ______을/를 준비할 거예요.</Note><Note title="必须包含">条件句1次、V-는 N 1次、第一人称愿望1次、第三人称愿望1次。</Note><Note title="表达顺序">时间 → 条件 → 地点 → 活动 → 同伴 → 交通 → 理由。</Note><Note title="追加问题">언제 출발하고 싶어요?<br/>며칠 동안 머물고 싶어요?</Note><Note title="自然收尾">정말 기대돼요.<br/>즐거운 여행이 되면 좋겠어요.</Note></div>);
    if (number === "27") return section(number,"1. 阅读 · 제주도 여행 계획","找出旅行时间、条件、目的地、活动和不同人物的愿望。",<BookOpenCheck aria-hidden="true" size={22}/>,<><section className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-5"><p className="text-sm font-bold leading-7">이번 여름에 시간이 있으면 친구들과 제주도에 가고 싶어요. 제가 보고 싶은 곳은 성산일출봉이에요. 저는 아름다운 경치를 보고 사진을 찍고 싶어요. 민수 씨는 바다에서 수영하고 싶어 해요. 지수 씨는 조용한 카페에서 쉬고 싶어 해요. 비행기 표가 싸면 다음 주에 바로 예약할 거예요.</p></section><Cards items={[["什么时候？","이번 여름"],["条件1","시간이 있으면"],["“我”想看的地方","성산일출봉"],["民秀的愿望","바다에서 수영하기"],["智秀的愿望","카페에서 쉬기"],["条件2","표가 싸면 예약하기"]]} show={Boolean(revealed.read)}/></>,reveal("read",true));
    if (number === "28") return section(number,"2. 写作 · 我的旅行愿望","写8—10句原创旅行计划，说明条件、目的地、活动与同行人的愿望。",<NotebookPen aria-hidden="true" size={22}/>,<><div className="mt-4 grid grid-cols-2 gap-3"><Note title="内容骨架">时间 → 条件 → 目的地 → 喜欢的景点 → 自己想做的事 → 同伴想做的事 → 交通 → 准备</Note><Note title="语法清单">-(으)면<br/>V-는 N<br/>-고 싶어요<br/>-고 싶어 해요</Note></div><section className="mt-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] p-5"><p className="text-[11px] font-bold text-[var(--destructive)]">原创示范</p><p className="mt-3 text-sm font-bold leading-7">가을에 시간이 있으면 경주에 가고 싶어요. 제가 보고 싶은 곳은 불국사예요. 오래된 건물을 구경하고 사진을 찍고 싶어요. 제 친구는 맛있는 음식을 먹고 싶어 해요. 날씨가 좋으면 자전거도 타고 싶어요. 우리는 기차표와 숙소를 미리 예약할 거예요. 여행 전에 지도를 보고 필요한 것을 준비할 거예요.</p></section><div className="mt-3 grid grid-cols-2 gap-3 text-xs font-bold"><span className="rounded-xl bg-[var(--status-success-surface)] p-3">✓ 시간이 있으면</span><span className="rounded-xl bg-[var(--status-warning-surface)] p-3">✓ 제가 보고 싶은 곳</span><span className="rounded-xl bg-[var(--status-success-surface)] p-3">✓ 가고 싶어요</span><span className="rounded-xl bg-[var(--status-warning-surface)] p-3">✓ 친구는 쉬고 싶어 해요</span></div></>);
    if (["30","31","32","33"].includes(number)) {
      const data: Record<string,[string,string,Array<[string,string]>]> = {
        "30":["1. 旅行词汇检测","看到中文后说出韩语。",[["旅行地","여행지"],["护照","여권"],["票","표"],["风景","경치"],["拍照","사진을 찍다"],["逛、观赏","구경하다"],["预订","예약하다"],["停留","머물다"],["出发","출발하다"],["住处","숙소"]]],
        "31":["2. 四项语法检测","完成最自然的句子。",[["시간이 있다 → 条件","시간이 있으면"],["좋아하다 + 곳","좋아하는 곳"],["我想去","저는 가고 싶어요."],["朋友想去","친구는 가고 싶어 해요."],["만들다 + 계획","만드는 계획"],["길다 → 条件","길면"],["父母想休息","부모님은 쉬고 싶어 하세요."],["你想看什么？","뭘 보고 싶어요?"],["먹다 + 음식","먹는 음식"],["妹妹想拍照","동생은 사진을 찍고 싶어 해요."]]],
        "32":["3. 鼻音化检测","写出实际读音。",[["밥 먹다","[밤 먹따]"],["국물","[궁물]"],["한국말","[한궁말]"],["작년","[장년]"],["십 년","[심 년]"],["입문","[임문]"],["먹는","[멍는]"],["앞문","[암문]"],["닫는","[단는]"],["합니다","[함니다]"]]],
        "33":["4. 易错点诊所","纠正条件、定语和愿望表达。",[["먹면 ×","먹으면 ✓"],["길으면 ×","길면 ✓"],["좋아한 여행지 ×","좋아하는 여행지 ✓"],["만들는 계획 ×","만드는 계획 ✓"],["민수는 가고 싶어요 △","민수는 가고 싶어 해요 ✓"],["저는 가고 싶어 해요 ×","저는 가고 싶어요 ✓"],["밥 먹다 [밥 먹따] ×","[밤 먹따] ✓"],["국물 [국물] ×","[궁물] ✓"],["살는 도시 ×","사는 도시 ✓"],["친구가 쉬고 싶어요 △","친구가 쉬고 싶어 해요 ✓"]]],
      }; const [title,desc,items]=data[number]; return section(number,title,desc,<CheckCircle2 aria-hidden="true" size={22}/>,<Cards items={items} show={Boolean(revealed[`t${number}`])}/>,reveal(`t${number}`,true));
    }
    if (number === "34") return section(number,"5. 口语验收 · 我的理想旅行","根据检查表完成不少于10句的原创发表。",<Mic2 aria-hidden="true" size={22}/>,<><section className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"><div className="grid grid-cols-2 gap-3 text-xs">{["说明旅行时间","提出一个条件","说出目的地","使用V-는 N","表达自己的愿望","描述朋友的愿望","说明交通方式","说出两项活动","解释选择理由","以准备计划结束"].map((task)=><label key={task} className="flex items-center gap-2 rounded-xl bg-white p-3 font-bold"><input type="checkbox" className="accent-[var(--destructive)]"/>{task}</label>)}</div></section><div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-bold"><span className="rounded-xl bg-[var(--accent)] p-3">内容完整 40%</span><span className="rounded-xl bg-[var(--status-success-surface)] p-3">语法正确 40%</span><span className="rounded-xl bg-[var(--status-warning-surface)] p-3">表达自然 20%</span></div><button type="button" onClick={()=>speak("겨울에 시간이 있으면 부산에 가고 싶어요. 제가 좋아하는 여행지는 바다가 있는 곳이에요. 저는 해운대를 구경하고 사진을 찍고 싶어요. 제 친구는 부산 음식을 맛보고 싶어 해요. 표가 싸면 기차를 타고 갈 거예요. 우리는 여행 전에 숙소를 예약하고 지도를 준비할 거예요.")} className="mt-auto flex items-center justify-center gap-2 rounded-2xl bg-[var(--destructive)] p-4 text-sm font-bold text-white"><Volume2 aria-hidden="true" size={16}/>播放原创示范</button></>);
    if (number === "35") return <div className="flex h-full flex-col justify-center"><div className="mx-auto w-full max-w-[440px] text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--card)] text-[var(--destructive)]"><Sparkles aria-hidden="true" size={27}/></span><p className="mt-4 text-xs font-bold tracking-[0.18em] text-[var(--destructive)]">LESSON 15 · COMPLETE</p><h3 className="mt-3 text-4xl font-bold">여행을 가고 싶어요</h3><p className="mt-3 text-lg font-bold">你已经完成第十五课</p><p className="mx-auto mt-3 max-w-[390px] text-sm leading-7 text-[var(--foreground-secondary)]">现在你能设置旅行条件、用动词修饰名词，并正确区分自己、对方与第三人的旅行愿望。</p><div className="mt-4 grid grid-cols-2 gap-3 text-left">{[["01","条件假设","A/V-(으)면"],["02","动词定语","V-는 N"],["03","自己的愿望","V-고 싶다"],["04","他人的愿望","V-고 싶어 하다"]].map(([i,t,d])=><div key={i} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3"><p className="text-[10px] font-bold text-[var(--destructive)]">{i}</p><p className="mt-1 text-xs font-bold">{t}</p><p className="mt-1 text-[10px] text-[var(--foreground-secondary)]">{d}</p></div>)}</div><button type="button" onClick={()=>flipBookRef.current?.pageFlip()?.flip(1)} className="mt-4 rounded-full bg-[var(--card)] px-4 py-3 text-xs font-bold text-[var(--destructive)]">返回目录</button></div></div>;
    return null;
  }

  const pages = Array.from({ length: 35 }, (_, index) => { const number = String(index + 1).padStart(2, "0"); return <Page key={`15-${number}`} number={number}>{renderPage(number)}</Page>; });
  return <section ref={containerRef} className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden [&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-[var(--ring)] [&_button:focus-visible]:ring-offset-2 [&_input:focus-visible]:outline-none [&_input:focus-visible]:ring-2 [&_input:focus-visible]:ring-[var(--ring)] [&_input:focus-visible]:ring-offset-2"><div className="relative shrink-0" style={{ width: BOOK_WIDTH * scale, height: BOOK_HEIGHT * scale }}><button type="button" onClick={()=>flipBookRef.current?.pageFlip()?.flipPrev()} aria-label="上一页" className="absolute -left-14 top-1/2 z-20 -translate-y-1/2 rounded-full border border-[var(--border)] bg-white p-3 text-[var(--destructive)] shadow-lg"><ArrowLeft aria-hidden="true" size={18}/></button><button type="button" onClick={()=>flipBookRef.current?.pageFlip()?.flipNext()} aria-label="下一页" className="absolute -right-14 top-1/2 z-20 -translate-y-1/2 rounded-full border border-[var(--border)] bg-white p-3 text-[var(--destructive)] shadow-lg"><ArrowRight aria-hidden="true" size={18}/></button><div className="absolute left-0 top-0 h-[822px] w-[1180px] origin-top-left" style={{ transform: `scale(${scale})` }}><HTMLFlipBook ref={flipBookRef} width={590} height={822} startPage={initialPage} size="fixed" minWidth={590} maxWidth={590} minHeight={822} maxHeight={822} drawShadow maxShadowOpacity={0.32} flippingTime={650} usePortrait startZIndex={0} autoSize={false} showCover={false} mobileScrollSupport swipeDistance={24} clickEventForward useMouseEvents={true} showPageCorners={false} disableFlipByClick onFlip={(event)=>onPageChange?.(event.data)} className="h-[822px] w-[1180px]" style={{}}><Page number="封面" cover><KoreanEbookCover lesson={lesson}/></Page>{pages}</HTMLFlipBook></div></div></section>;
}
