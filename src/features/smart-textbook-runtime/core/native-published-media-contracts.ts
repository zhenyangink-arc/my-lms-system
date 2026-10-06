import { z } from 'zod';
import type { LessonManifestV1, RuntimeContextV1 } from '../../../lib/smart-textbook-runtime-v1/contracts.ts';
import type { TimelineCue } from '../../../lib/smart-textbook-runtime-v1/execution.ts';
import {
  completionRequestSchema, executionBinding, executionBindingSchema,
  sameBinding,
  type CompletionRequest, type NativeExecutionCommonServices,
} from './execution-contracts.ts';
import type { ActivityResult } from './services.ts';

const ref = z.string().min(1).max(200);
const nativeRefsSchema = z.strictObject({
  sessionRef: ref, actorRef: ref, tenantRef: ref, lessonRef: ref, snapshotRef: ref, scopeRef: ref,
  contentRef: ref, activityRef: ref, executionNodeRef: ref, sourceTeachingNodeRef: ref, versionRef: ref,
});
export const nativeSessionCompletionReceiptSchema = z.strictObject({
  contract: z.literal('activity-completion/4'), status: z.enum(['COMPLETED', 'INCOMPLETE']),
  attemptNumber: z.number().int().min(0).max(20), completedAt: z.iso.datetime({offset:true}).nullable(),
  provenance: z.strictObject({
    ...nativeRefsSchema.shape, kind: z.literal('native-published-session'), storage: z.literal('PINNED_PUBLISHED_DB'),
    source: z.literal('activity-domain'), publicationRevision: z.literal('publish-foundation/3'),
    activityRevision: ref, mediaRevision: ref, readStartedAt: z.iso.datetime(), asOf: z.iso.datetime(),
    observedAt: z.iso.datetime(), deadlineAt: z.iso.datetime(), revision: ref,
  }),
  evidence: z.strictObject({kind:z.literal('durable-attempt-sequence'), attemptSequence:z.number().int().min(0).max(20),
    stateDigest:z.string().regex(/^[a-f0-9]{64}$/), latestAttemptAt:z.iso.datetime({offset:true}).nullable(),
    progressUpdatedAt:z.iso.datetime({offset:true}).nullable()}),
}).superRefine((r,ctx)=>{
  if(r.attemptNumber!==r.evidence.attemptSequence || (r.status==='INCOMPLETE' && r.completedAt!==null)
    || (r.status==='COMPLETED' && (!r.attemptNumber || !r.completedAt || !r.evidence.latestAttemptAt || !r.evidence.progressUpdatedAt)))
    ctx.addIssue({code:'custom',message:'NATIVE_DURABLE_EVIDENCE'});
});
export type NativeSessionCompletionReceipt = z.infer<typeof nativeSessionCompletionReceiptSchema>;
export const nativePublishedCueBindingSchema = z.strictObject({
  execution: executionBindingSchema,
  activityRevision: ref,
  mediaRef: ref,
  completionPolicy: z.literal('correct-durable-readback/1'),
  native: nativeRefsSchema,
});
export type NativePublishedCueBinding = z.infer<typeof nativePublishedCueBindingSchema>;
export const nativePublishedReadRequestSchema = z.strictObject({
  ...completionRequestSchema.shape,
  requestId: z.uuid(),
  readId: z.uuid(),
  operation: z.enum(['restore', 'checkpoint', 'readback']),
});
export type NativePublishedReadRequest = z.infer<typeof nativePublishedReadRequestSchema>;
export const nativeMediaReadEnvelopeSchema = z.strictObject({
  contract: z.literal('native-media-read/1'),
  request: nativePublishedReadRequestSchema,
  authority: nativePublishedCueBindingSchema,
  acceptedAt: z.iso.datetime(),
  receipt: nativeSessionCompletionReceiptSchema,
  pending: z.boolean(),
});
export type NativeMediaReadEnvelope = z.infer<typeof nativeMediaReadEnvelopeSchema>;
export type NativePublishedExecutionServices = NativeExecutionCommonServices & {
  completionMode: 'native-published/4';
  nativeBindings: readonly NativePublishedCueBinding[];
  restore(request: NativePublishedReadRequest, signal: AbortSignal): Promise<unknown>;
  checkpoint(request: NativePublishedReadRequest, signal: AbortSignal): Promise<unknown>;
  submit(request: CompletionRequest, optionId: string, signal: AbortSignal): Promise<{ result: ActivityResult }>;
  readback(request: NativePublishedReadRequest, signal: AbortSignal): Promise<unknown>;
};

