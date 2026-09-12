import type { TeacherKimPose } from '../../../lib/teacher-kim-character';
import type { TargetCommand } from './target-registry';
import type { TtsPlaybackServices } from './playback';
import { z } from 'zod';
import { TEACHER_KIM_POSES } from '../../../lib/teacher-kim-character';
import { parseRuntimeTarget } from '../../../lib/smart-textbook-runtime-v1/targets';

/** Public presentation DTO. Coordinates are restricted to the compatibility
 * stage; identities below are opaque handles or existing stable targets. */
export type TeacherStage = {
  character: null | { pose: TeacherKimPose; visible: boolean; position: 'left' | 'right';
    x: number; y: number; scale: number; narrowX: number; narrowY: number; narrowScale: number };
  blackboard: Array<{ id: string; type: 'text' | 'bullets' | 'expression'; content: string; translation: string;
    x: number; y: number; width: number; height: number; fontSize: number; fontWeight: number;
    align: 'left' | 'center' | 'right'; tone: 'default' | 'primary' | 'highlight' | 'muted' }>;
};
export type TeacherRuntimeCue = {
  cue: string; text: string; phase: 'explanation' | 'task' | 'task_feedback' | 'question';
  stage: TeacherStage; speechAvailable: boolean; buffer: { text: string; available: boolean };
  voice: { enabled: boolean; locale: 'zh-CN' | 'ko-KR'; rate: number };
  task: { source: string; target: string; instruction: string; playbackAvailable: boolean } | null;
  commands: Array<{ source: string; target: string; command: TargetCommand }>;
  awaitingAnswer: boolean; questionOptions: string[]; terminal: boolean; continueLabel: string;
  autoContinue: boolean; answerFeedback: 'correct' | 'retry' | null;
};
export interface TeacherRuntimeServices {
  open(signal: AbortSignal): Promise<void>;
  current(signal: AbortSignal): Promise<TeacherRuntimeCue>;
  advance(signal: AbortSignal): Promise<TeacherRuntimeCue>;
  answer(answer: string, signal: AbortSignal): Promise<TeacherRuntimeCue>;
  pause(signal: AbortSignal): Promise<void>;
  resume(signal: AbortSignal): Promise<void>;
  cancel(): Promise<void>;
  close(): Promise<void>;
  speech(cue: string, kind: 'speech' | 'buffer', signal: AbortSignal): Promise<Blob>;
  character(cue: string, signal: AbortSignal): Promise<Blob>;
  tts: TtsPlaybackServices;
  witness?(source:string,target:string,command:TargetCommand,ownerCount:number):void;
}
const number = z.number().finite(), target = z.string().refine(s => !!parseRuntimeTarget(s));
export const teacherRuntimeCueSchema = z.strictObject({
  cue:z.string().regex(/^teacher-cue-[0-9a-f-]{36}$/),text:z.string(),phase:z.enum(['explanation','task','task_feedback','question']),
  stage:z.strictObject({character:z.strictObject({pose:z.enum(TEACHER_KIM_POSES),visible:z.boolean(),position:z.enum(['left','right']),
    x:number,y:number,scale:number.min(.1).max(3),narrowX:number,narrowY:number,narrowScale:number.min(.1).max(3)}).nullable(),
    blackboard:z.array(z.strictObject({id:z.string(),type:z.enum(['text','bullets','expression']),content:z.string(),translation:z.string(),
      x:number,y:number,width:number,height:number,fontSize:number.min(1).max(120),fontWeight:number,align:z.enum(['left','center','right']),tone:z.enum(['default','primary','highlight','muted'])})).max(12)}),
  voice:z.strictObject({enabled:z.boolean(),locale:z.enum(['zh-CN','ko-KR']),rate:number.min(.75).max(1.25)}),speechAvailable:z.boolean(),
  buffer:z.strictObject({text:z.string(),available:z.boolean()}),task:z.strictObject({source:z.string(),target,instruction:z.string(),playbackAvailable:z.boolean()}).nullable(),
  commands:z.array(z.strictObject({source:z.string(),target,command:z.enum(['reveal','focus','highlight','play','open'])})),
  awaitingAnswer:z.boolean(),questionOptions:z.array(z.string()),terminal:z.boolean(),continueLabel:z.string(),autoContinue:z.boolean(),answerFeedback:z.enum(['correct','retry']).nullable(),
});
