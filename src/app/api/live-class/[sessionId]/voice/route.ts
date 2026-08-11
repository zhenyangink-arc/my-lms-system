import { getAuthContext } from "@/lib/auth";
import {
  cloudflareRealtimeRequest,
  closeLiveClassVoicePublications,
  createCloudflareRealtimeSession,
  isCloudflareRealtimeConfigured,
  type RealtimeSessionDescription,
  type RealtimeTracksResponse,
} from "@/lib/cloudflare-realtime";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type VoiceContext = {
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
  sessionId: string;
  teacherId: string;
  isTeacher: boolean;
  canPublish: boolean;
};

function jsonError(message: string, status: number) {
  return Response.json({ ok: false, error: message }, { status });
}

function isSessionDescription(value: unknown): value is RealtimeSessionDescription {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.sdp === "string" &&
    item.sdp.length > 0 &&
    (item.type === "offer" || item.type === "answer")
  );
}

async function loadVoiceContext(sessionId: string): Promise<VoiceContext | Response> {
  const auth = await getAuthContext();
  if (auth.status !== "active" || !auth.tenant) return jsonError("请先登录。", 401);

  const { data: session, error } = await auth.supabase
    .from("live_class_sessions")
    .select("id, tenant_id, teacher_id, mode, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (error || !session || session.tenant_id !== auth.tenant.id) {
    return jsonError("你不是该课堂的在场参与者。", 403);
  }
  if (session.mode !== "group") return jsonError("该接口仅用于公共课堂多人语音。", 409);
  if (session.status !== "active") return jsonError("课堂已经结束。", 410);

  const admin = createAdminClient();
  const isTeacher = session.teacher_id === auth.user.id;
  let canPublish = isTeacher;
  if (!isTeacher) {
    const { data: member } = await admin
      .from("live_class_members")
      .select("voice_granted_at")
      .eq("session_id", sessionId)
      .eq("student_id", auth.user.id)
      .is("left_at", null)
      .maybeSingle();
    if (!member) return jsonError("你不是该课堂的在场参与者。", 403);
    canPublish = Boolean(member.voice_granted_at);
  }

  return {
    admin,
    userId: auth.user.id,
    sessionId,
    teacherId: String(session.teacher_id),
    isTeacher,
    canPublish,
  };
}

