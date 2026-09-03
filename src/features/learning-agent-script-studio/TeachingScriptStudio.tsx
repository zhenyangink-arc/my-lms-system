"use client";

import { type ButtonHTMLAttributes, type ReactNode, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { usePathname } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronDown, ExternalLink, FilePenLine, LoaderCircle, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Plus, Save, Send, Trash2 } from "lucide-react";

import {
  addTeachingScriptNodeAction,
  createTeachingScriptDraftAction,
  deleteTeachingScriptNodeAction,
  deleteTeachingScriptVersionAction,
  moveTeachingScriptNodeAction,
  publishTeachingScriptAction,
} from "@/app/dashboard/admin/teaching-scripts/actions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import { TeachingScriptNodeForm } from "./TeachingScriptNodeForm";
import type { TeachingScriptModule, TeachingScriptStudioData, TeachingScriptVersion } from "./types";

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

function scriptVersionSummary(version?: TeachingScriptVersion) {
  const nodes = version?.nodes ?? [];
  const interactionNodes = nodes.filter((node) => {
    const interaction = node.configuration.interaction;
    const studentTask = node.configuration.studentTask;
    return Boolean(node.referenceActivityId)
      || Boolean(interaction && typeof interaction === "object" && !Array.isArray(interaction))
      || Boolean(studentTask && typeof studentTask === "object" && !Array.isArray(studentTask));
  }).length;
  const readySpeechAssets = nodes.reduce((total, node) => total + node.speechAssets.filter((asset) => asset.productionStatus === "ready").length, 0);
  const incompleteNodes = nodes.filter((node) => !node.title["zh-CN"].trim() || !node.script["zh-CN"].trim()).length;
  const hasEnding = nodes.some((node) => node.configuration.terminal === true);
  const reviewIssues = Number(nodes.length === 0) + incompleteNodes + Number(nodes.length > 0 && !hasEnding);
  return { nodeCount: nodes.length, interactionNodes, readySpeechAssets, reviewIssues };
}

