import { studentRuntimeEventSchema, type StudentTransportEvent } from '../../agent-core/contracts/transport.ts';
const known = new Set(['run.started','run.status','tool.status','answer.final','run.completed','run.failed','run.cancelled']);
/** Bounded byte framing preserves UTF-8 across arbitrary network chunks. */
export async function* parseStudentRunStream(stream: ReadableStream<Uint8Array>, maxFrameBytes = 32768): AsyncGenerator<StudentTransportEvent> {
 const reader = stream.getReader(), decoder = new TextDecoder('utf-8', { fatal: true });
 let bytes: number[] = [], seq = 0, runId: string | undefined;
 function line(): StudentTransportEvent | undefined {
  if (!bytes.length) return;
  const value: unknown = JSON.parse(decoder.decode(Uint8Array.from(bytes))); bytes = [];
  if (!value || typeof value !== 'object' || !('protocolVersion' in value) || value.protocolVersion !== 1) throw new Error('Unsupported Agent protocol');
  if (!('type' in value) || typeof value.type !== 'string') throw new Error('Invalid Agent event');
  if (!known.has(value.type)) return;
  const event = studentRuntimeEventSchema.parse(value);
  if (event.seq <= seq || (runId && event.runId !== runId)) throw new Error('Invalid Agent event order');
  seq = event.seq; runId = event.runId; return event;
 }
 try {
  while (true) {
   const { done, value } = await reader.read(); if (done) break;
   for (const byte of value) {
    if (byte === 10) { const event = line(); if (event) yield event; }
    else { if (bytes.length >= maxFrameBytes) throw new Error('Agent frame too large'); bytes.push(byte); }
   }
  }
  const event = line(); if (event) yield event;
 } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
