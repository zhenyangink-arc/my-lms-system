import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PublicationBundle } from './artifact.server';

/** Check durable fence membership, NOT mutable rows before an operation.
 * The DB authoring triggers retain the captured dependency set for the entire
 * lifetime of every immutable snapshot, including old/rolled-back sessions. */
export async function assertPublishedDomainDependencies(admin:SupabaseClient,bundle:PublicationBundle){
  if(!bundle.privatePayload.dependencies)throw Error('LEARNING_SESSION_DEPENDENCY_FENCE_REQUIRED');
  const r=await admin.rpc('assert_runtime_dependency_fence_v1',{p_snapshot:bundle.snapshotId,p_capture:bundle.privatePayload.dependencies});
  if(r.error||r.data!==true)throw Error('LEARNING_SESSION_DEPENDENCY_FENCE_REQUIRED');
}
