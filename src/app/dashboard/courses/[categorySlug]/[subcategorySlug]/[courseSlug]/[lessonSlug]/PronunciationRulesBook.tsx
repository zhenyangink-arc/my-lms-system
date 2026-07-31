"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";
import { Headphones, Lightbulb, Volume2 } from "lucide-react";

type PageProps = {
  children: React.ReactNode;
  cover?: boolean;
  goals?: boolean;
  header?: string;
  number: string | number;
};

type FlipBookHandle = {
  pageFlip: () => {
    flip: (page: number) => void;
    flipNext: () => void;
    flipPrev: () => void;
    update: () => void;
  } | undefined;
};

type RuleItem = {
  value: string;
  sound: string;
  structure: string;
  hint: string;
};

type RulePage = {
  number: string;
  section: string;
  title: string;
  lead: string;
  tip: string;
  accent: "green" | "orange";
  items: readonly RuleItem[];
};

const BOOK_WIDTH = 1180;
const BOOK_HEIGHT = 822;
const MAX_BOOK_SCALE = 680 / 570;

const PAGES: readonly RulePage[] = [
  {
    number: "02", section: "4.1 发音规则是怎么产生的", accent: "green",
    title: "写法保存结构，读音负责让说话更顺",
    lead: "韩语并不是“写错了”或“随便读”。拼写让我们看见词的组成，实际发音则会让相邻动作互相迁就。音变大多发生在两个音节的交界处，也就是“前一音节的收音｜后一音节的开头辅音”。",
    tip: "先相信拼写，再分析读音。规则的作用是解释声音怎样从写法一步步变成自然读音。",
    items: [
      { value: "학·교", sound: "학교", structure: "ㄱ｜ㄱ", hint: "[학꾜]｜学校｜后音变紧" },
      { value: "국·물", sound: "국물", structure: "ㄱ｜ㅁ", hint: "[궁물]｜汤汁｜前音变鼻音" },
      { value: "신·라", sound: "신라", structure: "ㄴ｜ㄹ", hint: "[실라]｜新罗｜舌尖动作靠拢" },
      { value: "좋·다", sound: "좋다", structure: "ㅎ｜ㄷ", hint: "[조타]｜好｜合成送气音" },
    ],
  },
  {
    number: "03", section: "4.1 发音判断流程", accent: "orange",
    title: "不要猜整词：按照五步找到真正变化的位置",
    lead: "第一步划分音节，第二步圈出收音，第三步看下一音节是元音还是辅音，第四步选择连音或相邻音变，第五步把处理后的音节重新合起来。复杂词也只是多重复几次这套流程。",
    tip: "固定口诀：分音节、找收音、看后音、选规则、合起来。每次只处理一条音节边界。",
    items: [
      { value: "한국어", sound: "한국어", structure: "한·국·어", hint: "国｜语的边界是 ㄱ｜ㅇ/ㅓ" },
      { value: "한구거", sound: "한국어", structure: "국·어 → 구·거", hint: "后面是元音，先做连音" },
      { value: "감사합니다", sound: "감사합니다", structure: "감·사·합·니·다", hint: "重点边界是 ㅂ｜ㄴ" },
      { value: "감사함니다", sound: "감사합니다", structure: "ㅂ + ㄴ → ㅁ + ㄴ", hint: "鼻音化后再合成整句" },
    ],
  },
  {
    number: "04", section: "4.1 多规则处理顺序", accent: "green",
    title: "一个词发生两次变化时，一步一步处理",
    lead: "同一个词可能同时出现收音代表音、连音、紧音化或鼻音化。不要试图一眼跳到最终答案。先处理最靠前的边界，再用处理后的声音判断下一条边界。",
    tip: "实际发音写在方括号里只是学习工具，不是新的韩文拼写。正式书写仍使用原词。",
    items: [
      { value: "꽃잎", sound: "꽃잎", structure: "꽃·잎 → 꼳·닙", hint: "先添加 ㄴ，再处理收音" },
      { value: "꼰닙", sound: "꽃잎", structure: "ㄷ + ㄴ → ㄴ + ㄴ", hint: "[꼰닙]｜花瓣、叶片" },
      { value: "십육", sound: "십육", structure: "십·육 → 십·뉵", hint: "先在元音前添加 ㄴ" },
      { value: "심뉵", sound: "십육", structure: "ㅂ + ㄴ → ㅁ + ㄴ", hint: "[심뉵]｜十六" },
    ],
  },
  {
    number: "05", section: "4.2 连音现象", accent: "green",
    title: "后面以元音开始，收音就到下一格重新起音",
    lead: "后一音节写作 ㅇ 加元音时，开头的 ㅇ 不发音，只负责占位。前一音节的收音会移动到这个空位置，成为下一音节的开头辅音。字母没有消失，只是音节边界重新划分。",
    tip: "画箭头：먹·어 → 머·거。移动的是发音位置，原来的标准拼写不改变。",
    items: [
      { value: "먹어", sound: "먹어", structure: "먹·어 → 머·거", hint: "[머거]｜吃吧" },
      { value: "집에", sound: "집에", structure: "집·에 → 지·베", hint: "[지베]｜在家" },
      { value: "책을", sound: "책을", structure: "책·을 → 채·글", hint: "[채글]｜书（宾格）" },
      { value: "한국어", sound: "한국어", structure: "국·어 → 구·거", hint: "[한구거]｜韩语" },
    ],
  },
  {
    number: "06", section: "4.2 普通收音连音", accent: "orange",
    title: "连过去以后，要恢复字母原本的开头音",
    lead: "在音节末尾，多个字母会归并为七个代表收音；但移动到元音前以后，它不再处于收音位置，通常恢复该字母本来的辅音音值。因此 옷 的 ㅅ 单独收尾像 ㄷ，到了 옷이 中又读回 ㅅ。",
    tip: "先问“它现在还在底部吗？”移到下一音节开头后，就按开头辅音读。",
    items: [
      { value: "옷이", sound: "옷이", structure: "옷·이 → 오·시", hint: "[오시]｜衣服（主格）" },
      { value: "낮에", sound: "낮에", structure: "낮·에 → 나·제", hint: "[나제]｜白天、午间" },
      { value: "꽃을", sound: "꽃을", structure: "꽃·을 → 꼬·츨", hint: "[꼬츨]｜花（宾格）" },
      { value: "부엌에", sound: "부엌에", structure: "엌·에 → 어·케", hint: "[부어케]｜在厨房" },
      { value: "끝이", sound: "끝이", structure: "끝·이 → 끄·치", hint: "[끄치]｜末端（主格）" },
      { value: "숲에", sound: "숲에", structure: "숲·에 → 수·페", hint: "[수페]｜在树林" },
    ],
  },
  {
    number: "07", section: "4.2 复收音连音", accent: "green",
    title: "复收音遇元音：前一个留下，后一个移过去",
    lead: "底部有两个不同辅音时，下一音节如果以元音开始，通常把第一个辅音留作前一音节收音，把第二个辅音移到下一音节开头。两个字母因此都能听见。",
    tip: "先重新分组再读：읽·어不是直接猜成一个新词，而是变成 일·거。",
    items: [
      { value: "읽어", sound: "읽어", structure: "읽·어 → 일·거", hint: "[일거]｜读吧" },
      { value: "앉아", sound: "앉아", structure: "앉·아 → 안·자", hint: "[안자]｜坐吧" },
      { value: "젊어", sound: "젊어", structure: "젊·어 → 절·머", hint: "[절머]｜年轻" },
      { value: "넓어", sound: "넓어", structure: "넓·어 → 널·버", hint: "[널버]｜宽" },
      { value: "핥아", sound: "핥아", structure: "핥·아 → 할·타", hint: "[할타]｜舔吧" },
      { value: "없어", sound: "없어", structure: "없·어 → 업·서", hint: "随后还会紧音化为 [업써]" },
    ],
  },
  {
    number: "08", section: "4.2 连音与腭化", accent: "orange",
    title: "ㄷ、ㅌ遇到 이 时，舌位会向前变成 ㅈ、ㅊ",
    lead: "ㄷ、ㅌ 收音后接 이，或接以 이 开始的语法成分时，连音后的发音位置会靠近硬腭：ㄷ 变 ㅈ，ㅌ 变 ㅊ。这叫腭化，实际生活词中非常常见。",
    tip: "不是所有“ㄷ/ㅌ＋元音”都会腭化，关键是后面出现 이 或与它相关的发音环境。",
    items: [
      { value: "같이", sound: "같이", structure: "ㅌ + 이 → 치", hint: "[가치]｜一起" },
      { value: "굳이", sound: "굳이", structure: "ㄷ + 이 → 지", hint: "[구지]｜执意、非要" },
      { value: "맏이", sound: "맏이", structure: "ㄷ + 이 → 지", hint: "[마지]｜老大" },
      { value: "해돋이", sound: "해돋이", structure: "돋 + 이 → 도지", hint: "[해도지]｜日出" },
    ],
  },
  {
    number: "09", section: "4.2 连音综合辨读", accent: "green",
    title: "先判断是不是元音开头，再看有没有第二条规则",
    lead: "看到 ㅇ 不一定都能连音：它在音节开头时不发音，可以接收前面的收音；在音节底部时则是真正的 ng。完成移动以后，还要检查是否出现腭化或紧音化。",
    tip: "比较 방에 与 먹어：방 的 ㅇ 在底部不能移动；먹 的 ㄱ 才是会移动的收音。",
    items: [
      { value: "방에", sound: "방에", structure: "ㅇ 是 ng 收音", hint: "[방에]｜在房间｜不移动" },
      { value: "음악을", sound: "음악을", structure: "악·을 → 아·글", hint: "[으마글]｜音乐（宾格）" },
      { value: "맛있어요", sound: "맛있어요", structure: "常用读音", hint: "[마시써요]｜好吃" },
      { value: "할 일이", sound: "할 일이", structure: "일·이 → 이·리", hint: "[할리리]｜要做的事" },
    ],
  },
  {
    number: "10", section: "4.3 紧音化", accent: "orange",
    title: "前一音节收紧，后面的平音也跟着变紧",
    lead: "ㄱ、ㄷ、ㅂ 类收音后面遇到平音 ㄱ、ㄷ、ㅂ、ㅅ、ㅈ 时，后音经常变成 ㄲ、ㄸ、ㅃ、ㅆ、ㅉ。紧音不靠大量送气，而靠声门和口腔动作更紧、更短。",
    tip: "变化的是后一个辅音；前面的收音仍要先做完。학·교 读 [학·꾜]，不能只读 [하꾜]。",
    items: [
      { value: "ㄱ→ㄲ", sound: "학교", structure: "학 + 교", hint: "[학꾜]｜学校" },
      { value: "ㄷ→ㄸ", sound: "식당", structure: "식 + 당", hint: "[식땅]｜食堂" },
      { value: "ㅂ→ㅃ", sound: "국밥", structure: "국 + 밥", hint: "[국빱]｜汤饭" },
      { value: "ㅅ→ㅆ", sound: "학생", structure: "학 + 생", hint: "[학쌩]｜学生" },
      { value: "ㅈ→ㅉ", sound: "잡지", structure: "잡 + 지", hint: "[잡찌]｜杂志" },
    ],
  },
  {
    number: "11", section: "4.3 收音后的紧音化", accent: "green",
    title: "先把收音归类，再判断后面的平音",
    lead: "触发紧音化的是实际收尾音，不只是字面写着 ㄱ、ㄷ、ㅂ。像 옷 的 ㅅ 在末尾归到 ㄷ 类，也能让后面的 ㅈ 变成 ㅉ；复收音也要先决定保留哪个声音。",
    tip: "两步走：先得到实际收音，再把下一平音变紧。",
    items: [
      { value: "옷장", sound: "옷장", structure: "ㅅ→ㄷ + ㅈ→ㅉ", hint: "[옫짱]｜衣柜" },
      { value: "꽃집", sound: "꽃집", structure: "ㅊ→ㄷ + ㅈ→ㅉ", hint: "[꼳찝]｜花店" },
      { value: "책상", sound: "책상", structure: "ㄱ + ㅅ→ㅆ", hint: "[책쌍]｜书桌" },
      { value: "읽다", sound: "읽다", structure: "ㄺ→ㄱ + ㄷ→ㄸ", hint: "[익따]｜读" },
      { value: "없다", sound: "없다", structure: "ㅄ→ㅂ + ㄷ→ㄸ", hint: "[업따]｜没有" },
      { value: "앉다", sound: "앉다", structure: "ㄵ→ㄴ + ㄷ→ㄸ", hint: "[안따]｜坐" },
    ],
  },
  {
    number: "12", section: "4.3 语法环境中的紧音", accent: "orange",
    title: "词干后接常用词尾，也会出现高频紧音",
    lead: "动词和形容词词干以收音结束时，后接 -고、-다、-지 等形式，开头的平音经常变紧。初学时把规则和高频表达一起记，比只背音变名称更实用。",
    tip: "先保持标准拼写，再在朗读标记中给发生变化的辅音加圈。",
    items: [
      { value: "먹고", sound: "먹고", structure: "ㄱ + ㄱ→ㄲ", hint: "[먹꼬]｜吃了以后" },
      { value: "받다", sound: "받다", structure: "ㄷ + ㄷ→ㄸ", hint: "[받따]｜接受" },
      { value: "입고", sound: "입고", structure: "ㅂ + ㄱ→ㄲ", hint: "[입꼬]｜穿着" },
      { value: "있지", sound: "있지", structure: "ㄷ类 + ㅈ→ㅉ", hint: "[읻찌]｜有吧" },
      { value: "몇 시", sound: "몇 시", structure: "ㄷ类 + ㅅ→ㅆ", hint: "[멷씨]｜几点" },
      { value: "할 것", sound: "할 것", structure: "定语形后的紧音", hint: "[할껃]｜要做的事情" },
    ],
  },
  {
    number: "13", section: "4.3 紧音听辨", accent: "green",
    title: "紧音和激音不同：一个“绷紧”，一个“送气”",
    lead: "ㄲ、ㄸ、ㅃ、ㅆ、ㅉ 是紧音，口腔动作紧但气流少；ㅋ、ㅌ、ㅍ、ㅊ 是激音，气流明显。两类声音不能因为中文标音相近而混在一起。",
    tip: "把薄纸放在嘴前：激音会明显吹动纸片，紧音的关键是突然、紧促，而不是大力吹气。",
    items: [
      { value: "학교", sound: "학교", structure: "[학꾜]｜ㄲ", hint: "紧音｜纸片移动较小" },
      { value: "축하", sound: "축하", structure: "[추카]｜ㅋ", hint: "激音｜能感到明显气流" },
      { value: "식당", sound: "식당", structure: "[식땅]｜ㄸ", hint: "紧音｜舌尖绷紧" },
      { value: "좋다", sound: "좋다", structure: "[조타]｜ㅌ", hint: "激音｜ㅎ 带来送气" },
    ],
  },
  {
    number: "14", section: "4.4 激音化", accent: "orange",
    title: "ㅎ像一股气：与平音相遇后合成激音",
    lead: "ㅎ 与 ㄱ、ㄷ、ㅂ、ㅈ 相遇时，常把它们变成对应的送气音 ㅋ、ㅌ、ㅍ、ㅊ。两个动作合成一个更有气流的声音，ㅎ 本身通常不再单独听见。",
    tip: "四组必须熟记：ㅎ+ㄱ=ㅋ，ㅎ+ㄷ=ㅌ，ㅎ+ㅂ=ㅍ，ㅎ+ㅈ=ㅊ。",
    items: [
      { value: "ㅎ+ㄱ", sound: "축하", structure: "→ ㅋ", hint: "축하 [추카]｜祝贺" },
      { value: "ㅎ+ㄷ", sound: "좋다", structure: "→ ㅌ", hint: "좋다 [조타]｜好" },
      { value: "ㅎ+ㅂ", sound: "잡히다", structure: "→ ㅍ", hint: "잡히다 [자피다]｜被抓住" },
      { value: "ㅎ+ㅈ", sound: "좋지", structure: "→ ㅊ", hint: "좋지 [조치]｜好吧" },
    ],
  },
  {
    number: "15", section: "4.4 前后方向的激音化", accent: "green",
    title: "ㅎ在前面或后面都可能提供送气",
    lead: "ㅎ 可以位于前一音节收音，也可以位于后一音节开头。判断重点不是书写方向，而是两个实际声音是否相遇。像 입학 中，ㅂ 收音和后面的 ㅎ 合成 ㅍ。",
    tip: "把两个音节交界处单独读慢：입｜학 → 이｜팍，再合成 [이팍]。",
    items: [
      { value: "놓고", sound: "놓고", structure: "ㅎ + ㄱ → ㅋ", hint: "[노코]｜放下以后" },
      { value: "좋다", sound: "좋다", structure: "ㅎ + ㄷ → ㅌ", hint: "[조타]｜好" },
      { value: "입학", sound: "입학", structure: "ㅂ + ㅎ → ㅍ", hint: "[이팍]｜入学" },
      { value: "맏형", sound: "맏형", structure: "ㄷ + ㅎ → ㅌ", hint: "[마텽]｜大哥" },
      { value: "북한", sound: "북한", structure: "ㄱ + ㅎ → ㅋ", hint: "[부칸]｜朝鲜" },
      { value: "꽃향기", sound: "꽃향기", structure: "ㄷ类 + ㅎ → ㅌ", hint: "[꼬턍기]｜花香" },
    ],
  },
  {
    number: "16", section: "4.4 复收音中的 ㅎ", accent: "orange",
    title: "ㄶ、ㅀ里的ㅎ看似藏着，仍会影响后音",
    lead: "复收音 ㄶ、ㅀ 后接 ㄱ、ㄷ、ㅈ 时，前面的 ㄴ 或 ㄹ 保留，ㅎ 与后音结合形成 ㅋ、ㅌ、ㅊ。读音里常听不到单独的 ㅎ，却能听到它留下的送气效果。",
    tip: "先拆复收音，再分工：ㄴ/ㄹ 留在前面，ㅎ 负责让后面的平音送气。",
    items: [
      { value: "많다", sound: "많다", structure: "ㄶ + ㄷ → ㄴ + ㅌ", hint: "[만타]｜多" },
      { value: "많고", sound: "많고", structure: "ㄶ + ㄱ → ㄴ + ㅋ", hint: "[만코]｜多并且……" },
      { value: "괜찮다", sound: "괜찮다", structure: "ㄶ + ㄷ → ㄴ + ㅌ", hint: "[괜찬타]｜没关系、不错" },
      { value: "싫다", sound: "싫다", structure: "ㅀ + ㄷ → ㄹ + ㅌ", hint: "[실타]｜讨厌" },
      { value: "옳고", sound: "옳고", structure: "ㅀ + ㄱ → ㄹ + ㅋ", hint: "[올코]｜正确并且……" },
    ],
  },
  {
    number: "17", section: "4.4 激音化综合", accent: "green",
    title: "先找ㅎ，再判断它是送气、弱化还是脱落",
    lead: "ㅎ 后接辅音时常参与激音化，后接元音时却常弱化或不明显。不能见到 ㅎ 就一律读成强烈的 h；必须看它旁边是谁。",
    tip: "辅音旁边先检查激音化，元音旁边再检查 ㅎ 弱化。下一节会专门处理弱化与脱落。",
    items: [
      { value: "축하", sound: "축하", structure: "ㄱ + ㅎ → ㅋ", hint: "[추카]｜辅音相遇" },
      { value: "좋고", sound: "좋고", structure: "ㅎ + ㄱ → ㅋ", hint: "[조코]｜辅音相遇" },
      { value: "좋아요", sound: "좋아요", structure: "ㅎ + 元音", hint: "[조아요]｜ㅎ 弱化" },
      { value: "많아요", sound: "많아요", structure: "ㄶ + 元音", hint: "[마나요]｜ㅎ 不单独发音" },
    ],
  },
  {
    number: "18", section: "4.5 鼻音化", accent: "green",
    title: "塞音遇到ㄴ、ㅁ，会换成同位置的鼻音",
    lead: "为了让气流顺畅进入鼻腔，ㄱ、ㄷ、ㅂ 三类收音在 ㄴ、ㅁ 前分别变为 ㅇ、ㄴ、ㅁ。变化后的声音仍在相近位置完成，因此说起来比原组合更自然。",
    tip: "三组对应：ㄱ→ㅇ，ㄷ→ㄴ，ㅂ→ㅁ；后面的 ㄴ 或 ㅁ 保持不变。",
    items: [
      { value: "ㄱ→ㅇ", sound: "국물", structure: "ㄱ + ㅁ", hint: "국물 [궁물]｜汤汁" },
      { value: "ㄷ→ㄴ", sound: "받는", structure: "ㄷ + ㄴ", hint: "받는 [반는]｜接受的" },
      { value: "ㅂ→ㅁ", sound: "십년", structure: "ㅂ + ㄴ", hint: "십년 [심년]｜十年" },
      { value: "ㅂ→ㅁ", sound: "앞문", structure: "ㅂ + ㅁ", hint: "앞문 [암문]｜前门" },
    ],
  },
  {
    number: "19", section: "4.5 鼻音化分类练习", accent: "orange",
    title: "字母不同，也要先归入ㄱ、ㄷ、ㅂ代表音",
    lead: "鼻音化依据的是实际代表收音。ㅋ、ㄲ 归入 ㄱ 类；ㅅ、ㅈ、ㅊ、ㅌ 等归入 ㄷ 类；ㅍ 归入 ㅂ 类。先归类，才能选对鼻音。",
    tip: "不要只盯着字形。例如 옷 的 ㅅ 先读成 ㄷ 类，再在 ㄴ 前变成 ㄴ。",
    items: [
      { value: "부엌문", sound: "부엌문", structure: "ㅋ→ㄱ→ㅇ", hint: "[부엉문]｜厨房门" },
      { value: "옷만", sound: "옷만", structure: "ㅅ→ㄷ→ㄴ", hint: "[온만]｜只有衣服" },
      { value: "몇 명", sound: "몇 명", structure: "ㅊ→ㄷ→ㄴ", hint: "[면 명]｜几个人" },
      { value: "앞니", sound: "앞니", structure: "ㅍ→ㅂ→ㅁ", hint: "[암니]｜门牙" },
      { value: "막내", sound: "막내", structure: "ㄱ + ㄴ → ㅇㄴ", hint: "[망내]｜老幺" },
      { value: "합니다", sound: "합니다", structure: "ㅂ + ㄴ → ㅁㄴ", hint: "[함니다]｜做（敬语）" },
    ],
  },
  {
    number: "20", section: "4.5 流音化", accent: "green",
    title: "ㄴ和ㄹ相遇，常统一成两个流音ㄹ",
    lead: "ㄴ+ㄹ 或 ㄹ+ㄴ 相邻时，舌尖需要在相近位置快速切换，很多词会读成 ㄹ+ㄹ。这叫流音化。声音要连贯，但不要把两个音节合成一个。",
    tip: "用舌尖保持一次连续接触：신·라 → 실·라。",
    items: [
      { value: "신라", sound: "신라", structure: "ㄴ + ㄹ → ㄹㄹ", hint: "[실라]｜新罗" },
      { value: "연락", sound: "연락", structure: "ㄴ + ㄹ → ㄹㄹ", hint: "[열락]｜联系" },
      { value: "편리", sound: "편리", structure: "ㄴ + ㄹ → ㄹㄹ", hint: "[펼리]｜便利" },
      { value: "설날", sound: "설날", structure: "ㄹ + ㄴ → ㄹㄹ", hint: "[설랄]｜春节" },
      { value: "칼날", sound: "칼날", structure: "ㄹ + ㄴ → ㄹㄹ", hint: "[칼랄]｜刀刃" },
      { value: "물난리", sound: "물난리", structure: "ㄹ + ㄴ → ㄹㄹ", hint: "[물랄리]｜水灾、混乱" },
    ],
  },
  {
    number: "21", section: "4.5 ㄹ的鼻音化", accent: "orange",
    title: "并非所有ㄴ＋ㄹ都流音化：部分词会把ㄹ读成ㄴ",
    lead: "在一些汉字词和特定词汇中，收音后面的 ㄹ 会先变成 ㄴ；前面如果是塞音，还可能继续发生鼻音化。此类词需要结合高频词记忆，不能机械套用双 ㄹ。",
    tip: "把常用词作为整体记：종로 [종노]、독립 [동닙]、심리 [심니]。",
    items: [
      { value: "종로", sound: "종로", structure: "ㅇ + ㄹ → ㅇㄴ", hint: "[종노]｜钟路" },
      { value: "심리", sound: "심리", structure: "ㅁ + ㄹ → ㅁㄴ", hint: "[심니]｜心理" },
      { value: "음료", sound: "음료", structure: "ㅁ + ㄹ → ㅁㄴ", hint: "[음뇨]｜饮料" },
      { value: "독립", sound: "독립", structure: "ㄱ+ㄹ → ㅇ+ㄴ", hint: "[동닙]｜独立" },
      { value: "협력", sound: "협력", structure: "ㅂ+ㄹ → ㅁ+ㄴ", hint: "[혐녁]｜合作" },
      { value: "법률", sound: "법률", structure: "ㅂ+ㄹ → ㅁ+ㄴ", hint: "[범뉼]｜法律" },
    ],
  },
  {
    number: "22", section: "4.5 连续同化判断", accent: "green",
    title: "两步变化：先处理ㄹ，再让前面的塞音鼻音化",
    lead: "像 독립 这样的词不能一步背成答案。先把 ㄹ 在特定环境中变成 ㄴ，得到 ㄱ+ㄴ；再应用鼻音化，把 ㄱ 变成 ㅇ，最终得到 [동닙]。",
    tip: "写出中间过程能防止混乱：독립 → 독닙 → 동닙。",
    items: [
      { value: "독립", sound: "독립", structure: "독립→독닙→동닙", hint: "[동닙]｜独立" },
      { value: "협력", sound: "협력", structure: "협력→협녁→혐녁", hint: "[혐녁]｜合作" },
      { value: "입력", sound: "입력", structure: "입력→입녁→임녁", hint: "[임녁]｜输入" },
      { value: "국립", sound: "국립", structure: "국립→국닙→궁닙", hint: "[궁닙]｜国立" },
    ],
  },
  {
    number: "23", section: "4.6 ㅎ弱化与脱落", accent: "orange",
    title: "ㅎ夹在元音之间时，常常变轻甚至听不见",
    lead: "ㅎ 在辅音旁边可能引发激音化，但在元音之间或复收音后接元音时，常弱化或脱落。自然语速中不必强行发出明显的 h，否则会显得生硬。",
    tip: "对比 좋다 [조타] 与 좋아요 [조아요]：后面是辅音还是元音，决定了 ㅎ 的去向。",
    items: [
      { value: "좋아요", sound: "좋아요", structure: "ㅎ + 元音 → 弱化", hint: "[조아요]｜好" },
      { value: "놓아요", sound: "놓아요", structure: "ㅎ + 元音 → 弱化", hint: "[노아요]｜放下" },
      { value: "많아요", sound: "많아요", structure: "ㄶ + 元音", hint: "[마나요]｜多" },
      { value: "싫어요", sound: "싫어요", structure: "ㅀ + 元音", hint: "[시러요]｜讨厌" },
    ],
  },
  {
    number: "24", section: "4.6 ㄴ添加", accent: "green",
    title: "合成词中遇到이、야、여、요、유，常在前面添加ㄴ",
    lead: "部分合成词或派生词中，前一部分以收音结束，后一部分以 이、야、여、요、유 开始时，实际发音会在中间添加 ㄴ。添加后还可能继续触发鼻音化。",
    tip: "这不是普通连音。先添加 ㄴ，再重新检查前面的收音是否要鼻音化。",
    items: [
      { value: "꽃잎", sound: "꽃잎", structure: "꽃+닙→꼳닙→꼰닙", hint: "[꼰닙]｜花瓣、叶片" },
      { value: "색연필", sound: "색연필", structure: "색+년필→생년필", hint: "[생년필]｜彩色铅笔" },
      { value: "솜이불", sound: "솜이불", structure: "솜+니불", hint: "[솜니불]｜棉被" },
      { value: "십육", sound: "십육", structure: "십+뉵→심뉵", hint: "[심뉵]｜十六" },
      { value: "한여름", sound: "한여름", structure: "한+녀름", hint: "[한녀름]｜盛夏" },
      { value: "맨입", sound: "맨입", structure: "맨+닙", hint: "[맨닙]｜空口、无代价" },
    ],
  },
  {
    number: "25", section: "4.6 의的实用读法", accent: "orange",
    title: "同一个의，根据位置和作用可以有三种常见读法",
    lead: "의 在词首通常读 [의]；位于词中、不是第一个音节时常允许读 [이]；作为表示所属关系的助词“的”时，日常口语常读 [에]。初学者先掌握高频用法即可。",
    tip: "看位置也看语法：의사 的 의 是词首，나의 的 의 是所属助词。",
    items: [
      { value: "의사", sound: "의사", structure: "词首 의", hint: "[의사]｜医生" },
      { value: "의자", sound: "의자", structure: "词首 의", hint: "[의자]｜椅子" },
      { value: "회의", sound: "회의", structure: "非词首 의", hint: "[회의/훼이]｜会议" },
      { value: "주의", sound: "주의", structure: "非词首 의", hint: "[주의/주이]｜注意" },
      { value: "나의", sound: "나의", structure: "所属助词 의", hint: "[나에]｜我的" },
      { value: "친구의", sound: "친구의", structure: "所属助词 의", hint: "[친구에]｜朋友的" },
    ],
  },
  {
    number: "26", section: "4.6 规则组合", accent: "green",
    title: "复杂读音仍然可以拆成几次简单变化",
    lead: "真实词语常同时出现两条规则。只要保留中间步骤，就不会觉得它们是毫无规律的特殊读法。每处理一次，都重新检查下一条音节边界。",
    tip: "不要省略中间形态：꽃잎 → 꼳닙 → 꼰닙，比直接背 [꼰닙] 更容易迁移到新词。",
    items: [
      { value: "꽃잎", sound: "꽃잎", structure: "ㄴ添加＋鼻音化", hint: "[꼰닙]｜花瓣、叶片" },
      { value: "십육", sound: "십육", structure: "ㄴ添加＋鼻音化", hint: "[심뉵]｜十六" },
      { value: "독립", sound: "독립", structure: "ㄹ→ㄴ＋鼻音化", hint: "[동닙]｜独立" },
      { value: "없어요", sound: "없어요", structure: "复收音连音＋紧音", hint: "[업써요]｜没有" },
      { value: "괜찮아요", sound: "괜찮아요", structure: "复收音＋ㅎ弱化", hint: "[괜차나요]｜没关系" },
      { value: "읽고", sound: "읽고", structure: "ㄺ例外＋紧音", hint: "[일꼬]｜读然后……" },
    ],
  },
  {
    number: "27", section: "4.6 易错规则对比", accent: "orange",
    title: "先看环境，避免把一条规则套到所有单词",
    lead: "同一个字母组合会因后面的声音不同而选择不同规则。学习时要成组比较，而不是只记一个最终读音。",
    tip: "每组慢读三遍：先标准拼写、再音节边界、最后实际读音。",
    items: [
      { value: "좋다", sound: "좋다", structure: "ㅎ+ㄷ→ㅌ", hint: "[조타]｜激音化" },
      { value: "좋아요", sound: "좋아요", structure: "ㅎ+元音", hint: "[조아요]｜ㅎ弱化" },
      { value: "국밥", sound: "국밥", structure: "ㄱ+ㅂ→ㅃ", hint: "[국빱]｜紧音化" },
      { value: "국물", sound: "국물", structure: "ㄱ+ㅁ→ㅇ", hint: "[궁물]｜鼻音化" },
      { value: "읽다", sound: "읽다", structure: "ㄺ→ㄱ", hint: "[익따]｜后接辅音" },
      { value: "읽어", sound: "읽어", structure: "复收音分开", hint: "[일거]｜后接元音" },
    ],
  },
  {
    number: "28", section: "4.7 问候与自我介绍", accent: "green",
    title: "把规则放进每天都会说的第一组表达",
    lead: "实用拼读不只看最终标音。先找变化位置，再完整朗读整句，最后逐渐减少停顿。点击卡片可以听标准韩语示范。",
    tip: "句子练习顺序：分块慢读两遍，按实际读音连读两遍，最后不看提示说一遍。",
    items: [
      { value: "안녕하세요", sound: "안녕하세요", structure: "[안녕하세요]", hint: "您好" },
      { value: "감사합니다", sound: "감사합니다", structure: "ㅂ+ㄴ→ㅁ｜[감사함니다]", hint: "谢谢" },
      { value: "반갑습니다", sound: "반갑습니다", structure: "紧音＋鼻音｜[반갑씀니다]", hint: "很高兴见到您" },
      { value: "괜찮아요", sound: "괜찮아요", structure: "ㅎ弱化｜[괜차나요]", hint: "没关系、还不错" },
      { value: "제 이름은 민수예요", sound: "제 이름은 민수예요", structure: "이름·은→이르믄", hint: "[제 이르믄 민수예요]｜我叫民秀" },
      { value: "한국어를 공부해요", sound: "한국어를 공부해요", structure: "국·어→구·거", hint: "[한구거를 공부해요]｜我学习韩语" },
    ],
  },
  {
    number: "29", section: "4.7 数字时间与购物", accent: "orange",
    title: "数字本身不难，难点常在与量词相遇的地方",
    lead: "数字、时间和价格中经常出现收音、紧音化、鼻音化与 ㄴ 添加。把数字和后面的量词作为一个语音单位练习，实际交流时会自然很多。",
    tip: "重点不是背中文标音，而是看清数字末尾与量词开头之间发生了什么。",
    items: [
      { value: "몇 시예요?", sound: "몇 시예요", structure: "ㄷ类+ㅅ→ㅆ", hint: "[멷 씨예요]｜几点？" },
      { value: "여섯 개", sound: "여섯 개", structure: "ㄷ类+ㄱ→ㄲ", hint: "[여섣 깨]｜六个" },
      { value: "십육", sound: "십육", structure: "ㄴ添加＋鼻音化", hint: "[심뉵]｜十六" },
      { value: "삼천 원", sound: "삼천 원", structure: "천·원 连贯读", hint: "[삼처눤]｜三千韩元" },
      { value: "얼마예요?", sound: "얼마예요", structure: "얼·마·예·요", hint: "[얼마예요]｜多少钱？" },
      { value: "몇 명이에요?", sound: "몇 명이에요", structure: "ㄷ类+ㅁ→ㄴ", hint: "[면 명이에요]｜有几个人？" },
    ],
  },
  {
    number: "30", section: "4.7 生活场景拼读", accent: "green",
    title: "从单词进入短句：一次只处理一个交界处",
    lead: "完整句子不需要一口气读快。先在意义单位之间保留短暂停顿，把每个单位内部读顺，再逐渐连接。正确的节奏来自清楚的结构，而不是强行加速。",
    tip: "先标出发生规则的词，再读整句；没有音变的部分不必过度加工。",
    items: [
      { value: "학교에 가요", sound: "학교에 가요", structure: "학교→[학꾜]", hint: "去学校" },
      { value: "식당에서 먹어요", sound: "식당에서 먹어요", structure: "식당→[식땅]", hint: "在餐厅吃饭" },
      { value: "국물을 주세요", sound: "국물을 주세요", structure: "국물→[궁물]", hint: "请给我汤" },
      { value: "같이 읽어요", sound: "같이 읽어요", structure: "같이[가치]·읽어[일거]", hint: "一起读吧" },
      { value: "연락 주세요", sound: "연락 주세요", structure: "연락→[열락]", hint: "请联系我" },
      { value: "축하합니다", sound: "축하합니다", structure: "축하[추카]＋합니다[함니다]", hint: "恭喜您" },
    ],
  },
  {
    number: "31", section: "4.8 综合应用与小结", accent: "orange",
    title: "最终目标：看到新词也能按流程自己推导",
    lead: "遇到陌生词时，先判断后面是元音还是辅音，再依次检查连音、紧音化、激音化、鼻音化、流音化、ㅎ变化、腭化和 ㄴ 添加。能够说出“为什么这样读”，才是真正掌握。",
    tip: "遮住提示自行分析，点击听音核对。错了不要只背答案，要找到自己漏掉的那一步。",
    items: [
      { value: "한국어", sound: "한국어", structure: "连音", hint: "[한구거]｜韩语" },
      { value: "학생", sound: "학생", structure: "紧音化", hint: "[학쌩]｜学生" },
      { value: "입학", sound: "입학", structure: "激音化", hint: "[이팍]｜入学" },
      { value: "국물", sound: "국물", structure: "鼻音化", hint: "[궁물]｜汤汁" },
      { value: "연락", sound: "연락", structure: "流音化", hint: "[열락]｜联系" },
      { value: "꽃잎", sound: "꽃잎", structure: "ㄴ添加＋鼻音化", hint: "[꼰닙]｜花瓣、叶片" },
    ],
  },
];

