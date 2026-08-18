import "server-only";

import { redirect } from "next/navigation";

import { requireActiveUser } from "@/lib/auth";
import { requireTenantAppCapability } from "@/lib/tenant-app-capabilities";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  DigitalTextbookCourse,
  DigitalTextbookGrammarItem,
  DigitalTextbookGrammarLibraryItem,
  DigitalTextbookLesson,
  DigitalTextbookManagementResult,
  DigitalTextbookVocabularyLibraryItem,
  DigitalTextbookVocabularyWord,
} from "./types";

type TextbookRow = {
  id: string;
  lesson_id: string;
  slug: string;
  level_code: string;
  title: unknown;
  status: string;
};

type LessonRow = { id: string; title: string; course_id: string };
type CourseRow = { id: string; title: string };
type VersionRow = {
  id: string;
  textbook_id: string;
  version_number: number;
  status: string;
};
type ChapterRow = {
  id: string;
  version_id: string;
  slug: string;
  chapter_number: number;
  status: string;
};
type ModuleRow = {
  id: string;
  chapter_id: string;
  module_code: string;
};
type NodeRow = {
  id: string;
  module_id: string;
  content: Record<string, unknown> | null;
};
type NestedModuleRow = ModuleRow & {
  digital_textbook_nodes: NodeRow[];
};
type NestedChapterRow = ChapterRow & {
  digital_textbook_modules: NestedModuleRow[];
};
type NestedVersionRow = VersionRow & {
  digital_textbook_chapters: NestedChapterRow[];
};
type NestedTextbookRow = TextbookRow & {
  lessons: LessonRow | LessonRow[] | null;
  digital_textbook_versions: NestedVersionRow[];
};
type VocabularyLibraryRow = {
  id: string;
  ko: string;
  zh: string;
  pos: string;
  collocation: string;
  transcription: string;
  source: string;
  sort_order: number;
};
type GrammarLibraryRow = {
  id: string;
  title: string;
  meaning: string;
  cases: unknown;
  rows: unknown;
  examples: unknown;
  caution: string;
  source: string;
  sort_order: number;
};

function localizedTitle(value: unknown): string {
  if (!value || typeof value !== "object") return String(value ?? "");
  const record = value as Record<string, unknown>;
  return String(record["zh-CN"] ?? record["ko-KR"] ?? "");
}

function vocabularyOf(
  content: Record<string, unknown> | null,
): DigitalTextbookVocabularyWord[] {
  if (!content) return [];
  const raw = Array.isArray(content.vocabulary) ? content.vocabulary : [];
  return raw.filter(
    (item): item is DigitalTextbookVocabularyWord =>
      Boolean(item) &&
      typeof item === "object" &&
      (Boolean((item as DigitalTextbookVocabularyWord).ko) ||
        Boolean((item as DigitalTextbookVocabularyWord).zh)),
  );
}

function grammarOf(
  content: Record<string, unknown> | null,
): DigitalTextbookGrammarItem[] {
  if (!content) return [];
  const raw = Array.isArray(content.grammar) ? content.grammar : [];
  return raw.filter(
    (item): item is DigitalTextbookGrammarItem =>
      Boolean(item) &&
      typeof item === "object" &&
      Boolean((item as DigitalTextbookGrammarItem).title),
  );
}

