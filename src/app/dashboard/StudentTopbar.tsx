import { requireActiveUser } from "@/lib/auth";
import { getDashboardBasePath } from "@/lib/dashboard-path";
import { MEMBERSHIP_TIER_LABELS, normalizeMembershipTier } from "@/lib/student-permissions";
import { StudentUtilityDrawer } from "./StudentUtilityDrawer";

// 顶栏不再是固定横条，改为右侧边缘触柄唤出的悬浮玻璃抽屉（见 StudentUtilityDrawer）。
// 这里只保留数据获取：租户名、用户名、未读回复数。
export async function StudentTopbar() {
  const { supabase, user, profile, tenant } = await requireActiveUser();
  const userName =
    profile?.full_name || user.user_metadata?.name || user.email || "用户";
  const accountLabel =
    profile?.role === "platform_course_inspector"
      ? "平台课程巡检员"
      : MEMBERSHIP_TIER_LABELS[normalizeMembershipTier(profile?.membership_tier)];

  let unreadCount = 0;
  const dashboardBasePath = getDashboardBasePath(tenant?.slug);

  if (profile?.role === "student") {
    const { data: answeredQuestions } = await supabase
      .from("lesson_questions")
      .select("id, answered_at, student_read_at, teacher_answer")
      .eq("student_id", user.id)
      .not("teacher_answer", "is", null);

    unreadCount = (answeredQuestions ?? []).filter(
      (row) =>
        !row.student_read_at ||
        (row.answered_at && row.student_read_at < row.answered_at)
    ).length;
  }

  return (
    <StudentUtilityDrawer
      tenantName={tenant?.name ?? "韩语教育"}
      userName={userName}
      accountLabel={accountLabel}
      unreadCount={unreadCount}
      dashboardBasePath={dashboardBasePath}
    />
  );
}
