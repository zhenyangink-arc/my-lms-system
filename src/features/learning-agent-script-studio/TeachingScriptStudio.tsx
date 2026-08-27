"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { usePathname } from "next/navigation";
import { ArrowDown, ArrowUp, FilePenLine, Plus, Trash2, X } from "lucide-react";

import {
  addTeachingScriptNodeAction,
  createTeachingScriptDraftAction,
  deleteTeachingScriptNodeAction,
  moveTeachingScriptNodeAction,
  publishTeachingScriptAction,
} from "@/app/dashboard/admin/teaching-scripts/actions";
import { TeachingScriptNodeForm } from "./TeachingScriptNodeForm";
import type { TeachingScriptStudioData } from "./types";

const moduleLabels: Record<string, string> = {
  orientation: "课前导航",
  vocabulary: "核心词汇",
  grammar: "语法讲解",
  patterns: "句型操练",
  dialogue: "实战对话",
  listen_speak: "听说任务",
  read_write: "读写扩展",
  review: "自测与复盘",
};

const nodeTypeLabels: Record<string, string> = {
  opening: "开场",
  instruction: "引导",
  explanation: "讲解",
  example: "示范",
  question: "提问",
  summary: "总结",
};

function CreateDraftButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-10 items-center gap-1.5 border border-[var(--primary)] bg-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary-foreground)] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
    >
      <FilePenLine size={14} aria-hidden="true" />
      {pending ? "正在准备编辑版本…" : "编辑已发布版本"}
    </button>
  );
}

