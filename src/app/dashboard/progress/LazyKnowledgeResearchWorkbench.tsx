"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { KnowledgeResearchWorkbench as KnowledgeResearchWorkbenchComponent } from "./KnowledgeResearchWorkbench";

type Props = ComponentProps<typeof KnowledgeResearchWorkbenchComponent>;

const KnowledgeResearchWorkbench = dynamic(
  () =>
    import("./KnowledgeResearchWorkbench").then(
      (module) => module.KnowledgeResearchWorkbench,
    ),
  {
    loading: () => (
      <div
        className="min-h-[32rem] w-full animate-pulse rounded-3xl border bg-[var(--surface-soft)]"
        style={{ borderColor: "var(--border)" }}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="sr-only">正在加载精研工作台…</span>
      </div>
    ),
  },
);

export function LazyKnowledgeResearchWorkbench(props: Props) {
  return <KnowledgeResearchWorkbench {...props} />;
}
