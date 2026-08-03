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

type ReadingItem = {
  value: string;
  sound: string;
  structure: string;
  hint: string;
};

type LessonPage = {
  number: string;
  section: string;
  title: string;
  lead: string;
  tip: string;
  accent: "green" | "orange";
  items: readonly ReadingItem[];
};

const BOOK_WIDTH = 1180;
const BOOK_HEIGHT = 822;
const MAX_BOOK_SCALE = 680 / 570;

const LESSON_PAGES: readonly LessonPage[] = [
  {
    number: "02",
    section: "3.1 收音与拼读导读",
    title: "先认识收音：写在音节方块底部的“结尾声音”",
    lead: "韩文把字母拼成一个个方块。方块上半部分负责把声音“打开”，最底部如果再出现一个辅音，它就负责把声音“收住”。这个位于底部的辅音叫作收音，韩语称 받침，字面上有“托在下面”的意思。",
    tip: "先只看位置：辅音写在方块底部，就是收音。此时不用急着背规则，也不用急着追求语速。",
    accent: "green",
    items: [
      { value: "가", sound: "가", structure: "ㄱ + ㅏ", hint: "没有收音｜声音保持开放" },
      { value: "각", sound: "각", structure: "ㄱ + ㅏ + ㄱ", hint: "底部的 ㄱ 是收音｜声音在舌根收住" },
      { value: "나", sound: "나", structure: "ㄴ + ㅏ", hint: "没有收音｜读完仍能继续拉长" },
      { value: "난", sound: "난", structure: "ㄴ + ㅏ + ㄴ", hint: "底部的 ㄴ 是收音｜声音以 n 结束" },
    ],
  },
  {
    number: "03",
    section: "3.1 收音与拼读导读",
    title: "收音不是多读一个字，而是改变声音的结尾",
    lead: "看到 각，不能把它拆成“가 + 그”两个音节。底部的 ㄱ 没有自己的元音，只给 가 增加一个短促的结尾动作。韩文方块里虽然有三个字母，读出来仍然只有一个音节。",
    tip: "判断方法很简单：数方块，不数里面的字母。一个方块就是一个音节；底部辅音只负责收尾。",
    accent: "orange",
    items: [
      { value: "가", sound: "가", structure: "[ka]", hint: "声音打开后结束｜一个音节" },
      { value: "각", sound: "각", structure: "[kak̚]", hint: "结尾在舌根停住｜仍是一个音节" },
      { value: "바", sound: "바", structure: "[pa]", hint: "双唇打开后进入元音" },
      { value: "밥", sound: "밥", structure: "[pap̚]", hint: "最后双唇闭合｜米饭" },
    ],
  },
  {
    number: "04",
    section: "3.1 收音与拼读导读",
    title: "用中文找感觉：阿、安、昂的结尾并不一样",
    lead: "中文里也有声音“收尾”的经验。“阿”读完时口腔保持开放；“安”最后有 n；“昂”最后有 ng。韩文的不同之处，是它会把这个结尾辅音直接写在音节方块底部，所以你能用眼睛看见声音在哪里结束。",
    tip: "中文类比只是帮助找到身体感觉，不代表两种语言的发音完全相同。最终仍要以韩语示范音为准。",
    accent: "green",
    items: [
      { value: "아", sound: "아", structure: "[a]｜像“阿”", hint: "无收音｜口腔保持开放" },
      { value: "안", sound: "안", structure: "[an]｜像“安”的尾音", hint: "ㄴ 收音｜舌尖抵住上齿龈" },
      { value: "앙", sound: "앙", structure: "[aŋ]｜像“昂”的尾音", hint: "ㅇ 收音｜舌后部抬起并产生鼻音" },
      { value: "암", sound: "암", structure: "[am]｜借助中文 m 尾找感觉", hint: "ㅁ 收音｜双唇闭合" },
    ],
  },
  {
    number: "05",
    section: "3.1 收音与拼读导读",
    title: "拼读是什么？把字母按位置合成一个声音",
    lead: "拼读不是看到单词后直接猜读音，而是先拆结构，再把声音合回去。遇到带收音的音节时，按“开头辅音 → 元音 → 底部收音”三个位置读取；熟练后，这三个动作会自然连成一个完整音节。",
    tip: "第一次练习时可以用手指依次点三个位置：先上或左，再右或中，最后点底部。慢读正确，比快速猜读更重要。",
    accent: "orange",
    items: [
      { value: "한", sound: "한", structure: "ㅎ → ㅏ → ㄴ", hint: "[han]｜韩、一个" },
      { value: "문", sound: "문", structure: "ㅁ → ㅜ → ㄴ", hint: "[mun]｜门" },
      { value: "밤", sound: "밤", structure: "ㅂ → ㅏ → ㅁ", hint: "[pam]｜夜晚" },
      { value: "공", sound: "공", structure: "ㄱ → ㅗ → ㅇ", hint: "[koŋ]｜球" },
      { value: "밥", sound: "밥", structure: "ㅂ → ㅏ → ㅂ", hint: "[pap̚]｜米饭" },
      { value: "책", sound: "책", structure: "ㅊ → ㅐ → ㄱ", hint: "[tɕʰɛk̚]｜书" },
    ],
  },
  {
    number: "06",
    section: "3.2 音节结构与不爆破",
    title: "声母 + 韵母 + 韵尾：最后只做动作，不把气放出来",
    lead: "拼读顺序始终是开头辅音、元音、收音。ㄱ、ㄷ、ㅂ 等塞音在末尾时，只做到发音位置就停止，这就是“不爆破”。",
    tip: "不要在收音后偷偷加元音。밥 读到双唇闭合就结束，不能读成“바브”。",
    accent: "green",
    items: [
      { value: "한", sound: "한", structure: "ㅎ → ㅏ → ㄴ", hint: "[han]｜韩、一个" },
      { value: "밤", sound: "밤", structure: "ㅂ → ㅏ → ㅁ", hint: "[pam]｜夜晚" },
      { value: "국", sound: "국", structure: "ㄱ → ㅜ → ㄱ", hint: "[kuk̚]｜国、汤" },
      { value: "집", sound: "집", structure: "ㅈ → ㅣ → ㅂ", hint: "[tɕip̚]｜家" },
      { value: "책", sound: "책", structure: "ㅊ → ㅐ → ㄱ", hint: "[tɕʰɛk̚]｜书" },
      { value: "옷", sound: "옷", structure: "ㅇ → ㅗ → ㅅ", hint: "[ot̚]｜衣服" },
    ],
  },
  {
    number: "07",
    section: "3.3 七大代表收音",
    title: "许多收音，最后归到 7 个代表音",
    lead: "韩语收音字母很多，但实际在音节末尾发音时，通常归纳为 ㄱ、ㄴ、ㄷ、ㄹ、ㅁ、ㅂ、ㅇ 七类。",
    tip: "这一页先记代表音，不必一次背完所有变化规则。",
    accent: "orange",
    items: [
      { value: "ㄱ", sound: "국", structure: "k", hint: "舌根收住" },
      { value: "ㄴ", sound: "눈", structure: "n", hint: "舌尖抵住上齿龈" },
      { value: "ㄷ", sound: "옷", structure: "t", hint: "舌尖短促收住" },
      { value: "ㄹ", sound: "달", structure: "l", hint: "舌尖保持接触" },
      { value: "ㅁ", sound: "밤", structure: "m", hint: "双唇闭合" },
      { value: "ㅂ", sound: "밥", structure: "p", hint: "双唇短促收住" },
      { value: "ㅇ", sound: "공", structure: "ng", hint: "舌后部发鼻音" },
    ],
  },
  {
    number: "08",
    section: "3.3 塞音类代表音",
    title: "ㄱ、ㄷ、ㅂ：分别在舌根、舌尖和双唇收住",
    lead: "这三类都是不爆破收音。ㄱ 类在舌根停止，ㄷ 类在舌尖停止，ㅂ 类用双唇停止。",
    tip: "对比 구—국、오—옷、바—밥，只做末尾动作，不额外送气。",
    accent: "orange",
    items: [
      { value: "국", sound: "국", structure: "ㄱ + ㅜ + ㄱ", hint: "国、汤等词中常见" },
      { value: "밖", sound: "밖", structure: "ㅂ + ㅏ + ㄲ", hint: "外面" },
      { value: "부엌", sound: "부엌", structure: "ㅋ → ㄱ 类", hint: "厨房" },
      { value: "책", sound: "책", structure: "ㅊ + ㅐ + ㄱ", hint: "书" },
      { value: "옷", sound: "옷", structure: "ㅅ → ㄷ 类", hint: "[ot̚]｜衣服" },
      { value: "꽃", sound: "꽃", structure: "ㅊ → ㄷ 类", hint: "[k͈ot̚]｜花" },
      { value: "밥", sound: "밥", structure: "ㅂ 类", hint: "[pap̚]｜米饭" },
      { value: "앞", sound: "앞", structure: "ㅍ → ㅂ 类", hint: "[ap̚]｜前面" },
    ],
  },
  {
    number: "09",
    section: "3.3 鼻音与流音代表音",
    title: "ㄴ、ㄹ、ㅁ、ㅇ：用身体动作记住收尾",
    lead: "ㄴ 用舌尖收尾，ㄹ 保持舌尖接触，ㅁ 闭合双唇，ㅇ 则用舌后部和鼻腔发出 ng。",
    tip: "对比 산、살、삼、상，感受声音分别在哪里结束。",
    accent: "green",
    items: [
      { value: "한", sound: "한", structure: "ㅎ + ㅏ + ㄴ", hint: "韩、一个" },
      { value: "눈", sound: "눈", structure: "ㄴ + ㅜ + ㄴ", hint: "眼睛、雪" },
      { value: "산", sound: "산", structure: "ㅅ + ㅏ + ㄴ", hint: "山" },
      { value: "문", sound: "문", structure: "ㅁ + ㅜ + ㄴ", hint: "门" },
      { value: "달", sound: "달", structure: "ㄹ · [l]", hint: "月亮" },
      { value: "말", sound: "말", structure: "ㄹ · [l]", hint: "话、马" },
      { value: "밤", sound: "밤", structure: "ㅁ · [m]", hint: "夜晚" },
      { value: "공", sound: "공", structure: "ㅇ · [ŋ]", hint: "球" },
    ],
  },
  {
    number: "10",
    section: "3.4 同字母双收音",
    title: "ㄲ、ㅆ：写成双字母，末尾仍只收成一个代表音",
    lead: "ㄲ 在末尾归到 ㄱ 类，ㅆ 在末尾归到 ㄷ 类。虽然字形是双写，收尾时也不能读成两个声音。",
    tip: "밖 的 ㄲ 读作 ㄱ 类不爆破音；있 的 ㅆ 读作 ㄷ 类不爆破音。",
    accent: "orange",
    items: [
      { value: "밖", sound: "밖", structure: "ㄲ → ㄱ 类", hint: "[pak̚]｜外面" },
      { value: "있", sound: "있", structure: "ㅆ → ㄷ 类", hint: "[it̚]｜有、在" },
      { value: "밖에", sound: "밖에", structure: "밖 · 에", hint: "[pak͈e]｜在外面" },
      { value: "있다", sound: "있다", structure: "있 · 다", hint: "[it̚.t͈a]｜有" },
      { value: "맛있다", sound: "맛있다", structure: "맛 · 있 · 다", hint: "[마싣따]｜好吃" },
      { value: "있어요", sound: "있어요", structure: "있 · 어 · 요", hint: "[이써요]｜有" },
    ],
  },
  {
    number: "11",
    section: "3.5 异字母复收音",
    title: "两个不同字母住在底部，实际发音要做取舍",
    lead: "复收音由两个不同辅音组成。单独收尾时通常只读其中一个代表音；后面接元音时，另一个字母可能移动到下一音节。",
    tip: "先记常见词，不要一次死背全部组合。重点比较 읽다—읽어、없다—없어요。",
    accent: "green",
    items: [
      { value: "읽다", sound: "읽다", structure: "ㄺ → ㄱ", hint: "[익따]｜读" },
      { value: "읽어", sound: "읽어", structure: "ㄹ + ㄱ 连出", hint: "[일거]｜读（变形）" },
      { value: "앉다", sound: "앉다", structure: "ㄵ → ㄴ", hint: "[안따]｜坐" },
      { value: "많다", sound: "많다", structure: "ㄶ → ㄴ", hint: "[만타]｜多" },
      { value: "젊다", sound: "젊다", structure: "ㄻ → ㅁ", hint: "[점따]｜年轻" },
      { value: "없다", sound: "없다", structure: "ㅄ → ㅂ", hint: "[업따]｜没有" },
      { value: "여덟", sound: "여덟", structure: "ㄼ → ㄹ", hint: "[여덜]｜八" },
      { value: "넓다", sound: "넓다", structure: "ㄼ → ㄹ/ㅂ", hint: "[널따]｜宽" },
    ],
  },
  {
    number: "12",
    section: "3.5 复收音判断方法",
    title: "第一步先看后面：接辅音、接元音，处理方法不同",
    lead: "复收音不是看到两个字母就随便选一个读。判断时先看它后面有没有音节：词在这里结束，或者后面以辅音开头，通常只保留一个收尾音；后面以不发音的 ㅇ 开头并接元音时，两个字母往往会分开，各自承担一个位置。",
    tip: "固定判断顺序：①圈出底部两个字母；②看下一音节开头；③接辅音就查“保留哪个音”；④接元音就考虑把后一个字母移过去。",
    accent: "green",
    items: [
      { value: "읽", sound: "읽", structure: "词尾｜ㄺ → ㄱ", hint: "[익]｜后面没有元音，只留收尾音" },
      { value: "읽다", sound: "읽다", structure: "ㄺ + ㄷ", hint: "[익따]｜后接辅音，先处理复收音" },
      { value: "읽어", sound: "읽어", structure: "ㄺ + ㅇ/ㅓ", hint: "[일거]｜后接元音，两个字母分开" },
      { value: "없다", sound: "없다", structure: "ㅄ + ㄷ", hint: "[업따]｜后接辅音，ㅂ 留在前面" },
      { value: "없어", sound: "없어", structure: "ㅄ + ㅇ/ㅓ", hint: "[업써]｜ㅅ 移到下一音节" },
      { value: "앉아", sound: "앉아", structure: "ㄵ + ㅇ/ㅏ", hint: "[안자]｜ㅈ 移过去重新起音" },
    ],
  },
  {
    number: "13",
    section: "3.5 复收音保留规则",
    title: "多数情况保留前一个：先掌握最常用的八组",
    lead: "在词尾或后接辅音时，ㄳ、ㄵ、ㄶ、ㄼ、ㄽ、ㄾ、ㅀ、ㅄ 通常保留左边的辅音。可以先记成“多数看左边”。保留下来的字母还要按照七大代表收音发音，不能把两个字母都读出来。",
    tip: "“保留前一个”是入门主线，不等于所有单词都没有例外。先把高频词读稳，再单独认识例外，比背一长串表格更可靠。",
    accent: "orange",
    items: [
      { value: "넋", sound: "넋", structure: "ㄳ → ㄱ｜[넉]", hint: "灵魂｜保留左边 ㄱ" },
      { value: "앉다", sound: "앉다", structure: "ㄵ → ㄴ｜[안따]", hint: "坐｜保留左边 ㄴ" },
      { value: "많다", sound: "많다", structure: "ㄶ → ㄴ｜[만타]", hint: "多｜ㄴ 保留，ㅎ 影响后音" },
      { value: "넓다", sound: "넓다", structure: "ㄼ → ㄹ｜[널따]", hint: "宽｜一般保留左边 ㄹ" },
      { value: "외곬", sound: "외곬", structure: "ㄽ → ㄹ｜[외골]", hint: "一条道｜保留左边 ㄹ" },
      { value: "핥다", sound: "핥다", structure: "ㄾ → ㄹ｜[할따]", hint: "舔｜保留左边 ㄹ" },
      { value: "싫다", sound: "싫다", structure: "ㅀ → ㄹ｜[실타]", hint: "讨厌｜ㄹ 保留，ㅎ 使 ㄷ 送气" },
      { value: "없다", sound: "없다", structure: "ㅄ → ㅂ｜[업따]", hint: "没有｜保留左边 ㅂ" },
    ],
  },
  {
    number: "14",
    section: "3.5 复收音保留规则",
    title: "三组通常保留后一个：ㄺ、ㄻ、ㄿ，再认识高频例外",
    lead: "ㄺ、ㄻ、ㄿ 在词尾或后接辅音时，通常保留右边的 ㄱ、ㅁ、ㅂ，所以可以记成“三组看右边”。但 ㄺ 后面遇到 ㄱ 开头时常保留 ㄹ；ㄼ 也有 밟다、넓죽하다 等需要单独记忆的高频例外。",
    tip: "不要只背“左”或“右”。每学一个复收音，至少绑定一个代表词和实际读音：ㄺ—읽다，ㄻ—삶，ㄿ—읊다。",
    accent: "green",
    items: [
      { value: "읽다", sound: "읽다", structure: "ㄺ → ㄱ｜[익따]", hint: "读｜通常保留右边 ㄱ" },
      { value: "닭", sound: "닭", structure: "ㄺ → ㄱ｜[닥]", hint: "鸡｜词尾保留右边 ㄱ" },
      { value: "삶", sound: "삶", structure: "ㄻ → ㅁ｜[삼]", hint: "生活｜保留右边 ㅁ" },
      { value: "젊다", sound: "젊다", structure: "ㄻ → ㅁ｜[점따]", hint: "年轻｜保留右边 ㅁ" },
      { value: "읊다", sound: "읊다", structure: "ㄿ → ㅂ｜[읍따]", hint: "吟诵｜保留右边 ㅂ" },
      { value: "읽고", sound: "읽고", structure: "ㄺ + ㄱ → ㄹ｜[일꼬]", hint: "读然后……｜ㄺ 遇 ㄱ 的常见例外" },
      { value: "밟다", sound: "밟다", structure: "ㄼ → ㅂ｜[밥따]", hint: "踩｜不是一般的 ㄹ，要单独记" },
      { value: "밟고", sound: "밟고", structure: "ㄼ → ㅂ｜[밥꼬]", hint: "踩着……｜保留 ㅂ 并发生紧音化" },
    ],
  },
  {
    number: "15",
    section: "3.5 复收音与元音",
    title: "后接元音时：前一个留作收音，后一个搬到下一格",
    lead: "下一音节以 ㅇ 开头时，这个 ㅇ 只是元音的占位符，本身不发音。复收音中的前一个辅音通常留在原音节底部，后一个辅音移动到下一音节，成为开头辅音。这样两个字母都能听见，却分属两个音节。",
    tip: "在纸上画一条箭头最直观：읽·어 → 일·거。先重新划分音节，再读实际声音，不要把结果当成全新的拼写。",
    accent: "orange",
    items: [
      { value: "읽어", sound: "읽어", structure: "읽·어 → 일·거", hint: "[일거]｜ㄹ 留下，ㄱ 移过去" },
      { value: "앉아", sound: "앉아", structure: "앉·아 → 안·자", hint: "[안자]｜ㄴ 留下，ㅈ 移过去" },
      { value: "젊어", sound: "젊어", structure: "젊·어 → 절·머", hint: "[절머]｜ㄹ 留下，ㅁ 移过去" },
      { value: "없어", sound: "없어", structure: "없·어 → 업·서", hint: "[업써]｜ㅂ 留下，ㅅ 移后并紧音化" },
      { value: "넓어", sound: "넓어", structure: "넓·어 → 널·버", hint: "[널버]｜ㄹ 留下，ㅂ 移过去" },
      { value: "핥아", sound: "핥아", structure: "핥·아 → 할·타", hint: "[할타]｜ㄹ 留下，ㅌ 移过去" },
    ],
  },
  {
    number: "16",
    section: "3.6 连音现象",
    title: "后面是元音时，收音会走到下一音节门口",
    lead: "后一个音节以不发音的 ㅇ 开头时，前面的收音常移动过去重新起音。这就是连音现象 연음 현상。",
    tip: "把收音想成住在前一格地板上的字母；下一格门口空着，它就顺势走过去。",
    accent: "green",
    items: [
      { value: "한국어", sound: "한국어", structure: "국 + 어 → 구거", hint: "[한구거]｜韩语" },
      { value: "먹어요", sound: "먹어요", structure: "먹 + 어요 → 머거요", hint: "[머거요]｜吃" },
      { value: "밥을", sound: "밥을", structure: "밥 + 을 → 바블", hint: "[바블]｜米饭（宾格）" },
      { value: "옷이", sound: "옷이", structure: "옷 + 이 → 오시", hint: "[오시]｜衣服（主格）" },
      { value: "책을", sound: "책을", structure: "책 + 을 → 채글", hint: "[채글]｜书（宾格）" },
      { value: "집에", sound: "집에", structure: "집 + 에 → 지베", hint: "[지베]｜在家" },
      { value: "꽃이", sound: "꽃이", structure: "꽃 + 이 → 꼬치", hint: "[꼬치]｜花（主格）" },
      { value: "음악", sound: "음악", structure: "음 + 악 → 으막", hint: "[으막]｜音乐" },
    ],
  },
  {
    number: "17",
    section: "3.7 自然拼读与基础音变",
    title: "先逐格读清，再认识常见的声音变化",
    lead: "连读时还可能出现紧音化、鼻音化等变化。初学阶段先听懂常见词，不必一次背完所有术语。",
    tip: "先读原结构，再听实际读音：학·생 → 학쌩、국·물 → 궁물。",
    accent: "orange",
    items: [
      { value: "학생", sound: "학생", structure: "학 + 생 → 학쌩", hint: "[학쌩]｜学生" },
      { value: "학교", sound: "학교", structure: "학 + 교 → 학꾜", hint: "[학꾜]｜学校" },
      { value: "국물", sound: "국물", structure: "국 + 물 → 궁물", hint: "[궁물]｜汤汁" },
      { value: "한국말", sound: "한국말", structure: "국 + 말 → 궁말", hint: "[한궁말]｜韩语" },
      { value: "받는", sound: "받는", structure: "받 + 는 → 반는", hint: "[반는]｜接受的" },
      { value: "십년", sound: "십년", structure: "십 + 년 → 심년", hint: "[심년]｜十年" },
      { value: "독립", sound: "독립", structure: "독 + 립 → 동닙", hint: "[동닙]｜独立" },
      { value: "앞문", sound: "앞문", structure: "앞 + 문 → 암문", hint: "[암문]｜前门" },
    ],
  },
  {
    number: "18",
    section: "3.7 变音的基本原理",
    title: "变音不是乱变：相邻发音动作会互相“迁就”",
    lead: "韩语写法保留词的结构，实际说话则追求动作顺畅。当一个音节的收音和下一个音节的开头辅音相遇时，舌头或双唇如果需要快速换位置，声音就可能发生规律变化。拼写通常不变，变化的是实际读音。",
    tip: "先读写法，再看交界处：收音｜下一辅音。变音几乎都发生在这条边界上。不要一看到整个单词就猜，要先找到真正相遇的两个声音。",
    accent: "green",
    items: [
      { value: "학·교", sound: "학교", structure: "ㄱ｜ㄱ", hint: "两个舌根音相遇 → [학꾜]" },
      { value: "국·물", sound: "국물", structure: "ㄱ｜ㅁ", hint: "塞音遇鼻音 → [궁물]" },
      { value: "신·라", sound: "신라", structure: "ㄴ｜ㄹ", hint: "鼻音遇流音 → [실라]" },
      { value: "좋·다", sound: "좋다", structure: "ㅎ｜ㄷ", hint: "ㅎ 与 ㄷ 相遇 → [조타]" },
    ],
  },
  {
    number: "19",
    section: "3.7 紧音化",
    title: "紧音化：前面一收紧，后面的辅音也跟着绷紧",
    lead: "ㄱ、ㄷ、ㅂ 类收音后面遇到平音 ㄱ、ㄷ、ㅂ、ㅅ、ㅈ 时，后一个辅音经常变成紧音 ㄲ、ㄸ、ㅃ、ㅆ、ㅉ。前面的收音仍然存在，只是后一个音发得更紧、更短、更有力量。",
    tip: "记住变化发生在后一个辅音：학·교 的拼写不改，实际读成 [학·꾜]。不要把前面的收音丢掉。",
    accent: "orange",
    items: [
      { value: "학교", sound: "학교", structure: "ㄱ + ㄱ → ㄱ + ㄲ", hint: "[학꾜]｜学校" },
      { value: "학생", sound: "학생", structure: "ㄱ + ㅅ → ㄱ + ㅆ", hint: "[학쌩]｜学生" },
      { value: "식당", sound: "식당", structure: "ㄱ + ㄷ → ㄱ + ㄸ", hint: "[식땅]｜食堂" },
      { value: "국밥", sound: "국밥", structure: "ㄱ + ㅂ → ㄱ + ㅃ", hint: "[국빱]｜汤饭" },
      { value: "옷장", sound: "옷장", structure: "ㄷ + ㅈ → ㄷ + ㅉ", hint: "[옫짱]｜衣柜" },
      { value: "잡지", sound: "잡지", structure: "ㅂ + ㅈ → ㅂ + ㅉ", hint: "[잡찌]｜杂志" },
    ],
  },
  {
    number: "20",
    section: "3.7 鼻音化",
    title: "鼻音化：塞音遇到 ㄴ、ㅁ，会换成更顺口的鼻音",
    lead: "当 ㄱ、ㄷ、ㅂ 类收音后面接鼻音 ㄴ 或 ㅁ 时，为了不用突然切换口腔动作，前面的收音会分别靠近同一发音位置的鼻音：ㄱ 类变 ㅇ，ㄷ 类变 ㄴ，ㅂ 类变 ㅁ。后面的 ㄴ、ㅁ 通常保持不变。",
    tip: "把三组对应关系成对记：ㄱ→ㅇ、ㄷ→ㄴ、ㅂ→ㅁ。它们不是随意替换，而是在相近的发音位置上改成鼻音。",
    accent: "green",
    items: [
      { value: "국물", sound: "국물", structure: "ㄱ + ㅁ → ㅇ + ㅁ", hint: "[궁물]｜汤汁" },
      { value: "한국말", sound: "한국말", structure: "ㄱ + ㅁ → ㅇ + ㅁ", hint: "[한궁말]｜韩语" },
      { value: "받는", sound: "받는", structure: "ㄷ + ㄴ → ㄴ + ㄴ", hint: "[반는]｜接受的" },
      { value: "몇 명", sound: "몇 명", structure: "ㄷ + ㅁ → ㄴ + ㅁ", hint: "[면 명]｜几个人" },
      { value: "십년", sound: "십년", structure: "ㅂ + ㄴ → ㅁ + ㄴ", hint: "[심년]｜十年" },
      { value: "앞문", sound: "앞문", structure: "ㅂ + ㅁ → ㅁ + ㅁ", hint: "[암문]｜前门" },
    ],
  },
  {
    number: "21",
    section: "3.7 流音化与送气音化",
    title: "ㄴ、ㄹ相遇会靠拢；ㅎ相遇则常把后音“吹起来”",
    lead: "ㄴ 和 ㄹ 相邻时，常一起读成流音 ㄹ，舌尖动作因此更连贯，这叫流音化。另一方面，ㅎ 与 ㄱ、ㄷ、ㅂ、ㅈ 相遇时，常合成送气音 ㅋ、ㅌ、ㅍ、ㅊ；复收音里的 ㅎ 也可能产生同样影响。",
    tip: "综合判断时按顺序来：先处理收音代表音或复收音，再观察下一辅音，最后判断是否发生流音化、送气音化、鼻音化或紧音化。",
    accent: "orange",
    items: [
      { value: "신라", sound: "신라", structure: "ㄴ + ㄹ → ㄹ + ㄹ", hint: "[실라]｜新罗" },
      { value: "설날", sound: "설날", structure: "ㄹ + ㄴ → ㄹ + ㄹ", hint: "[설랄]｜春节" },
      { value: "연락", sound: "연락", structure: "ㄴ + ㄹ → ㄹ + ㄹ", hint: "[열락]｜联系" },
      { value: "좋다", sound: "좋다", structure: "ㅎ + ㄷ → ㅌ", hint: "[조타]｜好" },
      { value: "놓고", sound: "놓고", structure: "ㅎ + ㄱ → ㅋ", hint: "[노코]｜放下后" },
      { value: "입학", sound: "입학", structure: "ㅂ + ㅎ → ㅍ", hint: "[이팍]｜入学" },
      { value: "많다", sound: "많다", structure: "ㄶ + ㄷ → ㄴ + ㅌ", hint: "[만타]｜多" },
      { value: "싫다", sound: "싫다", structure: "ㅀ + ㄷ → ㄹ + ㅌ", hint: "[실타]｜讨厌" },
    ],
  },
  {
    number: "22",
    section: "3.7 拼读步骤训练",
    title: "看底部、找代表音、判断连音、完整拼读",
    lead: "完成本章前，用三个步骤检查自己：找到收音位置，说出代表音，再把整个音节或词语读出来。",
    tip: "先遮住结构提示自己拼读，再点击卡片听示范音核对。",
    accent: "green",
    items: [
      { value: "산", sound: "산", structure: "ㄴ 收音", hint: "舌尖鼻音" },
      { value: "옷", sound: "옷", structure: "ㄷ 类收音", hint: "短促 t 收尾" },
      { value: "밥", sound: "밥", structure: "ㅂ 收音", hint: "双唇收住" },
      { value: "공", sound: "공", structure: "ㅇ 收音", hint: "ng 鼻音" },
      { value: "한국", sound: "한국", structure: "ㄴ + ㄱ", hint: "两个收音音节" },
      { value: "학생", sound: "학생", structure: "ㄱ + ㅇ", hint: "分块拼读" },
      { value: "읽어", sound: "읽어", structure: "复收音 + 连音", hint: "[일거]｜读" },
      { value: "먹어요", sound: "먹어요", structure: "连音", hint: "[머거요]｜吃" },
    ],
  },
  {
    number: "23",
    section: "3.7 塞音收尾训练",
    title: "ㄱ、ㄷ、ㅂ：不要爆破，也不要补元音",
    lead: "三个塞音代表音的共同点是“做到位置就停止”。ㄱ 在舌根，ㄷ 在舌尖，ㅂ 在双唇。末尾不能像开头辅音那样重新把气放出来。",
    tip: "用纸片放在嘴前练习。正确读收音时，纸片不应该被最后一股气明显吹动。",
    accent: "orange",
    items: [
      { value: "목", sound: "목", structure: "ㄱ · [mok̚]", hint: "脖子" },
      { value: "약", sound: "약", structure: "ㄱ · [jak̚]", hint: "药" },
      { value: "빛", sound: "빛", structure: "ㄷ 类 · [pit̚]", hint: "光" },
      { value: "낮", sound: "낮", structure: "ㄷ 类 · [nat̚]", hint: "白天" },
      { value: "입", sound: "입", structure: "ㅂ · [ip̚]", hint: "嘴" },
      { value: "숲", sound: "숲", structure: "ㅂ 类 · [sup̚]", hint: "树林" },
      { value: "부엌", sound: "부엌", structure: "ㅋ → ㄱ 类", hint: "[부억]｜厨房" },
      { value: "끝", sound: "끝", structure: "ㅌ → ㄷ 类", hint: "[끋]｜结束" },
    ],
  },
  {
    number: "24",
    section: "3.7 鼻音与流音训练",
    title: "ㄴ、ㄹ、ㅁ、ㅇ：让声音从正确的位置结束",
    lead: "这四类收音不会像塞音一样突然切断。ㄴ、ㅁ、ㅇ带有鼻腔共鸣，ㄹ则让舌尖保持接触。动作做对，声音自然就会稳定。",
    tip: "按 산—살—삼—상 的顺序读，保持元音相同，只改变最后的收音动作。",
    accent: "green",
    items: [
      { value: "산", sound: "산", structure: "ㄴ · [san]", hint: "山" },
      { value: "손", sound: "손", structure: "ㄴ · [son]", hint: "手" },
      { value: "살", sound: "살", structure: "ㄹ · [sal]", hint: "肉、岁" },
      { value: "물", sound: "물", structure: "ㄹ · [mul]", hint: "水" },
      { value: "삼", sound: "삼", structure: "ㅁ · [sam]", hint: "三" },
      { value: "봄", sound: "봄", structure: "ㅁ · [pom]", hint: "春天" },
      { value: "상", sound: "상", structure: "ㅇ · [saŋ]", hint: "桌子、奖" },
      { value: "방", sound: "방", structure: "ㅇ · [paŋ]", hint: "房间" },
    ],
  },
  {
    number: "25",
    section: "3.7 复收音辨读训练",
    title: "两个字母都看见，但单独收尾时通常只读一个",
    lead: "复收音的难点不是字母多，而是要知道当前环境下保留哪一个声音。先把常见词作为整体记住，再逐步归纳规则。",
    tip: "比较同一个词的不同形式：읽다 [익따]，但 읽어 [일거]。后面是否接元音，会改变字母的去向。",
    accent: "orange",
    items: [
      { value: "읽", sound: "읽", structure: "ㄺ → ㄱ", hint: "[익]｜读的词干" },
      { value: "삶", sound: "삶", structure: "ㄻ → ㅁ", hint: "[삼]｜生活" },
      { value: "넓", sound: "넓", structure: "ㄼ → ㄹ/ㅂ", hint: "[널]｜宽的词干" },
      { value: "값", sound: "값", structure: "ㅄ → ㅂ", hint: "[갑]｜价格" },
      { value: "앉", sound: "앉", structure: "ㄵ → ㄴ", hint: "[안]｜坐的词干" },
      { value: "많", sound: "많", structure: "ㄶ → ㄴ", hint: "[만]｜多的词干" },
      { value: "싫", sound: "싫", structure: "ㅀ → ㄹ", hint: "[실]｜讨厌的词干" },
      { value: "없", sound: "없", structure: "ㅄ → ㅂ", hint: "[업]｜没有的词干" },
    ],
  },
  {
    number: "26",
    section: "3.7 连音拼读训练",
    title: "把收音搬过去，再从下一音节重新起音",
    lead: "连音不是把两个音节胡乱黏在一起，而是把前一音节的收音移到后一个元音前。字母顺序没有消失，只是重新分配了音节边界。",
    tip: "先写出原结构，再画箭头移动收音：먹·어 → 머·거。",
    accent: "green",
    items: [
      { value: "먹어", sound: "먹어", structure: "먹·어 → 머·거", hint: "[머거]｜吃吧" },
      { value: "받아", sound: "받아", structure: "받·아 → 바·다", hint: "[바다]｜接受吧" },
      { value: "문을", sound: "문을", structure: "문·을 → 무·늘", hint: "[무늘]｜门（宾格）" },
      { value: "물을", sound: "물을", structure: "물·을 → 무·를", hint: "[무를]｜水（宾格）" },
      { value: "방에", sound: "방에", structure: "방·에 → 방·에", hint: "[방에]｜在房间" },
      { value: "집에", sound: "집에", structure: "집·에 → 지·베", hint: "[지베]｜在家" },
      { value: "한국인", sound: "한국인", structure: "국·인 → 구·긴", hint: "[한구긴]｜韩国人" },
      { value: "음악을", sound: "음악을", structure: "악·을 → 아·글", hint: "[으마글]｜音乐（宾格）" },
    ],
  },
  {
    number: "27",
    section: "3.7 基础音变专项",
    title: "声音会互相影响，但变化不是没有规律",
    lead: "相邻辅音为了更容易发音，可能出现紧音化或鼻音化。先认识高频词的实际读音，再在后续章节系统学习完整规则。",
    tip: "这一页以“听懂变化”为目标，不要求马上默写所有音变名称。",
    accent: "orange",
    items: [
      { value: "학교", sound: "학교", structure: "ㄱ + ㄱ → ㄱㄲ", hint: "[학꾜]｜学校" },
      { value: "학생", sound: "학생", structure: "ㄱ + ㅅ → ㄱㅆ", hint: "[학쌩]｜学生" },
      { value: "식당", sound: "식당", structure: "ㄱ + ㄷ → ㄱㄸ", hint: "[식땅]｜食堂" },
      { value: "국밥", sound: "국밥", structure: "ㄱ + ㅂ → ㄱㅃ", hint: "[국빱]｜汤饭" },
      { value: "국물", sound: "국물", structure: "ㄱ + ㅁ → ㅇㅁ", hint: "[궁물]｜汤汁" },
      { value: "십년", sound: "십년", structure: "ㅂ + ㄴ → ㅁㄴ", hint: "[심년]｜十年" },
      { value: "받는", sound: "받는", structure: "ㄷ + ㄴ → ㄴㄴ", hint: "[반는]｜接受的" },
      { value: "독립", sound: "독립", structure: "ㄱ + ㄹ → ㅇㄴ", hint: "[동닙]｜独立" },
    ],
  },
  {
    number: "28",
    section: "3.8 词语自然拼读",
    title: "从一个音节读到生活中的完整词语",
    lead: "真正的目标不是背规则名称，而是看到词语后能按结构读出来。先慢速分块，再听实际读音，最后连贯复述。",
    tip: "每个词按“看结构—自己读—听示范—再读一次”的顺序完成。",
    accent: "green",
    items: [
      { value: "한국말", sound: "한국말", structure: "한·국·말", hint: "[한궁말]｜韩语" },
      { value: "학생", sound: "학생", structure: "학·생", hint: "[학쌩]｜学生" },
      { value: "선생님", sound: "선생님", structure: "선·생·님", hint: "[선생님]｜老师" },
      { value: "음식", sound: "음식", structure: "음·식", hint: "[음식]｜食物" },
      { value: "책상", sound: "책상", structure: "책·상", hint: "[책쌍]｜书桌" },
      { value: "한국인", sound: "한국인", structure: "한·국·인", hint: "[한구긴]｜韩国人" },
      { value: "저녁밥", sound: "저녁밥", structure: "저·녁·밥", hint: "[저녁빱]｜晚饭" },
      { value: "음악실", sound: "음악실", structure: "음·악·실", hint: "[음악씰]｜音乐教室" },
    ],
  },
  {
    number: "29",
    section: "3.8 综合复习",
    title: "四步完成收音拼读：找、分、判、读",
    lead: "先找收音，再分音节结构，判断代表音或连音环境，最后读出完整词语。能够稳定完成这四步，本章目标就真正达成了。",
    tip: "随机点击卡片前，先说出它属于哪种情况：普通收音、复收音、连音还是基础音变。",
    accent: "green",
    items: [
      { value: "책", sound: "책", structure: "普通收音", hint: "ㄱ 类｜书" },
      { value: "옷", sound: "옷", structure: "普通收音", hint: "ㄷ 类｜衣服" },
      { value: "삶", sound: "삶", structure: "复收音", hint: "ㄻ → ㅁ｜生活" },
      { value: "읽어", sound: "읽어", structure: "复收音 + 连音", hint: "[일거]｜读" },
      { value: "밥을", sound: "밥을", structure: "连音", hint: "[바블]｜米饭（宾格）" },
      { value: "한국어", sound: "한국어", structure: "连音", hint: "[한구거]｜韩语" },
      { value: "학생", sound: "학생", structure: "紧音化", hint: "[학쌩]｜学生" },
      { value: "국물", sound: "국물", structure: "鼻音化", hint: "[궁물]｜汤汁" },
    ],
  },
];

