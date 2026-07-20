import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpenCheck, CheckCircle2, Download, Eye, ExternalLink, FileText, ListChecks, ShieldCheck, Video } from "lucide-react";

import { DashboardPageHeader } from "@/app/dashboard/DashboardPageHeader";
import { requireAdmin } from "@/lib/admin";
import { createR2SignedVideoUrl } from "@/lib/r2";

type Course = { id: string; title: string; description: string | null };
type Lesson = {
  id: string; course_id: string; title: string; description: string | null; lesson_type: string;
  duration_minutes: number; is_published: boolean; is_free_preview: boolean; content_text: string | null;
  video_url: string | null; video_provider: string | null; video_object_key: string | null;
  attachment_url: string | null; attachment_label: string | null; teacher_note: string | null;
  learning_objectives: string | null; lesson_tasks: string | null; key_points: string | null;
  case_study: string | null; common_mistakes: string | null; summary_text: string | null;
  reflection_questions: string | null; extra_note: string | null;
};
type Resource = { id: string; title: string; description: string | null; resource_type: string; resource_url: string | null; original_file_name: string | null; is_required: boolean; is_published: boolean; sort_order: number };

const sections: Array<[keyof Lesson, string]> = [
  ["learning_objectives", "学习目标"], ["lesson_tasks", "学习任务"], ["key_points", "核心要点"],
  ["content_text", "正文内容"], ["case_study", "案例分析"], ["common_mistakes", "常见错误"],
  ["summary_text", "课时总结"], ["reflection_questions", "反思问题"], ["teacher_note", "教师提示"], ["extra_note", "补充说明"],
];

