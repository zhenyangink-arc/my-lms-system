import type { RuntimeContextV1 } from '../../../lib/smart-textbook-runtime-v1/contracts.ts';
import type { TeacherServices } from './teacher.ts';
import { z } from 'zod';
import type { TtsPlaybackServices } from './playback.ts';
import type { ActivityServices } from './activity.ts';
import type { ActivityPageServices } from './activity-pages.ts';
import type { PatternServices } from './patterns.ts';
import type { GuidedRepeatServices } from './guided-repeat.ts';

export type ActivityResult = { ok:boolean; correct:boolean|null; score:number|null; explanation:string; attemptNumber:number; preview:boolean; nodeId:string|null; nodeCompleted:boolean; completionPercent:number };
export type ServerLearningState = {
  snapshotId:string; revision:string; completedStepIds:string[];
  attempts: Array<{activityRef:string; result:ActivityResult; selectedOptionId?:string}>;
  activityProgress:Array<{activityRef:string;completed:boolean}>;
  pageProgress:Array<{progressRef:string;partIds:string[]}>;
  guidedRepeat:Array<{progressRef:string;segmentIds:string[]}>;
  speakingEvidence:Array<{activityRef:string;evidenceId:string}>;
};
export type LearningSectionKind =
  | 'lead' | 'coach' | 'pattern' | 'nextNode' | 'patternCards' | 'quickResponse'
  | 'substitutions' | 'personalOutput' | 'substitutionGroups' | 'grammarCards'
  | 'vocabulary' | 'dialogueFlow' | 'dialogueScenes' | 'listenFor'
  | 'repeatLines' | 'repeatTracks' | 'speakingFrame' | 'listeningFocus'
  | 'outputChecklist' | 'listenSpeakPages' | 'listeningContext'
  | 'speakingCriteria' | 'formalAudioStatus' | 'rubric' | 'reading' | 'questions'
  | 'writingFrame' | 'originalExample' | 'checklist' | 'returnMap'
  | 'targets' | 'completion' | 'dialogueGroups';
export type ContentCard = { partId:string; title:string; paragraphs:string[]; children:ContentCard[]; section?:LearningSectionKind };
/** Safe per-Step display projection. Not a raw Capsule, SmartTextbookData or DB row. */
export type LearningPanel = {partId:string;title:string;contentPartId:string|null;activityRefs:string[];nativeChoices:boolean;navigation:boolean};
export type LearningContent = { revision:string; capsuleRef:string; stepId:string; cards:ContentCard[]; unsupported:string[];panels?:LearningPanel[] };
export type RuntimeServices = {
  sceneImage?(capsuleRef:string,signal:AbortSignal):Promise<Blob|null>;
  learningTools?: import('./learning-tools').LearningToolServices;
  learningFlow?: import('./learning-flow').LearningFlowServices;
  recording?: import('./recording').RecordingRuntimeServices;
  context:RuntimeContextV1;
  initialState:ServerLearningState;
  learning(capsuleRef:string,signal:AbortSignal):Promise<LearningContent>;
  submit(activityRef:string,response:string,signal:AbortSignal):Promise<ActivityResult>;
  teacher:TeacherServices;
  teacherRuntime?: import('./teacher-runtime').TeacherRuntimeServices;
  tts?:TtsPlaybackServices;
  activities?:ActivityServices;
  pages?:ActivityPageServices;
  patterns?:PatternServices;
  guidedRepeat?:GuidedRepeatServices;
  refresh?(signal:AbortSignal):Promise<ServerLearningState>;
};
export const activityResultSchema=z.strictObject({ok:z.boolean(),correct:z.boolean().nullable(),score:z.number().nullable(),explanation:z.string(),attemptNumber:z.number().int().nonnegative(),preview:z.boolean(),nodeId:z.string().nullable(),nodeCompleted:z.boolean(),completionPercent:z.number().min(0).max(100)});
const serverStateSchema=z.strictObject({
  snapshotId:z.string(),revision:z.string(),completedStepIds:z.array(z.string()),
  attempts:z.array(z.strictObject({activityRef:z.string(),result:activityResultSchema,selectedOptionId:z.string().optional()})),
  activityProgress:z.array(z.strictObject({activityRef:z.string(),completed:z.boolean()})),
  pageProgress:z.array(z.strictObject({progressRef:z.string(),partIds:z.array(z.string())})),
  guidedRepeat:z.array(z.strictObject({progressRef:z.string(),segmentIds:z.array(z.string())})),
  speakingEvidence:z.array(z.strictObject({activityRef:z.string(),evidenceId:z.string()})),
});
export function acceptServerState(context:RuntimeContextV1,state:ServerLearningState) {
  const checked=serverStateSchema.parse(state);
  if(checked.snapshotId!==context.snapshotId)throw Error('STATE_REVISION_MISMATCH');
  return checked;
}
