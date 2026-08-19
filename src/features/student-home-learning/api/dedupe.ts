import type { HomeLearningTask } from "./types.ts";

const STATUS_RANK = new Map<HomeLearningTask["status"], number>([
  ["overdue", 0],
  ["in_progress", 1],
  ["available", 2],
  ["not_started", 3],
  ["submitted", 4],
  ["pending_grading", 5],
  ["locked", 6],
  ["unavailable", 7],
  ["completed", 8],
]);

function isPreferred(left: HomeLearningTask, right: HomeLearningTask): boolean {
  const leftRank = STATUS_RANK.get(left.status) ?? Number.MAX_SAFE_INTEGER;
  const rightRank = STATUS_RANK.get(right.status) ?? Number.MAX_SAFE_INTEGER;
  if (leftRank !== rightRank) return leftRank < rightRank;
  return Date.parse(left.updatedAt) > Date.parse(right.updatedAt);
}

/** 去掉已完成任务，并按统一 taskKey 保留状态更紧迫、更新时间更新的一条。 */
export function dedupeHomeLearningTasks(
  tasks: HomeLearningTask[],
): HomeLearningTask[] {
  const byTaskKey = new Map<string, HomeLearningTask>();
  for (const task of tasks) {
    if (task.status === "completed") continue;
    const current = byTaskKey.get(task.taskKey);
    if (!current || isPreferred(task, current)) byTaskKey.set(task.taskKey, task);
  }
  return [...byTaskKey.values()];
}
