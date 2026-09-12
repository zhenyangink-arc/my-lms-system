'use server';
import { z } from 'zod';
import { requirePlatformOwner } from '../../../lib/admin';
import { auditSession } from './audit-session.server';
import { repeatLesson } from './guided-repeat.server';
import { previewRepeatStore } from './audit-repeat-store.server';

const base={sessionId:z.uuid(),snapshotId:z.string().min(1),capsuleRef:z.string().min(1)};
const loadSchema=z.strictObject(base);
const markSchema=z.strictObject({...base,trackId:z.string().min(1),segmentId:z.string().min(1)});
// No client switch can select production-domain. Every call rechecks owner auth.
export async function auditRepeatLoad(input:unknown){
  const {user}=await requirePlatformOwner(),request=loadSchema.parse(input),s=auditSession(user.id,request.sessionId);
  if(request.snapshotId!==s.data.result.manifest.snapshot.id)throw Error('REPEAT_SNAPSHOT');
  const lesson=repeatLesson(s.data.result.manifest,s.data.result.bindings,s.data.result.services,request.capsuleRef,'zh-CN');
  return lesson?{lesson,state:previewRepeatStore.read(user.id,lesson)}:null;
}
export async function auditRepeatMark(input:unknown){
  const {user}=await requirePlatformOwner(),request=markSchema.parse(input),s=auditSession(user.id,request.sessionId);
  if(request.snapshotId!==s.data.result.manifest.snapshot.id)throw Error('REPEAT_SNAPSHOT');
  const lesson=repeatLesson(s.data.result.manifest,s.data.result.bindings,s.data.result.services,request.capsuleRef,'zh-CN');
  if(!lesson)throw Error('REPEAT_CAPSULE_SCOPE');
  return previewRepeatStore.mark(user.id,lesson,request.trackId,request.segmentId);
}
