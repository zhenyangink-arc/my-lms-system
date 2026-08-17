"use client";

import { useMemo } from "react";
import { Background, Controls, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  layoutTree,
  TreeLabelNode,
  type CourseTreePayload,
} from "@/app/dashboard/CourseListDialog";

export function HomeTreeGraphPreview({ tree }: { tree: CourseTreePayload }) {
  const { nodes, edges } = useMemo(() => layoutTree(tree), [tree]);
  const nodeTypes = useMemo(() => ({ treeLabel: TreeLabelNode }), []);

  return (
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
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={16} size={1} />
      <Controls />
    </ReactFlow>
  );
}