export default async function LessonAuditPreviewPage({ params }: { params: Promise<{ courseId: string; lessonId: string }> }) {
  const { courseId, lessonId } = await params;
  const { supabase, role } = await requireAdmin();
  const [{ data: courseData }, { data: lessonData }, { data: resourceData }] = await Promise.all([
    supabase.from("courses").select("id,title,description").eq("id", courseId).maybeSingle(),
    supabase.from("lessons").select("id,course_id,title,description,lesson_type,duration_minutes,is_published,is_free_preview,content_text,video_url,video_provider,video_object_key,attachment_url,attachment_label,teacher_note,learning_objectives,lesson_tasks,key_points,case_study,common_mistakes,summary_text,reflection_questions,extra_note").eq("id", lessonId).eq("course_id", courseId).maybeSingle(),
    supabase.from("lesson_resources").select("id,title,description,resource_type,resource_url,original_file_name,is_required,is_published,sort_order").eq("lesson_id", lessonId).order("sort_order"),
  ]);
  if (!courseData || !lessonData) notFound();
  const course = courseData as Course;
  const lesson = lessonData as Lesson;
  const resources = (resourceData ?? []) as Resource[];
  let videoUrl = lesson.video_url;
  if (lesson.video_provider === "r2" && lesson.video_object_key) videoUrl = await createR2SignedVideoUrl(lesson.video_object_key);
  const isPlatformAudit = role === "platform_super_admin";

  return (
    <>
      <DashboardPageHeader title="课程内容巡检" description="以只读管理身份核对课时内容，不进入学生学习流程。" />
      <div className="mx-auto w-full max-w-[1400px] space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><Link href={`/dashboard/admin/courses/${course.id}`} className="inline-flex items-center gap-2 text-sm font-black app-muted-text"><ArrowLeft size={16} />返回课时管理</Link><span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><Eye size={14} />{isPlatformAudit ? "平台上帝视角" : "管理员巡检视角"}</span></div>

        <section className="rounded-3xl border p-5 sm:p-6" style={{ borderColor: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}>
          <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0" size={21} style={{ color: "var(--app-accent)" }} /><div><h2 className="font-black">只读巡检模式</h2><p className="mt-1 text-sm leading-6 app-muted-text">本页面不会查询或写入学习进度，不创建学生身份，不记录观看状态，也不提供学生提问、完成课时或提交作业操作。</p></div></div>
        </section>

        <section className="app-card rounded-3xl border p-5 sm:p-6"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-black ${lesson.is_published ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{lesson.is_published ? "已发布" : "未发布"}</span><span className="app-soft-card rounded-full border px-3 py-1 text-xs font-black">{lesson.lesson_type}</span><span className="app-soft-card rounded-full border px-3 py-1 text-xs font-black">{lesson.duration_minutes} 分钟</span>{lesson.is_free_preview && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">学生可试看</span>}</div><p className="app-muted-text mt-4 text-xs font-black">{course.title}</p><h1 className="mt-1 text-3xl font-black tracking-tight">{lesson.title}</h1><p className="app-muted-text mt-3 max-w-4xl text-sm leading-6">{lesson.description || "暂无课时简介"}</p></section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
          <div className="space-y-5">
            <section className="app-card rounded-3xl border p-5"><h2 className="flex items-center gap-2 text-lg font-black"><Video size={19} />视频检查</h2><div className="mt-4">{videoUrl && ["r2", "upload"].includes(lesson.video_provider ?? "") ? <video controls preload="metadata" src={videoUrl} className="aspect-video w-full rounded-2xl bg-black" /> : videoUrl ? <a href={videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-black text-white" style={{ backgroundColor: "var(--app-accent)" }}><ExternalLink size={16} />打开外部视频</a> : <p className="app-muted-text rounded-2xl border border-dashed p-6 text-center text-sm">当前课时没有视频。</p>}</div></section>
            {sections.map(([key, label]) => { const value = lesson[key]; if (typeof value !== "string" || !value.trim()) return null; return <section key={key} className="app-card rounded-3xl border p-5"><h2 className="flex items-center gap-2 text-lg font-black"><BookOpenCheck size={18} />{label}</h2><div className="mt-4 whitespace-pre-wrap text-sm leading-7">{value}</div></section>; })}
          </div>
          <div className="space-y-5">
            <section className="app-card rounded-3xl border p-5"><h2 className="flex items-center gap-2 text-lg font-black"><ListChecks size={18} />学习资料</h2><div className="mt-4 space-y-3">{resources.map((resource) => <article key={resource.id} className="app-soft-card rounded-2xl border p-4"><div className="flex flex-wrap items-center gap-2"><p className="font-black">{resource.title}</p>{resource.is_required && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-black text-amber-700">必读</span>}<span className={`rounded-full px-2 py-0.5 text-xs font-black ${resource.is_published ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{resource.is_published ? "已发布" : "未发布"}</span></div>{resource.description && <p className="app-muted-text mt-2 text-xs leading-5">{resource.description}</p>}<a href={resource.resource_type === "file" ? `/api/lesson-resources/${resource.id}/download` : resource.resource_url ?? "#"} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-black" style={{ color: "var(--app-accent)" }}>{resource.resource_type === "file" ? <Download size={14} /> : <ExternalLink size={14} />}{resource.original_file_name || "检查资源"}</a></article>)}{resources.length === 0 && <p className="app-muted-text rounded-2xl border border-dashed p-5 text-center text-sm">暂无资料</p>}</div></section>
            {lesson.attachment_url && <section className="app-card rounded-3xl border p-5"><h2 className="flex items-center gap-2 text-lg font-black"><FileText size={18} />课时附件</h2><a href={lesson.attachment_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-black" style={{ color: "var(--app-accent)" }}><ExternalLink size={15} />{lesson.attachment_label || "检查附件"}</a></section>}
            <section className="app-card rounded-3xl border p-5"><h2 className="flex items-center gap-2 text-lg font-black"><CheckCircle2 size={18} />巡检确认</h2><p className="app-muted-text mt-3 text-sm leading-6">内容确认无误后返回管理页；需要修改时进入“编辑课时”。本页面本身不保存任何用户行为。</p></section>
          </div>
        </div>
      </div>
    </>
  );
}
