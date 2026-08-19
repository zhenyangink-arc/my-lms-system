import { createHomeLearningTaskKey } from "../priority.ts";
import { getReviewPath } from "../routes.ts";
import { mapReviewStatus } from "../status.ts";
import type { HomeLearningTask } from "./types.ts";

const SKILL_LABELS: Record<string, string> = {
  listening: "听力",
  speaking: "口语",
  reading: "阅读",
  writing: "写作",
  grammar: "语法",
  vocabulary: "词汇",
};

export type ReviewAggregateCandidate = {
  sourceId: string;
  title: string;
  itemCount: number;
  repeatedErrorCount: number;
  reviewStatus: "pending" | "reviewing" | "mastered";
  isAvailable: boolean;
  courseId: string | null;
  courseChapterId: string | null;
  skill: string | null;
  updatedAt: string;
};

type MapReviewTaskInput = {
  candidate: ReviewAggregateCandidate;
  studentAppId: string;
  appSlug: string;
  appLabel: string;
  space: string;
};

export function mapReviewTask({
  candidate,
  studentAppId,
  appSlug,
  appLabel,
  space,
}: MapReviewTaskInput): HomeLearningTask | null {
  if (candidate.itemCount <= 0) return null;
  const status = mapReviewStatus({
    isAvailable: candidate.isAvailable,
    reviewStatus: candidate.reviewStatus,
  });
  if (status === "completed" || status === "unavailable") return null;

  const skillLabel = candidate.skill
    ? SKILL_LABELS[candidate.skill] ?? candidate.skill
    : null;
  const scope = candidate.courseChapterId ? candidate.title : skillLabel ?? candidate.title;
  const repeatNote = candidate.repeatedErrorCount > 0
    ? `，其中${candidate.repeatedErrorCount}道出现重复错误`
    : "";

  return {
    taskKey: createHomeLearningTaskKey(studentAppId, "review", candidate.sourceId),
    studentAppId,
    appSlug,
    appLabel,
    sourceType: "review",
    sourceId: candidate.sourceId,
    title: `复习${scope}错题`,
    description: null,
    status,
    priority: "normal",
    required: false,
    startsAt: null,
    dueAt: null,
    progressPercent: null,
    reason: `${scope}有${candidate.itemCount}道错题尚未重新掌握${repeatNote}，建议集中复习。`,
    href: getReviewPath(space),
    courseId: candidate.courseId,
    courseChapterId: candidate.courseChapterId,
    skill: candidate.skill,
    updatedAt: candidate.updatedAt,
  };
}
