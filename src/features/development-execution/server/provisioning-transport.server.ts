import 'server-only';
import { execFile } from 'node:child_process';
import { readFile, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { ProvisioningReadOnlyTransport } from './provisioning-contract.ts';

export const DEVELOPMENT_DB_DIRECTORY = '/home/yangzhen/.config/uply-first-enable-20260910/db';
export const DB_SERVICE_SHA256 = '9540a50b93e528433a856aba8f2f98029c488cb8f3dd68f6a30941629a8fdb8c';
/** Existing libpq service and read-only Docker/psql pattern. No new driver,
 * credential copy, arbitrary command, caller SQL or write-capable connection. */
export async function verifyDevelopmentDbService() {
  const file = `${DEVELOPMENT_DB_DIRECTORY}/pg_service.conf`;
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== process.getuid?.() || (stat.mode & 0o077)) throw Error('DB_SERVICE_DENIED');
  const config = await readFile(file, 'utf8');
  if (createHash('sha256').update(config).digest('hex') !== DB_SERVICE_SHA256 ||
      !config.includes('sslmode=verify-full') && !config.includes('sslmode = verify-full')) throw Error('DB_SERVICE_DENIED');
}
export function createDevelopmentReadOnlyTransport(): ProvisioningReadOnlyTransport {
  return { async transaction(sql) {
    await verifyDevelopmentDbService();
    if (!sql.startsWith('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;') || /\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|CALL)\b/i.test(sql)) throw Error('READ_ONLY_STATEMENT_REQUIRED');
    return new Promise((resolve, reject) => {
      const child = execFile('docker', ['run','--rm','--pull=never','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges',
        '--user',`${process.getuid?.()}:${process.getgid?.()}`,'--network=host','-i','--mount',`type=bind,source=${DEVELOPMENT_DB_DIRECTORY},target=/connection,readonly`,
        '-e','PGSERVICEFILE=/connection/pg_service.conf','-e','PGOPTIONS=-c default_transaction_read_only=on','--entrypoint','psql',
        'public.ecr.aws/supabase/postgres:17.6.1.159','-X','-qAt','-w','-v','ON_ERROR_STOP=1','service=uply'],
      { timeout: 20_000, maxBuffer: 256 * 1024 }, (error, stdout) => {
        if (error) { reject(Error('PROVISIONING_READBACK_UNAVAILABLE')); return; }
        try { const lines = stdout.split('\n').filter(s => s.startsWith('{')); if (lines.length !== 1) throw Error(); resolve(JSON.parse(lines[0])); }
        catch { reject(Error('PROVISIONING_READBACK_INVALID')); }
      });
      child.stdin?.on('error', () => reject(Error('PROVISIONING_READBACK_UNAVAILABLE')));
      child.stdin?.end(sql);
    });
  } };
}
