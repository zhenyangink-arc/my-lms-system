"use client";

import { PencilLine, Plus } from "lucide-react";
import { useState } from "react";

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

export type CourseCatalogActionOptions = {
  categories: CourseCategory[];
  courses: CourseCatalogCourse[];
  lessons: CourseCatalogLesson[];
  chapters: CourseCatalogChapter[];
};

const INPUT_CLASS =
  "app-input mt-1.5 w-full rounded-md border px-3 py-2.5 text-xs outline-none";
const LABEL_CLASS = "block text-[11px] font-medium text-[var(--app-text-soft)]";
const SECTION_CLASS = "space-y-4 border-t border-[var(--app-border)] pt-5";

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
      className="inline-flex h-9 items-center bg-[var(--app-primary)] px-4 text-xs font-semibold text-white hover:opacity-90"
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
      <label className="flex items-center gap-2 text-[11px] font-medium text-[var(--app-text-soft)]">
        <input name="is_published" type="checkbox" defaultChecked={node.is_published} />
        对学生端发布
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
      <label className="flex items-center gap-2 text-[11px] font-medium text-[var(--app-text-soft)]"><input name="is_published" type="checkbox" />创建后发布</label>
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

function TextAreaField({ name, label, value, rows = 4 }: { name: string; label: string; value: string | null; rows?: number }) {
  return <label className={LABEL_CLASS}>{label}<textarea name={name} rows={rows} defaultValue={value ?? ""} className={`${INPUT_CLASS} resize-y leading-5`} /></label>;
}

