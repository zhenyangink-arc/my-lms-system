import { z } from 'zod';
import type { LessonManifestV1, RuntimeContextV1 } from '../../../lib/smart-textbook-runtime-v1/contracts.ts';
import type { TimelineCue } from '../../../lib/smart-textbook-runtime-v1/execution.ts';
import {
  completionRequestSchema, executionBinding, executionBindingSchema,
  publishedCompletionReceiptSchema, sameBinding,
  type CompletionRequest, type NativeExecutionCommonServices,
} from './execution-contracts.ts';
import type { ActivityResult } from './services.ts';

const ref = z.string().min(1).max(200);
const publishedRefsSchema = z.strictObject({
  subjectRef: ref, tenantRef: ref, lessonRef: ref, snapshotRef: ref, scopeRef: ref,
  contentRef: ref, activityRef: ref, executionNodeRef: ref, sourceTeachingNodeRef: ref, versionRef: ref,
});
export const publishedCueBindingSchema = z.strictObject({
  execution: executionBindingSchema,
  activityRevision: ref,
  mediaRef: ref,
  completionPolicy: z.literal('correct-durable-readback/1'),
  published: publishedRefsSchema,
});
export type PublishedCueBinding = z.infer<typeof publishedCueBindingSchema>;
export const publishedReadRequestSchema = z.strictObject({
  ...completionRequestSchema.shape,
  readId: z.uuid(),
  operation: z.enum(['restore', 'checkpoint', 'readback']),
});
export type PublishedReadRequest = z.infer<typeof publishedReadRequestSchema>;
export const publishedMediaReadEnvelopeSchema = z.strictObject({
  contract: z.literal('published-media-read/1'),
  request: publishedReadRequestSchema,
  authority: publishedCueBindingSchema,
  acceptedAt: z.iso.datetime(),
  receipt: publishedCompletionReceiptSchema,
  pending: z.boolean(),
});
export type PublishedMediaReadEnvelope = z.infer<typeof publishedMediaReadEnvelopeSchema>;
export type PublishedNativeExecutionServices = NativeExecutionCommonServices & {
  completionMode: 'published/3';
  publishedBindings: readonly PublishedCueBinding[];
  restore(request: PublishedReadRequest, signal: AbortSignal): Promise<unknown>;
  checkpoint(request: PublishedReadRequest, signal: AbortSignal): Promise<unknown>;
  submit(request: CompletionRequest, optionId: string, signal: AbortSignal): Promise<{ result: ActivityResult }>;
  readback(request: PublishedReadRequest, signal: AbortSignal): Promise<unknown>;
};

const authorityRefs = Object.keys(publishedRefsSchema.shape) as Array<keyof PublishedCueBinding['published']>;
const provenanceRefs = [
  'snapshotRef', 'scopeRef', 'contentRef', 'activityRef',
  'executionNodeRef', 'sourceTeachingNodeRef', 'versionRef',
] as const;
export function samePublishedCueBinding(a: PublishedCueBinding, b: PublishedCueBinding) {
  return sameBinding(a.execution, b.execution)
    && a.activityRevision === b.activityRevision && a.mediaRef === b.mediaRef
    && a.completionPolicy === b.completionPolicy
    && authorityRefs.every(key => a.published[key] === b.published[key]);
}
function freezeBinding(binding: PublishedCueBinding): PublishedCueBinding {
  Object.freeze(binding.execution);
  Object.freeze(binding.published);
  return Object.freeze(binding);
}

/** Consistency with this mounted owner, not authentication or server authorization.
 * Opaque published identities must be supplied by a future trusted installer. */
export function freezePublishedCueBindings(
  manifest: LessonManifestV1, context: RuntimeContextV1, cues: readonly TimelineCue[], raw: unknown,
): readonly PublishedCueBinding[] {
  if (context.sourceState !== 'published' || context.trackingDisabled !== false
    || context.snapshotId !== manifest.snapshot.id) throw Error('PUBLISHED_CONTEXT');
  const bindings = z.array(publishedCueBindingSchema).parse(raw);
  if (bindings.length !== cues.length || new Set(bindings.map(b => b.execution.cueId)).size !== cues.length)
    throw Error('PUBLISHED_CUE_SET');
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
      throw Error('PUBLISHED_CUE_BINDING');
    return freezeBinding(binding);
  });
  return Object.freeze(ordered);
}

/** Strict transport validation preserves /3 verbatim. It cannot establish that
 * JSON was produced by a genuine Tool read or certify tenant/subject access. */
export function acceptPublishedMediaRead(
  raw: unknown, request: PublishedReadRequest, authority: PublishedCueBinding,
  minSequence = 0, now = Date.now(),
): PublishedMediaReadEnvelope {
  const envelope = publishedMediaReadEnvelopeSchema.parse(raw);
  const actual = envelope.request, receipt = envelope.receipt, provenance = receipt.provenance;
  if (!sameBinding(actual.binding, request.binding) || actual.requestId !== request.requestId
    || actual.generation !== request.generation || actual.readId !== request.readId
    || actual.operation !== request.operation || !samePublishedCueBinding(envelope.authority, authority)
    || !provenanceRefs.every(key => provenance[key] === authority.published[key])
    || (envelope.pending && (request.operation !== 'restore' || receipt.status === 'COMPLETED'))
    || receipt.evidence.attemptSequence < minSequence) throw Error('PUBLISHED_READ_BINDING');

  const admitted = Date.parse(envelope.acceptedAt), started = Date.parse(provenance.readStartedAt);
  const asOf = Date.parse(provenance.asOf), observed = Date.parse(provenance.observedAt);
  const deadline = Date.parse(provenance.deadlineAt);
  if (!Number.isFinite(now) || !(admitted <= started && started <= asOf && asOf === observed
    && asOf <= deadline && asOf <= now && now <= deadline
    && now - asOf <= 30_000 && asOf - started <= 30_000)) throw Error('PUBLISHED_READ_FRESHNESS');
  if (receipt.status === 'COMPLETED') {
    const times = [receipt.completedAt, receipt.evidence.latestAttemptAt, receipt.evidence.progressUpdatedAt];
    if (receipt.attemptNumber <= 0 || times.some(time => time === null || Date.parse(time) > asOf))
      throw Error('PUBLISHED_READ_DURABLE_EVIDENCE');
  }

  freezeBinding(envelope.authority);
  Object.freeze(envelope.request.binding);
  Object.freeze(envelope.request);
  Object.freeze(receipt.provenance);
  Object.freeze(receipt.evidence);
  Object.freeze(receipt);
  return Object.freeze(envelope);
}
