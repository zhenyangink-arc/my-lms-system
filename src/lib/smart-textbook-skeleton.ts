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
    contentSlots: ["lead", "targets", "dialogueGroups"],
    activitySlots: ["diagnostic"],
  },
  vocabulary: {
    pages: ["scene_and_words", "vocabulary_practice"],
    contentSlots: ["lead", "vocabulary", "dialogueGroups"],
    activitySlots: ["vocabulary_check"],
  },
  grammar: {
    pages: ["grammar_explanation", "grammar_practice"],
    contentSlots: ["lead", "rules", "grammarCards", "contrast"],
    activitySlots: ["grammar_practice"],
  },
  patterns: {
    pages: ["pattern_library", "guided_substitution", "combined_output"],
    contentSlots: ["pattern", "patternCards", "substitutionGroups", "quickResponse", "personalOutput"],
    activitySlots: ["guided_choice", "ordering", "composition"],
  },
  dialogue: {
    pages: ["dialogue_guide", "scene_dialogue", "comprehension", "roleplay"],
    contentSlots: ["lead", "dialogueScenes", "dialogueFlow"],
    activitySlots: ["fact_check", "response", "roleplay"],
  },
  listen_speak: {
    pages: ["listening_preparation", "listening_comprehension", "shadowing", "independent_speaking"],
    contentSlots: ["listeningContext", "listeningFocus", "repeatTracks", "repeatLines", "outputChecklist"],
    activitySlots: ["listening", "speaking"],
  },
  read_write: {
    pages: ["reading_source", "reading_comprehension", "writing_scaffold", "independent_writing"],
    contentSlots: ["lead", "reading", "questions", "writingFrame", "rubric", "originalExample"],
    activitySlots: ["reading", "writing"],
    completionWeights: [50, 50],
  },
  review: {
    pages: ["comprehensive_check", "can_do_check", "review_result"],
    contentSlots: ["lead", "checklist", "returnMap", "coach"],
    activitySlots: ["multiple_choice", "self_check"],
    completionWeights: [50, 50],
  },
} as const;

export type SmartTextbookSkeletonModuleCode = keyof typeof SMART_TEXTBOOK_SHARED_SKELETON;

export function isSmartTextbookSkeletonModuleCode(value: string): value is SmartTextbookSkeletonModuleCode {
  return value in SMART_TEXTBOOK_SHARED_SKELETON;
}

export function getSmartTextbookSkeletonModule(value: string) {
  return isSmartTextbookSkeletonModuleCode(value)
    ? SMART_TEXTBOOK_SHARED_SKELETON[value]
    : null;
}
