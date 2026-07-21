import { NextRequest, NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth";

export const runtime = "edge";

/*
  标记一条老师回复为"已读"，然后跳转回对应课时页面。

  使用场景：
  学生在控制台"老师回复提醒"里点击一条通知，
  这个路由先把 student_read_at 更新成当前时间，再跳转过去，
  这样下次回到控制台，这条提醒就不会再出现了。

  安全考虑：
  1. .eq("student_id", user.id) 确保只能标记自己的提问，不能改别人的
  2. redirect 目标做了白名单校验，只允许跳到 /dashboard/courses/ 开头的路径，
     防止被构造成任意跳转到外部地址（open redirect）
*/
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const { questionId } = await params;

  const auth = await getAuthContext();

  if (auth.status === "unauthenticated") {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  if (auth.status === "inactive") {
    return NextResponse.redirect(new URL("/account-disabled", request.url), 303);
  }

  const { supabase, user } = auth;

  const { searchParams } = new URL(request.url);
  const redirectTo = searchParams.get("to");

  const { data: updatedQuestion, error } = await supabase
    .from("lesson_questions")
    .update({ student_read_at: new Date().toISOString() })
    .eq("id", questionId)
    .eq("student_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to mark question as read" }, { status: 500 });
  }

  if (!updatedQuestion) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const safeRedirectPath =
    redirectTo && redirectTo.startsWith("/dashboard/courses/")
      ? redirectTo
      : "/dashboard";

  return NextResponse.redirect(new URL(safeRedirectPath, request.url), 303);
}