async function ownedConnection(
  context: VoiceContext,
  providerSessionId: string,
  kind: "publisher" | "subscriber"
) {
  const { data } = await context.admin
    .from("live_class_voice_connections")
    .select("id, provider_session_id, track_name, track_mid")
    .eq("session_id", context.sessionId)
    .eq("user_id", context.userId)
    .eq("connection_kind", kind)
    .eq("provider_session_id", providerSessionId)
    .is("closed_at", null)
    .maybeSingle();
  return data;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const context = await loadVoiceContext(sessionId);
  if (context instanceof Response) return context;

  const [{ data: members }, { data: connections }] = await Promise.all([
    context.admin
      .from("live_class_members")
      .select("student_id, voice_granted_at")
      .eq("session_id", sessionId)
      .is("left_at", null),
    context.admin
      .from("live_class_voice_connections")
      .select("user_id, provider_session_id, track_name, track_mid")
      .eq("session_id", sessionId)
      .eq("connection_kind", "publisher")
      .is("closed_at", null)
      .not("track_name", "is", null)
      .not("track_mid", "is", null),
  ]);

  const grantedStudentIds = (members ?? [])
    .filter((member) => member.voice_granted_at)
    .map((member) => String(member.student_id));
  const allowedPublishers = new Set([context.teacherId, ...grantedStudentIds]);
  const speakers = (connections ?? [])
    .filter((connection) => allowedPublishers.has(String(connection.user_id)))
    .map((connection) => ({
      userId: String(connection.user_id),
      providerSessionId: String(connection.provider_session_id),
      trackName: String(connection.track_name),
      mid: String(connection.track_mid),
    }));

  return Response.json({
    ok: true,
    configured: isCloudflareRealtimeConfigured(),
    isTeacher: context.isTeacher,
    canPublish: context.canPublish,
    grantedStudentIds,
    speakers,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const context = await loadVoiceContext(sessionId);
  if (context instanceof Response) return context;

  const parsedBody = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const body = parsedBody && typeof parsedBody === "object" ? parsedBody : {};
  const operation = typeof body.operation === "string" ? body.operation : "";
  if (!operation) return jsonError("缺少多人语音操作。", 400);
  if (!isCloudflareRealtimeConfigured()) {
    return jsonError("多人语音尚未配置 Cloudflare Realtime App。", 503);
  }

  try {
    if (operation === "create-session") {
      const kind = body.kind === "publisher" ? "publisher" : "subscriber";
      if (kind === "publisher" && !context.canPublish) {
        return jsonError("老师尚未授权你开麦。", 403);
      }
      const providerSessionId = await createCloudflareRealtimeSession(
        `${sessionId}:${context.userId}:${kind}`
      );
      const now = new Date().toISOString();
      const { error } = await context.admin.from("live_class_voice_connections").upsert(
        {
          session_id: sessionId,
          user_id: context.userId,
          connection_kind: kind,
          provider_session_id: providerSessionId,
          track_name: null,
          track_mid: null,
          updated_at: now,
          closed_at: null,
        },
        { onConflict: "session_id,user_id,connection_kind" }
      );
      if (error) throw error;
      return Response.json({ ok: true, providerSessionId });
    }

    const providerSessionId =
      typeof body.providerSessionId === "string" ? body.providerSessionId : "";
    if (!providerSessionId) return jsonError("缺少语音连接编号。", 400);

    if (operation === "publish") {
      if (!context.canPublish) return jsonError("老师尚未授权你开麦。", 403);
      const connection = await ownedConnection(context, providerSessionId, "publisher");
      if (!connection) return jsonError("语音发布连接无效。", 403);
      if (!isSessionDescription(body.sessionDescription)) return jsonError("语音 SDP 无效。", 400);
      const mid = typeof body.mid === "string" ? body.mid : "";
      const trackName = typeof body.trackName === "string" ? body.trackName : "";
      if (!mid || !trackName) return jsonError("语音音轨参数无效。", 400);

      const result = await cloudflareRealtimeRequest<RealtimeTracksResponse>(
        `/sessions/${encodeURIComponent(providerSessionId)}/tracks/new`,
        {
          method: "POST",
          body: JSON.stringify({
            sessionDescription: body.sessionDescription,
            tracks: [{ location: "local", mid, trackName }],
          }),
        }
      );
      const published = result.tracks?.[0];
      if (!result.sessionDescription || !published?.mid || !published.trackName) {
        throw new Error("Cloudflare Realtime 未返回发布音轨。");
      }
      await context.admin
        .from("live_class_voice_connections")
        .update({
          track_name: published.trackName,
          track_mid: published.mid,
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id);
      return Response.json({ ok: true, ...result });
    }

    if (operation === "subscribe") {
      const connection = await ownedConnection(context, providerSessionId, "subscriber");
      if (!connection) return jsonError("语音收听连接无效。", 403);
      const speakerUserId = typeof body.speakerUserId === "string" ? body.speakerUserId : "";
      const { data: speaker } = await context.admin
        .from("live_class_voice_connections")
        .select("user_id, provider_session_id, track_name")
        .eq("session_id", sessionId)
        .eq("user_id", speakerUserId)
        .eq("connection_kind", "publisher")
        .is("closed_at", null)
        .not("track_name", "is", null)
        .maybeSingle();
      if (!speaker) return jsonError("该参与者当前没有可收听的音轨。", 404);
      if (speakerUserId !== context.teacherId) {
        const { data: member } = await context.admin
          .from("live_class_members")
          .select("voice_granted_at")
          .eq("session_id", sessionId)
          .eq("student_id", speakerUserId)
          .is("left_at", null)
          .maybeSingle();
        if (!member?.voice_granted_at) return jsonError("该学生当前没有发言权。", 403);
      }

      const result = await cloudflareRealtimeRequest<RealtimeTracksResponse>(
        `/sessions/${encodeURIComponent(providerSessionId)}/tracks/new`,
        {
          method: "POST",
          body: JSON.stringify({
            tracks: [
              {
                location: "remote",
                sessionId: speaker.provider_session_id,
                trackName: speaker.track_name,
              },
            ],
          }),
        }
      );
      return Response.json({ ok: true, ...result });
    }

    if (operation === "renegotiate") {
      const connection = await ownedConnection(context, providerSessionId, "subscriber");
      if (!connection) return jsonError("语音收听连接无效。", 403);
      if (!isSessionDescription(body.sessionDescription)) return jsonError("语音 SDP 无效。", 400);
      const result = await cloudflareRealtimeRequest<Record<string, unknown>>(
        `/sessions/${encodeURIComponent(providerSessionId)}/renegotiate`,
        { method: "PUT", body: JSON.stringify({ sessionDescription: body.sessionDescription }) }
      );
      return Response.json({ ok: true, ...result });
    }

    if (operation === "close-publisher") {
      const connection = await ownedConnection(context, providerSessionId, "publisher");
      if (!connection) return Response.json({ ok: true });
      await closeLiveClassVoicePublications(sessionId, context.userId);
      return Response.json({ ok: true });
    }

    return jsonError("不支持的多人语音操作。", 400);
  } catch (error) {
    console.error("公共课堂多人语音请求失败：", error);
    return jsonError(error instanceof Error ? error.message : "多人语音服务暂时不可用。", 502);
  }
}
