import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { agentRequestSchema, type RuntimeEvent, type RuntimeEventPayload } from '../../../agent-core/contracts/public.ts';
import { studentRuntimeEventSchema } from '../../../agent-core/contracts/transport.ts';
import { CoreError, errorCode, publicErrorCode, safeMessage } from '../../../agent-core/runtime/errors.ts';
import { withSignal } from '../../../agent-core/runtime/deadline.ts';
import { studentSelectionLocatorSchema } from '../selection/selection-types.ts';
import type { createStudentAiTeacherRuntime } from '../runtime/create-student-ai-teacher-runtime.ts';
import type { RunOwner, StudentRunStore } from './run-store.ts';
import { retryable } from './run-store.ts';
import { ActiveRunAbortRegistry } from './active-run-abort-registry.ts';
import { transportHeaders } from './transport-config.ts';
// Extend the strict Core intake, retaining all its field validation and unknown-key rejection.
export const studentPostSchema = agentRequestSchema.extend({ agentCode: z.literal('student-ai-teacher'),
 scope: agentRequestSchema.shape.scope.options[0], intent: z.literal('explain_segment'), selection: studentSelectionLocatorSchema }).strict();
type Runtime = ReturnType<typeof createStudentAiTeacherRuntime>;
export interface TransportSession { owner: RunOwner; store: StudentRunStore; runtime: Runtime;
 allowAdmission: (lessonId: string, signal: AbortSignal) => Promise<boolean> }
