import 'server-only';

export interface StudentCapabilityEvent {
  kind: 'skill.loaded' | 'skill.evidence' | 'tool.requested' | 'tool.completed' | 'tool.denied';
  runId: string; at: string; ref: { name: string; version: string }; callRef?: string;
  status?: 'ok' | 'partial' | 'stale' | 'not_found_or_not_visible' | 'unavailable' | 'denied' | 'satisfied' | 'missing' | 'invalid';
}
export interface StudentCapabilityTrace { emit(event: StudentCapabilityEvent): void }
export function emitCapabilityTrace(sink: StudentCapabilityTrace | undefined, event: StudentCapabilityEvent) {
  // Constructed metadata only; never pass Tool args, evidence text, raw errors or rows.
  try { sink?.emit(structuredClone(event)); } catch { /* Observability cannot grant access or change a read result. */ }
}
