import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PlanLearningSource = {
  id: string; title: string; courseId: string; sourceType: "assessment_paper" | "chapter_practice" | "specialized_practice";
  skill: string | null; path: string;
};

export async function loadPlanLearningSources(supabase: SupabaseClient, appId: string): Promise<PlanLearningSource[]> {
  const courses = await supabase.from("courses").select("id,slug").eq("student_app_id", appId).eq("content_scope", "platform").eq("is_published", true);
  if (courses.error) throw new Error("计划课程来源读取失败");
  if (!courses.data?.length) return [];
  const lessons = await supabase.from("lessons").select("id,course_id,slug").in("course_id", courses.data.map(c => c.id)).eq("is_published", true);
  if (lessons.error) throw new Error("计划课时来源读取失败");
  if (!lessons.data?.length) return [];
  const [chapters, tests, papers, units, exercises] = await Promise.all([
    supabase.from("course_chapters").select("id,lesson_id,slug").in("lesson_id", lessons.data.map(l => l.id)).eq("is_published", true),
    supabase.from("chapter_tests").select("id,lesson_id").eq("student_app_id", appId),
    supabase.from("assessment_papers").select("id,title,source_test_id").eq("student_app_id", appId).eq("status", "published").eq("paper_type", "exam"),
    supabase.from("chapter_practice_units").select("id,title,course_chapter_id,version").eq("student_app_id", appId).eq("status", "published"),
    supabase.from("growth_toolbox_exercises").select("id,title,course_chapter_id,skill").eq("student_app_id", appId).eq("status", "published"),
  ]);
  if ([chapters,tests,papers,units,exercises].some(r => r.error)) throw new Error("计划试卷或练习来源读取失败");
  const lessonMap = new Map(lessons.data.map(l => [l.id,l]));
  const chapterMap = new Map((chapters.data ?? []).map(c => [c.id,c]));
  const testMap = new Map((tests.data ?? []).map(t => [t.id,t]));
  const courseMap = new Map(courses.data.map(c => [c.id,c]));
  const result: PlanLearningSource[] = [];
  for (const paper of papers.data ?? []) {
    const lesson = lessonMap.get(testMap.get(paper.source_test_id)?.lesson_id);
    if (lesson) result.push({ id: paper.id, title: paper.title, courseId: lesson.course_id, sourceType: "assessment_paper", skill: null, path: "/dashboard/assignments" });
  }
  for (const row of [...(units.data ?? []).map(u => ({ ...u, skill: null as string | null, sourceType: "chapter_practice" as const })),
    ...(exercises.data ?? []).map(e => ({ ...e, version: null, sourceType: "specialized_practice" as const }))]) {
    const chapter = chapterMap.get(row.course_chapter_id);
    const lesson = lessonMap.get(chapter?.lesson_id);
    const course = courseMap.get(lesson?.course_id);
    if (!chapter || !lesson || !course) continue;
    result.push({ id: row.id, title: row.version ? `${row.title} · 第 ${row.version} 版` : row.title,
      courseId: course.id, sourceType: row.sourceType, skill: row.skill,
      path: row.sourceType === "chapter_practice"
        ? `/dashboard/practice/course/${encodeURIComponent(course.slug)}/${encodeURIComponent(chapter.slug)}`
        : `/dashboard/training/${encodeURIComponent(row.skill!)}/${encodeURIComponent(course.slug)}/${encodeURIComponent(lesson.slug)}/${encodeURIComponent(chapter.slug)}` });
  }
  return result;
}
