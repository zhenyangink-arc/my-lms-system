"use client";

import { PencilLine, Plus } from "lucide-react";
import { useId, useState } from "react";

import {
  createCatalogCourseAction,
  createCatalogLessonAction,
  createCourseCategoryAction,
  createCourseChapterAction,
  updateCatalogCourseAction,
  updateCatalogLessonAction,
  updateCourseCategoryAction,
  updateCourseChapterAction,
} from "@/app/dashboard/admin/courses/catalog-actions";
import { CourseCoverUploadField } from "@/app/dashboard/admin/courses/CourseCoverUploadField";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  CourseCatalogChapter,
  CourseCatalogCourse,
  CourseCatalogLesson,
  CourseCatalogNode,
  CourseCategory,
} from "../api/types";
import type {
  CourseCatalogActionOptions,
  CreateTarget,
} from "./course-catalog-create-target";

export type { CourseCatalogActionOptions } from "./course-catalog-create-target";

const INPUT_CLASS =
  "app-input mt-1.5 min-h-10 w-full min-w-0 rounded-md border px-3 py-2.5 text-xs outline-none";
const LABEL_CLASS = "block min-w-0 text-[11px] font-medium text-[var(--foreground-secondary)]";
const SECTION_CLASS = "space-y-4 border-t border-[var(--border)] pt-5";

const UNLOCK_LABELS: Record<string, string> = {
  immediate: "立即开放",
  previous_completed: "完成上一项后开放",
  prerequisite_completed: "完成指定前置内容后开放",
  prerequisite_passed: "通过指定前置内容后开放",
  scheduled: "按时间开放",
  manual: "管理员确认开放",
};

const COMPLETION_LABELS: Record<string, string> = {
  content_viewed: "完成内容阅读",
  test_submitted: "提交章节测试",
  test_passed: "通过章节测试",
  manual: "管理员确认",
};

function datetimeLocalValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function SaveButton({ label = "保存修改" }: { label?: string }) {
  return (
    <button
      type="submit"
      className="inline-flex h-9 items-center bg-[var(--primary)] px-4 text-xs font-semibold text-white hover:opacity-90"
    >
      {label}
    </button>
  );
}

function CommonFields({ node }: { node: CourseCatalogNode }) {
  return (
    <>
      <input type="hidden" name="id" value={node.id} />
      <div className="grid gap-4 md:grid-cols-2">
        <label className={LABEL_CLASS}>
          名称
          <input name="title" required maxLength={100} defaultValue={node.title} className={INPUT_CLASS} />
        </label>
        <label className={LABEL_CLASS}>
          路径标识
          <input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" defaultValue={node.slug} className={INPUT_CLASS} />
        </label>
      </div>
      <label className={LABEL_CLASS}>
        简介
        <textarea name="description" rows={3} maxLength={500} defaultValue={node.description ?? ""} className={`${INPUT_CLASS} resize-y leading-5`} />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className={LABEL_CLASS}>
          排序
          <input name="sort_order" type="number" min={0} max={100000} defaultValue={node.sort_order} className={INPUT_CLASS} />
        </label>
        <label className={LABEL_CLASS}>
          图片焦点
          <select name="cover_focal_point" defaultValue={node.cover_focal_point ?? "center"} className={INPUT_CLASS}>
            <option value="center">居中</option><option value="top">顶部</option><option value="bottom">底部</option><option value="left">左侧</option><option value="right">右侧</option>
          </select>
        </label>
        <label className={LABEL_CLASS}>
          配图替代文字
          <input name="cover_alt" maxLength={160} defaultValue={node.cover_alt ?? node.title} className={INPUT_CLASS} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-[11px] font-medium text-[var(--foreground-secondary)]">
        <input name="is_published" type="checkbox" defaultChecked={node.is_published} />
        学生端上架
      </label>
    </>
  );
}

function CreateFields({ sortOrder }: { sortOrder: number }) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <label className={LABEL_CLASS}>名称<input name="title" required maxLength={100} className={INPUT_CLASS} /></label>
        <label className={LABEL_CLASS}>路径标识<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" className={INPUT_CLASS} /></label>
      </div>
      <label className={LABEL_CLASS}>简介<textarea name="description" rows={3} maxLength={500} className={`${INPUT_CLASS} resize-y`} /></label>
      <label className={LABEL_CLASS}>排序<input name="sort_order" type="number" min={0} max={100000} defaultValue={sortOrder} className={INPUT_CLASS} /></label>
      <label className="flex items-center gap-2 text-[11px] font-medium text-[var(--foreground-secondary)]"><input name="is_published" type="checkbox" />创建后上架</label>
    </>
  );
}

