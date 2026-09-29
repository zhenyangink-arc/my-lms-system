import 'server-only';
import { z } from 'zod';
import type { ToolRegistration } from '../../../agent-core/contracts/tool.ts';
import type { LessonExecutionFactsReadPort } from '../domain-ports/index.ts';
import type { LessonFactsHandle } from '../domain-ports/lesson-execution-facts-binding.ts';
import { lessonFactsToolRef,lessonFactsInputSchema,lessonFactsOutputSchema } from './contracts.ts';

export function createLessonExecutionFactsTool(port:LessonExecutionFactsReadPort,handle:LessonFactsHandle):ToolRegistration {
 return {definition:{...lessonFactsToolRef,status:'enabled',riskLevel:0,requiredPermissions:['teaching.execution.self.read'],
  description:'只读本次服务端授权课程活动的持久作答、完成状态及来源证据。不提供答案，不推测当前播放或教学位置。',
  inputSchema:z.toJSONSchema(lessonFactsInputSchema),inputValidator:lessonFactsInputSchema,outputValidator:lessonFactsOutputSchema,timeoutMs:12000,maxResultBytes:16384},
  executor:{async execute(args,context){if(!lessonFactsInputSchema.safeParse(args).success)return {status:'not_found_or_not_visible',code:'READ_UNAVAILABLE'};return port.read(handle,context);}}};
}

import type { ProductionLessonExecutionFactsReadPort } from '../domain-ports/index.ts';
import type { ProductionLessonFactsHandle } from '../domain-ports/lesson-execution-facts-binding.ts';
import { productionLessonFactsToolRef,productionLessonFactsOutputSchema } from './contracts.ts';
export function createProductionLessonExecutionFactsTool(port:ProductionLessonExecutionFactsReadPort,handle:ProductionLessonFactsHandle):ToolRegistration {
 return {definition:{...productionLessonFactsToolRef,status:'enabled',riskLevel:0,requiredPermissions:['teaching.execution.self.read'],description:'读取本次已授权学生与已发布活动的持久事实，不推测当前位置，不提供答案。',inputSchema:z.toJSONSchema(lessonFactsInputSchema),inputValidator:lessonFactsInputSchema,outputValidator:productionLessonFactsOutputSchema,timeoutMs:12000,maxResultBytes:16384},
 executor:{async execute(input,context){if(!lessonFactsInputSchema.safeParse(input).success)return {status:'not_found_or_not_visible',code:'READ_UNAVAILABLE'};return port.read(handle,context);}}};
}
