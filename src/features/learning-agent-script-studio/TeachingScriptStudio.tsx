"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { usePathname } from "next/navigation";
import { ArrowDown, ArrowUp, FilePenLine, Plus, Trash2 } from "lucide-react";

import {
  addTeachingScriptNodeAction,
  createTeachingScriptDraftAction,
  deleteTeachingScriptNodeAction,
  moveTeachingScriptNodeAction,
  publishTeachingScriptAction,
} from "@/app/dashboard/admin/teaching-scripts/actions";
import { TeachingScriptNodeForm } from "./TeachingScriptNodeForm";
import type { TeachingScriptModule, TeachingScriptStudioData } from "./types";

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

function versionLabel(status: string) {
  if (status === "draft") return "草稿";
  if (status === "published") return "已发布";
  return "已归档";
}

function preferredVersion(lessonModule?: TeachingScriptModule) {
  return lessonModule?.versions.find((item) => item.status === "draft")
    ?? lessonModule?.versions.find((item) => item.status === "published")
    ?? lessonModule?.versions[0];
}

function CreateDraftButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center gap-2 border border-[var(--primary)] bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">
      <FilePenLine size={16} aria-hidden="true" />
      {pending ? "正在准备草稿…" : "编辑已发布版本"}
    </button>
  );
}

