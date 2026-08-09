import { redirect } from "next/navigation";

import { requireActiveUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DigitalTextbookManager, type AdminCourse } from "./DigitalTextbookManager";
import type {
  GrammarLibraryItem,
  VocabularyLibraryItem,
} from "../growth-toolbox/GrowthToolboxManager";
import type { GrammarItem, VocabularyWord } from "./actions";

type TextbookRow = { id: string; lesson_id: string; slug: string; level_code: string; title: unknown; status: string };
type LessonRow = { id: string; title: string; course_id: string };
type CourseRow = { id: string; title: string };
type VersionRow = { id: string; textbook_id: string; version_number: number; status: string };
type ChapterRow = { id: string; version_id: string; slug: string; chapter_number: number; status: string };
type ModuleRow = { id: string; chapter_id: string; module_code: string };
type NodeRow = { id: string; module_id: string; content: Record<string, unknown> | null };

function localizedTitle(value: unknown): string {
  if (!value || typeof value !== "object") return String(value ?? "");
  const record = value as Record<string, unknown>;
  return String(record["zh-CN"] ?? record["ko-KR"] ?? "");
}

function vocabularyOf(content: Record<string, unknown> | null): VocabularyWord[] {
  if (!content) return [];
  const raw = Array.isArray(content.vocabulary) ? content.vocabulary : [];
  return raw.filter(
    (item): item is VocabularyWord =>
      Boolean(item) &&
      typeof item === "object" &&
      (Boolean((item as VocabularyWord).ko) || Boolean((item as VocabularyWord).zh))
  );
}

function grammarOf(content: Record<string, unknown> | null): GrammarItem[] {
  if (!content) return [];
  const raw = Array.isArray(content.grammar) ? content.grammar : [];
  return raw.filter(
    (item): item is GrammarItem =>
      Boolean(item) && typeof item === "object" && Boolean((item as GrammarItem).title)
  );
}

export default async function DigitalTextbookAdminPage() {
  const { supabase: userSupabase } = await requireActiveUser();
  const { data: canManage } = await userSupabase.rpc(
    "current_user_can_manage_standard_question_bank"
  );
  if (!canManage) redirect("/dashboard/admin");

  // 教材内容表对登录用户(authenticated)只读，管理端需要读取草稿等全部状态，
  // 因此用服务端密钥客户端读取；谁能进来已由上面的鉴权把关。
  const supabase = createAdminClient();

  const [{ data: textbookRows }, { data: versionRows }] = await Promise.all([
    supabase
      .from("digital_textbooks")
      .select("id,lesson_id,slug,level_code,title,status")
      .order("created_at", { ascending: true }),
    supabase
      .from("digital_textbook_versions")
      .select("id,textbook_id,version_number,status")
      .order("version_number", { ascending: true }),
  ]);
  const textbooks = (textbookRows ?? []) as TextbookRow[];
  const versions = (versionRows ?? []) as VersionRow[];
  const versionIds = versions.map((version) => version.id);

  const [{ data: chapterRows }, { data: lessonRows }, { data: courseRows }] = await Promise.all([
    versionIds.length
      ? supabase
          .from("digital_textbook_chapters")
          .select("id,version_id,slug,chapter_number,status")
          .in("version_id", versionIds)
          .order("chapter_number", { ascending: true })
      : { data: [] as ChapterRow[] },
    textbooks.length
      ? supabase
          .from("lessons")
          .select("id,title,course_id")
          .in("id", textbooks.map((textbook) => textbook.lesson_id))
      : { data: [] as LessonRow[] },
    supabase.from("courses").select("id,title"),
  ]);
  const chapters = (chapterRows ?? []) as ChapterRow[];
  const lessons = (lessonRows ?? []) as LessonRow[];
  const courses = (courseRows ?? []) as CourseRow[];
  const chapterIds = chapters.map((chapter) => chapter.id);

  const { data: moduleRows } = chapterIds.length
    ? await supabase
        .from("digital_textbook_modules")
        .select("id,chapter_id,module_code")
        .in("chapter_id", chapterIds)
        .in("module_code", ["vocabulary", "grammar"])
    : { data: [] as ModuleRow[] };
  const modules = (moduleRows ?? []) as ModuleRow[];
  const moduleIds = modules.map((module) => module.id);

  const { data: nodeRows } = moduleIds.length
    ? await supabase
        .from("digital_textbook_nodes")
        .select("id,module_id,content")
        .in("module_id", moduleIds)
    : { data: [] as NodeRow[] };
  const nodes = (nodeRows ?? []) as NodeRow[];

  const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const chapterByVersionId = new Map(chapters.map((chapter) => [chapter.version_id, chapter]));
  const nodesByModuleId = new Map<string, NodeRow[]>();
  const modulesByChapterId = new Map<string, ModuleRow[]>();
  for (const node of nodes) {
    const list = nodesByModuleId.get(node.module_id) ?? [];
    list.push(node);
    nodesByModuleId.set(node.module_id, list);
  }
  for (const module of modules) {
    const list = modulesByChapterId.get(module.chapter_id) ?? [];
    list.push(module);
    modulesByChapterId.set(module.chapter_id, list);
  }

  /**
   * 4. 组装：课程 → 课时 → 教材 → 章节
   */
  const chapterEntries: Array<{ textbook: TextbookRow; chapter: ChapterRow; version: VersionRow }> = [];
  for (const textbook of textbooks) {
    const textbookVersions = versions.filter((version) => version.textbook_id === textbook.id);
    for (const version of textbookVersions) {
      const chapter = chapterByVersionId.get(version.id);
      if (chapter) chapterEntries.push({ textbook, chapter, version });
    }
  }

  const adminTree: AdminCourse[] = [];
  const courseIndex = new Map<string, AdminCourse>();
  const lessonIndex = new Map<string, AdminLesson>();
  for (const { textbook, chapter } of chapterEntries) {
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
      adminTree.push(course);
    }

    let lessonEntry = lessonIndex.get(lesson.id);
    if (!lessonEntry) {
      lessonEntry = { id: lesson.id, title: lesson.title, textbooks: [] };
      lessonIndex.set(lesson.id, lessonEntry);
      course.lessons.push(lessonEntry);
    }

    let textbookEntry = lessonEntry.textbooks.find((item) => item.id === textbook.id);
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
    const vocabModule = chapterModules.find((module) => module.module_code === "vocabulary");
    const grammarModule = chapterModules.find((module) => module.module_code === "grammar");

    textbookEntry.chapters.push({
      id: chapter.id,
      number: chapter.chapter_number,
      slug: chapter.slug,
      status: chapter.status,
      textbookSlug: textbook.slug,
      nodes: (vocabModule ? (nodesByModuleId.get(vocabModule.id) ?? []) : []).map((node) => ({
        id: node.id,
        vocabulary: vocabularyOf(node.content),
      })),
      grammarNodes: (grammarModule ? (nodesByModuleId.get(grammarModule.id) ?? []) : []).map((node) => ({
        id: node.id,
        items: grammarOf(node.content),
      })),
    });
  }

  const totalVocabulary = adminTree.reduce(
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
                    0
                  ),
                0
              ),
            0
          ),
        0
      ),
    0
  );

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
          <h2 className="text-lg font-black tracking-tight">互动教材管理</h2>
        </div>
      </div>

      <DigitalTextbookManager
        courses={adminTree}
        vocabularyLibrary={vocabularyLibrary}
        grammarLibrary={grammarLibrary}
      />
    </div>
  );
}
