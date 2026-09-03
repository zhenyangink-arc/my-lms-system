"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { AlignCenter, AlignLeft, AlignRight, CheckCircle2, Copy, FolderOpen, ImageIcon, Languages, List, LoaderCircle, Plus, RefreshCw, Search, Trash2, Type, VideoIcon, X } from "lucide-react";

import {
  deleteBlackboardLayoutTemplateAction,
  listBlackboardMediaObjectsAction,
  saveBlackboardLayoutTemplateAction,
  verifyBlackboardMediaObjectAction,
} from "@/app/dashboard/admin/teaching-scripts/actions";
import { TeachingBlackboardSlideView, type BlackboardResizeHandle } from "@/components/learning-agent/TeachingBlackboardSlide";
import {
  teachingBlackboardSlidesFromDisplay,
  teachingBlackboardSlideFitsHeader,
  BLACKBOARD_MEDIA_OBJECT_KEY_PREFIX,
  MAX_TEACHING_BLACKBOARD_ELEMENTS,
  MAX_TEACHING_BLACKBOARD_SLIDES,
  type TeachingBlackboardBackground,
  type TeachingBlackboardElement,
  type TeachingBlackboardElementType,
  type TeachingBlackboardSlide,
  type TeachingBlackboardTone,
} from "@/lib/teaching-blackboard";
import type { BlackboardLayoutTemplate } from "./types";

const controlClass = "app-input min-h-11 w-full border px-2.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60 sm:text-xs";
const smallButtonClass = "inline-flex min-h-11 items-center justify-center gap-1.5 border border-[var(--border)] bg-[var(--card)] px-3 text-xs font-semibold text-[var(--foreground-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50";

