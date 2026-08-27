import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const eventSchema = z.object({
  sessionId: z.uuid(),
  eventType: z.enum(["audio_completed", "activity_opened", "activity_completed"]),
  targetKey: z.string().trim().min(1).max(200),
});

function taskConfiguration(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const task = (value as Record<string, unknown>).studentTask;
  return task && typeof task === "object" && !Array.isArray(task)
    ? task as Record<string, unknown>
    : null;
}

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (auth.status !== "active" || !auth.tenant) {
    return NextResponse.json({ error: "当前账号不能记录教学任务。" }, { status: 403 });
  }
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "教学任务事件不完整。" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("learning_agent_sessions")
    .select("id,script_version_id,current_node_id")
    .eq("id", parsed.data.sessionId)
    .eq("tenant_id", auth.tenant.id)
    .eq("student_id", auth.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!session?.script_version_id || !session.current_node_id) {
    return NextResponse.json({ error: "当前教学会话不存在。" }, { status: 404 });
  }

  const { data: node } = await admin
    .from("learning_agent_script_nodes")
    .select("id,configuration")
    .eq("id", session.current_node_id)
    .eq("script_version_id", session.script_version_id)
    .maybeSingle();
  const task = taskConfiguration(node?.configuration);
  if (!node || !task
    || task.eventType !== parsed.data.eventType
    || task.targetKey !== parsed.data.targetKey) {
    return NextResponse.json({ error: "该操作不是当前老师布置的学习任务。" }, { status: 409 });
  }

  const { error } = await admin.from("learning_agent_task_events").upsert({
    tenant_id: auth.tenant.id,
    student_id: auth.user.id,
    session_id: session.id,
    script_version_id: session.script_version_id,
    node_id: node.id,
    event_type: parsed.data.eventType,
    target_key: parsed.data.targetKey,
    metadata: { source: "smart_textbook_learning_area" },
  }, { onConflict: "session_id,node_id,event_type,target_key", ignoreDuplicates: true });
  if (error) {
    return NextResponse.json({ error: "学习任务完成记录保存失败。" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, completed: true });
}
