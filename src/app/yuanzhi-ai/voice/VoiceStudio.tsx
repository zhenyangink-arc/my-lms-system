"use client";

import {
  AudioLines,
  Check,
  Clipboard,
  Download,
  FileAudio,
  Mic,
  Palette,
  Radio,
  Sparkles,
  Square,
  Upload,
  UserRound,
  Wand2,
} from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";

type StudioMode = "stt" | "tts";
type VoiceMode = "theme" | "clone";
type WorkStatus = "idle" | "recording" | "processing" | "done" | "error";

type SocketPayload = {
  type?: unknown;
  text?: unknown;
  data?: unknown;
  message?: unknown;
  sampleRate?: unknown;
  sample_rate?: unknown;
};

type AudioFile = {
  name: string;
  mimeType: string;
  base64: string;
};

const WEBSOCKET_URL =
  process.env.NEXT_PUBLIC_YUANZHI_AI_WS_URL ?? "ws://100.125.173.55:8000/ws";

const THEME_VOICES = [
  { id: "warm-female", name: "温柔陪伴", detail: "柔和、自然，适合日常内容", color: "#e97862" },
  { id: "bright-youth", name: "清亮青年", detail: "明快、有活力，适合学习材料", color: "#378bad" },
  { id: "calm-male", name: "沉稳男声", detail: "稳定、可信，适合正式文章", color: "#715fab" },
  { id: "clear-teacher", name: "清晰讲师", detail: "字词清楚，适合中韩语教学", color: "#4a9870" },
] as const;

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
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function mergeAudioChunks(chunks: string[]) {
  const decodeSeparately = chunks
    .slice(0, -1)
    .some((chunk) => (chunk.includes(",") ? chunk.slice(chunk.indexOf(",") + 1) : chunk).includes("="));
  const decoded = (decodeSeparately ? chunks : [chunks.join("")]).map(decodeBase64);
  const totalLength = decoded.reduce((sum, bytes) => sum + bytes.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const bytes of decoded) {
    result.set(bytes, offset);
    offset += bytes.length;
  }
  return result;
}

function createWavBlob(pcm: Uint8Array, sampleRate: number) {
  const wav = new ArrayBuffer(44 + pcm.byteLength);
  const view = new DataView(wav);
  const writeText = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, pcm.byteLength, true);
  new Uint8Array(wav, 44).set(pcm);
  return new Blob([wav], { type: "audio/wav" });
}

function readBlobAsBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const separator = result.indexOf(",");
      if (separator < 0) reject(new Error("音频文件格式不正确。"));
      else resolve(result.slice(separator + 1));
    };
    reader.onerror = () => reject(new Error("无法读取音频文件。"));
    reader.readAsDataURL(blob);
  });
}

function statusLabel(status: WorkStatus) {
  if (status === "recording") return "录音中";
  if (status === "processing") return "处理中";
  if (status === "done") return "已完成";
  if (status === "error") return "需要重试";
  return "等待任务";
}

