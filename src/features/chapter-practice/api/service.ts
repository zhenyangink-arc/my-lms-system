import "server-only";

import { requirePlatformOwner } from "@/lib/admin";
import { STUDENT_APP_IDS } from "@/lib/student-apps";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildChapterPracticeCoverage } from "./coverage";
import type {
  ChapterPracticeCoverageResult,
  CoverageChapterRow,
  CoverageChapterTestRow,
  CoverageCourseRow,
  CoverageExerciseRow,
  CoverageHomeworkRow,
  CoverageLessonRow,
  CoveragePracticeUnitRow,
  CoverageTextbookChapterRow,
  CoverageTextbookModuleRow,
  CoverageTextbookNodeRow,
  CoverageTextbookRow,
  CoverageTextbookVersionRow,
} from "./types";

type QueryFailure = { message: string };

function failOnQueryError(label: string, error: QueryFailure | null) {
  if (error) {
    throw new Error(`巩固覆盖矩阵的${label}读取失败`, { cause: error });
  }
}

export async function getChapterPracticeCoverage(): Promise<ChapterPracticeCoverageResult> {
  // 数据访问层再次鉴权，不能依赖工作台卡片或路由层的可见性判断。
  await requirePlatformOwner();
  const supabase = createAdminClient();
  const koreanAppId = STUDENT_APP_IDS.korean;

  const courseResult = await supabase
    .from("courses")
    .select("id,slug,title,is_published,sort_order")
    .eq("student_app_id", koreanAppId)
    .eq("content_scope", "platform")
    .order("sort_order", { ascending: true });
  failOnQueryError("课程", courseResult.error);
  const courses = (courseResult.data ?? []) as CoverageCourseRow[];
  const courseIds = courses.map((course) => course.id);

  const lessonResult = courseIds.length
    ? await supabase
        .from("lessons")
        .select("id,course_id,slug,title,is_published,sort_order")
        .in("course_id", courseIds)
        .eq("content_scope", "platform")
        .order("sort_order", { ascending: true })
    : { data: [], error: null };
  failOnQueryError("课时", lessonResult.error);
  const lessons = (lessonResult.data ?? []) as CoverageLessonRow[];
  const lessonIds = lessons.map((lesson) => lesson.id);

  const chapterResult = lessonIds.length
    ? await supabase
        .from("course_chapters")
        .select(
          "id,lesson_id,chapter_test_id,slug,title,is_published,sort_order",
        )
        .in("lesson_id", lessonIds)
        .eq("content_scope", "platform")
        .order("sort_order", { ascending: true })
    : { data: [], error: null };
  failOnQueryError("章节", chapterResult.error);
  const chapters = (chapterResult.data ?? []) as CoverageChapterRow[];
  const chapterIds = chapters.map((chapter) => chapter.id);
  const chapterTestIds = chapters.flatMap((chapter) =>
    chapter.chapter_test_id ? [chapter.chapter_test_id] : [],
  );

  const [
    chapterTestResult,
    textbookResult,
    exerciseResult,
    homeworkResult,
    practiceUnitResult,
  ] = await Promise.all([
    chapterTestIds.length
      ? supabase
          .from("chapter_tests")
          .select("id,status")
          .in("id", chapterTestIds)
      : Promise.resolve({ data: [], error: null }),
    lessonIds.length
      ? supabase
          .from("digital_textbooks")
          .select("id,lesson_id,status")
          .eq("student_app_id", koreanAppId)
          .in("lesson_id", lessonIds)
      : Promise.resolve({ data: [], error: null }),
    chapterTestIds.length
      ? supabase
          .from("growth_toolbox_exercises")
          .select("chapter_test_id,skill,status")
          .eq("student_app_id", koreanAppId)
          .in("chapter_test_id", chapterTestIds)
      : Promise.resolve({ data: [], error: null }),
    chapterTestIds.length
      ? supabase
          .from("chapter_homework_plans")
          .select("test_id,status")
          .in("test_id", chapterTestIds)
      : Promise.resolve({ data: [], error: null }),
    chapterIds.length
      ? supabase
          .from("chapter_practice_units")
          .select("id,course_chapter_id,version,status,updated_at")
          .eq("student_app_id", koreanAppId)
          .in("course_chapter_id", chapterIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  failOnQueryError("章节测试", chapterTestResult.error);
  failOnQueryError("互动教材", textbookResult.error);
  failOnQueryError("六项练习", exerciseResult.error);
  failOnQueryError("章节作业", homeworkResult.error);
  failOnQueryError("巩固内容", practiceUnitResult.error);

  const textbooks = (textbookResult.data ?? []) as CoverageTextbookRow[];
  const textbookIds = textbooks.map((textbook) => textbook.id);
  const versionResult = textbookIds.length
    ? await supabase
        .from("digital_textbook_versions")
        .select("id,textbook_id,version_number,status")
        .in("textbook_id", textbookIds)
    : { data: [], error: null };
  failOnQueryError("教材版本", versionResult.error);
  const textbookVersions = (versionResult.data ??
    []) as CoverageTextbookVersionRow[];
  const versionIds = textbookVersions.map((version) => version.id);

  const textbookChapterResult = versionIds.length && chapterTestIds.length
    ? await supabase
        .from("digital_textbook_chapters")
        .select("id,version_id,chapter_test_id,status,updated_at")
        .in("version_id", versionIds)
        .in("chapter_test_id", chapterTestIds)
    : { data: [], error: null };
  failOnQueryError("教材章节", textbookChapterResult.error);
  const textbookChapters = (textbookChapterResult.data ??
    []) as CoverageTextbookChapterRow[];
  const textbookChapterIds = textbookChapters.map((chapter) => chapter.id);

  const moduleResult = textbookChapterIds.length
    ? await supabase
        .from("digital_textbook_modules")
        .select("id,chapter_id,module_code")
        .in("chapter_id", textbookChapterIds)
        .in("module_code", ["vocabulary", "grammar"])
    : { data: [], error: null };
  failOnQueryError("教材词汇与语法模块", moduleResult.error);
  const textbookModules = (moduleResult.data ??
    []) as CoverageTextbookModuleRow[];
  const moduleIds = textbookModules.map((module) => module.id);

  const nodeResult = moduleIds.length
    ? await supabase
        .from("digital_textbook_nodes")
        .select("module_id,content")
        .in("module_id", moduleIds)
    : { data: [], error: null };
  failOnQueryError("教材词汇与语法内容", nodeResult.error);

  return buildChapterPracticeCoverage({
    courses,
    lessons,
    chapters,
    chapterTests: (chapterTestResult.data ?? []) as CoverageChapterTestRow[],
    textbooks,
    textbookVersions,
    textbookChapters,
    textbookModules,
    textbookNodes: (nodeResult.data ?? []) as CoverageTextbookNodeRow[],
    exercises: (exerciseResult.data ?? []) as CoverageExerciseRow[],
    homeworkPlans: (homeworkResult.data ?? []) as CoverageHomeworkRow[],
    practiceUnits: (practiceUnitResult.data ?? []) as CoveragePracticeUnitRow[],
  });
}
