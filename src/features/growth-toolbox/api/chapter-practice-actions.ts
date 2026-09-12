"use server";

import { requireActiveUser } from "@/lib/auth";
import { revalidateDashboard } from "@/lib/revalidate-dashboard";
import { STUDENT_APP_IDS } from "@/lib/student-apps";
import type { PracticeSnapshotItem } from "@/lib/chapter-practice-binding";

export async function reviewChapterPracticeAction(input: {
  appId: string; chapterId: string; revision: number; snapshot: PracticeSnapshotItem[]; enabled: boolean;
}): Promise<{ ok: boolean; message: string }> {
  const { supabase } = await requireActiveUser();
  if (!Object.values(STUDENT_APP_IDS).includes(input.appId) || !/^[0-9a-f-]{36}$/i.test(input.chapterId)
    || !Number.isInteger(input.revision) || input.revision < 0 || typeof input.enabled !== "boolean"
    || !Array.isArray(input.snapshot) || JSON.stringify(input.snapshot).length > 500_000) {
    return { ok: false, message: "关联参数无效，请刷新后重试。" };
  }
  // Use the caller's authenticated session. The RPC repeats authorization and source validation.
  const { error } = await supabase.rpc("review_chapter_practice_binding", {
    p_app_id: input.appId, p_chapter_id: input.chapterId, p_expected_revision: input.revision,
    p_expected_snapshot: input.snapshot, p_enabled: input.enabled,
  });
  if (error) return { ok: false, message: error.code === "P0001" ? error.message : "暂时无法保存章节练习关联，请稍后重试。" };
  revalidateDashboard("/dashboard/admin/apps/[appSlug]/toolbox", "page");
  revalidateDashboard("/dashboard/admin/apps/[appSlug]/teaching-scripts", "page");
  revalidateDashboard("/dashboard/toolbox/vocabulary");
  revalidateDashboard("/[space]/apps/korean/toolbox/vocabulary", "page");
  revalidateDashboard("/[space]/apps/korean/practice/skills/vocabulary", "page");
  revalidateDashboard("/[space]/apps/korean/practice/skills/grammar", "page");
  revalidateDashboard("/[space]/apps/korean/training/[skill]/[courseSlug]/[lessonSlug]/[chapterSlug]", "page");
  return { ok: true, message: input.enabled ? "已确认教材版本与内容，引用已启用。" : "已停用本章教材练习引用。" };
}
