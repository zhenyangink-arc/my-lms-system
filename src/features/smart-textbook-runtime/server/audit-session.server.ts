import 'server-only';
import { randomUUID } from 'node:crypto';
import type { PreviewState } from '../../../lib/learning-agent-preview-state';
import type { AuditSource } from './audit-source.server';
import type { TeacherTurn } from '../core/teacher';
import type { createTtsObservationGrantService } from '../../../lib/smart-textbook-legacy-adapter/tts-observation-grant.server';
import type { PageCheck } from '../core/activity-pages';

export type AuditSession={ownerId:string;authorityTenantId?:string;expiresAt:number;data:AuditSource;generation:number;revokedThrough:number;state:PreviewState;busy:boolean;lastTurn?:TeacherTurn;tts?:ReturnType<typeof createTtsObservationGrantService>;pageChecks?:Map<string,PageCheck>;recordingScope?:{id:string;expiresAt:number}};
type Session=AuditSession & {learningLocale:'zh-CN'|'ko-KR'};
const sessions=new Map<string,Session>();
/** Bounded single-process OWNER AUDIT store. Not production persistence or a new Agent engine.
 * Missing replica/session fails closed; never reconstruct from client-authored state. */
export function createAuditSession(ownerId:string,data:AuditSource,learningLocale:'zh-CN'|'ko-KR'='zh-CN'){
  if(learningLocale!=='zh-CN'&&learningLocale!=='ko-KR')throw Error('INVALID_LEARNING_LOCALE');
  for(const [id,s] of sessions)if(s.expiresAt<=Date.now())sessions.delete(id);
  if(sessions.size>=32)throw Error('审计会话已满，请稍后重试。');
  const id=randomUUID();
  sessions.set(id,{ownerId,learningLocale,expiresAt:Date.now()+30*60*1000,data,generation:-1,revokedThrough:-1,busy:false,
    state:{scriptVersionId:data.source.teachingVersions[0].id,currentNodeKey:null,teachingState:{},completedTaskEvents:[]}});
  return id;
}
export function auditSession(ownerId:string,id:string){const s=sessions.get(id);if(!s||s.ownerId!==ownerId||s.expiresAt<=Date.now())throw Error('审计会话无效或过期，请重新打开预览。');return s;}

/** Page reload creates a NEW teacher generation/session, but may explicitly
 * continue the same authorized recording audit scope. Never extend its TTL or
 * carry Agent grants/generations across reload. Independent tabs remain isolated. */
export function createRecordingAuditContinuation(ownerId:string,data:AuditSource,previousId?:string,locale:'zh-CN'|'ko-KR'='zh-CN'){
  let recordingScope:AuditSession['recordingScope'];
  if(previousId){
    const previous=auditSession(ownerId,previousId);
    if(previous.data.result.manifest.snapshot.id!==data.result.manifest.snapshot.id||previous.data.result.report.sourceRevision!==data.result.report.sourceRevision)throw Error('RECORDING_AUDIT_REVISION');
    recordingScope=previous.recordingScope??{id:previousId,expiresAt:previous.expiresAt};
  }
  const id=createAuditSession(ownerId,data,locale),session=auditSession(ownerId,id);
  session.recordingScope=recordingScope??{id,expiresAt:session.expiresAt};return id;
}
