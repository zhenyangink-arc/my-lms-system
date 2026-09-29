import 'server-only';
import type { RunOwner } from './run-store.ts';
import { CoreError } from '../../../agent-core/runtime/errors.ts';
/** Process-local acceleration only. Call abort ONLY after persistent cancel acceptance. */
export class ActiveRunAbortRegistry {
 private entries = new Map<string, AbortController>();
 private key(owner: RunOwner, id: string) { return `${owner.tenantId}:${owner.actorId}:${id}`; }
 register(owner: RunOwner, id: string, controller: AbortController) {
  const key = this.key(owner, id); if (this.entries.has(key)) throw new CoreError('CONVERSATION_BUSY');
  this.entries.set(key, controller);
  return () => { if (this.entries.get(key) === controller) this.entries.delete(key); };
 }
 abort(owner: RunOwner, id: string) { this.entries.get(this.key(owner, id))?.abort(new CoreError('RUN_CANCELLED')); }
}
export const activeRunAbortRegistry = new ActiveRunAbortRegistry();
