import "server-only";

import { redirect } from "next/navigation";

import { requireActiveUser } from "@/lib/auth";
import { requireTenantAppCapability } from "@/lib/tenant-app-capabilities";
import { STUDENT_APP_IDS } from "@/lib/student-apps";
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
type VocabularyNodeRow = {
  id: string;
  module_id: string;
  content: Record<string, unknown> | null;
};
type NestedVocabularyModuleRow = {
  id: string;
  chapter_id: string;
  module_code: string;
  digital_textbook_nodes: VocabularyNodeRow[];
};
type NestedChapterRow = ChapterRow & {
  digital_textbook_modules: NestedVocabularyModuleRow[];
};
type NestedVersionRow = VersionRow & {
  digital_textbook_chapters: NestedChapterRow[];
};
type NestedTextbookRow = TextbookRow & {
  digital_textbook_versions: NestedVersionRow[];
};
type LessonWithTextbook = LessonRow & {
  digital_textbooks: NestedTextbookRow | null;
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

export async function getGrowthToolboxManagementData(
  studentAppId: string,
): Promise<GrowthToolboxManagementResult> {
  const auth = await requireActiveUser();
  const { supabase: userSupabase } = auth;
  const { data: canManage } = await userSupabase.rpc(
    "current_user_can_manage_standard_question_bank",
  );
  if (!new Set(Object.values(STUDENT_APP_IDS)).has(studentAppId)) {
    redirect("/dashboard/admin/apps");
  }
  if (auth.tenant) {
    await requireTenantAppCapability(studentAppId, "manageContent");
  } else if (
    auth.platformProfile?.global_role !== "platform_owner" &&
    auth.platformProfile?.global_role !== "platform_admin"
  ) {
    redirect("/dashboard/admin/apps");
  }

  const supabase = createAdminClient();

  let toolboxItemsQuery = supabase
    .from("growth_toolbox_items")
    .select(
      "id,slug,title,description,href,icon_name,accent,soft,sort_order,is_enabled,related_course_id",
    );
  let courseQuery = supabase.from("courses").select("id,slug,title");
  toolboxItemsQuery = toolboxItemsQuery.eq("student_app_id", studentAppId);
  courseQuery = courseQuery.eq("student_app_id", studentAppId);

  const [
    toolboxItemsResult,
    courseResult,
    vocabularyResult,
    grammarResult,
  ] = await Promise.all([
    toolboxItemsQuery.order("sort_order", { ascending: true }),
    courseQuery.order("sort_order", { ascending: true }),
    supabase
      .from("growth_toolbox_vocabulary")
      .select("id,ko,zh,pos,collocation,transcription,source,sort_order")
      .eq("student_app_id", studentAppId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("growth_toolbox_grammar")
      .select("id,title,meaning,cases,rows,examples,caution,source,sort_order")
      .eq("student_app_id", studentAppId)
      .order("sort_order", { ascending: true }),
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
  const courseIds = courses.map((course) => course.id);
  const lessonResult = courseIds.length
    ? await supabase
        .from("lessons")
        .select(
          "id,course_id,title,digital_textbooks!digital_textbooks_lesson_id_fkey(id,lesson_id,slug,title,status,digital_textbook_versions!digital_textbook_versions_textbook_id_fkey(id,textbook_id,digital_textbook_chapters!digital_textbook_chapters_version_id_fkey(id,version_id,slug,chapter_number,digital_textbook_modules!digital_textbook_modules_chapter_id_fkey(id,chapter_id,module_code,digital_textbook_nodes!digital_textbook_nodes_module_id_fkey(id,module_id,content)))))",
        )
        .in("course_id", courseIds)
        .eq(
          "digital_textbooks.digital_textbook_versions.digital_textbook_chapters.digital_textbook_modules.module_code",
          "vocabulary",
        )
        .order("chapter_number", {
          referencedTable:
            "digital_textbooks.digital_textbook_versions.digital_textbook_chapters",
        })
    : { data: [] as LessonWithTextbook[], error: null };
  const nestedLessons = (lessonResult.data ?? []) as LessonWithTextbook[];
  const lessons: LessonRow[] = nestedLessons.map((row) => {
    const lesson = { ...row };
    Reflect.deleteProperty(lesson, "digital_textbooks");
    return lesson;
  });
  const nestedTextbooks = nestedLessons
    .map((lesson) => lesson.digital_textbooks)
    .filter((textbook): textbook is NestedTextbookRow => Boolean(textbook));
  const textbooks: TextbookRow[] = nestedTextbooks.map((row) => {
    const textbook = { ...row };
    Reflect.deleteProperty(textbook, "digital_textbook_versions");
    return textbook;
  });
  const nestedVersions = nestedTextbooks.flatMap(
    (textbook) => textbook.digital_textbook_versions,
  );
  const versions: VersionRow[] = nestedVersions.map((row) => {
    const version = { ...row };
    Reflect.deleteProperty(version, "digital_textbook_chapters");
    return version;
  });
  const nestedChapters = nestedVersions.flatMap(
    (version) => version.digital_textbook_chapters,
  );
  const chapters: ChapterRow[] = nestedChapters.map((row) => {
    const chapter = { ...row };
    Reflect.deleteProperty(chapter, "digital_textbook_modules");
    return chapter;
  });

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

  const vocabularyModules = nestedChapters.flatMap(
    (chapter) => chapter.digital_textbook_modules,
  );
  const vocabularyNodesByChapter = new Map<
    string,
    { id: string; vocabulary: GrowthToolboxVocabularyWord[] }[]
  >();
  for (const vocabularyModule of vocabularyModules) {
    const nodesForModule = vocabularyModule.digital_textbook_nodes
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
    canManage: canManage === true,
    toolboxItems,
    courseTree,
    vocabularyLibrary,
    grammarLibrary,
    hasError: Boolean(
      toolboxItemsResult.error ||
        courseResult.error ||
        lessonResult.error ||
        vocabularyResult.error ||
        grammarResult.error,
    ),
  };
}
