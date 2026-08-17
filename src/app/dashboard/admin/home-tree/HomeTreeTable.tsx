"use client";

import { Fragment, useState, type ReactNode } from "react";
import {
  BookOpen,
  BookText,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderTree,
} from "lucide-react";
import { HomeTreeToggle } from "./HomeTreeToggle";

export type HomeTreeNode = {
  id: string;
  table: "courses" | "course_categories" | null;
  label: string;
  kind: "分类" | "课程" | "课时" | "章节";
  show: boolean;
  children: HomeTreeNode[];
};

const STORAGE_KEY = "home-tree-expanded-groups";

function readExpanded(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeExpanded(expanded: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...expanded]));
  } catch {
    // 忽略存储失败（隐私模式等）
  }
}

function kindIcon(kind: HomeTreeNode["kind"]) {
  if (kind === "分类") {
    return <FolderTree size={12} className="app-muted-text shrink-0" aria-hidden="true" />;
  }
  if (kind === "课程") {
    return <BookOpen size={12} className="app-muted-text shrink-0" aria-hidden="true" />;
  }
  if (kind === "课时") {
    return <BookText size={12} className="app-muted-text shrink-0" aria-hidden="true" />;
  }
  return <FileText size={12} className="app-muted-text shrink-0" aria-hidden="true" />;
}

function labelClass(kind: HomeTreeNode["kind"]) {
  if (kind === "分类") return "truncate font-medium app-muted-text";
  if (kind === "课程") return "truncate";
  if (kind === "课时") return "truncate app-muted-text";
  return "truncate opacity-60";
}

type RenderRowsProps = {
  nodes: HomeTreeNode[];
  depth: number;
  expanded: Set<string>;
  toggle: (id: string) => void;
  viewSlug: string;
};

function renderRows({
  nodes,
  depth,
  expanded,
  toggle,
  viewSlug,
}: RenderRowsProps): ReactNode[] {
  return nodes.flatMap((node) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expanded.has(node.id);
    const rows: ReactNode[] = [
      <tr
        key={node.id}
        className="border-t transition-colors hover:bg-[color-mix(in_srgb,var(--border)_22%,transparent)]"
        style={{ borderColor: "var(--border)" }}
      >
        <td className="py-2 pr-3">
          <button
            type="button"
            disabled={!hasChildren}
            onClick={() => hasChildren && toggle(node.id)}
            className="flex w-full items-center gap-1.5 text-left"
            style={{ paddingLeft: depth * 22, cursor: hasChildren ? "pointer" : "default" }}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown size={13} className="app-muted-text shrink-0" aria-hidden="true" />
              ) : (
                <ChevronRight size={13} className="app-muted-text shrink-0" aria-hidden="true" />
              )
            ) : (
              <span className="w-[13px] shrink-0" aria-hidden="true" />
            )}
            {kindIcon(node.kind)}
            <span className={labelClass(node.kind)}>{node.label}</span>
            {hasChildren && (
              <span className="app-muted-text shrink-0 text-xs font-normal">
                {node.children.length}
              </span>
            )}
          </button>
        </td>
        <td className="py-2 pr-3 app-muted-text">{node.kind}</td>
        <td className="py-2 text-right">
          {node.table ? (
            <HomeTreeToggle
              table={node.table}
              id={node.id}
              checked={node.show}
              viewSlug={viewSlug}
            />
          ) : (
            <span className="inline-block h-6" aria-hidden="true" />
          )}
        </td>
      </tr>,
    ];
    if (isExpanded && hasChildren) {
      rows.push(
        ...renderRows({ nodes: node.children, depth: depth + 1, expanded, toggle, viewSlug })
      );
    }
    return rows;
  });
}

/**
 * Linear / Vercel 风格表格：父分类 → 子分类 → 课程 → 课时 每一层都可折叠，
 * 默认全部折叠；展开状态保存在 localStorage，刷新后保持。
 */
export function HomeTreeTable({
  groups,
  viewSlug,
}: {
  groups: HomeTreeNode[];
  viewSlug: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    typeof window === "undefined" ? new Set() : readExpanded()
  );

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeExpanded(next);
      return next;
    });
  };

  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr className="app-muted-text text-xs">
          <th className="py-2.5 text-left font-medium">名称</th>
          <th className="w-24 py-2.5 text-left font-medium">类型</th>
          <th className="w-28 py-2.5 text-right font-medium">首页展示</th>
        </tr>
      </thead>
      <tbody>
        <Fragment>{renderRows({ nodes: groups, depth: 0, expanded, toggle, viewSlug })}</Fragment>
      </tbody>
    </table>
  );
}
