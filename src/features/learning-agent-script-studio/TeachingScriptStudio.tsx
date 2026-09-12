"use client";
import { normalizeTeachingVideo, teachingScriptSegments, teachingVideoIssues } from "@/lib/teaching-video";
import { ChapterReleaseCheckPanel } from "./ChapterReleaseCheckPanel";
import { ScriptSourceReviewPanel } from "./ScriptSourceReviewPanel";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";

import { type ButtonHTMLAttributes, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { usePathname } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpenText, CheckCircle2, ChevronDown, Circle, ExternalLink, FilePenLine, ListTree, LoaderCircle, MessageCircleQuestion, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Play, Plus, Route, Save, ScrollText, Send, StepForward, Trash2, X } from "lucide-react";

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
import { TeachingScriptNodeForm, type TeachingScriptEditorSection } from "./TeachingScriptNodeForm";
import type { TeachingScriptActivity, TeachingScriptModule, TeachingScriptNode, TeachingScriptStudioData, TeachingScriptVersion } from "./types";

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
  const videoNodes = nodes.filter((node) => normalizeTeachingVideo(node.configuration.teacherVideo).mode === "video");
  const videoIssueCount = videoNodes.reduce((total, node) => total + teachingVideoIssues({
    video: node.configuration.teacherVideo,
    lines: teachingScriptSegments(node.script, node.configuration),
    hasTask: Boolean(nodeConfigurationObject(node, "studentTask").kind && nodeConfigurationObject(node, "studentTask").kind !== "none"),
    hasQuestion: Boolean(node.referenceActivityId || (nodeConfigurationObject(node, "interaction").kind && nodeConfigurationObject(node, "interaction").kind !== "none")),
  }).length, 0);
  const reviewIssues = Number(nodes.length === 0) + incompleteNodes + Number(nodes.length > 0 && !hasEnding) + videoIssueCount;
  return { nodeCount: nodes.length, interactionNodes, readySpeechAssets, reviewIssues, videoNodeCount: videoNodes.length, videoIssueCount };
}

type OrchestrationTrackId = TeachingScriptEditorSection | "teacher_prompt" | "teacher_feedback";

const orchestrationTracks: Array<{
  id: OrchestrationTrackId;
  section: TeachingScriptEditorSection;
  label: string;
  icon: typeof ScrollText;
}> = [
  { id: "script", section: "script", label: "老师讲解", icon: ScrollText },
  { id: "content", section: "content", label: "画面呈现", icon: BookOpenText },
  { id: "teacher_prompt", section: "interaction", label: "老师发起", icon: MessageCircleQuestion },
  { id: "interaction", section: "interaction", label: "学生回应", icon: CheckCircle2 },
  { id: "teacher_feedback", section: "interaction", label: "老师反馈", icon: ScrollText },
  { id: "flow", section: "flow", label: "后续连接", icon: Route },
];

