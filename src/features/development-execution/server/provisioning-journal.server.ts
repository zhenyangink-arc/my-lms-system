import 'server-only';
import { open, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import type { FileHandle } from 'node:fs/promises';
import type { ProvisioningJournal } from './provisioning-contract.ts';

/** Existing private operations directory; never create it from browser input.
 * Single canonical operation, not a scenario/progress registry. No automatic reset. */
export function createProvisioningJournal(directory: string): ProvisioningJournal {
  let handle: FileHandle | undefined;
  async function append(value: unknown) {
    if (!handle) throw Error('JOURNAL_NOT_CLAIMED');
    await handle.writeFile(JSON.stringify(value) + '\n'); await handle.sync();
  }
  return {
    async claim() {
      const stat = await lstat(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.()) throw Error('PRIVATE_JOURNAL_REQUIRED');
      try { handle = await open(join(directory, 'development-domain-execution-v1.provision.jsonl'), 'wx', 0o600); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false; throw error; }
      await append({ contract: 'development-domain-execution/1', state: 'CLAIMED' });
      const parent = await open(directory, 'r'); try { await parent.sync(); } finally { await parent.close(); }
      return true;
    },
    async dispatched(stage) { await append({ stage, state: 'DISPATCHED' }); },
    async finish(result) { try { await append(result); } finally { await handle?.close(); handle = undefined; } },
  };
}
