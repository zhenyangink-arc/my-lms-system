import { practiceAccuracyThreshold } from "../../chapter-practice/student/progress-model.ts";
import { createHomeLearningTaskKey } from "../priority.ts";
import { getChapterPracticePath } from "../routes.ts";
import { mapChapterPracticeStatus } from "../status.ts";
import type { HomeLearningTask } from "./types.ts";

export const DEFAULT_MANY_REVIEW_ITEMS = 3;

export type ChapterPracticeCandidate = {
  practiceUnitId: string;
  courseId: string;
  courseChapterId: string;
  courseSlug: string;
  courseTitle: string;
  chapterSlug: string;
  chapterTitle: string;
  description: string | null;
  publicationStatus:
    | "not_generated"
    | "draft"
    | "pending_review"
    | "published"
    | "needs_update"
    | "disabled";
  progressStatus:
    | "not_started"
    | "in_progress"
    | "needs_reinforcement"
    | "mastered";
  progressPercent: number;
  correctCount: number;
  attemptCount: number;
  completionRule: Record<string, unknown>;
  ebookCompleted: boolean;
  unmasteredReviewCount: number;
  isOpen: boolean;
  updatedAt: string;
};

type MapChapterPracticeTaskInput = {
  candidate: ChapterPracticeCandidate;
  studentAppId: string;
  appSlug: string;
  appLabel: string;
  space: string;
  manyReviewItemsThreshold?: number;
};

export function mapChapterPracticeTask({
  candidate,
  studentAppId,
  appSlug,
  appLabel,
  space,
  manyReviewItemsThreshold = DEFAULT_MANY_REVIEW_ITEMS,
}: MapChapterPracticeTaskInput): HomeLearningTask | null {
  if (!candidate.isOpen) return null;
  const status = mapChapterPracticeStatus({
    publicationStatus: candidate.publicationStatus,
    progressStatus: candidate.progressStatus,
  });
  if (status === "completed" || status === "unavailable") return null;

  const accuracy = candidate.attemptCount > 0
    ? (candidate.correctCount / candidate.attemptCount) * 100
    : null;
  const masteryLine = practiceAccuracyThreshold(candidate.completionRule);
  const accuracyLow = accuracy !== null && accuracy < masteryLine;
  const hasManyReviewItems =
    candidate.unmasteredReviewCount >= Math.max(1, manyReviewItemsThreshold);
  const recommend =
    candidate.progressStatus === "in_progress" ||
    candidate.progressStatus === "needs_reinforcement" ||
    candidate.ebookCompleted ||
    accuracyLow ||
    hasManyReviewItems;
  if (!recommend) return null;

  let reason: string;
  if (candidate.progressStatus === "needs_reinforcement" || accuracyLow) {
    reason = accuracy === null
      ? `${candidate.chapterTitle}仍有内容待加强，建议继续完成章节巩固。`
      : `${candidate.chapterTitle}最近正确率为${Math.round(accuracy)}%，低于${Math.round(masteryLine)}%掌握线，建议继续巩固。`;
  } else if (candidate.progressStatus === "in_progress") {
    reason = `${candidate.chapterTitle}巩固已完成${Math.round(candidate.progressPercent)}%，可以继续完成。`;
  } else if (hasManyReviewItems) {
    reason = `${candidate.chapterTitle}有${candidate.unmasteredReviewCount}道错题尚未掌握，建议先完成章节巩固。`;
  } else {
    reason = `${candidate.chapterTitle}教材已经完成，接下来完成章节巩固。`;
  }

  return {
    taskKey: createHomeLearningTaskKey(
      studentAppId,
      "chapter_practice",
      candidate.practiceUnitId,
    ),
    studentAppId,
    appSlug,
    appLabel,
    sourceType: "chapter_practice",
    sourceId: candidate.practiceUnitId,
    title: `巩固${candidate.chapterTitle}`,
    description: candidate.description,
    status,
    priority: "normal",
    required: false,
    startsAt: null,
    dueAt: null,
    progressPercent: Math.min(100, Math.max(0, candidate.progressPercent)),
    reason,
    href: getChapterPracticePath(space, {
      courseKey: candidate.courseSlug,
      chapterSlug: candidate.chapterSlug,
    }),
    courseId: candidate.courseId,
    courseChapterId: candidate.courseChapterId,
    skill: null,
    updatedAt: candidate.updatedAt,
  };
}
