"use server";

import { revalidateDashboard } from "@/lib/revalidate-dashboard";

import { requireActiveUser } from "@/lib/auth";

export async function removeCourseQuestionReviewAction(questionId: string) {
  const { supabase, user, profile } = await requireActiveUser();
  if (profile?.role === "platform_course_inspector") {
    throw new Error("课程巡检员处于只读巡检模式，不能修改学生学习记录。");
  }
  const normalizedQuestionId = String(questionId ?? "").trim();

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      normalizedQuestionId
    )
  ) {
    throw new Error("题目信息无效，请刷新页面后重试。");
  }

  const { error } = await supabase
    .from("chapter_test_question_reviews")
    .delete()
    .eq("student_id", user.id)
    .eq("question_id", normalizedQuestionId);

  if (error) {
    throw new Error(error.message || "移出复习失败，请稍后重试。");
  }

  revalidateDashboard("/dashboard/progress");
}
