"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type VoiceState = "idle" | "connecting" | "listening" | "publishing";

type Speaker = {
  userId: string;
  providerSessionId: string;
  trackName: string;
  mid: string;
};

type RoomState = {
  ok: true;
  configured: boolean;
  isTeacher: boolean;
  canPublish: boolean;
  grantedStudentIds: string[];
  speakers: Speaker[];
};

type ApiResult = {
  ok?: boolean;
  error?: string;
  providerSessionId?: string;
  requiresImmediateRenegotiation?: boolean;
  sessionDescription?: RTCSessionDescriptionInit;
  tracks?: { mid?: string; trackName?: string; sessionId?: string }[];
};

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
  bundlePolicy: "max-bundle",
};

async function readJson(response: Response): Promise<ApiResult> {
  const payload = (await response.json().catch(() => ({}))) as ApiResult;
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || "多人语音服务暂时不可用。");
  }
  return payload;
}

export function useGroupVoiceChat({
  sessionId,
  currentUserId,
  enabled,
}: {
  sessionId: string;
  currentUserId: string;
  enabled: boolean;
}) {
  const endpoint = `/api/live-class/${encodeURIComponent(sessionId)}/voice`;
  const [voiceState, setVoiceState] = useState<VoiceState>(enabled ? "connecting" : "idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [canPublish, setCanPublish] = useState(false);
  const [grantedStudentIds, setGrantedStudentIds] = useState<Set<string>>(new Set());
  const [speakerIds, setSpeakerIds] = useState<Set<string>>(new Set());
  const [audioBlocked, setAudioBlocked] = useState(false);

  const subscriberPeerRef = useRef<RTCPeerConnection | null>(null);
  const subscriberSessionRef = useRef<string | null>(null);
  const publisherPeerRef = useRef<RTCPeerConnection | null>(null);
  const publisherSessionRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const subscribedTracksRef = useRef<Set<string>>(new Set());
  const pendingTracksRef = useRef<Map<string, string>>(new Map());
  const pendingTrackKeysRef = useRef<Map<string, string>>(new Map());
  const remoteAudioRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const negotiationRef = useRef<Promise<void>>(Promise.resolve());
  const publishingRef = useRef(false);
  const canPublishRef = useRef(false);
  const disposedRef = useRef(false);

  const post = useCallback(
    async (body: Record<string, unknown>) =>
      readJson(
        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      ),
    [endpoint]
  );

  const releasePublisher = useCallback(() => {
    publisherPeerRef.current?.close();
    publisherPeerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    publisherSessionRef.current = null;
    publishingRef.current = false;
    setVoiceState(subscriberSessionRef.current ? "listening" : enabled ? "connecting" : "idle");
  }, [enabled]);

  const stopPublishing = useCallback(async () => {
    const providerSessionId = publisherSessionRef.current;
    if (providerSessionId) {
      await post({ operation: "close-publisher", providerSessionId }).catch(() => undefined);
    }
    releasePublisher();
  }, [post, releasePublisher]);

  const subscribeSpeaker = useCallback(
    (speaker: Speaker) => {
      const trackKey = `${speaker.providerSessionId}:${speaker.trackName}`;
      if (
        speaker.userId === currentUserId ||
        subscribedTracksRef.current.has(trackKey) ||
        !subscriberSessionRef.current ||
        !subscriberPeerRef.current
      ) {
        return;
      }
      subscribedTracksRef.current.add(trackKey);
      negotiationRef.current = negotiationRef.current
        .then(async () => {
          const peer = subscriberPeerRef.current;
          const providerSessionId = subscriberSessionRef.current;
          if (!peer || !providerSessionId || disposedRef.current) return;
          const result = await post({
            operation: "subscribe",
            providerSessionId,
            speakerUserId: speaker.userId,
          });
          const remoteMid = result.tracks?.[0]?.mid;
          if (remoteMid) {
            pendingTracksRef.current.set(remoteMid, speaker.userId);
            pendingTrackKeysRef.current.set(remoteMid, trackKey);
          }
          if (result.requiresImmediateRenegotiation && result.sessionDescription) {
            await peer.setRemoteDescription(result.sessionDescription);
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            if (!peer.localDescription) throw new Error("浏览器未生成语音应答。");
            await post({
              operation: "renegotiate",
              providerSessionId,
              sessionDescription: {
                type: peer.localDescription.type,
                sdp: peer.localDescription.sdp,
              },
            });
          }
        })
        .catch((error) => {
          subscribedTracksRef.current.delete(trackKey);
          setVoiceError(error instanceof Error ? error.message : "接入课堂音频失败。");
        });
    },
    [currentUserId, post]
  );

  const refreshRoom = useCallback(async () => {
    if (!enabled || disposedRef.current) return;
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const room = (await response.json().catch(() => ({}))) as RoomState & { error?: string };
      if (!response.ok || room.ok !== true) throw new Error(room.error || "无法读取多人语音状态。");
      setConfigured(room.configured);
      canPublishRef.current = room.canPublish;
      setCanPublish(room.canPublish);
      setGrantedStudentIds(new Set(room.grantedStudentIds));
      setSpeakerIds(new Set(room.speakers.map((speaker) => speaker.userId)));

      const activeTrackKeys = new Set(
        room.speakers.map((speaker) => `${speaker.providerSessionId}:${speaker.trackName}`)
      );
      for (const [trackKey, audio] of remoteAudioRef.current) {
        if (!activeTrackKeys.has(trackKey)) {
          audio.pause();
          audio.srcObject = null;
          audio.remove();
          remoteAudioRef.current.delete(trackKey);
        }
      }
      room.speakers.forEach(subscribeSpeaker);
      if (!room.canPublish && publishingRef.current) await stopPublishing();
      setVoiceError((current) =>
        current === "多人语音尚未配置 Cloudflare Realtime App。" && room.configured ? null : current
      );
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : "无法读取多人语音状态。");
    }
  }, [enabled, endpoint, stopPublishing, subscribeSpeaker]);

  const startPublishing = useCallback(async () => {
    if (!enabled || publishingRef.current || !canPublishRef.current) return;
    setVoiceError(null);
    setVoiceState("connecting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const peer = new RTCPeerConnection(RTC_CONFIG);
      localStreamRef.current = stream;
      publisherPeerRef.current = peer;
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) throw new Error("没有检测到可用麦克风。");
      const transceiver = peer.addTransceiver(audioTrack, { direction: "sendonly" });
      const sessionResult = await post({ operation: "create-session", kind: "publisher" });
      if (!sessionResult.providerSessionId) throw new Error("多人语音发布连接创建失败。");
      publisherSessionRef.current = sessionResult.providerSessionId;
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      if (!peer.localDescription || !transceiver.mid) throw new Error("浏览器未生成麦克风音轨。");
      const publishResult = await post({
        operation: "publish",
        providerSessionId: sessionResult.providerSessionId,
        sessionDescription: {
          type: peer.localDescription.type,
          sdp: peer.localDescription.sdp,
        },
        mid: transceiver.mid,
        trackName: audioTrack.id,
      });
      if (!publishResult.sessionDescription) throw new Error("多人语音服务未返回连接应答。");
      await peer.setRemoteDescription(publishResult.sessionDescription);
      publishingRef.current = true;
      setVoiceState("publishing");
      await refreshRoom();
    } catch (error) {
      releasePublisher();
      setVoiceError(
        error instanceof Error ? error.message : "无法打开麦克风，请检查浏览器权限。"
      );
    }
  }, [enabled, post, refreshRoom, releasePublisher]);

  const enablePlayback = useCallback(async () => {
    const results = await Promise.allSettled(
      [...remoteAudioRef.current.values()].map((audio) => audio.play())
    );
    setAudioBlocked(results.some((result) => result.status === "rejected"));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    disposedRef.current = false;
    const peer = new RTCPeerConnection(RTC_CONFIG);
    subscriberPeerRef.current = peer;
    peer.ontrack = (event) => {
      const mid = event.transceiver.mid ?? "";
      const speakerUserId = pendingTracksRef.current.get(mid) ?? "unknown";
      const trackKey = pendingTrackKeysRef.current.get(mid) ?? `${speakerUserId}:${mid}`;
      const audio = new Audio();
      audio.autoplay = true;
      audio.srcObject = new MediaStream([event.track]);
      remoteAudioRef.current.set(trackKey, audio);
      void audio.play().catch(() => setAudioBlocked(true));
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "failed") setVoiceError("多人语音连接中断，正在等待重连。");
    };

    void (async () => {
      try {
        const roomResponse = await fetch(endpoint, { cache: "no-store" });
        const room = (await roomResponse.json().catch(() => ({}))) as RoomState & { error?: string };
        if (!roomResponse.ok || room.ok !== true) throw new Error(room.error || "无法进入多人语音。");
        setConfigured(room.configured);
        canPublishRef.current = room.canPublish;
        setCanPublish(room.canPublish);
        setGrantedStudentIds(new Set(room.grantedStudentIds));
        if (!room.configured) throw new Error("多人语音尚未配置 Cloudflare Realtime App。");
        const result = await post({ operation: "create-session", kind: "subscriber" });
        if (!result.providerSessionId) throw new Error("多人语音收听连接创建失败。");
        subscriberSessionRef.current = result.providerSessionId;
        setVoiceState("listening");
        room.speakers.forEach(subscribeSpeaker);
      } catch (error) {
        setVoiceState("idle");
        setVoiceError(error instanceof Error ? error.message : "无法进入多人语音。");
      }
    })();
    const timer = window.setInterval(() => void refreshRoom(), 2500);
    const remoteAudioElements = remoteAudioRef.current;

    return () => {
      disposedRef.current = true;
      window.clearInterval(timer);
      const activePublisherSessionId = publisherSessionRef.current;
      if (activePublisherSessionId) {
        void fetch(endpoint, {
          method: "POST",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operation: "close-publisher",
            providerSessionId: activePublisherSessionId,
          }),
        }).catch(() => undefined);
      }
      peer.close();
      subscriberPeerRef.current = null;
      subscriberSessionRef.current = null;
      publisherPeerRef.current?.close();
      publisherPeerRef.current = null;
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      for (const audio of remoteAudioElements.values()) {
        audio.pause();
        audio.srcObject = null;
        audio.remove();
      }
      remoteAudioElements.clear();
    };
  }, [enabled, endpoint, post, refreshRoom, subscribeSpeaker]);

  return {
    voiceState,
    voiceError,
    configured,
    canPublish,
    grantedStudentIds,
    speakerIds,
    audioBlocked,
    startPublishing,
    stopPublishing,
    enablePlayback,
    refreshRoom,
  };
}
