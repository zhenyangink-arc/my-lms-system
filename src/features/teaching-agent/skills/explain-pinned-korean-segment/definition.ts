import 'server-only';
import type { TeachingSkillDefinition } from '../../server/skills/teaching-skill-contract.ts';
import { explainSkillRef, explainOutputRef, lessonToolRef, stateToolRef } from '../../profiles/student-ai-teacher.ts';
import { explainProcedure } from './procedure.ts';

export const explainSkillDefinition = {
  ...explainSkillRef, status: 'published', description: '解释本次已验证的韩语选句；强制课程证据，不拥有教学状态。',
  allowedTools: [lessonToolRef, stateToolRef], procedure: explainProcedure, outputContract: explainOutputRef,
  intent: 'explain_segment', requiredContext: ['authenticated_student', 'student_scope', 'verified_selection', 'published_content', 'source_revision', 'locale'],
  evidenceRequirements: { mandatory: [lessonToolRef], optional: [stateToolRef] }, locales: ['zh-CN', 'ko-KR'],
} satisfies TeachingSkillDefinition;
