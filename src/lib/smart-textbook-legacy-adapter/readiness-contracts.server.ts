import 'server-only';
import { z } from 'zod';
const id = z.string().min(1).max(200);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const index = z.number().int().nonnegative();
export const serviceIdentitySchema = z.strictObject({
  schemaVersion: z.literal('legacy-services/1'), sourceRevision: hash, versionId: id,
  pages: z.array(z.strictObject({activityId:id,nodeId:id,pageId:id,legacyPage:index,
    items:z.array(z.strictObject({partId:id,legacyItem:index,fingerprint:hash})).min(1).max(4)})),
  repeat:z.array(z.strictObject({activityId:id,nodeId:id,trackId:id,segmentId:id,legacyTrack:index,legacySegment:index,fingerprint:hash})),
});
export const serviceEvidenceSchema = z.strictObject({
  chapter:z.strictObject({id,version_id:id,chapter_test_id:id,chapter_tests:z.strictObject({id,slug:z.literal('korean-level-one-01')})}),
  speech:z.array(z.strictObject({id,script_node_id:id,locale:z.enum(['zh-CN','ko-KR']),segment_index:index,content_hash:hash,
    duration_ms:z.number().positive(),production_status:z.literal('ready'),
    cue_timeline:z.array(z.strictObject({text:z.string(),startMs:z.number().nonnegative(),endMs:z.number().nonnegative(),charStart:index,charEnd:index})).min(1)})),
});
export type ServiceIdentityMap = z.infer<typeof serviceIdentitySchema>;
export type ServiceEvidence = z.infer<typeof serviceEvidenceSchema>;
export type LegacySpeechBinding = {
  assetId:string; scriptVersionId:string; nodeId:string; locale:'zh-CN'|'ko-KR'; segment:number;
  contentHash:string; timelineHash:string; durationMs:number; selectedByCurrentScript:boolean;
  authorization:'active-user-published-or-platform-owner';
};
export type ReadinessBindings = {
  schemaVersion:'legacy-readiness/1'; sourceRevision:string; historicalSourceRevision:string; versionId:string;
  listeningAliases:Array<{alias:string;activityId:string;legacyPage:number;trackId:string;mediaRef:string;revision:string}>;
  activityPages:ServiceIdentityMap['pages']; guidedRepeat:ServiceIdentityMap['repeat'];
  navigation:Array<{kind:'chapter-test';chapterId:string;testId:string;slug:'korean-level-one-01';legacyKey:'chapter-test:korean-level-one-01';requires:'server-chapter-completed'}>;
  playback:Array<{target:string;mediaRef:string|null;revision:string;source:'authorized-listening'|'browser-tts';allowedCommand:'play'|'reveal';acceptedEvent:'media-ended'|'none';evidence:'playback-observation-only'|'unavailable'}>;
  speech:LegacySpeechBinding[];
  speechRejected:Array<{assetId:string;nodeId:string;segment:number;reason:'text-hash-or-timeline-mismatch'}>;
};
