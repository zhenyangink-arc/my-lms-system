"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import { practiceSnapshotChanged, type ChapterPracticeBinding, type PracticeSnapshotItem } from "@/lib/chapter-practice-binding";
import { reviewChapterPracticeAction } from "../api/chapter-practice-actions";

const fieldNames: Record<string, string> = {
  ko: "韩语", zh: "中文", pos: "词性", collocation: "搭配", transcription: "音标",
  title: "语法", meaning: "含义", cases: "收音情况", batchim: "收音", conjugation: "变化",
  rows: "形态", form: "形式", combination: "组合", audio: "音频", examples: "例句", caution: "注意事项",
};
function showValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(showValue).join("\n");
  if (value && typeof value === "object") return Object.entries(value).map(([key, val]) => `${fieldNames[key] ?? key}：${showValue(val)}`).join("；");
  return String(value ?? "");
}
function Snapshot({ title, items }: { title: string; items: PracticeSnapshotItem[] }) {
  return <details className="min-w-0 rounded-md border p-3">
    <summary className="cursor-pointer text-sm">{title} · {items.filter(item => item.kind === "vocabulary").length} 个词汇、{items.filter(item => item.kind === "grammar").length} 条语法</summary>
    <ol className="max-h-96 list-decimal space-y-3 overflow-auto break-words pl-5 pt-3 text-sm">
      {items.map((item, index) => <li key={`${item.nodeId}:${item.kind}:${index}`} className="whitespace-pre-wrap">{showValue(item.value)}</li>)}
    </ol>
  </details>;
}
export function ChapterPracticeBindingPanel({ appId, chapterId, current, binding, available }: {
  appId: string; chapterId: string; current: PracticeSnapshotItem[] | null;
  binding: ChapterPracticeBinding | null; available: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const changed = binding && current ? practiceSnapshotChanged(binding.snapshot, current) : false;
  const [confirmed, setConfirmed] = useState(false);
  const enabled = binding?.is_enabled === true;
  const needsApproval = !enabled || changed;
  function save(nextEnabled: boolean) {
    startTransition(async () => {
      try {
        const result = await reviewChapterPracticeAction({ appId, chapterId, revision: binding?.revision ?? 0, snapshot: current ?? [], enabled: nextEnabled });
        setMessage(result.message);
        if (result.ok) { setConfirmed(false); router.refresh(); }
      } catch { setMessage("暂时无法保存，请检查连接后重试。"); }
    });
  }
  return <section className="space-y-3 rounded-lg border border-[var(--border)] p-4">
    <CardTitleWithHint headingLevel={2} title="本章教材练习引用" description="按所选章节和教材版本保存已核对的内容。教材修改只提示复核，不自动覆盖练习。词汇用于单词练习；语法保留为关联材料，不会自动生成题目。教材下架、版本归档或引用停用后，学生不再读取此引用。独立副本不受影响。" />
    {!available ? <p role="status" className="text-sm">章节练习关联暂不可用，现有独立资源仍可使用。</p> : <>
      <p className="text-sm">{!current ? "当前教材来源未发布或已不可用。" : !binding ? "尚未关联本章教材。" : !enabled ? "引用已停用。" : changed ? "教材内容已变化，待复核；学生仍使用上次确认的内容。" : "已关联，内容与上次确认一致。"}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {binding && <Snapshot title="上次确认的内容" items={binding.snapshot} />}
        {current && <Snapshot title="当前教材内容" items={current} />}
      </div>
      {current && current.length > 0 && needsApproval && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={pending} className="mt-1" />我已核对完整内容，确认用于本章练习。</label>}
      <div className="flex flex-wrap gap-2">
        {current && current.length > 0 && needsApproval && <button type="button" disabled={pending || !confirmed} onClick={() => save(true)} className="min-h-11 rounded-md border px-3 text-sm disabled:opacity-50">{pending ? "正在保存…" : enabled ? "确认更新练习引用" : "确认关联到练习"}</button>}
        {enabled && <button type="button" disabled={pending} onClick={() => save(false)} className="min-h-11 rounded-md border px-3 text-sm disabled:opacity-50">停用教材引用</button>}
      </div>
    </>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
