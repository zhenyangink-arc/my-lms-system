import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const API_ORIGIN = "https://rtc.live.cloudflare.com/v1";

export type RealtimeSessionDescription = {
  sdp: string;
  type: "offer" | "answer";
};

export type RealtimeTrackResult = {
  mid?: string;
  sessionId?: string;
  trackName?: string;
  errorCode?: string;
  errorDescription?: string;
};

export type RealtimeTracksResponse = {
  errorCode?: string;
  errorDescription?: string;
  requiresImmediateRenegotiation?: boolean;
  sessionDescription?: RealtimeSessionDescription;
  tracks?: RealtimeTrackResult[];
};

function credentials() {
  const appId = process.env.CLOUDFLARE_REALTIME_APP_ID?.trim();
  const appSecret = process.env.CLOUDFLARE_REALTIME_APP_SECRET?.trim();
  return appId && appSecret ? { appId, appSecret } : null;
}

export function isCloudflareRealtimeConfigured() {
  return Boolean(credentials());
}

export async function cloudflareRealtimeRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const config = credentials();
  if (!config) throw new Error("多人语音尚未配置 Cloudflare Realtime App。请联系管理员。");

  const response = await fetch(`${API_ORIGIN}/apps/${config.appId}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${config.appSecret}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => ({}))) as T & {
    errorCode?: string;
    errorDescription?: string;
  };
  if (!response.ok || payload.errorCode) {
    throw new Error(payload.errorDescription || `Cloudflare Realtime 请求失败（${response.status}）。`);
  }
  return payload;
}

export async function createCloudflareRealtimeSession(correlationId: string) {
  const result = await cloudflareRealtimeRequest<{ sessionId?: string }>(
    `/sessions/new?correlationId=${encodeURIComponent(correlationId)}`,
    { method: "POST" }
  );
  if (!result.sessionId) throw new Error("Cloudflare Realtime 未返回会话编号。");
  return result.sessionId;
}

export async function forceCloseCloudflareTrack(providerSessionId: string, mid: string) {
  return cloudflareRealtimeRequest<RealtimeTracksResponse>(
    `/sessions/${encodeURIComponent(providerSessionId)}/tracks/close`,
    {
      method: "PUT",
      body: JSON.stringify({ tracks: [{ mid }], force: true }),
    }
  );
}

/** Best-effort provider shutdown followed by an authoritative local close marker. */
export async function closeLiveClassVoicePublications(
  sessionId: string,
  userId?: string
) {
  const admin = createAdminClient();
  let query = admin
    .from("live_class_voice_connections")
    .select("id, provider_session_id, track_mid")
    .eq("session_id", sessionId)
    .eq("connection_kind", "publisher")
    .is("closed_at", null);
  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query;
  if (error) throw error;
  const rows = data ?? [];
  await Promise.allSettled(
    rows
      .filter((row) => row.track_mid)
      .map((row) => forceCloseCloudflareTrack(String(row.provider_session_id), String(row.track_mid)))
  );
  if (rows.length > 0) {
    await admin
      .from("live_class_voice_connections")
      .update({ closed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .in("id", rows.map((row) => row.id));
  }
}
