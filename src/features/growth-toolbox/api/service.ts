import "server-only";

import { redirect } from "next/navigation";

import { requireActiveUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  GrowthToolboxCourseTree,
  GrowthToolboxGrammarItem,
  GrowthToolboxItem,
  GrowthToolboxManagementResult,
  GrowthToolboxVocabularyItem,
  GrowthToolboxVocabularyWord,
} from "./types";

type CourseRow = { id: string; slug: string; title: string };
type LessonRow = { id: string; course_id: string; title: string };
type TextbookRow = {
  id: string;
  lesson_id: string;
  slug: string;
  title: unknown;
  status: string;
};
type VersionRow = { id: string; textbook_id: string };
type ChapterRow = {
  id: string;
  version_id: string;
  slug: string;
  chapter_number: number;
};
type ToolboxItemRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  href: string;
  icon_name: string;
  accent: string;
  soft: string;
  sort_order: number;
  is_enabled: boolean;
  related_course_id: string | null;
};

function localizedTitle(value: unknown): string {
  if (!value || typeof value !== "object") return String(value ?? "");
  const record = value as Record<string, unknown>;
  return String(record["zh-CN"] ?? record["ko-KR"] ?? "");
}

export async function getGrowthToolboxManagementData(): Promise<GrowthToolboxManagementResult> {
  const { supabase: userSupabase } = await requireActiveUser();
  const { data: canManage } = await userSupabase.rpc(
    "current_user_can_manage_standard_question_bank",
  );
  if (!canManage) redirect("/dashboard/admin");

  const supabase = createAdminClient();

  const [toolboxItemsResult, courseResult, lessonResult] = await Promise.all([
    supabase
      .from("growth_toolbox_items")
      .select(
        "id,slug,title,description,href,icon_name,accent,soft,sort_order,is_enabled,related_course_id",
      )
      .order("sort_order", { ascending: true }),
    supabase
      .from("courses")
      .select("id,slug,title")
      .order("sort_order", { ascending: true }),
    supabase.from("lessons").select("id,course_id,title"),
  ]);

  const toolboxItems: GrowthToolboxItem[] = (
    (toolboxItemsResult.data ?? []) as ToolboxItemRow[]
  ).map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    href: row.href,
    iconName: row.icon_name,
    accent: row.accent,
    soft: row.soft,
    sortOrder: row.sort_order,
    isEnabled: row.is_enabled,
    relatedCourseId: row.related_course_id,
  }));
  const courses = (courseResult.data ?? []) as CourseRow[];
  const lessons = (lessonResult.data ?? []) as LessonRow[];

  const lessonIds = lessons.map((lesson) => lesson.id);
  const textbookResult = lessonIds.length
    ? await supabase
        .from("digital_textbooks")
        .select("id,lesson_id,slug,title,status")
        .in("lesson_id", lessonIds)
    : { data: [] as TextbookRow[], error: null };
  const textbooks = (textbookResult.data ?? []) as TextbookRow[];
  const textbookIds = textbooks.map((textbook) => textbook.id);

  const versionResult = textbookIds.length
    ? await supabase
        .from("digital_textbook_versions")
        .select("id,textbook_id")
        .in("textbook_id", textbookIds)
    : { data: [] as VersionRow[], error: null };
  const versions = (versionResult.data ?? []) as VersionRow[];
  const versionIds = versions.map((version) => version.id);

  const chapterResult = versionIds.length
    ? await supabase
        .from("digital_textbook_chapters")
        .select("id,version_id,slug,chapter_number")
        .in("version_id", versionIds)
        .order("chapter_number", { ascending: true })
    : { data: [] as ChapterRow[], error: null };
  const chapters = (chapterResult.data ?? []) as ChapterRow[];

  const chapterByVersionId = new Map(
    chapters.map((chapter) => [chapter.version_id, chapter]),
  );
  const versionByTextbookId = new Map(
    versions.map((version) => [version.textbook_id, version]),
  );
  const textbooksByLessonId = new Map<string, TextbookRow[]>();
  for (const textbook of textbooks) {
    const list = textbooksByLessonId.get(textbook.lesson_id) ?? [];
    list.push(textbook);
    textbooksByLessonId.set(textbook.lesson_id, list);
  }
  const lessonsByCourseId = new Map<string, LessonRow[]>();
  for (const lesson of lessons) {
    const list = lessonsByCourseId.get(lesson.course_id) ?? [];
    list.push(lesson);
    lessonsByCourseId.set(lesson.course_id, list);
  }

  const chapterIds = chapters.map((chapter) => chapter.id);
  const vocabularyModuleResult = chapterIds.length
    ? await supabase
        .from("digital_textbook_modules")
        .select("id,chapter_id")
        .in("chapter_id", chapterIds)
        .eq("module_code", "vocabulary")
    : { data: [] as { id: string; chapter_id: string }[], error: null };
  const vocabularyModuleIds = (vocabularyModuleResult.data ?? []).map(
    (module) => module.id,
  );
  const vocabularyNodeResult = vocabularyModuleIds.length
    ? await supabase
        .from("digital_textbook_nodes")
        .select("id,module_id,content")
        .in("module_id", vocabularyModuleIds)
    : {
        data: [] as {
          id: string;
          module_id: string;
          content: Record<string, unknown> | null;
        }[],
        error: null,
      };
  const vocabularyNodesByChapter = new Map<
    string,
    { id: string; vocabulary: GrowthToolboxVocabularyWord[] }[]
  >();
  for (const vocabularyModule of vocabularyModuleResult.data ?? []) {
    const nodesForModule = (vocabularyNodeResult.data ?? [])
      .filter((node) => node.module_id === vocabularyModule.id)
      .map((node) => ({
        id: node.id,
        vocabulary: (Array.isArray(node.content?.vocabulary)
          ? node.content.vocabulary
          : []
        ).filter(
          (word: unknown): word is GrowthToolboxVocabularyWord =>
            Boolean(word) &&
            typeof word === "object" &&
            Boolean(
              (word as GrowthToolboxVocabularyWord).ko ||
                (word as GrowthToolboxVocabularyWord).zh,
            ),
        ),
      }));
    const existing =
      vocabularyNodesByChapter.get(vocabularyModule.chapter_id) ?? [];
    vocabularyNodesByChapter.set(vocabularyModule.chapter_id, [
      ...existing,
      ...nodesForModule,
    ]);
  }

  const courseTree: GrowthToolboxCourseTree[] = [];
  for (const course of courses) {
    const courseLessons = lessonsByCourseId.get(course.id) ?? [];
    const lessonNodes = courseLessons
      .map((lesson) => {
        const lessonTextbooks = textbooksByLessonId.get(lesson.id) ?? [];
        const textbookNodes = lessonTextbooks.map((textbook) => {
          const version = versionByTextbookId.get(textbook.id);
          const chapterNodes = version
            ? [chapterByVersionId.get(version.id)]
                .filter((chapter): chapter is ChapterRow => Boolean(chapter))
                .map((chapter) => {
                  const vocabularyNodes =
                    vocabularyNodesByChapter.get(chapter.id) ?? [];
                  return {
                    id: chapter.id,
                    number: chapter.chapter_number,
                    slug: chapter.slug,
                    vocabularyNodes,
                    vocabularyCount: vocabularyNodes.reduce(
                      (sum, node) => sum + node.vocabulary.length,
                      0,
                    ),
                  };
                })
            : [];
          return {
            id: textbook.id,
            title: localizedTitle(textbook.title),
            slug: textbook.slug,
            status: textbook.status,
            chapters: chapterNodes,
          };
        });
        return {
          id: lesson.id,
          title: lesson.title,
          textbooks: textbookNodes,
        };
      })
      .filter((lesson) => lesson.textbooks.length > 0);

    if (lessonNodes.length > 0) {
      courseTree.push({
        id: course.id,
        title: course.title,
        slug: course.slug,
        lessons: lessonNodes,
      });
    }
  }

  const [vocabularyResult, grammarResult] = await Promise.all([
    supabase
      .from("growth_toolbox_vocabulary")
      .select("id,ko,zh,pos,collocation,transcription,source,sort_order")
      .order("sort_order", { ascending: true }),
    supabase
      .from("growth_toolbox_grammar")
      .select("id,title,meaning,cases,rows,examples,caution,source,sort_order")
      .order("sort_order", { ascending: true }),
  ]);
  const vocabularyLibrary: GrowthToolboxVocabularyItem[] = (
    vocabularyResult.data ?? []
  ).map((row) => ({
    id: row.id,
    ko: row.ko,
    zh: row.zh,
    pos: row.pos,
    collocation: row.collocation,
    transcription: row.transcription,
    source: row.source === "textbook" ? "textbook" : "custom",
    sortOrder: row.sort_order,
  }));
  const grammarLibrary: GrowthToolboxGrammarItem[] = (
    grammarResult.data ?? []
  ).map((row) => ({
    id: row.id,
    title: row.title,
    meaning: row.meaning,
    cases: Array.isArray(row.cases)
      ? row.cases.map((caseRow) => ({
          batchim: String(caseRow?.batchim ?? ""),
          conjugation: String(caseRow?.conjugation ?? ""),
        }))
      : [],
    rows: Array.isArray(row.rows)
      ? row.rows.map((rowItem) => ({
          form: String(rowItem?.form ?? ""),
          combination: String(rowItem?.combination ?? ""),
          audio: String(rowItem?.audio ?? ""),
        }))
      : [],
    examples: Array.isArray(row.examples)
      ? row.examples.map((example) => ({
          ko: String(example?.ko ?? ""),
          zh: String(example?.zh ?? ""),
          audio: String(example?.audio ?? ""),
        }))
      : [],
    caution: row.caution,
    source: row.source === "textbook" ? "textbook" : "custom",
    sortOrder: row.sort_order,
  }));

  return {
    toolboxItems,
    courseTree,
    vocabularyLibrary,
    grammarLibrary,
    hasError: Boolean(
      toolboxItemsResult.error ||
        courseResult.error ||
        lessonResult.error ||
        textbookResult.error ||
        versionResult.error ||
        chapterResult.error ||
        vocabularyModuleResult.error ||
        vocabularyNodeResult.error ||
        vocabularyResult.error ||
        grammarResult.error,
    ),
  };
}
