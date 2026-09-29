import 'server-only';
import { requireActiveUser } from '../auth';
import { createAdminClient } from '../supabase/admin';
import { captureChapterOnePublication, captureNativePublication } from './capture.server.ts';
import { withMediaPublicationPolicy } from './media-policy.server.ts';
import { chapterOnePublicationScope } from './loader.server.ts';
import { finalizeChapterOneNonUiReadiness } from '../smart-textbook-legacy-adapter/final-readiness.server.ts';
import { packageSnapshot, draftFromSnapshot, validateSnapshotBundle, type PublicationBundle, type PublicationScope } from './artifact.server.ts';
import { publicationRepository, type PublicationPointer } from './repository.server.ts';
import identities from './assets/v1/chapter-one-identities.server.ts';
import history from './assets/v1/chapter-one-service-identities.server.ts';
import { packageNativePublication } from './native-publication.server.ts';
import { digest } from '../smart-textbook-legacy-adapter/identity.server.ts';

async function owner(){const auth=await requireActiveUser();if(auth.profile?.global_role!=='platform_owner')throw Error('PUBLICATION_OWNER_ONLY');return auth.user.id;}
/** No Server Action / browser entry point. All operations reauthorize; compilation
 * takes trusted authoring capture, never browser-supplied bindings or revisions. */
export async function compileChapterOnePublication(){
  const actor=await owner(),admin=createAdminClient();
  const {source,evidence,dependencies}=await captureChapterOnePublication(admin,actor,chapterOnePublicationScope);
  const compiled=finalizeChapterOneNonUiReadiness(source,identities,history,evidence);
  return packageSnapshot(source,evidence,withMediaPublicationPolicy(source,compiled,digest(dependencies)),dependencies);
}
export async function validatePublication(bundle:PublicationBundle){await owner();return validateSnapshotBundle(bundle);}
export async function publishChapterOne(expected:PublicationPointer|null){
  const actor=await owner(),bundle=await compileChapterOnePublication();
  return publicationRepository(createAdminClient()).publish(actor,bundle,expected);
}
export async function rollbackPublication(scope:PublicationScope,target:string,expected:PublicationPointer){
  const actor=await owner();return publicationRepository(createAdminClient()).rollback(actor,scope,target,expected);
}
export async function publicationHistory(scope:PublicationScope){const actor=await owner();return publicationRepository(createAdminClient()).history(actor,scope);}
export async function newPublicationDraft(bundle:PublicationBundle){await owner();return draftFromSnapshot(bundle);}

/** Explicit native strategy within the one Owner-authorized publication framework. */
export async function compileNativePublication(scope:PublicationScope){
  const actor=await owner(),admin=createAdminClient();
  return packageNativePublication(await captureNativePublication(admin,actor,scope),scope);
}
export async function publishNativePublication(scope:PublicationScope,expected:PublicationPointer|null){
  const actor=await owner(),admin=createAdminClient();
  const bundle=packageNativePublication(await captureNativePublication(admin,actor,scope),scope);
  return publicationRepository(admin).publish(actor,bundle,expected);
}
