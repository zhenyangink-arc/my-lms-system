"use client";

import { useId, useState, type ReactNode } from "react";

/** Keep panels mounted so switching areas does not discard unsaved form state. */
function WorkspaceTabs({ label, items }: {
  label: string;
  items: { key: string; title: string; content: ReactNode }[];
}) {
  const id = useId();
  const [active, setActive] = useState(items[0].key);
  return <div className="min-w-0 space-y-5">
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 border-b border-[var(--border)] pb-2">
      {items.map((item, index) => <button
        key={item.key} type="button" role="tab"
        id={`${id}-tab-${item.key}`} aria-controls={`${id}-panel-${item.key}`}
        aria-selected={active === item.key} tabIndex={active === item.key ? 0 : -1}
        onClick={() => setActive(item.key)}
        onKeyDown={event => {
          const next = event.key === "ArrowRight" ? (index + 1) % items.length
            : event.key === "ArrowLeft" ? (index - 1 + items.length) % items.length
            : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : null;
          if (next === null) return;
          event.preventDefault();
          setActive(items[next].key);
          document.getElementById(`${id}-tab-${items[next].key}`)?.focus();
        }}
        className={`min-h-11 rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${active === item.key ? "bg-[var(--foreground)] text-[var(--background)]" : "text-[var(--foreground-secondary)] hover:bg-[var(--surface-soft)]"}`}
      >{item.title}</button>)}
    </div>
    {items.map(item => <div key={item.key} role="tabpanel"
      id={`${id}-panel-${item.key}`} aria-labelledby={`${id}-tab-${item.key}`}
      hidden={active !== item.key} tabIndex={0}
    >{item.content}</div>)}
  </div>;
}

export function GrowthToolboxWorkspace({ chapter, library, settings }: {
  chapter: ReactNode; library: ReactNode; settings: ReactNode;
}) {
  return <WorkspaceTabs label="练习工具工作区" items={[
    { key: "chapter", title: "章节练习", content: chapter },
    { key: "library", title: "独立练习库", content: library },
    { key: "settings", title: "工具设置", content: settings },
  ]} />;
}

export function GrowthToolboxLibrary({ vocabulary, grammar }: {
  vocabulary: ReactNode; grammar: ReactNode;
}) {
  return <WorkspaceTabs label="独立练习类型" items={[
    { key: "vocabulary", title: "词汇", content: vocabulary },
    { key: "grammar", title: "语法", content: grammar },
  ]} />;
}
