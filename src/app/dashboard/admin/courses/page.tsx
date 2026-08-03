import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  CircleDot,
  FileText,
  Folder,
  FolderTree,
  Layers3,
  LockKeyhole,
  Plus,
} from "lucide-react";

import { requireAdmin } from "@/lib/admin";
import {
  createCatalogCourseAction,
  createCatalogLessonAction,
  createCourseCategoryAction,
  createCourseChapterAction,
  updateCatalogCourseAction,
  updateCourseCategoryAction,
  updateCourseChapterAction,
} from "./catalog-actions";
import { CourseCatalogTable, type CourseCatalogTableRow } from "./CourseCatalogTable";
import { CourseCoverUploadField } from "./CourseCoverUploadField";
import { LessonInlineEditor } from "./LessonInlineEditor";

type Category = {
  id: string;
  parent_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  icon_name: string | null;
  accent_color: string | null;
  cover_object_key: string | null;
  cover_alt: string | null;
  cover_focal_point: string | null;
  is_published: boolean;
  sort_order: number;
  content_scope: string;
};

type Course = {
  id: string;
  category_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  icon_name: string | null;
  cover_url: string | null;
  cover_object_key: string | null;
  cover_alt: string | null;
  cover_focal_point: string | null;
  is_published: boolean;
  sort_order: number;
  unlock_mode: string;
  prerequisite_course_id: string | null;
  available_from: string | null;
  is_manually_locked: boolean;
  content_scope: string;
};

type Lesson = {
  id: string;
  course_id: string;
  slug: string;
  title: string;
  description: string | null;
  lesson_type: string | null;
  duration_minutes: number | null;
  is_free_preview: boolean;
  video_provider: string | null;
  video_url: string | null;
  video_object_key: string | null;
  video_mime_type: string | null;
  learning_objectives: string | null;
  lesson_tasks: string | null;
  teacher_note: string | null;
  content_text: string | null;
  key_points: string | null;
  case_study: string | null;
  common_mistakes: string | null;
  summary_text: string | null;
  reflection_questions: string | null;
  extra_note: string | null;
  cover_object_key: string | null;
  cover_alt: string | null;
  cover_focal_point: string | null;
  is_published: boolean;
  sort_order: number;
  unlock_mode: string;
  prerequisite_lesson_id: string | null;
  prerequisite_chapter_id: string | null;
  required_score: number | null;
  available_from: string | null;
  is_manually_locked: boolean;
  content_scope: string;
};

type Chapter = {
  id: string;
  lesson_id: string;
  chapter_test_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  cover_object_key: string | null;
  cover_alt: string | null;
  cover_focal_point: string | null;
  is_published: boolean;
  sort_order: number;
  completion_rule: string;
  unlock_mode: string;
  prerequisite_chapter_id: string | null;
  required_score: number | null;
  available_from: string | null;
  is_manually_locked: boolean;
  content_scope: string;
};

type LessonResource = {
  id: string;
  lesson_id: string;
  title: string;
  description: string | null;
  resource_type: string;
  resource_url: string | null;
  resource_object_key: string | null;
  original_file_name: string | null;
  is_required: boolean;
  is_published: boolean;
  sort_order: number;
  is_deleted: boolean;
  deleted_at: string | null;
  delete_reason: string | null;
};

type NodeKind = "category" | "course" | "lesson" | "chapter";
type CatalogNode = Category | Course | Lesson | Chapter;
type FlatRow = {
  kind: NodeKind;
  node: CatalogNode;
  depth: number;
  parentLabel: string;
  childCount: number;
};

const nodeLabels: Record<NodeKind, string> = {
  category: "分类",
  course: "课程",
  lesson: "课时",
  chapter: "章节",
};

const unlockLabels: Record<string, string> = {
  immediate: "立即开放",
  previous_completed: "完成上一项",
  prerequisite_completed: "完成指定前置项",
  prerequisite_passed: "通过指定章节",
  scheduled: "按时间开放",
  manual: "手动开放",
};

const completionLabels: Record<string, string> = {
  content_viewed: "完成内容阅读",
  test_submitted: "提交章节测试",
  test_passed: "通过章节测试",
  manual: "管理员确认",
};