function nodeConfigurationObject(node: TeachingScriptNode, key: string) {
  const value = node.configuration[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function localizedConfigurationText(configuration: Record<string, unknown>, key: string) {
  const value = configuration[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return String((value as Record<string, unknown>)["zh-CN"] ?? "").trim();
}

function orchestrationCell(node: TeachingScriptNode, trackId: OrchestrationTrackId, allNodes: TeachingScriptNode[], activities: TeachingScriptActivity[]) {
  if (trackId === "script") {
    const lineCount = teachingScriptSegments(node.script, node.configuration).length;
    const video = normalizeTeachingVideo(node.configuration.teacherVideo);
    if (video.mode === "video") {
      const lines = teachingScriptSegments(node.script, node.configuration);
      const ready = lines.filter((line, index) => video.explanations[index]?.transcript.trim() === line.trim()).length;
      return { configured: ready === lineCount && lineCount > 0, label: `${lineCount} 段讲解 · ${ready} 段视频已绑定` };
    }
    const readySpeechCount = node.speechAssets.filter((asset) => asset.locale === "zh-CN" && asset.productionStatus === "ready").length;
    return lineCount > 0
      ? { configured: true, label: `${lineCount} 句台词${readySpeechCount > 0 ? ` · ${readySpeechCount} 句语音` : ""}` }
      : { configured: false, label: "需要填写台词" };
  }
  if (trackId === "content") {
    if (normalizeTeachingVideo(node.configuration.teacherVideo).mode === "video") return { configured: false, label: "视频呈现，无需设置画面" };
    const display = nodeConfigurationObject(node, "display");
    const visualCue = nodeConfigurationObject(node, "visualCue");
    const slides = Array.isArray(display.slides) ? display.slides : [];
    const hasLearningTarget = Boolean(visualCue.targetKey);
    const configured = slides.length > 0 || hasLearningTarget;
    return {
      configured,
      label: slides.length > 0
        ? `${slides.length} 张画面${hasLearningTarget ? " · 已关联学习区" : ""}`
        : hasLearningTarget ? "已关联学习区" : "按需设置画面",
    };
  }
  if (trackId === "teacher_prompt") {
    const video = normalizeTeachingVideo(node.configuration.teacherVideo);
    if (video.mode === "video") {
      const task = Boolean(nodeConfigurationObject(node, "studentTask").kind);
      const question = Boolean(nodeConfigurationObject(node, "interaction").kind) || Boolean(node.referenceActivityId);
      const labels = [task ? video.taskInExplanation ? "操作要求已含在讲解中" : video.turns.task ? "操作要求视频已绑定" : "操作要求待绑定" : "", question ? video.questionInExplanation ? "提问已含在讲解中" : video.turns.question ? "提问视频已绑定" : "提问视频待绑定" : ""].filter(Boolean);
      return { configured: labels.length > 0 && (!task || video.taskInExplanation || Boolean(video.turns.task)) && (!question || video.questionInExplanation || Boolean(video.turns.question)), label: labels.join("；") || "无需老师发起" };
    }
    const studentTask = nodeConfigurationObject(node, "studentTask");
    const hasTask = Boolean(studentTask.kind && studentTask.kind !== "none");
    const instruction = localizedConfigurationText(studentTask, "instruction");
    const interaction = nodeConfigurationObject(node, "interaction");
    const kind = String(interaction.kind ?? (node.referenceActivityId ? "referenced_activity" : "none"));
    const prompt = kind === "single_choice"
      ? localizedConfigurationText(interaction, "prompt")
      : kind === "referenced_activity"
        ? activities.find((activity) => activity.id === node.referenceActivityId)?.prompt["zh-CN"].trim() ?? ""
        : "";
    const teacherTurns = [
      hasTask ? `操作要求：${instruction || "待填写老师实际说的话"}` : "",
      kind !== "none" ? `提问：${prompt || "待填写老师问题"}` : "",
    ].filter(Boolean);
    return teacherTurns.length > 0
      ? { configured: Boolean((!hasTask || instruction) && (kind === "none" || prompt)), label: teacherTurns.join("；") }
      : { configured: false, label: "无需老师发起" };
  }
  if (trackId === "interaction") {
    const interaction = nodeConfigurationObject(node, "interaction");
    const studentTask = nodeConfigurationObject(node, "studentTask");
    const hasTask = Boolean(studentTask.kind && studentTask.kind !== "none");
    const kind = String(interaction.kind ?? (node.referenceActivityId ? "referenced_activity" : "none"));
    const interactionLabel = kind === "single_choice" ? "单选检查" : kind === "referenced_activity" ? "教材活动" : "";
    return hasTask || interactionLabel
      ? { configured: true, label: [hasTask ? "学生操作" : "", interactionLabel].filter(Boolean).join(" + ") }
      : { configured: false, label: "无需学生参与" };
  }
  if (trackId === "teacher_feedback") {
    const video = normalizeTeachingVideo(node.configuration.teacherVideo);
    if (video.mode === "video") {
      const labels = [node.configuration.studentTask ? video.turns.operationFeedback ? "操作完成视频" : "操作完成文字反馈" : "", node.configuration.interaction || node.referenceActivityId ? `答对${video.turns.correctFeedback ? "视频" : "文字"} · 答错${video.turns.incorrectFeedback ? "视频" : "文字"}` : ""].filter(Boolean);
      return { configured: labels.length > 0, label: labels.join("；") || "无需单独反馈" };
    }
    const studentTask = nodeConfigurationObject(node, "studentTask");
    const interaction = nodeConfigurationObject(node, "interaction");
    const hasTask = Boolean(studentTask.kind && studentTask.kind !== "none");
    const hasQuestion = Boolean(interaction.kind && interaction.kind !== "none") || Boolean(node.referenceActivityId);
    const operationFeedback = localizedConfigurationText(node.configuration, "operationCompleteFeedback");
    const correctFeedback = node.interactionSecret?.correctFeedback["zh-CN"]?.trim() ?? "";
    const feedback = [
      hasTask ? `操作完成：${operationFeedback || "使用系统自然反馈"}` : "",
      hasQuestion ? `回答后：${correctFeedback || (node.referenceActivityId ? "使用教材反馈" : "待填写反馈")}` : "",
    ].filter(Boolean);
    return feedback.length > 0
      ? { configured: Boolean((!hasQuestion || correctFeedback || node.referenceActivityId)), label: feedback.join("；") }
      : { configured: false, label: "无需单独反馈" };
  }
  if (node.configuration.terminal === true) return { configured: true, label: "结束学习步骤" };
  if (node.nextNodeKey) {
    const target = allNodes.find((item) => item.key === node.nextNodeKey);
    return { configured: true, label: target ? `跳到第 ${target.order} 小节` : "跳转目标失效" };
  }
  return { configured: true, label: "按顺序继续" };
}

function orchestrationNodeIssueCount(node: TeachingScriptNode, allNodes: TeachingScriptNode[]) {
  return Number(!node.title["zh-CN"].trim())
    + Number(!node.script["zh-CN"].trim())
    + teachingVideoIssues({
      video: node.configuration.teacherVideo,
      lines: teachingScriptSegments(node.script, node.configuration),
      hasTask: Boolean(nodeConfigurationObject(node, "studentTask").kind && nodeConfigurationObject(node, "studentTask").kind !== "none"),
      hasQuestion: Boolean(node.referenceActivityId || (nodeConfigurationObject(node, "interaction").kind && nodeConfigurationObject(node, "interaction").kind !== "none")),
    }).length
    + Number(Boolean(node.nextNodeKey && !allNodes.some((item) => item.key === node.nextNodeKey)));
}

function TeachingConnectionOverlay({ nodes }: { nodes: TeachingScriptNode[] }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [paths, setPaths] = useState<Array<{ id: string; path: string }>>([]);

  useEffect(() => {
    const root = rootRef.current;
    const container = root?.parentElement;
    if (!root || !container) return;
    let frame = 0;
    const measure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const rootRect = root.getBoundingClientRect();
        const nextPaths = nodes.flatMap((node, sourceIndex) => {
          if (!node.nextNodeKey) return [];
          const targetIndex = nodes.findIndex((item) => item.key === node.nextNodeKey);
          if (targetIndex < 0 || targetIndex === sourceIndex) return [];
          const source = container.querySelector<HTMLElement>(`[data-axis-point="${sourceIndex}"]`);
          const target = container.querySelector<HTMLElement>(`[data-axis-point="${targetIndex}"]`);
          if (!source || !target) return [];
          const sourceRect = source.getBoundingClientRect();
          const targetRect = target.getBoundingClientRect();
          const startX = sourceRect.left + sourceRect.width / 2 - rootRect.left;
          const endX = targetRect.left + targetRect.width / 2 - rootRect.left;
          const y = sourceRect.top + sourceRect.height / 2 - rootRect.top;
          const curveY = Math.max(8, y - 22 - Math.min(24, Math.abs(targetIndex - sourceIndex) * 5));
          return [{
            id: `${node.id}-${nodes[targetIndex].id}`,
            path: `M ${startX} ${y} C ${startX} ${curveY}, ${endX} ${curveY}, ${endX} ${y}`,
          }];
        });
        setPaths(nextPaths);
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [nodes]);

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      <svg className="size-full overflow-visible">
        <defs>
          <marker id="teaching-axis-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="var(--primary)" />
          </marker>
        </defs>
        {paths.map((item) => (
          <path key={item.id} d={item.path} fill="none" stroke="var(--primary)" strokeWidth="2" strokeDasharray="5 4" markerEnd="url(#teaching-axis-arrow)" />
        ))}
      </svg>
    </div>
  );
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

export function TeachingScriptStudio({ data, chapterId }: { data: TeachingScriptStudioData; chapterId?: string }) {
  const pathname = usePathname();
  const firstModule = data.modules.find((item) => item.chapterNumber === 1 && item.code === "orientation") ?? data.modules[0];
  const [moduleId, setModuleId] = useState(firstModule?.id ?? "");
  const selectedModule = data.modules.find((item) => item.id === moduleId) ?? firstModule;
  const preferred = preferredVersion(selectedModule);
  const [versionId, setVersionId] = useState(preferred?.id ?? "");
  const selectedVersion = selectedModule?.versions.find((item) => item.id === versionId) ?? preferred;
  const [nodeId, setNodeId] = useState(selectedVersion?.nodes[0]?.id ?? "");
  const [editorSection, setEditorSection] = useState<TeachingScriptEditorSection>("script");
  const [selectedOrchestrationTrackId, setSelectedOrchestrationTrackId] = useState<OrchestrationTrackId>("script");
  const [interactionFocusRequest, setInteractionFocusRequest] = useState<{ id: number; target: "teacher_prompt" | "student_response" | "teacher_feedback" } | null>(null);
  const selectedNode = selectedVersion?.nodes.find((item) => item.id === nodeId) ?? selectedVersion?.nodes[0];
  const previewLessonSupported = selectedModule?.chapterNumber === 1;
  const previewModuleIndex = selectedModule ? selectedModule.order - 1 : 0;
  const previewUrl = previewLessonSupported && selectedVersion
    ? `${pathname}/preview?scriptVersionId=${encodeURIComponent(selectedVersion.id)}&moduleIndex=${previewModuleIndex}`
    : "";
  const navigationMemoryKey = `${pathname}:teaching-script-navigation:v1`;
  const [showStructureNav, setShowStructureNav] = useState(true);
  const [publishIssue, setPublishIssue] = useState<{ message: string; nodeKey?: string } | null>(null);
  const [showOrchestrationAxis, setShowOrchestrationAxis] = useState(true);
  const [flowBindingSourceNodeId, setFlowBindingSourceNodeId] = useState<string | null>(null);
  const [flowBindingRequest, setFlowBindingRequest] = useState<{ id: number; targetNodeKey: string } | null>(null);
  const [axisPreviewNodeId, setAxisPreviewNodeId] = useState<string | null>(null);
  const [axisPreviewVisitedIds, setAxisPreviewVisitedIds] = useState<string[]>([]);
  const [axisPreviewMessage, setAxisPreviewMessage] = useState("");
  const [collapsedChapterNumbers, setCollapsedChapterNumbers] = useState<Set<number>>(
    () => new Set(data.modules.map((item) => item.chapterNumber).filter((chapterNumber) => chapterNumber !== firstModule?.chapterNumber)),
  );
  const [nodeSavePending, setNodeSavePending] = useState(false);
  const [navigationMemoryReady, setNavigationMemoryReady] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const columnsGridClass = showStructureNav
    ? "lg:grid-cols-[13rem_minmax(0,1fr)]"
    : "grid-cols-[minmax(0,1fr)]";
  const selectedVersionSummary = scriptVersionSummary(selectedVersion);
  const flowBindingSourceNode = selectedVersion?.nodes.find((node) => node.id === flowBindingSourceNodeId);

  useEffect(() => {
    const restoreNavigationMemory = window.setTimeout(() => {
      const allChapterNumbers = new Set(data.modules.map((item) => item.chapterNumber));
      try {
        const stored = window.localStorage.getItem(navigationMemoryKey);
        if (stored) {
          const memory = JSON.parse(stored) as { expandedChapterNumbers?: unknown };
          const expandedChapterNumbers = Array.isArray(memory.expandedChapterNumbers)
            ? new Set(memory.expandedChapterNumbers.filter((value): value is number => typeof value === "number"))
            : new Set<number>();
          setCollapsedChapterNumbers(new Set([...allChapterNumbers].filter((chapterNumber) => !expandedChapterNumbers.has(chapterNumber))));
        } else if (firstModule) {
          setCollapsedChapterNumbers(new Set([...allChapterNumbers].filter((chapterNumber) => chapterNumber !== firstModule.chapterNumber)));
        }
      } catch {
        window.localStorage.removeItem(navigationMemoryKey);
      } finally {
        setNavigationMemoryReady(true);
      }
    }, 0);
    return () => window.clearTimeout(restoreNavigationMemory);
  }, [data.modules, firstModule, navigationMemoryKey]);

  useEffect(() => {
    if (!navigationMemoryReady) return;
    const expandedChapterNumbers = [...new Set(data.modules.map((item) => item.chapterNumber))]
      .filter((chapterNumber) => !collapsedChapterNumbers.has(chapterNumber));
    try {
      window.localStorage.setItem(navigationMemoryKey, JSON.stringify({ expandedChapterNumbers }));
    } catch {
      // The navigation still works when browser storage is unavailable.
    }
  }, [collapsedChapterNumbers, data.modules, navigationMemoryKey, navigationMemoryReady]);

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
    if (nextModuleId === selectedModule.id) return;
    if (!confirmDiscardChanges()) return;
    const nextModule = data.modules.find((item) => item.id === nextModuleId);
    const nextVersion = preferredVersion(nextModule);
    setModuleId(nextModuleId);
    setVersionId(nextVersion?.id ?? "");
    setNodeId(nextVersion?.nodes[0]?.id ?? "");
    setEditorSection("script");
    setSelectedOrchestrationTrackId("script");
    setFlowBindingSourceNodeId(null);
    setFlowBindingRequest(null);
    setAxisPreviewNodeId(null);
    setAxisPreviewVisitedIds([]);
    setAxisPreviewMessage("");
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
    setEditorSection("script");
    setSelectedOrchestrationTrackId("script");
    setFlowBindingSourceNodeId(null);
    setFlowBindingRequest(null);
    setAxisPreviewNodeId(null);
    setAxisPreviewVisitedIds([]);
    setAxisPreviewMessage("");
  }

  function selectNode(nextNodeId: string, nextSection: TeachingScriptEditorSection = "script", nextTrackId: OrchestrationTrackId = nextSection) {
    if (flowBindingSourceNodeId) {
      if (nextNodeId === flowBindingSourceNodeId) return;
      const targetNode = selectedVersion?.nodes.find((node) => node.id === nextNodeId);
      if (!targetNode) return;
      setFlowBindingRequest((current) => ({ id: (current?.id ?? 0) + 1, targetNodeKey: targetNode.key }));
      setFlowBindingSourceNodeId(null);
      setEditorSection("flow");
      setSelectedOrchestrationTrackId("flow");
      return;
    }
    if (nextNodeId !== selectedNode?.id) {
      if (!confirmDiscardChanges()) return;
      setNodeId(nextNodeId);
    }
    setEditorSection(nextSection);
    setSelectedOrchestrationTrackId(nextTrackId);
    if (nextTrackId === "teacher_prompt" || nextTrackId === "teacher_feedback" || nextTrackId === "interaction") {
      setInteractionFocusRequest((current) => ({
        id: (current?.id ?? 0) + 1,
        target: nextTrackId === "interaction" ? "student_response" : nextTrackId,
      }));
    } else {
      setInteractionFocusRequest(null);
    }
  }

  function changeEditorSection(nextSection: TeachingScriptEditorSection) {
    setEditorSection(nextSection);
    setSelectedOrchestrationTrackId(nextSection);
    setInteractionFocusRequest(null);
  }

  function startFlowBinding() {
    if (!editable || !selectedNode) return;
    setShowOrchestrationAxis(true);
    setEditorSection("flow");
    setSelectedOrchestrationTrackId("flow");
    setFlowBindingRequest(null);
    setFlowBindingSourceNodeId(selectedNode.id);
    setAxisPreviewNodeId(null);
    setAxisPreviewVisitedIds([]);
    setAxisPreviewMessage("");
  }

  function startAxisPreview() {
    const firstNode = selectedVersion?.nodes[0];
    if (!firstNode) return;
    setFlowBindingSourceNodeId(null);
    setAxisPreviewNodeId(firstNode.id);
    setAxisPreviewVisitedIds([firstNode.id]);
    setAxisPreviewMessage(`从第 ${firstNode.order} 小节开始。`);
  }

  function advanceAxisPreview() {
    if (!selectedVersion || !axisPreviewNodeId) return;
    const currentIndex = selectedVersion.nodes.findIndex((node) => node.id === axisPreviewNodeId);
    const currentNode = selectedVersion.nodes[currentIndex];
    if (!currentNode) return;
    if (currentNode.configuration.terminal === true) {
      setAxisPreviewMessage(`第 ${currentNode.order} 小节是结束节点，路径预演已完成。`);
      return;
    }
    const nextNode = currentNode.nextNodeKey
      ? selectedVersion.nodes.find((node) => node.key === currentNode.nextNodeKey)
      : selectedVersion.nodes[currentIndex + 1];
    if (!nextNode) {
      setAxisPreviewMessage(currentNode.nextNodeKey
        ? `第 ${currentNode.order} 小节的跳转目标已经失效。`
        : `第 ${currentNode.order} 小节之后没有节点，路径在这里中断。`);
      return;
    }
    if (axisPreviewVisitedIds.includes(nextNode.id)) {
      setAxisPreviewMessage(`检测到循环：路径再次回到第 ${nextNode.order} 小节，预演已停止。`);
      return;
    }
    setAxisPreviewNodeId(nextNode.id);
    setAxisPreviewVisitedIds((current) => [...current, nextNode.id]);
    setAxisPreviewMessage(currentNode.nextNodeKey
      ? `按跳转连接进入第 ${nextNode.order} 小节。`
      : `按顺序进入第 ${nextNode.order} 小节。`);
  }

  function stopAxisPreview() {
    setAxisPreviewNodeId(null);
    setAxisPreviewVisitedIds([]);
    setAxisPreviewMessage("");
  }

  useEffect(() => {
    if (!axisPreviewNodeId) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`teaching-axis-node-${axisPreviewNodeId}`)?.scrollIntoView({ block: "nearest", inline: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [axisPreviewNodeId]);

  if (!selectedModule) {
    return <div className="border bg-[var(--card)] px-6 py-12 text-center text-sm">当前应用还没有可编排的互动教材。</div>;
  }

  const chapterModules = data.modules.filter(item => item.chapterId === selectedModule.chapterId);
  const publishedModuleCount = chapterModules.filter(item => item.versions.some(version => version.status === "published" && version.nodes.length > 0)).length;
  const textbookPublished = selectedModule.textbookStatus === "published" && selectedModule.chapterStatus === "published" && selectedModule.textbookVersion.status === "published";
  const returnTo = chapterId ? `${pathname}?chapter=${encodeURIComponent(chapterId)}` : pathname;
  const draft = selectedModule.versions.find((item) => item.status === "draft");
  const editable = selectedVersion?.status === "draft";
  const selectedNodeFormId = selectedNode ? `teaching-script-node-form-${selectedNode.id}` : undefined;
  const orchestrationGridStyle = {
    gridTemplateColumns: `7rem repeat(${selectedVersion?.nodes.length ?? 0}, 13rem)`,
  };

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-lg border border-[var(--border)] p-4" aria-label="本章准备情况">
        <CardTitleWithHint headingLevel={2} title={`第 ${selectedModule.chapterNumber} 章准备情况`} description="教材发布与脚本发布分别统计。下方按正式脚本检查基础配置，不能代替视频播放、学生授权与开放规则核验。点击学习步骤可进入处理。" />
        <p className="text-sm">对应教材版本 {selectedModule.textbookVersion.number} · {versionLabel(selectedModule.textbookVersion.status)}。教材{ textbookPublished ? "已发布" : "尚未全部发布" }；正式脚本 {publishedModuleCount}/{chapterModules.length} 个学习步骤。</p>
        {selectedModule.textbookVersion.newerDraftNumber !== null && <p role="status" className="text-sm text-[var(--status-warning)]">教材另有版本 {selectedModule.textbookVersion.newerDraftNumber} 草稿。当前脚本仍对应版本 {selectedModule.textbookVersion.number}，教材草稿修改不会显示在这里；切换教材版本后需重新核对脚本与活动。</p>}
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {chapterModules.map(item => {
            const published = item.versions.find(version => version.status === "published");
            const summary = scriptVersionSummary(published);
            const reviewLabel = published?.sourceReviewStatus === "reviewed" ? "教材已复核" : published?.sourceReviewStatus === "changed" ? "教材或脚本变化待复核" : "教材待复核";
            const status = !published || !summary.nodeCount ? "待发布脚本" : summary.reviewIssues ? `正式脚本有 ${summary.reviewIssues} 项待检查` : "正式脚本基础配置已填写";
            return <li key={item.id}><button type="button" onClick={() => selectLearningStep(item.id)} className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-left text-sm hover:bg-[var(--surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">
              <span className="block font-medium">{moduleLabels[item.code] ?? item.title["zh-CN"]}</span>
              <span className="block text-xs text-[var(--foreground-muted)]">{status} · {reviewLabel}{item.versions.some(version => version.status === "draft") ? " · 另有未发布草稿" : ""}</span>
            </button></li>;
          })}
        </ul>
        <p className="text-sm">教材练习引用：{({ unknown: "暂时无法核验", unlinked: "尚未关联", disabled: "已停用", unavailable: "教材来源不可用", review: "教材已变化，待复核", linked: "已关联，内容已核对" })[selectedModule.practiceStatus]}。
          {pathname.endsWith("/teaching-scripts") && <Link className="ml-2 underline underline-offset-4" href={`${pathname.slice(0, -"teaching-scripts".length)}toolbox?chapter=${encodeURIComponent(selectedModule.chapterId)}`}>核对本章练习</Link>}
        </p>

      </section>
      <ChapterReleaseCheckPanel key={selectedModule.chapterId} appId={data.appId} chapterId={selectedModule.chapterId} disabled={hasUnsavedChanges || nodeSavePending} />
      {selectedVersion && <ScriptSourceReviewPanel key={`${selectedVersion.id}:${selectedVersion.sourceReviewStatus}`} versionId={selectedVersion.id} disabled={hasUnsavedChanges || nodeSavePending} archived={selectedVersion.status === "archived"} />}
      <section className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_96%,transparent)] px-4 py-3 shadow-sm backdrop-blur" aria-label="教学脚本版本工具栏">
        <div className="min-w-0 flex-1">
          <p className="mb-1 truncate text-xs font-medium text-[var(--muted-foreground)]">{selectedModule.textbookTitle["zh-CN"]} / 第 {selectedModule.chapterNumber} 章</p>
          <h2 className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
            <strong className="text-base">{moduleLabels[selectedModule.code] ?? selectedModule.title["zh-CN"]}</strong>
            {selectedVersion && <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium">脚本版本 {selectedVersion.number} · {versionLabel(selectedVersion.status)}</span>}
          </h2>
          {selectedVersion && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted-foreground)]" aria-label="当前学习步骤检查概览">
              <span>{selectedVersionSummary.nodeCount} 个教学小节</span>
              <span>{selectedVersionSummary.interactionNodes} 个学生互动</span>
              <span>{selectedVersionSummary.videoNodeCount > 0 ? `${selectedVersionSummary.videoNodeCount} 个视频小节 · ${selectedVersionSummary.videoIssueCount} 项视频待配置` : `${selectedVersionSummary.readySpeechAssets} 条正式语音就绪`}</span>
              <span className={selectedVersionSummary.reviewIssues > 0 ? "font-semibold text-[var(--status-warning)]" : "font-semibold text-[var(--status-success)]"}>
                {selectedVersionSummary.reviewIssues > 0 ? `待检查 ${selectedVersionSummary.reviewIssues} 项` : "基础配置已填写，发布前仍需校验"}
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
                <form action={async (formData) => {
                  setPublishIssue(null);
                  try {
                    const result = await publishTeachingScriptAction(formData);
                    if (!result.ok) setPublishIssue({ message: result.message ?? "发布失败，请重试。", nodeKey: result.nodeKey });
                  } catch { setPublishIssue({ message: "发布失败，请稍后重试。" }); }
                }} onSubmit={(event) => { if (!requireSavedChanges()) event.preventDefault(); }} className="mt-4 space-y-3">
                  {publishIssue && <div role="alert" className="space-y-2 text-sm text-[var(--status-danger)]"><p>{publishIssue.message}</p>{publishIssue.nodeKey && <button type="button" className="min-h-11 underline" onClick={() => { const node = selectedVersion.nodes.find((item) => item.key === publishIssue.nodeKey); if (node) selectNode(node.id, publishIssue.message.includes("讲解片段") ? "script" : "interaction", publishIssue.message.includes("讲解片段") ? "script" : "teacher_prompt"); }}>打开需要修改的小节</button>}</div>}
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

      {/* No `overflow-hidden`: it silently breaks two things here — the nav
          column's `xl:sticky` (any ancestor with overflow other than visible
          defeats position: sticky), and native <select> popups nested deeper
          in this tree, whose click hit-testing Chromium clips to the nearest
          `overflow: hidden` ancestor's box even though the popup still paints
          outside it (see formGroupClass in TeachingScriptNodeForm.tsx). */}
      <div className={`grid min-h-[640px] rounded-xl border border-[var(--border)] bg-[var(--card)] ${columnsGridClass}`}>
        <nav className={`${showStructureNav ? "block" : "hidden"} border-b bg-[var(--muted)]/25 lg:self-start lg:border-b-0 lg:border-r`} aria-label="课程结构">
          <div className="flex min-h-14 items-center justify-between gap-2 border-b px-3 py-2">
            {showStructureNav && (
              <div className="min-w-0 flex-1 text-center">
                <h2 className="text-sm font-bold">课程与教学步骤</h2>
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
              <section key={chapterNumber} className="mb-2">
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
                    const stepLabel = moduleLabels[lessonModule.code] ?? lessonModule.title["zh-CN"];
                    const versionStatus = version ? versionLabel(version.status) : "未创建";
                    return (
                      <button key={lessonModule.id} type="button" onClick={() => selectLearningStep(lessonModule.id)} aria-current={selected ? "page" : undefined} aria-label={`第 ${chapterNumber} 章第 ${lessonModule.order} 步：${stepLabel}，${version?.nodes.length ?? 0} 个教学小节，${versionStatus}`} className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] ${selected ? "border-[var(--primary)] bg-[var(--accent)] font-semibold" : "border-transparent hover:bg-[var(--card)]"}`}>
                        <span className="min-w-0"><span className="block truncate">{stepLabel}</span><span className="mt-1 block text-xs font-normal text-[var(--muted-foreground)]">{version?.nodes.length ?? 0} 个小节 · {versionStatus}</span></span>
                        <span className="shrink-0 text-xs tabular-nums text-[var(--muted-foreground)]">{lessonModule.order}</span>
                      </button>
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
              <header className="flex min-h-14 items-center justify-between gap-3 border-b bg-[var(--card)] px-4 py-2">
                <div className="flex min-w-0 items-center gap-3">
                  {!showStructureNav && (
                    <button type="button" onClick={() => setShowStructureNav(true)} aria-label="显示课程结构" aria-expanded={false} title="显示课程结构" className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--foreground-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                      <PanelLeftOpen size={15} aria-hidden="true" />
                    </button>
                  )}
                  {!showOrchestrationAxis && (
                    <button type="button" onClick={() => setShowOrchestrationAxis(true)} aria-label="显示教学编排轴" aria-expanded={false} title="显示教学编排轴" className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--foreground-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                      <ListTree size={16} aria-hidden="true" />
                    </button>
                  )}
                  {!showOrchestrationAxis && <select aria-label="选择教学小节" value={selectedNode.id} onChange={(event) => selectNode(event.target.value)} className="app-input h-10 max-w-52 min-w-0 rounded-lg border px-2 text-sm">
                    {selectedVersion.nodes.map((node, index) => <option key={node.id} value={node.id}>第 {index + 1} 小节 · {node.title["zh-CN"] || "未命名小节"}</option>)}
                  </select>}
                  <div className="min-w-0">
                    <h2 className="flex flex-wrap items-center gap-2 text-base font-bold">
                      <span id="subsection-editor-title">第 {selectedVersion.nodes.findIndex((item) => item.id === selectedNode.id) + 1} 小节 · {selectedNode.title["zh-CN"] || "未命名小节"}</span>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${editable ? "border-[var(--status-warning)] text-[var(--status-warning)]" : "border-[var(--border)] text-[var(--muted-foreground)]"}`}>{editable ? "草稿编辑中" : "已发布 · 只读"}</span>
                    </h2>
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
              {showOrchestrationAxis && (
                <section className="border-b border-[var(--border)] bg-[var(--card)]" aria-labelledby="teaching-orchestration-title">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
                    <div id="teaching-orchestration-title">
                      <CardTitleWithHint headingLevel={3} title="教学编排轴" description="选择轨道单元格，在下方编辑对应内容。横向滚动可查看其他小节；不需要总览时可收起编排轴。" hintLabel="查看编排轴使用说明" titleClassName="text-sm font-bold" />
                    </div>
                    <div className="flex items-center gap-2">
                      {axisPreviewNodeId ? (
                        <>
                          <button type="button" onClick={advanceAxisPreview} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--status-success)] px-3 text-xs font-semibold text-[var(--status-success)] transition hover:bg-[var(--status-success-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"><StepForward size={15} aria-hidden="true" />下一节点</button>
                          <button type="button" onClick={stopAxisPreview} aria-label="退出路径预演" title="退出路径预演" className="flex size-11 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--foreground-secondary)] transition hover:border-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"><X size={16} aria-hidden="true" /></button>
                        </>
                      ) : (
                        <button type="button" onClick={startAxisPreview} disabled={Boolean(flowBindingSourceNodeId)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--foreground-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-45"><Play size={15} aria-hidden="true" />路径预演</button>
                      )}
                      {editable && (
                        <>
                          <div className="flex items-center gap-1" aria-label="调整当前小节顺序">
                            <form action={moveTeachingScriptNodeAction} onSubmit={(event) => { if (!requireSavedChanges()) event.preventDefault(); }}>
                              <input type="hidden" name="node_id" value={selectedNode.id} /><input type="hidden" name="direction" value="up" /><input type="hidden" name="return_to" value={returnTo} />
                              <FormSubmitButton pendingLabel="正在前移…" iconOnly disabled={selectedVersion.nodes.findIndex((node) => node.id === selectedNode.id) === 0} aria-label={`向前移动“${selectedNode.title["zh-CN"]}”`} className="flex size-11 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-30"><ArrowLeft size={15} aria-hidden="true" /></FormSubmitButton>
                            </form>
                            <form action={moveTeachingScriptNodeAction} onSubmit={(event) => { if (!requireSavedChanges()) event.preventDefault(); }}>
                              <input type="hidden" name="node_id" value={selectedNode.id} /><input type="hidden" name="direction" value="down" /><input type="hidden" name="return_to" value={returnTo} />
                              <FormSubmitButton pendingLabel="正在后移…" iconOnly disabled={selectedVersion.nodes.findIndex((node) => node.id === selectedNode.id) === selectedVersion.nodes.length - 1} aria-label={`向后移动“${selectedNode.title["zh-CN"]}”`} className="flex size-11 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-30"><ArrowRight size={15} aria-hidden="true" /></FormSubmitButton>
                            </form>
                          </div>
                          <form action={addTeachingScriptNodeAction} onSubmit={(event) => { if (!requireSavedChanges()) event.preventDefault(); }}>
                            <input type="hidden" name="version_id" value={selectedVersion.id} />
                            <input type="hidden" name="return_to" value={returnTo} />
                            <FormSubmitButton pendingLabel="正在新增…" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary)] transition hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-wait disabled:opacity-60"><Plus size={15} aria-hidden="true" />新增小节</FormSubmitButton>
                          </form>
                        </>
                      )}
                      <button type="button" onClick={() => { setShowOrchestrationAxis(false); setFlowBindingSourceNodeId(null); }} aria-label="隐藏教学编排轴" aria-expanded={true} title="隐藏教学编排轴" className="flex size-11 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--foreground-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                        <PanelLeftClose size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  {flowBindingSourceNode && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--status-warning)] bg-[var(--status-warning-surface)] px-4 py-3" role="status" aria-live="polite">
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        正在连接第 {flowBindingSourceNode.order} 小节“{flowBindingSourceNode.title["zh-CN"]}”。请点击另一个小节轴点作为目标。
                      </p>
                      <button type="button" onClick={() => setFlowBindingSourceNodeId(null)} className="inline-flex min-h-11 items-center rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-xs font-semibold text-[var(--foreground-secondary)] transition hover:border-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">取消绑定</button>
                    </div>
                  )}
                  {axisPreviewNodeId && (
                    <div className="flex flex-wrap items-center gap-3 border-b border-[var(--status-success)] bg-[var(--status-success-surface)] px-4 py-3" role="status" aria-live="polite">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--status-success)] text-xs font-bold text-[var(--status-success-foreground)]">{axisPreviewVisitedIds.length}</span>
                      <p className="text-sm font-semibold text-[var(--foreground)]">{axisPreviewMessage}</p>
                    </div>
                  )}
                  <div className="overflow-x-auto" role="region" tabIndex={0} aria-label="可横向滚动的教学编排轴">
                    <div className="min-w-max">
                      <div className="relative grid border-b border-[var(--border)] bg-[var(--muted)]/20" style={orchestrationGridStyle}>
                        <TeachingConnectionOverlay nodes={selectedVersion.nodes} />
                        <div className="sticky left-0 z-20 flex min-h-16 items-center border-r border-[var(--border)] bg-[var(--card)] px-2 text-xs font-bold text-[var(--foreground-secondary)]">教学小节</div>
                        {selectedVersion.nodes.map((node, index) => {
                          const nodeSelected = node.id === selectedNode.id;
                          const previewed = node.id === axisPreviewNodeId;
                          const issueCount = orchestrationNodeIssueCount(node, selectedVersion.nodes);
                          return (
                            <div key={node.id} className={`relative flex min-h-16 min-w-0 items-center border-r border-[var(--border)] p-1 last:border-r-0 ${nodeSelected ? "bg-[var(--accent)]/70" : ""} ${previewed ? "bg-[var(--status-success-surface)] ring-2 ring-inset ring-[var(--status-success)]" : ""} ${flowBindingSourceNodeId && node.id !== flowBindingSourceNodeId ? "ring-2 ring-inset ring-[var(--primary)]" : ""}`}>
                              <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-[var(--border)]" aria-hidden="true" />
                              <button id={`teaching-axis-node-${node.id}`} type="button" onClick={() => selectNode(node.id)} aria-current={nodeSelected ? "step" : undefined} aria-label={flowBindingSourceNodeId && node.id !== flowBindingSourceNodeId ? `绑定到第 ${node.order} 小节：${node.title["zh-CN"]}` : `选择第 ${node.order} 小节：${node.title["zh-CN"]}`} className="relative z-20 flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg px-1 py-1 text-left transition hover:bg-[var(--card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                                <span data-axis-point={index} className={`relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full ring-4 ring-[var(--card)] text-xs font-bold tabular-nums ${previewed ? "bg-[var(--status-success)] text-[var(--status-success-foreground)]" : nodeSelected ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "bg-[var(--muted)] text-[var(--foreground-secondary)]"}`}>{index + 1}</span>
                                <span className="min-w-0 flex-1">
                                  <span className="line-clamp-2 text-xs font-semibold leading-4 text-[var(--foreground)]" title={node.title["zh-CN"] || "未命名小节"}>{node.title["zh-CN"] || "未命名小节"}</span>
                                  {issueCount > 0 && <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--status-danger)]"><AlertTriangle size={11} aria-hidden="true" />{issueCount} 项</span>}
                                </span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
{orchestrationTracks.filter((track) => track.id !== "content" || selectedVersion.nodes.some((node) => normalizeTeachingVideo(node.configuration.teacherVideo).mode !== "video")).map((track) => {
                        const TrackIcon = track.icon;
                        return (
                          <div key={track.id} className="grid border-b border-[var(--border)] last:border-b-0" style={orchestrationGridStyle}>
                            <div className="sticky left-0 z-20 flex min-h-9 items-center gap-1.5 border-r border-[var(--border)] bg-[var(--card)] px-2 text-xs font-bold text-[var(--foreground-secondary)]">
                              <TrackIcon size={14} aria-hidden="true" />{track.label}
                            </div>
                            {selectedVersion.nodes.map((node) => {
                              const cell = orchestrationCell(node, track.id, selectedVersion.nodes, selectedModule.activities);
                              const selected = node.id === selectedNode.id && track.id === selectedOrchestrationTrackId;
                              const previewed = node.id === axisPreviewNodeId;
                              const StatusIcon = track.id === "flow" && node.nextNodeKey ? Route : cell.configured ? CheckCircle2 : Circle;
                              return (
                                <button key={`${node.id}-${track.id}`} type="button" onClick={() => selectNode(node.id, track.section, track.id)} aria-pressed={selected} aria-label={flowBindingSourceNodeId && node.id !== flowBindingSourceNodeId ? `绑定到第 ${node.order} 小节：${node.title["zh-CN"]}` : `第 ${node.order} 小节，${track.label}：${cell.label}`} title={cell.label} className={`flex min-h-9 min-w-0 items-center gap-1.5 border-r border-[var(--border)] px-2 py-1 text-left text-xs transition last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] ${selected ? "bg-[var(--accent)] font-bold text-[var(--primary)]" : previewed ? "bg-[var(--status-success-surface)] font-semibold text-[var(--foreground)]" : "bg-[var(--card)] text-[var(--foreground-secondary)] hover:bg-[var(--muted)]/45"} ${flowBindingSourceNodeId && node.id !== flowBindingSourceNodeId ? "ring-1 ring-inset ring-[var(--primary)]" : ""}`}>
                                  <StatusIcon size={14} className={`shrink-0 ${cell.configured ? "text-[var(--status-success)]" : "text-[var(--muted-foreground)]"}`} aria-hidden="true" />
                                  <span className="truncate leading-4">{cell.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              )}
              <div className="p-3 lg:p-4">
                <TeachingScriptNodeForm key={selectedNode.id} formId={selectedNodeFormId} node={selectedNode} allNodes={selectedVersion.nodes} activities={selectedModule.activities} learningTargets={selectedModule.learningTargets} templates={data.characterStyleTemplates} blackboardLayoutTemplates={data.blackboardLayoutTemplates} moduleCode={selectedModule.code} moduleOrder={selectedModule.order} returnTo={returnTo} editable={editable} previewUrl={previewUrl} editorSection={editorSection} onEditorSectionChange={changeEditorSection} showSectionNavigation={!showOrchestrationAxis} interactionFocusRequest={interactionFocusRequest} onStartFlowBinding={startFlowBinding} flowBindingRequest={flowBindingRequest} onFlowBindingApplied={(requestId) => setFlowBindingRequest((current) => current?.id === requestId ? null : current)} onDirtyChange={setHasUnsavedChanges} onPendingChange={setNodeSavePending} />
              </div>
            </>
          ) : <div className="flex min-h-80 items-center justify-center p-8 text-center text-sm text-[var(--muted-foreground)]">请先选择一个教学小节。</div>}
        </section>
      </div>

    </div>
  );
}
