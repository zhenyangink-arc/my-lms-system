/**
 * 共享智能教材骨架。
 *
 * 这里只描述稳定的学习流程和数据插槽，不保存任何章节专属的人物、句子、
 * 图片、题目或答案。第 2—16 章沿用相同 module code，并用各章数据库内容
 * 填充对应插槽，即可复用分页、导航、进度和完成态。
 */
export const SMART_TEXTBOOK_SHARED_SKELETON = {
  orientation: {
    pages: ["scene", "diagnosis"],
    pageLabels: [{ "zh-CN": "情景与表达", "ko-KR": "장면과 표현" }, { "zh-CN": "情景诊断", "ko-KR": "장면 진단" }],
    contentSlots: ["lead", "targets", "dialogueGroups"],
    activitySlots: ["diagnostic"],
  },
  vocabulary: {
    pages: ["scene_and_words", "vocabulary_practice"],
    pageLabels: [{ "zh-CN": "情景与表达", "ko-KR": "장면과 표현" }, { "zh-CN": "情景诊断", "ko-KR": "장면 진단" }],
    contentSlots: ["lead", "vocabulary", "dialogueGroups"],
    activitySlots: ["vocabulary_check"],
  },
  grammar: {
    pages: ["grammar_explanation", "grammar_practice"],
    pageLabels: [{ "zh-CN": "语法理解", "ko-KR": "문법 이해" }, { "zh-CN": "语法练习", "ko-KR": "문법 연습" }],
    contentSlots: ["lead", "rules", "grammarCards", "contrast"],
    activitySlots: ["grammar_practice"],
  },
  patterns: {
    pages: ["pattern_library", "guided_substitution", "combined_output"],
    pageLabels: [{ "zh-CN": "句型库", "ko-KR": "문형 모음" }, { "zh-CN": "替换操练", "ko-KR": "대치 연습" }, { "zh-CN": "组合输出", "ko-KR": "조합과 출력" }],
    contentSlots: ["pattern", "patternCards", "substitutionGroups", "quickResponse", "personalOutput"],
    activitySlots: ["guided_choice", "ordering", "composition"],
  },
  dialogue: {
    pages: ["dialogue_guide", "scene_dialogue", "comprehension", "roleplay"],
    pageLabels: [{ "zh-CN": "对话说明", "ko-KR": "대화 안내" }, { "zh-CN": "场景切换", "ko-KR": "장면 대화" }, { "zh-CN": "理解与回应", "ko-KR": "이해와 응답" }, { "zh-CN": "角色实战", "ko-KR": "역할 실전" }],
    contentSlots: ["lead", "dialogueScenes", "dialogueFlow"],
    activitySlots: ["fact_check", "response", "roleplay"],
  },
  listen_speak: {
    pages: ["listening_preparation", "listening_comprehension", "shadowing", "independent_speaking"],
    pageLabels: [{ "zh-CN": "听前准备", "ko-KR": "듣기 준비" }, { "zh-CN": "听辨信息", "ko-KR": "정보 듣기" }, { "zh-CN": "跟读复现", "ko-KR": "따라 말하기" }, { "zh-CN": "独立表达", "ko-KR": "독립 말하기" }],
    contentSlots: ["listeningContext", "listeningFocus", "repeatTracks", "repeatLines", "outputChecklist"],
    activitySlots: ["listening", "speaking"],
  },
  read_write: {
    pages: ["reading_source", "reading_comprehension", "writing_scaffold", "independent_writing"],
    pageLabels: [{ "zh-CN": "阅读资料", "ko-KR": "읽기 자료" }, { "zh-CN": "信息理解", "ko-KR": "정보 이해" }, { "zh-CN": "写作搭建", "ko-KR": "쓰기 구성" }, { "zh-CN": "独立写作", "ko-KR": "독립 쓰기" }],
    contentSlots: ["lead", "reading", "questions", "writingFrame", "rubric", "originalExample"],
    activitySlots: ["reading", "writing"],
    completionWeights: [50, 50],
  },
  review: {
    pages: ["comprehensive_check", "can_do_check", "review_result"],
    pageLabels: [{ "zh-CN": "综合自测", "ko-KR": "종합 점검" }, { "zh-CN": "能力自查", "ko-KR": "능력 점검" }, { "zh-CN": "复盘结果", "ko-KR": "복습 결과" }],
    contentSlots: ["lead", "checklist", "returnMap", "coach"],
    activitySlots: ["multiple_choice", "self_check"],
    completionWeights: [50, 50],
  },
} as const;

/**
 * 所有章节共用的教学界面结构。这里保存布局与状态切换规则，不保存章节内容。
 */
export const SMART_TEXTBOOK_SHARED_LEARNING_LAYOUT = {
  teachingArea: {
    defaultWidthPercent: 30,
    collapsedWidthPx: 64,
    focusedContentMaxWidthPx: 920,
  },
  blackboard: {
    minimumHeightPx: 768,
  },
  learningHeader: {
    heightPx: 56,
    contentInsetPx: 48,
  },
  focusMode: {
    hideLearningAreaDuringTeacherScript: true,
    revealForActivityAction: "focus_activity",
  },
} as const;

export type SmartTextbookSkeletonLocale = "zh-CN" | "ko-KR";

export type SmartTextbookSkeletonModuleCode = keyof typeof SMART_TEXTBOOK_SHARED_SKELETON;

export function isSmartTextbookSkeletonModuleCode(value: string): value is SmartTextbookSkeletonModuleCode {
  return value in SMART_TEXTBOOK_SHARED_SKELETON;
}

export function getSmartTextbookSkeletonModule(value: string) {
  return isSmartTextbookSkeletonModuleCode(value)
    ? SMART_TEXTBOOK_SHARED_SKELETON[value]
    : null;
}

export function getSmartTextbookSkeletonPageLabels(value: string, locale: SmartTextbookSkeletonLocale) {
  const skeletonModule = getSmartTextbookSkeletonModule(value);
  return skeletonModule ? skeletonModule.pageLabels.map((label) => label[locale]) : [];
}

export function shouldUseSmartTextbookTeachingFocusMode(input: {
  tutorStarted: boolean;
  answerRequired: boolean;
  action: string | null;
  hasPendingLearningTask: boolean;
}) {
  if (!SMART_TEXTBOOK_SHARED_LEARNING_LAYOUT.focusMode.hideLearningAreaDuringTeacherScript) return false;
  return input.tutorStarted
    && !input.answerRequired
    && input.action !== SMART_TEXTBOOK_SHARED_LEARNING_LAYOUT.focusMode.revealForActivityAction
    && !input.hasPendingLearningTask;
}
