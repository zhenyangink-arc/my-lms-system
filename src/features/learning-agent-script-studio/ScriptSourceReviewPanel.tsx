"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import { confirmScriptSourceReview, loadScriptSourceReview, type ScriptSourceReview } from "./source-review-actions";

const labels: Record<string, string> = { vocabulary: "词汇", grammar: "语法", ko: "韩语", zh: "中文", title: "标题", meaning: "含义", examples: "例句", caution: "注意事项", prompt: "题目", answer_key: "答案", transcript_ko: "听力原文", options: "选项", explanation: "说明", content: "内容", "zh-CN": "中文", "ko-KR": "韩语" };
function contentLines(value: unknown, path = ""): string[] {
  if (typeof value === "string") return value.trim() ? [`${path}：${value}`] : [];
  if (Array.isArray(value)) return value.flatMap((item, index) => contentLines(item, `${path} ${index + 1}`));
  if (value && typeof value === "object") return Object.entries(value).filter(([key]) => !["id", "node_id", "module_id", "chapter_id", "created_at", "updated_at"].includes(key)).flatMap(([key, item]) => contentLines(item, `${path}${path ? " / " : ""}${labels[key] ?? key}`));
  return value == null ? [] : [`${path}：${String(value)}`];
}
function SourceContents({ source, title }: { source: Record<string, unknown>; title: string }) {
  return <details className="min-w-0 rounded-md border border-[var(--border)] p-3">
    <summary className="cursor-pointer text-sm font-medium">{title}</summary>
    <div className="max-h-80 space-y-2 overflow-auto break-words pt-3 text-sm whitespace-pre-wrap">
      {contentLines(source.module, "模块").map((line, index) => <p key={`m:${index}`}>{line}</p>)}
      {contentLines(source.nodes, "教材内容").map((line, index) => <p key={`n:${index}`}>{line}</p>)}
      {contentLines(source.activities, "教材活动").map((line, index) => <p key={`a:${index}`}>{line}</p>)}
      {contentLines(source.activityAnswers, "活动答案与解析").map((line, index) => <p key={`s:${index}`}>{line}</p>)}
    </div>
  </details>;
}
export function ScriptSourceReviewPanel({ versionId, disabled, archived }: { versionId: string; disabled: boolean; archived: boolean }) {
  const [review, setReview] = useState<ScriptSourceReview | null>(null);
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function load() {
    startTransition(async () => {
      try {
        const result = await loadScriptSourceReview(versionId);
        setConfirmed(false);
        if (result.ok) { setReview(result.review); setMessage(""); }
        else { setReview(null); setMessage(result.message); }
      } catch { setReview(null); setMessage("读取失败，请重试。"); }
    });
  }
  function confirm() {
    if (!review || !confirmed || disabled) return;
    startTransition(async () => {
      try {
        const result = await confirmScriptSourceReview({ versionId, review });
        setMessage(result.message); setConfirmed(false);
        if (result.ok) { setReview(null); router.refresh(); }
      } catch { setMessage("保存失败，请重试。"); }
    });
  }
  return <section className="space-y-3 rounded-lg border border-[var(--border)] p-4">
    <CardTitleWithHint headingLevel={2} title="教材与脚本复核" description="对照教材内容和活动，确认当前脚本的讲解、提问及反馈仍然适用。教材或脚本变化后需重新复核；发布时会再次校验。历史已发布脚本不会自动下架。" />
    <button type="button" disabled={disabled || pending} onClick={load} className="min-h-11 rounded-md border px-3 text-sm disabled:opacity-50">{pending ? "正在处理…" : review ? "重新读取最新内容" : "读取复核内容"}</button>
    {disabled && <p className="text-sm">请先保存当前脚本修改，再进行复核。</p>}
    {review && <>
      <p role="status" className="text-sm">{review.status === "unreviewed" ? "此脚本尚未建立复核记录。" : review.status === "reviewed" ? "已复核，教材与脚本均未变化。" : `${review.sourceChanged ? "教材内容或活动已变化。" : ""}${review.scriptChanged ? "脚本已变化。" : ""}请重新核对。`}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {review.previousSource && <SourceContents source={review.previousSource} title="上次复核的教材内容" />}
        <SourceContents source={review.source} title="当前教材内容" />
      </div>
      {!archived && review.status !== "reviewed" && <>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={disabled || pending} onChange={event => setConfirmed(event.target.checked)} className="mt-1" />我已对照教材内容与活动，核对当前脚本的讲解、提问、反馈和后续路径。</label>
        <button type="button" onClick={confirm} disabled={!confirmed || disabled || pending} className="min-h-11 rounded-md border px-3 text-sm disabled:opacity-50">确认复核</button>
      </>}
    </>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
