import type {
  ChapterPracticeSelfCheckResult,
  PublishedChapterPracticeBlock,
} from "./types";

const DISPLAY_ORDER = new Map<string, number>([
  ["overview", 10],
  ["vocabulary", 20],
  ["grammar", 30],
  ["comparison", 40],
  ["interaction", 49],
  ["listening", 50],
  ["speaking", 51],
  ["reading", 52],
  ["writing", 53],
  ["review", 60],
  ["self_check", 70],
]);

const HANGUL_MARKERS = new Set([
  "hangul",
  "hangul-alphabet",
  "hangul_alphabet",
  "alphabet",
  "letter",
  "letters",
  "pronunciation",
]);

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizedText(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function orderPublishedChapterPracticeBlocks(
  blocks: PublishedChapterPracticeBlock[],
) {
  return [...blocks].sort((left, right) => {
    const leftOrder = DISPLAY_ORDER.get(left.blockType) ?? 999;
    const rightOrder = DISPLAY_ORDER.get(right.blockType) ?? 999;
    return (
      leftOrder - rightOrder ||
      left.sortOrder - right.sortOrder ||
      left.id.localeCompare(right.id)
    );
  });
}

function payloadHasExplicitHangulMarker(value: unknown, depth = 0): boolean {
  if (depth > 4) return false;
  const record = objectValue(value);
  for (const [key, rawValue] of Object.entries(record)) {
    if (
      key === "courseKey" &&
      normalizedText(rawValue) === "hangul-introduction"
    ) {
      return true;
    }
    if (
      ["contentKind", "practiceKind", "sourceKind", "category"].includes(key) &&
      HANGUL_MARKERS.has(normalizedText(rawValue))
    ) {
      return true;
    }
    if (payloadHasExplicitHangulMarker(rawValue, depth + 1)) return true;
  }
  return false;
}

export function isHangulPracticeChapter({
  courseKey,
  blocks,
}: {
  courseKey: string;
  blocks: PublishedChapterPracticeBlock[];
}) {
  return (
    courseKey === "hangul-introduction" ||
    blocks.some((block) => payloadHasExplicitHangulMarker(block.contentPayload))
  );
}

export function selfCheckTopics(
  block: PublishedChapterPracticeBlock,
  fallbackTitle: string,
) {
  if (Array.isArray(block.contentPayload.skills)) {
    const listedTopics = block.contentPayload.skills.filter(
      (value): value is string => typeof value === "string" && Boolean(value.trim()),
    );
    if (listedTopics.length > 0) return [...new Set(listedTopics.map((item) => item.trim()))];
  }
  const skills = objectValue(block.contentPayload.skills);
  const topics = Object.values(skills).flatMap((value) =>
    typeof value === "string" && value.trim() ? [value.trim()] : [],
  );
  if (topics.length > 0) return [...new Set(topics)];

  const prompt = block.contentPayload.prompt;
  if (typeof prompt === "string" && prompt.trim()) return [prompt.trim()];
  const promptRecord = objectValue(prompt);
  const localizedPrompt = [promptRecord["zh-CN"], promptRecord.zh, promptRecord["ko-KR"]]
    .find((value) => typeof value === "string" && value.trim());
  return [
    typeof localizedPrompt === "string" ? localizedPrompt.trim() : fallbackTitle,
  ];
}

export function evaluateChapterPracticeSelfCheck({
  answers,
  topics,
  passingScore,
}: {
  answers: Record<string, "mastered" | "review">;
  topics: string[];
  passingScore: number;
}): ChapterPracticeSelfCheckResult {
  const topicCount = Math.max(1, topics.length);
  const masteredCount = topics.filter(
    (_, index) => answers[String(index)] === "mastered",
  ).length;
  const score = Math.round((masteredCount / topicCount) * 100);
  const normalizedPassingScore = Math.min(
    100,
    Math.max(0, Number.isFinite(passingScore) ? passingScore : 80),
  );
  return {
    score,
    passingScore: normalizedPassingScore,
    passed: score >= normalizedPassingScore,
    masteredCount,
    topicCount,
  };
}
