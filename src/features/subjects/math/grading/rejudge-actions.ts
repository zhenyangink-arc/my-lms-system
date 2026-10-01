"use server";

import { revalidateDashboard } from "@/lib/revalidate-dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getStudentAppSlugById } from "@/lib/student-app-access.server";
import { getTenantAppCapabilityContext } from "@/lib/tenant-app-capabilities";

import { gradePendingMathAnswers, MAX_SUBMISSIONS_PER_RUN } from "./machine-grading";
import { createStore } from "./machine-grading.server";

type RejudgeState = { status: "idle" | "success" | "error"; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PENDING_STATES = ["submitted_pending_grading", "objective_graded_pending_manual"];

/**
 * 用原判题规格重新判题：只重算仍在“待批改”阶段的提交，新增修订号、保留旧结果；
 * 不改规格，不改任何正式得分。需要该应用的“管理测评”权限，且只处理当前账号能看到的提交。
 */
export async function rejudgeMathAnswersAction(
  _previousState: RejudgeState,
  formData: FormData,
): Promise<RejudgeState> {
  void _previousState;
  const assignmentId = formData.get("assignment_id");
  if (typeof assignmentId !== "string" || !UUID.test(assignmentId)) {
    return { status: "error", message: "作业编号不正确。" };
  }

  // 先用调用者自己的连接读取作业（受 RLS 约束），再按作业所属应用校验权限
  const userSupabase = await createClient();
  const { data: assignment } = await userSupabase
    .from("learning_assignments")
    .select("id,student_app_id")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!assignment || getStudentAppSlugById(assignment.student_app_id as string) !== "math") {
    return { status: "error", message: "作业不存在或不是数学作业。" };
  }
  const context = await getTenantAppCapabilityContext(assignment.student_app_id as string, "manageAssessments");
  if (!context) return { status: "error", message: "没有该应用的批改权限。" };

  const { data: submissions } = await context.supabase
    .from("learning_submissions")
    .select("id")
    .eq("assignment_id", assignmentId)
    .in("submission_state", PENDING_STATES)
    .order("submitted_at", { ascending: true })
    .limit(MAX_SUBMISSIONS_PER_RUN + 1);
  const found = (submissions ?? []).map((row) => row.id as string);
  // 多取一条用来判断是否被截断；超出上限的提交这次不处理，需要再点一次
  const truncated = found.length > MAX_SUBMISSIONS_PER_RUN;
  const ids = found.slice(0, MAX_SUBMISSIONS_PER_RUN);
  if (ids.length === 0) return { status: "success", message: "没有待批改的提交需要重新判题。" };

  try {
    const result = await gradePendingMathAnswers(createStore(createAdminClient()), ids, { regrade: true });
    revalidateDashboard("/dashboard/admin/apps/[appSlug]/assignments/[assignmentId]", "page");
    return {
      status: result.failed > 0 ? "error" : "success",
      message:
        result.failed > 0
          ? `已重新判题 ${result.recorded} 道，${result.failed} 道失败，请稍后重试。`
          : `已重新判题 ${result.recorded} 道作答（旧结果已保留，建议分以最新一次为准）。${
              truncated ? `待批改提交超过 ${MAX_SUBMISSIONS_PER_RUN} 份，这次只处理了最早的 ${MAX_SUBMISSIONS_PER_RUN} 份。` : ""
            }`,
    };
  } catch {
    return { status: "error", message: "重新判题失败，请稍后重试。" };
  }
}
