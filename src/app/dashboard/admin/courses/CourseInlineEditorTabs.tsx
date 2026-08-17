"use client";

import { type ReactNode, useState } from "react";
import { FileText, Link2, LockKeyhole, Settings2 } from "lucide-react";

type TabId = "basic" | "content" | "rules" | "resources";

const tabs: Array<{ id: TabId; label: string; icon: typeof Settings2 }> = [
  { id: "basic", label: "基本信息", icon: Settings2 },
  { id: "content", label: "课程内容", icon: FileText },
  { id: "rules", label: "开放规则", icon: LockKeyhole },
  { id: "resources", label: "资料附件", icon: Link2 },
];

export function CourseInlineEditorTabs({
  basic,
  content,
  rules,
  resources,
}: {
  basic: ReactNode;
  content: ReactNode;
  rules: ReactNode;
  resources: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("basic");
  const panels: Record<TabId, ReactNode> = { basic, content, rules, resources };

  return (
    <div className="border-y" style={{ borderColor: "var(--border)" }}>
      <div className="flex min-w-0 overflow-x-auto border-b" style={{ borderColor: "var(--border)" }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="relative flex shrink-0 items-center gap-2 px-4 py-3 text-[11px] font-medium transition-colors"
              style={{ color: active ? "var(--foreground)" : "var(--foreground-muted)" }}
            >
              <Icon size={12} strokeWidth={1.7} />
              {tab.label}
              {active && <span className="absolute inset-x-3 bottom-0 h-px" style={{ backgroundColor: "var(--primary)" }} />}
            </button>
          );
        })}
      </div>
      <div className="px-1 py-5">{panels[activeTab]}</div>
    </div>
  );
}
