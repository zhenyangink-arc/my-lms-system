import 'server-only';
import { requireActiveUser } from '../auth';
import { createAdminClient } from '../supabase/admin';
import { captureChapterOnePublication, captureNativePublication, captureNativeVideoPublication } from './capture.server.ts';
import { withMediaPublicationPolicy } from './media-policy.server.ts';
import { chapterOnePublicationScope } from './loader.server.ts';
import { finalizeChapterOneNonUiReadiness } from '../smart-textbook-legacy-adapter/final-readiness.server.ts';
import { packageSnapshot, draftFromSnapshot, validateSnapshotBundle, type PublicationBundle, type LegacyPublicationBundle, type PublicationScope } from './artifact.server.ts';
import { publicationRepository, type PublicationPointer } from './repository.server.ts';
import { publicationIdentities } from './grammar-identities.server';
import { compilationDiagnostics, mediaDiagnostic, PublicationDiagnosticError } from './diagnostics.server';
import history from './assets/v1/chapter-one-service-identities.server.ts';
import { packageNativePublication } from './native-publication.server.ts';
import { digest } from '../smart-textbook-legacy-adapter/identity.server.ts';

import { packageNativeVideoPublication } from './native-video-publication.server.ts';
import { readFixedSelectedVideoSnapshot } from './fixed-selected-media.server.ts';

async function owner(){const auth=await requireActiveUser();if(auth.profile?.global_role!=='platform_owner')throw Error('PUBLICATION_OWNER_ONLY');return auth.user.id;}
/** Owner DAL used by operator tools and the authoring Server Action. All operations reauthorize; compilation
 * takes trusted authoring capture, never browser-supplied bindings or revisions. */
export async function compileChapterOnePublication():Promise<LegacyPublicationBundle>{
  const actor=await owner(),admin=createAdminClient();
  const {source,evidence,dependencies}=await captureChapterOnePublication(admin,actor,chapterOnePublicationScope);
  const compiled=finalizeChapterOneNonUiReadiness(source,publicationIdentities(dependencies.digital_textbook_nodes),history,evidence);
  if(!compiled.nonUiRuntimeReady)throw new PublicationDiagnosticError(compilationDiagnostics(source,compiled.remainingNonUiUnsupported));
  try {
    return packageSnapshot(source,evidence,withMediaPublicationPolicy(source,compiled,digest(dependencies)),dependencies);
  } catch(error) {
    if(error instanceof Error&&error.message.startsWith('PUBLICATION_MEDIA_REAUDIT_REQUIRED:')){
      const ref=error.message.slice('PUBLICATION_MEDIA_REAUDIT_REQUIRED:'.length);
      const binding=compiled.bindings.media.find(m=>m.ref===ref);
      const asset=source.media.find(m=>m.id===binding?.sourceId);
      throw new PublicationDiagnosticError([mediaDiagnostic(source.nodes.find(n=>n.id===asset?.node_id)?.module_id)]);
    }
    throw error;
  }
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

/** Fixed bytes and the single DB capture are both mandatory; no draft promotion. */
export async function compileNativeVideoPublication(scope:PublicationScope){
  const actor=await owner(),admin=createAdminClient();
  await readFixedSelectedVideoSnapshot();
  return packageNativeVideoPublication(await captureNativeVideoPublication(admin,actor,scope),scope);
}
export async function publishNativeVideoPublication(scope:PublicationScope,expected:PublicationPointer|null){
  const actor=await owner(),admin=createAdminClient();
  await readFixedSelectedVideoSnapshot();
  const bundle=packageNativeVideoPublication(await captureNativeVideoPublication(admin,actor,scope),scope);
  return publicationRepository(admin).publish(actor,bundle,expected);
}
