import 'server-only';
import { readChapterOneLegacySource } from '../../../lib/smart-textbook-legacy-adapter/reader.server';
import { readChapterOneServiceEvidence } from '../../../lib/smart-textbook-legacy-adapter/service-reader.server';
import { finalizeChapterOneNonUiReadiness } from '../../../lib/smart-textbook-legacy-adapter/final-readiness.server';
import identities from '../../../lib/smart-textbook-publishing/assets/v1/chapter-one-identities.server';
import history from '../../../lib/smart-textbook-publishing/assets/v1/chapter-one-service-identities.server';
import { createAdminClient } from '../../../lib/supabase/admin';

/** Fixed chapter reader + existing frozen identity ledgers, not test source content.
 * Only the owner-guarded audit gateway calls this. No production pointer or cache of users. */
export async function readAuditSource(){
  const admin=createAdminClient();
  const source=await readChapterOneLegacySource(admin);
  const evidence=await readChapterOneServiceEvidence(admin,source);
  const result=finalizeChapterOneNonUiReadiness(source,identities,history,evidence);
  if(!result.nonUiRuntimeReady||!result.manifest||!result.services)throw Error('第一章源数据已变化或私有绑定未通过验证，请重新审计。');
  return {admin,source,result:{...result,manifest:result.manifest,services:result.services}};
}
export type AuditSource=Awaited<ReturnType<typeof readAuditSource>>;
