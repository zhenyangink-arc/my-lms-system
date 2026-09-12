import 'server-only';
import { z } from 'zod';
import { digest } from './identity.server.ts';
import type { ReadinessBindings } from './readiness-contracts.server.ts';

/** Trusted server context, NOT request JSON. Existing auth/RLS must establish this. */
export interface ServiceScope { sourceRevision:string; versionId:string; actorId:string; tenantId:string; authorized:boolean }
export function assertServiceScope(b:ReadinessBindings,scope:ServiceScope) {
  if(!scope.authorized||!scope.actorId||!scope.tenantId||scope.sourceRevision!==b.sourceRevision||scope.versionId!==b.versionId)
    throw new Error('Unauthorized or revision mismatch');
}
export function resolveListeningAlias(b:ReadinessBindings,scope:ServiceScope,alias:string) {
  assertServiceScope(b,scope);
  const rows=b.listeningAliases.filter(x=>x.alias===alias);
  if(rows.length!==1)throw new Error('Unknown/ambiguous listening alias');
  const row=rows[0];
  return {activityId:row.activityId,page:row.legacyPage,trackId:row.trackId,mediaRef:row.mediaRef};
}
const pageRowSchema=z.strictObject({activityId:z.string(),versionId:z.string(),pageIndex:z.number().int().nonnegative(),
  itemIndices:z.array(z.number().int().nonnegative()).min(1).max(4),response:z.array(z.union([z.number().int().nonnegative(),z.string()])),
  results:z.array(z.boolean()),answers:z.array(z.union([z.number().int().nonnegative(),z.string()]))});
export type LegacyPageRow=z.infer<typeof pageRowSchema>;
export type PageProjection={pageId:string;activityId:string;items:Array<{partId:string;response:number|string;result:boolean;answer:number|string}>};
/** User-state only, never returned as a Manifest. Authorization belongs to the caller's loader. */
export function projectActivityPage(b:ReadinessBindings,scope:ServiceScope,input:unknown):PageProjection {
  assertServiceScope(b,scope);const row=pageRowSchema.parse(input);
  const page=b.activityPages.find(p=>p.activityId===row.activityId&&p.legacyPage===row.pageIndex);
  if(!page||row.versionId!==b.versionId||row.itemIndices.length!==page.items.length||new Set(row.itemIndices).size!==row.itemIndices.length||
    [row.response,row.results,row.answers].some(x=>x.length!==row.itemIndices.length))throw new Error('Unknown page/item or revision mismatch');
  return {pageId:page.pageId,activityId:page.activityId,items:row.itemIndices.map((index,i)=>{
    const item=page.items.find(x=>x.legacyItem===index);if(!item)throw new Error('Unknown page item');
    return {partId:item.partId,response:row.response[i],result:row.results[i],answer:row.answers[i]};
  })};
}
/** Produces existing Action arguments only: does not grade, persist, or claim completion. */
export function activityPageServiceInput(b:ReadinessBindings,scope:ServiceScope,pageId:string,responses:Array<{partId:string;response:number|string}>) {
  assertServiceScope(b,scope);const page=b.activityPages.find(p=>p.pageId===pageId);
  if(!page||responses.length!==page.items.length||new Set(responses.map(x=>x.partId)).size!==responses.length)throw new Error('Unknown page/part');
  const items=[...page.items].sort((a,c)=>a.legacyItem-c.legacyItem);
  const response=items.map(i=>{const r=responses.find(r=>r.partId===i.partId);if(!r)throw new Error('Unknown progress part');return r.response;});
  return {activityId:page.activityId,pageIndex:page.legacyPage,itemIndices:items.map(i=>i.legacyItem),response};
}
/** Observed page checks only; formal completion still requires existing submit/grader/attempt. */
export function projectPageChecks(pages:PageProjection[]) {
  return {checkedPages:pages.length,allObservedCorrect:pages.length>0&&pages.every(p=>p.items.every(i=>i.result)),
    formalCompletion:'existing-attempt-service' as const};
}
/** Full response vector stays in historical secret/grader order even when display reorders.
 * This is a submission proposal, not a score or a completed attempt. */
export function activitySubmissionInput(b:ReadinessBindings,scope:ServiceScope,activityId:string,responses:Array<{partId:string;response:number|string}>,locale:'zh-CN'|'ko-KR') {
  assertServiceScope(b,scope);
  const items=b.activityPages.filter(p=>p.activityId===activityId).flatMap(p=>p.items).sort((a,c)=>a.legacyItem-c.legacyItem);
  if(!items.length||responses.length!==items.length||new Set(responses.map(r=>r.partId)).size!==items.length)throw new Error('Activity response coverage mismatch');
  const response=items.map((item,index)=>{if(item.legacyItem!==index)throw new Error('Noncontiguous historical grader slots');const value=responses.find(r=>r.partId===item.partId);if(!value)throw new Error('Unknown activity response part');return value.response;});
  return {activityId,response,locale};
}
/** Mirrors current checkGrammarPage eligibility; callers still call the existing grader.
 * `revealed` is user UI state, never proof of correctness or formal completion. */
