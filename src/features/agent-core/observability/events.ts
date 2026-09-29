import 'server-only';
import type { RuntimeEvent, RuntimeEventPayload } from '../contracts/public.ts';
import type { TraceEvent } from './trace.ts';
import { publicErrorCode, safeMessage } from '../runtime/errors.ts';
// Exhaustive allowlist projection: untyped extras never cross into public payloads.
export function publicPayload(event: RuntimeEventPayload): RuntimeEventPayload {
  switch (event.type) {
    case 'run.started': return { type: event.type, conversationId: event.conversationId };
    case 'run.status': return { type: event.type, phase: event.phase };
    case 'tool.status': return { type: event.type, callId: event.callId, state: event.state };
    case 'answer.delta': return { type: event.type, text: event.text };
    case 'answer.final': return { type: event.type, text: event.text, sourceRefs: [...event.sourceRefs], completeness: event.completeness };
    case 'run.completed': return { type: event.type, usageStatus: event.usageStatus };
    case 'run.failed': return { type: event.type, code: publicErrorCode(event.code), safeMessage: safeMessage(publicErrorCode(event.code)), partial: event.partial };
    case 'run.cancelled': return { type: event.type, partial: event.partial };
    case 'confirmation.required': return { type: event.type, confirmationRef: event.confirmationRef, expiresAt: event.expiresAt };
  }
}
export function createEventFactory(runId: string) {
  let seq = 0;
  return (payload: RuntimeEventPayload): RuntimeEvent => ({ ...publicPayload(payload), protocolVersion: 1, runId, seq: ++seq, at: new Date().toISOString() });
}
export function projectTrace(event: TraceEvent): RuntimeEventPayload | null {
  if (event.kind === 'tool.started' && event.toolCallId) return { type: 'tool.status', callId: event.toolCallId, state: 'started' };
  if (event.kind === 'tool.completed' && event.toolCallId) return { type: 'tool.status', callId: event.toolCallId, state: 'succeeded' };
  if (event.kind === 'run.failed') return { type: 'run.failed', code: publicErrorCode(event.errorCode), safeMessage: safeMessage(publicErrorCode(event.errorCode)), partial: false };
  return null;
}
