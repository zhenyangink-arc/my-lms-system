import 'server-only';
import type { PermissionPolicy } from '../../../agent-core/permissions/permission-policy.ts';
import { lessonToolRef, stateToolRef } from '../../profiles/student-ai-teacher.ts';
import { versionKey } from '../../../agent-core/skills/registry.ts';
import type { StudentToolBinding } from '../tools/contracts.ts';

export function createStudentToolPolicy(input: StudentToolBinding): PermissionPolicy {
  return { async evaluate(authority, action) {
    const deny = { effect: 'deny' as const, code: 'TOOL_NOT_ALLOWED' };
    if (authority !== input.binding.authority || authority.membershipRole !== 'student' || action.kind !== 'tool') return deny;
    const key = versionKey(action.ref);
    const permission = key === versionKey(lessonToolRef) ? 'teaching.content.read'
      : key === versionKey(stateToolRef) && input.binding.scope.teachingSessionId ? 'teaching.state.self.read' : null;
    if (!permission || action.requiredPermissions.length !== 1 || action.requiredPermissions[0] !== permission) return deny;
    const checked = await input.domain.selection.revalidate(input.binding, input.execution);
    // A stale result follows current authorization in 1A. Allow only the bounded read attempt
    // so the port can return stale without serving cached content. Revoked access stays denied.
    if (checked.status !== 'ok' && checked.status !== 'stale') return deny;
    return { effect: 'allow', policyVersion: authority.policyVersion, scopeRef: authority.scopeRef, expiresAt: authority.expiresAt };
  } };
}

import { productionLessonFactsToolRef } from '../tools/contracts.ts';
import type { ProductionLessonFactsBinding } from '../domain-ports/production-lesson-facts-binding.server.ts';
import type { ProductionLessonFactsHandle } from '../domain-ports/lesson-execution-facts-binding.ts';
export function createProductionStudentExecutionPolicy(input:StudentToolBinding,issuer:ProductionLessonFactsBinding,handle:ProductionLessonFactsHandle):PermissionPolicy {
 return {async evaluate(authority,action){
  const deny={effect:'deny',code:'TOOL_NOT_ALLOWED'} as const;
  if(authority!==input.binding.authority||authority.membershipRole!=='student'||action.kind!=='tool'||versionKey(action.ref)!==versionKey(productionLessonFactsToolRef)||action.requiredPermissions.length!==1||action.requiredPermissions[0]!=='teaching.execution.self.read')return deny;
  try{await issuer.revalidate(handle,{...input.execution,skillRunId:input.skillRunId,authority});}catch{return deny;}
  return {effect:'allow',policyVersion:authority.policyVersion,scopeRef:authority.scopeRef,expiresAt:authority.expiresAt};
 }};
}
