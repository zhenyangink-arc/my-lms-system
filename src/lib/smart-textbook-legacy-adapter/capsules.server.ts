import 'server-only';
import { z } from 'zod';
import { sectionSchemas, activityConfigSchemas, teacherConfigurationSchema, mediaMetadataSchema } from './chapter-one-shapes.server.ts';
// These are isolated per-Step DTOs, not a SmartTextbookData/row/configuration escape hatch.
export const contentSectionSchema = z.discriminatedUnion('slot', [
  z.strictObject({slot:z.literal("lead"), body:sectionSchemas["lead"], partId:z.string()}),
  z.strictObject({slot:z.literal("coach"), body:sectionSchemas["coach"], partId:z.string()}),
  z.strictObject({slot:z.literal("pattern"), body:sectionSchemas["pattern"], partId:z.string()}),
  z.strictObject({slot:z.literal("nextNode"), body:sectionSchemas["nextNode"], partId:z.string()}),
  z.strictObject({slot:z.literal("patternCards"), body:sectionSchemas["patternCards"], partId:z.string()}),
  z.strictObject({slot:z.literal("quickResponse"), body:sectionSchemas["quickResponse"], partId:z.string()}),
  z.strictObject({slot:z.literal("substitutions"), body:sectionSchemas["substitutions"], partId:z.string()}),
  z.strictObject({slot:z.literal("personalOutput"), body:sectionSchemas["personalOutput"], partId:z.string()}),
  z.strictObject({slot:z.literal("substitutionGroups"), body:sectionSchemas["substitutionGroups"], partId:z.string()}),
  z.strictObject({slot:z.literal("grammarCards"), body:sectionSchemas["grammarCards"], partId:z.string()}),
  z.strictObject({slot:z.literal("vocabulary"), body:sectionSchemas["vocabulary"], partId:z.string()}),
  z.strictObject({slot:z.literal("dialogueFlow"), body:sectionSchemas["dialogueFlow"], partId:z.string()}),
  z.strictObject({slot:z.literal("dialogueScenes"), body:sectionSchemas["dialogueScenes"], partId:z.string()}),
  z.strictObject({slot:z.literal("listenFor"), body:sectionSchemas["listenFor"], partId:z.string()}),
  z.strictObject({slot:z.literal("repeatLines"), body:sectionSchemas["repeatLines"], partId:z.string()}),
  z.strictObject({slot:z.literal("repeatTracks"), body:sectionSchemas["repeatTracks"], partId:z.string()}),
  z.strictObject({slot:z.literal("speakingFrame"), body:sectionSchemas["speakingFrame"], partId:z.string()}),
  z.strictObject({slot:z.literal("listeningFocus"), body:sectionSchemas["listeningFocus"], partId:z.string()}),
  z.strictObject({slot:z.literal("outputChecklist"), body:sectionSchemas["outputChecklist"], partId:z.string()}),
  z.strictObject({slot:z.literal("listenSpeakPages"), body:sectionSchemas["listenSpeakPages"], partId:z.string()}),
  z.strictObject({slot:z.literal("listeningContext"), body:sectionSchemas["listeningContext"], partId:z.string()}),
  z.strictObject({slot:z.literal("speakingCriteria"), body:sectionSchemas["speakingCriteria"], partId:z.string()}),
  z.strictObject({slot:z.literal("formalAudioStatus"), body:sectionSchemas["formalAudioStatus"], partId:z.string()}),
  z.strictObject({slot:z.literal("rubric"), body:sectionSchemas["rubric"], partId:z.string()}),
  z.strictObject({slot:z.literal("reading"), body:sectionSchemas["reading"], partId:z.string()}),
  z.strictObject({slot:z.literal("questions"), body:sectionSchemas["questions"], partId:z.string()}),
  z.strictObject({slot:z.literal("writingFrame"), body:sectionSchemas["writingFrame"], partId:z.string()}),
  z.strictObject({slot:z.literal("originalExample"), body:sectionSchemas["originalExample"], partId:z.string()}),
  z.strictObject({slot:z.literal("checklist"), body:sectionSchemas["checklist"], partId:z.string()}),
  z.strictObject({slot:z.literal("returnMap"), body:sectionSchemas["returnMap"], partId:z.string()}),
  z.strictObject({slot:z.literal("targets"), body:sectionSchemas["targets"], partId:z.string()}),
  z.strictObject({slot:z.literal("completion"), body:sectionSchemas["completion"], partId:z.string()}),
  z.strictObject({slot:z.literal("dialogueGroups"), body:sectionSchemas["dialogueGroups"], partId:z.string()}),
]);
export const activityCapsuleSchema = z.discriminatedUnion('activityKey', [
  z.strictObject({activityKey:z.literal("orientation-check"), activityId:z.string(), settings:activityConfigSchemas["orientation-check"]}),
  z.strictObject({activityKey:z.literal("write-profile"), activityId:z.string(), settings:activityConfigSchemas["write-profile"]}),
  z.strictObject({activityKey:z.literal("review-multiple"), activityId:z.string(), settings:activityConfigSchemas["review-multiple"]}),
  z.strictObject({activityKey:z.literal("vocabulary-check"), activityId:z.string(), settings:activityConfigSchemas["vocabulary-check"]}),
  z.strictObject({activityKey:z.literal("pattern-order"), activityId:z.string(), settings:activityConfigSchemas["pattern-order"]}),
  z.strictObject({activityKey:z.literal("dialogue-fact-check"), activityId:z.string(), settings:activityConfigSchemas["dialogue-fact-check"]}),
  z.strictObject({activityKey:z.literal("dialogue-response"), activityId:z.string(), settings:activityConfigSchemas["dialogue-response"]}),
  z.strictObject({activityKey:z.literal("reading-profile"), activityId:z.string(), settings:activityConfigSchemas["reading-profile"]}),
  z.strictObject({activityKey:z.literal("self-check"), activityId:z.string(), settings:activityConfigSchemas["self-check"]}),
  z.strictObject({activityKey:z.literal("orientation-jimin-occupation"), activityId:z.string(), settings:activityConfigSchemas["orientation-jimin-occupation"]}),
  z.strictObject({activityKey:z.literal("orientation-wangming-occupation"), activityId:z.string(), settings:activityConfigSchemas["orientation-wangming-occupation"]}),
  z.strictObject({activityKey:z.literal("grammar-choice"), activityId:z.string(), settings:activityConfigSchemas["grammar-choice"]}),
  z.strictObject({activityKey:z.literal("grammar-judgment"), activityId:z.string(), settings:activityConfigSchemas["grammar-judgment"]}),
  z.strictObject({activityKey:z.literal("grammar-fill"), activityId:z.string(), settings:activityConfigSchemas["grammar-fill"]}),
  z.strictObject({activityKey:z.literal("listening-identity"), activityId:z.string(), settings:activityConfigSchemas["listening-identity"]}),
  z.strictObject({activityKey:z.literal("pattern-choice"), activityId:z.string(), settings:activityConfigSchemas["pattern-choice"]}),
  z.strictObject({activityKey:z.literal("pattern-compose"), activityId:z.string(), settings:activityConfigSchemas["pattern-compose"]}),
  z.strictObject({activityKey:z.literal("dialogue-roleplay"), activityId:z.string(), settings:activityConfigSchemas["dialogue-roleplay"]}),
  z.strictObject({activityKey:z.literal("speaking-introduction"), activityId:z.string(), settings:activityConfigSchemas["speaking-introduction"]}),
]);
export const teacherSectionSchema = z.discriminatedUnion('kind', [
  z.strictObject({kind:z.literal("blackboard"), body:teacherConfigurationSchema.shape["display"].nonoptional()}),
  z.strictObject({kind:z.literal("character"), body:teacherConfigurationSchema.shape["virtualCharacter"].nonoptional()}),
  z.strictObject({kind:z.literal("performances"), body:teacherConfigurationSchema.shape["scriptPerformances"].nonoptional()}),
  z.strictObject({kind:z.literal("student-task"), body:teacherConfigurationSchema.shape["studentTask"].nonoptional()}),
  z.strictObject({kind:z.literal("visual-cue"), body:teacherConfigurationSchema.shape["visualCue"].nonoptional()}),
  z.strictObject({kind:z.literal("hint"), body:teacherConfigurationSchema.shape["hint"].nonoptional()}),
  z.strictObject({kind:z.literal("example"), body:teacherConfigurationSchema.shape["example"].nonoptional()}),
  z.strictObject({kind:z.literal("terminal"), body:teacherConfigurationSchema.shape["terminal"].nonoptional()}),
  z.strictObject({kind:z.literal("opening-line"), body:teacherConfigurationSchema.shape["bufferLine"].nonoptional()}),
  z.strictObject({kind:z.literal("opening-preset"), body:teacherConfigurationSchema.shape["bufferPresetId"].nonoptional()}),
  z.strictObject({kind:z.literal("continue-label"), body:teacherConfigurationSchema.shape["continueLabel"].nonoptional()}),
]);
export const capsuleSchema = z.discriminatedUnion('kind', [
 z.strictObject({kind:z.literal('learning'),schemaVersion:z.literal('compat.learning/1'),id:z.string(),stepId:z.string(),nodeId:z.string(),revision:z.string(),sections:z.array(contentSectionSchema),activities:z.array(activityCapsuleSchema),panels:z.array(z.strictObject({id:z.string(),legacyPageKey:z.string(),title:z.strictObject({'zh-CN':z.string(),'ko-KR':z.string()})})),contentSlots:z.array(z.string()),activitySlots:z.array(z.string()),completionWeights:z.array(z.number())}),
 z.strictObject({kind:z.literal('teacher'),schemaVersion:z.literal('compat.teacher/1'),id:z.string(),stepId:z.string(),revision:z.string(),nodes:z.array(z.strictObject({id:z.string(),key:z.string(),nodeType:z.string(),title:z.strictObject({'zh-CN':z.string(),'ko-KR':z.string()}),teacherScript:z.strictObject({'zh-CN':z.string(),'ko-KR':z.string()}),sections:z.array(teacherSectionSchema),activityRef:z.string().nullable(),action:z.string(),nextKey:z.string().nullable(),remediationKey:z.string().nullable(),required:z.boolean()}))}),
]);
export type CompatibilityCapsule = z.infer<typeof capsuleSchema>;
export type ContentSection = z.infer<typeof contentSectionSchema>;
export type ActivityCapsule = z.infer<typeof activityCapsuleSchema>;
export type TeacherSection = z.infer<typeof teacherSectionSchema>;
export const teacherSectionKinds = {
  "display": "blackboard",
  "virtualCharacter": "character",
  "scriptPerformances": "performances",
  "studentTask": "student-task",
  "visualCue": "visual-cue",
  "hint": "hint",
  "example": "example",
  "terminal": "terminal",
  "bufferLine": "opening-line",
  "bufferPresetId": "opening-preset",
  "continueLabel": "continue-label"
} as const;
export interface PrivateBindings {
 identities:Array<{owner:string;legacyPath:string;partId:string}>;
 sourceMetadata:Array<{kind:'module'|'node';id:string;title:{'zh-CN':string;'ko-KR':string};description?:{'zh-CN':string;'ko-KR':string};accent?:string;nodeType?:string;minutes?:number;order:number}>;
 mediaMetadata:Array<{ref:string;assetKey:string;purpose:string;data:z.infer<typeof mediaMetadataSchema>}>;
 speech:Array<{id:string;scriptNodeId:string;locale:string;segmentIndex:number;contentHash:string;durationMs:number|null;status:string}>;
 activities:Array<{ref:string;activityId:string;versionId:string;maxAttempts:number;countsTowardCompletion:boolean}>;
 progress:Array<{ref:string;kind:'chapter'|'node'|'activity'|'activity-page'|'guided-repeat';sourceId:string;partIds:string[]}>;
 media:Array<{ref:string;sourceId:string;objectKey:string|null;access:'lesson'|'teaching-turn'|'after-attempt';revision:string}>;
 teaching:Array<{ref:string;scriptVersionId:string;entryCueId:string;capsuleRef:string}>;
 aliases:Array<{legacyKey:string;moduleId:string;target:string;event:string|null}>;
 capsules:CompatibilityCapsule[];
 recordings:Array<{activityId:string;versionId:string;evidenceService:'existing-recordings';practice:'speaking'|'role-play'}>;
 listening:Array<{ref:string;activityId:string;legacyPage:number;audioRef:string;transcriptAccess:'existing-authorized-service'}>;
}
