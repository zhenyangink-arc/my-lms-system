import 'server-only';
import { z } from 'zod';
import type { AuditSession } from './audit-session.server';
import { capsuleSchema } from '../../../lib/smart-textbook-legacy-adapter/capsules.server.ts';
import { idSchema } from '../../../lib/smart-textbook-runtime-v1/contracts.ts';
export const listeningRequest=z.strictObject({sessionId:z.uuid(),capsuleRef:idSchema,pageId:idSchema,kind:z.enum(['audio','transcript'])});
/** Coordinates stay private. Exact Phase 3C alias/domain bindings, not name guesses. */
export function resolveAuditListening(session:AuditSession,input:unknown){
  const request=listeningRequest.parse(input),capsule=capsuleSchema.parse(session.data.result.bindings.capsules.find(c=>c.id===request.capsuleRef));
  if(capsule.kind!=='learning'||session.expiresAt<=Date.now())throw Error('LISTENING_SCOPE');
  const activity=capsule.activities.find(a=>a.activityKey==='listening-identity'),page=session.data.result.services.activityPages.find(p=>p.pageId===request.pageId&&p.nodeId===capsule.nodeId&&p.activityId===activity?.activityId);
  const binding=session.data.result.services.listeningAliases.find(a=>a.activityId===page?.activityId&&a.legacyPage===page?.legacyPage);
  const media=session.data.result.manifest?.mediaRefs.find(m=>m.id===binding?.mediaRef);
  if(!page||!binding||!media||binding.revision!==media.revision||media.readiness!=='ready')throw Error('LISTENING_BINDING_MISMATCH');
  // Old UI exposes the listening transcript after a real page check. Unlike the
  // old generic route, the sidecar keeps that UI gate server-side as well.
  if(request.kind==='transcript'&&!session.pageChecks?.has(page.pageId))throw Error('TRANSCRIPT_REQUIRES_PAGE_CHECK');
  return {activityId:binding.activityId,page:binding.legacyPage,trackId:binding.trackId,mediaRef:binding.mediaRef};
}
