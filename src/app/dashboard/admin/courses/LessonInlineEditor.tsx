import { updateCatalogLessonAction } from "./catalog-actions";
import { CourseCoverUploadField } from "./CourseCoverUploadField";
import { CourseInlineEditorTabs } from "./CourseInlineEditorTabs";
import { LessonResourceTable, type LessonResourceRow } from "./LessonResourceTable";

type LessonEditorValue = {
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
};

const inputClass = "app-input mt-1.5 w-full rounded-[7px] border px-3 py-2.5 text-[12px] outline-none";
const labelClass = "course-editor-field block text-[11px] font-medium";

const unlockLabels: Record<string, string> = {
  immediate: "立即开放",
  previous_completed: "完成上一项",
  prerequisite_completed: "完成指定前置项",
  prerequisite_passed: "通过指定章节",
  scheduled: "按时间开放",
  manual: "手动开放",
};

function datetimeLocalValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function TextAreaField({ name, label, value, rows = 4 }: { name: string; label: string; value: string | null; rows?: number }) {
  return <label className={labelClass}>{label}<textarea name={name} rows={rows} defaultValue={value ?? ""} className={`${inputClass} resize-y leading-5`} /></label>;
}

function SaveButton({ label }: { label: string }) {
  return <button type="submit" className="rounded-[7px] px-4 py-2.5 text-[12px] font-semibold text-white" style={{ backgroundColor: "var(--primary)" }}>{label}</button>;
}

