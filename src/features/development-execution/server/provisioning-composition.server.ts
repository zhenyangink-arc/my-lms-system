import 'server-only';
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertEnvironment, DEVELOPMENT_BINDING } from './provisioning-contract.ts';
import type { ProvisioningEnvironment, ProvisioningReadOnlyTransport } from './provisioning-contract.ts';
import { createProvisioningReadback } from './provisioning-readback.server.ts';
import { createSupabaseProvisioningWriter } from './supabase-provisioning-adapter.server.ts';
import { createProvisioningJournal } from './provisioning-journal.server.ts';

export type DevelopmentProvisioningInstallation = {
  environment: ProvisioningEnvironment;
  /** Existing trusted transport factory MUST create a fresh read-only connection. */
  readOnlyTransport: () => ProvisioningReadOnlyTransport;
  connectionIdentity: string; journalDirectory: string;
  admin: () => SupabaseClient;
};
let installation: Readonly<DevelopmentProvisioningInstallation> | undefined;
/** Called only by an approved standalone development composition. This module
 * has no imports from production pages/routes/compositions and is not installed
 * by default. NODE_ENV is deliberately not an admission authority. */
export function installDevelopmentProvisioning(value: DevelopmentProvisioningInstallation) {
  if (installation) throw Error('DEVELOPMENT_PROVISIONING_ALREADY_INSTALLED');
  assertEnvironment(value.environment, Date.now());
  if (value.connectionIdentity !== value.environment.databaseIdentity) throw Error('DATABASE_IDENTITY_MISMATCH');
  installation = Object.freeze({ ...value, environment: Object.freeze({ ...value.environment }) });
}
export function developmentProvisioningDependencies(caller: SupabaseClient) {
  if (!installation) throw Error('DEVELOPMENT_PROVISIONING_NOT_INSTALLED');
  return createDevelopmentProvisioningDependencies(installation, caller);
}
/** Explicit request-scoped installation; no process-global enable or sliding expiry. */
export function createDevelopmentProvisioningDependencies(i: Readonly<DevelopmentProvisioningInstallation>, caller: SupabaseClient) {
  assertEnvironment(i.environment, Date.now());
  if (i.connectionIdentity !== i.environment.databaseIdentity) throw Error('DATABASE_IDENTITY_MISMATCH');
  const admin = i.admin();
  for (const client of [caller, admin]) {
    const origin: unknown = Reflect.get(client, 'supabaseUrl');
    if (typeof origin !== 'string' || createHash('sha256').update(origin.replace(/\/$/, '')).digest('hex') !== DEVELOPMENT_BINDING.apiOriginSha256)
      throw Error('AUTH_API_DATABASE_BINDING_MISMATCH');
  }
  return { environment: i.environment,
    reader: { read: () => createProvisioningReadback(i.readOnlyTransport(), i.connectionIdentity).read() },
    writer: createSupabaseProvisioningWriter(caller, admin),
    journal: createProvisioningJournal(i.journalDirectory),
  };
}
