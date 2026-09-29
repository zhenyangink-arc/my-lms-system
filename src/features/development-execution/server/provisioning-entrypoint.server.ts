import 'server-only';
import { readFile, lstat, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { DEVELOPMENT_BINDING as B, assertEnvironment, assertSnapshot, classify, snapshotSchema } from './provisioning-contract.ts';
import type { ProvisioningResult } from './provisioning-contract.ts';
import { createDevelopmentProvisioningDependencies } from './provisioning-composition.server.ts';
import { provisionDevelopmentExecution } from './provisioning.service.ts';
import { createDevelopmentReadOnlyTransport, verifyDevelopmentDbService, DB_SERVICE_SHA256 } from './provisioning-transport.server.ts';

export const ENTRYPOINT_DIRECTORY = '/home/yangzhen/.config/uply-first-enable-20260910/development-execution';
export const ENTRYPOINT_APPROVAL_FILE = `${ENTRYPOINT_DIRECTORY}/approval-b.json`;
export const JOURNAL_DIRECTORY = `${ENTRYPOINT_DIRECTORY}/journal`;
export const CANONICAL_DIRECTORY = '/home/yangzhen/releases/uply-first-enable-20260910/source';
export const BUDGET_SHA256 = '2f19347af4611a4c44b82424cafef66e19417ffc142c93432f54ccedf1dbb7c2';
const RUNTIME_SHA256 = '7a4b31b099fb968dd1105f8fbc67b946ae3fa79c30873998f8864ef1578878c8';
const hash = (v: string) => createHash('sha256').update(v).digest('hex');
export const entrypointApprovalSchema = z.strictObject({
  contract: z.literal('development-provisioning-entrypoint/1'), approval: z.literal('Approval B'), enabled: z.literal(true),
  environment: z.literal(B.environment), databaseIdentity: z.literal(B.databaseIdentity), apiOriginSha256: z.literal(B.apiOriginSha256),
  budgetSha256: z.literal(BUDGET_SHA256), dbServiceSha256: z.literal(DB_SERVICE_SHA256), runtimeSha256: z.literal(RUNTIME_SHA256),
  buildId: z.string().regex(/^[A-Za-z0-9_-]{10,80}$/), issuedAt: z.iso.datetime({ offset: true }), expiresAt: z.iso.datetime({ offset: true }),
});
export type EntrypointState = { status: 'READY' | 'EXISTING' | 'BLOCKED'; scope: 'DISABLED' };
export function validateEntrypointApproval(raw: unknown, facts: { now: number; cwd: string; buildId: string; apiOrigin: string; runtimeHash: string }) {
  const a = entrypointApprovalSchema.parse(raw), issued = Date.parse(a.issuedAt), expiry = Date.parse(a.expiresAt);
  assertEnvironment(a, facts.now);
  if (issued > facts.now || expiry <= issued || expiry - issued > 30 * 60_000 || facts.cwd !== CANONICAL_DIRECTORY ||
      facts.buildId !== a.buildId || hash(facts.apiOrigin.replace(/\/$/, '')) !== a.apiOriginSha256 || facts.runtimeHash !== a.runtimeSha256) throw Error('DEVELOPMENT_ENTRYPOINT_DENIED');
  return a;
}
async function privatePath(path: string, directory: boolean) {
  const s = await lstat(path);
  if (s.isSymbolicLink() || (directory ? !s.isDirectory() : !s.isFile()) || s.uid !== process.getuid?.() || (s.mode & 0o077)) throw Error('PRIVATE_ENTRYPOINT_CONFIG_REQUIRED');
}
async function journalClaimExists() {
  await privatePath(JOURNAL_DIRECTORY, true);
  try { await lstat(`${JOURNAL_DIRECTORY}/development-domain-execution-v1.provision.jsonl`); return true; }
  catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false; throw e; }
}
async function loadDependencies(caller: SupabaseClient) {
  await privatePath(ENTRYPOINT_DIRECTORY, true); await privatePath(ENTRYPOINT_APPROVAL_FILE, false);
  const raw = JSON.parse(await readFile(ENTRYPOINT_APPROVAL_FILE, 'utf8'));
  const cwd = await realpath(process.cwd());
  const a = validateEntrypointApproval(raw, { now: Date.now(), cwd, buildId: (await readFile(`${cwd}/.next/BUILD_ID`, 'utf8')).trim(),
    apiOrigin: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', runtimeHash: hash(await readFile('/home/yangzhen/.config/uply-first-enable-20260910/runtime.json', 'utf8')) });
  await verifyDevelopmentDbService();
  return createDevelopmentProvisioningDependencies({ environment: a, connectionIdentity: a.databaseIdentity, journalDirectory: JOURNAL_DIRECTORY,
    admin: createAdminClient, readOnlyTransport: createDevelopmentReadOnlyTransport }, caller);
}
type Dependencies = ReturnType<typeof createDevelopmentProvisioningDependencies>;
/** Shared entry preflight only; the existing service still owns all four writes
 * and the exclusive claim. This guard never repairs partial state or claims. */
export async function inspectProvisioningEntrypoint(d: Dependencies, claimExists: () => Promise<boolean>): Promise<EntrypointState> {
  const s = snapshotSchema.parse(await d.reader.read()); assertSnapshot(s, d.environment, Date.now());
  const state = classify(s, d.environment);
  if (state === 'COMPLETE') return { status: 'EXISTING', scope: 'DISABLED' };
  if (state !== 'EMPTY' || await claimExists()) return { status: 'BLOCKED', scope: 'DISABLED' };
  return { status: 'READY', scope: 'DISABLED' };
}
/** Caller is obtained only after the page/action's requirePlatformOwner guard. */
export async function readProvisioningEntrypoint(caller: SupabaseClient): Promise<EntrypointState> {
  try { return await inspectProvisioningEntrypoint(await loadDependencies(caller), journalClaimExists); }
  catch { return { status: 'BLOCKED', scope: 'DISABLED' }; }
}
export async function executeProvisioningEntrypoint(caller: SupabaseClient): Promise<ProvisioningResult> {
  const d = await loadDependencies(caller);
  return executePreparedProvisioningEntrypoint(d, journalClaimExists);
}
/** Server-internal contract seam for isolated tests; not a Server Action. */
export async function executePreparedProvisioningEntrypoint(d: Dependencies, claimExists: () => Promise<boolean>): Promise<ProvisioningResult> {
  const state = await inspectProvisioningEntrypoint(d, claimExists);
  if (state.status !== 'READY') return { contract: 'development-domain-execution/1', status: state.status === 'EXISTING' ? 'EXISTING' : 'DENIED', classification: state.status === 'EXISTING' ? 'COMPLETE' : 'UNKNOWN', stage: null, scope: 'DISABLED' };
  return provisionDevelopmentExecution(d); // Exactly one invocation; never retry UNKNOWN.
}