const Page = forwardRef<HTMLDivElement, PageProps>(function Page(
  { children, cover = false, goals = false, header, number },
  ref
) {
  return (
    <div ref={ref} className={`h-full overflow-hidden shadow-[inset_0_0_28px_rgba(57,78,67,0.08)] ${
      goals ? "bg-[linear-gradient(145deg,#eef4fb_0%,#e4edf7_100%)]" : "bg-[#fffef9]"
    }`}>
      {cover ? children : (
        <div className="flex h-full flex-col px-9 py-8">
          <div className={`flex items-center justify-between border-b pb-3 text-[11px] font-black tracking-[0.12em] ${
            goals ? "border-[#c7d6e6]" : "border-[#dce8e1]"
          }`}>
            <span className="text-[#267a8b]">{header}</span>
            <span className="text-[#789087]">第四章 · 发音规则与实用拼读</span>
          </div>
          <div className="min-h-0 flex-1 pt-5">{children}</div>
          <div className={`mt-4 flex items-center justify-between border-t pt-3 text-[11px] font-bold text-[#92a099] ${
            goals ? "border-[#c7d6e6]" : "border-[#e4ebe7]"
          }`}>
            <span>互动电子书</span><span>{number}</span>
          </div>
        </div>
      )}
    </div>
  );
});

