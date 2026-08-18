"use client";

import { Mic, RotateCcw, Square, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function AssignmentAudioRecorder({
  assignmentId,
  questionId,
  previousEvidenceId,
  onEvidenceChange,
}: {
  assignmentId: string;
  questionId: string;
  previousEvidenceId?: string;
  onEvidenceChange?: () => void;
}) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [evidenceId, setEvidenceId] = useState(previousEvidenceId ?? "");
  const [audioUrl, setAudioUrl] = useState(
    previousEvidenceId
      ? `/api/assignments/recordings/${previousEvidenceId}`
      : ""
  );
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    onEvidenceChange?.();
  }, [evidenceId, onEvidenceChange]);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (audioUrl.startsWith("blob:")) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl]
  );

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) {
      setError("当前浏览器不能录音，请换用最新版 Chrome、Edge 或 Safari。");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const preferredTypes = ["audio/webm", "audio/ogg", "audio/mp4"];
      const mimeType = preferredTypes.find((type) =>
        MediaRecorder.isTypeSupported(type)
      );
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      setError("");
      setEvidenceId("");
      if (audioUrl.startsWith("blob:")) URL.revokeObjectURL(audioUrl);
      setAudioUrl("");
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setAudioUrl(URL.createObjectURL(blob));
        setUploading(true);
        try {
          const data = new FormData();
          data.set("recording", blob, "speaking-recording");
          const response = await fetch(
            `/api/assignments/${assignmentId}/recordings/${questionId}`,
            { method: "POST", body: data }
          );
          const result = (await response.json()) as {
            evidenceId?: string;
            message?: string;
          };
          if (!response.ok || !result.evidenceId) {
            throw new Error(result.message || "录音上传失败。");
          }
          setEvidenceId(result.evidenceId);
        } catch (uploadError) {
          setEvidenceId("");
          setError(
            uploadError instanceof Error
              ? uploadError.message
              : "录音上传失败，请重新录制。"
          );
        } finally {
          setUploading(false);
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError("无法使用麦克风，请在浏览器地址栏允许本网站访问麦克风。");
    }
  }

  return (
    <div className="app-soft-card rounded-2xl border p-4">
      <input
        type="hidden"
        name={`answer_${questionId}`}
        value={evidenceId}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={toggleRecording}
          disabled={uploading}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          style={{
            backgroundColor: recording
              ? "var(--status-warning)"
              : "var(--primary)",
          }}
        >
          {recording ? <Square size={15} /> : <Mic size={16} />}
          {recording ? "停止录音" : evidenceId ? "重新录音" : "开始录音"}
        </button>
        {audioUrl && <audio controls src={audioUrl} className="h-10 max-w-full" />}
        {uploading && (
          <span className="inline-flex items-center gap-2 text-xs font-bold text-[var(--support)]">
            <UploadCloud size={15} />正在安全上传…
          </span>
        )}
        {evidenceId && !uploading && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--status-success)]">
            <RotateCcw size={14} />录音已就绪，可重新录制
          </span>
        )}
      </div>
      <p className="app-muted-text mt-3 text-xs">
        录完后先试听；显示“录音已就绪”才可提交整份作业。
      </p>
      {error && (
        <p role="alert" className="mt-2 text-xs font-bold text-[var(--destructive)]">
          {error}
        </p>
      )}
    </div>
  );
}
