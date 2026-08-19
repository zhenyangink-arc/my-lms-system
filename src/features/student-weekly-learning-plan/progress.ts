import { getSeoulDateKey } from "./week.ts";
import type { StudentWeeklyLearningProgress } from "./types.ts";

export type WeeklyLearningEvidence = {
  targetDays: number;
  targetMinutes: number;
  learningSeconds: number;
  activityTimestamps: readonly string[];
};

function percent(actual: number, target: number) {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((Math.max(0, actual) / target) * 100));
}

/**
 * 天数和分钟是两个同时成立的周目标，因此总完成率取二者较低值；
 * 任一维度尚未达标时不会提前显示整周目标已经完成。
 */
export function calculateWeeklyLearningProgress({
  targetDays,
  targetMinutes,
  learningSeconds,
  activityTimestamps,
}: WeeklyLearningEvidence): StudentWeeklyLearningProgress {
  const safeSeconds = Math.max(0, Math.trunc(learningSeconds));
  const activityDays = new Set(
    activityTimestamps.map((timestamp) => getSeoulDateKey(timestamp)),
  );
  const actualDays = activityDays.size;
  const actualMinutes = Math.round((safeSeconds / 60) * 10) / 10;
  const daysCompletionPercent = percent(actualDays, targetDays);
  const minutesCompletionPercent = percent(safeSeconds, targetMinutes * 60);
  const completionPercent = Math.min(
    daysCompletionPercent,
    minutesCompletionPercent,
  );

  return {
    actualDays,
    actualMinutes,
    learningSeconds: safeSeconds,
    daysCompletionPercent,
    minutesCompletionPercent,
    completionPercent,
    goalMet: completionPercent === 100,
  };
}
