import 'server-only';
import { compileChapterOnePublication } from '../../../lib/smart-textbook-publishing/publisher.server';
import { assertPublishableSnapshot } from '../../../lib/smart-textbook-publishing/artifact.server';
import { createAdminClient } from '../../../lib/supabase/admin';

/** Same authorized capture, identity projection, media policy and compiler as
 * publication; no publish, pointer change or production learning write. */
export async function readAuditSource(){
  const bundle=await compileChapterOnePublication();
  assertPublishableSnapshot(bundle);
  const admin=createAdminClient();
  const {source,result}=bundle.privatePayload;
  return {admin,source,result};
}
export type AuditSource=Awaited<ReturnType<typeof readAuditSource>>;
