"use server";

import { z } from "zod";
import { requirePlatformOwner } from "@/lib/admin";
import { revalidatePath } from "next/cache";

export type CreateTeachingContentState = {
  message: string;
  chapterId?: string;
  appSlug?: string;
};

const inputSchema = z.object({
  lessonId: z.string().uuid(),
  updatedAt: z.string().datetime({ offset: true }),
  chapterTitle: z.string().trim().min(1).max(120),
  objectives: z.array(z.string().trim().min(1).max(400)).max(6),
});

export async function createTeachingContentAction(
  _previous: CreateTeachingContentState,
  formData: FormData,
): Promise<CreateTeachingContentState> {
  const { supabase } = await requirePlatformOwner();
  const input = inputSchema.safeParse({
    lessonId: formData.get("lesson_id"),
    updatedAt: formData.get("updated_at"),
    chapterTitle: formData.get("chapter_title"),
    objectives: String(formData.get("objectives") ?? "").split("\n").map(v => v.trim()).filter(Boolean),
  });
  if (!input.success) return { message: "请检查课时、章节名称和学习目标（最多六条，每条400字）。" };
  const { data, error } = await supabase.rpc("create_teaching_content_skeleton", {
    p_lesson_id: input.data.lessonId,
    p_expected_updated_at: input.data.updatedAt,
    p_chapter_title: input.data.chapterTitle,
    p_objectives: input.data.objectives,
  });
  if (error) {
    const messages: Record<string, string> = {
      AUTHORING_FORBIDDEN: "没有权限创建教学内容。",
      AUTHORING_CONTENT_EXISTS: "该课时已有教学内容。请从课程结构进入已有教材；不完整的旧教材需要单独核查。",
      AUTHORING_RESOURCE_CHANGED: "课时状态已变化，请刷新后重新选择。",
      AUTHORING_PROFILE_UNAVAILABLE: "韩语教学配置尚未就绪，请联系平台负责人。",
    };
    return { message: messages[error.message] ?? "创建失败，请稍后重试；若已有内容，请先核查课程结构。" };
  }
  if (!data?.chapterId || data.appSlug !== "korean") return { message: "无法确认创建结果，请刷新后核查课程结构。" };
  revalidatePath("/[space]/dashboard/admin/apps/[appSlug]/textbooks", "page");
  revalidatePath("/[space]/dashboard/admin/apps/[appSlug]/teaching-scripts", "page");
  return { message: "教学内容草稿已创建。请继续编写脚本并审核发布。", chapterId: data.chapterId, appSlug: data.appSlug };
}
