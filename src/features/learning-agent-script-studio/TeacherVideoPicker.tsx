"use client";

import { useId, useRef, useState, useTransition } from "react";
import type { TeacherVideoBinding } from "@/lib/teaching-video";
import { listTeacherVideosAction, verifyTeacherVideoAction } from "./teacher-video-actions";

type LibraryItem = { key: string; size: number; lastModified: string; uses: string[] };
const buttonClass = "min-h-11 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-50";

export function TeacherVideoPicker({ label, value, transcript, editable, onChange }: {
  label: string; value: TeacherVideoBinding | null | undefined; transcript?: string; editable: boolean;
  onChange: (value: TeacherVideoBinding | null) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [key, setKey] = useState(value?.objectKey ?? "");
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState("");
  const [truncated, setTruncated] = useState(false);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const latestRequest = useRef(0);
  const stale = value && transcript !== undefined && value.transcript.trim() !== transcript.trim();

  function browse() {
    setOpen(true);
    startTransition(async () => {
      setMessage("");
      try {
        const result = await listTeacherVideosAction();
        if (result.ok) { setItems(result.objects); setTruncated(result.isTruncated); }
        else setMessage(result.message);
      } catch { setMessage("读取失败，请重新打开素材库。"); }
    });
  }

  function bind(objectKey: string) {
    const request = ++latestRequest.current;
    startTransition(async () => {
      setMessage("");
      try {
        const result = await verifyTeacherVideoAction(objectKey.trim());
        if (request !== latestRequest.current) return;
        if (!result.ok) { setMessage(result.message); return; }
        onChange({ objectKey: objectKey.trim(), title: objectKey.trim().split("/").at(-1) ?? label, transcript: transcript ?? "" });
        setKey(objectKey.trim()); setPreview(true); setOpen(false); setDuration(null);
      } catch { setMessage("检查失败，请重试。"); }
    });
  }

  return <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4" aria-labelledby={id} data-teacher-video-picker-controls>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 id={id} className="text-sm font-bold">{label}</h4>
      <span className={`text-xs ${stale ? "text-[var(--status-warning)]" : "text-[var(--foreground-secondary)]"}`}>{stale ? "台词已修改，需核对视频" : value ? "已绑定" : "待配置"}</span>
    </div>
    {value && <p className="break-words text-sm">{value.title}{duration !== null ? ` · ${Math.round(duration)} 秒` : ""}</p>}
    <div className="flex flex-wrap gap-2">
      {editable && <button type="button" className={buttonClass} disabled={pending} onClick={browse}>{pending ? "正在检查…" : value ? "更换视频" : "从视频库选择"}</button>}
      {value && <button type="button" className={buttonClass} onClick={() => setPreview((current) => !current)} aria-expanded={preview}>{preview ? "收起预览" : "预览视频"}</button>}
      {value && editable && <button type="button" className={buttonClass} disabled={pending} onClick={() => { latestRequest.current++; onChange(null); setPreview(false); }}>解除绑定</button>}
    </div>
    {preview && value && <video key={value.objectKey} src={`/api/learning-agent/teacher-video?key=${encodeURIComponent(value.objectKey)}`} controls playsInline preload="metadata" aria-label={`${label}预览`} className="aspect-video w-full rounded-lg bg-black" onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onError={() => setMessage("视频无法播放，请检查 MP4 编码或重新上传。")} />}
    {open && <div className="space-y-3 border-t border-[var(--border)] pt-3">
      <div className="flex items-center justify-between gap-3"><strong className="text-sm">教师视频素材库</strong><button type="button" className={buttonClass} onClick={() => setOpen(false)}>关闭</button></div>
      <label className="block space-y-1 text-sm"><span>搜索视频名称</span><input value={filter} onChange={(event) => { event.stopPropagation(); setFilter(event.target.value); }} className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3" /></label>
      <div className="max-h-72 space-y-2 overflow-y-auto">
        {items.filter((item) => item.key.toLowerCase().includes(filter.toLowerCase())).map((item) => <button key={item.key} type="button" disabled={pending} onClick={() => bind(item.key)} className={`${buttonClass} block w-full py-3 text-left`}><span className="block break-words">{item.key.slice("teacher-video/".length)}</span><span className="mt-1 block text-xs font-normal text-[var(--foreground-secondary)]">{(item.size / 1024 / 1024).toFixed(1)} MB · {item.uses.length ? `使用于 ${item.uses.join("、")}` : "尚未绑定"}</span></button>)}
        {!pending && !items.length && <p className="text-sm text-[var(--foreground-secondary)]">还没有教师视频。将 HeyGen 导出的 MP4 上传到 R2 的 teacher-video/ 目录后刷新。</p>}
      </div>
      {truncated && <p className="text-xs">当前显示前 1000 个文件，未列出的文件可通过完整路径绑定。</p>}
      <details><summary className="min-h-11 cursor-pointer text-sm leading-[2.75rem]">通过文件路径绑定</summary><label className="block space-y-1 text-sm"><span>R2 文件路径</span><input value={key} onChange={(event) => { event.stopPropagation(); setKey(event.target.value); }} placeholder="teacher-video/chapter-01/opening.mp4" className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3" /></label><button type="button" disabled={pending || !key.trim()} className={`${buttonClass} mt-2`} onClick={() => bind(key)}>检查并绑定</button></details>
      <button type="button" disabled={pending} className={buttonClass} onClick={browse}>刷新素材库</button>
    </div>}
    {message && <p role="alert" className="text-sm text-[var(--status-danger)]">{message}</p>}
  </div>;
}
