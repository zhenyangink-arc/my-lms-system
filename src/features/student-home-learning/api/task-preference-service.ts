import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  DEFAULT_VIEWER_TIME_ZONE,
  startOfDayInTimeZone,
  weekStartKeyInTimeZone,
  zonedTimeToDate,
} from "@/lib/viewer-time-zone";

export const STUDENT_TASK_SNOOZE_OPTIONS = [
  "later_today",
  "tomorrow",
  "this_week",
] as const;

export type StudentTaskSnoozeOption =
  (typeof STUDENT_TASK_SNOOZE_OPTIONS)[number];

function preferenceWindow(option: StudentTaskSnoozeOption, now: Date, timeZone: string) {
  if (option === "this_week") {
    return {
      snoozed_until: null,
      dismissed_for_week: weekStartKeyInTimeZone(now, timeZone),
    };
  }
  const tomorrowKey = addDaysToDateKey(dateKeyInTimeZone(now, timeZone), 1);
  if (option === "tomorrow") {
    return {
      snoozed_until: zonedTimeToDate(tomorrowKey, 9, 0, timeZone).toISOString(),
      dismissed_for_week: null,
    };
  }

  const endOfToday = startOfDayInTimeZone(tomorrowKey, timeZone).getTime();
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
  timeZone = DEFAULT_VIEWER_TIME_ZONE,
}: {
  supabase: SupabaseClient;
  tenantId: string;
  studentId: string;
  studentAppId: string;
  taskKey: string;
  option: StudentTaskSnoozeOption;
  now?: Date;
  /** 用户时区（“明天上午 9 点”“今天结束”“本周”按它算）；不传时是首尔。 */
  timeZone?: string;
}) {
  const { error } = await supabase
    .from("student_learning_task_preferences")
    .upsert(
      {
        tenant_id: tenantId,
        student_id: studentId,
        student_app_id: studentAppId,
        task_key: taskKey,
        ...preferenceWindow(option, now, timeZone),
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
