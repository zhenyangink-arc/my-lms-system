import { z } from 'zod';

const id = z.string().uuid();
const ref = z.string().min(1).max(200);
export const scopeLocatorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('lesson'), lessonId: id, moduleId: id, teachingSessionId: id.optional() }).strict(),
  z.object({ kind: z.literal('course'), courseId: id }).strict(),
  z.object({ kind: z.literal('teacher_workspace'), appId: id, courseId: id, studentRef: ref.optional() }).strict(),
  z.object({ kind: z.literal('practice'), practiceSessionRef: ref }).strict(),
  z.object({ kind: z.literal('user_global') }).strict(),
]);
// Locators and client hints are untrusted. Strict parsing rejects authority fields.
export const agentRequestSchema = z.object({
  protocolVersion: z.literal(1), agentCode: z.string().regex(/^[a-z][a-z0-9-]{0,79}$/),
  conversationId: id.optional(), idempotencyKey: z.string().min(8).max(128),
  message: z.string().trim().min(1).max(8000), scope: scopeLocatorSchema,
  clientContext: z.object({
    route: z.string().max(500).optional(), selectedText: z.string().max(2000).optional(),
    selectedContentRef: ref.optional(), segmentRef: ref.optional(),
    mediaPositionMs: z.number().finite().nonnegative().optional(),
    locale: z.enum(['zh-CN', 'ko-KR']).optional(),
  }).strict().optional(),
}).strict();
export type AgentRequest = z.infer<typeof agentRequestSchema>;
export type ScopeLocator = z.infer<typeof scopeLocatorSchema>;
export type RunStatus = 'created' | 'running' | 'waiting_tool' | 'waiting_confirmation' | 'completed' | 'failed' | 'cancelled';
export type UsageStatus = 'reported' | 'estimated' | 'unknown';
export type CoreErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN' | 'INVALID_REQUEST' | 'CONVERSATION_BUSY'
  | 'IDEMPOTENCY_CONFLICT' | 'RUN_NOT_FOUND' | 'RUN_CANCELLED' | 'DEADLINE_EXCEEDED'
  | 'MODEL_CAPABILITY_UNAVAILABLE' | 'PROVIDER_UNAVAILABLE' | 'PROVIDER_PROTOCOL_ERROR'
  | 'TOOL_NOT_ALLOWED' | 'TOOL_INVALID_INPUT' | 'TOOL_FAILED' | 'BUDGET_UNAVAILABLE' | 'PERSISTENCE_FAILED'
  | 'REQUIRED_EVIDENCE_MISSING' | 'SKILL_OUTPUT_INVALID';
export interface RuntimeEventEnvelope { protocolVersion: 1; runId: string; seq: number; at: string }
export type RuntimeEventPayload =
  | { type: 'run.started'; conversationId: string; replayed?: boolean }
  | { type: 'run.status'; phase: 'resolving_context' | 'selecting_skill' | 'retrieving' | 'answering' }
  | { type: 'tool.status'; callId: string; state: 'started' | 'succeeded' | 'failed' }
  | { type: 'answer.delta'; text: string }
  | { type: 'answer.final'; text: string; sourceRefs: string[]; completeness: 'complete' | 'partial' }
  | { type: 'run.completed'; usageStatus: UsageStatus }
  | { type: 'run.failed'; code: CoreErrorCode; safeMessage: string; retryable?: boolean; partial: boolean }
  | { type: 'run.cancelled'; partial: boolean }
  | { type: 'confirmation.required'; confirmationRef: string; expiresAt: string };
export type RuntimeEvent = RuntimeEventEnvelope & RuntimeEventPayload;