function nextId(prefix: string) {
  return `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function defaultElement(type: TeachingBlackboardElementType, count: number): TeachingBlackboardElement {
  const common = {
    id: nextId("element"), x: 8, y: 10 + Math.min(count, 5) * 9, width: 84, height: 10,
    fontWeight: 600 as const, align: "left" as const, tone: "default" as const,
  };
  if (type === "bullets") return { ...common, type, content: "第一个要点\n第二个要点", height: 18, fontSize: 20, tone: "primary" };
  if (type === "expression") return { ...common, type, content: "안녕하세요?", translation: "你好？", height: 16, fontSize: 28, fontWeight: 700, tone: "highlight" };
  if (type === "image" || type === "video") return { ...common, type, content: "", width: 60, height: 50, fontSize: 22 };
  return { ...common, type, content: "输入黑板文字", fontSize: 28, fontWeight: 700 };
}

function defaultContentForType(type: TeachingBlackboardElementType): { content: string; translation?: string } {
  if (type === "bullets") return { content: "第一个要点\n第二个要点" };
  if (type === "expression") return { content: "안녕하세요?", translation: "你好？" };
  return { content: "输入黑板文字" };
}

function emptySlide(index: number, segmentIndex: number): TeachingBlackboardSlide {
  return {
    id: nextId("slide"),
    name: `画面 ${index + 1}`,
    segmentIndex,
    background: "plain",
    elements: [],
  };
}

function lineLabel(line: string, index: number) {
  const plain = line.replace(/\[(?:\/?b|\/?u|\/?color(?:=[^\]]+)?)\]/g, "").replace(/\s+/g, " ").trim();
  return `台词 ${index + 1}${plain ? `：${plain.slice(0, 18)}${plain.length > 18 ? "…" : ""}` : ""}`;
}

function formatMediaSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function formatMediaDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

type MediaBrowserState = {
  elementId: string;
  kind: "image" | "video";
  status: "loading" | "ready" | "error";
  objects: { key: string; size: number; lastModified: string }[];
  message?: string;
  search: string;
  /** True when R2 has more than the single page this fetched (1000 objects)
   * — the list is real but may not be complete, so the panel says so rather
   * than silently showing a partial result as if it were everything. */
  truncated?: boolean;
};

/** Lets an admin pick from files already sitting in R2 (under
 * blackboard/image/ or blackboard/video/) instead of typing an object key
 * from memory — images show a small thumbnail, videos show a generic icon;
 * a client-side search narrows the already-loaded list by filename. */
function MediaBrowserPanel({
  browser,
  onSearchChange,
  onRefresh,
  onSelect,
  onClose,
  pending,
}: {
  browser: MediaBrowserState;
  onSearchChange: (search: string) => void;
  onRefresh: () => void;
  onSelect: (objectKey: string) => void;
  onClose: () => void;
  pending: boolean;
}) {
  const query = browser.search.trim().toLowerCase();
  const filtered = query ? browser.objects.filter((item) => item.key.toLowerCase().includes(query)) : browser.objects;

  return (
    <div className="space-y-2 border border-[var(--border)] bg-[var(--muted)]/20 p-2">
      <div className="flex items-center gap-1.5">
        <div className="app-input flex min-h-9 min-w-0 flex-1 items-center gap-1.5 rounded border px-2">
          <Search size={12} className="shrink-0 text-[var(--foreground-muted)]" aria-hidden="true" />
          <input
            value={browser.search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="按文件名搜索"
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-xs outline-none"
          />
        </div>
        <button type="button" onClick={onRefresh} disabled={pending} aria-label="刷新列表" className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-[var(--border)] bg-[var(--card)] text-[var(--foreground-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50">
          <RefreshCw size={13} className={pending ? "animate-spin motion-reduce:animate-none" : ""} aria-hidden="true" />
        </button>
        <button type="button" onClick={onClose} aria-label="关闭浏览" className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-[var(--border)] bg-[var(--card)] text-[var(--foreground-secondary)] hover:border-[var(--status-danger)] hover:text-[var(--status-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
          <X size={13} aria-hidden="true" />
        </button>
      </div>
      {browser.status === "loading" ? (
        <p className="flex items-center gap-1.5 text-xs text-[var(--foreground-muted)]"><LoaderCircle size={13} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />正在加载列表…</p>
      ) : browser.status === "error" ? (
        <p className="text-xs font-medium text-[var(--status-danger)]" role="alert">{browser.message}</p>
      ) : browser.objects.length === 0 ? (
        <p className="text-xs leading-5 text-[var(--foreground-muted)]">R2 的 {BLACKBOARD_MEDIA_OBJECT_KEY_PREFIX}{browser.kind}/ 目录下还没有文件。</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs leading-5 text-[var(--foreground-muted)]">没有文件名匹配“{browser.search}”。</p>
      ) : (
        <ul className="grid max-h-64 gap-1 overflow-y-auto">
          {filtered.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => onSelect(item.key)}
                className="flex w-full min-w-0 items-center gap-2 border border-transparent p-1.5 text-left hover:border-[var(--primary)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                {browser.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- 私有 R2 缩略图，走鉴权路由，不是可优化的静态资源。
                  <img src={`/api/learning-agent/blackboard-media?key=${encodeURIComponent(item.key)}`} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-[var(--muted)] text-[var(--foreground-muted)]"><VideoIcon size={14} aria-hidden="true" /></span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-[var(--foreground)]">{item.key.split("/").pop()}</span>
                  <span className="block text-[10px] text-[var(--foreground-muted)]">{formatMediaSize(item.size)}{item.lastModified ? ` · ${formatMediaDate(item.lastModified)}` : ""}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {browser.status === "ready" && browser.objects.length > 0 ? (
        <p className="text-[10px] text-[var(--foreground-muted)]">共 {browser.objects.length} 个文件{filtered.length !== browser.objects.length ? `，匹配 ${filtered.length} 个` : ""}</p>
      ) : null}
      {browser.status === "ready" && browser.truncated ? (
        <p className="text-[10px] font-medium text-[var(--status-warning)]">文件超过 1000 个，只显示了一部分，用搜索缩小范围。</p>
      ) : null}
    </div>
  );
}

export function TeachingBlackboardEditor({
  display,
  scriptLines,
  disabled,
  onDirty,
  onSlidesChange,
  layoutTemplates,
  returnTo,
}: {
  display: Record<string, unknown>;
  scriptLines: string[];
  disabled?: boolean;
  onDirty: () => void;
  onSlidesChange?: (slides: TeachingBlackboardSlide[]) => void;
  layoutTemplates: BlackboardLayoutTemplate[];
  returnTo: string;
}) {
  const [slides, setSlides] = useState<TeachingBlackboardSlide[]>(() => {
    const saved = teachingBlackboardSlidesFromDisplay(display);
    return saved.length ? saved : [emptySlide(0, 0)];
  });
  const [selectedSlideId, setSelectedSlideId] = useState(() => slides[0]?.id ?? "");
  const [selectedElementId, setSelectedElementId] = useState<string | null>(() => slides[0]?.elements[0]?.id ?? null);
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [mediaVerify, setMediaVerify] = useState<{ elementId: string; status: "checking" | "error" | "success"; message?: string; size?: number } | null>(null);
  const [mediaVerifyPending, startMediaVerifyTransition] = useTransition();
  const [mediaBrowser, setMediaBrowser] = useState<MediaBrowserState | null>(null);
  const [mediaBrowserPending, startMediaBrowserTransition] = useTransition();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ elementId: string; offsetX: number; offsetY: number } | null>(null);
  const resizeRef = useRef<{
    elementId: string;
    handle: BlackboardResizeHandle;
    startPointerX: number;
    startPointerY: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);
  const selectedSlide = slides.find((slide) => slide.id === selectedSlideId) ?? slides[0];
  const selectedElement = selectedSlide?.elements.find((element) => element.id === selectedElementId) ?? null;
  const maximumSegmentIndex = Math.max(0, scriptLines.length - 1);
  const slidesForSave = useMemo(() => slides.map((slide) => ({
    ...slide,
    segmentIndex: Math.min(slide.segmentIndex, maximumSegmentIndex),
  })), [maximumSegmentIndex, slides]);
  const serialized = useMemo(() => JSON.stringify({ mode: "slides", slides: slidesForSave }), [slidesForSave]);
  const duplicateSegmentIndexes = useMemo(() => {
    const counts = new Map<number, number>();
    for (const slide of slidesForSave) counts.set(slide.segmentIndex, (counts.get(slide.segmentIndex) ?? 0) + 1);
    return new Set([...counts].filter(([, count]) => count > 1).map(([segmentIndex]) => segmentIndex));
  }, [slidesForSave]);
  const oversizedSlideNames = useMemo(() => slidesForSave
    .filter((slide) => !teachingBlackboardSlideFitsHeader(slide))
    .map((slide) => slide.name), [slidesForSave]);
  const [layoutTemplateId, setLayoutTemplateId] = useState("");
  const [newLayoutTemplateName, setNewLayoutTemplateName] = useState("");
  const [saveLayoutPending, startSaveLayoutTransition] = useTransition();
  const [deleteLayoutPending, startDeleteLayoutTransition] = useTransition();
  const [layoutTemplateError, setLayoutTemplateError] = useState("");

  useEffect(() => {
    onSlidesChange?.(slidesForSave);
  }, [onSlidesChange, slidesForSave]);

  function commit(updater: (current: TeachingBlackboardSlide[]) => TeachingBlackboardSlide[]) {
    setSlides(updater);
    onDirty();
  }

  function updateSlide(patch: Partial<TeachingBlackboardSlide>) {
    if (!selectedSlide) return;
    commit((current) => current.map((slide) => slide.id === selectedSlide.id ? { ...slide, ...patch } : slide));
  }

  function updateElementById(elementId: string, patch: Partial<TeachingBlackboardElement>) {
    if (!selectedSlide) return;
    commit((current) => current.map((slide) => slide.id === selectedSlide.id
      ? { ...slide, elements: slide.elements.map((element) => {
          if (element.id !== elementId) return element;
          const next = { ...element, ...patch };
          return { ...next, x: Math.min(next.x, 100 - next.width), y: Math.min(next.y, 100 - next.height) };
        }) }
      : slide));
  }

  function updateElement(patch: Partial<TeachingBlackboardElement>) {
    if (!selectedElement) return;
    updateElementById(selectedElement.id, patch);
  }

  function addSlide() {
    if (slides.length >= MAX_TEACHING_BLACKBOARD_SLIDES) return;
    const slide = emptySlide(slides.length, Math.min(slides.length, Math.max(0, scriptLines.length - 1)));
    commit((current) => [...current, slide]);
    setSelectedSlideId(slide.id);
    setSelectedElementId(null);
  }

  function duplicateSlide() {
    if (!selectedSlide || slides.length >= MAX_TEACHING_BLACKBOARD_SLIDES) return;
    const copy: TeachingBlackboardSlide = {
      ...selectedSlide,
      id: nextId("slide"),
      name: `${selectedSlide.name} 副本`.slice(0, 40),
      elements: selectedSlide.elements.map((element) => ({ ...element, id: nextId("element") })),
    };
    const index = slides.findIndex((slide) => slide.id === selectedSlide.id);
    commit((current) => [...current.slice(0, index + 1), copy, ...current.slice(index + 1)]);
    setSelectedSlideId(copy.id);
    setSelectedElementId(copy.elements[0]?.id ?? null);
  }

  function removeSlide() {
    if (!selectedSlide) return;
    if (selectedSlide.elements.length > 0 && !window.confirm(`确定删除黑板画面“${selectedSlide.name}”吗？`)) return;
    if (slides.length === 1) {
      const replacement = emptySlide(0, 0);
      commit(() => [replacement]);
      setSelectedSlideId(replacement.id);
      setSelectedElementId(null);
      return;
    }
    const index = slides.findIndex((slide) => slide.id === selectedSlide.id);
    const next = slides.filter((slide) => slide.id !== selectedSlide.id);
    commit(() => next);
    setSelectedSlideId(next[Math.min(index, next.length - 1)].id);
    setSelectedElementId(null);
  }

  function saveCurrentLayoutAsTemplate() {
    const name = newLayoutTemplateName.trim();
    // Layout templates only capture text/bullets/expression slots — a
    // photo or video can't meaningfully be "reapplied" to a different
    // slide the way position/size/style can, so media elements are left
    // out of the saved template entirely.
    const textLikeElements = selectedSlide?.elements.filter((element) => element.type !== "image" && element.type !== "video") ?? [];
    if (!name || !selectedSlide || textLikeElements.length === 0) return;
    setLayoutTemplateError("");
    startSaveLayoutTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("name", name);
        formData.set("background", selectedSlide.background);
        formData.set("elements_json", JSON.stringify(textLikeElements.map((element) => ({
          type: element.type,
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height,
          fontSize: Math.round(element.fontSize),
          fontWeight: element.fontWeight,
          align: element.align,
          tone: element.tone,
        }))));
        formData.set("return_to", returnTo);
        await saveBlackboardLayoutTemplateAction(formData);
        setNewLayoutTemplateName("");
      } catch (error) {
        setLayoutTemplateError(error instanceof Error ? error.message : "保存版式失败，请重试。");
      }
    });
  }

  function deleteLayoutTemplate(templateId: string) {
    if (!window.confirm("确定删除这个版式吗？")) return;
    setLayoutTemplateError("");
    startDeleteLayoutTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("template_id", templateId);
        formData.set("return_to", returnTo);
        await deleteBlackboardLayoutTemplateAction(formData);
        if (layoutTemplateId === templateId) setLayoutTemplateId("");
      } catch (error) {
        setLayoutTemplateError(error instanceof Error ? error.message : "删除版式失败，请重试。");
      }
    });
  }

  function applyLayoutTemplateToSlide() {
    const template = layoutTemplates.find((item) => item.id === layoutTemplateId);
    if (!template || !selectedSlide) return;
    commit((current) => current.map((slide) => {
      if (slide.id !== selectedSlide.id) return slide;
      // Layout templates only ever describe text/bullets/expression slots
      // (see saveCurrentLayoutAsTemplate) — map them onto the slide's own
      // text-like elements by index, and leave any image/video elements
      // untouched rather than have them fall into a template slot and have
      // their file reference silently overwritten.
      const textLikeElements = slide.elements.filter((element) => element.type !== "image" && element.type !== "video");
      const mediaElements = slide.elements.filter((element) => element.type === "image" || element.type === "video");
      const mapped: TeachingBlackboardElement[] = template.elements.map((spec, index) => {
        const existing = textLikeElements[index];
        const fallback = defaultContentForType(spec.type);
        return {
          id: existing?.id ?? nextId("element"),
          type: spec.type,
          content: existing?.content ?? fallback.content,
          translation: spec.type === "expression" ? (existing?.translation ?? fallback.translation) : undefined,
          x: spec.x,
          y: spec.y,
          width: spec.width,
          height: spec.height,
          fontSize: spec.fontSize,
          fontWeight: spec.fontWeight,
          align: spec.align,
          tone: spec.tone,
        };
      });
      const preservedTail = textLikeElements.slice(template.elements.length);
      return { ...slide, background: template.background, elements: [...mapped, ...preservedTail, ...mediaElements] };
    }));
    setSelectedElementId(null);
  }

  function addElement(type: TeachingBlackboardElementType) {
    if (!selectedSlide) return;
    if (selectedSlide.elements.length >= MAX_TEACHING_BLACKBOARD_ELEMENTS) return;
    const element = defaultElement(type, selectedSlide.elements.length);
    commit((current) => current.map((slide) => slide.id === selectedSlide.id
      ? { ...slide, elements: [...slide.elements, element] }
      : slide));
    setSelectedElementId(element.id);
  }

  /** 图片/视频不在这里上传——素材已经由管理员放进 R2，这里只负责校验填写的
   * 对象键真的指向一个存在的文件，避免存了一个打不开的死链接。 */
  function verifyMediaObject(element: TeachingBlackboardElement) {
    const objectKey = element.content.trim();
    const kind = element.type as "image" | "video";
    if (!objectKey) return;
    setMediaVerify({ elementId: element.id, status: "checking" });
    startMediaVerifyTransition(async () => {
      const result = await verifyBlackboardMediaObjectAction({ objectKey, kind });
      setMediaVerify(result.ok
        ? { elementId: element.id, status: "success", size: result.size }
        : { elementId: element.id, status: "error", message: result.message });
    });
  }

  /** Lets an admin pick from files already sitting in R2 instead of typing
   * an object key from memory. Fetches once when opened; the "刷新" button
   * re-fetches for whoever it's currently open for. */
  function loadMediaBrowser(elementId: string, kind: "image" | "video") {
    setMediaBrowser({ elementId, kind, status: "loading", objects: [], search: "" });
    startMediaBrowserTransition(async () => {
      const result = await listBlackboardMediaObjectsAction({ kind });
      setMediaBrowser((current) => {
        if (!current || current.elementId !== elementId) return current;
        return result.ok
          ? { ...current, status: "ready" as const, objects: result.objects ?? [], truncated: result.truncated }
          : { ...current, status: "error" as const, message: result.message };
      });
    });
  }

  function selectMediaObject(element: TeachingBlackboardElement, objectKey: string) {
    updateElementById(element.id, { content: objectKey });
    setMediaVerify(null);
    setMediaBrowser(null);
  }

  function removeElementById(elementId: string) {
    if (!selectedSlide) return;
    if (!selectedSlide.elements.some((item) => item.id === elementId)) return;
    commit((current) => current.map((slide) => slide.id === selectedSlide.id
      ? { ...slide, elements: slide.elements.filter((item) => item.id !== elementId) }
      : slide));
    if (selectedElementId === elementId) setSelectedElementId(null);
    if (editingElementId === elementId) setEditingElementId(null);
  }

  function removeElement() {
    if (!selectedElement) return;
    removeElementById(selectedElement.id);
  }

  function beginDrag(event: ReactPointerEvent<HTMLDivElement>, element: TeachingBlackboardElement) {
    if (disabled) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
    setSelectedElementId(element.id);
    dragRef.current = {
      elementId: element.id,
      offsetX: ((event.clientX - rect.left) / rect.width) * 100 - element.x,
      offsetY: ((event.clientY - rect.top) / rect.height) * 100 - element.y,
    };
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!drag || !rect || !selectedSlide) return;
    const element = selectedSlide.elements.find((item) => item.id === drag.elementId);
    if (!element) return;
    const x = Math.max(0, Math.min(100 - element.width, ((event.clientX - rect.left) / rect.width) * 100 - drag.offsetX));
    const y = Math.max(0, Math.min(100 - element.height, ((event.clientY - rect.top) / rect.height) * 100 - drag.offsetY));
    setSlides((current) => current.map((slide) => slide.id === selectedSlide.id
      ? { ...slide, elements: slide.elements.map((item) => item.id === element.id ? { ...item, x, y } : item) }
      : slide));
  }

  function endDrag() {
    if (dragRef.current) onDirty();
    dragRef.current = null;
  }

  const MIN_ELEMENT_WIDTH = 8;
  const MIN_ELEMENT_HEIGHT = 6;

  function beginResize(event: ReactPointerEvent<HTMLDivElement>, element: TeachingBlackboardElement, handle: BlackboardResizeHandle) {
    if (disabled) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedElementId(element.id);
    resizeRef.current = {
      elementId: element.id,
      handle,
      startPointerX: ((event.clientX - rect.left) / rect.width) * 100,
      startPointerY: ((event.clientY - rect.top) / rect.height) * 100,
      startX: element.x,
      startY: element.y,
      startWidth: element.width,
      startHeight: element.height,
    };
  }

  function moveResize(event: ReactPointerEvent<HTMLDivElement>) {
    const resize = resizeRef.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!resize || !rect || !selectedSlide) return;
    const pointerX = ((event.clientX - rect.left) / rect.width) * 100;
    const pointerY = ((event.clientY - rect.top) / rect.height) * 100;
    const deltaX = pointerX - resize.startPointerX;
    const deltaY = pointerY - resize.startPointerY;
    let { startX: x, startY: y, startWidth: width, startHeight: height } = resize;

    if (resize.handle.includes("e")) {
      width = Math.max(MIN_ELEMENT_WIDTH, Math.min(100 - resize.startX, resize.startWidth + deltaX));
    }
    if (resize.handle.includes("s")) {
      height = Math.max(MIN_ELEMENT_HEIGHT, Math.min(100 - resize.startY, resize.startHeight + deltaY));
    }
    if (resize.handle.includes("w")) {
      const rightEdge = resize.startX + resize.startWidth;
      x = Math.max(0, Math.min(rightEdge - MIN_ELEMENT_WIDTH, resize.startX + deltaX));
      width = rightEdge - x;
    }
    if (resize.handle.includes("n")) {
      const bottomEdge = resize.startY + resize.startHeight;
      y = Math.max(0, Math.min(bottomEdge - MIN_ELEMENT_HEIGHT, resize.startY + deltaY));
      height = bottomEdge - y;
    }

    setSlides((current) => current.map((slide) => slide.id === selectedSlide.id
      ? { ...slide, elements: slide.elements.map((item) => item.id === resize.elementId ? { ...item, x, y, width, height } : item) }
      : slide));
  }

  function endResize() {
    if (resizeRef.current) onDirty();
    resizeRef.current = null;
  }

  function beginEditingElement(element: TeachingBlackboardElement) {
    if (disabled) return;
    setSelectedElementId(element.id);
    // Image/video content is an R2 object key, not display text — editing it
    // goes through the sidebar's browse/verify flow, not an inline textarea.
    if (element.type === "image" || element.type === "video") return;
    setEditingElementId(element.id);
  }

  function handleElementKeyDown(event: ReactKeyboardEvent<HTMLDivElement>, element: TeachingBlackboardElement) {
    if (disabled) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (selectedElementId === element.id) {
        beginEditingElement(element);
      } else {
        setSelectedElementId(element.id);
      }
      return;
    }
    if ((event.key === "Delete" || event.key === "Backspace") && selectedElementId === element.id) {
      event.preventDefault();
      removeElementById(element.id);
      return;
    }
    const step = event.shiftKey ? 5 : 1;
    const movement = event.key === "ArrowLeft"
      ? { x: -step, y: 0 }
      : event.key === "ArrowRight"
        ? { x: step, y: 0 }
        : event.key === "ArrowUp"
          ? { x: 0, y: -step }
          : event.key === "ArrowDown"
            ? { x: 0, y: step }
            : null;
    if (!movement || !selectedSlide) return;
    event.preventDefault();
    setSelectedElementId(element.id);
    commit((current) => current.map((slide) => slide.id === selectedSlide.id
      ? {
          ...slide,
          elements: slide.elements.map((item) => item.id === element.id ? {
            ...item,
            x: Math.max(0, Math.min(100 - item.width, item.x + movement.x)),
            y: Math.max(0, Math.min(100 - item.height, item.y + movement.y)),
          } : item),
        }
      : slide));
  }

  return (
    <div className="space-y-3 px-4 py-4">
      <input type="hidden" name="display_slides_json" value={serialized} />
      <p className="text-xs leading-5 text-[var(--foreground-muted)]">黑板画面和老师台词分开编辑。画面负责展示重点，老师台词负责讲解；进入相应台词时，黑板会自动切换到已关联的画面。</p>
      {duplicateSegmentIndexes.size > 0 ? (
        <p className="border border-[var(--status-warning)] bg-[var(--status-warning-surface)] px-3 py-2 text-xs font-medium leading-5 text-[var(--foreground)]" role="status">
          同一句台词关联了多张画面，学生端只会显示列表中靠后的那一张。请调整“何时显示”，避免画面被覆盖。
        </p>
      ) : null}
      {oversizedSlideNames.length > 0 ? (
        <p className="border border-[var(--status-danger)] bg-[var(--status-danger-surface)] px-3 py-2 text-xs font-medium leading-5 text-[var(--status-danger)]" role="alert">
          {oversizedSlideNames.join("、")} 的文字过多，保存前请减少文字或拆成多张画面。
        </p>
      ) : null}
      <div className="min-w-0 space-y-4 border border-[var(--border)] bg-[var(--card)] p-3" aria-label="黑板画面属性">
        {selectedSlide ? (
          <>
            <div className="flex flex-wrap gap-x-8 gap-y-4">
              <div className="min-w-0 space-y-2">
                <span className="block text-xs font-bold text-[var(--foreground)]">画面设置</span>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="w-48 space-y-1"><span className="text-xs text-[var(--foreground-muted)]">画面名称</span><input value={selectedSlide.name} onChange={(event) => updateSlide({ name: event.target.value.slice(0, 40) })} disabled={disabled} className={controlClass} /></label>
                  <label className="w-56 space-y-1"><span className="text-xs text-[var(--foreground-muted)]">何时显示</span><select value={Math.min(selectedSlide.segmentIndex, maximumSegmentIndex)} onChange={(event) => updateSlide({ segmentIndex: Number(event.target.value) })} disabled={disabled} className={controlClass}>{scriptLines.map((line, index) => <option key={index} value={index}>{lineLabel(line, index)}</option>)}</select></label>
                  <label className="w-32 space-y-1"><span className="text-xs text-[var(--foreground-muted)]">背景</span><select value={selectedSlide.background} onChange={(event) => updateSlide({ background: event.target.value as TeachingBlackboardBackground })} disabled={disabled} className={controlClass}><option value="plain">白色</option><option value="warm">暖色</option><option value="grid">方格</option></select></label>
                  <div className="flex gap-2">
                    <button type="button" onClick={duplicateSlide} disabled={disabled || slides.length >= MAX_TEACHING_BLACKBOARD_SLIDES} className={smallButtonClass}><Copy size={13} aria-hidden="true" />复制</button>
                    <button type="button" onClick={removeSlide} disabled={disabled} className={`${smallButtonClass} text-[var(--status-danger)]`}><Trash2 size={13} aria-hidden="true" />删除</button>
                  </div>
                </div>
              </div>

              <div data-style-template-controls className="min-w-0 flex-1 space-y-2 border-l border-[var(--border)] pl-8">
                <span className="block text-xs font-bold text-[var(--foreground)]">版式模板</span>
                <p className="max-w-xl text-xs leading-5 text-[var(--foreground-muted)]">把这张画面各个内容框的位置、大小和样式存成版式；套用到别的画面时会尽量保留原有文字，只改排版。</p>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="w-56 space-y-1">
                    <span className="text-xs text-[var(--foreground-muted)]">应用版式</span>
                    <select value={layoutTemplateId} onChange={(event) => setLayoutTemplateId(event.target.value)} disabled={disabled} className={controlClass}>
                      <option value="">选择版式…</option>
                      {layoutTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                    </select>
                  </label>
                  {layoutTemplateId && (
                    <button
                      type="button"
                      onClick={() => deleteLayoutTemplate(layoutTemplateId)}
                      disabled={deleteLayoutPending}
                      aria-label="删除这个版式"
                      className={`${smallButtonClass} shrink-0 px-2 text-[var(--status-danger)]`}
                    >
                      {deleteLayoutPending ? <LoaderCircle size={13} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Trash2 size={13} aria-hidden="true" />}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={disabled || !layoutTemplateId}
                    onClick={applyLayoutTemplateToSlide}
                    className={`${smallButtonClass} shrink-0 px-2.5`}
                  >
                    应用
                  </button>
                  <label className="w-48 space-y-1">
                    <span className="text-xs text-[var(--foreground-muted)]">存为新版式</span>
                    <input
                      value={newLayoutTemplateName}
                      onChange={(event) => setNewLayoutTemplateName(event.target.value)}
                      disabled={disabled}
                      maxLength={60}
                      placeholder="例如：标题+要点+例句"
                      className={controlClass}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={disabled || saveLayoutPending || !newLayoutTemplateName.trim() || !selectedSlide.elements.some((element) => element.type !== "image" && element.type !== "video")}
                    onClick={saveCurrentLayoutAsTemplate}
                    className={`${smallButtonClass} shrink-0`}
                  >
                    {saveLayoutPending ? <LoaderCircle size={13} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
                    存为版式
                  </button>
                </div>
                {layoutTemplateError && <p className="text-xs text-[var(--status-danger)]">{layoutTemplateError}</p>}
              </div>
            </div>

            <div className="border-t border-[var(--border)] pt-3">
              <span className="mb-2 block text-xs font-bold text-[var(--foreground)]">内容设置</span>
              {selectedElement ? (
                <div className="flex flex-wrap items-end gap-2">
                  {selectedElement.type === "image" || selectedElement.type === "video" ? (
                    <>
                      <div className="w-48 shrink-0 space-y-2 self-start">
                        <TeachingBlackboardSlideView
                          slide={{ id: "media-preview", name: "", segmentIndex: 0, background: "plain", elements: [{ ...selectedElement, x: 0, y: 0, width: 100, height: 100 }] }}
                          className="pointer-events-none"
                        />
                        <button
                          type="button"
                          onClick={() => loadMediaBrowser(selectedElement.id, selectedElement.type as "image" | "video")}
                          disabled={disabled}
                          className={`${smallButtonClass} w-full`}
                        >
                          <FolderOpen size={13} aria-hidden="true" />
                          浏览 R2 里已有的{selectedElement.type === "image" ? "图片" : "视频"}
                        </button>
                      </div>
                      <div className="min-w-[16rem] flex-1 space-y-2 self-start">
                        <label className="block space-y-1">
                          <span className="text-xs text-[var(--foreground-muted)]">R2 对象键</span>
                          <input
                            value={selectedElement.content}
                            onChange={(event) => { updateElement({ content: event.target.value.trim() }); setMediaVerify(null); }}
                            disabled={disabled}
                            placeholder={`${BLACKBOARD_MEDIA_OBJECT_KEY_PREFIX}${selectedElement.type}/示例文件.${selectedElement.type === "image" ? "png" : "mp4"}`}
                            className={controlClass}
                          />
                        </label>
                        <p className="text-xs leading-5 text-[var(--foreground-muted)]">素材需要先放进 R2 的 {BLACKBOARD_MEDIA_OBJECT_KEY_PREFIX}{selectedElement.type}/ 目录下，再把完整对象键填在这里，或者用左边的浏览功能直接选。</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => verifyMediaObject(selectedElement)}
                            disabled={disabled || !selectedElement.content.trim() || mediaVerifyPending}
                            className={smallButtonClass}
                          >
                            {mediaVerifyPending && mediaVerify?.elementId === selectedElement.id && mediaVerify.status === "checking"
                              ? <LoaderCircle size={13} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                              : <CheckCircle2 size={13} aria-hidden="true" />}
                            校验对象是否存在
                          </button>
                          {mediaVerify && mediaVerify.elementId === selectedElement.id ? (
                            <p className={`text-xs font-medium ${mediaVerify.status === "error" ? "text-[var(--status-danger)]" : "text-[var(--status-success)]"}`} role="status">
                              {mediaVerify.status === "checking"
                                ? "正在校验…"
                                : mediaVerify.status === "error"
                                  ? mediaVerify.message
                                  : `已找到${mediaVerify.size ? `，大小约 ${(mediaVerify.size / 1024 / 1024).toFixed(1)}MB` : ""}`}
                            </p>
                          ) : null}
                        </div>
                        {mediaBrowser && mediaBrowser.elementId === selectedElement.id ? (
                          <MediaBrowserPanel
                            browser={mediaBrowser}
                            onSearchChange={(search) => setMediaBrowser((current) => current ? { ...current, search } : current)}
                            onRefresh={() => loadMediaBrowser(selectedElement.id, mediaBrowser.kind)}
                            onSelect={(objectKey) => selectMediaObject(selectedElement, objectKey)}
                            onClose={() => setMediaBrowser(null)}
                            pending={mediaBrowserPending}
                          />
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <>
                      <label className="w-64 space-y-1"><span className="text-xs text-[var(--foreground-muted)]">显示内容</span><textarea value={selectedElement.content} onChange={(event) => updateElement({ content: event.target.value.slice(0, 600) })} disabled={disabled} maxLength={600} rows={selectedElement.type === "bullets" ? 5 : 3} className={`${controlClass} resize-y py-2 leading-5`} /></label>
                      {selectedElement.type === "expression" ? <label className="w-56 space-y-1"><span className="text-xs text-[var(--foreground-muted)]">中文释义</span><textarea value={selectedElement.translation ?? ""} onChange={(event) => updateElement({ translation: event.target.value.slice(0, 300) })} disabled={disabled} maxLength={300} rows={2} className={`${controlClass} resize-y py-2 leading-5`} /></label> : null}
                      <label className="w-20 space-y-1"><span className="text-xs text-[var(--foreground-muted)]">字号</span><input type="number" inputMode="numeric" min={12} max={56} value={selectedElement.fontSize} onChange={(event) => updateElement({ fontSize: Math.max(12, Math.min(56, Number(event.target.value) || 12)) })} disabled={disabled} className={controlClass} /></label>
                      <label className="w-24 space-y-1"><span className="text-xs text-[var(--foreground-muted)]">字重</span><select value={selectedElement.fontWeight} onChange={(event) => updateElement({ fontWeight: Number(event.target.value) as 400 | 600 | 700 })} disabled={disabled} className={controlClass}><option value="400">常规</option><option value="600">半粗</option><option value="700">粗体</option></select></label>
                      <div className="space-y-1">
                        <span className="block text-xs text-[var(--foreground-muted)]">对齐</span>
                        <div className="flex gap-1" aria-label="文字对齐方式">
                          {([ ["left", AlignLeft, "左对齐"], ["center", AlignCenter, "居中"], ["right", AlignRight, "右对齐"] ] as const).map(([align, Icon, label]) => <button key={align} type="button" onClick={() => updateElement({ align })} disabled={disabled} className={`${smallButtonClass} px-2 ${selectedElement.align === align ? "border-[var(--primary)] text-[var(--primary)]" : ""}`} aria-label={label} aria-pressed={selectedElement.align === align}><Icon size={14} aria-hidden="true" /></button>)}
                        </div>
                      </div>
                      <label className="w-28 space-y-1"><span className="text-xs text-[var(--foreground-muted)]">颜色</span><select value={selectedElement.tone} onChange={(event) => updateElement({ tone: event.target.value as TeachingBlackboardTone })} disabled={disabled} className={controlClass}><option value="default">正文色</option><option value="primary">主题色</option><option value="highlight">强调色</option><option value="muted">辅助色</option></select></label>
                    </>
                  )}
                  <label className="w-20 space-y-1"><span className="text-xs text-[var(--foreground-muted)]">横向位置 %</span><input type="number" inputMode="numeric" min={0} max={Math.max(0, 100 - selectedElement.width)} value={Math.round(selectedElement.x)} onChange={(event) => updateElement({ x: Math.max(0, Math.min(100 - selectedElement.width, Number(event.target.value) || 0)) })} disabled={disabled} className={controlClass} /></label>
                  <label className="w-20 space-y-1"><span className="text-xs text-[var(--foreground-muted)]">纵向位置 %</span><input type="number" inputMode="numeric" min={0} max={Math.max(0, 100 - selectedElement.height)} value={Math.round(selectedElement.y)} onChange={(event) => updateElement({ y: Math.max(0, Math.min(100 - selectedElement.height, Number(event.target.value) || 0)) })} disabled={disabled} className={controlClass} /></label>
                  <label className="w-20 space-y-1"><span className="text-xs text-[var(--foreground-muted)]">宽度 %</span><input type="number" inputMode="numeric" min={8} max={100} value={Math.round(selectedElement.width)} onChange={(event) => updateElement({ width: Math.max(8, Math.min(100, Number(event.target.value) || 8)) })} disabled={disabled} className={controlClass} /></label>
                  <label className="w-20 space-y-1"><span className="text-xs text-[var(--foreground-muted)]">高度 %</span><input type="number" inputMode="numeric" min={6} max={100} value={Math.round(selectedElement.height)} onChange={(event) => updateElement({ height: Math.max(6, Math.min(100, Number(event.target.value) || 6)) })} disabled={disabled} className={controlClass} /></label>
                  <button type="button" onClick={removeElement} disabled={disabled} className={`${smallButtonClass} text-[var(--status-danger)]`}><Trash2 size={13} aria-hidden="true" />删除这个内容</button>
                </div>
              ) : <p className="text-xs leading-5 text-[var(--foreground-muted)]">点击画面中的内容后，可以在这里修改文字、位置、大小、颜色和对齐方式。</p>}
            </div>
          </>
        ) : null}
      </div>

      <div className="grid min-w-0 gap-3 xl:grid-cols-[10.5rem_minmax(28rem,1fr)]">
        <aside className="min-w-0 border border-[var(--border)] bg-[var(--muted)]/25 p-2" aria-label="黑板画面列表">
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <span className="text-xs font-bold text-[var(--foreground)]">黑板画面 <span className="font-medium text-[var(--foreground-muted)]">{slides.length}/{MAX_TEACHING_BLACKBOARD_SLIDES}</span></span>
            <button type="button" onClick={addSlide} disabled={disabled || slides.length >= MAX_TEACHING_BLACKBOARD_SLIDES} className="inline-flex h-11 w-11 items-center justify-center text-[var(--primary)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50" aria-label={slides.length >= MAX_TEACHING_BLACKBOARD_SLIDES ? "黑板画面已达到30张上限" : "增加黑板画面"}><Plus size={15} aria-hidden="true" /></button>
          </div>
          <div className="grid max-h-[36rem] gap-2 overflow-y-auto pr-1">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => { setSelectedSlideId(slide.id); setSelectedElementId(slide.elements[0]?.id ?? null); }}
                className={`min-w-0 border p-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${slide.id === selectedSlide?.id ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border)] bg-[var(--card)]"}`}
                aria-pressed={slide.id === selectedSlide?.id}
              >
                <TeachingBlackboardSlideView slide={slide} className="pointer-events-none" />
                <span className="mt-1.5 block truncate text-xs font-semibold text-[var(--foreground-secondary)]" title={slide.name}>{index + 1}. {slide.name}</span>
                <span className="block truncate text-xs text-[var(--foreground-muted)]" title={lineLabel(scriptLines[Math.min(slide.segmentIndex, maximumSegmentIndex)] ?? "", Math.min(slide.segmentIndex, maximumSegmentIndex))}>{lineLabel(scriptLines[Math.min(slide.segmentIndex, maximumSegmentIndex)] ?? "", Math.min(slide.segmentIndex, maximumSegmentIndex))}</span>
                {duplicateSegmentIndexes.has(Math.min(slide.segmentIndex, maximumSegmentIndex)) ? <span className="mt-1 block text-xs font-semibold text-[var(--status-warning)]">与其他画面重复</span> : null}
              </button>
            ))}
          </div>
        </aside>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => addElement("text")} disabled={disabled || (selectedSlide?.elements.length ?? 0) >= MAX_TEACHING_BLACKBOARD_ELEMENTS} className={smallButtonClass}><Type size={14} aria-hidden="true" />文字</button>
            <button type="button" onClick={() => addElement("bullets")} disabled={disabled || (selectedSlide?.elements.length ?? 0) >= MAX_TEACHING_BLACKBOARD_ELEMENTS} className={smallButtonClass}><List size={14} aria-hidden="true" />要点</button>
            <button type="button" onClick={() => addElement("expression")} disabled={disabled || (selectedSlide?.elements.length ?? 0) >= MAX_TEACHING_BLACKBOARD_ELEMENTS} className={smallButtonClass}><Languages size={14} aria-hidden="true" />韩语例句</button>
            <button type="button" onClick={() => addElement("image")} disabled={disabled || (selectedSlide?.elements.length ?? 0) >= MAX_TEACHING_BLACKBOARD_ELEMENTS} className={smallButtonClass}><ImageIcon size={14} aria-hidden="true" />图片</button>
            <button type="button" onClick={() => addElement("video")} disabled={disabled || (selectedSlide?.elements.length ?? 0) >= MAX_TEACHING_BLACKBOARD_ELEMENTS} className={smallButtonClass}><VideoIcon size={14} aria-hidden="true" />视频</button>
            <span className="ml-auto text-xs text-[var(--foreground-muted)]">双击内容可直接改文字，选中后可直接删除；可拖动或用方向键移动（按住 Shift 每次移动 5%），选中后拖动四角和四边的小圆点可调整大小</span>
          </div>
          {selectedSlide ? (
            <div
              ref={canvasRef}
              onPointerMove={(event) => { moveDrag(event); moveResize(event); }}
              onPointerUp={() => { endDrag(); endResize(); }}
              onPointerCancel={() => { endDrag(); endResize(); }}
            >
              <TeachingBlackboardSlideView
                slide={selectedSlide}
                selectedElementId={selectedElementId}
                editingElementId={editingElementId}
                onElementPointerDown={beginDrag}
                onElementClick={(element) => setSelectedElementId(element.id)}
                onElementDoubleClick={beginEditingElement}
                onElementKeyDown={handleElementKeyDown}
                onElementDelete={(element) => removeElementById(element.id)}
                onElementContentChange={(element, content) => updateElementById(element.id, { content: content.slice(0, 600) })}
                onElementEditBlur={() => setEditingElementId(null)}
                onElementResizeStart={beginResize}
                className="shadow-[0_10px_32px_rgba(15,23,42,0.09)]"
              />
            </div>
          ) : null}
          {selectedSlide && selectedSlide.elements.length === 0 ? (
            <p className="text-center text-xs text-[var(--foreground-muted)]">这张画面还是空的，请从上方添加文字、要点或韩语例句。</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
