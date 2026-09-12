import { z } from 'zod';
import { idSchema } from '../../../lib/smart-textbook-runtime-v1/contracts.ts';
import type { ActivityResult } from './services.ts';
const option=z.strictObject({id:idSchema,text:z.string()});
const item=z.strictObject({id:idSchema,prompt:z.string(),options:z.array(option),placeholder:z.string()});
const base={ref:idSchema,title:z.string(),instruction:z.string()};
export const activityExecutionSchema=z.discriminatedUnion('kind',[
  z.strictObject({...base,kind:z.literal('single'),options:z.array(option)}),
  z.strictObject({...base,kind:z.literal('multiple'),options:z.array(option)}),
  z.strictObject({...base,kind:z.literal('ordering'),options:z.array(option)}),
  z.strictObject({...base,kind:z.literal('choice-group'),items:z.array(item)}),
  z.strictObject({...base,kind:z.literal('fill-group'),items:z.array(item)}),
  z.strictObject({...base,kind:z.literal('writing'),checklist:z.array(option),confirmation:z.string()}),
  z.strictObject({...base,kind:z.literal('self-check'),items:z.array(option),returnTargets:z.array(option)}),
  z.strictObject({...base,kind:z.literal('unavailable'),reason:z.string()}),
]);
export type ActivityExecution=z.infer<typeof activityExecutionSchema>;
/** Only learner responses cross this boundary; domain coordinates are server-owned. */
export const activityResponseSchema=z.discriminatedUnion('kind',[
  z.strictObject({kind:z.literal('single'),optionId:idSchema}),
  z.strictObject({kind:z.literal('multiple'),optionIds:z.array(idSchema).max(30)}),
  z.strictObject({kind:z.literal('ordering'),optionIds:z.array(idSchema).max(30)}),
  z.strictObject({kind:z.literal('choice-group'),items:z.array(z.strictObject({partId:idSchema,optionId:idSchema})).max(100)}),
  z.strictObject({kind:z.literal('fill-group'),items:z.array(z.strictObject({partId:idSchema,text:z.string().max(300)})).max(100)}),
  z.strictObject({kind:z.literal('writing'),text:z.string().min(1).max(10000),information:z.array(z.strictObject({partId:idSchema,checked:z.boolean()})).max(30),rubricConfirmed:z.boolean()}),
  z.strictObject({kind:z.literal('self-check'),checks:z.array(z.strictObject({partId:idSchema,value:z.enum(['can','review'])})).max(30),returnTargetIds:z.array(idSchema).min(1).max(30),note:z.string().max(2000)}),
]);
export type ActivityResponse=z.infer<typeof activityResponseSchema>;
export interface ActivityServices {
  load(capsuleRef:string,signal:AbortSignal):Promise<ActivityExecution[]>;
  submit(ref:string,response:ActivityResponse,signal:AbortSignal):Promise<ActivityResult>;
}
