import 'server-only';
import type { ModelMessage, ProviderAdapter, ProviderCallContext, ProviderEvent, ProviderRequest } from '../../contracts/provider.ts';
import { deepSeekCapabilities } from './capabilities.ts';
import { parseDeepSeekStream } from './stream-parser.ts';
import { assertExecution, createDeadlineSignal } from '../../runtime/deadline.ts';
import { CoreError } from '../../runtime/errors.ts';
export interface DeepSeekServerConfig { readApiKey: () => string | undefined; fetchImpl?: typeof fetch }
function wireMessage(message: ModelMessage) {
  if (message.role === 'tool') return { role: 'tool', tool_call_id: message.callId, content: JSON.stringify(message.result) };
  if (message.role === 'assistant') return { role: message.role, content: message.text || null,
    ...(message.toolCalls?.length ? { tool_calls: message.toolCalls.map((call) => ({ id: call.id, type: 'function', function: { name: call.name, arguments: call.arguments } })) } : {}) };
  return { role: message.role, content: message.text };
}
export class DeepSeekProviderAdapter implements ProviderAdapter {
  readonly providerId = 'deepseek';
  private readonly config: DeepSeekServerConfig;
  constructor(config: DeepSeekServerConfig = { readApiKey: () => process.env.DEEPSEEK_API_KEY }) { this.config = config; }
  getCapabilities = deepSeekCapabilities;
  async *stream(request: ProviderRequest, context: ProviderCallContext): AsyncGenerator<ProviderEvent> {
    let deadline: ReturnType<typeof createDeadlineSignal> | undefined; let usageSeen = false;
    try {
      assertExecution(context.signal, context.deadlineAt);
      const caps = this.getCapabilities(request.model);
      if (caps.supportsStreaming !== 'supported' || caps.supportsTools !== 'supported') throw new CoreError('MODEL_CAPABILITY_UNAVAILABLE');
      if (!Number.isSafeInteger(request.maxOutputTokens) || request.maxOutputTokens <= 0 || request.maxOutputTokens > 8192) throw new CoreError('INVALID_REQUEST');
      const apiKey = this.config.readApiKey(); if (!apiKey) throw new CoreError('PROVIDER_UNAVAILABLE');
      deadline = createDeadlineSignal(context.signal, context.deadlineAt);
      const response = await (this.config.fetchImpl ?? fetch)('https://api.deepseek.com/chat/completions', {
        method: 'POST', signal: deadline.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: request.model.model, thinking: { type: 'disabled' },
          messages: request.messages.map(wireMessage), max_tokens: request.maxOutputTokens,
          stream: true, stream_options: { include_usage: true },
          ...(request.tools.length ? { tools: request.tools.map((tool) => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.inputSchema } })), tool_choice: request.toolChoice } : {}),
        }),
      });
      if (!response.ok || !response.body) { await response.body?.cancel(); throw new CoreError('PROVIDER_UNAVAILABLE'); }
      if (!response.headers.get('content-type')?.includes('text/event-stream')) { await response.body.cancel(); throw new CoreError('PROVIDER_PROTOCOL_ERROR'); }
      // No raw headers/body/reasoning escape. Correlation ID remains server-private.
      const requestId = response.headers.get('x-request-id')?.slice(0, 200);
      for await (const event of parseDeepSeekStream(response.body, deadline.signal, requestId)) {
        if (event.type === 'usage') usageSeen = true;
        if (event.type === 'done' && !usageSeen) { yield { type: 'usage', usage: { status: 'unknown' } }; usageSeen = true; }
        yield event;
      }
    } catch (error) {
      if (!usageSeen) yield { type: 'usage', usage: { status: 'unknown' } };
      const reason = deadline?.signal.aborted ? deadline.signal.reason : context.signal.aborted ? context.signal.reason : error;
      const code = reason instanceof CoreError ? reason.code : context.signal.aborted ? 'RUN_CANCELLED' : 'PROVIDER_UNAVAILABLE';
      yield { type: 'error', code, retryable: false };
    } finally { deadline?.dispose(); }
  }
}