function CreateDraftButton({
  idleLabel = "编辑已发布版本",
  pendingLabel = "正在准备草稿…",
}: {
  idleLabel?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center gap-2 border border-[var(--primary)] bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">
      <FilePenLine size={16} aria-hidden="true" />
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}

function FormSubmitButton({
  pendingLabel,
  iconOnly = false,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel: string;
  iconOnly?: boolean;
  children: ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      {...props}
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      aria-label={pending ? pendingLabel : props["aria-label"]}
    >
      {pending ? (
        <>
          <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          <span className={iconOnly ? "sr-only" : undefined}>{pendingLabel}</span>
        </>
      ) : children}
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
  const previewLessonSupported = selectedModule?.chapterNumber === 1;
  const previewModuleIndex = selectedModule ? selectedModule.order - 1 : 0;
  const previewUrl = previewLessonSupported && selectedVersion
    ? `${pathname}/preview?scriptVersionId=${encodeURIComponent(selectedVersion.id)}&moduleIndex=${previewModuleIndex}`
    : "";
  const navigationMemoryKey = `${pathname}:teaching-script-navigation:v1`;
  const [showStructureNav, setShowStructureNav] = useState(true);
  const [collapsedChapterNumbers, setCollapsedChapterNumbers] = useState<Set<number>>(
    () => new Set(data.modules.map((item) => item.chapterNumber)),
  );
  const [expandedModuleId, setExpandedModuleId] = useState("");
  const [nodeSavePending, setNodeSavePending] = useState(false);
  const [navigationMemoryReady, setNavigationMemoryReady] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const columnsGridClass = showStructureNav
    ? "xl:grid-cols-[18rem_minmax(0,1fr)]"
    : "xl:grid-cols-[minmax(0,1fr)]";
  const selectedVersionSummary = scriptVersionSummary(selectedVersion);

  useEffect(() => {
    const restoreNavigationMemory = window.setTimeout(() => {
      const allChapterNumbers = new Set(data.modules.map((item) => item.chapterNumber));
      try {
        const stored = window.localStorage.getItem(navigationMemoryKey);
        if (stored) {
          const memory = JSON.parse(stored) as { expandedChapterNumbers?: unknown; expandedModuleId?: unknown };
          const expandedChapterNumbers = Array.isArray(memory.expandedChapterNumbers)
            ? new Set(memory.expandedChapterNumbers.filter((value): value is number => typeof value === "number"))
            : new Set<number>();
          setCollapsedChapterNumbers(new Set([...allChapterNumbers].filter((chapterNumber) => !expandedChapterNumbers.has(chapterNumber))));
          setExpandedModuleId(typeof memory.expandedModuleId === "string" && data.modules.some((item) => item.id === memory.expandedModuleId) ? memory.expandedModuleId : "");
        }
      } catch {
        window.localStorage.removeItem(navigationMemoryKey);
      } finally {
        setNavigationMemoryReady(true);
      }
    }, 0);
    return () => window.clearTimeout(restoreNavigationMemory);
  }, [data.modules, navigationMemoryKey]);

  useEffect(() => {
    if (!navigationMemoryReady) return;
    const expandedChapterNumbers = [...new Set(data.modules.map((item) => item.chapterNumber))]
      .filter((chapterNumber) => !collapsedChapterNumbers.has(chapterNumber));
    try {
      window.localStorage.setItem(navigationMemoryKey, JSON.stringify({ expandedChapterNumbers, expandedModuleId }));
    } catch {
      // The navigation still works when browser storage is unavailable.
    }
  }, [collapsedChapterNumbers, data.modules, expandedModuleId, navigationMemoryKey, navigationMemoryReady]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const warnBeforeLinkNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!target || target.target === "_blank" || target.hasAttribute("download")) return;
      const destination = new URL(target.href, window.location.href);
      if (destination.origin === window.location.origin && destination.pathname === window.location.pathname && destination.search === window.location.search) return;
      const confirmed = window.confirm("当前小节还有未保存的修改。确定放弃这些修改并离开吗？");
      if (!confirmed) {
        event.preventDefault();
        event.stopPropagation();
      } else {
        setHasUnsavedChanges(false);
      }
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    document.addEventListener("click", warnBeforeLinkNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      document.removeEventListener("click", warnBeforeLinkNavigation, true);
    };
  }, [hasUnsavedChanges]);

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
  const selectedNodeFormId = selectedNode ? `teaching-script-node-form-${selectedNode.id}` : undefined;

  function confirmDiscardChanges() {
    if (!hasUnsavedChanges) return true;
    const confirmed = window.confirm("当前小节还有未保存的修改。确定放弃这些修改并继续吗？");
    if (confirmed) setHasUnsavedChanges(false);
    return confirmed;
  }

  function requireSavedChanges() {
    if (!hasUnsavedChanges) return true;
    window.alert("请先保存当前小节，再执行这个操作。");
    return false;
  }

  function selectLearningStep(nextModuleId: string) {
    if (nextModuleId === selectedModule.id) {
      setExpandedModuleId((current) => current === nextModuleId ? "" : nextModuleId);
      return;
    }
    if (!confirmDiscardChanges()) return;
    const nextModule = data.modules.find((item) => item.id === nextModuleId);
    const nextVersion = preferredVersion(nextModule);
    setModuleId(nextModuleId);
    setVersionId(nextVersion?.id ?? "");
    setNodeId(nextVersion?.nodes[0]?.id ?? "");
    setExpandedModuleId(nextModuleId);
  }

  function toggleChapter(chapterNumber: number) {
    setCollapsedChapterNumbers((current) => {
      const next = new Set(current);
      if (next.has(chapterNumber)) next.delete(chapterNumber);
      else next.add(chapterNumber);
      return next;
    });
  }

  function selectVersion(nextVersionId: string) {
    if (nextVersionId === selectedVersion?.id || !confirmDiscardChanges()) return;
    const nextVersion = selectedModule.versions.find((item) => item.id === nextVersionId);
    setVersionId(nextVersionId);
    setNodeId(nextVersion?.nodes[0]?.id ?? "");
  }

  function selectNode(nextNodeId: string) {
    if (nextNodeId === selectedNode?.id || !confirmDiscardChanges()) return;
    setNodeId(nextNodeId);
  }

  return (
    <div className="space-y-4">
      <section className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_96%,transparent)] px-4 py-3 shadow-sm backdrop-blur" aria-label="教学脚本版本工具栏">
        <div className="min-w-0 flex-1">
          <p className="mb-1 truncate text-xs font-medium text-[var(--muted-foreground)]">{selectedModule.textbookTitle["zh-CN"]} / 第 {selectedModule.chapterNumber} 章</p>
          <CardTitleWithHint
            title={
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <strong className="text-base">{moduleLabels[selectedModule.code] ?? selectedModule.title["zh-CN"]}</strong>
                {selectedVersion && <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium">版本 {selectedVersion.number} · {versionLabel(selectedVersion.status)}</span>}
              </div>
            }
            description="每个学习步骤的教学小节、老师台词、展示内容和互动顺序都由你自行编排。"
            headingLevel={2}
            titleClassName="min-w-0"
            hintLabel="查看教学脚本编排说明"
          />
          {selectedVersion && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted-foreground)]" aria-label="当前学习步骤检查概览">
              <span>{selectedVersionSummary.nodeCount} 个教学小节</span>
              <span>{selectedVersionSummary.interactionNodes} 个学生互动</span>
              <span>{selectedVersionSummary.readySpeechAssets} 条正式语音就绪</span>
              <span className={selectedVersionSummary.reviewIssues > 0 ? "font-semibold text-[var(--status-warning)]" : "font-semibold text-[var(--status-success)]"}>
                {selectedVersionSummary.reviewIssues > 0 ? `待检查 ${selectedVersionSummary.reviewIssues} 项` : "基础检查通过"}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {selectedModule.versions.length > 1 && (
            <label className="flex min-h-11 items-center gap-2 text-sm"><span>查看版本</span><select value={selectedVersion?.id ?? ""} onChange={(event) => selectVersion(event.target.value)} className="app-input h-11 border px-3">{selectedModule.versions.map((version) => <option key={version.id} value={version.id}>版本 {version.number} · {versionLabel(version.status)}</option>)}</select></label>
          )}
          {selectedVersion?.status === "published" && draft && <button type="button" onClick={() => selectVersion(draft.id)} className="inline-flex min-h-11 items-center gap-2 border border-[var(--primary)] bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"><FilePenLine size={16} aria-hidden="true" />继续编辑草稿</button>}
          {selectedVersion?.status === "published" && !draft && selectedModule.lessonId && <form action={createTeachingScriptDraftAction}><input type="hidden" name="lesson_id" value={selectedModule.lessonId} /><input type="hidden" name="return_to" value={returnTo} /><CreateDraftButton /></form>}
          {!selectedVersion && selectedModule.lessonId && <form action={createTeachingScriptDraftAction}><input type="hidden" name="lesson_id" value={selectedModule.lessonId} /><input type="hidden" name="return_to" value={returnTo} /><CreateDraftButton idleLabel="新建教学脚本" pendingLabel="正在新建…" /></form>}
          {selectedVersion?.status === "archived" && (
            <AlertDialog>
              <AlertDialogTrigger type="button" className="inline-flex min-h-11 items-center gap-2 border border-[var(--destructive)] px-3 text-sm font-semibold text-[var(--destructive)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destructive)]">
                <Trash2 size={15} aria-hidden="true" />删除这个历史版本
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>删除版本 {selectedVersion.number}？</AlertDialogTitle>
                  <AlertDialogDescription className="leading-6">
                    只有没有学生作答记录的归档版本才能删除。删除后无法恢复，当前已发布版本和草稿不会受到影响。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <form action={deleteTeachingScriptVersionAction}>
                  <input type="hidden" name="version_id" value={selectedVersion.id} />
                  <input type="hidden" name="return_to" value={returnTo} />
                  <AlertDialogFooter>
                    <AlertDialogCancel type="button">取消</AlertDialogCancel>
                    <FormSubmitButton pendingLabel="正在删除版本…" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[var(--destructive)] px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destructive)] disabled:cursor-wait disabled:opacity-60">
                      <Trash2 size={15} aria-hidden="true" />确认删除
                    </FormSubmitButton>
                  </AlertDialogFooter>
                </form>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {selectedVersion && (
            previewLessonSupported ? (
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-2 border border-[var(--primary)] px-3 text-sm font-semibold text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <ExternalLink size={15} aria-hidden="true" />预览完整流程
              </a>
            ) : (
              <span
                className="inline-flex min-h-11 items-center gap-2 border border-[var(--border)] px-3 text-sm font-semibold text-[var(--muted-foreground)]"
              >
                <ExternalLink size={15} aria-hidden="true" />仅第 1 章可预览完整流程
              </span>
            )
          )}
          {editable && selectedNode && selectedNodeFormId && (
            <span className={`text-xs font-medium ${nodeSavePending ? "text-[var(--muted-foreground)]" : hasUnsavedChanges ? "text-[var(--status-warning)]" : "text-[var(--status-success)]"}`} role="status" aria-live="polite">
              {nodeSavePending ? "正在保存" : hasUnsavedChanges ? "等待自动保存" : "草稿已保存"}
            </span>
          )}
          {editable && selectedNode && selectedNodeFormId && (
            <button
              type="submit"
              form={selectedNodeFormId}
              disabled={nodeSavePending}
              aria-busy={nodeSavePending}
              className="inline-flex min-h-11 items-center gap-2 border border-[var(--primary)] bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
            >
              {nodeSavePending ? <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
              {nodeSavePending ? "正在保存…" : "保存当前小节"}
            </button>
          )}
          {editable && selectedVersion && (
            <details className="group relative">
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 border border-[var(--border)] bg-[var(--muted)] px-4 text-sm font-semibold text-[var(--foreground-secondary)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                <Send size={15} aria-hidden="true" />发布学习步骤
              </summary>
              <div className="absolute right-0 top-full z-40 mt-2 w-[min(23rem,calc(100vw-2rem))] rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-xl">
                <h3 className="text-sm font-bold text-[var(--foreground)]">发布整个学习步骤</h3>
                <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">发布前会检查所有小节的台词、互动答案和流程连接。</p>
                <form action={publishTeachingScriptAction} onSubmit={(event) => { if (!requireSavedChanges()) event.preventDefault(); }} className="mt-4 space-y-3">
                  <input type="hidden" name="version_id" value={selectedVersion.id} />
                  <input type="hidden" name="return_to" value={returnTo} />
                  <label className="block space-y-1.5 text-sm font-medium">
                    <span className="block">修改说明</span>
                    <input name="change_note" maxLength={500} placeholder="说明本次调整内容" className="app-input h-11 w-full border px-3" />
                  </label>
                  <FormSubmitButton pendingLabel="正在校验并发布…" className="inline-flex min-h-11 w-full items-center justify-center gap-2 bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">校验并发布</FormSubmitButton>
                </form>
              </div>
            </details>
          )}
        </div>
      </section>

      <div className={`grid min-h-[760px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] ${columnsGridClass}`}>
        <nav className={`${showStructureNav ? "block" : "hidden"} border-b bg-[var(--muted)]/25 xl:sticky xl:top-0 xl:max-h-[calc(100dvh-1rem)] xl:self-start xl:border-b-0 xl:border-r`} aria-label="课程结构">
          <div className="flex min-h-16 items-center justify-between gap-2 border-b px-4 py-3">
            {showStructureNav && (
              <div className="min-w-0 flex-1 text-center">
                <h2 className="text-sm font-bold">课程结构</h2>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowStructureNav((current) => !current)}
              aria-label={showStructureNav ? "隐藏课程结构" : "显示课程结构"}
              aria-expanded={showStructureNav}
              className="flex size-11 shrink-0 items-center justify-center border border-[var(--border)] text-[var(--foreground-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              {showStructureNav ? <PanelLeftClose size={15} aria-hidden="true" /> : <PanelLeftOpen size={15} aria-hidden="true" />}
            </button>
          </div>
          {showStructureNav && (
          <div className="max-h-[32rem] overflow-y-auto p-2 xl:max-h-[calc(100dvh-10rem)]">
            {chapters.map(([chapterNumber, modules]) => {
              const chapterExpanded = !collapsedChapterNumbers.has(chapterNumber);
              return (
              <section key={chapterNumber} className="mb-4">
                <h3>
                  <button type="button" onClick={() => toggleChapter(chapterNumber)} aria-expanded={chapterExpanded} aria-controls={`teaching-chapter-${chapterNumber}-steps`} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--muted)]/60 px-3 py-2 text-left transition hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="shrink-0 rounded-md bg-[var(--card)] px-2 py-1 text-xs font-bold text-[var(--muted-foreground)] shadow-sm">第 {chapterNumber} 章</span>
                      <span className="min-w-0 truncate text-sm font-bold text-[var(--foreground)]">{modules[0]?.chapterTitle["zh-CN"]}</span>
                    </span>
                    <ChevronDown size={15} className={`shrink-0 transition-transform motion-reduce:transition-none ${chapterExpanded ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                </h3>
                {chapterExpanded && <div id={`teaching-chapter-${chapterNumber}-steps`} className="space-y-1">
                  {modules.map((lessonModule) => {
                    const version = preferredVersion(lessonModule);
                    const selected = lessonModule.id === selectedModule.id;
                    const expanded = selected && expandedModuleId === lessonModule.id;
                    const stepLabel = moduleLabels[lessonModule.code] ?? lessonModule.title["zh-CN"];
                    const versionStatus = version ? versionLabel(version.status) : "未创建";
                    return (
                      <div key={lessonModule.id} className="space-y-1">
                        <button type="button" onClick={() => selectLearningStep(lessonModule.id)} aria-current={selected ? "page" : undefined} aria-expanded={expanded} aria-controls={selected ? `teaching-step-${lessonModule.id}-nodes` : undefined} aria-label={`第 ${chapterNumber} 章第 ${lessonModule.order} 步：${stepLabel}，${version?.nodes.length ?? 0} 个教学小节，${versionStatus}，${expanded ? "收起" : "展开"}`} className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] ${selected ? "border-[var(--primary)] bg-[var(--accent)] font-semibold" : "border-transparent hover:bg-[var(--card)]"}`}>
                          <span className="min-w-0"><span className="block truncate">{stepLabel}</span><span className="mt-1 block text-xs font-normal text-[var(--muted-foreground)]">{version?.nodes.length ?? 0} 个教学小节 · {versionStatus}</span></span>
                          <span className="flex shrink-0 items-center gap-2 text-xs text-[var(--muted-foreground)]"><span className="tabular-nums">{lessonModule.order}</span><ChevronDown size={15} className={`transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} aria-hidden="true" /></span>
                        </button>
                        {expanded && (
                          <div id={`teaching-step-${lessonModule.id}-nodes`} className="ml-3 border-l border-[var(--border)] py-2 pl-3">
                            <div className="mb-2 flex min-h-11 items-center justify-between gap-2">
                              <span className="text-xs font-bold text-[var(--foreground-secondary)]">教学小节</span>
                              {editable && selectedVersion && (
                                <form action={addTeachingScriptNodeAction} onSubmit={(event) => { if (!requireSavedChanges()) event.preventDefault(); }}>
                                  <input type="hidden" name="version_id" value={selectedVersion.id} />
                                  <input type="hidden" name="return_to" value={returnTo} />
                                  <FormSubmitButton pendingLabel="正在新增…" className="inline-flex min-h-11 items-center gap-1.5 px-2 text-xs font-semibold text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-wait disabled:opacity-60"><Plus size={14} aria-hidden="true" />新增小节</FormSubmitButton>
                                </form>
                              )}
                            </div>
                            {!selectedVersion ? (
                              <p className="py-3 text-xs leading-5 text-[var(--muted-foreground)]">当前学习步骤还没有教学脚本。</p>
                            ) : (
                              <ol className="space-y-2">
                                {selectedVersion.nodes.map((node, index) => {
                                  const interaction = node.configuration.interaction;
                                  const hasInteraction = Boolean(interaction && typeof interaction === "object" && !Array.isArray(interaction));
                                  const nodeSelected = node.id === selectedNode?.id;
                                  return (
                                    <li key={node.id} className="flex min-w-0 gap-1.5">
                                      <button type="button" onClick={() => selectNode(node.id)} aria-current={nodeSelected ? "step" : undefined} aria-label={`第 ${index + 1} 小节：${node.title["zh-CN"]}，${hasInteraction ? "包含学生互动" : "老师讲解"}${node.configuration.terminal === true ? "，本步骤结束" : ""}`} className={`flex min-h-14 min-w-0 flex-1 items-start gap-2 rounded-lg border px-2.5 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${nodeSelected ? "border-[var(--primary)] bg-[var(--card)] shadow-sm" : "border-transparent hover:bg-[var(--card)]"}`}>
                                        <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${nodeSelected ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "border border-[var(--border)] bg-[var(--card)]"}`}>{index + 1}</span>
                                        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold leading-5">{node.title["zh-CN"]}</span><span className="mt-1 block text-xs leading-5 text-[var(--muted-foreground)]">{hasInteraction ? "学生互动" : "老师讲解"}{node.configuration.terminal === true ? " · 结束" : ""}</span></span>
                                      </button>
                                      {editable && (
                                        <div className="flex w-7 shrink-0 flex-col gap-1">
                                          <form action={moveTeachingScriptNodeAction} onSubmit={(event) => { if (!requireSavedChanges()) event.preventDefault(); }}><input type="hidden" name="node_id" value={node.id} /><input type="hidden" name="direction" value="up" /><input type="hidden" name="return_to" value={returnTo} /><FormSubmitButton pendingLabel={`正在上移“${node.title["zh-CN"]}”`} iconOnly disabled={index === 0} aria-label={`上移“${node.title["zh-CN"]}”`} className="flex size-7 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-30"><ArrowUp size={12} aria-hidden="true" /></FormSubmitButton></form>
                                          <form action={moveTeachingScriptNodeAction} onSubmit={(event) => { if (!requireSavedChanges()) event.preventDefault(); }}><input type="hidden" name="node_id" value={node.id} /><input type="hidden" name="direction" value="down" /><input type="hidden" name="return_to" value={returnTo} /><FormSubmitButton pendingLabel={`正在下移“${node.title["zh-CN"]}”`} iconOnly disabled={index === selectedVersion.nodes.length - 1} aria-label={`下移“${node.title["zh-CN"]}”`} className="flex size-7 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-30"><ArrowDown size={12} aria-hidden="true" /></FormSubmitButton></form>
                                        </div>
                                      )}
                                    </li>
                                  );
                                })}
                              </ol>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>}
              </section>
              );
            })}
          </div>
          )}
        </nav>

        <section className="min-w-0 bg-[var(--background)]" aria-labelledby="subsection-editor-title">
          {selectedNode && selectedVersion ? (
            <>
              <header className="flex min-h-16 items-center justify-between gap-4 border-b bg-[var(--card)] px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  {!showStructureNav && (
                    <button type="button" onClick={() => setShowStructureNav(true)} aria-label="显示课程结构" aria-expanded={false} className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--foreground-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                      <PanelLeftOpen size={15} aria-hidden="true" />
                    </button>
                  )}
                  <div className="min-w-0">
                    <CardTitleWithHint
                      title={
                        <span className="flex flex-wrap items-center gap-2">
                          <span id="subsection-editor-title">{selectedModule.textbookTitle["zh-CN"]} · 第{selectedModule.chapterNumber}章 · {moduleLabels[selectedModule.code] ?? selectedModule.title["zh-CN"]} · 第{selectedVersion.nodes.findIndex((item) => item.id === selectedNode.id) + 1}小节</span>
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${editable ? "border-[var(--status-warning)] text-[var(--status-warning)]" : "border-[var(--border)] text-[var(--muted-foreground)]"}`}>{editable ? "草稿编辑中" : "已发布 · 只读"}</span>
                        </span>
                      }
                      description="依次设置老师台词、画面与人物、学生互动和后续流程。"
                      headingLevel={2}
                      titleClassName="text-base font-bold"
                      hintLabel="查看教学小节编辑说明"
                    />
                  </div>
                </div>
                {editable && selectedVersion.nodes.length > 1 && (
                  <details className="group relative">
                    <summary className="flex size-11 cursor-pointer list-none items-center justify-center rounded-lg border border-[var(--border)] text-[var(--foreground-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] [&::-webkit-details-marker]:hidden" aria-label="更多小节操作"><MoreHorizontal size={17} aria-hidden="true" /></summary>
                    <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-lg">
                      <AlertDialog>
                        <AlertDialogTrigger type="button" className="inline-flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[var(--destructive)] transition hover:bg-[var(--status-danger-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destructive)]">
                          <Trash2 size={15} aria-hidden="true" />删除当前小节
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>删除“{selectedNode.title["zh-CN"]}”？</AlertDialogTitle>
                            <AlertDialogDescription className="leading-6">
                              删除后无法恢复。当前学习步骤必须至少保留一个教学小节；如有未保存修改，也会一并丢失。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <form action={deleteTeachingScriptNodeAction} onSubmit={() => setHasUnsavedChanges(false)}>
                            <input type="hidden" name="node_id" value={selectedNode.id} />
                            <input type="hidden" name="return_to" value={returnTo} />
                            <AlertDialogFooter>
                              <AlertDialogCancel type="button">取消</AlertDialogCancel>
                              <FormSubmitButton pendingLabel="正在删除…" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[var(--destructive)] px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destructive)] disabled:cursor-wait disabled:opacity-60"><Trash2 size={15} aria-hidden="true" />确认删除</FormSubmitButton>
                            </AlertDialogFooter>
                          </form>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </details>
                )}
              </header>
              <div className="p-4 lg:p-6"><TeachingScriptNodeForm key={selectedNode.id} formId={selectedNodeFormId} node={selectedNode} allNodes={selectedVersion.nodes} activities={selectedModule.activities} learningTargets={selectedModule.learningTargets} templates={data.characterStyleTemplates} blackboardLayoutTemplates={data.blackboardLayoutTemplates} moduleCode={selectedModule.code} moduleOrder={selectedModule.order} returnTo={returnTo} editable={editable} previewUrl={previewUrl} onDirtyChange={setHasUnsavedChanges} onPendingChange={setNodeSavePending} /></div>
            </>
          ) : <div className="flex min-h-80 items-center justify-center p-8 text-center text-sm text-[var(--muted-foreground)]">请先选择一个教学小节。</div>}
        </section>
      </div>

    </div>
  );
}
