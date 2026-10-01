import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { STUDENT_APP_IDS, type StudentAppSlug } from "@/lib/student-apps";

const STUDENT_APP_SLUG_BY_ID = new Map<string, StudentAppSlug>(
  (Object.entries(STUDENT_APP_IDS) as [StudentAppSlug, string][]).map(
    ([slug, id]) => [id, slug],
  ),
);

/** 根据数据库中的 student_app_id 找到应用 slug；未知 ID 返回 null。 */
export function getStudentAppSlugById(
  appId: string | null | undefined,
): StudentAppSlug | null {
  return appId ? (STUDENT_APP_SLUG_BY_ID.get(appId) ?? null) : null;
}

/**
 * 学生当前是否能使用某个应用：机构已开放且为 active，学生报名有效且在有效期内。
 * 学生应用入口布局与服务端写入操作共用这一判断；数据库 RLS 仍是最终边界。
 */
export async function hasActiveStudentAppAccess({
  supabase,
  tenantId,
  studentId,
  appId,
  now = Date.now(),
}: {
  supabase: SupabaseClient;
  tenantId: string;
  studentId: string;
  appId: string;
  now?: number;
}) {
  const [tenantAppResult, enrollmentResult] = await Promise.all([
    supabase
      .from("tenant_student_apps")
      .select("is_enabled,status")
      .eq("tenant_id", tenantId)
      .eq("app_id", appId)
      .maybeSingle(),
    supabase
      .from("student_app_enrollments")
      .select("status,starts_at,ends_at")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .eq("app_id", appId)
      .maybeSingle(),
  ]);
  const tenantApp = tenantAppResult.data;
  const enrollment = enrollmentResult.data;
  const startsAt = enrollment?.starts_at ? Date.parse(enrollment.starts_at) : null;
  const endsAt = enrollment?.ends_at ? Date.parse(enrollment.ends_at) : null;

  return !(
    tenantAppResult.error ||
    !tenantApp?.is_enabled ||
    tenantApp.status !== "active" ||
    enrollmentResult.error ||
    !enrollment ||
    enrollment.status !== "active" ||
    (startsAt !== null && Number.isFinite(startsAt) && startsAt > now) ||
    (endsAt !== null && Number.isFinite(endsAt) && endsAt <= now)
  );
}
