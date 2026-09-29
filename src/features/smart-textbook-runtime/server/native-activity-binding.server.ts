import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { CompletionRequest, ExecutionBinding } from '../core/execution-contracts.ts';
import { sameBinding } from '../core/execution-contracts.ts';
const localized=z.object({'zh-CN':z.string().min(1),'ko-KR':z.string().optional()}).strict();
export const nativeActivityScopeSchema=z.strictObject({tenantId:z.uuid(),actorId:z.uuid(),versionId:z.uuid(),nodeId:z.uuid(),activityId:z.uuid()});
export type NativeActivityScope=z.infer<typeof nativeActivityScopeSchema>;
export const nativeDefinitionSchema=z.strictObject({
 digest:z.string().regex(/^[a-f0-9]{64}$/),
 activity:z.object({id:z.uuid(),node_id:z.uuid(),activity_key:z.literal('hangul-introduction-vowel-recognition'),activity_type:z.literal('single_choice'),prompt:localized,instruction:localized,options:z.array(localized).length(3),public_config:z.record(z.string(),z.unknown()),counts_toward_completion:z.literal(true)}),
 secret:z.object({activity_id:z.uuid(),answer_key:z.object({kind:z.literal('index'),value:z.number().int().min(0).max(2)}).strict()}),
 node:z.object({id:z.uuid(),module_id:z.uuid(),node_type:z.literal('practice')}),
 module:z.object({id:z.uuid(),chapter_id:z.uuid(),module_code:z.literal('orientation')}),
 chapter:z.object({id:z.uuid(),version_id:z.uuid(),chapter_number:z.literal(0),status:z.literal('draft')}),
 version:z.object({id:z.uuid(),status:z.literal('draft')}),
});
export type NativeActivityDefinition=z.infer<typeof nativeDefinitionSchema>;
export function safeDigest(value:unknown):string{return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
export function validateNativeActivity(raw:unknown,scope:NativeActivityScope){
 const d=nativeDefinitionSchema.parse(raw);nativeActivityScopeSchema.parse(scope);
 if(d.activity.id!==scope.activityId||d.activity.node_id!==scope.nodeId||d.node.id!==scope.nodeId||d.node.module_id!==d.module.id||d.module.chapter_id!==d.chapter.id||d.chapter.version_id!==scope.versionId||d.version.id!==scope.versionId||d.secret.activity_id!==scope.activityId)throw Error('NATIVE_ACTIVITY_PARENT_BINDING');
 if(d.activity.prompt['zh-CN']!=='哪个是元音？'||JSON.stringify(d.activity.options.map(o=>o['zh-CN']))!==JSON.stringify(['ㄱ','ㅏ','ㄴ']))throw Error('NATIVE_ACTIVITY_CONTENT_BINDING');
 return d;
}
/** Explicit whitelist. No authoring body, private digest or answer configuration. */
export function publicNativeActivity(d:NativeActivityDefinition){
 const {activity:a}=d;
 return {alias:a.activity_key,revision:safeDigest({id:a.id,prompt:a.prompt,instruction:a.instruction,options:a.options}),prompt:a.prompt,instruction:a.instruction,options:a.options.map((text,i)=>({id:`option-${i}`,text}))};
}
export function assertNativeRequest(r:CompletionRequest,expected:ExecutionBinding){if(!sameBinding(r.binding,expected))throw Error('NATIVE_ACTIVITY_EXECUTION_SCOPE');}
export const nativeResponseEnvelopeSchema=z.strictObject({contract:z.literal('native-choice-response/1'),requestId:z.string().min(1).max(200),bindingDigest:z.string().regex(/^[a-f0-9]{64}$/),definitionDigest:z.string().regex(/^[a-f0-9]{64}$/),optionIndex:z.number().int().min(0).max(2),generation:z.number().int().nonnegative()});
export type NativeResponseEnvelope=z.infer<typeof nativeResponseEnvelopeSchema>;
