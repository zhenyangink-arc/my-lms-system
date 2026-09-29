import 'server-only';
import { createToolRegistry } from '../../../agent-core/tools/registry.ts';
import { createCurrentLessonContextTool } from './get-current-lesson-context.ts';
import { createCurrentTeachingStateTool } from './get-current-teaching-state.ts';
import type { StudentToolBinding } from './contracts.ts';

/** Explicit request-local Student composition; the generic Core registry stays empty. */
export function createStudentAiTeacherToolRegistry(input: StudentToolBinding) {
  return createToolRegistry([createCurrentLessonContextTool(input), createCurrentTeachingStateTool(input)]);
}

import type { ToolRegistration } from '../../../agent-core/contracts/tool.ts';
/** The caller supplies its one authorized registration; the old Explain factory
 * above remains independent of execution-summary capability composition. */
export function createProductionStudentExecutionToolRegistry(registration:ToolRegistration){
 return createToolRegistry([registration]);
}