export function TeachingScriptStudio({ data }: { data: TeachingScriptStudioData }) {
  const pathname = usePathname();
  const firstModule = data.modules.find((item) => item.chapterNumber === 1 && item.code === "orientation") ?? data.modules[0];
  const [moduleId, setModuleId] = useState(firstModule?.id ?? "");
  const selectedModule = data.modules.find((item) => item.id === moduleId) ?? firstModule;
  const preferred = preferredVersion(selectedModule);
  const [versionId, setVersionId] = useState(preferred?.id ?? "");
  const selectedVersion = selectedModule?.versions.find((item) => item.id === versionId) ?? preferred;
  const [nodeId, setNodeId] = useState(selectedVersion?.nodes[0]?.id ?? "");
  const selectedNode = selectedVersion?.nodes.find((item) => item.id === nodeId) ?? selectedVersion?.nodes[0];

  const chapters = useMemo(() => {
    const grouped = new Map<number, TeachingScriptModule[]>();
    for (const lessonModule of data.modules) {
      const items = grouped.get(lessonModule.chapterNumber) ?? [];
      items.push(lessonModule);
      grouped.set(lessonModule.chapterNumber, items);
    }
    return [...grouped.entries()].sort(([left], [right]) => left - right);
  }, [data.modules]);

  if (!selectedModule) {
    return <div className="border bg-[var(--card)] px-6 py-12 text-center text-sm">当前应用还没有可编排的互动教材。</div>;
  }

  const returnTo = pathname;
  const draft = selectedModule.versions.find((item) => item.status === "draft");
  const editable = selectedVersion?.status === "draft";

  function selectLearningStep(nextModuleId: string) {
    const nextModule = data.modules.find((item) => item.id === nextModuleId);
    const nextVersion = preferredVersion(nextModule);
    setModuleId(nextModuleId);
    setVersionId(nextVersion?.id ?? "");
    setNodeId(nextVersion?.nodes[0]?.id ?? "");
  }

  function selectVersion(nextVersionId: string) {
    const nextVersion = selectedModule.versions.find((item) => item.id === nextVersionId);
    setVersionId(nextVersionId);
    setNodeId(nextVersion?.nodes[0]?.id ?? "");
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center justify-between gap-4 border bg-[var(--card)] px-4 py-3" aria-label="教学脚本版本工具栏">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <strong>{selectedModule.textbookTitle["zh-CN"]}</strong>
            <span className="app-muted-text">第 {selectedModule.chapterNumber} 章</span>
            <span>{moduleLabels[selectedModule.code] ?? selectedModule.title["zh-CN"]}</span>
            {selectedVersion && <span className="border px-2 py-1 text-xs font-medium">版本 {selectedVersion.number} · {versionLabel(selectedVersion.status)}</span>}
          </div>
          <p className="app-muted-text mt-1 text-xs leading-5">每个学习步骤的教学小节、老师台词、展示内容和互动顺序都由你自行编排。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedModule.versions.length > 1 && (
            <label className="flex min-h-11 items-center gap-2 text-sm"><span>查看版本</span><select value={selectedVersion?.id ?? ""} onChange={(event) => selectVersion(event.target.value)} className="app-input h-11 border px-3">{selectedModule.versions.map((version) => <option key={version.id} value={version.id}>版本 {version.number} · {versionLabel(version.status)}</option>)}</select></label>
          )}
          {selectedVersion?.status === "published" && draft && <button type="button" onClick={() => { setVersionId(draft.id); setNodeId(draft.nodes[0]?.id ?? ""); }} className="inline-flex min-h-11 items-center gap-2 border border-[var(--primary)] bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"><FilePenLine size={16} aria-hidden="true" />继续编辑草稿</button>}
          {selectedVersion?.status === "published" && !draft && selectedModule.lessonId && <form action={createTeachingScriptDraftAction}><input type="hidden" name="lesson_id" value={selectedModule.lessonId} /><input type="hidden" name="return_to" value={returnTo} /><CreateDraftButton /></form>}
        </div>
      </section>

      <div className="grid min-h-[760px] border bg-[var(--card)] lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_19rem_minmax(0,1fr)]">
        <nav className="border-b bg-[var(--muted)]/35 lg:border-r xl:border-b-0" aria-label="章节与学习步骤">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-bold">章节与学习步骤</h2>
            <p className="app-muted-text mt-1 text-xs">每章包含 8 个教材步骤</p>
          </div>
          <div className="max-h-[720px] overflow-y-auto p-2">
            {chapters.map(([chapterNumber, modules]) => (
              <section key={chapterNumber} className="mb-4">
                <h3 className="px-2 py-2 text-xs font-semibold text-[var(--muted-foreground)]">第 {chapterNumber} 章 · {modules[0]?.chapterTitle["zh-CN"]}</h3>
                <div className="space-y-1">
                  {modules.map((lessonModule) => {
                    const version = preferredVersion(lessonModule);
                    const selected = lessonModule.id === selectedModule.id;
                    return (
                      <button key={lessonModule.id} type="button" onClick={() => selectLearningStep(lessonModule.id)} aria-current={selected ? "page" : undefined} className={`flex min-h-12 w-full items-center justify-between gap-3 border px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] ${selected ? "border-[var(--primary)] bg-[var(--accent)] font-semibold" : "border-transparent hover:bg-[var(--card)]"}`}>
                        <span className="min-w-0"><span className="block truncate">{moduleLabels[lessonModule.code] ?? lessonModule.title["zh-CN"]}</span><span className="mt-0.5 block text-xs font-normal text-[var(--muted-foreground)]">{version?.nodes.length ?? 0} 个教学小节</span></span>
                        <span className="shrink-0 tabular-nums text-xs text-[var(--muted-foreground)]">{lessonModule.order}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </nav>

        <section className="border-b lg:border-b-0 xl:border-r" aria-labelledby="teaching-flow-title">
          <div className="flex min-h-16 items-center justify-between gap-3 border-b px-4 py-3">
            <div><h2 id="teaching-flow-title" className="text-sm font-bold">自定义教学流程</h2><p className="app-muted-text mt-1 text-xs">按你的课堂节奏安排小节</p></div>
            {editable && selectedVersion && <form action={addTeachingScriptNodeAction}><input type="hidden" name="version_id" value={selectedVersion.id} /><input type="hidden" name="return_to" value={returnTo} /><button type="submit" className="inline-flex min-h-11 items-center gap-1.5 border border-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"><Plus size={15} aria-hidden="true" />新增小节</button></form>}
          </div>
          {!selectedVersion ? (
            <div className="p-8 text-center text-sm text-[var(--muted-foreground)]">当前学习步骤还没有教学脚本。</div>
          ) : (
            <ol className="max-h-[696px] overflow-y-auto p-3">
              {selectedVersion.nodes.map((node, index) => {
                const interaction = node.configuration.interaction;
                const hasInteraction = Boolean(interaction && typeof interaction === "object" && !Array.isArray(interaction));
                const selected = node.id === selectedNode?.id;
                return (
                  <li key={node.id} className="relative flex gap-2 pb-3 last:pb-0">
                    {index < selectedVersion.nodes.length - 1 && <span className="absolute left-[17px] top-10 h-[calc(100%-1.25rem)] w-px bg-[var(--border)]" aria-hidden="true" />}
                    <button type="button" onClick={() => setNodeId(node.id)} aria-current={selected ? "step" : undefined} className={`relative z-10 flex min-h-16 min-w-0 flex-1 items-start gap-3 border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${selected ? "border-[var(--primary)] bg-[var(--accent)]" : "bg-[var(--card)] hover:bg-[var(--muted)]/45"}`}>
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-[var(--card)] text-xs font-bold tabular-nums">{index + 1}</span>
                      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold leading-5">{node.title["zh-CN"]}</span><span className="mt-1 block text-xs leading-5 text-[var(--muted-foreground)]">{hasInteraction ? "包含学生互动" : "老师讲解"}{node.configuration.terminal === true ? " · 本步骤结束" : ""}</span></span>
                    </button>
                    {editable && <div className="flex w-9 shrink-0 flex-col gap-1"><form action={moveTeachingScriptNodeAction}><input type="hidden" name="node_id" value={node.id} /><input type="hidden" name="direction" value="up" /><input type="hidden" name="return_to" value={returnTo} /><button type="submit" disabled={index === 0} aria-label={`上移“${node.title["zh-CN"]}”`} className="flex size-9 items-center justify-center border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-30"><ArrowUp size={14} aria-hidden="true" /></button></form><form action={moveTeachingScriptNodeAction}><input type="hidden" name="node_id" value={node.id} /><input type="hidden" name="direction" value="down" /><input type="hidden" name="return_to" value={returnTo} /><button type="submit" disabled={index === selectedVersion.nodes.length - 1} aria-label={`下移“${node.title["zh-CN"]}”`} className="flex size-9 items-center justify-center border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-30"><ArrowDown size={14} aria-hidden="true" /></button></form></div>}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className="min-w-0 border-t lg:col-span-2 xl:col-span-1 xl:border-t-0" aria-labelledby="subsection-editor-title">
          {selectedNode && selectedVersion ? (
            <>
              <header className="flex min-h-16 items-center justify-between gap-4 border-b px-5 py-3">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 id="subsection-editor-title" className="text-base font-bold">第 {selectedVersion.nodes.findIndex((item) => item.id === selectedNode.id) + 1} 小节 · {selectedNode.title["zh-CN"]}</h2><span className={`border px-2 py-1 text-xs font-semibold ${editable ? "border-[var(--status-warning)] text-[var(--status-warning)]" : "border-[var(--border)] text-[var(--muted-foreground)]"}`}>{editable ? "草稿编辑中" : "已发布 · 只读"}</span></div><p className="app-muted-text mt-1 text-xs">按老师台词、教学内容、互动和流程一步一步设置</p></div>
                {editable && selectedVersion.nodes.length > 1 && <form action={deleteTeachingScriptNodeAction} onSubmit={(event) => { if (!window.confirm(`确定删除“${selectedNode.title["zh-CN"]}”吗？`)) event.preventDefault(); }}><input type="hidden" name="node_id" value={selectedNode.id} /><input type="hidden" name="return_to" value={returnTo} /><button type="submit" className="inline-flex min-h-11 items-center gap-2 border border-[var(--destructive)] px-3 text-sm font-semibold text-[var(--destructive)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destructive)]"><Trash2 size={15} aria-hidden="true" />删除小节</button></form>}
              </header>
              <div className="p-4 lg:p-5"><TeachingScriptNodeForm key={selectedNode.id} node={selectedNode} allNodes={selectedVersion.nodes} activities={selectedModule.activities} returnTo={returnTo} editable={editable} /></div>
            </>
          ) : <div className="flex min-h-80 items-center justify-center p-8 text-center text-sm text-[var(--muted-foreground)]">请先选择一个教学小节。</div>}
        </section>
      </div>

      {editable && selectedVersion && (
        <section className="flex flex-wrap items-end justify-between gap-4 border bg-[var(--card)] px-4 py-4">
          <div><h2 className="text-sm font-bold">发布整个学习步骤</h2><p className="app-muted-text mt-1 text-xs leading-5">发布前会检查所有小节的台词、互动答案和流程连接；发布后学生使用新版本。</p></div>
          <form action={publishTeachingScriptAction} className="flex flex-wrap items-end gap-3"><input type="hidden" name="version_id" value={selectedVersion.id} /><input type="hidden" name="return_to" value={returnTo} /><label className="space-y-1.5 text-sm font-medium"><span className="block">修改说明</span><input name="change_note" maxLength={500} placeholder="说明本次调整内容" className="app-input h-11 w-72 border px-3" /></label><button type="submit" className="min-h-11 bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2">校验并发布</button></form>
        </section>
      )}
    </div>
  );
}
