import 'server-only';
import { z } from 'zod';
import { digest, canonical } from '../smart-textbook-legacy-adapter/identity.server';
import { legacySourceSchema, type LegacyChapterOneSource } from '../smart-textbook-legacy-adapter/source.server';
import { serviceEvidenceSchema, serviceIdentitySchema } from '../smart-textbook-legacy-adapter/readiness-contracts.server';
import { profile } from '../smart-textbook-legacy-adapter/profile.server';
import { validatePrivateBindings } from '../smart-textbook-legacy-adapter/bindings.server';
import { validateLessonManifestV1 } from '../smart-textbook-runtime-v1/validator';
import type { finalizeChapterOneNonUiReadiness } from '../smart-textbook-legacy-adapter/final-readiness.server';
import identities from './assets/v1/chapter-one-identities.server';
import history from './assets/v1/chapter-one-service-identities.server';
import { verifyMediaPublicationPolicy } from './media-policy.server';
import { dependencyCaptureSchema, type DependencyCapture } from './capture.server';

export const foundationRevision = 'publish-foundation/1';
export const identityAsset = { revision: identities.revision, digest: digest(identities), serviceRevision: history.schemaVersion, serviceDigest: digest(history) };
export const targetSemanticRevision = 'chapter-one-target-semantics/4a12';
export const scopeSchema = z.strictObject({ textbookId: z.string().uuid(), versionId: z.string().uuid(), chapterId: z.string().uuid() });
export type PublicationScope = z.infer<typeof scopeSchema>;
type Compiled = ReturnType<typeof finalizeChapterOneNonUiReadiness>;
export type SnapshotResult = Compiled & { manifest: NonNullable<Compiled['manifest']>; services: NonNullable<Compiled['services']> };
export type SnapshotPrivate = { source: LegacyChapterOneSource; evidence: z.infer<typeof serviceEvidenceSchema>; result: SnapshotResult; dependencies?:DependencyCapture };
export type PublicationBundle = {
  revision: typeof foundationRevision; snapshotId: string; scope: PublicationScope;
  schemaVersion: string; runtimeContract: string; manifestDigest: string; sourceRevision: string; compilerVersion: string;
  manifest: SnapshotResult['manifest']; privatePayload: SnapshotPrivate; privateDigest: string;
  pins: ReturnType<typeof dependencyPins>; seal: string;
};

/** Same set ordering as the certified compiler. No allocation or compilation. */
export function normalizedSource(input: unknown) {
  const s = legacySourceSchema.parse(input);
  for (const key of ['modules','nodes','activities','media','lessons','teachingVersions','teachingNodes','speech'] as const) s[key].sort((a,b)=>a.id.localeCompare(b.id));
  s.tracks.sort((a,b)=>a.activity_id.localeCompare(b.activity_id)||a.page_index-b.page_index);
  return s;
}
export function dependencyPins(p: SnapshotPrivate) {
  const s = normalizedSource(p.source), m = p.result.manifest;
  return { identityAsset, targetSemanticRevision, targetDigest: digest(m.runtimeTargets),
    ...(p.dependencies?{dependencyCaptureDigest:digest(dependencyCaptureSchema.parse(p.dependencies))}:{}),
    source: Object.fromEntries(Object.entries(s).map(([key,value])=>[key,digest(value)])),
    serviceEvidenceDigest: digest(p.evidence), mediaRefsDigest: digest(m.mediaRefs),
    teachingRevisions: s.teachingVersions.map(v=>({id:v.id,number:v.version_number})),
    sourceRevision: digest({source:s,profile,identityMap:identities}) };
}

/** Server compiler output envelope; not a second Manifest or authoring schema.
 * Full private capture is never serialized by a browser transport. */
export function packageSnapshot(source: unknown, evidence: unknown, result: Compiled, dependencies?:DependencyCapture): PublicationBundle {
  if (!result.manifest || !result.services || !result.nonUiRuntimeReady) throw Error('PUBLICATION_COMPILE_BLOCKED');
  const privatePayload = JSON.parse(JSON.stringify({source:normalizedSource(source),evidence:serviceEvidenceSchema.parse(evidence),result,...(dependencies?{dependencies:dependencyCaptureSchema.parse(dependencies)}:{})})) as SnapshotPrivate;
  const m = privatePayload.result.manifest;
  const body = { revision:foundationRevision, snapshotId:m.snapshot.id,
    scope:{textbookId:m.textbook.id,versionId:m.version.id,chapterId:m.chapter.id},
    schemaVersion:m.schemaVersion,runtimeContract:m.runtimeContract,manifestDigest:m.snapshot.contentDigest,
    sourceRevision:result.report.sourceRevision,compilerVersion:m.snapshot.compilerVersion,
    manifest:m,privatePayload,privateDigest:digest(privatePayload),pins:dependencyPins(privatePayload) };
  return validateSnapshotBundle({...body,seal:digest(body)});
}

