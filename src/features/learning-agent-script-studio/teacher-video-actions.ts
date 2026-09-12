"use server";

import { requirePlatformOwner } from "@/lib/admin";
import { checkR2ObjectExists, listR2Objects } from "@/lib/r2";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTeacherVideoKey, teacherVideoBindings, TEACHER_VIDEO_PREFIX } from "@/lib/teaching-video";

export async function listTeacherVideosAction() {
  await requirePlatformOwner();
  try {
    const [{ objects, isTruncated }, { data, error }] = await Promise.all([
      listR2Objects(TEACHER_VIDEO_PREFIX),
      createAdminClient().from("learning_agent_script_nodes").select("node_key,configuration").not("configuration->teacherVideo", "is", null).limit(2000),
    ]);
    if (error) throw error;
    const uses = new Map<string, Set<string>>();
    for (const node of data ?? []) {
      for (const binding of teacherVideoBindings(node.configuration?.teacherVideo)) {
        const keys = uses.get(binding.objectKey) ?? new Set<string>();
        keys.add(node.node_key);
        uses.set(binding.objectKey, keys);
      }
    }
    return { ok: true as const, isTruncated, objects: objects.filter((item) => isTeacherVideoKey(item.key)).sort((a, b) => b.lastModified.localeCompare(a.lastModified)).map((item) => ({ ...item, uses: [...(uses.get(item.key) ?? [])] })) };
  } catch {
    return { ok: false as const, message: "暂时无法读取教师视频库，请检查 R2 连接后重试。" };
  }
}

export async function verifyTeacherVideoAction(key: string) {
  await requirePlatformOwner();
  if (!isTeacherVideoKey(key)) return { ok: false as const, message: "请填写 teacher-video/ 下的 MP4 文件路径。" };
  try {
    const result = await checkR2ObjectExists(key);
    if (!result.exists || !result.size) return { ok: false as const, message: "未找到视频，或文件为空，请确认已上传到 R2。" };
    if (result.contentType && !["video/mp4", "application/octet-stream"].includes(result.contentType.split(";")[0])) {
      return { ok: false as const, message: "文件类型不是 MP4，请重新导出后上传。" };
    }
    return { ok: true as const, size: result.size };
  } catch {
    return { ok: false as const, message: "视频检查失败，请稍后重试。" };
  }
}
