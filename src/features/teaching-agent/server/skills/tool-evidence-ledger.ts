import 'server-only';
import type { ModelToolCall } from '../../../agent-core/contracts/provider.ts';
import type { VersionRef } from '../../../agent-core/contracts/server.ts';
import type { ToolExecutionContext, ToolDefinition, ToolRegistry, ToolResult } from '../../../agent-core/contracts/tool.ts';
import type { PermissionPolicy } from '../../../agent-core/permissions/permission-policy.ts';
import { createDeadlineSignal, withSignal, assertExecution } from '../../../agent-core/runtime/deadline.ts';
import { CoreError } from '../../../agent-core/runtime/errors.ts';
import { versionKey } from '../../../agent-core/skills/registry.ts';

export interface PrivateToolReceipt {
 readonly runId: string; readonly skillRunId: string; readonly modelCallId: string; readonly toolCallId: string;
 readonly skillVersion: VersionRef; readonly toolVersion: VersionRef;
 readonly authority: ToolExecutionContext['authority']; readonly authoritySnapshot: string;
 readonly binding: object | undefined; readonly deadlineAt: string;
 readonly readStartedAt: number; readonly returnedAt: number; readonly result: ToolResult<unknown>;
}
const issued = new WeakSet<PrivateToolReceipt>();
export const isPrivateToolReceipt = (value: PrivateToolReceipt) => issued.has(value);
/** Server-private helper. No setter/import API. Only an actual Core execution
 * can create a receipt. Dispatch limits and call parsing remain with composition. */
export function createToolEvidenceLedger(input: {
 context: Omit<ToolExecutionContext, 'callId' | 'modelCallId'>;
 skill: VersionRef; binding?: object; visible: readonly ToolDefinition[];
 registry: ToolRegistry; policy: PermissionPolicy;
 /** Supplied only by the existing capability composition's fixed Core bridge. */
 invokeCore: (call: ModelToolCall, visible: readonly ToolDefinition[], registry: ToolRegistry,
  policy: PermissionPolicy, context: ToolExecutionContext) => Promise<ToolResult<unknown>>;
}) {
 const context = { ...input.context }, skill = { ...input.skill }, binding = input.binding;
 const receipts = new Map<string, PrivateToolReceipt | undefined>();
 return {
  get(ref: VersionRef) { return receipts.get(versionKey(ref)); },
  async execute(call: ModelToolCall, modelCallId: string, ref: VersionRef, requested: () => void = () => {}) {
   const key = versionKey(ref);
   receipts.set(key, undefined);
   requested();
   assertExecution(context.signal, context.deadlineAt);
   const started = Date.now(), authoritySnapshot = JSON.stringify(context.authority);
   const deadline = createDeadlineSignal(context.signal, context.deadlineAt);
   try {
    const result = await withSignal(input.invokeCore(call, input.visible, input.registry, input.policy,
     { ...context, callId: call.id, modelCallId }), deadline.signal);
    const exposed = input.visible.find(t => t.name === call.name);
    const actual = exposed && input.registry.get(exposed)?.definition;
    if (!actual || versionKey(actual) !== key) throw new CoreError('TOOL_NOT_ALLOWED');
    const receipt: PrivateToolReceipt = Object.freeze({ runId: context.runId, skillRunId: context.skillRunId,
     modelCallId, toolCallId: call.id, skillVersion: skill, toolVersion: { name: actual.name, version: actual.version },
     authority: context.authority, authoritySnapshot, binding, deadlineAt: context.deadlineAt,
     readStartedAt: started, returnedAt: Date.now(), result: structuredClone(result) });
    issued.add(receipt); receipts.set(key, receipt);
    return result;
   } finally { deadline.dispose(); }
  },
 };
}
