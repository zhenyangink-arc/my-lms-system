import { NextResponse } from "next/server";
import { z } from "zod";

import { isPlatformOwnerRole } from "@/lib/admin";
import { getAuthContext } from "@/lib/auth";
import {
  configuredText,
  headerJson,
  resolveScriptCharacter,
  resolveScriptStep,
  ScriptStepValidationError,
  scriptSegmentAutoContinues,
  studentTask,
  taskEventKey,
  upcomingScriptNodeBufferLine,
  upcomingScriptNode,
  resolveBufferLineSpeechAssetId,
  visualCue,
  type ScriptNodeRow,
} from "@/lib/learning-agent-script-runtime";
import { decodePreviewState, encodePreviewState, type PreviewState } from "@/lib/learning-agent-preview-state";
import { createAdminClient } from "@/lib/supabase/admin";
import { teachingBlackboardDisplayForSegment } from "@/lib/teaching-blackboard";

const requestSchema = z.object({
  scriptVersionId: z.uuid(),
  sessionToken: z.string().max(20000).optional(),
  restart: z.boolean().optional(),
  intent: z.enum(["start", "hint", "example", "ready", "answer"]),
  locale: z.enum(["zh-CN", "ko-KR"]),
  answer: z.string().trim().max(300).optional(),
  // Lets the teaching-script editor jump the embedded preview straight to
  // the node being edited instead of always starting from node 1. Only
  // honored on a brand-new session — once real progress exists this is
  // ignored so normal continuation still works.
  startNodeKey: z.string().trim().max(200).optional(),
});

function plainTextStream(content: string) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const character of Array.from(content)) controller.enqueue(encoder.encode(character));
      controller.close();
    },
  });
}

/**
 * Lets a course admin walk the exact scripted flow a student would see for
 * ANY script version, including unpublished drafts, before publishing.
 * Nothing here is persisted: no session, message, or attempt rows are
 * written, so this can never affect real student progress or history.
 */
