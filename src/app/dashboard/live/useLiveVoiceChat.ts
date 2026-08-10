"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { LiveEvent, LiveEventInput } from "./live-realtime";

export type VoiceState = "idle" | "starting" | "connected";

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    {
      urls: [
        "stun:stun.cloudflare.com:3478",
        "stun:stun.l.google.com:19302",
      ],
    },
  ],
};

type UseLiveVoiceChatOptions = {
  sendEvent: (event: LiveEventInput) => void;
};

/**
 * 课堂内双人实时语音：WebRTC P2P 音频，SDP/ICE 信令走课堂 Realtime 频道。
 * 老师点击"开始语音讲解"发起 offer；对方（学生）收到后自动接听（需授权麦克风）。
 * 任一方可挂断。无 TURN 服务器：复杂 NAT 环境可能无法直连（多数网络可直连）。
 */
export function useLiveVoiceChat({ sendEvent }: UseLiveVoiceChatOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const closePeer = useCallback(() => {
    peerRef.current?.getSenders().forEach((sender) => sender.track?.stop());
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current = null;
    audioRef.current?.remove();
    audioRef.current = null;
  }, []);

  const setupPeer = useCallback(
    (stream: MediaStream, onSignal: (event: LiveEventInput) => void) => {
      const peer = new RTCPeerConnection(RTC_CONFIG);
      peerRef.current = peer;
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      // 远端音频自动播放
      peer.ontrack = (event) => {
        audioRef.current?.remove();
        const audio = new Audio();
        audio.srcObject = event.streams[0];
        audio.autoplay = true;
        audioRef.current = audio;
      };

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          onSignal({ kind: "rtc-ice", candidate: JSON.stringify(event.candidate) });
        }
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "connected") {
          setVoiceState("connected");
          setVoiceError(null);
        } else if (
          peer.connectionState === "failed" ||
          peer.connectionState === "closed" ||
          peer.connectionState === "disconnected"
        ) {
          if (peer.connectionState !== "closed") {
            setVoiceError("语音连接中断，请重试。");
          }
          setVoiceState("idle");
        }
      };

      return peer;
    },
    []
  );

  const startVoice = useCallback(async () => {
    if (voiceState !== "idle") return;
    setVoiceError(null);
    setVoiceState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      const peer = setupPeer(stream, sendEvent);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      sendEvent({
        kind: "rtc-offer",
        sdp: JSON.stringify(peer.localDescription),
      });
      // 等待对方 answer 后由 handleSignal 设置远端描述。
    } catch {
      closePeer();
      setVoiceState("idle");
      setVoiceError("无法打开麦克风，请检查浏览器权限。");
    }
  }, [voiceState, closePeer, setupPeer, sendEvent]);

  const handleSignal = useCallback(
    (event: LiveEvent) => {
      if (event.kind === "rtc-offer") {
        // 非发起方自动接听：同样需要麦克风（双方对话）。
        void (async () => {
          setVoiceError(null);
          setVoiceState("starting");
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStreamRef.current = stream;
            const peer = setupPeer(stream, sendEvent);
            await peer.setRemoteDescription(JSON.parse(event.sdp) as RTCSessionDescriptionInit);
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            sendEvent({
              kind: "rtc-answer",
              sdp: JSON.stringify(peer.localDescription),
            });
          } catch {
            closePeer();
            setVoiceState("idle");
            setVoiceError("语音接听失败，请检查麦克风权限后让老师重新发起。");
          }
        })();
      } else if (event.kind === "rtc-answer") {
        const peer = peerRef.current;
        if (peer && peer.localDescription?.type === "offer") {
          void peer
            .setRemoteDescription(JSON.parse(event.sdp) as RTCSessionDescriptionInit)
            .catch(() => setVoiceError("语音连接建立失败，请重试。"));
        }
      } else if (event.kind === "rtc-ice") {
        const peer = peerRef.current;
        if (peer) {
          void peer
            .addIceCandidate(JSON.parse(event.candidate) as RTCIceCandidateInit)
            .catch(() => {
              // trickle ICE 先于远端描述到达时忽略，连接建立后浏览器会重排。
            });
        }
      } else if (event.kind === "rtc-hangup") {
        closePeer();
        setVoiceState("idle");
        setVoiceError(null);
      }
    },
    [closePeer, setupPeer, sendEvent]
  );

  const stopVoice = useCallback(() => {
    sendEvent({ kind: "rtc-hangup" });
    closePeer();
    setVoiceState("idle");
    setVoiceError(null);
  }, [sendEvent, closePeer]);

  // 组件卸载时释放音频资源。
  useEffect(() => () => closePeer(), [closePeer]);

  return { voiceState, voiceError, startVoice, stopVoice, handleSignal };
}
