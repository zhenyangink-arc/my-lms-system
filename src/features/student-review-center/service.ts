import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  StudentReviewCenterResult,
  StudentReviewItem,
  StudentReviewStatus,
} from "./types";

type ReviewRow = {
  id: string;
  source_type: string;
  source_id: string;
  source_question_id: string | null;
  course_id: string | null;
  course_chapter_id: string | null;
  skill: string;
  content_snapshot: unknown;
  student_answer_snapshot: unknown;
  feedback_snapshot: unknown;
  error_count: number;
  status: string;
  last_reviewed_at: string | null;
  mastered_at: string | null;
  created_at: string;
  updated_at: string;
};

function objectSnapshot(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function loadStudentReviewCenter({
  supabase,
  studentId,
  studentAppId,
}: {
  supabase: SupabaseClient;
  studentId: string;
  studentAppId: string;
}): Promise<StudentReviewCenterResult> {
  const { data, error } = await supabase
    .from("student_review_items")
    .select(
      "id,source_type,source_id,source_question_id,course_id,course_chapter_id,skill,content_snapshot,student_answer_snapshot,feedback_snapshot,error_count,status,last_reviewed_at,mastered_at,created_at,updated_at",
    )
    .eq("student_id", studentId)
    .eq("student_app_id", studentAppId)
    .order("updated_at", { ascending: false });
  if (error) {
    return { items: [], error: "错题记录暂时无法读取，请刷新后重试。" };
  }

  const rows = (data ?? []) as ReviewRow[];
  const courseIds = [...new Set(rows.flatMap((row) => row.course_id ? [row.course_id] : []))];
  const chapterIds = [
    ...new Set(rows.flatMap((row) => row.course_chapter_id ? [row.course_chapter_id] : [])),
  ];
  const [{ data: courses }, { data: chapters }] = await Promise.all([
    courseIds.length
      ? supabase.from("courses").select("id,title,slug").in("id", courseIds)
      : Promise.resolve({ data: [] }),
    chapterIds.length
      ? supabase
          .from("course_chapters")
          .select("id,lesson_id,title,slug")
          .in("id", chapterIds)
      : Promise.resolve({ data: [] }),
  ]);
  const lessonIds = [
    ...new Set((chapters ?? []).map((chapter) => String(chapter.lesson_id))),
  ];
  const { data: lessons } = lessonIds.length
    ? await supabase.from("lessons").select("id,slug").in("id", lessonIds)
    : { data: [] };
  const courseTitleById = new Map(
    (courses ?? []).map((course) => [String(course.id), String(course.title)]),
  );
  const courseSlugById = new Map(
    (courses ?? []).map((course) => [String(course.id), String(course.slug)]),
  );
  const chapterTitleById = new Map(
    (chapters ?? []).map((chapter) => [String(chapter.id), String(chapter.title)]),
  );
  const chapterSlugById = new Map(
    (chapters ?? []).map((chapter) => [String(chapter.id), String(chapter.slug)]),
  );
  const lessonIdByChapterId = new Map(
    (chapters ?? []).map((chapter) => [
      String(chapter.id),
      String(chapter.lesson_id),
    ]),
  );
  const lessonSlugById = new Map(
    (lessons ?? []).map((lesson) => [String(lesson.id), String(lesson.slug)]),
  );

  const items: StudentReviewItem[] = rows.map((row) => ({
    id: row.id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourceQuestionId: row.source_question_id,
    courseId: row.course_id,
    courseChapterId: row.course_chapter_id,
    courseTitle: row.course_id ? courseTitleById.get(row.course_id) ?? null : null,
    courseSlug: row.course_id ? courseSlugById.get(row.course_id) ?? null : null,
    lessonSlug: row.course_chapter_id
      ? lessonSlugById.get(lessonIdByChapterId.get(row.course_chapter_id) ?? "") ?? null
      : null,
    chapterTitle: row.course_chapter_id
      ? chapterTitleById.get(row.course_chapter_id) ?? null
      : null,
    chapterSlug: row.course_chapter_id
      ? chapterSlugById.get(row.course_chapter_id) ?? null
      : null,
    skill: row.skill,
    contentSnapshot: objectSnapshot(row.content_snapshot),
    studentAnswerSnapshot: objectSnapshot(row.student_answer_snapshot),
    feedbackSnapshot: objectSnapshot(row.feedback_snapshot),
    errorCount: Math.max(0, Number(row.error_count) || 0),
    status: (["pending", "reviewing", "mastered"].includes(row.status)
      ? row.status
      : "pending") as StudentReviewStatus,
    lastReviewedAt: row.last_reviewed_at,
    masteredAt: row.mastered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
  return { items, error: null };
}
