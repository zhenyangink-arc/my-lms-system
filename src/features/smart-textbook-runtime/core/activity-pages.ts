import { z } from 'zod';
import { idSchema } from '../../../lib/smart-textbook-runtime-v1/contracts.ts';
const option=z.strictObject({id:idSchema,text:z.string()});
export const activityPageSchema=z.strictObject({
  pageId:idSchema,activityRef:idSchema,title:z.string(),
  listening:z.strictObject({trackId:idSchema,normalLimit:z.number().int().nonnegative(),slowLimit:z.number().int().nonnegative()}).nullable(),
  items:z.array(z.discriminatedUnion('kind',[
    z.strictObject({kind:z.literal('choice'),partId:idSchema,prompt:z.string(),options:z.array(option)}),
    z.strictObject({kind:z.literal('fill'),partId:idSchema,prompt:z.string(),placeholder:z.string()}),
  ])).min(1).max(4),
});
export const pageResponseSchema=z.array(z.discriminatedUnion('kind',[
  z.strictObject({kind:z.literal('choice'),partId:idSchema,optionId:idSchema}),
  z.strictObject({kind:z.literal('fill'),partId:idSchema,text:z.string().max(300)}),
])).min(1).max(4);
export type ActivityPage=z.infer<typeof activityPageSchema>;
export type PageResponse=z.infer<typeof pageResponseSchema>;
export type PageCheck={pageId:string;items:Array<{partId:string;correct:boolean}>;formalCompletion:false;progressDelta:null};
export interface ActivityPageServices{
  load(capsuleRef:string,signal:AbortSignal):Promise<ActivityPage[]>;
  check(capsuleRef:string,pageId:string,response:PageResponse,signal:AbortSignal):Promise<PageCheck>;
  audio?(capsuleRef:string,pageId:string,signal:AbortSignal):Promise<Blob>;
  transcript?(capsuleRef:string,pageId:string,signal:AbortSignal):Promise<string>;
}
