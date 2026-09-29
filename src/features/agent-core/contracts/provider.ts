import 'server-only';
import type { CoreErrorCode, UsageStatus } from './public.ts';
import type { RuntimeExecutionContext } from './server.ts';
export interface ModelRef { provider: string; model: string; configVersion: string }
export type CapabilityStatus = 'supported' | 'unsupported' | 'unverified';
export interface ProviderCapabilities {
  supportsStreaming: CapabilityStatus; supportsTools: CapabilityStatus;
  supportsStructuredOutput: CapabilityStatus; supportsVision: CapabilityStatus; supportsAudio: CapabilityStatus;
}
export type ProviderUsage =
  | { status: 'unknown' }
  | { status: Exclude<UsageStatus, 'unknown'>; inputTokens: number; outputTokens: number; totalTokens: number };
// Raw argument text is assembled by the Provider. Executor must parse AND validate it.
export interface ModelToolCall { id: string; name: string; arguments: string }
export type ModelMessage =
  | { role: 'system' | 'user'; text: string }
  | { role: 'assistant'; text: string; toolCalls?: ModelToolCall[] }
  | { role: 'tool'; callId: string; name: string; result: unknown };
export interface ProviderRequest {
  model: ModelRef; messages: ModelMessage[];
  tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
  toolChoice: 'auto' | 'none'; maxOutputTokens: number;
}
export interface ProviderResponse {
  text: string; toolCalls: ModelToolCall[]; usage: ProviderUsage;
  finishReason: 'stop' | 'tool_calls' | 'length'; providerRequestId?: string;
}
export type ProviderEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_call_complete'; call: ModelToolCall }
  | { type: 'usage'; usage: ProviderUsage }
  | { type: 'done'; response: ProviderResponse }
  | { type: 'error'; code: CoreErrorCode; retryable: boolean };
export interface ProviderCallContext extends RuntimeExecutionContext { modelCallId: string }
export interface ProviderAdapter {
  readonly providerId: string;
  getCapabilities(model: ModelRef): ProviderCapabilities;
  stream(request: ProviderRequest, context: ProviderCallContext): AsyncIterable<ProviderEvent>;
}
export interface RetryPolicy { readonly maxAutomaticRetries: 0 }
