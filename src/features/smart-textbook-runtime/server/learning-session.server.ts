import 'server-only';
import { z } from 'zod';
import { requireActiveUser } from '../../../lib/auth';
import { createAdminClient } from '../../../lib/supabase/admin';
import { loadPublishedRuntimeSnapshot, authorizePublishedCourse, chapterOnePublicationScope } from '../../../lib/smart-textbook-publishing/loader.server';
import { publicationRepository } from '../../../lib/smart-textbook-publishing/repository.server';
import { assertPublishedDomainDependencies } from '../../../lib/smart-textbook-publishing/domain-guard.server';

const requestSchema=z.strictObject({sessionRef:z.string().regex(/^learning-session-[0-9a-f-]{36}$/)});
/** Durable opaque locator + immutable published artifact. Replica/restart needs
 * no compiler or process Map. Every call reauthenticates and rechecks course RLS.
 * Pointer moves affect new admissions only; a valid old session remains pinned. */
export function createRuntimeLearningSessionResolver(now:()=>number=Date.now){
  return {
    async issue():Promise<{sessionRef:string}>{
      const current=await loadPublishedRuntimeSnapshot(chapterOnePublicationScope);
      const preference=await current.auth.supabase.from('digital_textbook_preferences').select('interface_locale')
        .eq('tenant_id',current.tenantId).eq('student_id',current.auth.user.id).eq('textbook_id',current.bundle.scope.textbookId).maybeSingle();
      if(preference.error)throw Error('LEARNING_SESSION_PREFERENCE');
      const locale=z.enum(['zh-CN','ko-KR']).parse(preference.data?.interface_locale??'zh-CN');
      const session=await publicationRepository(current.admin).session('issue',current.auth.user.id,current.tenantId,{scope:current.bundle.scope,expected:current.pointer,locale});
      if(!session)throw Error('LEARNING_SESSION_ISSUE');return {sessionRef:session.sessionRef};
    },
    async resolve(input:unknown){
      const {sessionRef}=requestSchema.parse(input),auth=await requireActiveUser();
      if(!auth.tenant)throw Error('LEARNING_SESSION_FORBIDDEN');
      const admin=createAdminClient(),saved=await publicationRepository(admin).session('resolve',auth.user.id,auth.tenant.id,{ref:sessionRef.slice('learning-session-'.length)});
      if(!saved||saved.expiresAt<=now())throw Error('LEARNING_SESSION_EXPIRED');
      const authority=await authorizePublishedCourse(saved.bundle.scope);
      if(authority.auth.user.id!==auth.user.id||authority.tenantId!==auth.tenant.id)throw Error('LEARNING_SESSION_OWNER');
      await assertPublishedDomainDependencies(admin,saved.bundle);
      if(saved.expiresAt<=now())throw Error('LEARNING_SESSION_EXPIRED');
      const data={admin,...saved.bundle.privatePayload},m=data.result.manifest;
      return {sessionId:sessionRef,snapshotId:m.snapshot.id,manifestDigest:saved.bundle.manifestDigest,privateBindingDigest:saved.bundle.privateDigest,
        expiresAt:saved.expiresAt,locale:saved.locale,db:auth.supabase,admin,manifest:m,bindings:data.result.bindings,services:data.result.services,nodes:data.source.nodes,
        publishedData:data,
        scope:{authorized:true as const,actorId:auth.user.id,tenantId:auth.tenant.id,versionId:m.version.id,sourceRevision:saved.bundle.sourceRevision}};
    },
    async revoke(input:unknown){
      const {sessionRef}=requestSchema.parse(input),auth=await requireActiveUser();if(!auth.tenant)throw Error('LEARNING_SESSION_FORBIDDEN');
      await publicationRepository(createAdminClient()).session('revoke',auth.user.id,auth.tenant.id,{ref:sessionRef.slice('learning-session-'.length)});
    },
  };
}