export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (auth.status !== "active" || !isPlatformOwnerRole(auth.profile?.role)) {
    return NextResponse.json({ error: "只有平台负责人可以使用预览模式。" }, { status: 403 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "预览请求格式不正确。" }, { status: 400 });
  }
  const input = parsed.data;
  const admin = createAdminClient();

  const { data: version } = await admin
    .from("learning_agent_script_versions")
    .select("id")
    .eq("id", input.scriptVersionId)
    .maybeSingle();
  if (!version) {
    return NextResponse.json({ error: "没有找到要预览的教学脚本版本。" }, { status: 404 });
  }

  const { data: scriptNodeData } = await admin
    .from("learning_agent_script_nodes")
    .select("id,script_version_id,node_key,node_type,sort_order,teacher_script,configuration,reference_activity_id,action_type,next_node_key,remediation_node_key")
    .eq("script_version_id", input.scriptVersionId)
    .order("sort_order");
  const scriptNodes = (scriptNodeData ?? []) as ScriptNodeRow[];
  if (!scriptNodes.length) {
    return NextResponse.json({ error: "这个版本还没有教学小节，无法预览。" }, { status: 404 });
  }
  const nodeByKey = new Map(scriptNodes.map((node) => [node.node_key, node]));

  const state = input.restart
    ? { scriptVersionId: input.scriptVersionId, currentNodeKey: null, teachingState: {}, completedTaskEvents: [] } as PreviewState
    : decodePreviewState(input.sessionToken, input.scriptVersionId);
  const currentScriptNode = state.currentNodeKey
    ? nodeByKey.get(state.currentNodeKey) ?? null
    : input.startNodeKey
      ? nodeByKey.get(input.startNodeKey) ?? null
      : null;
  const completedTaskEvents = new Set(state.completedTaskEvents);

  let resolved: Awaited<ReturnType<typeof resolveScriptStep>>;
  try {
    resolved = await resolveScriptStep({
      admin,
      scriptNodes,
      nodeByKey,
      currentScriptNode,
      teachingState: state.teachingState,
      completedTaskEvents,
      intent: input.intent,
      locale: input.locale,
      answer: input.answer,
    });
  } catch (error) {
    if (error instanceof ScriptStepValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const nextState: PreviewState = {
    scriptVersionId: input.scriptVersionId,
    currentNodeKey: resolved.selectedScriptNode?.node_key ?? null,
    teachingState: resolved.nextTeachingState,
    completedTaskEvents: state.completedTaskEvents,
  };

  const selectedCharacter = resolved.selectedScriptNode
    ? await resolveScriptCharacter(admin, resolved.selectedScriptNode, resolved.selectedScriptSegmentIndex, resolved.scriptedContent, input.locale)
    : null;

  const headers = new Headers({
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "private, no-store, max-age=0",
    "X-Learning-Agent-Session": encodePreviewState(nextState),
    "X-Learning-Agent-Action": resolved.action,
    "X-Learning-Agent-Target-Activity": "",
    "X-Learning-Agent-Progress": "0",
    "X-Learning-Agent-Mode": "scripted",
  });
  if (resolved.selectedScriptNode) {
    const node = resolved.selectedScriptNode;
    const selectedStudentTask = studentTask(node.configuration);
    const selectedTaskCompleted = selectedStudentTask
      ? completedTaskEvents.has(taskEventKey(node.id, selectedStudentTask))
      : false;
    headers.set("X-Learning-Agent-Script-Node", node.node_key);
    headers.set("X-Learning-Agent-Script-Node-Type", node.node_type);
    headers.set("X-Learning-Agent-Display", headerJson(teachingBlackboardDisplayForSegment(
      node.configuration?.display ?? null,
      resolved.selectedScriptSegmentIndex,
    )));
    headers.set("X-Learning-Agent-Task", headerJson(selectedStudentTask));
    headers.set("X-Learning-Agent-Character", headerJson(selectedCharacter));
    headers.set("X-Learning-Agent-Interaction", headerJson(resolved.responseInteraction));
    headers.set(
      "X-Learning-Agent-Visual-Cue",
      headerJson(input.intent === "start" || input.intent === "ready" ? visualCue(node.configuration) : null),
    );
    headers.set("X-Learning-Agent-Task-Completed", selectedTaskCompleted ? "true" : "false");
    headers.set("X-Learning-Agent-Question-Options", headerJson(resolved.questionOptions));
    headers.set("X-Learning-Agent-Script-Rich", headerJson(resolved.scriptedContentRich));
    headers.set("X-Learning-Agent-Awaiting-Answer", resolved.awaitingAnswer ? "true" : "false");
    if (resolved.answerCorrect !== null) {
      headers.set("X-Learning-Agent-Answer-Correct", resolved.answerCorrect ? "true" : "false");
    }
    headers.set("X-Learning-Agent-Terminal", resolved.isFinalStep ? "true" : "false");
    const hasNextSegment = resolved.selectedScriptSegmentIndex < resolved.selectedScriptSegmentCount - 1;
    headers.set(
      "X-Learning-Agent-Continue-Label",
      encodeURIComponent(hasNextSegment
        ? (input.locale === "ko-KR" ? "다음 대사" : "继续下一句")
        : configuredText(node.configuration, "continueLabel", input.locale)),
    );
    headers.set(
      "X-Learning-Agent-Auto-Continue",
      hasNextSegment && scriptSegmentAutoContinues(node.configuration, resolved.selectedScriptSegmentIndex) ? "true" : "false",
    );
    const upcomingBufferLine = upcomingScriptNodeBufferLine({
      selectedNode: node,
      scriptNodes,
      nodeByKey,
      locale: input.locale,
      segmentIndex: resolved.selectedScriptSegmentIndex,
      segmentCount: resolved.selectedScriptSegmentCount,
    });
    if (upcomingBufferLine !== null) {
      headers.set("X-Learning-Agent-Buffer-Line", encodeURIComponent(upcomingBufferLine));
      const nextNode = upcomingScriptNode({
        selectedNode: node,
        scriptNodes,
        nodeByKey,
        segmentIndex: resolved.selectedScriptSegmentIndex,
        segmentCount: resolved.selectedScriptSegmentCount,
      });
      const bufferSpeechAssetId = await resolveBufferLineSpeechAssetId(admin, nextNode, input.locale, upcomingBufferLine);
      if (bufferSpeechAssetId) headers.set("X-Learning-Agent-Buffer-Speech-Asset", bufferSpeechAssetId);
    }
  }

  const fallback = resolved.scriptedContent
    || (input.locale === "ko-KR" ? "이 단계에는 아직 내용이 없습니다." : "这一步暂时还没有内容。");
  return new Response(plainTextStream(fallback), { headers });
}
