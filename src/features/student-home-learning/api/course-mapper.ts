import { createHomeLearningTaskKey } from "../priority.ts";
import { getCourseLearningPath } from "../routes.ts";
import { mapCourseStatus } from "../status.ts";
import type { HomeLearningTask } from "./types.ts";

export type CourseContinuationCandidate = {
  sourceId: string;
  courseId: string;
  courseChapterId: string | null;
  courseTitle: string;
  lessonTitle: string;
  chapterTitle: string | null;
  categorySlug: string;
  subcategorySlug: string;
  courseSlug: string;
  lessonSlug: string;
  progressPercent: number;
  progressStatus: "not_started" | "in_progress" | "completed";
  isAvailable: boolean;
  updatedAt: string;
};

type MapCourseContinuationTaskInput = {
  candidate: CourseContinuationCandidate;
  studentAppId: string;
  appSlug: string;
  appLabel: string;
  space: string;
};

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * 课程来源只保留最近一个有效学习位置。同一章节同时存在课时进度和教材进度时，
 * 先按章节去重，再以最近更新时间决定位置，避免产生多个“继续学习”入口。
 */
export function selectCourseContinuationCandidate(
  candidates: CourseContinuationCandidate[],
): CourseContinuationCandidate | null {
  const latestByLocation = new Map<string, CourseContinuationCandidate>();
  for (const candidate of candidates) {
    if (!candidate.isAvailable || candidate.progressStatus === "completed") continue;
    const locationKey = candidate.courseChapterId ?? `lesson:${candidate.sourceId}`;
    const current = latestByLocation.get(locationKey);
    if (!current || timestamp(candidate.updatedAt) > timestamp(current.updatedAt)) {
      latestByLocation.set(locationKey, candidate);
    }
  }

  return [...latestByLocation.values()].sort(
    (left, right) => timestamp(right.updatedAt) - timestamp(left.updatedAt),
  )[0] ?? null;
}

export function mapCourseContinuationTask({
  candidate,
  studentAppId,
  appSlug,
  appLabel,
  space,
}: MapCourseContinuationTaskInput): HomeLearningTask | null {
  const status = mapCourseStatus({
    isAvailable: candidate.isAvailable,
    progressStatus: candidate.progressStatus,
  });
  if (status === "completed" || status === "locked") return null;

  const position = candidate.chapterTitle ?? candidate.lessonTitle;
  const progress = Math.min(100, Math.max(0, candidate.progressPercent));
  return {
    taskKey: createHomeLearningTaskKey(studentAppId, "course", candidate.sourceId),
    studentAppId,
    appSlug,
    appLabel,
    sourceType: "course",
    sourceId: candidate.sourceId,
    title: `继续学习${position}`,
    description: `${candidate.courseTitle} · ${candidate.lessonTitle}`,
    status,
    priority: status === "in_progress" ? "normal" : "low",
    required: false,
    startsAt: null,
    dueAt: null,
    progressPercent: progress,
    reason:
      progress > 0
        ? `${position}上次学习到${Math.round(progress)}%，可以从原位置继续。`
        : `${position}已经开放，可以从这里继续学习。`,
    href: getCourseLearningPath(space, {
      categorySlug: candidate.categorySlug,
      subcategorySlug: candidate.subcategorySlug,
      courseSlug: candidate.courseSlug,
      lessonSlug: candidate.lessonSlug,
    }),
    courseId: candidate.courseId,
    courseChapterId: candidate.courseChapterId,
    skill: null,
    updatedAt: candidate.updatedAt,
  };
}
