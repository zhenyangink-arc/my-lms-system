import { NextResponse } from "next/server";
import { z } from "zod";

import { isPlatformOwnerRole } from "@/lib/admin";
import { getAuthContext } from "@/lib/auth";
import { studentTask, taskEventKey } from "@/lib/learning-agent-script-runtime";
import { decodePreviewState, encodePreviewState } from "@/lib/learning-agent-preview-state";
import { createAdminClient } from "@/lib/supabase/admin";

const requestSchema = z.object({
  scriptVersionId: z.uuid(),
  sessionToken: z.string().max(20000).optional(),
  eventType: z.enum(["audio_completed", "activity_opened", "activity_completed"]),
  targetKey: z.string().trim().min(1).max(200),
});

/**
 * Preview counterpart of /api/learning-agent/events. Marks a student task
 * (e.g. "listen to this line") as done inside the opaque preview state
 * instead of the real learning_agent_task_events table.
 */
export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (auth.status !== "active" || !isPlatformOwnerRole(auth.profile?.role)) {
    return NextResponse.json({ error: "只有平台负责人可以使用预览模式。" }, { status: 403 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "预览任务事件不完整。" }, { status: 400 });
  }
  const input = parsed.data;
  const state = decodePreviewState(input.sessionToken, input.scriptVersionId);
  if (!state.currentNodeKey) {
    return NextResponse.json({ error: "当前没有正在进行的预览小节。" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: node } = await admin
    .from("learning_agent_script_nodes")
    .select("id,configuration")
    .eq("script_version_id", input.scriptVersionId)
    .eq("node_key", state.currentNodeKey)
    .maybeSingle();
  const task = node ? studentTask(node.configuration as Record<string, unknown> | null) : null;
  if (!node || !task || task.eventType !== input.eventType || task.targetKey !== input.targetKey) {
    return NextResponse.json({ error: "该操作不是当前老师布置的学习任务。" }, { status: 409 });
  }

  const key = taskEventKey(String(node.id), task);
  const completedTaskEvents = state.completedTaskEvents.includes(key)
    ? state.completedTaskEvents
    : [...state.completedTaskEvents, key];

  return NextResponse.json({
    ok: true,
    completed: true,
    sessionToken: encodePreviewState({ ...state, completedTaskEvents }),
  });
}