function RuleContent({ page, onSpeak }: { page: RulePage; onSpeak: (text: string) => void }) {
  const green = page.accent === "green";
  return (
    <div className="flex h-full flex-col">
      <h2 className="text-3xl font-black leading-tight text-[#173f4a]">{page.title}</h2>
      <p className="mt-4 text-sm leading-7 text-[#60736a]">{page.lead}</p>
      <div className={`mt-5 grid flex-1 content-center gap-3 ${page.items.length >= 5 ? "grid-cols-3" : "grid-cols-2"}`}>
        {page.items.map((item, itemIndex) => (
          <button key={`${page.number}-${itemIndex}`} type="button" onClick={() => onSpeak(item.sound)}
            className={`rounded-[22px] border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
              green ? "border-[#d5e7df] hover:border-[#72b7a7]" : "border-[#eadfce] hover:border-[#d6975f]"
            }`}>
            <span className="flex items-start justify-between gap-2">
              <span className={`text-2xl font-black ${green ? "text-[#238777]" : "text-[#9b5e2e]"}`}>{item.value}</span>
              <Volume2 size={16} className={green ? "text-[#72b7a7]" : "text-[#d6975f]"} />
            </span>
            <span className="mt-3 block text-sm font-black text-[#294f43]">{item.structure}</span>
            <span className="mt-1 block text-xs leading-5 text-[#7a8d84]">{item.hint}</span>
          </button>
        ))}
      </div>
      <div className={`mt-5 flex gap-3 rounded-2xl p-4 ${green ? "bg-[#e9f6f1] text-[#42675b]" : "bg-[#fff2e2] text-[#765c49]"}`}>
        <Lightbulb size={18} className="mt-0.5 shrink-0" />
        <p className="text-sm font-bold leading-6">{page.tip}</p>
      </div>
    </div>
  );
}