const inputClass = "app-input mt-1.5 w-full rounded-[7px] border px-3 py-2.5 text-[12px] outline-none";
const labelClass = "course-editor-field block text-[11px] font-medium";
const sectionClass = "border-t pt-5 first:border-t-0 first:pt-0";

function datetimeLocalValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function NodeIcon({ kind, size = 14 }: { kind: NodeKind; size?: number }) {
  if (kind === "category") return <Folder size={size} strokeWidth={1.6} />;
  if (kind === "course") return <BookOpen size={size} strokeWidth={1.6} />;
  if (kind === "lesson") return <Layers3 size={size} strokeWidth={1.6} />;
  return <FileText size={size} strokeWidth={1.6} />;
}

function CommonCreateFields({ sortOrder = 0 }: { sortOrder?: number }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>名称<input name="title" required maxLength={100} className={inputClass} /></label>
        <label className={labelClass}>Slug<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" className={inputClass} /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <label className={labelClass}>简介<input name="description" maxLength={300} className={inputClass} /></label>
        <label className={labelClass}>排序<input name="sort_order" type="number" min={0} max={100000} defaultValue={sortOrder} className={inputClass} /></label>
      </div>
      <label className="flex items-center gap-2 text-[11px] font-medium">
        <input name="is_published" type="checkbox" className="h-3.5 w-3.5 accent-[var(--app-accent)]" />创建后立即发布
      </label>
    </>
  );
}

function EditorCommonFields({ node }: { node: CatalogNode }) {
  return (
    <>
      <input type="hidden" name="id" value={node.id} />
      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelClass}>名称<input name="title" required maxLength={100} defaultValue={node.title} className={inputClass} /></label>
        <label className={labelClass}>Slug<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" defaultValue={node.slug} className={inputClass} /></label>
      </div>
      <label className={labelClass}>简介<textarea name="description" rows={3} maxLength={500} defaultValue={node.description ?? ""} className={`${inputClass} resize-y leading-5`} /></label>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className={labelClass}>排序<input name="sort_order" type="number" min={0} max={100000} defaultValue={node.sort_order} className={inputClass} /></label>
        <label className={labelClass}>图片焦点<select name="cover_focal_point" defaultValue={node.cover_focal_point ?? "center"} className={inputClass}><option value="center">居中</option><option value="top">顶部</option><option value="bottom">底部</option><option value="left">左侧</option><option value="right">右侧</option></select></label>
        <label className={labelClass}>配图替代文字<input name="cover_alt" maxLength={160} defaultValue={node.cover_alt ?? node.title} className={inputClass} /></label>
      </div>
      <label className="flex items-center gap-2 text-[11px] font-medium">
        <input name="is_published" type="checkbox" defaultChecked={node.is_published} className="h-3.5 w-3.5 accent-[var(--app-accent)]" />对学生端发布
      </label>
    </>
  );
}

function SaveButton({ label = "保存修改" }: { label?: string }) {
  return <button type="submit" className="rounded-[7px] px-4 py-2.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90" style={{ backgroundColor: "var(--app-accent)" }}>{label}</button>;
}

function catalogCompleteness(row: FlatRow) {
  const checks: Array<[boolean, string]> = [];
  if (row.kind === "category") {
    const node = row.node as Category;
    checks.push([Boolean(node.description), "简介"], [Boolean(node.cover_object_key), "配图"], [Boolean(node.icon_name), "图标"]);
  } else if (row.kind === "course") {
    const node = row.node as Course;
    checks.push([Boolean(node.description), "简介"], [Boolean(node.cover_object_key || node.cover_url), "封面"], [Boolean(node.level), "等级"], [row.childCount > 0, "课时"]);
  } else if (row.kind === "lesson") {
    const node = row.node as Lesson;
    checks.push(
      [Boolean(node.description), "简介"],
      [Boolean(node.cover_object_key), "配图"],
      [Boolean(node.video_object_key || node.video_url || node.content_text), "主体内容"],
      [Boolean(node.learning_objectives), "学习目标"],
      [Boolean(node.summary_text), "课时小结"],
    );
  } else {
    const node = row.node as Chapter;
    checks.push([Boolean(node.description), "简介"], [Boolean(node.cover_object_key), "配图"], [node.duration_minutes > 0, "时长"], [Boolean(node.completion_rule), "完成条件"]);
    if (node.completion_rule === "test_submitted" || node.completion_rule === "test_passed") {
      checks.push([Boolean(node.chapter_test_id), "章节测试"]);
    }
  }
  const completed = checks.filter(([ready]) => ready).length;
  return {
    completeness: checks.length ? Math.round((completed / checks.length) * 100) : 100,
    missingItems: checks.filter(([ready]) => !ready).map(([, label]) => label),
  };
}