const Page = forwardRef<HTMLDivElement, PageProps>(function Page(
  { children, cover = false, goals = false, header, number },
  ref
) {
  return (
    <div ref={ref} className={`h-full overflow-hidden shadow-[inset_0_0_28px_rgba(57,78,67,0.08)] ${
      goals ? "bg-[linear-gradient(145deg,#edf8f3_0%,#e4f3ed_100%)]" : "bg-[#fffef9]"
    }`}>
      {cover ? children : (
        <div className="flex h-full flex-col px-9 py-8">
          <div className={`flex items-center justify-between border-b pb-3 text-[11px] font-black tracking-[0.12em] ${
            goals ? "border-[#bedbce]" : "border-[#dce8e1]"
          }`}>
            <span className="text-[#238777]">{header}</span>
            <span className="text-[#789087]">第三章 · 收音与拼读</span>
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

function LessonContent({ page, onSpeak }: { page: LessonPage; onSpeak: (text: string) => void }) {
  const green = page.accent === "green";
  return (
    <div className="flex h-full flex-col">
      <h2 className="text-3xl font-black leading-tight text-[#173f4a]">{page.title}</h2>
      <p className="mt-4 text-sm leading-7 text-[#60736a]">{page.lead}</p>
      <div className={`mt-5 grid flex-1 content-center gap-3 ${page.items.length >= 6 ? "grid-cols-3" : "grid-cols-2"}`}>
        {page.items.map((item) => (
          <button
            key={`${page.number}-${item.value}`}
            type="button"
            onClick={() => onSpeak(item.sound)}
            className={`rounded-[22px] border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
              green ? "border-[#d5e7df] hover:border-[#72b7a7]" : "border-[#eadfce] hover:border-[#d6975f]"
            }`}
          >
            <span className="flex items-start justify-between gap-2">
              <span className={`text-4xl font-black ${green ? "text-[#238777]" : "text-[#9b5e2e]"}`}>{item.value}</span>
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

export function BatchimReadingBook({
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
    let animationFrame = 0;
    const resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        setBookScale(isFullscreen ? MAX_BOOK_SCALE : 1);
        flipBookRef.current?.pageFlip()?.update();
      });
    });
    resizeObserver.observe(container);
    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, [isFullscreen]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") flipBookRef.current?.pageFlip()?.flipPrev();
      if (event.key === "ArrowRight") flipBookRef.current?.pageFlip()?.flipNext();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
              <div className="relative flex h-full flex-col justify-between overflow-hidden bg-[radial-gradient(circle_at_top_right,_#d8f0e7_0,_transparent_32%),linear-gradient(145deg,_#fffef9_0%,_#e8f6f0_100%)] px-10 py-11 text-center">
                <div aria-hidden="true" className="absolute bottom-0 left-0 right-0 h-[40%] bg-[#173f4a]" />
                <div className="relative"><p className="text-2xl font-black tracking-[0.22em] text-[#b87131]">韩语字母入门</p><div className="mx-auto mt-2 h-px w-48 bg-[#cfe2d9]" /></div>
                <div className="relative">
                  <p className="text-base font-black tracking-[0.16em] text-[#238777]">第三章</p>
                  <h1 className="mt-5 text-5xl font-black tracking-tight text-[#173f4a]">收音与拼读</h1>
                  <p className="mt-4 text-lg font-bold text-[#60736a]">看清底部，完整读出音节</p>
                  <p className="mx-auto mt-7 max-w-sm text-base leading-8 text-[#60736a]">认识收音位置与代表音，从单个音节稳步读到简单词语。</p>
                  <div className="mt-16 flex justify-center gap-4">
                    {["가", "ㄱ", "각"].map((letter, index) => <span key={letter} className={`flex h-16 w-16 items-center justify-center rounded-2xl text-3xl font-black ${index === 2 ? "bg-[#238777] text-white" : "bg-white text-[#238777] shadow-sm ring-1 ring-[#d7e8e1]"}`}>{letter}</span>)}
                  </div>
                </div>
                <div className="relative flex items-center justify-between text-sm font-bold text-white/80"><span className="inline-flex items-center gap-2"><Headphones size={16} />互动电子书</span><span>28 个学习主题</span></div>
              </div>
            </Page>

            <Page number="00" header="目录">
              <div className="flex h-full flex-col justify-center text-center">
                <p className="text-xs font-black tracking-[0.18em] text-[#238777]">CHAPTER 03</p>
                <h2 className="mt-3 text-3xl font-black text-[#173f4a]">目录</h2>
                <ol className="mt-5 divide-y divide-[#e5ece7] rounded-2xl border border-[#dce8e1] bg-white px-5 py-2 text-left">
                  {[
                    [1, "本章学习目标"],
                    [2, "3.1 收音与拼读导读"],
                    [6, "3.2 音节结构与不爆破"],
                    [7, "3.3 七大代表收音"],
                    [10, "3.4 同字母双收音"],
                    [11, "3.5 异字母复收音"],
                    [16, "3.6 连音现象"],
                    [17, "3.7 自然拼读与基础音变"],
                    [28, "3.8 本章小结与应用"],
                  ].map(([pageNumber, title]) => (
                    <li key={pageNumber}><button type="button" onClick={() => flipBookRef.current?.pageFlip()?.flip(Number(pageNumber) + 1)} className="flex w-full items-center justify-between py-3 text-left text-sm font-bold text-[#526c60] transition hover:text-[#238777]"><span>{title}</span><span className="font-black text-[#238777]">{String(pageNumber).padStart(2, "0")}</span></button></li>
                  ))}
                </ol>
              </div>
            </Page>

            <Page number="01" header="本章学习目标" goals>
              <div className="flex h-full flex-col">
                <p className="text-xs font-black tracking-[0.18em] text-[#238777]">CHAPTER 03 · GOALS</p>
                <h2 className="mt-3 text-3xl font-black text-[#173f4a]">学完这一章，你将能够</h2>
                <p className="mt-4 text-sm leading-7 text-[#60736a]">把音节底部的字母转化为清楚的发音动作，并建立从音节结构到词语拼读的完整路径。</p>
                <div className="mt-7 grid flex-1 content-center gap-4">
                  {[
                    ["01", "识别收音位置", "能快速判断音节是否带收音，并按正确顺序拆分结构。"],
                    ["02", "掌握七个代表音", "能用发音部位和动作区分常见收音类别。"],
                    ["03", "完成词语拼读", "能逐个读清音节方块，再自然连接成简单词语。"],
                  ].map(([number, title, description]) => (
                    <section key={number} className="grid grid-cols-[54px_1fr] gap-4 rounded-[22px] border border-[#dce8e1] bg-white p-5"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e7f4ef] text-sm font-black text-[#238777]">{number}</span><div><h3 className="text-base font-black text-[#294f43]">{title}</h3><p className="mt-1 text-xs leading-6 text-[#71857b]">{description}</p></div></section>
                  ))}
                </div>
                <div className="mt-6 rounded-2xl bg-[#fff3e3] p-4 text-sm font-bold leading-6 text-[#765c49]">阅读建议：每个词先拆成音节方块慢读，再点击卡片听示范音。</div>
              </div>
            </Page>

            {LESSON_PAGES.map((page) => <Page key={page.number} number={page.number} header={page.section}><LessonContent page={page} onSpeak={speakKorean} /></Page>)}

            <Page number="30" header="本章结束">
              <div className="relative flex h-full flex-col items-center justify-center overflow-hidden text-center">
                <div aria-hidden="true" className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#e4f3ed]" /><div aria-hidden="true" className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-[#fff0dc]" />
                <div className="relative">
                  <p className="text-sm font-black tracking-[0.2em] text-[#b87131]">CHAPTER 03 COMPLETE</p>
                  <h2 className="mt-5 text-4xl font-black text-[#173f4a]">收音与拼读学习完成</h2>
                  <p className="mx-auto mt-5 max-w-md text-base leading-8 text-[#60736a]">你已经认识收音位置、七个代表音和基础拼读顺序。接下来进入本章测试检查学习成果。</p>
                  <div className="mx-auto mt-9 grid max-w-md grid-cols-3 gap-3">{[["한", "ㄴ 收音"], ["밥", "ㅂ 收音"], ["공", "ㅇ 收音"]].map(([value, label]) => <div key={value} className="rounded-2xl border border-[#d8e7e0] bg-white p-4 shadow-sm"><p className="text-3xl font-black text-[#238777]">{value}</p><p className="mt-2 text-xs font-bold text-[#789087]">{label}</p></div>)}</div>
                  <button type="button" onClick={onStartTest} className="mt-10 rounded-2xl bg-[#238777] px-8 py-4 text-base font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#1d7468]">进入本章测试</button>
                  <p className="mt-4 text-xs font-bold text-[#8a9b93]">完成测试后将解锁下一章</p>
                </div>
              </div>
            </Page>

          </HTMLFlipBook>
        </div>
      </div>
    </section>
  );
}