export interface StudentTransportDependencies { enabled: () => boolean; authenticate: () => Promise<TransportSession>; registry: ActiveRunAbortRegistry }
class HttpError extends Error { readonly status: number; readonly code: string; constructor(status: number, code: string) { super(code); this.status = status; this.code = code; } }
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: transportHeaders });
function failure(error: unknown, hide = false) {
 if (error instanceof HttpError) return json({ code: error.code }, error.status);
 const code = errorCode(error);
 const status = ({ UNAUTHENTICATED: 401, FORBIDDEN: hide ? 404 : 403, INVALID_REQUEST: 400,
  CONVERSATION_BUSY: 409, IDEMPOTENCY_CONFLICT: 409, RUN_NOT_FOUND: 404, RUN_CANCELLED: 408, DEADLINE_EXCEEDED: 408 } as Record<string, number>)[code] ?? 503;
 return json({ code: status === 404 ? 'RUN_NOT_FOUND' : code, safeMessage: safeMessage(code) }, status);
}
function origin(request: Request) {
 // Next normalizes loopback request URLs. Host is the browser's target authority;
 // do not accept forwarded-host as a CSRF authority or absent/null Origin.
 const url = new URL(request.url), expected = `${url.protocol}//${request.headers.get('host') ?? url.host}`;
 if (request.headers.get('origin') !== expected || request.headers.get('sec-fetch-site') === 'cross-site') throw new CoreError('FORBIDDEN');
}
async function body(request: Request) {
 const max = 32768, declared = request.headers.get('content-length');
 if (declared && (!/^\d+$/.test(declared) || Number(declared) > max)) throw new HttpError(413, 'PAYLOAD_TOO_LARGE');
 if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE');
 origin(request);
 const reader = request.body?.getReader(); if (!reader) throw new CoreError('INVALID_REQUEST');
 const signal = AbortSignal.any([request.signal, AbortSignal.timeout(10000)]);
 let size = 0; const chunks: Uint8Array[] = [];
 try { while (true) { const next = await withSignal(reader.read(), signal); if (next.done) break;
  size += next.value.length; if (size > max) throw new HttpError(413, 'PAYLOAD_TOO_LARGE'); chunks.push(next.value); }
 } finally { void reader.cancel().catch(() => {}); reader.releaseLock(); }
 const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
 try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw new CoreError('INVALID_REQUEST'); }
}
export function createStudentTransportHandlers(deps: StudentTransportDependencies) {
 const gate = () => { if (!deps.enabled()) throw new HttpError(404, 'RUN_NOT_FOUND'); };
 const auth = (request: Request) => withSignal(deps.authenticate(), AbortSignal.any([request.signal, AbortSignal.timeout(10000)]));
 return {
  async post(request: Request): Promise<Response> {
   const metadata = { requestId: randomUUID(), receivedAt: new Date().toISOString() };
   try {
    gate(); if (request.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED');
    const parsed = studentPostSchema.safeParse(await body(request)); if (!parsed.success) throw new CoreError('INVALID_REQUEST');
    const session = await auth(request), controller = new AbortController();
    const admissionSignal = AbortSignal.any([request.signal, AbortSignal.timeout(10000)]);
    if (!await withSignal(session.allowAdmission(parsed.data.selection.lessonId, admissionSignal), admissionSignal)) throw new CoreError('FORBIDDEN');
    gate(); // Recheck after asynchronous auth/rollout resolution; OFF never starts this request.
    const { selection, intent, ...core } = parsed.data;
    let ownsExecution = false, sequenceLimit = 0;
    let runId: string | undefined, seq = 0, started = false, closed = false, release: (() => void) | undefined;
    let resolveReady!: (response: Response) => void;
    const ready = new Promise<Response>(resolve => { resolveReady = resolve; });
    let streamController!: ReadableStreamDefaultController<Uint8Array>;
    const persistDisconnect = async () => { if (runId && ownsExecution) await withSignal(session.store.cancel(runId), AbortSignal.timeout(2000)); };
    const disconnect = () => {
     if (!closed) { closed = true; streamController.error(new CoreError('RUN_CANCELLED')); }
     controller.abort(new CoreError('RUN_CANCELLED'));
     void persistDisconnect().catch(() => { /* worker still performs fenced stop-only cleanup */ });
    };
    const stream = new ReadableStream<Uint8Array>({ start(c) { streamController = c; }, cancel() { disconnect(); } },
      { highWaterMark: 262144, size: chunk => chunk.byteLength });
    const response = new Response(stream, { headers: { ...transportHeaders, 'Content-Type': 'application/x-ndjson; charset=utf-8', 'X-Request-Id': metadata.requestId } });
    const callIds = new Map<string, string>();
    const send = (event: RuntimeEvent) => {
     if (closed) return;
     // Explicit projection drops extra fields and normalizes error text/call IDs.
     let projected = studentRuntimeEventSchema.parse(event);
     if (projected.type === 'run.failed') { const code = publicErrorCode(projected.code); projected = { ...projected, code, safeMessage: safeMessage(code), retryable: retryable(code) }; }
     if (projected.type === 'tool.status') { if (!callIds.has(projected.callId)) callIds.set(projected.callId, randomUUID()); projected = { ...projected, callId: callIds.get(projected.callId)! }; }
     if (!started && projected.type !== 'run.started') throw new CoreError('PERSISTENCE_FAILED');
     if (seq >= sequenceLimit) throw new CoreError('PERSISTENCE_FAILED');
     projected = { ...projected, seq: ++seq };
     if ((streamController.desiredSize ?? 0) <= 0) { disconnect(); return; }
     try { streamController.enqueue(new TextEncoder().encode(JSON.stringify(projected) + '\n')); }
     catch { disconnect(); return; }
     if (!started) { started = true; resolveReady(response); }
    };
    const event = (payload: RuntimeEventPayload) => send({ protocolVersion: 1, runId: runId!, seq: seq + 1, at: new Date().toISOString(), ...payload });
    const finish = () => { request.signal.removeEventListener('abort', disconnect); release?.(); if (!closed) { closed = true; streamController.close(); } };
    request.signal.addEventListener('abort', disconnect, { once: true }); if (request.signal.aborted) disconnect();
    void session.runtime.run({ request: core, selection, intent, metadata, signal: controller.signal,
     onAdmitted: async run => { runId = run.id; ownsExecution = true;
      if (controller.signal.aborted) { await persistDisconnect(); return; }
      seq = await withSignal(session.store.reserveSequence(runId), controller.signal); sequenceLimit = seq + 128;
      release = deps.registry.register(session.owner, run.id, controller); },
     emit: send,
    }).then(async result => {
     runId = result.run.id;
     if (result.replayed) {
      const status = await session.store.status(runId); if (!status) throw new CoreError('RUN_NOT_FOUND');
      seq = await session.store.reserveSequence(runId); sequenceLimit = seq + 128;
      event({ type: 'run.started', conversationId: status.conversationId, replayed: true });
      if (status.status === 'completed') {
       event({ type: 'answer.final', text: status.finalAnswer!, sourceRefs: status.sourceRefs!, completeness: status.completeness! });
       event({ type: 'run.completed', usageStatus: 'unknown' });
      } else if (status.status === 'failed') event({ type: 'run.failed', ...status.safeFailure!, partial: false });
      else if (status.status === 'cancelled') event({ type: 'run.cancelled', partial: false });
      else event({ type: 'run.status', phase: status.status === 'waiting_tool' ? 'retrieving' : 'resolving_context' });
     }
     if (!started) resolveReady(failure(new CoreError(controller.signal.aborted ? 'RUN_CANCELLED' : 'PERSISTENCE_FAILED')));
    }).catch(error => {
     if (!started) resolveReady(failure(error));
     else if (!closed) { const code = errorCode(error); event({ type: 'run.failed', code, safeMessage: safeMessage(code), retryable: retryable(code), partial: false }); }
    }).finally(finish);
    return await ready;
   } catch (error) { return failure(error); }
  },
  async status(request: Request, runId: string) {
   try { if (request.method !== 'GET') throw new HttpError(405, 'METHOD_NOT_ALLOWED');
    const session = await auth(request); if (!z.uuid().safeParse(runId).success) throw new CoreError('RUN_NOT_FOUND');
    const value = await withSignal(session.store.status(runId), AbortSignal.timeout(10000)); if (!value) throw new CoreError('RUN_NOT_FOUND');
    return json(value);
   } catch (error) { return failure(error, true); }
  },
  async cancel(request: Request, runId: string) {
   try { if (request.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED'); origin(request);
    // Cancellation has no browser-supplied execution parameters/body.
    if (request.body) {
     const reader = request.body.getReader();
     try { while (true) { const part = await withSignal(reader.read(), AbortSignal.any([request.signal, AbortSignal.timeout(10000)])); if (part.done) break; if (part.value.length) throw new CoreError('INVALID_REQUEST'); } }
     finally { void reader.cancel().catch(() => {}); reader.releaseLock(); }
    }
    const session = await auth(request); if (!z.uuid().safeParse(runId).success) throw new CoreError('RUN_NOT_FOUND');
    const result = await withSignal(session.store.cancel(runId), AbortSignal.timeout(10000)); if (!result) throw new CoreError('RUN_NOT_FOUND');
    if (result === 'accepted') deps.registry.abort(session.owner, runId);
    return json({ result });
   } catch (error) { return failure(error, true); }
  },
 };
}
