import 'server-only';
import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { RecordingRpcTransport, ProofServices } from './recording-evidence-v2.server';

export type RecordingErrorCode = 'duplicate' | 'conflict' | 'consumed' | 'pending' | 'proof-invalid'
  | 'max-attempts' | 'unavailable' | 'fenced' | 'invalid';
export class RecordingDomainError extends Error {
  constructor(readonly code: RecordingErrorCode) { super(`Recording domain: ${code}`); }
}
export function recordingRpcError(error: { code?: string; message?: string }): RecordingDomainError {
  const m = error.message ?? '';
  return new RecordingDomainError(m.includes('MAX_ATTEMPTS') ? 'max-attempts'
    : m.includes('ALREADY_COMPLETED') || error.code === '23505' ? 'duplicate'
    : /CONSUMED/.test(m) ? 'consumed' : /PENDING/.test(m) ? 'pending'
    : /PROOF|KEY|SIGNATURE/.test(m) ? 'proof-invalid'
    : /DRAIN|FENCE|EPOCH|LEASE|ACKNOWLEDGED/.test(m) ? 'fenced'
    : /MISMATCH|CONFLICT|NOT_CONSUMABLE/.test(m) || error.code === '40001' ? 'conflict'
    : /INVALID|COVERAGE|SCOPE/.test(m) ? 'invalid' : 'unavailable');
}
export function supabaseRecordingRpc(admin: Pick<SupabaseClient, 'rpc'>): RecordingRpcTransport {
  return async (name, args) => {
    const { data, error } = await admin.rpc(name, args);
    if (error) throw recordingRpcError(error);
    if (data === null || data === undefined) throw new RecordingDomainError('unavailable');
    return data;
  };
}

const cohortSchema = z.array(z.object({ tenantId: z.string().uuid(), studentId: z.string().uuid() }).strict());
export function recordingEvidenceV2(env: NodeJS.ProcessEnv, owner: { tenantId: string; studentId: string }) {
  const configured = env.RECORDING_EVIDENCE_V2_ENABLED !== undefined || env.RECORDING_EVIDENCE_V2_EPOCH !== undefined
    || env.RECORDING_EVIDENCE_V2_SCOPE !== undefined;
  if (env.RECORDING_EVIDENCE_V2_ENABLED !== undefined && !['true','false'].includes(env.RECORDING_EVIDENCE_V2_ENABLED))
    throw new RecordingDomainError('invalid');
  let cohort: z.infer<typeof cohortSchema>;
  try { cohort = cohortSchema.parse(JSON.parse(env.RECORDING_EVIDENCE_V2_SCOPE ?? '[]')); }
  catch { throw new RecordingDomainError('invalid'); }
  const epoch = Number(env.RECORDING_EVIDENCE_V2_EPOCH ?? 1);
  const instance = env.RECORDING_EVIDENCE_INSTANCE_ID ?? 'unconfigured';
  if (!Number.isSafeInteger(epoch) || epoch < 1 || instance.length > 128 || !instance.length
    || (configured && instance === 'unconfigured')) throw new RecordingDomainError('invalid');
  return { configured, epoch, instance, domain: env.RECORDING_EVIDENCE_V2_ENABLED === 'true'
    && cohort.some(s => s.tenantId === owner.tenantId && s.studentId === owner.studentId) ? 'v2' as const : 'v1' as const };
}

export interface RecordingEvidenceProofKeyProvider { get(): Promise<Pick<ProofServices, 'keyId' | 'secret'>>; }
/** Environment/secret-manager injection point; never returns keys to an Action. */
export class EnvironmentRecordingProofKeyProvider implements RecordingEvidenceProofKeyProvider {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}
  async get() {
    const keyId = this.env.RECORDING_EVIDENCE_PROOF_KEY_ID;
    const encoded = this.env.RECORDING_EVIDENCE_PROOF_SECRET_HEX;
    if (!keyId || !/^[a-zA-Z0-9_-]{1,64}$/.test(keyId) || !encoded || !/^[a-f0-9]{64,128}$/i.test(encoded)
      || encoded.length % 2) throw new RecordingDomainError('proof-invalid');
    return { keyId, secret: Buffer.from(encoded, 'hex') };
  }
}

