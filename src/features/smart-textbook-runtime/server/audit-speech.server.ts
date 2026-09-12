import 'server-only';
import { z } from 'zod';
import type { AuditSession } from './audit-session.server';

export const auditSpeechRequest=z.strictObject({sessionId:z.uuid(),cueId:z.uuid(),generation:z.coerce.number().int().nonnegative(),kind:z.enum(['speech','buffer'])});
export const auditCharacterRequest=auditSpeechRequest.omit({kind:true});
export function auditCharacterSelection(session:AuditSession,input:unknown){
  const request=auditCharacterRequest.parse(input),turn=session.lastTurn;
  if(!turn?.character||session.expiresAt<=Date.now()||request.generation!==session.generation||request.generation<=session.revokedThrough||request.cueId!==turn.cueId)throw Error('CHARACTER_TURN_UNAVAILABLE');
  return turn.character.pose;
}
/** The client selects only a slot on the current authorized turn, never an asset,
 * preset, object key or URL. Its value was selected by the unchanged Phase 3E path. */
export function auditSpeechSelection(session:AuditSession,input:unknown){
  const request=auditSpeechRequest.parse(input),turn=session.lastTurn;
  if(!turn||session.expiresAt<=Date.now()||request.generation!==session.generation||request.generation<=session.revokedThrough||request.cueId!==turn.cueId)throw Error('SPEECH_TURN_UNAVAILABLE');
  const id=request.kind==='speech'?turn.speechAssetId:turn.buffer.assetId;
  if(!id)throw Error('NO_SELECTED_SPEECH');
  return id;
}

/** Preserve existing speech Route authorization. Its signed URL remains server-only.
 * Only a fixed configured R2 origin may be fetched; redirects and private headers
 * never cross the browser boundary. This service does not select or regenerate speech. */
export async function proxyAuthorizedSpeech(request:Request,authorize:()=>Promise<Response>,origin:string,fetcher:typeof fetch=fetch){
  const authorized=await authorize();if(!authorized.ok)throw Error('SPEECH_AUTHORIZATION_FAILED');
  const payload=z.object({audioUrl:z.url()}).parse(await authorized.json()),url=new URL(payload.audioUrl);
  if(url.protocol!=='https:'||url.origin!==origin||url.username||url.password||url.hash)throw Error('INVALID_SPEECH_ORIGIN');
  const range=request.headers.get('range');if(range&&!/^bytes=\d*-\d*$/.test(range))throw Error('INVALID_RANGE');
  const upstream=await fetcher(url,{headers:range?{Range:range}:undefined,redirect:'error',cache:'no-store',signal:AbortSignal.any([request.signal,AbortSignal.timeout(15000)])});
  if(upstream.status!==200&&upstream.status!==206)throw Error('SPEECH_BYTES_UNAVAILABLE');
  const type=upstream.headers.get('content-type')?.split(';')[0]??'';
  if(!/^audio\/[a-z0-9.+-]+$/i.test(type))throw Error('INVALID_SPEECH_TYPE');
  const headers=new Headers({'Content-Type':type,'Cache-Control':'private, no-store, max-age=0','Cross-Origin-Resource-Policy':'same-origin','X-Content-Type-Options':'nosniff','Content-Disposition':'inline; filename="teacher-speech"'});
  for(const key of ['accept-ranges','content-length','content-range']){const value=upstream.headers.get(key);if(value)headers.set(key,value);}
  return new Response(upstream.body,{status:upstream.status,headers});
}

export async function proxyAuthorizedCharacter(request:Request,authorize:()=>Promise<Response>,origin:string,fetcher:typeof fetch=fetch){
  const response=await authorize(),location=response.headers.get('location');
  if(response.status!==302||!location)throw Error('CHARACTER_AUTHORIZATION_FAILED');
  const url=new URL(location);if(url.protocol!=='https:'||url.origin!==origin||url.username||url.password||url.hash)throw Error('INVALID_CHARACTER_ORIGIN');
  const bytes=await fetcher(url,{redirect:'error',cache:'no-store',signal:AbortSignal.any([request.signal,AbortSignal.timeout(15000)])});
  const type=bytes.headers.get('content-type')?.split(';')[0];
  if(bytes.status!==200||!type||!['image/png','image/jpeg','image/webp'].includes(type))throw Error('CHARACTER_BYTES_UNAVAILABLE');
  return new Response(bytes.body,{headers:{'Content-Type':type,'Cache-Control':'private, no-store','Cross-Origin-Resource-Policy':'same-origin','X-Content-Type-Options':'nosniff'}});
}
