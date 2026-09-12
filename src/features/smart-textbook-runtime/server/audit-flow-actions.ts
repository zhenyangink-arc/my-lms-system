'use server';
import { z } from 'zod';
import { requirePlatformOwner } from '../../../lib/admin';
import { idSchema } from '../../../lib/smart-textbook-runtime-v1/contracts';
import { activityResponseSchema } from '../core/activity';
import { pageResponseSchema } from '../core/activity-pages';
import { patternResponseSchema } from '../core/patterns';
import { auditSession } from './audit-session.server';
import { auditLearningFlow } from './audit-flow.server';
const base={sessionId:z.uuid(),snapshotId:idSchema,capsuleRef:idSchema};
const requestSchema=z.discriminatedUnion('operation',[
  z.strictObject({...base,operation:z.literal('restore')}),
  z.strictObject({...base,operation:z.literal('submit'),activityRef:idSchema,response:activityResponseSchema}),
  z.strictObject({...base,operation:z.literal('page-check'),pageId:idSchema,response:pageResponseSchema}),
  z.strictObject({...base,operation:z.literal('reveal'),pageId:idSchema}),
  z.strictObject({...base,operation:z.literal('finish-pages'),activityRef:idSchema}),
  z.strictObject({...base,operation:z.literal('pattern-check'),activityRef:idSchema,response:patternResponseSchema}),
  z.strictObject({...base,operation:z.literal('finish-pattern'),activityRef:idSchema,responses:z.array(patternResponseSchema).max(100)}),
]);
export async function auditFlow(input:unknown){
  const {user}=await requirePlatformOwner(),r=requestSchema.parse(input),s=auditSession(user.id,r.sessionId);
  if(s.data.result.manifest.snapshot.id!==r.snapshotId)throw Error('FLOW_SNAPSHOT');
  const flow=auditLearningFlow(user.id,r.sessionId);
  switch(r.operation){
    case 'restore':{const restored=await flow.restore(r.capsuleRef);s.pageChecks??=new Map();for(const p of restored.pages)if(p.checked)s.pageChecks.set(p.pageId,{pageId:p.pageId,items:p.items,formalCompletion:false,progressDelta:null});return restored;}
    case 'submit':return flow.submit(r.capsuleRef,r.activityRef,r.response);
    case 'page-check':{const result=await flow.pageCheck(r.capsuleRef,r.pageId,r.response);s.pageChecks??=new Map();s.pageChecks.set(r.pageId,result);return result;}
    case 'reveal':return flow.revealPage(r.capsuleRef,r.pageId);
    case 'finish-pages':return flow.finishPages(r.capsuleRef,r.activityRef);
    case 'pattern-check':return flow.patternCheck(r.capsuleRef,r.activityRef,r.response);
    case 'finish-pattern':return flow.finishPattern(r.capsuleRef,r.activityRef,r.responses);
  }
}
