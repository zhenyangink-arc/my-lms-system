import 'server-only';
import type { ModelToolCall } from '../contracts/provider.ts';
import type { ToolDefinition, ToolExecutionContext, ToolRegistry, ToolResult } from '../contracts/tool.ts';
import type { PermissionPolicy } from '../permissions/permission-policy.ts';
import { decisionAllows } from '../permissions/permission-policy.ts';
import { assertExecution, createDeadlineSignal, withSignal } from '../runtime/deadline.ts';
import { CoreError } from '../runtime/errors.ts';
export async function executeAllowedTool(call: ModelToolCall, visible: readonly ToolDefinition[], registry: ToolRegistry, policy: PermissionPolicy, context: ToolExecutionContext): Promise<ToolResult<unknown>> {
  assertExecution(context.signal, context.deadlineAt);
  const exposed = visible.find((tool) => tool.name === call.name);
  const registered = exposed && registry.get(exposed);
  if (!registered || registered.definition.status !== 'enabled' || registered.definition.riskLevel !== 0) throw new CoreError('TOOL_NOT_ALLOWED');
  const definition = registered.definition;
  let parsed: unknown;
  try { parsed = JSON.parse(call.arguments); } catch { throw new CoreError('TOOL_INVALID_INPUT'); }
  const validated = definition.inputValidator.safeParse(parsed);
  if (!validated.success) throw new CoreError('TOOL_INVALID_INPUT');
  const decision = await policy.evaluate(context.authority, { kind: 'tool', ref: definition, requiredPermissions: definition.requiredPermissions });
  if (!decisionAllows(decision, context.authority)) throw new CoreError('TOOL_NOT_ALLOWED');
  assertExecution(context.signal, context.deadlineAt);
  const deadline = createDeadlineSignal(context.signal, context.deadlineAt, definition.timeoutMs);
  try {
    const result = await withSignal(registered.executor.execute(validated.data, { ...context, signal: deadline.signal }), deadline.signal);
    assertExecution(deadline.signal, context.deadlineAt);
    if (new TextEncoder().encode(JSON.stringify(result)).length > definition.maxResultBytes) throw new CoreError('TOOL_FAILED');
    if (result.status === 'ok' || result.status === 'partial') {
      const output = definition.outputValidator.safeParse(result.data);
      if (!output.success) throw new CoreError('TOOL_FAILED');
      return { status: result.status, data: output.data, sourceRefs: result.sourceRefs };
    }
    if ('code' in result && ['stale', 'not_found_or_not_visible', 'unavailable'].includes(result.status)) return { status: result.status, code: 'READ_UNAVAILABLE' };
    throw new CoreError('TOOL_FAILED');
  } catch (error) { throw error instanceof CoreError ? error : new CoreError('TOOL_FAILED', error); }
  finally { deadline.dispose(); }
}
