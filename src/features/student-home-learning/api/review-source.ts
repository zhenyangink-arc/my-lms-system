import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { loadStudentReviewCenter } from "@/features/student-review-center/service";
import { loadCoursePracticeCatalog } from "@/lib/course-practice-catalog.server";
import {
  mapReviewTask,
  type ReviewAggregateCandidate,
} from "./review-mapper.ts";
import type { HomeLearningTask } from "./types.ts";

type LoadReviewTasksInput = {
  supabase: SupabaseClient;
  studentId: string;
  studentAppId: string;
  appSlug: string;
  appLabel: string;
  space: string;
  now?: Date;
};

export async function loadReviewTasks({
  supabase,
  studentId,
  studentAppId,
  appSlug,
  appLabel,
  space,
  now = new Date(),
}: LoadReviewTasksInput): Promise<HomeLearningTask[]> {
  const [reviewCenter, catalog] = await Promise.all([
    loadStudentReviewCenter({ supabase, studentId, studentAppId }),
    loadCoursePracticeCatalog({ supabase, userId: studentId, now }),
  ]);
  if (reviewCenter.error) throw new Error(reviewCenter.error);

  const openChapterIds = new Set(
    catalog.flatMap((course) =>
      course.chapters.flatMap((chapter) =>
        course.isOpen && chapter.isOpen ? [chapter.id] : [],
      ),
    ),
  );
  const groups = new Map<string, ReviewAggregateCandidate>();
  for (const item of reviewCenter.items) {
    if (item.status === "mastered") continue;
    if (item.courseChapterId && !openChapterIds.has(item.courseChapterId)) continue;
    const sourceId = item.courseChapterId
      ? `chapter:${item.courseChapterId}`
      : `skill:${item.skill}`;
    const current = groups.get(sourceId);
    const title = item.chapterTitle ?? item.courseTitle ?? item.skill;
    groups.set(sourceId, {
      sourceId,
      title,
      itemCount: (current?.itemCount ?? 0) + 1,
      repeatedErrorCount:
        (current?.repeatedErrorCount ?? 0) + (item.errorCount > 1 ? 1 : 0),
      reviewStatus:
        current?.reviewStatus === "reviewing" || item.status === "reviewing"
          ? "reviewing"
          : "pending",
      isAvailable: true,
      courseId: item.courseId,
      courseChapterId: item.courseChapterId,
      skill: item.courseChapterId ? null : item.skill,
      updatedAt:
        !current || Date.parse(item.updatedAt) > Date.parse(current.updatedAt)
          ? item.updatedAt
          : current.updatedAt,
    });
  }

  return [...groups.values()].flatMap((candidate) => {
    const task = mapReviewTask({
      candidate,
      studentAppId,
      appSlug,
      appLabel,
      space,
    });
    return task ? [task] : [];
  });
}
