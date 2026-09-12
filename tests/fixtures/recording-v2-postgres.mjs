import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
export function processResult(command, args, input = '') {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', b => { stdout += b; }); child.stderr.on('data', b => { stderr += b; });
    child.on('error', reject); child.on('close', code => resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }));
    child.stdin.on('error', () => {}); child.stdin.end(input);
  });
}
export async function isolatedRecordingPostgres(secret, { existingPgcrypto = true, beforeV2 } = {}) {
  // No host database URL, no env-file, network, published port or volume mount.
  const name = `uply-recording-4a5-${randomUUID()}`;
  const start = await processResult('docker', ['run','--detach','--rm','--network','none',
    '--label','uply.test=recording-4a5','--name',name,'--tmpfs','/var/lib/postgresql/data',
    '-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:15-alpine']);
  if (start.code) throw new Error(`Isolated PostgreSQL unavailable: ${start.stderr}`);
  const id = start.stdout;
  // TCP inside the network-isolated container excludes the entrypoint's
  // temporary initialization server (which only listens on a Unix socket).
  const raw = sql => processResult('docker', ['exec','-i',id,'psql','-h','127.0.0.1','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres'], sql);
  const query = async sql => { const r = await raw(sql); if (r.code) throw new Error(r.stderr); return r.stdout; };
  const stop = async () => { const r = await processResult('docker',['stop','--time','2',id]); if (r.code) throw new Error(r.stderr); };
  try {
    let ready = false;
    for (let i=0;i<100;i++) { if (!(await raw('select 1')).code) { ready=true;break; } await new Promise(r=>setTimeout(r,100)); }
    if (!ready) throw new Error('Isolated PostgreSQL startup timed out');
    const bootstrap = read('tests/fixtures/recording-v2-bootstrap.sql');
    await query(existingPgcrypto ? bootstrap : bootstrap.replace('create extension pgcrypto;', ''));
    const old = read('supabase/migrations/202608180008_open_activity_unscored_mastery.sql');
    const fn = old.slice(old.indexOf('create function public.record_smart_textbook_attempt('),old.indexOf('-- Keep the shared seven-argument'));
    await query(fn); // Actual historical eight-argument domain transaction, NOT a mock.
    await query(read('supabase/migrations/202608180023_speaking_recording_evidence.sql'));
    // The roleplay migration also seeds production chapter content. Execute only
    // its actual metadata DDL; no content seed is needed in a synthetic database.
    const role = read('supabase/migrations/202608230010_add_chapter_one_dialogue_roleplay.sql');
    const metadataDdl = role.match(/alter table public\.digital_textbook_speaking_evidence[\s\S]*?;/i)?.[0];
    if (!metadataDdl) throw new Error('Missing historical metadata DDL');
    await query(metadataDdl);
    if (beforeV2) await beforeV2({ id, raw, query });
    await query(read('supabase/migrations/202609090001_recording_evidence_atomic_v2.sql'));
    // Synthetic random test key only; never logged or read from production env.
    await query(`insert into recording_private.proof_keys(id,secret) values('isolated',decode('${secret.toString('hex')}','hex'));`);
    return { id, raw, query, stop };
  } catch (error) { await stop(); throw error; }
}
export const literal = value => `'${String(value).replaceAll("'","''")}'`;
export const json = value => value === null ? 'null::jsonb' : `${literal(JSON.stringify(value))}::jsonb`;
export const service = sql => `set role service_role; set request.jwt.claim.role='service_role'; ${sql}`;
