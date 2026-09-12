import 'server-only';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { checkR2ObjectExists } from './r2';
import { gradeSmartTextbookActivity } from '@/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-submission';

// Internal domain gateway ONLY: not a Server Action, Route or browser service.
// Caller must first authorize the active learner and resolve private bindings.
const kindSchema = z.enum(['independent-output', 'roleplay-turn', 'guided-repeat-line', 'full-recall', 'legacy-speaking']);
export const recordingRuntimeBindingSchema = z.object({
  snapshot: z.string().min(1), sourceRevision: z.string().min(1), versionId: z.string().uuid(),
  activityRef: z.string().min(1), recordingKind: kindSchema,
}).strict();
export type RecordingRuntimeBinding = z.infer<typeof recordingRuntimeBindingSchema>;
const common = {
  storage: z.literal('r2').optional(), runtimeBinding: recordingRuntimeBindingSchema.optional(),
  lifecycle: z.enum(['active', 'delete-pending', 'consumed']).optional(),
};
const metadataSchema = z.union([
  z.object({ ...common, durationSeconds: z.number().positive().finite() }).strict(),
  z.object({ ...common, sceneId: z.string().min(1).max(80), roleSide: z.enum(['left', 'right']),
    turnIndex: z.number().int().min(0).max(999), transcript: z.string().max(500).nullable().optional(),
    transcriptSource: z.literal('browser_speech_recognition').nullable().optional() }).strict(),
  z.object({ ...common, practiceKey: z.enum(['repeat-line', 'full-recall']), trackIndex: z.number().int().min(0).max(8),
    segmentIndex: z.number().int().min(0).max(100), durationSeconds: z.number().positive().optional() }).strict(),
  z.object({ runtimeBinding: recordingRuntimeBindingSchema.optional(), lifecycle: common.lifecycle }).strict(),
]);
const rowSchema = z.object({
  id: z.string().uuid(), tenant_id: z.string().uuid(), student_id: z.string().uuid(), activity_id: z.string().uuid(),
  object_key: z.string(), byte_size: z.number().int().min(2048).max(10485760),
  mime_type: z.enum(['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg']), created_at: z.string().datetime({ offset: true }),
  consumed_at: z.string().nullable(), consumed_attempt_number: z.number().nullable(), metadata: metadataSchema,
}).strict();
export type RecordingEvidenceRow = z.infer<typeof rowSchema>;
export type RecordingScope = Readonly<{
  tenantId: string; studentId: string; activityId: string; versionId: string;
  runtimeBinding: RecordingRuntimeBinding | null;
}>;
type Json = null | string | number | boolean | Json[] | { [key: string]: Json };
export function canonicalRecordingJson(value: Json): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && (!Number.isFinite(value) || Math.abs(value) >= 1e21 || (value !== 0 && Math.abs(value) < 1e-6))) {
      throw new Error('Unsupported proof numeric representation');
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalRecordingJson).join(',')}]`;
  return `{${Object.keys(value).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)))
    .map(key => `${JSON.stringify(key)}:${canonicalRecordingJson(value[key])}`).join(',')}}`;
}
export const recordingDigest = (value: Json) => createHash('sha256').update(canonicalRecordingJson(value)).digest('hex');
export function decodeRecordingEvidence(value: unknown) {
  const row = rowSchema.parse(value), m = row.metadata;
  const kind = 'sceneId' in m ? 'roleplay-turn' : 'practiceKey' in m
    ? m.practiceKey === 'repeat-line' ? 'guided-repeat-line' : 'full-recall'
    : 'durationSeconds' in m ? 'independent-output' : 'legacy-speaking';
  const ext = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3' }[row.mime_type];
  const base = `${row.tenant_id}/${row.student_id}/${row.activity_id}/${row.id}.${ext}`;
  const backend = row.object_key === `student-recordings/${base}` && kind !== 'legacy-speaking'
    ? 'r2' : row.object_key === base && kind === 'legacy-speaking' && !('storage' in m) ? 'legacy-supabase' : null;
  if (!backend) throw new Error('Recording backend/path conflict');
  return { row, kind, backend, objectDigest: recordingDigest({ backend, key: row.object_key }) } as const;
}

export type ObjectProof = Readonly<{ keyId: string; payload: string; signature: string }>;
type Head = (key: string) => Promise<{ exists: boolean; size?: number; contentType?: string }>;
export type ProofServices = {
  // Keys supplied by a trusted server secret provider, never request fields.
  keyId: string; secret: Buffer;
  headR2?: Head;
  headLegacy: Head;
};

/** Proof of metadata/existence at HEAD time; NOT proof of speech quality. */
async function issueObjectProof(scope: RecordingScope, evidence: unknown, purpose: 'speaking-completion' | 'roleplay-completion', response: Json, services: ProofServices): Promise<ObjectProof> {
  const { row, kind, backend, objectDigest } = decodeRecordingEvidence(evidence);
  if (row.tenant_id !== scope.tenantId || row.student_id !== scope.studentId || row.activity_id !== scope.activityId
    || canonicalRecordingJson(row.metadata.runtimeBinding ?? null) !== canonicalRecordingJson(scope.runtimeBinding)
    || (scope.runtimeBinding && (scope.runtimeBinding.versionId !== scope.versionId || scope.runtimeBinding.recordingKind !== kind))) {
    throw new Error('Recording scope mismatch');
  }
  const now = Date.now();
  if (row.consumed_at !== null || row.consumed_attempt_number !== null || (row.metadata.lifecycle ?? 'active') !== 'active'
    || now - Date.parse(row.created_at) > 86400000 || Date.parse(row.created_at) > now) throw new Error('Recording not consumable');
  if (services.secret.length < 32 || !/^[a-zA-Z0-9_-]{1,64}$/.test(services.keyId)) throw new Error('Proof key unavailable');
  const head = await (backend === 'r2' ? services.headR2 ?? checkR2ObjectExists : services.headLegacy)(row.object_key);
  if (!head.exists || head.size !== row.byte_size || head.contentType?.split(';', 1)[0] !== row.mime_type) throw new Error('Recording object mismatch');
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = canonicalRecordingJson({
    protocol: 'recording-object-proof.v2', purpose, evidenceId: row.id, tenantId: scope.tenantId,
    studentId: scope.studentId, activityId: scope.activityId, versionId: scope.versionId, runtimeBinding: scope.runtimeBinding,
    backend, recordingKind: kind, objectDigest, metadataDigest: recordingDigest(row.metadata), byteSize: row.byte_size,
    mimeType: row.mime_type, responseDigest: recordingDigest(response), issuedAt, expiresAt: issuedAt + 45,
    nonce: randomBytes(32).toString('hex'),
  });
  return { keyId: services.keyId, payload, signature: createHmac('sha256', services.secret).update(payload).digest('hex') };
}

const speakingResponseSchema = z.object({ recorded: z.literal(true), durationSeconds: z.number().positive(),
  turns: z.number().int().nonnegative().optional(), criteria: z.array(z.boolean()).optional(), recordingEvidenceId: z.string().uuid() }).strict();
export async function issueSpeakingCompletionProof(scope: RecordingScope, evidence: unknown, responseValue: unknown,
  trustedActivity: { answerKey: unknown; publicConfig: unknown }, services: ProofServices) {
  const response = speakingResponseSchema.parse(responseValue), decoded = decodeRecordingEvidence(evidence);
  if (!['independent-output', 'legacy-speaking'].includes(decoded.kind) || response.recordingEvidenceId !== decoded.row.id) throw new Error('Speaking evidence mismatch');
  const grade = gradeSmartTextbookActivity(trustedActivity.answerKey, response, 'speaking', trustedActivity.publicConfig);
  if (!grade.ok || grade.meetsCompletionRequirements !== true) throw new Error('Existing grader did not qualify completion');
  return issueObjectProof(scope, evidence, 'speaking-completion', response, services);
}

/** Scene comes from the trusted current node reader; SQL independently derives coverage. */
export async function issueRoleplayCompletionProofs(scope: RecordingScope, rows: unknown[],
  scene: { id: string; lines: readonly unknown[] }, roleSide: 'left' | 'right', services: ProofServices) {
  const turns = scene.lines.map((_, i) => i).filter(i => i % 2 === (roleSide === 'left' ? 0 : 1));
  const response = { sceneId: scene.id, roleSide, recordedTurns: turns };
  const decoded = rows.map(decodeRecordingEvidence);
  const actual = decoded.map(d => 'turnIndex' in d.row.metadata ? d.row.metadata.turnIndex : -1);
  if (!turns.length || new Set(decoded.map(d => d.row.id)).size !== turns.length || actual.length !== turns.length
    || new Set(actual).size !== turns.length || !turns.every(t => actual.includes(t))) throw new Error('Roleplay coverage mismatch');
  return Promise.all(decoded.map(async d => {
    const m = d.row.metadata;
    if (d.kind !== 'roleplay-turn' || !('sceneId' in m) || m.sceneId !== scene.id || m.roleSide !== roleSide) throw new Error('Roleplay binding mismatch');
    return { evidenceId: d.row.id, proof: await issueObjectProof(scope, d.row, 'roleplay-completion', response, services) };
  }));
}

/** Used only at server-created insert time. Never bind/rebind a historical row. */
export function runtimeRecordingMetadata(metadata: unknown, binding: RecordingRuntimeBinding) {
  const parsed = metadataSchema.parse(metadata);
  if (parsed.runtimeBinding || parsed.lifecycle) throw new Error('Cannot rebind evidence');
  const result = metadataSchema.parse({ ...parsed, storage: 'r2', runtimeBinding: recordingRuntimeBindingSchema.parse(binding), lifecycle: 'active' });
  const kind = 'sceneId' in result ? 'roleplay-turn' : 'practiceKey' in result ? result.practiceKey === 'repeat-line' ? 'guided-repeat-line' : 'full-recall' : 'independent-output';
  if (binding.recordingKind !== kind) throw new Error('Runtime recording kind mismatch');
  return result;
}

export type RecordingRpcTransport = (name: string, args: { [key: string]: Json }) => Promise<unknown>;
const scopeArgs = (scope: RecordingScope) => ({ p_tenant_id: scope.tenantId, p_student_id: scope.studentId,
  p_activity_id: scope.activityId, p_version_id: scope.versionId, p_runtime_binding: scope.runtimeBinding });
export async function consumeSpeakingV2(rpc: RecordingRpcTransport, scope: RecordingScope, row: RecordingEvidenceRow,
  response: unknown, activity: { answerKey: unknown; publicConfig: unknown }, services: ProofServices) {
  const proof = await issueSpeakingCompletionProof(scope, row, response, activity, services);
  return rpc('record_smart_textbook_speaking_attempt_v2', { ...scopeArgs(scope), p_evidence_id: row.id, p_response: speakingResponseSchema.parse(response), p_proof: proof });
}
export async function completeRoleplayV2(rpc: RecordingRpcTransport, scope: RecordingScope, rows: RecordingEvidenceRow[],
  scene: { id: string; lines: readonly unknown[] }, roleSide: 'left' | 'right', services: ProofServices) {
  const proofs = await issueRoleplayCompletionProofs(scope, rows, scene, roleSide, services);
  return rpc('complete_smart_textbook_roleplay_v2', { ...scopeArgs(scope), p_scene_id: scene.id, p_role_side: roleSide, p_evidence_proofs: proofs });
}
const deleteClaimSchema = z.object({ evidenceId: z.string().uuid(), backend: z.enum(['r2', 'legacy-supabase']), objectKey: z.string(), state: z.literal('delete-pending') }).strict();
/** All explicit delete AND re-record cleanup must use this gateway at rollout.
 * Failure after claim deliberately leaves pending. Retry never reactivates it.
 * No external delete implementation is auto-wired in this offline phase. */
export async function deleteRecordingV2(rpc: RecordingRpcTransport, scope: RecordingScope, evidenceId: string,
  storage: { r2: (key: string) => Promise<void>; legacy: (key: string) => Promise<void> }) {
  const args = { ...scopeArgs(scope), p_evidence_id: evidenceId };
  const claim = deleteClaimSchema.parse(await rpc('claim_smart_textbook_recording_delete_v2', args));
  if (claim.evidenceId !== evidenceId) throw new Error('Delete claim mismatch');
  await (claim.backend === 'r2' ? storage.r2 : storage.legacy)(claim.objectKey);
  return rpc('finalize_smart_textbook_recording_delete_v2', args);
}