function LessonEditor({ node, options }: { node: CourseCatalogLesson; options: CourseCatalogActionOptions }) {
  return (
    <div className="space-y-7">
      <form action={updateCatalogLessonAction} className="space-y-5">
        <input type="hidden" name="id" value={node.id} /><input type="hidden" name="editor_section" value="basic" />
        <h3 className="text-xs font-semibold">基本信息、封面与视频</h3>
        <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]"><CourseCoverUploadField kind="lesson" entityId={node.id} currentObjectKey={node.cover_object_key} alt={node.cover_alt ?? node.title} /><div className="space-y-4"><CommonFields node={node} /><div className="grid gap-4 sm:grid-cols-2"><label className={LABEL_CLASS}>内容类型<select name="lesson_type" defaultValue={node.lesson_type ?? "video"} className={INPUT_CLASS}><option value="video">视频课</option><option value="reading">图文课</option><option value="practice">练习课</option><option value="live">直播课</option></select></label><label className={LABEL_CLASS}>预计时长（分钟）<input name="duration_minutes" type="number" min={1} max={600} defaultValue={node.duration_minutes ?? 30} className={INPUT_CLASS} /></label></div><label className="flex items-center gap-2 text-[11px] font-medium"><input name="is_free_preview" type="checkbox" defaultChecked={node.is_free_preview} />允许免费试看</label></div></div>
        <div className="grid gap-4 md:grid-cols-2"><label className={LABEL_CLASS}>视频存储方式<select name="video_provider" defaultValue={node.video_provider ?? "r2"} className={INPUT_CLASS}><option value="r2">对象存储</option><option value="external">外部地址</option></select></label><label className={LABEL_CLASS}>媒体类型<input name="video_mime_type" defaultValue={node.video_mime_type ?? "video/mp4"} className={INPUT_CLASS} /></label><label className={LABEL_CLASS}>视频对象键<input name="video_object_key" defaultValue={node.video_object_key ?? ""} className={INPUT_CLASS} /></label><label className={LABEL_CLASS}>外部视频链接<input name="video_url" type="url" defaultValue={node.video_url ?? ""} className={INPUT_CLASS} /></label></div>
        <SaveButton label="保存基本信息" />
      </form>
      <form action={updateCatalogLessonAction} className={SECTION_CLASS}>
        <input type="hidden" name="id" value={node.id} /><input type="hidden" name="editor_section" value="content" />
        <h3 className="text-xs font-semibold">课时内容</h3>
        <div className="grid gap-4 lg:grid-cols-3"><TextAreaField name="learning_objectives" label="学习目标" value={node.learning_objectives} /><TextAreaField name="lesson_tasks" label="学习任务" value={node.lesson_tasks} /><TextAreaField name="teacher_note" label="教师提示" value={node.teacher_note} /></div>
        <TextAreaField name="content_text" label="课程正文" value={node.content_text} rows={9} />
        <div className="grid gap-4 lg:grid-cols-3"><TextAreaField name="key_points" label="重点内容" value={node.key_points} /><TextAreaField name="case_study" label="案例" value={node.case_study} /><TextAreaField name="common_mistakes" label="易错点" value={node.common_mistakes} /><TextAreaField name="summary_text" label="课时总结" value={node.summary_text} /><TextAreaField name="reflection_questions" label="思考问题" value={node.reflection_questions} /><TextAreaField name="extra_note" label="补充说明" value={node.extra_note} /></div>
        <SaveButton label="保存课时内容" />
      </form>
      <form action={updateCatalogLessonAction} className={SECTION_CLASS}>
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
      <div className={SECTION_CLASS}><h3 className="text-xs font-semibold">完成与开放规则</h3><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><label className={LABEL_CLASS}>完成条件<select name="completion_rule" defaultValue={node.completion_rule} className={INPUT_CLASS}>{Object.entries(COMPLETION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className={LABEL_CLASS}>开放方式<select name="unlock_mode" defaultValue={node.unlock_mode} className={INPUT_CLASS}>{Object.entries(UNLOCK_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className={LABEL_CLASS}>前置章节<select name="prerequisite_chapter_id" defaultValue={node.prerequisite_chapter_id ?? ""} className={INPUT_CLASS}><option value="">无</option>{options.chapters.filter((item) => item.id !== node.id && item.lesson_id === node.lesson_id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label className={LABEL_CLASS}>要求分数<input name="required_score" type="number" min={0} max={100} defaultValue={node.required_score ?? 80} className={INPUT_CLASS} /></label><label className={LABEL_CLASS}>开放时间<input name="available_from" type="datetime-local" defaultValue={datetimeLocalValue(node.available_from)} className={INPUT_CLASS} /></label></div><label className="flex items-center gap-2 text-[11px] font-medium"><input name="is_manually_locked" type="checkbox" defaultChecked={node.is_manually_locked} />临时锁定</label>{node.chapter_test_id && <p className="text-[10px] text-[var(--app-muted)]">已关联章节测试：{node.chapter_test_id}</p>}</div>
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

export function CourseCatalogEditDialog({ node, options }: { node: CourseCatalogNode; options: CourseCatalogActionOptions }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-8 items-center gap-1.5 border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 text-[11px] font-semibold hover:bg-[var(--app-soft-bg)]"><PencilLine size={12} />编辑</button>
      <DialogContent className="max-h-[92vh] max-w-[min(1100px,calc(100vw-32px))] overflow-y-auto p-0">
        <DialogHeader className="border-b border-[var(--app-border)] px-5 py-4 text-left"><DialogTitle>编辑“{node.title}”</DialogTitle><DialogDescription>发布状态随当前完整表单一并保存，不使用额外的快捷发布操作。</DialogDescription></DialogHeader>
        <div className="p-5"><EditContent node={node} options={options} /></div>
      </DialogContent>
    </Dialog>
  );
}

type CreateTarget = { kind: "category"; parentId?: string; title: string; sortOrder: number } | { kind: "course"; categoryId: string; title: string; sortOrder: number } | { kind: "lesson"; courseId: string; title: string; sortOrder: number } | { kind: "chapter"; lessonId: string; title: string; sortOrder: number };

function CreateForm({ target }: { target: CreateTarget }) {
  if (target.kind === "category") return <form action={createCourseCategoryAction} className="space-y-4">{target.parentId && <input type="hidden" name="parent_id" value={target.parentId} />}<CreateFields sortOrder={target.sortOrder} /><SaveButton label="创建分类" /></form>;
  if (target.kind === "course") return <form action={createCatalogCourseAction} className="space-y-4"><input type="hidden" name="category_id" value={target.categoryId} /><CreateFields sortOrder={target.sortOrder} /><label className={LABEL_CLASS}>课程等级<input name="level" defaultValue="beginner" className={INPUT_CLASS} /></label><SaveButton label="创建课程" /></form>;
  if (target.kind === "lesson") return <form action={createCatalogLessonAction} className="space-y-4"><input type="hidden" name="course_id" value={target.courseId} /><CreateFields sortOrder={target.sortOrder} /><label className={LABEL_CLASS}>预计时长（分钟）<input name="duration_minutes" type="number" min={1} max={600} defaultValue={30} className={INPUT_CLASS} /></label><SaveButton label="创建课时" /></form>;
  return <form action={createCourseChapterAction} className="space-y-4"><input type="hidden" name="lesson_id" value={target.lessonId} /><CreateFields sortOrder={target.sortOrder} /><label className={LABEL_CLASS}>预计时长（分钟）<input name="duration_minutes" type="number" min={1} max={600} defaultValue={20} className={INPUT_CLASS} /></label><SaveButton label="创建章节" /></form>;
}

export function CourseCatalogCreateDialog({ target, primary = false }: { target: CreateTarget; primary?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button type="button" onClick={() => setOpen(true)} className={primary ? "inline-flex h-9 items-center gap-1.5 bg-[var(--app-primary)] px-4 text-xs font-semibold text-white hover:opacity-90" : "inline-flex h-8 items-center gap-1.5 border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 text-[11px] font-semibold hover:bg-[var(--app-soft-bg)]"}><Plus size={13} />{target.title}</button>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-0"><DialogHeader className="border-b border-[var(--app-border)] px-5 py-4 text-left"><DialogTitle>{target.title}</DialogTitle><DialogDescription>使用现有课程管理 Action 创建平台内容。</DialogDescription></DialogHeader><div className="p-5"><CreateForm target={target} /></div></DialogContent>
    </Dialog>
  );
}

export function getCreateChildTarget(node: CourseCatalogNode, options: CourseCatalogActionOptions): CreateTarget | null {
  if ("parent_id" in node) {
    if (!node.parent_id) return { kind: "category", parentId: node.id, title: `在“${node.title}”中新建分类`, sortOrder: options.categories.filter((item) => item.parent_id === node.id).length * 10 + 10 };
    return { kind: "course", categoryId: node.id, title: `在“${node.title}”中新建课程`, sortOrder: options.courses.filter((item) => item.category_id === node.id).length * 10 + 10 };
  }
  if ("category_id" in node) return { kind: "lesson", courseId: node.id, title: `在“${node.title}”中新建课时`, sortOrder: options.lessons.filter((item) => item.course_id === node.id).length * 10 + 10 };
  if ("course_id" in node) return { kind: "chapter", lessonId: node.id, title: `在“${node.title}”中新建章节`, sortOrder: options.chapters.filter((item) => item.lesson_id === node.id).length * 10 + 10 };
  return null;
}
