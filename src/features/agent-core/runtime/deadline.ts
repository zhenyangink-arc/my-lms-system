import 'server-only';
import { CoreError } from './errors.ts';
export function assertExecution(signal: AbortSignal, deadlineAt: string, now = Date.now()): number {
  if (signal.aborted) throw signal.reason instanceof CoreError ? signal.reason : new CoreError('RUN_CANCELLED');
  const remaining = Date.parse(deadlineAt) - now;
  if (!Number.isFinite(remaining) || remaining <= 0) throw new CoreError('DEADLINE_EXCEEDED');
  return remaining;
}
export function createDeadlineSignal(parent: AbortSignal, deadlineAt: string, maxMs = 45_000) {
  const remaining = assertExecution(parent, deadlineAt);
  const controller = new AbortController();
  const onAbort = () => controller.abort(parent.reason instanceof CoreError ? parent.reason : new CoreError('RUN_CANCELLED'));
  parent.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(new CoreError('DEADLINE_EXCEEDED')), Math.min(remaining, maxMs));
  return { signal: controller.signal, dispose() { clearTimeout(timer); parent.removeEventListener('abort', onAbort); } };
}
export async function withSignal<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) { void work.catch(() => {}); throw signal.reason; }
  let rejectAbort: (() => void) | undefined;
  const stopped = new Promise<never>((_, reject) => { rejectAbort = () => reject(signal.reason); signal.addEventListener('abort', rejectAbort, { once: true }); });
  try { return await Promise.race([work, stopped]); }
  finally { if (rejectAbort) signal.removeEventListener('abort', rejectAbort); }
}
