import type {
  ChapterPracticeBlockType,
  ChapterPracticeCompletionRule,
  ChapterPracticePublishCheck,
  ChapterPracticePublishInspection,
} from "./types";

export const REQUIRED_CHAPTER_PRACTICE_BLOCKS = [
  "overview",
  "vocabulary",
  "grammar",
  "review",
  "self_check",
] as const satisfies readonly ChapterPracticeBlockType[];

export const CHAPTER_PRACTICE_BLOCK_LABELS: Record<
  ChapterPracticeBlockType,
  string
> = {
  overview: "本章快速回顾",
  vocabulary: "核心词汇复习",
  grammar: "核心语法复习",
  comparison: "易混内容对比",
  listening: "听力练习",
  speaking: "口语练习",
  reading: "阅读练习",
  writing: "写作练习",
  interaction: "字母拼合互动",
  review: "本章复习",
  self_check: "自我检测",
};

export const DEFAULT_CHAPTER_PRACTICE_INSTRUCTIONS: Record<
  ChapterPracticeBlockType,
  string
> = {
  overview: "先回顾本章目标与重点，再开始练习。",
  vocabulary: "复习本章核心词汇，并完成对应练习。",
  grammar: "复习本章核心语法，并完成对应练习。",
  comparison: "对照容易混淆的内容，留意使用条件和常见错误。",
  listening: "根据听力材料完成练习，提交前检查作答。",
  speaking: "根据题目要求完成口头表达练习。",
  reading: "阅读材料后完成理解练习。",
  writing: "根据题目要求完成书面表达练习。",
  interaction: "完成拼装、拆解、纠错和分类互动，巩固音节结构。",
  review: "回顾本章重点，并查看仍需加强的内容。",
  self_check: "完成检测，确认本章内容是否达到完成要求。",
};

export function defaultCompletionRule(
  requiredBlockCount: number,
): ChapterPracticeCompletionRule {
  return {
    mode: "required_blocks",
    minimumRequiredBlocks: Math.max(1, requiredBlockCount),
    requireSelfCheck: true,
    minimumAccuracyPercent: 80,
  };
}

export function parseCompletionRule(
  value: unknown,
): ChapterPracticeCompletionRule {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    mode: "required_blocks",
    minimumRequiredBlocks: Math.max(
      1,
      Math.trunc(Number(record.minimumRequiredBlocks) || 1),
    ),
    requireSelfCheck: record.requireSelfCheck !== false,
    minimumAccuracyPercent: Math.min(
      100,
      Math.max(0, Number(record.minimumAccuracyPercent) || 80),
    ),
  };
}

export type PublishInspectionInput = {
  hierarchyPublished: boolean;
  unitTitle: string;
  completionRule: ChapterPracticeCompletionRule;
  blocks: Array<{
    id: string;
    blockType: ChapterPracticeBlockType;
    title: string;
    instructions: string;
    sortOrder: number;
    isRequired: boolean;
    enabled: boolean;
    sourceValid: boolean;
    objectiveJudgementValid: boolean;
    referenceValid: boolean;
    audioStatus: string | null;
  }>;
};

function check(
  code: string,
  label: string,
  reasons: string[],
): ChapterPracticePublishCheck {
  return { code, label, passed: reasons.length === 0, reasons };
}

export function inspectChapterPracticePublication(
  input: PublishInspectionInput,
): ChapterPracticePublishInspection {
  const enabled = input.blocks.filter((block) => block.enabled);
  const requiredEnabled = enabled.filter((block) => block.isRequired);
  const presentTypes = new Set(enabled.map((block) => block.blockType));
  const sortOrders = new Set<number>();
  const duplicateSortOrders = new Set<number>();
  for (const block of enabled) {
    if (sortOrders.has(block.sortOrder)) duplicateSortOrders.add(block.sortOrder);
    sortOrders.add(block.sortOrder);
  }

  const checks = [
    check(
      "published_hierarchy",
      "课程章节已发布",
      input.hierarchyPublished ? [] : ["对应课程、课时或章节不存在，或尚未发布。"],
    ),
    check(
      "complete_copy",
      "标题和操作说明完整",
      [
        ...(input.unitTitle.trim() ? [] : ["巩固包标题为空。"]),
        ...enabled.flatMap((block) => [
          ...(block.title.trim() ? [] : [`${block.blockType} 内容块标题为空。`]),
          ...(block.instructions.trim()
            ? []
            : [`${block.title || block.blockType} 的操作说明为空。`]),
        ]),
      ],
    ),
    check(
      "required_blocks",
      "必需内容块存在",
      REQUIRED_CHAPTER_PRACTICE_BLOCKS.flatMap((blockType) =>
        presentTypes.has(blockType)
          ? []
          : [`缺少必需内容块：${CHAPTER_PRACTICE_BLOCK_LABELS[blockType]}。`],
      ),
    ),
    check(
      "objective_judgement",
      "客观练习具有判定配置",
      enabled.flatMap((block) =>
        block.objectiveJudgementValid
          ? []
          : [`${block.title} 的客观题缺少完整判定配置。`],
      ),
    ),
    check(
      "valid_sources",
      "内容来源仍然有效",
      enabled.flatMap((block) =>
        block.sourceValid ? [] : [`${block.title} 的内容来源已失效或未发布。`],
      ),
    ),
    check(
      "completion_rule",
      "完成规则有效",
      [
        ...(input.completionRule.mode === "required_blocks"
          ? []
          : ["完成规则类型无效。"]),
        ...(input.completionRule.minimumRequiredBlocks >= 1 &&
        input.completionRule.minimumRequiredBlocks <= requiredEnabled.length
          ? []
          : [
              `至少完成块数必须在 1 到 ${requiredEnabled.length} 之间。`,
            ]),
        ...(input.completionRule.requireSelfCheck &&
        !presentTypes.has("self_check")
          ? ["完成规则要求自我检测，但自我检测块未启用。"]
          : []),
        ...(input.completionRule.minimumAccuracyPercent >= 0 &&
        input.completionRule.minimumAccuracyPercent <= 100
          ? []
          : ["练习正确率达标线必须在 0 到 100 之间。"]),
      ],
    ),
    check(
      "audio_status",
      "听力内容已明确音频状态",
      enabled
        .filter((block) => block.blockType === "listening")
        .flatMap((block) =>
          block.audioStatus === "ready" || block.audioStatus === "pending"
            ? []
            : [
                `${block.title} 的音频状态为${
                  block.audioStatus === "missing" ? "缺失" : "未标明"
                }，请补齐来源或停用该块。`,
              ],
        ),
    ),
    check(
      "ordering_and_references",
      "排序和引用有效",
      [
        ...(duplicateSortOrders.size
          ? [`存在重复排序：${[...duplicateSortOrders].join("、")}。`]
          : []),
        ...enabled.flatMap((block) =>
          block.referenceValid ? [] : [`${block.title} 包含无效引用。`],
        ),
      ],
    ),
  ];

  return { passed: checks.every((item) => item.passed), checks };
}