export function TeachingScriptStudio({ data }: { data: TeachingScriptStudioData }) {
  const pathname = usePathname();
  const firstModule = data.modules.find((item) => item.chapterNumber === 1 && item.code === "orientation") ?? data.modules[0];
  const [moduleId, setModuleId] = useState(firstModule?.id ?? "");
  const selectedModule = data.modules.find((item) => item.id === moduleId) ?? firstModule;
  const draft = selectedModule?.versions.find((item) => item.status === "draft");
  const published = selectedModule?.versions.find((item) => item.status === "published");
  const [versionId, setVersionId] = useState(draft?.id ?? published?.id ?? "");
  const selectedVersion = selectedModule?.versions.find((item) => item.id === versionId) ?? draft ?? published ?? selectedModule?.versions[0];
  const [nodeId, setNodeId] = useState(selectedVersion?.nodes[0]?.id ?? "");
  const selectedNode = selectedVersion?.nodes.find((item) => item.id === nodeId) ?? selectedVersion?.nodes[0];
  const [editorOpen, setEditorOpen] = useState(false);
  const editorDialogRef = useRef<HTMLElement>(null);
  const closeEditorButtonRef = useRef<HTMLButtonElement>(null);
  const nodeTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const nextVersion = selectedModule?.versions.find((item) => item.status === "draft")
      ?? selectedModule?.versions.find((item) => item.status === "published")
      ?? selectedModule?.versions[0];
    setVersionId(nextVersion?.id ?? "");
    setNodeId(nextVersion?.nodes[0]?.id ?? "");
    setEditorOpen(false);
  }, [moduleId, selectedModule]);

  useEffect(() => {
    setNodeId(selectedVersion?.nodes[0]?.id ?? "");
    setEditorOpen(false);
  }, [versionId, selectedVersion]);

  useEffect(() => {
    if (!editorOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeEditorButtonRef.current?.focus();
    const handleDialogKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEditorOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(editorDialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
      ) ?? [])].filter((element) => !element.hidden && element.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleDialogKeyboard);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleDialogKeyboard);
      nodeTriggerRef.current?.focus();
    };
  }, [editorOpen]);

  const chapters = useMemo(() => {
    const grouped = new Map<number, typeof data.modules>();
    for (const module of data.modules) {
      const items = grouped.get(module.chapterNumber) ?? [];
      items.push(module);
      grouped.set(module.chapterNumber, items);
    }
    return [...grouped.entries()].sort(([left], [right]) => left - right);
  }, [data.modules]);

  if (!selectedModule) {
    return <div className="border bg-[var(--card)] px-6 py-12 text-center text-sm">当前应用还没有可编排的互动教材。</div>;
  }

  const returnTo = pathname;
  const editable = selectedVersion?.status === "draft";

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center justify-between gap-3 border bg-[var(--card)] px-4 py-3" aria-label="脚本版本工具栏">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-semibold">{selectedModule.textbookTitle["zh-CN"]}</span>
          <span className="app-muted-text">第 {selectedModule.chapterNumber} 章</span>
          <span>{moduleLabels[selectedModule.code] ?? selectedModule.title["zh-CN"]}</span>
          {selectedVersion && <span className="border px-2 py-1 font-medium">版本 {selectedVersion.number} · {selectedVersion.status === "draft" ? "草稿" : selectedVersion.status === "published" ? "已发布" : "已归档"}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedModule.versions.length > 1 && (
            <label className="flex items-center gap-2 text-xs"><span>查看版本</span><select value={versionId} onChange={(event) => setVersionId(event.target.value)} className="app-input h-9 border px-2.5">{selectedModule.versions.map((version) => <option key={version.id} value={version.id}>版本 {version.number} · {version.status === "draft" ? "草稿" : version.status === "published" ? "已发布" : "已归档"}</option>)}</select></label>
          )}
          {selectedVersion?.status === "published" && draft && (
            <button
              type="button"
              onClick={() => {
                setVersionId(draft.id);
                setNodeId(draft.nodes[0]?.id ?? "");
              }}
              className="inline-flex min-h-10 items-center gap-1.5 border border-[var(--primary)] bg-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary-foreground)] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
            >
              <FilePenLine size={14} aria-hidden="true" />继续编辑草稿
            </button>
          )}
          {selectedVersion?.status === "published" && !draft && selectedModule.lessonId && (
            <form action={createTeachingScriptDraftAction}>
              <input type="hidden" name="lesson_id" value={selectedModule.lessonId} />
              <input type="hidden" name="return_to" value={returnTo} />
              <CreateDraftButton />
            </form>
          )}
        </div>
      </section>

      <div className="grid min-h-[660px] overflow-hidden border bg-[var(--card)] lg:grid-cols-[20rem_minmax(0,1fr)]">
        <nav className="border-b bg-[var(--muted)]/45 lg:border-b-0 lg:border-r" aria-label="教材章节与板块">
          <div className="border-b px-4 py-3"><h2 className="text-sm font-semibold">教材位置</h2></div>
          <div className="max-h-[720px] overflow-y-auto p-2">
            {chapters.map(([chapterNumber, modules]) => (
              <section key={chapterNumber} className="mb-3">
                <h3 className="px-2 py-1.5 text-[11px] font-semibold text-[var(--muted-foreground)]">第 {chapterNumber} 章 · {modules[0]?.chapterTitle["zh-CN"]}</h3>
                <div className="space-y-1">
                  {modules.map((module) => (
                    <button key={module.id} type="button" onClick={() => setModuleId(module.id)} aria-current={module.id === selectedModule.id ? "page" : undefined} className={`flex min-h-10 w-full items-center justify-between gap-2 px-3 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] ${module.id === selectedModule.id ? "bg-[var(--accent)] font-semibold text-[var(--accent-foreground)]" : "hover:bg-[var(--card)]"}`}>
                      <span>{moduleLabels[module.code] ?? module.title["zh-CN"]}</span>
                      <span className="tabular-nums text-[10px] text-[var(--muted-foreground)]">{module.versions.find((version) => version.status === "published")?.nodes.length ?? 0}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </nav>

        <section className="border-b lg:border-b-0 lg:border-r" aria-labelledby="teaching-flow-title">
          <div className="flex min-h-12 items-center justify-between gap-2 border-b px-4 py-2">
            <h2 id="teaching-flow-title" className="text-sm font-semibold">教学流程</h2>
            {editable && selectedVersion && (
              <form action={addTeachingScriptNodeAction}><input type="hidden" name="version_id" value={selectedVersion.id} /><input type="hidden" name="return_to" value={returnTo} /><button type="submit" className="inline-flex min-h-8 items-center gap-1 border px-2.5 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"><Plus size={13} aria-hidden="true" />新增节点</button></form>
            )}
          </div>
          {!selectedVersion ? (
            <div className="p-6 text-center text-xs text-[var(--muted-foreground)]">当前板块还没有教学脚本版本。</div>
          ) : (
            <ol className="max-h-[720px] overflow-y-auto p-3">
              {selectedVersion.nodes.map((node, index) => {
                const display = node.configuration.display;
                const hasDisplay = Boolean(display && typeof display === "object" && !Array.isArray(display));
                const hasTeacherScript = Boolean(node.script["zh-CN"].trim());
                return (
                <li key={node.id} className="relative flex gap-2 pb-3 last:pb-0">
                  {index < selectedVersion.nodes.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px bg-[var(--border)]" aria-hidden="true" />}
                  <button type="button" onClick={(event) => { nodeTriggerRef.current = event.currentTarget; setNodeId(node.id); setEditorOpen(true); }} aria-haspopup="dialog" aria-current={node.id === selectedNode?.id ? "step" : undefined} className={`relative z-10 flex min-h-14 min-w-0 flex-1 items-start gap-3 border px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${node.id === selectedNode?.id ? "border-[var(--primary)] bg-[var(--accent)]" : "bg-[var(--card)] hover:bg-[var(--muted)]/50"}`}>
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full border bg-[var(--card)] text-[10px] font-semibold tabular-nums">{String(node.order).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">{node.title["zh-CN"]}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="app-muted-text">{nodeTypeLabels[node.type]}</span>
                        <span className={hasDisplay ? "text-[var(--status-success)]" : "text-[var(--foreground-muted)]"}>{hasDisplay ? "展示已填" : "展示待填"}</span>
                        <span className={hasTeacherScript ? "text-[var(--status-success)]" : "text-[var(--foreground-muted)]"}>{hasTeacherScript ? "讲解已填" : "讲解待填"}</span>
                      </span>
                    </span>
                  </button>
                  {editable && (
                    <div className="flex w-8 shrink-0 flex-col gap-1">
                      <form action={moveTeachingScriptNodeAction}><input type="hidden" name="node_id" value={node.id} /><input type="hidden" name="direction" value="up" /><input type="hidden" name="return_to" value={returnTo} /><button type="submit" disabled={index === 0} aria-label={`上移${node.title["zh-CN"]}`} className="flex size-8 items-center justify-center border disabled:opacity-30"><ArrowUp size={12} aria-hidden="true" /></button></form>
                      <form action={moveTeachingScriptNodeAction}><input type="hidden" name="node_id" value={node.id} /><input type="hidden" name="direction" value="down" /><input type="hidden" name="return_to" value={returnTo} /><button type="submit" disabled={index === selectedVersion.nodes.length - 1} aria-label={`下移${node.title["zh-CN"]}`} className="flex size-8 items-center justify-center border disabled:opacity-30"><ArrowDown size={12} aria-hidden="true" /></button></form>
                    </div>
                  )}
                </li>
                );
              })}
            </ol>
          )}
        </section>

      </div>

      {editorOpen && selectedNode && selectedVersion && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditorOpen(false); }}>
          <section ref={editorDialogRef} role="dialog" aria-modal="true" aria-labelledby="node-editor-dialog-title" className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[1400px] flex-col overflow-hidden border border-[var(--border)] bg-[var(--card)] shadow-2xl">
            <header className="flex min-h-16 shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] px-6 py-3">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-3">
                  <h2 id="node-editor-dialog-title" className="truncate text-base font-bold text-[var(--foreground)]">编辑节点 {selectedNode.order}：{selectedNode.title["zh-CN"]}</h2>
                  <span className={`shrink-0 border px-2 py-1 text-[10px] font-semibold ${editable ? "border-[var(--status-warning)] text-[var(--status-warning)]" : "border-[var(--border)] text-[var(--foreground-muted)]"}`}>{editable ? "草稿编辑中" : "已发布 · 只读"}</span>
                </div>
                <p className="app-muted-text mt-1 text-[11px]">{moduleLabels[selectedModule.code] ?? selectedModule.title["zh-CN"]} · 编辑内容将同步对应学生端教学展示和老师讲解</p>
              </div>
              <button ref={closeEditorButtonRef} type="button" onClick={() => setEditorOpen(false)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-[var(--border)] text-[var(--foreground-muted)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" aria-label="关闭节点编辑窗口"><X size={18} aria-hidden="true" /></button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-6 lg:p-8">
              <TeachingScriptNodeForm key={selectedNode.id} node={selectedNode} allNodes={selectedVersion.nodes} activities={selectedModule.activities} returnTo={returnTo} editable={editable} />
              {editable && selectedVersion.nodes.length > 1 && (
                <form action={deleteTeachingScriptNodeAction} onSubmit={(event) => { if (!window.confirm(`确定删除“${selectedNode.title["zh-CN"]}”吗？`)) event.preventDefault(); }} className="mt-6 border-t pt-4">
                  <input type="hidden" name="node_id" value={selectedNode.id} /><input type="hidden" name="return_to" value={returnTo} />
                  <button type="submit" className="inline-flex min-h-10 items-center gap-1.5 border border-[var(--destructive)] px-3 text-xs font-semibold text-[var(--destructive)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destructive)]"><Trash2 size={13} aria-hidden="true" />删除节点</button>
                </form>
              )}
            </div>
          </section>
        </div>
      )}

      {editable && selectedVersion && (
        <section className="flex flex-wrap items-end justify-between gap-4 border bg-[var(--card)] px-4 py-3">
          <div><h2 className="text-sm font-semibold">发布草稿</h2><p className="app-muted-text mt-1 text-[11px]">发布前会检查台词、节点引用和流程连接；学生进入新会话后使用新版本。</p></div>
          <form action={publishTeachingScriptAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="version_id" value={selectedVersion.id} /><input type="hidden" name="return_to" value={returnTo} />
            <label className="space-y-1 text-[11px] font-medium"><span className="block">修改说明</span><input name="change_note" maxLength={500} placeholder="说明本次调整内容" className="app-input h-9 w-72 border px-3 text-xs" /></label>
            <button type="submit" className="min-h-9 bg-[var(--primary)] px-4 text-xs font-semibold text-[var(--primary-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2">校验并发布</button>
          </form>
        </section>
      )}
    </div>
  );
}
