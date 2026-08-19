import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { loadCoursePracticeCatalog } from "@/lib/course-practice-catalog.server";
import {
  mapCourseContinuationTask,
  selectCourseContinuationCandidate,
  type CourseContinuationCandidate,
} from "./course-mapper.ts";
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

type LessonProgressRow = {
  lesson_id: string;
  status: "not_started" | "in_progress" | "completed";
  progress_percent: number;
  last_viewed_at: string | null;
  updated_at: string;
};

type EbookProgressRow = {
  test_slug: string;
  progress_percent: number;
  last_read_at: string;
  updated_at: string;
};

function throwReadError(label: string, error: { message: string } | null) {
  if (error) throw new Error(`首页继续课程${label}读取失败`, { cause: error });
}

export async function loadCourseContinuationTasks({
  supabase,
  studentId,
  studentAppId,
  appSlug,
  appLabel,
  space,
  now = new Date(),
}: LoadCourseContinuationTaskInput): Promise<HomeLearningTask[]> {
  const [catalog, lessonProgressResult, ebookProgressResult] = await Promise.all([
    loadCoursePracticeCatalog({ supabase, userId: studentId, now }),
    supabase
      .from("lesson_progress")
      .select("lesson_id,status,progress_percent,last_viewed_at,updated_at")
      .eq("user_id", studentId)
      .neq("status", "completed")
      .order("last_viewed_at", { ascending: false }),
    supabase
      .from("course_ebook_progress")
      .select("test_slug,progress_percent,last_read_at,updated_at")
      .eq("student_id", studentId)
      .eq("student_app_id", studentAppId)
      .lt("progress_percent", 100)
      .order("last_read_at", { ascending: false }),
  ]);
  throwReadError("课时进度", lessonProgressResult.error);
  throwReadError("教材进度", ebookProgressResult.error);

  const candidates: CourseContinuationCandidate[] = [];
  const chaptersBySlug = new Map<
    string,
    { course: (typeof catalog)[number]; chapter: (typeof catalog)[number]["chapters"][number] }
  >();
  for (const course of catalog) {
    for (const chapter of course.chapters) {
      chaptersBySlug.set(chapter.slug, { course, chapter });
    }
  }

  for (const progress of (lessonProgressResult.data ?? []) as LessonProgressRow[]) {
    const location = catalog.flatMap((course) =>
      course.chapters.flatMap((chapter) =>
        chapter.lesson_id === progress.lesson_id ? [{ course, chapter }] : [],
      ),
    )[0];
    if (!location) continue;
    candidates.push({
      sourceId: progress.lesson_id,
      courseId: location.course.id,
      courseChapterId: null,
      courseTitle: location.course.title,
      lessonTitle: location.chapter.lessonTitle,
      chapterTitle: null,
      categorySlug: "",
      subcategorySlug: "",
      courseSlug: location.course.slug,
      lessonSlug: location.chapter.lessonSlug,
      progressPercent: Number(progress.progress_percent) || 0,
      progressStatus: progress.status,
      isAvailable: location.course.isOpen && location.chapter.isOpen,
      updatedAt: progress.last_viewed_at ?? progress.updated_at,
    });
  }

  for (const progress of (ebookProgressResult.data ?? []) as EbookProgressRow[]) {
    const location = chaptersBySlug.get(progress.test_slug);
    if (!location) continue;
    candidates.push({
      sourceId: location.chapter.id,
      courseId: location.course.id,
      courseChapterId: location.chapter.id,
      courseTitle: location.course.title,
      lessonTitle: location.chapter.lessonTitle,
      chapterTitle: location.chapter.title,
      categorySlug: "",
      subcategorySlug: "",
      courseSlug: location.course.slug,
      lessonSlug: location.chapter.lessonSlug,
      progressPercent: Number(progress.progress_percent) || 0,
      progressStatus: Number(progress.progress_percent) > 0 ? "in_progress" : "not_started",
      isAvailable: location.course.isOpen && location.chapter.isOpen,
      updatedAt: progress.last_read_at ?? progress.updated_at,
    });
  }

  const selected = selectCourseContinuationCandidate(candidates);
  if (!selected) return [];

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("category_id")
    .eq("id", selected.courseId)
    .single();
  throwReadError("课程分类", courseError);
  if (!course?.category_id) return [];
  const { data: subcategory, error: subcategoryError } = await supabase
    .from("course_categories")
    .select("slug,parent_id")
    .eq("id", course.category_id)
    .single();
  throwReadError("课程子分类", subcategoryError);
  if (!subcategory?.parent_id) return [];
  const { data: category, error: categoryError } = await supabase
    .from("course_categories")
    .select("slug")
    .eq("id", subcategory.parent_id)
    .single();
  throwReadError("课程主分类", categoryError);
  if (!category?.slug || !subcategory.slug) return [];

  const task = mapCourseContinuationTask({
    candidate: {
      ...selected,
      categorySlug: String(category.slug),
      subcategorySlug: String(subcategory.slug),
    },
    studentAppId,
    appSlug,
    appLabel,
    space,
  });
  return task ? [task] : [];
}