export async function getDigitalTextbookManagementData(
  studentAppId: string,
): Promise<DigitalTextbookManagementResult> {
  const auth = await requireActiveUser();
  const { supabase: userSupabase } = auth;
  const canPublishChapters =
    auth.platformProfile?.global_role === "platform_owner" && !auth.tenant;
  const { data: canManage } = await userSupabase.rpc(
    "current_user_can_manage_standard_question_bank",
  );
  if (!studentAppId) redirect("/dashboard/admin/apps");
  if (auth.tenant) {
    await requireTenantAppCapability(studentAppId, "manageContent");
  } else if (
    auth.platformProfile?.global_role !== "platform_owner" &&
    auth.platformProfile?.global_role !== "platform_admin"
  ) {
    redirect("/dashboard/admin/apps");
  }

  const supabase = createAdminClient();

  let textbookQuery = supabase
    .from("digital_textbooks")
    .select(
      "id,lesson_id,slug,level_code,title,status,lessons!digital_textbooks_lesson_id_fkey(id,title,course_id),digital_textbook_versions!digital_textbook_versions_textbook_id_fkey(id,textbook_id,version_number,status,digital_textbook_chapters!digital_textbook_chapters_version_id_fkey(id,version_id,slug,chapter_number,status,digital_textbook_modules!digital_textbook_modules_chapter_id_fkey(id,chapter_id,module_code,digital_textbook_nodes!digital_textbook_nodes_module_id_fkey(id,module_id,content))))",
    )
    .eq("student_app_id", studentAppId)
    .in(
      "digital_textbook_versions.digital_textbook_chapters.digital_textbook_modules.module_code",
      ["vocabulary", "grammar"],
    );
  if (!canManage && !canPublishChapters) {
    textbookQuery = textbookQuery.eq("status", "published");
  }

  const [
    textbookResult,
    courseResult,
    vocabularyLibraryResult,
    grammarLibraryResult,
  ] = await Promise.all([
    textbookQuery
      .order("created_at", { ascending: true })
      .order("version_number", {
        referencedTable: "digital_textbook_versions",
      })
      .order("chapter_number", {
        referencedTable:
          "digital_textbook_versions.digital_textbook_chapters",
      }),
    supabase
      .from("courses")
      .select("id,title")
      .eq("student_app_id", studentAppId),
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

  const nestedTextbooks = (textbookResult.data ?? []) as NestedTextbookRow[];
  const textbooks: TextbookRow[] = nestedTextbooks.map((row) => {
    const textbook = { ...row };
    Reflect.deleteProperty(textbook, "lessons");
    Reflect.deleteProperty(textbook, "digital_textbook_versions");
    return textbook;
  });
  const lessons = nestedTextbooks
    .map((textbook) =>
      Array.isArray(textbook.lessons)
        ? (textbook.lessons[0] ?? null)
        : textbook.lessons,
    )
    .filter((lesson): lesson is LessonRow => Boolean(lesson));
  const versions: VersionRow[] = nestedTextbooks.flatMap((textbook) =>
    textbook.digital_textbook_versions.map((row) => {
      const version = { ...row };
      Reflect.deleteProperty(version, "digital_textbook_chapters");
      return version;
    }),
  );
  const nestedChapters = nestedTextbooks.flatMap((textbook) =>
    textbook.digital_textbook_versions.flatMap(
      (version) => version.digital_textbook_chapters,
    ),
  );
  const chapters: ChapterRow[] = nestedChapters.map((row) => {
    const chapter = { ...row };
    Reflect.deleteProperty(chapter, "digital_textbook_modules");
    return chapter;
  });
  const nestedModules = nestedChapters.flatMap(
    (chapter) => chapter.digital_textbook_modules,
  );
  const modules: ModuleRow[] = nestedModules.map((row) => {
    const moduleRow = { ...row };
    Reflect.deleteProperty(moduleRow, "digital_textbook_nodes");
    return moduleRow;
  });
  const nodes = nestedModules.flatMap(
    (moduleRow) => moduleRow.digital_textbook_nodes,
  );
  const courses = (courseResult.data ?? []) as CourseRow[];

  const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const chaptersByVersionId = new Map<string, ChapterRow[]>();
  for (const chapter of chapters) {
    const list = chaptersByVersionId.get(chapter.version_id) ?? [];
    list.push(chapter);
    chaptersByVersionId.set(chapter.version_id, list);
  }
  const nodesByModuleId = new Map<string, NodeRow[]>();
  const modulesByChapterId = new Map<string, ModuleRow[]>();

  for (const node of nodes) {
    const list = nodesByModuleId.get(node.module_id) ?? [];
    list.push(node);
    nodesByModuleId.set(node.module_id, list);
  }
  for (const moduleRow of modules) {
    const list = modulesByChapterId.get(moduleRow.chapter_id) ?? [];
    list.push(moduleRow);
    modulesByChapterId.set(moduleRow.chapter_id, list);
  }

  const chapterEntries: Array<{
    textbook: TextbookRow;
    chapter: ChapterRow;
    version: VersionRow;
  }> = [];
  for (const textbook of textbooks) {
    const textbookVersions = versions.filter(
      (version) => version.textbook_id === textbook.id,
    );
    for (const version of textbookVersions) {
      for (const chapter of chaptersByVersionId.get(version.id) ?? []) {
        chapterEntries.push({ textbook, chapter, version });
      }
    }
  }

  const courseTree: DigitalTextbookCourse[] = [];
  const courseIndex = new Map<string, DigitalTextbookCourse>();
  const lessonIndex = new Map<string, DigitalTextbookLesson>();

  for (const { textbook, chapter, version } of chapterEntries) {
    const lesson = lessonById.get(textbook.lesson_id);
    if (!lesson) continue;

    let course = courseIndex.get(lesson.course_id);
    if (!course) {
      course = {
        id: lesson.course_id,
        title: courseById.get(lesson.course_id)?.title ?? "（未知课程）",
        lessons: [],
      };
      courseIndex.set(lesson.course_id, course);
      courseTree.push(course);
    }

    let lessonEntry = lessonIndex.get(lesson.id);
    if (!lessonEntry) {
      lessonEntry = { id: lesson.id, title: lesson.title, textbooks: [] };
      lessonIndex.set(lesson.id, lessonEntry);
      course.lessons.push(lessonEntry);
    }

    let textbookEntry = lessonEntry.textbooks.find(
      (item) => item.id === textbook.id,
    );
    if (!textbookEntry) {
      textbookEntry = {
        id: textbook.id,
        slug: textbook.slug,
        title: localizedTitle(textbook.title),
        status: textbook.status,
        chapters: [],
      };
      lessonEntry.textbooks.push(textbookEntry);
    }

    const chapterModules = modulesByChapterId.get(chapter.id) ?? [];
    const vocabularyModule = chapterModules.find(
      (module) => module.module_code === "vocabulary",
    );
    const grammarModule = chapterModules.find(
      (module) => module.module_code === "grammar",
    );
    const vocabularyNodes = vocabularyModule
      ? (nodesByModuleId.get(vocabularyModule.id) ?? [])
      : [];
    const grammarNodes = grammarModule
      ? (nodesByModuleId.get(grammarModule.id) ?? [])
      : [];

    textbookEntry.chapters.push({
      id: chapter.id,
      number: chapter.chapter_number,
      slug: chapter.slug,
      status: chapter.status,
      versionId: version.id,
      versionNumber: version.version_number,
      versionStatus: version.status,
      textbookSlug: textbook.slug,
      modules: chapterModules.map((module) => {
        const moduleNodes = nodesByModuleId.get(module.id) ?? [];
        return {
          id: module.id,
          code: module.module_code,
          nodeCount: moduleNodes.length,
          vocabularyCount: moduleNodes.reduce(
            (sum, node) => sum + vocabularyOf(node.content).length,
            0,
          ),
          grammarCount: moduleNodes.reduce(
            (sum, node) => sum + grammarOf(node.content).length,
            0,
          ),
        };
      }),
      nodes: vocabularyNodes.map((node) => ({
        id: node.id,
        vocabulary: vocabularyOf(node.content),
      })),
      grammarNodes: grammarNodes.map((node) => ({
        id: node.id,
        items: grammarOf(node.content),
      })),
    });
  }

  const totalVocabulary = courseTree.reduce(
    (courseSum, course) =>
      courseSum +
      course.lessons.reduce(
        (lessonSum, lesson) =>
          lessonSum +
          lesson.textbooks.reduce(
            (textbookSum, textbook) =>
              textbookSum +
              textbook.chapters.reduce(
                (chapterSum, chapter) =>
                  chapterSum +
                  chapter.nodes.reduce(
                    (nodeSum, node) => nodeSum + node.vocabulary.length,
                    0,
                  ),
                0,
              ),
            0,
          ),
        0,
      ),
    0,
  );

  const vocabularyLibrary: DigitalTextbookVocabularyLibraryItem[] = (
    (vocabularyLibraryResult.data ?? []) as VocabularyLibraryRow[]
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

  const grammarLibrary: DigitalTextbookGrammarLibraryItem[] = (
    (grammarLibraryResult.data ?? []) as GrammarLibraryRow[]
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
    canPublishChapters,
    courses: courseTree,
    vocabularyLibrary,
    grammarLibrary,
    totalVocabulary,
    hasError: Boolean(
      textbookResult.error ||
        courseResult.error ||
        vocabularyLibraryResult.error ||
        grammarLibraryResult.error,
    ),
  };
}
