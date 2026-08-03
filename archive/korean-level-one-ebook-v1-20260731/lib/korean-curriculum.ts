export type KoreanBeginnerLesson = {
  title: string;
  description: string;
  stage: string;
  focus: string;
};

export type HangulIntroductionChapter = {
  slug: string;
  title: string;
  koreanTitle: string;
  description: string;
  focus: string[];
  durationMinutes: number;
};

const allHangulIntroductionChapters: HangulIntroductionChapter[] = [
  {
    slug: "meet-hangul",
    title: "认识韩文",
    koreanTitle: "한글 알아보기",
    description: "了解韩文的创制背景、书写方向，以及字母组合成音节方块的基本方式。",
    focus: ["韩文结构", "书写顺序", "音节方块"],
    durationMinutes: 12,
  },
  {
    slug: "basic-vowels",
    title: "基本元音",
    koreanTitle: "기본 모음",
    description: "掌握常用基本元音的字形、发音口型与书写方法。",
    focus: ["ㅏ ㅓ ㅗ ㅜ", "ㅡ ㅣ", "口型练习"],
    durationMinutes: 20,
  },
  {
    slug: "basic-consonants",
    title: "基本辅音",
    koreanTitle: "기본 자음",
    description: "认识基础辅音，并通过发音部位理解清音、送气音等差异。",
    focus: ["辅音字形", "发音部位", "听辨练习"],
    durationMinutes: 24,
  },
  {
    slug: "syllable-building",
    title: "音节拼读",
    koreanTitle: "글자 조합과 읽기",
    description: "把辅音和元音组合成完整音节，练习看字即读与听音选字。",
    focus: ["辅音＋元音", "音节组合", "拼读训练"],
    durationMinutes: 22,
  },
  {
    slug: "batchim-review",
    title: "收音入门与复习",
    koreanTitle: "받침과 복습",
    description: "初步认识收音位置，复习本课字母并完成综合拼读挑战。",
    focus: ["收音位置", "基础规则", "综合复习"],
    durationMinutes: 18,
  },
];

export const hangulIntroductionChapters = allHangulIntroductionChapters
  .slice(0, 4)
  .map((chapter, index) =>
    index === 1
      ? {
          ...chapter,
          slug: "vowels-and-consonants",
          title: "元音和辅音",
          koreanTitle: "모음과 자음",
          description:
            "通过独立电子书学习基本元音、复合元音、基础辅音、送气音和紧音，并练习把字母组合成音节。",
          focus: ["元音口型", "辅音动作", "音节组合"],
          durationMinutes: 35,
        }
      : index === 2
        ? {
            ...chapter,
            slug: "batchim-and-reading",
            title: "收音与拼读",
            koreanTitle: "받침과 읽기",
            description:
              "认识收音的位置和常见代表音，练习从单个音节读到简单词语，建立完整的韩语拼读顺序。",
            focus: ["收音位置", "代表音", "音节拼读"],
            durationMinutes: 40,
          }
        : index === 3
          ? {
              ...chapter,
              slug: "pronunciation-rules-and-reading",
              title: "发音规则与实用拼读",
              koreanTitle: "발음 규칙과 읽기",
              description:
                "系统掌握连音、紧音化、激音化、鼻音化、流音化等高频规则，并在问候、数字和自我介绍中完成实用拼读。",
              focus: ["高频音变", "规则判断", "生活拼读"],
              durationMinutes: 70,
            }
        : chapter
  );

const koreanBeginnerLessons: Record<string, KoreanBeginnerLesson> = {
  "hangul-introduction": {
    title: "韩语字母入门",
    description: "从韩文字母的构成开始，建立元音、辅音与音节拼读的第一层基础。",
    stage: "字母启蒙",
    focus: "看懂 · 会读 · 会拼",
  },
  "basic-pronunciation": {
    title: "韩国语1级",
    description: "进入基础词汇、句型和生活表达，完成从发音到简单沟通的过渡。",
    stage: "基础表达",
    focus: "词汇 · 句型 · 对话",
  },
  "daily-greetings": {
    title: "韩国语2级",
    description: "扩展日常场景表达与基础语法，为后续中级韩语学习做好衔接。",
    stage: "能力进阶",
    focus: "语法 · 场景 · 运用",
  },
};

export function getKoreanBeginnerLesson(slug: string) {
  return koreanBeginnerLessons[slug] ?? null;
}