function CategoryEditor({ node }: { node: CourseCategory }) {
  return (
    <form action={updateCourseCategoryAction} className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <CourseCoverUploadField kind="category" entityId={node.id} currentObjectKey={node.cover_object_key} alt={node.cover_alt ?? node.title} />
        <div className="space-y-4"><CommonFields node={node} /><div className="grid gap-4 sm:grid-cols-2"><label className={LABEL_CLASS}>导航图标<input name="icon_name" defaultValue={node.icon_name ?? "folder"} className={INPUT_CLASS} /></label><label className={LABEL_CLASS}>强调色<input name="accent_color" defaultValue={node.accent_color ?? "blue"} className={INPUT_CLASS} /></label></div></div>
      </div>
      <SaveButton />
    </form>
  );
}

function CourseEditor({ node, options }: { node: CourseCatalogCourse; options: CourseCatalogActionOptions }) {
  return (
    <form action={updateCatalogCourseAction} className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <CourseCoverUploadField kind="course" entityId={node.id} currentObjectKey={node.cover_object_key} alt={node.cover_alt ?? node.title} />
        <div className="space-y-4"><CommonFields node={node} /><div className="grid gap-4 sm:grid-cols-2"><label className={LABEL_CLASS}>课程等级<input name="level" defaultValue={node.level ?? "beginner"} className={INPUT_CLASS} /></label><label className={LABEL_CLASS}>导航图标<input name="icon_name" defaultValue={node.icon_name ?? "book-open"} className={INPUT_CLASS} /></label></div><label className={LABEL_CLASS}>兼容封面链接<input name="cover_url" type="url" defaultValue={node.cover_url ?? ""} className={INPUT_CLASS} /></label></div>
      </div>
      <div className={SECTION_CLASS}>
        <h3 className="text-xs font-semibold">开放规则</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <label className={LABEL_CLASS}>开放方式<select name="unlock_mode" defaultValue={node.unlock_mode} className={INPUT_CLASS}>{Object.entries(UNLOCK_LABELS).filter(([value]) => value !== "prerequisite_passed").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className={LABEL_CLASS}>前置课程<select name="prerequisite_course_id" defaultValue={node.prerequisite_course_id ?? ""} className={INPUT_CLASS}><option value="">无</option>{options.courses.filter((item) => item.id !== node.id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
          <label className={LABEL_CLASS}>开放时间<input name="available_from" type="datetime-local" defaultValue={datetimeLocalValue(node.available_from)} className={INPUT_CLASS} /></label>
        </div>
        <label className="flex items-center gap-2 text-[11px] font-medium"><input name="is_manually_locked" type="checkbox" defaultChecked={node.is_manually_locked} />临时锁定</label>
      </div>
      <SaveButton />
    </form>
  );
}

function LessonEditor({ node, options }: { node: CourseCatalogLesson; options: CourseCatalogActionOptions }) {
  const [activeSection, setActiveSection] = useState<"basic" | "rules">("basic");
  const editorId = useId();
  const sections = [
    { key: "basic", label: "基本信息" },
    { key: "rules", label: "开放规则" },
  ] as const;

  return (
    <div>
      <div role="tablist" aria-label="课时编辑区域" className="-mx-6 -mt-6 mb-6 flex min-h-12 items-end gap-1 border-b border-[var(--border)] bg-[var(--surface-soft)] px-6 pt-2">
        {sections.map((section) => (
          <button
            key={section.key}
            id={`${editorId}-${section.key}-tab`}
            type="button"
            role="tab"
            aria-selected={activeSection === section.key}
            aria-controls={`${editorId}-${section.key}-panel`}
            onClick={() => setActiveSection(section.key)}
            className={`min-h-10 border-b-2 px-4 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${activeSection === section.key ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]"}`}
          >
            {section.label}
          </button>
        ))}
      </div>

      <form id={`${editorId}-basic-panel`} role="tabpanel" aria-labelledby={`${editorId}-basic-tab`} hidden={activeSection !== "basic"} action={updateCatalogLessonAction} className="space-y-5">
        <input type="hidden" name="id" value={node.id} /><input type="hidden" name="editor_section" value="basic" />
        <h3 className="text-xs font-semibold">基本信息、封面与视频</h3>
        <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]"><CourseCoverUploadField kind="lesson" entityId={node.id} currentObjectKey={node.cover_object_key} alt={node.cover_alt ?? node.title} /><div className="space-y-4"><CommonFields node={node} /><div className="grid gap-4 sm:grid-cols-2"><label className={LABEL_CLASS}>内容类型<select name="lesson_type" defaultValue={node.lesson_type ?? "video"} className={INPUT_CLASS}><option value="video">视频课</option><option value="reading">图文课</option><option value="practice">练习课</option><option value="live">直播课</option></select></label><label className={LABEL_CLASS}>预计时长（分钟）<input name="duration_minutes" type="number" min={1} max={600} defaultValue={node.duration_minutes ?? 30} className={INPUT_CLASS} /></label></div><label className="flex items-center gap-2 text-[11px] font-medium"><input name="is_free_preview" type="checkbox" defaultChecked={node.is_free_preview} />允许免费试看</label></div></div>
        <div className="grid gap-4 md:grid-cols-2"><label className={LABEL_CLASS}>视频存储方式<select name="video_provider" defaultValue={node.video_provider ?? "r2"} className={INPUT_CLASS}><option value="r2">对象存储</option><option value="external">外部地址</option></select></label><label className={LABEL_CLASS}>媒体类型<input name="video_mime_type" defaultValue={node.video_mime_type ?? "video/mp4"} className={INPUT_CLASS} /></label><label className={LABEL_CLASS}>视频对象键<input name="video_object_key" defaultValue={node.video_object_key ?? ""} className={INPUT_CLASS} /></label><label className={LABEL_CLASS}>外部视频链接<input name="video_url" type="url" defaultValue={node.video_url ?? ""} className={INPUT_CLASS} /></label></div>
        <SaveButton label="保存基本信息" />
      </form>
      <form id={`${editorId}-rules-panel`} role="tabpanel" aria-labelledby={`${editorId}-rules-tab`} hidden={activeSection !== "rules"} action={updateCatalogLessonAction} className="space-y-5">
        <input type="hidden" name="id" value={node.id} /><input type="hidden" name="editor_section" value="rules" />
        <h3 className="text-xs font-semibold">开放规则</h3>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><label className={LABEL_CLASS}>开放方式<select name="unlock_mode" defaultValue={node.unlock_mode} className={INPUT_CLASS}>{Object.entries(UNLOCK_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className={LABEL_CLASS}>前置课时<select name="prerequisite_lesson_id" defaultValue={node.prerequisite_lesson_id ?? ""} className={INPUT_CLASS}><option value="">无</option>{options.lessons.filter((item) => item.id !== node.id && item.course_id === node.course_id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label className={LABEL_CLASS}>前置章节<select name="prerequisite_chapter_id" defaultValue={node.prerequisite_chapter_id ?? ""} className={INPUT_CLASS}><option value="">无</option>{options.chapters.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label className={LABEL_CLASS}>要求分数<input name="required_score" type="number" min={0} max={100} defaultValue={node.required_score ?? 80} className={INPUT_CLASS} /></label><label className={LABEL_CLASS}>开放时间<input name="available_from" type="datetime-local" defaultValue={datetimeLocalValue(node.available_from)} className={INPUT_CLASS} /></label></div>
        <label className="flex items-center gap-2 text-[11px] font-medium"><input name="is_manually_locked" type="checkbox" defaultChecked={node.is_manually_locked} />临时锁定</label>
        <SaveButton label="保存开放规则" />
      </form>
    </div>
  );
}

function ChapterEditor({ node, options }: { node: CourseCatalogChapter; options: CourseCatalogActionOptions }) {
  return (
    <form action={updateCourseChapterAction} className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]"><CourseCoverUploadField kind="chapter" entityId={node.id} currentObjectKey={node.cover_object_key} alt={node.cover_alt ?? node.title} /><div className="space-y-4"><CommonFields node={node} /><label className={LABEL_CLASS}>预计时长（分钟）<input name="duration_minutes" type="number" min={1} max={600} defaultValue={node.duration_minutes} className={INPUT_CLASS} /></label></div></div>
      <div className={SECTION_CLASS}><h3 className="text-xs font-semibold">完成与开放规则</h3><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><label className={LABEL_CLASS}>完成条件<select name="completion_rule" defaultValue={node.completion_rule} className={INPUT_CLASS}>{Object.entries(COMPLETION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className={LABEL_CLASS}>开放方式<select name="unlock_mode" defaultValue={node.unlock_mode} className={INPUT_CLASS}>{Object.entries(UNLOCK_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className={LABEL_CLASS}>前置章节<select name="prerequisite_chapter_id" defaultValue={node.prerequisite_chapter_id ?? ""} className={INPUT_CLASS}><option value="">无</option>{options.chapters.filter((item) => item.id !== node.id && item.lesson_id === node.lesson_id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label className={LABEL_CLASS}>要求分数<input name="required_score" type="number" min={0} max={100} defaultValue={node.required_score ?? 80} className={INPUT_CLASS} /></label><label className={LABEL_CLASS}>开放时间<input name="available_from" type="datetime-local" defaultValue={datetimeLocalValue(node.available_from)} className={INPUT_CLASS} /></label></div><label className="flex items-center gap-2 text-[11px] font-medium"><input name="is_manually_locked" type="checkbox" defaultChecked={node.is_manually_locked} />临时锁定</label>{node.chapter_test_id && <p className="text-[10px] text-[var(--foreground-muted)]">已关联章节测试：{node.chapter_test_id}</p>}</div>
      <SaveButton />
    </form>
  );
}

function EditContent({ node, options }: { node: CourseCatalogNode; options: CourseCatalogActionOptions }) {
  if ("parent_id" in node) return <CategoryEditor node={node} />;
  if ("category_id" in node) return <CourseEditor node={node} options={options} />;
  if ("course_id" in node) return <LessonEditor node={node} options={options} />;
  return <ChapterEditor node={node} options={options} />;
}

export function CourseCatalogEditDialog({ node, options, compact = false }: { node: CourseCatalogNode; options: CourseCatalogActionOptions; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {compact ? (
        <button type="button" onClick={() => setOpen(true)} aria-label={`编辑"${node.title}"`} className="relative z-10 inline-flex h-6 w-6 items-center justify-center text-[var(--foreground-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"><PencilLine size={13} /></button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex h-8 items-center gap-1.5 border border-[var(--border)] bg-[var(--card)] px-3 text-[11px] font-semibold hover:bg-[var(--surface-soft)]"><PencilLine size={12} />编辑</button>
      )}
      <DialogContent className="grid max-h-[92vh] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-[1100px]">
        <DialogHeader className="border-b border-[var(--border)] px-6 py-4 pr-14 text-left"><DialogTitle>编辑“{node.title}”</DialogTitle><DialogDescription>这里只维护课程结构、基础资料与开放规则；具体教学内容请前往教材制作。</DialogDescription></DialogHeader>
        <div className="min-h-0 overflow-y-auto p-6"><EditContent node={node} options={options} /></div>
      </DialogContent>
    </Dialog>
  );
}

function CreateForm({ target, studentAppId }: { target: CreateTarget; studentAppId?: string }) {
  if (target.kind === "category") return <form action={createCourseCategoryAction} className="space-y-4">{target.parentId && <input type="hidden" name="parent_id" value={target.parentId} />}{!target.parentId && studentAppId && <input type="hidden" name="student_app_id" value={studentAppId} />}<CreateFields sortOrder={target.sortOrder} /><SaveButton label="创建分类" /></form>;
  if (target.kind === "course") return <form action={createCatalogCourseAction} className="space-y-4"><input type="hidden" name="category_id" value={target.categoryId} /><CreateFields sortOrder={target.sortOrder} /><label className={LABEL_CLASS}>课程等级<input name="level" defaultValue="beginner" className={INPUT_CLASS} /></label><SaveButton label="创建课程" /></form>;
  if (target.kind === "lesson") return <form action={createCatalogLessonAction} className="space-y-4"><input type="hidden" name="course_id" value={target.courseId} /><CreateFields sortOrder={target.sortOrder} /><label className={LABEL_CLASS}>预计时长（分钟）<input name="duration_minutes" type="number" min={1} max={600} defaultValue={30} className={INPUT_CLASS} /></label><SaveButton label="创建课时" /></form>;
  return <form action={createCourseChapterAction} className="space-y-4"><input type="hidden" name="lesson_id" value={target.lessonId} /><CreateFields sortOrder={target.sortOrder} /><label className={LABEL_CLASS}>预计时长（分钟）<input name="duration_minutes" type="number" min={1} max={600} defaultValue={20} className={INPUT_CLASS} /></label><SaveButton label="创建章节" /></form>;
}

export function CourseCatalogCreateDialog({ target, primary = false, studentAppId }: { target: CreateTarget; primary?: boolean; studentAppId?: string }) {
  const [open, setOpen] = useState(false);
  const compactTriggerLabel = {
    category: "新建分类",
    course: "新建课程",
    lesson: "新建课时",
    chapter: "新建章节",
  }[target.kind];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button type="button" onClick={() => setOpen(true)} className={primary ? "inline-flex h-9 items-center gap-1.5 bg-[var(--primary)] px-4 text-xs font-semibold text-white hover:opacity-90" : "inline-flex h-8 items-center gap-1.5 border border-[var(--border)] bg-[var(--card)] px-3 text-[11px] font-semibold hover:bg-[var(--surface-soft)]"}><Plus size={13} aria-hidden="true" />{primary ? target.title : compactTriggerLabel}</button>
      <DialogContent className="grid max-h-[90vh] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-2xl"><DialogHeader className="border-b border-[var(--border)] px-6 py-4 pr-14 text-left"><DialogTitle>{target.title}</DialogTitle><DialogDescription>填写必要信息后创建目录节点。</DialogDescription></DialogHeader><div className="min-h-0 overflow-y-auto p-6"><CreateForm target={target} studentAppId={studentAppId} /></div></DialogContent>
    </Dialog>
  );
}
