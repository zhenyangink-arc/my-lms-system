"use server";

import { requireActiveUser } from "@/lib/auth";

const TOOLBOX_SKILLS = ["vocabulary", "speaking", "grammar", "listening"];

/**
 * 记录成长工具箱练习时长（增量秒数）到 learning_time_log（source='toolbox'）。
 * 由练习页的计时组件周期上报；单次上限 1 小时，防异常数据。
 */
export async function recordToolboxStudyTime(
  skill: string,
  seconds: number
): Promise<void> {
  const s = Math.floor(Number(seconds) || 0);
  if (!TOOLBOX_SKILLS.includes(skill)) return;
  if (s < 1 || s > 3600) return;

  const { supabase, user, tenant } = await requireActiveUser();
  if (!tenant?.id) return;

  await supabase.from("learning_time_log").insert({
    tenant_id: tenant.id,
    student_id: user.id,
    test_slug: `toolbox-${skill}`,
    source: "toolbox",
    seconds: s,
  });
}
