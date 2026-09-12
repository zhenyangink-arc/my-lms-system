import 'server-only';
import { requireActiveUser } from '../auth';
import { createAdminClient } from '../supabase/admin';
import { canUseStudentFeature, normalizeMembershipTier } from '../student-permissions';
import { publicationRepository } from './repository.server';
import { scopeSchema, type PublicationScope } from './artifact.server';
import { assertPublishedDomainDependencies } from './domain-guard.server';

/** Trusted server course resolution default: only the certified Chapter 1.
 * No browser snapshot/draft/history selector. Future routing may pass a resolved
 * scope here, but this is deliberately NOT a deployed student Route. */
export const chapterOnePublicationScope:PublicationScope={textbookId:'7100ab2b-72b0-478e-8847-4df9b4485109',versionId:'939ad4f7-3238-425e-91e9-d456c130ca68',chapterId:'cda24fb8-c93b-4a19-9577-4418350ff708'};
export async function authorizePublishedCourse(scope:PublicationScope){
  const s=scopeSchema.parse(scope),auth=await requireActiveUser();
  if(!auth.tenant||!canUseStudentFeature(auth.profile?.role??'student',normalizeMembershipTier(auth.profile?.membership_tier),'korean_course'))throw Error('LEARNING_SESSION_FORBIDDEN');
  const chapter=await auth.supabase.from('digital_textbook_chapters').select('id,version_id').eq('id',s.chapterId).eq('version_id',s.versionId).maybeSingle();
  const version=await auth.supabase.from('digital_textbook_versions').select('id,textbook_id').eq('id',s.versionId).eq('textbook_id',s.textbookId).maybeSingle();
  if(chapter.error||version.error||chapter.data?.id!==s.chapterId||chapter.data.version_id!==s.versionId||version.data?.textbook_id!==s.textbookId)throw Error('LEARNING_SESSION_CHAPTER_FORBIDDEN');
  return {auth,admin:createAdminClient(),tenantId:auth.tenant.id};
}
/** Returns a PRIVATE server object. Client transport selects manifest only.
 * A single SQL join captures pointer+artifact+bindings; no cache/live compilation. */
export async function loadPublishedRuntimeSnapshot(scope:PublicationScope=chapterOnePublicationScope){
  const authority=await authorizePublishedCourse(scope);
  const publication=await publicationRepository(authority.admin).current(scope);
  await assertPublishedDomainDependencies(authority.admin,publication.bundle);
  return {...authority,...publication,data:{admin:authority.admin,...publication.bundle.privatePayload}};
}
