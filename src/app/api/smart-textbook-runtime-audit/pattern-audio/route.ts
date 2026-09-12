import { z } from 'zod';
import { requirePlatformOwner } from '@/lib/admin';
import { auditSession } from '@/features/smart-textbook-runtime/server/audit-session.server';
import { patternAudioBytes } from '@/features/smart-textbook-runtime/server/pattern-media.server';
const inputSchema = z.strictObject({sessionId:z.uuid(),snapshotId:z.string(),capsuleRef:z.string(),turnId:z.string()});
export async function GET(request: Request) {
  let owner: string;
  try { owner = (await requirePlatformOwner()).user.id; } catch { return new Response(null,{status:403}); }
  try {
    if (request.headers.get('sec-fetch-site') === 'cross-site' || request.headers.get('sec-fetch-dest') === 'document') throw Error('CROSS_SITE');
    const params = new URL(request.url).searchParams;
    if (new Set(params.keys()).size !== [...params.keys()].length) throw Error('DUPLICATE_PARAMETER');
    const input = inputSchema.parse(Object.fromEntries(params)), session = auditSession(owner,input.sessionId);
    const {manifest,bindings} = session.data.result;
    if (input.snapshotId !== manifest.snapshot.id) throw Error('SNAPSHOT');
    const blob = await patternAudioBytes(manifest,bindings,input.capsuleRef,input.turnId,request.signal);
    return new Response(blob,{status:blob?200:204,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...(blob?{'Content-Type':blob.type}:{})}});
  } catch { return new Response(null,{status:404,headers:{'Cache-Control':'private, no-store'}}); }
}
