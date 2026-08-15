"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Lock } from "lucide-react";

const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false });

type PageProps = {
  children: React.ReactNode;
  cover?: boolean;
  fullBleed?: boolean;
  goals?: boolean;
  header?: string;
  number: string | number;
};
type FlipBookHandle = {
  pageFlip: () => { flip: (page: number) => void; flipNext: () => void; flipPrev: () => void; update: () => void } | undefined;
};
type BookPage = {
  number: string;
  section: string;
  title: string;
  lead: string;
  focus: string;
  points: readonly string[];
  chineseExample: string;
};

const BOOK_WIDTH = 1180;
const BOOK_HEIGHT = 822;
const MAX_BOOK_SCALE = 680 / 570;

// 当前先使用本地页面数据；之后可直接由 /api/... 返回的 pages 替换。
const BOOK_PAGES: readonly BookPage[] = [
  {
    number: "02",
    section: "1.1 什么是韩文（谚文）",
    title: "韩文，是一套为让语言变得简单而造的文字",
    lead: "韩文又称谚文（한글，Hangul），是现代韩语使用的字母体系。它不是汉字的变体，而是一套能把声音清楚写出来的拼音文字。",
    focus: "关键词：声音 · 字母 · 组合",
    points: ["每个字母都有固定的发音线索", "字母不会横向堆叠，而是组合成音节方块", "看懂结构后，就能自己拼读新词"],
    chineseExample: "可以把韩文理解成汉语拼音：拼音用声母和韵母记录“ma”的声音；韩文则用辅音和元音组成“가”这样的音节方块。",
  },

  {
    number: "03",
    section: "1.1 什么是韩文（谚文）",
    title: "从《训民正音》开始",
    lead: "15 世纪，朝鲜世宗希望普通人也能轻松记录自己的语言，于是创制了这套易学、规则清楚的文字。它最初被称为《训民正音》，意思是“教导百姓正确发音”。",
    focus: "学习韩文，不必先背大量词汇；先理解发音规则。",
    points: ["设计目标：容易学、容易写、容易读", "字形与发音动作有关，不是任意符号", "今天的韩文保留了这套“从声音出发”的思路"],
    chineseExample: "中文里“人”字的字形能让人联想到站立的人；韩文也有类似设计，不过它更进一步把发音时的嘴、舌、喉咙动作放进字形里。",
  },

  {
    number: "04",
    section: "1.1 什么是韩文（谚文）",
    title: "先把韩文当作“声音积木”",
    lead: "学习时，不要把 가、나、다 当成孤立图形。它们都是由辅音和元音拼出的声音积木：先找到零件，再看它们怎样放进一个方块。",
    focus: "ㄱ + ㅏ → 가    ㄴ + ㅏ → 나",
    points: ["辅音像音节的起点", "元音决定声音与摆放方向", "一个完整方块通常就是一个音节"],
    chineseExample: "像拼“妈”：先有声母 m，再接韵母 a，读成 ma。韩文的不同之处是把这两个声音零件装进同一个方块，而不是横向写开。",
  },

  {
    number: "05",
    section: "1.2 字母的结构：象形与发音原理",
    title: "韩文字母为什么长成这样？",
    lead: "韩文的设计有两条主线：元音借用天地自然的观念；辅音模仿发音时口腔与喉咙的形状。字形本身就是一张发音提示图。",
    focus: "元音：天地人    辅音：发音器官",
    points: ["先看字形，再想象发音动作", "理解来源比死记字母更牢固", "字母的方向会提示拼写位置"],
    chineseExample: "中国传统思想也常用“天、地、人”理解世界；韩文把这个熟悉的观念直接变成元音的基本笔画，因此记字母时可以先记住这三个形象。",
  },

  {
    number: "06",
    section: "1.2 字母的结构：元音",
    title: "元音取法天地自然：天地人",
    lead: "元音的基本笔画来自三个象征：圆点代表天（·），横线代表地（ㅡ），竖线代表人（ㅣ）。由它们的组合与方向，形成不同的元音。",
    focus: "· 天    ㅡ 地    ㅣ 人",
    points: ["ㅏ、ㅓ：在竖线两侧加点，提示开口方向", "ㅗ、ㅜ：在横线上下加点，提示声音位置", "ㅣ 是许多复合元音的基础"],
    chineseExample: "可用中文的“天、地、人”来背：点像天上的太阳，横线像地平线，竖线像站立的人。先记三个基本形，再看点落在左、右、上、下。",
  },

  {
    number: "07",
    section: "1.2 字母的结构：辅音",
    title: "辅音模仿人体发音器官",
    lead: "基础辅音并非随意绘制。它们模仿舌头、牙齿、嘴唇和喉咙在发音时的形状，因此能帮助你记住声音从哪里、怎样发出来。",
    focus: "ㄱ 舌根    ㄴ 舌尖    ㅁ 双唇    ㅇ 喉咙",
    points: ["ㄱ：舌根抬起时的轮廓", "ㄴ：舌尖贴近上齿龈的形状", "ㅁ：双唇合拢；ㅇ：喉咙的开口"],
    chineseExample: "念中文“妈”的 m 时，双唇会先合拢；韩文 ㅁ 就在提醒你这个动作。念“哥”的 g/k 时，舌根会抬起，对应韩文 ㄱ。",
  },

  {
    number: "08",
    section: "1.3 韩语字如何拼成？",
    title: "韩语不是横着排字母",
    lead: "韩语字母会被装进一个方形的音节格。一个格子里至少有一个辅音和一个元音；读的时候，整个方块就是一个完整音节。",
    focus: "ㄱ + ㅏ → 가    ㅁ + ㅜ → 무",
    points: ["先确定开头的辅音", "再看元音是竖向还是横向", "最后把它们排成紧凑的方块"],
    chineseExample: "中文一个字通常占一个方格，例如“你”“好”。韩文看起来也像方块字，但每一个方块是由几个字母拼成的，例如 가 由 ㄱ 和 ㅏ 组成。",
  },

  {
    number: "09",
    section: "1.3 韩语字如何拼成？",
    title: "右边放，还是下边放？",
    lead: "元音的方向决定字母布局。竖向元音放在辅音右边；横向元音放在辅音下边。这个规则让每个音节方块既整齐又容易辨认。",
    focus: "竖向：ㄱ + ㅏ → 가    横向：ㄱ + ㅗ → 고",
    points: ["ㅏ、ㅓ、ㅣ 等竖向元音：左右组合", "ㅗ、ㅜ、ㅡ 等横向元音：上下组合", "先判断元音方向，再开始拼写"],
    chineseExample: "可以把音节格想成一个小田字格：元音是竖向的，就把空间分成左右；元音是横向的，就把空间分成上下。先看方向，就不会摆错位置。",
  },

  {
    number: "10",
    section: "1.3 韩语字如何拼成？",
    title: "有收音时，把它放在方块底部",
    lead: "有些音节会在辅音和元音后再加一个辅音，叫作收音。它仍属于同一个方块，只是安放在底部；读音也会在这里轻轻收住。",
    focus: "ㅎ + ㅏ + ㄴ → 한    ㅂ + ㅏ + ㄴ → 반",
    points: ["上方先完成辅音与元音的组合", "最后把收音放在音节格下方", "从 가 → 한，逐步掌握完整结构"],
    chineseExample: "可把收音理解成普通话拼音末尾的 n 或 ng：读“安”“帮”时，声音会在最后收住。韩文把这个收尾的辅音放进方块底部。",
  },

] as const;

const Page = forwardRef<HTMLDivElement, PageProps>(function Page(
  { children, cover = false, fullBleed = false, goals = false, header, number },
  ref
) {
  return (
    <div ref={ref} className={`h-full overflow-hidden text-[#294f43] shadow-[inset_0_0_28px_rgba(57,78,67,0.08)] ${
      goals ? "bg-[linear-gradient(145deg,#edf8f3_0%,#e4f3ed_100%)]" : "bg-[#fffef9]"
    }`}>
      {cover || fullBleed ? children : (
        <div className="flex h-full flex-col px-9 py-8">
          <div className={`flex items-center justify-between border-b pb-3 text-[11px] font-black tracking-[0.12em] ${
            goals ? "border-[#bedbce]" : "border-[#dce8e1]"
          }`}>
            <span className="text-[#238777]">{header}</span>
            <span className="text-[#789087]">第一章 · 认识韩语字母</span>
          </div>
          <div className="min-h-0 flex-1 pt-5">{children}</div>
          <div className={`mt-4 flex items-center justify-between border-t pt-3 text-[11px] font-bold text-[#92a099] ${
            goals ? "border-[#bedbce]" : "border-[#e4ebe7]"
          }`}>
            <span>互动电子书</span>
            <span>{number}</span>
          </div>
        </div>
      )}
    </div>
  );
});

