import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { StudentCourseCompletionEvaluation } from "./types";

export type EvaluateStudentCourseCompletionInput = {
  studentId: string;
  courseId: string;
  policyId?: string;
};

/**
 * Runs the database-owned, auditable completion calculation with service-role
 * credentials. The RPC is not executable by browser-authenticated roles.
 */
export async function evaluateStudentCourseCompletion({
  studentId,
  courseId,
  policyId,
}: EvaluateStudentCourseCompletionInput) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    "evaluate_student_course_completion",
    {
      p_student_id: studentId,
      p_course_id: courseId,
      p_policy_id: policyId ?? null,
    },
  );

  if (error) {
    throw new Error(`结课资格计算失败：${error.message}`, { cause: error });
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("结课资格计算没有返回有效快照。");
  }

  return data as StudentCourseCompletionEvaluation;
}

