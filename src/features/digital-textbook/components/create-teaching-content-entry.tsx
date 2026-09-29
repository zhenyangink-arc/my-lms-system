import { requirePlatformOwner } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreateTeachingContentForm } from "./create-teaching-content-form";

/** Mounted only for the same author role as Script Studio; reads never create content. */
export async function CreateTeachingContentEntry({ studentAppId }: { studentAppId: string }) {
  await requirePlatformOwner();
  const admin = createAdminClient();
  const { data: app, error: appError } = await admin.from("student_apps").select("slug").eq("id", studentAppId).maybeSingle();
  if (appError || app?.slug !== "korean") return null;
  const { data: courses, error: courseError } = await admin.from("courses").select("id,title").eq("student_app_id", studentAppId).order("sort_order");
  if (courseError) return <p role="alert">课时读取失败，请刷新后重试。</p>;
  if (!courses?.length) return null;
  const [lessonResult, textbookResult] = await Promise.all([
    admin.from("lessons").select("id,title,course_id,updated_at").in("course_id", courses.map(c => c.id)).order("sort_order"),
    admin.from("digital_textbooks").select("lesson_id").eq("student_app_id", studentAppId),
  ]);
  if (lessonResult.error || textbookResult.error) return <p role="alert">课时读取失败，请刷新后重试。</p>;
  const existing = new Set((textbookResult.data ?? []).map(t => t.lesson_id));
  return <CreateTeachingContentForm lessons={(lessonResult.data ?? []).filter(l => !existing.has(l.id)).map(l => ({
    id: l.id, updatedAt: l.updated_at, title: `${courses.find(c => c.id === l.course_id)?.title ?? ""} / ${l.title}`,
  }))} />;
}
