import 'server-only';
import { requireActiveUser } from '../auth';
import { createAdminClient } from '../supabase/admin';
import { captureChapterOnePublication } from './capture.server';
import { withMediaPublicationPolicy } from './media-policy.server';
import { chapterOnePublicationScope } from './loader.server';
import { finalizeChapterOneNonUiReadiness } from '../smart-textbook-legacy-adapter/final-readiness.server';
import { packageSnapshot, draftFromSnapshot, validateSnapshotBundle, type PublicationBundle, type PublicationScope } from './artifact.server';
import { publicationRepository, type PublicationPointer } from './repository.server';
import { publicationIdentities } from './grammar-identities.server';
import history from './assets/v1/chapter-one-service-identities.server';
import { digest } from '../smart-textbook-legacy-adapter/identity.server';

async function owner(){const auth=await requireActiveUser();if(auth.profile?.global_role!=='platform_owner')throw Error('PUBLICATION_OWNER_ONLY');return auth.user.id;}
/** Owner DAL used by operator tools and the authoring Server Action. All operations reauthorize; compilation
 * takes trusted authoring capture, never browser-supplied bindings or revisions. */
export async function compileChapterOnePublication(){
  const actor=await owner(),admin=createAdminClient();
  const {source,evidence,dependencies}=await captureChapterOnePublication(admin,actor,chapterOnePublicationScope);
  const compiled=finalizeChapterOneNonUiReadiness(source,publicationIdentities(dependencies.digital_textbook_nodes),history,evidence);
  return packageSnapshot(source,evidence,withMediaPublicationPolicy(source,compiled,digest(dependencies)),dependencies);
}
export async function validatePublication(bundle:PublicationBundle){await owner();return validateSnapshotBundle(bundle);}
export async function publishChapterOne(expected:PublicationPointer|null,checkedManifestDigest?:string){
  const actor=await owner(),bundle=await compileChapterOnePublication();
  // The workbench publishes exactly what its check displayed. The database
  // publisher still verifies captured dependencies under its transaction lock.
  if(checkedManifestDigest!==undefined&&bundle.manifestDigest!==checkedManifestDigest)throw Error('PUBLICATION_CHECK_STALE');
  return publicationRepository(createAdminClient()).publish(actor,bundle,expected);
}
export async function rollbackPublication(scope:PublicationScope,target:string,expected:PublicationPointer){
  const actor=await owner();return publicationRepository(createAdminClient()).rollback(actor,scope,target,expected);
}
export async function publicationHistory(scope:PublicationScope){const actor=await owner();return publicationRepository(createAdminClient()).history(actor,scope);}
export async function newPublicationDraft(bundle:PublicationBundle){await owner();return draftFromSnapshot(bundle);}
