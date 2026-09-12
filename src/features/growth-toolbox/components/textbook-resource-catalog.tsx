"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import { grammarResourceKey, vocabularyResourceKey, type TextbookPracticeResource } from "@/lib/textbook-practice-resources";
import type { GrowthToolboxVocabularyItem, GrowthToolboxGrammarItem } from "../api/types";

const CopyWordDialog = dynamic(() => import("./growth-toolbox-action-dialogs").then(m => m.CreateVocabularyDialog), { loading: () => <p role="status">正在打开复制草稿…</p> });
const CopyGrammarDialog = dynamic(() => import("./growth-toolbox-action-dialogs").then(m => m.CreateGrammarDialog), { loading: () => <p role="status">正在打开复制草稿…</p> });

export function TextbookResourceCatalog({ resources, vocabulary, grammar, studentAppId, canManage }: {
  resources: TextbookPracticeResource[];
  vocabulary: GrowthToolboxVocabularyItem[];
  grammar: GrowthToolboxGrammarItem[];
  studentAppId: string;
  canManage: boolean;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [selected, setSelected] = useState<TextbookPracticeResource | null>(null);
  const wordKeys = useMemo(() => new Set(vocabulary.map(vocabularyResourceKey)), [vocabulary]);
  const grammarKeys = useMemo(() => new Set(grammar.map(grammarResourceKey)), [grammar]);
  const filtered = resources.filter(resource => (kind === "all" || resource.kind === kind) &&
    `${resource.origin} ${resource.kind === "vocabulary" ? `${resource.value.ko} ${resource.value.zh}` : `${resource.value.title} ${resource.value.meaning}`}`.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <section className="space-y-3 rounded-lg border border-[var(--border)] p-4">
      <CardTitleWithHint headingLevel={2} title="教材原文" description="只读查看已发布教材中的词汇与语法，不代表已加入练习。复制只打开草稿，确认保存后才新增独立资源；不会与教材自动同步。已有副本不自动合并。" />
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs">查找教材内容
          <input className="app-input h-9 rounded-md border px-3" value={query} onChange={event => setQuery(event.target.value)} placeholder="课程、章节、词汇或语法" />
        </label>
        <label className="grid gap-1 text-xs">内容类型
          <select className="app-input h-9 rounded-md border px-3" value={kind} onChange={event => setKind(event.target.value)}>
            <option value="all">全部</option><option value="vocabulary">词汇</option><option value="grammar">语法</option>
          </select>
        </label>
        <p className="text-xs" role="status">共 {filtered.length} 条{filtered.length > 30 ? "，显示前 30 条，请搜索缩小范围" : ""}</p>
      </div>
      {!filtered.length && <p className="text-sm text-[var(--foreground-muted)]">没有匹配的已发布教材内容。草稿或下架章节不会出现在这里。</p>}
      <ul className="divide-y divide-[var(--border)]">
        {filtered.slice(0, 30).map(resource => {
          const duplicate = resource.kind === "vocabulary" ? wordKeys.has(vocabularyResourceKey(resource.value)) : grammarKeys.has(grammarResourceKey(resource.value));
          return <li key={resource.key} className="flex items-start justify-between gap-4 py-3">
            <div className="min-w-0 space-y-1">
              <p className="text-xs text-[var(--foreground-muted)]">{resource.origin} · 只读</p>
              <p className="text-sm font-semibold">{resource.kind === "vocabulary" ? `${resource.value.ko} · ${resource.value.zh}` : `${resource.value.title} · ${resource.value.meaning}`}</p>
              <details className="text-xs"><summary className="cursor-pointer py-1">查看完整内容</summary>
                <dl className="space-y-2 whitespace-pre-wrap py-2">
                  {resource.kind === "vocabulary" ? <>
                    <div><dt>词性</dt><dd>{resource.value.pos || "未填写"}</dd></div>
                    <div><dt>搭配与说明</dt><dd>{resource.value.collocation || "未填写"}</dd></div>
                    <div><dt>音标</dt><dd>{resource.value.transcription || "未填写"}</dd></div>
                  </> : <>
                    <div><dt>收音情况</dt><dd>{resource.value.cases.map(row => `${row.batchim}：${row.conjugation}`).join("\n") || "未填写"}</dd></div>
                    <div><dt>形态组合</dt><dd>{resource.value.rows.map(row => `${row.form}：${row.combination}${row.audio ? "（含音频）" : ""}`).join("\n") || "未填写"}</dd></div>
                    <div><dt>例句</dt><dd>{resource.value.examples.map(row => `${row.ko} · ${row.zh}${row.audio ? "（含音频）" : ""}`).join("\n") || "未填写"}</dd></div>
                    <div><dt>注意事项</dt><dd>{resource.value.caution || "未填写"}</dd></div>
                  </>}
                </dl>
              </details>
            </div>
            {duplicate ? <span className="shrink-0 text-xs">练习库已有相同内容</span> : canManage && <button type="button" disabled={selected !== null} onClick={() => setSelected(resource)} className="shrink-0 rounded-md border border-[var(--border)] px-3 py-2 text-xs disabled:opacity-50">复制为独立资源</button>}
          </li>;
        })}
      </ul>
      {selected?.kind === "vocabulary" && <CopyWordDialog key={selected.key} studentAppId={studentAppId} initialValue={selected.value} originLabel={selected.origin} autoOpen onClosed={() => setSelected(null)} />}
      {selected?.kind === "grammar" && <CopyGrammarDialog key={selected.key} studentAppId={studentAppId} initialValue={selected.value} originLabel={selected.origin} autoOpen onClosed={() => setSelected(null)} />}
    </section>
  );
}