export function PronunciationRulesBook({
  isFullscreen,
  speechRate = 0.78,
  initialPage = 0,
  onPageChange,
  onStartTest,
}: {
  isFullscreen: boolean;
  speechRate?: number;
  initialPage?: number;
  onPageChange?: (page: number) => void;
  onStartTest: () => void;
}) {
  const containerRef = useRef<HTMLElement>(null);
  const flipBookRef = useRef<FlipBookHandle>(null);
  const speechTimerRef = useRef<number | null>(null);
  const speechRequestRef = useRef(0);
  const [bookScale, setBookScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setBookScale(isFullscreen ? MAX_BOOK_SCALE : 1);
        flipBookRef.current?.pageFlip()?.update();
      });
    });
    observer.observe(container);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [isFullscreen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") flipBookRef.current?.pageFlip()?.flipPrev();
      if (event.key === "ArrowRight") flipBookRef.current?.pageFlip()?.flipNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => () => {
    if (speechTimerRef.current !== null) window.clearTimeout(speechTimerRef.current);
    window.speechSynthesis?.cancel();
  }, []);

  function speakKorean(text: string) {
    if (!("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const requestId = ++speechRequestRef.current;
    if (speechTimerRef.current !== null) window.clearTimeout(speechTimerRef.current);
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = speechRate;
    const voice = synth.getVoices().find((item) => item.lang.toLowerCase().startsWith("ko"));
    if (voice) utterance.voice = voice;
    speechTimerRef.current = window.setTimeout(() => {
      if (requestId === speechRequestRef.current) synth.speak(utterance);
    }, 60);
  }

  return (
    <section ref={containerRef} className="mt-0 flex h-full min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
      <div className={`relative shrink-0 ${isFullscreen ? "" : "-translate-y-2.5"}`} style={{ width: BOOK_WIDTH * bookScale, height: BOOK_HEIGHT * bookScale }}>
        <button type="button" onClick={() => flipBookRef.current?.pageFlip()?.flipPrev()} aria-label="电子书上一页" className="absolute left-[-58px] top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#cfe2d9] bg-white text-2xl font-black text-[#238777] shadow-lg">←</button>
        <button type="button" onClick={() => flipBookRef.current?.pageFlip()?.flipNext()} aria-label="电子书下一页" className="absolute right-[-58px] top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#cfe2d9] bg-white text-2xl font-black text-[#238777] shadow-lg">→</button>
        <div className="absolute left-0 top-0 h-[822px] w-[1180px] origin-top-left" style={{ transform: `scale(${bookScale})` }}>
          <HTMLFlipBook ref={flipBookRef} width={590} height={822} startPage={initialPage} size="fixed" minWidth={590} maxWidth={590} minHeight={822} maxHeight={822} drawShadow maxShadowOpacity={0.32} flippingTime={650} usePortrait startZIndex={0} autoSize={false} showCover={false} mobileScrollSupport swipeDistance={24} clickEventForward useMouseEvents={false} showPageCorners={false} disableFlipByClick onFlip={(event) => onPageChange?.(event.data)} className="h-[822px] w-[1180px]" style={{}}>
            <Page number={0} cover>
              <div className="relative flex h-full flex-col justify-between overflow-hidden bg-[radial-gradient(circle_at_top_right,_#d7eaf1_0,_transparent_34%),linear-gradient(145deg,_#fffef9_0%,_#e7f2f5_100%)] px-10 py-11 text-center">
                <div aria-hidden="true" className="absolute bottom-0 left-0 right-0 h-[40%] bg-[#173f4a]" />
                <div className="relative"><p className="text-2xl font-black tracking-[0.22em] text-[#b87131]">韩语字母入门</p><div className="mx-auto mt-2 h-px w-48 bg-[#cfe2d9]" /></div>
                <div className="relative">
                  <p className="text-base font-black tracking-[0.16em] text-[#267a8b]">第四章</p>
                  <h1 className="mt-5 text-5xl font-black tracking-tight text-[#173f4a]">发音规则与实用拼读</h1>
                  <p className="mt-4 text-xl font-black text-[#267a8b]">발음 규칙과 읽기</p>
                  <p className="mx-auto mt-7 max-w-md text-base leading-8 text-[#60736a]">看懂声音怎样变化，把规则真正用进问候、数字、自我介绍和生活短句。</p>
                  <div className="mt-14 flex justify-center gap-3">{["연음", "경음", "격음"].map((text) => <span key={text} className="rounded-2xl bg-white px-5 py-4 text-lg font-black text-[#267a8b] shadow-sm ring-1 ring-[#d7e8e1]">{text}</span>)}</div>
                </div>
                <div className="relative flex items-center justify-between text-sm font-bold text-white/80"><span className="inline-flex items-center gap-2"><Headphones size={16} />互动电子书</span><span>30 个学习主题</span></div>
              </div>
            </Page>

            <Page number="00" header="目录">
              <div className="flex h-full flex-col justify-center text-center">
                <p className="text-xs font-black tracking-[0.18em] text-[#267a8b]">CHAPTER 04</p>
                <h2 className="mt-3 text-3xl font-black text-[#173f4a]">目录</h2>
                <ol className="mt-5 divide-y divide-[#e5ece7] rounded-2xl border border-[#dce8e1] bg-white px-5 py-2 text-left">
                  {[
                    [1, "本章学习目标"], [2, "4.1 发音规则是怎么产生的"], [5, "4.2 连音现象"],
                    [10, "4.3 紧音化"], [14, "4.4 激音化"], [18, "4.5 鼻音化与流音化"],
                    [23, "4.6 其他高频发音规则"], [28, "4.7 日常词汇与句子拼读"], [31, "4.8 综合应用与本章小结"],
                  ].map(([page, title]) => (
                    <li key={page}><button type="button" onClick={() => flipBookRef.current?.pageFlip()?.flip(Number(page) + 1)} className="flex w-full items-center justify-between py-3 text-left text-sm font-bold text-[#526c60] transition hover:text-[#267a8b]"><span>{title}</span><span className="font-black text-[#267a8b]">{String(page).padStart(2, "0")}</span></button></li>
                  ))}
                </ol>
              </div>
            </Page>

            <Page number="01" header="本章学习目标" goals>
              <div className="flex h-full flex-col">
                <p className="text-xs font-black tracking-[0.18em] text-[#267a8b]">CHAPTER 04 · GOALS</p>
                <h2 className="mt-3 text-3xl font-black text-[#173f4a]">学完这一章，你将能够</h2>
                <p className="mt-4 text-sm leading-7 text-[#60736a]">不靠死记中文谐音，根据音节边界和相邻声音推导韩语词句的实际读音。</p>
                <div className="mt-7 grid flex-1 content-center gap-4">
                  {[
                    ["01", "看懂规则", "找到音变发生的交界处，并解释连音、紧音、激音、鼻音和流音变化。"],
                    ["02", "独立推导", "面对陌生词时按固定步骤写出中间过程和实际读音。"],
                    ["03", "开口应用", "自然朗读问候、数字、价格、自我介绍和常用生活短句。"],
                  ].map(([number, title, description]) => (
                    <section key={number} className="grid grid-cols-[54px_1fr] gap-4 rounded-[22px] border border-[#cbdbe8] bg-white p-5"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e5eef6] text-sm font-black text-[#267a8b]">{number}</span><div><h3 className="text-base font-black text-[#294f43]">{title}</h3><p className="mt-1 text-xs leading-6 text-[#71857b]">{description}</p></div></section>
                  ))}
                </div>
                <div className="mt-6 rounded-2xl bg-[#fff3e3] p-4 text-sm font-bold leading-6 text-[#765c49]">学习建议：每个案例先自己标出音节边界，再点击卡片听音，不要直接背最终标音。</div>
              </div>
            </Page>

            {PAGES.map((page) => <Page key={page.number} number={page.number} header={page.section}><RuleContent page={page} onSpeak={speakKorean} /></Page>)}

            <Page number="32" header="本章结束">
              <div className="relative flex h-full flex-col items-center justify-center overflow-hidden text-center">
                <div aria-hidden="true" className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#e4eff4]" /><div aria-hidden="true" className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-[#fff0dc]" />
                <div className="relative">
                  <p className="text-sm font-black tracking-[0.2em] text-[#b87131]">CHAPTER 04 COMPLETE</p>
                  <h2 className="mt-5 text-4xl font-black text-[#173f4a]">从看懂规则，到读出真实韩语</h2>
                  <p className="mx-auto mt-5 max-w-md text-base leading-8 text-[#60736a]">你已经完成连音、紧音化、激音化、鼻音化、流音化及其他高频规则的系统学习。接下来进入本章测试检查判断能力。</p>
                  <div className="mx-auto mt-9 grid max-w-md grid-cols-3 gap-3">{[["한국어", "[한구거]"], ["학교", "[학꾜]"], ["국물", "[궁물]"]].map(([value, label]) => <div key={value} className="rounded-2xl border border-[#d8e7e0] bg-white p-4 shadow-sm"><p className="text-xl font-black text-[#267a8b]">{value}</p><p className="mt-2 text-xs font-bold text-[#789087]">{label}</p></div>)}</div>
                  <button type="button" onClick={onStartTest} className="mt-10 rounded-2xl bg-[#267a8b] px-8 py-4 text-base font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#206a78]">进入本章测试</button>
                  <p className="mt-4 text-xs font-bold text-[#8a9b93]">完成本章测试，巩固发音规则</p>
                </div>
              </div>
            </Page>

          </HTMLFlipBook>
        </div>
      </div>
    </section>
  );
}
