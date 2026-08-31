"use client";

import { useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { AlignCenter, AlignLeft, AlignRight, Copy, Languages, List, Plus, Trash2, Type } from "lucide-react";

import { TeachingBlackboardSlideView } from "@/components/learning-agent/TeachingBlackboardSlide";
import {
  teachingBlackboardSlidesFromDisplay,
  teachingBlackboardSlideFitsHeader,
  MAX_TEACHING_BLACKBOARD_ELEMENTS,
  MAX_TEACHING_BLACKBOARD_SLIDES,
  type TeachingBlackboardBackground,
  type TeachingBlackboardElement,
  type TeachingBlackboardElementType,
  type TeachingBlackboardSlide,
  type TeachingBlackboardTone,
} from "@/lib/teaching-blackboard";

const controlClass = "app-input min-h-11 w-full border px-2.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60 sm:text-xs";
const smallButtonClass = "inline-flex min-h-11 items-center justify-center gap-1.5 border border-[var(--border)] bg-[var(--card)] px-3 text-xs font-semibold text-[var(--foreground-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50";

function nextId(prefix: string) {
  return `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function defaultElement(type: TeachingBlackboardElementType, count: number): TeachingBlackboardElement {
  const common = {
    id: nextId("element"), x: 8, y: 10 + Math.min(count, 5) * 9, width: 84, height: 18,
    fontWeight: 600 as const, align: "left" as const, tone: "default" as const,
  };
  if (type === "bullets") return { ...common, type, content: "第一个要点\n第二个要点", height: 34, fontSize: 20, tone: "primary" };
  if (type === "expression") return { ...common, type, content: "안녕하세요?", translation: "你好？", height: 22, fontSize: 28, fontWeight: 700, tone: "highlight" };
  return { ...common, type, content: "输入黑板文字", fontSize: 28, fontWeight: 700 };
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

export function TeachingBlackboardEditor({
  display,
  scriptLines,
  disabled,
  onDirty,
}: {
  display: Record<string, unknown>;
  scriptLines: string[];
  disabled?: boolean;
  onDirty: () => void;
}) {
  const [slides, setSlides] = useState<TeachingBlackboardSlide[]>(() => {
    const saved = teachingBlackboardSlidesFromDisplay(display);
    return saved.length ? saved : [emptySlide(0, 0)];
  });
  const [selectedSlideId, setSelectedSlideId] = useState(() => slides[0]?.id ?? "");
  const [selectedElementId, setSelectedElementId] = useState<string | null>(() => slides[0]?.elements[0]?.id ?? null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ elementId: string; offsetX: number; offsetY: number } | null>(null);
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

  function commit(updater: (current: TeachingBlackboardSlide[]) => TeachingBlackboardSlide[]) {
    setSlides(updater);
    onDirty();
  }

  function updateSlide(patch: Partial<TeachingBlackboardSlide>) {
    if (!selectedSlide) return;
    commit((current) => current.map((slide) => slide.id === selectedSlide.id ? { ...slide, ...patch } : slide));
  }

  function updateElement(patch: Partial<TeachingBlackboardElement>) {
    if (!selectedSlide || !selectedElement) return;
    commit((current) => current.map((slide) => slide.id === selectedSlide.id
      ? { ...slide, elements: slide.elements.map((element) => {
          if (element.id !== selectedElement.id) return element;
          const next = { ...element, ...patch };
          return { ...next, x: Math.min(next.x, 100 - next.width), y: Math.min(next.y, 100 - next.height) };
        }) }
      : slide));
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

  function addElement(type: TeachingBlackboardElementType) {
    if (!selectedSlide) return;
    if (selectedSlide.elements.length >= MAX_TEACHING_BLACKBOARD_ELEMENTS) return;
    const element = defaultElement(type, selectedSlide.elements.length);
    commit((current) => current.map((slide) => slide.id === selectedSlide.id
      ? { ...slide, elements: [...slide.elements, element] }
      : slide));
    setSelectedElementId(element.id);
  }

  function removeElement() {
    if (!selectedSlide || !selectedElement) return;
    if ((selectedElement.content.trim() || selectedElement.translation?.trim())
      && !window.confirm("确定删除这个黑板内容吗？")) return;
    commit((current) => current.map((slide) => slide.id === selectedSlide.id
      ? { ...slide, elements: slide.elements.filter((element) => element.id !== selectedElement.id) }
      : slide));
    setSelectedElementId(null);
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

  function handleElementKeyDown(event: ReactKeyboardEvent<HTMLDivElement>, element: TeachingBlackboardElement) {
    if (disabled) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelectedElementId(element.id);
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
      <div className="grid min-w-0 gap-3 xl:grid-cols-[10.5rem_minmax(28rem,1fr)_14rem]">
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
            <span className="ml-auto text-xs text-[var(--foreground-muted)]">可拖动内容，或用方向键移动；按住 Shift 每次移动 5%</span>
          </div>
          {selectedSlide ? (
            <div ref={canvasRef} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
              <TeachingBlackboardSlideView
                slide={selectedSlide}
                selectedElementId={selectedElementId}
                onElementPointerDown={beginDrag}
                onElementClick={(element) => setSelectedElementId(element.id)}
                onElementKeyDown={handleElementKeyDown}
                className="shadow-[0_10px_32px_rgba(15,23,42,0.09)]"
              />
            </div>
          ) : null}
          {selectedSlide && selectedSlide.elements.length === 0 ? (
            <p className="text-center text-xs text-[var(--foreground-muted)]">这张画面还是空的，请从上方添加文字、要点或韩语例句。</p>
          ) : null}
        </div>

        <aside className="min-w-0 space-y-4 border border-[var(--border)] bg-[var(--card)] p-3" aria-label="黑板画面属性">
          {selectedSlide ? (
            <>
              <div className="space-y-2">
                <span className="block text-xs font-bold text-[var(--foreground)]">画面设置</span>
                <label className="block space-y-1"><span className="text-xs text-[var(--foreground-muted)]">画面名称</span><input value={selectedSlide.name} onChange={(event) => updateSlide({ name: event.target.value.slice(0, 40) })} disabled={disabled} className={controlClass} /></label>
                <label className="block space-y-1"><span className="text-xs text-[var(--foreground-muted)]">何时显示</span><select value={Math.min(selectedSlide.segmentIndex, maximumSegmentIndex)} onChange={(event) => updateSlide({ segmentIndex: Number(event.target.value) })} disabled={disabled} className={controlClass}>{scriptLines.map((line, index) => <option key={index} value={index}>{lineLabel(line, index)}</option>)}</select></label>
                <label className="block space-y-1"><span className="text-xs text-[var(--foreground-muted)]">背景</span><select value={selectedSlide.background} onChange={(event) => updateSlide({ background: event.target.value as TeachingBlackboardBackground })} disabled={disabled} className={controlClass}><option value="plain">白色</option><option value="warm">暖色</option><option value="grid">方格</option></select></label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={duplicateSlide} disabled={disabled || slides.length >= MAX_TEACHING_BLACKBOARD_SLIDES} className={smallButtonClass}><Copy size={13} aria-hidden="true" />复制</button>
                  <button type="button" onClick={removeSlide} disabled={disabled} className={`${smallButtonClass} text-[var(--status-danger)]`}><Trash2 size={13} aria-hidden="true" />删除</button>
                </div>
              </div>

              <div className="border-t border-[var(--border)] pt-3">
                <span className="mb-2 block text-xs font-bold text-[var(--foreground)]">内容设置</span>
                {selectedElement ? (
                  <div className="space-y-2">
                    <label className="block space-y-1"><span className="text-xs text-[var(--foreground-muted)]">显示内容</span><textarea value={selectedElement.content} onChange={(event) => updateElement({ content: event.target.value.slice(0, 600) })} disabled={disabled} maxLength={600} rows={selectedElement.type === "bullets" ? 5 : 3} className={`${controlClass} resize-y py-2 leading-5`} /></label>
                    {selectedElement.type === "expression" ? <label className="block space-y-1"><span className="text-xs text-[var(--foreground-muted)]">中文释义</span><textarea value={selectedElement.translation ?? ""} onChange={(event) => updateElement({ translation: event.target.value.slice(0, 300) })} disabled={disabled} maxLength={300} rows={2} className={`${controlClass} resize-y py-2 leading-5`} /></label> : null}
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block space-y-1"><span className="text-xs text-[var(--foreground-muted)]">字号</span><input type="number" inputMode="numeric" min={12} max={56} value={selectedElement.fontSize} onChange={(event) => updateElement({ fontSize: Math.max(12, Math.min(56, Number(event.target.value) || 12)) })} disabled={disabled} className={controlClass} /></label>
                      <label className="block space-y-1"><span className="text-xs text-[var(--foreground-muted)]">字重</span><select value={selectedElement.fontWeight} onChange={(event) => updateElement({ fontWeight: Number(event.target.value) as 400 | 600 | 700 })} disabled={disabled} className={controlClass}><option value="400">常规</option><option value="600">半粗</option><option value="700">粗体</option></select></label>
                    </div>
                    <div className="grid grid-cols-3 gap-1" aria-label="文字对齐方式">
                      {([ ["left", AlignLeft, "左对齐"], ["center", AlignCenter, "居中"], ["right", AlignRight, "右对齐"] ] as const).map(([align, Icon, label]) => <button key={align} type="button" onClick={() => updateElement({ align })} disabled={disabled} className={`${smallButtonClass} px-2 ${selectedElement.align === align ? "border-[var(--primary)] text-[var(--primary)]" : ""}`} aria-label={label} aria-pressed={selectedElement.align === align}><Icon size={14} aria-hidden="true" /></button>)}
                    </div>
                    <label className="block space-y-1"><span className="text-xs text-[var(--foreground-muted)]">颜色</span><select value={selectedElement.tone} onChange={(event) => updateElement({ tone: event.target.value as TeachingBlackboardTone })} disabled={disabled} className={controlClass}><option value="default">正文色</option><option value="primary">主题色</option><option value="highlight">强调色</option><option value="muted">辅助色</option></select></label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block space-y-1"><span className="text-xs text-[var(--foreground-muted)]">横向位置 %</span><input type="number" inputMode="numeric" min={0} max={Math.max(0, 100 - selectedElement.width)} value={Math.round(selectedElement.x)} onChange={(event) => updateElement({ x: Math.max(0, Math.min(100 - selectedElement.width, Number(event.target.value) || 0)) })} disabled={disabled} className={controlClass} /></label>
                      <label className="block space-y-1"><span className="text-xs text-[var(--foreground-muted)]">纵向位置 %</span><input type="number" inputMode="numeric" min={0} max={Math.max(0, 100 - selectedElement.height)} value={Math.round(selectedElement.y)} onChange={(event) => updateElement({ y: Math.max(0, Math.min(100 - selectedElement.height, Number(event.target.value) || 0)) })} disabled={disabled} className={controlClass} /></label>
                      <label className="block space-y-1"><span className="text-xs text-[var(--foreground-muted)]">宽度 %</span><input type="number" inputMode="numeric" min={8} max={100} value={Math.round(selectedElement.width)} onChange={(event) => updateElement({ width: Math.max(8, Math.min(100, Number(event.target.value) || 8)) })} disabled={disabled} className={controlClass} /></label>
                      <label className="block space-y-1"><span className="text-xs text-[var(--foreground-muted)]">高度 %</span><input type="number" inputMode="numeric" min={6} max={100} value={Math.round(selectedElement.height)} onChange={(event) => updateElement({ height: Math.max(6, Math.min(100, Number(event.target.value) || 6)) })} disabled={disabled} className={controlClass} /></label>
                    </div>
                    <button type="button" onClick={removeElement} disabled={disabled} className={`${smallButtonClass} w-full text-[var(--status-danger)]`}><Trash2 size={13} aria-hidden="true" />删除这个内容</button>
                  </div>
                ) : <p className="text-xs leading-5 text-[var(--foreground-muted)]">点击画面中的内容后，可以在这里修改文字、位置、大小、颜色和对齐方式。</p>}
              </div>
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
