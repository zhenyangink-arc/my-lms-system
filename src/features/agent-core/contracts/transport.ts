// Public, client-safe transport validation. No server execution types.
import { z } from 'zod';
const envelope = { protocolVersion: z.literal(1), runId: z.uuid(), seq: z.number().int().positive(), at: z.iso.datetime({ offset: true }) };
const sources = z.array(z.string().regex(/^ta1:[a-z_]+:[a-f0-9]{64}$/)).max(3);
export const transportErrorCodeSchema = z.enum(['UNAUTHENTICATED','FORBIDDEN','INVALID_REQUEST','CONVERSATION_BUSY','IDEMPOTENCY_CONFLICT','RUN_NOT_FOUND','RUN_CANCELLED','DEADLINE_EXCEEDED','MODEL_CAPABILITY_UNAVAILABLE','PROVIDER_UNAVAILABLE','PROVIDER_PROTOCOL_ERROR','TOOL_NOT_ALLOWED','TOOL_INVALID_INPUT','TOOL_FAILED','BUDGET_UNAVAILABLE','PERSISTENCE_FAILED','REQUIRED_EVIDENCE_MISSING','SKILL_OUTPUT_INVALID']);
// .strip projects known fields; never spreads an internal payload into the wire.
export const studentRuntimeEventSchema = z.discriminatedUnion('type', [
 z.object({ ...envelope, type: z.literal('run.started'), conversationId: z.uuid(), replayed: z.boolean().optional() }),
 z.object({ ...envelope, type: z.literal('run.status'), phase: z.enum(['resolving_context','selecting_skill','retrieving','answering']) }),
 z.object({ ...envelope, type: z.literal('tool.status'), callId: z.string().min(1).max(200), state: z.enum(['started','succeeded','failed']) }),
 z.object({ ...envelope, type: z.literal('answer.final'), text: z.string().max(6500), sourceRefs: sources, completeness: z.enum(['complete','partial']) }),
 z.object({ ...envelope, type: z.literal('run.completed'), usageStatus: z.enum(['reported','estimated','unknown']) }),
 z.object({ ...envelope, type: z.literal('run.failed'), code: transportErrorCodeSchema, safeMessage: z.string().max(200), partial: z.boolean(), retryable: z.boolean().optional() }),
 z.object({ ...envelope, type: z.literal('run.cancelled'), partial: z.boolean() }),
]);
export type StudentTransportEvent = z.infer<typeof studentRuntimeEventSchema>;
export const studentRunStatusSchema = z.object({ protocolVersion: z.literal(1), runId: z.uuid(), conversationId: z.uuid(),
 status: z.enum(['created','running','waiting_tool','waiting_confirmation','completed','failed','cancelled']),
 createdAt: z.iso.datetime({ offset: true }), endedAt: z.iso.datetime({ offset: true }).nullable(),
 finalAnswer: z.string().max(6500).optional(), sourceRefs: sources.optional(), completeness: z.enum(['complete','partial']).optional(),
 safeFailure: z.object({ code: transportErrorCodeSchema, safeMessage: z.string().max(200), retryable: z.boolean() }).optional(),
});
export type StudentRunStatus = z.infer<typeof studentRunStatusSchema>;
