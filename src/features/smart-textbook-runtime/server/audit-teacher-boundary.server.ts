import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import { z } from 'zod';
import { requirePlatformOwner } from '../../../lib/admin';
import { auditSession } from './audit-session.server';
import { auditLearningBoundary } from './audit-learning-boundary.server';
import { createTeacherRuntimeBoundary } from './teacher-boundary.server';
import { proxyAuthorizedSpeech, proxyAuthorizedCharacter } from './audit-speech.server';
import { GET as existingSpeech } from '../../../app/api/learning-agent/speech/[assetId]/route';
import { GET as existingCharacter } from '../../../app/api/learning-agent/characters/[pose]/route';

const requests = new AsyncLocalStorage<Request>();
function mediaRequest(signal: AbortSignal) {
  const request = requests.getStore(), account = process.env.R2_ACCOUNT_ID;
  if (!request || !account || !/^[a-z0-9]+$/i.test(account)) throw Error('TEACHER_MEDIA_CONTEXT');
  return { request: new Request(request.url, { headers: request.headers, signal: AbortSignal.any([signal,request.signal]) }), origin: `https://${account}.r2.cloudflarestorage.com` };
}
const boundary = createTeacherRuntimeBoundary({
  authorize: async () => { const {user} = await requirePlatformOwner(); return {actorId:user.id,role:'platform_owner'}; },
  resolveScope: async scope => {
    const {user} = await requirePlatformOwner(), request = requests.getStore(); if (!request) throw Error('TEACHER_REQUEST_CONTEXT');
    const s = auditSession(user.id, scope.slice('learning-session-'.length));
    const mounted = z.strictObject({generation:z.number().int().nonnegative(),activeStepId:z.string()}).parse(await auditLearningBoundary(request,{operation:'resume',sessionRef:scope}));
    return {data:s.data,stepId:mounted.activeStepId,generation:mounted.generation,locale:s.learningLocale,expiresAt:s.expiresAt};
  },
  readSpeech: async ({assetId,signal}) => { const {request,origin}=mediaRequest(signal); return (await proxyAuthorizedSpeech(request,()=>existingSpeech(request,{params:Promise.resolve({assetId})}),origin)).blob(); },
  readCharacter: async (pose,signal) => { const {request,origin}=mediaRequest(signal); return (await proxyAuthorizedCharacter(request,()=>existingCharacter(request,{params:Promise.resolve({pose})}),origin)).blob(); },
});
export async function auditTeacherBoundary(request:Request,input:unknown) {
  await requirePlatformOwner(); return requests.run(request,()=>boundary.dispatch(input));
}