export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ node?: string; id?: string }>;
}) {
  const [{ supabase, globalRole }, params] = await Promise.all([requireAdmin(), searchParams]);
  const canManage = globalRole === "platform_owner" || globalRole === "platform_admin";
  const canPermanentlyDelete = globalRole === "platform_owner";

  const [categoryResult, courseResult, lessonResult, chapterResult] = await Promise.all([
    supabase.from("course_categories").select("id,parent_id,slug,title,description,icon_name,accent_color,cover_object_key,cover_alt,cover_focal_point,is_published,sort_order,content_scope").eq("content_scope", "platform").order("sort_order"),
    supabase.from("courses").select("id,category_id,slug,title,description,level,icon_name,cover_url,cover_object_key,cover_alt,cover_focal_point,is_published,sort_order,unlock_mode,prerequisite_course_id,available_from,is_manually_locked,content_scope").eq("content_scope", "platform").order("sort_order"),
    supabase.from("lessons").select("id,course_id,slug,title,description,lesson_type,duration_minutes,is_free_preview,video_provider,video_url,video_object_key,video_mime_type,learning_objectives,lesson_tasks,teacher_note,content_text,key_points,case_study,common_mistakes,summary_text,reflection_questions,extra_note,cover_object_key,cover_alt,cover_focal_point,is_published,sort_order,unlock_mode,prerequisite_lesson_id,prerequisite_chapter_id,required_score,available_from,is_manually_locked,content_scope").eq("content_scope", "platform").order("sort_order"),
    supabase.from("course_chapters").select("id,lesson_id,chapter_test_id,slug,title,description,duration_minutes,cover_object_key,cover_alt,cover_focal_point,is_published,sort_order,completion_rule,unlock_mode,prerequisite_chapter_id,required_score,available_from,is_manually_locked,content_scope").eq("content_scope", "platform").order("sort_order"),
  ]);

  const categories = (categoryResult.data ?? []) as Category[];
  const courses = (courseResult.data ?? []) as Course[];
  const lessons = (lessonResult.data ?? []) as Lesson[];
  const chapters = (chapterResult.data ?? []) as Chapter[];
  const schemaError = categoryResult.error || courseResult.error || lessonResult.error || chapterResult.error;

  const categoriesByParent = new Map<string, Category[]>();
  const coursesByCategory = new Map<string, Course[]>();
  const lessonsByCourse = new Map<string, Lesson[]>();
  const chaptersByLesson = new Map<string, Chapter[]>();
  for (const item of categories) if (item.parent_id) categoriesByParent.set(item.parent_id, [...(categoriesByParent.get(item.parent_id) ?? []), item]);
  for (const item of courses) if (item.category_id) coursesByCategory.set(item.category_id, [...(coursesByCategory.get(item.category_id) ?? []), item]);
  for (const item of lessons) lessonsByCourse.set(item.course_id, [...(lessonsByCourse.get(item.course_id) ?? []), item]);
  for (const item of chapters) chaptersByLesson.set(item.lesson_id, [...(chaptersByLesson.get(item.lesson_id) ?? []), item]);

  const rows: FlatRow[] = [];
  const visitedCategoryIds = new Set<string>();
  const visitedCourseIds = new Set<string>();
  const visitedLessonIds = new Set<string>();
  const visitedChapterIds = new Set<string>();

  function addLesson(lesson: Lesson, depth: number, parentLabel: string) {
    if (visitedLessonIds.has(lesson.id)) return;
    visitedLessonIds.add(lesson.id);
    const childChapters = chaptersByLesson.get(lesson.id) ?? [];
    rows.push({ kind: "lesson", node: lesson, depth, parentLabel, childCount: childChapters.length });
    for (const chapter of childChapters) {
      visitedChapterIds.add(chapter.id);
      rows.push({ kind: "chapter", node: chapter, depth: depth + 1, parentLabel: lesson.title, childCount: chapter.chapter_test_id ? 1 : 0 });
    }
  }

  function addCourse(course: Course, depth: number, parentLabel: string) {
    if (visitedCourseIds.has(course.id)) return;
    visitedCourseIds.add(course.id);
    const childLessons = lessonsByCourse.get(course.id) ?? [];
    rows.push({ kind: "course", node: course, depth, parentLabel, childCount: childLessons.length });
    for (const lesson of childLessons) addLesson(lesson, depth + 1, course.title);
  }

  function addCategory(category: Category, depth: number, parentLabel: string) {
    if (visitedCategoryIds.has(category.id)) return;
    visitedCategoryIds.add(category.id);
    const childCategories = categoriesByParent.get(category.id) ?? [];
    const childCourses = coursesByCategory.get(category.id) ?? [];
    rows.push({ kind: "category", node: category, depth, parentLabel, childCount: childCategories.length + childCourses.length });
    for (const child of childCategories) addCategory(child, depth + 1, category.title);
    for (const course of childCourses) addCourse(course, depth + 1, category.title);
  }

  for (const category of categories.filter((item) => !item.parent_id)) addCategory(category, 0, "顶级目录");
  for (const category of categories) if (!visitedCategoryIds.has(category.id)) addCategory(category, 0, "未归类");
  for (const course of courses) if (!visitedCourseIds.has(course.id)) addCourse(course, 0, "未归类");
  for (const lesson of lessons) if (!visitedLessonIds.has(lesson.id)) addLesson(lesson, 0, "未归类");
  for (const chapter of chapters) if (!visitedChapterIds.has(chapter.id)) rows.push({ kind: "chapter", node: chapter, depth: 0, parentLabel: "未归类", childCount: chapter.chapter_test_id ? 1 : 0 });

  const requestedKind = ["category", "course", "lesson", "chapter"].includes(params.node ?? "") ? params.node as NodeKind : null;
  const requestedRow = rows.find((row) => row.kind === requestedKind && row.node.id === params.id);
  const selectedRow = requestedRow ?? null;
  const selectedKind = selectedRow?.kind ?? null;
  const selectedNode = selectedRow?.node ?? null;

  let resources: LessonResource[] = [];
  let resourceError: { message: string } | null = null;
  if (selectedKind === "lesson" && selectedNode) {
    const result = await supabase
      .from("lesson_resources")
      .select("id,lesson_id,title,description,resource_type,resource_url,resource_object_key,original_file_name,is_required,is_published,sort_order,is_deleted,deleted_at,delete_reason")
      .eq("lesson_id", selectedNode.id)
      .eq("content_scope", "platform")
      .order("sort_order");
    resources = (result.data ?? []) as LessonResource[];
    resourceError = result.error;
  }

  const nodeHref = (kind: NodeKind, id: string) => `/dashboard/admin/courses?node=${kind}&id=${id}#editor`;
  const rootCategoryCount = categories.filter((item) => !item.parent_id).length;
  const tableRows: CourseCatalogTableRow[] = rows.map((row) => {
    const quality = catalogCompleteness(row);
    const contentLabel = row.kind === "category"
      ? `${row.childCount} 个下级`
      : row.kind === "course"
        ? `${row.childCount} 个课时`
        : row.kind === "lesson"
          ? `${row.childCount} 个章节`
          : (row.node as Chapter).chapter_test_id
            ? "已关联测试"
            : `${(row.node as Chapter).duration_minutes} 分钟`;
    return {
      key: `${row.kind}-${row.node.id}`,
      kind: row.kind,
      kindLabel: nodeLabels[row.kind],
      id: row.node.id,
      title: row.node.title,
      depth: row.depth,
      parentLabel: row.parentLabel,
      childCount: row.childCount,
      contentLabel,
      ...quality,
      rule: row.kind === "category"
        ? "—"
        : unlockLabels[(row.node as Course | Lesson | Chapter).unlock_mode] ?? "未设置",
      published: row.node.is_published,
      locked: "is_manually_locked" in row.node && row.node.is_manually_locked,
      href: nodeHref(row.kind, row.node.id),
      active: selectedKind === row.kind && selectedNode?.id === row.node.id,
    };
  });

  return (
    <div className="min-h-full pb-12">
      <div className="mx-auto w-full max-w-[1600px] space-y-8 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <header className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <div className="app-muted-text mb-3 flex items-center gap-2 text-[11px] font-medium"><FolderTree size={13} strokeWidth={1.7} />内容系统 / 平台课程</div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em]">课程工作台</h1>
            <p className="app-muted-text mt-2 max-w-2xl text-[13px] leading-6">用一张层级表管理板块、分类、课程、课时和章节；选中一行后直接在该行下方维护内容。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canManage && (
              <details className="group relative">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-[7px] border px-3 py-2 text-[12px] font-medium" style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-card-bg)" }}><Plus size={13} />新建顶级板块</summary>
                <form action={createCourseCategoryAction} className="app-card absolute right-0 z-30 mt-2 w-[min(420px,calc(100vw-40px))] space-y-3 rounded-[8px] border p-4">
                  <p className="text-[12px] font-semibold">新建顶级课程板块</p>
                  <CommonCreateFields sortOrder={rootCategoryCount * 10 + 10} />
                  <SaveButton label="创建板块" />
                </form>
              </details>
            )}
            <Link href="/dashboard/courses" className="flex items-center gap-2 rounded-[7px] border px-3 py-2 text-[12px] font-medium" style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-card-bg)" }}>
              学生端预览<ArrowUpRight size={13} />
            </Link>
          </div>
        </header>

        {schemaError && (
          <div className="border-y px-1 py-3 text-[12px]" style={{ color: "var(--app-warm)", borderColor: "var(--app-border)" }}>
            课程目录数据读取失败：{schemaError.message}
          </div>
        )}
        {!canManage && (
          <div className="flex items-center gap-2 border-y px-1 py-3 text-[12px]" style={{ color: "var(--app-muted)", borderColor: "var(--app-border)" }}>
            <LockKeyhole size={13} />当前身份为只读访问；平台课程内容仅由平台负责人和平台管理员维护。
          </div>
        )}

        <section className="grid grid-cols-2 border-y md:grid-cols-4" style={{ borderColor: "var(--app-border)" }}>
          {[["课程板块", rootCategoryCount], ["课程", courses.length], ["课时", lessons.length], ["正式章节", chapters.length]].map(([label, value], index) => (
            <div key={String(label)} className={`px-4 py-4 ${index > 0 ? "border-l" : ""}`} style={{ borderColor: "var(--app-border-soft)" }}>
              <p className="app-muted-text text-[10px] font-medium">{label}</p>
              <p className="mt-1 font-mono text-xl font-semibold tracking-[-0.04em]">{value}</p>
            </div>
          ))}
        </section>

        <CourseCatalogTable rows={tableRows}>
          {selectedNode && selectedKind && (
            <section id="editor" className="scroll-mt-20 space-y-5 px-5 py-6 lg:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4" style={{ borderColor: "var(--app-border)" }}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="app-muted-text flex h-8 w-8 shrink-0 items-center justify-center"><NodeIcon kind={selectedKind} size={16} /></span>
                  <div className="min-w-0">
                    <p className="app-muted-text text-[10px]">{nodeLabels[selectedKind]}编辑 / {selectedRow?.parentLabel}</p>
                    <h2 className="truncate text-xl font-semibold tracking-[-0.03em]">{selectedNode.title}</h2>
                  </div>
                </div>
                {canManage && selectedKind !== "chapter" && (
                  <details className="group relative">
                    <summary className="flex cursor-pointer list-none items-center gap-2 rounded-[7px] border px-3 py-2 text-[11px] font-medium" style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-card-bg)" }}>
                      <Plus size={13} />新增下级内容
                    </summary>
                    <div className="app-card absolute right-0 z-20 mt-2 w-[min(460px,calc(100vw-40px))] rounded-[8px] border p-4">
                      {selectedKind === "category" && !(selectedNode as Category).parent_id ? (
                        <form action={createCourseCategoryAction} className="space-y-3">
                          <p className="text-[12px] font-semibold">在“{selectedNode.title}”中新建分类</p>
                          <input type="hidden" name="parent_id" value={selectedNode.id} />
                          <CommonCreateFields sortOrder={(categoriesByParent.get(selectedNode.id)?.length ?? 0) * 10 + 10} />
                          <SaveButton label="创建分类" />
                        </form>
                      ) : selectedKind === "category" ? (
                        <form action={createCatalogCourseAction} className="space-y-3">
                          <p className="text-[12px] font-semibold">在“{selectedNode.title}”中新建课程</p>
                          <input type="hidden" name="category_id" value={selectedNode.id} />
                          <CommonCreateFields sortOrder={(coursesByCategory.get(selectedNode.id)?.length ?? 0) * 10 + 10} />
                          <label className={labelClass}>课程等级<input name="level" defaultValue="beginner" className={inputClass} /></label>
                          <SaveButton label="创建课程" />
                        </form>
                      ) : selectedKind === "course" ? (
                        <form action={createCatalogLessonAction} className="space-y-3">
                          <p className="text-[12px] font-semibold">在“{selectedNode.title}”中新建课时</p>
                          <input type="hidden" name="course_id" value={selectedNode.id} />
                          <CommonCreateFields sortOrder={(lessonsByCourse.get(selectedNode.id)?.length ?? 0) * 10 + 10} />
                          <label className={labelClass}>预计时长（分钟）<input name="duration_minutes" type="number" min={1} max={600} defaultValue={30} className={inputClass} /></label>
                          <SaveButton label="创建课时" />
                        </form>
                      ) : (
                        <form action={createCourseChapterAction} className="space-y-3">
                          <p className="text-[12px] font-semibold">在“{selectedNode.title}”中新建章节</p>
                          <input type="hidden" name="lesson_id" value={selectedNode.id} />
                          <CommonCreateFields sortOrder={(chaptersByLesson.get(selectedNode.id)?.length ?? 0) * 10 + 10} />
                          <label className={labelClass}>预计时长（分钟）<input name="duration_minutes" type="number" min={1} max={600} defaultValue={20} className={inputClass} /></label>
                          <SaveButton label="创建章节" />
                        </form>
                      )}
                    </div>
                  </details>
                )}
              </div>

            {!canManage ? (
              <div className="app-muted-text rounded-[8px] border px-4 py-10 text-center text-[12px]" style={{ borderColor: "var(--app-border)" }}>当前账号可以查看目录，但不能修改平台课程。</div>
            ) : selectedKind === "category" ? (
              <form action={updateCourseCategoryAction} className="space-y-5">
                <div className={sectionClass} style={{ borderColor: "var(--app-border)" }}><h3 className="mb-4 text-[12px] font-semibold">基本信息与配图</h3><div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]"><CourseCoverUploadField kind="category" entityId={selectedNode.id} currentObjectKey={selectedNode.cover_object_key} alt={selectedNode.cover_alt ?? selectedNode.title} /><div className="space-y-4"><EditorCommonFields node={selectedNode} /><div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>导航图标<input name="icon_name" defaultValue={(selectedNode as Category).icon_name ?? "folder"} className={inputClass} /></label><label className={labelClass}>强调色<input name="accent_color" defaultValue={(selectedNode as Category).accent_color ?? "blue"} className={inputClass} /></label></div></div></div></div>
                <SaveButton />
              </form>
            ) : selectedKind === "course" ? (
              <form action={updateCatalogCourseAction} className="space-y-5">
                <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]"><CourseCoverUploadField kind="course" entityId={selectedNode.id} currentObjectKey={selectedNode.cover_object_key} alt={selectedNode.cover_alt ?? selectedNode.title} /><div className="space-y-4"><EditorCommonFields node={selectedNode} /><div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>课程等级<input name="level" defaultValue={(selectedNode as Course).level ?? "beginner"} className={inputClass} /></label><label className={labelClass}>导航图标<input name="icon_name" defaultValue={(selectedNode as Course).icon_name ?? "book-open"} className={inputClass} /></label></div><label className={labelClass}>兼容封面 URL<input name="cover_url" type="url" defaultValue={(selectedNode as Course).cover_url ?? ""} className={inputClass} /></label></div></div>
                <div className={sectionClass} style={{ borderColor: "var(--app-border)" }}><h3 className="mb-4 text-[12px] font-semibold">开放规则</h3><div className="grid gap-4 md:grid-cols-3"><label className={labelClass}>开放方式<select name="unlock_mode" defaultValue={(selectedNode as Course).unlock_mode} className={inputClass}>{Object.entries(unlockLabels).filter(([value]) => value !== "prerequisite_passed").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className={labelClass}>前置课程<select name="prerequisite_course_id" defaultValue={(selectedNode as Course).prerequisite_course_id ?? ""} className={inputClass}><option value="">无</option>{courses.filter((item) => item.id !== selectedNode.id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label className={labelClass}>开放时间<input name="available_from" type="datetime-local" defaultValue={datetimeLocalValue((selectedNode as Course).available_from)} className={inputClass} /></label></div><label className="mt-4 flex items-center gap-2 text-[11px] font-medium"><input name="is_manually_locked" type="checkbox" defaultChecked={(selectedNode as Course).is_manually_locked} className="h-3.5 w-3.5 accent-[var(--app-accent)]" />临时锁定</label></div>
                <SaveButton />
              </form>
            ) : selectedKind === "lesson" ? (
              <LessonInlineEditor
                lesson={selectedNode as Lesson}
                lessons={lessons}
                chapters={chapters}
                resources={resources}
                resourceError={resourceError?.message}
                canPermanentlyDelete={canPermanentlyDelete}
              />
            ) : (
              <form action={updateCourseChapterAction} className="space-y-5">
                <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]"><CourseCoverUploadField kind="chapter" entityId={selectedNode.id} currentObjectKey={selectedNode.cover_object_key} alt={selectedNode.cover_alt ?? selectedNode.title} /><div className="space-y-4"><EditorCommonFields node={selectedNode} /><label className={labelClass}>预计时长（分钟）<input name="duration_minutes" type="number" min={1} max={600} defaultValue={(selectedNode as Chapter).duration_minutes} className={inputClass} /></label></div></div>
                <div className={sectionClass} style={{ borderColor: "var(--app-border)" }}><h3 className="mb-4 text-[12px] font-semibold">完成与开放规则</h3><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><label className={labelClass}>完成条件<select name="completion_rule" defaultValue={(selectedNode as Chapter).completion_rule} className={inputClass}>{Object.entries(completionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className={labelClass}>开放方式<select name="unlock_mode" defaultValue={(selectedNode as Chapter).unlock_mode} className={inputClass}>{Object.entries(unlockLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className={labelClass}>前置章节<select name="prerequisite_chapter_id" defaultValue={(selectedNode as Chapter).prerequisite_chapter_id ?? ""} className={inputClass}><option value="">无</option>{chapters.filter((item) => item.id !== selectedNode.id && item.lesson_id === (selectedNode as Chapter).lesson_id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label className={labelClass}>要求分数<input name="required_score" type="number" min={0} max={100} defaultValue={(selectedNode as Chapter).required_score ?? 80} className={inputClass} /></label><label className={labelClass}>开放时间<input name="available_from" type="datetime-local" defaultValue={datetimeLocalValue((selectedNode as Chapter).available_from)} className={inputClass} /></label></div><label className="mt-4 flex items-center gap-2 text-[11px] font-medium"><input name="is_manually_locked" type="checkbox" defaultChecked={(selectedNode as Chapter).is_manually_locked} className="h-3.5 w-3.5 accent-[var(--app-accent)]" />临时锁定</label>{(selectedNode as Chapter).chapter_test_id && <p className="app-muted-text mt-4 flex items-center gap-2 rounded-[7px] border px-3 py-2 text-[10px]" style={{ borderColor: "var(--app-border)" }}><CircleDot size={11} />已关联章节测试 · {(selectedNode as Chapter).chapter_test_id}</p>}</div>
                <SaveButton />
              </form>
            )}
          </section>
        )}
        </CourseCatalogTable>
      </div>
    </div>
  );
}
