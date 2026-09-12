import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { digest } from './identity.server.ts';
import { ttsBindingSchema, utteranceHash, type TtsObservationBinding } from './final-proof.server.ts';

/** Supplied by the trusted server auth/session service, never parsed from browser JSON. */
export interface TtsSessionAuthority {
  actorId:string;tenantId:string;sessionId:string;active:boolean;sourceRevision:string;snapshotId:string;
  teachingRevision:string;stepId:string;cueId:string;target:string;textHash:string;locale:'ko-KR';
  utteranceId:string;generation:number;phase:'waiting-playback'|'other';
}
export interface TrustedTtsCaller {actorId:string;tenantId:string}
export interface TtsGrant {
  grantId:string;nonce:string;actorId:string;tenantId:string;runtimeSession:string;snapshotId:string;
  sourceRevision:string;teachingRevision:string;target:string;expectedTextHash:string;locale:'ko-KR';
  utteranceId:string;cueId:string;stepId:string;generation:number;issuedAt:number;expiresAt:number;
}
const issueRequest=z.strictObject({sessionId:z.string().min(1)});
const observationRequest=z.strictObject({grantId:z.string().uuid(),eventId:z.string().uuid().optional()});
type Row={grant:TtsGrant;bindingDigest:string;state:'issued'|'consumed'|'revoked'};

/** Server-issued opaque grants: browser can report only grantId (+ diagnostic eventId).
 * This isolated, single-process store is NOT wired to any production route. No global
 * singleton or database writes. A production port must preserve atomic issue/revoke/consume
 * and server-session authorization across replicas before it can be deployed. */
export function createTtsObservationGrantService(options:{
  binding:TtsObservationBinding;
  authorizeSession:(caller:TrustedTtsCaller,sessionId:string)=>Promise<TtsSessionAuthority>;
  now?:()=>number;ttlMs?:number;capacity?:number;
}) {
  const binding=ttsBindingSchema.parse(structuredClone(options.binding));
  if(utteranceHash(binding.text)!==binding.textHash)throw Error('Binding utterance hash mismatch');
  const now=options.now??Date.now,ttl=options.ttlMs??60000,capacity=options.capacity??1000;
  if(!Number.isSafeInteger(ttl)||ttl<1||ttl>300000||!Number.isSafeInteger(capacity)||capacity<1)throw Error('Invalid grant limits');
  const rows=new Map<string,Row>(),logicalGrants=new Map<string,string>();
  const revokedEpochs=new Map<string,number>();
  const sessionKey=(caller:TrustedTtsCaller,sessionId:string)=>digest([caller.tenantId,caller.actorId,sessionId]);
  const assertAuthority=(a:TtsSessionAuthority,caller:TrustedTtsCaller,sessionId:string)=>{
    if(!caller.actorId||!caller.tenantId||!a.active||a.actorId!==caller.actorId||a.tenantId!==caller.tenantId||a.sessionId!==sessionId||a.phase!=='waiting-playback'||
      a.sourceRevision!==binding.sourceRevision||a.snapshotId!==binding.snapshotId||a.teachingRevision!==binding.teachingRevision||a.stepId!==binding.stepId||a.cueId!==binding.cueId||a.target!==binding.target||a.textHash!==binding.textHash||a.locale!==binding.locale||a.utteranceId!==binding.utteranceId||!Number.isSafeInteger(a.generation)||a.generation<0)
      throw Error('Unauthorized or stale TTS session/target/text/cue');
  };
  const timestamp=()=>{const value=now();if(!Number.isSafeInteger(value)||value<0)throw Error('Invalid server clock');return value;};
  return {
    async issue(caller:TrustedTtsCaller,input:unknown){
      const request=issueRequest.parse(input),key=sessionKey(caller,request.sessionId),epoch=revokedEpochs.get(key)??0;
      const a=await options.authorizeSession(caller,request.sessionId);assertAuthority(a,caller,request.sessionId);
      if((revokedEpochs.get(key)??0)!==epoch)throw Error('Session revoked during grant authorization');
      const issuedAt=timestamp();
      const logical=digest([a.tenantId,a.actorId,a.sessionId,a.snapshotId,a.sourceRevision,a.teachingRevision,a.cueId,a.target,a.utteranceId,a.generation]);
      const existing=rows.get(logicalGrants.get(logical)??'');
      if(existing){if(existing.state!=='issued'||issuedAt>=existing.grant.expiresAt)throw Error('Logical playback grant already consumed/revoked/expired');return {grantId:existing.grant.grantId,text:binding.text,locale:binding.locale,expiresAt:existing.grant.expiresAt};}
      if(rows.size>=capacity)throw Error('Grant capacity reached; rotate isolated server session service explicitly');
      const grant:TtsGrant={grantId:randomUUID(),nonce:randomUUID(),actorId:a.actorId,tenantId:a.tenantId,runtimeSession:a.sessionId,snapshotId:a.snapshotId,sourceRevision:a.sourceRevision,teachingRevision:a.teachingRevision,target:a.target,expectedTextHash:a.textHash,locale:a.locale,utteranceId:a.utteranceId,cueId:a.cueId,stepId:a.stepId,generation:a.generation,issuedAt,expiresAt:issuedAt+ttl};
      rows.set(grant.grantId,{grant,bindingDigest:digest(binding),state:'issued'});logicalGrants.set(logical,grant.grantId);
      return {grantId:grant.grantId,text:binding.text,locale:binding.locale,expiresAt:grant.expiresAt};
    },
    async observe(caller:TrustedTtsCaller,input:unknown){
      const request=observationRequest.parse(input),row=rows.get(request.grantId);
      if(!row)throw Error('Unissued TTS grant');const g=row.grant;
      if(g.actorId!==caller.actorId||g.tenantId!==caller.tenantId)throw Error('Grant owner mismatch');
      const a=await options.authorizeSession(caller,g.runtimeSession);assertAuthority(a,caller,g.runtimeSession);
      if(row.state==='revoked'||timestamp()>=g.expiresAt||a.generation!==g.generation||row.bindingDigest!==digest(binding))throw Error('Expired/revoked/stale grant');
      const duplicate=row.state==='consumed';row.state='consumed'; // synchronous atomic boundary within this isolated process
      return {playbackObserved:true as const,observation:'authorized-browser-tts-ended-report' as const,duplicate,
        formalCompletion:false as const,progressDelta:null,score:null,agentAdvance:false as const,
        teachingPlaybackWaitSatisfied:!duplicate,teachingEffect:duplicate?'none' as const:'eligible-for-task-feedback' as const};
    },
    /** Trusted cancellation command. Never exposed as an unauthenticated client endpoint. */
    revokeSession(caller:TrustedTtsCaller,sessionId:string){
      const key=sessionKey(caller,sessionId);revokedEpochs.set(key,(revokedEpochs.get(key)??0)+1);
      for(const row of rows.values())if(row.grant.runtimeSession===sessionId&&row.grant.actorId===caller.actorId&&row.grant.tenantId===caller.tenantId)row.state='revoked';
    },
    // No export of raw grants or writable store. Neither nonce nor server identity is browser-owned.
  };
}
