import 'server-only';
import { z } from 'zod';
import type { ModelToolCall, ProviderEvent, ProviderResponse, ProviderUsage } from '../../contracts/provider.ts';
import { CoreError } from '../../runtime/errors.ts';
import { withSignal } from '../../runtime/deadline.ts';
const usageSchema = z.object({ prompt_tokens: z.number().int().nonnegative(), completion_tokens: z.number().int().nonnegative(), total_tokens: z.number().int().nonnegative() });
const chunkSchema = z.object({
  choices: z.array(z.object({ index: z.number().int().optional(), finish_reason: z.string().nullable().optional(),
    delta: z.object({ content: z.string().nullable().optional(), tool_calls: z.array(z.object({
      index: z.number().int().nonnegative(), id: z.string().optional(), type: z.string().optional(),
      function: z.object({ name: z.string().optional(), arguments: z.string().optional() }).optional(),
    })).optional() }).optional(),
  })).optional(), usage: usageSchema.nullable().optional(),
});
export async function* parseDeepSeekStream(body: ReadableStream<Uint8Array>, signal: AbortSignal, providerRequestId?: string): AsyncGenerator<ProviderEvent> {
  const reader = body.getReader(); const decoder = new TextDecoder('utf-8', { fatal: true });
  const calls = new Map<number, { id: string; name: string; arguments: string }>();
  let buffer = ''; let text = ''; let bytes = 0; let finished = false;
  let usage: ProviderUsage = { status: 'unknown' };
  let finish: ProviderResponse['finishReason'] | undefined;
  function process(data: string): ProviderEvent[] {
    if (data === '[DONE]') {
      if (!finish) throw new CoreError('PROVIDER_PROTOCOL_ERROR');
      const toolCalls: ModelToolCall[] = [...calls.entries()].sort(([a], [b]) => a - b).map(([, call]) => call);
      if ((finish === 'tool_calls') !== (toolCalls.length > 0)) throw new CoreError('PROVIDER_PROTOCOL_ERROR');
      const ids = new Set<string>();
      for (const call of toolCalls) {
        if (!call.id || !call.name || ids.has(call.id)) throw new CoreError('PROVIDER_PROTOCOL_ERROR');
        ids.add(call.id);
        try { JSON.parse(call.arguments); } catch { throw new CoreError('PROVIDER_PROTOCOL_ERROR'); }
      }
      finished = true;
      return [...toolCalls.map((call): ProviderEvent => ({ type: 'tool_call_complete', call })),
        { type: 'done', response: { text, toolCalls, usage, finishReason: finish, ...(providerRequestId ? { providerRequestId } : {}) } }];
    }
    let raw: unknown; try { raw = JSON.parse(data); } catch { throw new CoreError('PROVIDER_PROTOCOL_ERROR'); }
    const result = chunkSchema.safeParse(raw); if (!result.success) throw new CoreError('PROVIDER_PROTOCOL_ERROR');
    const chunk = result.data; const events: ProviderEvent[] = [];
    if ((chunk.choices?.length ?? 0) > 1) throw new CoreError('PROVIDER_PROTOCOL_ERROR');
    for (const choice of chunk.choices ?? []) {
      if (choice.index !== undefined && choice.index !== 0) throw new CoreError('PROVIDER_PROTOCOL_ERROR');
      const delta = choice.delta;
      if (delta?.content) {
        if (finish) throw new CoreError('PROVIDER_PROTOCOL_ERROR');
        text += delta.content; events.push({ type: 'text_delta', text: delta.content });
      }
      for (const fragment of delta?.tool_calls ?? []) {
        if (finish || fragment.index > 15) throw new CoreError('PROVIDER_PROTOCOL_ERROR');
        const call = calls.get(fragment.index) ?? { id: '', name: '', arguments: '' };
        if (fragment.id) { if (call.id && call.id !== fragment.id) throw new CoreError('PROVIDER_PROTOCOL_ERROR'); call.id = fragment.id; }
        if (fragment.function?.name) call.name += fragment.function.name;
        call.arguments += fragment.function?.arguments ?? '';
        if (call.arguments.length > 65_536 || call.name.length > 128 || call.id.length > 200) throw new CoreError('PROVIDER_PROTOCOL_ERROR');
        calls.set(fragment.index, call);
      }
      if (choice.finish_reason) {
        if (finish || !['stop', 'tool_calls', 'length'].includes(choice.finish_reason)) throw new CoreError('PROVIDER_PROTOCOL_ERROR');
        finish = choice.finish_reason as ProviderResponse['finishReason'];
      }
    }
    if (chunk.usage) {
      if (chunk.usage.total_tokens !== chunk.usage.prompt_tokens + chunk.usage.completion_tokens) throw new CoreError('PROVIDER_PROTOCOL_ERROR');
      usage = { status: 'reported', inputTokens: chunk.usage.prompt_tokens, outputTokens: chunk.usage.completion_tokens, totalTokens: chunk.usage.total_tokens };
      events.push({ type: 'usage', usage });
    }
    return events;
  }
  try {
    while (!finished) {
      const part = await withSignal(reader.read(), signal);
      if (part.done) throw new CoreError('PROVIDER_PROTOCOL_ERROR');
      bytes += part.value.byteLength; if (bytes > 2_000_000) throw new CoreError('PROVIDER_PROTOCOL_ERROR');
      buffer += decoder.decode(part.value, { stream: true });
      // Normalize after accumulation so a CRLF split across chunks remains valid.
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer)) !== null) {
        const frame = buffer.slice(0, boundary.index); buffer = buffer.slice(boundary.index + boundary[0].length);
        const data = frame.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).replace(/^ /, '')).join('\n');
        if (!data) continue;
        for (const event of process(data)) yield event;
        if (finished) break;
      }
      if (buffer.length > 131_072) throw new CoreError('PROVIDER_PROTOCOL_ERROR');
    }
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    throw error instanceof CoreError ? error : new CoreError('PROVIDER_PROTOCOL_ERROR', error);
  } finally {
    // Do not let a non-cooperative upstream cancel promise outlive the Run's deadline.
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
