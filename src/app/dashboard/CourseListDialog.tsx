"use client";

import { useMemo, useState } from "react";
import { BookOpen, FolderTree } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export type CourseTreeNodeData = {
  id: string;
  label: string;
  kind: "category" | "course" | "lesson" | "chapter";
  href?: string | null;
  percent?: number;
};

export type CourseTreePayload = {
  nodes: CourseTreeNodeData[];
  edges: { id: string; source: string; target: string }[];
};

const X_STEP = 230;
const Y_STEP = 66;

/** 横向树布局：深度从左到右排 x，叶子按出现顺序排 y，父节点取子节点平均 y。 */
export function layoutTree(payload: CourseTreePayload): {
  nodes: Node[];
  edges: Edge[];
} {
  const children = new Map<string, string[]>();
  for (const edge of payload.edges) {
    const list = children.get(edge.source) ?? [];
    list.push(edge.target);
    children.set(edge.source, list);
  }
  const hasParent = new Set(payload.edges.map((edge) => edge.target));
  const roots = payload.nodes.filter((node) => !hasParent.has(node.id));

  let leafCursor = 0;
  const positions = new Map<string, { x: number; y: number }>();

  function dfs(id: string, depth: number): number {
    const kids = children.get(id) ?? [];
    if (kids.length === 0) {
      const y = leafCursor * Y_STEP;
      leafCursor += 1;
      positions.set(id, { x: depth * X_STEP, y });
      return y;
    }
    const ys = kids.map((kid) => dfs(kid, depth + 1));
    const y = ys.reduce((sum, v) => sum + v, 0) / ys.length;
    positions.set(id, { x: depth * X_STEP, y });
    return y;
  }
  for (const root of roots) dfs(root.id, 0);

  const nodes: Node[] = payload.nodes.map((node) => ({
    id: node.id,
    type: "treeLabel",
    position: positions.get(node.id) ?? { x: 0, y: 0 },
    data: {
      label: node.label,
      kind: node.kind,
      href: node.href,
      percent: node.percent,
    },
  }));
  const edges: Edge[] = payload.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
  }));
  return { nodes, edges };
}

const KIND_STYLE: Record<
  string,
  { background: string; color: string; borderColor: string }
> = {
  category: {
    background: "var(--accent)",
    color: "var(--primary-hover)",
    borderColor: "var(--primary)",
  },
  course: {
    background: "var(--status-warning-surface)",
    color: "var(--status-warning)",
    borderColor: "var(--status-warning)",
  },
  lesson: {
    background: "var(--support-surface)",
    color: "var(--support)",
    borderColor: "var(--support)",
  },
  chapter: {
    background: "white",
    color: "var(--foreground-muted)",
    borderColor: "var(--border)",
  },
};

export function TreeLabelNode({ data }: NodeProps) {
  const kind = String(data.kind);

  // 课程节点：卡片设计（渐变底 + 图标 + 标题 + 进度条 + 百分比）
  if (kind === "course") {
    const percent = typeof data.percent === "number" ? data.percent : 0;
    return (
      <>
        <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
        <div
          className="w-[168px] rounded-2xl border p-3 shadow-sm transition hover:-translate-y-0.5"
          style={{
            background: "linear-gradient(145deg, var(--card), var(--accent))",
            borderColor: "var(--border)",
            cursor: data.href ? "pointer" : "default",
          }}
        >
          <div className="flex items-center justify-between">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ backgroundColor: "var(--accent)", color: "var(--primary)" }}
            >
              <BookOpen size={15} aria-hidden="true" />
            </span>
            <span className="text-[11px] font-bold" style={{ color: "var(--status-success)" }}>
              {percent}%
            </span>
          </div>
          <p className="mt-2 truncate text-xs font-bold">{String(data.label)}</p>
          <div className="mt-2 h-1 overflow-hidden rounded-full" style={{ backgroundColor: "var(--surface-soft)" }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${percent}%`, backgroundColor: "var(--primary)" }}
            />
          </div>
        </div>
        <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      </>
    );
  }

  // 分类节点：浅色卡片 + 图标
  if (kind === "category") {
    return (
      <>
        <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
        <div
          className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold"
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--primary-hover)",
            borderColor: "var(--primary)",
            whiteSpace: "nowrap",
          }}
        >
          <FolderTree size={13} aria-hidden="true" />
          <span className="max-w-[130px] truncate">{String(data.label)}</span>
        </div>
        <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      </>
    );
  }

  // 课时 / 章节节点：小胶囊
  const style = KIND_STYLE[kind] ?? KIND_STYLE.chapter;
  return (
    <>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div
        className="rounded-lg border px-2.5 py-1.5 text-[10px] font-bold"
        style={{ ...style, maxWidth: 150, whiteSpace: "nowrap" }}
      >
        <span className="block truncate">{String(data.label)}</span>
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </>
  );
}

/**
 * hero 卡片"查看全部课程"按钮：点击弹出大对话框，用 React Flow 渲染
 * 完整课程树（分类 → 子分类 → 课程 → 课时 → 章节），课程节点可点击进入。
 */
export function CourseListDialog({ tree }: { tree: CourseTreePayload }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { nodes, edges } = useMemo(() => layoutTree(tree), [tree]);
  const nodeTypes = useMemo(() => ({ treeLabel: TreeLabelNode }), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-bold transition hover:-translate-y-0.5"
        style={{ borderColor: "var(--border)" }}
      >
        查看全部课程
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          overlayClassName="bg-black/5"
          className="!max-w-[960px] gap-0 rounded-[20px] p-0 app-glass-panel overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3 px-6 pt-6 pb-3">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <BookOpen size={18} style={{ color: "var(--primary)" }} />
              全部课程 · 课程体系树
            </DialogTitle>
            <span
              className="shrink-0 rounded-full px-3 py-1 text-xs font-bold"
              style={{ color: "var(--primary-hover)", backgroundColor: "var(--accent)" }}
            >
              {tree.nodes.length} 节点
            </span>
          </div>

          <div className="px-4 pb-4">
            <div className="h-[480px] overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              {nodes.length > 0 ? (
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  fitView
                  fitViewOptions={{ padding: 0.2 }}
                  nodesConnectable={false}
                  edgesFocusable={false}
                  elementsSelectable
                  minZoom={0.2}
                  maxZoom={1.6}
                  onNodeClick={(_, node) => {
                    const href = node.data?.href as string | undefined;
                    if (href) {
                      setOpen(false);
                      router.push(href);
                    }
                  }}
                  proOptions={{ hideAttribution: true }}
                >
                  <Background gap={16} size={1} />
                  <Controls />
                </ReactFlow>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <p className="text-sm font-bold">还没有课程</p>
                  <p className="mt-1 text-xs app-muted-text">课程上架后会显示在这里</p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t px-6 py-3 app-divider">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full rounded-xl py-2 text-xs font-bold transition hover:bg-[color-mix(in_srgb,var(--accent)_30%,transparent)]"
              style={{ color: "var(--foreground-muted)" }}
            >
              关闭
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