export function legacyPageSubmitEligibility(input:{isListening:boolean;isLastGrammarActivity:boolean;isLastPage:boolean;activityCompleted:boolean;currentResults:boolean[];checks:Array<{results:boolean[];revealed:boolean}|null>}) {
  const allListeningPages=input.isListening&&input.checks.length>0&&input.checks.every(c=>c!==null&&(c.revealed||c.results.length>0&&c.results.every(Boolean)));
  const lastCorrect=(input.isListening||input.isLastGrammarActivity)&&input.isLastPage&&input.currentResults.length>0&&input.currentResults.every(Boolean);
  return {maySubmit:!input.activityCompleted&&(allListeningPages||lastCorrect),formalCompletion:false as const};
}
export function projectGuidedRepeat(b:ReadinessBindings,scope:ServiceScope,rows:Array<{activityId:string;practiceKey:string;trackIndex:number;segmentIndex:number}>) {
  assertServiceScope(b,scope);const ids=new Set<string>();
  for(const row of rows){if(row.practiceKey!=='repeat-line')throw new Error('Unknown repeat practice');
    const r=b.guidedRepeat.find(x=>x.activityId===row.activityId&&x.legacyTrack===row.trackIndex&&x.legacySegment===row.segmentIndex);
    if(!r)throw new Error('Unknown repeat segment');ids.add(r.segmentId);}
  return [...ids].sort();
}
export function guidedRepeatServiceInput(b:ReadinessBindings,scope:ServiceScope,trackId:string,segmentId:string) {
  assertServiceScope(b,scope);const rows=b.guidedRepeat.filter(r=>r.trackId===trackId&&r.segmentId===segmentId);
  if(rows.length!==1)throw new Error('Unknown repeat segment');const r=rows[0];
  return {activityId:r.activityId,practiceKey:'repeat-line' as const,trackIndex:r.legacyTrack,segmentIndex:r.legacySegment};
}
export function resolveChapterDestination(b:ReadinessBindings,scope:ServiceScope,key:string,serverChapterCompleted:boolean) {
  assertServiceScope(b,scope);const rows=b.navigation.filter(n=>n.legacyKey===key);
  if(rows.length!==1||!serverChapterCompleted)throw new Error('Unknown/locked internal destination');
  const n=rows[0];return {kind:n.kind,testId:n.testId,slug:n.slug}; // deliberately no arbitrary href
}
export function resolveLegacySpeech(b:ReadinessBindings,scope:ServiceScope,request:{scriptVersionId:string;nodeId:string;locale:string;segment:number}) {
  assertServiceScope(b,scope);const rows=b.speech.filter(s=>s.scriptVersionId===request.scriptVersionId&&s.nodeId===request.nodeId&&s.locale===request.locale&&s.segment===request.segment);
  if(rows.length!==1)throw new Error('Speech node/segment/revision mismatch');
  // Existing speech Route still rechecks active user + published revision / owner.
  return {assetId:rows[0].assetId,contentHash:rows[0].contentHash,durationMs:rows[0].durationMs};
}

const endedSchema=z.strictObject({eventId:z.string().uuid(),sessionId:z.string(),snapshotId:z.string(),generation:z.number().int().nonnegative(),target:z.string(),mediaRef:z.string(),eventType:z.literal('media-ended')});
export interface PlaybackGrant extends ServiceScope {sessionId:string;snapshotId:string;generation:number;target:string;mediaRef:string;expiresAt:number}
/** Implementations MUST atomically persist key+payloadHash in the server's session scope.
 * Same key/hash => duplicate; same key/different hash => reject. No production store is wired. */
export interface ObservationStore {consumeOnce(key:string,payloadHash:string):Promise<'new'|'duplicate'>}
export function resolvePlaybackTarget(b:ReadinessBindings,scope:ServiceScope,target:string) {
  assertServiceScope(b,scope);const rows=b.playback.filter(p=>p.target===target);
  if(rows.length!==1||rows[0].allowedCommand!=='play'||!rows[0].mediaRef)throw new Error('Target has no authorized media/play capability');
  return rows[0];
}
export async function observePlayback(b:ReadinessBindings,grant:PlaybackGrant,input:unknown,store:ObservationStore,now:number) {
  const event=endedSchema.parse(input),target=resolvePlaybackTarget(b,grant,event.target);
  if(!Number.isFinite(now)||now>grant.expiresAt||event.sessionId!==grant.sessionId||event.snapshotId!==grant.snapshotId||event.generation!==grant.generation||
    event.target!==grant.target||event.mediaRef!==grant.mediaRef||target.mediaRef!==event.mediaRef)throw new Error('Playback evidence scope/media mismatch');
  // Logical operation, not browser eventId: replay with a new event ID remains a duplicate.
  const key=digest([grant.tenantId,grant.actorId,grant.sessionId,grant.snapshotId,grant.sourceRevision,grant.generation,event.target,event.mediaRef]);
  const state=await store.consumeOnce(key,digest({key,eventType:event.eventType}));
  return {accepted:true,duplicate:state==='duplicate',kind:'playback-observation' as const,formalCompletion:false as const,progressDelta:null,agentAdvance:false as const};
}
