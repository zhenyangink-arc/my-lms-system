import 'server-only';
import { z } from 'zod';
import type { createRuntimeLearningSessionResolver } from './learning-session.server';
import type { createLearningBoundary } from './learning-boundary.server';
import type { TeacherScope } from './teacher-boundary.server';
import type { ProductionTeacherScope } from './production-teacher-agent.server';

/** Both Teacher scope projections start at the SAME durable learning locator.
 * No audit compiler, independent Manifest fetch or browser revision parameter.
 * Agent profile is authorized by the existing domain adapter; current version
 * changes still fail closed there instead of substituting v24 for pinned v23. */
export function publishedTeacherScope(resolver:ReturnType<typeof createRuntimeLearningSessionResolver>,learning:Pick<ReturnType<typeof createLearningBoundary>,'resume'>){
  async function current(opaque:string){
    const a=await resolver.resolve({sessionRef:opaque}),mount=await learning.resume({sessionRef:opaque});
    if(!a.manifest.steps.some(s=>s.id===mount.activeStepId))throw Error('TEACHER_PUBLISHED_STEP');
    return {a,mount};
  }
  return {
    async resolveScope(opaque:string):Promise<TeacherScope>{
      const {a,mount}=await current(opaque);
      return {data:a.publishedData,generation:mount.generation,stepId:mount.activeStepId,locale:a.locale,expiresAt:a.expiresAt,authority:{actorId:a.scope.actorId,tenantId:a.scope.tenantId}};
    },
    async domainScope(opaque:string):Promise<ProductionTeacherScope>{
      const {a,mount}=await current(opaque),source=a.publishedData.source;
      const teaching=a.manifest.teachingRefs[0],version=source.teachingVersions.find(v=>v.id===teaching.revision),lesson=source.lessons.find(l=>l.id===version?.lesson_id);
      if(!lesson||!version)throw Error('TEACHER_PUBLISHED_REVISION');
      const r=await a.admin.from('learning_agent_lessons').select('agent_profile_id').eq('id',lesson.id).eq('module_id',lesson.module_id).maybeSingle();
      if(r.error)throw Error('TEACHER_PUBLISHED_PROFILE');const profileId=z.string().uuid().parse(r.data?.agent_profile_id);
      const p=await a.admin.from('learning_agent_profiles').select('agent_code').eq('id',profileId).eq('status','published').maybeSingle();
      if(p.error)throw Error('TEACHER_PUBLISHED_PROFILE');
      return {snapshot:a.snapshotId,sourceRevision:a.scope.sourceRevision,scriptVersionId:version.id,textbookId:a.manifest.textbook.id,
        moduleId:lesson.module_id,lessonId:lesson.id,agentProfileId:profileId,agentCode:z.string().min(1).parse(p.data?.agent_code),
        locale:a.locale,supportMode:'bilingual',generation:mount.generation,expiresAt:a.expiresAt};
    },
  };
}
