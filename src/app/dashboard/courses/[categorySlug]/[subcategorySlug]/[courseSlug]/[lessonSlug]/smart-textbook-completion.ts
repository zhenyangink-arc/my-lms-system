export type SmartTextbookNodeCompletionResult = {
  nodeId: string | null;
  nodeCompleted: boolean;
  completionPercent: number;
  preview: boolean;
};

type SmartTextbookModuleCompletionInput = {
  nodes: readonly { id: string }[];
};

export function isServerConfirmedNodeCompletion(
  result: SmartTextbookNodeCompletionResult,
): result is SmartTextbookNodeCompletionResult & { nodeId: string } {
  return (
    !result.preview &&
    result.nodeCompleted &&
    result.completionPercent === 100 &&
    Boolean(result.nodeId)
  );
}

export function isSmartTextbookModuleCompleted(
  module: SmartTextbookModuleCompletionInput | undefined,
  completedNodeIds: ReadonlySet<string>,
) {
  if (!module) return false;
  return module.nodes.every((node) => completedNodeIds.has(node.id));
}