type IntroBookPage = BookPage;

function IntroLessonPage({ page, index, onSpeak }: { page: IntroBookPage; index: number; onSpeak: (text: string) => void }) {
  const heading = null;

  if (index === 0) {
    return (
      <div className="flex h-full flex-col">
        {heading}

        {/* 👇 顶部间距 mt-4，网格列间距 gap-5 */}
        <div className="mt-5 grid grid-cols-[1.35fr_.65fr] gap-5">

          <div>
            {/* 标题 */}
            <h2 className="text-3xl font-black leading-tight text-[#294f43]">
              {page.title}
            </h2>
            {/* 👇 标题和正文之间的间距 mt-4 */}
            <p className="mt-3 text-sm leading-7 text-[#60736a]">
              {page.lead}
            </p>
          </div>

          {/* 右侧韩文卡片 */}
          <div className="flex min-h-[100px] flex-col justify-center rounded-[28px] bg-[#173f4a] p-5 text-center text-white">
            <p className="text-5xl font-black">한글</p>

            {/* 👇 韩文和副标题之间的间距 mt-3 */}
            <p className="mt-4 text-xs font-bold text-[#9bcfc0]">声音写成字</p>
          </div>
        </div>

        {/* 👇 三个卡片容器的顶部间距 mt-5，卡片之间间距 gap-3 */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="min-h-[82px] rounded-2xl border border-[#dce8e1] p-3 text-xs leading-5 text-[#526c60]"><b className="text-[#b87131]">01</b><p className="mt-1">{page.points[0]}</p></div>
          <div className="min-h-[82px] rounded-2xl border border-[#dce8e1] p-3 text-xs leading-5 text-[#526c60]"><b className="text-[#b87131]">02</b><p className="mt-1">{page.points[1]}</p></div>
          <div className="min-h-[82px] rounded-2xl border border-[#dce8e1] p-3 text-xs leading-5 text-[#526c60]"><b className="text-[#b87131]">03</b><p className="mt-1">{page.points[2]}</p></div>
        </div>

        {/* 👇 mt-auto 让这个区块自动贴底 */}
        <div className="mt-3 mb-1 min-h-[78px] rounded-2xl bg-[#fff4e7] p-5 text-sm leading-7 text-[#765c49]">
          <b className="text-[#b87131]">中文类比：</b>
          {page.chineseExample}
        </div>

        {/* 用拼音和韩文音节方块的结构做视觉对比，方便一眼理解「组合成声音」。 */}
        <div className="mt-1 mb-1 p-1 text-[#765c49]">
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="min-h-[102px] rounded-xl bg-white p-3 text-center shadow-sm ring-1 ring-[#f2e5d6]">
              <p className="text-[10px] font-bold tracking-[0.12em] text-[#a27b5b]">中文拼音</p>
              <div className="mt-2 flex items-center justify-center gap-1 text-lg font-black">
                <span className="rounded-md bg-[#fff0df] px-2 py-1 text-[#bd7228]">m</span>
                <span className="text-[#b8a18e]">+</span>
                <span className="rounded-md bg-[#fff0df] px-2 py-1 text-[#bd7228]">a</span>
                <span className="text-[#b8a18e]">=</span>
                <span className="text-[#294f43]">ma</span>
              </div>
              <p className="mt-2 text-[10px] text-[#8c7561]">声母 + 韵母，横向拼读</p>
            </div>

            <span className="text-xl font-black text-[#d29a58]">→</span>

            <div className="min-h-[102px] rounded-xl bg-[#e8f5f0] p-3 text-center ring-1 ring-[#cbe7dc]">
              <p className="text-[10px] font-bold tracking-[0.12em] text-[#238777]">韩文音节方块</p>
              <div className="mt-2 flex items-center justify-center gap-1 text-lg font-black">
                <span className="rounded-md bg-white px-2 py-1 text-[#238777]">ㄱ</span>
                <span className="text-[#72ae9e]">+</span>
                <span className="rounded-md bg-white px-2 py-1 text-[#238777]">ㅏ</span>
                <span className="text-[#72ae9e]">=</span>
                <span className="rounded-md bg-[#238777] px-2 py-1 text-white">가</span>
              </div>
              <p className="mt-2 text-[10px] text-[#568576]">辅音 + 元音，装进一格</p>
            </div>
          </div>
        </div>

        {/* 第一页专用：点播卡片直接放在本页阅读区内，颜色、间距、大小都在这里调整。 */}
        <section className="mt-7 min-h-[100px]  px-4 py-3">
          <p className="text-xs font-black text-[#c58b2a]">点击听韩语</p>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {[
              { text: "가", phonetic: "[가]" },
              { text: "나", phonetic: "[나]" },
              { text: "마", phonetic: "[마]" },
              { text: "한글", phonetic: "[한글]" },
              { text: "오다", phonetic: "[오다]" },
            ].map((word) => (
              <button
                key={word.text}
                type="button"
                onClick={() => onSpeak(word.text)}
                title={`播放 ${word.text}`}
                className="group relative min-h-[48px] rounded-lg bg-white px-2 py-1 text-center shadow-sm ring-1 ring-[#dce8e1] transition hover:!bg-[#238777] hover:!text-white hover:!ring-[#238777]"
              >
                <span className="absolute right-1.5 top-1 text-[10px] text-[#238777] transition group-hover:!text-white">🔊</span>
                <span className="block text-lg font-black text-[#173f4a] transition group-hover:!text-white">{word.text}</span>
                <span className="mt-0.5 block text-[10px] font-bold text-[#71857b] transition group-hover:!text-white/80">{word.phonetic}</span>
              </button>
            ))}
          </div>
        </section>

      </div>


    );
  }




  if (index === 1) return (
    <div className="flex h-full flex-col">
      {/* ===== 顶部：章节标题与主题印章 ===== */}
      <div className="mt-4 flex items-start justify-between gap-5">
        <div>
          <h2 className="mt-2 text-3xl font-black leading-tight text-[#3c332e]">{page.title}</h2>
        </div>

        {/* 右上角韩文主题标记 */}
        <div className="rounded-full bg-[#f5b700] px-4 py-3 text-center text-white">
          <p className="text-2xl font-black">훈민</p>
          <p className="text-2xl font-black">정음</p>
        </div>
      </div>

      {/* 标题下方的导读文字 */}
      <p className="mt-3 text-sm leading-7 text-[#6d655f]">{page.lead}</p>

      {/* ===== 中部：韩文创制时间线 ===== */}
      <div className="mt-5">
        <p className="text-xs font-black text-[#c58b2a]">一条时间线，读懂它为何诞生</p>

        {/* 三张并列时间卡：年份 → 图标 → 标题 → 说明 */}
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="min-h-[174px] rounded-[26px] bg-[#f1eeea] p-4 text-center">
            <p className="text-lg font-black text-[#3c332e]">1443</p>
            <span className="mt-2 block text-3xl">📜</span>
            <p className="mt-2 font-black text-[#3c332e]">开始创制</p>
            <p className="mt-2 text-xs leading-5 text-[#5f5751]">世宗启动新文字的创制。</p>
          </div>

          <div className="min-h-[174px] rounded-[26px] bg-[#f1eeea] p-4 text-center">
            <p className="text-lg font-black text-[#3c332e]">1446</p>
            <span className="mt-2 block text-3xl">📄</span>
            <p className="mt-2 font-black text-[#3c332e]">正式颁布</p>
            <p className="mt-2 text-xs leading-5 text-[#5f5751]">《训民正音》说明字母的发音原理。</p>
          </div>

          <div className="min-h-[174px] rounded-[26px] bg-[#f1eeea] p-4 text-center">
            <p className="text-lg font-black text-[#3c332e]">今天</p>
            <span className="mt-2 block text-3xl">📚</span>
            <p className="mt-2 font-black text-[#3c332e]">持续使用</p>
            <p className="mt-2 text-xs leading-5 text-[#5f5751]">它仍以规则清楚、容易学习而闻名。</p>
          </div>
        </div>
      </div>

      {/* ===== 底部：学习重点与中文类比 ===== */}
      <div className="mt-6 grid grid-cols-[.5fr_1.5fr] items-stretch gap-">
        <div className="flex min-h-[92px] flex-col justify-center rounded-2xl bg-[#3c332e] p-4 text-center text-white">
          <p className="text-xs font-bold text-[#f4c66d]">核心愿望</p>
          <p className="mt-2 text-lg font-black">简单，人人能读写</p>
        </div>

        <div className="min-h-[92px] rounded-2xl border border-[#e5dfd9] bg-[#faf9f7] p-4 text-xs leading-6 text-[#5f5751]">
          <b className="text-[#c58b2a]">中文类比：</b>
          中文的“人”字用字形帮助记忆；韩文更进一步，把<strong className="font-black text-[#3c332e]">发音动作</strong>做进字母设计，让<strong className="font-black text-[#3c332e]">普通人也能读写</strong>。
        </div>
      </div>
      {/* ===== 点播区：本页历史主题词 ===== */}
      <section className="mt-11">
        <p className="text-xs font-black text-[#c58b2a]">点击听韩语</p>

        {/* 单词按钮：点击后调用 onSpeak 播放韩语发音 */}
        <div className="mt-3 grid grid-cols-4 gap-3">
          {[
            { text: "훈민정음", phonetic: "[훈ː민정음]" },
            { text: "세종", phonetic: "[세ː종]" },
            { text: "백성", phonetic: "[백썽]" },
            { text: "글자", phonetic: "[글짜]" },
          ].map((word) => (
            <button
              key={word.text}
              type="button"
              onClick={() => onSpeak(word.text)}
              title={`播放 ${word.text}`}
              className="group relative min-h-[54px] rounded-lg border border-[#e5dfd9] bg-white px-2 py-1 text-center transition hover:!border-[#3c332e] hover:!bg-[#3c332e] hover:!text-white"
            >
              <span className="absolute right-1.5 top-1 text-[10px] text-[#c58b2a] transition group-hover:!text-[#f4c66d]">🔊</span>
              <span className="block text-lg font-black text-[#3c332e] transition group-hover:!text-white">{word.text}</span>
              <span className="mt-0.5 block text-[10px] font-bold text-[#837a73] transition group-hover:!text-white/80">{word.phonetic}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );

  if (index === 2) return (
    <div className="flex h-full flex-col">


      {/* ===== 声音积木公式：深青蓝是本页主视觉色 ===== */}
      <div className="mt-5 rounded-[30px] bg-[#2897a8] px-8 py-6 text-center text-white shadow-[0_10px_24px_rgba(23,103,123,0.16)] h-26 flex flex-col items-center justify-center ">
        <p className="text-xs font-bold text-[#bfe2e9]">声音积木</p>
        <p className="mt-3 text-4xl font-black tracking-[0.08em]">ㄱ ＋ ㅏ ＝ 가</p>
      </div>

      {/* ===== 标题与导读 ===== */}
      <h2 className="mt-5 text-2xl font-black text-[#233b48]">先把韩文当作“声音积木”</h2>
      <p className="mt-3 text-sm leading- text-[#52636d]">学习时，不要把 가、나、다 当成孤立图形。它们都是由辅音和元音拼出的声音积木：先找到零件，再看它们怎样放进一个方块。</p>

      {/* 三个基础规则：保持白底，避免与下方三种结构争夺颜色 */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          "辅音像音节的起点",
          "元音决定声音与摆放方向",
          "一个完整方块是一个音节",
        ].map((point, i) => (
          <div key={point} className="rounded-2xl border border-[#d7e0e1] bg-white p-3 text-center text-xs leading-5 text-[#52636d]">
            <span className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-[#17677b] text-xs font-black text-white">{i + 1}</span>
            <p className="mt-2">{point}</p>
          </div>
        ))}
      </div>

      {/* 中文类比：只使用柔和琥珀，作为说明而非主色 */}
      <div className="mt-4 rounded-2xl bg-[#fff1dc] px-5 py-3 text-xs leading-6 text-[#765b45]">
        <span className="mr-1 text-base">💡</span>
        <b>像拼“妈”：</b>先有声母 m，再接韵母 a，读成 ma。韩文则把<strong>辅音和元音</strong>装进同一方块
      </div>

      {/* ===== 三种音节结构：蓝＝左右、绿＝上下、砖红＝带收音 ===== */}

      <p className="mt-8 text-2xl font-black text-[#233b48]">三种核心积木拼装结构</p>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <div className="rounded-[22px] bg-[#d9eef5] p-3 text-center text-[#254f5d] flex flex-col">
          <p className="font-black">【左右结构】</p><span className="mt-1 block text-xl">💡</span>
          <p className="mt-1 text-2xl font-black">ㄱㅏ</p><p className="mt-1 text-sm font-black">가 (ga)　나 (na)</p>
          <p className="mt-9 text-xs leading-5">左右结构：左ㄱ、右ㅏ，适合竖向元音。</p>
        </div>
        <div className="rounded-[22px] bg-[#dfead7] p-3 text-center text-[#405b3f]">
          <p className="font-black">【上下结构】</p><span className="mt-1 block text-xl">☘️</span>
          <p className="mt-1 text-2xl font-black">ㄱ<br />ㅗ</p><p className="mt-1 text-sm font-black">고 (go)　누 (nu)</p>
          <p className="mt-2 text-xs leading-5">上下结构：ㄱ－ㅗ，适合横向元音。</p>
        </div>
        <div className="rounded-[22px] bg-[#f0d9d5] p-3 text-center text-[#6f3f3d]">
          <p className="font-black">【带收音结构】</p><span className="mt-1 block text-xl">✦</span>
          <p className="mt-1 text-2xl font-black">ㄱㅏ<br />　ㄴ</p><p className="mt-1 text-sm font-black">강 (gang)　눈 (nun)</p>
          <p className="mt-2 text-xs leading-5">带收音结构：下方再加辅音收尾。</p>
        </div>
      </div>
    </div>
  );


  if (index === 2) return (
    <div className="flex h-full flex-col">   {/* 父容器：flex列布局 */}
      {heading}

      {/* ===== 第一行：声音积木卡片 ===== */}
      {/* 👇 与 heading 的间距：mt-4（1rem / 16px） */}
      <div className="mt-4 rounded-[28px] bg-[#e9f6f1] p-6 text-center">
        <p className="text-xs font-black text-[#238777]">声音积木</p>
        {/* 👇 标签与公式之间的间距：mt-3（0.75rem / 12px） */}
        <p className="mt-3 text-4xl font-black text-[#173f4a]">ㄱ ＋ ㅏ ＝ 가</p>
      </div>

      {/* ===== 第二行：标题 ===== */}
      {/* 👇 与上方卡片的间距：mt-5（1.25rem / 20px） */}
      <h2 className="mt-5 text-2xl font-black text-[#294f43]">
        {page.title}
      </h2>

      {/* ===== 第三行：正文 ===== */}
      {/* 👇 与标题的间距：mt-3（0.75rem / 12px） */}
      <p className="mt-3 text-sm leading-7 text-[#60736a]">
        {page.lead}
      </p>

      {/* ===== 第四行：三个要点卡片 ===== */}
      {/* 👇 容器与上方正文的间距：mt-5（1.25rem / 20px） */}
      {/* 👇 三个卡片之间的水平间距：gap-3（0.75rem / 12px） */}
      <div className="mt-5 flex items-stretch gap-3">
        {page.points.map((point, i) => (
          <div key={point} className="flex-1 rounded-2xl bg-[#fbfdfa] p-4 text-center ring-1 ring-[#dce8e1]">
            {/* 编号圆圈 */}
            <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-[#238777] text-xs font-black text-white">
              {i + 1}
            </span>
            {/* 👇 编号与文字之间的间距：mt-3（0.75rem / 12px） */}
            <p className="mt-3 text-xs leading-5 text-[#526c60]">
              {point}
            </p>
          </div>
        ))}
      </div>

      {/* ===== 第五行：中文类比 ===== */}
      {/* 👇 mt-auto：自动推到底部（flex容器的底部对齐） */}
      {/* 👇 内边距：p-4（1rem / 16px） */}
      <p className="mt-auto rounded-xl bg-[#fff4e7] p-4 text-xs leading-6 text-[#765c49]">
        {page.chineseExample}
      </p>
    </div>
  );

  if (index === 3) return (
    <div className="flex h-full flex-col">
      {/* ===== 顶部：标题、导读；章节名已由电子书页眉统一显示 ===== */}
      <h2 className="mt-4 text-2xl font-black text-[#274d47]">{page.title}</h2>
      <p className="mt-3 text-sm leading-7 text-[#5d7069]">{page.lead}</p>

      {/* ===== 中部：元音与辅音两张主题卡 ===== */}
      <div className="mt-5 grid grid-cols-[.96fr_1.04fr] items-stretch gap-4">
        {/* 左卡：以青绿色表现自然、安静的天地人概念 */}
        <div className="flex min-h-[250px] flex-col rounded-[26px] bg-[#dff3ed] p-5 text-[#245d55] shadow-[0_8px_20px_rgba(38,112,100,0.08)]">
          <p className="text-xs font-black">元音 · 天地自然</p>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <div><p className="text-4xl font-black">·</p><span className="mt-3 block text-2xl">🌤️</span><p className="mt-2 text-xs font-bold">天 (tiān)</p></div>
            <div><p className="text-4xl font-black">ㅡ</p><span className="mt-3 block text-2xl">🌄</span><p className="mt-2 text-xs font-bold">地 (dì)</p></div>
            <div><p className="text-4xl font-black">ㅣ</p><span className="mt-3 block text-2xl">🧍</span><p className="mt-2 text-xs font-bold">人 (rén)</p></div>
          </div>
          <p className="mt-auto border-t border-[#b9ddd3] pt-4 text-xs leading-6">从天、地、人三个形象出发，组合出元音。</p>
        </div>

        {/* 右卡：暖沙色表现口腔与发音器官 */}
        <div className="flex min-h-[250px] flex-col rounded-[26px] bg-[#fff0dc] p-5 text-[#785337] shadow-[0_8px_20px_rgba(146,91,48,0.08)]">
          <p className="text-xs font-black">辅音 · 发音器官</p>

          {/* 正常侧脸发音插图：保留发音动作，不展示口腔剖面。 */}
          <div className="relative mt-3 overflow-hidden rounded-2xl bg-[#f7ddca]">
            <Image
              src="/images/hangul/pronunciation-side-profile.png"
              alt="人物侧脸发音示意"
              width={1024}
              height={1536}
              className="h-[132px] w-full object-cover object-[62%_44%]"
            />

            {/* 引线教学层：人物是正常侧脸，字母仍对应舌根、舌尖、嘴唇与喉咙的位置。 */}
            <svg viewBox="0 0 280 132" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
              <g fill="none" stroke="#5e4638" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M36 22 H95 L183 76" />
                <path d="M36 50 H103 L158 70" />
                <path d="M36 78 H100 L140 63" />
                <path d="M36 106 H128 L184 105" />
              </g>
              <g fill="#fffaf4" stroke="#7f5944" strokeWidth="1">
                <rect x="8" y="11" width="28" height="22" rx="6" />
                <rect x="8" y="39" width="28" height="22" rx="6" />
                <rect x="8" y="67" width="28" height="22" rx="6" />
                <rect x="8" y="95" width="28" height="22" rx="6" />
              </g>
              <g fill="#3d3028" fontSize="15" fontWeight="800" textAnchor="middle">
                <text x="22" y="27">ㄱ</text>
                <text x="22" y="55">ㄴ</text>
                <text x="22" y="83">ㅁ</text>
                <text x="22" y="111">ㅇ</text>
              </g>
              <g fill="#c77d35" stroke="#fffaf4" strokeWidth="1.5">
                <circle cx="183" cy="76" r="3.5" />
                <circle cx="158" cy="70" r="3.5" />
                <circle cx="140" cy="63" r="3.5" />
                <circle cx="184" cy="105" r="3.5" />
              </g>
            </svg>
          </div>

          {/* 旧版剖面结构已停用，保留在源码中便于后续对比。 */}
          <div className="hidden mt-3 grid grid-cols-[38px_1fr] items-center gap-1 rounded-2xl bg-white/55 px-2 py-1">
            {/* 参考教材案例：只显示字母，连接线负责指出对应器官 */}
            <div className="flex h-[132px] flex-col justify-around text-center text-lg font-black text-[#332d29]">
              <span>ㄱ</span>
              <span>ㄴ</span>
              <span>ㅁ</span>
              <span>ㅇ</span>
            </div>

            <svg viewBox="0 0 205 150" role="img" aria-label="辅音发音器官侧视示意图" className="h-[132px] w-full">
              <defs>
                <linearGradient id="faceSkin" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f4c3a6" />
                  <stop offset="100%" stopColor="#dfa080" />
                </linearGradient>
                <linearGradient id="tongueFill" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f28b87" />
                  <stop offset="100%" stopColor="#cf6467" />
                </linearGradient>
              </defs>

              {/* 面部侧面：朝向左侧，鼻、唇、下巴和颈部轮廓清晰可辨 */}
              <path
                d="M94 7 C139 2 181 19 195 53 C204 74 194 91 181 101 C174 107 174 122 177 144 H105 C108 129 103 118 91 112 C72 103 61 94 57 83 C51 81 47 78 48 73 C50 68 50 65 44 62 L35 58 C46 52 53 47 55 39 C58 24 72 12 94 7Z"
                fill="url(#faceSkin)"
                stroke="#875449"
                strokeWidth="2"
              />

              {/* 鼻腔：位于口腔上方 */}
              <path
                d="M55 46 C78 31 126 32 161 49 C138 46 114 47 91 55 C76 60 63 57 55 46Z"
                fill="#f8d9ca"
                stroke="#a66759"
                strokeWidth="1.5"
              />
              <path d="M62 49 C87 42 119 42 150 49" fill="none" stroke="#b87566" strokeWidth="2" strokeLinecap="round" />

              {/* 硬腭、牙齿和口腔空间 */}
              <path d="M53 62 C81 52 121 53 158 67 C140 66 124 70 113 80 C94 96 68 86 53 75Z" fill="#9f454b" />
              <path d="M54 58 L92 55 L90 65 L56 67Z" fill="#fffdf8" stroke="#8e7065" strokeWidth="1.2" />
              <path d="M91 55 C112 54 137 57 157 66" fill="none" stroke="#6f453f" strokeWidth="4" strokeLinecap="round" />

              {/* 舌头：舌尖在左、舌根在右 */}
              <path
                d="M57 78 C77 68 112 68 137 78 C124 82 120 95 99 99 C79 101 63 92 57 78Z"
                fill="url(#tongueFill)"
                stroke="#874044"
                strokeWidth="1.5"
              />
              <path d="M65 79 C84 74 108 75 124 81" fill="none" stroke="#f8b2aa" strokeWidth="2" strokeLinecap="round" />

              {/* 咽喉与气流通道 */}
              <path d="M157 66 C169 83 164 111 166 143" fill="none" stroke="#6f453f" strokeWidth="7" strokeLinecap="round" />
              <path d="M160 72 C164 91 160 113 162 139" fill="none" stroke="#f4b9a5" strokeWidth="2.5" strokeLinecap="round" />

              {/* 四条发音定位线：舌根、舌尖、闭唇、喉咙 */}
              <g fill="none" stroke="#5f5752" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 20 H38 L126 87" />
                <path d="M2 52 H35 L62 78" />
                <path d="M2 84 H31 L49 73" />
                <path d="M2 116 H97 L164 116" />
              </g>
              <g fill="#c87931" stroke="#fff9f2" strokeWidth="2">
                <circle cx="126" cy="87" r="4.5" />
                <circle cx="62" cy="78" r="4.5" />
                <circle cx="49" cy="73" r="4.5" />
                <circle cx="164" cy="116" r="4.5" />
              </g>
            </svg>
          </div>

          <div className="mt-auto flex items-center justify-between border-t border-[#edd2b4] pt-3">
            <p className="text-2xl font-black tracking-[0.22em]">ㄱ ㄴ ㅁ ㅇ</p>
            <p className="text-[10px] leading-4">形状来自<br />发音动作</p>
          </div>
        </div>
      </div>

      {/* 统一结论条：深青绿用于强调本页结论 */}
      <div className="mt-8 rounded-full bg-[#218b7b] px-5 py-2 text-center text-lg font-black text-white">
        韩文字母为什么长这样？　辅音模仿的是一张发音示意图。</div>

      {/* ===== 底部：中文类比与组合示例 ===== */}
      <div className="mt-8 grid grid-cols-[1.5fr_.9fr] gap-4">
        <div className="border-l-4 border-[#d1923a] pl-4 text-xs leading-6 text-[#675b4f]">
          中国传统思想也常用<strong className="text-[#8b5e28]">“天、地、人”</strong>理解世界；韩文把这个熟悉的观念变成元音的基本笔画。先记住<strong className="text-[#8b5e28]">三个形象</strong>，再看它们怎样组合。
        </div>
        <div className="rounded-[22px] bg-[#e8e4dc] p-4 text-center text-[#5c534b]">
          <p className="text-xs font-black">💡 组合与演示小示例</p>
          <p className="mt-3 text-lg font-black">
            <span className="inline-block rounded-lg bg-[#fed7aa] px-1">ㅣ</span>
            ＋
            <span className="inline-block rounded-lg bg-[#fed7aa] px-1">·</span>
            ＝
            <span className="inline-block rounded-lg bg-[#fed7aa] px-1">ㅏ</span>
          </p>
          <p className="mt-2 text-lg font-black">
            <span className="inline-block rounded-lg bg-[#fed7aa] px-1">ㄱ</span>
            ＋
            <span className="inline-block rounded-lg bg-[#fed7aa] px-1">ㅏ</span>
            ＝
            <span className="inline-block rounded-lg bg-[#fed7aa] px-1">가</span>
          </p>
        </div>
      </div>
    </div>
  );

  if (index === 4) return (
    <div className="flex h-full flex-col text-center">   {/* 父容器：flex列布局，文字居中 */}
      {heading}

      {/* ===== 第一行：标题 ===== */}
      {/* 👇 与 heading 的间距：mt-3（0.75rem / 12px） */}
      <h2 className="mt-3 text-2xl font-black text-[#294f43]">
        {page.title}
      </h2>

      {/* ===== 第二行：天地人三个圆形容器 ===== */}
      {/* 👇 容器与标题的间距：mt-6（1.5rem / 24px） */}
      {/* 👇 水平居中：mx-auto */}
      {/* 👇 三个圆形之间的间距：gap-4（1rem / 16px） */}
      <div className="mx-auto mt-6 grid w-full grid-cols-3 gap-4">

        {/* 天 */}
        <div className="rounded-full bg-[#dff2eb] p-7">
          <p className="text-4xl font-black text-[#238777]">·</p>
          {/* 👇 符号与文字的间距：mt-2（0.5rem / 8px） */}
          <b className="mt-2 block text-sm text-[#294f43]">天</b>
        </div>

        {/* 地 */}
        <div className="rounded-full bg-[#fff0dc] p-7">
          <p className="text-4xl font-black text-[#b87131]">ㅡ</p>
          {/* 👇 符号与文字的间距：mt-2（0.5rem / 8px） */}
          <b className="mt-2 block text-sm text-[#654b35]">地</b>
        </div>

        {/* 人 */}
        <div className="rounded-full bg-[#e8efeb] p-7">
          <p className="text-4xl font-black text-[#60736a]">ㅣ</p>
          {/* 👇 符号与文字的间距：mt-2（0.5rem / 8px） */}
          <b className="mt-2 block text-sm text-[#294f43]">人</b>
        </div>
      </div>

      {/* ===== 第三行：正文 ===== */}
      {/* 👇 与上方圆形容器的间距：mt-5（1.25rem / 20px） */}
      <p className="mt-5 text-sm leading-7 text-[#60736a]">
        {page.lead}
      </p>

      {/* ===== 第四行：元音展示条 ===== */}
      {/* 👇 与上方正文的间距：mt-5（1.25rem / 20px） */}
      {/* 👇 上下内边距：py-4（1rem / 16px） */}
      <div className="mt-5 rounded-2xl border-y border-[#cfe2d9] py-4 text-xl font-black text-[#238777]">
        ㅏ · ㅓ · ㅗ · ㅜ · ㅡ · ㅣ
      </div>

      {/* ===== 补充练习：从三个基本笔画延伸到实际元音 ===== */}
      <div className="mt-5 grid flex-1 grid-cols-2 gap-4">
        <div className="rounded-[24px] bg-[#e9f6f1] p-5 text-left">
          <p className="text-xs font-black text-[#238777]">组合方向提示</p>
          <div className="mt-4 flex items-center justify-around text-center text-[#173f4a]">
            <div><p className="text-3xl font-black">ㅣ + ·</p><p className="mt-2 text-xs">点在右侧 → ㅏ</p></div>
            <span className="text-xl text-[#238777]">→</span>
            <div><p className="text-4xl font-black">ㅏ</p><p className="mt-2 text-xs">右开口</p></div>
          </div>
        </div>
        <div className="rounded-[24px] bg-[#fff4e7] p-5 text-left">
          <p className="text-xs font-black text-[#b87131]">先记住这三件事</p>
          <ol className="mt-3 space-y-2 text-xs leading-5 text-[#765c49]"><li>01 · 点代表天</li><li>02 · 横线代表地</li><li>03 · 竖线代表人</li></ol>
        </div>
      </div>

      {/* ===== 第五行：中文类比 ===== */}
      {/* 👇 mt-auto：自动推到底部（flex容器的底部对齐） */}
      {/* 👇 内边距：p-4（1rem / 16px） */}
      {/* 👇 文字左对齐：text-left（覆盖父容器的 text-center） */}
      <p className="mt-4 rounded-2xl bg-[#fff4e7] p-4 text-left text-xs leading-6 text-[#765c49]">
        {page.chineseExample}
      </p>
    </div>
  );

  if (index === 5) return (
    <div className="flex h-full flex-col">   {/* 父容器：flex列布局 */}
      {heading}

      {/* ===== 第一行：标题 ===== */}
      {/* 👇 与 heading 的间距：mt-3（0.75rem / 12px） */}
      <h2 className="mt-3 text-2xl font-black text-[#294f43]">
        {page.title}
      </h2>

      {/* ===== 第二行：正文 ===== */}
      {/* 👇 与标题的间距：mt-3（0.75rem / 12px） */}
      <p className="mt-3 text-sm leading-7 text-[#60736a]">
        {page.lead}
      </p>

      {/* ===== 第三行：4个辅音卡片（2列网格） ===== */}
      {/* 👇 容器与上方正文的间距：mt-5（1.25rem / 20px） */}
      {/* 👇 网格列数：2列 */}
      {/* 👇 卡片之间的间距：gap-3（0.75rem / 12px） */}
      <div className="mt-5 grid flex-1 grid-cols-2 auto-rows-fr gap-3">
        {[["ㄱ", "舌根抬起", "哥 g/k"],
        ["ㄴ", "舌尖上抬", "你 n"],
        ["ㅁ", "双唇合拢", "妈 m"],
        ["ㅇ", "喉咙开口", "零声母/ng"]].map(([letter, organ, zh]) => (

          <div key={letter} className="flex min-h-[104px] items-center gap-4 rounded-2xl border border-[#dce8e1] bg-[#fbfdfa] p-4">
            {/* 👇 字母与文字信息的间距：gap-4（1rem / 16px） */}

            {/* 韩文字母 */}
            <span className="text-4xl font-black text-[#238777]">{letter}</span>

            {/* 文字信息 */}
            <div>
              <b className="text-sm text-[#294f43]">{organ}</b>
              {/* 👇 器官名称与中文对照的间距：mt-1（0.25rem / 4px） */}
              <p className="mt-1 text-xs text-[#b87131]">中文：{zh}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ===== 第四行：把发音动作和字母真正连起来 ===== */}
      <div className="mt-4 grid grid-cols-[.9fr_1.1fr] gap-3">
        <div className="rounded-2xl bg-[#e9f6f1] p-4 text-center text-[#294f43]">
          <p className="text-xs font-black text-[#238777]">动作连线</p>
          <p className="mt-3 text-lg font-black">双唇合拢　→　ㅁ</p>
          <p className="mt-1 text-xs text-[#60736a]">像念中文“妈”的起音</p>
        </div>
        <div className="rounded-2xl border border-dashed border-[#d9c7ad] bg-[#fffaf3] p-4 text-xs leading-6 text-[#765c49]">
          <b className="text-[#b87131]">试一试：</b>先无声地做“舌根抬起、舌尖上抬、双唇合拢、喉咙打开”四个动作，再分别读出 ㄱ、ㄴ、ㅁ、ㅇ。
        </div>
      </div>

      {/* ===== 第五行：发音实验区块 ===== */}
      <div className="mt-4 rounded-2xl bg-[#173f4a] p-5 text-sm leading-7 text-white">
        <b className="text-[#9bcfc0]">发音实验：</b>
        {page.chineseExample}
      </div>
    </div>
  );

  if (index === 6) return (
    <div className="flex h-full flex-col">   {/* 父容器：flex列布局 */}
      {heading}

      {/* ===== 第一行：标题 ===== */}
      {/* 👇 与 heading 的间距：mt-3（0.75rem / 12px） */}
      <h2 className="mt-3 text-2xl font-black text-[#294f43]">
        {page.title}
      </h2>

      {/* ===== 第二行：拼写公式（ㄱ + ㅏ = 가） ===== */}
      {/* 👇 容器与标题的间距：mt-6（1.5rem / 24px） */}
      {/* 👇 水平居中：justify-center */}
      {/* 👇 元素之间的间距：gap-3（0.75rem / 12px） */}
      <div className="mt-6 flex items-center justify-center gap-3">

        {/* ㄱ */}
        <span className="rounded-2xl bg-[#e9f6f1] p-6 text-5xl font-black text-[#238777]">
          ㄱ
        </span>

        {/* ＋ */}
        <span className="text-2xl font-black text-[#83948b]">
          ＋
        </span>

        {/* ㅏ */}
        <span className="rounded-2xl bg-[#fff4e7] p-6 text-5xl font-black text-[#b87131]">
          ㅏ
        </span>

        {/* ＝ */}
        <span className="text-2xl font-black text-[#83948b]">
          ＝
        </span>

        {/* 가 */}
        <span className="rounded-2xl bg-[#173f4a] p-6 text-5xl font-black text-white">
          가
        </span>
      </div>

      {/* ===== 第三行：正文 ===== */}
      {/* 👇 与上方公式的间距：mt-6（1.5rem / 24px） */}
      <p className="mt-6 text-sm leading-7 text-[#60736a]">
        {page.lead}
      </p>

      {/* ===== 第四行：三个步骤卡片 ===== */}
      {/* 👇 容器与上方正文的间距：mt-5（1.25rem / 20px） */}
      {/* 👇 三个卡片之间的间距：gap-3（0.75rem / 12px） */}
      <div className="mt-5 grid flex-1 grid-cols-3 gap-3 text-center">
        {page.points.map((point, i) => (
          <div key={point} className="flex min-h-[112px] flex-col justify-center rounded-xl bg-[#f3f8f5] p-3 text-xs leading-5 text-[#526c60]">
            <b className="text-[#238777]">步骤 {i + 1}</b>
            {/* 👇 标签与内容的间距：mt-1（0.25rem / 4px） */}
            <p className="mt-1">{point}</p>
          </div>
        ))}
      </div>

      {/* ===== 第五行：拼装练习，换一组字母再做一次 ===== */}
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border border-[#dce8e1] bg-[#fffef9] p-4 text-center">
        <div><p className="text-xs font-black text-[#238777]">先放辅音</p><p className="mt-2 text-3xl font-black text-[#173f4a]">ㄴ</p></div>
        <span className="text-2xl font-black text-[#b87131]">＋</span>
        <div><p className="text-xs font-black text-[#b87131]">再放元音</p><p className="mt-2 text-3xl font-black text-[#654b35]">ㅏ　→　나</p></div>
      </div>

      {/* 连续三个方块：每个方块独立对应一个音节 */}
      <div className="mt-3 rounded-2xl border border-[#cfe2d9] bg-[#e9f6f1] px-5 py-3 text-center text-[#173f4a]">
        <p className="text-xs font-bold text-[#238777]">连续三个音节，也是一格一读</p>
        <p className="mt-2 text-3xl font-black tracking-[0.28em]">가　나　다</p>
        <p className="mt-2 text-xs text-[#b87131]">ga · na · da</p>
      </div>

      {/* ===== 第六行：中文类比 ===== */}
      <p className="mt-4 border-t border-dashed border-[#cfe2d9] pt-4 text-xs leading-6 text-[#765c49]">
        {page.chineseExample}
      </p>
    </div>
  );

  if (index === 7) return (
    <div className="flex h-full flex-col">   {/* 父容器：flex列布局 */}
      {heading}

      {/* ===== 第一行：标题 ===== */}
      {/* 👇 与 heading 的间距：mt-3（0.75rem / 12px） */}
      <h2 className="mt-3 text-2xl font-black text-[#294f43]">
        {page.title}
      </h2>

      {/* ===== 第二行：正文 ===== */}
      {/* 👇 与标题的间距：mt-3（0.75rem / 12px） */}
      <p className="mt-3 text-sm leading-7 text-[#60736a]">
        {page.lead}
      </p>

      {/* ===== 第三行：两个并排卡片（竖向/横向元音） ===== */}
      {/* 👇 容器与上方正文的间距：mt-6（1.5rem / 24px） */}
      {/* 👇 两个卡片之间的间距：gap-5（1.25rem / 20px） */}
      <div className="mt-6 grid flex-1 grid-cols-2 gap-5">

        {/* 左侧卡片：竖向元音 */}
        <div className="flex min-h-[216px] flex-col justify-center rounded-[24px] border-2 border-[#9bcfc0] p-5 text-center">
          <p className="text-xs font-black text-[#238777]">竖向元音 · 左右组合</p>
          {/* 👇 标签与公式的间距：mt-5（1.25rem / 20px） */}
          <p className="mt-5 text-4xl font-black text-[#173f4a]">ㄱ ㅏ → 가</p>
          {/* 👇 公式与示例的间距：mt-4（1rem / 16px） */}
          <p className="mt-4 text-xs text-[#60736a]">ㅏ · ㅓ · ㅣ</p>
        </div>

        {/* 右侧卡片：横向元音 */}
        <div className="flex min-h-[216px] flex-col justify-center rounded-[24px] border-2 border-[#e5b37a] p-5 text-center">
          <p className="text-xs font-black text-[#b87131]">横向元音 · 上下组合</p>
          {/* 👇 标签与公式的间距：mt-5（1.25rem / 20px） */}
          <p className="mt-5 text-4xl font-black text-[#654b35]">
            ㄱ<br />  {/* 换行，让 ㄱ 在上一行，ㅗ 在下一行 */}
            ㅗ　→ 고
          </p>
          {/* 👇 公式与示例的间距：mt-4（1rem / 16px） */}
          <p className="mt-4 text-xs text-[#8c7865]">ㅗ · ㅜ · ㅡ</p>
        </div>
      </div>

      {/* ===== 第四行：方向判断练习 ===== */}
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-[#e9f6f1] p-3 text-xs text-[#526c60]"><b className="text-[#238777]">看到 ㅏ</b><p className="mt-2 text-2xl font-black text-[#173f4a]">ㄱ　ㅏ</p><p className="mt-1">放右边</p></div>
        <div className="rounded-xl bg-[#fff4e7] p-3 text-xs text-[#765c49]"><b className="text-[#b87131]">看到 ㅗ</b><p className="mt-2 text-2xl font-black text-[#654b35]">ㄱ<br />ㅗ</p><p className="mt-1">放下边</p></div>
        <div className="rounded-xl border border-dashed border-[#d8e3db] p-3 text-xs text-[#526c60]"><b className="text-[#294f43]">快速口诀</b><p className="mt-2 leading-5">竖元音左右排<br />横元音上下排</p></div>
      </div>

      {/* ===== 第五行：田字格联想 ===== */}
      <div className="mt-4 rounded-2xl bg-[#eef4f0] p-5 text-xs leading-6 text-[#526c60]">
        <b className="text-[#238777]">田字格联想：</b>
        {page.chineseExample}
      </div>
    </div>
  );

  if (index === 9) return (
    <div className="flex h-full flex-col text-center">
      {/* ===== 简洁结束页：完成提示 + 答题入口 ===== */}
      <p className="mt-10 text-xs font-black tracking-[0.18em] text-[#c98520]">第一步完成</p>
      <h2 className="mt-4 text-3xl font-black leading-tight text-[#294f43]">{page.title}</h2>
      <p className="mx-auto mt-4 max-w-[78%] text-sm leading-7 text-[#60736a]">声音、字母、音节方块——你已经完成第一步。</p>

      <div className="mt-8 rounded-[30px] border border-[#cfe2d9] bg-[#e9f6f1] px-6 py-8 text-[#173f4a]">
        <p className="text-4xl font-black">시작이 반이다</p>
        <p className="mt-3 text-sm text-[#60736a]">好的开始，是成功的一半。</p>
      </div>

    </div>
  );

  /* ===== 第 9 页：收音结构，用完整版式补足阅读区 ===== */
  return (
    <div className="flex h-full flex-col">
      {/* 标题与导读 */}
      <h2 className="mt-3 text-2xl font-black text-[#294f43]">{page.title}</h2>
      <p className="mt-3 text-sm leading-7 text-[#60736a]">{page.lead}</p>

      {/* 收音放在音节方块的底部，整张卡作为本页核心视觉 */}
      <div className="mt-5 rounded-[28px] bg-[#173f4a] p-6 text-center text-white">
        <p className="text-xs font-bold text-[#9bcfc0]">完整音节结构</p>
        <p className="mt-4 text-5xl font-black tracking-[0.12em]">ㅎ ＋ ㅏ ＋ ㄴ　→　한</p>
        <div className="mt-4 grid grid-cols-3 border-t border-white/20 pt-4 text-xs text-white/75"><span>初声</span><span>中声</span><span>终声（收音）</span></div>
      </div>

      {/* 三个检查点填满中段，学习者可按顺序自查 */}
      <div className="mt-5 grid flex-1 grid-cols-3 gap-3">
        {page.points.map((point, i) => (
          <div key={point} className="flex min-h-[112px] flex-col justify-center rounded-2xl border border-[#dce8e1] bg-[#fbfdfa] p-4 text-xs leading-5 text-[#526c60]">
            <b className="text-[#b87131]">检查 {i + 1}</b>
            <p className="mt-2">{point}</p>
          </div>
        ))}
      </div>

      {/* 中文拼音与韩文收音并排，帮助建立已有经验的连接 */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-[#fff4e7] p-4 text-xs leading-6 text-[#765c49]"><b className="text-[#b87131]">中文收尾音：</b><br />安（n）· 帮（ng）</div>
        <div className="rounded-2xl bg-[#e9f6f1] p-4 text-xs leading-6 text-[#526c60]"><b className="text-[#238777]">韩文收音：</b><br />한 · 반 · 강</div>
      </div>

      <p className="mt-4 rounded-2xl border border-dashed border-[#d8e3db] p-4 text-xs leading-6 text-[#765c49]">{page.chineseExample}</p>
    </div>
  );
}

// ==================== 电子书主内容区 ====================
// 正文和该页交互统一放在这里。以后调整正文高度、底部预留、
// 点播栏位置或交互样式时，只需要修改这个组件。
type BookMainContentProps = {
  index: number;
  page: IntroBookPage;
  onSpeak: (text: string) => void;
};

function BookMainContent({ index, page, onSpeak }: BookMainContentProps) {
  return (
    <div className="relative h-full [&>*]:justify-between">
      {/* 每页主阅读内容 */}
      <IntroLessonPage page={page} index={index} onSpeak={onSpeak} />
    </div>
  );
}

export function HangulBookOpening({
  isFullscreen,
  speechRate = 1,
  initialPage = 0,
  onPageChange,
  onStartTest,
  testLocked,
  live,
}: {
  isFullscreen: boolean;
  speechRate?: number;
  initialPage?: number;
  onPageChange?: (page: number) => void;
  onStartTest: () => void;
  testLocked: boolean;
  /** 伴学课堂：远端翻页指令 + 画笔/批注覆盖层。 */
  live?: {
    page: number | null;
    overlay: React.ReactNode | null;
  };
}) {
  const containerRef = useRef<HTMLElement>(null);
  const flipBookRef = useRef<FlipBookHandle>(null);
  const speechTimerRef = useRef<number | null>(null);
  const speechRequestRef = useRef(0);
  const lastLivePageRef = useRef<number | null>(null);
  const [bookScale, setBookScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrame = 0;
    const resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        // 之前完全没用容器的实际尺寸，全屏/非全屏各按一个固定倍数缩放，
        // 窄视口（如1366宽笔记本非全屏、<900高视口）会被裁掉一截。
        // 按可用宽高与书本原始尺寸的比例来缩放，撑满但不越界；
        // 非全屏最多按原始 100% 显示，全屏最多放大到 MAX_BOOK_SCALE。
        const cap = isFullscreen ? MAX_BOOK_SCALE : 1;
        const nextScale = Math.min(
          container.clientWidth / BOOK_WIDTH,
          container.clientHeight / BOOK_HEIGHT,
          cap
        );

        setBookScale(Math.max(0.1, nextScale));
        flipBookRef.current?.pageFlip()?.update();
      });
    });

    resizeObserver.observe(container);
    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, [isFullscreen]);

  function goToNextPage() {
    flipBookRef.current?.pageFlip()?.flipNext();
  }

  // 伴学课堂：跟随远端翻页指令（防循环由课堂层 lastRemotePage 保证）。
  useEffect(() => {
    if (live?.page == null) return;
    if (live.page === lastLivePageRef.current) return;
    lastLivePageRef.current = live.page;
    flipBookRef.current?.pageFlip()?.flip(live.page);
  }, [live?.page]);

  function goToPreviousPage() {
    flipBookRef.current?.pageFlip()?.flipPrev();
  }

  function speakKorean(text: string) {
    if (!("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const requestId = ++speechRequestRef.current;

    if (speechTimerRef.current !== null) {
      window.clearTimeout(speechTimerRef.current);
    }

    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = speechRate;
    const koreanVoice = synth.getVoices().find((voice) => voice.lang.toLowerCase().startsWith("ko"));
    if (koreanVoice) utterance.voice = koreanVoice;

    // 部分浏览器在 cancel 后同一轮任务中立即 speak 会丢失下一句。
    speechTimerRef.current = window.setTimeout(() => {
      if (requestId === speechRequestRef.current) synth.speak(utterance);
    }, 60);
  }

  useEffect(() => () => {
    if (speechTimerRef.current !== null) window.clearTimeout(speechTimerRef.current);
    window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        flipBookRef.current?.pageFlip()?.flipPrev();
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        flipBookRef.current?.pageFlip()?.flipNext();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <section
      ref={containerRef}
      className="mt-0 flex h-full min-h-0 w-full flex-1 items-center justify-center overflow-hidden"
    >
      <div
        className={`relative shrink-0 ${isFullscreen ? "" : "-translate-y-2.5"}`}
        style={{ width: BOOK_WIDTH * bookScale, height: BOOK_HEIGHT * bookScale }}
      >
        <div className="absolute inset-y-0 -left-[180px] z-20 flex w-[180px] items-center justify-end pr-3">
          <button
            type="button"
            onClick={goToPreviousPage}
            aria-label="电子书上一页"
            title="上一页"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#cfe2d9] bg-white/95 text-2xl font-black text-[#238777] shadow-lg transition duration-200 hover:bg-[#e9f6f1]"
          >
            ←
          </button>
        </div>
        <div className="absolute inset-y-0 -right-[180px] z-20 flex w-[180px] items-center justify-start pl-3">
          <button
            type="button"
            onClick={goToNextPage}
            aria-label="电子书下一页"
            title="下一页"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#cfe2d9] bg-white/95 text-2xl font-black text-[#238777] shadow-lg transition duration-200 hover:bg-[#e9f6f1]"
          >
            →
          </button>
        </div>
        <div
          className="absolute left-0 top-0 h-[822px] w-[1180px] origin-top-left"
          style={{ transform: `scale(${bookScale})` }}
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
            <Page number={0} cover>
              <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-[radial-gradient(circle_at_top_right,_#d8f0e7_0,_transparent_30%),linear-gradient(145deg,_#fffef9_0%,_#e8f6f0_100%)] px-10 py-11 text-center">
                <div aria-hidden="true" className="absolute bottom-0 left-0 right-0 h-[42%] bg-[#173f4a]" />
                <div aria-hidden="true" className="absolute -left-12 -top-12 h-44 w-44 rounded-full border-[18px] border-[#e5f3ee]" />
                <div aria-hidden="true" className="absolute -bottom-16 -right-12 h-52 w-52 rounded-full border-[22px] border-[#fff0dc]" />
                <div className="relative">
                  <p className="text-2xl font-black tracking-[0.22em] text-[#b87131]">韩语字母入门</p>
                  <div className="mx-auto mt-2 h-px w-50 bg-[#cfe2d9]" />
                </div>
                <div className="relative">
                  <p className="text-base font-black tracking-[0.16em] text-[#238777]">第一章</p>
                  <h1 className="mt-5 text-5xl font-black tracking-tight text-[#173f4a]">认识韩语字母</h1>
                  <p className="mt-4 text-lg font-bold text-[#60736a]">先看懂结构，再记住声音</p>
                  <p className="mx-auto mt-7 max-w-sm text-base leading-8 text-[#60736a]">从文字的来历与设计出发，读懂辅音、元音和音节方块如何一起工作。</p>
                  <div className="mt-20 flex justify-center gap-4">
                    {["ㄱ", "ㅏ", "가"].map((letter, index) => <span key={letter} className={`flex h-16 w-16 items-center justify-center rounded-2xl text-3xl font-black ${index === 2 ? "bg-[#238777] text-white" : "bg-white text-[#238777] shadow-sm ring-1 ring-[#d7e8e1]"}`}>{letter}</span>)}
                  </div>
                </div>
                <div className="relative flex items-center justify-between text-sm font-bold text-white/80">
                  <span>互动电子书</span>
                  <span>从理解开始</span>
                </div>
              </div>
            </Page>

            <Page number="00" header="目录">
              <div className="flex h-full flex-col justify-center text-center">

                <p className="text-xs font-black tracking-[0.18em] text-[#238777]">第一章</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight">目录</h2>

                <ol className="mt-7 divide-y divide-[#dce8e1] rounded-2xl border border-[#dce8e1] bg-white px-5 text-left">
                  {[
                    ["01", "本章学习目标"],
                    ["02–04", "1.1 什么是韩文（谚文）"],
                    ["05–07", "1.2 字母的结构：象形与发音原理"],
                    ["08–10", "1.3 韩语字是如何拼成的？"],
                    ["11", "1.4 本章结束"],
                  ].map(([page, title]) => (
                    <li key={page}>
                      <button
                        type="button"
                        onClick={() => flipBookRef.current?.pageFlip()?.flip(Number.parseInt(page, 10) + 1)}
                        className="flex w-full items-center justify-between py-3 text-left text-sm font-bold text-[#526c60] transition hover:text-[#238777]"
                      >
                        <span>{title}</span>
                        <span className="font-black text-[#238777]">{page.slice(0, 2)}</span>
                      </button>
                    </li>
                  ))}
                </ol>

              </div>
            </Page>

            <Page number="01" header="本章学习目标" goals>
              <div className="flex h-full flex-col">
                <p className="text-xs font-black tracking-[0.18em] text-[#238777]">第一章 · GOALS</p>
                <h2 className="mt-3 text-3xl font-black text-[#173f4a]">学完这一章，你将能够</h2>
                <p className="mt-4 text-sm leading-7 text-[#60736a]">
                  先建立对韩文整体结构的认识，再进入具体字母学习。带着目标阅读，会更容易抓住每一页的重点。
                </p>
                <div className="mt-7 grid flex-1 content-center gap-4">
                  {[
                    ["01", "理解韩文的来历", "知道《训民正音》的设计目的，不再把韩文当作需要死记的图形。"],
                    ["02", "看懂字母的设计", "理解元音与天地人、辅音与发音器官之间的联系。"],
                    ["03", "认识音节方块", "能判断字母的左右、上下与底部位置，读懂音节的基本结构。"],
                  ].map(([number, title, description]) => (
                    <section key={number} className="grid grid-cols-[54px_1fr] gap-4 rounded-[22px] border border-[#dce8e1] bg-white p-5">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e7f4ef] text-sm font-black text-[#238777]">{number}</span>
                      <div>
                        <h3 className="text-base font-black text-[#294f43]">{title}</h3>
                        <p className="mt-1 text-xs leading-6 text-[#71857b]">{description}</p>
                      </div>
                    </section>
                  ))}
                </div>
                <div className="mt-6 rounded-2xl bg-[#fff3e3] p-4 text-sm font-bold leading-6 text-[#765c49]">
                  阅读建议：先理解规则，再点击页面中的韩文字母听音、跟读。
                </div>
              </div>
            </Page>

            {BOOK_PAGES.map((page, index) => (
              <Page key={page.number} number={page.number} header={page.section}>
                <BookMainContent index={index} page={page} onSpeak={speakKorean} />
              </Page>
            ))}

            <Page number="11" header="1.4 本章结束" fullBleed>
              <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-[linear-gradient(145deg,#fffef9_0%,#f0f8f4_100%)] px-10 py-10 text-center">
                <div aria-hidden="true" className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#e4f3ed]" />
                <div aria-hidden="true" className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-[#fff0dc]" />
                <div className="absolute left-8 right-8 top-8 flex items-center justify-between border-b border-[#dce8e1] pb-3 text-xs font-black">
                  <span className="text-[#238777]">1.4 本章结束</span>
                  <span className="text-[#789087]">第一章 · 认识韩语字母</span>
                </div>
                <div className="relative">
                  <p className="text-sm font-black tracking-[0.2em] text-[#b87131]">第一章完成</p>
                  <h2 className="mt-5 text-4xl font-black text-[#173f4a]">你已经拿到读懂韩文的第一把钥匙</h2>
                  <p className="mx-auto mt-5 max-w-md text-base leading-8 text-[#60736a]">
                    你已经了解韩文的来历、字母的设计原理和音节方块的基本结构。韩文不再只是一组陌生符号，接下来通过本章测试检查自己是否真正理解。
                  </p>

                  <div className="mx-auto mt-9 grid max-w-md grid-cols-3 gap-3">
                    {[
                      ["ㄱ", "辅音"],
                      ["ㅏ", "元音"],
                      ["가", "音节"],
                    ].map(([letter, label]) => (
                      <div key={letter} className="rounded-2xl border border-[#d8e7e0] bg-white p-4 shadow-sm">
                        <p className="text-3xl font-black text-[#238777]">{letter}</p>
                        <p className="mt-2 text-xs font-bold text-[#789087]">{label}</p>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={onStartTest}
                    disabled={testLocked}
                    title={testLocked ? "完成本章学习目标后解锁测试" : undefined}
                    className="mt-10 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#238777] px-8 py-4 text-base font-black text-white shadow-lg transition enabled:hover:-translate-y-0.5 enabled:hover:bg-[#1d7468] disabled:cursor-not-allowed disabled:bg-[#a9afa9] disabled:shadow-none"
                  >
                    {testLocked && <Lock size={17} />}
                    进入本章测试
                  </button>
                  <p className="mt-4 text-xs font-bold text-[#8a9b93]">
                    {testLocked ? "完成本章学习目标后解锁测试" : "完成测试后将解锁下一章"}
                  </p>
                </div>
                <div className="absolute bottom-8 left-8 right-8 flex items-center justify-between border-t border-[#dce8e1] pt-3 text-xs font-bold text-[#71857b]">
                  <span>互动电子书</span>
                  <span className="font-black text-[#238777]">11</span>
                </div>
              </div>
            </Page>

          </HTMLFlipBook>
          {live?.overlay}
        </div>
      </div>
    </section>
  );
}
