"use client";

import {
  ArrowLeft,
  Bot,
  Clock3,
  Crown,
  ImageIcon,
  Mic,
  RotateCcw,
  Send,
  Server,
  Square,
  Volume2,
} from "lucide-react";
import Link from "next/link";
import {
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import styles from "./ai-experience.module.css";

type ChatRole = "user" | "assistant";
type ChatStatus = "ready" | "recognizing" | "thinking" | "synthesizing" | "playing";
type ChatMode = "text" | "voice" | "image";
type ReplyLanguageMode = "match" | "korean" | "beginner";

export type FormalPracticeConfig = {
  scenario: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  durationMinutes: 5 | 10 | 15;
  replyLanguageMode: ReplyLanguageMode;
};

export type FormalPracticeSummary = {
  config: FormalPracticeConfig;
  elapsedSeconds: number;
  userTurns: number;
  assistantTurns: number;
};

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: Date;
};

const WS_TICKET_ENDPOINT = "/api/conversation-practice/ai-experience/ws-ticket";

type SocketPayload = {
  type?: unknown;
  text?: unknown;
  data?: unknown;
  message?: unknown;
  sample_rate?: unknown;
  sampleRate?: unknown;
};

type TextDetection = { rawValue: string };
type TextDetectorInstance = { detect(source: ImageBitmap): Promise<TextDetection[]> };
type TextDetectorConstructor = new () => TextDetectorInstance;

const MODE_GUIDANCE: Record<ChatMode, string> = {
  text: "你可以直接输入韩语或中文，我会用文字回复。",
  voice: "你可以输入文字，或按住麦克风说话，我会用语音回答。",
  image: "你可以输入文字或选择图片，我会识别图片中的文字并用文字回复。",
};

// 文字版走 qwen-chat 接口（上限 1000 字），语音/图片版走 chat 接口（上限 800 字），
// 两边后端各自独立限制，这里必须跟着一致，否则语音/图片版会出现"能打字却发不出去"。
const MESSAGE_LENGTH_LIMITS: Record<ChatMode, number> = {
  text: 1000,
  voice: 800,
  image: 800,
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2";

function getInitialMessages(assistantName: string, mode: ChatMode) {
  return [{
    id: "welcome",
    role: "assistant" as const,
    content: `안녕하세요! 저는 한국어 선생님이에요. 만나서 반가워요!\n你好，我是${assistantName}。${MODE_GUIDANCE[mode]}`,
    createdAt: new Date(0),
  }];
}

const PRACTICE_PROMPTS = [
  { label: "自我介绍", text: "한국어로 자기소개를 연습하고 싶어요." },
  { label: "咖啡店点单", text: "카페에서 주문하는 대화를 연습해 주세요." },
  { label: "大学面试", text: "대학교 면접 질문을 해 주세요." },
];

const STATUS_CONFIG: Record<ChatStatus, { label: string; detail: string; color: string; soft: string }> = {
  ready: {
    label: "准备就绪",
    detail: "输入文字，或按住麦克风开始说韩语",
    color: "var(--status-success)",
    soft: "var(--status-success-surface)",
  },
  recognizing: {
    label: "识别中",
    detail: "正在听你说话，松开后自动发送",
    color: "var(--support)",
    soft: "var(--support-surface)",
  },
  thinking: {
    label: "思考中",
    detail: "智能老师正在组织韩语回复",
    color: "var(--primary)",
    soft: "var(--accent)",
  },
  synthesizing: {
    label: "语音合成中",
    detail: "正在生成中韩双语语音",
    color: "var(--status-warning)",
    soft: "var(--status-warning-surface)",
  },
  playing: {
    label: "播放中",
    detail: "正在朗读智能老师的韩语回复",
    color: "var(--status-warning)",
    soft: "var(--status-warning-surface)",
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

const FORMAL_SESSION_STORAGE_PREFIX = "conversation-practice:formal-session:";

type StoredFormalSession = {
  startedAt: number;
  messages: { id: string; role: ChatRole; content: string; createdAt: string }[];
};

// 正式练习中途刷新页面/切走标签页会丢光倒计时和对话记录，只能从头再来。
// 用 sessionStorage 保存一份（标签页关闭即清空，不需要额外的后端存储），
// 时长仍然按 startedAt 这个真实时间戳计算，不会因为刷新而"暂停"计时。
function readStoredFormalSession(key: string): StoredFormalSession | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredFormalSession>;
    if (typeof parsed.startedAt !== "number" || !Array.isArray(parsed.messages)) return null;
    return { startedAt: parsed.startedAt, messages: parsed.messages };
  } catch {
    return null;
  }
}

function writeStoredFormalSession(key: string, session: StoredFormalSession) {
  try {
    sessionStorage.setItem(key, JSON.stringify(session));
  } catch {
    // 隐私模式或存储配额已满时静默跳过：只影响刷新后能否恢复，不影响当前会话继续进行。
  }
}

function clearStoredFormalSession(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // 同上，静默跳过。
  }
}

