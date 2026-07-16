"use client";

import {
  Bot,
  Check,
  Headphones,
  Languages,
  Mic,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Volume2,
  Waves,
} from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import styles from "./ai-chat.module.css";

type ChatRole = "user" | "assistant";
type ChatStatus = "ready" | "recognizing" | "thinking" | "synthesizing" | "playing";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: Date;
};

const WEBSOCKET_URL =
  process.env.NEXT_PUBLIC_YUANZHI_AI_WS_URL ??
  "ws://100.125.173.55:8000/ws";

type SocketPayload = {
  type?: unknown;
  text?: unknown;
  data?: unknown;
  message?: unknown;
  sample_rate?: unknown;
  sampleRate?: unknown;
};

const INITIAL_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "안녕하세요! 저는 원지 AI 한국어 선생님이에요. 만나서 반가워요!\n你好，我是元智 AI 韩语老师。你可以直接输入韩语，或按住麦克风和我练习。",
  createdAt: new Date(0),
};

const PRACTICE_PROMPTS = [
  { label: "自我介绍", text: "한국어로 자기소개를 연습하고 싶어요." },
  { label: "咖啡店点单", text: "카페에서 주문하는 대화를 연습해 주세요." },
  { label: "大学面试", text: "대학교 면접 질문을 해 주세요." },
];

const STATUS_CONFIG: Record<ChatStatus, { label: string; detail: string; color: string; soft: string }> = {
  ready: {
    label: "准备就绪",
    detail: "输入文字，或按住麦克风开始说韩语",
    color: "#3f9b6b",
    soft: "#e9f7ef",
  },
  recognizing: {
    label: "识别中",
    detail: "正在听你说话，松开后自动发送",
    color: "#e76f54",
    soft: "#fff0eb",
  },
  thinking: {
    label: "思考中",
    detail: "元智 AI 老师正在组织韩语回复",
    color: "#3888b5",
    soft: "#eaf7ff",
  },
  synthesizing: {
    label: "语音合成中",
    detail: "CosyVoice 正在生成中韩双语语音",
    color: "#7a69b3",
    soft: "#f2edfb",
  },
  playing: {
    label: "播放中",
    detail: "正在朗读 AI 老师的韩语回复",
    color: "#8c6bc0",
    soft: "#f2edfb",
  },
};

function createMessage(role: ChatRole, content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date(),
  };
}

function formatTime(date: Date) {
  if (date.getTime() === 0) return "现在";
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function parseSocketPayload(value: unknown): SocketPayload | null {
  if (typeof value !== "string") return null;

  try {
    const payload = JSON.parse(value) as unknown;
    return payload && typeof payload === "object" ? (payload as SocketPayload) : null;
  } catch {
    return null;
  }
}

function decodeBase64(value: string) {
  const normalized = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function mergeAudioChunks(chunks: string[]) {
  const decodeSeparately = chunks
    .slice(0, -1)
    .some((chunk) => (chunk.includes(",") ? chunk.slice(chunk.indexOf(",") + 1) : chunk).includes("="));
  const payloads = decodeSeparately ? chunks : [chunks.join("")];
  const decoded = payloads.map(decodeBase64);
  const totalLength = decoded.reduce((sum, bytes) => sum + bytes.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const bytes of decoded) {
    result.set(bytes, offset);
    offset += bytes.length;
  }

  return result;
}

function readBlobAsBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const separatorIndex = result.indexOf(",");
      if (separatorIndex < 0) reject(new Error("录音数据格式不正确。"));
      else resolve(result.slice(separatorIndex + 1));
    };
    reader.onerror = () => reject(new Error("无法读取录音数据。"));
    reader.readAsDataURL(blob);
  });
}

