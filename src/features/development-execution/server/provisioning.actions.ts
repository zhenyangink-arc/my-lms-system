'use server';
import { requirePlatformOwner } from '@/lib/admin';
import { executeProvisioningEntrypoint } from './provisioning-entrypoint.server.ts';
import type { ProvisioningResult } from './provisioning-contract.ts';

/** Environment-gated internal page only. Browser arguments are never authority. */
export async function provisionDevelopmentExecutionAction(...input: unknown[]): Promise<ProvisioningResult> {
  const { supabase } = await requirePlatformOwner();
  if (input.length) return { contract: 'development-domain-execution/1', status: 'DENIED', classification: 'UNKNOWN', stage: null, scope: 'DISABLED' };
  try { return await executeProvisioningEntrypoint(supabase); }
  catch { return { contract: 'development-domain-execution/1', status: 'DENIED', classification: 'UNKNOWN', stage: null, scope: 'DISABLED' }; }
}
