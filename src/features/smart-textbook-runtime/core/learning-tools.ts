import {z} from 'zod';
import {idSchema} from '../../../lib/smart-textbook-runtime-v1/contracts.ts';
export const learningToolsSchema=z.strictObject({snapshotId:idSchema,capsuleRef:idSchema,
  playback:z.array(z.discriminatedUnion('kind',[
    z.strictObject({kind:z.literal('browser-tts'),target:z.string(),partId:idSchema,text:z.string().min(1),locale:z.literal('ko-KR')}),
    z.strictObject({kind:z.literal('listening'),target:z.string(),partId:idSchema,pageId:idSchema,mediaRef:idSchema,revision:z.string()}),
  ])),
  navigation:z.array(z.strictObject({target:z.string(),partId:idSchema,label:z.string(),kind:z.enum(['step','chapter-test'])})),
});
export type LearningTools=z.infer<typeof learningToolsSchema>;
export const learningDestinationSchema=z.discriminatedUnion('kind',[
  z.strictObject({kind:z.literal('step'),stepId:idSchema}),
  z.strictObject({kind:z.literal('chapter-test'),path:z.literal('/dashboard/assignments/korean/korean-level-one-01')}),
]);
export interface LearningToolServices{
  load(capsuleRef:string,signal:AbortSignal):Promise<LearningTools>;
  open(capsuleRef:string,target:string,signal:AbortSignal):Promise<z.infer<typeof learningDestinationSchema>>;
}