const authorityRefs = Object.keys(nativeRefsSchema.shape) as Array<keyof NativePublishedCueBinding['native']>;
const provenanceRefs = authorityRefs;
export function sameNativePublishedCueBinding(a: NativePublishedCueBinding, b: NativePublishedCueBinding) {
  return sameBinding(a.execution, b.execution)
    && a.activityRevision === b.activityRevision && a.mediaRef === b.mediaRef
    && a.completionPolicy === b.completionPolicy
    && authorityRefs.every(key => a.native[key] === b.native[key]);
}
function freezeBinding(binding: NativePublishedCueBinding): NativePublishedCueBinding {
  Object.freeze(binding.execution);
  Object.freeze(binding.native);
  return Object.freeze(binding);
}

/** Consistency with this mounted owner, not authentication or server authorization.
 * Opaque published identities must be supplied by a future trusted installer. */
export function freezeNativePublishedCueBindings(
  manifest: LessonManifestV1, context: RuntimeContextV1, cues: readonly TimelineCue[], raw: unknown,
): readonly NativePublishedCueBinding[] {
  if (manifest.execution?.contract !== 'native-execution/2' || context.sourceState !== 'published' || context.trackingDisabled !== false
    || context.snapshotId !== manifest.snapshot.id) throw Error('NATIVE_CONTEXT');
  const bindings = z.array(nativePublishedCueBindingSchema).parse(raw);
  if (bindings.length !== cues.length || new Set(bindings.map(b => b.execution.cueId)).size !== cues.length)
    throw Error('NATIVE_CUE_SET');
  const ordered = cues.map(cue => {
    const binding = bindings.find(b => b.execution.cueId === cue.id);
    const expected = executionBinding(manifest, context, cue);
    const activity = manifest.activityRefs.find(a => a.id === expected.activityRef);
    const video = manifest.blocks.find(b => b.id === cue.sourceBlockId);
    const nativeMedia = manifest.execution?.media.find(m => m.blockId === cue.sourceBlockId);
    const media = video?.type === 'video' ? manifest.mediaRefs.find(m => m.id === video.props.mediaRef) : null;
    if (!binding || !sameBinding(binding.execution, expected) || !activity
      || binding.activityRevision !== activity.revision || video?.type !== 'video'
      || binding.mediaRef !== video.props.mediaRef || nativeMedia?.revision !== cue.mediaRevision
      || media?.revision !== cue.mediaRevision || media.kind !== 'video' || media.readiness !== 'ready')
      throw Error('NATIVE_CUE_BINDING');
    return freezeBinding(binding);
  });
  return Object.freeze(ordered);
}

/** Public consistency checks; server session authorization remains mandatory. */
export function acceptNativeMediaRead(
  raw: unknown, request: NativePublishedReadRequest, authority: NativePublishedCueBinding,
  minSequence = 0, now = Date.now(),
): NativeMediaReadEnvelope {
  const envelope = nativeMediaReadEnvelopeSchema.parse(raw);
  const actual = envelope.request, receipt = envelope.receipt, provenance = receipt.provenance;
  if (!sameBinding(actual.binding, request.binding) || actual.requestId !== request.requestId
    || actual.generation !== request.generation || actual.readId !== request.readId
    || actual.operation !== request.operation || !sameNativePublishedCueBinding(envelope.authority, authority)
    || !provenanceRefs.every(key => provenance[key] === authority.native[key])
    || (envelope.pending && (request.operation !== 'restore' || receipt.status === 'COMPLETED'))
    || provenance.activityRevision !== authority.activityRevision
    || provenance.mediaRevision !== authority.execution.mediaRevision
    || receipt.evidence.attemptSequence < minSequence) throw Error('NATIVE_READ_BINDING');

  const admitted = Date.parse(envelope.acceptedAt), started = Date.parse(provenance.readStartedAt);
  const asOf = Date.parse(provenance.asOf), observed = Date.parse(provenance.observedAt);
  const deadline = Date.parse(provenance.deadlineAt);
  if (!Number.isFinite(now) || !(admitted <= started && started <= asOf && asOf === observed
    && asOf <= deadline && asOf <= now && now <= deadline
    && deadline - admitted <= 10_000 && now - asOf <= 30_000 && asOf - started <= 30_000)) throw Error('NATIVE_READ_FRESHNESS');
  if (receipt.status === 'COMPLETED') {
    const times = [receipt.completedAt, receipt.evidence.latestAttemptAt, receipt.evidence.progressUpdatedAt];
    if (receipt.attemptNumber <= 0 || times.some(time => time === null || Date.parse(time) > asOf))
      throw Error('NATIVE_READ_DURABLE_EVIDENCE');
  }

  freezeBinding(envelope.authority);
  Object.freeze(envelope.request.binding);
  Object.freeze(envelope.request);
  Object.freeze(receipt.provenance);
  Object.freeze(receipt.evidence);
  Object.freeze(receipt);
  return Object.freeze(envelope);
}