/** No compiler import/call in the Loader validation path. Errors fail closed. */
export function validateSnapshotBundle(input: unknown): PublicationBundle {
  const envelope = z.strictObject({revision:z.literal(foundationRevision),snapshotId:z.string().min(1),scope:scopeSchema,
    schemaVersion:z.literal('1.0.0'),runtimeContract:z.literal('uply-runtime/1'),manifestDigest:z.string().regex(/^sha256:[a-f0-9]{64}$/),
    sourceRevision:z.string().regex(/^[a-f0-9]{64}$/),compilerVersion:z.string().min(1),manifest:z.unknown(),privatePayload:z.unknown(),
    privateDigest:z.string().regex(/^[a-f0-9]{64}$/),pins:z.unknown(),seal:z.string().regex(/^[a-f0-9]{64}$/)}).parse(input);
  const {seal,...body}=envelope;
  if(digest(body)!==seal)throw Error('PUBLICATION_SEAL_MISMATCH');
  const validation=validateLessonManifestV1(envelope.manifest);
  if(!validation.success)throw Error('PUBLICATION_MANIFEST_INVALID');
  const m=validation.data, {snapshot:_,...semantic}=m;
  if(m.snapshot.scope!=='chapter'||m.snapshot.id!==envelope.snapshotId||m.snapshot.contentDigest!==envelope.manifestDigest||
    `sha256:${digest(semantic)}`!==envelope.manifestDigest||m.snapshot.compilerVersion!==envelope.compilerVersion||
    canonical(envelope.scope)!==canonical({textbookId:m.textbook.id,versionId:m.version.id,chapterId:m.chapter.id}))throw Error('PUBLICATION_MANIFEST_ASSOCIATION');
  if(digest(envelope.privatePayload)!==envelope.privateDigest)throw Error('PUBLICATION_PRIVATE_DIGEST');
  // This private output is accepted only under its immutable, server-written
  // seal and the existing full semantic validator (which also rejects malformed shapes).
  const p=envelope.privatePayload as SnapshotPrivate;
  const source=normalizedSource(p.source), evidence=serviceEvidenceSchema.parse(p.evidence), r=p.result;
  verifyMediaPublicationPolicy(source,r);
  if(!r.nonUiRuntimeReady||!r.tts||!r.speech||r.report.sourceRevision!==envelope.sourceRevision||
    canonical(r.manifest)!==canonical(m))throw Error('PUBLICATION_PRIVATE_ASSOCIATION');
  const pins=dependencyPins(p);
  if(canonical(pins)!==canonical(envelope.pins)||pins.sourceRevision!==envelope.sourceRevision)throw Error('PUBLICATION_DEPENDENCY_PIN');
  const errors=validatePrivateBindings(m,r.bindings,{services:r.services,source,history:serviceIdentitySchema.parse(history),evidence,sourceRevision:envelope.sourceRevision,finalProof:{tts:r.tts,speech:r.speech}});
  if(errors.length)throw Error('PUBLICATION_BINDINGS_INVALID');
  return envelope as PublicationBundle;
}

/** Publication requires the reviewed media policy plus the existing complete
 * binding validation. Unannotated legacy candidates still fail admission; only
 * the formal compiler can attach the per-resource, privately verified evidence. */
export function assertPublishableSnapshot(input:unknown):PublicationBundle {
  const b=validateSnapshotBundle(input),bindings=b.privatePayload.result.bindings;
  const validation=validateLessonManifestV1(b.manifest,{published:true,resolveBinding:(kind,ref,owner)=>{
    if(kind==='teaching-cue')return bindings.teaching.some(t=>t.ref===owner&&t.entryCueId===ref);
    if(kind==='capsule')return bindings.capsules.some(c=>c.id===ref&&b.manifest.blocks.some(block=>(block.id===owner||(block.type==='compat.teacher.v1'&&block.props.teachingRef===owner))&&block.stepId===c.stepId));
    return false; // No native listening playback-policy block in this chapter.
  }});
  if(!validation.success)throw Error('PUBLICATION_ADMISSION: '+validation.issues.map(i=>`${i.path}: ${i.message}`).join('; '));
  return b;
}

/** Copy-on-write proposal: detached source only; never updates stored artifacts. */
export function draftFromSnapshot(bundle: PublicationBundle) {
  const b=validateSnapshotBundle(bundle);
  return {kind:'authoring-draft' as const,basedOn:b.snapshotId,source:structuredClone(b.privatePayload.source)};
}
