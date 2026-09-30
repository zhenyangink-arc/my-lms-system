"use server";

import { revalidateDashboard } from "@/lib/revalidate-dashboard";
import { requireActiveUser } from "@/lib/auth";
import { refreshStudentHomeLearningForApp } from "@/features/student-home-learning/api/refresh-for-app";
import { getStudentAppSlugById } from "@/lib/student-app-access.server";

export type MasterReviewItemActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function markStudentReviewItemMasteredAction(
  itemId: string,
  _previousState: MasterReviewItemActionState,
  _formData: FormData,
): Promise<MasterReviewItemActionState> {
  void _previousState;
  void _formData;
  if (!UUID_PATTERN.test(itemId)) {
    return { status: "error", message: "复习项目编号无效，请刷新后重试。" };
  }
  const { supabase, user, profile, tenant } = await requireActiveUser();
  if (profile?.role !== "student") {
    return { status: "error", message: "只有学生本人可以更新掌握状态。" };
  }
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("student_review_items")
    .update({
      status: "mastered",
      mastered_at: now,
      last_reviewed_at: now,
    })
    .eq("id", itemId)
    .eq("student_id", user.id)
    .select("id,status,mastered_at,student_app_id")
    .maybeSingle();
  if (error || !data || data.status !== "mastered" || !data.mastered_at) {
    return { status: "error", message: "掌握状态保存失败，请稍后重试。" };
  }
  revalidateDashboard("/dashboard/progress");
  // 按错题记录本身所属的应用刷新，应用由服务端读取。
  const appSlug = getStudentAppSlugById(data.student_app_id);
  if (appSlug) {
    revalidateDashboard(`/[space]/apps/${appSlug}/practice/review`, "page");
  }
  if (tenant?.id) {
    refreshStudentHomeLearningForApp({
      tenantId: tenant.id,
      studentId: user.id,
      studentAppId: data.student_app_id,
      space: tenant.slug,
    });
  }
  return { status: "success", message: "已标记为重新掌握。" };
}
