import { redirect } from "next/navigation";

import { requireActiveUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  GrowthToolboxManager,
  type CourseTree,
  type GrammarLibraryItem,
  type VocabularyLibraryItem,
} from "./GrowthToolboxManager";
import type { VocabularyWord } from "../digital-textbook/actions";

type CourseRow = { id: string; slug: string; title: string };
type LessonRow = { id: string; course_id: string; title: string };
type TextbookRow = { id: string; lesson_id: string; slug: string; title: unknown; status: string };
type VersionRow = { id: string; textbook_id: string };
type ChapterRow = { id: string; version_id: string; slug: string; chapter_number: number };

function localizedTitle(value: unknown): string {
  if (!value || typeof value !== "object") return String(value ?? "");
  const record = value as Record<string, unknown>;
  return String(record["zh-CN"] ?? record["ko-KR"] ?? "");
}

export default async function GrowthToolboxAdminPage() {
  const { supabase: userSupabase } = await requireActiveUser();
  const { data: canManage } = await userSupabase.rpc(
    "current_user_can_manage_standard_question_bank"
  );
  if (!canManage) redirect("/dashboard/admin");

  const supabase = createAdminClient();

  const [{ data: courseRows }, { data: lessonRows }] = await Promise.all([
    supabase.from("courses").select("id,slug,title").order("sort_order", { ascending: true }),
    supabase.from("lessons").select("id,course_id,title"),
  ]);
  const courses = (courseRows ?? []) as CourseRow[];
  const lessons = (lessonRows ?? []) as LessonRow[];

  const lessonIds = lessons.map((lesson) => lesson.id);
  const { data: textbookRows } = lessonIds.length
    ? await supabase
        .from("digital_textbooks")
        .select("id,lesson_id,slug,title,status")
        .in("lesson_id", lessonIds)
    : { data: [] as TextbookRow[] };
  const textbooks = (textbookRows ?? []) as TextbookRow[];
  const textbookIds = textbooks.map((textbook) => textbook.id);

  const { data: versionRows } = textbookIds.length
    ? await supabase
        .from("digital_textbook_versions")
        .select("id,textbook_id")
        .in("textbook_id", textbookIds)
    : { data: [] as VersionRow[] };
  const versions = (versionRows ?? []) as VersionRow[];
  const versionIds = versions.map((version) => version.id);

  const { data: chapterRows } = versionIds.length
    ? await supabase
        .from("digital_textbook_chapters")
        .select("id,version_id,slug,chapter_number")
        .in("version_id", versionIds)
        .order("chapter_number", { ascending: true })
    : { data: [] as ChapterRow[] };
  const chapters = (chapterRows ?? []) as ChapterRow[];

  const chapterByVersionId = new Map(chapters.map((chapter) => [chapter.version_id, chapter]));
  const versionByTextbookId = new Map(versions.map((version) => [version.textbook_id, version]));
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

  // 词汇模块节点（供章节词汇编辑）
  const chapterIds = chapters.map((chapter) => chapter.id);
  const { data: vocabModuleRows } = chapterIds.length
    ? await supabase
        .from("digital_textbook_modules")
        .select("id,chapter_id")
        .in("chapter_id", chapterIds)
        .eq("module_code", "vocabulary")
    : { data: [] as { id: string; chapter_id: string }[] };
  const vocabModuleIds = (vocabModuleRows ?? []).map((module) => module.id);
  const { data: vocabNodeRows } = vocabModuleIds.length
    ? await supabase
        .from("digital_textbook_nodes")
        .select("id,module_id,content")
        .in("module_id", vocabModuleIds)
    : { data: [] as { id: string; module_id: string; content: Record<string, unknown> | null }[] };
  const vocabularyNodesByChapter = new Map<
    string,
    { id: string; vocabulary: VocabularyWord[] }[]
  >();
  for (const module of vocabModuleRows ?? []) {
    const nodesForModule = (vocabNodeRows ?? [])
      .filter((node) => node.module_id === module.id)
      .map((node) => ({
        id: node.id,
        vocabulary: (Array.isArray(node.content?.vocabulary)
          ? node.content.vocabulary
          : []
        ).filter(
          (word): word is VocabularyWord =>
            Boolean(word) && typeof word === "object" && Boolean((word as VocabularyWord).ko || (word as VocabularyWord).zh)
        ),
      }));
    const existing = vocabularyNodesByChapter.get(module.chapter_id) ?? [];
    vocabularyNodesByChapter.set(module.chapter_id, [...existing, ...nodesForModule]);
  }

  const courseTree: CourseTree[] = [];
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
                  const vocabularyNodes = vocabularyNodesByChapter.get(chapter.id) ?? [];
                  return {
                    id: chapter.id,
                    number: chapter.chapter_number,
                    slug: chapter.slug,
                    vocabularyNodes,
                    vocabularyCount: vocabularyNodes.reduce(
                      (sum, node) => sum + node.vocabulary.length,
                      0
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

  const { data: libraryRows } = await supabase
    .from("growth_toolbox_vocabulary")
    .select("id,ko,zh,pos,collocation,transcription,source,sort_order")
    .order("sort_order", { ascending: true });
  const vocabularyLibrary: VocabularyLibraryItem[] = (libraryRows ?? []).map((row) => ({
    id: row.id,
    ko: row.ko,
    zh: row.zh,
    pos: row.pos,
    collocation: row.collocation,
    transcription: row.transcription,
    source: row.source === "textbook" ? "textbook" : "custom",
    sortOrder: row.sort_order,
  }));

  const { data: grammarRows } = await supabase
    .from("growth_toolbox_grammar")
    .select("id,title,meaning,cases,rows,examples,caution,source,sort_order")
    .order("sort_order", { ascending: true });
  const grammarLibrary: GrammarLibraryItem[] = (grammarRows ?? []).map((row) => ({
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

  return (
    <div className="mx-auto w-full max-w-[1600px] px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-black tracking-tight">成长工具箱 · 课程结构</h2>
        </div>
      </div>

      <GrowthToolboxManager
        courseTree={courseTree}
        vocabularyLibrary={vocabularyLibrary}
        grammarLibrary={grammarLibrary}
      />
    </div>
  );
}