export function LessonInlineEditor({
  lesson,
  lessons,
  chapters,
  resources,
  resourceError,
  canPermanentlyDelete,
}: {
  lesson: LessonEditorValue;
  lessons: Array<{ id: string; course_id: string; title: string }>;
  chapters: Array<{ id: string; title: string }>;
  resources: LessonResourceRow[];
  resourceError?: string;
  canPermanentlyDelete: boolean;
}) {
  return (
    <CourseInlineEditorTabs
      basic={
        <form action={updateCatalogLessonAction} className="space-y-6">
          <input type="hidden" name="id" value={lesson.id} />
          <input type="hidden" name="editor_section" value="basic" />
          <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
            <CourseCoverUploadField kind="lesson" entityId={lesson.id} currentObjectKey={lesson.cover_object_key} alt={lesson.cover_alt ?? lesson.title} />
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className={labelClass}>名称<input name="title" required maxLength={100} defaultValue={lesson.title} className={inputClass} /></label>
                <label className={labelClass}>路径标识<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" defaultValue={lesson.slug} className={inputClass} /></label>
              </div>
              <label className={labelClass}>简介<textarea name="description" rows={3} maxLength={500} defaultValue={lesson.description ?? ""} className={`${inputClass} resize-y leading-5`} /></label>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className={labelClass}>排序<input name="sort_order" type="number" min={0} max={100000} defaultValue={lesson.sort_order} className={inputClass} /></label>
                <label className={labelClass}>图片焦点<select name="cover_focal_point" defaultValue={lesson.cover_focal_point ?? "center"} className={inputClass}><option value="center">居中</option><option value="top">顶部</option><option value="bottom">底部</option><option value="left">左侧</option><option value="right">右侧</option></select></label>
                <label className={labelClass}>配图替代文字<input name="cover_alt" maxLength={160} defaultValue={lesson.cover_alt ?? lesson.title} className={inputClass} /></label>
                <label className={labelClass}>内容类型<select name="lesson_type" defaultValue={lesson.lesson_type ?? "video"} className={inputClass}><option value="video">视频课</option><option value="reading">图文课</option><option value="practice">练习课</option><option value="live">直播课</option></select></label>
                <label className={labelClass}>预计时长（分钟）<input name="duration_minutes" type="number" min={1} max={600} defaultValue={lesson.duration_minutes ?? 30} className={inputClass} /></label>
              </div>
              <div className="flex flex-wrap gap-5">
                <label className="flex items-center gap-2 text-[11px] font-medium"><input name="is_published" type="checkbox" defaultChecked={lesson.is_published} />对学生端发布</label>
                <label className="flex items-center gap-2 text-[11px] font-medium"><input name="is_free_preview" type="checkbox" defaultChecked={lesson.is_free_preview} />允许免费试看</label>
              </div>
            </div>
          </div>
          <div className="border-t pt-5" style={{ borderColor: "var(--border)" }}>
            <h3 className="mb-4 text-[12px] font-semibold">视频来源</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <label className={labelClass}>视频存储方式<select name="video_provider" defaultValue={lesson.video_provider ?? "r2"} className={inputClass}><option value="r2">对象存储</option><option value="external">外部地址</option></select></label>
              <label className={labelClass}>MIME 类型<input name="video_mime_type" defaultValue={lesson.video_mime_type ?? "video/mp4"} className={inputClass} /></label>
              <label className={labelClass}>视频对象键<input name="video_object_key" defaultValue={lesson.video_object_key ?? ""} placeholder="course-videos/..." className={inputClass} /></label>
              <label className={labelClass}>外部视频链接<input name="video_url" type="url" defaultValue={lesson.video_url ?? ""} placeholder="请输入完整链接" className={inputClass} /></label>
            </div>
          </div>
          <SaveButton label="保存基本信息" />
        </form>
      }
      content={
        <form action={updateCatalogLessonAction} className="space-y-6">
          <input type="hidden" name="id" value={lesson.id} />
          <input type="hidden" name="editor_section" value="content" />
          <div><h3 className="mb-4 text-[12px] font-semibold">学习引导</h3><div className="grid gap-4 lg:grid-cols-3"><TextAreaField name="learning_objectives" label="学习目标" value={lesson.learning_objectives} /><TextAreaField name="lesson_tasks" label="本课任务" value={lesson.lesson_tasks} /><TextAreaField name="teacher_note" label="教师提示" value={lesson.teacher_note} /></div></div>
          <div className="border-t pt-5" style={{ borderColor: "var(--border)" }}><h3 className="mb-4 text-[12px] font-semibold">核心学习内容</h3><div className="space-y-4"><TextAreaField name="content_text" label="课程正文" value={lesson.content_text} rows={10} /><div className="grid gap-4 lg:grid-cols-3"><TextAreaField name="key_points" label="重点提炼" value={lesson.key_points} /><TextAreaField name="case_study" label="案例说明" value={lesson.case_study} /><TextAreaField name="common_mistakes" label="常见错误" value={lesson.common_mistakes} /></div></div></div>
          <div className="border-t pt-5" style={{ borderColor: "var(--border)" }}><h3 className="mb-4 text-[12px] font-semibold">学习完成区</h3><div className="grid gap-4 lg:grid-cols-3"><TextAreaField name="summary_text" label="本课小结" value={lesson.summary_text} /><TextAreaField name="reflection_questions" label="思考题" value={lesson.reflection_questions} /><TextAreaField name="extra_note" label="补充说明" value={lesson.extra_note} /></div></div>
          <SaveButton label="保存课程内容" />
        </form>
      }
      rules={
        <form action={updateCatalogLessonAction} className="space-y-5">
          <input type="hidden" name="id" value={lesson.id} />
          <input type="hidden" name="editor_section" value="rules" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className={labelClass}>开放方式<select name="unlock_mode" defaultValue={lesson.unlock_mode} className={inputClass}>{Object.entries(unlockLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className={labelClass}>前置课时<select name="prerequisite_lesson_id" defaultValue={lesson.prerequisite_lesson_id ?? ""} className={inputClass}><option value="">无</option>{lessons.filter((item) => item.id !== lesson.id && item.course_id === lesson.course_id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
            <label className={labelClass}>前置章节<select name="prerequisite_chapter_id" defaultValue={lesson.prerequisite_chapter_id ?? ""} className={inputClass}><option value="">无</option>{chapters.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
            <label className={labelClass}>要求分数<input name="required_score" type="number" min={0} max={100} defaultValue={lesson.required_score ?? 80} className={inputClass} /></label>
            <label className={labelClass}>开放时间<input name="available_from" type="datetime-local" defaultValue={datetimeLocalValue(lesson.available_from)} className={inputClass} /></label>
          </div>
          <label className="flex items-center gap-2 text-[11px] font-medium"><input name="is_manually_locked" type="checkbox" defaultChecked={lesson.is_manually_locked} />临时锁定</label>
          <SaveButton label="保存开放规则" />
        </form>
      }
      resources={<LessonResourceTable lessonId={lesson.id} resources={resources} errorMessage={resourceError} canPermanentlyDelete={canPermanentlyDelete} />}
    />
  );
}