export function VoiceStudio() {
  const [mode, setMode] = useState<StudioMode>("stt");
  const [connectionReady, setConnectionReady] = useState(false);
  const [status, setStatus] = useState<WorkStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioInput, setAudioInput] = useState<AudioFile | null>(null);
  const [transcript, setTranscript] = useState("");
  const [ttsText, setTtsText] = useState("안녕하세요! 你好，很高兴认识你。今天也一起学习吧！");
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("theme");
  const [themeVoice, setThemeVoice] = useState<(typeof THEME_VOICES)[number]["id"]>("clear-teacher");
  const [cloneSample, setCloneSample] = useState<AudioFile | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const modeRef = useRef<StudioMode>("stt");
  const statusRef = useRef<WorkStatus>("idle");
  const audioChunksRef = useRef<string[]>([]);
  const sampleRateRef = useRef(24_000);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isBusy = status === "recording" || status === "processing";

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (disposed) return;
      const ws = new WebSocket(WEBSOCKET_URL);
      wsRef.current = ws;
      ws.onopen = () => {
        if (!disposed) setConnectionReady(true);
      };
      ws.onerror = () => {
        if (!disposed) setConnectionReady(false);
      };
      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        if (disposed) return;
        setConnectionReady(false);
        if (statusRef.current === "processing") {
          setStatus("error");
          setErrorMessage("语音服务连接中断，请重新提交任务。");
        }
        reconnectTimer = setTimeout(connect, 2_000);
      };
      ws.onmessage = (event) => {
        if (disposed) return;
        const data = parseSocketPayload(event.data);
        if (!data || typeof data.type !== "string") return;

        if (data.type === "stt_result" && modeRef.current === "stt" && typeof data.text === "string") {
          setTranscript(data.text);
          setStatus("done");
          setErrorMessage(null);
        } else if (data.type === "audio_start" && modeRef.current === "tts") {
          audioChunksRef.current = [];
          const sampleRate =
            typeof data.sampleRate === "number"
              ? data.sampleRate
              : typeof data.sample_rate === "number"
                ? data.sample_rate
                : 24_000;
          sampleRateRef.current = sampleRate;
        } else if (data.type === "audio_chunk" && modeRef.current === "tts" && typeof data.data === "string") {
          audioChunksRef.current.push(data.data);
        } else if (data.type === "audio_end" && modeRef.current === "tts") {
          try {
            const pcm = mergeAudioChunks(audioChunksRef.current.splice(0));
            const url = URL.createObjectURL(createWavBlob(pcm, sampleRateRef.current));
            setAudioUrl(url);
            setStatus("done");
            setErrorMessage(null);
          } catch {
            setStatus("error");
            setErrorMessage("语音处理失败，请重新生成。");
          }
        } else if (data.type === "error") {
          setStatus("error");
          setErrorMessage(typeof data.message === "string" ? data.message : "语音任务处理失败，请重试。");
        }
      };
    };

    connect();
    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
      if (timerRef.current) clearInterval(timerRef.current);
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  async function loadAudioFile(file: File): Promise<AudioFile> {
    return {
      name: file.name,
      mimeType: file.type || "audio/webm",
      base64: await readBlobAsBase64(file),
    };
  }

  async function handleAudioInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setAudioInput(await loadAudioFile(file));
      setStatus("idle");
      setErrorMessage(null);
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "音频读取失败。");
    }
  }

  async function handleCloneSample(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setCloneSample(await loadAudioFile(file));
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "声音样本读取失败。");
    }
  }

  function sendToSocket(payload: Record<string, unknown>) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setStatus("error");
      setErrorMessage("语音服务正在连接，请稍后重试。");
      return false;
    }
    ws.send(JSON.stringify(payload));
    return true;
  }

  function transcribeAudio() {
    if (!audioInput) return;
    modeRef.current = "stt";
    if (sendToSocket({ type: "audio", data: audioInput.base64, mimeType: audioInput.mimeType })) {
      setStatus("processing");
      setTranscript("");
      setErrorMessage(null);
    }
  }

  async function startRecording() {
    if (!connectionReady || !navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) {
      setStatus("error");
      setErrorMessage("麦克风或语音服务暂不可用，请检查权限与连接。");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const supportedMimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find(
        (mimeType) => MediaRecorder.isTypeSupported(mimeType)
      );
      const recorder = supportedMimeType
        ? new MediaRecorder(stream, { mimeType: supportedMimeType })
        : new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      recordedChunksRef.current = [];
      setRecordingSeconds(0);
      setStatus("recording");
      setErrorMessage(null);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        try {
          const audio = {
            name: "现场录音.webm",
            mimeType: blob.type,
            base64: await readBlobAsBase64(blob),
          };
          setAudioInput(audio);
          if (sendToSocket({ type: "audio", data: audio.base64, mimeType: audio.mimeType })) {
            setStatus("processing");
            setTranscript("");
          }
        } catch (error) {
          setStatus("error");
          setErrorMessage(error instanceof Error ? error.message : "录音发送失败。");
        }
      };
      recorder.start();
      timerRef.current = setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1_000);
    } catch {
      setStatus("error");
      setErrorMessage("无法使用麦克风，请在浏览器设置中允许麦克风权限。");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function generateSpeech() {
    const text = ttsText.trim();
    if (!text) return;
    if (voiceMode === "clone" && !cloneSample) {
      setStatus("error");
      setErrorMessage("请先上传 10–30 秒清晰的本人声音样本。");
      return;
    }

    modeRef.current = "tts";
    const payload: Record<string, unknown> = {
      type: "tts",
      text,
      voiceMode,
      voice: voiceMode === "theme" ? themeVoice : "cloned",
    };
    if (cloneSample) {
      payload.referenceAudio = cloneSample.base64;
      payload.referenceMimeType = cloneSample.mimeType;
    }
    if (sendToSocket(payload)) {
      setStatus("processing");
      setErrorMessage(null);
      setAudioUrl(null);
      audioChunksRef.current = [];
    }
  }

  return (
    <section className="mt-6 overflow-hidden rounded-[2.25rem] border border-white/90 bg-white/88 shadow-[0_28px_80px_rgba(49,95,124,0.13)] backdrop-blur">
      <header className="flex flex-col justify-between gap-4 border-b border-[#e4eef3] px-4 py-4 sm:flex-row sm:items-center sm:px-6">
        <div className="inline-flex rounded-2xl bg-[#f1f7fa] p-1.5">
          {([
            ["stt", Mic, "语音转文字"],
            ["tts", AudioLines, "文字转语音"],
          ] as const).map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setMode(value);
                setStatus("idle");
                setErrorMessage(null);
              }}
              disabled={isBusy}
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-xs font-black transition ${
                mode === value ? "bg-white text-[#2c7195] shadow-sm" : "text-[#7891a0] hover:text-[#436b82]"
              }`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs font-black text-[#688493]">
          <span className={`h-2.5 w-2.5 rounded-full ${connectionReady ? "bg-[#4ca574]" : "bg-[#e39a70]"}`} />
          {connectionReady ? "语音服务已连接" : "语音服务连接中"}
          <span className="rounded-full bg-[#f2f6f8] px-3 py-1.5">{statusLabel(status)}</span>
        </div>
      </header>

      {mode === "stt" ? (
        <div className="grid min-h-[600px] lg:grid-cols-[0.92fr_1.08fr]">
          <div className="border-b border-[#e4eef3] p-5 sm:p-8 lg:border-b-0 lg:border-r">
            <p className="text-xs font-black tracking-[0.12em] text-[#5e91ac]">输入音频</p>
            <h2 className="mt-2 text-2xl font-black text-[#28516a]">说一段话，或上传录音</h2>
            <p className="mt-3 text-sm leading-7 text-[#78909f]">支持中韩双语音频，建议使用清晰、安静的录音。</p>

            <div className="mt-7 rounded-[1.75rem] border-2 border-dashed border-[#cfe2eb] bg-[#f8fcfd] p-6 text-center sm:p-8">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#448bad] shadow-sm">
                <FileAudio size={25} />
              </span>
              <p className="mt-4 text-sm font-black text-[#3d6278]">{audioInput?.name ?? "选择一个音频文件"}</p>
              <p className="mt-2 text-xs text-[#8ca0ac]">支持常见音频格式，建议不超过 20 分钟</p>
              <label className="mx-auto mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#d5e6ee] bg-white px-4 py-2.5 text-xs font-black text-[#4c758a] shadow-sm transition hover:border-[#9ecfe2]">
                <Upload size={15} /> 上传录音
                <input type="file" accept="audio/*" onChange={handleAudioInput} className="sr-only" />
              </label>
            </div>

            <div className="my-5 flex items-center gap-3 text-[10px] font-black tracking-[0.14em] text-[#9aabb5]">
              <span className="h-px flex-1 bg-[#e2ecef]" /> 或者现场录音 <span className="h-px flex-1 bg-[#e2ecef]" />
            </div>

            <button
              type="button"
              onClick={status === "recording" ? stopRecording : startRecording}
              disabled={status === "processing"}
              className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full text-white shadow-[0_16px_38px_rgba(238,111,85,0.3)] transition active:scale-95 ${
                status === "recording" ? "bg-[#dc554a]" : "bg-gradient-to-br from-[#f2876d] to-[#eb6853]"
              }`}
            >
              {status === "recording" ? <Square size={25} fill="currentColor" /> : <Mic size={30} />}
            </button>
            <p className="mt-3 text-center text-xs font-black text-[#78909f]">
              {status === "recording" ? `${recordingSeconds} 秒 · 点击结束并转写` : "点击开始录音"}
            </p>

            <button
              type="button"
              onClick={transcribeAudio}
              disabled={!audioInput || isBusy}
              className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#367fa5] px-5 text-sm font-black text-white shadow-[0_12px_28px_rgba(54,127,165,0.22)] transition hover:bg-[#2d7195] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Wand2 size={17} /> {status === "processing" ? "正在识别…" : "开始转成文字"}
            </button>
          </div>

          <div className="flex flex-col bg-[#fbfdfe] p-5 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black tracking-[0.12em] text-[#5e91ac]">转写结果</p>
                <h2 className="mt-2 text-2xl font-black text-[#28516a]">转写结果</h2>
              </div>
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(transcript)}
                disabled={!transcript}
                className="inline-flex items-center gap-2 rounded-xl border border-[#d9e7ed] bg-white px-3 py-2 text-xs font-black text-[#55778a] disabled:opacity-40"
              >
                <Clipboard size={14} /> 复制
              </button>
            </div>
            <textarea
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              placeholder="识别出的中韩文会显示在这里，你还可以直接修改…"
              className="mt-6 min-h-[390px] flex-1 resize-none rounded-[1.75rem] border border-[#dce8ed] bg-white p-5 text-sm leading-8 text-[#355a70] outline-none transition focus:border-[#8cc4dc] focus:ring-4 focus:ring-[#e2f3fa]"
            />
          </div>
        </div>
      ) : (
        <div className="grid min-h-[650px] lg:grid-cols-[1.08fr_0.92fr]">
          <div className="border-b border-[#e4eef3] p-5 sm:p-8 lg:border-b-0 lg:border-r">
            <p className="text-xs font-black tracking-[0.12em] text-[#8b73b7]">文字转语音</p>
            <h2 className="mt-2 text-2xl font-black text-[#28516a]">输入要朗读的中韩文字</h2>
            <textarea
              value={ttsText}
              onChange={(event) => setTtsText(event.target.value.slice(0, 1600))}
              placeholder="输入中文、韩文，或中韩混合内容…"
              className="mt-6 min-h-52 w-full resize-none rounded-[1.75rem] border border-[#dce8ed] bg-[#fbfdfe] p-5 text-sm leading-8 text-[#355a70] outline-none transition focus:border-[#aa9ad2] focus:bg-white focus:ring-4 focus:ring-[#f0ebfa]"
            />
            <p className="mt-2 text-right text-[11px] font-bold text-[#91a3ad]">{ttsText.length}/1600</p>

            <div className="mt-7 flex rounded-2xl bg-[#f3f5f8] p-1.5">
              {([
                ["theme", Palette, "主题音色"],
                ["clone", UserRound, "本人声音克隆"],
              ] as const).map(([value, Icon, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setVoiceMode(value)}
                  className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl text-xs font-black transition ${
                    voiceMode === value ? "bg-white text-[#725ea6] shadow-sm" : "text-[#8295a1]"
                  }`}
                >
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>

            {voiceMode === "theme" ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {THEME_VOICES.map((voice) => (
                  <button
                    key={voice.id}
                    type="button"
                    onClick={() => setThemeVoice(voice.id)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      themeVoice === voice.id ? "border-[#a995d3] bg-[#f6f2fc] ring-2 ring-[#e8def7]" : "border-[#dfe9ed] bg-white hover:border-[#c9bce5]"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ backgroundColor: voice.color }}>
                        <Radio size={16} />
                      </span>
                      <span>
                        <span className="block text-sm font-black text-[#3e6075]">{voice.name}</span>
                        <span className="mt-1 block text-[10px] font-medium text-[#8a9ca6]">{voice.detail}</span>
                      </span>
                      {themeVoice === voice.id && <Check className="ml-auto text-[#7a65ad]" size={16} />}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-[1.5rem] border border-[#e2d9f1] bg-[#f8f5fd] p-5">
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#7d67af] shadow-sm">
                    <UserRound size={20} />
                  </span>
                  <div>
                    <p className="text-sm font-black text-[#4d5f78]">上传本人声音样本</p>
                    <p className="mt-1 text-xs leading-6 text-[#8293a0]">建议 10–30 秒、无背景音乐、吐字清楚的录音。</p>
                    <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-[#715da3] shadow-sm">
                      <Upload size={14} /> {cloneSample?.name ?? "选择声音样本"}
                      <input type="file" accept="audio/*" onChange={handleCloneSample} className="sr-only" />
                    </label>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={generateSpeech}
              disabled={!ttsText.trim() || isBusy}
              className="mt-7 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#846eb8] to-[#6e5aa4] px-5 text-sm font-black text-white shadow-[0_14px_30px_rgba(116,94,170,0.24)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Sparkles size={17} /> {status === "processing" ? "正在生成语音…" : "生成自然语音"}
            </button>
          </div>

          <div className="flex flex-col bg-[#fbfdfe] p-5 sm:p-8">
            <p className="text-xs font-black tracking-[0.12em] text-[#8b73b7]">语音结果</p>
            <h2 className="mt-2 text-2xl font-black text-[#28516a]">生成结果</h2>
            <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-[1.75rem] border border-[#e1e7ee] bg-white p-6 text-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-gradient-to-br from-[#f2ebfb] to-[#e7f5fb] text-[#7965ad] shadow-sm">
                <AudioLines size={34} />
              </span>
              <p className="mt-5 text-base font-black text-[#45677b]">
                {status === "processing" ? "正在合成中韩双语声音" : audioUrl ? "你的语音已生成" : "生成后在这里试听"}
              </p>
              <p className="mt-2 max-w-sm text-xs leading-6 text-[#899ca7]">中文和韩文由同一个声音引擎朗读，衔接更自然。</p>
              {audioUrl && (
                <div className="mt-7 w-full max-w-md">
                  <audio src={audioUrl} controls autoPlay className="w-full" />
                  <a
                    href={audioUrl}
                    download="元智语音.wav"
                    className="mx-auto mt-4 inline-flex items-center gap-2 rounded-xl border border-[#ded6ed] bg-[#f8f5fc] px-4 py-2.5 text-xs font-black text-[#725fa3]"
                  >
                    <Download size={14} /> 下载语音文件
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="border-t border-[#f1ddd7] bg-[#fff7f3] px-5 py-3 text-center text-xs font-bold text-[#c75f4c]" role="alert">
          {errorMessage}
        </div>
      )}
    </section>
  );
}
