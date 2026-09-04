import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { loadStudentCurrentKoreanCourse } from "@/features/student-current-course/api/service";
import { createHomeLearningTaskKey } from "../priority.ts";
import type { HomeLearningTask } from "./types.ts";

type LoadCourseContinuationTaskInput = {
  supabase: SupabaseClient;
  studentId: string;
  studentAppId: string;
  appSlug: string;
  appLabel: string;
  space: string;
  now?: Date;
};

export async function loadCourseContinuationTasks({
  supabase,
  studentId,
  studentAppId,
  appSlug,
  appLabel,
  space,
  now = new Date(),
}: LoadCourseContinuationTaskInput): Promise<HomeLearningTask[]> {
  const currentCourse = await loadStudentCurrentKoreanCourse({
    supabase,
    studentId,
    space,
    now,
  });
  if (!currentCourse || currentCourse.status === "completed") return [];

  const progress = currentCourse.lessonProgressPercent;
  return [
    {
      taskKey: createHomeLearningTaskKey(
        studentAppId,
        "course",
        currentCourse.lessonId,
      ),
      studentAppId,
      appSlug,
      appLabel,
      sourceType: "course",
      sourceId: currentCourse.lessonId,
      title: `继续学习${currentCourse.lessonTitle}`,
      description: `${currentCourse.courseTitle} · 正式课程`,
      status: currentCourse.status === "in_progress" ? "in_progress" : "available",
      priority: currentCourse.status === "in_progress" ? "normal" : "low",
      required: false,
      startsAt: null,
      dueAt: null,
      progressPercent: progress,
      reason:
        progress > 0
          ? `${currentCourse.lessonTitle}上次学习到${Math.round(progress)}%，可以从原位置继续。`
          : `${currentCourse.lessonTitle}已经开放，可以从这里开始学习。`,
      href: currentCourse.continueHref,
      courseId: currentCourse.courseId,
      courseChapterId: null,
      skill: null,
      updatedAt: currentCourse.updatedAt,
    },
  ];
}
