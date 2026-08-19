import type {
  ChapterPracticeProgressStatus,
  PublishedChapterPracticeBlock,
  StudentChapterPracticeProgress,
} from "./types";

export const DEFAULT_PRACTICE_ACCURACY_PERCENT = 80;

type ProgressFacts = Pick<
  StudentChapterPracticeProgress,
  | "practiceUnitId"
  | "completedBlockIds"
  | "lastBlockId"
  | "correctCount"
  | "attemptCount"
  | "startedAt"
  | "lastPracticedAt"
  | "completedAt"
>;

function finitePercent(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(100, Math.max(0, number))
    : fallback;
}

export function practiceAccuracyThreshold(
  completionRule: Record<string, unknown>,
) {
  for (const key of [
    "minimumAccuracyPercent",
    "accuracyThreshold",
    "passingScore",
  ]) {
    if (completionRule[key] !== undefined) {
      return finitePercent(
        completionRule[key],
        DEFAULT_PRACTICE_ACCURACY_PERCENT,
      );
    }
  }
  return DEFAULT_PRACTICE_ACCURACY_PERCENT;
}

export function requiredPracticeBlockIds({
  blocks,
}: {
  blocks: PublishedChapterPracticeBlock[];
}) {
  const required = blocks.filter((block) => block.isRequired);
  return [...new Set(required.map((block) => block.id))];
}

export function calculateStudentPracticeProgress({
  facts,
  blocks,
  completionRule,
  chapterTestPassed,
  chapterTestAvailable,
}: {
  facts: ProgressFacts;
  blocks: PublishedChapterPracticeBlock[];
  completionRule: Record<string, unknown>;
  chapterTestPassed: boolean;
  chapterTestAvailable: boolean;
}): StudentChapterPracticeProgress {
  const validBlockIds = new Set(blocks.map((block) => block.id));
  const completedBlockIds = [...new Set(facts.completedBlockIds)].filter((id) =>
    validBlockIds.has(id),
  );
  const requiredIds = requiredPracticeBlockIds({ blocks });
  const requiredTarget = Math.min(
    requiredIds.length,
    Math.max(
      1,
      Math.trunc(
        Number(completionRule.minimumRequiredBlocks) || requiredIds.length,
      ),
    ),
  );
  const completedRequired = requiredIds.filter((id) =>
    completedBlockIds.includes(id),
  ).length;
  const requiredSelfCheck =
    completionRule.requireSelfCheck !== false
      ? blocks.find(
          (block) => block.isRequired && block.blockType === "self_check",
        )
      : null;
  const selfCheckComplete =
    !requiredSelfCheck || completedBlockIds.includes(requiredSelfCheck.id);
  const rawProgress = requiredTarget
    ? Math.min(1, completedRequired / requiredTarget)
    : 1;
  const normalizedProgress = selfCheckComplete
    ? rawProgress
    : Math.min(rawProgress, requiredTarget > 1 ? (requiredTarget - 1) / requiredTarget : 0);
  const progressPercent = requiredTarget
    ? Math.round(normalizedProgress * 10_000) / 100
    : 100;
  const accuracy = facts.attemptCount
    ? (facts.correctCount / facts.attemptCount) * 100
    : 0;
  const contentComplete =
    completedRequired >= requiredTarget && selfCheckComplete;
  const accuracyPassed =
    facts.attemptCount > 0 &&
    accuracy >= practiceAccuracyThreshold(completionRule);
  const masteryChecks = [contentComplete, accuracyPassed];
  if (chapterTestAvailable) masteryChecks.push(chapterTestPassed);
  // 关键错题复习的数据源将在统一错题中心任务接入；当前不加入分母，也不阻塞掌握。
  const masteryPercent =
    Math.round(
      (masteryChecks.filter(Boolean).length / masteryChecks.length) * 10_000,
    ) / 100;
  const hasStarted = Boolean(
    facts.startedAt ||
      facts.lastPracticedAt ||
      completedBlockIds.length ||
      facts.attemptCount,
  );
  const needsReinforcement =
    hasStarted &&
    ((facts.attemptCount > 0 && !accuracyPassed) ||
      (contentComplete && chapterTestAvailable && !chapterTestPassed));
  const status: ChapterPracticeProgressStatus = masteryChecks.every(Boolean)
    ? "mastered"
    : needsReinforcement
      ? "needs_reinforcement"
      : hasStarted
        ? "in_progress"
        : "not_started";

  return {
    ...facts,
    completedBlockIds,
    progressPercent,
    masteryPercent,
    status,
    completedAt: contentComplete ? facts.completedAt : null,
  };
}

export function mergeProgressSnapshots({
  server,
  local,
}: {
  server: StudentChapterPracticeProgress | null;
  local: StudentChapterPracticeProgress;
}) {
  if (!server) return local;
  const serverTime = Date.parse(server.lastPracticedAt ?? "");
  const localTime = Date.parse(local.lastPracticedAt ?? "");
  if (
    Number.isFinite(serverTime) &&
    (!Number.isFinite(localTime) || serverTime >= localTime)
  ) {
    return server;
  }
  return {
    ...local,
    completedBlockIds: [
      ...new Set([...server.completedBlockIds, ...local.completedBlockIds]),
    ],
    correctCount: Math.max(server.correctCount, local.correctCount),
    attemptCount: Math.max(server.attemptCount, local.attemptCount),
    startedAt: server.startedAt ?? local.startedAt,
    completedAt: server.completedAt ?? local.completedAt,
  };
}

export function emptyStudentPracticeProgress(
  practiceUnitId: string,
): StudentChapterPracticeProgress {
  return {
    practiceUnitId,
    status: "not_started",
    progressPercent: 0,
    masteryPercent: 0,
    completedBlockIds: [],
    lastBlockId: null,
    correctCount: 0,
    attemptCount: 0,
    startedAt: null,
    lastPracticedAt: null,
    completedAt: null,
  };
}
