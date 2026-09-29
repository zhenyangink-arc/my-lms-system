import 'server-only';
export interface TeachingTraceEvent {
  kind: 'context.resolve' | 'selection.verify' | 'policy.decision' | 'domain.read';
  phase: 'started' | 'completed'; runId: string; at: string;
  operation?: 'lesson' | 'state';
  status?: 'ok' | 'partial' | 'stale' | 'not_found_or_not_visible' | 'unavailable';
  sources?: Array<{ ref: string; revision: string }>;
}
export interface TeachingTraceSink { emit(event: TeachingTraceEvent): void }
/** A narrow metadata event contract, not a ToolCall and not a content logger. */
export function emitTeachingTrace(sink: TeachingTraceSink | undefined, event: TeachingTraceEvent): void {
  // Copy only allowlisted fields even if a JS caller supplies additional properties.
  sink?.emit({ kind: event.kind, phase: event.phase, runId: event.runId, at: event.at,
    ...(event.operation ? { operation: event.operation } : {}),
    ...(event.status ? { status: event.status } : {}),
    ...(event.sources ? { sources: event.sources.map(({ ref, revision }) => ({ ref, revision })) } : {}),
  });
}
