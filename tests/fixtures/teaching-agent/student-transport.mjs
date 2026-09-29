import '../smart-textbook-legacy-adapter/register-server-only.mjs';
import { koreanHarness, providerFixture, requestFixture } from './student-runtime.mjs';
const { MemoryPersistence } = await import('../agent-core/foundation.mjs');
const { createStudentAiTeacherRuntime } = await import('../../../src/features/teaching-agent/server/runtime/create-student-ai-teacher-runtime.ts');
const { createStudentTransportHandlers } = await import('../../../src/features/teaching-agent/server/transport/student-handlers.ts');
const { ActiveRunAbortRegistry } = await import('../../../src/features/teaching-agent/server/transport/active-run-abort-registry.ts');
const { CoreError, safeMessage } = await import('../../../src/features/agent-core/runtime/errors.ts');
export const terminal = s => ['completed','failed','cancelled'].includes(s);
export const publicBody = input => ({ ...input.request, selection: input.selection, intent: input.intent });
export function req(body, options = {}) { return new Request('http://localhost/api/teaching-agent/runs', { method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json', ...options.headers }, body: JSON.stringify(body), ...options }); }
export const getReq = () => new Request('http://localhost/api/teaching-agent/runs/x');
export const cancelReq = () => new Request('http://localhost/api/teaching-agent/runs/x/cancel', { method: 'POST', headers: { origin: 'http://localhost' } });
export const eventsOf = async response => (await response.text()).trim().split('\n').filter(Boolean).map(JSON.parse);
export async function transportFixture(options = {}) {
 const h = koreanHarness(), input = await requestFixture(h), provider = options.provider ?? providerFixture();
 let persistence, owner = await h.authenticate(), authCalls = 0; const cancelled = new Set();
 const sequences = new Map();
 const store = {
  async reserveSequence(id) { const base = sequences.get(id) ?? 0; sequences.set(id, base + 128); return base; },
  async status(id) {
   const run = persistence?.runs.get(id); if (!run || run.actorId !== owner?.actorId || run.tenantId !== owner?.tenantId) return null;
   const result = { protocolVersion: 1, runId: id, conversationId: run.conversationId, status: run.status, createdAt: run.createdAt, endedAt: run.endedAt ?? null };
   if (run.status === 'completed') { result.finalAnswer = persistence.messages.find(m => m.runId === id && m.role === 'assistant').content;
    const meta = persistence.events.filter(e => e.runId === id && e.kind === 'output.checked').at(-1).details;
    result.sourceRefs = meta.sourceRefs; result.completeness = meta.completeness; }
   if (run.status === 'failed') result.safeFailure = { code: run.reason, safeMessage: safeMessage(run.reason), retryable: false };
   return result;
  },
  async cancel(id) { const status = await store.status(id); if (!status) return null; if (terminal(status.status)) return 'already_terminal'; cancelled.add(id); return 'accepted'; },
  async checkCancellation(run) { await options.checkpoint?.(run, store); if (cancelled.has(run.id)) throw new CoreError('RUN_CANCELLED'); },
 };
 const runtime = createStudentAiTeacherRuntime({ authenticate: h.authenticate, repository: options.repository ?? h.repository, provider: provider.provider,
  checkCancellation: store.checkCancellation,
  persistence: a => { if (!persistence) {
   persistence = new MemoryPersistence(a); const transition = persistence.transitionRun.bind(persistence);
   persistence.transitionRun = async args => { if (cancelled.has(args.run.id) && !['failed','cancelled'].includes(args.to)) throw new CoreError('RUN_CANCELLED');
    const next = await transition(args); if (terminal(next.status)) { const row = persistence.runs.get(next.id); row.endedAt = new Date().toISOString(); row.reason = args.reason; } return next; };
   options.configurePersistence?.(persistence);
  } return persistence; },
 });
 const registry = new ActiveRunAbortRegistry();
 const deps = { enabled: () => options.enabled ?? true, registry, authenticate: async () => { authCalls++; if (!owner) throw new CoreError('UNAUTHENTICATED'); return { owner: { ...owner }, store, runtime, allowAdmission: options.allowAdmission ?? (async () => true) }; } };
 return { handlers: createStudentTransportHandlers(deps), deps, store, runtime, input, body: publicBody(input), h, provider,
  get persistence() { return persistence; }, get authCalls() { return authCalls; }, setOwner(v) { owner = v; }, cancelled };
}
