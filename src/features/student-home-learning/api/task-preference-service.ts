import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSeoulDateKey, getSeoulWeekRange } from "@/features/student-weekly-learning-plan/week";

export const STUDENT_TASK_SNOOZE_OPTIONS = [
  "later_today",
  "tomorrow",
  "this_week",
] as const;

export type StudentTaskSnoozeOption =
  (typeof STUDENT_TASK_SNOOZE_OPTIONS)[number];

const DAY_MS = 86_400_000;

function preferenceWindow(option: StudentTaskSnoozeOption, now: Date) {
  if (option === "this_week") {
    return {
      snoozed_until: null,
      dismissed_for_week: getSeoulWeekRange(now).weekStartDate,
    };
  }
  if (option === "tomorrow") {
    const tomorrow = getSeoulDateKey(new Date(now.getTime() + DAY_MS));
    return {
      snoozed_until: new Date(`${tomorrow}T09:00:00+09:00`).toISOString(),
      dismissed_for_week: null,
    };
  }

  const nextSeoulDate = getSeoulDateKey(new Date(now.getTime() + DAY_MS));
  const endOfToday = new Date(`${nextSeoulDate}T00:00:00+09:00`).getTime();
  return {
    snoozed_until: new Date(
      Math.min(now.getTime() + 3 * 60 * 60_000, endOfToday),
    ).toISOString(),
    dismissed_for_week: null,
  };
}

export async function snoozeStudentLearningTask({
  supabase,
  tenantId,
  studentId,
  studentAppId,
  taskKey,
  option,
  now = new Date(),
}: {
  supabase: SupabaseClient;
  tenantId: string;
  studentId: string;
  studentAppId: string;
  taskKey: string;
  option: StudentTaskSnoozeOption;
  now?: Date;
}) {
  const { error } = await supabase
    .from("student_learning_task_preferences")
    .upsert(
      {
        tenant_id: tenantId,
        student_id: studentId,
        student_app_id: studentAppId,
        task_key: taskKey,
        ...preferenceWindow(option, now),
      },
      {
        onConflict: "tenant_id,student_id,student_app_id,task_key",
      },
    );

  if (error) {
    throw new Error(error.message, { cause: error });
  }
}

export async function restoreStudentLearningTask({
  supabase,
  tenantId,
  studentId,
  studentAppId,
  taskKey,
}: {
  supabase: SupabaseClient;
  tenantId: string;
  studentId: string;
  studentAppId: string;
  taskKey: string;
}) {
  const { error } = await supabase
    .from("student_learning_task_preferences")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .eq("student_app_id", studentAppId)
    .eq("task_key", taskKey);

  if (error) throw new Error("暂缓状态恢复失败", { cause: error });
}
