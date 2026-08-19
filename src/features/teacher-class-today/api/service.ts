import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { parseTeacherClassTodaySnapshot } from "../model.ts";
import type { TeacherClassTodaySnapshot } from "../types.ts";

export class TeacherClassTodayAccessError extends Error {
  constructor(message = "无权查看该学生的班级今日数据") {
    super(message);
    this.name = "TeacherClassTodayAccessError";
  }
}

/** One RPC call; the database performs authorization, joins, and aggregation. */
export async function loadTeacherClassTodaySnapshot({
  supabase,
  tenantId,
  studentAppId,
  studentId = null,
  now = new Date(),
}: {
  supabase: SupabaseClient;
  tenantId: string;
  studentAppId: string;
  studentId?: string | null;
  now?: Date;
}): Promise<TeacherClassTodaySnapshot> {
  const { data, error } = await supabase.rpc(
    "get_teacher_class_today_snapshot",
    {
      p_tenant_id: tenantId,
      p_student_app_id: studentAppId,
      p_student_id: studentId,
      p_now: now.toISOString(),
    },
  );

  if (error) {
    if (error.code === "42501") {
      throw new TeacherClassTodayAccessError();
    }
    throw new Error("班级今日情况读取失败，请稍后重试。", { cause: error });
  }
  return parseTeacherClassTodaySnapshot(data);
}
