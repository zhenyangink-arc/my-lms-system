import 'server-only';
import type { CoreErrorCode } from '../contracts/public.ts';
export class CoreError extends Error {
  readonly code: CoreErrorCode;
  readonly cause?: unknown;
  constructor(code: CoreErrorCode, cause?: unknown) { super(code); this.code = code; this.cause = cause; }
}
export function publicErrorCode(value: unknown): CoreErrorCode {
  const codes: readonly CoreErrorCode[] = ['UNAUTHENTICATED','FORBIDDEN','INVALID_REQUEST','CONVERSATION_BUSY','IDEMPOTENCY_CONFLICT','RUN_NOT_FOUND','RUN_CANCELLED','DEADLINE_EXCEEDED','MODEL_CAPABILITY_UNAVAILABLE','PROVIDER_UNAVAILABLE','PROVIDER_PROTOCOL_ERROR','TOOL_NOT_ALLOWED','TOOL_INVALID_INPUT','TOOL_FAILED','BUDGET_UNAVAILABLE','PERSISTENCE_FAILED','REQUIRED_EVIDENCE_MISSING','SKILL_OUTPUT_INVALID'];
  return typeof value === 'string' && codes.includes(value as CoreErrorCode) ? value as CoreErrorCode : 'PERSISTENCE_FAILED';
}
export function errorCode(error: unknown): CoreErrorCode { return publicErrorCode(error instanceof CoreError ? error.code : undefined); }
export function safeMessage(code: CoreErrorCode): string {
  if (code === 'RUN_CANCELLED') return '请求已取消。';
  if (code === 'DEADLINE_EXCEEDED') return '请求已超时。';
  if (code === 'FORBIDDEN' || code === 'UNAUTHENTICATED') return '当前请求不可用。';
  return '本次请求未能完成，请稍后重试。';
}