export type RecordingDomainRequest = {
  readonly domain: 'v1' | 'v2'; readonly epoch: number;
  readonly owner: { tenantId: string; studentId: string };
  beforeWrite(): Promise<void>;
  uploadState(operation: 'reserve' | 'settle' | 'assert-settled', evidenceId: string): Promise<void>;
};
// Request propagation only. All locks, leases and fence decisions live in PG.
const requestContext = new AsyncLocalStorage<RecordingDomainRequest>();
export const currentRecordingDomain = () => requestContext.getStore();
export async function beforeRecordingWrite() {
  const request = requestContext.getStore();
  if (!request) throw new RecordingDomainError('fenced');
  await request.beforeWrite();
}

export async function assertLegacyRecordingScopeSafe(admin: SupabaseClient, owner: { tenantId: string; studentId: string }) {
  const { data, error } = await admin.from('digital_textbook_speaking_evidence').select('metadata')
    .eq('tenant_id', owner.tenantId).eq('student_id', owner.studentId)
    // Filter on the server before LIMIT; never inspect only the first default
    // PostgREST page and accidentally miss a later v2 evidence row.
    .or('metadata->runtimeBinding.not.is.null,metadata->lifecycle.not.is.null').limit(1);
  if (error || !Array.isArray(data)) throw new RecordingDomainError('unavailable');
  if (data.some(row => row.metadata && (Object.hasOwn(row.metadata, 'runtimeBinding') || Object.hasOwn(row.metadata, 'lifecycle'))))
    throw new RecordingDomainError('fenced');
}

/** Every recording caller enters here AFTER authentication and activity access.
 * No request/query/header/cookie is accepted as a gate input.
 * Missing pre-migration RPC is accepted ONLY with wholly absent gate config,
 * and a read guard proving this owner has no v2 state. Never downgrade an outage.
 */
export async function withRecordingDomain<T>(admin: SupabaseClient, owner: { tenantId: string; studentId: string },
  run: (request: RecordingDomainRequest) => Promise<T>, env: NodeJS.ProcessEnv = process.env): Promise<T> {
  const config = recordingEvidenceV2(env, owner);
  const args = { p_request_id: randomUUID(), p_instance_id: config.instance, p_epoch: config.epoch,
    p_tenant_id: owner.tenantId, p_student_id: owner.studentId, p_domain: config.domain };
  const { data, error } = await admin.rpc('recording_domain_request_v1', { ...args, p_operation: 'enter' });
  let bootstrap = false;
  if (error?.code === 'PGRST202' && /recording_domain_request_v1/.test(error.message ?? '') && !config.configured) {
    await assertLegacyRecordingScopeSafe(admin, owner);
    bootstrap = true;
  } else if (error) throw recordingRpcError(error);
  else if (!data || data.epoch !== config.epoch || data.domain !== config.domain || data.requestId !== args.p_request_id)
    throw new RecordingDomainError('fenced');
  const rpc = supabaseRecordingRpc(admin);
  const request: RecordingDomainRequest = { domain: config.domain, epoch: config.epoch, owner,
    beforeWrite: async () => {
      if (bootstrap) await assertLegacyRecordingScopeSafe(admin, owner);
      else await rpc('recording_domain_request_v1', { ...args, p_operation: 'check' });
    },
    uploadState: async (operation, evidenceId) => {
      if (bootstrap || config.domain !== 'v2') throw new RecordingDomainError('fenced');
      await rpc('recording_domain_upload_v1', { ...args, p_operation: operation, p_evidence_id: evidenceId });
    } };
  try { return await requestContext.run(request, () => run(request)); }
  finally {
    // Never release before external requests/compensation settle. A failed
    // release deliberately strands the lease and blocks operator cutover.
    if (!bootstrap) await rpc('recording_domain_request_v1', { ...args, p_operation: 'release' });
  }
}
