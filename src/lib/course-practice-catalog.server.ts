import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { STUDENT_APP_IDS } from "@/lib/student-apps";
import {
  buildCoursePracticeCatalog,
  type CoursePracticeAttemptRow,
  type CoursePracticeChapterRow,
  type CoursePracticeCourseRow,
  type CoursePracticeEbookProgressRow,
  type CoursePracticeLessonProgressRow,
  type CoursePracticeLessonRow,
  type CoursePracticeProgressRow,
} from "@/lib/course-practice-catalog";

export async function loadCoursePracticeCatalog({
  supabase,
  userId,
  now = new Date(),
}: {
  supabase: SupabaseClient;
  userId: string;
  now?: Date;
}) {
  const { data: courseData, error: courseError } = await supabase
    .from("courses")
    .select(
      "id,category_id,slug,title,sort_order,unlock_mode,prerequisite_course_id,available_from,is_manually_locked",
    )
    .eq("student_app_id", STUDENT_APP_IDS.korean)
    .eq("is_published", true)
    .order("sort_order", { ascending: true });
  if (courseError) throw new Error("课程巩固目录中的课程读取失败", { cause: courseError });

  const courses = (courseData ?? []) as CoursePracticeCourseRow[];
  const courseIds = courses.map((course) => course.id);
  const { data: lessonData, error: lessonError } = courseIds.length
    ? await supabase
        .from("lessons")
        .select(
          "id,course_id,slug,title,sort_order,unlock_mode,prerequisite_lesson_id,prerequisite_chapter_id,available_from,is_manually_locked",
        )
        .in("course_id", courseIds)
        .eq("is_published", true)
        .order("sort_order", { ascending: true })
    : { data: [], error: null };
  if (lessonError) throw new Error("课程巩固目录中的课时读取失败", { cause: lessonError });

  const lessons = (lessonData ?? []) as CoursePracticeLessonRow[];
  const lessonIds = lessons.map((lesson) => lesson.id);
  const { data: chapterData, error: chapterError } = lessonIds.length
    ? await supabase
        .from("course_chapters")
        .select(
          "id,lesson_id,chapter_test_id,slug,title,description,sort_order,unlock_mode,prerequisite_chapter_id,available_from,is_manually_locked",
        )
        .in("lesson_id", lessonIds)
        .eq("is_published", true)
        .order("sort_order", { ascending: true })
    : { data: [], error: null };
  if (chapterError) throw new Error("课程巩固目录中的章节读取失败", { cause: chapterError });

  const chapters = (chapterData ?? []) as CoursePracticeChapterRow[];
  const chapterIds = chapters.map((chapter) => chapter.id);
  const [practiceResult, lessonProgressResult, attemptResult, ebookResult] =
    await Promise.all([
      chapterIds.length
        ? supabase
            .from("chapter_practice_units")
            .select("id,course_chapter_id,version")
            .eq("student_app_id", STUDENT_APP_IDS.korean)
            .eq("status", "published")
            .in("course_chapter_id", chapterIds)
            .order("version", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      lessonIds.length
        ? supabase
            .from("lesson_progress")
            .select("lesson_id,status")
            .eq("user_id", userId)
            .in("lesson_id", lessonIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("chapter_test_attempts")
        .select("test_id,test_slug,score,passed")
        .eq("student_id", userId),
      supabase
        .from("course_ebook_progress")
        .select("test_slug,progress_percent")
        .eq("student_id", userId)
        .eq("student_app_id", STUDENT_APP_IDS.korean),
    ]);

  const firstError = [
    practiceResult.error,
    lessonProgressResult.error,
    attemptResult.error,
    ebookResult.error,
  ].find(Boolean);
  if (firstError) throw new Error("课程巩固目录中的状态读取失败", { cause: firstError });

  const latestPublishedUnitByChapter = new Map<
    string,
    { id: string; courseChapterId: string }
  >();
  for (const unit of practiceResult.data ?? []) {
    const courseChapterId = String(unit.course_chapter_id);
    if (!latestPublishedUnitByChapter.has(courseChapterId)) {
      latestPublishedUnitByChapter.set(courseChapterId, {
        id: String(unit.id),
        courseChapterId,
      });
    }
  }
  const publishedUnits = [...latestPublishedUnitByChapter.values()];
  const { data: progressData, error: progressError } = publishedUnits.length
    ? await supabase
        .from("student_chapter_practice_progress")
        .select("practice_unit_id,status,progress_percent,mastery_percent,completed_block_ids,last_practiced_at")
        .eq("student_id", userId)
        .in(
          "practice_unit_id",
          publishedUnits.map((unit) => unit.id),
        )
    : { data: [], error: null };
  if (progressError) {
    throw new Error("课程巩固目录中的学习进度读取失败", {
      cause: progressError,
    });
  }
  const { data: blockData, error: blockError } = publishedUnits.length
    ? await supabase
        .from("chapter_practice_blocks")
        .select("id,practice_unit_id,title,sort_order,is_required")
        .in(
          "practice_unit_id",
          publishedUnits.map((unit) => unit.id),
        )
        .eq("status", "published")
        .order("sort_order", { ascending: true })
    : { data: [], error: null };
  if (blockError) {
    throw new Error("课程巩固目录中的内容项目读取失败", { cause: blockError });
  }
  const blocksByUnitId = new Map<
    string,
    Array<{ id: string; title: string }>
  >();
  for (const block of blockData ?? []) {
    if (!block.is_required) continue;
    const practiceUnitId = String(block.practice_unit_id);
    const blocks = blocksByUnitId.get(practiceUnitId) ?? [];
    blocks.push({ id: String(block.id), title: String(block.title) });
    blocksByUnitId.set(practiceUnitId, blocks);
  }
  const unitById = new Map(
    publishedUnits.map((unit) => [unit.id, unit.courseChapterId]),
  );
  const practiceProgress = (progressData ?? []).flatMap((progress) => {
    const courseChapterId = unitById.get(String(progress.practice_unit_id));
    if (!courseChapterId) return [];
    const completedBlockIds = new Set(
      Array.isArray(progress.completed_block_ids)
        ? progress.completed_block_ids.map(String)
        : [],
    );
    return [
      {
        course_chapter_id: courseChapterId,
        status: String(progress.status),
        progress_percent: Number(progress.progress_percent),
        mastery_percent: Number(progress.mastery_percent),
        completed_block_ids: [...completedBlockIds],
        last_practiced_at: progress.last_practiced_at
          ? String(progress.last_practiced_at)
          : null,
        remaining_items: (blocksByUnitId.get(String(progress.practice_unit_id)) ?? [])
          .filter((block) => !completedBlockIds.has(block.id)),
      } as CoursePracticeProgressRow,
    ];
  });

  for (const unit of publishedUnits) {
    if (practiceProgress.some((progress) => progress.course_chapter_id === unit.courseChapterId)) {
      continue;
    }
    practiceProgress.push({
      course_chapter_id: unit.courseChapterId,
      status: "not_started",
      progress_percent: 0,
      mastery_percent: 0,
      completed_block_ids: [],
      last_practiced_at: null,
      remaining_items: blocksByUnitId.get(unit.id) ?? [],
    });
  }

  return buildCoursePracticeCatalog({
    courses,
    lessons,
    chapters,
    publishedPracticeChapterIds: new Set(
      publishedUnits.map((unit) => unit.courseChapterId),
    ),
    lessonProgress: (lessonProgressResult.data ?? []) as CoursePracticeLessonProgressRow[],
    attempts: (attemptResult.data ?? []) as CoursePracticeAttemptRow[],
    ebookProgress: (ebookResult.data ?? []) as CoursePracticeEbookProgressRow[],
    practiceProgress,
    now,
  });
}