export function YuanzhiAiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [requestPending, setRequestPending] = useState(false);
  const [speechPending, setSpeechPending] = useState(false);
  const [socketReady, setSocketReady] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioChunksRef = useRef<string[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioSampleRateRef = useRef(24_000);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRequestedRef = useRef(false);
  const shouldSendRecordingRef = useRef(false);
  const requestPendingRef = useRef(false);
  const speechPendingRef = useRef(false);
  const pendingSpeechTextRef = useRef<string | null>(null);

  const statusInfo = STATUS_CONFIG[status];
  const isBusy = requestPending || speechPending || isRecording;

  const setRequestState = useCallback((pending: boolean) => {
    requestPendingRef.current = pending;
    setRequestPending(pending);
  }, []);

  const setSpeechState = useCallback((pending: boolean) => {
    speechPendingRef.current = pending;
    setSpeechPending(pending);
  }, []);

  const clearRecordingTimer = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const stopPlayback = useCallback((resetStatus = true) => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch {
        // The source may already have completed naturally.
      }
      audioSourceRef.current.disconnect();
      audioSourceRef.current = null;
    }

    if (resetStatus) setStatus("ready");
  }, []);

  const initAudio = useCallback(async () => {
    const AudioContextClass =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) throw new Error("当前浏览器不支持音频播放。");
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new AudioContextClass();
    }
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }

    return audioContextRef.current;
  }, []);

  const playFullAudio = useCallback(async () => {
    const chunks = audioChunksRef.current.splice(0);
    if (chunks.length === 0) {
      if (!requestPendingRef.current && !speechPendingRef.current) setStatus("ready");
      return;
    }

    try {
      const context = await initAudio();
      const bytes = mergeAudioChunks(chunks);
      const sampleCount = Math.floor(bytes.byteLength / 2);
      if (sampleCount === 0) throw new Error("AI 返回的音频为空。");

      const buffer = context.createBuffer(1, sampleCount, audioSampleRateRef.current);
      const channel = buffer.getChannelData(0);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      for (let index = 0; index < sampleCount; index += 1) {
        channel[index] = view.getInt16(index * 2, true) / 32_768;
      }

      stopPlayback(false);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.onended = () => {
        if (audioSourceRef.current === source) audioSourceRef.current = null;
        source.disconnect();
        if (!requestPendingRef.current && !speechPendingRef.current) setStatus("ready");
      };
      audioSourceRef.current = source;
      setStatus("playing");
      source.start();
    } catch (error) {
      setStatus("ready");
      setErrorMessage(error instanceof Error ? error.message : "AI 语音播放失败，请重新尝试。");
    }
  }, [initAudio, stopPlayback]);

  const sendPendingSpeech = useCallback((ws: WebSocket) => {
    const text = pendingSpeechTextRef.current;
    if (!text || !speechPendingRef.current || ws.readyState !== WebSocket.OPEN) return;

    audioChunksRef.current = [];
    ws.send(JSON.stringify({ type: "tts", text }));
  }, []);

  const requestCosyVoiceSpeech = useCallback(
    (rawText: string) => {
      const text = rawText.trim();
      if (!text || speechPendingRef.current) return;

      void initAudio().catch(() => undefined);
      pendingSpeechTextRef.current = text;
      setSpeechState(true);
      stopPlayback(false);
      setErrorMessage(null);
      setStatus("synthesizing");

      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        sendPendingSpeech(ws);
      } else {
        setErrorMessage("CosyVoice 正在重新连接，语音会在连接恢复后自动生成。");
      }
    },
    [initAudio, sendPendingSpeech, setSpeechState, stopPlayback]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  useEffect(() => {
    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (disposed) return;
      const ws = new WebSocket(WEBSOCKET_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed) ws.close();
        else {
          setSocketReady(true);
          sendPendingSpeech(ws);
        }
      };
      ws.onerror = () => {
        if (!disposed) setSocketReady(false);
      };
      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        if (disposed) return;
        setSocketReady(false);
        audioChunksRef.current = [];
        if (speechPendingRef.current) {
          setStatus("synthesizing");
          setErrorMessage("CosyVoice 连接中断，正在自动重连并重新生成语音。");
        }
        reconnectTimer = setTimeout(connect, 2_000);
      };
      ws.onmessage = (event) => {
        if (disposed) return;
        const data = parseSocketPayload(event.data);
        if (!data || typeof data.type !== "string") return;

        if (data.type === "audio_start") {
          audioChunksRef.current = [];
          setErrorMessage(null);
          setStatus("synthesizing");
          const sampleRate =
            typeof data.sample_rate === "number"
              ? data.sample_rate
              : typeof data.sampleRate === "number"
                ? data.sampleRate
                : 24_000;
          if (sampleRate >= 8_000 && sampleRate <= 96_000) audioSampleRateRef.current = sampleRate;
        } else if (data.type === "audio_chunk" && typeof data.data === "string") {
          audioChunksRef.current.push(data.data);
        } else if (data.type === "audio_end") {
          pendingSpeechTextRef.current = null;
          setSpeechState(false);
          setRequestState(false);
          void playFullAudio();
        } else if (data.type === "stt_result" && typeof data.text === "string" && data.text.trim()) {
          setMessages((current) => [...current, createMessage("user", data.text as string)]);
          setRequestState(true);
          setStatus("thinking");
        } else if (data.type === "text_reply" && typeof data.text === "string" && data.text.trim()) {
          setMessages((current) => [...current, createMessage("assistant", data.text as string)]);
          setRequestState(false);
          setStatus("ready");
        } else if (data.type === "error") {
          pendingSpeechTextRef.current = null;
          setSpeechState(false);
          setRequestState(false);
          setStatus("ready");
          setErrorMessage(
            typeof data.message === "string" ? data.message : "语音服务处理失败，请重新尝试。"
          );
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) ws.close();
    };
  }, [playFullAudio, sendPendingSpeech, setRequestState, setSpeechState]);

  useEffect(() => {
    return () => {
      shouldSendRecordingRef.current = false;
      recordingRequestedRef.current = false;
      speechPendingRef.current = false;
      pendingSpeechTextRef.current = null;
      clearRecordingTimer();

      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }
      activeStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (audioSourceRef.current) {
        try {
          audioSourceRef.current.stop();
        } catch {
          // The source may already have completed naturally.
        }
        audioSourceRef.current.disconnect();
        audioSourceRef.current = null;
      }
      void audioContextRef.current?.close();
    };
  }, [clearRecordingTimer]);

  async function sendMessage(rawMessage: string) {
    const content = rawMessage.trim();
    if (!content || requestPendingRef.current) return;

    void initAudio().catch(() => undefined);
    stopPlayback();
    setErrorMessage(null);
    setDraft("");
    setRequestState(true);
    setStatus("thinking");

    const userMessage = createMessage("user", content);
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);

    if (!sessionIdRef.current) sessionIdRef.current = crypto.randomUUID();

    try {
      const response = await fetch("/api/yuanzhi-ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          sessionId: sessionIdRef.current,
          history: nextMessages.slice(-12).map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });
      const result = (await response.json()) as { reply?: string; error?: string };

      if (!response.ok || !result.reply) {
        throw new Error(result.error || "AI 老师暂时没有回复，请稍后再试。");
      }

      setMessages((current) => [...current, createMessage("assistant", result.reply as string)]);
      setRequestState(false);
      requestCosyVoiceSpeech(result.reply);
    } catch (error) {
      setRequestState(false);
      setStatus("ready");
      setErrorMessage(error instanceof Error ? error.message : "暂时无法连接元智 AI 老师。");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(draft);
  }

  async function beginVoiceInput() {
    if (isBusy) return;
    if (!navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) {
      setErrorMessage("当前浏览器不支持录音，请使用最新版 Chrome、Edge 或 Safari。");
      return;
    }
    if (!socketReady || wsRef.current?.readyState !== WebSocket.OPEN) {
      setErrorMessage("语音服务正在连接，请稍后再按麦克风。");
      return;
    }

    stopPlayback();
    void initAudio().catch(() => undefined);
    setErrorMessage(null);
    setDraft("");
    setRecordingSeconds(0);
    setIsRecording(true);
    setStatus("recognizing");
    recordingRequestedRef.current = true;
    shouldSendRecordingRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      activeStreamRef.current = stream;
      const supportedMimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find(
        (mimeType) => MediaRecorder.isTypeSupported(mimeType)
      );
      const mediaRecorder = supportedMimeType
        ? new MediaRecorder(stream, { mimeType: supportedMimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        clearRecordingTimer();
        mediaRecorderRef.current = null;
        stream.getTracks().forEach((track) => track.stop());
        if (activeStreamRef.current === stream) activeStreamRef.current = null;
        setIsRecording(false);

        const shouldSend = shouldSendRecordingRef.current;
        shouldSendRecordingRef.current = false;
        if (!shouldSend) {
          setStatus("ready");
          return;
        }

        const blob = new Blob(recordedChunksRef.current, {
          type: mediaRecorder.mimeType || "audio/webm",
        });
        if (blob.size === 0) {
          setStatus("ready");
          setErrorMessage("没有录到声音，请按住麦克风后再说一次。");
          return;
        }

        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          setStatus("ready");
          setErrorMessage("语音服务连接已断开，请稍后重试。");
          return;
        }

        setRequestState(true);
        setStatus("thinking");
        try {
          const base64 = await readBlobAsBase64(blob);
          ws.send(JSON.stringify({ type: "audio", data: base64, mimeType: blob.type }));
        } catch (error) {
          setRequestState(false);
          setStatus("ready");
          setErrorMessage(error instanceof Error ? error.message : "录音发送失败，请重新尝试。");
        }
      };

      mediaRecorder.start();
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((seconds) => seconds + 1);
      }, 1_000);

      if (!recordingRequestedRef.current && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
      }
    } catch {
      activeStreamRef.current?.getTracks().forEach((track) => track.stop());
      activeStreamRef.current = null;
      mediaRecorderRef.current = null;
      recordingRequestedRef.current = false;
      shouldSendRecordingRef.current = false;
      clearRecordingTimer();
      setIsRecording(false);
      setStatus("ready");
      setErrorMessage("麦克风权限被拒绝，请在浏览器设置中允许访问麦克风。");
    }
  }

  function finishVoiceInput() {
    recordingRequestedRef.current = false;
    shouldSendRecordingRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }

  function handleMicPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    beginVoiceInput();
  }

  function handleMicPointerUp(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    finishVoiceInput();
  }

  function handleMicKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if ((event.key === " " || event.key === "Enter") && !event.repeat) {
      event.preventDefault();
      beginVoiceInput();
    }
  }

  function handleMicKeyUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      finishVoiceInput();
    }
  }

  function resetConversation() {
    recordingRequestedRef.current = false;
    shouldSendRecordingRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    stopPlayback();
    clearRecordingTimer();
    activeStreamRef.current?.getTracks().forEach((track) => track.stop());
    activeStreamRef.current = null;
    audioChunksRef.current = [];
    pendingSpeechTextRef.current = null;
    sessionIdRef.current = null;
    setMessages([INITIAL_MESSAGE]);
    setDraft("");
    setErrorMessage(null);
    setIsRecording(false);
    setRequestState(false);
    setSpeechState(false);
    setRecordingSeconds(0);
    setStatus("ready");
  }

  return (
    <div className="mx-auto w-full max-w-[1480px] px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <section className="mb-7 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#cce8f6] bg-white/80 px-4 py-2 text-sm font-black text-[#367da4] shadow-sm backdrop-blur">
          <Sparkles size={16} /> 元智AI · 韩语口语老师
        </span>
        <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] text-[#173b57] sm:text-5xl">
          随时开口，把韩语练成
          <span className="text-[#ef7357]">真实表达</span>
        </h1>
        <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-[#607c8e] sm:text-base">
          文字提问、按住说话、即时纠正。AI 老师会自动朗读韩语回复，让每次练习都有听力输入和口语反馈。
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-[96px] lg:self-start">
          <section className="rounded-[1.75rem] border border-white/90 bg-white/86 p-5 shadow-[0_20px_55px_rgba(46,104,139,0.11)] backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#71bfe8] to-[#8775c3] text-white shadow-sm">
                <Bot size={23} />
              </span>
              <div>
                <p className="font-black text-[#244d69]">원지 선생님</p>
                <p className="mt-0.5 text-xs font-bold text-[#7390a1]">韩语 AI 口语老师</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {[
                [Languages, "中韩双语讲解"],
                [Headphones, "回复自动朗读"],
                [Waves, "支持按住说话"],
              ].map(([Icon, label]) => {
                const FeatureIcon = Icon as typeof Languages;
                return (
                  <div key={label as string} className="flex items-center gap-3 rounded-2xl bg-[#f5fafc] px-3.5 py-3 text-sm font-bold text-[#4e6d80]">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#438caf] shadow-sm">
                      <FeatureIcon size={15} />
                    </span>
                    {label as string}
                    <Check className="ml-auto text-[#4da374]" size={14} />
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-[#d8eaf3] bg-[#eff9fe]/90 p-5">
            <p className="text-xs font-black tracking-[0.12em] text-[#5990ae]">快速开始</p>
            <div className="mt-3 space-y-2">
              {PRACTICE_PROMPTS.map((prompt) => (
                <button
                  key={prompt.label}
                  type="button"
                  onClick={() => void sendMessage(prompt.text)}
                  disabled={isBusy}
                  className="w-full rounded-2xl border border-white bg-white/90 px-4 py-3 text-left text-sm font-black text-[#315c76] shadow-sm transition hover:-translate-y-0.5 hover:border-[#abd7ec] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {prompt.label}
                  <span className="mt-1 block text-[11px] font-medium leading-5 text-[#7b94a3]">{prompt.text}</span>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="overflow-hidden rounded-[2rem] border border-white/90 bg-white/90 shadow-[0_28px_80px_rgba(46,104,139,0.16)] backdrop-blur">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4eef3] bg-white/94 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eaf7ff] text-[#3b8db8]">
                <Bot size={21} />
                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-[3px] border-white bg-[#55ad7a]" />
              </span>
              <div>
                <h2 className="text-sm font-black text-[#254e69]">韩语自由对话教室</h2>
                <p className="mt-0.5 text-[11px] font-bold text-[#7893a3]">한국어 자유 대화 교실</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black"
                style={{ color: statusInfo.color, backgroundColor: statusInfo.soft }}
                aria-live="polite"
              >
                <span className={`${styles.statusDot} h-2 w-2 rounded-full`} style={{ backgroundColor: statusInfo.color }} />
                {statusInfo.label}
              </div>
              <button
                type="button"
                onClick={resetConversation}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#dce9ef] bg-white text-[#688497] transition hover:bg-[#f4f9fb]"
                title="重新开始对话"
                aria-label="重新开始对话"
              >
                <RotateCcw size={15} />
              </button>
            </div>
          </header>

          <div className={`${styles.chatGrid} flex min-h-[680px] flex-col bg-[#fbfdfe]`}>
            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-7 sm:py-8">
              <div className="mx-auto flex w-fit items-center gap-2 rounded-full bg-white/85 px-3 py-1.5 text-[10px] font-bold text-[#8ba0ad] shadow-sm">
                <Sparkles size={11} /> 今天也一起勇敢开口吧
              </div>

              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`${styles.messageEnter} flex items-end gap-2.5 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === "assistant" && (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#66b8e4] to-[#8471c0] text-white shadow-sm">
                      <Bot size={17} />
                    </span>
                  )}

                  <div className={`max-w-[86%] sm:max-w-[72%] ${message.role === "user" ? "text-right" : ""}`}>
                    <div
                      className={`relative whitespace-pre-wrap px-4 py-3 text-left text-sm font-medium leading-7 shadow-sm sm:px-5 ${
                        message.role === "user"
                          ? "rounded-[1.35rem_1.35rem_0.35rem_1.35rem] bg-[#f47b5f] text-white"
                          : "rounded-[1.35rem_1.35rem_1.35rem_0.35rem] border border-[#dceaf1] bg-white text-[#365b72]"
                      }`}
                    >
                      {message.content}
                      {message.role === "assistant" && (
                        <button
                          type="button"
                          onClick={() => requestCosyVoiceSpeech(message.content)}
                          disabled={speechPending}
                          className="mt-3 flex items-center gap-1.5 rounded-full bg-[#edf7fc] px-3 py-1.5 text-[11px] font-black text-[#397fa5] transition hover:bg-[#dff1fa] disabled:cursor-not-allowed disabled:opacity-50"
                          title="播放这条回复"
                        >
                          <Volume2 size={13} /> 播放韩语
                        </button>
                      )}
                    </div>
                    <p className={`mt-1.5 px-1 text-[10px] font-bold text-[#9aabb5] ${message.role === "user" ? "text-right" : "text-left"}`}>
                      {message.role === "assistant" ? "元智 AI 老师" : "我"} · {formatTime(message.createdAt)}
                    </p>
                  </div>
                </article>
              ))}

              {requestPending && (
                <div className={`${styles.messageEnter} flex items-end gap-2.5`}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-[#66b8e4] to-[#8471c0] text-white shadow-sm">
                    <Bot size={17} />
                  </span>
                  <div className="flex items-center gap-1.5 rounded-[1.35rem_1.35rem_1.35rem_0.35rem] border border-[#dceaf1] bg-white px-5 py-4 shadow-sm" aria-label="AI 老师思考中">
                    {[0, 1, 2].map((dot) => (
                      <span key={dot} className={`${styles.thinkingDot} h-2 w-2 rounded-full bg-[#65aaca]`} />
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-[#dfeaf0] bg-white/96 p-3 sm:p-5">
              <div className="mb-3 flex min-h-6 items-center justify-center text-center text-xs font-bold" aria-live="polite">
                {errorMessage ? (
                  <span className="rounded-full bg-[#fff0eb] px-3 py-1 text-[#cf6049]">{errorMessage}</span>
                ) : (
                  <span style={{ color: statusInfo.color }}>{statusInfo.detail}</span>
                )}
              </div>

              <form onSubmit={handleSubmit} className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_84px_auto]">
                <label className="flex min-h-14 items-end rounded-2xl border border-[#d5e5ed] bg-[#f9fcfd] px-4 py-3 transition focus-within:border-[#69b5d8] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#dff3fc]">
                  <span className="sr-only">输入要练习的韩语</span>
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value.slice(0, 800))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void sendMessage(draft);
                      }
                    }}
                    disabled={isBusy}
                    rows={1}
                    maxLength={800}
                    placeholder={isRecording ? "正在识别你说的韩语…" : "输入韩语或中文，例如：请陪我练习自我介绍"}
                    className="max-h-32 min-h-7 w-full resize-none bg-transparent text-sm leading-7 text-[#294f68] outline-none placeholder:text-[#9badb8] disabled:opacity-70"
                  />
                </label>

                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onPointerDown={handleMicPointerDown}
                    onPointerUp={handleMicPointerUp}
                    onPointerCancel={handleMicPointerUp}
                    onKeyDown={handleMicKeyDown}
                    onKeyUp={handleMicKeyUp}
                    onContextMenu={(event) => event.preventDefault()}
                    disabled={requestPending || speechPending}
                    className={`${styles.micButton} ${isRecording ? styles.micActive : ""} flex h-16 w-16 items-center justify-center rounded-full text-white shadow-[0_12px_30px_rgba(239,111,84,0.3)] transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50`}
                    style={{ background: isRecording ? "linear-gradient(135deg,#ed654d,#d94b48)" : "linear-gradient(135deg,#f47b5f,#ed6b54)" }}
                    aria-label={isRecording ? "松开发送语音" : "按住录音"}
                  >
                    {isRecording ? <Square size={23} fill="currentColor" /> : <Mic size={27} />}
                  </button>
                  <span className="text-[10px] font-black text-[#7b93a1]">
                    {isRecording ? `${recordingSeconds}s · 松开发送` : "按住说话"}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={!draft.trim() || isBusy}
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#3388b4] px-5 text-sm font-black text-white shadow-[0_12px_28px_rgba(51,136,180,0.22)] transition hover:-translate-y-0.5 hover:bg-[#287ca6] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Send size={17} />
                  <span className="hidden sm:inline">发送</span>
                </button>
              </form>

              {status === "playing" && (
                <button
                  type="button"
                  onClick={() => stopPlayback()}
                  className="mx-auto mt-3 flex items-center gap-1.5 text-xs font-black text-[#8062ae]"
                >
                  <Square size={11} fill="currentColor" /> 停止播放
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
