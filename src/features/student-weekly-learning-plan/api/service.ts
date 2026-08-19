import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { calculateWeeklyLearningProgress } from "../progress";
import type {
  StudentWeeklyLearningPlan,
  StudentWeeklyLearningPlanSummary,
} from "../types";
import { getSeoulWeekRange } from "../week";

type WeeklyPlanRow = {
  id: string;
  student_app_id: string;
  week_start_date: string;
  target_days: number;
  target_minutes: number;
  preferred_days: number[] | null;
  created_at: string;
  updated_at: string;
};

type LearningTimeRow = {
  seconds: number;
  recorded_at: string;
};

type LearningActivityRow = {
  occurred_at: string;
};

function planDto(row: WeeklyPlanRow): StudentWeeklyLearningPlan {
  return {
    id: row.id,
    studentAppId: row.student_app_id,
    weekStartDate: row.week_start_date,
    targetDays: Number(row.target_days),
    targetMinutes: Number(row.target_minutes),
    preferredDays: Array.isArray(row.preferred_days)
      ? row.preferred_days.map(Number)
      : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const PLAN_COLUMNS =
  "id,student_app_id,week_start_date,target_days,target_minutes,preferred_days,created_at,updated_at";

export async function saveCurrentStudentWeeklyPlan({
  supabase,
  tenantId,
  studentId,
  studentAppId,
  targetDays,
  targetMinutes,
  preferredDays,
  now = new Date(),
}: {
  supabase: SupabaseClient;
  tenantId: string;
  studentId: string;
  studentAppId: string;
  targetDays: number;
  targetMinutes: number;
  preferredDays: number[];
  now?: Date;
}): Promise<StudentWeeklyLearningPlan> {
  const { weekStartDate } = getSeoulWeekRange(now);
  const { data, error } = await supabase
    .from("student_weekly_learning_plans")
    .upsert(
      {
        tenant_id: tenantId,
        student_id: studentId,
        student_app_id: studentAppId,
        week_start_date: weekStartDate,
        target_days: targetDays,
        target_minutes: targetMinutes,
        preferred_days: preferredDays,
      },
      {
        onConflict: "tenant_id,student_id,student_app_id,week_start_date",
      },
    )
    .select(PLAN_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error("本周学习目标保存失败", { cause: error });
  }
  return planDto(data as WeeklyPlanRow);
}

/**
 * 学习分钟取本周 `learning_time_log` 的增量秒数；学习天数取时长明细和
 * Packet 4/5 的统一学习行为账本日期并集，覆盖课时完成、教材学习、作业、
 * 测试和练习等已有完成事实，同时避免重复日期被重复计数。
 */
export async function loadCurrentStudentWeeklyPlan({
  supabase,
  tenantId,
  studentId,
  studentAppId,
  now = new Date(),
}: {
  supabase: SupabaseClient;
  tenantId: string;
  studentId: string;
  studentAppId: string;
  now?: Date;
}): Promise<StudentWeeklyLearningPlanSummary> {
  const week = getSeoulWeekRange(now);
  const [planResult, timeResult, activityResult] = await Promise.all([
    supabase
      .from("student_weekly_learning_plans")
      .select(PLAN_COLUMNS)
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .eq("student_app_id", studentAppId)
      .eq("week_start_date", week.weekStartDate)
      .maybeSingle(),
    supabase
      .from("learning_time_log")
      .select("seconds,recorded_at")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .eq("student_app_id", studentAppId)
      .gte("recorded_at", week.startsAt)
      .lt("recorded_at", week.endsAt),
    supabase
      .from("student_learning_activity_events")
      .select("occurred_at")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .eq("student_app_id", studentAppId)
      .gte("occurred_at", week.startsAt)
      .lt("occurred_at", week.endsAt),
  ]);

  if (planResult.error) {
    throw new Error("本周学习目标读取失败", { cause: planResult.error });
  }
  if (timeResult.error) {
    throw new Error("本周学习时长读取失败", { cause: timeResult.error });
  }
  if (activityResult.error) {
    throw new Error("本周学习完成记录读取失败", {
      cause: activityResult.error,
    });
  }

  const plan = planResult.data
    ? planDto(planResult.data as WeeklyPlanRow)
    : null;
  const timeRows = (timeResult.data ?? []) as LearningTimeRow[];
  const activityRows = (activityResult.data ?? []) as LearningActivityRow[];
  const learningSeconds = timeRows.reduce(
    (total, row) => total + Math.max(0, Number(row.seconds) || 0),
    0,
  );

  return {
    weekStartDate: week.weekStartDate,
    weekEndDate: week.weekEndDate,
    plan,
    progress: plan
      ? calculateWeeklyLearningProgress({
          targetDays: plan.targetDays,
          targetMinutes: plan.targetMinutes,
          learningSeconds,
          activityTimestamps: [
            ...timeRows.map((row) => row.recorded_at),
            ...activityRows.map((row) => row.occurred_at),
          ],
        })
      : null,
  };
}
