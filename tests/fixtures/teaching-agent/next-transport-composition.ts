// Test process composition only. Never imported by the product application.
import { randomUUID } from 'node:crypto';
import { createStudentTransportHandlers } from '../../../src/features/teaching-agent/server/transport/student-handlers.ts';
import { ActiveRunAbortRegistry } from '../../../src/features/teaching-agent/server/transport/active-run-abort-registry.ts';
import type { AgentRun } from '../../../src/features/agent-core/contracts/server.ts';
import type { StudentRunStatus } from '../../../src/features/agent-core/contracts/transport.ts';
import type { createStudentAiTeacherRuntime } from '../../../src/features/teaching-agent/server/runtime/create-student-ai-teacher-runtime.ts';
import { CoreError } from '../../../src/features/agent-core/runtime/errors.ts';
const root = globalThis as typeof globalThis & { stage1dFixture?: { rows: Map<string, StudentRunStatus>; keys: Map<string,string>; cancelled: Set<string>; registry: ActiveRunAbortRegistry } };
const state = root.stage1dFixture ??= { rows: new Map(), keys: new Map(), cancelled: new Set(), registry: new ActiveRunAbortRegistry() };
const owner = { actorId: '00000000-0000-4000-a000-000000000001', tenantId: '00000000-0000-4000-a000-000000000002' };
const sequence = new Map<string, number>();
const store = { async reserveSequence(id: string) { const base = sequence.get(id) ?? 0; sequence.set(id, base + 128); return base; }, async status(id: string) { return state.rows.get(id) ?? null; }, async cancel(id: string) {
 const row = state.rows.get(id); if (!row) return null;
 if (['completed','failed','cancelled'].includes(row.status)) return 'already_terminal' as const;
 state.cancelled.add(id); return 'accepted' as const;
}, async checkCancellation() {} };
// Synthetic runtime validates wire lifecycle; actual Student Runtime/SQL integration is a separate test.
const runtime = { async run(input: Parameters<ReturnType<typeof createStudentAiTeacherRuntime>['run']>[0]) {
 const request = input.request as { idempotencyKey: string; message: string };
 const old = state.keys.get(request.idempotencyKey);
 if (old) return { run: { id: old } as AgentRun, replayed: true };
 const id = randomUUID(), conversationId = randomUUID(); state.keys.set(request.idempotencyKey,id);
 const row: StudentRunStatus = { protocolVersion: 1, runId: id, conversationId, status: 'running', createdAt: new Date().toISOString(), endedAt: null }; state.rows.set(id,row);
 const run = { id, conversationId, ...owner } as AgentRun;
 await input.onAdmitted?.(run); let seq = 0;
 const emit = (payload: object) => input.emit?.({ protocolVersion:1,runId:id,seq:++seq,at:new Date().toISOString(),...payload } as never);
 const wait = async () => { await new Promise(resolve=>setTimeout(resolve,180)); if (input.signal.aborted || state.cancelled.has(id)) throw new CoreError('RUN_CANCELLED'); };
 emit({type:'run.started',conversationId});
 try {
  await wait();emit({type:'run.status',phase:'retrieving'});
  await wait();emit({type:'tool.status',callId:'synthetic_call',state:'started'});
  await wait();emit({type:'tool.status',callId:'synthetic_call',state:'succeeded'});
  await wait(); row.status='completed';row.finalAnswer='한국어 설명';row.sourceRefs=['ta1:segment:'+'a'.repeat(64)];row.completeness='complete';row.endedAt=new Date().toISOString();
  emit({type:'answer.final',text:row.finalAnswer,sourceRefs:row.sourceRefs,completeness:'complete'});emit({type:'run.completed',usageStatus:'unknown'});
 } catch { row.status='cancelled';row.endedAt=new Date().toISOString();emit({type:'run.cancelled',partial:false}); }
 return { run: { ...run,status:row.status },replayed:false };
} };
export const studentTransport = createStudentTransportHandlers({enabled:()=>true,registry:state.registry,authenticate:async()=>({owner,store,runtime,allowAdmission:async()=>true})});