function formatTime(date: Date) {
  if (date.getTime() === 0) return "现在";
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatElapsedTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
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

export function ConversationAiExperience({
  variant = "quick",
  basePath,
  formalConfig,
  formalSessionKey,
  onFormalFinish,
}: {
  variant?: "quick" | "formal";
  basePath: string;
  formalConfig?: FormalPracticeConfig;
  formalSessionKey?: string;
  onFormalFinish?: (summary: FormalPracticeSummary) => void;
}) {
  const isFormal = variant === "formal" && Boolean(formalConfig);
  const assistantName = "智能口语陪练老师";
  const formalStorageKey =
    isFormal && formalSessionKey ? `${FORMAL_SESSION_STORAGE_PREFIX}${formalSessionKey}` : null;
  const [chatMode, setChatMode] = useState<ChatMode>(isFormal ? "voice" : "text");
  const [replyLanguageMode, setReplyLanguageMode] = useState<ReplyLanguageMode | null>(
    formalConfig?.replyLanguageMode ?? null
  );
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    getInitialMessages(assistantName, isFormal ? "voice" : "text")
  );
  // sessionStorage 只能在挂载后的 effect 里读（服务端渲染阶段没有这个对象），
  // 所以这里先用 null 占位，真正的起始时间由下面"恢复正式练习会话"的 effect 补上。
  const startedAtRef = useRef<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [requestPending, setRequestPending] = useState(false);
  const [speechPending, setSpeechPending] = useState(false);
  const [socketReady, setSocketReady] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

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
  const formalFinishedRef = useRef(false);
  const pendingSpeechTextRef = useRef<string | null>(null);

  const readyDetail = chatMode === "voice"
    ? socketReady
      ? "输入文字，或按住麦克风开始说韩语"
      : "语音服务正在连接，文字输入仍可使用"
    : chatMode === "image"
      ? "输入文字或选择图片，回复仅输出文字"
      : "输入文字开始练习，回复仅输出文字";
  const statusInfo = status === "thinking"
    ? { ...STATUS_CONFIG.thinking, detail: `${assistantName}正在组织韩语回复` }
    : status === "ready"
      ? { ...STATUS_CONFIG.ready, detail: readyDetail }
      : STATUS_CONFIG[status];
  const isBusy = requestPending || speechPending || isRecording;
  const requiresReplyLanguageMode = chatMode === "text" && !replyLanguageMode;

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
      if (sampleCount === 0) throw new Error("返回的语音为空。");

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
      setErrorMessage(error instanceof Error ? error.message : "语音播放失败，请重新尝试。");
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
      // 手动重播历史消息和"新一轮语音对话"共用同一条 WebSocket 连接和同一套
      // audio_start/chunk/end 事件、同一个 requestPending 标志。如果在新一轮
      // 对话还在等待 AI 回复时点了重播，重播先完成会把 requestPending 提前
      // 清掉，导致还没收到真正回复就误显示"空闲"、麦克风被过早解锁。
      if (!text || speechPendingRef.current || requestPendingRef.current) return;

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
        setErrorMessage("语音服务正在重新连接，连接恢复后会自动生成语音。");
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

    const connect = async () => {
      if (disposed) return;

      // WS 地址不再打包进前端 bundle：改成登录后向后端换一张短期地址+签名，
      // 既避免隧道域名换了要重新构建发布，也避免未登录用户直接从 JS 里扒地址。
      let wsUrl: string;
      try {
        const response = await fetch(WS_TICKET_ENDPOINT, { cache: "no-store" });
        const result = (await response.json().catch(() => null)) as
          | { url?: string; error?: string }
          | null;
        if (disposed) return;
        if (!response.ok || !result?.url) {
          setSocketReady(false);
          setErrorMessage(result?.error || "语音陪练服务暂时不可用，请稍后再试。");
          reconnectTimer = setTimeout(() => void connect(), 2_000);
          return;
        }
        wsUrl = result.url;
      } catch {
        if (disposed) return;
        setSocketReady(false);
        reconnectTimer = setTimeout(() => void connect(), 2_000);
        return;
      }

      if (disposed) return;
      const ws = new WebSocket(wsUrl);
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
          setErrorMessage("语音服务连接中断，正在自动重连并重新生成语音。");
        }
        reconnectTimer = setTimeout(() => void connect(), 2_000);
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

    void connect();

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

  async function readImageText(file: File) {
    try {
      const TextDetector = (window as typeof window & { TextDetector?: TextDetectorConstructor }).TextDetector;
      if (!TextDetector) return `图片文件：${file.name}（当前浏览器不支持本地文字识别）`;
      const bitmap = await createImageBitmap(file);
      const detections = await new TextDetector().detect(bitmap);
      bitmap.close();
      const text = detections.map((item) => item.rawValue.trim()).filter(Boolean).join("\n");
      return text ? `图片文字：\n${text}` : `图片文件：${file.name}（未识别到可读取的文字）`;
    } catch {
      return `图片文件：${file.name}（读取失败，请根据图片内容补充文字说明）`;
    }
  }

  async function sendMessage(rawMessage: string) {
    let content = rawMessage.trim();
    if (chatMode === "image" && imageFile) {
      const imageText = await readImageText(imageFile);
      content = [content, imageText].filter(Boolean).join("\n\n");
    }
    if (!content || requestPendingRef.current || (chatMode === "text" && !replyLanguageMode)) {
      if (chatMode === "text" && !replyLanguageMode) setErrorMessage("请先选择回复语言模式，再开始对话。");
      return;
    }

    void initAudio().catch(() => undefined);
    stopPlayback();
    setErrorMessage(null);
    setDraft("");
    setImageFile(null);
    setRequestState(true);
    setStatus("thinking");

    const userMessage = createMessage("user", content);
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);

    if (!sessionIdRef.current) sessionIdRef.current = crypto.randomUUID();

    try {
      const endpoint = chatMode === "text"
        ? "/api/conversation-practice/ai-experience/qwen-chat"
        : "/api/conversation-practice/ai-experience/chat";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          sessionId: sessionIdRef.current,
          history: nextMessages.slice(-12).map((message) => ({
            role: message.role,
            content: message.content,
          })),
          replyLanguageMode: replyLanguageMode ?? "match",
        }),
      });

      if (chatMode === "text" && response.ok && response.body) {
        const assistantMessage = createMessage("assistant", "");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        setMessages((current) => [...current, assistantMessage]);

        while (true) {
          const { done, value } = await reader.read();
          const chunk = decoder.decode(value, { stream: !done });
          if (chunk) {
            setMessages((current) => current.map((item) => (
              item.id === assistantMessage.id ? { ...item, content: `${item.content}${chunk}` } : item
            )));
          }
          if (done) break;
        }

        setRequestState(false);
        setStatus("ready");
        return;
      }
      const result = (await response.json()) as { reply?: string; error?: string };

      if (!response.ok || !result.reply) {
        throw new Error(result.error || "智能老师暂时没有回复，请稍后再试。");
      }

      setMessages((current) => [...current, createMessage("assistant", result.reply as string)]);
      setRequestState(false);
      if (chatMode !== "voice") setStatus("ready");
      else requestCosyVoiceSpeech(result.reply);
    } catch (error) {
      setRequestState(false);
      setStatus("ready");
      setErrorMessage(error instanceof Error ? error.message : `暂时无法连接${assistantName}。`);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(draft);
  }

  async function beginVoiceInput() {
    if (isBusy) return;
    if (chatMode !== "voice") {
      setErrorMessage(`${chatMode === "image" ? "图片版" : "文字版"}不支持语音输入，请切换到语音版使用麦克风。`);
      return;
    }
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
    setImageFile(null);
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

  function resetConversation(targetMode: ChatMode = chatMode) {
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
    setMessages(getInitialMessages(assistantName, targetMode));
    setDraft("");
    setErrorMessage(null);
    setIsRecording(false);
    setRequestState(false);
    setSpeechState(false);
    setRecordingSeconds(0);
    setStatus("ready");
  }

  function switchChatMode(nextMode: ChatMode) {
    if (nextMode === chatMode || isBusy) return;
    setChatMode(nextMode);
    resetConversation(nextMode);
  }

  const finishFormalPractice = useCallback(() => {
    if (!isFormal || !formalConfig || formalFinishedRef.current) return;
    formalFinishedRef.current = true;
    recordingRequestedRef.current = false;
    shouldSendRecordingRef.current = false;
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    stopPlayback();
    if (formalStorageKey) clearStoredFormalSession(formalStorageKey);
    onFormalFinish?.({
      config: formalConfig,
      elapsedSeconds,
      userTurns: messages.filter((message) => message.role === "user").length,
      assistantTurns: messages.filter(
        (message) => message.role === "assistant" && message.id !== "welcome"
      ).length,
    });
  }, [elapsedSeconds, formalConfig, formalStorageKey, isFormal, messages, onFormalFinish, stopPlayback]);

  // 恢复正式练习会话：中途刷新/切走再回来时，把上次存的对话记录和起始时间读回来，
  // 而不是从欢迎语和 0 秒重新开始。必须放在 effect 里而不是 useState 初始值，
  // 否则服务端渲染阶段访问 sessionStorage 会直接报错。
  useEffect(() => {
    if (!formalStorageKey) {
      startedAtRef.current = Date.now();
      return;
    }
    const restored = readStoredFormalSession(formalStorageKey);
    if (restored && restored.messages.length > 0) {
      startedAtRef.current = restored.startedAt;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessages(
        restored.messages.map((message) => ({
          ...message,
          createdAt: new Date(message.createdAt),
        }))
      );
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - restored.startedAt) / 1_000)));
    } else {
      startedAtRef.current = Date.now();
    }
  }, [formalStorageKey]);

  useEffect(() => {
    if (!isFormal) return;
    const timer = window.setInterval(() => {
      const anchor = startedAtRef.current ?? Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - anchor) / 1_000)));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [isFormal]);

  useEffect(() => {
    if (!formalStorageKey || startedAtRef.current === null) return;
    writeStoredFormalSession(formalStorageKey, {
      startedAt: startedAtRef.current,
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      })),
    });
  }, [formalStorageKey, messages]);

  useEffect(() => {
    if (
      isFormal &&
      formalConfig &&
      elapsedSeconds >= formalConfig.durationMinutes * 60
    ) {
      finishFormalPractice();
    }
  }, [elapsedSeconds, finishFormalPractice, formalConfig, isFormal]);

  return (
    <div className={`${styles.themeScope} mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8`}>
      <Link href={`${basePath}/ai-experience`} className={`app-muted-text mb-4 inline-flex items-center gap-2 rounded-lg text-xs font-bold ${focusRing}`}>
        <ArrowLeft size={14} aria-hidden="true" />返回练习方式
      </Link>
      <div className={`grid gap-5 ${isFormal ? "grid-cols-1" : "lg:grid-cols-[250px_minmax(0,1fr)]"}`}>
        {!isFormal && (
          <aside className="space-y-4 lg:sticky lg:top-[96px] lg:self-start">
            <section className="app-card rounded-[1.75rem] border p-5">
              <h2 className="text-sm font-bold">快速开始</h2>
              <div className="mt-3 space-y-2">
                {PRACTICE_PROMPTS.map((prompt) => (
                  <button key={prompt.label} type="button" onClick={() => void sendMessage(prompt.text)} disabled={isBusy} className={`w-full rounded-2xl border bg-[var(--surface-soft)] px-4 py-3 text-left text-sm font-bold transition hover:-translate-y-0.5 ${focusRing} disabled:cursor-not-allowed disabled:opacity-50`}>
                    {prompt.label}
                    <span className="app-muted-text mt-1 block text-xs font-medium leading-5">{prompt.text}</span>
                  </button>
                ))}
              </div>
            </section>
          </aside>
        )}

        <section className="app-card overflow-hidden rounded-[2rem] border shadow-lg">
          {isFormal && formalConfig && (
            <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:px-6" style={{ color: "var(--primary-foreground)", backgroundColor: "var(--primary)", borderColor: "var(--border-subtle)" }}>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold">正式练习</p>
                <h2 className="mt-1 truncate text-lg font-bold">{formalConfig.scenario}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border px-3 py-1.5 text-xs font-bold">{formalConfig.difficulty === "beginner" ? "初级" : formalConfig.difficulty === "intermediate" ? "中级" : "高级"}</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold"><Clock3 size={13} aria-hidden="true" />{formatElapsedTime(elapsedSeconds)} / {formalConfig.durationMinutes}:00</span>
                <button type="button" onClick={finishFormalPractice} className={`rounded-xl px-4 py-2 text-xs font-bold ${focusRing}`} style={{ color: "var(--primary)", backgroundColor: "var(--primary-foreground)" }}>结束练习</button>
              </div>
            </div>
          )}

          <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-[var(--card)] px-4 py-4 sm:px-6" style={{ borderColor: "var(--border-subtle)" }}>
            <div className="flex items-center gap-3">
              <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl" style={{ color: "var(--primary)", backgroundColor: "var(--accent)" }}>
                <Bot size={21} aria-hidden="true" />
                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-[3px]" style={{ borderColor: "var(--card)", backgroundColor: "var(--status-success)" }} aria-hidden="true" />
              </span>
              <h2 className="text-sm font-bold">韩语自由对话教室</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold" style={{ color: statusInfo.color, backgroundColor: statusInfo.soft }} role="status" aria-live="polite">
                <span className={`${styles.statusDot} h-2 w-2 rounded-full`} style={{ backgroundColor: statusInfo.color }} aria-hidden="true" />{statusInfo.label}
              </div>
              <button type="button" onClick={() => resetConversation()} className={`flex h-10 w-10 items-center justify-center rounded-xl border bg-[var(--surface-soft)] ${focusRing}`} title="重新开始对话" aria-label="重新开始对话"><RotateCcw size={15} aria-hidden="true" /></button>
            </div>
          </header>

          {!isFormal && (
            <div className="border-b bg-[var(--surface-soft)] px-4 py-4 sm:px-6" style={{ borderColor: "var(--border-subtle)" }}>
              <fieldset>
                <legend className="text-xs font-bold">对话版本</legend>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  {([
                    ["text", "文字版", Server, "文字输出"],
                    ["voice", "语音版", Crown, "支持语音"],
                    ["image", "图片版", ImageIcon, "图片识别"],
                  ] as const).map(([mode, label, Icon, detail]) => {
                    const selected = chatMode === mode;
                    return (
                      <button key={mode} type="button" onClick={() => switchChatMode(mode)} disabled={isBusy} aria-pressed={selected} className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition sm:p-4 ${focusRing} ${selected ? "ring-2 ring-[var(--ring)]" : "hover:bg-[var(--accent)]"}`} style={{ borderColor: selected ? "var(--primary)" : "var(--border)", backgroundColor: selected ? "var(--card)" : "var(--surface-soft)" }}>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ color: selected ? "var(--primary)" : "var(--foreground-muted)", backgroundColor: selected ? "var(--accent)" : "var(--card)" }}><Icon size={19} aria-hidden="true" /></span>
                        <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{label}</span><span className="app-muted-text mt-1 block text-xs">{detail}</span></span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <fieldset className="mt-4">
                <legend className="text-xs font-bold">回复语言模式</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {([ ["match", "智能跟随"], ["korean", "韩语沉浸"], ["beginner", "初级辅助"] ] as const).map(([mode, label]) => (
                    <button key={mode} type="button" disabled={isBusy} onClick={() => setReplyLanguageMode(mode)} aria-pressed={replyLanguageMode === mode} className={`rounded-full border px-3 py-2 text-xs font-bold transition ${focusRing}`} style={{ color: replyLanguageMode === mode ? "var(--status-warning)" : "var(--foreground-secondary)", borderColor: replyLanguageMode === mode ? "var(--status-warning)" : "var(--border)", backgroundColor: replyLanguageMode === mode ? "var(--status-warning-surface)" : "var(--card)" }}>{label}</button>
                  ))}
                  <span className="app-muted-text self-center text-xs">{replyLanguageMode === "beginner" ? "韩语回答会附简短中文辅助" : replyLanguageMode === "korean" ? "韩语输入仅用韩语回答" : replyLanguageMode === "match" ? "按你的输入语言回答" : "请先选择一种回复语言模式。"}</span>
                </div>
              </fieldset>
            </div>
          )}

          <div className="flex min-h-[680px] flex-col" style={{ backgroundColor: "var(--surface-soft)" }}>
            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-7 sm:py-8" role="log" aria-live="polite" aria-relevant="additions text" aria-label="会话记录" aria-busy={requestPending || speechPending}>
              {messages.map((message) => (
                <article key={message.id} className={`${styles.messageEnter} flex items-end gap-2.5 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  {message.role === "assistant" && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl" style={{ color: "var(--primary-foreground)", backgroundColor: "var(--primary)" }}><Bot size={17} aria-hidden="true" /></span>}
                  <div className={`max-w-[86%] sm:max-w-[72%] ${message.role === "user" ? "text-right" : ""}`}>
                    <div className="relative whitespace-pre-wrap rounded-2xl border px-4 py-3 text-left text-sm font-medium leading-7 shadow-sm sm:px-5" style={{ color: message.role === "user" ? "var(--primary-foreground)" : "var(--card-foreground)", borderColor: message.role === "user" ? "var(--primary)" : "var(--border)", backgroundColor: message.role === "user" ? "var(--primary)" : "var(--card)" }}>
                      {message.content}
                      {message.role === "assistant" && chatMode === "voice" && <button type="button" onClick={() => requestCosyVoiceSpeech(message.content)} disabled={speechPending || requestPending} className={`mt-3 flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold ${focusRing} disabled:cursor-not-allowed disabled:opacity-50`} style={{ color: "var(--primary)", backgroundColor: "var(--accent)" }}><Volume2 size={13} aria-hidden="true" />播放韩语</button>}
                    </div>
                    <p className={`app-muted-text mt-1.5 px-1 text-xs font-bold ${message.role === "user" ? "text-right" : "text-left"}`}>{message.role === "assistant" ? assistantName : "我"} · {formatTime(message.createdAt)}</p>
                  </div>
                </article>
              ))}
              {requestPending && <div className={`${styles.messageEnter} flex items-end gap-2.5`} role="status"><span className="flex h-9 w-9 items-center justify-center rounded-2xl" style={{ color: "var(--primary-foreground)", backgroundColor: "var(--primary)" }}><Bot size={17} aria-hidden="true" /></span><div className="app-card flex items-center gap-1.5 rounded-2xl border px-5 py-4" aria-label="智能老师思考中">{[0, 1, 2].map((dot) => <span key={dot} className={`${styles.thinkingDot} h-2 w-2 rounded-full`} style={{ backgroundColor: "var(--primary)" }} aria-hidden="true" />)}</div></div>}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t bg-[var(--card)] p-3 sm:p-4" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="mb-3 flex min-h-6 items-center justify-center text-center text-xs font-bold" aria-live="polite">{errorMessage ? <span role="alert" className="rounded-full px-3 py-1" style={{ color: "var(--status-danger)", backgroundColor: "var(--status-danger-surface)" }}>{errorMessage}</span> : <span style={{ color: statusInfo.color }}>{statusInfo.detail}</span>}</div>
              {chatMode === "image" && <label className="mb-3 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed bg-[var(--surface-soft)] px-3 py-3 text-xs font-bold focus-within:ring-2 focus-within:ring-[var(--ring)] focus-within:ring-offset-2"><ImageIcon size={16} aria-hidden="true" /><span className="truncate">{imageFile ? imageFile.name : "选择常见格式图片"}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} className="sr-only" /></label>}
              <form onSubmit={handleSubmit} className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_84px_auto]">
                <div><label htmlFor="conversation-draft" className="mb-1 block text-xs font-bold">对话输入</label><div className="flex min-h-14 items-end rounded-2xl border bg-[var(--surface-soft)] px-4 py-3 transition focus-within:ring-2 focus-within:ring-[var(--ring)] focus-within:ring-offset-2"><textarea id="conversation-draft" value={draft} onChange={(event) => setDraft(event.target.value.slice(0, MESSAGE_LENGTH_LIMITS[chatMode]))} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void sendMessage(draft); } }} disabled={isBusy || requiresReplyLanguageMode} rows={1} maxLength={MESSAGE_LENGTH_LIMITS[chatMode]} placeholder={isRecording ? "正在识别你说的韩语…" : "输入韩语或中文，例如：请陪我练习自我介绍"} className="max-h-32 min-h-7 w-full resize-none bg-transparent text-sm leading-6 text-[var(--foreground)] outline-none placeholder:text-[var(--foreground-muted)] disabled:opacity-70" /></div></div>
                <div className="flex flex-col items-center gap-1"><button type="button" onPointerDown={handleMicPointerDown} onPointerUp={handleMicPointerUp} onPointerCancel={handleMicPointerUp} onKeyDown={handleMicKeyDown} onKeyUp={handleMicKeyUp} onBlur={() => { if (isRecording) finishVoiceInput(); }} onContextMenu={(event) => event.preventDefault()} disabled={requestPending || speechPending || chatMode !== "voice"} className={`${styles.micButton} ${isRecording ? styles.micActive : ""} flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition active:scale-95 ${focusRing} disabled:cursor-not-allowed disabled:opacity-50`} style={{ color: "var(--primary-foreground)", background: isRecording ? "linear-gradient(135deg, var(--status-warning), var(--primary))" : "linear-gradient(135deg, var(--support), var(--primary))" }} aria-pressed={isRecording} aria-label={chatMode !== "voice" ? `${chatMode === "image" ? "图片版" : "文字版"}不支持语音输入` : isRecording ? "松开发送语音" : "按住录音"}>{isRecording ? <Square size={23} fill="currentColor" aria-hidden="true" /> : <Mic size={27} aria-hidden="true" />}</button><span className="app-muted-text text-xs font-bold">{chatMode !== "voice" ? "切换语音版" : isRecording ? `${recordingSeconds} 秒 · 松开发送` : "按住说话"}</span></div>
                <button type="submit" disabled={!(draft.trim() || (chatMode === "image" && imageFile)) || isBusy || requiresReplyLanguageMode} className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-bold transition hover:-translate-y-0.5 ${focusRing} disabled:cursor-not-allowed disabled:opacity-50`} style={{ color: "var(--primary-foreground)", backgroundColor: "var(--primary)" }}><Send size={17} aria-hidden="true" /><span className="hidden sm:inline">发送</span></button>
              </form>
              {status === "playing" && <button type="button" onClick={() => stopPlayback()} className={`mx-auto mt-3 flex items-center gap-1.5 rounded-lg text-xs font-bold ${focusRing}`} style={{ color: "var(--primary)" }}><Square size={11} fill="currentColor" aria-hidden="true" />停止播放</button>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
