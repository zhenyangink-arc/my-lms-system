import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { CoursePracticeCourse } from "@/lib/course-practice-catalog";
import {
  mapChapterPracticeTask,
  type ChapterPracticeCandidate,
} from "./chapter-practice-mapper.ts";
import type { HomeLearningTask } from "./types.ts";

type LoadChapterPracticeTasksInput = {
  supabase: SupabaseClient;
  studentId: string;
  studentAppId: string;
  appSlug: string;
  appLabel: string;
  space: string;
  // 见 review-source.ts 的说明：这份目录由调用方算一次后共享给多个来源。
  catalog: Promise<CoursePracticeCourse[]>;
};

function throwReadError(label: string, error: { message: string } | null) {
  if (error) throw new Error(`首页章节巩固${label}读取失败`, { cause: error });
}

export async function loadChapterPracticeTasks({
  supabase,
  studentId,
  studentAppId,
  appSlug,
  appLabel,
  space,
  catalog: catalogPromise,
}: LoadChapterPracticeTasksInput): Promise<HomeLearningTask[]> {
  const catalog = await catalogPromise;
  const chapterIds = catalog.flatMap((course) => course.chapters.map((chapter) => chapter.id));
  if (chapterIds.length === 0) return [];

  const [unitResult, ebookResult, reviewResult] = await Promise.all([
    supabase
      .from("chapter_practice_units")
      .select("id,course_chapter_id,title,completion_rule,version,published_at")
      .eq("student_app_id", studentAppId)
      .eq("status", "published")
      .in("course_chapter_id", chapterIds)
      .order("version", { ascending: false }),
    supabase
      .from("course_ebook_progress")
      .select("test_slug,completed_at")
      .eq("student_id", studentId)
      .eq("student_app_id", studentAppId)
      .not("completed_at", "is", null),
    supabase
      .from("student_review_items")
      .select("course_chapter_id,status")
      .eq("student_id", studentId)
      .eq("student_app_id", studentAppId)
      .neq("status", "mastered")
      .not("course_chapter_id", "is", null),
  ]);
  throwReadError("已发布内容", unitResult.error);
  throwReadError("教材完成状态", ebookResult.error);
  throwReadError("错题依据", reviewResult.error);

  const latestUnitByChapter = new Map<string, (typeof unitResult.data extends (infer T)[] | null ? T : never)>();
  for (const unit of unitResult.data ?? []) {
    const chapterId = String(unit.course_chapter_id);
    if (!latestUnitByChapter.has(chapterId)) latestUnitByChapter.set(chapterId, unit);
  }
  const units = [...latestUnitByChapter.values()];
  if (units.length === 0) return [];
  const progressResult = await supabase
    .from("student_chapter_practice_progress")
    .select("practice_unit_id,status,progress_percent,correct_count,attempt_count,last_practiced_at,updated_at")
    .eq("student_id", studentId)
    .in("practice_unit_id", units.map((unit) => String(unit.id)));
  throwReadError("学生进度", progressResult.error);

  const progressByUnit = new Map(
    (progressResult.data ?? []).map((progress) => [String(progress.practice_unit_id), progress]),
  );
  const completedEbookSlugs = new Set(
    (ebookResult.data ?? []).map((progress) => String(progress.test_slug)),
  );
  const reviewCountByChapter = new Map<string, number>();
  for (const item of reviewResult.data ?? []) {
    if (!item.course_chapter_id) continue;
    const chapterId = String(item.course_chapter_id);
    reviewCountByChapter.set(chapterId, (reviewCountByChapter.get(chapterId) ?? 0) + 1);
  }
  const catalogByChapterId = new Map(
    catalog.flatMap((course) =>
      course.chapters.map((chapter) => [chapter.id, { course, chapter }] as const),
    ),
  );

  return units.flatMap((unit) => {
    const location = catalogByChapterId.get(String(unit.course_chapter_id));
    if (!location) return [];
    const progress = progressByUnit.get(String(unit.id));
    const candidate: ChapterPracticeCandidate = {
      practiceUnitId: String(unit.id),
      courseId: location.course.id,
      courseChapterId: location.chapter.id,
      courseSlug: location.course.slug,
      courseTitle: location.course.title,
      chapterSlug: location.chapter.slug,
      chapterTitle: location.chapter.title,
      description: location.chapter.description,
      publicationStatus: "published",
      progressStatus: (progress?.status ?? "not_started") as ChapterPracticeCandidate["progressStatus"],
      progressPercent: Number(progress?.progress_percent) || 0,
      correctCount: Number(progress?.correct_count) || 0,
      attemptCount: Number(progress?.attempt_count) || 0,
      completionRule:
        unit.completion_rule && typeof unit.completion_rule === "object"
          ? (unit.completion_rule as Record<string, unknown>)
          : {},
      ebookCompleted: completedEbookSlugs.has(location.chapter.slug),
      unmasteredReviewCount: reviewCountByChapter.get(location.chapter.id) ?? 0,
      isOpen: location.course.isOpen && location.chapter.isOpen,
      updatedAt: String(progress?.last_practiced_at ?? progress?.updated_at ?? unit.published_at),
    };
    const task = mapChapterPracticeTask({
      candidate,
      studentAppId,
      appSlug,
      appLabel,
      space,
    });
    return task ? [task] : [];
  });
}
